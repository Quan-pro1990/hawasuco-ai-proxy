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
    /// <summary>
    /// Cửa sổ chính. Mở ảnh là phần mềm tự phân tích và chỉnh ngay (1 chạm), bấm Lưu là xong.
    /// Thông số hiện tại = (phong cách đang chọn × cường độ) + phần người dùng tự kéo thanh.
    /// </summary>
    class MainForm : Form
    {
        const string GOC = "goc";

        readonly CaiDat cd;

        // ảnh đang mở
        AnhNguon goc, xem, nhoO;
        KetQuaPhanTich pt;
        KetQuaAI ai;
        string phongCach = "tu_dong";
        double cuongDo = 1;
        readonly double[] lech = new double[ThongSo.SoLuong];   // phần người dùng tự kéo thêm
        bool? denTrangTay;
        int soHieuAnh;                                          // tăng mỗi lần mở ảnh: kết quả chạy nền của ảnh cũ bị bỏ
        CancellationTokenSource huyAI;
        bool dangMo, dangVe, canVe, dangAI, dangLuu;
        long msVe;

        KhungAnh khung;
        VachBan vach;
        Label lblTrangThai, lblThongTin, lblAI;
        LinkLabel lnkThuMuc;
        Panel phai;
        FlowLayoutPanel cot, luoiPc, pnlTinhChinh;
        ThanhTruot ttCuongDo;
        readonly ThanhTruot[] tt = new ThanhTruot[ThongSo.SoLuong];
        CheckBox chkAI, chkDenTrang;
        TextBox txtYeuCau;
        Button btnSoSanh, btnTinhChinh;
        readonly Dictionary<string, OPhongCach> oPc = new Dictionary<string, OPhongCach>();
        string thuMucVuaLuu;

        public MainForm(CaiDat cd, string[] tep)
        {
            this.cd = cd;
            cuongDo = cd.CuongDo / 100.0;
            if (PhongCach.Tim(cd.PhongCach) != null) phongCach = cd.PhongCach;

            Text = UngDung.Ten;
            BackColor = Ui.Nen;
            ForeColor = Ui.Chu;
            Font = Ui.Chuan;
            AutoScaleMode = AutoScaleMode.None;
            Size = new Size(Ui.S(1320), Ui.S(840));
            MinimumSize = new Size(Ui.S(900), Ui.S(600));
            StartPosition = FormStartPosition.CenterScreen;
            KeyPreview = true;
            AllowDrop = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }

            DungGiaoDien();
            CapNhatChon();
            CapNhatThanhTruot();

            DragEnter += (s, e) => { if (e.Data.GetDataPresent(DataFormats.FileDrop)) e.Effect = DragDropEffects.Copy; };
            DragDrop += (s, e) => NhanTep((string[])e.Data.GetData(DataFormats.FileDrop));
            Shown += (s, e) => { if (tep != null && tep.Length > 0) NhanTep(tep); };
            FormClosing += (s, e) => LuuCaiDat();
        }

        // ================================================================ giao diện

        void DungGiaoDien()
        {
            // thanh trên
            var tren = new Panel { Dock = DockStyle.Top, Height = Ui.S(54), BackColor = Ui.Khung, Padding = Ui.Pad(12, 0, 12, 0) };
            var logo = new PictureBox { Image = Ui.Logo(Ui.S(30)), SizeMode = PictureBoxSizeMode.CenterImage, Dock = DockStyle.Left, Width = Ui.S(38) };
            var ten = new Label { Text = UngDung.Ten, Font = Ui.TieuDe, ForeColor = Ui.Chu, AutoSize = false, Dock = DockStyle.Left, Width = Ui.S(130), TextAlign = ContentAlignment.MiddleLeft };
            var nut = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, BackColor = Ui.Khung, Padding = Ui.Pad(0, 11, 0, 0) };
            nut.Controls.Add(Ui.TaoNut("Mở ảnh", Ui.Khung2, (s, e) => MoHopThoai()));
            Button tuDong = Ui.TaoNut("Chỉnh tự động", Ui.Nhan, (s, e) => ChinhTuDong());
            tuDong.Image = AnhSao(Ui.S(16));
            tuDong.TextImageRelation = TextImageRelation.ImageBeforeText;
            nut.Controls.Add(tuDong);
            nut.Controls.Add(Ui.TaoNut("Lưu ảnh", Color.FromArgb(0x1F, 0x8A, 0x5B), (s, e) => LuuAnh(null)));
            nut.Controls.Add(Ui.TaoNut("Lưu thành…", Ui.Khung2, (s, e) => LuuThanh()));
            btnSoSanh = Ui.TaoNut("So sánh trước / sau", Ui.Khung2, (s, e) => DoiSoSanh());
            nut.Controls.Add(btnSoSanh);
            nut.Controls.Add(Ui.TaoNut("‹", Ui.Khung2, (s, e) => AnhKe(-1)));
            nut.Controls.Add(Ui.TaoNut("›", Ui.Khung2, (s, e) => AnhKe(1)));
            nut.Controls.Add(Ui.TaoNut("Chỉnh hàng loạt…", Ui.Khung2, (s, e) => MoHangLoat(null)));
            nut.Controls.Add(Ui.TaoNut("Cài đặt", Ui.Khung2, (s, e) => MoCaiDat()));
            tren.Controls.Add(nut);
            tren.Controls.Add(ten);
            tren.Controls.Add(logo);

            vach = new VachBan { Dock = DockStyle.Top };

            // thanh trạng thái
            var duoi = new Panel { Dock = DockStyle.Bottom, Height = Ui.S(28), BackColor = Ui.Khung, Padding = Ui.Pad(12, 0, 12, 0) };
            lblTrangThai = new Label { Dock = DockStyle.Fill, ForeColor = Ui.ChuMo, Font = Ui.Nho, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true,
                                       Text = "Mở ảnh (Ctrl+O) hoặc kéo thả ảnh vào cửa sổ. Phím cách: xem ảnh gốc · C: so sánh · ‹ ›: ảnh trước / sau trong thư mục" };
            lnkThuMuc = new LinkLabel { Dock = DockStyle.Right, AutoSize = true, Text = "Mở thư mục", Visible = false, Font = Ui.Nho, LinkColor = Ui.Nhan, ActiveLinkColor = Ui.Cam,
                                        TextAlign = ContentAlignment.MiddleRight, Padding = Ui.Pad(0, 6, 10, 0) };
            lnkThuMuc.LinkClicked += (s, e) => MoThuMucVuaLuu();
            lblThongTin = new Label { Dock = DockStyle.Right, AutoSize = true, ForeColor = Ui.ChuMo, Font = Ui.Nho, Padding = Ui.Pad(0, 6, 0, 0) };
            duoi.Controls.Add(lblTrangThai);
            duoi.Controls.Add(lnkThuMuc);
            duoi.Controls.Add(lblThongTin);

            // cột phải
            phai = new Panel { Dock = DockStyle.Right, Width = Ui.S(350), BackColor = Ui.Khung, AutoScroll = true, Padding = Ui.Pad(14, 10, 4, 14) };
            int rong = phai.Width - phai.Padding.Horizontal - SystemInformation.VerticalScrollBarWidth - Ui.S(2);
            cot = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink,
                                        Location = new Point(phai.Padding.Left, phai.Padding.Top), BackColor = Ui.Khung, Margin = Padding.Empty, Padding = Padding.Empty };
            phai.Controls.Add(cot);

            cot.Controls.Add(TieuDe("PHONG CÁCH", rong));
            luoiPc = new FlowLayoutPanel { Width = rong, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, WrapContents = true, BackColor = Ui.Khung,
                                           MaximumSize = new Size(rong, 0), Margin = Ui.Pad(0, 0, 0, 4) };
            int coO = (rong - Ui.S(6) * 3) / 3;
            ThemO(GOC, "Ảnh gốc", null, coO);
            ThemO(PhongCach.AI, "AI Claude", "AI", coO);
            foreach (PhongCach p in PhongCach.DanhSach) ThemO(p.Ma, p.Ten, null, coO);
            cot.Controls.Add(luoiPc);

            ttCuongDo = new ThanhTruot { Ten = "Cường độ chỉnh", Min = 0, Max = 150, Width = rong, DinhDang = v => v.ToString("0") + "%", Margin = Ui.Pad(0, 2, 0, 8) };
            ttCuongDo.GiaTri = cuongDo * 100;
            ttCuongDo.DoiGiaTri += (s, e) => { cuongDo = ttCuongDo.GiaTri / 100; CapNhatThanhTruot(); VeLai(); };
            ttCuongDo.DatLai += (s, e) => { ttCuongDo.GiaTri = 100; cuongDo = 1; CapNhatThanhTruot(); VeLai(); };
            cot.Controls.Add(ttCuongDo);

            cot.Controls.Add(TieuDe("AI CLAUDE", rong));
            chkAI = new CheckBox { Text = "Dùng AI Claude khi bấm Chỉnh tự động", Checked = cd.DungAI, AutoSize = true, ForeColor = Ui.Chu, Margin = Ui.Pad(0, 0, 0, 4) };
            chkAI.CheckedChanged += (s, e) =>
            {
                cd.DungAI = chkAI.Checked;
                if (chkAI.Checked && cd.KeyDung.Length == 0) HoiNhapKey();
                CapNhatChuAI();
            };
            cot.Controls.Add(chkAI);
            var lblYc = new Label { Text = "Yêu cầu thêm cho AI (không bắt buộc):", AutoSize = true, ForeColor = Ui.ChuMo, Font = Ui.Nho, Margin = Ui.Pad(0, 2, 0, 2) };
            cot.Controls.Add(lblYc);
            txtYeuCau = new TextBox { Width = rong, Height = Ui.S(46), Multiline = true, BackColor = Ui.Khung2, ForeColor = Ui.Chu, BorderStyle = BorderStyle.FixedSingle,
                                      Text = cd.YeuCauAI, Margin = Ui.Pad(0, 0, 0, 4) };
            txtYeuCau.TextChanged += (s, e) => cd.YeuCauAI = txtYeuCau.Text;
            cot.Controls.Add(txtYeuCau);
            var dongAI = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Ui.Khung, Margin = Ui.Pad(0, 0, 0, 4) };
            Button hoiAI = Ui.TaoNut("Nhờ AI chỉnh ảnh này", Ui.Cam, (s, e) => GoiAI());
            hoiAI.Image = AnhSao(Ui.S(14));
            hoiAI.TextImageRelation = TextImageRelation.ImageBeforeText;
            dongAI.Controls.Add(hoiAI);
            cot.Controls.Add(dongAI);
            lblAI = new Label { AutoSize = true, MaximumSize = new Size(rong, 0), ForeColor = Ui.ChuMo, Font = Ui.Nho, Margin = Ui.Pad(0, 2, 0, 10) };
            cot.Controls.Add(lblAI);
            CapNhatChuAI();

            btnTinhChinh = Ui.TaoNut("TINH CHỈNH  +", Ui.Khung, (s, e) => DoiTinhChinh());
            btnTinhChinh.AutoSize = false;
            btnTinhChinh.Width = rong;
            btnTinhChinh.Height = Ui.S(30);
            btnTinhChinh.TextAlign = ContentAlignment.MiddleLeft;
            btnTinhChinh.Padding = Padding.Empty;
            btnTinhChinh.Font = Ui.NhoDam;
            btnTinhChinh.ForeColor = Ui.ChuMo;
            btnTinhChinh.Margin = Ui.Pad(0, 4, 0, 2);
            cot.Controls.Add(btnTinhChinh);

            pnlTinhChinh = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink,
                                                 BackColor = Ui.Khung, Visible = false, Margin = Padding.Empty };
            string nhom = null;
            foreach (MoTaThongSo m in ThongSo.DanhSach)
            {
                if (m.Nhom != nhom)
                {
                    nhom = m.Nhom;
                    pnlTinhChinh.Controls.Add(new Label { Text = nhom, AutoSize = true, Font = Ui.NhoDam, ForeColor = Ui.Nhan, Margin = Ui.Pad(0, 8, 0, 0) });
                }
                MoTaThongSo mm = m;
                var t = new ThanhTruot { Ten = m.Ten, Min = m.Min, Max = m.Max, SoLe = m.SoLe, NenSac = m.LaSacDo, Width = rong, Margin = Ui.Pad(0, 0, 0, 0) };
                if (m.LaSacDo) t.DinhDang = v => v.ToString("0") + "°";
                t.DoiGiaTri += (s, e) => KeoThanh(mm.Ma);
                t.DatLai += (s, e) => { lech[(int)mm.Ma] = 0; CapNhatThanhTruot(); VeLai(); };
                tt[(int)m.Ma] = t;
                pnlTinhChinh.Controls.Add(t);
            }
            chkDenTrang = new CheckBox { Text = "Ảnh đen trắng", AutoSize = true, ForeColor = Ui.Chu, Margin = Ui.Pad(0, 8, 0, 4) };
            chkDenTrang.Click += (s, e) => { denTrangTay = chkDenTrang.Checked; VeLai(); };
            pnlTinhChinh.Controls.Add(chkDenTrang);
            var datLai = Ui.TaoNut("Bỏ các chỉnh tay", Ui.Khung2, (s, e) =>
            {
                Array.Clear(lech, 0, lech.Length);
                denTrangTay = null;
                CapNhatThanhTruot();
                VeLai();
            });
            datLai.Margin = Ui.Pad(0, 6, 0, 4);
            pnlTinhChinh.Controls.Add(datLai);
            pnlTinhChinh.Controls.Add(new Label
            {
                Text = "Nhấp đúp một thanh để trả về giá trị tự động. Giữ Shift khi kéo để chỉnh mịn.",
                AutoSize = true, MaximumSize = new Size(rong, 0), ForeColor = Ui.ChuMo, Font = Ui.Nho, Margin = Ui.Pad(0, 4, 0, 0)
            });
            cot.Controls.Add(pnlTinhChinh);

            khung = new KhungAnh { Dock = DockStyle.Fill };

            Controls.Add(khung);
            Controls.Add(phai);
            Controls.Add(vach);
            Controls.Add(tren);
            Controls.Add(duoi);
            khung.BringToFront();
            GanCuon(phai);
        }

        /// <summary>Lăn chuột ở bất kỳ đâu trên cột phải đều cuộn cột (không cần bấm vào cột trước).</summary>
        void GanCuon(Control c)
        {
            foreach (Control con in c.Controls) GanCuon(con);
            if (c is TextBox) return;
            c.MouseWheel += (s, e) =>
            {
                int y = -phai.AutoScrollPosition.Y - e.Delta / 120 * Ui.S(60);
                phai.AutoScrollPosition = new Point(0, Math.Max(0, y));
                var he = e as HandledMouseEventArgs;
                if (he != null) he.Handled = true;
            };
        }

        static Label TieuDe(string chu, int rong)
        {
            return new Label { Text = chu, Font = Ui.NhoDam, ForeColor = Ui.ChuMo, AutoSize = false, Width = rong, Height = Ui.S(24), TextAlign = ContentAlignment.MiddleLeft, Margin = Ui.Pad(0, 4, 0, 2) };
        }

        static Bitmap AnhSao(int co)
        {
            var b = new Bitmap(co, co);
            using (Graphics g = Graphics.FromImage(b))
            {
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                Ui.VeSao(g, co * 0.42f, co * 0.55f, co * 0.42f, Color.White);
                Ui.VeSao(g, co * 0.82f, co * 0.2f, co * 0.18f, Color.White);
            }
            return b;
        }

        void ThemO(string ma, string ten, string nhanPhu, int co)
        {
            var o = new OPhongCach { Ma = ma, Ten = ten, NhanPhu = nhanPhu, Size = new Size(co, (int)(co * 0.72) + Ui.S(20)) };
            if (ma == PhongCach.AI) o.ChuKhiTrong = cd.KeyDung.Length > 0 ? "Bấm để AI\nchỉnh ảnh" : "AI Claude\n(cần API key)";
            else if (ma != GOC)
            {
                PhongCach p = PhongCach.Tim(ma);
                if (p != null) new ToolTip().SetToolTip(o, p.MoTa);
            }
            o.Click += (s, e) => ChonPhongCach(ma);
            oPc[ma] = o;
            luoiPc.Controls.Add(o);
        }

        void DoiTinhChinh()
        {
            pnlTinhChinh.Visible = !pnlTinhChinh.Visible;
            btnTinhChinh.Text = pnlTinhChinh.Visible ? "TINH CHỈNH  −" : "TINH CHỈNH  +";
            if (pnlTinhChinh.Visible) phai.AutoScrollPosition = new Point(0, Math.Max(0, btnTinhChinh.Top + phai.Padding.Top - Ui.S(8)));
        }

        void DoiSoSanh()
        {
            khung.SoSanh = !khung.SoSanh;
            btnSoSanh.BackColor = khung.SoSanh ? Ui.NhanDam : Ui.Khung2;
            btnSoSanh.FlatAppearance.MouseOverBackColor = Ui.SangHon(btnSoSanh.BackColor, 0.12f);
        }

        void CapNhatChuAI()
        {
            if (dangAI) return;
            if (ai != null) { lblAI.Text = "AI: " + ai.MoTa; lblAI.ForeColor = Ui.Chu; return; }
            lblAI.ForeColor = Ui.ChuMo;
            lblAI.Text = cd.KeyDung.Length == 0
                ? "AI Claude nhìn ảnh để hiểu cảnh (hoàng hôn, chân dung, món ăn…) rồi chọn thông số như thợ hậu kỳ. Cần API key của Anthropic — nhập ở Cài đặt. Không có key, phần mềm vẫn tự chỉnh bằng phân tích trên máy."
                : (cd.DungAI ? "AI Claude sẽ chỉnh khi bấm Chỉnh tự động (mỗi lần gọi tốn một ít phí API)."
                             : "Đang chỉnh bằng phân tích trên máy (miễn phí, không cần mạng).");
        }

        void CapNhatBan()
        {
            vach.Ban = dangMo || dangVe || dangAI || dangLuu;
            khung.ThongBao = dangMo ? "Đang mở và phân tích ảnh…" : (dangLuu ? "Đang xuất ảnh cỡ thật…" : (dangAI ? "AI Claude đang xem ảnh…" : null));
            khung.Invalidate();
        }

        void CapNhatChon()
        {
            foreach (var kv in oPc) kv.Value.DuocChon = kv.Key == phongCach;
        }

        // ================================================================ thông số

        ThongSo NenHienTai()
        {
            if (pt == null) return new ThongSo();
            ThongSo t;
            if (phongCach == GOC) t = new ThongSo();
            else if (phongCach == PhongCach.AI && ai != null) t = ai.ThongSo;
            else t = PhongCach.Ap(pt, phongCach == PhongCach.AI ? "tu_dong" : phongCach);
            return t.NhanCuongDo(cuongDo);
        }

        ThongSo HienTai()
        {
            ThongSo t = NenHienTai();
            for (int i = 0; i < ThongSo.SoLuong; i++) t.V[i] += lech[i];
            if (denTrangTay.HasValue) t.DenTrang = denTrangTay.Value;
            return t.Kep();
        }

        void CapNhatThanhTruot()
        {
            ThongSo t = HienTai();
            for (int i = 0; i < ThongSo.SoLuong; i++) tt[i].GiaTri = t.V[i];
            chkDenTrang.Checked = t.DenTrang;
        }

        void KeoThanh(TS k)
        {
            int i = (int)k;
            lech[i] = tt[i].GiaTri - NenHienTai().V[i];
            VeLai();
        }

        void ChonPhongCach(string ma)
        {
            if (xem == null) { MoHopThoai(); return; }
            if (ma == PhongCach.AI && ai == null) { GoiAI(); return; }
            phongCach = ma;
            Array.Clear(lech, 0, lech.Length);
            denTrangTay = null;
            if (ma != GOC && ma != PhongCach.AI) cd.PhongCach = ma;
            CapNhatChon();
            CapNhatThanhTruot();
            VeLai();
        }

        void ChinhTuDong()
        {
            if (xem == null) { MoHopThoai(); return; }
            if (cd.DungAI && cd.KeyDung.Length > 0) { GoiAI(); return; }
            phongCach = PhongCach.Tim(cd.PhongCach) != null ? cd.PhongCach : "tu_dong";
            cuongDo = 1;
            ttCuongDo.GiaTri = 100;
            Array.Clear(lech, 0, lech.Length);
            denTrangTay = null;
            CapNhatChon();
            CapNhatThanhTruot();
            VeLai();
        }

        // ================================================================ mở ảnh

        void MoHopThoai()
        {
            using (var f = new OpenFileDialog
            {
                Title = "Chọn ảnh cần chỉnh",
                Filter = "Ảnh (*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.tiff;*.gif)|*.jpg;*.jpeg;*.jpe;*.jfif;*.png;*.bmp;*.tif;*.tiff;*.gif|Tất cả (*.*)|*.*",
                Multiselect = true
            })
            {
                if (f.ShowDialog(this) == DialogResult.OK) NhanTep(f.FileNames);
            }
        }

        void NhanTep(string[] tep)
        {
            if (tep == null) return;
            var anh = new List<string>();
            foreach (string t in tep)
            {
                if (Directory.Exists(t)) anh.AddRange(Directory.GetFiles(t).Where(AnhNguon.LaAnh).OrderBy(x => x, StringComparer.OrdinalIgnoreCase));
                else if (File.Exists(t) && AnhNguon.LaAnh(t)) anh.Add(t);
            }
            if (anh.Count == 0)
            {
                MessageBox.Show(this, "Không có tệp ảnh hỗ trợ (JPG, PNG, BMP, TIFF, GIF).", UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            if (anh.Count == 1) { MoAnh(anh[0]); return; }
            DialogResult hoi = MessageBox.Show(this, "Bạn đã chọn " + anh.Count + " ảnh.\n\nCó: chỉnh hàng loạt tất cả (tự động, lưu ra thư mục).\nKhông: chỉ mở ảnh đầu tiên.",
                                               UngDung.Ten, MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
            if (hoi == DialogResult.Yes) MoHangLoat(anh.ToArray());
            else if (hoi == DialogResult.No) MoAnh(anh[0]);
        }

        int CanhXemTruoc()
        {
            Rectangle man = Screen.FromControl(this).Bounds;
            return Math.Max(1000, Math.Min(1800, (int)(Math.Max(man.Width, man.Height) * 0.85)));
        }

        async void MoAnh(string duongDan)
        {
            int so = ++soHieuAnh;
            if (huyAI != null) huyAI.Cancel();
            dangMo = true;
            CapNhatBan();
            AnhNguon g = null, x = null, o = null;
            KetQuaPhanTich k = null;
            int canh = CanhXemTruoc(), coO = Ui.S(200);
            try
            {
                await Task.Run(() =>
                {
                    g = AnhNguon.Mo(duongDan);
                    x = g.ThuNho(canh);
                    k = PhanTich.Chay(g, x);
                    o = x.ThuNho(coO);
                });
            }
            catch (Exception ex)
            {
                if (so == soHieuAnh)
                {
                    dangMo = false;
                    CapNhatBan();
                    MessageBox.Show(this, "Không mở được ảnh:\n" + duongDan + "\n\n" + ex.Message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
                return;
            }
            if (so != soHieuAnh) return;
            dangMo = false;
            goc = g; xem = x; nhoO = o; pt = k; ai = null;
            Array.Clear(lech, 0, lech.Length);
            denTrangTay = null;
            phongCach = cd.TuDongKhiMo ? (PhongCach.Tim(cd.PhongCach) != null ? cd.PhongCach : "tu_dong") : GOC;
            khung.DatAnhTruoc(xem.SangBitmap());
            khung.DatAnhSau(null);
            Text = Path.GetFileName(duongDan) + " — " + UngDung.Ten;
            lblTrangThai.Text = Path.GetFileName(duongDan) + "  ·  " + g.W + "×" + g.H + "  ·  " + pt.MoTa +
                                (pt.KhuonMat.Length > 0 ? "  ·  " + pt.KhuonMat.Length + " khuôn mặt" : "");
            lnkThuMuc.Visible = false;
            CapNhatBan();
            CapNhatChon();
            CapNhatThanhTruot();
            CapNhatChuAI();
            VeLai();
            VeCacO();
            if (cd.TuDongKhiMo && cd.DungAI && cd.KeyDung.Length > 0) GoiAI();
            GC.Collect();
        }

        void AnhKe(int buoc)
        {
            if (goc == null || string.IsNullOrEmpty(goc.DuongDan)) return;
            string thuMuc = Path.GetDirectoryName(goc.DuongDan);
            List<string> ds;
            try { ds = Directory.GetFiles(thuMuc).Where(AnhNguon.LaAnh).OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToList(); }
            catch (Exception) { return; }
            int i = ds.FindIndex(x => string.Equals(x, goc.DuongDan, StringComparison.OrdinalIgnoreCase));
            int j = i + buoc;
            if (i < 0 || j < 0 || j >= ds.Count) { SystemSounds(); return; }
            MoAnh(ds[j]);
        }

        static void SystemSounds() { System.Media.SystemSounds.Beep.Play(); }

        // ================================================================ dựng ảnh

        async void VeLai()
        {
            if (xem == null) return;
            if (dangVe) { canVe = true; return; }
            dangVe = true;
            CapNhatBan();
            try
            {
                do
                {
                    canVe = false;
                    AnhNguon a = xem;
                    ThongSo p = HienTai();
                    var sw = Stopwatch.StartNew();
                    byte[] kq = await Task.Run(() => XuLyAnh.Ve(a, p));
                    if (a != xem) { canVe = xem != null; continue; }
                    msVe = sw.ElapsedMilliseconds;
                    khung.DatAnhSau(AnhNguon.SangBitmap(kq, a.W, a.H));
                    lblThongTin.Text = "Xem trước " + a.W + "×" + a.H + " · " + msVe + " ms";
                } while (canVe);
            }
            catch (Exception ex)
            {
                lblTrangThai.Text = "Lỗi dựng ảnh: " + ex.Message;
            }
            finally
            {
                dangVe = false;
                CapNhatBan();
            }
        }

        /// <summary>Ảnh nhỏ trên các ô phong cách, dựng lần lượt ở luồng nền.</summary>
        async void VeCacO()
        {
            int so = soHieuAnh;
            AnhNguon o = nhoO;
            KetQuaPhanTich k = pt;
            if (o == null) return;
            var ds = new List<KeyValuePair<string, ThongSo>>();
            ds.Add(new KeyValuePair<string, ThongSo>(GOC, new ThongSo()));
            foreach (PhongCach p in PhongCach.DanhSach) ds.Add(new KeyValuePair<string, ThongSo>(p.Ma, PhongCach.Ap(k, p.Ma)));
            oPc[PhongCach.AI].DatAnh(null);
            oPc[PhongCach.AI].ChuKhiTrong = cd.KeyDung.Length > 0 ? "Bấm để AI\nchỉnh ảnh" : "AI Claude\n(cần API key)";
            foreach (var kv in ds)
            {
                ThongSo p = kv.Value;
                byte[] b;
                try { b = await Task.Run(() => XuLyAnh.Ve(o, p)); }
                catch (Exception) { continue; }
                if (so != soHieuAnh) return;
                oPc[kv.Key].DatAnh(AnhNguon.SangBitmap(b, o.W, o.H));
            }
        }

        async void VeOAI()
        {
            if (ai == null || nhoO == null) return;
            int so = soHieuAnh;
            AnhNguon o = nhoO;
            ThongSo p = ai.ThongSo;
            byte[] b = await Task.Run(() => XuLyAnh.Ve(o, p));
            if (so == soHieuAnh) oPc[PhongCach.AI].DatAnh(AnhNguon.SangBitmap(b, o.W, o.H));
        }

        // ================================================================ AI

        void HoiNhapKey()
        {
            if (MessageBox.Show(this, "Để dùng AI Claude cần API key của Anthropic (lấy tại console.anthropic.com).\n\nMở Cài đặt để nhập ngay?",
                                UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                MoCaiDat();
        }

        async void GoiAI()
        {
            if (xem == null || pt == null) { MoHopThoai(); return; }
            if (cd.KeyDung.Length == 0) { HoiNhapKey(); if (cd.KeyDung.Length == 0) return; }
            if (huyAI != null) huyAI.Cancel();
            var cts = new CancellationTokenSource();
            huyAI = cts;
            int so = soHieuAnh;
            string maGoiY = phongCach == GOC || phongCach == PhongCach.AI ? "tu_dong" : phongCach;
            ThongSo goiY = PhongCach.Ap(pt, maGoiY);
            PhongCach pc = PhongCach.Tim(maGoiY);
            string yc = txtYeuCau.Text;
            AnhNguon a = xem;
            KetQuaPhanTich k = pt;
            dangAI = true;
            CapNhatBan();
            lblAI.Text = "AI Claude đang xem ảnh và chọn thông số… (thường 10–30 giây)";
            lblAI.ForeColor = Ui.ChuMo;
            try
            {
                KetQuaAI kq = await Task.Run(() => AiClaude.Hoi(cd, a, k, goiY, pc, yc, cts.Token));
                if (so != soHieuAnh || cts.IsCancellationRequested) return;
                ai = kq;
                phongCach = PhongCach.AI;
                Array.Clear(lech, 0, lech.Length);
                denTrangTay = null;
                dangAI = false;
                CapNhatChuAI();
                CapNhatChon();
                CapNhatThanhTruot();
                VeLai();
                VeOAI();
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                if (so == soHieuAnh && !cts.IsCancellationRequested)
                {
                    lblAI.Text = (ex is LoiAI ? "" : "Lỗi gọi AI: ") + ex.Message;
                    lblAI.ForeColor = Ui.Do;
                }
            }
            finally
            {
                if (huyAI == cts) { dangAI = false; CapNhatBan(); }
            }
        }

        // ================================================================ lưu

        static string TenKhongTrung(string p)
        {
            if (!File.Exists(p)) return p;
            string thuMuc = Path.GetDirectoryName(p), ten = Path.GetFileNameWithoutExtension(p), duoi = Path.GetExtension(p);
            for (int i = 2; ; i++)
            {
                string q = Path.Combine(thuMuc, ten + " (" + i + ")" + duoi);
                if (!File.Exists(q)) return q;
            }
        }

        void LuuThanh()
        {
            if (goc == null) { MoHopThoai(); return; }
            string macDinh = cd.DuongDanLuu(goc.DuongDan);
            using (var f = new SaveFileDialog
            {
                Title = "Lưu ảnh đã chỉnh",
                FileName = Path.GetFileName(macDinh),
                InitialDirectory = Path.GetDirectoryName(macDinh),
                Filter = "JPEG (*.jpg)|*.jpg|PNG (*.png)|*.png|TIFF (*.tif)|*.tif",
                FilterIndex = Path.GetExtension(macDinh) == ".png" ? 2 : (Path.GetExtension(macDinh) == ".tif" ? 3 : 1),
            })
            {
                if (f.ShowDialog(this) == DialogResult.OK) LuuAnh(f.FileName);
            }
        }

        async void LuuAnh(string dich)
        {
            if (goc == null) { MoHopThoai(); return; }
            if (dangLuu) return;
            if (dich == null)
            {
                dich = TenKhongTrung(cd.DuongDanLuu(goc.DuongDan));
            }
            ThongSo p = HienTai();
            AnhNguon g = goc;
            int q = cd.ChatLuongJpeg, canh = cd.CanhDaiXuat;
            dangLuu = true;
            CapNhatBan();
            var sw = Stopwatch.StartNew();
            try
            {
                string d = dich;
                await Task.Run(() =>
                {
                    AnhNguon src = canh > 0 ? g.ThuNho(canh) : g;
                    byte[] kq = XuLyAnh.Ve(src, p);
                    string thuMuc = Path.GetDirectoryName(d);
                    if (!string.IsNullOrEmpty(thuMuc)) Directory.CreateDirectory(thuMuc);
                    AnhNguon.Luu(kq, src.W, src.H, d, q, src.Exif);
                });
                lblTrangThai.Text = "Đã lưu: " + dich + "  (" + (sw.ElapsedMilliseconds / 1000.0).ToString("0.0") + " giây)";
                thuMucVuaLuu = dich;
                lnkThuMuc.Visible = true;
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "Không lưu được ảnh:\n" + dich + "\n\n" + ex.Message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            finally
            {
                dangLuu = false;
                CapNhatBan();
                GC.Collect();
            }
        }

        void MoThuMucVuaLuu()
        {
            if (string.IsNullOrEmpty(thuMucVuaLuu)) return;
            try { Process.Start("explorer.exe", "/select,\"" + thuMucVuaLuu + "\""); }
            catch (Exception) { }
        }

        // ================================================================ cửa sổ khác

        void MoCaiDat()
        {
            using (var f = new CaiDatForm(cd))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
            }
            LuuCaiDat();
            chkAI.Checked = cd.DungAI;
            CapNhatChuAI();
            if (ai == null && oPc.ContainsKey(PhongCach.AI))
            {
                oPc[PhongCach.AI].ChuKhiTrong = cd.KeyDung.Length > 0 ? "Bấm để AI\nchỉnh ảnh" : "AI Claude\n(cần API key)";
                oPc[PhongCach.AI].Invalidate();
            }
        }

        void MoHangLoat(string[] tep)
        {
            var f = new HangLoatForm(cd, tep);
            f.Show(this);
        }

        void LuuCaiDat()
        {
            cd.CuongDo = (int)Math.Round(cuongDo * 100);
            try { cd.Ghi(); } catch (Exception) { }
        }

        // ================================================================ phím tắt

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            switch (keyData)
            {
                case Keys.Control | Keys.O: MoHopThoai(); return true;
                case Keys.Control | Keys.S: LuuAnh(null); return true;
                case Keys.Control | Keys.Shift | Keys.S: LuuThanh(); return true;
                case Keys.Control | Keys.B: MoHangLoat(null); return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        bool DangGo { get { return ActiveControl is TextBox; } }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (DangGo || e.Control || e.Alt) return;
            switch (e.KeyCode)
            {
                case Keys.Space:
                    khung.XemGoc(true);
                    e.Handled = e.SuppressKeyPress = true;
                    break;
                case Keys.C:
                    DoiSoSanh();
                    e.Handled = e.SuppressKeyPress = true;
                    break;
                case Keys.A:
                    ChinhTuDong();
                    e.Handled = e.SuppressKeyPress = true;
                    break;
                case Keys.Left:
                case Keys.Right:
                    if (ActiveControl is ThanhTruot) return;
                    AnhKe(e.KeyCode == Keys.Left ? -1 : 1);
                    e.Handled = e.SuppressKeyPress = true;
                    break;
            }
        }

        protected override void OnKeyUp(KeyEventArgs e)
        {
            base.OnKeyUp(e);
            if (e.KeyCode == Keys.Space) khung.XemGoc(false);
        }
    }
}
