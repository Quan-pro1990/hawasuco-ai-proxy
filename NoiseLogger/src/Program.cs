using System;
using System.Threading;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>Dữ liệu đang mở, dùng chung giữa các trang.</summary>
    public class PhienNl
    {
        public readonly KhoDuLieu Kho;

        /// <summary>Số liệu vừa đổi; sender = trang / hộp thoại gây ra thay đổi.</summary>
        public event EventHandler DaDoi;

        public PhienNl(KhoDuLieu kho)
        {
            Kho = kho;
        }

        public DuLieuNl Dl { get { return Kho.DuLieu; } }

        /// <summary>Ghi file ngay (mỗi lần sửa đều lưu), báo các trang cập nhật.</summary>
        public void Luu(object nguon)
        {
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
        static void Main()
        {
            // Chỉ cho mở 1 cửa sổ: 2 cửa sổ cùng ghi 1 file dữ liệu thì bản lưu sau đè mất bản trước.
            using (var mutex = new Mutex(false, "NoiseLogger_SingleInstance"))
            {
                bool co;
                try { co = mutex.WaitOne(0); }
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
                Application.Run(new MainForm(new PhienNl(kho)));
                mutex.ReleaseMutex();
            }
        }

        static void ShowError(Exception ex)
        {
            if (ex == null) return;
            MessageBox.Show("Đã xảy ra lỗi:\n\n" + ex.Message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
