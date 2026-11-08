using System;
using System.Collections.Generic;
using System.IO;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Sao lưu - Phục hồi: điểm khôi phục, dữ liệu người dùng, Wi-Fi.</summary>
    public class TrangSaoLuu : TrangCuon
    {
        readonly ComboBox chonUser;
        readonly TextBox oDich;
        readonly List<CheckBox> hopThuMuc = new List<CheckBox>();

        static readonly string[,] THU_MUC =
        {
            { "Desktop", "Desktop" }, { "Documents", "Documents" }, { "Downloads", "Downloads" }, { "Pictures", "Pictures" },
            { "Videos", "Videos" }, { "Music", "Music" }, { "Favorites", "Favorites" }, { "OneDrive", "OneDrive" },
            { "Chrome (dữ liệu trình duyệt)", @"AppData\Local\Google\Chrome\User Data" },
            { "Edge (dữ liệu trình duyệt)", @"AppData\Local\Microsoft\Edge\User Data" },
            { "Cốc Cốc (dữ liệu trình duyệt)", @"AppData\Local\CocCoc\Browser\User Data" },
            { "Firefox (dữ liệu trình duyệt)", @"AppData\Roaming\Mozilla\Firefox" },
            { "Zalo PC (tin nhắn, tệp)", @"AppData\Local\ZaloPC" },
            { "Outlook (tệp .pst / .ost)", @"AppData\Local\Microsoft\Outlook" },
            { "Chữ ký số / chứng thư (Tokens)", @"AppData\Roaming\Microsoft\SystemCertificates" },
            { "Sticky Notes", @"AppData\Local\Packages\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe" }
        };

        public TrangSaoLuu()
        {
            Them(Nhom("Điểm khôi phục hệ thống (System Restore)", Ic.KhoiPhuc, Tone.XanhLa,
                "Tạo điểm khôi phục trước khi cài driver / phần mềm lạ / sửa registry — lỡ hỏng thì quay lại được.",
                Nut("Tạo điểm khôi phục ngay", Ic.Them, Tone.XanhLa, () => TaoDiemKhoiPhuc()),
                Nut("Mở System Restore", Ic.KhoiPhuc, Tone.Xanh, () => HeThong.Mo(HeThong.Exe("rstrui.exe"))),
                Nut("Xem các điểm khôi phục", Ic.Hen, Tone.Xam, () => TacVu.Chay("Danh sách điểm khôi phục", log => HeThong.ChayPS(log,
                    "$d = Get-ComputerRestorePoint -ErrorAction SilentlyContinue\r\nif (-not $d) { Write-Output 'Chưa có điểm khôi phục nào.' }\r\n" +
                    "else { $d | Select-Object SequenceNumber, @{n='Thời gian';e={$_.ConvertToDateTime($_.CreationTime).ToString('dd/MM/yyyy HH:mm')}}, Description | Format-Table -AutoSize | Out-String -Width 200 }"))),
                Nut("Cấu hình System Protection", Ic.CaiDat, Tone.Xam, () => HeThong.Mo(HeThong.Exe("SystemPropertiesProtection.exe")))));

            // ---- dữ liệu người dùng ----
            TheBo dl = TheBo.TuCao();
            Ui.ThemDuoi(dl, new TieuDe("Sao lưu / phục hồi dữ liệu người dùng", Ic.ThuMuc, Tone.Xanh));
            Ui.ThemDuoi(dl, new DoanVan("Chép dữ liệu của 1 tài khoản sang ổ khác / USB trước khi cài lại Windows, rồi chép ngược lại sau khi cài. " +
                "Đóng trình duyệt, Zalo, Outlook trước khi sao lưu. Mật khẩu đã lưu trong trình duyệt gắn với Windows cũ — nên bật đồng bộ tài khoản trình duyệt."));
            TableLayoutPanel bang = Ui.BangNhap();
            chonUser = Ui.HopChon();
            foreach (string u in NguoiDungMay()) chonUser.Items.Add(u);
            int i = chonUser.Items.IndexOf(Environment.UserName);
            chonUser.SelectedIndex = i >= 0 ? i : (chonUser.Items.Count > 0 ? 0 : -1);
            oDich = Ui.O("Thư mục chứa bản sao lưu");
            oDich.Text = Directory.Exists(@"D:\") ? @"D:\SaoLuu" : "";
            var duyet = NutBo.Phu("Chọn...", Ic.ThuMuc);
            duyet.AutoSize = true;
            duyet.Margin = Ui.Pad(6, 2, 0, 2);
            duyet.Click += (s, e) =>
            {
                string d = Ui.ChonThuMuc(CuaSo, "Thư mục chứa bản sao lưu (nên ở ổ khác ổ C / USB):", oDich.Text);
                if (d != null) oDich.Text = d;
            };
            Ui.DongNhap(bang, "Tài khoản", chonUser);
            Ui.DongNhap(bang, "Thư mục sao lưu", Ui.HangNgang(oDich, duyet));
            Ui.ThemDuoi(dl, bang);
            Ui.ThemDuoi(dl, Ui.Khoang(4));
            var hop = new Control[THU_MUC.GetLength(0)];
            for (int k = 0; k < hop.Length; k++)
            {
                CheckBox c = Ui.Hop(THU_MUC[k, 0], k < 7);
                c.Tag = THU_MUC[k, 1];
                hopThuMuc.Add(c);
                hop[k] = c;
            }
            Ui.ThemDuoi(dl, Ui.Luoi(4, hop));
            Ui.ThemDuoi(dl, Ui.Khoang(8));
            Ui.ThemDuoi(dl, Ui.Luoi(4,
                Nut("Sao lưu", Ic.Luu, Tone.Xanh, () => ChepDuLieu(true)),
                Nut("Phục hồi", Ic.KhoiPhuc, Tone.XanhLa, () => ChepDuLieu(false)),
                Nut("Mở thư mục sao lưu", Ic.ThuMuc, Tone.Xam, () => { if (Directory.Exists(oDich.Text)) HeThong.Mo(oDich.Text); }),
                null));
            Them(dl);

            Them(Nhom("Wi-Fi đã lưu", Ic.Wifi, Tone.Tim,
                "Sao lưu tất cả mạng Wi-Fi (kèm mật khẩu) ra thư mục sao lưu ở trên; sau khi cài Win bấm Phục hồi để máy tự kết nối lại. " +
                "Tệp sao lưu chứa mật khẩu Wi-Fi dạng chữ — cất giữ cẩn thận.",
                Nut("Sao lưu Wi-Fi", Ic.Luu, Tone.Tim, SaoLuuWifi),
                Nut("Phục hồi Wi-Fi", Ic.KhoiPhuc, Tone.Tim, PhucHoiWifi),
                Nut("Xem mật khẩu Wi-Fi đã lưu", Ic.Khoa, Tone.Xam, () => TacVu.Chay("Mật khẩu Wi-Fi đã lưu", log => HeThong.ChayPS(log, @"
$ds = (netsh wlan show profiles) | Select-String ':\s*(.+)$' | ForEach-Object { $_.Matches[0].Groups[1].Value.Trim() }
foreach ($t in $ds) {
  $k = (netsh wlan show profile name=""$t"" key=clear) | Select-String 'Key Content|Nội dung khóa' | ForEach-Object { ($_ -split ':', 2)[1].Trim() }
  if ($k) { Write-Output ($t + '  :  ' + $k) }
}"))),
                null));
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

        static string ThuMucUsers
        {
            get { return Path.GetDirectoryName(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)); }
        }

        static List<string> NguoiDungMay()
        {
            var ds = new List<string>();
            try
            {
                foreach (string d in Directory.GetDirectories(ThuMucUsers))
                {
                    string ten = Path.GetFileName(d);
                    if ((File.GetAttributes(d) & FileAttributes.ReparsePoint) != 0) continue;
                    if (ten.Equals("Public", StringComparison.OrdinalIgnoreCase) || ten.StartsWith("Default", StringComparison.OrdinalIgnoreCase) ||
                        ten.Equals("All Users", StringComparison.OrdinalIgnoreCase)) continue;
                    ds.Add(ten);
                }
            }
            catch (Exception) { }
            return ds;
        }

        /// <summary>Tạo điểm khôi phục (tự bật System Protection ổ C và bỏ giới hạn 24 giờ / 1 điểm).</summary>
        public static void TaoDiemKhoiPhuc()
        {
            TacVu.Chay("Tạo điểm khôi phục", log =>
            {
                HeThong.DatDword(log, @"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore", "SystemRestorePointCreationFrequency", 0);
                int ma = HeThong.ChayPS(log,
                    "$o = $env:SystemDrive + '\\'\r\n" +
                    "Enable-ComputerRestore -Drive $o -ErrorAction SilentlyContinue\r\n" +
                    "Checkpoint-Computer -Description ('IT Toolkit ' + (Get-Date -Format 'dd/MM/yyyy HH:mm')) -RestorePointType MODIFY_SETTINGS -ErrorAction Stop\r\n" +
                    "Write-Output 'Đã tạo điểm khôi phục.'");
                if (ma != 0) throw new LoiTacVu("Không tạo được điểm khôi phục (System Protection có thể đang bị tắt bởi chính sách).");
            });
        }

        void ChepDuLieu(bool saoLuu)
        {
            string user = chonUser.SelectedItem as string, goc = oDich.Text.Trim();
            if (string.IsNullOrEmpty(user) || goc.Length == 0)
            {
                Ui.BaoTin(CuaSo, "Chọn tài khoản và thư mục sao lưu.");
                return;
            }
            string hoSo = Path.Combine(ThuMucUsers, user);
            string kho = Path.Combine(goc, user);
            if (!saoLuu && !Directory.Exists(kho))
            {
                Ui.BaoTin(CuaSo, "Không thấy bản sao lưu: " + kho);
                return;
            }
            var chon = new List<string[]>();
            foreach (CheckBox c in hopThuMuc) if (c.Checked) chon.Add(new[] { c.Text, (string)c.Tag });
            if (chon.Count == 0) return;
            if (!saoLuu && !Ui.Hoi(CuaSo, "Chép dữ liệu từ " + kho + " vào " + hoSo + "?\nTệp trùng tên sẽ bị ghi đè bằng bản sao lưu.")) return;
            TacVu.Chay((saoLuu ? "Sao lưu" : "Phục hồi") + " dữ liệu " + user, log =>
            {
                foreach (string[] m in chon)
                {
                    string tu = saoLuu ? Path.Combine(hoSo, m[1]) : Path.Combine(kho, m[1]);
                    string den = saoLuu ? Path.Combine(kho, m[1]) : Path.Combine(hoSo, m[1]);
                    if (!Directory.Exists(tu))
                    {
                        log.Ghi("Bỏ qua (không có): " + m[0]);
                        continue;
                    }
                    log.TieuDe(m[0]);
                    int ma = HeThong.Chay(log, HeThong.Exe("robocopy.exe"),
                        HeThong.Nhay(tu) + " " + HeThong.Nhay(den) + " /E /R:1 /W:1 /XJ /MT:16 /NP /NFL /NDL /XF desktop.ini");
                    if (ma >= 8) log.Loi("robocopy báo lỗi " + ma + " khi chép " + m[0]);
                }
                log.Tot("Thư mục " + (saoLuu ? "sao lưu: " + kho : "đích: " + hoSo));
            });
        }

        string ThuMucWifi()
        {
            string goc = oDich.Text.Trim();
            if (goc.Length == 0)
            {
                Ui.BaoTin(CuaSo, "Chọn thư mục sao lưu ở thẻ trên trước.");
                return null;
            }
            return Path.Combine(goc, "WiFi");
        }

        void SaoLuuWifi()
        {
            string d = ThuMucWifi();
            if (d == null) return;
            TacVu.Chay("Sao lưu Wi-Fi", log =>
            {
                Directory.CreateDirectory(d);
                HeThong.Chay(log, HeThong.Exe("netsh.exe"), "wlan export profile key=clear folder=" + HeThong.Nhay(d));
                log.Tot("Đã lưu vào: " + d);
            });
        }

        void PhucHoiWifi()
        {
            string d = ThuMucWifi();
            if (d == null) return;
            if (!Directory.Exists(d))
            {
                Ui.BaoTin(CuaSo, "Không thấy thư mục " + d);
                return;
            }
            TacVu.Chay("Phục hồi Wi-Fi", log =>
            {
                foreach (string f in Directory.GetFiles(d, "*.xml"))
                    HeThong.Chay(log, HeThong.Exe("netsh.exe"), "wlan add profile filename=" + HeThong.Nhay(f) + " user=all");
            });
        }
    }
}
