using System;
using System.Collections.Generic;
using System.Linq;

namespace ThatThoatNuoc
{
    /// <summary>Nguồn nước của đồng hồ cấp 1 (bơm khai thác).</summary>
    public enum NguonNuoc
    {
        Gieng,      // nước ngầm / giếng khoan
        NuocMat     // sông, kênh
    }

    public class DoiCap1
    {
        public int Id;
        public string Ten = "";
    }

    /// <summary>Trạm cấp nước / nhà máy nước, trực thuộc 1 đội.</summary>
    public class TramCap1
    {
        public int Id, DoiId;
        public string Ten = "";
    }

    /// <summary>Đồng hồ (TLK) cấp 1 đặt ở đầu bơm khai thác của 1 trạm.</summary>
    public class DongHoCap1
    {
        public int Id, TramId;
        public string Ten = "";
        public NguonNuoc Nguon;
        public double HeSo = 1;     // hệ số nhân của đồng hồ (×10, ×100…)
        public bool Ngung;          // ngừng sử dụng (tháng mới không chép nữa)
        public string GhiChu = "";  // cỡ, vị trí…
    }

    /// <summary>Số liệu 1 đồng hồ trong 1 tháng.</summary>
    public class ChiSoCap1
    {
        public int DongHoId;
        public double? ChiSoCu, ChiSoMoi;
        public double? ChotCu, DauMoi;      // thay / reset đồng hồ trong kỳ
        public double? SanLuongNhap;        // nhập thẳng sản lượng (không có chỉ số)
        public double? LuyKeTruoc;          // lũy kế các tháng trước trong năm (khi chưa có các tháng đó)
        public string GhiChu = "";

        public bool ThayDongHo { get { return ChotCu.HasValue || DauMoi.HasValue; } }
    }

    /// <summary>1 tháng khai thác (tách riêng với tháng báo cáo thất thoát).</summary>
    public class KyCap1
    {
        public int Nam, Thang;
        public string KyHoaDon = "";
        public DateTime? TuNgay, DenNgay, NgayLap;     // thời gian khai thác
        public Dictionary<int, string> ThoiGianChot = new Dictionary<int, string>();   // trạm → "Từ 6h 21/8 đến 6h 21/9"
        public List<ChiSoCap1> ChiSo = new List<ChiSoCap1>();

        public int SoThu { get { return Nam * 12 + Thang - 1; } }
        public string Ten { get { return "Tháng " + Thang + "/" + Nam; } }

        public ChiSoCap1 Tim(int dongHoId)
        {
            foreach (ChiSoCap1 c in ChiSo) if (c.DongHoId == dongHoId) return c;
            return null;
        }

        public string LayThoiGianChot(int tramId)
        {
            string s;
            return ThoiGianChot.TryGetValue(tramId, out s) ? s : "";
        }
    }

    public class DuLieuCap1
    {
        public List<DoiCap1> Doi = new List<DoiCap1>();
        public List<TramCap1> Tram = new List<TramCap1>();
        public List<DongHoCap1> DongHo = new List<DongHoCap1>();
        public List<KyCap1> Ky = new List<KyCap1>();
        public int NextId = 1;

        public bool Trong { get { return Doi.Count == 0 && Tram.Count == 0 && DongHo.Count == 0 && Ky.Count == 0; } }
        public int CapId() { return NextId++; }

        public DoiCap1 TimDoi(int id) { return Doi.FirstOrDefault(x => x.Id == id); }
        public TramCap1 TimTram(int id) { return Tram.FirstOrDefault(x => x.Id == id); }
        public DongHoCap1 TimDongHo(int id) { return DongHo.FirstOrDefault(x => x.Id == id); }

        public KyCap1 TimKy(int nam, int thang) { return TimKy(nam * 12 + thang - 1); }
        public KyCap1 TimKy(int soThu) { return Ky.FirstOrDefault(k => k.SoThu == soThu); }
        public KyCap1 KyCuoi { get { return Ky.Count == 0 ? null : Ky[Ky.Count - 1]; } }
        public void SapXep() { Ky.Sort((a, b) => a.SoThu.CompareTo(b.SoThu)); }

        public IEnumerable<TramCap1> TramCuaDoi(int doiId) { return Tram.Where(t => t.DoiId == doiId); }
        public IEnumerable<DongHoCap1> DongHoCuaTram(int tramId) { return DongHo.Where(d => d.TramId == tramId); }

