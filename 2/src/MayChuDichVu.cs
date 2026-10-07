using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using System.Xml.Linq;

namespace ThatThoatNuoc
{
    public enum VaiTroMayChu { Xem, NhapLieu, QuanTri }

    public class TaiKhoanMayChu
    {
        public string Ten = "", HoTen = "";
        public VaiTroMayChu VaiTro = VaiTroMayChu.Xem;
        public int DoiCap1 = -1;            // chỉ nhập đồng hồ cấp 1 của đội này (-1 = mọi đội)
        public string Muoi = "", Bam = "";
        public int LapLai = 100000;
        public bool Khoa;

        public static string TenVaiTro(VaiTroMayChu v)
        {
            return v == VaiTroMayChu.QuanTri ? "Admin (toàn quyền)" : v == VaiTroMayChu.NhapLieu ? "Nhập đồng hồ cấp 1" : "Chỉ xem";
        }
    }

    class PhienDangNhap
    {
        public string MaBam, Ten, ThietBi;
        public DateTime Tao, Dung;
    }

    /// <summary>Thao tác nhập từ điện thoại — giữ lại để gộp khi máy tính gửi cả bộ dữ liệu dựa trên bản cũ hơn.</summary>
    class ThaoTac
    {
        public long PhienBan;
        public string Loai;          // cs = 1 ô số liệu đồng hồ cấp 1, chot = thời gian chốt của trạm, taoky = tạo tháng cấp 1
        public int Nam, Thang, Id;   // Id = đồng hồ (cs) / trạm (chot)
        public string Truong = "", Cu = "", Moi = "", Ten = "";
        public DateTime Luc;
    }

    class TepTam
    {
        public byte[] Than;
        public string Loai, Ten;
        public DateTime HetHan;
    }

    /// <summary>
    /// Dữ liệu trên máy chủ: thatthoat.xml (như trên máy tính, có .bak và SaoLuu) + maychu.xml (tài khoản, phiên đăng nhập,
    /// số phiên bản dữ liệu, nhật ký thao tác của điện thoại). Mọi thay đổi đều qua 1 khoá.
    /// </summary>
    class DichVuMayChu
    {
        const int GiuThaoTac = 5000;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public readonly object Khoa = new object();
        public readonly string ThuMuc;
        public readonly KhoDuLieu Kho;
        public BoTinh Bt;
        public long PhienBan;
        long catToi;                                                     // thao tác có phiên bản ≤ số này đã bỏ khỏi nhật ký
        readonly List<ThaoTac> nhatKy = new List<ThaoTac>();
        readonly List<KeyValuePair<long, string>> lanMayGui = new List<KeyValuePair<long, string>>();   // phiên bản ← máy tính gửi cả bộ
        readonly Dictionary<string, TaiKhoanMayChu> taiKhoan = new Dictionary<string, TaiKhoanMayChu>(StringComparer.OrdinalIgnoreCase);
        readonly Dictionary<string, PhienDangNhap> phien = new Dictionary<string, PhienDangNhap>();
        readonly Dictionary<string, int[]> saiMatKhau = new Dictionary<string, int[]>();    // ip|tên → số lần, phút
        readonly Dictionary<string, TepTam> tepTam = new Dictionary<string, TepTam>();
        DateTime luuPhienLuc = DateTime.MinValue;
        readonly object khoaNhatKyFile = new object();

        string TepTrangThai { get { return Path.Combine(ThuMuc, "maychu.xml"); } }

        public DichVuMayChu(string thuMuc)
        {
            ThuMuc = thuMuc;
            Directory.CreateDirectory(thuMuc);
            Kho = new KhoDuLieu(thuMuc);
            Kho.Doc();
            Bt = new BoTinh(Kho.DuLieu);
            DocTrangThai();
        }

        public bool CoDuLieu { get { return Kho.DuLieu.Thang.Count > 0 || !Kho.DuLieu.Cap1.Trong; } }

        // ------------------------------------------------------------------ nhật ký máy chủ

