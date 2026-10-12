'use strict';
// Lớp kết nối phần mềm quản lý khách hàng nước EOS. Mọi chỗ khác chỉ gọi 4 hàm:
//   timKhachHang(maKH)        → { maKH, ten, diaChi, soDienThoai, maDongHo, doiTuongGia, trangThai } | null
//   lichSu(maKH, soKy)        → [{ ky: 'MM/YYYY', chiSoCu, chiSoMoi, tieuThu, tienNuoc }]   (kỳ mới nhất trước)
//   dsHoaDon(maKH, soKy)      → [{ soHD, ky, tongTien, daThanhToan, ngayPhatHanh, maTraCuu, urlPdf }]
//   taiHoaDon(maKH, hoaDon)   → { duLieu: Buffer, ten } | { url } | null
//
// EOS_CHE_DO=mau : dữ liệu mẫu để chạy thử khi chưa có API EOS.
// EOS_CHE_DO=api : gọi API REST/JSON của EOS. Đường dẫn và cách xác thực khai trong .env.
//   Tên trường JSON lấy theo danh sách TRUONG dưới đây (không phân biệt hoa thường, bỏ qua dấu _ -).
//   API EOS đặt tên khác thì thêm tên đó vào đầu danh sách tương ứng.
const { boDau, docSo, chuanKy, soKy } = require('./tienich');

const TRUONG = {
  maKH: ['maKH', 'maKhachHang', 'maDanhBo', 'danhBo', 'soDanhBo', 'maDanhBa', 'customerCode', 'customerId'],
  ten: ['tenKH', 'tenKhachHang', 'hoTen', 'ten', 'customerName', 'name'],
  diaChi: ['diaChi', 'diaChiSuDung', 'diaChiLapDat', 'diaChiKhachHang', 'address'],
  soDienThoai: ['soDienThoai', 'dienThoai', 'sdt', 'diDong', 'soDiDong', 'phone', 'mobile'],
  maDongHo: ['soSeriDongHo', 'seriDongHo', 'soSeri', 'maDongHo', 'soDongHo', 'meterNo', 'meterSerial'],
  doiTuongGia: ['doiTuongGia', 'loaiGia', 'giaBieu', 'mucDichSuDung', 'dinhMuc', 'priceType'],
  trangThai: ['trangThai', 'tinhTrang', 'trangThaiKhachHang', 'status'],

  ky: ['ky', 'kyHoaDon', 'kyGhi', 'kyThu', 'thangNam', 'period'],
  thang: ['thang', 'month'],
  nam: ['nam', 'year'],
  chiSoCu: ['chiSoCu', 'csCu', 'chiSoDau', 'chiSoTruoc', 'oldIndex', 'previousReading'],
  chiSoMoi: ['chiSoMoi', 'csMoi', 'chiSoCuoi', 'chiSoSau', 'newIndex', 'currentReading'],
  tieuThu: ['tieuThu', 'luongTieuThu', 'sanLuong', 'khoiLuong', 'm3', 'consumption'],
  tienNuoc: ['tongTien', 'tongCong', 'tongThanhToan', 'tienNuoc', 'thanhTien', 'soTien', 'amount', 'total'],

  soHD: ['soHoaDon', 'soHD', 'maHoaDon', 'idHoaDon', 'invoiceNo', 'invoiceId', 'id'],
  daThanhToan: ['daThanhToan', 'trangThaiThanhToan', 'tinhTrangThanhToan', 'daThu', 'tinhTrangThu', 'paid', 'isPaid'],
  ngayPhatHanh: ['ngayHoaDon', 'ngayPhatHanh', 'ngayLap', 'invoiceDate'],
  maTraCuu: ['maTraCuu', 'maTraCuuHDDT', 'maBaoMat', 'lookupCode'],
  urlPdf: ['urlPdf', 'linkPdf', 'duongDanPdf', 'linkHoaDon', 'linkTraCuu', 'pdfUrl'],

  token: ['access_token', 'accessToken', 'token', 'jwt'],
  pdfBase64: ['pdf', 'pdfBase64', 'base64', 'fileContent', 'noiDung', 'content', 'data'],
  url: ['url', 'link', 'urlPdf', 'linkPdf', 'linkTraCuu'],
};

class LoiEos extends Error {}

