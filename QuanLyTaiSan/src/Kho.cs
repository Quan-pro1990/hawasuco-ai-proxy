using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace QuanLyTaiSan
{
    /// <summary>
    /// Thư mục dữ liệu:
    ///   taisan.xml            danh mục, tài sản, đợt kiểm kê, cài đặt (ghi file tạm rồi thay; bản trước giữ ở .bak)
    ///   LichSu\yyyy-MM.jsonl  lịch sử (kiểm tra, bảo dưỡng, điều chuyển…) — chỉ ghi thêm, mỗi dòng 1 sự kiện
    ///   Anh\&lt;id tài sản&gt;\    ảnh JPEG: &lt;mã ảnh&gt;.jpg (tối đa 1600 px) và &lt;mã ảnh&gt;_n.jpg (ảnh nhỏ)
    ///   SaoLuu\               mỗi ngày 1 bản taisan.xml (giữ 90 ngày)
    /// </summary>
    public class Kho
    {
        const int GiuSaoLuu = 90;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
        static readonly Regex MaAnhRe = new Regex(@"^\d{14}-[0-9a-f]{6}$");

        public readonly string ThuMuc;
        public DuLieu DuLieu;
        readonly Dictionary<int, List<SuKien>> lichSu = new Dictionary<int, List<SuKien>>();
        readonly List<SuKien> tatCa = new List<SuKien>();

        public Kho(string thuMuc)
        {
            ThuMuc = thuMuc;
            Directory.CreateDirectory(thuMuc);
        }

        public string TepChinh { get { return Path.Combine(ThuMuc, "taisan.xml"); } }
        public string ThuMucLichSu { get { return Path.Combine(ThuMuc, "LichSu"); } }
        public string ThuMucAnh { get { return Path.Combine(ThuMuc, "Anh"); } }
        public string ThuMucSaoLuu { get { return Path.Combine(ThuMuc, "SaoLuu"); } }

        // ------------------------------------------------------------------ mở / lưu

        public void Mo()
        {
            if (File.Exists(TepChinh))
            {
                try { DuLieu = Doc(XDocument.Load(TepChinh).Root); }
                catch (Exception ex)
                {
                    string bak = TepChinh + ".bak";
                    if (!File.Exists(bak)) throw new InvalidDataException("Không đọc được " + TepChinh + ": " + ex.Message);
                    DuLieu = Doc(XDocument.Load(bak).Root);
                }
            }
            else
            {
                DuLieu = DuLieu.MacDinh();
                Luu();
            }
            DuLieu.LapChiMuc();
            DocLichSu();
        }

        public void Luu()
        {
            SaoLuuDauNgay();
            string tmp = TepChinh + ".tmp";
            Ghi(DuLieu).Save(tmp);
            if (File.Exists(TepChinh)) File.Replace(tmp, TepChinh, TepChinh + ".bak", true);
            else File.Move(tmp, TepChinh);
        }

        void SaoLuuDauNgay()
        {
            try
            {
                if (!File.Exists(TepChinh)) return;
                Directory.CreateDirectory(ThuMucSaoLuu);
                string homNay = Path.Combine(ThuMucSaoLuu, "taisan_" + DateTime.Now.ToString("yyyy-MM-dd", Inv) + ".xml");
                if (File.Exists(homNay)) return;
                File.Copy(TepChinh, homNay);
                foreach (FileInfo f in new DirectoryInfo(ThuMucSaoLuu).GetFiles("taisan_*.xml").OrderByDescending(f => f.Name).Skip(GiuSaoLuu))
                    f.Delete();
            }
            catch (Exception) { }
        }

        // ------------------------------------------------------------------ lịch sử

        public List<SuKien> LichSu(int taiSan)
        {
            List<SuKien> l;
            return lichSu.TryGetValue(taiSan, out l) ? l : new List<SuKien>();
        }

        public IList<SuKien> TatCaSuKien { get { return tatCa; } }

        void DocLichSu()
        {
            lichSu.Clear();
            tatCa.Clear();
            foreach (DotKiemKe d in DuLieu.KiemKe) d.KetQua.Clear();
            if (!Directory.Exists(ThuMucLichSu)) return;
            foreach (string tep in Directory.GetFiles(ThuMucLichSu, "*.jsonl").OrderBy(f => f, StringComparer.Ordinal))
            {
                foreach (string dong in File.ReadAllLines(tep, Encoding.UTF8))
                {
                    if (dong.Trim().Length == 0) continue;
                    SuKien s;
                    try { s = DocSuKien(Json.DocDong(dong)); }
                    catch (Exception) { continue; }   // dòng ghi dở khi mất điện
                    if (s == null) continue;
                    NapSuKien(s);
                    if (s.Id > DuLieu.IdSuKien) DuLieu.IdSuKien = s.Id;
                }
            }
        }

        void NapSuKien(SuKien s)
        {
            List<SuKien> l;
            if (!lichSu.TryGetValue(s.TaiSan, out l))
            {
                l = new List<SuKien>();
                lichSu[s.TaiSan] = l;
            }
            l.Add(s);
            tatCa.Add(s);
            if (s.Loai == LoaiSuKien.KiemKe && s.Dot > 0)
            {
                DotKiemKe d = DuLieu.TimDot(s.Dot);
                if (d != null) d.KetQua[s.TaiSan] = s;
            }
        }

        /// <summary>Ghi thêm 1 sự kiện (cấp mã, ghi file trước rồi mới đưa vào bộ nhớ).</summary>
        public void GhiSuKien(SuKien s)
        {
            s.Id = ++DuLieu.IdSuKien;
            Directory.CreateDirectory(ThuMucLichSu);
            string tep = Path.Combine(ThuMucLichSu, s.Luc.ToString("yyyy-MM", Inv) + ".jsonl");
            File.AppendAllText(tep, Json.Viet(ViettSuKien(s)) + "\n", new UTF8Encoding(false));
            NapSuKien(s);
        }

        static Dictionary<string, object> ViettSuKien(SuKien s)
        {
            var o = new Dictionary<string, object>
            {
                { "id", s.Id }, { "ts", s.TaiSan }, { "loai", s.Loai }, { "luc", s.Luc }, { "nguoi", s.Nguoi }, { "hoTen", s.HoTen }
            };
            if (s.TinhTrang != null) o["tt"] = s.TinhTrang;
            if (s.NoiDung.Length > 0) o["nd"] = s.NoiDung;
            if (s.ChiTiet.Length > 0) o["ct"] = s.ChiTiet;
            if (s.ChiPhi.HasValue) o["cp"] = s.ChiPhi.Value;
            if (s.ViDo.HasValue && s.KinhDo.HasValue) { o["vd"] = s.ViDo.Value; o["kd"] = s.KinhDo.Value; }
            if (s.Dot > 0) o["dot"] = s.Dot;
            if (s.Anh.Count > 0) o["anh"] = s.Anh;
            return o;
        }

        static SuKien DocSuKien(Dictionary<string, object> o)
        {
            if (o == null) return null;
            var s = new SuKien
            {
                Id = (long)(Json.SoThuc(o, "id") ?? 0),
                TaiSan = Json.So(o, "ts", 0),
                Loai = Json.Chu(o, "loai") ?? "",
                Nguoi = Json.Chu(o, "nguoi") ?? "",
                HoTen = Json.Chu(o, "hoTen") ?? "",
                TinhTrang = Json.Chu(o, "tt"),
                NoiDung = Json.Chu(o, "nd") ?? "",
                ChiTiet = Json.Chu(o, "ct") ?? "",
                ChiPhi = Json.SoThuc(o, "cp"),
                ViDo = Json.SoThuc(o, "vd"),
                KinhDo = Json.SoThuc(o, "kd"),
                Dot = Json.So(o, "dot", 0),
                Anh = Json.MangChu(o, "anh")
            };
            DateTime luc;
            if (!DateTime.TryParse(Json.Chu(o, "luc"), Inv, DateTimeStyles.None, out luc)) return null;
            s.Luc = luc;
            return s.Id > 0 && s.TaiSan > 0 ? s : null;
        }

        // ------------------------------------------------------------------ ảnh

        public static bool MaAnhHopLe(string ma) { return ma != null && MaAnhRe.IsMatch(ma); }

        public string DuongAnh(int taiSan, string ma, bool nho)
        {
            if (!MaAnhHopLe(ma)) return null;
            return Path.Combine(ThuMucAnh, taiSan.ToString(Inv), ma + (nho ? "_n" : "") + ".jpg");
        }

        public bool CoAnh(int taiSan, string ma)
        {
            string p = DuongAnh(taiSan, ma, false);
            return p != null && File.Exists(p);
        }

        public string LuuAnh(int taiSan, byte[] lon, byte[] nho)
        {
            var r = new byte[3];
            using (var rng = System.Security.Cryptography.RandomNumberGenerator.Create()) rng.GetBytes(r);
            string ma = DateTime.Now.ToString("yyyyMMddHHmmss", Inv) + "-" + BitConverter.ToString(r).Replace("-", "").ToLowerInvariant();
            Directory.CreateDirectory(Path.Combine(ThuMucAnh, taiSan.ToString(Inv)));
            File.WriteAllBytes(DuongAnh(taiSan, ma, false), lon);
            File.WriteAllBytes(DuongAnh(taiSan, ma, true), nho ?? lon);
            return ma;
        }

        // ------------------------------------------------------------------ XML

        static string S(XElement e, string n) { XAttribute a = e.Attribute(n); return a == null ? "" : a.Value; }

        static int I(XElement e, string n, int md = 0)
        {
            int v;
            return int.TryParse(S(e, n), NumberStyles.Integer, Inv, out v) ? v : md;
        }

        static int? IN(XElement e, string n)
        {
            int v;
            return int.TryParse(S(e, n), NumberStyles.Integer, Inv, out v) ? (int?)v : null;
        }

        static double? DN(XElement e, string n)
        {
            double v;
            return double.TryParse(S(e, n), NumberStyles.Float, Inv, out v) ? (double?)v : null;
        }

        static DateTime? NgayN(XElement e, string n)
        {
            DateTime v;
            return DateTime.TryParse(S(e, n), Inv, DateTimeStyles.None, out v) ? (DateTime?)v : null;
        }

        static void A(XElement e, string n, string v) { if (!string.IsNullOrEmpty(v)) e.SetAttributeValue(n, v); }
        static void A(XElement e, string n, int? v) { if (v.HasValue) e.SetAttributeValue(n, v.Value.ToString(Inv)); }
        static void A(XElement e, string n, double? v) { if (v.HasValue) e.SetAttributeValue(n, v.Value.ToString("R", Inv)); }
        static void ANgay(XElement e, string n, DateTime? v) { if (v.HasValue) e.SetAttributeValue(n, v.Value.ToString("yyyy-MM-dd", Inv)); }
        static void ALuc(XElement e, string n, DateTime v) { e.SetAttributeValue(n, v.ToString("yyyy-MM-ddTHH:mm:ss", Inv)); }

        public static XDocument Ghi(DuLieu d)
        {
            var r = new XElement("QuanLyTaiSan", new XAttribute("phienBan", 1),
                new XAttribute("idTaiSan", d.IdTaiSan), new XAttribute("idLoai", d.IdLoai), new XAttribute("idDonVi", d.IdDonVi),
                new XAttribute("idKiemKe", d.IdKiemKe));
            CaiDat c = d.CaiDat;
            var ce = new XElement("CaiDat");
            A(ce, "tenCongTy", c.TenCongTy); A(ce, "diaChiQr", c.DiaChiQr); A(ce, "diaDanh", c.DiaDanh);
            A(ce, "nguoiLap", c.NguoiLap); A(ce, "keToanTruong", c.KeToanTruong); A(ce, "giamDoc", c.GiamDoc);
            A(ce, "ngayNhacKiemTra", c.NgayNhacKiemTra);
            r.Add(ce);
            foreach (LoaiTaiSan l in d.Loai)
            {
                var e = new XElement("Loai", new XAttribute("id", l.Id), new XAttribute("ten", l.Ten));
                A(e, "tienTo", l.TienTo); A(e, "nhom", l.Nhom); A(e, "soNam", l.SoNamKhauHao); A(e, "chuKy", l.ChuKyBaoTri);
                foreach (string t in l.Truong) e.Add(new XElement("Truong", t));
                r.Add(e);
            }
            foreach (DonVi dv in d.DonVi)
            {
                var e = new XElement("DonVi", new XAttribute("id", dv.Id), new XAttribute("ten", dv.Ten));
                A(e, "ghiChu", dv.GhiChu);
                r.Add(e);
            }
            foreach (var m in d.SoMa.OrderBy(x => x.Key, StringComparer.Ordinal))
                r.Add(new XElement("SoMa", new XAttribute("tienTo", m.Key), new XAttribute("so", m.Value)));
            foreach (TaiSan t in d.TaiSan)
            {
                var e = new XElement("TaiSan", new XAttribute("id", t.Id), new XAttribute("pb", t.PhienBan), new XAttribute("ma", t.Ma), new XAttribute("ten", t.Ten),
                                     new XAttribute("loai", t.LoaiId), new XAttribute("donVi", t.DonViId), new XAttribute("tinhTrang", t.TinhTrang));
                A(e, "viTri", t.ViTri); A(e, "nguoiSD", t.NguoiSuDung); A(e, "hang", t.HangSX); A(e, "model", t.Model);
                A(e, "seri", t.SoSeri); A(e, "nuoc", t.NuocSX); A(e, "namSX", t.NamSX); ANgay(e, "ngaySD", t.NgaySuDung);
                A(e, "nguyenGia", t.NguyenGia); A(e, "soNam", t.SoNamKhauHao); ANgay(e, "baoHanh", t.BaoHanhDen); A(e, "chuKy", t.ChuKyBaoTri);
                ANgay(e, "baoTriCuoi", t.BaoTriCuoi);
                if (t.KiemTraCuoi.HasValue) ALuc(e, "kiemTraCuoi", t.KiemTraCuoi.Value);
                A(e, "viDo", t.ViDo); A(e, "kinhDo", t.KinhDo); A(e, "anhChinh", t.AnhChinh);
                ALuc(e, "tao", t.Tao); ALuc(e, "sua", t.Sua); A(e, "nguoiTao", t.NguoiTao); A(e, "nguoiSua", t.NguoiSua);
                if (t.GhiChu.Length > 0) e.Add(new XElement("GhiChu", t.GhiChu));
                foreach (var ts in t.ThongSo) e.Add(new XElement("TS", new XAttribute("ten", ts.Key), new XAttribute("gt", ts.Value)));
                foreach (string a in t.Anh) e.Add(new XElement("Anh", new XAttribute("ma", a)));
                r.Add(e);
            }
            foreach (DotKiemKe k in d.KiemKe)
            {
                var e = new XElement("KiemKe", new XAttribute("id", k.Id), new XAttribute("ten", k.Ten), new XAttribute("dong", k.Dong ? 1 : 0));
                ANgay(e, "tuNgay", k.TuNgay); ANgay(e, "denNgay", k.DenNgay); A(e, "ghiChu", k.GhiChu); A(e, "nguoiTao", k.NguoiTao); ALuc(e, "tao", k.Tao);
                if (k.DonVi.Count > 0) e.SetAttributeValue("donVi", string.Join(" ", k.DonVi.Select(x => x.ToString(Inv))));
                e.Add(new XElement("DanhSach", string.Join(" ", k.DanhSach.OrderBy(x => x).Select(x => x.ToString(Inv)))));
                r.Add(e);
            }
            return new XDocument(r);
        }

        public static DuLieu Doc(XElement r)
        {
            var d = new DuLieu
            {
                IdTaiSan = I(r, "idTaiSan"), IdLoai = I(r, "idLoai"), IdDonVi = I(r, "idDonVi"), IdKiemKe = I(r, "idKiemKe")
            };
            XElement ce = r.Element("CaiDat");
            if (ce != null)
            {
                CaiDat c = d.CaiDat;
                c.TenCongTy = S(ce, "tenCongTy"); c.DiaChiQr = S(ce, "diaChiQr"); c.DiaDanh = S(ce, "diaDanh");
                c.NguoiLap = S(ce, "nguoiLap"); c.KeToanTruong = S(ce, "keToanTruong"); c.GiamDoc = S(ce, "giamDoc");
                c.NgayNhacKiemTra = I(ce, "ngayNhacKiemTra", 180);
            }
            foreach (XElement e in r.Elements("Loai"))
            {
                var l = new LoaiTaiSan
                {
                    Id = I(e, "id"), Ten = S(e, "ten"), TienTo = S(e, "tienTo"), Nhom = S(e, "nhom"),
                    SoNamKhauHao = I(e, "soNam"), ChuKyBaoTri = I(e, "chuKy"), Truong = e.Elements("Truong").Select(x => x.Value).ToList()
                };
                d.Loai.Add(l);
                d.IdLoai = Math.Max(d.IdLoai, l.Id);
            }
            foreach (XElement e in r.Elements("DonVi"))
            {
                var dv = new DonVi { Id = I(e, "id"), Ten = S(e, "ten"), GhiChu = S(e, "ghiChu") };
                d.DonVi.Add(dv);
                d.IdDonVi = Math.Max(d.IdDonVi, dv.Id);
            }
            foreach (XElement e in r.Elements("SoMa")) d.SoMa[S(e, "tienTo")] = I(e, "so");
            foreach (XElement e in r.Elements("TaiSan"))
            {
                var t = new TaiSan
                {
                    Id = I(e, "id"), PhienBan = I(e, "pb", 1), Ma = S(e, "ma"), Ten = S(e, "ten"), LoaiId = I(e, "loai"), DonViId = I(e, "donVi"),
                    TinhTrang = S(e, "tinhTrang"), ViTri = S(e, "viTri"), NguoiSuDung = S(e, "nguoiSD"), HangSX = S(e, "hang"), Model = S(e, "model"),
                    SoSeri = S(e, "seri"), NuocSX = S(e, "nuoc"), NamSX = IN(e, "namSX"), NgaySuDung = NgayN(e, "ngaySD"), NguyenGia = DN(e, "nguyenGia"),
                    SoNamKhauHao = IN(e, "soNam"), BaoHanhDen = NgayN(e, "baoHanh"), ChuKyBaoTri = IN(e, "chuKy"), BaoTriCuoi = NgayN(e, "baoTriCuoi"),
                    KiemTraCuoi = NgayN(e, "kiemTraCuoi"), ViDo = DN(e, "viDo"), KinhDo = DN(e, "kinhDo"), AnhChinh = S(e, "anhChinh"),
                    Tao = NgayN(e, "tao") ?? DateTime.Now, Sua = NgayN(e, "sua") ?? DateTime.Now, NguoiTao = S(e, "nguoiTao"), NguoiSua = S(e, "nguoiSua")
                };
                if (!QuanLyTaiSan.TinhTrang.HopLe(t.TinhTrang)) t.TinhTrang = QuanLyTaiSan.TinhTrang.Tot;
                XElement gc = e.Element("GhiChu");
                if (gc != null) t.GhiChu = gc.Value;
                foreach (XElement x in e.Elements("TS")) t.ThongSo.Add(new KeyValuePair<string, string>(S(x, "ten"), S(x, "gt")));
                foreach (XElement x in e.Elements("Anh")) if (MaAnhHopLe(S(x, "ma"))) t.Anh.Add(S(x, "ma"));
                if (t.Id <= 0 || t.Ma.Length == 0) continue;
                d.TaiSan.Add(t);
                d.IdTaiSan = Math.Max(d.IdTaiSan, t.Id);
            }
            foreach (XElement e in r.Elements("KiemKe"))
            {
                var k = new DotKiemKe
                {
                    Id = I(e, "id"), Ten = S(e, "ten"), Dong = S(e, "dong") == "1", TuNgay = NgayN(e, "tuNgay") ?? DateTime.Today, DenNgay = NgayN(e, "denNgay"),
                    GhiChu = S(e, "ghiChu"), NguoiTao = S(e, "nguoiTao"), Tao = NgayN(e, "tao") ?? DateTime.Now
                };
                foreach (string s in S(e, "donVi").Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    int v;
                    if (int.TryParse(s, NumberStyles.Integer, Inv, out v)) k.DonVi.Add(v);
                }
                XElement ds = e.Element("DanhSach");
                if (ds != null)
                    foreach (string s in ds.Value.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
                    {
                        int v;
                        if (int.TryParse(s, NumberStyles.Integer, Inv, out v)) k.DanhSach.Add(v);
                    }
                d.KiemKe.Add(k);
                d.IdKiemKe = Math.Max(d.IdKiemKe, k.Id);
            }
            return d;
        }
    }
}
