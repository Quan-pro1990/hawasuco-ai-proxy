using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Xml.Linq;

namespace NoiseLogger
{
    /// <summary>
    /// Lấy danh sách đội / khu vực / vùng DMA (theo cấu trúc tháng mới nhất), tên công ty, người ký từ file dữ liệu
    /// thatthoat.xml của phần mềm Quản lý thất thoát nước. File của bản 1.1.0 (Noise Logger còn là 1 trang trong phần mềm đó)
    /// có thẻ &lt;NoiseLogger&gt;: lấy luôn logger, điểm, lần lắp, số đo, ca rò rỉ khi phần mềm này chưa có số liệu.
    /// </summary>
    public static class NhapThatThoat
    {
        public class KetQua
        {
            public int DonViMoi, DonViCapNhat;
            public string ThangCauTruc = "";
            public bool DaLayCaiDat, DaLayNoiseLogger;
            public readonly List<string> ThongBao = new List<string>();
        }

        class Dong
        {
            public int Id, Cap;
            public string VaiTro = "", Ten = "";
        }

        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        static int I(XElement e, string name, int fallback)
        {
            XAttribute a = e.Attribute(name);
            int v;
            return a != null && int.TryParse(a.Value, NumberStyles.Integer, Inv, out v) ? v : fallback;
        }

        static string S(XElement e, string name)
        {
            XAttribute a = e.Attribute(name);
            return a == null ? "" : a.Value;
        }

        static LoaiDonVi Loai(string vaiTro)
        {
            switch (vaiTro)
            {
                case "Doi": return LoaiDonVi.Doi;
                case "KhuVuc": return LoaiDonVi.KhuVuc;
                case "Dma": return LoaiDonVi.Dma;
                default: return LoaiDonVi.Khac;
            }
        }

        static bool LaDonVi(Dong r) { return r.VaiTro == "Doi" || r.VaiTro == "KhuVuc" || r.VaiTro == "Dma"; }

        static List<Dong> DocDong(XElement thang)
        {
            return thang.Elements("Muc").Select(m => new Dong
            {
                Id = I(m, "id", 0), Cap = I(m, "cap", 0), VaiTro = S(m, "vaiTro"),
                Ten = VanBan.ChuanHoa(S(m, "tenNgan").Length > 0 ? S(m, "tenNgan") : S(m, "ten"))
            }).ToList();
        }

        /// <summary>Thư mục dữ liệu của phần mềm Quản lý thất thoát nước nếu để cạnh thư mục phần mềm này (vd ..\2\DuLieu).</summary>
        public static string DoanThuMuc()
        {
            try
            {
                var goc = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory).Parent;
                if (goc == null) return null;
                foreach (DirectoryInfo d in goc.GetDirectories())
                {
                    string p = Path.Combine(d.FullName, "DuLieu", "thatthoat.xml");
                    if (File.Exists(p)) return Path.GetDirectoryName(p);
                }
            }
            catch (Exception) { }
            return null;
        }

        public static KetQua Nhap(string path, DuLieuNl d)
        {
            XElement root = XDocument.Load(path).Root;
            if (root == null || root.Name != "ThatThoatNuoc")
                throw new InvalidDataException("Không phải file dữ liệu của phần mềm Quản lý thất thoát nước (thatthoat.xml).");
            var kq = new KetQua();
            var thangs = root.Elements("Thang").OrderBy(t => I(t, "nam", 0) * 12 + I(t, "thang", 1)).ToList();
            var mucMap = new Dictionary<int, int>();   // Id dòng trong phần mềm thất thoát → Id đơn vị ở đây
            if (thangs.Count > 0)
            {
                XElement cuoi = thangs[thangs.Count - 1];
                kq.ThangCauTruc = "tháng " + I(cuoi, "thang", 1) + "/" + I(cuoi, "nam", 0);
                List<Dong> dong = DocDong(cuoi);
                for (int i = 0; i < dong.Count; i++)
                {
                    Dong r = dong[i];
                    if (!LaDonVi(r)) continue;
                    // cha = đội / khu vực gần nhất phía trên mà khối của nó (các dòng cấp lớn hơn liền sau) chứa dòng này
                    int cha = -1, minCap = r.Cap;
                    for (int j = i - 1; j >= 0; j--)
                    {
                        if (LaDonVi(dong[j]) && dong[j].Cap < minCap && mucMap.ContainsKey(dong[j].Id)) { cha = mucMap[dong[j].Id]; break; }
                        minCap = Math.Min(minCap, dong[j].Cap);
                        if (minCap <= 0) break;
                    }
                    mucMap[r.Id] = LayDonVi(d, r.Id, r.Ten, Loai(r.VaiTro), cha, kq);
                }
            }
            else kq.ThongBao.Add("File chưa có tháng báo cáo nào nên không có danh sách đội / DMA.");

            XElement cd = root.Element("CaiDat");
            if (cd != null && d.CaiDat.ChuaSua)
            {
                if (S(cd, "tenCongTy1").Length > 0) d.CaiDat.TenCongTy1 = S(cd, "tenCongTy1");
                if (S(cd, "tenCongTy2").Length > 0) d.CaiDat.TenCongTy2 = S(cd, "tenCongTy2");
                if (S(cd, "diaDanh").Length > 0) d.CaiDat.DiaDanh = S(cd, "diaDanh");
                var ky = cd.Elements("Ky").ToList();
                // người ký giữa (phòng kinh doanh) của báo cáo thất thoát thường khác người ký báo cáo dò rò rỉ: chỉ lấy người ký 1 và lập biểu
                foreach (int i in new[] { 0, 2 })
                    if (i < ky.Count) d.CaiDat.KyMacDinh[i] = new NguoiKy(S(ky[i], "dong1"), S(ky[i], "dong2"), S(ky[i], "ten"));
                kq.DaLayCaiDat = true;
            }

            XElement nl = root.Element("NoiseLogger");
            if (nl != null)
            {
                if (d.Diem.Count > 0 || d.ThietBi.Count > 0 || d.SoLuongSoDo > 0)
                    kq.ThongBao.Add("File có số liệu Noise Logger cũ (phần mềm thất thoát bản 1.1.0) nhưng phần mềm này đã có số liệu nên không lấy, tránh trùng.");
                else
                {
                    LayNoiseLogger(KhoDuLieu.DocXml(nl), d, mucMap, thangs, kq);
                    kq.DaLayNoiseLogger = true;
                }
            }
            return kq;
        }

