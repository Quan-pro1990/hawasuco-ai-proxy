using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ChinhAnhAI
{
    /// <summary>
    /// Khung xem ảnh: vừa khít khung, nhấn giữ chuột để xem ảnh gốc, chế độ so sánh có vạch chia kéo được.
    /// Ảnh được thu sẵn về đúng cỡ hiển thị nên kéo vạch chia vẫn mượt với ảnh lớn.
    /// </summary>
    class KhungAnh : Control
    {
        Bitmap truoc, sau;
        Bitmap hienTruoc, hienSau;   // bản đã thu về cỡ hiển thị
        Rectangle vung;
        bool soSanh, giuXemGoc, keoChia;
        float chia = 0.5f;
        public string ChuKhiTrong = "Kéo thả ảnh vào đây\nhoặc bấm  Mở ảnh  (Ctrl+O)";
        public string ThongBao;      // chữ nổi giữa ảnh khi đang xử lý

        public KhungAnh()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint |
                     ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
            BackColor = Ui.Nen;
        }

        public bool CoAnh { get { return sau != null || truoc != null; } }

        public bool SoSanh
        {
            get { return soSanh; }
            set { soSanh = value; Cursor = value ? Cursors.SizeWE : Cursors.Default; Invalidate(); }
        }

        /// <summary>Đặt ảnh gốc (khi mở ảnh mới). Khung giữ bitmap và tự giải phóng khi thay.</summary>
        public void DatAnhTruoc(Bitmap b)
        {
            if (truoc != null && truoc != b) truoc.Dispose();
            truoc = b;
            ThuVeCo();
            Invalidate();
        }

        public void DatAnhSau(Bitmap b)
        {
            if (sau != null && sau != b) sau.Dispose();
            sau = b;
            ThuVeCo();
            Invalidate();
        }

        public void XoaAnh()
        {
            DatAnhTruoc(null);
            DatAnhSau(null);
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            ThuVeCo();
        }

        void ThuVeCo()
        {
            if (hienTruoc != null) { hienTruoc.Dispose(); hienTruoc = null; }
            if (hienSau != null) { hienSau.Dispose(); hienSau = null; }
            Bitmap mau = sau ?? truoc;
            if (mau == null || Width < 10 || Height < 10) return;
            int le = Ui.S(16);
            float k = Math.Min((float)(Width - 2 * le) / mau.Width, (float)(Height - 2 * le) / mau.Height);
            k = Math.Min(k, 1f * Ui.Dpi);
            int w = Math.Max(1, (int)(mau.Width * k)), h = Math.Max(1, (int)(mau.Height * k));
            vung = new Rectangle((Width - w) / 2, (Height - h) / 2, w, h);
            hienTruoc = ThuNho(truoc, w, h);
            hienSau = ThuNho(sau, w, h);
        }

        static Bitmap ThuNho(Bitmap b, int w, int h)
        {
            if (b == null) return null;
            var kq = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format32bppPArgb);
            using (Graphics g = Graphics.FromImage(kq))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.DrawImage(b, new Rectangle(0, 0, w, h));
            }
            return kq;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(BackColor);
            Bitmap hs = hienSau ?? hienTruoc, ht = hienTruoc ?? hienSau;
            if (hs == null)
            {
                VeTrong(g);
                return;
            }
            if (giuXemGoc && !soSanh)
            {
                g.DrawImage(ht, vung);
                VeNhan(g, "ẢNH GỐC", vung.X + Ui.S(10), vung.Y + Ui.S(10));
            }
            else
            {
                g.DrawImage(hs, vung);
                if (soSanh)
                {
                    int xc = vung.X + (int)(vung.Width * chia);
                    g.SetClip(new Rectangle(vung.X, vung.Y, xc - vung.X, vung.Height));
                    g.DrawImage(ht, vung);
                    g.ResetClip();
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    using (var pen = new Pen(Color.White, Ui.S(2f))) g.DrawLine(pen, xc, vung.Y, xc, vung.Bottom);
                    float bk = Ui.S(14f), cy = vung.Y + vung.Height / 2f;
                    using (var br = new SolidBrush(Color.White)) g.FillEllipse(br, xc - bk, cy - bk, 2 * bk, 2 * bk);
                    using (var br = new SolidBrush(Ui.Nen))
                    {
                        float a = Ui.S(5f);
                        g.FillPolygon(br, new[] { new PointF(xc - a * 1.8f, cy), new PointF(xc - a * 0.5f, cy - a), new PointF(xc - a * 0.5f, cy + a) });
                        g.FillPolygon(br, new[] { new PointF(xc + a * 1.8f, cy), new PointF(xc + a * 0.5f, cy - a), new PointF(xc + a * 0.5f, cy + a) });
                    }
                    VeNhan(g, "TRƯỚC", vung.X + Ui.S(10), vung.Y + Ui.S(10));
                    Size kt = TextRenderer.MeasureText("SAU", Ui.NhoDam);
                    VeNhan(g, "SAU", vung.Right - kt.Width - Ui.S(22), vung.Y + Ui.S(10));
                }
            }
            if (!string.IsNullOrEmpty(ThongBao))
            {
                Size kt = TextRenderer.MeasureText(ThongBao, Ui.ChuanDam);
                var r = new Rectangle(vung.X + (vung.Width - kt.Width) / 2 - Ui.S(14), vung.Bottom - kt.Height - Ui.S(30), kt.Width + Ui.S(28), kt.Height + Ui.S(12));
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath p = Ui.BoGoc(r, r.Height / 2f))
                using (var br = new SolidBrush(Color.FromArgb(210, 20, 22, 26)))
                    g.FillPath(br, p);
                TextRenderer.DrawText(g, ThongBao, Ui.ChuanDam, r, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }
        }

        void VeNhan(Graphics g, string chu, int x, int y)
        {
            Size kt = TextRenderer.MeasureText(chu, Ui.NhoDam);
            var r = new Rectangle(x, y, kt.Width + Ui.S(12), kt.Height + Ui.S(6));
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (GraphicsPath p = Ui.BoGoc(r, Ui.S(4f)))
            using (var br = new SolidBrush(Color.FromArgb(170, 0, 0, 0)))
                g.FillPath(br, p);
            TextRenderer.DrawText(g, chu, Ui.NhoDam, r, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }

        void VeTrong(Graphics g)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            int w = Math.Min(Width - Ui.S(40), Ui.S(420)), h = Ui.S(220);
            var r = new Rectangle((Width - w) / 2, (Height - h) / 2, w, h);
            using (GraphicsPath p = Ui.BoGoc(r, Ui.S(14f)))
            using (var pen = new Pen(Ui.Vien, Ui.S(2f)) { DashStyle = DashStyle.Dash })
                g.DrawPath(pen, p);
            using (Bitmap logo = Ui.Logo(Ui.S(56))) g.DrawImage(logo, r.X + (r.Width - logo.Width) / 2, r.Y + Ui.S(28), logo.Width, logo.Height);
            TextRenderer.DrawText(g, ChuKhiTrong, Ui.Chuan, new Rectangle(r.X, r.Y + Ui.S(96), r.Width, r.Height - Ui.S(100)), Ui.ChuMo,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            Focus();
            if (e.Button != MouseButtons.Left || !CoAnh) return;
            if (soSanh) { keoChia = true; DatChia(e.X); }
            else { giuXemGoc = true; Invalidate(); }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (keoChia) DatChia(e.X);
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            keoChia = false;
            if (giuXemGoc) { giuXemGoc = false; Invalidate(); }
        }

        /// <summary>Phím cách (Space) giữ để xem ảnh gốc — gọi từ form.</summary>
        public void XemGoc(bool bat)
        {
            if (giuXemGoc == bat) return;
            giuXemGoc = bat;
            Invalidate();
        }

        void DatChia(int x)
        {
            if (vung.Width <= 0) return;
            chia = Math.Max(0f, Math.Min(1f, (float)(x - vung.X) / vung.Width));
            Invalidate();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                foreach (Bitmap b in new[] { truoc, sau, hienTruoc, hienSau }) if (b != null) b.Dispose();
                truoc = sau = hienTruoc = hienSau = null;
            }
            base.Dispose(disposing);
        }
    }
}
