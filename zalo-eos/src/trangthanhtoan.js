'use strict';
// Trang thanh toán khách mở từ tin Zalo (/tt/<khoá>): hoá đơn cần trả, nút Ví MoMo / ZaloPay / VNPAY, mã QR chuyển khoản.
// Viết thẳng HTML, không tải gì từ bên ngoài, hiển thị tốt trong trình duyệt của Zalo trên điện thoại.
const { tienVn } = require('./tienich');

const MO_TA_CONG = {
  momo: 'Thanh toán bằng ví MoMo',
  zalopay: 'Thanh toán bằng ví ZaloPay',
  vnpay: 'App ngân hàng, thẻ ATM, VNPAY-QR',
};

const THONG_BAO = {
  ok: ['tot', 'Thanh toán thành công. OA sẽ nhắn xác nhận qua Zalo. Cảm ơn quý khách!'],
  cho: ['cho', 'Đang chờ cổng thanh toán xác nhận. OA sẽ nhắn qua Zalo khi có kết quả.'],
  loi: ['loi', 'Thanh toán chưa thành công hoặc đã huỷ. Quý khách có thể thử lại.'],
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const CSS = `
:root{--nen:#f4f6f8;--the:#fff;--chu:#1b2430;--phu:#5b6675;--vien:#dde2e8;--nhan:#0b6bcb;--tot:#137a3f;--tot-nen:#e6f4ea;
--cho:#8a5a00;--cho-nen:#fff4dc;--loi:#b42318;--loi-nen:#fdecea}
@media (prefers-color-scheme:dark){:root{--nen:#12161b;--the:#1c2229;--chu:#e8ecf1;--phu:#a3adba;--vien:#2e3742;--nhan:#5aa9ff;
--tot:#6fd39a;--tot-nen:#173324;--cho:#f2c46b;--cho-nen:#3a2e12;--loi:#ff8a80;--loi-nen:#3d1d1a}}
*{box-sizing:border-box}body{margin:0;background:var(--nen);color:var(--chu);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:480px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:8px 0 2px}.cty{color:var(--phu);margin:0 0 16px;font-size:14px}
.the{background:var(--the);border:1px solid var(--vien);border-radius:12px;padding:16px;margin-bottom:16px}
.dong{display:flex;justify-content:space-between;gap:12px;padding:4px 0}.dong span:first-child{color:var(--phu);flex:none}
.dong>:last-child{text-align:right}
.tong{border-top:1px solid var(--vien);margin-top:8px;padding-top:10px;font-weight:700;font-size:18px}
.tb{border-radius:10px;padding:12px 14px;margin-bottom:16px}
.tb.tot{background:var(--tot-nen);color:var(--tot)}.tb.cho{background:var(--cho-nen);color:var(--cho)}.tb.loi{background:var(--loi-nen);color:var(--loi)}
h2{font-size:16px;margin:0 0 12px}
form{margin:0 0 10px}button{width:100%;min-height:52px;border:1px solid var(--vien);border-radius:10px;background:var(--the);
color:var(--chu);font:inherit;text-align:left;padding:10px 14px;cursor:pointer}
button b{display:block;font-size:17px}button small{color:var(--phu)}button:active{border-color:var(--nhan)}
.qr{display:block;width:240px;max-width:100%;margin:4px auto 12px;background:#fff;border-radius:8px;image-rendering:pixelated}
.ghi{color:var(--phu);font-size:14px;margin:8px 0 0}code{font-weight:700;font-size:15px;word-break:break-all}`;

/**
 * yc: yêu cầu thanh toán (ThanhToan.maTT); dsCong: các cổng đang bật; vietQr: thông tin tài khoản (null nếu không có);
 * kq: "ok" | "cho" | "loi" khi khách vừa từ cổng quay về.
 */
function trangThanhToan({ tenCongTy, ma, yc, link, dsCong, vietQr, kq, sdtCskh }) {
  const dong = yc.hoaDon.map(h => `<div class="dong"><span>Kỳ ${esc(h.ky)}</span><span>${esc(tienVn(h.soTien))}</span></div>`).join('');
  let than = '';
  const tb = THONG_BAO[kq];
  if (yc.daThanhToan) {
    than += `<div class="tb tot">Đã thanh toán lúc ${esc(yc.daThanhToan)}. Cảm ơn quý khách!</div>`;
  } else {
    if (tb) than += `<div class="tb ${tb[0]}">${esc(tb[1])}</div>`;
    if (dsCong.length) {
      than += '<div class="the"><h2>Thanh toán online</h2>' + dsCong.map(c =>
        `<form method="post" action="/tt/${esc(link)}/${esc(c.ten)}"><button type="submit"><b>${esc(c.nhan)}</b>`
        + `<small>${esc(MO_TA_CONG[c.ten] || '')}</small></button></form>`).join('')
        + '<p class="ghi">Bấm để chuyển sang trang thanh toán của cổng; trả xong sẽ quay lại trang này.</p></div>';
    }
    if (vietQr) {
      than += `<div class="the"><h2>Chuyển khoản / quét mã QR</h2>
<img class="qr" src="/tt/${esc(link)}/qr.png" alt="Mã QR chuyển khoản ${esc(tienVn(yc.tong))}" width="240" height="240">
${vietQr.tenNganHang ? `<div class="dong"><span>Ngân hàng</span><span>${esc(vietQr.tenNganHang)}</span></div>` : ''}
<div class="dong"><span>Số tài khoản</span><code>${esc(vietQr.soTaiKhoan)}</code></div>
${vietQr.tenTaiKhoan ? `<div class="dong"><span>Chủ tài khoản</span><span>${esc(vietQr.tenTaiKhoan)}</span></div>` : ''}
<div class="dong"><span>Số tiền</span><span>${esc(tienVn(yc.tong))}</span></div>
<div class="dong"><span>Nội dung</span><code>${esc(vietQr.noiDung)}</code></div>
<p class="ghi">Mở app ngân hàng hoặc ví điện tử → Quét mã QR (chụp màn hình rồi chọn ảnh nếu đang dùng chính điện thoại này).
Ghi đúng nội dung để tiền được ghi nhận tự động.</p></div>`;
    }
  }
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Thanh toán tiền nước</title><style>${CSS}</style></head><body><main>
<h1>Thanh toán tiền nước</h1><p class="cty">${esc(tenCongTy)}</p>
<div class="the"><div class="dong"><span>Mã khách hàng</span><span>${esc(yc.maKH)}</span></div>${dong}
<div class="dong tong"><span>Tổng cộng</span><span>${esc(tienVn(yc.tong))}</span></div>
<p class="ghi">Mã thanh toán: ${esc(ma)}</p></div>
${than}${sdtCskh ? `<p class="ghi">Hỗ trợ: ${esc(sdtCskh)}</p>` : ''}
</main></body></html>`;
}

function trangThongBao(tieuDe, noiDung) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(tieuDe)}</title><style>${CSS}</style></head><body><main><h1>${esc(tieuDe)}</h1>
<div class="the">${esc(noiDung)}</div></main></body></html>`;
}

module.exports = { trangThanhToan, trangThongBao };
