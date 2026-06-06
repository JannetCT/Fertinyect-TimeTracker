import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja } from '../services/googleSheets'
import { useNavigate } from 'react-router-dom'

const HORA_VENCIMIENTO_HOY = 15

function getHoy() {
  return new Date().toISOString().split('T')[0]
}

function esFechaPasada(fechaStr) {
  if (!fechaStr) return false
  return fechaStr < getHoy()
}

function esFechaHoy(fechaStr) {
  if (!fechaStr) return false
  return fechaStr === getHoy()
}

function esPróxima(fechaStr) {
  if (!fechaStr) return false
  const hoy = new Date()
  const fecha = new Date(fechaStr)
  const diff = (fecha - hoy) / (1000 * 60 * 60 * 24)
  return diff > 0 && diff <= 3
}

function horaEspañaActual() {
  const ahora = new Date()
  const hora = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: 'numeric',
    hour12: false
  }).format(ahora)
  return parseInt(hora)
}

function rutaPorHoja(hoja) {
  if (hoja === 'tareas_planner') return '/planner'
  if (hoja === 'tareas_soporte') return '/soporte'
  return '/proyectos'
}

export default function Notificaciones() {
  const { usuario, accessToken } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [alertas, setAlertas] = useState([])
  const [cargando, setCargando] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (usuario) cargarAlertas()
    const intervalo = setInterval(() => {
      if (usuario) cargarAlertas()
    }, 5 * 60 * 1000)
    return () => clearInterval(intervalo)
  }, [usuario])

  useEffect(() => {
    function handleClickFuera(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setAbierto(false)
      }
    }
    if (abierto) document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [abierto])

  async function cargarAlertas() {
    setCargando(true)
    try {
      const horaActual = horaEspañaActual()
      const esHoyVencido = horaActual >= HORA_VENCIMIENTO_HOY

      const [tareas, tareasPlanner, tareasSoporte, acciones, ensayos] = await Promise.all([
        leerHoja('tareas', accessToken),
        leerHoja('tareas_planner', accessToken),
        leerHoja('tareas_soporte', accessToken),
        leerHoja('acciones', accessToken),
        leerHoja('ensayos', accessToken),
      ])

      const nuevasAlertas = []

      const todasTareas = [
        ...tareas.map(t => ({ ...t, _hoja: 'tareas' })),
        ...tareasPlanner.map(t => ({ ...t, _hoja: 'tareas_planner' })),
        ...tareasSoporte.map(t => ({ ...t, _hoja: 'tareas_soporte' })),
      ]

      for (const tarea of todasTareas) {
        const esDeEstUsuario =
          !tarea.asignado_a ||
          tarea.asignado_a === usuario.id ||
          tarea.asignado_a === usuario.email ||
          tarea.asignado_a === usuario.nombre

        if (!esDeEstUsuario) continue
        if (tarea.estado === 'completada' || tarea.estado === 'completado') continue

        const fecha = tarea.fecha_limite

        if (esFechaPasada(fecha)) {
          nuevasAlertas.push({
            id: `${tarea._hoja}-${tarea.id}`,
            tipo: 'vencida',
            texto: `Tarea vencida: ${tarea.nombre}`,
            subtexto: `Límite: ${fecha}`,
            hoja: tarea._hoja,
            tareaId: tarea.id,
          })
        } else if (esFechaHoy(fecha) && esHoyVencido) {
          nuevasAlertas.push({
            id: `${tarea._hoja}-${tarea.id}-hoy`,
            tipo: 'vencida',
            texto: `Tarea de hoy sin completar: ${tarea.nombre}`,
            subtexto: 'Venció a las 15:00',
            hoja: tarea._hoja,
            tareaId: tarea.id,
          })
        } else if (esPróxima(fecha)) {
          nuevasAlertas.push({
            id: `${tarea._hoja}-${tarea.id}-proxima`,
            tipo: 'proxima',
            texto: `Próxima a vencer: ${tarea.nombre}`,
            subtexto: `Límite: ${fecha}`,
            hoja: tarea._hoja,
            tareaId: tarea.id,
          })
        }
      }

      for (const accion of acciones) {
        if (accion.estado === 'completada' || accion.estado === 'completado') continue
        const fecha = accion.fecha_fin

        if (esFechaPasada(fecha)) {
          nuevasAlertas.push({
            id: `acciones-${accion.id}`,
            tipo: 'vencida',
            texto: `Acción vencida: ${accion.nombre}`,
            subtexto: `Proyección fin: ${fecha}`,
            hoja: 'acciones',
            tareaId: accion.id,
          })
        } else if (esPróxima(fecha)) {
          nuevasAlertas.push({
            id: `acciones-${accion.id}-proxima`,
            tipo: 'proxima',
            texto: `Acción próxima a vencer: ${accion.nombre}`,
            subtexto: `Proyección fin: ${fecha}`,
            hoja: 'acciones',
            tareaId: accion.id,
          })
        }
      }

      for (const ensayo of ensayos) {
        if (ensayo.estado === 'completado' || ensayo.estado === 'completada') continue
        const fecha = ensayo.fecha_fin

        if (esFechaPasada(fecha)) {
          nuevasAlertas.push({
            id: `ensayos-${ensayo.id}`,
            tipo: 'vencida',
            texto: `Ensayo vencido: ${ensayo.nombre}`,
            subtexto: `Proyección fin: ${fecha}`,
            hoja: 'ensayos',
            tareaId: ensayo.id,
          })
        } else if (esPróxima(fecha)) {
          nuevasAlertas.push({
            id: `ensayos-${ensayo.id}-proxima`,
            tipo: 'proxima',
            texto: `Ensayo próximo a vencer: ${ensayo.nombre}`,
            subtexto: `Proyección fin: ${fecha}`,
            hoja: 'ensayos',
            tareaId: ensayo.id,
          })
        }
      }

      setAlertas(nuevasAlertas)
    } catch (err) {
      console.error('Error cargando notificaciones:', err)
    } finally {
      setCargando(false)
    }
  }

  function handleClickAlerta(alerta) {
    const ruta = rutaPorHoja(alerta.hoja)
    setAbierto(false)
    navigate(ruta)
  }

  const vencidas = alertas.filter(a => a.tipo === 'vencida')
  const proximas = alertas.filter(a => a.tipo === 'proxima')
  const totalUrgentes = vencidas.length

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* BOTÓN CAMPANITA */}
      <button
        onClick={() => setAbierto(!abierto)}
        title="Notificaciones"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '20px',
          position: 'relative',
          padding: '4px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🔔
        {totalUrgentes > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-4px',
            background: '#dc2626',
            color: 'white',
            borderRadius: '50%',
            fontSize: '10px',
            fontWeight: '700',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: '0 3px',
          }}>
            {totalUrgentes}
          </span>
        )}
      </button>

      {/* PANEL DE NOTIFICACIONES */}
      {abierto && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '340px',
          height: '100vh',
          background: '#111827',
          borderLeft: '1px solid #1f2937',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <h3 style={{ margin: 0, color: '#f9fafb', fontSize: '16px', fontWeight: '700' }}>
                Notificaciones
              </h3>
              <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '12px' }}>
                {alertas.length === 0 ? 'Todo al día ✓' : `${alertas.length} alertas activas`}
              </p>
            </div>
            <button
              onClick={() => setAbierto(false)}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '18px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {cargando ? (
              <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '40px' }}>Cargando...</p>
            ) : alertas.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>No hay alertas pendientes</p>
              </div>
            ) : (
              <>
                {vencidas.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      🔴 Vencidas ({vencidas.length})
                    </p>
                    {vencidas.map(alerta => (
                      <TarjetaAlerta key={alerta.id} alerta={alerta} onClick={() => handleClickAlerta(alerta)} />
                    ))}
                  </div>
                )}
                {proximas.length > 0 && (
                  <div>
                    <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      🟡 Próximas a vencer ({proximas.length})
                    </p>
                    {proximas.map(alerta => (
                      <TarjetaAlerta key={alerta.id} alerta={alerta} onClick={() => handleClickAlerta(alerta)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ padding: '12px', borderTop: '1px solid #1f2937' }}>
            <button
              onClick={cargarAlertas}
              style={{
                width: '100%',
                padding: '8px',
                background: '#1f2937',
                color: '#9ca3af',
                border: '1px solid #374151',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              🔄 Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaAlerta({ alerta, onClick }) {
  const colorBorde = alerta.tipo === 'vencida' ? '#dc2626' : '#f59e0b'
  const colorFondo = alerta.tipo === 'vencida' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)'

  return (
    <div
      onClick={onClick}
      style={{
        background: colorFondo,
        border: `1px solid ${colorBorde}`,
        borderRadius: '8px',
        padding: '10px 12px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
      onMouseOver={e => e.currentTarget.style.opacity = '0.75'}
      onMouseOut={e => e.currentTarget.style.opacity = '1'}
    >
      <p style={{ margin: 0, color: '#f9fafb', fontSize: '13px', fontWeight: '600', lineHeight: '1.4' }}>
        {alerta.texto}
      </p>
      <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: '11px' }}>
        {alerta.subtexto} · <span style={{ color: '#60a5fa' }}>Ir →</span>
      </p>
    </div>
  )
}