using System;
using System.IO;
using System.Management;
using System.Text;
using System.Text.RegularExpressions;

namespace ToolkitIT
{
    /// <summary>1 việc Ghost cần làm trong WinPE.</summary>
    public class ViecGhost
    {
        public bool SaoLuu;             // true: phân vùng → .gho; false: .gho → phân vùng
        public string Ghost;            // đường dẫn ghost64.exe trên Windows
        public PhanVung PhanVung;       // phân vùng nguồn (sao lưu) / đích (bung)
        public string TepAnh;           // vd D:\Ghost\Win10.gho
        public int Nen = 3;             // -z1..-z9
        public int PvTrongAnh = 1;      // phân vùng số mấy trong tệp .gho (bung)
        public bool KiemTra = true;     // -chkimg sau khi sao lưu
        public bool TuDong;             // tự chạy lệnh Ghost (không cần chọn tay)
    }

    /// <summary>
    /// Khởi động 1 lần vào WinPE (nạp vào RAM) mà không cần USB:
    /// lấy winre.wim có sẵn của máy (hoặc WIM / ISO của bạn), tạo mục khởi động ramdisk trong BCD, đặt bootsequence 1 lần.
    /// Lần khởi động sau đó máy tự về Windows như bình thường.
    /// </summary>
    static class WinPE
    {
        const string TEN = "IT Toolkit PE";

        public static string OHeThong
        {
            get { return (Environment.GetEnvironmentVariable("SystemDrive") ?? "C:").TrimEnd('\\'); }
        }

        public static string ThuMuc { get { return OHeThong + "\\ITToolkitPE"; } }
        static string TepWim { get { return Path.Combine(ThuMuc, "pe.wim"); } }
        static string TepSdi { get { return Path.Combine(ThuMuc, "boot.sdi"); } }
        static string TepBcd { get { return Path.Combine(ThuMuc, "bcd.txt"); } }
        static string ThuMucMount { get { return Path.Combine(ThuMuc, "mount"); } }
        static string Dism { get { return HeThong.Exe("dism.exe"); } }

        public static bool Uefi
        {
            get { return HeThong.DocSo(@"HKLM\SYSTEM\CurrentControlSet\Control", "PEFirmwareType", 0) == 2; }
        }

        static void TaoThuMuc()
        {
            var d = Directory.CreateDirectory(ThuMuc);
            try { d.Attributes |= FileAttributes.Hidden; } catch (Exception) { }
        }

        // ---------------- BCD ----------------

        static string Bcd(NhatKy log, string thamSo, bool batBuoc)
        {
            string kq;
            log.Lenh("bcdedit " + thamSo);
            int ma = HeThong.KetQua(HeThong.Exe("bcdedit.exe"), thamSo, 30000, out kq);
            if (kq.Trim().Length > 0) log.Ghi(kq.Trim());
            if (ma != 0 && batBuoc) throw new LoiTacVu("bcdedit báo lỗi " + ma + ": " + kq.Trim());
            return kq;
        }

        static string LayGuid(string s)
        {
            Match m = Regex.Match(s ?? "", @"\{[0-9a-fA-F\-]{36}\}");
            return m.Success ? m.Value : null;
        }

