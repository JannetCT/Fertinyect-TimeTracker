import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado } from '../services/googleSheets'

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' }
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const USUARIOS_EQUIPO = [
  { id: '1', nombre: 'Lorenzo' },
  { id: '2', nombre: 'Ahlam' },
  { id: '3', nombre: 'Jannet' },
]

function formatTiempo(s) {
  return `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
}

function getLunesDeSemana(fecha) {
  const d = new Date(fecha)
  d.setHours(12, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function getISODate(fecha) {
  return fecha.toISOString().split('T')[0]
}

function getDiaSemana(fechaStr) {
  if (!fechaStr) return null
  const d = new Date(fechaStr + 'T12:00:00')
  const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
  return dias[d.getDay()]
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
        <input
          placeholder="Etiqueta personalizada..."
          value={inputCustom}
          onChange={e => setInputCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && inputCustom.trim()) { onChange(toggleEtiqueta(etiqueta, inputCustom.trim())); setInputCustom('') }}}
          style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }}
        />
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

function Planner() {
  const { usuario, accessToken } = useAuth()
  const [semanaBase, setSemanaBase] = useState(() => getLunesDeSemana(new Date()))
  const [vista, setVista] = useState('semana')
  const [mesBase, setMesBase] = useState(() => new Date())
  const [tareas, setTareas] = useState([])
  const [tareasSoporte, setTareasSoporte] = useState([])
  const [tareasPlanner, setTareasPlanner] = useState([])
  const [eventos, setEventos] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [estadosProyecto, setEstadosProyecto] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [categoriasSoporte, setCategoriasSoporte] = useState([])
  const [proyectosSoporte, setProyectosSoporte] = useState([])
  const [subcarpetasSoporte, setSubcarpetasSoporte] = useState([])
  const [todasTareasProyecto, setTodasTareasProyecto] = useState([])
  const [todasTareasSoporte, setTodasTareasSoporte] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false)
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')
  const [modalEditarTarea, setModalEditarTarea] = useState(null)
  const [modalNuevaTarea, setModalNuevaTarea] = useState(false)
  const [modalNuevoEvento, setModalNuevoEvento] = useState(false)
  const [modalEditarEvento, setModalEditarEvento] = useState(null)
  const [formTarea, setFormTarea] = useState({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', fecha_exacta: '', fecha_limite: '', etiqueta: '', asignadoA: '' })
  const [formEvento, setFormEvento] = useState({ titulo: '', descripcion: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion' })
  const [cronActivo, setCronActivo] = useState(() => {
    try {
      const saved = localStorage.getItem('fertinyect_cron')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [tiempoActual, setTiempoActual] = useState(0)
  const intervalRef = useRef(null)

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
      const [t, ts, tp, ev, p, ep, ac, en, cs, ps, ss] = await Promise.all([
        leerHoja('tareas', accessToken),
        leerHoja('tareas_soporte', accessToken),
        leerHoja('tareas_planner', accessToken),
        leerHoja('eventos', accessToken),
        leerHoja('proyectos', accessToken),
        leerHoja('estados_proyecto', accessToken),
        leerHoja('acciones', accessToken),
        leerHoja('ensayos', accessToken),
        leerHoja('categorias_soporte', accessToken),
        leerHoja('proyectos_soporte', accessToken),
        leerHoja('subcarpetas_soporte', accessToken),
      ])
      const misId = String(usuario.id)
      setTareas(t.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasSoporte(ts.filter(t => t.asignados && t.asignados.split(',').map(s => s.trim()).includes(misId)))
      setTareasPlanner(tp.filter(t => String(t.usuario_id) === misId))
      setEventos(ev.filter(e => e.usuario_id === misId))
      setProyectos(p)
      setEstadosProyecto(ep)
      setAcciones(ac)
      setEnsayos(en)
      setCategoriasSoporte(cs)
      setProyectosSoporte(ps)
      setSubcarpetasSoporte(ss)
      setTodasTareasProyecto(t)
      setTodasTareasSoporte(ts)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function iniciarCronometro(tarea) {
    if (cronActivo) pausarYGuardar()
    const nuevo = { tareaId: tarea.id, tipo: tarea._tipo, nombre: tarea.nombre, inicio: Date.now(), acumulado: 0 }
    setCronActivo(nuevo)
    localStorage.setItem('fertinyect_cron', JSON.stringify(nuevo))
    setTiempoActual(0)
  }

  async function pausarYGuardar() {
    if (!cronActivo?.inicio) return
    const elapsed = Math.floor((Date.now() - cronActivo.inicio) / 1000)
    const nuevo = { ...cronActivo, acumulado: cronActivo.acumulado + elapsed, inicio: null }
    setCronActivo(nuevo)
    localStorage.setItem('fertinyect_cron', JSON.stringify(nuevo))
    // Guardar tramo parcial en registros
    const fin = new Date().toISOString()
    const inicio = new Date(Date.now() - elapsed * 1000).toISOString()
    await escribirFila('registros', [Date.now().toString(), cronActivo.tareaId, usuario.id, inicio, fin, elapsed, new Date().toDateString(), cronActivo.tipo, cronActivo.nombre], accessToken)
  }

function reanudarCronometro() {
    const nuevo = { ...cronActivo, inicio: Date.now() }
    setCronActivo(nuevo)
    localStorage.setItem('fertinyect_cron', JSON.stringify(nuevo))
  }

  async function detenerCronometro(completar = false) {
    if (!cronActivo) return
    const elapsed = cronActivo.inicio ? Math.floor((Date.now() - cronActivo.inicio) / 1000) : 0
    // Solo guardar tramo final si había tiempo corriendo (no ya guardado en pausa)
    if (elapsed > 0) {
      const fin = new Date().toISOString()
      const inicio = new Date(Date.now() - elapsed * 1000).toISOString()
      await escribirFila('registros', [Date.now().toString(), cronActivo.tareaId, usuario.id, inicio, fin, elapsed, new Date().toDateString(), cronActivo.tipo, cronActivo.nombre], accessToken)
    }
    if (completar) {
      const allTareas = [...tareas, ...tareasSoporte, ...tareasPlanner]
      const tarea = allTareas.find(t => t.id === cronActivo.tareaId)
      if (tarea) await actualizarEstado(tarea, cronActivo.tipo, 'completada')
    }
    setCronActivo(null)
    localStorage.removeItem('fertinyect_cron')
    setTiempoActual(0)
    cargarDatos()
  }

  async function actualizarEstado(tarea, tipo, estado) {
    if (tipo === 'proyecto') {
      await actualizarFila('tareas', tarea.id, [tarea.id, tarea.ensayo_id, tarea.accion_id, tarea.proyecto_id, tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    } else if (tipo === 'soporte') {
      await actualizarFila('tareas_soporte', tarea.id, [tarea.id, tarea.categoria_id, tarea.proyecto_soporte_id || '', tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    } else {
      await actualizarFila('tareas_planner', tarea.id, [tarea.id, tarea.usuario_id, tarea.tarea_padre_id || '', tarea.tarea_padre_tipo || '', tarea.nombre, tarea.dia_semana, tarea.fecha_exacta || '', tarea.fecha_limite || '', estado, tarea.fecha_creacion, tarea.etiqueta || ''], accessToken)
    }
  }

  async function eliminarTarea(tarea) {
    if (!window.confirm(`¿Eliminar "${tarea.nombre}"?`)) return
    if (tarea._tipo === 'proyecto') {
      await marcarEliminado('tareas', tarea.id, accessToken)
    } else if (tarea._tipo === 'soporte') {
      await marcarEliminado('tareas_soporte', tarea.id, accessToken)
    } else {
      await marcarEliminado('tareas_planner', tarea.id, accessToken)
    }
    setModalEditarTarea(null)
    cargarDatos()
  }

  async function guardarEditarTarea() {
    if (!modalEditarTarea) return
    const t = modalEditarTarea
    const fechaExacta = t.fecha_exacta && t.fecha_exacta.trim() !== '' ? t.fecha_exacta : ''
    const diaCalculado = getDiaSemana(fechaExacta) || t.dia_semana || 'por_asignar'
    if (t._tipo === 'proyecto') {
      await actualizarFila('tareas', t.id, [t.id, t.ensayo_id, t.accion_id, t.proyecto_id, t.nombre, t.asignados, diaCalculado, fechaExacta, t.dia_recomendado || '', t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || ''], accessToken)
    } else if (t._tipo === 'soporte') {
      await actualizarFila('tareas_soporte', t.id, [t.id, t.categoria_id, t.proyecto_soporte_id || '', t.subcarpeta_id || '', t.nombre, t.asignados, diaCalculado, fechaExacta, t.dia_recomendado || '', t.fecha_limite || '', t.estado, t.fecha_creacion, t.etiqueta || ''], accessToken)
    } else {
      await actualizarFila('tareas_planner', t.id, [t.id, t.usuario_id, t.tarea_padre_id || '', t.tarea_padre_tipo || '', t.nombre, diaCalculado, t.fecha_limite || '', fechaExacta, t.estado, t.fecha_creacion, t.etiqueta || '', t.fecha_limite_original || t.fecha_limite || ''], accessToken)
    }
    setModalEditarTarea(null)
    cargarDatos()
  }

  async function guardarEditarEvento() {
    if (!modalEditarEvento) return
    const ev = modalEditarEvento
    await actualizarFila('eventos', ev.id, [ev.id, ev.usuario_id, ev.titulo, ev.descripcion || '', ev.fecha_exacta, ev.hora_inicio || '', ev.hora_fin || '', ev.tipo, ev.fecha_creacion], accessToken)
    setModalEditarEvento(null)
    cargarDatos()
  }

  async function eliminarEvento(eventoId) {
    await marcarEliminado('eventos', eventoId, accessToken)
    setModalEditarEvento(null)
    cargarDatos()
  }

  async function crearTareaPlanner() {
    if (!formTarea.nombre) return
    const fechaExacta = formTarea.fecha_exacta && formTarea.fecha_exacta.trim() !== '' ? formTarea.fecha_exacta : ''
    const diaCalculado = getDiaSemana(fechaExacta) || 'por_asignar'
    const misId = String(usuario.id)
    const asignados = formTarea.asignadoA ? formTarea.asignadoA.split(',').filter(Boolean) : [misId]
    for (const uid of asignados) {
      const id = Date.now().toString() + uid
      await escribirFila('tareas_planner', [id, uid, formTarea.tarea_padre_id || '', formTarea.tarea_padre_tipo || '', formTarea.nombre, diaCalculado, formTarea.fecha_limite || '', fechaExacta, 'pendiente', new Date().toISOString(), formTarea.etiqueta || '', formTarea.fecha_limite || ''], accessToken)
    }
    setModalNuevaTarea(false)
    setFormTarea({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', fecha_exacta: '', fecha_limite: '', etiqueta: '', asignadoA: '' })
    cargarDatos()
  }

  async function crearEvento() {
    if (!formEvento.titulo || !formEvento.fecha_exacta) return
    const id = Date.now().toString()
    await escribirFila('eventos', [id, usuario.id, formEvento.titulo, formEvento.descripcion, formEvento.fecha_exacta, formEvento.hora_inicio, formEvento.hora_fin, formEvento.tipo, new Date().toISOString()], accessToken)
    setModalNuevoEvento(false)
    setFormEvento({ titulo: '', descripcion: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion' })
    cargarDatos()
  }

  function todasLasTareas() {
    return [
      ...tareas.map(t => ({ ...t, _tipo: 'proyecto' })),
      ...tareasSoporte.map(t => ({ ...t, _tipo: 'soporte' })),
      ...tareasPlanner.map(t => ({ ...t, _tipo: 'planner' }))
    ]
  }

  function getDiasDeSemana(lunes) {
    return DIAS_SEMANA.map((dia, i) => {
      const d = new Date(lunes)
      d.setDate(d.getDate() + i)
      return { dia, fecha: getISODate(d), label: DIAS_LABEL[dia] }
    })
  }

  function tareasDeDia(fechaStr) {
    return todasLasTareas().filter(t => {
      if (t.estado === 'completada' && !mostrarCompletadas) return false
      if (filtroEtiqueta && !(t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(filtroEtiqueta))) return false
      return t.fecha_exacta === fechaStr
    })
  }

  function tareasBacklog() {
    return todasLasTareas().filter(t => {
      if (t.estado === 'completada' && !mostrarCompletadas) return false
      if (filtroEtiqueta && !(t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(filtroEtiqueta))) return false
      return !t.fecha_exacta || t.fecha_exacta === ''
    })
  }

  function eventosDeDia(fechaStr) {
    return eventos.filter(e => e.fecha_exacta === fechaStr)
  }

  function getContexto(tarea) {
    if (tarea._tipo === 'proyecto') {
      const p = proyectos.find(p => p.id === tarea.proyecto_id)
      return p ? p.nombre : 'Proyecto'
    } else if (tarea._tipo === 'soporte') {
      const c = categoriasSoporte.find(c => c.id === tarea.categoria_id)
      return c ? c.nombre : 'Soporte'
    } else {
      if (tarea.tarea_padre_id) {
        const padre = todasTareasProyecto.find(t => t.id === tarea.tarea_padre_id) || todasTareasSoporte.find(t => t.id === tarea.tarea_padre_id)
        return padre ? `↳ ${padre.nombre}` : '↳ Subtarea'
      }
      return '📝 Tarea libre'
    }
  }

  function getDiasDelMes() {
    const año = mesBase.getFullYear()
    const mes = mesBase.getMonth()
    const primerDia = new Date(año, mes, 1)
    const ultimoDia = new Date(año, mes + 1, 0)
    const dias = []
    const inicioSemana = new Date(primerDia)
    const diaSemana = primerDia.getDay()
    inicioSemana.setDate(primerDia.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
    for (let d = new Date(inicioSemana); d <= ultimoDia || dias.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
      dias.push({ fecha: getISODate(new Date(d)), mes: new Date(d).getMonth() === mes })
    }
    return dias
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
            todasTareasProyecto.filter(t => t.ensayo_id === ensayo.id).forEach(tarea => {
              opciones.push({ id: `tarea_${tarea.id}`, label: `        ✅ ${tarea.nombre}`, tipo: 'proyecto', realId: tarea.id })
            })
          })
          todasTareasProyecto.filter(t => t.accion_id === accion.id && !t.ensayo_id).forEach(tarea => {
            opciones.push({ id: `tarea_${tarea.id}`, label: `      ✅ ${tarea.nombre}`, tipo: 'proyecto', realId: tarea.id })
          })
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
          todasTareasSoporte.filter(t => t.subcarpeta_id === sub.id).forEach(tarea => {
            opciones.push({ id: `tarea_${tarea.id}`, label: `      ✅ ${tarea.nombre}`, tipo: 'soporte', realId: tarea.id })
          })
        })
        todasTareasSoporte.filter(t => t.proyecto_soporte_id === proy.id && !t.subcarpeta_id).forEach(tarea => {
          opciones.push({ id: `tarea_${tarea.id}`, label: `    ✅ ${tarea.nombre}`, tipo: 'soporte', realId: tarea.id })
        })
      })
      todasTareasSoporte.filter(t => t.categoria_id === cat.id && !t.proyecto_soporte_id).forEach(tarea => {
        opciones.push({ id: `tarea_${tarea.id}`, label: `  ✅ ${tarea.nombre}`, tipo: 'soporte', realId: tarea.id })
      })
    })
    return opciones
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando planner...</p></div>

  const esMobile = window.innerWidth < 768
  const diasSemana = getDiasDeSemana(semanaBase)
  const hoy = getISODate(new Date())
  const misId = String(usuario.id)

  return (
    <div className="planner-container">
      <div className="planner-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: esMobile ? 'flex-start' : 'center', justifyContent: 'space-between', width: '100%', flexDirection: esMobile ? 'column' : 'row', gap: esMobile ? '8px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0 }}>📅 Planner</h1>
            <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <button onClick={() => setVista('semana')} style={{ padding: '6px 14px', background: vista === 'semana' ? '#00953B' : 'white', color: vista === 'semana' ? 'white' : '#373A36', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Semana</button>
              <button onClick={() => setVista('mes')} style={{ padding: '6px 14px', background: vista === 'mes' ? '#00953B' : 'white', color: vista === 'mes' ? 'white' : '#373A36', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Mes</button>
            </div>
          </div>
         <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: esMobile ? 'flex-start' : 'flex-end' }}>
            <button onClick={() => setMostrarCompletadas(prev => !prev)} style={{ background: mostrarCompletadas ? '#f0fdf4' : '#f3f4f6', color: mostrarCompletadas ? '#00953B' : '#6b7280', border: '1px solid ' + (mostrarCompletadas ? '#00953B' : '#e5e7eb'), borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              {mostrarCompletadas ? '✅ Ocultar' : '☑️ Completadas'}
            </button>
            <button onClick={() => setModalNuevoEvento(true)} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>+ Evento</button>
            <button onClick={() => setModalNuevaTarea(true)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>+ Tarea</button>
          </div>
        </div>

        {cronActivo && (
          <div style={{ background: '#f0fdf4', border: '2px solid #00953B', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#373A36', fontWeight: '600' }}>⏱ {cronActivo.nombre}</span>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#00953B', fontFamily: 'monospace' }}>{formatTiempo(tiempoActual)}</span>
            {cronActivo.inicio
              ? <button onClick={pausarYGuardar} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>⏸ Pausar</button>
              : <button onClick={reanudarCronometro} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>▶️ Reanudar</button>
            }
            <button onClick={() => detenerCronometro(true)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>✅ Completar</button>
          </div>
        )}
        </div>

      {/* PESTAÑAS FILTRO */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', marginBottom: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          { key: '', label: 'Todas' },
          { key: 'urgente', label: '🔴 Urgente' },
          { key: 'importante', label: '🟡 Importante' },
          { key: 'delegar', label: '🔵 Delegar' },
        ].map(({ key, label }) => {
          const count = key === ''
            ? todasLasTareas().filter(t => t.estado !== 'completada').length
            : todasLasTareas().filter(t => t.estado !== 'completada' && t.etiqueta && t.etiqueta.split(',').map(e => e.trim()).includes(key)).length
          const activa = filtroEtiqueta === key
          return (
            <button key={key} onClick={() => setFiltroEtiqueta(key)} style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activa ? '2px solid #00953B' : '2px solid transparent',
              color: activa ? '#00953B' : '#6b7280',
              fontWeight: activa ? '600' : '400',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-1px',
            }}>
              {label}
              <span style={{
                background: activa ? '#00953B' : '#f3f4f6',
                color: activa ? 'white' : '#6b7280',
                borderRadius: '20px',
                padding: '1px 7px',
                fontSize: '11px',
                fontWeight: '600',
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

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
              return (
                <div key={dia} className="planner-column">
                  <div className="column-header" style={{ background: esHoy ? '#00953B' : undefined, borderRadius: esHoy ? '8px' : undefined }}>
                    <div>
                      <h3 style={{ color: esHoy ? 'white' : undefined }}>{label}</h3>
                      <span style={{ fontSize: '11px', opacity: 0.8, color: esHoy ? 'white' : undefined }}>{fecha}</span>
                    </div>
                    <span className="task-count" style={{ background: esHoy ? 'rgba(255,255,255,0.3)' : undefined, color: esHoy ? 'white' : undefined }}>{tareasDelDia.length + eventosDelDia.length}</span>
                  </div>
                  <div className="column-tasks">
                    {eventosDelDia.map(ev => (
                      <div key={ev.id} onClick={(e) => { e.stopPropagation(); setModalEditarEvento({ ...ev, titulo: ev.titulo || '', descripcion: ev.descripcion || '', fecha_exacta: ev.fecha_exacta || '', hora_inicio: ev.hora_inicio || '', hora_fin: ev.hora_fin || '', tipo: ev.tipo || 'reunion' }) }}
                        style={{ background: '#f5f3ff', borderLeft: '4px solid #7c3aed', borderRadius: '8px', padding: '8px 10px', marginBottom: '6px', cursor: 'pointer' }}
                        onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                        onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: '#7c3aed' }}>🗓 {ev.titulo}</p>
                        {ev.hora_inicio && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>{ev.hora_inicio}{ev.hora_fin ? ` — ${ev.hora_fin}` : ''}</p>}
                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#a78bfa' }}>{ev.tipo}</p>
                      </div>
                    ))}
                    {tareasDelDia.map(tarea => (
                      <TarjetaTarea key={tarea.id + tarea._tipo} tarea={tarea} contexto={getContexto(tarea)}
                        onEditar={() => {
  const tipoLigar = tarea.tarea_padre_tipo
    ? tarea.tarea_padre_tipo.startsWith('proyecto') ? 'proyecto'
    : tarea.tarea_padre_tipo.startsWith('soporte') ? 'soporte' : ''
    : ''
  const opcionProyecto = tipoLigar === 'proyecto'
    ? opcionesProyecto().find(o => o.realId === tarea.tarea_padre_id && o.tipo === tarea.tarea_padre_tipo)
    : null
  const opcionSoporte = tipoLigar === 'soporte'
    ? opcionesSoporte().find(o => o.realId === tarea.tarea_padre_id && o.tipo === tarea.tarea_padre_tipo)
    : null
  setModalEditarTarea({
    ...tarea,
    _tipoLigar: tipoLigar,
    _opcionProyectoId: opcionProyecto?.id || '',
    _opcionSoporteId: opcionSoporte?.id || '',
  })
}} onIniciar={() => iniciarCronometro(tarea)}
                        onPausar={pausarYGuardar}
                        onReanudar={reanudarCronometro}
                        activa={cronActivo?.tareaId === tarea.id} pausada={cronActivo?.tareaId === tarea.id && !cronActivo?.inicio}
                        tiempoActual={cronActivo?.tareaId === tarea.id ? tiempoActual : 0} />
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="planner-column backlog">
              <div className="column-header">
                <h3>📥 Por asignar</h3>
                <span className="task-count">{tareasBacklog().length}</span>
              </div>
              <div className="column-tasks">
                {tareasBacklog().map(tarea => (
                  <TarjetaTarea key={tarea.id + tarea._tipo} tarea={tarea} contexto={getContexto(tarea)}
                    onEditar={() => {
  const tipoLigar = tarea.tarea_padre_tipo
    ? tarea.tarea_padre_tipo.startsWith('proyecto') ? 'proyecto'
    : tarea.tarea_padre_tipo.startsWith('soporte') ? 'soporte' : ''
    : ''
  const opcionProyecto = tipoLigar === 'proyecto'
    ? opcionesProyecto().find(o => o.realId === tarea.tarea_padre_id && o.tipo === tarea.tarea_padre_tipo)
    : null
  const opcionSoporte = tipoLigar === 'soporte'
    ? opcionesSoporte().find(o => o.realId === tarea.tarea_padre_id && o.tipo === tarea.tarea_padre_tipo)
    : null
  setModalEditarTarea({
    ...tarea,
    _tipoLigar: tipoLigar,
    _opcionProyectoId: opcionProyecto?.id || '',
    _opcionSoporteId: opcionSoporte?.id || '',
  })
}} onIniciar={() => iniciarCronometro(tarea)}
                        onPausar={pausarYGuardar}
                        onReanudar={reanudarCronometro}
                    activa={cronActivo?.tareaId === tarea.id} pausada={cronActivo?.tareaId === tarea.id && !cronActivo?.inicio}
                    tiempoActual={cronActivo?.tareaId === tarea.id ? tiempoActual : 0} />
                ))}
              </div>
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
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
                <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {getDiasDelMes().map(({ fecha, mes }) => {
                const tareasDelDia = tareasDeDia(fecha)
                const eventosDelDia = eventosDeDia(fecha)
                const esHoy = fecha === hoy
                const total = tareasDelDia.length + eventosDelDia.length
                return (
                  <div key={fecha} onClick={() => { setSemanaBase(getLunesDeSemana(new Date(fecha + 'T12:00:00'))); setVista('semana') }}
                    style={{ minHeight: '80px', padding: '6px', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', background: esHoy ? '#f0fdf4' : mes ? 'white' : '#f9fafb', cursor: 'pointer', opacity: mes ? 1 : 0.4 }}
                    onMouseOver={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseOut={e => e.currentTarget.style.background = esHoy ? '#f0fdf4' : mes ? 'white' : '#f9fafb'}>
                    <span style={{ fontSize: '13px', fontWeight: esHoy ? '700' : '400', color: esHoy ? '#00953B' : '#373A36', display: 'block', marginBottom: '4px' }}>
                      {new Date(fecha + 'T12:00:00').getDate()}
                    </span>
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

      {/* MODAL EDITAR TAREA */}
      {modalEditarTarea && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Editar tarea</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input value={modalEditarTarea.nombre || ''} onChange={e => setModalEditarTarea({...modalEditarTarea, nombre: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              {modalEditarTarea._tipo === 'planner' && (
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Enlazar a (opcional):</label>
                  <select value={modalEditarTarea._tipoLigar || ''}
                    onChange={e => setModalEditarTarea({...modalEditarTarea, _tipoLigar: e.target.value, tarea_padre_id: '', tarea_padre_tipo: '', _opcionProyectoId: '', _opcionSoporteId: ''})}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', marginBottom: '8px' }}>
                    <option value="">Sin enlazar</option>
                    <option value="proyecto">De Proyectos I+D</option>
                    <option value="soporte">De Soporte</option>
                  </select>
                  {modalEditarTarea._tipoLigar === 'proyecto' && (
                    <select value={modalEditarTarea._opcionProyectoId || ''}
                      onChange={e => {
                        const opcion = opcionesProyecto().find(o => o.id === e.target.value)
                        if (opcion) setModalEditarTarea({...modalEditarTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionProyectoId: opcion.id})
                      }}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                      <option value="">Selecciona elemento...</option>
                      {opcionesProyecto().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                    </select>
                  )}
                  {modalEditarTarea._tipoLigar === 'soporte' && (
                    <select value={modalEditarTarea._opcionSoporteId || ''}
                      onChange={e => {
                        const opcion = opcionesSoporte().find(o => o.id === e.target.value)
                        if (opcion) setModalEditarTarea({...modalEditarTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionSoporteId: opcion.id})
                      }}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                      <option value="">Selecciona elemento...</option>
                      {opcionesSoporte().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                    </select>
                  )}
                </div>
              )}
              <InputFechaPlanner label="Fecha exacta (opcional):" value={modalEditarTarea.fecha_exacta}
                onChange={val => setModalEditarTarea({...modalEditarTarea, fecha_exacta: val})} />
              <InputFechaPlanner label="Fecha límite (opcional):" value={modalEditarTarea.fecha_limite}
                onChange={val => setModalEditarTarea({...modalEditarTarea, fecha_limite: val})} />
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Prioridad:</label>
                <BotonesPrioridad etiqueta={modalEditarTarea.etiqueta} onChange={val => setModalEditarTarea({...modalEditarTarea, etiqueta: val})} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => eliminarTarea(modalEditarTarea)}
                style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>🗑 Eliminar</button>
              <button onClick={() => setModalEditarTarea(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarEditarTarea}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EVENTO */}
      {modalEditarEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ marginBottom: '24px' }}>Editar evento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Título *" value={modalEditarEvento.titulo || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, titulo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <select value={modalEditarEvento.tipo || 'reunion'} onChange={e => setModalEditarEvento({...modalEditarEvento, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="reunion">Reunión</option>
                <option value="formacion">Formación</option>
                <option value="evento">Evento</option>
                <option value="otro">Otro</option>
              </select>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha</label>
                <input type="date" value={modalEditarEvento.fecha_exacta || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, fecha_exacta: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio</label>
                  <input type="time" value={modalEditarEvento.hora_inicio || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, hora_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora fin</label>
                  <input type="time" value={modalEditarEvento.hora_fin || ''} onChange={e => setModalEditarEvento({...modalEditarEvento, hora_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
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

      {/* MODAL NUEVA TAREA */}
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
                      <button key={u.id}
                        onClick={e => {
                          e.stopPropagation(); e.preventDefault()
                          const actual = formTarea.asignadoA ? formTarea.asignadoA.split(',').filter(Boolean) : [misId]
                          const nuevo = actual.includes(u.id) ? actual.filter(id => id !== u.id) : [...actual, u.id]
                          if (nuevo.length === 0) return
                          setFormTarea({...formTarea, asignadoA: nuevo.join(',')})
                        }}
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
                  <select value={formTarea._tipoLigar || ''} onChange={e => setFormTarea({...formTarea, _tipoLigar: e.target.value, tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: ''})}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%', marginBottom: '8px' }}>
                    <option value="">Selecciona tipo...</option>
                    <option value="proyecto">De Proyectos I+D</option>
                    <option value="soporte">De Soporte</option>
                  </select>
                  {formTarea._tipoLigar === 'proyecto' && (
                    <select value={formTarea._opcionProyectoId || ''} onChange={e => { const opcion = opcionesProyecto().find(o => o.id === e.target.value); if (opcion) setFormTarea({...formTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionProyectoId: opcion.id}) }}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                      <option value="">Selecciona elemento de proyecto...</option>
                      {opcionesProyecto().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                    </select>
                  )}
                  {formTarea._tipoLigar === 'soporte' && (
                    <select value={formTarea._opcionSoporteId || ''} onChange={e => { const opcion = opcionesSoporte().find(o => o.id === e.target.value); if (opcion) setFormTarea({...formTarea, tarea_padre_id: opcion.realId, tarea_padre_tipo: opcion.tipo, _opcionSoporteId: opcion.id}) }}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                      <option value="">Selecciona elemento de soporte...</option>
                      {opcionesSoporte().map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                    </select>
                  )}
                </div>
              )}
              <InputFechaPlanner label="Fecha exacta (opcional):" value={formTarea.fecha_exacta} onChange={val => setFormTarea({...formTarea, fecha_exacta: val})} />
              <InputFechaPlanner label="Fecha límite (opcional):" value={formTarea.fecha_limite} onChange={val => setFormTarea({...formTarea, fecha_limite: val})} />
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Prioridad:</label>
                <BotonesPrioridad etiqueta={formTarea.etiqueta} onChange={val => setFormTarea({...formTarea, etiqueta: val})} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setModalNuevaTarea(false); setFormTarea({ nombre: '', tipo: 'libre', tarea_padre_id: '', tarea_padre_tipo: '', _opcionSoporteId: '', _opcionProyectoId: '', _tipoLigar: '', fecha_exacta: '', fecha_limite: '', etiqueta: '', asignadoA: '' }) }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearTareaPlanner}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EVENTO */}
      {modalNuevoEvento && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ marginBottom: '24px' }}>Nuevo evento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Título *" value={formEvento.titulo} onChange={e => setFormEvento({...formEvento, titulo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <select value={formEvento.tipo} onChange={e => setFormEvento({...formEvento, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="reunion">Reunión</option>
                <option value="formacion">Formación</option>
                <option value="evento">Evento</option>
                <option value="otro">Otro</option>
              </select>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha *</label>
                <input type="date" value={formEvento.fecha_exacta} onChange={e => setFormEvento({...formEvento, fecha_exacta: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio</label>
                  <input type="time" value={formEvento.hora_inicio} onChange={e => setFormEvento({...formEvento, hora_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora fin</label>
                  <input type="time" value={formEvento.hora_fin} onChange={e => setFormEvento({...formEvento, hora_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
              </div>
              <textarea placeholder="Descripción (opcional)" value={formEvento.descripcion} onChange={e => setFormEvento({...formEvento, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setModalNuevoEvento(false); setFormEvento({ titulo: '', descripcion: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion' }) }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearEvento}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear evento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaTarea({ tarea, contexto, onEditar, onIniciar, onPausar, onReanudar, activa, pausada, tiempoActual }) {
  const esCompletada = tarea.estado === 'completada'
  const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && !esCompletada
  const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000

  return (
    <div className={`tarea-card ${esCompletada ? 'completada' : ''}`} style={{
      borderLeft: `4px solid ${activa ? '#00953B' : vencida ? '#dc2626' : proxima ? '#f59e0b' : tarea._tipo === 'soporte' ? '#3b82f6' : tarea._tipo === 'planner' ? '#8b5cf6' : '#00953B'}`,
      background: activa ? '#f0fdf4' : esCompletada ? '#f9fafb' : 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p onClick={onEditar} className={`tarea-nombre ${esCompletada ? 'tachado' : ''}`} style={{ cursor: 'pointer', flex: 1, margin: 0 }}>{tarea.nombre}</p>
        {!esCompletada && (
          <button onClick={e => { e.stopPropagation(); activa && !pausada ? onPausar() : pausada ? onReanudar() : onIniciar() }} style={{ background: activa && !pausada ? '#f59e0b' : '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '14px', marginLeft: '8px' }}>
            {activa && !pausada ? '⏸' : '▶️'}
          </button>
        )}
      </div>
      {activa && (
        <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '700', color: '#00953B', fontFamily: 'monospace' }}>
          ⏱ {Math.floor(tiempoActual/3600).toString().padStart(2,'0')}:{Math.floor((tiempoActual%3600)/60).toString().padStart(2,'0')}:{(tiempoActual%60).toString().padStart(2,'0')}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: tarea._tipo === 'soporte' ? '#eff6ff' : tarea._tipo === 'planner' ? '#f5f3ff' : '#f0fdf4', color: tarea._tipo === 'soporte' ? '#1d4ed8' : tarea._tipo === 'planner' ? '#7c3aed' : '#00953B', fontWeight: '600' }}>{contexto}</span>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: activa ? '#dbeafe' : esCompletada ? '#dcfce7' : '#f3f4f6', color: activa ? '#1d4ed8' : esCompletada ? '#166534' : '#6b7280', fontWeight: '600' }}>
          {activa ? 'En curso' : esCompletada ? 'Completada' : 'Pendiente'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
        <EtiquetasBadge etiqueta={tarea.etiqueta} />
        {tarea.fecha_limite && <span style={{ fontSize: '10px', color: vencida ? '#dc2626' : '#6b7280', background: vencida ? '#fee2e2' : '#f3f4f6', padding: '1px 5px', borderRadius: '4px' }}>{vencida ? '⚠️' : '📅'} {tarea.fecha_limite}</span>}
      </div>
    </div>
  )
}

export default Planner