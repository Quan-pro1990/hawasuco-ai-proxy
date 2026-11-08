using System;
using System.Collections.Generic;
using System.Drawing;
using System.Management;
using System.Net;
using System.Net.Sockets;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Tab 2: lưu tài khoản đăng nhập máy chủ vào Windows Credentials.</summary>
    public class TabDangNhap : TrangCuon
    {
        readonly TextBox oMay, oTk, oMk;
        readonly CheckBox hopCaIp;
        readonly DataGridView luoi;

        public TabDangNhap()
        {
            TheBo the = TheBo.TuCao();
            Ui.ThemDuoi(the, new TieuDe("Lưu tài khoản đăng nhập máy chủ (Add Windows Credentials)", Ic.Khoa, Tone.Vang));
            Ui.ThemDuoi(the, new DoanVan("Dùng khi máy chủ chia sẻ máy in / thư mục yêu cầu tài khoản: lưu sẵn để máy trạm tự đăng nhập, " +
                "không hỏi lại mật khẩu và hết lỗi Access denied khi in. Thông tin được lưu cho tài khoản Windows đang chạy phần mềm này. " +
                "Nếu trước đó đã đăng nhập sai, hãy Sign out (hoặc khởi động lại) máy trạm sau khi lưu."));
            TableLayoutPanel bang = Ui.BangNhap();
            oMay = Ui.O("Tên máy chủ hoặc IP, vd: MAYCHU hoặc 192.168.1.10");
            oTk = Ui.O("vd: MAYCHU\\inlan  hoặc  inlan");
            oMk = Ui.O(null);
            oMk.UseSystemPasswordChar = true;
            Ui.DongNhap(bang, "Máy chủ", oMay);
            Ui.DongNhap(bang, "Tài khoản", oTk);
            Ui.DongNhap(bang, "Mật khẩu", oMk);
            hopCaIp = Ui.Hop("Lưu cho cả tên máy và địa chỉ IP (truy cập kiểu nào cũng tự đăng nhập)", true);
            Ui.ThemDuoi(the, bang);
            Ui.ThemDuoi(the, Ui.Dong(hopCaIp));
            Ui.ThemDuoi(the, Ui.Khoang(6));
            var luu = new NutBo("Lưu vào Windows Credentials", Ic.Luu, Tone.Xanh, true);
            luu.Click += (s, e) => Luu();
            var mo = new NutBo("Mở thư mục chia sẻ của máy chủ", Ic.ThuMuc, Tone.Ngoc, false);
            mo.Click += (s, e) =>
            {
                string may = oMay.Text.Trim().Trim('\\');
                if (may.Length == 0) Ui.BaoTin(CuaSo, "Nhập tên máy chủ hoặc IP trước.");
                else HeThong.Mo("explorer.exe", "\\\\" + may);
            };
            var ql = new NutBo("Mở Credential Manager", Ic.CaiDat, Tone.Xam, false);
            ql.Click += (s, e) => HeThong.Mo("control.exe", "/name Microsoft.CredentialManager");
            Ui.ThemDuoi(the, Ui.Luoi(3, luu, mo, ql));
            Them(the);

            TheBo ds = TheBo.TuCao();
            Ui.ThemDuoi(ds, new TieuDe("Tài khoản Windows Credentials đã lưu", Ic.NhieuNguoi, Tone.Xanh));
            luoi = Ui.TaoLuoi(false, "Máy chủ", "Tài khoản");
            luoi.Height = Ui.S(230);
            Ui.ThemDuoi(ds, luoi);
            Ui.ThemDuoi(ds, Ui.Khoang(8));
            var lamMoi = NutBo.Phu("Làm mới", Ic.LamMoi);
            lamMoi.Click += (s, e) => Nap();
            var xoa = new NutBo("Xóa mục đã chọn", Ic.Xoa, Tone.Do, false);
            xoa.Click += (s, e) => Xoa();
            Ui.ThemDuoi(ds, Ui.Luoi(3, lamMoi, xoa, null));
            Them(ds);
        }

        protected override void KhiHienLanDau() { Nap(); }

        void Nap()
        {
            luoi.Rows.Clear();
            try
            {
                foreach (KhoMatKhau.Muc m in KhoMatKhau.DanhSach())
                {
                    int r = luoi.Rows.Add(m.May, m.TaiKhoan);
                    luoi.Rows[r].Tag = m;
                }
            }
            catch (Exception ex)
            {
                NhatKy.Chung.Loi("Không đọc được Windows Credentials: " + ex.Message);
            }
        }

        void Luu()
        {
            string may = oMay.Text.Trim().Trim('\\'), tk = oTk.Text.Trim(), mk = oMk.Text;
            if (may.Length == 0 || tk.Length == 0)
            {
                Ui.BaoTin(CuaSo, "Nhập máy chủ và tài khoản.");
                return;
            }
            bool caIp = hopCaIp.Checked;
            TacVu.Chay("Lưu Windows Credentials", log =>
            {
                var dich = new List<string> { may };
                if (caIp)
                {
                    try
                    {
                        IPAddress ip;
                        if (IPAddress.TryParse(may, out ip))
                        {
                            string ten = Dns.GetHostEntry(ip).HostName;
                            int i = ten.IndexOf('.');
                            if (i > 0) ten = ten.Substring(0, i);
                            if (ten.Length > 0 && ten != may) dich.Add(ten.ToUpperInvariant());
                        }
                        else
                        {
                            foreach (IPAddress a in Dns.GetHostAddresses(may))
                                if (a.AddressFamily == AddressFamily.InterNetwork && !dich.Contains(a.ToString())) dich.Add(a.ToString());
                        }
                    }
                    catch (Exception ex)
                    {
                        log.Canh("Không tra được tên / IP còn lại của " + may + ": " + ex.Message);
                    }
                }
                foreach (string d in dich)
                {
                    KhoMatKhau.Them(d, tk, mk);
                    log.Tot("Đã lưu: " + d + "  —  " + tk);
                }
            }, () =>
            {
                oMk.Clear();
                Nap();
            });
        }

        void Xoa()
        {
            if (luoi.CurrentRow == null) return;
            var m = (KhoMatKhau.Muc)luoi.CurrentRow.Tag;
            if (!Ui.Hoi(CuaSo, "Xóa thông tin đăng nhập " + m.May + " (" + m.TaiKhoan + ")?")) return;
            try
            {
                KhoMatKhau.Xoa(m.May, m.Loai);
                NhatKy.Chung.Tot("Đã xóa Windows Credentials: " + m.May);
            }
            catch (Exception ex)
            {
                Ui.BaoLoi(CuaSo, ex.Message);
            }
            Nap();
        }
    }

    /// <summary>Tab 3: tạo / quản lý tài khoản cục bộ dùng để chia sẻ máy in, dữ liệu trong LAN.</summary>
    public class TabTaiKhoan : TrangCuon
    {
        readonly TextBox oTen, oMk, oMk2, oHoTen;
        readonly CheckBox hopHetHan, hopDoiMk, hopAn;
        readonly DataGridView luoi;

        public TabTaiKhoan()
        {
            TheBo the = TheBo.TuCao();
            Ui.ThemDuoi(the, new TieuDe("Tạo user chia sẻ máy in - LAN", Ic.NguoiDung, Tone.Xanh));
            Ui.ThemDuoi(the, new DoanVan("Tạo trên MÁY CHỦ (máy cắm máy in / có thư mục chia sẻ). Máy trạm dùng đúng tài khoản và mật khẩu này " +
                "(lưu ở tab Windows Credentials) để in và vào thư mục chia sẻ. Nên đặt mật khẩu: tài khoản mật khẩu trống chỉ dùng được " +
                "khi tắt \"Limit local account use of blank passwords\" (tab Fix chia sẻ dữ liệu)."));
            TableLayoutPanel bang = Ui.BangNhap();
            oTen = Ui.O("Không dấu, không khoảng trắng, vd: inlan");
            oMk = Ui.O(null);
            oMk.UseSystemPasswordChar = true;
            oMk2 = Ui.O(null);
            oMk2.UseSystemPasswordChar = true;
            oHoTen = Ui.O("Không bắt buộc");
            Ui.DongNhap(bang, "Tên đăng nhập", oTen);
            Ui.DongNhap(bang, "Mật khẩu", oMk);
            Ui.DongNhap(bang, "Nhập lại mật khẩu", oMk2);
            Ui.DongNhap(bang, "Họ tên", oHoTen);
            Ui.ThemDuoi(the, bang);
            hopHetHan = Ui.Hop("Mật khẩu không bao giờ hết hạn", true);
            hopDoiMk = Ui.Hop("Không cho đổi mật khẩu", true);
            hopAn = Ui.Hop("Ẩn khỏi màn hình đăng nhập", true);
            Ui.ThemDuoi(the, Ui.Dong(hopHetHan, hopDoiMk, hopAn));
            Ui.ThemDuoi(the, Ui.Khoang(6));
            var tao = new NutBo("Tạo tài khoản", Ic.Them, Tone.Xanh, true);
            tao.Click += (s, e) => Tao();
            Ui.ThemDuoi(the, Ui.Luoi(3, tao, null, null));
            Them(the);

            TheBo ds = TheBo.TuCao();
            Ui.ThemDuoi(ds, new TieuDe("Tài khoản trên máy này", Ic.NhieuNguoi, Tone.Tim));
            luoi = Ui.TaoLuoi(false, "Tài khoản", "Họ tên", "Trạng thái", "Mật khẩu", "Màn hình đăng nhập");
            luoi.Height = Ui.S(240);
            Ui.ThemDuoi(ds, luoi);
            Ui.ThemDuoi(ds, Ui.Khoang(8));
            Ui.ThemDuoi(ds, Ui.Luoi(3,
                Nut("Làm mới", Ic.LamMoi, Tone.Xam, Nap),
                Nut("Đặt lại mật khẩu", Ic.Khoa, Tone.Vang, DatLaiMatKhau),
                Nut("Khóa / mở khóa", Ic.MoKhoa, Tone.Cam, BatTat),
                Nut("Ẩn / hiện ở màn hình đăng nhập", Ic.NguoiDung, Tone.Ngoc, AnHien),
                Nut("Xóa tài khoản", Ic.Xoa, Tone.Do, Xoa),
                Nut("Mở Local Users and Groups", Ic.CaiDat, Tone.Xam, () => HeThong.Mo(System.IO.File.Exists(HeThong.Exe("lusrmgr.msc")) ? "lusrmgr.msc" : "netplwiz.exe"))));
            Them(ds);
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
            TacVu.Nen(this, () => TaiKhoanMay.DanhSach(), ds =>
            {
                luoi.Rows.Clear();
                foreach (TaiKhoanMay.Muc m in ds)
                {
                    int r = luoi.Rows.Add(m.Ten, m.HoTen, m.Khoa ? "Đang khóa" : "Hoạt động", m.KhongHetHan ? "Không hết hạn" : "Có hết hạn",
                        m.AnDangNhap ? "Ẩn" : "Hiện");
                    luoi.Rows[r].Tag = m;
                    if (m.Khoa) luoi.Rows[r].DefaultCellStyle.ForeColor = Ui.ChuPhu;
                }
            });
        }

        TaiKhoanMay.Muc Chon()
        {
            if (luoi.CurrentRow == null)
            {
                Ui.BaoTin(CuaSo, "Chọn 1 tài khoản trong bảng.");
                return null;
            }
            return (TaiKhoanMay.Muc)luoi.CurrentRow.Tag;
        }

        void Tao()
        {
            string ten = oTen.Text.Trim();
            if (ten.Length == 0 || ten.IndexOfAny(" \"/\\[]:;|=,+*?<>@".ToCharArray()) >= 0)
            {
                Ui.BaoTin(CuaSo, "Tên đăng nhập không hợp lệ (không để trống, không khoảng trắng và ký tự đặc biệt).");
                return;
            }
            if (oMk.Text != oMk2.Text)
            {
                Ui.BaoTin(CuaSo, "Hai lần nhập mật khẩu không khớp.");
                return;
            }
            if (oMk.Text.Length == 0 && !Ui.Hoi(CuaSo, "Tạo tài khoản KHÔNG mật khẩu?\nMáy trạm chỉ đăng nhập được khi đã tắt \"Limit local account use of blank passwords\".")) return;
            string mk = oMk.Text, hoTen = oHoTen.Text.Trim();
            bool hh = hopHetHan.Checked, dm = hopDoiMk.Checked, an = hopAn.Checked;
            TacVu.Chay("Tạo tài khoản " + ten, log => TaiKhoanMay.Tao(log, ten, mk, hoTen, hh, dm, an), () =>
            {
                oMk.Clear();
                oMk2.Clear();
                Nap();
            });
        }

        void DatLaiMatKhau()
        {
            TaiKhoanMay.Muc m = Chon();
            if (m == null) return;
            string[] kq = FormNhap.Hien(CuaSo, "Đặt lại mật khẩu cho " + m.Ten, null, "Đặt mật khẩu",
                TruongNhap.MatKhau("Mật khẩu mới", false), TruongNhap.MatKhau("Nhập lại", false));
            if (kq == null) return;
            if (kq[0] != kq[1])
            {
                Ui.BaoTin(CuaSo, "Hai lần nhập mật khẩu không khớp.");
                return;
            }
            TacVu.Chay("Đặt mật khẩu " + m.Ten, log => TaiKhoanMay.DatMatKhau(log, m.Ten, kq[0]));
        }

        void BatTat()
        {
            TaiKhoanMay.Muc m = Chon();
            if (m == null) return;
            TacVu.Chay((m.Khoa ? "Mở khóa " : "Khóa ") + m.Ten, log => TaiKhoanMay.BatTat(log, m.Ten, m.Khoa), Nap);
        }

        void AnHien()
        {
            TaiKhoanMay.Muc m = Chon();
            if (m == null) return;
            TacVu.Chay("Ẩn / hiện " + m.Ten, log => TaiKhoanMay.AnKhoiDangNhap(log, m.Ten, !m.AnDangNhap), Nap);
        }

        void Xoa()
        {
            TaiKhoanMay.Muc m = Chon();
            if (m == null) return;
            if (string.Equals(m.Ten, Environment.UserName, StringComparison.OrdinalIgnoreCase))
            {
                Ui.BaoTin(CuaSo, "Không xóa tài khoản đang đăng nhập.");
                return;
            }
            if (!Ui.HoiCanhBao(CuaSo, "Xóa tài khoản \"" + m.Ten + "\"? Thư mục hồ sơ (C:\\Users\\...) không bị xóa.")) return;
            TacVu.Chay("Xóa tài khoản " + m.Ten, log => TaiKhoanMay.Xoa(log, m.Ten), Nap);
        }
    }

    /// <summary>Tab 4: sửa lỗi chia sẻ dữ liệu (thư mục) giữa các máy trong LAN.</summary>
    public class TabChiaSe : TrangCuon
    {
        public TabChiaSe()
        {
            Them(new GhiChu("LƯU Ý QUAN TRỌNG: sau khi chạy lệnh sửa lỗi chia sẻ dữ liệu (can thiệp Registry & Group Policy), " +
                            "hãy khởi động lại máy tính để Windows áp dụng đầy đủ.", Tone.Vang));
            var cot = new NhieuCot(2);
            cot.Them(0, new GhiChu("1. CHẠY Ở MÁY CHỦ (SERVER) — máy có thư mục / máy in chia sẻ gốc trong mạng LAN.", Tone.Xanh));
            cot.Them(1, new GhiChu("2. CHẠY Ở MÁY TRẠM (CLIENT) — máy tính phụ / văn phòng kết nối từ xa đến máy chủ.", Tone.Cam));
            foreach (LoiMau l in SuaLoi.LoiChiaSe(o => ChiaSeThuMuc(o, null, null)))
                cot.Them(l.Noi == NoiSua.MayChu ? 0 : 1, TheLoi(l));
            Them(cot);

            TheBo cc = TheBo.TuCao();
            Ui.ThemDuoi(cc, new TieuDe("3. Công cụ dùng chung & tiện ích mạng LAN", Ic.CaiDat, Tone.Tim));
            Ui.ThemDuoi(cc, Ui.Luoi(3,
                Nut("Chia sẻ thư mục & cấp quyền...", Ic.ChiaSe, Tone.Xanh, () => ChiaSeThuMuc(CuaSo, null, null)),
                Nut("Xem thư mục đang chia sẻ", Ic.ThuMuc, Tone.Ngoc, XemChiaSe),
                Nut("Đổi tên máy / Workgroup", Ic.ManHinh, Tone.Tim, () => DoiTenMay(CuaSo)),
                Nut("Bật chia sẻ & Network Discovery", Ic.Mang, Tone.XanhLa, () => Chay("Bật chia sẻ mạng LAN", false, SuaLoi.DichVuChiaSe, SuaLoi.LuatChiaSe, SuaLoi.MangPrivate, SuaLoi.NetBios)),
                Nut("Reset toàn bộ ngăn xếp mạng", Ic.LamMoi, Tone.Cam, ResetMang),
                Nut("Khôi phục bảo mật chia sẻ", Ic.Khien, Tone.Do, () =>
                {
                    if (Ui.Hoi(CuaSo, "Đưa thiết lập chia sẻ về mặc định an toàn?\n\n" + SuaLoi.HoanTacChiaSe.MoTa))
                        Chay("Khôi phục bảo mật chia sẻ", true, SuaLoi.HoanTacChiaSe);
                }),
                Nut("Xem SID máy này", Ic.ThongTin, Tone.Xam, () => TacVu.Chay("SID máy", log => HeThong.ChayPS(log,
                    "$u = Get-LocalUser | Select-Object -First 1\r\n" +
                    "Write-Output ('SID máy ' + $env:COMPUTERNAME + ':  ' + $u.SID.AccountDomainSid.Value)\r\n" +
                    "Write-Output 'So sánh với máy khác: 2 máy trùng SID (nhân bản Ghost / clone) cần đổi SID bằng Sysprep.'"))),
                Nut("Đổi SID máy (Sysprep)...", Ic.CanhBao, Tone.Cam, () => DoiSid(CuaSo))));
            Them(cc);
        }

        NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        void Chay(string ten, bool khoiDongLai, params Buoc[] buoc)
        {
            TacVu.Chay(ten, log => SuaLoi.ChayCacBuoc(log, buoc), khoiDongLai ? (Action)(() => Ui.HoiKhoiDongLai(CuaSo)) : null);
        }

        Control TheLoi(LoiMau l)
        {
            TheBo the = TheBo.TuCao();
            the.Padding = Ui.Pad(14, 10, 14, 12);
            var td = new DoanVan(l.TieuDe, Ui.Chu, Ui.Dam);
            var ma = new DoanVan(l.Ma, Ui.Loi, Ui.NhoDam);
            var hinh = new HopLoiMau(l.CuaSo, l.ThongBao) { Height = Ui.S(128) };
            hinh.Click += (s, e) => TrangMayIn.XemVaSua(CuaSo, l);
            var nn = new DoanVan(l.NguyenNhan, Ui.ChuPhu, Ui.Nho);
            var nut = new NutBo("Sửa lỗi này", Ic.SuaChua, Tone.Xanh, false);
            nut.Click += (s, e) => TrangMayIn.XemVaSua(CuaSo, l);
            Ui.ThemDuoi(the, td);
            Ui.ThemDuoi(the, ma);
            Ui.ThemDuoi(the, Ui.Khoang(4));
            Ui.ThemDuoi(the, hinh);
            Ui.ThemDuoi(the, Ui.Khoang(4));
            Ui.ThemDuoi(the, nn);
            Ui.ThemDuoi(the, Ui.Luoi(1, nut));
            return the;
        }

        void XemChiaSe()
        {
            TacVu.Chay("Danh sách thư mục đang chia sẻ", log => HeThong.ChayPS(log,
                "Get-SmbShare | Sort-Object Name | Format-Table Name, Path, Description -AutoSize | Out-String -Width 220"));
            HeThong.Mo("fsmgmt.msc");
        }

        static void ResetMang()
        {
            if (!Ui.Hoi(null, "Reset Winsock, TCP/IP và xóa bộ nhớ DNS?\nMạng có thể chập chờn đến khi khởi động lại máy.")) return;
            TacVu.Chay("Reset ngăn xếp mạng", log =>
            {
                HeThong.Chay(log, HeThong.Exe("netsh.exe"), "winsock reset");
                HeThong.Chay(log, HeThong.Exe("netsh.exe"), "int ip reset");
                HeThong.Chay(log, HeThong.Exe("ipconfig.exe"), "/flushdns");
            }, () => Ui.HoiKhoiDongLai(null));
        }

        /// <summary>Chia sẻ 1 thư mục và cấp quyền Share + NTFS cho Everyone hoặc 1 tài khoản cục bộ.</summary>
        public static void ChiaSeThuMuc(IWin32Window chu, string thuMuc, string tenChiaSe)
        {
            var nguoi = new List<string> { "Everyone (mọi người)" };
            try
            {
                foreach (TaiKhoanMay.Muc m in TaiKhoanMay.DanhSach()) if (!m.Khoa) nguoi.Add(m.Ten);
            }
            catch (Exception) { }
            var tm = new TruongNhap("Thư mục", KieuTruong.ThuMuc, thuMuc ?? "") { BatBuoc = true };
            string[] kq = FormNhap.Hien(chu, "Chia sẻ thư mục & cấp quyền",
                "Tạo (hoặc làm lại) chia sẻ cho thư mục, cấp quyền ở cả Share và NTFS — sửa lỗi \"You do not have permission to access\". " +
                "Chọn Everyone để mọi máy vào được; chọn 1 tài khoản để chỉ người có mật khẩu vào được.",
                "Chia sẻ", tm, TruongNhap.Chu("Tên chia sẻ", tenChiaSe ?? "", false),
                TruongNhap.Chon("Quyền", "Đọc và ghi", "Đọc và ghi", "Toàn quyền", "Chỉ đọc"),
                TruongNhap.Chon("Cho tài khoản", nguoi[0], nguoi.ToArray()));
            if (kq == null) return;
            string duongDan = kq[0].TrimEnd('\\');
            if (duongDan.Length == 2 && duongDan[1] == ':') duongDan += "\\";
            string ten = kq[1].Length > 0 ? kq[1] : System.IO.Path.GetFileName(duongDan.TrimEnd('\\'));
            if (string.IsNullOrEmpty(ten))
            {
                Ui.BaoLoi(chu, "Nhập tên chia sẻ.");
                return;
            }
            string quyen = kq[2], sid, taiKhoan;
            try
            {
                if (kq[3] == nguoi[0]) sid = "S-1-1-0";
                else sid = HeThong.SidTuTen(Environment.MachineName + "\\" + kq[3]);
                taiKhoan = HeThong.TenTuSid(sid);
            }
            catch (Exception ex)
            {
                Ui.BaoLoi(chu, "Không tìm thấy tài khoản: " + ex.Message);
                return;
            }
            string thamSoShare = quyen == "Toàn quyền" ? "-FullAccess $ai, $admins" : quyen == "Chỉ đọc" ? "-ReadAccess $ai -FullAccess $admins" : "-ChangeAccess $ai -FullAccess $admins";
            string ntfs = quyen == "Toàn quyền" ? "F" : quyen == "Chỉ đọc" ? "RX" : "M";
            TacVu.Chay("Chia sẻ thư mục " + ten, log =>
            {
                HeThong.ChayPS(log,
                    "$p = " + HeThong.Ps(duongDan) + "; $ten = " + HeThong.Ps(ten) + "; $ai = " + HeThong.Ps(taiKhoan) + "\r\n" +
                    "$admins = (New-Object System.Security.Principal.SecurityIdentifier 'S-1-5-32-544').Translate([System.Security.Principal.NTAccount]).Value\r\n" +
                    "if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null; Write-Output ('Đã tạo thư mục ' + $p) }\r\n" +
                    "if (Get-SmbShare -Name $ten -ErrorAction SilentlyContinue) { Remove-SmbShare -Name $ten -Force; Write-Output ('Đã gỡ chia sẻ cũ ' + $ten) }\r\n" +
                    "New-SmbShare -Name $ten -Path $p " + thamSoShare + " -ErrorAction Stop | Out-Null\r\n" +
                    "Write-Output ('Đã chia sẻ ' + $p + ' với tên ' + $ten + ' cho ' + $ai)");
                HeThong.Chay(log, HeThong.Exe("icacls.exe"), HeThong.Nhay(duongDan) + " /grant *" + sid + ":(OI)(CI)" + ntfs);
                HeThong.KieuDichVu(log, "LanmanServer", "auto");
                HeThong.BatDichVu(log, "LanmanServer");
                HeThong.MoTuongLuaChiaSe(log);
                HeThong.MangRiengTu(log);
                log.Tot("Máy trạm truy cập bằng:  \\\\" + Environment.MachineName + "\\" + ten);
            });
        }

        /// <summary>Đổi SID máy bằng Sysprep /generalize — cách Microsoft hỗ trợ cho máy nhân bản (Ghost / clone).</summary>
        static void DoiSid(IWin32Window chu)
        {
            string sysprep = System.IO.Path.Combine(HeThong.Sys32, @"Sysprep\sysprep.exe");
            if (!System.IO.File.Exists(sysprep))
            {
                Ui.BaoLoi(chu, "Không tìm thấy " + sysprep);
                return;
            }
            string[] kq = FormNhap.Hien(chu, "Đổi SID máy bằng Sysprep",
                "Chỉ cần khi nhiều máy được nhân bản từ 1 bản Ghost / clone (trùng SID): từ các bản cập nhật cuối 2025, Windows 11 24H2 / 25H2 " +
                "có thể báo lỗi đăng nhập khi vào thư mục / máy in chia sẻ giữa các máy trùng SID. Kiểm tra bằng nút \"Xem SID máy này\" trên từng máy.\n\n" +
                "Sysprep /generalize /oobe sẽ KHỞI ĐỘNG LẠI máy vào màn hình thiết lập ban đầu (chọn vùng, bàn phím, tạo tài khoản). " +
                "Tệp và phần mềm vẫn còn; driver được nhận lại; tên máy, cấu hình mạng, kích hoạt Windows có thể phải làm lại. " +
                "Sysprep có thể từ chối chạy (Windows được nâng cấp từ bản cũ, ứng dụng Store chỉ cài cho 1 người dùng) — xem lỗi tại " +
                "C:\\Windows\\System32\\Sysprep\\Panther\\setupact.log.\n\nNên tạo điểm khôi phục và sao lưu dữ liệu trước. Gõ SYSPREP để tiếp tục.",
                "Chạy Sysprep", TruongNhap.Chu("Gõ SYSPREP", "", true));
            if (kq == null) return;
            if (kq[0] != "SYSPREP")
            {
                Ui.BaoTin(chu, "Chưa gõ đúng chữ SYSPREP — đã hủy.");
                return;
            }
            TacVu.Chay("Đổi SID máy (Sysprep)", log =>
            {
                log.Canh("Sysprep đang chạy, máy sẽ tự khởi động lại khi xong...");
                int ma = HeThong.Chay(log, sysprep, "/generalize /oobe /reboot /quiet");
                if (ma != 0) throw new LoiTacVu("Sysprep báo lỗi " + ma + ". Xem C:\\Windows\\System32\\Sysprep\\Panther\\setupact.log");
            });
        }

        public static void DoiTenMay(IWin32Window chu)
        {
            string wg = "WORKGROUP";
            bool domain = false;
            foreach (ManagementObject o in HeThong.Wmi("SELECT Workgroup, PartOfDomain FROM Win32_ComputerSystem"))
            {
                domain = o["PartOfDomain"] is bool && (bool)o["PartOfDomain"];
                if (HeThong.S(o, "Workgroup").Length > 0) wg = HeThong.S(o, "Workgroup");
            }
            if (domain)
            {
                Ui.BaoTin(chu, "Máy đang trong domain — đổi tên / nhóm qua quản trị domain.");
                return;
            }
            string[] kq = FormNhap.Hien(chu, "Đổi tên máy / Workgroup",
                "Các máy trong LAN nên cùng 1 Workgroup (mặc định WORKGROUP). Tên máy: không dấu, không khoảng trắng, tối đa 15 ký tự.",
                "Đổi", TruongNhap.Chu("Tên máy", Environment.MachineName, true), TruongNhap.Chu("Workgroup", wg, true));
            if (kq == null) return;
            string ten = kq[0], nhom = kq[1].ToUpperInvariant();
            if (ten.Length > 15 || ten.IndexOfAny(" \\/:*?\"<>|.,~!@#$%^&'(){}_".ToCharArray()) >= 0)
            {
                Ui.BaoLoi(chu, "Tên máy không hợp lệ (tối đa 15 ký tự, chỉ chữ, số và dấu gạch ngang).");
                return;
            }
            TacVu.Chay("Đổi tên máy / Workgroup", log => HeThong.ChayPS(log,
                "$ten = " + HeThong.Ps(ten) + "; $nhom = " + HeThong.Ps(nhom) + "\r\n" +
                "$cs = Get-CimInstance Win32_ComputerSystem\r\n" +
                "if ($nhom -ne $cs.Workgroup) { Add-Computer -WorkgroupName $nhom -Force -ErrorAction Stop; Write-Output ('Đã chuyển sang workgroup ' + $nhom) }\r\n" +
                "if ($ten -ne $env:COMPUTERNAME) { Rename-Computer -NewName $ten -Force -ErrorAction Stop; Write-Output ('Đã đổi tên máy thành ' + $ten) }"),
                () => Ui.HoiKhoiDongLai(chu));
        }
    }

    /// <summary>Tab 5: sửa lỗi scan, scan to folder của máy photocopy.</summary>
    public class TabScan : TrangCuon
    {
        public TabScan()
        {
            TheBo the = TheBo.TuCao();
            Ui.ThemDuoi(the, new TieuDe("Scan to Folder (máy photocopy / máy in đa năng quét vào thư mục)", Ic.Quet, Tone.Ngoc));
            Ui.ThemDuoi(the, new DoanVan("Thường làm trên máy nhận file scan: tạo thư mục chia sẻ (vd C:\\Scan), tạo tài khoản có mật khẩu " +
                "(tab Tạo user chia sẻ), khai báo đường dẫn \\\\TENMAY\\Scan + tài khoản đó trên máy photocopy. " +
                "Máy đời cũ chỉ biết SMB 1.0 thì mới cần bật SMB1."));
            Ui.ThemDuoi(the, Ui.Luoi(3,
                Nut("Tạo thư mục nhận Scan...", Ic.ThuMuc, Tone.Xanh, () => TabChiaSe.ChiaSeThuMuc(CuaSo, @"C:\Scan", "Scan")),
                Nut("Sửa lỗi Scan to Folder", Ic.SuaChua, Tone.XanhLa, () =>
                {
                    Buoc[] b = { SuaLoi.DichVuChiaSe, SuaLoi.LuatChiaSe, SuaLoi.MangPrivate, SuaLoi.KyChuTat };
                    if (Ui.Hoi(CuaSo, "Sẽ thực hiện:\n" + TrangMayIn.MoTaBuoc(b))) TacVu.Chay("Sửa lỗi Scan to Folder", log => SuaLoi.ChayCacBuoc(log, b));
                }),
                Nut("Bật SMB 1.0 (máy scan đời cũ)", Ic.CanhBao, Tone.Cam, BatSmb1),
                Nut("Tắt SMB 1.0", Ic.Khien, Tone.Xam, () => TacVu.Chay("Tắt SMB 1.0", log => HeThong.ChayPS(log,
                    "Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart | Out-Null; Write-Output 'Đã tắt SMB 1.0 (cần khởi động lại).'"),
                    () => Ui.HoiKhoiDongLai(CuaSo)))));
            Them(the);

            TheBo wia = TheBo.TuCao();
            Ui.ThemDuoi(wia, new TieuDe("Máy quét cắm USB / quét qua mạng (WIA)", Ic.Quet, Tone.Tim));
            Ui.ThemDuoi(wia, new DoanVan("Lỗi \"không tìm thấy máy quét\", phần mềm scan treo: khởi động lại dịch vụ Windows Image Acquisition. " +
                "Windows 11 bản mới không còn sẵn Windows Fax and Scan — cài lại bằng nút bên dưới."));
            Ui.ThemDuoi(wia, Ui.Luoi(3,
                Nut("Khởi động lại dịch vụ Scan (WIA)", Ic.LamMoi, Tone.XanhLa, () => TacVu.Chay("Khởi động lại WIA", log =>
                {
                    HeThong.KieuDichVu(log, "stisvc", "auto");
                    HeThong.KhoiDongLaiDichVu(log, "stisvc");
                    HeThong.BatDichVu(log, "ShellHWDetection");
                })),
                Nut("Cài Windows Fax and Scan", Ic.TaiVe, Tone.Xanh, () => TacVu.Chay("Cài Windows Fax and Scan", log =>
                    HeThong.Chay(log, HeThong.Exe("dism.exe"), "/online /add-capability /capabilityname:Print.Fax.Scan~~~~0.0.1.0 /norestart"))),
                Nut("Mở Windows Fax and Scan", Ic.Quet, Tone.Ngoc, () => HeThong.Mo(HeThong.Exe("WFS.exe")))));
            Them(wia);
        }

        NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        void BatSmb1()
        {
            if (!Ui.HoiCanhBao(CuaSo, "SMB 1.0 là giao thức cũ, có lỗ hổng (WannaCry). Chỉ bật khi máy scan / NAS / máy XP không hỗ trợ SMB2.\n\nVẫn bật SMB 1.0?")) return;
            TacVu.Chay("Bật SMB 1.0", log => HeThong.ChayPS(log,
                "Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -All -NoRestart | Out-Null; Write-Output 'Đã bật SMB 1.0 (cần khởi động lại).'"),
                () => Ui.HoiKhoiDongLai(CuaSo));
        }
    }
}