        /// <summary>Tạo mục khởi động ramdisk trỏ tới \ITToolkitPE\pe.wim. Trả về { GUID thiết bị ramdisk, GUID mục khởi động }.</summary>
        static string[] TaoMucKhoiDong(NhatKy log)
        {
            XoaMucKhoiDong(log);
            string dev = LayGuid(Bcd(log, "/create /device /d \"" + TEN + "\"", true));
            if (dev == null) throw new LoiTacVu("Không đọc được GUID thiết bị ramdisk từ bcdedit.");
            string os = null;
            try
            {
                Bcd(log, "/set " + dev + " ramdisksdidevice partition=" + OHeThong, true);
                Bcd(log, "/set " + dev + " ramdisksdipath \\ITToolkitPE\\boot.sdi", true);
                os = LayGuid(Bcd(log, "/create /d \"" + TEN + "\" /application osloader", true));
                if (os == null) throw new LoiTacVu("Không đọc được GUID mục khởi động từ bcdedit.");
                File.WriteAllText(TepBcd, dev + "\r\n" + os + "\r\n");
                string rd = "ramdisk=[" + OHeThong + "]\\ITToolkitPE\\pe.wim," + dev;
                Bcd(log, "/set " + os + " device " + rd, true);
                Bcd(log, "/set " + os + " osdevice " + rd, true);
                Bcd(log, "/set " + os + " path \\Windows\\System32\\" + (Uefi ? "winload.efi" : "winload.exe"), true);
                Bcd(log, "/set " + os + " systemroot \\Windows", true);
                Bcd(log, "/set " + os + " winpe yes", true);
                Bcd(log, "/set " + os + " detecthal yes", true);
            }
            catch (Exception)
            {
                if (os != null) Bcd(log, "/delete " + os + " /f", false);
                Bcd(log, "/delete " + dev + " /f", false);
                try { File.Delete(TepBcd); } catch (Exception) { }
                throw;
            }
            return new[] { dev, os };
        }

        /// <summary>Xóa mục khởi động IT Toolkit PE đã tạo trước đó (nếu có).</summary>
        public static void XoaMucKhoiDong(NhatKy log)
        {
            if (!File.Exists(TepBcd)) return;
            foreach (string dong in File.ReadAllLines(TepBcd))
            {
                string g = LayGuid(dong);
                if (g != null) Bcd(log, "/delete " + g + " /f", false);
            }
            try { File.Delete(TepBcd); } catch (Exception) { }
        }

        /// <summary>Chỉ khởi động vào mục này ở LẦN KHỞI ĐỘNG KẾ TIẾP.</summary>
        static void DatKhoiDong1Lan(NhatKy log, string os)
        {
            Bcd(log, "/bootsequence " + os, true);
            log.Tot("Đã đặt: lần khởi động tới máy vào WinPE, lần sau nữa tự về Windows.");
        }

        // ---------------- chuẩn bị tệp ----------------

        static void KiemTraTrong(long canMb)
        {
            var o = new DriveInfo(OHeThong);
            if (o.AvailableFreeSpace < canMb * 1048576L)
                throw new LoiTacVu("Ổ " + OHeThong + " cần trống ít nhất " + (canMb / 1024.0).ToString("0.#") + " GB để chuẩn bị WinPE.");
        }

        static void ChepSdi(NhatKy log, string uuTien)
        {
            string[] nguon =
            {
                uuTien,
                Path.Combine(HeThong.Windir, @"Boot\DVD\EFI\boot.sdi"),
                Path.Combine(HeThong.Windir, @"Boot\DVD\PCAT\boot.sdi"),
                Path.Combine(HeThong.Sys32, @"Recovery\boot.sdi")
            };
            foreach (string f in nguon)
            {
                if (string.IsNullOrEmpty(f) || !File.Exists(f)) continue;
                File.Copy(f, TepSdi, true);
                File.SetAttributes(TepSdi, FileAttributes.Normal);
                log.Ghi("boot.sdi: " + f);
                return;
            }
            throw new LoiTacVu("Không tìm thấy boot.sdi (thường ở C:\\Windows\\Boot\\DVD\\EFI).");
        }

        /// <summary>Lấy winre.wim của máy (lưu sẵn 1 bản để lần sau khỏi lấy lại).</summary>
        static string LayWinRE(NhatKy log)
        {
            string goc = Path.Combine(ThuMuc, "winre_goc.wim");
            if (File.Exists(goc) && new FileInfo(goc).Length > 50L * 1048576) return goc;
            string re = Path.Combine(HeThong.Sys32, @"Recovery\Winre.wim");
            bool daTat = false;
            if (!File.Exists(re))
            {
                // WinRE đang bật: winre.wim nằm trong phân vùng Recovery ẩn. Tắt tạm để Windows chép nó về System32\Recovery.
                log.Ghi("Tạm tắt Windows RE để lấy tệp winre.wim (sẽ bật lại ngay)...");
                HeThong.Chay(log, HeThong.Exe("reagentc.exe"), "/disable");
                daTat = true;
            }
            try
            {
                if (!File.Exists(re))
                    throw new LoiTacVu("Máy không có Windows RE (winre.wim). Dùng mục \"Khởi động vào WinPE của bạn\" với tệp boot.wim / ISO PE.");
                log.Ghi("Chép winre.wim...");
                File.Copy(re, goc, true);
                File.SetAttributes(goc, FileAttributes.Normal);
            }
            finally
            {
                if (daTat)
                {
                    log.Ghi("Bật lại Windows RE...");
                    HeThong.Chay(log, HeThong.Exe("reagentc.exe"), "/enable");
                }
            }
            return goc;
        }

