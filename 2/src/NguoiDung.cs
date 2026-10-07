using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;
using System.Xml.Linq;

namespace ThatThoatNuoc
{
    /// <summary>Băm mật khẩu PBKDF2 (dùng cho tài khoản trên máy và trên máy chủ).</summary>
    public static class MatKhau
    {
        public const int LapLai = 100000;

        public static string Bam(string matKhau, string muoi, int lap)
        {
            using (var k = new Rfc2898DeriveBytes(Encoding.UTF8.GetBytes(matKhau ?? ""), Convert.FromBase64String(muoi), lap))
                return Convert.ToBase64String(k.GetBytes(32));
        }

        public static void Tao(string matKhau, out string muoi, out string bam)
        {
            var b = new byte[16];
            using (var r = RandomNumberGenerator.Create()) r.GetBytes(b);
            muoi = Convert.ToBase64String(b);
            bam = Bam(matKhau, muoi, LapLai);
        }

        public static bool Dung(string matKhau, string muoi, string bam, int lap)
        {
            if (string.IsNullOrEmpty(muoi) || string.IsNullOrEmpty(bam)) return false;
            return MayChu.BangNhau(Bam(matKhau, muoi, lap), bam);
        }
    }

    /// <summary>Người dùng phần mềm trên máy (khi chưa nối máy chủ): Admin = toàn quyền, còn lại chỉ xem.</summary>
    public class NguoiDungCucBo
    {
        public string Ten = "", HoTen = "", Muoi = "", Bam = "";
        public int Lap = MatKhau.LapLai;
        public bool Admin;
    }

    /// <summary>DuLieu\nguoidung.xml</summary>
    public class DanhSachNguoiDung
    {
        const string TenTep = "nguoidung.xml";
        public readonly List<NguoiDungCucBo> Ds = new List<NguoiDungCucBo>();
        public bool DaHoiTaoAdmin;

        public bool Co { get { return Ds.Count > 0; } }

        public NguoiDungCucBo Tim(string ten)
        {
            return Ds.FirstOrDefault(x => string.Equals(x.Ten, (ten ?? "").Trim(), StringComparison.OrdinalIgnoreCase));
        }

        public static DanhSachNguoiDung Doc(string thuMuc)
        {
            var d = new DanhSachNguoiDung();
            string p = Path.Combine(thuMuc, TenTep);
            if (!File.Exists(p)) return d;
            XElement r = XDocument.Load(p).Root;
            d.DaHoiTaoAdmin = (string)r.Attribute("daHoi") == "1";
            foreach (XElement e in r.Elements("NguoiDung"))
                d.Ds.Add(new NguoiDungCucBo
                {
                    Ten = (string)e.Attribute("ten") ?? "", HoTen = (string)e.Attribute("hoTen") ?? "", Muoi = (string)e.Attribute("muoi") ?? "",
                    Bam = (string)e.Attribute("bam") ?? "", Lap = (int?)e.Attribute("lap") ?? MatKhau.LapLai, Admin = (string)e.Attribute("admin") == "1"
                });
            return d;
        }

        public void Ghi(string thuMuc)
        {
            var r = new XElement("NguoiDung", new XAttribute("daHoi", DaHoiTaoAdmin ? 1 : 0));
            foreach (NguoiDungCucBo n in Ds)
                r.Add(new XElement("NguoiDung", new XAttribute("ten", n.Ten), new XAttribute("hoTen", n.HoTen), new XAttribute("admin", n.Admin ? 1 : 0),
                                   new XAttribute("muoi", n.Muoi), new XAttribute("bam", n.Bam), new XAttribute("lap", n.Lap)));
            string p = Path.Combine(thuMuc, TenTep);
            new XDocument(r).Save(p + ".tmp");
            if (File.Exists(p)) File.Replace(p + ".tmp", p, null);
            else File.Move(p + ".tmp", p);
        }

        public NguoiDungCucBo KiemTra(string ten, string matKhau)
        {
            NguoiDungCucBo n = Tim(ten);
            return n != null && MatKhau.Dung(matKhau, n.Muoi, n.Bam, n.Lap) ? n : null;
        }
    }

    /// <summary>
    /// Khoá giao diện cho tài khoản chỉ xem: tắt mọi nút (trừ nút xem / xuất / in đã đánh dấu), ô chữ chỉ đọc,
    /// lưới không sửa được, bỏ nhấp đúp / phím Delete / Insert / dán trên lưới.
    /// </summary>
    public static class QuyenUi
    {
        static readonly HashSet<Control> choXem = new HashSet<Control>();

