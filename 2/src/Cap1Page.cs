using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Đồng hồ cấp 1 (đầu bơm khai thác) tại các trạm cấp nước — tách riêng với báo cáo thất thoát.
    /// Danh mục theo cấp Đội → Trạm → Đồng hồ (giếng / nước mặt); mỗi tháng nhập chỉ số → sản lượng khai thác,
    /// cộng theo trạm, đội, nguồn nước, lũy kế năm (tháng 1 bắt đầu lại).
    /// </summary>
    public class Cap1Page : UserControl, ITrang
    {
        const int cStt = 0, cTen = 1, cNguon = 2, cCu = 3, cMoi = 4, cSl = 5, cTt = 6, cTg = 7, cLk = 8, cGc = 9;
        static readonly Color TongRow = Color.FromArgb(0xFF, 0xF6, 0xD9);

        enum LoaiDong { Doi, Tram, DongHo, Tong, Nguon }

        class Dong
        {
            public LoaiDong Loai;
            public NhomDoiCap1 Doi;
            public NhomTramCap1 Tram;
            public DongHoCap1 DongHo;
            public NguonNuoc Nguon;
            public string Stt = "";
        }

        class MucKy
        {
            public KyCap1 Ky;
            public override string ToString() { return Ky.Ten; }
        }

        class MucDoi
        {
            public DoiCap1 Doi;
            public override string ToString() { return Doi == null ? "Tất cả các đội" : Doi.Ten; }
        }

        readonly PhienLam phien;
        readonly ComboBox cboKy, cboDoi;
        readonly Button btnTao, btnThem, btnSua, btnXoa, btnLen, btnXuong, btnChiTiet, btnDanhMuc, btnThongTin, btnNhap, btnXuat, btnIn, btnCheDo;
        readonly LuoiNhap grid;
        readonly DataGridView gridNam;
        readonly Label lblTomTat, lblKy;
        readonly TheCap1[] the = new TheCap1[4];
        readonly Panel manTrong;
        readonly ToolTip tip = new ToolTip();
        readonly ContextMenuStrip menuXuat;
        KyCap1 ky;
        List<Dong> dong = new List<Dong>();
        List<Dong> dongNam = new List<Dong>();
        int doiChon = -1;
        bool dangNap, xemNam;

        DuLieuCap1 Dl { get { return phien.Dl.Cap1; } }

        public Cap1Page(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;

            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 0, 0, 2) };
            var title = Ui.MakeLabel("Đồng hồ cấp 1", Ui.Title, Ui.Text);
            title.Margin = Ui.Pad(0, 0, 16, 0);
            top.Controls.Add(title);
            cboKy = Ui.MakeCombo(130);
            cboKy.Margin = Ui.Pad(0, 7, 8, 0);
            cboKy.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap) return;
                var m = cboKy.SelectedItem as MucKy;
                if (m == null) return;
                KetThucSua();
                ky = m.Ky;
                Nap();
            };
            top.Controls.Add(cboKy);
            cboDoi = Ui.MakeCombo(190);
            cboDoi.Margin = Ui.Pad(0, 7, 12, 0);
            cboDoi.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap) return;
                var m = cboDoi.SelectedItem as MucDoi;
                doiChon = m != null && m.Doi != null ? m.Doi.Id : -1;
                KetThucSua();
                Nap();
            };
            top.Controls.Add(cboDoi);
            btnTao = Ui.MakeButton("+ Tạo tháng mới", true);
            btnTao.Click += (s, e) => TaoThang();
            btnThem = Ui.MakeButton("+ Thêm đồng hồ", false);
            btnThem.Click += (s, e) => Them();
            btnSua = Ui.MakeButton("Sửa…", false);
            btnSua.Click += (s, e) => Sua();
            btnXoa = Ui.MakeButton("Xoá", false);
            btnXoa.Click += (s, e) => Xoa();
            btnLen = Ui.MakeButton("▲", false);
            btnLen.Click += (s, e) => DiChuyen(-1);
            btnXuong = Ui.MakeButton("▼", false);
            btnXuong.Click += (s, e) => DiChuyen(1);
            btnChiTiet = Ui.MakeButton("Thay ĐH / lũy kế…", false);
            btnChiTiet.Click += (s, e) => ChiTiet();
            btnDanhMuc = Ui.MakeButton("Đội && trạm…", false);
            btnDanhMuc.Click += (s, e) => DanhMuc();
            btnThongTin = Ui.MakeButton("Thông tin tháng…", false);
            btnThongTin.Click += (s, e) => ThongTin();
            btnNhap = Ui.MakeButton("Nhập từ Excel…", false);
            btnNhap.Click += (s, e) => NhapExcel();
            btnXuat = QuyenUi.ChoXem(Ui.MakeButton("Xuất Excel ▾", false));
            menuXuat = new ContextMenuStrip { Font = Ui.Base };
            btnXuat.Click += (s, e) => { KetThucSua(); TaoMenuXuat(false); menuXuat.Show(btnXuat, new Point(0, btnXuat.Height)); };
            btnIn = QuyenUi.ChoXem(Ui.MakeButton("In ▾", false));
            btnIn.Click += (s, e) => { KetThucSua(); TaoMenuXuat(true); menuXuat.Show(btnIn, new Point(0, btnIn.Height)); };
            tip.SetToolTip(btnIn, "In thẳng báo cáo sản lượng khai thác tháng hoặc tổng hợp năm (xem trước, chọn máy in) — không cần mở Excel");
            btnCheDo = QuyenUi.ChoXem(Ui.MakeButton("Xem cả năm", false));
            btnCheDo.Click += (s, e) => DoiCheDo();
            foreach (Button b in new[] { btnTao, btnThem, btnSua, btnXoa, btnLen, btnXuong, btnChiTiet, btnDanhMuc, btnThongTin, btnNhap, btnXuat, btnIn, btnCheDo })
            {
                b.Margin = Ui.Pad(0, 4, 8, 0);
                top.Controls.Add(b);
            }
            btnLen.MinimumSize = btnXuong.MinimumSize = new Size(Ui.S(40), Ui.S(34));
            tip.SetToolTip(btnTao, "Tạo tháng kế tiếp: chép danh sách đồng hồ đang dùng, chỉ số tháng trước = chỉ số hiện tại của tháng cuối");
            tip.SetToolTip(btnThem, "Thêm đồng hồ cấp 1 vào 1 trạm (phím Insert)");
            tip.SetToolTip(btnSua, "Sửa tên, trạm, nguồn nước, hệ số của đồng hồ (hoặc tên trạm / đội) — nhấp đúp vào tên cũng được");
            tip.SetToolTip(btnXoa, "Bỏ đồng hồ khỏi tháng đang xem và các tháng sau (ngừng dùng); số liệu các tháng trước vẫn giữ");
            tip.SetToolTip(btnLen, "Đưa lên trên (đồng hồ trong trạm, trạm trong đội, đội)");
            tip.SetToolTip(btnXuong, "Đưa xuống dưới");
            tip.SetToolTip(btnChiTiet, "Thay đồng hồ / đồng hồ quay vòng trong tháng, lũy kế các tháng trước, ghi chú");
            tip.SetToolTip(btnDanhMuc, "Danh mục đội, trạm cấp nước: thêm, đổi tên, chuyển trạm sang đội khác, xoá");
            tip.SetToolTip(btnThongTin, "Hoá đơn kỳ, thời gian khai thác, ngày lập báo cáo; xoá tháng cuối");
            tip.SetToolTip(btnNhap, "Lấy số liệu từ file Excel \"BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG …\" (đội → trạm → TLK cấp I)");
            tip.SetToolTip(btnCheDo, "Bảng sản lượng khai thác 12 tháng trong năm của từng đồng hồ / trạm / đội");

            lblKy = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblKy.Dock = DockStyle.Top;
            lblKy.Padding = Ui.Pad(2, 4, 0, 4);

            var theHost = new FlowLayoutPanel { Dock = DockStyle.Top, Height = Ui.S(84), WrapContents = false, Padding = Ui.Pad(0, 2, 0, 8) };
            for (int i = 0; i < the.Length; i++)
            {
                the[i] = new TheCap1 { Lon = i == 0, Size = new Size(Ui.S(i == 0 ? 270 : 240), Ui.S(72)), Margin = Ui.Pad(0, 0, 10, 0) };
                theHost.Controls.Add(the[i]);
            }
            theHost.Resize += (s, e) =>
            {
                // 4 thẻ co theo bề ngang trang (màn hình nhỏ / 125% không bị cắt thẻ cuối)
                int w = (theHost.ClientSize.Width - 3 * Ui.S(10) - Ui.S(2)) / 4;
                w = Math.Max(Ui.S(170), Math.Min(Ui.S(270), w));
                foreach (TheCap1 t in the) t.Width = w;
            };
            the[1].Vach = Color.FromArgb(0x2E, 0x7D, 0x6B);
            the[2].Vach = Color.FromArgb(0x2B, 0x6C, 0xA3);
            the[3].Vach = Color.FromArgb(0x8A, 0x9B, 0xB0);

            var huongDan = new Label
            {
                Dock = DockStyle.Top,
                AutoSize = false,
                Height = Ui.S(36),
                Font = Ui.Small,
                ForeColor = Ui.Muted,
                Padding = Ui.Pad(2, 0, 0, 4),
                Text = "Nhập chỉ số hiện tại từng đồng hồ (Enter xuống dòng) → sản lượng khai thác = hiện tại − tháng trước, tự cộng theo trạm, đội, nước giếng / nước mặt. " +
                       "Đồng hồ hỏng: gõ thẳng sản lượng vào cột Sản lượng. Thay đồng hồ / quay vòng: nút \"Thay ĐH / lũy kế…\". Cột Ghi chú của dòng trạm = thời gian chốt số."
            };

            grid = new LuoiNhap { Dock = DockStyle.Fill };
            Ui.StyleGrid(grid);
            grid.SelectionMode = DataGridViewSelectionMode.CellSelect;
            grid.MultiSelect = false;
            grid.EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2;
            grid.ShowCellToolTips = true;
            string[] heads = { "STT", "Đội / trạm / đồng hồ", "Nguồn", "Chỉ số\ntháng trước", "Chỉ số\nhiện tại", "Sản lượng\nkhai thác (m³)", "Tháng trước\n(m³)",
                               "Tăng /\ngiảm", "Lũy kế\nnăm (m³)", "Ghi chú / thời gian chốt" };
            int[] widths = { 50, 310, 90, 104, 104, 118, 108, 82, 116, 220 };
            for (int i = 0; i < heads.Length; i++) grid.Columns.Add(Ui.Col(heads[i], widths[i], i >= cCu && i != cGc));
            grid.Columns[cGc].AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill;
            grid.Columns[cGc].MinimumWidth = Ui.S(160);
            grid.Columns[cStt].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            grid.Columns[cNguon].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            grid.Columns[cStt].Frozen = true;
            grid.Columns[cTen].Frozen = true;
            grid.CoTheSua = CoTheSua;
            grid.CellBeginEdit += (s, e) => { if (!CoTheSua(e.RowIndex, e.ColumnIndex)) e.Cancel = true; };
            grid.CellEndEdit += Grid_CellEndEdit;
            grid.CellDoubleClick += Grid_CellDoubleClick;
            grid.KeyDown += Grid_KeyDown;
            grid.CurrentCellChanged += (s, e) => CapNhatNut();
            grid.DataError += (s, e) => e.ThrowException = false;

            gridNam = new DataGridView { Dock = DockStyle.Fill, Visible = false, ReadOnly = true };
            Ui.StyleGrid(gridNam);
            gridNam.SelectionMode = DataGridViewSelectionMode.CellSelect;
            gridNam.ShowCellToolTips = true;
            gridNam.Columns.Add(Ui.Col("STT", 50, false));
            gridNam.Columns.Add(Ui.Col("Đội / trạm / đồng hồ", 300, false));
            gridNam.Columns.Add(Ui.Col("Nguồn", 90, false));
            for (int t = 1; t <= 12; t++) gridNam.Columns.Add(Ui.Col("Tháng\n" + t, 96, true));
            gridNam.Columns.Add(Ui.Col("Cộng năm", 118, true));
            gridNam.Columns[15].ToolTipText = "Cộng sản lượng các tháng có trong phần mềm (lũy kế nhập tay của các tháng trước không tính ở đây)";
            gridNam.Columns[0].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            gridNam.Columns[2].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            gridNam.Columns[0].Frozen = true;
            gridNam.Columns[1].Frozen = true;

            manTrong = TaoManHinhTrong();

            lblTomTat = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblTomTat.Dock = DockStyle.Bottom;
            lblTomTat.Padding = Ui.Pad(2, 8, 0, 0);

            var host = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            host.Controls.Add(grid);
            host.Controls.Add(gridNam);
            host.Controls.Add(manTrong);
            Controls.Add(host);
            Controls.Add(lblTomTat);
            Controls.Add(huongDan);
            Controls.Add(theHost);
            Controls.Add(lblKy);
            Controls.Add(top);
            phien.DaDoi += (s, e) => { if (Visible && s != this) KhiHien(); };
        }

        Panel TaoManHinhTrong()
        {
            var p = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Background, Visible = false };
            var card = Ui.MakeCard();
            card.Width = Ui.S(680);
            card.Height = Ui.S(250);
            card.Location = new Point(Ui.S(16), Ui.S(16));
            var flow = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false };
            flow.Controls.Add(Ui.MakeLabel("Chưa có tháng khai thác nào", Ui.Section, Ui.Text));
            var l = Ui.MakeLabel("Cách nhanh nhất: nhập file Excel báo cáo sản lượng nước đang dùng (\"BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG 09/2026\" — đội → trạm / nhà máy → TLK cấp I). " +
                                 "Phần mềm tự lập danh mục đội, trạm, đồng hồ và lấy chỉ số tháng đó.\n\n" +
                                 "Hoặc tạo tháng đầu tiên rồi thêm từng đồng hồ: tên đồng hồ, giếng hay nước mặt, ở trạm nào, trạm thuộc đội nào.", Ui.Base, Ui.Muted);
            l.MaximumSize = new Size(Ui.S(640), 0);
            l.Margin = Ui.Pad(0, 8, 0, 14);
            flow.Controls.Add(l);
            var buttons = new FlowLayoutPanel { AutoSize = true, WrapContents = false };
            var b1 = Ui.MakeButton("Nhập từ file Excel…", true);
            b1.Click += (s, e) => NhapExcel();
            var b2 = Ui.MakeButton("Tạo tháng đầu tiên…", false);
            b2.Click += (s, e) => TaoThang();
            buttons.Controls.Add(b1);
            buttons.Controls.Add(b2);
            flow.Controls.Add(buttons);
            card.Controls.Add(flow);
            p.Controls.Add(card);
            return p;
        }

        public void KetThucSua()
        {
            if (grid.IsCurrentCellInEditMode) grid.EndEdit();
        }

        public void KhiHien()
        {
            dangNap = true;
            try
            {
                Cap1Ops.KhoiTaoDoi(phien.Dl);
                if (ky != null && !Dl.Ky.Contains(ky)) ky = Dl.TimKy(ky.SoThu);   // dữ liệu vừa tải lại từ máy chủ: giữ tháng đang xem
                if (ky == null) ky = Dl.KyCuoi;
                cboKy.Items.Clear();
                foreach (KyCap1 k in Dl.Ky.AsEnumerable().Reverse()) cboKy.Items.Add(new MucKy { Ky = k });
                foreach (MucKy m in cboKy.Items) if (m.Ky == ky) cboKy.SelectedItem = m;
                cboDoi.Items.Clear();
                cboDoi.Items.Add(new MucDoi());
                foreach (DoiCap1 d in Dl.Doi) cboDoi.Items.Add(new MucDoi { Doi = d });
                MucDoi chon = cboDoi.Items.Cast<MucDoi>().FirstOrDefault(x => x.Doi != null && x.Doi.Id == doiChon);
                if (chon == null) doiChon = -1;
                cboDoi.SelectedItem = chon ?? cboDoi.Items[0];
                KyCap1 cuoi = Dl.KyCuoi;
                btnTao.Text = cuoi == null ? "+ Tạo tháng đầu tiên" : "+ Tạo tháng " + (cuoi.Thang == 12 ? "1/" + (cuoi.Nam + 1) : (cuoi.Thang + 1) + "/" + cuoi.Nam);
            }
            finally
            {
                dangNap = false;
            }
            Nap();
        }

        // ------------------------------------------------------------------ nạp bảng tháng

        void Nap()
        {
            lblKy.Text = ky == null ? "" : MoTaKy(ky);
            manTrong.Visible = ky == null;
            grid.Visible = ky != null && !xemNam;
            gridNam.Visible = ky != null && xemNam;
            if (xemNam && ky != null)
            {
                NapNam();
                CapNhatThe();
                CapNhatNut();
                return;
            }
            Dong cur = DongChon();
            int curId = cur != null && cur.Loai == LoaiDong.DongHo ? cur.DongHo.Id : -1;
            int curCol = grid.CurrentCell != null ? grid.CurrentCell.ColumnIndex : cMoi;
            dangNap = true;
            try
            {
                grid.Rows.Clear();
                dong = new List<Dong>();
                if (ky == null)
                {
                    lblTomTat.Text = "Chưa có tháng khai thác nào — nhập file Excel báo cáo sản lượng hoặc tạo tháng đầu tiên.";
                    CapNhatThe();
                    return;
                }
                dong = TaoDong(ky.ChiSo.Select(c => c.DongHoId));
                if (dong.Count > 0) grid.Rows.Add(dong.Count);
                for (int r = 0; r < dong.Count; r++) KieuDong(grid.Rows[r], dong[r], true);
                CapNhatGiaTri();
                if (dong.Count > 0)
                {
                    int idx = dong.FindIndex(x => x.Loai == LoaiDong.DongHo && x.DongHo.Id == curId);
                    if (idx < 0) idx = dong.FindIndex(x => x.Loai == LoaiDong.DongHo);
                    if (idx < 0) idx = 0;
                    int col = CoTheSua(idx, curCol) ? curCol : (dong[idx].Loai == LoaiDong.DongHo ? cMoi : cTen);
                    grid.CurrentCell = grid.Rows[idx].Cells[col];
                }
            }
            finally
            {
                dangNap = false;
            }
            CapNhatNut();
        }

        List<Dong> TaoDong(IEnumerable<int> ids)
        {
            var list = new List<Dong>();
            var cay = Dl.Cay(ids, doiChon);
            for (int i = 0; i < cay.Count; i++)
            {
                NhomDoiCap1 nd = cay[i];
                list.Add(new Dong { Loai = LoaiDong.Doi, Doi = nd, Stt = So.LaMa(i + 1) });
                for (int j = 0; j < nd.Tram.Count; j++)
                {
                    NhomTramCap1 nt = nd.Tram[j];
                    list.Add(new Dong { Loai = LoaiDong.Tram, Doi = nd, Tram = nt, Stt = (j + 1).ToString() });
                    for (int k = 0; k < nt.DongHo.Count; k++)
                        list.Add(new Dong { Loai = LoaiDong.DongHo, Doi = nd, Tram = nt, DongHo = nt.DongHo[k], Stt = (j + 1) + "." + (k + 1) });
                }
            }
            if (cay.Count > 0)
            {
                if (doiChon < 0 && cay.Count > 1) list.Add(new Dong { Loai = LoaiDong.Tong });
                list.Add(new Dong { Loai = LoaiDong.Nguon, Nguon = NguonNuoc.Gieng });
                list.Add(new Dong { Loai = LoaiDong.Nguon, Nguon = NguonNuoc.NuocMat });
            }
            return list;
        }

        void KieuDong(DataGridViewRow row, Dong d, bool thang)
        {
            row.Cells[cStt].Value = d.Stt;
            DataGridViewCell ten = row.Cells[cTen];
            switch (d.Loai)
            {
                case LoaiDong.Doi:
                    row.DefaultCellStyle.Font = Ui.BaseBold;
                    row.DefaultCellStyle.BackColor = Ui.GroupRow;
                    ten.Value = d.Doi.Doi.Ten.ToUpper(So.VN);
                    ten.Style.Padding = new Padding(Ui.S(4), 0, Ui.S(3), 0);
                    ten.ToolTipText = d.Doi.Doi.Ten + "\nNhấp đúp để đổi tên đội";
                    break;
                case LoaiDong.Tram:
                    row.DefaultCellStyle.Font = Ui.BaseBold;
                    row.DefaultCellStyle.BackColor = Ui.AreaRow;
                    ten.Value = d.Tram.Tram.Ten;
                    ten.Style.Padding = new Padding(Ui.S(16), 0, Ui.S(3), 0);
                    ten.ToolTipText = d.Tram.Tram.Ten + " — " + d.Doi.Doi.Ten + "\nNhấp đúp để đổi tên / chuyển sang đội khác";
                    break;
                case LoaiDong.DongHo:
                    DongHoCap1 dh = d.DongHo;
                    ten.Value = dh.Ten;
                    ten.Style.Padding = new Padding(Ui.S(30), 0, Ui.S(3), 0);
                    ten.ToolTipText = dh.Ten + "\n" + DuLieuCap1.TenNguonDai(dh.Nguon) + " · " + d.Tram.Tram.Ten + " · " + d.Doi.Doi.Ten +
                                      (dh.HeSo != 1 ? "\nHệ số nhân ×" + So.Nhap(dh.HeSo) : "") + (dh.GhiChu.Length > 0 ? "\n" + dh.GhiChu : "") +
                                      (thang ? "\nNhấp đúp để sửa tên, trạm, nguồn nước" : "");
                    break;
                case LoaiDong.Tong:
                    row.DefaultCellStyle.Font = Ui.BaseBold;
                    row.DefaultCellStyle.BackColor = TongRow;
                    ten.Value = "TỔNG CỘNG TOÀN CÔNG TY";
                    ten.Style.Padding = new Padding(Ui.S(4), 0, Ui.S(3), 0);
                    break;
                case LoaiDong.Nguon:
                    row.DefaultCellStyle.Font = Ui.BaseItalic;
                    row.DefaultCellStyle.BackColor = TongRow;
                    ten.Value = (d.Nguon == NguonNuoc.Gieng ? "Trong đó: nước giếng (nước ngầm)" : "Trong đó: nước mặt") + (doiChon >= 0 ? " của đội" : "");
                    ten.Style.Padding = new Padding(Ui.S(16), 0, Ui.S(3), 0);
                    row.Cells[cNguon].Value = DuLieuCap1.TenNguon(d.Nguon);
                    break;
            }
        }

        static string MoTaKy(KyCap1 k)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(k.KyHoaDon)) parts.Add("Hoá đơn kỳ " + k.KyHoaDon);
            if (k.TuNgay.HasValue && k.DenNgay.HasValue) parts.Add("nước khai thác từ " + So.Ngay(k.TuNgay) + " đến " + So.Ngay(k.DenNgay));
            else parts.Add("chưa ghi thời gian khai thác (nút \"Thông tin tháng…\")");
            return k.Ten + " · " + string.Join(" · ", parts);
        }

        static string NguonCua(IEnumerable<DongHoCap1> list)
        {
            var n = list.Select(x => x.Nguon).Distinct().ToList();
            if (n.Count == 0) return "";
            return n.Count == 1 ? DuLieuCap1.TenNguon(n[0]) : "Cả hai";
        }

        string TangGiam(double? v, double? truoc, out Color mau)
        {
            mau = Ui.Muted;
            if (!v.HasValue || !truoc.HasValue || truoc.Value == 0) return "";
            double p = (v.Value - truoc.Value) / truoc.Value * 100;
            if (Math.Abs(p) >= phien.Dl.CaiDat.NguongCanhBao) mau = Ui.Warning;
            return So.Lech(p) + "%";
        }

        Func<DongHoCap1, bool> LocDoi(TinhCap1 tinh)
        {
            return doiChon >= 0 ? tinh.CuaDoi(doiChon) : TinhCap1.TatCa;
        }

        void CapNhatGiaTri()
        {
            if (ky == null) return;
            var tinh = new TinhCap1(Dl);
            var kq = tinh.Tinh(ky);
            Func<DongHoCap1, bool> locDoi = LocDoi(tinh);
            int soDh = 0, coSl = 0, am = 0;
            for (int r = 0; r < dong.Count && r < grid.RowCount; r++)
            {
                Dong d = dong[r];
                DataGridViewRow row = grid.Rows[r];
                Color mau;
                if (d.Loai == LoaiDong.DongHo)
                {
                    DongHoCap1 dh = d.DongHo;
                    ChiSoCap1 cs = ky.Tim(dh.Id);
                    KetQuaCap1 k = kq[dh.Id];
                    soDh++;
                    if (k.SanLuong.HasValue) coSl++;
                    row.Cells[cNguon].Value = DuLieuCap1.TenNguon(dh.Nguon);
                    row.Cells[cNguon].Style.ForeColor = dh.Nguon == NguonNuoc.Gieng ? the[1].Vach : the[2].Vach;
                    row.Cells[cCu].Value = So.N0(cs.ChiSoCu);
                    row.Cells[cMoi].Value = So.N0(cs.ChiSoMoi);
                    row.Cells[cSl].Value = So.M3(k.SanLuong);
                    row.Cells[cTt].Value = So.M3(k.ThangTruoc);
                    row.Cells[cTg].Value = TangGiam(k.SanLuong, k.ThangTruoc, out mau);
                    row.Cells[cTg].Style.ForeColor = mau;
                    row.Cells[cLk].Value = So.M3(k.LuyKe);
                    string gc = (cs.GhiChu ?? "").Replace("\n", " ");
                    if (cs.ThayDongHo) gc = "Thay ĐH" + (gc.Length > 0 ? " · " + gc : "");
                    row.Cells[cGc].Value = gc;
                    for (int c = cCu; c <= cGc; c++)
                        row.Cells[c].Style.BackColor = CoTheSua(r, c) && c != cGc ? Ui.Input : Color.Empty;
                    row.Cells[cSl].Style.ForeColor = k.AmChiSo ? Ui.Danger : cs.SanLuongNhap.HasValue ? Ui.Primary : Ui.Text;
                    row.Cells[cSl].ToolTipText = k.AmChiSo
                        ? "Chỉ số hiện tại nhỏ hơn tháng trước — đồng hồ quay vòng hay thay mới? Bấm \"Thay ĐH / lũy kế…\""
                        : cs.SanLuongNhap.HasValue ? "Sản lượng gõ thẳng (không tính theo chỉ số). Xoá ô (phím Delete) để tính lại theo chỉ số."
                        : (k.CachTinh.Length > 0 ? k.CachTinh + "\n" : "") + "Đồng hồ hỏng / ước tính: gõ thẳng sản lượng vào ô này";
                    if (k.AmChiSo) am++;
                    row.Cells[cLk].ToolTipText = ky.Thang == 1 ? "Tháng 1: lũy kế bắt đầu lại" :
                        cs.LuyKeTruoc.HasValue ? "Lũy kế = sản lượng tháng này + " + So.M3(cs.LuyKeTruoc) + " (lũy kế các tháng trước nhập tay)" :
                        "Lũy kế = sản lượng tháng này + lũy kế tháng trước";
                    continue;
                }
                TongCap1 t;
                switch (d.Loai)
                {
                    case LoaiDong.Doi:
                        t = tinh.Tong(ky, d.Doi.Loc);
                        row.Cells[cNguon].Value = NguonCua(d.Doi.Tram.SelectMany(x => x.DongHo));
                        break;
                    case LoaiDong.Tram:
                        t = tinh.Tong(ky, d.Tram.Loc);
                        row.Cells[cNguon].Value = NguonCua(d.Tram.DongHo);
                        row.Cells[cGc].Value = d.Tram.Tram.Id >= 0 ? ky.LayThoiGianChot(d.Tram.Tram.Id) : "";
                        row.Cells[cGc].Style.BackColor = d.Tram.Tram.Id >= 0 ? Ui.Input : Color.Empty;
                        row.Cells[cGc].Style.Font = Ui.BaseItalic;
                        row.Cells[cGc].ToolTipText = "Thời gian chốt số của trạm (vd Từ 6h 21/8 đến 6h 21/9) — in ở cột chỉ số trong báo cáo Excel";
                        break;
                    case LoaiDong.Tong:
                        t = tinh.Tong(ky, TinhCap1.TatCa);
                        break;
                    default:
                        NguonNuoc n = d.Nguon;
                        t = tinh.Tong(ky, x => locDoi(x) && x.Nguon == n);
                        break;
                }
                row.Cells[cSl].Value = So.M3(t.SanLuong);
                row.Cells[cTt].Value = So.M3(t.ThangTruoc);
                row.Cells[cTg].Value = TangGiam(t.SanLuong, t.ThangTruoc, out mau);
                row.Cells[cTg].Style.ForeColor = mau;
                row.Cells[cLk].Value = So.M3(t.LuyKe);
                row.Cells[cSl].ToolTipText = t.SoChuaNhap > 0 ? t.SoChuaNhap + "/" + t.SoDongHo + " đồng hồ chưa có sản lượng" : "";
                row.Cells[cSl].Style.ForeColor = t.SoChuaNhap > 0 ? Ui.Warning : Ui.Text;
            }
            lblTomTat.Text = ky.Ten + ": " + soDh + " đồng hồ" + (doiChon >= 0 ? " của đội đang chọn" : "") + ", đã có sản lượng " + coSl +
                             (soDh > coSl ? ", còn " + (soDh - coSl) + " chưa nhập chỉ số hiện tại" : "") +
                             (am > 0 ? ". " + am + " đồng hồ có chỉ số hiện tại nhỏ hơn tháng trước (tô đỏ)" : "") +
                             ". Mọi thay đổi được lưu ngay; số liệu này tách riêng, không ảnh hưởng báo cáo thất thoát.";
            CapNhatThe();
        }

        void CapNhatThe()
        {
            if (ky == null)
            {
                foreach (TheCap1 t in the) { t.GiaTri = "—"; t.Phu = ""; t.Invalidate(); }
                the[0].Ten = "Tổng sản lượng khai thác";
                the[1].Ten = "Nước giếng (nước ngầm)";
                the[2].Ten = "Nước mặt";
                the[3].Ten = "Lũy kế năm";
                return;
            }
            var tinh = new TinhCap1(Dl);
            Func<DongHoCap1, bool> loc = LocDoi(tinh);
            TongCap1 tong = tinh.Tong(ky, loc);
            TongCap1 g = tinh.Tong(ky, x => loc(x) && x.Nguon == NguonNuoc.Gieng);
            TongCap1 m = tinh.Tong(ky, x => loc(x) && x.Nguon == NguonNuoc.NuocMat);
            Color mau;
            string doi = doiChon >= 0 ? " — " + Dl.TimDoi(doiChon).Ten : "";
            the[0].Ten = "Tổng khai thác " + ky.Ten.ToLower() + doi;
            the[0].GiaTri = So.M3(tong.SanLuong) + " m³";
            string tg = TangGiam(tong.SanLuong, tong.ThangTruoc, out mau);
            the[0].Phu = tong.SoDongHo + " đồng hồ" + (tong.ThangTruoc.HasValue ? " · tháng trước " + So.M3(tong.ThangTruoc) + (tg.Length > 0 ? " (" + tg + ")" : "") : "") +
                         (tong.SoChuaNhap > 0 ? " · " + tong.SoChuaNhap + " chưa nhập" : "");
            foreach (var p in new[] { new { The = the[1], T = g, Ten = "Nước giếng (nước ngầm)" }, new { The = the[2], T = m, Ten = "Nước mặt" } })
            {
                p.The.Ten = p.Ten;
                p.The.GiaTri = So.M3(p.T.SanLuong) + " m³";
                tg = TangGiam(p.T.SanLuong, p.T.ThangTruoc, out mau);
                p.The.Phu = p.T.SoDongHo == 0 ? "Không có đồng hồ" :
                            (tong.SanLuong > 0 ? So.P2(p.T.SanLuong / tong.SanLuong * 100) + "% tổng · " : "") + p.T.SoDongHo + " đồng hồ" + (tg.Length > 0 ? " · " + tg : "");
            }
            the[3].Ten = "Lũy kế năm " + ky.Nam + " (đến " + ky.Ten.ToLower() + ")";
            the[3].GiaTri = So.M3(tong.LuyKe) + " m³";
            the[3].Phu = "Giếng " + So.M3(g.LuyKe) + " · mặt " + So.M3(m.LuyKe);
            foreach (TheCap1 t in the) t.Invalidate();
        }

        // ------------------------------------------------------------------ bảng cả năm

        void NapNam()
        {
            gridNam.Rows.Clear();
            int nam = ky.Nam;
            var kys = new KyCap1[13];
            foreach (KyCap1 k in Dl.Ky.Where(x => x.Nam == nam)) kys[k.Thang] = k;
            var tinh = new TinhCap1(Dl);
            Func<DongHoCap1, bool> locDoi = LocDoi(tinh);
            dongNam = TaoDong(Dl.Ky.Where(x => x.Nam == nam).SelectMany(x => x.ChiSo.Select(c => c.DongHoId)).Distinct());
            if (dongNam.Count > 0) gridNam.Rows.Add(dongNam.Count);
            // chỉ hiện các tháng đã có số liệu (bảng gọn, thấy được cột Cộng năm)
            for (int t = 1; t <= 12; t++) gridNam.Columns[2 + t].Visible = kys[t] != null;
            for (int r = 0; r < dongNam.Count; r++)
            {
                Dong d = dongNam[r];
                DataGridViewRow row = gridNam.Rows[r];
                KieuDong(row, d, false);
                Func<DongHoCap1, bool> loc;
                switch (d.Loai)
                {
                    case LoaiDong.DongHo:
                        int id = d.DongHo.Id;
                        loc = x => x.Id == id;
                        row.Cells[cNguon].Value = DuLieuCap1.TenNguon(d.DongHo.Nguon);
                        break;
                    case LoaiDong.Tram: loc = d.Tram.Loc; row.Cells[cNguon].Value = NguonCua(d.Tram.DongHo); break;
                    case LoaiDong.Doi: loc = d.Doi.Loc; row.Cells[cNguon].Value = NguonCua(d.Doi.Tram.SelectMany(x => x.DongHo)); break;
                    case LoaiDong.Tong: loc = TinhCap1.TatCa; break;
                    default:
                        NguonNuoc n = d.Nguon;
                        loc = x => locDoi(x) && x.Nguon == n;
                        break;
                }
                double cong = 0;
                for (int t = 1; t <= 12; t++)
                {
                    if (kys[t] == null) continue;
                    double? v;
                    if (d.Loai == LoaiDong.DongHo)
                    {
                        KetQuaCap1 k;
                        v = tinh.Tinh(kys[t]).TryGetValue(d.DongHo.Id, out k) ? k.SanLuong : null;
                    }
                    else
                    {
                        TongCap1 tc = tinh.Tong(kys[t], loc);
                        v = tc.SoDongHo > 0 ? tc.SanLuong : (double?)null;
                    }
                    row.Cells[2 + t].Value = So.M3(v);
                    cong += v ?? 0;
                }
                row.Cells[15].Value = So.M3(cong);
                row.Cells[15].Style.Font = Ui.BaseBold;
            }
            int soThang = kys.Count(x => x != null);
            lblTomTat.Text = "Năm " + nam + ": " + soThang + " tháng có số liệu" + (soThang > 0 ? " (" + string.Join(", ", Enumerable.Range(1, 12).Where(t => kys[t] != null).Select(t => "T" + t)) + ")" : "") +
                             ". Sản lượng khai thác từng tháng theo đồng hồ, trạm, đội, nguồn nước; bấm \"Xem theo tháng\" để nhập số.";
        }

        void DoiCheDo()
        {
            KetThucSua();
            xemNam = !xemNam;
            btnCheDo.Text = xemNam ? "Xem theo tháng" : "Xem cả năm";
            Nap();
        }

        // ------------------------------------------------------------------ nhập số

        bool CoTheSua(int r, int c)
        {
            if (xemNam || r < 0 || r >= dong.Count) return false;
            Dong d = dong[r];
            if (d.Loai == LoaiDong.DongHo) return c == cCu || c == cMoi || c == cSl || c == cGc;
            if (d.Loai == LoaiDong.Tram) return c == cGc && d.Tram.Tram.Id >= 0;
            return false;
        }

        Dong DongChon()
        {
            if (xemNam) return null;
            int r = grid.CurrentCell != null ? grid.CurrentCell.RowIndex : -1;
            return r >= 0 && r < dong.Count ? dong[r] : null;
        }

        void Grid_CellEndEdit(object sender, DataGridViewCellEventArgs e)
        {
            if (dangNap || !CoTheSua(e.RowIndex, e.ColumnIndex)) return;
            string text = Convert.ToString(grid.Rows[e.RowIndex].Cells[e.ColumnIndex].Value);
            if (!Ghi(e.RowIndex, e.ColumnIndex, text))
            {
                grid.GiuO = true;
                CapNhatGiaTri();
                Rectangle rc = grid.GetCellDisplayRectangle(e.ColumnIndex, e.RowIndex, false);
                tip.Show("\"" + text + "\" không phải số hợp lệ. Gõ dạng 531218 hoặc 531.218", grid, rc.Left, rc.Bottom + Ui.S(2), 3500);
            }
        }

        bool Ghi(int r, int c, string text)
        {
            Dong d = dong[r];
            if (d.Loai == LoaiDong.Tram)
            {
                int id = d.Tram.Tram.Id;
                string g = (text ?? "").Trim();
                if (g == ky.LayThoiGianChot(id)) return true;
                if (g.Length == 0) ky.ThoiGianChot.Remove(id);
                else ky.ThoiGianChot[id] = g;
            }
            else
            {
                ChiSoCap1 cs = ky.Tim(d.DongHo.Id);
                if (cs == null) return true;
                if (c == cGc)
                {
                    string g = (text ?? "").Trim();
                    if (g.StartsWith("Thay ĐH")) g = g.Substring(7).TrimStart(' ', '·');
                    if (g == (cs.GhiChu ?? "")) { CapNhatGiaTri(); return true; }
                    cs.GhiChu = g;
                }
                else
                {
                    double? v;
                    if (!So.TryDoc(text, out v)) return false;
                    switch (c)
                    {
                        case cCu:
                            if (Nullable.Equals(cs.ChiSoCu, v)) { CapNhatGiaTri(); return true; }
                            cs.ChiSoCu = v;
                            break;
                        case cMoi:
                            if (Nullable.Equals(cs.ChiSoMoi, v)) { CapNhatGiaTri(); return true; }
                            Cap1Ops.DatChiSoMoi(Dl, ky, cs, v);
                            break;
                        case cSl:
                            string ct;
                            double? tinh = TinhCap1.SanLuong(new ChiSoCap1 { ChiSoCu = cs.ChiSoCu, ChiSoMoi = cs.ChiSoMoi, ChotCu = cs.ChotCu, DauMoi = cs.DauMoi }, d.DongHo, out ct);
                            // gõ lại đúng số đang tính theo chỉ số (F2 rồi Enter) thì không coi là nhập thẳng
                            if (Nullable.Equals(cs.SanLuongNhap, v) || (!cs.SanLuongNhap.HasValue && v.HasValue && tinh.HasValue && Math.Abs(tinh.Value - v.Value) < 0.005))
                            {
                                CapNhatGiaTri();
                                return true;
                            }
                            cs.SanLuongNhap = v;
                            break;
                        default:
                            return false;
                    }
                }
            }
            phien.Luu(this);
            CapNhatGiaTri();
            return true;
        }

        void Grid_KeyDown(object sender, KeyEventArgs e)
        {
            if (grid.CurrentCell == null || grid.IsCurrentCellInEditMode) return;
            int r = grid.CurrentCell.RowIndex, c = grid.CurrentCell.ColumnIndex;
            if (e.KeyCode == Keys.Delete && CoTheSua(r, c))
            {
                Ghi(r, c, "");
                e.Handled = true;
            }
            else if (e.KeyCode == Keys.Insert)
            {
                Them();
                e.Handled = true;
            }
        }

        void Grid_CellDoubleClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0 || e.RowIndex >= dong.Count) return;
            Dong d = dong[e.RowIndex];
            if (e.ColumnIndex == cTen || e.ColumnIndex == cStt || e.ColumnIndex == cNguon) Sua();
            else if (d.Loai == LoaiDong.DongHo && (e.ColumnIndex == cSl || e.ColumnIndex == cTt || e.ColumnIndex == cTg || e.ColumnIndex == cLk)) ChiTiet();
        }

        void CapNhatNut()
        {
            Dong d = DongChon();
            bool coKy = ky != null, thang = coKy && !xemNam;
            bool danhMuc = d != null && (d.Loai == LoaiDong.DongHo || ((d.Loai == LoaiDong.Tram || d.Loai == LoaiDong.Doi) && (d.Tram != null ? d.Tram.Tram.Id : d.Doi.Doi.Id) >= 0));
            btnThem.Enabled = thang;
            btnSua.Enabled = btnLen.Enabled = btnXuong.Enabled = thang && danhMuc;
            btnXoa.Enabled = thang && d != null && d.Loai == LoaiDong.DongHo;
            btnChiTiet.Enabled = thang && d != null && d.Loai == LoaiDong.DongHo;
            btnThongTin.Enabled = btnXuat.Enabled = btnIn.Enabled = btnCheDo.Enabled = coKy;
        }

        void ChonDongHo(int id, int col)
        {
            int r = dong.FindIndex(x => x.Loai == LoaiDong.DongHo && x.DongHo.Id == id);
            if (r < 0) return;
            try { grid.CurrentCell = grid.Rows[r].Cells[col]; }
            catch (InvalidOperationException) { }
            grid.Focus();
        }

        void ChonDong(Func<Dong, bool> chon)
        {
            int r = dong.FindIndex(x => chon(x));
            if (r < 0) return;
            try { grid.CurrentCell = grid.Rows[r].Cells[cTen]; }
            catch (InvalidOperationException) { }
            grid.Focus();
        }

        // ------------------------------------------------------------------ tháng

        void TaoThang()
        {
            KetThucSua();
            KyCap1 cuoi = Dl.KyCuoi;
            KyCap1 moi;
            if (cuoi == null)
            {
                using (var f = new ChonThangForm(DateTime.Today.AddMonths(-1)))
                {
                    f.Text = "Tạo tháng khai thác đầu tiên";
                    if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                    moi = Cap1Ops.TaoKyDau(Dl, f.Nam, f.Thang);
                }
            }
            else
            {
                int nam = cuoi.Thang == 12 ? cuoi.Nam + 1 : cuoi.Nam, thang = cuoi.Thang == 12 ? 1 : cuoi.Thang + 1;
                int thieu = cuoi.ChiSo.Count(c =>
                {
                    DongHoCap1 dh = Dl.TimDongHo(c.DongHoId);
                    return dh != null && !dh.Ngung && !c.ChiSoMoi.HasValue;
                });
                string msg = "Tạo tháng " + thang + "/" + nam + " để nhập chỉ số đồng hồ cấp 1?\n\n" +
                             "Chỉ số tháng trước của từng đồng hồ = chỉ số hiện tại " + cuoi.Ten.ToLower() + "; " +
                             (thang == 1 ? "lũy kế bắt đầu lại từ tháng 1/" + nam + "." : "lũy kế năm cộng tiếp.") +
                             (thieu > 0 ? "\n\nLưu ý: " + cuoi.Ten + " còn " + thieu + " đồng hồ chưa nhập chỉ số hiện tại — ô chỉ số tháng trước của các đồng hồ đó sẽ để trống." : "");
                if (!Ui.Confirm(FindForm(), msg)) return;
                moi = Cap1Ops.TaoKySau(Dl, cuoi);
            }
            Dl.Ky.Add(moi);
            Dl.SapXep();
            ky = moi;
            if (xemNam) DoiCheDo();
            phien.Luu(this);
            KhiHien();
            Dong dau = dong.FirstOrDefault(x => x.Loai == LoaiDong.DongHo);
            if (dau != null) ChonDongHo(dau.DongHo.Id, cMoi);
            lblTomTat.Text = "Đã tạo " + moi.Ten.ToLower() + " với " + moi.ChiSo.Count + " đồng hồ" +
                             (moi.ChiSo.Count == 0 ? " — bấm \"+ Thêm đồng hồ\" để thêm đồng hồ cấp 1 của từng trạm." : " — nhập chỉ số hiện tại (Enter để xuống dòng). ") +
                             (moi.ChiSo.Count > 0 ? lblTomTat.Text : "");
        }

        void ThongTin()
        {
            if (ky == null) return;
            KetThucSua();
            using (var f = new KyCap1Form(Dl, ky))
            {
                DialogResult kq = f.ShowDialog(FindForm());
                if (kq == DialogResult.Abort)
                {
                    Dl.Ky.Remove(ky);
                    ky = Dl.KyCuoi;
                }
                else if (kq != DialogResult.OK) return;
            }
            phien.Luu(this);
            KhiHien();
        }

        // ------------------------------------------------------------------ danh mục

        TramCap1 TramMacDinh()
        {
            Dong d = DongChon();
            if (d != null && d.Tram != null && d.Tram.Tram.Id >= 0) return d.Tram.Tram;
            return null;
        }

        void Them()
        {
            if (ky == null || xemNam) return;
            KetThucSua();
            using (var f = new DongHoCap1Form(Dl, null, TramMacDinh(), doiChon, ky))
            {
                DialogResult kq = f.ShowDialog(FindForm());
                if (kq != DialogResult.OK)
                {
                    if (f.DaDoiDanhMuc) { phien.Luu(this); KhiHien(); }
                    return;
                }
                var dh = new DongHoCap1 { Id = Dl.CapId() };
                f.GhiVao(dh);
                Dl.DongHo.Add(dh);
                Cap1Ops.DuaVaoTuKy(Dl, ky, dh.Id);
                ChiSoCap1 cs = ky.Tim(dh.Id);
                if (cs != null && f.ChiSoDau.HasValue) cs.ChiSoCu = f.ChiSoDau;
                phien.Luu(this);
                KhiHien();
                ChonDongHo(dh.Id, cs != null && cs.ChiSoCu.HasValue ? cMoi : cCu);
            }
        }

        void Sua()
        {
            Dong d = DongChon();
            if (d == null) return;
            KetThucSua();
            switch (d.Loai)
            {
                case LoaiDong.DongHo:
                    using (var f = new DongHoCap1Form(Dl, d.DongHo, null, -1, ky))
                    {
                        DialogResult kq = f.ShowDialog(FindForm());
                        if (kq == DialogResult.OK) f.GhiVao(d.DongHo);
                        if (kq != DialogResult.OK && !f.DaDoiDanhMuc) return;
                    }
                    phien.Luu(this);
                    KhiHien();
                    ChonDongHo(d.DongHo.Id, cMoi);
                    break;
                case LoaiDong.Tram:
                    if (d.Tram.Tram.Id < 0) return;
                    using (var f = new TramCap1Form(Dl, d.Tram.Tram, -1))
                    {
                        if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                        f.GhiVao(d.Tram.Tram);
                    }
                    phien.Luu(this);
                    KhiHien();
                    int tid = d.Tram.Tram.Id;
                    ChonDong(x => x.Loai == LoaiDong.Tram && x.Tram.Tram.Id == tid);
                    break;
                case LoaiDong.Doi:
                    if (d.Doi.Doi.Id < 0) return;
                    using (var f = new TenCap1Form("Đổi tên đội", "Tên đội", d.Doi.Doi.Ten))
                    {
                        if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                        d.Doi.Doi.Ten = f.Ten;
                    }
                    phien.Luu(this);
                    KhiHien();
                    break;
            }
        }

        void Xoa()
        {
            Dong d = DongChon();
            if (d == null || d.Loai != LoaiDong.DongHo) return;
            KetThucSua();
            DongHoCap1 dh = d.DongHo;
            bool coTruoc = Dl.Ky.Any(k => k.SoThu < ky.SoThu && k.Tim(dh.Id) != null);
            int sau = Dl.Ky.Count(k => k.SoThu > ky.SoThu && k.Tim(dh.Id) != null);
            string phamVi = ky.Ten.ToLower() + (sau > 0 ? " và " + sau + " tháng sau" : "");
            string msg = coTruoc
                ? "Ngừng dùng đồng hồ \"" + dh.Ten + "\" (" + d.Tram.Tram.Ten + ") từ " + phamVi + "?\n\nSố liệu các tháng trước vẫn giữ và vẫn cộng vào lũy kế năm; tháng mới tạo sẽ không chép đồng hồ này nữa."
                : "Xoá đồng hồ \"" + dh.Ten + "\" (" + d.Tram.Tram.Ten + ") khỏi " + phamVi + "?\n\nĐồng hồ không có ở tháng nào trước đó nên sẽ xoá hẳn khỏi danh mục.";
            if (!Ui.Confirm(FindForm(), msg)) return;
            Cap1Ops.BoTuKy(Dl, ky, dh.Id);
            phien.Luu(this);
            KhiHien();
        }

        void DiChuyen(int huong)
        {
            Dong d = DongChon();
            if (d == null) return;
            KetThucSua();
            KyCap1 k = ky;
            Func<TramCap1, bool> coDongHo = t => Dl.DongHoCuaTram(t.Id).Any(x => k.Tim(x.Id) != null);
            bool doi = false;
            switch (d.Loai)
            {
                case LoaiDong.DongHo:
                    doi = Cap1Ops.DiChuyen(Dl.DongHo, d.DongHo, (a, b) => a.TramId == b.TramId && k.Tim(a.Id) != null, huong);
                    break;
                case LoaiDong.Tram:
                    if (d.Tram.Tram.Id >= 0)
                        doi = Cap1Ops.DiChuyen(Dl.Tram, d.Tram.Tram, (a, b) => a.DoiId == b.DoiId && coDongHo(a), huong);
                    break;
                case LoaiDong.Doi:
                    if (d.Doi.Doi.Id >= 0)
                        doi = Cap1Ops.DiChuyen(Dl.Doi, d.Doi.Doi, (a, b) => Dl.TramCuaDoi(a.Id).Any(coDongHo), huong);
                    break;
            }
            if (!doi) return;
            phien.Luu(this);
            Nap();
            if (d.Loai == LoaiDong.DongHo) ChonDongHo(d.DongHo.Id, grid.CurrentCell != null ? grid.CurrentCell.ColumnIndex : cMoi);
            else if (d.Loai == LoaiDong.Tram) ChonDong(x => x.Loai == LoaiDong.Tram && x.Tram.Tram == d.Tram.Tram);
            else ChonDong(x => x.Loai == LoaiDong.Doi && x.Doi.Doi == d.Doi.Doi);
        }

        void ChiTiet()
        {
            Dong d = DongChon();
            if (d == null || d.Loai != LoaiDong.DongHo) return;
            KetThucSua();
            ChiSoCap1 cs = ky.Tim(d.DongHo.Id);
            if (cs == null) return;
            using (var f = new ChiTietCap1Form(Dl, ky, d.DongHo, cs))
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
            phien.Luu(this);
            CapNhatGiaTri();
            ChonDongHo(d.DongHo.Id, cSl);
        }

        void DanhMuc()
        {
            KetThucSua();
            Cap1Ops.KhoiTaoDoi(phien.Dl);
            using (var f = new DanhMucCap1Form(Dl, ky))
            {
                f.ShowDialog(FindForm());
                if (f.DaDoi) phien.Luu(this);
            }
            KhiHien();
        }

        // ------------------------------------------------------------------ Excel

        void NhapExcel()
        {
            KetThucSua();
            using (var f = new NhapCap1Form(phien))
            {
                f.ShowDialog(FindForm());
                if (f.KyMoi != null) ky = f.KyMoi;
            }
            KhiHien();
        }

        void TaoMenuXuat(bool inRa)
        {
            menuXuat.Items.Clear();
            if (ky == null) return;
            DoiCap1 doi = doiChon >= 0 ? Dl.TimDoi(doiChon) : null;
            KyCap1 k = ky;
            int dc = doiChon;
            string dv = doi != null ? " — " + doi.Ten : "";
            string lam = inRa ? "In " : "Xuất Excel ";
            menuXuat.Items.Add(lam + "báo cáo sản lượng khai thác " + k.Ten.ToLower() + dv + "…", null, (s, e) =>
                XuatPage.XuatHoacIn(this, phien, () => new BaoCaoCap1(phien.Dl).SoThang(k, dc), BaoCaoCap1.TenFileThang(k, doi), inRa));
            menuXuat.Items.Add(lam + "tổng hợp khai thác năm " + k.Nam + " (12 tháng)" + dv + "…", null, (s, e) =>
                XuatPage.XuatHoacIn(this, phien, () => new BaoCaoCap1(phien.Dl).SoNam(k.Nam, dc), BaoCaoCap1.TenFileNam(k.Nam, doi), inRa));
        }
    }

    /// <summary>Thẻ số tổng (tổng khai thác, nước giếng, nước mặt, lũy kế).</summary>
    class TheCap1 : Control
    {
        public string Ten = "", GiaTri = "—", Phu = "";
        public bool Lon;
        public Color Vach = Color.Empty;

        public TheCap1()
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
