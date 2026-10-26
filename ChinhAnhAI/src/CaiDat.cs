using System;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;

namespace ChinhAnhAI
{
    /// <summary>Cài đặt của người dùng, lưu ở %APPDATA%\ChinhAnhAI\caidat.xml. API key được mã hoá bằng DPAPI (chỉ tài khoản Windows này đọc được).</summary>
    public class CaiDat
    {
        public string ApiKey = "";
        public string Model = AiClaude.ModelMacDinh;
        public string DiaChiApi = AiClaude.DiaChiMacDinh;
        public bool DungAI;
        public bool TuDongKhiMo = true;
        public int ChatLuongJpeg = 95;
        public string ThuMucLuu = "";           // "" = lưu cạnh ảnh gốc
        public string HauTo = "_AI";
        public string PhongCach = "tu_dong";
        public int CuongDo = 100;               // %
        public string YeuCauAI = "";
        public int CanhDaiXuat;                 // 0 = giữ cỡ gốc

        public static string ThuMuc
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ChinhAnhAI"); }
        }

        static string TepCaiDat { get { return Path.Combine(ThuMuc, "caidat.xml"); } }

        /// <summary>API key dùng thật: đã lưu, nếu không có thì lấy biến môi trường ANTHROPIC_API_KEY.</summary>
        public string KeyDung
        {
            get
            {
                if (!string.IsNullOrWhiteSpace(ApiKey)) return ApiKey.Trim();
                return (Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY") ?? "").Trim();
            }
        }

        public static CaiDat Doc()
        {
            var c = new CaiDat();
            try
            {
                if (!File.Exists(TepCaiDat)) return c;
                XElement x = XDocument.Load(TepCaiDat).Root;
                Func<string, string, string> s = (ten, md) => x.Element(ten) != null ? x.Element(ten).Value : md;
                Func<string, int, int> n = (ten, md) =>
                {
                    int v;
                    return int.TryParse(s(ten, ""), NumberStyles.Integer, CultureInfo.InvariantCulture, out v) ? v : md;
                };
                c.ApiKey = GiaiMa(s("ApiKey", ""));
                c.Model = s("Model", c.Model);
                c.DiaChiApi = s("DiaChiApi", c.DiaChiApi);
                c.DungAI = s("DungAI", "0") == "1";
                c.TuDongKhiMo = s("TuDongKhiMo", "1") == "1";
                c.ChatLuongJpeg = Math.Max(50, Math.Min(100, n("ChatLuongJpeg", c.ChatLuongJpeg)));
                c.ThuMucLuu = s("ThuMucLuu", "");
                c.HauTo = s("HauTo", c.HauTo);
                c.PhongCach = s("PhongCach", c.PhongCach);
                c.CuongDo = Math.Max(0, Math.Min(150, n("CuongDo", c.CuongDo)));
                c.YeuCauAI = s("YeuCauAI", "");
                c.CanhDaiXuat = Math.Max(0, n("CanhDaiXuat", 0));
            }
            catch (Exception) { }
            return c;
        }

        public void Ghi()
        {
            Directory.CreateDirectory(ThuMuc);
            var x = new XElement("CaiDat",
                new XElement("ApiKey", MaHoa(ApiKey)),
                new XElement("Model", Model),
                new XElement("DiaChiApi", DiaChiApi),
                new XElement("DungAI", DungAI ? "1" : "0"),
                new XElement("TuDongKhiMo", TuDongKhiMo ? "1" : "0"),
                new XElement("ChatLuongJpeg", ChatLuongJpeg),
                new XElement("ThuMucLuu", ThuMucLuu),
                new XElement("HauTo", HauTo),
                new XElement("PhongCach", PhongCach),
                new XElement("CuongDo", CuongDo),
                new XElement("YeuCauAI", YeuCauAI),
                new XElement("CanhDaiXuat", CanhDaiXuat));
            string tam = TepCaiDat + ".tmp";
            new XDocument(x).Save(tam);
            if (File.Exists(TepCaiDat)) File.Delete(TepCaiDat);
            File.Move(tam, TepCaiDat);
        }

        static string MaHoa(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            try { return Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(s), null, DataProtectionScope.CurrentUser)); }
            catch (Exception) { return ""; }
        }

        static string GiaiMa(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            try { return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(s), null, DataProtectionScope.CurrentUser)); }
            catch (Exception) { return ""; }
        }

        /// <summary>Đường dẫn ảnh kết quả cho ảnh gốc <paramref name="goc"/>.</summary>
        public string DuongDanLuu(string goc)
        {
            string thuMuc = string.IsNullOrWhiteSpace(ThuMucLuu) ? Path.GetDirectoryName(goc) : ThuMucLuu;
            string duoi = Path.GetExtension(goc).ToLowerInvariant();
            if (duoi != ".png" && duoi != ".tif" && duoi != ".tiff") duoi = ".jpg";
            string kq = Path.Combine(thuMuc, Path.GetFileNameWithoutExtension(goc) + HauTo + duoi);
            // không bao giờ ghi đè ảnh gốc
            if (string.Equals(Path.GetFullPath(kq), Path.GetFullPath(goc), StringComparison.OrdinalIgnoreCase))
                kq = Path.Combine(thuMuc, Path.GetFileNameWithoutExtension(goc) + "_AI" + duoi);
            return kq;
        }
    }
}
