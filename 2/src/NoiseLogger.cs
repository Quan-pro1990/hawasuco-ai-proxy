using System;
using System.Collections.Generic;
using System.Linq;

namespace ThatThoatNuoc
{
    /// <summary>Chỗ gắn noise logger trên mạng lưới.</summary>
    public enum LoaiDiemNl
    {
        Van,
        TruCuuHoa,
        DongHo,
        OngLo,      // ống lộ thiên / hố van có ống
        Khac
    }

    /// <summary>Kết luận từ tiếng ồn ban đêm.</summary>
    public enum KetLuanNl
    {
        ChuaCoSo,
        BinhThuong,
        TheoDoi,
        NghiRoRi
    }

    public enum TrangThaiRoRi
    {
        ChoDoTim,   // logger báo nghi rò, chờ tổ dò tìm (nghe đất, máy tương quan)
        DaXacDinh,  // đã xác định điểm rò, chờ sửa
        DaSua,      // đã sửa xong
        KhongThay   // dò không thấy rò (báo động giả: dùng nước ban đêm, máy bơm…)
    }

    /// <summary>1 thiết bị noise logger (thiết bị ghi tiếng ồn dò rò rỉ).</summary>
    public class ThietBiNl
    {
        public int Id;
        public string Ma = "";      // số seri / mã logger — khớp với cột mã trong file xuất từ phần mềm của hãng
        public string Loai = "";    // hãng, model (vd "Gutermann ZONESCAN 820")
        public bool Hong;           // hỏng / thanh lý: không lắp được nữa
        public string GhiChu = "";

        public override string ToString() { return Loai.Length > 0 ? Ma + " (" + Loai + ")" : Ma; }
    }

    /// <summary>Vị trí lắp logger: van, trụ cứu hoả, đồng hồ… thuộc 1 đội / khu vực / vùng DMA.</summary>
    public class DiemNl
    {
        public int Id;
        public string Ten = "";          // vd "Van D150 ngã ba Trần Hưng Đạo – 3/2"
        public LoaiDiemNl Loai;
        public int DonViId = -1;         // dòng đội / khu vực / DMA của báo cáo thất thoát (Muc.Id); -1 = chưa xếp
        public string DuongOng = "";     // vd "PVC D110"
        public string ToaDo = "";        // vd "9.7845, 105.4712" (chép từ Google Maps)
        public bool Ngung;               // không dùng nữa (số đo cũ vẫn giữ)
        public string GhiChu = "";

        public override string ToString() { return Ten; }
    }

    /// <summary>1 lần lắp logger tại 1 điểm (lắp từ ngày … đến ngày thu về).</summary>
    public class LapDatNl
    {
        public int Id, ThietBiId, DiemId;
        public DateTime TuNgay;
        public DateTime? DenNgay;        // null = đang lắp
        public string GhiChu = "";

        public bool DangLap { get { return !DenNgay.HasValue; } }

        public bool CoNgay(DateTime d)
        {
            return d.Date >= TuNgay.Date && (!DenNgay.HasValue || d.Date <= DenNgay.Value.Date);
        }
    }

    /// <summary>Số đo 1 đêm tại 1 điểm (lúc vắng người dùng nước, thường 2h–4h sáng).</summary>
    public class SoDoNl
    {
        public int DiemId;
        public DateTime Ngay;            // ngày của buổi sáng ghi số (đêm 15 rạng sáng 16 → 16)
        public double? MucOn;            // mức ồn tối thiểu ban đêm (dB)
        public double? DoTrai;           // độ trải (spread): nhỏ = tiếng ồn đều, liên tục suốt đêm → dấu hiệu rò
        public double? TanSo;            // tần số trội (Hz)
        public int ThietBiId = -1;       // logger đã ghi (-1 = nhập tay / không rõ)

        public bool Trong { get { return !MucOn.HasValue && !DoTrai.HasValue && !TanSo.HasValue; } }
    }

