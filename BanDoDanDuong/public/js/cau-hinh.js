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
      goiY: 'https://maps.vietmap.vn/api/autocomplete/v3',
      chiTiet: 'https://maps.vietmap.vn/api/place/v3',
      nguoc: 'https://maps.vietmap.vn/api/reverse/v3',
      chiDuong: 'https://maps.vietmap.vn/api/route'
    }
  }
};