        /// <summary>Đồng hồ có trong tháng [k], theo thứ tự đội → trạm → đồng hồ.</summary>
        public List<DongHoCap1> DongHoTrongKy(KyCap1 k)
        {
            var ids = new HashSet<int>(k.ChiSo.Select(c => c.DongHoId));
            var list = new List<DongHoCap1>();
            foreach (DoiCap1 d in Doi)
                foreach (TramCap1 t in TramCuaDoi(d.Id))
                    list.AddRange(DongHoCuaTram(t.Id).Where(x => ids.Contains(x.Id)));
            // đồng hồ của trạm mồ côi (đội đã xoá) để cuối
            list.AddRange(DongHo.Where(x => ids.Contains(x.Id) && !list.Contains(x)));
            return list;
        }

        /// <summary>Cây đội → trạm → đồng hồ của các đồng hồ [ids] (lọc 1 đội nếu doiId ≥ 0); đồng hồ mất trạm / đội để nhóm cuối.</summary>
        public List<NhomDoiCap1> Cay(IEnumerable<int> ids, int doiId)
        {
            var set = new HashSet<int>(ids);
            var list = new List<NhomDoiCap1>();
            var co = new HashSet<int>();
            foreach (DoiCap1 doi in Doi)
            {
                if (doiId >= 0 && doi.Id != doiId) continue;
                int id = doi.Id;
                var nd = new NhomDoiCap1
                {
                    Doi = doi,
                    Loc = x => { TramCap1 t = TimTram(x.TramId); return t != null && t.DoiId == id; }
                };
                foreach (TramCap1 t in TramCuaDoi(doi.Id))
                {
                    var dhs = DongHoCuaTram(t.Id).Where(x => set.Contains(x.Id)).ToList();
                    if (dhs.Count == 0) continue;
                    int tid = t.Id;
                    nd.Tram.Add(new NhomTramCap1 { Tram = t, DongHo = dhs, Loc = x => x.TramId == tid });
                    foreach (DongHoCap1 x in dhs) co.Add(x.Id);
                }
                if (nd.Tram.Count > 0) list.Add(nd);
            }
            if (doiId < 0)
            {
                var mo = DongHo.Where(x => set.Contains(x.Id) && !co.Contains(x.Id)).ToList();
                if (mo.Count > 0)
                {
                    var moIds = new HashSet<int>(mo.Select(x => x.Id));
                    var nt = new NhomTramCap1 { Tram = new TramCap1 { Id = -1, Ten = "Chưa xếp trạm" }, DongHo = mo, Loc = x => moIds.Contains(x.Id) };
                    var nd = new NhomDoiCap1 { Doi = new DoiCap1 { Id = -1, Ten = "Chưa xếp đội" }, Loc = nt.Loc };
                    nd.Tram.Add(nt);
                    list.Add(nd);
                }
            }
            return list;
        }

        public static string TenNguon(NguonNuoc n) { return n == NguonNuoc.Gieng ? "Giếng" : "Nước mặt"; }
        public static string TenNguonDai(NguonNuoc n) { return n == NguonNuoc.Gieng ? "Nước giếng (nước ngầm)" : "Nước mặt"; }
    }

    public class NhomTramCap1
    {
        public TramCap1 Tram;
        public List<DongHoCap1> DongHo = new List<DongHoCap1>();
        public Func<DongHoCap1, bool> Loc;
    }

    public class NhomDoiCap1
    {
        public DoiCap1 Doi;
        public List<NhomTramCap1> Tram = new List<NhomTramCap1>();
        public Func<DongHoCap1, bool> Loc;
    }

    public class KetQuaCap1
    {
        public double? SanLuong;
        public double LuyKe;
        public double? ThangTruoc;
        public string CachTinh = "";
        public bool AmChiSo;    // chỉ số mới nhỏ hơn cũ
    }

    /// <summary>Tổng sản lượng của 1 nhóm đồng hồ (trạm, đội, nguồn, toàn công ty) trong 1 tháng.</summary>
    public class TongCap1
    {
        public double SanLuong, LuyKe;
        public double? ThangTruoc;
        public int SoDongHo, SoChuaNhap;
        public double? TangGiam { get { return ThangTruoc.HasValue && ThangTruoc.Value != 0 ? (SanLuong - ThangTruoc.Value) / ThangTruoc.Value * 100 : (double?)null; } }
    }

    /// <summary>Sản lượng khai thác = (chỉ số mới − cũ) × hệ số; lũy kế cộng các tháng trong năm (tháng 1 bắt đầu lại).</summary>
    public class TinhCap1
    {
        readonly DuLieuCap1 d;
        readonly Dictionary<KyCap1, Dictionary<int, KetQuaCap1>> cache = new Dictionary<KyCap1, Dictionary<int, KetQuaCap1>>();