    /// <summary>1 ca rò rỉ phát hiện nhờ logger: dò tìm → xác định → sửa.</summary>
    public class RoRiNl
    {
        public int Id, DiemId;
        public DateTime NgayPhatHien;
        public TrangThaiRoRi TrangThai;
        public string ViTri = "";        // vị trí rò cụ thể sau khi dò (số nhà, cách van bao nhiêu m…)
        public string HangMuc = "";      // ống chính / ống nhánh / đồng hồ / van / mối nối…
        public DateTime? NgaySua;
        public double? LuuLuong;         // lưu lượng rò ước tính (m³/h)
        public string GhiChu = "";

        public bool DangMo { get { return TrangThai == TrangThaiRoRi.ChoDoTim || TrangThai == TrangThaiRoRi.DaXacDinh; } }

        /// <summary>Nước tiết kiệm được sau khi sửa (m³/tháng) = lưu lượng rò × 24 giờ × 30 ngày.</summary>
        public double? TietKiemThang
        {
            get { return TrangThai == TrangThaiRoRi.DaSua && LuuLuong.HasValue ? LuuLuong.Value * 24 * 30 : (double?)null; }
        }
    }

    /// <summary>Ngưỡng phân loại tiếng ồn (mỗi hãng logger dùng thang khác nhau — chỉnh theo thiết bị đang dùng).</summary>
    public class NguongNl
    {
        public const double MacDinhRoRi = 30, MacDinhTheoDoi = 20, MacDinhDoTrai = 10, MacDinhTang = 6;
        public const int MacDinhSoDem = 2;

        public double RoRi = MacDinhRoRi;        // mức ồn ≥ ngưỡng này (và độ trải nhỏ) → nghi rò
        public double TheoDoi = MacDinhTheoDoi;  // mức ồn ≥ ngưỡng này → cần theo dõi
        public double DoTrai = MacDinhDoTrai;    // độ trải ≤ ngưỡng này → tiếng ồn đều (rò); lớn hơn → lúc có lúc không (dùng nước, bơm…)
        public int SoDem = MacDinhSoDem;         // số đêm liên tiếp vượt ngưỡng rò mới kết luận nghi rò
        public double Tang = MacDinhTang;        // mức ồn tăng so với mức nền ≥ ngưỡng này → có thể mới rò

        public bool MacDinh
        {
            get { return RoRi == MacDinhRoRi && TheoDoi == MacDinhTheoDoi && DoTrai == MacDinhDoTrai && SoDem == MacDinhSoDem && Tang == MacDinhTang; }
        }
    }

    /// <summary>Dữ liệu noise logger (dò tìm rò rỉ) — tách riêng với số liệu báo cáo thất thoát.</summary>
    public class DuLieuNl
    {
        public List<ThietBiNl> ThietBi = new List<ThietBiNl>();
        public List<DiemNl> Diem = new List<DiemNl>();
        public List<LapDatNl> LapDat = new List<LapDatNl>();
        public List<RoRiNl> RoRi = new List<RoRiNl>();
        public NguongNl Nguong = new NguongNl();
        public int NextId = 1;

        // số đo theo điểm, mỗi danh sách xếp tăng dần theo ngày
        readonly Dictionary<int, List<SoDoNl>> soDo = new Dictionary<int, List<SoDoNl>>();

        public bool Trong
        {
            get { return ThietBi.Count == 0 && Diem.Count == 0 && LapDat.Count == 0 && RoRi.Count == 0 && SoLuongSoDo == 0 && Nguong.MacDinh; }
        }

        public int CapId() { return NextId++; }

        public ThietBiNl TimThietBi(int id) { return ThietBi.FirstOrDefault(x => x.Id == id); }
        public DiemNl TimDiem(int id) { return Diem.FirstOrDefault(x => x.Id == id); }
        public RoRiNl TimRoRi(int id) { return RoRi.FirstOrDefault(x => x.Id == id); }

        public ThietBiNl TimThietBiTheoMa(string ma)
        {
            string k = ChuanMa(ma);
            return k.Length == 0 ? null : ThietBi.FirstOrDefault(x => ChuanMa(x.Ma) == k);
        }

        /// <summary>Mã logger so sánh không phân biệt hoa thường, khoảng trắng, số 0 ở đầu ("00123" = "123").</summary>
        public static string ChuanMa(string ma)
        {
            string s = new string((ma ?? "").Where(c => !char.IsWhiteSpace(c)).ToArray()).ToUpperInvariant();
            if (s.Length > 1 && s.All(char.IsDigit)) s = s.TrimStart('0');
            return s.Length == 0 && (ma ?? "").Trim().Length > 0 ? "0" : s;
        }

