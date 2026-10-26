// Kiểm thử app Android trên máy ảo (GitHub Actions, .github/workflows/quanlytaisan-android.yml): kết nối máy chủ https
// chứng chỉ tự ký (hỏi mã nhận dạng rồi ghim), đăng nhập trong app, quét kiểm kê bằng camera của app, GPS, tải Excel,
// phím Back, báo cập nhật app. Điều khiển app bằng Playwright (_android: giao diện Android + WebView qua cổng gỡ lỗi).
// Cần bản app gỡ lỗi (GO_LOI=1 ./build-apk.sh) đã cài, máy chủ thử ở 10.0.2.2. Biến môi trường:
//   RA              thư mục ảnh chụp màn hình            MAY_CHU_NHAP  địa chỉ gõ ở màn hình kết nối (10.0.2.2:18443)
//   MA_CHUNG_CHI    mã nhận dạng chứng chỉ mong đợi      APK_MOI       bản app "mới hơn" để thử báo cập nhật
//   THU_MUC_MAY_CHU thư mục chứa QuanLyTaiSan.exe đang chạy (chép APK_MOI vào đó)
const { _android } = require('playwright-core');
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');

const RA = process.env.RA || 'ra';
const GOI = 'vn.com.hawasuco.taisan';
let dev, page, hong = 0, so = 0;

const ngu = ms => new Promise(r => setTimeout(r, ms));
function kiem(dk, ten) {
  console.log((dk ? 'OK  ' : 'SAI ') + ten);
  if (!dk) hong++;
}
async function chup(ten) {
  try { await dev.screenshot({ path: path.join(RA, String(++so).padStart(2, '0') + '-' + ten + '.png') }); } catch (e) { /* bỏ qua */ }
}
async function buoc(ten, fn) {
  console.log('== ' + ten);
  try {
    await fn();
  } catch (e) {
    hong++;
    console.log('SAI ' + ten + ': ' + String((e && e.message) || e).split('\n').slice(0, 3).join(' | '));
    await chup('loi');
  }
}
const back = () => dev.shell('input keyevent 4');