        static void DonMount(NhatKy log)
        {
            HeThong.Chay(log, Dism, "/Cleanup-Wim");
            if (Directory.Exists(ThuMucMount) && Directory.GetFileSystemEntries(ThuMucMount).Length > 0)
                HeThong.Chay(log, Dism, "/Unmount-Wim /MountDir:" + HeThong.Nhay(ThuMucMount) + " /Discard");
        }

        /// <summary>Ghi đè tệp trong ảnh đã mount (lấy quyền trước nếu tệp thuộc TrustedInstaller).</summary>
        static void GhiTepHeThong(NhatKy log, string tep, string noiDung)
        {
            if (File.Exists(tep))
            {
                HeThong.Chay(log, HeThong.Exe("takeown.exe"), "/f " + HeThong.Nhay(tep) + " /a");
                HeThong.Chay(log, HeThong.Exe("icacls.exe"), HeThong.Nhay(tep) + " /grant *S-1-5-32-544:F");
                File.SetAttributes(tep, FileAttributes.Normal);
            }
            File.WriteAllText(tep, noiDung, Encoding.ASCII);
        }

        /// <summary>Tạo pe.wim từ winre.wim: chép ghost64.exe + kịch bản vào, cho WinPE tự chạy kịch bản khi khởi động.</summary>
        static void TaoWimGhost(NhatKy log, string ghost, string job)
        {
            string goc = LayWinRE(log);
            DonMount(log);
            Directory.CreateDirectory(ThuMucMount);
            log.Ghi("Tạo pe.wim...");
            File.Copy(goc, TepWim, true);
            File.SetAttributes(TepWim, FileAttributes.Normal);
            int ma = HeThong.Chay(log, Dism, "/Mount-Wim /WimFile:" + HeThong.Nhay(TepWim) + " /Index:1 /MountDir:" + HeThong.Nhay(ThuMucMount));
            if (ma != 0) throw new LoiTacVu("DISM không mount được winre.wim (mã " + ma + ").");
            bool xong = false;
            try
            {
                string dir = Path.Combine(ThuMucMount, "ITToolkit");
                Directory.CreateDirectory(dir);
                File.Copy(ghost, Path.Combine(dir, "ghost64.exe"), true);
                File.WriteAllText(Path.Combine(dir, "chay.cmd"), KICH_BAN.Replace("\r\n", "\n").Replace("\n", "\r\n"), Encoding.ASCII);
                File.WriteAllText(Path.Combine(dir, "job.cmd"), job, Encoding.ASCII);
                GhiTepHeThong(log, Path.Combine(ThuMucMount, @"Windows\System32\winpeshl.ini"),
                    "[LaunchApps]\r\n%SYSTEMROOT%\\System32\\wpeinit.exe\r\n%SYSTEMROOT%\\System32\\cmd.exe, /k X:\\ITToolkit\\chay.cmd\r\n");
                xong = true;
            }
            finally
            {
                ma = HeThong.Chay(log, Dism, "/Unmount-Wim /MountDir:" + HeThong.Nhay(ThuMucMount) + (xong ? " /Commit" : " /Discard"));
            }
            if (ma != 0) throw new LoiTacVu("DISM không lưu được pe.wim (mã " + ma + ").");
        }

        // ---------------- kiểm tra ----------------

