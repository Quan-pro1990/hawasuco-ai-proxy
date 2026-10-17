/*
 * Camera hành trình: quay video bằng camera sau của điện thoại, in giờ / tốc độ / toạ độ / tên đường lên hình,
 * ghi thành từng đoạn (ghi vòng: đầy thì xoá đoạn cũ chưa khoá), lưu trong máy (IndexedDB).
 */
import { caiDat, idb } from './kho.js';
import { ngayGio } from './dinh-dang.js';

const KHO = 'doancamera';
const KIEU_VIDEO = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

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
    this.khoaDoanNay = false;
  }

  get dangMo() { return !!this.luong; }

  async mo() {
    if (this.luong) return;
    this.luong = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: !!caiDat.camGhiAm
    });
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
    const rec = new MediaRecorder(luong, kieu ? { mimeType: kieu, videoBitsPerSecond: 2500000 } : undefined);
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
    clearTimeout(this.hetDoan);
    if (this.ghi && this.ghi.state !== 'inactive') this.ghi.stop();
    this.ghi = null;
    this.baoDoi && this.baoDoi();
  }

  /** Giữ đoạn đang ghi, không bị xoá khi ghi vòng (vd. vừa xảy ra va chạm). */
  khoaDoanHienTai() { this.khoaDoanNay = true; }

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
  // ghi vòng: bỏ các đoạn cũ nhất chưa khoá
  const ds = (await idb.tatCa(KHO)).filter(d => !d.khoa).sort((a, b) => a.batDau - b.batDau);
  const thua = ds.length - Math.max(1, caiDat.soDoanToiDa);
  for (let i = 0; i < thua; i++) await idb.xoa(KHO, ds[i].id);
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
