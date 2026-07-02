import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDatos } from '../contexts/DatosContext'

function calcularDesviacion(fechaOriginal, fechaActual) {
  if (!fechaOriginal || !fechaActual) return null
  const orig = new Date(fechaOriginal)
  const actual = new Date(fechaActual)
  const diffDias = Math.round((actual - orig) / (1000 * 60 * 60 * 24))
  return diffDias
}

function formatDesviacion(dias) {
  if (dias === null) return null
  if (dias === 0) return { texto: 'Sin desviación', color: '#00953B', bg: '#f0fdf4' }
  const abs = Math.abs(dias)
  const signo = dias > 0 ? '+' : '-'
  let texto
  if (abs >= 30) {
    const meses = (abs / 30).toFixed(1)
    texto = `${signo}${meses} meses`
  } else {
    texto = `${signo}${abs} días`
  }
  return {
    texto,
    color: dias > 0 ? '#dc2626' : '#00953B',
    bg: dias > 0 ? '#fee2e2' : '#f0fdf4'
  }
}

function BadgeEstado({ estado }) {
  const colores = {
    completado: { bg: '#dcfce7', color: '#166534' },
    en_curso: { bg: '#dbeafe', color: '#1d4ed8' },
    pendiente: { bg: '#f3f4f6', color: '#6b7280' },
  }
  const c = colores[estado] || colores.pendiente
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>
      {estado || 'pendiente'}
    </span>
  )
}