        public TinhCap1(DuLieuCap1 d)
        {
            this.d = d;
        }

        public void XoaBoNho()
        {
            cache.Clear();
        }

        public static double? SanLuong(ChiSoCap1 c, DongHoCap1 dh, out string cachTinh)
        {
            cachTinh = "";
            if (c == null) return null;
            if (c.SanLuongNhap.HasValue)
            {
                cachTinh = "Nhập thẳng sản lượng";
                return c.SanLuongNhap;
            }
            double hs = dh != null && dh.HeSo > 0 ? dh.HeSo : 1;
            double raw;
            if (c.ThayDongHo)
            {
                if (!c.ChiSoCu.HasValue || !c.ChiSoMoi.HasValue || !c.ChotCu.HasValue || !c.DauMoi.HasValue)
                {
                    cachTinh = "Thay đồng hồ: cần đủ chỉ số tháng trước, chốt ĐH cũ, đầu ĐH mới, chỉ số hiện tại";
                    return null;
                }
                raw = (c.ChotCu.Value - c.ChiSoCu.Value) + (c.ChiSoMoi.Value - c.DauMoi.Value);
                cachTinh = "(" + So.N0(c.ChotCu) + " − " + So.N0(c.ChiSoCu) + ") + (" + So.N0(c.ChiSoMoi) + " − " + So.N0(c.DauMoi) + ")";
            }
            else
            {
                if (!c.ChiSoCu.HasValue || !c.ChiSoMoi.HasValue)
                {
                    cachTinh = !c.ChiSoMoi.HasValue ? "Chưa nhập chỉ số hiện tại" : "Chưa có chỉ số tháng trước";
                    return null;
                }
                raw = c.ChiSoMoi.Value - c.ChiSoCu.Value;
                cachTinh = So.N0(c.ChiSoMoi) + " − " + So.N0(c.ChiSoCu);
            }
            if (hs != 1) cachTinh = "(" + cachTinh + ") × " + So.Nhap(hs);
            double v = raw * hs;
            cachTinh += " = " + So.M3(v);
            return v;
        }

        public Dictionary<int, KetQuaCap1> Tinh(KyCap1 k)
        {
            Dictionary<int, KetQuaCap1> kq;
            if (cache.TryGetValue(k, out kq)) return kq;
            kq = new Dictionary<int, KetQuaCap1>();
            KyCap1 truoc = d.TimKy(k.SoThu - 1);
            Dictionary<int, KetQuaCap1> kqT = truoc != null ? Tinh(truoc) : null;
            foreach (ChiSoCap1 c in k.ChiSo)
            {
                DongHoCap1 dh = d.TimDongHo(c.DongHoId);
                var r = new KetQuaCap1();
                string ct;
                r.SanLuong = SanLuong(c, dh, out ct);
                r.CachTinh = ct;
                r.AmChiSo = !c.SanLuongNhap.HasValue && !c.ThayDongHo && c.ChiSoCu.HasValue && c.ChiSoMoi.HasValue && c.ChiSoMoi < c.ChiSoCu;
                KetQuaCap1 rt = null;
                if (kqT != null) kqT.TryGetValue(c.DongHoId, out rt);
                if (rt != null) r.ThangTruoc = rt.SanLuong;
                double nen = 0;
                if (k.Thang != 1)   // tháng 1: lũy kế bắt đầu lại
                {
                    if (c.LuyKeTruoc.HasValue) nen = c.LuyKeTruoc.Value;
                    else if (rt != null && truoc.Nam == k.Nam) nen = rt.LuyKe;
                }
                r.LuyKe = (r.SanLuong ?? 0) + nen;
                kq[c.DongHoId] = r;
            }
            cache[k] = kq;
            return kq;
        }

