'use strict';
// Thanh toán tiền nước qua cổng thanh toán (Ví MoMo, ZaloPay, VNPAY) và VietQR (app ngân hàng / ví điện tử),
// tự ghi nhận khi tiền về.
//
// 1. Khách gửi THANH TOAN → tạo "mã thanh toán" riêng (vd TN8K2F7QXA) gắn với các hoá đơn còn nợ, kèm
//    - liên kết trang thanh toán /tt/<khoá>: nút Ví MoMo / ZaloPay / VNPAY → tạo đơn ở cổng → chuyển sang cổng;
//    - ảnh QR VietQR (số tài khoản công ty, số tiền, nội dung "TN8K2F7QXA KH0001") + thông tin chuyển khoản.
// 2. Tiền về:
//    - cổng thanh toán gọi IPN / callback (đã ký) → ketQuaCong();
//    - dịch vụ báo biến động số dư (API ngân hàng, SePay, Casso…) gọi POST /thanh-toan/webhook → tìm mã thanh toán
//      trong nội dung chuyển khoản → nhanWebhook().
// 3. Cả hai đi qua ghiNhan(): kiểm số tiền → gạch nợ trên EOS (nếu có API) → nhắn Zalo xác nhận → lưu để đối soát.
const crypto = require('crypto');
const path = require('path');
const { TepJson } = require('./kho');
const { lay, mang, moGoi } = require('./eos');
const { taoQrPng } = require('./qrcode');
const { taoChuoiVietQR, lamSachNoiDung } = require('./vietqr');
const { taoXlsx } = require('./xlsx');
const { taoCacCong } = require('./congthanhtoan');
const { boDau, docSo, tienVn, log } = require('./tienich');

const BANG_CHU = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // bỏ 0 O 1 I L cho khỏi đọc nhầm
const DO_DAI_MA = 8;
const NGAY_GIU_MA = 180;      // mã thanh toán chưa trả quá 180 ngày thì bỏ
const NGAY_GIU_GIAO_DICH = 400;

// Tên trường hay gặp trong dữ liệu báo giao dịch (SePay, Casso, API ngân hàng…)
const GD = {
  id: ['id', 'transactionId', 'tid', 'referenceCode', 'reference', 'maGiaoDich', 'soThamChieu'],
  soTien: ['transferAmount', 'amount', 'creditAmount', 'soTien', 'soTienGhiCo'],
  noiDung: ['content', 'description', 'noiDung', 'addInfo', 'remark', 'memo', 'dienGiai'],
  maTT: ['code', 'paymentCode'],
  chieu: ['transferType', 'type', 'loaiGiaoDich', 'debitCredit'],
  thoiGian: ['transactionDate', 'transactionDateTime', 'when', 'thoiGian', 'ngayGiaoDich', 'time'],
  taiKhoan: ['accountNumber', 'soTaiKhoan', 'bankAccount', 'bankSubAccId', 'subAccount'],
};

const TRANG_THAI = {
  du: 'Đủ tiền',
  thua: 'Thừa tiền – cần đối soát phần thừa',
  thieu: 'Thiếu tiền – cần đối soát',
  trung: 'Mã đã thanh toán trước đó – cần đối soát',
};

function chuoiNgauNhien(n) {
  return Array.from(crypto.randomBytes(n), b => BANG_CHU[b % BANG_CHU.length]).join('');
}

function gioVn(ms) { return new Date(ms + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 19); }

