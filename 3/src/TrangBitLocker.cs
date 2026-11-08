using System;
using System.Collections.Generic;
using System.IO;
using System.Management;
using System.Windows.Forms;

namespace ToolkitIT
{
    /// <summary>Trang BitLocker - EFS.</summary>
    public class TrangBitLocker : TrangCuon
    {
        const string NS = @"root\cimv2\Security\MicrosoftVolumeEncryption";
        readonly DataGridView luoi;

        public TrangBitLocker()
        {
            TheBo bl = TheBo.TuCao();
            Ui.ThemDuoi(bl, new TieuDe("BitLocker / mã hóa thiết bị", Ic.Khoa, Tone.Xam));
            Ui.ThemDuoi(bl, new DoanVan("Windows 11 có thể tự mã hóa ổ đĩa khi đăng nhập tài khoản Microsoft. Trước khi thay main, nâng cấp BIOS, " +
                "cài lại Win hay tháo ổ sang máy khác: LƯU KHÓA KHÔI PHỤC hoặc tắt BitLocker — mất khóa là mất dữ liệu."));
            luoi = Ui.TaoLuoi(false, "Ổ", "Loại", "Mã hóa", "Bảo vệ", "Khóa");
            luoi.Height = Ui.S(170);
            Ui.ThemDuoi(bl, luoi);
            Ui.ThemDuoi(bl, Ui.Khoang(8));
            Ui.ThemDuoi(bl, Ui.Luoi(4,
                Nut("Làm mới", Ic.LamMoi, Tone.Xanh, Nap),
                Nut("Xem khóa khôi phục", Ic.Khoa, Tone.Vang, () => { string o = OChon(); if (o != null) TacVu.Chay("Khóa khôi phục " + o, log => HeThong.Chay(log, ManageBde, "-protectors -get " + o)); }),
                Nut("Lưu khóa khôi phục ra tệp", Ic.Luu, Tone.Vang, LuuKhoa),
                Nut("Tắt BitLocker (giải mã)", Ic.MoKhoa, Tone.Do, TatBitLocker),
                Nut("Tạm dừng bảo vệ", Ic.Hen, Tone.Cam, () => { string o = OChon(); if (o != null) TacVu.Chay("Tạm dừng BitLocker " + o, log => HeThong.Chay(log, ManageBde, "-protectors -disable " + o), Nap); }),
                Nut("Bật lại bảo vệ", Ic.Khien, Tone.XanhLa, () => { string o = OChon(); if (o != null) TacVu.Chay("Bật lại BitLocker " + o, log => HeThong.Chay(log, ManageBde, "-protectors -enable " + o), Nap); }),
                Nut("Mở khóa ổ bằng khóa khôi phục", Ic.MoKhoa, Tone.Tim, MoKhoaO),
                Nut("Chặn Windows tự mã hóa ổ", Ic.Khien, Tone.Ngoc, () => TacVu.Chay("Chặn tự mã hóa thiết bị", log =>
                    HeThong.DatDword(log, @"HKLM\SYSTEM\CurrentControlSet\Control\BitLocker", "PreventDeviceEncryption", 1)))));
            Them(bl);

            TheBo efs = TheBo.TuCao();
            Ui.ThemDuoi(efs, new TieuDe("EFS (tệp mã hóa bằng chứng chỉ người dùng — tên tệp màu xanh lá)", Ic.TaiLieu, Tone.XanhLa));
            Ui.ThemDuoi(efs, new DoanVan("Tệp EFS chỉ mở được bằng đúng tài khoản Windows đã mã hóa. Giải mã trước khi cài lại Win / chuyển máy, " +
                "hoặc sao lưu chứng chỉ EFS (certmgr → Personal → Certificates → Export kèm private key)."));
            Ui.ThemDuoi(efs, Ui.Luoi(4,
                Nut("Tìm tệp đang mã hóa EFS", Ic.TimKiem, Tone.XanhLa, () => TacVu.Chay("Tìm tệp EFS", log => HeThong.Chay(log, HeThong.Exe("cipher.exe"), "/u /n /h"))),
                Nut("Giải mã thư mục...", Ic.MoKhoa, Tone.Cam, GiaiMaEfs),
                Nut("Sao lưu chứng chỉ EFS (certmgr)", Ic.Luu, Tone.Xam, () => HeThong.Mo("certmgr.msc")),
                Nut("Trình quản lý BitLocker", Ic.CaiDat, Tone.Xam, () => HeThong.Mo("control.exe", "/name Microsoft.BitLockerDriveEncryption"))));
            Them(efs);
        }

        static string ManageBde { get { return HeThong.Exe("manage-bde.exe"); } }

        static NutBo Nut(string ten, string icon, Tone tone, Action lam)
        {
            var b = new NutBo(ten, icon, tone, false);
            b.Click += (s, e) => lam();
            return b;
        }

        protected override void KhiHienLanDau() { Nap(); }

        class O
        {
            public string Chu, Loai, MaHoa, BaoVe, Khoa;
        }

