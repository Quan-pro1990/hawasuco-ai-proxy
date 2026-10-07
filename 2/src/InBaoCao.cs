using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// In thẳng các mẫu báo cáo: dựng trang in từ cùng bảng (XSo) như file Excel xuất ra — khổ A4 ngang / dọc,
    /// vừa 1 trang theo bề ngang, lặp dòng tiêu đề cột ở mỗi trang — xem trước, chọn máy in, in. Không cần Excel.
    /// </summary>
    public static class InBaoCao
    {
        public static void In(Control owner, Func<XSo> tao, string ten)
        {
            XSo so;
            try
            {
                Cursor.Current = Cursors.WaitCursor;
                so = tao();
            }
            catch (InvalidOperationException ex)
            {
                Ui.Error(owner, ex.Message);
                return;
            }
            finally
            {
                Cursor.Current = Cursors.Default;
            }
            if (PrinterSettings.InstalledPrinters.Count == 0)
            {
                Ui.Error(owner, "Máy tính chưa cài máy in nào (kể cả máy in PDF). Cài máy in trong Windows → Cài đặt → Máy in rồi thử lại, hoặc dùng \"Xuất Excel…\".");
                return;
            }
            using (var f = new InForm(so, ten)) f.ShowDialog(owner.FindForm());
        }
    }

    /// <summary>Bố cục in của 1 trang Excel (XTrang): toạ độ cột, chiều cao dòng (đơn vị point), ô gộp.</summary>
    class BoCucIn
    {
        const float RongSo = 8f;    // độ rộng chữ số của phông Times New Roman 12 (pixel 96 dpi) — cách Excel đổi độ rộng cột
        public readonly XTrang T;
        public readonly int SoCot, SoDong;
        public readonly float[] X;     // X[c] = mép trái cột c (pt); X[SoCot + 1] = tổng bề ngang
        public readonly float[] H;     // chiều cao dòng (pt)
        public readonly Dictionary<long, int[]> Gop = new Dictionary<long, int[]>();   // ô đầu → r1, c1, r2, c2
        public readonly HashSet<long> TrongGop = new HashSet<long>();
        public readonly bool[] KhongNgat;    // dòng nằm giữa 1 vùng gộp dọc: không ngắt trang trước dòng này

        public static long K(int r, int c) { return ((long)r << 16) | (uint)c; }

        public BoCucIn(XTrang t, Graphics g)
        {
            T = t;
            int maxC = 1, maxR = 1;
            foreach (var row in t.Dong)
                foreach (var cell in row.Value)
                {
                    if (cell.Value.GiaTri == null && cell.Value.CongThuc == null && (cell.Value.Kieu == null || (!cell.Value.Kieu.Khung && cell.Value.Kieu.Nen == null))) continue;
                    maxR = Math.Max(maxR, row.Key);
                    maxC = Math.Max(maxC, cell.Key);
                }
            foreach (string gop in t.Gop)
            {
                int[] v = DocVung(gop);
                Gop[K(v[0], v[1])] = v;
                for (int r = v[0]; r <= v[2]; r++)
                    for (int c = v[1]; c <= v[3]; c++)
                        if (r != v[0] || c != v[1]) TrongGop.Add(K(r, c));
                maxC = Math.Max(maxC, v[3]);
            }
            if (t.VungInCot > 0) maxC = t.VungInCot;
            SoCot = maxC;
            SoDong = maxR;
            X = new float[SoCot + 2];
            for (int c = 1; c <= SoCot; c++)
            {
                double w;
                if (!t.RongCot.TryGetValue(c, out w)) w = 8.43;
                X[c + 1] = X[c] + (float)(Math.Truncate(w * RongSo + 5) * 0.75);
            }
            H = new float[SoDong + 1];
            KhongNgat = new bool[SoDong + 2];
            foreach (int[] v in Gop.Values)
                for (int r = v[0] + 1; r <= v[2]; r++) KhongNgat[r] = true;
            for (int r = 1; r <= SoDong; r++)
            {
                double h;
                H[r] = t.CaoDong.TryGetValue(r, out h) ? (float)h : TuCao(r, g);
            }
        }

        static int[] DocVung(string vung)
        {
            string[] p = vung.Split(':');
            int r1, c1, r2, c2;
            DocO(p[0], out r1, out c1);
            DocO(p.Length > 1 ? p[1] : p[0], out r2, out c2);
            return new[] { r1, c1, r2, c2 };
        }

        static void DocO(string o, out int r, out int c)
        {
            int i = 0;
            c = 0;
            while (i < o.Length && char.IsLetter(o[i])) c = c * 26 + (char.ToUpperInvariant(o[i++]) - 'A' + 1);
            r = int.Parse(o.Substring(i), CultureInfo.InvariantCulture);
        }

        /// <summary>Dòng không đặt chiều cao: Excel tự cao theo chữ (ô xuống dòng), tối thiểu 15,75 pt.</summary>
        float TuCao(int r, Graphics g)
        {
            float h = 15.75f;
            SortedDictionary<int, XO> row;
            if (!T.Dong.TryGetValue(r, out row)) return h;
            foreach (var cell in row)
            {
                XO o = cell.Value;
                if (o.Kieu == null || cell.Key > SoCot || TrongGop.Contains(K(r, cell.Key)) || Gop.ContainsKey(K(r, cell.Key))) continue;
                h = Math.Max(h, (float)o.Kieu.Co * 1.3f);
                string s = InVe.Chu(o);
                if (!o.Kieu.XuongDong || s.Length == 0) continue;
                float w = X[cell.Key + 1] - X[cell.Key] - 4;
                using (StringFormat f = InVe.Dang(o.Kieu, true))
                    h = Math.Max(h, g.MeasureString(s, InVe.Phong(o.Kieu), new SizeF(Math.Max(10, w), 10000), f).Height + 3);
            }
            return Math.Min(409, h);
        }
    }

    /// <summary>Vẽ ô, chữ, khung như Excel.</summary>
    static class InVe
    {
        static readonly Dictionary<string, Font> phong = new Dictionary<string, Font>();

        public static Font Phong(XKieu k)
        {
            FontStyle st = (k.Dam ? FontStyle.Bold : 0) | (k.Nghieng ? FontStyle.Italic : 0) | (k.GachChan ? FontStyle.Underline : 0);
            string key = k.Phong + "|" + k.Co.ToString(CultureInfo.InvariantCulture) + "|" + (int)st;
            Font f;
            if (!phong.TryGetValue(key, out f))
            {
                f = new Font(k.Phong, (float)k.Co, st, GraphicsUnit.Point);
                phong[key] = f;
            }
            return f;
        }

        public static string Chu(XO o)
        {
            object v = o.GiaTri;
            if (v == null) return "";
            if (v is string) return ((string)v).Replace("\r", "");
            if (v is DateTime) return ((DateTime)v).ToString("dd/MM/yyyy");
            if (v is double || v is int || v is long || v is float || v is decimal)
            {
                double d = Convert.ToDouble(v);
                if (double.IsNaN(d) || double.IsInfinity(d)) return "";
                string f = o.Kieu != null ? o.Kieu.DinhDang : null;
                if (f != null) return d.ToString(f, So.VN);
                return Math.Abs(d - Math.Round(d)) < 1e-9 ? d.ToString("0", So.VN) : d.ToString("0.#########", So.VN);
            }
            return Convert.ToString(v);
        }

        public static bool LaSo(XO o)
        {
            object v = o.GiaTri;
            return v is double || v is int || v is long || v is float || v is decimal;
        }

        public static StringFormat Dang(XKieu k, bool xuongDong)
        {
            var f = new StringFormat(StringFormat.GenericTypographic);
            f.FormatFlags = StringFormatFlags.MeasureTrailingSpaces | (xuongDong ? 0 : StringFormatFlags.NoWrap);
            f.Trimming = StringTrimming.None;
            return f;
        }

        static Color Mau(string argb, Color macDinh)
        {
            if (string.IsNullOrEmpty(argb) || argb.Length != 8) return macDinh;
            return Color.FromArgb(int.Parse(argb, NumberStyles.HexNumber));
        }

        /// <summary>Vẽ các dòng [r1, r2] của trang tại (x0, y0), đơn vị point. Trả chiều cao đã vẽ.</summary>
        public static float VeDong(Graphics g, BoCucIn b, int r1, int r2, float x0, float y0)
        {
            var yr = new Dictionary<int, float>();
            float y = y0;
            for (int r = r1; r <= r2; r++) { yr[r] = y; y += b.H[r]; }
            Func<int, int, RectangleF> vung = (r, c) =>
            {
                int[] v;
                if (b.Gop.TryGetValue(BoCucIn.K(r, c), out v))
                {
                    int rr2 = Math.Min(v[2], r2), cc2 = Math.Min(v[3], b.SoCot);
                    float h = 0;
                    for (int i = r; i <= rr2; i++) h += b.H[i];
                    return new RectangleF(x0 + b.X[c], yr[r], b.X[cc2 + 1] - b.X[c], h);
                }
                return new RectangleF(x0 + b.X[c], yr[r], b.X[c + 1] - b.X[c], b.H[r]);
            };
            // 1. nền
            for (int r = r1; r <= r2; r++)
            {
                SortedDictionary<int, XO> row;
                if (!b.T.Dong.TryGetValue(r, out row)) continue;
                foreach (var cell in row)
                {
                    if (cell.Key > b.SoCot || b.TrongGop.Contains(BoCucIn.K(r, cell.Key)) || cell.Value.Kieu == null || cell.Value.Kieu.Nen == null) continue;
                    using (var br = new SolidBrush(Mau(cell.Value.Kieu.Nen, Color.White))) g.FillRectangle(br, vung(r, cell.Key));
                }
            }
            // 2. chữ
            for (int r = r1; r <= r2; r++)
            {
                SortedDictionary<int, XO> row;
                if (!b.T.Dong.TryGetValue(r, out row)) continue;
                foreach (var cell in row)
                {
                    int c = cell.Key;
                    XO o = cell.Value;
                    if (c > b.SoCot || b.TrongGop.Contains(BoCucIn.K(r, c))) continue;
                    string s = Chu(o);
                    if (s.Length == 0) continue;
                    XKieu k = o.Kieu ?? new XKieu();
                    RectangleF rc = vung(r, c);
                    string ngang = k.Ngang ?? (LaSo(o) ? "right" : "left");
                    bool gop = b.Gop.ContainsKey(BoCucIn.K(r, c));
                    // chữ không xuống dòng tràn sang ô trống bên cạnh (như Excel)
                    if (!k.XuongDong && !gop && !LaSo(o))
                    {
                        float can;
                        using (StringFormat fm = Dang(k, false)) can = g.MeasureString(s, Phong(k), PointF.Empty, fm).Width + 4;
                        if (can > rc.Width)
                        {
                            float them = 0;
                            for (int c2 = c + 1; c2 <= b.SoCot && rc.Width + them < can; c2++)
                            {
                                if (!Trong(b, r, c2)) break;
                                them += b.X[c2 + 1] - b.X[c2];
                            }
                            if (ngang == "center") rc = new RectangleF(rc.X - them / 2, rc.Y, rc.Width + them, rc.Height);
                            else if (ngang != "right") rc = new RectangleF(rc.X, rc.Y, rc.Width + them, rc.Height);
                        }
                    }
                    float le = 2f + k.Le * 9f;
                    var o2 = new RectangleF(rc.X + le, rc.Y + 1, rc.Width - le - 2, rc.Height - 2);
                    using (StringFormat f = Dang(k, k.XuongDong))
                    {
                        f.Alignment = ngang == "center" ? StringAlignment.Center : ngang == "right" ? StringAlignment.Far : StringAlignment.Near;
                        f.LineAlignment = k.Doc == "top" ? StringAlignment.Near : k.Doc == "bottom" ? StringAlignment.Far : StringAlignment.Center;
                        if (LaSo(o)) f.FormatFlags |= StringFormatFlags.NoWrap;
                        GraphicsState st = g.Save();
                        g.SetClip(new RectangleF(rc.X, rc.Y, rc.Width, rc.Height));
                        using (var br = new SolidBrush(Mau(k.Mau, Color.Black))) g.DrawString(s, Phong(k), br, o2, f);
                        g.Restore(st);
                    }
                }
            }
            // 3. khung mảnh
            using (var pen = new Pen(Color.Black, 0.5f))
                for (int r = r1; r <= r2; r++)
                {
                    SortedDictionary<int, XO> row;
                    if (!b.T.Dong.TryGetValue(r, out row)) continue;
                    foreach (var cell in row)
                    {
                        if (cell.Key > b.SoCot || b.TrongGop.Contains(BoCucIn.K(r, cell.Key)) || cell.Value.Kieu == null || !cell.Value.Kieu.Khung) continue;
                        RectangleF rc = vung(r, cell.Key);
                        g.DrawRectangle(pen, rc.X, rc.Y, rc.Width, rc.Height);
                    }
                }
            return y - y0;
        }

        static bool Trong(BoCucIn b, int r, int c)
        {
            if (b.TrongGop.Contains(BoCucIn.K(r, c)) || b.Gop.ContainsKey(BoCucIn.K(r, c))) return false;
            SortedDictionary<int, XO> row;
            XO o;
            return !b.T.Dong.TryGetValue(r, out row) || !row.TryGetValue(c, out o) || Chu(o).Length == 0;
        }
    }

    /// <summary>1 trang giấy: dòng nào của trang Excel nào.</summary>
    class TrangGiay
    {
        public BoCucIn B;
        public int Tu, Den;         // dòng nội dung
        public bool LapTieuDe;      // lặp dòng tiêu đề cột ở đầu trang
        public float TiLe;
        public int SoThu, TongTrangCuaBang;
    }

    /// <summary>Chia các bảng thành trang giấy và vẽ 1 trang (dùng cho in thẳng và file PDF của máy chủ).</summary>
    static class ChiaTrang
    {
        // lề như file Excel: trái / phải 0,35", trên / dưới 0,5" (đơn vị 1/100 inch)
        public static readonly Margins Le = new Margins(35, 35, 50, 50);

        /// <summary>Mỗi bảng vừa bề ngang 1 trang giấy (như Excel "Fit to 1 page wide"), dòng tiêu đề cột lặp lại.
        /// Khổ giấy tính theo chiều dọc, đơn vị 1/100 inch (A4 = 827 × 1169).</summary>
        public static List<TrangGiay> Chia(XSo so, float giayRong, float giayCao)
        {
            var trang = new List<TrangGiay>();
            using (var bmp = new Bitmap(10, 10))
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.PageUnit = GraphicsUnit.Point;
                foreach (XTrang t in so.Trang)
                {
                    var b = new BoCucIn(t, g);
                    float giayW = (t.Ngang ? giayCao : giayRong) * 0.72f, giayH = (t.Ngang ? giayRong : giayCao) * 0.72f;
                    float rong = giayW - (Le.Left + Le.Right) * 0.72f, cao = giayH - (Le.Top + Le.Bottom) * 0.72f - 14;
                    float tiLe = Math.Min(1f, rong / b.X[b.SoCot + 1]);
                    float caoTd = 0;
                    if (t.LapTu > 0) for (int r = t.LapTu; r <= Math.Min(t.LapDen, b.SoDong); r++) caoTd += b.H[r];
                    var moi = new List<TrangGiay>();
                    int tu = 1;
                    while (tu <= b.SoDong)
                    {
                        bool lap = moi.Count > 0 && t.LapTu > 0 && tu > t.LapDen;
                        float con = cao / tiLe - (lap ? caoTd : 0), dung = 0;
                        int den = tu - 1, ngatDep = -1;
                        while (den + 1 <= b.SoDong && dung + b.H[den + 1] <= con)
                        {
                            den++;
                            dung += b.H[den];
                            if (den + 1 > b.SoDong || !b.KhongNgat[den + 1]) ngatDep = den;
                        }
                        if (den < tu) den = tu;                              // dòng cao hơn cả trang
                        else if (den < b.SoDong && ngatDep >= tu) den = ngatDep;
                        moi.Add(new TrangGiay { B = b, Tu = tu, Den = den, LapTieuDe = lap, TiLe = tiLe });
                        tu = den + 1;
                    }
                    for (int i = 0; i < moi.Count; i++) { moi[i].SoThu = i + 1; moi[i].TongTrangCuaBang = moi.Count; }
                    trang.AddRange(moi);
                }
            }
            return trang;
        }

        /// <summary>Vẽ 1 trang vào vùng lề (đơn vị point): trái, trên, bề ngang vùng in, mép dưới vùng in.</summary>
        public static void Ve(Graphics g, TrangGiay p, float trai, float tren, float rong, float day)
        {
            g.PageUnit = GraphicsUnit.Point;
            g.SmoothingMode = SmoothingMode.None;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            float bangW = p.B.X[p.B.SoCot + 1] * p.TiLe;
            float x0 = trai + Math.Max(0, (rong - bangW) / 2);       // căn giữa theo chiều ngang như file Excel
            GraphicsState st = g.Save();
            g.TranslateTransform(x0, tren);
            g.ScaleTransform(p.TiLe, p.TiLe);
            float y = 0;
            if (p.LapTieuDe) y += InVe.VeDong(g, p.B, p.B.T.LapTu, Math.Min(p.B.T.LapDen, p.B.SoDong), 0, y);
            InVe.VeDong(g, p.B, p.Tu, p.Den, 0, y);
            g.Restore(st);
            if (p.TongTrangCuaBang > 1)
            {
                using (var f = new Font("Times New Roman", 9f, FontStyle.Italic, GraphicsUnit.Point))
                using (var sf = new StringFormat { Alignment = StringAlignment.Center })
                    g.DrawString("Trang " + p.SoThu + "/" + p.TongTrangCuaBang, f, Brushes.Black, new RectangleF(trai, day + 4, rong, 14), sf);
            }
        }
    }

    /// <summary>File PDF của báo cáo (mỗi trang là 1 ảnh JPEG 200 dpi) — để điện thoại tải về in / chia sẻ.</summary>
    static class XuatPdf
    {
        const float GiayRong = 827, GiayCao = 1169;   // A4, 1/100 inch
        const int Dpi = 200;

        public static byte[] Tao(XSo so)
        {
            List<TrangGiay> trang = ChiaTrang.Chia(so, GiayRong, GiayCao);
            var anh = new List<KeyValuePair<Size, byte[]>>();
            ImageCodecInfo jpeg = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
            var ts = new EncoderParameters(1);
            ts.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 88L);
            foreach (TrangGiay p in trang)
            {
                bool ngang = p.B.T.Ngang;
                float w100 = ngang ? GiayCao : GiayRong, h100 = ngang ? GiayRong : GiayCao;
                int wpx = (int)Math.Round(w100 / 100f * Dpi), hpx = (int)Math.Round(h100 / 100f * Dpi);
                using (var bmp = new Bitmap(wpx, hpx, PixelFormat.Format24bppRgb))
                {
                    bmp.SetResolution(Dpi, Dpi);
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.Clear(Color.White);
                        ChiaTrang.Ve(g, p, ChiaTrang.Le.Left * 0.72f, ChiaTrang.Le.Top * 0.72f, (w100 - ChiaTrang.Le.Left - ChiaTrang.Le.Right) * 0.72f,
                                     (h100 - ChiaTrang.Le.Bottom) * 0.72f);
                    }
                    using (var ms = new MemoryStream())
                    {
                        bmp.Save(ms, jpeg, ts);
                        anh.Add(new KeyValuePair<Size, byte[]>(new Size(wpx, hpx), ms.ToArray()));
                    }
                }
            }
            return GhiPdf(anh, trang.Select(p => p.B.T.Ngang).ToList());
        }

        /// <summary>PDF tối giản: mỗi trang 1 ảnh JPEG phủ kín trang A4.</summary>
        static byte[] GhiPdf(List<KeyValuePair<Size, byte[]>> anh, List<bool> ngang)
        {
            var ms = new MemoryStream();
            var viTri = new List<long>();
            Action<string> viet = s => { byte[] b = Encoding.ASCII.GetBytes(s); ms.Write(b, 0, b.Length); };
            Func<int> batDau = () => { viTri.Add(ms.Position); return viTri.Count; };
            viet("%PDF-1.4\n%TTN\n");
            int n = anh.Count;
            // 1 = catalog, 2 = pages, rồi mỗi trang 3 đối tượng: page, nội dung, ảnh
            string kids = string.Join(" ", Enumerable.Range(0, n).Select(i => (3 + i * 3) + " 0 R"));
            batDau(); viet("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
            batDau(); viet("2 0 obj\n<< /Type /Pages /Kids [" + kids + "] /Count " + n + " >>\nendobj\n");
            var inv = CultureInfo.InvariantCulture;
            for (int i = 0; i < n; i++)
            {
                int page = 3 + i * 3, noiDung = page + 1, hinh = page + 2;
                string w = (ngang[i] ? 841.89 : 595.28).ToString("0.##", inv), h = (ngang[i] ? 595.28 : 841.89).ToString("0.##", inv);
                batDau();
                viet(page + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + w + " " + h + "] /Resources << /XObject << /Im" + i + " " + hinh +
                     " 0 R >> >> /Contents " + noiDung + " 0 R >>\nendobj\n");
                string lenh = "q " + w + " 0 0 " + h + " 0 0 cm /Im" + i + " Do Q\n";
                batDau();
                viet(noiDung + " 0 obj\n<< /Length " + lenh.Length + " >>\nstream\n" + lenh + "endstream\nendobj\n");
                batDau();
                viet(hinh + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + anh[i].Key.Width + " /Height " + anh[i].Key.Height +
                     " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + anh[i].Value.Length + " >>\nstream\n");
                ms.Write(anh[i].Value, 0, anh[i].Value.Length);
                viet("\nendstream\nendobj\n");
            }
            long xref = ms.Position;
            viet("xref\n0 " + (viTri.Count + 1) + "\n0000000000 65535 f \n");
            foreach (long p in viTri) viet(p.ToString("D10") + " 00000 n \n");
            viet("trailer\n<< /Size " + (viTri.Count + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
            return ms.ToArray();
        }
    }

    /// <summary>Xem trước bản in, chọn máy in, số bản, in.</summary>
    class InForm : Form
    {
        // lề như file Excel: trái / phải 0,35", trên / dưới 0,5" (đơn vị 1/100 inch)
        static readonly Margins Le = new Margins(35, 35, 50, 50);
        readonly XSo so;
        readonly string ten;
        readonly PrintDocument doc = new PrintDocument();
        readonly PrintPreviewControl xem;
        readonly ComboBox cboMay;
        readonly NumericUpDown numBan;
        readonly Label lblTrang;
        readonly Button btnIn, btnTruoc, btnSau;
        List<TrangGiay> trang = new List<TrangGiay>();
        int dangIn;

        public InForm(XSo so, string ten)
        {
            this.so = so;
            this.ten = ten;
            Text = "In — " + ten;
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            Size = new Size(Ui.S(1220), Ui.S(840));
            MinimumSize = new Size(Ui.S(760), Ui.S(520));
            ShowInTaskbar = false;
            MinimizeBox = false;
            BackColor = Ui.Background;
            KeyPreview = true;

            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(12, 10, 12, 8), BackColor = Ui.Surface };
            btnIn = Ui.MakeButton("In", true);
            btnIn.MinimumSize = new Size(Ui.S(96), Ui.S(34));
            btnIn.Click += (s, e) => InNgay();
            top.Controls.Add(btnIn);
            top.Controls.Add(Nhan("Máy in"));
            cboMay = Ui.MakeCombo(260);
            string macDinh = new PrinterSettings().PrinterName;
            foreach (string p in PrinterSettings.InstalledPrinters) cboMay.Items.Add(p);
            cboMay.SelectedItem = cboMay.Items.Contains(macDinh) ? macDinh : (cboMay.Items.Count > 0 ? cboMay.Items[0] : null);
            cboMay.DropDownWidth = Ui.S(420);
            cboMay.SelectedIndexChanged += (s, e) => DoiMayIn();
            top.Controls.Add(cboMay);
            top.Controls.Add(Nhan("Số bản"));
            numBan = new NumericUpDown { Minimum = 1, Maximum = 99, Value = 1, Width = Ui.S(56), Font = Ui.Base };
            top.Controls.Add(numBan);
            var btnThuoc = Ui.MakeButton("Tuỳ chọn máy in…", false);
            btnThuoc.Click += (s, e) => TuyChon();
            top.Controls.Add(btnThuoc);
            btnTruoc = Ui.MakeButton("◀", false);
            btnTruoc.MinimumSize = new Size(Ui.S(40), Ui.S(34));
            btnTruoc.Click += (s, e) => DenTrang(xem.StartPage - 1);
            btnSau = Ui.MakeButton("▶", false);
            btnSau.MinimumSize = new Size(Ui.S(40), Ui.S(34));
            btnSau.Click += (s, e) => DenTrang(xem.StartPage + 1);
            lblTrang = Ui.MakeLabel("", Ui.Base, Ui.Text);
            var cboZoom = Ui.MakeCombo(130);
            cboZoom.Items.AddRange(new object[] { "Vừa trang", "Vừa bề ngang", "75%", "100%", "150%" });
            cboZoom.SelectedIndex = 0;
            cboZoom.SelectedIndexChanged += (s, e) => Zoom(cboZoom.SelectedIndex);
            var dong = Ui.MakeButton("Đóng", false);
            dong.Click += (s, e) => Close();
            foreach (Control c in new Control[] { btnTruoc, lblTrang, btnSau, cboZoom, dong })
                top.Controls.Add(c);
            foreach (Control c in top.Controls) if (!(c is Label)) c.Margin = Ui.Pad(0, 2, 8, 0);
            btnTruoc.Margin = Ui.Pad(16, 2, 4, 0);
            btnSau.Margin = Ui.Pad(4, 2, 8, 0);
            lblTrang.Margin = Ui.Pad(2, 9, 2, 0);

            xem = new PrintPreviewControl { Dock = DockStyle.Fill, Document = doc, AutoZoom = true, UseAntiAlias = true, BackColor = Color.FromArgb(0x9A, 0xA3, 0xAE) };
            Controls.Add(xem);
            Controls.Add(top);
            CancelButton = dong;

            doc.DocumentName = ten;
            doc.BeginPrint += (s, e) => { dangIn = 0; if (trang.Count == 0) DungTrang(); };
            doc.QueryPageSettings += (s, e) =>
            {
                BoQua();
                if (dangIn < trang.Count) e.PageSettings.Landscape = trang[dangIn].B.T.Ngang;   // mỗi bảng khổ ngang / dọc riêng
            };
            doc.PrintPage += VeTrang;
            DoiMayIn();
        }

        static Label Nhan(string text)
        {
            var l = Ui.MakeLabel(text, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(8, 9, 4, 0);
            return l;
        }

        void DoiMayIn()
        {
            string p = cboMay.SelectedItem as string;
            if (p != null) doc.PrinterSettings.PrinterName = p;
            PaperSize a4 = null;
            try { a4 = doc.PrinterSettings.PaperSizes.Cast<PaperSize>().FirstOrDefault(x => x.Kind == PaperKind.A4); }
            catch (Exception) { }
            if (a4 != null) doc.DefaultPageSettings.PaperSize = a4;
            doc.DefaultPageSettings.Margins = new Margins(Le.Left, Le.Right, Le.Top, Le.Bottom);
            LamMoi();
        }

        void TuyChon()
        {
            using (var dlg = new PrintDialog { Document = doc, UseEXDialog = true, AllowSomePages = true })
            {
                dlg.PrinterSettings.Copies = (short)numBan.Value;
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                if (cboMay.Items.Contains(dlg.PrinterSettings.PrinterName)) cboMay.SelectedItem = dlg.PrinterSettings.PrinterName;
                numBan.Value = Math.Max(1, Math.Min(99, (int)dlg.PrinterSettings.Copies));
                In(dlg.PrinterSettings.PrintRange == PrintRange.SomePages ? dlg.PrinterSettings.FromPage : 0,
                   dlg.PrinterSettings.PrintRange == PrintRange.SomePages ? dlg.PrinterSettings.ToPage : 0);
            }
        }

        void InNgay()
        {
            In(0, 0);
        }

        int inTu, inDen;

        void In(int tu, int den)
        {
            if (trang.Count == 0) return;
            try
            {
                doc.PrinterSettings.Copies = (short)numBan.Value;
                inTu = tu;
                inDen = den;
                Cursor = Cursors.WaitCursor;
                doc.PrintController = new StandardPrintController();   // không hiện hộp "Đang in trang…" che màn hình
                doc.Print();
                Ui.Info(this, "Đã gửi " + (tu > 0 ? "trang " + tu + "–" + Math.Min(den, trang.Count) : trang.Count + " trang") +
                              (numBan.Value > 1 ? " × " + numBan.Value + " bản" : "") + " tới máy in \"" + doc.PrinterSettings.PrinterName + "\".");
            }
            catch (Exception ex)
            {
                Ui.Error(this, "Không in được: " + ex.Message);
            }
            finally
            {
                inTu = inDen = 0;
                Cursor = Cursors.Default;
            }
        }

        /// <summary>In 1 số trang: bỏ qua các trang ngoài khoảng chọn.</summary>
        void BoQua()
        {
            while (inTu > 0 && dangIn < trang.Count && (dangIn + 1 < inTu || dangIn + 1 > inDen)) dangIn++;
        }

        void DungTrang()
        {
            PaperSize ps = doc.DefaultPageSettings.PaperSize;
            trang = ChiaTrang.Chia(so, ps.Width, ps.Height);
        }

        void VeTrang(object sender, PrintPageEventArgs e)
        {
            BoQua();
            if (dangIn >= trang.Count) { e.HasMorePages = false; return; }
            TrangGiay p = trang[dangIn];
            float trai = e.MarginBounds.Left * 0.72f, tren = e.MarginBounds.Top * 0.72f, rong = e.MarginBounds.Width * 0.72f;
            float day = e.MarginBounds.Bottom * 0.72f;
            if (!doc.PrintController.IsPreview)
            {
                // máy in thật: gốc toạ độ ở mép vùng in được (lề cứng), không phải mép giấy
                trai -= e.PageSettings.HardMarginX * 0.72f;
                tren -= e.PageSettings.HardMarginY * 0.72f;
                day -= e.PageSettings.HardMarginY * 0.72f;
            }
            ChiaTrang.Ve(e.Graphics, p, trai, tren, rong, day);
            dangIn++;
            int sau = dangIn;
            while (inTu > 0 && sau < trang.Count && (sau + 1 < inTu || sau + 1 > inDen)) sau++;
            e.HasMorePages = sau < trang.Count;
        }

        void LamMoi()
        {
            trang.Clear();
            DungTrang();
            xem.InvalidatePreview();
            xem.StartPage = 0;
            CapNhatTrang();
        }

        void DenTrang(int i)
        {
            if (i < 0 || i >= trang.Count) return;
            xem.StartPage = i;
            CapNhatTrang();
        }

        void CapNhatTrang()
        {
            int n = trang.Count;
            lblTrang.Text = "Trang " + (Math.Min(xem.StartPage, Math.Max(0, n - 1)) + 1) + "/" + n;
            btnTruoc.Enabled = xem.StartPage > 0;
            btnSau.Enabled = xem.StartPage < n - 1;
            btnIn.Text = n > 1 ? "In " + n + " trang" : "In";
        }

        void Zoom(int i)
        {
            switch (i)
            {
                case 0: xem.AutoZoom = true; break;
                case 1:
                    xem.AutoZoom = false;
                    if (trang.Count > 0)
                    {
                        PaperSize ps = doc.DefaultPageSettings.PaperSize;
                        float w = trang[Math.Min(xem.StartPage, trang.Count - 1)].B.T.Ngang ? ps.Height : ps.Width;
                        xem.Zoom = Math.Max(0.1, (xem.ClientSize.Width - Ui.S(40)) / (w / 100.0 * DpiManHinh()));
                    }
                    break;
                case 2: xem.AutoZoom = false; xem.Zoom = 0.75; break;
                case 3: xem.AutoZoom = false; xem.Zoom = 1.0; break;
                case 4: xem.AutoZoom = false; xem.Zoom = 1.5; break;
            }
        }

        double DpiManHinh()
        {
            using (Graphics g = CreateGraphics()) return g.DpiX;
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            switch (keyData)
            {
                case Keys.PageDown: case Keys.Right: DenTrang(xem.StartPage + 1); return true;
                case Keys.PageUp: case Keys.Left: DenTrang(xem.StartPage - 1); return true;
                case Keys.Control | Keys.P: InNgay(); return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) doc.Dispose();
            base.Dispose(disposing);
        }
    }
}
