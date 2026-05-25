import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { leerHoja, escribirFila, actualizarFila } from '../services/googleSheets'

function Configuracion() {
  const { usuario, accessToken } = useAuth()
  const [etiquetas, setEtiquetas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ nombre: '', color: '#6B7280' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    async function cargarEtiquetas() {
      try {
        const data = await leerHoja('etiquetas', accessToken)
        setEtiquetas(data)
      } catch (error) {
        console.error('Error cargando etiquetas:', error)
      } finally {
        setCargando(false)
      }
    }
    if (accessToken) cargarEtiquetas()
  }, [accessToken])

  async function agregarEtiqueta() {
    if (!nuevaEtiqueta.nombre.trim()) return
    setGuardando(true)
    try {
      const id = Date.now().toString()
      const fila = [id, nuevaEtiqueta.nombre, nuevaEtiqueta.color, 'TRUE', usuario.id, new Date().toISOString()]
      await escribirFila('etiquetas', fila, accessToken)
      setEtiquetas([...etiquetas, {
        id, nombre: nuevaEtiqueta.nombre, color: nuevaEtiqueta.color,
        activa: 'TRUE', creada_por: usuario.id, fecha_creacion: new Date().toISOString()
      }])
      setNuevaEtiqueta({ nombre: '', color: '#6B7280' })
    } catch (error) {
      console.error('Error agregando etiqueta:', error)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="loading-screen"><div className="loading-spinner"></div><p>Cargando configuración...</p></div>

  return (
    <div className="configuracion-container">
      <div className="configuracion-header">
        <h1>⚙️ Configuración</h1>
        <p>Gestión de etiquetas del equipo</p>
      </div>

      <div className="config-card">
        <h3>Etiquetas</h3>
        <p className="config-desc">Las etiquetas ayudan a categorizar las tareas del equipo.</p>

        <div className="etiquetas-lista">
          {etiquetas.filter(e => e.activa === 'TRUE').map(e => (
            <div key={e.id} className="etiqueta-fila">
              <span className="etiqueta-preview" style={{ backgroundColor: e.color }}>{e.nombre}</span>
              <span className="etiqueta-color-code">{e.color}</span>
            </div>
          ))}
        </div>

        <div className="nueva-etiqueta-form">
          <h4>Nueva etiqueta</h4>
          <div className="form-row">
            <input
              type="text"
              placeholder="Nombre de la etiqueta"
              value={nuevaEtiqueta.nombre}
              onChange={e => setNuevaEtiqueta({ ...nuevaEtiqueta, nombre: e.target.value })}
              className="input-text"
            />
            <input
              type="color"
              value={nuevaEtiqueta.color}
              onChange={e => setNuevaEtiqueta({ ...nuevaEtiqueta, color: e.target.value })}
              className="input-color"
            />
            <button
              onClick={agregarEtiqueta}
              disabled={guardando || !nuevaEtiqueta.nombre.trim()}
              className="btn-primary"
            >
              {guardando ? 'Guardando...' : '+ Agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Configuracion