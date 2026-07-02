import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { useAuth } from '../hooks/useAuth'
import { actualizarFila } from '../services/googleSheets'
import { useDatos } from '../contexts/DatosContext'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_COMPLETOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 149, 59]
}

function Gantt() {
  const { accessToken } = useAuth()
  const { obtenerHoja } = useDatos()
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
        obtenerHoja('proyectos'),
        obtenerHoja('acciones'),
        obtenerHoja('ensayos'),
        obtenerHoja('tareas')
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

  function calcularRangoFechas(accionesProyecto) {
    const fechasValidas = [
      ...accionesProyecto.filter(a => a.fecha_inicio).map(a => a.fecha_inicio),
      ...accionesProyecto.filter(a => a.fecha_fin).map(a => a.fecha_fin),
      ...ensayos.filter(e => e.proyecto_id === proyectoSeleccionado.id && e.fecha_inicio).map(e => e.fecha_inicio),
      ...ensayos.filter(e => e.proyecto_id === proyectoSeleccionado.id && e.fecha_fin).map(e => e.fecha_fin),
    ].sort()
    const inicio = fechasValidas[0] ? fechasValidas[0].slice(0, 7) : getMesActual()
    const fin = fechasValidas[fechasValidas.length - 1] ? fechasValidas[fechasValidas.length - 1].slice(0, 7) : `${new Date().getFullYear() + 1}-12`
    return { inicio, fin, meses: getMeses(inicio, fin) }
  }

  function exportarPDF() {
    if (!proyectoSeleccionado) return
    const accionesProyecto = acciones.filter(a => a.proyecto_id === proyectoSeleccionado.id)
    const { meses } = calcularRangoFechas(accionesProyecto)
    const colorProyecto = hexToRgb(proyectoSeleccionado.color || '#00953B')

    // Calcular dimensiones dinámicas
    const COL_NOMBRE_PDF = 70  // mm
    const totalMeses = meses.length
    // Ajustar ancho de mes según cantidad: mínimo 5mm, máximo 12mm
    const COL_MES_PDF = Math.max(5, Math.min(12, Math.floor((297 - 14 - 14 - COL_NOMBRE_PDF) / totalMeses)))
    const anchoTotal = COL_NOMBRE_PDF + (COL_MES_PDF * totalMeses) + 28
    // Usar formato A4 landscape o ampliar si hace falta
    const formato = anchoTotal > 297 ? [anchoTotal, 210] : 'a4'

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: formato })
    const pageW = doc.internal.pageSize.getWidth()

    // CABECERA
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

    // CABECERA AÑOS
    const años = {}
    meses.forEach(m => {
      const año = m.slice(0, 4)
      años[año] = (años[año] || 0) + 1
    })
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

    // CABECERA MESES
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

    // SEPARADOR COLUMNA NOMBRE
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.5)

    // FILAS
    const FILA_H = 7
    const FILA_SUB_H = 6

    accionesProyecto.forEach(accion => {
      const progreso = progresoAccion(accion.id)
      const inicioMes = getYearMonth(accion.fecha_inicio)
      const finMes = getYearMonth(accion.fecha_fin)

      // Fila acción
      doc.setFillColor(248, 249, 250)
      doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_H, 'F')
      doc.setDrawColor(243, 244, 246)
      doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_H, 'S')

      // Nombre acción
      doc.setFontSize(7)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(55, 58, 54)
      const nombreCorto = accion.nombre.length > 28 ? accion.nombre.slice(0, 26) + '…' : accion.nombre
      doc.text(nombreCorto, 16, y + FILA_H / 2 + 1.5)

      // Progreso texto
      if (progreso > 0) {
        doc.setFontSize(6)
        doc.setTextColor(0, 149, 59)
        doc.text(`${progreso}%`, 14 + COL_NOMBRE_PDF - 8, y + FILA_H / 2 + 1.5)
      }

      // Barras acción
      meses.forEach((mes, i) => {
        const enRango = inicioMes && finMes && mes >= inicioMes && mes <= finMes
        if (enRango) {
          const x = 14 + COL_NOMBRE_PDF + i * COL_MES_PDF
          const esInicio = mes === inicioMes
          const esFin = mes === finMes
          const barH = 4
          const barY = y + (FILA_H - barH) / 2

          doc.setFillColor(...colorProyecto)
          if (esInicio && esFin) {
            doc.roundedRect(x + 1, barY, COL_MES_PDF - 2, barH, 1, 1, 'F')
          } else if (esInicio) {
            doc.roundedRect(x + 1, barY, COL_MES_PDF - 1, barH, 1, 1, 'F')
          } else if (esFin) {
            doc.roundedRect(x, barY, COL_MES_PDF - 1, barH, 1, 1, 'F')
          } else {
            doc.rect(x, barY, COL_MES_PDF, barH, 'F')
          }

          // Progreso overlay
          if (progreso > 0 && esInicio) {
            doc.setFillColor(0, 0, 0)
            doc.setGState(doc.GState({ opacity: 0.15 }))
            const pw = (COL_MES_PDF - 2) * progreso / 100
            doc.rect(x + 1, barY, pw, barH, 'F')
            doc.setGState(doc.GState({ opacity: 1 }))
          }
        }
      })

      y += FILA_H

      // Ensayos de esta acción
      const ensayosAccion = ensayos.filter(e => e.accion_id === accion.id)
      ensayosAccion.forEach(ensayo => {
        const progEnsayo = progresoEnsayo(ensayo.id)
        const inicioE = getYearMonth(ensayo.fecha_inicio)
        const finE = getYearMonth(ensayo.fecha_fin)
        const esEnsayo = ensayo.tipo === 'ensayo'

        doc.setFillColor(255, 255, 255)
        doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_SUB_H, 'F')
        doc.setDrawColor(243, 244, 246)
        doc.rect(14, y, COL_NOMBRE_PDF + COL_MES_PDF * totalMeses, FILA_SUB_H, 'S')

        // Badge tipo
        doc.setFillColor(esEnsayo ? 219 : 254, esEnsayo ? 234 : 243, esEnsayo ? 254 : 199)
        doc.roundedRect(18, y + 1.5, 5, 3, 0.5, 0.5, 'F')
        doc.setFontSize(5)
        doc.setFont(undefined, 'bold')
        doc.setTextColor(esEnsayo ? 29 : 146, esEnsayo ? 78 : 64, esEnsayo ? 216 : 14)
        doc.text(esEnsayo ? 'E' : 'I', 20.5, y + 3.8, { align: 'center' })

        // Nombre ensayo
        doc.setFontSize(6.5)
        doc.setFont(undefined, 'normal')
        doc.setTextColor(85, 85, 85)
        const nombreE = ensayo.nombre.length > 26 ? ensayo.nombre.slice(0, 24) + '…' : ensayo.nombre
        doc.text(nombreE, 25, y + FILA_SUB_H / 2 + 1.2)

        if (progEnsayo > 0) {
          doc.setFontSize(5.5)
          doc.setTextColor(0, 149, 59)
          doc.text(`${progEnsayo}%`, 14 + COL_NOMBRE_PDF - 8, y + FILA_SUB_H / 2 + 1.2)
        }

        // Barras ensayo
        meses.forEach((mes, i) => {
          const enRango = inicioE && finE && mes >= inicioE && mes <= finE
          if (enRango) {
            const x = 14 + COL_NOMBRE_PDF + i * COL_MES_PDF
            const esInicioE = mes === inicioE
            const esFinE = mes === finE
            const barH = 3
            const barY = y + (FILA_SUB_H - barH) / 2

            doc.setFillColor(esEnsayo ? 59 : 245, esEnsayo ? 130 : 158, esEnsayo ? 246 : 11)
            if (esInicioE && esFinE) {
              doc.roundedRect(x + 1, barY, COL_MES_PDF - 2, barH, 0.8, 0.8, 'F')
            } else if (esInicioE) {
              doc.roundedRect(x + 1, barY, COL_MES_PDF - 1, barH, 0.8, 0.8, 'F')
            } else if (esFinE) {
              doc.roundedRect(x, barY, COL_MES_PDF - 1, barH, 0.8, 0.8, 'F')
            } else {
              doc.rect(x, barY, COL_MES_PDF, barH, 'F')
            }
          }
        })

        y += FILA_SUB_H
      })
    })

    // LEYENDA
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
    const { meses } = calcularRangoFechas(accionesProyecto)
    const colorHex = (proyectoSeleccionado.color || '#00953B').replace('#', '')
    const wb = XLSX.utils.book_new()

    // HOJA 1 — Tabla de datos
    const datosTabla = [['Actividad', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Progreso']]
    accionesProyecto.forEach(accion => {
      datosTabla.push([accion.nombre, 'Acción', accion.fecha_inicio || '', accion.fecha_fin || '', progresoAccion(accion.id) + '%'])
      ensayos.filter(e => e.accion_id === accion.id).forEach(ensayo => {
        datosTabla.push(['    ' + ensayo.nombre, ensayo.tipo === 'ensayo' ? 'Ensayo' : 'Informe', ensayo.fecha_inicio || '', ensayo.fecha_fin || '', progresoEnsayo(ensayo.id) + '%'])
      })
    })
    const wsTabla = XLSX.utils.aoa_to_sheet(datosTabla)
    wsTabla['!cols'] = [{ wch: 45 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsTabla, 'Datos')

    // HOJA 2 — Diagrama visual con celdas coloreadas
    const mesActual = getMesActual()
    const cabecera1 = ['Actividad', 'Tipo', 'Progreso']
    // Agrupar años para cabecera
    const años = {}
    meses.forEach(m => { const a = m.slice(0, 4); años[a] = (años[a] || 0) + 1 })
    meses.forEach(m => cabecera1.push(MESES[parseInt(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4)))
    const filaDiagrama = [cabecera1]

    accionesProyecto.forEach(accion => {
      const progreso = progresoAccion(accion.id)
      const inicioMes = getYearMonth(accion.fecha_inicio)
      const finMes = getYearMonth(accion.fecha_fin)
      const filaAccion = [accion.nombre, 'Acción', progreso + '%']
      meses.forEach(mes => {
        const enRango = inicioMes && finMes && mes >= inicioMes && mes <= finMes
        filaAccion.push(enRango ? '█' : '')
      })
      filaDiagrama.push(filaAccion)

      ensayos.filter(e => e.accion_id === accion.id).forEach(ensayo => {
        const progEnsayo = progresoEnsayo(ensayo.id)
        const inicioE = getYearMonth(ensayo.fecha_inicio)
        const finE = getYearMonth(ensayo.fecha_fin)
        const filaEnsayo = ['    ' + ensayo.nombre, ensayo.tipo === 'ensayo' ? 'Ensayo' : 'Informe', progEnsayo + '%']
        meses.forEach(mes => {
          const enRango = inicioE && finE && mes >= inicioE && mes <= finE
          filaEnsayo.push(enRango ? '█' : '')
        })
        filaDiagrama.push(filaEnsayo)
      })
    })

    const wsDiagrama = XLSX.utils.aoa_to_sheet(filaDiagrama)
    wsDiagrama['!cols'] = [
      { wch: 40 }, { wch: 10 }, { wch: 10 },
      ...meses.map(() => ({ wch: 4 }))
    ]
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
            <div key={p.id} onClick={() => setProyectoSeleccionado(p)} style={{ background: 'white', borderRadius: '12px', padding: '24px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${p.color || '#00953B'}`, transition: 'box-shadow 0.2s' }}
              onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
              onMouseOut={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: '#373A36' }}>{p.nombre}</h3>
              <span style={{ fontSize: '12px', color: '#888' }}>{p.tipo === 'fijo' ? '📌 Fijo' : '⏱ Temporal'}</span>
            </div>
          ))}
          {proyectos.length === 0 && (
            <p style={{ color: '#888', gridColumn: '1/-1' }}>No hay proyectos disponibles.</p>
          )}
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

        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 41, background: 'white', zIndex: 9 }}>
          <div style={{ width: COL_NOMBRE, minWidth: COL_NOMBRE, borderRight: '2px solid #e5e7eb' }}></div>
          {meses.map(mes => (
            <div key={mes} style={{ width: COL_MES, minWidth: COL_MES, textAlign: 'center', padding: '4px 2px', fontSize: '11px', fontWeight: '600', color: mes === mesActual ? '#00953B' : '#6b7280', background: mes === mesActual ? '#f0fdf4' : undefined, borderRight: '1px solid #f3f4f6' }}>
              {MESES[parseInt(mes.slice(5, 7)) - 1]}
            </div>
          ))}
        </div>

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

        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '12px', background: proyectoSeleccionado.color || '#00953B', borderRadius: '6px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Acción</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '10px', background: '#3b82f6', borderRadius: '5px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Ensayo</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '24px', height: '10px', background: '#f59e0b', borderRadius: '5px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Informe</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: '#f0fdf4', border: '1px solid #00953B', borderRadius: '2px' }}></div><span style={{ fontSize: '12px', color: '#555' }}>Mes actual</span></div>
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
