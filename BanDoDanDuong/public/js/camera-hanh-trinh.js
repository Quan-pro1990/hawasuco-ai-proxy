/*
 * Camera hành trình: quay video bằng camera của điện thoại hoặc webcam USB, in giờ / tốc độ / toạ độ / tên đường lên hình,
 * ghi thành từng đoạn (ghi vòng: vượt số đoạn hoặc dung lượng thì xoá đoạn cũ chưa khoá), chụp ảnh, lưu trong máy (IndexedDB).
 * Tự ghi khi xe chạy trên 5 km/h và tự dừng sau 20 giây đứng yên.
 */
import { caiDat, idb } from './kho.js';
import { ngayGio } from './dinh-dang.js';

const KHO = 'doancamera';
const KIEU_VIDEO = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

export const CHAT_LUONG = {
  thap: { ten: 'Thấp (360p, ~1 Mb/giây)', rong: 640, cao: 360, bps: 1000000 },
  vua: { ten: 'Vừa (720p, ~2,5 Mb/giây)', rong: 1280, cao: 720, bps: 2500000 },
  cao: { ten: 'Cao (1080p, ~5 Mb/giây)', rong: 1920, cao: 1080, bps: 5000000 }
};

/**
 * Các đoạn cần xoá khi ghi vòng: bỏ đoạn cũ nhất chưa khoá cho tới khi số đoạn chưa khoá ≤ soToiDa
 * và tổng dung lượng ≤ toiDaByte (0 = không giới hạn). Luôn giữ lại đoạn mới nhất.
 */
export function doanCanXoa(ds, soToiDa, toiDaByte = 0) {
  const mo = ds.filter(d => !d.khoa).sort((a, b) => a.batDau - b.batDau);
  let tong = ds.reduce((t, d) => t + (d.kichThuoc || 0), 0);
  let con = mo.length;
  const xoa = [];
  for (const d of mo) {
    if (con <= 1 || (con <= Math.max(1, soToiDa) && !(toiDaByte && tong > toiDaByte))) break;
    xoa.push(d.id);
    tong -= d.kichThuoc || 0;
    con--;
  }
  return xoa;
}

/** Tự bắt đầu ghi khi xe chạy (> 5 km/h), tự dừng sau 20 giây đứng yên (chỉ dừng đoạn do chính nó bật). */
export class TuDongGhi {
  constructor() {
    this.dungLuc = 0;
    this.boQua = false;     // người dùng vừa tự dừng ghi khi xe đang chạy: chờ xe dừng hẳn mới tự ghi lại
  }

  /** @returns 'batdau' | 'dung' | null */
  xet(kmh, { dangGhi, tuBat }, bayGio = Date.now()) {
    if (kmh > 5) {
      this.dungLuc = 0;
      return dangGhi || this.boQua ? null : 'batdau';
    }
    if (kmh < 2) this.boQua = false;
    if (!dangGhi || !tuBat || kmh >= 2) { this.dungLuc = 0; return null; }
    if (!this.dungLuc) this.dungLuc = bayGio;
    if (bayGio - this.dungLuc < 20000) return null;
    this.dungLuc = 0;
    return 'dung';
  }
}

/** Các camera của thiết bị (kể cả webcam USB nếu trình duyệt nhận): [{ id, ten }]. */
export async function danhSachCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  const ds = await navigator.mediaDevices.enumerateDevices();
  return ds.filter(d => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, ten: d.label || `Camera ${i + 1}` }));
}

export function hoTroCamera() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

export class CameraHanhTrinh {
  /**
   * @param canvas   khung vẽ hiển thị (cũng là nguồn ghi hình)
   * @param video    thẻ <video> ẩn nhận luồng camera
   * @param layHud   () => { tocDo (km/h), viTri, tenDuong, gioiHan }
   * @param baoDoi   () => void, gọi khi trạng thái ghi thay đổi
   */
  constructor({ canvas, video, layHud, baoDoi }) {
    Object.assign(this, { canvas, video, layHud, baoDoi });
    this.ctx = canvas.getContext('2d');
    this.luong = null;
    this.ghi = null;
    this.dangGhi = false;
    this.tuBat = false;       // đoạn đang ghi do tự động bật
    this.khoaDoanNay = false;
  }

