import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado } from '../services/googleSheets'

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

export default function Proyectos() {
  const { accessToken } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [estados, setEstados] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [tareas, setTareas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [vistaProyecto, setVistaProyecto] = useState(null)
  const [vistaEnsayo, setVistaEnsayo] = useState(null)

  const [modalProyecto, setModalProyecto] = useState(false)
  const [modalAccion, setModalAccion] = useState(null)
  const [modalEnsayo, setModalEnsayo] = useState(null)
  const [modalTarea, setModalTarea] = useState(null)
  const [modalEstado, setModalEstado] = useState(null)

  const [editProyecto, setEditProyecto] = useState(null)
  const [editAccion, setEditAccion] = useState(null)
  const [editEnsayo, setEditEnsayo] = useState(null)
  const [editTarea, setEditTarea] = useState(null)

  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const [nuevoProyecto, setNuevoProyecto] = useState({ nombre: '', descripcion: '', tipo: 'medio_plazo', color: '#00953B', fecha_inicio: '', fecha_fin: '' })
  const [nuevaAccion, setNuevaAccion] = useState({ nombre: '', descripcion: '' })
  const [nuevoEnsayo, setNuevoEnsayo] = useState({ nombre: '', tipo: 'ensayo', descripcion: '' })
  const [nuevaTarea, setNuevaTarea] = useState({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' })
  const [nuevoEstado, setNuevoEstado] = useState({ nombre: '' })

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

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
    await escribirFila('acciones', [id, modalAccion.estado_id, modalAccion.proyecto_id, nuevaAccion.nombre, nuevaAccion.descripcion, new Date().toISOString()], accessToken)
    setModalAccion(null)
    setNuevaAccion({ nombre: '', descripcion: '' })
    cargarDatos()
  }

  async function guardarEditAccion() {
    if (!editAccion) return
    await actualizarFila('acciones', editAccion.id, [editAccion.id, editAccion.estado_id, editAccion.proyecto_id, editAccion.nombre, editAccion.descripcion, editAccion.fecha_creacion], accessToken)
    setEditAccion(null)
    cargarDatos()
  }

  async function crearEnsayo() {
    if (!nuevoEnsayo.nombre || !modalEnsayo) return
    const id = Date.now().toString()
    await escribirFila('ensayos', [id, modalEnsayo.accion_id, modalEnsayo.proyecto_id, nuevoEnsayo.tipo, nuevoEnsayo.nombre, nuevoEnsayo.descripcion, new Date().toISOString()], accessToken)
    setModalEnsayo(null)
    setNuevoEnsayo({ nombre: '', tipo: 'ensayo', descripcion: '' })
    cargarDatos()
  }

  async function guardarEditEnsayo() {
    if (!editEnsayo) return
    await actualizarFila('ensayos', editEnsayo.id, [editEnsayo.id, editEnsayo.accion_id, editEnsayo.proyecto_id, editEnsayo.tipo, editEnsayo.nombre, editEnsayo.descripcion, editEnsayo.fecha_creacion], accessToken)
    setVistaEnsayo(editEnsayo)
    setEditEnsayo(null)
    cargarDatos()
  }

  async function crearTarea() {
    if (!nuevaTarea.nombre || !modalTarea) return
    const id = Date.now().toString()
    const asignadosStr = nuevaTarea.asignados.join(',')
    const diaRec = [nuevaTarea.dia_recomendado, nuevaTarea.fecha_recomendada].filter(Boolean).join(' ')
    await escribirFila('tareas', [id, modalTarea.ensayo_id, modalTarea.accion_id, modalTarea.proyecto_id, nuevaTarea.nombre, asignadosStr, 'por_asignar', diaRec, nuevaTarea.fecha_limite, 'pendiente', new Date().toISOString()], accessToken)
    setModalTarea(null)
    setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' })
    cargarDatos()
  }

  async function guardarEditTarea() {
    if (!editTarea) return
    const asignadosStr = Array.isArray(editTarea.asignados) ? editTarea.asignados.join(',') : editTarea.asignados
    const diaRec = [editTarea.dia_recomendado, editTarea.fecha_recomendada].filter(Boolean).join(' ')
    await actualizarFila('tareas', editTarea.id, [editTarea.id, editTarea.ensayo_id, editTarea.accion_id, editTarea.proyecto_id, editTarea.nombre, asignadosStr, editTarea.dia_semana, diaRec, editTarea.fecha_limite, editTarea.estado, editTarea.fecha_creacion], accessToken)
    setEditTarea(null)
    cargarDatos()
  }

  async function ejecutarEliminar() {
    if (!confirmEliminar) return
    const { tipo, item } = confirmEliminar
    if (tipo === 'proyecto') {
      await actualizarFila('proyectos', item.id, [item.id, item.nombre, item.descripcion, item.tipo, item.color, item.fecha_inicio, item.fecha_fin, 'eliminado'], accessToken)
      setVistaProyecto(null)
    } else if (tipo === 'estado') {
      await marcarEliminado('estados_proyecto', item.id, accessToken)
    } else if (tipo === 'accion') {
      await marcarEliminado('acciones', item.id, accessToken)
    } else if (tipo === 'ensayo') {
      await marcarEliminado('ensayos', item.id, accessToken)
      if (vistaEnsayo?.id === item.id) setVistaEnsayo(null)
    } else if (tipo === 'tarea') {
      await marcarEliminado('tareas', item.id, accessToken)
    }
    setConfirmEliminar(null)
    cargarDatos()
  }

  function getNombre(id) {
    const u = usuarios.find(u => u.id === id)
    return u ? (u.nombre ? u.nombre.split(' ')[0] : id) : id
  }

  function estadosDeProyecto(pId) { return estados.filter(e => e.proyecto_id === pId).sort((a, b) => Number(a.orden) - Number(b.orden)) }
  function accionesDeEstado(eId) { return acciones.filter(a => a.estado_id === eId) }
  function ensayosDeAccion(aId) { return ensayos.filter(e => e.accion_id === aId) }
  function tareasDeEnsayo(eId) { return tareas.filter(t => t.ensayo_id === eId) }
  function progresoProyecto(pId) {
    const t = tareas.filter(t => t.proyecto_id === pId)
    if (!t.length) return 0
    return Math.round((t.filter(t => t.estado === 'completada').length / t.length) * 100)
  }

  const proyectosActivos = proyectos.filter(p => p.fecha_creacion !== 'eliminado' && p.id)

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

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
            <BtnAccion tipo="editar" onClick={() => setEditEnsayo({...vistaEnsayo})}>✏️ Editar</BtnAccion>
            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'ensayo', item: vistaEnsayo })}>🗑 Eliminar</BtnAccion>
            <button onClick={() => setModalTarea({ ensayo_id: vistaEnsayo.id, accion_id: vistaEnsayo.accion_id, proyecto_id: vistaEnsayo.proyecto_id })} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva tarea</button>
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
                    <p style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '15px', textDecoration: tarea.estado === 'completada' ? 'line-through' : 'none' }}>{tarea.nombre}</p>
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#888' }}>📁 {vistaEnsayo.nombre}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {asignados.map(id => <span key={id} style={{ background: '#f0fdf4', color: '#00953B', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>{getNombre(id)}</span>)}
                      {tarea.dia_recomendado && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '2px 8px', fontSize: '11px' }}>📌 {tarea.dia_recomendado}</span>}
                      {tarea.fecha_limite && <span style={{ background: vencida ? '#fee2e2' : proxima ? '#fef3c7' : '#f3f4f6', color: vencida ? '#dc2626' : proxima ? '#92400e' : '#6b7280', borderRadius: '20px', padding: '2px 8px', fontSize: '11px' }}>{vencida ? '⚠️ Vencida' : '📅'} {tarea.fecha_limite}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '12px' }}>
                    <BtnAccion tipo="editar" onClick={() => setEditTarea({ ...tarea, asignados: tarea.asignados ? tarea.asignados.split(',').filter(Boolean) : [] })}>✏️</BtnAccion>
                    <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'tarea', item: tarea })}>🗑</BtnAccion>
                    <span style={{ background: tarea.estado === 'completada' ? '#dcfce7' : tarea.estado === 'en_curso' ? '#dbeafe' : '#f3f4f6', color: tarea.estado === 'completada' ? '#166534' : tarea.estado === 'en_curso' ? '#1d4ed8' : '#6b7280', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>{tarea.estado || 'pendiente'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {modalTarea && (
          <Modal titulo="Nueva tarea" onClose={() => { setModalTarea(null); setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' }) }} onSave={crearTarea}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#166534' }}>📁 Ensayo: <strong>{vistaEnsayo.nombre}</strong></div>
              <input placeholder="Nombre de la tarea *" value={nuevaTarea.nombre} onChange={e => setNuevaTarea({...nuevaTarea, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Asignar a:</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {usuarios.map(u => <button key={u.id} onClick={() => setNuevaTarea(prev => ({ ...prev, asignados: prev.asignados.includes(u.id) ? prev.asignados.filter(id => id !== u.id) : [...prev.asignados, u.id] }))} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: nuevaTarea.asignados.includes(u.id) ? '#00953B' : '#f3f4f6', color: nuevaTarea.asignados.includes(u.id) ? 'white' : '#373A36', border: nuevaTarea.asignados.includes(u.id) ? '2px solid #00953B' : '2px solid #e5e7eb' }}>{u.nombre ? u.nombre.split(' ')[0] : u.id}</button>)}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Día recomendado (opcional):</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={nuevaTarea.dia_recomendado} onChange={e => setNuevaTarea({...nuevaTarea, dia_recomendado: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                    <option value="">Sin día específico</option>
                    {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                  <input type="date" value={nuevaTarea.fecha_recomendada} onChange={e => setNuevaTarea({...nuevaTarea, fecha_recomendada: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite (opcional):</label>
                <input type="date" value={nuevaTarea.fecha_limite} onChange={e => setNuevaTarea({...nuevaTarea, fecha_limite: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
          </Modal>
        )}

        {editTarea && (
          <Modal titulo="Editar tarea" onClose={() => setEditTarea(null)} onSave={guardarEditTarea}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre *" value={editTarea.nombre} onChange={e => setEditTarea({...editTarea, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Asignar a:</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {usuarios.map(u => <button key={u.id} onClick={() => setEditTarea(prev => ({ ...prev, asignados: prev.asignados.includes(u.id) ? prev.asignados.filter(id => id !== u.id) : [...prev.asignados, u.id] }))} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: editTarea.asignados.includes(u.id) ? '#00953B' : '#f3f4f6', color: editTarea.asignados.includes(u.id) ? 'white' : '#373A36', border: editTarea.asignados.includes(u.id) ? '2px solid #00953B' : '2px solid #e5e7eb' }}>{u.nombre ? u.nombre.split(' ')[0] : u.id}</button>)}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Día recomendado:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={editTarea.dia_recomendado || ''} onChange={e => setEditTarea({...editTarea, dia_recomendado: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                    <option value="">Sin día específico</option>
                    {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                  <input type="date" value={editTarea.fecha_recomendada || ''} onChange={e => setEditTarea({...editTarea, fecha_recomendada: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite:</label>
                <input type="date" value={editTarea.fecha_limite || ''} onChange={e => setEditTarea({...editTarea, fecha_limite: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
          </Modal>
        )}

        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

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
            <BtnAccion tipo="editar" onClick={() => setEditProyecto({...vistaProyecto})}>✏️ Editar</BtnAccion>
            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'proyecto', item: vistaProyecto })}>🗑 Eliminar</BtnAccion>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {estadosProyecto.map(estado => (
            <div key={estado.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#373A36' }}>
                  <span style={{ color: '#00953B', marginRight: '8px' }}>{estado.orden}.</span>{estado.nombre}
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'estado', item: estado })}>🗑</BtnAccion>
                  <BtnAccion tipo="añadir" onClick={() => setModalAccion({ estado_id: estado.id, proyecto_id: vistaProyecto.id })}>+ Acción</BtnAccion>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accionesDeEstado(estado.id).map(accion => (
                  <div key={accion.id} style={{ background: '#f8f9fa', borderRadius: '8px', padding: '14px', borderLeft: `3px solid ${vistaProyecto.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '14px' }}>{accion.nombre}</p>
                        {accion.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{accion.descripcion}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <BtnAccion tipo="editar" onClick={() => setEditAccion({...accion})}>✏️</BtnAccion>
                        <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'accion', item: accion })}>🗑</BtnAccion>
                        <BtnAccion tipo="añadir" onClick={() => setModalEnsayo({ accion_id: accion.id, proyecto_id: vistaProyecto.id })}>+ Ensayo/Informe</BtnAccion>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ensayosDeAccion(accion.id).map(ensayo => (
                        <div key={ensayo.id} style={{ background: 'white', borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div onClick={() => setVistaEnsayo(ensayo)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }} onMouseOver={e => e.currentTarget.style.opacity = '0.7'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                            <span style={{ background: ensayo.tipo === 'ensayo' ? '#dbeafe' : '#fef3c7', color: ensayo.tipo === 'ensayo' ? '#1d4ed8' : '#92400e', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: '600' }}>{ensayo.tipo === 'ensayo' ? 'ENSAYO' : 'INFORME'}</span>
                            <span style={{ fontSize: '13px' }}>{ensayo.nombre}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#888' }}>{tareasDeEnsayo(ensayo.id).length} tareas</span>
                            <BtnAccion tipo="editar" onClick={() => setEditEnsayo({...ensayo})}>✏️</BtnAccion>
                            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'ensayo', item: ensayo })}>🗑</BtnAccion>
                            <span onClick={() => setVistaEnsayo(ensayo)} style={{ color: '#00953B', fontSize: '14px', cursor: 'pointer' }}>→</span>
                          </div>
                        </div>
                      ))}
                      {ensayosDeAccion(accion.id).length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Sin ensayos ni informes aún</p>}
                    </div>
                  </div>
                ))}
                {accionesDeEstado(estado.id).length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>Sin acciones aún</p>}
              </div>
            </div>
          ))}
          <button onClick={() => setModalEstado({ proyecto_id: vistaProyecto.id })} style={{ background: 'white', border: '2px dashed #00953B', borderRadius: '12px', padding: '16px', cursor: 'pointer', color: '#00953B', fontWeight: '600', fontSize: '14px', width: '100%' }}>
            + Añadir estado adicional
          </button>
        </div>

        {editProyecto && (
          <Modal titulo="Editar proyecto" onClose={() => setEditProyecto(null)} onSave={guardarEditProyecto}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre *" value={editProyecto.nombre} onChange={e => setEditProyecto({...editProyecto, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción" value={editProyecto.descripcion || ''} onChange={e => setEditProyecto({...editProyecto, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              <select value={editProyecto.tipo} onChange={e => setEditProyecto({...editProyecto, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '14px', color: '#555' }}>Color:</label>
                <input type="color" value={editProyecto.color} onChange={e => setEditProyecto({...editProyecto, color: e.target.value})} style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                  <input type="date" value={editProyecto.fecha_inicio || ''} onChange={e => setEditProyecto({...editProyecto, fecha_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin</label>
                  <input type="date" value={editProyecto.fecha_fin || ''} onChange={e => setEditProyecto({...editProyecto, fecha_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
              </div>
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
              <input placeholder="Nombre de la acción *" value={nuevaAccion.nombre} onChange={e => setNuevaAccion({...nuevaAccion, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción (opcional)" value={nuevaAccion.descripcion} onChange={e => setNuevaAccion({...nuevaAccion, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            </div>
          </Modal>
        )}

        {editAccion && (
          <Modal titulo="Editar acción" onClose={() => setEditAccion(null)} onSave={guardarEditAccion}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre *" value={editAccion.nombre} onChange={e => setEditAccion({...editAccion, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción" value={editAccion.descripcion || ''} onChange={e => setEditAccion({...editAccion, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            </div>
          </Modal>
        )}

        {modalEnsayo && (
          <Modal titulo="Nuevo ensayo o informe" onClose={() => setModalEnsayo(null)} onSave={crearEnsayo}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <select value={nuevoEnsayo.tipo} onChange={e => setNuevoEnsayo({...nuevoEnsayo, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="ensayo">Ensayo</option>
                <option value="informe">Informe</option>
              </select>
              <input placeholder="Nombre *" value={nuevoEnsayo.nombre} onChange={e => setNuevoEnsayo({...nuevoEnsayo, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción (opcional)" value={nuevoEnsayo.descripcion} onChange={e => setNuevoEnsayo({...nuevoEnsayo, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            </div>
          </Modal>
        )}

        {editEnsayo && (
          <Modal titulo="Editar ensayo/informe" onClose={() => setEditEnsayo(null)} onSave={guardarEditEnsayo}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <select value={editEnsayo.tipo} onChange={e => setEditEnsayo({...editEnsayo, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="ensayo">Ensayo</option>
                <option value="informe">Informe</option>
              </select>
              <input placeholder="Nombre *" value={editEnsayo.nombre} onChange={e => setEditEnsayo({...editEnsayo, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción" value={editEnsayo.descripcion || ''} onChange={e => setEditEnsayo({...editEnsayo, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            </div>
          </Modal>
        )}

        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>📁 Proyectos</h1>
        <button onClick={() => setModalProyecto(true)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nuevo proyecto</button>
      </div>

      <div className="proyectos-lista">
        {proyectosActivos.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p style={{ fontSize: '48px' }}>📁</p><p>No hay proyectos. ¡Crea el primero!</p></div>}
        {proyectosActivos.map(proyecto => (
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
            <input placeholder="Nombre del proyecto *" value={nuevoProyecto.nombre} onChange={e => setNuevoProyecto({...nuevoProyecto, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            <textarea placeholder="Descripción (opcional)" value={nuevoProyecto.descripcion} onChange={e => setNuevoProyecto({...nuevoProyecto, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            <select value={nuevoProyecto.tipo} onChange={e => setNuevoProyecto({...nuevoProyecto, tipo: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#555' }}>Color:</label>
              <input type="color" value={nuevoProyecto.color} onChange={e => setNuevoProyecto({...nuevoProyecto, color: e.target.value})} style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                <input type="date" value={nuevoProyecto.fecha_inicio} onChange={e => setNuevoProyecto({...nuevoProyecto, fecha_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin estimada</label>
                <input type="date" value={nuevoProyecto.fecha_fin} onChange={e => setNuevoProyecto({...nuevoProyecto, fecha_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#166534' }}>
              ✓ Se crearán automáticamente los 6 estados del proceso I+D
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
EOF