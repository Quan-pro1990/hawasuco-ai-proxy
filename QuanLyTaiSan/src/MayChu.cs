using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace QuanLyTaiSan
{
    /// <summary>
    /// Máy chủ HTTP của QuanLyTaiSan.exe. Dưới IIS (HttpPlatformHandler, hoặc ASP.NET Core Module V2 của gói cài cũ): IIS nhận
    /// HTTP / HTTPS rồi chuyển yêu cầu dạng HTTP tới 127.0.0.1:&lt;cổng IIS giao&gt;. Chạy riêng (nhấp đúp file .exe): nghe
    /// 127.0.0.1:18090 để dùng thử trên máy này.
    /// </summary>
    static class MayChu
    {
        const long MaxThan = 40L * 1024 * 1024;

        static DichVu dv;
        static string tokenIis = "";
        static string duongUngDung = "";
        static bool quaIisChay;   // chỉ nghe 127.0.0.1, mọi yêu cầu do IIS chuyển tới: tin X-Forwarded-For (IP thật của người dùng)
        static readonly System.Text.RegularExpressions.Regex MaXacMinh = new System.Text.RegularExpressions.Regex(@"^[A-Za-z0-9_-]{16,128}$");

        public static void Chay(DichVu dichVu, IPAddress diaChi, int cong, bool quaIis)
        {
            dv = dichVu;
            quaIisChay = quaIis;
            if (quaIis)
            {
                tokenIis = Environment.GetEnvironmentVariable("ASPNETCORE_TOKEN") ?? "";
                duongUngDung = (Environment.GetEnvironmentVariable("ASPNETCORE_APPL_PATH") ?? "").TrimEnd('/');
            }
            var listener = new TcpListener(diaChi, cong);
            listener.Start(200);
            dv.Ghi("Máy chủ chạy: " + diaChi + ":" + cong + (duongUngDung.Length > 0 ? ", đường dẫn " + duongUngDung : "") + ", dữ liệu " + dv.ThuMuc);
            while (true)
            {
                TcpClient c = listener.AcceptTcpClient();
                new Thread(() => PhucVu(c)) { IsBackground = true }.Start();
            }
        }

        // ------------------------------------------------------------------ nhận yêu cầu

        static void PhucVu(TcpClient c)
        {
            try
            {
                c.NoDelay = true;
                c.ReceiveTimeout = 130000;
                c.SendTimeout = 300000;
                string ipSocket = "127.0.0.1";
                var ep = c.Client.RemoteEndPoint as IPEndPoint;
                if (ep != null) ipSocket = ep.Address.ToString();
                NetworkStream ns = c.GetStream();
                var doc = new HttpBoDoc(ns);
                while (true)
                {
                    HttpYeuCau yc = doc.DocDau();
                    if (yc == null) break;
                    if (!XuLy(yc, doc, ns, ipSocket)) break;
                }
            }
            catch (Exception)
            {
                // IIS / trình duyệt đóng kết nối, hết thời gian chờ
            }
            finally
            {
                c.Close();
            }
        }

        static bool XuLy(HttpYeuCau yc, HttpBoDoc doc, Stream ra, string ipSocket)
        {
            bool giu = yc.GiuKetNoi;
            if (tokenIis.Length > 0 && !DichVu.BangNhau(yc.Header("MS-ASPNETCORE-TOKEN"), tokenIis))
            {
                Gui(ra, TraLoi.Loi(400, "Yêu cầu không đi qua IIS."), false, false);
                return false;
            }
            string ex = yc.Header("Expect");
            long dai = yc.DoDaiThan;
            if (dai != 0 && ex != null && ex.IndexOf("100-continue", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                byte[] cont = Encoding.ASCII.GetBytes("HTTP/1.1 100 Continue\r\n\r\n");
                ra.Write(cont, 0, cont.Length);
                ra.Flush();
            }
            if (dai > MaxThan)
            {
                Gui(ra, TraLoi.Loi(413, "Dữ liệu gửi lên quá lớn."), false, false);
                return false;
            }
            byte[] than = dai > 0 ? doc.DocThan(dai) : dai < 0 ? doc.DocChunked(MaxThan) : new byte[0];

            string dich = yc.Dich;
            string duongGoc = dich.Split('?')[0];
            if (duongUngDung.Length > 0)
            {
                if (string.Equals(duongGoc, duongUngDung, StringComparison.OrdinalIgnoreCase))
                {
                    // "/taisan" → "/taisan/" để đường dẫn tương đối của trang web đúng
                    Gui(ra, TraLoi.ChuyenHuong(duongUngDung + "/"), yc.PhuongThuc == "HEAD", giu);
                    return giu;
                }
                if (dich.StartsWith(duongUngDung + "/", StringComparison.OrdinalIgnoreCase)) dich = dich.Substring(duongUngDung.Length);
            }
            int hoi = dich.IndexOf('?');
            string duong;
            try { duong = Uri.UnescapeDataString(hoi < 0 ? dich : dich.Substring(0, hoi)); }
            catch (Exception) { duong = "/"; }
            var q = DocQuery(hoi < 0 ? "" : dich.Substring(hoi + 1));

            if (yc.PhuongThuc == "POST" && duong.EndsWith("/iisintegration", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(yc.Header("MS-ASPNETCORE-EVENT"), "shutdown", StringComparison.OrdinalIgnoreCase))
            {
                Gui(ra, new TraLoi { Status = 202 }, false, false);
                new Thread(() => { Thread.Sleep(200); dv.Dung(); Environment.Exit(0); }) { IsBackground = true }.Start();
                return false;
            }

            var ctx = new NguCanh
            {
                PhuongThuc = yc.PhuongThuc, Duong = duong, Query = q, Than = than, YeuCau = yc,
                Ip = IpThat(yc.Header("X-Forwarded-For")) ?? ipSocket
            };
            TraLoi tl;
            try
            {
                tl = DinhTuyen(ctx);
            }
            catch (LoiApi la)
            {
                tl = TraLoi.Loi(la.Status, la.Message);
            }
            catch (Exception exx)
            {
                dv.Ghi("Lỗi " + yc.PhuongThuc + " " + duong + ": " + exx);
                tl = TraLoi.Loi(500, "Lỗi máy chủ: " + exx.Message);
            }
            string ae = yc.Header("Accept-Encoding") ?? "";
            Gui(ra, tl, yc.PhuongThuc == "HEAD", giu, ae.IndexOf("gzip", StringComparison.OrdinalIgnoreCase) >= 0);
            return giu;
        }

        static TraLoi DinhTuyen(NguCanh ctx)
        {
            string d = ctx.Duong;
            if (d.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return Api.XuLy(dv, ctx);
            if (ctx.PhuongThuc != "GET" && ctx.PhuongThuc != "HEAD") return TraLoi.Loi(405, "Phương thức không hỗ trợ.");
            // Let's Encrypt (win-acme) xác minh tên miền qua http: tệp do win-acme ghi vào thư mục site (thư mục chứa file .exe)
            if (d.StartsWith("/.well-known/acme-challenge/", StringComparison.Ordinal))
            {
                string ma = d.Substring("/.well-known/acme-challenge/".Length);
                string tep = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".well-known", "acme-challenge", ma);
                if (!MaXacMinh.IsMatch(ma) || !File.Exists(tep)) return TraLoi.Loi(404, "Không có tệp xác minh này.");
                return new TraLoi { Status = 200, Than = File.ReadAllBytes(tep), Loai = "text/plain" };
            }
            // Địa chỉ in trong mã QR: …/t/MÃ → mở trang tài sản (camera điện thoại quét là vào thẳng)
            if (d.StartsWith("/t/", StringComparison.OrdinalIgnoreCase))
            {
                string ma = MaTaiSan.Chuan(d.Substring(3).Trim('/'));
                return TraLoi.ChuyenHuong(duongUngDung + "/#/ma/" + Uri.EscapeDataString(ma));
            }
            if (d == "/" || d.Length == 0) d = "/index.html";
            string ten = d.TrimStart('/');
            if (ten.IndexOf('/') >= 0 || ten.IndexOf("..", StringComparison.Ordinal) >= 0) return TraLoi.Loi(404, "Không có trang này.");
            byte[] b = TepWeb(ten);
            if (b == null) return TraLoi.Loi(404, "Không có trang này.");
            var tl = new TraLoi { Status = 200, Than = b, Loai = LoaiTep(ten) };
            tl.Header["Cache-Control"] = "no-cache";
            if (ten == "index.html")
            {
                tl.Header["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
                                                      "script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
                tl.Header["Permissions-Policy"] = "camera=(self), geolocation=(self), microphone=()";
            }
            return tl;
        }

        static readonly Dictionary<string, byte[]> boNhoWeb = new Dictionary<string, byte[]>();

        static byte[] TepWeb(string ten)
        {
            // khi sửa giao diện: QLTS_WEB = thư mục web\ của mã nguồn → đọc thẳng tệp, không cần biên dịch lại
            string thu = Environment.GetEnvironmentVariable("QLTS_WEB");
            if (!string.IsNullOrEmpty(thu)) return File.Exists(Path.Combine(thu, ten)) ? File.ReadAllBytes(Path.Combine(thu, ten)) : null;
            lock (boNhoWeb)
            {
                byte[] b;
                if (boNhoWeb.TryGetValue(ten, out b)) return b;
                using (Stream s = typeof(MayChu).Assembly.GetManifestResourceStream("QuanLyTaiSan.web." + ten))
                {
                    if (s == null) return null;
                    var ms = new MemoryStream();
                    s.CopyTo(ms);
                    b = ms.ToArray();
                }
                boNhoWeb[ten] = b;
                return b;
            }
        }

        static string LoaiTep(string ten)
        {
            switch (Path.GetExtension(ten).ToLowerInvariant())
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "text/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".png": return "image/png";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".txt": return "text/plain; charset=utf-8";
                case ".webmanifest": return "application/manifest+json; charset=utf-8";
                default: return "application/octet-stream";
            }
        }

        // ------------------------------------------------------------------ gửi trả lời

        static readonly HashSet<string> NenDuoc = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "text/html", "text/javascript", "text/css", "text/plain", "application/json", "image/svg+xml", "application/manifest+json"
        };

        static void Gui(Stream ra, TraLoi tl, bool head, bool giu, bool gzip = false)
        {
            byte[] b = tl.Than ?? new byte[0];
            string loaiGoc = (tl.Loai ?? "").Split(';')[0].Trim();
            bool nen = gzip && b.Length > 1024 && NenDuoc.Contains(loaiGoc);
            if (nen)
            {
                using (var ms = new MemoryStream())
                {
                    using (var gz = new GZipStream(ms, CompressionLevel.Fastest, true)) gz.Write(b, 0, b.Length);
                    b = ms.ToArray();
                }
            }
            var sb = new StringBuilder();
            sb.Append("HTTP/1.1 ").Append(tl.Status).Append(' ').Append(LyDo(tl.Status)).Append("\r\n");
            if (tl.Loai != null) sb.Append("Content-Type: ").Append(tl.Loai).Append("\r\n");
            if (nen) sb.Append("Content-Encoding: gzip\r\nVary: Accept-Encoding\r\n");
            sb.Append("Content-Length: ").Append(b.Length).Append("\r\n");
            if (!tl.Header.ContainsKey("Cache-Control")) sb.Append("Cache-Control: no-store\r\n");
            sb.Append("X-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nX-Frame-Options: DENY\r\n");
            foreach (var h in tl.Header) sb.Append(h.Key).Append(": ").Append(h.Value.Replace("\r", "").Replace("\n", "")).Append("\r\n");
            sb.Append("Connection: ").Append(giu ? "keep-alive" : "close").Append("\r\n\r\n");
            byte[] hb = Encoding.UTF8.GetBytes(sb.ToString());
            ra.Write(hb, 0, hb.Length);
            if (!head && b.Length > 0) ra.Write(b, 0, b.Length);
            ra.Flush();
        }

        static string LyDo(int s)
        {
            switch (s)
            {
                case 200: return "OK";
                case 202: return "Accepted";
                case 302: return "Found";
                case 400: return "Bad Request";
                case 401: return "Unauthorized";
                case 403: return "Forbidden";
                case 404: return "Not Found";
                case 405: return "Method Not Allowed";
                case 409: return "Conflict";
                case 413: return "Payload Too Large";
                case 429: return "Too Many Requests";
                case 500: return "Internal Server Error";
                default: return "Status";
            }
        }

        // ------------------------------------------------------------------ tiện ích

        static Dictionary<string, string> DocQuery(string q)
        {
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (string p in q.Split('&'))
            {
                if (p.Length == 0) continue;
                int e = p.IndexOf('=');
                try
                {
                    string k = Uri.UnescapeDataString((e < 0 ? p : p.Substring(0, e)).Replace('+', ' '));
                    string v = e < 0 ? "" : Uri.UnescapeDataString(p.Substring(e + 1).Replace('+', ' '));
                    d[k] = v;
                }
                catch (Exception) { }
            }
            return d;
        }

        /// <summary>
        /// IP thật của người dùng: luật URL Rewrite trong web.config đặt X-Forwarded-For = địa chỉ máy gọi tới IIS (HttpPlatformHandler);
        /// ASP.NET Core Module nối "ip:cổng" vào cuối header.
        /// </summary>
        static string IpThat(string xff)
        {
            if (string.IsNullOrEmpty(xff) || !quaIisChay) return null;
            string s = xff.Split(',').Last().Trim();
            if (s.StartsWith("["))
            {
                int e = s.IndexOf(']');
                s = e > 0 ? s.Substring(1, e - 1) : s;
            }
            else
            {
                int c = s.IndexOf(':');
                if (c > 0 && s.IndexOf(':', c + 1) < 0) s = s.Substring(0, c);
            }
            IPAddress a;
            return IPAddress.TryParse(s, out a) ? a.ToString() : null;
        }
    }

    public class LoiApi : Exception
    {
        public readonly int Status;
        public LoiApi(int status, string message) : base(message) { Status = status; }
    }

    /// <summary>1 yêu cầu đã đọc xong (kể cả thân).</summary>
    class NguCanh
    {
        public string PhuongThuc, Duong, Ip;
        public Dictionary<string, string> Query;
        public byte[] Than;
        public HttpYeuCau YeuCau;
        public TaiKhoan NguoiDung;

        public string Q(string k)
        {
            string v;
            return Query.TryGetValue(k, out v) ? v : null;
        }

        public string Header(string k) { return YeuCau.Header(k); }
    }

    class TraLoi
    {
        public int Status = 200;
        public string Loai;
        public byte[] Than;
        public readonly Dictionary<string, string> Header = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public static TraLoi Json(object o, int status = 200)
        {
            return new TraLoi { Status = status, Loai = "application/json; charset=utf-8", Than = Encoding.UTF8.GetBytes(QuanLyTaiSan.Json.Viet(o)) };
        }

        public static TraLoi Loi(int status, string loi)
        {
            return Json(new Dictionary<string, object> { { "loi", loi } }, status);
        }

        public static TraLoi ChuyenHuong(string den)
        {
            var t = new TraLoi { Status = 302, Loai = "text/plain; charset=utf-8", Than = new byte[0] };
            t.Header["Location"] = den;
            return t;
        }

        public static TraLoi Tep(byte[] b, string loai, string tenFile)
        {
            var t = new TraLoi { Status = 200, Loai = loai, Than = b };
            string ascii = new string(VanBan.BoDauGiuHoa(tenFile).Select(c => c < 128 && c >= ' ' && c != '"' && c != '\\' ? c : '_').ToArray());
            t.Header["Content-Disposition"] = "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + Uri.EscapeDataString(tenFile);
            return t;
        }
    }

    /// <summary>Một yêu cầu HTTP/1.1.</summary>
    sealed class HttpYeuCau
    {
        public string PhuongThuc, Dich, PhienBan;
        public readonly List<KeyValuePair<string, string>> Headers = new List<KeyValuePair<string, string>>();

        public string Header(string ten)
        {
            foreach (KeyValuePair<string, string> h in Headers)
                if (string.Equals(h.Key, ten, StringComparison.OrdinalIgnoreCase)) return h.Value;
            return null;
        }

        /// <summary>-1 = chunked, 0 = không có thân.</summary>
        public long DoDaiThan
        {
            get
            {
                string te = Header("Transfer-Encoding");
                if (te != null && te.IndexOf("chunked", StringComparison.OrdinalIgnoreCase) >= 0) return -1;
                long n;
                return long.TryParse(Header("Content-Length"), out n) && n > 0 ? n : 0;
            }
        }

        public bool GiuKetNoi
        {
            get
            {
                string c = Header("Connection") ?? "";
                if (PhienBan == "HTTP/1.0") return c.IndexOf("keep-alive", StringComparison.OrdinalIgnoreCase) >= 0;
                return c.IndexOf("close", StringComparison.OrdinalIgnoreCase) < 0;
            }
        }
    }

    /// <summary>Đọc yêu cầu HTTP từ kết nối, có bộ đệm.</summary>
    sealed class HttpBoDoc
    {
        readonly Stream s;
        readonly byte[] buf = new byte[65536];
        int dau, cuoi;

        public HttpBoDoc(Stream s) { this.s = s; }

        bool Nap()
        {
            if (dau > 0)
            {
                Buffer.BlockCopy(buf, dau, buf, 0, cuoi - dau);
                cuoi -= dau;
                dau = 0;
            }
            if (cuoi == buf.Length) return false;
            int n = s.Read(buf, cuoi, buf.Length - cuoi);
            if (n <= 0) return false;
            cuoi += n;
            return true;
        }

        int TimHetDau()
        {
            for (int i = dau; i + 3 < cuoi; i++)
                if (buf[i] == 13 && buf[i + 1] == 10 && buf[i + 2] == 13 && buf[i + 3] == 10) return i;
            return -1;
        }

        public HttpYeuCau DocDau()
        {
            int het;
            while ((het = TimHetDau()) < 0)
            {
                if (!Nap())
                {
                    if (cuoi - dau == 0) return null;
                    throw new IOException("Header quá dài hoặc kết nối bị ngắt.");
                }
            }
            string text = Encoding.UTF8.GetString(buf, dau, het - dau);
            dau = het + 4;
            string[] dong = text.Split(new[] { "\r\n" }, StringSplitOptions.None);
            string[] dau1 = dong[0].Split(' ');
            if (dau1.Length < 3) throw new IOException("Dòng yêu cầu sai.");
            var yc = new HttpYeuCau { PhuongThuc = dau1[0].ToUpperInvariant(), Dich = dau1[1], PhienBan = dau1[2] };
            for (int i = 1; i < dong.Length; i++)
            {
                int c = dong[i].IndexOf(':');
                if (c <= 0) continue;
                yc.Headers.Add(new KeyValuePair<string, string>(dong[i].Substring(0, c).Trim(), dong[i].Substring(c + 1).Trim()));
            }
            return yc;
        }

        public byte[] DocThan(long n)
        {
            var ms = new MemoryStream((int)Math.Min(n, 1 << 20));
            ChepThan(n, ms);
            return ms.ToArray();
        }

        void ChepThan(long n, Stream dich)
        {
            while (n > 0)
            {
                if (cuoi - dau == 0)
                {
                    dau = cuoi = 0;
                    int r = s.Read(buf, 0, (int)Math.Min(buf.Length, n));
                    if (r <= 0) throw new IOException("Kết nối bị ngắt khi đang nhận dữ liệu.");
                    cuoi = r;
                }
                int k = (int)Math.Min(cuoi - dau, n);
                dich.Write(buf, dau, k);
                dau += k;
                n -= k;
            }
        }

        string DocDong()
        {
            while (true)
            {
                for (int i = dau; i + 1 < cuoi; i++)
                {
                    if (buf[i] == 13 && buf[i + 1] == 10)
                    {
                        string line = Encoding.ASCII.GetString(buf, dau, i - dau);
                        dau = i + 2;
                        return line;
                    }
                }
                if (!Nap()) throw new IOException("Kết nối bị ngắt.");
            }
        }

        public byte[] DocChunked(long max)
        {
            var ms = new MemoryStream();
            while (true)
            {
                string line = DocDong();
                int sc = line.IndexOf(';');
                if (sc >= 0) line = line.Substring(0, sc);
                long size = Convert.ToInt64(line.Trim(), 16);
                if (size == 0) break;
                if (ms.Length + size > max) throw new IOException("Dữ liệu quá lớn.");
                ChepThan(size, ms);
                DocDong();
            }
            while (DocDong().Length > 0) { }
            return ms.ToArray();
        }
    }
}
