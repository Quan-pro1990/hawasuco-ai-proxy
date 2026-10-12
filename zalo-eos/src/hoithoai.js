'use strict';
// Kịch bản trò chuyện của OA: khách nhắn lệnh → tra EOS → trả lời.
// Không gọi thẳng Zalo (gửi tin qua đối tượng `gui`), nên chạy thử được trên máy bằng src/thu.js và trong test.
const path = require('path');
const { TepJson } = require('./kho');
const { boDau, soVn, tienVn, chuanKy, chuanSdt, anSdt, log } = require('./tienich');

const TOI_DA_MA_MOI_NGUOI = 5;      // 1 tài khoản Zalo liên kết tối đa 5 mã khách hàng (chủ nhà trọ, nhiều đồng hồ…)
const SAI_TOI_DA = 5;               // nhập sai mã KH / SĐT 5 lần thì khoá đăng ký 30 phút
const PHUT_KHOA = 30;
const PHUT_GIUA_2_LAN_NHAC = 30;    // tin không hiểu: nhắc menu tối đa 1 lần / 30 phút để không chen vào lúc nhân viên CSKH đang chat

const LENH = [
  ['huy', /^(HUY DANG KY|HUY LIEN KET|HUY DK|HUY)(\s|$)/],
  ['dk', /^(DANG KY|DANGKY|LIEN KET|DK)(\s|$)/],
  ['tt', /^(THONG TIN|TRA CUU|TRACUU|TT)(\s|$)/],
  ['ls', /^(LICH SU|LICHSU|CHI SO|TIEU THU|LS)(\s|$)/],
  ['hd', /^(HOA DON|HOADON|TIEN NUOC|HD)(\s|$)/],
  ['menu', /^(MENU|HUONG DAN|TRO GIUP|HELP|BAT DAU|START|\?)(\s|$)/],
];

/** Tách lệnh: "Hóa đơn 9/2026 kh0001" → { lenh: 'hd', thamSo: ['9/2026', 'KH0001'] }. */
function tachLenh(text) {
  const s = boDau(text).replace(/[^\w\s/.\-?]/g, ' ').replace(/\s+/g, ' ').trim()
    // "tra cứu hoá đơn", "xem lịch sử", "tải hoá đơn 9/2026" → bỏ động từ đứng trước tên lệnh
    .replace(/^(TRA CUU|XEM|TAI|LAY|GUI|CHO XEM)\s+(?=(HOA DON|HOADON|HD|LICH SU|LS|THONG TIN|TT|CHI SO|TIEU THU)(\s|$))/, '');
  for (const [lenh, mau] of LENH) {
    const m = mau.exec(s);
    if (m) return { lenh, thamSo: s.slice(m[1].length).trim().split(' ').filter(Boolean) };
  }
  return { lenh: null, thamSo: [] };
}

/** "9/2026", "09-2026", "T9/2026", "2026-09" → "09/2026"; không phải kỳ → null. */
function docKy(s) {
  const k = chuanKy(String(s).replace(/^T(?=\d)/, ''));
  return /^\d{2}\/\d{4}$/.test(k) ? k : null;
}

/** Số điện thoại trong hồ sơ EOS (có thể ghi nhiều số: "0901234567 - 0291 3876 543"). */
function cacSdt(s) {
  const tatCa = chuanSdt(s);
  if (tatCa.length <= 11) return tatCa ? [tatCa] : [];
  return String(s).split(/[,;/|]|\s-\s|\s{2,}/).map(chuanSdt).filter(x => x.length >= 4);
}

function khopSdt(hoSo, nhap) {
  const n = chuanSdt(nhap);
  if (n.length < 4) return false;
  return cacSdt(hoSo).some(d => (n.length === 4 ? d.length >= 4 && d.endsWith(n) : d === n));
}

class HoiThoai {
  /**
   * gui.chu(userId, text)  — gửi tin chữ
   * gui.file(userId, tep)  — tep = { duLieu: Buffer, ten } hoặc { url }
   */
  constructor({ cfg, eos, gui, bayGio = Date.now }) {
    this.cfg = cfg;
    this.eos = eos;
    this.gui = gui;
    this.bayGio = bayGio;
    this.lienKet = new TepJson(path.join(cfg.thuMucDuLieu, 'lien-ket.json'), {});
    this.daXuLy = new Set();    // msg_id đã xử lý: Zalo có thể gửi lại cùng 1 sự kiện
    this.sai = new Map();       // userId → { lan, khoaDen }
    this.daNhac = new Map();    // userId → lúc nhắc menu gần nhất
  }

  // ---------------------------------------------------------------- sự kiện webhook

