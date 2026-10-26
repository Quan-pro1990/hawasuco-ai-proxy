using System;
using System.Collections.Generic;
using System.Globalization;

namespace ChinhAnhAI
{
    public static class UngDung
    {
        public const string Ten = "Chỉnh ảnh AI";
        public const string PhienBan = "1.0.0";
    }

    /// <summary>Các thanh chỉnh — cùng ý nghĩa và đơn vị như trong Lightroom để AI và người dùng cùng hiểu.</summary>
    public enum TS
    {
        PhoiSang,       // Exposure, EV
        TuongPhan,      // Contrast
        VungSang,       // Highlights
        VungToi,        // Shadows
        DiemTrang,      // Whites
        DiemDen,        // Blacks
        NhietDo,        // Temperature: + ấm (vàng), − lạnh (xanh)
        SacDo,          // Tint: + hồng tím, − xanh lá
        SongDong,       // Vibrance: tăng màu nhạt nhiều, màu đậm ít, giữ màu da
        BaoHoa,         // Saturation
        RoNet,          // Clarity: tương phản chi tiết vùng trung tính
        KhuSuongMu,     // Dehaze
        LamNet,         // Sharpening
        GiamNhieu,      // Noise reduction (độ sáng + màu)
        LamMinDa,       // Làm mịn da
        VienToi,        // Vignette: − tối viền, + sáng viền
        LamPhai,        // Fade: nâng điểm đen kiểu phim
        MauToiSac,      // Tô màu vùng tối: sắc độ (0..360°)
        MauToiDo,       // Tô màu vùng tối: mức (0..100)
        MauSangSac,     // Tô màu vùng sáng: sắc độ
        MauSangDo,      // Tô màu vùng sáng: mức
    }

    public class MoTaThongSo
    {
        public TS Ma;
        public string Khoa;      // tên trong JSON gửi / nhận của AI
        public string Ten;       // tên hiện trên giao diện
        public string Nhom;
        public double Min, Max;
        public int SoLe;         // số chữ số thập phân hiện
        public bool LaSacDo;     // góc màu: không nhân theo cường độ
        public string GiaiThich; // dùng trong lời nhắc AI

        public MoTaThongSo(TS ma, string khoa, string ten, string nhom, double min, double max, int soLe, string giaiThich)
        {
            Ma = ma; Khoa = khoa; Ten = ten; Nhom = nhom; Min = min; Max = max; SoLe = soLe; GiaiThich = giaiThich;
        }

        public string Hien(double v)
        {
            string s = v.ToString(SoLe == 0 ? "0" : "0.00", CultureInfo.InvariantCulture);
            if (Min < 0 && v > 0.0001 && !LaSacDo) s = "+" + s;
            return s;
        }
    }

    /// <summary>Một bộ thông số chỉnh ảnh. Tất cả = 0 nghĩa là giữ nguyên ảnh gốc.</summary>
    public class ThongSo
    {
        public static readonly MoTaThongSo[] DanhSach;
        public static readonly int SoLuong;