        /// <summary>Đánh dấu nút vẫn dùng được khi chỉ xem (xuất Excel, in, chuyển chế độ xem…).</summary>
        public static T ChoXem<T>(T c) where T : Control
        {
            choXem.Add(c);
            return c;
        }

        public static void KhoaChiXem(Control goc)
        {
            foreach (Control c in goc.Controls.Cast<Control>().ToList())
            {
                if (c is ButtonBase || c is CheckBox || c is RadioButton)
                {
                    if (!choXem.Contains(c))
                    {
                        c.Enabled = false;
                        c.EnabledChanged += (s, e) => { if (c.Enabled) c.Enabled = false; };   // trang tự bật lại nút khi đổi dòng → tắt tiếp
                    }
                }
                else if (c is TextBoxBase) ((TextBoxBase)c).ReadOnly = true;
                else if (c is NumericUpDown) c.Enabled = false;
                else if (c is DataGridView)
                {
                    var g = (DataGridView)c;
                    g.ReadOnly = true;
                    BoSuKien(g, typeof(DataGridView), "EVENT_DATAGRIDVIEWCELLDOUBLECLICK");
                    BoSuKien(g, typeof(Control), "EventKeyDown");
                }
                if (c.HasChildren) KhoaChiXem(c);
            }
        }

        static void BoSuKien(Component c, Type loai, string tenKhoa)
        {
            FieldInfo f = loai.GetField(tenKhoa, BindingFlags.NonPublic | BindingFlags.Static);
            PropertyInfo p = typeof(Component).GetProperty("Events", BindingFlags.NonPublic | BindingFlags.Instance);
            if (f == null || p == null) return;
            var ds = (System.ComponentModel.EventHandlerList)p.GetValue(c, null);
            ds[f.GetValue(null)] = null;
        }
    }

    /// <summary>Đăng nhập khi mở phần mềm: tài khoản trên máy, hoặc tài khoản máy chủ khi đã nối máy chủ.</summary>
    class DangNhapForm : HopThoaiCap1
    {
        readonly TextBox txtTen, txtMk;
        readonly CheckBox chkNho;
        readonly Label lblLoi;
        readonly DanhSachNguoiDung ds;
        readonly MayChuKetNoi kn;

        public NguoiDungCucBo NguoiCucBo { get; private set; }

        public DangNhapForm(DanhSachNguoiDung ds, MayChuKetNoi kn) : base("Đăng nhập — " + UngDung.Ten, 600, kn != null ? 330 : 300)
        {
            this.ds = ds;
            this.kn = kn;
            ShowInTaskbar = true;
            StartPosition = FormStartPosition.CenterScreen;
            try { Icon = Ui.AppIcon(); } catch (Exception) { }
            BtnLuu.Text = "Đăng nhập";
            BtnHuy.Text = "Thoát";
            var tieuDe = Ui.MakeLabel(kn != null ? "Dữ liệu trên máy chủ  " + kn.GocUrl : "Dữ liệu trên máy này", Ui.BaseBold, Ui.Text);
            tieuDe.UseMnemonic = false;
            Dong("", tieuDe);
            txtTen = O(240, kn != null ? kn.Ten : "", null);
            Dong("Tên đăng nhập", txtTen);
            txtMk = O(240, "", null);
            txtMk.UseSystemPasswordChar = true;
            Dong("Mật khẩu", txtMk);
            if (kn != null)
            {
                chkNho = new CheckBox { Text = "Ghi nhớ đăng nhập trên máy này", AutoSize = true, Checked = true };
                Dong("", chkNho);
            }
            lblLoi = Ui.MakeLabel("", Ui.Base, Ui.Danger);
            lblLoi.MaximumSize = new Size(Ui.S(380), 0);
            Dong("", lblLoi);
            Shown += (s, e) => (txtTen.Text.Length > 0 ? txtMk : txtTen).Focus();
        }

        protected override bool KiemTra()
        {
            lblLoi.Text = "";
            string ten = txtTen.Text.Trim();
            if (ten.Length == 0 || txtMk.Text.Length == 0) { lblLoi.Text = "Nhập tên đăng nhập và mật khẩu."; return false; }
            if (kn == null)
            {
                NguoiCucBo = ds.KiemTra(ten, txtMk.Text);
                if (NguoiCucBo == null) { lblLoi.Text = "Sai tên đăng nhập hoặc mật khẩu."; txtMk.SelectAll(); txtMk.Focus(); return false; }
                return true;
            }
            Cursor = Cursors.WaitCursor;
            try
            {
                kn.DangNhap(ten, txtMk.Text);
                if (!chkNho.Checked) KhongGhiNho = true;
                return true;
            }
            catch (LoiMayChu ex)
            {
                lblLoi.Text = ex.Message;
                txtMk.SelectAll();
                txtMk.Focus();
                return false;
            }
            finally { Cursor = Cursors.Default; }
        }

