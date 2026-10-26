using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ChinhAnhAI
{
    /// <summary>Màu (giao diện tối như các phần mềm chỉnh ảnh), phông chữ, tỉ lệ DPI và hàm dựng control dùng chung.</summary>
    static class Ui
    {
        public static readonly float Dpi;

        static Ui()
        {
            using (var g = Graphics.FromHwnd(IntPtr.Zero)) Dpi = g.DpiX / 96f;
        }

        public static int S(int px) { return (int)Math.Round(px * Dpi); }
        public static float S(float px) { return px * Dpi; }
        public static Padding Pad(int all) { return new Padding(S(all)); }
        public static Padding Pad(int left, int top, int right, int bottom) { return new Padding(S(left), S(top), S(right), S(bottom)); }

        public static readonly Color Nen = Color.FromArgb(0x17, 0x19, 0x1D);
        public static readonly Color Khung = Color.FromArgb(0x21, 0x24, 0x29);
        public static readonly Color Khung2 = Color.FromArgb(0x2A, 0x2E, 0x34);
        public static readonly Color Vien = Color.FromArgb(0x38, 0x3D, 0x45);
        public static readonly Color Chu = Color.FromArgb(0xE9, 0xEB, 0xEE);
        public static readonly Color ChuMo = Color.FromArgb(0x9A, 0xA1, 0xAB);
        public static readonly Color Nhan = Color.FromArgb(0x7C, 0x5C, 0xFF);        // tím chủ đạo
        public static readonly Color NhanDam = Color.FromArgb(0x66, 0x47, 0xE6);
        public static readonly Color Cam = Color.FromArgb(0xFF, 0x8A, 0x5B);         // cam của nút AI
        public static readonly Color Xanh = Color.FromArgb(0x3D, 0xD6, 0x8C);
        public static readonly Color Do = Color.FromArgb(0xFF, 0x6B, 0x6B);

        public static readonly Font Chuan = new Font("Segoe UI", 9.5f);
        public static readonly Font ChuanDam = new Font("Segoe UI Semibold", 9.5f);
        public static readonly Font Nho = new Font("Segoe UI", 8.5f);
        public static readonly Font NhoDam = new Font("Segoe UI Semibold", 8.5f);
        public static readonly Font TieuDe = new Font("Segoe UI Semibold", 12f);
        public static readonly Font Lon = new Font("Segoe UI Light", 16f);
        public static readonly Font Nut = new Font("Segoe UI Semibold", 9.5f);

        public static Button TaoNut(string chu, Color nen, EventHandler bam)
        {
            var b = new Button
            {
                Text = chu,
                FlatStyle = FlatStyle.Flat,
                BackColor = nen,
                ForeColor = Color.White,
                Font = Nut,
                AutoSize = true,
                AutoSizeMode = AutoSizeMode.GrowAndShrink,
                Padding = Pad(10, 4, 10, 4),
                Margin = Pad(0, 0, 6, 0),
                Cursor = Cursors.Hand,
                UseVisualStyleBackColor = false,
                TabStop = false,
            };
            b.FlatAppearance.BorderSize = 0;
            b.FlatAppearance.MouseOverBackColor = SangHon(nen, 0.12f);
            b.FlatAppearance.MouseDownBackColor = SangHon(nen, -0.1f);
            if (bam != null) b.Click += bam;
            return b;
        }

        public static Color SangHon(Color c, float k)
        {
            Func<int, int> f = v => Math.Max(0, Math.Min(255, (int)(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
            return Color.FromArgb(c.A, f(c.R), f(c.G), f(c.B));
        }

        public static GraphicsPath BoGoc(RectangleF r, float bk)
        {
            var p = new GraphicsPath();
            float d = Math.Min(bk * 2, Math.Min(r.Width, r.Height));
            if (d <= 0.5f) { p.AddRectangle(r); return p; }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        /// <summary>Biểu tượng phần mềm: ô bo góc chuyển tím → cam với ngôi sao lấp lánh.</summary>
        public static Bitmap Logo(int co)
        {
            var bmp = new Bitmap(co, co);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                var r = new RectangleF(0, 0, co - 1, co - 1);
                using (GraphicsPath p = BoGoc(r, co * 0.22f))
                using (var br = new LinearGradientBrush(r, Nhan, Cam, 45f))
                    g.FillPath(br, p);
                VeSao(g, co * 0.5f, co * 0.5f, co * 0.30f, Color.White);
                VeSao(g, co * 0.76f, co * 0.25f, co * 0.11f, Color.FromArgb(230, 255, 255, 255));
            }
            return bmp;
        }

        public static void VeSao(Graphics g, float cx, float cy, float r, Color mau)
        {
            var pts = new PointF[8];
            for (int i = 0; i < 8; i++)
            {
                double goc = Math.PI / 4 * i - Math.PI / 2;
                float rr = i % 2 == 0 ? r : r * 0.28f;
                pts[i] = new PointF(cx + (float)Math.Cos(goc) * rr, cy + (float)Math.Sin(goc) * rr);
            }
            using (var br = new SolidBrush(mau)) g.FillPolygon(br, pts);
        }
    }

    /// <summary>Thanh trượt vẽ tay: tên bên trái, giá trị bên phải, rãnh mảnh; nhấp đúp để trả về giá trị tự động.</summary>
    class ThanhTruot : Control
    {
        public string Ten = "";
        public double Min = -100, Max = 100;
        public int SoLe;
        public bool NenSac;            // rãnh cầu vồng cho thanh chọn sắc độ
        public Func<double, string> DinhDang;
        double giaTri;
        bool dangKeo;

        public event EventHandler DoiGiaTri;
        public event EventHandler DatLai;

        public ThanhTruot()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint |
                     ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
            Height = Ui.S(40);
            BackColor = Ui.Khung;
            Cursor = Cursors.Hand;
        }

        public double GiaTri
        {
            get { return giaTri; }
            set
            {
                double v = Math.Max(Min, Math.Min(Max, value));
                if (Math.Abs(v - giaTri) < 1e-9) return;
                giaTri = v;
                Invalidate();
            }
        }

        RectangleF Ranh
        {
            get
            {
                float le = Ui.S(6f);
                return new RectangleF(le, Height - Ui.S(12f), Width - 2 * le, Ui.S(4f));
            }
        }

        float ViTri(double v)
        {
            RectangleF r = Ranh;
            return r.X + (float)((v - Min) / (Max - Min)) * r.Width;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(BackColor);
            string chuGT = DinhDang != null ? DinhDang(giaTri) : giaTri.ToString(SoLe == 0 ? "0" : "0.00");
            if (DinhDang == null && Min < 0 && giaTri > 1e-9) chuGT = "+" + chuGT;
            TextRenderer.DrawText(g, Ten, Ui.Nho, new Point(Ui.S(2), Ui.S(2)), Focused ? Ui.Chu : Ui.ChuMo);
            Size kt = TextRenderer.MeasureText(chuGT, Ui.NhoDam);
            TextRenderer.DrawText(g, chuGT, Ui.NhoDam, new Point(Width - kt.Width - Ui.S(2), Ui.S(2)), Math.Abs(giaTri) > 1e-9 ? Ui.Chu : Ui.ChuMo);

            RectangleF r = Ranh;
            using (GraphicsPath p = Ui.BoGoc(r, r.Height / 2))
            {
                if (NenSac)
                {
                    using (var br = new LinearGradientBrush(r, Color.Red, Color.Red, 0f))
                    {
                        var cb = new ColorBlend(7);
                        cb.Colors = new[] { Color.Red, Color.Yellow, Color.Lime, Color.Cyan, Color.Blue, Color.Magenta, Color.Red };
                        cb.Positions = new[] { 0f, 1 / 6f, 2 / 6f, 3 / 6f, 4 / 6f, 5 / 6f, 1f };
                        br.InterpolationColors = cb;
                        g.FillPath(br, p);
                    }
                }
                else
                {
                    using (var br = new SolidBrush(Ui.Vien)) g.FillPath(br, p);
                    float x0 = ViTri(Min < 0 ? 0 : Min), x1 = ViTri(giaTri);
                    var dien = new RectangleF(Math.Min(x0, x1), r.Y, Math.Abs(x1 - x0), r.Height);
                    if (dien.Width > 0.5f)
                        using (var br = new SolidBrush(Ui.Nhan)) g.FillRectangle(br, dien);
                }
            }
            if (Min < 0 && !NenSac)
            {
                float x0 = ViTri(0);
                using (var pen = new Pen(Ui.ChuMo, 1)) g.DrawLine(pen, x0, r.Y - Ui.S(2f), x0, r.Bottom + Ui.S(2f));
            }
            float xc = ViTri(giaTri), cy = r.Y + r.Height / 2, bk = Ui.S(dangKeo ? 7f : 6f);
            using (var br = new SolidBrush(Color.White)) g.FillEllipse(br, xc - bk, cy - bk, 2 * bk, 2 * bk);
            using (var pen = new Pen(Ui.Nhan, Ui.S(2f))) g.DrawEllipse(pen, xc - bk, cy - bk, 2 * bk, 2 * bk);
        }

        void DatTheoChuot(int x)
        {
            RectangleF r = Ranh;
            double t = (x - r.X) / r.Width;
            double v = Min + Math.Max(0, Math.Min(1, t)) * (Max - Min);
            double buoc = SoLe == 0 ? 1 : 0.01;
            if ((ModifierKeys & Keys.Shift) == 0 && SoLe == 0) v = Math.Round(v / buoc) * buoc;
            else v = Math.Round(v, 2);
            if (Math.Abs(v - giaTri) < 1e-9) return;
            GiaTri = v;
            EventHandler h = DoiGiaTri;
            if (h != null) h(this, EventArgs.Empty);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            Focus();
            if (e.Button != MouseButtons.Left) return;
            dangKeo = true;
            DatTheoChuot(e.X);
            Invalidate();
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (dangKeo) DatTheoChuot(e.X);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            dangKeo = false;
            Invalidate();
        }

        protected override void OnDoubleClick(EventArgs e)
        {
            base.OnDoubleClick(e);
            EventHandler h = DatLai;
            if (h != null) h(this, EventArgs.Empty);
        }

        protected override bool IsInputKey(Keys k)
        {
            return k == Keys.Left || k == Keys.Right || base.IsInputKey(k);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            double buoc = SoLe == 0 ? 1 : 0.05;
            if (e.Shift) buoc *= 10;
            if (e.KeyCode == Keys.Left || e.KeyCode == Keys.Right)
            {
                GiaTri = Math.Round(giaTri + (e.KeyCode == Keys.Left ? -buoc : buoc), 2);
                EventHandler h = DoiGiaTri;
                if (h != null) h(this, EventArgs.Empty);
                e.Handled = true;
            }
        }

        protected override void OnGotFocus(EventArgs e) { base.OnGotFocus(e); Invalidate(); }
        protected override void OnLostFocus(EventArgs e) { base.OnLostFocus(e); Invalidate(); }
    }

    /// <summary>Ô phong cách: ảnh thu nhỏ đã áp phong cách + tên.</summary>
    class OPhongCach : Control
    {
        public string Ma;
        public string Ten = "";
        public string NhanPhu;        // chữ nhỏ trên góc (vd "AI")
        public Bitmap Anh;
        public string ChuKhiTrong = "";
        bool chon, tro;

        public OPhongCach()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
            Size = new Size(Ui.S(96), Ui.S(88));
            Margin = Ui.Pad(0, 0, 6, 6);
            Cursor = Cursors.Hand;
            BackColor = Ui.Khung;
        }

        public bool DuocChon
        {
            get { return chon; }
            set { if (chon != value) { chon = value; Invalidate(); } }
        }

        public void DatAnh(Bitmap b)
        {
            Bitmap cu = Anh;
            Anh = b;
            if (cu != null && cu != b) cu.Dispose();
            Invalidate();
        }

        protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); tro = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); tro = false; Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(BackColor);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            int chuCao = Ui.S(20);
            var o = new RectangleF(1, 1, Width - 3, Height - chuCao - 2);
            using (GraphicsPath p = Ui.BoGoc(o, Ui.S(6f)))
            {
                g.SetClip(p);
                if (Anh != null)
                {
                    // cắt giữa cho đầy ô
                    float k = Math.Max(o.Width / Anh.Width, o.Height / Anh.Height);
                    float w = Anh.Width * k, h = Anh.Height * k;
                    g.DrawImage(Anh, o.X + (o.Width - w) / 2, o.Y + (o.Height - h) / 2, w, h);
                }
                else
                {
                    using (var br = new SolidBrush(Ui.Khung2)) g.FillPath(br, p);
                    TextRenderer.DrawText(g, ChuKhiTrong, Ui.Nho, Rectangle.Round(o), Ui.ChuMo,
                        TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.WordBreak);
                }
                g.ResetClip();
                if (chon || tro)
                    using (var pen = new Pen(chon ? Ui.Nhan : Ui.ChuMo, Ui.S(chon ? 2.5f : 1f))) g.DrawPath(pen, p);
            }
            if (!string.IsNullOrEmpty(NhanPhu))
            {
                Size kt = TextRenderer.MeasureText(NhanPhu, Ui.NhoDam);
                var nr = new RectangleF(o.Right - kt.Width - Ui.S(6), o.Y + Ui.S(4), kt.Width + Ui.S(2), kt.Height);
                using (GraphicsPath p = Ui.BoGoc(nr, Ui.S(4f)))
                using (var br = new LinearGradientBrush(nr, Ui.Nhan, Ui.Cam, 0f))
                    g.FillPath(br, p);
                TextRenderer.DrawText(g, NhanPhu, Ui.NhoDam, Rectangle.Round(nr), Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }
            TextRenderer.DrawText(g, Ten, chon ? Ui.NhoDam : Ui.Nho, new Rectangle(0, Height - chuCao, Width, chuCao), chon ? Ui.Chu : Ui.ChuMo,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && Anh != null) { Anh.Dispose(); Anh = null; }
            base.Dispose(disposing);
        }
    }

    /// <summary>Vạch tiến trình mảnh chạy qua lại khi phần mềm đang bận.</summary>
    class VachBan : Control
    {
        readonly Timer dongHo = new Timer { Interval = 30 };
        float pha;
        bool ban;

        public VachBan()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
            Height = Ui.S(3);
            BackColor = Ui.Nen;
            dongHo.Tick += (s, e) => { pha = (pha + 0.018f) % 1.4f; Invalidate(); };
        }

        public bool Ban
        {
            get { return ban; }
            set { ban = value; dongHo.Enabled = value; Invalidate(); }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.Clear(BackColor);
            if (!ban) return;
            float w = Width * 0.3f, x = (pha - 0.2f) * Width;
            var r = new RectangleF(x, 0, w, Height);
            using (var br = new LinearGradientBrush(new RectangleF(x - 1, 0, w + 2, Height), Ui.Nhan, Ui.Cam, 0f))
                e.Graphics.FillRectangle(br, r);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) dongHo.Dispose();
            base.Dispose(disposing);
        }
    }
}
