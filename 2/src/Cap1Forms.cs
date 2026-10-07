using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Khung hộp thoại dùng chung: bảng 2 cột nhãn / ô nhập + hàng nút Lưu, Huỷ.</summary>
    class HopThoaiCap1 : Form
    {
        protected readonly TableLayoutPanel Bang;
        protected readonly FlowLayoutPanel Nut;
        protected readonly Button BtnLuu, BtnHuy;

        public HopThoaiCap1(string title, int w, int h)
        {
            Text = title;
            Font = Ui.Base;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(w), Ui.S(h));
            BackColor = Ui.Surface;
            Bang = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = Ui.Pad(18, 14, 18, 6), ColumnCount = 2, AutoScroll = true };
            Bang.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(170)));
            Bang.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(Bang);
            Nut = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            BtnLuu = Ui.MakeButton("Lưu", true);
            BtnHuy = Ui.MakeButton("Huỷ", false);
            BtnHuy.DialogResult = DialogResult.Cancel;
            BtnLuu.Click += (s, e) => { if (KiemTra()) DialogResult = DialogResult.OK; };
            Nut.Controls.Add(BtnHuy);
            Nut.Controls.Add(BtnLuu);
            Controls.Add(Nut);
            AcceptButton = BtnLuu;
            CancelButton = BtnHuy;
        }

        protected virtual bool KiemTra() { return true; }

        protected Label Dong(string label, Control c)
        {
            int r = Bang.RowCount++;
            Bang.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Ui.MakeLabel(label, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 8, 6);
            Bang.Controls.Add(l, 0, r);
            c.Margin = Ui.Pad(0, 4, 0, 8);
            Bang.Controls.Add(c, 1, r);
            return l;
        }

        protected Label GhiChu(string text)
        {
            var l = Ui.MakeLabel(text, Ui.Small, Ui.Muted);
            l.UseMnemonic = false;
            l.MaximumSize = new Size(ClientSize.Width - Ui.S(230), 0);
            Dong("", l);
            l.Margin = Ui.Pad(0, 0, 0, 8);
            return l;
        }

        protected static Control Hang(params Control[] items)
        {
            var p = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            foreach (Control c in items)
            {
                c.Margin = Ui.Pad(0, 3, 8, 0);
                p.Controls.Add(c);
            }
            return p;
        }

        protected static TextBox O(int width, string text, string cue)
        {
            var t = Ui.MakeText(width);
            t.Text = text ?? "";
            if (cue != null) Ui.SetCue(t, cue);
            return t;
        }

        /// <summary>Đọc số; sai thì báo và đưa con trỏ về ô.</summary>
        protected bool DocSo(TextBox box, string ten, out double? v)
        {
            if (So.TryDoc(box.Text, out v)) return true;
            Ui.Error(this, ten + ": \"" + box.Text + "\" không phải số hợp lệ.");
            box.Focus();
            box.SelectAll();
            return false;
        }
    }

    /// <summary>Thêm / sửa 1 đồng hồ cấp 1: tên, trạm (thuộc đội), giếng hay nước mặt, hệ số.</summary>
    class DongHoCap1Form : HopThoaiCap1
    {
        class MucTram
        {
            public TramCap1 Tram;
            public string DoiTen;
            public override string ToString() { return Tram.Ten + "   (" + DoiTen + ")"; }
        }

        readonly DuLieuCap1 d;
        readonly DongHoCap1 dh;
        readonly KyCap1 ky;
        readonly TextBox txtTen, txtHeSo, txtGhiChu, txtDau;
        readonly ComboBox cboTram;
        readonly RadioButton rGieng, rMat;
        readonly CheckBox chkDung;
        double heSo = 1;

        public bool DaDoiDanhMuc { get; private set; }
        public double? ChiSoDau { get; private set; }

        public DongHoCap1Form(DuLieuCap1 d, DongHoCap1 dh, TramCap1 tramMacDinh, int doiMacDinh, KyCap1 ky)
            : base(dh == null ? "Thêm đồng hồ cấp 1" : "Sửa đồng hồ cấp 1", 680, dh == null ? 420 : (dh.Ngung ? 430 : 400))
        {
            this.d = d;
            this.dh = dh;
            this.ky = ky;
            txtTen = O(440, dh != null ? dh.Ten : "", "vd TLK cấp I giếng số 2 trạm Đông Phú");
            Dong("Tên đồng hồ", txtTen);

            cboTram = Ui.MakeCombo(330);
            var bTram = Ui.MakeButton("+ Trạm mới…", false);
            bTram.Click += (s, e) => TramMoi();
            Dong("Ở trạm / nhà máy", Hang(cboTram, bTram));
            TramCap1 chon = dh != null ? d.TimTram(dh.TramId) : tramMacDinh;
            if (chon == null && doiMacDinh >= 0) chon = d.TramCuaDoi(doiMacDinh).FirstOrDefault();
            NapTram(chon);
            GhiChu("Trạm trực thuộc đội nào: chọn ở danh sách (tên đội trong ngoặc). Đổi đội của trạm: nút \"Đội & trạm…\".");

            rGieng = new RadioButton { Text = "Giếng (nước ngầm)", AutoSize = true };
            rMat = new RadioButton { Text = "Nước mặt (sông, kênh)", AutoSize = true };
            NguonNuoc n = dh != null ? dh.Nguon : DoanNguon();
            rGieng.Checked = n == NguonNuoc.Gieng;
            rMat.Checked = n == NguonNuoc.NuocMat;
            Dong("Nguồn nước", Hang(rGieng, rMat));

            txtHeSo = O(80, So.Nhap(dh != null ? dh.HeSo : 1), "1");
            Dong("Hệ số nhân", Hang(txtHeSo, Ui.MakeLabel("sản lượng = (chỉ số mới − cũ) × hệ số; đồng hồ ghi m³ thì để 1", Ui.Small, Ui.Muted)));
            txtGhiChu = O(440, dh != null ? dh.GhiChu : "", "cỡ đồng hồ, vị trí, số seri…");
            Dong("Ghi chú", txtGhiChu);

            if (dh == null && ky != null)
            {
                txtDau = O(140, "", "để trống nếu chưa có");
                Dong("Chỉ số tháng trước", Hang(txtDau, Ui.MakeLabel("chỉ số đầu kỳ " + ky.Ten.ToLower() + " (chốt cuối tháng trước)", Ui.Small, Ui.Muted)));
            }
            if (dh != null && dh.Ngung)
            {
                chkDung = new CheckBox { Text = "Dùng lại đồng hồ này (đang ngừng)" + (ky != null ? " — đưa vào " + ky.Ten.ToLower() + " và các tháng sau" : ""), AutoSize = true };
                Dong("", chkDung);
            }
            if (dh != null) GhiChu("Đổi nguồn nước / hệ số áp dụng cho mọi tháng của đồng hồ này.");
            Shown += (s, e) => { txtTen.Focus(); txtTen.SelectionStart = txtTen.Text.Length; };
        }

        NguonNuoc DoanNguon()
        {
            var t = cboTram.SelectedItem as MucTram;
            if (t == null) return NguonNuoc.Gieng;
            var cua = d.DongHoCuaTram(t.Tram.Id).ToList();
            if (cua.Count > 0 && cua.All(x => x.Nguon == NguonNuoc.NuocMat)) return NguonNuoc.NuocMat;
            return NhapExcel.BoDau(t.Tram.Ten).Contains("nha may") && cua.Count == 0 ? NguonNuoc.NuocMat : NguonNuoc.Gieng;
        }

        void NapTram(TramCap1 chon)
        {
            cboTram.Items.Clear();
            foreach (DoiCap1 doi in d.Doi)
                foreach (TramCap1 t in d.TramCuaDoi(doi.Id)) cboTram.Items.Add(new MucTram { Tram = t, DoiTen = doi.Ten });
            foreach (TramCap1 t in d.Tram.Where(x => d.TimDoi(x.DoiId) == null)) cboTram.Items.Add(new MucTram { Tram = t, DoiTen = "chưa xếp đội" });
            foreach (MucTram m in cboTram.Items) if (m.Tram == chon) cboTram.SelectedItem = m;
            if (cboTram.SelectedIndex < 0 && cboTram.Items.Count == 1) cboTram.SelectedIndex = 0;
            cboTram.DropDownWidth = Math.Max(cboTram.Width, Ui.S(420));
        }

        void TramMoi()
        {
            var cur = cboTram.SelectedItem as MucTram;
            using (var f = new TramCap1Form(d, null, cur != null ? cur.Tram.DoiId : -1))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
                var t = new TramCap1 { Id = d.CapId() };
                f.GhiVao(t);
                d.Tram.Add(t);
                DaDoiDanhMuc = true;
                NapTram(t);
                if (dh == null)
                {
                    NguonNuoc n = DoanNguon();
                    rGieng.Checked = n == NguonNuoc.Gieng;
                    rMat.Checked = n == NguonNuoc.NuocMat;
                }
            }
        }

        protected override bool KiemTra()
        {
            string ten = txtTen.Text.Trim();
            if (ten.Length == 0)
            {
                Ui.Error(this, "Chưa nhập tên đồng hồ.");
                txtTen.Focus();
                return false;
            }
            var t = cboTram.SelectedItem as MucTram;
            if (t == null)
            {
                Ui.Error(this, d.Tram.Count == 0 ? "Chưa có trạm nào — bấm \"+ Trạm mới…\" để thêm trạm (và chọn đội của trạm)." : "Chọn trạm / nhà máy đặt đồng hồ.");
                return false;
            }
            double? hs;
            if (!DocSo(txtHeSo, "Hệ số nhân", out hs)) return false;
            if (hs.HasValue && hs <= 0)
            {
                Ui.Error(this, "Hệ số nhân phải lớn hơn 0.");
                return false;
            }
            heSo = hs ?? 1;
            if (txtDau != null)
            {
                double? v;
                if (!DocSo(txtDau, "Chỉ số tháng trước", out v)) return false;
                ChiSoDau = v;
            }
            var trung = d.DongHoCuaTram(t.Tram.Id).FirstOrDefault(x => x != dh && NhapExcel.BoDau(x.Ten) == NhapExcel.BoDau(ten));
            if (trung != null && !Ui.Confirm(this, "Trạm " + t.Tram.Ten + " đã có đồng hồ \"" + trung.Ten + "\"" + (trung.Ngung ? " (đang ngừng dùng)" : "") + ". Vẫn lưu?")) return false;
            return true;
        }

        public void GhiVao(DongHoCap1 x)
        {
            x.Ten = txtTen.Text.Trim();
            x.TramId = ((MucTram)cboTram.SelectedItem).Tram.Id;
            x.Nguon = rMat.Checked ? NguonNuoc.NuocMat : NguonNuoc.Gieng;
            x.HeSo = heSo;
            x.GhiChu = txtGhiChu.Text.Trim();
            if (chkDung != null && chkDung.Checked)
            {
                x.Ngung = false;
                if (ky != null) Cap1Ops.DuaVaoTuKy(d, ky, x.Id);
            }
        }
    }

    /// <summary>Thêm / sửa trạm cấp nước: tên, thuộc đội nào (gõ tên đội mới cũng được).</summary>
    class TramCap1Form : HopThoaiCap1
    {
        readonly DuLieuCap1 d;
        readonly TramCap1 tram;
        readonly TextBox txtTen;
        readonly ComboBox cboDoi;

        public TramCap1Form(DuLieuCap1 d, TramCap1 tram, int doiMacDinh)
            : base(tram == null ? "Thêm trạm cấp nước" : "Sửa trạm cấp nước", 620, 250)
        {
            this.d = d;
            this.tram = tram;
            txtTen = O(400, tram != null ? tram.Ten : "", "vd TRẠM CẤP NƯỚC ĐÔNG PHÚ / NHÀ MÁY NƯỚC NGÃ SÁU");
            Dong("Tên trạm / nhà máy", txtTen);
            cboDoi = new ComboBox { Font = Ui.Base, Width = Ui.S(300), DropDownStyle = ComboBoxStyle.DropDown, MaxDropDownItems = 20 };
            foreach (DoiCap1 x in d.Doi) cboDoi.Items.Add(x.Ten);
            DoiCap1 chon = d.TimDoi(tram != null ? tram.DoiId : doiMacDinh);
            if (chon != null) cboDoi.Text = chon.Ten;
            else if (d.Doi.Count > 0 && tram == null) cboDoi.SelectedIndex = 0;
            Dong("Trực thuộc đội", cboDoi);
            GhiChu("Chọn đội trong danh sách hoặc gõ tên đội mới (vd Đội Cấp nước số 7) — phần mềm tự thêm đội.");
            Shown += (s, e) => { txtTen.Focus(); txtTen.SelectionStart = txtTen.Text.Length; };
        }

        protected override bool KiemTra()
        {
            if (txtTen.Text.Trim().Length == 0)
            {
                Ui.Error(this, "Chưa nhập tên trạm.");
                txtTen.Focus();
                return false;
            }
            string doi = NhapExcel.ChuanHoa(cboDoi.Text);
            if (doi.Length == 0)
            {
                Ui.Error(this, "Chọn hoặc gõ tên đội của trạm.");
                cboDoi.Focus();
                return false;
            }
            DoiCap1 x = d.Doi.FirstOrDefault(v => NhapExcel.BoDau(v.Ten) == NhapExcel.BoDau(doi));
            if (x == null && !Ui.Confirm(this, "Chưa có đội \"" + doi + "\". Thêm đội mới này?")) return false;
            var trung = d.Tram.FirstOrDefault(t => t != tram && (x == null || t.DoiId == x.Id) && x != null && NhapExcel.BoDau(t.Ten) == NhapExcel.BoDau(txtTen.Text.Trim()));
            if (trung != null && !Ui.Confirm(this, x.Ten + " đã có trạm \"" + trung.Ten + "\". Vẫn lưu?")) return false;
            return true;
        }

        public void GhiVao(TramCap1 t)
        {
            t.Ten = NhapExcel.ChuanHoa(txtTen.Text);
            string doi = NhapExcel.ChuanHoa(cboDoi.Text);
            DoiCap1 x = d.Doi.FirstOrDefault(v => NhapExcel.BoDau(v.Ten) == NhapExcel.BoDau(doi));
            if (x == null)
            {
                x = new DoiCap1 { Id = d.CapId(), Ten = doi };
                d.Doi.Add(x);
            }
            t.DoiId = x.Id;
        }
    }

    /// <summary>Nhập 1 tên (đội).</summary>
    class TenCap1Form : HopThoaiCap1
    {
        readonly TextBox txt;
        public string Ten { get { return NhapExcel.ChuanHoa(txt.Text); } }

        public TenCap1Form(string title, string label, string value) : base(title, 560, 170)
        {
            txt = O(340, value, null);
            Dong(label, txt);
            Shown += (s, e) => { txt.Focus(); txt.SelectAll(); };
        }

        protected override bool KiemTra()
        {
            if (Ten.Length > 0) return true;
            Ui.Error(this, "Chưa nhập tên.");
            return false;
        }
    }

    /// <summary>Danh mục cây Đội → Trạm → Đồng hồ: thêm, sửa, chuyển trạm sang đội khác, xoá, sắp thứ tự.</summary>
    class DanhMucCap1Form : Form
    {
        readonly DuLieuCap1 d;
        readonly KyCap1 ky;
        readonly TreeView tree;
        readonly Button bSua, bXoa, bLen, bXuong, bThemTram, bThemDh;
        public bool DaDoi { get; private set; }

        public DanhMucCap1Form(DuLieuCap1 d, KyCap1 ky)
        {
            this.d = d;
            this.ky = ky;
            Text = "Đội, trạm cấp nước và đồng hồ cấp 1";
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(820), Ui.S(600));
            MinimizeBox = false;
            ShowInTaskbar = false;
            BackColor = Ui.Surface;

            var hint = new Label
            {
                Dock = DockStyle.Top,
                Height = Ui.S(46),
                Font = Ui.Small,
                ForeColor = Ui.Muted,
                Padding = Ui.Pad(16, 10, 16, 0),
                Text = "Quản lý theo cấp: đội → trạm cấp nước / nhà máy → đồng hồ cấp 1 (giếng hoặc nước mặt). Chuyển trạm sang đội khác: chọn trạm → Sửa…. " +
                       "Chỉ xoá được đội không còn trạm, trạm không còn đồng hồ."
            };
            tree = new TreeView { Dock = DockStyle.Fill, Font = Ui.Base, HideSelection = false, ShowNodeToolTips = true, ItemHeight = Ui.S(26), FullRowSelect = true, BorderStyle = BorderStyle.FixedSingle };
            tree.AfterSelect += (s, e) => CapNhatNut();
            tree.NodeMouseDoubleClick += (s, e) => Sua();
            var treeHost = new Panel { Dock = DockStyle.Fill, Padding = Ui.Pad(16, 4, 8, 12) };
            treeHost.Controls.Add(tree);

            var side = new FlowLayoutPanel { Dock = DockStyle.Right, Width = Ui.S(170), FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = Ui.Pad(4, 4, 12, 0) };
            var bThemDoi = NutBen(side, "+ Đội", (s, e) => ThemDoi());
            bThemTram = NutBen(side, "+ Trạm", (s, e) => ThemTram());
            bThemDh = NutBen(side, "+ Đồng hồ", (s, e) => ThemDongHo());
            bSua = NutBen(side, "Sửa…", (s, e) => Sua());
            bXoa = NutBen(side, "Xoá", (s, e) => Xoa());
            bLen = NutBen(side, "▲ Lên", (s, e) => DiChuyen(-1));
            bXuong = NutBen(side, "▼ Xuống", (s, e) => DiChuyen(1));
            bThemDoi.Margin = Ui.Pad(0, 0, 0, 6);
            bSua.Margin = Ui.Pad(0, 14, 0, 6);
            bLen.Margin = Ui.Pad(0, 14, 0, 6);
            if (ky == null) bThemDh.Enabled = false;

            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var dong = Ui.MakeButton("Đóng", true);
            dong.DialogResult = DialogResult.Cancel;
            buttons.Controls.Add(dong);
            Controls.Add(treeHost);
            Controls.Add(side);
            Controls.Add(hint);
            Controls.Add(buttons);
            CancelButton = dong;
            Nap(null);
        }

        static Button NutBen(FlowLayoutPanel side, string text, EventHandler click)
        {
            var b = Ui.MakeButton(text, false);
            b.AutoSize = false;
            b.Size = new Size(Ui.S(150), Ui.S(34));
            b.TextAlign = ContentAlignment.MiddleLeft;
            b.Margin = Ui.Pad(0, 0, 0, 6);
            b.Click += click;
            side.Controls.Add(b);
            return b;
        }

        void Nap(object chon)
        {
            tree.BeginUpdate();
            tree.Nodes.Clear();
            TreeNode sel = null;
            foreach (DoiCap1 doi in d.Doi)
            {
                var trams = d.TramCuaDoi(doi.Id).ToList();
                var nd = new TreeNode(doi.Ten.ToUpper(So.VN) + "   (" + trams.Count + " trạm)") { Tag = doi, ForeColor = Ui.Primary };
                foreach (TramCap1 t in trams) nd.Nodes.Add(NutTram(t, chon, ref sel));
                tree.Nodes.Add(nd);
                if (doi == chon) sel = nd;
            }
            var mo = d.Tram.Where(t => d.TimDoi(t.DoiId) == null).ToList();
            if (mo.Count > 0)
            {
                var nd = new TreeNode("(Trạm chưa xếp đội)") { ForeColor = Ui.Warning };
                foreach (TramCap1 t in mo) nd.Nodes.Add(NutTram(t, chon, ref sel));
                tree.Nodes.Add(nd);
            }
            tree.ExpandAll();
            tree.EndUpdate();
            if (sel != null) tree.SelectedNode = sel;
            else if (tree.Nodes.Count > 0) tree.SelectedNode = tree.Nodes[0];
            if (tree.SelectedNode != null) tree.SelectedNode.EnsureVisible();
            CapNhatNut();
        }

        TreeNode NutTram(TramCap1 t, object chon, ref TreeNode sel)
        {
            var dhs = d.DongHoCuaTram(t.Id).ToList();
            var nt = new TreeNode(t.Ten + "   (" + dhs.Count(x => !x.Ngung) + " đồng hồ)") { Tag = t };
            foreach (DongHoCap1 x in dhs)
            {
                var n = new TreeNode(x.Ten + "  ·  " + DuLieuCap1.TenNguon(x.Nguon) + (x.HeSo != 1 ? "  ·  ×" + So.Nhap(x.HeSo) : "") + (x.Ngung ? "   — ngừng dùng" : ""))
                {
                    Tag = x,
                    ForeColor = x.Ngung ? Ui.Muted : (x.Nguon == NguonNuoc.Gieng ? Color.FromArgb(0x2E, 0x7D, 0x6B) : Color.FromArgb(0x2B, 0x6C, 0xA3)),
                    ToolTipText = DuLieuCap1.TenNguonDai(x.Nguon) + (x.GhiChu.Length > 0 ? "\n" + x.GhiChu : "")
                };
                nt.Nodes.Add(n);
                if (x == chon) sel = n;
            }
            if (t == chon) sel = nt;
            return nt;
        }

        object Chon { get { return tree.SelectedNode != null ? tree.SelectedNode.Tag : null; } }

        void CapNhatNut()
        {
            object c = Chon;
            bSua.Enabled = bXoa.Enabled = bLen.Enabled = bXuong.Enabled = c != null;
            bThemTram.Enabled = true;
            bThemDh.Enabled = ky != null && d.Tram.Count > 0;
        }

        int DoiDangChon()
        {
            object c = Chon;
            if (c is DoiCap1) return ((DoiCap1)c).Id;
            if (c is TramCap1) return ((TramCap1)c).DoiId;
            if (c is DongHoCap1) { TramCap1 t = d.TimTram(((DongHoCap1)c).TramId); return t != null ? t.DoiId : -1; }
            return -1;
        }

        void ThemDoi()
        {
            using (var f = new TenCap1Form("Thêm đội", "Tên đội", "Đội Cấp nước số " + (d.Doi.Count + 1)))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
                var x = new DoiCap1 { Id = d.CapId(), Ten = f.Ten };
                d.Doi.Add(x);
                DaDoi = true;
                Nap(x);
            }
        }

        void ThemTram()
        {
            using (var f = new TramCap1Form(d, null, DoiDangChon()))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
                var t = new TramCap1 { Id = d.CapId() };
                f.GhiVao(t);
                d.Tram.Add(t);
                DaDoi = true;
                Nap(t);
            }
        }

        void ThemDongHo()
        {
            if (ky == null) return;
            object c = Chon;
            TramCap1 tram = c as TramCap1 ?? (c is DongHoCap1 ? d.TimTram(((DongHoCap1)c).TramId) : null);
            using (var f = new DongHoCap1Form(d, null, tram, DoiDangChon(), ky))
            {
                DialogResult kq = f.ShowDialog(this);
                if (f.DaDoiDanhMuc) DaDoi = true;
                if (kq != DialogResult.OK) { Nap(c); return; }
                var dh = new DongHoCap1 { Id = d.CapId() };
                f.GhiVao(dh);
                d.DongHo.Add(dh);
                Cap1Ops.DuaVaoTuKy(d, ky, dh.Id);
                ChiSoCap1 cs = ky.Tim(dh.Id);
                if (cs != null && f.ChiSoDau.HasValue) cs.ChiSoCu = f.ChiSoDau;
                DaDoi = true;
                Nap(dh);
            }
        }

        void Sua()
        {
            object c = Chon;
            if (c is DoiCap1)
            {
                var doi = (DoiCap1)c;
                using (var f = new TenCap1Form("Đổi tên đội", "Tên đội", doi.Ten))
                {
                    if (f.ShowDialog(this) != DialogResult.OK) return;
                    doi.Ten = f.Ten;
                }
            }
            else if (c is TramCap1)
            {
                var t = (TramCap1)c;
                using (var f = new TramCap1Form(d, t, -1))
                {
                    if (f.ShowDialog(this) != DialogResult.OK) return;
                    f.GhiVao(t);
                }
            }
            else if (c is DongHoCap1)
            {
                var x = (DongHoCap1)c;
                using (var f = new DongHoCap1Form(d, x, null, -1, ky))
                {
                    DialogResult kq = f.ShowDialog(this);
                    if (f.DaDoiDanhMuc) DaDoi = true;
                    if (kq != DialogResult.OK) { Nap(c); return; }
                    f.GhiVao(x);
                }
            }
            else return;
            DaDoi = true;
            Nap(c);
        }

        void Xoa()
        {
            object c = Chon;
            if (c is DoiCap1)
            {
                var doi = (DoiCap1)c;
                int n = d.TramCuaDoi(doi.Id).Count();
                if (n > 0)
                {
                    Ui.Error(this, doi.Ten + " còn " + n + " trạm — chuyển trạm sang đội khác (chọn trạm → Sửa…) hoặc xoá trạm trước.");
                    return;
                }
                if (!Ui.Confirm(this, "Xoá \"" + doi.Ten + "\" khỏi danh mục đồng hồ cấp 1?")) return;
                d.Doi.Remove(doi);
                DaDoi = true;
                Nap(null);
            }
            else if (c is TramCap1)
            {
                var t = (TramCap1)c;
                int n = d.DongHoCuaTram(t.Id).Count();
                if (n > 0)
                {
                    Ui.Error(this, "Trạm " + t.Ten + " còn " + n + " đồng hồ (kể cả đồng hồ đã ngừng nhưng còn số liệu các tháng trước) — không xoá được.\n\n" +
                                   "Trạm không dùng nữa: ngừng dùng các đồng hồ của trạm (bảng tháng → chọn đồng hồ → Xoá), trạm sẽ không hiện ở các tháng sau.");
                    return;
                }
                if (!Ui.Confirm(this, "Xoá trạm \"" + t.Ten + "\"?")) return;
                d.Tram.Remove(t);
                foreach (KyCap1 k in d.Ky) k.ThoiGianChot.Remove(t.Id);
                DaDoi = true;
                Nap(d.TimDoi(t.DoiId));
            }
            else if (c is DongHoCap1)
            {
                var x = (DongHoCap1)c;
                var co = d.Ky.Where(k => k.Tim(x.Id) != null).ToList();
                if (co.Any(k => Cap1Ops.CoSoLieu(k.Tim(x.Id))))
                {
                    Ui.Error(this, "Đồng hồ \"" + x.Ten + "\" đã có số liệu (" + string.Join(", ", co.Select(k => k.Thang + "/" + k.Nam).Take(6)) + (co.Count > 6 ? "…" : "") + ") — không xoá khỏi danh mục được.\n\n" +
                                   "Không dùng nữa: ở bảng tháng chọn đồng hồ → Xoá (ngừng dùng từ tháng đó, giữ số liệu các tháng trước).");
                    return;
                }
                if (!Ui.Confirm(this, "Xoá đồng hồ \"" + x.Ten + "\" khỏi danh mục" + (co.Count > 0 ? " và " + co.Count + " tháng (chưa nhập số)" : "") + "?")) return;
                foreach (KyCap1 k in co) k.ChiSo.RemoveAll(cs => cs.DongHoId == x.Id);
                d.DongHo.Remove(x);
                DaDoi = true;
                Nap(d.TimTram(x.TramId));
            }
        }

        void DiChuyen(int huong)
        {
            object c = Chon;
            bool ok = false;
            if (c is DoiCap1) ok = Cap1Ops.DiChuyen(d.Doi, (DoiCap1)c, (a, b) => true, huong);
            else if (c is TramCap1) ok = Cap1Ops.DiChuyen(d.Tram, (TramCap1)c, (a, b) => a.DoiId == b.DoiId, huong);
            else if (c is DongHoCap1) ok = Cap1Ops.DiChuyen(d.DongHo, (DongHoCap1)c, (a, b) => a.TramId == b.TramId, huong);
            if (!ok) return;
            DaDoi = true;
            Nap(c);
        }
    }

    /// <summary>Số liệu riêng của 1 đồng hồ trong tháng: thay đồng hồ / quay vòng, sản lượng nhập thẳng, lũy kế các tháng trước, ghi chú.</summary>
    class ChiTietCap1Form : HopThoaiCap1
    {
        readonly DuLieuCap1 d;
        readonly KyCap1 ky;
        readonly DongHoCap1 dh;
        readonly ChiSoCap1 cs;
        readonly TextBox txtCu, txtMoi, txtChot, txtDau, txtSl, txtLk, txtGhiChu;
        readonly CheckBox chkThay;
        readonly Label lblKq;

        public ChiTietCap1Form(DuLieuCap1 d, KyCap1 ky, DongHoCap1 dh, ChiSoCap1 cs)
            : base("Chi tiết " + ky.Ten.ToLower() + " — " + dh.Ten, 720, ky.Thang == 1 ? 560 : 640)
        {
            this.d = d;
            this.ky = ky;
            this.dh = dh;
            this.cs = cs;
            TramCap1 tram = d.TimTram(dh.TramId);
            DoiCap1 doi = tram != null ? d.TimDoi(tram.DoiId) : null;
            var info = Ui.MakeLabel(dh.Ten + "\n" + (tram != null ? tram.Ten : "") + (doi != null ? " · " + doi.Ten : "") + " · " + DuLieuCap1.TenNguonDai(dh.Nguon) +
                                    (dh.HeSo != 1 ? " · hệ số ×" + So.Nhap(dh.HeSo) : ""), Ui.BaseBold, Ui.Text);
            info.MaximumSize = new Size(Ui.S(660), 0);
            Bang.Controls.Add(info, 0, Bang.RowCount);
            Bang.SetColumnSpan(info, 2);
            Bang.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Bang.RowCount++;
            info.Margin = Ui.Pad(0, 0, 0, 10);

            txtCu = O(140, So.Nhap(cs.ChiSoCu), null);
            txtMoi = O(140, So.Nhap(cs.ChiSoMoi), null);
            Dong("Chỉ số tháng trước", txtCu);
            Dong("Chỉ số hiện tại", txtMoi);

            chkThay = new CheckBox { Text = "Thay đồng hồ / đồng hồ quay vòng trong tháng", AutoSize = true, Checked = cs.ThayDongHo };
            Dong("", chkThay);
            txtChot = O(140, So.Nhap(cs.ChotCu), null);
            txtDau = O(140, So.Nhap(cs.DauMoi), "0");
            Dong("Chốt đồng hồ cũ", Hang(txtChot, Ui.MakeLabel("chỉ số cuối cùng của đồng hồ cũ (quay vòng: 100000)", Ui.Small, Ui.Muted)));
            Dong("Đầu đồng hồ mới", Hang(txtDau, Ui.MakeLabel("chỉ số lúc lắp đồng hồ mới (quay vòng: 0)", Ui.Small, Ui.Muted)));
            GhiChu("Sản lượng = (chốt ĐH cũ − chỉ số tháng trước) + (chỉ số hiện tại − đầu ĐH mới).");

            txtSl = O(140, So.Nhap(cs.SanLuongNhap), "tính theo chỉ số");
            Dong("Sản lượng nhập thẳng", Hang(txtSl, Ui.MakeLabel("m³ — đồng hồ hỏng / ước tính; để trống = tính theo chỉ số", Ui.Small, Ui.Muted)));

            if (ky.Thang != 1)
            {
                KyCap1 truoc = d.TimKy(ky.SoThu - 1);
                bool coTruoc = truoc != null && truoc.Nam == ky.Nam && truoc.Tim(dh.Id) != null;
                string cue = null;
                if (coTruoc)
                {
                    KetQuaCap1 rt;
                    if (new TinhCap1(d).Tinh(truoc).TryGetValue(dh.Id, out rt)) cue = So.Nhap(rt.LuyKe) + " (theo " + truoc.Ten.ToLower() + ")";
                }
                txtLk = O(220, So.Nhap(cs.LuyKeTruoc), cue ?? "chưa có tháng trước");
                Dong("Lũy kế các tháng trước", txtLk);
                GhiChu("Lũy kế từ tháng 1 đến hết tháng trước của năm " + ky.Nam + ". Chỉ nhập khi phần mềm chưa có số liệu các tháng đó " +
                       "(vd bắt đầu dùng từ giữa năm); để trống = lấy lũy kế tháng trước. Tháng 1 lũy kế tự bắt đầu lại.");
            }
            txtGhiChu = O(440, cs.GhiChu, null);
            Dong("Ghi chú", txtGhiChu);
            lblKq = Ui.MakeLabel("", Ui.BaseBold, Ui.Primary);
            lblKq.MaximumSize = new Size(Ui.S(500), 0);
            Dong("Sản lượng tháng", lblKq);

            chkThay.CheckedChanged += (s, e) => { CapNhat(); if (chkThay.Checked) txtChot.Focus(); };
            foreach (TextBox t in new[] { txtCu, txtMoi, txtChot, txtDau, txtSl }) t.TextChanged += (s, e) => CapNhat();
            CapNhat();
        }

        ChiSoCap1 Thu()
        {
            double? cu, moi, chot = null, dau = null, sl;
            So.TryDoc(txtCu.Text, out cu);
            So.TryDoc(txtMoi.Text, out moi);
            if (chkThay.Checked)
            {
                So.TryDoc(txtChot.Text, out chot);
                So.TryDoc(txtDau.Text, out dau);
                if (!dau.HasValue && txtDau.Text.Trim().Length == 0) dau = 0;
            }
            So.TryDoc(txtSl.Text, out sl);
            return new ChiSoCap1 { DongHoId = dh.Id, ChiSoCu = cu, ChiSoMoi = moi, ChotCu = chot, DauMoi = dau, SanLuongNhap = sl };
        }

        void CapNhat()
        {
            txtChot.Enabled = txtDau.Enabled = chkThay.Checked;
            string ct;
            double? v = TinhCap1.SanLuong(Thu(), dh, out ct);
            lblKq.Text = v.HasValue ? So.M3(v) + " m³" + (ct.Length > 0 && !ct.StartsWith("Nhập") ? "   = " + ct.Substring(0, ct.LastIndexOf(" = ") > 0 ? ct.LastIndexOf(" = ") : ct.Length) : "") : ct;
            lblKq.ForeColor = v.HasValue && v < 0 ? Ui.Danger : v.HasValue ? Ui.Primary : Ui.Muted;
        }

        protected override bool KiemTra()
        {
            double? cu, moi, chot = null, dau = null, sl, lk = null;
            if (!DocSo(txtCu, "Chỉ số tháng trước", out cu) || !DocSo(txtMoi, "Chỉ số hiện tại", out moi)) return false;
            if (chkThay.Checked)
            {
                if (!DocSo(txtChot, "Chốt đồng hồ cũ", out chot) || !DocSo(txtDau, "Đầu đồng hồ mới", out dau)) return false;
                if (!chot.HasValue)
                {
                    Ui.Error(this, "Nhập chỉ số chốt của đồng hồ cũ (hoặc bỏ chọn \"Thay đồng hồ\").");
                    txtChot.Focus();
                    return false;
                }
                if (!dau.HasValue) dau = 0;
            }
            if (!DocSo(txtSl, "Sản lượng nhập thẳng", out sl)) return false;
            if (txtLk != null && !DocSo(txtLk, "Lũy kế các tháng trước", out lk)) return false;
            string ct;
            double? v = TinhCap1.SanLuong(Thu(), dh, out ct);
            if (v.HasValue && v < 0 && !Ui.Confirm(this, "Sản lượng ra số âm (" + So.M3(v) + " m³). Vẫn lưu?")) return false;
            cs.ChiSoCu = cu;
            if (!Nullable.Equals(cs.ChiSoMoi, moi)) Cap1Ops.DatChiSoMoi(d, ky, cs, moi);
            cs.ChotCu = chot;
            cs.DauMoi = dau;
            cs.SanLuongNhap = sl;
            if (txtLk != null) cs.LuyKeTruoc = lk;
            cs.GhiChu = txtGhiChu.Text.Trim();
            return true;
        }
    }

    /// <summary>Thông tin 1 tháng khai thác: kỳ hoá đơn, thời gian khai thác, ngày lập; xoá tháng cuối.</summary>
    class KyCap1Form : HopThoaiCap1
    {
        readonly KyCap1 k;
        readonly TextBox txtKy;
        readonly DateTimePicker dtTu, dtDen, dtLap;

        public KyCap1Form(DuLieuCap1 d, KyCap1 k) : base("Thông tin " + k.Ten.ToLower() + " — đồng hồ cấp 1", 680, 330)
        {
            this.k = k;
            txtKy = O(120, k.KyHoaDon, ThangBaoCao.KyMacDinh(k.Nam, k.Thang));
            Dong("Hoá đơn kỳ", Hang(txtKy, Ui.MakeLabel("in thành \"HÓA ĐƠN KỲ " + ThangBaoCao.KyMacDinh(k.Nam, k.Thang) + "\"", Ui.Small, Ui.Muted)));
            dtTu = Ui.MakeDatePicker(true);
            dtDen = Ui.MakeDatePicker(true);
            Dat(dtTu, k.TuNgay);
            Dat(dtDen, k.DenNgay);
            Dong("Nước khai thác từ ngày", Hang(dtTu, Ui.MakeLabel("đến ngày", Ui.Base, Ui.Text), dtDen));
            dtLap = Ui.MakeDatePicker(true);
            Dat(dtLap, k.NgayLap);
            Dong("Ngày lập báo cáo", Hang(dtLap, Ui.MakeLabel("bỏ chọn = lấy ngày xuất file", Ui.Small, Ui.Muted)));
            GhiChu("Thời gian chốt số của từng trạm: gõ ở cột \"Ghi chú / thời gian chốt\" của dòng trạm. Người ký lấy theo trang Cài đặt.");
            if (k == d.KyCuoi)
            {
                var xoa = Ui.MakeButton("Xoá tháng này…", false);
                xoa.ForeColor = Ui.Danger;
                xoa.Click += (s, e) =>
                {
                    if (!Ui.Confirm(this, "Xoá " + k.Ten.ToLower() + " của đồng hồ cấp 1 (" + k.ChiSo.Count + " đồng hồ)?\n\nToàn bộ chỉ số đã nhập của tháng này sẽ mất " +
                                          "(bản sao lưu hằng ngày vẫn còn trong thư mục SaoLuu). Danh mục đội, trạm, đồng hồ giữ nguyên.")) return;
                    DialogResult = DialogResult.Abort;
                };
                Nut.Controls.Add(xoa);
                xoa.Margin = Ui.Pad(0, 0, 160, 0);
            }
        }

        static void Dat(DateTimePicker p, DateTime? v)
        {
            if (v.HasValue) { p.Value = v.Value; p.Checked = true; }
            else p.Checked = false;
        }

        protected override bool KiemTra()
        {
            if (dtTu.Checked && dtDen.Checked && dtDen.Value.Date <= dtTu.Value.Date)
            {
                Ui.Error(this, "Ngày kết thúc phải sau ngày bắt đầu.");
                return false;
            }
            k.KyHoaDon = txtKy.Text.Trim();
            k.TuNgay = dtTu.Checked ? dtTu.Value.Date : (DateTime?)null;
            k.DenNgay = dtDen.Checked ? dtDen.Value.Date : (DateTime?)null;
            k.NgayLap = dtLap.Checked ? dtLap.Value.Date : (DateTime?)null;
            return true;
        }
    }

    /// <summary>Nhập file Excel "BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG …" (đồng hồ cấp 1).</summary>
    class NhapCap1Form : Form
    {
        readonly PhienLam phien;
        readonly TextBox txtFile, txtKetQua;
        readonly CheckedListBox lst;
        readonly Button btnNhap;
        List<NhapCap1.TrangCap1> trang = new List<NhapCap1.TrangCap1>();
        public KyCap1 KyMoi { get; private set; }

        public NhapCap1Form(PhienLam phien)
        {
            this.phien = phien;
            Text = "Nhập số liệu đồng hồ cấp 1 từ file Excel";
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(820), Ui.S(600));
            MinimizeBox = false;
            ShowInTaskbar = false;
            BackColor = Ui.Surface;

            var top = new Panel { Dock = DockStyle.Top, Height = Ui.S(150), Padding = Ui.Pad(16, 12, 16, 0) };
            var l = Ui.MakeLabel("File Excel (.xlsx) mẫu \"BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG 09/2026\": dòng I, II… = đội; 1, 2… = trạm / nhà máy (cột C ghi thời gian chốt); " +
                                 "1.1, 2.1… = đồng hồ (cột C chỉ số tháng trước, D chỉ số hiện tại, E sản lượng). Mỗi đội 1 file hay cả công ty 1 file đều được — " +
                                 "đội, trạm, đồng hồ chưa có thì tự thêm vào danh mục, đã có thì cập nhật số.", Ui.Small, Ui.Muted);
            l.MaximumSize = new Size(Ui.S(780), 0);
            l.Location = new Point(Ui.S(16), Ui.S(10));
            top.Controls.Add(l);
            txtFile = new TextBox { Font = Ui.Base, ReadOnly = true, Location = new Point(Ui.S(16), Ui.S(84)), Width = Ui.S(640) };
            top.Controls.Add(txtFile);
            var bChon = Ui.MakeButton("Chọn file…", false);
            bChon.Location = new Point(Ui.S(668), Ui.S(80));
            bChon.Click += (s, e) => ChonFile();
            top.Controls.Add(bChon);
            var l2 = Ui.MakeLabel("Các trang báo cáo tìm thấy:", Ui.Base, Ui.Text);
            l2.Location = new Point(Ui.S(16), Ui.S(122));
            top.Controls.Add(l2);

            lst = new CheckedListBox { Dock = DockStyle.Fill, CheckOnClick = true, Font = Ui.Base, IntegralHeight = false };
            var lstHost = new Panel { Dock = DockStyle.Top, Height = Ui.S(150), Padding = Ui.Pad(16, 4, 16, 4) };
            lstHost.Controls.Add(lst);
            txtKetQua = new TextBox { Dock = DockStyle.Fill, Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Font = Ui.Small, BackColor = Ui.Computed };
            var kqHost = new Panel { Dock = DockStyle.Fill, Padding = Ui.Pad(16, 4, 16, 4) };
            kqHost.Controls.Add(txtKetQua);
            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var dong = Ui.MakeButton("Đóng", false);
            dong.DialogResult = DialogResult.Cancel;
            btnNhap = Ui.MakeButton("Nhập các trang đã chọn", true);
            btnNhap.Enabled = false;
            btnNhap.Click += (s, e) => Nhap();
            buttons.Controls.Add(dong);
            buttons.Controls.Add(btnNhap);
            Controls.Add(kqHost);
            Controls.Add(lstHost);
            Controls.Add(top);
            Controls.Add(buttons);
            CancelButton = dong;
        }

        void ChonFile()
        {
            using (var dlg = new OpenFileDialog())
            {
                dlg.Filter = "Excel (*.xlsx)|*.xlsx|Tất cả|*.*";
                dlg.Title = "Chọn file báo cáo sản lượng nước (đồng hồ cấp 1)";
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                MoFile(dlg.FileName);
            }
        }

        public void MoFile(string path)
        {
            txtFile.Text = path;
            lst.Items.Clear();
            trang.Clear();
            btnNhap.Enabled = false;
            if (path.EndsWith(".xls", StringComparison.OrdinalIgnoreCase))
            {
                txtKetQua.Text = "File .xls (Excel 97-2003) chưa đọc được. Mở file bằng Excel → File → Save As → chọn \"Excel Workbook (*.xlsx)\" rồi chọn lại.";
                return;
            }
            try
            {
                Cursor = Cursors.WaitCursor;
                trang = NhapCap1.TimTrang(XlsxReader.Doc(path));
            }
            catch (Exception ex)
            {
                txtKetQua.Text = "Không đọc được file: " + ex.Message;
                return;
            }
            finally
            {
                Cursor = Cursors.Default;
            }
            foreach (NhapCap1.TrangCap1 t in trang)
                lst.Items.Add(t + (phien.Dl.Cap1.TimKy(t.Nam, t.Thang) != null ? "   — tháng đã có, sẽ cập nhật số của các đồng hồ trong file" : ""), true);
            txtKetQua.Text = trang.Count == 0
                ? "Không thấy trang báo cáo sản lượng (dòng tiêu đề \"BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG mm/yyyy\" và cột \"Tên đơn vị\" / \"Chỉ số TLK…\")."
                : "Tìm thấy " + trang.Count + " trang. Bấm \"Nhập các trang đã chọn\".";
            btnNhap.Enabled = trang.Count > 0;
        }

        void Nhap()
        {
            var chon = new List<NhapCap1.TrangCap1>();
            for (int i = 0; i < trang.Count; i++) if (lst.GetItemChecked(i)) chon.Add(trang[i]);
            if (chon.Count == 0) return;
            var lines = new List<string>();
            try
            {
                Cursor = Cursors.WaitCursor;
                try { phien.Kho.SaoLuuNgay(); } catch (Exception) { }
                foreach (NhapCap1.TrangCap1 t in chon.OrderBy(x => x.Nam * 12 + x.Thang))
                {
                    NhapCap1.KetQua kq = NhapCap1.Nhap(t, phien.Dl);
                    KyMoi = kq.Ky;
                    lines.Add(kq.Ky.Ten + " (trang \"" + t.Trang.Ten + "\"): " + kq.Doi + " đội, " + kq.Tram + " trạm, " + kq.DongHo + " đồng hồ.");
                    lines.AddRange(kq.ThongBao.Select(s => "  • " + s));
                    lines.Add("  Đối chiếu sản lượng: " + kq.Khop + " đồng hồ khớp với file" + (kq.SaiLech.Count == 0 ? "." : ", " + kq.SaiLech.Count + " khác:"));
                    lines.AddRange(kq.SaiLech.Select(s => "    – " + s));
                }
            }
            catch (Exception ex)
            {
                lines.Add("Lỗi khi nhập: " + ex.Message);
            }
            finally
            {
                Cursor = Cursors.Default;
            }
            phien.Luu(this);
            lines.Add("");
            lines.Add("Tiếp theo: kiểm tra nguồn nước (giếng / nước mặt) của từng đồng hồ, rồi bấm \"+ Tạo tháng …\" để nhập tháng kế tiếp.");
            txtKetQua.Text = string.Join("\r\n", lines);
            btnNhap.Enabled = false;
        }
    }
}
