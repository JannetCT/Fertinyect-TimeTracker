import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado, eliminarTareasPlanner } from '../services/googleSheets'
import Checklist from '../components/Checklist'
import { useDatos } from '../contexts/DatosContext'
import { guardarFechaPersonalEnPlanner } from '../services/plannerHelpers'

const FASES_DEFAULT = [
  { nombre: 'Estudio viabilidad', orden: 1 },
  { nombre: 'Prueba concepto', orden: 2 },
  { nombre: 'Prototipo', orden: 3 },
  { nombre: 'Producto', orden: 4 },
  { nombre: 'Producto certificado', orden: 5 },
  { nombre: 'Producto comercializado', orden: 6 }
]

const TIPOS = [
  { value: 'largo_plazo', label: 'Largo plazo (1-3 años)' },
  { value: 'medio_plazo', label: 'Medio plazo (meses)' },
  { value: 'corto_plazo', label: 'Corto plazo (puntual)' }
]

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

function Modal({ titulo, onClose, onSave, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px' }}>{titulo}</h2>
        {children}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onSave} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmEliminar({ nombre, onClose, onConfirm }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002 }}>
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

function BtnAccion({ onClick, tipo, children }) {
  const estilos = {
    editar: { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' },
    eliminar: { background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' },
    añadir: { background: '#f0fdf4', color: '#00953B', border: '1px solid #00953B' },
  }
  return (
    <button onClick={onClick} style={{ ...estilos[tipo], borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
      {children}
    </button>
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
          style={{ padding: '8px 14px', borderRadius: '8px', background: '#00953B', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
          {cargando ? '...' : '+ Añadir'}
        </button>
      </div>
      {actualizaciones.length === 0
        ? <p style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Sin actualizaciones aún</p>
        : actualizaciones.map(a => (
          <div key={a.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px', borderLeft: '3px solid #00953B' }}>
            {editandoId === a.id ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={textoEdit} onChange={e => setTextoEdit(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }} />
                <button onClick={() => guardarEdicion(a.id)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#00953B', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✓</button>
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

// Selector de personas reutilizable
function SelectorPersonas({ usuarios, seleccionados, onChange, color = '#00953B' }) {
  return (
    <div>
      <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Asignar a:</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {usuarios.map(u => {
          const activo = seleccionados.includes(u.id)
          return (
            <button key={u.id}
              onClick={() => onChange(activo ? seleccionados.filter(id => id !== u.id) : [...seleccionados, u.id])}
              style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: activo ? color : '#f3f4f6', color: activo ? 'white' : '#373A36', border: `2px solid ${activo ? color : '#e5e7eb'}` }}>
              {u.nombre ? u.nombre.split(' ')[0] : u.id}
            </button>
          )
        })}
      </div>
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

function ModalEvento({ titulo, contexto, origenId, origenTipo, usuario, accessToken, onClose, onSave }) {
  const [form, setForm] = useState({ titulo: '', fecha_exacta: '', hora_inicio: '', hora_fin: '', tipo: 'reunion', descripcion: '' })
  async function crear() {
    if (!form.titulo || !form.fecha_exacta) return
    const id = Date.now().toString()
    await onSave([id, String(usuario.id), form.titulo, form.descripcion || '', form.fecha_exacta, form.hora_inicio || '', form.hora_fin || '', form.tipo, new Date().toISOString(), '', origenId || '', origenTipo || ''])
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '8px' }}>Nuevo evento</h2>
        {contexto && <p style={{ fontSize: '13px', color: '#7c3aed', marginBottom: '16px', background: '#f5f3ff', padding: '8px 12px', borderRadius: '8px' }}>📂 {contexto}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input placeholder="Título *" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
            <option value="reunion">Reunión</option><option value="formacion">Formación</option><option value="evento">Evento</option><option value="otro">Otro</option>
          </select>
          <div><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha *</label><input type="date" value={form.fecha_exacta} onChange={e => setForm({...form, fecha_exacta: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora inicio</label><input type="time" value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Hora fin</label><input type="time" value={form.hora_fin} onChange={e => setForm({...form, hora_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
          </div>
          <textarea placeholder="Descripción (opcional)" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '70px', resize: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={crear} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear evento</button>
        </div>
      </div>
    </div>
  )
}

export default function Proyectos() {
  const { accessToken, usuario } = useAuth()
  const { refrescar } = useDatos()
  const [modalCompletar, setModalCompletar] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const [proyectos, setProyectos] = useState([])
  const [estados, setEstados] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [tareas, setTareas] = useState([])
  const [tareasPlanner, setTareasPlanner] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const [vistaProyecto, setVistaProyecto] = useState(null)
  const [estadosColapsados, setEstadosColapsados] = useState({})
  const [vistaEnsayo, setVistaEnsayo] = useState(null)

  const [modalProyecto, setModalProyecto] = useState(false)
  const [modalAccion, setModalAccion] = useState(null)
  const [modalEnsayo, setModalEnsayo] = useState(null)
  const [modalTarea, setModalTarea] = useState(null)
  const [modalTareaAccion, setModalTareaAccion] = useState(null)
  const [modalEventoProyecto, setModalEventoProyecto] = useState(null)
  const [modalTareaEstado, setModalTareaEstado] = useState(null)
  const [modalEstado, setModalEstado] = useState(null)

  const [editProyecto, setEditProyecto] = useState(null)
  const [editAccion, setEditAccion] = useState(null)
  const [editEnsayo, setEditEnsayo] = useState(null)
  const [editTarea, setEditTarea] = useState(null)
  const [vistaTarea, setVistaTarea] = useState(null)

  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const [nuevoProyecto, setNuevoProyecto] = useState({ nombre: '', descripcion: '', tipo: 'medio_plazo', color: '#00953B', fecha_inicio: '', fecha_fin: '' })
  const [nuevaAccion, setNuevaAccion] = useState({ nombre: '', descripcion: '', fecha_inicio: '', fecha_fin: '' })
  const [nuevoEnsayo, setNuevoEnsayo] = useState({ nombre: '', tipo: 'ensayo', descripcion: '', fecha_inicio: '', fecha_fin: '' })
  const [nuevaTarea, setNuevaTarea] = useState({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '', descripcion: '' })
  const [nuevoEstado, setNuevoEstado] = useState({ nombre: '' })

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  useEffect(() => {
    if (cargando) return
    const ensayoId = searchParams.get('ensayo')
    const proyectoId = searchParams.get('proyecto')

    if (ensayoId) {
      const ensayo = ensayos.find(e => e.id === ensayoId)
      if (ensayo) {
        const proyecto = proyectos.find(p => p.id === ensayo.proyecto_id)
        if (proyecto) setVistaProyecto(proyecto)
        setVistaEnsayo(ensayo)
      }
      setSearchParams({})
    } else if (proyectoId) {
      const proyecto = proyectos.find(p => p.id === proyectoId)
      if (proyecto) setVistaProyecto(proyecto)
      setSearchParams({})
    }
  }, [cargando, searchParams])

  async function cargarDatos() {
    try {
      const [p, e, a, en, t, u] = await Promise.all([
        leerHoja('proyectos', accessToken),
        leerHoja('estados_proyecto', accessToken),
        leerHoja('acciones', accessToken),
        leerHoja('ensayos', accessToken),
        leerHoja('tareas', accessToken),
        leerHoja('usuarios', accessToken)
      ])
      setProyectos(p)
      setEstados(e)
      setAcciones(a)
      setEnsayos(en)
      setTareas(t)
      setUsuarios(u)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function crearProyecto() {
    if (!nuevoProyecto.nombre) return
    const id = Date.now().toString()
    await escribirFila('proyectos', [id, nuevoProyecto.nombre, nuevoProyecto.descripcion, nuevoProyecto.tipo, nuevoProyecto.color, nuevoProyecto.fecha_inicio, nuevoProyecto.fecha_fin, new Date().toISOString()], accessToken)
    for (const fase of FASES_DEFAULT) {
      await new Promise(r => setTimeout(r, 200))
      const faseId = Date.now().toString() + Math.random().toString(36).slice(2)
      await escribirFila('estados_proyecto', [faseId, id, fase.nombre, fase.orden, 'true'], accessToken)
    }
    setModalProyecto(false)
    setNuevoProyecto({ nombre: '', descripcion: '', tipo: 'medio_plazo', color: '#00953B', fecha_inicio: '', fecha_fin: '' })
    cargarDatos()
  }

  async function guardarEditProyecto() {
    if (!editProyecto) return
    await actualizarFila('proyectos', editProyecto.id, [editProyecto.id, editProyecto.nombre, editProyecto.descripcion, editProyecto.tipo, editProyecto.color, editProyecto.fecha_inicio, editProyecto.fecha_fin, editProyecto.fecha_creacion], accessToken)
    setVistaProyecto(editProyecto)
    setEditProyecto(null)
    cargarDatos()
  }

  async function crearEstado() {
    if (!nuevoEstado.nombre || !modalEstado) return
    const id = Date.now().toString()
    const estadosProyecto = estadosDeProyecto(modalEstado.proyecto_id)
    const maxOrden = estadosProyecto.length > 0 ? Math.max(...estadosProyecto.map(e => Number(e.orden))) : 6
    await escribirFila('estados_proyecto', [id, modalEstado.proyecto_id, nuevoEstado.nombre, maxOrden + 1, 'true'], accessToken)
    setModalEstado(null)
    setNuevoEstado({ nombre: '' })
    cargarDatos()
  }

  async function crearAccion() {
    if (!nuevaAccion.nombre || !modalAccion) return
    const id = Date.now().toString()
    await escribirFila('acciones', [
      id, modalAccion.estado_id, modalAccion.proyecto_id,
      nuevaAccion.nombre, nuevaAccion.descripcion, new Date().toISOString(),
      nuevaAccion.fecha_inicio, nuevaAccion.fecha_fin,
      nuevaAccion.fecha_inicio, nuevaAccion.fecha_fin
    ], accessToken)
    setModalAccion(null)
    setNuevaAccion({ nombre: '', descripcion: '', fecha_inicio: '', fecha_fin: '' })
    cargarDatos()
  }

  async function guardarEditAccion() {
    if (!editAccion) return
    await actualizarFila('acciones', editAccion.id, [
      editAccion.id, editAccion.estado_id, editAccion.proyecto_id,
      editAccion.nombre, editAccion.descripcion, editAccion.fecha_creacion,
      editAccion.fecha_inicio, editAccion.fecha_fin,
      editAccion.fecha_inicio_original || editAccion.fecha_inicio,
      editAccion.fecha_fin_original || editAccion.fecha_fin,
      editAccion.estado || 'pendiente'
    ], accessToken)
    setEditAccion(null)
    cargarDatos()
  }

  async function crearEnsayo() {
    if (!nuevoEnsayo.nombre || !modalEnsayo) return
    const id = Date.now().toString()
    await escribirFila('ensayos', [
      id, modalEnsayo.accion_id, modalEnsayo.proyecto_id,
      nuevoEnsayo.tipo, nuevoEnsayo.nombre, nuevoEnsayo.descripcion, new Date().toISOString(),
      nuevoEnsayo.fecha_inicio, nuevoEnsayo.fecha_fin,
      nuevoEnsayo.fecha_inicio, nuevoEnsayo.fecha_fin
    ], accessToken)
    setModalEnsayo(null)
    setNuevoEnsayo({ nombre: '', tipo: 'ensayo', descripcion: '', fecha_inicio: '', fecha_fin: '' })
    cargarDatos()
  }

  async function guardarEditEnsayo() {
    if (!editEnsayo) return
    await actualizarFila('ensayos', editEnsayo.id, [
      editEnsayo.id, editEnsayo.accion_id, editEnsayo.proyecto_id,
      editEnsayo.tipo, editEnsayo.nombre, editEnsayo.descripcion, editEnsayo.fecha_creacion,
      editEnsayo.fecha_inicio, editEnsayo.fecha_fin,
      editEnsayo.fecha_inicio_original || editEnsayo.fecha_inicio,
      editEnsayo.fecha_fin_original || editEnsayo.fecha_fin,
      editEnsayo.estado || 'pendiente'
    ], accessToken)
    setVistaEnsayo(editEnsayo)
    setEditEnsayo(null)
    cargarDatos()
  }

  async function crearTarea() {
    if (!nuevaTarea.nombre || !modalTarea) return
    const id = Date.now().toString()
    const asignadosStr = nuevaTarea.asignados.join(',')
    const diaRec = [nuevaTarea.dia_recomendado, nuevaTarea.fecha_recomendada].filter(Boolean).join(' ')
    const fechasExactas = nuevaTarea.fechas_exactas || ''
    const primeraFecha2 = fechasExactas.split(',')[0]?.trim() || ''
    const diaCalculado2 = primeraFecha2 ? (['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][new Date(primeraFecha2 + 'T12:00:00').getDay()]) : 'por_asignar'
    await escribirFila('tareas', [
      id, modalTarea.ensayo_id, modalTarea.accion_id, modalTarea.proyecto_id,
      nuevaTarea.nombre, asignadosStr, diaCalculado2, fechasExactas,
      diaRec, nuevaTarea.fecha_limite, 'pendiente', new Date().toISOString(),
      '', nuevaTarea.fecha_limite, nuevaTarea.descripcion || '', Date.now().toString() + '_g',
      '', '', String(usuario.id)
    ], accessToken)
    if (fechasExactas && nuevaTarea.asignados.length > 0) {
      for (const uid of nuevaTarea.asignados) {
        await guardarFechaPersonalEnPlanner(id, 'proyecto', fechasExactas, { id: uid }, accessToken, nuevaTarea.nombre)
      }
    }
    setModalTarea(null)
    setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '', descripcion: '' })
    await refrescar('tareas_planner'); cargarDatos()
  }

  async function guardarEditTarea() {
    if (!editTarea) return
    const asignadosStr = Array.isArray(editTarea.asignados) ? editTarea.asignados.join(',') : editTarea.asignados
    const diaRec = [editTarea.dia_recomendado, editTarea.fecha_recomendada].filter(Boolean).join(' ')
    // Guardamos datos compartidos en tareas (sin fecha_exacta — esa es personal)
    await actualizarFila('tareas', editTarea.id, [
      editTarea.id, editTarea.ensayo_id, editTarea.accion_id, editTarea.proyecto_id,
      editTarea.nombre, asignadosStr, editTarea.dia_semana, '',
      diaRec, editTarea.fecha_limite, editTarea.estado, editTarea.fecha_creacion,
      editTarea.etiqueta || '', editTarea.fecha_limite_original || editTarea.fecha_limite,
      editTarea.descripcion || '', editTarea.tarea_grupo_id || ''
    ], accessToken)
    // Guardamos fecha personal en tareas_planner
    if (editTarea._fechaPersonal !== undefined) {
      await guardarFechaPersonalEnPlanner(editTarea.id, 'proyecto', editTarea._fechaPersonal, usuario, accessToken, editTarea.nombre)
    }
    setEditTarea(null)
    await refrescar('tareas_planner'); cargarDatos()
  }

  async function eliminarYReordenarEstados(estadoId, proyectoId) {
    const todosEstados = await leerHoja('estados_proyecto', accessToken)
    const estadosRestantes = todosEstados
      .filter(e => e.proyecto_id === proyectoId && e.id !== estadoId)
      .sort((a, b) => Number(a.orden) - Number(b.orden))
    await marcarEliminado('estados_proyecto', estadoId, accessToken)
    for (let i = 0; i < estadosRestantes.length; i++) {
      await actualizarFila('estados_proyecto', estadosRestantes[i].id, [
        estadosRestantes[i].id, estadosRestantes[i].proyecto_id,
        estadosRestantes[i].nombre, i + 1, estadosRestantes[i].activo
      ], accessToken)
    }
  }

  async function completarTareaConHoras(tarea, horaInicio, horaFin, duracionSegundos) {
    if (duracionSegundos > 0) {
      const fechaStr = new Date().toISOString().split('T')[0]
      const inicioISO = horaInicio ? new Date(`${fechaStr}T${horaInicio}:00`).toISOString() : new Date().toISOString()
      const finISO = horaFin ? new Date(`${fechaStr}T${horaFin}:00`).toISOString() : new Date().toISOString()
      await escribirFila('registros', [Date.now().toString(), tarea.id, usuario.id, inicioISO, finISO, duracionSegundos, new Date().toDateString(), 'proyecto', tarea.nombre], accessToken)
    }
    await actualizarFila('tareas', tarea.id, [tarea.id, tarea.ensayo_id, tarea.accion_id, tarea.proyecto_id, tarea.nombre, tarea.asignados, tarea.dia_semana, tarea.fecha_exacta || '', tarea.dia_recomendado || '', tarea.fecha_limite || '', 'completada', tarea.fecha_creacion, tarea.etiqueta || '', tarea.fecha_limite_original || tarea.fecha_limite || '', tarea.descripcion || '', tarea.tarea_grupo_id || ''], accessToken)
    setModalCompletar(null)
    cargarDatos()
  }

  async function ejecutarEliminar() {
    if (!confirmEliminar) return
    const { tipo, item } = confirmEliminar
    if (tipo === 'proyecto') {
      await actualizarFila('proyectos', item.id, [item.id, item.nombre, item.descripcion, item.tipo, item.color, item.fecha_inicio, item.fecha_fin, 'eliminado'], accessToken)
      setVistaProyecto(null)
    } else if (tipo === 'estado') {
      await eliminarYReordenarEstados(item.id, item.proyecto_id)
    } else if (tipo === 'accion') {
      await marcarEliminado('acciones', item.id, accessToken)
    } else if (tipo === 'ensayo') {
      await marcarEliminado('ensayos', item.id, accessToken)
      if (vistaEnsayo?.id === item.id) setVistaEnsayo(null)
    } else if (tipo === 'tarea') {
      await marcarEliminado('tareas', item.id, accessToken)
      await eliminarTareasPlanner(item.id, accessToken)
      if (vistaTarea?.id === item.id) setVistaTarea(null)
    }
    setConfirmEliminar(null)
    cargarDatos()
  }

  function getNombre(id) {
    const u = usuarios.find(u => u.id === id)
    return u ? (u.nombre ? u.nombre.split(' ')[0] : id) : id
  }

  function toggleColapso(estadoId) { setEstadosColapsados(prev => ({ ...prev, [estadoId]: !prev[estadoId] })) }
  const estaExpandido = (id) => estadosColapsados[id] === true
  function estadosDeProyecto(pId) { return estados.filter(e => e.proyecto_id === pId).sort((a, b) => Number(a.orden) - Number(b.orden)) }
  function accionesDeEstado(eId) { return acciones.filter(a => a.estado_id === eId).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function ensayosDeAccion(aId) { return ensayos.filter(e => e.accion_id === aId).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function tareasDeEnsayo(eId) { return tareas.filter(t => t.ensayo_id === eId).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function tareasDirectasDeAccion(aId) { return tareas.filter(t => t.accion_id === aId && !t.ensayo_id && t.id !== 'eliminado' && t.accion_id !== 'eliminado').sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function tareasDirectasDeProyecto(pId) { return tareas.filter(t => t.proyecto_id === pId && !t.accion_id && !t.ensayo_id && t.id !== 'eliminado').sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es')) }
  function progresoProyecto(pId) {
    const t = tareas.filter(t => t.proyecto_id === pId)
    if (!t.length) return 0
    return Math.round((t.filter(t => t.estado === 'completada').length / t.length) * 100)
  }

  const proyectosActivos = proyectos.filter(p => p.fecha_creacion !== 'eliminado' && p.id).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'))

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  // Modales compartidos entre todas las vistas — siempre se renderizan al final
  const modalesCompartidos = (
    <>
      {editTarea && (
        <Modal titulo="Editar tarea" onClose={() => setEditTarea(null)} onSave={guardarEditTarea}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input placeholder="Nombre *" value={editTarea.nombre} onChange={e => setEditTarea({ ...editTarea, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            <textarea placeholder="Descripción (opcional)" value={editTarea.descripcion || ''} onChange={e => setEditTarea({ ...editTarea, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            <SelectorPersonas
              usuarios={usuarios}
              seleccionados={Array.isArray(editTarea.asignados) ? editTarea.asignados : (editTarea.asignados ? editTarea.asignados.split(',').filter(Boolean) : [])}
              onChange={ids => setEditTarea({ ...editTarea, asignados: ids })}
            />
            {/* Fecha personal — usa tareas_planner, no la tarea compartida */}
            <InputFechasMultiples label="Mi día en el planner (solo para mí):" value={editTarea._fechaPersonal !== undefined ? editTarea._fechaPersonal : (tareasPlanner.find(tp => tp.tarea_padre_id === editTarea.id && String(tp.usuario_id) === String(usuario?.id))?.fecha_exacta || '')} onChange={val => setEditTarea({ ...editTarea, _fechaPersonal: val })} />

            <div>
              <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite:</label>
              <input type="date" value={editTarea.fecha_limite || ''} onChange={e => setEditTarea({ ...editTarea, fecha_limite: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
            </div>
            <Checklist tareaId={editTarea.id} tipoTarea="proyecto" accessToken={accessToken} />
            <SeccionActualizaciones tareaId={editTarea.id} tipoTarea="proyecto" usuario={usuario} accessToken={accessToken} />
          </div>
        </Modal>
      )}
      {editEnsayo && (
        <Modal titulo="Editar ensayo/informe" onClose={() => setEditEnsayo(null)} onSave={guardarEditEnsayo}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <select value={editEnsayo.tipo} onChange={e => setEditEnsayo({ ...editEnsayo, tipo: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
              <option value="ensayo">Ensayo</option>
              <option value="informe">Informe</option>
            </select>
            <input placeholder="Nombre *" value={editEnsayo.nombre} onChange={e => setEditEnsayo({ ...editEnsayo, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            <textarea placeholder="Descripción" value={editEnsayo.descripcion || ''} onChange={e => setEditEnsayo({ ...editEnsayo, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                <input type="date" value={editEnsayo.fecha_inicio || ''} onChange={e => setEditEnsayo({ ...editEnsayo, fecha_inicio: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin estimada</label>
                <input type="date" value={editEnsayo.fecha_fin || ''} onChange={e => setEditEnsayo({ ...editEnsayo, fecha_fin: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Estado:</label>
              <select value={editEnsayo.estado || 'pendiente'} onChange={e => setEditEnsayo({ ...editEnsayo, estado: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                <option value="pendiente">Pendiente</option>
                <option value="en_curso">En curso</option>
                <option value="completado">Completado</option>
              </select>
            </div>
            {editEnsayo.fecha_inicio_original && (
              <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#166534' }}>
                📌 Fechas originales: {editEnsayo.fecha_inicio_original} → {editEnsayo.fecha_fin_original || '?'}
              </div>
            )}
          </div>
        </Modal>
      )}
      {editAccion && (
        <Modal titulo="Editar acción" onClose={() => setEditAccion(null)} onSave={guardarEditAccion}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input placeholder="Nombre *" value={editAccion.nombre} onChange={e => setEditAccion({ ...editAccion, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            <textarea placeholder="Descripción" value={editAccion.descripcion || ''} onChange={e => setEditAccion({ ...editAccion, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                <input type="date" value={editAccion.fecha_inicio || ''} onChange={e => setEditAccion({ ...editAccion, fecha_inicio: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin estimada</label>
                <input type="date" value={editAccion.fecha_fin || ''} onChange={e => setEditAccion({ ...editAccion, fecha_fin: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Estado:</label>
              <select value={editAccion.estado || 'pendiente'} onChange={e => setEditAccion({ ...editAccion, estado: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }}>
                <option value="pendiente">Pendiente</option>
                <option value="en_curso">En curso</option>
                <option value="completado">Completado</option>
              </select>
            </div>
            {editAccion.fecha_inicio_original && (
              <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#166534' }}>
                📌 Fechas originales: {editAccion.fecha_inicio_original} → {editAccion.fecha_fin_original || '?'}
              </div>
            )}
          </div>
        </Modal>
      )}
      {editProyecto && (
        <Modal titulo="Editar proyecto" onClose={() => setEditProyecto(null)} onSave={guardarEditProyecto}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input placeholder="Nombre *" value={editProyecto.nombre} onChange={e => setEditProyecto({ ...editProyecto, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            <textarea placeholder="Descripción" value={editProyecto.descripcion || ''} onChange={e => setEditProyecto({ ...editProyecto, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            <select value={editProyecto.tipo} onChange={e => setEditProyecto({ ...editProyecto, tipo: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#555' }}>Color:</label>
              <input type="color" value={editProyecto.color} onChange={e => setEditProyecto({ ...editProyecto, color: e.target.value })} style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                <input type="date" value={editProyecto.fecha_inicio || ''} onChange={e => setEditProyecto({ ...editProyecto, fecha_inicio: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin</label>
                <input type="date" value={editProyecto.fecha_fin || ''} onChange={e => setEditProyecto({ ...editProyecto, fecha_fin: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
          </div>
        </Modal>
      )}
      {modalCompletar && <ModalCompletarTarea tarea={modalCompletar} onCancelar={() => setModalCompletar(null)} onConfirmar={(hi, hf, dur) => completarTareaConHoras(modalCompletar, hi, hf, dur)} />}
      {confirmEliminar && (
        <ConfirmEliminar
          nombre={confirmEliminar.item.nombre}
          onClose={() => setConfirmEliminar(null)}
          onConfirm={ejecutarEliminar}
        />
      )}
    </>
  )

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
            <BtnAccion tipo="editar" onClick={() => setEditTarea({ ...vistaTarea, asignados: vistaTarea.asignados ? vistaTarea.asignados.split(',').filter(Boolean) : [] })}>✏️ Editar</BtnAccion>
            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'tarea', item: vistaTarea })}>🗑 Eliminar</BtnAccion>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {vistaTarea.descripcion && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '6px' }}>Descripción:</label>
              <p style={{ margin: 0, fontSize: '14px', color: '#373A36', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>{vistaTarea.descripcion}</p>
            </div>
          )}
          <Checklist tareaId={vistaTarea.id} tipoTarea="proyecto" accessToken={accessToken} />
          <SeccionActualizaciones tareaId={vistaTarea.id} tipoTarea="proyecto" usuario={usuario} accessToken={accessToken} />
        </div>
        {modalesCompartidos}
      </div>
    )
  }

  // VISTA ENSAYO
  if (vistaEnsayo) {
    const tareasEnsayo = tareasDeEnsayo(vistaEnsayo.id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaEnsayo(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: vistaEnsayo.tipo === 'ensayo' ? '#dbeafe' : '#fef3c7', color: vistaEnsayo.tipo === 'ensayo' ? '#1d4ed8' : '#92400e', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{vistaEnsayo.tipo === 'ensayo' ? 'ENSAYO' : 'INFORME'}</span>
                <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaEnsayo.nombre}</h1>
              </div>
              {vistaEnsayo.descripcion && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{vistaEnsayo.descripcion}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <BtnAccion tipo="editar" onClick={() => setEditEnsayo({ ...vistaEnsayo })}>✏️ Editar</BtnAccion>
            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'ensayo', item: vistaEnsayo })}>🗑 Eliminar</BtnAccion>
            <button onClick={() => { setNuevaTarea(prev => ({ ...prev, asignados: usuario?.id ? [String(usuario.id)] : [] })); setModalTarea({ ensayo_id: vistaEnsayo.id, accion_id: vistaEnsayo.accion_id, proyecto_id: vistaEnsayo.proyecto_id }) }} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva tarea</button>
            <button onClick={() => setModalEventoProyecto({ origenId: vistaEnsayo.id, origenTipo: 'ensayo', contexto: vistaEnsayo.nombre })} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Evento</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tareasEnsayo.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p style={{ fontSize: '40px' }}>📋</p><p>Sin tareas aún. ¡Crea la primera!</p></div>}
          {tareasEnsayo.map(tarea => {
            const asignados = tarea.asignados ? tarea.asignados.split(',').filter(Boolean) : []
            const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && tarea.estado !== 'completada'
            const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000
            return (
              <div key={tarea.id} style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${vencida ? '#dc2626' : proxima ? '#f59e0b' : '#00953B'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p onClick={() => setVistaTarea(tarea)} style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '15px', textDecoration: tarea.estado === 'completada' ? 'line-through' : 'none', cursor: 'pointer' }}>{tarea.nombre}</p>
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#888' }}>📁 {vistaEnsayo.nombre}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {asignados.map(id => <span key={id} style={{ background: '#f0fdf4', color: '#00953B', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>{getNombre(id)}</span>)}
                      {tarea.fecha_limite && <span style={{ background: vencida ? '#fee2e2' : proxima ? '#fef3c7' : '#f3f4f6', color: vencida ? '#dc2626' : proxima ? '#92400e' : '#6b7280', borderRadius: '20px', padding: '2px 8px', fontSize: '11px' }}>{vencida ? '⚠️ Vencida' : '📅'} {tarea.fecha_limite}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '12px' }}>
                    <BtnAccion tipo="editar" onClick={() => setEditTarea({ ...tarea, asignados: tarea.asignados ? tarea.asignados.split(',').filter(Boolean) : [] })}>✏️</BtnAccion>
                    {tarea.estado !== 'completada' && <button onClick={() => setModalCompletar(tarea)} style={{ background: '#f0fdf4', color: '#00953B', border: '1px solid #00953B', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>✅</button>}
                    <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'tarea', item: tarea })}>🗑</BtnAccion>
                    <span style={{ background: tarea.estado === 'completada' ? '#dcfce7' : tarea.estado === 'en_curso' ? '#dbeafe' : '#f3f4f6', color: tarea.estado === 'completada' ? '#166534' : tarea.estado === 'en_curso' ? '#1d4ed8' : '#6b7280', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>{tarea.estado || 'pendiente'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {modalTarea && (
          <Modal titulo="Nueva tarea" onClose={() => { setModalTarea(null); setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '', descripcion: '' }) }} onSave={crearTarea}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>📁 Ensayo: <strong>{vistaEnsayo.nombre}</strong></div>
              <input placeholder="Nombre de la tarea *" value={nuevaTarea.nombre} onChange={e => setNuevaTarea({ ...nuevaTarea, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción (opcional)" value={nuevaTarea.descripcion || ''} onChange={e => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              <SelectorPersonas usuarios={usuarios} seleccionados={nuevaTarea.asignados} onChange={ids => setNuevaTarea({ ...nuevaTarea, asignados: ids })} />
              <InputFechasMultiples label="Días asignados en planner (opcional):" value={nuevaTarea.fechas_exactas || ''} onChange={val => setNuevaTarea({ ...nuevaTarea, fechas_exactas: val })} />

              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite (opcional):</label>
                <input type="date" value={nuevaTarea.fecha_limite} onChange={e => setNuevaTarea({ ...nuevaTarea, fecha_limite: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
          </Modal>
        )}
        {modalEventoProyecto && <ModalEvento titulo='Nuevo evento' contexto={modalEventoProyecto.contexto} origenId={modalEventoProyecto.origenId} origenTipo={modalEventoProyecto.origenTipo} usuario={usuario} accessToken={accessToken} onClose={() => setModalEventoProyecto(null)} onSave={async (fila) => { await escribirFila('eventos', fila, accessToken); cargarDatos() }} />}
        {modalesCompartidos}
      </div>
    )
  }

  // VISTA PROYECTO
  if (vistaProyecto) {
    const estadosProyecto = estadosDeProyecto(vistaProyecto.id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaProyecto(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: vistaProyecto.color, display: 'inline-block' }}></span>
                {vistaProyecto.nombre}
              </h1>
              <span style={{ fontSize: '13px', color: '#888' }}>{TIPOS.find(t => t.value === vistaProyecto.tipo)?.label}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <BtnAccion tipo="editar" onClick={() => setEditProyecto({ ...vistaProyecto })}>✏️ Editar</BtnAccion>
            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'proyecto', item: vistaProyecto })}>🗑 Eliminar</BtnAccion>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tareasDirectasDeProyecto(vistaProyecto.id).length > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#373A36' }}>📋 Tareas directas del proyecto</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tareasDirectasDeProyecto(vistaProyecto.id).map(t => (
                  <div key={t.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px 14px', borderLeft: '3px solid #00953B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{t.nombre}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>{t.estado} {t.fecha_limite ? `· 📅 ${t.fecha_limite}` : ''}</p>
                    </div>
                    <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'tarea', item: t })}>🗑</BtnAccion>
                  </div>
                ))}
              </div>
            </div>
          )}
          {estadosProyecto.map(estado => (
            <div key={estado.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: estadosColapsados[estado.id] ? '0' : '16px', cursor: 'pointer' }} onClick={() => toggleColapso(estado.id)}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#373A36', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#00953B', fontSize: '12px' }}>{estaExpandido(estado.id) ? '▼' : '▶'}</span>
                  <span style={{ color: '#00953B', marginRight: '4px' }}>{estado.orden}.</span>{estado.nombre}
                </h3>
                <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'estado', item: estado })}>🗑</BtnAccion>
                  <BtnAccion tipo="añadir" onClick={() => setModalAccion({ estado_id: estado.id, proyecto_id: vistaProyecto.id })}>+ Acción</BtnAccion>
                  <BtnAccion tipo="editar" onClick={() => setModalTareaEstado({ estado_id: estado.id, proyecto_id: vistaProyecto.id })}>📋 + Tarea</BtnAccion>
                  <BtnAccion tipo="añadir" onClick={() => setModalEventoProyecto({ origenId: estado.id, origenTipo: 'estado', contexto: estado.nombre })}>+ Evento</BtnAccion>
                </div>
              </div>
              {estaExpandido(estado.id) && <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accionesDeEstado(estado.id).map(accion => (
                  <div key={accion.id} style={{ background: '#f8f9fa', borderRadius: '8px', padding: '14px', borderLeft: `3px solid ${vistaProyecto.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', cursor: 'pointer' }} onClick={() => toggleColapso('accion_' + accion.id)}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '11px', color: '#6b7280' }}>{estaExpandido('accion_' + accion.id) ? '▼' : '▶'}</span>{accion.nombre}</p>
                        {accion.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{accion.descripcion}</p>}
                        {(accion.fecha_inicio || accion.fecha_fin) && (
                          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6b7280' }}>
                            📅 {accion.fecha_inicio || '?'} → {accion.fecha_fin || '?'}
                            {accion.fecha_fin && new Date(accion.fecha_fin) < new Date() && accion.fecha_fin !== accion.fecha_fin_original &&
                              <span style={{ color: '#dc2626', marginLeft: '6px' }}>⚠️ Extendida</span>
                            }
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        <BtnAccion tipo="editar" onClick={() => setEditAccion({ ...accion })}>✏️</BtnAccion>
                        <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'accion', item: accion })}>🗑</BtnAccion>
                        <BtnAccion tipo="añadir" onClick={() => setModalEnsayo({ accion_id: accion.id, proyecto_id: vistaProyecto.id })}>+ Ensayo</BtnAccion>
                        <BtnAccion tipo="editar" onClick={() => setModalTareaAccion({ accion_id: accion.id, proyecto_id: vistaProyecto.id, estado_id: accion.estado_id })}>📋 + Tarea</BtnAccion>
                        <BtnAccion tipo="añadir" onClick={() => setModalEventoProyecto({ origenId: accion.id, origenTipo: 'accion', contexto: accion.nombre })}>+ Evento</BtnAccion>
                      </div>
                    </div>
                    {estaExpandido('accion_' + accion.id) && <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ensayosDeAccion(accion.id).map(ensayo => (
                        <div key={ensayo.id} style={{ background: 'white', borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ background: ensayo.tipo === 'ensayo' ? '#dbeafe' : '#fef3c7', color: ensayo.tipo === 'ensayo' ? '#1d4ed8' : '#92400e', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: '600' }}>{ensayo.tipo === 'ensayo' ? 'ENSAYO' : 'INFORME'}</span>
                            <span style={{ fontSize: '13px', fontWeight: '600', flex: 1 }}>{ensayo.nombre}</span>
                          </div>
                          {(ensayo.fecha_inicio || ensayo.fecha_fin) && (
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>📅 {ensayo.fecha_inicio || '?'} → {ensayo.fecha_fin || '?'}</span>
                          )}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', color: '#888' }}>{tareasDeEnsayo(ensayo.id).length} tareas</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <BtnAccion tipo="editar" onClick={() => setEditEnsayo({ ...ensayo })}>✏️</BtnAccion>
                              <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'ensayo', item: ensayo })}>🗑</BtnAccion>
                              <span onClick={() => setVistaEnsayo(ensayo)} style={{ color: '#00953B', fontSize: '14px', cursor: 'pointer', fontWeight: '700' }}>→ Ver</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {tareasDirectasDeAccion(accion.id).map(t => (
                        <div key={t.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px 14px', borderLeft: '3px solid #00953B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{t.nombre}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>{t.estado} {t.fecha_limite ? `· 📅 ${t.fecha_limite}` : ''}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <BtnAccion tipo="editar" onClick={() => { setEditTarea(t); setNuevaTarea({ nombre: t.nombre, asignados: t.asignados ? t.asignados.split(',') : [], fecha_limite: t.fecha_limite || '', fechas_exactas: '', descripcion: t.descripcion || '' }) }}>✏️</BtnAccion>
                            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'tarea', item: t })}>🗑</BtnAccion>
                          </div>
                        </div>
                      ))}
                      {ensayosDeAccion(accion.id).length === 0 && tareasDirectasDeAccion(accion.id).length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Sin ensayos ni informes aún</p>}
                    </div>}
                  </div>
                ))}
                {accionesDeEstado(estado.id).length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>Sin acciones aún</p>}
              </div>}
            </div>
          ))}
          <button onClick={() => setModalEstado({ proyecto_id: vistaProyecto.id })} style={{ background: 'white', border: '2px dashed #00953B', borderRadius: '12px', padding: '16px', cursor: 'pointer', color: '#00953B', fontWeight: '600', fontSize: '14px', width: '100%' }}>
            + Añadir estado adicional
          </button>
        </div>

        {modalTareaEstado && (
          <Modal titulo="Nueva tarea directa" onClose={() => { setModalTareaEstado(null); setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '', descripcion: '' }) }} onSave={() => {
            if (!nuevaTarea.nombre) return
            const id = Date.now().toString()
            const asignadosStr = nuevaTarea.asignados.join(',')
            escribirFila('tareas', [id, '', '', modalTareaEstado.proyecto_id, nuevaTarea.nombre, asignadosStr, 'por_asignar', '', '', nuevaTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', nuevaTarea.fecha_limite, nuevaTarea.descripcion || '', Date.now().toString() + '_g', '', '', String(usuario.id)], accessToken).then(async () => { setModalTareaEstado(null); setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '', descripcion: '' }); await new Promise(r => setTimeout(r, 800)); cargarDatos() })
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input placeholder="Nombre de la tarea *" value={nuevaTarea.nombre} onChange={e => setNuevaTarea({ ...nuevaTarea, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <SelectorPersonas usuarios={usuarios} seleccionados={nuevaTarea.asignados} onChange={ids => setNuevaTarea({ ...nuevaTarea, asignados: ids })} />
              <div><label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite (opcional):</label><input type="date" value={nuevaTarea.fecha_limite} onChange={e => setNuevaTarea({ ...nuevaTarea, fecha_limite: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
            </div>
          </Modal>
        )}
        {modalTareaAccion && (
          <Modal titulo="Nueva tarea directa" onClose={() => { setModalTareaAccion(null); setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '', descripcion: '' }) }} onSave={() => {
            if (!nuevaTarea.nombre) return
            const id = Date.now().toString()
            const asignadosStr = nuevaTarea.asignados.join(',')
            escribirFila('tareas', [id, '', modalTareaAccion.accion_id, modalTareaAccion.proyecto_id, nuevaTarea.nombre, asignadosStr, 'por_asignar', '', '', nuevaTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', nuevaTarea.fecha_limite, nuevaTarea.descripcion || '', Date.now().toString() + '_g', '', '', String(usuario.id)], accessToken).then(async () => { setModalTareaAccion(null); setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '', fechas_exactas: '', descripcion: '' }); await new Promise(r => setTimeout(r, 800)); cargarDatos() })
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input placeholder="Nombre de la tarea *" value={nuevaTarea.nombre} onChange={e => setNuevaTarea({ ...nuevaTarea, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <SelectorPersonas usuarios={usuarios} seleccionados={nuevaTarea.asignados} onChange={ids => setNuevaTarea({ ...nuevaTarea, asignados: ids })} />
              <div><label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite (opcional):</label><input type="date" value={nuevaTarea.fecha_limite} onChange={e => setNuevaTarea({ ...nuevaTarea, fecha_limite: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} /></div>
            </div>
          </Modal>
        )}
        {modalEstado && (
          <Modal titulo="Añadir estado adicional" onClose={() => setModalEstado(null)} onSave={crearEstado}>
            <input placeholder="Nombre del estado *" value={nuevoEstado.nombre} onChange={e => setNuevoEstado({ nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
          </Modal>
        )}

        {modalAccion && (
          <Modal titulo="Nueva acción" onClose={() => setModalAccion(null)} onSave={crearAccion}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre de la acción *" value={nuevaAccion.nombre} onChange={e => setNuevaAccion({ ...nuevaAccion, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción (opcional)" value={nuevaAccion.descripcion} onChange={e => setNuevaAccion({ ...nuevaAccion, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                  <input type="date" value={nuevaAccion.fecha_inicio} onChange={e => setNuevaAccion({ ...nuevaAccion, fecha_inicio: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin estimada</label>
                  <input type="date" value={nuevaAccion.fecha_fin} onChange={e => setNuevaAccion({ ...nuevaAccion, fecha_fin: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
              </div>
            </div>
          </Modal>
        )}

        {modalEnsayo && (
          <Modal titulo="Nuevo ensayo o informe" onClose={() => setModalEnsayo(null)} onSave={crearEnsayo}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <select value={nuevoEnsayo.tipo} onChange={e => setNuevoEnsayo({ ...nuevoEnsayo, tipo: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="ensayo">Ensayo</option>
                <option value="informe">Informe</option>
              </select>
              <input placeholder="Nombre *" value={nuevoEnsayo.nombre} onChange={e => setNuevoEnsayo({ ...nuevoEnsayo, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción (opcional)" value={nuevoEnsayo.descripcion} onChange={e => setNuevoEnsayo({ ...nuevoEnsayo, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                  <input type="date" value={nuevoEnsayo.fecha_inicio} onChange={e => setNuevoEnsayo({ ...nuevoEnsayo, fecha_inicio: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin estimada</label>
                  <input type="date" value={nuevoEnsayo.fecha_fin} onChange={e => setNuevoEnsayo({ ...nuevoEnsayo, fecha_fin: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
              </div>
            </div>
          </Modal>
        )}

        {modalEventoProyecto && <ModalEvento titulo='Nuevo evento' contexto={modalEventoProyecto.contexto} origenId={modalEventoProyecto.origenId} origenTipo={modalEventoProyecto.origenTipo} usuario={usuario} accessToken={accessToken} onClose={() => setModalEventoProyecto(null)} onSave={async (fila) => { await escribirFila('eventos', fila, accessToken); cargarDatos() }} />}
        {modalesCompartidos}
      </div>
    )
  }

  // LISTA PROYECTOS
  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>📁 Proyectos</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {mostrarBuscador && <input autoFocus placeholder="Buscar proyecto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', width: '200px' }} />}
          <button onClick={() => { setMostrarBuscador(p => !p); if (mostrarBuscador) setBusqueda('') }} style={{ background: mostrarBuscador ? '#f0fdf4' : '#f3f4f6', color: mostrarBuscador ? '#00953B' : '#6b7280', border: `1px solid ${mostrarBuscador ? '#00953B' : '#e5e7eb'}`, borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '16px' }}>🔍</button>
          <button onClick={() => setModalProyecto(true)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nuevo proyecto</button>
        </div>
      </div>
      <div className="proyectos-lista">
        {proyectosActivos.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p style={{ fontSize: '48px' }}>📁</p><p>No hay proyectos. ¡Crea el primero!</p></div>}
        {proyectosActivos.filter(p => !busqueda || p.nombre?.toLowerCase().includes(busqueda.toLowerCase())).map(proyecto => (
          <div key={proyecto.id} className="proyecto-card" style={{ borderLeftColor: proyecto.color || '#6B7280', cursor: 'pointer' }} onClick={() => setVistaProyecto(proyecto)}>
            <div className="proyecto-header">
              <div>
                <h3>{proyecto.nombre}</h3>
                <span className="tipo-badge">{TIPOS.find(t => t.value === proyecto.tipo)?.label || proyecto.tipo}</span>
              </div>
              <span className="progreso-texto">{progresoProyecto(proyecto.id)}%</span>
            </div>
            <div className="barra-progreso">
              <div className="barra-fill" style={{ width: `${progresoProyecto(proyecto.id)}%`, backgroundColor: proyecto.color || '#6B7280' }}></div>
            </div>
            {proyecto.descripcion && <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#888' }}>{proyecto.descripcion}</p>}
          </div>
        ))}
      </div>
      {modalProyecto && (
        <Modal titulo="Nuevo proyecto" onClose={() => setModalProyecto(false)} onSave={crearProyecto}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input placeholder="Nombre del proyecto *" value={nuevoProyecto.nombre} onChange={e => setNuevoProyecto({ ...nuevoProyecto, nombre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            <textarea placeholder="Descripción (opcional)" value={nuevoProyecto.descripcion} onChange={e => setNuevoProyecto({ ...nuevoProyecto, descripcion: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            <select value={nuevoProyecto.tipo} onChange={e => setNuevoProyecto({ ...nuevoProyecto, tipo: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#555' }}>Color:</label>
              <input type="color" value={nuevoProyecto.color} onChange={e => setNuevoProyecto({ ...nuevoProyecto, color: e.target.value })} style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                <input type="date" value={nuevoProyecto.fecha_inicio} onChange={e => setNuevoProyecto({ ...nuevoProyecto, fecha_inicio: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin estimada</label>
                <input type="date" value={nuevoProyecto.fecha_fin} onChange={e => setNuevoProyecto({ ...nuevoProyecto, fecha_fin: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#166534' }}>
              ✓ Se crearán automáticamente los 6 estados del proceso I+D
            </div>
          </div>
        </Modal>
      )}
      {modalesCompartidos}
    </div>
  )
}
