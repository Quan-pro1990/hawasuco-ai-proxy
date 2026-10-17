/*
 * Nhắc nhở khi lái xe: mất / có lại tín hiệu GPS, nhắc bật đèn khi trời tối và tắt đèn khi trời sáng
 * (giờ mặt trời mọc / lặn tính theo vị trí và ngày, công thức "sunrise equation").
 */
import { caiDat, doc, ghi } from './kho.js';

const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

/**
 * Giờ mặt trời mọc / lặn (mốc thời gian ms) của ngày chứa thời điểm `luc` tại [lng, lat].
 * Vùng cực không có mọc / lặn thì trả về null.
 */
export function gioMatTroi(luc, lat, lng) {
  const ms = luc instanceof Date ? luc.getTime() : luc;
  const jd = ms / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + lng / 360);           // số ngày từ J2000 tới trưa địa phương gần nhất
  const jSao = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jSao) % 360;
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M));
  const L = (M + C + 180 + 102.9372) % 360;
  const jTrua = 2451545.0 + jSao + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * L));
  const sinD = Math.sin(rad(L)) * Math.sin(rad(23.4397));
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(rad(-0.833)) - Math.sin(rad(lat)) * sinD) / (Math.cos(rad(lat)) * cosD);
  if (cosW < -1 || cosW > 1) return null;
  const w = deg(Math.acos(cosW));
  const raMs = j => Math.round((j - 2440587.5) * 86400000);
  return { moc: raMs(jTrua - w / 360), lan: raMs(jTrua + w / 360) };
}

/** Đang là ban đêm (trước khi mặt trời mọc hoặc sau khi lặn) tại p = [lng, lat]. */
export function laBanDem(p, luc = Date.now()) {
  const g = gioMatTroi(luc, p[1], p[0]);
  if (!g) return false;
  return luc < g.moc || luc > g.lan;
}

const PHUT = 60000;

export class NhacNho {
  /**
   * @param o.noi  (câu, tuỳ chọn) => void
   * @param o.bip  (loại) => void
   * @param o.bao  (chữ, loại) => void   hiện thông báo trên màn hình
   */
  constructor(o) {
    Object.assign(this, o);
    this.cuoi = 0;          // lúc nhận vị trí gần nhất
    this.matGps = false;
    this.lucChay = 0;       // lúc gần nhất xe chạy từ 10 km/h trở lên
    this.daNhac = doc('nhacden', {});   // { toi: 'yyyy-m-d', sang: 'yyyy-m-d' }
  }

  /** Gọi mỗi khi có vị trí mới (vị trí thật, không phải chạy thử). */
  viTri(vt, kmh, bayGio = Date.now()) {
    this.cuoi = bayGio;
    this.kmhCuoi = kmh;
    if (this.matGps) {
      this.matGps = false;
      if (caiDat.canhBaoMatGps) { this.noi('Đã có lại tín hiệu GPS.'); this.bao('Đã có lại tín hiệu GPS', 'tot'); }
    }
    if (kmh >= 10) this.lucChay = bayGio;
    this.kiemTraDen(vt.viTri, bayGio);
  }

  /**
   * Gọi định kỳ: xe đang chạy mà quá 15 giây không có vị trí thì báo mất GPS.
   * Xe đứng yên thì GPS có thể không gửi vị trí mới (vị trí không đổi), không báo.
   */
  kiemTra(dangDi, bayGio = Date.now()) {
    if (!dangDi || !this.cuoi || this.matGps || !(this.kmhCuoi >= 10)) return this.matGps;
    if (bayGio - this.cuoi > 15000) {
      this.matGps = true;
      if (caiDat.canhBaoMatGps) {
        this.bip('canhbao');
        this.noi('Mất tín hiệu GPS. Cảnh báo tốc độ và dẫn đường tạm dừng.', { chen: true });
        this.bao('Mất tín hiệu GPS', 'loi');
      }
    }
    return this.matGps;
  }

  /** Cho thêm thời gian trước khi báo mất GPS (vừa mở lại ứng dụng, vừa bật GPS). */
  choThem(bayGio = Date.now()) {
    if (this.cuoi) this.cuoi = Math.max(this.cuoi, bayGio);
  }

  kiemTraDen(p, bayGio) {
    if (!caiDat.nhacDen || bayGio - this.lucChay > PHUT) return;
    const g = gioMatTroi(bayGio, p[1], p[0]);
    if (!g) return;
    const d = new Date(bayGio), ngay = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (bayGio > g.lan + 10 * PHUT && bayGio < g.lan + 180 * PHUT && this.daNhac.toi !== ngay) {
      this.daNhac.toi = ngay;
      ghi('nhacden', this.daNhac);
      this.noi('Trời đã tối, hãy bật đèn xe.');
      this.bao('Trời đã tối, hãy bật đèn xe', '');
    } else if (bayGio > g.moc + 20 * PHUT && bayGio < g.moc + 180 * PHUT && this.daNhac.sang !== ngay) {
      this.daNhac.sang = ngay;
      ghi('nhacden', this.daNhac);
      this.noi('Trời đã sáng, bạn có thể tắt đèn xe.');
      this.bao('Trời đã sáng, có thể tắt đèn xe', '');
    }
  }
}
