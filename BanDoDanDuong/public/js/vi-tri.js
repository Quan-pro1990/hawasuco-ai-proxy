/* Nguồn vị trí: GPS của thiết bị, hoặc vị trí giả khi đang chạy mô phỏng. */
import { khoangCach, phuongVi } from './hinh-hoc.js';
import { laAppGoc } from './cau-noi.js';

const LOI_GPS = {
  1: 'Bạn chưa cho phép ứng dụng truy cập vị trí. Hãy bật quyền vị trí trong cài đặt trình duyệt.',
  2: 'Không xác định được vị trí. Hãy bật GPS / định vị của thiết bị.',
  3: 'Hết thời gian chờ tín hiệu GPS.'
};

export class NguonViTri {
  /** @param nhan (vt) => void, vt = { viTri, tocDo (m/s), huong (độ), doChinhXac (m), thoiGian, moPhong? } */
  constructor(nhan, baoLoi) {
    this.nhan = nhan;
    this.baoLoi = baoLoi;
    this.idTheoDoi = null;
    this.truoc = null;
    this.cuoi = null;
    this.moPhong = null;
  }

  batDau() {
    if (laAppGoc) return true;          // ứng dụng gốc tự gửi vị trí qua tuGoc()
    if (!('geolocation' in navigator)) { this.baoLoi && this.baoLoi('Thiết bị không hỗ trợ định vị'); return false; }
    if (this.idTheoDoi != null) return true;
    this.idTheoDoi = navigator.geolocation.watchPosition(
      p => this.xuLyGps(p),
      e => this.baoLoi && this.baoLoi(LOI_GPS[e.code] || e.message, e.code),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 }
    );
    return true;
  }

  dung() {
    if (this.idTheoDoi != null) navigator.geolocation.clearWatch(this.idTheoDoi);
    this.idTheoDoi = null;
  }

  /** Vị trí do ứng dụng gốc gửi (GPS của điện thoại). tocDo, huong: null nếu thiết bị không có. */
  tuGoc(lng, lat, tocDo, huong, doChinhXac, thoiGian) {
    this.xuLyGps({
      coords: { longitude: lng, latitude: lat, speed: tocDo, heading: huong, accuracy: doChinhXac },
      timestamp: thoiGian || Date.now()
    });
  }

  xuLyGps(p) {
    const c = p.coords;
    const vt = {
      viTri: [c.longitude, c.latitude], doChinhXac: c.accuracy,
      tocDo: c.speed == null || isNaN(c.speed) ? null : c.speed,
      huong: c.heading == null || isNaN(c.heading) ? null : c.heading,
      thoiGian: p.timestamp || Date.now()
    };
    // Thiết bị không báo tốc độ / hướng thì tự tính từ hai lần định vị liên tiếp
    const tr = this.truoc;
    if (tr) {
      const dt = (vt.thoiGian - tr.thoiGian) / 1000;
      const d = khoangCach(tr.viTri, vt.viTri);
      if (vt.tocDo == null && dt > 0) vt.tocDo = d < Math.min(vt.doChinhXac || 10, 15) ? 0 : d / dt;
      if (vt.huong == null && d > 5 && d > (vt.doChinhXac || 10) / 2) vt.huong = phuongVi(tr.viTri, vt.viTri);
    }
    if (vt.huong == null && tr) vt.huong = tr.huong;     // đứng yên: giữ hướng cũ
    this.truoc = vt;
    if (!this.moPhong) this.phat(vt);
  }

  phat(vt) {
    this.cuoi = vt;
    this.nhan(vt);
  }
}
