using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Khung bên phải trang nhập: cách tính của dòng đang chọn và các ô ít dùng —
    /// thay / reset đồng hồ, điều chỉnh, ghi đè sản lượng, số cùng kỳ / tháng trước / lũy kế nhập tay, ghi chú.
    /// </summary>
    class ChiTietPanel : Panel
    {
        class OSo
        {
            public Panel Khung;
            public Label Nhan;
            public TextBox Hop;
            public Func<Muc, double?> Lay;
            public Action<Muc, double?> Dat;
            public Func<Muc, KetQua, string> GoiY;
            public Func<Muc, bool> Hien;
        }

        readonly PhienLam phien;
        readonly FlowLayoutPanel flow;
        readonly Label lblTen, lblLoai, lblCachTinh, lblSaiSo, lblHuongDan;
        readonly Panel boxCachTinh;
        readonly CheckBox chkThay, chkGhiDe;
        readonly Label secDongHo, secDieuChinh, secSoSanh, secGhiChu;
        readonly List<OSo> fields = new List<OSo>();
        readonly TextBox txtGhiChu;
        readonly OSo fChot, fDau, fDieuChinh, fGhiDe, fCungKy, fCungKyLk, fThangTruoc, fLkTruoc, fLkCtTruoc;
        ThangBaoCao thang;
        Muc muc;
        bool dangNap;

        public event EventHandler DaSua;

        public ChiTietPanel(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Surface;
            Padding = new Padding(1);
            Paint += (s, e) => { using (var pen = new Pen(Ui.Border)) e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1); };
            flow = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoScroll = true,
                Padding = Ui.Pad(14, 12, 10, 12),
                BackColor = Ui.Surface
            };
            Controls.Add(flow);
            int w = Ui.S(300);

            lblTen = Ui.MakeLabel("", Ui.Section, Ui.Text);
            lblTen.MaximumSize = new Size(w, 0);
            flow.Controls.Add(lblTen);
            lblLoai = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblLoai.MaximumSize = new Size(w, 0);
            lblLoai.Margin = Ui.Pad(0, 4, 0, 8);
            flow.Controls.Add(lblLoai);

            boxCachTinh = new Panel { BackColor = Ui.Computed, Padding = Ui.Pad(8, 6, 8, 6), AutoSize = true, MaximumSize = new Size(w, 0), MinimumSize = new Size(w, 0) };
            lblCachTinh = Ui.MakeLabel("", Ui.Small, Ui.Text);
            lblCachTinh.MaximumSize = new Size(w - Ui.S(16), 0);
            boxCachTinh.Controls.Add(lblCachTinh);
            flow.Controls.Add(boxCachTinh);

            secDongHo = Section("Đồng hồ");
            lblSaiSo = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblSaiSo.MaximumSize = new Size(w, 0);
            flow.Controls.Add(lblSaiSo);
            chkThay = new CheckBox { Text = "Thay / reset đồng hồ trong kỳ", AutoSize = true, Font = Ui.Base, Margin = Ui.Pad(0, 2, 0, 2) };
            chkThay.CheckedChanged += (s, e) =>
            {
                if (dangNap || muc == null) return;
                if (!chkThay.Checked)
                {
                    muc.ChotCu = null;
                    muc.DauMoi = null;
                    BaoSua();
                }
                CapNhatHien();
                if (chkThay.Checked) fChot.Hop.Focus();
            };
            flow.Controls.Add(chkThay);
            fChot = Field("Chỉ số chốt đồng hồ cũ (lúc tháo / reset)", m => m.ChotCu, (m, v) => m.ChotCu = v, null, m => m.Loai == LoaiMuc.DongHo && chkThay.Checked);
            fDau = Field("Chỉ số đầu đồng hồ mới (lúc lắp)", m => m.DauMoi, (m, v) => m.DauMoi = v, (m, k) => "thường là 0", m => m.Loai == LoaiMuc.DongHo && chkThay.Checked);

            secDieuChinh = Section("Điều chỉnh sản lượng");
            fDieuChinh = Field("Cộng thêm (+) / trừ bớt (−) m³", m => m.DieuChinh == 0 ? (double?)null : m.DieuChinh, (m, v) => m.DieuChinh = v ?? 0,
                               (m, k) => "vd 14200 hoặc -500", m => m.Loai != LoaiMuc.NhapTay);
            chkGhiDe = new CheckBox { Text = "Nhập tay sản lượng (bỏ qua kết quả tính)", AutoSize = true, Font = Ui.Base, Margin = Ui.Pad(0, 6, 0, 2) };
            chkGhiDe.CheckedChanged += (s, e) =>
            {
                if (dangNap || muc == null) return;
                if (!chkGhiDe.Checked)
                {
                    muc.SanLuong = null;
                    BaoSua();
                }
                CapNhatHien();
                if (chkGhiDe.Checked) fGhiDe.Hop.Focus();
            };
            flow.Controls.Add(chkGhiDe);
            fGhiDe = Field("Sản lượng nhập tay (m³)", m => m.Loai == LoaiMuc.NhapTay ? null : m.SanLuong, (m, v) => m.SanLuong = v, null,
                           m => m.Loai != LoaiMuc.NhapTay && chkGhiDe.Checked);

            secSoSanh = Section("Số so sánh (để trống = tự tính)");
            fThangTruoc = Field("Tỷ lệ thất thoát tháng trước (%)", m => m.TyLeThangTruoc, (m, v) => m.TyLeThangTruoc = v,
                                (m, k) => k != null && k.ThangTruocTuDong ? "tự động: " + So.P2(k.TyLeThangTruoc) : "chưa có tháng trước", m => m.CoChuanThu);
            fCungKy = Field("Cùng kỳ năm trước — tháng (%)", m => m.CungKyThang, (m, v) => m.CungKyThang = v,
                            (m, k) => k != null && k.CungKyTuDong ? "tự động: " + So.P2(k.CungKy) : "chưa có số liệu năm trước", m => m.CoChuanThu);
            fCungKyLk = Field("Cùng kỳ năm trước — lũy kế (%)", m => m.CungKyLuyKe, (m, v) => m.CungKyLuyKe = v,
                              (m, k) => k != null && k.LkCungKyTuDong ? "tự động: " + So.P2(k.LkCungKy) : "chưa có số liệu năm trước", m => m.CoChuanThu);
            fLkTruoc = Field("Lũy kế phát ra các tháng trước (m³)", m => m.LuyKePhatRaTruoc, (m, v) => m.LuyKePhatRaTruoc = v,
                             (m, k) => k == null ? "" : "tự động: " + So.M3(k.LkPhatRa - (k.PhatRa ?? 0)), m => thang == null || thang.Thang != 1);
            fLkCtTruoc = Field("Lũy kế chuẩn thu các tháng trước (m³)", m => m.LuyKeChuanThuTruoc, (m, v) => m.LuyKeChuanThuTruoc = v,
                               (m, k) => k == null || !k.LkChuanThu.HasValue ? "" : "tự động: " + So.M3(k.LkChuanThu - (k.ChuanThu ?? 0)),
                               m => m.CoChuanThu && (thang == null || thang.Thang != 1));   // tháng 1: lũy kế luôn bắt đầu lại

            secGhiChu = Section("Ghi chú (in vào báo cáo)");
            txtGhiChu = new TextBox { Multiline = true, Font = Ui.Base, Width = w, Height = Ui.S(70), ScrollBars = ScrollBars.Vertical, Margin = Ui.Pad(0, 2, 0, 6) };
            txtGhiChu.Leave += (s, e) => GhiGhiChu();
            flow.Controls.Add(txtGhiChu);

            lblHuongDan = Ui.MakeLabel("Mọi thay đổi được lưu ngay. Ô \"so sánh\" và \"lũy kế\" chỉ cần nhập khi chưa có số liệu tháng trước / năm trước trong phần mềm.",
                                       Ui.Small, Ui.Muted);
            lblHuongDan.MaximumSize = new Size(w, 0);
            lblHuongDan.Margin = Ui.Pad(0, 6, 0, 0);
            flow.Controls.Add(lblHuongDan);
            Hien(null, null);
        }

        Label Section(string text)
        {
            var l = Ui.MakeLabel(text, Ui.BaseBold, Ui.Primary);
            l.Margin = Ui.Pad(0, 12, 0, 2);
            flow.Controls.Add(l);
            return l;
        }

        OSo Field(string label, Func<Muc, double?> lay, Action<Muc, double?> dat, Func<Muc, KetQua, string> goiY, Func<Muc, bool> hien)
        {
            var f = new OSo { Lay = lay, Dat = dat, GoiY = goiY, Hien = hien };
            f.Khung = new Panel { Width = Ui.S(300), Height = Ui.S(50), Margin = Ui.Pad(0, 2, 0, 2) };
            f.Nhan = Ui.MakeLabel(label, Ui.Small, Ui.Muted);
            f.Nhan.Location = new Point(0, 0);
            f.Hop = new TextBox { Font = Ui.Base, Width = Ui.S(170), Location = new Point(0, Ui.S(20)), TextAlign = HorizontalAlignment.Right };
            f.Hop.Leave += (s, e) => Ghi(f);
            f.Hop.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter)
                {
                    Ghi(f);
                    f.Hop.SelectAll();
                    e.SuppressKeyPress = true;
                }
                else if (e.KeyCode == Keys.Escape)
                {
                    NapO(f, phien.Bt.Tinh(thang)[muc.Id]);
                    e.SuppressKeyPress = true;
                }
            };
            f.Khung.Controls.Add(f.Nhan);
            f.Khung.Controls.Add(f.Hop);
            flow.Controls.Add(f.Khung);
            fields.Add(f);
            return f;
        }

        void Ghi(OSo f)
        {
            if (dangNap || muc == null) return;
            double? v;
            if (!So.TryDoc(f.Hop.Text, out v))
            {
                f.Hop.BackColor = Color.FromArgb(0xFD, 0xE2, 0xE2);
                return;
            }
            f.Hop.BackColor = SystemColors.Window;
            if (Nullable.Equals(f.Lay(muc), v)) return;
            f.Dat(muc, v);
            BaoSua();
        }

        void GhiGhiChu()
        {
            if (dangNap || muc == null) return;
            string g = txtGhiChu.Text.Replace("\r", "").Trim('\n');
            if (g == (muc.GhiChu ?? "").Replace("\r", "")) return;
            muc.GhiChu = g;
            BaoSua();
        }

        void BaoSua()
        {
            EventHandler h = DaSua;
            if (h != null) h(this, EventArgs.Empty);
        }

        /// <summary>Ghi ô đang gõ dở (khi chuyển trang / đóng phần mềm).</summary>
        public void GhiNhan()
        {
            foreach (OSo f in fields) if (f.Hop.Focused) Ghi(f);
            if (txtGhiChu.Focused) GhiGhiChu();
        }

        void NapO(OSo f, KetQua k)
        {
            f.Hop.Text = muc == null ? "" : So.Nhap(f.Lay(muc));
            f.Hop.BackColor = SystemColors.Window;
            Ui.SetCue(f.Hop, f.GoiY != null && muc != null ? f.GoiY(muc, k) : "");
        }

        public void Hien(ThangBaoCao t, Muc m)
        {
            if (muc != null && (m != muc || t != thang)) GhiNhan();
            dangNap = true;
            try
            {
                thang = t;
                muc = m;
                KetQua k = m != null && t != null ? phien.Bt.Tinh(t)[m.Id] : null;
                if (m == null || k == null)
                {
                    lblTen.Text = "Chọn 1 dòng để xem cách tính";
                    lblLoai.Text = "";
                    lblCachTinh.Text = "";
                    flow.SuspendLayout();
                    foreach (Control c in flow.Controls) c.Visible = c == lblTen;
                    flow.ResumeLayout();
                    return;
                }
                lblTen.Text = (m.Stt.Length > 0 ? m.Stt + "  " : "") + m.TenMotDong;
                string loai;
                if (m.Loai == LoaiMuc.DongHo) loai = "Đồng hồ (TLK): sản lượng = chỉ số hiện tại − chỉ số tháng trước";
                else if (m.Loai == LoaiMuc.NhapTay) loai = "Nhập trực tiếp số m³";
                else loai = "Công thức: " + CongThucText.HienThi(t, m, m.CongThuc) + (m.LamTron ? " (làm tròn)" : "");
                if (m.ChuanThuLoai == LoaiChuanThu.Nhap) loai += "\nChuẩn thu: nhập số";
                else if (m.ChuanThuLoai == LoaiChuanThu.CongThuc) loai += "\nChuẩn thu = " + CongThucText.HienThi(t, m, m.CongThucChuanThu);
                lblLoai.Text = loai;
                var lines = new List<string>();
                if (k.Loi != null) lines.Add("⚠ " + k.Loi);
                lines.Add("Sản lượng: " + (k.CachTinh.Length > 0 ? k.CachTinh : So.M3(k.PhatRa)));
                if (m.CoChuanThu)
                {
                    lines.Add("Chuẩn thu: " + (k.ChuanThu.HasValue ? So.M3(k.ChuanThu) + " m³" : "chưa có"));
                    if (k.TyLe.HasValue)
                        lines.Add("Thất thoát: " + So.M3(k.ThatThoat) + " m³ = " + So.P2(k.TyLe) + "%" +
                                  (k.KeHoach.HasValue ? "  (KH " + So.P2(k.KeHoach) + "%, " + So.Lech(k.SoKeHoach) + ")" : ""));
                    if (k.LkTyLe.HasValue) lines.Add("Lũy kế: " + So.M3(k.LkPhatRa) + " − " + So.M3(k.LkChuanThu) + " → " + So.P2(k.LkTyLe) + "%");
                }
                else lines.Add("Lũy kế phát ra: " + So.M3(k.LkPhatRa) + " m³");
                lblCachTinh.Text = string.Join("\n", lines);
                lblSaiSo.Text = m.SaiSo != 0 ? "Sai số TLK " + (m.SaiSo > 0 ? "+" : "") + So.P2(m.SaiSo) + "% (sửa ở Cấu trúc mạng lưới)" : "";
                chkThay.Checked = m.ThayDongHo;
                chkGhiDe.Checked = m.GhiDe;
                foreach (OSo f in fields) NapO(f, k);
                txtGhiChu.Text = (m.GhiChu ?? "").Replace("\r", "").Replace("\n", "\r\n");
                CapNhatHien();
            }
            finally
            {
                dangNap = false;
            }
        }

        void CapNhatHien()
        {
            Muc m = muc;
            if (m == null) return;
            flow.SuspendLayout();
            foreach (Control c in flow.Controls) c.Visible = true;
            bool dongHo = m.Loai == LoaiMuc.DongHo;
            secDongHo.Visible = dongHo;
            chkThay.Visible = dongHo;
            lblSaiSo.Visible = dongHo && m.SaiSo != 0;
            secDieuChinh.Visible = m.Loai != LoaiMuc.NhapTay;
            chkGhiDe.Visible = m.Loai != LoaiMuc.NhapTay;
            foreach (OSo f in fields) f.Khung.Visible = f.Hien(m);
            secSoSanh.Visible = true;
            secSoSanh.Text = m.CoChuanThu ? "Số so sánh (để trống = tự tính)" : "Lũy kế (để trống = tự tính)";
            flow.ResumeLayout();
        }
    }
}
