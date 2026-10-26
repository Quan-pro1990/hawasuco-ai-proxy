using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace ChinhAnhAI
{
    /// <summary>Chuyển đổi sRGB ↔ ánh sáng tuyến tính bằng bảng tra (nhanh hơn Math.Pow nhiều lần).</summary>
    public static class Mau
    {
        public static readonly float[] Lin8 = new float[256];
        const int N = 8192;
        const float MAXV = 2f;
        static readonly float[] lutMaHoa = new float[N + 2];
        static readonly float[] lutGiaiMa = new float[N + 2];

        static Mau()
        {
            for (int i = 0; i < 256; i++) Lin8[i] = (float)GiaiMaChinhXac(i / 255.0);
            for (int i = 0; i <= N + 1; i++)
            {
                double v = (double)i * MAXV / N;
                lutMaHoa[i] = (float)MaHoaChinhXac(v);
                lutGiaiMa[i] = (float)GiaiMaChinhXac(v);
            }
        }

        public static double MaHoaChinhXac(double l)
        {
            if (l <= 0.0031308) return 12.92 * l;
            return 1.055 * Math.Pow(l, 1 / 2.4) - 0.055;
        }

        public static double GiaiMaChinhXac(double v)
        {
            if (v <= 0.04045) return v / 12.92;
            return Math.Pow((v + 0.055) / 1.055, 2.4);
        }

        /// <summary>Tuyến tính → sRGB (giá trị hiển thị 0..1, cho phép vượt 1).</summary>
        public static float MaHoa(float l)
        {
            if (l <= 0.0031308f) return 12.92f * l;
            if (l >= MAXV) return (float)MaHoaChinhXac(l);
            float f = l * (N / MAXV);
            int i = (int)f;
            return lutMaHoa[i] + (lutMaHoa[i + 1] - lutMaHoa[i]) * (f - i);
        }

        /// <summary>sRGB → tuyến tính.</summary>
        public static float GiaiMa(float v)
        {
            if (v <= 0.04045f) return v / 12.92f;
            if (v >= MAXV) return (float)GiaiMaChinhXac(v);
            float f = v * (N / MAXV);
            int i = (int)f;
            return lutGiaiMa[i] + (lutGiaiMa[i + 1] - lutGiaiMa[i]) * (f - i);
        }

        public static byte SangByte(float v)
        {
            int i = (int)(v * 255f + 0.5f);
            return (byte)(i < 0 ? 0 : (i > 255 ? 255 : i));
        }

        public static float Kep01(float v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

        public static float BuocMin(float a, float b, float x)
        {
            float t = (x - a) / (b - a);
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            return t * t * (3 - 2 * t);
        }

        /// <summary>Mức "giống màu da" 0..1 của một điểm sRGB (vùng Cb/Cr kinh điển, biên mềm).</summary>
        public static float DoDa(float r, float g, float b)
        {
            float y = 0.299f * r + 0.587f * g + 0.114f * b;
            if (y < 0.12f || r <= b) return 0;
            float cb = 0.5f - 0.168736f * r - 0.331264f * g + 0.5f * b;
            float cr = 0.5f + 0.5f * r - 0.418688f * g - 0.081312f * b;
            float m = BuocMin(0.27f, 0.33f, cb) * (1 - BuocMin(0.47f, 0.53f, cb));
            m *= BuocMin(0.50f, 0.55f, cr) * (1 - BuocMin(0.66f, 0.71f, cr));
            m *= BuocMin(0.12f, 0.25f, y) * (1 - BuocMin(0.92f, 0.99f, y));
            return m;
        }

        /// <summary>Màu thuần ứng với góc sắc độ (độ), đã trừ độ sáng để chỉ đổi màu không đổi sáng.</summary>
        public static void VectoSac(double sac, out float r, out float g, out float b)
        {
            double h = ((sac % 360) + 360) % 360 / 60.0;
            int i = (int)Math.Floor(h);
            double f = h - i;
            double q = 1 - f, t = f;
            double rr, gg, bb;
            switch (i)
            {
                case 0: rr = 1; gg = t; bb = 0; break;
                case 1: rr = q; gg = 1; bb = 0; break;
                case 2: rr = 0; gg = 1; bb = t; break;
                case 3: rr = 0; gg = q; bb = 1; break;
                case 4: rr = t; gg = 0; bb = 1; break;
                default: rr = 1; gg = 0; bb = q; break;
            }
            double y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
            r = (float)(rr - y); g = (float)(gg - y); b = (float)(bb - y);
        }
    }

    /// <summary>Các bộ lọc trên ảnh một kênh float (hàng liền nhau, rộng w, cao h).</summary>
    public static class BoLoc
    {
        /// <summary>Chạy song song theo khối hàng [a, b).</summary>
        public static void SongSong(int n, Action<int, int> lam)
        {
            if (n <= 0) return;
            int khoi = Math.Max(1, n / (Environment.ProcessorCount * 4));
            Parallel.ForEach(Partitioner.Create(0, n, khoi), k => lam(k.Item1, k.Item2));
        }

        /// <summary>Trung bình trong ô vuông bán kính r (ở biên chỉ tính các điểm nằm trong ảnh).</summary>
        public static float[] TrungBinh(float[] src, int w, int h, int r)
        {
            float[] tam = new float[src.Length];
            float[] dst = new float[src.Length];
            TrungBinh(src, tam, dst, w, h, r);
            return dst;
        }

        public static void TrungBinh(float[] src, float[] tam, float[] dst, int w, int h, int r)
        {
            if (r < 1) { Array.Copy(src, dst, src.Length); return; }
            // ngang
            SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    int o = y * w;
                    double s = 0;
                    int lo = 0, hi = -1;
                    for (int x = 0; x < w; x++)
                    {
                        int a = Math.Max(0, x - r), b = Math.Min(w - 1, x + r);
                        while (hi < b) { hi++; s += src[o + hi]; }
                        while (lo < a) { s -= src[o + lo]; lo++; }
                        tam[o + x] = (float)(s / (hi - lo + 1));
                    }
                }
            });
            // dọc: mỗi luồng giữ tổng chạy cho một dải cột
            int dai = Math.Max(16, w / (Environment.ProcessorCount * 2));
            int soDai = (w + dai - 1) / dai;
            SongSong(soDai, (da, db) =>
            {
                for (int d = da; d < db; d++)
                {
                    int x0 = d * dai, x1 = Math.Min(w, x0 + dai), n = x1 - x0;
                    double[] s = new double[n];
                    int lo = 0, hi = -1;
                    for (int y = 0; y < h; y++)
                    {
                        int a = Math.Max(0, y - r), b = Math.Min(h - 1, y + r);
                        while (hi < b) { hi++; int o = hi * w + x0; for (int i = 0; i < n; i++) s[i] += tam[o + i]; }
                        while (lo < a) { int o = lo * w + x0; for (int i = 0; i < n; i++) s[i] -= tam[o + i]; lo++; }
                        double k = 1.0 / (hi - lo + 1);
                        int od = y * w + x0;
                        for (int i = 0; i < n; i++) dst[od + i] = (float)(s[i] * k);
                    }
                }
            });
        }

        /// <summary>Thu nhỏ s lần bằng trung bình khối s×s.</summary>
        public static float[] ThuNho(float[] src, int w, int h, int s, out int w2, out int h2)
        {
            int ww = (w + s - 1) / s, hh = (h + s - 1) / s;
            w2 = ww; h2 = hh;
            float[] dst = new float[ww * hh];
            SongSong(hh, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    int sy0 = y * s, sy1 = Math.Min(h, sy0 + s);
                    for (int x = 0; x < ww; x++)
                    {
                        int sx0 = x * s, sx1 = Math.Min(w, sx0 + s);
                        float t = 0;
                        for (int sy = sy0; sy < sy1; sy++)
                        {
                            int o = sy * w;
                            for (int sx = sx0; sx < sx1; sx++) t += src[o + sx];
                        }
                        dst[y * ww + x] = t / ((sy1 - sy0) * (sx1 - sx0));
                    }
                }
            });
            return dst;
        }

        /// <summary>
        /// Lọc dẫn hướng (guided filter, He 2010) — làm mịn mà giữ cạnh, không gây quầng sáng như làm mờ Gauss.
        /// Bản nhanh: tính hệ số trên ảnh thu nhỏ s lần rồi nội suy lên (He 2015).
        /// </summary>
        public static float[] DanHuong(float[] I, float[] p, int w, int h, int r, float eps, int s)
        {
            if (s < 1) s = 1;
            int wl, hl;
            float[] Il = s == 1 ? I : ThuNho(I, w, h, s, out wl, out hl);
            float[] pl = p == I ? Il : (s == 1 ? p : ThuNho(p, w, h, s, out wl, out hl));
            if (s == 1) { wl = w; hl = h; }
            else { wl = (w + s - 1) / s; hl = (h + s - 1) / s; }
            return DanHuongThap(I, w, h, Il, pl, wl, hl, s, Math.Max(1, (int)Math.Round((double)r / s)), eps);
        }

        /// <summary>Lọc dẫn hướng khi đã có sẵn ảnh dẫn và ảnh vào ở độ phân giải thấp (wl×hl, thu nhỏ s lần).</summary>
        public static float[] DanHuongThap(float[] I, int w, int h, float[] Il, float[] pl, int wl, int hl, int s, int r, float eps)
        {
            int n = wl * hl;
            bool cung = Il == pl;
            float[] tam = new float[n];
            float[] mI = new float[n], mP = cung ? mI : new float[n];
            TrungBinh(Il, tam, mI, wl, hl, r);
            if (!cung) TrungBinh(pl, tam, mP, wl, hl, r);
            float[] tich = new float[n];
            for (int i = 0; i < n; i++) tich[i] = Il[i] * pl[i];
            float[] mIP = new float[n];
            TrungBinh(tich, tam, mIP, wl, hl, r);
            float[] mII = mIP;
            if (!cung)
            {
                for (int i = 0; i < n; i++) tich[i] = Il[i] * Il[i];
                mII = new float[n];
                TrungBinh(tich, tam, mII, wl, hl, r);
            }
            float[] a = tich, b = new float[n];
            for (int i = 0; i < n; i++)
            {
                float varI = mII[i] - mI[i] * mI[i];
                float cov = mIP[i] - mI[i] * mP[i];
                a[i] = cov / (varI + eps);
                b[i] = mP[i] - a[i] * mI[i];
            }
            float[] mA = mI, mB = mIP;     // mI, mIP không còn cần: dùng lại chỗ nhớ
            TrungBinh(a, tam, mA, wl, hl, r);
            TrungBinh(b, tam, mB, wl, hl, r);

            if (s == 1)
            {
                float[] q1 = a;            // a đã lấy trung bình xong: ghi kết quả vào đó
                BoLoc.SongSong(h, (ya, yb) => { for (int i = ya * w; i < yb * w; i++) q1[i] = mA[i] * I[i] + mB[i]; });
                return q1;
            }
            float[] q = new float[w * h];
            // nội suy song tuyến hệ số lên kích thước gốc
            int[] xi = new int[w]; float[] xt = new float[w];
            for (int x = 0; x < w; x++)
            {
                float fx = (x + 0.5f) / s - 0.5f;
                if (fx < 0) fx = 0;
                int i0 = Math.Min(wl - 1, (int)fx);
                xi[x] = i0; xt[x] = i0 < wl - 1 ? fx - i0 : 0;
            }
            SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    float fy = (y + 0.5f) / s - 0.5f;
                    if (fy < 0) fy = 0;
                    int j0 = Math.Min(hl - 1, (int)fy);
                    int j1 = Math.Min(hl - 1, j0 + 1);
                    float ty = fy - j0;
                    if (j0 == hl - 1) ty = 0;
                    int r0 = j0 * wl, r1 = j1 * wl, o = y * w;
                    for (int x = 0; x < w; x++)
                    {
                        int i0 = xi[x], i1 = Math.Min(wl - 1, i0 + 1);
                        float tx = xt[x];
                        float a0 = mA[r0 + i0] + (mA[r0 + i1] - mA[r0 + i0]) * tx;
                        float a1 = mA[r1 + i0] + (mA[r1 + i1] - mA[r1 + i0]) * tx;
                        float b0 = mB[r0 + i0] + (mB[r0 + i1] - mB[r0 + i0]) * tx;
                        float b1 = mB[r1 + i0] + (mB[r1 + i1] - mB[r1 + i0]) * tx;
                        q[o + x] = (a0 + (a1 - a0) * ty) * I[o + x] + (b0 + (b1 - b0) * ty);
                    }
                }
            });
            return q;
        }

        /// <summary>Nội suy song tuyến ảnh thấp (wl×hl, thu nhỏ s lần) lên w×h.</summary>
        public static float[] PhongTo(float[] lo, int wl, int hl, int s, int w, int h)
        {
            float[] q = new float[w * h];
            SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    float fy = Math.Max(0, (y + 0.5f) / s - 0.5f);
                    int j0 = Math.Min(hl - 1, (int)fy), j1 = Math.Min(hl - 1, j0 + 1);
                    float ty = j0 == hl - 1 ? 0 : fy - j0;
                    for (int x = 0; x < w; x++)
                    {
                        float fx = Math.Max(0, (x + 0.5f) / s - 0.5f);
                        int i0 = Math.Min(wl - 1, (int)fx), i1 = Math.Min(wl - 1, i0 + 1);
                        float tx = i0 == wl - 1 ? 0 : fx - i0;
                        float v0 = lo[j0 * wl + i0] + (lo[j0 * wl + i1] - lo[j0 * wl + i0]) * tx;
                        float v1 = lo[j1 * wl + i0] + (lo[j1 * wl + i1] - lo[j1 * wl + i0]) * tx;
                        q[y * w + x] = v0 + (v1 - v0) * ty;
                    }
                }
            });
            return q;
        }

        /// <summary>Làm mờ Gauss tách hai chiều.</summary>
        public static float[] Gauss(float[] src, int w, int h, double sigma)
        {
            int r = Math.Max(1, (int)Math.Ceiling(sigma * 3));
            float[] k = new float[2 * r + 1];
            double t = 0;
            for (int i = -r; i <= r; i++) { k[i + r] = (float)Math.Exp(-i * i / (2 * sigma * sigma)); t += k[i + r]; }
            for (int i = 0; i < k.Length; i++) k[i] = (float)(k[i] / t);
            float[] tam = new float[src.Length], dst = new float[src.Length];
            SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    int o = y * w;
                    for (int x = 0; x < w; x++)
                    {
                        float s = 0;
                        for (int i = -r; i <= r; i++)
                        {
                            int xx = x + i;
                            xx = xx < 0 ? 0 : (xx >= w ? w - 1 : xx);
                            s += src[o + xx] * k[i + r];
                        }
                        tam[o + x] = s;
                    }
                }
            });
            SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    int o = y * w;
                    for (int x = 0; x < w; x++) dst[o + x] = 0;
                    for (int i = -r; i <= r; i++)
                    {
                        int yy = y + i;
                        yy = yy < 0 ? 0 : (yy >= h ? h - 1 : yy);
                        int oo = yy * w;
                        float kk = k[i + r];
                        for (int x = 0; x < w; x++) dst[o + x] += tam[oo + x] * kk;
                    }
                }
            });
            return dst;
        }

        /// <summary>Lọc lấy giá trị nhỏ nhất trong ô vuông bán kính r (dùng cho "kênh tối" khi khử sương mù).</summary>
        public static float[] LocMin(float[] src, int w, int h, int r)
        {
            float[] tam = new float[src.Length], dst = new float[src.Length];
            SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                    for (int x = 0; x < w; x++)
                    {
                        float m = float.MaxValue;
                        for (int xx = Math.Max(0, x - r); xx <= Math.Min(w - 1, x + r); xx++) m = Math.Min(m, src[y * w + xx]);
                        tam[y * w + x] = m;
                    }
            });
            SongSong(h, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                    for (int x = 0; x < w; x++)
                    {
                        float m = float.MaxValue;
                        for (int yy = Math.Max(0, y - r); yy <= Math.Min(h - 1, y + r); yy++) m = Math.Min(m, tam[yy * w + x]);
                        dst[y * w + x] = m;
                    }
            });
            return dst;
        }
    }
}
