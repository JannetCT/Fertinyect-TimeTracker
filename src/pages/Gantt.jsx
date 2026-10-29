import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import { actualizarFila } from '../services/googleSheets'
import { useDatos } from '../contexts/DatosContext'

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

// Returns 0-3 for week quarter within month, or null if date is month-only
function getSemanaEnMes(fechaStr) {
  if (!fechaStr || fechaStr.length <= 7) return null
  const day = parseInt(fechaStr.slice(8, 10))
  if (day <= 7) return 0
  if (day <= 14) return 1
  if (day <= 21) return 2
  return 3
}

// Returns [bool, bool, bool, bool] for which of the 4 week-quarters are active in this month
function getSemanasActivas(mes, fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return [false, false, false, false]
  const inicioMes = fechaInicio.slice(0, 7)
  const finMes = fechaFin.slice(0, 7)
  if (mes < inicioMes || mes > finMes) return [false, false, false, false]
  const si = mes === inicioMes ? (getSemanaEnMes(fechaInicio) ?? 0) : 0
  const sf = mes === finMes ? (getSemanaEnMes(fechaFin) ?? 3) : 3
  return [0, 1, 2, 3].map(s => s >= si && s <= sf)
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 149, 59]
}

// Render 4 week-quarter cells inside a month column
function BarraSemanas({ semanas, color, altura = 20, radio = 10 }) {
  const activas = semanas.filter(Boolean)
  if (!activas.length) return null
  const primeraActiva = semanas.indexOf(true)
  const ultimaActiva = semanas.lastIndexOf(true)

  return (
    <div style={{ display: 'flex', width: '100%', height: altura, alignItems: 'center' }}>
      {semanas.map((activa, i) => {
        if (!activa) return <div key={i} style={{ flex: 1 }} />
        const esFirst = i === primeraActiva
        const esLast = i === ultimaActiva
        return (
          <div key={i} style={{
            flex: 1,
            height: altura,
            background: color,
            borderRadius: esFirst && esLast ? radio : esFirst ? `${radio}px 0 0 ${radio}px` : esLast ? `0 ${radio}px ${radio}px 0` : '0',
            opacity: 0.85,
          }} />
        )
      })}
    </div>
  )
}

