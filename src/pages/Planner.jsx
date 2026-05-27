import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, actualizarFila } from '../services/googleSheets'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes' }

function Planner() {
  const { usuario, accessToken } = useAuth()
  const [tareas, setTareas] = useState([])
  const [tareasSoporte, setTareasSoporte] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [categoriasSoporte, setCategoriasSoporte] = useState([])
  const [cargando, setCargando] = useState(true)
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)
  const [asignandoDia, setAsignandoDia] = useState(false)

  useEffect(() => { if (accessToken && usuario) cargarDatos() }, [accessToken, usuario])

  async function cargarDatos() {
    try {
      const [t, ts, p, cs] = await Promise.all([
        leerHoja('tareas', accessToken),
        leerHoja('tareas_soporte', accessToken),
        leerHoja('proyectos', accessToken),
        leerHoja('categorias_soporte', accessToken)
      ])
      const misId = usuario.id
      setTareas(t.filter(t => t.asignados && t.asignados.split(',').includes(misId)))
      setTareasSoporte(ts.filter(t => t.asignados && t.asignados.split(',').includes(misId)))
      setProyectos(p)
      setCategoriasSoporte(cs)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function asignarDia(tarea, dia, tipo) {
    setAsignandoDia(true)
    try {
      if (tipo === 'proyecto') {
        await actualizarFila('tareas', tarea.id, [
          tarea.id, tarea.ensayo_id, tarea.accion_id, tarea.proyecto_id,
          tarea.nombre, tarea.asignados, dia, tarea.dia_recomendado,
          tarea.fecha_limite, tarea.estado, tarea.fecha_creacion
        ], accessToken)
      } else {
        await actualizarFila('tareas_soporte', tarea.id, [
          tarea.id, tarea.categoria_id, tarea.proyecto_soporte_id || '',
          tarea.subcarpeta_id || '', tarea.nombre, tarea.asignados,
          dia, tarea.dia_recomendado, tarea.fecha_limite,
          tarea.estado, tarea.fecha_creacion
        ], accessToken)
      }
      setTareaSeleccionada(null)
      cargarDatos()
    } catch (err) { console.error(err) }
    finally { setAsignandoDia(false) }
  }

  function todasLasTareas() {
    const tp = tareas.map(t => ({ ...t, _tipo: 'proyecto' }))
    const ts = tareasSoporte.map(t => ({ ...t, _tipo: 'soporte' }))
    return [...tp, ...ts]
  }

  function tareasPorDia(dia) {
    return todasLasTareas().filter(t => t.dia_semana === dia)
  }

  function tareasBacklog() {
    return todasLasTareas().filter(t => !t.dia_semana || t.dia_semana === 'por_asignar' || t.dia_semana === '')
  }

  function getContexto(tarea) {
    if (tarea._tipo === 'proyecto') {
      const p = proyectos.find(p => p.id === tarea.proyecto_id)
      return p ? p.nombre : 'Proyecto'
    } else {
      const c = categoriasSoporte.find(c => c.id === tarea.categoria_id)
      return c ? c.nombre : 'Soporte'
    }
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
              <h3>{DIAS_LABEL[dia]}</h3>
              <span className="task-count">{tareasPorDia(dia).length}</span>
            </div>
            <div className="column-tasks">
              {tareasPorDia(dia).map(tarea => (
                <TarjetaTarea
                  key={tarea.id + tarea._tipo}
                  tarea={tarea}
                  contexto={getContexto(tarea)}
                  onClick={() => setTareaSeleccionada(tarea)}
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
                key={tarea.id + tarea._tipo}
                tarea={tarea}
                contexto={getContexto(tarea)}
                onClick={() => setTareaSeleccionada(tarea)}
              />
            ))}
          </div>
        </div>
      </div>

      {tareaSeleccionada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '420px' }}>
            <h2 style={{ marginBottom: '8px', fontSize: '18px' }}>{tareaSeleccionada.nombre}</h2>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>{getContexto(tareaSeleccionada)}</p>
            <p style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px' }}>Asignar a día:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DIAS.map(dia => (
                <button key={dia} onClick={() => asignarDia(tareaSeleccionada, dia, tareaSeleccionada._tipo)} disabled={asignandoDia} style={{
                  padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb',
                  background: tareaSeleccionada.dia_semana === dia ? '#00953B' : 'white',
                  color: tareaSeleccionada.dia_semana === dia ? 'white' : '#373A36',
                  cursor: 'pointer', fontSize: '14px', fontWeight: '600', textAlign: 'left'
                }}>
                  {DIAS_LABEL[dia]}
                </button>
              ))}
              <button onClick={() => asignarDia(tareaSeleccionada, 'por_asignar', tareaSeleccionada._tipo)} disabled={asignandoDia} style={{
                padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb',
                background: tareaSeleccionada.dia_semana === 'por_asignar' ? '#6b7280' : 'white',
                color: tareaSeleccionada.dia_semana === 'por_asignar' ? 'white' : '#373A36',
                cursor: 'pointer', fontSize: '14px', fontWeight: '600', textAlign: 'left'
              }}>
                📥 Por asignar
              </button>
            </div>
            <button onClick={() => setTareaSeleccionada(null)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', marginTop: '16px', fontSize: '14px' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaTarea({ tarea, contexto, onClick }) {
  const esCompletada = tarea.estado === 'completada'
  const esEnCurso = tarea.estado === 'en_curso'
  const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && !esCompletada
  const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000

  return (
    <div onClick={onClick} className={`tarea-card ${esCompletada ? 'completada' : ''} ${esEnCurso ? 'en-curso' : ''}`} style={{
      borderLeft: `4px solid ${vencida ? '#dc2626' : proxima ? '#f59e0b' : tarea._tipo === 'soporte' ? '#3b82f6' : '#00953B'}`,
      cursor: 'pointer'
    }}>
      <p className={`tarea-nombre ${esCompletada ? 'tachado' : ''}`}>{tarea.nombre}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <span style={{
          fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
          background: tarea._tipo === 'soporte' ? '#eff6ff' : '#f0fdf4',
          color: tarea._tipo === 'soporte' ? '#1d4ed8' : '#00953B',
          fontWeight: '600'
        }}>{contexto}</span>
        {tarea.dia_recomendado && <span style={{ fontSize: '10px', color: '#92400e', background: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}>📌 {tarea.dia_recomendado}</span>}
      </div>
      {vencida && <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0', fontWeight: '600' }}>⚠️ Vencida</p>}
    </div>
  )
}

export default Planner