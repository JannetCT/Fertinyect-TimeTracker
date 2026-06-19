const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

const _cache = new Map()
const CACHE_MS = 8000

async function fetchConCache(url) {
  const ahora = Date.now()
  const entrada = _cache.get(url)
  if (entrada && (ahora - entrada.tiempo) < CACHE_MS) {
    return entrada.promesa
  }
  const promesa = fetch(url).then(r => r.json())
  _cache.set(url, { tiempo: ahora, promesa })
  return promesa
}

function invalidarCache(nombreHoja) {
  for (const key of _cache.keys()) {
    if (key.includes(`/values/${nombreHoja}`)) _cache.delete(key)
  }
}

export async function leerHoja(nombreHoja, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}?key=${API_KEY}`
  const data = await fetchConCache(url)
  const filas = data.values || []
  if (filas.length === 0) return []
  const cabeceras = filas[0].map(c => c.toLowerCase())
  return filas.slice(1).map(fila => {
    const obj = {}
    cabeceras.forEach((cab, i) => { obj[cab.trim()] = (fila[i] || '').trim() })
    return obj
  }).filter(obj => obj.id && obj.id !== 'eliminado')
}

export async function escribirFila(nombreHoja, fila, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}:append?valueInputOption=RAW`
  await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [fila] })
  })
  invalidarCache(nombreHoja)
}

export async function actualizarFila(nombreHoja, id, valoresNuevos, accessToken) {
  const data = await fetchConCache(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}?key=${API_KEY}`)
  const filas = data.values || []
  const idx = filas.findIndex(f => f[0] === id)
  if (idx === -1) return
  const filaNum = idx + 1
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}!A${filaNum}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [valoresNuevos] })
  })
  invalidarCache(nombreHoja)
}

export async function marcarEliminado(nombreHoja, id, accessToken) {
  const data = await fetchConCache(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}?key=${API_KEY}`)
  const filas = data.values || []
  const idx = filas.findIndex(f => f[0] === id)
  if (idx === -1) return
  const filaNum = idx + 1
  const filaActual = [...filas[idx]]
  filaActual[0] = 'eliminado'
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}!A${filaNum}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [filaActual] })
  })
  invalidarCache(nombreHoja)
}

export async function buscarFilaPorId(nombreHoja, id, accessToken) {
  const filas = await leerHoja(nombreHoja, accessToken)
  return filas.find(f => f.id === String(id))
}

export async function eliminarTareasPlanner(tareaOrigenId, accessToken) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/tareas_planner?key=${API_KEY}`)
  const data = await res.json()
  const filas = data.values || []
  for (let i = 1; i < filas.length; i++) {
    if (filas[i][2] === tareaOrigenId) {
      const filaActual = [...filas[i]]
      filaActual[0] = 'eliminado'
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/tareas_planner!A${i + 1}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [filaActual] })
      })
    }
  }
}