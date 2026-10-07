using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;

namespace ThatThoatNuoc
{
    /// <summary>Kiểu ô Excel (phông Times New Roman như báo cáo của công ty).</summary>
    public class XKieu
    {
        public bool Dam, Nghieng, GachChan;
        public double Co = 12;
        public string Phong = "Times New Roman";
        public string Ngang;            // left | center | right | null (mặc định)
        public string Doc = "center";   // top | center | bottom
        public bool XuongDong;
        public bool Khung;
        public string DinhDang;         // vd "#,##0" ; null = General
        public string Nen;              // ARGB, vd "FFDCE6F1"
        public string Mau;              // màu chữ ARGB
        public int Le;                  // thụt lề

        public XKieu Chep()
        {
            return (XKieu)MemberwiseClone();
        }

        public XKieu Voi(Action<XKieu> sua)
        {
            XKieu k = Chep();
            sua(k);
            return k;
        }

        internal string KhoaPhong()
        {
            return (Dam ? "b" : "") + (Nghieng ? "i" : "") + (GachChan ? "u" : "") + "|" + Co.ToString(CultureInfo.InvariantCulture) + "|" + Phong + "|" + Mau;
        }
    }

    public class XO
    {
        public object GiaTri;
        public string CongThuc;
        public XKieu Kieu;
    }

    public class XTrang
    {
        public string Ten;
        internal readonly SortedDictionary<int, SortedDictionary<int, XO>> Dong = new SortedDictionary<int, SortedDictionary<int, XO>>();
        internal readonly List<string> Gop = new List<string>();
        public readonly Dictionary<int, double> RongCot = new Dictionary<int, double>();
        public readonly Dictionary<int, double> CaoDong = new Dictionary<int, double>();
        public bool Ngang = true;
        public int LapTu, LapDen;       // dòng tiêu đề in lặp lại mỗi trang
        public int CoDinhDong;          // số dòng cố định khi cuộn
        public int CoDinhCot;
        public int VungInCot;           // số cột vùng in (0 = tự)

        public XTrang(string ten)
        {
            Ten = ten;
        }

        XO Lay(int r, int c)
        {
            SortedDictionary<int, XO> row;
            if (!Dong.TryGetValue(r, out row))
            {
                row = new SortedDictionary<int, XO>();
                Dong[r] = row;
            }
            XO o;
            if (!row.TryGetValue(c, out o))
            {
                o = new XO();
                row[c] = o;
            }
            return o;
        }

        public void Dat(int r, int c, object v, XKieu k)
        {
            XO o = Lay(r, c);
            o.GiaTri = v;
            o.CongThuc = null;
            o.Kieu = k;
        }

        /// <summary>Ô công thức kèm giá trị đã tính (Excel mở lên thấy ngay, sửa số thì tự tính lại).</summary>
        public void CongThuc(int r, int c, string f, object v, XKieu k)
        {
            XO o = Lay(r, c);
            o.GiaTri = v;
            o.CongThuc = f;
            o.Kieu = k;
        }

        public void Kieu(int r, int c, XKieu k)
        {
            Lay(r, c).Kieu = k;
        }

        /// <summary>Gộp ô, ghi giá trị ở ô đầu, kẻ khung/định dạng đủ mọi ô trong vùng gộp.</summary>
        public void GopO(int r1, int c1, int r2, int c2, object v, XKieu k)
        {
            for (int r = r1; r <= r2; r++)
                for (int c = c1; c <= c2; c++)
                {
                    XO o = Lay(r, c);
                    o.Kieu = k;
                    if (r != r1 || c != c1) { o.GiaTri = null; o.CongThuc = null; }
                }
            Dat(r1, c1, v, k);
            if (r1 != r2 || c1 != c2) Gop.Add(XlsxReader.TenCot(c1) + r1 + ":" + XlsxReader.TenCot(c2) + r2);
        }

        public static string O(int r, int c) { return XlsxReader.TenCot(c) + r; }
    }