        // ------------------------------------------------------------------ số đo

        public int SoLuongSoDo { get { return soDo.Values.Sum(l => l.Count); } }

        /// <summary>Số đo của điểm (xếp theo ngày tăng dần) — chỉ đọc, sửa bằng DatSoDo / XoaSoDo.</summary>
        public IList<SoDoNl> SoDoCua(int diemId)
        {
            List<SoDoNl> l;
            return soDo.TryGetValue(diemId, out l) ? (IList<SoDoNl>)l.AsReadOnly() : new SoDoNl[0];
        }

        public IEnumerable<int> DiemCoSoDo { get { return soDo.Where(p => p.Value.Count > 0).Select(p => p.Key); } }

        static int TimViTri(List<SoDoNl> l, DateTime ngay)
        {
            int lo = 0, hi = l.Count - 1;
            while (lo <= hi)
            {
                int mid = (lo + hi) / 2;
                int c = l[mid].Ngay.CompareTo(ngay);
                if (c == 0) return mid;
                if (c < 0) lo = mid + 1;
                else hi = mid - 1;
            }
            return ~lo;
        }

        public SoDoNl TimSoDo(int diemId, DateTime ngay)
        {
            List<SoDoNl> l;
            if (!soDo.TryGetValue(diemId, out l)) return null;
            int i = TimViTri(l, ngay.Date);
            return i >= 0 ? l[i] : null;
        }

        /// <summary>Thêm / thay số đo của điểm trong đêm [s.Ngay]; số đo trống thì xoá.</summary>
        public void DatSoDo(SoDoNl s)
        {
            s.Ngay = s.Ngay.Date;
            if (s.Trong)
            {
                XoaSoDo(s.DiemId, s.Ngay);
                return;
            }
            List<SoDoNl> l;
            if (!soDo.TryGetValue(s.DiemId, out l))
            {
                l = new List<SoDoNl>();
                soDo[s.DiemId] = l;
            }
            int i = TimViTri(l, s.Ngay);
            if (i >= 0) l[i] = s;
            else l.Insert(~i, s);
        }

        public bool XoaSoDo(int diemId, DateTime ngay)
        {
            List<SoDoNl> l;
            if (!soDo.TryGetValue(diemId, out l)) return false;
            int i = TimViTri(l, ngay.Date);
            if (i < 0) return false;
            l.RemoveAt(i);
            if (l.Count == 0) soDo.Remove(diemId);
            return true;
        }

        public void XoaSoDoCuaDiem(int diemId) { soDo.Remove(diemId); }

        /// <summary>Đêm mới nhất có số đo (của các điểm thoả [loc]); null nếu chưa có.</summary>
        public DateTime? NgayMoiNhat(Func<int, bool> loc)
        {
            DateTime? max = null;
            foreach (var p in soDo)
            {
                if (p.Value.Count == 0 || (loc != null && !loc(p.Key))) continue;
                DateTime d = p.Value[p.Value.Count - 1].Ngay;
                if (!max.HasValue || d > max.Value) max = d;
            }
            return max;
        }

        // ------------------------------------------------------------------ lắp đặt

        public IEnumerable<LapDatNl> LapDatCuaDiem(int diemId) { return LapDat.Where(x => x.DiemId == diemId).OrderBy(x => x.TuNgay); }
        public IEnumerable<LapDatNl> LapDatCuaThietBi(int tbId) { return LapDat.Where(x => x.ThietBiId == tbId).OrderBy(x => x.TuNgay); }

        /// <summary>Logger lắp tại điểm vào ngày [ngay] (lần lắp gần nhất nếu ngày đó vừa thu vừa lắp).</summary>
        public LapDatNl LapDatTai(int diemId, DateTime ngay)
        {
            return LapDat.Where(x => x.DiemId == diemId && x.CoNgay(ngay)).OrderByDescending(x => x.TuNgay).FirstOrDefault();
        }

