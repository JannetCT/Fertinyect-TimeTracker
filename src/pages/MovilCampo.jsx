import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { escribirFila, actualizarFila } from '../services/googleSheets'
import { useDatos } from '../contexts/DatosContext'

const PRIORIDADES = {
  urgente:    { bg: '#fee2e2', color: '#dc2626', emoji: '🔴' },
  importante: { bg: '#fef3c7', color: '#92400e', emoji: '🟡' },
  delegar:    { bg: '#dbeafe', color: '#1d4ed8', emoji: '🔵' },
}

function toggleEtiqueta(actual, key) {
  const lista = actual ? actual.split(',').filter(e => e.trim()) : []
  const idx = lista.indexOf(key)
  if (idx >= 0) lista.splice(idx, 1)
  else lista.push(key)
  return lista.join(',')
}

function formatTiempo(s) {
  return `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
}

function getISODate(fecha) {
  const d = new Date(fecha)
  d.setHours(12,0,0,0)
  return d.toISOString().split('T')[0]
}

function getDiaSemana(fechaStr) {
  if (!fechaStr) return null
  const d = new Date(fechaStr + 'T12:00:00')
  return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()]
}

function EtiquetasBadge({ etiqueta }) {
  if (!etiqueta) return null
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
      {etiqueta.split(',').filter(e => e.trim()).map((et, i) => {
        const p = PRIORIDADES[et.toLowerCase().trim()]
        return p
          ? <span key={i} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '20px', background: p.bg, color: p.color, fontWeight: '600' }}>{p.emoji} {et}</span>
          : <span key={i} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '20px', background: '#f3f4f6', color: '#6b7280' }}>🏷 {et}</span>
      })}
    </div>
  )
}

function InputFecha({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: value ? 'white' : '#6b7280', fontSize: '16px' }}
        />
        {value && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onChange('') }}
            style={{ padding: '14px 16px', borderRadius: '12px', background: '#374151', color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '700' }}>
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// Selector de personas múltiple para vista campo (dark theme)
function SelectorPersonasCampo({ usuarios, seleccionados, onChange }) {
  return (
    <div>
      <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Asignar a</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {usuarios.map(u => {
          const activo = seleccionados.includes(String(u.id))
          return (
            <button key={u.id}
              onClick={e => {
                e.stopPropagation(); e.preventDefault()
                const uid = String(u.id)
                onChange(activo ? seleccionados.filter(id => id !== uid) : [...seleccionados, uid])
              }}
              style={{ padding: '10px 16px', borderRadius: '20px', border: '2px solid', borderColor: activo ? '#00953B' : '#374151', background: activo ? '#064e3b' : '#111827', color: activo ? '#6ee7b7' : '#9ca3af', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {u.nombre ? u.nombre.split(' ')[0] : u.id}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const FORM_NUEVA_VACIO = { nombre: '', tarea_padre_id: '', tarea_padre_tipo: '', fecha_exacta: '', fecha_limite: '', etiqueta: '', asignados: [] }
const FORM_EVENTO_VACIO = { titulo: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion', descripcion: '' }

export default function MovilCampo() {
  const { usuario, accessToken } = useAuth()
  const { obtenerHoja } = useDatos()
  const navigate = useNavigate()
  const [tareas, setTareas] = useState([])
  const [tareasSoporte, setTareasSoporte] = useState([])
  const [tareasPlanner, setTareasPlanner] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [categoriasSoporte, setCategoriasSoporte] = useState([])
  const [todasTareasProyecto, setTodasTareasProyecto] = useState([])
  const [todasTareasSoporte, setTodasTareasSoporte] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cronActivo, setCronActivo] = useState(null)
  const [tiempoActual, setTiempoActual] = useState(0)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalNueva, setModalNueva] = useState(false)
  const [modalEvento, setModalEvento] = useState(false)
  const [formNueva, setFormNueva] = useState({ ...FORM_NUEVA_VACIO, asignados: [] })
  const [formEvento, setFormEvento] = useState(FORM_EVENTO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const intervalRef = useRef(null)
  const hoy = getISODate(new Date())

  useEffect(() => { if (accessToken && usuario) cargarDatos() }, [accessToken, usuario])

  useEffect(() => {
    if (cronActivo?.inicio) {
      intervalRef.current = setInterval(() => {
        setTiempoActual(cronActivo.acumulado + Math.floor((Date.now() - cronActivo.inicio) / 1000))
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [cronActivo])

  async function cargarDatos() {
    try {
      const [t, ts, tp, p, cs, u] = await Promise.all([
        obtenerHoja('tareas'),
        obtenerHoja('tareas_soporte'),
        obtenerHoja('tareas_planner'),
        obtenerHoja('proyectos'),
        obtenerHoja('categorias_soporte'),
        obtenerHoja('usuarios'),
      ])
      const misId = String(usuario.id)
      setTareas(t.filter(x => x.asignados && x.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasSoporte(ts.filter(x => x.asignados && x.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasPlanner(tp.filter(x => String(x.usuario_id) === misId))
      setProyectos(p)
      setCategoriasSoporte(cs)
      setTodasTareasProyecto(t)
      setTodasTareasSoporte(ts)
      setUsuarios(u)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function todasLasTareas() {
    return [
      ...tareas.map(t => ({ ...t, _tipo: 'proyecto' })),
      ...tareasSoporte.map(t => ({ ...t, _tipo: 'soporte' })),
      ...tareasPlanner.map(t => ({ ...t, _tipo: 'planner' })),
    ].filter(t => t.estado !== 'completada')
  }

  const tareasHoy = todasLasTareas().filter(t => t.fecha_exacta === hoy)
  const tareasPendientes = todasLasTareas().filter(t => !t.fecha_exacta || t.fecha_exacta === '')

  function getContexto(tarea) {
    if (tarea._tipo === 'proyecto') {
      const p = proyectos.find(p => p.id === tarea.proyecto_id)
      return { label: p?.nombre || 'Proyecto', color: p?.color || '#00953B' }
    } else if (tarea._tipo === 'soporte') {
      const c = categoriasSoporte.find(c => c.id === tarea.categoria_id)
      return { label: c?.nombre || 'Soporte', color: '#3b82f6' }
    }
    return { label: '📝 Personal', color: '#8b5cf6' }
  }

  function iniciarCronometro(tarea) {
    if (cronActivo?.inicio) pausarCronometro()
    setCronActivo({ tareaId: tarea.id, tipo: tarea._tipo, nombre: tarea.nombre, inicio: Date.now(), acumulado: 0 })
    setTiempoActual(0)
  }

  function pausarCronometro() {
    if (!cronActivo?.inicio) return
    const elapsed = Math.floor((Date.now() - cronActivo.inicio) / 1000)
    setCronActivo(prev => ({ ...prev, acumulado: prev.acumulado + elapsed, inicio: null }))
  }

  function reanudarCronometro() {
    setCronActivo(prev => ({ ...prev, inicio: Date.now() }))
  }

  async function completarCronometro() {
    if (!cronActivo) return
    const elapsed = cronActivo.inicio ? Math.floor((Date.now() - cronActivo.inicio) / 1000) : 0
    const total = cronActivo.acumulado + elapsed
    const fin = new Date().toISOString()
    const inicio = new Date(Date.now() - total * 1000).toISOString()
    await escribirFila('registros', [Date.now().toString(), cronActivo.tareaId, usuario.id, inicio, fin, total, new Date().toDateString(), cronActivo.tipo, cronActivo.nombre], accessToken)
    const tarea = todasLasTareas().find(t => t.id === cronActivo.tareaId)
    if (tarea) await guardarEstado(tarea, 'completada')
    setCronActivo(null)
    setTiempoActual(0)
    cargarDatos()
  }

  async function guardarEstado(tarea, estado) {
    if (tarea._tipo === 'proyecto') {
      await actualizarFila('tareas', tarea.id, [tarea.id, tarea.ensayo_id, tarea.accion_id, tarea.proyecto_id, tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    } else if (tarea._tipo === 'soporte') {
      await actualizarFila('tareas_soporte', tarea.id, [tarea.id, tarea.categoria_id, tarea.proyecto_soporte_id || '', tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    } else {
      await actualizarFila('tareas_planner', tarea.id, [tarea.id, tarea.usuario_id, tarea.tarea_padre_id || '', tarea.tarea_padre_tipo || '', tarea.nombre, tarea.dia_semana, tarea.fecha_exacta || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    }
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    setGuardando(true)
    const t = modalEditar
    const fechaExacta = t.fecha_exacta && t.fecha_exacta.trim() !== '' ? t.fecha_exacta : ''
    const diaCalculado = getDiaSemana(fechaExacta) || 'por_asignar'

    // Convertir asignados array a string
    const asignadosStr = Array.isArray(t._asignados) ? t._asignados.join(',') : (t.asignados || '')

    if (t._tipo === 'proyecto') {
      await actualizarFila('tareas', t.id, [t.id, t.ensayo_id, t.accion_id, t.proyecto_id, t.nombre, asignadosStr, diaCalculado, fechaExacta, t.dia_recomendado || '', t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || ''], accessToken)
    } else if (t._tipo === 'soporte') {
      await actualizarFila('tareas_soporte', t.id, [t.id, t.categoria_id, t.proyecto_soporte_id || '', t.subcarpeta_id || '', t.nombre, asignadosStr, diaCalculado, fechaExacta, t.dia_recomendado || '', t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || ''], accessToken)
    } else {
      // planner: usuario_id es el asignado principal (primer elemento)
      const usuarioDestino = t._asignados && t._asignados.length > 0 ? t._asignados[0] : t.usuario_id
      await actualizarFila('tareas_planner', t.id, [t.id, usuarioDestino, t.tarea_padre_id || '', t.tarea_padre_tipo || '', t.nombre, diaCalculado, fechaExacta, t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || ''], accessToken)
    }
    setModalEditar(null)
    setGuardando(false)
    cargarDatos()
  }

  async function crearTarea() {
    if (!formNueva.nombre) return
    setGuardando(true)
    const id = Date.now().toString()
    const fechaExacta = formNueva.fecha_exacta && formNueva.fecha_exacta.trim() !== '' ? formNueva.fecha_exacta : ''
    const diaCalculado = getDiaSemana(fechaExacta) || 'por_asignar'
    // Para tareas_planner: usuario_id es el primer asignado o el usuario actual
    const usuarioDestino = formNueva.asignados.length > 0 ? formNueva.asignados[0] : String(usuario.id)
    await escribirFila('tareas_planner', [id, usuarioDestino, formNueva.tarea_padre_id || '', formNueva.tarea_padre_tipo || '', formNueva.nombre, diaCalculado, fechaExacta, formNueva.fecha_limite || '', 'pendiente', new Date().toISOString(), formNueva.etiqueta || ''], accessToken)
    setModalNueva(false)
    setFormNueva({ ...FORM_NUEVA_VACIO, asignados: [] })
    setGuardando(false)
    cargarDatos()
  }

  async function eliminarTarea(tarea) {
  if (!window.confirm(`¿Eliminar "${tarea.nombre}"?`)) return
  setGuardando(true)
  const { marcarEliminado } = await import('../services/googleSheets')
  if (tarea._tipo === 'proyecto') await marcarEliminado('tareas', tarea.id, accessToken)
  else if (tarea._tipo === 'soporte') await marcarEliminado('tareas_soporte', tarea.id, accessToken)
  else await marcarEliminado('tareas_planner', tarea.id, accessToken)
  setModalEditar(null)
  setGuardando(false)
  cargarDatos()
}

  async function crearEvento() {
    if (!formEvento.titulo || !formEvento.fecha_exacta) return
    setGuardando(true)
    const id = Date.now().toString()
    await escribirFila('eventos', [id, usuario.id, formEvento.titulo, formEvento.descripcion || '', formEvento.fecha_exacta, formEvento.hora_inicio || '', formEvento.hora_fin || '', formEvento.tipo, new Date().toISOString()], accessToken)
    setModalEvento(false)
    setFormEvento(FORM_EVENTO_VACIO)
    setGuardando(false)
  }

  if (cargando) return (
    <div style={{ minHeight: '100vh', background: '#111827', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #374151', borderTopColor: '#00953B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#9ca3af', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: 'white', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', paddingBottom: '100px' }}>

      {/* HEADER */}
      <div style={{ background: '#1f2937', padding: '16px 20px', borderBottom: '1px solid #374151', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'white' }}>🌿 Vista Campo</h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>{usuario.nombre} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setModalEvento(true)} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
              + Evento
            </button>
            <button onClick={() => setModalNueva(true)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
              + Tarea
            </button>
          </div>
        </div>
      </div>

      {/* CRONÓMETRO ACTIVO */}
      {cronActivo && (
        <div style={{ margin: '16px', background: '#064e3b', border: '2px solid #00953B', borderRadius: '16px', padding: '20px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6ee7b7', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⏱ En curso</p>
          <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: 'white' }}>{cronActivo.nombre}</p>
          <div style={{ fontSize: '48px', fontWeight: '800', color: '#00953B', fontFamily: 'monospace', textAlign: 'center', margin: '8px 0 16px', letterSpacing: '2px' }}>
            {formatTiempo(tiempoActual)}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {cronActivo.inicio
              ? <button onClick={pausarCronometro} style={{ flex: 1, padding: '14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>⏸ Pausar</button>
              : <button onClick={reanudarCronometro} style={{ flex: 1, padding: '14px', background: '#00953B', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>▶ Reanudar</button>
            }
            <button onClick={completarCronometro} style={{ flex: 1, padding: '14px', background: '#065f46', color: '#6ee7b7', border: '2px solid #00953B', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>✅ Completar</button>
          </div>
        </div>
      )}

      {/* TAREAS DE HOY */}
      <div style={{ padding: '16px 16px 8px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Hoy — {tareasHoy.length} {tareasHoy.length === 1 ? 'tarea' : 'tareas'}
        </h2>
        {tareasHoy.length === 0 && (
          <div style={{ background: '#1f2937', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#6b7280' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>No hay tareas para hoy</p>
          </div>
        )}
        {tareasHoy.map(tarea => {
          const ctx = getContexto(tarea)
          const activa = cronActivo?.tareaId === tarea.id
          return (
            <TarjetaMovil key={tarea.id + tarea._tipo} tarea={tarea} ctx={ctx} activa={activa}
              pausada={activa && !cronActivo?.inicio} tiempoActual={activa ? tiempoActual : 0}
              onEditar={() => setModalEditar({
                ...tarea,
                _asignados: tarea.asignados ? tarea.asignados.split(',').map(s => s.trim()).filter(Boolean) : [String(usuario.id)]
              })}
              onIniciar={() => iniciarCronometro(tarea)}
              onPausar={pausarCronometro} onReanudar={reanudarCronometro} />
          )
        })}
      </div>

      {/* TAREAS SIN FECHA */}
      {tareasPendientes.length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📥 Por asignar — {tareasPendientes.length}
          </h2>
          {tareasPendientes.map(tarea => {
            const ctx = getContexto(tarea)
            const activa = cronActivo?.tareaId === tarea.id
            return (
              <TarjetaMovil key={tarea.id + tarea._tipo} tarea={tarea} ctx={ctx} activa={activa}
                pausada={activa && !cronActivo?.inicio} tiempoActual={activa ? tiempoActual : 0}
                onEditar={() => setModalEditar({
                  ...tarea,
                  _asignados: tarea.asignados ? tarea.asignados.split(',').map(s => s.trim()).filter(Boolean) : [String(usuario.id)]
                })}
                onIniciar={() => iniciarCronometro(tarea)}
                onPausar={pausarCronometro} onReanudar={reanudarCronometro} />
            )
          })}
        </div>
      )}

      {/* BARRA NAVEGACIÓN INFERIOR */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1f2937', borderTop: '1px solid #374151', display: 'flex', zIndex: 20 }}>
        {[
          { icon: '📅', label: 'Planner', ruta: '/planner' },
          { icon: '🗓', label: 'Calendario', ruta: '/calendario-equipo' },
          { icon: '📁', label: 'Proyectos', ruta: '/proyectos' },
          { icon: '🖥', label: 'Escritorio', ruta: '/planner' },
        ].map(({ icon, label, ruta }) => (
          <button key={label} onClick={() => navigate(ruta)}
            style={{ flex: 1, padding: '12px 4px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '20px' }}>{icon}</span>
            <span style={{ fontSize: '10px', fontWeight: '600' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* MODAL EDITAR TAREA */}
      {modalEditar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: '#1f2937', borderRadius: '20px 20px 0 0', padding: '24px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', background: '#374151', borderRadius: '2px', margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 20px', color: 'white', fontSize: '18px' }}>Editar tarea</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={modalEditar.nombre || ''} onChange={e => setModalEditar({ ...modalEditar, nombre: e.target.value })}
                placeholder="Nombre de la tarea"
                style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '16px', width: '100%' }} />

              {/* SELECTOR MÚLTIPLE DE PERSONAS */}
              <SelectorPersonasCampo
                usuarios={usuarios}
                seleccionados={modalEditar._asignados || []}
                onChange={ids => setModalEditar({ ...modalEditar, _asignados: ids })}
              />

              <InputFecha label="Fecha exacta (opcional)" value={modalEditar.fecha_exacta || ''}
                onChange={val => setModalEditar({ ...modalEditar, fecha_exacta: val })} />
              <InputFecha label="Fecha límite (opcional)" value={modalEditar.fecha_limite || ''}
                onChange={val => setModalEditar({ ...modalEditar, fecha_limite: val })} />
              <div>
                <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Prioridad</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(PRIORIDADES).map(([key, val]) => {
                    const lista = modalEditar.etiqueta ? modalEditar.etiqueta.split(',').filter(e => e.trim()) : []
                    const activa = lista.includes(key)
                    return (
                      <button key={key} onClick={e => { e.stopPropagation(); e.preventDefault(); setModalEditar({ ...modalEditar, etiqueta: toggleEtiqueta(modalEditar.etiqueta, key) }) }}
                        style={{ padding: '10px 16px', borderRadius: '20px', border: '2px solid', borderColor: activa ? val.color : '#374151', background: activa ? val.bg : '#111827', color: activa ? val.color : '#9ca3af', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                        {val.emoji} {key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>
              {modalEditar._tipo === 'planner' && (
                <div>
                  <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Ligar a (opcional)</label>
                  <select value={modalEditar.tarea_padre_tipo || ''} onChange={e => setModalEditar({ ...modalEditar, tarea_padre_tipo: e.target.value, tarea_padre_id: '' })}
                    style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '15px', width: '100%', marginBottom: '8px' }}>
                    <option value="">Sin ligar</option>
                    <option value="proyecto">De Proyectos</option>
                    <option value="soporte">De Soporte</option>
                  </select>
                  {modalEditar.tarea_padre_tipo && (
                    <select value={modalEditar.tarea_padre_id || ''} onChange={e => setModalEditar({ ...modalEditar, tarea_padre_id: e.target.value })}
                      style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '15px', width: '100%' }}>
                      <option value="">Selecciona...</option>
                      {(modalEditar.tarea_padre_tipo === 'proyecto' ? todasTareasProyecto : todasTareasSoporte)
                        .filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(String(usuario.id)))
                        .map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => eliminarTarea(modalEditar)} disabled={guardando} style={{ padding: '16px', borderRadius: '12px', border: 'none', background: '#7f1d1d', color: '#fca5a5', fontSize: '16px', cursor: 'pointer', fontWeight: '700' }}>🗑</button>
              <button onClick={() => setModalEditar(null)} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: '#9ca3af', fontSize: '16px', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={guardando} style={{ flex: 2, padding: '16px', borderRadius: '12px', border: 'none', background: '#00953B', color: 'white', fontSize: '16px', cursor: 'pointer', fontWeight: '700' }}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA TAREA */}
      {modalNueva && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: '#1f2937', borderRadius: '20px 20px 0 0', padding: '24px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', background: '#374151', borderRadius: '2px', margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 20px', color: 'white', fontSize: '18px' }}>Nueva tarea</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={formNueva.nombre} onChange={e => setFormNueva({ ...formNueva, nombre: e.target.value })}
                placeholder="Nombre de la tarea *"
                style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '16px', width: '100%' }} />

              {/* SELECTOR MÚLTIPLE DE PERSONAS */}
              <SelectorPersonasCampo
                usuarios={usuarios}
                seleccionados={formNueva.asignados}
                onChange={ids => setFormNueva({ ...formNueva, asignados: ids })}
              />

              <InputFecha label="Fecha exacta (opcional)" value={formNueva.fecha_exacta}
                onChange={val => setFormNueva({ ...formNueva, fecha_exacta: val })} />
              <InputFecha label="Fecha límite (opcional)" value={formNueva.fecha_limite}
                onChange={val => setFormNueva({ ...formNueva, fecha_limite: val })} />

              <div>
                <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Prioridad</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(PRIORIDADES).map(([key, val]) => {
                    const lista = formNueva.etiqueta ? formNueva.etiqueta.split(',').filter(e => e.trim()) : []
                    const activa = lista.includes(key)
                    return (
                      <button key={key} onClick={e => { e.stopPropagation(); e.preventDefault(); setFormNueva({ ...formNueva, etiqueta: toggleEtiqueta(formNueva.etiqueta, key) }) }}
                        style={{ padding: '10px 16px', borderRadius: '20px', border: '2px solid', borderColor: activa ? val.color : '#374151', background: activa ? val.bg : '#111827', color: activa ? val.color : '#9ca3af', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                        {val.emoji} {key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Ligar a (opcional)</label>
                <select value={formNueva.tarea_padre_tipo} onChange={e => setFormNueva({ ...formNueva, tarea_padre_tipo: e.target.value, tarea_padre_id: '' })}
                  style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '15px', width: '100%', marginBottom: '8px' }}>
                  <option value="">Sin ligar</option>
                  <option value="proyecto">De Proyectos</option>
                  <option value="soporte">De Soporte</option>
                </select>
                {formNueva.tarea_padre_tipo && (
                  <select value={formNueva.tarea_padre_id} onChange={e => setFormNueva({ ...formNueva, tarea_padre_id: e.target.value })}
                    style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '15px', width: '100%' }}>
                    <option value="">Selecciona...</option>
                    {(formNueva.tarea_padre_tipo === 'proyecto' ? todasTareasProyecto : todasTareasSoporte)
                      .filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(String(usuario.id)))
                      .map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => { setModalNueva(false); setFormNueva({ ...FORM_NUEVA_VACIO, asignados: [] }) }}
                style={{ flex: 1, padding: '16px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: '#9ca3af', fontSize: '16px', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={crearTarea} disabled={guardando || !formNueva.nombre}
                style={{ flex: 2, padding: '16px', borderRadius: '12px', border: 'none', background: formNueva.nombre ? '#00953B' : '#374151', color: 'white', fontSize: '16px', cursor: 'pointer', fontWeight: '700' }}>
                {guardando ? 'Creando...' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EVENTO */}
      {modalEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: '#1f2937', borderRadius: '20px 20px 0 0', padding: '24px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '40px', height: '4px', background: '#374151', borderRadius: '2px', margin: '0 auto 20px' }} />
            <h2 style={{ margin: '0 0 20px', color: 'white', fontSize: '18px' }}>Nuevo evento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={formEvento.titulo} onChange={e => setFormEvento({ ...formEvento, titulo: e.target.value })}
                placeholder="Título *"
                style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '16px', width: '100%' }} />
              <div>
                <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Tipo</label>
                <select value={formEvento.tipo} onChange={e => setFormEvento({ ...formEvento, tipo: e.target.value })}
                  style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '15px', width: '100%' }}>
                  <option value="reunion">Reunión</option>
                  <option value="formacion">Formación</option>
                  <option value="evento">Evento</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <InputFecha label="Fecha *" value={formEvento.fecha_exacta}
                onChange={val => setFormEvento({ ...formEvento, fecha_exacta: val })} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Hora inicio</label>
                  <input type="time" value={formEvento.hora_inicio} onChange={e => setFormEvento({ ...formEvento, hora_inicio: e.target.value })}
                    style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '16px', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Hora fin</label>
                  <input type="time" value={formEvento.hora_fin} onChange={e => setFormEvento({ ...formEvento, hora_fin: e.target.value })}
                    style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '16px', width: '100%' }} />
                </div>
              </div>
              <textarea value={formEvento.descripcion} onChange={e => setFormEvento({ ...formEvento, descripcion: e.target.value })}
                placeholder="Descripción (opcional)"
                style={{ padding: '14px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '15px', width: '100%', height: '80px', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => { setModalEvento(false); setFormEvento(FORM_EVENTO_VACIO) }}
                style={{ flex: 1, padding: '16px', borderRadius: '12px', border: '1px solid #374151', background: '#111827', color: '#9ca3af', fontSize: '16px', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={crearEvento} disabled={guardando || !formEvento.titulo || !formEvento.fecha_exacta}
                style={{ flex: 2, padding: '16px', borderRadius: '12px', border: 'none', background: formEvento.titulo && formEvento.fecha_exacta ? '#7c3aed' : '#374151', color: 'white', fontSize: '16px', cursor: 'pointer', fontWeight: '700' }}>
                {guardando ? 'Creando...' : 'Crear evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function TarjetaMovil({ tarea, ctx, activa, pausada, tiempoActual, onEditar, onIniciar, onPausar, onReanudar }) {
  const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date()
  return (
    <div style={{ background: activa ? '#064e3b' : '#1f2937', borderRadius: '14px', padding: '16px', marginBottom: '10px', borderLeft: `4px solid ${activa ? '#00953B' : vencida ? '#dc2626' : ctx.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <p onClick={onEditar} style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white', cursor: 'pointer', lineHeight: '1.3' }}>{tarea.nombre}</p>
          <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>{ctx.label}</span>
          <EtiquetasBadge etiqueta={tarea.etiqueta} />
          {tarea.fecha_limite && (
            <span style={{ fontSize: '11px', color: vencida ? '#f87171' : '#9ca3af', marginTop: '4px', display: 'block' }}>
              {vencida ? '⚠️ Vencida: ' : '📅 '}{tarea.fecha_limite}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {!activa && <button onClick={onIniciar} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 16px', fontSize: '20px', cursor: 'pointer', minWidth: '52px' }}>▶</button>}
          {activa && !pausada && <button onClick={onPausar} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 16px', fontSize: '20px', cursor: 'pointer', minWidth: '52px' }}>⏸</button>}
          {activa && pausada && <button onClick={onReanudar} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 16px', fontSize: '20px', cursor: 'pointer', minWidth: '52px' }}>▶</button>}
          <button onClick={onEditar} style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '16px', cursor: 'pointer' }}>✏️</button>
        </div>
      </div>
      {activa && (
        <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '28px', fontWeight: '800', color: '#00953B', fontFamily: 'monospace', letterSpacing: '2px' }}>
          {formatTiempo(tiempoActual)}
        </div>
      )}
    </div>
  )
}
