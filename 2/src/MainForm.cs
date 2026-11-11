using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Cửa sổ chính: thanh menu bên trái + vùng nội dung.</summary>
    public class MainForm : Form
    {
        static readonly Font NavActive = new Font("Segoe UI Semibold", 11f);
        static readonly Font OrgFont = new Font("Segoe UI", 10.5f, FontStyle.Bold);
        static readonly Font CreditFont = new Font("Segoe UI", 8.25f);
        readonly PhienLam phien;
        readonly Panel content;
        readonly List<Button> navButtons = new List<Button>();
        readonly NhapPage nhapPage;
        readonly DmaPage dmaPage;
        readonly TongHopPage tongHopPage;
        readonly KeHoachPage keHoachPage;
        readonly XuatPage xuatPage;
        readonly CauTrucPage cauTrucPage;
        readonly Cap1Page cap1Page;
        readonly CaiDatPage caiDatPage;
        Label lblOrg, lblMayChu;
        readonly ToolTip tipMayChu = new ToolTip();
        Control current;

        public MainForm(PhienLam phien)
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

            nhapPage = new NhapPage(phien);
            dmaPage = new DmaPage(phien);
            tongHopPage = new TongHopPage(phien);
            keHoachPage = new KeHoachPage(phien);
            xuatPage = new XuatPage(phien);
            cauTrucPage = new CauTrucPage(phien);
            cap1Page = new Cap1Page(phien);
            caiDatPage = new CaiDatPage(phien);
            nhapPage.MoNhapExcel += (s, e) => caiDatPage.NhapTuExcel();
            nhapPage.MoCauTruc += (s, e) => ShowPage(5);
            caiDatPage.MoKeHoach += (s, e) => ShowPage(3);
            keHoachPage.MoNhapExcel += (s, e) => caiDatPage.NhapTuExcel();
            dmaPage.MoNhapExcel += (s, e) => caiDatPage.NhapTuExcel();
            foreach (Control page in Pages)
            {
                page.Dock = DockStyle.Fill;
                page.Visible = false;
                content.Controls.Add(page);
            }
            if (phien.ChiXem)
            {
                // tài khoản chỉ xem: khoá mọi thao tác sửa trên tất cả các trang
                foreach (Control page in Pages) QuyenUi.KhoaChiXem(page);
                LuoiNhap.ChiXem = true;
            }
            ShowPage(0);
            phien.DaDoi += (s, e) => SetOrgName();
            phien.DoiDongBo += (s, e) => GanDongBo();
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
            // màn hình thấp (vd 125%): menu cuộn dọc; nút co lại cho vừa khi có thanh cuộn để không hiện thanh cuộn ngang
            nav.ClientSizeChanged += (s, e) =>
            {
                int w = nav.ClientSize.Width - nav.Padding.Horizontal;
                foreach (Control c in nav.Controls) if (c is Button || c is Panel) c.Width = Math.Min(Ui.S(224), w);
            };
            string[] names ={ "Nhập số liệu tháng", "Vùng DMA", "Tổng hợp năm", "Kế hoạch năm", "Xuất / in báo cáo","Cấu trúc mạng lưới", "Đồng hồ cấp 1", "Cài đặt" };
            Color nhomColor = Color.FromArgb(0x8A, 0x9B, 0xB0);
            for (int i = 0; i < names.Length; i++)
            {
                int index = i;
                if (i == 0 || i == 6)
                {
                    // nhóm: báo cáo thất thoát / khai thác nước thô (đồng hồ cấp 1 tách riêng)
                    var nhom = Ui.MakeLabel(i == 0 ? "THẤT THOÁT NƯỚC" : "KHAI THÁC NƯỚC THÔ", Ui.SmallBold, nhomColor);
                    nhom.Margin = Ui.Pad(14, i == 0 ? 0 : 10, 0, 4);
                    nav.Controls.Add(nhom);
                }
                else if (i == 7)
                    nav.Controls.Add(new Panel { Height = 1, Width = Ui.S(224), BackColor = Ui.SidebarHover, Margin = Ui.Pad(0, 8, 0, 8) });
                var b = new Button
                {
                    Text = names[i],
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
                new ToolTip().SetToolTip(b, names[i] + " (Ctrl+" + (i + 1) + ")");
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
            // trạng thái máy chủ dữ liệu (IIS) — chỉ hiện khi đang dùng máy chủ; bấm để mở Cài đặt
            lblMayChu = Ui.MakeLabel("", Ui.SmallBold, Color.FromArgb(0x9F, 0xE0, 0xB0));
            lblMayChu.MaximumSize = new Size(Ui.S(214), 0);
            lblMayChu.Margin = Ui.Pad(0, 0, 0, 8);
            lblMayChu.Cursor = Cursors.Hand;
            lblMayChu.Visible = false;
            lblMayChu.Click += (s, e) => ShowPage(7);
            if (phien.NguoiDung.Length > 0)
            {
                var lblNguoi = Ui.MakeLabel("Người dùng: " + phien.NguoiDung + (phien.ChiXem ? " (chỉ xem)" : " (Admin)"), Ui.SmallBold,
                                            phien.ChiXem ? Color.FromArgb(0xFF, 0xC8, 0x6B) : Color.FromArgb(0xDC, 0xE5, 0xF0));
                lblNguoi.MaximumSize = new Size(Ui.S(214), 0);
                lblNguoi.Margin = Ui.Pad(0, 0, 0, 6);
                lblNguoi.Cursor = Cursors.Hand;
                lblNguoi.Click += (s, e) => ShowPage(7);
                new ToolTip().SetToolTip(lblNguoi, phien.ChiXem ? "Tài khoản chỉ xem: xem số liệu, xuất Excel, in — không sửa được. Đổi người dùng ở Cài đặt." : "Admin: toàn quyền. Quản lý người dùng ở Cài đặt.");
                footer.Controls.Add(lblNguoi);
            }
            footer.Controls.Add(lblMayChu);
            foreach (string line in new[] { "Enter: xuống ô nhập kế tiếp", "Phiên bản " + UngDung.PhienBan })
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

        Control[] Pages
        {
            get { return new Control[] { nhapPage, dmaPage, tongHopPage, keHoachPage, xuatPage, cauTrucPage, cap1Page, caiDatPage }; }
        }

        void ShowPage(int index)
        {
            Control next = Pages[index];
            if (current != next)
            {
                if (current == nhapPage) nhapPage.KetThucSua();
                if (current == keHoachPage) keHoachPage.KetThucSua();
                if (current == dmaPage) dmaPage.KetThucSua();
                if (current == cap1Page) cap1Page.KetThucSua();
                next.Visible = true;
                next.BringToFront();
                if (current != null) current.Visible = false;
                current = next;
                var hien = next as ITrang;
                if (hien != null) hien.KhiHien();
            }
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
                case Keys.Control | Keys.D6: ShowPage(5); return true;
                case Keys.Control | Keys.D7: ShowPage(6); return true;
                case Keys.Control | Keys.D8: ShowPage(7); return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            if (phien.Kho.CanhBaoKhiMo != null)
                MessageBox.Show(this, phien.Kho.CanhBaoKhiMo, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        // ------------------------------------------------------------------ máy chủ dữ liệu

        void GanDongBo()
        {
            DongBoMayChu d = phien.DongBo;
            if (d == null)
            {
                lblMayChu.Visible = false;
                return;
            }
            d.DuocThay = DuocThayDuLieu;
            d.BaoXungDot += s => MessageBox.Show(this, s, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            d.DoiTrangThai += (s, e) => { if (s == phien.DongBo) CapNhatMayChu(); };
            CapNhatMayChu();
        }

        void CapNhatMayChu()
        {
            DongBoMayChu d = phien.DongBo;
            if (d == null) { lblMayChu.Visible = false; return; }
            lblMayChu.Visible = true;
            lblMayChu.ForeColor = d.Loi ? Color.FromArgb(0xFF, 0xC8, 0x6B) : Color.FromArgb(0x9F, 0xE0, 0xB0);
            lblMayChu.Text = "● " + d.TrangThai;
            tipMayChu.SetToolTip(lblMayChu, "Dữ liệu trên máy chủ " + d.Kn.DiaChi + " (" + d.Kn.Ten + "). Bấm để mở Cài đặt.");
        }

        /// <summary>Chỉ thay dữ liệu tải từ máy chủ khi không mở hộp thoại và không gõ dở ô nào.</summary>
        bool DuocThayDuLieu()
        {
            if (Application.OpenForms.Cast<Form>().Any(f => f != this && f.Visible)) return false;
            Control c = ActiveControl;
            while (c is ContainerControl && ((ContainerControl)c).ActiveControl != null) c = ((ContainerControl)c).ActiveControl;
            if (c is TextBoxBase && !((TextBoxBase)c).ReadOnly) return false;
            for (Control p = c; p != null; p = p.Parent)
                if (p is DataGridView && ((DataGridView)p).IsCurrentCellInEditMode) return false;
            return true;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            nhapPage.KetThucSua();
            keHoachPage.KetThucSua();
            dmaPage.KetThucSua();
            cap1Page.KetThucSua();
            DongBoMayChu d = phien.DongBo;
            if (d != null && d.CoThayDoiChuaGui && !d.CanDangNhap)
            {
                Cursor = Cursors.WaitCursor;
                bool ok = d.GuiNgay(10000);
                Cursor = Cursors.Default;
                if (!ok)
                    MessageBox.Show(this, "Chưa gửi được thay đổi mới nhất lên máy chủ (mất kết nối).\n\nThay đổi vẫn giữ trên máy này và sẽ tự gửi khi mở phần mềm lần sau.",
                                    UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            base.OnFormClosing(e);
        }
    }

    /// <summary>Trang được báo khi hiện ra (để cập nhật số liệu mới nhất).</summary>
    interface ITrang
    {
        void KhiHien();
    }
}