        /// <summary>
        /// Logger [tbId] đặt ở đâu khi ghi số đêm [ngay]. Số ghi lúc rạng sáng: ngày chuyển logger (thu ở điểm cũ, lắp
        /// điểm mới cùng ngày) thì số đo của ngày đó thuộc điểm cũ.
        /// </summary>
        public LapDatNl LapDatCuaThietBiNgay(int tbId, DateTime ngay)
        {
            return LapDat.Where(x => x.ThietBiId == tbId && x.CoNgay(ngay)).OrderBy(x => x.TuNgay).FirstOrDefault();
        }

        public LapDatNl DangLapCuaThietBi(int tbId) { return LapDat.FirstOrDefault(x => x.ThietBiId == tbId && x.DangLap); }
        public LapDatNl DangLapTaiDiem(int diemId) { return LapDat.Where(x => x.DiemId == diemId && x.DangLap).OrderByDescending(x => x.TuNgay).FirstOrDefault(); }

        // ------------------------------------------------------------------ rò rỉ

        public IEnumerable<RoRiNl> RoRiCuaDiem(int diemId) { return RoRi.Where(x => x.DiemId == diemId).OrderBy(x => x.NgayPhatHien); }

        public RoRiNl RoRiMo(int diemId)
        {
            return RoRi.Where(x => x.DiemId == diemId && x.DangMo).OrderByDescending(x => x.NgayPhatHien).FirstOrDefault();
        }

        // ------------------------------------------------------------------ tên hiển thị

        public static string TenLoai(LoaiDiemNl l)
        {
            switch (l)
            {
                case LoaiDiemNl.Van: return "Van";
                case LoaiDiemNl.TruCuuHoa: return "Trụ cứu hoả";
                case LoaiDiemNl.DongHo: return "Đồng hồ";
                case LoaiDiemNl.OngLo: return "Ống lộ / hố van";
                default: return "Khác";
            }
        }

        public static string TenTrangThai(TrangThaiRoRi t)
        {
            switch (t)
            {
                case TrangThaiRoRi.ChoDoTim: return "Chờ dò tìm";
                case TrangThaiRoRi.DaXacDinh: return "Đã xác định, chờ sửa";
                case TrangThaiRoRi.DaSua: return "Đã sửa";
                default: return "Không thấy rò";
            }
        }

        public static string TenKetLuan(KetLuanNl k)
        {
            switch (k)
            {
                case KetLuanNl.NghiRoRi: return "Nghi rò rỉ";
                case KetLuanNl.TheoDoi: return "Cần theo dõi";
                case KetLuanNl.BinhThuong: return "Bình thường";
                default: return "Chưa có số đo";
            }
        }

        public static readonly string[] GoiYHangMuc =
        {
            "Ống chính (ống phân phối)", "Ống nhánh / ống dịch vụ", "Đồng hồ khách hàng", "Van / trụ cứu hoả", "Mối nối", "Khác"
        };
    }

    /// <summary>Kết quả phân tích 1 điểm tính đến đêm đang xem.</summary>
    public class KetQuaNl
    {
        public DiemNl Diem;
        public DateTime Ngay;
        public SoDoNl DemNay;            // số đo đúng đêm đang xem (null nếu chưa có)
        public SoDoNl MoiNhat;           // số đo mới nhất tính đến đêm đang xem
        public KetLuanNl KetLuanDem;     // phân loại riêng đêm đang xem
        public KetLuanNl KetLuan;        // kết luận của điểm (xét nhiều đêm)
        public string LyDo = "";
        public double? MucNen;           // mức nền: trung vị các đêm trong 30 ngày trước tuần gần nhất
        public double? GanDay;           // trung vị các đêm gần nhất (để so mức nền)
        public int SoDemVuot;            // số đêm liên tiếp gần nhất vượt ngưỡng rò
        public RoRiNl RoRiMo;            // ca rò rỉ chưa xử lý xong của điểm
        public LapDatNl LapDat;          // logger lắp ở điểm vào đêm đang xem

        public double? Tang { get { return GanDay.HasValue && MucNen.HasValue ? GanDay.Value - MucNen.Value : (double?)null; } }
    }

