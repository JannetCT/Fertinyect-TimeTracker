const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID

export async function leerHoja(nombreHoja, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const data = await res.json()
  const filas = data.values || []
  if (filas.length === 0) return []
  const cabeceras = filas[0]
  return filas.slice(1).map(fila => {
    const obj = {}
    cabeceras.forEach((cab, i) => { obj[cab] = fila[i] || '' })
    return obj
  })
}

export async function escribirFila(nombreHoja, fila, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${nombreHoja}:append?valueInputOption=RAW`
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [fila] })
  })
}

export async function actualizarFila(nombreHoja, fila, rango, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${rango}?valueInputOption=RAW`
  await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [fila] })
  })
}

export async function buscarFilaPorId(nombreHoja, id, accessToken) {
  const filas = await leerHoja(nombreHoja, accessToken)
  return filas.find(f => f.id === String(id))
}