using System;
using System.Collections.Generic;
using System.IO;
using System.Management;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Driver - Thiết bị: thiết bị lỗi / thiếu driver, sao lưu và cài lại driver, trang tải driver chính hãng.</summary>
    public class TrangDriver : TrangCuon
    {
        readonly DataGridView luoi;
        readonly DoanVan tomTat;

        public TrangDriver()
        {
            TheBo loi = TheBo.TuCao();
            Ui.ThemDuoi(loi, new TieuDe("Thiết bị thiếu driver / đang lỗi", Ic.CanhBao, Tone.Do));
            tomTat = new DoanVan("Đang quét thiết bị...");
            Ui.ThemDuoi(loi, tomTat);
            luoi = Ui.TaoLuoi(false, "Thiết bị", "Lỗi", "Hardware ID");
            luoi.Columns[1].FillWeight = 60;
            luoi.Height = Ui.S(220);
            luoi.CellDoubleClick += (s, e) => TimCatalog();
            Ui.ThemDuoi(loi, luoi);
            Ui.ThemDuoi(loi, Ui.Khoang(8));
            Ui.ThemDuoi(loi, Ui.Luoi(4,
                Nut("Quét lại", Ic.LamMoi, Tone.Xanh, Nap),
                Nut("Tìm driver trên Microsoft Update Catalog", Ic.TimKiem, Tone.Tim, TimCatalog),
                Nut("Sao chép Hardware ID", Ic.ChepLai, Tone.Xam, ChepHwid),
                Nut("Quét thay đổi phần cứng", Ic.Quet, Tone.Ngoc, () => TacVu.Chay("Quét thay đổi phần cứng", log =>
                    HeThong.Chay(log, HeThong.Exe("pnputil.exe"), "/scan-devices"), Nap)),
                Nut("Driver qua Windows Update", Ic.TaiVe, Tone.XanhLa, () => HeThong.Mo("ms-settings:windowsupdate-optionalupdates")),
                Nut("Mở Device Manager", Ic.ThietBi, Tone.Xam, () => HeThong.Mo("devmgmt.msc"))));
            Them(loi);

            TheBo sl = TheBo.TuCao();
            Ui.ThemDuoi(sl, new TieuDe("Sao lưu & cài lại driver", Ic.Luu, Tone.Ngoc));
            Ui.ThemDuoi(sl, new DoanVan("Sao lưu toàn bộ driver bên thứ ba (card mạng, âm thanh, máy in...) trước khi cài lại Windows; " +
                "sau khi cài Win chọn thư mục đã sao lưu để cài lại tất cả trong 1 lần. Cũng dùng được với thư mục driver tải từ trang hãng (đã giải nén, có tệp .inf)."));
            Ui.ThemDuoi(sl, Ui.Luoi(4,
                Nut("Sao lưu driver...", Ic.Luu, Tone.Ngoc, SaoLuu),
                Nut("Cài driver từ thư mục...", Ic.TaiLen, Tone.Xanh, CaiTuThuMuc),
                Nut("Liệt kê driver đã cài", Ic.TaiLieu, Tone.Xam, () => TacVu.Chay("Danh sách driver bên thứ ba", log =>
                    HeThong.Chay(log, HeThong.Exe("pnputil.exe"), "/enum-drivers"))),
                Nut("Mở thư mục DriverStore", Ic.ThuMuc, Tone.Xam, () => HeThong.Mo(Path.Combine(HeThong.Sys32, @"DriverStore\FileRepository")))));
            Them(sl);

            TheBo hang = TheBo.TuCao();
            Ui.ThemDuoi(hang, new TieuDe("Trang tải driver chính hãng", Ic.Link, Tone.Xanh));
            Ui.ThemDuoi(hang, Ui.Luoi(4,
                Web("Intel Driver & Support Assistant", "https://www.intel.com/content/www/us/en/support/detect.html"),
                Web("AMD Drivers", "https://www.amd.com/en/support/download/drivers.html"),
                Web("NVIDIA Drivers", "https://www.nvidia.com/Download/index.aspx"),
                Web("Microsoft Update Catalog", "https://www.catalog.update.microsoft.com/"),
                Web("Dell Support", "https://www.dell.com/support/home"),
                Web("HP Support (máy tính, máy in)", "https://support.hp.com/drivers"),
                Web("Lenovo Support", "https://pcsupport.lenovo.com/"),
                Web("ASUS Download Center", "https://www.asus.com/support/download-center/"),
                Web("Acer Support", "https://www.acer.com/support"),
                Web("MSI Support", "https://www.msi.com/support/download"),
                Web("Brother Support", "https://support.brother.com/"),
                Web("Gigabyte Support", "https://www.gigabyte.com/Support")));
            Them(hang);
        }

        static NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        public static NutBo Web(string ten, string url)
        {
            NutBo b = NutBo.Phu(ten, Ic.Link);
            b.CanTrai = true;
            b.Click += (s, e) => HeThong.Mo(url);
            return b;
        }

        protected override void KhiHienLanDau() { Nap(); }

        class ThietBi
        {
            public string Ten, Loi, Hwid;
        }

        static string MoTaLoi(long ma)
        {
            switch (ma)
            {
                case 1: return "1 - Cấu hình sai";
                case 10: return "10 - Không khởi động được";
                case 18: return "18 - Cần cài lại driver";
                case 22: return "22 - Đang bị tắt";
                case 24: return "24 - Không có / thiếu driver";
                case 28: return "28 - Chưa cài driver";
                case 31: return "31 - Driver lỗi";
                case 37: return "37 - Driver không chạy";
                case 39: return "39 - Driver hỏng / thiếu";
                case 43: return "43 - Thiết bị báo lỗi";
                case 45: return "45 - Đang không cắm";
                case 52: return "52 - Driver không có chữ ký";
                default: return ma.ToString();
            }
        }

        void Nap()
        {
            tomTat.Text = "Đang quét thiết bị...";
            TacVu.Nen(this, () =>
            {
                var ds = new List<ThietBi>();
                foreach (ManagementObject o in HeThong.Wmi("SELECT Name, ConfigManagerErrorCode, HardwareID, DeviceID FROM Win32_PnPEntity WHERE ConfigManagerErrorCode <> 0"))
                {
                    long ma = HeThong.L(o, "ConfigManagerErrorCode");
                    if (ma == 45) continue;   // thiết bị đã rút ra, không phải lỗi
                    var hw = o["HardwareID"] as string[];
                    string ten = HeThong.S(o, "Name");
                    ds.Add(new ThietBi
                    {
                        Ten = ten.Length > 0 ? ten : "(Thiết bị không rõ) " + HeThong.S(o, "DeviceID"),
                        Loi = MoTaLoi(ma),
                        Hwid = hw != null && hw.Length > 0 ? hw[0] : HeThong.S(o, "DeviceID")
                    });
                }
                return ds;
            }, ds =>
            {
                luoi.Rows.Clear();
                foreach (ThietBi t in ds)
                {
                    int r = luoi.Rows.Add(t.Ten, t.Loi, t.Hwid);
                    luoi.Rows[r].Tag = t.Hwid;
                }
                tomTat.Text = ds.Count == 0
                    ? "Tốt: không có thiết bị nào thiếu driver hoặc báo lỗi."
                    : "Có " + ds.Count + " thiết bị cần xử lý. Chọn 1 dòng rồi bấm \"Tìm driver trên Microsoft Update Catalog\" (hoặc nhấp đúp) để tìm theo Hardware ID.";
                tomTat.ForeColor = ds.Count == 0 ? Ui.Tot : Ui.CanhChu;
            });
        }

        string HwidChon()
        {
            if (luoi.CurrentRow == null)
            {
                Ui.BaoTin(CuaSo, "Chọn 1 thiết bị trong bảng.");
                return null;
            }
            return luoi.CurrentRow.Tag as string;
        }

        void TimCatalog()
        {
            string hw = HwidChon();
            if (hw == null) return;
            // rút gọn VEN_xxxx&DEV_xxxx để tìm được nhiều kết quả hơn
            string q = hw;
            int i = q.IndexOf("&SUBSYS", StringComparison.OrdinalIgnoreCase);
            if (i > 0) q = q.Substring(0, i);
            int j = q.IndexOf('\\');
            if (j >= 0) q = q.Substring(j + 1);
            HeThong.Mo("https://www.catalog.update.microsoft.com/Search.aspx?q=" + Uri.EscapeDataString(q));
        }

        void ChepHwid()
        {
            string hw = HwidChon();
            if (hw == null) return;
            try
            {
                Clipboard.SetText(hw);
                NhatKy.Chung.Tot("Đã sao chép: " + hw);
            }
            catch (Exception) { }
        }

        void SaoLuu()
        {
            string goc = Directory.Exists(@"D:\") ? @"D:\" : Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            string d = Ui.ChonThuMuc(CuaSo, "Chọn nơi lưu bản sao lưu driver (nên chọn ổ khác ổ C):", goc);
            if (d == null) return;
            string dich = Path.Combine(d, "Driver_" + Environment.MachineName + "_" + DateTime.Now.ToString("yyyy-MM-dd"));
            TacVu.Chay("Sao lưu driver", log =>
            {
                Directory.CreateDirectory(dich);
                int ma = HeThong.Chay(log, HeThong.Exe("pnputil.exe"), "/export-driver * " + HeThong.Nhay(dich));
                if (ma != 0)
                {
                    log.Canh("pnputil báo lỗi " + ma + ", thử bằng DISM...");
                    ma = HeThong.Chay(log, HeThong.Exe("dism.exe"), "/online /export-driver /destination:" + HeThong.Nhay(dich));
                    if (ma != 0) throw new LoiTacVu("Sao lưu driver lỗi " + ma);
                }
                log.Tot("Đã sao lưu driver vào: " + dich);
            }, () => HeThong.Mo(dich));
        }

        void CaiTuThuMuc()
        {
            string d = Ui.ChonThuMuc(CuaSo, "Chọn thư mục chứa driver (có tệp .inf, kể cả thư mục con):", null);
            if (d == null) return;
            TacVu.Chay("Cài driver từ thư mục", log =>
                HeThong.Chay(log, HeThong.Exe("pnputil.exe"), "/add-driver " + HeThong.Nhay(Path.Combine(d, "*.inf")) + " /subdirs /install"), Nap);
        }
    }
}
