import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, escribirFila } from '../services/googleSheets'

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

function Proyectos() {
  const { accessToken } = useAuth()
  const [proyectos, setProyectos] = useState([])
  const [proyectoAbierto, setProyectoAbierto] = useState(null)
  const [estados, setEstados] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalProyecto, setModalProyecto] = useState(false)
  const [modalAccion, setModalAccion] = useState(null)
  const [modalEnsayo, setModalEnsayo] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [vistaProyecto, setVistaProyecto] = useState(null)

  const [nuevoProyecto, setNuevoProyecto] = useState({
    nombre: '', descripcion: '', tipo: 'medio_plazo', color: '#00953B', fecha_inicio: '', fecha_fin: ''
  })
  const [nuevaAccion, setNuevaAccion] = useState({ nombre: '', descripcion: '' })
  const [nuevoEnsayo, setNuevoEnsayo] = useState({ nombre: '', tipo: 'ensayo', descripcion: '' })

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [p, e, a, en, t] = await Promise.all([
        leerHoja('proyectos', accessToken),
        leerHoja('estados_proyecto', accessToken),
        leerHoja('acciones', accessToken),
        leerHoja('ensayos', accessToken),
        leerHoja('tareas', accessToken)
      ])
      setProyectos(p)
      setEstados(e)
      setAcciones(a)
      setEnsayos(en)
      setTareas(t)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function crearProyecto() {
    if (!nuevoProyecto.nombre) return
    const id = Date.now().toString()
    await escribirFila('proyectos', [
      id, nuevoProyecto.nombre, nuevoProyecto.descripcion,
      nuevoProyecto.tipo, nuevoProyecto.color,
      nuevoProyecto.fecha_inicio, nuevoProyecto.fecha_fin,
      new Date().toISOString()
    ], accessToken)
    for (const fase of FASES_DEFAULT) {
      const faseId = Date.now().toString() + fase.orden
      await escribirFila('estados_proyecto', [faseId, id, fase.nombre, fase.orden, 'true'], accessToken)
    }
    setModalProyecto(false)
    setNuevoProyecto({ nombre: '', descripcion: '', tipo: 'medio_plazo', color: '#00953B', fecha_inicio: '', fecha_fin: '' })
    cargarDatos()
  }

  async function crearAccion() {
    if (!nuevaAccion.nombre || !modalAccion) return
    const id = Date.now().toString()
    await escribirFila('acciones', [
      id, modalAccion.estado_id, modalAccion.proyecto_id,
      nuevaAccion.nombre, nuevaAccion.descripcion, new Date().toISOString()
    ], accessToken)
    setModalAccion(null)
    setNuevaAccion({ nombre: '', descripcion: '' })
    cargarDatos()
  }

  async function crearEnsayo() {
    if (!nuevoEnsayo.nombre || !modalEnsayo) return
    const id = Date.now().toString()
    await escribirFila('ensayos', [
      id, modalEnsayo.accion_id, modalEnsayo.proyecto_id,
      nuevoEnsayo.tipo, nuevoEnsayo.nombre, nuevoEnsayo.descripcion,
      new Date().toISOString()
    ], accessToken)
    setModalEnsayo(null)
    setNuevoEnsayo({ nombre: '', tipo: 'ensayo', descripcion: '' })
    cargarDatos()
  }

  async function eliminarProyecto(proyecto) {
    try {
      const todos = await leerHoja('proyectos', accessToken)
      const idx = todos.findIndex(p => p.id === proyecto.id)
      if (idx === -1) return
      const filaNum = idx + 2
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${import.meta.env.VITE_SPREADSHEET_ID}/values/proyectos!A${filaNum}:H${filaNum}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[proyecto.id, proyecto.nombre, proyecto.descripcion, proyecto.tipo, proyecto.color, proyecto.fecha_inicio, proyecto.fecha_fin, 'eliminado']] })
      })
      setConfirmEliminar(null)
      if (vistaProyecto?.id === proyecto.id) setVistaProyecto(null)
      cargarDatos()
    } catch (e) { console.error(e) }
  }

  function estadosDeProyecto(proyectoId) {
    return estados.filter(e => e.proyecto_id === proyectoId).sort((a, b) => Number(a.orden) - Number(b.orden))
  }

  function accionesDeEstado(estadoId) {
    return acciones.filter(a => a.estado_id === estadoId)
  }

  function ensayosDeAccion(accionId) {
    return ensayos.filter(e => e.accion_id === accionId)
  }

  function tareasDeEnsayo(ensayoId) {
    return tareas.filter(t => t.ensayo_id === ensayoId)
  }

  function progresoProyecto(proyectoId) {
    const tareasProyecto = tareas.filter(t => t.proyecto_id === proyectoId)
    if (tareasProyecto.length === 0) return 0
    return Math.round((tareasProyecto.filter(t => t.estado === 'completada').length / tareasProyecto.length) * 100)
  }

  const proyectosActivos = proyectos.filter(p => p.fecha_creacion !== 'eliminado' && p.id)

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  if (vistaProyecto) {
    const estadosProyecto = estadosDeProyecto(vistaProyecto.id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaProyecto(null)} style={{
              background: 'none', border: '1px solid #ddd', borderRadius: '8px',
              padding: '6px 12px', cursor: 'pointer', fontSize: '14px'
            }}>← Volver</button>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: vistaProyecto.color, display: 'inline-block' }}></span>
                {vistaProyecto.nombre}
              </h1>
              <span style={{ fontSize: '13px', color: '#888' }}>{TIPOS.find(t => t.value === vistaProyecto.tipo)?.label}</span>
            </div>
          </div>
          <button onClick={() => setConfirmEliminar(vistaProyecto)} style={{
            background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px',
            padding: '8px 16px', cursor: 'pointer', fontSize: '14px'
          }}>🗑 Eliminar proyecto</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {estadosProyecto.map(estado => (
            <div key={estado.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#373A36' }}>
                  <span style={{ color: '#00953B', marginRight: '8px' }}>{estado.orden}.</span>
                  {estado.nombre}
                </h3>
                <button onClick={() => setModalAccion({ estado_id: estado.id, proyecto_id: vistaProyecto.id })} style={{
                  background: '#f0fdf4', color: '#00953B', border: '1px solid #00953B', borderRadius: '6px',
                  padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                }}>+ Acción</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accionesDeEstado(estado.id).map(accion => (
                  <div key={accion.id} style={{ background: '#f8f9fa', borderRadius: '8px', padding: '14px', borderLeft: `3px solid ${vistaProyecto.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '14px' }}>{accion.nombre}</p>
                        {accion.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{accion.descripcion}</p>}
                      </div>
                      <button onClick={() => setModalEnsayo({ accion_id: accion.id, proyecto_id: vistaProyecto.id })} style={{
                        background: '#fff', color: '#373A36', border: '1px solid #ddd', borderRadius: '6px',
                        padding: '4px 10px', cursor: 'pointer', fontSize: '11px'
                      }}>+ Ensayo/Informe</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ensayosDeAccion(accion.id).map(ensayo => (
                        <div key={ensayo.id} style={{ background: 'white', borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              background: ensayo.tipo === 'ensayo' ? '#dbeafe' : '#fef3c7',
                              color: ensayo.tipo === 'ensayo' ? '#1d4ed8' : '#92400e',
                              borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: '600'
                            }}>{ensayo.tipo === 'ensayo' ? 'ENSAYO' : 'INFORME'}</span>
                            <span style={{ fontSize: '13px' }}>{ensayo.nombre}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#888' }}>{tareasDeEnsayo(ensayo.id).length} tareas</span>
                        </div>
                      ))}
                      {ensayosDeAccion(accion.id).length === 0 && (
                        <p style={{ margin: 0, fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Sin ensayos ni informes aún</p>
                      )}
                    </div>
                  </div>
                ))}
                {accionesDeEstado(estado.id).length === 0 && (
                  <p style={{ margin: 0, fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>Sin acciones aún</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {confirmEliminar && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>⚠️</p>
              <h2 style={{ marginBottom: '8px' }}>¿Eliminar proyecto?</h2>
              <p style={{ color: '#888', marginBottom: '24px' }}>{confirmEliminar.nombre}</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => eliminarProyecto(confirmEliminar)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Eliminar</button>
              </div>
            </div>
          </div>
        )}

        {modalAccion && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px' }}>
              <h2 style={{ marginBottom: '24px' }}>Nueva acción</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input placeholder="Nombre de la acción" value={nuevaAccion.nombre}
                  onChange={e => setNuevaAccion({...nuevaAccion, nombre: e.target.value})}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
                <textarea placeholder="Descripción (opcional)" value={nuevaAccion.descripcion}
                  onChange={e => setNuevaAccion({...nuevaAccion, descripcion: e.target.value})}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={() => setModalAccion(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={crearAccion} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear acción</button>
              </div>
            </div>
          </div>
        )}

        {modalEnsayo && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px' }}>
              <h2 style={{ marginBottom: '24px' }}>Nuevo ensayo o informe</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <select value={nuevoEnsayo.tipo} onChange={e => setNuevoEnsayo({...nuevoEnsayo, tipo: e.target.value})}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                  <option value="ensayo">Ensayo</option>
                  <option value="informe">Informe</option>
                </select>
                <input placeholder="Nombre" value={nuevoEnsayo.nombre}
                  onChange={e => setNuevoEnsayo({...nuevoEnsayo, nombre: e.target.value})}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
                <textarea placeholder="Descripción (opcional)" value={nuevoEnsayo.descripcion}
                  onChange={e => setNuevoEnsayo({...nuevoEnsayo, descripcion: e.target.value})}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={() => setModalEnsayo(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={crearEnsayo} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>📁 Proyectos</h1>
        <button onClick={() => setModalProyecto(true)} style={{
          background: '#00953B', color: 'white', border: 'none', borderRadius: '8px',
          padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
        }}>+ Nuevo proyecto</button>
      </div>

      <div className="proyectos-lista">
        {proyectosActivos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
            <p style={{ fontSize: '48px' }}>📁</p>
            <p>No hay proyectos. ¡Crea el primero!</p>
          </div>
        )}
        {proyectosActivos.map(proyecto => (
          <div key={proyecto.id} className="proyecto-card" style={{ borderLeftColor: proyecto.color || '#6B7280', cursor: 'pointer' }}
            onClick={() => setVistaProyecto(proyecto)}>
            <div className="proyecto-header">
              <div>
                <h3>{proyecto.nombre}</h3>
                <span className={`tipo-badge`}>{TIPOS.find(t => t.value === proyecto.tipo)?.label || proyecto.tipo}</span>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Nuevo proyecto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre del proyecto *" value={nuevoProyecto.nombre}
                onChange={e => setNuevoProyecto({...nuevoProyecto, nombre: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción (opcional)" value={nuevoProyecto.descripcion}
                onChange={e => setNuevoProyecto({...nuevoProyecto, descripcion: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
              <select value={nuevoProyecto.tipo} onChange={e => setNuevoProyecto({...nuevoProyecto, tipo: e.target.value})}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '14px', color: '#555' }}>Color:</label>
                <input type="color" value={nuevoProyecto.color}
                  onChange={e => setNuevoProyecto({...nuevoProyecto, color: e.target.value})}
                  style={{ width: '48px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio</label>
                  <input type="date" value={nuevoProyecto.fecha_inicio}
                    onChange={e => setNuevoProyecto({...nuevoProyecto, fecha_inicio: e.target.value})}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin estimada</label>
                  <input type="date" value={nuevoProyecto.fecha_fin}
                    onChange={e => setNuevoProyecto({...nuevoProyecto, fecha_fin: e.target.value})}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
                </div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#166534' }}>
                ✓ Se crearán automáticamente los 6 estados del proceso I+D
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setModalProyecto(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={crearProyecto} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00953B', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear proyecto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Proyectos
