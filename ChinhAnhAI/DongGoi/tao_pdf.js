// In hướng dẫn ra PDF khổ A4 (có số trang) bằng Chromium qua Playwright:
//   node tao_pdf.js            → ../PhatHanh/HUONG_DAN.pdf
// Không có Playwright: mở HuongDan/huong_dan.html bằng Chrome / Edge → Ctrl+P → Lưu dưới dạng PDF.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const vao = path.join(__dirname, 'HuongDan', 'huong_dan.html');
  const ra = process.argv[2] || path.join(__dirname, '..', 'PhatHanh', 'HUONG_DAN.pdf');
  const trinhDuyet = await chromium.launch();
  const trang = await trinhDuyet.newPage();
  await trang.goto('file://' + vao, { waitUntil: 'networkidle' });
  await trang.evaluate(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
  await trang.pdf({
    path: ra, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:9px Inter,Segoe UI,sans-serif;color:#8a93a0;padding:0 14mm;display:flex;justify-content:space-between">' +
                    '<span>Chỉnh ảnh AI — Hướng dẫn cài đặt và chỉnh sửa ảnh</span>' +
                    '<span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  await trinhDuyet.close();
  console.log('Đã tạo: ' + ra);
})().catch(e => { console.error(e); process.exit(1); });
