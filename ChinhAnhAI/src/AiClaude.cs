using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace ChinhAnhAI
{
    public class KetQuaAI
    {
        public ThongSo ThongSo;
        public string MoTa = "";
        public string LoaiCanh = "";
        public string Model = "";
    }

    public class LoiAI : Exception
    {
        public LoiAI(string thongBao) : base(thongBao) { }
    }

    /// <summary>
    /// Nhờ Claude (Anthropic) xem ảnh và chọn thông số chỉnh như một thợ hậu kỳ. Gọi thẳng Messages API qua HTTPS
    /// (phần mềm biên dịch bằng csc.exe có sẵn của Windows nên không dùng gói NuGet của SDK).
    /// AI chỉ trả về con số cho các thanh chỉnh; việc chỉnh điểm ảnh vẫn chạy trên máy nên ảnh gốc cỡ lớn không phải gửi đi.
    /// </summary>
    public static class AiClaude
    {
        public const string ModelMacDinh = "claude-opus-5-5";
        public const string DiaChiMacDinh = "https://api.anthropic.com";
        const string PhienBanApi = "2026-10-21";
        const string BetaDuPhong = "server-side-fallback-2026-07-01";
        const int CanhAnhGui = 1280;

        static readonly string[] LoaiCanhHopLe =
        {
            "chan_dung", "nhom_nguoi", "phong_canh", "kien_truc", "do_an", "san_pham", "dong_vat",
            "canh_dem", "trong_nha", "su_kien", "duong_pho", "khac"
        };

        public static KetQuaAI Hoi(CaiDat cd, AnhNguon xemTruoc, KetQuaPhanTich pt, ThongSo goiY, PhongCach phongCach,
                                   string yeuCauThem, CancellationToken huy)
        {
            string key = cd.KeyDung;
            if (key.Length == 0) throw new LoiAI("Chưa nhập API key của Anthropic (Cài đặt → AI Claude).");
            string model = string.IsNullOrWhiteSpace(cd.Model) ? ModelMacDinh : cd.Model.Trim();
            string goc = string.IsNullOrWhiteSpace(cd.DiaChiApi) ? DiaChiMacDinh : cd.DiaChiApi.Trim().TrimEnd('/');
            bool chinhHang = goc.Equals(DiaChiMacDinh, StringComparison.OrdinalIgnoreCase);
            // Dự phòng phía máy chủ: nếu bộ lọc an toàn từ chối, API tự chạy lại trên model phù hợp. Chỉ có ở api.anthropic.com.
            bool duPhong = chinhHang && (model.StartsWith("claude-opus-5") || model.StartsWith("claude-fable-5") || model == "claude-sonnet-5-5");
            bool dinhDang = true;

            string anh = Base64Jpeg(xemTruoc);
            var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

            for (int lan = 0; ; lan++)
            {
                huy.ThrowIfCancellationRequested();
                var than = TaoYeuCau(model, anh, pt, goiY, phongCach, yeuCauThem, duPhong, dinhDang);
                string json = ser.Serialize(than);
                int ma; string traVe;
                Gui(goc + "/v1/messages", key, duPhong, json, huy, out ma, out traVe);
                if (ma == 200) return DocKetQua(ser, traVe, goiY);

                string loi = ThongBaoLoi(ser, traVe);
                string thuong = (loi ?? "").ToLowerInvariant();
                // Máy chủ trung gian / model không nhận tham số mới: bỏ tham số đó rồi thử lại
                if (ma == 400 && duPhong && thuong.Contains("fallback")) { duPhong = false; continue; }
                if (ma == 400 && dinhDang && (thuong.Contains("output_config") || thuong.Contains("format") || thuong.Contains("schema"))) { dinhDang = false; continue; }
                if ((ma == 429 || ma == 529 || ma >= 500) && lan < 2)
                {
                    if (huy.WaitHandle.WaitOne(2000 * (lan + 1))) huy.ThrowIfCancellationRequested();
                    continue;
                }
                throw new LoiAI(GiaiThichLoi(ma, loi));
            }
        }

        /// <summary>Kiểm tra key và model bằng Models API (không tốn phí). Trả null nếu dùng được, ngược lại là lời giải thích.</summary>
        public static string KiemTra(string goc, string key, string model)
        {
            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                var req = (HttpWebRequest)WebRequest.Create(goc + "/v1/models/" + Uri.EscapeDataString(model));
                req.Method = "GET";
                req.Timeout = 20000;
                req.Headers["x-api-key"] = key;
                req.Headers["anthropic-version"] = PhienBanApi;
                using (var resp = (HttpWebResponse)req.GetResponse()) return null;
            }
            catch (WebException ex)
            {
                var resp = ex.Response as HttpWebResponse;
                if (resp == null) return GiaiThichLoi(0, ex.Message);
                using (resp)
                using (var rd = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    return GiaiThichLoi((int)resp.StatusCode, ThongBaoLoi(new JavaScriptSerializer(), rd.ReadToEnd()));
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        static string GiaiThichLoi(int ma, string loi)
        {
            string chiTiet = string.IsNullOrEmpty(loi) ? "" : "\n\nChi tiết: " + loi;
            switch (ma)
            {
                case 0: return "Không kết nối được máy chủ AI. Kiểm tra mạng Internet." + chiTiet;
                case 401: return "API key không đúng hoặc đã bị thu hồi." + chiTiet;
                case 403: return "API key không có quyền dùng model này." + chiTiet;
                case 404: return "Không tìm thấy model hoặc địa chỉ API (kiểm tra Cài đặt)." + chiTiet;
                case 413: return "Ảnh gửi đi quá lớn." + chiTiet;
                case 429: return "Đã vượt giới hạn số lần gọi AI. Đợi một lúc rồi thử lại." + chiTiet;
                case 529: return "Máy chủ AI đang quá tải. Thử lại sau ít phút." + chiTiet;
                default: return "AI báo lỗi (mã " + ma + ")." + chiTiet;
            }
        }

        static void Gui(string url, string key, bool duPhong, string json, CancellationToken huy, out int ma, out string traVe)
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.Timeout = 180000;
            req.ReadWriteTimeout = 180000;
            req.Headers["x-api-key"] = key;
            req.Headers["anthropic-version"] = PhienBanApi;
            if (duPhong) req.Headers["anthropic-beta"] = BetaDuPhong;
            byte[] du = Encoding.UTF8.GetBytes(json);
            using (huy.Register(() => { try { req.Abort(); } catch (Exception) { } }))
            {
                try
                {
                    req.ContentLength = du.Length;
                    using (Stream s = req.GetRequestStream()) s.Write(du, 0, du.Length);
                    using (var resp = (HttpWebResponse)req.GetResponse())
                    using (var rd = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    {
                        ma = (int)resp.StatusCode;
                        traVe = rd.ReadToEnd();
                    }
                }
                catch (WebException ex)
                {
                    huy.ThrowIfCancellationRequested();
                    var resp = ex.Response as HttpWebResponse;
                    if (resp == null) { ma = 0; traVe = ex.Message; return; }
                    using (resp)
                    using (var rd = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    {
                        ma = (int)resp.StatusCode;
                        traVe = rd.ReadToEnd();
                    }
                }
            }
        }

        static string ThongBaoLoi(JavaScriptSerializer ser, string traVe)
        {
            try
            {
                var d = ser.DeserializeObject(traVe) as Dictionary<string, object>;
                object e;
                if (d != null && d.TryGetValue("error", out e) && e is Dictionary<string, object>)
                {
                    object m;
                    if (((Dictionary<string, object>)e).TryGetValue("message", out m)) return Convert.ToString(m);
                }
            }
            catch (Exception) { }
            return traVe != null && traVe.Length > 300 ? traVe.Substring(0, 300) : traVe;
        }

        static KetQuaAI DocKetQua(JavaScriptSerializer ser, string traVe, ThongSo goiY)
        {
            var d = ser.DeserializeObject(traVe) as Dictionary<string, object>;
            if (d == null) throw new LoiAI("AI trả về dữ liệu không đọc được.");
            string lyDo = d.ContainsKey("stop_reason") ? Convert.ToString(d["stop_reason"]) : "";
            if (lyDo == "refusal") throw new LoiAI("AI từ chối xử lý ảnh này. Đang dùng kết quả phân tích trên máy.");
            if (lyDo == "max_tokens") throw new LoiAI("AI trả lời quá dài, bị cắt giữa chừng. Thử lại.");
            var chu = new StringBuilder();
            var noiDung = d.ContainsKey("content") ? d["content"] as object[] : null;
            if (noiDung != null)
                foreach (object o in noiDung)
                {
                    var k = o as Dictionary<string, object>;
                    if (k != null && Convert.ToString(k["type"]) == "text") chu.Append(Convert.ToString(k["text"]));
                }
            string s = chu.ToString();
            int a = s.IndexOf('{'), b = s.LastIndexOf('}');
            if (a < 0 || b <= a) throw new LoiAI("AI không trả về thông số chỉnh ảnh.");
            Dictionary<string, object> kq;
            try { kq = ser.DeserializeObject(s.Substring(a, b - a + 1)) as Dictionary<string, object>; }
            catch (Exception) { kq = null; }
            if (kq == null) throw new LoiAI("AI trả về thông số không đúng dạng.");
            object ts;
            var ds = kq.TryGetValue("thong_so", out ts) ? ts as Dictionary<string, object> : kq;
            if (ds == null) throw new LoiAI("AI trả về thông số không đúng dạng.");
            object moTa, loai;
            return new KetQuaAI
            {
                ThongSo = ThongSo.TuJson(ds, goiY),
                MoTa = kq.TryGetValue("mo_ta", out moTa) ? Convert.ToString(moTa) : "",
                LoaiCanh = kq.TryGetValue("loai_canh", out loai) ? Convert.ToString(loai) : "",
                Model = d.ContainsKey("model") ? Convert.ToString(d["model"]) : "",
            };
        }

        static string Base64Jpeg(AnhNguon a)
        {
            AnhNguon nho = a.ThuNho(CanhAnhGui);
            using (Bitmap bmp = nho.SangBitmap())
            using (var ms = new MemoryStream())
            {
                ImageCodecInfo jpeg = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
                using (var ps = new EncoderParameters(1))
                {
                    ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 88L);
                    bmp.Save(ms, jpeg, ps);
                }
                return Convert.ToBase64String(ms.ToArray());
            }
        }

        const string LoiNhacHeThong =
@"You are a senior photo retoucher doing the final edit of a client's photo in a Lightroom-like raw editor.
You do not move pixels yourself: you choose the final value of every slider, and a local engine renders the full-resolution photo with them.
You will not see the result, so judge from the photo you are shown (the unedited original, downscaled) and from the measurements.

What a professional edit looks like:
- Correct exposure; people's faces well and evenly lit.
- White balance neutral but pleasant, keeping the mood of the light: sunsets and candle light stay warm, blue hour stays blue, shade loses its blue cast.
- Highlights recovered (sky, white clothes), shadows opened without an HDR look, clean but not crushed blacks.
- Rich yet believable colors, natural skin tones; foliage and sky clean.
- No over-processing: no halos, no neon saturation, no crunchy clarity on faces, no heavy vignette unless the style asks for it.
- Noise reduction only when the photo is noisy (measured noise above ~2 on an 8-bit scale, or a dark photo being brightened a lot).
- Skin smoothing only when people are visible.

Sliders (absolute final values; 0 means unchanged; respect the ranges):
{SLIDERS}
- den_trang: true for a black-and-white conversion (only when the requested style asks for it or the photo clearly works best in monochrome).

The local auto-edit's values are measured from the histogram and are usually close for exposure and tone, but it cannot tell a sunset from a color cast, a dark mood from a mistake, or what the subject is. Start from them and correct what they get wrong for this photo.
Apply the requested style on top of a technically correct edit. If the user wrote a wish, follow it as long as it stays tasteful.
Write mo_ta in Vietnamese: one or two short sentences saying what the photo shows and the main things you changed.";

        static Dictionary<string, object> TaoYeuCau(string model, string anhBase64, KetQuaPhanTich pt, ThongSo goiY, PhongCach phongCach,
                                                    string yeuCauThem, bool duPhong, bool dinhDang)
        {
            var thanhTruot = new StringBuilder();
            foreach (MoTaThongSo m in ThongSo.DanhSach) thanhTruot.AppendLine("- " + m.Khoa + ": " + m.GiaiThich);
            string heThong = LoiNhacHeThong.Replace("{SLIDERS}", thanhTruot.ToString().TrimEnd());
            if (!dinhDang)
                heThong += "\n\nReply with only one JSON object: {\"mo_ta\": string, \"loai_canh\": string, \"thong_so\": {every slider key: number, \"den_trang\": boolean}}.";

            var ser = new JavaScriptSerializer();
            var loi = new StringBuilder();
            loi.AppendLine("Measurements from the local analysis: " + ser.Serialize(pt.ThongKe()));
            loi.AppendLine("Values chosen by the local auto-edit for this style: " + ser.Serialize(goiY.SangJson()));
            if (phongCach != null) loi.AppendLine("Requested style: " + phongCach.Ten + " (" + phongCach.MoTa + ").");
            if (!string.IsNullOrWhiteSpace(yeuCauThem)) loi.AppendLine("The user's wish (Vietnamese): " + yeuCauThem.Trim());
            loi.Append("Return the final slider values for this photo.");

            var noiDung = new object[]
            {
                new Dictionary<string, object>
                {
                    { "type", "image" },
                    { "source", new Dictionary<string, object> { { "type", "base64" }, { "media_type", "image/jpeg" }, { "data", anhBase64 } } }
                },
                new Dictionary<string, object> { { "type", "text" }, { "text", loi.ToString() } }
            };

            var outputConfig = new Dictionary<string, object> { { "effort", "medium" } };
            if (dinhDang) outputConfig["format"] = new Dictionary<string, object> { { "type", "json_schema" }, { "schema", LuocDo() } };

            var than = new Dictionary<string, object>
            {
                { "model", model },
                { "max_tokens", 16000 },
                { "system", heThong },
                { "messages", new object[] { new Dictionary<string, object> { { "role", "user" }, { "content", noiDung } } } },
                { "output_config", outputConfig },
            };
            if (duPhong) than["fallbacks"] = "default";
            return than;
        }

        static Dictionary<string, object> LuocDo()
        {
            var ts = new Dictionary<string, object>();
            foreach (MoTaThongSo m in ThongSo.DanhSach)
                ts[m.Khoa] = new Dictionary<string, object> { { "type", "number" }, { "description", m.GiaiThich } };
            ts["den_trang"] = new Dictionary<string, object> { { "type", "boolean" } };
            var batBuoc = ThongSo.DanhSach.Select(m => (object)m.Khoa).Concat(new object[] { "den_trang" }).ToArray();
            return new Dictionary<string, object>
            {
                { "type", "object" },
                { "properties", new Dictionary<string, object>
                    {
                        { "mo_ta", new Dictionary<string, object> { { "type", "string" } } },
                        { "loai_canh", new Dictionary<string, object> { { "type", "string" }, { "enum", LoaiCanhHopLe.Cast<object>().ToArray() } } },
                        { "thong_so", new Dictionary<string, object>
                            {
                                { "type", "object" },
                                { "properties", ts },
                                { "required", batBuoc },
                                { "additionalProperties", false },
                            }
                        },
                    }
                },
                { "required", new object[] { "mo_ta", "loai_canh", "thong_so" } },
                { "additionalProperties", false },
            };
        }
    }
}
