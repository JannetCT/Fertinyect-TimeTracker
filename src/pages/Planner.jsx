import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja } from '../services/googleSheets'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

function Planner() {
  const { usuario, accessToken } = useAuth()
  const [tareas, setTareas] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [etiquetas, setEtiquetas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [tareasData, proyectosData, etiquetasData] = await Promise.all([
          leerHoja('tareas', accessToken),
          leerHoja('proyectos', accessToken),
          leerHoja('etiquetas', accessToken)
        ])
        setTareas(tareasData.filter(t => t.asignado_a === usuario.id))
        setProyectos(proyectosData)
        setEtiquetas(etiquetasData.filter(e => e.activa === 'TRUE'))
      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        setCargando(false)
      }
    }
    if (accessToken) cargarDatos()
  }, [accessToken])

  function tareasPorDia(dia) {
    return tareas.filter(t => t.dia_semana === dia)
  }

  function tareasBacklog() {
    return tareas.filter(t => !t.dia_semana || t.dia_semana === '')
  }

  function getEtiqueta(nombre) {
    return etiquetas.find(e => e.nombre === nombre)
  }

  function getProyecto(id) {
    return proyectos.find(p => p.id === id)
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando planner...</p></div>

  return (
    <div className="planner-container">
      <div className="planner-header">
        <h1>📅 Planner semanal</h1>
        <p>Semana actual · {usuario.nombre}</p>
      </div>

      <div className="planner-grid">
        {DIAS.map(dia => (
          <div key={dia} className="planner-column">
            <div className="column-header">
              <h3>{dia}</h3>
              <span className="task-count">{tareasPorDia(dia).length}</span>
            </div>
            <div className="column-tasks">
              {tareasPorDia(dia).map(tarea => (
                <TarjetaTarea
                  key={tarea.id}
                  tarea={tarea}
                  proyecto={getProyecto(tarea.proyecto_id)}
                  etiqueta={getEtiqueta(tarea.etiquetas)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="planner-column backlog">
          <div className="column-header">
            <h3>📥 Por asignar</h3>
            <span className="task-count">{tareasBacklog().length}</span>
          </div>
          <div className="column-tasks">
            {tareasBacklog().map(tarea => (
              <TarjetaTarea
                key={tarea.id}
                tarea={tarea}
                proyecto={getProyecto(tarea.proyecto_id)}
                etiqueta={getEtiqueta(tarea.etiquetas)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TarjetaTarea({ tarea, proyecto, etiqueta }) {
  const esCompletada = tarea.estado === 'Completada'
  const esEnCurso = tarea.estado === 'En curso'
  const tieneDeadline = tarea.fecha_deadline && new Date(tarea.fecha_deadline) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)

  return (
    <div className={`tarea-card ${esCompletada ? 'completada' : ''} ${esEnCurso ? 'en-curso' : ''} ${tieneDeadline && !esCompletada ? 'deadline-proximo' : ''}`}>
      {etiqueta && (
        <span className="etiqueta" style={{ backgroundColor: etiqueta.color }}>
          {etiqueta.nombre}
        </span>
      )}
      <p className={`tarea-nombre ${esCompletada ? 'tachado' : ''}`}>{tarea.nombre}</p>
      {proyecto && <p className="tarea-proyecto">{proyecto.nombre}</p>}
      <div className="tarea-footer">
        <span className={`estado-badge estado-${tarea.estado?.toLowerCase().replace(' ', '-')}`}>
          {tarea.estado || 'Pendiente'}
        </span>
      </div>
    </div>
  )
}

export default Planner