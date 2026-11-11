using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace NoiseLogger
{
    /// <summary>Chuẩn hoá chữ: bỏ khoảng trắng thừa, bỏ dấu để so tên.</summary>
    public static class VanBan
    {
        public static string ChuanHoa(string s)
        {
            if (s == null) return "";
            s = s.Normalize(NormalizationForm.FormC);
            return Regex.Replace(s, @"\s+", " ").Trim();
        }

        /// <summary>"Đội Cấp Nước số 1" → "doi cap nuoc so 1" (so tên không phân biệt dấu, hoa thường).</summary>
        public static string BoDau(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            string d = ChuanHoa(s).Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (char c in d)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return sb.ToString().Normalize(NormalizationForm.FormC).Replace('đ', 'd').Replace('Đ', 'D').ToLowerInvariant();
        }
    }
}
