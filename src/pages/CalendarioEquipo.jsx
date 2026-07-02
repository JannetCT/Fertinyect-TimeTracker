import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDatos } from '../contexts/DatosContext'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_CABECERA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

const COLORES_USUARIO = {
  'cto.fertinyect@gmail.com':       { color: '#00953B', bg: '#f0fdf4', nombre: 'Lorenzo' },
  'tecnico.fertinyect@gmail.com':   { color: '#f59e0b', bg: '#fffbeb', nombre: 'Jannet' },
  'sanidadvegetal.fertinyect@gmail.com': { color: '#3b82f6', bg: '#eff6ff', nombre: 'Ahlam' },
}

function getColorUsuario(email) {
  return COLORES_USUARIO[email] || { color: '#6b7280', bg: '#f3f4f6', nombre: email }
}

function getISODate(fecha) {
  const d = new Date(fecha)
  d.setHours(12, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getDiasDelMes(año, mes) {
  const primerDia = new Date(año, mes, 1)
  const ultimoDia = new Date(año, mes + 1, 0)
  const dias = []
  const inicioSemana = new Date(primerDia)
  const diaSemana = primerDia.getDay()
  inicioSemana.setDate(primerDia.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
  for (let d = new Date(inicioSemana); d <= ultimoDia || dias.length % 7 !== 0; d.setDate(d.getDate() + 1)) {
    dias.push({ fecha: getISODate(new Date(d)), esMes: new Date(d).getMonth() === mes })
  }
  return dias
}

function getDiasDeSemana(lunes) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(d.getDate() + i)
    return getISODate(d)
  })
}

function getLunesDeSemana(fecha) {
  const d = new Date(fecha)
  d.setHours(12, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function ChipPersona({ nombre, color, bg, texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: bg, borderLeft: `3px solid ${color}`, borderRadius: '4px', padding: '2px 5px', marginBottom: '2px', minWidth: 0 }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '10px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{texto}</span>
    </div>
  )
}

function IndicadorCarga({ items }) {
  const n = items.length
  const color = n === 0 ? '#e5e7eb' : n <= 2 ? '#00953B' : n <= 4 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', gap: '2px', marginBottom: '3px' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '2px', background: i <= Math.min(Math.ceil(n / 2), 3) ? color : '#e5e7eb' }} />
      ))}
    </div>
  )
}

