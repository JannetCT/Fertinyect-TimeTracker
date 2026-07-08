import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado, eliminarTareasPlanner } from '../services/googleSheets'
import { useDatos } from '../contexts/DatosContext'
import Checklist from '../components/Checklist'
import { guardarFechaPersonalEnPlanner, obtenerFechaPersonal } from '../services/plannerHelpers'

function Modal({ titulo, onClose, onSave, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px' }}>{titulo}</h2>
        {children}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onSave} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmEliminar({ nombre, onClose, onConfirm }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <p style={{ fontSize: '48px', margin: '0 0 16px' }}>⚠️</p>
        <h2 style={{ marginBottom: '8px' }}>¿Eliminar?</h2>
        <p style={{ color: '#888', marginBottom: '24px' }}>{nombre}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Eliminar</button>
        </div>
      </div>
    </div>
  )
}

function Btn({ onClick, tipo, children }) {
  const estilos = {
    editar: { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' },
    eliminar: { background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' },
    añadir: { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #c4b5fd' },
  }
  return (
    <button onClick={onClick} style={{ ...estilos[tipo], borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
      {children}
    </button>
  )
}

function Breadcrumb({ items }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888', marginBottom: '4px' }}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span style={{ margin: '0 4px' }}>›</span>}
          <span style={{ color: i === items.length - 1 ? '#373A36' : '#888' }}>{item}</span>
        </span>
      ))}
    </div>
  )
}

function InputFechasMultiples({ label, value, onChange }) {
  const [inputFecha, setInputFecha] = useState('')
  const fechas = value ? value.split(',').map(f => f.trim()).filter(Boolean) : []

  function agregarFecha() {
    if (!inputFecha) return
    if (fechas.includes(inputFecha)) return
    const nuevas = [...fechas, inputFecha].sort()
    onChange(nuevas.join(','))
    setInputFecha('')
  }

  function quitarFecha(f) {
    const nuevas = fechas.filter(x => x !== f)
    onChange(nuevas.join(','))
  }

  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>{label}</label>
      {fechas.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {fechas.map(f => (
            <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f5f3ff', border: '1px solid #7c3aed', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: '#7c3aed', fontWeight: '600' }}>
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
          style={{ padding: '10px 14px', borderRadius: '8px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>+</button>
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
    if (!texto.trim()) return
    setCargando(true)
    const id = Date.now().toString()
    await escribirFila('actualizaciones', [id, tareaId, tipoTarea, usuario.id, texto.trim(), new Date().toISOString()], accessToken)
    setTexto('')
    await cargarActualizaciones()
    setCargando(false)
  }


  async function guardarEdicion(id) {
    if (!textoEdit.trim()) return
    const act = actualizaciones.find(a => a.id === id)
    if (!act) return
    await actualizarFila('actualizaciones', id, [id, act.tarea_id, act.tipo_tarea, act.usuario_id, textoEdit.trim(), act.fecha_creacion], accessToken)
    setEditandoId(null)
    await cargarActualizaciones()
  }

  async function eliminarActualizacion(id) {
    await marcarEliminado('actualizaciones', id, accessToken)
    await cargarActualizaciones()
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '8px' }}>Actualizaciones:</label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input placeholder="Escribe una actualización..." value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && texto.trim()) añadirActualizacion() }}
          style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }} />
        <button onClick={añadirActualizacion} disabled={cargando}
          style={{ padding: '8px 14px', borderRadius: '8px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
          {cargando ? '...' : '+ Añadir'}
        </button>
      </div>
      {actualizaciones.length === 0
        ? <p style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Sin actualizaciones aún</p>
        : actualizaciones.map(a => (
          <div key={a.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px', borderLeft: '3px solid #7c3aed' }}>
            {editandoId === a.id ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={textoEdit} onChange={e => setTextoEdit(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }} />
                <button onClick={() => guardarEdicion(a.id)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                <button onClick={() => setEditandoId(null)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#f3f4f6', color: '#6b7280', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#373A36', flex: 1 }}>{a.texto}</p>
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                    <button onClick={() => { setEditandoId(a.id); setTextoEdit(a.texto) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280' }}>✏️</button>
                    <button onClick={() => eliminarActualizacion(a.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>🗑</button>
                  </div>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                  {a.usuario_id} · {new Date(a.fecha_creacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            )}
          </div>
        ))
      }
    </div>
  )
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

export default function Direccion() {
  const { usuario, accessToken } = useAuth()
  const { obtenerHoja, refrescar } = useDatos()

  const [categorias, setCategorias] = useState([])
  const [proyectosDireccion, setProyectosDireccion] = useState([])
  const [subcarpetas, setSubcarpetas] = useState([])
  const [tareas, setTareas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [tareasPlanner, setTareasPlanner] = useState([])
  const [cargando, setCargando] = useState(true)

  const [vistaCategoria, setVistaCategoria] = useState(null)
  const [vistaProyecto, setVistaProyecto] = useState(null)
  const [vistaSubcarpeta, setVistaSubcarpeta] = useState(null)
  const [vistaTarea, setVistaTarea] = useState(null)

  const [modalCategoria, setModalCategoria] = useState(false)
  const [modalProyecto, setModalProyecto] = useState(null)
  const [modalSubcarpeta, setModalSubcarpeta] = useState(null)
  const [modalTarea, setModalTarea] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [modalCompletar, setModalCompletar] = useState(null)

  const [form, setForm] = useState({ nombre: '', descripcion: '' })
  const [formTarea, setFormTarea] = useState({ nombre: '', descripcion: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '' })

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [c, p, s, t, u, tp] = await Promise.all([
        obtenerHoja('categorias_direccion'),
        obtenerHoja('proyectos_direccion'),
        obtenerHoja('subcarpetas_direccion'),
        obtenerHoja('tareas_direccion'),
        obtenerHoja('usuarios'),
        obtenerHoja('tareas_planner')
      ])
      setCategorias(c)
      setProyectosDireccion(p)
      setSubcarpetas(s)
      setTareas(t)
      setUsuarios(u)
      setTareasPlanner(tp)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function crear(hoja, fila) {
    await escribirFila(hoja, fila, accessToken)
    setModalCategoria(false)
    setModalProyecto(null)
    setModalSubcarpeta(null)
    setModalTarea(null)
    setForm({ nombre: '', descripcion: '' })
    setFormTarea({ nombre: '', descripcion: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '' })
    cargarDatos()
  }

  async function guardarEdit(hoja, fila) {
    await actualizarFila(hoja, editItem.id, fila, accessToken)
    await refrescar(hoja)
    setEditItem(null)
    setForm({ nombre: '', descripcion: '' })
    cargarDatos()
  }

  async function guardarEditTareaConFecha(fila, fechaPersonal) {
    const filaShared = [...fila]
    filaShared[7] = '' // fecha_exacta vacía en origen compartido
    await actualizarFila('tareas_direccion', editItem.id, filaShared, accessToken)
    if (fechaPersonal !== undefined) {
      await guardarFechaPersonalEnPlanner(editItem.id, 'direccion', fechaPersonal, usuario, accessToken, editItem.nombre)
    }
    setEditItem(null)
    setForm({ nombre: '', descripcion: '' })
    await refrescar('tareas_direccion')
    await refrescar('tareas_planner')
    cargarDatos()
  }

  async function crearTareaConFechaPersonal(hoja, fila, asignados, nombre, fechasExactas, tipo) {
    await escribirFila(hoja, fila, accessToken)
    if (fechasExactas && asignados.length > 0) {
      const tareaId = fila[0]
      for (const uid of asignados) {
        await guardarFechaPersonalEnPlanner(tareaId, tipo, fechasExactas, { id: uid }, accessToken, nombre)
      }
    }
    setModalCategoria(false); setModalProyecto(null); setModalSubcarpeta(null); setModalTarea(null)
    setForm({ nombre: '', descripcion: '' })
    setFormTarea({ nombre: '', descripcion: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '' })
    cargarDatos()
  }

  async function completarTareaConHoras(tarea, horaInicio, horaFin, duracionSegundos) {
    if (duracionSegundos > 0) {
      const fechaStr = new Date().toISOString().split('T')[0]
      const inicioISO = horaInicio ? new Date(`${fechaStr}T${horaInicio}:00`).toISOString() : new Date().toISOString()
      const finISO = horaFin ? new Date(`${fechaStr}T${horaFin}:00`).toISOString() : new Date().toISOString()
      await escribirFila('registros', [Date.now().toString(), tarea.id, usuario.id, inicioISO, finISO, duracionSegundos, new Date().toDateString(), 'direccion', tarea.nombre], accessToken)
    }
    await actualizarFila('tareas_direccion', tarea.id, [tarea.id, tarea.categoria_id, tarea.proyecto_direccion_id || '', tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', 'completada', tarea.fecha_creacion, tarea.etiqueta || '', tarea.fecha_limite_original || tarea.fecha_limite || '', tarea.descripcion || '', tarea.tarea_grupo_id || ''], accessToken)
    setModalCompletar(null)
    cargarDatos()
  }

  async function ejecutarEliminar() {
    if (!confirmEliminar) return
    await marcarEliminado(confirmEliminar.hoja, confirmEliminar.item.id, accessToken)
    if (confirmEliminar.hoja === 'categorias_direccion') setVistaCategoria(null)
    if (confirmEliminar.hoja === 'proyectos_direccion') setVistaProyecto(null)
    if (confirmEliminar.hoja === 'subcarpetas_direccion') setVistaSubcarpeta(null)
    if (confirmEliminar.hoja === 'tareas_direccion') {
      await eliminarTareasPlanner(confirmEliminar.item.id, accessToken)
      setVistaTarea(null)
    }
    setConfirmEliminar(null)
    cargarDatos()
  }

  function getNombre(id) {
    const u = usuarios.find(u => u.id === id)
    return u ? (u.nombre ? u.nombre.split(' ')[0] : id) : id
  }

  function proyectosDeCategoria(catId) { return proyectosDireccion.filter(p => p.categoria_id === catId).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function subcarpetasDeProyecto(pId) { return subcarpetas.filter(s => s.proyecto_direccion_id === pId).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function tareasDeSubcarpeta(sId) { return tareas.filter(t => t.subcarpeta_id === sId).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function tareasDirectasProyecto(pId) { return tareas.filter(t => t.proyecto_direccion_id === pId && !t.subcarpeta_id).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function tareasDirectasCategoria(catId) { return tareas.filter(t => t.categoria_id === catId && !t.proyecto_direccion_id).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  // VISTA TAREA DETALLE
  if (vistaTarea) {
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaTarea(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaTarea.nombre}</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn tipo="editar" onClick={() => setEditItem({...vistaTarea, _tipo: 'tarea'})}>✏️ Editar</Btn>
            <Btn tipo="eliminar" onClick={() => setConfirmEliminar({ hoja: 'tareas_direccion', item: vistaTarea })}>🗑 Eliminar</Btn>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {vistaTarea.descripcion && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Descripción:</label>
              <p style={{ margin: 0, fontSize: '14px', color: '#373A36', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>{vistaTarea.descripcion}</p>
            </div>
          )}
          <Checklist tareaId={vistaTarea.id} tipoTarea="direccion" accessToken={accessToken} />
          <SeccionActualizaciones tareaId={vistaTarea.id} tipoTarea="direccion" usuario={usuario} accessToken={accessToken} />
        </div>
        {editItem && editItem._tipo === 'tarea' && (
          <ModalEditTarea editItem={editItem} setEditItem={setEditItem} usuarios={usuarios} usuario={usuario} accessToken={accessToken} tareasPlanner={tareasPlanner}
            guardarEdit={(fila, fechaPersonal) => { guardarEditTareaConFecha(fila, fechaPersonal); setVistaTarea({...editItem}) }} />
        )}
        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  // VISTA SUBCARPETA
  if (vistaSubcarpeta) {
    const tareasAqui = tareasDeSubcarpeta(vistaSubcarpeta.id)
    const cat = categorias.find(c => c.id === vistaProyecto?.categoria_id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaSubcarpeta(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <div>
              <Breadcrumb items={[cat?.nombre, vistaProyecto?.nombre, vistaSubcarpeta.nombre].filter(Boolean)} />
              <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaSubcarpeta.nombre}</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Btn tipo="editar" onClick={() => { setEditItem({...vistaSubcarpeta, _tipo: 'subcarpeta'}); setForm({ nombre: vistaSubcarpeta.nombre, descripcion: vistaSubcarpeta.descripcion || '' }) }}>✏️ Editar</Btn>
            <Btn tipo="eliminar" onClick={() => setConfirmEliminar({ hoja: 'subcarpetas_direccion', item: vistaSubcarpeta })}>🗑 Eliminar</Btn>
            <button onClick={() => { setFormTarea(prev => ({ ...prev, asignados: usuario?.id ? [String(usuario.id)] : [] })); setModalTarea({ subcarpeta_id: vistaSubcarpeta.id, proyecto_direccion_id: vistaProyecto?.id, categoria_id: vistaProyecto?.categoria_id }) }}
              style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva tarea</button>
          </div>
        </div>
        <TareasList tareas={tareasAqui} usuarios={usuarios} getNombre={getNombre}
          onVerDetalle={t => setVistaTarea(t)}
          onEditar={t => setEditItem({...t, _tipo: 'tarea'})}
          onEliminar={t => setConfirmEliminar({ hoja: 'tareas_direccion', item: t })} />
        {modalTarea && <ModalTarea titulo="Nueva tarea" contexto={vistaSubcarpeta.nombre} formTarea={formTarea} setFormTarea={setFormTarea} usuarios={usuarios}
          onClose={() => { setModalTarea(null); setFormTarea({ nombre: '', descripcion: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '' }) }}
          onSave={() => {
            const id = Date.now().toString()
            const grupoId = Date.now().toString() + '_g'
            const diaRec = [formTarea.dia_recomendado, formTarea.fecha_recomendada].filter(Boolean).join(' ')
            crearTareaConFechaPersonal('tareas_direccion', [id, modalTarea.categoria_id || '', modalTarea.proyecto_direccion_id || '', modalTarea.subcarpeta_id || '', formTarea.nombre, formTarea.asignados.join(','), 'por_asignar', '', diaRec, formTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', formTarea.fecha_limite || '', formTarea.descripcion || '', grupoId], formTarea.asignados, formTarea.nombre, formTarea.fechas_exactas || '', 'direccion')
          }} />}
        {editItem && editItem._tipo === 'tarea' && <ModalEditTarea editItem={editItem} setEditItem={setEditItem} usuarios={usuarios} usuario={usuario} accessToken={accessToken} guardarEdit={guardarEditTareaConFecha} tareasPlanner={tareasPlanner} />}
        {editItem && editItem._tipo === 'subcarpeta' && <Modal titulo="Editar subcarpeta" onClose={() => setEditItem(null)} onSave={() => guardarEdit('subcarpetas_direccion', [editItem.id, editItem.proyecto_direccion_id, editItem.categoria_id, form.nombre, form.descripcion, editItem.fecha_creacion])}><FormNombre form={form} setForm={setForm} /></Modal>}
        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  // VISTA PROYECTO
  if (vistaProyecto) {
    const subcarpetasAqui = subcarpetasDeProyecto(vistaProyecto.id)
    const tareasDirectas = tareasDirectasProyecto(vistaProyecto.id)
    const cat = categorias.find(c => c.id === vistaProyecto.categoria_id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaProyecto(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <div>
              <Breadcrumb items={[cat?.nombre, vistaProyecto.nombre].filter(Boolean)} />
              <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaProyecto.nombre}</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Btn tipo="editar" onClick={() => { setEditItem({...vistaProyecto, _tipo: 'proyecto'}); setForm({ nombre: vistaProyecto.nombre, descripcion: vistaProyecto.descripcion || '' }) }}>✏️ Editar</Btn>
            <Btn tipo="eliminar" onClick={() => setConfirmEliminar({ hoja: 'proyectos_direccion', item: vistaProyecto })}>🗑 Eliminar</Btn>
            <Btn tipo="añadir" onClick={() => setModalSubcarpeta({ proyecto_direccion_id: vistaProyecto.id, categoria_id: vistaProyecto.categoria_id })}>+ Subcarpeta</Btn>
            <button onClick={() => { setFormTarea(prev => ({ ...prev, asignados: usuario?.id ? [String(usuario.id)] : [] })); setModalTarea({ proyecto_direccion_id: vistaProyecto.id, categoria_id: vistaProyecto.categoria_id }) }}
              style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Tarea directa</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {subcarpetasAqui.map(sub => (
            <div key={sub.id} onClick={() => setVistaSubcarpeta(sub)}
              style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7c3aed', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseOver={e => e.currentTarget.style.background = '#faf5ff'}
              onMouseOut={e => e.currentTarget.style.background = 'white'}>
              <div>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>📂 {sub.nombre}</p>
                {sub.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{sub.descripcion}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>{tareasDeSubcarpeta(sub.id).length} tareas</span>
                <span style={{ color: '#7c3aed' }}>→</span>
              </div>
            </div>
          ))}
          {tareasDirectas.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', marginBottom: '8px' }}>Tareas directas:</p>
              <TareasList tareas={tareasDirectas} usuarios={usuarios} getNombre={getNombre}
                onVerDetalle={t => setVistaTarea(t)}
                onEditar={t => setEditItem({...t, _tipo: 'tarea'})}
                onCompletar={t => setModalCompletar(t)}
                onEliminar={t => setConfirmEliminar({ hoja: 'tareas_direccion', item: t })} />
            </div>
          )}
          {subcarpetasAqui.length === 0 && tareasDirectas.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><p>Sin contenido aún.</p></div>}
        </div>
        {modalSubcarpeta && <Modal titulo="Nueva subcarpeta" onClose={() => { setModalSubcarpeta(null); setForm({ nombre: '', descripcion: '' }) }} onSave={() => { if (!form.nombre) return; const id = Date.now().toString(); crear('subcarpetas_direccion', [id, modalSubcarpeta.proyecto_direccion_id, modalSubcarpeta.categoria_id, form.nombre, form.descripcion, new Date().toISOString()]) }}><FormNombre form={form} setForm={setForm} /></Modal>}
        {modalTarea && <ModalTarea titulo="Nueva tarea directa" contexto={vistaProyecto.nombre} formTarea={formTarea} setFormTarea={setFormTarea} usuarios={usuarios}
          onClose={() => { setModalTarea(null); setFormTarea({ nombre: '', descripcion: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '' }) }}
          onSave={() => {
            const id = Date.now().toString()
            const grupoId = Date.now().toString() + '_g'
            const diaRec = [formTarea.dia_recomendado, formTarea.fecha_recomendada].filter(Boolean).join(' ')
            crearTareaConFechaPersonal('tareas_direccion', [id, modalTarea.categoria_id || '', modalTarea.proyecto_direccion_id || '', '', formTarea.nombre, formTarea.asignados.join(','), 'por_asignar', '', diaRec, formTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', formTarea.fecha_limite || '', formTarea.descripcion || '', grupoId], formTarea.asignados, formTarea.nombre, formTarea.fechas_exactas || '', 'direccion')
          }} />}
        {editItem && editItem._tipo === 'tarea' && <ModalEditTarea editItem={editItem} setEditItem={setEditItem} usuarios={usuarios} usuario={usuario} accessToken={accessToken} guardarEdit={guardarEditTareaConFecha} tareasPlanner={tareasPlanner} />}
        {editItem && editItem._tipo === 'proyecto' && <Modal titulo="Editar proyecto" onClose={() => setEditItem(null)} onSave={() => guardarEdit('proyectos_direccion', [editItem.id, editItem.categoria_id, form.nombre, form.descripcion, editItem.fecha_creacion])}><FormNombre form={form} setForm={setForm} /></Modal>}
        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  // VISTA CATEGORIA
  if (vistaCategoria) {
    const proyectosAqui = proyectosDeCategoria(vistaCategoria.id)
    const tareasDirectas = tareasDirectasCategoria(vistaCategoria.id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaCategoria(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <h1 style={{ margin: 0, fontSize: '20px' }}>🏢 {vistaCategoria.nombre}</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Btn tipo="editar" onClick={() => { setEditItem({...vistaCategoria, _tipo: 'categoria'}); setForm({ nombre: vistaCategoria.nombre, descripcion: vistaCategoria.descripcion || '' }) }}>✏️ Editar</Btn>
            <Btn tipo="eliminar" onClick={() => setConfirmEliminar({ hoja: 'categorias_direccion', item: vistaCategoria })}>🗑 Eliminar</Btn>
            <Btn tipo="añadir" onClick={() => setModalProyecto({ categoria_id: vistaCategoria.id })}>+ Proyecto</Btn>
            <button onClick={() => { setFormTarea(prev => ({ ...prev, asignados: usuario?.id ? [String(usuario.id)] : [] })); setModalTarea({ categoria_id: vistaCategoria.id }) }}
              style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Tarea directa</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {proyectosAqui.map(proy => (
            <div key={proy.id} onClick={() => setVistaProyecto(proy)}
              style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #7c3aed', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseOver={e => e.currentTarget.style.background = '#faf5ff'}
              onMouseOut={e => e.currentTarget.style.background = 'white'}>
              <div>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>📁 {proy.nombre}</p>
                {proy.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{proy.descripcion}</p>}
              </div>
              <span style={{ color: '#7c3aed' }}>→</span>
            </div>
          ))}
          {tareasDirectas.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', marginBottom: '8px' }}>Tareas directas:</p>
              <TareasList tareas={tareasDirectas} usuarios={usuarios} getNombre={getNombre}
                onVerDetalle={t => setVistaTarea(t)}
                onEditar={t => setEditItem({...t, _tipo: 'tarea'})}
                onCompletar={t => setModalCompletar(t)}
                onEliminar={t => setConfirmEliminar({ hoja: 'tareas_direccion', item: t })} />
            </div>
          )}
          {proyectosAqui.length === 0 && tareasDirectas.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><p>Sin contenido aún.</p></div>}
        </div>
        {modalProyecto && <Modal titulo="Nuevo proyecto" onClose={() => { setModalProyecto(null); setForm({ nombre: '', descripcion: '' }) }} onSave={() => { if (!form.nombre) return; const id = Date.now().toString(); crear('proyectos_direccion', [id, modalProyecto.categoria_id, form.nombre, form.descripcion, new Date().toISOString()]) }}><FormNombre form={form} setForm={setForm} /></Modal>}
        {modalTarea && <ModalTarea titulo="Nueva tarea directa" contexto={vistaCategoria.nombre} formTarea={formTarea} setFormTarea={setFormTarea} usuarios={usuarios}
          onClose={() => { setModalTarea(null); setFormTarea({ nombre: '', descripcion: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '' }) }}
          onSave={() => {
            const id = Date.now().toString()
            const grupoId = Date.now().toString() + '_g'
            const diaRec = [formTarea.dia_recomendado, formTarea.fecha_recomendada].filter(Boolean).join(' ')
            crearTareaConFechaPersonal('tareas_direccion', [id, modalTarea.categoria_id || '', '', '', formTarea.nombre, formTarea.asignados.join(','), 'por_asignar', '', diaRec, formTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', formTarea.fecha_limite || '', formTarea.descripcion || '', grupoId], formTarea.asignados, formTarea.nombre, formTarea.fechas_exactas || '', 'direccion')
          }} />}
        {editItem && editItem._tipo === 'tarea' && <ModalEditTarea editItem={editItem} setEditItem={setEditItem} usuarios={usuarios} usuario={usuario} accessToken={accessToken} guardarEdit={guardarEditTareaConFecha} tareasPlanner={tareasPlanner} />}
        {editItem && editItem._tipo === 'categoria' && <Modal titulo="Editar categoría" onClose={() => setEditItem(null)} onSave={() => guardarEdit('categorias_direccion', [editItem.id, form.nombre, form.descripcion, editItem.fecha_creacion])}><FormNombre form={form} setForm={setForm} /></Modal>}
        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  // LISTA CATEGORIAS
  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>🏢 Dirección</h1>
        <button onClick={() => setModalCategoria(true)} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva categoría</button>
      </div>
      <div className="proyectos-lista">
        {categorias.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p style={{ fontSize: '48px' }}>🏢</p><p>No hay categorías aún.</p></div>}
        {categorias.map(cat => (
          <div key={cat.id} className="proyecto-card" style={{ borderLeftColor: '#7c3aed', cursor: 'pointer' }} onClick={() => setVistaCategoria(cat)}>
            <div className="proyecto-header">
              <div>
                <h3>{cat.nombre}</h3>
                {cat.descripcion && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{cat.descripcion}</p>}
              </div>
              <span style={{ fontSize: '13px', color: '#888' }}>{proyectosDeCategoria(cat.id).length} proyectos</span>
            </div>
          </div>
        ))}
      </div>
      {modalCategoria && <Modal titulo="Nueva categoría" onClose={() => { setModalCategoria(false); setForm({ nombre: '', descripcion: '' }) }} onSave={() => { if (!form.nombre) return; const id = Date.now().toString(); crear('categorias_direccion', [id, form.nombre, form.descripcion, new Date().toISOString()]) }}><FormNombre form={form} setForm={setForm} /></Modal>}
    </div>
  )
}

function FormNombre({ form, setForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
      <textarea placeholder="Descripción (opcional)" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
    </div>
  )
}

function ModalTarea({ titulo, contexto, formTarea, setFormTarea, usuarios, onClose, onSave }) {
  const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px' }}>{titulo}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#f5f3ff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#7c3aed' }}>📂 {contexto}</div>
          <input placeholder="Nombre de la tarea *" value={formTarea.nombre} onChange={e => setFormTarea({...formTarea, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          <textarea placeholder="Descripción (opcional)" value={formTarea.descripcion || ''} onChange={e => setFormTarea({...formTarea, descripcion: e.target.value})}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Asignar a:</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {usuarios.map(u => <button key={u.id} onClick={() => setFormTarea(prev => ({ ...prev, asignados: prev.asignados.includes(u.id) ? prev.asignados.filter(id => id !== u.id) : [...prev.asignados, u.id] }))}
                style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: formTarea.asignados.includes(u.id) ? '#7c3aed' : '#f3f4f6', color: formTarea.asignados.includes(u.id) ? 'white' : '#373A36', border: formTarea.asignados.includes(u.id) ? '2px solid #7c3aed' : '2px solid #e5e7eb' }}>
                {u.nombre ? u.nombre.split(' ')[0] : u.id}
              </button>)}
            </div>
          </div>
          <InputFechasMultiples label="Días asignados en planner (opcional):" value={formTarea.fechas_exactas || ''} onChange={val => setFormTarea({...formTarea, fechas_exactas: val})} />
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite (opcional):</label>
            <input type="date" value={formTarea.fecha_limite} onChange={e => setFormTarea({...formTarea, fecha_limite: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onSave} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear tarea</button>
        </div>
      </div>
    </div>
  )
}

function ModalEditTarea({ editItem, setEditItem, usuarios, guardarEdit, usuario, accessToken, tareasPlanner = [] }) {
  const [inputFecha, setInputFecha] = useState('')
  const fechaPersonalInicial = obtenerFechaPersonal(editItem.id, usuario?.id, tareasPlanner)
  const [fechaPersonal, setFechaPersonal] = useState(fechaPersonalInicial)
  const fechas = fechaPersonal ? fechaPersonal.split(',').map(f => f.trim()).filter(Boolean) : []
  const asignadosList = editItem.asignados ? editItem.asignados.split(',').filter(Boolean) : []

  function agregarFecha() {
    if (!inputFecha) return
    if (fechas.includes(inputFecha)) return
    const nuevas = [...fechas, inputFecha].sort()
    setFechaPersonal(nuevas.join(','))
    setInputFecha('')
  }

  function quitarFecha(f) {
    const nuevas = fechas.filter(x => x !== f)
    setFechaPersonal(nuevas.join(','))
  }

  function toggleAsignado(uid) {
    const actual = editItem.asignados ? editItem.asignados.split(',').filter(Boolean) : []
    const nuevo = actual.includes(uid) ? actual.filter(id => id !== uid) : [...actual, uid]
    if (nuevo.length === 0) return
    setEditItem({...editItem, asignados: nuevo.join(',')})
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px' }}>Editar tarea</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input placeholder="Nombre *" value={editItem.nombre || ''} onChange={e => setEditItem({...editItem, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          <textarea placeholder="Descripción" value={editItem.descripcion || ''} onChange={e => setEditItem({...editItem, descripcion: e.target.value})}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Asignar a:</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {usuarios.map(u => (
                <button key={u.id} onClick={() => toggleAsignado(u.id)}
                  style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: asignadosList.includes(u.id) ? '#7c3aed' : '#f3f4f6', color: asignadosList.includes(u.id) ? 'white' : '#373A36', border: asignadosList.includes(u.id) ? '2px solid #7c3aed' : '2px solid #e5e7eb' }}>
                  {u.nombre ? u.nombre.split(' ')[0] : u.id}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Días asignados en planner:</label>
            {fechas.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {fechas.map(f => (
                  <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f5f3ff', border: '1px solid #7c3aed', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: '#7c3aed', fontWeight: '600' }}>
                    📅 {f}
                    <button onClick={() => quitarFecha(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '13px', fontWeight: '700', padding: '0', lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="date" value={inputFecha} onChange={e => setInputFecha(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <button onClick={agregarFecha}
                style={{ padding: '10px 14px', borderRadius: '8px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>+</button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite:</label>
            <input type="date" value={editItem.fecha_limite || ''} onChange={e => setEditItem({...editItem, fecha_limite: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Estado:</label>
            <select value={editItem.estado || 'pendiente'} onChange={e => setEditItem({...editItem, estado: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="completada">Completada</option>
            </select>
          </div>
          <Checklist tareaId={editItem.id} tipoTarea="direccion" accessToken={accessToken} />
          <SeccionActualizaciones tareaId={editItem.id} tipoTarea="direccion" usuario={usuario} accessToken={accessToken} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={() => setEditItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => guardarEdit([editItem.id, editItem.categoria_id, editItem.proyecto_direccion_id || '', editItem.subcarpeta_id || '', editItem.nombre, editItem.asignados || '', editItem.dia_semana || 'por_asignar', '', editItem.dia_recomendado || '', editItem.fecha_limite || '', editItem.estado || 'pendiente', editItem.fecha_creacion, '', editItem.fecha_limite_original || editItem.fecha_limite || '', editItem.descripcion || '', editItem.tarea_grupo_id || ''], fechaPersonal)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function TareasList({ tareas, usuarios, getNombre, onVerDetalle, onEditar, onCompletar, onEliminar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {tareas.map(tarea => {
        const asignados = tarea.asignados ? tarea.asignados.split(',').filter(Boolean) : []
        const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && tarea.estado !== 'completada'
        const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000
        return (
          <div key={tarea.id} style={{ background: 'white', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${vencida ? '#dc2626' : proxima ? '#f59e0b' : '#7c3aed'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onVerDetalle(tarea)}>
                <p style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '15px', textDecoration: tarea.estado === 'completada' ? 'line-through' : 'none' }}>{tarea.nombre}</p>
                {tarea.descripcion && <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#888' }}>{tarea.descripcion.slice(0, 80)}{tarea.descripcion.length > 80 ? '...' : ''}</p>}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {asignados.map(id => <span key={id} style={{ background: '#f5f3ff', color: '#7c3aed', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>{getNombre(id)}</span>)}
                  {tarea.fecha_limite && <span style={{ background: vencida ? '#fee2e2' : proxima ? '#fef3c7' : '#f3f4f6', color: vencida ? '#dc2626' : proxima ? '#92400e' : '#6b7280', borderRadius: '20px', padding: '2px 8px', fontSize: '11px' }}>{vencida ? '⚠️' : '📅'} {tarea.fecha_limite}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '12px' }}>
                <button onClick={() => onEditar(tarea)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                {tarea.estado !== 'completada' && onCompletar && <button onClick={() => onCompletar(tarea)} style={{ background: '#f0fdf4', color: '#00953B', border: '1px solid #00953B', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>✅</button>}
                <button onClick={() => onEliminar(tarea)} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                <span style={{ background: tarea.estado === 'completada' ? '#dcfce7' : '#f3f4f6', color: tarea.estado === 'completada' ? '#166534' : '#6b7280', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' }}>{tarea.estado || 'pendiente'}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
