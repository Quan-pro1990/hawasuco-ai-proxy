using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Xml.Linq;

namespace ChinhAnhAI
{
    /// <summary>
    /// Tìm khuôn mặt nhìn thẳng bằng bộ phân loại Haar (Viola-Jones) của OpenCV — tệp haarcascade_frontalface_default.xml
    /// nhúng trong phần mềm. Dùng để biết ảnh chân dung, đo sáng theo mặt và chỉ làm mịn da quanh mặt.
    /// </summary>
    public static class NhanDienMat
    {
        class DacTrung { public int[] X, Y, W, H; public float[] TrongSo; }
        class Yeu { public int Dt; public float Nguong, La0, La1; }
        class Tang { public float Nguong; public Yeu[] Ds; }

        static Tang[] tang;
        static DacTrung[] dacTrung;
        static int coW = 24, coH = 24;
        static readonly object khoa = new object();
        static string loiNap;

        static bool Nap()
        {
            lock (khoa)
            {
                if (tang != null) return true;
                if (loiNap != null) return false;
                try
                {
                    Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("ChinhAnhAI.haarcascade_frontalface_default.xml");
                    if (s == null) { loiNap = "thiếu tệp nhận diện mặt"; return false; }
                    XElement c;
                    using (s) c = XDocument.Load(s).Root.Element("cascade");
                    coW = int.Parse(c.Element("width").Value.Trim());
                    coH = int.Parse(c.Element("height").Value.Trim());
                    dacTrung = c.Element("features").Elements("_").Select(f =>
                    {
                        var rs = f.Element("rects").Elements("_").Select(r => r.Value.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries)).ToList();
                        return new DacTrung
                        {
                            X = rs.Select(v => int.Parse(v[0])).ToArray(),
                            Y = rs.Select(v => int.Parse(v[1])).ToArray(),
                            W = rs.Select(v => int.Parse(v[2])).ToArray(),
                            H = rs.Select(v => int.Parse(v[3])).ToArray(),
                            TrongSo = rs.Select(v => So(v[4])).ToArray(),
                        };
                    }).ToArray();
                    tang = c.Element("stages").Elements("_").Select(st => new Tang
                    {
                        Nguong = So(st.Element("stageThreshold").Value),
                        Ds = st.Element("weakClassifiers").Elements("_").Select(wc =>
                        {
                            string[] nut = wc.Element("internalNodes").Value.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                            string[] la = wc.Element("leafValues").Value.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                            return new Yeu { Dt = int.Parse(nut[2]), Nguong = So(nut[3]), La0 = So(la[0]), La1 = So(la[1]) };
                        }).ToArray()
                    }).ToArray();
                    return true;
                }
                catch (Exception ex)
                {
                    loiNap = ex.Message;
                    return false;
                }
            }
        }

        static float So(string s)
        {
            return float.Parse(s.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture);
        }

        /// <summary>Các khuôn mặt tìm được, toạ độ chuẩn hoá 0..1 theo chiều rộng / cao ảnh.</summary>
        public static List<RectangleF> Tim(AnhNguon a)
        {
            var kq = new List<RectangleF>();
            if (!Nap()) return kq;
            int w0 = a.W, h0 = a.H;
            byte[] xam0 = new byte[w0 * h0];
            for (int i = 0; i < xam0.Length; i++)
                xam0[i] = (byte)((a.Bgr[i * 3] * 29 + a.Bgr[i * 3 + 1] * 150 + a.Bgr[i * 3 + 2] * 77) >> 8);

            var ung = new List<Rectangle>();
            double tl = 1;
            while (w0 / tl >= coW && h0 / tl >= coH)
            {
                int w = (int)(w0 / tl), h = (int)(h0 / tl);
                byte[] xam = tl == 1 ? xam0 : DoiCo(xam0, w0, h0, w, h);
                QuetMotCo(xam, w, h, tl, ung);
                tl *= 1.1;
            }
            foreach (Rectangle r in GopKhung(ung, 3))
                kq.Add(new RectangleF((float)r.X / w0, (float)r.Y / h0, (float)r.Width / w0, (float)r.Height / h0));
            return kq;
        }

        static byte[] DoiCo(byte[] src, int w0, int h0, int w, int h)
        {
            byte[] dst = new byte[w * h];
            double kx = (double)w0 / w, ky = (double)h0 / h;
            for (int y = 0; y < h; y++)
            {
                double fy = Math.Max(0, (y + 0.5) * ky - 0.5);
                int y1 = Math.Min(h0 - 1, (int)fy), y2 = Math.Min(h0 - 1, y1 + 1);
                double ty = fy - y1;
                for (int x = 0; x < w; x++)
                {
                    double fx = Math.Max(0, (x + 0.5) * kx - 0.5);
                    int x1 = Math.Min(w0 - 1, (int)fx), x2 = Math.Min(w0 - 1, x1 + 1);
                    double tx = fx - x1;
                    double v = (src[y1 * w0 + x1] * (1 - tx) + src[y1 * w0 + x2] * tx) * (1 - ty)
                             + (src[y2 * w0 + x1] * (1 - tx) + src[y2 * w0 + x2] * tx) * ty;
                    dst[y * w + x] = (byte)(v + 0.5);
                }
            }
            return dst;
        }