    /// <summary>
    /// Phân tích tiếng ồn ban đêm. Rò rỉ tạo tiếng ồn đều đặn, liên tục cả đêm: mức ồn tối thiểu cao và độ trải nhỏ,
    /// lặp lại nhiều đêm liền. Tiếng ồn cao nhưng độ trải lớn thường do dùng nước / máy bơm (cần theo dõi thêm).
    /// Mức ồn tăng rõ so với mức nền của chính điểm đó → có thể vừa xuất hiện rò mới.
    /// </summary>
    public static class PhanTichNl
    {
        public const int SoNgayCu = 3;          // số đo cũ hơn chừng này ngày → coi như chưa có số đo
        public const int TuanGanDay = 7;
        public const int NgayNen = 30;

        public static KetLuanNl PhanLoai(SoDoNl s, NguongNl n)
        {
            if (s == null || !s.MucOn.HasValue) return KetLuanNl.ChuaCoSo;
            double m = s.MucOn.Value;
            if (m >= n.RoRi) return s.DoTrai.HasValue && s.DoTrai.Value > n.DoTrai ? KetLuanNl.TheoDoi : KetLuanNl.NghiRoRi;
            return m >= n.TheoDoi ? KetLuanNl.TheoDoi : KetLuanNl.BinhThuong;
        }

        public static double? TrungVi(IEnumerable<double> values)
        {
            var v = values.OrderBy(x => x).ToList();
            if (v.Count == 0) return null;
            return v.Count % 2 == 1 ? v[v.Count / 2] : (v[v.Count / 2 - 1] + v[v.Count / 2]) / 2;
        }

        public static KetQuaNl PhanTich(DuLieuNl d, DiemNl diem, DateTime ngay)
        {
            ngay = ngay.Date;
            NguongNl n = d.Nguong;
            var kq = new KetQuaNl { Diem = diem, Ngay = ngay };
            kq.LapDat = d.LapDatTai(diem.Id, ngay);
            kq.RoRiMo = d.RoRi.Where(x => x.DiemId == diem.Id && x.DangMo && x.NgayPhatHien.Date <= ngay)
                              .OrderByDescending(x => x.NgayPhatHien).FirstOrDefault();
            var ds = d.SoDoCua(diem.Id).Where(x => x.Ngay <= ngay && x.MucOn.HasValue).ToList();
            kq.DemNay = d.TimSoDo(diem.Id, ngay);
            kq.KetLuanDem = PhanLoai(kq.DemNay, n);
            if (ds.Count == 0)
            {
                kq.KetLuan = KetLuanNl.ChuaCoSo;
                kq.LyDo = kq.LapDat != null ? "Logger đã lắp, chưa có số đo" : "Chưa có số đo";
                return kq;
            }
            SoDoNl moi = ds[ds.Count - 1];
            kq.MoiNhat = moi;
            // số đo liên tiếp gần nhất cùng vượt ngưỡng rò (không xét số đo quá 14 ngày)
            for (int i = ds.Count - 1; i >= 0 && (ngay - ds[i].Ngay).TotalDays <= 14; i--)
            {
                if (PhanLoai(ds[i], n) != KetLuanNl.NghiRoRi) break;
                kq.SoDemVuot++;
            }
            var ganDay = ds.Where(x => (ngay - x.Ngay).TotalDays < TuanGanDay).Select(x => x.MucOn.Value).ToList();
            var nen = ds.Where(x => (ngay - x.Ngay).TotalDays >= TuanGanDay && (ngay - x.Ngay).TotalDays < TuanGanDay + NgayNen)
                        .Select(x => x.MucOn.Value).ToList();
            kq.GanDay = TrungVi(ganDay);
            if (nen.Count >= 3) kq.MucNen = TrungVi(nen);

            if ((ngay - moi.Ngay).TotalDays > SoNgayCu)
            {
                kq.KetLuan = KetLuanNl.ChuaCoSo;
                kq.LyDo = "Số đo mới nhất đêm " + So.Ngay(moi.Ngay) + " (" + So.M3(moi.MucOn) + " dB)";
                return kq;
            }
            KetLuanNl cuoi = PhanLoai(moi, n);
            double? tang = kq.Tang;
            if (kq.SoDemVuot >= Math.Max(1, n.SoDem))
            {
                kq.KetLuan = KetLuanNl.NghiRoRi;
                kq.LyDo = kq.SoDemVuot + " đêm liền mức ồn ≥ " + So.M3(n.RoRi) + " dB" + (moi.DoTrai.HasValue ? ", độ trải ≤ " + So.M3(n.DoTrai) : "") +
                          " — tiếng ồn đều, liên tục";
            }
            else if (cuoi == KetLuanNl.NghiRoRi)
            {
                kq.KetLuan = KetLuanNl.TheoDoi;
                kq.LyDo = "Vượt ngưỡng rò " + kq.SoDemVuot + "/" + n.SoDem + " đêm — chờ thêm số đo để kết luận";
            }
            else if (tang.HasValue && tang.Value >= n.Tang && kq.GanDay.Value >= n.TheoDoi)
            {
                kq.KetLuan = KetLuanNl.TheoDoi;
                kq.LyDo = "Mức ồn tăng " + So.M3(Math.Round(tang.Value, 1)) + " dB so với mức nền " + So.M3(Math.Round(kq.MucNen.Value, 1)) + " dB — có thể mới rò";
            }
            else if (cuoi == KetLuanNl.TheoDoi)
            {
                kq.KetLuan = KetLuanNl.TheoDoi;
                kq.LyDo = moi.MucOn.Value >= n.RoRi
                    ? "Mức ồn cao nhưng độ trải lớn (" + So.M3(moi.DoTrai) + ") — tiếng ồn lúc có lúc không (dùng nước, máy bơm?)"
                    : "Mức ồn " + So.M3(moi.MucOn) + " dB ≥ ngưỡng theo dõi " + So.M3(n.TheoDoi) + " dB";
            }
            else
            {
                kq.KetLuan = KetLuanNl.BinhThuong;
                kq.LyDo = tang.HasValue && tang.Value >= n.Tang ? "Mức ồn tăng " + So.M3(Math.Round(tang.Value, 1)) + " dB so với mức nền nhưng còn thấp" : "";
            }
            return kq;
        }

