using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace QuanLyTaiSan
{
    /// <summary>
    /// QuanLyTaiSan.exe
    ///   (nhấp đúp)                    chạy thử trên máy này: http://localhost:18090 , dữ liệu ở thư mục DuLieu cạnh file .exe
    ///   --cong 18090                  đổi cổng khi chạy thử
    ///   --lan                         cho máy khác trong mạng nội bộ vào (http, không mã hoá — chỉ để dùng thử)
    ///   --dat-quan-tri &lt;tên&gt;          tạo / đặt lại tài khoản quản trị (mật khẩu trong biến QLTS_MATKHAU) — script cài IIS dùng
    /// Dưới IIS (có biến ASPNETCORE_PORT): chế độ máy chủ, dữ liệu ở thư mục trong biến QLTS_DULIEU.
    /// </summary>
    static class Program
    {
        static int Main(string[] args)
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            bool quaIis = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_PORT"));
            string thuMuc = ThuMucDuLieu(quaIis || args.Contains("--dat-quan-tri"));
            DichVu dv;
            try
            {
                dv = new DichVu(thuMuc, quaIis || args.Contains("--dat-quan-tri") ? 20 : 0);
            }
            catch (DangChayException ex)
            {
                GhiLoiKhoiDong(thuMuc, ex);
                if (!quaIis && !args.Contains("--dat-quan-tri"))
                {
                    // nhấp đúp lần 2 khi đang chạy thử: mở lại trình duyệt vào bản đang chạy
                    Console.WriteLine("Phan mem dang chay (o cua so khac). Mo trinh duyet...");
                    int c = 18090;
                    int j = Array.IndexOf(args, "--cong");
                    if (j >= 0 && j + 1 < args.Length) int.TryParse(args[j + 1], out c);
                    MoTrinhDuyet("http://localhost:" + c + "/", args);
                    return 2;
                }
                return 3;
            }
            catch (Exception ex)
            {
                GhiLoiKhoiDong(thuMuc, ex);
                if (!quaIis) { Console.WriteLine("Khong mo duoc du lieu: " + ex.Message); Dung(); }
                return 3;
            }

            int i = Array.IndexOf(args, "--dat-quan-tri");
            if (i >= 0)
            {
                string ten = i + 1 < args.Length ? args[i + 1] : "admin";
                string mk = Environment.GetEnvironmentVariable("QLTS_MATKHAU") ?? "";
                try { dv.DatQuanTri(ten, mk); }
                catch (LoiApi ex) { Console.WriteLine(ex.Message); return 4; }
                return 0;
            }
            if (args.Contains("--kiem-tra")) return 0;

            if (quaIis)
            {
                int congIis;
                if (!int.TryParse(Environment.GetEnvironmentVariable("ASPNETCORE_PORT"), out congIis)) return 2;
                try { MayChu.Chay(dv, IPAddress.Loopback, congIis, true); }
                catch (Exception ex) { GhiLoiKhoiDong(thuMuc, ex); return 5; }
                return 0;
            }
            return ChayThu(dv, args);
        }

        public static string ThuMucDuLieu(bool mayChu)
        {
            string d = Environment.GetEnvironmentVariable("QLTS_DULIEU");
            if (string.IsNullOrWhiteSpace(d))
                d = mayChu ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "QuanLyTaiSan")
                           : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "DuLieu");
            return Environment.ExpandEnvironmentVariables(d.Trim());
        }

        static void GhiLoiKhoiDong(string thuMuc, Exception ex)
        {
            try
            {
                Directory.CreateDirectory(thuMuc);
                File.AppendAllText(Path.Combine(thuMuc, "loi-khoi-dong.txt"), DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + ex + "\r\n", Encoding.UTF8);
            }
            catch (Exception) { }
        }

        // ------------------------------------------------------------------ chạy thử trên 1 máy (không cần IIS)

        static int ChayThu(DichVu dv, string[] args)
        {
            try { Console.Title = UngDung.Ten; } catch (Exception) { }
            int cong = 18090;
            int j = Array.IndexOf(args, "--cong");
            if (j >= 0 && j + 1 < args.Length) int.TryParse(args[j + 1], out cong);
            bool lan = args.Contains("--lan");
            string diaChi = "http://localhost:" + cong + "/";

            Console.WriteLine("==============================================================");
            Console.WriteLine("  QUAN LY TAI SAN - ban " + UngDung.PhienBan + " (chay thu tren may nay)");
            Console.WriteLine("  Du lieu: " + dv.ThuMuc);
            Console.WriteLine("==============================================================");

            if (!dv.CoTaiKhoan && !TaoQuanTri(dv)) return 1;

            TcpListener thu = null;
            try
            {
                thu = new TcpListener(lan ? IPAddress.Any : IPAddress.Loopback, cong);
                thu.Start();
                thu.Stop();
            }
            catch (SocketException)
            {
                Console.WriteLine("Cong " + cong + " dang duoc dung (co the phan mem da mo o cua so khac).");
                MoTrinhDuyet(diaChi, args);
                Dung();
                return 2;
            }
            Console.WriteLine("Mo trinh duyet tai:  " + diaChi);
            if (lan)
            {
                Console.WriteLine("May khac trong mang noi bo (http, KHONG ma hoa, chi de dung thu):");
                foreach (IPAddress a in Dns.GetHostAddresses(Dns.GetHostName()).Where(x => x.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(x)))
                    Console.WriteLine("   http://" + a + ":" + cong + "/");
                Console.WriteLine("Luu y: camera quet QR trong trang web chi chay voi https (cai len IIS). Dung camera cua dien thoai");
                Console.WriteLine("       quet tem van mo duoc trang tai san; hoac bam 'Chup anh ma QR' trong trang Quet.");
            }
            Console.WriteLine("Dong cua so nay de dung phan mem.");
            MoTrinhDuyet(diaChi, args);
            try { MayChu.Chay(dv, lan ? IPAddress.Any : IPAddress.Loopback, cong, false); }
            catch (Exception ex) { Console.WriteLine("Loi may chu: " + ex.Message); Dung(); return 5; }
            return 0;
        }

        static void MoTrinhDuyet(string diaChi, string[] args)
        {
            if (args.Contains("--khong-mo")) return;
            try { Process.Start(new ProcessStartInfo(diaChi) { UseShellExecute = true }); }
            catch (Exception) { }
        }

        static bool TaoQuanTri(DichVu dv)
        {
            if (Console.IsInputRedirected)
            {
                Console.WriteLine("Chua co tai khoan. Chay: QuanLyTaiSan.exe --dat-quan-tri <ten> (mat khau trong bien QLTS_MATKHAU).");
                return false;
            }
            Console.WriteLine();
            Console.WriteLine("Lan dau su dung: tao tai khoan QUAN TRI (toan quyen).");
            Console.Write("Ten dang nhap [admin]: ");
            string ten = (Console.ReadLine() ?? "").Trim();
            if (ten.Length == 0) ten = "admin";
            while (true)
            {
                string m1 = DocMatKhau("Mat khau (it nhat 6 ky tu): ");
                string m2 = DocMatKhau("Nhap lai mat khau: ");
                if (m1 != m2) { Console.WriteLine("Hai lan nhap khong giong nhau."); continue; }
                try
                {
                    dv.DatQuanTri(ten, m1);
                    Console.WriteLine("Da tao tai khoan quan tri '" + ten + "'.");
                    Console.WriteLine();
                    return true;
                }
                catch (LoiApi ex) { Console.WriteLine(VanBan.BoDauGiuHoa(ex.Message)); }
            }
        }

        static string DocMatKhau(string loiNhac)
        {
            Console.Write(loiNhac);
            var sb = new StringBuilder();
            while (true)
            {
                ConsoleKeyInfo k = Console.ReadKey(true);
                if (k.Key == ConsoleKey.Enter) break;
                if (k.Key == ConsoleKey.Backspace) { if (sb.Length > 0) { sb.Length--; Console.Write("\b \b"); } continue; }
                if (k.KeyChar >= ' ') { sb.Append(k.KeyChar); Console.Write('*'); }
            }
            Console.WriteLine();
            return sb.ToString();
        }

        static void Dung()
        {
            if (Console.IsInputRedirected) return;
            Console.WriteLine("Bam phim bat ky de dong...");
            try { Console.ReadKey(true); } catch (Exception) { }
        }
    }
}
