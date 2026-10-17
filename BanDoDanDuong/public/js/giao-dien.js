/* Tiện ích giao diện: thông báo nhanh, hộp thoại, tấm trượt phía dưới, trang toàn màn hình. */
import { icon } from './bieu-tuong.js';
import { esc } from './dinh-dang.js';
import { laAppGoc, guiGoc } from './cau-noi.js';

export const $ = (s, goc = document) => goc.querySelector(s);
export const $$ = (s, goc = document) => [...goc.querySelectorAll(s)];

/** Chèn SVG cho mọi phần tử có data-icon. */
export function chenBieuTuong(goc = document) {
  $$('[data-icon]', goc).forEach(el => {
    if (!el.querySelector(':scope > svg.ic')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
}

let henTB = null;
export function thongBao(vanBan, { loai = '', thoiGian = 2800 } = {}) {
  const el = $('#thong-bao');
  el.textContent = vanBan;
  el.className = 'thong-bao hien ' + loai;
  clearTimeout(henTB);
  henTB = setTimeout(() => { el.className = 'thong-bao'; }, thoiGian);
}

/**
 * Hộp thoại. nut: [{ chu, giaTri, kieu: 'chinh' | 'nguy' | '' }]. Trả về giaTri của nút được bấm (null nếu đóng).
 */
export function hopThoai({ tieuDe = '', noiDung = '', nut = [{ chu: 'Đóng', giaTri: null }] }) {
  return new Promise(ok => {
    const goc = $('#hop-thoai-goc');
    const el = document.createElement('div');
    el.className = 'hop-thoai-nen';
    el.innerHTML = `<div class="hop-thoai" role="dialog" aria-modal="true">
      ${tieuDe ? `<h3>${esc(tieuDe)}</h3>` : ''}<div class="hop-thoai-than">${noiDung}</div>
      <div class="hop-thoai-nut">${nut.map((n, i) => `<button class="nut ${n.kieu || ''}" data-i="${i}">${esc(n.chu)}</button>`).join('')}</div></div>`;
    const dong = v => { el.remove(); ok(v); };
    el.addEventListener('click', e => {
      if (e.target === el) return dong(null);
      const b = e.target.closest('[data-i]');
      if (b) dong(nut[+b.dataset.i].giaTri);
    });
    goc.appendChild(el);
    const chinh = el.querySelector('.nut.chinh') || el.querySelector('.nut');
    if (chinh) chinh.focus();
  });
}

export function hoiXacNhan(cauHoi, { chuCo = 'Đồng ý', nguy = false } = {}) {
  return hopThoai({ noiDung: `<p>${esc(cauHoi)}</p>`, nut: [{ chu: 'Huỷ', giaTri: false }, { chu: chuCo, giaTri: true, kieu: nguy ? 'nguy' : 'chinh' }] });
}

// ------------------------------------------------------------------ tấm trượt phía dưới (bottom sheet)
export class TamDuoi {
  constructor(el, { doiChieuCao } = {}) {
    this.el = el;
    this.than = el.querySelector('.noi-dung-tam');
    this.doiChieuCao = doiChieuCao;
    this.trangThai = 'an';
    const tay = el.querySelector('.tay-cam');
    let y0 = null, h0 = 0;
    tay.addEventListener('pointerdown', e => {
      y0 = e.clientY; h0 = el.getBoundingClientRect().height;
      tay.setPointerCapture(e.pointerId);
      el.classList.add('dang-keo');
    });
    tay.addEventListener('pointermove', e => {
      if (y0 == null) return;
      const h = Math.max(80, Math.min(window.innerHeight * 0.9, h0 - (e.clientY - y0)));
      el.style.height = h + 'px';
    });
    const tha = e => {
      if (y0 == null) return;
      const dy = e.clientY - y0;
      y0 = null;
      el.classList.remove('dang-keo');
      el.style.height = '';
      if (Math.abs(dy) < 6) this.dat(this.trangThai === 'mo' ? 'thu' : 'mo');
      else this.dat(dy < 0 ? 'mo' : (this.trangThai === 'mo' ? 'thu' : (this.coTheAn ? 'an' : 'thu')));
    };
    tay.addEventListener('pointerup', tha);
    tay.addEventListener('pointercancel', tha);
    new ResizeObserver(() => this.baoChieuCao()).observe(el);
  }

  /** Hiện nội dung. trangThai: 'thu' (thấp) | 'mo' (cao). */
  hien(html, { trangThai = 'thu', lop = '', coTheAn = true } = {}) {
    this.than.innerHTML = html;
    this.than.scrollTop = 0;
    this.el.className = 'tam-duoi ' + lop;
    this.coTheAn = coTheAn;
    this.el.hidden = false;
    chenBieuTuong(this.than);
    this.dat(trangThai);
  }

  dat(tt) {
    this.trangThai = tt;
    this.el.dataset.tt = tt;
    if (tt === 'an') { this.el.hidden = true; this.onAn && this.onAn(); }
    this.baoChieuCao();
  }

  an() { this.dat('an'); }

  baoChieuCao() {
    if (!this.doiChieuCao) return;
    const h = this.el.hidden ? 0 : this.el.getBoundingClientRect().height;
    this.doiChieuCao(h, this.el.getBoundingClientRect().width);
  }
}

// ------------------------------------------------------------------ trang toàn màn hình (cài đặt, đã lưu, lịch sử…)
export function moTrang(tieuDe, html) {
  $('#tieu-de-trang').textContent = tieuDe;
  const than = $('#than-trang');
  than.innerHTML = html;
  than.scrollTop = 0;
  chenBieuTuong(than);
  $('#trang').hidden = false;
}

export function dongTrang() { $('#trang').hidden = true; }

/** Tải một tệp xuống máy. */
export function taiXuong(tenTep, noiDung, kieu = 'application/octet-stream') {
  const blob = noiDung instanceof Blob ? noiDung : new Blob([noiDung], { type: kieu });
  if (laAppGoc) {
    // WebView không tải được blob: gửi nội dung cho ứng dụng gốc lưu (chỉ tệp nhỏ như GPX)
    if (blob.size > 8 * 1024 * 1024) { thongBao('Tệp quá lớn để lưu từ ứng dụng. Hãy mở HawaMap bằng trình duyệt để tải về.', { loai: 'loi', thoiGian: 5000 }); return; }
    const doc = new FileReader();
    doc.onload = () => guiGoc('luuTep', { ten: tenTep, kieu: blob.type || kieu, base64: String(doc.result).split(',')[1] || '' });
    doc.readAsDataURL(blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tenTep;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
