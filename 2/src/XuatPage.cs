using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Xuất các mẫu báo cáo ra Excel.</summary>
    public class XuatPage : UserControl, ITrang
    {
        readonly PhienLam phien;
        readonly ComboBox cboThang, cboTomTat, cboNamQuy, cboQuy, cboNamTh, cboTu, cboDen, cboNamSo;

        public XuatPage(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;
            var scroll = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true };
            Label sub;
            Controls.Add(scroll);
            Controls.Add(Ui.PageHeader("Xuất / in báo cáo",
                "Các mẫu giống file báo cáo đang dùng (phông Times New Roman, khổ A4, lặp tiêu đề cột khi in). " +
                "\"Xuất Excel…\" lưu file có công thức (sửa số trong Excel vẫn tự tính lại); \"In…\" xem trước rồi in thẳng ra máy in, không cần mở Excel.", out sub));

            cboThang = Ui.MakeCombo(160);
            scroll.Controls.Add(The("Báo cáo tỷ lệ thất thoát tháng",
                "Mẫu \"Tháng N-YYYY\": chỉ số TLK, sản lượng phát ra, chuẩn thu, tỷ lệ thất thoát, so tháng trước / kế hoạch / cùng kỳ, lũy kế, ghi chú, người ký.",
                new Control[] { Nhan("Tháng"), cboThang }, inRa => XuatThang(this, phien, Chon(cboThang), inRa)));

            cboTomTat = Ui.MakeCombo(160);
            scroll.Controls.Add(The("Bảng tóm tắt tháng",
                "1 trang dọc: tỷ lệ thất thoát tháng và lũy kế của từng đội, khu vực và toàn công ty.",
                new Control[] { Nhan("Tháng"), cboTomTat }, inRa => XuatTomTat(Chon(cboTomTat), inRa)));

            cboNamQuy = Ui.MakeCombo(90);
            cboQuy = Ui.MakeCombo(90);
            for (int q = 1; q <= 4; q++) cboQuy.Items.Add("Quý " + So.LaMa(q));
            var btnSoSanh = Ui.MakeButton("Số so sánh quý…", false);
            btnSoSanh.Click += (s, e) => SuaSoSanhQuy();
            scroll.Controls.Add(The("Báo cáo quý",
                "Cộng sản lượng, chuẩn thu 3 tháng của quý; so với quý trước, cùng kỳ năm trước, kế hoạch năm. " +
                "Nếu chưa có số liệu quý trước / năm trước trong phần mềm, bấm \"Số so sánh quý…\" để nhập tay.",
                new Control[] { Nhan("Năm"), cboNamQuy, Nhan("Quý"), cboQuy, btnSoSanh }, XuatQuy));

            cboNamTh = Ui.MakeCombo(90);
            scroll.Controls.Add(The("Bảng tổng hợp tỷ lệ thất thoát năm",
                "Mẫu \"TỔNG HỢP\": tỷ lệ từng tháng 1–12 của mỗi đội / khu vực, lũy kế, so cùng kỳ, so kế hoạch; dòng so tháng trước của toàn công ty.",
                new Control[] { Nhan("Năm"), cboNamTh }, inRa => XuatTongHop(this, phien, Nam(cboNamTh), inRa)));

            cboTu = Ui.MakeCombo(160);
            cboDen = Ui.MakeCombo(160);
            scroll.Controls.Add(The("Tổng hợp gộp nhiều tháng",
                "Mẫu \"Tháng 8 + 9\": sản lượng từng tháng, tổng sản lượng, tổng chuẩn thu và tỷ lệ thất thoát bình quân của các tháng chọn.",
                new Control[] { Nhan("Từ"), cboTu, Nhan("đến"), cboDen }, XuatGop));

            cboNamSo = Ui.MakeCombo(90);
            scroll.Controls.Add(The("Sổ báo cáo cả năm (1 file nhiều trang)",
                "Đủ các trang như file Excel đang làm: KẾ HOẠCH NĂM, TÓM TẮT, TỔNG HỢP, Tháng 1…, Quý I…; lũy kế các tháng nối công thức với nhau. In: in lần lượt tất cả các trang.",
                new Control[] { Nhan("Năm"), cboNamSo }, XuatSoCaNam));

            phien.DaDoi += (s, e) => { if (Visible) KhiHien(); };
        }

        static Label Nhan(string text)
        {
            var l = Ui.MakeLabel(text, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 4, 0);
            return l;
        }

        Control The(string title, string desc, Control[] inputs, Action<bool> xuat)
        {
            var card = Ui.MakeCard();
            card.Width = Ui.S(860);
            card.Height = Ui.S(128);
            card.Margin = Ui.Pad(0, 0, 0, 10);
            var t = Ui.MakeLabel(title, Ui.Section, Ui.Text);
            t.Location = new Point(Ui.S(16), Ui.S(12));
            card.Controls.Add(t);
            var d = Ui.MakeLabel(desc, Ui.Small, Ui.Muted);
            d.MaximumSize = new Size(Ui.S(820), 0);
            d.Location = new Point(Ui.S(16), Ui.S(38));
            card.Controls.Add(d);
            var line = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Location = new Point(Ui.S(14), Ui.S(80)) };
            foreach (Control c in inputs)
            {
                if (!(c is Label)) c.Margin = Ui.Pad(0, 4, 10, 0);
                line.Controls.Add(c);
            }
            var b = QuyenUi.ChoXem(Ui.MakeButton("Xuất Excel…", true));
            b.Margin = Ui.Pad(10, 1, 0, 0);
            b.Click += (s, e) => xuat(false);
            line.Controls.Add(b);
            var bIn = NutIn();
            bIn.Margin = Ui.Pad(8, 1, 0, 0);
            bIn.Click += (s, e) => xuat(true);
            line.Controls.Add(bIn);
            card.Controls.Add(line);
            return card;
        }

        /// <summary>Nút "In…" dùng chung ở các trang báo cáo.</summary>
        public static Button NutIn()
        {
            var b = QuyenUi.ChoXem(Ui.MakeButton("In…", false));
            new ToolTip().SetToolTip(b, "Xem trước rồi in thẳng ra máy in (chọn máy in, số bản) — không cần mở Excel. Ctrl+P trong cửa sổ in để in ngay.");
            return b;
        }

        /// <summary>Xuất file Excel hoặc in thẳng cùng 1 mẫu báo cáo.</summary>
        public static void XuatHoacIn(Control owner, PhienLam phien, Func<XSo> tao, string tenFile, bool inRa)
        {
            if (inRa) InBaoCao.In(owner, tao, Path.GetFileNameWithoutExtension(tenFile));
            else Luu(owner, phien, tao, tenFile);
        }

        class MucThang
        {
            public ThangBaoCao Thang;
            public override string ToString() { return Thang.Ten; }
        }

        static ThangBaoCao Chon(ComboBox c)
        {
            var m = c.SelectedItem as MucThang;
            return m != null ? m.Thang : null;
        }

        static int Nam(ComboBox c)
        {
            return c.SelectedItem is int ? (int)c.SelectedItem : DateTime.Today.Year;
        }

        public void KhiHien()
        {
            DuLieu dl = phien.Dl;
            ThangBaoCao chon = phien.ThangChon;
            foreach (ComboBox c in new[] { cboThang, cboTomTat, cboTu, cboDen })
            {
                ThangBaoCao cu = Chon(c);
                c.Items.Clear();
                foreach (ThangBaoCao t in dl.Thang.AsEnumerable().Reverse()) c.Items.Add(new MucThang { Thang = t });
                ThangBaoCao muon = cu != null && dl.Thang.Contains(cu) ? cu : chon;
                if (c == cboTu && cu == null && chon != null) muon = dl.TimThang(chon.SoThu - 1) ?? chon;
                foreach (MucThang m in c.Items) if (m.Thang == muon) c.SelectedItem = m;
                if (c.SelectedIndex < 0 && c.Items.Count > 0) c.SelectedIndex = 0;
            }
            List<int> years = dl.CacNam();
            int namChon = chon != null ? chon.Nam : DateTime.Today.Year;
            foreach (ComboBox c in new[] { cboNamQuy, cboNamTh, cboNamSo })
            {
                object cu = c.SelectedItem;
                c.Items.Clear();
                foreach (int y in years.AsEnumerable().Reverse()) c.Items.Add(y);
                if (cu != null && c.Items.Contains(cu)) c.SelectedItem = cu;
                else if (c.Items.Contains(namChon)) c.SelectedItem = namChon;
                else if (c.Items.Count > 0) c.SelectedIndex = 0;
            }
            if (cboQuy.SelectedIndex < 0) cboQuy.SelectedIndex = chon != null ? (chon.Thang - 1) / 3 : 0;
        }

        // ------------------------------------------------------------------ lưu file

        public static void Luu(Control owner, PhienLam phien, Func<XSo> tao, string tenFile)
        {
            XSo so;
            try
            {
                so = tao();
            }
            catch (InvalidOperationException ex)
            {
                Ui.Error(owner, ex.Message);
                return;
            }
            using (var dlg = new SaveFileDialog())
            {
                dlg.Filter = "Excel (*.xlsx)|*.xlsx";
                dlg.FileName = tenFile;
                string dir = phien.Dl.CaiDat.ThuMucXuat;
                dlg.InitialDirectory = !string.IsNullOrEmpty(dir) && Directory.Exists(dir) ? dir : Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                if (dlg.ShowDialog(owner) != DialogResult.OK) return;
                try
                {
                    so.Luu(dlg.FileName);
                }
                catch (IOException ex)
                {
                    Ui.Error(owner, "Không ghi được file (có thể file đang mở trong Excel — đóng file rồi thử lại, hoặc lưu tên khác).\n\n" + ex.Message);
                    return;
                }
                catch (UnauthorizedAccessException ex)
                {
                    Ui.Error(owner, "Không có quyền ghi vào thư mục này.\n\n" + ex.Message);
                    return;
                }
                string newDir = Path.GetDirectoryName(dlg.FileName);
                if (newDir != phien.Dl.CaiDat.ThuMucXuat)
                {
                    phien.Dl.CaiDat.ThuMucXuat = newDir;
                    if (!phien.ChiXem) phien.Luu(owner);   // chỉ xem: nhớ thư mục trong phiên, không lưu
                }
                if (MessageBox.Show(owner, "Đã xuất:\n" + dlg.FileName + "\n\nMở file ngay?", UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                    Ui.OpenFile(owner, dlg.FileName);
            }
        }

        public static void XuatThang(Control owner, PhienLam phien, ThangBaoCao t, bool inRa = false)
        {
            if (t == null) { Ui.Error(owner, "Chưa chọn tháng."); return; }
            var bc = new BaoCao(phien.Dl, phien.Bt);
            List<CanhBao> loi = phien.Bt.KiemTra(t).Where(c => c.MucDo >= 1).ToList();
            if (loi.Count > 0 && !Ui.Confirm(owner, t.Ten + " còn " + loi.Count + " mục cần xem (chưa nhập chỉ số / chuẩn thu, số bất thường):\n\n" +
                                                    string.Join("\n", loi.Take(8).Select(c => "• " + c.NoiDung)) + (loi.Count > 8 ? "\n…" : "") +
                                                    "\n\nVẫn " + (inRa ? "in" : "xuất") + " báo cáo?"))
                return;
            XuatHoacIn(owner, phien, () => bc.SoThang(t), "BÁO CÁO THẤT THOÁT THÁNG " + t.Thang + " NĂM " + t.Nam + ".xlsx", inRa);
        }

        public static void XuatTongHop(Control owner, PhienLam phien, int nam, bool inRa = false)
        {
            var bc = new BaoCao(phien.Dl, phien.Bt);
            XuatHoacIn(owner, phien, () => bc.SoTongHopNam(nam), "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC NĂM " + nam + ".xlsx", inRa);
        }

        void XuatTomTat(ThangBaoCao t, bool inRa)
        {
            if (t == null) return;
            var bc = new BaoCao(phien.Dl, phien.Bt);
            XuatHoacIn(this, phien, () => bc.SoTomTat(t), "TÓM TẮT THẤT THOÁT THÁNG " + t.Thang + "-" + t.Nam + ".xlsx", inRa);
        }

        void XuatQuy(bool inRa)
        {
            int nam = Nam(cboNamQuy), quy = cboQuy.SelectedIndex + 1;
            var bc = new BaoCao(phien.Dl, phien.Bt);
            XuatHoacIn(this, phien, () => bc.SoQuy(nam, quy), "BÁO CÁO THẤT THOÁT QUÝ " + So.LaMa(quy) + " NĂM " + nam + ".xlsx", inRa);
        }

        void XuatGop(bool inRa)
        {
            ThangBaoCao tu = Chon(cboTu), den = Chon(cboDen);
            if (tu == null || den == null) return;
            if (den.SoThu < tu.SoThu) { ThangBaoCao x = tu; tu = den; den = x; }
            var list = phien.Dl.Thang.Where(t => t.SoThu >= tu.SoThu && t.SoThu <= den.SoThu).ToList();
            var bc = new BaoCao(phien.Dl, phien.Bt);
            string ten = string.Join(" + ", list.Select(t => t.Thang.ToString()));
            XuatHoacIn(this, phien, () => bc.SoGop(list), "TỔNG HỢP THẤT THOÁT THÁNG " + ten + " NĂM " + den.Nam + ".xlsx", inRa);
        }

        void XuatSoCaNam(bool inRa)
        {
            int nam = Nam(cboNamSo);
            var bc = new BaoCao(phien.Dl, phien.Bt);
            ThangBaoCao cuoi = bc.ThangCuoiCuaNam(nam);
            XuatHoacIn(this, phien, () => bc.SoCaNam(nam), "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC tháng " + (cuoi != null ? cuoi.Thang : 12) + " năm " + nam + ".xlsx", inRa);
        }

        void SuaSoSanhQuy()
        {
            int nam = Nam(cboNamQuy), quy = cboQuy.SelectedIndex + 1;
            if (phien.Bt.ThangCuaQuy(nam, quy).Count == 0)
            {
                Ui.Error(this, "Quý " + So.LaMa(quy) + "/" + nam + " chưa có tháng nào.");
                return;
            }
            using (var f = new SoSanhQuyForm(phien, nam, quy))
                if (f.ShowDialog(this) == DialogResult.OK) phien.Luu(this);
        }
    }

    /// <summary>Nhập tay tỷ lệ quý trước / cùng kỳ năm trước cho báo cáo quý.</summary>
    class SoSanhQuyForm : Form
    {
        readonly PhienLam phien;
        readonly int nam, quy;
        readonly DataGridView grid;
        readonly List<Muc> dong;

        public SoSanhQuyForm(PhienLam phien, int nam, int quy)
        {
            this.phien = phien;
            this.nam = nam;
            this.quy = quy;
            Text = "Số so sánh — Quý " + So.LaMa(quy) + " năm " + nam;
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(820), Ui.S(560));
            MinimizeBox = false;
            var note = Ui.MakeLabel("Ô trắng để trống = dùng số tự tính (từ số liệu quý trước / cùng quý năm trước có trong phần mềm). " +
                                    "Chỉ nhập khi chưa có số liệu đó, vd lấy từ báo cáo quý cũ.", Ui.Small, Ui.Muted);
            note.Dock = DockStyle.Top;
            note.Padding = Ui.Pad(12, 10, 12, 8);
            note.AutoSize = false;
            note.Height = Ui.S(58);
            grid = new DataGridView { Dock = DockStyle.Fill };
            Ui.StyleGrid(grid);
            grid.SelectionMode = DataGridViewSelectionMode.CellSelect;
            grid.EditMode = DataGridViewEditMode.EditOnKeystrokeOrF2;
            grid.Columns.Add(Ui.Col("Đơn vị", 250, false));
            grid.Columns.Add(Ui.Col("TT quý %", 80, true));
            grid.Columns.Add(Ui.Col("Quý trước\n(tự tính)", 96, true));
            grid.Columns.Add(Ui.Col("Quý trước\n(nhập tay)", 96, true));
            grid.Columns.Add(Ui.Col("Cùng kỳ\n(tự tính)", 96, true));
            grid.Columns.Add(Ui.Col("Cùng kỳ năm\ntrước (nhập tay)", 110, true));
            for (int c = 0; c < 6; c++) grid.Columns[c].ReadOnly = c != 3 && c != 5;
            List<KetQuaGop> rows = phien.Bt.TinhQuy(nam, quy);
            dong = new List<Muc>();
            foreach (KetQuaGop g in rows.Where(x => x.Muc.CoChuanThu))
            {
                SoSanhQuy ss = phien.Dl.LaySoSanhQuy(nam, quy, g.Muc.Id, false);
                int i = grid.Rows.Add(g.Muc.ToString(), So.P2(g.TyLe), So.P2(phien.Bt.TyLeQuyTruocTuDong(nam, quy, g.Muc.Id)),
                                      ss != null ? So.Nhap(ss.QuyTruoc) : "", So.P2(phien.Bt.TyLeCungKyQuyTuDong(nam, quy, g.Muc.Id)),
                                      ss != null ? So.Nhap(ss.CungKy) : "");
                grid.Rows[i].Cells[3].Style.BackColor = Ui.Input;
                grid.Rows[i].Cells[5].Style.BackColor = Ui.Input;
                if (g.Muc.Cap == 0) grid.Rows[i].DefaultCellStyle.Font = Ui.BaseBold;
                dong.Add(g.Muc);
            }
            grid.CellEndEdit += (s, e) =>
            {
                if (e.ColumnIndex != 3 && e.ColumnIndex != 5) return;
                double? v;
                DataGridViewCell cell = grid.Rows[e.RowIndex].Cells[e.ColumnIndex];
                if (!So.TryDoc(Convert.ToString(cell.Value), out v))
                {
                    cell.Value = "";
                    Ui.Error(this, "Tỷ lệ phải là số, vd 18,23.");
                }
            };
            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var ok = Ui.MakeButton("Lưu", true);
            var cancel = Ui.MakeButton("Huỷ", false);
            cancel.DialogResult = DialogResult.Cancel;
            ok.Click += (s, e) =>
            {
                grid.EndEdit();
                for (int r = 0; r < dong.Count; r++)
                {
                    double? qt, ck;
                    So.TryDoc(Convert.ToString(grid.Rows[r].Cells[3].Value), out qt);
                    So.TryDoc(Convert.ToString(grid.Rows[r].Cells[5].Value), out ck);
                    SoSanhQuy ss = phien.Dl.LaySoSanhQuy(nam, quy, dong[r].Id, qt.HasValue || ck.HasValue);
                    if (ss != null)
                    {
                        ss.QuyTruoc = qt;
                        ss.CungKy = ck;
                    }
                }
                DialogResult = DialogResult.OK;
            };
            buttons.Controls.Add(cancel);
            buttons.Controls.Add(ok);
            var host = new Panel { Dock = DockStyle.Fill, Padding = Ui.Pad(12, 0, 12, 0) };
            host.Controls.Add(grid);
            Controls.Add(host);
            Controls.Add(note);
            Controls.Add(buttons);
            CancelButton = cancel;
        }
    }
}