        /// <summary>Ổ đang mã hóa BitLocker thì WinPE không đọc được.</summary>
        public static bool DangMaHoa(string chu)
        {
            foreach (ManagementObject v in HeThong.Wmi(@"root\cimv2\Security\MicrosoftVolumeEncryption",
                         "SELECT * FROM Win32_EncryptableVolume WHERE DriveLetter = '" + chu.TrimEnd('\\', ':') + ":'"))
            {
                try
                {
                    ManagementBaseObject kq = v.InvokeMethod("GetConversionStatus", null, null);
                    if (HeThong.L(kq, "ConversionStatus") != 0) return true;
                }
                catch (Exception) { }
                if (HeThong.L(v, "ProtectionStatus") == 1) return true;
            }
            return false;
        }

        // ---------------- việc Ghost ----------------

        /// <summary>Chuẩn bị WinPE để chạy Ghost ở lần khởi động tới.</summary>
        public static void ChuanBiGhost(NhatKy log, ViecGhost v)
        {
            PhanVung pv = v.PhanVung;
            string chuAnh = v.TepAnh.Substring(0, 1).ToUpperInvariant();
            XoaMucKhoiDong(log);   // hủy lịch cũ (nếu có) trước khi làm lịch mới
            foreach (string o in new[] { OHeThong, pv.Chu + ":", chuAnh + ":" })
                if (DangMaHoa(o)) throw new LoiTacVu("Ổ " + o + " đang mã hóa BitLocker — WinPE không đọc được. Tắt BitLocker trước (trang BitLocker - EFS).");
            KiemTraTrong(2048);
            TaoThuMuc();
            string id = Guid.NewGuid().ToString("N").Substring(0, 8).ToUpperInvariant();
            string[] bcd = TaoMucKhoiDong(log);
            try
            {
                TaoWimGhost(log, v.Ghost, TaoJob(v, id, bcd));
                ChepSdi(log, null);
                File.WriteAllText(pv.Chu + ":\\ITTK_PV_" + id + ".txt", "IT Toolkit - danh dau phan vung, tu xoa sau khi xong.");
                File.WriteAllText(chuAnh + ":\\ITTK_ANH_" + id + ".txt", "IT Toolkit - danh dau o chua tep anh, tu xoa sau khi xong.");
                if (v.SaoLuu) Directory.CreateDirectory(Path.GetDirectoryName(v.TepAnh));
                DatKhoiDong1Lan(log, bcd[1]);
            }
            catch (Exception)
            {
                XoaMucKhoiDong(log);
                throw;
            }
        }

        static string Bien(string ten, string giaTri)
        {
            return "set \"" + ten + "=" + giaTri + "\"\r\n";
        }

        static string TaoJob(ViecGhost v, string id, string[] bcd)
        {
            PhanVung pv = v.PhanVung;
            string anh = v.TepAnh.Substring(2);                    // \Ghost\Win10.gho
            int cat = anh.LastIndexOf('\\');
            string thuMuc = cat > 0 ? anh.Substring(0, cat) : "\\";    // \Ghost (tệp ở gốc ổ: \)
            string nhan = HeThong.KhongDau(pv.Nhan);
            var sb = new StringBuilder("@echo off\r\n");
            sb.Append(Bien("ID", id));
            sb.Append(Bien("CONGVIEC", v.SaoLuu ? "BACKUP" : "RESTORE"));
            sb.Append(Bien("DISK", pv.Dia.ToString()));
            sb.Append(Bien("PART", pv.So.ToString()));
            sb.Append(Bien("CHU_PV", pv.Chu));
            sb.Append(Bien("CHU_ANH", v.TepAnh.Substring(0, 1).ToUpperInvariant()));
            sb.Append(Bien("ANH", anh));
            sb.Append(Bien("THUMUC", thuMuc));
            sb.Append(Bien("PVANH", v.PvTrongAnh.ToString()));
            sb.Append(Bien("NEN", v.Nen.ToString()));
            sb.Append(Bien("KIEMTRA", v.KiemTra ? "1" : "0"));
            sb.Append(Bien("TUDONG", v.TuDong ? "1" : "0"));
            sb.Append(Bien("SUA_KHOIDONG", !v.SaoLuu && pv.LaWindows ? "1" : "0"));
            sb.Append(Bien("NHAN_PV", nhan.Length > 0 ? nhan : "khong nhan"));
            sb.Append(Bien("PV_GB", (pv.KichThuoc / 1073741824.0).ToString("0", System.Globalization.CultureInfo.InvariantCulture)));
            sb.Append(Bien("DIA_GB", (pv.DiaKichThuoc / 1073741824.0).ToString("0", System.Globalization.CultureInfo.InvariantCulture)));
            sb.Append(Bien("BCD_DEV", bcd[0]));
            sb.Append(Bien("BCD_OS", bcd[1]));
            sb.Append(Bien("TOMTAT", v.SaoLuu
                ? "SAO LUU phan vung " + pv.Chu + ": ra tep " + v.TepAnh.ToUpperInvariant()
                : "BUNG tep " + v.TepAnh.ToUpperInvariant() + " vao phan vung " + pv.Chu + ":"));
            return sb.ToString();
        }

