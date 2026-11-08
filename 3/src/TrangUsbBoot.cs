using System;
using System.Collections.Generic;
using System.IO;
using System.Management;
using System.Security;
using System.Text;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Tạo USB cài Windows: chép ISO ra USB (FAT32, tự chia install.wim &gt; 4 GB) + tạo file autounattend.xml.</summary>
    public class TrangUsbBoot : TrangCuon
    {
        readonly ComboBox chonUsb, chonTz, chonVung;
        readonly TextBox oIso, oNhan, oUser, oMk, oMay;
        readonly RadioButton rMbr, rGpt;
        readonly CheckBox hopTuCai, hopBoQuaTpm, hopTaiKhoanCucBo, hopAnWifi;

        class Usb
        {
            public int So;
            public string Ten;
            public long KichThuoc;
            public override string ToString()
            {
                return "Disk " + So + " — " + Ten + " (" + HeThong.Gb(KichThuoc) + ")";
            }
        }

        static readonly string[,] MUI_GIO =
        {
            { "(UTC+07:00) Việt Nam, Bangkok, Jakarta", "SE Asia Standard Time" },
            { "(UTC+08:00) Singapore, Kuala Lumpur", "Singapore Standard Time" },
            { "(UTC) Giờ quốc tế", "UTC" }
        };

        public TrangUsbBoot()
        {
            TheBo usb = TheBo.TuCao();
            Ui.ThemDuoi(usb, new TieuDe("Tạo USB cài Windows từ file ISO", Ic.Usb, Tone.Tim));
            Ui.ThemDuoi(usb, new DoanVan("Dùng ISO chính hãng tải từ Microsoft. USB tối thiểu 8 GB; TOÀN BỘ dữ liệu trên USB sẽ bị xóa. " +
                "Phân vùng MBR + FAT32 khởi động được cả UEFI lẫn Legacy BIOS; tệp install.wim lớn hơn 4 GB được tự chia nhỏ (install.swm)."));
            TableLayoutPanel bang = Ui.BangNhap();
            chonUsb = Ui.HopChon();
            var lamMoi = NutBo.Phu("Làm mới", Ic.LamMoi);
            lamMoi.AutoSize = true;
            lamMoi.Margin = Ui.Pad(6, 2, 0, 2);
            lamMoi.Click += (s, e) => NapUsb();
            Ui.DongNhap(bang, "USB", Ui.HangNgang(chonUsb, lamMoi));
            oIso = Ui.O("Đường dẫn tệp .iso");
            var chonIso = NutBo.Phu("Chọn ISO...", Ic.ThuMuc);
            chonIso.AutoSize = true;
            chonIso.Margin = Ui.Pad(6, 2, 0, 2);
            chonIso.Click += (s, e) =>
            {
                using (var d = new OpenFileDialog { Filter = "Tệp ISO (*.iso)|*.iso" })
                    if (d.ShowDialog(CuaSo) == DialogResult.OK) oIso.Text = d.FileName;
            };
            Ui.DongNhap(bang, "File ISO", Ui.HangNgang(oIso, chonIso));
            rMbr = Ui.Chon1("MBR — chạy cả UEFI và Legacy BIOS (khuyên dùng)", true);
            rGpt = Ui.Chon1("GPT — chỉ UEFI", false);
            Ui.DongNhap(bang, "Kiểu phân vùng", Ui.Dong(rMbr, rGpt));
            oNhan = Ui.O(null);
            oNhan.Text = "WINUSB";
            oNhan.MaxLength = 11;
            Ui.DongNhap(bang, "Tên ổ USB", oNhan);
            Ui.ThemDuoi(usb, bang);
            hopTuCai = Ui.Hop("Chép kèm file tự động cài autounattend.xml (cấu hình ở thẻ bên dưới)", false);
            Ui.ThemDuoi(usb, Ui.Dong(hopTuCai));
            Ui.ThemDuoi(usb, Ui.Khoang(8));
            Ui.ThemDuoi(usb, Ui.Luoi(4,
                Nut("Bắt đầu tạo USB", Ic.Chay, Tone.Tim, true, TaoUsb),
                TrangDriver.Web("Tải ISO Windows 11 (Microsoft)", "https://www.microsoft.com/software-download/windows11"),
                TrangDriver.Web("Tải ISO Windows 10 (Microsoft)", "https://www.microsoft.com/software-download/windows10"),
                Nut("Mở Disk Management", Ic.O, Tone.Xam, false, () => HeThong.Mo("diskmgmt.msc"))));
            Them(usb);

            TheBo tc = TheBo.TuCao();
            Ui.ThemDuoi(tc, new TieuDe("File tự động cài Windows (autounattend.xml)", Ic.TaiLieu, Tone.Xanh));
            Ui.ThemDuoi(tc, new DoanVan("Đặt ở thư mục gốc USB cài Win (hoặc USB Ventoy): Windows tự bỏ qua điều khoản, màn hình đăng nhập tài khoản Microsoft, " +
                "tạo sẵn tài khoản Admin cục bộ, đặt múi giờ Việt Nam. Bước chọn ổ đĩa để cài vẫn do bạn làm (không tự xóa ổ cứng). " +
                "Mật khẩu được ghi dạng chữ trong tệp — đổi mật khẩu sau khi cài nếu cần."));
            TableLayoutPanel b2 = Ui.BangNhap();
            oUser = Ui.O(null);
            oUser.Text = "Admin";
            oMk = Ui.O("Để trống = không mật khẩu");
            oMk.UseSystemPasswordChar = true;
            oMay = Ui.O("Để trống = Windows tự đặt tên");
            chonTz = Ui.HopChon();
            for (int i = 0; i < MUI_GIO.GetLength(0); i++) chonTz.Items.Add(MUI_GIO[i, 0]);
            chonTz.SelectedIndex = 0;
            chonVung = Ui.HopChon("Việt Nam (ngày dd/MM/yyyy, số 1.234,5)", "English - United States");
            Ui.DongNhap(b2, "Tài khoản", oUser);
            Ui.DongNhap(b2, "Mật khẩu", oMk);
            Ui.DongNhap(b2, "Tên máy", oMay);
            Ui.DongNhap(b2, "Múi giờ", chonTz);
            Ui.DongNhap(b2, "Định dạng vùng", chonVung);
            Ui.ThemDuoi(tc, b2);
            hopTaiKhoanCucBo = Ui.Hop("Bỏ qua tài khoản Microsoft / bắt buộc có mạng khi cài", true);
            hopAnWifi = Ui.Hop("Bỏ qua màn hình chọn Wi-Fi", false);
            hopBoQuaTpm = Ui.Hop("Bỏ qua kiểm tra TPM 2.0 / Secure Boot / RAM (cài Win 11 cho máy cũ — Microsoft không hỗ trợ chính thức)", false);
            Ui.ThemDuoi(tc, Ui.Dong(hopTaiKhoanCucBo, hopAnWifi));
            Ui.ThemDuoi(tc, Ui.Dong(hopBoQuaTpm));
            Ui.ThemDuoi(tc, Ui.Khoang(8));
            Ui.ThemDuoi(tc, Ui.Luoi(4,
                Nut("Lưu autounattend.xml...", Ic.Luu, Tone.Xanh, false, LuuUnattend),
                Nut("Xem trước", Ic.TaiLieu, Tone.Xam, false, () => FormXem.Hien(CuaSo, "autounattend.xml", TaoUnattend(), "Tệp XML (*.xml)|*.xml")),
                null, null));
            Them(tc);
        }

        static NutBo Nut(string ten, string icon, Tone tone, bool dac, Action lam)
        {
            var b = new NutBo(ten, icon, tone, dac);
            b.Click += (s, e) => lam();
            return b;
        }

        protected override void KhiHienLanDau() { NapUsb(); }

        void NapUsb()
        {
            TacVu.Nen(this, () =>
            {
                var ds = new List<Usb>();
                foreach (ManagementObject o in HeThong.Wmi(@"root\Microsoft\Windows\Storage", "SELECT Number, FriendlyName, Size, BusType, IsSystem, IsBoot FROM MSFT_Disk"))
                {
                    bool heThong = (o["IsSystem"] is bool && (bool)o["IsSystem"]) || (o["IsBoot"] is bool && (bool)o["IsBoot"]);
                    if (HeThong.L(o, "BusType") != 7 || heThong) continue;
                    ds.Add(new Usb { So = (int)HeThong.L(o, "Number"), Ten = HeThong.S(o, "FriendlyName"), KichThuoc = HeThong.L(o, "Size") });
                }
                return ds;
            }, ds =>
            {
                chonUsb.Items.Clear();
                foreach (Usb u in ds) chonUsb.Items.Add(u);
                if (ds.Count > 0) chonUsb.SelectedIndex = 0;
                NhatKy.Chung.Ghi(ds.Count == 0 ? "Không thấy USB nào (cắm USB rồi bấm Làm mới)." : "Tìm thấy " + ds.Count + " USB.");
            });
        }

        void TaoUsb()
        {
            var u = chonUsb.SelectedItem as Usb;
            string iso = oIso.Text.Trim();
            if (u == null)
            {
                Ui.BaoTin(CuaSo, "Chưa chọn USB (cắm USB rồi bấm Làm mới).");
                return;
            }
            if (!File.Exists(iso))
            {
                Ui.BaoTin(CuaSo, "Chọn tệp ISO Windows.");
                return;
            }
            if (new FileInfo(iso).Length + 200L * 1024 * 1024 > u.KichThuoc)
            {
                Ui.BaoLoi(CuaSo, "USB quá nhỏ so với tệp ISO.");
                return;
            }
            string nhan = oNhan.Text.Trim().ToUpperInvariant();
            var sbNhan = new StringBuilder();
            foreach (char c in nhan) if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-') sbNhan.Append(c);
            nhan = sbNhan.Length > 0 ? sbNhan.ToString() : "WINUSB";

            string[] xn = FormNhap.Hien(CuaSo, "Xác nhận xóa USB",
                "TOÀN BỘ dữ liệu trên " + u + " sẽ bị XÓA và không khôi phục được.\nGõ chữ XOA (in hoa) để tiếp tục.",
                "Xóa USB & tạo", TruongNhap.Chu("Gõ XOA", "", true));
            if (xn == null) return;
            if (xn[0] != "XOA")
            {
                Ui.BaoTin(CuaSo, "Chưa gõ đúng chữ XOA — đã hủy.");
                return;
            }
            string tuCai = "";
            if (hopTuCai.Checked)
            {
                tuCai = Path.Combine(HeThong.ThuMucTam, "autounattend.xml");
                File.WriteAllText(tuCai, TaoUnattend(), new UTF8Encoding(false));
            }
            string script =
                "$ErrorActionPreference = 'Stop'\r\n" +
                "$so = " + u.So + "\r\n" +
                "$iso = " + HeThong.Ps(iso) + "\r\n" +
                "$gpt = " + (rGpt.Checked ? "$true" : "$false") + "\r\n" +
                "$nhan = " + HeThong.Ps(nhan) + "\r\n" +
                "$tuCai = " + HeThong.Ps(tuCai) + "\r\n" + SCRIPT_USB;
            TacVu.Chay("Tạo USB cài Windows", log =>
            {
                int ma = HeThong.ChayPS(log, script);
                if (ma != 0) throw new LoiTacVu("Tạo USB thất bại (xem lỗi ở trên).");
            }, NapUsb);
        }

        const string SCRIPT_USB = @"
$d = Get-Disk -Number $so
if ([string]$d.BusType -ne 'USB' -or $d.IsSystem -or $d.IsBoot) { throw ('Ổ đĩa số ' + $so + ' không phải USB hoặc đang chứa Windows — dừng để bảo vệ dữ liệu.') }
Write-Output ('USB: ' + $d.FriendlyName + ' (' + [math]::Round($d.Size / 1GB, 1) + ' GB)')
Write-Output 'Gắn tệp ISO...'
$img = Mount-DiskImage -ImagePath $iso -PassThru
try {
  Start-Sleep -Seconds 2
  $chuIso = ($img | Get-Volume).DriveLetter
  if (-not $chuIso) { throw 'Không đọc được ổ ảo của tệp ISO.' }
  $src = [string]$chuIso + ':\'
  if (-not (Test-Path ($src + 'sources'))) { throw 'Tệp ISO không phải bộ cài Windows (không có thư mục sources).' }
  $wim = Get-Item ($src + 'sources\install.wim') -ErrorAction SilentlyContinue
  $dung = @(@((Get-Volume).DriveLetter) + @((Get-PSDrive -PSProvider FileSystem).Name) | Where-Object { $_ } | ForEach-Object { ([string]$_).ToUpper() })
  $chu = $null
  foreach ($c in [char[]]'ZYXWVUTSRQPONMLKJIHG') { if ($dung -notcontains [string]$c) { $chu = [string]$c; break } }
  if (-not $chu) { throw 'Hết ký tự ổ đĩa trống.' }
  $kt = ''
  if ($d.Size -gt 32GB) { $kt = ' size=32000' }
  $lenh = @('select disk ' + $so, 'clean')
  if ($gpt) { $lenh += 'convert gpt' } else { $lenh += 'convert mbr' }
  $lenh += 'create partition primary' + $kt
  if (-not $gpt) { $lenh += 'active' }
  $lenh += 'format fs=fat32 quick label=' + $nhan
  $lenh += 'assign letter=' + $chu
  $tep = Join-Path $env:TEMP 'ittk_diskpart.txt'
  $lenh | Set-Content -Path $tep -Encoding ASCII
  Write-Output 'Xóa và định dạng USB (FAT32)...'
  diskpart /s $tep | Where-Object { $_.Trim() } | ForEach-Object { Write-Output ('  ' + $_.Trim()) }
  Remove-Item $tep -ErrorAction SilentlyContinue
  $dst = $chu + ':\'
  Start-Sleep -Seconds 3
  if (-not (Test-Path $dst)) { throw ('Không thấy ổ ' + $dst + ' sau khi định dạng (diskpart lỗi?).') }
  Write-Output 'Chép bộ cài sang USB (5–20 phút tùy tốc độ USB)...'
  robocopy $src $dst /E /R:1 /W:1 /NFL /NDL /NP /NJH /XF install.wim | Where-Object { $_.Trim() } | ForEach-Object { Write-Output ('  ' + $_.Trim()) }
  if ($LASTEXITCODE -ge 8) { throw ('Chép tệp lỗi (robocopy ' + $LASTEXITCODE + ')') }
  if ($wim) {
    if ($wim.Length -ge 4GB) {
      Write-Output 'install.wim lớn hơn 4 GB (giới hạn FAT32) → chia thành install.swm...'
      $a1 = '/ImageFile:' + $wim.FullName
      $a2 = '/SWMFile:' + $dst + 'sources\install.swm'
      dism /Split-Image $a1 $a2 /FileSize:3800 | Where-Object { $_.Trim() } | ForEach-Object { Write-Output ('  ' + $_.Trim()) }
      if ($LASTEXITCODE -ne 0) { throw 'DISM chia tệp install.wim lỗi.' }
    } else {
      Write-Output 'Chép install.wim...'
      Copy-Item $wim.FullName ($dst + 'sources\') -Force
    }
  }
  if (-not $gpt -and (Test-Path ($src + 'boot\bootsect.exe'))) {
    Write-Output 'Ghi boot code cho Legacy BIOS (bootsect)...'
    & ($src + 'boot\bootsect.exe') /nt60 ($chu + ':') /force /mbr | Where-Object { $_.Trim() } | ForEach-Object { Write-Output ('  ' + $_.Trim()) }
  }
  if ($tuCai) { Copy-Item $tuCai ($dst + 'autounattend.xml') -Force; Write-Output 'Đã chép autounattend.xml' }
  Write-Output ('HOÀN TẤT: USB ' + $dst + ' đã sẵn sàng để cài Windows.')
} finally {
  Dismount-DiskImage -ImagePath $iso | Out-Null
}";

        static string X(string s) { return SecurityElement.Escape(s ?? ""); }

        string TaoUnattend()
        {
            const string CP = " processorArchitecture=\"amd64\" publicKeyToken=\"31bf3856ad364e35\" language=\"neutral\" versionScope=\"nonSxS\"";
            string user = oUser.Text.Trim().Length > 0 ? oUser.Text.Trim() : "Admin";
            string may = oMay.Text.Trim().Length > 0 ? oMay.Text.Trim().ToUpperInvariant() : "*";
            string tz = MUI_GIO[Math.Max(0, chonTz.SelectedIndex), 1];
            string vung = chonVung.SelectedIndex == 0 ? "vi-VN" : "en-US";
            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n");
            sb.Append("<!-- Tạo bởi IT Toolkit -->\r\n");
            sb.Append("<unattend xmlns=\"urn:schemas-microsoft-com:unattend\" xmlns:wcm=\"http://schemas.microsoft.com/WMIConfig/2002/State\">\r\n");

            sb.Append("  <settings pass=\"windowsPE\">\r\n");
            sb.Append("    <component name=\"Microsoft-Windows-Setup\"").Append(CP).Append(">\r\n");
            sb.Append("      <UserData>\r\n        <AcceptEula>true</AcceptEula>\r\n      </UserData>\r\n");
            if (hopBoQuaTpm.Checked)
            {
                sb.Append("      <RunSynchronous>\r\n");
                string[] khoa = { "BypassTPMCheck", "BypassSecureBootCheck", "BypassRAMCheck" };
                for (int i = 0; i < khoa.Length; i++)
                    sb.Append("        <RunSynchronousCommand wcm:action=\"add\">\r\n          <Order>").Append(i + 1)
                      .Append("</Order>\r\n          <Path>reg.exe add HKLM\\SYSTEM\\Setup\\LabConfig /v ").Append(khoa[i])
                      .Append(" /t REG_DWORD /d 1 /f</Path>\r\n        </RunSynchronousCommand>\r\n");
                sb.Append("      </RunSynchronous>\r\n");
            }
            sb.Append("    </component>\r\n  </settings>\r\n");

            sb.Append("  <settings pass=\"specialize\">\r\n");
            sb.Append("    <component name=\"Microsoft-Windows-Shell-Setup\"").Append(CP).Append(">\r\n");
            sb.Append("      <ComputerName>").Append(X(may)).Append("</ComputerName>\r\n");
            sb.Append("      <TimeZone>").Append(tz).Append("</TimeZone>\r\n");
            sb.Append("    </component>\r\n");
            if (hopTaiKhoanCucBo.Checked)
            {
                sb.Append("    <component name=\"Microsoft-Windows-Deployment\"").Append(CP).Append(">\r\n");
                sb.Append("      <RunSynchronous>\r\n        <RunSynchronousCommand wcm:action=\"add\">\r\n          <Order>1</Order>\r\n");
                sb.Append("          <Path>reg.exe add HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE /v BypassNRO /t REG_DWORD /d 1 /f</Path>\r\n");
                sb.Append("        </RunSynchronousCommand>\r\n      </RunSynchronous>\r\n    </component>\r\n");
            }
            sb.Append("  </settings>\r\n");

            sb.Append("  <settings pass=\"oobeSystem\">\r\n");
            sb.Append("    <component name=\"Microsoft-Windows-International-Core\"").Append(CP).Append(">\r\n");
            sb.Append("      <InputLocale>0409:00000409</InputLocale>\r\n");
            sb.Append("      <UserLocale>").Append(vung).Append("</UserLocale>\r\n");
            sb.Append("    </component>\r\n");
            sb.Append("    <component name=\"Microsoft-Windows-Shell-Setup\"").Append(CP).Append(">\r\n");
            sb.Append("      <OOBE>\r\n        <HideEULAPage>true</HideEULAPage>\r\n        <HideOEMRegistrationScreen>true</HideOEMRegistrationScreen>\r\n");
            sb.Append("        <HideLocalAccountScreen>true</HideLocalAccountScreen>\r\n");
            if (hopTaiKhoanCucBo.Checked) sb.Append("        <HideOnlineAccountScreens>true</HideOnlineAccountScreens>\r\n");
            if (hopAnWifi.Checked) sb.Append("        <HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>\r\n");
            sb.Append("        <ProtectYourPC>3</ProtectYourPC>\r\n      </OOBE>\r\n");
            sb.Append("      <UserAccounts>\r\n        <LocalAccounts>\r\n          <LocalAccount wcm:action=\"add\">\r\n");
            sb.Append("            <Name>").Append(X(user)).Append("</Name>\r\n");
            sb.Append("            <DisplayName>").Append(X(user)).Append("</DisplayName>\r\n");
            sb.Append("            <Group>Administrators</Group>\r\n");
            sb.Append("            <Password>\r\n              <Value>").Append(X(oMk.Text)).Append("</Value>\r\n              <PlainText>true</PlainText>\r\n            </Password>\r\n");
            sb.Append("          </LocalAccount>\r\n        </LocalAccounts>\r\n      </UserAccounts>\r\n");
            sb.Append("      <TimeZone>").Append(tz).Append("</TimeZone>\r\n");
            sb.Append("    </component>\r\n  </settings>\r\n");
            sb.Append("</unattend>\r\n");
            return sb.ToString();
        }

        void LuuUnattend()
        {
            using (var d = new SaveFileDialog { Filter = "autounattend.xml|autounattend.xml|Tệp XML (*.xml)|*.xml", FileName = "autounattend.xml" })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                File.WriteAllText(d.FileName, TaoUnattend(), new UTF8Encoding(false));
                NhatKy.Chung.Tot("Đã lưu: " + d.FileName + " — chép vào thư mục gốc của USB cài Win.");
            }
        }
    }
}
