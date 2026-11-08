using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Management;
using System.Text;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang Máy in - Chia sẻ LAN: 5 tab.</summary>
    public class TrangMayIn : Trang
    {
        readonly ThanhTab tab = new ThanhTab();
        readonly TabMayIn tabMayIn = new TabMayIn();

        public TrangMayIn()
        {
            tab.Them("Fix máy in mạng LAN", Ic.MayIn, tabMayIn);
            tab.Them("Windows Credentials", Ic.Khoa, new TabDangNhap());
            tab.Them("Tạo user chia sẻ - LAN", Ic.NguoiDung, new TabTaiKhoan());
            tab.Them("Fix chia sẻ dữ liệu", Ic.ThuMuc, new TabChiaSe());
            tab.Them("Sửa lỗi Scan", Ic.Quet, new TabScan());
            Ui.ThemFill(this, tab);
            tab.DoiTab += (s, e) =>
            {
                var t = tab.TrangDangChon as Trang;
                if (t != null) t.Hien();
            };
        }

        protected override void KhiHienLanDau()
        {
            tab.Chon(0);
        }

        /// <summary>Hiện chi tiết lỗi; người dùng đồng ý thì chạy các bước sửa.</summary>
        public static void XemVaSua(IWin32Window chu, LoiMau l)
        {
            if (!ChiTietLoi.Hien(chu, l)) return;
            if (l.HanhDongRieng != null)
            {
                l.HanhDongRieng(chu);
                return;
            }
            var buoc = new List<Buoc>(l.Buoc);
            TacVu.Chay("Sửa lỗi " + l.Ma, log => SuaLoi.ChayCacBuoc(log, buoc),
                l.CanKhoiDongLai ? (Action)(() => Ui.HoiKhoiDongLai(chu)) : null);
        }

        public static string MoTaBuoc(IList<Buoc> buoc)
        {
            var sb = new StringBuilder();
            for (int i = 0; i < buoc.Count; i++) sb.Append(i + 1).Append(". ").Append(buoc[i].MoTa).Append('\n');
            return sb.ToString();
        }
    }

    /// <summary>Tab 1: danh sách máy in, sửa mã lỗi máy in mạng, tiện ích máy in.</summary>
    public class TabMayIn : Trang
    {
        readonly DataGridView luoi;
        readonly List<CheckBox> hopLoi = new List<CheckBox>();
        readonly ToolTip tip = new ToolTip { AutoPopDelay = 30000, InitialDelay = 300 };

        public TabMayIn()
        {
            var bang = new TableLayoutPanel { ColumnCount = 2, RowCount = 1 };
            bang.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            bang.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            bang.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

            // ---- trái: danh sách máy in ----
            var trai = new TheBo { Margin = Ui.Pad(0, 0, 6, 0) };
            var dau = new TableLayoutPanel { ColumnCount = 2, RowCount = 1, Height = Ui.S(40) };
            dau.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            dau.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            var td = new TieuDe("Danh sách máy in & cổng đang chạy", Ic.MayIn, Tone.Cam) { Dock = DockStyle.Fill };
            dau.Controls.Add(td, 0, 0);
            var quet = new NutBo("Quét lại máy in", Ic.LamMoi, Tone.Xanh, false) { AutoSize = true, Anchor = AnchorStyles.Right };
            quet.Click += (s, e) => NapMayIn();
            dau.Controls.Add(quet, 1, 0);

            luoi = Ui.TaoLuoi(false, "Tên máy in", "Cổng (Port)", "Driver", "Trạng thái", "Chia sẻ", "Mặc định");
            luoi.Columns[0].FillWeight = 160;
            luoi.Columns[3].FillWeight = 70;
            luoi.Columns[5].FillWeight = 50;

            var nutTrai = Ui.Luoi(3,
                Nut("Đặt mặc định", Ic.Sao, Tone.Vang, DatMacDinh),
                Nut("Chia sẻ máy in LAN", Ic.ChiaSe, Tone.Xanh, ChiaSeMayIn),
                Nut("Ngừng chia sẻ", Ic.Huy, Tone.Xam, NgungChiaSe),
                Nut("Thêm qua Local Port", Ic.Them, Tone.Tim, ThemLocalPort),
                Nut("Kết nối máy in mạng", Ic.Mang, Tone.Ngoc, KetNoiMayInMang),
                Nut("In trang thử", Ic.TaiLieu, Tone.XanhLa, InThu),
                Nut("Mở hàng đợi in", Ic.Hen, Tone.Xam, () => { string t = TenChon(); if (t != null) HeThong.Mo("rundll32.exe", "printui.dll,PrintUIEntry /o /n " + HeThong.Nhay(t)); }),
                Nut("Thuộc tính máy in", Ic.CaiDat, Tone.Xam, () => { string t = TenChon(); if (t != null) HeThong.Mo("rundll32.exe", "printui.dll,PrintUIEntry /p /n " + HeThong.Nhay(t)); }),
                Nut("Xóa sạch máy in", Ic.Xoa, Tone.Do, XoaSach));
            nutTrai.Dock = DockStyle.Bottom;

            Ui.ThemDuoi(trai, dau);
            Ui.ThemDuoi(trai, Ui.Khoang(6));
            trai.Controls.Add(nutTrai);
            nutTrai.BringToFront();
            var khe = Ui.Khoang(8);
            khe.Dock = DockStyle.Bottom;
            trai.Controls.Add(khe);
            khe.BringToFront();
            Ui.ThemFill(trai, luoi);

            // ---- phải: sửa mã lỗi ----
            var cuon = new Panel { AutoScroll = true, Margin = Ui.Pad(6, 0, 0, 0), Padding = new Padding(0, 0, Ui.S(4), 0) };
            TheBo phai = TheBo.TuCao();
            Ui.ThemDuoi(phai, new TieuDe("Khắc phục mã lỗi & tiện ích sửa máy in LAN", Ic.SuaChua, Tone.Xanh));
            Ui.ThemDuoi(phai, new DoanVan("Máy này: " + HeThong.TenWindows() + ". Tích các mã lỗi đang gặp rồi bấm Sửa; rê chuột lên mã lỗi để xem nguyên nhân.",
                Ui.ChuPhu, Ui.Nho));
            Ui.ThemDuoi(phai, Ui.Khoang(6));
            Ui.ThemDuoi(phai, TaoCotLoi());
            Ui.ThemDuoi(phai, Ui.Khoang(8));
            var sua = new NutBo("Sửa các mã lỗi đã chọn (tích ở trên)", Ic.SuaChua, Tone.Xanh, true);
            sua.Click += (s, e) => SuaLoiDaChon();
            sua.Margin = Ui.Pad(4);
            Ui.ThemDuoi(phai, Ui.Luoi(1, sua));
            Ui.ThemDuoi(phai, Ui.Khoang(6));
            Ui.ThemDuoi(phai, new GhiChu("Lưu ý: các bản sửa nới lỏng bảo mật in ấn của Windows (bản vá PrintNightmare) để máy cũ / máy mới kết nối được với nhau — " +
                "chỉ dùng trong mạng nội bộ tin cậy. Nút \"Khôi phục bảo mật mặc định\" đưa mọi thứ về như cũ.", Tone.Vang));
            Ui.ThemDuoi(phai, Ui.Khoang(8));
            Ui.ThemDuoi(phai, Ui.Luoi(2,
                Nut("Fix Spooler Services", Ic.LamMoi, Tone.XanhLa, () => ChayBuoc("Fix Print Spooler", false, SuaLoi.Spooler)),
                Nut("Cài lại Print to PDF", Ic.TaiLieu, Tone.Xanh, CaiPrintToPdf),
                Nut("Sửa lỗi đặt mặc định 0x709", Ic.Sao, Tone.Vang, SuaMacDinh709),
                Nut("Fix không cài được driver", Ic.ThietBi, Tone.Tim, () => ChayBuoc("Fix không cài được driver máy in", false, SuaLoi.PointAndPrint, SuaLoi.RpcNamedPipe, SuaLoi.Spooler)),
                Nut("Sao lưu máy in & driver", Ic.Luu, Tone.Ngoc, SaoLuuMayIn),
                Nut("Phục hồi máy in đã sao lưu", Ic.KhoiPhuc, Tone.Ngoc, PhucHoiMayIn),
                Nut("Quản lý driver máy in", Ic.CaiDat, Tone.Xam, () => HeThong.Mo("rundll32.exe", "printui.dll,PrintUIEntry /s /t2")),
                Nut("Printers & scanners", Ic.MayIn, Tone.Xam, () => HeThong.Mo("ms-settings:printers"))));
            Ui.ThemDuoi(phai, Ui.Khoang(4));
            var motCham = new NutBo("One Click: sửa tất cả lỗi máy in LAN", Ic.Chay, Tone.Cam, true);
            motCham.Click += (s, e) => MotCham();
            var hoanTac = new NutBo("Khôi phục bảo mật mặc định", Ic.Khien, Tone.Do, false);
            hoanTac.Click += (s, e) =>
            {
                if (Ui.Hoi(CuaSo, "Đưa các thiết lập bảo mật in ấn về mặc định của Microsoft?\n\n" + SuaLoi.HoanTacMayIn.MoTa))
                    ChayBuoc("Khôi phục bảo mật in ấn", true, SuaLoi.HoanTacMayIn);
            };
            Ui.ThemDuoi(phai, Ui.Luoi(2, motCham, hoanTac));
            Ui.ThemDuoi(cuon, phai);

            bang.Controls.Add(trai, 0, 0);
            bang.Controls.Add(cuon, 1, 0);
            trai.Dock = DockStyle.Fill;
            cuon.Dock = DockStyle.Fill;
            Ui.ThemFill(this, bang);
        }

        static NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        Control TaoCotLoi()
        {
            var cot = new[] { TheBo.TuCao(), TheBo.TuCao(), TheBo.TuCao() };
            string[] ten = { "Máy trạm", "Máy chủ", "Cả 2 máy" };
            Tone[] tone = { Tone.Xanh, Tone.Cam, Tone.Tim };
            for (int i = 0; i < 3; i++)
            {
                cot[i].BackColor = Ui.The2;
                cot[i].Padding = Ui.Pad(8, 8, 8, 8);
                cot[i].Margin = Ui.Pad(3);
                NutBo vien = NutBo.VienNhan(ten[i], Ic.ManHinh, tone[i], false);
                vien.Height = Ui.S(32);
                Ui.ThemDuoi(cot[i], vien);
                Ui.ThemDuoi(cot[i], Ui.Khoang(4));
            }
            foreach (LoiMau l in SuaLoi.LoiMayIn())
            {
                int i = (int)l.Noi;
                CheckBox c = Ui.Hop(l.Ma, false);
                c.Font = Ui.Dam;
                c.Tag = l;
                c.Height = Ui.S(28);
                c.AutoSize = false;
                tip.SetToolTip(c, l.TieuDe + "\n\nNguyên nhân: " + l.NguyenNhan + "\n\nSẽ thực hiện:\n" + TrangMayIn.MoTaBuoc(l.Buoc));
                hopLoi.Add(c);
                Ui.ThemDuoi(cot[i], c);
            }
            var luoiCot = new TableLayoutPanel { ColumnCount = 3, RowCount = 1, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink };
            for (int i = 0; i < 3; i++)
            {
                luoiCot.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.33f));
                cot[i].Dock = DockStyle.Fill;
                luoiCot.Controls.Add(cot[i], i, 0);
            }
            luoiCot.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            return luoiCot;
        }

        protected override void KhiHienLanDau()
        {
            NapMayIn();
        }

        // ---------------- danh sách máy in ----------------

        class MayIn
        {
            public string Ten, Cong, Driver, TrangThai, ChiaSe;
            public bool MacDinh;
        }

        void NapMayIn()
        {
            TacVu.Nen(this, () =>
            {
                var ds = new List<MayIn>();
                foreach (ManagementObject o in HeThong.Wmi("SELECT Name, PortName, DriverName, PrinterStatus, WorkOffline, Shared, ShareName, Default FROM Win32_Printer"))
                {
                    bool chiaSe = o["Shared"] is bool && (bool)o["Shared"];
                    ds.Add(new MayIn
                    {
                        Ten = HeThong.S(o, "Name"),
                        Cong = HeThong.S(o, "PortName"),
                        Driver = HeThong.S(o, "DriverName"),
                        TrangThai = TrangThai(o),
                        ChiaSe = chiaSe ? HeThong.S(o, "ShareName") : "",
                        MacDinh = o["Default"] is bool && (bool)o["Default"]
                    });
                }
                ds.Sort((a, b) => string.Compare(a.Ten, b.Ten, StringComparison.CurrentCultureIgnoreCase));
                return ds;
            }, ds =>
            {
                luoi.Rows.Clear();
                foreach (MayIn m in ds)
                {
                    int r = luoi.Rows.Add(m.Ten, m.Cong, m.Driver, m.TrangThai, m.ChiaSe, m.MacDinh ? "✔" : "");
                    luoi.Rows[r].Tag = m.Ten;
                    if (m.TrangThai == "Ngoại tuyến" || m.TrangThai == "Dừng in") luoi.Rows[r].Cells[3].Style.ForeColor = Ui.Loi;
                }
                NhatKy.Chung.Ghi("Tìm thấy " + ds.Count + " máy in.");
            });
        }

        static string TrangThai(ManagementBaseObject o)
        {
            if (o["WorkOffline"] is bool && (bool)o["WorkOffline"]) return "Ngoại tuyến";
            switch (HeThong.L(o, "PrinterStatus"))
            {
                case 3: return "Bình thường";
                case 4: return "Đang in";
                case 5: return "Đang khởi động";
                case 6: return "Dừng in";
                case 7: return "Ngoại tuyến";
                default: return "Không rõ";
            }
        }

        string TenChon()
        {
            if (luoi.CurrentRow == null)
            {
                Ui.BaoTin(CuaSo, "Chọn 1 máy in trong bảng trước.");
                return null;
            }
            return luoi.CurrentRow.Tag as string;
        }

        static string Wql(string s)
        {
            return s.Replace("\\", "\\\\").Replace("'", "\\'");
        }

        static void GoiWmiMayIn(NhatKy log, string ten, string phuongThuc)
        {
            foreach (ManagementObject o in HeThong.Wmi("SELECT * FROM Win32_Printer WHERE Name = '" + Wql(ten) + "'"))
            {
                object kq = o.InvokeMethod(phuongThuc, null);
                int ma = kq == null ? 0 : Convert.ToInt32(kq);
                if (ma == 0) log.Tot(phuongThuc + ": " + ten);
                else log.Loi(phuongThuc + " lỗi, mã " + ma);
                return;
            }
            log.Loi("Không tìm thấy máy in " + ten);
        }

        void ChayBuoc(string ten, bool napLai, params Buoc[] buoc)
        {
            TacVu.Chay(ten, log => SuaLoi.ChayCacBuoc(log, buoc), napLai ? (Action)NapMayIn : null);
        }

        void DatMacDinh()
        {
            string t = TenChon();
            if (t == null) return;
            TacVu.Chay("Đặt máy in mặc định", log =>
            {
                SuaLoi.MacDinhCu.Lam(log);
                GoiWmiMayIn(log, t, "SetDefaultPrinter");
            }, NapMayIn);
        }

        void SuaMacDinh709()
        {
            string t = luoi.CurrentRow != null ? luoi.CurrentRow.Tag as string : null;
            TacVu.Chay("Sửa lỗi đặt mặc định 0x709", log =>
            {
                SuaLoi.MacDinhCu.Lam(log);
                SuaLoi.RpcNamedPipe.Lam(log);
                if (t != null) GoiWmiMayIn(log, t, "SetDefaultPrinter");
                else log.Ghi("Chưa chọn máy in: chỉ sửa thiết lập, hãy đặt mặc định lại sau.");
            }, NapMayIn);
        }

        void InThu()
        {
            string t = TenChon();
            if (t == null) return;
            TacVu.Chay("In trang thử", log => GoiWmiMayIn(log, t, "PrintTestPage"));
        }

        void ChiaSeMayIn()
        {
            string t = TenChon();
            if (t == null) return;
            var sb = new StringBuilder();
            foreach (char c in t) if (char.IsLetterOrDigit(c) || c == '-' || c == '_') sb.Append(c);
            string goiY = sb.Length > 0 ? sb.ToString() : "MayIn";
            if (goiY.Length > 30) goiY = goiY.Substring(0, 30);
            string[] kq = FormNhap.Hien(CuaSo, "Chia sẻ máy in trong mạng LAN",
                "Máy in: " + t + "\nNên đặt tên chia sẻ ngắn, không dấu, không khoảng trắng. Phần mềm cũng bật tường lửa, dịch vụ chia sẻ và chuyển mạng sang Private.",
                "Chia sẻ", TruongNhap.Chu("Tên chia sẻ", goiY, true));
            if (kq == null) return;
            string ten = kq[0];
            TacVu.Chay("Chia sẻ máy in " + t, log =>
            {
                SuaLoi.TuongLua.Lam(log);
                HeThong.KieuDichVu(log, "LanmanServer", "auto");
                HeThong.BatDichVu(log, "LanmanServer");
                HeThong.ChayPS(log, "Set-Printer -Name " + HeThong.Ps(t) + " -Shared $true -ShareName " + HeThong.Ps(ten) +
                                    "\r\nWrite-Output 'Đã chia sẻ máy in.'");
                HeThong.MoTuongLuaChiaSe(log);
                HeThong.MangRiengTu(log);
                log.Tot("Máy trạm kết nối bằng đường dẫn:  \\\\" + Environment.MachineName + "\\" + ten);
            }, NapMayIn);
        }

        void NgungChiaSe()
        {
            string t = TenChon();
            if (t == null) return;
            TacVu.Chay("Ngừng chia sẻ máy in", log => HeThong.ChayPS(log, "Set-Printer -Name " + HeThong.Ps(t) + " -Shared $false\r\nWrite-Output 'Đã ngừng chia sẻ.'"), NapMayIn);
        }

        static string[] DanhSachDriver()
        {
            var ds = new List<string>();
            foreach (ManagementObject o in HeThong.Wmi("SELECT Name FROM Win32_PrinterDriver"))
            {
                string ten = HeThong.S(o, "Name");
                int i = ten.IndexOf(',');
                if (i > 0) ten = ten.Substring(0, i);
                if (ten.Length > 0 && !ds.Contains(ten)) ds.Add(ten);
            }
            ds.Sort(StringComparer.CurrentCultureIgnoreCase);
            return ds.ToArray();
        }

        void ThemLocalPort()
        {
            Cursor = Cursors.WaitCursor;
            string[] driver;
            try { driver = DanhSachDriver(); }
            finally { Cursor = Cursors.Default; }
            var duongDan = TruongNhap.Chu("Đường dẫn máy in", "\\\\", true);
            duongDan.GoiY = "\\\\MAYCHU\\TenChiaSe hoặc \\\\192.168.1.10\\TenChiaSe";
            var chonDriver = new TruongNhap("Driver (đã cài ở máy này)", KieuTruong.ChonSua, "") { LuaChon = driver, BatBuoc = true };
            string[] kq = FormNhap.Hien(CuaSo, "Thêm máy in mạng qua Local Port",
                "Cách vượt lỗi 0x0000011b / 0x00000709 / 0x0000007c: tạo cổng Local Port trỏ tới máy in chia sẻ và dùng driver cài sẵn ở máy trạm " +
                "(cài driver đúng hãng trước nếu chưa có). Nếu máy chủ đòi mật khẩu, lưu tài khoản ở tab Windows Credentials.",
                "Thêm máy in", duongDan, chonDriver, TruongNhap.Chu("Tên hiển thị", "", false));
            if (kq == null) return;
            string cong = kq[0].TrimEnd('\\'), drv = kq[1], ten = kq[2].Length > 0 ? kq[2] : cong.TrimStart('\\').Replace('\\', ' ');
            if (!cong.StartsWith("\\\\") || cong.IndexOf('\\', 2) < 0)
            {
                Ui.BaoLoi(CuaSo, "Đường dẫn phải có dạng \\\\MAYCHU\\TenChiaSe");
                return;
            }
            TacVu.Chay("Thêm máy in qua Local Port", log =>
            {
                HeThong.ChayPS(log,
                    "$cong = " + HeThong.Ps(cong) + "\r\n" +
                    "if (-not (Get-PrinterPort -Name $cong -ErrorAction SilentlyContinue)) {\r\n" +
                    "  try { Add-PrinterPort -Name $cong -ErrorAction Stop; Write-Output ('Đã tạo cổng ' + $cong) }\r\n" +
                    "  catch {\r\n" +
                    "    New-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Ports' -Name $cong -Value '' -PropertyType String -Force | Out-Null\r\n" +
                    "    Restart-Service Spooler -Force; Start-Sleep -Seconds 2\r\n" +
                    "    Write-Output ('Đã tạo cổng ' + $cong + ' (qua registry)') } }\r\n" +
                    "Add-Printer -Name " + HeThong.Ps(ten) + " -DriverName " + HeThong.Ps(drv) + " -PortName $cong -ErrorAction Stop\r\n" +
                    "Write-Output ('Đã thêm máy in ' + " + HeThong.Ps(ten) + ")");
            }, NapMayIn);
        }

        void KetNoiMayInMang()
        {
            var duongDan = TruongNhap.Chu("Đường dẫn máy in", "\\\\", true);
            duongDan.GoiY = "\\\\MAYCHU\\TenChiaSe";
            string[] kq = FormNhap.Hien(CuaSo, "Kết nối máy in chia sẻ (Point and Print)",
                "Lấy driver trực tiếp từ máy chủ. Nếu báo lỗi 0x11b / 0xbc4 / 0x709, hãy sửa mã lỗi tương ứng hoặc dùng \"Thêm qua Local Port\".",
                "Kết nối", duongDan);
            if (kq == null) return;
            string p = kq[0].TrimEnd('\\');
            TacVu.Chay("Kết nối máy in " + p, log =>
                HeThong.ChayPS(log, "Add-Printer -ConnectionName " + HeThong.Ps(p) + " -ErrorAction Stop\r\nWrite-Output 'Đã kết nối máy in.'"), NapMayIn);
        }

        void XoaSach()
        {
            string t = TenChon();
            if (t == null) return;
            if (!Ui.HoiCanhBao(CuaSo, "Xóa hẳn máy in \"" + t + "\"?\n\nSẽ xóa máy in, driver (nếu không còn máy in nào dùng) và cổng riêng của nó.")) return;
            TacVu.Chay("Xóa sạch máy in", log => HeThong.ChayPS(log, @"
$ten = " + HeThong.Ps(t) + @"
$p = Get-Printer -Name $ten -ErrorAction SilentlyContinue
if (-not $p) { Write-Output 'Không tìm thấy máy in.'; exit 1 }
$drv = $p.DriverName; $cong = $p.PortName
Remove-Printer -Name $ten
Write-Output ('Đã xóa máy in ' + $ten)
if ($drv -and -not (Get-Printer | Where-Object { $_.DriverName -eq $drv })) {
  Restart-Service Spooler -Force; Start-Sleep -Seconds 2
  try { Remove-PrinterDriver -Name $drv -RemoveFromDriverStore -ErrorAction Stop; Write-Output ('Đã xóa driver ' + $drv) }
  catch { try { Remove-PrinterDriver -Name $drv -ErrorAction Stop; Write-Output ('Đã xóa driver ' + $drv) } catch { Write-Output ('Chưa xóa được driver (đang dùng): ' + $drv) } }
}
if ($cong -and $cong -notmatch '^(PORTPROMPT:|FILE:|nul:|LPT\d:|COM\d:|USB\d+|SHRFAX:|PDF:)' -and -not (Get-Printer | Where-Object { $_.PortName -eq $cong })) {
  Remove-PrinterPort -Name $cong -ErrorAction SilentlyContinue
  Write-Output ('Đã xóa cổng ' + $cong)
}"), NapMayIn);
        }

        void CaiPrintToPdf()
        {
            TacVu.Chay("Cài lại Microsoft Print to PDF", log =>
            {
                string dism = HeThong.Exe("dism.exe");
                HeThong.Chay(log, dism, "/online /disable-feature /featurename:Printing-PrintToPDFServices-Features /norestart");
                int ma = HeThong.Chay(log, dism, "/online /enable-feature /featurename:Printing-PrintToPDFServices-Features /all /norestart");
                if (ma != 0 && ma != 3010) throw new LoiTacVu("DISM báo lỗi " + ma);
            }, NapMayIn);
        }

        static string PrintBrm { get { return Path.Combine(HeThong.Sys32, @"spool\tools\PrintBrm.exe"); } }

        void SaoLuuMayIn()
        {
            using (var d = new SaveFileDialog
            {
                Filter = "Bản sao lưu máy in (*.printerExport)|*.printerExport",
                FileName = "MayIn_" + Environment.MachineName + "_" + DateTime.Now.ToString("yyyy-MM-dd") + ".printerExport"
            })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                string tep = d.FileName;
                TacVu.Chay("Sao lưu máy in & driver", log =>
                {
                    if (File.Exists(tep)) File.Delete(tep);
                    int ma = HeThong.Chay(log, PrintBrm, "-B -F " + HeThong.Nhay(tep));
                    if (ma != 0) throw new LoiTacVu("PrintBrm báo lỗi " + ma);
                    log.Tot("Đã lưu: " + tep);
                });
            }
        }

        void PhucHoiMayIn()
        {
            using (var d = new OpenFileDialog { Filter = "Bản sao lưu máy in (*.printerExport)|*.printerExport" })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                string tep = d.FileName;
                TacVu.Chay("Phục hồi máy in", log =>
                {
                    int ma = HeThong.Chay(log, PrintBrm, "-R -O FORCE -F " + HeThong.Nhay(tep));
                    if (ma != 0) throw new LoiTacVu("PrintBrm báo lỗi " + ma);
                }, NapMayIn);
            }
        }

        void SuaLoiDaChon()
        {
            var chon = new List<LoiMau>();
            foreach (CheckBox c in hopLoi) if (c.Checked) chon.Add((LoiMau)c.Tag);
            if (chon.Count == 0)
            {
                Ui.BaoTin(CuaSo, "Tích ít nhất 1 mã lỗi ở các cột Máy trạm / Máy chủ / Cả 2 máy.");
                return;
            }
            List<Buoc> buoc = SuaLoi.Gop(chon);
            var ma = new List<string>();
            foreach (LoiMau l in chon) ma.Add(l.Ma);
            if (!Ui.Hoi(CuaSo, "Sửa lỗi: " + string.Join(", ", ma.ToArray()) + "\n\nSẽ thực hiện:\n" + TrangMayIn.MoTaBuoc(buoc))) return;
            TacVu.Chay("Sửa mã lỗi máy in", log => SuaLoi.ChayCacBuoc(log, buoc), () =>
            {
                foreach (CheckBox c in hopLoi) c.Checked = false;
                NapMayIn();
            });
        }

        void MotCham()
        {
            Buoc[] buoc = SuaLoi.MotChamTatCa();
            if (!Ui.Hoi(CuaSo, "Sửa tất cả lỗi máy in / mạng LAN thường gặp (chạy được trên cả máy chủ và máy trạm).\n\nSẽ thực hiện:\n" +
                               TrangMayIn.MoTaBuoc(buoc))) return;
            TacVu.Chay("One Click: sửa tất cả lỗi máy in LAN", log => SuaLoi.ChayCacBuoc(log, buoc), () =>
            {
                NapMayIn();
                Ui.HoiKhoiDongLai(CuaSo);
            });
        }
    }

    /// <summary>Cửa sổ chi tiết 1 lỗi: hình mô phỏng, nguyên nhân, các bước sẽ làm, nút sửa ngay.</summary>
    public class ChiTietLoi : Form
    {
        ChiTietLoi(LoiMau l)
        {
            Text = "Lỗi: " + l.TieuDe;
            Font = Ui.Base;
            BackColor = Ui.The;
            ForeColor = Ui.Chu;
            AutoScaleMode = AutoScaleMode.None;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            ClientSize = new Size(Ui.S(640), Ui.S(560));
            Padding = Ui.Pad(20, 16, 20, 16);

            var td = new TieuDe("Lỗi " + l.TieuDe, Ic.Loi, Tone.Do) { Height = Ui.S(34) };
            var hinh = new HopLoiMau(l.CuaSo, l.ThongBao) { Height = Ui.S(210), Cursor = Cursors.Default };
            string noi = l.Noi == NoiSua.MayChu ? "MÁY CHỦ (máy cắm máy in / có thư mục chia sẻ)"
                : l.Noi == NoiSua.MayTram ? "MÁY TRẠM (máy kết nối tới máy chủ)" : "cả máy chủ và máy trạm";
            string buoc = l.HanhDongRieng != null ? "Mở hộp thoại để chọn thư mục và tài khoản cần cấp quyền.\n" : TrangMayIn.MoTaBuoc(l.Buoc);
            var mt = new DoanVan("Mã lỗi: " + l.Ma + "\nChạy trên: " + noi + "\n\nNguyên nhân: " + l.NguyenNhan + "\n\nSẽ thực hiện:\n" + buoc +
                                 (l.CanKhoiDongLai ? "\nCần khởi động lại máy sau khi sửa." : ""), Ui.Chu, Ui.Base);

            var hang = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(46), Dock = DockStyle.Bottom };
            var dong = NutBo.Phu("Đóng", Ic.Huy);
            dong.AutoSize = true;
            dong.DialogResult = DialogResult.Cancel;
            var sua = new NutBo("Sửa lỗi này ngay", Ic.SuaChua, Tone.Xanh, true) { AutoSize = true, DialogResult = DialogResult.OK };
            hang.Controls.Add(dong);
            hang.Controls.Add(sua);

            Ui.ThemDuoi(this, td);
            Ui.ThemDuoi(this, Ui.Khoang(6));
            Ui.ThemDuoi(this, hinh);
            Ui.ThemDuoi(this, Ui.Khoang(10));
            Ui.ThemDuoi(this, mt);
            Controls.Add(hang);
            AcceptButton = sua;
            CancelButton = dong;
            Load += (s, e) =>
            {
                // cao vừa đủ nội dung (không vượt 90% màn hình)
                PerformLayout();
                int can = mt.Bottom + Ui.S(10) + hang.Height + Padding.Bottom;
                int toiDa = (int)(Screen.FromControl(this).WorkingArea.Height * 0.9);
                ClientSize = new Size(ClientSize.Width, Math.Min(toiDa, can));
                CenterToParent();
            };
        }

        public static bool Hien(IWin32Window chu, LoiMau l)
        {
            using (var f = new ChiTietLoi(l)) return f.ShowDialog(chu) == DialogResult.OK;
        }
    }
}