        public void Ghi(string s)
        {
            try
            {
                lock (khoaNhatKyFile)
                {
                    string dir = Path.Combine(ThuMuc, "NhatKy");
                    Directory.CreateDirectory(dir);
                    File.AppendAllText(Path.Combine(dir, "maychu-" + DateTime.Now.ToString("yyyy-MM") + ".txt"),
                                       DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + s + "\r\n", Encoding.UTF8);
                }
            }
            catch (Exception) { }
        }

        public void Dung()
        {
            lock (Khoa) LuuTrangThai();
        }

        // ------------------------------------------------------------------ tài khoản / đăng nhập

        static string Bam(string matKhau, string muoi, int lap)
        {
            using (var k = new Rfc2898DeriveBytes(Encoding.UTF8.GetBytes(matKhau), Convert.FromBase64String(muoi), lap))
                return Convert.ToBase64String(k.GetBytes(32));
        }

        static string NgauNhien(int n)
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

        public static void DatMatKhau(TaiKhoanMayChu t, string matKhau)
        {
            var b = new byte[16];
            using (var r = RandomNumberGenerator.Create()) r.GetBytes(b);
            t.Muoi = Convert.ToBase64String(b);
            t.LapLai = 100000;
            t.Bam = Bam(matKhau, t.Muoi, t.LapLai);
        }

