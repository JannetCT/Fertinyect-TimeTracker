import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDatos } from '../contexts/DatosContext'
import * as XLSX from 'xlsx'

const COLORES_USUARIO = {
  'cto.fertinyect@gmail.com':            { color: '#00953B', bg: '#f0fdf4' },
  'tecnico.fertinyect@gmail.com':        { color: '#f59e0b', bg: '#fffbeb' },
  'sanidadvegetal.fertinyect@gmail.com': { color: '#3b82f6', bg: '#eff6ff' },
}

const COLORES_MODULO = {
  proyectos: { color: '#00953B', bg: '#f0fdf4', label: 'Proyectos' },
  soporte:   { color: '#3b82f6', bg: '#eff6ff', label: 'Soporte' },
  direccion: { color: '#7c3aed', bg: '#f5f3ff', label: 'Dirección' },
  reunion:   { color: '#f59e0b', bg: '#fffbeb', label: 'Reuniones' },
}

function getISODate(fecha) {
  const d = new Date(fecha)
  d.setHours(12, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getLunesDeSemana(fecha) {
  const d = new Date(fecha)
  d.setHours(12, 0, 0, 0)
  const dia = d.getDay()
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1))
  return d
}

function getRangoFechas(periodo) {
  const hoy = new Date()
  hoy.setHours(12, 0, 0, 0)
  let inicio, fin
  if (periodo === 'semana_actual') {
    inicio = getLunesDeSemana(hoy)
    fin = new Date(inicio); fin.setDate(fin.getDate() + 6)
  } else if (periodo === 'semana_pasada') {
    fin = getLunesDeSemana(hoy); fin.setDate(fin.getDate() - 1)
    inicio = new Date(fin); inicio.setDate(inicio.getDate() - 6)
  } else if (periodo === 'mes_actual') {
    inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  } else if (periodo === 'mes_pasado') {
    inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  } else if (periodo === 'ultimos_3_meses') {
    inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
    fin = hoy
  } else {
    inicio = new Date(2020, 0, 1); fin = hoy
  }
  return { inicio: getISODate(inicio), fin: getISODate(fin) }
}

function perteneceAlPeriodo(fechaRegistro, inicio, fin) {
  if (!fechaRegistro) return false
  try {
    const iso = getISODate(new Date(fechaRegistro))
    return iso >= inicio && iso <= fin
  } catch { return false }
}

function formatHoras(segundos) {
  return Math.round(segundos / 3600 * 10) / 10
}

function getFechasDeSemana(lunes) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(lunes); d.setDate(d.getDate() + i)
    return getISODate(d)
  })
}

function formatFecha(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  return `${d.getDate()} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]}`
}

const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