  get dangMo() { return !!this.luong; }

  async mo() {
    if (this.luong) return;
    const cl = CHAT_LUONG[caiDat.camChatLuong] || CHAT_LUONG.vua;
    const video = { width: { ideal: cl.rong }, height: { ideal: cl.cao } };
    const sau = { ...video, facingMode: { ideal: 'environment' } };
    try {
      this.luong = await navigator.mediaDevices.getUserMedia({
        video: caiDat.camThietBi ? { ...video, deviceId: { exact: caiDat.camThietBi } } : sau, audio: !!caiDat.camGhiAm
      });
    } catch (e) {
      // camera đã chọn không còn (rút webcam USB): dùng camera sau
      if (!caiDat.camThietBi || !/Overconstrained|NotFound|NotReadable/.test(e.name)) throw e;
      this.luong = await navigator.mediaDevices.getUserMedia({ video: sau, audio: !!caiDat.camGhiAm });
    }
    const track = this.luong.getVideoTracks()[0];
    this.tenCamera = track ? track.label : '';
    this.video.srcObject = this.luong;
    this.video.muted = true;
    await this.video.play();
    this.canvas.width = this.video.videoWidth || 1280;
    this.canvas.height = this.video.videoHeight || 720;
    this.veLap = setInterval(() => this.ve(), 1000 / 25);
  }

