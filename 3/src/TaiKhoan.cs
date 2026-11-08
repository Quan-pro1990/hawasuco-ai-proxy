using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.DirectoryServices;
using System.Runtime.InteropServices;
using System.Text;

namespace ToolkitIT
{
    /// <summary>Windows Credentials (Credential Manager) — lưu tài khoản đăng nhập máy chủ chia sẻ.</summary>
    static class KhoMatKhau
    {
        public const int LOAI_WINDOWS = 2;   // CRED_TYPE_DOMAIN_PASSWORD
        const int LUU_MAY = 2;               // CRED_PERSIST_LOCAL_MACHINE

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        struct CREDENTIAL
        {
            public int Flags;
            public int Type;
            public string TargetName;
            public string Comment;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
            public int CredentialBlobSize;
            public IntPtr CredentialBlob;
            public int Persist;
            public int AttributeCount;
            public IntPtr Attributes;
            public string TargetAlias;
            public string UserName;
        }

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool CredWrite(ref CREDENTIAL credential, int flags);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool CredDelete(string target, int type, int flags);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool CredEnumerate(string filter, int flags, out int count, out IntPtr credentials);

        [DllImport("advapi32.dll")]
        static extern void CredFree(IntPtr buffer);

        public class Muc
        {
            public string May, TaiKhoan;
            public int Loai;
        }

        public static List<Muc> DanhSach()
        {
            var kq = new List<Muc>();
            int n;
            IntPtr p;
            if (!CredEnumerate(null, 0, out n, out p)) return kq;
            try
            {
                for (int i = 0; i < n; i++)
                {
                    IntPtr ci = Marshal.ReadIntPtr(p, i * IntPtr.Size);
                    var c = (CREDENTIAL)Marshal.PtrToStructure(ci, typeof(CREDENTIAL));
                    if (c.Type != LOAI_WINDOWS) continue;
                    kq.Add(new Muc { May = c.TargetName, TaiKhoan = c.UserName, Loai = c.Type });
                }
            }
            finally
            {
                CredFree(p);
            }
            kq.Sort((a, b) => string.Compare(a.May, b.May, StringComparison.OrdinalIgnoreCase));
            return kq;
        }

