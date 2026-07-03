// Funciones auxiliares compartidas para gestión de fechas personales en tareas_planner
import { leerHoja, escribirFila, actualizarFila } from './googleSheets'

/**
 * Guarda la fecha personal de un usuario para una tarea origen (proyecto/soporte/direccion)
 * en su propia fila de tareas_planner, sin tocar la tarea origen compartida.
 */
export async function guardarFechaPersonalEnPlanner(tareaId, tipoTarea, fechaExacta, usuario, accessToken, nombre = '') {
  const todasPlanner = await leerHoja('tareas_planner', accessToken)
  const filaExistente = todasPlanner.find(
    tp => tp.tarea_padre_id === tareaId && String(tp.usuario_id) === String(usuario.id)
  )
  const diaCalculado = fechaExacta
    ? (['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][new Date(fechaExacta.split(',')[0] + 'T12:00:00').getDay()])
    : 'por_asignar'

  if (filaExistente) {
    await actualizarFila('tareas_planner', filaExistente.id, [
      filaExistente.id, filaExistente.usuario_id, tareaId, tipoTarea,
      filaExistente.nombre || nombre, diaCalculado, filaExistente.fecha_limite || '',
      fechaExacta, filaExistente.estado || 'pendiente', filaExistente.fecha_creacion,
      filaExistente.etiqueta || '', filaExistente.fecha_limite || '', filaExistente.descripcion || '',
      filaExistente.tarea_grupo_id || '', filaExistente.tiempo_estimado || '',
      filaExistente.hora_inicio || '', String(usuario.id)
    ], accessToken)
  } else {
    await escribirFila('tareas_planner', [
      Date.now().toString() + String(usuario.id), String(usuario.id), tareaId, tipoTarea,
      nombre, diaCalculado, '',
      fechaExacta, 'pendiente', new Date().toISOString(),
      '', '', '', '', '', '', String(usuario.id)
    ], accessToken)
  }
}

/**
 * Obtiene la fecha personal de un usuario para una tarea origen desde tareas_planner.
 */
export function obtenerFechaPersonal(tareaId, usuarioId, tareasPlanner) {
  const fila = tareasPlanner.find(
    tp => tp.tarea_padre_id === tareaId && String(tp.usuario_id) === String(usuarioId)
  )
  return fila?.fecha_exacta || ''
}
