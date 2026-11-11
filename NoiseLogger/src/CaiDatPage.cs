using System;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>Cài đặt: tên công ty, người ký in trên báo cáo; ngưỡng phân tích; dữ liệu và sao lưu.</summary>
    public class CaiDatPage : UserControl, ITrang
    {
        readonly PhienNl phien;
        readonly TextBox txtCty1, txtCty2, txtDiaDanh;
        readonly TextBox[,] txtKy = new TextBox[3, 3];
        readonly Label lblNguong, lblDuLieu;

        public CaiDatPage(PhienNl phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;
            Label sub;
            var header = Ui.PageHeader("Cài đặt", "Thông tin in trên báo cáo, ngưỡng phân tích tiếng ồn, dữ liệu và sao lưu.", out sub);
            var scroll = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true };

            // ---- thông tin in trên báo cáo
            TableLayoutPanel bang;
            Panel the1 = The("Thông tin in trên báo cáo", out bang);
            txtCty1 = O(320);
            txtCty2 = O(320);
            txtDiaDanh = O(200);
            Dong(bang, "Tên công ty (dòng 1)", txtCty1);
            Dong(bang, "Tên công ty (dòng 2)", txtCty2);
            Dong(bang, "Địa danh ghi ngày lập", Hang(txtDiaDanh, Ui.MakeLabel("vd TP. Cần Thơ → \"TP. Cần Thơ, ngày … tháng … năm …\"", Ui.Small, Ui.Muted)));
            string[] viTri = { "Người ký bên trái", "Người ký ở giữa", "Người lập (bên phải)" };
            for (int i = 0; i < 3; i++)
            {
                for (int j = 0; j < 3; j++) txtKy[i, j] = O(j == 2 ? 200 : 180);
                Ui.SetCue(txtKy[i, 0], "chức vụ, vd KT. GIÁM ĐỐC");
                Ui.SetCue(txtKy[i, 1], "dòng 2, vd PHÓ GIÁM ĐỐC");
                Ui.SetCue(txtKy[i, 2], "họ tên");
                Dong(bang, viTri[i], Hang(txtKy[i, 0], txtKy[i, 1], txtKy[i, 2]));
            }
            var bLuu = Ui.MakeButton("Lưu thông tin", true);
            bLuu.Click += (s, e) => LuuThongTin();
            Dong(bang, "", bLuu);
            scroll.Controls.Add(the1);

            // ---- ngưỡng
            Panel the2 = The("Phân tích tiếng ồn", out bang);
            lblNguong = Ui.MakeLabel("", Ui.Base, Ui.Text);
            lblNguong.MaximumSize = new Size(Ui.S(760), 0);
            Dong(bang, "Ngưỡng đang dùng", lblNguong);
            var bNguong = Ui.MakeButton("Sửa ngưỡng…", false);
            bNguong.Click += (s, e) =>
            {
                using (var f = new NguongNlForm(phien.Dl.Nguong))
                {
                    if (f.ShowDialog(FindForm()) != DialogResult.OK) return;
                    f.GhiVao();
                }
                phien.Luu(this);
                KhiHien();
            };
            Dong(bang, "", bNguong);
            scroll.Controls.Add(the2);

            // ---- dữ liệu
            Panel the3 = The("Dữ liệu và sao lưu", out bang);
            lblDuLieu = Ui.MakeLabel("", Ui.Base, Ui.Text);
            lblDuLieu.MaximumSize = new Size(Ui.S(760), 0);
            lblDuLieu.UseMnemonic = false;
            Dong(bang, "File dữ liệu", lblDuLieu);
            var bMo = Ui.MakeButton("Mở thư mục dữ liệu", false);
            bMo.Click += (s, e) =>
            {
                try { Process.Start(phien.Kho.ThuMuc); }
                catch (Exception ex) { Ui.Error(FindForm(), ex.Message); }
            };
            var bSaoLuu = Ui.MakeButton("Sao lưu ngay", false);
            bSaoLuu.Click += (s, e) =>
            {
                try { Ui.Info(FindForm(), "Đã sao lưu:\n" + phien.Kho.SaoLuuNgay()); }
                catch (Exception ex) { Ui.Error(FindForm(), "Không sao lưu được: " + ex.Message); }
            };
            Dong(bang, "", Hang(bMo, bSaoLuu));
            var gc = Ui.MakeLabel("Mỗi lần sửa đều tự lưu. Bản trước đó giữ ở noiselogger.xml.bak; mỗi ngày giữ 1 bản trong thư mục SaoLuu (90 ngày gần nhất). " +
                                  "Chép cả thư mục phần mềm sang máy khác là mang theo đủ dữ liệu.", Ui.Small, Ui.Muted);
            gc.MaximumSize = new Size(Ui.S(760), 0);
            Dong(bang, "", gc);
            var bLay = Ui.MakeButton("Lấy từ phần mềm Quản lý thất thoát nước…", false);
            bLay.Click += (s, e) => { DonViPage.LayTuThatThoat(this, phien); KhiHien(); };
            Dong(bang, "Phần mềm thất thoát", bLay);
            var gc2 = Ui.MakeLabel("Chọn file DuLieu\\thatthoat.xml: lấy danh sách đội / khu vực / vùng DMA, tên công ty, người ký. " +
                                   "Nếu file có số liệu Noise Logger nhập ở phần mềm thất thoát bản 1.1.0 (khi Noise Logger còn là 1 trang trong đó) " +
                                   "thì lấy luôn sang đây — chọn được cả bản sao lưu trong DuLieu\\SaoLuu.", Ui.Small, Ui.Muted);
            gc2.MaximumSize = new Size(Ui.S(760), 0);
            Dong(bang, "", gc2);
            scroll.Controls.Add(the3);

            Controls.Add(scroll);
            Controls.Add(header);
            phien.DaDoi += (s, e) => { if (Visible && s != this) KhiHien(); };
        }

        static TextBox O(int w)
        {
            return Ui.MakeText(w);
        }

        static Panel The(string tieuDe, out TableLayoutPanel bang)
        {
            var card = Ui.MakeCard();
            card.AutoSize = true;
            card.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            card.MinimumSize = new Size(Ui.S(1000), 0);
            card.Margin = Ui.Pad(0, 0, 0, 12);
            bang = new TableLayoutPanel { AutoSize = true, ColumnCount = 2, Location = new Point(Ui.S(16), Ui.S(12)), Margin = Ui.Pad(0, 0, 16, 14) };
            bang.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(190)));
            bang.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            var t = Ui.MakeLabel(tieuDe, Ui.Section, Ui.Text);
            t.Margin = Ui.Pad(0, 0, 0, 8);
            bang.Controls.Add(t, 0, 0);
            bang.SetColumnSpan(t, 2);
            bang.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            bang.RowCount = 1;
            card.Controls.Add(bang);
            return card;
        }

        static void Dong(TableLayoutPanel bang, string nhan, Control c)
        {
            int r = bang.RowCount++;
            bang.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Ui.MakeLabel(nhan, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 8, 6);
            bang.Controls.Add(l, 0, r);
            c.Margin = Ui.Pad(0, 4, 0, 6);
            bang.Controls.Add(c, 1, r);
        }

        static Control Hang(params Control[] items)
        {
            var p = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            foreach (Control c in items)
            {
                c.Margin = Ui.Pad(0, 3, 8, 0);
                p.Controls.Add(c);
            }
            return p;
        }

        public void KhiHien()
        {
            CaiDatNl cd = phien.Dl.CaiDat;
            txtCty1.Text = cd.TenCongTy1;
            txtCty2.Text = cd.TenCongTy2;
            txtDiaDanh.Text = cd.DiaDanh;
            for (int i = 0; i < 3; i++)
            {
                txtKy[i, 0].Text = cd.KyMacDinh[i].Dong1;
                txtKy[i, 1].Text = cd.KyMacDinh[i].Dong2;
                txtKy[i, 2].Text = cd.KyMacDinh[i].Ten;
            }
            NguongNl g = phien.Dl.Nguong;
            lblNguong.Text = "Nghi rò rỉ: mức ồn ≥ " + So.M3(g.RoRi) + " dB và độ trải ≤ " + So.M3(g.DoTrai) + " trong " + g.SoDem + " đêm liền. " +
                             "Cần theo dõi: mức ồn ≥ " + So.M3(g.TheoDoi) + " dB, hoặc tăng ≥ " + So.M3(g.Tang) + " dB so với mức nền.";
            lblDuLieu.Text = phien.Kho.DuongDan;
        }

        void LuuThongTin()
        {
            CaiDatNl cd = phien.Dl.CaiDat;
            cd.TenCongTy1 = VanBan.ChuanHoa(txtCty1.Text);
            cd.TenCongTy2 = VanBan.ChuanHoa(txtCty2.Text);
            cd.DiaDanh = VanBan.ChuanHoa(txtDiaDanh.Text);
            for (int i = 0; i < 3; i++)
                cd.KyMacDinh[i] = new NguoiKy(VanBan.ChuanHoa(txtKy[i, 0].Text), VanBan.ChuanHoa(txtKy[i, 1].Text), VanBan.ChuanHoa(txtKy[i, 2].Text));
            phien.Luu(this);
            Ui.Info(FindForm(), "Đã lưu. Thông tin này in ở đầu và cuối các báo cáo Excel / bản in.");
        }
    }
}
