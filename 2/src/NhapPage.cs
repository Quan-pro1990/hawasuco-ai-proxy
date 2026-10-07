using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Lưới nhập: Enter đi xuống ô nhập kế tiếp cùng cột (bỏ qua ô tự tính).</summary>
    class LuoiNhap : DataGridView
    {
        public Func<int, int, bool> CoTheSua = (r, c) => false;
        public bool GiuO;   // ô vừa nhập sai → Enter không đi tiếp
        public static bool ChiXem;   // tài khoản chỉ xem: không cho sửa ô nào

        protected override void OnCellBeginEdit(DataGridViewCellCancelEventArgs e)
        {
            if (ChiXem) { e.Cancel = true; return; }
            base.OnCellBeginEdit(e);
        }

        protected override bool ProcessDialogKey(Keys keyData)
        {
            Keys key = keyData & Keys.KeyCode;
            if (key == Keys.Enter && (keyData & (Keys.Control | Keys.Alt)) == 0)
            {
                DiTiep((keyData & Keys.Shift) != 0 ? -1 : 1);
                return true;
            }
            return base.ProcessDialogKey(keyData);
        }

        protected override bool ProcessDataGridViewKey(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter && !e.Control && !e.Alt)
            {
                DiTiep(e.Shift ? -1 : 1);
                return true;
            }
            return base.ProcessDataGridViewKey(e);
        }

        void DiTiep(int dir)
        {
            if (CurrentCell == null) return;
            int col = CurrentCell.ColumnIndex, row = CurrentCell.RowIndex;
            GiuO = false;
            if (IsCurrentCellInEditMode && !EndEdit()) return;
            // Số gõ sai: đứng lại ở ô đó để gõ lại.
            if (GiuO || CurrentCell == null || IsCurrentCellInEditMode) return;
            for (int r = row + dir; r >= 0 && r < RowCount; r += dir)
            {
                if (CoTheSua(r, col))
                {
                    try { CurrentCell = Rows[r].Cells[col]; }
                    catch (InvalidOperationException) { }
                    return;
                }
            }
        }
    }

    /// <summary>Trang nhập số liệu tháng: chỉ số TLK, chuẩn thu, súc xả → tự tính sản lượng, tỷ lệ thất thoát, lũy kế.</summary>
    public class NhapPage : UserControl, ITrang
    {
        const int cStt = 0, cTen = 1, cCu = 2, cMoi = 3, cSl = 4, cCt = 5, cTl = 6, cHt = 7, cKh = 8, cCk = 9,
                  cLk = 10, cLkCt = 11, cLkTl = 12, cLkCk = 13, cGc = 14;
        static readonly Font BoldFont = new Font("Segoe UI", 10f, FontStyle.Bold);
        static readonly Font MoTaFont = new Font("Segoe UI", 9f, FontStyle.Italic);

        readonly PhienLam phien;
        readonly ComboBox cboThang;
        readonly Button btnTao, btnThongTin, btnXuat, btnThem, btnChiTiet;
        readonly Panel gapChiTiet;
        readonly Label lblKy;
        readonly FlowLayoutPanel the;
        readonly LuoiNhap grid;
        readonly ChiTietPanel chiTiet;
        readonly ListBox lstCanhBao;
        readonly Label lblCanhBao;
        readonly Panel trong, chinh;
        readonly ToolTip tip = new ToolTip();
        ThangBaoCao thang;
        List<Muc> dong = new List<Muc>();
        bool dangNap, moChiTiet = true;

        public event EventHandler MoNhapExcel;
        public event EventHandler MoCauTruc;

        public NhapPage(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;

            // ---- thanh trên
            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 0, 0, 4) };
            var title = Ui.MakeLabel("Nhập số liệu", Ui.Title, Ui.Text);
            title.Margin = Ui.Pad(0, 0, 16, 0);
            top.Controls.Add(title);
            cboThang = Ui.MakeCombo(170);
            cboThang.Margin = Ui.Pad(0, 7, 10, 0);
            cboThang.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap) return;
                var t = cboThang.SelectedItem as MucThang;
                if (t != null) phien.ChonThang(t.Thang);
            };
            top.Controls.Add(cboThang);
            btnTao = Ui.MakeButton("+ Tạo tháng mới", true);
            btnTao.Margin = Ui.Pad(0, 4, 8, 0);
            btnTao.Click += (s, e) => TaoThangMoi();
            top.Controls.Add(btnTao);
            btnThongTin = Ui.MakeButton("Thông tin kỳ báo cáo…", false);
            btnThongTin.Margin = Ui.Pad(0, 4, 8, 0);
            btnThongTin.Click += (s, e) => SuaThongTin();
            top.Controls.Add(btnThongTin);
            btnXuat = QuyenUi.ChoXem(Ui.MakeButton("Xuất Excel…", false));
            tip.SetToolTip(btnXuat, "Xuất báo cáo tỷ lệ thất thoát của tháng đang chọn ra file Excel");
            btnXuat.Margin = Ui.Pad(0, 4, 8, 0);
            btnXuat.Click += (s, e) => XuatPage.XuatThang(this, phien, thang);
            top.Controls.Add(btnXuat);
            var btnIn = XuatPage.NutIn();
            btnIn.Margin = Ui.Pad(0, 4, 8, 0);
            btnIn.Click += (s, e) => { KetThucSua(); XuatPage.XuatThang(this, phien, thang, true); };
            top.Controls.Add(btnIn);
            btnThem = Ui.MakeButton("⋯", false);
            btnThem.MinimumSize = new Size(Ui.S(40), Ui.S(34));
            btnThem.Margin = Ui.Pad(0, 4, 0, 0);
            var menu = new ContextMenuStrip { Font = Ui.Base };
            menu.Items.Add("Sửa cấu trúc tháng này (thêm / bớt TLK)…", null, (s, e) => { if (MoCauTruc != null) MoCauTruc(this, EventArgs.Empty); });
            menu.Items.Add("Nhập số liệu từ file Excel…", null, (s, e) => { if (MoNhapExcel != null) MoNhapExcel(this, EventArgs.Empty); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Xoá tháng đang chọn…", null, (s, e) => XoaThang());
            btnThem.Click += (s, e) => menu.Show(btnThem, new Point(0, btnThem.Height));
            tip.SetToolTip(btnThem, "Thêm thao tác");
            top.Controls.Add(btnThem);
            btnChiTiet = QuyenUi.ChoXem(Ui.MakeButton("Ẩn khung chi tiết", false));
            btnChiTiet.Margin = Ui.Pad(8, 4, 0, 0);
            btnChiTiet.Click += (s, e) =>
            {
                chiTiet.GhiNhan();
                moChiTiet = !moChiTiet;
                chiTiet.Visible = moChiTiet;
                gapChiTiet.Visible = moChiTiet;
                btnChiTiet.Text = moChiTiet ? "Ẩn khung chi tiết" : "Hiện khung chi tiết";
                if (moChiTiet) HienChiTiet();
            };
            tip.SetToolTip(btnChiTiet, "Khung bên phải: cách tính, thay đồng hồ, điều chỉnh, số so sánh, ghi chú của dòng đang chọn");
            top.Controls.Add(btnChiTiet);

            lblKy = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblKy.Dock = DockStyle.Top;
            lblKy.Padding = Ui.Pad(2, 0, 0, 8);

            // ---- thẻ tổng quan
            the = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 0, 0, 8) };

            // ---- lưới + chi tiết
            grid = new LuoiNhap { Dock = DockStyle.Fill };
            Ui.StyleGrid(grid);
            grid.SelectionMode = DataGridViewSelectionMode.CellSelect;
            grid.MultiSelect = false;
            grid.EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2;
            grid.ShowCellToolTips = true;
            string[] heads = { "STT", "Tên đơn vị / đồng hồ", "Chỉ số\ntháng trước", "Chỉ số\nhiện tại", "Sản lượng\nphát ra (m³)", "Chuẩn thu\n(m³)",
                               "Thất\nthoát %", "So tháng\ntrước", "So\nkế hoạch", "So\ncùng kỳ", "Lũy kế\nphát ra", "Lũy kế\nchuẩn thu", "Lũy kế\nTT %", "LK so\ncùng kỳ", "Ghi chú" };
            int[] widths = { 56, 330, 100, 100, 104, 96, 62, 66, 66, 66, 106, 106, 62, 66, 200 };
            for (int i = 0; i < heads.Length; i++)
            {
                var col = Ui.Col(heads[i], widths[i], i >= cCu && i != cGc);
                grid.Columns.Add(col);
            }
            grid.Columns[cStt].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            grid.Columns[cStt].Frozen = true;
            grid.Columns[cTen].Frozen = true;
            grid.CoTheSua = CoTheSua;
            grid.CellBeginEdit += (s, e) => { if (!CoTheSua(e.RowIndex, e.ColumnIndex)) e.Cancel = true; };
            grid.CellEndEdit += Grid_CellEndEdit;
            grid.CellPainting += Grid_CellPainting;
            grid.CurrentCellChanged += (s, e) => HienChiTiet();
            grid.KeyDown += Grid_KeyDown;
            grid.DataError += (s, e) => e.ThrowException = false;

            chiTiet = new ChiTietPanel(phien) { Dock = DockStyle.Right, Width = Ui.S(350) };
            chiTiet.DaSua += (s, e) => { phien.Luu(this); CapNhatGiaTri(); };
            var gap = new Panel { Dock = DockStyle.Right, Width = Ui.S(10), BackColor = Ui.Background };
            gapChiTiet = gap;

            // ---- cảnh báo
            var bottom = new Panel { Dock = DockStyle.Bottom, Height = Ui.S(128), Padding = Ui.Pad(0, 8, 0, 0) };
            lblCanhBao = Ui.MakeLabel("Kiểm tra số liệu", Ui.SmallBold, Ui.Text);
            lblCanhBao.Dock = DockStyle.Top;
            lstCanhBao = new ListBox
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.FixedSingle,
                DrawMode = DrawMode.OwnerDrawFixed,
                ItemHeight = Ui.S(22),
                Font = Ui.Small,
                IntegralHeight = false
            };
            lstCanhBao.DrawItem += LstCanhBao_DrawItem;
            lstCanhBao.Click += (s, e) => ChonCanhBao();
            lstCanhBao.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) ChonCanhBao(); };
            bottom.Controls.Add(lstCanhBao);
            bottom.Controls.Add(lblCanhBao);

            chinh = new Panel { Dock = DockStyle.Fill };
            var gridHost = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            gridHost.Controls.Add(grid);
            chinh.Controls.Add(gridHost);
            chinh.Controls.Add(gap);
            chinh.Controls.Add(chiTiet);
            chinh.Controls.Add(bottom);

            trong = TaoManHinhTrong();
            Controls.Add(chinh);
            Controls.Add(trong);
            Controls.Add(the);
            Controls.Add(lblKy);
            Controls.Add(top);

            phien.DaDoi += (s, e) => { if (s != this) NapLai(); };
            phien.DoiThang += (s, e) => NapLai();
            NapLai();
        }

        class MucThang
        {
            public ThangBaoCao Thang;
            public override string ToString() { return Thang.Ten; }
        }

        Panel TaoManHinhTrong()
        {
            var p = new Panel { Dock = DockStyle.Fill, Visible = false };
            var card = Ui.MakeCard();
            card.Width = Ui.S(640);
            card.Height = Ui.S(260);
            card.Location = new Point(Ui.S(10), Ui.S(10));
            var flow = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false };
            flow.Controls.Add(Ui.MakeLabel("Chưa có số liệu tháng nào", Ui.Section, Ui.Text));
            var l = Ui.MakeLabel("Cách nhanh nhất: nhập file Excel báo cáo thất thoát đang dùng (vd \"BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC tháng 9 năm 2026.xlsx\"). " +
                                 "Phần mềm tự đọc các trang \"Tháng 1-2026\", \"Tháng 2-2026\"…: danh sách TLK, công thức từng đội / khu vực, kế hoạch, cùng kỳ, lũy kế — " +
                                 "rồi chỉ việc tạo tháng mới và nhập chỉ số.", Ui.Base, Ui.Muted);
            l.MaximumSize = new Size(Ui.S(600), 0);
            l.Margin = Ui.Pad(0, 8, 0, 14);
            flow.Controls.Add(l);
            var buttons = new FlowLayoutPanel { AutoSize = true, WrapContents = false };
            var b1 = Ui.MakeButton("Nhập từ file Excel…", true);
            b1.Click += (s, e) => { if (MoNhapExcel != null) MoNhapExcel(this, EventArgs.Empty); };
            var b2 = Ui.MakeButton("Bắt đầu với cấu trúc trống", false);
            b2.Click += (s, e) => TaoThangDauTien();
            buttons.Controls.Add(b1);
            buttons.Controls.Add(b2);
            flow.Controls.Add(buttons);
            card.Controls.Add(flow);
            p.Controls.Add(card);
            return p;
        }

        public void KhiHien()
        {
            NapLai();
            grid.Focus();
        }

        public void KetThucSua()
        {
            if (grid.IsCurrentCellInEditMode) grid.EndEdit();
            chiTiet.GhiNhan();
        }

        // ------------------------------------------------------------------ nạp dữ liệu

        void NapLai()
        {
            dangNap = true;
            try
            {
                DuLieu dl = phien.Dl;
                cboThang.Items.Clear();
                foreach (ThangBaoCao t in dl.Thang.AsEnumerable().Reverse()) cboThang.Items.Add(new MucThang { Thang = t });
                thang = phien.ThangChon;
                bool co = thang != null;
                trong.Visible = !co;
                chinh.Visible = co;
                the.Visible = co;
                cboThang.Enabled = btnThongTin.Enabled = btnXuat.Enabled = co;
                ThangBaoCao cuoi = dl.ThangCuoi;
                btnTao.Text = ThaoTacThang.NhanNut(dl);
                btnTao.Visible = co;
                btnChiTiet.Visible = co;
                if (!co)
                {
                    lblKy.Text = "";
                    return;
                }
                foreach (MucThang mt in cboThang.Items)
                    if (mt.Thang == thang) cboThang.SelectedItem = mt;
                lblKy.Text = MoTaKy(thang);
                int cur = grid.CurrentCell != null ? grid.CurrentCell.RowIndex : -1;
                int curCol = grid.CurrentCell != null ? grid.CurrentCell.ColumnIndex : cMoi;
                int curId = cur >= 0 && cur < dong.Count ? dong[cur].Id : -1;
                int scroll = grid.FirstDisplayedScrollingRowIndex;
                ThangBaoCao truocDo = grid.Tag as ThangBaoCao;

                dong = thang.Muc.Where(m => m.VaiTro != VaiTro.Dma).ToList();   // vùng DMA nhập ở trang "Vùng DMA"
                grid.Rows.Clear();
                if (dong.Count > 0) grid.Rows.Add(dong.Count);
                for (int r = 0; r < dong.Count; r++) DinhDangDong(r);
                CapNhatGiaTri();
                grid.Tag = thang;
                if (dong.Count > 0)
                {
                    int idx = truocDo == thang && curId >= 0 ? dong.FindIndex(m => m.Id == curId) : -1;
                    if (idx < 0) idx = Enumerable.Range(0, dong.Count).FirstOrDefault(r => CoTheSua(r, cMoi));
                    if (truocDo == thang && scroll >= 0 && scroll < dong.Count) grid.FirstDisplayedScrollingRowIndex = scroll;
                    try { grid.CurrentCell = grid.Rows[idx].Cells[truocDo == thang ? curCol : cMoi]; }
                    catch (Exception) { }
                }
            }
            finally
            {
                dangNap = false;
            }
            HienChiTiet();
        }

        static string MoTaKy(ThangBaoCao t)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(t.KyHoaDon)) parts.Add("Hoá đơn kỳ " + t.KyHoaDon);
            if (t.TuNgay.HasValue && t.DenNgay.HasValue) parts.Add("Nước tiêu thụ " + So.Ngay(t.TuNgay) + " → " + So.Ngay(t.DenNgay));
            int dma = t.Muc.Count(m => m.VaiTro == VaiTro.Dma);
            parts.Add(t.Muc.Count(m => m.Loai == LoaiMuc.DongHo && m.VaiTro != VaiTro.Dma) + " đồng hồ, " +
                      t.Muc.Count(m => m.CoChuanThu && m.VaiTro != VaiTro.Dma) + " đơn vị tính thất thoát" +
                      (dma > 0 ? ", " + dma + " vùng DMA (nhập ở trang Vùng DMA)" : ""));
            parts.Add("Ô nền vàng là ô nhập — gõ số rồi Enter để xuống ô kế tiếp; số tự lưu");
            return string.Join("   ·   ", parts);
        }

        void DinhDangDong(int r)
        {
            Muc m = dong[r];
            DataGridViewRow row = grid.Rows[r];
            Color back = m.Cap == 0 ? Ui.GroupRow : (m.VaiTro == VaiTro.KhuVuc || m.VaiTro == VaiTro.Dma ? Ui.AreaRow : Ui.Surface);
            row.DefaultCellStyle.BackColor = back;
            if (m.Cap == 0) row.DefaultCellStyle.Font = BoldFont;
            row.Cells[cTen].Style.Padding = new Padding(Ui.S(4 + Math.Min(m.Cap, 4) * 14), 0, Ui.S(3), 0);
            if (m.VaiTro == VaiTro.KhuVuc || m.VaiTro == VaiTro.Dma) row.Cells[cTen].Style.Font = BoldFont;
            for (int c = 0; c < grid.ColumnCount; c++)
                if (CoTheSua(r, c) && c != cGc) row.Cells[c].Style.BackColor = Ui.Input;
            row.Cells[cStt].Value = m.Stt;
            row.Cells[cTen].Value = m.TenMotDong;
            row.Cells[cTen].ToolTipText = m.TenMotDong + (m.AnBaoCaoThang ? "\n(chỉ hiện trong bảng tổng hợp, không in trong báo cáo tháng)" : "");
        }

        bool CoTheSua(int r, int c)
        {
            if (r < 0 || r >= dong.Count) return false;
            Muc m = dong[r];
            switch (c)
            {
                case cCu:
                case cMoi: return m.Loai == LoaiMuc.DongHo;
                case cSl: return m.Loai == LoaiMuc.NhapTay;
                case cCt: return m.ChuanThuLoai == LoaiChuanThu.Nhap;
                case cGc: return true;
            }
            return false;
        }

        /// <summary>Đổ lại các ô kết quả (sau mỗi lần sửa) mà không dựng lại lưới.</summary>
        void CapNhatGiaTri()
        {
            if (thang == null) return;
            KetQuaThang kq = phien.Bt.Tinh(thang);
            for (int r = 0; r < dong.Count && r < grid.RowCount; r++)
            {
                Muc m = dong[r];
                KetQua k = kq[m.Id];
                DataGridViewRow row = grid.Rows[r];
                Dat(row, cCu, m.Loai == LoaiMuc.DongHo ? So.N0(m.ChiSoCu) : "");
                Dat(row, cMoi, m.Loai == LoaiMuc.DongHo ? So.N0(m.ChiSoMoi) : "");
                Dat(row, cSl, So.M3(k.PhatRa));
                var slCell = row.Cells[cSl];
                slCell.Style.ForeColor = k.Loi != null || (k.PhatRa.HasValue && k.PhatRa < 0) ? Ui.Danger
                                       : m.GhiDe ? Ui.Primary : k.ThieuSoLieu ? Ui.Warning : Ui.Text;
                slCell.ToolTipText = (k.Loi != null ? "Lỗi: " + k.Loi + "\n" : "") + k.CachTinh + (k.ThieuSoLieu ? "\n(có số đầu vào chưa nhập)" : "");
                Dat(row, cCt, m.CoChuanThu ? So.M3(k.ChuanThu) : "");
                Dat(row, cTl, So.P2(k.TyLe));
                if (k.TyLe.HasValue)
                {
                    bool vuot = k.KeHoach.HasValue && k.TyLe > k.KeHoach;
                    row.Cells[cTl].Style.ForeColor = k.TyLe < 0 ? Ui.Danger : vuot ? Ui.Danger : Ui.Text;
                    row.Cells[cTl].ToolTipText = "Thất thoát " + So.M3(k.ThatThoat) + " m³ = (" + So.M3(k.PhatRa) + " − " + So.M3(k.ChuanThu) + ") / " + So.M3(k.PhatRa) + " × 100" +
                                                 (k.KeHoach.HasValue ? "\nKế hoạch năm: " + So.P2(k.KeHoach) + "%" : "");
                }
                DatLech(row, cHt, k.SoThangTruoc, k.TyLeThangTruoc.HasValue ? "Tháng trước: " + So.P2(k.TyLeThangTruoc) + "%" + (k.ThangTruocTuDong ? "" : " (nhập tay)") : null);
                DatLech(row, cKh, k.SoKeHoach, k.KeHoach.HasValue ? "Kế hoạch năm " + thang.Nam + ": " + So.P2(k.KeHoach) + "%" : null);
                DatLech(row, cCk, k.SoCungKy, k.CungKy.HasValue ? "Cùng kỳ năm trước: " + So.P2(k.CungKy) + "%" + (k.CungKyTuDong ? " (tự tính)" : "") : null);
                Dat(row, cLk, So.M3(k.LkPhatRa));
                Dat(row, cLkCt, m.CoChuanThu ? So.M3(k.LkChuanThu) : "");
                Dat(row, cLkTl, So.P2(k.LkTyLe));
                DatLech(row, cLkCk, k.LkSoCungKy, k.LkCungKy.HasValue ? "Lũy kế cùng kỳ năm trước: " + So.P2(k.LkCungKy) + "%" : null);
                Dat(row, cGc, (m.GhiChu ?? "").Replace("\r", "").Replace("\n", " ⏎ "));
                row.Cells[cGc].ToolTipText = m.GhiChu ?? "";
            }
            CapNhatThe(kq);
            CapNhatCanhBao();
            grid.Invalidate();
        }

        static void Dat(DataGridViewRow row, int c, string v)
        {
            if (!Equals(row.Cells[c].Value, v)) row.Cells[c].Value = v;
        }

        static void DatLech(DataGridViewRow row, int c, double? v, string tip)
        {
            Dat(row, c, So.Lech(v));
            row.Cells[c].Style.ForeColor = Ui.MauLech(v);
            row.Cells[c].ToolTipText = tip ?? "";
        }

        // ------------------------------------------------------------------ thẻ tổng quan

        void CapNhatThe(KetQuaThang kq)
        {
            the.SuspendLayout();
            var cacDong = thang.Muc.Where(m => m.VaiTro == VaiTro.ToanCongTy || m.VaiTro == VaiTro.Doi).ToList();
            var toan = cacDong.Where(m => m.VaiTro == VaiTro.ToanCongTy).ToList();
            cacDong = toan.Concat(cacDong.Where(m => m.VaiTro == VaiTro.Doi)).ToList();
            while (the.Controls.Count > cacDong.Count)
            {
                Control c = the.Controls[the.Controls.Count - 1];
                the.Controls.Remove(c);
                c.Dispose();
            }
            for (int i = 0; i < cacDong.Count; i++)
            {
                TheDonVi t;
                if (i < the.Controls.Count) t = (TheDonVi)the.Controls[i];
                else
                {
                    t = new TheDonVi();
                    t.Click += (s, e) => ChonDong(((TheDonVi)s).Id, cCt);
                    the.Controls.Add(t);
                }
                Muc m = cacDong[i];
                KetQua k = kq[m.Id];
                t.Id = m.Id;
                t.Ten = m.VaiTro == VaiTro.ToanCongTy ? "TOÀN CÔNG TY" : m.TenTongHop;
                t.TyLe = k.TyLe;
                t.KeHoach = k.KeHoach;
                t.SoThangTruoc = k.SoThangTruoc;
                t.Lon = m.VaiTro == VaiTro.ToanCongTy;
                t.ThieuSoLieu = k.ThieuSoLieu || (m.ChuanThuLoai == LoaiChuanThu.Nhap && !m.ChuanThu.HasValue);
                t.Width = Ui.S(t.Lon ? 200 : 158);
                t.Height = Ui.S(74);
                t.Margin = Ui.Pad(0, 0, 8, 0);
                tip.SetToolTip(t, m.TenMotDong + "\nPhát ra: " + So.M3(k.PhatRa) + " m³\nChuẩn thu: " + So.M3(k.ChuanThu) + " m³\nThất thoát: " +
                                  So.M3(k.ThatThoat) + " m³\nLũy kế: " + So.P2(k.LkTyLe) + "%");
                t.Invalidate();
            }
            the.ResumeLayout();
        }

        // ------------------------------------------------------------------ cảnh báo

        void CapNhatCanhBao()
        {
            List<CanhBao> list = phien.Bt.KiemTra(thang).Where(c => { Muc m = thang.Tim(c.Id); return m == null || m.VaiTro != VaiTro.Dma; }).ToList();
            lstCanhBao.BeginUpdate();
            lstCanhBao.Items.Clear();
            foreach (CanhBao c in list) lstCanhBao.Items.Add(c);
            if (list.Count == 0) lstCanhBao.Items.Add("Không có gì bất thường — số liệu đã nhập đủ.");
            lstCanhBao.EndUpdate();
            int loi = list.Count(c => c.MucDo == 2), xem = list.Count(c => c.MucDo == 1), nhac = list.Count(c => c.MucDo == 0);
            lblCanhBao.Text = "Kiểm tra số liệu:  " + (loi > 0 ? loi + " lỗi · " : "") + xem + " cần xem · " + nhac + " nhắc nhở" +
                              "   (bấm vào dòng để tới ô cần sửa)";
            lblCanhBao.ForeColor = loi > 0 ? Ui.Danger : Ui.Text;
        }

        void LstCanhBao_DrawItem(object sender, DrawItemEventArgs e)
        {
            if (e.Index < 0) return;
            e.DrawBackground();
            object item = lstCanhBao.Items[e.Index];
            var c = item as CanhBao;
            Color dot = c == null ? Ui.Success : c.MucDo == 2 ? Ui.Danger : c.MucDo == 1 ? Ui.Warning : Ui.Muted;
            int d = Ui.S(8);
            using (var b = new SolidBrush(dot))
            {
                e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                e.Graphics.FillEllipse(b, e.Bounds.Left + Ui.S(8), e.Bounds.Top + (e.Bounds.Height - d) / 2, d, d);
            }
            bool sel = (e.State & DrawItemState.Selected) != 0;
            var rect = new Rectangle(e.Bounds.Left + Ui.S(24), e.Bounds.Top, e.Bounds.Width - Ui.S(26), e.Bounds.Height);
            TextRenderer.DrawText(e.Graphics, c == null ? item.ToString() : c.NoiDung, Ui.Small, rect, sel ? SystemColors.HighlightText : Ui.Text,
                                  TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        }

        void ChonCanhBao()
        {
            var c = lstCanhBao.SelectedItem as CanhBao;
            if (c == null) return;
            Muc m = thang.Tim(c.Id);
            if (m == null) return;
            int col = m.Loai == LoaiMuc.DongHo ? cMoi : m.Loai == LoaiMuc.NhapTay ? cSl : m.ChuanThuLoai == LoaiChuanThu.Nhap ? cCt : cSl;
            if (c.NoiDung.Contains("chuẩn thu")) col = cCt;
            if (c.NoiDung.Contains("tháng trước") && m.Loai == LoaiMuc.DongHo && !m.ChiSoCu.HasValue) col = cCu;
            ChonDong(c.Id, col);
        }

        void ChonDong(int id, int col)
        {
            int r = dong.FindIndex(m => m.Id == id);
            if (r < 0) return;
            try
            {
                grid.CurrentCell = grid.Rows[r].Cells[col];
                grid.Focus();
            }
            catch (Exception) { }
        }

        // ------------------------------------------------------------------ sửa ô

        void Grid_CellEndEdit(object sender, DataGridViewCellEventArgs e)
        {
            if (dangNap || e.RowIndex < 0 || e.RowIndex >= dong.Count) return;
            string text = Convert.ToString(grid.Rows[e.RowIndex].Cells[e.ColumnIndex].Value);
            if (!GhiO(e.RowIndex, e.ColumnIndex, text))
            {
                // Gõ sai: trả lại số cũ, nhắc ngay tại ô, giữ nguyên vị trí để gõ lại.
                grid.GiuO = true;
                CapNhatGiaTri();
                Rectangle rc = grid.GetCellDisplayRectangle(e.ColumnIndex, e.RowIndex, false);
                tip.Show("\"" + text + "\" không phải số. Gõ dạng 1234567 hoặc 1.234.567; số lẻ dùng dấu phẩy: 1728,47",
                         grid, rc.Left, rc.Bottom + Ui.S(2), 3500);
            }
        }

        /// <summary>Ghi 1 ô nhập vào số liệu; trả false nếu không hợp lệ.</summary>
        bool GhiO(int r, int c, string text)
        {
            Muc m = dong[r];
            if (c == cGc)
            {
                string g = (text ?? "").Replace(" ⏎ ", "\n");
                if (g == (m.GhiChu ?? "").Replace("\r", "")) return true;
                m.GhiChu = g;
            }
            else
            {
                double? v;
                if (!So.TryDoc(text, out v)) return false;
                switch (c)
                {
                    case cCu: if (m.ChiSoCu == v) { CapNhatGiaTri(); return true; } m.ChiSoCu = v; break;
                    case cMoi: if (m.ChiSoMoi == v) { CapNhatGiaTri(); return true; } m.ChiSoMoi = v; break;
                    case cSl: if (m.SanLuong == v) { CapNhatGiaTri(); return true; } m.SanLuong = v; break;
                    case cCt: if (m.ChuanThu == v) { CapNhatGiaTri(); return true; } m.ChuanThu = v; break;
                    default: return false;
                }
            }
            phien.Luu(this);
            CapNhatGiaTri();
            HienChiTiet();
            return true;
        }

        void Grid_KeyDown(object sender, KeyEventArgs e)
        {
            if (grid.CurrentCell == null) return;
            int r = grid.CurrentCell.RowIndex, c = grid.CurrentCell.ColumnIndex;
            if (e.KeyCode == Keys.Delete && !grid.IsCurrentCellInEditMode && CoTheSua(r, c))
            {
                GhiO(r, c, "");
                e.Handled = true;
            }
            else if (e.Control && e.KeyCode == Keys.V && !grid.IsCurrentCellInEditMode && CoTheSua(r, c))
            {
                DanSo(r, c);
                e.Handled = true;
            }
            else if (e.Control && e.KeyCode == Keys.C && !grid.IsCurrentCellInEditMode)
            {
                object v = grid.CurrentCell.Value;
                if (v != null && Convert.ToString(v).Length > 0) Clipboard.SetText(Convert.ToString(v));
                e.Handled = true;
            }
        }

        /// <summary>Dán từ Excel: 1 số vào ô đang chọn, hoặc 1 cột số vào các ô nhập kế tiếp cùng cột.</summary>
        void DanSo(int r, int c)
        {
            string text = Clipboard.ContainsText() ? Clipboard.GetText() : "";
            var lines = text.Replace("\r", "").Split('\n').Select(x => x.Split('\t')[0].Trim()).ToList();
            while (lines.Count > 0 && lines[lines.Count - 1].Length == 0) lines.RemoveAt(lines.Count - 1);
            if (lines.Count == 0) return;
            var rows = new List<int>();
            for (int i = r; i < dong.Count && rows.Count < lines.Count; i++) if (CoTheSua(i, c)) rows.Add(i);
            if (lines.Count > 1)
            {
                if (!Ui.Confirm(this, "Dán " + lines.Count + " giá trị vào " + rows.Count + " ô nhập liên tiếp của cột \"" +
                                      grid.Columns[c].HeaderText.Replace("\n", " ") + "\",\ntừ dòng " + dong[rows[0]] + "\nđến dòng " + dong[rows[rows.Count - 1]] + "?"))
                    return;
            }
            int bad = 0;
            for (int i = 0; i < rows.Count; i++)
            {
                double? v;
                if (c == cGc) dong[rows[i]].GhiChu = lines[i];
                else if (So.TryDoc(lines[i], out v))
                {
                    Muc m = dong[rows[i]];
                    if (c == cCu) m.ChiSoCu = v;
                    else if (c == cMoi) m.ChiSoMoi = v;
                    else if (c == cSl) m.SanLuong = v;
                    else if (c == cCt) m.ChuanThu = v;
                }
                else bad++;
            }
            phien.Luu(this);
            CapNhatGiaTri();
            HienChiTiet();
            if (bad > 0) Ui.Error(this, bad + " giá trị không phải là số nên bị bỏ qua.");
        }

        // ------------------------------------------------------------------ vẽ mô tả công thức trải qua 2 cột chỉ số

        void Grid_CellPainting(object sender, DataGridViewCellPaintingEventArgs e)
        {
            if (e.RowIndex < 0 || e.RowIndex >= dong.Count || (e.ColumnIndex != cCu && e.ColumnIndex != cMoi)) return;
            Muc m = dong[e.RowIndex];
            if (m.Loai != LoaiMuc.CongThuc) return;
            e.PaintBackground(e.CellBounds, true);
            if (e.ColumnIndex == cCu)
            {
                using (var b = new SolidBrush(e.CellStyle.BackColor))
                    e.Graphics.FillRectangle(b, e.CellBounds.Right - 1, e.CellBounds.Top, 1, e.CellBounds.Height - 1);
            }
            Rectangle a = grid.GetCellDisplayRectangle(cCu, e.RowIndex, false), b2 = grid.GetCellDisplayRectangle(cMoi, e.RowIndex, false);
            Rectangle full = a.IsEmpty ? b2 : b2.IsEmpty ? a : Rectangle.Union(a, b2);
            if (full.IsEmpty) full = e.CellBounds;
            string text = m.MoTa != null && m.MoTa.Length > 0 ? m.MoTa : CongThucText.HienThi(thang, m, m.CongThuc);
            var clip = e.Graphics.Clip;
            e.Graphics.SetClip(e.CellBounds);
            var rect = new Rectangle(full.Left + Ui.S(4), full.Top, full.Width - Ui.S(8), full.Height);
            TextRenderer.DrawText(e.Graphics, text, MoTaFont, rect, Ui.Muted,
                                  TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            e.Graphics.Clip = clip;
            e.Handled = true;
        }

        void HienChiTiet()
        {
            if (dangNap || !moChiTiet) return;
            int r = grid.CurrentCell != null ? grid.CurrentCell.RowIndex : -1;
            chiTiet.Hien(thang, r >= 0 && r < dong.Count ? dong[r] : null);
        }

        // ------------------------------------------------------------------ thao tác tháng

        void TaoThangMoi()
        {
            KetThucSua();
            if (phien.Dl.ThangCuoi == null)
            {
                TaoThangDauTien();
                return;
            }
            ThaoTacThang.TaoThangSau(this, phien, true);
        }

        void TaoThangDauTien()
        {
            using (var f = new ChonThangForm(DateTime.Today.AddMonths(-1)))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
                if (phien.Dl.TimThang(f.Nam, f.Thang) != null)
                {
                    Ui.Error(this, "Đã có tháng " + f.Thang + "/" + f.Nam + ".");
                    return;
                }
                ThangBaoCao t = phien.Dl.TaoThangTrong(f.Nam, f.Thang);
                phien.Dl.Thang.Add(t);
                phien.Dl.SapXep();
                phien.ChonThang(t);
                phien.Luu(null);
                Ui.Info(this, "Đã tạo " + t.Ten + " với cấu trúc trống.\nVào \"Cấu trúc mạng lưới\" để thêm đội, khu vực, đồng hồ và công thức.");
                if (MoCauTruc != null) MoCauTruc(this, EventArgs.Empty);
            }
        }

        void SuaThongTin()
        {
            if (thang == null) return;
            KetThucSua();
            using (var f = new KyBaoCaoForm(phien.Dl, thang))
            {
                if (f.ShowDialog(this) == DialogResult.OK) phien.Luu(null);
            }
        }

        void XoaThang()
        {
            if (thang == null) return;
            KetThucSua();
            ThangBaoCao sau = phien.Dl.TimThang(thang.SoThu + 1);
            string msg = "Xoá toàn bộ số liệu " + thang.Ten + "?" +
                         (sau != null ? "\n\nLưu ý: " + sau.Ten.ToLower() + " đang nối lũy kế và so sánh với tháng này." : "") +
                         "\n\nBản sao lưu đầu ngày vẫn còn trong thư mục DuLieu\\SaoLuu.";
            if (!Ui.Confirm(this, msg)) return;
            phien.Dl.Thang.Remove(thang);
            phien.ChonThang(phien.Dl.ThangCuoi);
            phien.Luu(null);
        }
    }

    /// <summary>Thẻ nhỏ: tỷ lệ thất thoát của 1 đội / toàn công ty, so kế hoạch.</summary>
    class TheDonVi : Control
    {
        public int Id;
        public string Ten = "";
        public double? TyLe, KeHoach, SoThangTruoc;
        public bool Lon, ThieuSoLieu;

        public TheDonVi()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
            Cursor = Cursors.Hand;
            BackColor = Ui.Surface;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Lon ? Ui.Primary : Ui.Surface);
            Color fg = Lon ? Color.White : Ui.Text, muted = Lon ? Color.FromArgb(0xD5, 0xE3, 0xF1) : Ui.Muted;
            if (!Lon) using (var pen = new Pen(Ui.Border)) g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
            bool vuot = TyLe.HasValue && KeHoach.HasValue && TyLe > KeHoach;
            if (!Lon && TyLe.HasValue && KeHoach.HasValue)
                using (var b = new SolidBrush(vuot ? Ui.Danger : Ui.Success)) g.FillRectangle(b, 0, 0, Ui.S(4), Height);
            int x = Ui.S(12);
            TextRenderer.DrawText(g, Ten, Ui.SmallBold, new Rectangle(x, Ui.S(6), Width - x - Ui.S(6), Ui.S(18)), muted, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            string pct = TyLe.HasValue ? So.P2(TyLe) + "%" : "—";
            TextRenderer.DrawText(g, pct, Ui.CardNumber, new Point(x - Ui.S(3), Ui.S(22)), Lon ? Color.White : (vuot ? Ui.Danger : fg), TextFormatFlags.NoPrefix);
            string sub = (KeHoach.HasValue ? "KH " + So.P2(KeHoach) + "%" : "") +
                         (SoThangTruoc.HasValue ? (KeHoach.HasValue ? " · " : "") + "T.trước " + So.Lech(SoThangTruoc) : "");
            if (ThieuSoLieu) sub = "Chưa nhập đủ số liệu";
            TextRenderer.DrawText(g, sub, Ui.Small, new Rectangle(x, Height - Ui.S(22), Width - x - Ui.S(4), Ui.S(18)),
                                  ThieuSoLieu ? (Lon ? Color.FromArgb(0xFF, 0xE0, 0x9E) : Ui.Warning) : muted, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        }
    }

    /// <summary>Chọn tháng / năm (tạo tháng đầu tiên).</summary>
    class ChonThangForm : Form
    {
        readonly NumericUpDown numThang, numNam;
        public int Thang { get { return (int)numThang.Value; } }
        public int Nam { get { return (int)numNam.Value; } }

        public ChonThangForm(DateTime macDinh)
        {
            Text = "Tạo tháng đầu tiên";
            Font = Ui.Base;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(340), Ui.S(150));
            var flow = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = Ui.Pad(16), FlowDirection = FlowDirection.TopDown };
            var line = new FlowLayoutPanel { AutoSize = true };
            line.Controls.Add(Ui.MakeLabel("Tháng", Ui.Base, Ui.Text));
            numThang = new NumericUpDown { Minimum = 1, Maximum = 12, Value = macDinh.Month, Width = Ui.S(60), Font = Ui.Base };
            line.Controls.Add(numThang);
            line.Controls.Add(Ui.MakeLabel("Năm", Ui.Base, Ui.Text));
            numNam = new NumericUpDown { Minimum = 2000, Maximum = 2100, Value = macDinh.Year, Width = Ui.S(80), Font = Ui.Base };
            line.Controls.Add(numNam);
            flow.Controls.Add(line);
            var buttons = new FlowLayoutPanel { AutoSize = true, Margin = Ui.Pad(0, 20, 0, 0) };
            var ok = Ui.MakeButton("Tạo", true);
            ok.DialogResult = DialogResult.OK;
            var cancel = Ui.MakeButton("Huỷ", false);
            cancel.DialogResult = DialogResult.Cancel;
            buttons.Controls.Add(ok);
            buttons.Controls.Add(cancel);
            flow.Controls.Add(buttons);
            Controls.Add(flow);
            AcceptButton = ok;
            CancelButton = cancel;
        }
    }
}
