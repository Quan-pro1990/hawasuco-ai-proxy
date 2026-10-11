import { fmt } from '../labels'

export default function IsolationPanel({ iso, onClose, onFlyTo }) {
  return (
    <div className="side-panel floating">
      <div className="hd"><h3 style={{ margin: 0 }}>Phân tích cô lập sự cố</h3><button className="x" onClick={onClose}>×</button></div>
      <div className="bd">
        {iso.warnings?.map((w) => <div key={w} className="alert warn">{w}</div>)}
        <div className="cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card kpi"><div className="v" style={{ color: '#16a34a' }}>{iso.valves.length}</div><div className="l">Van cần đóng</div></div>
          <div className="card kpi"><div className="v" style={{ color: '#dc2626' }}>{iso.affected_customers}</div><div className="l">Khách hàng mất nước</div></div>
          <div className="card kpi"><div className="v">{fmt.num(iso.segment_length_m)} m</div><div className="l">Đoạn bị cô lập ({iso.segment_pipes.length} ống)</div></div>
          <div className="card kpi"><div className="v">{fmt.num(iso.downstream_length_m)} m</div><div className="l">Mất nước hạ lưu ({iso.downstream_pipes.length} ống)</div></div>
        </div>
        <div className="legend" style={{ marginBottom: 10 }}>
          <span><i style={{ background: '#dc2626', height: 6 }} />Đoạn ống bị cô lập</span>
          <span><i style={{ background: '#f97316' }} />Mất nước do mất kết nối nguồn</span>
          <span><b style={{ background: '#16a34a', boxShadow: '0 0 0 2px #dc2626' }} />Van cần đóng</span>
        </div>
        <h3>Danh sách van cần đóng</h3>
        <table className="tbl">
          <thead><tr><th>#</th><th>Mã van</th><th>Cỡ</th></tr></thead>
          <tbody>
            {iso.valve_list.map((v, i) => (
              <tr key={v.id} onClick={() => onFlyTo(v.geometry)}><td>{i + 1}</td><td>{v.code}</td><td>D{v.diameter_mm || '?'}</td></tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ marginTop: 14 }}>Khách hàng cần thông báo ({iso.affected_customers})</h3>
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Tên</th><th>Điện thoại</th></tr></thead>
          <tbody>
            {iso.customer_list.slice(0, 200).map((c) => (
              <tr key={c.id}><td>{c.code}</td><td>{c.name}</td><td>{c.phone}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ft">
        <button className="btn" onClick={() => {
          const rows = [['Mã KH', 'Tên', 'Điện thoại', 'Địa chỉ'], ...iso.customer_list.map((c) => [c.code, c.name, c.phone, c.address])]
          const csv = '﻿' + rows.map((r) => r.map((x) => `"${(x ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
          a.download = `khach-hang-mat-nuoc-ong-${iso.pipe_id}.csv`
          a.click()
        }}>Xuất DS khách hàng (CSV)</button>
      </div>
    </div>
  )
}
