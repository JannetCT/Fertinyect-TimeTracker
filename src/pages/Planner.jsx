import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado, eliminarTareasPlanner } from '../services/googleSheets'

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' }
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_CORTOS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const HORA_INICIO = 7
const HORA_FIN = 21
const ALTURA_HORA = 64

const USUARIOS_EQUIPO = [
  { id: '1', nombre: 'Lorenzo' },
  { id: '2', nombre: 'Ahlam' },
  { id: '3', nombre: 'Jannet' },
]

function formatTiempo(s) {
  return `${Math.floor(s/3600).toString().padStart(2,'00')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
}

function getLunesDeSemana(fecha) {
  const d = new Date(fecha)
  d.setHours(12, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function getISODate(fecha) { return fecha.toISOString().split('T')[0] }

function getDiaSemana(fechaStr) {
  if (!fechaStr) return null
  const d = new Date(fechaStr + 'T12:00:00')
  return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()]
}

const PRIORIDADES = {
  urgente: { bg: '#fee2e2', color: '#dc2626', emoji: '🔴' },
  importante: { bg: '#fef3c7', color: '#92400e', emoji: '🟡' },
  delegar: { bg: '#dbeafe', color: '#1d4ed8', emoji: '🔵' },
}

function toggleEtiqueta(etiquetaActual, key) {
  const lista = etiquetaActual ? etiquetaActual.split(',').filter(e => e.trim() !== '') : []
  const idx = lista.indexOf(key)
  if (idx >= 0) lista.splice(idx, 1)
  else lista.push(key)
  return lista.join(',')
}

function getColorTipo(tipo) {
  if (tipo === 'soporte') return { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' }
  if (tipo === 'direccion') return { bg: '#f5f3ff', border: '#7c3aed', text: '#7c3aed' }
  if (tipo === 'planner') return { bg: '#f5f3ff', border: '#8b5cf6', text: '#7c3aed' }
  return { bg: '#f0fdf4', border: '#00953B', text: '#00953B' }
}

function EtiquetasBadge({ etiqueta }) {
  if (!etiqueta) return null
  const lista = etiqueta.split(',').filter(e => e.trim() !== '')
  return (
    <>
      {lista.map((et, i) => {
        const p = PRIORIDADES[et.toLowerCase().trim()]
        return p
          ? <span key={i} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '20px', background: p.bg, color: p.color, fontWeight: '600' }}>{p.emoji} {et}</span>
          : <span key={i} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '20px', background: '#f3f4f6', color: '#6b7280' }}>🏷 {et}</span>
      })}
    </>
  )
}

function BotonesPrioridad({ etiqueta, onChange }) {
  const lista = etiqueta ? etiqueta.split(',').filter(e => e.trim() !== '') : []
  const predefinidas = Object.keys(PRIORIDADES)
  const personalizadas = lista.filter(e => !predefinidas.includes(e.toLowerCase().trim()))
  const [inputCustom, setInputCustom] = useState('')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {Object.entries(PRIORIDADES).map(([key, val]) => {
          const activa = lista.includes(key)
          return (
            <button key={key} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange(toggleEtiqueta(etiqueta, key)) }}
              style={{ padding: '6px 12px', borderRadius: '20px', border: '2px solid', borderColor: activa ? val.color : '#e5e7eb', background: activa ? val.bg : 'white', color: activa ? val.color : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
              {val.emoji} {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          )
        })}
      </div>
      {personalizadas.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {personalizadas.map((et, i) => (
            <span key={i} onClick={() => onChange(toggleEtiqueta(etiqueta, et))}
              style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer', border: '1px solid #e5e7eb' }}>
              🏷 {et} ✕
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input placeholder="Etiqueta personalizada..." value={inputCustom} onChange={e => setInputCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && inputCustom.trim()) { onChange(toggleEtiqueta(etiqueta, inputCustom.trim())); setInputCustom('') }}}
          style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }} />
        <button onClick={() => { if (inputCustom.trim()) { onChange(toggleEtiqueta(etiqueta, inputCustom.trim())); setInputCustom('') }}}
          style={{ padding: '6px 12px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
          + Añadir
        </button>
      </div>
    </div>
  )
}

function InputFechaPlanner({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
        {value && (
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); onChange('') }}
            style={{ padding: '10px 12px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>✕</button>
        )}
      </div>
    </div>
  )
}

function InputFechasMultiples({ label, value, onChange }) {
  const [inputFecha, setInputFecha] = useState('')
  const fechas = value ? value.split(',').map(f => f.trim()).filter(Boolean) : []
  function agregarFecha() {
    if (!inputFecha || fechas.includes(inputFecha)) return
    onChange([...fechas, inputFecha].sort().join(',')); setInputFecha('')
  }
  function quitarFecha(f) { onChange(fechas.filter(x => x !== f).join(',')) }
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>{label}</label>
      {fechas.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {fechas.map(f => (
            <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', border: '1px solid #00953B', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: '#00953B', fontWeight: '600' }}>
              📅 {f}
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); quitarFecha(f) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '13px', fontWeight: '700', padding: '0', lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input type="date" value={inputFecha} onChange={e => setInputFecha(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); agregarFecha() }}
          style={{ padding: '10px 14px', borderRadius: '8px', background: '#00953B', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>+</button>
      </div>
    </div>
  )
}

function SelectorPersonasEvento({ seleccionados, onChange, misId }) {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Asignar a:</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {USUARIOS_EQUIPO.map(u => {
          const activo = seleccionados.includes(u.id)
          return (
            <button key={u.id}
              onClick={e => { e.stopPropagation(); e.preventDefault(); const nuevo = activo ? seleccionados.filter(id => id !== u.id) : [...seleccionados, u.id]; onChange(nuevo) }}
              style={{ padding: '6px 14px', borderRadius: '20px', border: '2px solid', borderColor: activo ? '#7c3aed' : '#e5e7eb', background: activo ? '#f5f3ff' : 'white', color: activo ? '#7c3aed' : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              {u.nombre}{u.id === misId ? ' (yo)' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SelectorTiempoEstimado({ horas, minutos, onChangeHoras, onChangeMinutos }) {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Tiempo estimado (opcional):</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="number" min="0" max="24" value={horas} onChange={e => onChangeHoras(Math.max(0, parseInt(e.target.value) || 0))}
            style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', textAlign: 'center' }} />
          <span style={{ fontSize: '13px', color: '#555' }}>h</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="number" min="0" max="59" value={minutos} onChange={e => onChangeMinutos(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
            style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', textAlign: 'center' }} />
          <span style={{ fontSize: '13px', color: '#555' }}>min</span>
        </div>
      </div>
    </div>
  )
}

function formatMinutos(minutos) {
  if (!minutos || minutos === 0) return ''
  const h = Math.floor(minutos / 60), m = minutos % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function SeccionChecklist({ tareaId, tipoTarea, accessToken }) {
  const [items, setItems] = useState([])
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  useEffect(() => { cargarItems() }, [tareaId])
  async function cargarItems() {
    try {
      const todos = await leerHoja('checklist_items', accessToken)
      setItems(todos.filter(i => i.tarea_id === tareaId && i.tipo_tarea === tipoTarea).sort((a, b) => Number(a.orden) - Number(b.orden)))
    } catch (err) { console.error(err) }
  }
  async function añadirItem() {
    if (!nuevoTexto.trim()) return
    setCargando(true)
    await escribirFila('checklist_items', [Date.now().toString(), tareaId, tipoTarea, nuevoTexto.trim(), 'false', items.length + 1], accessToken)
    setNuevoTexto(''); await cargarItems(); setCargando(false)
  }
  async function toggleItem(item) {
    await actualizarFila('checklist_items', item.id, [item.id, item.tarea_id, item.tipo_tarea, item.texto, item.completado === 'true' ? 'false' : 'true', item.orden], accessToken)
    await cargarItems()
  }
  async function eliminarItem(itemId) { await marcarEliminado('checklist_items', itemId, accessToken); await cargarItems() }
  const completados = items.filter(i => i.completado === 'true').length
  const total = items.length
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Lista de comprobación</label>
        {total > 0 && <span style={{ fontSize: '12px', color: completados === total ? '#166534' : '#6b7280', background: completados === total ? '#dcfce7' : '#f3f4f6', borderRadius: '20px', padding: '2px 8px', fontWeight: '600' }}>{completados} / {total}</span>}
      </div>
      {total > 0 && <div style={{ marginBottom: '8px', height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(completados / total) * 100}%`, background: '#00953B', borderRadius: '2px', transition: 'width 0.3s' }} /></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #f3f4f6' }}>
            <button onClick={() => toggleItem(item)} style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${item.completado === 'true' ? '#00953B' : '#d1d5db'}`, background: item.completado === 'true' ? '#00953B' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
              {item.completado === 'true' && <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>✓</span>}
            </button>
            <span style={{ flex: 1, fontSize: '13px', color: item.completado === 'true' ? '#9ca3af' : '#373A36', textDecoration: item.completado === 'true' ? 'line-through' : 'none' }}>{item.texto}</span>
            <button onClick={() => eliminarItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '14px', padding: '0 2px', lineHeight: 1 }} onMouseOver={e => e.target.style.color = '#dc2626'} onMouseOut={e => e.target.style.color = '#d1d5db'}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <input placeholder="+ Añadir ítem..." value={nuevoTexto} onChange={e => setNuevoTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && nuevoTexto.trim()) añadirItem() }} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }} />
        <button onClick={añadirItem} disabled={cargando || !nuevoTexto.trim()} style={{ padding: '8px 14px', borderRadius: '8px', background: nuevoTexto.trim() ? '#00953B' : '#f3f4f6', color: nuevoTexto.trim() ? 'white' : '#9ca3af', border: 'none', cursor: nuevoTexto.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: '600' }}>{cargando ? '...' : '+ Añadir'}</button>
      </div>
    </div>
  )
}

function SeccionActualizaciones({ tareaId, tipoTarea, usuario, accessToken }) {
  const [actualizaciones, setActualizaciones] = useState([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [textoEdit, setTextoEdit] = useState('')
  useEffect(() => { cargarActualizaciones() }, [tareaId])
  async function cargarActualizaciones() {
    try {
      const todas = await leerHoja('actualizaciones', accessToken)
      setActualizaciones(todas.filter(a => a.tarea_id === tareaId).sort((a, b) => a.fecha_creacion > b.fecha_creacion ? -1 : 1))
    } catch (err) { console.error(err) }
  }
  async function añadirActualizacion() {
    if (!texto.trim()) return; setCargando(true)
    await escribirFila('actualizaciones', [Date.now().toString(), tareaId, tipoTarea, usuario.id, texto.trim(), new Date().toISOString()], accessToken)
    setTexto(''); await cargarActualizaciones(); setCargando(false)
  }
  async function guardarEdicion(id) {
    if (!textoEdit.trim()) return
    const act = actualizaciones.find(a => a.id === id); if (!act) return
    await actualizarFila('actualizaciones', id, [id, act.tarea_id, act.tipo_tarea, act.usuario_id, textoEdit.trim(), act.fecha_creacion], accessToken)
    setEditandoId(null); await cargarActualizaciones()
  }
  async function eliminarActualizacion(id) { await marcarEliminado('actualizaciones', id, accessToken); await cargarActualizaciones() }
  return (
    <div style={{ marginTop: '16px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Actualizaciones:</label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input placeholder="Escribe una actualización..." value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && texto.trim()) añadirActualizacion() }} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }} />
        <button onClick={añadirActualizacion} disabled={cargando} style={{ padding: '8px 14px', borderRadius: '8px', background: '#00953B', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{cargando ? '...' : '+ Añadir'}</button>
      </div>
      {actualizaciones.length === 0 ? <p style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Sin actualizaciones aún</p>
        : actualizaciones.map(a => (
          <div key={a.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px', borderLeft: '3px solid #00953B' }}>
            {editandoId === a.id ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={textoEdit} onChange={e => setTextoEdit(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }} />
                <button onClick={() => guardarEdicion(a.id)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#00953B', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                <button onClick={() => setEditandoId(null)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#f3f4f6', color: '#6b7280', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#373A36', flex: 1 }}>{a.texto}</p>
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                    <button onClick={() => { setEditandoId(a.id); setTextoEdit(a.texto) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>✏️</button>
                    <button onClick={() => eliminarActualizacion(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>🗑</button>
                  </div>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>{a.usuario_id} · {new Date(a.fecha_creacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </>
            )}
          </div>
        ))
      }
    </div>
  )
}

const CRON_KEY = 'fertinyect_cron'
function saveCron(cron) { if (cron) localStorage.setItem(CRON_KEY, JSON.stringify(cron)); else localStorage.removeItem(CRON_KEY) }
function loadCron() { try { const s = localStorage.getItem(CRON_KEY); return s ? JSON.parse(s) : null } catch { return null } }

function getRefId(tarea) { return tarea.tarea_padre_id || tarea.id }
function getRefTipo(tarea) {
  if (tarea._tipo && tarea._tipo !== 'planner') return tarea._tipo
  if (!tarea.tarea_padre_tipo) return 'planner'
  if (tarea.tarea_padre_tipo.startsWith('proyecto')) return 'proyecto'
  if (tarea.tarea_padre_tipo.startsWith('soporte')) return 'soporte'
  if (tarea.tarea_padre_tipo.startsWith('direccion')) return 'direccion'
  return 'planner'
}
function getRefHoja(tarea) {
  const tipo = getRefTipo(tarea)
  if (tipo === 'proyecto') return 'tareas'
  if (tipo === 'soporte') return 'tareas_soporte'
  if (tipo === 'direccion') return 'tareas_direccion'
  return 'tareas_planner'
}

function VistaDia({ fecha, tareasConPosicion, tareasTodoDia, eventosDia, cronActivo, tiempoActual, onVerDetalle, onEditarTarea, onIniciarCron, onPausarCron, onReanudarCron, onCompletarCron, onEditarEvento, onCompletarEvento, getChecklistCount }) {
  const horaActualRef = useRef(null)
  const [ahora, setAhora] = useState(new Date())
  useEffect(() => { setAhora(new Date()); const t = setInterval(() => setAhora(new Date()), 60000); return () => clearInterval(t) }, [])
  useEffect(() => { if (horaActualRef.current) horaActualRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [])
  const hoy = getISODate(new Date())
  const esHoy = fecha === hoy
  const horaActualDec = ahora.getHours() + ahora.getMinutes() / 60
  const posLinea = (horaActualDec - HORA_INICIO) * ALTURA_HORA
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)
  function horaADec(h) { if (!h) return null; const [hh, mm] = h.split(':').map(Number); return hh + mm / 60 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {tareasTodoDia.length > 0 && (
        <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '8px 12px 8px 60px', flexShrink: 0 }}>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Todo el día</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {tareasTodoDia.map(t => {
              const col = getColorTipo(t._tipo)
              const activa = cronActivo?.tareaId === t.id
              return (
                <div key={t.id} onClick={() => onVerDetalle(t)} style={{ background: activa ? '#f0fdf4' : col.bg, border: `2px solid ${activa ? '#00953B' : col.border}`, borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', maxWidth: '220px' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: activa ? '#00953B' : col.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activa ? '⏱ ' : ''}{t.nombre}</p>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    {!activa && <button onClick={e => { e.stopPropagation(); onIniciarCron(t) }} style={{ background: col.border, color: 'white', border: 'none', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', fontSize: '10px' }}>▶</button>}
                    {activa && !cronActivo?.inicio && <button onClick={e => { e.stopPropagation(); onReanudarCron() }} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', fontSize: '10px' }}>▶</button>}
                    {activa && cronActivo?.inicio && <button onClick={e => { e.stopPropagation(); onPausarCron() }} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', fontSize: '10px' }}>⏸</button>}
                    {activa && <button onClick={e => { e.stopPropagation(); onCompletarCron() }} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', fontSize: '10px' }}>✅</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ overflowY: 'auto', flex: 1, position: 'relative' }}>
        <div style={{ position: 'relative', minHeight: `${(HORA_FIN - HORA_INICIO + 1) * ALTURA_HORA}px` }}>
          {horas.map(h => (
            <div key={h} style={{ position: 'absolute', top: `${(h - HORA_INICIO) * ALTURA_HORA}px`, left: 0, right: 0, height: `${ALTURA_HORA}px`, borderTop: h === HORA_INICIO ? 'none' : '1px solid #f0f0f0', display: 'flex' }}>
              <div style={{ width: '52px', flexShrink: 0, paddingRight: '8px', paddingTop: '4px', textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>{h.toString().padStart(2,'0')}:00</span>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid #e5e7eb', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#f8f8f8' }} />
              </div>
            </div>
          ))}
          {esHoy && horaActualDec >= HORA_INICIO && horaActualDec <= HORA_FIN && (
            <div ref={horaActualRef} style={{ position: 'absolute', left: '52px', right: 0, top: `${posLinea}px`, zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', marginLeft: '-5px', flexShrink: 0 }} />
              <div style={{ flex: 1, height: '2px', background: '#ef4444', opacity: 0.8 }} />
            </div>
          )}
          {eventosDia.filter(ev => ev.hora_inicio && ev.hora_fin).map(ev => {
            const ini = horaADec(ev.hora_inicio), fin = horaADec(ev.hora_fin)
            if (!ini || !fin) return null
            const top = (ini - HORA_INICIO) * ALTURA_HORA
            const height = Math.max((fin - ini) * ALTURA_HORA, 28)
            const completado = ev.estado === 'completado'
            return (
              <div key={ev.id} onClick={() => onEditarEvento(ev)} style={{ position: 'absolute', left: '60px', right: '8px', top: `${top}px`, height: `${height}px`, background: completado ? '#ede9fe' : '#f5f3ff', border: `2px solid ${completado ? '#a78bfa' : '#7c3aed'}`, borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', overflow: 'hidden', zIndex: 5, opacity: completado ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#7c3aed', textDecoration: completado ? 'line-through' : 'none', flex: 1 }}>🗓 {ev.titulo}</p>
                  {!completado && <button onClick={e => { e.stopPropagation(); onCompletarEvento(ev) }} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', padding: '1px 5px', cursor: 'pointer', fontSize: '10px', flexShrink: 0 }}>✅</button>}
                </div>
                {height > 32 && <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#a78bfa' }}>{ev.hora_inicio} — {ev.hora_fin}</p>}
              </div>
            )
          })}
          {tareasConPosicion.map(tarea => {
            const col = getColorTipo(tarea._tipo)
            const activa = cronActivo?.tareaId === tarea.id
            const pausada = activa && !cronActivo?.inicio
            const refId = tarea._tipo === 'planner' ? getRefId(tarea) : tarea.id
            const refTipo = tarea._tipo === 'planner' ? getRefTipo(tarea) : tarea._tipo
            const clCount = getChecklistCount(refId, refTipo)
            return (
              <div key={tarea.id} style={{ position: 'absolute', left: '60px', right: '8px', top: `${tarea._top}px`, height: `${Math.max(tarea._height, 40)}px`, background: activa ? '#f0fdf4' : col.bg, border: `2px solid ${activa ? '#00953B' : col.border}`, borderRadius: '8px', padding: '5px 8px', overflow: 'hidden', zIndex: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p onClick={() => onVerDetalle(tarea)} style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: activa ? '#00953B' : col.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{activa ? '⏱ ' : ''}{tarea.nombre}</p>
                  <div style={{ display: 'flex', gap: '2px', marginLeft: '4px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); onEditarTarea(tarea) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '0 1px' }}>✏️</button>
                    {!activa && <button onClick={e => { e.stopPropagation(); onIniciarCron(tarea) }} style={{ background: col.border, color: 'white', border: 'none', borderRadius: '3px', padding: '1px 5px', cursor: 'pointer', fontSize: '10px' }}>▶</button>}
                    {activa && !pausada && <button onClick={e => { e.stopPropagation(); onPausarCron() }} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '3px', padding: '1px 5px', cursor: 'pointer', fontSize: '10px' }}>⏸</button>}
                    {pausada && <button onClick={e => { e.stopPropagation(); onReanudarCron() }} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '3px', padding: '1px 5px', cursor: 'pointer', fontSize: '10px' }}>▶</button>}
                    {(activa || pausada) && <button onClick={e => { e.stopPropagation(); onCompletarCron() }} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '3px', padding: '1px 5px', cursor: 'pointer', fontSize: '10px' }}>✅</button>}
                  </div>
                </div>
                {tarea._height > 38 && <p style={{ margin: '2px 0 0', fontSize: '10px', color: col.text, opacity: 0.8 }}>⏳ {formatMinutos(parseInt(tarea.tiempo_estimado))}</p>}
                {clCount.total > 0 && tarea._height > 50 && <span style={{ fontSize: '10px', color: clCount.completados === clCount.total ? '#166534' : '#6b7280', background: 'rgba(255,255,255,0.7)', padding: '1px 4px', borderRadius: '3px' }}>☑️ {clCount.completados}/{clCount.total}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Planner() {
  const { usuario, accessToken } = useAuth()
  const [semanaBase, setSemanaBase] = useState(() => getLunesDeSemana(new Date()))
  const [vista, setVista] = useState('semana')
  const [mesBase, setMesBase] = useState(() => new Date())
  const [diaBase, setDiaBase] = useState(() => getISODate(new Date()))
  const [tareas, setTareas] = useState([])
  const [tareasSoporte, setTareasSoporte] = useState([])
  const [tareasDireccion, setTareasDireccion] = useState([])
  const [tareasPlanner, setTareasPlanner] = useState([])
  const [eventos, setEventos] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [estadosProyecto, setEstadosProyecto] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [categoriasSoporte, setCategoriasSoporte] = useState([])
  const [categoriasDireccion, setCategoriasDireccion] = useState([])
  const [proyectosSoporte, setProyectosSoporte] = useState([])
  const [subcarpetasSoporte, setSubcarpetasSoporte] = useState([])
  const [todasTareasProyecto, setTodasTareasProyecto] = useState([])
  const [todasTareasSoporte, setTodasTareasSoporte] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [checklistCounts, setChecklistCounts] = useState({})
  const [cargando, setCargando] = useState(true)
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false)
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')
  const [modalEditarTarea, setModalEditarTarea] = useState(null)
  const [vistaTarea, setVistaTarea] = useState(null)
  const [modalNuevaTarea, setModalNuevaTarea] = useState(false)
  const [modalNuevoEvento, setModalNuevoEvento] = useState(false)
  const [modalEditarEvento, setModalEditarEvento] = useState(null)
  const [formTarea, setFormTarea] = useState({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', fechas_exactas: '', fecha_limite: '', etiqueta: '', asignadoA: '', _horas: 0, _minutos: 0 })
  const [formEvento, setFormEvento] = useState({ titulo: '', descripcion: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion', _asignados: [], _tipoLigar: '', _origenId: '', _origenTipo: '', _opcionProyectoId: '', _opcionSoporteId: '', _opcionDireccionId: '' })
  const [cronActivo, setCronActivo] = useState(() => loadCron())
  const [tiempoActual, setTiempoActual] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => { if (accessToken && usuario) cargarDatos() }, [accessToken, usuario])
  useEffect(() => {
    if (cronActivo?.inicio) {
      setTiempoActual(cronActivo.acumulado + Math.floor((Date.now() - cronActivo.inicio) / 1000))
      intervalRef.current = setInterval(() => setTiempoActual(cronActivo.acumulado + Math.floor((Date.now() - cronActivo.inicio) / 1000)), 1000)
    } else { clearInterval(intervalRef.current); setTiempoActual(cronActivo ? cronActivo.acumulado : 0) }
    return () => clearInterval(intervalRef.current)
  }, [cronActivo])

  async function cargarDatos() {
    try {
      const [t, ts, td, tp, ev, p, ep, ac, en, cs, ps, ss, cl, us] = await Promise.all([
        leerHoja('tareas', accessToken), leerHoja('tareas_soporte', accessToken), leerHoja('tareas_direccion', accessToken),
        leerHoja('tareas_planner', accessToken), leerHoja('eventos', accessToken), leerHoja('proyectos', accessToken),
        leerHoja('estados_proyecto', accessToken), leerHoja('acciones', accessToken), leerHoja('ensayos', accessToken),
        leerHoja('categorias_soporte', accessToken), leerHoja('proyectos_soporte', accessToken), leerHoja('subcarpetas_soporte', accessToken),
        leerHoja('checklist_items', accessToken),
leerHoja('usuarios', accessToken),
      ])
      const misId = String(usuario.id)
      setTareas(t.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasSoporte(ts.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasDireccion(td.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasPlanner(tp.filter(t => String(t.usuario_id) === misId))
      setEventos(ev.filter(e => e.usuario_id && e.usuario_id.split(',').map(s => s.trim()).includes(misId)))
      setProyectos(p); setEstadosProyecto(ep); setAcciones(ac); setEnsayos(en)
      setCategoriasSoporte(cs); setProyectosSoporte(ps); setSubcarpetasSoporte(ss)
      setCategoriasDireccion(await leerHoja('categorias_direccion', accessToken))
      setTodasTareasProyecto(t); setTodasTareasSoporte(ts)
      const counts = {}
      cl.forEach(item => { const key = `${item.tarea_id}_${item.tipo_tarea}`; if (!counts[key]) counts[key] = { total: 0, completados: 0 }; counts[key].total++; if (item.completado === 'true') counts[key].completados++ })
      setChecklistCounts(counts)
      setUsuarios(us)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function getChecklistCount(tareaId, tipoTarea) { return checklistCounts[`${tareaId}_${tipoTarea}`] || { total: 0, completados: 0 } }

  async function iniciarCronometro(tarea) {
    if (cronActivo?.inicio) await _guardarTramo(cronActivo)
    if (cronActivo && cronActivo.tareaId === tarea.id && !cronActivo.inicio) { reanudarCronometro(); return }
    const nuevo = { tareaId: tarea.id, tipo: tarea._tipo, nombre: tarea.nombre, inicio: Date.now(), acumulado: 0 }
    setCronActivo(nuevo); saveCron(nuevo)
  }
  async function _guardarTramo(cron) {
    if (!cron?.inicio) return
    const elapsed = Math.floor((Date.now() - cron.inicio) / 1000)
    if (elapsed <= 0) return
    const fin = new Date().toISOString()
    const inicio = new Date(Date.now() - elapsed * 1000).toISOString()
    await escribirFila('registros', [Date.now().toString(), cron.tareaId, usuario.id, inicio, fin, elapsed, new Date().toDateString(), cron.tipo, cron.nombre], accessToken)
    const pausado = { ...cron, acumulado: cron.acumulado + elapsed, inicio: null }
    setCronActivo(pausado); saveCron(pausado)
  }
  async function pausarYGuardar() { if (!cronActivo?.inicio) return; await _guardarTramo(cronActivo) }
  function reanudarCronometro() { if (!cronActivo) return; const nuevo = { ...cronActivo, inicio: Date.now() }; setCronActivo(nuevo); saveCron(nuevo) }
  async function detenerCronometro(completar = false) {
    if (!cronActivo) return
    if (cronActivo.inicio) await _guardarTramo(cronActivo)
    if (completar) {
      const allTareas = [...tareas, ...tareasSoporte, ...tareasDireccion, ...tareasPlanner]
      const tarea = allTareas.find(t => t.id === cronActivo.tareaId)
      if (tarea) {
        if (cronActivo.tipo === 'planner') {
          await actualizarEstado(tarea, 'planner', 'completada')
        } else {
          await escribirFila('tareas_planner', [
            Date.now().toString(), String(usuario.id), tarea.id, cronActivo.tipo,
            tarea.nombre, tarea.dia_semana || 'por_asignar', tarea.fecha_exacta || '',
            tarea.fecha_limite || '', 'completada', new Date().toISOString(),
            tarea.etiqueta || '', '', '', '', tarea.tiempo_estimado || '', tarea.hora_inicio || '', String(usuario.id)
          ], accessToken)
        }
      }
    }
    setCronActivo(null); saveCron(null); setTiempoActual(0); cargarDatos()
  }
  async function completarEvento(evento) {
    if (!evento.hora_inicio || !evento.hora_fin) return
    const [hI, mI] = evento.hora_inicio.split(':').map(Number)
    const [hF, mF] = evento.hora_fin.split(':').map(Number)
    const duracionSegundos = ((hF * 60 + mF) - (hI * 60 + mI)) * 60
    if (duracionSegundos <= 0) return
    const fechaBase = evento.fecha_exacta + 'T' + evento.hora_inicio + ':00'
    const registroTareaId = evento.origen_id || evento.id
const registroTipo = evento.origen_tipo || 'evento'
await escribirFila('registros', [Date.now().toString(), registroTareaId, usuario.id, new Date(fechaBase).toISOString(), new Date(new Date(fechaBase).getTime() + duracionSegundos * 1000).toISOString(), duracionSegundos, new Date().toDateString(), registroTipo, evento.titulo], accessToken)
    await actualizarFila('eventos', evento.id, [evento.id, evento.usuario_id, evento.titulo, evento.descripcion || '', evento.fecha_exacta, evento.hora_inicio, evento.hora_fin, evento.tipo, evento.fecha_creacion, 'completado'], accessToken)
    cargarDatos()
  }
  async function actualizarEstado(tarea, tipo, estado) {
    if (tipo === 'proyecto') await actualizarFila('tareas', tarea.id, [tarea.id, tarea.ensayo_id, tarea.accion_id, tarea.proyecto_id, tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    else if (tipo === 'soporte') await actualizarFila('tareas_soporte', tarea.id, [tarea.id, tarea.categoria_id, tarea.proyecto_soporte_id || '', tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    else if (tipo === 'direccion') await actualizarFila('tareas_direccion', tarea.id, [tarea.id, tarea.categoria_id, tarea.proyecto_direccion_id || '', tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    else await actualizarFila('tareas_planner', tarea.id, [tarea.id, tarea.usuario_id, tarea.tarea_padre_id || '', tarea.tarea_padre_tipo || '', tarea.nombre, tarea.dia_semana, tarea.fecha_exacta || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
  }
  async function eliminarTarea(tarea) {
    if (!window.confirm(`¿Eliminar "${tarea.nombre}"?`)) return
    if (tarea._tipo === 'proyecto') { await marcarEliminado('tareas', tarea.id, accessToken); await eliminarTareasPlanner(tarea.id, accessToken) }
    else if (tarea._tipo === 'soporte') { await marcarEliminado('tareas_soporte', tarea.id, accessToken); await eliminarTareasPlanner(tarea.id, accessToken) }
    else if (tarea._tipo === 'direccion') { await marcarEliminado('tareas_direccion', tarea.id, accessToken); await eliminarTareasPlanner(tarea.id, accessToken) }
    else await marcarEliminado('tareas_planner', tarea.id, accessToken)
    setModalEditarTarea(null); setVistaTarea(null); cargarDatos()
  }
  async function guardarEditarTarea() {
    if (!modalEditarTarea) return
    const t = modalEditarTarea
    const fechasExactas = t.fechas_exactas || t.fecha_exacta || ''
    const primeraFecha = fechasExactas.split(',')[0]?.trim() || ''
    const diaCalculado = getDiaSemana(primeraFecha) || t.dia_semana || 'por_asignar'
    const tiempoEstimado = ((t._horas || 0) * 60 + (t._minutos || 0)).toString()
    if (t.tarea_padre_id) {
      const hoja = getRefHoja(t)
      const tareaOrigen = todasTareasProyecto.find(x => x.id === t.tarea_padre_id) || todasTareasSoporte.find(x => x.id === t.tarea_padre_id)
      if (tareaOrigen && hoja === 'tareas') await actualizarFila('tareas', tareaOrigen.id, [tareaOrigen.id, tareaOrigen.ensayo_id, tareaOrigen.accion_id, tareaOrigen.proyecto_id, tareaOrigen.nombre, Array.isArray(t.asignados) ? t.asignados.join(',') : (t.asignados || tareaOrigen.asignados), tareaOrigen.dia_semana, fechasExactas, tareaOrigen.dia_recomendado || '', tareaOrigen.fecha_limite || '', tareaOrigen.estado, tareaOrigen.fecha_creacion, tareaOrigen.etiqueta || '', tareaOrigen.fecha_limite_original || tareaOrigen.fecha_limite || '', t.descripcion || '', tareaOrigen.tarea_grupo_id || '', tiempoEstimado, t.hora_inicio || ''], accessToken)
      else if (tareaOrigen && hoja === 'tareas_soporte') await actualizarFila('tareas_soporte', tareaOrigen.id, [tareaOrigen.id, tareaOrigen.categoria_id, tareaOrigen.proyecto_soporte_id || '', tareaOrigen.subcarpeta_id || '', tareaOrigen.nombre, Array.isArray(t.asignados) ? t.asignados.join(',') : (t.asignados || tareaOrigen.asignados), tareaOrigen.dia_semana, fechasExactas, tareaOrigen.dia_recomendado || '', tareaOrigen.fecha_limite || '', tareaOrigen.estado, tareaOrigen.fecha_creacion, tareaOrigen.etiqueta || '', tareaOrigen.fecha_limite_original || tareaOrigen.fecha_limite || '', t.descripcion || '', tareaOrigen.tarea_grupo_id || '', tiempoEstimado], accessToken)
    }
    if (t._tipo === 'proyecto') {
      await actualizarFila('tareas', t.id, [t.id, t.ensayo_id, t.accion_id, t.proyecto_id, t.nombre, Array.isArray(t.asignados) ? t.asignados.join(',') : (t.asignados || ''), diaCalculado, '', t.dia_recomendado || '', t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || '', tiempoEstimado, t.hora_inicio || ''], accessToken)
      await guardarFechaPersonalEnPlanner(t.id, 'proyecto', fechasExactas, usuario, accessToken, t.nombre)
    }
    else if (t._tipo === 'soporte') {
      await actualizarFila('tareas_soporte', t.id, [t.id, t.categoria_id, t.proyecto_soporte_id || '', t.subcarpeta_id || '', t.nombre, Array.isArray(t.asignados) ? t.asignados.join(',') : (t.asignados || ''), diaCalculado, '', t.dia_recomendado || '', t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || '', tiempoEstimado, t.hora_inicio || ''], accessToken)
      await guardarFechaPersonalEnPlanner(t.id, 'soporte', fechasExactas, usuario, accessToken, t.nombre)
    }
    else if (t._tipo === 'direccion') {
      await actualizarFila('tareas_direccion', t.id, [t.id, t.categoria_id, t.proyecto_direccion_id || '', t.subcarpeta_id || '', t.nombre, Array.isArray(t.asignados) ? t.asignados.join(',') : (t.asignados || ''), diaCalculado, '', t.dia_recomendado || '', t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || '', tiempoEstimado, t.hora_inicio || ''], accessToken)
      await guardarFechaPersonalEnPlanner(t.id, 'direccion', fechasExactas, usuario, accessToken, t.nombre)
    }
    else {
      const asignadosNuevos = Array.isArray(t.asignados) ? t.asignados : (t.asignados ? t.asignados.split(',').filter(Boolean) : [t.usuario_id])
      await actualizarFila('tareas_planner', t.id, [t.id, t.usuario_id, t.tarea_padre_id || '', t.tarea_padre_tipo || '', t.nombre, diaCalculado, t.fecha_limite || '', fechasExactas, t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || '', tiempoEstimado, t.hora_inicio || '', asignadosNuevos.join(',')], accessToken)
      for (const uid of asignadosNuevos) {
        if (uid === t.usuario_id) continue
        const existe = tareasPlanner.find(tp => tp.tarea_padre_id === t.id && String(tp.usuario_id) === String(uid))
        if (!existe) {
          await escribirFila('tareas_planner', [Date.now().toString() + uid, uid, t.id, 'planner', t.nombre, diaCalculado, t.fecha_limite || '', fechasExactas, t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || '', tiempoEstimado, t.hora_inicio || '', asignadosNuevos.join(',')], accessToken)
        }
      }
    }
    setModalEditarTarea(null); cargarDatos()
  }
  async function guardarEditarEvento() {
    if (!modalEditarEvento) return
    const ev = modalEditarEvento
    const asignadosStr = ev._asignados && ev._asignados.length > 0 ? ev._asignados.join(',') : String(usuario.id)
    await actualizarFila('eventos', ev.id, [ev.id, asignadosStr, ev.titulo, ev.descripcion || '', ev.fecha_exacta, ev.hora_inicio || '', ev.hora_fin || '', ev.tipo, ev.fecha_creacion, ev.estado || ''], accessToken)
    setModalEditarEvento(null); cargarDatos()
  }
  async function eliminarEvento(eventoId) { await marcarEliminado('eventos', eventoId, accessToken); setModalEditarEvento(null); cargarDatos() }
  async function crearTareaPlanner() {
    if (!formTarea.nombre) return
    const fechasExactas = formTarea.fechas_exactas || ''
    const primeraFecha = fechasExactas.split(',')[0]?.trim() || ''
    const diaCalculado = getDiaSemana(primeraFecha) || 'por_asignar'
    const misId = String(usuario.id)
    const asignados = formTarea.asignadoA ? formTarea.asignadoA.split(',').filter(Boolean) : [misId]
    const tiempoEstimado = ((formTarea._horas || 0) * 60 + (formTarea._minutos || 0)).toString()
    for (const uid of asignados) {
      const id = Date.now().toString() + uid
      await escribirFila('tareas_planner', [id, uid, formTarea.tarea_padre_id || '', formTarea.tarea_padre_tipo || '', formTarea.nombre, diaCalculado, formTarea.fecha_limite || '', fechasExactas, 'pendiente', new Date().toISOString(), formTarea.etiqueta || '', formTarea.fecha_limite || '', '', '', tiempoEstimado], accessToken)
    }
    setModalNuevaTarea(false)
    setFormTarea({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', fechas_exactas: '', fecha_limite: '', etiqueta: '', asignadoA: '', _horas: 0, _minutos: 0 })
    cargarDatos()
  }
  async function crearEvento() {
    if (!formEvento.titulo || !formEvento.fecha_exacta) return
    const id = Date.now().toString()
    const asignadosStr = formEvento._asignados && formEvento._asignados.length > 0 ? formEvento._asignados.join(',') : String(usuario.id)
    await escribirFila('eventos', [id, asignadosStr, formEvento.titulo, formEvento.descripcion, formEvento.fecha_exacta, formEvento.hora_inicio, formEvento.hora_fin, formEvento.tipo, new Date().toISOString(), '', formEvento._origenId || '', formEvento._origenTipo || ''], accessToken)
    setModalNuevoEvento(false)
    setFormEvento({ titulo: '', descripcion: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion', _asignados: [] })
    cargarDatos()
  }

  function todasLasTareas() {
    const completadasEnPlanner = new Set(
      tareasPlanner
        .filter(tp => tp.estado === 'completada' && tp.tarea_padre_id)
        .map(tp => tp.tarea_padre_id)
    )
    const misId = String(usuario.id)
    function fechaPersonalDe(tareaId) {
      const tp = tareasPlanner.find(tp => tp.tarea_padre_id === tareaId && String(tp.usuario_id) === misId)
      return tp?.fecha_exacta || ''
    }
    return [
      ...tareas.map(t => ({ ...t, _tipo: 'proyecto', fecha_exacta: fechaPersonalDe(t.id) })).filter(t => !completadasEnPlanner.has(t.id)),
      ...tareasSoporte.map(t => ({ ...t, _tipo: 'soporte', fecha_exacta: fechaPersonalDe(t.id) })).filter(t => !completadasEnPlanner.has(t.id)),
      ...tareasDireccion.map(t => ({ ...t, _tipo: 'direccion', fecha_exacta: fechaPersonalDe(t.id) })).filter(t => !completadasEnPlanner.has(t.id)),
      ...tareasPlanner.map(t => ({ ...t, _tipo: 'planner' }))
    ]
  }
  function getDiasDeSemana(lunes) {
    return DIAS_SEMANA.map((dia, i) => { const d = new Date(lunes); d.setDate(d.getDate() + i); return { dia, fecha: getISODate(d), label: DIAS_LABEL[dia] } })
  }
  function tareaEnFecha(tarea, fechaStr) { return (tarea.fecha_exacta || '').split(',').map(f => f.trim()).includes(fechaStr) }
  function tareasDeDia(fechaStr) {
    return todasLasTareas().filter(t => {
      if (t.estado === 'completada' && !mostrarCompletadas) return false
      if (filtroEtiqueta && !(t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(filtroEtiqueta))) return false
      return tareaEnFecha(t, fechaStr)
    })
  }
  function tareasBacklog() {
    return todasLasTareas().filter(t => {
      if (t.estado === 'completada' && !mostrarCompletadas) return false
      if (filtroEtiqueta && !(t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(filtroEtiqueta))) return false
      return !t.fecha_exacta || t.fecha_exacta === ''
    })
  }
  function eventosDeDia(fechaStr) { return eventos.filter(e => e.fecha_exacta === fechaStr) }
  function minutosEstimadosDia(fechaStr) { return tareasDeDia(fechaStr).filter(t => t.estado !== 'completada').reduce((sum, t) => sum + (parseInt(t.tiempo_estimado) || 0), 0) }
  function getContexto(tarea) {
    if (tarea._tipo === 'proyecto') { const p = proyectos.find(p => p.id === tarea.proyecto_id); return p ? p.nombre : 'Proyecto' }
    if (tarea._tipo === 'soporte') { const c = categoriasSoporte.find(c => c.id === tarea.categoria_id); return c ? c.nombre : 'Soporte' }
    if (tarea._tipo === 'direccion') return '🏢 Dirección'
    if (tarea.tarea_padre_id) { const padre = todasTareasProyecto.find(t => t.id === tarea.tarea_padre_id) || todasTareasSoporte.find(t => t.id === tarea.tarea_padre_id); return padre ? `↳ ${padre.nombre}` : '↳ Subtarea' }
    return '📝 Tarea libre'
  }
  function getDescripcionTarea(tarea) {
    if (tarea._tipo === 'planner' && tarea.tarea_padre_id) {
      const padre = todasTareasProyecto.find(t => t.id === tarea.tarea_padre_id) || todasTareasSoporte.find(t => t.id === tarea.tarea_padre_id)
      return padre?.descripcion || ''
    }
    return tarea.descripcion || ''
  }
  function parseTiempoEstimado(tarea) { const min = parseInt(tarea.tiempo_estimado) || 0; return { horas: Math.floor(min / 60), minutos: min % 60 } }
  function getDiasDelMes() {
    const año = mesBase.getFullYear(), mes = mesBase.getMonth()
    const primerDia = new Date(año, mes, 1), ultimoDia = new Date(año, mes + 1, 0)
    const dias = [], inicioSemana = new Date(primerDia)
    const diaSemana = primerDia.getDay()
    inicioSemana.setDate(primerDia.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
    for (let d = new Date(inicioSemana); d <= ultimoDia || dias.length % 7 !== 0; d.setDate(d.getDate() + 1)) dias.push({ fecha: getISODate(new Date(d)), mes: new Date(d).getMonth() === mes })
    return dias
  }
  function calcularPosicionesDia(fechaStr) {
    const lista = tareasDeDia(fechaStr)
    const sinTiempo = lista.filter(t => !parseInt(t.tiempo_estimado) && !t.hora_inicio)
    // Tareas con hora_inicio explícita
    const conHora = lista.filter(t => t.hora_inicio).map(t => {
      const [hh, mm] = t.hora_inicio.split(':').map(Number)
      const horaDecimal = hh + mm / 60
      const durH = parseInt(t.tiempo_estimado) > 0 ? parseInt(t.tiempo_estimado) / 60 : 1
      const top = (horaDecimal - HORA_INICIO) * ALTURA_HORA
      const height = durH * ALTURA_HORA
      return { ...t, _top: top, _height: height }
    })
    // Tareas con tiempo estimado pero sin hora_inicio — se colocan automáticamente
    let cursor = HORA_INICIO
    const conPosicionAuto = lista.filter(t => parseInt(t.tiempo_estimado) > 0 && !t.hora_inicio).map(t => {
      const durH = parseInt(t.tiempo_estimado) / 60
      const top = (cursor - HORA_INICIO) * ALTURA_HORA
      const height = durH * ALTURA_HORA
      cursor += durH + 0.25
      return { ...t, _top: top, _height: height }
    })
    return { sinTiempo, conPosicion: [...conHora, ...conPosicionAuto] }
  }
  function opcionesProyecto() {
    const opciones = []
    proyectos.filter(p => p.fecha_creacion !== 'eliminado').forEach(proy => {
      opciones.push({ id: `proy_${proy.id}`, label: `📋 ${proy.nombre}`, tipo: 'proyecto_proyecto', realId: proy.id })
      estadosProyecto.filter(e => e.proyecto_id === proy.id).forEach(estado => {
        opciones.push({ id: `estado_${estado.id}`, label: `  📌 ${estado.nombre}`, tipo: 'proyecto_estado', realId: estado.id })
        acciones.filter(a => a.estado_id === estado.id).forEach(accion => {
          opciones.push({ id: `accion_${accion.id}`, label: `    ⚡ ${accion.nombre}`, tipo: 'proyecto_accion', realId: accion.id })
          ensayos.filter(en => en.accion_id === accion.id).forEach(ensayo => {
            opciones.push({ id: `ensayo_${ensayo.id}`, label: `      🧪 ${ensayo.nombre}`, tipo: 'proyecto_ensayo', realId: ensayo.id })
            todasTareasProyecto.filter(t => t.ensayo_id === ensayo.id).forEach(tarea => { opciones.push({ id: `tarea_${tarea.id}`, label: `        ✅ ${tarea.nombre}`, tipo: 'proyecto', realId: tarea.id }) })
          })
          todasTareasProyecto.filter(t => t.accion_id === accion.id && !t.ensayo_id).forEach(tarea => { opciones.push({ id: `tarea_${tarea.id}`, label: `      ✅ ${tarea.nombre}`, tipo: 'proyecto', realId: tarea.id }) })
        })
      })
    })
    return opciones
  }
  function opcionesSoporte() {
    const opciones = []
    categoriasSoporte.forEach(cat => {
      opciones.push({ id: `cat_${cat.id}`, label: `🗂 ${cat.nombre}`, tipo: 'soporte_categoria', realId: cat.id })
      proyectosSoporte.filter(p => p.categoria_id === cat.id).forEach(proy => {
        opciones.push({ id: `proy_${proy.id}`, label: `  📁 ${proy.nombre}`, tipo: 'soporte_proyecto', realId: proy.id })
        subcarpetasSoporte.filter(s => s.proyecto_soporte_id === proy.id).forEach(sub => {
          opciones.push({ id: `sub_${sub.id}`, label: `    📂 ${sub.nombre}`, tipo: 'soporte_subcarpeta', realId: sub.id })
          todasTareasSoporte.filter(t => t.subcarpeta_id === sub.id).forEach(tarea => { opciones.push({ id: `tarea_${tarea.id}`, label: `      ✅ ${tarea.nombre}`, tipo: 'soporte', realId: tarea.id }) })
        })
        todasTareasSoporte.filter(t => t.proyecto_soporte_id === proy.id && !t.subcarpeta_id).forEach(tarea => { opciones.push({ id: `tarea_${tarea.id}`, label: `    ✅ ${tarea.nombre}`, tipo: 'soporte', realId: tarea.id }) })
      })
      todasTareasSoporte.filter(t => t.categoria_id === cat.id && !t.proyecto_soporte_id).forEach(tarea => { opciones.push({ id: `tarea_${tarea.id}`, label: `  ✅ ${tarea.nombre}`, tipo: 'soporte', realId: tarea.id }) })
    })
    return opciones
  }
  
  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando planner...</p></div>

  const esMobile = window.innerWidth < 768
  const diasSemana = getDiasDeSemana(semanaBase)
  const hoy = getISODate(new Date())
  const misId = String(usuario.id)

  function renderTarjeta(tarea) {
    const activa = cronActivo?.tareaId === tarea.id
    const pausada = activa && !cronActivo?.inicio
    const refId = tarea._tipo === 'planner' ? getRefId(tarea) : tarea.id
    const refTipo = tarea._tipo === 'planner' ? getRefTipo(tarea) : tarea._tipo
    const clCount = getChecklistCount(refId, refTipo)
    return (
      <TarjetaTarea key={tarea.id + tarea._tipo} tarea={tarea} contexto={getContexto(tarea)} checklistCount={clCount}
        onVerDetalle={() => setVistaTarea(tarea)}
        onEditar={() => { const tipoLigar = tarea.tarea_padre_tipo ? tarea.tarea_padre_tipo.startsWith('proyecto') ? 'proyecto' : tarea.tarea_padre_tipo.startsWith('soporte') ? 'soporte' : '' : ''; const te = parseTiempoEstimado(tarea); const asignadosArr = tarea.asignados ? (Array.isArray(tarea.asignados) ? tarea.asignados : tarea.asignados.split(',').filter(Boolean)) : [tarea.usuario_id || '']; const fechaPersonal = ['proyecto','soporte','direccion'].includes(tarea._tipo) ? (tareasPlanner.find(tp => tp.tarea_padre_id === tarea.id && String(tp.usuario_id) === String(usuario.id))?.fecha_exacta || '') : (tarea.fecha_exacta || ''); setModalEditarTarea({ ...tarea, descripcion: getDescripcionTarea(tarea), fechas_exactas: fechaPersonal, _tipoLigar: tipoLigar, _opcionProyectoId: '', _opcionSoporteId: '', _horas: te.horas, _minutos: te.minutos, asignados: asignadosArr }) }}
        onIniciar={() => iniciarCronometro(tarea)} onPausar={pausarYGuardar} onReanudar={reanudarCronometro} onCompletar={() => detenerCronometro(true)}
        activa={activa} pausada={pausada} tiempoActual={activa ? tiempoActual : 0}
      />
    )
  }

  function abrirDia(fecha) { setDiaBase(fecha); setVista('dia') }

  if (vistaTarea) {
    const refId = vistaTarea._tipo === 'planner' ? getRefId(vistaTarea) : vistaTarea.id
    const refTipo = vistaTarea._tipo === 'planner' ? getRefTipo(vistaTarea) : vistaTarea._tipo
    const descripcion = getDescripcionTarea(vistaTarea)
    return (
      <div className="planner-container">
        <div className="planner-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={() => setVistaTarea(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
              <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaTarea.nombre}</h1>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { const tipoLigar = vistaTarea.tarea_padre_tipo ? vistaTarea.tarea_padre_tipo.startsWith('proyecto') ? 'proyecto' : vistaTarea.tarea_padre_tipo.startsWith('soporte') ? 'soporte' : '' : ''; const te = parseTiempoEstimado(vistaTarea); setModalEditarTarea({ ...vistaTarea, descripcion: getDescripcionTarea(vistaTarea), fechas_exactas: vistaTarea.fecha_exacta || '', _tipoLigar: tipoLigar, _opcionProyectoId: '', _opcionSoporteId: '', _horas: te.horas, _minutos: te.minutos }) }} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>✏️ Editar</button>
              <button onClick={() => eliminarTarea(vistaTarea)} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>🗑 Eliminar</button>
            </div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {descripcion && <div style={{ marginBottom: '16px' }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Descripción:</label><p style={{ margin: 0, fontSize: '14px', color: '#373A36', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>{descripcion}</p></div>}
          {vistaTarea.tiempo_estimado && parseInt(vistaTarea.tiempo_estimado) > 0 && <div style={{ marginBottom: '16px', background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>⏳ Tiempo estimado: <strong>{formatMinutos(parseInt(vistaTarea.tiempo_estimado))}</strong></div>}
          <SeccionChecklist tareaId={refId} tipoTarea={refTipo} accessToken={accessToken} />
          <SeccionActualizaciones tareaId={refId} tipoTarea={refTipo} usuario={usuario} accessToken={accessToken} />
        </div>
        {modalEditarTarea && (
          <ModalEditarTareaComponent modalEditarTarea={modalEditarTarea} setModalEditarTarea={setModalEditarTarea}
            guardarEditarTarea={async () => { await guardarEditarTarea(); setVistaTarea({...vistaTarea, descripcion: modalEditarTarea.descripcion}) }}
            eliminarTarea={eliminarTarea} opcionesProyecto={opcionesProyecto} opcionesSoporte={opcionesSoporte}
            usuario={usuario} usuarios={usuarios} accessToken={accessToken} getRefId={getRefId} getRefTipo={getRefTipo}
          />
        )}
      </div>
    )
  }

  return (
    <div className="planner-container">
      <div className="planner-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: esMobile ? 'flex-start' : 'center', justifyContent: 'space-between', width: '100%', flexDirection: esMobile ? 'column' : 'row', gap: esMobile ? '8px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0 }}>📅 Planner</h1>
            <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <button onClick={() => setVista('semana')} style={{ padding: '6px 14px', background: vista === 'semana' ? '#00953B' : 'white', color: vista === 'semana' ? 'white' : '#373A36', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Semana</button>
              <button onClick={() => setVista('mes')} style={{ padding: '6px 14px', background: vista === 'mes' ? '#00953B' : 'white', color: vista === 'mes' ? 'white' : '#373A36', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Mes</button>
              <button onClick={() => setVista('dia')} style={{ padding: '6px 14px', background: vista === 'dia' ? '#00953B' : 'white', color: vista === 'dia' ? 'white' : '#373A36', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Día</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: esMobile ? 'flex-start' : 'flex-end' }}>
            <button onClick={() => setMostrarCompletadas(prev => !prev)} style={{ background: mostrarCompletadas ? '#f0fdf4' : '#f3f4f6', color: mostrarCompletadas ? '#00953B' : '#6b7280', border: '1px solid ' + (mostrarCompletadas ? '#00953B' : '#e5e7eb'), borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{mostrarCompletadas ? '✅ Ocultar' : '☑️ Completadas'}</button>
            <button onClick={() => setModalNuevoEvento(true)} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>+ Evento</button>
            <button onClick={() => setModalNuevaTarea(true)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>+ Tarea</button>
          </div>
        </div>
        {cronActivo && (
          <div style={{ background: '#f0fdf4', border: '2px solid #00953B', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
            <span style={{ fontSize: '12px', color: '#373A36', fontWeight: '600' }}>⏱ {cronActivo.nombre}</span>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#00953B', fontFamily: 'monospace' }}>{formatTiempo(tiempoActual)}</span>
            {cronActivo.inicio ? <button onClick={pausarYGuardar} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>⏸ Pausar</button> : <button onClick={reanudarCronometro} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>▶️ Reanudar</button>}
            <button onClick={() => detenerCronometro(true)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>✅ Completar</button>
            <button onClick={() => detenerCronometro(false)} style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>⏹ Detener</button>
          </div>
        )}
      </div>

      {vista !== 'dia' && (
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', marginBottom: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[{ key: '', label: 'Todas' }, { key: 'urgente', label: '🔴 Urgente' }, { key: 'importante', label: '🟡 Importante' }, { key: 'delegar', label: '🔵 Delegar' }].map(({ key, label }) => {
            const count = key === '' ? todasLasTareas().filter(t => t.estado !== 'completada').length : todasLasTareas().filter(t => t.estado !== 'completada' && t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(key)).length
            const activa = filtroEtiqueta === key
            return (
              <button key={key} onClick={() => setFiltroEtiqueta(key)} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activa ? '2px solid #00953B' : '2px solid transparent', color: activa ? '#00953B' : '#6b7280', fontWeight: activa ? '600' : '400', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-1px' }}>
                {label}
                <span style={{ background: activa ? '#00953B' : '#f3f4f6', color: activa ? 'white' : '#6b7280', borderRadius: '20px', padding: '1px 7px', fontSize: '11px', fontWeight: '600' }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {vista === 'semana' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <button onClick={() => setSemanaBase(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '18px' }}>←</button>
            <span style={{ fontWeight: '700', fontSize: '16px', color: '#373A36' }}>{diasSemana[0].fecha} — {diasSemana[4].fecha}</span>
            <button onClick={() => setSemanaBase(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '18px' }}>→</button>
            <button onClick={() => setSemanaBase(getLunesDeSemana(new Date()))} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Hoy</button>
          </div>
          <div className="planner-grid">
            {diasSemana.map(({ dia, fecha, label }) => {
              const tareasDelDia = tareasDeDia(fecha)
              const eventosDelDia = eventosDeDia(fecha)
              const esHoy = fecha === hoy
              const minEstimados = minutosEstimadosDia(fecha)
              const sobrecargado = minEstimados > 8 * 60
              return (
                <div key={dia} className="planner-column">
                  <div className="column-header" style={{ background: esHoy ? '#00953B' : undefined, borderRadius: esHoy ? '8px' : undefined, cursor: 'pointer' }} onClick={() => abrirDia(fecha)}>
                    <div>
                      <h3 style={{ color: esHoy ? 'white' : undefined }}>{label}</h3>
                      <span style={{ fontSize: '11px', opacity: 0.8, color: esHoy ? 'white' : undefined }}>{fecha}</span>
                    </div>
                    <span className="task-count" style={{ background: esHoy ? 'rgba(255,255,255,0.3)' : undefined, color: esHoy ? 'white' : undefined }}>{tareasDelDia.length + eventosDelDia.length}</span>
                  </div>
                  <div className="column-tasks">
                    {eventosDelDia.map(ev => {
                      const completado = ev.estado === 'completado'
                      return (
                        <div key={ev.id} style={{ background: '#f5f3ff', borderLeft: `4px solid ${completado ? '#a78bfa' : '#7c3aed'}`, borderRadius: '8px', padding: '8px 10px', marginBottom: '6px', opacity: completado ? 0.7 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div onClick={() => setModalEditarEvento({ ...ev, _asignados: ev.usuario_id ? ev.usuario_id.split(',').map(s => s.trim()).filter(Boolean) : [misId] })} style={{ cursor: 'pointer', flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#7c3aed', textDecoration: completado ? 'line-through' : 'none' }}>🗓 {ev.titulo}</p>
                              {ev.hora_inicio && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>{ev.hora_inicio}{ev.hora_fin ? ` — ${ev.hora_fin}` : ''}</p>}
                              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#a78bfa' }}>{ev.tipo}</p>
                            </div>
                            {!completado && ev.hora_inicio && ev.hora_fin && (
                              <button onClick={e => { e.stopPropagation(); completarEvento(ev) }} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', marginLeft: '6px' }}>✅</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {tareasDelDia.map(tarea => renderTarjeta(tarea))}
                  </div>
                  {minEstimados > 0 && (
                    <div style={{ padding: '6px 8px', borderTop: '1px solid #f3f4f6', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: sobrecargado ? '#dc2626' : '#6b7280', fontWeight: sobrecargado ? '700' : '400' }}>
                        {sobrecargado ? '⚠️' : '⏳'} {formatMinutos(minEstimados)} estimado
                        {sobrecargado && <span style={{ display: 'block', fontSize: '10px', color: '#dc2626' }}>Supera 8h</span>}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="planner-column backlog">
              <div className="column-header">
                <h3>📥 Por asignar</h3>
                <span className="task-count">{tareasBacklog().length}</span>
              </div>
              <div className="column-tasks">{tareasBacklog().map(tarea => renderTarjeta(tarea))}</div>
            </div>
          </div>
        </>
      )}

      {vista === 'mes' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <button onClick={() => setMesBase(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '18px' }}>←</button>
            <span style={{ fontWeight: '700', fontSize: '18px', color: '#373A36' }}>{MESES[mesBase.getMonth()]} {mesBase.getFullYear()}</span>
            <button onClick={() => setMesBase(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '18px' }}>→</button>
            <button onClick={() => setMesBase(new Date())} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Hoy</button>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {getDiasDelMes().map(({ fecha, mes }) => {
                const tareasDelDia = tareasDeDia(fecha), eventosDelDia = eventosDeDia(fecha), esHoy = fecha === hoy, total = tareasDelDia.length + eventosDelDia.length
                return (
                  <div key={fecha} onClick={() => abrirDia(fecha)}
                    style={{ minHeight: '80px', padding: '6px', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', background: esHoy ? '#f0fdf4' : mes ? 'white' : '#f9fafb', cursor: 'pointer', opacity: mes ? 1 : 0.4 }}
                    onMouseOver={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseOut={e => e.currentTarget.style.background = esHoy ? '#f0fdf4' : mes ? 'white' : '#f9fafb'}>
                    <span style={{ fontSize: '13px', fontWeight: esHoy ? '700' : '400', color: esHoy ? '#00953B' : '#373A36', display: 'block', marginBottom: '4px' }}>{new Date(fecha + 'T12:00:00').getDate()}</span>
                    {total > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                        {eventosDelDia.slice(0,1).map(ev => <span key={ev.id} style={{ fontSize: '10px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '3px', padding: '1px 4px', fontWeight: '600' }}>🗓 {ev.titulo.slice(0,8)}</span>)}
                        {tareasDelDia.slice(0,2).map(t => <span key={t.id} style={{ fontSize: '10px', background: t._tipo === 'soporte' ? '#eff6ff' : '#f0fdf4', color: t._tipo === 'soporte' ? '#1d4ed8' : '#00953B', borderRadius: '3px', padding: '1px 4px' }}>{t.nombre.slice(0,10)}</span>)}
                        {total > 2 && <span style={{ fontSize: '10px', color: '#888' }}>+{total - 2}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {vista === 'dia' && (() => {
        const fechaObj = new Date(diaBase + 'T12:00:00')
        const esHoy = diaBase === hoy
        const { sinTiempo, conPosicion } = calcularPosicionesDia(diaBase)
        const evsDia = eventosDeDia(diaBase)
        function navDia(delta) { const d = new Date(diaBase + 'T12:00:00'); d.setDate(d.getDate() + delta); setDiaBase(getISODate(d)) }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <button onClick={() => navDia(-1)} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '16px' }}>←</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DIAS_CORTOS[fechaObj.getDay()]}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '32px', fontWeight: '800', color: esHoy ? '#00953B' : '#373A36', lineHeight: 1 }}>{fechaObj.getDate()}</span>
                  <span style={{ fontSize: '16px', color: '#6b7280' }}>{MESES[fechaObj.getMonth()]} {fechaObj.getFullYear()}</span>
                </div>
                {esHoy && <span style={{ fontSize: '11px', background: '#00953B', color: 'white', borderRadius: '20px', padding: '1px 8px', fontWeight: '600' }}>Hoy</span>}
              </div>
              <button onClick={() => navDia(1)} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '16px' }}>→</button>
              <button onClick={() => setDiaBase(hoy)} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#373A36' }}>Hoy</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <VistaDia
                fecha={diaBase} tareasConPosicion={conPosicion} tareasTodoDia={sinTiempo} eventosDia={evsDia}
                cronActivo={cronActivo} tiempoActual={tiempoActual}
                onVerDetalle={t => setVistaTarea(t)}
                onEditarTarea={tarea => { const tipoLigar = tarea.tarea_padre_tipo ? tarea.tarea_padre_tipo.startsWith('proyecto') ? 'proyecto' : tarea.tarea_padre_tipo.startsWith('soporte') ? 'soporte' : '' : ''; const te = parseTiempoEstimado(tarea); setModalEditarTarea({ ...tarea, descripcion: getDescripcionTarea(tarea), fechas_exactas: tarea.fecha_exacta || '', _tipoLigar: tipoLigar, _opcionProyectoId: '', _opcionSoporteId: '', _horas: te.horas, _minutos: te.minutos }) }}
                onIniciarCron={iniciarCronometro} onPausarCron={pausarYGuardar} onReanudarCron={reanudarCronometro} onCompletarCron={() => detenerCronometro(true)}
                onEditarEvento={ev => setModalEditarEvento({ ...ev, _asignados: ev.usuario_id ? ev.usuario_id.split(',').map(s => s.trim()).filter(Boolean) : [misId] })}
                onCompletarEvento={completarEvento} getChecklistCount={getChecklistCount}
              />
            </div>
          </div>
        )
      })()}

      {modalEditarTarea && !vistaTarea && (
        <ModalEditarTareaComponent modalEditarTarea={modalEditarTarea} setModalEditarTarea={setModalEditarTarea}
          guardarEditarTarea={guardarEditarTarea} eliminarTarea={eliminarTarea}
          opcionesProyecto={opcionesProyecto} opcionesSoporte={opcionesSoporte}
          usuario={usuario} usuarios={usuarios} accessToken={accessToken} getRefId={getRefId} getRefTipo={getRefTipo}
        />
      )}

      {modalEditarEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Editar evento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Título *" value={modalEditarEvento.titulo || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, titulo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <select value={modalEditarEvento.tipo || 'reunion'} onChange={e => setModalEditarEvento({...modalEditarEvento, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="reunion">Reunión</option><option value="formacion">Formación</option><option value="evento">Evento</option><option value="otro">Otro</option>
              </select>
              <SelectorPersonasEvento seleccionados={modalEditarEvento._asignados || [misId]} onChange={ids => setModalEditarEvento({...modalEditarEvento, _asignados: ids})} misId={misId} />
              <div><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha</label><input type="date" value={modalEditarEvento.fecha_exacta || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, fecha_exacta: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio</label><input type="time" value={modalEditarEvento.hora_inicio || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, hora_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora fin</label><input type="time" value={modalEditarEvento.hora_fin || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, hora_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
              </div>
              <textarea placeholder="Descripción" value={modalEditarEvento.descripcion || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '70px', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
              <button onClick={() => eliminarEvento(modalEditarEvento.id)} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>🗑 Eliminar</button>
              <button onClick={() => setModalEditarEvento(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarEditarEvento} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {modalNuevaTarea && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Nueva tarea</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre de la tarea *" value={formTarea.nombre} onChange={e => setFormTarea({...formTarea, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Asignar a:</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {USUARIOS_EQUIPO.map(u => {
                    const asignados = formTarea.asignadoA ? formTarea.asignadoA.split(',').filter(Boolean) : [misId]
                    const seleccionado = asignados.includes(u.id)
                    return (
                      <button key={u.id} onClick={e => { e.stopPropagation(); e.preventDefault(); const actual = formTarea.asignadoA ? formTarea.asignadoA.split(',').filter(Boolean) : [misId]; const nuevo = actual.includes(u.id) ? actual.filter(id => id !== u.id) : [...actual, u.id]; if (nuevo.length === 0) return; setFormTarea({...formTarea, asignadoA: nuevo.join(',')}) }}
                        style={{ padding: '6px 14px', borderRadius: '20px', border: '2px solid', borderColor: seleccionado ? '#00953B' : '#e5e7eb', background: seleccionado ? '#f0fdf4' : 'white', color: seleccionado ? '#00953B' : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                        {u.nombre}{u.id === misId ? ' (yo)' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Tipo:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setFormTarea({...formTarea, tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: ''})} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid ' + (formTarea.tipo === 'libre' ? '#00953B' : '#e5e7eb'), background: formTarea.tipo === 'libre' ? '#f0fdf4' : 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: formTarea.tipo === 'libre' ? '#00953B' : '#373A36' }}>📝 Libre</button>
                  <button onClick={() => setFormTarea({...formTarea, tipo: 'subtarea'})} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid ' + (formTarea.tipo === 'subtarea' ? '#00953B' : '#e5e7eb'), background: formTarea.tipo === 'subtarea' ? '#f0fdf4' : 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: formTarea.tipo === 'subtarea' ? '#00953B' : '#373A36' }}>🔗 Subtarea</button>
                </div>
              </div>
              {formTarea.tipo === 'subtarea' && (
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Ligar a:</label>
                  <select value={formTarea._tipoLigar || ''} onChange={e => setFormTarea({...formTarea, _tipoLigar: e.target.value, tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: ''})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', marginBottom: '8px' }}>
                    <option value="">Selecciona tipo...</option><option value="proyecto">De Proyectos I+D</option><option value="soporte">De Soporte</option>
                  </select>
                  {formTarea._tipoLigar === 'proyecto' && <select value={formTarea._opcionProyectoId || ''} onChange={e => { const opcion = opcionesProyecto().find(o => o.id === e.target.value); if (opcion) setFormTarea({...formTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionProyectoId: opcion.id}) }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}><option value="">Selecciona elemento de proyecto...</option>{opcionesProyecto().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}</select>}
                  {formTarea._tipoLigar === 'soporte' && <select value={formTarea._opcionSoporteId || ''} onChange={e => { const opcion = opcionesSoporte().find(o => o.id === e.target.value); if (opcion) setFormTarea({...formTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionSoporteId: opcion.id}) }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}><option value="">Selecciona elemento de soporte...</option>{opcionesSoporte().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}</select>}
                </div>
              )}
              <InputFechasMultiples label="Días asignados (opcional):" value={formTarea.fechas_exactas || ''} onChange={val => setFormTarea({...formTarea, fechas_exactas: val})} />
              <InputFechaPlanner label="Fecha límite (opcional):" value={formTarea.fecha_limite} onChange={val => setFormTarea({...formTarea, fecha_limite: val})} />
              <SelectorTiempoEstimado horas={formTarea._horas || 0} minutos={formTarea._minutos || 0} onChangeHoras={h => setFormTarea({...formTarea, _horas: h})} onChangeMinutos={m => setFormTarea({...formTarea, _minutos: m})} />
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Prioridad:</label>
                <BotonesPrioridad etiqueta={formTarea.etiqueta} onChange={val => setFormTarea({...formTarea, etiqueta: val})} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setModalNuevaTarea(false); setFormTarea({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', _tipoLigar: '', fechas_exactas: '', fecha_limite: '', etiqueta: '', asignadoA: '', _horas: 0, _minutos: 0 }) }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearTareaPlanner} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {modalNuevoEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Nuevo evento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Título *" value={formEvento.titulo} onChange={e => setFormEvento({...formEvento, titulo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <select value={formEvento.tipo} onChange={e => setFormEvento({...formEvento, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="reunion">Reunión</option><option value="formacion">Formación</option><option value="evento">Evento</option><option value="otro">Otro</option>
              </select>
              <SelectorPersonasEvento seleccionados={formEvento._asignados.length > 0 ? formEvento._asignados : [misId]} onChange={ids => setFormEvento({...formEvento, _asignados: ids})} misId={misId} />
              <div><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha *</label><input type="date" value={formEvento.fecha_exacta} onChange={e => setFormEvento({...formEvento, fecha_exacta: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio</label><input type="time" value={formEvento.hora_inicio} onChange={e => setFormEvento({...formEvento, hora_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora fin</label><input type="time" value={formEvento.hora_fin} onChange={e => setFormEvento({...formEvento, hora_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
              </div>
              <textarea placeholder="Descripción (opcional)" value={formEvento.descripcion} onChange={e => setFormEvento({...formEvento, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Ligar a proyecto (opcional):</label>
                <select value={formEvento._tipoLigar || ''} onChange={e => setFormEvento({...formEvento, _tipoLigar: e.target.value, _origenId: '', _origenTipo: '', _opcionProyectoId: '', _opcionSoporteId: '', _opcionDireccionId: ''})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', marginBottom: '8px' }}>
                  <option value="">Sin ligar</option>
                  <option value="proyecto">Proyectos I+D</option>
                  <option value="soporte">Soporte</option>
                  <option value="direccion">Dirección</option>
                </select>
                {formEvento._tipoLigar === 'proyecto' && (
                  <select value={formEvento._opcionProyectoId || ''} onChange={e => { const op = opcionesProyecto().find(o => o.id === e.target.value); if (op) setFormEvento({...formEvento, _origenId: op.realId, _origenTipo: op.tipo, _opcionProyectoId: op.id}) }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                    <option value="">Selecciona elemento...</option>
                    {opcionesProyecto().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                  </select>
                )}
                {formEvento._tipoLigar === 'soporte' && (
                  <select value={formEvento._opcionSoporteId || ''} onChange={e => { const op = opcionesSoporte().find(o => o.id === e.target.value); if (op) setFormEvento({...formEvento, _origenId: op.realId, _origenTipo: op.tipo, _opcionSoporteId: op.id}) }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                    <option value="">Selecciona elemento...</option>
                    {opcionesSoporte().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                  </select>
                )}
                {formEvento._tipoLigar === 'direccion' && (
                  <select value={formEvento._opcionDireccionId || ''} onChange={e => setFormEvento({...formEvento, _origenId: e.target.value, _origenTipo: 'direccion', _opcionDireccionId: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                    <option value="">Selecciona categoría...</option>
                    {categoriasDireccion.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setModalNuevoEvento(false); setFormEvento({ titulo: '', descripcion: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion', _asignados: [], _tipoLigar: '', _origenId: '', _origenTipo: '', _opcionProyectoId: '', _opcionSoporteId: '', _opcionDireccionId: '' }) }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearEvento} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear evento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalEditarTareaComponent({ modalEditarTarea, setModalEditarTarea, guardarEditarTarea, eliminarTarea, opcionesProyecto, opcionesSoporte, usuario, usuarios, accessToken, getRefId, getRefTipo }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px' }}>Editar tarea</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input value={modalEditarTarea.nombre || ''} onChange={e => setModalEditarTarea({...modalEditarTarea, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          <textarea placeholder="Descripción (opcional)" value={modalEditarTarea.descripcion || ''} onChange={e => setModalEditarTarea({...modalEditarTarea, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
          {usuarios && usuarios.length > 0 && (
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Asignar a:</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {usuarios.map(u => {
                  const asignados = modalEditarTarea.asignados ? (Array.isArray(modalEditarTarea.asignados) ? modalEditarTarea.asignados : modalEditarTarea.asignados.split(',').filter(Boolean)) : []
                  const activo = asignados.includes(u.id)
                  return (
                    <button key={u.id} onClick={e => { e.preventDefault(); e.stopPropagation(); const actual = modalEditarTarea.asignados ? (Array.isArray(modalEditarTarea.asignados) ? modalEditarTarea.asignados : modalEditarTarea.asignados.split(',').filter(Boolean)) : []; const nuevo = actual.includes(u.id) ? actual.filter(id => id !== u.id) : [...actual, u.id]; if (nuevo.length === 0) return; setModalEditarTarea({...modalEditarTarea, asignados: nuevo}) }}
                      style={{ padding: '6px 14px', borderRadius: '20px', border: '2px solid', borderColor: activo ? '#00953B' : '#e5e7eb', background: activo ? '#f0fdf4' : 'white', color: activo ? '#00953B' : '#6b7280', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      {u.nombre ? u.nombre.split(' ')[0] : u.id}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {modalEditarTarea._tipo === 'planner' && (
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Enlazar a (opcional):</label>
              <select value={modalEditarTarea._tipoLigar || ''} onChange={e => setModalEditarTarea({...modalEditarTarea, _tipoLigar: e.target.value, tarea_padre_id: '', tarea_padre_tipo: '', _opcionProyectoId: '', _opcionSoporteId: ''})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', marginBottom: '8px' }}>
                <option value="">Sin enlazar</option><option value="proyecto">De Proyectos I+D</option><option value="soporte">De Soporte</option>
              </select>
              {modalEditarTarea._tipoLigar === 'proyecto' && <select value={modalEditarTarea._opcionProyectoId || ''} onChange={e => { const opcion = opcionesProyecto().find(o => o.id === e.target.value); if (opcion) setModalEditarTarea({...modalEditarTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionProyectoId: opcion.id}) }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}><option value="">Selecciona elemento...</option>{opcionesProyecto().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}</select>}
              {modalEditarTarea._tipoLigar === 'soporte' && <select value={modalEditarTarea._opcionSoporteId || ''} onChange={e => { const opcion = opcionesSoporte().find(o => o.id === e.target.value); if (opcion) setModalEditarTarea({...modalEditarTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionSoporteId: opcion.id}) }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}><option value="">Selecciona elemento...</option>{opcionesSoporte().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}</select>}
            </div>
          )}
          <InputFechasMultiples label="Días asignados:" value={modalEditarTarea.fechas_exactas || modalEditarTarea.fecha_exacta || ''} onChange={val => setModalEditarTarea({...modalEditarTarea, fechas_exactas: val})} />
          <InputFechaPlanner label="Fecha límite (opcional):" value={modalEditarTarea.fecha_limite} onChange={val => setModalEditarTarea({...modalEditarTarea, fecha_limite: val})} />
          <SelectorTiempoEstimado horas={modalEditarTarea._horas || 0} minutos={modalEditarTarea._minutos || 0} onChangeHoras={h => setModalEditarTarea({...modalEditarTarea, _horas: h})} onChangeMinutos={m => setModalEditarTarea({...modalEditarTarea, _minutos: m})} />
            <div>
  <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio (opcional):</label>
  <div style={{ display: 'flex', gap: '6px' }}>
    <input type="time" value={modalEditarTarea.hora_inicio || ''} onChange={e => setModalEditarTarea({...modalEditarTarea, hora_inicio: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
    {modalEditarTarea.hora_inicio && <button onClick={() => setModalEditarTarea({...modalEditarTarea, hora_inicio: ''})} style={{ padding: '10px 12px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>✕</button>}
  </div>
</div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Prioridad:</label>
            <BotonesPrioridad etiqueta={modalEditarTarea.etiqueta} onChange={val => setModalEditarTarea({...modalEditarTarea, etiqueta: val})} />
          </div>
          <SeccionChecklist tareaId={getRefId(modalEditarTarea)} tipoTarea={getRefTipo(modalEditarTarea)} accessToken={accessToken} />
          <SeccionActualizaciones tareaId={getRefId(modalEditarTarea)} tipoTarea={getRefTipo(modalEditarTarea)} usuario={usuario} accessToken={accessToken} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={() => eliminarTarea(modalEditarTarea)} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>🗑 Eliminar</button>
          <button onClick={() => setModalEditarTarea(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={guardarEditarTarea} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function TarjetaTarea({ tarea, contexto, checklistCount, onVerDetalle, onEditar, onIniciar, onPausar, onReanudar, onCompletar, activa, pausada, tiempoActual }) {
  const esCompletada = tarea.estado === 'completada'
  const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && !esCompletada
  const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000
  const minEstimados = parseInt(tarea.tiempo_estimado) || 0
  return (
    <div className={`tarea-card ${esCompletada ? 'completada' : ''}`} style={{ borderLeft: `4px solid ${activa ? '#00953B' : vencida ? '#dc2626' : proxima ? '#f59e0b' : tarea._tipo === 'soporte' ? '#3b82f6' : tarea._tipo === 'direccion' ? '#7c3aed' : tarea._tipo === 'planner' ? '#8b5cf6' : '#00953B'}`, background: activa ? '#f0fdf4' : esCompletada ? '#f9fafb' : 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p onClick={onVerDetalle} className={`tarea-nombre ${esCompletada ? 'tachado' : ''}`} style={{ cursor: 'pointer', margin: 0 }}>{tarea.nombre}</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
          <button onClick={e => { e.stopPropagation(); onEditar() }} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
          {!esCompletada && (
            <button onClick={e => { e.stopPropagation(); activa && !pausada ? onPausar() : pausada ? onReanudar() : onIniciar() }}
              style={{ background: activa && !pausada ? '#f59e0b' : '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>
              {activa && !pausada ? '⏸' : '▶️'}
            </button>
          )}
          {!esCompletada && (activa || pausada) && (
            <button onClick={e => { e.stopPropagation(); onCompletar() }} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>✅</button>
          )}
        </div>
      </div>
      {activa && (
        <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '700', color: '#00953B', fontFamily: 'monospace' }}>
          ⏱ {Math.floor(tiempoActual/3600).toString().padStart(2,'00')}:{Math.floor((tiempoActual%3600)/60).toString().padStart(2,'0')}:{(tiempoActual%60).toString().padStart(2,'0')}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: tarea._tipo === 'soporte' ? '#eff6ff' : tarea._tipo === 'direccion' ? '#f5f3ff' : tarea._tipo === 'planner' ? '#f5f3ff' : '#f0fdf4', color: tarea._tipo === 'soporte' ? '#1d4ed8' : tarea._tipo === 'direccion' ? '#7c3aed' : tarea._tipo === 'planner' ? '#7c3aed' : '#00953B', fontWeight: '600' }}>{contexto}</span>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: activa ? '#dbeafe' : pausada ? '#fef3c7' : esCompletada ? '#dcfce7' : '#f3f4f6', color: activa ? '#1d4ed8' : pausada ? '#92400e' : esCompletada ? '#166534' : '#6b7280', fontWeight: '600' }}>
          {activa ? 'En curso' : pausada ? '⏸ Pausada' : esCompletada ? 'Completada' : 'Pendiente'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        <EtiquetasBadge etiqueta={tarea.etiqueta} />
        {tarea.fecha_limite && <span style={{ fontSize: '10px', color: vencida ? '#dc2626' : '#6b7280', background: vencida ? '#fee2e2' : '#f3f4f6', padding: '1px 5px', borderRadius: '4px' }}>{vencida ? '⚠️' : '📅'} {tarea.fecha_limite}</span>}
        {minEstimados > 0 && !esCompletada && <span style={{ fontSize: '10px', color: '#6b7280', background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px' }}>⏳ {formatMinutos(minEstimados)}</span>}
        {checklistCount && checklistCount.total > 0 && (
          <span style={{ fontSize: '10px', color: checklistCount.completados === checklistCount.total ? '#166534' : '#6b7280', background: checklistCount.completados === checklistCount.total ? '#dcfce7' : '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
            ☑️ {checklistCount.completados}/{checklistCount.total}
          </span>
        )}
      </div>
    </div>
  )
}

export default Planner