  async xuLySuKien(sk) {
    const ten = sk && sk.event_name;
    if (ten === 'follow') return this.gui.chu(sk.follower.id, this.loiChao());
    if (ten === 'unfollow') return this.xoaLienKet(sk.follower.id);
    if (ten === 'user_send_text') {
      const msgId = sk.message && sk.message.msg_id;
      if (msgId) {
        if (this.daXuLy.has(msgId)) return;
        this.daXuLy.add(msgId);
        if (this.daXuLy.size > 5000) this.daXuLy.delete(this.daXuLy.values().next().value);
      }
      return this.xuLyTin(sk.sender.id, (sk.message && sk.message.text) || '');
    }
    // ảnh, sticker, file, vị trí… khách gửi: nhắc cách dùng (có giới hạn tần suất)
    if (typeof ten === 'string' && ten.startsWith('user_send_') && sk.sender) return this.nhacMenu(sk.sender.id);
  }

  async xuLyTin(uid, text) {
    const { lenh, thamSo } = tachLenh(text);
    try {
      switch (lenh) {
        case 'dk': return await this.dangKy(uid, thamSo);
        case 'tt': return await this.thongTin(uid);
        case 'ls': return await this.lichSu(uid, thamSo);
        case 'hd': return await this.hoaDon(uid, thamSo);
        case 'huy': return await this.huy(uid, thamSo);
        case 'menu': return await this.gui.chu(uid, this.menu());
        default: return await this.nhacMenu(uid);
      }
    } catch (e) {
      log(`Lỗi lệnh "${lenh}":`, e.message);
      return this.gui.chu(uid, 'Hệ thống tra cứu đang bận, vui lòng thử lại sau ít phút.' + this.dongCskh());
    }
  }

  // ---------------------------------------------------------------- lệnh

  async dangKy(uid, thamSo) {
    const khoa = this.sai.get(uid);
    if (khoa && khoa.khoaDen > this.bayGio()) {
      const phut = Math.ceil((khoa.khoaDen - this.bayGio()) / 60e3);
      return this.gui.chu(uid, `Bạn đã nhập sai nhiều lần. Vui lòng thử lại sau ${phut} phút.` + this.dongCskh());
    }
    const [maKH, sdt] = thamSo;
    if (!maKH || !sdt) {
      return this.gui.chu(uid, 'Để liên kết, gửi: DK <mã khách hàng> <4 số cuối số điện thoại đăng ký>\n'
        + 'Ví dụ: DK KH0001 4567\nMã khách hàng in trên hoá đơn tiền nước.\n\n' + this.dongDongY());
    }
    const ds = this.dsMa(uid);
    if (ds.includes(maKH)) return this.gui.chu(uid, `Mã ${maKH} đã liên kết với tài khoản Zalo này. Gửi TT để xem thông tin.`);
    if (ds.length >= TOI_DA_MA_MOI_NGUOI) {
      return this.gui.chu(uid, `Mỗi tài khoản Zalo liên kết tối đa ${TOI_DA_MA_MOI_NGUOI} mã khách hàng. Gửi HUY <mã KH> để bỏ bớt.`);
    }

    const kh = await this.eos.timKhachHang(maKH);
    if (!kh || !khopSdt(kh.soDienThoai, sdt)) {
      // Cùng 1 câu trả lời cho "không có mã" và "sai số điện thoại" để không dò được mã nào tồn tại.
      const s = this.sai.get(uid) || { lan: 0, khoaDen: 0 };
      s.lan++;
      if (s.lan >= SAI_TOI_DA) { s.lan = 0; s.khoaDen = this.bayGio() + PHUT_KHOA * 60e3; }
      this.sai.set(uid, s);
      return this.gui.chu(uid, 'Mã khách hàng hoặc số điện thoại không khớp với hồ sơ.\n'
        + 'Kiểm tra lại mã khách hàng trên hoá đơn. Nếu hồ sơ chưa có / đã đổi số điện thoại, vui lòng liên hệ CSKH để cập nhật.'
        + this.dongCskh());
    }

    this.sai.delete(uid);
    const bo = this.lienKet.doc();
    // lưu đúng mã khách gõ (EOS đã nhận mã này) để các lần tra sau gọi EOS y như vậy
    bo[uid] = { ma: [...ds, maKH], luc: new Date(this.bayGio()).toISOString() };
    this.lienKet.ghi();
    log('Có liên kết mới. Tổng số tài khoản Zalo đã liên kết:', Object.keys(bo).length);
    return this.gui.chu(uid, `Đã liên kết mã khách hàng ${kh.maKH} – ${kh.ten}.\n\n` + this.menu(true));
  }