        void Nap()
        {
            TacVu.Nen(this, () =>
            {
                var ds = new List<O>();
                foreach (ManagementObject v in HeThong.Wmi(NS, "SELECT * FROM Win32_EncryptableVolume"))
                {
                    string chu = HeThong.S(v, "DriveLetter");
                    if (chu.Length == 0) continue;
                    long loai = HeThong.L(v, "VolumeType"), bv = HeThong.L(v, "ProtectionStatus");
                    string maHoa = "?", khoa = "";
                    try
                    {
                        ManagementBaseObject kq = v.InvokeMethod("GetConversionStatus", null, null);
                        long tt = HeThong.L(kq, "ConversionStatus"), pt = HeThong.L(kq, "EncryptionPercentage");
                        string[] ten = { "Không mã hóa", "Đã mã hóa", "Đang mã hóa", "Đang giải mã", "Tạm dừng mã hóa", "Tạm dừng giải mã" };
                        maHoa = tt >= 0 && tt < ten.Length ? ten[tt] : tt.ToString();
                        if (tt >= 2) maHoa += " (" + pt + "%)";
                        ManagementBaseObject k = v.InvokeMethod("GetLockStatus", null, null);
                        khoa = HeThong.L(k, "LockStatus") == 1 ? "ĐANG KHÓA" : "Mở";
                    }
                    catch (Exception) { }
                    ds.Add(new O
                    {
                        Chu = chu,
                        Loai = loai == 0 ? "Ổ hệ thống" : loai == 1 ? "Ổ cố định" : "Ổ rời / USB",
                        MaHoa = maHoa,
                        BaoVe = bv == 1 ? "BẬT" : bv == 0 ? "Tắt" : "?",
                        Khoa = khoa
                    });
                }
                ds.Sort((a, b) => string.Compare(a.Chu, b.Chu, StringComparison.Ordinal));
                return ds;
            }, ds =>
            {
                luoi.Rows.Clear();
                foreach (O o in ds)
                {
                    int r = luoi.Rows.Add(o.Chu, o.Loai, o.MaHoa, o.BaoVe, o.Khoa);
                    luoi.Rows[r].Tag = o.Chu;
                    if (o.MaHoa != "Không mã hóa") luoi.Rows[r].Cells[2].Style.ForeColor = Ui.CanhChu;
                }
                if (ds.Count == 0) NhatKy.Chung.Ghi("Không đọc được trạng thái BitLocker (máy không hỗ trợ hoặc chưa chạy quyền Admin).");
            });
        }

        string OChon()
        {
            if (luoi.CurrentRow == null)
            {
                Ui.BaoTin(CuaSo, "Chọn 1 ổ đĩa trong bảng.");
                return null;
            }
            return luoi.CurrentRow.Tag as string;
        }

        void LuuKhoa()
        {
            string o = OChon();
            if (o == null) return;
            using (var d = new SaveFileDialog
            {
                Filter = "Tệp văn bản (*.txt)|*.txt",
                FileName = "BitLocker_" + Environment.MachineName + "_" + o.TrimEnd(':') + ".txt"
            })
            {
                if (d.ShowDialog(CuaSo) != DialogResult.OK) return;
                string tep = d.FileName;
                if (tep.StartsWith(o, StringComparison.OrdinalIgnoreCase) &&
                    !Ui.HoiCanhBao(CuaSo, "Đang lưu khóa khôi phục vào chính ổ " + o + " — nếu ổ bị khóa sẽ không đọc được tệp này. Vẫn lưu?")) return;
                TacVu.Chay("Lưu khóa khôi phục " + o, log =>
                {
                    string kq = HeThong.KetQua(ManageBde, "-protectors -get " + o, null, 30000);
                    File.WriteAllText(tep, "Máy: " + Environment.MachineName + "   Ổ: " + o + "   Ngày: " + DateTime.Now.ToString("dd/MM/yyyy HH:mm") + "\r\n\r\n" + kq);
                    log.Tot("Đã lưu: " + tep + " — cất ở nơi an toàn (USB, giấy in...).");
                });
            }
        }

        void TatBitLocker()
        {
            string o = OChon();
            if (o == null) return;
            if (!Ui.HoiCanhBao(CuaSo, "Tắt BitLocker và giải mã ổ " + o + "?\nQuá trình giải mã chạy nền, có thể mất từ vài phút đến vài giờ; vẫn dùng máy bình thường được.")) return;
            TacVu.Chay("Tắt BitLocker " + o, log => HeThong.Chay(log, ManageBde, "-off " + o), Nap);
        }

        void MoKhoaO()
        {
            string o = OChon();
            if (o == null) return;
            string[] kq = FormNhap.Hien(CuaSo, "Mở khóa ổ " + o, "Nhập khóa khôi phục 48 số (dạng 111111-222222-...).", "Mở khóa",
                TruongNhap.Chu("Khóa khôi phục", "", true));
            if (kq == null) return;
            string khoa = kq[0].Replace(" ", "");
            TacVu.Chay("Mở khóa ổ " + o, log => HeThong.Chay(log, ManageBde, "-unlock " + o + " -RecoveryPassword " + khoa, null, false), Nap);
        }

        void GiaiMaEfs()
        {
            string d = Ui.ChonThuMuc(CuaSo, "Chọn thư mục cần giải mã EFS (gồm cả thư mục con):", null);
            if (d == null) return;
            TacVu.Chay("Giải mã EFS", log => HeThong.Chay(log, HeThong.Exe("cipher.exe"), "/d /a /i /s:" + HeThong.Nhay(d)));
        }
    }
}
