'use strict';
// Hàm dùng chung: bỏ dấu tiếng Việt, đọc / định dạng số kiểu Việt Nam, chuẩn hoá kỳ "MM/YYYY", ghi nhật ký.

/** "Hóa đơn" → "HOA DON": để khách gõ có dấu hay không dấu, hoa hay thường đều hiểu. */
function boDau(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase();
}

/** Đọc số từ API: 1234.5, "1.234.567", "1,234,567", "171.000 đ". */
function docSo(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d,.\-]/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const fSo = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
function soVn(v) { return v == null ? '?' : fSo.format(v); }
function tienVn(v) { return v == null ? '?' : fSo.format(Math.round(v)) + ' đ'; }

/**
 * Chuẩn hoá kỳ về "MM/YYYY": "9/2026", "09-2026", "2026-09", "202609", "2026-09-01T00:00:00",
 * "Kỳ 1 tháng 9/2026". Không nhận ra thì trả nguyên chuỗi.
 */
function chuanKy(v) {
  if (v == null) return '';
  const s = String(v).trim();
  let m = /^(\d{4})[-/.]?(\d{1,2})(?!\d)/.exec(s) || /^(\d{4})(\d{2})/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return pad2(m[2]) + '/' + m[1];
  m = /(?:^|\D)(\d{1,2})\s*[-/.]\s*(\d{4})(?!\d)/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return pad2(m[1]) + '/' + m[2];
  return s;
}

/** "09/2026" → 202609 để sắp xếp; kỳ không rõ dạng → null. */
function soKy(ky) {
  const m = /^(\d{2})\/(\d{4})$/.exec(ky || '');
  return m ? +m[2] * 100 + +m[1] : null;
}

function pad2(x) { return String(x).padStart(2, '0'); }

/** Chỉ giữ chữ số; "+84 901 234 567" → "0901234567". */
function chuanSdt(s) {
  let d = String(s == null ? '' : s).replace(/\D/g, '');
  if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2);
  return d;
}

/** "0901234567" → "090****567". */
function anSdt(s) {
  const d = chuanSdt(s);
  if (d.length < 7) return d ? '***' : '';
  return d.slice(0, 3) + '*'.repeat(d.length - 6) + d.slice(-3);
}

function log(...noiDung) {
  console.log(new Date().toISOString(), ...noiDung);
}

module.exports = { boDau, docSo, soVn, tienVn, chuanKy, soKy, chuanSdt, anSdt, log };