// ------------------------------------------------------------------ đọc JSON không biết trước tên trường

function khoa(k) { return String(k).toLowerCase().replace(/[^a-z0-9]/g, ''); }

/** Lấy giá trị trường đầu tiên có trong obj theo danh sách tên TRUONG[loai]. */
function lay(obj, loai) {
  if (!obj || typeof obj !== 'object') return undefined;
  const theoKhoa = new Map(Object.keys(obj).map(k => [khoa(k), k]));
  for (const ten of TRUONG[loai]) {
    const k = theoKhoa.get(khoa(ten));
    if (k !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function chu(v) { return v == null ? '' : String(v).trim(); }

/** Bỏ lớp bọc hay gặp: { data: … }, { result: … }, { d: … } (ASP.NET), { value: … }. */
function moGoi(d) {
  for (let i = 0; i < 3 && d && typeof d === 'object' && !Array.isArray(d); i++) {
    const k = Object.keys(d).find(x => /^(data|result|d|value|payload)$/i.test(x) && d[x] && typeof d[x] === 'object');
    if (!k) break;
    d = d[k];
  }
  return d;
}

/** Danh sách trong kết quả API: chính nó là mảng, hoặc mảng đầu tiên nằm trong lớp bọc. */
function mang(d) {
  d = moGoi(d);
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    const k = Object.keys(d).find(x => Array.isArray(d[x]));
    if (k) return d[k];
  }
  return [];
}

function daThanhToan(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = boDau(v).trim();
  if (/CHUA|UNPAID|\bNOT\b|^NO$|FALSE|^0$|CON NO/.test(s)) return false;
  if (/^DA\b|PAID|TRUE|^1$|HOAN TAT|XONG/.test(s)) return true;
  return null;
}

function kyCua(o) {
  const thang = docSo(lay(o, 'thang'));
  const nam = docSo(lay(o, 'nam'));
  const ky = lay(o, 'ky');
  if (ky != null) {
    const k = chuanKy(ky);
    if (soKy(k)) return k;
  }
  if (thang && nam) return String(thang).padStart(2, '0') + '/' + nam;
  return ky != null ? chuanKy(ky) : '';
}

function chuanKhachHang(o, maKH) {
  return {
    maKH: chu(lay(o, 'maKH')) || maKH,
    ten: chu(lay(o, 'ten')),
    diaChi: chu(lay(o, 'diaChi')),
    soDienThoai: chu(lay(o, 'soDienThoai')),
    maDongHo: chu(lay(o, 'maDongHo')),
    doiTuongGia: chu(lay(o, 'doiTuongGia')),
    trangThai: chu(lay(o, 'trangThai')),
  };
}

function chuanKySuDung(o) {
  const chiSoCu = docSo(lay(o, 'chiSoCu'));
  const chiSoMoi = docSo(lay(o, 'chiSoMoi'));
  let tieuThu = docSo(lay(o, 'tieuThu'));
  if (tieuThu == null && chiSoCu != null && chiSoMoi != null) tieuThu = chiSoMoi - chiSoCu;
  return { ky: kyCua(o), chiSoCu, chiSoMoi, tieuThu, tienNuoc: docSo(lay(o, 'tienNuoc')) };
}

function chuanHoaDon(o) {
  return {
    soHD: chu(lay(o, 'soHD')),
    ky: kyCua(o),
    tongTien: docSo(lay(o, 'tienNuoc')),
    daThanhToan: daThanhToan(lay(o, 'daThanhToan')),
    ngayPhatHanh: chu(lay(o, 'ngayPhatHanh')),
    maTraCuu: chu(lay(o, 'maTraCuu')),
    urlPdf: chu(lay(o, 'urlPdf')),
  };
}

/** Kỳ mới nhất lên đầu (kỳ không đọc được giữ nguyên thứ tự ở cuối). */
function sapXepMoiTruoc(ds) {
  return ds
    .map((x, i) => ({ x, i, k: soKy(x.ky) }))
    .sort((a, b) => (b.k ?? -1) - (a.k ?? -1) || a.i - b.i)
    .map(o => o.x);
}

function laPdf(buf) { return buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-'; }

function tenTepHoaDon(maKH, hd) {
  return `HoaDon_${maKH}_${(hd.ky || hd.soHD || 'ky').replace(/[^\w-]+/g, '-')}.pdf`;
}

// ------------------------------------------------------------------ gọi API EOS

class EosApi {
  constructor(c, { fetch: f = globalThis.fetch, bayGio = Date.now } = {}) {
    if (!c.url) throw new LoiEos('Chưa khai EOS_URL trong .env');
    this.c = c;
    this.f = f;
    this.bayGio = bayGio;
    this._token = null;      // dùng khi EOS_XAC_THUC=dangnhap
    this._dangNhap = null;
  }

  async timKhachHang(maKH) {
    const d = await this._goi(this.c.duong.khachHang, { maKH });
    if (d == null) return null;
    let o = moGoi(d);
    if (Array.isArray(o)) o = o[0];
    if (!o || typeof o !== 'object') return null;
    if (lay(o, 'maKH') === undefined && lay(o, 'ten') === undefined) {
      // bọc thêm 1 lớp kiểu { khachHang: { … } }
      const k = Object.keys(o).find(x => o[x] && typeof o[x] === 'object' && !Array.isArray(o[x]));
      if (k) o = o[k];
    }
    return chuanKhachHang(o, maKH);
  }

  async lichSu(maKH, soKyLay) {
    const d = await this._goi(this.c.duong.lichSu, { maKH, soKy: soKyLay });
    return sapXepMoiTruoc(mang(d).map(chuanKySuDung)).slice(0, soKyLay);
  }

  async dsHoaDon(maKH, soKyLay) {
    const d = await this._goi(this.c.duong.hoaDon, { maKH, soKy: soKyLay });
    return sapXepMoiTruoc(mang(d).map(chuanHoaDon)).slice(0, soKyLay);
  }

  async taiHoaDon(maKH, hd) {
    const ten = tenTepHoaDon(maKH, hd);
    const [thang, nam] = (hd.ky || '').split('/');
    if (this.c.duong.taiHoaDon) {
      const r = await this._goi(this.c.duong.taiHoaDon,
        { maKH, soHD: hd.soHD, ky: hd.ky, thang, nam, maTraCuu: hd.maTraCuu }, true);
      if (r) {
        if (laPdf(r.buf)) return { duLieu: r.buf, ten };
        let j = null;
        try { j = JSON.parse(r.buf.toString('utf8')); } catch (e) { /* không phải JSON */ }
        const o = moGoi(j);
        const b64 = j == null ? r.buf.toString('utf8').trim()       // trả thẳng chuỗi base64
          : typeof o === 'string' ? o : lay(o, 'pdfBase64');
        if (typeof b64 === 'string') {
          const buf = Buffer.from(b64.replace(/^data:[^,]*,/, ''), 'base64');
          if (laPdf(buf)) return { duLieu: buf, ten };
        }
        const url = lay(o, 'url');
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) return this._taiTuUrl(url, ten);
      }
    }
    if (/^https?:\/\//i.test(hd.urlPdf || '')) return this._taiTuUrl(hd.urlPdf, ten);
    return null;
  }

  /** Link PDF thật thì tải về để gửi file; link trang tra cứu hoá đơn điện tử thì gửi nguyên link. */
  async _taiTuUrl(url, ten) {
    try {
      const cungMayChu = new URL(url).origin === new URL(this.c.url).origin;
      const res = await this.f(url, {
        headers: cungMayChu ? await this._header() : {},
        signal: AbortSignal.timeout(this.c.thoiGianCho),
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (laPdf(buf)) return { duLieu: buf, ten };
      }
    } catch (e) { /* không tải được: gửi link cho khách tự mở */ }
    return { url };
  }

  async _header() {
    const c = this.c;
    switch (c.xacThuc) {
      case 'bearer': return { Authorization: 'Bearer ' + c.khoa };
      case 'header': return { [c.tenHeader]: c.khoa };
      case 'basic': return { Authorization: 'Basic ' + Buffer.from(c.taiKhoan + ':' + c.matKhau).toString('base64') };
      case 'dangnhap': return { Authorization: 'Bearer ' + await this._layTokenDangNhap() };
      default: return {};
    }
  }

  async _layTokenDangNhap(lamMoi = false) {
    if (!lamMoi && this._token && this._token.het > this.bayGio()) return this._token.giaTri;
    if (!this._dangNhap) {
      this._dangNhap = (async () => {
        const c = this.c;
        const d = await this._goi(c.duong.dangNhap,
          { [c.truongTaiKhoan]: c.taiKhoan, [c.truongMatKhau]: c.matKhau }, false, false);
        const giaTri = lay(moGoi(d), 'token') ?? lay(d, 'token');
        if (!giaTri) throw new LoiEos('Đăng nhập EOS không trả về token — kiểm tra EOS_DUONG_DANG_NHAP, tài khoản, mật khẩu');
        this._token = { giaTri: String(giaTri), het: this.bayGio() + c.phutToken * 60e3 };
        return this._token.giaTri;
      })().finally(() => { this._dangNhap = null; });
    }
    return this._dangNhap;
  }

  /**
   * mau: "/api/khachhang/{maKH}" (GET) hoặc "POST /api/tracuu" (gửi các tham số dạng JSON).
   * Trả về JSON đã đọc (nhiPhan = false) hoặc { buf, loai }; null khi EOS báo 404 (không có).
   */
  async _goi(mau, thamSo, nhiPhan = false, xacThuc = true, lanThu = 0) {
    if (!mau) throw new LoiEos('Chưa khai đường dẫn API EOS cho bước này (EOS_DUONG_… trong .env)');
    const m = /^\s*(GET|POST)\s+(.+)$/i.exec(mau);
    const phuongThuc = m ? m[1].toUpperCase() : 'GET';
    const duong = (m ? m[2] : mau).trim()
      .replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(thamSo[k] == null ? '' : thamSo[k]));
    const url = /^https?:\/\//i.test(duong) ? duong : this.c.url + '/' + duong.replace(/^\/+/, '');
    const headers = { Accept: nhiPhan ? 'application/pdf, application/json' : 'application/json' };
    if (xacThuc) Object.assign(headers, await this._header());
    let body;
    if (phuongThuc === 'POST') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(thamSo);
    }

    let res;
    try {
      res = await this.f(url, { method: phuongThuc, headers, body, signal: AbortSignal.timeout(this.c.thoiGianCho) });
    } catch (e) {
      throw new LoiEos(`Không gọi được EOS (${phuongThuc} ${duongGon(url)}): ${e.message}`);
    }
    if (res.status === 401 && xacThuc && this.c.xacThuc === 'dangnhap' && lanThu === 0) {
      await this._layTokenDangNhap(true);
      return this._goi(mau, thamSo, nhiPhan, xacThuc, 1);
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      const loi = (await res.text().catch(() => '')).slice(0, 300);
      throw new LoiEos(`EOS trả lỗi HTTP ${res.status} (${phuongThuc} ${duongGon(url)}) ${loi}`);
    }
    if (nhiPhan) return { buf: Buffer.from(await res.arrayBuffer()), loai: res.headers.get('content-type') || '' };

    const chuoi = await res.text();
    if (!chuoi.trim()) return null;
    let d;
    try { d = JSON.parse(chuoi); } catch (e) {
      throw new LoiEos(`EOS không trả JSON (${phuongThuc} ${duongGon(url)}): ${chuoi.slice(0, 200)}`);
    }
    if (d && typeof d === 'object' && (d.success === false || d.Success === false)) {
      const tb = d.message || d.Message || d.error || 'không rõ lý do';
      if (/khong tim thay|not found|khong ton tai/i.test(boDau(tb))) return null;
      throw new LoiEos(`EOS báo lỗi (${phuongThuc} ${duongGon(url)}): ${typeof tb === 'string' ? tb : JSON.stringify(tb)}`);
    }
    return d;
  }
}

/** Bỏ phần query (có thể chứa mã khách hàng) khỏi thông báo lỗi ghi nhật ký. */
function duongGon(url) { return String(url).split('?')[0]; }

// ------------------------------------------------------------------ dữ liệu mẫu

const KH_MAU = [
  { maKH: 'KH0001', ten: 'Nguyễn Văn Mẫu', diaChi: 'Số 1 Đường Mẫu, Phường 1', soDienThoai: '0901234567',
    maDongHo: 'DH-0001', doiTuongGia: 'Sinh hoạt', trangThai: 'Đang sử dụng', binhQuan: 15 },
  { maKH: 'KH0002', ten: 'Cửa hàng Thử Nghiệm', diaChi: 'Số 2 Đường Mẫu, Phường 2', soDienThoai: '0912345678',
    maDongHo: 'DH-0002', doiTuongGia: 'Kinh doanh dịch vụ', trangThai: 'Đang sử dụng', binhQuan: 40 },
];
const DON_GIA_MAU = 9000;   // đ/m³, đã gồm thuế phí — chỉ để chạy thử

class EosMau {
  constructor({ bayGio = Date.now } = {}) { this.bayGio = bayGio; }

  async timKhachHang(maKH) {
    const kh = KH_MAU.find(k => k.maKH === maKH);
    if (!kh) return null;
    const { binhQuan, ...thongTin } = kh;
    return { ...thongTin };
  }

  /** 24 kỳ gần nhất (đến tháng trước), chỉ số cộng dồn; cùng mã KH luôn ra cùng số. */
  _cacKy(maKH) {
    const kh = KH_MAU.find(k => k.maKH === maKH);
    if (!kh) return [];
    const d = new Date(this.bayGio());
    let chiSo = 1000 + kh.maKH.charCodeAt(5) * 37;
    const ds = [];
    for (let i = 24; i >= 1; i--) {
      const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const ky = String(t.getMonth() + 1).padStart(2, '0') + '/' + t.getFullYear();
      const tieuThu = kh.binhQuan + ((t.getMonth() * 7 + kh.maKH.charCodeAt(5)) % 9) - 4;
      ds.push({ ky, chiSoCu: chiSo, chiSoMoi: chiSo + tieuThu, tieuThu, tienNuoc: tieuThu * DON_GIA_MAU });
      chiSo += tieuThu;
    }
    return ds.reverse();
  }

  async lichSu(maKH, soKyLay) { return this._cacKy(maKH).slice(0, soKyLay); }

  async dsHoaDon(maKH, soKyLay) {
    return this._cacKy(maKH).slice(0, soKyLay).map((k, i) => ({
      soHD: 'HD' + k.ky.slice(3) + k.ky.slice(0, 2) + '-' + maKH,
      ky: k.ky,
      tongTien: k.tienNuoc,
      daThanhToan: i > 0,          // kỳ mới nhất chưa thanh toán
      ngayPhatHanh: '',
      maTraCuu: '',
      urlPdf: '',
    }));
  }

  async taiHoaDon(maKH, hd) {
    const kh = await this.timKhachHang(maKH);
    const k = this._cacKy(maKH).find(x => x.ky === hd.ky);
    if (!kh || !k) return null;
    return {
      ten: tenTepHoaDon(maKH, hd),
      duLieu: taoPdf([
        'HOA DON TIEN NUOC (MAU - CHAY THU)',
        '',
        'So hoa don: ' + hd.soHD,
        'Ky: ' + hd.ky,
        'Ma khach hang: ' + kh.maKH,
        'Ten khach hang: ' + kh.ten,
        'Dia chi: ' + kh.diaChi,
        `Chi so: ${k.chiSoCu} -> ${k.chiSoMoi}`,
        `Tieu thu: ${k.tieuThu} m3`,
        `Tong tien: ${k.tienNuoc} dong`,
      ]),
    };
  }
}

/** PDF 1 trang khổ A4, chữ không dấu — đủ để thử gửi file qua Zalo. */
function taoPdf(dong) {
  const sach = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, m => '\\' + m);
  const noiDung = 'BT /F1 12 Tf 16 TL 50 790 Td\n' + dong.map(d => `(${sach(d)}) '`).join('\n') + '\nET';
  const doiTuong = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${noiDung.length} >>\nstream\n${noiDung}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const viTri = [];
  doiTuong.forEach((o, i) => { viTri.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${doiTuong.length + 1}\n0000000000 65535 f \n`;
  for (const v of viTri) pdf += String(v).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<< /Size ${doiTuong.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function taoEos(cfg, phuThuoc) {
  if (cfg.eos.cheDo === 'api') return new EosApi(cfg.eos, phuThuoc);
  if (cfg.eos.cheDo === 'mau') return new EosMau(phuThuoc);
  throw new LoiEos('EOS_CHE_DO phải là "mau" hoặc "api"');
}

module.exports = { taoEos, EosApi, EosMau, LoiEos, TRUONG, lay, mang, moGoi, taoPdf, laPdf };