        static ThongSo()
        {
            DanhSach = new[]
            {
                new MoTaThongSo(TS.PhoiSang, "phoi_sang", "Phơi sáng", "Ánh sáng", -3, 3, 2, "exposure in EV stops, -3..3 (0.3 is a visible change)"),
                new MoTaThongSo(TS.TuongPhan, "tuong_phan", "Tương phản", "Ánh sáng", -100, 100, 0, "global contrast S-curve, -100..100"),
                new MoTaThongSo(TS.VungSang, "vung_sang", "Vùng sáng", "Ánh sáng", -100, 100, 0, "highlights, -100..100; negative recovers bright areas / sky"),
                new MoTaThongSo(TS.VungToi, "vung_toi", "Vùng tối", "Ánh sáng", -100, 100, 0, "shadows, -100..100; positive opens up dark areas (local, edge-aware)"),
                new MoTaThongSo(TS.DiemTrang, "diem_trang", "Điểm trắng", "Ánh sáng", -100, 100, 0, "whites (white point), -100..100; positive makes whites brighter"),
                new MoTaThongSo(TS.DiemDen, "diem_den", "Điểm đen", "Ánh sáng", -100, 100, 0, "blacks (black point), -100..100; negative makes blacks deeper"),
                new MoTaThongSo(TS.NhietDo, "nhiet_do", "Nhiệt độ màu", "Màu sắc", -100, 100, 0, "white balance temperature relative to the shot, -100..100; positive = warmer/yellow, negative = cooler/blue; 30 is a strong shift"),
                new MoTaThongSo(TS.SacDo, "sac_do", "Sắc độ (tint)", "Màu sắc", -100, 100, 0, "white balance tint, -100..100; positive = magenta, negative = green"),
                new MoTaThongSo(TS.SongDong, "song_dong", "Sống động", "Màu sắc", -100, 100, 0, "vibrance, -100..100; boosts muted colors more than saturated ones and protects skin"),
                new MoTaThongSo(TS.BaoHoa, "bao_hoa", "Bão hòa", "Màu sắc", -100, 100, 0, "saturation, -100..100; affects all colors equally"),
                new MoTaThongSo(TS.RoNet, "ro_net", "Rõ nét (clarity)", "Chi tiết", -100, 100, 0, "clarity (midtone local contrast), -100..100; negative softens"),
                new MoTaThongSo(TS.KhuSuongMu, "khu_suong_mu", "Khử sương mù", "Chi tiết", -100, 100, 0, "dehaze, -100..100; positive removes haze/fog, negative adds haze"),
                new MoTaThongSo(TS.LamNet, "lam_net", "Làm nét", "Chi tiết", 0, 150, 0, "output sharpening, 0..150 (40 is typical, the image shown to you is downscaled)"),
                new MoTaThongSo(TS.GiamNhieu, "giam_nhieu", "Giảm nhiễu", "Chi tiết", 0, 100, 0, "noise reduction (luminance + color), 0..100"),
                new MoTaThongSo(TS.LamMinDa, "lam_min_da", "Làm mịn da", "Chi tiết", 0, 100, 0, "skin smoothing for portraits, 0..100 (20-40 is natural, 0 when there are no people)"),
                new MoTaThongSo(TS.VienToi, "vien_toi", "Viền tối", "Hiệu ứng", -100, 100, 0, "vignette, -100..100; negative darkens the corners"),
                new MoTaThongSo(TS.LamPhai, "lam_phai", "Làm phai (film)", "Hiệu ứng", 0, 100, 0, "fade / matte film look by lifting the black floor, 0..100"),
                new MoTaThongSo(TS.MauToiSac, "mau_toi_sac", "Màu vùng tối — sắc", "Hiệu ứng", 0, 360, 0, "split toning: hue added to shadows in degrees 0..360 (200 = teal)"),
                new MoTaThongSo(TS.MauToiDo, "mau_toi_do", "Màu vùng tối — mức", "Hiệu ứng", 0, 100, 0, "split toning: strength of the shadow tint, 0..100 (0 = off)"),
                new MoTaThongSo(TS.MauSangSac, "mau_sang_sac", "Màu vùng sáng — sắc", "Hiệu ứng", 0, 360, 0, "split toning: hue added to highlights in degrees 0..360 (35 = warm orange)"),
                new MoTaThongSo(TS.MauSangDo, "mau_sang_do", "Màu vùng sáng — mức", "Hiệu ứng", 0, 100, 0, "split toning: strength of the highlight tint, 0..100 (0 = off)"),
            };
            DanhSach[(int)TS.MauToiSac].LaSacDo = true;
            DanhSach[(int)TS.MauSangSac].LaSacDo = true;
            SoLuong = DanhSach.Length;
        }

        public readonly double[] V = new double[SoLuong];
        public bool DenTrang;   // ảnh đen trắng

        public double this[TS k]
        {
            get { return V[(int)k]; }
            set { V[(int)k] = value; }
        }

        public ThongSo Sao()
        {
            var t = new ThongSo();
            Array.Copy(V, t.V, SoLuong);
            t.DenTrang = DenTrang;
            return t;
        }

        /// <summary>Kéo về trong khoảng cho phép của từng thanh.</summary>
        public ThongSo Kep()
        {
            for (int i = 0; i < SoLuong; i++)
            {
                MoTaThongSo m = DanhSach[i];
                double v = V[i];
                if (double.IsNaN(v) || double.IsInfinity(v)) v = 0;
                if (m.LaSacDo) { v %= 360; if (v < 0) v += 360; }
                V[i] = Math.Max(m.Min, Math.Min(m.Max, v));
            }
            return this;
        }

        /// <summary>Cường độ chỉnh: 0 = ảnh gốc, 1 = đúng thông số, 1.5 = mạnh hơn. Góc màu giữ nguyên.</summary>
        public ThongSo NhanCuongDo(double k)
        {
            var t = Sao();
            for (int i = 0; i < SoLuong; i++)
                if (!DanhSach[i].LaSacDo) t.V[i] = V[i] * k;
            t.DenTrang = DenTrang && k > 0;
            return t.Kep();
        }

        public bool LaGoc
        {
            get
            {
                if (DenTrang) return false;
                for (int i = 0; i < SoLuong; i++)
                    if (!DanhSach[i].LaSacDo && Math.Abs(V[i]) > 1e-6) return false;
                return true;
            }
        }

        public Dictionary<string, object> SangJson()
        {
            var d = new Dictionary<string, object>();
            foreach (MoTaThongSo m in DanhSach) d[m.Khoa] = Math.Round(V[(int)m.Ma], m.SoLe == 0 ? 0 : 2);
            d["den_trang"] = DenTrang;
            return d;
        }

        /// <summary>Đọc từ JSON của AI; khoá thiếu thì giữ giá trị của <paramref name="macDinh"/>.</summary>
        public static ThongSo TuJson(IDictionary<string, object> d, ThongSo macDinh)
        {
            ThongSo t = macDinh != null ? macDinh.Sao() : new ThongSo();
            foreach (MoTaThongSo m in DanhSach)
            {
                object o;
                if (d.TryGetValue(m.Khoa, out o) && o != null)
                {
                    double v;
                    if (double.TryParse(Convert.ToString(o, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out v))
                        t.V[(int)m.Ma] = v;
                }
            }
            object bw;
            if (d.TryGetValue("den_trang", out bw) && bw is bool) t.DenTrang = (bool)bw;
            return t.Kep();
        }
    }
}