        /// <summary>Trung vị mức ồn trước / sau ngày sửa (để xem sửa xong tiếng ồn có giảm không).</summary>
        public static void TruocSauSua(DuLieuNl d, RoRiNl r, out double? truoc, out double? sau)
        {
            truoc = sau = null;
            var ds = d.SoDoCua(r.DiemId).Where(x => x.MucOn.HasValue).ToList();
            DateTime moc = r.NgaySua.HasValue ? r.NgaySua.Value.Date : DateTime.MaxValue;
            DateTime dau = r.NgayPhatHien.Date.AddDays(-TuanGanDay);
            truoc = TrungVi(ds.Where(x => x.Ngay >= dau && x.Ngay <= moc && x.Ngay <= r.NgayPhatHien.Date.AddDays(TuanGanDay))
                              .Select(x => x.MucOn.Value));
            if (r.NgaySua.HasValue)
                sau = TrungVi(ds.Where(x => x.Ngay > moc && x.Ngay <= moc.AddDays(TuanGanDay)).Select(x => x.MucOn.Value));
        }
    }

    /// <summary>Đơn vị (đội / khu vực / DMA) của báo cáo thất thoát dùng để xếp điểm logger.</summary>
    public class DonViNl
    {
        public int Id;
        public string Ten = "";
        public VaiTro VaiTro;
        public int Cap;                  // 0 = đội, 1 = khu vực / DMA của đội…
        public HashSet<int> Con = new HashSet<int>();   // Id của chính nó và mọi đơn vị nằm trong khối của nó
        public DonViNl Cha;              // đội / khu vực chứa nó (null = cấp ngoài cùng)

        /// <summary>vd "DMA Long Mỹ 1 — Đội 2"</summary>
        public string TenDayDu { get { return Cha != null ? Ten + " — " + Cha.Ten : Ten; } }

        public override string ToString() { return new string(' ', Cap * 4) + Ten; }
    }

    /// <summary>Các điểm logger của 1 đơn vị (để hiện / in theo nhóm).</summary>
    public class NhomDiemNl
    {
        public int DonViId;              // -1 = chưa xếp đơn vị
        public string Ten = "";
        public List<DiemNl> Diem = new List<DiemNl>();
    }

