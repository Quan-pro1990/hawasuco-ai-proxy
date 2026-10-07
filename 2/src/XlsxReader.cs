using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;

namespace ThatThoatNuoc
{
    /// <summary>1 ô đọc từ file Excel: giá trị đã tính sẵn (lưu trong file) + công thức (nếu có).</summary>
    public class OXls
    {
        public string Text;        // chuỗi (ô chữ hoặc kết quả công thức dạng chữ)
        public double? Number;
        public string Formula;     // không có dấu "=" ở đầu; công thức chia sẻ đã được dịch về đúng ô

        public bool IsEmpty { get { return Number == null && string.IsNullOrWhiteSpace(Text) && Formula == null; } }
        public string Chu { get { return Text != null ? Text : (Number.HasValue ? Number.Value.ToString(CultureInfo.InvariantCulture) : ""); } }
    }

    public class TrangXls
    {
        public string Ten;
        public readonly Dictionary<long, OXls> O = new Dictionary<long, OXls>();
        public readonly HashSet<int> DongAn = new HashSet<int>();   // dòng bị ẩn trong Excel
        public int SoDong;

        static long Key(int r, int c) { return (long)r * 100000 + c; }

        public OXls Lay(int row, int col)
        {
            OXls c;
            return O.TryGetValue(Key(row, col), out c) ? c : null;
        }

        public void Dat(int row, int col, OXls c)
        {
            O[Key(row, col)] = c;
            if (row > SoDong) SoDong = row;
        }

        public string Chu(int row, int col)
        {
            OXls c = Lay(row, col);
            return c == null ? "" : (c.Text ?? (c.Number.HasValue ? c.Number.Value.ToString(CultureInfo.InvariantCulture) : ""));
        }

        public double? So(int row, int col)
        {
            OXls c = Lay(row, col);
            return c == null ? null : c.Number;
        }

        public string CongThuc(int row, int col)
        {
            OXls c = Lay(row, col);
            return c == null ? null : c.Formula;
        }
    }

    /// <summary>Đọc file .xlsx (zip + XML) không cần Excel: tên trang, giá trị, công thức.</summary>
    public static class XlsxReader
    {
        const string NsMain = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const string NsRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

        public static List<TrangXls> Doc(string path)
        {
            // Mở chia sẻ để đọc được cả khi file đang mở trong Excel.
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (var zip = new ZipArchive(fs, ZipArchiveMode.Read))
            {
                var shared = DocChuoiChung(zip);
                var rels = DocQuanHe(zip, "xl/_rels/workbook.xml.rels");
                var wb = TaiXml(zip, "xl/workbook.xml");
                if (wb == null) throw new InvalidDataException("File không phải Excel .xlsx hợp lệ");
                var ns = new XmlNamespaceManager(wb.NameTable);
                ns.AddNamespace("m", NsMain);
                ns.AddNamespace("r", NsRel);
                var result = new List<TrangXls>();
                foreach (XmlElement s in wb.SelectNodes("//m:sheets/m:sheet", ns))
                {
                    string rid = s.GetAttribute("id", NsRel);
                    string target;
                    if (!rels.TryGetValue(rid, out target)) continue;
                    string part = target.StartsWith("/") ? target.Substring(1) : "xl/" + target;
                    var doc = TaiXml(zip, part);
                    if (doc == null) continue;
                    var trang = new TrangXls { Ten = s.GetAttribute("name") };
                    DocTrang(doc, shared, trang);
                    result.Add(trang);
                }
                return result;
            }
        }

        static XmlDocument TaiXml(ZipArchive zip, string name)
        {
            ZipArchiveEntry e = zip.GetEntry(name);
            if (e == null) return null;
            var doc = new XmlDocument();
            using (Stream s = e.Open()) doc.Load(s);
            return doc;
        }

        static Dictionary<string, string> DocQuanHe(ZipArchive zip, string name)
        {
            var d = new Dictionary<string, string>();
            var doc = TaiXml(zip, name);
            if (doc == null) return d;
            foreach (XmlElement r in doc.GetElementsByTagName("Relationship"))
                d[r.GetAttribute("Id")] = r.GetAttribute("Target");
            return d;
        }

