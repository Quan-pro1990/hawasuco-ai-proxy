using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Xml.Linq;

namespace NoiseLogger
{
    /// <summary>
    /// Lưu toàn bộ số liệu vào 1 file XML (DuLieu\noiselogger.xml cạnh file .exe).
    /// Ghi ra file tạm rồi mới thay file chính; file cũ giữ thành .bak; mỗi ngày giữ 1 bản trong SaoLuu.
    /// </summary>
    public class KhoDuLieu
    {
        public const string TenFile = "noiselogger.xml";
        const int GiuSaoLuu = 90;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public readonly string ThuMuc;
        public DuLieuNl DuLieu;
        public string CanhBaoKhiMo;

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
            dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "NoiseLogger", "DuLieu");
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
                DuLieu = new DuLieuNl();
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
            GhiXml(DuLieu).Save(tmp);
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
        }

        void SaoLuuDauNgay()
        {
            try
            {
                if (!File.Exists(DuongDan)) return;
                Directory.CreateDirectory(ThuMucSaoLuu);
                string today = Path.Combine(ThuMucSaoLuu, "noiselogger_" + DateTime.Now.ToString("yyyy-MM-dd") + ".xml");
                if (File.Exists(today)) return;
                File.Copy(DuongDan, today);
                foreach (FileInfo f in new DirectoryInfo(ThuMucSaoLuu).GetFiles("noiselogger_*.xml")
                                          .OrderByDescending(f => f.Name).Skip(GiuSaoLuu))
                    f.Delete();
            }
            catch (Exception) { }
        }

        public string SaoLuuNgay()
        {
            Directory.CreateDirectory(ThuMucSaoLuu);
            string path = Path.Combine(ThuMucSaoLuu, "noiselogger_" + DateTime.Now.ToString("yyyy-MM-dd_HHmmss") + ".xml");
            GhiXml(DuLieu).Save(path);
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

        public static XDocument GhiXml(DuLieuNl n)
        {
            var e = new XElement("NoiseLogger", new XAttribute("phienBan", 1), new XAttribute("nextId", n.NextId));
            CaiDatNl cd = n.CaiDat;
            var c = new XElement("CaiDat");
            Attr(c, "tenCongTy1", cd.TenCongTy1);
            Attr(c, "tenCongTy2", cd.TenCongTy2);
            Attr(c, "diaDanh", cd.DiaDanh);
            Attr(c, "thuMucXuat", cd.ThuMucXuat);
            foreach (NguoiKy k in cd.KyMacDinh)
            {
                var ke = new XElement("Ky");
                Attr(ke, "dong1", k.Dong1);
                Attr(ke, "dong2", k.Dong2);
                Attr(ke, "ten", k.Ten);
                c.Add(ke);
            }
            e.Add(c);
            NguongNl g = n.Nguong;
            e.Add(new XElement("Nguong", new XAttribute("roRi", D(g.RoRi)), new XAttribute("theoDoi", D(g.TheoDoi)), new XAttribute("doTrai", D(g.DoTrai)),
                               new XAttribute("soDem", g.SoDem), new XAttribute("tang", D(g.Tang))));
            foreach (DonVi dv in n.DonVi)
            {
                var x = new XElement("DonVi", new XAttribute("id", dv.Id), new XAttribute("ten", dv.Ten), new XAttribute("loai", dv.Loai.ToString()));
                if (dv.ChaId >= 0) x.SetAttributeValue("cha", dv.ChaId);
                if (dv.MaThatThoat >= 0) x.SetAttributeValue("maThatThoat", dv.MaThatThoat);
                Attr(x, "ghiChu", dv.GhiChu);
                e.Add(x);
            }
            foreach (ThietBiNl t in n.ThietBi)
            {
                var x = new XElement("ThietBi", new XAttribute("id", t.Id), new XAttribute("ma", t.Ma));
                Attr(x, "loai", t.Loai);
                if (t.Hong) x.SetAttributeValue("hong", 1);
                Attr(x, "ghiChu", t.GhiChu);
                e.Add(x);
            }
            foreach (DiemNl p in n.Diem)
            {
                var x = new XElement("Diem", new XAttribute("id", p.Id), new XAttribute("ten", p.Ten), new XAttribute("loai", p.Loai.ToString()));
                if (p.DonViId >= 0) x.SetAttributeValue("donVi", p.DonViId);
                Attr(x, "duongOng", p.DuongOng);
                Attr(x, "toaDo", p.ToaDo);
                if (p.Ngung) x.SetAttributeValue("ngung", 1);
                Attr(x, "ghiChu", p.GhiChu);
                e.Add(x);
            }
            foreach (LapDatNl l in n.LapDat)
            {
                var x = new XElement("LapDat", new XAttribute("id", l.Id), new XAttribute("tb", l.ThietBiId), new XAttribute("diem", l.DiemId));
                Attr(x, "tu", (DateTime?)l.TuNgay);
                Attr(x, "den", l.DenNgay);
                Attr(x, "ghiChu", l.GhiChu);
                e.Add(x);
            }
            foreach (RoRiNl r in n.RoRi)
            {
                var x = new XElement("RoRi", new XAttribute("id", r.Id), new XAttribute("diem", r.DiemId), new XAttribute("trangThai", r.TrangThai.ToString()));
                Attr(x, "ngay", (DateTime?)r.NgayPhatHien);
                Attr(x, "viTri", r.ViTri);
                Attr(x, "hangMuc", r.HangMuc);
                Attr(x, "ngaySua", r.NgaySua);
                Attr(x, "luuLuong", r.LuuLuong);
                Attr(x, "ghiChu", r.GhiChu);
                e.Add(x);
            }
            foreach (int id in n.DiemCoSoDo.OrderBy(i => i))
            {
                var x = new XElement("SoDo", new XAttribute("diem", id));
                foreach (SoDoNl s in n.SoDoCua(id))
                {
                    var y = new XElement("D");
                    Attr(y, "n", (DateTime?)s.Ngay);
                    Attr(y, "m", s.MucOn);
                    Attr(y, "t", s.DoTrai);
                    Attr(y, "f", s.TanSo);
                    if (s.ThietBiId >= 0) y.SetAttributeValue("tb", s.ThietBiId);
                    x.Add(y);
                }
                e.Add(x);
            }
            return new XDocument(new XDeclaration("1.0", "utf-8", null), e);
        }

        public static byte[] GhiBytes(DuLieuNl n)
        {
            using (var ms = new MemoryStream())
            {
                GhiXml(n).Save(ms);
                return ms.ToArray();
            }
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

        public static DuLieuNl DocFile(string path)
        {
            XElement root = XDocument.Load(path).Root;
            if (root == null || root.Name != "NoiseLogger") throw new InvalidDataException("Không phải file dữ liệu Noise Logger");
            return DocXml(root);
        }

        public static DuLieuNl DocBytes(byte[] b)
        {
            using (var ms = new MemoryStream(b)) return DocXml(XDocument.Load(ms).Root);
        }

        /// <summary>
        /// Đọc thẻ &lt;NoiseLogger&gt; — của file noiselogger.xml, hoặc thẻ cùng tên trong file thatthoat.xml của phần mềm
        /// Quản lý thất thoát nước bản 1.1.0 (khi Noise Logger còn là 1 trang của phần mềm đó; thẻ đó không có CaiDat, DonVi).
        /// </summary>
        public static DuLieuNl DocXml(XElement e)
        {
            var n = new DuLieuNl();
            int max = 0;
            XElement c = e.Element("CaiDat");
            if (c != null)
            {
                n.CaiDat.TenCongTy1 = S(c, "tenCongTy1");
                n.CaiDat.TenCongTy2 = S(c, "tenCongTy2");
                n.CaiDat.DiaDanh = S(c, "diaDanh");
                n.CaiDat.ThuMucXuat = S(c, "thuMucXuat");
                var ky = c.Elements("Ky").ToList();
                for (int i = 0; i < 3 && i < ky.Count; i++) n.CaiDat.KyMacDinh[i] = new NguoiKy(S(ky[i], "dong1"), S(ky[i], "dong2"), S(ky[i], "ten"));
            }
            XElement g = e.Element("Nguong");
            if (g != null)
            {
                n.Nguong.RoRi = N(g, "roRi") ?? NguongNl.MacDinhRoRi;
                n.Nguong.TheoDoi = N(g, "theoDoi") ?? NguongNl.MacDinhTheoDoi;
                n.Nguong.DoTrai = N(g, "doTrai") ?? NguongNl.MacDinhDoTrai;
                n.Nguong.SoDem = I(g, "soDem", NguongNl.MacDinhSoDem);
                n.Nguong.Tang = N(g, "tang") ?? NguongNl.MacDinhTang;
            }
            foreach (XElement x in e.Elements("DonVi"))
            {
                var dv = new DonVi
                {
                    Id = I(x, "id", 0), Ten = S(x, "ten"), Loai = En(x, "loai", LoaiDonVi.Khac), ChaId = I(x, "cha", -1),
                    MaThatThoat = I(x, "maThatThoat", -1), GhiChu = S(x, "ghiChu")
                };
                n.DonVi.Add(dv);
                max = Math.Max(max, dv.Id);
            }
            foreach (XElement x in e.Elements("ThietBi"))
            {
                var t = new ThietBiNl { Id = I(x, "id", 0), Ma = S(x, "ma"), Loai = S(x, "loai"), Hong = I(x, "hong", 0) == 1, GhiChu = S(x, "ghiChu") };
                n.ThietBi.Add(t);
                max = Math.Max(max, t.Id);
            }
            foreach (XElement x in e.Elements("Diem"))
            {
                var p = new DiemNl
                {
                    Id = I(x, "id", 0), Ten = S(x, "ten"), Loai = En(x, "loai", LoaiDiemNl.Van), DonViId = I(x, "donVi", -1),
                    DuongOng = S(x, "duongOng"), ToaDo = S(x, "toaDo"), Ngung = I(x, "ngung", 0) == 1, GhiChu = S(x, "ghiChu")
                };
                n.Diem.Add(p);
                max = Math.Max(max, p.Id);
            }
            foreach (XElement x in e.Elements("LapDat"))
            {
                DateTime? tu = Dt(x, "tu");
                if (!tu.HasValue) continue;
                var l = new LapDatNl { Id = I(x, "id", 0), ThietBiId = I(x, "tb", 0), DiemId = I(x, "diem", 0), TuNgay = tu.Value, DenNgay = Dt(x, "den"), GhiChu = S(x, "ghiChu") };
                n.LapDat.Add(l);
                max = Math.Max(max, l.Id);
            }
            foreach (XElement x in e.Elements("RoRi"))
            {
                DateTime? ngay = Dt(x, "ngay");
                if (!ngay.HasValue) continue;
                var r = new RoRiNl
                {
                    Id = I(x, "id", 0), DiemId = I(x, "diem", 0), NgayPhatHien = ngay.Value, TrangThai = En(x, "trangThai", TrangThaiRoRi.ChoDoTim),
                    ViTri = S(x, "viTri"), HangMuc = S(x, "hangMuc"), NgaySua = Dt(x, "ngaySua"), LuuLuong = N(x, "luuLuong"), GhiChu = S(x, "ghiChu")
                };
                n.RoRi.Add(r);
                max = Math.Max(max, r.Id);
            }
            foreach (XElement x in e.Elements("SoDo"))
            {
                int diem = I(x, "diem", 0);
                foreach (XElement y in x.Elements("D"))
                {
                    DateTime? ngay = Dt(y, "n");
                    if (!ngay.HasValue) continue;
                    n.DatSoDo(new SoDoNl { DiemId = diem, Ngay = ngay.Value, MucOn = N(y, "m"), DoTrai = N(y, "t"), TanSo = N(y, "f"), ThietBiId = I(y, "tb", -1) });
                }
            }
            n.NextId = Math.Max(I(e, "nextId", 1), max + 1);
            return n;
        }
    }
}
