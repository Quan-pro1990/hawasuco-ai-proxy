/*
 * Kiểm thử giao diện trên trình duyệt Chromium thật (Playwright), các dịch vụ bản đồ được giả lập bằng dữ liệu mẫu.
 * Chạy:  npm run test:e2e      (cần: npm i -D playwright  và  npx playwright install chromium)
 * Ảnh chụp màn hình lưu ở thư mục ANH_KIEM_THU (mặc định: <thư mục tạm>/hawamap-e2e).
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { taoMayChu } from '../../server.js';
import * as mau from '../du-lieu-mau.js';
import { chromium, giaLapMang, THAM_SO_TRINH_DUYET } from './chung.mjs';

const ANH = process.env.ANH_KIEM_THU || path.join(os.tmpdir(), 'hawamap-e2e');
await fs.mkdir(ANH, { recursive: true });
const { A, B, C, D } = mau.DIEM;

// ---------------------------------------------------------------- tiện ích kiểm tra
let soLoi = 0;
function kiem(dk, thongDiep) {
  if (dk) console.log('  ✓ ' + thongDiep);
  else { soLoi++; console.log('  ✗ ' + thongDiep); }
}
const chup = async (page, ten) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(ANH, ten + '.png') }); };

const mayChu = taoMayChu({ thuMucDuLieu: await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-e2e-dl-')), ghiLog: false });
await new Promise(ok => mayChu.listen(0, '127.0.0.1', ok));
const GOC = `http://127.0.0.1:${mayChu.address().port}/`;

const trinhDuyet = await chromium.launch({ args: THAM_SO_TRINH_DUYET });

async function moTrang({ rong = 412, cao = 860 } = {}) {
  const ctx = await trinhDuyet.newContext({
    viewport: { width: rong, height: cao }, deviceScaleFactor: 2, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
    geolocation: { latitude: A[1], longitude: A[0], accuracy: 8 }, permissions: ['geolocation', 'camera', 'microphone'], serviceWorkers: 'block'
  });
  // tắt tự chuyển bản đồ ban đêm để ảnh chụp giống nhau dù chạy lúc nào
  await ctx.addInitScript(() => { try { localStorage.setItem('hawamap.caidat', JSON.stringify({ tuDongBanDem: false })); } catch (e) { /* bỏ qua */ } });
  await giaLapMang(ctx);
  const page = await ctx.newPage();
  const loi = [];
  page.on('pageerror', e => loi.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) loi.push('console: ' + m.text()); });
  await page.goto(GOC);
  await page.waitForFunction(() => window.hawamap && window.hawamap.banDo.map.loaded() && window.hawamap.st.viTri, null, { timeout: 30000 });
  return { ctx, page, loi };
}