export default function Desviaciones() {
  const { accessToken } = useAuth()
  const { obtenerHoja } = useDatos()
  const [proyectos, setProyectos] = useState([])
  const [estadosProyecto, setEstadosProyecto] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [proyectoAbierto, setProyectoAbierto] = useState(null)

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [p, ep, ac, en] = await Promise.all([
        obtenerHoja('proyectos'),
        obtenerHoja('estados_proyecto'),
        obtenerHoja('acciones'),
        obtenerHoja('ensayos'),
      ])
      setProyectos(p.filter(p => p.fecha_creacion !== 'eliminado' && p.id))
      setEstadosProyecto(ep)
      setAcciones(ac)
      setEnsayos(en)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function estadosDeProyecto(pId) {
    return estadosProyecto.filter(e => e.proyecto_id === pId).sort((a, b) => Number(a.orden) - Number(b.orden))
  }

  function accionesDeEstado(eId) {
    return acciones.filter(a => a.estado_id === eId)
  }

  function ensayosDeAccion(aId) {
    return ensayos.filter(e => e.accion_id === aId)
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando desviaciones...</p></div>

  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>📊 Desviaciones</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Comparativa entre fechas planificadas y fechas actuales</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {proyectos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
            <p style={{ fontSize: '48px' }}>📊</p>
            <p>No hay proyectos aún.</p>
          </div>
        )}

        {proyectos.map(proyecto => {
          const estados = estadosDeProyecto(proyecto.id)
          const abierto = proyectoAbierto === proyecto.id

          // Calcular resumen de desviaciones del proyecto
          const todasAcciones = estados.flatMap(e => accionesDeEstado(e.id))
          const accionesConDesv = todasAcciones.filter(a => a.fecha_fin_original && a.fecha_fin)
          const maxDesv = accionesConDesv.length > 0
            ? Math.max(...accionesConDesv.map(a => calcularDesviacion(a.fecha_fin_original, a.fecha_fin) || 0))
            : 0

          return (
            <div key={proyecto.id} style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              {/* CABECERA PROYECTO */}
              <div
                onClick={() => setProyectoAbierto(abierto ? null : proyecto.id)}
                style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderLeft: `4px solid ${proyecto.color || '#6b7280'}` }}
                onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseOut={e => e.currentTarget.style.background = 'white'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{abierto ? '▾' : '▸'}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: '#373A36' }}>{proyecto.nombre}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{todasAcciones.length} acciones · {estados.flatMap(e => ensayosDeAccion(e.id)).length} ensayos</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {maxDesv > 0 && (
                    <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: '700' }}>
                      ⚠️ Máx. retraso: {maxDesv >= 30 ? `+${(maxDesv/30).toFixed(1)} meses` : `+${maxDesv} días`}
                    </span>
                  )}
                  {maxDesv === 0 && accionesConDesv.length > 0 && (
                    <span style={{ background: '#f0fdf4', color: '#00953B', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: '700' }}>
                      ✅ Sin retrasos
                    </span>
                  )}
                </div>
              </div>

              {/* CONTENIDO DESPLEGADO */}
              {abierto && (
                <div style={{ padding: '0 20px 20px' }}>
                  {estados.map(estado => {
                    const accs = accionesDeEstado(estado.id)
                    return (
                      <div key={estado.id} style={{ marginTop: '16px' }}>
                        {/* ESTADO */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <span style={{ color: proyecto.color || '#6b7280', fontWeight: '700', fontSize: '13px' }}>{estado.orden}.</span>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: '#373A36' }}>{estado.nombre}</span>
                          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
                        </div>

                        {accs.length === 0 && (
                          <p style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic', marginLeft: '16px' }}>Sin acciones</p>
                        )}

                        {/* ACCIONES */}
                        {accs.map(accion => {
                          const desvDias = calcularDesviacion(accion.fecha_fin_original, accion.fecha_fin)
                          const desv = formatDesviacion(desvDias)
                          const ensayosAcc = ensayosDeAccion(accion.id)

                          return (
                            <div key={accion.id} style={{ marginLeft: '16px', marginBottom: '12px', background: '#f8f9fa', borderRadius: '8px', padding: '12px 14px', borderLeft: `3px solid ${proyecto.color || '#6b7280'}` }}>
                              {/* CABECERA ACCIÓN */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div>
                                  <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#373A36' }}>⚡ {accion.nombre}</p>
                                  <BadgeEstado estado={accion.estado} />
                                </div>
                                {desv && (
                                  <span style={{ background: desv.bg, color: desv.color, borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                    {desv.texto}
                                  </span>
                                )}
                              </div>

                              {/* FECHAS ACCIÓN */}
                              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280', marginBottom: ensayosAcc.length > 0 ? '10px' : '0' }}>
                                <span>📅 Planificado: <strong>{accion.fecha_inicio_original || '?'} → {accion.fecha_fin_original || '?'}</strong></span>
                                <span>📅 Actual: <strong style={{ color: desvDias > 0 ? '#dc2626' : '#373A36' }}>{accion.fecha_inicio || '?'} → {accion.fecha_fin || '?'}</strong></span>
                              </div>

                              {/* ENSAYOS */}
                              {ensayosAcc.map(ensayo => {
                                const desvEDias = calcularDesviacion(ensayo.fecha_fin_original, ensayo.fecha_fin)
                                const desvE = formatDesviacion(desvEDias)

                                return (
                                  <div key={ensayo.id} style={{ background: 'white', borderRadius: '6px', padding: '8px 12px', marginTop: '6px', borderLeft: '2px solid #e5e7eb' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ background: ensayo.tipo === 'ensayo' ? '#dbeafe' : '#fef3c7', color: ensayo.tipo === 'ensayo' ? '#1d4ed8' : '#92400e', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: '600' }}>
                                          {ensayo.tipo === 'ensayo' ? 'ENSAYO' : 'INFORME'}
                                        </span>
                                        <span style={{ fontSize: '13px', color: '#373A36' }}>{ensayo.nombre}</span>
                                        <BadgeEstado estado={ensayo.estado} />
                                      </div>
                                      {desvE && (
                                        <span style={{ background: desvE.bg, color: desvE.color, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                          {desvE.texto}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#9ca3af' }}>
                                      <span>Planificado: {ensayo.fecha_inicio_original || '?'} → {ensayo.fecha_fin_original || '?'}</span>
                                      <span style={{ color: desvEDias > 0 ? '#dc2626' : '#6b7280' }}>Actual: {ensayo.fecha_inicio || '?'} → {ensayo.fecha_fin || '?'}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}