        public static void Them(string may, string taiKhoan, string matKhau)
        {
            byte[] b = Encoding.Unicode.GetBytes(matKhau ?? "");
            var c = new CREDENTIAL();
            c.Type = LOAI_WINDOWS;
            c.TargetName = may;
            c.UserName = taiKhoan;
            c.Persist = LUU_MAY;
            c.CredentialBlobSize = b.Length;
            c.CredentialBlob = Marshal.AllocCoTaskMem(Math.Max(1, b.Length));
            try
            {
                Marshal.Copy(b, 0, c.CredentialBlob, b.Length);
                if (!CredWrite(ref c, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            finally
            {
                for (int i = 0; i < b.Length; i++) Marshal.WriteByte(c.CredentialBlob, i, 0);
                Marshal.FreeCoTaskMem(c.CredentialBlob);
            }
        }

        public static void Xoa(string may, int loai)
        {
            if (!CredDelete(may, loai, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
    }

    /// <summary>Tài khoản người dùng cục bộ (Local Users) — tạo user chia sẻ máy in / dữ liệu trong LAN.</summary>
    static class TaiKhoanMay
    {
        const int UF_ACCOUNTDISABLE = 0x2, UF_PASSWD_CANT_CHANGE = 0x40, UF_NORMAL_ACCOUNT = 0x200, UF_DONT_EXPIRE_PASSWD = 0x10000;
        const string AN_DANG_NHAP = @"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList";

        static DirectoryEntry May()
        {
            return new DirectoryEntry("WinNT://" + Environment.MachineName + ",computer");
        }

        public class Muc
        {
            public string Ten, HoTen, MoTa;
            public bool Khoa, KhongHetHan, AnDangNhap;
        }

        static int Co(DirectoryEntry u)
        {
            try { return Convert.ToInt32(u.Properties["UserFlags"].Value); }
            catch (Exception) { return 0; }
        }

        public static List<Muc> DanhSach()
        {
            var kq = new List<Muc>();
            using (DirectoryEntry may = May())
            {
                foreach (DirectoryEntry u in may.Children)
                {
                    using (u)
                    {
                        if (u.SchemaClassName != "User") continue;
                        int f = Co(u);
                        var m = new Muc
                        {
                            Ten = u.Name,
                            HoTen = Convert.ToString(u.Properties["FullName"].Value),
                            MoTa = Convert.ToString(u.Properties["Description"].Value),
                            Khoa = (f & UF_ACCOUNTDISABLE) != 0,
                            KhongHetHan = (f & UF_DONT_EXPIRE_PASSWD) != 0
                        };
                        m.AnDangNhap = HeThong.Doc(AN_DANG_NHAP, u.Name) is int && (int)HeThong.Doc(AN_DANG_NHAP, u.Name) == 0;
                        kq.Add(m);
                    }
                }
            }
            return kq;
        }

        /// <summary>Tên nhóm cục bộ theo SID (đúng cả trên Windows ngôn ngữ khác), vd S-1-5-32-545 = Users.</summary>
        public static string TenNhom(string sid)
        {
            string ten = HeThong.TenTuSid(sid);
            int i = ten.IndexOf('\\');
            return i >= 0 ? ten.Substring(i + 1) : ten;
        }

        public static void Tao(NhatKy log, string ten, string matKhau, string hoTen, bool khongHetHan, bool khongDoiMk, bool anDangNhap)
        {
            using (DirectoryEntry may = May())
            using (DirectoryEntry u = may.Children.Add(ten, "user"))
            {
                u.Invoke("SetPassword", new object[] { matKhau ?? "" });
                u.Invoke("Put", new object[] { "Description", "Tài khoản chia sẻ LAN (IT Toolkit)" });
                if (!string.IsNullOrEmpty(hoTen)) u.Invoke("Put", new object[] { "FullName", hoTen });
                u.CommitChanges();
                int f = UF_NORMAL_ACCOUNT;
                if (khongHetHan) f |= UF_DONT_EXPIRE_PASSWD;
                if (khongDoiMk) f |= UF_PASSWD_CANT_CHANGE;
                u.Invoke("Put", new object[] { "UserFlags", f });
                u.CommitChanges();
                log.Tot("Đã tạo tài khoản " + ten);
                string nhom = TenNhom("S-1-5-32-545");
                using (DirectoryEntry g = may.Children.Find(nhom, "group"))
                {
                    try
                    {
                        g.Invoke("Add", new object[] { u.Path });
                        log.Ghi("Đã thêm " + ten + " vào nhóm " + nhom);
                    }
                    catch (Exception ex)
                    {
                        log.Canh("Không thêm được vào nhóm " + nhom + ": " + HeThong.ThongDiep(ex));
                    }
                }
            }
            if (anDangNhap) HeThong.DatDword(log, AN_DANG_NHAP, ten, 0);
        }

        public static void DatMatKhau(NhatKy log, string ten, string matKhau)
        {
            using (DirectoryEntry may = May())
            using (DirectoryEntry u = may.Children.Find(ten, "user"))
            {
                u.Invoke("SetPassword", new object[] { matKhau ?? "" });
                u.CommitChanges();
            }
            log.Tot("Đã đặt mật khẩu mới cho " + ten);
        }

        public static void BatTat(NhatKy log, string ten, bool bat)
        {
            using (DirectoryEntry may = May())
            using (DirectoryEntry u = may.Children.Find(ten, "user"))
            {
                int f = Co(u);
                f = bat ? (f & ~UF_ACCOUNTDISABLE) : (f | UF_ACCOUNTDISABLE);
                u.Invoke("Put", new object[] { "UserFlags", f });
                u.CommitChanges();
            }
            log.Tot((bat ? "Đã bật" : "Đã khóa") + " tài khoản " + ten);
        }

        public static void Xoa(NhatKy log, string ten)
        {
            using (DirectoryEntry may = May())
            using (DirectoryEntry u = may.Children.Find(ten, "user"))
                may.Children.Remove(u);
            HeThong.XoaGiaTri(null, AN_DANG_NHAP, ten);
            log.Tot("Đã xóa tài khoản " + ten);
        }

        public static void AnKhoiDangNhap(NhatKy log, string ten, bool an)
        {
            if (an) HeThong.DatDword(log, AN_DANG_NHAP, ten, 0);
            else HeThong.XoaGiaTri(log, AN_DANG_NHAP, ten);
        }
    }
}
