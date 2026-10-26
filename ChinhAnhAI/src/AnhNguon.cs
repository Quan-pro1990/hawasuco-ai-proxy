using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;

namespace ChinhAnhAI
{
    /// <summary>Ảnh đã giải mã: 3 byte B, G, R mỗi điểm ảnh (sRGB), hàng liền nhau không đệm.</summary>
    public class AnhNguon
    {
        public int W, H;
        public byte[] Bgr;
        /// <summary>Tỉ lệ so với ảnh gốc (1 = ảnh gốc, 0.25 = bản xem trước thu nhỏ 4 lần). Bộ lọc dựa vào đây để cùng hiệu ứng ở mọi cỡ.</summary>
        public double TiLe = 1;
        public string DuongDan;
        /// <summary>Khối EXIF gốc (dữ liệu TIFF trong đoạn APP1 của tệp JPEG), null nếu không có. Chép nguyên sang ảnh lưu.</summary>
        public byte[] Exif;
        /// <summary>Khuôn mặt tìm được (toạ độ 0..1), dùng chung cho mọi cỡ của cùng một ảnh.</summary>
        public RectangleF[] KhuonMat = new RectangleF[0];

        public static readonly string[] DuoiHoTro = { ".jpg", ".jpeg", ".jpe", ".png", ".bmp", ".tif", ".tiff", ".gif", ".jfif" };

        public static bool LaAnh(string duongDan)
        {
            string d = Path.GetExtension(duongDan ?? "").ToLowerInvariant();
            return DuoiHoTro.Contains(d);
        }

        public AnhNguon(int w, int h)
        {
            W = w; H = h;
            Bgr = new byte[(long)w * h * 3];
        }

        /// <summary>Đọc ảnh, xoay theo thẻ hướng chụp EXIF, chuyển hồ sơ màu nhúng (Adobe RGB, Display P3…) về sRGB.</summary>
        public static AnhNguon Mo(string duongDan)
        {
            byte[] tep = File.ReadAllBytes(duongDan);
            using (var ms = new MemoryStream(tep))
            using (Image img = Image.FromStream(ms, true, true))
            {
                PropertyItem[] exif;
                try { exif = img.PropertyItems; }
                catch (Exception) { exif = new PropertyItem[0]; }

                using (var bmp = new Bitmap(img.Width, img.Height, PixelFormat.Format24bppRgb))
                {
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.Clear(Color.White);   // ảnh PNG trong suốt: nền trắng
                        g.InterpolationMode = InterpolationMode.NearestNeighbor;
                        g.PixelOffsetMode = PixelOffsetMode.Half;
                        g.DrawImage(img, new Rectangle(0, 0, img.Width, img.Height));
                    }
                    AnhNguon a = XoayTheoHuong(TuBitmap(bmp), HuongChup(exif));
                    a.DuongDan = duongDan;
                    a.Exif = Exif_.LayTuJpeg(tep);
                    return a;
                }
            }
        }

        /// <summary>Thẻ hướng chụp EXIF (1..8; 1 = bình thường).</summary>
        static int HuongChup(PropertyItem[] exif)
        {
            PropertyItem p = exif.FirstOrDefault(x => x.Id == 0x0112);
            if (p == null || p.Value == null || p.Value.Length < 2) return 1;
            int v = BitConverter.ToUInt16(p.Value, 0);
            if (v < 1 || v > 8) v = (p.Value[0] << 8) | p.Value[1];   // EXIF kiểu big-endian chưa được chuẩn hoá
            return v >= 1 && v <= 8 ? v : 1;
        }

