import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { leerHoja, escribirFila, actualizarFila } from '../services/googleSheets'

const NOMBRES = { '1': 'Lorenzo', '2': 'Ahlam', '3': 'Jannet' }
// Colores iguales que el calendario grupal
const COLORES_USUARIO = { '1': '#00953B', '2': '#ec4899', '3': '#f97316' } // Lorenzo=verde, Ahlam=rosa, Jannet=naranja
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatMes(key) {
  const [year, month] = key.split('-')
  return `${MESES[parseInt(month)-1]} ${year}`
}

function agruparPorMes(actas) {
  const grupos = {}
  actas.forEach(acta => {
    const fecha = acta.fecha || acta.fecha_creacion || ''
    const key = fecha.slice(0, 7)
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(acta)
  })
  // Dentro de cada grupo ordenar por fecha desc (más reciente arriba)
  Object.values(grupos).forEach(g => g.sort((a, b) => (b.fecha || '') > (a.fecha || '') ? 1 : -1))
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}

function getLunesViernes(fechaStr) {
  const fecha = new Date(fechaStr + 'T12:00:00')
  const dia = fecha.getDay()
  const lunes = new Date(fecha)
  lunes.setDate(fecha.getDate() - (dia === 0 ? 6 : dia - 1))
  const viernes = new Date(lunes)
  viernes.setDate(lunes.getDate() + 4)
  return { lunes, viernes }
}

function semanaKey(fechaStr) {
  const { lunes } = getLunesViernes(fechaStr)
  return lunes.toISOString().slice(0, 10)
}

function semanaLabel(fechaStr) {
  const { lunes, viernes } = getLunesViernes(fechaStr)
  const mes = MESES[viernes.getMonth()].slice(0, 3).toLowerCase()
  return `Semana ${lunes.getDate()}–${viernes.getDate()} ${mes}`
}

