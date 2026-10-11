/** Danh sách vật tư sử dụng (chọn vật tư + số lượng) – dùng khi hoàn thành lệnh bảo trì, sửa sự cố. */
export default function MaterialRows({ materials, rows, setRows }) {
  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ marginBottom: 4, flexWrap: 'nowrap' }}>
          <select value={r.material_id} onChange={(e) => upd(i, 'material_id', Number(e.target.value))}>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.code} – {m.name} (tồn {m.stock} {m.unit})</option>)}
          </select>
          <input type="number" min="0" step="any" value={r.qty} onChange={(e) => upd(i, 'qty', e.target.value)} style={{ width: 90 }} />
          <button type="button" className="btn sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      {materials.length > 0 && (
        <button type="button" className="btn sm" onClick={() => setRows([...rows, { material_id: materials[0].id, qty: 1 }])}>+ Vật tư</button>
      )}
    </div>
  )
}

export const materialPayload = (rows) => rows.filter((r) => Number(r.qty) > 0).map((r) => ({ material_id: r.material_id, qty: Number(r.qty) }))
