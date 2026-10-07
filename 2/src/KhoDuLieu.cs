using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Xml.Linq;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Lưu toàn bộ số liệu vào 1 file XML (DuLieu\thatthoat.xml cạnh file .exe).
    /// Ghi ra file tạm rồi mới thay file chính; file cũ giữ thành .bak; mỗi ngày giữ 1 bản trong SaoLuu.
    /// </summary>
    public class KhoDuLieu
    {
        public const string TenFile = "thatthoat.xml";
        const int GiuSaoLuu = 90;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public readonly string ThuMuc;
        public DuLieu DuLieu;
        public string CanhBaoKhiMo;

        public event EventHandler DaLuu;

        public string DuongDan { get { return Path.Combine(ThuMuc, TenFile); } }
        public string ThuMucSaoLuu { get { return Path.Combine(ThuMuc, "SaoLuu"); } }

        public KhoDuLieu(string thuMuc)
        {
            ThuMuc = thuMuc;
        }

        public static KhoDuLieu Mo()
        {
            var kho = new KhoDuLieu(TimThuMuc());
            kho.Doc();
            return kho;
        }

        static string TimThuMuc()
        {
            string dir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "DuLieu");
            if (GhiDuoc(dir)) return dir;
            dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ThatThoatNuoc", "DuLieu");
            Directory.CreateDirectory(dir);
            return dir;
        }

        static bool GhiDuoc(string dir)
        {
            try
            {
                Directory.CreateDirectory(dir);
                string probe = Path.Combine(dir, ".ghithu");
                File.WriteAllText(probe, "1");
                File.Delete(probe);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        public void Doc()
        {
            if (!File.Exists(DuongDan))
            {
                DuLieu = new DuLieu();
                return;
            }
            try
            {
                DuLieu = DocFile(DuongDan);
            }
            catch (Exception ex)
            {
                // Không mở được file chính: thử bản .bak, giữ lại bản hỏng để không mất gì.
                string broken = DuongDan + ".hong-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
                File.Copy(DuongDan, broken, true);
                string bak = DuongDan + ".bak";
                if (File.Exists(bak))
                {
                    DuLieu = DocFile(bak);
                    CanhBaoKhiMo = "File dữ liệu bị hỏng (" + ex.Message + "), đã mở bản lưu trước đó.\nBản hỏng được giữ tại:\n" + broken;
                }
                else throw;
            }
        }

        public void Luu()
        {
            Directory.CreateDirectory(ThuMuc);
            SaoLuuDauNgay();
            string tmp = DuongDan + ".tmp";
            GhiFile(DuLieu, tmp);
            if (File.Exists(DuongDan))
            {
                try
                {
                    File.Replace(tmp, DuongDan, DuongDan + ".bak", true);
                }
                catch (Exception)
                {
                    File.Copy(DuongDan, DuongDan + ".bak", true);
                    File.Copy(tmp, DuongDan, true);
                    File.Delete(tmp);
                }
            }
            else File.Move(tmp, DuongDan);
            EventHandler h = DaLuu;
            if (h != null) h(this, EventArgs.Empty);
        }

        void SaoLuuDauNgay()
        {
            try
            {
                if (!File.Exists(DuongDan)) return;
                Directory.CreateDirectory(ThuMucSaoLuu);
                string today = Path.Combine(ThuMucSaoLuu, "thatthoat_" + DateTime.Now.ToString("yyyy-MM-dd") + ".xml");
                if (File.Exists(today)) return;
                File.Copy(DuongDan, today);
                foreach (FileInfo f in new DirectoryInfo(ThuMucSaoLuu).GetFiles("thatthoat_*.xml")
                                          .OrderByDescending(f => f.Name).Skip(GiuSaoLuu))
                    f.Delete();
            }
            catch (Exception) { }
        }

        public string SaoLuuNgay()
        {
            Directory.CreateDirectory(ThuMucSaoLuu);
            string path = Path.Combine(ThuMucSaoLuu, "thatthoat_" + DateTime.Now.ToString("yyyy-MM-dd_HHmmss") + ".xml");
            GhiFile(DuLieu, path);
            return path;
        }

        // ------------------------------------------------------------------ ghi XML

        static string D(double v) { return v.ToString("R", Inv); }

        static void Attr(XElement e, string name, string v)
        {
            if (!string.IsNullOrEmpty(v)) e.SetAttributeValue(name, v);
        }

        static void Attr(XElement e, string name, double? v)
        {
            if (v.HasValue) e.SetAttributeValue(name, D(v.Value));
        }

        static void Attr(XElement e, string name, DateTime? v)
        {
            if (v.HasValue) e.SetAttributeValue(name, v.Value.ToString("yyyy-MM-dd", Inv));
        }

        static XElement Ky(string tag, NguoiKy k)
        {
            var e = new XElement(tag);
            Attr(e, "dong1", k.Dong1);
            Attr(e, "dong2", k.Dong2);
            Attr(e, "ten", k.Ten);
            return e;
        }

        static XElement SoHangXml(string tag, List<SoHang> list)
        {
            var e = new XElement(tag);
            foreach (SoHang s in list)
            {
                var t = new XElement("T", new XAttribute("id", s.Id));
                if (s.HeSo != 1) t.SetAttributeValue("k", D(s.HeSo));
                e.Add(t);
            }
            return e;
        }

        public static void GhiFile(DuLieu d, string path)
        {
            GhiXml(d).Save(path);
        }

        /// <summary>Toàn bộ dữ liệu dạng XML UTF-8 (gửi lên / nhận từ máy chủ).</summary>
        public static byte[] GhiBytes(DuLieu d)
        {
            using (var ms = new MemoryStream())
            {
                GhiXml(d).Save(ms);
                return ms.ToArray();
            }
        }

        public static DuLieu DocBytes(byte[] b)
        {
            using (var ms = new MemoryStream(b)) return DocXml(XDocument.Load(ms));
        }

        public static XDocument GhiXml(DuLieu d)
        {
            var root = new XElement("ThatThoatNuoc", new XAttribute("phienBan", 1), new XAttribute("nextId", d.NextId));
            var cd = new XElement("CaiDat");
            Attr(cd, "tenCongTy1", d.CaiDat.TenCongTy1);
            Attr(cd, "tenCongTy2", d.CaiDat.TenCongTy2);
            Attr(cd, "diaDanh", d.CaiDat.DiaDanh);
            Attr(cd, "nguongCanhBao", (double?)d.CaiDat.NguongCanhBao);
            Attr(cd, "thuMucXuat", d.CaiDat.ThuMucXuat);
            for (int i = 0; i < 3; i++) cd.Add(Ky("Ky", d.CaiDat.KyMacDinh[i]));
            root.Add(cd);

            foreach (var kv in d.KeHoach.OrderBy(k => k.Key))
            {
                var kh = new XElement("KeHoach", new XAttribute("nam", kv.Key));
                foreach (var p in kv.Value.OrderBy(p => p.Key))
                {
                    var e = new XElement("Muc", new XAttribute("id", p.Key));
                    Attr(e, "tyLe", p.Value.TyLe);
                    Attr(e, "phatRa", p.Value.PhatRa);
                    Attr(e, "chuanThu", p.Value.ChuanThu);
                    Attr(e, "doanhThu", p.Value.DoanhThu);
                    Attr(e, "tonHoaDon", p.Value.TonHoaDon);
                    kh.Add(e);
                }
                root.Add(kh);
            }
            foreach (var kv in d.Quy.OrderBy(k => k.Key))
            {
                var q = new XElement("Quy", new XAttribute("nam", kv.Key / 10), new XAttribute("quy", kv.Key % 10));
                foreach (var p in kv.Value.OrderBy(p => p.Key))
                {
                    if (!p.Value.QuyTruoc.HasValue && !p.Value.CungKy.HasValue) continue;
                    var e = new XElement("Muc", new XAttribute("id", p.Key));
                    Attr(e, "quyTruoc", p.Value.QuyTruoc);
                    Attr(e, "cungKy", p.Value.CungKy);
                    q.Add(e);
                }
                root.Add(q);
            }
            foreach (ThangBaoCao t in d.Thang)
            {
                var te = new XElement("Thang", new XAttribute("nam", t.Nam), new XAttribute("thang", t.Thang));
                Attr(te, "kyHoaDon", t.KyHoaDon);
                Attr(te, "tuNgay", t.TuNgay);
                Attr(te, "denNgay", t.DenNgay);
                Attr(te, "ngayLap", t.NgayLap);
                if (!string.IsNullOrEmpty(t.GhiChu)) te.Add(new XElement("GhiChu", t.GhiChu));
                for (int i = 0; i < 3; i++) te.Add(Ky("Ky", t.Ky[i]));
                foreach (Muc m in t.Muc)
                {
                    var e = new XElement("Muc", new XAttribute("id", m.Id));
                    Attr(e, "stt", m.Stt);
                    Attr(e, "ten", m.Ten);
                    Attr(e, "tenNgan", m.TenNgan);
                    if (m.Cap != 0) e.SetAttributeValue("cap", m.Cap);
                    e.SetAttributeValue("loai", m.Loai.ToString());
                    if (m.LamTron) e.SetAttributeValue("lamTron", 1);
                    if (m.MoTa != null) e.SetAttributeValue("moTa", m.MoTa);
                    if (m.SaiSo != 0) e.SetAttributeValue("saiSo", D(m.SaiSo));
                    if (m.ChuanThuLoai != LoaiChuanThu.Khong) e.SetAttributeValue("chuanThuLoai", m.ChuanThuLoai.ToString());
                    if (m.VaiTro != VaiTro.Khac) e.SetAttributeValue("vaiTro", m.VaiTro.ToString());
                    if (m.AnBaoCaoThang) e.SetAttributeValue("an", 1);
                    Attr(e, "chiSoCu", m.ChiSoCu);
                    Attr(e, "chiSoMoi", m.ChiSoMoi);
                    Attr(e, "chotCu", m.ChotCu);
                    Attr(e, "dauMoi", m.DauMoi);
                    if (m.DieuChinh != 0) e.SetAttributeValue("dieuChinh", D(m.DieuChinh));
                    Attr(e, "sanLuong", m.SanLuong);
                    Attr(e, "chuanThu", m.ChuanThu);
                    Attr(e, "cungKyThang", m.CungKyThang);
                    Attr(e, "cungKyLuyKe", m.CungKyLuyKe);
                    Attr(e, "tyLeThangTruoc", m.TyLeThangTruoc);
                    Attr(e, "luyKePhatRaTruoc", m.LuyKePhatRaTruoc);
                    Attr(e, "luyKeChuanThuTruoc", m.LuyKeChuanThuTruoc);
                    Attr(e, "tyLeNhap", m.TyLeNhap);
                    if (m.Loai == LoaiMuc.CongThuc || m.CongThuc.Count > 0) e.Add(SoHangXml("CongThuc", m.CongThuc));
                    if (m.ChuanThuLoai == LoaiChuanThu.CongThuc) e.Add(SoHangXml("CongThucChuanThu", m.CongThucChuanThu));
                    if (!string.IsNullOrEmpty(m.GhiChu)) e.Add(new XElement("GhiChu", m.GhiChu));
                    te.Add(e);
                }
                root.Add(te);
            }
            if (!d.Cap1.Trong) root.Add(GhiCap1(d.Cap1));
            return new XDocument(new XDeclaration("1.0", "utf-8", null), root);
        }

        // ------------------------------------------------------------------ đồng hồ cấp 1

        static XElement GhiCap1(DuLieuCap1 c)
        {
            var e = new XElement("Cap1", new XAttribute("nextId", c.NextId));
            foreach (DoiCap1 d in c.Doi)
                e.Add(new XElement("Doi", new XAttribute("id", d.Id), new XAttribute("ten", d.Ten)));
            foreach (TramCap1 t in c.Tram)
                e.Add(new XElement("Tram", new XAttribute("id", t.Id), new XAttribute("doi", t.DoiId), new XAttribute("ten", t.Ten)));
            foreach (DongHoCap1 h in c.DongHo)
            {
                var x = new XElement("DongHo", new XAttribute("id", h.Id), new XAttribute("tram", h.TramId), new XAttribute("ten", h.Ten),
                                     new XAttribute("nguon", h.Nguon.ToString()));
                if (h.HeSo != 1) x.SetAttributeValue("heSo", D(h.HeSo));
                if (h.Ngung) x.SetAttributeValue("ngung", 1);
                Attr(x, "ghiChu", h.GhiChu);
                e.Add(x);
            }
            foreach (KyCap1 k in c.Ky)
            {
                var ke = new XElement("Ky", new XAttribute("nam", k.Nam), new XAttribute("thang", k.Thang));
                Attr(ke, "kyHoaDon", k.KyHoaDon);
                Attr(ke, "tuNgay", k.TuNgay);
                Attr(ke, "denNgay", k.DenNgay);
                Attr(ke, "ngayLap", k.NgayLap);
                foreach (var p in k.ThoiGianChot.Where(p => !string.IsNullOrEmpty(p.Value)))
                    ke.Add(new XElement("Chot", new XAttribute("tram", p.Key), new XAttribute("ghi", p.Value)));
                foreach (ChiSoCap1 s in k.ChiSo)
                {
                    var se = new XElement("CS", new XAttribute("dh", s.DongHoId));
                    Attr(se, "cu", s.ChiSoCu);
                    Attr(se, "moi", s.ChiSoMoi);
                    Attr(se, "chotCu", s.ChotCu);
                    Attr(se, "dauMoi", s.DauMoi);
                    Attr(se, "sanLuong", s.SanLuongNhap);
                    Attr(se, "luyKeTruoc", s.LuyKeTruoc);
                    Attr(se, "ghiChu", s.GhiChu);
                    ke.Add(se);
                }
                e.Add(ke);
            }
            return e;
        }

        static DuLieuCap1 DocCap1(XElement e)
        {
            var c = new DuLieuCap1();
            int max = 0;
            foreach (XElement x in e.Elements("Doi"))
            {
                var d = new DoiCap1 { Id = I(x, "id", 0), Ten = S(x, "ten") };
                c.Doi.Add(d);
                max = Math.Max(max, d.Id);
            }
            foreach (XElement x in e.Elements("Tram"))
            {
                var t = new TramCap1 { Id = I(x, "id", 0), DoiId = I(x, "doi", 0), Ten = S(x, "ten") };
                c.Tram.Add(t);
                max = Math.Max(max, t.Id);
            }
            foreach (XElement x in e.Elements("DongHo"))
            {
                var h = new DongHoCap1
                {
                    Id = I(x, "id", 0), TramId = I(x, "tram", 0), Ten = S(x, "ten"), Nguon = En(x, "nguon", NguonNuoc.Gieng),
                    HeSo = N(x, "heSo") ?? 1, Ngung = I(x, "ngung", 0) == 1, GhiChu = S(x, "ghiChu")
                };
                c.DongHo.Add(h);
                max = Math.Max(max, h.Id);
            }
            foreach (XElement x in e.Elements("Ky"))
            {
                var k = new KyCap1 { Nam = I(x, "nam", 2000), Thang = I(x, "thang", 1), KyHoaDon = S(x, "kyHoaDon") };
                k.TuNgay = Dt(x, "tuNgay");
                k.DenNgay = Dt(x, "denNgay");
                k.NgayLap = Dt(x, "ngayLap");
                foreach (XElement ch in x.Elements("Chot")) k.ThoiGianChot[I(ch, "tram", 0)] = S(ch, "ghi");
                foreach (XElement s in x.Elements("CS"))
                    k.ChiSo.Add(new ChiSoCap1
                    {
                        DongHoId = I(s, "dh", 0), ChiSoCu = N(s, "cu"), ChiSoMoi = N(s, "moi"), ChotCu = N(s, "chotCu"), DauMoi = N(s, "dauMoi"),
                        SanLuongNhap = N(s, "sanLuong"), LuyKeTruoc = N(s, "luyKeTruoc"), GhiChu = S(s, "ghiChu")
                    });
                c.Ky.Add(k);
            }
            c.NextId = Math.Max(I(e, "nextId", 1), max + 1);
            c.SapXep();
            return c;
        }

        // ------------------------------------------------------------------ đọc XML

        static string S(XElement e, string name)
        {
            XAttribute a = e.Attribute(name);
            return a == null ? "" : a.Value;
        }

        static double? N(XElement e, string name)
        {
            XAttribute a = e.Attribute(name);
            if (a == null) return null;
            double v;
            return double.TryParse(a.Value, NumberStyles.Float, Inv, out v) ? v : (double?)null;
        }

        static int I(XElement e, string name, int fallback)
        {
            XAttribute a = e.Attribute(name);
            int v;
            return a != null && int.TryParse(a.Value, NumberStyles.Integer, Inv, out v) ? v : fallback;
        }

        static DateTime? Dt(XElement e, string name)
        {
            XAttribute a = e.Attribute(name);
            DateTime v;
            if (a != null && DateTime.TryParseExact(a.Value, "yyyy-MM-dd", Inv, DateTimeStyles.None, out v)) return v;
            return null;
        }

        static T En<T>(XElement e, string name, T fallback) where T : struct
        {
            T v;
            XAttribute a = e.Attribute(name);
            return a != null && Enum.TryParse(a.Value, out v) ? v : fallback;
        }

        static NguoiKy DocKy(XElement e)
        {
            return new NguoiKy(S(e, "dong1"), S(e, "dong2"), S(e, "ten"));
        }

        static List<SoHang> DocSoHang(XElement e)
        {
            var list = new List<SoHang>();
            if (e == null) return list;
            foreach (XElement t in e.Elements("T")) list.Add(new SoHang(I(t, "id", 0), N(t, "k") ?? 1));
            return list;
        }

        public static DuLieu DocFile(string path)
        {
            return DocXml(XDocument.Load(path));
        }

        public static DuLieu DocXml(XDocument doc)
        {
            XElement root = doc.Root;
            if (root == null || root.Name != "ThatThoatNuoc") throw new InvalidDataException("Không phải file dữ liệu thất thoát nước");
            var d = new DuLieu();
            d.NextId = I(root, "nextId", 1);
            XElement cd = root.Element("CaiDat");
            if (cd != null)
            {
                d.CaiDat.TenCongTy1 = S(cd, "tenCongTy1");
                d.CaiDat.TenCongTy2 = S(cd, "tenCongTy2");
                d.CaiDat.DiaDanh = S(cd, "diaDanh");
                d.CaiDat.NguongCanhBao = N(cd, "nguongCanhBao") ?? 30;
                d.CaiDat.ThuMucXuat = S(cd, "thuMucXuat");
                var ky = cd.Elements("Ky").ToList();
                for (int i = 0; i < 3 && i < ky.Count; i++) d.CaiDat.KyMacDinh[i] = DocKy(ky[i]);
            }
            foreach (XElement kh in root.Elements("KeHoach"))
            {
                int nam = I(kh, "nam", 0);
                foreach (XElement m in kh.Elements("Muc"))
                {
                    int id = I(m, "id", 0);
                    d.DatKeHoach(nam, id, LoaiChiTieu.TyLe, N(m, "tyLe"));
                    d.DatKeHoach(nam, id, LoaiChiTieu.PhatRa, N(m, "phatRa"));
                    d.DatKeHoach(nam, id, LoaiChiTieu.ChuanThu, N(m, "chuanThu"));
                    d.DatKeHoach(nam, id, LoaiChiTieu.DoanhThu, N(m, "doanhThu"));
                    d.DatKeHoach(nam, id, LoaiChiTieu.TonHoaDon, N(m, "tonHoaDon"));
                }
            }
            foreach (XElement q in root.Elements("Quy"))
            {
                int nam = I(q, "nam", 0), quy = I(q, "quy", 0);
                foreach (XElement m in q.Elements("Muc"))
                {
                    SoSanhQuy s = d.LaySoSanhQuy(nam, quy, I(m, "id", 0), true);
                    s.QuyTruoc = N(m, "quyTruoc");
                    s.CungKy = N(m, "cungKy");
                }
            }
            int maxId = 0;
            foreach (XElement te in root.Elements("Thang"))
            {
                var t = new ThangBaoCao { Nam = I(te, "nam", 2000), Thang = I(te, "thang", 1) };
                t.KyHoaDon = S(te, "kyHoaDon");
                t.TuNgay = Dt(te, "tuNgay");
                t.DenNgay = Dt(te, "denNgay");
                t.NgayLap = Dt(te, "ngayLap");
                XElement gc = te.Element("GhiChu");
                t.GhiChu = gc != null ? gc.Value : "";
                var ky = te.Elements("Ky").ToList();
                for (int i = 0; i < 3 && i < ky.Count; i++) t.Ky[i] = DocKy(ky[i]);
                foreach (XElement e in te.Elements("Muc"))
                {
                    var m = new Muc();
                    m.Id = I(e, "id", 0);
                    maxId = Math.Max(maxId, m.Id);
                    m.Stt = S(e, "stt");
                    m.Ten = S(e, "ten");
                    m.TenNgan = S(e, "tenNgan");
                    m.Cap = I(e, "cap", 0);
                    m.Loai = En(e, "loai", LoaiMuc.DongHo);
                    m.LamTron = I(e, "lamTron", 0) == 1;
                    XAttribute moTa = e.Attribute("moTa");
                    m.MoTa = moTa == null ? null : moTa.Value;
                    m.SaiSo = N(e, "saiSo") ?? 0;
                    m.ChuanThuLoai = En(e, "chuanThuLoai", LoaiChuanThu.Khong);
                    m.VaiTro = En(e, "vaiTro", VaiTro.Khac);
                    m.AnBaoCaoThang = I(e, "an", 0) == 1;
                    m.ChiSoCu = N(e, "chiSoCu");
                    m.ChiSoMoi = N(e, "chiSoMoi");
                    m.ChotCu = N(e, "chotCu");
                    m.DauMoi = N(e, "dauMoi");
                    m.DieuChinh = N(e, "dieuChinh") ?? 0;
                    m.SanLuong = N(e, "sanLuong");
                    m.ChuanThu = N(e, "chuanThu");
                    m.CungKyThang = N(e, "cungKyThang");
                    m.CungKyLuyKe = N(e, "cungKyLuyKe");
                    m.TyLeThangTruoc = N(e, "tyLeThangTruoc");
                    m.LuyKePhatRaTruoc = N(e, "luyKePhatRaTruoc");
                    m.LuyKeChuanThuTruoc = N(e, "luyKeChuanThuTruoc");
                    m.TyLeNhap = N(e, "tyLeNhap");
                    m.CongThuc = DocSoHang(e.Element("CongThuc"));
                    m.CongThucChuanThu = DocSoHang(e.Element("CongThucChuanThu"));
                    XElement g = e.Element("GhiChu");
                    m.GhiChu = g != null ? g.Value : "";
                    t.Muc.Add(m);
                }
                d.Thang.Add(t);
            }
            if (d.NextId <= maxId) d.NextId = maxId + 1;
            XElement c1 = root.Element("Cap1");
            if (c1 != null) d.Cap1 = DocCap1(c1);
            d.SapXep();
            return d;
        }
    }
}
