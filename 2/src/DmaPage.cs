using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Nhập vùng DMA của từng đội: danh sách vùng dưới mỗi đội / khu vực, số liệu hằng tháng (phát ra hoặc
    /// chỉ số đồng hồ tổng DMA, chuẩn thu, hoặc tỷ lệ gõ thẳng, tình trạng đồng hồ). Bảng tổng hợp năm lấy từ đây.
    /// </summary>
    public class DmaPage : UserControl, ITrang
    {
        const int cStt = 0, cTen = 1, cCu = 2, cMoi = 3, cPr = 4, cCt = 5, cTl = 6, cHt = 7, cLk = 8, cLkCt = 9, cLkTl = 10, cGc = 11;

        class Dong
        {
            public Muc Muc;
            public bool LaCha;
            public int Stt;
        }

        class MucThang
        {
            public ThangBaoCao Thang;
            public override string ToString() { return Thang.Ten; }
        }

        class MucDoi
        {
            public Muc Doi;
            public override string ToString() { return Doi == null ? "Tất cả các đội" : Doi.TenTongHop; }
        }

        readonly PhienLam phien;
        readonly ComboBox cboThang, cboDoi;
        readonly Button btnTao, btnThem, btnSua, btnXoa, btnLen, btnXuong, btnNhap, btnXuat;
        readonly LuoiNhap grid;
        readonly Label lblTomTat;
        readonly ToolTip tip = new ToolTip();
        ThangBaoCao thang;
        List<Dong> dong = new List<Dong>();
        int doiChon = -1;   // Id đội đang lọc, -1 = tất cả
        bool dangNap;

        public event EventHandler MoNhapExcel;

        public DmaPage(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;

            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 0, 0, 4) };
            var title = Ui.MakeLabel("Vùng DMA", Ui.Title, Ui.Text);
            title.Margin = Ui.Pad(0, 0, 16, 0);
            top.Controls.Add(title);
            cboThang = Ui.MakeCombo(150);
            cboThang.Margin = Ui.Pad(0, 7, 8, 0);
            cboThang.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap) return;
                var t = cboThang.SelectedItem as MucThang;
                if (t != null) { KetThucSua(); phien.ChonThang(t.Thang); }
            };
            top.Controls.Add(cboThang);
            cboDoi = Ui.MakeCombo(210);
            cboDoi.Margin = Ui.Pad(0, 7, 12, 0);
            cboDoi.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap) return;
                var d = cboDoi.SelectedItem as MucDoi;
                doiChon = d != null && d.Doi != null ? d.Doi.Id : -1;
                KetThucSua();
                Nap();
            };
            top.Controls.Add(cboDoi);
            btnTao = Ui.MakeButton("+ Tạo tháng mới", true);
            btnTao.Click += (s, e) => TaoThang();
            btnThem = Ui.MakeButton("+ Thêm vùng DMA", false);
            btnThem.Click += (s, e) => Them();
            btnSua = Ui.MakeButton("Sửa…", false);
            btnSua.Click += (s, e) => Sua();
            btnXoa = Ui.MakeButton("Xoá", false);
            btnXoa.Click += (s, e) => Xoa();
            btnLen = Ui.MakeButton("▲", false);
            btnLen.Click += (s, e) => DiChuyen(-1);
            btnXuong = Ui.MakeButton("▼", false);
            btnXuong.Click += (s, e) => DiChuyen(1);
            btnNhap = Ui.MakeButton("Nhập từ Excel…", false);
            btnNhap.Click += (s, e) => { if (MoNhapExcel != null) MoNhapExcel(this, EventArgs.Empty); };
            btnXuat = QuyenUi.ChoXem(Ui.MakeButton("Xuất bảng tổng hợp năm", false));
            btnXuat.Click += (s, e) => { KetThucSua(); if (thang != null) XuatPage.XuatTongHop(this, phien, thang.Nam); };
            var btnIn = XuatPage.NutIn();
            btnIn.Click += (s, e) => { KetThucSua(); if (thang != null) XuatPage.XuatTongHop(this, phien, thang.Nam, true); };
            foreach (Button b in new[] { btnTao, btnThem, btnSua, btnXoa, btnLen, btnXuong, btnNhap, btnXuat, btnIn })
            {
                b.Margin = Ui.Pad(0, 4, 8, 0);
                top.Controls.Add(b);
            }
            tip.SetToolTip(btnTao, "Tạo tháng kế tiếp sau tháng cuối (chép cấu trúc và danh sách vùng DMA) để nhập số liệu tháng mới");
            btnLen.MinimumSize = btnXuong.MinimumSize = new Size(Ui.S(40), Ui.S(34));
            tip.SetToolTip(btnLen, "Đưa vùng DMA lên trên (trong cùng đội / khu vực)");
            tip.SetToolTip(btnXuong, "Đưa vùng DMA xuống dưới");
            tip.SetToolTip(btnNhap, "Lấy các vùng DMA và tỷ lệ từng tháng trong bảng TỔNG HỢP của file Excel báo cáo");

            var huongDan = new Label
            {
                Dock = DockStyle.Top,
                AutoSize = false,
                Height = Ui.S(50),
                Font = Ui.Small,
                ForeColor = Ui.Muted,
                Padding = Ui.Pad(2, 2, 0, 6),
                Text = "Tháng mới: bấm \"+ Tạo tháng…\" (chép danh sách vùng). Mỗi vùng DMA thuộc 1 đội hoặc khu vực; nhập sản lượng phát ra (hoặc chỉ số đồng hồ tổng DMA) và chuẩn thu → tính tỷ lệ, lũy kế; " +
                       "chỉ có tỷ lệ thì gõ thẳng vào cột \"Thất thoát %\". Đồng hồ hỏng / đứng kim: để trống số, ghi tình trạng. Vùng DMA hiện ngay dưới đội / khu vực trong Bảng tổng hợp năm."
            };

            grid = new LuoiNhap { Dock = DockStyle.Fill };
            Ui.StyleGrid(grid);
            grid.SelectionMode = DataGridViewSelectionMode.CellSelect;
            grid.MultiSelect = false;
            grid.EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2;
            grid.ShowCellToolTips = true;
            string[] heads = { "STT", "Vùng DMA / đơn vị", "Chỉ số\ntháng trước", "Chỉ số\nhiện tại", "Phát ra\n(m³)", "Chuẩn thu\n(m³)", "Thất\nthoát %",
                               "So tháng\ntrước", "Lũy kế\nphát ra", "Lũy kế\nchuẩn thu", "Lũy kế\nTT %", "Tình trạng / ghi chú" };
            int[] widths = { 50, 300, 100, 100, 104, 100, 70, 70, 110, 110, 66, 230 };
            for (int i = 0; i < heads.Length; i++) grid.Columns.Add(Ui.Col(heads[i], widths[i], i >= cCu && i != cGc));
            grid.Columns[cStt].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            grid.Columns[cStt].Frozen = true;
            grid.Columns[cTen].Frozen = true;
            grid.CoTheSua = CoTheSua;
            grid.CellBeginEdit += (s, e) => { if (!CoTheSua(e.RowIndex, e.ColumnIndex)) e.Cancel = true; };
            grid.CellEndEdit += Grid_CellEndEdit;
            grid.CellDoubleClick += (s, e) => { if (e.RowIndex >= 0 && e.ColumnIndex == cTen) Sua(); };
            grid.KeyDown += Grid_KeyDown;
            grid.CurrentCellChanged += (s, e) => CapNhatNut();
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
            phien.DoiThang += (s, e) => { if (Visible) KhiHien(); };
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
                cboThang.Items.Clear();
                foreach (ThangBaoCao t in phien.Dl.Thang.AsEnumerable().Reverse()) cboThang.Items.Add(new MucThang { Thang = t });
                thang = phien.ThangChon;
                foreach (MucThang m in cboThang.Items) if (m.Thang == thang) cboThang.SelectedItem = m;
                cboDoi.Items.Clear();
                cboDoi.Items.Add(new MucDoi());
                if (thang != null)
                    foreach (Muc d in thang.Muc.Where(m => m.VaiTro == VaiTro.Doi)) cboDoi.Items.Add(new MucDoi { Doi = d });
                MucDoi chon = cboDoi.Items.Cast<MucDoi>().FirstOrDefault(x => x.Doi != null && x.Doi.Id == doiChon);
                if (chon == null) doiChon = -1;
                cboDoi.SelectedItem = chon ?? cboDoi.Items[0];
                btnTao.Text = ThaoTacThang.NhanNut(phien.Dl);
            }
            finally
            {
                dangNap = false;
            }
            Nap();
        }

        /// <summary>Khối của đội đang lọc: từ dòng đội tới trước dòng cấp 0 kế tiếp.</summary>
        bool TrongDoi(Muc m)
        {
            if (doiChon < 0) return true;
            int p = thang.ViTri(doiChon), i = thang.ViTri(m.Id);
            if (p < 0 || i < p) return false;
            int cuoi = thang.Muc.FindIndex(p + 1, x => x.Cap == 0);
            return cuoi < 0 || i < cuoi;
        }

        void Nap()
        {
            int curId = grid.CurrentCell != null && grid.CurrentCell.RowIndex < dong.Count ? dong[grid.CurrentCell.RowIndex].Muc.Id : -1;
            int curCol = grid.CurrentCell != null ? grid.CurrentCell.ColumnIndex : cPr;
            dangNap = true;
            try
            {
                grid.Rows.Clear();
                dong = new List<Dong>();
                if (thang == null)
                {
                    lblTomTat.Text = "Chưa có tháng nào — nhập số liệu tháng trước.";
                    return;
                }
                foreach (Muc u in thang.Muc.Where(m => VungDma.LaDonViCha(m) && TrongDoi(m)))
                {
                    dong.Add(new Dong { Muc = u, LaCha = true });
                    int stt = 0;
                    foreach (Muc d in VungDma.CuaDonVi(thang, u)) dong.Add(new Dong { Muc = d, Stt = ++stt });
                }
                if (dong.Count > 0) grid.Rows.Add(dong.Count);
                for (int r = 0; r < dong.Count; r++)
                {
                    Dong d = dong[r];
                    DataGridViewRow row = grid.Rows[r];
                    if (d.LaCha)
                    {
                        row.DefaultCellStyle.Font = Ui.BaseBold;
                        row.DefaultCellStyle.BackColor = d.Muc.VaiTro == VaiTro.Doi ? Ui.GroupRow : Ui.AreaRow;
                        row.Cells[cStt].Value = d.Muc.Stt;
                        row.Cells[cTen].Value = d.Muc.VaiTro == VaiTro.Doi ? d.Muc.TenTongHop.ToUpper(So.VN) : d.Muc.TenTongHop;
                        row.Cells[cTen].Style.Padding = new Padding(Ui.S(d.Muc.VaiTro == VaiTro.Doi ? 4 : 18), 0, Ui.S(3), 0);
                        row.Cells[cTen].ToolTipText = d.Muc.TenMotDong + "\n(số liệu của đơn vị lấy từ trang Nhập số liệu tháng)";
                    }
                    else
                    {
                        row.Cells[cStt].Value = d.Stt.ToString();
                        row.Cells[cTen].Value = d.Muc.TenMotDong;
                        Muc cha = VungDma.Cha(thang, d.Muc);
                        row.Cells[cTen].Style.Padding = new Padding(Ui.S(cha != null && cha.VaiTro == VaiTro.KhuVuc ? 36 : 22), 0, Ui.S(3), 0);
                        row.Cells[cTen].ToolTipText = d.Muc.TenMotDong + (d.Muc.Loai == LoaiMuc.DongHo ? "\nSản lượng theo chỉ số đồng hồ tổng DMA" : "\nNhập số m³ phát ra") +
                                                      "\nNhấp đúp để đổi tên / đơn vị / cách nhập";
                    }
                }
                CapNhatGiaTri();
                if (dong.Count > 0)
                {
                    int idx = dong.FindIndex(x => x.Muc.Id == curId && !x.LaCha);
                    if (idx < 0) idx = dong.FindIndex(x => !x.LaCha);
                    if (idx < 0) idx = 0;
                    int col = CoTheSua(idx, curCol) ? curCol : (dong[idx].LaCha ? cTen : (dong[idx].Muc.Loai == LoaiMuc.DongHo ? cMoi : cPr));
                    grid.CurrentCell = grid.Rows[idx].Cells[col];
                }
            }
            finally
            {
                dangNap = false;
            }
            CapNhatNut();
        }

        bool CoTheSua(int r, int c)
        {
            if (r < 0 || r >= dong.Count || dong[r].LaCha) return false;
            Muc m = dong[r].Muc;
            switch (c)
            {
                case cCu:
                case cMoi: return m.Loai == LoaiMuc.DongHo;
                case cPr: return m.Loai == LoaiMuc.NhapTay;
                case cCt: return true;
                case cTl: return !CoSanLuong(m);
                case cGc: return true;
            }
            return false;
        }

        static bool CoSanLuong(Muc m)
        {
            bool pr = m.Loai == LoaiMuc.NhapTay ? m.SanLuong.HasValue : m.ChiSoMoi.HasValue;
            return pr || m.ChuanThu.HasValue;
        }

        void CapNhatGiaTri()
        {
            if (thang == null) return;
            KetQuaThang kq = phien.Bt.Tinh(thang);
            int vung = 0, coSo = 0;
            for (int r = 0; r < dong.Count && r < grid.RowCount; r++)
            {
                Dong d = dong[r];
                Muc m = d.Muc;
                KetQua k = kq[m.Id];
                DataGridViewRow row = grid.Rows[r];
                bool dongHo = !d.LaCha && m.Loai == LoaiMuc.DongHo;
                row.Cells[cCu].Value = dongHo ? So.N0(m.ChiSoCu) : "";
                row.Cells[cMoi].Value = dongHo ? So.N0(m.ChiSoMoi) : "";
                bool thieu = d.LaCha && k.ThieuSoLieu;   // đơn vị chưa nhập đủ ở trang Nhập số liệu tháng
                row.Cells[cPr].Value = thieu ? "" : So.M3(k.PhatRa);
                row.Cells[cCt].Value = So.M3(k.ChuanThu);
                row.Cells[cTl].Value = thieu ? "" : So.P2(k.TyLe);
                if (d.LaCha) row.Cells[cPr].ToolTipText = thieu ? "Đơn vị chưa nhập đủ chỉ số tháng này (trang Nhập số liệu tháng)" : "";
                row.Cells[cHt].Value = So.Lech(k.SoThangTruoc);
                row.Cells[cHt].Style.ForeColor = Ui.MauLech(k.SoThangTruoc);
                row.Cells[cLk].Value = So.M3(k.LkPhatRa);
                row.Cells[cLkCt].Value = So.M3(k.LkChuanThu);
                row.Cells[cLkTl].Value = So.P2(k.LkTyLe);
                row.Cells[cGc].Value = d.LaCha ? "" : (m.GhiChu ?? "").Replace("\n", " ");
                if (!d.LaCha)
                {
                    vung++;
                    if (k.TyLe.HasValue || (m.GhiChu ?? "").Length > 0) coSo++;
                    for (int c = cCu; c <= cGc; c++)
                        row.Cells[c].Style.BackColor = CoTheSua(r, c) && c != cGc ? Ui.Input : Color.Empty;
                    bool batThuong = k.TyLe.HasValue && (k.TyLe < 0 || k.TyLe > 100);
                    row.Cells[cTl].Style.ForeColor = batThuong ? Ui.Danger : Ui.Text;
                    row.Cells[cTl].ToolTipText = batThuong ? "Tỷ lệ bất thường — kiểm tra lại số liệu" :
                        CoSanLuong(m) ? "Tính từ phát ra và chuẩn thu" : "Gõ thẳng tỷ lệ % khi đội chỉ báo tỷ lệ";
                }
            }
            lblTomTat.Text = thang.Ten + ": " + vung + " vùng DMA" + (doiChon >= 0 ? " của đội đang chọn" : "") + ", đã có số liệu " + coSo + ", còn " + (vung - coSo) +
                             " vùng chưa nhập. Mọi thay đổi được lưu ngay; tháng mới tạo sẽ chép danh sách vùng DMA.";
        }

        void CapNhatNut()
        {
            Dong d = DongChon();
            bool laDma = d != null && !d.LaCha;
            btnSua.Enabled = btnXoa.Enabled = btnLen.Enabled = btnXuong.Enabled = laDma;
            btnThem.Enabled = thang != null;
            btnTao.Enabled = phien.Dl.ThangCuoi != null;
        }

        /// <summary>Tạo tháng kế tiếp (như nút trên trang Nhập số liệu) rồi đưa con trỏ tới ô nhập của vùng DMA đầu tiên.</summary>
        void TaoThang()
        {
            KetThucSua();
            if (phien.Dl.ThangCuoi == null)
            {
                Ui.Info(this, "Chưa có tháng nào — vào trang Nhập số liệu tháng để tạo tháng đầu tiên hoặc nhập từ file Excel.");
                return;
            }
            ThangBaoCao moi = ThaoTacThang.TaoThangSau(FindForm(), phien, true);
            if (moi == null) return;
            KhiHien();
            Dong dau = dong.FirstOrDefault(x => !x.LaCha);
            if (dau != null) ChonVung(dau.Muc.Id);
            lblTomTat.Text = "Đã tạo " + moi.Ten.ToLower() + " với " + moi.Muc.Count(m => m.VaiTro == VaiTro.Dma) +
                             " vùng DMA — nhập phát ra, chuẩn thu từng vùng (Enter để xuống dòng). " + lblTomTat.Text;
        }

        Dong DongChon()
        {
            int r = grid.CurrentCell != null ? grid.CurrentCell.RowIndex : -1;
            return r >= 0 && r < dong.Count ? dong[r] : null;
        }

        // ------------------------------------------------------------------ nhập số

        void Grid_CellEndEdit(object sender, DataGridViewCellEventArgs e)
        {
            if (dangNap || !CoTheSua(e.RowIndex, e.ColumnIndex)) return;
            string text = Convert.ToString(grid.Rows[e.RowIndex].Cells[e.ColumnIndex].Value);
            if (!Ghi(e.RowIndex, e.ColumnIndex, text))
            {
                grid.GiuO = true;
                CapNhatGiaTri();
                Rectangle rc = grid.GetCellDisplayRectangle(e.ColumnIndex, e.RowIndex, false);
                tip.Show("\"" + text + "\" không phải số hợp lệ. Gõ dạng 12345 hoặc 12.345; tỷ lệ dạng 15,5", grid, rc.Left, rc.Bottom + Ui.S(2), 3500);
            }
        }

        bool Ghi(int r, int c, string text)
        {
            Muc m = dong[r].Muc;
            if (c == cGc)
            {
                string g = (text ?? "").Trim();
                if (g == (m.GhiChu ?? "")) return true;
                m.GhiChu = g;
            }
            else
            {
                double? v;
                if (!So.TryDoc(text, out v)) return false;
                switch (c)
                {
                    case cCu: if (Nullable.Equals(m.ChiSoCu, v)) { CapNhatGiaTri(); return true; } m.ChiSoCu = v; break;
                    case cMoi: if (Nullable.Equals(m.ChiSoMoi, v)) { CapNhatGiaTri(); return true; } m.ChiSoMoi = v; break;
                    case cPr: if (Nullable.Equals(m.SanLuong, v)) { CapNhatGiaTri(); return true; } m.SanLuong = v; break;
                    case cCt: if (Nullable.Equals(m.ChuanThu, v)) { CapNhatGiaTri(); return true; } m.ChuanThu = v; break;
                    case cTl: if (Nullable.Equals(m.TyLeNhap, v)) { CapNhatGiaTri(); return true; } m.TyLeNhap = v; break;
                    default: return false;
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

        // ------------------------------------------------------------------ thêm / sửa / xoá vùng

        Muc ChaMacDinh()
        {
            Dong d = DongChon();
            if (d == null) return doiChon >= 0 ? thang.Tim(doiChon) : null;
            return d.LaCha ? d.Muc : VungDma.Cha(thang, d.Muc);
        }

        void Them()
        {
            if (thang == null) return;
            KetThucSua();
            using (var f = new DmaForm(thang, null, ChaMacDinh()))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                Muc m = VungDma.Them(phien.Dl, thang, f.ChaId, f.Ten, f.Loai);
                phien.Luu(this);
                Nap();
                if (m != null) ChonVung(m.Id);
            }
        }

        void Sua()
        {
            Dong d = DongChon();
            if (d == null || d.LaCha) return;
            KetThucSua();
            using (var f = new DmaForm(thang, d.Muc, VungDma.Cha(thang, d.Muc)))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                VungDma.Sua(phien.Dl, thang, d.Muc.Id, f.Ten, f.ChaId, f.Loai);
                phien.Luu(this);
                Nap();
                ChonVung(d.Muc.Id);
            }
        }

        void Xoa()
        {
            Dong d = DongChon();
            if (d == null || d.LaCha) return;
            KetThucSua();
            var sau = phien.Dl.Thang.Where(t => t.SoThu > thang.SoThu && t.Tim(d.Muc.Id) != null).ToList();
            if (!Ui.Confirm(this, "Xoá vùng DMA \"" + d.Muc.TenMotDong + "\" khỏi " + thang.Ten.ToLower() +
                                  (sau.Count > 0 ? " và " + sau.Count + " tháng sau" : "") + "?\n\nSố liệu các tháng trước vẫn giữ và vẫn hiện trong bảng tổng hợp năm."))
                return;
            VungDma.Xoa(phien.Dl, thang, d.Muc.Id);
            phien.Luu(this);
            Nap();
        }

        void DiChuyen(int huong)
        {
            Dong d = DongChon();
            if (d == null || d.LaCha) return;
            KetThucSua();
            if (!VungDma.DiChuyen(phien.Dl, thang, d.Muc.Id, huong)) return;
            phien.Luu(this);
            Nap();
            ChonVung(d.Muc.Id);
        }

        void ChonVung(int id)
        {
            int r = dong.FindIndex(x => !x.LaCha && x.Muc.Id == id);
            if (r < 0) return;
            Muc m = dong[r].Muc;
            try { grid.CurrentCell = grid.Rows[r].Cells[m.Loai == LoaiMuc.DongHo ? cMoi : cPr]; }
            catch (InvalidOperationException) { }
            grid.Focus();
        }
    }

    /// <summary>Thêm / sửa 1 vùng DMA: tên, đội / khu vực chứa, cách có sản lượng phát ra.</summary>
    class DmaForm : Form
    {
        class MucCha
        {
            public Muc Muc;
            public override string ToString() { return (Muc.VaiTro == VaiTro.KhuVuc ? "      " : "") + Muc.TenTongHop; }
        }

        readonly TextBox txtTen;
        readonly ComboBox cboCha;
        readonly RadioButton rNhap, rDongHo;

        public string Ten { get { return txtTen.Text.Trim(); } }
        public int ChaId { get { return ((MucCha)cboCha.SelectedItem).Muc.Id; } }
        public LoaiMuc Loai { get { return rDongHo.Checked ? LoaiMuc.DongHo : LoaiMuc.NhapTay; } }

        public DmaForm(ThangBaoCao thang, Muc dma, Muc cha)
        {
            Text = dma == null ? "Thêm vùng DMA" : "Sửa vùng DMA";
            Font = Ui.Base;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(600), Ui.S(330));
            BackColor = Ui.Surface;

            var tbl = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = Ui.Pad(18, 16, 18, 6), ColumnCount = 2 };
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(150)));
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(tbl);

            txtTen = new TextBox { Font = Ui.Base, Width = Ui.S(390), Text = dma != null ? dma.TenMotDong : "DMA " };
            Ui.SetCue(txtTen, "vd DMA Phường IV - Vị Tân");
            Row(tbl, "Tên vùng DMA", txtTen);
            cboCha = Ui.MakeCombo(390);
            foreach (Muc u in thang.Muc.Where(VungDma.LaDonViCha)) cboCha.Items.Add(new MucCha { Muc = u });
            foreach (MucCha c in cboCha.Items) if (cha != null && c.Muc.Id == cha.Id) cboCha.SelectedItem = c;
            if (cboCha.SelectedIndex < 0 && cboCha.Items.Count > 0) cboCha.SelectedIndex = 0;
            Row(tbl, "Thuộc đội / khu vực", cboCha);
            rNhap = new RadioButton { Text = "Nhập số m³ phát ra (đội báo lên)", AutoSize = true, Checked = dma == null || dma.Loai != LoaiMuc.DongHo };
            rDongHo = new RadioButton { Text = "Theo chỉ số đồng hồ tổng DMA (hiện tại − tháng trước)", AutoSize = true, Checked = dma != null && dma.Loai == LoaiMuc.DongHo };
            var grp = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, Margin = new Padding(0) };
            grp.Controls.Add(rNhap);
            grp.Controls.Add(rDongHo);
            Row(tbl, "Sản lượng phát ra", grp);
            var note = Ui.MakeLabel("Áp dụng từ " + thang.Ten.ToLower() + " và các tháng sau đã tạo; các tháng trước giữ nguyên. " +
                                    "Đổi cách nhập sẽ xoá số phát ra / chỉ số đã nhập của vùng này từ tháng đó.", Ui.Small, Ui.Muted);
            note.MaximumSize = new Size(Ui.S(400), 0);
            Row(tbl, "", note);

            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var ok = Ui.MakeButton("Lưu", true);
            var cancel = Ui.MakeButton("Huỷ", false);
            cancel.DialogResult = DialogResult.Cancel;
            ok.Click += (s, e) =>
            {
                if (Ten.Length == 0 || Ten.Equals("DMA", StringComparison.OrdinalIgnoreCase))
                {
                    Ui.Error(this, "Chưa nhập tên vùng DMA.");
                    return;
                }
                if (cboCha.SelectedItem == null)
                {
                    Ui.Error(this, "Chọn đội / khu vực chứa vùng DMA.");
                    return;
                }
                var trung = thang.Muc.FirstOrDefault(m => m.VaiTro == VaiTro.Dma && (dma == null || m.Id != dma.Id) &&
                                                          NhapExcel.BoDau(m.Ten) == NhapExcel.BoDau(Ten));
                if (trung != null && !Ui.Confirm(this, "Đã có vùng DMA cùng tên \"" + trung.TenMotDong + "\". Vẫn lưu?")) return;
                DialogResult = DialogResult.OK;
            };
            buttons.Controls.Add(cancel);
            buttons.Controls.Add(ok);
            Controls.Add(buttons);
            AcceptButton = ok;
            CancelButton = cancel;
            Shown += (s, e) => { txtTen.Focus(); txtTen.SelectionStart = txtTen.Text.Length; };
        }

        static void Row(TableLayoutPanel tbl, string label, Control c)
        {
            int r = tbl.RowCount++;
            tbl.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Ui.MakeLabel(label, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 8, 6);
            tbl.Controls.Add(l, 0, r);
            c.Margin = Ui.Pad(0, 4, 0, 10);
            tbl.Controls.Add(c, 1, r);
        }
    }
}
