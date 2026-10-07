using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Kết nối phần mềm với website trên máy chủ IIS (HTTP cổng 80): địa chỉ → kiểm tra đúng máy chủ Thất thoát nước →
    /// đăng nhập tài khoản quản trị → lần đầu đưa dữ liệu trên máy lên (hoặc dùng dữ liệu đã có trên máy chủ).
    /// </summary>
    class KetNoiMayChuForm : HopThoaiCap1
    {
        readonly PhienLam phien;
        readonly MayChuKetNoi cu;
        readonly TextBox txtDiaChi, txtTen, txtMatKhau;
        readonly Label lblMayChu;
        readonly Button bKiemTra;
        string diaChiDaKiem;
        Dictionary<string, object> ping;

        public MayChuKetNoi KetQua { get; private set; }
        public bool DungDuLieuMayChu { get; private set; }
        public bool GhiDeMayChu { get; private set; }

        public static void Mo(Control owner, PhienLam phien)
        {
            using (var f = new KetNoiMayChuForm(phien))
            {
                if (f.ShowDialog(owner.FindForm()) != DialogResult.OK) return;
            }
        }

        public KetNoiMayChuForm(PhienLam phien) : base("Kết nối máy chủ dữ liệu (website trên IIS)", 720, 470)
        {
            this.phien = phien;
            cu = phien.DongBo != null ? phien.DongBo.Kn : null;
            BtnLuu.Text = "Kết nối";
            txtDiaChi = O(330, cu != null ? cu.DiaChi : "", "vd 192.168.1.10  hoặc  tenmien.vn/thatthoat");
            bKiemTra = Ui.MakeButton("Kiểm tra", false);
            bKiemTra.Click += (s, e) => KiemTraMayChu();
            Dong("Địa chỉ máy chủ", Hang(txtDiaChi, bKiemTra));
            GhiChu("Địa chỉ script CaiDat-IIS.bat in ra khi cài xong: IP trong mạng nội bộ, tên miền hoặc IP công cộng (HTTP cổng 80). " +
                   "Cài thành ứng dụng con thì ghi kèm đường dẫn, vd 192.168.1.10/thatthoat. Cổng khác 80 thì ghi kèm, vd tenmien.vn:8081.");
            lblMayChu = Ui.MakeLabel("Bấm \"Kiểm tra\" để thử kết nối.", Ui.Base, Ui.Muted);
            lblMayChu.MaximumSize = new Size(Ui.S(500), 0);
            lblMayChu.UseMnemonic = false;
            Dong("Máy chủ", lblMayChu);
            txtTen = O(220, cu != null ? cu.Ten : "admin", null);
            Dong("Tên đăng nhập", txtTen);
            txtMatKhau = O(220, "", null);
            txtMatKhau.UseSystemPasswordChar = true;
            Dong("Mật khẩu", txtMatKhau);
            GhiChu("Phần mềm trên máy tính dùng tài khoản QUẢN TRỊ (đặt khi chạy CaiDat-IIS.bat trên máy chủ). " +
                   "Tài khoản cho người khác tạo ở trang web (thẻ Quản trị) hoặc \"Tài khoản người dùng…\". " +
                   "HTTP không mã hoá: nên dùng trong mạng nội bộ / VPN.");
            txtDiaChi.TextChanged += (s, e) =>
            {
                if (MayChuKetNoi.ChuanHoaDiaChi(txtDiaChi.Text) == diaChiDaKiem) return;
                diaChiDaKiem = null;
                lblMayChu.Text = "Bấm \"Kiểm tra\".";
                lblMayChu.ForeColor = Ui.Muted;
            };
            Shown += (s, e) => { if (cu != null) { KiemTraMayChu(); txtMatKhau.Focus(); } else txtDiaChi.Focus(); };
        }

        bool KiemTraMayChu()
        {
            string dc = MayChuKetNoi.ChuanHoaDiaChi(txtDiaChi.Text);
            if (dc.Length == 0) { Ui.Error(this, "Nhập địa chỉ máy chủ."); txtDiaChi.Focus(); return false; }
            var thu = new MayChuKetNoi { DiaChi = dc };
            Cursor = Cursors.WaitCursor;
            lblMayChu.Text = "Đang kết nối " + thu.GocUrl + "…";
            lblMayChu.ForeColor = Ui.Muted;
            Application.DoEvents();
            try
            {
                ping = thu.Ping();
                if (Convert.ToString(ping.ContainsKey("ungDung") ? ping["ungDung"] : "") != "ThatThoatNuoc")
                    throw new LoiMayChu(0, "Địa chỉ này không phải máy chủ Thất thoát nước (có thể là site khác trên IIS). Kiểm tra lại đường dẫn, vd thêm /thatthoat.");
                diaChiDaKiem = dc;
                txtDiaChi.Text = dc;
                string pb = ping.ContainsKey("phienBanPhanMem") ? Convert.ToString(ping["phienBanPhanMem"]) : "";
                lblMayChu.Text = "Đã kết nối " + thu.GocUrl + "\n" + Convert.ToString(ping["congTy"]) + (pb.Length > 0 ? "  ·  phiên bản máy chủ " + pb : "");
                lblMayChu.ForeColor = Ui.Success;
                return true;
            }
            catch (LoiMayChu ex)
            {
                diaChiDaKiem = null;
                lblMayChu.Text = ex.Message;
                lblMayChu.ForeColor = Ui.Danger;
                return false;
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        protected override bool KiemTra()
        {
            return KetNoi();
        }

        bool KetNoi()
        {
            if ((diaChiDaKiem == null || MayChuKetNoi.ChuanHoaDiaChi(txtDiaChi.Text) != diaChiDaKiem) && !KiemTraMayChu()) return false;
            if (txtTen.Text.Trim().Length == 0 || txtMatKhau.Text.Length == 0) { Ui.Error(this, "Nhập tên đăng nhập và mật khẩu."); return false; }
            bool cungMayChu = cu != null && cu.DiaChi == diaChiDaKiem;
            var kn = new MayChuKetNoi { DiaChi = diaChiDaKiem };
            if (cungMayChu) { kn.May = cu.May; kn.PhienBan = cu.PhienBan; kn.ChuaGui = cu.ChuaGui; }
            Cursor = Cursors.WaitCursor;
            try
            {
                kn.DangNhap(txtTen.Text.Trim(), txtMatKhau.Text);
                bool doiQuyen = phien.ChiXem == kn.LaQuanTri || !string.Equals(phien.NguoiDung, kn.Ten, StringComparison.OrdinalIgnoreCase);
                if (cungMayChu && doiQuyen)
                {
                    // đăng nhập người khác / quyền khác trên cùng máy chủ: lưu rồi mở lại phần mềm để áp quyền
                    phien.DongBo.Kn.Token = kn.Token;
                    phien.DongBo.Kn.Ten = kn.Ten;
                    phien.DongBo.Kn.HoTen = kn.HoTen;
                    phien.DongBo.Kn.VaiTro = kn.VaiTro;
                    phien.DongBo.Kn.NhoDangNhap = true;
                    phien.DongBo.Kn.Ghi(phien.Kho.ThuMuc);
                    Ui.Info(this, "Đã đăng nhập " + kn.Ten + (kn.LaQuanTri ? " (Admin)" : " (chỉ xem)") + ". Phần mềm sẽ mở lại để áp dụng quyền.");
                    KhoiDongLai.Chay();
                    return true;
                }
                if (cungMayChu)
                {
                    // chỉ đăng nhập lại: giữ dữ liệu và trạng thái đồng bộ
                    phien.DongBo.Kn.Token = kn.Token;
                    phien.DongBo.Kn.Ten = kn.Ten;
                    phien.DongBo.Kn.HoTen = kn.HoTen;
                    phien.DongBo.Kn.VaiTro = kn.VaiTro;
                    phien.DongBo.DaDangNhapLai();
                    Ui.Info(this, "Đã đăng nhập lại máy chủ " + kn.GocUrl);
                    return true;
                }
                bool moLai = phien.ChiXem && kn.LaQuanTri;   // đang khoá chỉ xem mà vừa đăng nhập Admin
                bool ok = ChonDuLieu(kn);
                if (ok && moLai) KhoiDongLai.Chay();
                return ok;
            }
            catch (LoiMayChu ex)
            {
                Ui.Error(this, ex.Message);
                return false;
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        /// <summary>Lần đầu nối máy chủ này: đưa dữ liệu trên máy lên, hoặc dùng dữ liệu đã có trên máy chủ.</summary>
        bool ChonDuLieu(MayChuKetNoi kn)
        {
            bool mayChuCo = ping != null && ping.ContainsKey("coDuLieu") && Convert.ToBoolean(ping["coDuLieu"]);
            DuLieu dl = phien.Dl;
            if (!kn.LaQuanTri)
            {
                // tài khoản chỉ xem: chỉ lấy dữ liệu máy chủ về xem
                if (!mayChuCo)
                {
                    Ui.Error(this, "Máy chủ chưa có dữ liệu. Cần Admin kết nối và đưa dữ liệu lên trước.");
                    kn.DangXuat();
                    return false;
                }
                if (!Ui.Confirm(this, "Tài khoản " + kn.Ten + " chỉ được xem. Phần mềm trên máy này sẽ dùng dữ liệu trên máy chủ (dữ liệu hiện có trên máy được sao lưu lại) và mở lại ở chế độ chỉ xem. Tiếp tục?"))
                {
                    kn.DangXuat();
                    return false;
                }
                try { phien.Kho.SaoLuuNgay(); } catch (Exception) { }
                long pbx;
                byte[] bx = kn.TaiDuLieu(out pbx);
                phien.DatDongBo(null);
                phien.ThayDuLieu(KhoDuLieu.DocBytes(bx));
                bool chiXemCu = phien.ChiXem;
                phien.ChiXem = false;
                phien.Kho.Luu();
                phien.ChiXem = chiXemCu;
                kn.PhienBan = pbx;
                kn.ChuaGui = false;
                kn.Ghi(phien.Kho.ThuMuc);
                KhoiDongLai.Chay();
                return true;
            }
            string moTaMay = dl.Thang.Count + " tháng thất thoát" + (dl.Cap1.Ky.Count > 0 ? ", " + dl.Cap1.Ky.Count + " tháng đồng hồ cấp 1" : "");
            bool guiLen;
            if (!mayChuCo)
            {
                if (dl.Thang.Count == 0 && dl.Cap1.Trong)
                {
                    Ui.Error(this, "Cả máy này và máy chủ đều chưa có dữ liệu. Hãy nhập số liệu (hoặc nhập file Excel) trên máy này trước rồi kết nối.");
                    kn.DangXuat();
                    return false;
                }
                if (!Ui.Confirm(this, "Máy chủ chưa có dữ liệu.\n\nĐưa dữ liệu trên máy này (" + moTaMay + ") lên máy chủ?")) { kn.DangXuat(); return false; }
                guiLen = true;
            }
            else
            {
                DialogResult r = MessageBox.Show(this,
                    "Máy chủ đã có dữ liệu.\n\nCÓ = dùng dữ liệu trên máy chủ (khuyên dùng; dữ liệu trên máy này được sao lưu lại).\n" +
                    "KHÔNG = ghi đè máy chủ bằng dữ liệu trên máy này (" + moTaMay + ").",
                    UngDung.Ten, MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question, MessageBoxDefaultButton.Button1);
                if (r == DialogResult.Cancel) { kn.DangXuat(); return false; }
                guiLen = r == DialogResult.No;
                if (guiLen && !Ui.Confirm(this, "Ghi đè TOÀN BỘ dữ liệu trên máy chủ (kể cả số điện thoại đã nhập) bằng dữ liệu trên máy này?\n\nMáy chủ tự giữ 1 bản sao lưu trước khi ghi đè."))
                { kn.DangXuat(); return false; }
            }
            try { phien.Kho.SaoLuuNgay(); } catch (Exception) { }
            if (guiLen)
            {
                MayChuKetNoi.KetQuaGui kq = kn.GuiDuLieu(KhoDuLieu.GhiBytes(phien.Dl), 0, true);
                kn.PhienBan = kq.PhienBan;
            }
            else
            {
                long pb;
                DuLieu moi = KhoDuLieu.DocBytes(kn.TaiDuLieu(out pb));
                kn.PhienBan = pb;
                phien.DatDongBo(null);
                phien.ThayDuLieu(moi);
                phien.Kho.Luu();
            }
            kn.ChuaGui = false;
            kn.Ghi(phien.Kho.ThuMuc);
            phien.DatDongBo(new DongBoMayChu(phien, kn));
            Ui.Info(this, (guiLen ? "Đã đưa dữ liệu lên máy chủ " : "Đã tải dữ liệu từ máy chủ ") + kn.GocUrl + "\n\n" +
                          "Từ giờ mỗi lần sửa đều tự gửi lên máy chủ; số nhập trên trang web / điện thoại tự tải về (trạng thái ở góc dưới thanh menu).\n" +
                          "Tiếp theo: tạo tài khoản cho người dùng ở trang web (thẻ Quản trị) hoặc \"Tài khoản người dùng…\".");
            return true;
        }
    }

    /// <summary>Danh sách tài khoản trên máy chủ (quản trị): thêm, sửa quyền / đội, đặt lại mật khẩu, khoá, xoá.</summary>
    class TaiKhoanMayChuForm : Form
    {
        readonly MayChuKetNoi kn;
        readonly DataGridView grid;
        readonly Button bSua, bXoa;
        List<Dictionary<string, object>> ds = new List<Dictionary<string, object>>();
        List<Dictionary<string, object>> doi = new List<Dictionary<string, object>>();

        public TaiKhoanMayChuForm(MayChuKetNoi kn)
        {
            this.kn = kn;
            Text = "Tài khoản trên máy chủ " + kn.GocUrl;
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(860), Ui.S(520));
            MinimizeBox = false;
            ShowInTaskbar = false;
            BackColor = Ui.Surface;

            var hint = new Label
            {
                Dock = DockStyle.Top, Height = Ui.S(58), Font = Ui.Small, ForeColor = Ui.Muted, Padding = Ui.Pad(16, 10, 16, 0),
                Text = "Quyền: \"Chỉ xem\" = xem số liệu, xuất Excel, in — không sửa được (cả trên máy tính); \"Nhập đồng hồ cấp 1\" = thêm nhập chỉ số đồng hồ cấp 1 trên điện thoại / web (có thể giới hạn 1 đội); " +
                       "\"Admin\" = toàn quyền. Đăng nhập trên trang web " + kn.GocUrl + " (trình duyệt, app Android) hoặc phần mềm máy tính."
            };
            grid = new DataGridView { Dock = DockStyle.Fill, ReadOnly = true };
            Ui.StyleGrid(grid);
            grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            grid.MultiSelect = false;
            foreach (var c in new[] { new { T = "Tên đăng nhập", W = 140 }, new { T = "Họ tên", W = 180 }, new { T = "Quyền", W = 150 }, new { T = "Đội", W = 170 },
                                      new { T = "Trạng thái", W = 90 }, new { T = "Đang đăng nhập", W = 100 } })
                grid.Columns.Add(Ui.Col(c.T, c.W, false));
            grid.CellDoubleClick += (s, e) => { if (e.RowIndex >= 0) Sua(); };
            grid.SelectionChanged += (s, e) => CapNhatNut();
            var host = new Panel { Dock = DockStyle.Fill, Padding = Ui.Pad(16, 4, 16, 8) };
            host.Controls.Add(grid);

            var nut = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var bThem = Ui.MakeButton("+ Thêm tài khoản", true);
            bThem.Click += (s, e) => Them();
            bSua = Ui.MakeButton("Sửa / đặt lại mật khẩu…", false);
            bSua.Click += (s, e) => Sua();
            bXoa = Ui.MakeButton("Xoá", false);
            bXoa.Click += (s, e) => Xoa();
            var dong = Ui.MakeButton("Đóng", false);
            dong.DialogResult = DialogResult.Cancel;
            foreach (Button b in new[] { bThem, bSua, bXoa }) nut.Controls.Add(b);
            dong.Margin = Ui.Pad(160, 0, 0, 0);
            nut.Controls.Add(dong);
            Controls.Add(host);
            Controls.Add(hint);
            Controls.Add(nut);
            CancelButton = dong;
            Shown += (s, e) => Nap(null);
        }

        static string C(Dictionary<string, object> d, string k) { object v; return d.TryGetValue(k, out v) && v != null ? Convert.ToString(v) : ""; }

        void NapTu(Dictionary<string, object> r, string chon)
        {
            ds = ((System.Collections.IEnumerable)r["taiKhoan"]).Cast<Dictionary<string, object>>().ToList();
            doi = ((System.Collections.IEnumerable)r["doi"]).Cast<Dictionary<string, object>>().ToList();
            grid.Rows.Clear();
            foreach (var t in ds)
            {
                int i = grid.Rows.Add(C(t, "ten"), C(t, "hoTen"), C(t, "tenVaiTro"), C(t, "tenDoi").Length > 0 ? C(t, "tenDoi") : "Tất cả",
                                      C(t, "khoa") == "True" ? "Đã khoá" : "Dùng được", C(t, "soPhien") == "0" ? "" : C(t, "soPhien") + " thiết bị");
                if (C(t, "khoa") == "True") grid.Rows[i].DefaultCellStyle.ForeColor = Ui.Muted;
                if (C(t, "ten") == chon) grid.CurrentCell = grid.Rows[i].Cells[0];
            }
            CapNhatNut();
        }

        void Nap(string chon)
        {
            Cursor = Cursors.WaitCursor;
            try { NapTu(kn.Json("GET", "taikhoan", null), chon); }
            catch (LoiMayChu ex) { Ui.Error(this, ex.Message); }
            finally { Cursor = Cursors.Default; }
        }

        Dictionary<string, object> Chon()
        {
            int r = grid.CurrentCell != null ? grid.CurrentCell.RowIndex : -1;
            return r >= 0 && r < ds.Count ? ds[r] : null;
        }

        void CapNhatNut()
        {
            bSua.Enabled = bXoa.Enabled = Chon() != null;
        }

        void Them()
        {
            using (var f = new TaiKhoanSuaForm(null, doi))
            {
                while (f.ShowDialog(this) == DialogResult.OK)
                    if (Gui(f, true)) return;
            }
        }

        void Sua()
        {
            Dictionary<string, object> t = Chon();
            if (t == null) return;
            using (var f = new TaiKhoanSuaForm(t, doi))
            {
                while (f.ShowDialog(this) == DialogResult.OK)
                    if (Gui(f, false)) return;
            }
        }

        bool Gui(TaiKhoanSuaForm f, bool moi)
        {
            Cursor = Cursors.WaitCursor;
            try
            {
                NapTu(kn.Json("POST", "taikhoan", new Dictionary<string, object>
                {
                    { "moi", moi }, { "ten", f.Ten }, { "hoTen", f.HoTen }, { "vaiTro", f.VaiTro }, { "doi", f.Doi }, { "khoa", f.Khoa }, { "matKhau", f.MatKhau }
                }), f.Ten);
                if (!string.IsNullOrEmpty(f.MatKhau))
                    Ui.Info(this, "Đã lưu tài khoản \"" + f.Ten + "\".\nĐưa người dùng: địa chỉ " + kn.GocUrl + " , tên " + f.Ten + " và mật khẩu vừa đặt.");
                return true;
            }
            catch (LoiMayChu ex)
            {
                Ui.Error(this, ex.Message);
                return false;
            }
            finally { Cursor = Cursors.Default; }
        }

        void Xoa()
        {
            Dictionary<string, object> t = Chon();
            if (t == null || !Ui.Confirm(this, "Xoá tài khoản \"" + C(t, "ten") + "\"? Điện thoại đang đăng nhập bằng tài khoản này sẽ bị đăng xuất.")) return;
            Cursor = Cursors.WaitCursor;
            try
            {
                kn.Json("DELETE", "taikhoan?ten=" + Uri.EscapeDataString(C(t, "ten")), null);
                Nap(null);
            }
            catch (LoiMayChu ex) { Ui.Error(this, ex.Message); }
            finally { Cursor = Cursors.Default; }
        }
    }

    class TaiKhoanSuaForm : HopThoaiCap1
    {
        class MucDoi
        {
            public int Id;
            public string Ten;
            public override string ToString() { return Ten; }
        }

        static readonly string[] Ma = { "Xem", "NhapLieu", "QuanTri" };
        static readonly string[] TenQuyen = { "Chỉ xem", "Nhập đồng hồ cấp 1 (điện thoại / web)", "Admin (toàn quyền)" };
        readonly TextBox txtTen, txtHoTen, txtMk, txtMk2;
        readonly ComboBox cboQuyen, cboDoi;
        readonly CheckBox chkKhoa;
        readonly bool moi;

        public string Ten { get { return txtTen.Text.Trim(); } }
        public string HoTen { get { return txtHoTen.Text.Trim(); } }
        public string VaiTro { get { return Ma[Math.Max(0, cboQuyen.SelectedIndex)]; } }
        public int Doi { get { var m = cboDoi.SelectedItem as MucDoi; return m != null ? m.Id : -1; } }
        public bool Khoa { get { return chkKhoa.Checked; } }
        public string MatKhau { get { return txtMk.Text; } }

        public TaiKhoanSuaForm(Dictionary<string, object> t, List<Dictionary<string, object>> doi)
            : base(t == null ? "Thêm tài khoản" : "Sửa tài khoản " + Convert.ToString(t["ten"]), 640, 420)
        {
            moi = t == null;
            Func<string, string> c = k => t != null && t.ContainsKey(k) && t[k] != null ? Convert.ToString(t[k]) : "";
            txtTen = O(200, c("ten"), "vd doi5, tram-dongphu");
            txtTen.ReadOnly = !moi;
            Dong("Tên đăng nhập", txtTen);
            txtHoTen = O(320, c("hoTen"), "vd Nguyễn Văn A — Đội 5");
            Dong("Họ tên / ghi chú", txtHoTen);
            cboQuyen = Ui.MakeCombo(220);
            cboQuyen.Items.AddRange(TenQuyen);
            cboQuyen.SelectedIndex = Math.Max(0, Array.IndexOf(Ma, c("vaiTro") == "" ? "NhapLieu" : c("vaiTro")));
            Dong("Quyền", cboQuyen);
            cboDoi = Ui.MakeCombo(260);
            cboDoi.Items.Add(new MucDoi { Id = -1, Ten = "Tất cả các đội" });
            foreach (var d in doi) cboDoi.Items.Add(new MucDoi { Id = Convert.ToInt32(d["id"]), Ten = Convert.ToString(d["ten"]) });
            int doiChon = c("doi").Length > 0 ? int.Parse(c("doi")) : -1;
            cboDoi.SelectedItem = cboDoi.Items.Cast<MucDoi>().FirstOrDefault(x => x.Id == doiChon) ?? cboDoi.Items[0];
            Dong("Đội (đồng hồ cấp 1)", cboDoi);
            txtMk = O(200, "", moi ? "ít nhất 6 ký tự" : "để trống = giữ mật khẩu cũ");
            txtMk.UseSystemPasswordChar = true;
            txtMk2 = O(200, "", null);
            txtMk2.UseSystemPasswordChar = true;
            Dong(moi ? "Mật khẩu" : "Mật khẩu mới", txtMk);
            Dong("Nhập lại", txtMk2);
            chkKhoa = new CheckBox { Text = "Khoá tài khoản (không đăng nhập được)", AutoSize = true, Checked = c("khoa") == "True" };
            Dong("", chkKhoa);
            cboQuyen.SelectedIndexChanged += (s, e) => cboDoi.Enabled = cboQuyen.SelectedIndex != 2;
            cboDoi.Enabled = cboQuyen.SelectedIndex != 2;
            Shown += (s, e) => (moi ? txtTen : txtHoTen).Focus();
        }

        protected override bool KiemTra()
        {
            if (Ten.Length < 2) { Ui.Error(this, "Tên đăng nhập ít nhất 2 ký tự."); return false; }
            if (moi && txtMk.Text.Length < 6) { Ui.Error(this, "Mật khẩu ít nhất 6 ký tự."); return false; }
            if (txtMk.Text.Length > 0 && txtMk.Text.Length < 6) { Ui.Error(this, "Mật khẩu ít nhất 6 ký tự."); return false; }
            if (txtMk.Text != txtMk2.Text) { Ui.Error(this, "Hai lần nhập mật khẩu không giống nhau."); return false; }
            if (cboQuyen.SelectedIndex == 2) cboDoi.SelectedIndex = 0;
            return true;
        }
    }

    /// <summary>Gói cài máy chủ IIS: web\ThatThoatNuoc.exe (chính file đang chạy) + web.config + script cài + hướng dẫn (+ APK nếu có).</summary>
    static class GoiIIS
    {
        public static void Tao(Control owner)
        {
            using (var dlg = new FolderBrowserDialog { Description = "Chọn nơi tạo gói cài máy chủ IIS (vd ổ USB hoặc Desktop)", ShowNewFolderButton = true })
            {
                dlg.SelectedPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                if (dlg.ShowDialog(owner.FindForm()) != DialogResult.OK) return;
                string goc = Path.Combine(dlg.SelectedPath, "ThatThoatNuoc-MayChu-IIS");
                try
                {
                    Tao(goc);
                }
                catch (Exception ex)
                {
                    Ui.Error(owner, "Không tạo được gói: " + ex.Message);
                    return;
                }
                bool coApk = File.Exists(Path.Combine(goc, "web", "ThatThoatNuoc-DienThoai.apk"));
                if (MessageBox.Show(owner.FindForm(), "Đã tạo gói cài máy chủ:\n" + goc + "\n\n" +
                                    "Chép cả thư mục sang máy chủ IIS, nhấp đúp CaiDat-IIS.bat (xem HUONG_DAN_IIS.txt)." +
                                    (coApk ? "\nGói có kèm app Android — điện thoại tải tại http://<máy chủ>/tai-app" : "") + "\n\nMở thư mục?",
                                    UngDung.Ten, MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                    Ui.OpenFile(owner, goc);
            }
        }

        /// <summary>ThatThoatNuoc.exe --tao-goi-iis &lt;thư mục&gt;: tạo gói không cần mở cửa sổ (dùng trong build.ps1). Trả mã thoát.</summary>
        public static int TaoDongLenh(string goc)
        {
            try
            {
                Tao(Path.GetFullPath(goc));
                return 0;
            }
            catch (Exception ex)
            {
                try { File.WriteAllText(Path.GetFullPath(goc) + "-loi.txt", ex.ToString()); } catch (Exception) { }
                return 1;
            }
        }

        public static void Tao(string goc)
        {
            string web = Path.Combine(goc, "web");
            Directory.CreateDirectory(web);
            string exe = typeof(GoiIIS).Assembly.Location;   // chính file đang chạy (dùng được cả khi chạy dòng lệnh, chưa mở cửa sổ)
            File.Copy(exe, Path.Combine(web, "ThatThoatNuoc.exe"), true);
            ChepTaiNguyen("web.config", Path.Combine(web, "web.config"));
            foreach (string t in new[] { "CaiDat-IIS.bat", "CaiDat-IIS.ps1", "HUONG_DAN_IIS.txt" }) ChepTaiNguyen(t, Path.Combine(goc, t));
            string apk = Path.Combine(Path.GetDirectoryName(exe), "ThatThoatNuoc-DienThoai.apk");
            if (File.Exists(apk)) File.Copy(apk, Path.Combine(web, "ThatThoatNuoc-DienThoai.apk"), true);
        }

        static void ChepTaiNguyen(string ten, string den)
        {
            using (Stream s = typeof(GoiIIS).Assembly.GetManifestResourceStream("ThatThoatNuoc.iis." + ten))
            {
                if (s == null) throw new InvalidOperationException("Thiếu tệp " + ten + " trong phần mềm.");
                using (var f = File.Create(den)) s.CopyTo(f);   // giữ nguyên byte (CaiDat-IIS.ps1 có BOM UTF-8)
            }
        }
    }
}
