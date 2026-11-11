using System;
using System.Collections.Generic;
using System.Linq;

namespace ThatThoatNuoc
{
    public static class UngDung
    {
        public const string Ten = "Quản lý thất thoát nước";
        public const string PhienBan = "1.0.0";
    }

    /// <summary>Cách tính sản lượng phát ra của 1 dòng.</summary>
    public enum LoaiMuc
    {
        DongHo,     // TLK: chỉ số hiện tại − chỉ số tháng trước
        NhapTay,    // nhập thẳng số m³ (vd súc xả đường ống)
        CongThuc    // cộng/trừ sản lượng các dòng khác
    }

    public enum LoaiChuanThu
    {
        Khong,      // dòng không tính thất thoát
        Nhap,       // nhập số chuẩn thu
        CongThuc    // cộng chuẩn thu các dòng khác (vd Đội = KV1 + KV2)
    }

    /// <summary>Dòng nào được đưa vào các bảng tổng hợp.</summary>
    public enum VaiTro
    {
        Khac,
        Doi,
        KhuVuc,
        ToanCongTy,
        Dma
    }

    /// <summary>Một số hạng trong công thức: hệ số × giá trị dòng [Id].</summary>
    public class SoHang
    {
        public int Id;
        public double HeSo;

        public SoHang(int id, double heSo)
        {
            Id = id;
            HeSo = heSo;
        }
    }

    /// <summary>
    /// Một dòng của báo cáo tháng (TLK, khu vực, đội...). Mỗi tháng giữ bản cấu trúc riêng
    /// giống như mỗi tháng là 1 trang Excel; Id giữ nguyên qua các tháng để nối lũy kế, so sánh.
    /// </summary>
    public class Muc
    {
        // ---- Cấu trúc ----
        public int Id;
        public string Stt = "";
        public string Ten = "";
        public string TenNgan = "";        // tên dùng trong bảng tổng hợp (vd "KV. Long Mỹ"); trống = Ten
        public int Cap;                    // 0 = nhóm lớn (A, B, I, II...) in đậm
        public LoaiMuc Loai;
        public List<SoHang> CongThuc = new List<SoHang>();
        public bool LamTron;               // ROUND(...; 0) như trong Excel
        public string MoTa;                // chữ ở cột chỉ số của dòng công thức; null = tự tạo
        public double SaiSo;               // % TLK chạy nhanh (+) / chậm (−): sản lượng = (mới − cũ) × 100 / (100 + sai số)
        public LoaiChuanThu ChuanThuLoai;
        public List<SoHang> CongThucChuanThu = new List<SoHang>();
        public VaiTro VaiTro;
        public bool AnBaoCaoThang;         // chỉ hiện trong bảng tổng hợp (vd DMA)

        // ---- Số liệu của tháng ----
        public double? ChiSoCu, ChiSoMoi;
        public double? ChotCu, DauMoi;     // thay / reset đồng hồ trong kỳ
        public double DieuChinh;           // cộng thêm (+) / trừ bớt (−) m³
        public double? SanLuong;           // NhapTay: số nhập; loại khác: ghi đè kết quả tính
        public double? ChuanThu;
        public double? CungKyThang, CungKyLuyKe;     // % cùng kỳ năm trước (nhập tay khi chưa có số liệu năm trước)
        public double? TyLeThangTruoc;               // % tháng trước (nhập tay khi chưa có tháng trước)
        public double? LuyKePhatRaTruoc, LuyKeChuanThuTruoc;   // lũy kế các tháng trước (khi chưa có các tháng đó)
        public double? TyLeNhap;           // % thất thoát gõ thẳng (vd DMA chỉ có tỷ lệ), dùng khi chưa có sản lượng / chuẩn thu
        public string GhiChu = "";         // DMA: tình trạng tháng (vd "TLK đứng kim") hiện thay cho tỷ lệ trong bảng tổng hợp

        public bool ThayDongHo { get { return ChotCu.HasValue || DauMoi.HasValue; } }
        public bool CoChuanThu { get { return ChuanThuLoai != LoaiChuanThu.Khong; } }
        public bool GhiDe { get { return Loai != LoaiMuc.NhapTay && SanLuong.HasValue; } }
        public string TenTongHop { get { return string.IsNullOrWhiteSpace(TenNgan) ? TenMotDong : TenNgan; } }