function Gantt() {
  const { accessToken } = useAuth()
  const { obtenerHoja } = useDatos()
  const [proyectos, setProyectos] = useState([])
  const [estados, setEstados] = useState([])
  const [acciones, setAcciones] = useState([])
  const [ensayos, setEnsayos] = useState([])
  const [tareas, setTareas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null)
  const [expandidosEstado, setExpandidosEstado] = useState({})
  const [expandidosAccion, setExpandidosAccion] = useState({})
  const [editando, setEditando] = useState(null)
  const [formFechas, setFormFechas] = useState({ fecha_inicio: '', fecha_fin: '' })
  const ganttRef = useRef(null)

  useEffect(() => { if (accessToken) cargarDatos() }, [accessToken])

  async function cargarDatos() {
    try {
      const [p, es, a, e, t] = await Promise.all([
        obtenerHoja('proyectos'),
        obtenerHoja('estados_proyecto'),
        obtenerHoja('acciones'),
        obtenerHoja('ensayos'),
        obtenerHoja('tareas')
      ])
      setProyectos(p.filter(p => p.fecha_creacion !== 'eliminado' && p.id))
      setEstados(es)
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
    await Promise.all([
      obtenerHoja('acciones', { forzar: true }),
      obtenerHoja('ensayos', { forzar: true }),
    ])
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

  function rangoEstado(estadoId) {
    const accs = acciones.filter(a => a.estado_id === estadoId)
    const ens = ensayos.filter(e => accs.some(a => a.id === e.accion_id))
    const fechas = [
      ...accs.filter(a => a.fecha_inicio).map(a => a.fecha_inicio),
      ...accs.filter(a => a.fecha_fin).map(a => a.fecha_fin),
      ...ens.filter(e => e.fecha_inicio).map(e => e.fecha_inicio),
      ...ens.filter(e => e.fecha_fin).map(e => e.fecha_fin),
    ].sort()
    return { inicio: fechas[0] || null, fin: fechas[fechas.length - 1] || null }
  }

  function calcularRangoFechas(accionesProyecto) {
    const ensayosProyecto = ensayos.filter(e => e.proyecto_id === proyectoSeleccionado?.id)
    const fechas = [
      ...accionesProyecto.filter(a => a.fecha_inicio).map(a => a.fecha_inicio),
      ...accionesProyecto.filter(a => a.fecha_fin).map(a => a.fecha_fin),
      ...ensayosProyecto.filter(e => e.fecha_inicio).map(e => e.fecha_inicio),
      ...ensayosProyecto.filter(e => e.fecha_fin).map(e => e.fecha_fin),
    ].sort()
    const inicio = fechas[0] ? fechas[0].slice(0, 7) : getMesActual()
    const fin = fechas[fechas.length - 1] ? fechas[fechas.length - 1].slice(0, 7) : `${new Date().getFullYear() + 1}-12`
    return { inicio, fin, meses: getMeses(inicio, fin) }
  }

  function exportarPDF() {
    if (!proyectoSeleccionado) return
    const accionesProyecto = acciones.filter(a => a.proyecto_id === proyectoSeleccionado.id)
    const estadosProyecto = estados.filter(e => e.proyecto_id === proyectoSeleccionado.id)
    const { meses } = calcularRangoFechas(accionesProyecto)
    const colorProyecto = hexToRgb(proyectoSeleccionado.color || '#00953B')

    const COL_NOMBRE_PDF = 70
    const totalMeses = meses.length
    const COL_MES_PDF = Math.max(5, Math.min(12, Math.floor((297 - 14 - 14 - COL_NOMBRE_PDF) / totalMeses)))
    const anchoTotal = COL_NOMBRE_PDF + (COL_MES_PDF * totalMeses) + 28
    const formato = anchoTotal > 297 ? [anchoTotal, 210] : 'a4'
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: formato })
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFillColor(0, 149, 59)
    doc.rect(0, 0, pageW, 18, 'F')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.setFont(undefined, 'bold')
    doc.text(`Diagrama de Gantt — ${proyectoSeleccionado.nombre}`, 14, 12)
    doc.setFontSize(8)
    doc.setFont(undefined, 'normal')
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageW - 14, 12, { align: 'right' })

    let y = 24

    const años = {}
    meses.forEach(m => { const año = m.slice(0, 4); años[año] = (años[año] || 0) + 1 })
    doc.setFillColor(249, 250, 251)
    doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, 6, 'F')
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.3)
    let xAño = 14 + COL_NOMBRE_PDF
    Object.entries(años).forEach(([año, count]) => {
      const w = COL_MES_PDF * count
      doc.setFillColor(240, 253, 244)
      doc.rect(xAño, y, w, 6, 'F')
      doc.rect(xAño, y, w, 6, 'S')
      doc.setFontSize(7)
      doc.setTextColor(55, 58, 54)
      doc.setFont(undefined, 'bold')
      doc.text(año, xAño + w / 2, y + 4, { align: 'center' })
      xAño += w
    })
    y += 6

    doc.setFillColor(255, 255, 255)
    doc.rect(14, y, COL_NOMBRE_PDF, 5, 'F')
    doc.setFontSize(6)
    doc.setFont(undefined, 'bold')
    const mesActual = getMesActual()
    meses.forEach((mes, i) => {
      const x = 14 + COL_NOMBRE_PDF + i * COL_MES_PDF
      const esMesActual = mes === mesActual
      doc.setFillColor(esMesActual ? 240 : 249, esMesActual ? 253 : 250, esMesActual ? 244 : 251)
      doc.rect(x, y, COL_MES_PDF, 5, 'F')
      doc.rect(x, y, COL_MES_PDF, 5, 'S')
      doc.setTextColor(esMesActual ? 0 : 107, esMesActual ? 149 : 114, esMesActual ? 59 : 128)
      doc.text(MESES[parseInt(mes.slice(5, 7)) - 1], x + COL_MES_PDF / 2, y + 3.5, { align: 'center' })
    })
    y += 5

    const FILA_H = 7
    const FILA_SUB_H = 6

    estadosProyecto.forEach(estado => {
      const accsEstado = accionesProyecto.filter(a => a.estado_id === estado.id)
      const { inicio: iniE, fin: finE } = rangoEstado(estado.id)

      // Fila estado
      doc.setFillColor(240, 253, 244)
      doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_H, 'F')
      doc.setDrawColor(229, 231, 235)
      doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_H, 'S')
      doc.setFontSize(7)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(0, 100, 40)
      doc.text(estado.nombre.length > 28 ? estado.nombre.slice(0, 26) + '…' : estado.nombre, 16, y + FILA_H / 2 + 1.5)
      if (iniE && finE) {
        meses.forEach((mes, i) => {
          const semanas = getSemanasActivas(mes, iniE, finE)
          semanas.forEach((activa, s) => {
            if (!activa) return
            const x = 14 + COL_NOMBRE_PDF + i * COL_MES_PDF + s * (COL_MES_PDF / 4)
            doc.setFillColor(...colorProyecto)
            doc.setGState(doc.GState({ opacity: 0.3 }))
            doc.rect(x, y + 2, COL_MES_PDF / 4, 3, 'F')
            doc.setGState(doc.GState({ opacity: 1 }))
          })
        })
      }
      y += FILA_H

      accsEstado.forEach(accion => {
        const progreso = progresoAccion(accion.id)
        doc.setFillColor(248, 249, 250)
        doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_H, 'F')
        doc.setDrawColor(243, 244, 246)
        doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_H, 'S')
        doc.setFontSize(7)
        doc.setFont(undefined, 'bold')
        doc.setTextColor(55, 58, 54)
        doc.text((accion.nombre.length > 26 ? accion.nombre.slice(0, 24) + '…' : accion.nombre), 20, y + FILA_H / 2 + 1.5)
        if (progreso > 0) {
          doc.setFontSize(6)
          doc.setTextColor(0, 149, 59)
          doc.text(`${progreso}%`, 14 + COL_NOMBRE_PDF - 8, y + FILA_H / 2 + 1.5)
        }
        meses.forEach((mes, i) => {
          const semanas = getSemanasActivas(mes, accion.fecha_inicio, accion.fecha_fin)
          semanas.forEach((activa, s) => {
            if (!activa) return
            const x = 14 + COL_NOMBRE_PDF + i * COL_MES_PDF + s * (COL_MES_PDF / 4)
            doc.setFillColor(...colorProyecto)
            doc.rect(x, y + 1.5, COL_MES_PDF / 4, 4, 'F')
          })
        })
        y += FILA_H

        const ensayosAccion = ensayos.filter(e => e.accion_id === accion.id)
        ensayosAccion.forEach(ensayo => {
          const progEnsayo = progresoEnsayo(ensayo.id)
          const esEnsayo = ensayo.tipo === 'ensayo'
          doc.setFillColor(255, 255, 255)
          doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_SUB_H, 'F')
          doc.setDrawColor(243, 244, 246)
          doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_SUB_H, 'S')
          doc.setFillColor(esEnsayo ? 219 : 254, esEnsayo ? 234 : 243, esEnsayo ? 254 : 199)
          doc.roundedRect(24, y + 1.5, 5, 3, 0.5, 0.5, 'F')
          doc.setFontSize(5)
          doc.setFont(undefined, 'bold')
          doc.setTextColor(esEnsayo ? 29 : 146, esEnsayo ? 78 : 64, esEnsayo ? 216 : 14)
          doc.text(esEnsayo ? 'E' : 'I', 26.5, y + 3.8, { align: 'center' })
          doc.setFontSize(6.5)
          doc.setFont(undefined, 'normal')
          doc.setTextColor(85, 85, 85)
          doc.text((ensayo.nombre.length > 24 ? ensayo.nombre.slice(0, 22) + '…' : ensayo.nombre), 31, y + FILA_SUB_H / 2 + 1.2)
          if (progEnsayo > 0) {
            doc.setFontSize(5.5)
            doc.setTextColor(0, 149, 59)
            doc.text(`${progEnsayo}%`, 14 + COL_NOMBRE_PDF - 8, y + FILA_SUB_H / 2 + 1.2)
          }
          meses.forEach((mes, i) => {
            const semanas = getSemanasActivas(mes, ensayo.fecha_inicio, ensayo.fecha_fin)
            semanas.forEach((activa, s) => {
              if (!activa) return
              const x = 14 + COL_NOMBRE_PDF + i * COL_MES_PDF + s * (COL_MES_PDF / 4)
              doc.setFillColor(esEnsayo ? 59 : 245, esEnsayo ? 130 : 158, esEnsayo ? 246 : 11)
              doc.rect(x, y + 2, COL_MES_PDF / 4, 2.5, 'F')
            })
          })
          y += FILA_SUB_H
        })
      })
    })

    y += 4
    doc.setFontSize(6.5)
    doc.setFont(undefined, 'normal')
    const leyendas = [
      { color: colorProyecto, label: 'Acción' },
      { color: [59, 130, 246], label: 'Ensayo' },
      { color: [245, 158, 11], label: 'Informe' },
    ]
    let xL = 14
    leyendas.forEach(({ color, label }) => {
      doc.setFillColor(...color)
      doc.roundedRect(xL, y, 8, 3, 0.5, 0.5, 'F')
      doc.setTextColor(85, 85, 85)
      doc.text(label, xL + 10, y + 2.5)
      xL += 28
    })
    doc.save(`gantt_${proyectoSeleccionado.nombre}.pdf`)
  }

  function exportarExcel() {
    if (!proyectoSeleccionado) return
    const accionesProyecto = acciones.filter(a => a.proyecto_id === proyectoSeleccionado.id)
    const estadosProyecto = estados.filter(e => e.proyecto_id === proyectoSeleccionado.id)
    const { meses } = calcularRangoFechas(accionesProyecto)
    const wb = XLSX.utils.book_new()

    const datosTabla = [['Actividad', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Progreso']]
    estadosProyecto.forEach(estado => {
      datosTabla.push([estado.nombre, 'Estado', '', '', ''])
      acciones.filter(a => a.estado_id === estado.id).forEach(accion => {
        datosTabla.push(['  ' + accion.nombre, 'Acción', accion.fecha_inicio || '', accion.fecha_fin || '', progresoAccion(accion.id) + '%'])
        ensayos.filter(e => e.accion_id === accion.id).forEach(ensayo => {
          datosTabla.push(['    ' + ensayo.nombre, ensayo.tipo === 'ensayo' ? 'Ensayo' : 'Informe', ensayo.fecha_inicio || '', ensayo.fecha_fin || '', progresoEnsayo(ensayo.id) + '%'])
        })
      })
    })
    const wsTabla = XLSX.utils.aoa_to_sheet(datosTabla)
    wsTabla['!cols'] = [{ wch: 45 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsTabla, 'Datos')

    const cabecera = ['Actividad', 'Tipo', 'Progreso']
    meses.forEach(m => cabecera.push(MESES[parseInt(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4)))
    const filaDiagrama = [cabecera]
    estadosProyecto.forEach(estado => {
      const { inicio: iniE, fin: finE } = rangoEstado(estado.id)
      const filaEst = [estado.nombre, 'Estado', '']
      meses.forEach(mes => { filaEst.push(getSemanasActivas(mes, iniE, finE).some(Boolean) ? '▒' : '') })
      filaDiagrama.push(filaEst)
      acciones.filter(a => a.estado_id === estado.id).forEach(accion => {
        const filaAcc = ['  ' + accion.nombre, 'Acción', progresoAccion(accion.id) + '%']
        meses.forEach(mes => { filaAcc.push(getSemanasActivas(mes, accion.fecha_inicio, accion.fecha_fin).some(Boolean) ? '█' : '') })
        filaDiagrama.push(filaAcc)
        ensayos.filter(e => e.accion_id === accion.id).forEach(ensayo => {
          const filaEn = ['    ' + ensayo.nombre, ensayo.tipo === 'ensayo' ? 'Ensayo' : 'Informe', progresoEnsayo(ensayo.id) + '%']
          meses.forEach(mes => { filaEn.push(getSemanasActivas(mes, ensayo.fecha_inicio, ensayo.fecha_fin).some(Boolean) ? '█' : '') })
          filaDiagrama.push(filaEn)
        })
      })
    })
    const wsDiagrama = XLSX.utils.aoa_to_sheet(filaDiagrama)
    wsDiagrama['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 10 }, ...meses.map(() => ({ wch: 4 }))]
    XLSX.utils.book_append_sheet(wb, wsDiagrama, 'Diagrama')
    XLSX.writeFile(wb, `gantt_${proyectoSeleccionado.nombre}.xlsx`)
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando Gantt...</p></div>

  if (!proyectoSeleccionado) {
    return (
      <div className="proyectos-container">
        <div className="proyectos-header">
          <h1>📊 Diagrama de Gantt</h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {proyectos.map(p => (
            <div key={p.id} onClick={() => setProyectoSeleccionado(p)}
              style={{ background: 'white', borderRadius: '12px', padding: '24px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${p.color || '#00953B'}`, transition: 'box-shadow 0.2s' }}
              onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
              onMouseOut={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#373A36' }}>{p.nombre}</h3>
              <span style={{ fontSize: '12px', color: '#888' }}>{p.tipo === 'fijo' ? '📌 Fijo' : '⏱ Temporal'}</span>
            </div>
          ))}
          {proyectos.length === 0 && <p style={{ color: '#888', gridColumn: '1/-1' }}>No hay proyectos disponibles.</p>}
        </div>
      </div>
    )
  }

  const accionesProyecto = acciones.filter(a => a.proyecto_id === proyectoSeleccionado.id)
  const estadosProyecto = estados.filter(e => e.proyecto_id === proyectoSeleccionado.id)

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
  const COL_MES = 64 // each sub-week = 16px

  const colorProyecto = proyectoSeleccionado.color || '#00953B'

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

        {/* Cabecera años */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, padding: '12px 16px', fontWeight: '700', fontSize: '14px', borderRight: '2px solid #e5e7eb', color: '#373A36' }}>Actividad</div>
          <div style={{ display: 'flex' }}>
            {(() => {
              const años = {}
              meses.forEach(m => { const año = m.slice(0, 4); años[año] = (años[año] || 0) + 1 })
              return Object.entries(años).map(([año, count]) => (
                <div key={año} style={{ width: COL_MES * count, textAlign: 'center', padding: '4px', fontWeight: '700', fontSize: '13px', borderRight: '1px solid #e5e7eb', color: '#373A36', background: '#f9fafb' }}>
                  {año}
                </div>
              ))
            })()}
          </div>
        </div>

        {/* Cabecera meses */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 41, background: 'white', zIndex: 9 }}>
          <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, borderRight: '2px solid #e5e7eb' }}></div>
          {meses.map(mes => (
            <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, borderRight: '1px solid #f3f4f6', background: mes === mesActual ? '#f0fdf4' : undefined }}>
              {/* Nombre mes */}
              <div style={{ textAlign: 'center', padding: '4px 2px 2px', fontSize: '11px', fontWeight: '600', color: mes === mesActual ? '#00953B' : '#6b7280' }}>
                {MESES[parseInt(mes.slice(5, 7)) - 1]}
              </div>
              {/* 4 semanas */}
              <div style={{ display: 'flex', borderTop: '1px solid #f3f4f6' }}>
                {[1,2,3,4].map(s => (
                  <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: '8px', color: '#b0b7c0', padding: '1px 0', borderRight: s < 4 ? '1px solid #e2e4e8' : 'none' }}>
                    S{s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {estadosProyecto.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
            <p>No hay estados en este proyecto.</p>
          </div>
        )}

        {estadosProyecto.map(estado => {
          const accsEstado = accionesProyecto.filter(a => a.estado_id === estado.id)
          const expEstado = expandidosEstado[estado.id]
          const { inicio: iniE, fin: finE } = rangoEstado(estado.id)

          return (
            <div key={estado.id}>
              {/* Fila Estado */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f0fdf4' }}>
                <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, padding: '10px 16px', borderRight: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setExpandidosEstado(prev => ({ ...prev, [estado.id]: !prev[estado.id] }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#00953B', padding: '0 2px', width: '16px' }}>
                    {expEstado ? '▼' : '▶'}
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#00953B', flex: 1 }}>{estado.nombre}</span>
                  {accsEstado.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{accsEstado.length} acción{accsEstado.length !== 1 ? 'es' : ''}</span>
                  )}
                </div>
                {meses.map(mes => {
                  const semanas = getSemanasActivas(mes, iniE, finE)
                  return (
                    <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, borderRight: '1px solid #f3f4f6', padding: '8px 0', display: 'flex', alignItems: 'center', background: mes === mesActual ? '#f5fff8' : undefined }}>
                      <div style={{ display: 'flex', width: '100%', height: '16px', alignItems: 'center' }}>
                        {semanas.map((activa, s) => (
                          <div key={s} style={{
                            flex: 1, height: '16px',
                            background: activa ? colorProyecto : 'transparent',
                            opacity: activa ? 0.25 : 1,
                            borderRight: s < 3 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                            borderRadius: s === 0 && semanas[0] && !semanas[1] ? '4px' : s === 0 && semanas[0] ? '4px 0 0 4px' : s === 3 && semanas[3] && !semanas[2] ? '4px' : s === 3 && semanas[3] ? '0 4px 4px 0' : '0',
                          }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Acciones del estado */}
              {expEstado && accsEstado.map(accion => {
                const ensayosAccion = ensayos.filter(e => e.accion_id === accion.id)
                const expAccion = expandidosAccion[accion.id]
                const progreso = progresoAccion(accion.id)

                return (
                  <div key={accion.id}>
                    {/* Fila Acción */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', background: '#f8f9fa' }}>
                      <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, padding: '9px 16px 9px 32px', borderRight: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => setExpandidosAccion(prev => ({ ...prev, [accion.id]: !prev[accion.id] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#6b7280', padding: '0 2px', width: '16px' }}>
                          {ensayosAccion.length > 0 ? (expAccion ? '▼' : '▶') : '·'}
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#373A36', flex: 1 }}>{accion.nombre}</span>
                        <button onClick={() => { setEditando({ tipo: 'accion', item: accion }); setFormFechas({ fecha_inicio: accion.fecha_inicio || '', fecha_fin: accion.fecha_fin || '' }) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#00953B' }}>✏️</button>
                        {progreso > 0 && <span style={{ fontSize: '11px', color: '#00953B', fontWeight: '600' }}>{progreso}%</span>}
                      </div>
                      {meses.map(mes => {
                        const semanas = getSemanasActivas(mes, accion.fecha_inicio, accion.fecha_fin)
                        const hayAlgo = semanas.some(Boolean)
                        return (
                          <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, borderRight: '1px solid #f3f4f6', padding: '6px 0', display: 'flex', alignItems: 'center', background: mes === mesActual ? '#fafff9' : undefined }}>
                            <div style={{ display: 'flex', width: '100%', height: '22px', alignItems: 'center' }}>
                              {semanas.map((activa, s) => {
                                const primeraActiva = semanas.indexOf(true)
                                const ultimaActiva = semanas.lastIndexOf(true)
                                const esFirst = s === primeraActiva
                                const esLast = s === ultimaActiva
                                return (
                                  <div key={s} style={{
                                    flex: 1, height: '22px',
                                    background: activa ? colorProyecto : 'transparent',
                                    opacity: activa ? 0.85 : 1,
                                    borderRight: s < 3 ? `1px solid ${activa ? 'rgba(255,255,255,0.4)' : '#e8e8e8'}` : 'none',
                                    borderRadius: activa ? (esFirst && esLast ? '4px' : esFirst ? '4px 0 0 4px' : esLast ? '0 4px 4px 0' : '0') : '0',
                                  }} />
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Ensayos de la acción */}
                    {expAccion && ensayosAccion.map(ensayo => {
                      const progEnsayo = progresoEnsayo(ensayo.id)
                      const esEnsayo = ensayo.tipo === 'ensayo'
                      const colorEnsayo = esEnsayo ? '#3b82f6' : '#f59e0b'
                      return (
                        <div key={ensayo.id} style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, padding: '8px 16px 8px 56px', borderRight: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: esEnsayo ? '#dbeafe' : '#fef3c7', color: esEnsayo ? '#1d4ed8' : '#92400e', fontWeight: '600' }}>
                              {esEnsayo ? 'E' : 'I'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>{ensayo.nombre}</span>
                            <button onClick={() => { setEditando({ tipo: 'ensayo', item: ensayo }); setFormFechas({ fecha_inicio: ensayo.fecha_inicio || '', fecha_fin: ensayo.fecha_fin || '' }) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#00953B' }}>✏️</button>
                            {progEnsayo > 0 && <span style={{ fontSize: '10px', color: '#00953B', fontWeight: '600' }}>{progEnsayo}%</span>}
                          </div>
                          {meses.map(mes => {
                            const semanas = getSemanasActivas(mes, ensayo.fecha_inicio, ensayo.fecha_fin)
                            const hayAlgo = semanas.some(Boolean)
                            return (
                              <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, borderRight: '1px solid #f3f4f6', padding: '8px 0', display: 'flex', alignItems: 'center', background: mes === mesActual ? '#fafff9' : undefined }}>
                                <div style={{ display: 'flex', width: '100%', height: '18px', alignItems: 'center' }}>
                                  {semanas.map((activa, s) => {
                                    const primeraActiva = semanas.indexOf(true)
                                    const ultimaActiva = semanas.lastIndexOf(true)
                                    const esFirst = s === primeraActiva
                                    const esLast = s === ultimaActiva
                                    return (
                                      <div key={s} style={{
                                        flex: 1, height: '18px',
                                        background: activa ? colorEnsayo : 'transparent',
                                        opacity: activa ? 0.8 : 1,
                                        borderRight: s < 3 ? `1px solid ${activa ? 'rgba(255,255,255,0.4)' : '#e8e8e8'}` : 'none',
                                        borderRadius: activa ? (esFirst && esLast ? '4px' : esFirst ? '4px 0 0 4px' : esLast ? '0 4px 4px 0' : '0') : '0',
                                      }} />
                                    )
                                  })}
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
          )
        })}

        {/* Leyenda */}
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '12px', background: colorProyecto, borderRadius: '6px', opacity: 0.85 }}></div><span style={{ fontSize: '12px', color: '#555' }}>Acción</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '10px', background: '#3b82f6', borderRadius: '5px', opacity: 0.8 }}></div><span style={{ fontSize: '12px', color: '#555' }}>Ensayo</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '10px', background: '#f59e0b', borderRadius: '5px', opacity: 0.8 }}></div><span style={{ fontSize: '12px', color: '#555' }}>Informe</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#f0fdf4', border: '1px solid #00953B', borderRadius: '2px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Mes actual</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', fontSize: '11px', color: '#9ca3af' }}>S1–S4 = semanas del mes</div>
        </div>
      </div>

      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '8px' }}>Editar fechas</h2>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>{editando.item.nombre}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha inicio:</label>
                <input type="date" value={formFechas.fecha_inicio} onChange={e => setFormFechas({...formFechas, fecha_inicio: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha fin:</label>
                <input type="date" value={formFechas.fecha_fin} onChange={e => setFormFechas({...formFechas, fecha_fin: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }} />
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