    public static class DonViNlOps
    {
        /// <summary>Đội / khu vực / DMA theo cấu trúc tháng mới nhất (xếp như báo cáo), kèm các đơn vị con.</summary>
        public static List<DonViNl> DanhSach(DuLieu dl)
        {
            var list = new List<DonViNl>();
            ThangBaoCao t = dl.ThangCuoi;
            if (t == null) return list;
            var dongs = t.Muc;
            for (int i = 0; i < dongs.Count; i++)
            {
                Muc m = dongs[i];
                if (m.VaiTro != VaiTro.Doi && m.VaiTro != VaiTro.KhuVuc && m.VaiTro != VaiTro.Dma) continue;
                var dv = new DonViNl { Id = m.Id, Ten = m.TenTongHop, VaiTro = m.VaiTro };
                dv.Con.Add(m.Id);
                for (int j = i + 1; j < dongs.Count && dongs[j].Cap > m.Cap; j++) dv.Con.Add(dongs[j].Id);
                list.Add(dv);
            }
            // thụt lề theo số đơn vị bao ngoài; cha = đơn vị bao ngoài gần nhất
            foreach (DonViNl dv in list)
            {
                var ngoai = list.Where(x => x != dv && x.Con.Contains(dv.Id) && !dv.Con.Contains(x.Id)).ToList();
                dv.Cap = ngoai.Count;
                dv.Cha = ngoai.OrderBy(x => x.Con.Count).FirstOrDefault();
            }
            return list;
        }

        /// <summary>
        /// Xếp điểm theo đơn vị (thứ tự như báo cáo thất thoát); [donViLoc] ≥ 0 thì chỉ lấy điểm của đơn vị đó và các đơn vị con.
        /// Đơn vị đã bỏ khỏi cấu trúc tháng mới nhất và điểm chưa xếp đơn vị để cuối.
        /// </summary>
        public static List<NhomDiemNl> Nhom(DuLieu dl, IEnumerable<DiemNl> diems, int donViLoc)
        {
            List<DonViNl> dvs = DanhSach(dl);
            DonViNl loc = donViLoc >= 0 ? dvs.FirstOrDefault(x => x.Id == donViLoc) : null;
            var list = diems.Where(p => donViLoc < 0 || (loc != null ? loc.Con.Contains(p.DonViId) : p.DonViId == donViLoc)).ToList();
            var groups = new List<NhomDiemNl>();
            foreach (DonViNl dv in dvs)
            {
                var ps = list.Where(p => p.DonViId == dv.Id).ToList();
                if (ps.Count > 0) groups.Add(new NhomDiemNl { DonViId = dv.Id, Ten = dv.TenDayDu, Diem = ps });
            }
            foreach (var g in list.Where(p => p.DonViId >= 0 && !dvs.Any(x => x.Id == p.DonViId)).GroupBy(p => p.DonViId))
            {
                string ten = Ten(dl, g.Key);
                groups.Add(new NhomDiemNl { DonViId = g.Key, Ten = ten.Length > 0 ? ten + " (không còn trong cấu trúc tháng mới nhất)" : "Đơn vị đã xoá", Diem = g.ToList() });
            }
            var chua = list.Where(p => p.DonViId < 0).ToList();
            if (chua.Count > 0) groups.Add(new NhomDiemNl { DonViId = -1, Ten = "Chưa xếp đội / DMA", Diem = chua });
            return groups;
        }

        public static string TenDayDu(DuLieu dl, int id)
        {
            if (id < 0) return "";
            DonViNl dv = DanhSach(dl).FirstOrDefault(x => x.Id == id);
            return dv != null ? dv.TenDayDu : Ten(dl, id);
        }

        /// <summary>Tên đơn vị theo tháng mới nhất có dòng [id] (đơn vị đã bỏ khỏi cấu trúc vẫn hiện tên cũ).</summary>
        public static string Ten(DuLieu dl, int id)
        {
            if (id < 0) return "";
            for (int i = dl.Thang.Count - 1; i >= 0; i--)
            {
                Muc m = dl.Thang[i].Tim(id);
                if (m != null) return m.TenTongHop;
            }
            return "";
        }
    }
}