        /// <summary>Tên viết liền 1 dòng (tên trong Excel cũ có chỗ xuống dòng).</summary>
        public string TenMotDong
        {
            get { return string.Join(" ", (Ten ?? "").Split(new[] { ' ', '\r', '\n', '\t' }, StringSplitOptions.RemoveEmptyEntries)); }
        }

        /// <summary>Chép phần cấu trúc (dùng khi tạo tháng mới).</summary>
        public Muc ChepCauTruc()
        {
            var m = new Muc();
            m.Id = Id;
            m.Stt = Stt;
            m.Ten = Ten;
            m.TenNgan = TenNgan;
            m.Cap = Cap;
            m.Loai = Loai;
            m.CongThuc = ChepSoHang(CongThuc);
            m.LamTron = LamTron;
            m.MoTa = MoTa;
            m.SaiSo = SaiSo;
            m.ChuanThuLoai = ChuanThuLoai;
            m.CongThucChuanThu = ChepSoHang(CongThucChuanThu);
            m.VaiTro = VaiTro;
            m.AnBaoCaoThang = AnBaoCaoThang;
            return m;
        }

        public Muc Chep()
        {
            Muc m = ChepCauTruc();
            m.ChiSoCu = ChiSoCu;
            m.ChiSoMoi = ChiSoMoi;
            m.ChotCu = ChotCu;
            m.DauMoi = DauMoi;
            m.DieuChinh = DieuChinh;
            m.SanLuong = SanLuong;
            m.ChuanThu = ChuanThu;
            m.CungKyThang = CungKyThang;
            m.CungKyLuyKe = CungKyLuyKe;
            m.TyLeThangTruoc = TyLeThangTruoc;
            m.LuyKePhatRaTruoc = LuyKePhatRaTruoc;
            m.LuyKeChuanThuTruoc = LuyKeChuanThuTruoc;
            m.TyLeNhap = TyLeNhap;
            m.GhiChu = GhiChu;
            return m;
        }

        public static List<SoHang> ChepSoHang(List<SoHang> list)
        {
            return list.Select(s => new SoHang(s.Id, s.HeSo)).ToList();
        }

        public override string ToString()
        {
            return (Stt.Length > 0 ? Stt + " " : "") + TenMotDong;
        }
    }

    public class NguoiKy
    {
        public string Dong1 = "";   // vd "KT. GIÁM ĐỐC"
        public string Dong2 = "";   // vd "PHÓ GIÁM ĐỐC"
        public string Ten = "";

        public NguoiKy() { }

        public NguoiKy(string dong1, string dong2, string ten)
        {
            Dong1 = dong1;
            Dong2 = dong2;
            Ten = ten;
        }

        public NguoiKy Chep() { return new NguoiKy(Dong1, Dong2, Ten); }
    }

    /// <summary>Một tháng báo cáo (= 1 trang "Tháng N-YYYY" trong Excel).</summary>
    public class ThangBaoCao
    {
        public int Nam, Thang;
        public string KyHoaDon = "";       // vd "10/2026"
        public DateTime? TuNgay, DenNgay;  // thời gian nước tiêu thụ
        public DateTime? NgayLap;
        public string GhiChu = "";
        public NguoiKy[] Ky = { new NguoiKy(), new NguoiKy(), new NguoiKy() };   // trái, giữa, phải (lập biểu)
        public List<Muc> Muc = new List<Muc>();

        /// <summary>Số thứ tự tháng liên tục qua các năm, để so sánh/tìm tháng trước.</summary>
        public int SoThu { get { return Nam * 12 + Thang - 1; } }
        public string Ten { get { return "Tháng " + Thang + "/" + Nam; } }
        public string TenTrang { get { return "Tháng " + Thang + "-" + Nam; } }

        public Muc Tim(int id)
        {
            foreach (Muc m in Muc) if (m.Id == id) return m;
            return null;
        }

        public int ViTri(int id)
        {
            for (int i = 0; i < Muc.Count; i++) if (Muc[i].Id == id) return i;
            return -1;
        }

        public static string KyMacDinh(int nam, int thang)
        {
            return thang == 12 ? "1/" + (nam + 1) : (thang + 1) + "/" + nam;
        }
    }