  async thongTin(uid) {
    const ds = this.dsMa(uid);
    if (!ds.length) return this.gui.chu(uid, this.chuaLienKet());
    const phan = [];
    for (const ma of ds) {
      const kh = await this.eos.timKhachHang(ma);
      if (!kh) { phan.push(`Mã KH: ${ma}\n(Không còn trong hệ thống – gửi HUY ${ma} để bỏ liên kết)`); continue; }
      phan.push([
        `Mã KH: ${kh.maKH}`,
        `Tên: ${kh.ten}`,
        kh.diaChi && `Địa chỉ: ${kh.diaChi}`,
        kh.soDienThoai && `Điện thoại: ${anSdt(kh.soDienThoai)}`,
        kh.maDongHo && `Đồng hồ: ${kh.maDongHo}`,
        kh.doiTuongGia && `Đối tượng giá: ${kh.doiTuongGia}`,
        kh.trangThai && `Tình trạng: ${kh.trangThai}`,
      ].filter(Boolean).join('\n'));
    }
    return this.gui.chu(uid, 'THÔNG TIN KHÁCH HÀNG\n\n' + phan.join('\n\n') + '\n\nGửi LS: lịch sử sử dụng · HD: hoá đơn');
  }

  async lichSu(uid, thamSo) {
    const chon = this.chonMa(uid, thamSo);
    if (!chon.ma) return this.gui.chu(uid, chon.loi);
    const ds = await this.eos.lichSu(chon.ma, this.cfg.soKyLichSu);
    if (!ds.length) return this.gui.chu(uid, `Chưa có số liệu sử dụng của mã ${chon.ma}.`);
    const dong = ds.map(k => {
      const cs = k.chiSoCu != null && k.chiSoMoi != null ? ` (chỉ số ${soVn(k.chiSoCu)} → ${soVn(k.chiSoMoi)})` : '';
      const tien = k.tienNuoc != null ? ` – ${tienVn(k.tienNuoc)}` : '';
      return `Kỳ ${k.ky}: ${soVn(k.tieuThu)} m³${cs}${tien}`;
    });
    const coSo = ds.filter(k => k.tieuThu != null);
    const tb = coSo.length ? coSo.reduce((a, k) => a + k.tieuThu, 0) / coSo.length : null;
    return this.gui.chu(uid, `LỊCH SỬ SỬ DỤNG NƯỚC – ${chon.ma}\n\n${dong.join('\n')}`
      + (tb != null ? `\n\nBình quân ${coSo.length} kỳ: ${soVn(Math.round(tb * 10) / 10)} m³/kỳ` : '')
      + chon.ghiChu);
  }

  async hoaDon(uid, thamSo) {
    const chon = this.chonMa(uid, thamSo);
    if (!chon.ma) return this.gui.chu(uid, chon.loi);
    const ky = thamSo.map(docKy).find(Boolean);
    const ds = await this.eos.dsHoaDon(chon.ma, ky ? 24 : this.cfg.soKyLichSu);

    if (!ky) {
      if (!ds.length) return this.gui.chu(uid, `Chưa có hoá đơn của mã ${chon.ma}.`);
      const dong = ds.map(h => `Kỳ ${h.ky}: ${tienVn(h.tongTien)} – ${trangThaiTien(h.daThanhToan)}`);
      return this.gui.chu(uid, `HOÁ ĐƠN TIỀN NƯỚC – ${chon.ma}\n\n${dong.join('\n')}\n\n`
        + `Để nhận file hoá đơn, gửi HD kèm kỳ, ví dụ: HD ${ds[0].ky}` + chon.ghiChu);
    }

    const hd = ds.find(h => h.ky === ky);
    if (!hd) return this.gui.chu(uid, `Không tìm thấy hoá đơn kỳ ${ky} của mã ${chon.ma}.`);
    const tep = await this.eos.taiHoaDon(chon.ma, hd);
    const dau = `Hoá đơn kỳ ${hd.ky} – mã ${chon.ma}: ${tienVn(hd.tongTien)} – ${trangThaiTien(hd.daThanhToan)}`;
    if (!tep) {
      return this.gui.chu(uid, dau + '\nChưa lấy được file hoá đơn này'
        + (hd.maTraCuu ? `. Mã tra cứu hoá đơn điện tử: ${hd.maTraCuu}` : '') + '.' + this.dongCskh());
    }
    await this.gui.chu(uid, dau);
    return this.gui.file(uid, tep);
  }