try {
  // ============================================================ điện thoại: luồng chính
  console.log('Điện thoại — màn hình chính, tìm kiếm, địa điểm');
  const { ctx, page, loi } = await moTrang();
  await page.waitForTimeout(1500);
  kiem(await page.locator('.chip').count() === 8, 'hiện 8 nút tìm nhanh (cây xăng, ATM…)');
  kiem(await page.locator('.cham-vi-tri').count() === 1, 'hiện chấm vị trí của tôi');
  await chup(page, '01-man-hinh-chinh');

  await page.click('.o-tim');
  await page.waitForSelector('#man-tim:not([hidden]) .luoi-danh-muc');
  await chup(page, '02a-tim-kiem-trong');
  await page.fill('#o-tim', 'Nhà hát');
  await page.waitForSelector('.dong-tim[data-hd="chon-kq"]');
  kiem((await page.locator('.dong-tim[data-hd="chon-kq"]').first().innerText()).includes('Nhà hát Lớn Hà Nội'), 'gợi ý tìm kiếm khi đang gõ');
  await chup(page, '02-tim-kiem');
  await page.locator('.dong-tim[data-hd="chon-kq"]').first().click();
  await page.waitForSelector('#tam-duoi:not([hidden]) .dd-ten h2');
  kiem((await page.innerText('.dd-ten h2')) === 'Nhà hát Lớn Hà Nội', 'mở thông tin địa điểm');
  await page.waitForTimeout(1200);
  await chup(page, '03-dia-diem');
  await page.click('[data-hd="luu-dd"]');
  kiem((await page.innerText('[data-hd="luu-dd"]')).includes('Đã lưu'), 'lưu địa điểm yêu thích');

  console.log('Lộ trình');
  await page.click('[data-hd="chi-duong-den"]');
  await page.waitForSelector('.the-tuyen');
  await page.waitForTimeout(1200);
  kiem(await page.locator('.the-tuyen').count() === 2, 'có 2 tuyến (chính + thay thế)');
  kiem((await page.innerText('.the-tuyen.chon')).includes('Nhanh nhất'), 'tuyến chính gắn nhãn "Nhanh nhất"');
  kiem((await page.locator('.the-tuyen').nth(1).innerText()).includes('Có trạm thu phí'), 'tuyến thay thế báo có trạm thu phí');
  kiem((await page.innerText('#lt-diem')).includes('Vị trí của bạn'), 'điểm xuất phát là vị trí của tôi');
  kiem(await page.locator('.nhan-tuyen').count() === 2, 'nhãn thời gian trên bản đồ cho từng tuyến');
  await chup(page, '04-lo-trinh');
  await page.locator('.the-tuyen').nth(1).click();
  kiem(await page.evaluate(() => window.hawamap.st.lt.chon) === 1, 'chọn tuyến thay thế');
  await page.locator('.the-tuyen').nth(0).click();
  await page.click('[data-hd="doi-xe"][data-xe="xemay"]');
  await page.waitForSelector('.the-tuyen');
  kiem(await page.evaluate(() => window.hawamap.st.lt.phuongTien) === 'xemay', 'đổi phương tiện sang xe máy');
  await page.click('[data-hd="xem-buoc"]');
  await page.waitForSelector('.dong-buoc');
  kiem((await page.locator('.dong-buoc').allInnerTexts()).join('|').includes('Rẽ phải vào Tràng Tiền'), 'danh sách các bước bằng tiếng Việt');
  await chup(page, '05-cac-buoc');
  await page.click('#tam-duoi [data-hd="dong-tam"]');
  await page.waitForSelector('.the-tuyen');

  console.log('Dẫn đường (chạy thử)');
  await page.click('[data-hd="mo-phong"]');
  await page.waitForSelector('#lop-dd:not([hidden]) .br-kc');
  await page.waitForTimeout(2500);
  kiem((await page.innerText('#bang-re')).includes('Tràng Tiền'), 'bảng chỉ hướng: rẽ vào Tràng Tiền');
  kiem(await page.locator('#thanh-dd .tdd-gio').count() === 1, 'thanh dưới: giờ đến, thời gian, quãng đường còn lại');
  kiem(await page.evaluate(() => window.hawamap.banDo.map.getPitch()) > 20, 'bản đồ nghiêng 3D khi dẫn đường');
  await chup(page, '06-dan-duong');
  await page.click('[data-hd="mp-he-so"][data-h="2"]');
  await page.waitForSelector('.br-lan', { timeout: 30000 });
  await chup(page, '06b-lan-duong');
  await page.waitForSelector('#canh-bao-dd:not([hidden])', { timeout: 40000 });
  kiem((await page.innerText('#canh-bao-dd')).includes('Camera'), 'cảnh báo camera tốc độ phía trước');
  await page.waitForFunction(() => document.querySelector('#hud-dd .bien-toc-do b')?.textContent === '30', null, { timeout: 20000 });
  kiem(true, 'biển giới hạn 30 km/h của Tràng Tiền');
  await page.click('[data-hd="mp-toc"][data-d="10"]');
  await page.waitForSelector('#hud-dd .dong-ho.vuot', { timeout: 15000 });
  kiem(true, 'đồng hồ chuyển đỏ khi vượt tốc độ');
  await chup(page, '07-canh-bao-vuot-toc');
  await page.click('#thanh-dd [data-hd="mo-rong-dd"]');
  await page.waitForSelector('.tdd-them');
  await chup(page, '07b-mo-rong');
  await page.click('.tdd-them [data-hd="mo-rong-dd"]').catch(() => page.click('#thanh-dd [data-hd="mo-rong-dd"]'));
  await page.click('[data-hd="mp-he-so"][data-h="4"]');
  await page.waitForSelector('.hop-thoai h3', { timeout: 60000 });
  kiem((await page.innerText('.hop-thoai h3')) === 'Bạn đã đến nơi', 'báo đã đến nơi');
  await chup(page, '08-den-noi');
  await page.click('.hop-thoai .nut.chinh');
  kiem(await page.evaluate(() => window.hawamap.st.cheDo) === 'chinh', 'quay về màn hình chính sau khi đến nơi');

  console.log('Báo cáo giao thông');
  await page.waitForTimeout(800);
  await page.click('#lop-chinh [data-hd="bao-cao"]');
  await page.waitForSelector('.luoi-bao-cao');
  await chup(page, '09-bao-cao');
  await page.click('[data-hd="gui-bc"][data-loai="tainan"]');
  await page.waitForSelector('.thong-bao.hien');
  const ds = await (await fetch(GOC + 'api/bao-cao')).json();
  kiem(ds.baoCao.length === 1 && ds.baoCao[0].loai === 'tainan', 'báo cáo được gửi lên máy chủ');
  const bc = ds.baoCao[0];
  await page.evaluate(([lng, lat]) => { const m = window.hawamap.banDo; m.datTheoDoi('khong'); m.map.jumpTo({ center: [lng, lat + 0.002], zoom: 16, pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } }); }, [bc.lng, bc.lat]);
  await page.waitForTimeout(1500);
  const diem = await page.evaluate(([lng, lat]) => { const p = window.hawamap.banDo.map.project([lng, lat]); return { x: p.x, y: p.y }; }, [bc.lng, bc.lat]);
  await page.mouse.click(diem.x, diem.y);
  await page.waitForSelector('.pbc', { timeout: 5000 }).catch(() => {});
  kiem(await page.locator('.pbc').count() === 1, 'bấm biểu tượng báo cáo trên bản đồ mở thông tin báo cáo');
  kiem((await page.innerText('.pbc')).includes('vừa xong'), 'thời gian báo cáo hiển thị "vừa xong"');
  await chup(page, '10-popup-bao-cao');

  console.log('Cây xăng quanh đây, menu, cài đặt, kiểu bản đồ');
  await page.keyboard.press('Escape');
  await page.click('.chip[data-id="xang"]');
  await page.waitForSelector('.dong-tim[data-hd="chon-dm"]');
  kiem((await page.innerText('#tam-duoi')).includes('Petrolimex'), 'tìm cây xăng quanh đây');
  await page.waitForTimeout(1000);
  await chup(page, '11-cay-xang');
  await page.click('[data-hd="dong-danh-muc"]');
  await page.click('[data-hd="menu"]');
  await page.waitForSelector('#menu:not([hidden])');
  await chup(page, '12-menu');
  await page.click('[data-hd="trang-cai-dat"]');
  await page.waitForSelector('#trang:not([hidden]) .cd-dong');
  await chup(page, '13-cai-dat');
  await page.locator('select[data-cd="kcCanhBaoCamera"]').selectOption('800');
  kiem(await page.evaluate(() => window.hawamap.caiDat.kcCanhBaoCamera) === 800, 'đổi cài đặt khoảng cách báo camera');
  await page.click('[data-hd="dong-trang"]');
  await page.click('[data-hd="menu"]');
  await page.click('[data-hd="trang-da-luu"]');
  kiem((await page.innerText('#than-trang')).includes('Nhà hát Lớn Hà Nội'), 'trang địa điểm đã lưu');
  await page.click('[data-hd="dong-trang"]');
  await page.click('[data-hd="lop-ban-do"]');
  await page.click('[data-hd="doi-kieu"][data-k="bandem"]');
  await page.waitForFunction(() => document.documentElement.dataset.giaoDien === 'toi', null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  kiem(await page.evaluate(() => !!window.hawamap.banDo.map.getLayer('tuyen')), 'đổi kiểu bản đồ vẫn giữ các lớp riêng');
  await chup(page, '14-ban-dem');
  await page.click('[data-hd="doi-kieu"][data-k="tieuchuan"]');
  await page.click('#tam-duoi [data-hd="dong-tam"]');

  console.log('Chế độ lái xe, camera hành trình');
  await page.click('[data-hd="menu"]');
  await page.click('[data-hd="che-do-lai-xe"]');
  await page.waitForTimeout(1500);
  kiem(await page.evaluate(() => document.body.classList.contains('lai-xe')), 'bật chế độ lái xe');
  await chup(page, '15-lai-xe');
  await page.click('[data-hd="thoat-lai-xe"]');
  await page.click('#lop-chinh [data-hd="mo-camera"]');
  await page.waitForSelector('#man-camera:not([hidden])');
  await page.waitForTimeout(1500);
  await page.click('#nut-ghi');
  await page.waitForTimeout(2500);
  await chup(page, '16-camera-hanh-trinh');
  await page.click('#nut-ghi');
  await page.waitForTimeout(800);
  await page.click('[data-hd="ds-doan"]');
  await page.waitForSelector('#than-trang .dong-ds', { timeout: 5000 }).catch(() => {});
  kiem(await page.locator('#than-trang .dong-ds').count() === 1, 'lưu đoạn video camera hành trình');
  await page.click('[data-hd="dong-trang"]');
  await page.click('[data-hd="tat-camera"]');

  kiem(loi.length === 0, 'không có lỗi JavaScript' + (loi.length ? ':\n    ' + loi.join('\n    ') : ''));
  await ctx.close();

  // ============================================================ máy tính: khung bên trái
  console.log('Máy tính');
  const may = await moTrang({ rong: 1366, cao: 820 });
  await may.page.click('.o-tim');
  await may.page.fill('#o-tim', 'Nhà hát');
  await may.page.locator('.dong-tim[data-hd="chon-kq"]').first().click();
  await may.page.click('[data-hd="chi-duong-den"]');
  await may.page.waitForSelector('.the-tuyen');
  await may.page.waitForTimeout(1500);
  const khung = await may.page.locator('#tam-duoi').boundingBox();
  kiem(khung.x < 20 && khung.width <= 410, 'tấm thông tin nằm bên trái trên màn hình rộng');
  await chup(may.page, '17-may-tinh-lo-trinh');
  kiem(may.loi.length === 0, 'không có lỗi JavaScript (máy tính)' + (may.loi.length ? ':\n    ' + may.loi.join('\n    ') : ''));
  await may.ctx.close();
} catch (e) {
  soLoi++;
  console.error('LỖI:', e);
} finally {
  await trinhDuyet.close();
  mayChu.close();
}

console.log(`\nẢnh chụp: ${ANH}`);
console.log(soLoi ? `${soLoi} kiểm tra KHÔNG đạt` : 'Tất cả kiểm tra giao diện đều đạt');
process.exit(soLoi ? 1 : 0);
