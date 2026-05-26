const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

export async function leerHoja(nombreHoja, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}?key=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
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
}

export async function actualizarFila(nombreHoja, id, valoresNuevos, accessToken) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}?key=${API_KEY}`)
  const data = await res.json()
  const filas = data.values || []
  const idx = filas.findIndex(f => f[0] === id)
  if (idx === -1) return
  const filaNum = idx + 1
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}!A${filaNum}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [valoresNuevos] })
  })
}

export async function marcarEliminado(nombreHoja, id, accessToken) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}?key=${API_KEY}`)
  const data = await res.json()
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
}

export async function buscarFilaPorId(nombreHoja, id, accessToken) {
  const filas = await leerHoja(nombreHoja, accessToken)
  return filas.find(f => f.id === String(id))
}
