/*
 * Kiểm thử "hợp đồng" giữa trang web và ứng dụng gốc (Android Auto / CarPlay / WebView điện thoại):
 * giả lập đối tượng cầu nối HawaMapAndroid, gửi lệnh như mã Kotlin/Swift sẽ gửi, kiểm tra tin trang gửi lại.
 * Chạy:  node test/e2e/xe.mjs     (ảnh chụp ở thư mục ANH_KIEM_THU)
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { taoMayChu } from '../../server.js';
import * as mau from '../du-lieu-mau.js';
import { chromium, giaLapMang, THAM_SO_TRINH_DUYET } from './chung.mjs';

const ANH = process.env.ANH_KIEM_THU || path.join(os.tmpdir(), 'hawamap-e2e');
await fs.mkdir(ANH, { recursive: true });
const { A } = mau.DIEM;

let soLoi = 0;
function kiem(dk, thongDiep) {
  if (dk) console.log('  ✓ ' + thongDiep);
  else { soLoi++; console.log('  ✗ ' + thongDiep); }
}

const mayChu = taoMayChu({ thuMucDuLieu: await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-xe-dl-')), ghiLog: false });
await new Promise(ok => mayChu.listen(0, '127.0.0.1', ok));
const GOC = `http://127.0.0.1:${mayChu.address().port}/`;
const trinhDuyet = await chromium.launch({ args: THAM_SO_TRINH_DUYET });

/** Mở trang như WebView của ứng dụng gốc, với vai trò 'xe' hoặc 'dienthoai'. */
async function moTrangGoc(vaiTro, { rong, cao, tiLe = 1 }) {
  const ctx = await trinhDuyet.newContext({ viewport: { width: rong, height: cao }, deviceScaleFactor: tiLe, locale: 'vi-VN', serviceWorkers: 'allow' });
  await ctx.addInitScript(([vt]) => {
    window.__tin = [];
    window.HawaMapAndroid = {
      guiTin: (loai, du) => window.__tin.push({ loai, du: JSON.parse(du), luc: Date.now() }),
      cauHinh: () => JSON.stringify({ vaiTro: vt, nenTang: 'android' })
    };
    try { localStorage.setItem('hawamap.caidat', JSON.stringify({ tuDongBanDem: false })); } catch (e) { /* bỏ qua */ }
  }, [vaiTro]);
  await giaLapMang(ctx);
  const page = await ctx.newPage();
  const loi = [];
  page.on('pageerror', e => loi.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) loi.push(m.text()); });
  await page.goto(GOC + (vaiTro === 'xe' ? 'index.html?xe=1' : 'index.html'));
  await page.waitForFunction(() => window.__tin.some(t => t.loai === 'sanSang') && window.hawamap.banDo.map.loaded(), null, { timeout: 30000 });
  let id = 0;
  const tin = (loai) => page.evaluate(l => window.__tin.filter(t => t.loai === l).map(t => t.du), loai);
  /** Gửi lệnh như ứng dụng gốc rồi chờ tin "traLoi". */
  const lenh = async (ten, thamSo = {}) => {
    const ma = ++id;
    await page.evaluate(([m, t, ts]) => window.hawamap.goc.lenh(m, t, ts), [ma, ten, thamSo]);
    const h = await page.waitForFunction(m => window.__tin.find(t => t.loai === 'traLoi' && t.du.id === m), ma, { timeout: 20000 });
    const tl = await h.jsonValue();
    if (tl.du.loi) throw new Error(tl.du.loi);
    return tl.du.ketQua;
  };
  const viTri = (p, tocDo = 0, huong = 0) => page.evaluate(([x, y, v, h]) => window.hawamap.goc.viTri(x, y, v, h, 6, Date.now()), [p[0], p[1], tocDo, huong]);
  return { ctx, page, loi, lenh, tin, viTri };
}

