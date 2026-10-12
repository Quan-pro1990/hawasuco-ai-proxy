'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { HoiThoai } = require('../src/hoithoai');
const { EosMau } = require('../src/eos');
const { ThanhToan, cacGiaoDich } = require('../src/thanhtoan');
const { taoQr, taoQrPng } = require('../src/qrcode');
const { taoChuoiVietQR, crc16, lamSachNoiDung } = require('../src/vietqr');
const { cauHinhThu, guiGia } = require('./giup');

const BAY_GIO = new Date(2026, 9, 12, 9, 0).getTime();
const TK = { TT_NGAN_HANG_BIN: '970405', TT_TEN_NGAN_HANG: 'Agribank', TT_SO_TAI_KHOAN: '7700205123456', TT_TEN_TAI_KHOAN: 'CONG TY THU' };

function tao(them = {}) {
  const cfg = cauHinhThu({ ...TK, TT_KHOA_WEBHOOK: 'khoa-ngan-hang', ...them });
  const gui = guiGia();
  gui.anh = async (uid, tep) => { gui.tin.push({ uid, anh: tep }); };
  const eos = new EosMau({ bayGio: () => BAY_GIO });
  const tt = new ThanhToan({ cfg, eos, bayGio: () => BAY_GIO });
  const ht = new HoiThoai({ cfg, eos, gui, thanhToan: tt, bayGio: () => BAY_GIO });
  return { cfg, gui, eos, tt, ht };
}

/** Chuỗi VietQR → { thẻ: giá trị } (cả thẻ con của 38 và 62). */
function docTlv(s) {
  const kq = {};
  for (let i = 0; i < s.length;) {
    const id = s.slice(i, i + 2);
    const dai = Number(s.slice(i + 2, i + 4));
    kq[id] = s.slice(i + 4, i + 4 + dai);
    i += 4 + dai;
  }
  return kq;
}

const cho = () => new Promise(r => setImmediate(r));

test('CRC16 và chuỗi VietQR đúng chuẩn NAPAS', () => {
  assert.equal(crc16('123456789'), '29B1');
  const s = taoChuoiVietQR({ bin: '970405', soTaiKhoan: '7700205123456', soTien: 711000, noiDung: 'TNABCDEFGH KH0002' });
  const t = docTlv(s);
  assert.equal(t['00'], '01');
  assert.equal(t['01'], '12');
  assert.equal(docTlv(t['38'])['00'], 'A000000727');
  assert.deepEqual(docTlv(docTlv(t['38'])['01']), { '00': '970405', '01': '7700205123456' });
  assert.equal(docTlv(t['38'])['02'], 'QRIBFTTA');
  assert.equal(t['53'], '704');
  assert.equal(t['54'], '711000');
  assert.equal(t['58'], 'VN');
  assert.equal(docTlv(t['62'])['08'], 'TNABCDEFGH KH0002');
  assert.equal(t['63'], crc16(s.slice(0, -4)));
  assert.equal(docTlv(taoChuoiVietQR({ bin: '970436', soTaiKhoan: '0011' }))['01'], '11');   // không số tiền: QR tĩnh
  assert.throws(() => taoChuoiVietQR({ bin: '9704', soTaiKhoan: '1' }), /BIN/);
  assert.equal(lamSachNoiDung('Tiền nước kỳ 9/2026 – KH-0001!'), 'TIEN NUOC KY 9 2026 KH 00');   // tối đa 25 ký tự
});

test('mã QR: kích thước theo độ dài, có 3 ô định vị, ảnh PNG hợp lệ', () => {
  const o = taoQr('VietQR-NAPAS-0001');
  assert.equal(o.length, 25);                        // 17 byte, mức M → phiên bản 2 (25×25)
  assert.equal(taoQr('x'.repeat(14)).length, 21);    // tối đa 14 byte → phiên bản 1
  for (const [x, y] of [[0, 0], [18, 0], [0, 18]]) {
    assert.ok(o[y][x] && o[y + 6][x + 6] && o[y + 3][x + 3] && !o[y + 1][x + 1], `ô định vị ${x},${y}`);
  }
  const png = taoQrPng('xin chào', { tiLe: 2, vien: 4 });
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const canh = png.readUInt32BE(16);
  assert.equal(canh, (21 + 8) * 2);
  const idat = png.indexOf('IDAT');
  const raw = zlib.inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
  assert.equal(raw.length, canh * (canh + 1));
});

