using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Nhập kế hoạch giao chỉ tiêu năm (mẫu "KẾ HOẠCH GIAO CHỈ TIÊU NĂM"): sản lượng phát ra, chuẩn thu,
    /// doanh thu tiền nước, tỷ lệ thất thoát, tồn hoá đơn của từng đội / khu vực / toàn công ty —
    /// kèm thực hiện lũy kế và % hoàn thành để theo dõi trong năm.
    /// </summary>
    public class KeHoachPage : UserControl, ITrang
    {
        const int cStt = 0, cTen = 1, cPr = 2, cCt = 3, cDt = 4, cTl = 5, cTon = 6,
                  cThPr = 7, cHtPr = 8, cThCt = 9, cHtCt = 10, cThTl = 11, cSoTl = 12, cT12 = 13;
        static readonly LoaiChiTieu[] CotNhap = { LoaiChiTieu.PhatRa, LoaiChiTieu.ChuanThu, LoaiChiTieu.DoanhThu, LoaiChiTieu.TyLe, LoaiChiTieu.TonHoaDon };
        static readonly Color NenKh = Color.FromArgb(0xFB, 0xF1, 0xC9);   // tiêu đề cột kế hoạch
        static readonly Color NenTh = Color.FromArgb(0xDC, 0xE9, 0xF5);   // tiêu đề cột thực hiện

        readonly PhienLam phien;
        readonly ComboBox cboNam;
        readonly Button btnThemNam, btnChep, btnXoa, btnXuat, btnNhap;
        readonly LuoiNhap grid;
        readonly Label lblTomTat;
        readonly ToolTip tip = new ToolTip();
        readonly HashSet<int> namThem = new HashSet<int>();
        List<Muc> dong = new List<Muc>();
        int nam;
        bool dangNap;

        public event EventHandler MoNhapExcel;

        public KeHoachPage(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;

            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 0, 0, 4) };
            var title = Ui.MakeLabel("Kế hoạch năm", Ui.Title, Ui.Text);
            title.Margin = Ui.Pad(0, 0, 16, 0);
            top.Controls.Add(title);
            var lblNam = Ui.MakeLabel("Năm", Ui.Base, Ui.Text);
            lblNam.Margin = Ui.Pad(0, 10, 6, 0);
            top.Controls.Add(lblNam);
            cboNam = Ui.MakeCombo(100);
            cboNam.Margin = Ui.Pad(0, 7, 10, 0);
            cboNam.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap || !(cboNam.SelectedItem is int)) return;
                KetThucSua();
                nam = (int)cboNam.SelectedItem;
                Nap();
            };
            top.Controls.Add(cboNam);
            btnThemNam = Ui.MakeButton("+ Thêm năm", true);
            btnThemNam.Click += (s, e) => ThemNam();
            btnChep = Ui.MakeButton("Chép kế hoạch năm trước", false);
            btnChep.Click += (s, e) => ChepNamTruoc();
            btnNhap = Ui.MakeButton("Nhập từ Excel…", false);
            btnNhap.Click += (s, e) => { if (MoNhapExcel != null) MoNhapExcel(this, EventArgs.Empty); };
            btnXuat = QuyenUi.ChoXem(Ui.MakeButton("Xuất Excel", false));
            btnXuat.Click += (s, e) => Xuat(false);
            var btnIn = XuatPage.NutIn();
            btnIn.Click += (s, e) => Xuat(true);
            btnXoa = Ui.MakeButton("Xoá kế hoạch năm này", false);
            btnXoa.Click += (s, e) => XoaNam();
            foreach (Button b in new[] { btnThemNam, btnChep, btnNhap, btnXuat, btnIn, btnXoa })
            {
                b.Margin = Ui.Pad(0, 4, 8, 0);
                top.Controls.Add(b);
            }
            tip.SetToolTip(btnNhap, "Nhập trang \"KẾ HOẠCH NĂM\" / \"KẾ HOẠCH GIAO CHỈ TIÊU NĂM\" từ file Excel");

            var huongDan = new Label
            {
                Dock = DockStyle.Top,
                AutoSize = false,
                Height = Ui.S(48),
                Font = Ui.Small,
                ForeColor = Ui.Muted,
                Padding = Ui.Pad(2, 2, 0, 6),
                Text = "Cột nền vàng là kế hoạch giao: gõ số rồi Enter để xuống dòng; dán được cả bảng từ Excel (chọn ô đầu rồi Ctrl+V); Delete để xoá. " +
                       "Cột nền xanh là thực hiện lũy kế do phần mềm tự tính từ số liệu tháng. Tỷ lệ thất thoát kế hoạch dùng cho cột \"So kế hoạch\" của các báo cáo."
            };

            grid = new LuoiNhap { Dock = DockStyle.Fill };
            Ui.StyleGrid(grid);
            grid.SelectionMode = DataGridViewSelectionMode.CellSelect;
            grid.MultiSelect = false;
            grid.EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2;
            grid.ColumnHeadersHeight = Ui.S(58);
            grid.RowTemplate.Height = Ui.S(30);
            string[] heads = { "STT", "Đơn vị",
                               "KH: Sản lượng\nphát ra (m³)", "KH: Sản lượng\nchuẩn thu (m³)", "KH: Doanh thu\ntiền nước (đồng)", "KH: Tỷ lệ\nthất thoát (%)", "KH: Tồn\nhoá đơn (%)",
                               "TH: Phát ra\nlũy kế (m³)", "% hoàn\nthành", "TH: Chuẩn thu\nlũy kế (m³)", "% hoàn\nthành", "TH: Tỷ lệ TT\nlũy kế (%)", "So kế\nhoạch", "TT tháng 12\nnăm trước (%)" };
            int[] widths = { 50, 230, 118, 118, 140, 90, 82, 112, 70, 112, 70, 90, 70, 96 };
            for (int i = 0; i < heads.Length; i++) grid.Columns.Add(Ui.Col(heads[i], widths[i], i >= cPr));
            grid.Columns[cStt].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            grid.Columns[cStt].Frozen = true;
            grid.Columns[cTen].Frozen = true;
            for (int c = cPr; c <= cTon; c++) grid.Columns[c].HeaderCell.Style.BackColor = NenKh;
            for (int c = cThPr; c <= cSoTl; c++) grid.Columns[c].HeaderCell.Style.BackColor = NenTh;
            grid.CoTheSua = (r, c) => c >= cPr && c <= cTon && r >= 0 && r < dong.Count;
            grid.CellBeginEdit += (s, e) => { if (!grid.CoTheSua(e.RowIndex, e.ColumnIndex)) e.Cancel = true; };
            grid.CellEndEdit += Grid_CellEndEdit;
            grid.KeyDown += Grid_KeyDown;
            grid.DataError += (s, e) => e.ThrowException = false;

            lblTomTat = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblTomTat.Dock = DockStyle.Bottom;
            lblTomTat.Padding = Ui.Pad(2, 8, 0, 0);

            var host = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            host.Controls.Add(grid);
            Controls.Add(host);
            Controls.Add(lblTomTat);
            Controls.Add(huongDan);
            Controls.Add(top);
            phien.DaDoi += (s, e) => { if (Visible && s != this) KhiHien(); };
        }

        public void KetThucSua()
        {
            if (grid.IsCurrentCellInEditMode) grid.EndEdit();
        }

        static LoaiChiTieu LoaiCua(int col)
        {
            return CotNhap[col - cPr];
        }

        List<int> CacNam()
        {
            var years = new HashSet<int>(phien.Dl.CacNam());
            foreach (int y in phien.Dl.KeHoach.Keys) years.Add(y);
            foreach (int y in namThem) years.Add(y);
            years.Add(DateTime.Today.Year);
            return years.OrderByDescending(y => y).ToList();
        }

        public void KhiHien()
        {
            dangNap = true;
            List<int> years = CacNam();
            cboNam.Items.Clear();
            foreach (int y in years) cboNam.Items.Add(y);
            if (!years.Contains(nam)) nam = phien.ThangChon != null ? phien.ThangChon.Nam : DateTime.Today.Year;
            cboNam.SelectedItem = nam;
            dangNap = false;
            btnThemNam.Text = "+ Thêm năm " + (years.Max() + 1);
            Nap();
        }

        /// <summary>Danh sách đơn vị theo tháng cuối của năm; năm chưa có số liệu thì theo tháng mới nhất trước đó.</summary>
        ThangBaoCao ThangCauTruc()
        {
            DuLieu dl = phien.Dl;
            return dl.Thang.Where(t => t.Nam == nam).OrderBy(t => t.Thang).LastOrDefault()
                ?? dl.Thang.Where(t => t.Nam < nam).OrderBy(t => t.SoThu).LastOrDefault()
                ?? dl.ThangCuoi;
        }

        ThangBaoCao ThangCuoiNam()
        {
            return phien.Dl.Thang.Where(t => t.Nam == nam).OrderBy(t => t.Thang).LastOrDefault();
        }

        void Nap()
        {
            dangNap = true;
            try
            {
                int curR = grid.CurrentCell != null ? grid.CurrentCell.RowIndex : -1;
                int curC = grid.CurrentCell != null ? grid.CurrentCell.ColumnIndex : cTl;
                grid.Rows.Clear();
                ThangBaoCao cauTruc = ThangCauTruc();
                ThangBaoCao cuoi = ThangCuoiNam();
                string den = cuoi != null ? "\nđến T" + cuoi.Thang : "";
                grid.Columns[cThPr].HeaderText = "TH: Phát ra\nlũy kế" + den;
                grid.Columns[cThCt].HeaderText = "TH: Chuẩn thu\nlũy kế" + den;
                grid.Columns[cThTl].HeaderText = "TH: Tỷ lệ TT\nlũy kế (%)";
                grid.Columns[cT12].HeaderText = "TT tháng\n12/" + (nam - 1) + " (%)";
                btnChep.Text = "Chép kế hoạch năm " + (nam - 1);
                btnXoa.Text = "Xoá kế hoạch năm " + nam;
                dong = cauTruc == null ? new List<Muc>() : cauTruc.Muc.Where(m => m.CoChuanThu && m.VaiTro != VaiTro.Dma).ToList();
                if (dong.Count > 0) grid.Rows.Add(dong.Count);
                for (int r = 0; r < dong.Count; r++)
                {
                    Muc m = dong[r];
                    DataGridViewRow row = grid.Rows[r];
                    bool dam = m.VaiTro == VaiTro.Doi || m.VaiTro == VaiTro.ToanCongTy || m.Cap == 0;
                    if (dam)
                    {
                        row.DefaultCellStyle.Font = Ui.BaseBold;
                        row.DefaultCellStyle.BackColor = m.VaiTro == VaiTro.ToanCongTy ? Ui.Selection : Ui.GroupRow;
                    }
                    row.Cells[cStt].Value = m.VaiTro == VaiTro.Dma ? "" : m.Stt;
                    row.Cells[cTen].Value = m.VaiTro == VaiTro.Doi || m.VaiTro == VaiTro.ToanCongTy ? m.TenTongHop.ToUpper(So.VN) : m.TenTongHop;
                    row.Cells[cTen].Style.Padding = new Padding(Ui.S(dam ? 4 : 20), 0, Ui.S(3), 0);
                    row.Cells[cTen].ToolTipText = m.TenMotDong;
                    for (int c = cPr; c <= cTon; c++) row.Cells[c].Style.BackColor = Ui.Input;
                }
                CapNhatGiaTri();
                if (dong.Count > 0)
                {
                    int r = curR >= 0 && curR < dong.Count ? curR : 0;
                    int c = curC >= cPr && curC <= cTon ? curC : cTl;
                    grid.CurrentCell = grid.Rows[r].Cells[c];
                }
                btnChep.Enabled = btnXoa.Enabled = btnXuat.Enabled = dong.Count > 0;
            }
            finally
            {
                dangNap = false;
            }
        }

        static string PhanTram(double? th, double? kh)
        {
            return th.HasValue && kh.HasValue && kh.Value != 0 ? So.P2(th / kh * 100) : "";
        }

        void CapNhatGiaTri()
        {
            DuLieu dl = phien.Dl;
            ThangBaoCao cuoi = ThangCuoiNam();
            KetQuaThang kqCuoi = cuoi != null ? phien.Bt.Tinh(cuoi) : null;
            ThangBaoCao dec = dl.TimThang(nam - 1, 12);
            KetQuaThang kqDec = dec != null ? phien.Bt.Tinh(dec) : null;
            ThangBaoCao jan = dl.TimThang(nam, 1);
            int coKh = 0;
            for (int r = 0; r < dong.Count && r < grid.RowCount; r++)
            {
                Muc m = dong[r];
                DataGridViewRow row = grid.Rows[r];
                ChiTieu ct = dl.LayChiTieu(nam, m.Id) ?? new ChiTieu();
                if (!ct.Trong) coKh++;
                row.Cells[cPr].Value = So.M3(ct.PhatRa);
                row.Cells[cCt].Value = So.M3(ct.ChuanThu);
                row.Cells[cDt].Value = So.M3(ct.DoanhThu);
                row.Cells[cTl].Value = So.Nhap(ct.TyLe);
                row.Cells[cTon].Value = So.Nhap(ct.TonHoaDon);
                KetQua k = kqCuoi != null ? kqCuoi[m.Id] : null;
                double? thPr = k != null ? (double?)k.LkPhatRa : null, thCt = k != null ? k.LkChuanThu : null, thTl = k != null ? k.LkTyLe : null;
                row.Cells[cThPr].Value = So.M3(thPr);
                row.Cells[cHtPr].Value = PhanTram(thPr, ct.PhatRa);
                row.Cells[cThCt].Value = So.M3(thCt);
                row.Cells[cHtCt].Value = PhanTram(thCt, ct.ChuanThu);
                row.Cells[cThTl].Value = So.P2(thTl);
                double? so = thTl.HasValue && ct.TyLe.HasValue ? thTl - ct.TyLe : null;
                row.Cells[cSoTl].Value = So.Lech(so);
                row.Cells[cSoTl].Style.ForeColor = Ui.MauLech(so);
                row.Cells[cThTl].Style.ForeColor = so.HasValue ? (so > 0 ? Ui.Danger : Ui.Success) : Ui.Text;
                row.Cells[cSoTl].ToolTipText = so.HasValue ? (so > 0 ? "Thất thoát lũy kế đang cao hơn kế hoạch " : "Thất thoát lũy kế đang thấp hơn kế hoạch ") + So.P2(Math.Abs(so.Value)) + "%" : "";
                if (cuoi != null && ct.PhatRa.HasValue && thPr.HasValue)
                    row.Cells[cHtPr].ToolTipText = "Đã thực hiện " + So.P2(thPr / ct.PhatRa * 100) + "% kế hoạch sau " + cuoi.Thang + " tháng (bình quân " +
                                                   So.P2(cuoi.Thang / 12.0 * 100) + "% theo thời gian)";
                double? t12 = null;
                if (kqDec != null && kqDec[m.Id] != null) t12 = kqDec[m.Id].TyLe;
                else if (jan != null && jan.Tim(m.Id) != null) t12 = jan.Tim(m.Id).TyLeThangTruoc;
                row.Cells[cT12].Value = So.P2(t12);
            }
            ThangBaoCao ctruc = ThangCauTruc();
            lblTomTat.Text = dong.Count == 0
                ? "Chưa có cấu trúc đơn vị — nhập số liệu tháng trước (trang Nhập số liệu tháng)."
                : "Năm " + nam + ": đã có kế hoạch cho " + coKh + "/" + dong.Count + " đơn vị. Danh sách đơn vị theo cấu trúc " + ctruc.Ten.ToLower() +
                  (ThangCuoiNam() != null ? "; thực hiện lũy kế đến " + ThangCuoiNam().Ten.ToLower() : "; năm này chưa có số liệu thực hiện") + ". Mọi thay đổi được lưu ngay.";
        }

        // ------------------------------------------------------------------ nhập

        static bool HopLe(LoaiChiTieu l, double? v)
        {
            if (!v.HasValue) return true;
            if (l == LoaiChiTieu.TyLe || l == LoaiChiTieu.TonHoaDon) return v >= 0 && v <= 100;
            return v >= 0;
        }

        void Grid_CellEndEdit(object sender, DataGridViewCellEventArgs e)
        {
            if (dangNap || !grid.CoTheSua(e.RowIndex, e.ColumnIndex)) return;
            string text = Convert.ToString(grid.Rows[e.RowIndex].Cells[e.ColumnIndex].Value);
            if (!Ghi(e.RowIndex, e.ColumnIndex, text))
            {
                grid.GiuO = true;
                CapNhatGiaTri();
                LoaiChiTieu l = LoaiCua(e.ColumnIndex);
                Rectangle rc = grid.GetCellDisplayRectangle(e.ColumnIndex, e.RowIndex, false);
                tip.Show("\"" + text + "\" không hợp lệ — " + (l == LoaiChiTieu.TyLe || l == LoaiChiTieu.TonHoaDon ? "tỷ lệ % từ 0 đến 100, vd 15 hoặc 15,5" : "số không âm, vd 6152000 hoặc 6.152.000"),
                         grid, rc.Left, rc.Bottom + Ui.S(2), 3500);
            }
        }

        bool Ghi(int r, int c, string text)
        {
            double? v;
            LoaiChiTieu l = LoaiCua(c);
            if (!So.TryDoc(text, out v) || !HopLe(l, v)) return false;
            Muc m = dong[r];
            if (!Nullable.Equals(phien.Dl.LayKeHoach(nam, m.Id, l), v))
            {
                phien.Dl.DatKeHoach(nam, m.Id, l, v);
                phien.Luu(this);
            }
            CapNhatGiaTri();
            return true;
        }

        void Grid_KeyDown(object sender, KeyEventArgs e)
        {
            if (grid.CurrentCell == null || grid.IsCurrentCellInEditMode) return;
            int r = grid.CurrentCell.RowIndex, c = grid.CurrentCell.ColumnIndex;
            if (!grid.CoTheSua(r, c)) return;
            if (e.KeyCode == Keys.Delete)
            {
                Ghi(r, c, "");
                e.Handled = true;
            }
            else if (e.Control && e.KeyCode == Keys.V)
            {
                Dan(r, c);
                e.Handled = true;
            }
        }

        /// <summary>Dán 1 ô, 1 cột hoặc cả bảng (chép từ Excel) bắt đầu từ ô đang chọn, sang phải và xuống dưới.</summary>
        void Dan(int r, int c)
        {
            string text = Clipboard.ContainsText() ? Clipboard.GetText() : "";
            var lines = text.Replace("\r", "").Split('\n').ToList();
            while (lines.Count > 0 && lines[lines.Count - 1].Trim().Length == 0) lines.RemoveAt(lines.Count - 1);
            if (lines.Count == 0) return;
            var cells = lines.Select(x => x.Split('\t')).ToList();
            int nRow = Math.Min(cells.Count, dong.Count - r);
            int nCol = Math.Min(cells.Max(x => x.Length), cTon - c + 1);
            if ((nRow > 1 || nCol > 1) && !Ui.Confirm(this, "Dán " + nRow + " dòng × " + nCol + " cột vào kế hoạch năm " + nam + ",\ntừ \"" + dong[r].TenTongHop +
                                                            "\" / " + grid.Columns[c].HeaderText.Replace("\n", " ") + "?"))
                return;
            int bad = 0;
            for (int i = 0; i < nRow; i++)
                for (int j = 0; j < nCol && j < cells[i].Length; j++)
                {
                    double? v;
                    LoaiChiTieu l = LoaiCua(c + j);
                    if (So.TryDoc(cells[i][j], out v) && HopLe(l, v)) phien.Dl.DatKeHoach(nam, dong[r + i].Id, l, v);
                    else bad++;
                }
            phien.Luu(this);
            CapNhatGiaTri();
            if (bad > 0) Ui.Error(this, bad + " ô không phải số hợp lệ nên bị bỏ qua.");
        }

        // ------------------------------------------------------------------ thao tác năm

        void ThemNam()
        {
            KetThucSua();
            int moi = CacNam().Max() + 1;
            namThem.Add(moi);
            nam = moi;
            KhiHien();
            if (phien.Dl.CoKeHoach(moi - 1) && Ui.Confirm(this, "Đã thêm năm " + moi + ".\n\nChép kế hoạch năm " + (moi - 1) + " sang làm số ban đầu (sửa lại sau)?"))
                ChepTu(moi - 1, false);
            grid.Focus();
        }

        void ChepNamTruoc()
        {
            KetThucSua();
            if (!phien.Dl.CoKeHoach(nam - 1))
            {
                Ui.Info(this, "Năm " + (nam - 1) + " chưa có kế hoạch để chép.");
                return;
            }
            bool coSan = dong.Any(m => phien.Dl.LayChiTieu(nam, m.Id) != null);
            if (coSan && !Ui.Confirm(this, "Năm " + nam + " đã có kế hoạch. Thay bằng kế hoạch năm " + (nam - 1) + "?")) return;
            ChepTu(nam - 1, true);
        }

        void ChepTu(int namNguon, bool thay)
        {
            int n = 0;
            foreach (Muc m in dong)
            {
                ChiTieu nguon = phien.Dl.LayChiTieu(namNguon, m.Id);
                if (nguon == null) continue;
                foreach (LoaiChiTieu l in CotNhap)
                {
                    double? v = nguon.Lay(l);
                    if (!v.HasValue || (!thay && phien.Dl.LayKeHoach(nam, m.Id, l).HasValue)) continue;
                    phien.Dl.DatKeHoach(nam, m.Id, l, v);
                    n++;
                }
            }
            phien.Luu(this);
            CapNhatGiaTri();
            lblTomTat.Text = "Đã chép " + n + " số kế hoạch từ năm " + namNguon + ". " + lblTomTat.Text;
        }

        void XoaNam()
        {
            KetThucSua();
            if (!phien.Dl.CoKeHoach(nam))
            {
                Ui.Info(this, "Năm " + nam + " chưa có kế hoạch.");
                return;
            }
            if (!Ui.Confirm(this, "Xoá toàn bộ kế hoạch năm " + nam + "?\nCột \"So kế hoạch\" của các báo cáo năm " + nam + " sẽ để trống.")) return;
            phien.Dl.KeHoach.Remove(nam);
            phien.Luu(this);
            CapNhatGiaTri();
        }

        void Xuat(bool inRa)
        {
            KetThucSua();
            var bc = new BaoCao(phien.Dl, phien.Bt);
            int y = nam;
            XuatPage.XuatHoacIn(this, phien, () => bc.SoKeHoach(y), "KẾ HOẠCH GIAO CHỈ TIÊU NĂM " + y + ".xlsx", inRa);
        }
    }
}
