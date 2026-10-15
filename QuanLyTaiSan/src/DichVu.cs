using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Xml.Linq;

namespace QuanLyTaiSan
{
    public class TaiKhoan
    {
        public string Ten = "", HoTen = "";
        public VaiTro VaiTro = VaiTro.Xem;
        public int DonVi = -1;             // chỉ được sửa / kiểm tra tài sản của đơn vị này (-1 = mọi đơn vị)
        public string Muoi = "", Bam = "";
        public int LapLai = 100000;
        public bool Khoa;
    }

    class DangChayException : Exception
    {
        public DangChayException() : base("Thư mục dữ liệu đang được 1 tiến trình QuanLyTaiSan khác dùng.") { }
    }

    class PhienDangNhap
    {
        public string MaBam, Ten, ThietBi;
        public DateTime Tao, Dung;
    }

    class TepTam
    {
        public byte[] Than;
        public string Loai, Ten;
        public DateTime HetHan;
    }

    /// <summary>
    /// Dịch vụ máy chủ: dữ liệu tài sản (Kho) + tài khoản và phiên đăng nhập (taikhoan.xml). Mọi thay đổi đều qua 1 khoá.
    /// Phần nghiệp vụ tài sản ở NghiepVu.cs.
    /// </summary>
    partial class DichVu
    {
        const int NgayGiuPhien = 60;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public readonly object Khoa = new object();
        public readonly string ThuMuc;
        public readonly Kho Kho;
        readonly Dictionary<string, TaiKhoan> taiKhoan = new Dictionary<string, TaiKhoan>(StringComparer.OrdinalIgnoreCase);
        readonly Dictionary<string, PhienDangNhap> phien = new Dictionary<string, PhienDangNhap>();
        readonly Dictionary<string, int[]> saiMatKhau = new Dictionary<string, int[]>();    // ip|tên → số lần, phút
        readonly Dictionary<string, TepTam> tepTam = new Dictionary<string, TepTam>();
        DateTime luuPhienLuc = DateTime.MinValue;
        readonly object khoaNhatKy = new object();

        string TepTaiKhoan { get { return Path.Combine(ThuMuc, "taikhoan.xml"); } }

        FileStream khoaThuMuc;   // giữ suốt thời gian chạy: 2 tiến trình không cùng ghi 1 thư mục dữ liệu