test('THANH TOAN: liệt kê hoá đơn còn nợ, gửi thông tin chuyển khoản và ảnh QR đúng số tiền', async () => {
  const { gui, ht, tt } = tao();
  await ht.xuLyTin('u1', 'DK KH0002 5678');
  await ht.xuLyTin('u1', 'Thanh toán');
  const [tin, anh] = gui.tin.slice(-2);
  assert.match(tin.text, /Kỳ 09\/2026: [\d.]+ đ\nKỳ 08\/2026: [\d.]+ đ\nTổng cộng: [\d.]+ đ/);
  assert.match(tin.text, /Ngân hàng: Agribank\nSố tài khoản: 7700205123456\nChủ tài khoản: CONG TY THU/);
  assert.match(tin.text, /OA sẽ nhắn xác nhận/);
  const ma = /Nội dung: (TN[A-Z0-9]{8}) KH0002/.exec(tin.text)[1];
  assert.match(anh.anh.ten, new RegExp(`QR_${ma}\\.png`));
  assert.equal(anh.anh.duLieu.subarray(1, 4).toString(), 'PNG');

  const yc = tt.maTT.doc()[ma];
  assert.equal(yc.maKH, 'KH0002');
  assert.deepEqual(yc.hoaDon.map(h => h.ky), ['09/2026', '08/2026']);
  assert.equal(yc.tong, yc.hoaDon[0].soTien + yc.hoaDon[1].soTien);

  await ht.xuLyTin('u1', 'QR');   // hỏi lại: dùng lại đúng mã cũ
  assert.ok(gui.tin.at(-2).text.includes(ma));
  assert.equal(Object.keys(tt.maTT.doc()).length, 1);

  await ht.xuLyTin('u1', 'thanh toan 09/2026');
  const ma2 = /Nội dung: (TN[A-Z0-9]{8})/.exec(gui.tin.at(-2).text)[1];
  assert.notEqual(ma2, ma);
  assert.deepEqual(tt.maTT.doc()[ma2].hoaDon.map(h => h.ky), ['09/2026']);

  await ht.xuLyTin('u1', 'thanh toan 07/2026');
  assert.match(gui.cuoi().text, /kỳ 07\/2026 .* đã được thanh toán/);
});

test('ngân hàng báo đủ tiền → gạch nợ EOS, nhắn xác nhận; báo lặp lại không xử lý 2 lần', async () => {
  const { gui, ht, tt } = tao();
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  await ht.xuLyTin('u1', 'THANH TOAN');
  const ma = /Nội dung: (TN[A-Z0-9]{8})/.exec(gui.tin.at(-2).text)[1];
  const tong = tt.maTT.doc()[ma].tong;

  // kiểu SePay: ngân hàng chèn thêm chữ, bỏ khoảng trắng trong nội dung
  const bao = { id: 9001, gateway: 'Agribank', transactionDate: '2026-10-12 09:05:00', accountNumber: '7700205123456',
    content: `IBFT ${ma}KH0001 CHUYEN TIEN`, transferType: 'in', transferAmount: tong, referenceCode: 'FT123' };
  assert.deepEqual((await tt.nhanWebhook(bao, gui.chu)).map(k => k.kq), ['du']);
  await cho();
  assert.equal(gui.cuoi().uid, 'u1');
  assert.match(gui.cuoi().text, /Đã nhận [\d.]+ đ – mã KH KH0001 \(mã giao dịch 9001\)\.\nHoá đơn kỳ 09\/2026 đã được thanh toán/);
  const gd = tt.giaoDich.doc()['9001'];
  assert.equal(gd.eos, 'Đã gạch nợ trên EOS');
  assert.equal(gd.trangThai, 'du');

  await ht.xuLyTin('u1', 'HD');
  assert.match(gui.cuoi().text, /Kỳ 09\/2026: [\d.]+ đ – đã thanh toán/);
  assert.doesNotMatch(gui.cuoi().text, /Gửi THANH TOAN/);

  const truoc = gui.tin.length;
  assert.deepEqual((await tt.nhanWebhook(bao, gui.chu)).map(k => k.kq), ['da_nhan']);
  await cho();
  assert.equal(gui.tin.length, truoc);

  // chuyển lần 2 cho mã đã trả → cần đối soát, không gạch nợ lại
  assert.deepEqual((await tt.nhanWebhook({ ...bao, id: 9002 }, gui.chu)).map(k => k.kq), ['trung']);
  await cho();
  assert.match(gui.cuoi().text, /đã được thanh toán trước đó/);
});