try {
  console.log('Màn hình xe (Android Auto / CarPlay)');
  const xe = await moTrangGoc('xe', { rong: 800, cao: 480, tiLe: 1.5 });
  const { page } = xe;
  kiem(await page.evaluate(() => document.body.classList.contains('xe')), 'trang nhận vai trò màn hình xe');
  kiem(await page.evaluate(() => getComputedStyle(document.querySelector('.thanh-tim')).display === 'none'), 'ẩn thanh tìm kiếm của trang (xe tự vẽ)');
  kiem(await page.evaluate(() => !navigator.serviceWorker.controller), 'không đăng ký service worker trong ứng dụng gốc');
  await xe.viTri(A);
  await page.waitForFunction(() => window.hawamap.st.viTri, null, { timeout: 5000 });
  kiem(true, 'nhận vị trí GPS từ ứng dụng gốc');
  kiem(await page.evaluate(() => !document.querySelector('#hud-chinh').hidden), 'hiện đồng hồ tốc độ trên màn hình xe');

  await xe.lenh('le', { tren: 0, duoi: 0, trai: 480, phai: 0, donVi: 'px' });
  kiem(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--xe-trai').trim()) === '320px', 'vùng bị che tính theo px màn hình xe (480 px / tỉ lệ 1,5 = 320)');

  const kq = await xe.lenh('timKiem', { chuoi: 'Nhà hát' });
  kiem(kq.length === 2 && kq[0].ten === 'Nhà hát Lớn Hà Nội' && kq[0].kcChu, 'lệnh timKiem trả kết quả kèm khoảng cách');
  const dm = await xe.lenh('danhMuc');
  kiem(dm.some(d => d.id === 'xang' && d.ten === 'Cây xăng'), 'lệnh danhMuc');
  const gan = await xe.lenh('quanhDay', { danhMuc: 'xang' });
  kiem(gan.length === 2 && gan[0].ten.includes('Petrolimex'), 'lệnh quanhDay (cây xăng)');

  const tuyen = await xe.lenh('xemTruoc', { diem: kq[0] });
  kiem(tuyen.length === 2 && tuyen[0].nhanhNhat && tuyen[1].coThuPhi, 'lệnh xemTruoc trả 2 tuyến (nhanh nhất / có thu phí)');
  kiem(await page.evaluate(() => window.hawamap.banDo.duLieu.tuyen.features.length === 1), 'vẽ tuyến lên bản đồ xe');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ANH, 'xe-01-xem-truoc.png') });
  await xe.lenh('chonTuyen', { i: 1 });
  kiem(await page.evaluate(() => window.hawamap.st.lt.chon) === 1, 'lệnh chonTuyen');
  await xe.lenh('chonTuyen', { i: 0 });

  const tt0 = await xe.lenh('batDau', { moPhong: true });
  kiem(tt0.dangDanDuong && tt0.ke.chiDan === 'Rẽ phải vào Tràng Tiền', 'lệnh batDau trả bước kế tiếp');
  const dongBo = (await xe.tin('batDau'))[0];
  kiem(dongBo && dongBo.tuyen.toaDo.length > 10 && dongBo.tenDen === 'Nhà hát Lớn Hà Nội' && dongBo.moPhong === true, 'gửi tin batDau (tuyến đầy đủ) để đồng bộ sang điện thoại');
  await page.evaluate(() => { window.hawamap.st.moPhong.heSo = 4; });
  await page.waitForFunction(() => window.__tin.some(t => t.loai === 'danDuong' && t.du.canhBao && t.du.canhBao.loai === 'camera') &&
    window.__tin.some(t => t.loai === 'danDuong' && t.du.gioiHan === 30), null, { timeout: 40000 });
  const ds = await xe.tin('danDuong');
  const coCb = ds.find(d => d.canhBao && d.canhBao.loai === 'camera');
  kiem(ds.length > 3 && ds.every(d => d.dangDanDuong), 'gửi trạng thái dẫn đường mỗi lần cập nhật');
  kiem(ds.some(d => d.ke && d.ke.loai === 'turn' && d.ke.huong === 'right' && d.ke.kc > 0 && d.ke.ten === 'Tràng Tiền'), 'trạng thái có loại thao tác, hướng, khoảng cách, tên đường');
  kiem(ds.some(d => d.lanes && d.lanes.length === 3 && d.lanes[2].dung), 'trạng thái có làn đường nên đi');
  kiem(coCb.canhBao.ten === 'Camera phạt tốc độ' && coCb.canhBao.icon === 'cameratocdo' && coCb.canhBao.kc > 0, 'trạng thái có cảnh báo camera phía trước (kèm biểu tượng)');
  kiem(ds.some(d => d.canhBao && d.canhBao.loai === 'gioihan' && d.canhBao.gioiHan === 30), 'trạng thái có cảnh báo giới hạn tốc độ phía trước');
  kiem(ds.some(d => d.gioiHan === 30), 'trạng thái có giới hạn tốc độ');
  kiem(ds.every(d => d.conLaiChu && d.thoiGianChu && d.gioDen > Date.now() - 60000), 'trạng thái có quãng đường / thời gian / giờ đến');
  const noi = await xe.tin('noi');
  kiem(noi.some(n => /Bắt đầu dẫn đường/.test(n.chu)) && noi.some(n => /camera phạt tốc độ/.test(n.chu)), 'câu đọc gửi cho giọng nói của hệ điều hành');
  await page.screenshot({ path: path.join(ANH, 'xe-02-dan-duong.png') });

  const bd = await xe.lenh('banDo', { loai: 'keo', dx: 150, dy: 0, donVi: 'px' });
  kiem(bd.theoDoi === 'khong', 'kéo bản đồ từ màn hình xe thì thôi bám xe');
  kiem((await xe.lenh('banDo', { loai: 'veGiua' })).theoDoi === 'huong', 'nút về giữa bám lại theo hướng đi');
  kiem(await xe.lenh('loa', { bat: false }) === false, 'lệnh tắt giọng nói');
  await xe.lenh('loa', { bat: true });
  const ten = await xe.lenh('baoCao', { loai: 'ketxe' });
  kiem(ten === 'Kẹt xe', 'gửi báo cáo kẹt xe từ màn hình xe');

  await xe.lenh('ketThuc');
  const cuoi = (await xe.tin('danDuong')).at(-1);
  kiem(cuoi.dangDanDuong === false && (await xe.tin('ketThuc')).length === 1, 'kết thúc: báo dangDanDuong = false và tin ketThuc');

  // điện thoại bắt đầu → ứng dụng gốc chuyển tuyến sang màn hình xe
  const soBatDau = (await xe.tin('batDau')).length;
  await page.evaluate(du => window.hawamap.goc.dongBoBatDau(JSON.stringify(du)), { ...dongBo, moPhong: false });
  await xe.viTri([105.85, 21.0262], 10, 0);
  await page.waitForFunction(() => window.hawamap.st.dd && window.hawamap.st.dd.tt, null, { timeout: 5000 });
  kiem(await page.evaluate(() => window.hawamap.st.dd.tuyen.tichLuy.length > 10), 'dongBoBatDau: dẫn đường theo tuyến nhận từ màn hình kia');
  kiem((await xe.tin('batDau')).length === soBatDau, 'dongBoBatDau không gửi lại tin batDau (tránh vòng lặp)');
  await page.evaluate(() => window.hawamap.goc.dongBoKetThuc());
  kiem(await page.evaluate(() => !window.hawamap.st.dd) && (await xe.tin('ketThuc')).length === 1, 'dongBoKetThuc kết thúc mà không gửi lại tin ketThuc');
  await xe.lenh('huyXemTruoc');
  let loiLenh = '';
  try { await xe.lenh('khongCo'); } catch (e) { loiLenh = e.message; }
  kiem(/Không có lệnh/.test(loiLenh), 'lệnh lạ trả lỗi về ứng dụng gốc');
  kiem(xe.loi.length === 0, 'không có lỗi JavaScript (xe)' + (xe.loi.length ? ': ' + xe.loi.join(' | ') : ''));
  await xe.ctx.close();

  console.log('WebView điện thoại trong ứng dụng gốc');
  const dt = await moTrangGoc('dienthoai', { rong: 412, cao: 860, tiLe: 2 });
  kiem(await dt.page.evaluate(() => !document.body.classList.contains('xe') && getComputedStyle(document.querySelector('.thanh-tim')).display !== 'none'), 'giao diện điện thoại đầy đủ');
  await dt.viTri(A, 10, 0);
  await dt.page.waitForFunction(() => window.__tin.some(t => t.loai === 'hud'), null, { timeout: 5000 }).catch(() => {});
  const hud = (await dt.tin('hud')).pop();
  kiem(hud && hud.bat === true && hud.tocDo === 36 && hud.dangDi === true, 'gửi tốc độ cho bong bóng nổi của Android (tin hud)');
  await dt.page.click('.o-tim');
  kiem((await dt.lenh('quayLai')).daXuLy === true && await dt.page.evaluate(() => document.querySelector('#man-tim').hidden), 'nút Back của Android đóng màn hình tìm kiếm');
  kiem((await dt.lenh('quayLai')).daXuLy === false, 'không còn gì để đóng thì để Android xử lý');
  await dt.page.evaluate(() => document.querySelector('[data-hd="nghe-thu"]') || null);
  await dt.page.click('[data-hd="menu"]');
  await dt.page.click('[data-hd="trang-cai-dat"]');
  kiem(await dt.page.locator('input[data-cd="bongBongNoi"]').count() === 1, 'cài đặt bong bóng nổi chỉ có trong ứng dụng Android');
  await dt.page.locator('input[data-cd="bongBongNoi"]').evaluate(el => { el.checked = false; el.dispatchEvent(new Event('change', { bubbles: true })); el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
  kiem((await dt.tin('xinQuyenNoi')).length === 1, 'bật bong bóng nổi thì xin quyền hiển thị trên ứng dụng khác');
  await dt.page.click('[data-hd="nghe-thu"]');
  kiem((await dt.tin('noi')).some(n => n.chu.includes('Trần Phú')), 'nghe thử giọng đọc qua giọng của hệ điều hành');
  await dt.page.evaluate(async () => (await import('./js/giao-dien.js')).taiXuong('thu.gpx', '<gpx/>', 'application/gpx+xml'));
  await dt.page.waitForFunction(() => window.__tin.some(t => t.loai === 'luuTep'), null, { timeout: 5000 });
  const tep = (await dt.tin('luuTep'))[0];
  kiem(tep.ten === 'thu.gpx' && Buffer.from(tep.base64, 'base64').toString() === '<gpx/>', 'lưu tệp GPX qua ứng dụng gốc');
  // liên kết chia sẻ từ ứng dụng khác (Intent VIEW geo: / SEND văn bản) do MainActivity chuyển tới
  await dt.page.click('[data-hd="dong-trang"]');
  const moLk = await dt.lenh('moLienKet', { chuoi: 'geo:21.0287,105.8522?q=21.0287,105.8522(Hồ Gươm)' });
  await dt.page.waitForTimeout(300);
  kiem(moLk === true && (await dt.page.innerText('#tam-duoi')).includes('Hồ Gươm'), 'mở địa điểm từ liên kết geo: do Android chuyển tới');
  kiem(await dt.lenh('moLienKet', { chuoi: 'không có địa điểm nào' }) === false, 'báo lại khi nội dung chia sẻ không có địa điểm');
  await dt.page.click('#tam-duoi [data-hd="dong-tam"]');

  // OBD-II qua bộ chuyển Bluetooth thường (cau/Obd.kt): trang gửi lệnh ELM327 qua obdGui, "Android" trả lời qua goc.obd
  await dt.page.click('[data-hd="menu"]');
  await dt.page.click('#menu [data-hd="trang-obd"]');
  await dt.page.click('[data-hd="obd-ket-noi"]');
  await dt.page.waitForFunction(() => window.__tin.some(t => t.loai === 'obdKetNoi'), null, { timeout: 5000 });
  await dt.page.evaluate(() => {
    const TL = { ATZ: 'ELM327 v1.5', ATE0: 'OK', ATL0: 'OK', ATS0: 'OK', ATH0: 'OK', ATSP0: 'OK', '0100': 'SEARCHING...\r41 00 98 18 80 10',
      '010C': '41 0C 0C 80', '010D': '41 0D 00', '0105': '41 05 82', '0104': '41 04 40', '0111': '41 11 33', ATRV: '12.6V', '0902': 'NO DATA', '03': '43 01 01 71' };
    const cu = window.HawaMapAndroid.guiTin;
    window.HawaMapAndroid.guiTin = (loai, du) => {
      cu(loai, du);
      if (loai !== 'obdGui') return;
      const lenh = JSON.parse(du).chuoi.trim();
      setTimeout(() => window.hawamap.goc.obd('nhan', (TL[lenh] || '?') + '\r\r>'), 5);
    };
    window.hawamap.goc.obd('ketNoi', 'OBDII');
  });
  await dt.page.waitForFunction(() => { const el = document.getElementById('obd-010C'); return el && el.textContent === '800'; }, null, { timeout: 15000 }).catch(() => {});
  kiem(await dt.page.innerText('#obd-010C') === '800' && await dt.page.innerText('#obd-0105') === '90' && await dt.page.innerText('#obd-ATRV') === '12.6',
    'đọc vòng tua, nhiệt độ nước, điện áp ắc quy qua Bluetooth của Android');
  kiem((await dt.page.innerText('.obd-dau')).includes('Đã kết nối · OBDII'), 'hiện trạng thái đã kết nối bộ chuyển');
  await dt.page.click('[data-hd="obd-doc-loi"]');
  await dt.page.waitForSelector('#obd-loi span', { timeout: 5000 }).catch(() => {});
  kiem((await dt.page.innerText('#obd-loi')).includes('P0171'), 'đọc mã lỗi động cơ');
  await dt.page.screenshot({ path: path.join(ANH, 'xe-obd.png') });
  await dt.page.click('[data-hd="obd-ngat"]');
  kiem((await dt.tin('obdNgat')).length === 1 && (await dt.page.innerText('.obd-dau')).includes('Chưa kết nối'), 'ngắt kết nối OBD');
  kiem(dt.loi.length === 0, 'không có lỗi JavaScript (điện thoại)' + (dt.loi.length ? ': ' + dt.loi.join(' | ') : ''));
  await dt.ctx.close();
} catch (e) {
  soLoi++;
  console.error('LỖI:', e);
} finally {
  await trinhDuyet.close();
  mayChu.close();
}
console.log(soLoi ? `${soLoi} kiểm tra KHÔNG đạt` : 'Tất cả kiểm tra cầu nối ứng dụng gốc đều đạt');
process.exit(soLoi ? 1 : 0);
