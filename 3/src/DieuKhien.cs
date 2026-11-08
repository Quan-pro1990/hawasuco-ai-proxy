using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Mã ký tự biểu tượng (phông Segoe MDL2 Assets / Segoe Fluent Icons).</summary>
    static class Ic
    {
        public const string ManHinh = "\uE7F4", MayIn = "\uE749", SuaChua = "\uE90F", ThietBi = "\uE772", Usb = "\uE88E",
            VanBan = "\uE8A5", Apps = "\uE71D", KhoiPhuc = "\uE777", Khoa = "\uE72E", Quyen = "\uE8D7",
            CaiDat = "\uE713", LamMoi = "\uE72C", Them = "\uE710", Xoa = "\uE74D", Luu = "\uE74E", ThuMuc = "\uE8B7",
            TaiVe = "\uE896", TaiLen = "\uE898", ChepLai = "\uE8C8", Mang = "\uE839", Wifi = "\uE701", NguoiDung = "\uE77B",
            NhieuNguoi = "\uE716", Khien = "\uEA18", CanhBao = "\uE7BA", Loi = "\uE783", ThongTin = "\uE946", Dung = "\uE73E",
            Huy = "\uE711", MatTroi = "\uE706", Dem = "\uE708", DongHo = "\uE823", XuLy = "\uE9F5", Chay = "\uE768",
            Lenh = "\uE756", Nguon = "\uE7E8", Admin = "\uE7EF", O = "\uEDA2", Link = "\uE71B", TimKiem = "\uE721",
            ChiaSe = "\uE72D", MoKhoa = "\uE785", ChanDoan = "\uE9D9", Nhom = "\uE902", MuiTenPhai = "\uE76C",
            Hen = "\uE81C", Menu = "\uE700", BieuDo = "\uE9D2", Sao = "\uE734", TaiLieu = "\uE7C3", Quet = "\uE8FE", Chot = "\uE718";
    }

    /// <summary>Nút bo góc tự vẽ: nền đậm, nền nhạt hoặc viền; có biểu tượng.</summary>
    public class NutBo : Control, IButtonControl
    {
        Tone tone;
        bool dac, vienNgoai, chon, khongBam, canTrai;
        string icon;
        bool hover, nhan;
        public int BanKinh = 8;

        public NutBo(string text, string icon, Tone tone, bool dac)
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.UserPaint | ControlStyles.Selectable | ControlStyles.StandardClick, true);
            Text = text;
            this.icon = icon;
            this.tone = tone;
            this.dac = dac;
            Font = Ui.FontNut;
            Cursor = Cursors.Hand;
            TabStop = true;
            Size = new Size(Ui.S(150), Ui.S(38));
            Margin = Ui.Pad(4);
        }

        /// <summary>Nút phụ: nền thẻ, viền xám.</summary>
        public static NutBo Phu(string text, string icon)
        {
            var b = new NutBo(text, icon, Tone.Xanh, false);
            b.vienNgoai = true;
            return b;
        }

        /// <summary>Viên nhãn chỉ để hiển thị (không bấm được).</summary>
        public static NutBo VienNhan(string text, string icon, Tone tone, bool dac)
        {
            var b = new NutBo(text, icon, tone, dac);
            b.KhongBam = true;
            b.BanKinh = 16;
            return b;
        }

        public Tone Tone { get { return tone; } set { tone = value; Invalidate(); } }
        public bool Dac { get { return dac; } set { dac = value; Invalidate(); } }
        public bool VienNgoai { get { return vienNgoai; } set { vienNgoai = value; Invalidate(); } }
        public bool Chon { get { return chon; } set { chon = value; Invalidate(); } }
        public bool CanTrai { get { return canTrai; } set { canTrai = value; Invalidate(); } }
        public string Icon { get { return icon; } set { icon = value; Invalidate(); } }

        public bool KhongBam
        {
            get { return khongBam; }
            set
            {
                khongBam = value;
                Cursor = value ? Cursors.Default : Cursors.Hand;
                TabStop = !value;
                SetStyle(ControlStyles.Selectable, !value);
            }
        }

        public DialogResult DialogResult { get; set; }
        public void NotifyDefault(bool value) { }

        public void PerformClick()
        {
            if (Enabled && !khongBam) OnClick(EventArgs.Empty);
        }

        protected override void OnClick(EventArgs e)
        {
            if (khongBam) return;
            Form f = FindForm();
            if (f != null && DialogResult != DialogResult.None) f.DialogResult = DialogResult;
            base.OnClick(e);
        }

        protected override bool IsInputKey(Keys keyData)
        {
            return keyData == Keys.Enter || keyData == Keys.Space || base.IsInputKey(keyData);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space)
            {
                e.Handled = true;
                PerformClick();
            }
        }

        protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); hover = false; nhan = false; Invalidate(); }
        protected override void OnMouseDown(MouseEventArgs e) { base.OnMouseDown(e); if (e.Button == MouseButtons.Left && !khongBam) { nhan = true; Invalidate(); } }
        protected override void OnMouseUp(MouseEventArgs e) { base.OnMouseUp(e); nhan = false; Invalidate(); }
        protected override void OnGotFocus(EventArgs e) { base.OnGotFocus(e); Invalidate(); }
        protected override void OnLostFocus(EventArgs e) { base.OnLostFocus(e); Invalidate(); }
        protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Invalidate(); }

        protected override void OnTextChanged(EventArgs e)
        {
            base.OnTextChanged(e);
            if (AutoSize) Size = GetPreferredSize(Size.Empty);
            Invalidate();
        }

        int IconW(Graphics g)
        {
            if (string.IsNullOrEmpty(icon) || Ui.FontIcon == null) return 0;
            Size s = g != null
                ? TextRenderer.MeasureText(g, icon, Ui.IconNut, new Size(999, 999), TextFormatFlags.NoPadding)
                : TextRenderer.MeasureText(icon, Ui.IconNut, new Size(999, 999), TextFormatFlags.NoPadding);
            return s.Width + (string.IsNullOrEmpty(Text) ? 0 : Ui.S(8));
        }

        int Le { get { return string.IsNullOrEmpty(Text) ? Ui.S(10) : Ui.S(14); } }

        public override Size GetPreferredSize(Size proposedSize)
        {
            int iconW = IconW(null);
            Size t = string.IsNullOrEmpty(Text) ? Size.Empty
                : TextRenderer.MeasureText(Text, Font, new Size(int.MaxValue, int.MaxValue), TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
            int w = Le * 2 + iconW + t.Width;
            int h = Math.Max(Ui.S(36), t.Height + Ui.S(16));
            if (proposedSize.Width > 1 && proposedSize.Width < w && proposedSize.Width < 100000 && !string.IsNullOrEmpty(Text))
            {
                int conLai = Math.Max(Ui.S(40), proposedSize.Width - Le * 2 - iconW);
                Size tw = TextRenderer.MeasureText(Text, Font, new Size(conLai, int.MaxValue), TextFormatFlags.NoPrefix | TextFormatFlags.WordBreak);
                h = Math.Max(h, tw.Height + Ui.S(16));
                w = proposedSize.Width;
            }
            return new Size(w, h);
        }

        void LayMau(out Color nen, out Color chu, out Color vien)
        {
            vien = Color.Empty;
            MauTone m = Ui.Mau(tone);
            if (!Enabled)
            {
                nen = Ui.The2; chu = Ui.ChuPhu; vien = Ui.Vien;
                return;
            }
            if (vienNgoai && !chon)
            {
                nen = nhan ? Ui.Chon : hover ? Ui.The2 : Ui.The;
                chu = Ui.Chu;
                vien = hover ? m.Dac : Ui.Vien;
                return;
            }
            if (dac || chon)
            {
                nen = m.Dac;
                chu = Color.White;
                if (hover && !khongBam) nen = Ui.Tron(m.Dac, Color.Black, 0.12f);
                if (nhan) nen = Ui.Tron(m.Dac, Color.Black, 0.24f);
                return;
            }
            nen = m.Nhat;
            chu = m.ChuNhat;
            if (hover && !khongBam) nen = Ui.Tron(m.Nhat, m.Dac, 0.14f);
            if (nhan) nen = Ui.Tron(m.Nhat, m.Dac, 0.26f);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : Ui.Nen);
            Color nen, chu, vien;
            LayMau(out nen, out chu, out vien);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            using (GraphicsPath p = Ui.HinhBo(r, Ui.S(BanKinh)))
            {
                using (var b = new SolidBrush(nen)) g.FillPath(b, p);
                if (vien != Color.Empty) using (var pen = new Pen(vien)) g.DrawPath(pen, p);
            }
            if (Focused && ShowFocusCues && !khongBam)
            {
                var rf = new RectangleF(2.5f, 2.5f, Width - 6f, Height - 6f);
                using (GraphicsPath p = Ui.HinhBo(rf, Math.Max(2, Ui.S(BanKinh) - 2)))
                using (var pen = new Pen(Color.FromArgb(170, chu)) { DashStyle = DashStyle.Dot })
                    g.DrawPath(pen, p);
            }
            g.SmoothingMode = SmoothingMode.None;

            int iconW = IconW(g);
            int conLai = Math.Max(1, Width - Le * 2 - iconW);
            Size ts = string.IsNullOrEmpty(Text) ? Size.Empty
                : TextRenderer.MeasureText(g, Text, Font, new Size(conLai, int.MaxValue), TextFormatFlags.NoPrefix | TextFormatFlags.WordBreak);
            int tw = Math.Min(conLai, ts.Width + Ui.S(2));
            int x0 = canTrai ? Le : Math.Max(Le / 2, (Width - iconW - tw) / 2);
            if (iconW > 0)
                TextRenderer.DrawText(g, icon, Ui.IconNut, new Rectangle(x0, 0, iconW + Ui.S(2), Height), chu,
                    TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.NoPadding);
            if (!string.IsNullOrEmpty(Text))
                TextRenderer.DrawText(g, Text, Font, new Rectangle(x0 + iconW, 0, tw, Height), chu,
                    TextFormatFlags.NoPrefix | TextFormatFlags.WordBreak | TextFormatFlags.VerticalCenter |
                    (canTrai ? TextFormatFlags.Left : TextFormatFlags.HorizontalCenter) | TextFormatFlags.EndEllipsis);
        }
    }

    /// <summary>Thẻ nội dung bo góc, viền mảnh. Con bên trong thừa hưởng màu nền thẻ.</summary>
    public class TheBo : Panel
    {
        public int BanKinh = 12;
        public Color MauVien = Color.Empty;

        public TheBo()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.UserPaint, true);
            BackColor = Ui.The;
            Padding = Ui.Pad(16, 12, 16, 14);
        }

        /// <summary>Thẻ tự cao theo nội dung (xếp Dock = Top bên trong).</summary>
        public static TheBo TuCao()
        {
            var t = new TheBo();
            t.AutoSize = true;
            t.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            return t;
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : Ui.Nen);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            using (GraphicsPath p = Ui.HinhBo(r, Ui.S(BanKinh)))
            {
                using (var b = new SolidBrush(BackColor)) g.FillPath(b, p);
                using (var pen = new Pen(MauVien.IsEmpty ? Ui.Vien : MauVien)) g.DrawPath(pen, p);
            }
        }
    }

    /// <summary>Tiêu đề thẻ: biểu tượng màu + chữ đậm.</summary>
    public class TieuDe : Control
    {
        public string Icon;
        public Tone Tone;

        public TieuDe(string text, string icon, Tone tone)
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.UserPaint, true);
            Text = text;
            Icon = icon;
            Tone = tone;
            Font = Ui.TieuDeThe;
            Height = Ui.S(32);
        }

        protected override void OnTextChanged(EventArgs e) { base.OnTextChanged(e); Invalidate(); }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : Ui.The);
            int x = 0;
            if (!string.IsNullOrEmpty(Icon) && Ui.FontIcon != null)
            {
                Color mau = Ui.Mau(Tone).Dac;
                TextRenderer.DrawText(g, Icon, Ui.IconVua, new Rectangle(0, 0, Ui.S(26), Height), mau,
                    TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.NoPadding);
                x = Ui.S(28);
            }
            TextRenderer.DrawText(g, Text, Font, new Rectangle(x, 0, Width - x, Height), Ui.Chu,
                TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis);
        }
    }

    /// <summary>Đoạn chữ tự xuống dòng theo chiều ngang, tự tính chiều cao (dùng với Dock = Top).</summary>
    public class DoanVan : Label
    {
        public DoanVan(string text) : this(text, Ui.ChuPhu, Ui.Base) { }

        public DoanVan(string text, Color mau, Font font)
        {
            AutoSize = false;
            UseMnemonic = false;
            Text = text;
            ForeColor = mau;
            Font = font;
            Padding = new Padding(0, Ui.S(2), 0, Ui.S(4));
            Height = Ui.S(24);
        }

        protected override void OnSizeChanged(EventArgs e) { base.OnSizeChanged(e); TinhCao(); }
        protected override void OnTextChanged(EventArgs e) { base.OnTextChanged(e); TinhCao(); }
        protected override void OnFontChanged(EventArgs e) { base.OnFontChanged(e); TinhCao(); }

        void TinhCao()
        {
            if (Width <= 4) return;
            int h = TextRenderer.MeasureText(Text ?? "", Font, new Size(Width - Padding.Horizontal - 2, int.MaxValue),
                TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix | TextFormatFlags.TextBoxControl).Height + Padding.Vertical;
            if (h != Height) Height = h;
        }
    }

    /// <summary>Khung ghi chú nền màu (lưu ý quan trọng, cảnh báo).</summary>
    public class GhiChu : TheBo
    {
        public GhiChu(string text, Tone tone)
        {
            MauTone m = Ui.Mau(tone);
            BackColor = tone == Tone.Vang ? Ui.CanhNen : m.Nhat;
            MauVien = Ui.Tron(m.Nhat, m.Dac, 0.35f);
            AutoSize = true;
            AutoSizeMode = AutoSizeMode.GrowAndShrink;
            Padding = Ui.Pad(14, 8, 14, 8);
            var dv = new DoanVan(text, tone == Tone.Vang ? Ui.CanhChu : m.ChuNhat, Ui.Base);
            Ui.ThemDuoi(this, dv);
        }
    }

    /// <summary>Mục menu bên trái: biểu tượng trong vòng tròn màu + tên trang.</summary>
    public class MucNav : Control
    {
        public string Icon;
        public Tone Tone;
        bool chon, hover;

        public MucNav(string text, string icon, Tone tone)
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.UserPaint | ControlStyles.Selectable | ControlStyles.StandardClick, true);
            Text = text;
            Icon = icon;
            Tone = tone;
            Font = Ui.FontNav;
            Height = Ui.S(44);
            Cursor = Cursors.Hand;
            TabStop = true;
            Margin = new Padding(0, 0, 0, Ui.S(2));
        }

        public bool Chon { get { return chon; } set { chon = value; Invalidate(); } }

        protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); hover = true; Invalidate(); }
        protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); hover = false; Invalidate(); }
        protected override void OnGotFocus(EventArgs e) { base.OnGotFocus(e); Invalidate(); }
        protected override void OnLostFocus(EventArgs e) { base.OnLostFocus(e); Invalidate(); }
        protected override bool IsInputKey(Keys k) { return k == Keys.Enter || k == Keys.Space || base.IsInputKey(k); }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) { e.Handled = true; OnClick(EventArgs.Empty); }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : Ui.The);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            MauTone m = Ui.Mau(Tone);
            var r = new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f);
            if (chon || hover)
            {
                using (GraphicsPath p = Ui.HinhBo(r, Ui.S(10)))
                {
                    using (var b = new SolidBrush(chon ? Ui.ChinhNhat : Ui.The2)) g.FillPath(b, p);
                    if (chon) using (var pen = new Pen(Ui.Tron(Ui.ChinhNhat, Ui.Chinh, 0.45f))) g.DrawPath(pen, p);
                }
            }
            if (Focused && ShowFocusCues)
            {
                using (GraphicsPath p = Ui.HinhBo(new RectangleF(2.5f, 2.5f, Width - 6f, Height - 6f), Ui.S(8)))
                using (var pen = new Pen(Ui.Chinh) { DashStyle = DashStyle.Dot }) g.DrawPath(pen, p);
            }
            int d = Ui.S(30);
            int x = Ui.S(8), y = (Height - d) / 2;
            using (var b = new SolidBrush(chon ? m.Dac : m.Nhat)) g.FillEllipse(b, x, y, d, d);
            g.SmoothingMode = SmoothingMode.None;
            if (Ui.FontIcon != null && !string.IsNullOrEmpty(Icon))
                TextRenderer.DrawText(g, Icon, Ui.IconNut, new Rectangle(x, y, d, d), chon ? Color.White : m.ChuNhat,
                    TextFormatFlags.NoPrefix | TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            int tx = x + d + Ui.S(10);
            int phai = chon ? Ui.S(24) : Ui.S(6);
            TextRenderer.DrawText(g, Text, chon ? Ui.FontNavDam : Ui.FontNav, new Rectangle(tx, 0, Width - tx - phai, Height),
                chon ? Ui.ChuChinh : Ui.Chu, TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis);
            if (chon && Ui.FontIcon != null)
                TextRenderer.DrawText(g, Ic.MuiTenPhai, Ui.IconNho, new Rectangle(Width - Ui.S(24), 0, Ui.S(18), Height), Ui.ChuChinh,
                    TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter);
        }
    }

    /// <summary>Hình mô phỏng hộp thoại lỗi của Windows để người dùng nhận ra đúng lỗi đang gặp.</summary>
    public class HopLoiMau : Control
    {
        public string TieuDeCuaSo;
        public string NoiDung;

        public HopLoiMau(string tieuDe, string noiDung)
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.UserPaint, true);
            TieuDeCuaSo = tieuDe;
            NoiDung = noiDung;
            Height = Ui.S(120);
            Cursor = Cursors.Hand;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : Ui.The);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            float k = Math.Max(0.55f, Math.Min(Width / 360f, Height / 150f));
            float w = Math.Min(Width - 8, 360 * k), h = Height - 8;
            float x0 = (Width - w) / 2, y0 = 3;
            var khung = new RectangleF(x0, y0, w, h);
            using (var bong = new SolidBrush(Color.FromArgb(Ui.Toi ? 90 : 30, 0, 0, 0)))
                g.FillRectangle(bong, x0 + 3, y0 + 3, w, h);
            using (var b = new SolidBrush(Color.White)) g.FillRectangle(b, khung);
            float thanhTieuDe = 20 * k, chan = 28 * k;
            using (var b = new SolidBrush(Color.FromArgb(0xF3, 0xF3, 0xF3))) g.FillRectangle(b, x0, y0 + h - chan, w, chan);
            using (var pen = new Pen(Color.FromArgb(0xB8, 0xB8, 0xB8))) g.DrawRectangle(pen, x0, y0, w, h);

            using (var f = new Font("Segoe UI", Math.Max(5f, 7.5f * k), GraphicsUnit.Pixel))
            using (var den = new SolidBrush(Color.FromArgb(0x20, 0x20, 0x20)))
            {
                g.DrawString(TieuDeCuaSo ?? "", f, den, new RectangleF(x0 + 8 * k, y0 + 4 * k, w - 30 * k, thanhTieuDe), StringFormat.GenericTypographic);
                g.DrawString("✕", f, den, x0 + w - 16 * k, y0 + 4 * k);
            }
            float d = 22 * k, cx = x0 + 12 * k, cy = y0 + thanhTieuDe + 10 * k;
            using (var b = new SolidBrush(Color.FromArgb(0xD9, 0x30, 0x25))) g.FillEllipse(b, cx, cy, d, d);
            using (var pen = new Pen(Color.White, Math.Max(1.2f, 2.2f * k)))
            {
                float a = d * 0.3f;
                g.DrawLine(pen, cx + a, cy + a, cx + d - a, cy + d - a);
                g.DrawLine(pen, cx + d - a, cy + a, cx + a, cy + d - a);
            }
            float tx = cx + d + 10 * k;
            using (var f = new Font("Segoe UI", Math.Max(5f, 8.5f * k), GraphicsUnit.Pixel))
            using (var den = new SolidBrush(Color.FromArgb(0x1F, 0x1F, 0x1F)))
                g.DrawString(NoiDung ?? "", f, den, new RectangleF(tx, cy - 1, x0 + w - tx - 8 * k, h - thanhTieuDe - chan - 12 * k));
            var ok = new RectangleF(x0 + w - 62 * k, y0 + h - chan + 5 * k, 52 * k, chan - 10 * k);
            using (var b = new SolidBrush(Color.FromArgb(0xFD, 0xFD, 0xFD))) g.FillRectangle(b, ok);
            using (var pen = new Pen(Color.FromArgb(0x00, 0x67, 0xC0), Math.Max(1f, 1.5f * k))) g.DrawRectangle(pen, ok.X, ok.Y, ok.Width, ok.Height);
            using (var f = new Font("Segoe UI", Math.Max(5f, 8f * k), GraphicsUnit.Pixel))
            using (var den = new SolidBrush(Color.Black))
            using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                g.DrawString("OK", f, den, ok, sf);
        }
    }

    /// <summary>Hàng nút chuyển tab + vùng nội dung của tab đang chọn.</summary>
    public class ThanhTab : Panel
    {
        readonly TableLayoutPanel hang;
        readonly Panel than;
        readonly List<NutBo> nut = new List<NutBo>();
        readonly List<Control> noiDung = new List<Control>();
        public int DangChon = -1;
        public event EventHandler DoiTab;

        public ThanhTab()
        {
            hang = new TableLayoutPanel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, RowCount = 1, Margin = new Padding(0) };
            hang.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            than = new Panel();
            Ui.ThemDuoi(this, hang);
            Ui.ThemDuoi(this, Ui.Khoang(8));
            Ui.ThemFill(this, than);
        }

        public void Them(string ten, string icon, Control trang)
        {
            int i = nut.Count;
            NutBo b = NutBo.Phu(ten, icon);
            b.Dock = DockStyle.Fill;
            b.Margin = Ui.Pad(0, 0, 8, 0);
            b.Click += (s, e) => Chon(i);
            nut.Add(b);
            trang.Dock = DockStyle.Fill;
            trang.Visible = false;
            noiDung.Add(trang);
            than.Controls.Add(trang);
            hang.ColumnCount = nut.Count;
            hang.ColumnStyles.Clear();
            for (int j = 0; j < nut.Count; j++) hang.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f / nut.Count));
            hang.Controls.Add(b, i, 0);
        }

        public void Chon(int i)
        {
            if (i < 0 || i >= nut.Count) return;
            DangChon = i;
            for (int j = 0; j < nut.Count; j++)
            {
                nut[j].Chon = j == i;
                noiDung[j].Visible = j == i;
            }
            EventHandler h = DoiTab;
            if (h != null) h(this, EventArgs.Empty);
        }

        public Control TrangDangChon { get { return DangChon >= 0 ? noiDung[DangChon] : null; } }
    }

    /// <summary>Logo phần mềm vẽ bằng mã (không cần tệp ảnh).</summary>
    static class Logo
    {
        public static Bitmap Ve(int kt)
        {
            var bmp = new Bitmap(kt, kt);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
                var r = new RectangleF(0, 0, kt - 1, kt - 1);
                using (GraphicsPath p = Ui.HinhBo(r, kt * 0.24f))
                using (var b = new LinearGradientBrush(r, Color.FromArgb(0x1D, 0x6F, 0xD8), Color.FromArgb(0x7C, 0x3A, 0xED), 45f))
                    g.FillPath(b, p);
                using (var f = new Font("Segoe UI", kt * 0.40f, FontStyle.Bold, GraphicsUnit.Pixel))
                using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                    g.DrawString("IT", f, Brushes.White, new RectangleF(0, -kt * 0.02f, kt, kt), sf);
                using (var b = new SolidBrush(Color.FromArgb(0xFF, 0xC1, 0x07)))
                    g.FillEllipse(b, kt * 0.70f, kt * 0.10f, kt * 0.16f, kt * 0.16f);
            }
            return bmp;
        }
    }

    /// <summary>
    /// Chia N cột ngang nhau (dùng với Dock = Top trong trang cuộn). Mỗi cột là Panel, con bên trong xếp Dock = Top;
    /// chiều cao khung = cột cao nhất (tự tính lại khi nội dung đổi cao).
    /// </summary>
    public class NhieuCot : Panel
    {
        public readonly Panel[] Cot;
        bool dangXep;

        public NhieuCot(int soCot)
        {
            // tạo đủ các cột rồi mới thêm vào: Controls.Add gọi bố cục ngay, lúc đó mọi cột phải có sẵn
            Cot = new Panel[soCot];
            for (int i = 0; i < soCot; i++)
            {
                var c = new Panel();
                c.ControlAdded += (s, e) => e.Control.SizeChanged += (s2, e2) => { if (!dangXep) PerformLayout(); };
                Cot[i] = c;
            }
            Controls.AddRange(Cot);
        }

        /// <summary>Thêm control vào cuối cột i (cách nhau 12px).</summary>
        public T Them<T>(int i, T c) where T : Control
        {
            if (Cot[i].Controls.Count > 0) Ui.ThemDuoi(Cot[i], Ui.Khoang(12));
            return Ui.ThemDuoi(Cot[i], c);
        }

        protected override void OnLayout(LayoutEventArgs e)
        {
            if (dangXep) return;
            dangXep = true;
            try
            {
                int n = Cot.Length, khe = Ui.S(12);
                int w = Math.Max(Ui.S(120), (ClientSize.Width - khe * (n - 1)) / n);
                int cao = 0;
                for (int i = 0; i < n; i++)
                {
                    Panel c = Cot[i];
                    if (c == null) continue;
                    c.SetBounds(i * (w + khe), 0, w, Math.Max(c.Height, 1));
                    c.PerformLayout();
                    int h = 0;
                    foreach (Control con in c.Controls) if (con.Visible) h = Math.Max(h, con.Bottom);
                    h += c.Padding.Bottom;
                    if (c.Height != h) c.Height = h;
                    cao = Math.Max(cao, h);
                }
                if (Height != cao) Height = cao;
            }
            finally
            {
                dangXep = false;
            }
        }
    }
}
