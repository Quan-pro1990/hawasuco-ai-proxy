using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Sửa cấu trúc của 1 tháng: thêm / xoá / sắp xếp dòng, loại dòng (TLK, nhập tay, công thức),
    /// công thức sản lượng và chuẩn thu, vai trò trong bảng tổng hợp. Tháng mới tạo sau chép theo cấu trúc này.
    /// </summary>
    public class CauTrucPage : UserControl, ITrang
    {
        readonly PhienLam phien;
        readonly ComboBox cboThang;
        readonly DataGridView grid;
        readonly Label lblSub;
        ThangBaoCao thang;
        bool dangNap;

        public CauTrucPage(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;

            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Padding = Ui.Pad(0, 0, 0, 4) };
            var title = Ui.MakeLabel("Cấu trúc mạng lưới", Ui.Title, Ui.Text);
            title.Margin = Ui.Pad(0, 0, 16, 0);
            top.Controls.Add(title);
            cboThang = Ui.MakeCombo(160);
            cboThang.Margin = Ui.Pad(0, 7, 10, 0);
            cboThang.SelectedIndexChanged += (s, e) =>
            {
                if (dangNap) return;
                var t = cboThang.SelectedItem as MucThang;
                if (t != null) { thang = t.Thang; phien.ChonThang(t.Thang); Nap(); }
            };
            top.Controls.Add(cboThang);
            var bThem = Ui.MakeButton("+ Thêm dòng", true);
            var bSua = Ui.MakeButton("Sửa…", false);
            var bXoa = Ui.MakeButton("Xoá", false);
            var bLen = Ui.MakeButton("▲ Lên", false);
            var bXuong = Ui.MakeButton("▼ Xuống", false);
            var bApDung = Ui.MakeButton("Chép cấu trúc sang các tháng sau…", false);
            foreach (Button b in new[] { bThem, bSua, bXoa, bLen, bXuong, bApDung })
            {
                b.Margin = Ui.Pad(0, 4, 8, 0);
                top.Controls.Add(b);
            }
            var menuThem = new ContextMenuStrip { Font = Ui.Base };
            menuThem.Items.Add("Thêm phía dưới dòng đang chọn", null, (s, e) => Them(1));
            menuThem.Items.Add("Thêm phía trên dòng đang chọn", null, (s, e) => Them(0));
            bThem.Click += (s, e) => menuThem.Show(bThem, new Point(0, bThem.Height));
            bSua.Click += (s, e) => Sua();
            bXoa.Click += (s, e) => Xoa();
            bLen.Click += (s, e) => DiChuyen(-1);
            bXuong.Click += (s, e) => DiChuyen(1);
            bApDung.Click += (s, e) => ChepSangThangSau();

            lblSub = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblSub.Dock = DockStyle.Top;
            lblSub.Padding = Ui.Pad(2, 0, 0, 8);
            lblSub.MaximumSize = new Size(Ui.S(1400), 0);

            grid = new DataGridView { Dock = DockStyle.Fill };
            Ui.StyleGrid(grid);
            grid.ReadOnly = true;
            grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            grid.MultiSelect = false;
            grid.Columns.Add(Ui.Col("STT", 64, false));
            grid.Columns.Add(Ui.Col("Tên", 380, false));
            grid.Columns.Add(Ui.Col("Loại", 110, false));
            grid.Columns.Add(Ui.Col("Sản lượng = ", 300, false));
            grid.Columns.Add(Ui.Col("Chuẩn thu", 170, false));
            grid.Columns.Add(Ui.Col("Bảng tổng hợp", 150, false));
            grid.Columns.Add(Ui.Col("Khác", 200, false));
            grid.Columns[0].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            grid.CellDoubleClick += (s, e) => { if (e.RowIndex >= 0) Sua(); };
            grid.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter) { Sua(); e.Handled = true; }
                else if (e.KeyCode == Keys.Delete) { Xoa(); e.Handled = true; }
                else if (e.Alt && e.KeyCode == Keys.Up) { DiChuyen(-1); e.Handled = true; }
                else if (e.Alt && e.KeyCode == Keys.Down) { DiChuyen(1); e.Handled = true; }
            };
            var host = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            host.Controls.Add(grid);
            Controls.Add(host);
            Controls.Add(lblSub);
            Controls.Add(top);
            phien.DaDoi += (s, e) => { if (Visible && s != this) KhiHien(); };
        }

        class MucThang
        {
            public ThangBaoCao Thang;
            public override string ToString() { return Thang.Ten; }
        }

        public void KhiHien()
        {
            dangNap = true;
            cboThang.Items.Clear();
            foreach (ThangBaoCao t in phien.Dl.Thang.AsEnumerable().Reverse()) cboThang.Items.Add(new MucThang { Thang = t });
            if (phien.ThangChon != null) thang = phien.ThangChon;
            else if (thang != null && !phien.Dl.Thang.Contains(thang)) thang = null;
            foreach (MucThang m in cboThang.Items) if (m.Thang == thang) cboThang.SelectedItem = m;
            dangNap = false;
            Nap();
        }

        static string TenLoai(Muc m)
        {
            return m.Loai == LoaiMuc.DongHo ? "Đồng hồ (TLK)" : m.Loai == LoaiMuc.NhapTay ? "Nhập trực tiếp" : "Công thức";
        }

        static string TenVaiTro(VaiTro v)
        {
            switch (v)
            {
                case VaiTro.Doi: return "Đội";
                case VaiTro.KhuVuc: return "Khu vực";
                case VaiTro.ToanCongTy: return "Toàn công ty";
                case VaiTro.Dma: return "DMA";
            }
            return "";
        }

        void Nap()
        {
            int cur = grid.CurrentRow != null ? grid.CurrentRow.Index : 0;
            int scroll = grid.FirstDisplayedScrollingRowIndex;
            grid.Rows.Clear();
            if (thang == null)
            {
                lblSub.Text = "Chưa có tháng nào.";
                return;
            }
            ThangBaoCao sau = phien.Dl.TimThang(thang.SoThu + 1);
            lblSub.Text = "Cấu trúc riêng của " + thang.Ten.ToLower() + " (" + thang.Muc.Count + " dòng). Tháng mới tạo sau sẽ chép theo cấu trúc của tháng cuối." +
                          (sau != null ? "  ⚠ Đã có " + sau.Ten.ToLower() + " — sửa ở đây không tự đổi tháng sau (dùng nút \"Chép cấu trúc sang các tháng sau\")." : "") +
                          "  Nhấp đúp hoặc Enter để sửa; Alt+↑/↓ để đổi thứ tự.";
            foreach (Muc m in thang.Muc)
            {
                string ct = m.Loai == LoaiMuc.CongThuc ? CongThucText.HienThi(thang, m, m.CongThuc) + (m.LamTron ? "  (làm tròn)" : "")
                          : m.Loai == LoaiMuc.DongHo ? "chỉ số hiện tại − chỉ số tháng trước" : "nhập số m³";
                string cthu = m.ChuanThuLoai == LoaiChuanThu.Nhap ? "nhập số" : m.ChuanThuLoai == LoaiChuanThu.CongThuc ? CongThucText.HienThi(thang, m, m.CongThucChuanThu) : "";
                var khac = new List<string>();
                if (m.SaiSo != 0) khac.Add("sai số " + So.P2(m.SaiSo) + "%");
                if (m.AnBaoCaoThang) khac.Add("không in báo cáo tháng");
                double? kh = phien.Dl.LayKeHoach(thang.Nam, m.Id);
                if (kh.HasValue) khac.Add("KH " + So.P2(kh) + "%");
                string vt = TenVaiTro(m.VaiTro) + (m.VaiTro != VaiTro.Khac && m.TenNgan.Length > 0 ? ": " + m.TenNgan : "");
                int i = grid.Rows.Add(m.Stt, m.TenMotDong, TenLoai(m), ct, cthu, vt, string.Join(", ", khac));
                DataGridViewRow row = grid.Rows[i];
                row.Cells[1].Style.Padding = new Padding(Ui.S(4 + Math.Min(m.Cap, 4) * 14), 0, Ui.S(3), 0);
                if (m.Cap == 0)
                {
                    row.DefaultCellStyle.Font = Ui.BaseBold;
                    row.DefaultCellStyle.BackColor = Ui.GroupRow;
                }
                KetQua k = phien.Bt.Tinh(thang)[m.Id];
                if (k != null && k.Loi != null) row.Cells[3].Style.ForeColor = Ui.Danger;
            }
            if (grid.Rows.Count > 0)
            {
                cur = Math.Max(0, Math.Min(cur, grid.Rows.Count - 1));
                grid.CurrentCell = grid.Rows[cur].Cells[0];
                if (scroll >= 0 && scroll < grid.Rows.Count) grid.FirstDisplayedScrollingRowIndex = scroll;
            }
        }

        int ViTriChon()
        {
            return grid.CurrentRow != null ? grid.CurrentRow.Index : -1;
        }

        void ChonDong(int i)
        {
            if (i >= 0 && i < grid.Rows.Count) grid.CurrentCell = grid.Rows[i].Cells[0];
        }

        void Them(int lech)
        {
            if (thang == null) return;
            int i = ViTriChon();
            int pos = i < 0 ? thang.Muc.Count : i + lech;
            Muc mau = i >= 0 ? thang.Muc[i] : null;
            var m = new Muc
            {
                Id = phien.Dl.CapId(),
                Cap = mau != null ? Math.Max(1, mau.Cap) : 0,
                Loai = LoaiMuc.DongHo
            };
            thang.Muc.Insert(pos, m);
            using (var f = new MucForm(phien, thang, m, true))
            {
                if (f.ShowDialog(this) != DialogResult.OK)
                {
                    thang.Muc.Remove(m);
                    phien.Bt.XoaBoNho();
                    return;
                }
            }
            phien.Luu(this);
            Nap();
            ChonDong(pos);
        }

        void Sua()
        {
            int i = ViTriChon();
            if (thang == null || i < 0) return;
            using (var f = new MucForm(phien, thang, thang.Muc[i], false))
                if (f.ShowDialog(this) != DialogResult.OK) return;
            phien.Luu(this);
            Nap();
            ChonDong(i);
        }

        void Xoa()
        {
            int i = ViTriChon();
            if (thang == null || i < 0) return;
            Muc m = thang.Muc[i];
            var dung = thang.Muc.Where(x => x != m && (x.CongThuc.Any(s => s.Id == m.Id) || x.CongThucChuanThu.Any(s => s.Id == m.Id))).ToList();
            if (dung.Count > 0)
            {
                Ui.Error(this, "Không xoá được \"" + m + "\" vì đang dùng trong công thức của:\n\n" + string.Join("\n", dung.Select(x => "• " + x)) +
                               "\n\nSửa các công thức đó trước.");
                return;
            }
            if (!Ui.Confirm(this, "Xoá dòng \"" + m + "\" khỏi " + thang.Ten.ToLower() + "?\nSố liệu đã nhập của dòng này trong tháng cũng bị xoá.")) return;
            thang.Muc.RemoveAt(i);
            phien.Luu(this);
            Nap();
            ChonDong(Math.Min(i, thang.Muc.Count - 1));
        }

        void DiChuyen(int d)
        {
            int i = ViTriChon();
            if (thang == null || i < 0 || i + d < 0 || i + d >= thang.Muc.Count) return;
            Muc m = thang.Muc[i];
            thang.Muc.RemoveAt(i);
            thang.Muc.Insert(i + d, m);
            phien.Luu(this);
            Nap();
            ChonDong(i + d);
        }

        /// <summary>Đưa cấu trúc tháng này sang các tháng sau đã tạo, giữ nguyên số liệu đã nhập theo từng dòng.</summary>
        void ChepSangThangSau()
        {
            if (thang == null) return;
            var sau = phien.Dl.Thang.Where(t => t.SoThu > thang.SoThu).ToList();
            if (sau.Count == 0)
            {
                Ui.Info(this, "Không có tháng nào sau " + thang.Ten.ToLower() + ".\nTháng mới tạo sau sẽ tự chép cấu trúc của tháng cuối.");
                return;
            }
            if (!Ui.Confirm(this, "Chép cấu trúc của " + thang.Ten.ToLower() + " sang " + string.Join(", ", sau.Select(t => t.Ten.ToLower())) + "?\n\n" +
                                  "Dòng nào đã có ở tháng sau thì giữ số liệu đã nhập; dòng mới thêm sẽ trống (chỉ số tháng trước lấy từ tháng liền trước); " +
                                  "dòng đã xoá ở đây cũng bị bỏ ở các tháng sau."))
                return;
            ThangBaoCao truoc = thang;
            foreach (ThangBaoCao t in sau)
            {
                var moi = new List<Muc>();
                foreach (Muc m in thang.Muc)
                {
                    Muc cu = t.Tim(m.Id);
                    Muc n = m.ChepCauTruc();
                    if (cu != null)
                    {
                        n.ChiSoCu = cu.ChiSoCu; n.ChiSoMoi = cu.ChiSoMoi; n.ChotCu = cu.ChotCu; n.DauMoi = cu.DauMoi;
                        n.DieuChinh = cu.DieuChinh; n.ChuanThu = cu.ChuanThu; n.GhiChu = cu.GhiChu;
                        n.CungKyThang = cu.CungKyThang; n.CungKyLuyKe = cu.CungKyLuyKe; n.TyLeThangTruoc = cu.TyLeThangTruoc;
                        n.LuyKePhatRaTruoc = cu.LuyKePhatRaTruoc; n.LuyKeChuanThuTruoc = cu.LuyKeChuanThuTruoc;
                        n.SanLuong = cu.Loai == m.Loai ? cu.SanLuong : null;
                    }
                    else if (m.Loai == LoaiMuc.DongHo)
                    {
                        Muc p = truoc.Tim(m.Id);
                        if (p != null) n.ChiSoCu = p.ChiSoMoi;
                    }
                    moi.Add(n);
                }
                t.Muc = moi;
                truoc = t;
            }
            phien.Luu(this);
            Ui.Info(this, "Đã chép cấu trúc sang " + sau.Count + " tháng.");
        }
    }
}