        // ---------------- WinPE của người dùng ----------------

        /// <summary>Khởi động 1 lần vào tệp .wim (hoặc boot.wim trong ISO) của bạn: Hiren's PE, WinPE tạo bằng Acronis Media Builder...</summary>
        public static void ChuanBiPECuaBan(NhatKy log, string tep)
        {
            XoaMucKhoiDong(log);   // hủy lịch cũ (nếu có) trước khi làm lịch mới
            if (DangMaHoa(OHeThong)) throw new LoiTacVu("Ổ " + OHeThong + " đang mã hóa BitLocker — tắt BitLocker trước.");
            KiemTraTrong(new FileInfo(tep).Length / 1048576 + 600);
            TaoThuMuc();
            DonMount(log);
            string sdi = null;
            if (tep.EndsWith(".iso", StringComparison.OrdinalIgnoreCase))
            {
                int ma = HeThong.ChayPS(log,
                    "$ErrorActionPreference = 'Stop'\r\n" +
                    "$img = Mount-DiskImage -ImagePath " + HeThong.Ps(tep) + " -PassThru\r\n" +
                    "try {\r\n" +
                    "  Start-Sleep -Seconds 2\r\n" +
                    "  $o = [string]($img | Get-Volume).DriveLetter + ':\\'\r\n" +
                    "  $w = Join-Path $o 'sources\\boot.wim'\r\n" +
                    "  if (-not (Test-Path $w)) { throw 'ISO không có sources\\boot.wim — hãy chọn trực tiếp tệp .wim của PE.' }\r\n" +
                    "  Write-Output ('Chép ' + $w + '...')\r\n" +
                    "  Copy-Item $w " + HeThong.Ps(TepWim) + " -Force\r\n" +
                    "  $s = Join-Path $o 'boot\\boot.sdi'\r\n" +
                    "  if (Test-Path $s) { Copy-Item $s " + HeThong.Ps(TepSdi) + " -Force }\r\n" +
                    "} finally { Dismount-DiskImage -ImagePath " + HeThong.Ps(tep) + " | Out-Null }");
                if (ma != 0) throw new LoiTacVu("Không lấy được boot.wim từ ISO.");
                if (File.Exists(TepSdi)) sdi = TepSdi;
            }
            else
            {
                log.Ghi("Chép " + tep + "...");
                File.Copy(tep, TepWim, true);
            }
            File.SetAttributes(TepWim, FileAttributes.Normal);
            if (sdi == null) ChepSdi(log, null);
            string[] bcd = TaoMucKhoiDong(log);
            DatKhoiDong1Lan(log, bcd[1]);
            log.Ghi("Khi xong việc trong WinPE, khởi động lại là về Windows. Bấm \"Hủy lịch / dọn tệp WinPE\" để xóa tệp tạm (" + ThuMuc + ").");
        }

