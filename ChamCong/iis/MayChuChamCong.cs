// Máy chủ dữ liệu cho phần mềm "Nhân sự – Chấm công – Tiền lương" (ChamCong).
//
// Cách chạy: IIS (ASP.NET Core Module V2 trong ASP.NET Core Hosting Bundle, chế độ out-of-process) chạy
// ChamCongMayChu.exe với biến ASPNETCORE_PORT; IIS nhận HTTPS rồi chuyển yêu cầu HTTP tới 127.0.0.1:ASPNETCORE_PORT.
// Chương trình phục vụ trang web (index.html) và API lưu dữ liệu dùng chung, tài khoản đăng nhập, sao lưu hằng ngày.
//
// Biên dịch (bộ cài tự làm, không cần Visual Studio) – chỉ dùng cú pháp C# 5 của csc.exe có sẵn trong .NET Framework 4:
//   %WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /optimize+ /codepage:65001 /target:exe
//      /out:ChamCongMayChu.exe /r:System.Web.Extensions.dll MayChuChamCong.cs
//
// Dòng lệnh:
//   ChamCongMayChu.exe --dat-mat-khau <tên>    tạo / đặt lại tài khoản quản trị (mật khẩu trong biến CHAMCONG_MATKHAU)
//   ChamCongMayChu.exe --cong 18090            chạy thử không cần IIS (chỉ nghe 127.0.0.1)
//   ChamCongMayChu.exe --kiem-tra              kiểm tra mở được thư mục dữ liệu
// Biến môi trường: CHAMCONG_DULIEU = thư mục dữ liệu (mặc định %ProgramData%\ChamCong\MayChu);
//                  CHAMCONG_SAOLUU = thư mục chứa bản sao lưu hằng ngày (mặc định <dữ liệu>\SaoLuu), vd ổ D.
//                  CHAMCONG_CHI_HTTPS = 1: yêu cầu http được chuyển sang https (site có tên miền, cổng 80 → 443).
//                  CHAMCONG_HSTS = 1: gửi Strict-Transport-Security (chỉ bật khi dùng chứng chỉ thật, không tự ký).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace ChamCong
{
    static class Program
    {
        static int Main(string[] args)
        {
            return MayChu.Chay(args);
        }
    }

    static class MayChu
    {
        public const string PhienBanMayChu = "1.0";
        const long MaxThan = 64L * 1024 * 1024;

        static Kho kho;
        static string tokenIis = "";
        static string duongUngDung = "";
        static readonly bool chiHttps = Environment.GetEnvironmentVariable("CHAMCONG_CHI_HTTPS") == "1";
        static readonly bool hsts = Environment.GetEnvironmentVariable("CHAMCONG_HSTS") == "1";

        public static string ThuMucDuLieu()
        {
            string d = Environment.GetEnvironmentVariable("CHAMCONG_DULIEU");
            if (string.IsNullOrWhiteSpace(d))
                d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ChamCong", "MayChu");
            return Environment.ExpandEnvironmentVariables(d.Trim());
        }

        public static int Chay(string[] args)
        {
            string thuMuc = ThuMucDuLieu();
            try
            {
                kho = new Kho(thuMuc);
            }
            catch (Exception ex)
            {
                GhiLoiKhoiDong(thuMuc, ex);
                return 3;
            }

            int i = Array.IndexOf(args, "--dat-mat-khau");
            if (i >= 0)
            {
                string ten = i + 1 < args.Length ? args[i + 1] : "admin";
                string mk = Environment.GetEnvironmentVariable("CHAMCONG_MATKHAU") ?? "";
                if (mk.Length < 6) return 4;
                kho.DatTaiKhoan(ten, mk, "quan_tri", true, null);
                kho.Ghi("(cài đặt)", "", "Đặt tài khoản quản trị " + ten);
                return 0;
            }
            if (args.Contains("--kiem-tra")) return 0;

            tokenIis = Environment.GetEnvironmentVariable("ASPNETCORE_TOKEN") ?? "";
            duongUngDung = (Environment.GetEnvironmentVariable("ASPNETCORE_APPL_PATH") ?? "").TrimEnd('/');
            int cong;
            if (!int.TryParse(Environment.GetEnvironmentVariable("ASPNETCORE_PORT"), out cong) || cong <= 0)
            {
                int j = Array.IndexOf(args, "--cong");
                if (j < 0 || j + 1 >= args.Length || !int.TryParse(args[j + 1], out cong)) cong = 18090;
            }
            var listener = new TcpListener(IPAddress.Loopback, cong);
            listener.Start(200);
            kho.Ghi("(máy chủ)", "", "Khởi động: 127.0.0.1:" + cong + (duongUngDung.Length > 0 ? ", đường dẫn " + duongUngDung : "") + ", dữ liệu " + thuMuc);
            while (true)
            {
                TcpClient c = listener.AcceptTcpClient();
                var t = new Thread(PhucVu);
                t.IsBackground = true;
                t.Start(c);
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

        static void PhucVu(object o)
        {
            var c = (TcpClient)o;
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
                Gui(ra, TraLoi.Loi(400, "Yêu cầu không đi qua IIS."), false, false, false);
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
                Gui(ra, TraLoi.Loi(413, "Dữ liệu gửi lên quá lớn."), false, false, false);
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
                    Gui(ra, TraLoi.ChuyenHuong(duongUngDung + "/"), yc.PhuongThuc == "HEAD", giu, false);
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
                Gui(ra, new TraLoi { Status = 202 }, false, false, false);
                var t = new Thread(() => { Thread.Sleep(200); Environment.Exit(0); });
                t.IsBackground = true;
                t.Start();
                return false;
            }

            var ctx = new NguCanh
            {
                PhuongThuc = yc.PhuongThuc,
                Duong = duong,
                Query = q,
                Than = than,
                YeuCau = yc,
                Ip = IpThat(yc.Header("X-Forwarded-For")) ?? "127.0.0.1",
                Https = string.Equals(yc.Header("X-Forwarded-Proto"), "https", StringComparison.OrdinalIgnoreCase),
                DuongCookie = (duongUngDung.Length > 0 ? duongUngDung : "") + "/"
            };
            if (chiHttps && !ctx.Https && !duong.StartsWith("/.well-known/acme-challenge/", StringComparison.Ordinal))
            {
                // truy cập bằng http: trang web chuyển sang https; API thì từ chối (không gửi mật khẩu qua http)
                string host = (yc.Header("Host") ?? "").Trim();
                int hc = host.LastIndexOf(':');
                if (hc > 0 && host.IndexOf(']') < hc) host = host.Substring(0, hc);
                bool doc0 = yc.PhuongThuc == "GET" || yc.PhuongThuc == "HEAD";
                TraLoi cv;
                if (doc0 && host.Length > 0 && Regex.IsMatch(host, "^[A-Za-z0-9.\\-\\[\\]:]+$"))
                {
                    cv = TraLoi.ChuyenHuong("https://" + host + yc.Dich);
                    cv.Status = 301;
                }
                else cv = TraLoi.Loi(403, "Hãy dùng địa chỉ https://");
                Gui(ra, cv, yc.PhuongThuc == "HEAD", giu, false);
                return giu;
            }
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
                kho.Ghi("(lỗi)", ctx.Ip, yc.PhuongThuc + " " + duong + ": " + exx);
                tl = TraLoi.Loi(500, "Lỗi máy chủ: " + exx.Message);
            }
            if (hsts && ctx.Https) tl.Header["Strict-Transport-Security"] = "max-age=31536000";
            string ae = yc.Header("Accept-Encoding") ?? "";
            Gui(ra, tl, yc.PhuongThuc == "HEAD", giu, ae.IndexOf("gzip", StringComparison.OrdinalIgnoreCase) >= 0);
            return giu;
        }

        static TraLoi DinhTuyen(NguCanh ctx)
        {
            string d = ctx.Duong;
            if (d.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return Api.XuLy(kho, ctx);
            if (ctx.PhuongThuc != "GET" && ctx.PhuongThuc != "HEAD") return TraLoi.Loi(405, "Phương thức không hỗ trợ.");
            if (d == "/" || d.Length == 0 || d == "/index.html")
            {
                string tep = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "index.html");
                if (!File.Exists(tep)) return TraLoi.Loi(404, "Thiếu index.html trong thư mục chương trình.");
                var tl = new TraLoi { Status = 200, Than = File.ReadAllBytes(tep), Loai = "text/html; charset=utf-8" };
                tl.Header["Cache-Control"] = "no-cache";
                tl.Header["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' data: blob:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
                tl.Header["X-Frame-Options"] = "DENY";
                return tl;
            }
            if (d == "/favicon.ico") return new TraLoi { Status = 404, Than = new byte[0], Loai = "image/x-icon" };
            if (d.StartsWith("/.well-known/acme-challenge/", StringComparison.Ordinal))
            {
                // xác minh tên miền khi xin chứng chỉ Let's Encrypt (win-acme ghi file vào thư mục site)
                string ten = d.Substring("/.well-known/acme-challenge/".Length);
                string tep = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".well-known", "acme-challenge", ten);
                if (Regex.IsMatch(ten, "^[A-Za-z0-9_-]{8,200}$") && File.Exists(tep))
                    return new TraLoi { Status = 200, Than = File.ReadAllBytes(tep), Loai = "text/plain" };
                return TraLoi.Loi(404, "Không có.");
            }
            return TraLoi.Loi(404, "Không có trang này.");
        }

        // ------------------------------------------------------------------ gửi trả lời

        static void Gui(Stream ra, TraLoi tl, bool head, bool giu, bool gzip)
        {
            byte[] b = tl.Than ?? new byte[0];
            string loaiGoc = (tl.Loai ?? "").Split(';')[0].Trim();
            bool nen = gzip && b.Length > 1024 && (loaiGoc == "text/html" || loaiGoc == "application/json");
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
            foreach (var c in tl.Cookie) sb.Append("Set-Cookie: ").Append(c.Replace("\r", "").Replace("\n", "")).Append("\r\n");
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
                case 301: return "Moved Permanently";
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

        /// <summary>IIS nối địa chỉ thật của máy người dùng vào cuối X-Forwarded-For (dạng ip:cổng).</summary>
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

    // ====================================================================== API

    static class Api
    {
        const string TenCookie = "cc_phien";
        const int GioPhien = 12;
        static readonly Dictionary<string, List<DateTime>> sai = new Dictionary<string, List<DateTime>>();

        public static TraLoi XuLy(Kho kho, NguCanh ctx)
        {
            string d = ctx.Duong.Substring(4).TrimEnd('/'); // bỏ "/api"
            string pt = ctx.PhuongThuc;
            if (d == "/ping") return TraLoi.Json(new Dictionary<string, object> { { "ungDung", "ChamCong" }, { "phienBan", MayChu.PhienBanMayChu } });

            // chống giả mạo yêu cầu từ trang web khác: mọi lệnh ghi phải có header riêng của phần mềm
            if (pt != "GET" && pt != "HEAD" && ctx.Header("X-Yeu-Cau") != "ChamCong") return TraLoi.Loi(403, "Thiếu header X-Yeu-Cau.");

            if (d == "/dangnhap" && pt == "POST") return DangNhap(kho, ctx);
            if (d == "/dangxuat" && pt == "POST")
            {
                var t = TraLoi.Json(new Dictionary<string, object> { { "ok", true } });
                t.Cookie.Add(TenCookie + "=; Path=" + ctx.DuongCookie + "; Max-Age=0; HttpOnly; SameSite=Strict" + (ctx.Https ? "; Secure" : ""));
                return t;
            }

            TaiKhoan tk = XacThuc(kho, ctx);
            if (tk == null) return TraLoi.Loi(401, "Chưa đăng nhập hoặc phiên đã hết hạn.");
            ctx.NguoiDung = tk;

            if (d == "/toi" && pt == "GET") return TraLoi.Json(ThongTinToi(tk));

            if (d == "/trangthai" && pt == "GET") return TraLoi.Json(kho.TrangThai());

            if (d == "/dulieu" && pt == "GET")
            {
                string json = kho.DocDuLieuKemTrangThai();
                if (tk.vaiTro == "cham_cong")
                {
                    // tài khoản chấm công: chỉ nhận nhân viên, chấm công của phòng / đội được giao, không có lương
                    var goc = Js().DeserializeObject(json) as Dictionary<string, object>;
                    var dl0 = goc != null ? D(goc["duLieu"]) : null;
                    if (dl0 != null) goc["duLieu"] = LocChoChamCong(dl0, tk);
                    return TraLoi.Json(goc);
                }
                return new TraLoi { Status = 200, Loai = "application/json; charset=utf-8", Than = Encoding.UTF8.GetBytes(json) };
            }

            if (d == "/chamcong" && pt == "PUT")
            {
                if (tk.vaiTro != "cham_cong") return TraLoi.Loi(403, "Chỉ dùng cho tài khoản chấm công.");
                var v = DocJson(ctx);
                var thay = v.ContainsKey("thang") ? D(v["thang"]) : null;
                if (thay == null) throw new LoiApi(400, "Thiếu dữ liệu chấm công.");
                return TraLoi.Json(kho.SuaDuLieu(dl => GopChamCong(dl, thay, tk), tk.ten, ctx.Ip));
            }

            if (d == "/dulieu" && pt == "PUT")
            {
                if (tk.vaiTro == "cham_cong") return TraLoi.Loi(403, "Tài khoản chấm công chỉ được sửa bảng chấm công của phòng / đội mình.");
                long goc;
                if (!long.TryParse(ctx.Header("X-Phien-Ban"), out goc)) return TraLoi.Loi(400, "Thiếu số phiên bản dữ liệu (X-Phien-Ban).");
                string than = Encoding.UTF8.GetString(ctx.Than);
                KiemTraDuLieu(than);
                Dictionary<string, object> kq = kho.LuuDuLieu(than, goc, tk.ten, ctx.Ip);
                if (kq.ContainsKey("xungDot")) return TraLoi.Json(kq, 409);
                return TraLoi.Json(kq);
            }

            if (d == "/doimatkhau" && pt == "POST")
            {
                var v = DocJson(ctx);
                string cu = ChuoiTu(v, "cu"), moi = ChuoiTu(v, "moi");
                if (!kho.KiemTraMatKhau(tk.ten, cu)) throw new LoiApi(400, "Mật khẩu hiện tại không đúng.");
                if (moi.Length < 6) throw new LoiApi(400, "Mật khẩu mới phải có ít nhất 6 ký tự.");
                kho.DatTaiKhoan(tk.ten, moi, tk.vaiTro, true, null);
                kho.Ghi(tk.ten, ctx.Ip, "Đổi mật khẩu");
                var t = TraLoi.Json(new Dictionary<string, object> { { "ok", true } });
                t.Cookie.Add(TaoCookie(kho, kho.TimTaiKhoan(tk.ten), ctx));
                return t;
            }

            // ----- chỉ quản trị
            if (tk.vaiTro != "quan_tri") return TraLoi.Loi(403, "Chỉ tài khoản quản trị được làm việc này.");

            if (d == "/taikhoan" && pt == "GET")
                return TraLoi.Json(kho.DanhSachTaiKhoan().Select(x => (object)new Dictionary<string, object> { { "ten", x.ten }, { "vaiTro", x.vaiTro }, { "donVi", x.donVi ?? new List<string>() }, { "taoLuc", x.taoLuc } }).ToList());
            if (d == "/taikhoan" && pt == "POST")
            {
                var v = DocJson(ctx);
                string ten = ChuoiTu(v, "ten").Trim(), mk = ChuoiTu(v, "matKhau"), vt = ChuoiTu(v, "vaiTro");
                if (ten.Length < 2 || ten.Length > 40 || ten.Any(ch => char.IsWhiteSpace(ch) || ch == '|')) throw new LoiApi(400, "Tên đăng nhập 2–40 ký tự, không có dấu cách.");
                if (vt != "quan_tri" && vt != "nhap_lieu" && vt != "cham_cong") vt = "nhap_lieu";
                List<string> dv = null;
                if (vt == "cham_cong")
                {
                    var mang = v.ContainsKey("donVi") ? v["donVi"] as object[] : null;
                    dv = mang == null ? new List<string>() : mang.Select(x => Convert.ToString(x, CultureInfo.InvariantCulture)).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
                    if (dv.Count == 0) throw new LoiApi(400, "Tài khoản chấm công phải được giao ít nhất 1 phòng / đội.");
                }
                TaiKhoan cu = kho.TimTaiKhoan(ten);
                if (cu == null && mk.Length < 6) throw new LoiApi(400, "Mật khẩu phải có ít nhất 6 ký tự.");
                if (mk.Length > 0 && mk.Length < 6) throw new LoiApi(400, "Mật khẩu phải có ít nhất 6 ký tự.");
                if (cu != null && cu.vaiTro == "quan_tri" && vt != "quan_tri" && kho.DanhSachTaiKhoan().Count(x => x.vaiTro == "quan_tri") <= 1)
                    throw new LoiApi(400, "Phải còn ít nhất 1 tài khoản quản trị.");
                kho.DatTaiKhoan(ten, mk.Length > 0 ? mk : null, vt, mk.Length > 0, dv);
                kho.Ghi(tk.ten, ctx.Ip, (cu == null ? "Thêm" : "Sửa") + " tài khoản " + ten + " (" + vt + (dv != null ? ": " + string.Join(", ", dv) : "") + ")");
                return TraLoi.Json(new Dictionary<string, object> { { "ok", true } });
            }
            if (d == "/taikhoan" && pt == "DELETE")
            {
                string ten = ctx.Q("ten") ?? "";
                if (string.Equals(ten, tk.ten, StringComparison.OrdinalIgnoreCase)) throw new LoiApi(400, "Không tự xoá tài khoản đang dùng.");
                TaiKhoan x = kho.TimTaiKhoan(ten);
                if (x == null) throw new LoiApi(404, "Không có tài khoản này.");
                if (x.vaiTro == "quan_tri" && kho.DanhSachTaiKhoan().Count(y => y.vaiTro == "quan_tri") <= 1) throw new LoiApi(400, "Phải còn ít nhất 1 tài khoản quản trị.");
                kho.XoaTaiKhoan(ten);
                kho.Ghi(tk.ten, ctx.Ip, "Xoá tài khoản " + ten);
                return TraLoi.Json(new Dictionary<string, object> { { "ok", true } });
            }

            if (d == "/saoluu" && pt == "GET")
                return TraLoi.Json(new Dictionary<string, object> { { "thuMuc", kho.ThuMucSaoLuu }, { "ds", kho.DanhSachSaoLuu() } });
            if (d == "/saoluu/tai" && pt == "GET")
            {
                string ten = ctx.Q("ten") ?? "";
                byte[] b = kho.DocSaoLuu(ten);
                if (b == null) throw new LoiApi(404, "Không có bản sao lưu này.");
                return TraLoi.Tep(b, "application/json; charset=utf-8", ten);
            }
            if (d == "/saoluu/khoiphuc" && pt == "POST")
            {
                var v = DocJson(ctx);
                string ten = ChuoiTu(v, "ten");
                byte[] b = kho.DocSaoLuu(ten);
                if (b == null) throw new LoiApi(404, "Không có bản sao lưu này.");
                string than = Encoding.UTF8.GetString(b);
                KiemTraDuLieu(than);
                Dictionary<string, object> kq = kho.LuuDuLieu(than, -1, tk.ten, ctx.Ip);
                kho.Ghi(tk.ten, ctx.Ip, "Khôi phục từ bản sao lưu " + ten);
                return TraLoi.Json(kq);
            }
            if (d == "/nhatky" && pt == "GET") return new TraLoi { Status = 200, Loai = "text/plain; charset=utf-8", Than = Encoding.UTF8.GetBytes(kho.DocNhatKy()) };

            return TraLoi.Loi(404, "Không có API này.");
        }

        static Dictionary<string, object> ThongTinToi(TaiKhoan tk)
        {
            var x = new Dictionary<string, object> { { "ten", tk.ten }, { "vaiTro", tk.vaiTro } };
            if (tk.vaiTro == "cham_cong") x["donVi"] = tk.donVi ?? new List<string>();
            return x;
        }

        // ----- tài khoản chấm công theo phòng / đội

        static readonly string[] TruongNV = { "id", "ma", "maChamCong", "hoTen", "gioiTinh", "phongBan", "chucVu", "loaiLD", "congChuanRieng", "ngayVao", "ngayNghi", "trangThai", "hinhThuc", "maSP" };
        static readonly string[] KhoCong = { "cc", "ot", "muon", "vr" };

        static JavaScriptSerializer Js() { return new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 200 }; }
        static Dictionary<string, object> D(object o) { return o as Dictionary<string, object>; }
        static object[] Mang(Dictionary<string, object> d, string k) { object o; return d != null && d.TryGetValue(k, out o) && o is object[] ? (object[])o : new object[0]; }
        static string S(Dictionary<string, object> d, string k) { object o; return d != null && d.TryGetValue(k, out o) && o != null ? Convert.ToString(o, CultureInfo.InvariantCulture) : ""; }

        /// <summary>Nhân viên thuộc phòng / đội được giao, kèm người mới chuyển đi trong 62 ngày (để chấm nốt kỳ cũ).</summary>
        static HashSet<string> NhanVienDuocCham(Dictionary<string, object> dl, TaiKhoan tk)
        {
            var dv = new HashSet<string>(tk.donVi ?? new List<string>());
            var kq = new HashSet<string>();
            string moc = DateTime.Today.AddDays(-62).ToString("yyyy-MM-dd");
            foreach (object o in Mang(dl, "nhanVien"))
            {
                var nv = D(o);
                string id = S(nv, "id");
                if (id == "") continue;
                if (dv.Contains(S(nv, "phongBan"))) { kq.Add(id); continue; }
                foreach (object q0 in Mang(nv, "quyetDinh"))
                {
                    var q = D(q0); string l = S(q, "loai");
                    if ((l == "dieu_chuyen" || l == "bo_nhiem") && dv.Contains(S(q, "phongBanCu")) && string.CompareOrdinal(S(q, "hieuLuc"), moc) >= 0) { kq.Add(id); break; }
                }
            }
            return kq;
        }

        /// <summary>Dữ liệu rút gọn cho tài khoản chấm công: danh mục, nhân viên của đơn vị (không lương), ô chấm công.</summary>
        static Dictionary<string, object> LocChoChamCong(Dictionary<string, object> dl, TaiKhoan tk)
        {
            var ids = NhanVienDuocCham(dl, tk);
            var kq = new Dictionary<string, object>();
            foreach (string k in new[] { "phienBan", "congTy", "caiDat", "kyHieu", "phongBan", "ngayLe" }) if (dl.ContainsKey(k)) kq[k] = dl[k];
            var nvs = new List<object>();
            foreach (object o in Mang(dl, "nhanVien"))
            {
                var nv = D(o);
                if (nv == null || !ids.Contains(S(nv, "id"))) continue;
                var x = new Dictionary<string, object>();
                foreach (string f in TruongNV) if (nv.ContainsKey(f)) x[f] = nv[f];
                var qd = new List<object>();
                foreach (object q0 in Mang(nv, "quyetDinh"))
                {
                    var q = D(q0); string l = S(q, "loai");
                    if (l != "dieu_chuyen" && l != "bo_nhiem") continue;
                    var y = new Dictionary<string, object>();
                    foreach (string f in new[] { "loai", "hieuLuc", "phongBanCu", "phongBanMoi", "chucVuCu", "chucVuMoi" }) if (q.ContainsKey(f)) y[f] = q[f];
                    qd.Add(y);
                }
                x["quyetDinh"] = qd;
                nvs.Add(x);
            }
            kq["nhanVien"] = nvs;
            var th = new Dictionary<string, object>();
            var thang = dl.ContainsKey("thang") ? D(dl["thang"]) : null;
            if (thang != null)
                foreach (var p in thang)
                {
                    var T = D(p.Value);
                    if (T == null) continue;
                    var t2 = new Dictionary<string, object>();
                    if (T.ContainsKey("khoa")) t2["khoa"] = T["khoa"];
                    foreach (string loai in KhoCong)
                    {
                        var m = T.ContainsKey(loai) ? D(T[loai]) : null;
                        var m2 = new Dictionary<string, object>();
                        if (m != null) foreach (var e in m) if (ids.Contains(e.Key)) m2[e.Key] = e.Value;
                        t2[loai] = m2;
                    }
                    th[p.Key] = t2;
                }
            kq["thang"] = th;
            kq["chiChamCong"] = true;
            return kq;
        }

        /// <summary>Ghép chấm công do tài khoản chấm công gửi lên (theo từng ô); chặn nhân viên ngoài đơn vị và kỳ đã chốt.</summary>
        static string GopChamCong(Dictionary<string, object> dl, Dictionary<string, object> thay, TaiKhoan tk)
        {
            var ids = NhanVienDuocCham(dl, tk);
            int dauKy = 1, x0;
            var cd = dl.ContainsKey("caiDat") ? D(dl["caiDat"]) : null;
            if (int.TryParse(S(cd, "ngayDauKy"), out x0)) dauKy = Math.Max(1, Math.Min(28, x0));
            var thang = dl.ContainsKey("thang") ? D(dl["thang"]) : null;
            if (thang == null) { thang = new Dictionary<string, object>(); dl["thang"] = thang; }
            var js = Js();
            int soO = 0;
            var nvDoi = new HashSet<string>();
            foreach (var pm in thay)
            {
                var mm = Regex.Match(pm.Key, "^(\\d{4})-(\\d{2})$");
                if (!mm.Success) throw new LoiApi(400, "Tháng không hợp lệ: " + pm.Key);
                int y = int.Parse(mm.Groups[1].Value), m = int.Parse(mm.Groups[2].Value);
                if (m < 1 || m > 12) throw new LoiApi(400, "Tháng không hợp lệ: " + pm.Key);
                var moiT = D(pm.Value);
                if (moiT == null) continue;
                var T = thang.ContainsKey(pm.Key) ? D(thang[pm.Key]) : null;
                foreach (string loai in KhoCong)
                {
                    var moiL = moiT.ContainsKey(loai) ? D(moiT[loai]) : null;
                    if (moiL == null) continue;
                    foreach (var pn in moiL)
                    {
                        // pn.Value: { "ngày": giá trị | null (xoá ô) } – chỉ các ô vừa sửa
                        if (!ids.Contains(pn.Key)) throw new LoiApi(403, "Không có quyền chấm công cho nhân viên ngoài phòng / đội được giao.");
                        var vaKa = D(pn.Value);
                        if (vaKa == null) continue;
                        var cuL = T != null && T.ContainsKey(loai) ? D(T[loai]) : null;
                        var cu = cuL != null && cuL.ContainsKey(pn.Key) ? D(cuL[pn.Key]) : null;
                        foreach (var pd in vaKa)
                        {
                            object a = null;
                            if (cu != null) cu.TryGetValue(pd.Key, out a);
                            if (js.Serialize(a) == js.Serialize(pd.Value)) continue;
                            int dd;
                            if (!int.TryParse(pd.Key, out dd) || dd < 1 || dd > DateTime.DaysInMonth(y, m)) throw new LoiApi(400, "Ngày không hợp lệ: " + pd.Key + "/" + m + "/" + y);
                            if (pd.Value is string && ((string)pd.Value).Length > 20) throw new LoiApi(400, "Giá trị ô chấm công không hợp lệ.");
                            int ky = y, km = m;
                            if (dauKy > 1 && dd >= dauKy) { km++; if (km > 12) { km = 1; ky++; } }
                            string kk = ky + "-" + km.ToString("00");
                            var TK = thang.ContainsKey(kk) ? D(thang[kk]) : null;
                            if (TK != null && TK.ContainsKey("khoa") && TK["khoa"] is bool && (bool)TK["khoa"])
                                throw new LoiApi(423, "Kỳ công tháng " + km + "/" + ky + " đã chốt lương – không sửa chấm công được nữa.");
                            if (T == null) { T = new Dictionary<string, object>(); thang[pm.Key] = T; }
                            if (cuL == null) { cuL = new Dictionary<string, object>(); T[loai] = cuL; }
                            if (cu == null) { cu = new Dictionary<string, object>(); cuL[pn.Key] = cu; }
                            if (pd.Value == null) cu.Remove(pd.Key); else cu[pd.Key] = pd.Value;
                            soO++; nvDoi.Add(pn.Key);
                        }
                        if (cu != null && cu.Count == 0 && cuL != null) cuL.Remove(pn.Key);
                    }
                }
            }
            if (soO == 0) return null;
            return "Chấm công: sửa " + soO + " ô của " + nvDoi.Count + " nhân viên (" + string.Join(", ", thay.Keys.ToArray()) + ")";
        }

        static void KiemTraDuLieu(string than)
        {
            string t = than.TrimStart();
            if (!t.StartsWith("{") || than.IndexOf("\"nhanVien\"", StringComparison.Ordinal) < 0 || than.IndexOf("\"caiDat\"", StringComparison.Ordinal) < 0)
                throw new LoiApi(400, "Dữ liệu gửi lên không đúng định dạng của phần mềm.");
            try
            {
                var js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 200 };
                js.DeserializeObject(than);
            }
            catch (Exception)
            {
                throw new LoiApi(400, "Dữ liệu gửi lên bị hỏng (không phải JSON hợp lệ).");
            }
        }

        static Dictionary<string, object> DocJson(NguCanh ctx)
        {
            try
            {
                var o = new JavaScriptSerializer().DeserializeObject(Encoding.UTF8.GetString(ctx.Than)) as Dictionary<string, object>;
                if (o == null) throw new LoiApi(400, "Thiếu dữ liệu.");
                return o;
            }
            catch (LoiApi) { throw; }
            catch (Exception) { throw new LoiApi(400, "Dữ liệu gửi lên không đúng."); }
        }

        static string ChuoiTu(Dictionary<string, object> v, string k)
        {
            object o;
            return v.TryGetValue(k, out o) && o != null ? Convert.ToString(o) : "";
        }

        // ----- đăng nhập, phiên

        static TraLoi DangNhap(Kho kho, NguCanh ctx)
        {
            lock (sai)
            {
                List<DateTime> ds;
                if (sai.TryGetValue(ctx.Ip, out ds))
                {
                    ds.RemoveAll(t => t < DateTime.UtcNow.AddMinutes(-10));
                    if (ds.Count >= 8) return TraLoi.Loi(429, "Sai mật khẩu nhiều lần. Hãy thử lại sau 10 phút.");
                }
            }
            var v = DocJson(ctx);
            string ten = ChuoiTu(v, "ten").Trim(), mk = ChuoiTu(v, "matKhau");
            if (!kho.KiemTraMatKhau(ten, mk))
            {
                lock (sai)
                {
                    List<DateTime> ds;
                    if (!sai.TryGetValue(ctx.Ip, out ds)) { ds = new List<DateTime>(); sai[ctx.Ip] = ds; }
                    ds.Add(DateTime.UtcNow);
                }
                kho.Ghi(ten, ctx.Ip, "Đăng nhập sai");
                Thread.Sleep(400);
                return TraLoi.Loi(401, "Sai tên đăng nhập hoặc mật khẩu.");
            }
            TaiKhoan tk = kho.TimTaiKhoan(ten);
            kho.Ghi(tk.ten, ctx.Ip, "Đăng nhập");
            var tl = TraLoi.Json(ThongTinToi(tk));
            tl.Cookie.Add(TaoCookie(kho, tk, ctx));
            return tl;
        }

        static string TaoCookie(Kho kho, TaiKhoan tk, NguCanh ctx)
        {
            long het = (long)(DateTime.UtcNow.AddHours(GioPhien) - new DateTime(1970, 1, 1)).TotalSeconds;
            string noiDung = B64(Encoding.UTF8.GetBytes(tk.ten + "|" + het + "|" + tk.dauPhien));
            string token = noiDung + "." + B64(kho.Ky(noiDung));
            return TenCookie + "=" + token + "; Path=" + ctx.DuongCookie + "; Max-Age=" + (GioPhien * 3600) + "; HttpOnly; SameSite=Strict" + (ctx.Https ? "; Secure" : "");
        }

        static TaiKhoan XacThuc(Kho kho, NguCanh ctx)
        {
            string ck = ctx.Header("Cookie");
            if (string.IsNullOrEmpty(ck)) return null;
            foreach (string p in ck.Split(';'))
            {
                string s = p.Trim();
                if (!s.StartsWith(TenCookie + "=")) continue;
                string token = s.Substring(TenCookie.Length + 1);
                int cham = token.IndexOf('.');
                if (cham <= 0) return null;
                string noiDung = token.Substring(0, cham);
                if (!MayChu.BangNhau(B64(kho.Ky(noiDung)), token.Substring(cham + 1))) return null;
                string[] phan;
                try { phan = Encoding.UTF8.GetString(TuB64(noiDung)).Split('|'); }
                catch (Exception) { return null; }
                if (phan.Length != 3) return null;
                long het;
                if (!long.TryParse(phan[1], out het) || het < (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds) return null;
                TaiKhoan tk = kho.TimTaiKhoan(phan[0]);
                if (tk == null || tk.dauPhien != phan[2]) return null;
                return tk;
            }
            return null;
        }

        static string B64(byte[] b) { return Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_'); }
        static byte[] TuB64(string s)
        {
            s = s.Replace('-', '+').Replace('_', '/');
            while (s.Length % 4 != 0) s += "=";
            return Convert.FromBase64String(s);
        }
    }

    // ====================================================================== lưu trữ

    class TaiKhoan
    {
        public string ten, vaiTro, muoi, bam, taoLuc, dauPhien;
        public int lap;
        public List<string> donVi; // tài khoản chấm công: mã các phòng / đội được giao
    }

    sealed class Kho
    {
        readonly string tepDuLieu, tepTrangThai, tepTaiKhoan, thuMucSaoLuu, thuMucNhatKy;
        readonly object khoa = new object();
        readonly byte[] bimat;
        List<TaiKhoan> taiKhoan;
        long phienBan;
        string capNhat = "", nguoi = "";

        public Kho(string thuMuc)
        {
            Directory.CreateDirectory(thuMuc);
            tepDuLieu = Path.Combine(thuMuc, "dulieu.json");
            tepTrangThai = Path.Combine(thuMuc, "trangthai.json");
            tepTaiKhoan = Path.Combine(thuMuc, "taikhoan.json");
            string sl = Environment.GetEnvironmentVariable("CHAMCONG_SAOLUU");
            thuMucSaoLuu = string.IsNullOrWhiteSpace(sl) ? Path.Combine(thuMuc, "SaoLuu") : Environment.ExpandEnvironmentVariables(sl.Trim());
            thuMucNhatKy = Path.Combine(thuMuc, "NhatKy");
            Directory.CreateDirectory(thuMucSaoLuu);
            Directory.CreateDirectory(thuMucNhatKy);

            string tepKhoa = Path.Combine(thuMuc, "khoa.bin");
            if (File.Exists(tepKhoa) && new FileInfo(tepKhoa).Length >= 32) bimat = File.ReadAllBytes(tepKhoa);
            else
            {
                bimat = new byte[32];
                using (var r = RandomNumberGenerator.Create()) r.GetBytes(bimat);
                File.WriteAllBytes(tepKhoa, bimat);
            }

            var js = new JavaScriptSerializer();
            taiKhoan = File.Exists(tepTaiKhoan) ? js.Deserialize<List<TaiKhoan>>(File.ReadAllText(tepTaiKhoan, Encoding.UTF8)) ?? new List<TaiKhoan>() : new List<TaiKhoan>();
            if (File.Exists(tepTrangThai))
            {
                var tt = js.DeserializeObject(File.ReadAllText(tepTrangThai, Encoding.UTF8)) as Dictionary<string, object>;
                if (tt != null)
                {
                    object o;
                    if (tt.TryGetValue("phienBan", out o)) phienBan = Convert.ToInt64(o);
                    if (tt.TryGetValue("capNhat", out o) && o != null) capNhat = o.ToString();
                    if (tt.TryGetValue("nguoi", out o) && o != null) nguoi = o.ToString();
                }
            }
            if (!File.Exists(tepDuLieu)) phienBan = 0;
        }

        public byte[] Ky(string s)
        {
            using (var h = new HMACSHA256(bimat)) return h.ComputeHash(Encoding.UTF8.GetBytes(s));
        }

        // ----- dữ liệu

        public Dictionary<string, object> TrangThai()
        {
            lock (khoa)
            {
                return new Dictionary<string, object> { { "phienBan", phienBan }, { "capNhat", capNhat }, { "nguoi", nguoi } };
            }
        }

        public string DocDuLieuKemTrangThai()
        {
            lock (khoa)
            {
                string tt = new JavaScriptSerializer().Serialize(TrangThai());
                string dl = File.Exists(tepDuLieu) ? File.ReadAllText(tepDuLieu, Encoding.UTF8) : "null";
                return tt.Substring(0, tt.Length - 1) + ",\"duLieu\":" + dl + "}";
            }
        }

        /// <summary>Lưu nếu số phiên bản người gửi đang dựa vào đúng bằng bản trên máy chủ (goc = -1: ghi đè, dùng khi khôi phục).</summary>
        public Dictionary<string, object> LuuDuLieu(string json, long goc, string ten, string ip)
        {
            lock (khoa)
            {
                if (goc >= 0 && goc != phienBan)
                {
                    var x = TrangThai();
                    x["xungDot"] = true;
                    return x;
                }
                SaoLuuTrongNgay();
                string tam = tepDuLieu + ".tmp";
                File.WriteAllText(tam, json, new UTF8Encoding(false));
                if (File.Exists(tepDuLieu)) File.Replace(tam, tepDuLieu, null);
                else File.Move(tam, tepDuLieu);
                phienBan++;
                capNhat = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss");
                nguoi = ten;
                File.WriteAllText(tepTrangThai, new JavaScriptSerializer().Serialize(TrangThai()), new UTF8Encoding(false));
                Ghi(ten, ip, "Lưu dữ liệu, phiên bản " + phienBan + ", " + (json.Length / 1024) + " KB");
                return TrangThai();
            }
        }

        /// <summary>Đọc – sửa – ghi dữ liệu trong cùng một khoá (dùng cho ghép chấm công theo ô). sua trả về null nếu không có gì đổi.</summary>
        public Dictionary<string, object> SuaDuLieu(Func<Dictionary<string, object>, string> sua, string ten, string ip)
        {
            lock (khoa)
            {
                if (!File.Exists(tepDuLieu)) throw new LoiApi(409, "Máy chủ chưa có dữ liệu.");
                var js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 200 };
                var dl = js.DeserializeObject(File.ReadAllText(tepDuLieu, Encoding.UTF8)) as Dictionary<string, object>;
                if (dl == null) throw new LoiApi(500, "Dữ liệu trên máy chủ bị hỏng.");
                string viec = sua(dl);
                if (viec == null) return TrangThai();
                var kq = LuuDuLieu(js.Serialize(dl), -1, ten, ip);
                Ghi(ten, ip, viec);
                return kq;
            }
        }

        /// <summary>Lần ghi đầu tiên mỗi ngày: chép dữ liệu hiện có vào SaoLuu\dulieu_yyyy-MM-dd.json (giữ 120 bản).</summary>
        void SaoLuuTrongNgay()
        {
            if (!File.Exists(tepDuLieu)) return;
            string tep = Path.Combine(thuMucSaoLuu, "dulieu_" + DateTime.Now.ToString("yyyy-MM-dd") + ".json");
            if (File.Exists(tep)) return;
            File.Copy(tepDuLieu, tep);
            var cu = new DirectoryInfo(thuMucSaoLuu).GetFiles("dulieu_*.json").OrderByDescending(f => f.Name).Skip(120).ToList();
            foreach (var f in cu) { try { f.Delete(); } catch (Exception) { } }
        }

        public string ThuMucSaoLuu { get { return thuMucSaoLuu; } }

        public List<object> DanhSachSaoLuu()
        {
            return new DirectoryInfo(thuMucSaoLuu).GetFiles("dulieu_*.json").OrderByDescending(f => f.Name)
                .Select(f => (object)new Dictionary<string, object> { { "ten", f.Name }, { "kichThuoc", f.Length }, { "luc", f.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss") } }).ToList();
        }

        public byte[] DocSaoLuu(string ten)
        {
            if (string.IsNullOrEmpty(ten) || !System.Text.RegularExpressions.Regex.IsMatch(ten, "^dulieu_[0-9-]{10}\\.json$")) return null;
            string tep = Path.Combine(thuMucSaoLuu, ten);
            return File.Exists(tep) ? File.ReadAllBytes(tep) : null;
        }

        // ----- tài khoản

        public List<TaiKhoan> DanhSachTaiKhoan() { lock (khoa) return taiKhoan.ToList(); }

        public TaiKhoan TimTaiKhoan(string ten)
        {
            lock (khoa) return taiKhoan.FirstOrDefault(x => string.Equals(x.ten, ten, StringComparison.OrdinalIgnoreCase));
        }

        public void DatTaiKhoan(string ten, string matKhau, string vaiTro, bool doiMatKhau, List<string> donVi)
        {
            lock (khoa)
            {
                TaiKhoan tk = taiKhoan.FirstOrDefault(x => string.Equals(x.ten, ten, StringComparison.OrdinalIgnoreCase));
                if (tk == null)
                {
                    tk = new TaiKhoan { ten = ten, taoLuc = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss") };
                    taiKhoan.Add(tk);
                }
                tk.vaiTro = vaiTro;
                if (vaiTro != "cham_cong") tk.donVi = null;
                else if (donVi != null) tk.donVi = donVi;
                if (doiMatKhau && matKhau != null)
                {
                    byte[] muoi = new byte[16];
                    using (var r = RandomNumberGenerator.Create()) r.GetBytes(muoi);
                    tk.lap = 120000;
                    tk.muoi = Convert.ToBase64String(muoi);
                    tk.bam = Convert.ToBase64String(Bam(matKhau, muoi, tk.lap));
                }
                // đổi mật khẩu / vai trò thì các phiên đăng nhập cũ hết hiệu lực
                byte[] dp = new byte[9];
                using (var r = RandomNumberGenerator.Create()) r.GetBytes(dp);
                tk.dauPhien = Convert.ToBase64String(dp).Replace('+', '-').Replace('/', '_');
                LuuTaiKhoan();
            }
        }

        public void XoaTaiKhoan(string ten)
        {
            lock (khoa)
            {
                taiKhoan.RemoveAll(x => string.Equals(x.ten, ten, StringComparison.OrdinalIgnoreCase));
                LuuTaiKhoan();
            }
        }

        public bool KiemTraMatKhau(string ten, string matKhau)
        {
            TaiKhoan tk = TimTaiKhoan(ten);
            if (tk == null || string.IsNullOrEmpty(tk.bam) || matKhau == null) return false;
            byte[] b = Bam(matKhau, Convert.FromBase64String(tk.muoi), tk.lap > 0 ? tk.lap : 120000);
            return MayChu.BangNhau(Convert.ToBase64String(b), tk.bam);
        }

        static byte[] Bam(string matKhau, byte[] muoi, int lap)
        {
            using (var k = new Rfc2898DeriveBytes(Encoding.UTF8.GetBytes(matKhau), muoi, lap)) return k.GetBytes(32);
        }

        void LuuTaiKhoan()
        {
            string tam = tepTaiKhoan + ".tmp";
            File.WriteAllText(tam, new JavaScriptSerializer().Serialize(taiKhoan), new UTF8Encoding(false));
            if (File.Exists(tepTaiKhoan)) File.Replace(tam, tepTaiKhoan, null);
            else File.Move(tam, tepTaiKhoan);
        }

        // ----- nhật ký

        public void Ghi(string ten, string ip, string viec)
        {
            try
            {
                lock (thuMucNhatKy)
                {
                    File.AppendAllText(Path.Combine(thuMucNhatKy, DateTime.Now.ToString("yyyy-MM") + ".txt"),
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\t" + ten + "\t" + ip + "\t" + viec.Replace("\r", " ").Replace("\n", " ") + "\r\n", Encoding.UTF8);
                }
            }
            catch (Exception) { }
        }

        public string DocNhatKy()
        {
            var tep = new DirectoryInfo(thuMucNhatKy).GetFiles("*.txt").OrderByDescending(f => f.Name).FirstOrDefault();
            if (tep == null) return "";
            var dong = File.ReadAllLines(tep.FullName, Encoding.UTF8);
            return string.Join("\r\n", dong.Skip(Math.Max(0, dong.Length - 300)).Reverse());
        }
    }

    // ====================================================================== HTTP

    class LoiApi : Exception
    {
        public readonly int Status;
        public LoiApi(int status, string message) : base(message) { Status = status; }
    }

    class NguCanh
    {
        public string PhuongThuc, Duong, Ip, DuongCookie;
        public bool Https;
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
        public readonly List<string> Cookie = new List<string>();

        public static TraLoi Json(object o, int status = 200)
        {
            var js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            return new TraLoi { Status = status, Loai = "application/json; charset=utf-8", Than = Encoding.UTF8.GetBytes(js.Serialize(o)) };
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
            string ascii = new string(tenFile.Select(c => c < 128 && c != '"' && c != '\\' ? c : '_').ToArray());
            t.Header["Content-Disposition"] = "attachment; filename=\"" + ascii + "\"";
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
