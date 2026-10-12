'use strict';
// EOS_CHE_DO=api: dựng 1 máy chủ EOS giả với tên trường / lớp bọc khác nhau để kiểm tra phần đọc dữ liệu.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { EosApi, taoPdf, laPdf } = require('../src/eos');
const { cauHinhThu } = require('./giup');

const PDF = taoPdf(['HOA DON THU']);

function eosGia(xuLy) {
  const yeuCau = [];
  const sv = http.createServer((req, res) => {
    let than = '';
    req.on('data', c => { than += c; });
    req.on('end', () => {
      yeuCau.push({ method: req.method, url: req.url, headers: req.headers, than });
      const [ma, kieu, noiDung] = xuLy(req, than) || [404, 'application/json', '{}'];
      res.writeHead(ma, { 'Content-Type': kieu });
      res.end(typeof noiDung === 'string' || Buffer.isBuffer(noiDung) ? noiDung : JSON.stringify(noiDung));
    });
  });
  return new Promise(ok => sv.listen(0, '127.0.0.1', () => ok({ sv, yeuCau, url: `http://127.0.0.1:${sv.address().port}` })));
}

function json(d, ma = 200) { return [ma, 'application/json; charset=utf-8', d]; }

test('bearer + lớp bọc { success, data } + tên trường kiểu khác', async t => {
  const g = await eosGia(req => {
    if (req.url === '/api/khachhang/KH0001') {
      return json({ success: true, data: { MaDanhBo: 'KH0001', HoTen: 'Nguyễn Văn A', DiaChiSuDung: 'Ấp 1', DienThoai: '0901 234 567', SoSeriDongHo: 'S123', GiaBieu: 'SH' } });
    }
    if (req.url === '/api/khachhang/KH0001/tieuthu?soKy=3') {
      return json({ success: true, data: { items: [
        { Thang: 7, Nam: 2026, CSCu: '1.000', CSMoi: '1.020', TieuThu: 20, TongTien: '180.000' },
        { Thang: 9, Nam: 2026, CSCu: 1035, CSMoi: 1050, TongTien: 135000 },
        { Thang: 8, Nam: 2026, CSCu: 1020, CSMoi: 1035, TieuThu: 15, TongTien: 135000 },
      ] } });
    }
    if (req.url === '/api/khachhang/KH0001/hoadon?soKy=3') {
      return json({ d: [
        { SoHoaDon: '0001234', KyHoaDon: '2026-08', TongCong: 135000, TrangThaiThanhToan: 'Đã thu', MaTraCuu: 'ABC' },
        { SoHoaDon: '0001300', KyHoaDon: '2026-09', TongCong: 135000, TrangThaiThanhToan: 'Chưa thu' },
      ] });
    }
    if (req.url === '/api/hoadon/0001300/pdf') return [200, 'application/pdf', PDF];
    return null;
  });
  t.after(() => g.sv.close());
  const cfg = cauHinhThu({ EOS_CHE_DO: 'api', EOS_URL: g.url, EOS_XAC_THUC: 'bearer', EOS_KHOA: 'k-123' });
  const eos = new EosApi(cfg.eos);

  assert.deepEqual(await eos.timKhachHang('KH0001'), {
    maKH: 'KH0001', ten: 'Nguyễn Văn A', diaChi: 'Ấp 1', soDienThoai: '0901 234 567',
    maDongHo: 'S123', doiTuongGia: 'SH', trangThai: '',
  });
  assert.equal(g.yeuCau[0].headers.authorization, 'Bearer k-123');
  assert.equal(await eos.timKhachHang('KH9999'), null);

  const ls = await eos.lichSu('KH0001', 3);
  assert.deepEqual(ls.map(k => k.ky), ['09/2026', '08/2026', '07/2026']);
  assert.equal(ls[0].tieuThu, 15);            // không có TieuThu → tính từ chỉ số
  assert.equal(ls[2].chiSoCu, 1000);
  assert.equal(ls[2].tienNuoc, 180000);

  const hd = await eos.dsHoaDon('KH0001', 3);
  assert.deepEqual(hd.map(h => [h.ky, h.soHD, h.daThanhToan]), [['09/2026', '0001300', false], ['08/2026', '0001234', true]]);
  assert.equal(hd[1].maTraCuu, 'ABC');

  const tep = await eos.taiHoaDon('KH0001', hd[0]);
  assert.ok(laPdf(tep.duLieu));
  assert.equal(tep.ten, 'HoaDon_KH0001_09-2026.pdf');
  assert.equal(await eos.taiHoaDon('KH0001', hd[1]), null);   // EOS 404, không có link
});

