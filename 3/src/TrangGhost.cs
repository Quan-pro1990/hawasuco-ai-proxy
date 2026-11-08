using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>1 phân vùng ổ cứng (số đĩa / số phân vùng theo Windows).</summary>
    public class PhanVung
    {
        public int Dia, So;
        public string Chu = "", Nhan = "", DinhDang = "", Loai = "", Bus = "", TenDia = "";
        public long KichThuoc, ConTrong, DiaKichThuoc;
        public bool LaWindows, LaHeThong;

        public long DaDung { get { return Math.Max(0, KichThuoc - ConTrong); } }

        public string MoTa()
        {
            return "Disk " + Dia + " - Partition " + So + (Chu.Length > 0 ? " (" + Chu + ":" : " (") +
                   (Nhan.Length > 0 ? " " + Nhan : "") + ", " + HeThong.Gb(KichThuoc) + ")";
        }
    }

    /// <summary>Trang Ghost - Acronis: sao lưu / bung tệp .gho (Ghost) và .tib (Acronis True Image).</summary>
    public class TrangGhost : TrangCuon
    {
        readonly TextBox oGhost, oAcronis, oAnh;
        readonly DataGridView luoi;
        readonly DoanVan dvChon, dvTam;
        readonly RadioButton rSaoLuu, rBung;
        readonly ComboBox chonNen, chonPvAnh;
        readonly CheckBox hopTuDong, hopKiemTra;

        static string ThuMucApp { get { return Path.GetDirectoryName(Application.ExecutablePath); } }

        public TrangGhost()
        {
            // ---- công cụ ----
            TheBo cc = TheBo.TuCao();
            Ui.ThemDuoi(cc, new TieuDe("Công cụ Ghost / Acronis của bạn", Ic.CaiDat, Tone.Xam));
            Ui.ThemDuoi(cc, new DoanVan(".gho và .tib là định dạng riêng của Symantec/Broadcom Ghost và Acronis True Image — chỉ chính các phần mềm đó " +
                "đọc / ghi được. IT Toolkit không kèm sẵn (phần mềm có bản quyền); chọn tệp của bạn, hoặc đặt ghost64.exe vào thư mục Tools cạnh ITToolkit.exe để tự nhận."));
            TableLayoutPanel bang = Ui.BangNhap();
            oGhost = Ui.O("ghost64.exe (bản 64-bit, chạy được trong WinPE)");
            oGhost.Text = CaiDat.Lay("ghost", "");
            if (!File.Exists(oGhost.Text)) oGhost.Text = TimGhost() ?? "";
            oAcronis = Ui.O("TrueImageLauncher.exe / TrueImage.exe");
            oAcronis.Text = CaiDat.Lay("acronis", "");
            if (!File.Exists(oAcronis.Text)) oAcronis.Text = TimAcronis() ?? "";
            Ui.DongNhap(bang, "Ghost", Ui.HangNgang(oGhost, NutChonTep(oGhost, "ghost", "Ghost (ghost64.exe)|ghost64.exe;ghost*.exe|Chương trình (*.exe)|*.exe")));
            Ui.DongNhap(bang, "Acronis True Image", Ui.HangNgang(oAcronis, NutChonTep(oAcronis, "acronis", "Chương trình (*.exe)|*.exe")));
            Ui.ThemDuoi(cc, bang);
            Them(cc);

            // ---- phân vùng ----
            TheBo pv = TheBo.TuCao();
            Ui.ThemDuoi(pv, new TieuDe("Phân vùng trên máy", Ic.O, Tone.Ngoc));
            luoi = Ui.TaoLuoi(false, "Ổ đĩa", "PV", "Ổ", "Nhãn", "Định dạng", "Dung lượng", "Đã dùng", "Ghi chú");
            luoi.Columns[0].FillWeight = 170;
            luoi.Columns[1].FillWeight = 35;
            luoi.Columns[2].FillWeight = 35;
            luoi.Columns[7].FillWeight = 130;
            luoi.Height = Ui.S(210);
            luoi.SelectionChanged += (s, e) => CapNhatChon();
            Ui.ThemDuoi(pv, luoi);
            Ui.ThemDuoi(pv, Ui.Khoang(8));
            Ui.ThemDuoi(pv, Ui.Luoi(4,
                Nut("Làm mới", Ic.LamMoi, Tone.Xanh, false, Nap),
                Nut("Disk Management", Ic.O, Tone.Xam, false, () => HeThong.Mo("diskmgmt.msc")),
                null, null));
            Them(pv);

            // ---- Ghost ----
            TheBo gh = TheBo.TuCao();
            Ui.ThemDuoi(gh, new TieuDe("Ghost: sao lưu / bung tệp .gho (không cần USB boot)", Ic.KhoiPhuc, Tone.Cam));
            Ui.ThemDuoi(gh, new DoanVan("Bấm nút → phần mềm dựng WinPE từ Windows RE có sẵn của máy, chép ghost64.exe vào, khởi động lại 1 lần vào WinPE để Ghost " +
                "làm việc (kể cả với ổ Windows đang chạy), xong tự về Windows. Tệp .gho phải nằm ở phân vùng KHÁC phân vùng cần sao lưu / bung; " +
                "đường dẫn tệp chỉ dùng chữ không dấu, không khoảng trắng (vd D:\\Ghost\\Win10.gho)."));
            TableLayoutPanel b2 = Ui.BangNhap();
            rSaoLuu = Ui.Chon1("Sao lưu phân vùng → tệp .gho", true);
            rBung = Ui.Chon1("Bung tệp .gho → phân vùng", false);
            rSaoLuu.CheckedChanged += (s, e) => CapNhatChon();
            Ui.DongNhap(b2, "Thao tác", Ui.Dong(rSaoLuu, rBung));
            dvChon = new DoanVan("Chọn 1 phân vùng trong bảng trên.", Ui.Chu, Ui.Dam);
            Ui.DongNhap(b2, "Phân vùng", dvChon);
            oAnh = Ui.O("vd D:\\Ghost\\Win10.gho");
            var chonAnh = NutBo.Phu("Chọn...", Ic.ThuMuc);
            chonAnh.AutoSize = true;
            chonAnh.Margin = Ui.Pad(6, 2, 0, 2);
            chonAnh.Click += (s, e) => ChonTepAnh();
            Ui.DongNhap(b2, "Tệp .gho", Ui.HangNgang(oAnh, chonAnh));
            chonNen = Ui.HopChon("Nhanh (-z1)", "Vừa — khuyên dùng (-z3)", "Cao, chậm (-z9)");
            chonNen.SelectedIndex = 1;
            chonPvAnh = Ui.HopChon("1", "2", "3", "4");
            Ui.DongNhap(b2, "Nén (sao lưu)", chonNen);
            Ui.DongNhap(b2, "Phân vùng trong tệp (bung)", chonPvAnh);
            Ui.ThemDuoi(gh, b2);
            hopKiemTra = Ui.Hop("Kiểm tra tệp .gho sau khi sao lưu", true);
            hopTuDong = Ui.Hop("Tự động chạy lệnh Ghost (không cần chọn tay)", false);
            Ui.ThemDuoi(gh, Ui.Dong(hopKiemTra, hopTuDong));
            Ui.ThemDuoi(gh, new GhiChu("Mặc định WinPE mở Ghost kèm hướng dẫn chọn đúng ổ / phân vùng (an toàn nhất). Chế độ tự động truyền số Disk:Partition cho Ghost; " +
                "WinPE kiểm tra lại số này bằng diskpart, không khớp thì quay về chọn tay, khi bung Ghost vẫn hỏi xác nhận lần cuối. " +
                "Cách Ghost đánh số phân vùng có thể khác Windows ở ổ có phân vùng logical / MSR — hãy thử chế độ chọn tay trước trên loại máy đó.", Tone.Vang));
            Ui.ThemDuoi(gh, Ui.Khoang(8));
            Ui.ThemDuoi(gh, Ui.Luoi(4,
                Nut("Chuẩn bị & khởi động lại vào WinPE", Ic.Chay, Tone.Cam, true, () => ChayGhost(true)),
                Nut("Chỉ chuẩn bị (khởi động lại sau)", Ic.Hen, Tone.Cam, false, () => ChayGhost(false)),
                Nut("Hủy lịch / dọn tệp WinPE", Ic.Xoa, Tone.Xam, false, Huy),
                null));
            dvTam = new DoanVan("", Ui.CanhChu, Ui.Nho);
            Ui.ThemDuoi(gh, dvTam);
            Them(gh);

            // ---- tiện ích Ghost trong Windows ----
            TheBo ti = TheBo.TuCao();
            Ui.ThemDuoi(ti, new TieuDe("Tiện ích Ghost ngay trong Windows", Ic.TaiLieu, Tone.Tim));
            Ui.ThemDuoi(ti, Ui.Luoi(4,
                Nut("Kiểm tra tệp .gho (-chkimg)", Ic.Dung, Tone.Tim, false, KiemTraGho),
                Nut("Ghost Explorer (lấy tệp lẻ trong .gho)", Ic.ThuMuc, Tone.Tim, false, MoGhostExplorer),
                Nut("Mở Ghost", Ic.Chay, Tone.Xam, false, () => { string g = Ghost(); if (g != null) HeThong.Mo(g); }),
                null));
            Them(ti);

            // ---- Acronis ----
            TheBo ac = TheBo.TuCao();
            Ui.ThemDuoi(ac, new TieuDe("Acronis True Image: tệp .tib / .tibx", Ic.KhoiPhuc, Tone.Xanh));
            Ui.ThemDuoi(ac, new DoanVan("Acronis đã cài trên máy tự lo phần khó: khi phục hồi ổ Windows đang chạy, nó tự khởi động lại vào môi trường riêng để bung. " +
                "Mở tệp .tib để bung toàn bộ, bung từng tệp hoặc xem nội dung; sao lưu bằng mục Backup của Acronis. " +
                "Máy chưa cài Acronis: dùng WinPE có Acronis (tạo bằng Acronis Media Builder → WinPE-based) ở thẻ bên dưới."));
            Ui.ThemDuoi(ac, Ui.Luoi(4,
                Nut("Mở / bung tệp .tib...", Ic.KhoiPhuc, Tone.Xanh, true, MoTib),
                Nut("Mở Acronis True Image", Ic.Chay, Tone.Xanh, false, () => { string a = Acronis(); if (a != null) HeThong.Mo(a); }),
                null, null));
            Them(ac);

            // ---- WinPE của bạn ----
            TheBo pe = TheBo.TuCao();
            Ui.ThemDuoi(pe, new TieuDe("Khởi động 1 lần vào WinPE cứu hộ của bạn (không cần USB)", Ic.Usb, Tone.Tim));
            Ui.ThemDuoi(pe, new DoanVan("Chọn tệp .wim (hoặc .iso có sources\\boot.wim) của WinPE bạn có: Acronis WinPE media, Hiren's BootCD PE... " +
                "Máy nạp WinPE vào RAM ở lần khởi động tới; lần sau nữa tự về Windows. WinPE chưa ký số của Microsoft có thể bị Secure Boot chặn."));
            Ui.ThemDuoi(pe, Ui.Luoi(4,
                Nut("Chọn .wim / .iso & khởi động lại", Ic.Chay, Tone.Tim, true, () => PECuaBan(true)),
                Nut("Chỉ chuẩn bị (khởi động lại sau)", Ic.Hen, Tone.Tim, false, () => PECuaBan(false)),
                Nut("Hủy lịch / dọn tệp WinPE", Ic.Xoa, Tone.Xam, false, Huy),
                null));
            Them(pe);
        }

        static NutBo Nut(string ten, string icon, Tone tone, bool dac, Action lam)
        {
            var b = new NutBo(ten, icon, tone, dac);
            b.Click += (s, e) => lam();
            return b;
        }

        NutBo NutChonTep(TextBox o, string khoa, string loc)
        {
            var b = NutBo.Phu("Chọn...", Ic.ThuMuc);
            b.AutoSize = true;
            b.Margin = Ui.Pad(6, 2, 0, 2);
            b.Click += (s, e) =>
            {
                using (var d = new OpenFileDialog { Filter = loc })
                {
                    if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                    o.Text = d.FileName;
                    CaiDat.Luu(khoa, d.FileName);
                }
            };
            o.Leave += (s, e) => CaiDat.Luu(khoa, o.Text.Trim());
            return b;
        }

        static string TimTrong(string[] ds)
        {
            foreach (string f in ds) if (File.Exists(f)) return f;
            return null;
        }

        static string TimGhost()
        {
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            return TimTrong(new[]
            {
                Path.Combine(ThuMucApp, @"Tools\ghost64.exe"), Path.Combine(ThuMucApp, @"Tools\Ghost\ghost64.exe"), Path.Combine(ThuMucApp, "ghost64.exe"),
                Path.Combine(pf86, @"Symantec\Ghost\ghost64.exe"), Path.Combine(pf, @"Symantec\Ghost\ghost64.exe")
            });
        }

        static string TimAcronis()
        {
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            return TimTrong(new[]
            {
                Path.Combine(pf86, @"Acronis\TrueImageHome\TrueImageLauncher.exe"), Path.Combine(pf, @"Acronis\TrueImageHome\TrueImageLauncher.exe"),
                Path.Combine(pf86, @"Acronis\TrueImageHome\TrueImage.exe"), Path.Combine(pf, @"Acronis\TrueImageHome\TrueImage.exe"),
                Path.Combine(ThuMucApp, @"Tools\Acronis\TrueImage.exe")
            });
        }

        string Ghost()
        {
            string g = oGhost.Text.Trim();
            if (File.Exists(g)) return g;
            Ui.BaoTin(CuaSo, "Chưa có ghost64.exe: bấm \"Chọn...\" ở thẻ Công cụ (hoặc đặt ghost64.exe vào thư mục Tools cạnh ITToolkit.exe).");
            return null;
        }

        string Acronis()
        {
            string a = oAcronis.Text.Trim();
            if (File.Exists(a)) return a;
            Ui.BaoTin(CuaSo, "Chưa tìm thấy Acronis True Image trên máy: cài Acronis hoặc bấm \"Chọn...\" ở thẻ Công cụ.");
            return null;
        }

        protected override void KhiHienLanDau() { Nap(); }

        protected override void KhiHien()
        {
            dvTam.Text = Directory.Exists(WinPE.ThuMuc)
                ? "Còn tệp WinPE tạm ở " + WinPE.ThuMuc + " — bấm \"Hủy lịch / dọn tệp WinPE\" khi không cần nữa."
                : "";
        }

        // ---------------- phân vùng ----------------

        const string SCRIPT_PV = @"
$ErrorActionPreference = 'SilentlyContinue'
foreach ($p in (Get-Partition | Sort-Object DiskNumber, PartitionNumber)) {
  $v = $p | Get-Volume
  $d = Get-Disk -Number $p.DiskNumber
  $chu = ''
  if ([string]$p.DriveLetter -match '^[A-Za-z]$') { $chu = ([string]$p.DriveLetter).ToUpper() }
  $f = @($p.DiskNumber, $p.PartitionNumber, $chu, ([string]$v.FileSystemLabel -replace '\|', '/'), $v.FileSystem, $p.Size, $v.SizeRemaining,
         $p.Type, $p.IsBoot, $p.IsSystem, $d.BusType, ([string]$d.FriendlyName -replace '\|', '/'), $d.Size)
  Write-Output ($f -join '|')
}";

        static long SoNguyen(string s)
        {
            long v;
            return long.TryParse(s, out v) ? v : 0;
        }

        void Nap()
        {
            TacVu.Nen(this, () =>
            {
                var ds = new List<PhanVung>();
                foreach (string dong in HeThong.KetQuaPS(SCRIPT_PV, 60000).Split('\n'))
                {
                    string[] p = dong.Trim().Split('|');
                    if (p.Length < 13) continue;
                    var v = new PhanVung
                    {
                        Dia = (int)SoNguyen(p[0]), So = (int)SoNguyen(p[1]), Chu = p[2], Nhan = p[3], DinhDang = p[4],
                        KichThuoc = SoNguyen(p[5]), ConTrong = SoNguyen(p[6]), Loai = p[7],
                        LaWindows = p[8].Equals("True", StringComparison.OrdinalIgnoreCase),
                        LaHeThong = p[9].Equals("True", StringComparison.OrdinalIgnoreCase),
                        Bus = p[10], TenDia = p[11], DiaKichThuoc = SoNguyen(p[12])
                    };
                    if (v.Chu.Length > 0 && v.Chu + ":" == WinPE.OHeThong.ToUpperInvariant()) v.LaWindows = true;
                    ds.Add(v);
                }
                return ds;
            }, ds =>
            {
                luoi.Rows.Clear();
                foreach (PhanVung v in ds)
                {
                    string ghiChu = v.LaWindows ? "Windows đang chạy"
                        : v.Loai == "System" ? "EFI / khởi động"
                        : v.Loai == "Reserved" ? "MSR (ẩn)"
                        : v.Loai == "Recovery" ? "Recovery"
                        : v.Loai == "Extended" ? "Extended"
                        : "";
                    if (v.Bus == "USB") ghiChu = (ghiChu + " USB").Trim();
                    int r = luoi.Rows.Add("Disk " + v.Dia + " - " + v.TenDia + " (" + HeThong.Gb(v.DiaKichThuoc) + ")", v.So,
                        v.Chu.Length > 0 ? v.Chu + ":" : "", v.Nhan, v.DinhDang, HeThong.Gb(v.KichThuoc),
                        v.DinhDang.Length > 0 ? HeThong.Gb(v.DaDung) : "", ghiChu);
                    luoi.Rows[r].Tag = v;
                    if (v.LaWindows) luoi.Rows[r].DefaultCellStyle.ForeColor = Ui.ChuChinh;
                    else if (v.Chu.Length == 0) luoi.Rows[r].DefaultCellStyle.ForeColor = Ui.ChuPhu;
                }
                if (ds.Count == 0) NhatKy.Chung.Canh("Không đọc được danh sách phân vùng.");
                CapNhatChon();
            });
        }

        PhanVung PvChon()
        {
            return luoi.CurrentRow != null ? luoi.CurrentRow.Tag as PhanVung : null;
        }

        void CapNhatChon()
        {
            PhanVung v = PvChon();
            dvChon.Text = v == null ? "Chọn 1 phân vùng trong bảng trên."
                : (rSaoLuu.Checked ? "Nguồn: " : "Đích (sẽ bị GHI ĐÈ): ") + v.MoTa() + (v.LaWindows ? " — Windows đang chạy" : "");
            dvChon.ForeColor = v != null && !rSaoLuu.Checked ? Ui.Loi : Ui.Chu;
            if (v != null && rSaoLuu.Checked && (oAnh.Text.Trim().Length == 0 || oAnh.Text.StartsWith(v.Chu + ":", StringComparison.OrdinalIgnoreCase)))
                oAnh.Text = GoiYTepSaoLuu(v);
        }

        /// <summary>Gợi ý nơi lưu: phân vùng khác còn đủ chỗ (ưu tiên ổ cứng gắn trong).</summary>
        string GoiYTepSaoLuu(PhanVung nguon)
        {
            PhanVung tot = null;
            foreach (DataGridViewRow r in luoi.Rows)
            {
                var v = (PhanVung)r.Tag;
                if (v == nguon || v.Chu.Length == 0 || v.DinhDang != "NTFS" || v.ConTrong < nguon.DaDung * 7 / 10) continue;
                if (tot == null || (tot.Bus == "USB" && v.Bus != "USB") || (tot.Bus == v.Bus && v.ConTrong > tot.ConTrong)) tot = v;
            }
            if (tot == null) return "";
            string may = HeThong.KhongDau(Environment.MachineName).Replace(" ", "");
            return tot.Chu + ":\\Ghost\\" + may + "_" + nguon.Chu + "_" + DateTime.Now.ToString("yyyyMMdd") + ".gho";
        }

        void ChonTepAnh()
        {
            if (rSaoLuu.Checked)
            {
                using (var d = new SaveFileDialog { Filter = "Tệp Ghost (*.gho)|*.gho", FileName = Path.GetFileName(oAnh.Text) })
                    if (d.ShowDialog(CuaSo) == DialogResult.OK) oAnh.Text = d.FileName;
            }
            else
            {
                using (var d = new OpenFileDialog { Filter = "Tệp Ghost (*.gho)|*.gho" })
                    if (d.ShowDialog(CuaSo) == DialogResult.OK) oAnh.Text = d.FileName;
            }
        }

        static bool DuongDanHopLe(string p)
        {
            if (p.Length < 4 || p[1] != ':' || p[2] != '\\' || !char.IsLetter(p[0])) return false;
            foreach (char c in p)
                if (c > 126 || c == ' ' || "&|<>^%!\"'()".IndexOf(c) >= 0) return false;
            return true;
        }

        // ---------------- Ghost qua WinPE ----------------

        void ChayGhost(bool khoiDongLai)
        {
            string ghost = Ghost();
            if (ghost == null) return;
            if (Path.GetFileName(ghost).IndexOf("32", StringComparison.Ordinal) >= 0 &&
                !Ui.HoiCanhBao(CuaSo, "WinPE của Windows 64-bit chỉ chạy được ghost64.exe, không chạy được ghost32.exe.\nVẫn tiếp tục?")) return;
            PhanVung v = PvChon();
            if (v == null)
            {
                Ui.BaoTin(CuaSo, "Chọn phân vùng trong bảng.");
                return;
            }
            if (v.Chu.Length == 0 || v.DinhDang.Length == 0)
            {
                Ui.BaoTin(CuaSo, "Chỉ làm được với phân vùng có ký tự ổ và đã định dạng (NTFS / FAT). Phân vùng EFI / MSR / Recovery không cần sao lưu riêng.");
                return;
            }
            string anh = oAnh.Text.Trim();
            bool saoLuu = rSaoLuu.Checked;
            if (!DuongDanHopLe(anh) || !anh.EndsWith(".gho", StringComparison.OrdinalIgnoreCase))
            {
                Ui.BaoLoi(CuaSo, "Đường dẫn tệp .gho phải dạng D:\\Ghost\\Ten.gho — chữ không dấu, không khoảng trắng, không ký tự đặc biệt.");
                return;
            }
            string chuAnh = anh.Substring(0, 1).ToUpperInvariant();
            if (chuAnh == v.Chu)
            {
                Ui.BaoLoi(CuaSo, "Tệp .gho không được nằm trên chính phân vùng " + v.Chu + ": cần " + (saoLuu ? "sao lưu" : "bung") + ".");
                return;
            }
            PhanVung pvAnh = null;
            foreach (DataGridViewRow r in luoi.Rows) if (((PhanVung)r.Tag).Chu == chuAnh) pvAnh = (PhanVung)r.Tag;
            if (pvAnh == null)
            {
                Ui.BaoLoi(CuaSo, "Không thấy ổ " + chuAnh + ": trong bảng phân vùng (bấm Làm mới).");
                return;
            }
            if (saoLuu)
            {
                if (pvAnh.ConTrong < v.DaDung * 7 / 10 &&
                    !Ui.HoiCanhBao(CuaSo, "Ổ " + chuAnh + ": chỉ còn " + HeThong.Gb(pvAnh.ConTrong) + ", phân vùng nguồn đã dùng " + HeThong.Gb(v.DaDung) + ". Có thể không đủ chỗ. Vẫn tiếp tục?")) return;
                if (File.Exists(anh) && !Ui.Hoi(CuaSo, "Tệp " + anh + " đã có, sẽ bị ghi đè. Tiếp tục?")) return;
                if (!Ui.Hoi(CuaSo, "SAO LƯU " + v.MoTa() + "\nra tệp " + anh + "\n\nMáy sẽ " + (khoiDongLai ? "khởi động lại ngay" : "khởi động vào WinPE ở lần khởi động tới") +
                                   " để Ghost làm việc. Lưu và đóng mọi tài liệu đang mở. Tiếp tục?")) return;
            }
            else
            {
                if (!File.Exists(anh))
                {
                    Ui.BaoLoi(CuaSo, "Không thấy tệp " + anh);
                    return;
                }
                string[] xn = FormNhap.Hien(CuaSo, "Xác nhận bung tệp .gho",
                    "Toàn bộ dữ liệu trên " + v.MoTa() + (v.LaWindows ? " — Ổ WINDOWS ĐANG CHẠY" : "") + " sẽ bị XÓA và thay bằng nội dung tệp " + anh + ".\n" +
                    "Sao lưu dữ liệu cần giữ trước (Desktop, Documents nằm trên ổ này). Gõ chữ BUNG (in hoa) để tiếp tục.",
                    "Xác nhận", TruongNhap.Chu("Gõ BUNG", "", true));
                if (xn == null) return;
                if (xn[0] != "BUNG")
                {
                    Ui.BaoTin(CuaSo, "Chưa gõ đúng chữ BUNG — đã hủy.");
                    return;
                }
            }
            var viec = new ViecGhost
            {
                SaoLuu = saoLuu,
                Ghost = ghost,
                PhanVung = v,
                TepAnh = anh,
                Nen = chonNen.SelectedIndex == 0 ? 1 : chonNen.SelectedIndex == 2 ? 9 : 3,
                PvTrongAnh = chonPvAnh.SelectedIndex + 1,
                KiemTra = hopKiemTra.Checked,
                TuDong = hopTuDong.Checked
            };
            CaiDat.Luu("ghost", ghost);
            bool xong = false;
            TacVu.Chay("Chuẩn bị WinPE cho Ghost", log =>
            {
                WinPE.ChuanBiGhost(log, viec);
                xong = true;
            }, () =>
            {
                KhiHien();
                if (!xong) return;   // chuẩn bị lỗi: đã báo trong nhật ký, không khởi động lại
                if (khoiDongLai) HeThong.Mo("shutdown.exe", "/r /t 5 /c \"IT Toolkit: khoi dong vao WinPE de chay Ghost\"");
                else Ui.BaoTin(CuaSo, "Đã chuẩn bị xong. Lần khởi động lại tới, máy sẽ vào WinPE để chạy Ghost.\nĐổi ý: bấm \"Hủy lịch / dọn tệp WinPE\".");
            });
        }

        void PECuaBan(bool khoiDongLai)
        {
            string tep;
            using (var d = new OpenFileDialog { Filter = "WinPE (*.wim;*.iso)|*.wim;*.iso" })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                tep = d.FileName;
            }
            if (khoiDongLai && !Ui.Hoi(CuaSo, "Chuẩn bị xong máy sẽ khởi động lại vào WinPE:\n" + tep + "\n\nLưu và đóng tài liệu đang mở. Tiếp tục?")) return;
            bool xong = false;
            TacVu.Chay("Chuẩn bị khởi động vào WinPE của bạn", log =>
            {
                WinPE.ChuanBiPECuaBan(log, tep);
                xong = true;
            }, () =>
            {
                KhiHien();
                if (!xong) return;
                if (khoiDongLai) HeThong.Mo("shutdown.exe", "/r /t 5 /c \"IT Toolkit: khoi dong vao WinPE\"");
                else Ui.BaoTin(CuaSo, "Đã chuẩn bị xong. Lần khởi động lại tới máy sẽ vào WinPE.");
            });
        }

        void Huy()
        {
            TacVu.Chay("Hủy lịch / dọn tệp WinPE", log => WinPE.Huy(log), KhiHien);
        }

        // ---------------- tiện ích trong Windows ----------------

        void KiemTraGho()
        {
            string g = Ghost();
            if (g == null) return;
            string tep;
            using (var d = new OpenFileDialog { Filter = "Tệp Ghost (*.gho)|*.gho" })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                tep = d.FileName;
            }
            if (tep.IndexOf(' ') >= 0)
            {
                Ui.BaoLoi(CuaSo, "Đường dẫn có khoảng trắng — Ghost không nhận. Đổi tên thư mục / tệp cho không có khoảng trắng.");
                return;
            }
            TacVu.Chay("Kiểm tra tệp .gho", log =>
            {
                int ma = HeThong.Chay(log, g, "-chkimg," + tep);
                if (ma == 0) log.Tot("Tệp ảnh hợp lệ: " + tep);
                else throw new LoiTacVu("Ghost báo lỗi " + ma + " — tệp ảnh có thể bị hỏng.");
            });
        }

        void MoGhostExplorer()
        {
            string g = Ghost();
            if (g == null) return;
            string thu = Path.GetDirectoryName(g);
            string exp = TimTrong(new[] { Path.Combine(thu, "ghostexp64.exe"), Path.Combine(thu, "ghostexp.exe"), Path.Combine(thu, "Ghostexp.exe") });
            if (exp == null)
            {
                Ui.BaoTin(CuaSo, "Không thấy Ghost Explorer (ghostexp.exe) cạnh " + g + ".");
                return;
            }
            HeThong.Mo(exp);
        }

        void MoTib()
        {
            string tep;
            using (var d = new OpenFileDialog { Filter = "Tệp Acronis (*.tib;*.tibx)|*.tib;*.tibx" })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                tep = d.FileName;
            }
            try
            {
                // tệp .tib đã gắn với Acronis: mở thẳng (Acronis hiện cửa sổ phục hồi / duyệt nội dung)
                Process.Start(new ProcessStartInfo(tep) { UseShellExecute = true });
                NhatKy.Chung.Ghi("Đã mở " + tep + " bằng Acronis.");
            }
            catch (Win32Exception)
            {
                string a = Acronis();
                if (a == null) return;
                Ui.BaoTin(CuaSo, "Tệp .tib chưa được gắn với Acronis. Phần mềm sẽ mở Acronis True Image: vào Backup → Add existing backup / Recovery và chọn tệp:\n" + tep);
                HeThong.Mo(a);
            }
        }
    }
}
