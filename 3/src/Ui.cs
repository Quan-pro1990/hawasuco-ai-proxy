using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Tông màu cho nút, viên nhãn, biểu tượng.</summary>
    public enum Tone { Xanh, XanhLa, Cam, Tim, Do, Ngoc, Vang, Xam }

    /// <summary>Bộ màu của 1 tông: nền đậm (chữ trắng) và nền nhạt + chữ đậm.</summary>
    public struct MauTone
    {
        public Color Dac, Nhat, ChuNhat;
    }

    /// <summary>Bảng màu sáng / tối, phông chữ, tỉ lệ DPI và các hàm dựng control dùng chung.</summary>
    static class Ui
    {
        public static readonly float Dpi;
        /// <summary>Phông biểu tượng của Windows 10/11 (null nếu máy không có).</summary>
        public static readonly string FontIcon;

        public static readonly Font Base = new Font("Segoe UI", 9.75f);
        public static readonly Font Dam = new Font("Segoe UI Semibold", 9.75f);
        public static readonly Font Nho = new Font("Segoe UI", 8.75f);
        public static readonly Font NhoDam = new Font("Segoe UI Semibold", 8.75f);
        public static readonly Font FontNut = new Font("Segoe UI Semibold", 9.25f);
        public static readonly Font FontNav = new Font("Segoe UI", 10.25f);
        public static readonly Font FontNavDam = new Font("Segoe UI Semibold", 10.25f);
        public static readonly Font TieuDeTrang = new Font("Segoe UI Semibold", 14.5f);
        public static readonly Font TieuDeThe = new Font("Segoe UI Semibold", 11f);
        public static readonly Font Mono = new Font("Consolas", 9.5f);
        public static readonly Font IconNho, IconNut, IconVua, IconLon;

        // ---------- Bảng màu ----------
        // Thứ tự: Nen, The, The2, Vien, Chu, ChuPhu, Chinh, ChinhNhat, ChuChinh, CanhNen, CanhChu, Loi, Tot, Chon, HangLe
        // Hai bảng không có màu nào trùng nhau để đổi sáng <-> tối theo đúng vị trí.
        static readonly Color[] SANG =
        {
            H(0xEEF3FA), H(0xFFFFFF), H(0xF5F8FC), H(0xDCE3EE), H(0x1E293B), H(0x64748B), H(0x1D6FD8), H(0xE3EEFD),
            H(0x1558B0), H(0xFFF6DD), H(0x8A5A00), H(0xD93025), H(0x1E8E3E), H(0xD6E6FB), H(0xF9FBFE)
        };
        static readonly Color[] TOI =
        {
            H(0x0F1623), H(0x1A2332), H(0x222D40), H(0x334155), H(0xE5E9F0), H(0x94A3B8), H(0x3B8BEB), H(0x1D3557),
            H(0x93C5FD), H(0x3A2F12), H(0xF5C46B), H(0xF87171), H(0x4ADE80), H(0x2A4568), H(0x1E2838)
        };

        /// <summary>Đang dùng giao diện tối.</summary>
        public static bool Toi;

        static Color[] P { get { return Toi ? TOI : SANG; } }
        public static Color Nen { get { return P[0]; } }
        public static Color The { get { return P[1]; } }
        public static Color The2 { get { return P[2]; } }
        public static Color Vien { get { return P[3]; } }
        public static Color Chu { get { return P[4]; } }
        public static Color ChuPhu { get { return P[5]; } }
        public static Color Chinh { get { return P[6]; } }
        public static Color ChinhNhat { get { return P[7]; } }
        public static Color ChuChinh { get { return P[8]; } }
        public static Color CanhNen { get { return P[9]; } }
        public static Color CanhChu { get { return P[10]; } }
        public static Color Loi { get { return P[11]; } }
        public static Color Tot { get { return P[12]; } }
        public static Color Chon { get { return P[13]; } }
        public static Color HangLe { get { return P[14]; } }

        /// <summary>Màu nền ô nhật ký (luôn tối như cửa sổ dòng lệnh).</summary>
        public static readonly Color LogNen = H(0x0B1220);
        public static readonly Color LogChu = H(0xD7DEE8);

        static Ui()
        {
            using (var g = Graphics.FromHwnd(IntPtr.Zero)) Dpi = g.DpiX / 96f;
            foreach (string ten in new[] { "Segoe Fluent Icons", "Segoe MDL2 Assets" })
            {
                using (var f = new Font(ten, 10f))
                {
                    if (f.Name == ten) { FontIcon = ten; break; }
                }
            }
            string fi = FontIcon ?? "Segoe UI Symbol";
            IconNho = new Font(fi, 9f);
            IconNut = new Font(fi, 10.5f);
            IconVua = new Font(fi, 12.5f);
            IconLon = new Font(fi, 16f);
        }

        static Color H(int rgb)
        {
            return Color.FromArgb(255, (rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
        }

        public static int S(int px) { return (int)Math.Round(px * Dpi); }
        public static Padding Pad(int all) { return new Padding(S(all)); }
        public static Padding Pad(int l, int t, int r, int b) { return new Padding(S(l), S(t), S(r), S(b)); }

        public static MauTone Mau(Tone t)
        {
            switch (t)
            {
                case Tone.XanhLa: return M(0x1E8E3E, 0xE3F5E8, 0x17703A, 0x22A04B, 0x16382A, 0x86EFAC);
                case Tone.Cam: return M(0xE8710A, 0xFFEFDD, 0xA34D00, 0xEA7C1C, 0x3D2A14, 0xFDBA74);
                case Tone.Tim: return M(0x7C3AED, 0xF0E9FE, 0x5B21B6, 0x8B5CF6, 0x2E2250, 0xC4B5FD);
                case Tone.Do: return M(0xD93025, 0xFDE8E6, 0xB3261E, 0xE5483E, 0x3F1D1D, 0xFCA5A5);
                case Tone.Ngoc: return M(0x0E8F9B, 0xDFF5F7, 0x0B6F78, 0x14A3B0, 0x123A3F, 0x7DD3DC);
                case Tone.Vang: return M(0xC08A00, 0xFFF6D6, 0x8A6500, 0xD4A20C, 0x3A3214, 0xFDE68A);
                case Tone.Xam: return M(0x475569, 0xEEF2F7, 0x334155, 0x64748B, 0x263040, 0xCBD5E1);
                default: return M(0x1D6FD8, 0xE4EEFC, 0x1558B0, 0x3B8BEB, 0x1E3352, 0x9CC7FF);
            }
        }

        static MauTone M(int dac, int nhat, int chu, int dacT, int nhatT, int chuT)
        {
            var m = new MauTone();
            m.Dac = H(Toi ? dacT : dac);
            m.Nhat = H(Toi ? nhatT : nhat);
            m.ChuNhat = H(Toi ? chuT : chu);
            return m;
        }

        public static Color Tron(Color a, Color b, float t)
        {
            return Color.FromArgb(
                (int)(a.R + (b.R - a.R) * t),
                (int)(a.G + (b.G - a.G) * t),
                (int)(a.B + (b.B - a.B) * t));
        }

        /// <summary>Đổi 1 màu của bảng sáng sang màu cùng vị trí ở bảng tối (hoặc ngược lại).</summary>
        static Color Doi(Color c, bool sangToi)
        {
            Color[] tu = sangToi ? SANG : TOI, den = sangToi ? TOI : SANG;
            int argb = c.ToArgb();
            for (int i = 0; i < tu.Length; i++)
                if (tu[i].ToArgb() == argb) return den[i];
            return c;
        }

        /// <summary>Áp dụng giao diện sáng / tối cho cả cây control (gọi sau khi đã đổi Ui.Toi).</summary>
        public static void DoiGiaoDien(Control goc)
        {
            DoiMau(goc, Toi);
        }

        static void DoiMau(Control c, bool sangToi)
        {
            var luoi = c as DataGridView;
            if (luoi != null) KieuLuoi(luoi);
            else if (!(c is RichTextBox))
            {
                c.BackColor = Doi(c.BackColor, sangToi);
                c.ForeColor = Doi(c.ForeColor, sangToi);
            }
            foreach (Control con in c.Controls) DoiMau(con, sangToi);
            c.Invalidate();
        }

        public static GraphicsPath HinhBo(RectangleF r, float banKinh)
        {
            var p = new GraphicsPath();
            float d = Math.Min(banKinh * 2, Math.Min(r.Width, r.Height));
            if (d <= 1)
            {
                p.AddRectangle(r);
                return p;
            }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        // ---------- Dựng control ----------

        public static Label Nhan(string text)
        {
            return Nhan(text, Base, Chu);
        }

        public static Label Nhan(string text, Font font, Color mau)
        {
            var l = new Label();
            l.Text = text;
            l.Font = font;
            l.ForeColor = mau;
            l.AutoSize = true;
            l.UseMnemonic = false;
            return l;
        }

        public static TextBox O(string goiY)
        {
            var t = new TextBox();
            t.Font = Base;
            t.BackColor = The;
            t.ForeColor = Chu;
            t.BorderStyle = BorderStyle.FixedSingle;
            t.Margin = Pad(0, 3, 0, 3);
            if (!string.IsNullOrEmpty(goiY)) GoiY(t, goiY);
            return t;
        }

        public static ComboBox HopChon(params string[] muc)
        {
            var c = new ComboBox();
            c.Font = Base;
            c.DropDownStyle = ComboBoxStyle.DropDownList;
            c.FlatStyle = FlatStyle.Flat;
            c.BackColor = The;
            c.ForeColor = Chu;
            c.MaxDropDownItems = 20;
            c.Margin = Pad(0, 3, 0, 3);
            if (muc != null && muc.Length > 0)
            {
                c.Items.AddRange(muc);
                c.SelectedIndex = 0;
            }
            return c;
        }

        public static CheckBox Hop(string text, bool chon)
        {
            var c = new CheckBox();
            c.Text = text;
            c.Checked = chon;
            c.Font = Base;
            c.ForeColor = Chu;
            c.AutoSize = true;
            c.UseMnemonic = false;
            c.Margin = Pad(2, 3, 8, 3);
            c.Cursor = Cursors.Hand;
            return c;
        }

        public static RadioButton Chon1(string text, bool chon)
        {
            var r = new RadioButton();
            r.Text = text;
            r.Checked = chon;
            r.Font = Base;
            r.ForeColor = Chu;
            r.AutoSize = true;
            r.UseMnemonic = false;
            r.Margin = Pad(2, 3, 14, 3);
            r.Cursor = Cursors.Hand;
            return r;
        }

        /// <summary>Khoảng trống dọc giữa các khối xếp Dock = Top.</summary>
        public static Panel Khoang(int cao)
        {
            return new Panel { Height = S(cao), Dock = DockStyle.Top };
        }

        /// <summary>Thêm control vào cuối chồng xếp từ trên xuống (Dock = Top).</summary>
        public static T ThemDuoi<T>(Control cha, T c) where T : Control
        {
            c.Dock = DockStyle.Top;
            cha.Controls.Add(c);
            c.BringToFront();
            return c;
        }

        /// <summary>Control chiếm phần còn lại (gọi sau cùng, sau mọi ThemDuoi).</summary>
        public static T ThemFill<T>(Control cha, T c) where T : Control
        {
            c.Dock = DockStyle.Fill;
            cha.Controls.Add(c);
            c.BringToFront();
            return c;
        }

        /// <summary>Lưới N cột đều nhau, tự cao theo nội dung (nút, ô đánh dấu...). Phần tử null = ô trống.</summary>
        public static TableLayoutPanel Luoi(int cot, params Control[] ds)
        {
            var t = new TableLayoutPanel();
            t.ColumnCount = cot;
            t.AutoSize = true;
            t.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            t.Dock = DockStyle.Top;
            t.Margin = new Padding(0);
            t.Padding = new Padding(0);
            for (int i = 0; i < cot; i++) t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f / cot));
            int hang = Math.Max(1, (ds.Length + cot - 1) / cot);
            t.RowCount = hang;
            for (int r = 0; r < hang; r++) t.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            for (int i = 0; i < ds.Length; i++)
            {
                if (ds[i] == null) continue;
                ds[i].Dock = DockStyle.Fill;
                if (!(ds[i] is CheckBox) && !(ds[i] is RadioButton)) ds[i].Margin = Pad(4);
                t.Controls.Add(ds[i], i % cot, i / cot);
            }
            return t;
        }

        /// <summary>Bảng nhập liệu 2 cột: nhãn | ô nhập.</summary>
        public static TableLayoutPanel BangNhap()
        {
            var t = new TableLayoutPanel();
            t.ColumnCount = 2;
            t.AutoSize = true;
            t.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            t.Dock = DockStyle.Top;
            t.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            return t;
        }

        public static void DongNhap(TableLayoutPanel t, string nhan, Control o)
        {
            int r = t.RowCount;
            t.RowCount = r + 1;
            t.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Nhan(nhan, Base, ChuPhu);
            l.Anchor = AnchorStyles.Left;
            l.Margin = Pad(0, 6, 12, 6);
            t.Controls.Add(l, 0, r);
            o.Dock = DockStyle.Fill;
            t.Controls.Add(o, 1, r);
        }

        /// <summary>Hàng ngang tự xếp (vd ô nhập + nút "..."), cột đầu giãn hết chiều ngang.</summary>
        public static TableLayoutPanel HangNgang(params Control[] ds)
        {
            var t = new TableLayoutPanel();
            t.ColumnCount = ds.Length;
            t.RowCount = 1;
            t.AutoSize = true;
            t.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            t.Margin = new Padding(0);
            t.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            for (int i = 0; i < ds.Length; i++)
            {
                t.ColumnStyles.Add(i == 0 ? new ColumnStyle(SizeType.Percent, 100) : new ColumnStyle(SizeType.AutoSize));
                if (i == 0) ds[i].Dock = DockStyle.Fill;
                else ds[i].Anchor = AnchorStyles.Left;
                t.Controls.Add(ds[i], i, 0);
            }
            return t;
        }

        /// <summary>Hàng các ô chọn / nút xếp ngang, tự xuống dòng.</summary>
        public static FlowLayoutPanel Dong(params Control[] ds)
        {
            var f = new FlowLayoutPanel();
            f.AutoSize = true;
            f.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            f.WrapContents = true;
            f.Margin = new Padding(0);
            f.Controls.AddRange(ds);
            return f;
        }

        public static void KieuLuoi(DataGridView g)
        {
            g.BackgroundColor = The;
            g.BorderStyle = BorderStyle.None;
            g.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
            g.GridColor = Vien;
            g.EnableHeadersVisualStyles = false;
            g.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
            g.ColumnHeadersDefaultCellStyle.BackColor = The2;
            g.ColumnHeadersDefaultCellStyle.ForeColor = ChuPhu;
            g.ColumnHeadersDefaultCellStyle.SelectionBackColor = The2;
            g.ColumnHeadersDefaultCellStyle.SelectionForeColor = ChuPhu;
            g.ColumnHeadersDefaultCellStyle.Font = NhoDam;
            g.ColumnHeadersDefaultCellStyle.Padding = Pad(4, 0, 4, 0);
            g.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
            g.ColumnHeadersHeight = S(34);
            g.DefaultCellStyle.Font = Base;
            g.DefaultCellStyle.ForeColor = Chu;
            g.DefaultCellStyle.BackColor = The;
            g.DefaultCellStyle.SelectionBackColor = Chon;
            g.DefaultCellStyle.SelectionForeColor = Chu;
            g.DefaultCellStyle.Padding = Pad(4, 0, 4, 0);
            g.AlternatingRowsDefaultCellStyle.BackColor = HangLe;
            g.RowTemplate.Height = S(30);
            g.RowHeadersVisible = false;
            g.AllowUserToAddRows = false;
            g.AllowUserToDeleteRows = false;
            g.AllowUserToResizeRows = false;
            g.AutoGenerateColumns = false;
            g.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            g.MultiSelect = false;
            g.StandardTab = true;
            foreach (DataGridViewRow r in g.Rows) r.Height = S(30);
            g.Invalidate();
        }

        /// <summary>Lưới dữ liệu chỉ đọc (cột đầu tiên là hộp đánh dấu nếu coHopChon).</summary>
        public static DataGridView TaoLuoi(bool coHopChon, params string[] cot)
        {
            var g = new DataGridView();
            typeof(DataGridView).InvokeMember("DoubleBuffered",
                BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.SetProperty, null, g, new object[] { true });
            KieuLuoi(g);
            g.ReadOnly = !coHopChon;
            g.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            if (coHopChon)
            {
                var c = new DataGridViewCheckBoxColumn { HeaderText = "", Width = S(36), AutoSizeMode = DataGridViewAutoSizeColumnMode.None };
                g.Columns.Add(c);
            }
            foreach (string ten in cot)
            {
                var c = new DataGridViewTextBoxColumn { HeaderText = ten, ReadOnly = true, SortMode = DataGridViewColumnSortMode.Automatic };
                g.Columns.Add(c);
            }
            g.CellContentClick += (s, e) =>
            {
                // đánh dấu ăn ngay, không cần rời ô
                if (coHopChon && e.ColumnIndex == 0 && e.RowIndex >= 0) g.CommitEdit(DataGridViewDataErrorContexts.Commit);
            };
            return g;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, string lParam);

        /// <summary>Chữ mờ gợi ý trong ô nhập khi còn trống.</summary>
        public static void GoiY(TextBox box, string cue)
        {
            if (box.IsHandleCreated) DatGoiY(box, cue);
            else box.HandleCreated += (s, e) => DatGoiY(box, cue);
        }

        static void DatGoiY(TextBox box, string cue)
        {
            try { SendMessage(box.Handle, 0x1501, (IntPtr)1, cue ?? ""); }   // EM_SETCUEBANNER
            catch (Exception) { }
        }

        // ---------- Hộp thông báo ----------

        public static void BaoTin(IWin32Window owner, string msg)
        {
            MessageBox.Show(owner, msg, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        public static void BaoLoi(IWin32Window owner, string msg)
        {
            MessageBox.Show(owner, msg, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }

        public static bool Hoi(IWin32Window owner, string msg)
        {
            return MessageBox.Show(owner, msg, UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2) == DialogResult.Yes;
        }

        public static bool HoiCanhBao(IWin32Window owner, string msg)
        {
            return MessageBox.Show(owner, msg, UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2) == DialogResult.Yes;
        }

        /// <summary>Hỏi khởi động lại máy để áp dụng thay đổi.</summary>
        public static void HoiKhoiDongLai(IWin32Window owner)
        {
            if (MessageBox.Show(owner, "Cần khởi động lại máy để áp dụng đầy đủ thay đổi.\n\nKhởi động lại ngay bây giờ?",
                    UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) == DialogResult.Yes)
            {
                HeThong.Mo("shutdown.exe", "/r /t 5 /c \"IT Toolkit: khoi dong lai de ap dung thay doi\"");
            }
        }

        public static string ChonThuMuc(IWin32Window owner, string moTa, string banDau)
        {
            using (var d = new FolderBrowserDialog())
            {
                d.Description = moTa;
                d.ShowNewFolderButton = true;
                if (!string.IsNullOrEmpty(banDau) && System.IO.Directory.Exists(banDau)) d.SelectedPath = banDau;
                return d.ShowDialog(owner) == DialogResult.OK ? d.SelectedPath : null;
            }
        }

        /// <summary>Hàng control đọc từ danh sách để dùng lại (tránh tạo mảng tạm).</summary>
        public static List<T> Tim<T>(Control goc) where T : Control
        {
            var kq = new List<T>();
            foreach (Control c in goc.Controls)
            {
                var t = c as T;
                if (t != null) kq.Add(t);
                kq.AddRange(Tim<T>(c));
            }
            return kq;
        }
    }
}
