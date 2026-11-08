using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang nội dung (lazy: chỉ dựng khi mở lần đầu).</summary>
    public class Trang : Panel
    {
        bool daHien;

        public Trang()
        {
            BackColor = Ui.Nen;
        }

        public void Hien()
        {
            if (!daHien)
            {
                daHien = true;
                KhiHienLanDau();
            }
            KhiHien();
        }

        protected virtual void KhiHienLanDau() { }
        protected virtual void KhiHien() { }

        protected IWin32Window CuaSo { get { return FindForm(); } }
    }

    /// <summary>Trang cuộn dọc: các thẻ xếp từ trên xuống.</summary>
    public class TrangCuon : Trang
    {
        public TrangCuon()
        {
            AutoScroll = true;
            Padding = new Padding(0, 0, Ui.S(6), Ui.S(6));
        }

        protected T Them<T>(T c) where T : Control
        {
            if (Controls.Count > 0) Ui.ThemDuoi(this, Ui.Khoang(12));
            return Ui.ThemDuoi(this, c);
        }
    }

    /// <summary>Cửa sổ chính: menu bên trái, thanh tiêu đề, vùng trang, ô nhật ký phía dưới.</summary>
    public class MainForm : Form
    {
        class MucMenu
        {
            public string Ten, Icon, MoTa;
            public Tone Tone;
            public Func<Trang> Tao;
            public Trang Trang;
            public MucNav Nut;
        }

        readonly List<MucMenu> menu = new List<MucMenu>();
        readonly Panel host;
        readonly DauTrang dauTrang;
        NutBo pillTacVu, pillGio, nutGiaoDien, nutNhatKy;
        readonly SplitContainer tach;
        RichTextBox oLog;
        int dangChon = -1;

        [DllImport("dwmapi.dll")]
        static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        public MainForm()
        {
            Text = UngDung.Ten + " " + UngDung.PhienBan + " - " + UngDung.MoTa;
            Font = Ui.Base;
            AutoScaleMode = AutoScaleMode.None;
            BackColor = Ui.Nen;
            ForeColor = Ui.Chu;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(Ui.S(1366), Ui.S(860));
            MinimumSize = new Size(Ui.S(1080), Ui.S(660));
            WindowState = FormWindowState.Maximized;
            KeyPreview = true;
            try
            {
                // biểu tượng nhúng trong .exe (build.ps1: /win32icon:app.ico)
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch (Exception) { }

            ThemMenu("Kiểm tra cấu hình", Ic.ManHinh, Tone.Xanh, "Phần cứng, Windows, ổ cứng, mạng, bảo mật của máy", () => new TrangCauHinh());
            ThemMenu("Tạo USB cài Windows", Ic.Usb, Tone.Tim, "Tạo USB boot từ file ISO, file tự động cài autounattend.xml", () => new TrangUsbBoot());
            ThemMenu("Driver - Thiết bị", Ic.ThietBi, Tone.Ngoc, "Thiết bị thiếu driver, sao lưu và cài lại driver", () => new TrangDriver());
            ThemMenu("Sao lưu - Phục hồi", Ic.KhoiPhuc, Tone.XanhLa, "Điểm khôi phục, dữ liệu người dùng, Wi-Fi", () => new TrangSaoLuu());
            ThemMenu("Ghost - Acronis", Ic.O, Tone.Cam, "Sao lưu / bung tệp .gho (Ghost) và .tib (Acronis) qua WinPE, không cần USB", () => new TrangGhost());
            ThemMenu("Cài đặt Office", Ic.VanBan, Tone.Cam, "Cài Office chính hãng bằng Office Deployment Tool của Microsoft", () => new TrangOffice());
            ThemMenu("Bản quyền - Gỡ crack", Ic.Quyen, Tone.Vang, "Kiểm tra bản quyền, nhập key, gỡ dấu vết crack / KMS lậu", () => new TrangBanQuyen());
            ThemMenu("Tiện ích - Sửa lỗi Win", Ic.SuaChua, Tone.Do, "Sửa lỗi hệ thống, dọn dẹp, mạng, tùy chỉnh Windows", () => new TrangTienIch());
            ThemMenu("BitLocker - EFS", Ic.Khoa, Tone.Xam, "Tắt / tạm dừng BitLocker, khóa khôi phục, giải mã EFS", () => new TrangBitLocker());
            ThemMenu("Máy in - Chia sẻ LAN", Ic.MayIn, Tone.Xanh, "Sửa lỗi máy in mạng, chia sẻ dữ liệu, tài khoản LAN, scan", () => new TrangMayIn());
            ThemMenu("Kho phần mềm", Ic.Apps, Tone.Tim, "Cài phần mềm miễn phí bằng winget, tải ISO / driver chính hãng", () => new TrangPhanMem());

            // ---- khung phải: tiêu đề + (trang | nhật ký) ----
            var phai = new Panel { Padding = Ui.Pad(4, 12, 14, 12) };
            dauTrang = new DauTrang();
            Control thanhTren = TaoThanhTren();
            host = new Panel();
            tach = new SplitContainer
            {
                Orientation = Orientation.Horizontal,
                FixedPanel = FixedPanel.Panel2,
                SplitterWidth = Ui.S(10),
                BackColor = Ui.Nen
            };
            tach.Panel1.Controls.Add(host);
            host.Dock = DockStyle.Fill;
            Control log = TaoNhatKy();
            tach.Panel2.Controls.Add(log);
            log.Dock = DockStyle.Fill;
            Ui.ThemDuoi(phai, thanhTren);
            Ui.ThemDuoi(phai, Ui.Khoang(10));
            Ui.ThemFill(phai, tach);

            Controls.Add(phai);
            phai.Dock = DockStyle.Fill;
            Control side = TaoMenu();
            Controls.Add(side);
            side.Dock = DockStyle.Left;

            TacVu.GiaoDien = this;
            TacVu.DoiSoLuong += (s, e) =>
            {
                if (!IsHandleCreated || IsDisposed) return;
                try { BeginInvoke((Action)CapNhatTacVu); } catch (Exception) { }
            };
            var dongHo = new Timer { Interval = 1000 };
            dongHo.Tick += (s, e) => CapNhatGio();
            dongHo.Start();
            CapNhatGio();
            CapNhatTacVu();
        }

        void ThemMenu(string ten, string icon, Tone tone, string moTa, Func<Trang> tao)
        {
            menu.Add(new MucMenu { Ten = ten, Icon = icon, Tone = tone, MoTa = moTa, Tao = tao });
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            ThanhTieuDeToi();
        }

        void ThanhTieuDeToi()
        {
            try
            {
                int v = Ui.Toi ? 1 : 0;
                DwmSetWindowAttribute(Handle, 20, ref v, 4);   // DWMWA_USE_IMMERSIVE_DARK_MODE (Win10 2004+ / Win11)
            }
            catch (Exception) { }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            try
            {
                tach.Panel1MinSize = Ui.S(260);
                tach.Panel2MinSize = Ui.S(90);
                int cao;
                if (!int.TryParse(CaiDat.Lay("caoNhatKy", ""), out cao) || cao < Ui.S(90)) cao = Ui.S(190);
                tach.SplitterDistance = Math.Max(tach.Panel1MinSize, tach.Height - cao - tach.SplitterWidth);
                tach.SplitterMoved += (s, ev) => CaiDat.Luu("caoNhatKy", tach.Panel2.Height.ToString());
                if (CaiDat.Lay("anNhatKy", "0") == "1") tach.Panel2Collapsed = true;
            }
            catch (Exception) { }
            int trang;
            if (!int.TryParse(CaiDat.Lay("trang", "0"), out trang) || trang < 0 || trang >= menu.Count) trang = 0;
            ChonTrang(trang);
            NhatKy.Chung.Ghi(UngDung.Ten + " " + UngDung.PhienBan + " — " + HeThong.TenWindows() + " — máy " + Environment.MachineName);
            if (!HeThong.LaQuanTri()) NhatKy.Chung.Canh("Đang chạy KHÔNG có quyền Administrator: phần lớn chức năng sửa lỗi sẽ thất bại.");
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.Control && e.KeyCode >= Keys.D1 && e.KeyCode <= Keys.D9)
            {
                ChonTrang(e.KeyCode - Keys.D1);
                e.Handled = true;
            }
            else if (e.Control && e.KeyCode == Keys.D0)
            {
                ChonTrang(9);
                e.Handled = true;
            }
        }

        void ChonTrang(int i)
        {
            if (i < 0 || i >= menu.Count) return;
            MucMenu m = menu[i];
            if (m.Trang == null)
            {
                Cursor = Cursors.WaitCursor;
                try
                {
                    m.Trang = m.Tao();
                    m.Trang.Dock = DockStyle.Fill;
                    m.Trang.Visible = false;
                    host.Controls.Add(m.Trang);
                }
                finally
                {
                    Cursor = Cursors.Default;
                }
            }
            for (int j = 0; j < menu.Count; j++)
            {
                menu[j].Nut.Chon = j == i;
                if (menu[j].Trang != null && j != i) menu[j].Trang.Visible = false;
            }
            m.Trang.Visible = true;
            dangChon = i;
            dauTrang.Dat(m.Ten, m.MoTa, m.Icon, m.Tone);
            CaiDat.Luu("trang", i.ToString());
            m.Trang.Hien();
        }

        // ---------------- Menu trái ----------------

        Control TaoMenu()
        {
            var side = new Panel { Width = Ui.S(272), Padding = Ui.Pad(12, 12, 6, 12) };
            var the = new TheBo { Padding = Ui.Pad(10, 12, 10, 10) };
            var brand = new ThuongHieu { Height = Ui.S(74) };
            var vach = new Panel { Height = 1, BackColor = Ui.Vien };
            var nav = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoScroll = true,
                Padding = Ui.Pad(0, 10, 0, 0)
            };
            for (int i = 0; i < menu.Count; i++)
            {
                int idx = i;
                var n = new MucNav(menu[i].Ten, menu[i].Icon, menu[i].Tone);
                n.Click += (s, e) => ChonTrang(idx);
                menu[i].Nut = n;
                nav.Controls.Add(n);
            }
            nav.ClientSizeChanged += (s, e) =>
            {
                int w = nav.ClientSize.Width - nav.Padding.Horizontal;
                foreach (Control c in nav.Controls) c.Width = w;
            };
            var chan = new DoanVan("Phiên bản " + UngDung.PhienBan + (HeThong.LaQuanTri() ? "  ·  Quyền Administrator" : "  ·  CHƯA có quyền Admin"),
                HeThong.LaQuanTri() ? Ui.ChuPhu : Ui.Loi, Ui.Nho);
            chan.TextAlign = ContentAlignment.MiddleCenter;

            Ui.ThemDuoi(the, brand);
            Ui.ThemDuoi(the, vach);
            chan.Dock = DockStyle.Bottom;
            the.Controls.Add(chan);
            Ui.ThemFill(the, nav);
            side.Controls.Add(the);
            the.Dock = DockStyle.Fill;
            return side;
        }

        // ---------------- Thanh trên ----------------

        Control TaoThanhTren()
        {
            var t = new TableLayoutPanel { ColumnCount = 2, RowCount = 1, Height = Ui.S(58) };
            t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            t.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            t.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            dauTrang.Dock = DockStyle.Fill;
            t.Controls.Add(dauTrang, 0, 0);

            var phai = new FlowLayoutPanel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, WrapContents = false, Anchor = AnchorStyles.Right, Margin = new Padding(0) };
            pillTacVu = NutBo.VienNhan("Sẵn sàng", Ic.Dung, Tone.XanhLa, false);
            pillGio = NutBo.VienNhan("", Ic.DongHo, Tone.Xanh, false);
            nutNhatKy = new NutBo("", Ic.Lenh, Tone.Xam, false) { BanKinh = 16 };
            nutNhatKy.Click += (s, e) =>
            {
                tach.Panel2Collapsed = !tach.Panel2Collapsed;
                CaiDat.Luu("anNhatKy", tach.Panel2Collapsed ? "1" : "0");
            };
            nutGiaoDien = new NutBo("", Ui.Toi ? Ic.MatTroi : Ic.Dem, Tone.Tim, false) { BanKinh = 16 };
            nutGiaoDien.Click += (s, e) => DoiGiaoDien();
            var tip = new ToolTip();
            tip.SetToolTip(nutNhatKy, "Ẩn / hiện ô nhật ký");
            tip.SetToolTip(nutGiaoDien, "Giao diện sáng / tối");
            foreach (NutBo b in new[] { pillTacVu, pillGio, nutNhatKy, nutGiaoDien })
            {
                b.AutoSize = true;
                b.Margin = Ui.Pad(6, 0, 0, 0);
                phai.Controls.Add(b);
            }
            t.Controls.Add(phai, 1, 0);
            return t;
        }

        static readonly string[] THU = { "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy" };

        void CapNhatGio()
        {
            DateTime n = DateTime.Now;
            pillGio.Text = THU[(int)n.DayOfWeek] + ", " + n.ToString("HH:mm:ss", CultureInfo.InvariantCulture) + "  ·  " +
                           n.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        }

        void CapNhatTacVu()
        {
            int n = TacVu.SoLuong;
            if (n <= 0)
            {
                pillTacVu.Text = "Sẵn sàng";
                pillTacVu.Icon = Ic.Dung;
                pillTacVu.Tone = Tone.XanhLa;
                pillTacVu.Dac = false;
            }
            else
            {
                pillTacVu.Text = "Đang chạy " + n + " tác vụ";
                pillTacVu.Icon = Ic.XuLy;
                pillTacVu.Tone = Tone.Cam;
                pillTacVu.Dac = true;
            }
        }

        void DoiGiaoDien()
        {
            Ui.Toi = !Ui.Toi;
            SuspendLayout();
            Ui.DoiGiaoDien(this);
            ResumeLayout(true);
            nutGiaoDien.Icon = Ui.Toi ? Ic.MatTroi : Ic.Dem;
            ThanhTieuDeToi();
            CaiDat.Luu("toi", Ui.Toi ? "1" : "0");
        }

        // ---------------- Nhật ký ----------------

        Control TaoNhatKy()
        {
            var the = new TheBo { BackColor = Ui.LogNen, MauVien = Color.FromArgb(0x1E, 0x29, 0x3B), Padding = Ui.Pad(14, 8, 10, 8) };
            var dau = new TableLayoutPanel { ColumnCount = 2, RowCount = 1, Height = Ui.S(34) };
            dau.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            dau.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            var td = Ui.Nhan("Nhật ký thực hiện", Ui.Dam, Color.FromArgb(0xC9, 0xD4, 0xE3));
            td.Anchor = AnchorStyles.Left;
            dau.Controls.Add(td, 0, 0);
            var nut = new FlowLayoutPanel { AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, WrapContents = false, Anchor = AnchorStyles.Right, Margin = new Padding(0) };
            var chep = new NutBo("Sao chép", Ic.ChepLai, Tone.Xam, true) { AutoSize = true };
            var xoa = new NutBo("Xóa", Ic.Xoa, Tone.Xam, true) { AutoSize = true };
            var thuMuc = new NutBo("Thư mục nhật ký", Ic.ThuMuc, Tone.Xam, true) { AutoSize = true };
            foreach (NutBo b in new[] { chep, xoa, thuMuc })
            {
                b.Margin = Ui.Pad(4, 0, 0, 0);
                b.MinimumSize = new Size(0, Ui.S(30));
                b.MaximumSize = new Size(Ui.S(400), Ui.S(30));
                nut.Controls.Add(b);
            }
            dau.Controls.Add(nut, 1, 0);

            oLog = new RichTextBox
            {
                ReadOnly = true,
                BorderStyle = BorderStyle.None,
                Font = Ui.Mono,
                DetectUrls = false,
                WordWrap = true,
                ScrollBars = RichTextBoxScrollBars.Vertical
            };
            oLog.BackColor = Ui.LogNen;
            oLog.ForeColor = Ui.LogChu;
            chep.Click += (s, e) => { try { if (oLog.TextLength > 0) Clipboard.SetText(oLog.Text); } catch (Exception) { } };
            xoa.Click += (s, e) => oLog.Clear();
            thuMuc.Click += (s, e) =>
            {
                string d = System.IO.Path.Combine(HeThong.ThuMucDuLieu, "NhatKy");
                System.IO.Directory.CreateDirectory(d);
                HeThong.Mo(d);
            };
            NhatKy.Chung.GanVao(oLog);

            Ui.ThemDuoi(the, dau);
            Ui.ThemFill(the, oLog);
            return the;
        }

        /// <summary>Khối thương hiệu đầu menu: logo + tên phần mềm.</summary>
        class ThuongHieu : Control
        {
            Bitmap logo;

            public ThuongHieu()
            {
                SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.UserPaint, true);
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                Graphics g = e.Graphics;
                g.Clear(Parent != null ? Parent.BackColor : Ui.The);
                int kt = Ui.S(50);
                if (logo == null) logo = Logo.Ve(kt);
                int y = (Height - kt) / 2 - Ui.S(4);
                g.DrawImage(logo, Ui.S(4), y, kt, kt);
                int x = Ui.S(4) + kt + Ui.S(12);
                using (var f = new Font("Segoe UI", 15f, FontStyle.Bold))
                    TextRenderer.DrawText(g, "IT TOOLKIT", f, new Point(x, y - Ui.S(2)), Ui.Chu, TextFormatFlags.NoPrefix);
                TextRenderer.DrawText(g, UngDung.MoTa, Ui.Nho, new Rectangle(x + Ui.S(1), y + Ui.S(31), Width - x - Ui.S(2), Ui.S(20)), Ui.Chinh,
                    TextFormatFlags.NoPrefix | TextFormatFlags.EndEllipsis);
            }
        }

        /// <summary>Tiêu đề trang đang mở: biểu tượng tròn màu + tên + mô tả.</summary>
        class DauTrang : Control
        {
            string ten = "", moTa = "", icon;
            Tone tone;

            public DauTrang()
            {
                SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.UserPaint, true);
            }

            public void Dat(string ten, string moTa, string icon, Tone tone)
            {
                this.ten = ten;
                this.moTa = moTa;
                this.icon = icon;
                this.tone = tone;
                Invalidate();
            }

            protected override void OnPaint(PaintEventArgs e)
            {
                Graphics g = e.Graphics;
                g.Clear(Parent != null ? Parent.BackColor : Ui.Nen);
                MauTone m = Ui.Mau(tone);
                int d = Ui.S(44), y = (Height - d) / 2;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath p = Ui.HinhBo(new RectangleF(0, y, d, d), Ui.S(12)))
                using (var b = new SolidBrush(m.Dac)) g.FillPath(b, p);
                g.SmoothingMode = SmoothingMode.None;
                if (Ui.FontIcon != null && icon != null)
                    TextRenderer.DrawText(g, icon, Ui.IconLon, new Rectangle(0, y, d, d), Color.White,
                        TextFormatFlags.NoPrefix | TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
                int x = d + Ui.S(14);
                TextRenderer.DrawText(g, ten, Ui.TieuDeTrang, new Rectangle(x, y - Ui.S(4), Width - x, Ui.S(30)), Ui.Chu,
                    TextFormatFlags.NoPrefix | TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
                TextRenderer.DrawText(g, moTa, Ui.Base, new Rectangle(x, y + Ui.S(25), Width - x, Ui.S(22)), Ui.ChuPhu,
                    TextFormatFlags.NoPrefix | TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
            }
        }
    }
}