        public bool KhongGhiNho { get; private set; }
    }

    /// <summary>Lần đầu: tạo tài khoản Admin (toàn quyền) cho phần mềm trên máy này.</summary>
    class NguoiDungSuaForm : HopThoaiCap1
    {
        readonly TextBox txtTen, txtHoTen, txtMk, txtMk2;
        readonly ComboBox cboQuyen;
        readonly bool moi;

        public string Ten { get { return txtTen.Text.Trim(); } }
        public string HoTen { get { return txtHoTen.Text.Trim(); } }
        public bool Admin { get { return cboQuyen.SelectedIndex == 0; } }
        public string MatKhauMoi { get { return txtMk.Text; } }

        public NguoiDungSuaForm(string tieuDe, NguoiDungCucBo n, bool adminCoDinh, string nutLuu = "Lưu", string nutHuy = "Huỷ")
            : base(tieuDe, 600, 360)
        {
            moi = n == null;
            BtnLuu.Text = nutLuu;
            BtnHuy.Text = nutHuy;
            txtTen = O(220, n != null ? n.Ten : (adminCoDinh ? "Admin" : ""), "vd Admin, nhanvien1");
            txtTen.ReadOnly = !moi;
            Dong("Tên đăng nhập", txtTen);
            txtHoTen = O(300, n != null ? n.HoTen : "", "vd Nguyễn Văn A — Phòng Kinh doanh");
            Dong("Họ tên / ghi chú", txtHoTen);
            cboQuyen = Ui.MakeCombo(260);
            cboQuyen.Items.AddRange(new object[] { "Admin (toàn quyền)", "Người dùng (chỉ xem)" });
            cboQuyen.SelectedIndex = n == null ? (adminCoDinh ? 0 : 1) : (n.Admin ? 0 : 1);
            cboQuyen.Enabled = !adminCoDinh;
            Dong("Quyền", cboQuyen);
            txtMk = O(220, "", moi ? "ít nhất 6 ký tự" : "để trống = giữ mật khẩu cũ");
            txtMk.UseSystemPasswordChar = true;
            txtMk2 = O(220, "", null);
            txtMk2.UseSystemPasswordChar = true;
            Dong(moi ? "Mật khẩu" : "Mật khẩu mới", txtMk);
            Dong("Nhập lại", txtMk2);
            GhiChu("Admin: nhập, sửa, xoá số liệu, cài đặt. Người dùng chỉ xem: xem số liệu, xuất Excel, in — không sửa được gì.");
            Shown += (s, e) => (moi ? (adminCoDinh ? (Control)txtMk : txtTen) : txtHoTen).Focus();
        }

        protected override bool KiemTra()
        {
            if (Ten.Length < 2 || Ten.Any(char.IsWhiteSpace)) { Ui.Error(this, "Tên đăng nhập ít nhất 2 ký tự, không có khoảng trắng."); return false; }
            if ((moi || txtMk.Text.Length > 0) && txtMk.Text.Length < 6) { Ui.Error(this, "Mật khẩu ít nhất 6 ký tự."); return false; }
            if (txtMk.Text != txtMk2.Text) { Ui.Error(this, "Hai lần nhập mật khẩu không giống nhau."); return false; }
            return true;
        }
    }

    /// <summary>Danh sách người dùng trên máy (Admin quản lý).</summary>
    class NguoiDungForm : Form
    {
        readonly string thuMuc;
        readonly DanhSachNguoiDung ds;
        readonly DataGridView grid;
        readonly string toi;