        static void QuetMotCo(byte[] xam, int w, int h, double tl, List<Rectangle> ung)
        {
            // ảnh tích phân (tổng và tổng bình phương), thêm 1 hàng / cột 0 ở đầu
            int W1 = w + 1;
            int[] tong = new int[W1 * (h + 1)];
            long[] tong2 = new long[W1 * (h + 1)];
            for (int y = 0; y < h; y++)
            {
                int hang = 0; long hang2 = 0;
                for (int x = 0; x < w; x++)
                {
                    int v = xam[y * w + x];
                    hang += v; hang2 += v * v;
                    tong[(y + 1) * W1 + x + 1] = tong[y * W1 + x + 1] + hang;
                    tong2[(y + 1) * W1 + x + 1] = tong2[y * W1 + x + 1] + hang2;
                }
            }
            int dienTichChuan = (coW - 2) * (coH - 2);
            var moi = new List<Rectangle>();
            object khoaMoi = new object();
            BoLoc.SongSong((h - coH) / 2 + 1, (ya, yb) =>
            {
                for (int yi = ya; yi < yb; yi++)
                {
                    int y = yi * 2;
                    if (y > h - coH) break;
                    for (int x = 0; x <= w - coW; x += 2)
                    {
                        // chuẩn hoá theo độ lệch chuẩn trong cửa sổ (bỏ viền 1 điểm như OpenCV)
                        int a0 = (y + 1) * W1 + x + 1, a1 = (y + 1) * W1 + x + coW - 1;
                        int b0 = (y + coH - 1) * W1 + x + 1, b1 = (y + coH - 1) * W1 + x + coW - 1;
                        double s = tong[b1] - tong[b0] - tong[a1] + tong[a0];
                        double s2 = tong2[b1] - tong2[b0] - tong2[a1] + tong2[a0];
                        double nf = dienTichChuan * s2 - s * s;
                        nf = nf > 0 ? Math.Sqrt(nf) : 1;
                        double kc = 1 / nf;
                        bool dat = true;
                        foreach (Tang t in tang)
                        {
                            double tongTang = 0;
                            foreach (Yeu yk in t.Ds)
                            {
                                DacTrung d = dacTrung[yk.Dt];
                                double f = 0;
                                for (int k = 0; k < d.X.Length; k++)
                                {
                                    int x0 = x + d.X[k], y0 = y + d.Y[k], x1 = x0 + d.W[k], y1 = y0 + d.H[k];
                                    f += d.TrongSo[k] * (tong[y1 * W1 + x1] - tong[y1 * W1 + x0] - tong[y0 * W1 + x1] + tong[y0 * W1 + x0]);
                                }
                                tongTang += f * kc < yk.Nguong ? yk.La0 : yk.La1;
                            }
                            if (tongTang < t.Nguong) { dat = false; break; }
                        }
                        if (dat)
                            lock (khoaMoi) moi.Add(new Rectangle((int)Math.Round(x * tl), (int)Math.Round(y * tl), (int)Math.Round(coW * tl), (int)Math.Round(coH * tl)));
                    }
                }
            });
            ung.AddRange(moi);
        }

        /// <summary>Gộp các khung gần trùng nhau (như groupRectangles của OpenCV), bỏ cụm có ≤ <paramref name="lanCan"/> khung.</summary>
        static List<Rectangle> GopKhung(List<Rectangle> ds, int lanCan)
        {
            int n = ds.Count;
            int[] cha = Enumerable.Range(0, n).ToArray();
            Func<int, int> goc = null;
            goc = i => cha[i] == i ? i : (cha[i] = goc(cha[i]));
            for (int i = 0; i < n; i++)
                for (int j = i + 1; j < n; j++)
                {
                    Rectangle a = ds[i], b = ds[j];
                    double d = 0.2 * (Math.Min(a.Width, b.Width) + Math.Min(a.Height, b.Height)) * 0.5;
                    if (Math.Abs(a.X - b.X) <= d && Math.Abs(a.Y - b.Y) <= d &&
                        Math.Abs(a.Right - b.Right) <= d && Math.Abs(a.Bottom - b.Bottom) <= d)
                        cha[goc(i)] = goc(j);
                }
            var cum = Enumerable.Range(0, n).GroupBy(i => goc(i))
                .Where(g => g.Count() > lanCan)
                .Select(g => new
                {
                    Dem = g.Count(),
                    R = new Rectangle((int)g.Average(i => ds[i].X), (int)g.Average(i => ds[i].Y),
                                      (int)g.Average(i => ds[i].Width), (int)g.Average(i => ds[i].Height))
                }).ToList();
            // bỏ khung nhỏ nằm trong khung lớn hơn
            var kq = new List<Rectangle>();
            foreach (var c in cum)
            {
                bool trong = cum.Any(o => o != c && o.Dem >= Math.Max(3, c.Dem) &&
                    c.R.X >= o.R.X - o.R.Width * 0.2 && c.R.Y >= o.R.Y - o.R.Height * 0.2 &&
                    c.R.Right <= o.R.Right + o.R.Width * 0.2 && c.R.Bottom <= o.R.Bottom + o.R.Height * 0.2 &&
                    c.R.Width < o.R.Width);
                if (!trong) kq.Add(c.R);
            }
            return kq;
        }
    }
}
