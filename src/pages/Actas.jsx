import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { leerHoja, escribirFila, actualizarFila } from '../services/googleSheets'

const NOMBRES = { '1': 'Lorenzo', '2': 'Ahlam', '3': 'Jannet' }

export default function Actas() {
  const { usuario, accessToken } = useAuth()
  const [eventos, setEventos] = useState([])
  const [todosEventos, setTodosEventos] = useState([])
  const [actas, setActas] = useState([])
  const [tareasActivas, setTareasActivas] = useState([])
  const [actaActual, setActaActual] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState('lista')

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [ev, ac, t, ts, td] = await Promise.all([
        leerHoja('eventos', accessToken),
        leerHoja('actas', accessToken),
        leerHoja('tareas', accessToken),
        leerHoja('tareas_soporte', accessToken),
        leerHoja('tareas_direccion', accessToken),
      ])
      setEventos(ev.filter(e => e.id !== 'eliminado' && e.estado !== 'completado' && e.usuario_id && e.usuario_id.split(',').map(s => s.trim()).includes(String(usuario.id))).sort((a,b) => (b.fecha_exacta||'') > (a.fecha_exacta||'') ? 1 : -1))
      setActas(ac.filter(a => a.id !== 'eliminado').sort((a,b) => (b.fecha_creacion||'') > (a.fecha_creacion||'') ? 1 : -1))
      // Guardar TODOS los eventos para buscar nombres en actas guardadas
      setTodosEventos(ev.filter(e => e.id !== 'eliminado'))
      const activas = [
        ...t.filter(x => x.id !== 'eliminado' && x.estado !== 'completada' && x.estado !== 'completado').map(x => ({ id: x.id, nombre: x.nombre, origen: 'Proyectos' })),
        ...ts.filter(x => x.id !== 'eliminado' && x.estado !== 'completada' && x.estado !== 'completado').map(x => ({ id: x.id, nombre: x.nombre, origen: 'Soporte' })),
        ...td.filter(x => x.id !== 'eliminado' && x.estado !== 'completada' && x.estado !== 'completado').map(x => ({ id: x.id, nombre: x.nombre, origen: 'Dirección' })),
      ].sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'))
      setTareasActivas(activas)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function crearActa(evento) {
    const participantes = evento.usuario_id ? evento.usuario_id.split(',').map(id => NOMBRES[id.trim()] || id).join(', ') : ''
    setActaActual({
      id: Date.now().toString(),
      evento_id: evento.id,
      fecha: evento.fecha_exacta || new Date().toISOString().split('T')[0],
      participantes,
      agenda: '',
      fecha_creacion: new Date().toISOString(),
      _evento: evento,
      _nueva: true,
      _secciones: [{ id: Date.now().toString(), titulo: '', contenido: '' }]
    })
    setVista('editar')
  }

  function abrirActa(acta) {
    const evento = eventos.find(e => e.id === acta.evento_id) || null
    let secciones
    try { secciones = JSON.parse(acta.acuerdos) } catch { secciones = [{ id: Date.now().toString(), titulo: acta.acuerdos || '', contenido: '' }] }
    setActaActual({ ...acta, _evento: evento, _secciones: secciones })
    setVista('editar')
  }

  async function guardarActa() {
    if (!actaActual) return
    setGuardando(true)
    try {
      const secciones = actaActual._secciones || []
      const acuerdosStr = JSON.stringify(secciones)
      const fila = [actaActual.id, actaActual.evento_id || '', actaActual.fecha, actaActual.participantes, actaActual.agenda || '', acuerdosStr, actaActual.fecha_creacion || new Date().toISOString()]
      const existe = actas.find(a => a.id === actaActual.id)
      if (existe) await actualizarFila('actas', actaActual.id, fila, accessToken)
      else await escribirFila('actas', fila, accessToken)
      await cargarDatos()
    } catch(err) { console.error(err) }
    finally { setGuardando(false) }
  }

  function exportarPDF() {
    if (!actaActual) return
    const secciones = actaActual._secciones || []
    const eventoTitulo = actaActual._evento?.titulo || 'Reunión'
    const horaInicio = actaActual._evento?.hora_inicio || ''
    const horaFin = actaActual._evento?.hora_fin || ''
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Acta - ${eventoTitulo}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto}.header{border-bottom:3px solid #00953B;padding-bottom:16px;margin-bottom:24px}.header h1{margin:0;font-size:22px}.header h2{margin:6px 0 0;font-size:16px;color:#00953B;font-weight:400}.meta{display:flex;gap:32px;margin-bottom:28px;font-size:14px}.agenda{margin-bottom:28px}.agenda h3,.acuerdos-title{font-size:15px;color:#00953B;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:10px}.seccion{margin-bottom:20px;border-left:3px solid #00953B;padding-left:14px}.seccion h4{font-size:14px;font-weight:700;margin:0 0 6px}.seccion p{font-size:13px;line-height:1.6;white-space:pre-wrap;margin:0;color:#333}.footer{margin-top:48px;border-top:1px solid #ddd;padding-top:12px;font-size:11px;color:#888;text-align:center}@media print{body{padding:20px}}</style>
      </head><body>
      <div class="header"><h1>ACTA DE REUNIÓN</h1><h2>${eventoTitulo}</h2></div>
      <div class="meta"><span><strong>Fecha:</strong> ${actaActual.fecha}</span>${horaInicio?`<span><strong>Hora:</strong> ${horaInicio}${horaFin?` — ${horaFin}`:''}</span>`:''}<span><strong>Participantes:</strong> ${actaActual.participantes}</span></div>
      ${actaActual.agenda?`<div class="agenda"><h3>AGENDA</h3><p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${actaActual.agenda}</p></div>`:''}
      <h3 class="acuerdos-title">ACUERDOS</h3>
      ${secciones.map((s,i)=>`<div class="seccion">${s.titulo?`<h4>${i+1}. ${s.titulo}</h4>`:`<h4>Punto ${i+1}</h4>`}<p>${s.contenido||'—'}</p></div>`).join('')}
      <div class="footer">Documento generado por Fertinyect TimeTracker · ${new Date().toLocaleDateString('es-ES')}</div>
      <script>window.onload=function(){window.print()}</script></body></html>`)
    win.document.close()
  }

  function updateSeccion(idx, campo, valor) {
    const secciones = [...(actaActual._secciones || [])]
    secciones[idx] = { ...secciones[idx], [campo]: valor }
    setActaActual({ ...actaActual, _secciones: secciones })
  }

  function addSeccion() {
    const secciones = [...(actaActual._secciones || []), { id: Date.now().toString(), titulo: '', contenido: '' }]
    setActaActual({ ...actaActual, _secciones: secciones })
  }

  function removeSeccion(idx) {
    const secciones = (actaActual._secciones || []).filter((_, i) => i !== idx)
    setActaActual({ ...actaActual, _secciones: secciones.length > 0 ? secciones : [{ id: Date.now().toString(), titulo: '', contenido: '' }] })
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  if (vista === 'editar' && actaActual) {
    const secciones = actaActual._secciones || [{ id: '1', titulo: '', contenido: '' }]
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

        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Fecha:</label>
              <input type="date" value={actaActual.fecha} onChange={e => setActaActual({...actaActual, fecha: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Participantes:</label>
              <input value={actaActual.participantes} onChange={e => setActaActual({...actaActual, participantes: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Agenda <span style={{ fontWeight: '400', color: '#9ca3af' }}>(opcional)</span>:</label>
            <textarea value={actaActual.agenda} onChange={e => setActaActual({...actaActual, agenda: e.target.value})} placeholder="Puntos a tratar..." rows={3} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', resize: 'vertical' }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Acuerdos por punto:</label>
              <button onClick={addSeccion} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #00953B', background: '#f0fdf4', color: '#00953B', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>+ Añadir punto</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {secciones.map((s, idx) => (
                <SeccionActa key={s.id} seccion={s} idx={idx} tareasActivas={tareasActivas} onUpdate={(campo, valor) => updateSeccion(idx, campo, valor)} onRemove={secciones.length > 1 ? () => removeSeccion(idx) : null} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ margin: '0 0 24px' }}>📋 Actas de reunión</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Reuniones activas</h3>
          {eventos.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No hay reuniones pendientes</p>}
          {eventos.map(ev => (
            <div key={ev.id} style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7c3aed', cursor: 'pointer' }}
              onClick={() => crearActa(ev)} onMouseOver={e => e.currentTarget.style.background='#faf5ff'} onMouseOut={e => e.currentTarget.style.background='white'}>
              <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '14px' }}>🗓 {ev.titulo}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{ev.fecha_exacta}{ev.hora_inicio ? ` · ${ev.hora_inicio}` : ''}</p>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#7c3aed' }}>Click para crear acta →</p>
            </div>
          ))}
        </div>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Actas guardadas</h3>
          {actas.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>Aún no hay actas</p>}
          {actas.map(acta => (
            <div key={acta.id} style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #00953B', cursor: 'pointer', position: 'relative' }}
              onClick={() => abrirActa(acta)} onMouseOver={e => e.currentTarget.style.background='#f0fdf4'} onMouseOut={e => e.currentTarget.style.background='white'}>
              <button onClick={async e => { e.stopPropagation(); if(confirm('¿Eliminar esta acta?')) { await actualizarFila('actas', acta.id, ['eliminado', acta.evento_id||'', acta.fecha, acta.participantes, acta.agenda||'', acta.acuerdos||'', acta.fecha_creacion||''], accessToken); cargarDatos() } }}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '14px', opacity: 0.4 }}
                onMouseOver={e=>e.target.style.opacity='1'} onMouseOut={e=>e.target.style.opacity='0.4'}>🗑</button>
              <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '14px' }}>{acta.fecha} — {todosEventos.find(e => e.id === acta.evento_id)?.titulo || eventos.find(e => e.id === acta.evento_id)?.titulo || 'Reunión'}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{acta.participantes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SeccionActa({ seccion, idx, tareasActivas, onUpdate, onRemove }) {
  const [busqueda, setBusqueda] = useState('')
  const [mostrarDrop, setMostrarDrop] = useState(false)
  const filtradas = busqueda.length > 0 ? tareasActivas.filter(t => t.nombre?.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8) : []

  return (
    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: '#00953B' }}>Punto {idx + 1}</span>
        {onRemove && <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '14px' }}>✕</button>}
      </div>
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <input
          placeholder="Nombre del tema o tarea (ej: PY23-01) — escribe para buscar"
          value={seccion.titulo}
          onChange={e => { onUpdate('titulo', e.target.value); setBusqueda(e.target.value); setMostrarDrop(true) }}
          onFocus={() => setMostrarDrop(true)}
          onBlur={() => setTimeout(() => setMostrarDrop(false), 200)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', fontWeight: '600' }}
        />
        {mostrarDrop && filtradas.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
            {filtradas.map(t => (
              <div key={t.id} onMouseDown={() => { onUpdate('titulo', t.nombre); setBusqueda(''); setMostrarDrop(false) }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseOver={e => e.currentTarget.style.background='#f0fdf4'} onMouseOut={e => e.currentTarget.style.background='white'}>
                <span>{t.nombre}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px', flexShrink: 0 }}>{t.origen}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <textarea
        placeholder="Acuerdos de este punto..."
        value={seccion.contenido}
        onChange={e => onUpdate('contenido', e.target.value)}
        rows={3}
        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', resize: 'vertical' }}
      />
    </div>
  )
}
