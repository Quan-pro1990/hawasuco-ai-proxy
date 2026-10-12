'use strict';
// Chuỗi VietQR (chuẩn EMVCo của NAPAS 247): mọi app ngân hàng và ví điện tử có chức năng quét VietQR
// đều đọc được, tự điền ngân hàng, số tài khoản, số tiền, nội dung chuyển khoản.
const { boDau } = require('./tienich');

function truong(id, giaTri) {
  const v = String(giaTri);
  if (v.length > 99) throw new Error(`Trường VietQR ${id} dài quá 99 ký tự`);
  return id + String(v.length).padStart(2, '0') + v;
}

/** CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF) — 4 ký tự hex in hoa. */
function crc16(chuoi) {
  let crc = 0xffff;
  for (const b of Buffer.from(chuoi, 'utf8')) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung chuyển khoản: chữ in hoa không dấu, số, khoảng trắng (ngân hàng hay bỏ ký tự lạ). */
function lamSachNoiDung(s, toiDa = 25) {
  return boDau(s).replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, toiDa).trim();
}

/**
 * bin: mã BIN 6 số của ngân hàng nhận (vd Agribank 970405), soTaiKhoan, soTien (đồng, số nguyên), noiDung.
 * Có số tiền → QR động (01 = 12), không có → QR tĩnh (01 = 11).
 */
function taoChuoiVietQR({ bin, soTaiKhoan, soTien, noiDung }) {
  if (!/^\d{6}$/.test(String(bin || ''))) throw new Error('Mã BIN ngân hàng phải gồm 6 chữ số');
  if (!/^[0-9A-Za-z]{1,19}$/.test(String(soTaiKhoan || ''))) throw new Error('Số tài khoản không hợp lệ');
  const tien = soTien == null ? null : Math.round(Number(soTien));
  if (tien != null && !(tien > 0 && tien < 1e13)) throw new Error('Số tiền không hợp lệ');
  const nd = noiDung ? lamSachNoiDung(noiDung) : '';

  const nguoiNhan = truong('00', bin) + truong('01', soTaiKhoan);
  let s = truong('00', '01')
    + truong('01', tien != null ? '12' : '11')
    + truong('38', truong('00', 'A000000727') + truong('01', nguoiNhan) + truong('02', 'QRIBFTTA'))
    + truong('53', '704')
    + (tien != null ? truong('54', String(tien)) : '')
    + truong('58', 'VN')
    + (nd ? truong('62', truong('08', nd)) : '')
    + '6304';
  return s + crc16(s);
}

module.exports = { taoChuoiVietQR, crc16, lamSachNoiDung };
