import { createContext, useContext, useRef, useCallback, useState } from 'react'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado } from '../services/googleSheets'
import { useAuth } from './AuthContext'

const DatosContext = createContext(null)
const TTL_MS = 60 * 1000

export function DatosProvider({ children }) {
  const { accessToken } = useAuth()
  // _store no es estado de React: es una "fuente de verdad" en una ref para
  // poder leerla/escribirla de forma síncrona sin esperar a un re-render.
  const _store = useRef({}) // { nombreHoja: { datos: [...], timestamp: 0, promesaEnCurso: null } }
  // _version solo sirve para forzar el re-render de los componentes suscritos
  // cuando cambian datos que ya tenían en pantalla (optimistic update, refresco).
  const [, forzarRender] = useState(0)
  const notificar = useCallback(() => forzarRender(v => v + 1), [])

  function entrada(nombreHoja) {
    if (!_store.current[nombreHoja]) {
      _store.current[nombreHoja] = { datos: [], timestamp: 0, promesaEnCurso: null }
    }
    return _store.current[nombreHoja]
  }

  /**
   * Devuelve los datos de una hoja. Si están frescos (< 60s), los da directo
   * de memoria sin red. Si no, los pide, los cachea, y los devuelve.
   * Si ya hay una petición en curso para esa hoja, todos los que la pidan
   * a la vez esperan la misma promesa (no se duplica la llamada).
   */
  const obtenerHoja = useCallback(async (nombreHoja, { forzar = false } = {}) => {
    const e = entrada(nombreHoja)
    const fresco = (Date.now() - e.timestamp) < TTL_MS
    if (fresco && !forzar) return e.datos
    if (e.promesaEnCurso) return e.promesaEnCurso

    e.promesaEnCurso = leerHoja(nombreHoja, accessToken)
      .then(datos => {
        e.datos = datos
        e.timestamp = Date.now()
        e.promesaEnCurso = null
        notificar()
        return datos
      })
      .catch(err => {
        e.promesaEnCurso = null
        console.error(`Error cargando ${nombreHoja}:`, err)
        return e.datos // si falla, devolvemos lo último que teníamos en vez de romper
      })
    return e.promesaEnCurso
  }, [accessToken, notificar])

  /** Lectura síncrona de lo que ya hay en memoria, sin disparar red. Útil en render. */
  const datosEnMemoria = useCallback((nombreHoja) => entrada(nombreHoja).datos, [])

  /** Fuerza recarga real desde el Sheet ignorando el TTL (ej. pull-to-refresh manual). */
  const refrescar = useCallback((nombreHoja) => obtenerHoja(nombreHoja, { forzar: true }), [obtenerHoja])

  /**
   * Crea una fila: la añade al store en memoria al instante (optimistic),
   * y en paralelo la escribe de verdad en el Sheet. Si falla, revierte.
   * - filaArray: array de valores en el orden exacto de columnas del Sheet (para escribirFila)
   * - objetoOptimista: el mismo dato pero como objeto {columna: valor}, igual a lo que devuelve leerHoja
   */
  const crear = useCallback(async (nombreHoja, filaArray, objetoOptimista) => {
    const e = entrada(nombreHoja)
    const datosAntes = e.datos
    e.datos = [...e.datos, objetoOptimista]
    notificar()
    try {
      await escribirFila(nombreHoja, filaArray, accessToken)
      // tras escribir con éxito, refrescamos esa hoja de fondo para tener IDs/orden reales
      obtenerHoja(nombreHoja, { forzar: true })
    } catch (err) {
      e.datos = datosAntes // revertir
      notificar()
      throw err
    }
  }, [accessToken, notificar, obtenerHoja])

  /** Igual que crear, pero para editar una fila existente por id. */
  const actualizar = useCallback(async (nombreHoja, id, filaArray, objetoOptimista) => {
    const e = entrada(nombreHoja)
    const datosAntes = e.datos
    e.datos = e.datos.map(d => d.id === id ? objetoOptimista : d)
    notificar()
    try {
      await actualizarFila(nombreHoja, id, filaArray, accessToken)
    } catch (err) {
      e.datos = datosAntes
      notificar()
      throw err
    }
  }, [accessToken, notificar])

  /** Igual que crear, pero para marcar una fila como eliminada por id. */
  const eliminar = useCallback(async (nombreHoja, id) => {
    const e = entrada(nombreHoja)
    const datosAntes = e.datos
    e.datos = e.datos.filter(d => d.id !== id)
    notificar()
    try {
      await marcarEliminado(nombreHoja, id, accessToken)
    } catch (err) {
      e.datos = datosAntes
      notificar()
      throw err
    }
  }, [accessToken, notificar])

  const value = { obtenerHoja, datosEnMemoria, refrescar, crear, actualizar, eliminar }
  return <DatosContext.Provider value={value}>{children}</DatosContext.Provider>
}

export function useDatos() {
  const ctx = useContext(DatosContext)
  if (!ctx) throw new Error('useDatos debe usarse dentro de <DatosProvider>')
  return ctx
}