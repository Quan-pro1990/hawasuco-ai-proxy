using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Màu, phông chữ, tỉ lệ DPI và các hàm dựng control dùng chung (cùng kiểu phần mềm Quản lý công văn).</summary>
    static class Ui
    {
        public static readonly float Dpi;

        static Ui()
        {
            using (var g = Graphics.FromHwnd(IntPtr.Zero)) Dpi = g.DpiX / 96f;
        }

        public static int S(int px) { return (int)Math.Round(px * Dpi); }
        public static Padding Pad(int all) { return new Padding(S(all)); }
        public static Padding Pad(int left, int top, int right, int bottom) { return new Padding(S(left), S(top), S(right), S(bottom)); }

        public static readonly Color Primary = Color.FromArgb(0x1D, 0x5F, 0x95);
        public static readonly Color PrimaryHover = Color.FromArgb(0x17, 0x4E, 0x7B);
        public static readonly Color Sidebar = Color.FromArgb(0x16, 0x2A, 0x43);
        public static readonly Color SidebarHover = Color.FromArgb(0x22, 0x3C, 0x5C);
        public static readonly Color SidebarActive = Color.FromArgb(0x2B, 0x6C, 0xA3);
        public static readonly Color Background = Color.FromArgb(0xF3, 0xF5, 0xF8);
        public static readonly Color Surface = Color.White;
        public static readonly Color Border = Color.FromArgb(0xD8, 0xDD, 0xE4);
        public static readonly Color HeaderBack = Color.FromArgb(0xEC, 0xF0, 0xF5);
        public static readonly Color Selection = Color.FromArgb(0xD3, 0xE5, 0xF6);
        public static readonly Color AltRow = Color.FromArgb(0xF8, 0xFA, 0xFC);
        public static readonly Color Text = Color.FromArgb(0x1F, 0x29, 0x37);
        public static readonly Color Muted = Color.FromArgb(0x5F, 0x68, 0x75);
        public static readonly Color Danger = Color.FromArgb(0xC0, 0x26, 0x26);
        public static readonly Color Warning = Color.FromArgb(0xB4, 0x5A, 0x00);
        public static readonly Color Success = Color.FromArgb(0x1E, 0x7B, 0x34);
        public static readonly Color Input = Color.FromArgb(0xFF, 0xFC, 0xEB);      // ô cần nhập
        public static readonly Color Computed = Color.FromArgb(0xF6, 0xF7, 0xF9);   // ô tự tính
        public static readonly Color GroupRow = Color.FromArgb(0xE4, 0xEC, 0xF5);   // dòng nhóm lớn
        public static readonly Color AreaRow = Color.FromArgb(0xF0, 0xF5, 0xFA);    // dòng khu vực

        public static readonly Font Base = new Font("Segoe UI", 10f);
        public static readonly Font BaseBold = new Font("Segoe UI", 10f, FontStyle.Bold);
        public static readonly Font BaseItalic = new Font("Segoe UI", 9.5f, FontStyle.Italic);
        public static readonly Font Small = new Font("Segoe UI", 9f);
        public static readonly Font SmallBold = new Font("Segoe UI", 9f, FontStyle.Bold);
        public static readonly Font Title = new Font("Segoe UI Semibold", 16f);
        public static readonly Font Section = new Font("Segoe UI Semibold", 11.5f);
        public static readonly Font Nav = new Font("Segoe UI", 11f);
        public static readonly Font CardNumber = new Font("Segoe UI Semibold", 17f);
        public static readonly Font Mono = new Font("Consolas", 9.5f);

        static Bitmap logoSource;

        public static Bitmap Logo(int size)
        {
            if (logoSource == null)
            {
                using (var s = typeof(Ui).Assembly.GetManifestResourceStream("ThatThoatNuoc.logo.png"))
                {
                    if (s == null) return null;
                    using (var tmp = new Bitmap(s)) logoSource = new Bitmap(tmp);
                }
            }
            var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.DrawImage(logoSource, new Rectangle(0, 0, size, size));
            }
            return bmp;
        }

        public static Icon AppIcon()
        {
            using (var s = typeof(Ui).Assembly.GetManifestResourceStream("ThatThoatNuoc.app.ico"))
                return s == null ? null : new Icon(s);
        }

        public static Button MakeButton(string text, bool primary)
        {
            var b = new Button();
            b.Text = text;
            b.Font = primary ? BaseBold : Base;
            b.FlatStyle = FlatStyle.Flat;
            b.AutoSize = true;
            b.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            b.Padding = Pad(10, 3, 10, 3);
            b.MinimumSize = new Size(S(72), S(34));
            b.Margin = Pad(0, 0, 8, 0);
            b.Cursor = Cursors.Hand;
            b.UseVisualStyleBackColor = false;
            if (primary)
            {
                b.BackColor = Primary;
                b.ForeColor = Color.White;
                b.FlatAppearance.BorderSize = 0;
                b.FlatAppearance.MouseOverBackColor = PrimaryHover;
                b.FlatAppearance.MouseDownBackColor = PrimaryHover;
            }
            else
            {
                b.BackColor = Surface;
                b.ForeColor = Text;
                b.FlatAppearance.BorderColor = Border;
                b.FlatAppearance.BorderSize = 1;
                b.FlatAppearance.MouseOverBackColor = HeaderBack;
                b.FlatAppearance.MouseDownBackColor = Selection;
            }
            return b;
        }

        public static Label MakeLabel(string text, Font font, Color color)
        {
            var l = new Label();
            l.Text = text;
            l.Font = font;
            l.ForeColor = color;
            l.AutoSize = true;
            return l;
        }

        public static TextBox MakeText(int width)
        {
            var t = new TextBox();
            t.Font = Base;
            t.Width = S(width);
            return t;
        }

        public static DateTimePicker MakeDatePicker(bool optional)
        {
            var d = new DateTimePicker();
            d.Format = DateTimePickerFormat.Custom;
            d.CustomFormat = "dd/MM/yyyy";
            d.ShowCheckBox = optional;
            d.Font = Base;
            d.Width = S(optional ? 140 : 120);
            return d;
        }

        public static ComboBox MakeCombo(int width)
        {
            var c = new ComboBox();
            c.Font = Base;
            c.DropDownStyle = ComboBoxStyle.DropDownList;
            c.MaxDropDownItems = 20;
            c.Width = S(width);
            return c;
        }

        /// <summary>Khung trắng có viền mảnh (thẻ nội dung).</summary>
        public static Panel MakeCard()
        {
            var p = new Panel { BackColor = Surface, Padding = Pad(16, 12, 16, 14) };
            p.Paint += (s, e) =>
            {
                var c = (Control)s;
                using (var pen = new Pen(Border)) e.Graphics.DrawRectangle(pen, 0, 0, c.Width - 1, c.Height - 1);
            };
            return p;
        }

        public static void StyleGrid(DataGridView g)
        {
            g.BackgroundColor = Surface;
            g.BorderStyle = BorderStyle.None;
            g.CellBorderStyle = DataGridViewCellBorderStyle.Single;
            g.GridColor = Color.FromArgb(0xE3, 0xE7, 0xEC);
            g.EnableHeadersVisualStyles = false;
            g.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.Single;
            g.ColumnHeadersDefaultCellStyle.BackColor = HeaderBack;
            g.ColumnHeadersDefaultCellStyle.ForeColor = Text;
            g.ColumnHeadersDefaultCellStyle.SelectionBackColor = HeaderBack;
            g.ColumnHeadersDefaultCellStyle.Font = SmallBold;
            g.ColumnHeadersDefaultCellStyle.Padding = Pad(2, 0, 2, 0);
            g.ColumnHeadersDefaultCellStyle.WrapMode = DataGridViewTriState.True;
            g.ColumnHeadersDefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            g.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            g.ColumnHeadersHeight = S(46);
            g.DefaultCellStyle.Font = Base;
            g.DefaultCellStyle.ForeColor = Text;
            g.DefaultCellStyle.BackColor = Surface;
            g.DefaultCellStyle.SelectionBackColor = Selection;
            g.DefaultCellStyle.SelectionForeColor = Text;
            g.DefaultCellStyle.Padding = Pad(3, 0, 3, 0);
            g.RowTemplate.Height = S(28);
            g.RowHeadersVisible = false;
            g.AllowUserToAddRows = false;
            g.AllowUserToDeleteRows = false;
            g.AllowUserToResizeRows = false;
            g.AllowUserToOrderColumns = false;
            g.AutoGenerateColumns = false;
            g.StandardTab = true;
            typeof(DataGridView).InvokeMember("DoubleBuffered",
                BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.SetProperty,
                null, g, new object[] { true });
        }

        public static DataGridViewTextBoxColumn Col(string header, int width, bool right)
        {
            var c = new DataGridViewTextBoxColumn();
            c.HeaderText = header;
            c.Width = S(width);
            c.MinimumWidth = S(36);
            c.SortMode = DataGridViewColumnSortMode.NotSortable;
            if (right) c.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
            return c;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, string lParam);

        /// <summary>Dòng chữ mờ gợi ý trong ô nhập khi ô còn trống.</summary>
        public static void SetCue(TextBox box, string cue)
        {
            if (box.IsHandleCreated) SendMessage(box.Handle, 0x1501, (IntPtr)1, cue ?? "");
            else box.HandleCreated += (s, e) => SendMessage(box.Handle, 0x1501, (IntPtr)1, cue ?? "");
        }

        public static void Info(IWin32Window owner, string message)
        {
            MessageBox.Show(owner, message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        public static void Error(IWin32Window owner, string message)
        {
            MessageBox.Show(owner, message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }

        public static bool Confirm(IWin32Window owner, string message)
        {
            return MessageBox.Show(owner, message, UngDung.Ten, MessageBoxButtons.YesNo,
                MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) == DialogResult.Yes;
        }

        public static void OpenFile(IWin32Window owner, string path)
        {
            try
            {
                System.Diagnostics.Process.Start(path);
            }
            catch (Exception ex)
            {
                Error(owner, "Không mở được tệp:\n" + path + "\n\n" + ex.Message);
            }
        }

        /// <summary>Tiêu đề trang + dòng mô tả nhỏ.</summary>
        public static Control PageHeader(string title, string subtitle, out Label subLabel)
        {
            var p = new FlowLayoutPanel
            {
                Dock = DockStyle.Top,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoSize = true,
                Padding = Pad(0, 0, 0, 8)
            };
            p.Controls.Add(MakeLabel(title, Title, Text));
            subLabel = MakeLabel(subtitle, Small, Muted);
            subLabel.Margin = Pad(2, 2, 0, 0);
            p.Controls.Add(subLabel);
            return p;
        }

        /// <summary>Màu chênh lệch tỷ lệ thất thoát: tăng (xấu) đỏ, giảm (tốt) xanh.</summary>
        public static Color MauLech(double? v)
        {
            if (!v.HasValue || Math.Abs(v.Value) < 0.005) return Muted;
            return v > 0 ? Danger : Success;
        }
    }
}
