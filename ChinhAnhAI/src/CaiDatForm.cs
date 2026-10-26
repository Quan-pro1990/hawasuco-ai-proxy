using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ChinhAnhAI
{
    /// <summary>Cài đặt: API key Claude, nơi lưu ảnh, chất lượng, lối tắt Windows.</summary>
    class CaiDatForm : Form
    {
        readonly CaiDat cd;
        TextBox txtKey, txtDiaChi, txtThuMuc, txtHauTo;
        ComboBox cboModel, cboCanh;
        CheckBox chkHienKey, chkDungAI, chkTuDong;
        NumericUpDown numChatLuong;
        Label lblKiemTra;

        static readonly int[] CacCanh = { 0, 4096, 3000, 2048, 1600, 1080 };

        public CaiDatForm(CaiDat cd)
        {
            this.cd = cd;
            Text = "Cài đặt — " + UngDung.Ten;
            BackColor = Ui.Khung;
            ForeColor = Ui.Chu;
            Font = Ui.Chuan;
            AutoScaleMode = AutoScaleMode.None;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            ClientSize = new Size(Ui.S(600), Ui.S(700));

            var cot = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, Padding = Ui.Pad(18, 12, 18, 8), BackColor = Ui.Khung };
            int rong = ClientSize.Width - Ui.S(56) - SystemInformation.VerticalScrollBarWidth;

            cot.Controls.Add(TieuDe("AI CLAUDE (KHÔNG BẮT BUỘC)"));
            cot.Controls.Add(Chu("Có API key, AI Claude nhìn ảnh để hiểu cảnh rồi chọn thông số như thợ hậu kỳ. Ảnh gửi đi là bản thu nhỏ 1280 điểm; ảnh gốc cỡ thật không rời khỏi máy. Chi phí API ước chừng 0,03–0,07 USD mỗi ảnh với claude-opus-5-5 (rẻ hơn nhiều với claude-haiku-5-5); xem giá chính xác ở trang Anthropic.", rong));
            var lnk = new LinkLabel { Text = "Lấy API key tại console.anthropic.com", AutoSize = true, LinkColor = Ui.Nhan, ActiveLinkColor = Ui.Cam, Margin = Ui.Pad(0, 2, 0, 8) };
            lnk.LinkClicked += (s, e) => { try { Process.Start("https://console.anthropic.com/settings/keys"); } catch (Exception) { } };
            cot.Controls.Add(lnk);

            cot.Controls.Add(Nhan("API key"));
            var dongKey = DongNgang();
            txtKey = O(cd.ApiKey, rong - Ui.S(80));
            txtKey.UseSystemPasswordChar = true;
            chkHienKey = new CheckBox { Text = "Hiện", AutoSize = true, ForeColor = Ui.Chu, Margin = Ui.Pad(8, 4, 0, 0) };
            chkHienKey.CheckedChanged += (s, e) => txtKey.UseSystemPasswordChar = !chkHienKey.Checked;
            dongKey.Controls.Add(txtKey);
            dongKey.Controls.Add(chkHienKey);
            cot.Controls.Add(dongKey);
            if (cd.ApiKey.Length == 0 && cd.KeyDung.Length > 0)
                cot.Controls.Add(Chu("Đang dùng key từ biến môi trường ANTHROPIC_API_KEY.", rong));

            cot.Controls.Add(Nhan("Model"));
            cboModel = new ComboBox { Width = rong, DropDownStyle = ComboBoxStyle.DropDown, BackColor = Ui.Khung2, ForeColor = Ui.Chu, FlatStyle = FlatStyle.Flat, Margin = Ui.Pad(0, 0, 0, 2) };
            cboModel.Items.AddRange(new object[] { "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5" });
            cboModel.Text = cd.Model;
            cot.Controls.Add(cboModel);
            cot.Controls.Add(Chu("claude-opus-5-5: chọn đẹp nhất (mặc định) · claude-sonnet-5-5: nhanh, rẻ hơn · claude-haiku-5-5: rẻ nhất.", rong));

            cot.Controls.Add(Nhan("Địa chỉ API"));
            txtDiaChi = O(cd.DiaChiApi, rong);
            cot.Controls.Add(txtDiaChi);
            cot.Controls.Add(Chu("Để mặc định " + AiClaude.DiaChiMacDinh + " trừ khi dùng máy chủ trung gian (proxy) riêng.", rong));

            chkDungAI = new CheckBox { Text = "Dùng AI Claude khi bấm Chỉnh tự động và khi mở ảnh", Checked = cd.DungAI, AutoSize = true, ForeColor = Ui.Chu, Margin = Ui.Pad(0, 6, 0, 4) };
            cot.Controls.Add(chkDungAI);
            var dongThu = DongNgang();
            dongThu.Controls.Add(Ui.TaoNut("Kiểm tra key", Ui.Khung2, (s, e) => KiemTraKey()));
            lblKiemTra = new Label { AutoSize = true, ForeColor = Ui.ChuMo, Margin = Ui.Pad(6, 6, 0, 0), MaximumSize = new Size(rong - Ui.S(130), 0) };
            dongThu.Controls.Add(lblKiemTra);
            cot.Controls.Add(dongThu);

            cot.Controls.Add(TieuDe("LƯU ẢNH"));
            cot.Controls.Add(Nhan("Thư mục lưu (để trống = cùng thư mục với ảnh gốc)"));
            var dongTm = DongNgang();
            txtThuMuc = O(cd.ThuMucLuu, rong - Ui.S(96));
            dongTm.Controls.Add(txtThuMuc);
            Button chon = Ui.TaoNut("Chọn…", Ui.Khung2, (s, e) => ChonThuMuc());
            chon.Margin = Ui.Pad(6, 0, 0, 0);
            dongTm.Controls.Add(chon);
            cot.Controls.Add(dongTm);

            var dongSo = DongNgang();
            var c1 = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, AutoSize = true, BackColor = Ui.Khung, Margin = Ui.Pad(0, 0, 16, 0) };
            c1.Controls.Add(Nhan("Thêm vào tên tệp"));
            txtHauTo = O(cd.HauTo, Ui.S(110));
            c1.Controls.Add(txtHauTo);
            var c2 = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, AutoSize = true, BackColor = Ui.Khung, Margin = Ui.Pad(0, 0, 16, 0) };
            c2.Controls.Add(Nhan("Chất lượng JPEG"));
            numChatLuong = new NumericUpDown { Minimum = 50, Maximum = 100, Value = cd.ChatLuongJpeg, Width = Ui.S(80), BackColor = Ui.Khung2, ForeColor = Ui.Chu };
            c2.Controls.Add(numChatLuong);
            var c3 = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, AutoSize = true, BackColor = Ui.Khung };
            c3.Controls.Add(Nhan("Cỡ ảnh lưu"));
            cboCanh = new ComboBox { Width = Ui.S(160), DropDownStyle = ComboBoxStyle.DropDownList, BackColor = Ui.Khung2, ForeColor = Ui.Chu, FlatStyle = FlatStyle.Flat };
            foreach (int c in CacCanh) cboCanh.Items.Add(c == 0 ? "Giữ cỡ gốc" : "Cạnh dài " + c + " điểm");
            int ic = Array.IndexOf(CacCanh, cd.CanhDaiXuat);
            cboCanh.SelectedIndex = ic < 0 ? 0 : ic;
            c3.Controls.Add(cboCanh);
            dongSo.Controls.Add(c1);
            dongSo.Controls.Add(c2);
            dongSo.Controls.Add(c3);
            cot.Controls.Add(dongSo);

            cot.Controls.Add(TieuDe("KHÁC"));
            chkTuDong = new CheckBox { Text = "Tự động chỉnh ngay khi mở ảnh (1 chạm)", Checked = cd.TuDongKhiMo, AutoSize = true, ForeColor = Ui.Chu, Margin = Ui.Pad(0, 0, 0, 6) };
            cot.Controls.Add(chkTuDong);
            var dongLt = DongNgang();
            dongLt.Controls.Add(Ui.TaoNut("Thêm vào menu chuột phải \"Gửi tới\"", Ui.Khung2, (s, e) => TaoLoiTat(Environment.GetFolderPath(Environment.SpecialFolder.SendTo), "menu Gửi tới (Send to)")));
            dongLt.Controls.Add(Ui.TaoNut("Lối tắt trên màn hình", Ui.Khung2, (s, e) => TaoLoiTat(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "màn hình Desktop")));
            cot.Controls.Add(dongLt);
            cot.Controls.Add(Chu("Sau khi thêm vào \"Gửi tới\": chọn một hoặc nhiều ảnh trong thư mục → chuột phải → Gửi tới → Chỉnh ảnh AI.", rong));

            var duoi = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(50), Padding = Ui.Pad(18, 9, 18, 0), BackColor = Ui.Khung2 };
            Button huy = Ui.TaoNut("Huỷ", Ui.Khung, (s, e) => { DialogResult = DialogResult.Cancel; Close(); });
            Button ok = Ui.TaoNut("Lưu cài đặt", Ui.Nhan, (s, e) => Luu());
            duoi.Controls.Add(huy);
            duoi.Controls.Add(ok);
            duoi.Controls.Add(new Label { Text = UngDung.Ten + " " + UngDung.PhienBan, AutoSize = true, ForeColor = Ui.ChuMo, Font = Ui.Nho, Margin = Ui.Pad(0, 8, 150, 0) });
            AcceptButton = ok;
            CancelButton = huy;

            Controls.Add(cot);
            Controls.Add(duoi);
        }

        static Label TieuDe(string chu)
        {
            return new Label { Text = chu, AutoSize = true, Font = Ui.NhoDam, ForeColor = Ui.Nhan, Margin = Ui.Pad(0, 12, 0, 4) };
        }

        static Label Nhan(string chu)
        {
            return new Label { Text = chu, AutoSize = true, ForeColor = Ui.ChuMo, Font = Ui.Nho, Margin = Ui.Pad(0, 6, 0, 2) };
        }

        static Label Chu(string chu, int rong)
        {
            return new Label { Text = chu, AutoSize = true, MaximumSize = new Size(rong, 0), ForeColor = Ui.ChuMo, Font = Ui.Nho, Margin = Ui.Pad(0, 2, 0, 2) };
        }

        static TextBox O(string chu, int rong)
        {
            return new TextBox { Text = chu ?? "", Width = rong, BackColor = Ui.Khung2, ForeColor = Ui.Chu, BorderStyle = BorderStyle.FixedSingle, Margin = Ui.Pad(0, 0, 0, 2) };
        }

        static FlowLayoutPanel DongNgang()
        {
            return new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Ui.Khung, Margin = Ui.Pad(0, 0, 0, 2) };
        }

        void ChonThuMuc()
        {
            using (var f = new FolderBrowserDialog { Description = "Chọn thư mục lưu ảnh đã chỉnh", SelectedPath = txtThuMuc.Text })
            {
                if (f.ShowDialog(this) == DialogResult.OK) txtThuMuc.Text = f.SelectedPath;
            }
        }

        void Luu()
        {
            cd.ApiKey = txtKey.Text.Trim();
            cd.Model = string.IsNullOrWhiteSpace(cboModel.Text) ? AiClaude.ModelMacDinh : cboModel.Text.Trim();
            cd.DiaChiApi = string.IsNullOrWhiteSpace(txtDiaChi.Text) ? AiClaude.DiaChiMacDinh : txtDiaChi.Text.Trim();
            cd.DungAI = chkDungAI.Checked && cd.KeyDung.Length > 0;
            cd.ThuMucLuu = txtThuMuc.Text.Trim();
            cd.HauTo = txtHauTo.Text.Trim();
            cd.ChatLuongJpeg = (int)numChatLuong.Value;
            cd.CanhDaiXuat = CacCanh[Math.Max(0, cboCanh.SelectedIndex)];
            cd.TuDongKhiMo = chkTuDong.Checked;
            if (cd.HauTo.Length == 0 && cd.ThuMucLuu.Length == 0) cd.HauTo = "_AI";   // không ghi đè ảnh gốc
            DialogResult = DialogResult.OK;
            Close();
        }

        /// <summary>Kiểm tra key bằng cách đọc thông tin model (GET /v1/models/…) — không tốn phí.</summary>
        async void KiemTraKey()
        {
            string key = txtKey.Text.Trim();
            if (key.Length == 0) key = (Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY") ?? "").Trim();
            string model = string.IsNullOrWhiteSpace(cboModel.Text) ? AiClaude.ModelMacDinh : cboModel.Text.Trim();
            string goc = string.IsNullOrWhiteSpace(txtDiaChi.Text) ? AiClaude.DiaChiMacDinh : txtDiaChi.Text.Trim().TrimEnd('/');
            if (key.Length == 0) { lblKiemTra.ForeColor = Ui.Do; lblKiemTra.Text = "Chưa nhập API key."; return; }
            lblKiemTra.ForeColor = Ui.ChuMo;
            lblKiemTra.Text = "Đang kiểm tra…";
            string kq = await Task.Run(() => AiClaude.KiemTra(goc, key, model));
            lblKiemTra.ForeColor = kq == null ? Ui.Xanh : Ui.Do;
            lblKiemTra.Text = kq ?? "Key dùng được với " + model + ".";
        }

        /// <summary>Tạo lối tắt .lnk tới phần mềm (qua WScript.Shell có sẵn trong Windows).</summary>
        void TaoLoiTat(string thuMuc, string noi)
        {
            try
            {
                string exe = Application.ExecutablePath;
                string lnk = Path.Combine(thuMuc, UngDung.Ten + ".lnk");
                Type t = Type.GetTypeFromProgID("WScript.Shell");
                object sh = Activator.CreateInstance(t);
                object l = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { lnk });
                Type lt = l.GetType();
                lt.InvokeMember("TargetPath", BindingFlags.SetProperty, null, l, new object[] { exe });
                lt.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, l, new object[] { Path.GetDirectoryName(exe) });
                lt.InvokeMember("IconLocation", BindingFlags.SetProperty, null, l, new object[] { exe + ",0" });
                lt.InvokeMember("Description", BindingFlags.SetProperty, null, l, new object[] { "Chỉnh ảnh tự động bằng AI" });
                lt.InvokeMember("Save", BindingFlags.InvokeMethod, null, l, null);
                Marshal.FinalReleaseComObject(l);
                Marshal.FinalReleaseComObject(sh);
                MessageBox.Show(this, "Đã thêm " + UngDung.Ten + " vào " + noi + ".", UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "Không tạo được lối tắt:\n" + ex.Message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}
