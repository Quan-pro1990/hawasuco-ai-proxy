using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ChinhAnhAI
{
    /// <summary>Chỉnh hàng loạt: mỗi ảnh được phân tích và chỉnh riêng (không áp một bộ thông số cho tất cả), lưu ra thư mục.</summary>
    class HangLoatForm : Form
    {
        readonly CaiDat cd;
        ListView ds;
        ComboBox cboPc;
        ThanhTruot ttCuongDo;
        CheckBox chkAI;
        TextBox txtThuMuc;
        Label lblTrangThai;
        ProgressBar thanh;
        Button btnChay, btnDung;
        CancellationTokenSource huy;
        string thuMucKetQua;

        public HangLoatForm(CaiDat cd, string[] tep)
        {
            this.cd = cd;
            Text = "Chỉnh hàng loạt — " + UngDung.Ten;
            BackColor = Ui.Khung;
            ForeColor = Ui.Chu;
            Font = Ui.Chuan;
            AutoScaleMode = AutoScaleMode.None;
            StartPosition = FormStartPosition.CenterParent;
            ClientSize = new Size(Ui.S(760), Ui.S(560));
            MinimumSize = new Size(Ui.S(600), Ui.S(440));
            AllowDrop = true;
            ShowInTaskbar = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }

            var tren = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, Padding = Ui.Pad(14, 12, 14, 6), BackColor = Ui.Khung };
            tren.Controls.Add(Ui.TaoNut("Thêm ảnh…", Ui.Khung2, (s, e) => ThemAnh()));
            tren.Controls.Add(Ui.TaoNut("Thêm thư mục…", Ui.Khung2, (s, e) => ThemThuMuc()));
            tren.Controls.Add(Ui.TaoNut("Xoá danh sách", Ui.Khung2, (s, e) => { if (huy == null) ds.Items.Clear(); CapNhatDem(); }));

            ds = new ListView { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, BackColor = Ui.Khung2, ForeColor = Ui.Chu, BorderStyle = BorderStyle.None, HeaderStyle = ColumnHeaderStyle.Nonclickable };
            ds.Columns.Add("Ảnh", Ui.S(300));
            ds.Columns.Add("Thư mục", Ui.S(220));
            ds.Columns.Add("Trạng thái", Ui.S(200));
            ds.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Delete && huy == null)
                    foreach (ListViewItem it in ds.SelectedItems.Cast<ListViewItem>().ToList()) ds.Items.Remove(it);
                CapNhatDem();
            };

            var tuyChon = new FlowLayoutPanel { Dock = DockStyle.Bottom, AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = Ui.Pad(14, 8, 14, 4), BackColor = Ui.Khung };
            var dong1 = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Ui.Khung };
            dong1.Controls.Add(new Label { Text = "Phong cách:", AutoSize = true, ForeColor = Ui.ChuMo, Margin = Ui.Pad(0, 6, 6, 0) });
            cboPc = new ComboBox { Width = Ui.S(170), DropDownStyle = ComboBoxStyle.DropDownList, BackColor = Ui.Khung2, ForeColor = Ui.Chu, FlatStyle = FlatStyle.Flat, Margin = Ui.Pad(0, 2, 16, 0) };
            foreach (PhongCach p in PhongCach.DanhSach) cboPc.Items.Add(p.Ten);
            int ip = Array.FindIndex(PhongCach.DanhSach, p => p.Ma == cd.PhongCach);
            cboPc.SelectedIndex = ip < 0 ? 0 : ip;
            dong1.Controls.Add(cboPc);
            ttCuongDo = new ThanhTruot { Ten = "Cường độ", Min = 0, Max = 150, Width = Ui.S(220), BackColor = Ui.Khung, DinhDang = v => v.ToString("0") + "%" };
            ttCuongDo.GiaTri = cd.CuongDo;
            dong1.Controls.Add(ttCuongDo);
            chkAI = new CheckBox { Text = "Nhờ AI Claude chỉnh từng ảnh", AutoSize = true, ForeColor = Ui.Chu, Checked = cd.DungAI && cd.KeyDung.Length > 0, Enabled = cd.KeyDung.Length > 0, Margin = Ui.Pad(16, 6, 0, 0) };
            dong1.Controls.Add(chkAI);
            tuyChon.Controls.Add(dong1);

            var dong2 = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Ui.Khung, Margin = Ui.Pad(0, 6, 0, 0) };
            dong2.Controls.Add(new Label { Text = "Lưu vào:", AutoSize = true, ForeColor = Ui.ChuMo, Margin = Ui.Pad(0, 6, 6, 0) });
            txtThuMuc = new TextBox { Width = Ui.S(470), BackColor = Ui.Khung2, ForeColor = Ui.Chu, BorderStyle = BorderStyle.FixedSingle, Text = cd.ThuMucLuu, Margin = Ui.Pad(0, 3, 6, 0) };
            dong2.Controls.Add(txtThuMuc);
            dong2.Controls.Add(Ui.TaoNut("Chọn…", Ui.Khung2, (s, e) =>
            {
                using (var f = new FolderBrowserDialog { Description = "Thư mục lưu ảnh đã chỉnh", SelectedPath = txtThuMuc.Text })
                    if (f.ShowDialog(this) == DialogResult.OK) txtThuMuc.Text = f.SelectedPath;
            }));
            tuyChon.Controls.Add(dong2);
            tuyChon.Controls.Add(new Label
            {
                Text = "Để trống: lưu vào thư mục con \"Da chinh AI\" cạnh từng ảnh. Tên tệp thêm \"" + cd.HauTo + "\", chất lượng JPEG " + cd.ChatLuongJpeg +
                       (cd.CanhDaiXuat > 0 ? ", cạnh dài " + cd.CanhDaiXuat + " điểm" : ", giữ cỡ gốc") + " (đổi ở Cài đặt).",
                AutoSize = true, ForeColor = Ui.ChuMo, Font = Ui.Nho, Margin = Ui.Pad(0, 4, 0, 4)
            });

            var duoi = new Panel { Dock = DockStyle.Bottom, Height = Ui.S(52), Padding = Ui.Pad(14, 0, 8, 0), BackColor = Ui.Khung2 };
            var nutDuoi = new FlowLayoutPanel { Dock = DockStyle.Right, AutoSize = true, WrapContents = false, FlowDirection = FlowDirection.RightToLeft,
                                                BackColor = Ui.Khung2, Padding = Ui.Pad(0, 10, 0, 0) };
            btnChay = Ui.TaoNut("Bắt đầu chỉnh", Ui.Nhan, (s, e) => Chay());
            btnDung = Ui.TaoNut("Dừng", Ui.Khung, (s, e) => { if (huy != null) huy.Cancel(); });
            btnDung.Enabled = false;
            var lnk = new LinkLabel { Text = "Mở thư mục kết quả", AutoSize = true, LinkColor = Ui.Nhan, ActiveLinkColor = Ui.Cam, Visible = false, Margin = Ui.Pad(0, 7, 12, 0), Name = "lnk" };
            lnk.LinkClicked += (s, e) => { if (thuMucKetQua != null) try { Process.Start("explorer.exe", "\"" + thuMucKetQua + "\""); } catch (Exception) { } };
            nutDuoi.Controls.Add(btnChay);
            nutDuoi.Controls.Add(btnDung);
            nutDuoi.Controls.Add(lnk);
            lblTrangThai = new Label { Dock = DockStyle.Fill, ForeColor = Ui.ChuMo, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
            duoi.Controls.Add(lblTrangThai);
            duoi.Controls.Add(nutDuoi);
            thanh = new ProgressBar { Dock = DockStyle.Bottom, Height = Ui.S(5) };

            Controls.Add(ds);
            Controls.Add(tuyChon);
            Controls.Add(thanh);
            Controls.Add(duoi);
            Controls.Add(tren);
            ds.BringToFront();

            DragEnter += (s, e) => { if (e.Data.GetDataPresent(DataFormats.FileDrop)) e.Effect = DragDropEffects.Copy; };
            DragDrop += (s, e) => Them((string[])e.Data.GetData(DataFormats.FileDrop));
            FormClosing += (s, e) =>
            {
                if (huy == null) return;
                if (MessageBox.Show(this, "Đang chỉnh dở. Dừng lại và đóng?", UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes) huy.Cancel();
                else e.Cancel = true;
            };

            if (tep != null) Them(tep);
            CapNhatDem();
        }

        void ThemAnh()
        {
            using (var f = new OpenFileDialog { Multiselect = true, Title = "Chọn các ảnh cần chỉnh",
                Filter = "Ảnh (*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.tiff)|*.jpg;*.jpeg;*.jpe;*.jfif;*.png;*.bmp;*.tif;*.tiff;*.gif|Tất cả (*.*)|*.*" })
                if (f.ShowDialog(this) == DialogResult.OK) Them(f.FileNames);
        }

        void ThemThuMuc()
        {
            using (var f = new FolderBrowserDialog { Description = "Chọn thư mục ảnh (lấy cả thư mục con)" })
                if (f.ShowDialog(this) == DialogResult.OK) Them(new[] { f.SelectedPath });
        }

        void Them(string[] tep)
        {
            if (huy != null) return;
            var co = new HashSet<string>(ds.Items.Cast<ListViewItem>().Select(i => (string)i.Tag), StringComparer.OrdinalIgnoreCase);
            ds.BeginUpdate();
            foreach (string t in tep)
            {
                IEnumerable<string> anh;
                if (Directory.Exists(t))
                {
                    try
                    {
                        anh = Directory.GetFiles(t, "*", SearchOption.AllDirectories).Where(AnhNguon.LaAnh)
                            .Where(x => !x.Contains(Path.DirectorySeparatorChar + "Da chinh AI" + Path.DirectorySeparatorChar))
                            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase);
                    }
                    catch (Exception) { continue; }
                }
                else anh = AnhNguon.LaAnh(t) && File.Exists(t) ? new[] { t } : new string[0];
                foreach (string a in anh)
                {
                    if (!co.Add(a)) continue;
                    var it = new ListViewItem(new[] { Path.GetFileName(a), Path.GetDirectoryName(a), "Chờ" }) { Tag = a };
                    ds.Items.Add(it);
                }
            }
            ds.EndUpdate();
            CapNhatDem();
        }

        void CapNhatDem()
        {
            if (huy == null) lblTrangThai.Text = ds.Items.Count == 0 ? "Thêm ảnh, thư mục, hoặc kéo thả vào đây." : ds.Items.Count + " ảnh trong danh sách.";
        }

        string NoiLuu(string anh)
        {
            string tm = txtThuMuc.Text.Trim();
            var c = new CaiDat { ThuMucLuu = tm.Length > 0 ? tm : Path.Combine(Path.GetDirectoryName(anh), "Da chinh AI"), HauTo = cd.HauTo };
            return c.DuongDanLuu(anh);
        }

        async void Chay()
        {
            var viec = ds.Items.Cast<ListViewItem>().ToList();
            if (viec.Count == 0) { ThemAnh(); return; }
            if (huy != null) return;
            huy = new CancellationTokenSource();
            CancellationToken ct = huy.Token;
            string ma = PhongCach.DanhSach[Math.Max(0, cboPc.SelectedIndex)].Ma;
            double cuong = ttCuongDo.GiaTri / 100;
            bool dungAI = chkAI.Checked && cd.KeyDung.Length > 0;
            int q = cd.ChatLuongJpeg, canh = cd.CanhDaiXuat;
            btnChay.Enabled = false;
            btnDung.Enabled = true;
            thanh.Maximum = viec.Count;
            thanh.Value = 0;
            int xong = 0, loi = 0;
            var sw = Stopwatch.StartNew();
            foreach (ListViewItem it in viec)
            {
                if (ct.IsCancellationRequested) break;
                string anh = (string)it.Tag, dich = NoiLuu(anh);
                it.SubItems[2].Text = "Đang chỉnh…";
                it.EnsureVisible();
                lblTrangThai.Text = "Đang chỉnh " + (xong + loi + 1) + " / " + viec.Count + ": " + Path.GetFileName(anh);
                string ghiChu = null;
                try
                {
                    ghiChu = await Task.Run(() => MotAnh(anh, dich, ma, cuong, dungAI, q, canh, ct));
                    it.SubItems[2].Text = "Xong" + (ghiChu != null ? " (" + ghiChu + ")" : "");
                    it.ForeColor = ghiChu == null ? Ui.Xanh : Color.Khaki;
                    thuMucKetQua = Path.GetDirectoryName(dich);
                    xong++;
                }
                catch (OperationCanceledException)
                {
                    it.SubItems[2].Text = "Đã dừng";
                    break;
                }
                catch (Exception ex)
                {
                    it.SubItems[2].Text = "Lỗi: " + ex.Message;
                    it.ForeColor = Ui.Do;
                    loi++;
                }
                thanh.Value = Math.Min(thanh.Maximum, xong + loi);
                GC.Collect();
            }
            lblTrangThai.Text = "Đã chỉnh " + xong + " ảnh" + (loi > 0 ? ", lỗi " + loi : "") + " trong " + Math.Round(sw.Elapsed.TotalSeconds) + " giây.";
            Control[] l = Controls.Find("lnk", true);
            if (l.Length > 0) l[0].Visible = thuMucKetQua != null;
            btnChay.Enabled = true;
            btnDung.Enabled = false;
            huy = null;
        }

        /// <summary>Chỉnh một ảnh. Trả ghi chú (vd AI lỗi nên dùng phân tích trên máy) hoặc null.</summary>
        string MotAnh(string anh, string dich, string ma, double cuong, bool dungAI, int q, int canh, CancellationToken ct)
        {
            AnhNguon g = AnhNguon.Mo(anh);
            AnhNguon xem = g.ThuNho(1600);
            KetQuaPhanTich pt = PhanTich.Chay(g, xem);
            ct.ThrowIfCancellationRequested();
            ThongSo p = PhongCach.Ap(pt, ma);
            string ghiChu = null;
            if (dungAI)
            {
                try { p = AiClaude.Hoi(cd, xem, pt, p, PhongCach.Tim(ma), cd.YeuCauAI, ct).ThongSo; }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex) { ghiChu = "AI lỗi, đã chỉnh trên máy: " + ex.Message.Split('\n')[0]; }
            }
            p = p.NhanCuongDo(cuong);
            ct.ThrowIfCancellationRequested();
            AnhNguon src = canh > 0 ? g.ThuNho(canh) : g;
            byte[] kq = XuLyAnh.Ve(src, p, ct);
            Directory.CreateDirectory(Path.GetDirectoryName(dich));
            AnhNguon.Luu(kq, src.W, src.H, dich, q, src.Exif);
            return ghiChu;
        }
    }
}
