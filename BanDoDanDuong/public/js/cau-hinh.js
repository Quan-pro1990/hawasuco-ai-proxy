/*
 * Cấu hình dịch vụ bản đồ. Mặc định dùng các dịch vụ miễn phí trên nền OpenStreetMap, không cần khoá.
 * Muốn dùng dữ liệu VietMap (tìm địa chỉ Việt Nam tốt hơn): đăng ký khoá API tại https://maps.vietmap.vn
 * rồi nhập vào Cài đặt → Nâng cao (không cần sửa file này).
 */

const NHAN_VE_TINH = 'https://server.arcgisonline.com/ArcGIS/rest/services';
// Kiểu Liberty của OpenFreeMap: dữ liệu OpenStreetMap dựng lại mỗi tuần; mọi kiểu bản đồ dưới đây tô lại từ kiểu này
const OPENFREEMAP = 'https://tiles.openfreemap.org/styles/liberty';

export const CAU_HINH = {
  tenUngDung: 'HawaMap',
  phienBan: '1.0.0',

  // Hồ Hoàn Kiếm — vị trí mở bản đồ lần đầu khi chưa có GPS
  viTriMacDinh: { tam: [105.8522, 21.0287], zoom: 14 },
  // Khung lãnh thổ Việt Nam (kể cả Hoàng Sa, Trường Sa) để giới hạn tìm kiếm
  khungVietNam: [102.1, 6.5, 117.5, 23.45],

  // bienDoi: cách tô lại kiểu gốc — google / googleToi / diaHinh (kieu-google.js: màu như Google Maps), veTinh (ve-tinh.js)
  kieuBanDo: {
    tieuchuan: { ten: 'Mặc định', style: OPENFREEMAP, bienDoi: 'google' },
    vetinh: { ten: 'Vệ tinh', style: OPENFREEMAP, bienDoi: 'veTinh' },
    diahinh: { ten: 'Địa hình', style: OPENFREEMAP, bienDoi: 'diaHinh' },
    bandem: { ten: 'Ban đêm', toi: true, style: OPENFREEMAP, bienDoi: 'googleToi' }
  },

  // Ảnh vệ tinh cho kiểu "Vệ tinh" (Esri World Imagery, ảnh Maxar / Earthstar Geographics)
  anhVeTinh: {
    tiles: [NHAN_VE_TINH + '/World_Imagery/MapServer/tile/{z}/{y}/{x}'], maxzoom: 19,
    ghiNguon: '© Esri, Maxar, Earthstar Geographics'
  },
  // Bóng đồi núi cho kiểu "Địa hình" (Esri World Hillshade)
  bongDiaHinh: {
    tiles: [NHAN_VE_TINH + '/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'], maxzoom: 16,
    ghiNguon: '© Esri, USGS, NASA'
  },

  dichVu: {
    // Chỉ đường (OSRM). Ô tô / xe máy dùng máy chủ project-osrm, đi bộ / xe đạp dùng máy chủ FOSSGIS.
    osrmOto: 'https://router.project-osrm.org/route/v1/driving',
    osrmDiBo: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
    osrmXeDap: 'https://routing.openstreetmap.de/routed-bike/route/v1/driving',
    // Tìm kiếm khi đang gõ (Photon) và tìm đầy đủ / tìm địa chỉ theo toạ độ (Nominatim)
    photon: 'https://photon.komoot.io/api/',
    nominatim: 'https://nominatim.openstreetmap.org',
    // Dữ liệu đường: giới hạn tốc độ, camera, đường sắt giao cắt, trạm thu phí, địa điểm quanh đây
    overpass: ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'],
    // VietMap Maps API (tuỳ chọn, cần khoá)
    vietmap: {
      // kiểu bản đồ chính thức (MapLibre style.json), thử lần lượt: đường dẫn trong tài liệu SDK của VietMap
      // (/api/maps/{ten}/styles.json, vd. light), rồi đường dẫn theo mã kiểu (/maps/styles/{ma}/style.json: tm, dm, hm); {khoa} = khoá API
      kieuBanDo: ['https://maps.vietmap.vn/api/maps/{ten}/styles.json?apikey={khoa}', 'https://maps.vietmap.vn/maps/styles/{ma}/style.json?apikey={khoa}'],
      goiY: 'https://maps.vietmap.vn/api/autocomplete/v3',
      chiTiet: 'https://maps.vietmap.vn/api/place/v3',
      nguoc: 'https://maps.vietmap.vn/api/reverse/v3',
      chiDuong: 'https://maps.vietmap.vn/api/route'
    }
  }
};

/**
 * Kiểu bản đồ chính thức của VietMap qua VietMap Maps API, dùng khoá API của người dùng (Cài đặt → Nâng cao).
 * Chỉ dùng dịch vụ có khoá theo điều khoản của VietMap; không lấy ô bản đồ từ trang, công cụ khác của VietMap.
 */
export const KIEU_VIETMAP = {
  vietmap: { ten: 'VietMap', kieu: 'light', ma: 'tm' },
  vietmapdem: { ten: 'VietMap tối', kieu: 'dark', ma: 'dm', toi: true },
  vietmapvetinh: { ten: 'VietMap vệ tinh', kieu: 'hybrid', ma: 'hm' }
};

/**
 * Cấu hình kiểu bản đồ VietMap `ten` với khoá `khoa`; null nếu không phải kiểu VietMap hoặc chưa có khoá.
 * style: đường dẫn thử trước; styleDuPhong: các đường dẫn thử tiếp khi không tải được.
 */
export function kieuVietmap(ten, khoa) {
  const k = KIEU_VIETMAP[ten];
  if (!k || !khoa) return null;
  const [dau, ...sau] = CAU_HINH.dichVu.vietmap.kieuBanDo.map(u =>
    u.replace('{ten}', k.kieu).replace('{ma}', k.ma).replace('{khoa}', encodeURIComponent(khoa)));
  return { ten: k.ten, ...(k.toi ? { toi: true } : {}), vietmap: true, style: dau, styleDuPhong: sau };
}
