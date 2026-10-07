using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace ThatThoatNuoc
{
    /// <summary>Lỗi khi gọi máy chủ: Status = mã HTTP (0 = không kết nối được).</summary>
    public class LoiMayChu : Exception
    {
        public readonly int Status;
        public LoiMayChu(int status, string message) : base(message) { Status = status; }
        public bool MatKetNoi { get { return Status == 0; } }
    }

    /// <summary>
    /// Kết nối của phần mềm trên máy tính tới website trên máy chủ IIS (HTTP cổng 80; dùng được cả https:// khi site có chứng chỉ thật):
    /// địa chỉ, tài khoản, mã đăng nhập (mã hoá DPAPI theo người dùng Windows), phiên bản dữ liệu đã đồng bộ.
    /// Lưu ở DuLieu\maychu.txt.
    /// </summary>
    public class MayChuKetNoi
    {
        const string TenTep = "maychu.txt";
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public string DiaChi = "";      // vd 192.168.1.10, tenmien.vn/thatthoat, tenmien.vn:8081 (http) hoặc https://tenmien.vn
        public string Ten = "", HoTen = "", VaiTro = "";
        public string Token = "";
        public string May = Guid.NewGuid().ToString("N");
        public long PhienBan;
        public bool ChuaGui;            // còn thay đổi trên máy chưa gửi được lên máy chủ
        public bool NhoDangNhap = true; // false: không lưu mã đăng nhập, mở phần mềm phải đăng nhập lại

        public bool LaHttps { get { return DiaChi.StartsWith("https://", StringComparison.OrdinalIgnoreCase); } }
        /// <summary>Địa chỉ trang web, vd http://192.168.1.10/ hoặc http://tenmien.vn/thatthoat/</summary>
        public string GocUrl { get { return (LaHttps ? "" : "http://") + DiaChi.TrimEnd('/') + "/"; } }
        public bool LaQuanTri { get { return VaiTro == "QuanTri"; } }

        // ------------------------------------------------------------------ tệp cấu hình

        public static MayChuKetNoi Doc(string thuMuc)
        {
            string p = Path.Combine(thuMuc, TenTep);
            if (!File.Exists(p)) return null;
            var kn = new MayChuKetNoi();
            string vanTay = "";
            foreach (string dong in File.ReadAllLines(p, Encoding.UTF8))
            {
                int e = dong.IndexOf('=');
                if (e <= 0) continue;
                string k = dong.Substring(0, e).Trim(), v = dong.Substring(e + 1).Trim();
                switch (k)
                {
                    case "DiaChi": kn.DiaChi = v; break;
                    case "VanTay": vanTay = v; break;
                    case "Ten": kn.Ten = v; break;
                    case "HoTen": kn.HoTen = v; break;
                    case "VaiTro": kn.VaiTro = v; break;
                    case "Token": kn.Token = MoKhoa(v); break;
                    case "May": if (v.Length > 0) kn.May = v; break;
                    case "PhienBan": long.TryParse(v, NumberStyles.Integer, Inv, out kn.PhienBan); break;
                    case "ChuaGui": kn.ChuaGui = v == "1"; break;
                    case "NhoDangNhap": kn.NhoDangNhap = v != "0"; break;
                }
            }
            // Bản cũ: HTTPS cổng 8080 + ghim chứng chỉ tự ký (có VanTay). Máy chủ nay là website HTTP cổng 80:
            // "ten.vn:8080/thatthoat" → "ten.vn/thatthoat" (giữ mã đăng nhập; sai thì người dùng kết nối lại).
            if (vanTay.Length > 0 && !kn.LaHttps) kn.DiaChi = BoCong8080(kn.DiaChi);
            kn.DiaChi = ChuanHoaDiaChi(kn.DiaChi);
            return kn.DiaChi.Length > 0 ? kn : null;
        }

        static string BoCong8080(string diaChi)
        {
            int g = diaChi.IndexOf('/');
            string host = g < 0 ? diaChi : diaChi.Substring(0, g), duong = g < 0 ? "" : diaChi.Substring(g);
            if (host.EndsWith(":8080", StringComparison.Ordinal)) host = host.Substring(0, host.Length - 5);
            return host + duong;
        }

        public void Ghi(string thuMuc)
        {
            string p = Path.Combine(thuMuc, TenTep);
            var dong = new[]
            {
                "# Kết nối máy chủ dữ liệu (website trên IIS) — phần mềm tự ghi, đừng sửa tay",
                "DiaChi=" + DiaChi, "Ten=" + Ten, "HoTen=" + HoTen, "VaiTro=" + VaiTro,
                "Token=" + (NhoDangNhap ? Khoa(Token) : ""), "NhoDangNhap=" + (NhoDangNhap ? "1" : "0"), "May=" + May, "PhienBan=" + PhienBan.ToString(Inv), "ChuaGui=" + (ChuaGui ? "1" : "0")
            };
            File.WriteAllLines(p + ".tmp", dong, new UTF8Encoding(false));
            if (File.Exists(p)) File.Replace(p + ".tmp", p, null);
            else File.Move(p + ".tmp", p);
        }

        public static void Xoa(string thuMuc)
        {
            string p = Path.Combine(thuMuc, TenTep);
            if (File.Exists(p)) File.Delete(p);
        }

        static string Khoa(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(s), Encoding.ASCII.GetBytes("ThatThoatNuoc"), DataProtectionScope.CurrentUser));
        }

        static string MoKhoa(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            try { return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(s), Encoding.ASCII.GetBytes("ThatThoatNuoc"), DataProtectionScope.CurrentUser)); }
            catch (Exception) { return ""; }   // tệp chép từ máy / người dùng khác: phải đăng nhập lại
        }

        // ------------------------------------------------------------------ địa chỉ

        /// <summary>
        /// "http://ten.vn/thatthoat/" → "ten.vn/thatthoat"; "ten.vn:80" → "ten.vn". Cổng mặc định 80 (http).
        /// Địa chỉ https:// giữ nguyên tiền tố (site có chứng chỉ thật, kiểm tra chứng chỉ như trình duyệt).
        /// </summary>
        public static string ChuanHoaDiaChi(string s)
        {
            s = (s ?? "").Trim().Replace('\\', '/');
            bool https = false;
            if (s.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) { https = true; s = s.Substring(8); }
            else if (s.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) s = s.Substring(7);
            int q = s.IndexOfAny(new[] { '?', '#' });
            if (q >= 0) s = s.Substring(0, q);
            s = s.Trim().TrimEnd('/');
            if (s.EndsWith("/index.html", StringComparison.OrdinalIgnoreCase)) s = s.Substring(0, s.Length - 11);
            if (s.Length == 0) return "";
            int g = s.IndexOf('/');
            string host = g < 0 ? s : s.Substring(0, g), duong = g < 0 ? "" : s.Substring(g);
            string congMacDinh = https ? ":443" : ":80";
            if (host.EndsWith(congMacDinh, StringComparison.Ordinal)) host = host.Substring(0, host.Length - congMacDinh.Length);
            return (https ? "https://" : "") + host.ToLowerInvariant() + duong;
        }

        // ------------------------------------------------------------------ gọi API

        HttpWebRequest TaoYeuCau(string method, string duong, int timeoutMs)
        {
            var r = (HttpWebRequest)WebRequest.Create(GocUrl + "api/" + duong);
            r.Method = method;
            r.Proxy = null;
            r.Timeout = timeoutMs;
            r.ReadWriteTimeout = timeoutMs;
            r.AllowAutoRedirect = false;
            r.AutomaticDecompression = DecompressionMethods.GZip;
            r.UserAgent = "ThatThoatNuoc-MayTinh/" + UngDung.PhienBan;
            r.Accept = "application/json";
            if (!string.IsNullOrEmpty(Token)) r.Headers["Authorization"] = "Bearer " + Token;
            return r;
        }

        byte[] Goi(HttpWebRequest r, byte[] than, bool gzip, out WebHeaderCollection headers)
        {
            try
            {
                if (than != null)
                {
                    if (gzip)
                    {
                        using (var ms = new MemoryStream())
                        {
                            using (var gz = new GZipStream(ms, CompressionLevel.Fastest, true)) gz.Write(than, 0, than.Length);
                            than = ms.ToArray();
                        }
                        r.Headers["Content-Encoding"] = "gzip";
                    }
                    r.ContentLength = than.Length;
                    using (Stream s = r.GetRequestStream()) s.Write(than, 0, than.Length);
                }
                else if (r.Method == "POST" || r.Method == "PUT") r.ContentLength = 0;
                using (var resp = (HttpWebResponse)r.GetResponse())
                using (Stream s = resp.GetResponseStream())
                using (var ms = new MemoryStream())
                {
                    s.CopyTo(ms);
                    headers = resp.Headers;
                    return ms.ToArray();
                }
            }
            catch (WebException ex)
            {
                var resp = ex.Response as HttpWebResponse;
                if (resp == null)
                {
                    string ly = ex.Status == WebExceptionStatus.TrustFailure || ex.Status == WebExceptionStatus.SecureChannelFailure
                        ? "Chứng chỉ HTTPS của máy chủ không hợp lệ (tự ký, hết hạn hoặc sai tên miền). Dùng địa chỉ http:// hoặc gắn chứng chỉ thật cho site trên IIS."
                        : ex.Status == WebExceptionStatus.Timeout ? "Máy chủ không trả lời kịp."
                        : ex.Status == WebExceptionStatus.NameResolutionFailure ? "Không tìm thấy tên máy chủ (kiểm tra địa chỉ / mạng)."
                        : ex.Status == WebExceptionStatus.ConnectFailure ? "Không kết nối được " + GocUrl + " (kiểm tra địa chỉ, mạng, máy chủ IIS có đang chạy)."
                        : "Mất kết nối với máy chủ (" + ex.Status + ").";
                    throw new LoiMayChu(0, ly);
                }
                using (resp)
                {
                    string loi = "";
                    try
                    {
                        using (var sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) loi = sr.ReadToEnd();
                        var d = JsonMayChu.DocGiaTri(loi) as Dictionary<string, object>;
                        if (d != null && d.ContainsKey("loi")) loi = Convert.ToString(d["loi"]);
                    }
                    catch (Exception) { }
                    if (loi.Length == 0 || loi.StartsWith("<")) loi = "Máy chủ báo lỗi " + (int)resp.StatusCode + ".";
                    throw new LoiMayChu((int)resp.StatusCode, loi);
                }
            }
        }

        public Dictionary<string, object> Json(string method, string duong, object than, int timeoutMs = 20000)
        {
            HttpWebRequest r = TaoYeuCau(method, duong, timeoutMs);
            byte[] b = null;
            if (than != null)
            {
                r.ContentType = "application/json; charset=utf-8";
                b = Encoding.UTF8.GetBytes(JsonMayChu.Viet(than));
            }
            WebHeaderCollection h;
            byte[] kq = Goi(r, b, false, out h);
            if (kq.Length == 0) return new Dictionary<string, object>();
            object o;
            try { o = JsonMayChu.DocGiaTri(Encoding.UTF8.GetString(kq)); }
            catch (Exception) { throw new LoiMayChu(500, GocUrl + " không phải máy chủ Thất thoát nước (trả về trang khác). Kiểm tra lại địa chỉ, vd thêm /thatthoat."); }
            return o as Dictionary<string, object> ?? new Dictionary<string, object>();
        }

        public Dictionary<string, object> Ping()
        {
            return Json("GET", "ping", null, 10000);
        }

        public void DangNhap(string ten, string matKhau)
        {
            Token = "";
            Dictionary<string, object> r = Json("POST", "dangnhap", new Dictionary<string, object>
            {
                { "ten", ten }, { "matKhau", matKhau }, { "thietBi", "Phần mềm máy tính · " + Environment.MachineName }
            });
            Token = Convert.ToString(r["token"]);
            Ten = Convert.ToString(r["ten"]);
            HoTen = r.ContainsKey("hoTen") ? Convert.ToString(r["hoTen"]) : "";
            VaiTro = Convert.ToString(r["vaiTro"]);
        }

        public byte[] TaiDuLieu(out long phienBan)
        {
            HttpWebRequest r = TaoYeuCau("GET", "dulieu", 60000);
            r.Accept = "application/xml";
            WebHeaderCollection h;
            byte[] b = Goi(r, null, false, out h);
            if (!long.TryParse(h["X-PhienBan"], NumberStyles.Integer, Inv, out phienBan)) throw new LoiMayChu(500, "Máy chủ không trả phiên bản dữ liệu.");
            return b;
        }

        public long LayPhienBan()
        {
            Dictionary<string, object> r = Json("GET", "phienban", null, 10000);
            return Convert.ToInt64(r["phienBan"], Inv);
        }

        public class KetQuaGui
        {
            public long PhienBan;
            public int DaGop;
        }

        public KetQuaGui GuiDuLieu(byte[] xml, long goc, bool ghiDe)
        {
            HttpWebRequest r = TaoYeuCau("PUT", "dulieu", 120000);
            r.ContentType = "application/xml";
            r.Headers["X-PhienBan-Goc"] = goc.ToString(Inv);
            r.Headers["X-May"] = May;
            if (ghiDe) r.Headers["X-GhiDe"] = "1";
            WebHeaderCollection h;
            byte[] b = Goi(r, xml, true, out h);
            var d = JsonMayChu.DocGiaTri(Encoding.UTF8.GetString(b)) as Dictionary<string, object>;
            return new KetQuaGui { PhienBan = Convert.ToInt64(d["phienBan"], Inv), DaGop = Convert.ToInt32(d["daGop"], Inv) };
        }

        public void DangXuat()
        {
            try { Json("POST", "dangxuat", new Dictionary<string, object>(), 5000); }
            catch (Exception) { }
            Token = "";
        }
    }
}
