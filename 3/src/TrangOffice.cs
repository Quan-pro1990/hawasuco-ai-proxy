using System;
using System.Collections.Generic;
using System.IO;
using System.Security;
using System.Text;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Cài đặt Office: tạo cấu hình Office Deployment Tool (ODT) của Microsoft, tải và cài bản chính hãng.</summary>
    public class TrangOffice : TrangCuon
    {
        // Tên hiển thị | Product ID | Channel
        static readonly string[,] BAN =
        {
            { "Microsoft 365 Apps for business", "O365BusinessRetail", "Current" },
            { "Microsoft 365 Apps for enterprise", "O365ProPlusRetail", "Current" },
            { "Office LTSC Professional Plus 2024 (Volume)", "ProPlus2024Volume", "PerpetualVL2024" },
            { "Office LTSC Standard 2024 (Volume)", "Standard2024Volume", "PerpetualVL2024" },
            { "Office Home 2024 (Retail)", "Home2024Retail", "Current" },
            { "Office Home & Business 2024 (Retail)", "HomeBusiness2024Retail", "Current" },
            { "Office LTSC Professional Plus 2021 (Volume)", "ProPlus2021Volume", "PerpetualVL2021" },
            { "Office Professional Plus 2019 (Volume)", "ProPlus2019Volume", "PerpetualVL2019" }
        };

        // Tên ứng dụng | ID trong ExcludeApp | mặc định cài
        static readonly string[,] APP =
        {
            { "Word", "Word", "1" }, { "Excel", "Excel", "1" }, { "PowerPoint", "PowerPoint", "1" }, { "Outlook", "Outlook", "1" },
            { "OneNote", "OneNote", "0" }, { "Access", "Access", "0" }, { "Publisher", "Publisher", "0" }, { "Teams", "Teams", "0" },
            { "OneDrive", "OneDrive", "0" }, { "Skype for Business", "Lync", "0" }
        };

        const string URL_ODT = "https://officecdn.microsoft.com/pr/wsus/setup.exe";

        readonly ComboBox chonBan;
        readonly RadioButton r64, r32;
        readonly CheckBox hopVi, hopEn, hopGoMsi, hopCapNhat;
        readonly List<CheckBox> hopApp = new List<CheckBox>();

        public TrangOffice()
        {
            TheBo cfg = TheBo.TuCao();
            Ui.ThemDuoi(cfg, new TieuDe("Cài Office chính hãng bằng Office Deployment Tool", Ic.VanBan, Tone.Cam));
            Ui.ThemDuoi(cfg, new DoanVan("Tải trực tiếp từ máy chủ Microsoft (officecdn.microsoft.com), chọn đúng ứng dụng cần dùng. " +
                "Bản Microsoft 365 / Home cần đăng nhập tài khoản đã mua; bản Volume (LTSC) cần key MAK / KMS hợp lệ của tổ chức — nhập key ở trang Bản quyền."));
            TableLayoutPanel bang = Ui.BangNhap();
            chonBan = Ui.HopChon();
            for (int i = 0; i < BAN.GetLength(0); i++) chonBan.Items.Add(BAN[i, 0]);
            chonBan.SelectedIndex = 2;
            Ui.DongNhap(bang, "Phiên bản", chonBan);
            r64 = Ui.Chon1("64-bit (khuyên dùng)", true);
            r32 = Ui.Chon1("32-bit (máy RAM ≤ 4 GB, add-in cũ)", false);
            Ui.DongNhap(bang, "Kiến trúc", Ui.Dong(r64, r32));
            hopVi = Ui.Hop("Tiếng Việt", false);
            hopEn = Ui.Hop("English", true);
            Ui.DongNhap(bang, "Ngôn ngữ", Ui.Dong(hopEn, hopVi));
            Ui.ThemDuoi(cfg, bang);
            Ui.ThemDuoi(cfg, Ui.Khoang(4));
            Ui.ThemDuoi(cfg, Ui.Nhan("Ứng dụng cài đặt:", Ui.Dam, Ui.Chu));
            var app = new Control[APP.GetLength(0)];
            for (int i = 0; i < app.Length; i++)
            {
                CheckBox c = Ui.Hop(APP[i, 0], APP[i, 2] == "1");
                c.Tag = APP[i, 1];
                hopApp.Add(c);
                app[i] = c;
            }
            Ui.ThemDuoi(cfg, Ui.Luoi(5, app));
            hopGoMsi = Ui.Hop("Gỡ Office bản cũ (MSI: 2010 / 2013 / 2016) trước khi cài", true);
            hopCapNhat = Ui.Hop("Tự động cập nhật", true);
            Ui.ThemDuoi(cfg, Ui.Dong(hopGoMsi, hopCapNhat));
            Ui.ThemDuoi(cfg, Ui.Khoang(8));
            Ui.ThemDuoi(cfg, Ui.Luoi(4,
                Nut("Tải & cài đặt ngay", Ic.TaiVe, Tone.Cam, true, CaiNgay),
                Nut("Chỉ tải bộ cài (offline)...", Ic.Luu, Tone.Xanh, false, TaiOffline),
                Nut("Cài từ bộ cài offline...", Ic.TaiLen, Tone.Xanh, false, CaiOffline),
                Nut("Xem file cấu hình", Ic.TaiLieu, Tone.Xam, false, () => FormXem.Hien(CuaSo, "configuration.xml", TaoCauHinh(null, false), "Tệp XML (*.xml)|*.xml"))));
            Them(cfg);

            TheBo go = TheBo.TuCao();
            Ui.ThemDuoi(go, new TieuDe("Gỡ Office", Ic.Xoa, Tone.Do));
            Ui.ThemDuoi(go, new DoanVan("Gỡ sạch mọi bản Office Click-to-Run (365, 2016–2024) bằng ODT. Bản MSI cũ được gỡ khi cài mới nếu tích \"Gỡ Office bản cũ\"."));
            Ui.ThemDuoi(go, Ui.Luoi(4,
                Nut("Gỡ toàn bộ Office", Ic.Xoa, Tone.Do, false, GoOffice),
                Nut("Programs and Features", Ic.Apps, Tone.Xam, false, () => HeThong.Mo("appwiz.cpl")),
                Nut("Trang tải ODT (Microsoft)", Ic.Link, Tone.Xam, false, () => HeThong.Mo("https://www.microsoft.com/download/details.aspx?id=49117")),
                null));
            Them(go);
        }

        static NutBo Nut(string ten, string icon, Tone tone, bool dac, Action lam)
        {
            var b = new NutBo(ten, icon, tone, dac);
            b.Click += (s, e) => lam();
            return b;
        }

        static string X(string s) { return SecurityElement.Escape(s); }

        string TaoCauHinh(string nguon, bool taiVe)
        {
            int i = Math.Max(0, chonBan.SelectedIndex);
            var sb = new StringBuilder();
            sb.Append("<Configuration>\r\n");
            sb.Append("  <Add OfficeClientEdition=\"").Append(r32.Checked ? "32" : "64").Append("\" Channel=\"").Append(BAN[i, 2]).Append('"');
            if (nguon != null) sb.Append(" SourcePath=\"").Append(X(nguon)).Append('"');
            if (!taiVe && nguon == null) sb.Append(" AllowCdnFallback=\"TRUE\"");
            sb.Append(">\r\n");
            sb.Append("    <Product ID=\"").Append(BAN[i, 1]).Append("\">\r\n");
            if (hopEn.Checked || !hopVi.Checked) sb.Append("      <Language ID=\"en-us\" />\r\n");
            if (hopVi.Checked) sb.Append("      <Language ID=\"vi-vn\" />\r\n");
            foreach (CheckBox c in hopApp)
                if (!c.Checked) sb.Append("      <ExcludeApp ID=\"").Append((string)c.Tag).Append("\" />\r\n");
            sb.Append("    </Product>\r\n  </Add>\r\n");
            if (!taiVe)
            {
                if (hopGoMsi.Checked) sb.Append("  <RemoveMSI />\r\n");
                sb.Append("  <Updates Enabled=\"").Append(hopCapNhat.Checked ? "TRUE" : "FALSE").Append("\" />\r\n");
                sb.Append("  <Property Name=\"FORCEAPPSHUTDOWN\" Value=\"TRUE\" />\r\n");
                sb.Append("  <Display Level=\"Full\" AcceptEULA=\"TRUE\" />\r\n");
            }
            sb.Append("</Configuration>\r\n");
            return sb.ToString();
        }

        static string ThuMucOdt
        {
            get
            {
                string d = Path.Combine(HeThong.ThuMucDuLieu, "Office");
                Directory.CreateDirectory(d);
                return d;
            }
        }

        /// <summary>Tải setup.exe của ODT (chính chủ Microsoft) về thư mục làm việc.</summary>
        static string LaySetup(NhatKy log, string thuMuc)
        {
            string setup = Path.Combine(thuMuc, "setup.exe");
            if (File.Exists(setup) && (DateTime.Now - File.GetLastWriteTime(setup)).TotalDays < 14) return setup;
            HeThong.TaiTep(log, URL_ODT, setup);
            return setup;
        }

        void CaiNgay()
        {
            if (!Ui.Hoi(CuaSo, "Cài " + chonBan.SelectedItem + " (" + (r32.Checked ? "32" : "64") + "-bit)?\n\n" +
                               "Đóng Word / Excel / Outlook trước khi cài. Quá trình tải và cài mất 10–30 phút tùy mạng.")) return;
            string cfg = TaoCauHinh(null, false);
            TacVu.Chay("Cài Office", log =>
            {
                string d = ThuMucOdt;
                string setup = LaySetup(log, d);
                string tep = Path.Combine(d, "configuration.xml");
                File.WriteAllText(tep, cfg, new UTF8Encoding(false));
                log.Ghi("Đang cài Office (cửa sổ cài đặt của Microsoft sẽ hiện ra)...");
                int ma = HeThong.Chay(log, setup, "/configure " + HeThong.Nhay(tep));
                if (ma != 0) throw new LoiTacVu("Trình cài Office báo lỗi " + ma + ". Xem chi tiết trong %TEMP% (tệp log của Office).");
                log.Tot("Đã cài xong Office.");
            });
        }

        void TaiOffline()
        {
            string d = Ui.ChonThuMuc(CuaSo, "Chọn thư mục lưu bộ cài Office offline (cần khoảng 3–5 GB trống):", null);
            if (d == null) return;
            string cfgTai = TaoCauHinh(d, true), cfgCai = TaoCauHinh(d, false);
            TacVu.Chay("Tải bộ cài Office offline", log =>
            {
                string setup = LaySetup(log, d);
                string tepTai = Path.Combine(d, "configuration-download.xml");
                File.WriteAllText(tepTai, cfgTai, new UTF8Encoding(false));
                File.WriteAllText(Path.Combine(d, "configuration.xml"), cfgCai, new UTF8Encoding(false));
                File.WriteAllText(Path.Combine(d, "CaiDat.cmd"), "@echo off\r\ncd /d \"%~dp0\"\r\nsetup.exe /configure configuration.xml\r\n", Encoding.ASCII);
                log.Ghi("Đang tải (không hiện tiến độ, có thể mất 10–30 phút)...");
                int ma = HeThong.Chay(log, setup, "/download " + HeThong.Nhay(tepTai));
                if (ma != 0) throw new LoiTacVu("Tải lỗi " + ma);
                log.Tot("Đã tải xong vào " + d + ". Mang thư mục sang máy khác, chạy CaiDat.cmd bằng quyền Admin (hoặc nút \"Cài từ bộ cài offline\").");
            }, () => HeThong.Mo(d));
        }

        void CaiOffline()
        {
            string d = Ui.ChonThuMuc(CuaSo, "Chọn thư mục bộ cài Office offline (có setup.exe và thư mục Office):", null);
            if (d == null) return;
            if (!File.Exists(Path.Combine(d, "setup.exe")) || !Directory.Exists(Path.Combine(d, "Office")))
            {
                Ui.BaoLoi(CuaSo, "Thư mục chưa có setup.exe và thư mục Office (tải bằng nút \"Chỉ tải bộ cài\" trước).");
                return;
            }
            string cfg = TaoCauHinh(d, false);
            TacVu.Chay("Cài Office từ bộ cài offline", log =>
            {
                string tep = Path.Combine(ThuMucOdt, "configuration-offline.xml");
                File.WriteAllText(tep, cfg, new UTF8Encoding(false));
                int ma = HeThong.Chay(log, Path.Combine(d, "setup.exe"), "/configure " + HeThong.Nhay(tep));
                if (ma != 0) throw new LoiTacVu("Trình cài Office báo lỗi " + ma);
            });
        }

        void GoOffice()
        {
            if (!Ui.HoiCanhBao(CuaSo, "Gỡ TOÀN BỘ Office Click-to-Run trên máy này?\nDữ liệu tài liệu không bị ảnh hưởng.")) return;
            TacVu.Chay("Gỡ Office", log =>
            {
                string d = ThuMucOdt;
                string setup = LaySetup(log, d);
                string tep = Path.Combine(d, "remove.xml");
                File.WriteAllText(tep, "<Configuration>\r\n  <Remove All=\"TRUE\" />\r\n  <Display Level=\"Full\" AcceptEULA=\"TRUE\" />\r\n" +
                                       "  <Property Name=\"FORCEAPPSHUTDOWN\" Value=\"TRUE\" />\r\n</Configuration>\r\n", new UTF8Encoding(false));
                int ma = HeThong.Chay(log, setup, "/configure " + HeThong.Nhay(tep));
                if (ma != 0) throw new LoiTacVu("Gỡ lỗi " + ma);
            });
        }
    }
}