        /// <summary>Đơn vị đã lấy lần trước (cùng Id dòng) hoặc trùng tên: cập nhật; chưa có: thêm.</summary>
        static int LayDonVi(DuLieuNl d, int mucId, string ten, LoaiDonVi loai, int cha, KetQua kq)
        {
            DonVi g = d.DonVi.FirstOrDefault(x => x.MaThatThoat == mucId) ??
                      d.DonVi.FirstOrDefault(x => x.MaThatThoat < 0 && VanBan.BoDau(x.Ten) == VanBan.BoDau(ten));
            if (g == null)
            {
                g = new DonVi { Id = d.CapId(), Ten = ten, Loai = loai, ChaId = cha, MaThatThoat = mucId };
                d.DonVi.Add(g);
                kq.DonViMoi++;
                return g.Id;
            }
            if (g.Ten != ten || g.Loai != loai || g.ChaId != cha || g.MaThatThoat != mucId) kq.DonViCapNhat++;
            g.Ten = ten;
            g.Loai = loai;
            if (cha != g.Id) g.ChaId = cha;
            g.MaThatThoat = mucId;
            return g.Id;
        }

        /// <summary>Chép số liệu Noise Logger cũ sang, cấp Id mới; điểm thuộc đơn vị không còn ở tháng mới nhất: thêm đơn vị theo tên cũ.</summary>
        static void LayNoiseLogger(DuLieuNl cu, DuLieuNl d, Dictionary<int, int> mucMap, List<XElement> thangs, KetQua kq)
        {
            var tb = new Dictionary<int, int>();
            var diem = new Dictionary<int, int>();
            foreach (ThietBiNl t in cu.ThietBi)
            {
                tb[t.Id] = d.CapId();
                d.ThietBi.Add(new ThietBiNl { Id = tb[t.Id], Ma = t.Ma, Loai = t.Loai, Hong = t.Hong, GhiChu = t.GhiChu });
            }
            foreach (DiemNl p in cu.Diem)
            {
                diem[p.Id] = d.CapId();
                int dv = -1;
                if (p.DonViId >= 0 && !mucMap.TryGetValue(p.DonViId, out dv))
                {
                    // đơn vị đã bỏ khỏi cấu trúc: tìm tên ở các tháng trước
                    Dong r = null;
                    for (int i = thangs.Count - 1; i >= 0 && r == null; i--) r = DocDong(thangs[i]).FirstOrDefault(x => x.Id == p.DonViId);
                    dv = r != null ? LayDonVi(d, r.Id, r.Ten, Loai(r.VaiTro), -1, kq) : -1;
                    if (r != null) mucMap[p.DonViId] = dv;
                }
                d.Diem.Add(new DiemNl
                {
                    Id = diem[p.Id], Ten = p.Ten, Loai = p.Loai, DonViId = dv, DuongOng = p.DuongOng, ToaDo = p.ToaDo, Ngung = p.Ngung, GhiChu = p.GhiChu
                });
            }
            foreach (LapDatNl l in cu.LapDat)
            {
                if (!tb.ContainsKey(l.ThietBiId) || !diem.ContainsKey(l.DiemId)) continue;
                d.LapDat.Add(new LapDatNl { Id = d.CapId(), ThietBiId = tb[l.ThietBiId], DiemId = diem[l.DiemId], TuNgay = l.TuNgay, DenNgay = l.DenNgay, GhiChu = l.GhiChu });
            }
            foreach (RoRiNl r in cu.RoRi)
            {
                if (!diem.ContainsKey(r.DiemId)) continue;
                d.RoRi.Add(new RoRiNl
                {
                    Id = d.CapId(), DiemId = diem[r.DiemId], NgayPhatHien = r.NgayPhatHien, TrangThai = r.TrangThai, ViTri = r.ViTri, HangMuc = r.HangMuc,
                    NgaySua = r.NgaySua, LuuLuong = r.LuuLuong, GhiChu = r.GhiChu
                });
            }
            int soDo = 0;
            foreach (int id in cu.DiemCoSoDo.ToList())
            {
                if (!diem.ContainsKey(id)) continue;
                foreach (SoDoNl s in cu.SoDoCua(id))
                {
                    int t;
                    d.DatSoDo(new SoDoNl
                    {
                        DiemId = diem[id], Ngay = s.Ngay, MucOn = s.MucOn, DoTrai = s.DoTrai, TanSo = s.TanSo,
                        ThietBiId = s.ThietBiId >= 0 && tb.TryGetValue(s.ThietBiId, out t) ? t : -1
                    });
                    soDo++;
                }
            }
            if (d.Nguong.MacDinh) d.Nguong = cu.Nguong;
            kq.ThongBao.Add("Đã lấy số liệu Noise Logger cũ: " + d.ThietBi.Count + " logger, " + d.Diem.Count + " điểm, " + d.LapDat.Count + " lần lắp, " +
                            soDo + " đêm số đo, " + d.RoRi.Count + " ca rò rỉ.");
        }
    }
}
