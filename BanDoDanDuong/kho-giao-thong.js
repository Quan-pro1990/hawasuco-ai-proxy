/*
 * Kho dữ liệu giao thông của máy chủ: điểm cảnh báo (camera, biển báo, trạm thu phí…) theo ô lưới 0,1°,
 * lấy từ OpenStreetMap (Overpass API), lưu thành tệp JSON trong thư mục dữ liệu và tự cập nhật mỗi tuần.
 * Mọi người dùng dùng chung bản lưu nên máy chủ Overpass chỉ bị gọi khi ô chưa có hoặc đã quá hạn.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { CAU_HINH } from './public/js/cau-hinh.js';
import { cauTruyVanO, docDiemOverpass, khungO, laMaO, oCanLamMoi, PHIEN_BAN_DIEM } from './public/js/duong-xa.js';

export const CHU_KY = 7 * 86400000;
const BO_SAU = 30 * 86400000;

/**
 * @param o.thuMuc   thư mục lưu tệp ô
 * @param o.layMang  hàm fetch (thay được khi kiểm thử)
 * @param o.chuKy    tuổi tối đa của một ô trước khi tải lại (mặc định 7 ngày)
 */
export function taoKhoGiaoThong({ thuMuc, layMang = globalThis.fetch, chuKy = CHU_KY, ghiLog = false } = {}) {
  const dangTai = new Map();           // khoá → Promise (không tải trùng một ô)
  const thatBai = new Map();           // khoá → { luc, loi }: Overpass lỗi thì giãn cách lần thử
  let hang = Promise.resolve();         // gọi Overpass lần lượt từng câu
  let lanCuoi = 0;

  const tepCua = (ma, lop) => path.join(thuMuc, `${ma}${lop === 'nho' ? '-nho' : ''}.json`);

  async function goiOverpass(cau) {
    let loi = null;
    for (const url of CAU_HINH.dichVu.overpass) {
      try {
        const r = await layMang(url, {
          method: 'POST', body: 'data=' + encodeURIComponent(cau), signal: AbortSignal.timeout(120000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': 'HawaMap/1.0 (may chu du lieu giao thong)' }
        });
        if (r.ok) return await r.json();
        loi = new Error('Overpass trả lỗi ' + r.status);
      } catch (e) { loi = e; }
    }
    throw loi || new Error('Không gọi được Overpass');
  }

  function taiTuOverpass(ma, lop) {
    const khoa = ma + ':' + lop;
    if (dangTai.has(khoa)) return dangTai.get(khoa);
    const viec = hang.then(async () => {
      const d = await goiOverpass(cauTruyVanO(khungO(ma), lop));
      const o = { ma, lop, capNhat: Date.now(), dungLuc: Date.now(), pb: PHIEN_BAN_DIEM, diem: [...docDiemOverpass(d.elements || []).values()] };
      await fsp.mkdir(thuMuc, { recursive: true });
      const tep = tepCua(ma, lop), tam = tep + '.tmp';
      await fsp.writeFile(tam, JSON.stringify(o));
      await fsp.rename(tam, tep);
      if (ghiLog) console.log(`[giao thông] cập nhật ô ${ma} (${lop}): ${o.diem.length} điểm`);
      thatBai.delete(khoa);
      return o;
    }).catch(loi => { thatBai.set(khoa, { luc: Date.now(), loi }); throw loi; }).finally(() => dangTai.delete(khoa));
    hang = viec.catch(() => {});
    dangTai.set(khoa, viec);
    return viec;
  }

  async function docTep(ma, lop) {
    try { return JSON.parse(await fsp.readFile(tepCua(ma, lop), 'utf8')); } catch (e) { return null; }
  }

  /** Một ô: bản lưu còn hạn thì trả ngay; quá hạn thì trả bản cũ và tải lại ở nền; chưa có thì tải ngay. */
  async function lay(ma, lop = 'chinh', bayGio = Date.now()) {
    if (!laMaO(ma) || (lop !== 'chinh' && lop !== 'nho')) throw new Error('Mã ô không hợp lệ');
    const o = await docTep(ma, lop);
    const loi = thatBai.get(ma + ':' + lop);
    if (!o) {
      // vừa lỗi: báo lỗi ngay, 2 phút sau mới thử lại Overpass
      if (loi && bayGio - loi.luc < 120000) throw loi.loi;
      return taiTuOverpass(ma, lop);
    }
    if (oCanLamMoi(o, bayGio, chuKy) && !(loi && bayGio - loi.luc < 3600000)) taiTuOverpass(ma, lop).catch(() => {});
    if (bayGio - (o.dungLuc || 0) > 86400000) {
      o.dungLuc = bayGio;
      fsp.writeFile(tepCua(ma, lop), JSON.stringify(o)).catch(() => {});
    }
    return o;
  }

  /** Cập nhật hằng tuần: tải lại ô quá hạn còn được dùng, xoá ô không ai dùng trong 30 ngày. */
  async function capNhatDinhKy(bayGio = Date.now()) {
    lanCuoi = bayGio;
    let ten = [];
    try { ten = (await fsp.readdir(thuMuc)).filter(t => /^\d+_\d+(-nho)?\.json$/.test(t)); } catch (e) { return { soLamMoi: 0, soXoa: 0 }; }
    let soLamMoi = 0, soXoa = 0;
    for (const t of ten) {
      const o = await docTep(t.replace(/(-nho)?\.json$/, ''), t.includes('-nho') ? 'nho' : 'chinh');
      if (!o) continue;
      if (bayGio - (o.dungLuc || o.capNhat) > BO_SAU) { await fsp.rm(path.join(thuMuc, t), { force: true }); soXoa++; continue; }
      if (!oCanLamMoi(o, bayGio, chuKy)) continue;
      try { await taiTuOverpass(o.ma, o.lop); soLamMoi++; } catch (e) { /* lần sau thử lại */ }
    }
    return { soLamMoi, soXoa };
  }

  async function trangThai() {
    let ten = [];
    try { ten = (await fsp.readdir(thuMuc)).filter(t => /^\d+_\d+(-nho)?\.json$/.test(t)); } catch (e) { /* chưa có dữ liệu */ }
    const luc = [];
    for (const t of ten) { try { luc.push(fs.statSync(path.join(thuMuc, t)).mtimeMs); } catch (e) { /* tệp vừa bị xoá */ } }
    return {
      soO: ten.length, chuKyNgay: Math.round(chuKy / 86400000), lanKiemTra: lanCuoi || null,
      cuNhat: luc.length ? Math.min(...luc) : null, moiNhat: luc.length ? Math.max(...luc) : null
    };
  }

  /** Kiểm tra mỗi 6 giờ (ô nào quá 7 ngày thì tải lại). */
  function batDauHenGio() {
    const t1 = setTimeout(() => capNhatDinhKy().catch(() => {}), 60000);
    const t2 = setInterval(() => capNhatDinhKy().catch(() => {}), 6 * 3600000);
    t1.unref(); t2.unref();
  }

  return { lay, capNhatDinhKy, trangThai, batDauHenGio };
}