    public class CaiDat
    {
        public string TenCongTy1 = "CÔNG TY TNHH MTV";
        public string TenCongTy2 = "CẤP NƯỚC HẬU GIANG";
        public string DiaDanh = "TP. Cần Thơ";
        public NguoiKy[] KyMacDinh =
        {
            new NguoiKy("KT. GIÁM ĐỐC", "PHÓ GIÁM ĐỐC", ""),
            new NguoiKy("PHÒNG KINH DOANH - VẬT TƯ", "TRƯỞNG PHÒNG", ""),
            new NguoiKy("LẬP BIỂU", "", "")
        };
        public double NguongCanhBao = 30;  // % sản lượng tăng/giảm so với tháng trước thì nhắc kiểm tra
        public string ThuMucXuat = "";     // thư mục lưu file Excel lần trước
    }

    /// <summary>Số so sánh nhập tay cho báo cáo quý (khi chưa có số liệu quý trước / năm trước).</summary>
    public class SoSanhQuy
    {
        public double? QuyTruoc, CungKy;
    }

    public enum LoaiChiTieu { PhatRa, ChuanThu, DoanhThu, TyLe, TonHoaDon }

    /// <summary>Kế hoạch giao chỉ tiêu năm của 1 đơn vị (như trang "KẾ HOẠCH GIAO CHỈ TIÊU NĂM").</summary>
    public class ChiTieu
    {
        public double? PhatRa;      // sản lượng phát ra (m³)
        public double? ChuanThu;    // sản lượng chuẩn thu (m³)
        public double? DoanhThu;    // doanh thu tiền nước (đồng)
        public double? TyLe;        // tỷ lệ thất thoát nước (%)
        public double? TonHoaDon;   // tồn hoá đơn nước (%)

        public bool Trong
        {
            get { return !PhatRa.HasValue && !ChuanThu.HasValue && !DoanhThu.HasValue && !TyLe.HasValue && !TonHoaDon.HasValue; }
        }

        public double? Lay(LoaiChiTieu l)
        {
            switch (l)
            {
                case LoaiChiTieu.PhatRa: return PhatRa;
                case LoaiChiTieu.ChuanThu: return ChuanThu;
                case LoaiChiTieu.DoanhThu: return DoanhThu;
                case LoaiChiTieu.TyLe: return TyLe;
                default: return TonHoaDon;
            }
        }

        public void Dat(LoaiChiTieu l, double? v)
        {
            switch (l)
            {
                case LoaiChiTieu.PhatRa: PhatRa = v; break;
                case LoaiChiTieu.ChuanThu: ChuanThu = v; break;
                case LoaiChiTieu.DoanhThu: DoanhThu = v; break;
                case LoaiChiTieu.TyLe: TyLe = v; break;
                default: TonHoaDon = v; break;
            }
        }

        public ChiTieu Chep() { return (ChiTieu)MemberwiseClone(); }
    }

    /// <summary>Toàn bộ dữ liệu của phần mềm.</summary>
    public class DuLieu
    {
        public CaiDat CaiDat = new CaiDat();
        public List<ThangBaoCao> Thang = new List<ThangBaoCao>();
        public Dictionary<int, Dictionary<int, ChiTieu>> KeHoach = new Dictionary<int, Dictionary<int, ChiTieu>>();
        public Dictionary<int, Dictionary<int, SoSanhQuy>> Quy = new Dictionary<int, Dictionary<int, SoSanhQuy>>();
        public DuLieuCap1 Cap1 = new DuLieuCap1();   // đồng hồ cấp 1 / sản lượng khai thác (tách riêng báo cáo thất thoát)
        public int NextId = 1;

        public int CapId()
        {
            return NextId++;
        }

        public ThangBaoCao TimThang(int nam, int thang)
        {
            return TimThang(nam * 12 + thang - 1);
        }

        public ThangBaoCao TimThang(int soThu)
        {
            foreach (ThangBaoCao t in Thang) if (t.SoThu == soThu) return t;
            return null;
        }

        public ThangBaoCao ThangCuoi
        {
            get { return Thang.Count == 0 ? null : Thang[Thang.Count - 1]; }
        }

        public void SapXep()
        {
            Thang.Sort((a, b) => a.SoThu.CompareTo(b.SoThu));
        }

        public List<int> CacNam()
        {
            return Thang.Select(t => t.Nam).Distinct().OrderBy(n => n).ToList();
        }

