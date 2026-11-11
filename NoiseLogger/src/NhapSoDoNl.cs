using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace NoiseLogger
{
    /// <summary>
    /// Nhập số đo noise logger từ file CSV / TXT / Excel xuất từ phần mềm của hãng (mỗi hãng 1 kiểu cột):
    /// tự nhận dòng tiêu đề và đoán cột mã logger, tên điểm, ngày, mức ồn, độ trải, tần số; người dùng sửa lại được.
    /// Mỗi dòng gán vào điểm theo tên điểm (nếu có cột) hoặc theo nơi logger đang lắp vào đêm đó.
    /// Nhiều số ghi trong 1 đêm (dữ liệu từng lần ghi): mức ồn = nhỏ nhất, độ trải = P90 − P10 của các lần ghi.
    /// </summary>
    public static class NhapSoDoNl
    {
        public enum Truong { MaLogger, TenDiem, Ngay, Gio, MucOn, DoTrai, TanSo }
        public const int SoTruong = 7;

        public static readonly string[] TenTruong = { "Mã logger (số seri)", "Tên điểm", "Ngày", "Giờ (nếu tách cột)", "Mức ồn (dB)", "Độ trải (spread)", "Tần số (Hz)" };

        /// <summary>1 bảng đọc từ file: các ô là string hoặc double (ô số của Excel, kể cả ngày).</summary>
        public class Bang
        {
            public string Ten = "";
            public readonly List<object[]> Dong = new List<object[]>();
            public int SoCot { get { return Dong.Count == 0 ? 0 : Dong.Max(r => r.Length); } }

            public object O(int r, int c)
            {
                object[] row = r >= 0 && r < Dong.Count ? Dong[r] : null;
                return row != null && c >= 0 && c < row.Length ? row[c] : null;
            }

            public string Chu(int r, int c)
            {
                object o = O(r, c);
                if (o == null) return "";
                if (o is double) return ((double)o).ToString(CultureInfo.InvariantCulture);
                return Convert.ToString(o).Trim();
            }

            public override string ToString() { return Ten + " (" + Dong.Count + " dòng)"; }
        }

        // ------------------------------------------------------------------ đọc file

        public static List<Bang> DocFile(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            if (ext == ".xls") throw new InvalidDataException("File .xls (Excel 97-2003) chưa đọc được. Mở bằng Excel → Save As → \"Excel Workbook (*.xlsx)\" hoặc \"CSV UTF-8\" rồi chọn lại.");
            if (ext == ".xlsx" || ext == ".xlsm") return DocXlsx(path);
            return new List<Bang> { DocCsv(path) };
        }

        static List<Bang> DocXlsx(string path)
        {
            var list = new List<Bang>();
            foreach (TrangXls t in XlsxReader.Doc(path))
            {
                if (t.O.Count == 0) continue;
                int maxCol = 0;
                foreach (long k in t.O.Keys) maxCol = Math.Max(maxCol, (int)(k % 100000));
                // giữ cả dòng trống để số dòng khớp với Excel
                var b = new Bang { Ten = t.Ten };
                bool coSo = false;
                for (int r = 1; r <= t.SoDong; r++)
                {
                    var row = new object[maxCol];
                    for (int c = 1; c <= maxCol; c++)
                    {
                        OXls o = t.Lay(r, c);
                        if (o == null) continue;
                        if (o.Number.HasValue) row[c - 1] = o.Number.Value;
                        else if (!string.IsNullOrWhiteSpace(o.Text)) row[c - 1] = o.Text;
                        coSo |= row[c - 1] != null;
                    }
                    b.Dong.Add(row);
                }
                if (coSo) list.Add(b);
            }
            return list;
        }

        static string DocChu(string path)
        {
            byte[] bytes = File.ReadAllBytes(path);
            if (bytes.Length >= 2 && ((bytes[0] == 0xFF && bytes[1] == 0xFE) || (bytes[0] == 0xFE && bytes[1] == 0xFF)))
                using (var r = new StreamReader(new MemoryStream(bytes), true)) return r.ReadToEnd();
            try
            {
                return new UTF8Encoding(false, true).GetString(bytes).TrimStart('﻿');
            }
            catch (DecoderFallbackException)
            {
                return Encoding.Default.GetString(bytes);   // file ANSI cũ (Windows-1252 / 1258)
            }
        }

        public static Bang DocCsv(string path)
        {
            string text = DocChu(path);
            var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            string dau = lines.FirstOrDefault(l => l.Trim().Length > 0) ?? "";
            char sep = dau.StartsWith("sep=", StringComparison.OrdinalIgnoreCase) && dau.Trim().Length == 5
                ? dau.Trim()[4]
                : DoanDauPhanCach(lines.Where(l => l.Trim().Length > 0).Take(20).ToList());
            var b = new Bang { Ten = Path.GetFileName(path) };
            int cuoi = lines.Length;
            while (cuoi > 0 && lines[cuoi - 1].Trim().Length == 0) cuoi--;
            for (int i = 0; i < cuoi; i++)
            {
                string line = lines[i];
                // dòng trống vẫn giữ để số dòng khớp với file; dòng "sep=;" của Excel coi như dòng trống
                if (line.Trim().Length == 0 || line.StartsWith("sep=", StringComparison.OrdinalIgnoreCase)) { b.Dong.Add(new object[0]); continue; }
                b.Dong.Add(TachDong(line, sep).Select(x => x.Length == 0 ? null : (object)x).ToArray());
            }
            return b;
        }

        static char DoanDauPhanCach(List<string> lines)
        {
            char best = ',';
            int bestScore = -1;
            foreach (char c in new[] { '\t', ';', ',', '|' })
            {
                var counts = lines.Select(l => TachDong(l, c).Count).ToList();
                if (counts.Count == 0) continue;
                int min = counts.Min();
                // dấu phân cách đúng: các dòng có số cột giống nhau và > 1
                int score = min <= 1 ? 0 : counts.Count(x => x == counts[counts.Count - 1]) * 100 + min;
                if (score > bestScore) { bestScore = score; best = c; }
            }
            return best;
        }

        static List<string> TachDong(string line, char sep)
        {
            var cells = new List<string>();
            var sb = new StringBuilder();
            bool q = false;
            for (int i = 0; i < line.Length; i++)
            {
                char ch = line[i];
                if (q)
                {
                    if (ch == '"')
                    {
                        if (i + 1 < line.Length && line[i + 1] == '"') { sb.Append('"'); i++; }
                        else q = false;
                    }
                    else sb.Append(ch);
                }
                else if (ch == '"' && sb.ToString().Trim().Length == 0) { sb.Clear(); q = true; }
                else if (ch == sep) { cells.Add(sb.ToString().Trim()); sb.Clear(); }
                else sb.Append(ch);
            }
            cells.Add(sb.ToString().Trim());
            return cells;
        }

        // ------------------------------------------------------------------ nhận cột

        static readonly string[][] TuKhoa =
        {
            new[] { "ma logger", "logger id", "logger", "serial", "so seri", "seri", "s/n", "sn", "ma thiet bi", "thiet bi", "device", "unit", "id" },
            new[] { "ten diem", "diem", "vi tri", "dia diem", "location", "site", "name", "ten" },
            new[] { "ngay", "date", "thoi gian", "timestamp", "time", "night" },
            new[] { "gio", "hour", "time" },
            new[] { "muc on", "do on", "noise level", "level", "lvl", "min level", "db", "noise", "cuong do", "am luong" },
            new[] { "do trai", "spread", "width", "do rong", "do lech" },
            new[] { "tan so", "frequency", "freq", "hz" }
        };

        static int DiemTieuDe(string h, int truong)
        {
            string b = VanBan.BoDau(h);
            if (b.Length == 0 || b.Length > 60) return 0;
            int best = 0;
            string[] kws = TuKhoa[truong];
            for (int i = 0; i < kws.Length; i++)
            {
                string k = kws[i];
                bool khop = b == k || Regex.IsMatch(b, @"(^|[^a-z0-9])" + Regex.Escape(k) + @"($|[^a-z0-9])");
                if (khop) best = Math.Max(best, (b == k ? 200 : 100) - i);
            }
            // cột "Time" chỉ là cột giờ khi đã có cột ngày riêng
            return truong == (int)Truong.Gio && best > 0 ? best - 60 : best;
        }

        public class CotNhap
        {
            public int DongTieuDe = -1;                      // -1 = không có dòng tiêu đề
            public int[] Cot = Enumerable.Repeat(-1, SoTruong).ToArray();

            public int this[Truong t] { get { return Cot[(int)t]; } set { Cot[(int)t] = value; } }
        }

        /// <summary>Tìm dòng tiêu đề trong 20 dòng đầu và đoán cột của từng trường.</summary>
        public static CotNhap DoanCot(Bang b)
        {
            var kq = new CotNhap();
            int bestRow = -1, bestScore = 0;
            int[] bestCols = null;
            for (int r = 0; r < Math.Min(20, b.Dong.Count); r++)
            {
                int[] cols;
                int score = ChamDong(b, r, out cols);
                if (score > bestScore) { bestScore = score; bestRow = r; bestCols = cols; }
            }
            if (bestRow >= 0 && bestCols != null && (bestCols[(int)Truong.MucOn] >= 0 || bestCols[(int)Truong.Ngay] >= 0))
            {
                kq.DongTieuDe = bestRow;
                kq.Cot = bestCols;
            }
            else DoanTheoGiaTri(b, kq);
            return kq;
        }

        static int ChamDong(Bang b, int r, out int[] cols)
        {
            cols = Enumerable.Repeat(-1, SoTruong).ToArray();
            int n = b.Dong[r].Length;
            var diem = new int[SoTruong, n];
            for (int c = 0; c < n; c++)
            {
                if (b.O(r, c) is double) continue;
                string h = b.Chu(r, c);
                for (int t = 0; t < SoTruong; t++) diem[t, c] = DiemTieuDe(h, t);
            }
            // gán lần lượt cặp (trường, cột) điểm cao nhất, mỗi cột / trường dùng 1 lần
            var dungCot = new HashSet<int>();
            int tong = 0;
            while (true)
            {
                int bt = -1, bc = -1, bd = 0;
                for (int t = 0; t < SoTruong; t++)
                {
                    if (cols[t] >= 0) continue;
                    for (int c = 0; c < n; c++)
                        if (!dungCot.Contains(c) && diem[t, c] > bd) { bd = diem[t, c]; bt = t; bc = c; }
                }
                if (bt < 0) break;
                cols[bt] = bc;
                dungCot.Add(bc);
                tong += bd;
            }
            return tong;
        }

        /// <summary>Không có dòng tiêu đề: cột ngày = cột đọc được ngày, cột chữ đầu tiên = mã logger, các cột số tiếp theo = mức ồn, độ trải, tần số.</summary>
        static void DoanTheoGiaTri(Bang b, CotNhap kq)
        {
            int n = b.SoCot;
            var mau = b.Dong.Take(30).ToList();
            var la = new string[n];
            for (int c = 0; c < n; c++)
            {
                int ngay = 0, so = 0, chu = 0;
                for (int r = 0; r < mau.Count; r++)
                {
                    object o = b.O(r, c);
                    if (o == null) continue;
                    DateTime d;
                    bool coGio;
                    string s = b.Chu(r, c);
                    if (o is double ? LaSoNgayExcel((double)o) : DocNgay(s, true, out d, out coGio)) ngay++;
                    else if (o is double || DocSo(s).HasValue) so++;
                    else chu++;
                }
                la[c] = ngay > so && ngay > chu ? "ngay" : so > chu ? "so" : chu > 0 ? "chu" : "";
            }
            for (int c = 0; c < n; c++)
            {
                if (la[c] == "ngay" && kq[Truong.Ngay] < 0) kq[Truong.Ngay] = c;
                else if (la[c] == "chu" && kq[Truong.MaLogger] < 0) kq[Truong.MaLogger] = c;
            }
            var soCols = Enumerable.Range(0, n).Where(c => la[c] == "so").ToList();
            // cột số đầu tiên trước cột ngày thường là mã logger dạng số
            if (kq[Truong.MaLogger] < 0 && soCols.Count > 0 && kq[Truong.Ngay] > soCols[0]) { kq[Truong.MaLogger] = soCols[0]; soCols.RemoveAt(0); }
            Truong[] thuTu = { Truong.MucOn, Truong.DoTrai, Truong.TanSo };
            for (int i = 0; i < thuTu.Length && i < soCols.Count; i++) kq[thuTu[i]] = soCols[i];
        }

        // ------------------------------------------------------------------ đọc giá trị

        static bool LaSoNgayExcel(double v) { return v > 20000 && v < 80000; }

        /// <summary>Số kiểu "32,5" / "32.5" / "1.234,5" / "1,234.5"; bỏ đơn vị dB, Hz, %.</summary>
        public static double? DocSo(string s)
        {
            if (s == null) return null;
            s = Regex.Replace(s.Trim(), @"(?i)\s*(db|hz|%)$", "").Replace(" ", "").Replace(" ", "").Replace('−', '-');
            if (s.Length == 0 || s == "-") return null;
            int dot = s.LastIndexOf('.'), comma = s.LastIndexOf(',');
            if (dot >= 0 && comma >= 0)
            {
                if (comma > dot) s = s.Replace(".", "").Replace(',', '.');
                else s = s.Replace(",", "");
            }
            else if (comma >= 0) s = s.IndexOf(',') == comma ? s.Replace(',', '.') : s.Replace(",", "");
            else if (dot >= 0 && s.IndexOf('.') != dot) s = s.Replace(".", "");
            double v;
            return double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out v) ? v : (double?)null;
        }

        static readonly Regex NgayRe = new Regex(@"^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})(?:[ T]+(\d{1,2})[:h](\d{2})?(?::(\d{2}))?(?:\.\d+)?\s*(AM|PM|SA|CH)?)?$",
                                                 RegexOptions.IgnoreCase);

        /// <summary>Đọc ngày (kèm giờ nếu có). [ngayTruoc] = ngày đứng trước tháng (dd/MM/yyyy), false = MM/dd/yyyy.</summary>
        public static bool DocNgay(string s, bool ngayTruoc, out DateTime d, out bool coGio)
        {
            d = DateTime.MinValue;
            coGio = false;
            if (string.IsNullOrWhiteSpace(s)) return false;
            Match m = NgayRe.Match(s.Trim());
            if (!m.Success)
            {
                if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out d))
                {
                    coGio = d.TimeOfDay.TotalSeconds > 0;
                    return d.Year >= 2000 && d.Year <= 2100;
                }
                return false;
            }
            int a = int.Parse(m.Groups[1].Value), b = int.Parse(m.Groups[2].Value), c = int.Parse(m.Groups[3].Value);
            int y, mo, da;
            if (m.Groups[1].Value.Length == 4) { y = a; mo = b; da = c; }
            else
            {
                y = c < 100 ? 2000 + c : c;
                if (ngayTruoc) { da = a; mo = b; } else { mo = a; da = b; }
                if (mo > 12 && da <= 12) { int x = mo; mo = da; da = x; }
            }
            if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || da < 1 || da > DateTime.DaysInMonth(y, mo)) return false;
            d = new DateTime(y, mo, da);
            if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
            {
                int h = int.Parse(m.Groups[4].Value), mi = m.Groups[5].Success && m.Groups[5].Value.Length > 0 ? int.Parse(m.Groups[5].Value) : 0;
                string ap = m.Groups[7].Value.ToUpperInvariant();
                if ((ap == "PM" || ap == "CH") && h < 12) h += 12;
                if ((ap == "AM" || ap == "SA") && h == 12) h = 0;
                if (h < 24 && mi < 60)
                {
                    d = d.AddHours(h).AddMinutes(mi);
                    coGio = true;
                }
            }
            return true;
        }

        /// <summary>Cột ngày ghi dd/MM hay MM/dd: có số đầu &gt; 12 → ngày trước; có số giữa &gt; 12 → tháng trước; không rõ → ngày trước (kiểu Việt Nam).</summary>
        static bool NgayDungTruoc(Bang b, int cot, int tu)
        {
            for (int r = tu; r < b.Dong.Count; r++)
            {
                Match m = NgayRe.Match(b.Chu(r, cot));
                if (!m.Success || m.Groups[1].Value.Length == 4) continue;
                if (int.Parse(m.Groups[1].Value) > 12) return true;
                if (int.Parse(m.Groups[2].Value) > 12) return false;
            }
            return true;
        }

        /// <summary>Giờ ghi ở cột riêng: "02:00", "2h", 0.0833 (giờ dạng số của Excel).</summary>
        static double? DocGio(object o)
        {
            if (o == null) return null;
            if (o is double)
            {
                double v = (double)o;
                if (v >= 0 && v < 1) return v * 24;
                return v >= 0 && v < 24 ? v : (double?)null;
            }
            Match m = Regex.Match(Convert.ToString(o).Trim(), @"^(\d{1,2})(?:[:h](\d{2})?)?(?::\d{2})?\s*(AM|PM|SA|CH)?$", RegexOptions.IgnoreCase);
            if (!m.Success) return null;
            int h = int.Parse(m.Groups[1].Value), mi = m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? int.Parse(m.Groups[2].Value) : 0;
            string ap = m.Groups[3].Value.ToUpperInvariant();
            if ((ap == "PM" || ap == "CH") && h < 12) h += 12;
            if ((ap == "AM" || ap == "SA") && h == 12) h = 0;
            return h < 24 && mi < 60 ? h + mi / 60.0 : (double?)null;
        }

        /// <summary>Đêm của lần ghi: ghi từ 12h trưa trở đi tính cho đêm rạng sáng hôm sau.</summary>
        public static DateTime DemCua(DateTime thoiDiem, bool coGio)
        {
            return coGio && thoiDiem.Hour >= 12 ? thoiDiem.Date.AddDays(1) : thoiDiem.Date;
        }

        // ------------------------------------------------------------------ lập kế hoạch nhập

        public class KeHoach
        {
            public readonly List<SoDoNl> SoDo = new List<SoDoNl>();
            public readonly List<string> ThongBao = new List<string>();
            public int SoDongDoc, SoDongBo, SoMoi, SoThay, SoGiuNguyen;
            public DateTime? Tu, Den;
            public int SoDiem { get { return SoDo.Select(x => x.DiemId).Distinct().Count(); } }
        }

        class LanGhi
        {
            public DateTime Dem;
            public double? MucOn, DoTrai, TanSo;
            public int ThietBiId = -1;
        }

        public static KeHoach LapKeHoach(Bang b, CotNhap cot, DuLieuNl d, bool ghiDe)
        {
            var kq = new KeHoach();
            int cNgay = cot[Truong.Ngay], cMa = cot[Truong.MaLogger], cDiem = cot[Truong.TenDiem], cGio = cot[Truong.Gio];
            int cMuc = cot[Truong.MucOn], cTrai = cot[Truong.DoTrai], cTan = cot[Truong.TanSo];
            if (cNgay < 0) { kq.ThongBao.Add("Chưa chọn cột Ngày."); return kq; }
            if (cMuc < 0) { kq.ThongBao.Add("Chưa chọn cột Mức ồn."); return kq; }
            if (cMa < 0 && cDiem < 0) { kq.ThongBao.Add("Chọn cột Mã logger hoặc cột Tên điểm để biết số đo của điểm nào."); return kq; }
            int dau = cot.DongTieuDe + 1;
            bool ngayTruoc = NgayDungTruoc(b, cNgay, dau);
            var diemTheoTen = new Dictionary<string, DiemNl>();
            foreach (DiemNl p in d.Diem)
            {
                string k = VanBan.BoDau(p.Ten);
                if (k.Length > 0 && !diemTheoTen.ContainsKey(k)) diemTheoTen[k] = p;
            }
            var nhom = new Dictionary<Tuple<int, DateTime>, List<LanGhi>>();
            var maLa = new SortedSet<string>();
            var chuaLap = new Dictionary<string, List<DateTime>>();
            var diemLa = new SortedSet<string>();
            int loiNgay = 0, loiSo = 0;
            for (int r = dau; r < b.Dong.Count; r++)
            {
                object oNgay = b.O(r, cNgay);
                string sMa = cMa >= 0 ? b.Chu(r, cMa) : "", sDiem = cDiem >= 0 ? b.Chu(r, cDiem) : "";
                if (oNgay == null && b.O(r, cMuc) == null) continue;   // dòng trống / dòng cộng
                kq.SoDongDoc++;
                DateTime tg;
                bool coGio;
                if (oNgay is double && LaSoNgayExcel((double)oNgay))
                {
                    tg = DateTime.FromOADate((double)oNgay);
                    coGio = tg.TimeOfDay.TotalMinutes >= 1;
                }
                else if (!DocNgay(b.Chu(r, cNgay), ngayTruoc, out tg, out coGio)) { loiNgay++; kq.SoDongBo++; continue; }
                if (cGio >= 0)
                {
                    double? h = DocGio(b.O(r, cGio));
                    if (h.HasValue) { tg = tg.Date.AddHours(h.Value); coGio = true; }
                }
                double? muc = GiaTriSo(b.O(r, cMuc));
                if (!muc.HasValue) { loiSo++; kq.SoDongBo++; continue; }
                DateTime dem = DemCua(tg, coGio);

                DiemNl diem = null;
                ThietBiNl tb = sMa.Length > 0 ? d.TimThietBiTheoMa(sMa) : null;
                if (sDiem.Length > 0) diemTheoTen.TryGetValue(VanBan.BoDau(sDiem), out diem);
                if (diem == null && tb != null)
                {
                    LapDatNl lap = d.LapDatCuaThietBiNgay(tb.Id, dem);
                    if (lap != null) diem = d.TimDiem(lap.DiemId);
                    if (diem == null && sDiem.Length == 0)
                    {
                        List<DateTime> l;
                        if (!chuaLap.TryGetValue(tb.Ma, out l)) { l = new List<DateTime>(); chuaLap[tb.Ma] = l; }
                        l.Add(dem);
                    }
                }
                if (diem == null)
                {
                    if (sDiem.Length > 0) diemLa.Add(sDiem);
                    else if (tb == null && sMa.Length > 0) maLa.Add(sMa);
                    kq.SoDongBo++;
                    continue;
                }
                var key = Tuple.Create(diem.Id, dem);
                List<LanGhi> g;
                if (!nhom.TryGetValue(key, out g)) { g = new List<LanGhi>(); nhom[key] = g; }
                g.Add(new LanGhi
                {
                    Dem = dem, MucOn = muc, DoTrai = cTrai >= 0 ? GiaTriSo(b.O(r, cTrai)) : null, TanSo = cTan >= 0 ? GiaTriSo(b.O(r, cTan)) : null,
                    ThietBiId = tb != null ? tb.Id : -1
                });
            }
            foreach (var p in nhom.OrderBy(x => x.Key.Item2).ThenBy(x => x.Key.Item1))
            {
                SoDoNl s = GopDem(p.Key.Item1, p.Key.Item2, p.Value, cTrai >= 0);
                if (s.ThietBiId < 0)
                {
                    LapDatNl lap = d.LapDatTai(s.DiemId, s.Ngay);
                    if (lap != null) s.ThietBiId = lap.ThietBiId;
                }
                SoDoNl cu = d.TimSoDo(s.DiemId, s.Ngay);
                if (cu != null && !ghiDe) { kq.SoGiuNguyen++; continue; }
                if (cu == null) kq.SoMoi++;
                else kq.SoThay++;
                kq.SoDo.Add(s);
                if (!kq.Tu.HasValue || s.Ngay < kq.Tu) kq.Tu = s.Ngay;
                if (!kq.Den.HasValue || s.Ngay > kq.Den) kq.Den = s.Ngay;
            }
            if (loiNgay > 0) kq.ThongBao.Add(loiNgay + " dòng không đọc được ngày ở cột " + XlsxReader.TenCot(cNgay + 1) + " — bỏ qua.");
            if (loiSo > 0) kq.ThongBao.Add(loiSo + " dòng không có mức ồn (ô trống / không phải số) — bỏ qua.");
            if (maLa.Count > 0)
                kq.ThongBao.Add("Mã logger chưa có trong danh mục (thêm ở mục Thiết bị rồi nhập lại): " + string.Join(", ", maLa.Take(20)) + (maLa.Count > 20 ? "…" : ""));
            foreach (var p in chuaLap.OrderBy(x => x.Key))
                kq.ThongBao.Add("Logger " + p.Key + " chưa ghi lắp ở điểm nào vào " + p.Value.Distinct().Count() + " đêm (" + So.Ngay(p.Value.Min()) +
                                (p.Value.Max() > p.Value.Min() ? " – " + So.Ngay(p.Value.Max()) : "") + ") — bấm \"Lắp / thu logger…\" ghi ngày lắp rồi nhập lại.");
            if (diemLa.Count > 0)
                kq.ThongBao.Add("Tên điểm không có trong danh mục: " + string.Join(", ", diemLa.Take(15)) + (diemLa.Count > 15 ? "…" : ""));
            if (kq.SoGiuNguyen > 0) kq.ThongBao.Add(kq.SoGiuNguyen + " đêm đã có số đo, giữ nguyên (không chọn ghi đè).");
            return kq;
        }

        static double? GiaTriSo(object o)
        {
            if (o == null) return null;
            if (o is double) return (double)o;
            return DocSo(Convert.ToString(o));
        }

        static double PhanVi(List<double> sorted, double p)
        {
            if (sorted.Count == 1) return sorted[0];
            double x = p * (sorted.Count - 1);
            int i = (int)Math.Floor(x);
            if (i >= sorted.Count - 1) return sorted[sorted.Count - 1];
            return sorted[i] + (sorted[i + 1] - sorted[i]) * (x - i);
        }

        static SoDoNl GopDem(int diemId, DateTime dem, List<LanGhi> g, bool coCotTrai)
        {
            var s = new SoDoNl { DiemId = diemId, Ngay = dem };
            LanGhi min = g.OrderBy(x => x.MucOn.Value).First();
            s.MucOn = Math.Round(min.MucOn.Value, 2);
            s.ThietBiId = min.ThietBiId;
            if (g.Count == 1)
            {
                s.DoTrai = min.DoTrai;
                s.TanSo = min.TanSo;
                return s;
            }
            if (coCotTrai && g.Any(x => x.DoTrai.HasValue)) s.DoTrai = min.DoTrai ?? PhanTichNl.TrungVi(g.Where(x => x.DoTrai.HasValue).Select(x => x.DoTrai.Value));
            else
            {
                var v = g.Select(x => x.MucOn.Value).OrderBy(x => x).ToList();
                s.DoTrai = Math.Round(PhanVi(v, 0.9) - PhanVi(v, 0.1), 2);
            }
            s.TanSo = min.TanSo ?? PhanTichNl.TrungVi(g.Where(x => x.TanSo.HasValue).Select(x => x.TanSo.Value));
            return s;
        }

        public static void ApDung(KeHoach k, DuLieuNl d)
        {
            foreach (SoDoNl s in k.SoDo) d.DatSoDo(s);
        }
    }
}
