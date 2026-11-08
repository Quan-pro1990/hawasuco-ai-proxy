using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace ToolkitIT
{
    public static class UngDung
    {
        public const string Ten = "IT Toolkit";
        public const string PhienBan = "1.0.0";
        public const string MoTa = "Bộ công cụ kỹ thuật viên";
    }

    /// <summary>Cài đặt nhỏ của người dùng (giao diện tối, trang mở gần nhất...) lưu trong %AppData%\ITToolkit\caidat.ini</summary>
    static class CaiDat
    {
        static readonly Dictionary<string, string> giaTri = new Dictionary<string, string>();
        static string Tep
        {
            get
            {
                string d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ITToolkit");
                Directory.CreateDirectory(d);
                return Path.Combine(d, "caidat.ini");
            }
        }

        public static void Doc()
        {
            try
            {
                if (!File.Exists(Tep)) return;
                foreach (string dong in File.ReadAllLines(Tep, Encoding.UTF8))
                {
                    int i = dong.IndexOf('=');
                    if (i > 0) giaTri[dong.Substring(0, i).Trim()] = dong.Substring(i + 1).Trim();
                }
            }
            catch (Exception) { }
        }

        public static string Lay(string khoa, string macDinh)
        {
            string v;
            return giaTri.TryGetValue(khoa, out v) ? v : macDinh;
        }

        public static void Luu(string khoa, string v)
        {
            giaTri[khoa] = v ?? "";
            try
            {
                var sb = new StringBuilder();
                foreach (KeyValuePair<string, string> kv in giaTri) sb.Append(kv.Key).Append('=').Append(kv.Value).Append("\r\n");
                File.WriteAllText(Tep, sb.ToString(), Encoding.UTF8);
            }
            catch (Exception) { }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += (s, e) => BaoLoi(e.Exception);
            AppDomain.CurrentDomain.UnhandledException += (s, e) => BaoLoi(e.ExceptionObject as Exception);

            if (!HeThong.LaQuanTri())
            {
                // tệp manifest đã yêu cầu quyền Admin; phòng khi bị chạy kiểu khác thì xin lại quyền
                try
                {
                    Process.Start(new ProcessStartInfo(Application.ExecutablePath) { UseShellExecute = true, Verb = "runas" });
                    return;
                }
                catch (Exception)
                {
                    MessageBox.Show("Phần mềm cần chạy với quyền Administrator (chuột phải > Run as administrator).\n" +
                                    "Không có quyền Admin, phần lớn chức năng sửa lỗi sẽ không chạy được.",
                        UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }

            using (var mutex = new Mutex(false, "ITToolkit_MotCuaSo"))
            {
                bool duoc;
                try { duoc = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { duoc = true; }
                if (!duoc)
                {
                    MessageBox.Show(UngDung.Ten + " đang mở rồi.", UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                CaiDat.Doc();
                Ui.Toi = CaiDat.Lay("toi", "0") == "1";
                Application.Run(new MainForm());
            }
        }

        static void BaoLoi(Exception ex)
        {
            if (ex == null) return;
            try { NhatKy.Chung.Loi("Lỗi không mong muốn: " + ex); } catch (Exception) { }
            MessageBox.Show("Có lỗi không mong muốn:\n\n" + HeThong.ThongDiep(ex) + "\n\nChi tiết đã ghi vào nhật ký.",
                UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