  async huy(uid, thamSo) {
    const ds = this.dsMa(uid);
    if (!ds.length) return this.gui.chu(uid, 'Tài khoản Zalo này chưa liên kết mã khách hàng nào.');
    const ma = thamSo.find(x => ds.includes(x));
    if (thamSo.length && !ma) return this.gui.chu(uid, `Mã ${thamSo[0]} không nằm trong danh sách đã liên kết: ${ds.join(', ')}.`);
    const conLai = ma ? ds.filter(x => x !== ma) : [];
    const bo = this.lienKet.doc();
    if (conLai.length) bo[uid] = { ...bo[uid], ma: conLai };
    else delete bo[uid];
    this.lienKet.ghi();
    return this.gui.chu(uid, `Đã huỷ liên kết ${ma || ds.join(', ')}.` + (conLai.length ? ` Còn liên kết: ${conLai.join(', ')}.` : ''));
  }

  async nhacMenu(uid) {
    const t = this.bayGio();
    if (t - (this.daNhac.get(uid) || 0) < PHUT_GIUA_2_LAN_NHAC * 60e3) return;
    this.daNhac.set(uid, t);
    return this.gui.chu(uid, 'Tin nhắn của bạn đã được chuyển tới bộ phận CSKH.\n\n' + this.menu(this.dsMa(uid).length > 0));
  }

  async xoaLienKet(uid) {
    const bo = this.lienKet.doc();
    if (!bo[uid]) return;
    delete bo[uid];   // khách bỏ quan tâm OA: không giữ liên kết nữa
    this.lienKet.ghi();
  }

  // ---------------------------------------------------------------- tiện ích

  dsMa(uid) {
    const x = this.lienKet.doc()[uid];
    return x && Array.isArray(x.ma) ? x.ma : [];
  }

  soNguoiLienKet() { return Object.keys(this.lienKet.doc()).length; }

  /** Mã KH cho lệnh LS / HD: mã ghi trong lệnh, hoặc mã duy nhất đã liên kết, hoặc mã đầu tiên (kèm nhắc). */
  chonMa(uid, thamSo) {
    const ds = this.dsMa(uid);
    if (!ds.length) return { loi: this.chuaLienKet() };
    const ma = thamSo.find(x => ds.includes(x));
    if (ma) return { ma, ghiChu: '' };
    const maLa = thamSo.find(x => x.length >= 3 && /\d/.test(x) && !docKy(x));
    if (maLa) return { loi: `Mã ${maLa} chưa liên kết với tài khoản Zalo này. Để liên kết, gửi: DK ${maLa} <4 số cuối SĐT>` };
    const ghiChu = ds.length > 1
      ? `\n\n(Bạn liên kết ${ds.length} mã: ${ds.join(', ')}. Thêm mã sau lệnh để xem mã khác, vd: LS ${ds[1]})`
      : '';
    return { ma: ds[0], ghiChu };
  }

  loiChao() {
    return `Cảm ơn bạn đã quan tâm ${this.cfg.tenCongTy}!\n\n` + this.menu(false);
  }

  menu(daLienKet = true) {
    const dong = [
      'TRA CỨU TIỀN NƯỚC QUA ZALO',
      daLienKet ? null : '• DK <mã KH> <4 số cuối SĐT>: liên kết mã khách hàng (vd: DK KH0001 4567)',
      '• TT: thông tin khách hàng',
      '• LS: lịch sử chỉ số, lượng nước các kỳ gần nhất',
      '• HD: danh sách hoá đơn',
      '• HD 09/2026: nhận file hoá đơn kỳ 09/2026',
      daLienKet ? '• DK <mã KH> <4 số cuối SĐT>: liên kết thêm mã khác' : null,
      '• HUY: huỷ liên kết',
    ].filter(Boolean);
    return dong.join('\n') + (daLienKet ? '' : '\n\nMã khách hàng in trên hoá đơn tiền nước.') + this.dongCskh();
  }

  chuaLienKet() {
    return 'Tài khoản Zalo này chưa liên kết mã khách hàng.\n'
      + 'Gửi: DK <mã khách hàng> <4 số cuối số điện thoại đăng ký>\nVí dụ: DK KH0001 4567\n\n' + this.dongDongY();
  }

  dongDongY() {
    return `Khi gửi DK, bạn đồng ý để ${this.cfg.tenCongTy} dùng tài khoản Zalo này gửi cho bạn thông tin khách hàng, `
      + 'chỉ số và hoá đơn tiền nước của mã đã đăng ký. Gửi HUY bất cứ lúc nào để huỷ.';
  }

  dongCskh() { return this.cfg.sdtCskh ? `\nHỗ trợ: ${this.cfg.sdtCskh}` : ''; }
}

function trangThaiTien(v) {
  return v === true ? 'đã thanh toán' : v === false ? 'chưa thanh toán' : 'chưa rõ tình trạng thanh toán';
}

module.exports = { HoiThoai, tachLenh, docKy, khopSdt };
