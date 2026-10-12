'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { HoiThoai } = require('../src/hoithoai');
const { EosMau, laPdf } = require('../src/eos');
const { cauHinhThu, guiGia } = require('./giup');

const BAY_GIO = new Date(2026, 9, 12, 9, 0).getTime();   // 12/10/2026 → kỳ mới nhất 09/2026

function tao(them = {}) {
  const cfg = cauHinhThu();
  const gui = guiGia();
  let t = BAY_GIO;
  const dongHo = { bayGio: () => t, toi: phut => { t += phut * 60e3; } };
  const ht = new HoiThoai({ cfg, eos: new EosMau({ bayGio: dongHo.bayGio }), gui, bayGio: dongHo.bayGio, ...them });
  return { cfg, gui, ht, dongHo };
}

test('quan tâm OA → lời chào có hướng dẫn liên kết', async () => {
  const { gui, ht } = tao();
  await ht.xuLySuKien({ event_name: 'follow', follower: { id: 'u1' } });
  assert.equal(gui.cuoi().uid, 'u1');
  assert.match(gui.cuoi().text, /Công ty Cấp nước Thử/);
  assert.match(gui.cuoi().text, /DK <mã KH> <4 số cuối SĐT>/);
});

test('chưa liên kết thì không xem được thông tin', async () => {
  const { gui, ht } = tao();
  for (const lenh of ['TT', 'LS', 'HD', 'HD 09/2026']) {
    await ht.xuLyTin('u1', lenh);
    assert.match(gui.cuoi().text, /chưa liên kết mã khách hàng/, lenh);
  }
});

test('liên kết đúng mã + SĐT, rồi tra thông tin, lịch sử, hoá đơn, tải PDF', async () => {
  const { cfg, gui, ht } = tao();
  await ht.xuLyTin('u1', 'đk kh0001 4567');
  assert.match(gui.cuoi().text, /Đã liên kết mã khách hàng KH0001/);
  const luu = JSON.parse(fs.readFileSync(path.join(cfg.thuMucDuLieu, 'lien-ket.json'), 'utf8'));
  assert.deepEqual(luu.u1.ma, ['KH0001']);

  await ht.xuLyTin('u1', 'thông tin');
  assert.match(gui.cuoi().text, /Tên: Nguyễn Văn Mẫu/);
  assert.match(gui.cuoi().text, /090\*\*\*\*567/);
  assert.doesNotMatch(gui.cuoi().text, /0901234567/);

  await ht.xuLyTin('u1', 'LS');
  const ls = gui.cuoi().text;
  assert.match(ls, /Kỳ 09\/2026: \d+ m³/);
  assert.equal(ls.match(/^Kỳ /gm).length, 6);

  await ht.xuLyTin('u1', 'hoá đơn');
  assert.match(gui.cuoi().text, /Kỳ 09\/2026: [\d.]+ đ – chưa thanh toán/);
  assert.match(gui.cuoi().text, /Kỳ 08\/2026: [\d.]+ đ – đã thanh toán/);

  await ht.xuLyTin('u1', 'HD 9/2026');
  const [tieuDe, file] = gui.tin.slice(-2);
  assert.match(tieuDe.text, /Hoá đơn kỳ 09\/2026 – mã KH0001/);
  assert.equal(file.tep.ten, 'HoaDon_KH0001_09-2026.pdf');
  assert.ok(laPdf(file.tep.duLieu));

  await ht.xuLyTin('u1', 'HD 01/2020');
  assert.match(gui.cuoi().text, /Không tìm thấy hoá đơn kỳ 01\/2020/);
});

test('sai SĐT hay sai mã đều trả cùng 1 câu; sai 5 lần bị khoá 30 phút', async () => {
  const { gui, ht, dongHo } = tao();
  await ht.xuLyTin('u1', 'DK KH0001 1111');
  const saiSdt = gui.cuoi().text;
  await ht.xuLyTin('u1', 'DK KH9999 4567');
  assert.equal(gui.cuoi().text, saiSdt);
  for (let i = 0; i < 3; i++) await ht.xuLyTin('u1', 'DK KH0001 0000');
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  assert.match(gui.cuoi().text, /nhập sai nhiều lần.*30 phút/);
  dongHo.toi(31);
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  assert.match(gui.cuoi().text, /Đã liên kết/);
});