function agruparPorSemana(actas) {
  const grupos = {}
  actas.forEach(acta => {
    const key = semanaKey(acta.fecha || acta.fecha_creacion || '')
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(acta)
  })
  return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
}

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
  const [gruposAbiertos, setGruposAbiertos] = useState([])

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
      const actasFiltradas = ac.filter(a => a.id !== 'eliminado').sort((a,b) => {
        const fa = a.fecha_modificacion || a.fecha_creacion || ''
        const fb = b.fecha_modificacion || b.fecha_creacion || ''
        return fb > fa ? 1 : -1
      })
      setActas(actasFiltradas)
      // Abrir el grupo del mes más reciente por defecto
      const grupos = agruparPorMes(actasFiltradas)
      if (grupos.length > 0) setGruposAbiertos([grupos[0][0]])
      setTodosEventos(ev.filter(e => e.id !== 'eliminado'))
      const activas = [
        ...t.filter(x => x.id !== 'eliminado' && x.estado !== 'completada' && x.estado !== 'completado').map(x => ({ id: x.id, nombre: x.nombre, origen: 'Proyectos', asignados: x.asignados || '' })),
        ...ts.filter(x => x.id !== 'eliminado' && x.estado !== 'completada' && x.estado !== 'completado').map(x => ({ id: x.id, nombre: x.nombre, origen: 'Soporte', asignados: x.asignados || '' })),
        ...td.filter(x => x.id !== 'eliminado' && x.estado !== 'completada' && x.estado !== 'completado').map(x => ({ id: x.id, nombre: x.nombre, origen: 'Dirección', asignados: x.asignados || '' })),
      ].sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'))
      setTareasActivas(activas)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function crearActa(evento) {
    const existente = actas.find(a => a.evento_id === evento.id)
    if (existente) { abrirActa(existente); return }
    const participantes = evento.usuario_id ? evento.usuario_id.split(',').map(id => NOMBRES[id.trim()] || id).join(', ') : ''
    setActaActual({
      id: Date.now().toString(),
      evento_id: evento.id,
      fecha: evento.fecha_exacta || new Date().toISOString().split('T')[0],
      participantes,
      agenda: '',
      fecha_creacion: new Date().toISOString(),
      fecha_modificacion: '',
      _evento: evento,
      _nueva: true,
      _secciones: [{ id: Date.now().toString(), titulo: '', tareas: [{ id: (Date.now()+1).toString(), texto: '', asignados: [] }] }]
    })
    setVista('editar')
  }

  function abrirActa(acta) {
    const evento = todosEventos.find(e => e.id === acta.evento_id) || eventos.find(e => e.id === acta.evento_id) || null
    let secciones
    try {
      const parsed = JSON.parse(acta.acuerdos)
      // Compatibilidad hacia atrás: si una sección tiene contenido pero no tareas, convertir
      secciones = parsed.map(s => ({
        ...s,
        tareas: s.tareas || [{ id: Date.now().toString() + Math.random(), texto: s.contenido || '', asignados: [] }]
      }))
    } catch {
      secciones = [{ id: Date.now().toString(), titulo: acta.acuerdos || '', tareas: [{ id: (Date.now()+1).toString(), texto: '', asignados: [] }] }]
    }
    setActaActual({ ...acta, _evento: evento, _secciones: secciones })
    setVista('editar')
  }

  async function guardarActa() {
    if (!actaActual) return
    setGuardando(true)
    try {
      const secciones = actaActual._secciones || []
      const acuerdosStr = JSON.stringify(secciones)
      const ahora = new Date().toISOString()
      const existe = actas.find(a => a.id === actaActual.id)
      const fechaMod = existe ? ahora : ''
      const fila = [actaActual.id, actaActual.evento_id || '', actaActual.fecha, actaActual.participantes, actaActual.agenda || '', acuerdosStr, actaActual.fecha_creacion || ahora, fechaMod]
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
      ${secciones.map((s,i)=>{
        const tareas = s.tareas || (s.contenido ? [{texto: s.contenido, asignados:[]}] : [])
        const tareasHtml = tareas.map(t => {
          const asignadosIds = t.asignados || []
          const pillsHtml = asignadosIds.map(id => `<span style="color:${COLORES_USUARIO[id]||'#6b7280'};font-size:11px;font-weight:700;background:${id==='1'?'#bbf7d0':id==='3'?'#fed7aa':'#fbcfe8'};padding:2px 7px;border-radius:20px;margin-left:5px">${NOMBRES[id]||id}</span>`).join('')
          const indentStyle = t.indent ? 'margin-left:18px;border-left:2px solid #86efac;padding-left:8px;' : ''
          return `<div style="${indentStyle}margin-top:4px;font-size:13px;line-height:1.6;display:flex;gap:8px;align-items:flex-start"><span style="color:#9ca3af;flex-shrink:0">•</span><span style="flex:1">${t.texto||'—'}${pillsHtml}</span></div>`
        }).join('')
        return `<div class="seccion">${s.titulo?`<h4>${i+1}. ${s.titulo}</h4>`:`<h4>Punto ${i+1}</h4>`}${tareasHtml||'<p>—</p>'}</div>`
      }).join('')}
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
    const t = Date.now()
    const secciones = [...(actaActual._secciones || []), { id: t.toString(), titulo: '', tareas: [{ id: (t+1).toString(), texto: '', asignados: [] }] }]
    setActaActual({ ...actaActual, _secciones: secciones })
  }

  function removeSeccion(idx) {
    const t = Date.now()
    const secciones = (actaActual._secciones || []).filter((_, i) => i !== idx)
    setActaActual({ ...actaActual, _secciones: secciones.length > 0 ? secciones : [{ id: t.toString(), titulo: '', tareas: [{ id: (t+1).toString(), texto: '', asignados: [] }] }] })
  }

  function addTarea(secIdx) {
    const secciones = [...(actaActual._secciones || [])]
    const sec = { ...secciones[secIdx] }
    sec.tareas = [...(sec.tareas || []), { id: Date.now().toString(), texto: '', asignados: [] }]
    secciones[secIdx] = sec
    setActaActual({ ...actaActual, _secciones: secciones })
  }

  function updateTarea(secIdx, tareaIdx, campo, valor) {
    const secciones = [...(actaActual._secciones || [])]
    const sec = { ...secciones[secIdx] }
    const tareas = [...(sec.tareas || [])]
    tareas[tareaIdx] = { ...tareas[tareaIdx], [campo]: valor }
    sec.tareas = tareas
    secciones[secIdx] = sec
    setActaActual({ ...actaActual, _secciones: secciones })
  }

  function removeTarea(secIdx, tareaIdx) {
    const secciones = [...(actaActual._secciones || [])]
    const sec = { ...secciones[secIdx] }
    const tareas = (sec.tareas || []).filter((_, i) => i !== tareaIdx)
    sec.tareas = tareas.length > 0 ? tareas : [{ id: Date.now().toString(), texto: '', asignados: [] }]
    secciones[secIdx] = sec
    setActaActual({ ...actaActual, _secciones: secciones })
  }

  function toggleGrupo(key) {
    setGruposAbiertos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  if (vista === 'editar' && actaActual) {
    const secciones = actaActual._secciones || [{ id: '1', titulo: '', tareas: [{ id: '2', texto: '', asignados: [] }] }]
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
                <SeccionActa key={s.id} seccion={s} idx={idx}
                  onUpdate={(campo, valor) => updateSeccion(idx, campo, valor)}
                  onRemove={secciones.length > 1 ? () => removeSeccion(idx) : null}
                  onAddTarea={() => addTarea(idx)}
                  onUpdateTarea={(ti, campo, valor) => updateTarea(idx, ti, campo, valor)}
                  onRemoveTarea={(ti) => removeTarea(idx, ti)}
                />
              ))}
            </div>
            {/* Botón añadir al final para no tener que subir */}
            <button onClick={addSeccion} style={{ marginTop: '12px', width: '100%', padding: '10px', borderRadius: '8px', border: '2px dashed #d1fae5', background: '#f0fdf4', color: '#00953B', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>+ Añadir punto al final</button>
          </div>
        </div>

        {/* Botón guardar al final */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
          <button onClick={exportarPDF} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>📄 Exportar PDF</button>
          <button onClick={guardarActa} disabled={guardando} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>{guardando ? 'Guardando...' : '💾 Guardar'}</button>
        </div>
      </div>
    )
  }

  const gruposMes = agruparPorMes(actas)
  const mesCurso = new Date().toISOString().slice(0, 7)

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
          {gruposMes.map(([key, actasGrupo]) => {
            const abierto = gruposAbiertos.includes(key)
            const esMesCurso = key === mesCurso
            const semanas = esMesCurso ? agruparPorSemana(actasGrupo) : null
            return (
              <div key={key} style={{ marginBottom: '10px' }}>
                <button
                  onClick={() => toggleGrupo(key)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: abierto ? '#f0fdf4' : '#f9fafb', border: '1px solid', borderColor: abierto ? '#86efac' : '#e5e7eb', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: abierto ? '#166534' : '#6b7280' }}>
                  <span>{formatMes(key)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: abierto ? '#dcfce7' : '#f3f4f6', color: abierto ? '#166534' : '#6b7280', borderRadius: '20px', padding: '1px 8px', fontSize: '12px' }}>{actasGrupo.length}</span>
                    <span style={{ fontSize: '12px' }}>{abierto ? '▲' : '▼'}</span>
                  </span>
                </button>
                {abierto && (
                  <div style={{ marginTop: '6px' }}>
                    {esMesCurso ? (
                      // Mes actual: agrupado por semanas
                      semanas.map(([semKey, actasSem]) => (
                        <div key={semKey} style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 4px 4px 8px', borderLeft: '2px solid #d1fae5' }}>
                            {semanaLabel(actasSem[0].fecha || actasSem[0].fecha_creacion || semKey)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                            {actasSem.map(acta => <TarjetaActa key={acta.id} acta={acta} todosEventos={todosEventos} eventos={eventos} onAbrir={abrirActa} onEliminar={async () => { await actualizarFila('actas', acta.id, ['eliminado', acta.evento_id||'', acta.fecha, acta.participantes, acta.agenda||'', acta.acuerdos||'', acta.fecha_creacion||'', acta.fecha_modificacion||''], accessToken); cargarDatos() }} />)}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Meses anteriores: lista plana
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {actasGrupo.map(acta => <TarjetaActa key={acta.id} acta={acta} todosEventos={todosEventos} eventos={eventos} onAbrir={abrirActa} onEliminar={async () => { await actualizarFila('actas', acta.id, ['eliminado', acta.evento_id||'', acta.fecha, acta.participantes, acta.agenda||'', acta.acuerdos||'', acta.fecha_creacion||'', acta.fecha_modificacion||''], accessToken); cargarDatos() }} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TarjetaActa({ acta, todosEventos, eventos, onAbrir, onEliminar }) {
  return (
    <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #00953B', cursor: 'pointer', position: 'relative' }}
      onClick={() => onAbrir(acta)} onMouseOver={e => e.currentTarget.style.background='#f0fdf4'} onMouseOut={e => e.currentTarget.style.background='white'}>
      <button onClick={async e => { e.stopPropagation(); if(confirm('¿Eliminar esta acta?')) onEliminar() }}
        style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '14px', opacity: 0.4 }}
        onMouseOver={e=>e.target.style.opacity='1'} onMouseOut={e=>e.target.style.opacity='0.4'}>🗑</button>
      <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '14px' }}>{acta.fecha ? acta.fecha.split('-').reverse().join('/') : '—'} — {todosEventos.find(e => e.id === acta.evento_id)?.titulo || eventos.find(e => e.id === acta.evento_id)?.titulo || 'Reunión'}</p>
      <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{acta.participantes}</p>
      {acta.fecha_modificacion && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>Actualizado: {acta.fecha_modificacion.slice(0,10)}</p>}
    </div>
  )
}

// Pills de asignación — L=Lorenzo(1), J=Jannet(3), A=Ahlam(2)
const PILLS = [
  { id: '1', label: 'L', nombre: 'Lorenzo', color: '#00953B', bg: '#f0fdf4', textColor: '#166534' },
  { id: '3', label: 'J', nombre: 'Jannet',  color: '#f97316', bg: '#fff7ed', textColor: '#9a3412' },
  { id: '2', label: 'A', nombre: 'Ahlam',   color: '#ec4899', bg: '#fdf2f8', textColor: '#831843' },
]

function SeccionActa({ seccion, idx, onUpdate, onRemove, onAddTarea, onUpdateTarea, onRemoveTarea }) {
  const tareas = seccion.tareas || [{ id: '1', texto: '', asignados: [] }]

  function toggleAsignado(tareaIdx, userId) {
    const tarea = tareas[tareaIdx]
    const asignados = tarea.asignados || []
    const nuevo = asignados.includes(userId)
      ? asignados.filter(id => id !== userId)
      : [...asignados, userId]
    onUpdateTarea(tareaIdx, 'asignados', nuevo)
  }

  return (
    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb' }}>
      {/* Cabecera del punto */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: '#00953B' }}>Punto {idx + 1}</span>
        {onRemove && <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '14px', lineHeight: 1 }}>✕</button>}
      </div>

      {/* Título del punto */}
      <input
        placeholder="Nombre del punto (ej: SE26-055 · SVTIC)"
        value={seccion.titulo}
        onChange={e => onUpdate('titulo', e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', fontWeight: '600', marginBottom: '10px', boxSizing: 'border-box' }}
      />

      {/* Lista de tareas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
        {tareas.map((tarea, ti) => {
          const asignados = tarea.asignados || []
          const indent = tarea.indent || false
          return (
            <div key={tarea.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', paddingLeft: indent ? '20px' : '0', borderLeft: indent ? '2px solid #d1fae5' : 'none', marginLeft: indent ? '4px' : '0' }}>
              {/* Botón indent */}
              <button
                title={indent ? 'Quitar sangría' : 'Marcar como sub-tarea'}
                onClick={() => onUpdateTarea(ti, 'indent', !indent)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: indent ? '#00953B' : '#d1d5db', fontSize: '13px', padding: '7px 2px', flexShrink: 0, lineHeight: 1 }}
              >↳</button>
              {/* Textarea auto-expandible */}
              <textarea
                placeholder={`Tarea ${ti + 1}...`}
                value={tarea.texto}
                onChange={e => onUpdateTarea(ti, 'texto', e.target.value)}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                rows={1}
                style={{ flex: 1, padding: '7px 9px', borderRadius: '7px', border: '1px solid #e5e7eb', fontSize: '13px', background: 'white', minWidth: 0, boxSizing: 'border-box', resize: 'none', overflow: 'hidden', fontFamily: 'inherit', lineHeight: '1.6', minHeight: '36px' }}
              />
              {/* Pills L / J / A */}
              <div style={{ display: 'flex', gap: '4px', paddingTop: '5px', flexShrink: 0 }}>
                {PILLS.map(p => {
                  const activo = asignados.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      title={p.nombre}
                      onClick={() => toggleAsignado(ti, p.id)}
                      style={{
                        padding: '4px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                        cursor: 'pointer', flexShrink: 0, border: `1.5px solid`,
                        borderColor: activo ? p.color : '#d1d5db',
                        background: activo ? p.bg : '#f9fafb',
                        color: activo ? p.textColor : '#9ca3af',
                        transition: 'all 0.12s',
                      }}
                    >{p.label}</button>
                  )
                })}
              </div>
              {/* Botón eliminar fila */}
              {tareas.length > 1 && (
                <button onClick={() => onRemoveTarea(ti)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '13px', padding: '7px 2px', flexShrink: 0, opacity: 0.5, lineHeight: 1 }}
                  onMouseOver={e=>e.target.style.opacity='1'} onMouseOut={e=>e.target.style.opacity='0.5'}>✕</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Añadir tarea */}
      <button
        onClick={onAddTarea}
        style={{ width: '100%', padding: '7px', borderRadius: '7px', border: '1.5px dashed #d1fae5', background: 'none', color: '#00953B', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
        onMouseOver={e=>{e.target.style.borderColor='#00953B';e.target.style.background='#f0fdf4'}}
        onMouseOut={e=>{e.target.style.borderColor='#d1fae5';e.target.style.background='none'}}
      >+ añadir tarea</button>
    </div>
  )
}
