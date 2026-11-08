using System;
using System.Collections.Generic;
using System.IO;

namespace ToolkitIT
{
    public enum NoiSua { MayTram, MayChu, CaHai }

    /// <summary>1 bước sửa lỗi: mô tả (hiện cho người dùng) + việc cần làm.</summary>
    public class Buoc
    {
        public readonly string MoTa;
        public readonly Action<NhatKy> Lam;

        public Buoc(string moTa, Action<NhatKy> lam)
        {
            MoTa = moTa;
            Lam = lam;
        }
    }

    /// <summary>1 lỗi đã biết: thông báo Windows hiện ra, nguyên nhân, các bước sửa.</summary>
    public class LoiMau
    {
        public string Ma, TieuDe, CuaSo, ThongBao, NguyenNhan;
        public NoiSua Noi;
        public Buoc[] Buoc;
        public bool CanKhoiDongLai;
        /// <summary>Lỗi cần người dùng chọn thêm (vd cấp quyền thư mục): mở hộp thoại thay vì chạy các bước.</summary>
        public Action<System.Windows.Forms.IWin32Window> HanhDongRieng;
    }

    /// <summary>Danh mục lỗi máy in / chia sẻ LAN thường gặp và cách sửa.</summary>
    static class SuaLoi
    {
        const string PRINT = @"HKLM\SYSTEM\CurrentControlSet\Control\Print";
        const string RPC = @"HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Printers\RPC";
        const string PNP = @"HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Printers\PointAndPrint";
        const string LMW = @"HKLM\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters";
        const string LMW_POL = @"HKLM\SOFTWARE\Policies\Microsoft\Windows\LanmanWorkstation";
        const string LSA = @"HKLM\SYSTEM\CurrentControlSet\Control\Lsa";
        const string MAC_DINH = @"HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows";

        // ================= Các bước dùng chung =================

        public static readonly Buoc RpcMaHoaTat = new Buoc(
            "Máy chủ: bỏ yêu cầu mã hóa RPC cho máy in chia sẻ (RpcAuthnLevelPrivacyEnabled = 0)",
            log => HeThong.DatDword(log, PRINT, "RpcAuthnLevelPrivacyEnabled", 0));

        public static readonly Buoc RpcNamedPipe = new Buoc(
            "Máy trạm: kết nối máy in chia sẻ qua RPC over named pipes (Win 11 22H2+)",
            log =>
            {
                HeThong.DatDword(log, RPC, "RpcUseNamedPipeProtocol", 1);
                HeThong.DatDword(log, RPC, "RpcAuthentication", 0);
            });

        public static readonly Buoc RpcNghe = new Buoc(
            "Máy chủ: nhận kết nối máy in qua cả RPC over TCP và named pipes",
            log =>
            {
                HeThong.DatDword(log, RPC, "RpcProtocols", 7);
                HeThong.DatDword(log, RPC, "ForceKerberosForRpc", 0);
            });

        public static readonly Buoc PointAndPrint = new Buoc(
            "Máy trạm: cho phép tự tải driver từ máy chủ chia sẻ (Point and Print) không cần quyền Admin",
            log =>
            {
                HeThong.DatDword(log, PNP, "RestrictDriverInstallationToAdministrators", 0);
                HeThong.DatDword(log, PNP, "NoWarningNoElevationOnInstall", 1);
                HeThong.DatDword(log, PNP, "UpdatePromptSettings", 2);
            });

        public static readonly Buoc MacDinhCu = new Buoc(
            "Tắt \"Let Windows manage my default printer\" (LegacyDefaultPrinterMode = 1)",
            log => HeThong.DatDword(log, MAC_DINH, "LegacyDefaultPrinterMode", 1));

        public static readonly Buoc Spooler = new Buoc(
            "Dừng Print Spooler, xóa lệnh in bị kẹt, đặt chạy tự động rồi bật lại", LamMoiSpooler);

        public static readonly Buoc TuongLua = new Buoc(
            "Bật dịch vụ Windows Firewall (bắt buộc để chia sẻ máy in)",
            log =>
            {
                HeThong.KieuDichVu(log, "BFE", "auto");
                HeThong.KieuDichVu(log, "MpsSvc", "auto");
                HeThong.BatDichVu(log, "BFE");
                HeThong.BatDichVu(log, "MpsSvc");
            });

        public static readonly Buoc LuatChiaSe = new Buoc(
            "Mở tường lửa cho File and Printer Sharing + Network Discovery (luật dành cho mạng nội bộ)",
            HeThong.MoTuongLuaChiaSe);

        public static readonly Buoc MangPrivate = new Buoc(
            "Chuyển mạng đang dùng từ Public sang Private (cho phép chia sẻ trong LAN)",
            HeThong.MangRiengTu);

        public static readonly Buoc DichVuChiaSe = new Buoc(
            "Bật dịch vụ chia sẻ: Server, Workstation, Function Discovery, SSDP, UPnP, TCP/IP NetBIOS Helper",
            log =>
            {
                foreach (string dv in new[] { "LanmanServer", "LanmanWorkstation", "FDResPub", "fdPHost", "SSDPSRV", "upnphost", "lmhosts" })
                {
                    HeThong.KieuDichVu(log, dv, dv.StartsWith("Lanman") || dv == "FDResPub" ? "auto" : "demand");
                    HeThong.BatDichVu(log, dv);
                }
            });

        public static readonly Buoc NetBios = new Buoc(
            "Bật NetBIOS over TCP/IP trên các card mạng đang dùng",
            log => HeThong.ChayPS(log,
                "Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled = TRUE' | ForEach-Object {\r\n" +
                "  $r = Invoke-CimMethod -InputObject $_ -MethodName SetTcpipNetbios -Arguments @{ TcpipNetbiosOptions = [uint32]1 }\r\n" +
                "  Write-Output ('NetBIOS: ' + $_.Description + ' -> ' + $(if ($r.ReturnValue -eq 0) { 'đã bật' } else { 'mã ' + $r.ReturnValue })) }"));

        public static readonly Buoc GiaoThucCard = new Buoc(
            "Bật \"Client for Microsoft Networks\" và \"File and Printer Sharing\" trên card mạng",
            log => HeThong.ChayPS(log,
                "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {\r\n" +
                "  Enable-NetAdapterBinding -Name $_.Name -ComponentID ms_msclient, ms_server -ErrorAction SilentlyContinue\r\n" +
                "  Write-Output ('Đã bật Client/File Sharing trên ' + $_.Name) }"));

        public static readonly Buoc KhachKhongMatKhau = new Buoc(
            "Máy trạm: cho phép vào thư mục chia sẻ không mật khẩu (Guest) — AllowInsecureGuestAuth = 1",
            log =>
            {
                HeThong.DatDword(log, LMW, "AllowInsecureGuestAuth", 1);
                HeThong.DatDword(log, LMW_POL, "AllowInsecureGuestAuth", 1);
            });

        public static readonly Buoc KyKhachTat = new Buoc(
            "Máy trạm: tắt bắt buộc ký SMB (Win 11 24H2 bật mặc định, máy chủ / NAS cũ không đáp ứng)",
            log =>
            {
                HeThong.DatDword(log, LMW, "RequireSecuritySignature", 0);
                HeThong.ChayPS(log, "Set-SmbClientConfiguration -RequireSecuritySignature $false -EnableInsecureGuestLogons $true -Force -ErrorAction SilentlyContinue; Write-Output 'Đã cập nhật cấu hình SMB Client.'");
            });

        public static readonly Buoc KyChuTat = new Buoc(
            "Máy chủ: tắt bắt buộc ký SMB (máy trạm cũ, máy scan, NAS kết nối được)",
            log => HeThong.ChayPS(log, "Set-SmbServerConfiguration -RequireSecuritySignature $false -Force; Write-Output 'Đã cập nhật cấu hình SMB Server.'"));

        public static readonly Buoc MatKhauTrong = new Buoc(
            "Máy chủ: cho phép tài khoản mật khẩu trống đăng nhập qua mạng (LimitBlankPasswordUse = 0)",
            log => HeThong.DatDword(log, LSA, "LimitBlankPasswordUse", 0));

        public static readonly Buoc BatGuest = new Buoc(
            "Máy chủ: bật tài khoản Guest và gỡ Guest khỏi chính sách \"Deny access to this computer from the network\"",
            log => HeThong.ChayPS(log, @"
$g = Get-LocalUser | Where-Object { $_.SID.Value -like 'S-1-5-*-501' } | Select-Object -First 1
if (-not $g) { Write-Error 'Không tìm thấy tài khoản Guest'; exit 1 }
Enable-LocalUser -InputObject $g
Write-Output ('Đã bật tài khoản ' + $g.Name)
$cfg = Join-Path $env:TEMP 'ittk_quyen.inf'; $db = Join-Path $env:TEMP 'ittk_quyen.sdb'
secedit /export /cfg $cfg /areas USER_RIGHTS | Out-Null
$sid = '*' + $g.SID.Value
$moi = foreach ($d in (Get-Content $cfg)) {
  if ($d -match '^SeDenyNetworkLogonRight\s*=\s*(.*)$') {
    $con = $Matches[1].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne $sid -and $_ -ne $g.Name -and $_ -ne '*S-1-5-32-546' }
    'SeDenyNetworkLogonRight = ' + ($con -join ',')
  } else { $d }
}
$moi | Set-Content $cfg -Encoding Unicode
secedit /configure /db $db /cfg $cfg /areas USER_RIGHTS | Out-Null
Remove-Item $cfg, $db -ErrorAction SilentlyContinue
Write-Output 'Đã cho phép Guest truy cập máy này qua mạng.'"));

        public static readonly Buoc Smb1Khach = new Buoc(
            "Bật SMB 1.0 Client (chỉ để vào NAS / máy đời cũ — giao thức cũ, kém an toàn)",
            log => HeThong.ChayPS(log, "Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol-Client -All -NoRestart | Out-Null; Write-Output 'Đã bật SMB 1.0 Client (cần khởi động lại).'"));

        public static readonly Buoc KhoiDongWorkstation = new Buoc(
            "Khởi động lại dịch vụ Workstation để nhận cấu hình mới",
            log => HeThong.ChayPS(log, "Restart-Service LanmanWorkstation -Force -ErrorAction SilentlyContinue; Write-Output 'Đã khởi động lại Workstation.'"));

        static void LamMoiSpooler(NhatKy log)
        {
            HeThong.TatDichVu(log, "Spooler");
            string thuMuc = Path.Combine(HeThong.Sys32, @"spool\PRINTERS");
            int xoa = 0;
            try
            {
                foreach (string f in Directory.GetFiles(thuMuc))
                {
                    try { File.Delete(f); xoa++; } catch (Exception) { }
                }
            }
            catch (Exception ex)
            {
                log.Canh("Không đọc được " + thuMuc + ": " + ex.Message);
            }
            log.Ghi("Đã xóa " + xoa + " tệp lệnh in bị kẹt.");
            HeThong.KieuDichVu(log, "Spooler", "auto");
            HeThong.BatDichVu(log, "Spooler");
        }

        // ================= Lỗi máy in =================

        static LoiMau L(string ma, NoiSua noi, string tieuDe, string thongBao, string nguyenNhan, params Buoc[] buoc)
        {
            return new LoiMau { Ma = ma, Noi = noi, TieuDe = tieuDe, CuaSo = "Connect to Printer", ThongBao = thongBao, NguyenNhan = nguyenNhan, Buoc = buoc };
        }

        public static List<LoiMau> LoiMayIn()
        {
            return new List<LoiMau>
            {
                L("0x00000bc4", NoiSua.MayTram, "Không tìm thấy máy in",
                    "Operation failed with error 0x00000bc4. No printers were found.",
                    "Windows 11 22H2 trở lên kết nối máy in chia sẻ bằng RPC over TCP; máy chủ cũ không trả lời.",
                    RpcNamedPipe, Spooler),
                L("0x00000bcb", NoiSua.MayTram, "Cần tải driver từ máy chủ",
                    "Windows cannot connect to the printer. Operation failed with error 0x00000bcb.",
                    "Chính sách Point and Print chỉ cho Admin cài driver lấy từ máy chủ chia sẻ.",
                    PointAndPrint, RpcNamedPipe, Spooler),
                L("0x0000007c", NoiSua.MayTram, "Không kết nối được máy in",
                    "Windows cannot connect to the printer. Operation failed with error 0x0000007c.",
                    "Driver lấy từ máy chủ không tương thích sau bản vá bảo mật (thường gặp khi máy chủ là Win 7 / Win 10 cũ).",
                    PointAndPrint, RpcNamedPipe, Spooler),
                L("0x00004005", NoiSua.MayTram, "Thao tác không hoàn tất",
                    "Operation could not be completed (error 0x00004005).",
                    "Print Spooler kẹt lệnh in hoặc driver lỗi ở máy trạm.",
                    Spooler, RpcNamedPipe, PointAndPrint),
                L("Policy In Effect", NoiSua.MayTram, "Chính sách chặn kết nối máy in",
                    "A policy is in effect on your computer which prevents you from connecting to this print queue. Please contact your system administrator.",
                    "Chính sách Point and Print của Windows chặn máy in chia sẻ chưa được tin cậy.",
                    PointAndPrint, Spooler),
                L("0x0000011b", NoiSua.MayChu, "Lỗi kết nối máy in chia sẻ",
                    "Windows cannot connect to the printer. Operation failed with error 0x0000011b.",
                    "Bản vá CVE-2021-1678 bắt buộc mã hóa RPC; máy trạm cũ không đáp ứng. Chạy trên MÁY CHỦ (máy cắm máy in).",
                    RpcMaHoaTat, RpcNghe, Spooler),
                L("0x000006d9", NoiSua.MayChu, "Không chia sẻ được máy in",
                    "Printer settings could not be saved. Operation could not be completed (error 0x000006d9).",
                    "Dịch vụ Windows Firewall đang tắt nên Windows không cho chia sẻ máy in.",
                    TuongLua, LuatChiaSe, Spooler),
                L("0x00000709", NoiSua.CaHai, "Không đặt được máy in mặc định",
                    "Operation could not be completed (error 0x00000709). Double check the printer name and make sure that the printer is connected to the network.",
                    "Windows tự quản lý máy in mặc định, hoặc RPC giữa 2 máy không khớp.",
                    MacDinhCu, RpcNamedPipe, RpcMaHoaTat, Spooler),
                L("0x00000012", NoiSua.CaHai, "There are no more files",
                    "Windows cannot connect to the printer. Operation failed with error 0x00000012.",
                    "Hai máy lệch bản vá bảo mật in ấn (RPC / Point and Print).",
                    RpcMaHoaTat, RpcNamedPipe, PointAndPrint, Spooler),
            };
        }

        /// <summary>Sửa tất cả lỗi máy in + mạng LAN thường gặp (chạy được trên cả máy chủ và máy trạm).</summary>
        public static Buoc[] MotChamTatCa()
        {
            return new[] { RpcMaHoaTat, RpcNghe, RpcNamedPipe, PointAndPrint, MacDinhCu, TuongLua, DichVuChiaSe, LuatChiaSe, MangPrivate, NetBios, Spooler };
        }

        /// <summary>Đưa các khóa bảo mật in ấn về mặc định của Microsoft (bỏ các nới lỏng ở trên).</summary>
        public static readonly Buoc HoanTacMayIn = new Buoc(
            "Khôi phục bảo mật in ấn mặc định (xóa RpcAuthnLevelPrivacyEnabled, chính sách RPC, Point and Print)",
            log =>
            {
                HeThong.XoaGiaTri(log, PRINT, "RpcAuthnLevelPrivacyEnabled");
                foreach (string v in new[] { "RpcUseNamedPipeProtocol", "RpcAuthentication", "RpcProtocols", "ForceKerberosForRpc" })
                    HeThong.XoaGiaTri(log, RPC, v);
                foreach (string v in new[] { "RestrictDriverInstallationToAdministrators", "NoWarningNoElevationOnInstall", "UpdatePromptSettings" })
                    HeThong.XoaGiaTri(log, PNP, v);
                LamMoiSpooler(log);
            });

        // ================= Lỗi chia sẻ dữ liệu =================

        static LoiMau C(string ma, NoiSua noi, string tieuDe, string cuaSo, string thongBao, string nguyenNhan, bool khoiDongLai, params Buoc[] buoc)
        {
            return new LoiMau { Ma = ma, Noi = noi, TieuDe = tieuDe, CuaSo = cuaSo, ThongBao = thongBao, NguyenNhan = nguyenNhan, Buoc = buoc, CanKhoiDongLai = khoiDongLai };
        }

        public static List<LoiMau> LoiChiaSe(Action<System.Windows.Forms.IWin32Window> capQuyen)
        {
            var ds = new List<LoiMau>
            {
                C("Blank password", NoiSua.MayChu, "Limit local account use of blank passwords", "Open Folder",
                    "\\\\MAYCHU is not accessible. You might not have permission to use this network resource.\n\nLogon failure: user account restriction. Possible reasons are blank passwords not allowed, logon hour restrictions, or a policy restriction has been enforced.",
                    "Tài khoản trên máy chủ không đặt mật khẩu; Windows mặc định cấm tài khoản mật khẩu trống đăng nhập qua mạng.",
                    false, MatKhauTrong),
                new LoiMau
                {
                    Ma = "Access denied", Noi = NoiSua.MayChu, TieuDe = "You do not have permission to access", CuaSo = "Network Error",
                    ThongBao = "Windows cannot access \\\\MAYCHU\\DuLieu\n\nYou do not have permission to access \\\\MAYCHU\\DuLieu. Contact your network administrator to request access.",
                    NguyenNhan = "Thư mục đã chia sẻ nhưng chưa cấp quyền (Share + NTFS) cho tài khoản / Everyone. Bấm sửa để chọn thư mục và cấp quyền.",
                    HanhDongRieng = capQuyen
                },
                C("Account disabled", NoiSua.MayChu, "This user can't sign in because this account is currently disabled", "Open Folder",
                    "\\\\MAYCHU is not accessible. You might not have permission to use this network resource.\n\nThis user can't sign in because this account is currently disabled.",
                    "Máy trạm vào không mật khẩu (Guest) nhưng tài khoản Guest trên máy chủ đang bị tắt.",
                    false, BatGuest, DichVuChiaSe),
                C("Không thấy máy", NoiSua.MayChu, "Máy chủ không hiện trong Network", "Network",
                    "Network discovery is turned off. Network computers and devices are not visible. Please turn on network discovery in Network and Sharing Center.",
                    "Network Discovery / File and Printer Sharing đang tắt, mạng đang ở chế độ Public.",
                    false, DichVuChiaSe, LuatChiaSe, MangPrivate, NetBios),

                C("0x80070044", NoiSua.MayTram, "An extended error has occurred", "\\\\MAYCHU",
                    "\\\\MAYCHU\n\nAn extended error has occurred.",
                    "Windows 11 24H2 bắt buộc ký SMB và chặn Guest; máy chủ / NAS không đáp ứng.",
                    false, KyKhachTat, KhachKhongMatKhau, KhoiDongWorkstation),
                C("0x80070035", NoiSua.MayTram, "The network path was not found", "Network Error",
                    "Windows cannot access \\\\MAYCHU\n\nCheck the spelling of the name. Otherwise, there might be a problem with your network.\n\nError code: 0x80070035\nThe network path was not found.",
                    "Dịch vụ chia sẻ / NetBIOS tắt, tường lửa chặn hoặc mạng ở chế độ Public.",
                    true, DichVuChiaSe, LuatChiaSe, MangPrivate, NetBios, GiaoThucCard),
                C("0x800704f8", NoiSua.MayTram, "You can't access this shared folder", "\\\\MAYCHU",
                    "You can't access this shared folder because your organization's security policies block unauthenticated guest access. These policies help protect your PC from unsafe or malicious devices on the network.",
                    "Windows 10/11 mặc định chặn truy cập Guest (không mật khẩu).",
                    false, KhachKhongMatKhau, KyKhachTat, KhoiDongWorkstation),
                C("0x800704cf", NoiSua.MayTram, "The network location cannot be reached", "Network Error",
                    "Windows cannot access \\\\MAYCHU\n\nError code: 0x800704cf\nThe network location cannot be reached.",
                    "Card mạng tắt \"Client for Microsoft Networks\" hoặc dịch vụ Workstation / NetBIOS Helper không chạy.",
                    true, GiaoThucCard, DichVuChiaSe, NetBios),
                C("0x80004005", NoiSua.MayTram, "Unspecified error (NAS / máy cũ)", "Network Error",
                    "Windows cannot access \\\\NAS\n\nError code: 0x80004005\nUnspecified error.",
                    "Thiết bị chỉ hỗ trợ SMB 1.0 (NAS, máy scan, Windows XP...). Chỉ bật SMB1 khi thật sự cần.",
                    true, Smb1Khach, KhachKhongMatKhau, KyKhachTat),
            };
            return ds;
        }

        public static readonly Buoc HoanTacChiaSe = new Buoc(
            "Khôi phục bảo mật chia sẻ mặc định (chặn Guest, bắt mật khẩu, bật lại ký SMB ở máy trạm)",
            log =>
            {
                HeThong.XoaGiaTri(log, LMW, "AllowInsecureGuestAuth");
                HeThong.XoaGiaTri(log, LMW_POL, "AllowInsecureGuestAuth");
                HeThong.XoaGiaTri(log, LMW, "RequireSecuritySignature");
                HeThong.DatDword(log, LSA, "LimitBlankPasswordUse", 1);
                HeThong.ChayPS(log,
                    "$g = Get-LocalUser | Where-Object { $_.SID.Value -like 'S-1-5-*-501' } | Select-Object -First 1\r\n" +
                    "if ($g -and $g.Enabled) { Disable-LocalUser -InputObject $g; Write-Output ('Đã tắt tài khoản ' + $g.Name) }\r\n" +
                    "Set-SmbClientConfiguration -EnableInsecureGuestLogons $false -Force -ErrorAction SilentlyContinue\r\n" +
                    "Write-Output 'Đã khôi phục cấu hình SMB Client.'");
            });

        /// <summary>Gộp các bước của nhiều lỗi, bỏ bước trùng; Print Spooler luôn làm sau cùng.</summary>
        public static List<Buoc> Gop(IEnumerable<LoiMau> loi)
        {
            var kq = new List<Buoc>();
            bool spooler = false;
            foreach (LoiMau l in loi)
            {
                if (l.Buoc == null) continue;
                foreach (Buoc b in l.Buoc)
                {
                    if (b == Spooler) { spooler = true; continue; }
                    if (!kq.Contains(b)) kq.Add(b);
                }
            }
            if (spooler) kq.Add(Spooler);
            return kq;
        }

        /// <summary>Chạy lần lượt các bước, bước lỗi không làm dừng các bước sau.</summary>
        public static void ChayCacBuoc(NhatKy log, IList<Buoc> buoc)
        {
            int loi = 0;
            for (int i = 0; i < buoc.Count; i++)
            {
                log.TieuDe("Bước " + (i + 1) + "/" + buoc.Count + ": " + buoc[i].MoTa);
                try
                {
                    buoc[i].Lam(log);
                }
                catch (Exception ex)
                {
                    loi++;
                    log.Loi(HeThong.ThongDiep(ex));
                }
            }
            if (loi > 0) log.Canh("Có " + loi + " bước bị lỗi, xem chi tiết ở trên.");
        }
    }
}