test('thiếu tiền / thừa tiền / tiền ra / tài khoản khác / không có mã', async () => {
  const { gui, ht, tt } = tao();
  await ht.xuLyTin('u1', 'DK KH0002 5678');
  await ht.xuLyTin('u1', 'THANH TOAN 09/2026');
  const ma = /Nội dung: (TN[A-Z0-9]{8})/.exec(gui.tin.at(-2).text)[1];
  const tong = tt.maTT.doc()[ma].tong;

  const kq = await tt.nhanWebhook({ data: [
    { id: 1, transferType: 'out', transferAmount: tong, content: ma },
    { id: 2, transferType: 'in', transferAmount: tong, content: ma, accountNumber: '999' },
    { id: 3, transferType: 'in', transferAmount: tong, content: 'TIEN HANG THANG 10' },
    { id: 4, transferType: 'in', transferAmount: tong - 1000, content: ma },
  ] }, gui.chu);
  assert.deepEqual(kq.map(k => k.kq), ['bo_qua', 'bo_qua', 'khong_co_ma', 'thieu']);
  await cho();
  assert.match(gui.cuoi().text, /còn thiếu 1\.000 đ/);
  assert.equal(tt.giaoDich.doc()['4'].eos, 'Không ghi tự động');
  assert.equal(tt.maTT.doc()[ma].daThanhToan, undefined);

  // kiểu Casso: { error, data: [ { amount, description, ... } ] }
  const kq2 = await tt.nhanWebhook({ error: 0, data: [{ tid: 'C5', description: `${ma} KH0002`, amount: tong + 5000, when: '2026-10-12 10:00:00' }] }, gui.chu);
  assert.deepEqual(kq2.map(k => k.kq), ['thua']);
  await cho();
  assert.match(gui.cuoi().text, /chuyển thừa 5\.000 đ/);
});

test('khoá webhook: "Apikey <khoá>", "Bearer <khoá>", chỉ khoá; sai thì từ chối', () => {
  const { tt } = tao();
  assert.ok(tt.kiemKhoa('Apikey khoa-ngan-hang'));
  assert.ok(tt.kiemKhoa('Bearer khoa-ngan-hang'));
  assert.ok(tt.kiemKhoa('khoa-ngan-hang'));
  assert.ok(!tt.kiemKhoa('Apikey sai'));
  assert.ok(!tt.kiemKhoa(undefined));
  const { tt: tt2 } = tao({ TT_KHOA_WEBHOOK: '' });
  assert.ok(!tt2.kiemKhoa('Apikey '));
});

