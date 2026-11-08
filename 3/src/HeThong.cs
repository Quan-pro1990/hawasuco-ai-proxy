using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace ToolkitIT
{
    /// <summary>Chạy lệnh, sửa registry, dịch vụ, WMI... — mọi thao tác đều ghi vào nhật ký.</summary>
    static class HeThong
    {
        [DllImport("kernel32.dll")]
        static extern uint GetOEMCP();

        public static Encoding MaOem
        {
            get
            {
                try { return Encoding.GetEncoding((int)GetOEMCP()); }
                catch (Exception) { return Encoding.Default; }
            }
        }

        public static string Sys32 { get { return Environment.GetFolderPath(Environment.SpecialFolder.System); } }
        public static string Windir { get { return Environment.GetFolderPath(Environment.SpecialFolder.Windows); } }
        public static string PowerShellExe { get { return Path.Combine(Sys32, @"WindowsPowerShell\v1.0\powershell.exe"); } }
        public static string Exe(string ten) { return Path.Combine(Sys32, ten); }

        /// <summary>Thư mục dữ liệu của phần mềm: C:\ProgramData\ITToolkit</summary>
        public static string ThuMucDuLieu
        {
            get
            {
                string d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ITToolkit");
                Directory.CreateDirectory(d);
                return d;
            }
        }

        public static string ThuMucTam
        {
            get
            {
                string d = Path.Combine(Path.GetTempPath(), "ITToolkit");
                Directory.CreateDirectory(d);
                return d;
            }
        }

        public static bool LaQuanTri()
        {
            using (WindowsIdentity id = WindowsIdentity.GetCurrent())
                return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
        }

        public static string ThongDiep(Exception ex)
        {
            while (ex is System.Reflection.TargetInvocationException && ex.InnerException != null)
                ex = ex.InnerException;
            if (ex is InvalidOperationException && ex.InnerException is Win32Exception) ex = ex.InnerException;
            return ex.Message;
        }

        // ================= Chạy chương trình =================

        /// <summary>Chạy chương trình ẩn, đổ từng dòng kết quả vào nhật ký. Trả về mã thoát.</summary>
        public static int Chay(NhatKy log, string exe, string thamSo)
        {
            return Chay(log, exe, thamSo, null, true);
        }

        public static int Chay(NhatKy log, string exe, string thamSo, Encoding ma, bool hienLenh)
        {
            if (hienLenh && log != null) log.Lenh(Path.GetFileName(exe) + " " + thamSo);
            var psi = new ProcessStartInfo(exe, thamSo ?? "");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.StandardOutputEncoding = ma ?? MaOem;
            psi.StandardErrorEncoding = ma ?? MaOem;
            psi.WorkingDirectory = Sys32;
            var loc = new LocTienDo();
            try
            {
                using (var p = new Process())
                {
                    p.StartInfo = psi;
                    p.OutputDataReceived += (s, e) =>
                    {
                        if (e.Data == null || log == null) return;
                        string d = loc.Loc(e.Data);
                        if (d != null) log.Ghi(d);
                    };
                    p.ErrorDataReceived += (s, e) =>
                    {
                        if (e.Data == null || log == null) return;
                        string d = LamSach(e.Data);
                        if (d.Length > 0 && !BoQuaLoi(d)) log.Loi(d);
                    };
                    p.Start();
                    p.BeginOutputReadLine();
                    p.BeginErrorReadLine();
                    p.WaitForExit();
                    return p.ExitCode;
                }
            }
            catch (Win32Exception ex)
            {
                if (log != null) log.Loi("Không chạy được " + Path.GetFileName(exe) + ": " + ex.Message);
                return -1;
            }
        }

        /// <summary>Chạy và lấy toàn bộ kết quả dạng chữ (để phân tích), không ghi nhật ký.</summary>
        public static string KetQua(string exe, string thamSo, Encoding ma, int choMs)
        {
            var psi = new ProcessStartInfo(exe, thamSo ?? "");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.StandardOutputEncoding = ma ?? MaOem;
            psi.WorkingDirectory = Sys32;
            try
            {
                using (var p = Process.Start(psi))
                {
                    var sb = new StringBuilder();
                    p.OutputDataReceived += (s, e) => { if (e.Data != null) lock (sb) sb.AppendLine(LamSach(e.Data)); };
                    p.ErrorDataReceived += (s, e) => { };
                    p.BeginOutputReadLine();
                    p.BeginErrorReadLine();
                    if (!p.WaitForExit(choMs <= 0 ? 120000 : choMs))
                    {
                        try { p.Kill(); } catch (Exception) { }
                    }
                    else p.WaitForExit();
                    lock (sb) return sb.ToString();
                }
            }
            catch (Exception)
            {
                return "";
            }
        }

        static string LamSach(string s)
        {
            return s.Replace("\0", "").TrimEnd();
        }

        static bool BoQuaLoi(string d)
        {
            // dòng phụ của lỗi PowerShell (CategoryInfo, FullyQualifiedErrorId...) và rác CLIXML
            string t = d.TrimStart();
            return t.StartsWith("+ ") || t.StartsWith("#< CLIXML") || t.StartsWith("<Objs") || t == "+";
        }

        /// <summary>Lọc bớt dòng tiến độ (DISM, SFC, winget...) để nhật ký không bị ngập.</summary>
        class LocTienDo
        {
            static readonly Regex PhanTram = new Regex(@"(\d{1,3})(?:[.,]\d+)?\s*%");
            int daBao = -100;

            public string Loc(string dong)
            {
                string d = LamSach(dong);
                if (d.Trim().Length == 0) return null;
                if (d.IndexOf('\u2588') >= 0 || d.IndexOf('\u2592') >= 0) return null;     // thanh tiến độ của winget
                string t = d.Trim();
                if (t.Length <= 2 && "-\\|/".IndexOf(t[0]) >= 0) return null;               // con quay
                if (t.Length < 120)
                {
                    Match m = PhanTram.Match(t);
                    if (m.Success && (t.StartsWith("[") || t.Length < 60))
                    {
                        int pt;
                        if (int.TryParse(m.Groups[1].Value, out pt))
                        {
                            if (pt < daBao) daBao = -100;   // bắt đầu tiến trình mới
                            if (pt != 100 && pt - daBao < 10) return null;
                            daBao = pt;
                            return t.Trim('[', ']', ' ', '=');
                        }
                    }
                }
                return d;
            }
        }

        /// <summary>Chạy đoạn PowerShell (ghi ra tệp .ps1 tạm, UTF-8). Kết quả đổ vào nhật ký.</summary>
        public static int ChayPS(NhatKy log, string script)
        {
            string tep = TaoTepPS(script);
            try
            {
                return Chay(log, PowerShellExe, "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + tep + "\"", Encoding.UTF8, false);
            }
            finally
            {
                try { File.Delete(tep); } catch (Exception) { }
            }
        }

        public static string KetQuaPS(string script, int choMs)
        {
            string tep = TaoTepPS(script);
            try
            {
                return KetQua(PowerShellExe, "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + tep + "\"", Encoding.UTF8, choMs);
            }
            finally
            {
                try { File.Delete(tep); } catch (Exception) { }
            }
        }

        static string TaoTepPS(string script)
        {
            string tep = Path.Combine(ThuMucTam, "ps_" + Guid.NewGuid().ToString("N") + ".ps1");
            string dau = "$ErrorActionPreference = 'Continue'\r\n$ProgressPreference = 'SilentlyContinue'\r\n" +
                         "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\r\n";
            File.WriteAllText(tep, dau + script, new UTF8Encoding(true));
            return tep;
        }

        /// <summary>Chuỗi PowerShell trong nháy đơn (thoát dấu ').</summary>
        public static string Ps(string s)
        {
            return "'" + (s ?? "").Replace("'", "''") + "'";
        }

        /// <summary>Đối số dòng lệnh trong nháy kép.</summary>
        public static string Nhay(string s)
        {
            return "\"" + (s ?? "").Replace("\"", "") + "\"";
        }

        /// <summary>Mở tệp / thư mục / trang web / công cụ hệ thống (không chờ).</summary>
        public static void Mo(string dich, string thamSo)
        {
            try
            {
                var psi = new ProcessStartInfo(dich, thamSo ?? "");
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                NhatKy.Chung.Loi("Không mở được " + dich + ": " + ex.Message);
            }
        }

        public static void Mo(string dich) { Mo(dich, null); }

        // ================= Registry =================

        static RegistryKey Goc(string duongDan, out string con)
        {
            int i = duongDan.IndexOf('\\');
            string goc = duongDan.Substring(0, i).ToUpperInvariant();
            con = duongDan.Substring(i + 1);
            RegistryView v = Environment.Is64BitOperatingSystem ? RegistryView.Registry64 : RegistryView.Default;
            switch (goc)
            {
                case "HKLM": case "HKEY_LOCAL_MACHINE": return RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, v);
                case "HKCU": case "HKEY_CURRENT_USER": return RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, v);
                case "HKCR": case "HKEY_CLASSES_ROOT": return RegistryKey.OpenBaseKey(RegistryHive.ClassesRoot, v);
                case "HKU": case "HKEY_USERS": return RegistryKey.OpenBaseKey(RegistryHive.Users, v);
            }
            throw new ArgumentException("Nhánh registry không hợp lệ: " + duongDan);
        }

        public static void DatDword(NhatKy log, string duongDan, string ten, int giaTri)
        {
            string con;
            using (RegistryKey g = Goc(duongDan, out con))
            using (RegistryKey k = g.CreateSubKey(con))
                k.SetValue(ten, giaTri, RegistryValueKind.DWord);
            if (log != null) log.Ghi("Registry: " + duongDan + "  →  " + ten + " = " + giaTri);
        }

        public static void DatChuoi(NhatKy log, string duongDan, string ten, string giaTri)
        {
            string con;
            using (RegistryKey g = Goc(duongDan, out con))
            using (RegistryKey k = g.CreateSubKey(con))
                k.SetValue(ten ?? "", giaTri ?? "", RegistryValueKind.String);
            if (log != null) log.Ghi("Registry: " + duongDan + "  →  " + (string.IsNullOrEmpty(ten) ? "(Default)" : ten) + " = \"" + giaTri + "\"");
        }

        public static void XoaGiaTri(NhatKy log, string duongDan, string ten)
        {
            string con;
            using (RegistryKey g = Goc(duongDan, out con))
            using (RegistryKey k = g.OpenSubKey(con, true))
            {
                if (k == null || k.GetValue(ten) == null) return;
                k.DeleteValue(ten, false);
            }
            if (log != null) log.Ghi("Registry: xóa " + duongDan + "  →  " + ten);
        }

        public static void XoaKhoa(NhatKy log, string duongDan)
        {
            string con;
            using (RegistryKey g = Goc(duongDan, out con))
            {
                using (RegistryKey k = g.OpenSubKey(con))
                    if (k == null) return;
                g.DeleteSubKeyTree(con, false);
            }
            if (log != null) log.Ghi("Registry: xóa khóa " + duongDan);
        }

        public static object Doc(string duongDan, string ten)
        {
            try
            {
                string con;
                using (RegistryKey g = Goc(duongDan, out con))
                using (RegistryKey k = g.OpenSubKey(con))
                    return k == null ? null : k.GetValue(ten);
            }
            catch (Exception)
            {
                return null;
            }
        }

        public static int DocSo(string duongDan, string ten, int macDinh)
        {
            object o = Doc(duongDan, ten);
            return o is int ? (int)o : macDinh;
        }

        // ================= Dịch vụ =================

        /// <summary>Kiểu khởi động: auto | demand | disabled | delayed-auto</summary>
        public static void KieuDichVu(NhatKy log, string ten, string kieu)
        {
            Chay(log, Exe("sc.exe"), "config " + ten + " start= " + kieu);
        }

        public static bool BatDichVu(NhatKy log, string ten)
        {
            try
            {
                using (var sc = new ServiceController(ten))
                {
                    if (sc.Status == ServiceControllerStatus.Running)
                    {
                        log.Ghi("Dịch vụ " + ten + " đang chạy.");
                        return true;
                    }
                    log.Ghi("Khởi động dịch vụ " + ten + "...");
                    if (sc.Status != ServiceControllerStatus.StartPending) sc.Start();
                    sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(45));
                    log.Tot("Dịch vụ " + ten + " đã chạy.");
                    return true;
                }
            }
            catch (Exception ex)
            {
                log.Loi("Không khởi động được dịch vụ " + ten + ": " + ThongDiep(ex));
                return false;
            }
        }

        public static bool TatDichVu(NhatKy log, string ten)
        {
            try
            {
                using (var sc = new ServiceController(ten))
                {
                    if (sc.Status == ServiceControllerStatus.Stopped) return true;
                    log.Ghi("Dừng dịch vụ " + ten + "...");
                    if (sc.CanStop) sc.Stop();
                    sc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(45));
                    return true;
                }
            }
            catch (Exception ex)
            {
                log.Loi("Không dừng được dịch vụ " + ten + ": " + ThongDiep(ex));
                return false;
            }
        }

        public static void KhoiDongLaiDichVu(NhatKy log, string ten)
        {
            TatDichVu(log, ten);
            BatDichVu(log, ten);
        }

        // ================= WMI =================

        public static List<ManagementObject> Wmi(string truyVan)
        {
            return Wmi(@"root\cimv2", truyVan);
        }

        public static List<ManagementObject> Wmi(string khongGian, string truyVan)
        {
            var kq = new List<ManagementObject>();
            try
            {
                using (var s = new ManagementObjectSearcher(khongGian, truyVan))
                    foreach (ManagementObject o in s.Get()) kq.Add(o);
            }
            catch (Exception)
            {
                // không gian WMI không có trên máy này (vd Storage trên Windows 7) → trả danh sách rỗng
            }
            return kq;
        }

        public static string S(ManagementBaseObject o, string ten)
        {
            try
            {
                object v = o[ten];
                if (v == null) return "";
                var mang = v as Array;
                if (mang != null)
                {
                    var ds = new List<string>();
                    foreach (object x in mang) if (x != null) ds.Add(x.ToString());
                    return string.Join(", ", ds.ToArray());
                }
                return v.ToString().Trim();
            }
            catch (Exception)
            {
                return "";
            }
        }

        public static long L(ManagementBaseObject o, string ten)
        {
            try
            {
                object v = o[ten];
                return v == null ? 0 : Convert.ToInt64(v);
            }
            catch (Exception)
            {
                return 0;
            }
        }

        public static string Gb(long byteCount)
        {
            if (byteCount <= 0) return "?";
            double gb = byteCount / 1073741824.0;
            return gb >= 100 ? gb.ToString("0") + " GB" : gb.ToString("0.#") + " GB";
        }

        // ================= Thông tin Windows =================

        const string NT = @"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion";

        public static int Build
        {
            get
            {
                int b;
                return int.TryParse(Convert.ToString(Doc(NT, "CurrentBuild")), out b) ? b : Environment.OSVersion.Version.Build;
            }
        }

        /// <summary>Vd "Windows 11 Pro 24H2 (build 26100.2314)".</summary>
        public static string TenWindows()
        {
            string ten = Convert.ToString(Doc(NT, "ProductName"));
            int b = Build;
            if (b >= 22000) ten = ten.Replace("Windows 10", "Windows 11");
            string ban = Convert.ToString(Doc(NT, "DisplayVersion"));
            if (ban.Length == 0) ban = Convert.ToString(Doc(NT, "ReleaseId"));
            object ubr = Doc(NT, "UBR");
            return (ten + " " + ban).Trim() + " (build " + b + (ubr != null ? "." + ubr : "") + ")";
        }

        // ================= Tải tệp =================

        public static void TaiTep(NhatKy log, string url, string dich)
        {
            ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072;   // TLS 1.2
            log.Ghi("Tải: " + url);
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ITToolkit";
            req.Timeout = 30000;
            using (var res = (HttpWebResponse)req.GetResponse())
            using (Stream s = res.GetResponseStream())
            using (FileStream f = File.Create(dich))
            {
                long tong = res.ContentLength, da = 0;
                int baoLan = -10;
                var buf = new byte[81920];
                int n;
                while ((n = s.Read(buf, 0, buf.Length)) > 0)
                {
                    f.Write(buf, 0, n);
                    da += n;
                    if (tong > 0)
                    {
                        int pt = (int)(da * 100 / tong);
                        if (pt - baoLan >= 20) { baoLan = pt; log.Ghi("  ... " + pt + "%"); }
                    }
                }
            }
            log.Tot("Đã tải về: " + dich);
        }

        // ================= Tường lửa / mạng =================

        /// <summary>Mở nhóm luật File and Printer Sharing + Network Discovery (chỉ mạng Private / Domain).</summary>
        public static void MoTuongLuaChiaSe(NhatKy log)
        {
            log.Ghi("Mở tường lửa: File and Printer Sharing, Network Discovery (luật cho mạng nội bộ)...");
            ChayPS(log,
                "foreach ($g in '@FirewallAPI.dll,-28502','@FirewallAPI.dll,-32752') {\r\n" +
                "  Get-NetFirewallRule -Group $g -ErrorAction SilentlyContinue | Where-Object { $_.Profile.ToString() -match 'Private|Domain|Any' } | Enable-NetFirewallRule\r\n" +
                "}\r\n" +
                "Write-Output 'Đã bật luật tường lửa chia sẻ.'");
        }

        public static void MangRiengTu(NhatKy log)
        {
            ChayPS(log,
                "Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' } | ForEach-Object {\r\n" +
                "  Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private\r\n" +
                "  Write-Output ('Đã chuyển mạng \"' + $_.Name + '\" sang Private') }\r\n" +
                "Get-NetConnectionProfile | ForEach-Object { Write-Output ('Mạng \"' + $_.Name + '\": ' + $_.NetworkCategory) }");
        }

        /// <summary>Tên tài khoản / nhóm từ SID (đúng cả trên Windows tiếng khác).</summary>
        public static string TenTuSid(string sid)
        {
            try
            {
                return new SecurityIdentifier(sid).Translate(typeof(NTAccount)).Value;
            }
            catch (Exception)
            {
                return sid;
            }
        }

        public static string SidTuTen(string ten)
        {
            return new NTAccount(ten).Translate(typeof(SecurityIdentifier)).Value;
        }
    }
}