        /// <summary>Xoay / lật điểm ảnh theo thẻ hướng chụp để ảnh dọc của điện thoại đứng đúng chiều.</summary>
        static AnhNguon XoayTheoHuong(AnhNguon a, int huong)
        {
            if (huong <= 1) return a;
            int W = a.W, H = a.H;
            bool doi = huong >= 5;
            var kq = new AnhNguon(doi ? H : W, doi ? W : H);
            int w2 = kq.W, h2 = kq.H;
            byte[] src = a.Bgr, dst = kq.Bgr;
            BoLoc.SongSong(h2, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                    for (int x = 0; x < w2; x++)
                    {
                        int sx, sy;
                        switch (huong)
                        {
                            case 2: sx = W - 1 - x; sy = y; break;              // lật ngang
                            case 3: sx = W - 1 - x; sy = H - 1 - y; break;      // xoay 180°
                            case 4: sx = x; sy = H - 1 - y; break;              // lật dọc
                            case 5: sx = y; sy = x; break;                      // chuyển vị
                            case 6: sx = y; sy = H - 1 - x; break;              // xoay 90° theo chiều kim đồng hồ
                            case 7: sx = W - 1 - y; sy = H - 1 - x; break;
                            default: sx = W - 1 - y; sy = x; break;             // 8: xoay 90° ngược chiều kim đồng hồ
                        }
                        int j = (sy * W + sx) * 3, o = (y * w2 + x) * 3;
                        dst[o] = src[j]; dst[o + 1] = src[j + 1]; dst[o + 2] = src[j + 2];
                    }
            });
            return kq;
        }

        public static AnhNguon TuBitmap(Bitmap bmp)
        {
            var a = new AnhNguon(bmp.Width, bmp.Height);
            BitmapData d = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
            try
            {
                int hang = a.W * 3;
                for (int y = 0; y < a.H; y++)
                    Marshal.Copy(IntPtr.Add(d.Scan0, y * d.Stride), a.Bgr, y * hang, hang);
            }
            finally { bmp.UnlockBits(d); }
            return a;
        }

        public static Bitmap SangBitmap(byte[] bgr, int w, int h)
        {
            var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb);
            BitmapData d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
            try
            {
                int hang = w * 3;
                for (int y = 0; y < h; y++)
                    Marshal.Copy(bgr, y * hang, IntPtr.Add(d.Scan0, y * d.Stride), hang);
            }
            finally { bmp.UnlockBits(d); }
            return bmp;
        }

        public Bitmap SangBitmap() { return SangBitmap(Bgr, W, H); }

        /// <summary>
        /// Thu nhỏ để cạnh dài nhất ≤ <paramref name="canhDai"/>: lấy trung bình theo diện tích, cộng trong không gian
        /// ánh sáng tuyến tính (không làm tối các chi tiết sáng nhỏ như cách thu nhỏ thông thường).
        /// </summary>
        public AnhNguon ThuNho(int canhDai)
        {
            int dai = Math.Max(W, H);
            if (dai <= canhDai) return this;
            double k = (double)canhDai / dai;
            int w2 = Math.Max(1, (int)Math.Round(W * k)), h2 = Math.Max(1, (int)Math.Round(H * k));

            int[] x0, x1; float[] wx0, wx1; float nx;
            KhoangLay(W, w2, out x0, out x1, out wx0, out wx1, out nx);
            int[] y0, y1; float[] wy0, wy1; float ny;
            KhoangLay(H, h2, out y0, out y1, out wy0, out wy1, out ny);

            // ngang: W×H → w2×H (3 kênh tuyến tính)
            int srcW = W;
            byte[] src = Bgr;
            float[] tam = new float[(long)w2 * H * 3];
            float[] lin = Mau.Lin8;
            BoLoc.SongSong(H, (ya, yb) =>
            {
                for (int y = ya; y < yb; y++)
                {
                    int hangNguon = y * srcW * 3, hangDich = y * w2 * 3;
                    for (int x = 0; x < w2; x++)
                    {
                        float s0 = 0, s1 = 0, s2 = 0;
                        for (int sx = x0[x]; sx <= x1[x]; sx++)
                        {
                            float t = sx == x0[x] ? wx0[x] : (sx == x1[x] ? wx1[x] : 1f);
                            int j = hangNguon + sx * 3;
                            s0 += lin[src[j]] * t; s1 += lin[src[j + 1]] * t; s2 += lin[src[j + 2]] * t;
                        }
                        int o = hangDich + x * 3;
                        tam[o] = s0 / nx; tam[o + 1] = s1 / nx; tam[o + 2] = s2 / nx;
                    }
                }
            });

            // dọc: w2×H → w2×h2
            var kq = new AnhNguon(w2, h2);
            byte[] dst = kq.Bgr;
            BoLoc.SongSong(h2, (ya, yb) =>
            {
                float[] acc = new float[w2 * 3];
                for (int y = ya; y < yb; y++)
                {
                    Array.Clear(acc, 0, acc.Length);
                    for (int sy = y0[y]; sy <= y1[y]; sy++)
                    {
                        float t = sy == y0[y] ? wy0[y] : (sy == y1[y] ? wy1[y] : 1f);
                        int hang = sy * w2 * 3;
                        for (int i = 0; i < acc.Length; i++) acc[i] += tam[hang + i] * t;
                    }
                    int o = y * w2 * 3;
                    for (int i = 0; i < acc.Length; i++) dst[o + i] = Mau.SangByte(Mau.MaHoa(acc[i] / ny));
                }
            });
            kq.TiLe = TiLe * k;
            kq.DuongDan = DuongDan;
            kq.Exif = Exif;
            kq.KhuonMat = KhuonMat;
            return kq;
        }

        /// <summary>Mỗi điểm đích ứng với đoạn [a, b) trên ảnh nguồn; điểm nguồn đầu và cuối chỉ tính một phần.</summary>
        static void KhoangLay(int n, int m, out int[] s0, out int[] s1, out float[] w0, out float[] w1, out float tong)
        {
            s0 = new int[m]; s1 = new int[m]; w0 = new float[m]; w1 = new float[m];
            double buoc = (double)n / m;
            for (int i = 0; i < m; i++)
            {
                double a = i * buoc, b = Math.Min(n, (i + 1) * buoc);
                int ia = (int)Math.Floor(a), ib = Math.Min(n - 1, (int)Math.Ceiling(b) - 1);
                s0[i] = ia; s1[i] = ib;
                if (ia == ib) { w0[i] = (float)(b - a); w1[i] = w0[i]; }
                else { w0[i] = (float)(ia + 1 - a); w1[i] = (float)(b - ib); }
            }
            tong = (float)buoc;
        }

        /// <summary>
        /// Ghi ảnh. Đuôi .png / .tif / .bmp ghi đúng định dạng đó, còn lại ghi JPEG với chất lượng <paramref name="chatLuong"/>.
        /// JPEG: chép nguyên EXIF của ảnh gốc (máy ảnh, ngày chụp, GPS…), đặt hướng = bình thường vì điểm ảnh đã xoay,
        /// bỏ ảnh thu nhỏ cũ để Explorer hiện đúng ảnh đã chỉnh.
        /// </summary>
        public static void Luu(byte[] bgr, int w, int h, string duongDan, int chatLuong, byte[] exif)
        {
            string duoi = Path.GetExtension(duongDan).ToLowerInvariant();
            string tam = duongDan + ".dang-ghi";
            using (Bitmap bmp = SangBitmap(bgr, w, h))
            {
                if (duoi == ".png") bmp.Save(tam, ImageFormat.Png);
                else if (duoi == ".bmp") bmp.Save(tam, ImageFormat.Bmp);
                else if (duoi == ".tif" || duoi == ".tiff") bmp.Save(tam, ImageFormat.Tiff);
                else
                {
                    ImageCodecInfo jpeg = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
                    byte[] du;
                    using (var ms = new MemoryStream())
                    using (var ps = new EncoderParameters(1))
                    {
                        ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)Math.Max(30, Math.Min(100, chatLuong)));
                        bmp.Save(ms, jpeg, ps);
                        du = ms.ToArray();
                    }
                    File.WriteAllBytes(tam, Exif_.GanVaoJpeg(du, exif, w, h));
                }
            }
            // ghi xong mới thay tệp cũ: lỗi giữa chừng không làm hỏng ảnh đã có
            if (File.Exists(duongDan)) File.Delete(duongDan);
            File.Move(tam, duongDan);
        }
    }

    /// <summary>Đọc / ghi khối EXIF thô trong tệp JPEG (không qua GDI+ để giữ đủ thẻ, kể cả GPS, MakerNote).</summary>
    static class Exif_
    {
        public static byte[] LayTuJpeg(byte[] tep)
        {
            try
            {
                if (tep.Length < 4 || tep[0] != 0xFF || tep[1] != 0xD8) return null;
                int i = 2;
                while (i + 4 <= tep.Length && tep[i] == 0xFF)
                {
                    int ma = tep[i + 1];
                    if (ma == 0xDA || ma == 0xD9) break;                 // bắt đầu dữ liệu ảnh
                    int dai = (tep[i + 2] << 8) | tep[i + 3];
                    if (dai < 2 || i + 2 + dai > tep.Length) break;
                    if (ma == 0xE1 && dai >= 8 && tep[i + 4] == 'E' && tep[i + 5] == 'x' && tep[i + 6] == 'i' && tep[i + 7] == 'f')
                    {
                        var kq = new byte[dai - 8];
                        Array.Copy(tep, i + 10, kq, 0, kq.Length);
                        return kq;
                    }
                    i += 2 + dai;
                }
            }
            catch (Exception) { }
            return null;
        }

        /// <summary>Chèn EXIF (đã sửa hướng, kích thước, bỏ ảnh thu nhỏ) ngay sau SOI của tệp JPEG mới.</summary>
        public static byte[] GanVaoJpeg(byte[] jpeg, byte[] exif, int w, int h)
        {
            if (exif == null || exif.Length < 8 || exif.Length > 65000 || jpeg.Length < 2) return jpeg;
            byte[] t = (byte[])exif.Clone();
            if (!SuaTiff(t, w, h)) return jpeg;
            var ms = new MemoryStream(jpeg.Length + t.Length + 16);
            ms.WriteByte(0xFF); ms.WriteByte(0xD8);
            int dai = t.Length + 8;
            ms.WriteByte(0xFF); ms.WriteByte(0xE1); ms.WriteByte((byte)(dai >> 8)); ms.WriteByte((byte)dai);
            ms.Write(new byte[] { (byte)'E', (byte)'x', (byte)'i', (byte)'f', 0, 0 }, 0, 6);
            ms.Write(t, 0, t.Length);
            // bỏ đoạn APP1 EXIF (nếu có) mà bộ mã hoá vừa ghi, giữ phần còn lại
            int i = 2;
            while (i + 4 <= jpeg.Length && jpeg[i] == 0xFF && jpeg[i + 1] == 0xE1)
                i += 2 + ((jpeg[i + 2] << 8) | jpeg[i + 3]);
            ms.Write(jpeg, i, jpeg.Length - i);
            return ms.ToArray();
        }

        static bool SuaTiff(byte[] t, int w, int h)
        {
            bool le;
            if (t[0] == 'I' && t[1] == 'I') le = true;
            else if (t[0] == 'M' && t[1] == 'M') le = false;
            else return false;
            Func<int, int> u16 = o => le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1];
            Func<int, long> u32 = o => le ? (uint)(t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24))
                                          : (uint)((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]);
            Action<int, int> g16 = (o, v) => { if (le) { t[o] = (byte)v; t[o + 1] = (byte)(v >> 8); } else { t[o] = (byte)(v >> 8); t[o + 1] = (byte)v; } };
            Action<int, long> g32 = (o, v) =>
            {
                if (le) { t[o] = (byte)v; t[o + 1] = (byte)(v >> 8); t[o + 2] = (byte)(v >> 16); t[o + 3] = (byte)(v >> 24); }
                else { t[o] = (byte)(v >> 24); t[o + 1] = (byte)(v >> 16); t[o + 2] = (byte)(v >> 8); t[o + 3] = (byte)v; }
            };
            long ifd0 = u32(4);
            if (ifd0 < 8 || ifd0 + 2 > t.Length) return false;
            int n = u16((int)ifd0);
            int cuoi = (int)ifd0 + 2 + n * 12;
            if (cuoi + 4 > t.Length) return false;
            long exifIfd = 0;
            for (int k = 0; k < n; k++)
            {
                int e = (int)ifd0 + 2 + k * 12;
                int the = u16(e), kieu = u16(e + 2);
                if (the == 0x0112 && kieu == 3) g16(e + 8, 1);          // hướng: bình thường
                if (the == 0x8769) exifIfd = u32(e + 8);
            }
            g32(cuoi, 0);                                               // bỏ IFD1 (ảnh thu nhỏ cũ)
            if (exifIfd >= 8 && exifIfd + 2 <= t.Length)
            {
                int m = u16((int)exifIfd);
                if (exifIfd + 2 + m * 12 <= t.Length)
                    for (int k = 0; k < m; k++)
                    {
                        int e = (int)exifIfd + 2 + k * 12;
                        int the = u16(e), kieu = u16(e + 2);
                        if (the != 0xA002 && the != 0xA003) continue;      // kích thước điểm ảnh
                        int v = the == 0xA002 ? w : h;
                        if (kieu == 3 && v <= 65535) g16(e + 8, v);
                        else if (kieu == 4) g32(e + 8, v);
                    }
            }
            return true;
        }
    }
}
