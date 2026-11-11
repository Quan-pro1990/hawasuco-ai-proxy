using System.Drawing;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>Thẻ số tổng ở đầu trang.</summary>
    class TheSo : Control
    {
        public string Ten = "", GiaTri = "—", Phu = "";
        public bool Lon;
        public Color Vach = Color.Empty;

        public TheSo()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.ResizeRedraw, true);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Lon ? Ui.Primary : Ui.Surface);
            Color fg = Lon ? Color.White : Ui.Text, muted = Lon ? Color.FromArgb(0xD5, 0xE3, 0xF1) : Ui.Muted;
            if (!Lon) using (var pen = new Pen(Ui.Border)) g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
            if (!Lon && Vach != Color.Empty) using (var b = new SolidBrush(Vach)) g.FillRectangle(b, 0, 0, Ui.S(4), Height);
            int x = Ui.S(12);
            var flags = TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix;
            TextRenderer.DrawText(g, Ten, Ui.SmallBold, new Rectangle(x, Ui.S(6), Width - x - Ui.S(6), Ui.S(18)), muted, flags);
            TextRenderer.DrawText(g, GiaTri, Ui.CardNumber, new Rectangle(x - Ui.S(3), Ui.S(22), Width - x, Ui.S(30)), fg, flags);
            TextRenderer.DrawText(g, Phu, Ui.Small, new Rectangle(x, Height - Ui.S(22), Width - x - Ui.S(4), Ui.S(18)), muted, flags);
        }
    }
}