        public NguoiDungForm(string thuMuc, string tenDangDung)
        {
            this.thuMuc = thuMuc;
            toi = tenDangDung;
            ds = DanhSachNguoiDung.Doc(thuMuc);
            Text = "Người dùng phần mềm trên máy này";
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(720), Ui.S(440));
            MinimizeBox = false;
            ShowInTaskbar = false;
            BackColor = Ui.Surface;
            var hint = new Label
            {
                Dock = DockStyle.Top, Height = Ui.S(52), Font = Ui.Small, ForeColor = Ui.Muted, Padding = Ui.Pad(16, 10, 16, 0),
                Text = "Admin: toàn quyền. Người dùng: chỉ xem số liệu, xuất Excel, in — không sửa được gì. Mở phần mềm phải đăng nhập. " +
                       "(Khi đã nối máy chủ, phần mềm dùng tài khoản trên máy chủ thay cho danh sách này.)"
            };
            grid = new DataGridView { Dock = DockStyle.Fill, ReadOnly = true };
            Ui.StyleGrid(grid);
            grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            grid.MultiSelect = false;
            grid.Columns.Add(Ui.Col("Tên đăng nhập", 160, false));
            grid.Columns.Add(Ui.Col("Họ tên", 260, false));
            grid.Columns.Add(Ui.Col("Quyền", 200, false));
            grid.CellDoubleClick += (s, e) => { if (e.RowIndex >= 0) Sua(); };
            var host = new Panel { Dock = DockStyle.Fill, Padding = Ui.Pad(16, 4, 16, 8) };
            host.Controls.Add(grid);
            var nut = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var bThem = Ui.MakeButton("+ Thêm người dùng", true);
            bThem.Click += (s, e) => Them();
            var bSua = Ui.MakeButton("Sửa / đổi mật khẩu…", false);
            bSua.Click += (s, e) => Sua();
            var bXoa = Ui.MakeButton("Xoá", false);
            bXoa.Click += (s, e) => Xoa();
            var dong = Ui.MakeButton("Đóng", false);
            dong.DialogResult = DialogResult.Cancel;
            dong.Margin = Ui.Pad(100, 0, 0, 0);
            foreach (Button b in new[] { bThem, bSua, bXoa, dong }) nut.Controls.Add(b);
            Controls.Add(host);
            Controls.Add(hint);
            Controls.Add(nut);
            CancelButton = dong;
            Nap(null);
        }

        void Nap(string chon)
        {
            grid.Rows.Clear();
            foreach (NguoiDungCucBo n in ds.Ds.OrderByDescending(x => x.Admin).ThenBy(x => x.Ten))
            {
                int i = grid.Rows.Add(n.Ten, n.HoTen, n.Admin ? "Admin (toàn quyền)" : "Người dùng (chỉ xem)");
                grid.Rows[i].Tag = n;
                if (n.Ten == chon) grid.CurrentCell = grid.Rows[i].Cells[0];
            }
        }

        NguoiDungCucBo Chon() { return grid.CurrentRow != null ? grid.CurrentRow.Tag as NguoiDungCucBo : null; }

        bool Luu()
        {
            try { ds.Ghi(thuMuc); return true; }
            catch (Exception ex) { Ui.Error(this, "Không lưu được: " + ex.Message); return false; }
        }

        void Them()
        {
            using (var f = new NguoiDungSuaForm("Thêm người dùng", null, false))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
                if (ds.Tim(f.Ten) != null) { Ui.Error(this, "Đã có người dùng \"" + f.Ten + "\"."); return; }
                var n = new NguoiDungCucBo { Ten = f.Ten, HoTen = f.HoTen, Admin = f.Admin };
                MatKhau.Tao(f.MatKhauMoi, out n.Muoi, out n.Bam);
                ds.Ds.Add(n);
                if (Luu()) Nap(n.Ten);
            }
        }

        void Sua()
        {
            NguoiDungCucBo n = Chon();
            if (n == null) return;
            using (var f = new NguoiDungSuaForm("Sửa người dùng " + n.Ten, n, false))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
                if (n.Admin && !f.Admin && ds.Ds.Count(x => x.Admin) <= 1) { Ui.Error(this, "Phải còn ít nhất 1 Admin."); return; }
                n.HoTen = f.HoTen;
                n.Admin = f.Admin;
                if (f.MatKhauMoi.Length > 0) { MatKhau.Tao(f.MatKhauMoi, out n.Muoi, out n.Bam); n.Lap = MatKhau.LapLai; }
                if (Luu()) Nap(n.Ten);
            }
        }

        void Xoa()
        {
            NguoiDungCucBo n = Chon();
            if (n == null) return;
            if (n.Admin && ds.Ds.Count(x => x.Admin) <= 1) { Ui.Error(this, "Phải còn ít nhất 1 Admin."); return; }
            if (string.Equals(n.Ten, toi, StringComparison.OrdinalIgnoreCase)) { Ui.Error(this, "Không xoá tài khoản đang đăng nhập."); return; }
            if (!Ui.Confirm(this, "Xoá người dùng \"" + n.Ten + "\"?")) return;
            ds.Ds.Remove(n);
            if (Luu()) Nap(null);
        }
    }

    static class KhoiDongLai
    {
        /// <summary>Mở lại phần mềm (đổi người dùng / đổi quyền): chạy bản mới rồi đóng bản này.</summary>
        public static void Chay()
        {
            try { Process.Start(Application.ExecutablePath, "--khoi-dong-lai"); }
            catch (Exception) { return; }
            Application.Exit();
        }
    }
}
