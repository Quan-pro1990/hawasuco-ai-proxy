using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Sửa / thêm 1 dòng cấu trúc: STT, tên, loại, công thức, chuẩn thu, vai trò, kế hoạch.</summary>
    class MucForm : Form
    {
        readonly PhienLam phien;
        readonly ThangBaoCao thang;
        readonly Muc muc;
        readonly TextBox txtStt, txtTen, txtTenNgan, txtCongThuc, txtMoTa, txtSaiSo, txtCtCongThuc, txtKeHoach;
        readonly NumericUpDown numCap;
        readonly RadioButton rDongHo, rNhapTay, rCongThuc, rCtKhong, rCtNhap, rCtCongThuc;
        readonly CheckBox chkLamTron, chkAn;
        readonly ComboBox cboVaiTro;
        readonly Label lblKtCongThuc, lblKtChuanThu;
        readonly TableLayoutPanel tbl;
        readonly Control rowCongThuc, rowMoTa, rowSaiSo, rowCtCongThuc;

        public MucForm(PhienLam phien, ThangBaoCao thang, Muc muc, bool moi)
        {
            this.phien = phien;
            this.thang = thang;
            this.muc = muc;
            Text = (moi ? "Thêm dòng" : "Sửa dòng") + " — cấu trúc " + thang.Ten.ToLower();
            Font = Ui.Base;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(800), Ui.S(700));
            BackColor = Ui.Surface;

            tbl = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = Ui.Pad(18, 12, 18, 6), ColumnCount = 2, AutoScroll = true };
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(190)));
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(tbl);

            txtStt = Ui.MakeText(110);
            txtStt.Text = muc.Stt;
            numCap = new NumericUpDown { Minimum = 0, Maximum = 5, Width = Ui.S(60), Font = Ui.Base, Value = Math.Min(5, Math.Max(0, muc.Cap)) };
            Row("STT", Line(txtStt, Ui.MakeLabel("Cấp", Ui.Base, Ui.Text), numCap,
                            Hint("cấp 0 = nhóm lớn in đậm (A, B, I, II…)")));
            txtTen = new TextBox { Font = Ui.Base, Width = Ui.S(560) };
            txtTen.Text = muc.TenMotDong;
            Row("Tên", txtTen);

            rDongHo = Radio("Đồng hồ (TLK)", muc.Loai == LoaiMuc.DongHo);
            rNhapTay = Radio("Nhập trực tiếp m³ (vd súc xả)", muc.Loai == LoaiMuc.NhapTay);
            rCongThuc = Radio("Cộng / trừ các dòng khác", muc.Loai == LoaiMuc.CongThuc);
            Row("Sản lượng phát ra", Group(rDongHo, rNhapTay, rCongThuc));

            txtCongThuc = new TextBox { Font = Ui.Base, Width = Ui.S(400) };
            txtCongThuc.Text = muc.Loai == LoaiMuc.CongThuc ? CongThucText.HienThi(thang, muc, muc.CongThuc) : "";
            chkLamTron = new CheckBox { Text = "Làm tròn số nguyên", AutoSize = true, Checked = muc.LamTron };
            lblKtCongThuc = Hint("");
            lblKtCongThuc.MaximumSize = new Size(Ui.S(560), 0);
            var ctBox = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, Margin = new Padding(0) };
            ctBox.Controls.Add(Line(txtCongThuc, chkLamTron));
            ctBox.Controls.Add(Hint("Ghi STT các dòng với dấu + / −, vd: 1 + 2 - 3   hoặc   A1 - A1.1 - A1.2 + A2. Dòng nhóm khác trùng STT: ghi kèm nhóm, vd V.1.2"));
            ctBox.Controls.Add(lblKtCongThuc);
            rowCongThuc = Row("Công thức", ctBox);
            txtMoTa = new TextBox { Font = Ui.Base, Width = Ui.S(400) };
            txtMoTa.Text = muc.MoTa ?? "";
            Ui.SetCue(txtMoTa, "để trống = tự ghi theo công thức");
            rowMoTa = Row("Chữ in ở cột chỉ số", Line(txtMoTa));
            txtSaiSo = Ui.MakeText(90);
            txtSaiSo.Text = muc.SaiSo == 0 ? "" : So.Nhap(muc.SaiSo);
            rowSaiSo = Row("Sai số TLK (%)", Line(txtSaiSo, Hint("TLK chạy nhanh +x% / chậm −x%: sản lượng = (mới − cũ) × 100 / (100 + x). Để trống nếu không có.")));

            rCtKhong = Radio("Không tính thất thoát", muc.ChuanThuLoai == LoaiChuanThu.Khong);
            rCtNhap = Radio("Nhập số chuẩn thu", muc.ChuanThuLoai == LoaiChuanThu.Nhap);
            rCtCongThuc = Radio("Cộng chuẩn thu các dòng", muc.ChuanThuLoai == LoaiChuanThu.CongThuc);
            Row("Chuẩn thu / thất thoát", Group(rCtKhong, rCtNhap, rCtCongThuc));
            txtCtCongThuc = new TextBox { Font = Ui.Base, Width = Ui.S(400) };
            txtCtCongThuc.Text = muc.ChuanThuLoai == LoaiChuanThu.CongThuc ? CongThucText.HienThi(thang, muc, muc.CongThucChuanThu) : "";
            lblKtChuanThu = Hint("");
            var ctB = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, Margin = new Padding(0) };
            ctB.Controls.Add(txtCtCongThuc);
            ctB.Controls.Add(lblKtChuanThu);
            rowCtCongThuc = Row("Chuẩn thu = ", ctB);

            cboVaiTro = Ui.MakeCombo(160);
            cboVaiTro.Items.AddRange(new object[] { "(không)", "Đội", "Khu vực", "Toàn công ty", "DMA" });
            cboVaiTro.SelectedIndex = (int)muc.VaiTro;
            txtTenNgan = Ui.MakeText(220);
            txtTenNgan.Text = muc.TenNgan;
            Ui.SetCue(txtTenNgan, "tên ngắn, vd KV. Long Mỹ");
            Row("Bảng tổng hợp", Line(cboVaiTro, txtTenNgan));
            txtKeHoach = Ui.MakeText(90);
            txtKeHoach.Text = So.Nhap(phien.Dl.LayKeHoach(thang.Nam, muc.Id));
            Row("Kế hoạch năm " + thang.Nam + " (%)", Line(txtKeHoach, Hint("tỷ lệ thất thoát kế hoạch (thường đặt cho đội và toàn công ty)")));
            chkAn = new CheckBox { Text = "Không in trong báo cáo tháng (chỉ hiện trong bảng tổng hợp, vd DMA)", AutoSize = true, Checked = muc.AnBaoCaoThang };
            Row("", chkAn);

            foreach (RadioButton r in new[] { rDongHo, rNhapTay, rCongThuc, rCtKhong, rCtNhap, rCtCongThuc }) r.CheckedChanged += (s, e) => CapNhatHien();
            txtCongThuc.TextChanged += (s, e) => KiemTraCongThuc();
            txtCtCongThuc.TextChanged += (s, e) => KiemTraCongThuc();
            txtStt.TextChanged += (s, e) => KiemTraCongThuc();

            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var ok = Ui.MakeButton("Lưu", true);
            var cancel = Ui.MakeButton("Huỷ", false);
            cancel.DialogResult = DialogResult.Cancel;
            ok.Click += (s, e) => Luu();
            buttons.Controls.Add(cancel);
            buttons.Controls.Add(ok);
            Controls.Add(buttons);
            CancelButton = cancel;
            CapNhatHien();
            KiemTraCongThuc();
        }

        static Label Hint(string text)
        {
            var l = Ui.MakeLabel(text, Ui.Small, Ui.Muted);
            l.MaximumSize = new Size(Ui.S(560), 0);
            l.Margin = Ui.Pad(0, 4, 0, 0);
            return l;
        }

        static RadioButton Radio(string text, bool check)
        {
            return new RadioButton { Text = text, AutoSize = true, Checked = check, Font = Ui.Base, Margin = Ui.Pad(0, 2, 14, 2) };
        }

        static Control Group(params RadioButton[] items)
        {
            var p = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            foreach (RadioButton r in items) p.Controls.Add(r);
            return p;
        }

        static Control Line(params Control[] items)
        {
            var p = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            foreach (Control c in items)
            {
                c.Margin = Ui.Pad(0, 3, 10, 0);
                p.Controls.Add(c);
            }
            return p;
        }

        Control Row(string label, Control c)
        {
            int r = tbl.RowCount++;
            tbl.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Ui.MakeLabel(label, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 8, 6);
            tbl.Controls.Add(l, 0, r);
            c.Margin = Ui.Pad(0, 4, 0, 8);
            tbl.Controls.Add(c, 1, r);
            l.Tag = c;
            return l;
        }

        void Hien(Control rowLabel, bool v)
        {
            rowLabel.Visible = v;
            ((Control)rowLabel.Tag).Visible = v;
        }

        void CapNhatHien()
        {
            tbl.SuspendLayout();
            Hien(rowCongThuc, rCongThuc.Checked);
            Hien(rowMoTa, rCongThuc.Checked);
            Hien(rowSaiSo, rDongHo.Checked);
            Hien(rowCtCongThuc, rCtCongThuc.Checked);
            tbl.ResumeLayout();
            KiemTraCongThuc();
        }

        /// <summary>Đọc thử công thức với STT / cấp đang gõ (tạm gán rồi trả lại).</summary>
        bool DocThu(string text, out List<SoHang> terms, out string loi)
        {
            string stt = muc.Stt;
            int cap = muc.Cap;
            muc.Stt = txtStt.Text.Trim();
            muc.Cap = (int)numCap.Value;
            try
            {
                return CongThucText.Doc(thang, muc, text, out terms, out loi);
            }
            finally
            {
                muc.Stt = stt;
                muc.Cap = cap;
            }
        }

        void KiemTraCongThuc()
        {
            List<SoHang> terms;
            string loi;
            if (rCongThuc.Checked)
            {
                bool ok = DocThu(txtCongThuc.Text, out terms, out loi);
                lblKtCongThuc.ForeColor = ok ? Ui.Success : Ui.Danger;
                lblKtCongThuc.Text = ok ? "✓ " + string.Join("  ", terms.Select(t => (t.HeSo < 0 ? "− " : "+ ") + thang.Tim(t.Id).ToString())) : "✗ " + loi;
            }
            if (rCtCongThuc.Checked)
            {
                bool ok = DocThu(txtCtCongThuc.Text, out terms, out loi);
                lblKtChuanThu.ForeColor = ok ? Ui.Success : Ui.Danger;
                lblKtChuanThu.Text = ok ? "✓ " + string.Join("  ", terms.Select(t => (t.HeSo < 0 ? "− " : "+ ") + thang.Tim(t.Id).ToString())) : "✗ " + loi;
            }
        }

        void Luu()
        {
            if (txtTen.Text.Trim().Length == 0)
            {
                Ui.Error(this, "Chưa nhập tên.");
                return;
            }
            double? saiSo = null, keHoach;
            if (rDongHo.Checked && !So.TryDoc(txtSaiSo.Text, out saiSo)) { Ui.Error(this, "Sai số không hợp lệ."); return; }
            if (!So.TryDoc(txtKeHoach.Text, out keHoach)) { Ui.Error(this, "Kế hoạch không hợp lệ."); return; }
            if (saiSo.HasValue && saiSo <= -100) { Ui.Error(this, "Sai số phải lớn hơn −100%."); return; }

            Muc goc = muc.Chep();
            List<SoHang> ct = null, ctCt = null;
            string loi;
            if (rCongThuc.Checked && !DocThu(txtCongThuc.Text, out ct, out loi)) { Ui.Error(this, "Công thức sản lượng: " + loi); return; }
            if (rCtCongThuc.Checked && !DocThu(txtCtCongThuc.Text, out ctCt, out loi)) { Ui.Error(this, "Công thức chuẩn thu: " + loi); return; }

            LoaiMuc loaiCu = muc.Loai;
            muc.Stt = txtStt.Text.Trim();
            muc.Ten = txtTen.Text.Trim();
            muc.Cap = (int)numCap.Value;
            muc.Loai = rDongHo.Checked ? LoaiMuc.DongHo : rNhapTay.Checked ? LoaiMuc.NhapTay : LoaiMuc.CongThuc;
            string cuText = goc.Loai == LoaiMuc.CongThuc ? CongThucText.HienThi(thang, goc, goc.CongThuc) : "";
            muc.CongThuc = ct ?? new List<SoHang>();
            muc.LamTron = muc.Loai == LoaiMuc.CongThuc && chkLamTron.Checked;
            string moTa = txtMoTa.Text.Trim();
            bool ctDoi = txtCongThuc.Text.Trim() != cuText;
            if (muc.Loai != LoaiMuc.CongThuc) muc.MoTa = null;
            else if (ctDoi && moTa == (goc.MoTa ?? "")) muc.MoTa = null;   // đổi công thức mà không sửa chữ in → tự ghi theo công thức mới
            else if (moTa.Length > 0) muc.MoTa = moTa;
            else muc.MoTa = goc.MoTa == "" && !ctDoi ? "" : null;
            muc.SaiSo = muc.Loai == LoaiMuc.DongHo ? saiSo ?? 0 : 0;
            muc.ChuanThuLoai = rCtKhong.Checked ? LoaiChuanThu.Khong : rCtNhap.Checked ? LoaiChuanThu.Nhap : LoaiChuanThu.CongThuc;
            muc.CongThucChuanThu = ctCt ?? new List<SoHang>();
            muc.VaiTro = (VaiTro)Math.Max(0, cboVaiTro.SelectedIndex);
            muc.TenNgan = txtTenNgan.Text.Trim();
            muc.AnBaoCaoThang = chkAn.Checked;
            if (loaiCu != muc.Loai)
            {
                // Đổi loại: bỏ số liệu không còn ý nghĩa.
                if (muc.Loai != LoaiMuc.DongHo) { muc.ChiSoCu = muc.ChiSoMoi = muc.ChotCu = muc.DauMoi = null; }
                muc.SanLuong = null;
            }
            if (!muc.CoChuanThu) muc.ChuanThu = null;

            phien.Bt.XoaBoNho();
            KetQua k = phien.Bt.Tinh(thang)[muc.Id];
            if (k != null && k.Loi != null && k.Loi.StartsWith("Vòng lặp"))
            {
                KhoiPhuc(goc);
                Ui.Error(this, "Công thức tạo vòng lặp (dòng này phụ thuộc vào chính nó qua dòng khác). Kiểm tra lại công thức.");
                return;
            }
            phien.Dl.DatKeHoach(thang.Nam, muc.Id, keHoach);
            DialogResult = DialogResult.OK;
        }

        void KhoiPhuc(Muc goc)
        {
            int i = thang.ViTri(muc.Id);
            Muc m = muc;
            m.Stt = goc.Stt; m.Ten = goc.Ten; m.TenNgan = goc.TenNgan; m.Cap = goc.Cap; m.Loai = goc.Loai; m.CongThuc = goc.CongThuc;
            m.LamTron = goc.LamTron; m.MoTa = goc.MoTa; m.SaiSo = goc.SaiSo; m.ChuanThuLoai = goc.ChuanThuLoai; m.CongThucChuanThu = goc.CongThucChuanThu;
            m.VaiTro = goc.VaiTro; m.AnBaoCaoThang = goc.AnBaoCaoThang; m.ChiSoCu = goc.ChiSoCu; m.ChiSoMoi = goc.ChiSoMoi; m.ChotCu = goc.ChotCu;
            m.DauMoi = goc.DauMoi; m.SanLuong = goc.SanLuong; m.ChuanThu = goc.ChuanThu;
            phien.Bt.XoaBoNho();
        }
    }
}
