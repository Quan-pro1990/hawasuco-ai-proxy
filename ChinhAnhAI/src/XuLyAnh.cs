using System;
using System.Threading;

namespace ChinhAnhAI
{
    /// <summary>
    /// Bộ máy dựng ảnh: nhận ảnh gốc + thông số, trả ảnh đã chỉnh. Thứ tự giống quy trình hậu kỳ chuyên nghiệp:
    /// cân bằng trắng → phơi sáng → khử sương → giảm nhiễu → vùng tối / vùng sáng / rõ nét → đường cong tông
    /// → màu sắc → làm mịn da → làm nét → viền tối. Không đổi ảnh gốc (chỉnh không phá huỷ).
    /// </summary>
    public static class XuLyAnh
    {
        // Hệ số đổi thanh Nhiệt độ / Sắc độ sang lệch log của hệ số kênh màu (±100 ≈ đổi R/B 2,7 lần)
        const double KT = 1.0, KM = 0.5;

        /// <summary>Hệ số nhân kênh R, G, B (tuyến tính) cho thanh Nhiệt độ / Sắc độ, giữ nguyên độ sáng.</summary>
        public static void HeSoCanBangTrang(double nhietDo, double sacDo, out double gr, out double gg, out double gb)
        {
            double uT = KT * nhietDo / 100, uM = KM * sacDo / 100;
            gr = Math.Exp(uT / 2 + uM * 2 / 3);
            gb = Math.Exp(-uT / 2 + uM * 2 / 3);
            gg = Math.Exp(-uM / 3);
            double y = 0.2126 * gr + 0.7152 * gg + 0.0722 * gb;
            gr /= y; gg /= y; gb /= y;
        }

        /// <summary>Ngược lại: hệ số kênh cần nhân → giá trị thanh Nhiệt độ / Sắc độ.</summary>
        public static void TuHeSo(double gr, double gg, double gb, out double nhietDo, out double sacDo)
        {
            double lr = Math.Log(gr), lg = Math.Log(gg), lb = Math.Log(gb);
            nhietDo = 100 * (lr - lb) / KT;
            sacDo = 100 * ((lr + lb) / 2 - lg) / KM;
        }

        public static byte[] Ve(AnhNguon a, ThongSo p)
        {
            return Ve(a, p, CancellationToken.None);
        }

