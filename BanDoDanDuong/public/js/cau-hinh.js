/*
 * Cấu hình dịch vụ bản đồ. Mặc định dùng các dịch vụ miễn phí trên nền OpenStreetMap, không cần khoá.
 * Muốn dùng dữ liệu VietMap (tìm địa chỉ Việt Nam tốt hơn): đăng ký khoá API tại https://maps.vietmap.vn
 * rồi nhập vào Cài đặt → Nâng cao (không cần sửa file này).
 */

const NHAN_VE_TINH = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const CAU_HINH = {
  tenUngDung: 'HawaMap',
  phienBan: '1.0.0',

  // Hồ Hoàn Kiếm — vị trí mở bản đồ lần đầu khi chưa có GPS
  viTriMacDinh: { tam: [105.8522, 21.0287], zoom: 14 },
  // Khung lãnh thổ Việt Nam (kể cả Hoàng Sa, Trường Sa) để giới hạn tìm kiếm
  khungVietNam: [102.1, 6.5, 117.5, 23.45],

  kieuBanDo: {
    tieuchuan: { ten: 'Tiêu chuẩn', mau: '#e8eef3', style: 'https://tiles.openfreemap.org/styles/liberty' },
    giaothong: { ten: 'Giao thông', mau: '#f4efe6', style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
    // Vệ tinh lai: ảnh vệ tinh (anhVeTinh) + đường, tên đường, địa danh tiếng Việt lấy từ kiểu "Tiêu chuẩn" (xem ve-tinh.js)
    vetinh: { ten: 'Vệ tinh', mau: '#3b4a3a', style: 'https://tiles.openfreemap.org/styles/liberty', lai: true },
    bandem: { ten: 'Ban đêm', mau: '#1f2633', toi: true, style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' }
  },

  // Ảnh vệ tinh cho kiểu "Vệ tinh" (Esri World Imagery, ảnh Maxar / Earthstar Geographics)
  anhVeTinh: {
    tiles: [NHAN_VE_TINH + '/World_Imagery/MapServer/tile/{z}/{y}/{x}'], maxzoom: 19,
    ghiNguon: '© Esri, Maxar, Earthstar Geographics'
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
      goiY: 'https://maps.vietmap.vn/api/autocomplete/v3',
      chiTiet: 'https://maps.vietmap.vn/api/place/v3',
      nguoc: 'https://maps.vietmap.vn/api/reverse/v3',
      chiDuong: 'https://maps.vietmap.vn/api/route'
    }
  }
};
