import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja } from '../services/googleSheets'

function Dashboard() {
  const { accessToken } = useAuth()
  const [registros, setRegistros] = useState([])
  const [tareas, setTareas] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [registrosData, tareasData, proyectosData, usuariosData] = await Promise.all([
          leerHoja('registros', accessToken),
          leerHoja('tareas', accessToken),
          leerHoja('proyectos', accessToken),
          leerHoja('usuarios', accessToken)
        ])
        setRegistros(registrosData)
        setTareas(tareasData)
        setProyectos(proyectosData.filter(p => p.estado === 'activo'))
        setUsuarios(usuariosData)
      } catch (error) {
        console.error('Error cargando dashboard:', error)
      } finally {
        setCargando(false)
      }
    }
    if (accessToken) cargarDatos()
  }, [accessToken])

  function horasTotalesEquipo() {
    return Math.round(registros.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0) / 3600 * 10) / 10
  }

  function tareasCompletadas() {
    return tareas.filter(t => t.estado === 'Completada').length
  }

  function miembroMasActivo() {
    const horas = {}
    registros.forEach(r => {
      horas[r.usuario_id] = (horas[r.usuario_id] || 0) + Number(r.duracion_segundos || 0)
    })
    const maxId = Object.entries(horas).sort((a, b) => b[1] - a[1])[0]?.[0]
    const usuario = usuarios.find(u => u.id === maxId)
    return usuario?.nombre || '-'
  }

  function horasPorPersona() {
    return usuarios.map(u => {
      const segundos = registros
        .filter(r => r.usuario_id === u.id)
        .reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
      return { nombre: u.nombre, horas: Math.round(segundos / 3600 * 10) / 10 }
    })
  }

  function horasPorProyecto() {
    return proyectos.map(p => {
      const tareasProyecto = tareas.filter(t => t.proyecto_id === p.id).map(t => t.id)
      const segundos = registros
        .filter(r => tareasProyecto.includes(r.tarea_id))
        .reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
      return { nombre: p.nombre, horas: Math.round(segundos / 3600 * 10) / 10, color: p.color }
    })
  }

  const porPersona = horasPorPersona()
  const porProyecto = horasPorProyecto()
  const maxPersona = Math.max(...porPersona.map(p => p.horas), 1)
  const maxProyecto = Math.max(...porProyecto.map(p => p.horas), 1)

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando dashboard...</p></div>

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>🎯 Dashboard global</h1>
        <p>Vista del equipo I+D · Fertinyect</p>
      </div>

      <div className="metrica-cards">
        <div className="metrica-card">
          <h4>Horas equipo</h4>
          <p className="metrica-valor">{horasTotalesEquipo()}h</p>
        </div>
        <div className="metrica-card">
          <h4>Tareas completadas</h4>
          <p className="metrica-valor">{tareasCompletadas()}</p>
        </div>
        <div className="metrica-card">
          <h4>Proyectos activos</h4>
          <p className="metrica-valor">{proyectos.length}</p>
        </div>
        <div className="metrica-card">
          <h4>Más activo</h4>
          <p className="metrica-valor">{miembroMasActivo()}</p>
        </div>
      </div>

      <div className="grafica-card">
        <h3>Tiempo por persona</h3>
        <div className="barras-horizontales">
          {porPersona.map(p => (
            <div key={p.nombre} className="barra-h-row">
              <span className="barra-h-label">{p.nombre}</span>
              <div className="barra-h-track">
                <div className="barra-h-fill" style={{ width: `${(p.horas / maxPersona) * 100}%`, backgroundColor: '#10B981' }}></div>
              </div>
              <span className="barra-h-valor">{p.horas}h</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grafica-card">
        <h3>Tiempo por proyecto</h3>
        <div className="barras-horizontales">
          {porProyecto.map(p => (
            <div key={p.nombre} className="barra-h-row">
              <span className="barra-h-label">{p.nombre}</span>
              <div className="barra-h-track">
                <div className="barra-h-fill" style={{ width: `${(p.horas / maxProyecto) * 100}%`, backgroundColor: p.color || '#6B7280' }}></div>
              </div>
              <span className="barra-h-valor">{p.horas}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard