using System;
using System.IO;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Tiện ích - Sửa lỗi Windows.</summary>
    public class TrangTienIch : TrangCuon
    {
        const string EXPLORER = @"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced";
        const string MENU_CU = @"HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}";

        public TrangTienIch()
        {
            Them(Nhom("Sửa lỗi hệ thống", Ic.SuaChua, Tone.Do,
                "SFC + DISM sửa tệp hệ thống hỏng (lỗi màn hình xanh, Start menu, Windows Update...). Chạy DISM trước rồi SFC; cần Internet cho DISM.",
                Nut("DISM RestoreHealth", Ic.SuaChua, Tone.Do, () => TacVu.Chay("DISM RestoreHealth", log =>
                    HeThong.Chay(log, HeThong.Exe("dism.exe"), "/Online /Cleanup-Image /RestoreHealth"))),
                Nut("SFC /scannow", Ic.Quet, Tone.Do, () => TacVu.Chay("SFC /scannow", log =>
                    HeThong.Chay(log, HeThong.Exe("sfc.exe"), "/scannow", System.Text.Encoding.Unicode, true))),
                Nut("DISM + SFC (đủ bộ)", Ic.Chay, Tone.Cam, () => TacVu.Chay("DISM + SFC", log =>
                {
                    HeThong.Chay(log, HeThong.Exe("dism.exe"), "/Online /Cleanup-Image /RestoreHealth");
                    HeThong.Chay(log, HeThong.Exe("sfc.exe"), "/scannow", System.Text.Encoding.Unicode, true);
                })),
                Nut("Reset Windows Update", Ic.LamMoi, Tone.Xanh, ResetWindowsUpdate),
                Nut("Sửa lỗi Microsoft Store", Ic.Apps, Tone.Tim, () => HeThong.Mo(HeThong.Exe("wsreset.exe"))),
                Nut("Kiểm tra ổ đĩa (chkdsk /scan)", Ic.O, Tone.Ngoc, () => TacVu.Chay("chkdsk /scan", log =>
                    HeThong.Chay(log, HeThong.Exe("chkdsk.exe"), (Environment.GetEnvironmentVariable("SystemDrive") ?? "C:") + " /scan"))),
                Nut("Đồng bộ lại đồng hồ", Ic.DongHo, Tone.Vang, () => TacVu.Chay("Đồng bộ thời gian", log =>
                {
                    HeThong.KieuDichVu(log, "w32time", "auto");
                    HeThong.BatDichVu(log, "w32time");
                    HeThong.Chay(log, HeThong.Exe("w32tm.exe"), "/config /manualpeerlist:\"time.windows.com,0x9 pool.ntp.org,0x9\" /syncfromflags:manual /update");
                    HeThong.Chay(log, HeThong.Exe("w32tm.exe"), "/resync /force");
                })),
                Nut("Bật .NET Framework 3.5", Ic.TaiVe, Tone.XanhLa, () => TacVu.Chay("Bật .NET Framework 3.5", log =>
                    HeThong.Chay(log, HeThong.Exe("dism.exe"), "/online /enable-feature /featurename:NetFx3 /all /norestart")))));

            Them(Nhom("Dọn dẹp", Ic.Xoa, Tone.Cam,
                "Xóa tệp tạm, bộ nhớ đệm Windows Update, thùng rác — giải phóng ổ C.",
                Nut("Xóa tệp tạm (Temp)", Ic.Xoa, Tone.Cam, XoaTemp),
                Nut("Dọn thùng rác", Ic.Xoa, Tone.Cam, () => TacVu.Chay("Dọn thùng rác", log =>
                    HeThong.ChayPS(log, "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output 'Đã dọn thùng rác.'"))),
                Nut("Dọn bộ nhớ đệm Update (WinSxS)", Ic.LamMoi, Tone.Cam, () => TacVu.Chay("Dọn WinSxS", log =>
                    HeThong.Chay(log, HeThong.Exe("dism.exe"), "/Online /Cleanup-Image /StartComponentCleanup"))),
                Nut("Disk Cleanup", Ic.O, Tone.Xam, () => HeThong.Mo(HeThong.Exe("cleanmgr.exe")))));

            Them(Nhom("Mạng - Internet", Ic.Mang, Tone.Xanh,
                "Sửa lỗi có mạng nhưng không vào được web, DNS chậm, IP xung đột.",
                Nut("Xóa bộ nhớ DNS", Ic.LamMoi, Tone.Xanh, () => TacVu.Chay("Flush DNS", log => HeThong.Chay(log, HeThong.Exe("ipconfig.exe"), "/flushdns"))),
                Nut("Xin lại IP (release / renew)", Ic.Mang, Tone.Xanh, () => TacVu.Chay("Xin lại IP", log =>
                {
                    HeThong.Chay(log, HeThong.Exe("ipconfig.exe"), "/release");
                    HeThong.Chay(log, HeThong.Exe("ipconfig.exe"), "/renew");
                })),
                Nut("Reset Winsock + TCP/IP", Ic.LamMoi, Tone.Cam, () => TacVu.Chay("Reset Winsock + TCP/IP", log =>
                {
                    HeThong.Chay(log, HeThong.Exe("netsh.exe"), "winsock reset");
                    HeThong.Chay(log, HeThong.Exe("netsh.exe"), "int ip reset");
                    HeThong.Chay(log, HeThong.Exe("ipconfig.exe"), "/flushdns");
                }, () => Ui.HoiKhoiDongLai(CuaSo))),
                Nut("DNS Google + Cloudflare", Ic.Mang, Tone.Ngoc, () => TacVu.Chay("Đặt DNS 8.8.8.8 / 1.1.1.1", log => HeThong.ChayPS(log,
                    "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {\r\n" +
                    "  Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses ('8.8.8.8','1.1.1.1')\r\n" +
                    "  Write-Output ('Đã đặt DNS cho ' + $_.Name) }\r\nClear-DnsClientCache"))),
                Nut("DNS tự động (DHCP)", Ic.Mang, Tone.Xam, () => TacVu.Chay("Đặt DNS tự động", log => HeThong.ChayPS(log,
                    "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {\r\n" +
                    "  Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ResetServerAddresses\r\n" +
                    "  Write-Output ('DNS tự động cho ' + $_.Name) }"))),
                Nut("Xem cấu hình IP", Ic.ThongTin, Tone.Xam, () => TacVu.Chay("ipconfig /all", log => HeThong.Chay(log, HeThong.Exe("ipconfig.exe"), "/all")))));

            Them(Nhom("Tùy chỉnh Windows", Ic.CaiDat, Tone.Tim,
                "Các chỉnh hay dùng khi cài máy mới. Explorer sẽ tự khởi động lại để áp dụng.",
                Nut("Hiện đuôi tệp (.docx, .exe)", Ic.TaiLieu, Tone.Tim, () => ChinhExplorer("Hiện đuôi tệp", EXPLORER, "HideFileExt", 0)),
                Nut("Hiện tệp ẩn", Ic.ThuMuc, Tone.Tim, () => ChinhExplorer("Hiện tệp ẩn", EXPLORER, "Hidden", 1)),
                Nut("Hiện This PC ra Desktop", Ic.ManHinh, Tone.Tim, () => ChinhExplorer("Hiện This PC",
                    @"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel", "{20D04FE0-3AEA-1069-A2D8-08002B30309D}", 0)),
                Nut("Menu chuột phải kiểu cũ (Win 11)", Ic.Menu, Tone.Tim, () => TacVu.Chay("Menu chuột phải kiểu cũ", log =>
                {
                    HeThong.DatChuoi(log, MENU_CU + @"\InprocServer32", "", "");
                    KhoiDongLaiExplorer(log);
                })),
                Nut("Menu chuột phải kiểu mới", Ic.Menu, Tone.Xam, () => TacVu.Chay("Menu chuột phải kiểu mới", log =>
                {
                    HeThong.XoaKhoa(log, MENU_CU);
                    KhoiDongLaiExplorer(log);
                })),
                Nut("Tắt Fast Startup", Ic.Nguon, Tone.Cam, () => TacVu.Chay("Tắt Fast Startup", log =>
                    HeThong.DatDword(log, @"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power", "HiberbootEnabled", 0))),
                Nut("Nguồn: hiệu suất cao", Ic.Nguon, Tone.XanhLa, () => TacVu.Chay("Power plan hiệu suất cao", log =>
                {
                    int ma = HeThong.Chay(log, HeThong.Exe("powercfg.exe"), "/setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c");
                    if (ma != 0) HeThong.Chay(log, HeThong.Exe("powercfg.exe"), "/duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c");
                })),
                Nut("Tạo điểm khôi phục", Ic.KhoiPhuc, Tone.XanhLa, () => TrangSaoLuu.TaoDiemKhoiPhuc())));

            Them(Nhom("Mở nhanh công cụ hệ thống", Ic.Apps, Tone.Xam, null,
                Mo("Device Manager", "devmgmt.msc"), Mo("Disk Management", "diskmgmt.msc"), Mo("Services", "services.msc"),
                Mo("Event Viewer", "eventvwr.msc"), Mo("Computer Management", "compmgmt.msc"), Mo("Network Connections", "ncpa.cpl"),
                Mo("System Properties", "sysdm.cpl"), Mo("Programs and Features", "appwiz.cpl"), Mo("Control Panel", "control.exe"),
                Mo("Registry Editor", "regedit.exe"), Mo("Group Policy", "gpedit.msc"), Mo("System Configuration", "msconfig.exe"),
                Mo("Windows Update", "ms-settings:windowsupdate"), Mo("Credential Manager", "control.exe", "/name Microsoft.CredentialManager"),
                Mo("Command Prompt (Admin)", "cmd.exe"), Mo("PowerShell (Admin)", "powershell.exe")));
        }

        static TheBo Nhom(string ten, string icon, Tone tone, string moTa, params Control[] nut)
        {
            TheBo t = TheBo.TuCao();
            Ui.ThemDuoi(t, new TieuDe(ten, icon, tone));
            if (moTa != null) Ui.ThemDuoi(t, new DoanVan(moTa));
            Ui.ThemDuoi(t, Ui.Khoang(4));
            Ui.ThemDuoi(t, Ui.Luoi(4, nut));
            return t;
        }

        static NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        static NutBo Mo(string ten, string lenh) { return Mo(ten, lenh, null); }

        static NutBo Mo(string ten, string lenh, string thamSo)
        {
            NutBo b = NutBo.Phu(ten, Ic.Link);
            b.CanTrai = true;
            b.Click += (s, e) => HeThong.Mo(lenh, thamSo);
            return b;
        }

        static void ChinhExplorer(string ten, string khoa, string giaTri, int so)
        {
            TacVu.Chay(ten, log =>
            {
                HeThong.DatDword(log, khoa, giaTri, so);
                KhoiDongLaiExplorer(log);
            });
        }

        static void KhoiDongLaiExplorer(NhatKy log)
        {
            log.Ghi("Khởi động lại Explorer...");
            HeThong.ChayPS(log, "Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2\r\n" +
                                "if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }");
        }

        void ResetWindowsUpdate()
        {
            if (!Ui.Hoi(CuaSo, "Dừng dịch vụ Windows Update, đổi tên thư mục SoftwareDistribution và catroot2 rồi bật lại?\n" +
                               "Dùng khi Windows Update báo lỗi / tải mãi không xong.")) return;
            TacVu.Chay("Reset Windows Update", log => HeThong.ChayPS(log, @"
$dv = 'wuauserv','bits','cryptsvc','msiserver','usosvc'
foreach ($d in $dv) { Stop-Service $d -Force -ErrorAction SilentlyContinue }
$t = Get-Date -Format 'yyyyMMdd_HHmmss'
foreach ($p in ""$env:windir\SoftwareDistribution"", ""$env:windir\System32\catroot2"") {
  if (Test-Path $p) {
    try { Rename-Item $p ($p + '.bak_' + $t) -ErrorAction Stop; Write-Output ('Đã đổi tên ' + $p) }
    catch { Write-Output ('Không đổi tên được ' + $p + ': ' + $_.Exception.Message) }
  }
}
foreach ($d in 'cryptsvc','bits','wuauserv') { Start-Service $d -ErrorAction SilentlyContinue }
Write-Output 'Xong. Mở Windows Update và kiểm tra lại.'"));
        }

        static void XoaTemp()
        {
            TacVu.Chay("Xóa tệp tạm", log =>
            {
                long tong = 0;
                int dem = 0;
                foreach (string d in new[] { Path.GetTempPath(), Path.Combine(HeThong.Windir, "Temp") })
                {
                    log.Ghi("Dọn " + d);
                    XoaTrong(d, ref tong, ref dem, false);
                }
                log.Tot("Đã xóa " + dem + " tệp, giải phóng " + (tong / 1048576.0).ToString("0.0") + " MB (bỏ qua tệp đang dùng).");
            });
        }

        static void XoaTrong(string thuMuc, ref long tong, ref int dem, bool xoaLuon)
        {
            try
            {
                foreach (string f in Directory.GetFiles(thuMuc))
                {
                    try
                    {
                        long kt = new FileInfo(f).Length;
                        File.SetAttributes(f, FileAttributes.Normal);
                        File.Delete(f);
                        tong += kt;
                        dem++;
                    }
                    catch (Exception) { }
                }
                foreach (string d in Directory.GetDirectories(thuMuc))
                {
                    // không đi theo junction / symlink
                    if ((File.GetAttributes(d) & FileAttributes.ReparsePoint) != 0) continue;
                    XoaTrong(d, ref tong, ref dem, true);
                }
                if (xoaLuon)
                {
                    try { Directory.Delete(thuMuc, false); } catch (Exception) { }
                }
            }
            catch (Exception) { }
        }
    }
}