test('nhiều mã: chọn mã trong lệnh, huỷ từng mã', async () => {
  const { gui, ht } = tao();
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  await ht.xuLyTin('u1', 'DK KH0002 0912345678');
  assert.match(gui.cuoi().text, /Đã liên kết mã khách hàng KH0002/);
  await ht.xuLyTin('u1', 'DK KH0002 5678');
  assert.match(gui.cuoi().text, /đã liên kết/);

  await ht.xuLyTin('u1', 'TT');
  assert.match(gui.cuoi().text, /KH0001[\s\S]*KH0002/);
  await ht.xuLyTin('u1', 'LS');
  assert.match(gui.cuoi().text, /– KH0001[\s\S]*Bạn liên kết 2 mã/);
  await ht.xuLyTin('u1', 'ls kh0002');
  assert.match(gui.cuoi().text, /– KH0002/);
  assert.doesNotMatch(gui.cuoi().text, /Bạn liên kết 2 mã/);

  await ht.xuLyTin('u1', 'HD 09/2026 KH0003');
  assert.match(gui.cuoi().text, /Mã KH0003 chưa liên kết/);

  await ht.xuLyTin('u1', 'HUY KH0001');
  assert.match(gui.cuoi().text, /Đã huỷ liên kết KH0001\. Còn liên kết: KH0002/);
  await ht.xuLyTin('u1', 'HUY');
  assert.match(gui.cuoi().text, /Đã huỷ liên kết KH0002\./);
  assert.equal(ht.soNguoiLienKet(), 0);
});

test('mỗi tài khoản Zalo tối đa 5 mã', async () => {
  const { gui, ht } = tao();
  ht.lienKet.ghi({ u1: { ma: ['A1', 'A2', 'A3', 'A4', 'A5'] } });
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  assert.match(gui.cuoi().text, /tối đa 5 mã/);
});

test('bỏ quan tâm OA thì xoá liên kết; sự kiện lặp lại (cùng msg_id) chỉ xử lý 1 lần', async () => {
  const { gui, ht } = tao();
  const sk = { event_name: 'user_send_text', sender: { id: 'u1' }, message: { text: 'DK KH0001 4567', msg_id: 'abc' } };
  await ht.xuLySuKien(sk);
  await ht.xuLySuKien(sk);
  assert.equal(gui.tin.length, 1);
  assert.equal(ht.soNguoiLienKet(), 1);
  await ht.xuLySuKien({ event_name: 'unfollow', follower: { id: 'u1' } });
  assert.equal(ht.soNguoiLienKet(), 0);
});

test('tin không hiểu / ảnh / sticker: nhắc menu tối đa 1 lần mỗi 30 phút', async () => {
  const { gui, ht, dongHo } = tao();
  await ht.xuLyTin('u1', 'nhà tôi bị mất nước từ sáng');
  assert.match(gui.cuoi().text, /chuyển tới bộ phận CSKH/);
  await ht.xuLyTin('u1', 'cho hỏi khi nào có nước lại');
  await ht.xuLySuKien({ event_name: 'user_send_image', sender: { id: 'u1' }, message: {} });
  assert.equal(gui.tin.length, 1);
  dongHo.toi(31);
  await ht.xuLySuKien({ event_name: 'user_send_sticker', sender: { id: 'u1' }, message: {} });
  assert.equal(gui.tin.length, 2);
  await ht.xuLySuKien({ event_name: 'oa_send_text', sender: { id: 'oa' }, message: { text: 'x' } });
  assert.equal(gui.tin.length, 2);
});

test('EOS lỗi → khách nhận câu báo bận, không lộ lỗi kỹ thuật', async () => {
  const { gui, ht } = tao();
  ht.eos = { timKhachHang: async () => { throw new Error('ECONNREFUSED 10.0.0.5:8080'); } };
  await ht.xuLyTin('u1', 'DK KH0001 4567');
  assert.match(gui.cuoi().text, /đang bận/);
  assert.doesNotMatch(gui.cuoi().text, /ECONNREFUSED/);
});
