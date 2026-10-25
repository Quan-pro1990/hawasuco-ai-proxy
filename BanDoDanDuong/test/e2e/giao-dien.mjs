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
import { chromium, giaLapMang, THAM_SO_TRINH_DUYET, layMangGia } from './chung.mjs';

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

const THU_MUC_DL = await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-e2e-dl-'));
// bảng phí giả lập (không phải mức phí thật): một trạm trên đường Đinh Lễ của tuyến thứ hai
await fs.writeFile(path.join(THU_MUC_DL, 'phi-cao-toc.json'), JSON.stringify({ capNhat: '2026-10-01', nguon: 'kiểm thử', tram: [{ ten: 'Trạm thử', viTri: [105.8548, 21.0290], phi: [25000, 35000, 45000, 60000, 80000] }] }));
const mayChu = taoMayChu({ thuMucDuLieu: THU_MUC_DL, ghiLog: false, layMang: layMangGia, henGio: false });
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
  // nhận dạng giọng nói giả (Chromium không có máy chủ nhận dạng khi kiểm thử): window.__nghe = { chu } hoặc { loi }
  await ctx.addInitScript(() => {
    window.__nghe = { chu: 'Nhà hát Lớn' };
    window.__soLanNghe = 0;
    class NgheGia {
      start() {
        window.__soLanNghe++;
        const kq = window.__nghe;
        this.hen = setTimeout(() => {
          if (kq.loi) this.onerror && this.onerror({ error: kq.loi });
          else if (kq.chu) this.onresult && this.onresult({ results: [[{ transcript: kq.chu }]] });
          this.onend && this.onend();
        }, kq.cho || 150);
      }
      abort() { clearTimeout(this.hen); this.onerror && this.onerror({ error: 'aborted' }); this.onend && this.onend(); }
      stop() { this.abort(); }
    }
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: NgheGia, configurable: true, writable: true });
    Object.defineProperty(window, 'SpeechRecognition', { value: NgheGia, configurable: true, writable: true });
  });
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

  // chọn vị trí trên bản đồ: kéo bản đồ cho ghim ở giữa trỏ vào chỗ cần chọn
  await page.click('#nut-vi-tri');                         // đang bám theo vị trí: vào chế độ chọn thì phải thôi bám
  await page.click('.o-tim');
  await page.waitForSelector('[data-hd="chon-tren-ban-do"]');
  await page.click('[data-hd="chon-tren-ban-do"]');
  await page.waitForSelector('#chon-ban-do:not([hidden])');
  const tamBd = () => page.evaluate(() => { const c = window.hawamap.banDo.map.getCenter(); return [c.lng, c.lat]; });
  const tamTruoc = await tamBd();
  await page.mouse.move(206, 360);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(206 - i * 12, 360 - i * 8); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(600);
  const tamSau = await tamBd();
  const doiM = Math.hypot((tamSau[0] - tamTruoc[0]) * 104000, (tamSau[1] - tamTruoc[1]) * 111000);
  kiem(doiM > 50 && await page.evaluate(() => window.hawamap.banDo.theoDoi) === 'khong',
    `chọn trên bản đồ: kéo được bản đồ (dời ${Math.round(doiM)} m) và không bị kéo về vị trí GPS`);
  await chup(page, '02b-chon-tren-ban-do');
  await page.click('[data-hd="xac-nhan-chon-bd"]');
  await page.waitForSelector('#tam-duoi:not([hidden]) .dd-ten h2');
  const viTriChon = await page.evaluate(() => window.hawamap.st.diaDiem && window.hawamap.st.diaDiem.viTri);
  kiem(viTriChon && Math.abs(viTriChon[0] - tamSau[0]) < 1e-6 && Math.abs(viTriChon[1] - tamSau[1]) < 1e-6, 'chọn đúng điểm dưới ghim sau khi kéo');
  await page.click('#tam-duoi [data-hd="dong-tam"]').catch(() => {});
  await page.waitForTimeout(400);

  // tìm bằng giọng nói: bấm micro ở màn hình chính → mở ô tìm, điền câu nghe được, hiện gợi ý
  kiem(await page.locator('#lop-chinh .nut-mic').isVisible(), 'hiện nút micro tìm bằng giọng nói');
  await page.click('#lop-chinh .nut-mic');
  kiem(await page.evaluate(() => document.body.classList.contains('dang-nghe') && !document.querySelector('#man-tim').hidden), 'bấm micro: mở ô tìm kiếm, đang nghe');
  await page.waitForSelector('.dong-tim[data-hd="chon-kq"]', { timeout: 5000 }).catch(() => {});
  kiem(await page.inputValue('#o-tim') === 'Nhà hát Lớn' && (await page.locator('.dong-tim[data-hd="chon-kq"]').count()) > 0 &&
    !(await page.evaluate(() => document.body.classList.contains('dang-nghe'))), 'tìm bằng giọng nói: điền câu nghe được và hiện gợi ý');
  await chup(page, '02c-tim-giong-noi');
  await page.evaluate(() => { window.__nghe = { loi: 'not-allowed' }; });
  await page.click('#man-tim .nut-mic');
  await page.waitForFunction(() => /Chưa cho phép dùng micro/.test(document.querySelector('#thong-bao').textContent), null, { timeout: 3000 }).catch(() => {});
  kiem(/Chưa cho phép dùng micro/.test(await page.innerText('#thong-bao')), 'chặn quyền micro: báo rõ cách cho phép');
  await page.evaluate(() => { window.__nghe = { loi: 'no-speech' }; });
  await page.click('#man-tim .nut-mic');
  await page.waitForFunction(() => /Không nghe thấy tiếng nói/.test(document.querySelector('#thong-bao').textContent), null, { timeout: 3000 }).catch(() => {});
  kiem(/Không nghe thấy tiếng nói/.test(await page.innerText('#thong-bao')), 'không nói gì: báo nói lại');
  // bấm micro lần nữa khi đang nghe thì thôi nghe, không báo lỗi
  await page.evaluate(() => { window.__nghe = { chu: 'Hồ Gươm', cho: 3000 }; document.querySelector('#thong-bao').textContent = ''; });
  await page.click('#man-tim .nut-mic');
  await page.click('#man-tim .nut-mic');
  await page.waitForTimeout(300);
  kiem(!(await page.evaluate(() => document.body.classList.contains('dang-nghe'))) && !/Không nghe/.test(await page.innerText('#thong-bao')) &&
    await page.inputValue('#o-tim') === 'Nhà hát Lớn', 'bấm micro lần nữa: thôi nghe');
  await page.click('[data-hd="dong-tim"]');

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
  kiem(/Phí ~ 25\.000 đ/.test(await page.locator('.the-tuyen').nth(1).innerText()), 'tuyến thay thế báo phí trạm thu phí dự kiến (bảng phí)');
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
  const bangRe = await page.innerText('#bang-re');
  kiem(bangRe.includes('Tràng Tiền') && /\b\d+m\b/.test(bangRe), 'bảng chỉ hướng: khoảng cách và tên đường "Tràng Tiền" (' + bangRe.replace(/\s+/g, ' ') + ')');
  kiem(await page.locator('.nhan-re').count() === 1 && /Tràng Tiền/.test(await page.innerText('.nhan-re')), 'nhãn chỗ rẽ "Tràng Tiền" trên bản đồ');
  kiem(await page.locator('#thanh-dd .tdd-gio').count() === 1, 'thanh dưới: giờ đến, thời gian, quãng đường còn lại');
  const tdd = await page.innerText('#thanh-dd');
  kiem(/km · \d+ phút/.test(tdd) && /đến nơi/.test(tdd) && await page.locator('.day-dd [data-hd="tong-quan"]').count() === 1,
    'thanh dưới: "… km · … phút / … đến nơi", nút toàn tuyến (' + tdd.replace(/\s+/g, ' ') + ')');
  await page.waitForFunction(() => /Hàng Bài/.test(document.querySelector('#vien-duong').innerText), null, { timeout: 10000 }).catch(() => {});
  const vien = await page.innerText('#vien-duong');
  kiem(/Hàng Bài/.test(vien) && /P\. Tràng Tiền, TP\. Hà Nội/.test(vien), 'viên tên đường đang đi và khu vực (' + vien.replace(/\s+/g, ' ') + ')');
  kiem(await page.evaluate(() => window.hawamap.banDo.map.getPitch()) > 20, 'bản đồ nghiêng 3D khi dẫn đường');
  await page.waitForFunction(() => /tiếp theo 30/.test(document.querySelector('#hud-dd .cot-cb')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
  const ghTiep = await page.innerText('#hud-dd .cot-cb').catch(() => '');
  kiem(/tiếp theo 30/.test(ghTiep) && /\d+ m/.test(ghTiep), 'cột cảnh báo: giới hạn tốc độ kế tiếp 30 km/h kèm khoảng cách (' + ghTiep.replace(/\s+/g, ' ') + ')');
  await page.click('#nut-3d');
  await page.waitForFunction(() => window.hawamap.banDo.map.getPitch() < 3, null, { timeout: 8000 }).catch(() => {});
  kiem(await page.evaluate(() => window.hawamap.banDo.map.getPitch()) < 3 && (await page.innerText('#nut-3d')) === '2D', 'nút 2D / 3D: chuyển sang bản đồ phẳng');
  await page.click('#nut-3d');
  await page.waitForFunction(() => window.hawamap.banDo.map.getPitch() > 50, null, { timeout: 8000 }).catch(() => {});
  kiem(await page.evaluate(() => window.hawamap.banDo.map.getPitch()) > 50, 'nút 2D / 3D: trở lại bản đồ nghiêng 3D');
  await chup(page, '06-dan-duong');
  // tạm dừng chạy thử để xe không tới nơi trong lúc xem toàn tuyến
  await page.click('[data-hd="mp-dung"]');
  await page.click('.day-dd [data-hd="tong-quan"]');
  await page.waitForSelector('#nut-ve-giua:not([hidden])');
  kiem((await page.innerText('#nut-ve-giua')).trim() === 'Về giữa', 'xem toàn tuyến: hiện nút "Về giữa"');
  await page.waitForTimeout(1000);
  await chup(page, '06c-ve-giua');
  await page.click('#nut-ve-giua');
  kiem(await page.locator('#nut-ve-giua').isHidden(), 'bấm "Về giữa": bản đồ bám theo xe trở lại');
  await page.click('[data-hd="mp-dung"]');
  await page.click('[data-hd="mp-he-so"][data-h="2"]');
  await page.waitForSelector('.br-lan', { timeout: 30000 });
  await chup(page, '06b-lan-duong');
  await page.waitForSelector('#hud-dd .cot-cb', { timeout: 40000 });
  const theDau = await page.innerText('#hud-dd .cot-cb');
  kiem(/giới hạn tốc độ/i.test(theDau) && /30/.test(theDau), 'báo trước giới hạn 30 km/h của đường phía trước');
  await page.waitForFunction(() => /Camera/.test(document.querySelector('#hud-dd .cot-cb')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
  kiem((await page.innerText('#hud-dd .cot-cb').catch(() => '')).includes('Camera phạt tốc độ'), 'cột cảnh báo: camera phạt tốc độ phía trước kèm số mét');
  await page.waitForFunction(() => document.querySelector('#hud-dd .bien-toc-do b')?.textContent === '30', null, { timeout: 20000 });
  kiem(true, 'biển giới hạn 30 km/h của Tràng Tiền');
  await page.click('[data-hd="mp-toc"][data-d="10"]');
  await page.waitForSelector('#hud-dd .dong-ho.vuot', { timeout: 15000 });
  kiem(true, 'đồng hồ chuyển đỏ khi vượt tốc độ');
  await chup(page, '07-canh-bao-vuot-toc');
  await page.click('[data-hd="mp-dung"]');               // tạm dừng chạy thử khi thao tác trên thanh dưới
  await page.click('#thanh-dd [data-hd="mo-rong-dd"]');
  await page.waitForSelector('.tdd-them');
  await chup(page, '07b-mo-rong');
  await page.click('.tdd-them [data-hd="mo-rong-dd"]').catch(() => page.click('#thanh-dd [data-hd="mo-rong-dd"]'));
  await page.click('[data-hd="mp-dung"]');
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
  // chờ biểu tượng báo cáo đã vẽ đúng chỗ sẽ chạm (bản đồ có thể đang vẽ lại sau khi tải báo cáo quanh vùng mới)
  await page.waitForFunction(([x, y]) => window.hawamap.banDo.map.queryRenderedFeatures([x, y], { layers: ['bao-cao'] }).length > 0, [diem.x, diem.y], { timeout: 5000 }).catch(() => {});
  await page.mouse.click(diem.x, diem.y);
  await page.waitForSelector('.pbc', { timeout: 5000 }).catch(() => {});
  kiem(await page.locator('.pbc').count() === 1, 'bấm biểu tượng báo cáo trên bản đồ mở thông tin báo cáo');
  kiem((await page.innerText('.pbc')).includes('vừa xong'), 'thời gian báo cáo hiển thị "vừa xong"');
  await chup(page, '10-popup-bao-cao');
  await page.keyboard.press('Escape');
  await page.click('#lop-chinh [data-hd="bao-cao"]');
  await page.click('[data-hd="gui-bc"][data-loai="camera"]');
  await page.waitForSelector('[data-hd="gui-bc"][data-phu="dendo"]');
  await chup(page, '10b-loai-camera');
  await page.click('[data-hd="gui-bc"][data-phu="dendo"]');
  await page.waitForSelector('.thong-bao.hien');
  const ds2 = await (await fetch(GOC + 'api/bao-cao')).json();
  kiem(ds2.baoCao.some(b => b.loai === 'camera' && b.phu === 'dendo'), 'báo cáo camera phạt đèn đỏ (chọn loại camera)');
  // báo cáo biển báo: chọn biển (hình biển thật), máy chủ ghi kèm biển, bản đồ vẽ hình biển
  await page.waitForTimeout(400);
  await page.click('#lop-chinh [data-hd="bao-cao"]');
  await page.click('[data-hd="gui-bc"][data-loai="bienbao"]');
  await page.waitForSelector('[data-hd="gui-bc"][data-phu="tocdo50"]');
  kiem(await page.locator('.ds-lua-chon .dt-icon.bien svg').count() >= 20, 'chọn biển báo: danh sách có hình biển thật');
  await chup(page, '10c-bao-cao-bien-bao');
  await page.click('[data-hd="gui-bc"][data-phu="tocdo50"]');
  await page.waitForSelector('.thong-bao.hien');
  const ds3 = await (await fetch(GOC + 'api/bao-cao')).json();
  kiem(ds3.baoCao.some(b => b.loai === 'bienbao' && b.phu === 'tocdo50'), 'báo cáo biển báo được gửi lên máy chủ (biển tốc độ 50)');
  await page.waitForFunction(() => window.hawamap.banDo.map.hasImage('cb-bs-tocdo-50'), null, { timeout: 5000 }).catch(() => {});
  kiem(await page.evaluate(() => window.hawamap.banDo.map.hasImage('cb-bs-tocdo-50') &&
    window.hawamap.banDo.duLieu['bao-cao'].features.some(f => f.properties.anh === 'cb-bs-tocdo-50')), 'biển cộng đồng báo vẽ bằng hình biển trên bản đồ');
  const thieuPhu = await fetch(GOC + 'api/bao-cao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loai: 'bienbao', lng: 105.85, lat: 21.03, thietBi: 'thu' }) });
  kiem(thieuPhu.status === 400, 'máy chủ từ chối báo cáo biển báo không nói rõ biển nào');

  console.log('Liên kết Google Maps');
  await page.keyboard.press('Escape');
  await page.click('.o-tim');
  await page.fill('#o-tim', 'https://www.google.com/maps/place/H%E1%BB%93+G%C6%B0%C6%A1m/@21.03,105.85,17z/data=!4m2!3d21.0287!4d105.8522');
  await page.waitForFunction(() => /Hồ Gươm/.test(document.querySelector('#tam-duoi').innerText), null, { timeout: 5000 }).catch(() => {});
  kiem((await page.innerText('#tam-duoi')).includes('Hồ Gươm') && await page.locator('#man-tim').isHidden(), 'dán liên kết Google Maps vào ô tìm kiếm mở đúng địa điểm');
  kiem(await page.evaluate(() => JSON.stringify(window.hawamap.st.diaDiem.viTri)) === '[105.8522,21.0287]', 'lấy toạ độ của địa điểm trong liên kết');
  await chup(page, '10c-lien-ket-google');
  await page.click('#tam-duoi [data-hd="dong-tam"]');

  console.log('Cây xăng quanh đây, menu, cài đặt, kiểu bản đồ');
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
  kiem(await page.locator('input[data-cd="bongBongNoi"]').count() === 0, 'trên web không có cài đặt bong bóng nổi (chỉ ứng dụng Android)');
  await page.locator('select[data-muc="dentinhieu"]').selectOption('2');
  kiem(await page.evaluate(() => window.hawamap.caiDat.mucCanhBao.dentinhieu) === 2, 'bật cảnh báo đèn tín hiệu (mức từng loại cảnh báo)');
  await page.locator('select[data-muc="dentinhieu"]').scrollIntoViewIfNeeded();
  await chup(page, '13b-tung-loai-canh-bao');
  await page.click('[data-hd="dong-trang"]');
  await page.click('[data-hd="menu"]');
  await page.click('[data-hd="trang-da-luu"]');
  kiem((await page.innerText('#than-trang')).includes('Nhà hát Lớn Hà Nội'), 'trang địa điểm đã lưu');
  await page.click('[data-hd="dong-trang"]');
  kiem(await page.evaluate(() => window.hawamap.banDo.map.getPaintProperty('nen', 'background-color')) === '#f4f3f0' &&
    JSON.stringify(await page.evaluate(() => window.hawamap.banDo.map.getLayoutProperty('poi_r1', 'icon-image'))).includes('gm-anuong'),
    'bản đồ mặc định tô màu như Google Maps, biểu tượng địa điểm màu theo nhóm');
  await page.click('[data-hd="lop-ban-do"]');
  const tenKieu = await page.$$eval('.luoi-kieu button', ds => ds.map(b => b.textContent.trim()));
  kiem(tenKieu.join(',') === 'Mặc định,Vệ tinh,Địa hình,Ban đêm' && await page.locator('.luoi-kieu .anh-kieu svg').count() === 4,
    'bảng loại bản đồ có ảnh xem trước (' + tenKieu.join(', ') + ')');
  await chup(page, '13c-lop-ban-do');
  const nha3D = await page.evaluate(() => window.hawamap.caiDat.nha3D);
  await page.click('.o-ct:has(input[data-cd="nha3D"])');
  kiem(await page.evaluate(() => window.hawamap.caiDat.nha3D) === !nha3D, 'ô "Nhà 3D" trong Chi tiết bản đồ bật / tắt được');
  await page.click('.o-ct:has(input[data-cd="nha3D"])');
  await page.click('[data-hd="doi-kieu"][data-k="diahinh"]');
  await page.waitForFunction(() => !!window.hawamap.banDo.map.getLayer('dia-hinh'), null, { timeout: 10000 }).catch(() => {});
  kiem(await page.evaluate(() => { const m = window.hawamap.banDo.map, ids = m.getStyle().layers.map(l => l.id); return ids.indexOf('dia-hinh') === ids.indexOf('water') - 1 && !!m.getLayer('tuyen'); }),
    'kiểu Địa hình: bóng đồi núi dưới mặt nước, giữ các lớp riêng');
  await page.click('[data-hd="doi-kieu"][data-k="bandem"]');
  await page.waitForFunction(() => document.documentElement.dataset.giaoDien === 'toi', null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  kiem(await page.evaluate(() => !!window.hawamap.banDo.map.getLayer('tuyen')), 'đổi kiểu bản đồ vẫn giữ các lớp riêng');
  await chup(page, '14-ban-dem');

  console.log('Bản đồ offline');
  await page.click('[data-hd="doi-kieu"][data-k="vetinh"]');
  await page.click('#tam-duoi [data-hd="dong-tam"]');
  await page.waitForTimeout(1500);
  const lopVt = await page.evaluate(() => window.hawamap.banDo.map.getStyle().layers.map(l => l.id));
  kiem(lopVt[0] === 've-tinh' && lopVt.includes('highway-name-major') && lopVt.includes('road_primary') && !lopVt.includes('nen') && lopVt.includes('tuyen'),
    'bản đồ vệ tinh lai: ảnh vệ tinh + đường, tên đường của bản đồ thường, giữ các lớp riêng (' + lopVt.slice(0, 4).join(', ') + '…)');
  kiem(await page.evaluate(() => window.hawamap.banDo.map.getPaintProperty('highway-name-major', 'text-color')) === '#ffffff', 'tên đường trên ảnh vệ tinh chữ trắng viền tối');
  await chup(page, '14a-ve-tinh');
  await page.evaluate(() => { const m = window.hawamap.banDo; m.datTheoDoi('khong'); m.map.jumpTo({ center: [105.8522, 21.0287], zoom: 15 }); });
  await page.waitForTimeout(800);
  await page.click('[data-hd="menu"]');
  await page.click('#menu [data-hd="trang-offline"]');
  await page.waitForSelector('#muc-offline');
  await page.locator('#muc-offline').selectOption('tongquat');
  await page.waitForSelector('[data-hd="tai-offline"]:not([disabled])', { timeout: 5000 }).catch(() => {});
  await chup(page, '14b-ban-do-offline');
  await page.click('[data-hd="tai-offline"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('hawamap.vungtai') || '[]').length === 1, null, { timeout: 20000 }).catch(() => {});
  const vung = await page.evaluate(() => JSON.parse(localStorage.getItem('hawamap.vungtai') || '[]'));
  kiem(vung.length === 1 && vung[0].soO > 3 && vung[0].kieu === 'vetinh', 'tải vùng bản đồ offline (' + (vung[0] ? vung[0].soO + ' ô' : 'không có') + ')');
  const soODaLuu = await page.evaluate(async () => (await (await caches.open('hawamap-ban-do-tai')).keys()).length);
  kiem(vung[0] && soODaLuu === vung[0].soO, 'ô bản đồ nằm trong bộ nhớ đệm offline (' + soODaLuu + ')');
  await page.waitForSelector('[data-hd="xoa-offline"]', { timeout: 5000 }).catch(() => {});
  await chup(page, '14c-vung-da-tai');
  await page.click('[data-hd="dong-trang"]');
  await page.click('[data-hd="lop-ban-do"]');
  await page.click('[data-hd="doi-kieu"][data-k="tieuchuan"]');
  await page.click('#tam-duoi [data-hd="dong-tam"]');
  await page.waitForTimeout(1200);
  // biển báo Việt Nam vẽ như biển thật trên bản đồ, biển ghi số (tốc độ, chiều cao) tạo ảnh khi gặp
  const coAnhBien = await page.evaluate(async () => {
    const b = window.hawamap.banDo;
    b.map.jumpTo({ center: [105.8522, 21.0287], zoom: 17, pitch: 0, bearing: 0 });
    await b.datDiemCanhBao([
      { id: 't1', viTri: [105.8515, 21.0289], icon: 'bs-tocdo-40' }, { id: 't2', viTri: [105.8520, 21.0289], icon: 'w-dibo' },
      { id: 't3', viTri: [105.8525, 21.0289], icon: 'stop' }, { id: 't4', viTri: [105.8530, 21.0289], icon: 'bs-cao-3.5' },
      { id: 't5', viTri: [105.8515, 21.0284], icon: 'nhuong' }, { id: 't6', viTri: [105.8520, 21.0284], icon: 'camquaydau' },
      { id: 't7', viTri: [105.8525, 21.0284], icon: 'w-congtruong' }, { id: 't8', viTri: [105.8530, 21.0284], icon: 'camcoi' }
    ]);
    return ['cb-bs-tocdo-40', 'cb-bs-cao-3.5', 'cb-w-dibo', 'cb-stop', 'cb-nhuong', 'cb-camcoi'].every(k => b.map.hasImage(k));
  });
  kiem(coAnhBien, 'biển báo trên bản đồ: biển tốc độ / chiều cao ghi số, biển nguy hiểm, STOP, cấm còi');
  await page.waitForTimeout(800);
  await chup(page, '14d-bien-bao');

  console.log('Bản đồ VietMap (khoá API của người dùng), liên kết VietMap Live');
  const datKhoa = async khoa => {
    await page.click('[data-hd="menu"]');
    await page.click('#menu [data-hd="trang-cai-dat"]');
    await page.locator('input[data-cd="khoaVietmap"]').fill(khoa);
    await page.locator('input[data-cd="khoaVietmap"]').dispatchEvent('change');
    await page.click('[data-hd="dong-trang"]');
  };
  await datKhoa('khoa-thu');
  await page.click('[data-hd="lop-ban-do"]');
  const tenKieuVm = await page.$$eval('.luoi-kieu button', ds => ds.map(b => b.textContent.trim()));
  kiem(['VietMap', 'VietMap tối', 'VietMap vệ tinh'].every(t => tenKieuVm.includes(t)), 'có khoá VietMap: bảng loại bản đồ thêm bản đồ VietMap (' + tenKieuVm.join(', ') + ')');
  const yeuCauVm = page.waitForRequest(r => /maps\.vietmap\.vn\/maps\/styles\/tm\/style\.json\?apikey=khoa-thu/.test(r.url()), { timeout: 10000 }).catch(() => null);
  await page.click('[data-hd="doi-kieu"][data-k="vietmap"]');
  kiem(!!(await yeuCauVm), 'chọn VietMap: tải kiểu bản đồ chính thức của VietMap Maps API bằng khoá của người dùng');
  await page.waitForFunction(() => window.hawamap.banDo.map.isStyleLoaded() && !!window.hawamap.banDo.map.getLayer('tuyen'), null, { timeout: 10000 }).catch(() => {});
  kiem(await page.evaluate(() => window.hawamap.banDo.kieu === 'vietmap' && !!window.hawamap.banDo.map.getLayer('tuyen')), 'bản đồ VietMap hiện, giữ các lớp riêng');
  await page.click('#tam-duoi [data-hd="dong-tam"]').catch(() => {});
  // khoá bị từ chối: báo rõ, quay về bản đồ mặc định
  await datKhoa('sai');
  await page.waitForFunction(() => /Khoá VietMap Maps API không dùng được/.test(document.querySelector('#thong-bao').textContent), null, { timeout: 10000 }).catch(() => {});
  kiem(/Khoá VietMap Maps API không dùng được/.test(await page.innerText('#thong-bao')) && await page.evaluate(() => window.hawamap.caiDat.kieuBanDo) === 'tieuchuan',
    'khoá VietMap bị từ chối: báo rõ và quay về bản đồ mặc định');
  await datKhoa('');
  // dán liên kết VietMap Live vào ô tìm kiếm: mở đúng chỗ
  await page.click('.o-tim');
  await page.fill('#o-tim', 'https://tools.vietmap.vn/live/?cp=21.0287%2C105.8522&z=14.50');
  await page.press('#o-tim', 'Enter');
  await page.waitForSelector('#tam-duoi:not([hidden]) .dd-ten h2', { timeout: 10000 }).catch(() => {});
  const vtVm = await page.evaluate(() => window.hawamap.st.diaDiem && window.hawamap.st.diaDiem.viTri);
  kiem(vtVm && Math.abs(vtVm[0] - 105.8522) < 1e-6 && Math.abs(vtVm[1] - 21.0287) < 1e-6, 'dán liên kết VietMap Live mở đúng toạ độ');
  await page.click('#tam-duoi [data-hd="dong-tam"]').catch(() => {});

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
  // xe bắt đầu chạy (vị trí từ ứng dụng gốc / GPS, 36 km/h): camera tự ghi
  await page.evaluate(() => window.hawamap.goc.viTri(105.8500, 21.0262, 10, 0, 5, Date.now()));
  await page.waitForTimeout(300);
  kiem(await page.evaluate(() => document.querySelector('#nut-ghi').classList.contains('dang-ghi')), 'camera tự ghi khi xe chạy trên 5 km/h');
  await page.waitForTimeout(2500);
  await chup(page, '16-camera-hanh-trinh');
  await page.click('[data-hd="chup-anh"]');
  await page.waitForTimeout(600);
  await page.click('#nut-ghi');
  await page.waitForTimeout(800);
  await page.click('[data-hd="ds-doan"]');
  await page.waitForFunction(() => document.querySelector('#tieu-de-trang').textContent.includes('Video camera'), null, { timeout: 5000 }).catch(() => {});
  const dsDoan = await page.locator('#than-trang .dong-ds').allInnerTexts();
  kiem(dsDoan.length === 2 && dsDoan.some(x => x.includes('Ảnh')), 'lưu đoạn video và ảnh chụp camera hành trình (' + dsDoan.join(' / ').replace(/\s+/g, ' ') + ')');
  await chup(page, '16b-danh-sach-video');
  await page.click('[data-hd="dong-trang"]');
  await page.click('[data-hd="tat-camera"]');

  console.log('HUD kính lái');
  await page.click('[data-hd="menu"]');
  await page.click('[data-hd="mo-hud"]');
  await page.waitForSelector('#man-hud:not([hidden]) .hn-toc');
  kiem(await page.getAttribute('#man-hud', 'data-lat') === 'doc', 'HUD kính lái mặc định lật dọc để phản chiếu lên kính');
  const bienHud = await page.evaluate(() => getComputedStyle(document.querySelector('.hud-noi')).transform);
  kiem(bienHud.startsWith('matrix(1, 0, 0, -1'), 'nội dung HUD được lật gương (' + bienHud + ')');
  await chup(page, '17-hud');
  await page.click('#man-hud');
  await page.click('#nut-hud-lat');
  kiem(await page.evaluate(() => window.hawamap.caiDat.latHud) === 'ngang', 'đổi kiểu lật HUD');
  await page.keyboard.press('Escape');
  kiem(await page.locator('#man-hud').isHidden(), 'thoát HUD bằng phím Esc / nút Back');

  kiem(loi.length === 0, 'không có lỗi JavaScript' + (loi.length ? ':\n    ' + loi.join('\n    ') : ''));
  await ctx.close();

  // ============================================================ máy tính: khung bên trái
  console.log('Máy tính, dẫn đường thông minh, phí trạm thu phí');
  // có người báo kẹt xe trên Tràng Tiền (chỉ tuyến thứ nhất đi qua)
  await fetch(GOC + 'api/bao-cao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loai: 'ketxe', lng: 105.8524, lat: 21.0304, thietBi: 'may-khac' }) });
  const may = await moTrang({ rong: 1366, cao: 820 });
  await may.page.waitForTimeout(800);
  await may.page.click('.o-tim');
  await may.page.fill('#o-tim', 'Nhà hát');
  await may.page.locator('.dong-tim[data-hd="chon-kq"]').first().click();
  await may.page.click('[data-hd="chi-duong-den"]');
  await may.page.waitForSelector('.the-tuyen');
  await may.page.waitForTimeout(1500);
  const theTuyen = await may.page.locator('.the-tuyen').allInnerTexts();
  kiem(/Tránh kẹt xe/.test(theTuyen[0]) && /Đinh Lễ/.test(theTuyen[0]), 'ưu tiên tuyến tránh kẹt xe theo báo cáo (' + theTuyen[0].replace(/\s+/g, ' ') + ')');
  kiem(theTuyen.some(t => /Kẹt xe trên tuyến/.test(t)), 'thẻ tuyến có kẹt xe ghi rõ báo cáo trên tuyến');
  kiem(/Phí ~ 25\.000 đ/.test(theTuyen[0]), 'thẻ tuyến hiện phí dự kiến của trạm thu phí trên tuyến');
  const khung = await may.page.locator('#tam-duoi').boundingBox();
  kiem(khung.x < 20 && khung.width <= 410, 'tấm thông tin nằm bên trái trên màn hình rộng');
  await chup(may.page, '17-may-tinh-lo-trinh');
  // đang dẫn đường (chạy thử) theo Đinh Lễ thì có người báo cấm đường phía trước: gợi ý đổi sang đường khác
  await may.page.click('[data-hd="mo-phong"]');
  await may.page.waitForSelector('#lop-dd:not([hidden]) .br-kc');
  await fetch(GOC + 'api/bao-cao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loai: 'camduong', lng: 105.8548, lat: 21.0300, thietBi: 'may-khac-2' }) });
  await may.page.evaluate(async () => { await window.hawamap.chayNgay.baoCao(); await window.hawamap.chayNgay.doiTuyen(); });
  await may.page.waitForSelector('#goi-y-tuyen:not([hidden])', { timeout: 10000 }).catch(() => {});
  const goiY = await may.page.innerText('#goi-y-tuyen').catch(() => '');
  kiem(/Phía trước có đường bị cấm/.test(goiY) && /nhanh hơn khoảng \d+ phút/.test(goiY), 'gợi ý đổi đường khi có báo cáo cấm đường phía trước (' + goiY.replace(/\s+/g, ' ') + ')');
  await chup(may.page, '17b-goi-y-doi-duong');
  await may.page.click('[data-hd="doi-tuyen-goi-y"]').catch(() => {});
  kiem(await may.page.evaluate(() => window.hawamap.st.dd && /Tràng Tiền/.test(window.hawamap.st.dd.tuyen.duongChinh)), 'bấm "Đổi đường" thì dẫn theo tuyến mới');
  await may.page.evaluate(() => document.querySelector('#menu [data-hd="trang-du-lieu"]').click());
  await may.page.waitForSelector('[data-hd="cap-nhat-du-lieu"]');
  const trangDl = await may.page.innerText('#than-trang');
  kiem(/[1-9]\d* khu vực/.test(trangDl) && /1 trạm/.test(trangDl), 'trang dữ liệu giao thông: dữ liệu khu vực và bảng phí trong máy');
  const dongNgay = trangDl.split('\n').find(d => d.includes('OpenStreetMap ngày')) || 'không có ngày';
  kiem(/bản đồ nền/i.test(trangDl) && /OpenStreetMap ngày 22\/10\/2025/.test(trangDl), 'trang dữ liệu: ngày dữ liệu bản đồ nền (' + dongNgay.trim() + ')');
  await may.page.click('[data-hd="lam-moi-ban-do"]');
  await may.page.waitForFunction(() => /Đã tải bản đồ nền mới nhất/.test(document.querySelector('#thong-bao').textContent), null, { timeout: 15000 }).catch(() => {});
  kiem(/Đã tải bản đồ nền mới nhất \(dữ liệu ngày 22\/10\/2025\)/.test(await may.page.innerText('#thong-bao')), 'bấm "Tải lại bản đồ nền mới nhất"');
  kiem(await may.page.evaluate(() => !!window.hawamap.banDo.map.getLayer('tuyen')), 'tải lại bản đồ nền vẫn giữ các lớp riêng');
  await may.page.click('[data-hd="cap-nhat-du-lieu"]');
  await may.page.waitForFunction(() => /Đã cập nhật dữ liệu giao thông/.test(document.querySelector('#thong-bao').textContent), null, { timeout: 15000 }).catch(() => {});
  kiem(/Đã cập nhật dữ liệu giao thông/.test(await may.page.innerText('#thong-bao')), 'bấm "Cập nhật ngay" tải lại dữ liệu giao thông');
  await chup(may.page, '18-du-lieu-giao-thong');
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
