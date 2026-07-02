import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDatos } from '../contexts/DatosContext'

function getLunesDeSemana(fecha) {
  const d = new Date(fecha)
  d.setHours(12, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function getISODate(fecha) {
  return fecha.toISOString().split('T')[0]
}

function getFechasDeSemana(lunes) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(d.getDate() + i)
    return getISODate(d)
  })
}

function formatFecha(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  return `${d.getDate()} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}`
}

function perteneceASemana(registroFecha, fechasSemana) {
  if (!registroFecha) return false
  try {
    const d = new Date(registroFecha)
    if (isNaN(d)) return false
    const iso = getISODate(d)
    return fechasSemana.includes(iso)
  } catch { return false }
}

function DonutChart({ datos, total }) {
  if (total === 0) return <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Sin registros</p>

  const radio = 70
  const cx = 90
  const cy = 90
  let acumulado = 0
  const segmentos = datos.map(d => {
    const porcentaje = d.segundos / total
    const angInicio = acumulado * 2 * Math.PI - Math.PI / 2
    acumulado += porcentaje
    const angFin = acumulado * 2 * Math.PI - Math.PI / 2
    const x1 = cx + radio * Math.cos(angInicio)
    const y1 = cy + radio * Math.sin(angInicio)
    const x2 = cx + radio * Math.cos(angFin)
    const y2 = cy + radio * Math.sin(angFin)
    const largeArc = porcentaje > 0.5 ? 1 : 0
    return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${radio} ${radio} 0 ${largeArc} 1 ${x2} ${y2} Z`, porcentaje: Math.round(porcentaje * 100) }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        {segmentos.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity="0.85" />
        ))}
        <circle cx={cx} cy={cy} r="40" fill="white" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fontWeight="700" fill="#373A36">
          {Math.round(total / 3600 * 10) / 10}h
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#9ca3af">total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {segmentos.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>{s.nombre}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#373A36' }}>{Math.round(s.segundos / 3600 * 10) / 10}h</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', width: '32px', textAlign: 'right' }}>{s.porcentaje}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Graficas() {
  const { usuario, accessToken } = useAuth()
  const { obtenerHoja } = useDatos()
  const [semanaBase, setSemanaBase] = useState(() => getLunesDeSemana(new Date()))
  const [registros, setRegistros] = useState([])
  const [tareas, setTareas] = useState([])
  const [tareasSoporte, setTareasSoporte] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [categoriasSoporte, setCategoriasSoporte] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [reg, tar, tarS, proy, catS] = await Promise.all([
          obtenerHoja('registros'),
          obtenerHoja('tareas'),
          obtenerHoja('tareas_soporte'),
          obtenerHoja('proyectos'),
          obtenerHoja('categorias_soporte')
        ])
        setRegistros(reg.filter(r => r.usuario_id === usuario.id || r.usuarios_id === usuario.id))
        setTareas(tar)
        setTareasSoporte(tarS)
        setProyectos(proy)
        setCategoriasSoporte(catS)
      } catch (err) { console.error(err) }
      finally { setCargando(false) }
    }
    if (accessToken && usuario) cargarDatos()
  }, [accessToken, usuario])

  const fechasSemana = getFechasDeSemana(semanaBase)
  const registrosSemana = registros.filter(r => perteneceASemana(r.fecha, fechasSemana))

  // Reuniones de la semana
  const registrosReuniones = registrosSemana.filter(r => r.tipo_tarea === 'evento')
  const totalSegReu = registrosReuniones.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const totalSegTrabajo = registrosSemana.filter(r => r.tipo_tarea !== 'evento').reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const reunionesDetalle = registrosReuniones.reduce((acc, r) => {
    const nombre = r.tarea_nombre || 'Sin título'
    if (!acc[nombre]) acc[nombre] = { nombre, segundos: 0 }
    acc[nombre].segundos += Number(r.duracion_segundos || 0)
    return acc
  }, {})
  const reunionesLista = Object.values(reunionesDetalle).sort((a, b) => b.segundos - a.segundos)
  const pctReu = totalSegTrabajo + totalSegReu > 0 ? Math.round(totalSegReu / (totalSegTrabajo + totalSegReu) * 100) : 0

  // Últimas 4 semanas
  const ultimas4Semanas = Array.from({ length: 4 }, (_, i) => {
    const lunes = new Date(semanaBase)
    lunes.setDate(lunes.getDate() - (3 - i) * 7)
    const fechas = getFechasDeSemana(lunes)
    const segundos = registros.filter(r => perteneceASemana(r.fecha, fechas)).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    return { label: `${formatFecha(fechas[0])}`, horas: Math.round(segundos / 3600 * 10) / 10, esSemanaActual: i === 3 }
  })

  function getNombreContexto(registro) {
    const tipo = registro.tipo_tarea || ''
    if (tipo === 'proyecto') {
      const tarea = tareas.find(t => t.id === registro.tarea_id)
      if (tarea) {
        const proy = proyectos.find(p => p.id === tarea.proyecto_id)
        return { nombre: proy?.nombre || 'Proyecto', color: proy?.color || '#00953B', tipo: 'proyecto' }
      }
    } else if (tipo === 'soporte' || tipo === 'soporte_proyecto' || tipo === 'soporte_subcarpeta') {
      const tarea = tareasSoporte.find(t => t.id === registro.tarea_id)
      if (tarea) {
        const cat = categoriasSoporte.find(c => c.id === tarea.categoria_id)
        return { nombre: cat?.nombre || 'Soporte', color: '#3b82f6', tipo: 'soporte' }
      }
    } else if (tipo === 'evento') {
      return { nombre: '🗓 Reuniones', color: '#f59e0b', tipo: 'reunion' }
    }
    return { nombre: registro.tarea_nombre || 'Personal', color: '#8b5cf6', tipo: 'planner' }
  }

  function tiempoPorContexto() {
    const mapa = {}
    registrosSemana.forEach(r => {
      const ctx = getNombreContexto(r)
      if (!mapa[ctx.nombre]) mapa[ctx.nombre] = { nombre: ctx.nombre, color: ctx.color, segundos: 0 }
      mapa[ctx.nombre].segundos += Number(r.duracion_segundos || 0)
    })
    return Object.values(mapa).sort((a, b) => b.segundos - a.segundos)
  }

  function tiempoPorDia() {
    const diasLabel = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
    return fechasSemana.map((fecha, i) => {
      const regs = registrosSemana.filter(r => {
        try { return getISODate(new Date(r.fecha)) === fecha } catch { return false }
      })
      const porTipo = {}
      regs.forEach(r => {
        const ctx = getNombreContexto(r)
        if (!porTipo[ctx.nombre]) porTipo[ctx.nombre] = { color: ctx.color, segundos: 0 }
        porTipo[ctx.nombre].segundos += Number(r.duracion_segundos || 0)
      })
      const totalDia = regs.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
      return { dia: diasLabel[i], fecha, totalDia, porTipo }
    })
  }

  const porContexto = tiempoPorContexto()
  const porDia = tiempoPorDia()
  const totalSemana = registrosSemana.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const maxHoras = Math.max(...porContexto.map(p => p.segundos / 3600), 0.1)
  const maxDia = Math.max(...porDia.map(d => d.totalDia / 3600), 0.1)
  const max4Semanas = Math.max(...ultimas4Semanas.map(s => s.horas), 0.1)

  const esHoy = getISODate(new Date())
  const lunes = getISODate(semanaBase)
  const viernes = fechasSemana[4]
  const esSemanaActual = lunes === getISODate(getLunesDeSemana(new Date()))

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando gráficas...</p></div>

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#373A36' }}>📊 Mis gráficas</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{usuario.nombre}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setSemanaBase(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>←</button>
          <div style={{ textAlign: 'center', minWidth: '140px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#373A36' }}>{formatFecha(lunes)} — {formatFecha(viernes)}</div>
            {esSemanaActual && <div style={{ fontSize: '11px', color: '#00953B', fontWeight: '600' }}>Semana actual</div>}
          </div>
          <button onClick={() => setSemanaBase(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>→</button>
          {!esSemanaActual && (
            <button onClick={() => setSemanaBase(getLunesDeSemana(new Date()))} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#373A36' }}>Hoy</button>
          )}
        </div>
      </div>

      {/* MÉTRICAS RÁPIDAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Horas esta semana', valor: `${Math.round(totalSemana / 3600 * 10) / 10}h`, color: '#00953B' },
          { label: 'En reuniones', valor: `${Math.round(totalSegReu / 3600 * 10) / 10}h`, color: '#f59e0b' },
          { label: 'Trabajo productivo', valor: `${Math.round(totalSegTrabajo / 3600 * 10) / 10}h`, color: '#3b82f6' },
          { label: 'Media diaria', valor: `${Math.round(totalSemana / 3600 / 5 * 10) / 10}h`, color: '#8b5cf6' },
        ].map(m => (
          <div key={m.label} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderTop: `3px solid ${m.color}` }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</p>
            <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: '700', color: '#373A36' }}>{m.valor}</p>
          </div>
        ))}
      </div>

      {/* TIEMPO PRODUCTIVO VS REUNIONES */}
      {totalSemana > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#373A36' }}>Tiempo productivo vs reuniones</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
            <span style={{ color: '#00953B', fontWeight: '600' }}>💼 Trabajo {Math.round(totalSegTrabajo / 3600 * 10) / 10}h ({100 - pctReu}%)</span>
            <span style={{ color: '#f59e0b', fontWeight: '600' }}>🗓 Reuniones {Math.round(totalSegReu / 3600 * 10) / 10}h ({pctReu}%)</span>
          </div>
          <div style={{ height: '14px', background: '#f3f4f6', borderRadius: '7px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ height: '100%', width: `${100 - pctReu}%`, background: '#00953B', transition: 'width 0.4s ease' }} />
            <div style={{ height: '100%', width: `${pctReu}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} />
          </div>
          {reunionesLista.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' }}>Reuniones esta semana</p>
              {reunionesLista.map(r => (
                <div key={r.nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
                  <span style={{ fontSize: '13px', color: '#373A36' }}>{r.nombre}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#f59e0b' }}>{Math.round(r.segundos / 3600 * 10) / 10}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GRÁFICA 1: BARRAS HORIZONTALES */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Tiempo por proyecto / área</h3>
        {porContexto.length === 0
          ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Sin registros esta semana</p>
          : porContexto.map(p => (
            <div key={p.nombre} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#555', fontWeight: '500' }}>{p.nombre}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#373A36' }}>{Math.round(p.segundos / 3600 * 10) / 10}h</span>
              </div>
              <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(p.segundos / 3600 / maxHoras) * 100}%`, background: p.color, borderRadius: '5px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))
        }
      </div>

      {/* GRÁFICA 2: DONUT */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Distribución del tiempo</h3>
        <DonutChart datos={porContexto} total={totalSemana} />
      </div>

      {/* GRÁFICA 3: BARRAS POR DÍA */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Distribución diaria</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '140px' }}>
          {porDia.map(d => {
            const esHoyDia = d.fecha === esHoy
            const alturaPct = maxDia > 0 ? (d.totalDia / 3600 / maxDia) * 100 : 0
            const segmentos = Object.entries(d.porTipo)
            const totalSegundos = d.totalDia
            return (
              <div key={d.dia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: '#9ca3af' }}>{d.totalDia > 0 ? `${Math.round(d.totalDia / 3600 * 10) / 10}h` : ''}</span>
                <div style={{ width: '100%', height: '100px', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${alturaPct}%`, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: d.totalDia > 0 ? '4px' : '0' }}>
                    {segmentos.map(([nombre, { color, segundos }], i) => (
                      <div key={i} style={{ width: '100%', height: `${(segundos / totalSegundos) * 100}%`, background: color, minHeight: '2px' }} />
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: esHoyDia ? '700' : '500', color: esHoyDia ? '#00953B' : '#6b7280' }}>{d.dia}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* GRÁFICA 4: COMPARATIVA 4 SEMANAS */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Comparativa últimas 4 semanas</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '120px' }}>
          {ultimas4Semanas.map((s, i) => {
            const alturaPct = max4Semanas > 0 ? (s.horas / max4Semanas) * 100 : 0
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: s.esSemanaActual ? '#00953B' : '#9ca3af' }}>{s.horas}h</span>
                <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${alturaPct}%`, background: s.esSemanaActual ? '#00953B' : '#d1fae5', borderRadius: '4px 4px 0 0', minHeight: s.horas > 0 ? '4px' : '0', transition: 'height 0.4s ease' }} />
                </div>
                <span style={{ fontSize: '10px', color: s.esSemanaActual ? '#00953B' : '#9ca3af', fontWeight: s.esSemanaActual ? '700' : '400', textAlign: 'center' }}>{s.label}</span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

export default Graficas