        public static byte[] Ve(AnhNguon a, ThongSo p, CancellationToken huy)
        {
            int w = a.W, h = a.H, n = w * h;
            double cheo = Math.Sqrt((double)w * w + (double)h * h);
            float[] r = new float[n], g = new float[n], b = new float[n];

            // 1. Cân bằng trắng + phơi sáng (ánh sáng tuyến tính, như chỉnh trên file RAW)
            double gr, gg, gb;
            HeSoCanBangTrang(p[TS.NhietDo], p[TS.SacDo], out gr, out gg, out gb);
            double ev = Math.Pow(2, p[TS.PhoiSang]);
            float kr = (float)(gr * ev), kg = (float)(gg * ev), kb = (float)(gb * ev);
            byte[] src = a.Bgr;
            float[] lin = Mau.Lin8;
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    int j = i * 3;
                    b[i] = lin[src[j]] * kb;
                    g[i] = lin[src[j + 1]] * kg;
                    r[i] = lin[src[j + 2]] * kr;
                }
            });
            huy.ThrowIfCancellationRequested();

            // 2. Khử sương mù
            double ks = p[TS.KhuSuongMu] / 100;
            if (Math.Abs(ks) > 0.005) KhuSuongMu(r, g, b, w, h, ks);
            huy.ThrowIfCancellationRequested();

            // 3. Tông sáng trên độ sáng cảm nhận P (= độ sáng hiển thị 0..1)
            float[] P = new float[n];
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++) P[i] = Mau.MaHoa(0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i]);
            });
            // ảnh lớn: hệ số lọc tính ở nửa độ phân giải (lọc dẫn hướng nhanh) cho đỡ tốn bộ nhớ, khác biệt không thấy được
            int sNho = n > 6000000 ? 2 : 1;

            double gn = p[TS.GiamNhieu] / 100;
            if (gn > 0.005)
            {
                // giảm nhiễu độ sáng: lọc dẫn hướng bán kính nhỏ, ngưỡng theo mức giảm nhiễu
                int rn = Math.Max(1, (int)Math.Round((1.5 + 2 * gn) * Math.Sqrt(a.TiLe)));
                float eps = (float)Math.Pow(0.008 + 0.09 * gn * Math.Sqrt(a.TiLe), 2);
                float[] Pd = BoLoc.DanHuong(P, P, w, h, rn * sNho, eps, sNho);
                float k = (float)Math.Min(0.9, 0.35 + gn);
                BoLoc.SongSong(h, (ya, yb) => { for (int i = ya * w; i < yb * w; i++) P[i] += (Pd[i] - P[i]) * k; });
                Pd = null;
            }
            huy.ThrowIfCancellationRequested();

            // Vùng tối / vùng sáng trên lớp nền (làm mịn giữ cạnh, bán kính lớn), chi tiết giữ lại và co giãn theo
            double vt = p[TS.VungToi] / 100, vs = p[TS.VungSang] / 100, rnet = p[TS.RoNet] / 100;
            if (Math.Abs(vt) > 0.005 || Math.Abs(vs) > 0.005)
            {
                int rb = Math.Max(2, (int)Math.Round(cheo * 0.025));
                float[] nen = BoLoc.DanHuong(P, P, w, h, rb, 0.02f, Math.Max(1, rb / 8));
                float[] lutNen = new float[LUT_N + 2], lutChiTiet = new float[LUT_N + 2];
                for (int i = 0; i <= LUT_N + 1; i++)
                {
                    float b0 = LUT_MIN + (float)i * (LUT_MAX - LUT_MIN) / LUT_N;
                    float b1 = VungToiSang(b0, (float)vt, (float)vs);
                    double kk = (b1 + 0.03) / (Math.Max(0, b0) + 0.03);
                    lutNen[i] = b1;
                    lutChiTiet[i] = (float)Math.Pow(Math.Max(0.5, Math.Min(3, kk)), 0.6);
                }
                BoLoc.SongSong(h, (ya, yb) =>
                {
                    for (int i = ya * w; i < yb * w; i++)
                    {
                        float b0 = nen[i];
                        P[i] = TraLut(lutNen, b0) + (P[i] - b0) * TraLut(lutChiTiet, b0);
                    }
                });
                nen = null;
            }
            huy.ThrowIfCancellationRequested();
            if (Math.Abs(rnet) > 0.005)
            {
                // rõ nét: tăng chi tiết cỡ vừa ở vùng trung tính, lọc giữ cạnh nên không có quầng sáng quanh vật
                int rc = Math.Max(2, (int)Math.Round(cheo * 0.01));
                float[] trung = BoLoc.DanHuong(P, P, w, h, rc, 0.01f, Math.Max(1, rc / 6));
                float fro = (float)rnet * 1.1f;
                BoLoc.SongSong(h, (ya, yb) =>
                {
                    for (int i = ya * w; i < yb * w; i++)
                    {
                        float x = P[i];
                        float m = 4 * x * (1 - x);
                        m = m <= 0 ? 0 : (m >= 1 ? 1 : m * (1.5f - 0.5f * m));   // ≈ căn bậc hai, nhanh hơn
                        P[i] = x + fro * (x - trung[i]) * m;
                    }
                });
                trung = null;
            }
            huy.ThrowIfCancellationRequested();

            // Đường cong toàn ảnh: điểm đen / trắng, cuộn vùng sáng (thay vì cháy), tương phản, làm phai
            float[] lut = DuongCong(P, w, h, p);
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    float yMoi = Mau.GiaiMa(TraLut(lut, P[i]));
                    float y = 0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i];
                    float rr, gg2, bb;
                    if (y > 1e-6f)
                    {
                        float k = yMoi / y;
                        rr = r[i] * k; gg2 = g[i] * k; bb = b[i] * k;
                        float wgt = y / (y + 2e-4f);   // điểm gần đen tuyệt đối: dùng xám để không lộ nhiễu màu
                        rr = rr * wgt + yMoi * (1 - wgt); gg2 = gg2 * wgt + yMoi * (1 - wgt); bb = bb * wgt + yMoi * (1 - wgt);
                    }
                    else { rr = gg2 = bb = yMoi; }
                    // kênh vượt 1: nhạt bớt màu về phía độ sáng (giữ sắc độ, không bị lệch màu khi cháy)
                    float mx = Math.Max(rr, Math.Max(gg2, bb));
                    if (mx > 1f)
                    {
                        if (yMoi >= 1f) { rr = gg2 = bb = 1f; }
                        else
                        {
                            float s = (1f - yMoi) / (mx - yMoi);
                            rr = yMoi + (rr - yMoi) * s; gg2 = yMoi + (gg2 - yMoi) * s; bb = yMoi + (bb - yMoi) * s;
                        }
                    }
                    r[i] = Mau.MaHoa(Math.Max(0, rr));
                    g[i] = Mau.MaHoa(Math.Max(0, gg2));
                    b[i] = Mau.MaHoa(Math.Max(0, bb));
                }
            });
            P = null;
            huy.ThrowIfCancellationRequested();
            // từ đây r, g, b là giá trị hiển thị sRGB 0..1

            // 4. Giảm nhiễu màu: làm mịn hai kênh màu, dẫn hướng theo độ sáng để màu không lem qua cạnh
            if (gn > 0.005) GiamNhieuMau(r, g, b, w, h, gn, a.TiLe, sNho);
            huy.ThrowIfCancellationRequested();

            // 5. Màu sắc
            MauSac(r, g, b, w, h, p);
            huy.ThrowIfCancellationRequested();

            // 6. Làm mịn da + 7. Làm nét (cùng dùng mặt nạ da)
            double md = p[TS.LamMinDa] / 100, ln = p[TS.LamNet] / 100;
            float[] da = null;
            if (md > 0.005)
            {
                da = MatNaDa(r, g, b, w, h, cheo, a.KhuonMat);
                LamMinDa(r, g, b, w, h, da, md, cheo);
            }
            huy.ThrowIfCancellationRequested();
            if (ln > 0.005) LamNet(r, g, b, w, h, ln, a.TiLe, da, md);
            huy.ThrowIfCancellationRequested();

            // 8. Viền tối + ra byte
            double vien = p[TS.VienToi] / 100;
            byte[] kq = new byte[(long)n * 3];
            float cx = (w - 1) / 2f, cy = (h - 1) / 2f;
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    float dy = (y - cy) / Math.Max(1f, cy);
                    for (int x = 0; x < w; x++)
                    {
                        int i = y * w + x;
                        float rr = r[i], gg2 = g[i], bb = b[i];
                        if (vien != 0)
                        {
                            float dx = (x - cx) / Math.Max(1f, cx);
                            float d = (float)Math.Sqrt((dx * dx + dy * dy) / 2);
                            float wv = Mau.BuocMin(0.35f, 1.05f, d);
                            float yy = 0.2126f * rr + 0.7152f * gg2 + 0.0722f * bb;
                            float k = 1 + (float)vien * (vien < 0 ? 0.6f : 0.35f) * wv * (1 - 0.4f * yy);
                            rr *= k; gg2 *= k; bb *= k;
                        }
                        int j = i * 3;
                        kq[j] = Mau.SangByte(bb);
                        kq[j + 1] = Mau.SangByte(gg2);
                        kq[j + 2] = Mau.SangByte(rr);
                    }
                }
            });
            return kq;
        }

        /// <summary>Thanh Vùng tối / Vùng sáng áp lên lớp nền (độ sáng đã làm mịn giữ cạnh).</summary>
        static float VungToiSang(float B, float vt, float vs)
        {
            if (B < 0) B = 0;
            if (vt != 0 && B < 0.7f)
            {
                float t = 1 - B / 0.7f;
                B *= (float)Math.Pow(2, vt * (vt > 0 ? 1.5f : 1.1f) * t * t);
            }
            if (vs != 0 && B > 0.3f)
            {
                float t = Math.Min(1f, (B - 0.3f) / 0.7f);
                B *= (float)Math.Pow(2, vs * (vs < 0 ? 0.65f : 0.4f) * t * t * (3 - 2 * t));
            }
            return B;
        }

        public const double HeSoDiemDen = 0.15, HeSoDiemTrang = 0.25;
        const float LUT_MIN = -0.5f, LUT_MAX = 3f;
        const int LUT_N = 4096;

        static float TraLut(float[] lut, float x)
        {
            float f = (x - LUT_MIN) * (LUT_N / (LUT_MAX - LUT_MIN));
            if (f <= 0) return lut[0];
            if (f >= LUT_N) return lut[LUT_N];
            int i = (int)f;
            return lut[i] + (lut[i + 1] - lut[i]) * (f - i);
        }

        /// <summary>Lập bảng tra đường cong tông toàn ảnh cho P (độ sáng cảm nhận).</summary>
        static float[] DuongCong(float[] P, int w, int h, ThongSo p)
        {
            // Điểm đen / điểm trắng
            double bp = -p[TS.DiemDen] / 100 * HeSoDiemDen;
            double wp = 1 - p[TS.DiemTrang] / 100 * HeSoDiemTrang;

            // Phân vị của ảnh để biết còn bao nhiêu chi tiết vượt trắng / dưới đen cần cuộn lại
            int[] hist = BieuDo(P, LUT_MIN, LUT_MAX, 2048);
            double lo = (PhanVi(hist, 0.0005, LUT_MIN, LUT_MAX) - bp) / (wp - bp);
            double hi = (PhanVi(hist, 0.9995, LUT_MIN, LUT_MAX) - bp) / (wp - bp);

            double c = p[TS.TuongPhan] / 100;
            double m = 0.46;    // xám trung tính 18% sau mã hoá sRGB
            double fade = p[TS.LamPhai] / 100 * 0.14;

            const double s0 = 0.80, t0 = 0.08;
            double kVai = hi > 1.001 ? GiaiK((hi - s0) / (1 - s0)) : 0;
            double kChan = lo < -0.001 ? GiaiK((t0 - lo) / t0) : 0;

            float[] lut = new float[LUT_N + 2];
            for (int i = 0; i <= LUT_N + 1; i++)
            {
                double x = LUT_MIN + (double)i * (LUT_MAX - LUT_MIN) / LUT_N;
                double y = (x - bp) / (wp - bp);
                // vai đường cong: nén [s0, hi] vào [s0, 1] — vùng sáng cuộn mềm thay vì cháy trắng
                if (y > s0)
                {
                    if (kVai > 0) y = y >= hi ? 1 : s0 + (1 - s0) * VaiMu((y - s0) / (hi - s0), kVai);
                    else if (y > 1) y = 1;
                }
                // chân đường cong: nén [lo, t0] vào [0, t0]
                if (y < t0)
                {
                    if (kChan > 0) y = y <= lo ? 0 : t0 - t0 * VaiMu((t0 - y) / (t0 - lo), kChan);
                    else if (y < 0) y = 0;
                }
                // tương phản: đường chữ S quanh xám trung tính
                if (c != 0) y = y + 2 * c * (y - m) * y * (1 - y);
                y = fade + y * (1 - fade);
                lut[i] = (float)Math.Max(0, Math.Min(1, y));
            }
            return lut;
        }

        /// <summary>f(u) = (1 − e^(−k·u)) / (1 − e^(−k)): f(0)=0, f(1)=1, độ dốc đầu = k / (1 − e^(−k)).</summary>
        static double VaiMu(double u, double k)
        {
            return (1 - Math.Exp(-k * u)) / (1 - Math.Exp(-k));
        }

        /// <summary>Tìm k sao cho k / (1 − e^(−k)) = m (độ dốc ở điểm nối bằng 1 → đường cong trơn).</summary>
        static double GiaiK(double m)
        {
            if (m <= 1.0001) return 1e-4;
            double lo = 1e-4, hi = 60;
            for (int i = 0; i < 60; i++)
            {
                double k = (lo + hi) / 2;
                double v = k / (1 - Math.Exp(-k));
                if (v < m) lo = k; else hi = k;
            }
            return (lo + hi) / 2;
        }

        public static int[] BieuDo(float[] v, float min, float max, int soO)
        {
            int[] tong = new int[soO];
            object khoa = new object();
            float k = soO / (max - min);
            BoLoc.SongSong(v.Length, (a, b) =>
            {
                int[] rieng = new int[soO];
                for (int i = a; i < b; i++)
                {
                    int o = (int)((v[i] - min) * k);
                    o = o < 0 ? 0 : (o >= soO ? soO - 1 : o);
                    rieng[o]++;
                }
                lock (khoa) for (int i = 0; i < soO; i++) tong[i] += rieng[i];
            });
            return tong;
        }

        public static double PhanVi(int[] hist, double q, double min, double max)
        {
            long n = 0;
            foreach (int c in hist) n += c;
            if (n == 0) return 0;
            double can = q * n;
            long dem = 0;
            for (int i = 0; i < hist.Length; i++)
            {
                if (dem + hist[i] >= can)
                {
                    double t = hist[i] > 0 ? (can - dem) / hist[i] : 0;
                    return min + (i + t) * (max - min) / hist.Length;
                }
                dem += hist[i];
            }
            return max;
        }

        /// <summary>Khử sương mù theo "kênh tối" (He 2009); độ truyền qua tính trên ảnh nhỏ rồi lọc dẫn hướng lên cỡ thật.</summary>
        static void KhuSuongMu(float[] r, float[] g, float[] b, int w, int h, double muc)
        {
            int n = w * h;
            int s = Math.Max(1, Math.Max(w, h) / 320);
            float[] mn = new float[n], xam = new float[n];
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    mn[i] = Mau.MaHoa(Math.Min(r[i], Math.Min(g[i], b[i])));
                    xam[i] = Mau.MaHoa(0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i]);
                }
            });
            int wl, hl;
            float[] mnL = BoLoc.ThuNho(mn, w, h, s, out wl, out hl);
            float[] xamL = BoLoc.ThuNho(xam, w, h, s, out wl, out hl);
            mn = null;
            float[] toi = BoLoc.LocMin(mnL, wl, hl, 7);

            // ánh sáng khí quyển A: trung bình màu của 0,2% điểm có kênh tối cao nhất
            float[] rL = BoLoc.ThuNho(r, w, h, s, out wl, out hl), gL = BoLoc.ThuNho(g, w, h, s, out wl, out hl), bL = BoLoc.ThuNho(b, w, h, s, out wl, out hl);
            int[] hist = BieuDo(toi, 0, 1.0001f, 1024);
            double nguong = PhanVi(hist, 0.998, 0, 1.0001);
            double ar = 0, ag = 0, ab = 0; int dem = 0;
            for (int i = 0; i < toi.Length; i++)
                if (toi[i] >= nguong) { ar += Mau.MaHoa(rL[i]); ag += Mau.MaHoa(gL[i]); ab += Mau.MaHoa(bL[i]); dem++; }
            if (dem == 0) return;
            float Ar = (float)Math.Max(0.3, ar / dem), Ag = (float)Math.Max(0.3, ag / dem), Ab = (float)Math.Max(0.3, ab / dem);
            float Am = Math.Max(Ar, Math.Max(Ag, Ab));

            float omega = (float)Math.Min(0.92, Math.Abs(muc) * 0.95);
            float[] tL = new float[toi.Length];
            for (int i = 0; i < tL.Length; i++) tL[i] = muc > 0 ? 1 - omega * toi[i] / Am : 1;
            float[] t = muc > 0 ? BoLoc.DanHuongThap(xam, w, h, xamL, tL, wl, hl, s, 6, 0.002f) : null;

            // giữ độ sáng trung bình: bù một nửa phần ảnh bị tối đi sau khi khử
            double truoc = 0, sau = 0;
            for (int i = 0; i < xamL.Length; i++)
            {
                truoc += xamL[i];
                float tt = muc > 0 ? Math.Max(0.12f, tL[i]) : 1;
                sau += muc > 0 ? (xamL[i] - Am) / tt + Am : xamL[i] * (1 + (float)muc * 0.45f) - (float)muc * 0.45f * Am;
            }
            float bu = (float)Math.Pow(Math.Max(0.2, truoc / Math.Max(1e-3, sau)), 0.5);
            float kThem = (float)(-muc * 0.45);
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    float R = Mau.MaHoa(r[i]), G = Mau.MaHoa(g[i]), B = Mau.MaHoa(b[i]);
                    if (t != null)
                    {
                        float tt = Math.Max(0.12f, t[i]);
                        R = (R - Ar) / tt + Ar; G = (G - Ag) / tt + Ag; B = (B - Ab) / tt + Ab;
                    }
                    else
                    {
                        R += (Ar - R) * kThem; G += (Ag - G) * kThem; B += (Ab - B) * kThem;
                    }
                    r[i] = Mau.GiaiMa(Math.Max(0, R)) * bu;
                    g[i] = Mau.GiaiMa(Math.Max(0, G)) * bu;
                    b[i] = Mau.GiaiMa(Math.Max(0, B)) * bu;
                }
            });
        }

        static void GiamNhieuMau(float[] r, float[] g, float[] b, int w, int h, double muc, double tiLe, int sNho)
        {
            int n = w * h;
            float[] yy = new float[n], c = new float[n];
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    float y = 0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i];
                    yy[i] = y; c[i] = b[i] - y;
                }
            });
            int rc = Math.Max(1, (int)Math.Round((2 + 6 * muc) * tiLe));
            int s = Math.Max(rc >= 4 ? 2 : 1, sNho);
            float k = (float)Math.Min(1, 0.5 + muc);
            // kênh xanh dương − độ sáng, rồi kênh đỏ − độ sáng; độ sáng giữ nguyên nên kênh lục tính lại sau cùng
            for (int kenh = 0; kenh < 2; kenh++)
            {
                float[] dich = kenh == 0 ? b : r;
                if (kenh == 1)
                    BoLoc.SongSong(h, (ya, yb) => { for (int i = ya * w; i < yb * w; i++) c[i] = r[i] - yy[i]; });
                float[] c2 = BoLoc.DanHuong(yy, c, w, h, rc, 0.0015f, s);
                BoLoc.SongSong(h, (ya, yb) => { for (int i = ya * w; i < yb * w; i++) dich[i] = yy[i] + c[i] + (c2[i] - c[i]) * k; });
            }
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++) g[i] = (yy[i] - 0.2126f * r[i] - 0.0722f * b[i]) / 0.7152f;
            });
        }

        /// <summary>Sống động, bão hòa, đen trắng, tô màu vùng tối / sáng — trên giá trị hiển thị.</summary>
        static void MauSac(float[] r, float[] g, float[] b, int w, int h, ThongSo p)
        {
            float vib = (float)(p[TS.SongDong] / 100), sat = (float)(p[TS.BaoHoa] / 100);
            bool dt = p.DenTrang;
            float toiDo = (float)(p[TS.MauToiDo] / 100 * 0.22), sangDo = (float)(p[TS.MauSangDo] / 100 * 0.22);
            float tr, tg, tb, sr, sg, sb;
            Mau.VectoSac(p[TS.MauToiSac], out tr, out tg, out tb);
            Mau.VectoSac(p[TS.MauSangSac], out sr, out sg, out sb);
            if (vib == 0 && sat == 0 && !dt && toiDo == 0 && sangDo == 0) return;
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    float R = r[i], G = g[i], B = b[i];
                    float y = 0.2126f * R + 0.7152f * G + 0.0722f * B;
                    if (dt)
                    {
                        float x = 0.36f * R + 0.50f * G + 0.14f * B;   // pha kênh đen trắng: da sáng, trời đậm vừa
                        R = G = B = x; y = x;
                    }
                    else if (vib != 0 || sat != 0)
                    {
                        float mx = Math.Max(R, Math.Max(G, B)), mn = Math.Min(R, Math.Min(G, B));
                        float bh = mx - mn;
                        float k = 1 + sat;
                        if (vib > 0)
                        {
                            float da = Mau.DoDa(R, G, B);
                            float u = 1 - Math.Min(1, bh * 1.4f);
                            k *= 1 + vib * u * u * (1 - 0.65f * da);
                        }
                        else k *= 1 + vib * 0.8f;
                        R = y + (R - y) * k; G = y + (G - y) * k; B = y + (B - y) * k;
                    }
                    if (toiDo > 0 || sangDo > 0)
                    {
                        float wt = toiDo * (1 - Mau.BuocMin(0.0f, 0.6f, y));
                        float ws = sangDo * Mau.BuocMin(0.4f, 1.0f, y);
                        R += tr * wt + sr * ws; G += tg * wt + sg * ws; B += tb * wt + sb * ws;
                    }
                    // kéo về trong khoảng hiển thị, giữ độ sáng
                    float mx2 = Math.Max(R, Math.Max(G, B)), mn2 = Math.Min(R, Math.Min(G, B));
                    if (mx2 > 1 || mn2 < 0)
                    {
                        y = Mau.Kep01(y);
                        float s = 1;
                        if (mx2 > 1 && mx2 > y) s = Math.Min(s, (1 - y) / (mx2 - y));
                        if (mn2 < 0 && mn2 < y) s = Math.Min(s, y / (y - mn2));
                        R = y + (R - y) * s; G = y + (G - y) * s; B = y + (B - y) * s;
                    }
                    r[i] = R; g[i] = G; b[i] = B;
                }
            });
        }

        /// <summary>Mặt nạ da 0..1. Có khuôn mặt thì chỉ lấy vùng quanh mặt (cổ, má) — không làm mịn gỗ, cát… cùng màu da.</summary>
        static float[] MatNaDa(float[] r, float[] g, float[] b, int w, int h, double cheo, System.Drawing.RectangleF[] mat)
        {
            int n = w * h;
            float[] m = new float[n];
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                    for (int x = 0; x < w; x++)
                    {
                        int i = y * w + x;
                        float d = Mau.DoDa(r[i], g[i], b[i]);
                        if (d > 0 && mat != null && mat.Length > 0)
                        {
                            float gan = 0;
                            foreach (var f in mat)
                            {
                                float cx = (f.X + f.Width / 2) * w, cy = (f.Y + f.Height * 0.65f) * h;
                                float hx = f.Width * w * 0.95f, hy = f.Height * h * 1.25f;
                                float dx = (x - cx) / hx, dy = (y - cy) / hy;
                                gan = Math.Max(gan, 1 - Mau.BuocMin(0.75f, 1.15f, (float)Math.Sqrt(dx * dx + dy * dy)));
                            }
                            d *= gan;
                        }
                        m[i] = d;
                    }
            });
            int rm = Math.Max(1, (int)Math.Round(cheo * 0.003));
            return BoLoc.TrungBinh(m, w, h, rm);
        }

        /// <summary>Làm mịn da: lọc giữ cạnh trên độ sáng, chỉ trong vùng da — mắt, môi, tóc vẫn nét.</summary>
        static void LamMinDa(float[] r, float[] g, float[] b, int w, int h, float[] da, double muc, double cheo)
        {
            int n = w * h;
            float[] y = new float[n];
            for (int i = 0; i < n; i++) y[i] = 0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i];
            int rs = Math.Max(2, (int)Math.Round(cheo * 0.006));
            float[] ym = BoLoc.DanHuong(y, y, w, h, rs, (float)(0.0016 + 0.003 * muc), Math.Max(1, rs / 4));
            float k = (float)(Math.Min(1, muc) * 0.85);
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    float d = (ym[i] - y[i]) * da[i] * k;
                    r[i] += d; g[i] += d; b[i] += d;
                }
            });
        }

        /// <summary>Làm nét kiểu unsharp mask trên độ sáng, có ngưỡng để không làm nổi nhiễu, giảm trên vùng da đã làm mịn.</summary>
        static void LamNet(float[] r, float[] g, float[] b, int w, int h, double muc, double tiLe, float[] da, double minDa)
        {
            int n = w * h;
            float[] y = new float[n];
            for (int i = 0; i < n; i++) y[i] = 0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i];
            // ảnh xem trước thu nhỏ: bán kính và lượng nhỏ hơn để giống kết quả khi xem ảnh thật ở cùng cỡ
            double sigma = Math.Max(0.55, 1.1 * Math.Sqrt(Math.Min(1, tiLe)));
            float luong = (float)(muc * 1.3 * (0.45 + 0.55 * Math.Min(1, tiLe)));
            float[] mo = BoLoc.Gauss(y, w, h, sigma);
            const float nguong = 0.012f;
            float kd = (float)(0.75 * Math.Min(1, minDa * 2));
            BoLoc.SongSong(h, (ya, yb) =>
            {
                for (int i = ya * w; i < yb * w; i++)
                {
                    float d = y[i] - mo[i];
                    float d2 = d * d;
                    d *= d2 / (d2 + nguong * nguong);
                    float k = luong;
                    if (da != null) k *= 1 - kd * da[i];
                    float t = d * k;
                    t = t < -0.12f ? -0.12f : (t > 0.12f ? 0.12f : t);
                    r[i] += t; g[i] += t; b[i] += t;
                }
            });
        }
    }
}
