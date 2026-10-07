using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Chế độ máy chủ của ThatThoatNuoc.exe — do IIS (ASP.NET Core Module V2 trong Hosting Bundle 9.0, chế độ out-of-process)
    /// chạy: IIS nhận HTTP ở cổng 80 (website) rồi chuyển yêu cầu tới 127.0.0.1:ASPNETCORE_PORT.
    /// Máy chủ giữ dữ liệu, phục vụ trang web cho trình duyệt (máy tính, điện thoại) / app Android và đồng bộ với phần mềm trên máy tính.
    /// </summary>
    static class MayChu
    {
        const long MaxThan = 48L * 1024 * 1024;

        static DichVuMayChu dv;
        static string tokenIis = "";
        static string duongUngDung = "";

        public static bool LaCheDoMayChu(string[] args)
        {
            return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_PORT")) ||
                   args.Any(a => a == "--may-chu" || a == "--dat-quan-tri" || a == "--kiem-tra-may-chu");
        }

        public static string ThuMucDuLieu()
        {
            string d = Environment.GetEnvironmentVariable("THATTHOAT_DULIEU");
            if (string.IsNullOrWhiteSpace(d))
                d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ThatThoatNuoc", "MayChu");
            return Environment.ExpandEnvironmentVariables(d.Trim());
        }

        /// <summary>
        /// ThatThoatNuoc.exe --may-chu [--cong 18080]   chạy thử không cần IIS (chỉ nghe 127.0.0.1)
        /// ThatThoatNuoc.exe --dat-quan-tri &lt;tên&gt;      tạo / đặt lại mật khẩu tài khoản quản trị (mật khẩu trong biến THATTHOAT_MATKHAU)
        /// </summary>
        public static int Chay(string[] args)
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            string thuMuc = ThuMucDuLieu();
            try
            {
                dv = new DichVuMayChu(thuMuc);
            }
            catch (Exception ex)
            {
                GhiLoiKhoiDong(thuMuc, ex);
                return 3;
            }

            int i = Array.IndexOf(args, "--dat-quan-tri");
            if (i >= 0)
            {
                string ten = i + 1 < args.Length ? args[i + 1] : "admin";
                string mk = Environment.GetEnvironmentVariable("THATTHOAT_MATKHAU") ?? "";
                if (mk.Length < 6) return 4;
                dv.DatQuanTri(ten, mk);
                return 0;
            }
            if (args.Contains("--kiem-tra-may-chu")) return 0;

            tokenIis = Environment.GetEnvironmentVariable("ASPNETCORE_TOKEN") ?? "";
            duongUngDung = (Environment.GetEnvironmentVariable("ASPNETCORE_APPL_PATH") ?? "").TrimEnd('/');
            int cong;
            if (!int.TryParse(Environment.GetEnvironmentVariable("ASPNETCORE_PORT"), out cong) || cong <= 0)
            {
                int j = Array.IndexOf(args, "--cong");
                if (j < 0 || j + 1 >= args.Length || !int.TryParse(args[j + 1], out cong)) cong = 18080;
            }
            var listener = new TcpListener(IPAddress.Loopback, cong);
            listener.Start(200);
            dv.Ghi("Máy chủ chạy: 127.0.0.1:" + cong + (duongUngDung.Length > 0 ? ", đường dẫn " + duongUngDung : "") + ", dữ liệu " + thuMuc);
            while (true)
            {
                TcpClient c = listener.AcceptTcpClient();
                new Thread(() => PhucVu(c)) { IsBackground = true }.Start();
            }
        }

        static void GhiLoiKhoiDong(string thuMuc, Exception ex)
        {
            try
            {
                Directory.CreateDirectory(thuMuc);
                File.AppendAllText(Path.Combine(thuMuc, "loi-khoi-dong.txt"), DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + ex + "\r\n", Encoding.UTF8);
            }
            catch (Exception) { }
        }

        // ------------------------------------------------------------------ nhận yêu cầu từ IIS

        static void PhucVu(TcpClient c)
        {
            try
            {
                c.NoDelay = true;
                c.ReceiveTimeout = 130000;
                c.SendTimeout = 300000;
                NetworkStream ns = c.GetStream();
                var doc = new HttpBoDoc(ns);
                while (true)
                {
                    HttpYeuCau yc = doc.DocDau();
                    if (yc == null) break;
                    if (!XuLy(yc, doc, ns)) break;
                }
            }
            catch (Exception)
            {
                // IIS đóng kết nối / hết thời gian chờ
            }
            finally
            {
                c.Close();
            }
        }

        static bool XuLy(HttpYeuCau yc, HttpBoDoc doc, Stream ra)
        {
            bool giu = yc.GiuKetNoi;
            if (tokenIis.Length > 0 && !BangNhau(yc.Header("MS-ASPNETCORE-TOKEN"), tokenIis))
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
            string ce = yc.Header("Content-Encoding");
            if (than.Length > 0 && ce != null && ce.IndexOf("gzip", StringComparison.OrdinalIgnoreCase) >= 0) than = GiaiNen(than);

            string dich = yc.Dich;
            string duongGoc = dich.Split('?')[0];
            if (duongUngDung.Length > 0)
            {
                if (string.Equals(duongGoc, duongUngDung, StringComparison.OrdinalIgnoreCase))
                {
                    // "/thatthoat" → "/thatthoat/" để đường dẫn tương đối của trang web đúng.
                    // Giữ chữ người dùng gõ (IIS báo ASPNETCORE_APPL_PATH dạng chữ hoa, vd /THATTHOAT).
                    int hoiCham = dich.IndexOf('?');
                    Gui(ra, TraLoi.ChuyenHuong(duongGoc + "/" + (hoiCham < 0 ? "" : dich.Substring(hoiCham))), yc.PhuongThuc == "HEAD", giu);
                    return giu;
                }
                if (dich.StartsWith(duongUngDung + "/", StringComparison.OrdinalIgnoreCase)) dich = dich.Substring(duongUngDung.Length);
            }
            int hoi = dich.IndexOf('?');
            string duong = Uri.UnescapeDataString(hoi < 0 ? dich : dich.Substring(0, hoi));
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
                PhuongThuc = yc.PhuongThuc,
                Duong = duong,
                Query = q,
                Than = than,
                YeuCau = yc,
                Ip = IpThat(yc.Header("X-Forwarded-For")) ?? "127.0.0.1"
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
            if (d.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return ApiMayChu.XuLy(dv, ctx);
            if (ctx.PhuongThuc != "GET" && ctx.PhuongThuc != "HEAD") return TraLoi.Loi(405, "Phương thức không hỗ trợ.");
            if (d == "/" || d.Length == 0) d = "/index.html";
            if (d == "/tai-app" || d == "/tai-app/")
            {
                string apk = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ThatThoatNuoc-DienThoai.apk");
                if (!File.Exists(apk)) return TraLoi.Loi(404, "Máy chủ chưa có file cài app Android.");
                return TraLoi.Tep(File.ReadAllBytes(apk), "application/vnd.android.package-archive", "ThatThoatNuoc-DienThoai.apk");
            }
            string ten = d.TrimStart('/');
            if (ten.IndexOf('/') >= 0 || ten.IndexOf("..", StringComparison.Ordinal) >= 0) return TraLoi.Loi(404, "Không có trang này.");
            byte[] b = TepWeb(ten);
            if (b == null) return TraLoi.Loi(404, "Không có trang này.");
            var tl = new TraLoi { Status = 200, Than = b, Loai = LoaiTep(ten) };
            tl.Header["Cache-Control"] = ten == "index.html" ? "no-cache" : "no-cache";
            if (ten == "index.html")
                tl.Header["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'";
            return tl;
        }

        static readonly Dictionary<string, byte[]> boNhoWeb = new Dictionary<string, byte[]>();

        static byte[] TepWeb(string ten)
        {
            // khi sửa giao diện: THATTHOAT_WEB = thư mục web\ của mã nguồn → đọc thẳng tệp, không cần biên dịch lại
            string thu = Environment.GetEnvironmentVariable("THATTHOAT_WEB");
            if (!string.IsNullOrEmpty(thu) && File.Exists(Path.Combine(thu, ten))) return File.ReadAllBytes(Path.Combine(thu, ten));
            lock (boNhoWeb)
            {
                byte[] b;
                if (boNhoWeb.TryGetValue(ten, out b)) return b;
                using (Stream s = typeof(MayChu).Assembly.GetManifestResourceStream("ThatThoatNuoc.web." + ten))
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
            string e = Path.GetExtension(ten).ToLowerInvariant();
            switch (e)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "text/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".png": return "image/png";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".webmanifest": return "application/manifest+json; charset=utf-8";
                default: return "application/octet-stream";
            }
        }

        // ------------------------------------------------------------------ gửi trả lời

        static readonly HashSet<string> NenDuoc = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "text/html", "text/javascript", "text/css", "application/json", "application/xml", "image/svg+xml", "application/manifest+json"
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
            sb.Append("X-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\n");
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

        static byte[] GiaiNen(byte[] b)
        {
            using (var vao = new MemoryStream(b))
            using (var gz = new GZipStream(vao, CompressionMode.Decompress))
            using (var ra = new MemoryStream())
            {
                var buf = new byte[81920];
                int n;
                while ((n = gz.Read(buf, 0, buf.Length)) > 0)
                {
                    ra.Write(buf, 0, n);
                    if (ra.Length > MaxThan * 4) throw new LoiApi(413, "Dữ liệu gửi lên quá lớn.");
                }
                return ra.ToArray();
            }
        }

        static Dictionary<string, string> DocQuery(string q)
        {
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (string p in q.Split('&'))
            {
                if (p.Length == 0) continue;
                int e = p.IndexOf('=');
                string k = Uri.UnescapeDataString((e < 0 ? p : p.Substring(0, e)).Replace('+', ' '));
                string v = e < 0 ? "" : Uri.UnescapeDataString(p.Substring(e + 1).Replace('+', ' '));
                d[k] = v;
            }
            return d;
        }

        /// <summary>IIS nối địa chỉ thật của điện thoại vào cuối X-Forwarded-For (dạng ip:cổng).</summary>
        static string IpThat(string xff)
        {
            if (string.IsNullOrEmpty(xff)) return null;
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

        public static bool BangNhau(string a, string b)
        {
            if (a == null || b == null || a.Length != b.Length) return false;
            int khac = 0;
            for (int i = 0; i < a.Length; i++) khac |= a[i] ^ b[i];
            return khac == 0;
        }
    }

    class LoiApi : Exception
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
        public TaiKhoanMayChu NguoiDung;

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
            return new TraLoi { Status = status, Loai = "application/json; charset=utf-8", Than = Encoding.UTF8.GetBytes(JsonMayChu.Viet(o)) };
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
            string ascii = new string(NhapExcel.BoDau(tenFile).Select(c => c < 128 && c != '"' && c != '\\' ? c : '_').ToArray());
            t.Header["Content-Disposition"] = "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + Uri.EscapeDataString(tenFile);
            return t;
        }
    }

    /// <summary>Một yêu cầu HTTP/1.1 IIS chuyển tới.</summary>
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

    /// <summary>Đọc yêu cầu HTTP từ kết nối với IIS, có bộ đệm.</summary>
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