test('chưa khai tài khoản ngân hàng: THANH TOAN chỉ hướng dẫn thu hộ (nếu có)', async () => {
  const { gui, ht } = tao({ TT_NGAN_HANG_BIN: '', TT_SO_TAI_KHOAN: '', TT_THU_HO: 'Thanh toán trong app MoMo / ngân hàng: Hoá đơn → Nước → nhập mã {maKH}' });
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  assert.match(gui.cuoi().text, /THANH TOAN: cách thanh toán tiền nước/);
  await ht.xuLyTin('u1', 'đóng tiền nước');
  assert.match(gui.cuoi().text, /^Thanh toán trong app MoMo \/ ngân hàng: Hoá đơn → Nước → nhập mã KH0001/);

  const { gui: gui2, ht: ht2 } = tao({ TT_NGAN_HANG_BIN: '', TT_SO_TAI_KHOAN: '' });
  await ht2.xuLyTin('u1', 'DK KH0001 4567');
  assert.doesNotMatch(gui2.cuoi().text, /THANH TOAN/);
  await ht2.xuLyTin('u1', 'thanh toán');
  assert.match(gui2.cuoi().text, /chưa hỗ trợ thanh toán qua Zalo/);
});

test('file Excel đối soát lọc theo ngày', async () => {
  const { gui, ht, tt } = tao();
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  await ht.xuLyTin('u1', 'THANH TOAN');
  const ma = /Nội dung: (TN[A-Z0-9]{8})/.exec(gui.tin.at(-2).text)[1];
  await tt.nhanWebhook({ id: 'A1', transferType: 'in', transferAmount: tt.maTT.doc()[ma].tong, content: ma }, gui.chu);
  const tep = tt.doiSoatXlsx('2026-10-12', '2026-10-12');
  assert.equal(tep.readUInt32LE(0), 0x04034b50);
  const sheet = docTepZip(tep, 'xl/worksheets/sheet1.xml');
  assert.match(sheet, /Mã thanh toán/);
  assert.ok(sheet.includes(ma));
  assert.match(sheet, /Đủ tiền/);
  assert.doesNotMatch(docTepZip(tt.doiSoatXlsx('2026-10-13', ''), 'xl/worksheets/sheet1.xml'), new RegExp(ma));
});

test('đọc nhiều dạng báo giao dịch', () => {
  assert.equal(cacGiaoDich({ id: 1, transferAmount: 5 }).length, 1);
  assert.equal(cacGiaoDich([{ amount: 1 }, { amount: 2 }]).length, 2);
  assert.equal(cacGiaoDich({ error: 0, data: [{ amount: 1 }] }).length, 1);
  assert.equal(cacGiaoDich({ data: { amount: 1 } }).length, 1);
  assert.equal(cacGiaoDich({ ping: true }).length, 0);
});

/** Đọc 1 tệp trong zip (để kiểm file .xlsx). */
function docTepZip(buf, ten) {
  for (let i = 0; i < buf.length - 30;) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const nen = buf.readUInt32LE(i + 18);
    const dai = buf.readUInt16LE(i + 26);
    const t = buf.subarray(i + 30, i + 30 + dai).toString();
    const dl = buf.subarray(i + 30 + dai, i + 30 + dai + nen);
    if (t === ten) return zlib.inflateRawSync(dl).toString();
    i += 30 + dai + nen;
  }
  return null;
}

test('khách trả cùng lúc qua 2 kênh: chỉ 1 khoản gạch nợ, khoản kia ghi trả trùng', async () => {
  const { gui, ht, tt, eos } = tao();
  let soLanGhi = 0;
  const goc = eos.ghiThanhToan.bind(eos);
  eos.ghiThanhToan = async x => { soLanGhi++; await new Promise(r => setTimeout(r, 20)); return goc(x); };
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  await ht.xuLyTin('u1', 'THANH TOAN');
  const ma = /Nội dung: (TN[A-Z0-9]{8})/.exec(gui.tin.at(-2).text)[1];
  const tong = tt.maTT.doc()[ma].tong;
  const [a, b] = await Promise.all([
    tt.nhanWebhook({ id: 'NH1', transferType: 'in', transferAmount: tong, content: ma }, gui.chu),
    tt.nhanWebhook({ id: 'NH2', transferType: 'in', transferAmount: tong, content: ma }, gui.chu),
  ]);
  assert.deepEqual([a[0].kq, b[0].kq], ['du', 'trung']);
  assert.equal(soLanGhi, 1);
});
