import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja } from '../services/googleSheets'

function Graficas() {
  const { usuario, accessToken } = useAuth()
  const [registros, setRegistros] = useState([])
  const [tareas, setTareas] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [registrosData, tareasData, proyectosData] = await Promise.all([
          leerHoja('registros', accessToken),
          leerHoja('tareas', accessToken),
          leerHoja('proyectos', accessToken)
        ])
        setRegistros(registrosData.filter(r => r.usuario_id === usuario.id))
        setTareas(tareasData)
        setProyectos(proyectosData)
      } catch (error) {
        console.error('Error cargando gráficas:', error)
      } finally {
        setCargando(false)
      }
    }
    if (accessToken) cargarDatos()
  }, [accessToken])

  function tiempoPorProyecto() {
    const resultado = {}
    registros.forEach(r => {
      const tarea = tareas.find(t => t.id === r.tarea_id)
      if (!tarea) return
      const proyecto = proyectos.find(p => p.id === tarea.proyecto_id)
      if (!proyecto) return
      const nombre = proyecto.nombre
      resultado[nombre] = (resultado[nombre] || 0) + Number(r.duracion_segundos || 0)
    })
    return Object.entries(resultado).map(([nombre, segundos]) => ({
      nombre,
      horas: Math.round(segundos / 3600 * 10) / 10,
      color: proyectos.find(p => p.nombre === nombre)?.color || '#6B7280'
    }))
  }

  function tiempoPorDia() {
    const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
    const resultado = {}
    dias.forEach(d => resultado[d] = 0)
    registros.forEach(r => {
      if (!r.fecha) return
      const fecha = new Date(r.fecha)
      const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][fecha.getDay()]
      if (resultado[dia] !== undefined) {
        resultado[dia] += Number(r.duracion_segundos || 0)
      }
    })
    return dias.map(d => ({ dia: d, horas: Math.round(resultado[d] / 3600 * 10) / 10 }))
  }

  function totalHorasSemana() {
    return registros.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0) / 3600
  }

  const porProyecto = tiempoPorProyecto()
  const porDia = tiempoPorDia()
  const maxHoras = Math.max(...porProyecto.map(p => p.horas), 1)
  const maxDia = Math.max(...porDia.map(d => d.horas), 1)

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando gráficas...</p></div>

  return (
    <div className="graficas-container">
      <div className="graficas-header">
        <h1>📊 Mis gráficas</h1>
        <p>Semana actual · {usuario.nombre}</p>
      </div>

      <div className="metrica-cards">
        <div className="metrica-card">
          <h4>Horas esta semana</h4>
          <p className="metrica-valor">{Math.round(totalHorasSemana() * 10) / 10}h</p>
        </div>
        <div className="metrica-card">
          <h4>Proyectos activos</h4>
          <p className="metrica-valor">{porProyecto.length}</p>
        </div>
      </div>

      <div className="grafica-card">
        <h3>Tiempo por proyecto</h3>
        <div className="barras-horizontales">
          {porProyecto.map(p => (
            <div key={p.nombre} className="barra-h-row">
              <span className="barra-h-label">{p.nombre}</span>
              <div className="barra-h-track">
                <div className="barra-h-fill" style={{ width: `${(p.horas / maxHoras) * 100}%`, backgroundColor: p.color }}></div>
              </div>
              <span className="barra-h-valor">{p.horas}h</span>
            </div>
          ))}
          {porProyecto.length === 0 && <p className="sin-datos">Sin registros esta semana</p>}
        </div>
      </div>

      <div className="grafica-card">
        <h3>Distribución diaria</h3>
        <div className="barras-verticales">
          {porDia.map(d => (
            <div key={d.dia} className="barra-v-col">
              <span className="barra-v-valor">{d.horas}h</span>
              <div className="barra-v-track">
                <div className="barra-v-fill" style={{ height: `${(d.horas / maxDia) * 100}%` }}></div>
              </div>
              <span className="barra-v-label">{d.dia}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Graficas