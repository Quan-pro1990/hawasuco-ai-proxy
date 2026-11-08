using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Management;
using System.Text;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Dữ liệu 1 nhóm thông tin (đọc trên luồng nền, sau đó mới dựng thẻ trên luồng giao diện).</summary>
    public class NhomThongTin
    {
        public readonly string TieuDe, Icon;
        public readonly Tone Tone;
        public readonly List<KeyValuePair<string, string>> Dong = new List<KeyValuePair<string, string>>();

        public NhomThongTin(string tieuDe, string icon, Tone tone)
        {
            TieuDe = tieuDe;
            Icon = icon;
            Tone = tone;
        }

        public void Them(string ten, string giaTri)
        {
            Dong.Add(new KeyValuePair<string, string>(ten, string.IsNullOrEmpty(giaTri) ? "—" : giaTri));
        }
    }

    /// <summary>Thẻ thông tin tự vẽ: tiêu đề + các dòng "tên: giá trị" (giá trị tự xuống dòng).</summary>
    public class TheThongTin : Control
    {
        public readonly NhomThongTin Nhom;
        string TieuDe { get { return Nhom.TieuDe; } }
        string Icon { get { return Nhom.Icon; } }
        Tone Tone { get { return Nhom.Tone; } }
        List<KeyValuePair<string, string>> Dong { get { return Nhom.Dong; } }

        public TheThongTin(NhomThongTin nhom)
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.UserPaint, true);
            Nhom = nhom;
        }

        int CotTen { get { return Ui.S(150); } }
        int Le { get { return Ui.S(16); } }
        const TextFormatFlags CO = TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix | TextFormatFlags.TextBoxControl;

        int CaoDong(string giaTri, int rong)
        {
            int w = Math.Max(Ui.S(60), rong - Le * 2 - CotTen);
            return Math.Max(Ui.S(20), TextRenderer.MeasureText(giaTri, Ui.Base, new Size(w, int.MaxValue), CO).Height) + Ui.S(9);
        }

        public int ChieuCao(int rong)
        {
            int h = Ui.S(12) + Ui.S(36);
            foreach (KeyValuePair<string, string> kv in Dong) h += CaoDong(kv.Value, rong);
            return h + Ui.S(10);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Parent != null ? Parent.BackColor : Ui.Nen);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (GraphicsPath p = Ui.HinhBo(new RectangleF(0.5f, 0.5f, Width - 1.5f, Height - 1.5f), Ui.S(12)))
            {
                using (var b = new SolidBrush(Ui.The)) g.FillPath(b, p);
                using (var pen = new Pen(Ui.Vien)) g.DrawPath(pen, p);
            }
            g.SmoothingMode = SmoothingMode.None;
            MauTone m = Ui.Mau(Tone);
            int y = Ui.S(12), x = Le;
            if (Ui.FontIcon != null)
            {
                TextRenderer.DrawText(g, Icon, Ui.IconVua, new Rectangle(x, y, Ui.S(26), Ui.S(30)), m.Dac,
                    TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
                x += Ui.S(30);
            }
            TextRenderer.DrawText(g, TieuDe, Ui.TieuDeThe, new Rectangle(x, y, Width - x - Le, Ui.S(30)), Ui.Chu,
                TextFormatFlags.NoPrefix | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
            y += Ui.S(36);
            using (var pen = new Pen(Ui.Vien))
            {
                for (int i = 0; i < Dong.Count; i++)
                {
                    int h = CaoDong(Dong[i].Value, Width);
                    if (i > 0) g.DrawLine(pen, Le, y, Width - Le, y);
                    TextRenderer.DrawText(g, Dong[i].Key, Ui.Base, new Rectangle(Le, y + Ui.S(4), CotTen - Ui.S(8), h - Ui.S(4)), Ui.ChuPhu,
                        TextFormatFlags.NoPrefix | TextFormatFlags.EndEllipsis);
                    TextRenderer.DrawText(g, Dong[i].Value, Ui.Base, new Rectangle(Le + CotTen, y + Ui.S(4), Width - Le * 2 - CotTen, h), Ui.Chu, CO);
                    y += h;
                }
            }
        }
    }

    /// <summary>Xếp các thẻ thông tin thành 1–3 cột kiểu "gạch" (thẻ mới vào cột đang thấp nhất).</summary>
    public class KhoiCot : Panel
    {
        protected override void OnLayout(LayoutEventArgs e)
        {
            int n = ClientSize.Width >= Ui.S(1500) ? 3 : ClientSize.Width >= Ui.S(860) ? 2 : 1;
            int khe = Ui.S(12), w = (ClientSize.Width - khe * (n - 1)) / n;
            var cao = new int[n];
            foreach (Control c in Controls)
            {
                var t = c as TheThongTin;
                if (t == null) continue;
                int cot = 0;
                for (int i = 1; i < n; i++) if (cao[i] < cao[cot]) cot = i;
                int h = t.ChieuCao(w);
                t.SetBounds(cot * (w + khe), cao[cot], w, h);
                t.Invalidate();
                cao[cot] += h + khe;
            }
            int tong = 0;
            foreach (int c in cao) tong = Math.Max(tong, c);
            tong = Math.Max(0, tong - khe);
            if (Height != tong) Height = tong;
        }
    }

    /// <summary>Trang Kiểm tra cấu hình máy.</summary>
    public class TrangCauHinh : TrangCuon
    {
        readonly KhoiCot khoi = new KhoiCot();
        readonly DoanVan trangThai;
        List<NhomThongTin> the = new List<NhomThongTin>();

        public TrangCauHinh()
        {
            TheBo cc = TheBo.TuCao();
            trangThai = new DoanVan("Đang đọc thông tin máy...", Ui.ChuPhu, Ui.Base);
            Ui.ThemDuoi(cc, trangThai);
            Ui.ThemDuoi(cc, Ui.Luoi(5,
                Nut("Làm mới", Ic.LamMoi, Tone.Xanh, Nap),
                Nut("Sao chép tất cả", Ic.ChepLai, Tone.Ngoc, () => { try { Clipboard.SetText(BaoCao()); NhatKy.Chung.Tot("Đã sao chép cấu hình máy."); } catch (Exception) { } }),
                Nut("Lưu ra tệp .txt", Ic.Luu, Tone.XanhLa, LuuTep),
                Nut("Báo cáo pin (laptop)", Ic.Nguon, Tone.Vang, BaoCaoPin),
                Nut("Kiểm tra RAM", Ic.ChanDoan, Tone.Tim, () => HeThong.Mo(HeThong.Exe("mdsched.exe"))),
                Nut("System Information", Ic.ThongTin, Tone.Xam, () => HeThong.Mo("msinfo32.exe")),
                Nut("Device Manager", Ic.ThietBi, Tone.Xam, () => HeThong.Mo("devmgmt.msc")),
                Nut("Phân vùng ổ cứng", Ic.O, Tone.Xam, () => HeThong.Mo("diskmgmt.msc")),
                Nut("Kiểm tra ổ đĩa (chkdsk)", Ic.SuaChua, Tone.Cam, KiemTraO),
                Nut("Task Manager", Ic.BieuDo, Tone.Xam, () => HeThong.Mo("taskmgr.exe"))));
            Them(cc);
            Them(khoi);
        }

        static NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        protected override void KhiHienLanDau() { Nap(); }

        void Nap()
        {
            trangThai.Text = "Đang đọc thông tin máy...";
            TacVu.Nen(this, DocThongTin, ds =>
            {
                the = ds;
                khoi.SuspendLayout();
                khoi.Controls.Clear();
                foreach (NhomThongTin t in ds) khoi.Controls.Add(new TheThongTin(t));
                khoi.ResumeLayout(true);
                trangThai.Text = Environment.MachineName + "  ·  " + HeThong.TenWindows() + "  ·  cập nhật lúc " + DateTime.Now.ToString("HH:mm:ss");
            });
        }

        static string Ngay(string wmi)
        {
            try { return ManagementDateTimeConverter.ToDateTime(wmi).ToString("dd/MM/yyyy HH:mm"); }
            catch (Exception) { return ""; }
        }

        static string LoaiRam(long ma)
        {
            switch (ma)
            {
                case 20: return "DDR";
                case 21: return "DDR2";
                case 24: return "DDR3";
                case 26: return "DDR4";
                case 29: return "LPDDR3";
                case 30: return "LPDDR4";
                case 34: return "DDR5";
                case 35: return "LPDDR5";
                default: return "";
            }
        }

        static List<NhomThongTin> DocThongTin()
        {
            var kq = new List<NhomThongTin>();

            // ---- Windows ----
            var win = new NhomThongTin("Hệ điều hành", Ic.ManHinh, Tone.Xanh);
            win.Them("Windows", HeThong.TenWindows());
            foreach (ManagementObject o in HeThong.Wmi("SELECT OSArchitecture, InstallDate, LastBootUpTime, RegisteredUser FROM Win32_OperatingSystem"))
            {
                win.Them("Kiến trúc", HeThong.S(o, "OSArchitecture"));
                win.Them("Ngày cài Windows", Ngay(HeThong.S(o, "InstallDate")));
                win.Them("Khởi động lúc", Ngay(HeThong.S(o, "LastBootUpTime")));
            }
            win.Them("Tên máy", Environment.MachineName);
            win.Them("Người dùng", Environment.UserDomainName + "\\" + Environment.UserName);
            foreach (ManagementObject o in HeThong.Wmi("SELECT Workgroup, Domain, PartOfDomain FROM Win32_ComputerSystem"))
            {
                bool dm = o["PartOfDomain"] is bool && (bool)o["PartOfDomain"];
                win.Them(dm ? "Domain" : "Workgroup", HeThong.S(o, dm ? "Domain" : "Workgroup"));
            }
            kq.Add(win);

            // ---- Máy, mainboard, BIOS ----
            var may = new NhomThongTin("Máy - Mainboard - BIOS", Ic.ThietBi, Tone.Tim);
            foreach (ManagementObject o in HeThong.Wmi("SELECT Manufacturer, Model, SystemType FROM Win32_ComputerSystem"))
                may.Them("Hãng / Model", HeThong.S(o, "Manufacturer") + " " + HeThong.S(o, "Model"));
            foreach (ManagementObject o in HeThong.Wmi("SELECT Manufacturer, Product FROM Win32_BaseBoard"))
                may.Them("Mainboard", HeThong.S(o, "Manufacturer") + " " + HeThong.S(o, "Product"));
            foreach (ManagementObject o in HeThong.Wmi("SELECT SMBIOSBIOSVersion, ReleaseDate, SerialNumber FROM Win32_BIOS"))
            {
                string ngay = Ngay(HeThong.S(o, "ReleaseDate"));
                may.Them("BIOS", HeThong.S(o, "SMBIOSBIOSVersion") + (ngay.Length >= 10 ? "  (" + ngay.Substring(0, 10) + ")" : ""));
                may.Them("Số serial", HeThong.S(o, "SerialNumber"));
            }
            int fw = HeThong.DocSo(@"HKLM\SYSTEM\CurrentControlSet\Control", "PEFirmwareType", 0);
            may.Them("Chế độ khởi động", fw == 2 ? "UEFI" : fw == 1 ? "Legacy BIOS" : "");
            int sb = HeThong.DocSo(@"HKLM\SYSTEM\CurrentControlSet\Control\SecureBoot\State", "UEFISecureBootEnabled", -1);
            may.Them("Secure Boot", sb == 1 ? "Đang bật" : sb == 0 ? "Đang tắt" : "Không hỗ trợ");
            string tpm = "Không có / đang tắt";
            foreach (ManagementObject o in HeThong.Wmi(@"root\cimv2\Security\MicrosoftTpm", "SELECT SpecVersion, IsEnabled_InitialValue FROM Win32_Tpm"))
            {
                string v = HeThong.S(o, "SpecVersion");
                int i = v.IndexOf(',');
                tpm = "TPM " + (i > 0 ? v.Substring(0, i) : v) + (o["IsEnabled_InitialValue"] is bool && (bool)o["IsEnabled_InitialValue"] ? " (đang bật)" : " (đang tắt)");
            }
            may.Them("TPM", tpm);
            foreach (ManagementObject o in HeThong.Wmi("SELECT EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery"))
                may.Them("Pin", HeThong.L(o, "EstimatedChargeRemaining") + "%" + (HeThong.L(o, "BatteryStatus") == 2 ? " (đang sạc / cắm điện)" : ""));
            kq.Add(may);

            // ---- CPU + RAM ----
            var cpu = new NhomThongTin("CPU - RAM", Ic.ChanDoan, Tone.Cam);
            foreach (ManagementObject o in HeThong.Wmi("SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor"))
            {
                cpu.Them("CPU", HeThong.S(o, "Name"));
                cpu.Them("Nhân / luồng", HeThong.L(o, "NumberOfCores") + " nhân / " + HeThong.L(o, "NumberOfLogicalProcessors") + " luồng  ·  " +
                                         (HeThong.L(o, "MaxClockSpeed") / 1000.0).ToString("0.00") + " GHz");
            }
            long tongRam = 0;
            foreach (ManagementObject o in HeThong.Wmi("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem")) tongRam = HeThong.L(o, "TotalPhysicalMemory");
            long khe = 0;
            foreach (ManagementObject o in HeThong.Wmi("SELECT MemoryDevices FROM Win32_PhysicalMemoryArray")) khe += HeThong.L(o, "MemoryDevices");
            var thanh = HeThong.Wmi("SELECT Capacity, Speed, ConfiguredClockSpeed, Manufacturer, PartNumber, DeviceLocator, SMBIOSMemoryType FROM Win32_PhysicalMemory");
            cpu.Them("RAM", HeThong.Gb(tongRam) + " dùng được  ·  " + thanh.Count + (khe > 0 ? "/" + khe : "") + " khe đã cắm");
            foreach (ManagementObject o in thanh)
            {
                long tocDo = HeThong.L(o, "ConfiguredClockSpeed");
                if (tocDo <= 0) tocDo = HeThong.L(o, "Speed");
                string loai = LoaiRam(HeThong.L(o, "SMBIOSMemoryType"));
                cpu.Them(HeThong.S(o, "DeviceLocator"), HeThong.Gb(HeThong.L(o, "Capacity")) + (loai.Length > 0 ? " " + loai : "") +
                    (tocDo > 0 ? " " + tocDo + " MHz" : "") + "  ·  " + (HeThong.S(o, "Manufacturer") + " " + HeThong.S(o, "PartNumber")).Trim());
            }
            kq.Add(cpu);

            // ---- Ổ cứng ----
            var o_ = new NhomThongTin("Ổ cứng - Phân vùng", Ic.O, Tone.Ngoc);
            var vatLy = HeThong.Wmi(@"root\Microsoft\Windows\Storage", "SELECT FriendlyName, MediaType, BusType, Size, HealthStatus FROM MSFT_PhysicalDisk");
            if (vatLy.Count > 0)
            {
                foreach (ManagementObject o in vatLy)
                {
                    long mt = HeThong.L(o, "MediaType"), bus = HeThong.L(o, "BusType"), sk = HeThong.L(o, "HealthStatus");
                    string loai = bus == 17 ? "SSD NVMe" : mt == 4 ? "SSD" : mt == 3 ? "HDD" : "";
                    string cong = bus == 7 ? "USB" : bus == 11 ? "SATA" : bus == 17 ? "NVMe" : bus == 8 ? "RAID" : bus == 10 ? "SAS" : "";
                    string sucKhoe = sk == 0 ? "Tốt" : sk == 1 ? "CẢNH BÁO" : sk == 2 ? "HỎNG / SẮP HỎNG" : "?";
                    o_.Them(HeThong.Gb(HeThong.L(o, "Size")) + " " + loai, HeThong.S(o, "FriendlyName") + (cong.Length > 0 && cong != "NVMe" ? " (" + cong + ")" : "") + "  ·  Sức khỏe: " + sucKhoe);
                }
            }
            else
            {
                foreach (ManagementObject o in HeThong.Wmi("SELECT Model, Size, InterfaceType FROM Win32_DiskDrive"))
                    o_.Them(HeThong.Gb(HeThong.L(o, "Size")), HeThong.S(o, "Model") + " (" + HeThong.S(o, "InterfaceType") + ")");
            }
            foreach (ManagementObject o in HeThong.Wmi("SELECT DeviceID, Size, FreeSpace, FileSystem, VolumeName FROM Win32_LogicalDisk WHERE DriveType = 3"))
            {
                long tong = HeThong.L(o, "Size"), trong = HeThong.L(o, "FreeSpace");
                string ten = HeThong.S(o, "VolumeName");
                o_.Them("Ổ " + HeThong.S(o, "DeviceID") + (ten.Length > 0 ? " " + ten : ""),
                    "Trống " + HeThong.Gb(trong) + " / " + HeThong.Gb(tong) + " (" + (tong > 0 ? (trong * 100 / tong) : 0) + "%)  ·  " + HeThong.S(o, "FileSystem"));
            }
            kq.Add(o_);

            // ---- Card màn hình ----
            var gpu = new NhomThongTin("Card màn hình", Ic.ManHinh, Tone.XanhLa);
            foreach (ManagementObject o in HeThong.Wmi("SELECT Name, DriverVersion, AdapterRAM, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate FROM Win32_VideoController"))
            {
                long vram = HeThong.L(o, "AdapterRAM");
                gpu.Them("Card", HeThong.S(o, "Name") + (vram > 0 ? "  ·  " + (vram >= 4294000000L ? "≥ 4 GB" : HeThong.Gb(vram)) : ""));
                gpu.Them("Driver", HeThong.S(o, "DriverVersion"));
                if (HeThong.L(o, "CurrentHorizontalResolution") > 0)
                    gpu.Them("Độ phân giải", HeThong.L(o, "CurrentHorizontalResolution") + " x " + HeThong.L(o, "CurrentVerticalResolution") + " @ " + HeThong.L(o, "CurrentRefreshRate") + " Hz");
            }
            kq.Add(gpu);

            // ---- Mạng ----
            var mang = new NhomThongTin("Mạng", Ic.Mang, Tone.Vang);
            foreach (ManagementObject o in HeThong.Wmi("SELECT Description, IPAddress, MACAddress, DefaultIPGateway, DNSServerSearchOrder, DHCPEnabled FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled = TRUE"))
            {
                string ip = "";
                var ds = o["IPAddress"] as string[];
                if (ds != null) foreach (string a in ds) if (a.IndexOf(':') < 0) ip = ip.Length == 0 ? a : ip + ", " + a;
                bool dhcp = o["DHCPEnabled"] is bool && (bool)o["DHCPEnabled"];
                mang.Them("Card mạng", HeThong.S(o, "Description"));
                mang.Them("IP / MAC", ip + (dhcp ? " (DHCP)" : " (IP tĩnh)") + "  ·  " + HeThong.S(o, "MACAddress"));
                mang.Them("Gateway / DNS", HeThong.S(o, "DefaultIPGateway") + "  ·  DNS: " + HeThong.S(o, "DNSServerSearchOrder"));
            }
            kq.Add(mang);
            return kq;
        }

        string BaoCao()
        {
            var sb = new StringBuilder();
            sb.Append("CẤU HÌNH MÁY ").Append(Environment.MachineName).Append(" — ").Append(DateTime.Now.ToString("dd/MM/yyyy HH:mm")).Append("\r\n");
            foreach (NhomThongTin t in the)
            {
                sb.Append("\r\n[").Append(t.TieuDe.ToUpperInvariant()).Append("]\r\n");
                foreach (KeyValuePair<string, string> kv in t.Dong) sb.Append("  ").Append(kv.Key.PadRight(22)).Append(": ").Append(kv.Value).Append("\r\n");
            }
            return sb.ToString();
        }

        void LuuTep()
        {
            using (var d = new SaveFileDialog { Filter = "Tệp văn bản (*.txt)|*.txt", FileName = "CauHinh_" + Environment.MachineName + "_" + DateTime.Now.ToString("yyyy-MM-dd") + ".txt" })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                File.WriteAllText(d.FileName, BaoCao(), new UTF8Encoding(true));
                NhatKy.Chung.Tot("Đã lưu cấu hình: " + d.FileName);
            }
        }

        void BaoCaoPin()
        {
            string tep = Path.Combine(HeThong.ThuMucDuLieu, "BaoCaoPin_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".html");
            TacVu.Chay("Báo cáo pin", log =>
            {
                HeThong.Chay(log, HeThong.Exe("powercfg.exe"), "/batteryreport /output " + HeThong.Nhay(tep));
                if (!File.Exists(tep)) throw new LoiTacVu("Không tạo được báo cáo (máy không có pin?).");
            }, () => { if (File.Exists(tep)) HeThong.Mo(tep); });
        }

        void KiemTraO()
        {
            string o = Environment.GetEnvironmentVariable("SystemDrive") ?? "C:";
            TacVu.Chay("Kiểm tra ổ " + o + " (chkdsk /scan)", log => HeThong.Chay(log, HeThong.Exe("chkdsk.exe"), o + " /scan"));
        }
    }
}
