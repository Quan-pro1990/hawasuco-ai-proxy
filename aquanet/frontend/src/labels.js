export const NODE_TYPES = {
  junction: { label: 'Nút nối', color: '#64748b', r: 3 },
  valve: { label: 'Van', color: '#16a34a', r: 6 },
  hydrant: { label: 'Trụ cứu hỏa', color: '#dc2626', r: 6 },
  pump: { label: 'Trạm bơm', color: '#7c3aed', r: 8 },
  tank: { label: 'Bể chứa', color: '#0891b2', r: 10 },
  source: { label: 'Nhà máy / nguồn', color: '#1d4ed8', r: 11 },
  bulk_meter: { label: 'Đồng hồ tổng', color: '#ea580c', r: 7 },
}

export const MATERIALS = {
  HDPE: { label: 'HDPE', color: '#2563eb' },
  uPVC: { label: 'uPVC', color: '#0d9488' },
  DI: { label: 'Gang dẻo (DI)', color: '#7c3aed' },
  STEEL: { label: 'Thép', color: '#334155' },
  CI: { label: 'Gang xám (CI)', color: '#b45309' },
  PPR: { label: 'PPR', color: '#db2777' },
  AC: { label: 'Fibro xi măng (AC)', color: '#9f1239' },
}

export const PIPE_CLASS = { transmission: 'Truyền tải', distribution: 'Phân phối', service: 'Dịch vụ' }
export const PIPE_STATUS = { active: 'Đang sử dụng', abandoned: 'Ngưng sử dụng', planned: 'Quy hoạch' }

export const INCIDENT_TYPES = {
  leak: 'Rò rỉ', burst: 'Vỡ ống', low_pressure: 'Áp lực yếu', water_quality: 'Chất lượng nước',
  valve_fault: 'Hỏng van', other: 'Khác',
}
export const INCIDENT_STATUS = {
  new: { label: 'Mới tiếp nhận', color: '#dc2626' },
  assigned: { label: 'Đã phân công', color: '#ea580c' },
  in_progress: { label: 'Đang xử lý', color: '#ca8a04' },
  resolved: { label: 'Đã khắc phục', color: '#16a34a' },
  closed: { label: 'Đã đóng', color: '#64748b' },
}
export const SEVERITY = {
  low: { label: 'Thấp', color: '#64748b' }, medium: { label: 'Trung bình', color: '#ca8a04' },
  high: { label: 'Cao', color: '#ea580c' }, critical: { label: 'Khẩn cấp', color: '#dc2626' },
}
export const CUSTOMER_TYPES = { household: 'Hộ gia đình', business: 'Kinh doanh', agency: 'Cơ quan', industrial: 'Sản xuất' }
export const ROLES = { admin: 'Quản trị', engineer: 'Kỹ thuật', viewer: 'Chỉ xem' }

export const AGE_COLORS = [
  [10, '#16a34a', '< 10 năm'], [20, '#84cc16', '10–20 năm'], [30, '#f59e0b', '20–30 năm'], [999, '#dc2626', '≥ 30 năm'],
]

export function pipeWeight(d) {
  if (d >= 400) return 7
  if (d >= 250) return 5.5
  if (d >= 150) return 4
  if (d >= 100) return 3
  return 2
}

export function pipeColor(p, mode) {
  if (p.status === 'abandoned') return '#9ca3af'
  if (mode === 'material') return MATERIALS[p.material]?.color || '#2563eb'
  if (mode === 'age') {
    if (!p.install_year) return '#9ca3af'
    const age = new Date().getFullYear() - p.install_year
    return AGE_COLORS.find(([m]) => age < m)[1]
  }
  if (mode === 'diameter') {
    const d = p.diameter_mm
    return d >= 300 ? '#1e3a8a' : d >= 200 ? '#1d4ed8' : d >= 150 ? '#3b82f6' : d >= 100 ? '#60a5fa' : '#93c5fd'
  }
  return '#2563eb'
}

export const fmt = {
  num: (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: d })),
  date: (v) => (v ? new Date(v).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'),
  money: (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN') + ' đ'),
}