        /// <summary>Cộng các đồng hồ thoả [loc] trong tháng [k]; tháng trước cộng các đồng hồ thoả [loc] của tháng trước.</summary>
        public TongCap1 Tong(KyCap1 k, Func<DongHoCap1, bool> loc)
        {
            var t = new TongCap1();
            var kq = Tinh(k);
            foreach (ChiSoCap1 c in k.ChiSo)
            {
                DongHoCap1 dh = d.TimDongHo(c.DongHoId);
                if (dh == null || !loc(dh)) continue;
                KetQuaCap1 r = kq[c.DongHoId];
                t.SoDongHo++;
                if (!r.SanLuong.HasValue) t.SoChuaNhap++;
                t.SanLuong += r.SanLuong ?? 0;
                t.LuyKe += r.LuyKe;
            }
            // đồng hồ đã ngừng / bỏ trong năm: lũy kế vẫn tính phần đã khai thác ở các tháng trước
            if (k.Thang > 1)
            {
                var daCo = new HashSet<int>(k.ChiSo.Select(c => c.DongHoId));
                for (int so = k.SoThu - 1; so >= k.Nam * 12; so--)
                {
                    KyCap1 m = d.TimKy(so);
                    if (m == null) continue;
                    var kqm = Tinh(m);
                    foreach (ChiSoCap1 c in m.ChiSo)
                    {
                        if (!daCo.Add(c.DongHoId)) continue;
                        DongHoCap1 dh = d.TimDongHo(c.DongHoId);
                        if (dh != null && loc(dh)) t.LuyKe += kqm[c.DongHoId].LuyKe;
                    }
                }
            }
            KyCap1 truoc = d.TimKy(k.SoThu - 1);
            if (truoc != null)
            {
                var kqT = Tinh(truoc);
                double s = 0;
                bool co = false;
                foreach (ChiSoCap1 c in truoc.ChiSo)
                {
                    DongHoCap1 dh = d.TimDongHo(c.DongHoId);
                    if (dh == null || !loc(dh) || !kqT[c.DongHoId].SanLuong.HasValue) continue;
                    s += kqT[c.DongHoId].SanLuong.Value;
                    co = true;
                }
                if (co) t.ThangTruoc = s;
            }
            return t;
        }

        public Func<DongHoCap1, bool> CuaTram(int tramId) { return x => x.TramId == tramId; }

        public Func<DongHoCap1, bool> CuaDoi(int doiId)
        {
            return x => { TramCap1 t = d.TimTram(x.TramId); return t != null && t.DoiId == doiId; };
        }

        public static Func<DongHoCap1, bool> CuaNguon(NguonNuoc n) { return x => x.Nguon == n; }
        public static bool TatCa(DongHoCap1 x) { return true; }
    }

    /// <summary>Thao tác danh mục / tháng của đồng hồ cấp 1.</summary>
    public static class Cap1Ops
    {
        /// <summary>Tháng kế tiếp: chép các đồng hồ đang dùng, chỉ số tháng trước = chỉ số hiện tại tháng cuối, kỳ khai thác nối tiếp.</summary>
        public static KyCap1 TaoKySau(DuLieuCap1 d, KyCap1 truoc)
        {
            var k = new KyCap1
            {
                Nam = truoc.Thang == 12 ? truoc.Nam + 1 : truoc.Nam,
                Thang = truoc.Thang == 12 ? 1 : truoc.Thang + 1
            };
            k.KyHoaDon = ThangBaoCao.KyMacDinh(k.Nam, k.Thang);
            if (truoc.DenNgay.HasValue)
            {
                k.TuNgay = truoc.DenNgay.Value.AddDays(1);
                k.DenNgay = truoc.DenNgay.Value.AddMonths(1);
            }
            foreach (DongHoCap1 dh in d.DongHoTrongKy(truoc))
            {
                if (dh.Ngung) continue;
                ChiSoCap1 c = truoc.Tim(dh.Id);
                k.ChiSo.Add(new ChiSoCap1 { DongHoId = dh.Id, ChiSoCu = c != null ? c.ChiSoMoi : null });
            }
            // đồng hồ mới thêm vào danh mục nhưng chưa có trong tháng trước
            foreach (DongHoCap1 dh in d.DongHo.Where(x => !x.Ngung && k.Tim(x.Id) == null))
                k.ChiSo.Add(new ChiSoCap1 { DongHoId = dh.Id });
            return k;
        }

        public static KyCap1 TaoKyDau(DuLieuCap1 d, int nam, int thang)
        {
            var k = new KyCap1 { Nam = nam, Thang = thang, KyHoaDon = ThangBaoCao.KyMacDinh(nam, thang) };
            foreach (DongHoCap1 dh in d.DongHo.Where(x => !x.Ngung)) k.ChiSo.Add(new ChiSoCap1 { DongHoId = dh.Id });
            return k;
        }

        /// <summary>Đưa đồng hồ vào tháng [tu] và các tháng sau đã tạo.</summary>
        public static void DuaVaoTuKy(DuLieuCap1 d, KyCap1 tu, int dongHoId)
        {
            foreach (KyCap1 k in d.Ky.Where(x => x.SoThu >= tu.SoThu))
                if (k.Tim(dongHoId) == null) k.ChiSo.Add(new ChiSoCap1 { DongHoId = dongHoId });
        }