export default function CalendarioEquipo() {
  const { usuario, accessToken } = useAuth()
  const { obtenerHoja } = useDatos()
  const [vista, setVista] = useState('mes')
  const [mesBase, setMesBase] = useState(() => new Date())
  const [semanaBase, setSemanaBase] = useState(() => getLunesDeSemana(new Date()))
  const [tareas, setTareas] = useState([])
  const [tareasSoporte, setTareasSoporte] = useState([])
  const [tareasPlanner, setTareasPlanner] = useState([])
  const [eventos, setEventos] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [categoriasSoporte, setCategoriasSoporte] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroPersona, setFiltroPersona] = useState('todos')
  const [diaDetalle, setDiaDetalle] = useState(null)
  const [modoPresentacion, setModoPresentacion] = useState(false)

  useEffect(() => {
    if (accessToken) cargarDatos()
  }, [accessToken])

  async function cargarDatos() {
    try {
      const [t, ts, tp, ev, p, u, cs] = await Promise.all([
        obtenerHoja('tareas'),
        obtenerHoja('tareas_soporte'),
        obtenerHoja('tareas_planner'),
        obtenerHoja('eventos'),
        obtenerHoja('proyectos'),
        obtenerHoja('usuarios'),
        obtenerHoja('categorias_soporte'),
      ])
      setTareas(t.filter(t => t.estado !== 'eliminado'))
      setTareasSoporte(ts.filter(t => t.estado !== 'eliminado'))
      setTareasPlanner(tp)
      setEventos(ev)
      setProyectos(p)
      setUsuarios(u)
      setCategoriasSoporte(cs)
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  function getEmailUsuario(userId) {
    const u = usuarios.find(u => u.id === userId)
    return u?.email || ''
  }

  function getNombreUsuario(userId) {
    const u = usuarios.find(u => u.id === userId)
    return u?.nombre || userId
  }

  function getContextoTarea(tarea, tipo) {
    if (tipo === 'proyecto') {
      const p = proyectos.find(p => p.id === tarea.proyecto_id)
      return p?.nombre || 'Proyecto'
    } else if (tipo === 'soporte') {
      const c = categoriasSoporte.find(c => c.id === tarea.categoria_id)
      return c?.nombre || 'Soporte'
    }
    return tarea.nombre
  }

  function getItemsDeDia(fechaStr) {
    const items = []

    // Tareas proyecto
    tareas.forEach(t => {
      if (t.fecha_exacta !== fechaStr) return
      if (t.estado === 'completada') return
      const asignados = (t.asignados || '').split(',').map(s => s.trim()).filter(Boolean)
      asignados.forEach(userId => {
        const email = getEmailUsuario(userId)
        if (filtroPersona !== 'todos' && email !== filtroPersona) return
        const cu = getColorUsuario(email)
        items.push({ id: t.id + userId, texto: `${cu.nombre} — ${getContextoTarea(t, 'proyecto')}`, color: cu.color, bg: cu.bg, email, userId, tipo: 'proyecto' })
      })
    })

    // Tareas soporte
    tareasSoporte.forEach(t => {
      if (t.fecha_exacta !== fechaStr) return
      if (t.estado === 'completada') return
      const asignados = (t.asignados || '').split(',').map(s => s.trim()).filter(Boolean)
      asignados.forEach(userId => {
        const email = getEmailUsuario(userId)
        if (filtroPersona !== 'todos' && email !== filtroPersona) return
        const cu = getColorUsuario(email)
        items.push({ id: t.id + userId, texto: `${cu.nombre} — ${getContextoTarea(t, 'soporte')}`, color: cu.color, bg: cu.bg, email, userId, tipo: 'soporte' })
      })
    })

    // Tareas planner
    tareasPlanner.forEach(t => {
      if (t.fecha_exacta !== fechaStr) return
      if (t.estado === 'completada') return
      const email = getEmailUsuario(t.usuario_id)
      if (filtroPersona !== 'todos' && email !== filtroPersona) return
      const cu = getColorUsuario(email)
      items.push({ id: t.id, texto: `${cu.nombre} — ${t.nombre}`, color: cu.color, bg: cu.bg, email, userId: t.usuario_id, tipo: 'planner' })
    })

    // Eventos
    eventos.forEach(ev => {
      if (ev.fecha_exacta !== fechaStr) return
      const email = getEmailUsuario(ev.usuario_id)
      if (filtroPersona !== 'todos' && email !== filtroPersona) return
      const cu = getColorUsuario(email)
      items.push({ id: ev.id, texto: `${cu.nombre} — 🗓 ${ev.titulo}`, color: cu.color, bg: cu.bg, email, userId: ev.usuario_id, tipo: 'evento' })
    })

    return items
  }

  const esMobile = window.innerWidth < 768
  const hoy = getISODate(new Date())
  const diasMes = getDiasDelMes(mesBase.getFullYear(), mesBase.getMonth())
  const diasSemana = getDiasDeSemana(semanaBase)
  const DIAS_SEMANA_LABEL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando calendario...</p></div>

  const contenido = (
    <div style={{ padding: modoPresentacion ? '32px' : '24px', background: modoPresentacion ? 'white' : undefined, minHeight: modoPresentacion ? '100vh' : undefined }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#373A36' }}>🗓 Calendario I+D</h1>
          {/* Toggle vista */}
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {['mes','semana'].map(v => (
              <button key={v} onClick={() => setVista(v)} style={{ padding: '6px 14px', background: vista === v ? '#00953B' : 'white', color: vista === v ? 'white' : '#373A36', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                {v === 'mes' ? 'Mes' : 'Semana'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filtro persona */}
          <select value={filtroPersona} onChange={e => setFiltroPersona(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: 'white' }}>
            <option value="todos">👥 Todo el equipo</option>
            {Object.entries(COLORES_USUARIO).map(([email, { nombre }]) => (
              <option key={email} value={email}>{nombre}</option>
            ))}
          </select>

          {/* Modo presentación */}
          {!modoPresentacion && (
            <button onClick={() => setModoPresentacion(true)} style={{ background: '#1e1b4b', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              🖥 Presentación
            </button>
          )}
          {modoPresentacion && (
            <button onClick={() => setModoPresentacion(false)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              ✕ Salir
            </button>
          )}
        </div>
      </div>

      {/* LEYENDA PERSONAS */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(COLORES_USUARIO).map(([email, { color, bg, nombre }]) => (
          <div key={email} onClick={() => setFiltroPersona(filtroPersona === email ? 'todos' : email)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 10px', borderRadius: '20px', background: filtroPersona === email ? bg : 'white', border: `2px solid ${filtroPersona === email ? color : '#e5e7eb'}`, transition: 'all 0.2s' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: filtroPersona === email ? color : '#6b7280' }}>{nombre}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: '2px' }}>{[1,2,3].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '2px', background: i === 1 ? '#00953B' : i === 2 ? '#f59e0b' : '#ef4444' }} />)}</div>
          carga baja / media / alta
        </div>
      </div>

      {/* NAVEGACIÓN */}
      {vista === 'mes' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button onClick={() => setMesBase(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>←</button>
          <span style={{ fontWeight: '700', fontSize: '18px', color: '#373A36', minWidth: '180px', textAlign: 'center' }}>{MESES[mesBase.getMonth()]} {mesBase.getFullYear()}</span>
          <button onClick={() => setMesBase(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>→</button>
          <button onClick={() => setMesBase(new Date())} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Hoy</button>
        </div>
      )}

      {vista === 'semana' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button onClick={() => setSemanaBase(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>←</button>
          <span style={{ fontWeight: '700', fontSize: '16px', color: '#373A36', minWidth: '200px', textAlign: 'center' }}>
            {diasSemana[0]} — {diasSemana[6]}
          </span>
          <button onClick={() => setSemanaBase(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>→</button>
          <button onClick={() => setSemanaBase(getLunesDeSemana(new Date()))} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Hoy</button>
        </div>
      )}

      {/* VISTA MES */}
    {vista === 'mes' && (
  <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
      {DIAS_CABECERA.map(d => (
        <div key={d} style={{ padding: '6px 2px', textAlign: 'center', fontSize: esMobile ? '10px' : '12px', fontWeight: '700', color: '#6b7280' }}>{d}</div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
      {diasMes.map(({ fecha, esMes }) => {
        const items = getItemsDeDia(fecha)
        const esHoyDia = fecha === hoy
        return (
          <div key={fecha} onClick={() => setDiaDetalle({ fecha, items })}
            style={{ minHeight: esMobile ? '52px' : '100px', padding: esMobile ? '4px 2px' : '6px', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', background: esHoyDia ? '#f0fdf4' : esMes ? 'white' : '#fafafa', opacity: esMes ? 1 : 0.4, cursor: 'pointer' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: esMobile ? '12px' : '13px', fontWeight: esHoyDia ? '700' : '400', color: esHoyDia ? '#00953B' : '#373A36' }}>
                {new Date(fecha + 'T12:00:00').getDate()}
              </span>
              {items.length > 0 && <IndicadorCarga items={items} />}
              {!esMobile && items.slice(0, 2).map((item, i) => (
                <ChipPersona key={i} {...item} texto={item.texto} />
              ))}
              {!esMobile && items.length > 2 && (
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>+{items.length - 2} más</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}

      {/* VISTA SEMANA */}
 {vista === 'semana' && (
  <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
    {esMobile ? (
      // MÓVIL: lista vertical
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {diasSemana.map((fecha, i) => {
          const items = getItemsDeDia(fecha)
          const esHoyDia = fecha === hoy
          if (items.length === 0 && !esHoyDia) return null
          return (
            <div key={fecha} style={{ borderBottom: '1px solid #f3f4f6', padding: '12px 16px', background: esHoyDia ? '#fafff9' : 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: items.length > 0 ? '8px' : '0' }}>
                <div style={{ background: esHoyDia ? '#00953B' : '#f3f4f6', color: esHoyDia ? 'white' : '#373A36', borderRadius: '8px', padding: '4px 10px', fontSize: '13px', fontWeight: '700' }}>
                  {DIAS_SEMANA_LABEL[i]} {new Date(fecha + 'T12:00:00').getDate()}
                </div>
                {items.length > 0 && <IndicadorCarga items={items} />}
              </div>
              {items.map((item, j) => <ChipPersona key={j} {...item} />)}
            </div>
          )
        })}
      </div>
    ) : (
      // ESCRITORIO: grid
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #e5e7eb' }}>
          {diasSemana.map((fecha, i) => {
            const esHoyDia = fecha === hoy
            return (
              <div key={fecha} style={{ padding: '10px 8px', textAlign: 'center', background: esHoyDia ? '#00953B' : '#f9fafb', borderRight: i < 6 ? '1px solid #e5e7eb' : 'none' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: esHoyDia ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>{DIAS_SEMANA_LABEL[i]}</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: esHoyDia ? 'white' : '#373A36' }}>{new Date(fecha + 'T12:00:00').getDate()}</div>
                <div style={{ fontSize: '11px', color: esHoyDia ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>{new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {diasSemana.map((fecha, i) => {
            const items = getItemsDeDia(fecha)
            const esHoyDia = fecha === hoy
            return (
              <div key={fecha} style={{ minHeight: '200px', padding: '8px', borderRight: i < 6 ? '1px solid #f3f4f6' : 'none', background: esHoyDia ? '#fafff9' : 'white' }}>
                {items.length === 0
                  ? <p style={{ fontSize: '11px', color: '#d1d5db', textAlign: 'center', marginTop: '20px' }}>—</p>
                  : items.map((item, j) => <ChipPersona key={j} {...item} />)
                }
              </div>
            )
          })}
        </div>
      </>
    )}
  </div>
)}

      {/* MODAL DETALLE DÍA */}
      {diaDetalle && (
        <div onClick={() => setDiaDetalle(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                {new Date(diaDetalle.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <button onClick={() => setDiaDetalle(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {diaDetalle.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: item.bg, borderRadius: '8px', borderLeft: `4px solid ${item.color}` }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#374151' }}>{item.texto}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9ca3af', background: 'white', padding: '1px 6px', borderRadius: '10px' }}>{item.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (modoPresentacion) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 2000, overflowY: 'auto' }}>
        {contenido}
      </div>
    )
  }

  return contenido
}
