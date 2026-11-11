using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>Cửa sổ chính: thanh menu bên trái + vùng nội dung.</summary>
    public class MainForm : Form
    {
        static readonly Font NavActive = new Font("Segoe UI Semibold", 11f);
        static readonly Font OrgFont = new Font("Segoe UI", 10.5f, FontStyle.Bold);
        static readonly Font CreditFont = new Font("Segoe UI", 8.25f);
        // mục menu: 0–2 là 3 chế độ xem của trang noise logger, 3 = đội / DMA, 4 = cài đặt
        static readonly string[] TenMuc = { "Điểm đo", "Ca rò rỉ", "Thiết bị", "Đội / vùng DMA", "Cài đặt" };

        readonly PhienNl phien;
        readonly Panel content;
        readonly List<Button> navButtons = new List<Button>();
        readonly NoiseLoggerPage nlPage;
        readonly DonViPage donViPage;
        readonly CaiDatPage caiDatPage;
        Label lblOrg;
        Control current;

        public MainForm(PhienNl phien)
        {
            this.phien = phien;
            Text = UngDung.Ten;
            Font = Ui.Base;
            AutoScaleMode = AutoScaleMode.None;
            BackColor = Ui.Background;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(Ui.S(1360), Ui.S(840));
            MinimumSize = new Size(Ui.S(1060), Ui.S(640));
            WindowState = FormWindowState.Maximized;
            KeyPreview = true;
            try { Icon = Ui.AppIcon() ?? Icon.ExtractAssociatedIcon(Application.ExecutablePath); }
            catch (Exception) { }

            content = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Background, Padding = Ui.Pad(20, 16, 20, 14) };
            Controls.Add(content);
            Controls.Add(BuildSidebar());

            nlPage = new NoiseLoggerPage(phien);
            donViPage = new DonViPage(phien);
            caiDatPage = new CaiDatPage(phien);
            foreach (Control page in new Control[] { nlPage, donViPage, caiDatPage })
            {
                page.Dock = DockStyle.Fill;
                page.Visible = false;
                content.Controls.Add(page);
            }
            nlPage.DoiCheDo += (s, e) => { if (current == nlPage) ToMenu(nlPage.CheDoXem); };
            phien.DaDoi += (s, e) => SetOrgName();
            ShowPage(0);
        }

        void SetOrgName()
        {
            lblOrg.Text = (phien.Dl.CaiDat.TenCongTy1 + "\n" + phien.Dl.CaiDat.TenCongTy2).Trim();
        }

        Control BuildSidebar()
        {
            var side = new Panel { Dock = DockStyle.Left, Width = Ui.S(244), BackColor = Ui.Sidebar };
            var brand = new TableLayoutPanel
            {
                Dock = DockStyle.Top,
                AutoSize = true,
                ColumnCount = 1,
                Padding = Ui.Pad(14, 20, 14, 16)
            };
            brand.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Bitmap logo = Ui.Logo(Ui.S(84));
            if (logo != null)
            {
                brand.Controls.Add(new PictureBox
                {
                    Image = logo,
                    SizeMode = PictureBoxSizeMode.AutoSize,
                    BackColor = Ui.Sidebar,
                    Anchor = AnchorStyles.None,
                    Margin = Ui.Pad(0, 0, 0, 10)
                });
            }
            lblOrg = Ui.MakeLabel("", OrgFont, Color.White);
            lblOrg.TextAlign = ContentAlignment.MiddleCenter;
            lblOrg.Anchor = AnchorStyles.None;
            lblOrg.Margin = new Padding(0);
            SetOrgName();
            brand.Controls.Add(lblOrg);
            var app = Ui.MakeLabel(UngDung.Ten, Ui.Small, Color.FromArgb(0xA9, 0xBC, 0xD3));
            app.Anchor = AnchorStyles.None;
            app.Margin = Ui.Pad(0, 6, 0, 0);
            brand.Controls.Add(app);
            var divider = new Panel { Dock = DockStyle.Top, Height = 1, BackColor = Ui.SidebarHover };

            var nav = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                Padding = Ui.Pad(10, 14, 10, 0),
                AutoScroll = true
            };
            nav.ClientSizeChanged += (s, e) =>
            {
                int w = nav.ClientSize.Width - nav.Padding.Horizontal;
                foreach (Control c in nav.Controls) if (c is Button || c is Panel) c.Width = Math.Min(Ui.S(224), w);
            };
            Color nhomColor = Color.FromArgb(0x8A, 0x9B, 0xB0);
            for (int i = 0; i < TenMuc.Length; i++)
            {
                int index = i;
                if (i == 0 || i == 3)
                {
                    var nhom = Ui.MakeLabel(i == 0 ? "DÒ TÌM RÒ RỈ" : "DANH MỤC", Ui.SmallBold, nhomColor);
                    nhom.Margin = Ui.Pad(14, i == 0 ? 0 : 10, 0, 4);
                    nav.Controls.Add(nhom);
                }
                else if (i == 4)
                    nav.Controls.Add(new Panel { Height = 1, Width = Ui.S(224), BackColor = Ui.SidebarHover, Margin = Ui.Pad(0, 8, 0, 8) });
                var b = new Button
                {
                    Text = TenMuc[i],
                    Font = Ui.Nav,
                    ForeColor = Color.FromArgb(0xDC, 0xE5, 0xF0),
                    BackColor = Ui.Sidebar,
                    FlatStyle = FlatStyle.Flat,
                    TextAlign = ContentAlignment.MiddleLeft,
                    Padding = Ui.Pad(14, 0, 0, 0),
                    Size = new Size(Ui.S(224), Ui.S(40)),
                    Margin = Ui.Pad(0, 0, 0, 3),
                    Cursor = Cursors.Hand,
                    UseVisualStyleBackColor = false,
                    TabStop = false
                };
                b.FlatAppearance.BorderSize = 0;
                b.FlatAppearance.MouseOverBackColor = Ui.SidebarHover;
                b.FlatAppearance.MouseDownBackColor = Ui.SidebarActive;
                b.Click += (s, e) => ShowPage(index);
                new ToolTip().SetToolTip(b, TenMuc[i] + " (Ctrl+" + (i + 1) + ")");
                navButtons.Add(b);
                nav.Controls.Add(b);
            }

            var footer = new FlowLayoutPanel
            {
                Dock = DockStyle.Bottom,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoSize = true,
                Padding = Ui.Pad(18, 0, 8, 12)
            };
            Color footerColor = Color.FromArgb(0x8A, 0x9B, 0xB0);
            foreach (string line in new[] { "Enter: xuống ô nhập kế tiếp", "Alt+← / Alt+→: đêm trước / sau", "Phiên bản " + UngDung.PhienBan })
            {
                var l = Ui.MakeLabel(line, Ui.Small, footerColor);
                l.MaximumSize = new Size(Ui.S(220), 0);
                l.Margin = Ui.Pad(0, line.StartsWith("Phiên bản") ? 8 : 2, 0, 0);
                footer.Controls.Add(l);
            }
            var credit = Ui.MakeLabel("App Developer by Nguyen Hoang Quan", CreditFont, footerColor);
            credit.Margin = Ui.Pad(0, 2, 0, 0);
            footer.Controls.Add(credit);

            side.Controls.Add(nav);
            side.Controls.Add(footer);
            side.Controls.Add(divider);
            side.Controls.Add(brand);
            return side;
        }

        void ShowPage(int index)
        {
            Control next = index <= 2 ? (Control)nlPage : index == 3 ? (Control)donViPage : caiDatPage;
            if (current != next)
            {
                if (current == nlPage) nlPage.KetThucSua();
                next.Visible = true;
                next.BringToFront();
                if (current != null) current.Visible = false;
                current = next;
                ((ITrang)next).KhiHien();
            }
            if (index <= 2 && nlPage.CheDoXem != index) nlPage.Xem(index);
            ToMenu(index);
        }

        void ToMenu(int index)
        {
            for (int i = 0; i < navButtons.Count; i++)
            {
                bool active = i == index;
                navButtons[i].BackColor = active ? Ui.SidebarActive : Ui.Sidebar;
                navButtons[i].ForeColor = active ? Color.White : Color.FromArgb(0xDC, 0xE5, 0xF0);
                navButtons[i].Font = active ? NavActive : Ui.Nav;
            }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            switch (keyData)
            {
                case Keys.Control | Keys.D1: ShowPage(0); return true;
                case Keys.Control | Keys.D2: ShowPage(1); return true;
                case Keys.Control | Keys.D3: ShowPage(2); return true;
                case Keys.Control | Keys.D4: ShowPage(3); return true;
                case Keys.Control | Keys.D5: ShowPage(4); return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            if (phien.Kho.CanhBaoKhiMo != null)
                MessageBox.Show(this, phien.Kho.CanhBaoKhiMo, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            nlPage.KetThucSua();
            base.OnFormClosing(e);
        }
    }

    /// <summary>Trang được báo khi hiện ra (để cập nhật số liệu mới nhất).</summary>
    interface ITrang
    {
        void KhiHien();
    }
}
