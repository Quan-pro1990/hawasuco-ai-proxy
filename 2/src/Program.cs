using System;
using System.Threading;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Trạng thái dùng chung giữa các trang: dữ liệu, bộ tính, tháng đang chọn.</summary>
    public class PhienLam
    {
        public readonly KhoDuLieu Kho;
        public BoTinh Bt { get; private set; }
        public DongBoMayChu DongBo;     // khác null khi dữ liệu nằm trên máy chủ IIS
        public string NguoiDung = "";   // tên hiện ở thanh menu ("" = chưa đặt người dùng, ai mở cũng toàn quyền)
        public bool ChiXem;             // tài khoản chỉ xem: không lưu bất kỳ thay đổi nào
        bool daBaoChiXem;
        ThangBaoCao thangChon;

        /// <summary>Số liệu / cấu trúc vừa đổi; sender = trang gây ra thay đổi.</summary>
        public event EventHandler DaDoi;
        public event EventHandler DoiThang;

        public PhienLam(KhoDuLieu kho)
        {
            Kho = kho;
            Bt = new BoTinh(kho.DuLieu);
            thangChon = kho.DuLieu.ThangCuoi;
        }

        public DuLieu Dl { get { return Kho.DuLieu; } }

        public ThangBaoCao ThangChon
        {
            get
            {
                if (thangChon != null && !Dl.Thang.Contains(thangChon)) thangChon = Dl.ThangCuoi;
                return thangChon;
            }
        }

        public void ChonThang(ThangBaoCao t)
        {
            if (t == thangChon) return;
            thangChon = t;
            EventHandler h = DoiThang;
            if (h != null) h(this, EventArgs.Empty);
        }

        /// <summary>Bật / tắt đồng bộ máy chủ (null = dữ liệu chỉ trên máy này).</summary>
        public event EventHandler DoiDongBo;

        public void DatDongBo(DongBoMayChu d)
        {
            if (DongBo != null) DongBo.Dispose();
            DongBo = d;
            EventHandler h = DoiDongBo;
            if (h != null) h(this, EventArgs.Empty);
            if (d != null) d.BatDau();
        }

        /// <summary>Thay toàn bộ dữ liệu (bản mới tải từ máy chủ), giữ tháng đang chọn, báo mọi trang nạp lại.</summary>
        public void ThayDuLieu(DuLieu moi)
        {
            int so = thangChon != null ? thangChon.SoThu : -1;
            Kho.DuLieu = moi;
            Bt = new BoTinh(moi);
            thangChon = moi.TimThang(so) ?? moi.ThangCuoi;
            EventHandler h = DaDoi;
            if (h != null) h(null, EventArgs.Empty);
        }

        /// <summary>Tính lại, ghi file ngay (mỗi lần sửa đều lưu), báo các trang cập nhật.</summary>
        public void Luu(object nguon)
        {
            if (ChiXem)
            {
                // tài khoản chỉ xem: không lưu, trả dữ liệu về như cũ (phòng khi còn chỗ nào sửa lọt)
                try { Kho.Doc(); } catch (Exception) { }
                ThayDuLieu(Kho.DuLieu);
                if (!daBaoChiXem)
                {
                    daBaoChiXem = true;
                    MessageBox.Show("Tài khoản " + NguoiDung + " chỉ được xem, không được sửa số liệu.", UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    daBaoChiXem = false;
                }
                return;
            }
            Bt.XoaBoNho();
            try
            {
                Kho.Luu();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Không lưu được dữ liệu:\n" + ex.Message + "\n\nThư mục: " + Kho.ThuMuc, UngDung.Ten,
                                MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            EventHandler h = DaDoi;
            if (h != null) h(nguon, EventArgs.Empty);
        }
    }

    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            // IIS (ASP.NET Core Module) chạy file này với biến ASPNETCORE_PORT → chế độ máy chủ, không có cửa sổ.
            if (MayChu.LaCheDoMayChu(args)) return MayChu.Chay(args);
            ChayGiaoDien(Array.IndexOf(args, "--khoi-dong-lai") >= 0);
            return 0;
        }

        static void ChayGiaoDien(bool khoiDongLai)
        {
            // Chỉ cho mở 1 cửa sổ: 2 cửa sổ cùng ghi 1 file dữ liệu thì bản lưu sau đè mất bản trước.
            // Mở lại (đổi người dùng): chờ bản cũ đóng hẳn.
            using (var mutex = new Mutex(false, "ThatThoatNuoc_SingleInstance"))
            {
                bool co;
                try { co = mutex.WaitOne(khoiDongLai ? 15000 : 0); }
                catch (AbandonedMutexException) { co = true; }
                if (!co)
                {
                    MessageBox.Show("Phần mềm " + UngDung.Ten + " đang mở rồi.", UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
                Application.ThreadException += (s, e) => ShowError(e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (s, e) => ShowError(e.ExceptionObject as Exception);

                KhoDuLieu kho;
                try
                {
                    kho = KhoDuLieu.Mo();
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Không mở được dữ liệu:\n\n" + ex.Message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
                System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
                var phien = new PhienLam(kho);
                MayChuKetNoi kn = MayChuKetNoi.Doc(kho.ThuMuc);
                if (!DangNhap(phien, kn)) { mutex.ReleaseMutex(); return; }
                var form = new MainForm(phien);
                if (kn != null) phien.DatDongBo(new DongBoMayChu(phien, kn));   // dữ liệu nằm trên máy chủ IIS
                Application.Run(form);
                mutex.ReleaseMutex();
            }
        }

        /// <summary>
        /// Đăng nhập khi mở phần mềm. Đã nối máy chủ: tài khoản máy chủ (Admin / chỉ xem). Chưa nối: người dùng trên máy;
        /// chưa có ai thì lần đầu mời tạo Admin (bỏ qua được — khi đó ai mở cũng toàn quyền như trước).
        /// </summary>
        static bool DangNhap(PhienLam phien, MayChuKetNoi kn)
        {
            if (kn != null)
            {
                if (!string.IsNullOrEmpty(kn.Token))
                {
                    try
                    {
                        // kiểm tra mã đăng nhập còn dùng được, cập nhật quyền (Admin có thể vừa đổi quyền tài khoản này)
                        var toi = kn.Json("GET", "toi", null, 6000);
                        kn.VaiTro = Convert.ToString(toi["vaiTro"]);
                        kn.HoTen = Convert.ToString(toi["hoTen"]);
                    }
                    catch (LoiMayChu ex)
                    {
                        if (ex.Status == 401) kn.Token = "";   // hết hạn / bị thu hồi → đăng nhập lại
                    }
                }
                if (string.IsNullOrEmpty(kn.Token))
                {
                    using (var f = new DangNhapForm(null, kn))
                    {
                        if (f.ShowDialog() != DialogResult.OK) return false;
                        kn.NhoDangNhap = !f.KhongGhiNho;
                    }
                }
                try { kn.Ghi(phien.Kho.ThuMuc); } catch (Exception) { }
                phien.NguoiDung = kn.Ten;
                phien.ChiXem = !kn.LaQuanTri;
                return true;
            }
            DanhSachNguoiDung ds = DanhSachNguoiDung.Doc(phien.Kho.ThuMuc);
            if (ds.Co)
            {
                using (var f = new DangNhapForm(ds, null))
                {
                    if (f.ShowDialog() != DialogResult.OK) return false;
                    phien.NguoiDung = f.NguoiCucBo.Ten;
                    phien.ChiXem = !f.NguoiCucBo.Admin;
                }
                return true;
            }
            if (!ds.DaHoiTaoAdmin)
            {
                ds.DaHoiTaoAdmin = true;
                using (var f = new NguoiDungSuaForm("Tạo tài khoản Admin cho phần mềm", null, true, "Tạo Admin", "Để sau"))
                {
                    f.StartPosition = FormStartPosition.CenterScreen;
                    f.ShowInTaskbar = true;
                    if (f.ShowDialog() == DialogResult.OK)
                    {
                        var n = new NguoiDungCucBo { Ten = f.Ten, HoTen = f.HoTen, Admin = true };
                        MatKhau.Tao(f.MatKhauMoi, out n.Muoi, out n.Bam);
                        ds.Ds.Add(n);
                        phien.NguoiDung = n.Ten;
                        MessageBox.Show("Đã tạo Admin \"" + n.Ten + "\". Từ lần mở sau phải đăng nhập.\n\n" +
                                        "Tạo tài khoản chỉ xem cho người khác ở: Cài đặt → Người dùng.", UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                }
                try { ds.Ghi(phien.Kho.ThuMuc); } catch (Exception) { }
            }
            return true;
        }

        static void ShowError(Exception ex)
        {
            if (ex == null) return;
            MessageBox.Show("Đã xảy ra lỗi:\n\n" + ex.Message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
