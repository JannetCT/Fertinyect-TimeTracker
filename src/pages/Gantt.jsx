import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, actualizarFila } from '../services/googleSheets'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function getMeses(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio + '-01')
  const fin = new Date(fechaFin + '-01')
  const meses = []
  const d = new Date(inicio)
  while (d <= fin) {
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() + 1)
  }
  return meses
}

function getMesActual() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

function getYearMonth(fechaStr) {
  if (!fechaStr) return null
  return fechaStr.slice(0, 7)
}

function Gantt() {
  const { accessToken } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null)
  const [expandidos, setExpandidos] = useState({})
  const [editando, setEditando] = useState(null)
  const [formFechas, setFormFechas] = useState({ fecha_inicio: '', fecha_fin: '' })
  const ganttRef = useRef(null)

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [p, a, e, t] = await Promise.all([
        leerHoja('proyectos', accessToken),
        leerHoja('acciones', accessToken),
        leerHoja('ensayos', accessToken),
        leerHoja('tareas', accessToken)
      ])
      setProyectos(p.filter(p => p.fecha_creacion !== 'eliminado' && p.id))
      setAcciones(a)
      setEnsayos(e)
      setTareas(t)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function guardarFechas() {
    if (!editando || !formFechas.fecha_inicio || !formFechas.fecha_fin) return
    const { tipo, item } = editando
    if (tipo === 'accion') {
      await actualizarFila('acciones', item.id, [
        item.id, item.estado_id, item.proyecto_id,
        item.nombre, item.descripcion, item.fecha_creacion,
        formFechas.fecha_inicio, formFechas.fecha_fin
      ], accessToken)
    } else {
      await actualizarFila('ensayos', item.id, [
        item.id, item.accion_id, item.proyecto_id,
        item.tipo, item.nombre, item.descripcion, item.fecha_creacion,
        formFechas.fecha_inicio, formFechas.fecha_fin
      ], accessToken)
    }
    setEditando(null)
    cargarDatos()
  }

  function progresoEnsayo(ensayoId) {
    const t = tareas.filter(t => t.ensayo_id === ensayoId)
    if (!t.length) return 0
    return Math.round((t.filter(t => t.estado === 'completada').length / t.length) * 100)
  }

  function progresoAccion(accionId) {
    const ensayosAccion = ensayos.filter(e => e.accion_id === accionId)
    if (!ensayosAccion.length) return 0
    const total = ensayosAccion.reduce((sum, e) => sum + progresoEnsayo(e.id), 0)
    return Math.round(total / ensayosAccion.length)
  }

  function exportarExcel() {
    if (!proyectoSeleccionado) return
    const accionesProyecto = acciones.filter(a => a.proyecto_id === proyectoSeleccionado.id)
    let csv = 'Actividad,Tipo,Fecha Inicio,Fecha Fin,Progreso\n'
    accionesProyecto.forEach(accion => {
      csv += `"${accion.nombre}",Acción,${accion.fecha_inicio || ''},${accion.fecha_fin || ''},${progresoAccion(accion.id)}%\n`
      ensayos.filter(e => e.accion_id === accion.id).forEach(ensayo => {
        csv += `"  ${ensayo.nombre}",${ensayo.tipo},${ensayo.fecha_inicio || ''},${ensayo.fecha_fin || ''},${progresoEnsayo(ensayo.id)}%\n`
      })
    })
    const blob = new Blob(["FEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gantt_${proyectoSeleccionado.nombre}.csv`
    a.click()
  }

  function exportarPDF() {
    window.print()
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando Gantt...</p></div>

  if (!proyectoSeleccionado) {
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <h1>📊 Diagrama de Gantt</h1>
        </div>
        <div className="proyectos-lista">
          {proyectos.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p>No hay proyectos disponibles.</p></div>}
          {proyectos.map(p => (
            <div key={p.id} className="proyecto-card" style={{ borderLeftColor: p.color || '#00953B', cursor: 'pointer' }} onClick={() => setProyectoSeleccionado(p)}>
              <div className="proyecto-header">
                <div>
                  <h3>{p.nombre}</h3>
                  <span className="tipo-badge">{p.tipo}</span>
                </div>
                <span style={{ color: '#00953B', fontSize: '14px' }}>Ver Gantt →</span>
              </div>
              {p.descripcion && <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#888' }}>{p.descripcion}</p>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const accionesProyecto = acciones.filter(a => a.proyecto_id === proyectoSeleccionado.id)
  const fechasValidas = [
    ...accionesProyecto.filter(a => a.fecha_inicio).map(a => a.fecha_inicio),
    ...accionesProyecto.filter(a => a.fecha_fin).map(a => a.fecha_fin),
    ...ensayos.filter(e => e.proyecto_id === proyectoSeleccionado.id && e.fecha_inicio).map(e => e.fecha_inicio),
    ...ensayos.filter(e => e.proyecto_id === proyectoSeleccionado.id && e.fecha_fin).map(e => e.fecha_fin),
  ].sort()

  const fechaInicioGantt = fechasValidas[0] ? fechasValidas[0].slice(0, 7) : getMesActual()
  const fechaFinGantt = fechasValidas[fechasValidas.length - 1] ? fechasValidas[fechasValidas.length - 1].slice(0, 7) : `${new Date().getFullYear() + 1}-12`
  const meses = getMeses(fechaInicioGantt, fechaFinGantt)
  const mesActual = getMesActual()

  const COL_NOMBRE = 280
  const COL_MES = 60

  return (
    <div className="proyectos-container" ref={ganttRef}>
      <div className="proyectos-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setProyectoSeleccionado(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px' }}>📊 {proyectoSeleccionado.nombre}</h1>
            <span style={{ fontSize: '13px', color: '#888' }}>Diagrama de Gantt</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportarExcel} style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>📥 Excel</button>
          <button onClick={exportarPDF} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>📄 PDF</button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        {/* CABECERA AÑOS */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, padding: '12px 16px', fontWeight: '700', fontSize: '14px', borderRight: '2px solid #e5e7eb', color: '#373A36' }}>Actividad</div>
          <div style={{ display: 'flex' }}>
            {(() => {
              const años = {}
              meses.forEach(m => {
                const año = m.slice(0, 4)
                años[año] = (años[año] || 0) + 1
              })
              return Object.entries(años).map(([año, count]) => (
                <div key={año} style={{ width: COL_MES * count, textAlign: 'center', padding: '4px', fontWeight: '700', fontSize: '13px', borderRight: '1px solid #e5e7eb', color: '#373A36', background: '#f9fafb' }}>
                  {año}
                </div>
              ))
            })()}
          </div>
        </div>

        {/* CABECERA MESES */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 41, background: 'white', zIndex: 9 }}>
          <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, borderRight: '2px solid #e5e7eb' }}></div>
          {meses.map(mes => (
            <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, textAlign: 'center', padding: '4px 2px', fontSize: '11px', fontWeight: '600', color: mes === mesActual ? '#00953B' : '#6b7280', background: mes === mesActual ? '#f0fdf4' : undefined, borderRight: '1px solid #f3f4f6' }}>
              {MESES[parseInt(mes.slice(5, 7)) - 1]}
            </div>
          ))}
        </div>

        {/* FILAS */}
        {accionesProyecto.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
            <p>No hay acciones en este proyecto.</p>
            <p style={{ fontSize: '13px' }}>Añade acciones desde la vista de Proyectos.</p>
          </div>
        )}

        {accionesProyecto.map(accion => {
          const ensayosAccion = ensayos.filter(e => e.accion_id === accion.id)
          const expandido = expandidos[accion.id]
          const progreso = progresoAccion(accion.id)
          const inicioMes = getYearMonth(accion.fecha_inicio)
          const finMes = getYearMonth(accion.fecha_fin)

          return (
            <div key={accion.id}>
              {/* FILA ACCION */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', background: '#f8f9fa' }}>
                <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, padding: '10px 16px', borderRight: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setExpandidos(prev => ({ ...prev, [accion.id]: !prev[accion.id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6b7280', padding: '0 2px' }}>
                    {expandido ? '▼' : '▶'}
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#373A36', flex: 1 }}>{accion.nombre}</span>
                  <button onClick={() => { setEditando({ tipo: 'accion', item: accion }); setFormFechas({ fecha_inicio: accion.fecha_inicio || '', fecha_fin: accion.fecha_fin || '' }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#00953B' }}>✏️</button>
                  {progreso > 0 && <span style={{ fontSize: '11px', color: '#00953B', fontWeight: '600' }}>{progreso}%</span>}
                </div>
                {meses.map(mes => {
                  const enRango = inicioMes && finMes && mes >= inicioMes && mes <= finMes
                  const esInicio = mes === inicioMes
                  const esFin = mes === finMes
                  return (
                    <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, borderRight: '1px solid #f3f4f6', padding: '6px 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: mes === mesActual ? '#fafff9' : undefined }}>
                      {enRango && (
                        <div style={{ width: '100%', height: '20px', background: proyectoSeleccionado.color || '#00953B', borderRadius: esInicio ? '10px 0 0 10px' : esFin ? '0 10px 10px 0' : '0', opacity: 0.8, position: 'relative', overflow: 'hidden' }}>
                          {progreso > 0 && esInicio && (
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progreso}%`, background: 'rgba(0,0,0,0.2)', borderRadius: 'inherit' }} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* FILAS ENSAYOS */}
              {expandido && ensayosAccion.map(ensayo => {
                const progEnsayo = progresoEnsayo(ensayo.id)
                const inicioE = getYearMonth(ensayo.fecha_inicio)
                const finE = getYearMonth(ensayo.fecha_fin)
                return (
                  <div key={ensayo.id} style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, padding: '8px 16px 8px 40px', borderRight: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: ensayo.tipo === 'ensayo' ? '#dbeafe' : '#fef3c7', color: ensayo.tipo === 'ensayo' ? '#1d4ed8' : '#92400e', fontWeight: '600' }}>{ensayo.tipo === 'ensayo' ? 'E' : 'I'}</span>
                      <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>{ensayo.nombre}</span>
                      <button onClick={() => { setEditando({ tipo: 'ensayo', item: ensayo }); setFormFechas({ fecha_inicio: ensayo.fecha_inicio || '', fecha_fin: ensayo.fecha_fin || '' }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#00953B' }}>✏️</button>
                      {progEnsayo > 0 && <span style={{ fontSize: '10px', color: '#00953B', fontWeight: '600' }}>{progEnsayo}%</span>}
                    </div>
                    {meses.map(mes => {
                      const enRango = inicioE && finE && mes >= inicioE && mes <= finE
                      const esInicio = mes === inicioE
                      const esFin = mes === finE
                      return (
                        <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, borderRight: '1px solid #f3f4f6', padding: '6px 2px', display: 'flex', alignItems: 'center', background: mes === mesActual ? '#fafff9' : undefined }}>
                          {enRango && (
                            <div style={{ width: '100%', height: '14px', background: ensayo.tipo === 'ensayo' ? '#3b82f6' : '#f59e0b', borderRadius: esInicio ? '7px 0 0 7px' : esFin ? '0 7px 7px 0' : '0', opacity: 0.75 }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* LEYENDA */}
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '12px', background: proyectoSeleccionado.color || '#00953B', borderRadius: '6px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Acción</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '10px', background: '#3b82f6', borderRadius: '5px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Ensayo</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '10px', background: '#f59e0b', borderRadius: '5px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Informe</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#f0fdf4', border: '1px solid #00953B', borderRadius: '2px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Mes actual</span></div>
        </div>
      </div>

      {/* MODAL EDITAR FECHAS */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '8px' }}>Editar fechas</h2>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>{editando.item.nombre}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio:</label>
                <input type="month" value={formFechas.fecha_inicio} onChange={e => setFormFechas({...formFechas, fecha_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin:</label>
                <input type="month" value={formFechas.fecha_fin} onChange={e => setFormFechas({...formFechas, fecha_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setEditando(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarFechas} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Gantt