    /// <summary>Ghi file .xlsx nhiều trang có định dạng, gộp ô, công thức — không cần Excel.</summary>
    public class XSo
    {
        const string NsMain = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        const string NsRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
        const string NsPkgRel = "http://schemas.openxmlformats.org/package/2006/relationships";
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public readonly List<XTrang> Trang = new List<XTrang>();

        readonly List<string> fonts = new List<string>();
        readonly List<string> fills = new List<string>();
        readonly List<string> numFmts = new List<string>();
        readonly List<string> xfs = new List<string>();
        readonly Dictionary<string, int> fontIdx = new Dictionary<string, int>();
        readonly Dictionary<string, int> fillIdx = new Dictionary<string, int>();
        readonly Dictionary<string, int> fmtIdx = new Dictionary<string, int>();
        readonly Dictionary<string, int> xfIdx = new Dictionary<string, int>();

        public XTrang Them(string ten)
        {
            string name = TenTrangHopLe(ten);
            for (int i = 2; Trang.Any(t => string.Equals(t.Ten, name, StringComparison.OrdinalIgnoreCase)); i++)
                name = TenTrangHopLe(ten + " (" + i + ")");
            var t2 = new XTrang(name);
            Trang.Add(t2);
            return t2;
        }

        public static string TenTrangHopLe(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) name = "Trang";
            foreach (char c in "[]:*?/\\") name = name.Replace(c, '-');
            name = name.Trim().Trim('\'');
            return name.Length > 31 ? name.Substring(0, 31) : name;
        }

        public static string ThamChieuTrang(string ten)
        {
            return "'" + ten.Replace("'", "''") + "'!";
        }

        int Font(XKieu k)
        {
            string key = k.KhoaPhong();
            int i;
            if (fontIdx.TryGetValue(key, out i)) return i;
            var sb = new StringBuilder("<font>");
            if (k.Dam) sb.Append("<b/>");
            if (k.Nghieng) sb.Append("<i/>");
            if (k.GachChan) sb.Append("<u/>");
            sb.Append("<sz val=\"").Append(k.Co.ToString(Inv)).Append("\"/>");
            if (k.Mau != null) sb.Append("<color rgb=\"").Append(k.Mau).Append("\"/>");
            sb.Append("<name val=\"").Append(Esc(k.Phong)).Append("\"/><family val=\"1\"/></font>");
            fonts.Add(sb.ToString());
            fontIdx[key] = fonts.Count - 1;
            return fonts.Count - 1;
        }

        int Fill(string argb)
        {
            if (argb == null) return 0;
            int i;
            if (fillIdx.TryGetValue(argb, out i)) return i;
            fills.Add("<fill><patternFill patternType=\"solid\"><fgColor rgb=\"" + argb + "\"/><bgColor indexed=\"64\"/></patternFill></fill>");
            fillIdx[argb] = fills.Count - 1;
            return fills.Count - 1;
        }

        int Fmt(string f)
        {
            if (f == null) return 0;
            int i;
            if (fmtIdx.TryGetValue(f, out i)) return i;
            i = 164 + numFmts.Count;
            numFmts.Add("<numFmt numFmtId=\"" + i + "\" formatCode=\"" + Esc(f) + "\"/>");
            fmtIdx[f] = i;
            return i;
        }

        int Xf(XKieu k)
        {
            if (k == null) return 0;
            int font = Font(k), fill = Fill(k.Nen), fmt = Fmt(k.DinhDang), border = k.Khung ? 1 : 0;
            var sb = new StringBuilder();
            sb.Append("<xf numFmtId=\"").Append(fmt).Append("\" fontId=\"").Append(font).Append("\" fillId=\"").Append(fill)
              .Append("\" borderId=\"").Append(border).Append("\" xfId=\"0\" applyFont=\"1\"");
            if (fmt != 0) sb.Append(" applyNumberFormat=\"1\"");
            if (fill != 0) sb.Append(" applyFill=\"1\"");
            if (border != 0) sb.Append(" applyBorder=\"1\"");
            sb.Append(" applyAlignment=\"1\"><alignment");
            if (k.Ngang != null) sb.Append(" horizontal=\"").Append(k.Ngang).Append("\"");
            if (k.Doc != null) sb.Append(" vertical=\"").Append(k.Doc).Append("\"");
            if (k.XuongDong) sb.Append(" wrapText=\"1\"");
            if (k.Le > 0) sb.Append(" indent=\"").Append(k.Le).Append("\"");
            sb.Append("/></xf>");
            string key = sb.ToString();
            int i;
            if (xfIdx.TryGetValue(key, out i)) return i;
            xfs.Add(key);
            xfIdx[key] = xfs.Count - 1;
            return xfs.Count - 1;
        }