        static List<string> DocChuoiChung(ZipArchive zip)
        {
            var list = new List<string>();
            var doc = TaiXml(zip, "xl/sharedStrings.xml");
            if (doc == null) return list;
            var ns = new XmlNamespaceManager(doc.NameTable);
            ns.AddNamespace("m", NsMain);
            foreach (XmlElement si in doc.SelectNodes("//m:si", ns))
            {
                var sb = new StringBuilder();
                // Bỏ phần phiên âm (rPh) — chỉ lấy chữ hiển thị.
                foreach (XmlElement t in si.SelectNodes("m:t | m:r/m:t", ns)) sb.Append(t.InnerText);
                list.Add(sb.ToString());
            }
            return list;
        }

        class ShareInfo
        {
            public int Row, Col;
            public string Formula;
        }

        static void DocTrang(XmlDocument doc, List<string> shared, TrangXls trang)
        {
            var ns = new XmlNamespaceManager(doc.NameTable);
            ns.AddNamespace("m", NsMain);
            var shares = new Dictionary<string, ShareInfo>();
            var pending = new List<KeyValuePair<OXls, string[]>>();   // ô dùng công thức chia sẻ chưa có gốc
            foreach (XmlElement row in doc.SelectNodes("//m:sheetData/m:row", ns))
            {
                int rn;
                string h = row.GetAttribute("hidden");
                if ((h == "1" || h == "true") && int.TryParse(row.GetAttribute("r"), out rn)) trang.DongAn.Add(rn);
            }
            foreach (XmlElement c in doc.SelectNodes("//m:sheetData/m:row/m:c", ns))
            {
                int row, col;
                if (!TachO(c.GetAttribute("r"), out row, out col)) continue;
                var cell = new OXls();
                string t = c.GetAttribute("t");
                XmlElement v = c.SelectSingleNode("m:v", ns) as XmlElement;
                XmlElement f = c.SelectSingleNode("m:f", ns) as XmlElement;
                XmlElement isNode = c.SelectSingleNode("m:is", ns) as XmlElement;
                if (v != null)
                {
                    string raw = v.InnerText;
                    if (t == "s")
                    {
                        int idx;
                        if (int.TryParse(raw, out idx) && idx >= 0 && idx < shared.Count) cell.Text = shared[idx];
                    }
                    else if (t == "str" || t == "inlineStr" || t == "e") cell.Text = raw;
                    else if (t == "b") cell.Number = raw == "1" ? 1 : 0;
                    else
                    {
                        double d;
                        if (double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out d)) cell.Number = d;
                    }
                }
                else if (isNode != null) cell.Text = isNode.InnerText;
                if (f != null)
                {
                    string ft = f.GetAttribute("t");
                    string si = f.GetAttribute("si");
                    if (ft == "shared" && si.Length > 0)
                    {
                        if (f.InnerText.Length > 0)
                        {
                            shares[si] = new ShareInfo { Row = row, Col = col, Formula = f.InnerText };
                            cell.Formula = f.InnerText;
                        }
                        else
                        {
                            ShareInfo info;
                            if (shares.TryGetValue(si, out info)) cell.Formula = DichCongThuc(info.Formula, row - info.Row, col - info.Col);
                            else pending.Add(new KeyValuePair<OXls, string[]>(cell, new[] { si, row.ToString(), col.ToString() }));
                        }
                    }
                    else if (f.InnerText.Length > 0) cell.Formula = f.InnerText;
                }
                trang.Dat(row, col, cell);
            }
            foreach (var p in pending)
            {
                ShareInfo info;
                if (shares.TryGetValue(p.Value[0], out info))
                    p.Key.Formula = DichCongThuc(info.Formula, int.Parse(p.Value[1]) - info.Row, int.Parse(p.Value[2]) - info.Col);
            }
        }