(async () => {
  fs.mkdirSync(RA, { recursive: true });
  [dev] = await _android.devices();
  if (!dev) throw new Error('Không thấy máy ảo Android (adb devices)');
  console.log('Máy ảo:', dev.model(), dev.serial());
  await dev.shell(`pm grant ${GOI} android.permission.CAMERA`);
  await dev.shell(`pm grant ${GOI} android.permission.ACCESS_FINE_LOCATION`);
  await dev.shell(`am start -W -n ${GOI}/.MainActivity`);

  await buoc('màn hình kết nối, chứng chỉ tự ký', async () => {
    await dev.wait({ desc: 'Địa chỉ máy chủ' }, { timeout: 40000 });
    await chup('ket-noi');
    await dev.fill({ desc: 'Địa chỉ máy chủ' }, process.env.MAY_CHU_NHAP || '10.0.2.2:18443');
    await dev.tap({ text: 'Kết nối' });
    await dev.wait({ text: 'Tin cậy máy chủ này?' }, { timeout: 40000 });
    if (process.env.MA_CHUNG_CHI) {
      await dev.wait({ text: process.env.MA_CHUNG_CHI }, { timeout: 5000 });
      kiem(true, 'hộp thoại hiện đúng mã nhận dạng chứng chỉ ' + process.env.MA_CHUNG_CHI);
    }
    await chup('chung-chi');
    await dev.tap({ res: 'android:id/button1' });   // Tin cậy
  });

  await buoc('trang web trong app (https, chứng chỉ đã ghim)', async () => {
    const wv = await dev.webView({ pkg: GOI }, { timeout: 40000 });
    page = await wv.page();
    await page.waitForSelector('#ten', { timeout: 40000 });
    kiem(await page.evaluate(() => location.href).then(u => u.startsWith('https://10.0.2.2:18443/')), 'trang mở qua https://10.0.2.2:18443/');
    const pb = await page.evaluate(() => window.QuanLyTaiSanApp ? window.QuanLyTaiSanApp.phienBan() + ' / ' + window.QuanLyTaiSanApp.maChungChi() : '');
    kiem(pb.length > 0 && (!process.env.MA_CHUNG_CHI || pb.indexOf(process.env.MA_CHUNG_CHI) > 0), 'cầu nối app: phiên bản / mã chứng chỉ = ' + pb);
    await chup('dang-nhap');
    await page.fill('#ten', 'admin');
    await page.fill('#mk', 'matkhau123');
    await page.click('button[type=submit]');
    await page.waitForSelector('.o-so', { timeout: 30000 });
    await ngu(1000);
    await chup('tong-quan');
  });

  await buoc('quét kiểm kê bằng camera của app', async () => {
    await page.evaluate(() => { location.hash = '#/quet?lientuc=1'; });
    await dev.wait({ text: 'Xong', clazz: 'android.widget.Button' }, { timeout: 20000 });
    kiem(true, 'trang Quét kiểm kê → app mở màn hình camera');
    await ngu(5000);
    await chup('quet-camera');
    // cảnh ảo của máy ảo có dán tem QR MB-00002 trên tường (không bắt buộc đọc được)
    const docDuoc = await dev.wait({ text: /MB-00002/ }, { timeout: 15000 }).then(() => true, () => false);
    console.log(docDuoc ? 'OK  camera máy ảo đọc được tem QR MB-00002 trong cảnh ảo' : '--  camera máy ảo chưa đọc được tem trong cảnh ảo (bỏ qua)');
    // như ZXing vừa đọc được tem MB-00001: app chuyển mã cho trang, trang ghi kiểm kê rồi báo lại màn hình quét
    await page.evaluate(() => window.ungDungQuet(location.origin + '/t/MB-00001'));
    await dev.wait({ text: /Đã kiểm kê MB-00001/ }, { timeout: 20000 });
    kiem(true, 'màn hình quét hiện kết quả máy chủ: Đã kiểm kê MB-00001');
    await chup('quet-ket-qua');
    await back();
    await dev.wait({ text: 'Xong', clazz: 'android.widget.Button' }, { state: 'gone', timeout: 10000 });
    const n = await page.$$eval('[data-vuaquet] li', a => a.length);
    kiem(n >= 1, 'Back đóng camera, trang hiện danh sách vừa quét (' + n + ')');
    await ngu(500);
    await chup('sau-quet');
  });

  await buoc('GPS: vị trí hiện tại', async () => {
    try { execFileSync('adb', ['emu', 'geo', 'fix', '105.4701', '9.7845']); } catch (e) { /* máy ảo cũ */ }
    await page.evaluate(() => { location.hash = '#/sua/1'; });
    await page.waitForSelector('[data-gps]', { timeout: 15000 });
    await page.click('[data-gps]');
    await ngu(1500);
    try { execFileSync('adb', ['emu', 'geo', 'fix', '105.4701', '9.7845']); } catch (e) { /* bỏ qua */ }
    await page.waitForFunction(() => /^9\.78\d*, 105\.47/.test(document.querySelector('[data-f="toaDo"]').value), null, { timeout: 25000 });
    kiem(true, 'app lấy GPS: ' + await page.$eval('[data-f="toaDo"]', i => i.value));
  });

  await buoc('tải Excel bằng app', async () => {
    await page.evaluate(() => { location.hash = '#/ds'; });
    await page.waitForSelector('[data-xuat]', { timeout: 15000 });
    await page.click('[data-xuat]');
    await dev.wait({ text: /\.xlsx$/ }, { timeout: 30000 });
    await dev.wait({ text: 'Mở (Excel, WPS Office…)' }, { timeout: 5000 });
    kiem(true, 'tải xong file Excel, hỏi Mở / Chia sẻ / Lưu');
    await chup('tai-excel');
    await back();
  });

  await buoc('phím Back đóng hộp thoại của trang', async () => {
    await page.evaluate(() => { location.hash = '#/khac'; });
    await page.waitForSelector('[data-dx]', { timeout: 15000 });
    await ngu(800);
    await chup('them');
    await page.click('[data-dx]');
    await page.waitForSelector('.hop');
    await back();
    await page.waitForSelector('.hop', { state: 'detached', timeout: 5000 });
    kiem(await page.evaluate(() => location.hash) === '#/khac', 'Back đóng hộp thoại Đăng xuất, vẫn ở trang Thêm');
  });

  await buoc('máy chủ có bản app mới → hỏi cập nhật', async () => {
    if (!process.env.APK_MOI || !process.env.THU_MUC_MAY_CHU) { console.log('--  không có APK_MOI (bỏ qua)'); return; }
    fs.copyFileSync(process.env.APK_MOI, path.join(process.env.THU_MUC_MAY_CHU, 'QuanLyTaiSan-DienThoai.apk'));
    await dev.shell(`am force-stop ${GOI}`);
    await dev.shell(`am start -W -n ${GOI}/.MainActivity`);
    await dev.wait({ text: 'Có bản app mới' }, { timeout: 40000 });
    kiem(true, 'mở app → hỏi cập nhật bản mới trên máy chủ');
    await chup('cap-nhat');
    await dev.tap({ res: 'android:id/button1' });   // Cập nhật
    await dev.wait({ text: /Cho phép cài bản cập nhật|Cần gỡ app cũ/ }, { timeout: 40000 });
    kiem(await dev.wait({ text: 'Cho phép cài bản cập nhật' }, { timeout: 1000 }).then(() => true, () => false),
      'tải bản mới (cùng khoá ký) → xin quyền cài bản cập nhật');
    await chup('cho-phep-cai');
  });

  await dev.close();
  console.log(hong ? hong + ' KIỂM TRA SAI' : 'TẤT CẢ ĐẠT');
  process.exit(hong ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(2);
});
