using System;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace ChinhAnhAI
{
    static class Program
    {
        /// <summary>
        /// ChinhAnhAI.exe [ảnh…]  — mở ảnh (nhiều ảnh: hỏi chỉnh hàng loạt). Dùng được với "Gửi tới" / "Mở bằng" của Windows.
        /// ChinhAnhAI.exe --tu-dong thư_mục_ra ảnh…  — chỉnh tự động không mở cửa sổ (dùng trong script).
        /// </summary>
        [STAThread]
        static int Main(string[] args)
        {
            if (args.Length >= 2 && args[0] == "--tu-dong") return ChayDongLenh(args[1], args.Skip(2).ToArray());

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += (s, e) => BaoLoi(e.Exception);
            AppDomain.CurrentDomain.UnhandledException += (s, e) => BaoLoi(e.ExceptionObject as Exception);
            System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;

            Application.Run(new MainForm(CaiDat.Doc(), args));
            return 0;
        }

        [DllImport("kernel32.dll")]
        static extern bool AttachConsole(int pid);

        static int ChayDongLenh(string thuMucRa, string[] tep)
        {
            try { AttachConsole(-1); } catch (Exception) { }   // chạy từ CMD: in kết quả ra cửa sổ đó
            CaiDat cd = CaiDat.Doc();
            Directory.CreateDirectory(thuMucRa);
            int loi = 0;
            foreach (string t in tep.Where(AnhNguon.LaAnh))
            {
                try
                {
                    AnhNguon g = AnhNguon.Mo(t);
                    KetQuaPhanTich pt = PhanTich.Chay(g, g.ThuNho(1600));
                    ThongSo p = PhongCach.Ap(pt, PhongCach.Tim(cd.PhongCach) != null ? cd.PhongCach : "tu_dong").NhanCuongDo(cd.CuongDo / 100.0);
                    AnhNguon src = cd.CanhDaiXuat > 0 ? g.ThuNho(cd.CanhDaiXuat) : g;
                    string dich = new CaiDat { ThuMucLuu = thuMucRa, HauTo = cd.HauTo }.DuongDanLuu(t);
                    AnhNguon.Luu(XuLyAnh.Ve(src, p), src.W, src.H, dich, cd.ChatLuongJpeg, src.Exif);
                    Console.WriteLine(dich + "  ·  " + pt.MoTa);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(t + ": " + ex.Message);
                    loi++;
                }
            }
            return loi == 0 ? 0 : 1;
        }

        static void BaoLoi(Exception ex)
        {
            if (ex == null) return;
            MessageBox.Show("Đã xảy ra lỗi:\n\n" + ex.Message, UngDung.Ten, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