        /// <summary>Hủy lịch khởi động vào WinPE, xóa tệp tạm và tệp đánh dấu.</summary>
        public static void Huy(NhatKy log)
        {
            if (Directory.Exists(ThuMuc)) DonMount(log);
            XoaMucKhoiDong(log);
            foreach (DriveInfo d in DriveInfo.GetDrives())
            {
                if (d.DriveType != DriveType.Fixed && d.DriveType != DriveType.Removable) continue;
                try
                {
                    foreach (string f in Directory.GetFiles(d.RootDirectory.FullName, "ITTK_*.txt"))
                    {
                        File.Delete(f);
                        log.Ghi("Đã xóa " + f);
                    }
                }
                catch (Exception) { }
            }
            if (Directory.Exists(ThuMuc))
            {
                try
                {
                    Directory.Delete(ThuMuc, true);
                    log.Tot("Đã xóa " + ThuMuc);
                }
                catch (Exception ex)
                {
                    log.Canh("Chưa xóa hết " + ThuMuc + ": " + ex.Message);
                }
            }
        }

        // ---------------- kịch bản chạy trong WinPE (chỉ chữ ASCII) ----------------

        const string KICH_BAN = @"@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IT Toolkit - WinPE
color 1F
cd /d X:\ITToolkit
call X:\ITToolkit\job.cmd
set /a GDISK=DISK+1
set ""KQ=1""
cls
echo ==================================================================
echo   IT TOOLKIT - WinPE
echo   %TOMTAT%
echo ==================================================================
echo.
echo Dang cho o dia san sang...
ping -n 6 127.0.0.1 >nul
set ""O_ANH=""
set ""O_PV=""
for %%d in (C D E F G H I J K L M N O P Q R S T U V W Y Z) do (
  if exist ""%%d:\ITTK_ANH_%ID%.txt"" set ""O_ANH=%%d""
  if exist ""%%d:\ITTK_PV_%ID%.txt"" set ""O_PV=%%d""
)
if not defined O_PV goto khongthay
if not defined O_ANH goto khongthay
echo Phan vung can thao tac : !O_PV!:   - trong Windows la %CHU_PV%:, Disk %DISK% Partition %PART%
echo O chua tep anh         : !O_ANH!:   - trong Windows la %CHU_ANH%:
echo.
rem Xac minh: Disk/Partition (so cua Windows) dung la phan vung co tep danh dau
> X:\ITToolkit\dp.txt echo select disk %DISK%
>> X:\ITToolkit\dp.txt echo select partition %PART%
>> X:\ITToolkit\dp.txt echo detail partition
diskpart /s X:\ITToolkit\dp.txt > X:\ITToolkit\dp_kq.txt 2>&1
set ""KHOP=0""
rem dong Volume cua phan vung co cot Ltr dung bang chu o co tep danh dau
find "" !O_PV!  "" X:\ITToolkit\dp_kq.txt >nul && set ""KHOP=1""
> X:\ITToolkit\dp2.txt echo select disk %DISK%
>> X:\ITToolkit\dp2.txt echo list partition
diskpart /s X:\ITToolkit\dp2.txt > X:\ITToolkit\dp2_kq.txt 2>&1
if /i ""%CONGVIEC%""==""BACKUP"" (
  del /f /q ""!O_PV!:\ITTK_PV_%ID%.txt"" >nul 2>&1
  if exist ""!O_PV!:\ITToolkitPE"" rd /s /q ""!O_PV!:\ITToolkitPE""
  if not exist ""!O_ANH!:%THUMUC%"" md ""!O_ANH!:%THUMUC%""
)
if ""%TUDONG%""==""1"" if ""!KHOP!""==""1"" goto tudong
if ""%TUDONG%""==""1"" (
  echo [CANH BAO] So Disk/Partition trong WinPE khong khop voi Windows.
  echo            KHONG tu dong chay de tranh ghi nham - chuyen sang chon tay trong Ghost.
  echo.
)
goto bantudong

:tudong
if /i ""%CONGVIEC%""==""BACKUP"" goto tudong_saoluu
echo Bung !O_ANH!:%ANH% vao Disk %GDISK% Partition %PART% ...
echo Ghost se hoi xac nhan lan cuoi: kiem tra dung phan vung roi chon Yes.
echo Khi Ghost bao xong: chon Continue - KHONG chon Reset Computer.
X:\ITToolkit\ghost64.exe -clone,mode=pload,src=!O_ANH!:%ANH%:%PVANH%,dst=%GDISK%:%PART%
set ""KQ=!errorlevel!""
goto sau_ghost

:tudong_saoluu
echo Sao luu Disk %GDISK% Partition %PART% ra !O_ANH!:%ANH% ...
X:\ITToolkit\ghost64.exe -clone,mode=pdump,src=%GDISK%:%PART%,dst=!O_ANH!:%ANH% -z%NEN% -sure -batch
set ""KQ=!errorlevel!""
goto sau_ghost

:bantudong
echo ------------------------------------------------------------------
echo  Cac phan vung cua o dia %DISK% - theo diskpart:
type X:\ITToolkit\dp2_kq.txt
echo ------------------------------------------------------------------
if /i ""%CONGVIEC%""==""BACKUP"" (
  echo  LAM TREN CUA SO GHOST:  Local ^> Partition ^> To Image
  echo    1. Chon o dia so %GDISK% - dung luong khoang %DIA_GB% GB
  echo    2. Chon phan vung %NHAN_PV% - %PV_GB% GB - dang la o !O_PV!: trong WinPE
  echo    3. Luu tep vao: !O_ANH!:%ANH%
) else (
  echo  LAM TREN CUA SO GHOST:  Local ^> Partition ^> From Image
  echo    1. Chon tep anh: !O_ANH!:%ANH%
  echo    2. Chon o dia dich so %GDISK% - dung luong khoang %DIA_GB% GB
  echo    3. Chon phan vung dich %NHAN_PV% - %PV_GB% GB - dang la o !O_PV!:
)
echo  Xong: chon Continue roi Quit - KHONG chon Reset Computer, de phan mem don dep.
echo ------------------------------------------------------------------
echo Nhan phim bat ky de mo Ghost...
pause >nul
X:\ITToolkit\ghost64.exe
set ""KQ=!errorlevel!""
goto sau_ghost

:sau_ghost
echo.
if ""!KQ!""==""0"" (echo Ghost da chay xong.) else (echo [CANH BAO] Ghost ket thuc voi ma !KQ!.)
if /i ""%CONGVIEC%""==""BACKUP"" if ""%KIEMTRA%""==""1"" if exist ""!O_ANH!:%ANH%"" (
  echo Kiem tra tep anh...
  X:\ITToolkit\ghost64.exe -chkimg,!O_ANH!:%ANH% -batch
  if errorlevel 1 (echo [LOI] Tep anh bi loi.) else (echo Tep anh hop le.)
)
if ""%SUA_KHOIDONG%""==""1"" if exist ""!O_PV!:\Windows\System32\winload.*"" (
  echo Cap nhat tep khoi dong cho Windows vua bung - bcdboot...
  bcdboot !O_PV!:\Windows
)
goto dondep

:khongthay
echo [LOI] Khong tim thay phan vung can thao tac hoac o chua tep anh trong WinPE.
echo       Co the WinPE thieu driver o cung - Intel RST / VMD, RAID - hoac o bi ma hoa BitLocker.
echo.
set ""CHON=""
set /p ""CHON=Go G roi Enter de mo Ghost chon tay, chi Enter de khoi dong lai: ""
if /i ""!CHON!""==""G"" X:\ITToolkit\ghost64.exe
goto dondep

:dondep
if defined O_ANH del /f /q ""!O_ANH!:\ITTK_ANH_%ID%.txt"" >nul 2>&1
if defined O_PV del /f /q ""!O_PV!:\ITTK_PV_%ID%.txt"" >nul 2>&1
bcdedit /delete %BCD_OS% /f >nul 2>&1
bcdedit /delete %BCD_DEV% /f >nul 2>&1
echo.
echo XONG. Nhan phim bat ky de khoi dong lai may.
pause >nul
wpeutil reboot
";
    }
}