test('đăng nhập lấy token, tự đăng nhập lại khi bị 401; tìm khách bằng POST; PDF trả dạng base64', async t => {
  let soLanDangNhap = 0;
  let tokenHopLe = 'tk-1';
  const g = await eosGia((req, than) => {
    if (req.url === '/auth' && req.method === 'POST') {
      const b = JSON.parse(than);
      if (b.user !== 'zalo' || b.pass !== 'mk') return json({ message: 'sai' }, 401);
      soLanDangNhap++;
      return json({ result: { accessToken: 'tk-' + soLanDangNhap } });
    }
    if (req.headers.authorization !== 'Bearer ' + tokenHopLe) return json({}, 401);
    if (req.url === '/tracuu' && req.method === 'POST') {
      const b = JSON.parse(than);
      if (b.maKH !== 'KH0001') return json({ success: false, message: 'Không tìm thấy khách hàng' });
      return json([{ customerCode: 'KH0001', customerName: 'B', phone: '0912345678' }]);
    }
    if (req.url === '/pdf?so=HD1') return json({ data: PDF.toString('base64') });
    return null;
  });
  t.after(() => g.sv.close());
  const cfg = cauHinhThu({
    EOS_CHE_DO: 'api', EOS_URL: g.url, EOS_XAC_THUC: 'dangnhap', EOS_TAI_KHOAN: 'zalo', EOS_MAT_KHAU: 'mk',
    EOS_DUONG_DANG_NHAP: 'POST /auth', EOS_TRUONG_TAI_KHOAN: 'user', EOS_TRUONG_MAT_KHAU: 'pass',
    EOS_DUONG_KHACH_HANG: 'POST /tracuu', EOS_DUONG_TAI_HOA_DON: '/pdf?so={soHD}',
  });
  const eos = new EosApi(cfg.eos);

  assert.equal((await eos.timKhachHang('KH0001')).ten, 'B');
  assert.equal(soLanDangNhap, 1);
  assert.equal(await eos.timKhachHang('KH0002'), null);   // success:false "không tìm thấy" → null
  tokenHopLe = 'tk-2';                                      // EOS đổi phiên → 401 → đăng nhập lại
  assert.equal((await eos.timKhachHang('KH0001')).soDienThoai, '0912345678');
  assert.equal(soLanDangNhap, 2);

  const tep = await eos.taiHoaDon('KH0001', { soHD: 'HD1', ky: '09/2026' });
  assert.ok(laPdf(tep.duLieu));
});

test('link hoá đơn điện tử không phải PDF → trả link; EOS lỗi 500 → báo lỗi rõ ràng', async t => {
  const g = await eosGia(req => {
    if (req.url === '/tra-cuu-hddt') return [200, 'text/html', '<html>trang tra cứu</html>'];
    if (req.url.startsWith('/api/khachhang/')) return [500, 'text/plain', 'loi CSDL'];
    return null;
  });
  t.after(() => g.sv.close());
  const cfg = cauHinhThu({ EOS_CHE_DO: 'api', EOS_URL: g.url, EOS_DUONG_TAI_HOA_DON: 'khong' });
  const eos = new EosApi(cfg.eos);
  assert.deepEqual(await eos.taiHoaDon('KH0001', { ky: '09/2026', urlPdf: g.url + '/tra-cuu-hddt' }), { url: g.url + '/tra-cuu-hddt' });
  await assert.rejects(eos.timKhachHang('KH0001'), /EOS trả lỗi HTTP 500 \(GET http:\/\/127\.0\.0\.1:\d+\/api\/khachhang\/KH0001\) loi CSDL/);
});