        public void DatQuanTri(string ten, string matKhau)
        {
            lock (Khoa)
            {
                TaiKhoanMayChu t;
                if (!taiKhoan.TryGetValue(ten, out t))
                {
                    t = new TaiKhoanMayChu { Ten = ten, HoTen = "Quản trị" };
                    taiKhoan[ten] = t;
                }
                t.VaiTro = VaiTroMayChu.QuanTri;
                t.Khoa = false;
                DatMatKhau(t, matKhau);
                foreach (string k in phien.Where(p => string.Equals(p.Value.Ten, ten, StringComparison.OrdinalIgnoreCase)).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTrangThai();
            }
            Ghi("Đặt mật khẩu quản trị cho '" + ten + "' (từ máy chủ).");
        }

        public bool CoTaiKhoan { get { lock (Khoa) return taiKhoan.Count > 0; } }

        /// <summary>Trả token mới hoặc ném LoiApi.</summary>
        public string DangNhap(string ten, string matKhau, string ip, string thietBi, out TaiKhoanMayChu tk)
        {
            ten = (ten ?? "").Trim();
            string khoaSai = ip + "|" + ten.ToLowerInvariant();
            lock (Khoa)
            {
                int[] s;
                int phut = (int)(DateTime.UtcNow - DateTime.MinValue).TotalMinutes;
                if (saiMatKhau.TryGetValue(khoaSai, out s) && s[0] >= 5 && phut - s[1] < 10)
                    throw new LoiApi(429, "Nhập sai quá nhiều lần. Thử lại sau " + (10 - (phut - s[1])) + " phút.");
                if (!taiKhoan.TryGetValue(ten, out tk) || tk.Khoa || !MayChu.BangNhau(Bam(matKhau ?? "", tk.Muoi, tk.LapLai), tk.Bam))
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
                phien[Sha(token)] = new PhienDangNhap { MaBam = Sha(token), Ten = tk.Ten, ThietBi = Cat(thietBi, 120), Tao = DateTime.UtcNow, Dung = DateTime.UtcNow };
                LuuTrangThai();
                Ghi("Đăng nhập: '" + tk.Ten + "' từ " + ip + " (" + Cat(thietBi, 60) + ")");
                return token;
            }
        }

        static string Cat(string s, int n) { s = s ?? ""; return s.Length > n ? s.Substring(0, n) : s; }

        public TaiKhoanMayChu XacThuc(string token)
        {
            if (string.IsNullOrEmpty(token)) return null;
            lock (Khoa)
            {
                PhienDangNhap p;
                if (!phien.TryGetValue(Sha(token), out p)) return null;
                if ((DateTime.UtcNow - p.Dung).TotalDays > 60) { phien.Remove(p.MaBam); return null; }
                TaiKhoanMayChu t;
                if (!taiKhoan.TryGetValue(p.Ten, out t) || t.Khoa) return null;
                p.Dung = DateTime.UtcNow;
                if ((DateTime.UtcNow - luuPhienLuc).TotalMinutes > 10) LuuTrangThai();
                return t;
            }
        }

        public void DangXuat(string token)
        {
            lock (Khoa)
            {
                if (phien.Remove(Sha(token ?? ""))) LuuTrangThai();
            }
        }

        public void DoiMatKhau(TaiKhoanMayChu t, string cu, string moi, string tokenGiu)
        {
            lock (Khoa)
            {
                if (!MayChu.BangNhau(Bam(cu ?? "", t.Muoi, t.LapLai), t.Bam)) throw new LoiApi(400, "Mật khẩu hiện tại không đúng.");
                KiemMatKhau(moi);
                DatMatKhau(t, moi);
                string giu = Sha(tokenGiu ?? "");
                foreach (string k in phien.Where(p => p.Value.Ten == t.Ten && p.Key != giu).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTrangThai();
            }
        }

        public static void KiemMatKhau(string mk)
        {
            if (string.IsNullOrEmpty(mk) || mk.Length < 6) throw new LoiApi(400, "Mật khẩu phải có ít nhất 6 ký tự.");
        }

        public List<TaiKhoanMayChu> DanhSachTaiKhoan()
        {
            lock (Khoa) return taiKhoan.Values.OrderByDescending(t => t.VaiTro).ThenBy(t => t.Ten).ToList();
        }

        public int SoPhien(string ten)
        {
            lock (Khoa) return phien.Values.Count(p => string.Equals(p.Ten, ten, StringComparison.OrdinalIgnoreCase));
        }

        public void LuuTaiKhoan(TaiKhoanMayChu nguoiSua, string ten, string hoTen, VaiTroMayChu vaiTro, int doi, bool khoa, string matKhau, bool moi)
        {
            ten = (ten ?? "").Trim();
            if (ten.Length < 2 || ten.Length > 40 || ten.Any(c => char.IsWhiteSpace(c) || c == '|' || c == '<' || c == '>'))
                throw new LoiApi(400, "Tên đăng nhập 2–40 ký tự, không có khoảng trắng.");
            lock (Khoa)
            {
                if (doi >= 0 && Kho.DuLieu.Cap1.TimDoi(doi) == null) throw new LoiApi(400, "Không có đội này trong danh mục đồng hồ cấp 1.");
                if (doi < 0) doi = -1;
                TaiKhoanMayChu t;
                bool co = taiKhoan.TryGetValue(ten, out t);
                if (moi && co) throw new LoiApi(400, "Đã có tài khoản \"" + ten + "\".");
                if (!moi && !co) throw new LoiApi(404, "Không có tài khoản \"" + ten + "\".");
                if (!co)
                {
                    KiemMatKhau(matKhau);
                    t = new TaiKhoanMayChu { Ten = ten };
                }
                bool boQuanTri = t.VaiTro == VaiTroMayChu.QuanTri && (vaiTro != VaiTroMayChu.QuanTri || khoa);
                if (boQuanTri && taiKhoan.Values.Count(x => x.VaiTro == VaiTroMayChu.QuanTri && !x.Khoa) <= 1)
                    throw new LoiApi(400, "Phải còn ít nhất 1 tài khoản quản trị.");
                t.HoTen = Cat((hoTen ?? "").Trim(), 80);
                t.VaiTro = vaiTro;
                t.DoiCap1 = doi;
                t.Khoa = khoa;
                if (!string.IsNullOrEmpty(matKhau))
                {
                    KiemMatKhau(matKhau);
                    DatMatKhau(t, matKhau);
                }
                taiKhoan[ten] = t;
                if (khoa || !string.IsNullOrEmpty(matKhau) && co)
                    foreach (string k in phien.Where(p => p.Value.Ten == t.Ten).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTrangThai();
                Ghi((co ? "Sửa" : "Thêm") + " tài khoản '" + ten + "' (" + TaiKhoanMayChu.TenVaiTro(vaiTro) + ") bởi '" + nguoiSua.Ten + "'");
            }
        }

        public void XoaTaiKhoan(TaiKhoanMayChu nguoiSua, string ten)
        {
            lock (Khoa)
            {
                TaiKhoanMayChu t;
                if (!taiKhoan.TryGetValue(ten ?? "", out t)) throw new LoiApi(404, "Không có tài khoản này.");
                if (t.VaiTro == VaiTroMayChu.QuanTri && taiKhoan.Values.Count(x => x.VaiTro == VaiTroMayChu.QuanTri && !x.Khoa) <= 1)
                    throw new LoiApi(400, "Phải còn ít nhất 1 tài khoản quản trị.");
                taiKhoan.Remove(t.Ten);
                foreach (string k in phien.Where(p => p.Value.Ten == t.Ten).Select(p => p.Key).ToList()) phien.Remove(k);
                LuuTrangThai();
                Ghi("Xoá tài khoản '" + t.Ten + "' bởi '" + nguoiSua.Ten + "'");
            }
        }

        // ------------------------------------------------------------------ file tải về 1 lần (Excel / PDF)

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

        // ------------------------------------------------------------------ dữ liệu: điện thoại sửa, máy tính gửi cả bộ

        /// <summary>Lưu dữ liệu + tăng phiên bản (gọi trong khoá).</summary>
        public void DaSua(List<ThaoTac> thaoTac)
        {
            PhienBan++;
            foreach (ThaoTac t in thaoTac)
            {
                t.PhienBan = PhienBan;
                nhatKy.Add(t);
            }
            if (nhatKy.Count > GiuThaoTac)
            {
                int bo = nhatKy.Count - GiuThaoTac;
                catToi = Math.Max(catToi, nhatKy[bo - 1].PhienBan);
                nhatKy.RemoveRange(0, bo);
            }
            Bt.XoaBoNho();
            Kho.Luu();
            LuuTrangThai();
        }

        public byte[] LayDuLieu(out long phienBan)
        {
            lock (Khoa)
            {
                phienBan = PhienBan;
                return KhoDuLieu.GhiBytes(Kho.DuLieu);
            }
        }

        /// <summary>Bản sao để dựng báo cáo ngoài khoá.</summary>
        public DuLieu BanSao()
        {
            byte[] b;
            lock (Khoa) b = KhoDuLieu.GhiBytes(Kho.DuLieu);
            return KhoDuLieu.DocBytes(b);
        }

        public class KetQuaGui
        {
            public long PhienBan;
            public int DaGop;
            public int BoQua;
        }

        /// <summary>
        /// Máy tính gửi cả bộ dữ liệu, dựa trên phiên bản <paramref name="goc"/> nó đã có. Nếu sau đó điện thoại đã nhập
        /// đồng hồ cấp 1, các ô đó được gộp vào (trừ ô mà máy tính cũng đã sửa khác đi). Máy tính khác đã gửi cả bộ
        /// sau phiên bản gốc thì từ chối (409) để máy này tải lại, tránh đè mất.
        /// </summary>
        public KetQuaGui NhanTuMayTinh(byte[] xml, long goc, string may, string nguoi, bool ghiDe)
        {
            DuLieu moi;
            try { moi = KhoDuLieu.DocBytes(xml); }
            catch (Exception ex) { throw new LoiApi(400, "Dữ liệu gửi lên không đọc được: " + ex.Message); }
            lock (Khoa)
            {
                var kq = new KetQuaGui();
                if (!ghiDe)
                {
                    if (goc > PhienBan) throw new LoiApi(409, "Dữ liệu trên máy chủ đã được làm lại (phiên bản cũ hơn máy này). Hãy tải lại từ máy chủ.");
                    if (goc < PhienBan)
                    {
                        if (lanMayGui.Any(x => x.Key > goc && !string.Equals(x.Value, may, StringComparison.OrdinalIgnoreCase)))
                            throw new LoiApi(409, "Một máy tính khác vừa gửi dữ liệu lên máy chủ. Phần mềm sẽ tải lại dữ liệu mới nhất.");
                        if (goc < catToi) throw new LoiApi(409, "Bản dữ liệu trên máy này quá cũ so với máy chủ. Phần mềm sẽ tải lại dữ liệu mới nhất.");
                        foreach (ThaoTac t in nhatKy.Where(x => x.PhienBan > goc))
                        {
                            if (ApDung(moi, t)) kq.DaGop++;
                            else kq.BoQua++;
                        }
                    }
                }
                else
                {
                    try { Kho.SaoLuuNgay(); } catch (Exception) { }
                    nhatKy.Clear();
                    catToi = PhienBan + 1;
                }
                Kho.DuLieu = moi;
                Bt = new BoTinh(moi);
                PhienBan++;
                lanMayGui.Add(new KeyValuePair<long, string>(PhienBan, may ?? ""));
                if (lanMayGui.Count > 500) lanMayGui.RemoveRange(0, lanMayGui.Count - 500);
                Kho.Luu();
                LuuTrangThai();
                kq.PhienBan = PhienBan;
                if (ghiDe || kq.DaGop > 0 || kq.BoQua > 0)
                    Ghi("Máy tính (" + nguoi + ") gửi dữ liệu" + (ghiDe ? " — GHI ĐÈ" : "") + ": phiên bản " + PhienBan + ", gộp " + kq.DaGop + " ô từ điện thoại, bỏ qua " + kq.BoQua);
                return kq;
            }
        }

        // ------------------------------------------------------------------ áp thao tác của điện thoại

        public static string SoChu(double? v) { return v.HasValue ? v.Value.ToString("R", Inv) : ""; }

        public static string GiaTri(ChiSoCap1 cs, string truong)
        {
            switch (truong)
            {
                case "cu": return SoChu(cs.ChiSoCu);
                case "moi": return SoChu(cs.ChiSoMoi);
                case "sl": return SoChu(cs.SanLuongNhap);
                case "chot": return SoChu(cs.ChotCu);
                case "dau": return SoChu(cs.DauMoi);
                case "lk": return SoChu(cs.LuyKeTruoc);
                case "gc": return cs.GhiChu ?? "";
            }
            return "";
        }

        public static void DatGiaTri(ChiSoCap1 cs, string truong, string v)
        {
            double? n = null;
            if (truong != "gc" && v.Length > 0) n = double.Parse(v, Inv);
            switch (truong)
            {
                case "cu": cs.ChiSoCu = n; break;
                case "moi": cs.ChiSoMoi = n; break;
                case "sl": cs.SanLuongNhap = n; break;
                case "chot": cs.ChotCu = n; break;
                case "dau": cs.DauMoi = n; break;
                case "lk": cs.LuyKeTruoc = n; break;
                case "gc": cs.GhiChu = v; break;
            }
        }

        /// <summary>Áp 1 thao tác lên bộ dữ liệu máy tính gửi; chỉ đổi ô còn đúng giá trị trước khi điện thoại sửa.</summary>
        static bool ApDung(DuLieu d, ThaoTac t)
        {
            DuLieuCap1 c = d.Cap1;
            if (t.Loai == "taoky")
            {
                if (c.TimKy(t.Nam, t.Thang) != null) return true;
                KyCap1 truoc = c.TimKy(t.Nam * 12 + t.Thang - 2);
                if (truoc == null || c.KyCuoi != truoc) return false;
                c.Ky.Add(Cap1Ops.TaoKySau(c, truoc));
                c.SapXep();
                return true;
            }
            KyCap1 ky = c.TimKy(t.Nam, t.Thang);
            if (ky == null) return false;
            if (t.Loai == "chot")
            {
                if (c.TimTram(t.Id) == null) return false;
                string hien = ky.LayThoiGianChot(t.Id);
                if (hien == t.Moi) return true;
                if (hien != t.Cu) return false;
                if (t.Moi.Length == 0) ky.ThoiGianChot.Remove(t.Id);
                else ky.ThoiGianChot[t.Id] = t.Moi;
                return true;
            }
            ChiSoCap1 cs = ky.Tim(t.Id);
            if (cs == null) return false;
            string gt = GiaTri(cs, t.Truong);
            if (gt == t.Moi) return true;
            if (gt != t.Cu) return false;
            DatGiaTri(cs, t.Truong, t.Moi);
            return true;
        }

        // ------------------------------------------------------------------ maychu.xml

        void DocTrangThai()
        {
            if (!File.Exists(TepTrangThai)) return;
            XElement r = XDocument.Load(TepTrangThai).Root;
            PhienBan = L(r, "phienBan");
            catToi = L(r, "catToi");
            foreach (XElement e in r.Elements("TaiKhoan"))
            {
                var t = new TaiKhoanMayChu
                {
                    Ten = S(e, "ten"), HoTen = S(e, "hoTen"), Muoi = S(e, "muoi"), Bam = S(e, "bam"),
                    LapLai = (int)L(e, "lap", 100000), DoiCap1 = (int)L(e, "doi", -1), Khoa = L(e, "khoa") == 1
                };
                VaiTroMayChu v;
                t.VaiTro = Enum.TryParse(S(e, "vaiTro"), out v) ? v : VaiTroMayChu.Xem;
                if (t.Ten.Length > 0) taiKhoan[t.Ten] = t;
            }
            foreach (XElement e in r.Elements("Phien"))
            {
                var p = new PhienDangNhap { MaBam = S(e, "ma"), Ten = S(e, "ten"), ThietBi = S(e, "thietBi"), Tao = T(e, "tao"), Dung = T(e, "dung") };
                if ((DateTime.UtcNow - p.Dung).TotalDays <= 60) phien[p.MaBam] = p;
            }
            foreach (XElement e in r.Elements("ThaoTac"))
                nhatKy.Add(new ThaoTac
                {
                    PhienBan = L(e, "pb"), Loai = S(e, "loai"), Nam = (int)L(e, "nam"), Thang = (int)L(e, "thang"), Id = (int)L(e, "id"),
                    Truong = S(e, "truong"), Cu = S(e, "cu"), Moi = S(e, "moi"), Ten = S(e, "ten"), Luc = T(e, "luc")
                });
            foreach (XElement e in r.Elements("MayGui")) lanMayGui.Add(new KeyValuePair<long, string>(L(e, "pb"), S(e, "may")));
        }

        void LuuTrangThai()
        {
            var r = new XElement("MayChu", new XAttribute("phienBan", PhienBan), new XAttribute("catToi", catToi));
            foreach (TaiKhoanMayChu t in taiKhoan.Values)
                r.Add(new XElement("TaiKhoan", new XAttribute("ten", t.Ten), new XAttribute("hoTen", t.HoTen), new XAttribute("vaiTro", t.VaiTro.ToString()),
                                   new XAttribute("doi", t.DoiCap1), new XAttribute("muoi", t.Muoi), new XAttribute("bam", t.Bam),
                                   new XAttribute("lap", t.LapLai), new XAttribute("khoa", t.Khoa ? 1 : 0)));
            foreach (PhienDangNhap p in phien.Values)
                r.Add(new XElement("Phien", new XAttribute("ma", p.MaBam), new XAttribute("ten", p.Ten), new XAttribute("thietBi", p.ThietBi ?? ""),
                                   new XAttribute("tao", p.Tao.ToString("o", Inv)), new XAttribute("dung", p.Dung.ToString("o", Inv))));
            foreach (ThaoTac t in nhatKy)
                r.Add(new XElement("ThaoTac", new XAttribute("pb", t.PhienBan), new XAttribute("loai", t.Loai), new XAttribute("nam", t.Nam),
                                   new XAttribute("thang", t.Thang), new XAttribute("id", t.Id), new XAttribute("truong", t.Truong),
                                   new XAttribute("cu", t.Cu), new XAttribute("moi", t.Moi), new XAttribute("ten", t.Ten),
                                   new XAttribute("luc", t.Luc.ToString("o", Inv))));
            foreach (var m in lanMayGui) r.Add(new XElement("MayGui", new XAttribute("pb", m.Key), new XAttribute("may", m.Value)));
            string tmp = TepTrangThai + ".tmp";
            new XDocument(r).Save(tmp);
            if (File.Exists(TepTrangThai)) File.Replace(tmp, TepTrangThai, TepTrangThai + ".bak", true);
            else File.Move(tmp, TepTrangThai);
            luuPhienLuc = DateTime.UtcNow;
        }

        static string S(XElement e, string n) { XAttribute a = e.Attribute(n); return a == null ? "" : a.Value; }

        static long L(XElement e, string n, long macDinh = 0)
        {
            long v;
            return long.TryParse(S(e, n), NumberStyles.Integer, Inv, out v) ? v : macDinh;
        }

        static DateTime T(XElement e, string n)
        {
            DateTime d;
            return DateTime.TryParse(S(e, n), Inv, DateTimeStyles.RoundtripKind, out d) ? d : DateTime.UtcNow;
        }
    }

    /// <summary>JSON: viết tay (số kiểu bất biến, NaN → null), đọc bằng JavaScriptSerializer.</summary>
    public static class JsonMayChu
    {
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public static string Viet(object o)
        {
            var sb = new StringBuilder();
            Viet(sb, o);
            return sb.ToString();
        }

        static void Viet(StringBuilder sb, object o)
        {
            if (o == null) { sb.Append("null"); return; }
            if (o is string) { Chuoi(sb, (string)o); return; }
            if (o is bool) { sb.Append((bool)o ? "true" : "false"); return; }
            if (o is double || o is float || o is decimal)
            {
                double d = Convert.ToDouble(o, Inv);
                sb.Append(double.IsNaN(d) || double.IsInfinity(d) ? "null" : d.ToString("R", Inv));
                return;
            }
            if (o is int || o is long || o is short || o is byte) { sb.Append(Convert.ToString(o, Inv)); return; }
            var dict = o as System.Collections.IDictionary;
            if (dict != null)
            {
                sb.Append('{');
                bool dau = true;
                foreach (System.Collections.DictionaryEntry e in dict)
                {
                    if (!dau) sb.Append(',');
                    dau = false;
                    Chuoi(sb, Convert.ToString(e.Key, Inv));
                    sb.Append(':');
                    Viet(sb, e.Value);
                }
                sb.Append('}');
                return;
            }
            var list = o as System.Collections.IEnumerable;
            if (list != null)
            {
                sb.Append('[');
                bool dau = true;
                foreach (object x in list)
                {
                    if (!dau) sb.Append(',');
                    dau = false;
                    Viet(sb, x);
                }
                sb.Append(']');
                return;
            }
            Chuoi(sb, Convert.ToString(o, Inv));
        }

        static void Chuoi(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '<': sb.Append("\\u003c"); break;
                    default:
                        if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        public static Dictionary<string, object> Doc(byte[] b)
        {
            if (b == null || b.Length == 0) return new Dictionary<string, object>();
            try
            {
                var js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
                var d = js.DeserializeObject(Encoding.UTF8.GetString(b)) as Dictionary<string, object>;
                return d ?? new Dictionary<string, object>();
            }
            catch (Exception)
            {
                throw new LoiApi(400, "Dữ liệu gửi lên không đúng dạng JSON.");
            }
        }

        public static object DocGiaTri(string s)
        {
            return new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.DeserializeObject(s);
        }

        public static string Chu(Dictionary<string, object> d, string k)
        {
            object v;
            return d.TryGetValue(k, out v) && v != null ? Convert.ToString(v, Inv) : null;
        }

        public static int So(Dictionary<string, object> d, string k, int macDinh)
        {
            string s = Chu(d, k);
            int v;
            return s != null && int.TryParse(s, NumberStyles.Integer, Inv, out v) ? v : macDinh;
        }

        public static bool Co(Dictionary<string, object> d, string k)
        {
            return d.ContainsKey(k);
        }
    }
}
