using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>
    /// Noise logger — dò tìm rò rỉ bằng thiết bị ghi tiếng ồn ban đêm.
    /// Điểm đo: mỗi đêm nhập / nhập file mức ồn, độ trải, tần số của từng điểm đặt logger → phần mềm phân loại
    /// nghi rò rỉ / cần theo dõi / bình thường theo ngưỡng và mức nền. Ca rò rỉ: theo dõi dò tìm → sửa → nước tiết kiệm.
    /// Thiết bị: danh mục logger, đang lắp ở đâu.
    /// </summary>
    public class NoiseLoggerPage : UserControl, ITrang
    {
        enum CheDo { Diem, RoRi, ThietBi }

        const int cStt = 0, cTen = 1, cLoai = 2, cTb = 3, cMuc = 4, cTrai = 5, cTan = 6, cDem1 = 7;
        const int cNen = cDem1 + BaoCaoNl.SoDemTruoc, cKl = cNen + 1, cGc = cKl + 1;
        static readonly Color NenRo = Color.FromArgb(0xFB, 0xD5, 0xD5), NenTheoDoi = Color.FromArgb(0xFF, 0xEB, 0xB0);
        static readonly Color MauTheoDoi = Color.FromArgb(0xA8, 0x5F, 0x00);

        class DongDiem
        {
            public NhomDiemNl Nhom;     // dòng tiêu đề nhóm (đơn vị) khi Diem == null
            public DiemNl Diem;
            public KetQuaNl Kq;
            public string Stt = "";
        }

        readonly PhienNl phien;
        readonly ComboBox cboDonVi, cboNam;
        readonly DateTimePicker dtDem;
        readonly FlowLayoutPanel nutDiem, nutRoRi, nutTb, hangNgay, hangNam;
        readonly Button btnSuaDiem, btnXoaDiem, btnLap, btnThemRoRiDiem, btnSuaRoRi, btnXoaRoRi, btnSuaTb, btnXoaTb, btnLapTb;
        readonly CheckBox chkNgung;
        readonly LuoiNhap gridDiem;
        readonly DataGridView gridRoRi, gridTb;
        readonly BieuDoNl bieuDo;
        readonly Panel manTrong, khungBieuDo;
        readonly Label lblTomTat, lblTieuDe, huongDan;
        readonly TheSo[] the = new TheSo[4];
        readonly ToolTip tip = new ToolTip();
        readonly ContextMenuStrip menuXuat = new ContextMenuStrip { Font = Ui.Base };
        CheDo cheDo = CheDo.Diem;
        DateTime ngay = DateTime.Today;
        bool daChonNgay, dangNap;
        int donViLoc = -1;
        List<DongDiem> dong = new List<DongDiem>();
        List<RoRiNl> dsRoRi = new List<RoRiNl>();
        List<ThietBiNl> dsTb = new List<ThietBiNl>();

        DuLieuNl Dl { get { return phien.Dl; } }

        public NoiseLoggerPage(PhienNl phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;

            // ---- hàng 1: tiêu đề, lọc đơn vị, đêm (chọn Điểm đo / Ca rò rỉ / Thiết bị ở thanh menu bên trái)
            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 0, 0, 2) };
            lblTieuDe = Ui.MakeLabel("Điểm đo", Ui.Title, Ui.Text);
            lblTieuDe.Margin = Ui.Pad(0, 0, 16, 0);
            top.Controls.Add(lblTieuDe);
            cboDonVi = Ui.MakeCombo(250);
            cboDonVi.Margin = Ui.Pad(0, 7, 12, 0);
            cboDonVi.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap) return;
                var m = cboDonVi.SelectedItem as MucDonViNl;
                donViLoc = m != null ? m.Id : -1;
                KetThucSua();
                Nap();
            };
            top.Controls.Add(cboDonVi);
            tip.SetToolTip(cboDonVi, "Lọc theo đội / khu vực / vùng DMA (danh sách ở mục \"Đội / vùng DMA\")");

            hangNgay = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            var lblDem = Ui.MakeLabel("Đêm", Ui.Base, Ui.Text);
            lblDem.Margin = Ui.Pad(0, 10, 4, 0);
            hangNgay.Controls.Add(lblDem);
            var btnTruoc = Ui.MakeButton("◀", false);
            btnTruoc.Click += (s, e) => DoiNgay(ngay.AddDays(-1));
            dtDem = Ui.MakeDatePicker(false);
            dtDem.Margin = Ui.Pad(0, 7, 4, 0);
            dtDem.ValueChanged += (s, e) => { if (!dangNap) DoiNgay(dtDem.Value.Date); };
            var btnSau = Ui.MakeButton("▶", false);
            btnSau.Click += (s, e) => DoiNgay(ngay.AddDays(1));
            var btnMoiNhat = Ui.MakeButton("Đêm mới nhất", false);
            btnMoiNhat.Click += (s, e) => { DateTime? m = NgayMoiNhat(); DoiNgay(m ?? DateTime.Today); };
            foreach (Button b in new[] { btnTruoc, btnSau, btnMoiNhat })
            {
                b.MinimumSize = new Size(Ui.S(b == btnMoiNhat ? 72 : 36), Ui.S(34));
                b.Margin = Ui.Pad(0, 4, 4, 0);
            }
            hangNgay.Controls.Add(btnTruoc);
            hangNgay.Controls.Add(dtDem);
            hangNgay.Controls.Add(btnSau);
            hangNgay.Controls.Add(btnMoiNhat);
            tip.SetToolTip(btnTruoc, "Đêm trước (Alt+←)");
            tip.SetToolTip(btnSau, "Đêm sau (Alt+→)");
            tip.SetToolTip(btnMoiNhat, "Về đêm mới nhất có số đo");
            tip.SetToolTip(dtDem, "Ngày của buổi sáng ghi số (đêm 15 rạng sáng 16 → chọn 16)");
            top.Controls.Add(hangNgay);

            hangNam = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0), Visible = false };
            var lblNam = Ui.MakeLabel("Năm", Ui.Base, Ui.Text);
            lblNam.Margin = Ui.Pad(0, 10, 4, 0);
            cboNam = Ui.MakeCombo(130);
            cboNam.Margin = Ui.Pad(0, 7, 8, 0);
            cboNam.SelectedIndexChanged += (s, e) => { if (!dangNap) Nap(); };
            hangNam.Controls.Add(lblNam);
            hangNam.Controls.Add(cboNam);
            top.Controls.Add(hangNam);

            // ---- hàng 2: nút thao tác của từng chế độ
            nutDiem = HangNut();
            var btnThemDiem = Nut(nutDiem, "+ Thêm điểm", true, (s, e) => ThemDiem(), "Thêm điểm đặt logger: van, trụ cứu hoả, đồng hồ… (phím Insert)");
            btnSuaDiem = Nut(nutDiem, "Sửa…", false, (s, e) => SuaDiem(), "Sửa tên, loại, đội / DMA của điểm — nhấp đúp vào tên cũng được");
            btnXoaDiem = Nut(nutDiem, "Xoá", false, (s, e) => XoaDiem(), "Xoá điểm chưa có số liệu; điểm đã có số đo thì ngừng dùng (số đo cũ vẫn giữ)");
            btnLap = Nut(nutDiem, "Lắp / thu logger…", false, (s, e) => LapThu(DiemChon()), "Ghi lắp logger vào điểm, thu logger về, chuyển logger sang điểm khác");
            Nut(nutDiem, "Nhập số đo từ file…", false, (s, e) => NhapFile(), "Nhập file CSV / Excel xuất từ phần mềm của hãng logger (mã logger, ngày, mức ồn, độ trải, tần số)");
            btnThemRoRiDiem = Nut(nutDiem, "+ Ca rò rỉ…", false, (s, e) => ThemRoRi(), "Ghi ca rò rỉ cho điểm đang chọn: chờ dò tìm → xác định → đã sửa");
            Nut(nutDiem, "Ngưỡng…", false, (s, e) => SuaNguong(), "Ngưỡng mức ồn, độ trải, số đêm liên tiếp để kết luận nghi rò rỉ / cần theo dõi");
            NutXuat(nutDiem);
            chkNgung = new CheckBox { Text = "Cả điểm đã ngừng", AutoSize = true, Margin = Ui.Pad(4, 10, 0, 0) };
            chkNgung.CheckedChanged += (s, e) => Nap();
            nutDiem.Controls.Add(chkNgung);
            btnThemDiem.Tag = "chinh";

            nutRoRi = HangNut();
            Nut(nutRoRi, "+ Ca rò rỉ…", true, (s, e) => ThemRoRi(), "Thêm ca rò rỉ phát hiện nhờ logger");
            btnSuaRoRi = Nut(nutRoRi, "Sửa…", false, (s, e) => SuaRoRi(), "Cập nhật trạng thái, vị trí rò, ngày sửa, lưu lượng rò — nhấp đúp dòng cũng được");
            btnXoaRoRi = Nut(nutRoRi, "Xoá", false, (s, e) => XoaRoRi(), "Xoá ca rò rỉ ghi nhầm");
            NutXuat(nutRoRi);

            nutTb = HangNut();
            Nut(nutTb, "+ Thêm logger", true, (s, e) => ThemTb(), "Thêm logger vào danh mục (mã / số seri như trong file của hãng)");
            btnSuaTb = Nut(nutTb, "Sửa…", false, (s, e) => SuaTb(), "Sửa mã, hãng / model, đánh dấu hỏng — nhấp đúp dòng cũng được");
            btnXoaTb = Nut(nutTb, "Xoá", false, (s, e) => XoaTb(), "Xoá logger chưa từng lắp (logger đã dùng thì đánh dấu hỏng ở Sửa…)");
            btnLapTb = Nut(nutTb, "Thu về / chuyển…", false, (s, e) => LapThuTb(), "Logger đang lắp: thu về hoặc chuyển sang điểm khác");
            NutXuat(nutTb);

            var nutHost = new Panel { Dock = DockStyle.Top, AutoSize = true };
            nutHost.Controls.Add(nutDiem);
            nutHost.Controls.Add(nutRoRi);
            nutHost.Controls.Add(nutTb);

            // ---- thẻ số
            var theHost = new FlowLayoutPanel { Dock = DockStyle.Top, Height = Ui.S(84), WrapContents = false, Padding = Ui.Pad(0, 6, 0, 6) };
            for (int i = 0; i < the.Length; i++)
            {
                the[i] = new TheSo { Lon = i == 0, Size = new Size(Ui.S(i == 0 ? 270 : 240), Ui.S(72)), Margin = Ui.Pad(0, 0, 10, 0) };
                theHost.Controls.Add(the[i]);
            }
            theHost.Resize += (s, e) =>
            {
                int w = (theHost.ClientSize.Width - 3 * Ui.S(10) - Ui.S(2)) / 4;
                w = Math.Max(Ui.S(170), Math.Min(Ui.S(290), w));
                foreach (TheSo t in the) t.Width = w;
            };
            the[1].Vach = Ui.Danger;
            the[2].Vach = Color.FromArgb(0xE0, 0x9A, 0x00);
            the[3].Vach = Ui.Success;

            huongDan = new Label { Dock = DockStyle.Top, AutoSize = false, Height = Ui.S(36), Font = Ui.Small, ForeColor = Ui.Muted, Padding = Ui.Pad(2, 0, 0, 4) };

            // ---- lưới điểm đo
            gridDiem = new LuoiNhap { Dock = DockStyle.Fill };
            Ui.StyleGrid(gridDiem);
            gridDiem.SelectionMode = DataGridViewSelectionMode.CellSelect;
            gridDiem.MultiSelect = false;
            gridDiem.EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2;
            gridDiem.ShowCellToolTips = true;
            string[] heads = { "STT", "Điểm đặt logger", "Loại", "Logger", "Mức ồn\n(dB)", "Độ trải", "Tần số\n(Hz)" };
            int[] widths = { 46, 260, 86, 84, 72, 64, 66 };
            for (int i = 0; i < heads.Length; i++) gridDiem.Columns.Add(Ui.Col(heads[i], widths[i], i >= cMuc));
            for (int i = 0; i < BaoCaoNl.SoDemTruoc; i++) gridDiem.Columns.Add(Ui.Col("", 52, true));
            gridDiem.Columns.Add(Ui.Col("Mức nền\n(dB)", 70, true));
            gridDiem.Columns.Add(Ui.Col("Kết luận", 112, false));
            gridDiem.Columns.Add(Ui.Col("Lý do / ca rò rỉ", 260, false));
            gridDiem.Columns[cGc].AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill;
            gridDiem.Columns[cGc].MinimumWidth = Ui.S(180);
            gridDiem.Columns[cStt].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            gridDiem.Columns[cLoai].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            gridDiem.Columns[cTb].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            gridDiem.Columns[cKl].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            gridDiem.Columns[cMuc].DefaultCellStyle.Font = Ui.BaseBold;
            gridDiem.Columns[cStt].Frozen = true;
            gridDiem.Columns[cTen].Frozen = true;
            gridDiem.Columns[cMuc].ToolTipText = "Mức ồn tối thiểu ban đêm của đêm đang xem — gõ số rồi Enter để xuống điểm kế tiếp";
            gridDiem.Columns[cTrai].ToolTipText = "Độ trải (spread): nhỏ = tiếng ồn đều, liên tục cả đêm (dấu hiệu rò)";
            gridDiem.Columns[cNen].ToolTipText = "Mức nền: trung vị mức ồn các đêm trong 30 ngày trước tuần gần nhất (cần ≥ 3 đêm)";
            gridDiem.CoTheSua = CoTheSua;
            gridDiem.CellBeginEdit += (s, e) => { if (!CoTheSua(e.RowIndex, e.ColumnIndex)) e.Cancel = true; };
            gridDiem.CellEndEdit += GridDiem_CellEndEdit;
            gridDiem.CellDoubleClick += GridDiem_CellDoubleClick;
            gridDiem.KeyDown += GridDiem_KeyDown;
            gridDiem.CurrentCellChanged += (s, e) => { if (!dangNap) { CapNhatNut(); CapNhatBieuDo(); } };
            gridDiem.DataError += (s, e) => e.ThrowException = false;
            gridDiem.CellPainting += GridDiem_CellPainting;

            // ---- lưới ca rò rỉ
            gridRoRi = TaoLuoiXem(new[] { "STT", "Ngày\nphát hiện", "Điểm logger", "Đội / DMA", "Vị trí rò", "Hạng mục", "Trạng thái", "Ngày sửa", "Số ngày\nxử lý",
                                          "Lưu lượng\nrò (m³/h)", "Tiết kiệm\n(m³/tháng)", "Mức ồn trước\n→ sau sửa (dB)", "Ghi chú" },
                                  new[] { 46, 96, 230, 160, 220, 150, 150, 96, 74, 86, 96, 116, 200 }, new[] { 8, 9, 10 });
            gridRoRi.CellDoubleClick += (s, e) => { if (e.RowIndex >= 0) SuaRoRi(); };
            gridRoRi.CurrentCellChanged += (s, e) => { if (!dangNap) { CapNhatNut(); CapNhatBieuDo(); } };
            gridRoRi.KeyDown += (s, e) => { if (e.KeyCode == Keys.Delete) { XoaRoRi(); e.Handled = true; } else if (e.KeyCode == Keys.Insert) { ThemRoRi(); e.Handled = true; } };

            // ---- lưới thiết bị
            gridTb = TaoLuoiXem(new[] { "STT", "Mã logger", "Hãng / model", "Trạng thái", "Đang lắp tại", "Từ ngày", "Số đêm\ncó số đo", "Số đo\nmới nhất", "Ghi chú" },
                                new[] { 46, 130, 220, 110, 280, 96, 80, 96, 220 }, new[] { 6 });
            gridTb.CellDoubleClick += (s, e) => { if (e.RowIndex >= 0) SuaTb(); };
            gridTb.CurrentCellChanged += (s, e) => { if (!dangNap) CapNhatNut(); };
            gridTb.KeyDown += (s, e) => { if (e.KeyCode == Keys.Delete) { XoaTb(); e.Handled = true; } else if (e.KeyCode == Keys.Insert) { ThemTb(); e.Handled = true; } };

            manTrong = TaoManHinhTrong();

            bieuDo = new BieuDoNl { Dock = DockStyle.Fill };
            khungBieuDo = new Panel { Dock = DockStyle.Bottom, Height = Ui.S(220), Padding = Ui.Pad(0, 8, 0, 0), BackColor = Ui.Background };
            var khungVien = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            khungVien.Controls.Add(bieuDo);
            khungBieuDo.Controls.Add(khungVien);

            lblTomTat = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblTomTat.Dock = DockStyle.Bottom;
            lblTomTat.Padding = Ui.Pad(2, 8, 0, 0);
            lblTomTat.AutoSize = false;
            lblTomTat.Height = Ui.S(30);

            var host = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            host.Controls.Add(gridDiem);
            host.Controls.Add(gridRoRi);
            host.Controls.Add(gridTb);
            host.Controls.Add(manTrong);
            Controls.Add(host);
            Controls.Add(khungBieuDo);
            Controls.Add(lblTomTat);
            Controls.Add(huongDan);
            Controls.Add(theHost);
            Controls.Add(nutHost);
            Controls.Add(top);
            DatCheDo(CheDo.Diem, false);
            phien.DaDoi += (s, e) => { if (Visible && s != this) KhiHien(); };
        }

        // ------------------------------------------------------------------ dựng giao diện

        static FlowLayoutPanel HangNut()
        {
            return new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 2, 0, 2), Visible = false };
        }

        Button Nut(FlowLayoutPanel p, string text, bool chinh, EventHandler click, string goiY)
        {
            var b = Ui.MakeButton(text, chinh);
            b.Margin = Ui.Pad(0, 4, 8, 0);
            b.Click += click;
            tip.SetToolTip(b, goiY);
            p.Controls.Add(b);
            return b;
        }

        void NutXuat(FlowLayoutPanel p)
        {
            var bx = Ui.MakeButton("Xuất Excel ▾", false);
            bx.Margin = Ui.Pad(8, 4, 8, 0);
            bx.Click += (s, e) => { KetThucSua(); TaoMenuXuat(false); menuXuat.Show(bx, new Point(0, bx.Height)); };
            var bi = Ui.MakeButton("In ▾", false);
            bi.Margin = Ui.Pad(0, 4, 8, 0);
            bi.Click += (s, e) => { KetThucSua(); TaoMenuXuat(true); menuXuat.Show(bi, new Point(0, bi.Height)); };
            tip.SetToolTip(bi, "In thẳng (xem trước, chọn máy in) — không cần mở Excel");
            p.Controls.Add(bx);
            p.Controls.Add(bi);
        }

        static DataGridView TaoLuoiXem(string[] heads, int[] widths, int[] cotSo)
        {
            var g = new DataGridView { Dock = DockStyle.Fill, ReadOnly = true, Visible = false };
            Ui.StyleGrid(g);
            g.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            g.MultiSelect = false;
            g.ShowCellToolTips = true;
            for (int i = 0; i < heads.Length; i++) g.Columns.Add(Ui.Col(heads[i], widths[i], cotSo.Contains(i)));
            g.Columns[0].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            g.Columns[heads.Length - 1].AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill;
            g.Columns[heads.Length - 1].MinimumWidth = Ui.S(140);
            return g;
        }

        Panel TaoManHinhTrong()
        {
            var p = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Background, Visible = false };
            var card = Ui.MakeCard();
            card.Width = Ui.S(760);
            card.Height = Ui.S(330);
            card.Location = new Point(Ui.S(16), Ui.S(16));
            var flow = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false };
            flow.Controls.Add(Ui.MakeLabel("Chưa có điểm đặt noise logger", Ui.Section, Ui.Text));
            var l = Ui.MakeLabel(
                "Noise logger gắn lên van / trụ cứu hoả / đồng hồ, tự ghi tiếng ồn trên ống lúc 2h–4h sáng (vắng người dùng nước). " +
                "Rò rỉ phát ra tiếng ồn đều, liên tục cả đêm → mức ồn cao, độ trải nhỏ, lặp lại nhiều đêm.\n\n" +
                "1. Mục \"Thiết bị\": thêm các logger (mã / số seri như trong phần mềm của hãng).\n" +
                "2. Mục \"Đội / vùng DMA\": lập danh sách đội, khu vực, vùng DMA (hoặc lấy từ phần mềm Quản lý thất thoát nước). \"+ Thêm điểm\": các vị trí lắp logger.\n" +
                "3. \"Lắp / thu logger…\": ghi logger nào lắp ở điểm nào từ ngày nào (chuyển logger sang DMA khác cũng ghi ở đây).\n" +
                "4. Hằng ngày: \"Nhập số đo từ file…\" (file CSV / Excel xuất từ phần mềm của hãng) hoặc gõ mức ồn vào lưới.\n" +
                "5. Điểm \"Nghi rò rỉ\" (tô đỏ): \"+ Ca rò rỉ…\" để giao tổ dò tìm, cập nhật đến khi sửa xong.", Ui.Base, Ui.Muted);
            l.MaximumSize = new Size(Ui.S(720), 0);
            l.Margin = Ui.Pad(0, 8, 0, 14);
            flow.Controls.Add(l);
            var buttons = new FlowLayoutPanel { AutoSize = true, WrapContents = false };
            var b1 = Ui.MakeButton("+ Thêm điểm đầu tiên…", true);
            b1.Click += (s, e) => ThemDiem();
            var b2 = Ui.MakeButton("Danh mục logger…", false);
            b2.Click += (s, e) => DatCheDo(CheDo.ThietBi, true);
            buttons.Controls.Add(b1);
            buttons.Controls.Add(b2);
            flow.Controls.Add(buttons);
            card.Controls.Add(flow);
            p.Controls.Add(card);
            return p;
        }

        /// <summary>0 = Điểm đo, 1 = Ca rò rỉ, 2 = Thiết bị.</summary>
        public int CheDoXem { get { return (int)cheDo; } }

        /// <summary>Đổi chế độ xem (thanh menu bên trái đổi theo).</summary>
        public event EventHandler DoiCheDo;

        public void Xem(int cheDoXem)
        {
            DatCheDo((CheDo)cheDoXem, true);
        }

        void DatCheDo(CheDo c, bool nap)
        {
            KetThucSua();
            bool doi = cheDo != c;
            cheDo = c;
            lblTieuDe.Text = c == CheDo.Diem ? "Điểm đo" : c == CheDo.RoRi ? "Ca rò rỉ" : "Thiết bị (noise logger)";
            nutDiem.Visible = c == CheDo.Diem;
            nutRoRi.Visible = c == CheDo.RoRi;
            nutTb.Visible = c == CheDo.ThietBi;
            hangNgay.Visible = c == CheDo.Diem;
            hangNam.Visible = c == CheDo.RoRi;
            cboDonVi.Visible = c != CheDo.ThietBi;
            khungBieuDo.Visible = c != CheDo.ThietBi;
            huongDan.Text = c == CheDo.Diem
                ? "Gõ mức ồn / độ trải / tần số của đêm đang xem vào ô nền vàng (Enter xuống điểm kế tiếp) hoặc \"Nhập số đo từ file…\". Ô đỏ: vượt ngưỡng rò; ô vàng: cần theo dõi. " +
                  "Nhấp đúp vào ô của đêm trước để xem đêm đó. Biểu đồ phía dưới: 60 đêm của điểm đang chọn."
                : c == CheDo.RoRi
                ? "Mỗi ca rò rỉ đi từ \"Chờ dò tìm\" (logger báo) → \"Đã xác định, chờ sửa\" (đã nghe / tương quan ra điểm rò) → \"Đã sửa\". Nhập lưu lượng rò ước tính để biết lượng nước tiết kiệm. " +
                  "Biểu đồ: mức ồn của điểm trước và sau khi sửa — sửa đúng chỗ thì tiếng ồn giảm hẳn."
                : "Danh mục noise logger. Mã logger phải giống mã trong file xuất từ phần mềm của hãng. Lắp logger vào điểm: mục \"Điểm đo\" → chọn điểm → \"Lắp / thu logger…\".";
            if (nap) Nap();
            EventHandler h = DoiCheDo;
            if (doi && h != null) h(this, EventArgs.Empty);
        }

        // ------------------------------------------------------------------ nạp

        public void KetThucSua()
        {
            if (gridDiem.IsCurrentCellInEditMode) gridDiem.EndEdit();
        }

        DateTime? NgayMoiNhat()
        {
            HashSet<int> loc = DiemLoc();
            return Dl.NgayMoiNhat(id => loc.Contains(id));
        }

        HashSet<int> DiemLoc()
        {
            return new HashSet<int>(DonViNlOps.Nhom(phien.Dl, Dl.Diem, donViLoc).SelectMany(g => g.Diem).Select(p => p.Id));
        }

        public void KhiHien()
        {
            dangNap = true;
            try
            {
                // chưa tự chọn đêm nào: luôn mở ở đêm mới nhất có số đo
                if (!daChonNgay) ngay = Dl.NgayMoiNhat(null) ?? DateTime.Today;
                MucDonViNl.Nap(cboDonVi, phien.Dl, "Tất cả đội / DMA", donViLoc);
                var mdv = cboDonVi.SelectedItem as MucDonViNl;
                donViLoc = mdv != null ? mdv.Id : -1;
                object namCu = cboNam.SelectedItem;
                cboNam.Items.Clear();
                cboNam.Items.Add("Tất cả các năm");
                foreach (int y in Dl.RoRi.Select(r => r.NgayPhatHien.Year).Concat(new[] { DateTime.Today.Year }).Distinct().OrderByDescending(y => y)) cboNam.Items.Add(y);
                if (namCu != null && cboNam.Items.Contains(namCu)) cboNam.SelectedItem = namCu;
                else cboNam.SelectedItem = DateTime.Today.Year;
            }
            finally
            {
                dangNap = false;
            }
            Nap();
        }

        void DoiNgay(DateTime d)
        {
            KetThucSua();
            ngay = d.Date;
            daChonNgay = true;
            Nap();
        }

        void Nap()
        {
            dangNap = true;
            try
            {
                if (dtDem.Value.Date != ngay) dtDem.Value = ngay;
            }
            finally
            {
                dangNap = false;
            }
            bool trong = Dl.Diem.Count == 0 && cheDo == CheDo.Diem;
            manTrong.Visible = trong;
            gridDiem.Visible = cheDo == CheDo.Diem && !trong;
            gridRoRi.Visible = cheDo == CheDo.RoRi;
            gridTb.Visible = cheDo == CheDo.ThietBi;
            khungBieuDo.Visible = cheDo != CheDo.ThietBi && !trong;
            switch (cheDo)
            {
                case CheDo.Diem: NapDiem(); break;
                case CheDo.RoRi: NapRoRi(); break;
                default: NapTb(); break;
            }
            CapNhatThe();
            CapNhatNut();
            CapNhatBieuDo();
        }

        // ------------------------------------------------------------------ điểm đo

        void NapDiem()
        {
            DongDiem cur = DongChon();
            int curId = cur != null && cur.Diem != null ? cur.Diem.Id : -1;
            int curCol = gridDiem.CurrentCell != null ? gridDiem.CurrentCell.ColumnIndex : cMuc;
            for (int i = 0; i < BaoCaoNl.SoDemTruoc; i++)
            {
                DateTime d = ngay.AddDays(i - BaoCaoNl.SoDemTruoc);
                gridDiem.Columns[cDem1 + i].HeaderText = d.ToString("dd/MM");
                gridDiem.Columns[cDem1 + i].ToolTipText = "Mức ồn đêm " + So.Ngay(d) + " — nhấp đúp để xem đêm này";
            }
            gridDiem.Columns[cMuc].HeaderText = "Mức ồn\n" + ngay.ToString("dd/MM");
            dangNap = true;
            try
            {
                gridDiem.Rows.Clear();
                dong = new List<DongDiem>();
                IEnumerable<DiemNl> ds = chkNgung.Checked ? Dl.Diem : BaoCaoNl.DiemCuaDem(Dl, ngay);
                var nhom = DonViNlOps.Nhom(phien.Dl, ds, donViLoc);
                int stt = 0;
                for (int g = 0; g < nhom.Count; g++)
                {
                    dong.Add(new DongDiem { Nhom = nhom[g], Stt = So.LaMa(g + 1) });
                    foreach (DiemNl p in nhom[g].Diem) dong.Add(new DongDiem { Nhom = nhom[g], Diem = p, Stt = (++stt).ToString() });
                }
                if (dong.Count > 0) gridDiem.Rows.Add(dong.Count);
                for (int r = 0; r < dong.Count; r++) KieuDong(gridDiem.Rows[r], dong[r]);
                CapNhatGiaTri();
                if (dong.Count > 0)
                {
                    int idx = dong.FindIndex(x => x.Diem != null && x.Diem.Id == curId);
                    if (idx < 0) idx = dong.FindIndex(x => x.Diem != null);
                    if (idx < 0) idx = 0;
                    int col = CoTheSua(idx, curCol) ? curCol : (dong[idx].Diem != null ? cMuc : cTen);
                    gridDiem.CurrentCell = gridDiem.Rows[idx].Cells[col];
                }
            }
            finally
            {
                dangNap = false;
            }
        }

        void KieuDong(DataGridViewRow row, DongDiem d)
        {
            row.Cells[cStt].Value = d.Stt;
            DataGridViewCell ten = row.Cells[cTen];
            if (d.Diem == null)
            {
                row.DefaultCellStyle.Font = Ui.BaseBold;
                row.DefaultCellStyle.BackColor = Ui.GroupRow;
                ten.Value = d.Nhom.Ten.ToUpper(So.VN);
                ten.ToolTipText = d.Nhom.Ten;
                return;
            }
            DiemNl p = d.Diem;
            ten.Value = p.Ten + (p.Ngung ? " (đã ngừng)" : "");
            ten.Style.Padding = new Padding(Ui.S(14), 0, Ui.S(3), 0);
            if (p.Ngung) ten.Style.ForeColor = Ui.Muted;
            ten.ToolTipText = p.Ten + "\n" + DuLieuNl.TenLoai(p.Loai) + (p.DuongOng.Length > 0 ? " · ống " + p.DuongOng : "") +
                              (p.ToaDo.Length > 0 ? "\nToạ độ: " + p.ToaDo : "") + (p.GhiChu.Length > 0 ? "\n" + p.GhiChu : "") + "\nNhấp đúp để sửa";
            row.Cells[cLoai].Value = DuLieuNl.TenLoai(p.Loai);
        }

        /// <summary>Dòng nhóm (đơn vị): tên viết tràn sang ô Loại, Logger cho khỏi bị cắt.</summary>
        void GridDiem_CellPainting(object sender, DataGridViewCellPaintingEventArgs e)
        {
            if (e.RowIndex < 0 || e.RowIndex >= dong.Count || dong[e.RowIndex].Diem != null) return;
            if (e.ColumnIndex < cTen || e.ColumnIndex > cTb) return;
            e.PaintBackground(e.ClipBounds, false);
            Rectangle o = gridDiem.GetCellDisplayRectangle(cTen, e.RowIndex, false);
            int rong = gridDiem.Columns[cTen].Width + gridDiem.Columns[cLoai].Width + gridDiem.Columns[cTb].Width;
            var vung = new Rectangle(o.Left + Ui.S(4), e.CellBounds.Top, rong - Ui.S(8), e.CellBounds.Height);
            e.Graphics.SetClip(e.CellBounds);
            TextRenderer.DrawText(e.Graphics, Convert.ToString(gridDiem.Rows[e.RowIndex].Cells[cTen].Value), Ui.BaseBold, vung, Ui.Text,
                                  TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            e.Graphics.ResetClip();
            e.Handled = true;
        }

        static Color MauNen(KetLuanNl k)
        {
            return k == KetLuanNl.NghiRoRi ? NenRo : k == KetLuanNl.TheoDoi ? NenTheoDoi : Color.Empty;
        }

        static Color MauChu(KetLuanNl k)
        {
            switch (k)
            {
                case KetLuanNl.NghiRoRi: return Ui.Danger;
                case KetLuanNl.TheoDoi: return MauTheoDoi;
                case KetLuanNl.BinhThuong: return Ui.Success;
                default: return Ui.Muted;
            }
        }

        void CapNhatGiaTri()
        {
            NguongNl n = Dl.Nguong;
            for (int r = 0; r < dong.Count && r < gridDiem.RowCount; r++)
            {
                DongDiem d = dong[r];
                DataGridViewRow row = gridDiem.Rows[r];
                if (d.Diem == null) continue;
                KetQuaNl kq = PhanTichNl.PhanTich(Dl, d.Diem, ngay);
                d.Kq = kq;
                SoDoNl s = kq.DemNay;
                ThietBiNl tb = s != null && s.ThietBiId >= 0 ? Dl.TimThietBi(s.ThietBiId) : (kq.LapDat != null ? Dl.TimThietBi(kq.LapDat.ThietBiId) : null);
                row.Cells[cTb].Value = tb != null ? tb.Ma : "";
                row.Cells[cTb].ToolTipText = tb != null ? tb + (kq.LapDat != null ? "\nLắp từ " + So.Ngay(kq.LapDat.TuNgay) + (kq.LapDat.DenNgay.HasValue ? " đến " + So.Ngay(kq.LapDat.DenNgay) : "") : "")
                                                       : "Chưa lắp logger vào đêm này — nút \"Lắp / thu logger…\"";
                row.Cells[cMuc].Value = s != null ? So.M3(s.MucOn) : "";
                row.Cells[cTrai].Value = s != null ? So.M3(s.DoTrai) : "";
                row.Cells[cTan].Value = s != null ? So.M3(s.TanSo) : "";
                Color nen = MauNen(kq.KetLuanDem);
                row.Cells[cMuc].Style.BackColor = nen != Color.Empty ? nen : Ui.Input;
                row.Cells[cTrai].Style.BackColor = Ui.Input;
                row.Cells[cTan].Style.BackColor = Ui.Input;
                row.Cells[cMuc].Style.ForeColor = kq.KetLuanDem == KetLuanNl.NghiRoRi ? Ui.Danger : Ui.Text;
                row.Cells[cMuc].ToolTipText = s == null ? "Chưa có số đo đêm " + So.Ngay(ngay) + " — gõ mức ồn (dB)" :
                    DuLieuNl.TenKetLuan(kq.KetLuanDem) + " (đêm " + So.Ngay(ngay) + ")" + (s.ThietBiId < 0 ? "\nNhập tay" : "");
                for (int i = 0; i < BaoCaoNl.SoDemTruoc; i++)
                {
                    SoDoNl t = Dl.TimSoDo(d.Diem.Id, ngay.AddDays(i - BaoCaoNl.SoDemTruoc));
                    DataGridViewCell c = row.Cells[cDem1 + i];
                    c.Value = t != null ? So.M3(t.MucOn) : "";
                    KetLuanNl k = PhanTichNl.PhanLoai(t, n);
                    c.Style.BackColor = MauNen(k);
                    c.Style.ForeColor = k == KetLuanNl.NghiRoRi ? Ui.Danger : Ui.Text;
                    c.ToolTipText = t == null ? "" : "Đêm " + So.Ngay(t.Ngay) + ": mức ồn " + So.M3(t.MucOn) + " dB" + (t.DoTrai.HasValue ? ", độ trải " + So.M3(t.DoTrai) : "") +
                                                      (t.TanSo.HasValue ? ", tần số " + So.M3(t.TanSo) + " Hz" : "") + "\n" + DuLieuNl.TenKetLuan(k);
                }
                row.Cells[cNen].Value = So.M3(kq.MucNen.HasValue ? Math.Round(kq.MucNen.Value, 1) : (double?)null);
                double? tang = kq.Tang;
                row.Cells[cNen].ToolTipText = kq.MucNen.HasValue ? "Mức nền " + So.M3(Math.Round(kq.MucNen.Value, 1)) + " dB" + (tang.HasValue ? "; tuần gần nhất " + So.Lech(tang) + " dB" : "") : "Chưa đủ số đo để tính mức nền (cần ≥ 3 đêm trong 30 ngày trước tuần gần nhất)";
                row.Cells[cKl].Value = DuLieuNl.TenKetLuan(kq.KetLuan);
                row.Cells[cKl].Style.ForeColor = MauChu(kq.KetLuan);
                row.Cells[cKl].Style.BackColor = MauNen(kq.KetLuan);
                row.Cells[cKl].Style.Font = kq.KetLuan == KetLuanNl.NghiRoRi ? Ui.BaseBold : null;
                string gc = kq.LyDo;
                if (kq.RoRiMo != null)
                    gc = "● Ca rò rỉ " + So.Ngay(kq.RoRiMo.NgayPhatHien) + ": " + DuLieuNl.TenTrangThai(kq.RoRiMo.TrangThai).ToLower(So.VN) +
                         (kq.RoRiMo.ViTri.Length > 0 ? " — " + kq.RoRiMo.ViTri : "") + (gc.Length > 0 ? " · " + gc : "");
                else if (kq.KetLuan == KetLuanNl.NghiRoRi) gc = "Chưa có ca xử lý (+ Ca rò rỉ…) · " + gc;
                row.Cells[cGc].Value = gc;
                row.Cells[cGc].ToolTipText = gc;
                row.Cells[cGc].Style.ForeColor = kq.RoRiMo != null ? Ui.Primary : Ui.Muted;
            }
            // dòng nhóm: đếm nghi rò / theo dõi của đơn vị
            for (int r = 0; r < dong.Count && r < gridDiem.RowCount; r++)
            {
                DongDiem d = dong[r];
                if (d.Diem != null) continue;
                var kqs = dong.Where(x => x.Nhom == d.Nhom && x.Kq != null).Select(x => x.Kq).ToList();
                int ro = kqs.Count(x => x.KetLuan == KetLuanNl.NghiRoRi), td = kqs.Count(x => x.KetLuan == KetLuanNl.TheoDoi);
                gridDiem.Rows[r].Cells[cKl].Value = ro > 0 ? ro + " nghi rò" : td > 0 ? td + " theo dõi" : "";
                gridDiem.Rows[r].Cells[cKl].Style.ForeColor = ro > 0 ? Ui.Danger : MauTheoDoi;
                gridDiem.Rows[r].Cells[cGc].Value = kqs.Count + " điểm" + (td > 0 && ro > 0 ? ", " + td + " cần theo dõi" : "");
                gridDiem.Rows[r].Cells[cGc].Style.Font = Ui.Small;
            }
            var tatCa = dong.Where(x => x.Kq != null).Select(x => x.Kq).ToList();
            int coSo = tatCa.Count(x => x.DemNay != null && x.DemNay.MucOn.HasValue);
            int lap = tatCa.Count(x => x.LapDat != null);
            lblTomTat.Text = "Đêm " + So.Ngay(ngay) + ": " + tatCa.Count + " điểm" + (donViLoc >= 0 ? " của đơn vị đang chọn" : "") + ", " + lap + " điểm có logger, " +
                             coSo + " điểm có số đo" + (lap > coSo ? " (còn " + (lap - coSo) + " điểm có logger chưa có số)" : "") +
                             ". Mọi thay đổi được lưu ngay.";
        }

        bool CoTheSua(int r, int c)
        {
            if (cheDo != CheDo.Diem || r < 0 || r >= dong.Count) return false;
            return dong[r].Diem != null && (c == cMuc || c == cTrai || c == cTan);
        }

        DongDiem DongChon()
        {
            if (cheDo != CheDo.Diem) return null;
            int r = gridDiem.CurrentCell != null ? gridDiem.CurrentCell.RowIndex : -1;
            return r >= 0 && r < dong.Count ? dong[r] : null;
        }

        DiemNl DiemChon()
        {
            DongDiem d = DongChon();
            return d != null ? d.Diem : null;
        }

        void GridDiem_CellEndEdit(object sender, DataGridViewCellEventArgs e)
        {
            if (dangNap || !CoTheSua(e.RowIndex, e.ColumnIndex)) return;
            string text = Convert.ToString(gridDiem.Rows[e.RowIndex].Cells[e.ColumnIndex].Value);
            if (!Ghi(e.RowIndex, e.ColumnIndex, text))
            {
                gridDiem.GiuO = true;
                CapNhatGiaTri();
                Rectangle rc = gridDiem.GetCellDisplayRectangle(e.ColumnIndex, e.RowIndex, false);
                tip.Show("\"" + text + "\" không phải số hợp lệ. Gõ dạng 32,5 hoặc 32.5", gridDiem, rc.Left, rc.Bottom + Ui.S(2), 3500);
            }
        }

        bool Ghi(int r, int c, string text)
        {
            DiemNl p = dong[r].Diem;
            double? v;
            if (!So.TryDoc(text, out v)) return false;
            if (v.HasValue && v.Value < 0) return false;
            SoDoNl cu = Dl.TimSoDo(p.Id, ngay);
            var s = cu != null
                ? new SoDoNl { DiemId = p.Id, Ngay = ngay, MucOn = cu.MucOn, DoTrai = cu.DoTrai, TanSo = cu.TanSo, ThietBiId = cu.ThietBiId }
                : new SoDoNl { DiemId = p.Id, Ngay = ngay };
            switch (c)
            {
                case cMuc: if (Nullable.Equals(s.MucOn, v)) { CapNhatGiaTri(); return true; } s.MucOn = v; break;
                case cTrai: if (Nullable.Equals(s.DoTrai, v)) { CapNhatGiaTri(); return true; } s.DoTrai = v; break;
                case cTan: if (Nullable.Equals(s.TanSo, v)) { CapNhatGiaTri(); return true; } s.TanSo = v; break;
                default: return false;
            }
            if (cu == null)
            {
                LapDatNl lap = Dl.LapDatTai(p.Id, ngay);
                if (lap != null) s.ThietBiId = lap.ThietBiId;
            }
            Dl.DatSoDo(s);
            phien.Luu(this);
            CapNhatGiaTri();
            CapNhatThe();
            CapNhatBieuDo();
            return true;
        }

        void GridDiem_KeyDown(object sender, KeyEventArgs e)
        {
            if (gridDiem.CurrentCell == null || gridDiem.IsCurrentCellInEditMode) return;
            int r = gridDiem.CurrentCell.RowIndex, c = gridDiem.CurrentCell.ColumnIndex;
            if (e.KeyCode == Keys.Delete && CoTheSua(r, c))
            {
                Ghi(r, c, "");
                e.Handled = true;
            }
            else if (e.KeyCode == Keys.Insert)
            {
                ThemDiem();
                e.Handled = true;
            }
        }

        void GridDiem_CellDoubleClick(object sender, DataGridViewCellEventArgs e)
        {
            if (e.RowIndex < 0 || e.RowIndex >= dong.Count) return;
            DongDiem d = dong[e.RowIndex];
            if (e.ColumnIndex >= cDem1 && e.ColumnIndex < cDem1 + BaoCaoNl.SoDemTruoc)
            {
                int col = e.ColumnIndex;
                DoiNgay(ngay.AddDays(col - cDem1 - BaoCaoNl.SoDemTruoc));
                if (d.Diem != null) ChonDiem(d.Diem.Id, cMuc);
                return;
            }
            if (d.Diem == null) return;
            if (e.ColumnIndex == cTb) LapThu(d.Diem);
            else if (e.ColumnIndex == cGc && d.Kq != null && d.Kq.RoRiMo != null) SuaRoRi(d.Kq.RoRiMo);
            else if (e.ColumnIndex == cTen || e.ColumnIndex == cStt || e.ColumnIndex == cLoai) SuaDiem();
        }

        void ChonDiem(int id, int col)
        {
            int r = dong.FindIndex(x => x.Diem != null && x.Diem.Id == id);
            if (r < 0) return;
            try { gridDiem.CurrentCell = gridDiem.Rows[r].Cells[col]; }
            catch (InvalidOperationException) { }
            gridDiem.Focus();
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (cheDo == CheDo.Diem && !gridDiem.IsCurrentCellInEditMode)
            {
                if (keyData == (Keys.Alt | Keys.Left)) { DoiNgay(ngay.AddDays(-1)); return true; }
                if (keyData == (Keys.Alt | Keys.Right)) { DoiNgay(ngay.AddDays(1)); return true; }
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        // ------------------------------------------------------------------ ca rò rỉ

        int NamChon { get { return cboNam.SelectedItem is int ? (int)cboNam.SelectedItem : 0; } }

        void NapRoRi()
        {
            RoRiNl cur = RoRiChon();
            HashSet<int> loc = DiemLoc();
            dsRoRi = BaoCaoNl.CaCuaNam(Dl, NamChon).Where(r => loc.Contains(r.DiemId) || (donViLoc < 0 && Dl.TimDiem(r.DiemId) == null))
                                                     .OrderByDescending(r => r.DangMo).ThenByDescending(r => r.NgayPhatHien).ToList();
            dangNap = true;
            try
            {
                gridRoRi.Rows.Clear();
                for (int i = 0; i < dsRoRi.Count; i++)
                {
                    RoRiNl r = dsRoRi[i];
                    DiemNl p = Dl.TimDiem(r.DiemId);
                    double? truoc, sau;
                    PhanTichNl.TruocSauSua(Dl, r, out truoc, out sau);
                    double? soNgay = r.NgaySua.HasValue ? (r.NgaySua.Value.Date - r.NgayPhatHien.Date).TotalDays : (r.DangMo ? (DateTime.Today - r.NgayPhatHien.Date).TotalDays : (double?)null);
                    string ts = truoc.HasValue || sau.HasValue ? So.M3(truoc.HasValue ? Math.Round(truoc.Value, 1) : (double?)null) + " → " + (sau.HasValue ? So.M3(Math.Round(sau.Value, 1)) : "?") : "";
                    int idx = gridRoRi.Rows.Add(i + 1, So.Ngay(r.NgayPhatHien), p != null ? p.Ten : "(điểm đã xoá)", p != null ? DonViNlOps.Ten(phien.Dl, p.DonViId) : "",
                                                r.ViTri, r.HangMuc, DuLieuNl.TenTrangThai(r.TrangThai), So.Ngay(r.NgaySua), So.M3(soNgay), So.M3(r.LuuLuong),
                                                So.M3(r.TietKiemThang.HasValue ? Math.Round(r.TietKiemThang.Value) : (double?)null), ts, r.GhiChu);
                    DataGridViewRow row = gridRoRi.Rows[idx];
                    DataGridViewCell tt = row.Cells[6];
                    tt.Style.ForeColor = r.DangMo ? Ui.Danger : r.TrangThai == TrangThaiRoRi.DaSua ? Ui.Success : Ui.Muted;
                    tt.Style.Font = r.DangMo ? Ui.BaseBold : null;
                    if (r.DangMo) row.Cells[8].ToolTipText = "Số ngày từ khi phát hiện đến hôm nay (chưa sửa)";
                    if (truoc.HasValue && sau.HasValue)
                    {
                        row.Cells[11].Style.ForeColor = truoc.Value - sau.Value >= Dl.Nguong.Tang ? Ui.Success : Ui.Warning;
                        row.Cells[11].ToolTipText = truoc.Value - sau.Value >= Dl.Nguong.Tang
                            ? "Tiếng ồn giảm " + So.M3(Math.Round(truoc.Value - sau.Value, 1)) + " dB sau khi sửa — đã sửa đúng chỗ rò"
                            : "Tiếng ồn giảm ít sau khi sửa — có thể còn điểm rò khác gần đó, nên dò lại";
                    }
                }
                int sel = cur != null ? dsRoRi.IndexOf(cur) : -1;
                if (sel < 0 && dsRoRi.Count > 0) sel = 0;
                if (sel >= 0) gridRoRi.CurrentCell = gridRoRi.Rows[sel].Cells[1];
            }
            finally
            {
                dangNap = false;
            }
            int mo = dsRoRi.Count(r => r.DangMo), sua = dsRoRi.Count(r => r.TrangThai == TrangThaiRoRi.DaSua);
            double tk = dsRoRi.Sum(r => r.TietKiemThang ?? 0);
            lblTomTat.Text = (NamChon > 0 ? "Năm " + NamChon : "Tất cả các năm") + ": " + dsRoRi.Count + " ca rò rỉ, đã sửa " + sua + ", đang xử lý " + mo +
                             (tk > 0 ? ". Nước tiết kiệm ước tính ≈ " + So.M3(Math.Round(tk)) + " m³/tháng (lưu lượng rò × 24 giờ × 30 ngày)." : ".");
        }

        RoRiNl RoRiChon()
        {
            if (cheDo != CheDo.RoRi || gridRoRi.CurrentCell == null) return null;
            int r = gridRoRi.CurrentCell.RowIndex;
            return r >= 0 && r < dsRoRi.Count ? dsRoRi[r] : null;
        }

        void ThemRoRi()
        {
            KetThucSua();
            if (Dl.Diem.Count == 0) { Ui.Info(FindForm(), "Chưa có điểm đặt logger nào — thêm điểm trước."); return; }
            DiemNl p = DiemChon();
            if (p == null && RoRiChon() != null) p = Dl.TimDiem(RoRiChon().DiemId);
            if (p != null && cheDo == CheDo.Diem)
            {
                RoRiNl mo = Dl.RoRiMo(p.Id);
                if (mo != null && !Ui.Confirm(FindForm(), "Điểm \"" + p.Ten + "\" đang có ca rò rỉ từ " + So.Ngay(mo.NgayPhatHien) + " (" +
                                                           DuLieuNl.TenTrangThai(mo.TrangThai).ToLower(So.VN) + ").\n\nVẫn thêm ca mới? (Chọn \"No\" để mở ca đang có.)"))
                {
                    SuaRoRi(mo);
                    return;
                }
            }
            using (var f = new RoRiNlForm(phien.Dl, null, p, cheDo == CheDo.Diem ? ngay : DateTime.Today))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                var r = new RoRiNl { Id = Dl.CapId() };
                f.GhiVao(r);
                Dl.RoRi.Add(r);
            }
            phien.Luu(this);
            Nap();
        }

        void SuaRoRi() { SuaRoRi(RoRiChon()); }

        void SuaRoRi(RoRiNl r)
        {
            if (r == null) return;
            KetThucSua();
            using (var f = new RoRiNlForm(phien.Dl, r, null, DateTime.Today))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                f.GhiVao(r);
            }
            phien.Luu(this);
            Nap();
        }

        void XoaRoRi()
        {
            RoRiNl r = RoRiChon();
            if (r == null) return;
            DiemNl p = Dl.TimDiem(r.DiemId);
            if (!Ui.Confirm(FindForm(), "Xoá ca rò rỉ ngày " + So.Ngay(r.NgayPhatHien) + (p != null ? " tại \"" + p.Ten + "\"" : "") + "?")) return;
            Dl.RoRi.Remove(r);
            phien.Luu(this);
            Nap();
        }

        // ------------------------------------------------------------------ thiết bị

        void NapTb()
        {
            ThietBiNl cur = TbChon();
            dsTb = Dl.ThietBi.OrderBy(t => t.Hong).ThenBy(t => t.Ma, StringComparer.OrdinalIgnoreCase).ToList();
            var soDem = new Dictionary<int, int>();
            var moiNhat = new Dictionary<int, DateTime>();
            foreach (int id in Dl.DiemCoSoDo)
                foreach (SoDoNl s in Dl.SoDoCua(id))
                {
                    if (s.ThietBiId < 0) continue;
                    int c;
                    soDem.TryGetValue(s.ThietBiId, out c);
                    soDem[s.ThietBiId] = c + 1;
                    DateTime m;
                    if (!moiNhat.TryGetValue(s.ThietBiId, out m) || s.Ngay > m) moiNhat[s.ThietBiId] = s.Ngay;
                }
            dangNap = true;
            try
            {
                gridTb.Rows.Clear();
                for (int i = 0; i < dsTb.Count; i++)
                {
                    ThietBiNl t = dsTb[i];
                    LapDatNl lap = Dl.DangLapCuaThietBi(t.Id);
                    DiemNl p = lap != null ? Dl.TimDiem(lap.DiemId) : null;
                    int sd;
                    soDem.TryGetValue(t.Id, out sd);
                    DateTime mn;
                    bool coMn = moiNhat.TryGetValue(t.Id, out mn);
                    string tt = t.Hong ? "Hỏng" : lap != null ? "Đang lắp" : "Trong kho";
                    int idx = gridTb.Rows.Add(i + 1, t.Ma, t.Loai, tt, p != null ? p.Ten + (p.DonViId >= 0 ? "  (" + DonViNlOps.Ten(phien.Dl, p.DonViId) + ")" : "") : "",
                                              lap != null ? So.Ngay(lap.TuNgay) : "", sd > 0 ? sd.ToString() : "", coMn ? So.Ngay(mn) : "", t.GhiChu);
                    DataGridViewRow row = gridTb.Rows[idx];
                    row.Cells[3].Style.ForeColor = t.Hong ? Ui.Danger : lap != null ? Ui.Success : Ui.Muted;
                    if (t.Hong) row.DefaultCellStyle.ForeColor = Ui.Muted;
                    // logger đang lắp mà quá 3 ngày chưa có số mới: nhắc kiểm tra pin / tải số
                    if (lap != null && coMn && (DateTime.Today - mn).TotalDays > PhanTichNl.SoNgayCu)
                    {
                        row.Cells[7].Style.ForeColor = Ui.Warning;
                        row.Cells[7].ToolTipText = "Đang lắp nhưng " + (int)(DateTime.Today - mn).TotalDays + " ngày chưa có số đo mới — kiểm tra pin / tải số liệu";
                    }
                }
                int sel = cur != null ? dsTb.IndexOf(cur) : -1;
                if (sel < 0 && dsTb.Count > 0) sel = 0;
                if (sel >= 0) gridTb.CurrentCell = gridTb.Rows[sel].Cells[1];
            }
            finally
            {
                dangNap = false;
            }
            int dangLap = dsTb.Count(t => Dl.DangLapCuaThietBi(t.Id) != null), hong = dsTb.Count(t => t.Hong);
            lblTomTat.Text = dsTb.Count + " logger: " + dangLap + " đang lắp, " + (dsTb.Count - dangLap - hong) + " trong kho" + (hong > 0 ? ", " + hong + " hỏng" : "") + ".";
        }

        ThietBiNl TbChon()
        {
            if (cheDo != CheDo.ThietBi || gridTb.CurrentCell == null) return null;
            int r = gridTb.CurrentCell.RowIndex;
            return r >= 0 && r < dsTb.Count ? dsTb[r] : null;
        }

        void ThemTb()
        {
            using (var f = new ThietBiNlForm(Dl, null))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                var t = new ThietBiNl { Id = Dl.CapId() };
                f.GhiVao(t);
                Dl.ThietBi.Add(t);
            }
            phien.Luu(this);
            Nap();
        }

        void SuaTb()
        {
            ThietBiNl t = TbChon();
            if (t == null) return;
            using (var f = new ThietBiNlForm(Dl, t))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                f.GhiVao(t);
            }
            phien.Luu(this);
            Nap();
        }

        void XoaTb()
        {
            ThietBiNl t = TbChon();
            if (t == null) return;
            bool daDung = Dl.LapDat.Any(x => x.ThietBiId == t.Id) || Dl.DiemCoSoDo.Any(id => Dl.SoDoCua(id).Any(s => s.ThietBiId == t.Id));
            if (daDung)
            {
                Ui.Info(FindForm(), "Logger " + t.Ma + " đã từng lắp / có số đo nên không xoá được (để giữ lịch sử).\n\nLogger hỏng / thanh lý: bấm \"Sửa…\" → đánh dấu \"Hỏng / thanh lý\".");
                return;
            }
            if (!Ui.Confirm(FindForm(), "Xoá logger " + t.Ma + " khỏi danh mục?")) return;
            Dl.ThietBi.Remove(t);
            phien.Luu(this);
            Nap();
        }

        void LapThuTb()
        {
            ThietBiNl t = TbChon();
            if (t == null) return;
            LapDatNl lap = Dl.DangLapCuaThietBi(t.Id);
            DiemNl p = lap != null ? Dl.TimDiem(lap.DiemId) : null;
            if (p == null)
            {
                Ui.Info(FindForm(), "Logger " + t.Ma + " đang ở kho. Lắp vào điểm: mục \"Điểm đo\" → chọn điểm → \"Lắp / thu logger…\" → chọn logger này.");
                return;
            }
            LapThu(p);
        }

        // ------------------------------------------------------------------ thao tác điểm

        void ThemDiem()
        {
            KetThucSua();
            DongDiem cur = DongChon();
            int dv = cur != null && cur.Nhom != null && cur.Nhom.DonViId >= 0 ? cur.Nhom.DonViId : donViLoc;
            using (var f = new DiemNlForm(phien.Dl, null, dv))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                var p = new DiemNl { Id = Dl.CapId() };
                f.GhiVao(p);
                Dl.Diem.Add(p);
                phien.Luu(this);
                if (cheDo != CheDo.Diem) DatCheDo(CheDo.Diem, false);
                // điểm thuộc đơn vị khác đơn vị đang lọc: bỏ lọc để thấy điểm vừa thêm
                if (donViLoc >= 0 && !DiemLoc().Contains(p.Id)) donViLoc = -1;
                KhiHien();
                ChonDiem(p.Id, cTen);
                if (Dl.ThietBi.Any(x => !x.Hong && Dl.DangLapCuaThietBi(x.Id) == null) &&
                    Ui.Confirm(FindForm(), "Đã thêm điểm \"" + p.Ten + "\". Ghi lắp logger vào điểm này luôn?"))
                    LapThu(p);
            }
        }

        void SuaDiem()
        {
            DiemNl p = DiemChon();
            if (p == null) return;
            KetThucSua();
            using (var f = new DiemNlForm(phien.Dl, p, -1))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                f.GhiVao(p);
            }
            if (p.Ngung)
            {
                LapDatNl lap = Dl.DangLapTaiDiem(p.Id);
                if (lap != null) lap.DenNgay = DateTime.Today > lap.TuNgay ? DateTime.Today : lap.TuNgay;
            }
            phien.Luu(this);
            if (donViLoc >= 0 && !DiemLoc().Contains(p.Id)) donViLoc = -1;
            KhiHien();
            ChonDiem(p.Id, cTen);
        }

        void XoaDiem()
        {
            DiemNl p = DiemChon();
            if (p == null) return;
            KetThucSua();
            int soDo = Dl.SoDoCua(p.Id).Count, lap = Dl.LapDat.Count(x => x.DiemId == p.Id), ca = Dl.RoRi.Count(x => x.DiemId == p.Id);
            if (soDo == 0 && ca == 0)
            {
                if (!Ui.Confirm(FindForm(), "Xoá điểm \"" + p.Ten + "\"?" + (lap > 0 ? "\n\nCác lần lắp logger ở điểm này (" + lap + ") cũng bị xoá." : ""))) return;
                Dl.LapDat.RemoveAll(x => x.DiemId == p.Id);
                Dl.Diem.Remove(p);
            }
            else
            {
                if (p.Ngung) { Ui.Info(FindForm(), "Điểm đã ngừng dùng. Muốn dùng lại: Sửa… → bỏ chọn \"Ngừng dùng\"."); return; }
                LapDatNl dang = Dl.DangLapTaiDiem(p.Id);
                if (!Ui.Confirm(FindForm(), "Điểm \"" + p.Ten + "\" đã có " + soDo + " đêm số đo" + (ca > 0 ? ", " + ca + " ca rò rỉ" : "") + " nên không xoá hẳn.\n\n" +
                                            "Ngừng dùng điểm này? Số liệu cũ vẫn giữ (xem lại bằng ô \"Cả điểm đã ngừng\")." +
                                            (dang != null ? "\nLogger đang lắp ở đây được ghi thu về hôm nay." : ""))) return;
                p.Ngung = true;
                if (dang != null) dang.DenNgay = DateTime.Today > dang.TuNgay ? DateTime.Today : dang.TuNgay;
            }
            phien.Luu(this);
            Nap();
        }

        void LapThu(DiemNl p)
        {
            if (p == null) return;
            KetThucSua();
            using (var f = new LapDatNlForm(Dl, p, cheDo == CheDo.Diem ? (ngay > DateTime.Today ? DateTime.Today : ngay) : DateTime.Today))
            {
                DialogResult kq = f.ShowDialog(FindForm());
                if (kq != DialogResult.OK)
                {
                    if (f.DaThemThietBi) { phien.Luu(this); Nap(); }
                    return;
                }
                string mt = f.ApDung();
                phien.Luu(this);
                Nap();
                if (mt.Length > 0) lblTomTat.Text = p.Ten + ": " + mt + ". " + lblTomTat.Text;
            }
        }

        void NhapFile()
        {
            KetThucSua();
            if (Dl.ThietBi.Count == 0 && Dl.Diem.Count == 0)
            {
                Ui.Info(FindForm(), "Chưa có logger và điểm đặt logger nào.\n\nTrước khi nhập số đo: thêm logger (mục Thiết bị), thêm điểm, rồi ghi lắp logger vào điểm (\"Lắp / thu logger…\") — " +
                                    "phần mềm dựa vào đó để biết số đo của logger thuộc điểm nào. File có cột tên điểm thì chỉ cần thêm điểm.");
                return;
            }
            using (var f = new NhapSoDoNlForm(phien))
            {
                f.ShowDialog(FindForm());
                if (f.DenNgay.HasValue)
                {
                    ngay = f.DenNgay.Value;
                    daChonNgay = true;
                }
            }
            KhiHien();
        }

        void SuaNguong()
        {
            KetThucSua();
            using (var f = new NguongNlForm(Dl.Nguong))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                f.GhiVao();
            }
            phien.Luu(this);
            Nap();
        }

        // ------------------------------------------------------------------ thẻ, nút, biểu đồ

        void CapNhatThe()
        {
            HashSet<int> loc = DiemLoc();
            var kqs = BaoCaoNl.DiemCuaDem(Dl, ngay).Where(p => loc.Contains(p.Id)).Select(p => PhanTichNl.PhanTich(Dl, p, ngay)).ToList();
            int coSo = kqs.Count(x => x.DemNay != null && x.DemNay.MucOn.HasValue);
            the[0].Ten = "Đêm " + So.Ngay(ngay) + (donViLoc >= 0 ? " — " + DonViNlOps.Ten(phien.Dl, donViLoc) : "");
            the[0].GiaTri = coSo + " / " + kqs.Count + " điểm";
            the[0].Phu = "có số đo · " + kqs.Count(x => x.LapDat != null) + " điểm đang có logger";
            var ro = kqs.Where(x => x.KetLuan == KetLuanNl.NghiRoRi).ToList();
            the[1].Ten = "Nghi rò rỉ";
            the[1].GiaTri = ro.Count.ToString();
            int chuaCa = ro.Count(x => x.RoRiMo == null);
            the[1].Phu = ro.Count == 0 ? "Không có điểm nào" : chuaCa > 0 ? chuaCa + " điểm chưa có ca xử lý" : "Đều đã có ca xử lý";
            var td = kqs.Where(x => x.KetLuan == KetLuanNl.TheoDoi).ToList();
            the[2].Ten = "Cần theo dõi";
            the[2].GiaTri = td.Count.ToString();
            int tang = td.Count(x => x.Tang.HasValue && x.Tang.Value >= Dl.Nguong.Tang);
            the[2].Phu = td.Count == 0 ? "Không có điểm nào" : (tang > 0 ? tang + " điểm tiếng ồn tăng so với nền" : "Mức ồn cao / mới vượt ngưỡng 1 đêm");
            int nam = cheDo == CheDo.RoRi && NamChon > 0 ? NamChon : ngay.Year;
            var cas = BaoCaoNl.CaCuaNam(Dl, nam).Where(r => loc.Contains(r.DiemId) || (donViLoc < 0 && Dl.TimDiem(r.DiemId) == null)).ToList();
            int sua = cas.Count(r => r.TrangThai == TrangThaiRoRi.DaSua && r.NgaySua.HasValue && r.NgaySua.Value.Year == nam);
            double tk = cas.Where(r => r.NgaySua.HasValue && r.NgaySua.Value.Year == nam).Sum(r => r.TietKiemThang ?? 0);
            the[3].Ten = "Ca rò rỉ năm " + nam;
            the[3].GiaTri = "Đã sửa " + sua;
            the[3].Phu = "đang xử lý " + cas.Count(r => r.DangMo) + (tk > 0 ? " · tiết kiệm ≈ " + So.M3(Math.Round(tk)) + " m³/tháng" : "");
            foreach (TheSo t in the) t.Invalidate();
        }

        void CapNhatNut()
        {
            DiemNl p = DiemChon();
            btnSuaDiem.Enabled = btnXoaDiem.Enabled = btnLap.Enabled = btnThemRoRiDiem.Enabled = p != null;
            RoRiNl r = RoRiChon();
            btnSuaRoRi.Enabled = btnXoaRoRi.Enabled = r != null;
            ThietBiNl t = TbChon();
            btnSuaTb.Enabled = btnXoaTb.Enabled = t != null;
            btnLapTb.Enabled = t != null && Dl.DangLapCuaThietBi(t.Id) != null;
        }

        void CapNhatBieuDo()
        {
            if (cheDo == CheDo.Diem)
            {
                bieuDo.Dat(Dl, DiemChon(), ngay);
            }
            else if (cheDo == CheDo.RoRi)
            {
                RoRiNl r = RoRiChon();
                DiemNl p = r != null ? Dl.TimDiem(r.DiemId) : null;
                DateTime moc = r != null ? (r.NgaySua ?? r.NgayPhatHien).AddDays(21) : DateTime.Today;
                DateTime? moi = p != null ? Dl.NgayMoiNhat(id => id == p.Id) : null;
                if (moi.HasValue && moi.Value < moc) moc = moi.Value;
                if (moc > DateTime.Today) moc = DateTime.Today;
                bieuDo.Dat(Dl, p, moc);
            }
        }

        // ------------------------------------------------------------------ xuất / in

        void TaoMenuXuat(bool inRa)
        {
            menuXuat.Items.Clear();
            int dv = donViLoc;
            string tenDv = dv >= 0 ? DonViNlOps.Ten(phien.Dl, dv) : "";
            string them = tenDv.Length > 0 ? " — " + tenDv : "";
            string lam = inRa ? "In " : "Xuất Excel ";
            DateTime n = ngay;
            int nam = cheDo == CheDo.RoRi ? NamChon : ngay.Year;
            menuXuat.Items.Add(lam + "kết quả nghe tiếng ồn đêm " + So.Ngay(n) + them + "…", null, (s, e) =>
                XuatFile.XuatHoacIn(this, phien, () => new BaoCaoNl(phien.Dl).SoKetQua(n, dv), BaoCaoNl.TenFileKetQua(n, tenDv), inRa));
            menuXuat.Items.Add(lam + "bảng mức ồn 31 đêm đến " + So.Ngay(n) + them + "…", null, (s, e) =>
                XuatFile.XuatHoacIn(this, phien, () => new BaoCaoNl(phien.Dl).SoLichSu(n.AddDays(-30), n, dv), BaoCaoNl.TenFileLichSu(n.AddDays(-30), n, tenDv), inRa));
            menuXuat.Items.Add(lam + "danh sách ca rò rỉ " + (nam > 0 ? "năm " + nam : "(tất cả các năm)") + them + "…", null, (s, e) =>
                XuatFile.XuatHoacIn(this, phien, () => new BaoCaoNl(phien.Dl).SoRoRi(nam, dv), BaoCaoNl.TenFileRoRi(nam, tenDv), inRa));
        }
    }

    /// <summary>Biểu đồ mức ồn từng đêm của 1 điểm: đường mức ồn, độ trải, ngưỡng, ngày phát hiện / sửa rò, thời gian lắp logger.</summary>
    class BieuDoNl : Control
    {
        const int SoNgay = 60;
        static readonly Color MauMuc = Color.FromArgb(0x1D, 0x5F, 0x95), MauTrai = Color.FromArgb(0xA0, 0xA8, 0xB4);
        static readonly Color MauRo = Color.FromArgb(0xC0, 0x26, 0x26), MauTheoDoi = Color.FromArgb(0xE0, 0x9A, 0x00), MauTot = Color.FromArgb(0x1E, 0x7B, 0x34);
        DuLieuNl d;
        DiemNl diem;
        DateTime den = DateTime.Today;

        public BieuDoNl()
        {
            DoubleBuffered = true;
            SetStyle(ControlStyles.ResizeRedraw, true);
            BackColor = Ui.Surface;
        }

        public void Dat(DuLieuNl d, DiemNl diem, DateTime den)
        {
            this.d = d;
            this.diem = diem;
            this.den = den.Date;
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Ui.Surface);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var flags = TextFormatFlags.NoPrefix | TextFormatFlags.EndEllipsis;
            if (d == null || diem == null)
            {
                TextRenderer.DrawText(g, "Chọn 1 điểm để xem diễn biến mức ồn " + SoNgay + " đêm.", Ui.Base, ClientRectangle, Ui.Muted,
                                      flags | TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }
            NguongNl n = d.Nguong;
            DateTime tu = den.AddDays(-(SoNgay - 1));
            var ds = d.SoDoCua(diem.Id).Where(x => x.Ngay >= tu && x.Ngay <= den).ToList();
            TextRenderer.DrawText(g, "Mức ồn " + SoNgay + " đêm đến " + So.Ngay(den) + " — " + diem.Ten, Ui.SmallBold,
                                  new Rectangle(Ui.S(10), Ui.S(6), Width / 2, Ui.S(18)), Ui.Text, flags);
            // chú thích
            int lx = Width - Ui.S(10);
            foreach (var c in new[] { new { T = "đã sửa", M = MauTot, Kieu = 2 }, new { T = "phát hiện rò", M = MauRo, Kieu = 2 }, new { T = "ngưỡng theo dõi", M = MauTheoDoi, Kieu = 1 },
                                      new { T = "ngưỡng rò", M = MauRo, Kieu = 1 }, new { T = "độ trải", M = MauTrai, Kieu = 0 }, new { T = "mức ồn (dB)", M = MauMuc, Kieu = 0 } })
            {
                Size sz = TextRenderer.MeasureText(c.T, Ui.Small);
                lx -= sz.Width;
                TextRenderer.DrawText(g, c.T, Ui.Small, new Point(lx, Ui.S(7)), Ui.Muted, TextFormatFlags.NoPrefix);
                lx -= Ui.S(20);
                using (var pen = new Pen(c.M, Ui.S(2)))
                {
                    if (c.Kieu == 1) pen.DashStyle = DashStyle.Dash;
                    int y = Ui.S(15);
                    if (c.Kieu == 2) g.DrawLine(pen, lx + Ui.S(9), Ui.S(8), lx + Ui.S(9), Ui.S(22));
                    else g.DrawLine(pen, lx + Ui.S(2), y, lx + Ui.S(16), y);
                }
                lx -= Ui.S(8);
                if (lx < Width / 2) break;
            }
            var plot = new Rectangle(Ui.S(44), Ui.S(32), Width - Ui.S(44) - Ui.S(14), Height - Ui.S(32) - Ui.S(28));
            if (plot.Width < 50 || plot.Height < 30) return;
            double max = Math.Max(n.RoRi + 10, 10);
            foreach (SoDoNl s in ds)
            {
                if (s.MucOn.HasValue) max = Math.Max(max, s.MucOn.Value + 5);
                if (s.DoTrai.HasValue) max = Math.Max(max, s.DoTrai.Value + 5);
            }
            max = Math.Ceiling(max / 10) * 10;
            Func<double, float> Y = v => plot.Bottom - (float)(Math.Max(0, Math.Min(max, v)) / max * plot.Height);
            float step = plot.Width / (float)SoNgay;
            Func<DateTime, float> X = t => plot.Left + ((float)(t - tu).TotalDays + 0.5f) * step;

            // lưới ngang + nhãn dB
            using (var pen = new Pen(Color.FromArgb(0xEC, 0xEF, 0xF3)))
                for (double v = 0; v <= max + 0.01; v += max > 60 ? 20 : 10)
                {
                    float y = Y(v);
                    g.DrawLine(pen, plot.Left, y, plot.Right, y);
                    TextRenderer.DrawText(g, So.M3(v), Ui.Small, new Rectangle(0, (int)y - Ui.S(8), plot.Left - Ui.S(4), Ui.S(16)), Ui.Muted,
                                          TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
                }
            // thời gian lắp logger: dải mỏng dưới trục
            using (var b = new SolidBrush(Color.FromArgb(0xC9, 0xDE, 0xF0)))
                foreach (LapDatNl l in d.LapDatCuaDiem(diem.Id))
                {
                    DateTime a = l.TuNgay < tu ? tu : l.TuNgay.Date, z = (l.DenNgay ?? den) > den ? den : (l.DenNgay ?? den).Date;
                    if (z < tu || a > den) continue;
                    float x1 = X(a) - step / 2, x2 = X(z) + step / 2;
                    g.FillRectangle(b, x1, plot.Bottom + 1, x2 - x1, Ui.S(4));
                }
            // đêm đang xem
            using (var b = new SolidBrush(Color.FromArgb(0xE8, 0xF0, 0xF8)))
                g.FillRectangle(b, X(den) - step / 2, plot.Top, step, plot.Height);
            // nhãn ngày
            for (int i = SoNgay - 1; i >= 0; i -= 7)
            {
                DateTime t = tu.AddDays(i);
                float x = X(t);
                TextRenderer.DrawText(g, t.ToString("dd/MM"), Ui.Small, new Rectangle((int)x - Ui.S(24), plot.Bottom + Ui.S(6), Ui.S(48), Ui.S(16)), Ui.Muted,
                                      TextFormatFlags.HorizontalCenter | TextFormatFlags.NoPrefix);
                using (var pen = new Pen(Color.FromArgb(0xEC, 0xEF, 0xF3))) g.DrawLine(pen, x, plot.Top, x, plot.Bottom);
            }
            // ngưỡng
            using (var pen = new Pen(MauRo, 1.2f) { DashStyle = DashStyle.Dash }) g.DrawLine(pen, plot.Left, Y(n.RoRi), plot.Right, Y(n.RoRi));
            using (var pen = new Pen(MauTheoDoi, 1.2f) { DashStyle = DashStyle.Dash }) g.DrawLine(pen, plot.Left, Y(n.TheoDoi), plot.Right, Y(n.TheoDoi));
            // ca rò rỉ
            foreach (RoRiNl r in d.RoRiCuaDiem(diem.Id))
            {
                VeMoc(g, r.NgayPhatHien.Date, MauRo, "rò", tu, X, plot);
                if (r.NgaySua.HasValue) VeMoc(g, r.NgaySua.Value.Date, MauTot, "sửa", tu, X, plot);
            }
            using (var pen = new Pen(Ui.Border)) g.DrawRectangle(pen, plot);
            if (ds.Count == 0)
            {
                TextRenderer.DrawText(g, "Chưa có số đo trong " + SoNgay + " đêm này", Ui.Base, plot, Ui.Muted,
                                      TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
                return;
            }
            VeDuong(g, ds.Where(x => x.DoTrai.HasValue).Select(x => new PointF(X(x.Ngay), Y(x.DoTrai.Value))).ToList(), ds.Where(x => x.DoTrai.HasValue).Select(x => x.Ngay).ToList(),
                    new Pen(MauTrai, 1.2f), null, step);
            var coMuc = ds.Where(x => x.MucOn.HasValue).ToList();
            VeDuong(g, coMuc.Select(x => new PointF(X(x.Ngay), Y(x.MucOn.Value))).ToList(), coMuc.Select(x => x.Ngay).ToList(), new Pen(MauMuc, 2f),
                    coMuc.Select(x => PhanTichNl.PhanLoai(x, n)).ToList(), step);
        }

        static void VeMoc(Graphics g, DateTime t, Color mau, string nhan, DateTime tu, Func<DateTime, float> X, Rectangle plot)
        {
            if (t < tu || X(t) > plot.Right) return;
            float x = X(t);
            using (var pen = new Pen(mau, 1.5f)) g.DrawLine(pen, x, plot.Top, x, plot.Bottom);
            TextRenderer.DrawText(g, nhan, Ui.Small, new Point((int)x + Ui.S(3), plot.Top + Ui.S(2)), mau, TextFormatFlags.NoPrefix);
        }

        static void VeDuong(Graphics g, List<PointF> pts, List<DateTime> ngay, Pen pen, List<KetLuanNl> loai, float step)
        {
            using (pen)
            {
                for (int i = 1; i < pts.Count; i++)
                    if ((ngay[i] - ngay[i - 1]).TotalDays <= 3) g.DrawLine(pen, pts[i - 1], pts[i]);
                float r = loai != null ? Math.Max(2.5f, Math.Min(5f, step / 3)) : 2f;
                for (int i = 0; i < pts.Count; i++)
                {
                    Color c = pen.Color;
                    if (loai != null)
                        c = loai[i] == KetLuanNl.NghiRoRi ? MauRo : loai[i] == KetLuanNl.TheoDoi ? MauTheoDoi : MauTot;
                    using (var b = new SolidBrush(c)) g.FillEllipse(b, pts[i].X - r, pts[i].Y - r, 2 * r, 2 * r);
                }
            }
        }
    }
}
