using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Web.Script.Serialization;

namespace QuanLyTaiSan
{
    /// <summary>JSON: viết tay (số kiểu bất biến, NaN → null, ngày → "yyyy-MM-ddTHH:mm:ss"), đọc bằng JavaScriptSerializer.</summary>
    public static class Json
    {
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public static string Viet(object o)
        {
            var sb = new StringBuilder();
            Viet(sb, o);
            return sb.ToString();
        }

        static void Viet(StringBuilder sb, object o)
        {
            if (o == null) { sb.Append("null"); return; }
            if (o is string) { Chuoi(sb, (string)o); return; }
            if (o is bool) { sb.Append((bool)o ? "true" : "false"); return; }
            if (o is double || o is float || o is decimal)
            {
                double d = Convert.ToDouble(o, Inv);
                sb.Append(double.IsNaN(d) || double.IsInfinity(d) ? "null" : d.ToString("R", Inv));
                return;
            }
            if (o is int || o is long || o is short || o is byte) { sb.Append(Convert.ToString(o, Inv)); return; }
            if (o is DateTime) { Chuoi(sb, ((DateTime)o).ToString("yyyy-MM-dd'T'HH:mm:ss", Inv)); return; }
            var dict = o as IDictionary;
            if (dict != null)
            {
                sb.Append('{');
                bool dau = true;
                foreach (DictionaryEntry e in dict)
                {
                    if (!dau) sb.Append(',');
                    dau = false;
                    Chuoi(sb, Convert.ToString(e.Key, Inv));
                    sb.Append(':');
                    Viet(sb, e.Value);
                }
                sb.Append('}');
                return;
            }
            var list = o as IEnumerable;
            if (list != null)
            {
                sb.Append('[');
                bool dau = true;
                foreach (object x in list)
                {
                    if (!dau) sb.Append(',');
                    dau = false;
                    Viet(sb, x);
                }
                sb.Append(']');
                return;
            }
            Chuoi(sb, Convert.ToString(o, Inv));
        }

        static void Chuoi(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '<': sb.Append("\\u003c"); break;
                    case '\u2028': sb.Append("\\u2028"); break;
                    case '\u2029': sb.Append("\\u2029"); break;
                    default:
                        if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        static JavaScriptSerializer BoDoc()
        {
            return new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 64 };
        }

        public static Dictionary<string, object> Doc(byte[] b)
        {
            if (b == null || b.Length == 0) return new Dictionary<string, object>();
            try
            {
                var d = BoDoc().DeserializeObject(Encoding.UTF8.GetString(b)) as Dictionary<string, object>;
                return d ?? new Dictionary<string, object>();
            }
            catch (Exception)
            {
                throw new LoiApi(400, "Dữ liệu gửi lên không đúng dạng JSON.");
            }
        }

        public static Dictionary<string, object> DocDong(string s)
        {
            return BoDoc().DeserializeObject(s) as Dictionary<string, object>;
        }

        // ------------------------------------------------------------------ lấy giá trị từ JSON đã đọc

        public static string Chu(Dictionary<string, object> d, string k)
        {
            object v;
            return d != null && d.TryGetValue(k, out v) && v != null ? Convert.ToString(v, Inv) : null;
        }

        /// <summary>Chuỗi đã cắt khoảng trắng, giới hạn độ dài ("" khi không có).</summary>
        public static string Gon(Dictionary<string, object> d, string k, int toiDa)
        {
            string s = (Chu(d, k) ?? "").Trim();
            return s.Length > toiDa ? s.Substring(0, toiDa) : s;
        }

        public static int So(Dictionary<string, object> d, string k, int macDinh)
        {
            object v;
            if (d == null || !d.TryGetValue(k, out v) || v == null) return macDinh;
            if (v is int) return (int)v;
            if (v is long) return (int)(long)v;
            if (v is decimal) return (int)(decimal)v;
            if (v is double) return (int)(double)v;
            int r;
            return int.TryParse(Convert.ToString(v, Inv), NumberStyles.Integer, Inv, out r) ? r : macDinh;
        }

        public static double? SoThuc(Dictionary<string, object> d, string k)
        {
            object v;
            if (d == null || !d.TryGetValue(k, out v) || v == null) return null;
            if (v is int) return (int)v;
            if (v is long) return (long)v;
            if (v is decimal) return (double)(decimal)v;
            if (v is double) return (double)v;
            string s = Convert.ToString(v, Inv).Trim();
            if (s.Length == 0) return null;
            double r;
            if (!double.TryParse(s, NumberStyles.Float, Inv, out r) || double.IsNaN(r) || double.IsInfinity(r))
                throw new LoiApi(400, "Số không hợp lệ: " + s);
            return r;
        }

        public static bool Dung(Dictionary<string, object> d, string k)
        {
            object v;
            if (d == null || !d.TryGetValue(k, out v) || v == null) return false;
            if (v is bool) return (bool)v;
            string s = Convert.ToString(v, Inv);
            return s == "1" || string.Equals(s, "true", StringComparison.OrdinalIgnoreCase);
        }

        public static bool Co(Dictionary<string, object> d, string k)
        {
            return d != null && d.ContainsKey(k);
        }

        public static Dictionary<string, object> DoiTuong(Dictionary<string, object> d, string k)
        {
            object v;
            return d != null && d.TryGetValue(k, out v) ? v as Dictionary<string, object> : null;
        }

        public static List<object> Mang(Dictionary<string, object> d, string k)
        {
            object v;
            var r = new List<object>();
            if (d == null || !d.TryGetValue(k, out v) || v == null) return r;
            var a = v as IEnumerable;
            if (a == null || v is string) return r;
            foreach (object x in a) r.Add(x);
            return r;
        }

        public static List<string> MangChu(Dictionary<string, object> d, string k)
        {
            var r = new List<string>();
            foreach (object x in Mang(d, k)) if (x != null) r.Add(Convert.ToString(x, Inv));
            return r;
        }

        public static List<int> MangSo(Dictionary<string, object> d, string k)
        {
            var r = new List<int>();
            foreach (object x in Mang(d, k))
            {
                int v;
                if (x != null && int.TryParse(Convert.ToString(x, Inv), NumberStyles.Integer, Inv, out v)) r.Add(v);
            }
            return r;
        }
    }
}
