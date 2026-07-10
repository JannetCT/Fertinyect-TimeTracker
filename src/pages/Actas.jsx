import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { leerHoja, escribirFila, actualizarFila } from '../services/googleSheets'
import html2canvas from 'html2canvas'

const NOMBRES = { '1': 'Lorenzo', '2': 'Ahlam', '3': 'Jannet' }
const COLORES = { '1': '#00953B', '2': '#3b82f6', '3': '#f59e0b' }

export default function Actas() {
  const { usuario, accessToken } = useAuth()
  const [eventos, setEventos] = useState([])
  const [actas, setActas] = useState([])
  const [actaActual, setActaActual] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState('lista') // 'lista' | 'editar' | 'ver'
  const actaRef = useRef(null)

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [ev, ac] = await Promise.all([
        leerHoja('eventos', accessToken),
        leerHoja('actas', accessToken)
      ])
      const misId = String(usuario.id)
      setEventos(ev.filter(e => e.usuario_id && e.usuario_id.split(',').includes(misId) && e.estado !== 'completado').sort((a,b) => b.fecha_exacta > a.fecha_exacta ? 1 : -1))
      setActas(ac.sort((a,b) => b.fecha_creacion > a.fecha_creacion ? 1 : -1))
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function crearActa(evento) {
    const participantes = evento.usuario_id ? evento.usuario_id.split(',').map(id => NOMBRES[id.trim()] || id).join(', ') : ''
    const nueva = {
      id: Date.now().toString(),
      evento_id: evento.id,
      fecha: evento.fecha_exacta || new Date().toISOString().split('T')[0],
      participantes,
      agenda: '',
      acuerdos: '',
      fecha_creacion: new Date().toISOString(),
      _evento: evento
    }
    setActaActual(nueva)
    setVista('editar')
  }

  async function abrirActa(acta) {
    const evento = eventos.find(e => e.id === acta.evento_id) || null
    setActaActual({ ...acta, _evento: evento })
    setVista('editar')
  }

  async function guardarActa() {
    if (!actaActual) return
    setGuardando(true)
    try {
      const fila = [actaActual.id, actaActual.evento_id || '', actaActual.fecha, actaActual.participantes, actaActual.agenda || '', actaActual.acuerdos || '', actaActual.fecha_creacion || new Date().toISOString()]
      const existe = actas.find(a => a.id === actaActual.id)
      if (existe) await actualizarFila('actas', actaActual.id, fila, accessToken)
      else await escribirFila('actas', fila, accessToken)
      await cargarDatos()
    } catch(err) { console.error(err) }
    finally { setGuardando(false) }
  }

  async function exportarPDF() {
    if (!actaRef.current) return
    const canvas = await html2canvas(actaRef.current, { scale: 2, backgroundColor: '#ffffff' })
    const link = document.createElement('a')
    link.download = `Acta-${actaActual.fecha}-${(actaActual._evento?.titulo || 'reunion').replace(/\s+/g,'-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  if (vista === 'editar' && actaActual) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => { setVista('lista'); setActaActual(null) }} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>← Volver</button>
          <h1 style={{ margin: 0, fontSize: '20px' }}>📋 {actaActual._evento?.titulo || 'Acta de reunión'}</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={guardarActa} disabled={guardando} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>{guardando ? 'Guardando...' : '💾 Guardar'}</button>
            <button onClick={exportarPDF} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>📄 Exportar PDF</button>
          </div>
        </div>

        {/* Área de edición */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Fecha:</label>
              <input type="date" value={actaActual.fecha} onChange={e => setActaActual({...actaActual, fecha: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Participantes:</label>
              <input value={actaActual.participantes} onChange={e => setActaActual({...actaActual, participantes: e.target.value})} placeholder="Ej: Lorenzo, Ahlam, Jannet" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Agenda <span style={{ fontWeight: '400', color: '#9ca3af' }}>(opcional)</span>:</label>
            <textarea value={actaActual.agenda} onChange={e => setActaActual({...actaActual, agenda: e.target.value})} placeholder="Puntos a tratar en la reunión..." rows={4} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Acuerdos:</label>
            <textarea value={actaActual.acuerdos} onChange={e => setActaActual({...actaActual, acuerdos: e.target.value})} placeholder="Decisiones y compromisos alcanzados..." rows={8} style={{ padding: '10px', borderRadius: '8px', border: '2px solid #00953B', fontSize: '14px', width: '100%', resize: 'vertical' }} />
          </div>
        </div>

        {/* Preview PDF (oculto visualmente pero usado para exportar) */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div ref={actaRef} style={{ width: '794px', padding: '60px', background: 'white', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ borderBottom: '3px solid #00953B', paddingBottom: '20px', marginBottom: '30px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', color: '#373A36' }}>ACTA DE REUNIÓN</h1>
              <h2 style={{ margin: '8px 0 0', fontSize: '18px', color: '#00953B', fontWeight: '400' }}>{actaActual._evento?.titulo || 'Reunión'}</h2>
            </div>
            <div style={{ display: 'flex', gap: '40px', marginBottom: '30px', fontSize: '14px' }}>
              <div><strong>Fecha:</strong> {actaActual.fecha}</div>
              {actaActual._evento?.hora_inicio && <div><strong>Hora:</strong> {actaActual._evento.hora_inicio}{actaActual._evento.hora_fin ? ` - ${actaActual._evento.hora_fin}` : ''}</div>}
              <div><strong>Participantes:</strong> {actaActual.participantes}</div>
            </div>
            {actaActual.agenda && (
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '16px', color: '#00953B', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>AGENDA</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{actaActual.agenda}</p>
              </div>
            )}
            <div>
              <h3 style={{ fontSize: '16px', color: '#00953B', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>ACUERDOS</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{actaActual.acuerdos || '—'}</p>
            </div>
            <div style={{ marginTop: '60px', borderTop: '1px solid #e5e7eb', paddingTop: '20px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
              Documento generado por Fertinyect TimeTracker · {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>📋 Actas de reunión</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Columna eventos activos */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Reuniones activas</h3>
          {eventos.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No hay reuniones pendientes</p>}
          {eventos.map(ev => (
            <div key={ev.id} style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7c3aed', cursor: 'pointer' }}
              onClick={() => crearActa(ev)}
              onMouseOver={e => e.currentTarget.style.background = '#faf5ff'}
              onMouseOut={e => e.currentTarget.style.background = 'white'}>
              <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '14px' }}>🗓 {ev.titulo}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{ev.fecha_exacta}{ev.hora_inicio ? ` · ${ev.hora_inicio}` : ''}</p>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#7c3aed' }}>Click para crear acta →</p>
            </div>
          ))}
        </div>

        {/* Columna actas guardadas */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Actas guardadas</h3>
          {actas.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>Aún no hay actas</p>}
          {actas.map(acta => (
            <div key={acta.id} style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #00953B', cursor: 'pointer' }}
              onClick={() => abrirActa(acta)}
              onMouseOver={e => e.currentTarget.style.background = '#f0fdf4'}
              onMouseOut={e => e.currentTarget.style.background = 'white'}>
              <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '14px' }}>{acta.fecha} — {eventos.find(e => e.id === acta.evento_id)?.titulo || 'Reunión'}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{acta.participantes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