        /// <summary>Tỷ lệ thất thoát kế hoạch (%) — dùng cho cột "So kế hoạch".</summary>
        public double? LayKeHoach(int nam, int id)
        {
            return LayKeHoach(nam, id, LoaiChiTieu.TyLe);
        }

        public void DatKeHoach(int nam, int id, double? giaTri)
        {
            DatKeHoach(nam, id, LoaiChiTieu.TyLe, giaTri);
        }

        public ChiTieu LayChiTieu(int nam, int id)
        {
            Dictionary<int, ChiTieu> d;
            ChiTieu c;
            return KeHoach.TryGetValue(nam, out d) && d.TryGetValue(id, out c) ? c : null;
        }

        public double? LayKeHoach(int nam, int id, LoaiChiTieu loai)
        {
            ChiTieu c = LayChiTieu(nam, id);
            return c != null ? c.Lay(loai) : null;
        }

        public void DatKeHoach(int nam, int id, LoaiChiTieu loai, double? giaTri)
        {
            Dictionary<int, ChiTieu> d;
            if (!KeHoach.TryGetValue(nam, out d))
            {
                if (!giaTri.HasValue) return;
                d = new Dictionary<int, ChiTieu>();
                KeHoach[nam] = d;
            }
            ChiTieu c;
            if (!d.TryGetValue(id, out c))
            {
                if (!giaTri.HasValue) return;
                c = new ChiTieu();
                d[id] = c;
            }
            c.Dat(loai, giaTri);
            if (c.Trong) d.Remove(id);
            if (d.Count == 0) KeHoach.Remove(nam);
        }

        public bool CoKeHoach(int nam)
        {
            Dictionary<int, ChiTieu> d;
            return KeHoach.TryGetValue(nam, out d) && d.Count > 0;
        }

        public static int KhoaQuy(int nam, int quy) { return nam * 10 + quy; }

        public SoSanhQuy LaySoSanhQuy(int nam, int quy, int id, bool tao)
        {
            Dictionary<int, SoSanhQuy> d;
            int key = KhoaQuy(nam, quy);
            if (!Quy.TryGetValue(key, out d))
            {
                if (!tao) return null;
                d = new Dictionary<int, SoSanhQuy>();
                Quy[key] = d;
            }
            SoSanhQuy s;
            if (!d.TryGetValue(id, out s) && tao)
            {
                s = new SoSanhQuy();
                d[id] = s;
            }
            return s;
        }

        /// <summary>
        /// Tạo tháng kế tiếp từ tháng [truoc]: chép cấu trúc, chỉ số cũ = chỉ số mới tháng trước,
        /// kỳ hoá đơn và thời gian tiêu thụ nối tiếp, người ký giữ nguyên.
        /// </summary>
        public ThangBaoCao TaoThangSau(ThangBaoCao truoc)
        {
            var t = new ThangBaoCao();
            t.Nam = truoc.Thang == 12 ? truoc.Nam + 1 : truoc.Nam;
            t.Thang = truoc.Thang == 12 ? 1 : truoc.Thang + 1;
            t.KyHoaDon = ThangBaoCao.KyMacDinh(t.Nam, t.Thang);
            if (truoc.DenNgay.HasValue)
            {
                t.TuNgay = truoc.DenNgay;
                t.DenNgay = truoc.DenNgay.Value.AddMonths(1);
            }
            for (int i = 0; i < 3; i++) t.Ky[i] = truoc.Ky[i].Chep();
            foreach (Muc m in truoc.Muc)
            {
                Muc n = m.ChepCauTruc();
                if (m.Loai == LoaiMuc.DongHo) n.ChiSoCu = m.ChiSoMoi;
                t.Muc.Add(n);
            }
            return t;
        }

        /// <summary>Tháng đầu tiên khi chưa có dữ liệu: cấu trúc trống.</summary>
        public ThangBaoCao TaoThangTrong(int nam, int thang)
        {
            var t = new ThangBaoCao();
            t.Nam = nam;
            t.Thang = thang;
            t.KyHoaDon = ThangBaoCao.KyMacDinh(nam, thang);
            for (int i = 0; i < 3; i++) t.Ky[i] = CaiDat.KyMacDinh[i].Chep();
            return t;
        }
    }
}