        public static bool TachO(string r, out int row, out int col)
        {
            row = col = 0;
            if (string.IsNullOrEmpty(r)) return false;
            int i = 0;
            while (i < r.Length && char.IsLetter(r[i]))
            {
                col = col * 26 + (char.ToUpperInvariant(r[i]) - 'A' + 1);
                i++;
            }
            return i > 0 && int.TryParse(r.Substring(i), out row);
        }

        public static string TenCot(int col)
        {
            string s = "";
            while (col > 0)
            {
                int m = (col - 1) % 26;
                s = (char)('A' + m) + s;
                col = (col - 1) / 26;
            }
            return s;
        }

        // Tham chiếu ô (có thể kèm tên trang): 'Tháng 8-2026'!K19, Sheet1!A1, $B$3, E12
        static readonly Regex RefRx = new Regex(
            @"(?<sheet>'(?:[^']|'')+'!|[^\W\d][\w\.]*!)?(?<![\w$.])(?<cd>\$?)(?<col>[A-Z]{1,3})(?<rd>\$?)(?<row>\d+)(?![\w(])",
            RegexOptions.Compiled);

        /// <summary>Dời các tham chiếu tương đối trong công thức chia sẻ sang ô khác (dr dòng, dc cột).</summary>
        public static string DichCongThuc(string f, int dr, int dc)
        {
            if (dr == 0 && dc == 0) return f;
            var sb = new StringBuilder();
            int last = 0;
            bool inStr = false;
            // Không dịch phần nằm trong chuỗi "..."
            var segments = new List<KeyValuePair<int, int>>();
            int segStart = 0;
            for (int i = 0; i < f.Length; i++)
            {
                if (f[i] == '"')
                {
                    if (!inStr) segments.Add(new KeyValuePair<int, int>(segStart, i));
                    else segStart = i + 1;
                    inStr = !inStr;
                }
            }
            if (!inStr) segments.Add(new KeyValuePair<int, int>(segStart, f.Length));
            foreach (var seg in segments)
            {
                sb.Append(f, last, seg.Key - last);
                string part = f.Substring(seg.Key, seg.Value - seg.Key);
                sb.Append(RefRx.Replace(part, m =>
                {
                    int col = 0;
                    foreach (char ch in m.Groups["col"].Value) col = col * 26 + (ch - 'A' + 1);
                    int row = int.Parse(m.Groups["row"].Value);
                    if (m.Groups["cd"].Value.Length == 0) col += dc;
                    if (m.Groups["rd"].Value.Length == 0) row += dr;
                    if (col < 1 || row < 1) return "#REF!";
                    return m.Groups["sheet"].Value + m.Groups["cd"].Value + TenCot(col) + m.Groups["rd"].Value + row;
                }));
                last = seg.Value;
            }
            sb.Append(f, last, f.Length - last);
            return sb.ToString();
        }

        /// <summary>Các tham chiếu trong công thức: (tên trang hoặc null, dòng, cột).</summary>
        public static List<ThamChieu> CacThamChieu(string f)
        {
            var list = new List<ThamChieu>();
            if (string.IsNullOrEmpty(f)) return list;
            foreach (Match m in RefRx.Matches(f))
            {
                int col = 0;
                foreach (char ch in m.Groups["col"].Value) col = col * 26 + (ch - 'A' + 1);
                string sheet = m.Groups["sheet"].Value;
                if (sheet.Length > 0)
                {
                    sheet = sheet.Substring(0, sheet.Length - 1);
                    if (sheet.StartsWith("'")) sheet = sheet.Substring(1, sheet.Length - 2).Replace("''", "'");
                }
                list.Add(new ThamChieu { Trang = sheet.Length > 0 ? sheet : null, Dong = int.Parse(m.Groups["row"].Value), Cot = col, ViTri = m.Index, DoDai = m.Length });
            }
            return list;
        }
    }

    public class ThamChieu
    {
        public string Trang;
        public int Dong, Cot;
        public int ViTri, DoDai;
    }
}