        /// <summary>Bỏ đồng hồ khỏi tháng [tu] và các tháng sau; không còn tháng nào thì xoá khỏi danh mục.</summary>
        public static bool BoTuKy(DuLieuCap1 d, KyCap1 tu, int dongHoId)
        {
            foreach (KyCap1 k in d.Ky.Where(x => x.SoThu >= tu.SoThu)) k.ChiSo.RemoveAll(c => c.DongHoId == dongHoId);
            bool conLichSu = d.Ky.Any(k => k.Tim(dongHoId) != null);
            if (!conLichSu) d.DongHo.RemoveAll(x => x.Id == dongHoId);
            else
            {
                DongHoCap1 dh = d.TimDongHo(dongHoId);
                if (dh != null) dh.Ngung = true;
            }
            return conLichSu;
        }

        /// <summary>Đổi thứ tự trong danh sách (đồng hồ trong trạm, trạm trong đội, đội).</summary>
        public static bool DiChuyen<T>(List<T> list, T item, Func<T, T, bool> cungNhom, int huong)
        {
            int i = list.IndexOf(item);
            if (i < 0) return false;
            for (int j = i + huong; j >= 0 && j < list.Count; j += huong)
            {
                if (!cungNhom(list[j], item)) continue;
                list[i] = list[j];
                list[j] = item;
                return true;
            }
            return false;
        }

        /// <summary>Sửa chỉ số hiện tại; tháng sau đã tạo mà chỉ số tháng trước còn trống / bằng số cũ thì đổi theo.</summary>
        public static bool DatChiSoMoi(DuLieuCap1 d, KyCap1 k, ChiSoCap1 cs, double? v)
        {
            double? cu = cs.ChiSoMoi;
            cs.ChiSoMoi = v;
            KyCap1 sau = d.TimKy(k.SoThu + 1);
            ChiSoCap1 c2 = sau != null ? sau.Tim(cs.DongHoId) : null;
            if (c2 == null || c2.ThayDongHo || !(c2.ChiSoCu == null || Nullable.Equals(c2.ChiSoCu, cu))) return false;
            if (Nullable.Equals(c2.ChiSoCu, v)) return false;
            c2.ChiSoCu = v;
            return true;
        }

        /// <summary>Số liệu của đồng hồ có ở tháng [k] chưa (để biết có xoá hẳn được khỏi danh mục không).</summary>
        public static bool CoSoLieu(ChiSoCap1 c)
        {
            return c != null && (c.ChiSoCu.HasValue || c.ChiSoMoi.HasValue || c.SanLuongNhap.HasValue || c.ChotCu.HasValue ||
                                 c.DauMoi.HasValue || c.LuyKeTruoc.HasValue || !string.IsNullOrEmpty(c.GhiChu));
        }

        /// <summary>Số của đội trong tên ("Đội Cấp nước số 5" → 5) để khớp tên viết khác nhau.</summary>
        public static int? SoDoi(string ten)
        {
            var m = System.Text.RegularExpressions.Regex.Match(NhapExcel.BoDau(ten), @"\bdoi\b.*?(?:so\s*)?(\d+)\s*$");
            if (!m.Success) m = System.Text.RegularExpressions.Regex.Match(NhapExcel.BoDau(ten), @"\bdoi\b\D*(\d+)");
            return m.Success ? int.Parse(m.Groups[1].Value) : (int?)null;
        }

        public static DoiCap1 TimDoiTheoTen(DuLieuCap1 d, string ten)
        {
            string b = NhapExcel.BoDau(ten);
            DoiCap1 x = d.Doi.FirstOrDefault(v => NhapExcel.BoDau(v.Ten) == b);
            if (x != null) return x;
            int? so = SoDoi(ten);
            return so.HasValue ? d.Doi.FirstOrDefault(v => SoDoi(v.Ten) == so) : null;
        }

        /// <summary>Lần đầu dùng: lấy danh sách đội từ cấu trúc báo cáo thất thoát.</summary>
        public static void KhoiTaoDoi(DuLieu dl)
        {
            DuLieuCap1 d = dl.Cap1;
            if (d.Doi.Count > 0 || dl.ThangCuoi == null) return;
            foreach (Muc m in dl.ThangCuoi.Muc.Where(x => x.VaiTro == VaiTro.Doi))
                d.Doi.Add(new DoiCap1 { Id = d.CapId(), Ten = m.TenTongHop });
        }
    }
}
