import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado } from '../services/googleSheets'

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

export default function Soporte() {
  const { accessToken } = useAuth()
  const [categorias, setCategorias] = useState([])
  const [tareas, setTareas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [vistaCategoria, setVistaCategoria] = useState(null)

  const [modalCategoria, setModalCategoria] = useState(false)
  const [modalTarea, setModalTarea] = useState(null)
  const [editCategoria, setEditCategoria] = useState(null)
  const [editTarea, setEditTarea] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: '', descripcion: '' })
  const [nuevaTarea, setNuevaTarea] = useState({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' })

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [c, t, u] = await Promise.all([
        leerHoja('categorias_soporte', accessToken),
        leerHoja('tareas_soporte', accessToken),
        leerHoja('usuarios', accessToken)
      ])
      setCategorias(c)
      setTareas(t)
      setUsuarios(u)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function crearCategoria() {
    if (!nuevaCategoria.nombre) return
    const id = Date.now().toString()
    await escribirFila('categorias_soporte', [id, nuevaCategoria.nombre, nuevaCategoria.descripcion, new Date().toISOString()], accessToken)
    setModalCategoria(false)
    setNuevaCategoria({ nombre: '', descripcion: '' })
    cargarDatos()
  }

  async function guardarEditCategoria() {
    if (!editCategoria) return
    await actualizarFila('categorias_soporte', editCategoria.id, [editCategoria.id, editCategoria.nombre, editCategoria.descripcion, editCategoria.fecha_creacion], accessToken)
    setVistaCategoria(editCategoria)
    setEditCategoria(null)
    cargarDatos()
  }

  async function crearTarea() {
    if (!nuevaTarea.nombre || !modalTarea) return
    const id = Date.now().toString()
    const asignadosStr = nuevaTarea.asignados.join(',')
    const diaRec = [nuevaTarea.dia_recomendado, nuevaTarea.fecha_recomendada].filter(Boolean).join(' ')
    await escribirFila('tareas_soporte', [id, modalTarea.categoria_id, nuevaTarea.nombre, asignadosStr, 'por_asignar', diaRec, nuevaTarea.fecha_limite, 'pendiente', new Date().toISOString()], accessToken)
    setModalTarea(null)
    setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' })
    cargarDatos()
  }

  async function guardarEditTarea() {
    if (!editTarea) return
    const asignadosStr = Array.isArray(editTarea.asignados) ? editTarea.asignados.join(',') : editTarea.asignados
    const diaRec = [editTarea.dia_recomendado, editTarea.fecha_recomendada].filter(Boolean).join(' ')
    await actualizarFila('tareas_soporte', editTarea.id, [editTarea.id, editTarea.categoria_id, editTarea.nombre, asignadosStr, editTarea.dia_semana, diaRec, editTarea.fecha_limite, editTarea.estado, editTarea.fecha_creacion], accessToken)
    setEditTarea(null)
    cargarDatos()
  }

  async function ejecutarEliminar() {
    if (!confirmEliminar) return
    const { tipo, item } = confirmEliminar
    if (tipo === 'categoria') {
      await marcarEliminado('categorias_soporte', item.id, accessToken)
      if (vistaCategoria?.id === item.id) setVistaCategoria(null)
    } else if (tipo === 'tarea') {
      await marcarEliminado('tareas_soporte', item.id, accessToken)
    }
    setConfirmEliminar(null)
    cargarDatos()
  }

  function getNombre(id) {
    const u = usuarios.find(u => u.id === id)
    return u ? (u.nombre ? u.nombre.split(' ')[0] : id) : id
  }

  function tareasDeCategoria(categoriaId) {
    return tareas.filter(t => t.categoria_id === categoriaId)
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  if (vistaCategoria) {
    const tareasCategoria = tareasDeCategoria(vistaCategoria.id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaCategoria(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaCategoria.nombre}</h1>
              {vistaCategoria.descripcion && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{vistaCategoria.descripcion}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <BtnAccion tipo="editar" onClick={() => setEditCategoria({...vistaCategoria})}>✏️ Editar</BtnAccion>
            <BtnAccion tipo="eliminar" onClick={() => setConfirmEliminar({ tipo: 'categoria', item: vistaCategoria })}>🗑 Eliminar</BtnAccion>
            <button onClick={() => setModalTarea({ categoria_id: vistaCategoria.id })} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva tarea</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tareasCategoria.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p style={{ fontSize: '40px' }}>📋</p><p>Sin tareas aún. ¡Crea la primera!</p></div>}
          {tareasCategoria.map(tarea => {
            const asignados = tarea.asignados ? tarea.asignados.split(',').filter(Boolean) : []
            const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && tarea.estado !== 'completada'
            const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000
            return (
              <div key={tarea.id} style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${vencida ? '#dc2626' : proxima ? '#f59e0b' : '#3b82f6'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '15px', textDecoration: tarea.estado === 'completada' ? 'line-through' : 'none' }}>{tarea.nombre}</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {asignados.map(id => <span key={id} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>{getNombre(id)}</span>)}
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
          <Modal titulo="Nueva tarea de soporte" onClose={() => { setModalTarea(null); setNuevaTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' }) }} onSave={crearTarea}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#1d4ed8' }}>📂 Categoría: <strong>{vistaCategoria.nombre}</strong></div>
              <input placeholder="Nombre de la tarea *" value={nuevaTarea.nombre} onChange={e => setNuevaTarea({...nuevaTarea, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <div>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Asignar a:</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {usuarios.map(u => <button key={u.id} onClick={() => setNuevaTarea(prev => ({ ...prev, asignados: prev.asignados.includes(u.id) ? prev.asignados.filter(id => id !== u.id) : [...prev.asignados, u.id] }))} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: nuevaTarea.asignados.includes(u.id) ? '#1d4ed8' : '#f3f4f6', color: nuevaTarea.asignados.includes(u.id) ? 'white' : '#373A36', border: nuevaTarea.asignados.includes(u.id) ? '2px solid #1d4ed8' : '2px solid #e5e7eb' }}>{u.nombre ? u.nombre.split(' ')[0] : u.id}</button>)}
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
                  {usuarios.map(u => <button key={u.id} onClick={() => setEditTarea(prev => ({ ...prev, asignados: prev.asignados.includes(u.id) ? prev.asignados.filter(id => id !== u.id) : [...prev.asignados, u.id] }))} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: editTarea.asignados.includes(u.id) ? '#1d4ed8' : '#f3f4f6', color: editTarea.asignados.includes(u.id) ? 'white' : '#373A36', border: editTarea.asignados.includes(u.id) ? '2px solid #1d4ed8' : '2px solid #e5e7eb' }}>{u.nombre ? u.nombre.split(' ')[0] : u.id}</button>)}
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

        {editCategoria && (
          <Modal titulo="Editar categoría" onClose={() => setEditCategoria(null)} onSave={guardarEditCategoria}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input placeholder="Nombre *" value={editCategoria.nombre} onChange={e => setEditCategoria({...editCategoria, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              <textarea placeholder="Descripción" value={editCategoria.descripcion || ''} onChange={e => setEditCategoria({...editCategoria, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
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
        <h1>🛠️ Soporte</h1>
        <button onClick={() => setModalCategoria(true)} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva categoría</button>
      </div>

      <div className="proyectos-lista">
        {categorias.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p style={{ fontSize: '48px' }}>🛠️</p><p>No hay categorías aún. ¡Crea la primera!</p></div>}
        {categorias.map(cat => (
          <div key={cat.id} className="proyecto-card" style={{ borderLeftColor: '#3b82f6', cursor: 'pointer' }} onClick={() => setVistaCategoria(cat)}>
            <div className="proyecto-header">
              <div>
                <h3>{cat.nombre}</h3>
                {cat.descripcion && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{cat.descripcion}</p>}
              </div>
              <span style={{ fontSize: '13px', color: '#888' }}>{tareasDeCategoria(cat.id).length} tareas</span>
            </div>
          </div>
        ))}
      </div>

      {modalCategoria && (
        <Modal titulo="Nueva categoría de soporte" onClose={() => setModalCategoria(false)} onSave={crearCategoria}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input placeholder="Nombre de la categoría *" value={nuevaCategoria.nombre} onChange={e => setNuevaCategoria({...nuevaCategoria, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            <textarea placeholder="Descripción (opcional)" value={nuevaCategoria.descripcion} onChange={e => setNuevaCategoria({...nuevaCategoria, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
          </div>
        </Modal>
      )}
    </div>
  )
}
