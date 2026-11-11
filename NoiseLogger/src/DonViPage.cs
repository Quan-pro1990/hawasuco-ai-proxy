using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>
    /// Danh mục đội / khu vực / vùng DMA (cây) để xếp điểm đặt logger, lọc và tổng hợp theo đơn vị.
    /// Lấy nhanh từ file dữ liệu của phần mềm Quản lý thất thoát nước, hoặc tự thêm.
    /// </summary>
    public class DonViPage : UserControl, ITrang
    {
        readonly PhienNl phien;
        readonly TreeView tree;
        readonly Button bThemCon, bSua, bXoa, bLen, bXuong;
        readonly Label lblTomTat;

        DuLieuNl Dl { get { return phien.Dl; } }

        public DonViPage(PhienNl phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;
            Label sub;
            var header = Ui.PageHeader("Đội / vùng DMA",
                "Đội → khu vực → vùng DMA chứa các điểm đặt logger. Dùng để lọc, tổng hợp và in kết quả theo đội / vùng DMA. " +
                "Lấy nhanh từ phần mềm Quản lý thất thoát nước (danh sách đội, khu vực, DMA theo cấu trúc tháng mới nhất), hoặc tự thêm.", out sub);
            sub.MaximumSize = new Size(Ui.S(1000), 0);

            tree = new TreeView { Dock = DockStyle.Fill, Font = Ui.Base, HideSelection = false, ItemHeight = Ui.S(28), FullRowSelect = true, BorderStyle = BorderStyle.None };
            tree.AfterSelect += (s, e) => CapNhatNut();
            tree.NodeMouseDoubleClick += (s, e) => Sua();
            tree.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Delete) { Xoa(); e.Handled = true; }
                else if (e.KeyCode == Keys.Insert) { Them(true); e.Handled = true; }
            };
            var treeHost = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            var treeIn = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Surface, Padding = Ui.Pad(8, 6, 8, 6) };
            treeIn.Controls.Add(tree);
            treeHost.Controls.Add(treeIn);

            var side = new FlowLayoutPanel { Dock = DockStyle.Right, Width = Ui.S(320), FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = Ui.Pad(14, 0, 0, 0) };
            NutBen(side, "+ Đội", true, (s, e) => Them(false), "Thêm đội (cấp ngoài cùng)");
            bThemCon = NutBen(side, "+ Khu vực / DMA của đơn vị chọn", false, (s, e) => Them(true), "Thêm khu vực / vùng DMA nằm trong đơn vị đang chọn (phím Insert)");
            bSua = NutBen(side, "Sửa…", false, (s, e) => Sua(), "Đổi tên, loại, chuyển sang đơn vị khác — nhấp đúp cũng được");
            bXoa = NutBen(side, "Xoá", false, (s, e) => Xoa(), "Xoá đơn vị không còn đơn vị con (phím Delete)");
            bLen = NutBen(side, "▲ Lên", false, (s, e) => DiChuyen(-1), "Đưa lên trên (trong cùng đơn vị cha)");
            bXuong = NutBen(side, "▼ Xuống", false, (s, e) => DiChuyen(1), "Đưa xuống dưới");
            var bLay = NutBen(side, "Lấy từ phần mềm Thất thoát nước…", false, (s, e) => { LayTuThatThoat(this, phien); KhiHien(); },
                              "Lấy đội / khu vực / DMA từ file thatthoat.xml của phần mềm Quản lý thất thoát nước");
            bSua.Margin = Ui.Pad(0, 14, 0, 6);
            bLen.Margin = Ui.Pad(0, 14, 0, 6);
            bLay.Margin = Ui.Pad(0, 24, 0, 6);
            var ghiChu = Ui.MakeLabel("Lấy lại lần nữa (sau khi thêm DMA ở phần mềm thất thoát) chỉ cập nhật tên / thêm đơn vị mới, không xoá đơn vị đang có.", Ui.Small, Ui.Muted);
            ghiChu.MaximumSize = new Size(Ui.S(300), 0);
            side.Controls.Add(ghiChu);

            lblTomTat = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblTomTat.Dock = DockStyle.Bottom;
            lblTomTat.Padding = Ui.Pad(2, 8, 0, 0);

            Controls.Add(treeHost);
            Controls.Add(side);
            Controls.Add(lblTomTat);
            Controls.Add(header);
            phien.DaDoi += (s, e) => { if (Visible && s != this) KhiHien(); };
        }

        Button NutBen(FlowLayoutPanel side, string text, bool chinh, EventHandler click, string goiY)
        {
            var b = Ui.MakeButton(text, chinh);
            b.AutoSize = false;
            b.Size = new Size(Ui.S(300), Ui.S(34));
            b.TextAlign = ContentAlignment.MiddleLeft;
            b.Margin = Ui.Pad(0, 0, 0, 6);
            b.Click += click;
            new ToolTip().SetToolTip(b, goiY);
            side.Controls.Add(b);
            return b;
        }

        public void KhiHien()
        {
            Nap(Chon());
        }

        DonVi Chon()
        {
            return tree.SelectedNode != null ? tree.SelectedNode.Tag as DonVi : null;
        }

        void Nap(DonVi chon)
        {
            tree.BeginUpdate();
            tree.Nodes.Clear();
            TreeNode sel = null;
            var soDiem = Dl.Diem.Where(p => !p.Ngung).GroupBy(p => p.DonViId).ToDictionary(g => g.Key, g => g.Count());
            var nodes = new System.Collections.Generic.Dictionary<int, TreeNode>();
            foreach (DonViNl dv in DonViNlOps.DanhSach(Dl))
            {
                int n;
                soDiem.TryGetValue(dv.Id, out n);
                var node = new TreeNode(dv.Ten + "   (" + DonViNlOps.TenLoai(dv.Loai) + (n > 0 ? ", " + n + " điểm" : "") + ")") { Tag = dv.Goc };
                if (dv.Cap == 0) { node.NodeFont = Ui.BaseBold; node.ForeColor = Ui.Primary; }
                if (dv.Cha != null && nodes.ContainsKey(dv.Cha.Id)) nodes[dv.Cha.Id].Nodes.Add(node);
                else tree.Nodes.Add(node);
                nodes[dv.Id] = node;
                if (dv.Goc == chon) sel = node;
            }
            tree.ExpandAll();
            tree.EndUpdate();
            if (sel != null) tree.SelectedNode = sel;
            else if (tree.Nodes.Count > 0) tree.SelectedNode = tree.Nodes[0];
            int chuaXep = Dl.Diem.Count(p => !p.Ngung && (p.DonViId < 0 || Dl.TimDonVi(p.DonViId) == null));
            lblTomTat.Text = Dl.DonVi.Count == 0
                ? "Chưa có đơn vị nào — bấm \"Lấy từ phần mềm Thất thoát nước…\" hoặc \"+ Đội\"."
                : Dl.DonVi.Count + " đơn vị (" + Dl.DonVi.Count(x => x.Loai == LoaiDonVi.Doi) + " đội, " + Dl.DonVi.Count(x => x.Loai == LoaiDonVi.KhuVuc) + " khu vực, " +
                  Dl.DonVi.Count(x => x.Loai == LoaiDonVi.Dma) + " vùng DMA)" + (chuaXep > 0 ? ". " + chuaXep + " điểm chưa xếp đơn vị (sửa ở mục Điểm đo)." : ".");
            CapNhatNut();
        }

        void CapNhatNut()
        {
            bool co = Chon() != null;
            bThemCon.Enabled = bSua.Enabled = bXoa.Enabled = bLen.Enabled = bXuong.Enabled = co;
        }

        void Them(bool con)
        {
            DonVi cha = con ? Chon() : null;
            if (con && cha == null) return;
            var moi = new DonVi { Loai = cha == null ? LoaiDonVi.Doi : LoaiDonVi.Dma, ChaId = cha != null ? cha.Id : -1 };
            using (var f = new DonViForm(Dl, moi, true))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                moi.Id = Dl.CapId();
                f.GhiVao(moi);
                Dl.DonVi.Add(moi);
            }
            phien.Luu(this);
            Nap(moi);
        }

        void Sua()
        {
            DonVi g = Chon();
            if (g == null) return;
            using (var f = new DonViForm(Dl, g, false))
            {
                if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                f.GhiVao(g);
            }
            phien.Luu(this);
            Nap(g);
        }

        void Xoa()
        {
            DonVi g = Chon();
            if (g == null) return;
            if (Dl.DonVi.Any(x => x.ChaId == g.Id))
            {
                Ui.Info(FindForm(), "\"" + g.Ten + "\" còn đơn vị con — xoá hoặc chuyển các đơn vị con sang đơn vị khác trước.");
                return;
            }
            var diems = Dl.Diem.Where(p => p.DonViId == g.Id).ToList();
            DonVi cha = g.ChaId >= 0 ? Dl.TimDonVi(g.ChaId) : null;
            string msg = "Xoá \"" + g.Ten + "\"?" + (diems.Count > 0
                ? "\n\n" + diems.Count + " điểm đặt logger của đơn vị này sẽ chuyển sang " + (cha != null ? "\"" + cha.Ten + "\"" : "\"Chưa xếp đội / DMA\"") + "."
                : "");
            if (!Ui.Confirm(FindForm(), msg)) return;
            foreach (DiemNl p in diems) p.DonViId = cha != null ? cha.Id : -1;
            Dl.DonVi.Remove(g);
            phien.Luu(this);
            Nap(cha);
        }

        void DiChuyen(int huong)
        {
            DonVi g = Chon();
            if (g == null || !DonViNlOps.DiChuyen(Dl, g, huong)) return;
            phien.Luu(this);
            Nap(g);
        }

        /// <summary>Chọn file thatthoat.xml, lấy đội / khu vực / DMA (và số liệu Noise Logger cũ nếu có).</summary>
        public static void LayTuThatThoat(Control owner, PhienNl phien)
        {
            using (var dlg = new OpenFileDialog())
            {
                dlg.Title = "Chọn file dữ liệu của phần mềm Quản lý thất thoát nước (DuLieu\\thatthoat.xml)";
                dlg.Filter = "Dữ liệu thất thoát nước (thatthoat*.xml)|thatthoat*.xml|XML (*.xml)|*.xml";
                string dir = NhapThatThoat.DoanThuMuc();
                if (dir != null) dlg.InitialDirectory = dir;
                if (dlg.ShowDialog(owner) != DialogResult.OK) return;
                NhapThatThoat.KetQua kq;
                try
                {
                    try { phien.Kho.SaoLuuNgay(); } catch (Exception) { }
                    kq = NhapThatThoat.Nhap(dlg.FileName, phien.Dl);
                }
                catch (Exception ex)
                {
                    Ui.Error(owner, "Không đọc được file:\n" + dlg.FileName + "\n\n" + ex.Message);
                    return;
                }
                phien.Luu(owner);
                string msg = "Đã lấy từ " + Path.GetFileName(dlg.FileName) + (kq.ThangCauTruc.Length > 0 ? " (cấu trúc " + kq.ThangCauTruc + ")" : "") + ":\n" +
                             "• " + kq.DonViMoi + " đơn vị mới, " + kq.DonViCapNhat + " đơn vị cập nhật." +
                             (kq.DaLayCaiDat ? "\n• Tên công ty, địa danh, người ký (kiểm tra lại ở Cài đặt)." : "") +
                             (kq.ThongBao.Count > 0 ? "\n• " + string.Join("\n• ", kq.ThongBao) : "");
                Ui.Info(owner, msg);
            }
        }
    }

    /// <summary>Thêm / sửa đội, khu vực, vùng DMA.</summary>
    class DonViForm : HopThoai
    {
        class MucCha
        {
            public DonViNl Dv;
            public override string ToString() { return Dv == null ? "(cấp ngoài cùng)" : Dv.ToString(); }
        }

        readonly DuLieuNl d;
        readonly DonVi g;
        readonly TextBox txtTen, txtGhiChu;
        readonly ComboBox cboLoai, cboCha;

        public DonViForm(DuLieuNl d, DonVi g, bool moi) : base(moi ? "Thêm đội / khu vực / vùng DMA" : "Sửa đơn vị", 640, 240)
        {
            this.d = d;
            this.g = g;
            txtTen = O(380, g.Ten, "vd DMA Phường IV - Vị Tân");
            Dong("Tên", txtTen);
            cboLoai = Ui.MakeCombo(180);
            foreach (LoaiDonVi l in Enum.GetValues(typeof(LoaiDonVi))) cboLoai.Items.Add(DonViNlOps.TenLoai(l));
            cboLoai.SelectedIndex = (int)g.Loai;
            Dong("Loại", cboLoai);
            cboCha = Ui.MakeCombo(380);
            cboCha.Items.Add(new MucCha());
            var bo = moi ? new System.Collections.Generic.HashSet<int>() : DonViNlOps.ConChau(d, g.Id);   // không cho chọn chính nó / con cháu làm cha
            foreach (DonViNl dv in DonViNlOps.DanhSach(d))
                if (!bo.Contains(dv.Id)) cboCha.Items.Add(new MucCha { Dv = dv });
            cboCha.SelectedItem = cboCha.Items.Cast<MucCha>().FirstOrDefault(x => x.Dv != null && x.Dv.Id == g.ChaId) ?? cboCha.Items[0];
            Dong("Thuộc", cboCha);
            txtGhiChu = O(380, g.GhiChu, null);
            Dong("Ghi chú", txtGhiChu);
            Shown += (s, e) => txtTen.Focus();
        }

        protected override bool KiemTra()
        {
            string ten = VanBan.ChuanHoa(txtTen.Text);
            if (ten.Length == 0) { Ui.Error(this, "Nhập tên đơn vị."); txtTen.Focus(); return false; }
            var cha = cboCha.SelectedItem as MucCha;
            int chaId = cha != null && cha.Dv != null ? cha.Dv.Id : -1;
            if (d.DonVi.Any(x => x != g && x.ChaId == chaId && VanBan.BoDau(x.Ten) == VanBan.BoDau(ten)))
            {
                Ui.Error(this, "Đã có đơn vị \"" + ten + "\" ở cùng chỗ.");
                txtTen.Focus();
                return false;
            }
            return true;
        }

        public void GhiVao(DonVi x)
        {
            x.Ten = VanBan.ChuanHoa(txtTen.Text);
            x.Loai = (LoaiDonVi)cboLoai.SelectedIndex;
            var cha = cboCha.SelectedItem as MucCha;
            x.ChaId = cha != null && cha.Dv != null ? cha.Dv.Id : -1;
            x.GhiChu = VanBan.ChuanHoa(txtGhiChu.Text);
        }
    }
}
