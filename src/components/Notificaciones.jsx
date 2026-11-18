import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDatos } from '../contexts/DatosContext'
import { leerHoja } from '../services/googleSheets'
import { useNavigate } from 'react-router-dom'


export default function Notificaciones() {
  const { usuario, accessToken } = useAuth()
  const { refrescar } = useDatos()
  const [abierto, setAbierto] = useState(false)
  const [tareasNuevas, setTareasNuevas] = useState([])
  const [descartadas, setDescartadas] = useState(new Set())

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
    try {
      const [tareas, tareasPlanner, tareasSoporte] = await Promise.all([
        leerHoja('tareas', accessToken),
        leerHoja('tareas_planner', accessToken),
        leerHoja('tareas_soporte', accessToken),
      ])
      const tareasDireccion = await leerHoja('tareas_direccion', accessToken)

      const hace7dias = new Date()
      hace7dias.setDate(hace7dias.getDate() - 7)
      const hace7diasStr = hace7dias.toISOString().split('T')[0]
      const misId = String(usuario.id)
      const nuevas = []
      const todasParaNuevas = [...tareas, ...tareasSoporte, ...tareasDireccion, ...tareasPlanner]
      for (const t of todasParaNuevas) {
        if (t.estado === 'completada' || t.estado === 'completado') continue
        const esPlanner = !t.asignados && t.usuario_id
        const esAsignado = esPlanner
          ? String(t.usuario_id) === misId
          : (t.asignados ? t.asignados.split(',').map(s => s.trim()).includes(misId) : false)
        if (!esAsignado) continue
        if (!t.creado_por || String(t.creado_por) === misId) continue
        const fechaCreacion = (t.fecha_creacion || '').split('T')[0]
        if (fechaCreacion >= hace7diasStr) {
          nuevas.push({ id: t.id, nombre: t.nombre, creadoPor: t.creado_por, fecha: fechaCreacion })
        }
      }
      setTareasNuevas(nuevas)
    } catch (err) {
      console.error('Error cargando notificaciones:', err)
    }
  }

  function descartar(id) {
    setDescartadas(prev => new Set([...prev, id]))
  }

  const nuevasVisibles = tareasNuevas.filter(t => !descartadas.has(t.id))

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'flex', gap: '4px', alignItems: 'center' }}>
      <button onClick={() => setAbierto(!abierto)} title="Tareas nuevas asignadas"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', position: 'relative', padding: '4px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        📬
        {nuevasVisibles.length > 0 && (
          <span style={{ position: 'absolute', top: '-2px', right: '-4px', background: '#7c3aed', color: 'white', borderRadius: '50%', fontSize: '10px', fontWeight: '700', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: '0 3px' }}>
            {nuevasVisibles.length}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '340px', height: '100vh',
          background: '#111827', borderLeft: '1px solid #1f2937', zIndex: 1000,
          display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1f2937' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: '#f9fafb', fontSize: '16px', fontWeight: '700' }}>📬 Tareas nuevas</h3>
              <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {tareasNuevas.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📬</div>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>No hay tareas nuevas esta semana</p>
              </div>
            ) : (
              <div>
                <p style={{ color: '#9ca3af', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Últimos 7 días</p>
                {nuevasVisibles.map(t => {
                  const nombres = { '1': 'Lorenzo', '2': 'Ahlam', '3': 'Jannet' }
                  const colores = { '1': '#00953B', '2': '#3b82f6', '3': '#f59e0b' }
                  const color = colores[String(t.creadoPor)] || '#6b7280'
                  const nombre = nombres[String(t.creadoPor)] || `Usuario ${t.creadoPor}`
                  return (
                    <div key={t.id} style={{ position: 'relative', background: 'rgba(124,58,237,0.08)', border: '1px solid #7c3aed', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                      <button onClick={() => descartar(t.id)} style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '14px', lineHeight: 1, padding: '2px' }}>✕</button>
                      <p style={{ margin: 0, color: '#f9fafb', fontSize: '13px', fontWeight: '600', paddingRight: '16px' }}>{t.nombre}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white', fontWeight: '700', flexShrink: 0 }}>{nombre[0]}</span>
                        <p style={{ margin: 0, color: '#9ca3af', fontSize: '11px' }}>Asignada por <span style={{ color }}>{nombre}</span> · {t.fecha}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

