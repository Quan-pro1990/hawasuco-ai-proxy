import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { INCIDENT_TYPES, MATERIALS, NODE_TYPES, fmt } from '../labels'

// Bảng màu phân loại cố định (đã kiểm định cho người mù màu) – gán theo thứ tự, không xoay vòng
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const AXIS = { fontSize: 11, stroke: '#94a3b8', tickLine: false }

function ChartCard({ title, children, h = 260 }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={h}>{children}</ResponsiveContainer>
    </div>
  )
}

export default function Reports() {
  const [s, setS] = useState(null)
  const [pipes, setPipes] = useState(null)
  const [inc, setInc] = useState(null)
  const [nrw, setNrw] = useState([])
  const [cons, setCons] = useState([])

  useEffect(() => {
    api.get('/api/reports/summary').then(setS)
    api.get('/api/reports/pipes').then(setPipes)
    api.get('/api/reports/incidents').then(setInc)
    api.get('/api/reports/nrw').then(setNrw)
    api.get('/api/reports/consumption').then(setCons)
  }, [])

  const zonesNrw = [...new Set(nrw.map((r) => r.zone))]
  const nrwByPeriod = Object.values(nrw.reduce((acc, r) => {
    (acc[r.period] ||= { period: r.period })[r.zone] = r.nrw_pct
    return acc
  }, {}))
  const lastPeriod = nrwByPeriod.at(-1)?.period
  const lastRows = nrw.filter((r) => r.period === lastPeriod)
  const totalIn = lastRows.reduce((a, r) => a + r.inflow_m3, 0)
  const totalLoss = lastRows.reduce((a, r) => a + r.loss_m3, 0)
  const incTypes = Object.keys(INCIDENT_TYPES)

  return (
    <div className="page">
      <div className="page-head">
        <h2>Thống kê & báo cáo</h2>
        <div className="row">
          {['pipes', 'nodes', 'customers', 'incidents'].map((l) => (
            <button key={l} className="btn sm" onClick={() => api.download(`/api/export/${l}?format=csv`, `${l}.csv`)}>
              Xuất {{ pipes: 'ống', nodes: 'thiết bị', customers: 'khách hàng', incidents: 'sự cố' }[l]} (CSV)
            </button>
          ))}
        </div>
      </div>

      {s && (
        <div className="cards">
          <div className="card kpi"><div className="v">{fmt.num(s.pipe_length_km, 2)} km</div><div className="l">Tổng chiều dài ống ({fmt.num(s.pipe_count)} đoạn)</div></div>
          <div className="card kpi"><div className="v">{fmt.num(s.node_counts.valve || 0)}</div><div className="l">Van · {fmt.num(s.node_counts.hydrant || 0)} trụ cứu hỏa</div></div>
          <div className="card kpi"><div className="v">{fmt.num(s.customer_count)}</div><div className="l">Khách hàng · {fmt.num(s.meter_count)} đồng hồ</div></div>
          <div className="card kpi"><div className="v" style={{ color: s.open_incidents ? '#dc2626' : undefined }}>{s.open_incidents}</div><div className="l">Sự cố đang xử lý</div></div>
          <div className="card kpi"><div className="v">{s.avg_resolve_hours ?? '—'} giờ</div><div className="l">Thời gian khắc phục TB</div></div>
          <div className="card kpi"><div className="v">{totalIn ? fmt.num((totalLoss / totalIn) * 100, 1) + '%' : '—'}</div><div className="l">Tỷ lệ thất thoát kỳ {lastPeriod || ''}</div></div>
        </div>
      )}

      <div className="charts">
        {pipes && (
          <ChartCard title="Chiều dài ống theo vật liệu (km)">
            <BarChart data={pipes.by_material.map((r) => ({ ...r, name: MATERIALS[r.material]?.label || r.material }))} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" {...AXIS} interval={0} /><YAxis {...AXIS} width={40} />
              <Tooltip formatter={(v) => [`${fmt.num(v, 2)} km`, 'Chiều dài']} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="km" fill={SERIES[0]} radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#475569', formatter: (v) => fmt.num(v, 2) }} />
            </BarChart>
          </ChartCard>
        )}
        {pipes && (
          <ChartCard title="Chiều dài ống theo tuổi (km)">
            <BarChart data={pipes.by_age} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="bucket" {...AXIS} /><YAxis {...AXIS} width={40} />
              <Tooltip formatter={(v) => [`${fmt.num(v, 2)} km`, 'Chiều dài']} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="km" fill={SERIES[0]} radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#475569', formatter: (v) => fmt.num(v, 2) }} />
            </BarChart>
          </ChartCard>
        )}
        {pipes && (
          <ChartCard title="Chiều dài ống theo đường kính (km)">
            <BarChart data={pipes.by_diameter.map((r) => ({ ...r, name: `D${r.diameter_mm}` }))} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" {...AXIS} /><YAxis {...AXIS} width={40} />
              <Tooltip formatter={(v) => [`${fmt.num(v, 2)} km`, 'Chiều dài']} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="km" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        )}
        {inc && (
          <ChartCard title="Số sự cố theo tháng và loại">
            <BarChart data={inc.by_month} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" {...AXIS} /><YAxis {...AXIS} width={30} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {incTypes.map((t, i) => (
                <Bar key={t} dataKey={t} name={INCIDENT_TYPES[t]} stackId="a" fill={SERIES[i]} stroke="#fff" strokeWidth={1}
                  radius={i === incTypes.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ChartCard>
        )}
        {nrwByPeriod.length > 0 && (
          <ChartCard title="Tỷ lệ thất thoát nước theo DMA (%)">
            <LineChart data={nrwByPeriod}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="period" {...AXIS} /><YAxis {...AXIS} width={36} unit="%" domain={[0, 'auto']} />
              <Tooltip formatter={(v, n) => [`${v}%`, n]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {zonesNrw.map((z, i) => <Line key={z} dataKey={z} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />)}
            </LineChart>
          </ChartCard>
        )}
        {cons.length > 0 && (
          <ChartCard title="Sản lượng nước ghi thu theo đối tượng (m³)">
            <BarChart data={cons.slice(1)} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="period" {...AXIS} /><YAxis {...AXIS} width={50} />
              <Tooltip formatter={(v) => fmt.num(v)} cursor={{ fill: '#f1f5f9' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {[['household', 'Hộ gia đình'], ['business', 'Kinh doanh'], ['agency', 'Cơ quan']].map(([k, l], i, arr) => (
                <Bar key={k} dataKey={k} name={l} stackId="c" fill={SERIES[i]} stroke="#fff" strokeWidth={1} radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ChartCard>
        )}
      </div>

      <div className="charts">
        <div className="card">
          <h3>Bảng cân bằng nước kỳ {lastPeriod}</h3>
          <table className="tbl">
            <thead><tr><th>DMA</th><th className="num">Cấp vào (m³)</th><th className="num">Ghi thu (m³)</th><th className="num">Thất thoát (m³)</th><th className="num">Tỷ lệ</th></tr></thead>
            <tbody>
              {lastRows.map((r) => (
                <tr key={r.zone_id}><td>{r.zone}</td><td className="num">{fmt.num(r.inflow_m3)}</td><td className="num">{fmt.num(r.billed_m3)}</td>
                  <td className="num">{fmt.num(r.loss_m3)}</td><td className="num"><b style={{ color: r.nrw_pct > 25 ? '#dc2626' : r.nrw_pct > 18 ? '#ca8a04' : '#16a34a' }}>{r.nrw_pct}%</b></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {inc && (
          <div className="card">
            <h3>Điểm nóng – đoạn ống nhiều sự cố nhất</h3>
            <table className="tbl">
              <thead><tr><th>Ống</th><th>Tuyến</th><th>Vật liệu</th><th className="num">Năm lắp</th><th className="num">Sự cố</th></tr></thead>
              <tbody>
                {inc.hotspots.map((h) => (
                  <tr key={h.id}><td><Link to={`/map?pipe=${h.id}`}>{h.code}</Link></td><td>{h.street}</td><td>{h.material} D{h.diameter_mm}</td>
                    <td className="num">{h.install_year}</td><td className="num"><b>{h.n}</b></td></tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">Tổng chi phí sửa chữa: {fmt.money(inc.repair_cost)} · Nước thất thoát do sự cố: {fmt.num(inc.loss_m3)} m³</p>
          </div>
        )}
        {s && (
          <div className="card">
            <h3>Thống kê thiết bị</h3>
            <table className="tbl"><tbody>
              {Object.entries(s.node_counts).map(([k, v]) => <tr key={k}><td>{NODE_TYPES[k]?.label || k}</td><td className="num">{fmt.num(v)}</td></tr>)}
            </tbody></table>
          </div>
        )}
      </div>
    </div>
  )
}