  ve() {
    const { ctx, canvas: c } = this;
    const w = c.width, h = c.height;
    if (this.video.readyState >= 2) ctx.drawImage(this.video, 0, 0, w, h);
    const hud = this.layHud() || {};
    const co = Math.round(h / 24);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, h - co * 2.1, w, co * 2.1);
    ctx.font = `600 ${co}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    const y = h - co * 1.05;
    ctx.textAlign = 'left';
    ctx.fillText(ngayGio(Date.now()) + ':' + String(new Date().getSeconds()).padStart(2, '0'), co * 0.6, y);
    ctx.textAlign = 'center';
    const giua = [hud.tocDo != null ? hud.tocDo + ' km/h' : '', hud.tenDuong || ''].filter(Boolean).join('  ·  ');
    ctx.fillText(giua, w / 2, y);
    ctx.textAlign = 'right';
    ctx.fillText(hud.viTri ? hud.viTri[1].toFixed(5) + ', ' + hud.viTri[0].toFixed(5) : 'Chưa có GPS', w - co * 0.6, y);
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(co * 0.8)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('HawaMap', co * 0.6, co * 1.1);
    if (this.dangGhi && Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.arc(w - co * 3.6, co * 1.1, co * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('REC', w - co * 2.9, co * 1.1);
    }
  }

  batDauGhi() {
    if (!this.luong || this.dangGhi) return;
    this.dangGhi = true;
    this.moDoanMoi();
    this.baoDoi && this.baoDoi();
  }

  moDoanMoi() {
    const luong = this.canvas.captureStream(25);
    this.luong.getAudioTracks().forEach(t => luong.addTrack(t));
    const kieu = KIEU_VIDEO.find(k => MediaRecorder.isTypeSupported(k)) || '';
    const bps = (CHAT_LUONG[caiDat.camChatLuong] || CHAT_LUONG.vua).bps;
    const rec = new MediaRecorder(luong, kieu ? { mimeType: kieu, videoBitsPerSecond: bps } : undefined);
    const manh = [];
    const batDau = Date.now();
    rec.ondataavailable = e => { if (e.data && e.data.size) manh.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(manh, { type: rec.mimeType || kieu || 'video/webm' });
      const khoa = this.khoaDoanNay;
      this.khoaDoanNay = false;
      if (blob.size) luuDoan({ blob, batDau, ketThuc: Date.now(), khoa }).catch(e => console.error('Lưu đoạn video lỗi', e));
    };
    rec.start(1000);
    this.ghi = rec;
    clearTimeout(this.hetDoan);
    this.hetDoan = setTimeout(() => {
      if (!this.dangGhi) return;
      rec.stop();
      this.moDoanMoi();
    }, Math.max(1, caiDat.doDaiDoanCamera) * 60000);
  }

  dungGhi() {
    if (!this.dangGhi) return;
    this.dangGhi = false;
    this.tuBat = false;
    clearTimeout(this.hetDoan);
    if (this.ghi && this.ghi.state !== 'inactive') this.ghi.stop();
    this.ghi = null;
    this.baoDoi && this.baoDoi();
  }

  /** Giữ đoạn đang ghi, không bị xoá khi ghi vòng (vd. vừa xảy ra va chạm). */
  khoaDoanHienTai() { this.khoaDoanNay = true; }

  /** Chụp ảnh khung hình hiện tại (có in giờ, tốc độ, toạ độ), lưu cùng danh sách video. */
  async chupAnh() {
    if (!this.luong) throw new Error('Camera chưa mở');
    const blob = await new Promise(ok => this.canvas.toBlob(ok, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Không chụp được ảnh');
    const luc = Date.now();
    const anh = { id: 'a' + luc, batDau: luc, ketThuc: luc, khoa: true, anh: true, kichThuoc: blob.size, kieu: blob.type, blob };
    await idb.luu(KHO, anh);
    return anh;
  }

  /** Chuyển sang camera kế tiếp (camera trước / sau / webcam USB); vẫn ghi tiếp nếu đang ghi. Trả về tên camera. */
  async doiCamera(doiCaiDat) {
    const ds = await danhSachCamera();
    if (ds.length < 2) throw new Error('Thiết bị chỉ có một camera');
    const hienTai = this.luong && this.luong.getVideoTracks()[0];
    const idHienTai = caiDat.camThietBi || (hienTai && hienTai.getSettings ? hienTai.getSettings().deviceId : '');
    const ke = ds[(ds.findIndex(d => d.id === idHienTai) + 1) % ds.length];
    const ghiTiep = this.dangGhi, tuBat = this.tuBat;
    this.dong();
    doiCaiDat({ camThietBi: ke.id });
    await this.mo();
    if (ghiTiep) { this.batDauGhi(); this.tuBat = tuBat; }
    return this.tenCamera || ke.ten;
  }

  dong() {
    this.dungGhi();
    clearInterval(this.veLap);
    if (this.luong) this.luong.getTracks().forEach(t => t.stop());
    this.luong = null;
    this.video.srcObject = null;
  }
}

async function luuDoan({ blob, batDau, ketThuc, khoa }) {
  await idb.luu(KHO, { id: 'v' + batDau, batDau, ketThuc, khoa, kichThuoc: blob.size, kieu: blob.type, blob });
  // ghi vòng: bỏ các đoạn cũ nhất chưa khoá khi vượt số đoạn hoặc dung lượng cho phép
  const ds = (await idb.tatCa(KHO)).map(({ blob: _b, ...d }) => d);
  for (const id of doanCanXoa(ds, caiDat.soDoanToiDa, (caiDat.camGioiHanMB || 0) * 1024 * 1024)) await idb.xoa(KHO, id);
}

export async function danhSachDoan() {
  return (await idb.tatCa(KHO)).sort((a, b) => b.batDau - a.batDau);
}

export async function doiKhoaDoan(id) {
  const d = await idb.lay(KHO, id);
  if (!d) return;
  d.khoa = !d.khoa;
  await idb.luu(KHO, d);
}

export function xoaDoan(id) { return idb.xoa(KHO, id); }
export function layDoan(id) { return idb.lay(KHO, id); }
