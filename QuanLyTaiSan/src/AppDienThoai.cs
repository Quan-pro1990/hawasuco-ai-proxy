using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace QuanLyTaiSan
{
    using O = Dictionary<string, object>;

    /// <summary>
    /// App Android QuanLyTaiSan-DienThoai.apk đặt cạnh QuanLyTaiSan.exe (bộ cài IIS chép vào thư mục site): điện thoại tải
    /// ở địa chỉ /tai-app. Đọc versionCode / versionName trong AndroidManifest.xml của APK để /api/ping báo cho app biết có
    /// bản mới (app so với phiên bản của chính nó rồi hỏi cập nhật).
    /// </summary>
    static class AppDienThoai
    {
        public const string TenTep = "QuanLyTaiSan-DienThoai.apk";
        const int IdVersionCode = 0x0101021b, IdVersionName = 0x0101021c;   // android:versionCode, android:versionName

        static readonly object khoa = new object();
        static string daDoc;
        static DateTime lucSua;
        static long coTep;
        static int ma;
        static string phienBan = "";

        public static string DuongDan()
        {
            string p = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, TenTep);
            return File.Exists(p) ? p : null;
        }

        /// <summary>{ phienBan, ma, kichThuoc } của APK trên máy chủ; null nếu không có APK hoặc APK hỏng.</summary>
        public static O ThongTin()
        {
            string p = DuongDan();
            if (p == null) return null;
            var fi = new FileInfo(p);
            lock (khoa)
            {
                if (p != daDoc || fi.LastWriteTimeUtc != lucSua || fi.Length != coTep)
                {
                    daDoc = p;
                    lucSua = fi.LastWriteTimeUtc;
                    coTep = fi.Length;
                    try { DocPhienBan(File.ReadAllBytes(p), out ma, out phienBan); }
                    catch (Exception) { ma = 0; phienBan = ""; }
                }
                if (ma <= 0) return null;
                return new O { { "phienBan", phienBan }, { "ma", ma }, { "kichThuoc", coTep } };
            }
        }

        /// <summary>Đọc versionCode, versionName trong AndroidManifest.xml (dạng XML nhị phân của Android) của tệp APK.</summary>
        public static void DocPhienBan(byte[] apk, out int maPhienBan, out string tenPhienBan)
        {
            maPhienBan = 0;
            tenPhienBan = "";
            byte[] b;
            using (var z = new ZipArchive(new MemoryStream(apk), ZipArchiveMode.Read))
            {
                ZipArchiveEntry e = z.GetEntry("AndroidManifest.xml");
                if (e == null) throw new InvalidDataException("APK không có AndroidManifest.xml");
                using (Stream s = e.Open())
                using (var ms = new MemoryStream())
                {
                    s.CopyTo(ms);
                    b = ms.ToArray();
                }
            }
            if (b.Length < 8 || U16(b, 0) != 0x0003) throw new InvalidDataException("AndroidManifest.xml không phải XML nhị phân");
            List<string> chuoi = new List<string>();
            int[] idTaiNguyen = new int[0];
            int pos = U16(b, 2);
            while (pos + 8 <= b.Length)
            {
                int loai = U16(b, pos), dau = U16(b, pos + 2), co = I32(b, pos + 4);
                if (co < 8 || pos + co > b.Length) break;
                if (loai == 0x0001) chuoi = DocChuoi(b, pos);
                else if (loai == 0x0180)
                {
                    idTaiNguyen = new int[(co - dau) / 4];
                    for (int i = 0; i < idTaiNguyen.Length; i++) idTaiNguyen[i] = I32(b, pos + dau + i * 4);
                }
                else if (loai == 0x0102)
                {
                    // ResXMLTree_attrExt: ns, name, attributeStart, attributeSize, attributeCount …
                    int x = pos + dau;
                    int ten = I32(b, x + 4);
                    if (ten >= 0 && ten < chuoi.Count && chuoi[ten] == "manifest")
                    {
                        int batDau = U16(b, x + 8), coTT = U16(b, x + 10), so = U16(b, x + 12);
                        for (int i = 0; i < so; i++)
                        {
                            // ResXMLTree_attribute: ns, name, rawValue, Res_value { size, res0, dataType, data }
                            int a = x + batDau + i * coTT;
                            int tenTT = I32(b, a + 4), tho = I32(b, a + 8), kieu = b[a + 15], duLieu = I32(b, a + 16);
                            int id = tenTT >= 0 && tenTT < idTaiNguyen.Length ? idTaiNguyen[tenTT] : 0;
                            string tenChu = tenTT >= 0 && tenTT < chuoi.Count ? chuoi[tenTT] : "";
                            if (id == IdVersionCode || tenChu == "versionCode") maPhienBan = duLieu;
                            else if (id == IdVersionName || tenChu == "versionName")
                                tenPhienBan = tho >= 0 && tho < chuoi.Count ? chuoi[tho] : kieu == 0x03 && duLieu >= 0 && duLieu < chuoi.Count ? chuoi[duLieu] : "";
                        }
                        return;
                    }
                }
                pos += co;
            }
        }

        static List<string> DocChuoi(byte[] b, int pos)
        {
            int dau = U16(b, pos + 2), so = I32(b, pos + 8), co = I32(b, pos + 16), batDau = I32(b, pos + 20);
            bool utf8 = (co & 0x100) != 0;
            var ds = new List<string>(so);
            for (int i = 0; i < so; i++)
            {
                int p = pos + batDau + I32(b, pos + dau + i * 4);
                if (utf8)
                {
                    p += (b[p] & 0x80) != 0 ? 2 : 1;                   // số ký tự (bỏ qua)
                    int n = b[p] & 0x7f;
                    if ((b[p] & 0x80) != 0) { n = (n << 8) | b[p + 1]; p += 2; } else p += 1;
                    ds.Add(Encoding.UTF8.GetString(b, p, n));
                }
                else
                {
                    int n = U16(b, p);
                    if ((n & 0x8000) != 0) { n = ((n & 0x7fff) << 16) | U16(b, p + 2); p += 4; } else p += 2;
                    ds.Add(Encoding.Unicode.GetString(b, p, n * 2));
                }
            }
            return ds;
        }

        static int U16(byte[] b, int i) { return b[i] | (b[i + 1] << 8); }
        static int I32(byte[] b, int i) { return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24); }
    }
}
