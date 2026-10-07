using System;
using System.Globalization;

namespace ThatThoatNuoc
{
    /// <summary>Hiển thị và đọc số kiểu Việt Nam: 1.234.567 và 18,63.</summary>
    public static class So
    {
        public static readonly CultureInfo VN;

        static So()
        {
            VN = (CultureInfo)CultureInfo.GetCultureInfo("vi-VN").Clone();
            VN.NumberFormat.NumberGroupSeparator = ".";
            VN.NumberFormat.NumberDecimalSeparator = ",";
            VN.NumberFormat.NegativeSign = "-";
        }

        /// <summary>Sản lượng m³: số nguyên có dấu chấm ngăn cách, số lẻ giữ tối đa 2 chữ số.</summary>
        public static string M3(double? v)
        {
            if (!v.HasValue) return "";
            double x = Math.Round(v.Value, 2);
            if (Math.Abs(x - Math.Round(x)) < 0.0000001) return x.ToString("#,##0", VN);
            return x.ToString("#,##0.##", VN);
        }

        /// <summary>Chỉ số đồng hồ / số lớn không lẻ.</summary>
        public static string N0(double? v)
        {
            return M3(v);
        }

        /// <summary>Tỷ lệ % 2 chữ số lẻ.</summary>
        public static string P2(double? v)
        {
            if (!v.HasValue) return "";
            return Math.Round(v.Value, 2).ToString("0.00", VN);
        }

        /// <summary>Chênh lệch có dấu: +2,76 / -1,74.</summary>
        public static string Lech(double? v)
        {
            if (!v.HasValue) return "";
            double x = Math.Round(v.Value, 2);
            if (x == 0) return "0,00";
            return (x > 0 ? "+" : "") + x.ToString("0.00", VN);
        }

        /// <summary>Số dùng trong ô nhập (không ngăn cách hàng nghìn để dễ sửa).</summary>
        public static string Nhap(double? v)
        {
            if (!v.HasValue) return "";
            return Math.Round(v.Value, 6).ToString("0.######", VN);
        }

        /// <summary>
        /// Đọc số người dùng gõ. Chấp nhận "1.234.567", "1234567", "1728,47", "1728.47", "-12,5".
        /// Có dấu phẩy → phẩy là dấu thập phân. Chỉ có 1 dấu chấm và đúng 3 chữ số sau nó → chấm
        /// ngăn cách hàng nghìn (gõ chỉ số 1.234); còn lại chấm là dấu thập phân.
        /// Trống → null (hợp lệ).
        /// </summary>
        public static bool TryDoc(string text, out double? value)
        {
            value = null;
            if (text == null) return true;
            string s = text.Trim().Replace(" ", "").Replace(" ", "").Replace("m³", "").Replace("m3", "").Replace("%", "");
            if (s.Length == 0) return true;
            bool neg = false;
            if (s.StartsWith("+")) s = s.Substring(1);
            else if (s.StartsWith("-") || s.StartsWith("−"))
            {
                neg = true;
                s = s.Substring(1);
            }
            if (s.Length == 0) return false;
            if (s.IndexOf(',') >= 0)
            {
                if (s.IndexOf(',') != s.LastIndexOf(',')) return false;
                s = s.Replace(".", "").Replace(',', '.');
            }
            else
            {
                int first = s.IndexOf('.'), last = s.LastIndexOf('.');
                if (first >= 0 && first != last) s = s.Replace(".", "");
                else if (first > 0 && first <= 3 && s.Length - first - 1 == 3 && !s.StartsWith("0")) s = s.Replace(".", "");
            }
            foreach (char c in s) if (!(char.IsDigit(c) || c == '.')) return false;
            double d;
            if (!double.TryParse(s, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out d)) return false;
            value = neg ? -d : d;
            return true;
        }

        public static string Ngay(DateTime? d)
        {
            return d.HasValue ? d.Value.ToString("dd/MM/yyyy") : "";
        }

        /// <summary>"ngày 17 tháng 8 năm 2026"</summary>
        public static string NgayChu(DateTime d)
        {
            return "ngày " + d.Day + " tháng " + d.Month + " năm " + d.Year;
        }

        public static string LaMa(int n)
        {
            string[] r = { "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII" };
            return n >= 0 && n < r.Length ? r[n] : n.ToString();
        }
    }
}
