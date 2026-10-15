using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace QuanLyTaiSan
{
    public static class UngDung
    {
        public const string Ten = "Quản lý tài sản";
        public const string PhienBan = "1.0.0";
    }

    /// <summary>Quyền tăng dần: mỗi vai trò làm được mọi việc của vai trò thấp hơn.</summary>
    public enum VaiTro { Xem = 0, KiemTra = 1, CapNhat = 2, QuanTri = 3 }

    public static class TenVaiTro
    {
        public static string Cua(VaiTro v)
        {
            switch (v)
            {
                case VaiTro.QuanTri: return "Quản trị (toàn quyền)";
                case VaiTro.CapNhat: return "Cán bộ quản lý tài sản";
                case VaiTro.KiemTra: return "Nhân viên kiểm tra";
                default: return "Chỉ xem";
            }
        }

        public static string MoTa(VaiTro v)
        {
            switch (v)
            {
                case VaiTro.QuanTri: return "Mọi quyền: xoá tài sản, danh mục, tài khoản, cài đặt.";
                case VaiTro.CapNhat: return "Thêm / sửa tài sản, ảnh, bảo dưỡng, điều chuyển, thanh lý, in tem, nhập Excel, mở đợt kiểm kê.";
                case VaiTro.KiemTra: return "Quét QR, ghi kết quả kiểm tra / kiểm kê, báo hỏng, chụp ảnh.";
                default: return "Quét QR, xem thông tin và ảnh, xuất Excel.";
            }
        }
    }

    /// <summary>Tình trạng tài sản (mã ngắn lưu trong dữ liệu).</summary>
    public static class TinhTrang
    {
        public const string Tot = "tot", TheoDoi = "theodoi", Hong = "hong", DangSua = "dangsua", Ngung = "ngung", ThanhLy = "thanhly", Mat = "mat";

        public static readonly string[] Ma = { Tot, TheoDoi, Hong, DangSua, Ngung, ThanhLy, Mat };

        public static string Ten(string ma)
        {
            switch (ma)
            {
                case Tot: return "Đang sử dụng tốt";
                case TheoDoi: return "Cần theo dõi";
                case Hong: return "Hỏng, cần sửa chữa";
                case DangSua: return "Đang sửa chữa / bảo dưỡng";
                case Ngung: return "Ngừng sử dụng";
                case ThanhLy: return "Đã thanh lý";
                case Mat: return "Mất / không tìm thấy";
                default: return ma ?? "";
            }
        }

        public static bool HopLe(string ma) { return Array.IndexOf(Ma, ma) >= 0; }

        /// <summary>Tài sản còn quản lý (còn tính bảo dưỡng, còn đưa vào kiểm kê).</summary>
        public static bool ConDung(string ma) { return ma != ThanhLy && ma != Mat; }

        /// <summary>Đọc tên / mã người dùng gõ trong Excel ("Tốt", "hỏng", "Đã thanh lý"...).</summary>
        public static string TuChu(string s)
        {
            string k = VanBan.BoDau(s).Trim();
            if (k.Length == 0) return null;
            foreach (string m in Ma) if (k == m || k == VanBan.BoDau(Ten(m))) return m;
            if (k.Contains("thanh ly")) return ThanhLy;
            if (k.Contains("mat") || k.Contains("khong tim thay")) return Mat;
            if (k.Contains("dang sua") || k.Contains("bao duong")) return DangSua;
            if (k.Contains("hong") || k.Contains("sua chua")) return Hong;
            if (k.Contains("ngung") || k.Contains("khong su dung")) return Ngung;
            if (k.Contains("theo doi") || k.Contains("xuong cap")) return TheoDoi;
            if (k.Contains("tot") || k.Contains("binh thuong") || k.Contains("dang su dung")) return Tot;
            return null;
        }
    }

    /// <summary>Loại sự kiện trong lịch sử tài sản.</summary>
    public static class LoaiSuKien
    {
        public const string Tao = "tao", Sua = "sua", KiemTra = "kiemtra", BaoTri = "baotri", DieuChuyen = "dieuchuyen",
                            ThanhLy = "thanhly", Anh = "anh", KiemKe = "kiemke";

        public static string Ten(string ma)
        {
            switch (ma)
            {
                case Tao: return "Khai báo tài sản";
                case Sua: return "Sửa thông tin";
                case KiemTra: return "Kiểm tra";
                case BaoTri: return "Bảo dưỡng / sửa chữa";
                case DieuChuyen: return "Điều chuyển";
                case ThanhLy: return "Thanh lý";
                case Anh: return "Thêm ảnh";
                case KiemKe: return "Kiểm kê";
                default: return ma ?? "";
            }
        }
    }

    public class LoaiTaiSan
    {
        public int Id;
        public string Ten = "", TienTo = "", Nhom = "";
        public int SoNamKhauHao;          // 0 = không tính khấu hao
        public int ChuKyBaoTri;           // ngày; 0 = không theo dõi bảo dưỡng định kỳ
        public List<string> Truong = new List<string>();   // thông số kỹ thuật riêng của loại (vd "Công suất (kW)")
    }

    public class DonVi
    {
        public int Id;
        public string Ten = "", GhiChu = "";
    }

    public class TaiSan
    {
        public int Id;
        public int PhienBan = 1;          // tăng mỗi lần sửa: chặn 2 người sửa đè nhau
        public string Ma = "", Ten = "";
        public int LoaiId, DonViId;
        public string ViTri = "", NguoiSuDung = "", HangSX = "", Model = "", SoSeri = "", NuocSX = "", GhiChu = "";
        public int? NamSX;
        public DateTime? NgaySuDung, BaoHanhDen, BaoTriCuoi, KiemTraCuoi;
        public double? NguyenGia;
        public int? SoNamKhauHao, ChuKyBaoTri;   // null = theo loại
        public string TinhTrang = QuanLyTaiSan.TinhTrang.Tot;
        public double? ViDo, KinhDo;
        public readonly List<KeyValuePair<string, string>> ThongSo = new List<KeyValuePair<string, string>>();
        public readonly List<string> Anh = new List<string>();   // bộ ảnh của tài sản, ảnh mới nhất ở cuối
        public string AnhChinh = "";
        public DateTime Tao, Sua;
        public string NguoiTao = "", NguoiSua = "";

        string khoaTim;

        public string KhoaTim
        {
            get
            {
                if (khoaTim == null)
                    khoaTim = VanBan.BoDau(Ma + " " + Ten + " " + ViTri + " " + NguoiSuDung + " " + HangSX + " " + Model + " " + SoSeri + " " +
                                           GhiChu + " " + string.Join(" ", ThongSo.Select(t => t.Value)));
                return khoaTim;
            }
        }

        public void DaDoi() { khoaTim = null; }

        public string AnhDaiDien
        {
            get { return AnhChinh.Length > 0 && Anh.Contains(AnhChinh) ? AnhChinh : Anh.Count > 0 ? Anh[Anh.Count - 1] : null; }
        }

        public string LayThongSo(string ten)
        {
            foreach (var t in ThongSo) if (string.Equals(t.Key, ten, StringComparison.OrdinalIgnoreCase)) return t.Value;
            return "";
        }
    }

    public class SuKien
    {
        public long Id;
        public int TaiSan;
        public string Loai = "";
        public DateTime Luc;
        public string Nguoi = "", HoTen = "";
        public string TinhTrang;        // tình trạng ghi nhận (kiểm tra, kiểm kê, sau bảo dưỡng)
        public string NoiDung = "";     // ghi chú người nhập
        public string ChiTiet = "";     // thay đổi do phần mềm ghi (vd "Đơn vị: A → B")
        public double? ChiPhi;
        public double? ViDo, KinhDo;
        public int Dot;                 // đợt kiểm kê
        public List<string> Anh = new List<string>();
    }

    public class DotKiemKe
    {
        public int Id;
        public string Ten = "", GhiChu = "", NguoiTao = "";
        public DateTime TuNgay, Tao;
        public DateTime? DenNgay;
        public bool Dong;
        public List<int> DonVi = new List<int>();     // rỗng = toàn công ty
        public HashSet<int> DanhSach = new HashSet<int>();   // tài sản trên sổ sách lúc mở đợt
        // kết quả: tài sản → lần kiểm kê cuối (dựng lại từ lịch sử khi mở dữ liệu)
        public readonly Dictionary<int, SuKien> KetQua = new Dictionary<int, SuKien>();
    }

    public class CaiDat
    {
        public string TenCongTy = "CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG";
        public string DiaChiQr = "";       // địa chỉ in trong mã QR, vd https://tenmien.vn:8080/taisan ; "" = địa chỉ đang mở
        public string DiaDanh = "Hậu Giang";
        public string NguoiLap = "", KeToanTruong = "", GiamDoc = "";
        public int NgayNhacKiemTra = 180;  // nhắc tài sản lâu chưa kiểm tra
    }

    public class DuLieu
    {
        public readonly CaiDat CaiDat = new CaiDat();
        public readonly List<LoaiTaiSan> Loai = new List<LoaiTaiSan>();
        public readonly List<DonVi> DonVi = new List<DonVi>();
        public readonly List<TaiSan> TaiSan = new List<TaiSan>();
        public readonly List<DotKiemKe> KiemKe = new List<DotKiemKe>();
        public readonly Dictionary<string, int> SoMa = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);   // tiền tố → số cuối đã cấp
        public int IdTaiSan, IdLoai, IdDonVi, IdKiemKe;
        public long IdSuKien;

        // chỉ mục (không lưu)
        readonly Dictionary<int, TaiSan> theoId = new Dictionary<int, TaiSan>();
        readonly Dictionary<string, TaiSan> theoMa = new Dictionary<string, TaiSan>(StringComparer.OrdinalIgnoreCase);

        public void LapChiMuc()
        {
            theoId.Clear();
            theoMa.Clear();
            foreach (TaiSan t in TaiSan)
            {
                theoId[t.Id] = t;
                theoMa[t.Ma] = t;
            }
        }

        public TaiSan Tim(int id) { TaiSan t; return theoId.TryGetValue(id, out t) ? t : null; }
        public TaiSan TimMa(string ma) { TaiSan t; return ma != null && theoMa.TryGetValue(ma, out t) ? t : null; }
        public LoaiTaiSan TimLoai(int id) { return Loai.FirstOrDefault(l => l.Id == id); }
        public DonVi TimDonVi(int id) { return DonVi.FirstOrDefault(d => d.Id == id); }
        public DotKiemKe TimDot(int id) { return KiemKe.FirstOrDefault(d => d.Id == id); }

        public void Them(TaiSan t)
        {
            TaiSan.Add(t);
            theoId[t.Id] = t;
            theoMa[t.Ma] = t;
        }

        public void Bo(TaiSan t)
        {
            TaiSan.Remove(t);
            theoId.Remove(t.Id);
            theoMa.Remove(t.Ma);
        }

        public void DoiMa(TaiSan t, string maMoi)
        {
            theoMa.Remove(t.Ma);
            t.Ma = maMoi;
            theoMa[maMoi] = t;
        }

        public string TenLoai(int id) { LoaiTaiSan l = TimLoai(id); return l == null ? "" : l.Ten; }
        public string TenDonVi(int id) { DonVi d = TimDonVi(id); return d == null ? "" : d.Ten; }

        /// <summary>Ghi nhận mã đã dùng để mã tự cấp sau này không trùng (vd "MB-00012" → MB: 12).</summary>
        public void GhiNhanMa(string ma)
        {
            Match m = Regex.Match(ma ?? "", @"^(.+)-(\d{1,9})$");
            if (!m.Success) return;
            int so = int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
            int cu;
            if (!SoMa.TryGetValue(m.Groups[1].Value, out cu) || cu < so) SoMa[m.Groups[1].Value] = so;
        }

        /// <summary>Mã kế tiếp của tiền tố, vd "MB-00013" (không đánh dấu đã dùng).</summary>
        public string MaKeTiep(string tienTo, int cong)
        {
            tienTo = MaTaiSan.ChuanTienTo(tienTo);
            int so;
            SoMa.TryGetValue(tienTo, out so);
            for (int i = so + cong; ; i++)
            {
                string ma = tienTo + "-" + i.ToString("00000", CultureInfo.InvariantCulture);
                if (TimMa(ma) == null) return ma;
            }
        }

        public string CapMa(string tienTo)
        {
            string ma = MaKeTiep(tienTo, 1);
            GhiNhanMa(ma);
            return ma;
        }

        public static DuLieu MacDinh()
        {
            var d = new DuLieu();
            Action<string, string, string, int, int, string[]> loai = (ten, tienTo, nhom, soNam, chuKy, truong) =>
                d.Loai.Add(new LoaiTaiSan { Id = ++d.IdLoai, Ten = ten, TienTo = tienTo, Nhom = nhom, SoNamKhauHao = soNam, ChuKyBaoTri = chuKy, Truong = truong.ToList() });
            const string nha = "Nhà cửa, vật kiến trúc", may = "Máy móc, thiết bị", tdan = "Phương tiện vận tải, thiết bị truyền dẫn",
                         ql = "Thiết bị, dụng cụ quản lý", khac = "Tài sản cố định khác";
            loai("Máy bơm", "MB", may, 8, 90, new[] { "Lưu lượng (m³/h)", "Cột áp (m)", "Công suất (kW)", "Điện áp (V)" });
            loai("Động cơ, tủ điện, biến tần", "TD", may, 8, 180, new[] { "Công suất (kW)", "Điện áp (V)", "Dòng định mức (A)" });
            loai("Máy phát điện", "MP", may, 8, 90, new[] { "Công suất (kVA)", "Nhiên liệu" });
            loai("Thiết bị xử lý nước (lọc, châm hoá chất)", "XL", may, 10, 90, new[] { "Công suất xử lý (m³/ngày)", "Loại hoá chất" });
            loai("Đồng hồ tổng, thuỷ lượng kế", "DH", may, 5, 365, new[] { "Cỡ (DN, mm)", "Kiểu (điện từ / siêu âm / cơ)", "Hệ số nhân", "Hạn kiểm định" });
            loai("Van, trụ cứu hoả", "VA", tdan, 10, 180, new[] { "Cỡ (DN, mm)", "Loại van" });
            loai("Đường ống cấp nước", "DO", tdan, 20, 0, new[] { "Đường kính (mm)", "Vật liệu", "Chiều dài (m)", "Tuyến" });
            loai("Giếng khoan", "GK", nha, 10, 180, new[] { "Độ sâu (m)", "Lưu lượng (m³/h)", "Số giấy phép khai thác" });
            loai("Nhà trạm, bể chứa, đài nước", "NC", nha, 25, 365, new[] { "Dung tích (m³)", "Diện tích (m²)", "Kết cấu" });
            loai("Xe, phương tiện vận tải", "XE", tdan, 8, 180, new[] { "Biển số", "Tải trọng / số chỗ", "Hạn đăng kiểm" });
            loai("Thiết bị văn phòng, tin học", "VP", ql, 5, 0, new[] { "Cấu hình" });
            loai("Dụng cụ, thiết bị thi công", "DC", ql, 5, 0, new string[0]);
            loai("Tài sản khác", "TS", khac, 5, 0, new string[0]);
            foreach (string ten in new[] { "Phòng Kỹ thuật", "Phòng Kế toán - Tài vụ", "Phòng Tổ chức - Hành chính", "Phòng Kinh doanh",
                                           "Đội Cấp nước số 1", "Đội Cấp nước số 2", "Đội Cấp nước số 3", "Đội Cấp nước số 4",
                                           "Đội Cấp nước số 5", "Đội Cấp nước số 6" })
                d.DonVi.Add(new DonVi { Id = ++d.IdDonVi, Ten = ten });
            return d;
        }
    }

    /// <summary>Quy tắc mã tài sản: chữ in hoa không dấu, số, "-", ".", "_" (không có "/" vì mã nằm trong đường dẫn của QR).</summary>
    public static class MaTaiSan
    {
        static readonly Regex HopLeRe = new Regex(@"^[A-Z0-9][A-Z0-9._-]{0,39}$");

        public static string Chuan(string ma)
        {
            string s = VanBan.BoDauGiuHoa(ma ?? "").Trim().ToUpperInvariant().Replace(' ', '-');
            return s;
        }

        public static bool HopLe(string ma) { return ma != null && HopLeRe.IsMatch(ma); }

        public static string ChuanTienTo(string t)
        {
            string s = Chuan(t).Trim('-', '.', '_');
            if (s.Length == 0) s = "TS";
            return s.Length > 12 ? s.Substring(0, 12) : s;
        }
    }

    public static class VanBan
    {
        /// <summary>So sánh tên theo tiếng Việt (không phụ thuộc ngôn ngữ cài trên máy chủ).</summary>
        public static readonly StringComparer SoSanhTen = StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), true);

        public static string BoDau(string s)
        {
            return BoDauGiuHoa(s).ToLowerInvariant();
        }

        public static string BoDauGiuHoa(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            string d = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (char c in d)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
                if (c == 'đ') sb.Append('d');
                else if (c == 'Đ') sb.Append('D');
                else if (char.IsWhiteSpace(c)) sb.Append(' ');
                else sb.Append(c);
            }
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }

        public static string Cat(string s, int n)
        {
            s = (s ?? "").Trim();
            return s.Length > n ? s.Substring(0, n) : s;
        }

        static readonly string[] DangNgay = { "yyyy-MM-dd", "d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "d.M.yyyy", "yyyy/M/d", "M/yyyy", "yyyy" };

        /// <summary>Ngày dạng "2026-10-15", "15/10/2026", "10/2026", "2026" (null khi trống, ném lỗi khi sai).</summary>
        public static DateTime? Ngay(string s, string tenTruong)
        {
            s = (s ?? "").Trim();
            if (s.Length == 0) return null;
            int t = s.IndexOf('T');
            if (t == 10) s = s.Substring(0, 10);
            DateTime d;
            if (DateTime.TryParseExact(s, DangNgay, CultureInfo.InvariantCulture, DateTimeStyles.None, out d) && d.Year >= 1900 && d.Year <= 2200)
                return d.Date;
            throw new LoiApi(400, tenTruong + ": ngày không hợp lệ \"" + s + "\" (ghi dạng ngày/tháng/năm).");
        }

        public static string NgayVn(DateTime? d) { return d.HasValue ? d.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : ""; }
        public static string NgayIso(DateTime? d) { return d.HasValue ? d.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null; }
    }

    /// <summary>Các số tính từ thông tin tài sản: khấu hao đường thẳng (tham khảo), hạn bảo dưỡng.</summary>
    public static class TinhToan
    {
        public static int SoNamKhauHao(DuLieu d, TaiSan t)
        {
            if (t.SoNamKhauHao.HasValue) return t.SoNamKhauHao.Value;
            LoaiTaiSan l = d.TimLoai(t.LoaiId);
            return l == null ? 0 : l.SoNamKhauHao;
        }

        public static int ChuKyBaoTri(DuLieu d, TaiSan t)
        {
            if (t.ChuKyBaoTri.HasValue) return t.ChuKyBaoTri.Value;
            LoaiTaiSan l = d.TimLoai(t.LoaiId);
            return l == null ? 0 : l.ChuKyBaoTri;
        }

        /// <summary>Khấu hao luỹ kế tới ngày <paramref name="den"/> theo phương pháp đường thẳng, tính theo ngày sử dụng.</summary>
        public static double? KhauHaoLuyKe(DuLieu d, TaiSan t, DateTime den)
        {
            int nam = SoNamKhauHao(d, t);
            if (!t.NguyenGia.HasValue || !t.NgaySuDung.HasValue || nam <= 0) return null;
            double ngay = (den.Date - t.NgaySuDung.Value.Date).TotalDays;
            if (ngay <= 0) return 0;
            double tyLe = Math.Min(1.0, ngay / (nam * 365.0));
            return Math.Round(t.NguyenGia.Value * tyLe);
        }

        public static double? GiaTriConLai(DuLieu d, TaiSan t, DateTime den)
        {
            double? kh = KhauHaoLuyKe(d, t, den);
            if (!t.NguyenGia.HasValue) return null;
            return t.NguyenGia.Value - (kh ?? 0);
        }

        /// <summary>
        /// Ngày đến hạn bảo dưỡng kế tiếp (null = không theo dõi). Chưa ghi lần bảo dưỡng nào: tính từ ngày khai báo vào phần mềm
        /// (hoặc ngày đưa vào sử dụng nếu muộn hơn) — tránh báo "quá hạn hàng nghìn ngày" cho tài sản cũ vừa nhập.
        /// </summary>
        public static DateTime? HanBaoTri(DuLieu d, TaiSan t)
        {
            int ck = ChuKyBaoTri(d, t);
            if (ck <= 0 || !QuanLyTaiSan.TinhTrang.ConDung(t.TinhTrang) || t.TinhTrang == QuanLyTaiSan.TinhTrang.Ngung) return null;
            DateTime goc = t.BaoTriCuoi.HasValue ? t.BaoTriCuoi.Value
                         : t.NgaySuDung.HasValue && t.NgaySuDung.Value > t.Tao.Date ? t.NgaySuDung.Value : t.Tao.Date;
            return goc.Date.AddDays(ck);
        }
    }
}