        public void Luu(string path)
        {
            string tmp = path + ".tmp";
            using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write)) LuuVao(fs);
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        public byte[] LuuBytes()
        {
            using (var ms = new MemoryStream())
            {
                LuuVao(ms);
                return ms.ToArray();
            }
        }

        void LuuVao(Stream fs)
        {
            fonts.Clear(); fills.Clear(); numFmts.Clear(); xfs.Clear();
            fontIdx.Clear(); fillIdx.Clear(); fmtIdx.Clear(); xfIdx.Clear();
            Font(new XKieu());
            fills.Add("<fill><patternFill patternType=\"none\"/></fill>");
            fills.Add("<fill><patternFill patternType=\"gray125\"/></fill>");
            xfs.Add("<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>");
            var sheetXml = Trang.Select(SheetXml).ToList();

            using (var zip = new ZipArchive(fs, ZipArchiveMode.Create, true))
            {
                var types = new StringBuilder();
                var rels = new StringBuilder();
                var sheets = new StringBuilder();
                var names = new StringBuilder();
                for (int i = 0; i < Trang.Count; i++)
                {
                    int n = i + 1;
                    types.Append("<Override PartName=\"/xl/worksheets/sheet").Append(n)
                         .Append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
                    rels.Append("<Relationship Id=\"rId").Append(n).Append("\" Type=\"").Append(NsRel)
                        .Append("/worksheet\" Target=\"worksheets/sheet").Append(n).Append(".xml\"/>");
                    sheets.Append("<sheet name=\"").Append(Esc(Trang[i].Ten)).Append("\" sheetId=\"").Append(n).Append("\" r:id=\"rId").Append(n).Append("\"/>");
                    XTrang t = Trang[i];
                    if (t.LapTu > 0)
                        names.Append("<definedName name=\"_xlnm.Print_Titles\" localSheetId=\"").Append(i).Append("\">")
                             .Append(Esc(ThamChieuTrang(t.Ten))).Append("$").Append(t.LapTu).Append(":$").Append(t.LapDen).Append("</definedName>");
                }
                Put(zip, "[Content_Types].xml",
                    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                    "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
                    types +
                    "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
                    "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>" +
                    "<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>" +
                    "</Types>");
                Put(zip, "_rels/.rels",
                    "<Relationships xmlns=\"" + NsPkgRel + "\">" +
                    "<Relationship Id=\"rId1\" Type=\"" + NsRel + "/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                    "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>" +
                    "<Relationship Id=\"rId3\" Type=\"" + NsRel + "/extended-properties\" Target=\"docProps/app.xml\"/>" +
                    "</Relationships>");
                string now = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ", Inv);
                Put(zip, "docProps/core.xml",
                    "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" " +
                    "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" " +
                    "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">" +
                    "<dc:creator>" + Esc(UngDung.Ten) + "</dc:creator>" +
                    "<dcterms:created xsi:type=\"dcterms:W3CDTF\">" + now + "</dcterms:created>" +
                    "<dcterms:modified xsi:type=\"dcterms:W3CDTF\">" + now + "</dcterms:modified>" +
                    "</cp:coreProperties>");
                Put(zip, "docProps/app.xml",
                    "<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\"><Application>Microsoft Excel</Application></Properties>");
                Put(zip, "xl/_rels/workbook.xml.rels",
                    "<Relationships xmlns=\"" + NsPkgRel + "\">" + rels +
                    "<Relationship Id=\"rId" + (Trang.Count + 1) + "\" Type=\"" + NsRel + "/styles\" Target=\"styles.xml\"/>" +
                    "</Relationships>");
                Put(zip, "xl/workbook.xml",
                    "<workbook xmlns=\"" + NsMain + "\" xmlns:r=\"" + NsRel + "\">" +
                    "<bookViews><workbookView xWindow=\"0\" yWindow=\"0\" windowWidth=\"28800\" windowHeight=\"12300\"/></bookViews>" +
                    "<sheets>" + sheets + "</sheets>" +
                    (names.Length > 0 ? "<definedNames>" + names + "</definedNames>" : "") +
                    "<calcPr calcId=\"191029\" fullCalcOnLoad=\"1\"/>" +
                    "</workbook>");
                Put(zip, "xl/styles.xml", StylesXml());
                for (int i = 0; i < Trang.Count; i++) Put(zip, "xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml[i]);
            }
        }

        string StylesXml()
        {
            const string border = "<border><left style=\"thin\"><color auto=\"1\"/></left><right style=\"thin\"><color auto=\"1\"/></right>" +
                                  "<top style=\"thin\"><color auto=\"1\"/></top><bottom style=\"thin\"><color auto=\"1\"/></bottom><diagonal/></border>";
            var sb = new StringBuilder();
            sb.Append("<styleSheet xmlns=\"").Append(NsMain).Append("\">");
            if (numFmts.Count > 0) sb.Append("<numFmts count=\"").Append(numFmts.Count).Append("\">").Append(string.Concat(numFmts)).Append("</numFmts>");
            sb.Append("<fonts count=\"").Append(fonts.Count).Append("\">").Append(string.Concat(fonts)).Append("</fonts>");
            sb.Append("<fills count=\"").Append(fills.Count).Append("\">").Append(string.Concat(fills)).Append("</fills>");
            sb.Append("<borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border>").Append(border).Append("</borders>");
            sb.Append("<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>");
            sb.Append("<cellXfs count=\"").Append(xfs.Count).Append("\">").Append(string.Concat(xfs)).Append("</cellXfs>");
            sb.Append("<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>");
            sb.Append("</styleSheet>");
            return sb.ToString();
        }

        string SheetXml(XTrang t)
        {
            var sb = new StringBuilder();
            sb.Append("<worksheet xmlns=\"").Append(NsMain).Append("\" xmlns:r=\"").Append(NsRel).Append("\">");
            sb.Append("<sheetPr><pageSetUpPr fitToPage=\"1\"/></sheetPr>");
            sb.Append("<sheetViews><sheetView workbookViewId=\"0\" zoomScale=\"85\" zoomScaleNormal=\"85\"");
            if (Trang.IndexOf(t) == 0) sb.Append(" tabSelected=\"1\"");
            sb.Append(">");
            if (t.CoDinhDong > 0 || t.CoDinhCot > 0)
            {
                sb.Append("<pane");
                if (t.CoDinhCot > 0) sb.Append(" xSplit=\"").Append(t.CoDinhCot).Append("\"");
                if (t.CoDinhDong > 0) sb.Append(" ySplit=\"").Append(t.CoDinhDong).Append("\"");
                sb.Append(" topLeftCell=\"").Append(XTrang.O(t.CoDinhDong + 1, t.CoDinhCot + 1)).Append("\" activePane=\"")
                  .Append(t.CoDinhCot > 0 && t.CoDinhDong > 0 ? "bottomRight" : t.CoDinhDong > 0 ? "bottomLeft" : "topRight")
                  .Append("\" state=\"frozen\"/>");
            }
            sb.Append("</sheetView></sheetViews>");
            sb.Append("<sheetFormatPr defaultRowHeight=\"15.75\"/>");
            if (t.RongCot.Count > 0)
            {
                sb.Append("<cols>");
                foreach (var kv in t.RongCot.OrderBy(k => k.Key))
                    sb.Append("<col min=\"").Append(kv.Key).Append("\" max=\"").Append(kv.Key).Append("\" width=\"")
                      .Append(kv.Value.ToString(Inv)).Append("\" customWidth=\"1\"/>");
                sb.Append("</cols>");
            }
            sb.Append("<sheetData>");
            var allRows = new SortedSet<int>(t.Dong.Keys);
            foreach (int r in t.CaoDong.Keys) allRows.Add(r);
            foreach (int r in allRows)
            {
                sb.Append("<row r=\"").Append(r).Append("\"");
                double h;
                if (t.CaoDong.TryGetValue(r, out h)) sb.Append(" ht=\"").Append(h.ToString(Inv)).Append("\" customHeight=\"1\"");
                sb.Append(">");
                SortedDictionary<int, XO> row;
                if (t.Dong.TryGetValue(r, out row))
                    foreach (var kv in row) Cell(sb, XTrang.O(r, kv.Key), kv.Value);
                sb.Append("</row>");
            }
            sb.Append("</sheetData>");
            if (t.Gop.Count > 0)
            {
                sb.Append("<mergeCells count=\"").Append(t.Gop.Count).Append("\">");
                foreach (string g in t.Gop) sb.Append("<mergeCell ref=\"").Append(g).Append("\"/>");
                sb.Append("</mergeCells>");
            }
            sb.Append("<printOptions horizontalCentered=\"1\"/>");
            sb.Append("<pageMargins left=\"0.35\" right=\"0.35\" top=\"0.5\" bottom=\"0.5\" header=\"0.3\" footer=\"0.3\"/>");
            sb.Append("<pageSetup paperSize=\"9\" orientation=\"").Append(t.Ngang ? "landscape" : "portrait").Append("\" fitToWidth=\"1\" fitToHeight=\"0\"/>");
            sb.Append("</worksheet>");
            return sb.ToString();
        }

        void Cell(StringBuilder sb, string reference, XO o)
        {
            int s = Xf(o.Kieu);
            object v = o.GiaTri;
            sb.Append("<c r=\"").Append(reference).Append("\"");
            if (s != 0) sb.Append(" s=\"").Append(s).Append("\"");
            bool number = v is int || v is long || v is double || v is decimal || v is float;
            if (number && v is double && (double.IsNaN((double)v) || double.IsInfinity((double)v))) { v = null; number = false; }
            if (o.CongThuc != null)
            {
                if (!number && v != null) sb.Append(" t=\"str\"");
                sb.Append("><f>").Append(Esc(o.CongThuc)).Append("</f>");
                if (number) sb.Append("<v>").Append(Convert.ToDouble(v).ToString("R", Inv)).Append("</v>");
                else if (v != null) sb.Append("<v>").Append(Esc(Convert.ToString(v))).Append("</v>");
                sb.Append("</c>");
                return;
            }
            if (v == null || (v is string && ((string)v).Length == 0))
            {
                sb.Append("/>");
                return;
            }
            if (number)
            {
                sb.Append("><v>").Append(Convert.ToDouble(v).ToString("R", Inv)).Append("</v></c>");
                return;
            }
            string text = v is DateTime ? ((DateTime)v).ToString("dd/MM/yyyy") : Convert.ToString(v);
            sb.Append(" t=\"inlineStr\"><is><t xml:space=\"preserve\">").Append(Esc(text)).Append("</t></is></c>");
        }

        static void Put(ZipArchive zip, string name, string xml)
        {
            var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
            using (var w = new StreamWriter(entry.Open(), new UTF8Encoding(false)))
            {
                w.Write("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n");
                w.Write(xml);
            }
        }

        /// <summary>Thoát ký tự XML và bỏ ký tự điều khiển (Excel báo file hỏng nếu còn).</summary>
        public static string Esc(string s)
        {
            if (s == null) return "";
            var sb = new StringBuilder(s.Length + 16);
            foreach (char c in s)
            {
                switch (c)
                {
                    case '&': sb.Append("&amp;"); break;
                    case '<': sb.Append("&lt;"); break;
                    case '>': sb.Append("&gt;"); break;
                    case '"': sb.Append("&quot;"); break;
                    case '\r': break;
                    default:
                        if (c < 0x20 && c != '\t' && c != '\n') break;
                        sb.Append(c);
                        break;
                }
            }
            return sb.ToString();
        }
    }
}