function Dashboard() {
  const { accessToken } = useAuth()
  const { obtenerHoja } = useDatos()
  const [periodo, setPeriodo] = useState('semana_actual')
  const [registros, setRegistros] = useState([])
  const [tareas, setTareas] = useState([])
  const [tareasSoporte, setTareasSoporte] = useState([])
  const [tareasDireccion, setTareasDireccion] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [categoriasSoporte, setCategoriasSoporte] = useState([])
  const [categoriasDireccion, setCategoriasDireccion] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargarDatos() {
      try {
        const [reg, tar, tarS, tarD, proy, catS, catD, usu] = await Promise.all([
          obtenerHoja('registros'),
          obtenerHoja('tareas'),
          obtenerHoja('tareas_soporte'),
          obtenerHoja('tareas_direccion'),
          obtenerHoja('proyectos'),
          obtenerHoja('categorias_soporte'),
          obtenerHoja('categorias_direccion'),
          obtenerHoja('usuarios'),
        ])
        setRegistros(reg)
        setTareas(tar)
        setTareasSoporte(tarS)
        setTareasDireccion(tarD)
        setProyectos(proy.filter(p => p.fecha_creacion !== 'eliminado' && p.id))
        setCategoriasSoporte(catS)
        setCategoriasDireccion(catD)
        setUsuarios(usu)
      } catch (err) { console.error(err) }
      finally { setCargando(false) }
    }
    if (accessToken) cargarDatos()
  }, [accessToken])

  const { inicio, fin } = getRangoFechas(periodo)
  const registrosPeriodo = registros.filter(r => perteneceAlPeriodo(r.fecha, inicio, fin))

  function getNombreUsuario(userId) {
    return usuarios.find(u => u.id === userId)?.nombre || userId
  }

  // MÉTRICAS BÁSICAS
  const totalSegundos = registrosPeriodo.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const tareasCompletadas = [...tareas, ...tareasSoporte].filter(t => t.estado === 'completada').length
  const proyectosActivos = proyectos.length
  const horasPorUsuario = {}
  registrosPeriodo.forEach(r => {
    const uid = r.usuario_id || r.usuarios_id
    horasPorUsuario[uid] = (horasPorUsuario[uid] || 0) + Number(r.duracion_segundos || 0)
  })
  const masActivoId = Object.entries(horasPorUsuario).sort((a, b) => b[1] - a[1])[0]?.[0]
  const masActivo = getNombreUsuario(masActivoId)

  // RESUMEN GLOBAL POR MÓDULO
  const segProyectos = registrosPeriodo.filter(r => r.tipo_tarea === 'proyecto').reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const segSoporte = registrosPeriodo.filter(r => r.tipo_tarea === 'soporte' || r.tipo_tarea === 'soporte_proyecto' || r.tipo_tarea === 'soporte_subcarpeta').reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const segDireccion = registrosPeriodo.filter(r => r.tipo_tarea === 'direccion').reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const segReuniones = registrosPeriodo.filter(r => r.tipo_tarea === 'evento').reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const segPlanner = registrosPeriodo.filter(r => r.tipo_tarea === 'planner').reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const totalModulos = segProyectos + segSoporte + segDireccion + segReuniones + segPlanner
  const maxModulo = Math.max(segProyectos, segSoporte, segDireccion, segReuniones, segPlanner, 1)

  const modulosData = [
    { key: 'proyectos', label: 'Proyectos', seg: segProyectos, color: '#00953B' },
    { key: 'soporte', label: 'Soporte', seg: segSoporte, color: '#3b82f6' },
    { key: 'direccion', label: 'Dirección', seg: segDireccion, color: '#7c3aed' },
    { key: 'reunion', label: 'Reuniones', seg: segReuniones, color: '#f59e0b' },
    { key: 'planner', label: 'Tareas libres', seg: segPlanner, color: '#8b5cf6' },
  ].filter(m => m.seg > 0)

  // TIEMPO PRODUCTIVO VS REUNIONES POR PERSONA
  const productividadPersona = usuarios.map(u => {
    const regsU = registrosPeriodo.filter(r => (r.usuario_id || r.usuarios_id) === u.id)
    const segTotal = regsU.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    const segReu = regsU.filter(r => r.tipo_tarea === 'evento').reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    const segTrabajo = segTotal - segReu
    const email = u.email || ''
    const cu = COLORES_USUARIO[email] || { color: '#6b7280', bg: '#f3f4f6' }
    return { nombre: u.nombre, segTotal, segTrabajo, segReu, color: cu.color, pctReu: segTotal > 0 ? Math.round(segReu / segTotal * 100) : 0 }
  }).filter(p => p.segTotal > 0)

  // TIEMPO POR PERSONA
  const porPersona = usuarios.map(u => {
    const seg = registrosPeriodo.filter(r => (r.usuario_id || r.usuarios_id) === u.id).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    const email = u.email || ''
    const cu = COLORES_USUARIO[email] || { color: '#6b7280', bg: '#f3f4f6' }
    const totalGeneral = registros.filter(r => (r.usuario_id || r.usuarios_id) === u.id).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    return { nombre: u.nombre, horas: formatHoras(seg), segundos: seg, color: cu.color, bg: cu.bg, totalHoras: formatHoras(totalGeneral) }
  })
  const maxPersona = Math.max(...porPersona.map(p => p.segundos), 1)

  // TIEMPO POR PROYECTO
  const porProyecto = proyectos.map(p => {
    const tareasIds = tareas.filter(t => t.proyecto_id === p.id).map(t => t.id)
    const seg = registrosPeriodo.filter(r => tareasIds.includes(r.tarea_id)).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    const tareasTotal = tareas.filter(t => t.proyecto_id === p.id)
    const completadas = tareasTotal.filter(t => t.estado === 'completada').length
    const progreso = tareasTotal.length > 0 ? Math.round(completadas / tareasTotal.length * 100) : 0
    const alerta = p.fecha_fin && new Date(p.fecha_fin + '-01') < new Date() && progreso < 100
    return { nombre: p.nombre, horas: formatHoras(seg), segundos: seg, color: p.color || '#6b7280', progreso, alerta }
  }).filter(p => p.segundos > 0)
  const maxProyecto = Math.max(...porProyecto.map(p => p.segundos), 1)

  // TIEMPO POR SOPORTE (por categoría)
  const porSoporte = categoriasSoporte.map(cat => {
    const tareasIds = tareasSoporte.filter(t => t.categoria_id === cat.id).map(t => t.id)
    const seg = registrosPeriodo.filter(r => tareasIds.includes(r.tarea_id)).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    const tareasTotal = tareasSoporte.filter(t => t.categoria_id === cat.id)
    const completadas = tareasTotal.filter(t => t.estado === 'completada').length
    const progreso = tareasTotal.length > 0 ? Math.round(completadas / tareasTotal.length * 100) : 0
    return { nombre: cat.nombre, horas: formatHoras(seg), segundos: seg, progreso }
  }).filter(p => p.segundos > 0)
  const maxSoporte = Math.max(...porSoporte.map(p => p.segundos), 1)

  // TIEMPO POR DIRECCIÓN (por categoría)
  const porDireccion = categoriasDireccion.map(cat => {
    const tareasIds = tareasDireccion.filter(t => t.categoria_id === cat.id).map(t => t.id)
    const seg = registrosPeriodo.filter(r => tareasIds.includes(r.tarea_id)).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    const tareasTotal = tareasDireccion.filter(t => t.categoria_id === cat.id)
    const completadas = tareasTotal.filter(t => t.estado === 'completada').length
    const progreso = tareasTotal.length > 0 ? Math.round(completadas / tareasTotal.length * 100) : 0
    return { nombre: cat.nombre, horas: formatHoras(seg), segundos: seg, progreso }
  }).filter(p => p.segundos > 0)
  const maxDireccion = Math.max(...porDireccion.map(p => p.segundos), 1)

  // TENDENCIA 4 SEMANAS
  const semanaActual = getLunesDeSemana(new Date(inicio + 'T12:00:00'))
  const ultimas4Semanas = Array.from({ length: 4 }, (_, i) => {
    const lunes = new Date(semanaActual)
    lunes.setDate(lunes.getDate() - (3 - i) * 7)
    const fechas = getFechasDeSemana(lunes)
    const seg = registros.filter(r => {
      try { return fechas.includes(getISODate(new Date(r.fecha))) } catch { return false }
    }).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    return { label: formatFecha(fechas[0]), horas: formatHoras(seg), esSemanaActual: i === 3 }
  })
  const max4Semanas = Math.max(...ultimas4Semanas.map(s => s.horas), 0.1)

  // REUNIONES
  const registrosEventos = registrosPeriodo.filter(r => r.tipo_tarea === 'evento')
  const totalSegundosEventos = registrosEventos.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
  const eventosPorPersona = usuarios.map(u => {
    const seg = registrosEventos.filter(r => (r.usuario_id || r.usuarios_id) === u.id).reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0)
    const email = u.email || ''
    const cu = COLORES_USUARIO[email] || { color: '#6b7280', bg: '#f3f4f6' }
    return { nombre: u.nombre, horas: formatHoras(seg), segundos: seg, color: cu.color }
  }).filter(p => p.segundos > 0)
  const maxEvento = Math.max(...eventosPorPersona.map(p => p.segundos), 1)
  const reunionesDetalle = registrosEventos.reduce((acc, r) => {
    const nombre = r.tarea_nombre || 'Sin título'
    if (!acc[nombre]) acc[nombre] = { nombre, segundos: 0, personas: new Set() }
    acc[nombre].segundos += Number(r.duracion_segundos || 0)
    acc[nombre].personas.add(getNombreUsuario(r.usuario_id || r.usuarios_id))
    return acc
  }, {})
  const reunionesLista = Object.values(reunionesDetalle).sort((a, b) => b.segundos - a.segundos)

  // DISTRIBUCIÓN DIARIA
  const esSemana = periodo === 'semana_actual' || periodo === 'semana_pasada'
  function distribucionDiaria() {
    const lunes = getLunesDeSemana(new Date(inicio + 'T12:00:00'))
    return DIAS_LABEL.map((dia, i) => {
      const fecha = new Date(lunes); fecha.setDate(fecha.getDate() + i)
      const fechaISO = getISODate(fecha)
      const regsDelDia = registrosPeriodo.filter(r => {
        try { return getISODate(new Date(r.fecha)) === fechaISO } catch { return false }
      })
      const porUsuario = {}
      regsDelDia.forEach(r => {
        const uid = r.usuario_id || r.usuarios_id
        porUsuario[uid] = (porUsuario[uid] || 0) + Number(r.duracion_segundos || 0)
      })
      return { dia, fecha: fechaISO, porUsuario, total: regsDelDia.reduce((acc, r) => acc + Number(r.duracion_segundos || 0), 0) }
    })
  }
  const diasData = esSemana ? distribucionDiaria() : []
  const maxDia = Math.max(...diasData.map(d => d.total / 3600), 0.1)

  // EXPORTAR
  function exportarExcel() {
    const wb = XLSX.utils.book_new()
    const resumen = [
      ['Dashboard I+D — Fertinyect'],
      [`Periodo: ${inicio} a ${fin}`],
      [''],
      ['RESUMEN POR MÓDULO'],
      ['Módulo', 'Horas', '% del total'],
      ...modulosData.map(m => [m.label, formatHoras(m.seg) + 'h', totalModulos > 0 ? Math.round(m.seg / totalModulos * 100) + '%' : '0%']),
      [''],
      ['TIEMPO PRODUCTIVO VS REUNIONES'],
      ['Persona', 'Total', 'Trabajo', 'Reuniones', '% Reuniones'],
      ...productividadPersona.map(p => [p.nombre, formatHoras(p.segTotal) + 'h', formatHoras(p.segTrabajo) + 'h', formatHoras(p.segReu) + 'h', p.pctReu + '%']),
      [''],
      ['TIEMPO POR PROYECTO'],
      ['Proyecto', 'Horas', 'Progreso'],
      ...porProyecto.map(p => [p.nombre, p.horas + 'h', p.progreso + '%']),
      [''],
      ['TIEMPO POR SOPORTE'],
      ['Categoría', 'Horas'],
      ...porSoporte.map(p => [p.nombre, p.horas + 'h']),
      [''],
      ['TIEMPO POR DIRECCIÓN'],
      ['Categoría', 'Horas'],
      ...porDireccion.map(p => [p.nombre, p.horas + 'h']),
      [''],
      ['REUNIONES'],
      ['Reunión', 'Horas', 'Personas'],
      ...reunionesLista.map(r => [r.nombre, formatHoras(r.segundos) + 'h', [...r.personas].join(', ')]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(resumen)
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen')
    const cabReg = ['Fecha', 'Usuario', 'Tarea', 'Horas', 'Tipo']
    const filasReg = registrosPeriodo.map(r => [r.fecha, getNombreUsuario(r.usuario_id || r.usuarios_id), r.tarea_nombre || '', formatHoras(Number(r.duracion_segundos || 0)), r.tipo_tarea || ''])
    const wsReg = XLSX.utils.aoa_to_sheet([cabReg, ...filasReg])
    wsReg['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsReg, 'Registros')
    XLSX.writeFile(wb, `dashboard_id_${inicio}_${fin}.xlsx`)
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando dashboard...</p></div>

  const PERIODOS = [
    { value: 'semana_actual', label: 'Esta semana' },
    { value: 'semana_pasada', label: 'Semana pasada' },
    { value: 'mes_actual', label: 'Este mes' },
    { value: 'mes_pasado', label: 'Mes pasado' },
    { value: 'ultimos_3_meses', label: 'Últimos 3 meses' },
    { value: 'todo', label: 'Todo' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#373A36' }}>🎯 Dashboard I+D</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>Vista global del equipo · Fertinyect</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', flexWrap: 'wrap' }}>
            {PERIODOS.map(p => (
              <button key={p.value} onClick={() => setPeriodo(p.value)} style={{ padding: '7px 12px', background: periodo === p.value ? '#00953B' : 'white', color: periodo === p.value ? 'white' : '#373A36', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', borderRight: '1px solid #e5e7eb' }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={exportarExcel} style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>📥 Exportar</button>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Horas equipo', valor: `${formatHoras(totalSegundos)}h`, color: '#00953B', sub: `${inicio} — ${fin}` },
          { label: 'En reuniones', valor: `${formatHoras(totalSegundosEventos)}h`, color: '#f59e0b', sub: 'este periodo' },
          { label: 'Tareas completadas', valor: tareasCompletadas, color: '#3b82f6', sub: 'total acumulado' },
          { label: 'Proyectos activos', valor: proyectosActivos, color: '#8b5cf6', sub: 'en curso' },
          { label: 'Más activo', valor: masActivo, color: '#f59e0b', sub: 'este periodo' },
        ].map(m => (
          <div key={m.label} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderTop: `3px solid ${m.color}` }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</p>
            <p style={{ margin: '6px 0 2px', fontSize: '22px', fontWeight: '700', color: '#373A36' }}>{m.valor}</p>
            <p style={{ margin: 0, fontSize: '10px', color: '#d1d5db' }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* RESUMEN GLOBAL POR MÓDULO */}
      {modulosData.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Distribución por módulo</h3>
          {modulosData.map(m => (
            <div key={m.key} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: m.color }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#373A36' }}>{m.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{totalModulos > 0 ? Math.round(m.seg / totalModulos * 100) : 0}%</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: m.color }}>{formatHoras(m.seg)}h</span>
                </div>
              </div>
              <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(m.seg / maxModulo) * 100}%`, background: m.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIEMPO PRODUCTIVO VS REUNIONES */}
      {productividadPersona.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Tiempo productivo vs reuniones</h3>
          {productividadPersona.map(p => (
            <div key={p.nombre} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#373A36' }}>{p.nombre}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                  <span style={{ color: p.color, fontWeight: '600' }}>💼 {formatHoras(p.segTrabajo)}h trabajo</span>
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>🗓 {formatHoras(p.segReu)}h reuniones ({p.pctReu}%)</span>
                </div>
              </div>
              <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ height: '100%', width: `${100 - p.pctReu}%`, background: p.color, transition: 'width 0.4s ease' }} />
                <div style={{ height: '100%', width: `${p.pctReu}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#00953B' }} /><span style={{ fontSize: '12px', color: '#555' }}>Trabajo productivo</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} /><span style={{ fontSize: '12px', color: '#555' }}>Reuniones</span></div>
          </div>
        </div>
      )}

      {/* TENDENCIA 4 SEMANAS */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Tendencia del equipo — últimas 4 semanas</h3>
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

      {/* TIEMPO POR PERSONA */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Tiempo por persona</h3>
        {porPersona.map(p => (
          <div key={p.nombre} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#373A36' }}>{p.nombre}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: p.color }}>{p.horas}h</span>
                <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>/ {p.totalHoras}h total</span>
              </div>
            </div>
            <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(p.segundos / maxPersona) * 100}%`, background: p.color, borderRadius: '5px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* TIEMPO POR PROYECTO */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>📁 Tiempo por proyecto</h3>
        {porProyecto.length === 0
          ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Sin registros en este periodo</p>
          : porProyecto.map(p => (
            <div key={p.nombre} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: p.color }} />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#373A36' }}>{p.nombre}</span>
                  {p.alerta && <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '10px', fontWeight: '600' }}>⚠️ Vencido</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{p.progreso}% completado</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#373A36' }}>{p.horas}h</span>
                </div>
              </div>
              <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(p.segundos / maxProyecto) * 100}%`, background: p.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p.progreso}%`, background: '#00953B', opacity: 0.5, borderRadius: '2px' }} />
              </div>
            </div>
          ))
        }
      </div>

      {/* TIEMPO POR SOPORTE */}
      {porSoporte.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>🛠️ Tiempo por Soporte</h3>
          {porSoporte.map(p => (
            <div key={p.nombre} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6' }} />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#373A36' }}>{p.nombre}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{p.progreso}% completado</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6' }}>{p.horas}h</span>
                </div>
              </div>
              <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(p.segundos / maxSoporte) * 100}%`, background: '#3b82f6', borderRadius: '4px', transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p.progreso}%`, background: '#3b82f6', opacity: 0.4, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIEMPO POR DIRECCIÓN */}
      {porDireccion.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>🏢 Tiempo por Dirección</h3>
          {porDireccion.map(p => (
            <div key={p.nombre} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#7c3aed' }} />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#373A36' }}>{p.nombre}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{p.progreso}% completado</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#7c3aed' }}>{p.horas}h</span>
                </div>
              </div>
              <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(p.segundos / maxDireccion) * 100}%`, background: '#7c3aed', borderRadius: '4px', transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p.progreso}%`, background: '#7c3aed', opacity: 0.4, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIEMPO EN REUNIONES */}
      {totalSegundosEventos > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#373A36' }}>🗓 Tiempo en reuniones</h3>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>{formatHoras(totalSegundosEventos)}h total</span>
          </div>
          {eventosPorPersona.map(p => (
            <div key={p.nombre} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#373A36' }}>{p.nombre}</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: '700', color: p.color }}>{p.horas}h</span>
              </div>
              <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(p.segundos / maxEvento) * 100}%`, background: '#f59e0b', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
          {reunionesLista.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' }}>Detalle por reunión</p>
              {reunionesLista.map(r => (
                <div key={r.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#373A36' }}>{r.nombre}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>{[...r.personas].join(', ')}</p>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#f59e0b' }}>{formatHoras(r.segundos)}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISTRIBUCIÓN DIARIA */}
      {esSemana && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '15px', color: '#373A36' }}>Distribución diaria del equipo</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '160px' }}>
            {diasData.map(d => {
              const totalHoras = d.total / 3600
              const alturaPct = maxDia > 0 ? (totalHoras / maxDia) * 100 : 0
              const segmentos = usuarios.map(u => {
                const seg = d.porUsuario[u.id] || 0
                const email = u.email || ''
                const cu = COLORES_USUARIO[email] || { color: '#6b7280' }
                return { nombre: u.nombre, seg, color: cu.color }
              }).filter(s => s.seg > 0)
              return (
                <div key={d.dia} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: '#9ca3af' }}>{totalHoras > 0 ? `${formatHoras(d.total)}h` : ''}</span>
                  <div style={{ width: '100%', height: '110px', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${alturaPct}%`, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: d.total > 0 ? '4px' : '0' }}>
                      {segmentos.map((s, i) => (
                        <div key={i} style={{ width: '100%', height: `${(s.seg / d.total) * 100}%`, background: s.color, minHeight: '2px' }} title={`${s.nombre}: ${formatHoras(s.seg)}h`} />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: d.fecha === getISODate(new Date()) ? '#00953B' : '#6b7280' }}>{d.dia}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
            {usuarios.map(u => {
              const email = u.email || ''
              const cu = COLORES_USUARIO[email] || { color: '#6b7280' }
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: cu.color }} />
                  <span style={{ fontSize: '12px', color: '#555' }}>{u.nombre}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard
