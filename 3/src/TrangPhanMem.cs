using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Kho phần mềm: cài phần mềm miễn phí bằng winget (Windows Package Manager của Microsoft).</summary>
    public class TrangPhanMem : TrangCuon
    {
        // Nhóm | Tên hiển thị | winget ID
        static readonly string[,] MAC_DINH =
        {
            { "Trình duyệt", "Google Chrome", "Google.Chrome" },
            { "Trình duyệt", "Mozilla Firefox", "Mozilla.Firefox" },
            { "Trình duyệt", "Cốc Cốc", "CocCoc.CocCoc" },
            { "Văn phòng", "Foxit PDF Reader", "Foxit.FoxitReader" },
            { "Văn phòng", "Adobe Acrobat Reader", "Adobe.Acrobat.Reader.64-bit" },
            { "Văn phòng", "SumatraPDF (đọc PDF nhẹ)", "SumatraPDF.SumatraPDF" },
            { "Văn phòng", "LibreOffice", "TheDocumentFoundation.LibreOffice" },
            { "Văn phòng", "ONLYOFFICE", "ONLYOFFICE.DesktopEditors" },
            { "Văn phòng", "Notepad++", "Notepad++.Notepad++" },
            { "Nén - giải nén", "7-Zip", "7zip.7zip" },
            { "Nén - giải nén", "WinRAR", "RARLab.WinRAR" },
            { "Điều khiển từ xa", "UltraViewer", "DucFabulous.UltraViewer" },
            { "Điều khiển từ xa", "TeamViewer", "TeamViewer.TeamViewer" },
            { "Điều khiển từ xa", "AnyDesk", "AnyDeskSoftwareGmbH.AnyDesk" },
            { "Điều khiển từ xa", "RustDesk", "RustDesk.RustDesk" },
            { "Liên lạc - họp", "Zoom", "Zoom.Zoom" },
            { "Liên lạc - họp", "Microsoft Teams", "Microsoft.Teams" },
            { "Liên lạc - họp", "Telegram", "Telegram.TelegramDesktop" },
            { "Đa phương tiện", "VLC media player", "VideoLAN.VLC" },
            { "Đa phương tiện", "K-Lite Codec Pack", "CodecGuide.K-LiteCodecPack.Standard" },
            { "Thư viện hệ thống", "Visual C++ 2015-2022 x64", "Microsoft.VCRedist.2015+.x64" },
            { "Thư viện hệ thống", "Visual C++ 2015-2022 x86", "Microsoft.VCRedist.2015+.x86" },
            { "Thư viện hệ thống", ".NET Desktop Runtime 8", "Microsoft.DotNet.DesktopRuntime.8" },
            { "Thư viện hệ thống", "Java Runtime (Oracle)", "Oracle.JavaRuntimeEnvironment" },
            { "Công cụ kỹ thuật", "CPU-Z", "CPUID.CPU-Z" },
            { "Công cụ kỹ thuật", "GPU-Z", "TechPowerUp.GPU-Z" },
            { "Công cụ kỹ thuật", "CrystalDiskInfo", "CrystalDewWorld.CrystalDiskInfo" },
            { "Công cụ kỹ thuật", "CrystalDiskMark", "CrystalDewWorld.CrystalDiskMark" },
            { "Công cụ kỹ thuật", "Rufus", "Rufus.Rufus" },
            { "Công cụ kỹ thuật", "Ventoy", "Ventoy.Ventoy" },
            { "Công cụ kỹ thuật", "Everything (tìm tệp)", "voidtools.Everything" },
            { "Công cụ kỹ thuật", "PowerToys", "Microsoft.PowerToys" }
        };

        readonly List<CheckBox> hop = new List<CheckBox>();
        readonly DoanVan trangThai;
        readonly TextBox oTim;

        public TrangPhanMem()
        {
            TheBo dau = TheBo.TuCao();
            Ui.ThemDuoi(dau, new TieuDe("Cài phần mềm miễn phí bằng winget (Microsoft)", Ic.Apps, Tone.Tim));
            trangThai = new DoanVan("Đang kiểm tra winget...");
            Ui.ThemDuoi(dau, trangThai);
            Ui.ThemDuoi(dau, new DoanVan("Phần mềm tải thẳng từ trang của nhà phát hành qua kho winget, cài im lặng lần lượt từng cái. " +
                "Muốn thêm phần mềm riêng: tạo tệp phanmem.txt cạnh ITToolkit.exe, mỗi dòng: Nhóm|Tên hiển thị|WingetID (tìm ID bằng ô tìm kiếm bên dưới).",
                Ui.ChuPhu, Ui.Nho));
            Ui.ThemDuoi(dau, Ui.Khoang(6));
            oTim = Ui.O("Tên phần mềm cần tìm ID, vd: zalo, unikey, foxit");
            var tim = new NutBo("Tìm trên winget", Ic.TimKiem, Tone.Xanh, false) { AutoSize = true, Margin = Ui.Pad(6, 2, 0, 2) };
            tim.Click += (s, e) => Tim();
            oTim.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Tim(); } };
            Ui.ThemDuoi(dau, Ui.HangNgang(oTim, tim));
            Ui.ThemDuoi(dau, Ui.Khoang(8));
            Ui.ThemDuoi(dau, Ui.Luoi(4,
                Nut("Cài các phần mềm đã chọn", Ic.TaiVe, Tone.Tim, true, CaiDaChon),
                Nut("Cập nhật tất cả phần mềm", Ic.LamMoi, Tone.XanhLa, false, () =>
                {
                    if (Ui.Hoi(CuaSo, "Cập nhật mọi phần mềm có bản mới (winget upgrade --all)?")) TacVu.Chay("Cập nhật tất cả phần mềm", log =>
                        Winget(log, "upgrade --all --silent --accept-package-agreements --accept-source-agreements"));
                }),
                Nut("Bỏ chọn tất cả", Ic.Huy, Tone.Xam, false, () => { foreach (CheckBox c in hop) c.Checked = false; }),
                Nut("Cài / sửa winget (App Installer)", Ic.Apps, Tone.Xam, false, () => HeThong.Mo("ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1"))));
            Them(dau);

            // nhóm phần mềm
            var nhom = new List<string>();
            var theoNhom = new Dictionary<string, List<string[]>>();
            foreach (string[] p in DanhMuc())
            {
                if (!theoNhom.ContainsKey(p[0]))
                {
                    theoNhom[p[0]] = new List<string[]>();
                    nhom.Add(p[0]);
                }
                theoNhom[p[0]].Add(p);
            }
            var cot = new NhieuCot(2);
            int i = 0;
            foreach (string n in nhom)
            {
                TheBo t = TheBo.TuCao();
                Ui.ThemDuoi(t, new TieuDe(n, Ic.Apps, (Tone)(i % 8)));
                var ds = new List<Control>();
                foreach (string[] p in theoNhom[n])
                {
                    CheckBox c = Ui.Hop(p[1], false);
                    c.Tag = p[2];
                    hop.Add(c);
                    ds.Add(c);
                }
                Ui.ThemDuoi(t, Ui.Luoi(2, ds.ToArray()));
                cot.Them(i % 2, t);
                i++;
            }
            Them(cot);

            TheBo web = TheBo.TuCao();
            Ui.ThemDuoi(web, new TieuDe("Tải bộ cài chính hãng", Ic.Link, Tone.Xanh));
            Ui.ThemDuoi(web, Ui.Luoi(4,
                TrangDriver.Web("ISO Windows 11", "https://www.microsoft.com/software-download/windows11"),
                TrangDriver.Web("ISO Windows 10", "https://www.microsoft.com/software-download/windows10"),
                TrangDriver.Web("Office Deployment Tool", "https://www.microsoft.com/download/details.aspx?id=49117"),
                TrangDriver.Web("Microsoft Update Catalog", "https://www.catalog.update.microsoft.com/"),
                TrangDriver.Web("Zalo PC", "https://zalo.me/pc"),
                TrangDriver.Web("UniKey", "https://www.unikey.org/"),
                TrangDriver.Web("Kho winget (winstall.app)", "https://winstall.app/"),
                TrangDriver.Web("App Installer / winget", "https://aka.ms/getwinget")));
            Them(web);
        }

        static NutBo Nut(string ten, string icon, Tone tone, bool dac, Action lam)
        {
            var b = new NutBo(ten, icon, tone, dac);
            b.Click += (s, e) => lam();
            return b;
        }

        /// <summary>Danh mục mặc định + phanmem.txt (nếu có) đặt cạnh ITToolkit.exe.</summary>
        static List<string[]> DanhMuc()
        {
            var ds = new List<string[]>();
            for (int i = 0; i < MAC_DINH.GetLength(0); i++) ds.Add(new[] { MAC_DINH[i, 0], MAC_DINH[i, 1], MAC_DINH[i, 2] });
            try
            {
                string tep = Path.Combine(Path.GetDirectoryName(Application.ExecutablePath), "phanmem.txt");
                if (File.Exists(tep))
                {
                    foreach (string dong in File.ReadAllLines(tep, Encoding.UTF8))
                    {
                        string d = dong.Trim();
                        if (d.Length == 0 || d.StartsWith("#")) continue;
                        string[] p = d.Split('|');
                        if (p.Length < 3) continue;
                        string id = p[2].Trim();
                        ds.RemoveAll(x => string.Equals(x[2], id, StringComparison.OrdinalIgnoreCase));
                        ds.Add(new[] { p[0].Trim(), p[1].Trim(), id });
                    }
                }
            }
            catch (Exception) { }
            return ds;
        }

        static string WingetExe
        {
            get
            {
                string p = Environment.ExpandEnvironmentVariables(@"%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe");
                return File.Exists(p) ? p : "winget.exe";
            }
        }

        static int Winget(NhatKy log, string thamSo)
        {
            int ma = HeThong.Chay(log, WingetExe, thamSo, Encoding.UTF8, true);
            if (ma == -1) throw new LoiTacVu("Không chạy được winget. Cài \"App Installer\" từ Microsoft Store rồi thử lại.");
            return ma;
        }

        protected override void KhiHienLanDau()
        {
            TacVu.Nen(this, () => HeThong.KetQua(WingetExe, "--version", Encoding.UTF8, 20000).Trim(), v =>
            {
                if (v.StartsWith("v"))
                {
                    trangThai.Text = "winget " + v + " sẵn sàng. Tích phần mềm cần cài rồi bấm \"Cài các phần mềm đã chọn\".";
                    trangThai.ForeColor = Ui.Tot;
                }
                else
                {
                    trangThai.Text = "Máy chưa có winget (Windows 10 cũ / bản rút gọn). Bấm \"Cài / sửa winget\" để cài App Installer từ Microsoft Store.";
                    trangThai.ForeColor = Ui.Loi;
                }
            });
        }

        void Tim()
        {
            string q = oTim.Text.Trim();
            if (q.Length == 0) return;
            TacVu.Chay("Tìm \"" + q + "\" trên winget", log => Winget(log, "search " + HeThong.Nhay(q) + " --accept-source-agreements"));
        }

        void CaiDaChon()
        {
            var chon = new List<string[]>();
            foreach (CheckBox c in hop) if (c.Checked) chon.Add(new[] { c.Text, (string)c.Tag });
            if (chon.Count == 0)
            {
                Ui.BaoTin(CuaSo, "Tích ít nhất 1 phần mềm.");
                return;
            }
            TacVu.Chay("Cài " + chon.Count + " phần mềm", log =>
            {
                var loi = new List<string>();
                for (int i = 0; i < chon.Count; i++)
                {
                    log.TieuDe("(" + (i + 1) + "/" + chon.Count + ") " + chon[i][0]);
                    int ma = Winget(log, "install --id " + chon[i][1] + " -e --silent --accept-package-agreements --accept-source-agreements");
                    // -1978335189: đã cài và không có bản mới
                    if (ma != 0 && ma != -1978335189) loi.Add(chon[i][0] + " (mã " + ma + ")");
                }
                if (loi.Count > 0) log.Canh("Chưa cài được: " + string.Join(", ", loi.ToArray()));
            }, () => { foreach (CheckBox c in hop) c.Checked = false; });
        }
    }
}
