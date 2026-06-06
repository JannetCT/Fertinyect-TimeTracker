import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSearchParams } from 'react-router-dom'
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
          <button onClick={onSave} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
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

function Btn({ onClick, tipo, children }) {
  const estilos = {
    editar: { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' },
    eliminar: { background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' },
    añadir: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd' },
  }
  return (
    <button onClick={onClick} style={{ ...estilos[tipo], borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
      {children}
    </button>
  )
}

function Breadcrumb({ items }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888', marginBottom: '4px' }}>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span style={{ margin: '0 4px' }}>›</span>}
          <span style={{ color: i === items.length - 1 ? '#373A36' : '#888' }}>{item}</span>
        </span>
      ))}
    </div>
  )
}

export default function Soporte() {
  const { accessToken } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [categorias, setCategorias] = useState([])
  const [proyectosSoporte, setProyectosSoporte] = useState([])
  const [subcarpetas, setSubcarpetas] = useState([])
  const [tareas, setTareas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)

  const [vistaCategoria, setVistaCategoria] = useState(null)
  const [vistaProyecto, setVistaProyecto] = useState(null)
  const [vistaSubcarpeta, setVistaSubcarpeta] = useState(null)

  const [modalCategoria, setModalCategoria] = useState(false)
  const [modalProyecto, setModalProyecto] = useState(null)
  const [modalSubcarpeta, setModalSubcarpeta] = useState(null)
  const [modalTarea, setModalTarea] = useState(null)

  const [editItem, setEditItem] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const [form, setForm] = useState({ nombre: '', descripcion: '' })
  const [formTarea, setFormTarea] = useState({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' })

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  // Navegación desde campanita
  useEffect(() => {
    if (cargando) return
    const subcarpetaId = searchParams.get('subcarpeta')
    const proyectoId = searchParams.get('proyecto')
    const categoriaId = searchParams.get('categoria')

    if (subcarpetaId) {
      const sub = subcarpetas.find(s => s.id === subcarpetaId)
      if (sub) {
        const proy = proyectosSoporte.find(p => p.id === sub.proyecto_soporte_id)
        if (proy) {
          const cat = categorias.find(c => c.id === proy.categoria_id)
          if (cat) setVistaCategoria(cat)
          setVistaProyecto(proy)
        }
        setVistaSubcarpeta(sub)
      }
      setSearchParams({})
    } else if (proyectoId) {
      const proy = proyectosSoporte.find(p => p.id === proyectoId)
      if (proy) {
        const cat = categorias.find(c => c.id === proy.categoria_id)
        if (cat) setVistaCategoria(cat)
        setVistaProyecto(proy)
      }
      setSearchParams({})
    } else if (categoriaId) {
      const cat = categorias.find(c => c.id === categoriaId)
      if (cat) setVistaCategoria(cat)
      setSearchParams({})
    }
  }, [cargando, searchParams])

  async function cargarDatos() {
    try {
      const [c, p, s, t, u] = await Promise.all([
        leerHoja('categorias_soporte', accessToken),
        leerHoja('proyectos_soporte', accessToken),
        leerHoja('subcarpetas_soporte', accessToken),
        leerHoja('tareas_soporte', accessToken),
        leerHoja('usuarios', accessToken)
      ])
      setCategorias(c)
      setProyectosSoporte(p)
      setSubcarpetas(s)
      setTareas(t)
      setUsuarios(u)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  async function crear(hoja, fila) {
    await escribirFila(hoja, fila, accessToken)
    setModalCategoria(false)
    setModalProyecto(null)
    setModalSubcarpeta(null)
    setModalTarea(null)
    setForm({ nombre: '', descripcion: '' })
    setFormTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' })
    cargarDatos()
  }

  async function guardarEdit(hoja, fila) {
    await actualizarFila(hoja, editItem.id, fila, accessToken)
    if (editItem._tipo === 'categoria') setVistaCategoria({...editItem, ...fila})
    if (editItem._tipo === 'proyecto') setVistaProyecto({...editItem, nombre: form.nombre, descripcion: form.descripcion})
    if (editItem._tipo === 'subcarpeta') setVistaSubcarpeta({...editItem, nombre: form.nombre, descripcion: form.descripcion})
    setEditItem(null)
    setForm({ nombre: '', descripcion: '' })
    cargarDatos()
  }

  async function ejecutarEliminar() {
    if (!confirmEliminar) return
    await marcarEliminado(confirmEliminar.hoja, confirmEliminar.item.id, accessToken)
    if (confirmEliminar.hoja === 'categorias_soporte') setVistaCategoria(null)
    if (confirmEliminar.hoja === 'proyectos_soporte') setVistaProyecto(null)
    if (confirmEliminar.hoja === 'subcarpetas_soporte') setVistaSubcarpeta(null)
    setConfirmEliminar(null)
    cargarDatos()
  }

  function getNombre(id) {
    const u = usuarios.find(u => u.id === id)
    return u ? (u.nombre ? u.nombre.split(' ')[0] : id) : id
  }

  function proyectosDeCategoria(catId) { return proyectosSoporte.filter(p => p.categoria_id === catId) }
  function subcarpetasDeProyecto(pId) { return subcarpetas.filter(s => s.proyecto_soporte_id === pId) }
  const tareasDirectasCategoria = (catId) => tareas.filter(t => t.categoria_id === catId && !t.proyecto_soporte_id)
  const tareasDirectasProyecto = (pId) => tareas.filter(t => t.proyecto_soporte_id === pId && !t.subcarpeta_id)
  const tareasDirectasSubcarpeta = (sId) => tareas.filter(t => t.subcarpeta_id === sId)

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando...</p></div>

  // VISTA SUBCARPETA
  if (vistaSubcarpeta) {
    const tareasAqui = tareasDirectasSubcarpeta(vistaSubcarpeta.id)
    const cat = categorias.find(c => c.id === vistaProyecto?.categoria_id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaSubcarpeta(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <div>
              <Breadcrumb items={[cat?.nombre, vistaProyecto?.nombre, vistaSubcarpeta.nombre].filter(Boolean)} />
              <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaSubcarpeta.nombre}</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn tipo="editar" onClick={() => { setEditItem({...vistaSubcarpeta, _tipo: 'subcarpeta'}); setForm({ nombre: vistaSubcarpeta.nombre, descripcion: vistaSubcarpeta.descripcion || '' }) }}>✏️ Editar</Btn>
            <Btn tipo="eliminar" onClick={() => setConfirmEliminar({ hoja: 'subcarpetas_soporte', item: vistaSubcarpeta })}>🗑 Eliminar</Btn>
            <button onClick={() => setModalTarea({ subcarpeta_id: vistaSubcarpeta.id, proyecto_soporte_id: vistaProyecto?.id, categoria_id: vistaProyecto?.categoria_id })} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva tarea</button>
          </div>
        </div>
        <TareasList tareas={tareasAqui} usuarios={usuarios} getNombre={getNombre} setEditItem={setEditItem} setForm={setForm} setConfirmEliminar={setConfirmEliminar} />
        {modalTarea && <ModalTarea titulo="Nueva tarea" contexto={vistaSubcarpeta.nombre} formTarea={formTarea} setFormTarea={setFormTarea} usuarios={usuarios}
          onClose={() => { setModalTarea(null); setFormTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' }) }}
          onSave={() => {
            const id = Date.now().toString()
            const diaRec = [formTarea.dia_recomendado, formTarea.fecha_recomendada].filter(Boolean).join(' ')
            crear('tareas_soporte', [id, modalTarea.categoria_id || '', modalTarea.proyecto_soporte_id || '', modalTarea.subcarpeta_id || '', formTarea.nombre, formTarea.asignados.join(','), 'por_asignar', diaRec, formTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', formTarea.fecha_limite || ''])
          }} />}
        {editItem && editItem._tipo !== 'subcarpeta' && <ModalEditTarea editItem={editItem} setEditItem={setEditItem} usuarios={usuarios} guardarEdit={guardarEdit} />}
        {editItem && editItem._tipo === 'subcarpeta' && <Modal titulo="Editar subcarpeta" onClose={() => setEditItem(null)} onSave={() => guardarEdit('subcarpetas_soporte', [editItem.id, editItem.proyecto_soporte_id, editItem.categoria_id, form.nombre, form.descripcion, editItem.fecha_creacion])}><FormNombre form={form} setForm={setForm} /></Modal>}
        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  // VISTA PROYECTO SOPORTE
  if (vistaProyecto) {
    const subcarpetasAqui = subcarpetasDeProyecto(vistaProyecto.id)
    const tareasDirectas = tareasDirectasProyecto(vistaProyecto.id)
    const cat = categorias.find(c => c.id === vistaProyecto.categoria_id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaProyecto(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <div>
              <Breadcrumb items={[cat?.nombre, vistaProyecto.nombre].filter(Boolean)} />
              <h1 style={{ margin: 0, fontSize: '20px' }}>{vistaProyecto.nombre}</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn tipo="editar" onClick={() => { setEditItem({...vistaProyecto, _tipo: 'proyecto'}); setForm({ nombre: vistaProyecto.nombre, descripcion: vistaProyecto.descripcion || '' }) }}>✏️ Editar</Btn>
            <Btn tipo="eliminar" onClick={() => setConfirmEliminar({ hoja: 'proyectos_soporte', item: vistaProyecto })}>🗑 Eliminar</Btn>
            <Btn tipo="añadir" onClick={() => setModalSubcarpeta({ proyecto_soporte_id: vistaProyecto.id, categoria_id: vistaProyecto.categoria_id })}>+ Subcarpeta</Btn>
            <button onClick={() => setModalTarea({ proyecto_soporte_id: vistaProyecto.id, categoria_id: vistaProyecto.categoria_id })} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Tarea directa</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {subcarpetasAqui.map(sub => (
            <div key={sub.id} onClick={() => setVistaSubcarpeta(sub)} style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #3b82f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseOver={e => e.currentTarget.style.background = '#f0f9ff'}
              onMouseOut={e => e.currentTarget.style.background = 'white'}>
              <div>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>📂 {sub.nombre}</p>
                {sub.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{sub.descripcion}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#888' }}>{tareasDirectasSubcarpeta(sub.id).length} tareas</span>
                <span style={{ color: '#1d4ed8' }}>→</span>
              </div>
            </div>
          ))}
          {tareasDirectas.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', marginBottom: '8px' }}>Tareas directas:</p>
              <TareasList tareas={tareasDirectas} usuarios={usuarios} getNombre={getNombre} setEditItem={setEditItem} setForm={setForm} setConfirmEliminar={setConfirmEliminar} />
            </div>
          )}
          {subcarpetasAqui.length === 0 && tareasDirectas.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><p>Sin contenido aún.</p></div>}
        </div>
        {modalSubcarpeta && <Modal titulo="Nueva subcarpeta" onClose={() => setModalSubcarpeta(null)} onSave={() => { const id = Date.now().toString(); crear('subcarpetas_soporte', [id, modalSubcarpeta.proyecto_soporte_id, modalSubcarpeta.categoria_id, form.nombre, form.descripcion, new Date().toISOString()]) }}><FormNombre form={form} setForm={setForm} /></Modal>}
        {modalTarea && <ModalTarea titulo="Nueva tarea directa" contexto={vistaProyecto.nombre} formTarea={formTarea} setFormTarea={setFormTarea} usuarios={usuarios}
          onClose={() => { setModalTarea(null); setFormTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' }) }}
          onSave={() => {
            const id = Date.now().toString()
            const diaRec = [formTarea.dia_recomendado, formTarea.fecha_recomendada].filter(Boolean).join(' ')
            crear('tareas_soporte', [id, modalTarea.categoria_id || '', modalTarea.proyecto_soporte_id || '', '', formTarea.nombre, formTarea.asignados.join(','), 'por_asignar', diaRec, formTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', formTarea.fecha_limite || ''])
          }} />}
        {editItem && <ModalEditTarea editItem={editItem} setEditItem={setEditItem} usuarios={usuarios} guardarEdit={guardarEdit} />}
        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  // VISTA CATEGORIA
  if (vistaCategoria) {
    const proyectosAqui = proyectosDeCategoria(vistaCategoria.id)
    const tareasDirectas = tareasDirectasCategoria(vistaCategoria.id)
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setVistaCategoria(null)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px' }}>← Volver</button>
            <h1 style={{ margin: 0, fontSize: '20px' }}>🛠️ {vistaCategoria.nombre}</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn tipo="editar" onClick={() => { setEditItem({...vistaCategoria, _tipo: 'categoria'}); setForm({ nombre: vistaCategoria.nombre, descripcion: vistaCategoria.descripcion || '' }) }}>✏️ Editar</Btn>
            <Btn tipo="eliminar" onClick={() => setConfirmEliminar({ hoja: 'categorias_soporte', item: vistaCategoria })}>🗑 Eliminar</Btn>
            <Btn tipo="añadir" onClick={() => setModalProyecto({ categoria_id: vistaCategoria.id })}>+ Proyecto</Btn>
            <button onClick={() => setModalTarea({ categoria_id: vistaCategoria.id })} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Tarea directa</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {proyectosAqui.map(proy => (
            <div key={proy.id} onClick={() => setVistaProyecto(proy)} style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #3b82f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseOver={e => e.currentTarget.style.background = '#f0f9ff'}
              onMouseOut={e => e.currentTarget.style.background = 'white'}>
              <div>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>📁 {proy.nombre}</p>
                {proy.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{proy.descripcion}</p>}
              </div>
              <span style={{ color: '#1d4ed8' }}>→</span>
            </div>
          ))}
          {tareasDirectas.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '13px', color: '#888', fontWeight: '600', marginBottom: '8px' }}>Tareas directas:</p>
              <TareasList tareas={tareasDirectas} usuarios={usuarios} getNombre={getNombre} setEditItem={setEditItem} setForm={setForm} setConfirmEliminar={setConfirmEliminar} />
            </div>
          )}
          {proyectosAqui.length === 0 && tareasDirectas.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><p>Sin contenido aún.</p></div>}
        </div>
        {modalProyecto && <Modal titulo="Nuevo proyecto de soporte" onClose={() => setModalProyecto(null)} onSave={() => { const id = Date.now().toString(); crear('proyectos_soporte', [id, modalProyecto.categoria_id, form.nombre, form.descripcion, new Date().toISOString()]) }}><FormNombre form={form} setForm={setForm} /></Modal>}
        {modalTarea && <ModalTarea titulo="Nueva tarea directa" contexto={vistaCategoria.nombre} formTarea={formTarea} setFormTarea={setFormTarea} usuarios={usuarios}
          onClose={() => { setModalTarea(null); setFormTarea({ nombre: '', asignados: [], dia_recomendado: '', fecha_recomendada: '', fecha_limite: '' }) }}
          onSave={() => {
            const id = Date.now().toString()
            const diaRec = [formTarea.dia_recomendado, formTarea.fecha_recomendada].filter(Boolean).join(' ')
            crear('tareas_soporte', [id, modalTarea.categoria_id || '', '', '', formTarea.nombre, formTarea.asignados.join(','), 'por_asignar', diaRec, formTarea.fecha_limite, 'pendiente', new Date().toISOString(), '', formTarea.fecha_limite || ''])
          }} />}
        {editItem && editItem._tipo === 'categoria' && <Modal titulo="Editar categoría" onClose={() => setEditItem(null)} onSave={() => guardarEdit('categorias_soporte', [editItem.id, form.nombre, form.descripcion, editItem.fecha_creacion])}><FormNombre form={form} setForm={setForm} /></Modal>}
        {confirmEliminar && <ConfirmEliminar nombre={confirmEliminar.item.nombre} onClose={() => setConfirmEliminar(null)} onConfirm={ejecutarEliminar} />}
      </div>
    )
  }

  // LISTA CATEGORIAS
  return (
    <div className="proyectos-container">
      <div className="proyectos-header">
        <h1>🛠️ Soporte</h1>
        <button onClick={() => setModalCategoria(true)} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>+ Nueva categoría</button>
      </div>
      <div className="proyectos-lista">
        {categorias.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}><p style={{ fontSize: '48px' }}>🛠️</p><p>No hay categorías aún.</p></div>}
        {categorias.map(cat => (
          <div key={cat.id} className="proyecto-card" style={{ borderLeftColor: '#3b82f6', cursor: 'pointer' }} onClick={() => setVistaCategoria(cat)}>
            <div className="proyecto-header">
              <div>
                <h3>{cat.nombre}</h3>
                {cat.descripcion && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{cat.descripcion}</p>}
              </div>
              <span style={{ fontSize: '13px', color: '#888' }}>{proyectosDeCategoria(cat.id).length} proyectos</span>
            </div>
          </div>
        ))}
      </div>
      {modalCategoria && <Modal titulo="Nueva categoría" onClose={() => setModalCategoria(false)} onSave={() => { const id = Date.now().toString(); crear('categorias_soporte', [id, form.nombre, form.descripcion, new Date().toISOString()]) }}><FormNombre form={form} setForm={setForm} /></Modal>}
    </div>
  )
}

function FormNombre({ form, setForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <input placeholder="Nombre *" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
      <textarea placeholder="Descripción (opcional)" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', height: '80px', resize: 'none' }} />
    </div>
  )
}

function ModalTarea({ titulo, contexto, formTarea, setFormTarea, usuarios, onClose, onSave }) {
  const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px' }}>{titulo}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#1d4ed8' }}>📂 {contexto}</div>
          <input placeholder="Nombre de la tarea *" value={formTarea.nombre} onChange={e => setFormTarea({...formTarea, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Asignar a:</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {usuarios.map(u => <button key={u.id} onClick={() => setFormTarea(prev => ({ ...prev, asignados: prev.asignados.includes(u.id) ? prev.asignados.filter(id => id !== u.id) : [...prev.asignados, u.id] }))} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', background: formTarea.asignados.includes(u.id) ? '#1d4ed8' : '#f3f4f6', color: formTarea.asignados.includes(u.id) ? 'white' : '#373A36', border: formTarea.asignados.includes(u.id) ? '2px solid #1d4ed8' : '2px solid #e5e7eb' }}>{u.nombre ? u.nombre.split(' ')[0] : u.id}</button>)}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Día recomendado:</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={formTarea.dia_recomendado} onChange={e => setFormTarea({...formTarea, dia_recomendado: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="">Sin día específico</option>
                {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
              <input type="date" value={formTarea.fecha_recomendada} onChange={e => setFormTarea({...formTarea, fecha_recomendada: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Fecha límite:</label>
            <input type="date" value={formTarea.fecha_limite} onChange={e => setFormTarea({...formTarea, fecha_limite: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onSave} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Crear tarea</button>
        </div>
      </div>
    </div>
  )
}

function ModalEditTarea({ editItem, setEditItem, usuarios, guardarEdit }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '24px' }}>Editar tarea</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input placeholder="Nombre *" value={editItem.nombre || ''} onChange={e => setEditItem({...editItem, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={() => setEditItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => guardarEdit('tareas_soporte', [editItem.id, editItem.categoria_id, editItem.proyecto_soporte_id || '', editItem.subcarpeta_id || '', editItem.nombre, editItem.asignados || '', editItem.dia_semana, editItem.dia_recomendado || '', editItem.fecha_limite || '', editItem.estado, editItem.fecha_creacion, '', editItem.fecha_limite_original || editItem.fecha_limite || ''])} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function TareasList({ tareas, usuarios, getNombre, setEditItem, setForm, setConfirmEliminar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {tareas.map(tarea => {
        const asignados = tarea.asignados ? tarea.asignados.split(',').filter(Boolean) : []
        const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && tarea.estado !== 'completada'
        const proxima = tarea.fecha_limite && !vencida && (new Date(tarea.fecha_limite) - new Date()) < 3 * 24 * 60 * 60 * 1000
        return (
          <div key={tarea.id} style={{ background: 'white', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${vencida ? '#dc2626' : proxima ? '#f59e0b' : '#3b82f6'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '15px' }}>{tarea.nombre}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {asignados.map(id => <span key={id} style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>{getNombre(id)}</span>)}
                  {tarea.dia_recomendado && <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '2px 8px', fontSize: '11px' }}>📌 {tarea.dia_recomendado}</span>}
                  {tarea.fecha_limite && <span style={{ background: vencida ? '#fee2e2' : proxima ? '#fef3c7' : '#f3f4f6', color: vencida ? '#dc2626' : proxima ? '#92400e' : '#6b7280', borderRadius: '20px', padding: '2px 8px', fontSize: '11px' }}>{vencida ? '⚠️' : '📅'} {tarea.fecha_limite}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '12px' }}>
                <button onClick={() => { setEditItem({...tarea, _tipo: 'tarea'}); setForm({ nombre: tarea.nombre, descripcion: '' }) }} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                <button onClick={() => setConfirmEliminar({ hoja: 'tareas_soporte', item: tarea })} style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                <span style={{ background: tarea.estado === 'completada' ? '#dcfce7' : '#f3f4f6', color: tarea.estado === 'completada' ? '#166534' : '#6b7280', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' }}>{tarea.estado || 'pendiente'}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}