        /// <param name="choGiay">chờ tiến trình cũ (IIS đang khởi động lại) nhả thư mục dữ liệu tối đa bấy nhiêu giây</param>
        public DichVu(string thuMuc, int choGiay)
        {
            ThuMuc = thuMuc;
            Directory.CreateDirectory(thuMuc);
            for (int i = 0; ; i++)
            {
                try
                {
                    khoaThuMuc = new FileStream(Path.Combine(thuMuc, "dang-chay.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                    break;
                }
                catch (IOException)
                {
                    if (i >= choGiay * 2) throw new DangChayException();
                    Thread.Sleep(500);
                }
            }
            Kho = new Kho(thuMuc);
            Kho.Mo();
            DocTaiKhoan();
        }

        public DuLieu Dl { get { return Kho.DuLieu; } }

        // ------------------------------------------------------------------ nhật ký máy chủ

        public void Ghi(string s)
        {
            try
            {
                lock (khoaNhatKy)
                {
                    string dir = Path.Combine(ThuMuc, "NhatKy");
                    Directory.CreateDirectory(dir);
                    File.AppendAllText(Path.Combine(dir, "maychu-" + DateTime.Now.ToString("yyyy-MM", Inv) + ".txt"),
                                       DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", Inv) + "  " + s + "\r\n", Encoding.UTF8);
                }
            }
            catch (Exception) { }
        }

        public void Dung()
        {
            lock (Khoa)
            {
                LuuTaiKhoan();
                if (khoaThuMuc != null) { khoaThuMuc.Dispose(); khoaThuMuc = null; }
            }
        }

        // ------------------------------------------------------------------ mật khẩu

        static string Bam(string matKhau, string muoi, int lap)
        {
            using (var k = new Rfc2898DeriveBytes(Encoding.UTF8.GetBytes(matKhau), Convert.FromBase64String(muoi), lap))
                return Convert.ToBase64String(k.GetBytes(32));
        }

        public static string NgauNhien(int n)
        {
            var b = new byte[n];
            using (var r = RandomNumberGenerator.Create()) r.GetBytes(b);
            return Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        static string Sha(string s)
        {
            using (var sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(s))).Replace("-", "");
        }

        static void DatMatKhau(TaiKhoan t, string matKhau)
        {
            var b = new byte[16];
            using (var r = RandomNumberGenerator.Create()) r.GetBytes(b);
            t.Muoi = Convert.ToBase64String(b);
            t.LapLai = 100000;
            t.Bam = Bam(matKhau, t.Muoi, t.LapLai);
        }

        public static void KiemMatKhau(string mk)
        {
            if (string.IsNullOrEmpty(mk) || mk.Length < 6) throw new LoiApi(400, "Mật khẩu phải có ít nhất 6 ký tự.");
        }

        public static bool BangNhau(string a, string b)
        {
            if (a == null || b == null || a.Length != b.Length) return false;
            int khac = 0;
            for (int i = 0; i < a.Length; i++) khac |= a[i] ^ b[i];
            return khac == 0;
        }

        // ------------------------------------------------------------------ tài khoản / đăng nhập

        public bool CoTaiKhoan { get { lock (Khoa) return taiKhoan.Count > 0; } }

        public void DatQuanTri(string ten, string matKhau)
        {
            KiemTen(ten);
            KiemMatKhau(matKhau);
            lock (Khoa)
            {
                TaiKhoan t;
                if (!taiKhoan.TryGetValue(ten, out t))
                {
                    t = new TaiKhoan { Ten = ten, HoTen = "Quản trị" };
                    taiKhoan[ten] = t;
                }
                t.VaiTro = VaiTro.QuanTri;
                t.DonVi = -1;
                t.Khoa = false;
                DatMatKhau(t, matKhau);
                foreach (string k in phien.Where(p => string.Equals(p.Value.Ten, ten, StringComparison.OrdinalIgnoreCase)).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTaiKhoan();
            }
            Ghi("Đặt mật khẩu quản trị cho '" + ten + "' (từ máy chủ).");
        }

        /// <summary>Trả token mới hoặc ném LoiApi.</summary>
        public string DangNhap(string ten, string matKhau, string ip, string thietBi, out TaiKhoan tk)
        {
            ten = (ten ?? "").Trim();
            string khoaSai = ip + "|" + ten.ToLowerInvariant();
            lock (Khoa)
            {
                int[] s;
                int phut = (int)(DateTime.UtcNow - DateTime.MinValue).TotalMinutes;
                if (saiMatKhau.TryGetValue(khoaSai, out s) && s[0] >= 5 && phut - s[1] < 10)
                    throw new LoiApi(429, "Nhập sai quá nhiều lần. Thử lại sau " + (10 - (phut - s[1])) + " phút.");
                if (!taiKhoan.TryGetValue(ten, out tk) || tk.Khoa || !BangNhau(Bam(matKhau ?? "", tk.Muoi, tk.LapLai), tk.Bam))
                {
                    if (s == null || phut - s[1] >= 10) s = new[] { 0, phut };
                    s[0]++;
                    s[1] = phut;
                    saiMatKhau[khoaSai] = s;
                    Ghi("Đăng nhập sai: '" + ten + "' từ " + ip);
                    throw new LoiApi(401, tk != null && tk.Khoa ? "Tài khoản đã bị khoá." : "Sai tên đăng nhập hoặc mật khẩu.");
                }
                saiMatKhau.Remove(khoaSai);
                string token = NgauNhien(32);
                phien[Sha(token)] = new PhienDangNhap { MaBam = Sha(token), Ten = tk.Ten, ThietBi = VanBan.Cat(thietBi, 120), Tao = DateTime.UtcNow, Dung = DateTime.UtcNow };
                LuuTaiKhoan();
                Ghi("Đăng nhập: '" + tk.Ten + "' từ " + ip + " (" + VanBan.Cat(thietBi, 60) + ")");
                return token;
            }
        }

        public TaiKhoan XacThuc(string token)
        {
            if (string.IsNullOrEmpty(token)) return null;
            lock (Khoa)
            {
                PhienDangNhap p;
                if (!phien.TryGetValue(Sha(token), out p)) return null;
                if ((DateTime.UtcNow - p.Dung).TotalDays > NgayGiuPhien) { phien.Remove(p.MaBam); return null; }
                TaiKhoan t;
                if (!taiKhoan.TryGetValue(p.Ten, out t) || t.Khoa) return null;
                p.Dung = DateTime.UtcNow;
                if ((DateTime.UtcNow - luuPhienLuc).TotalMinutes > 10) LuuTaiKhoan();
                return t;
            }
        }

        public void DangXuat(string token)
        {
            lock (Khoa)
            {
                if (phien.Remove(Sha(token ?? ""))) LuuTaiKhoan();
            }
        }

        public void DoiMatKhau(TaiKhoan t, string cu, string moi, string tokenGiu)
        {
            lock (Khoa)
            {
                if (!BangNhau(Bam(cu ?? "", t.Muoi, t.LapLai), t.Bam)) throw new LoiApi(400, "Mật khẩu hiện tại không đúng.");
                KiemMatKhau(moi);
                DatMatKhau(t, moi);
                string giu = Sha(tokenGiu ?? "");
                foreach (string k in phien.Where(p => p.Value.Ten == t.Ten && p.Key != giu).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTaiKhoan();
            }
            Ghi("Đổi mật khẩu: '" + t.Ten + "'");
        }

        public List<TaiKhoan> DanhSachTaiKhoan()
        {
            lock (Khoa) return taiKhoan.Values.OrderByDescending(t => t.VaiTro).ThenBy(t => t.Ten, StringComparer.OrdinalIgnoreCase).ToList();
        }

        public int SoPhien(string ten)
        {
            lock (Khoa) return phien.Values.Count(p => string.Equals(p.Ten, ten, StringComparison.OrdinalIgnoreCase));
        }

        static void KiemTen(string ten)
        {
            if (ten.Length < 2 || ten.Length > 40 || ten.Any(c => char.IsWhiteSpace(c) || c == '|' || c == '<' || c == '>' || c == '"'))
                throw new LoiApi(400, "Tên đăng nhập 2–40 ký tự, không có khoảng trắng.");
        }

        public void LuuTaiKhoan(TaiKhoan nguoiSua, string ten, string hoTen, VaiTro vaiTro, int donVi, bool khoa, string matKhau, bool moi)
        {
            ten = (ten ?? "").Trim();
            KiemTen(ten);
            lock (Khoa)
            {
                if (donVi >= 0 && Dl.TimDonVi(donVi) == null) throw new LoiApi(400, "Không có đơn vị này.");
                if (donVi < 0 || vaiTro == VaiTro.QuanTri) donVi = -1;
                TaiKhoan t;
                bool co = taiKhoan.TryGetValue(ten, out t);
                if (moi && co) throw new LoiApi(400, "Đã có tài khoản \"" + ten + "\".");
                if (!moi && !co) throw new LoiApi(404, "Không có tài khoản \"" + ten + "\".");
                if (!co)
                {
                    KiemMatKhau(matKhau);
                    t = new TaiKhoan { Ten = ten };
                }
                bool boQuanTri = t.VaiTro == VaiTro.QuanTri && (vaiTro != VaiTro.QuanTri || khoa);
                if (co && boQuanTri && taiKhoan.Values.Count(x => x.VaiTro == VaiTro.QuanTri && !x.Khoa) <= 1)
                    throw new LoiApi(400, "Phải còn ít nhất 1 tài khoản quản trị.");
                t.HoTen = VanBan.Cat(hoTen, 80);
                t.VaiTro = vaiTro;
                t.DonVi = donVi;
                t.Khoa = khoa;
                if (!string.IsNullOrEmpty(matKhau))
                {
                    KiemMatKhau(matKhau);
                    DatMatKhau(t, matKhau);
                }
                taiKhoan[ten] = t;
                if (khoa || !string.IsNullOrEmpty(matKhau) && co)
                    foreach (string k in phien.Where(p => p.Value.Ten == t.Ten).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTaiKhoan();
                Ghi((co ? "Sửa" : "Thêm") + " tài khoản '" + ten + "' (" + TenVaiTro.Cua(vaiTro) + ") bởi '" + nguoiSua.Ten + "'");
            }
        }

        public void XoaTaiKhoan(TaiKhoan nguoiSua, string ten)
        {
            lock (Khoa)
            {
                TaiKhoan t;
                if (!taiKhoan.TryGetValue(ten ?? "", out t)) throw new LoiApi(404, "Không có tài khoản này.");
                if (string.Equals(t.Ten, nguoiSua.Ten, StringComparison.OrdinalIgnoreCase)) throw new LoiApi(400, "Không tự xoá tài khoản đang đăng nhập.");
                if (t.VaiTro == VaiTro.QuanTri && taiKhoan.Values.Count(x => x.VaiTro == VaiTro.QuanTri && !x.Khoa) <= 1)
                    throw new LoiApi(400, "Phải còn ít nhất 1 tài khoản quản trị.");
                taiKhoan.Remove(t.Ten);
                foreach (string k in phien.Where(p => p.Value.Ten == t.Ten).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTaiKhoan();
                Ghi("Xoá tài khoản '" + t.Ten + "' bởi '" + nguoiSua.Ten + "'");
            }
        }

        // ------------------------------------------------------------------ file tải về 1 lần (Excel)

        public string GiuTep(byte[] than, string loai, string ten)
        {
            lock (tepTam)
            {
                foreach (string k in tepTam.Where(x => x.Value.HetHan < DateTime.UtcNow).Select(x => x.Key).ToList()) tepTam.Remove(k);
                string ma = NgauNhien(24);
                tepTam[ma] = new TepTam { Than = than, Loai = loai, Ten = ten, HetHan = DateTime.UtcNow.AddMinutes(10) };
                return ma;
            }
        }

        public TepTam LayTep(string ma)
        {
            lock (tepTam)
            {
                TepTam t;
                return tepTam.TryGetValue(ma ?? "", out t) && t.HetHan >= DateTime.UtcNow ? t : null;
            }
        }

        // ------------------------------------------------------------------ taikhoan.xml

        static string S(XElement e, string n) { XAttribute a = e.Attribute(n); return a == null ? "" : a.Value; }

        static int I(XElement e, string n, int md)
        {
            int v;
            return int.TryParse(S(e, n), NumberStyles.Integer, Inv, out v) ? v : md;
        }

        static DateTime T(XElement e, string n)
        {
            DateTime d;
            return DateTime.TryParse(S(e, n), Inv, DateTimeStyles.RoundtripKind, out d) ? d : DateTime.UtcNow;
        }

        void DocTaiKhoan()
        {
            if (!File.Exists(TepTaiKhoan)) return;
            XElement r = XDocument.Load(TepTaiKhoan).Root;
            foreach (XElement e in r.Elements("TaiKhoan"))
            {
                var t = new TaiKhoan
                {
                    Ten = S(e, "ten"), HoTen = S(e, "hoTen"), Muoi = S(e, "muoi"), Bam = S(e, "bam"),
                    LapLai = I(e, "lap", 100000), DonVi = I(e, "donVi", -1), Khoa = S(e, "khoa") == "1"
                };
                VaiTro v;
                t.VaiTro = Enum.TryParse(S(e, "vaiTro"), out v) ? v : VaiTro.Xem;
                if (t.Ten.Length > 0) taiKhoan[t.Ten] = t;
            }
            foreach (XElement e in r.Elements("Phien"))
            {
                var p = new PhienDangNhap { MaBam = S(e, "ma"), Ten = S(e, "ten"), ThietBi = S(e, "thietBi"), Tao = T(e, "tao"), Dung = T(e, "dung") };
                if ((DateTime.UtcNow - p.Dung).TotalDays <= NgayGiuPhien) phien[p.MaBam] = p;
            }
        }

        void LuuTaiKhoan()
        {
            var r = new XElement("TaiKhoanMayChu");
            foreach (TaiKhoan t in taiKhoan.Values)
                r.Add(new XElement("TaiKhoan", new XAttribute("ten", t.Ten), new XAttribute("hoTen", t.HoTen), new XAttribute("vaiTro", t.VaiTro.ToString()),
                                   new XAttribute("donVi", t.DonVi), new XAttribute("muoi", t.Muoi), new XAttribute("bam", t.Bam),
                                   new XAttribute("lap", t.LapLai), new XAttribute("khoa", t.Khoa ? 1 : 0)));
            foreach (PhienDangNhap p in phien.Values)
                r.Add(new XElement("Phien", new XAttribute("ma", p.MaBam), new XAttribute("ten", p.Ten), new XAttribute("thietBi", p.ThietBi ?? ""),
                                   new XAttribute("tao", p.Tao.ToString("o", Inv)), new XAttribute("dung", p.Dung.ToString("o", Inv))));
            string tmp = TepTaiKhoan + ".tmp";
            new XDocument(r).Save(tmp);
            if (File.Exists(TepTaiKhoan)) File.Replace(tmp, TepTaiKhoan, TepTaiKhoan + ".bak", true);
            else File.Move(tmp, TepTaiKhoan);
            luuPhienLuc = DateTime.UtcNow;
        }
    }
}
