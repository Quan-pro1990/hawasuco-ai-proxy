using System;
using System.Collections.Generic;
using System.IO;
using System.Management;
using System.Text;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Bản quyền - Gỡ crack: trạng thái kích hoạt Windows / Office, nhập key, gỡ dấu vết crack KMS.</summary>
    public class TrangBanQuyen : TrangCuon
    {
        readonly DataGridView luoiBq, luoiCrack;
        readonly DoanVan ghiChuKms, ketQuaQuet;

        public TrangBanQuyen()
        {
            TheBo bq = TheBo.TuCao();
            Ui.ThemDuoi(bq, new TieuDe("Trạng thái bản quyền Windows & Office", Ic.Quyen, Tone.Vang));
            ghiChuKms = new DoanVan("Đang đọc trạng thái kích hoạt...");
            Ui.ThemDuoi(bq, ghiChuKms);
            luoiBq = Ui.TaoLuoi(false, "Sản phẩm", "Kênh", "Key", "Trạng thái", "Máy chủ KMS");
            luoiBq.Columns[0].FillWeight = 190;
            luoiBq.Columns[2].FillWeight = 50;
            luoiBq.Height = Ui.S(170);
            Ui.ThemDuoi(bq, luoiBq);
            Ui.ThemDuoi(bq, Ui.Khoang(8));
            Ui.ThemDuoi(bq, Ui.Luoi(4,
                Nut("Làm mới", Ic.LamMoi, Tone.Xanh, Nap),
                Nut("Nhập key Windows...", Ic.Khoa, Tone.Vang, NhapKeyWindows),
                Nut("Kích hoạt Windows online", Ic.Mang, Tone.XanhLa, () => TacVu.Chay("Kích hoạt Windows", log => Slmgr(log, "/ato"), Nap)),
                Nut("Chi tiết bản quyền Windows", Ic.ThongTin, Tone.Xam, () => TacVu.Chay("Chi tiết bản quyền Windows", log => Slmgr(log, "/dlv"))),
                Nut("Nhập key Office...", Ic.VanBan, Tone.Cam, NhapKeyOffice),
                Nut("Trạng thái Office (ospp)", Ic.ThongTin, Tone.Xam, () => TacVu.Chay("Trạng thái Office", log => Ospp(log, "/dstatus"))),
                Nut("Cài đặt > Kích hoạt", Ic.CaiDat, Tone.Xam, () => HeThong.Mo("ms-settings:activation")),
                Nut("Gỡ key Windows hiện tại", Ic.Xoa, Tone.Do, () =>
                {
                    if (Ui.HoiCanhBao(CuaSo, "Gỡ product key đang cài trong Windows (slmgr /upk + /cpky)?\nWindows sẽ chưa kích hoạt cho đến khi nhập key mới."))
                        TacVu.Chay("Gỡ key Windows", log => { Slmgr(log, "/upk"); Slmgr(log, "/cpky"); }, Nap);
                })));
            Them(bq);

            TheBo cr = TheBo.TuCao();
            Ui.ThemDuoi(cr, new TieuDe("Gỡ crack / dấu vết KMS lậu", Ic.Khien, Tone.Do));
            Ui.ThemDuoi(cr, new DoanVan("Quét các dấu vết công cụ crack bản quyền thường gặp (KMSpico, KMSAuto, AAct, KMS_VL_ALL...): tác vụ hẹn giờ, dịch vụ, " +
                "thư mục, hook SppExtComObj, loại trừ trong Windows Defender, máy chủ KMS lạ. Các công cụ này hay kèm mã độc. " +
                "Sau khi gỡ, Windows / Office sẽ chưa kích hoạt — nhập key bản quyền hợp lệ ở thẻ trên."));
            ketQuaQuet = new DoanVan("Bấm \"Quét dấu vết crack\" để bắt đầu.", Ui.ChuPhu, Ui.Base);
            Ui.ThemDuoi(cr, ketQuaQuet);
            luoiCrack = Ui.TaoLuoi(true, "Loại", "Đối tượng", "Chi tiết");
            luoiCrack.Columns[1].FillWeight = 60;
            luoiCrack.Columns[2].FillWeight = 140;
            luoiCrack.Columns[3].FillWeight = 200;
            luoiCrack.Height = Ui.S(190);
            Ui.ThemDuoi(cr, luoiCrack);
            Ui.ThemDuoi(cr, Ui.Khoang(8));
            Ui.ThemDuoi(cr, Ui.Luoi(4,
                Nut("Quét dấu vết crack", Ic.TimKiem, Tone.Xanh, Quet),
                Nut("Gỡ các mục đã tích", Ic.Xoa, Tone.Do, Go),
                Nut("Cài lại tệp bản quyền (slmgr /rilc)", Ic.KhoiPhuc, Tone.Xam, () => TacVu.Chay("Cài lại tệp bản quyền", log => Slmgr(log, "/rilc"))),
                null));
            Them(cr);
        }

        static NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        protected override void KhiHienLanDau() { Nap(); }

        static int Slmgr(NhatKy log, string thamSo)
        {
            return HeThong.Chay(log, HeThong.Exe("cscript.exe"), "//nologo " + HeThong.Nhay(Path.Combine(HeThong.Sys32, "slmgr.vbs")) + " " + thamSo);
        }

        static string TimOspp()
        {
            foreach (Environment.SpecialFolder f in new[] { Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86 })
            {
                foreach (string ban in new[] { "Office16", "Office15" })
                {
                    string p = Path.Combine(Environment.GetFolderPath(f), @"Microsoft Office\" + ban + @"\OSPP.VBS");
                    if (File.Exists(p)) return p;
                }
            }
            return null;
        }

        static int Ospp(NhatKy log, string thamSo)
        {
            string p = TimOspp();
            if (p == null) throw new LoiTacVu("Không tìm thấy OSPP.VBS (máy chưa cài Office 2013 trở lên?).");
            return HeThong.Chay(log, HeThong.Exe("cscript.exe"), "//nologo " + HeThong.Nhay(p) + " " + thamSo);
        }

        class SanPham
        {
            public string Ten, Kenh, Key, TrangThai, Kms;
            public bool DaKichHoat;
        }

        static string TenTrangThai(long ma, long phutConLai)
        {
            string conLai = phutConLai > 0 ? " (còn " + (phutConLai / 1440) + " ngày)" : "";
            switch (ma)
            {
                case 0: return "Chưa kích hoạt";
                case 1: return "Đã kích hoạt" + conLai;
                case 2: return "Gia hạn dùng thử" + conLai;
                case 3: return "Gia hạn (đổi phần cứng)" + conLai;
                case 4: return "Không chính hãng" + conLai;
                case 5: return "Thông báo (hết hạn)";
                case 6: return "Gia hạn thêm" + conLai;
                default: return ma.ToString();
            }
        }

        void Nap()
        {
            ghiChuKms.Text = "Đang đọc trạng thái kích hoạt (mất vài giây)...";
            TacVu.Nen(this, () =>
            {
                var ds = new List<SanPham>();
                string kmsChung = "";
                foreach (ManagementObject o in HeThong.Wmi("SELECT KeyManagementServiceMachine FROM SoftwareLicensingService"))
                    kmsChung = HeThong.S(o, "KeyManagementServiceMachine");
                foreach (ManagementObject o in HeThong.Wmi("SELECT Name, Description, LicenseStatus, PartialProductKey, ProductKeyChannel, GracePeriodRemaining, " +
                                                           "KeyManagementServiceMachine FROM SoftwareLicensingProduct WHERE PartialProductKey IS NOT NULL"))
                {
                    long tt = HeThong.L(o, "LicenseStatus");
                    string kms = HeThong.S(o, "KeyManagementServiceMachine");
                    ds.Add(new SanPham
                    {
                        Ten = HeThong.S(o, "Name"),
                        Kenh = HeThong.S(o, "ProductKeyChannel"),
                        Key = "*****-" + HeThong.S(o, "PartialProductKey"),
                        TrangThai = TenTrangThai(tt, HeThong.L(o, "GracePeriodRemaining")),
                        Kms = kms.Length > 0 ? kms : kmsChung,
                        DaKichHoat = tt == 1
                    });
                }
                return ds;
            }, ds =>
            {
                luoiBq.Rows.Clear();
                bool coKms = false;
                foreach (SanPham s in ds)
                {
                    int r = luoiBq.Rows.Add(s.Ten, s.Kenh, s.Key, s.TrangThai, s.Kms);
                    luoiBq.Rows[r].Cells[3].Style.ForeColor = s.DaKichHoat ? Ui.Tot : Ui.Loi;
                    if (s.Kms.Length > 0)
                    {
                        coKms = true;
                        luoiBq.Rows[r].Cells[4].Style.ForeColor = Ui.CanhChu;
                    }
                }
                ghiChuKms.Text = ds.Count == 0
                    ? "Không đọc được thông tin bản quyền."
                    : coKms
                        ? "Có sản phẩm đang kích hoạt qua máy chủ KMS. Nếu đó không phải máy chủ KMS của cơ quan bạn, nhiều khả năng máy đang dùng crack — quét và gỡ ở thẻ dưới."
                        : "Bản quyền thật: kênh Retail / OEM (key mua lẻ, key theo máy) hoặc Volume:MAK của tổ chức. Volume:GVLK + máy chủ KMS lạ thường là crack.";
                ghiChuKms.ForeColor = coKms ? Ui.CanhChu : Ui.ChuPhu;
            });
        }

        void NhapKeyWindows()
        {
            string[] kq = FormNhap.Hien(CuaSo, "Nhập product key Windows", "Key 25 ký tự dạng XXXXX-XXXXX-XXXXX-XXXXX-XXXXX. Sau khi cài key sẽ kích hoạt online (cần Internet).",
                "Cài key & kích hoạt", TruongNhap.Chu("Product key", "", true));
            if (kq == null) return;
            string key = kq[0].Trim().ToUpperInvariant();
            if (key.Length != 29)
            {
                Ui.BaoLoi(CuaSo, "Key không đúng định dạng XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.");
                return;
            }
            TacVu.Chay("Cài key Windows", log =>
            {
                Slmgr(log, "/ipk " + key);
                Slmgr(log, "/ato");
            }, Nap);
        }

        void NhapKeyOffice()
        {
            string[] kq = FormNhap.Hien(CuaSo, "Nhập product key Office", "Dùng cho Office bản Volume (LTSC / 2019 / 2021 / 2024) có key MAK. Office 365 / Home & Business: đăng nhập tài khoản Microsoft đã mua trong Word / Excel.",
                "Cài key & kích hoạt", TruongNhap.Chu("Product key", "", true));
            if (kq == null) return;
            string key = kq[0].Trim().ToUpperInvariant();
            TacVu.Chay("Cài key Office", log =>
            {
                Ospp(log, "/inpkey:" + key);
                Ospp(log, "/act");
            }, Nap);
        }

        // ---------------- quét / gỡ crack ----------------

        const string SCRIPT_QUET = @"
$re = '(?i)(kmspico|kmsauto|autokms|autopico|kmseldi|kms_vl_all|kms-vl-all|sppextcomobj|aact|online_kms|kms38|activation-renewal|activation-run_once|secoh-qad|kmsspi)'
$reTen = '(?i)(kms|' + $re.Substring(5)
Get-ScheduledTask -ErrorAction SilentlyContinue | ForEach-Object {
  $a = ($_.Actions | ForEach-Object { ([string]$_.Execute + ' ' + [string]$_.Arguments).Trim() }) -join ' ; '
  if ($_.TaskName -match $reTen -or $a -match $re) { Write-Output ('TASK|' + $_.TaskPath + $_.TaskName + '|' + $a) }
}
Get-CimInstance Win32_Service | Where-Object { $_.Name -ne 'sppsvc' -and ($_.Name -match $reTen -or $_.DisplayName -match $re -or $_.PathName -match $re) } | ForEach-Object {
  Write-Output ('SERVICE|' + $_.Name + '|' + $_.PathName)
}
$pf86 = [Environment]::GetFolderPath('ProgramFilesX86')
$cho = @(""$env:ProgramFiles\KMSpico"", ""$pf86\KMSpico"", ""$env:ProgramData\KMSAutoS"", ""$env:ProgramData\KMSAuto"", ""$env:windir\KMSAutoS"",
  ""$env:ProgramFiles\KMSAuto"", ""$env:ProgramData\KMSAutoS-backup"", ""$env:windir\AAct_Tools"", ""$env:ProgramData\Online_KMS_Activation"",
  ""$env:windir\System32\SppExtComObjHook.dll"", ""$env:windir\System32\SppExtComObjPatcher.exe"", ""$env:windir\SECOH-QAD.exe"", ""$env:windir\SECOH-QAD.dll"",
  ""$env:windir\System32\SECOH-QAD.exe"", ""$env:windir\System32\SECOH-QAD.dll"", ""$env:windir\Setup\Scripts\Activation"")
foreach ($p in $cho) { if ($p -and (Test-Path -LiteralPath $p)) { Write-Output ('PATH|' + $p + '|') } }
foreach ($exe in 'SppExtComObj.exe','osppsvc.exe','sppsvc.exe') {
  $k = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\' + $exe
  if (Test-Path $k) {
    $v = Get-ItemProperty $k
    if ($v.Debugger -or $v.VerifierDlls -or $v.GlobalFlag) { Write-Output ('IFEO|' + $k + '|Debugger=' + $v.Debugger + ' VerifierDlls=' + $v.VerifierDlls) }
  }
}
try {
  $mp = Get-MpPreference -ErrorAction Stop
  foreach ($x in @($mp.ExclusionPath)) { if ($x -and $x -match $reTen) { Write-Output ('DEFPATH|' + $x + '|Loại trừ thư mục trong Defender') } }
  foreach ($x in @($mp.ExclusionProcess)) { if ($x -and $x -match $reTen) { Write-Output ('DEFPROC|' + $x + '|Loại trừ tiến trình trong Defender') } }
} catch {}
$s = Get-CimInstance SoftwareLicensingService
if ($s.KeyManagementServiceMachine) { Write-Output ('KMSHOST|' + $s.KeyManagementServiceMachine + '|Máy chủ KMS đặt cho toàn máy') }
Get-CimInstance SoftwareLicensingProduct -Filter 'PartialProductKey IS NOT NULL' | Where-Object { $_.KeyManagementServiceMachine } | ForEach-Object {
  Write-Output ('KMSPROD|' + $_.ID + '|' + $_.Name + ' -> ' + $_.KeyManagementServiceMachine)
}
";

        static string TenLoai(string ma)
        {
            switch (ma)
            {
                case "TASK": return "Tác vụ hẹn giờ";
                case "SERVICE": return "Dịch vụ";
                case "PATH": return "Thư mục / tệp";
                case "IFEO": return "Hook hệ thống";
                case "DEFPATH":
                case "DEFPROC": return "Loại trừ Defender";
                case "KMSHOST":
                case "KMSPROD": return "Máy chủ KMS";
                default: return ma;
            }
        }

        void Quet()
        {
            ketQuaQuet.Text = "Đang quét...";
            luoiCrack.Rows.Clear();
            TacVu.Nen(this, () => HeThong.KetQuaPS(SCRIPT_QUET, 180000), kq =>
            {
                luoiCrack.Rows.Clear();
                foreach (string dong in kq.Split('\n'))
                {
                    string[] p = dong.Trim().Split(new[] { '|' }, 3);
                    if (p.Length < 3) continue;
                    int r = luoiCrack.Rows.Add(true, TenLoai(p[0]), p[1], p[2]);
                    luoiCrack.Rows[r].Tag = p;
                }
                int n = luoiCrack.Rows.Count;
                ketQuaQuet.Text = n == 0 ? "Không thấy dấu vết crack nào." : "Tìm thấy " + n + " mục nghi là crack. Bỏ tích mục nào bạn chắc chắn là hợp lệ rồi bấm \"Gỡ các mục đã tích\".";
                ketQuaQuet.ForeColor = n == 0 ? Ui.Tot : Ui.Loi;
                NhatKy.Chung.Ghi("Quét crack: " + n + " mục.");
            });
        }

        void Go()
        {
            var chon = new List<string[]>();
            foreach (DataGridViewRow r in luoiCrack.Rows)
                if (r.Cells[0].Value is bool && (bool)r.Cells[0].Value) chon.Add((string[])r.Tag);
            if (chon.Count == 0)
            {
                Ui.BaoTin(CuaSo, "Chưa có mục nào được tích (bấm Quét trước).");
                return;
            }
            if (!Ui.HoiCanhBao(CuaSo, "Gỡ " + chon.Count + " mục đã tích? Windows / Office đang kích hoạt bằng crack sẽ trở về chưa kích hoạt.")) return;
            var sb = new StringBuilder();
            foreach (string[] p in chon)
            {
                string doiTuong = HeThong.Ps(p[1]);
                switch (p[0])
                {
                    case "TASK":
                        sb.Append("$t = " + doiTuong + "; $i = $t.LastIndexOf('\\'); Unregister-ScheduledTask -TaskPath $t.Substring(0, $i + 1) -TaskName $t.Substring($i + 1) -Confirm:$false -ErrorAction Continue; Write-Output ('Đã xóa tác vụ ' + $t)\r\n");
                        break;
                    case "SERVICE":
                        sb.Append("Stop-Service -Name " + doiTuong + " -Force -ErrorAction SilentlyContinue; sc.exe delete " + doiTuong + " | Out-Null; Write-Output ('Đã xóa dịch vụ ' + " + doiTuong + ")\r\n");
                        break;
                    case "PATH":
                        sb.Append("Remove-Item -LiteralPath " + doiTuong + " -Recurse -Force -ErrorAction Continue; Write-Output ('Đã xóa ' + " + doiTuong + ")\r\n");
                        break;
                    case "IFEO":
                        sb.Append("Remove-Item -Path " + doiTuong + " -Recurse -Force -ErrorAction Continue; Write-Output ('Đã gỡ hook ' + " + doiTuong + ")\r\n");
                        break;
                    case "DEFPATH":
                        sb.Append("Remove-MpPreference -ExclusionPath " + doiTuong + " -ErrorAction Continue; Write-Output ('Đã bỏ loại trừ ' + " + doiTuong + ")\r\n");
                        break;
                    case "DEFPROC":
                        sb.Append("Remove-MpPreference -ExclusionProcess " + doiTuong + " -ErrorAction Continue; Write-Output ('Đã bỏ loại trừ ' + " + doiTuong + ")\r\n");
                        break;
                    case "KMSHOST":
                        sb.Append("Get-CimInstance SoftwareLicensingService | Invoke-CimMethod -MethodName ClearKeyManagementServiceMachine | Out-Null; Write-Output 'Đã xóa máy chủ KMS chung'\r\n");
                        break;
                    case "KMSPROD":
                        sb.Append("Get-CimInstance SoftwareLicensingProduct -Filter (\"ID = '\" + " + doiTuong + " + \"'\") | Invoke-CimMethod -MethodName ClearKeyManagementServiceMachine | Out-Null; Write-Output 'Đã xóa máy chủ KMS của sản phẩm'\r\n");
                        break;
                }
            }
            string script = sb.ToString();
            TacVu.Chay("Gỡ dấu vết crack", log => HeThong.ChayPS(log, script), () =>
            {
                Quet();
                Nap();
            });
        }
    }
}
