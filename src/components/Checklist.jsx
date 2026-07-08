import { useState, useEffect } from 'react'
import { leerHoja, escribirFila, actualizarFila, marcarEliminado } from '../services/googleSheets'

export default function Checklist({ tareaId, tipoTarea, accessToken }) {
  const [items, setItems] = useState([])
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [textoEdit, setTextoEdit] = useState('')

  useEffect(() => { if (tareaId) cargarItems() }, [tareaId])

  async function cargarItems() {
    try {
      const todos = await leerHoja('checklist_items', accessToken)
      const filtrados = todos
        .filter(i => i.tarea_id === tareaId && i.tipo_tarea === tipoTarea)
        .sort((a, b) => Number(a.orden) - Number(b.orden))
      setItems(filtrados)
    } catch (err) { console.error(err) }
  }

  async function añadirItem() {
    if (!nuevoTexto.trim()) return
    setCargando(true)
    const id = Date.now().toString()
    const orden = items.length + 1
    await escribirFila('checklist_items', [id, tareaId, tipoTarea, nuevoTexto.trim(), 'false', orden], accessToken)
    setNuevoTexto('')
    await cargarItems()
    setCargando(false)
  }

  async function toggleItem(item) {
    const nuevoEstado = item.completado === 'true' ? 'false' : 'true'
    await actualizarFila('checklist_items', item.id, [item.id, item.tarea_id, item.tipo_tarea, item.texto, nuevoEstado, item.orden], accessToken)
    await cargarItems()
  }

  async function guardarEdicion(item) {
    if (!textoEdit.trim()) return
    await actualizarFila('checklist_items', item.id, [item.id, item.tarea_id, item.tipo_tarea, textoEdit.trim(), item.completado, item.orden], accessToken)
    setEditandoId(null)
    await cargarItems()
  }

  async function eliminarItem(itemId) {
    await marcarEliminado('checklist_items', itemId, accessToken)
    await cargarItems()
  }

  const completados = items.filter(i => i.completado === 'true').length
  const total = items.length

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>Lista de comprobación</label>
        {total > 0 && (
          <span style={{ fontSize: '12px', color: completados === total ? '#166534' : '#6b7280', background: completados === total ? '#dcfce7' : '#f3f4f6', borderRadius: '20px', padding: '2px 8px', fontWeight: '600' }}>
            {completados} / {total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div style={{ marginBottom: '8px', height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completados / total) * 100}%`, background: '#00953B', borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', background: item.completado === 'true' ? '#f0fdf4' : '#f9fafb', border: `1px solid ${item.completado === 'true' ? '#bbf7d0' : '#f3f4f6'}` }}>
            <button onClick={() => toggleItem(item)}
              style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${item.completado === 'true' ? '#00953B' : '#d1d5db'}`, background: item.completado === 'true' ? '#00953B' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
              {item.completado === 'true' && <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>✓</span>}
            </button>
            {editandoId === item.id ? (
              <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                <input value={textoEdit} onChange={e => setTextoEdit(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(item); if (e.key === 'Escape') setEditandoId(null) }}
                  autoFocus
                  style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1px solid #00953B', fontSize: '13px' }} />
                <button onClick={() => guardarEdicion(item)} style={{ background: '#00953B', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                <button onClick={() => setEditandoId(null)} style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: '13px', color: item.completado === 'true' ? '#6b7280' : '#373A36', textDecoration: item.completado === 'true' ? 'line-through' : 'none' }}>
                  {item.texto}
                </span>
                <button onClick={() => { setEditandoId(item.id); setTextoEdit(item.texto) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '13px', padding: '0 2px', lineHeight: 1 }}
                  onMouseOver={e => e.target.style.color = '#6b7280'}
                  onMouseOut={e => e.target.style.color = '#d1d5db'}>
                  ✏️
                </button>
                <button onClick={() => eliminarItem(item.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
                  onMouseOver={e => e.target.style.color = '#dc2626'}
                  onMouseOut={e => e.target.style.color = '#d1d5db'}>
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <input placeholder="+ Añadir ítem..." value={nuevoTexto} onChange={e => setNuevoTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && nuevoTexto.trim()) añadirItem() }}
          style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }} />
        <button onClick={añadirItem} disabled={cargando || !nuevoTexto.trim()}
          style={{ padding: '8px 14px', borderRadius: '8px', background: nuevoTexto.trim() ? '#00953B' : '#f3f4f6', color: nuevoTexto.trim() ? 'white' : '#9ca3af', border: 'none', cursor: nuevoTexto.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: '600' }}>
          {cargando ? '...' : '+ Añadir'}
        </button>
      </div>
    </div>
  )
}
