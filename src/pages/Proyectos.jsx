import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja } from '../services/googleSheets'

function Proyectos() {
  const { accessToken } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [tareas, setTareas] = useState([])
  const [filtroPersona, setFiltroPersona] = useState('todos')
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [proyectosData, tareasData, usuariosData] = await Promise.all([
          leerHoja('proyectos', accessToken),
          leerHoja('tareas', accessToken),
          leerHoja('usuarios', accessToken)
        ])
        setProyectos(proyectosData.filter(p => p.estado === 'activo'))
        setTareas(tareasData)
        setUsuarios(usuariosData)
      } catch (error) {
        console.error('Error cargando proyectos:', error)
      } finally {
        setCargando(false)
      }
    }
    if (accessToken) cargarDatos()
  }, [accessToken])

  function tareasPorProyecto(proyectoId) {
    let t = tareas.filter(t => t.proyecto_id === proyectoId)
    if (filtroPersona !== 'todos') t = t.filter(t => t.asignado_a === filtroPersona)
    return t
  }

  function progreso(proyectoId) {
    const t = tareasPorProyecto(proyectoId)
    if (t.length === 0) return 0
    const completadas = t.filter(t => t.estado === 'Completada').length
    return Math.round((completadas / t.length) * 100)
  }

  function getNombreUsuario(id) {
    const u = usuarios.find(u => u.id === id)
    return u ? u.nombre : id
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando proyectos...</p></div>

  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>📁 Proyectos</h1>
        <div className="filtros">
          <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)} className="select-filtro">
            <option value="todos">Todos los miembros</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="proyectos-lista">
        {proyectos.map(proyecto => (
          <div key={proyecto.id} className="proyecto-card" style={{ borderLeftColor: proyecto.color || '#6B7280' }}>
            <div className="proyecto-header">
              <div>
                <h3>{proyecto.nombre}</h3>
                <span className={`tipo-badge ${proyecto.tipo}`}>{proyecto.tipo}</span>
              </div>
              <span className="progreso-texto">{progreso(proyecto.id)}%</span>
            </div>

            <div className="barra-progreso">
              <div className="barra-fill" style={{ width: `${progreso(proyecto.id)}%`, backgroundColor: proyecto.color || '#6B7280' }}></div>
            </div>

            <div className="tareas-lista">
              {tareasPorProyecto(proyecto.id).map(tarea => (
                <div key={tarea.id} className={`tarea-fila ${tarea.estado === 'Completada' ? 'completada' : ''}`}>
                  <span className="tarea-nombre-small">{tarea.nombre}</span>
                  <span className="tarea-asignado">{getNombreUsuario(tarea.asignado_a)}</span>
                  <span className={`estado-small estado-${tarea.estado?.toLowerCase().replace(' ', '-')}`}>{tarea.estado || 'Pendiente'}</span>
                </div>
              ))}
              {tareasPorProyecto(proyecto.id).length === 0 && (
                <p className="sin-tareas">No hay tareas para este filtro</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Proyectos