function bangNhau(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/** Danh sách giao dịch trong 1 lần báo: 1 giao dịch, mảng, hoặc nằm trong lớp bọc { data: … }. */
function cacGiaoDich(d) {
  const o = moGoi(d);
  if (o && typeof o === 'object' && !Array.isArray(o) && lay(o, GD.soTien) !== undefined) return [o];
  return mang(d).filter(x => x && typeof x === 'object');
}

class ThanhToan {
  constructor({ cfg, eos, bayGio = Date.now, fetch: f = globalThis.fetch }) {
    this.c = cfg.thanhToan;
    this.cfg = cfg;
    this.eos = eos;
    this.bayGio = bayGio;
    this.cong = taoCacCong(cfg.thanhToan.cong, f);
    this.maTT = new TepJson(path.join(cfg.thuMucDuLieu, 'ma-thanh-toan.json'), {});
    this.giaoDich = new TepJson(path.join(cfg.thuMucDuLieu, 'giao-dich.json'), {});
    this._hang = Promise.resolve();   // ghi nhận lần lượt từng khoản, không chen nhau
  }

  /** Đã khai tài khoản nhận tiền → có VietQR / chuyển khoản. */
  get vietQr() { return /^\d{6}$/.test(this.c.bin) && !!this.c.soTaiKhoan; }

  /** Các cổng thanh toán đã khai khoá (Ví MoMo, ZaloPay, VNPAY). */
  get dsCong() { return Object.values(this.cong); }

  /** Có ít nhất 1 cách thanh toán qua Zalo. */
  get bat() { return this.vietQr || this.dsCong.length > 0; }

  /** Đã nối dịch vụ báo biến động số dư → xác nhận tự động. */
  get coWebhook() { return !!this.c.khoaWebhook; }

  // ---------------------------------------------------------------- tạo mã QR

  /**
   * Tạo (hoặc dùng lại) mã thanh toán cho các hoá đơn. Trả về nội dung chuyển khoản, ảnh QR (khi có VietQR)
   * và liên kết trang thanh toán (khi có cổng thanh toán).
   */
  taoYeuCau({ uid, maKH, hoaDon }) {
    const tong = hoaDon.reduce((a, h) => a + Math.round(h.tongTien), 0);
    if (!(tong > 0)) throw new Error('Số tiền thanh toán phải lớn hơn 0');
    this.donDep();
    const ds = this.maTT.doc();
    const khoaHd = hoaDon.map(h => h.soHD || h.ky).sort().join(',');
    let ma = Object.keys(ds).find(m => !ds[m].daThanhToan && ds[m].maKH === maKH && ds[m].khoaHd === khoaHd && ds[m].tong === tong);
    if (!ma) {
      do ma = this.c.tienTo + chuoiNgauNhien(DO_DAI_MA); while (ds[ma]);
      ds[ma] = {
        maKH, khoaHd, tong,
        hoaDon: hoaDon.map(h => ({ soHD: h.soHD, ky: h.ky, soTien: Math.round(h.tongTien) })),
        tao: new Date(this.bayGio()).toISOString(),
      };
    }
    ds[ma].uid = uid;   // người hỏi gần nhất nhận tin xác nhận
    if (!ds[ma].link) ds[ma].link = crypto.randomBytes(16).toString('base64url');   // khoá trang thanh toán, không đoán được
    this.maTT.ghi();

    const kq = { ma, tong, noiDung: this.noiDungCk(ma, ds[ma]), hoaDon: ds[ma].hoaDon, link: ds[ma].link };
    if (this.cfg.urlCongKhai) kq.linkTrang = `${this.cfg.urlCongKhai}/tt/${ds[ma].link}`;
    if (this.vietQr) {
      kq.chuoiQr = this.chuoiQr(ma, ds[ma]);
      kq.png = taoQrPng(kq.chuoiQr);
    }
    return kq;
  }

  chuoiQr(ma, yc) {
    return taoChuoiVietQR({
      bin: this.c.bin, soTaiKhoan: this.c.soTaiKhoan, soTien: yc.tong, noiDung: this.noiDungCk(ma, yc),
    });
  }

  noiDungCk(ma, yc) { return lamSachNoiDung(`${ma} ${yc.maKH}`); }

  /** Khoá trang thanh toán của mã đơn ở cổng (để đưa khách về đúng trang). */
  linkTuDon(maDon) {
    const ma = this.maTuDon(maDon);
    const yc = ma && this.maTT.doc()[ma];
    return yc && (yc.donCong || {})[maDon] ? yc.link : null;
  }

  /** [mã thanh toán, yêu cầu] theo khoá trang thanh toán; không có → null. */
  timTheoLink(link) {
    if (!link) return null;
    const ds = this.maTT.doc();
    const ma = Object.keys(ds).find(m => ds[m].link === link);
    return ma ? [ma, ds[ma]] : null;
  }

  // ---------------------------------------------------------------- cổng thanh toán

  /** Khách bấm nút cổng trên trang thanh toán → tạo đơn ở cổng → trả về link chuyển khách sang cổng. */
  async taoDonCong(link, tenCong, ipKhach) {
    const tim = this.timTheoLink(link);
    const cong = this.cong[tenCong];
    if (!tim || !cong) return null;
    const [ma, yc] = tim;
    if (yc.daThanhToan) return { daThanhToan: true };
    const goc = this.cfg.urlCongKhai;
    const r = await cong.taoDon({
      maDon: ma + chuoiNgauNhien(5), soTien: yc.tong, nguoiDung: yc.maKH, ipKhach, bayGio: this.bayGio(),
      moTa: `Tien nuoc ${yc.maKH} ky ${yc.hoaDon.map(h => h.ky).join(' ')}`,
      urlVe: `${goc}/cong/${tenCong}/ve`, urlIpn: `${goc}/cong/${tenCong}/ipn`,
    });
    yc.donCong = { ...(yc.donCong || {}), [r.maDon]: { cong: tenCong, tao: gioVn(this.bayGio()) } };
    this.maTT.ghi();
    log(`Tạo đơn ${cong.nhan} ${r.maDon} cho ${ma}`);
    return { url: r.url };
  }

  /** Mã thanh toán nằm đầu mã đơn ở cổng (ZaloPay thêm "yymmdd_" phía trước). */
  maTuDon(maDon) {
    const m = /^(?:\d{6}_)?([A-Z]+[A-Z0-9]*)$/.exec(String(maDon));
    return m ? m[1].slice(0, this.c.tienTo.length + DO_DAI_MA) : null;
  }

  /**
   * Kết quả cổng gửi về (đã đọc bằng doc…() của cổng). Trả về { kq, ma, link }, kq là:
   * sai_chu_ky | khong_thay_don | that_bai | du | thua | thieu | trung | da_nhan.
   */
  async ketQuaCong(tenCong, kq, guiChu) {
    if (!kq.hopLe) return { kq: 'sai_chu_ky' };
    const ma = this.maTuDon(kq.maDon);
    const yc = ma && this.maTT.doc()[ma];
    if (!yc || !(yc.donCong || {})[kq.maDon]) return { kq: 'khong_thay_don' };
    if (!kq.thanhCong) return { kq: 'that_bai', ma, link: yc.link };
    const cong = this.cong[tenCong];
    const r = await this.ghiNhan({
      ma, id: `${tenCong.toUpperCase()}-${kq.maGD || kq.maDon}`, soTien: kq.soTien, thoiGian: kq.thoiGian,
      kenh: cong ? cong.nhan : tenCong, noiDung: `Đơn ${kq.maDon}`,
    }, guiChu);
    return { ...r, link: yc.link };
  }

  // ---------------------------------------------------------------- nhận báo có tiền về

  /** Header xác thực: "Apikey <khoá>", "Bearer <khoá>" hoặc chỉ "<khoá>". */
  kiemKhoa(giaTri) {
    if (!this.c.khoaWebhook || !giaTri) return false;
    const s = String(giaTri).trim();
    return bangNhau(s.slice(s.lastIndexOf(' ') + 1), this.c.khoaWebhook);
  }

  /** guiChu(uid, text): nhắn Zalo xác nhận cho khách. */
  async nhanWebhook(d, guiChu) {
    const kq = [];
    for (const gd of cacGiaoDich(d)) kq.push(await this.xuLyGiaoDich(gd, guiChu));
    return kq;
  }

  async xuLyGiaoDich(gd, guiChu) {
    const soTien = docSo(lay(gd, GD.soTien));
    const chieu = boDau(lay(gd, GD.chieu) ?? '').trim();
    if (!(soTien > 0) || /^(OUT|DEBIT|D|DR|CHI|GHI NO)$/.test(chieu)) return { kq: 'bo_qua' };   // tiền ra
    if (!this.dungTaiKhoan(gd)) return { kq: 'bo_qua' };                                           // tài khoản khác

    const noiDung = [lay(gd, GD.maTT), lay(gd, GD.noiDung), gd.description]
      .filter(x => typeof x === 'string').join(' ');
    const ma = this.timMa(noiDung);
    if (!ma) return { kq: 'khong_co_ma' };   // chuyển khoản khác, không phải tiền nước qua Zalo

    const id = String(lay(gd, GD.id) ?? '')
      || crypto.createHash('sha256').update(JSON.stringify(gd)).digest('hex').slice(0, 24);
    return this.ghiNhan({
      ma, id, soTien, thoiGian: String(lay(gd, GD.thoiGian) ?? ''), kenh: 'Chuyển khoản / VietQR', noiDung,
    }, guiChu);
  }

  /**
   * Ghi nhận 1 khoản tiền đã về cho mã thanh toán (từ ngân hàng hoặc cổng thanh toán); báo lặp lại chỉ xử lý 1 lần.
   * Các khoản được xử lý lần lượt: khách trả cùng lúc qua 2 kênh thì khoản sau thấy khoản trước và ghi "trả trùng".
   */
  ghiNhan(gd, guiChu) {
    const viec = this._hang.then(() => this._ghiNhan(gd, guiChu));
    this._hang = viec.catch(() => {});
    return viec;
  }

  async _ghiNhan({ ma, id, soTien, thoiGian, kenh, noiDung }, guiChu) {
    if (this.giaoDich.doc()[id]) return { kq: 'da_nhan', id, ma };
    const yc = this.maTT.doc()[ma];
    const t = this.bayGio();
    const ban = {
      nhanLuc: gioVn(t),
      thoiGianNganHang: thoiGian || '',
      kenh,
      ma, maKH: yc.maKH, ky: yc.hoaDon.map(h => h.ky).join(' '),
      tong: yc.tong, soTien, noiDung: String(noiDung || '').slice(0, 300),
    };
    if (yc.daThanhToan) ban.trangThai = 'trung';
    else if (soTien < yc.tong) ban.trangThai = 'thieu';
    else ban.trangThai = soTien > yc.tong ? 'thua' : 'du';

    if (ban.trangThai === 'du' || ban.trangThai === 'thua') {
      ban.eos = await this.ghiEos(yc, id, ban.thoiGianNganHang || ban.nhanLuc, kenh);
      yc.daThanhToan = ban.nhanLuc;
      yc.maGiaoDich = id;
      this.maTT.ghi();
    } else {
      ban.eos = 'Không ghi tự động';
    }
    this.giaoDich.doc()[id] = ban;
    this.giaoDich.ghi();
    log(`Nhận thanh toán ${ma} qua ${kenh}: ${TRANG_THAI[ban.trangThai]}; EOS: ${ban.eos}`);

    if (yc.uid && guiChu) {
      Promise.resolve()
        .then(() => guiChu(yc.uid, this.tinXacNhan(ban, yc, id)))
        .catch(e => log('Không nhắn được xác nhận thanh toán qua Zalo:', e.message));
    }
    return { kq: ban.trangThai, id, ma };
  }

  /** Báo giao dịch có ghi số tài khoản (chính hoặc tài khoản ảo) thì phải là tài khoản nhận tiền nước. */
  dungTaiKhoan(gd) {
    const ds = Object.keys(gd)
      .filter(k => GD.taiKhoan.some(t => t.toLowerCase() === k.toLowerCase()))
      .map(k => String(gd[k] ?? '').replace(/\s+/g, ''))
      .filter(Boolean);
    return !ds.length || ds.includes(this.c.soTaiKhoan);
  }

  /** Mã thanh toán trong nội dung chuyển khoản (ngân hàng có thể thêm chữ, bỏ khoảng trắng). */
  timMa(noiDung) {
    const s = boDau(noiDung).replace(/[^A-Z0-9]/g, '');
    const ds = this.maTT.doc();
    const tt = this.c.tienTo;
    for (let i = s.indexOf(tt); i >= 0; i = s.indexOf(tt, i + 1)) {
      const ma = s.slice(i, i + tt.length + DO_DAI_MA);
      if (ds[ma]) return ma;
    }
    return null;
  }

  /** Gạch nợ từng hoá đơn trên EOS; lỗi thì ghi lại để kế toán xử lý tay. */
  async ghiEos(yc, maGiaoDich, thoiGian, kenh) {
    if (!this.eos.ghiThanhToan) return 'EOS chưa có API ghi thanh toán';
    try {
      for (const h of yc.hoaDon) {
        const daGhi = await this.eos.ghiThanhToan({
          maKH: yc.maKH, soHD: h.soHD, ky: h.ky, soTien: h.soTien, maGiaoDich, thoiGian, kenh,
        });
        if (daGhi === false) return 'Chưa khai EOS_DUONG_GHI_THANH_TOAN – gạch nợ tay';
      }
      return 'Đã gạch nợ trên EOS';
    } catch (e) {
      log('Lỗi ghi thanh toán vào EOS:', e.message);
      return 'Lỗi ghi EOS: ' + e.message.slice(0, 200);
    }
  }

  tinXacNhan(ban, yc, id) {
    const kyHd = yc.hoaDon.map(h => h.ky).join(', ');
    const qua = ban.kenh && !/chuyển khoản/i.test(ban.kenh) ? ` qua ${ban.kenh}` : '';
    const dau = `Đã nhận ${tienVn(ban.soTien)}${qua} – mã KH ${yc.maKH} (mã giao dịch ${id}).`;
    switch (ban.trangThai) {
      case 'du': return `${dau}\nHoá đơn kỳ ${kyHd} đã được thanh toán. Cảm ơn quý khách!`;
      case 'thua': return `${dau}\nHoá đơn kỳ ${kyHd} đã được thanh toán. Số tiền chuyển thừa `
        + `${tienVn(ban.soTien - ban.tong)} sẽ được bộ phận kế toán xử lý (trừ vào kỳ sau hoặc hoàn lại).` + this.dongCskh();
      case 'thieu': return `${dau}\nSố tiền cần thanh toán kỳ ${kyHd} là ${tienVn(ban.tong)}, còn thiếu `
        + `${tienVn(ban.tong - ban.soTien)}. Bộ phận kế toán sẽ đối soát và liên hệ nếu cần.` + this.dongCskh();
      default: return `${dau}\nCác hoá đơn của mã thanh toán này đã được thanh toán trước đó. `
        + 'Bộ phận kế toán sẽ đối soát và hoàn lại hoặc trừ vào kỳ sau.' + this.dongCskh();
    }
  }

  dongCskh() { return this.cfg.sdtCskh ? `\nHỗ trợ: ${this.cfg.sdtCskh}` : ''; }

  // ---------------------------------------------------------------- đối soát

  /** File Excel các khoản đã nhận; tu, den dạng YYYY-MM-DD (giờ Việt Nam), bỏ trống = tất cả. */
  doiSoatXlsx(tu = '', den = '') {
    const ds = Object.entries(this.giaoDich.doc())
      .filter(([, g]) => (!tu || g.nhanLuc.slice(0, 10) >= tu) && (!den || g.nhanLuc.slice(0, 10) <= den))
      .sort((a, b) => a[1].nhanLuc.localeCompare(b[1].nhanLuc));
    const dong = [[
      'Nhận lúc', 'Thời gian ngân hàng / cổng', 'Kênh', 'Mã giao dịch', 'Mã thanh toán', 'Mã KH', 'Kỳ hoá đơn',
      'Số tiền hoá đơn', 'Số tiền nhận', 'Chênh lệch', 'Trạng thái', 'Gạch nợ EOS', 'Nội dung chuyển khoản / mã đơn',
    ]];
    for (const [id, g] of ds) {
      dong.push([g.nhanLuc, g.thoiGianNganHang, g.kenh || 'Chuyển khoản / VietQR', id, g.ma, g.maKH, g.ky, g.tong,
        g.soTien, g.soTien - g.tong, TRANG_THAI[g.trangThai] || g.trangThai, g.eos, g.noiDung]);
    }
    return taoXlsx(dong, { tenTrang: 'Doi soat', doRong: [19, 22, 20, 22, 14, 12, 18, 14, 14, 12, 34, 34, 60] });
  }

  donDep() {
    const t = this.bayGio();
    const ma = this.maTT.doc();
    let doi = false;
    for (const [k, v] of Object.entries(ma)) {
      if (Date.parse(v.tao) < t - NGAY_GIU_MA * 86400e3) { delete ma[k]; doi = true; }
    }
    if (doi) this.maTT.ghi();
    const gd = this.giaoDich.doc();
    const moc = gioVn(t - NGAY_GIU_GIAO_DICH * 86400e3);
    doi = false;
    for (const [k, v] of Object.entries(gd)) if (v.nhanLuc < moc) { delete gd[k]; doi = true; }
    if (doi) this.giaoDich.ghi();
  }
}

module.exports = { ThanhToan, cacGiaoDich, TRANG_THAI };
