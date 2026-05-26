import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, escribirFila } from '../services/googleSheets'

function Proyectos() {
  const { accessToken, usuario } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [tareas, setTareas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [filtroPersona, setFiltroPersona] = useState('todos')
  const [cargando, setCargando] = useState(true)
  const [modalProyecto, setModalProyecto] = useState(false)
  const [modalTarea, setModalTarea] = useState(false)
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null)

  const [nuevoProyecto, setNuevoProyecto] = useState({
    nombre: '', tipo: 'fijo', color: '#00953B', descripcion: ''
  })
  const [nuevaTarea, setNuevaTarea] = useState({
    nombre: '', asignado_a: '', dia_semana: 'por_asignar'
  })

  useEffect(() => {
    if (accessToken) cargarDatos()
  }, [accessToken])

  async function cargarDatos() {
    try {
      const [p, t, u] = await Promise.all([
        leerHoja('proyectos', accessToken),
        leerHoja('tareas', accessToken),
        leerHoja('usuarios', accessToken)
      ])
      setProyectos(p.filter(x => x.estado === 'activo'))
      setTareas(t)
      setUsuarios(u)
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  async function crearProyecto() {
    console.log("creando proyecto", nuevoProyecto, accessToken)
    if (!nuevoProyecto.nombre) return
    const id = Date.now().toString()
    const fila = [id, nuevoProyecto.nombre, nuevoProyecto.tipo, 'activo', nuevoProyecto.color, '', '', nuevoProyecto.descripcion]
    await escribirFila('proyectos', fila, accessToken)
    setModalProyecto(false)
    setNuevoProyecto({ nombre: '', tipo: 'fijo', color: '#00953B', descripcion: '' })
    cargarDatos()
  }

  async function crearTarea() {
    if (!nuevaTarea.nombre || !proyectoSeleccionado) return
    const id = Date.now().toString()
    const fila = [id, proyectoSeleccionado.id, nuevaTarea.nombre, nuevaTarea.asignado_a || usuario.id, nuevaTarea.dia_semana, 'Pendiente', new Date().toISOString()]
    await escribirFila('tareas', fila, accessToken)
    setModalTarea(false)
    setNuevaTarea({ nombre: '', asignado_a: '', dia_semana: 'por_asignar' })
    cargarDatos()
  }

  function tareasPorProyecto(proyectoId) {
    let t = tareas.filter(t => t.proyecto_id === proyectoId)
    if (filtroPersona !== 'todos') t = t.filter(t => t.asignado_a === filtroPersona)
    return t
  }

  function progreso(proyectoId) {
    const t = tareasPorProyecto(proyectoId)
    if (t.length === 0) return 0
    return Math.round((t.filter(t => t.estado === 'Completada').length / t.length) * 100)
  }

  function getNombre(id) {
    const u = usuarios.find(u => u.id === id)
    return u ? u.nombre ? u.nombre.split(' ')[0] : u.id : id
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>📁 Proyectos</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)} className="select-filtro">
            <option value="todos">Todos los miembros</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre ? u.nombre.split(' ')[0] : u.id}</option>)}
          </select>
          <button onClick={() => setModalProyecto(true)} style={{
            background: '#00953B', color: 'white', border: 'none', borderRadius: '8px',
            padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
          }}>+ Nuevo proyecto</button>
        </div>
      </div>

      <div className="proyectos-lista">
        {proyectos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
            <p style={{ fontSize: '48px' }}>📁</p>
            <p>No hay proyectos activos. ¡Crea el primero!</p>
          </div>
        )}
        {proyectos.map(proyecto => (
          <div key={proyecto.id} className="proyecto-card" style={{ borderLeftColor: proyecto.color || '#6B7280' }}>
            <div className="proyecto-header">
              <div>
                <h3>{proyecto.nombre}</h3>
                <span className={`tipo-badge ${proyecto.tipo}`}>{proyecto.tipo}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="progreso-texto">{progreso(proyecto.id)}%</span>
                <button onClick={() => { setProyectoSeleccionado(proyecto); setModalTarea(true) }} style={{
                  background: '#00953B', color: 'white', border: 'none', borderRadius: '6px',
                  padding: '4px 10px', cursor: 'pointer', fontSize: '12px'
                }}>+ Tarea</button>
              </div>
            </div>
            <div className="barra-progreso">
              <div className="barra-fill" style={{ width: `${progreso(proyecto.id)}%`, backgroundColor: proyecto.color || '#6B7280' }}></div>
            </div>
            <div className="tareas-lista">
              {tareasPorProyecto(proyecto.id).map(tarea => (
                <div key={tarea.id} className={`tarea-fila ${tarea.estado === 'Completada' ? 'completada' : ''}`}>
                  <span className="tarea-nombre-small">{tarea.nombre}</span>
                  <span className="tarea-asignado">{getNombre(tarea.asignado_a)}</span>
                  <span className={`estado-small estado-${tarea.estado?.toLowerCase().replace(' ', '-')}`}>{tarea.estado || 'Pendiente'}</span>
                </div>
              ))}
              {tareasPorProyecto(proyecto.id).length === 0 && (
                <p className="sin-tareas">Sin tareas aún</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {modalProyecto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ marginBottom: '24px', color: '#373A36' }}>Nuevo proyecto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre del proyecto" value={nuevoProyecto.nombre}
                onChange={e => setNuevoProyecto({...nuevoProyecto, nombre: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <select value={nuevoProyecto.tipo} onChange={e => setNuevoProyecto({...nuevoProyecto, tipo: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="fijo">Fijo (larga duración)</option>
                <option value="temporal">Temporal</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '14px', color: '#555' }}>Color:</label>
                <input type="color" value={nuevoProyecto.color}
                  onChange={e => setNuevoProyecto({...nuevoProyecto, color: e.target.value})}
                  style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
              </div>
              <textarea placeholder="Descripción (opcional)" value={nuevoProyecto.descripcion}
                onChange={e => setNuevoProyecto({...nuevoProyecto, descripcion: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setModalProyecto(false)} style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd',
                background: 'white', cursor: 'pointer', fontSize: '14px'
              }}>Cancelar</button>
              <button onClick={crearProyecto} style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                background: '#00953B', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
              }}>Crear proyecto</button>
            </div>
          </div>
        </div>
      )}

      {modalTarea && proyectoSeleccionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ marginBottom: '8px', color: '#373A36' }}>Nueva tarea</h2>
            <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>Proyecto: {proyectoSeleccionado.nombre}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre de la tarea" value={nuevaTarea.nombre}
                onChange={e => setNuevaTarea({...nuevaTarea, nombre: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <select value={nuevaTarea.asignado_a} onChange={e => setNuevaTarea({...nuevaTarea, asignado_a: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="">Asignar a...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre ? u.nombre.split(' ')[0] : u.id}</option>)}
              </select>
              <select value={nuevaTarea.dia_semana} onChange={e => setNuevaTarea({...nuevaTarea, dia_semana: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="por_asignar">Por asignar</option>
                <option value="lunes">Lunes</option>
                <option value="martes">Martes</option>
                <option value="miercoles">Miércoles</option>
                <option value="jueves">Jueves</option>
                <option value="viernes">Viernes</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setModalTarea(false)} style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd',
                background: 'white', cursor: 'pointer', fontSize: '14px'
              }}>Cancelar</button>
              <button onClick={crearTarea} style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                background: '#00953B', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
              }}>Crear tarea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Proyectos
