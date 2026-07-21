import { useState, useEffect, useRef } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useAuth } from '../contexts/AuthContext'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado, eliminarTareasPlanner } from '../services/googleSheets'
import { useDatos } from '../contexts/DatosContext'
import { guardarFechaPersonalEnPlanner } from '../services/plannerHelpers'

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
  const [editandoId, setEditandoId] = useState(null)
  const [textoEdit, setTextoEdit] = useState('')
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
  async function guardarEdicion(item) {
    if (!textoEdit.trim()) return
    await actualizarFila('checklist_items', item.id, [item.id, item.tarea_id, item.tipo_tarea, textoEdit.trim(), item.completado, item.orden], accessToken)
    setEditandoId(null); await cargarItems()
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
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', background: item.completado === 'true' ? '#f0fdf4' : '#f9fafb', border: `1px solid ${item.completado === 'true' ? '#bbf7d0' : '#f3f4f6'}` }}>
            <button onClick={() => toggleItem(item)} style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${item.completado === 'true' ? '#00953B' : '#d1d5db'}`, background: item.completado === 'true' ? '#00953B' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
              {item.completado === 'true' && <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>✓</span>}
            </button>
            {editandoId === item.id ? (
              <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                <input value={textoEdit} onChange={e => setTextoEdit(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(item); if (e.key === 'Escape') setEditandoId(null) }}
                  autoFocus style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1px solid #00953B', fontSize: '13px' }} />
                <button onClick={() => guardarEdicion(item)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                <button onClick={() => setEditandoId(null)} style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: '13px', color: item.completado === 'true' ? '#6b7280' : '#373A36', textDecoration: item.completado === 'true' ? 'line-through' : 'none' }}>{item.texto}</span>
                <button onClick={() => { setEditandoId(item.id); setTextoEdit(item.texto) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '13px', padding: '0 2px', lineHeight: 1 }} onMouseOver={e => e.target.style.color = '#6b7280'} onMouseOut={e => e.target.style.color = '#d1d5db'}>✏️</button>
                <button onClick={() => eliminarItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '14px', padding: '0 2px', lineHeight: 1 }} onMouseOver={e => e.target.style.color = '#dc2626'} onMouseOut={e => e.target.style.color = '#d1d5db'}>✕</button>
              </>
            )}
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

function getRefId(tarea) { return tarea.tarea_padre_id || tarea.id }
function getRefTipo(tarea) {
  if (tarea._tipo && tarea._tipo !== 'planner') return tarea._tipo
  if (!tarea.tarea_padre_tipo) return 'planner'
  const tipo = tarea.tarea_padre_tipo.replace('planner_', '')
  if (tipo.startsWith('proyecto')) return 'proyecto'
  if (tipo.startsWith('soporte')) return 'soporte'
  if (tipo.startsWith('direccion')) return 'direccion'
  return 'planner'
}
function getRefHoja(tarea) {
  const tipo = getRefTipo(tarea)
  if (tipo === 'proyecto') return 'tareas'
  if (tipo === 'soporte') return 'tareas_soporte'
  if (tipo === 'direccion') return 'tareas_direccion'
  return 'tareas_planner'
}

function ModalCompletarTarea({ tarea, onConfirmar, onCancelar }) {
  const now = new Date()
  const horaActual = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
  const [horaInicio, setHoraInicio] = useState(tarea.hora_inicio || '')
  const [horaFin, setHoraFin] = useState(horaActual)
  function calcularDuracion() {
    if (!horaInicio || !horaFin) return 0
    const [hI, mI] = horaInicio.split(':').map(Number)
    const [hF, mF] = horaFin.split(':').map(Number)
    return Math.max(0, ((hF * 60 + mF) - (hI * 60 + mI)) * 60)
  }
  const duracion = calcularDuracion()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '320px' }}>
        <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>✅ Completar tarea</h3>
        <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px', fontWeight: '600' }}>{tarea.nombre}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio:</label>
            <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora fin:</label>
            <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
          </div>
          {duracion > 0 && (
            <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#166534', textAlign: 'center', fontWeight: '600' }}>
              ⏱ {Math.floor(duracion/3600) > 0 ? `${Math.floor(duracion/3600)}h ` : ''}{Math.floor((duracion%3600)/60)}min registradas
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={onCancelar} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onConfirmar(horaInicio, horaFin, duracion)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Completar</button>
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>Puedes dejar las horas vacías para completar sin registrar tiempo</p>
      </div>
    </div>
  )
}

function VistaDia({ fecha, tareasConPosicion, tareasTodoDia, eventosDia, onVerDetalle, onEditarTarea, onCompletarCron, onEditarEvento, onCompletarEvento, getChecklistCount, onDblClickHora }) {
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
                  return (
                <div key={t.id} onClick={() => onVerDetalle(t)} style={{ background: col.bg, border: `2px solid ${col.border}`, borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', maxWidth: '220px' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: col.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</p>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                    <button onClick={e => { e.stopPropagation(); onCompletarCron(t, fecha) }} style={{ background: col.border, color: 'white', border: 'none', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer', fontSize: '10px' }}>✅</button>
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
            <div key={h} onDoubleClick={() => onDblClickHora && onDblClickHora(fecha, `${h.toString().padStart(2,'0')}:00`)} style={{ position: 'absolute', top: `${(h - HORA_INICIO) * ALTURA_HORA}px`, left: 0, right: 0, height: `${ALTURA_HORA}px`, borderTop: h === HORA_INICIO ? 'none' : '1px solid #f0f0f0', display: 'flex', cursor: 'crosshair' }}>
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
            const refId = tarea._tipo === 'planner' ? getRefId(tarea) : tarea.id
            const refTipo = tarea._tipo === 'planner' ? getRefTipo(tarea) : tarea._tipo
            const clCount = getChecklistCount(refId, refTipo)
            return (
              <div key={tarea.id} style={{ position: 'absolute', left: '60px', right: '8px', top: `${tarea._top}px`, height: `${Math.max(tarea._height, 40)}px`, background: col.bg, border: `2px solid ${col.border}`, borderRadius: '8px', padding: '5px 8px', overflow: 'hidden', zIndex: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p onClick={() => onVerDetalle(tarea)} style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: col.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{tarea.nombre}</p>
                  <div style={{ display: 'flex', gap: '2px', marginLeft: '4px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); onEditarTarea(tarea) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', padding: '0 1px' }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); onCompletarCron(tarea, fecha) }} style={{ background: col.border, color: 'white', border: 'none', borderRadius: '3px', padding: '1px 5px', cursor: 'pointer', fontSize: '10px' }}>✅</button>
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
  const { obtenerHoja, refrescar } = useDatos()
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')
  const [filtroVencimiento, setFiltroVencimiento] = useState('') // 'vencida' | 'proxima' | ''
  const [busqueda, setBusqueda] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const [modalEditarTarea, setModalEditarTarea] = useState(null)
  const [vistaTarea, setVistaTarea] = useState(null)
  const [modalNuevaTarea, setModalNuevaTarea] = useState(false)
  const [modalNuevoEvento, setModalNuevoEvento] = useState(false)
  const [modalEditarEvento, setModalEditarEvento] = useState(null)
  const [formTarea, setFormTarea] = useState({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', _opcionDireccionId: '', fechas_exactas: '', fecha_limite: '', etiqueta: '', asignadoA: '', _horas: 0, _minutos: 0, hora_inicio: '' })
  const [formEvento, setFormEvento] = useState({ titulo: '', descripcion: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion', _asignados: [], _tipoLigar: '', _origenId: '', _origenTipo: '', _opcionProyectoId: '', _opcionSoporteId: '', _opcionDireccionId: '' })
  const [modalCompletar, setModalCompletar] = useState(null)
  const [modalPostit, setModalPostit] = useState(false)
  const [dblClickInfo, setDblClickInfo] = useState(null)
  const [mostrarMenuDblClick, setMostrarMenuDblClick] = useState(false)

  useEffect(() => { if (accessToken && usuario) cargarDatos() }, [accessToken, usuario])
  async function cargarDatos() {
    try {
      const [t, ts, td, tp, ev, p, ep, ac, en, cs, ps, ss, cl, us] = await Promise.all([
        obtenerHoja('tareas'), obtenerHoja('tareas_soporte'), obtenerHoja('tareas_direccion'),
        obtenerHoja('tareas_planner'), obtenerHoja('eventos'), obtenerHoja('proyectos'),
        obtenerHoja('estados_proyecto'), obtenerHoja('acciones'), obtenerHoja('ensayos'),
        obtenerHoja('categorias_soporte'), obtenerHoja('proyectos_soporte'), obtenerHoja('subcarpetas_soporte'),
        obtenerHoja('checklist_items'),
        obtenerHoja('usuarios'),
      ])
      const misId = String(usuario.id)
      setTareas(t.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasSoporte(ts.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasDireccion(td.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasPlanner(tp.filter(t => String(t.usuario_id) === misId))
      setEventos(ev.filter(e => e.usuario_id && e.usuario_id.split(',').map(s => s.trim()).includes(misId)))
      setProyectos(p); setEstadosProyecto(ep); setAcciones(ac); setEnsayos(en)
      setCategoriasSoporte(cs); setProyectosSoporte(ps); setSubcarpetasSoporte(ss)
      setCategoriasDireccion(await obtenerHoja('categorias_direccion'))
      setTodasTareasProyecto(t); setTodasTareasSoporte(ts)
      const counts = {}
      cl.forEach(item => { const key = `${item.tarea_id}_${item.tipo_tarea}`; if (!counts[key]) counts[key] = { total: 0, completados: 0 }; counts[key].total++; if (item.completado === 'true') counts[key].completados++ })
      setChecklistCounts(counts)
      setUsuarios(us)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function getChecklistCount(tareaId, tipoTarea) { return checklistCounts[`${tareaId}_${tipoTarea}`] || { total: 0, completados: 0 } }

  function generarCodigo(prefijo) {
    const año = new Date().getFullYear().toString().slice(2)
    const num = String(Date.now()).slice(-4)
    return `${prefijo}${año}-${num}`
  }

  async function moverTareaDia(tarea, nuevaFecha) {
    const nuevoDia = nuevaFecha ? (getDiaSemana(nuevaFecha) || 'por_asignar') : 'por_asignar'
    const nuevasFechasStr = nuevaFecha || ''
    if (tarea._tipo === 'planner') {
      const fechasActuales = (tarea.fecha_exacta || '').split(',').map(f => f.trim()).filter(Boolean)
      const nuevasFechas = !nuevaFecha ? '' : fechasActuales.length > 1
        ? fechasActuales.map((f, i) => i === 0 ? nuevaFecha : f).join(',')
        : nuevaFecha
      await actualizarFila('tareas_planner', tarea.id, [tarea.id, tarea.usuario_id, tarea.tarea_padre_id || '', tarea.tarea_padre_tipo || '', tarea.nombre, nuevoDia, tarea.fecha_limite || '', nuevasFechas, tarea.estado, tarea.fecha_creacion, tarea.etiqueta || '', tarea.fecha_limite_original || tarea.fecha_limite || '', tarea.descripcion || '', tarea.tarea_grupo_id || '', tarea.tiempo_estimado || '', tarea.hora_inicio || '', tarea.asignados || '', tarea.creado_por || ''], accessToken)
    } else {
      await guardarFechaPersonalEnPlanner(tarea.id, tarea._tipo, nuevaFecha, usuario, accessToken, tarea.nombre)
    }
    await refrescar('tareas_planner')
    cargarDatos()
  }

  async function clonarEvento(evento) {
    const id = Date.now().toString()
    await escribirFila('eventos', [id, String(usuario.id), `${evento.titulo} (copia)`, evento.descripcion || '', evento.fecha_exacta || '', evento.hora_inicio || '', evento.hora_fin || '', evento.tipo || 'reunion', new Date().toISOString(), 'pendiente', evento.origen_id || '', evento.origen_tipo || ''], accessToken)
    await refrescar('eventos')
    cargarDatos()
  }

  async function clonarTarea(tarea) {
    const id = Date.now().toString() + String(usuario.id)
    const nombre = `${tarea.nombre} (copia)`
    const grupoIdClon = tarea.tarea_grupo_id === 'postit' ? 'postit' : ''
    const fechaClon = tarea.fecha_exacta || ''
    const diaClon = fechaClon ? (getDiaSemana(fechaClon) || 'por_asignar') : 'por_asignar'
    const padreClon = tarea.tarea_padre_id || ''
    const tipoClon = tarea.tarea_padre_tipo || ''
    await escribirFila('tareas_planner', [id, String(usuario.id), padreClon, tipoClon, nombre, diaClon, tarea.fecha_limite || '', fechaClon, 'pendiente', new Date().toISOString(), tarea.etiqueta || '', tarea.fecha_limite || '', tarea.descripcion || '', grupoIdClon, tarea.tiempo_estimado || '', '', String(usuario.id), String(usuario.id)], accessToken)
    await refrescar('tareas_planner')
    cargarDatos()
  }

  async function reactivarTarea(tarea) {
    // Leer fresco para encontrar la fila exacta
    const todasFrescas = await leerHoja('tareas_planner', accessToken)
    const filaActual = todasFrescas.find(tp => tp.id === tarea.id)
    if (!filaActual) { console.error('Fila no encontrada:', tarea.id); return }
    const fila = [
      filaActual.id, filaActual.usuario_id, filaActual.tarea_padre_id || '',
      filaActual.tarea_padre_tipo || '', filaActual.nombre,
      filaActual.dia_semana || 'por_asignar', filaActual.fecha_limite || '',
      filaActual.fecha_exacta || '', 'pendiente',
      filaActual.fecha_creacion || new Date().toISOString(),
      filaActual.etiqueta || '', filaActual.fecha_limite_original || filaActual.fecha_limite || '',
      filaActual.descripcion || '', filaActual.tarea_grupo_id || '',
      filaActual.tiempo_estimado || '', filaActual.hora_inicio || '',
      filaActual.asignados || '', filaActual.creado_por || ''
    ]
    await actualizarFila('tareas_planner', tarea.id, fila, accessToken)
    await new Promise(r => setTimeout(r, 800))
    await refrescar('tareas_planner')
    await cargarDatos()
    if (mostrarCompletadas) setMostrarCompletadas(false)
  }

  async function completarTareaConHoras(tarea, horaInicio, horaFin, duracionSegundos, diaCompletado) {
    const fechaStr = diaCompletado || tarea.fecha_exacta?.split(',')[0]?.trim() || getISODate(new Date())
    if (duracionSegundos > 0) {
      const inicioISO = horaInicio ? new Date(`${fechaStr}T${horaInicio}:00`).toISOString() : new Date().toISOString()
      const finISO = horaFin ? new Date(`${fechaStr}T${horaFin}:00`).toISOString() : new Date().toISOString()
      await escribirFila('registros', [Date.now().toString(), tarea.id, usuario.id, inicioISO, finISO, duracionSegundos, new Date().toDateString(), tarea._tipo, tarea.nombre], accessToken)
    }
    if (tarea._tipo === 'planner') {
      // Multi-día: quitar solo el día completado de fecha_exacta
      const fechas = (tarea.fecha_exacta || '').split(',').map(f => f.trim()).filter(Boolean)
      const fechasRestantes = fechas.filter(f => f !== fechaStr)
      if (fechasRestantes.length > 0) {
        // Quedan más días — solo quitar este día
        const nuevaDiaSemana = getDiaSemana(fechasRestantes[0]) || 'por_asignar'
        await actualizarFila('tareas_planner', tarea.id, [tarea.id, tarea.usuario_id, tarea.tarea_padre_id || '', tarea.tarea_padre_tipo || '', tarea.nombre, nuevaDiaSemana, tarea.fecha_limite || '', fechasRestantes.join(','), tarea.estado, tarea.fecha_creacion, tarea.etiqueta || '', tarea.fecha_limite_original || tarea.fecha_limite || '', tarea.descripcion || '', tarea.tarea_grupo_id || '', tarea.tiempo_estimado || '', tarea.hora_inicio || '', tarea.asignados || ''], accessToken)
      } else {
        // Era el único día — marcar como completada
        await actualizarEstado(tarea, 'planner', 'completada')
      }
    } else {
      await escribirFila('tareas_planner', [
        Date.now().toString(), String(usuario.id), tarea.id, tarea._tipo,
        tarea.nombre, tarea.dia_semana || 'por_asignar', tarea.fecha_limite || '',
        tarea.fecha_exacta || '', 'completada', new Date().toISOString(),
        tarea.etiqueta || '', '', '', '', tarea.tiempo_estimado || '', tarea.hora_inicio || '', String(usuario.id)
      ], accessToken)
    }
    setModalCompletar(null)
    await refrescar('tareas_planner')
    cargarDatos()
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
    await refrescar('eventos'); cargarDatos()
  }
  async function actualizarEstado(tarea, tipo, estado) {
    if (tipo === 'proyecto') await actualizarFila('tareas', tarea.id, [tarea.id, tarea.ensayo_id, tarea.accion_id, tarea.proyecto_id, tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    else if (tipo === 'soporte') await actualizarFila('tareas_soporte', tarea.id, [tarea.id, tarea.categoria_id, tarea.proyecto_soporte_id || '', tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    else if (tipo === 'direccion') await actualizarFila('tareas_direccion', tarea.id, [tarea.id, tarea.categoria_id, tarea.proyecto_direccion_id || '', tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    else await actualizarFila('tareas_planner', tarea.id, [tarea.id, tarea.usuario_id, tarea.tarea_padre_id || '', tarea.tarea_padre_tipo || '', tarea.nombre, tarea.dia_semana, tarea.fecha_limite || '', tarea.fecha_exacta || '', estado, tarea.fecha_creacion, tarea.etiqueta || '', tarea.fecha_limite_original || tarea.fecha_limite || '', tarea.descripcion || '', tarea.tarea_grupo_id || '', tarea.tiempo_estimado || '', tarea.hora_inicio || '', tarea.asignados || ''], accessToken)
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
      const creadorId = t.creado_por || t.usuario_id
      // Aplicar prefijo planner_ para evitar que la tarea sea filtrada de todasLasTareas
      const tipoPadreGuardar = ['proyecto','soporte','direccion'].includes(t.tarea_padre_tipo)
        ? 'planner_' + t.tarea_padre_tipo
        : t.tarea_padre_tipo || ''
      // Si el usuario actual sigue en la lista, actualizar su fila
      if (asignadosNuevos.includes(String(t.usuario_id))) {
        await actualizarFila('tareas_planner', t.id, [t.id, t.usuario_id, t.tarea_padre_id || '', tipoPadreGuardar, t.nombre, diaCalculado, t.fecha_limite || '', fechasExactas, t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || t.id, tiempoEstimado, t.hora_inicio || '', asignadosNuevos.join(','), creadorId], accessToken)
      } else {
        // El usuario actual se quitó a sí mismo — eliminar su fila
        await marcarEliminado('tareas_planner', t.id, accessToken)
      }
      // Gestionar filas de otros usuarios asignados
      const grupoId = t.tarea_grupo_id || t.id
      const todasPlannerFrescas = await leerHoja('tareas_planner', accessToken)
      const otrasFilas = todasPlannerFrescas.filter(tp => 
        String(tp.usuario_id) !== String(t.usuario_id) && 
        tp.id !== 'eliminado' && tp.usuario_id !== 'eliminado' &&
        !['proyecto', 'soporte', 'direccion'].includes(tp.tarea_padre_tipo) &&
        (tp.tarea_grupo_id === grupoId || tp.tarea_grupo_id === t.id || tp.id === grupoId)
      )
      for (const uid of asignadosNuevos) {
        if (uid === String(t.usuario_id)) continue
        const existe = otrasFilas.find(tp => String(tp.usuario_id) === String(uid))
        if (!existe) {
          // Añadir nueva fila para este usuario (sin tarea_padre_id para que no aparezca como subtarea)
          await escribirFila('tareas_planner', [Date.now().toString() + uid, uid, '', '', t.nombre, diaCalculado, t.fecha_limite || '', fechasExactas, t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || t.id, tiempoEstimado, t.hora_inicio || '', asignadosNuevos.join(','), creadorId], accessToken)
        } else {
          // Actualizar fila existente
          await actualizarFila('tareas_planner', existe.id, [existe.id, uid, '', '', t.nombre, diaCalculado, t.fecha_limite || '', fechasExactas, t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || '', t.descripcion || '', t.tarea_grupo_id || '', tiempoEstimado, t.hora_inicio || '', asignadosNuevos.join(','), creadorId], accessToken)
        }
      }
      // Eliminar filas de usuarios que ya no están asignados
      for (const fila of otrasFilas) {
        if (!asignadosNuevos.includes(String(fila.usuario_id))) {
          await marcarEliminado('tareas_planner', fila.id, accessToken)
        }
      }
    }
    setModalEditarTarea(null); await refrescar('tareas_planner'); cargarDatos()
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
    const tipoParaPlanner = ['proyecto','soporte','direccion'].includes(formTarea.tarea_padre_tipo)
      ? 'planner_' + formTarea.tarea_padre_tipo
      : formTarea.tarea_padre_tipo || ''
    for (const uid of asignados) {
      const id = Date.now().toString() + uid
      const tienePadrePlanner = tipoParaPlanner && tipoParaPlanner.includes('planner')
      const padreIdParaFila = tienePadrePlanner && uid !== String(usuario.id) ? '' : (formTarea.tarea_padre_id || '')
      const tipoParaFila = tienePadrePlanner && uid !== String(usuario.id) ? '' : tipoParaPlanner
      await escribirFila('tareas_planner', [id, uid, padreIdParaFila, tipoParaFila, formTarea.nombre, diaCalculado, formTarea.fecha_limite || '', fechasExactas, 'pendiente', new Date().toISOString(), formTarea.etiqueta || '', formTarea.fecha_limite || '', '', '', tiempoEstimado, formTarea.hora_inicio || '', uid, String(usuario.id)], accessToken)
    }
    setModalNuevaTarea(false)
    setFormTarea({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', _opcionDireccionId: '', fechas_exactas: '', fecha_limite: '', etiqueta: '', asignadoA: '', _horas: 0, _minutos: 0, hora_inicio: '' })
    await refrescar('tareas_planner')
    cargarDatos()
  }
  async function crearPostit(form) {
    if (!form.nombre) return
    const id = Date.now().toString() + String(usuario.id)
    const fechas = form.fechas_exactas || ''
    const primeraFecha = fechas.split(',')[0]?.trim() || ''
    const dia = primeraFecha ? (['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][new Date(primeraFecha + 'T12:00:00').getDay()]) : 'por_asignar'
    await escribirFila('tareas_planner', [id, String(usuario.id), '', '', form.nombre, dia, '', fechas, 'pendiente', new Date().toISOString(), form.etiqueta || '', '', form.descripcion || '', 'postit', '', '', String(usuario.id), String(usuario.id)], accessToken)
    await refrescar('tareas_planner')
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
      ...tareas.map(t => ({ ...t, _tipo: 'proyecto', fecha_exacta: fechaPersonalDe(t.id), estado: completadasEnPlanner.has(t.id) ? 'completada' : t.estado })),
      ...tareasSoporte.map(t => ({ ...t, _tipo: 'soporte', fecha_exacta: fechaPersonalDe(t.id), estado: completadasEnPlanner.has(t.id) ? 'completada' : t.estado })),
      ...tareasDireccion.map(t => ({ ...t, _tipo: 'direccion', fecha_exacta: fechaPersonalDe(t.id), estado: completadasEnPlanner.has(t.id) ? 'completada' : t.estado })),
      ...tareasPlanner
        .filter(t => !['proyecto', 'soporte', 'direccion'].includes(t.tarea_padre_tipo))
        .map(t => ({ ...t, _tipo: 'planner' }))
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
      if (busqueda && !t.nombre?.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (filtroVencimiento === 'vencida' && !(t.fecha_limite && new Date(t.fecha_limite) < new Date())) return false
      if (filtroVencimiento === 'proxima' && !(t.fecha_limite && !( new Date(t.fecha_limite) < new Date()) && (new Date(t.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000)) return false
      return tareaEnFecha(t, fechaStr)
    })
  }
  function tareasBacklog() {
    return todasLasTareas().filter(t => {
      if (t.estado === 'completada' && !mostrarCompletadas) return false
      if (filtroEtiqueta && !(t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(filtroEtiqueta))) return false
      if (busqueda && !t.nombre?.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (filtroVencimiento === 'vencida' && !(t.fecha_limite && new Date(t.fecha_limite) < new Date())) return false
      if (filtroVencimiento === 'proxima' && !(t.fecha_limite && !(new Date(t.fecha_limite) < new Date()) && (new Date(t.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000)) return false
      return !t.fecha_exacta || t.fecha_exacta === ''
    })
  }
  function eventosDeDia(fechaStr) { return eventos.filter(e => e.fecha_exacta === fechaStr && (mostrarCompletadas || e.estado !== 'completado')) }
  function minutosEstimadosDia(fechaStr) { return tareasDeDia(fechaStr).filter(t => t.estado !== 'completada').reduce((sum, t) => sum + (parseInt(t.tiempo_estimado) || 0), 0) }
  function getContexto(tarea) {
    if (tarea._tipo === 'proyecto') { const p = proyectos.find(p => p.id === tarea.proyecto_id); return p ? p.nombre : 'Proyecto' }
    if (tarea._tipo === 'soporte') { const c = categoriasSoporte.find(c => c.id === tarea.categoria_id); return c ? c.nombre : 'Soporte' }
    if (tarea._tipo === 'direccion') return '🏢 Dirección'
    if (tarea.tarea_padre_id && tarea.tarea_padre_tipo !== 'planner') { const padre = todasTareasProyecto.find(t => t.id === tarea.tarea_padre_id) || todasTareasSoporte.find(t => t.id === tarea.tarea_padre_id); return padre ? `↳ ${padre.nombre}` : '↳ Subtarea' }
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

  function renderTarjeta(tarea, fechaDia) {
    const refId = tarea._tipo === 'planner' ? getRefId(tarea) : tarea.id
    const refTipo = tarea._tipo === 'planner' ? getRefTipo(tarea) : tarea._tipo
    const clCount = getChecklistCount(refId, refTipo)
    return (
      <TarjetaTarea key={tarea.id + tarea._tipo} tarea={tarea} contexto={getContexto(tarea)} checklistCount={clCount}
        onVerDetalle={() => setVistaTarea(tarea)}
        onEditar={() => { const tipoLigar = tarea.tarea_padre_tipo ? tarea.tarea_padre_tipo.startsWith('proyecto') ? 'proyecto' : tarea.tarea_padre_tipo.startsWith('soporte') ? 'soporte' : '' : ''; const te = parseTiempoEstimado(tarea); const asignadosArr = tarea.asignados ? (Array.isArray(tarea.asignados) ? tarea.asignados : tarea.asignados.split(',').filter(Boolean)) : [tarea.usuario_id || '']; const fechaPersonal = ['proyecto','soporte','direccion'].includes(tarea._tipo) ? (tareasPlanner.find(tp => tp.tarea_padre_id === tarea.id && String(tp.usuario_id) === String(usuario.id))?.fecha_exacta || '') : (tarea.fecha_exacta || ''); setModalEditarTarea({ ...tarea, descripcion: getDescripcionTarea(tarea), fechas_exactas: fechaPersonal, _tipoLigar: tipoLigar, _opcionProyectoId: '', _opcionSoporteId: '', _horas: te.horas, _minutos: te.minutos, asignados: asignadosArr }) }}
        onClonar={() => clonarTarea(tarea)}
        onCompletar={(dia) => { if (tarea.tarea_grupo_id === 'postit') { completarTareaConHoras(tarea, '', '', 0, dia || fechaDia) } else { setModalCompletar({ tarea, dia: dia || fechaDia }) } }}
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
          {vistaTarea.creado_por && String(vistaTarea.creado_por) !== String(usuario.id) && (() => {
            const nombres = { '1': 'Lorenzo', '2': 'Ahlam', '3': 'Jannet' }
            const colores = { '1': '#00953B', '2': '#3b82f6', '3': '#f59e0b' }
            const color = colores[String(vistaTarea.creado_por)] || '#6b7280'
            const nombre = nombres[String(vistaTarea.creado_por)] || `Usuario ${vistaTarea.creado_por}`
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', background: '#f9fafb', borderRadius: '8px', padding: '8px 12px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', fontWeight: '700', flexShrink: 0 }}>{nombre[0]}</span>
                <span style={{ fontSize: '13px', color: '#555' }}>Creada por <strong style={{ color }}>{nombre}</strong></span>
              </div>
            )
          })()}
          {descripcion && <div style={{ marginBottom: '16px' }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Descripción:</label><p style={{ margin: 0, fontSize: '14px', color: '#373A36', background: '#f9fafb', padding: '12px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>{descripcion}</p></div>}
          {vistaTarea.tiempo_estimado && parseInt(vistaTarea.tiempo_estimado) > 0 && <div style={{ marginBottom: '16px', background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>⏳ Tiempo estimado: <strong>{formatMinutos(parseInt(vistaTarea.tiempo_estimado))}</strong></div>}
          <SeccionChecklist tareaId={refId} tipoTarea={refTipo} accessToken={accessToken} />
          <SeccionActualizaciones tareaId={refId} tipoTarea={refTipo} usuario={usuario} accessToken={accessToken} />
        </div>
        {modalEditarTarea && (
          <ModalEditarTareaComponent modalEditarTarea={modalEditarTarea} setModalEditarTarea={setModalEditarTarea}
            guardarEditarTarea={async () => { await guardarEditarTarea(); setVistaTarea({...vistaTarea, descripcion: modalEditarTarea.descripcion}) }}
            eliminarTarea={eliminarTarea} opcionesProyecto={opcionesProyecto} opcionesSoporte={opcionesSoporte} categoriasDireccion={categoriasDireccion}
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
            {mostrarBuscador && (
              <input autoFocus placeholder="Buscar tarea..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', width: '180px' }} />
            )}
            <button onClick={() => { setMostrarBuscador(p => !p); if (mostrarBuscador) setBusqueda('') }}
              style={{ background: mostrarBuscador ? '#f0fdf4' : '#f3f4f6', color: mostrarBuscador ? '#00953B' : '#6b7280', border: `1px solid ${mostrarBuscador ? '#00953B' : '#e5e7eb'}`, borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: '600', fontSize: '16px' }}>🔍</button>
            <button onClick={() => setMostrarCompletadas(prev => !prev)} style={{ background: mostrarCompletadas ? '#f0fdf4' : '#f3f4f6', color: mostrarCompletadas ? '#00953B' : '#6b7280', border: '1px solid ' + (mostrarCompletadas ? '#00953B' : '#e5e7eb'), borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{mostrarCompletadas ? '✅ Ocultar' : '☑️ Completadas'}</button>
            <button onClick={() => setModalPostit(true)} title="Post-it rápido" style={{ background: '#fbbf24', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: '700', fontSize: '16px' }}>📝</button>
            <button onClick={() => setModalNuevoEvento(true)} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>+ Evento</button>
            <button onClick={() => { setFormTarea(prev => ({ ...prev, asignadoA: String(usuario.id) })); setModalNuevaTarea(true) }} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>+ Tarea</button>
          </div>
        </div>

      </div>

      {vista !== 'dia' && (
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', marginBottom: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[{ key: '', label: 'Todas' }, { key: 'urgente', label: '🔴 Urgente' }, { key: 'importante', label: '🟡 Importante' }, { key: 'delegar', label: '🔵 Delegar' }].map(({ key, label }) => {
            const count = key === '' ? todasLasTareas().filter(t => t.estado !== 'completada').length : todasLasTareas().filter(t => t.estado !== 'completada' && t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(key)).length
            const activa = filtroEtiqueta === key
            return (
              <button key={key} onClick={() => { setFiltroEtiqueta(key); if (key === '') setFiltroVencimiento('') }} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activa ? '2px solid #00953B' : '2px solid transparent', color: activa ? '#00953B' : '#6b7280', fontWeight: activa ? '600' : '400', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-1px' }}>
                {label}
                <span style={{ background: activa ? '#00953B' : '#f3f4f6', color: activa ? 'white' : '#6b7280', borderRadius: '20px', padding: '1px 7px', fontSize: '11px', fontWeight: '600' }}>{count}</span>
              </button>
            )
          })}
          {(() => {
            const vencidas = todasLasTareas().filter(t => t.estado !== 'completada' && t.fecha_limite && new Date(t.fecha_limite) < new Date()).length
            const proximas = todasLasTareas().filter(t => t.estado !== 'completada' && t.fecha_limite && !(new Date(t.fecha_limite) < new Date()) && (new Date(t.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000).length
            return (<>
              <button onClick={() => setFiltroVencimiento(filtroVencimiento === 'vencida' ? '' : 'vencida')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: filtroVencimiento === 'vencida' ? '2px solid #dc2626' : '2px solid transparent', color: filtroVencimiento === 'vencida' ? '#dc2626' : '#6b7280', fontWeight: filtroVencimiento === 'vencida' ? '600' : '400', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-1px' }}>
                ⚠️ Vencidas <span style={{ background: filtroVencimiento === 'vencida' ? '#dc2626' : '#f3f4f6', color: filtroVencimiento === 'vencida' ? 'white' : '#6b7280', borderRadius: '20px', padding: '1px 7px', fontSize: '11px', fontWeight: '600' }}>{vencidas}</span>
              </button>
              <button onClick={() => setFiltroVencimiento(filtroVencimiento === 'proxima' ? '' : 'proxima')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: filtroVencimiento === 'proxima' ? '2px solid #92400e' : '2px solid transparent', color: filtroVencimiento === 'proxima' ? '#92400e' : '#6b7280', fontWeight: filtroVencimiento === 'proxima' ? '600' : '400', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-1px' }}>
                🕐 Próximas <span style={{ background: filtroVencimiento === 'proxima' ? '#92400e' : '#f3f4f6', color: filtroVencimiento === 'proxima' ? 'white' : '#6b7280', borderRadius: '20px', padding: '1px 7px', fontSize: '11px', fontWeight: '600' }}>{proximas}</span>
              </button>
            </>)
          })()}
        </div>
      )}

      {vista === 'semana' && (
        <DndContext sensors={sensors}
          onDragEnd={({ active, over }) => {
            if (!over || !active.data.current?.tarea) return
            const tarea = active.data.current.tarea
            const overId = over.id
            if (overId.startsWith('col_')) {
              const destino = overId.replace('col_', '')
              const fechaActual = (tarea.fecha_exacta || '').split(',')[0]?.trim()
              if (tarea._tipo === 'evento') {
                if (destino !== 'por_asignar' && destino !== fechaActual) {
                  actualizarFila('eventos', tarea.id, [tarea.id, tarea.usuario_id || '', tarea.titulo, tarea.descripcion || '', destino, tarea.hora_inicio || '', tarea.hora_fin || '', tarea.tipo || 'reunion', tarea.fecha_creacion || new Date().toISOString(), tarea.estado || '', tarea.origen_id || '', tarea.origen_tipo || ''], accessToken).then(() => { refrescar('eventos'); cargarDatos() })
                }
              } else if (destino === 'por_asignar') {
                if (fechaActual) moverTareaDia(tarea, '')
              } else if (destino !== fechaActual) {
                moverTareaDia(tarea, destino)
              }
            }
          }}>
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
                  <DroppableColumna diaFecha={fecha}>
                  <div className="column-tasks">
                    {eventosDelDia.map(ev => {
                      const completado = ev.estado === 'completado'
                      const evComoTarea = { ...ev, _tipo: 'evento', fecha_exacta: ev.fecha_exacta }
                      return (
                        <DraggableTarea key={ev.id} tarea={evComoTarea}>
                        <EventoCard ev={ev} completado={completado}
                          onEditar={() => setModalEditarEvento({ ...ev, _asignados: ev.usuario_id ? ev.usuario_id.split(',').map(s => s.trim()).filter(Boolean) : [misId] })}
                          onClonar={() => clonarEvento(ev)}
                          onCompletar={() => completarEvento(ev)}
                          onReactivar={() => actualizarEstado(ev, 'evento', 'pendiente').then(() => { refrescar('eventos'); cargarDatos() })}
                          onEliminar={() => { if(confirm('¿Eliminar evento?')) eliminarEvento(ev.id) }}
                        />
                        </DraggableTarea>
                      )
                    })}
                    {tareasDelDia.map(tarea => <DraggableTarea key={tarea.id} tarea={tarea}>{renderTarjeta(tarea, fecha)}</DraggableTarea>)}
                  </div>
                  </DroppableColumna>
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
              <DroppableColumna diaFecha="por_asignar"><div className="column-tasks">{tareasBacklog().map(tarea => <DraggableTarea key={tarea.id} tarea={tarea}>{renderTarjeta(tarea)}</DraggableTarea>)}</div></DroppableColumna>
            </div>
          </div>
        </>
        </DndContext>
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
                onVerDetalle={t => setVistaTarea(t)}
                onEditarTarea={tarea => { const tipoLigar = tarea.tarea_padre_tipo ? tarea.tarea_padre_tipo.startsWith('proyecto') ? 'proyecto' : tarea.tarea_padre_tipo.startsWith('soporte') ? 'soporte' : '' : ''; const te = parseTiempoEstimado(tarea); setModalEditarTarea({ ...tarea, descripcion: getDescripcionTarea(tarea), fechas_exactas: tarea.fecha_exacta || '', _tipoLigar: tipoLigar, _opcionProyectoId: '', _opcionSoporteId: '', _horas: te.horas, _minutos: te.minutos }) }}
                onCompletarCron={(tarea, dia) => setModalCompletar({ tarea, dia })}
                onDblClickHora={(fecha, hora) => {
                  setDblClickInfo({ fecha, hora })
                  setMostrarMenuDblClick(true)
                }}
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
          opcionesProyecto={opcionesProyecto} opcionesSoporte={opcionesSoporte} categoriasDireccion={categoriasDireccion}
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
                    <option value="">Selecciona tipo...</option><option value="proyecto">De Proyectos I+D</option><option value="soporte">De Soporte</option><option value="direccion">De Dirección</option>
                  </select>
                  {formTarea._tipoLigar === 'proyecto' && <SelectorColapsable opciones={opcionesProyecto()} valor={formTarea._opcionProyectoId || ''} onChange={opcion => setFormTarea({...formTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionProyectoId: opcion.id})} placeholder='Selecciona elemento de proyecto...' />}
                  {formTarea._tipoLigar === 'soporte' && <SelectorColapsable opciones={opcionesSoporte()} valor={formTarea._opcionSoporteId || ''} onChange={opcion => setFormTarea({...formTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionSoporteId: opcion.id})} placeholder='Selecciona elemento de soporte...' />}
                  {formTarea._tipoLigar === 'direccion' && <SelectorColapsable opciones={categoriasDireccion.map(c => ({ id: c.id, label: `🗂 ${c.nombre}`, tipo: 'direccion', realId: c.id }))} valor={formTarea._opcionDireccionId || ''} onChange={opcion => setFormTarea({...formTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: 'direccion', _opcionDireccionId: opcion.id})} placeholder='Selecciona categoría...' />}
                </div>
              )}
              <InputFechasMultiples label="Días asignados (opcional):" value={formTarea.fechas_exactas || ''} onChange={val => setFormTarea({...formTarea, fechas_exactas: val})} />
              <InputFechaPlanner label="Fecha límite (opcional):" value={formTarea.fecha_limite} onChange={val => setFormTarea({...formTarea, fecha_limite: val})} />
              <SelectorTiempoEstimado horas={formTarea._horas || 0} minutos={formTarea._minutos || 0} onChangeHoras={h => setFormTarea({...formTarea, _horas: h})} onChangeMinutos={m => setFormTarea({...formTarea, _minutos: m})} />
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio (opcional):</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="time" value={formTarea.hora_inicio || ''} onChange={e => setFormTarea({...formTarea, hora_inicio: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
                  {formTarea.hora_inicio && <button onClick={() => setFormTarea({...formTarea, hora_inicio: ''})} style={{ padding: '10px 12px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>✕</button>}
                </div>
              </div>
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

      {modalPostit && <ModalPostit onClose={() => setModalPostit(false)} onSave={(form) => crearPostit(form)} />}
      {mostrarMenuDblClick && dblClickInfo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }} onClick={() => setMostrarMenuDblClick(false)}>
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', gap: '12px' }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280', width: '100%', textAlign: 'center' }}>📅 {dblClickInfo.fecha} · ⏰ {dblClickInfo.hora}</p>
            <button onClick={() => { setMostrarMenuDblClick(false); setFormTarea(prev => ({ ...prev, fechas_exactas: dblClickInfo.fecha, hora_inicio: dblClickInfo.hora })); setModalNuevaTarea(true) }} style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: 'none', background: '#f0fdf4', color: '#00953B', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>✅ + Tarea</button>
            <button onClick={() => { setMostrarMenuDblClick(false); setFormEvento(prev => ({ ...prev, fecha_exacta: dblClickInfo.fecha, hora_inicio: dblClickInfo.hora })); setModalNuevoEvento(true) }} style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: 'none', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>🗓 + Evento</button>
          </div>
        </div>
      )}
      {modalCompletar && <ModalCompletarWrapper modalCompletar={modalCompletar} setModalCompletar={setModalCompletar} completarTareaConHoras={completarTareaConHoras} />}

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

function ModalEditarTareaComponent({ modalEditarTarea, setModalEditarTarea, guardarEditarTarea, eliminarTarea, opcionesProyecto, opcionesSoporte, categoriasDireccion, usuario, usuarios, accessToken, getRefId, getRefTipo }) {
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
                <option value="">Sin enlazar</option><option value="proyecto">De Proyectos I+D</option><option value="soporte">De Soporte</option><option value="direccion">De Dirección</option>
              </select>
              {modalEditarTarea._tipoLigar === 'proyecto' && <SelectorColapsable opciones={opcionesProyecto()} valor={modalEditarTarea._opcionProyectoId || ''} onChange={opcion => setModalEditarTarea({...modalEditarTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionProyectoId: opcion.id})} placeholder='Selecciona elemento...' />}
              {modalEditarTarea._tipoLigar === 'soporte' && <SelectorColapsable opciones={opcionesSoporte()} valor={modalEditarTarea._opcionSoporteId || ''} onChange={opcion => setModalEditarTarea({...modalEditarTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionSoporteId: opcion.id})} placeholder='Selecciona elemento...' />}
              {modalEditarTarea._tipoLigar === 'direccion' && <SelectorColapsable opciones={categoriasDireccion.map(c => ({ id: c.id, label: `🗂 ${c.nombre}`, tipo: 'direccion', realId: c.id }))} valor={modalEditarTarea._opcionDireccionId || ''} onChange={opcion => setModalEditarTarea({...modalEditarTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: 'direccion', _opcionDireccionId: opcion.id})} placeholder='Selecciona categoría...' />}
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

function SelectorColapsable({ opciones, valor, onChange, placeholder }) {
  const [expandidos, setExpandidos] = useState({})
  const [seleccionado, setSeleccionado] = useState(null)

  // Detectar niveles por el número de espacios al inicio del label
  function getNivel(label) {
    const match = label.match(/^(\s*)/)
    return match ? Math.floor(match[1].length / 2) : 0
  }

  // Construir árbol colapsable
  function esContenedor(op) {
    return !op.label.includes('✅')
  }

  function toggleExpandido(id) {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleSelect(op) {
    setSeleccionado(op)
    onChange(op)
  }

  // Mostrar solo los items cuyo padre está expandido
  const itemsVisibles = []
  const pila = [] // stack de padres
  for (let i = 0; i < opciones.length; i++) {
    const op = opciones[i]
    const nivel = getNivel(op.label)
    // Ajustar pila al nivel actual
    while (pila.length > nivel) pila.pop()
    // Verificar si todos los padres están expandidos
    const visible = pila.every(p => expandidos[p.id])
    if (visible) itemsVisibles.push({ ...op, nivel })
    // Si es contenedor, añadir a la pila
    if (esContenedor(op)) pila.push(op)
  }

  const selLabel = seleccionado ? seleccionado.label.trim() : (valor ? (opciones.find(o => o.id === valor)?.label?.trim() || placeholder) : placeholder)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', background: 'white', cursor: 'pointer', color: seleccionado || valor ? '#373A36' : '#9ca3af', maxHeight: '200px', overflowY: 'auto' }}>
        {itemsVisibles.length === 0 && <div style={{ color: '#9ca3af', padding: '4px 0' }}>{placeholder}</div>}
        {itemsVisibles.map(op => {
          const esConten = esContenedor(op)
          const expandido = expandidos[op.id]
          const seleccionadoId = seleccionado?.id || valor
          return (
            <div key={op.id}
              onClick={() => esConten ? toggleExpandido(op.id) : handleSelect(op)}
              style={{
                padding: '6px 8px',
                paddingLeft: `${op.nivel * 16 + 8}px`,
                cursor: 'pointer',
                borderRadius: '6px',
                background: seleccionadoId === op.id ? '#f0fdf4' : 'transparent',
                color: seleccionadoId === op.id ? '#00953B' : '#373A36',
                fontWeight: seleccionadoId === op.id ? '600' : '400',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseOver={e => { if (seleccionadoId !== op.id) e.currentTarget.style.background = '#f9fafb' }}
              onMouseOut={e => { if (seleccionadoId !== op.id) e.currentTarget.style.background = 'transparent' }}
            >
              {esConten && <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>{expandido ? '▼' : '▶'}</span>}
              <span>{op.label.trim()}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DraggableTarea({ tarea, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarea.id + '_' + (tarea._tipo || 'planner'), data: { tarea } })
  const style = { transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, opacity: isDragging ? 0.5 : 1, cursor: isDragging ? 'grabbing' : 'grab' }
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  )
}

function DroppableColumna({ diaFecha, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'col_' + diaFecha })
  return <div ref={setNodeRef} style={{ flex: 1, minHeight: '100px', background: isOver ? 'rgba(0,149,59,0.05)' : 'transparent', borderRadius: '8px', transition: 'background 0.15s' }}>{children}</div>
}

function EventoCard({ ev, completado, onEditar, onClonar, onCompletar, onReactivar, onEliminar }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  return (
    <div style={{ position: 'relative', marginBottom: '6px', zIndex: menuAbierto ? 50 : 'auto' }}>
      <div style={{ background: completado ? '#ede9fe' : '#f5f3ff', borderLeft: `4px solid ${completado ? '#a78bfa' : '#7c3aed'}`, borderRadius: '8px', padding: '8px 10px', paddingRight: '36px', opacity: completado ? 0.8 : 1 }}>
        <div onClick={onEditar} style={{ cursor: 'pointer' }}>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#7c3aed', textDecoration: completado ? 'line-through' : 'none' }}>🗓 {ev.titulo}</p>
          {ev.hora_inicio && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>{ev.hora_inicio}{ev.hora_fin ? ` — ${ev.hora_fin}` : ''}</p>}
          <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#a78bfa' }}>{ev.tipo}</p>
        </div>
      </div>
      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10 }}>
        <button onClick={e => { e.stopPropagation(); setMenuAbierto(p => !p) }}
          style={{ background: 'white', border: '1px solid #ddd8fe', borderRadius: '6px', padding: '2px 7px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', color: '#7c3aed', lineHeight: 1.4, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>···</button>
        {menuAbierto && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '140px', padding: '4px 0', marginTop: '4px' }}>
            <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); onEditar() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}>✏️ Editar</button>
            <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); onClonar() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}>⧉ Clonar</button>
            <div style={{ borderTop: '1px solid #f3f4f6', margin: '2px 0' }} />
            {!completado ? (
              <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); onCompletar() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#00953B', fontWeight: '600', textAlign: 'left' }}>✅ Completar</button>
            ) : (
              <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); onEliminar() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#dc2626', textAlign: 'left' }}>🗑 Eliminar</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TarjetaTarea({ tarea, contexto, checklistCount, onVerDetalle, onEditar, onClonar, onCompletar, onReactivar }) {
  const esCompletada = tarea.estado === 'completada'
  const esPostit = tarea.tarea_grupo_id === 'postit'
  const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && !esCompletada
  const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000
  const minEstimados = parseInt(tarea.tiempo_estimado) || 0
  const [menuAbierto, setMenuAbierto] = useState(false)
  return (
    <div style={{ position: 'relative', zIndex: menuAbierto ? 50 : 'auto' }}>
      <div className={`tarea-card ${esCompletada ? 'completada' : ''}`} style={{ borderLeft: `4px solid ${esPostit ? '#fbbf24' : vencida ? '#dc2626' : proxima ? '#f59e0b' : tarea._tipo === 'soporte' ? '#3b82f6' : tarea._tipo === 'direccion' ? '#7c3aed' : tarea._tipo === 'planner' ? '#8b5cf6' : '#00953B'}`, background: esPostit ? '#fef9c3' : esCompletada ? '#f9fafb' : 'white', paddingRight: '36px' }}>
        <p onClick={onVerDetalle} className={`tarea-nombre ${esCompletada ? 'tachado' : ''}`} style={{ cursor: 'pointer', margin: 0 }}>{tarea.nombre}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: tarea._tipo === 'soporte' ? '#eff6ff' : tarea._tipo === 'direccion' ? '#f5f3ff' : tarea._tipo === 'planner' ? '#f5f3ff' : '#f0fdf4', color: tarea._tipo === 'soporte' ? '#1d4ed8' : tarea._tipo === 'direccion' ? '#7c3aed' : tarea._tipo === 'planner' ? '#7c3aed' : '#00953B', fontWeight: '600' }}>{contexto}</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: esCompletada ? '#dcfce7' : '#f3f4f6', color: esCompletada ? '#166534' : '#6b7280', fontWeight: '600' }}>{esCompletada ? 'Completada' : 'Pendiente'}</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <EtiquetasBadge etiqueta={tarea.etiqueta} />
          {tarea.fecha_limite && <span style={{ fontSize: '10px', color: vencida ? '#dc2626' : proxima ? '#92400e' : '#6b7280', background: vencida ? '#fee2e2' : proxima ? '#fef3c7' : '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontWeight: vencida || proxima ? '700' : '400' }}>{vencida ? '⚠️ Vencida' : proxima ? '🕐 Vence pronto' : '📅'} {!vencida && !proxima && tarea.fecha_limite}</span>}
          {minEstimados > 0 && !esCompletada && <span style={{ fontSize: '10px', color: '#6b7280', background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px' }}>⏳ {formatMinutos(minEstimados)}</span>}
          {checklistCount && checklistCount.total > 0 && <span style={{ fontSize: '10px', color: checklistCount.completados === checklistCount.total ? '#166534' : '#6b7280', background: checklistCount.completados === checklistCount.total ? '#dcfce7' : '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>☑️ {checklistCount.completados}/{checklistCount.total}</span>}
        </div>
      </div>
      <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 10 }}>
        <button onClick={e => { e.stopPropagation(); setMenuAbierto(p => !p) }}
          style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', color: '#6b7280', lineHeight: 1.4, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>···</button>
        {menuAbierto && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 200, minWidth: '140px', padding: '4px 0', marginTop: '4px' }}>
            <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); onEditar() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}>✏️ Editar</button>
            <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); onClonar && onClonar() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', textAlign: 'left' }}>⧉ Clonar</button>
            <div style={{ borderTop: '1px solid #f3f4f6', margin: '2px 0' }} />
            {!esCompletada ? (
              <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); onCompletar() }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#00953B', fontWeight: '600', textAlign: 'left' }}>✅ Completar</button>
            ) : (
              <button onClick={e => { e.stopPropagation(); setMenuAbierto(false); if(confirm('¿Eliminar esta tarea?')) eliminarTarea(tarea) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#dc2626', textAlign: 'left' }}>🗑 Eliminar</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


function ModalPostit({ onClose, onSave }) {
  const [form, setForm] = useState({ nombre: '', fechas_exactas: '', etiqueta: '' })
  const [inputFecha, setInputFecha] = useState('')
  const fechas = form.fechas_exactas ? form.fechas_exactas.split(',').filter(Boolean) : []
  function agregarFecha() { if (!inputFecha || fechas.includes(inputFecha)) return; setForm({...form, fechas_exactas: [...fechas, inputFecha].sort().join(',')}); setInputFecha('') }
  function quitarFecha(f) { setForm({...form, fechas_exactas: fechas.filter(x => x !== f).join(',')}) }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fef9c3', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '380px', boxShadow: '4px 4px 20px rgba(0,0,0,0.2)', border: '2px solid #fbbf24' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '20px' }}>📝</span>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#92400e' }}>Nota rápida</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input placeholder="¿Qué tienes en mente? *" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
            autoFocus style={{ padding: '10px', borderRadius: '8px', border: '1px solid #fbbf24', fontSize: '14px', background: '#fffbeb' }} />
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', display: 'block', marginBottom: '6px' }}>Fecha (opcional):</label>
            {fechas.length > 0 && <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>{fechas.map(f => <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fbbf24', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', color: 'white', fontWeight: '600' }}>📅 {f} <button onClick={() => quitarFecha(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '12px', padding: 0, lineHeight: 1 }}>✕</button></span>)}</div>}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="date" value={inputFecha} onChange={e => setInputFecha(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #fbbf24', fontSize: '13px', background: '#fffbeb' }} />
              <button onClick={agregarFecha} style={{ padding: '8px 12px', borderRadius: '8px', background: '#fbbf24', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700' }}>+</button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', display: 'block', marginBottom: '6px' }}>Prioridad:</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['urgente','🔴'],['importante','🟡'],['delegar','🔵']].map(([key,emoji]) => {
                const activa = (form.etiqueta||'').includes(key)
                return <button key={key} onClick={() => { const lista = (form.etiqueta||'').split(',').filter(Boolean); const nuevo = activa ? lista.filter(e=>e!==key) : [...lista,key]; setForm({...form, etiqueta: nuevo.join(',')}) }} style={{ padding: '4px 10px', borderRadius: '20px', border: `2px solid ${activa ? '#92400e' : '#fbbf24'}`, background: activa ? '#fbbf24' : '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{emoji} {key}</button>
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #fbbf24', background: '#fffbeb', cursor: 'pointer', color: '#92400e' }}>Cancelar</button>
          <button onClick={() => { onSave(form); onClose() }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#fbbf24', color: 'white', cursor: 'pointer', fontWeight: '700' }}>✓ Guardar</button>
        </div>
      </div>
    </div>
  )
}

function ModalCompletarWrapper({ modalCompletar, setModalCompletar, completarTareaConHoras }) {
  if (!modalCompletar) return null
  return <ModalCompletarTarea tarea={modalCompletar.tarea} onCancelar={() => setModalCompletar(null)} onConfirmar={(hi, hf, dur) => completarTareaConHoras(modalCompletar.tarea, hi, hf, dur, modalCompletar.dia)} />
}

export default Planner
