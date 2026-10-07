using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace ThatThoatNuoc
{
    /// <summary>Trang Excel nhận ra là báo cáo tháng.</summary>
    public class TrangThang
    {
        public TrangXls Trang;
        public int Nam, Thang;
        public int SoThu { get { return Nam * 12 + Thang - 1; } }
        public override string ToString() { return Trang.Ten + "  (tháng " + Thang + "/" + Nam + ")"; }
    }

    public class KetQuaNhap
    {
        public List<ThangBaoCao> Thang = new List<ThangBaoCao>();
        public List<string> ThongBao = new List<string>();
        public List<string> SaiLech = new List<string>();
        public int SoDongKhop;
    }

    /// <summary>
    /// Nhập các trang "Tháng N-YYYY" của file Excel báo cáo thất thoát: dựng cấu trúc từ chính
    /// công thức trong file (TLK, dòng cộng trừ, chuẩn thu, kế hoạch, cùng kỳ), nối dòng giữa các
    /// tháng theo công thức lũy kế, rồi tính lại và so với số Excel đã lưu.
    /// </summary>
    public static class NhapExcel
    {
        const int CA = 1, CB = 2, CC = 3, CD = 4, CE = 5, CF = 6, CG = 7, CH = 8, CI = 9, CJ = 10, CK = 11, CL = 12, CM = 13, CN = 14;

        public static string ChuanHoa(string s)
        {
            if (s == null) return "";
            s = s.Normalize(NormalizationForm.FormC);
            return Regex.Replace(s, @"\s+", " ").Trim();
        }

        static string Thuong(string s)
        {
            return ChuanHoa(s).ToLower(CultureInfo.GetCultureInfo("vi-VN")).Trim(' ', ':', '.', ',');
        }

        public static List<TrangThang> TimTrangThang(List<TrangXls> book)
        {
            var list = new List<TrangThang>();
            foreach (TrangXls t in book)
            {
                string ten = ChuanHoa(t.Ten);
                if (ten.Contains("+")) continue;
                int nam = 0, thang = 0;
                Match m = Regex.Match(ten, @"^Th[aá]ng\s*(\d{1,2})\s*[-/.]\s*(\d{4})$", RegexOptions.IgnoreCase);
                if (m.Success)
                {
                    thang = int.Parse(m.Groups[1].Value);
                    nam = int.Parse(m.Groups[2].Value);
                }
                bool title = false;
                for (int r = 1; r <= 8; r++)
                {
                    string s = ChuanHoa(t.Chu(r, CA)).ToUpper(CultureInfo.GetCultureInfo("vi-VN"));
                    Match mt = Regex.Match(s, @"THẤT THOÁT NƯỚC\s+THÁNG\s*(\d{1,2})\s*(?:NĂM|/|-)\s*(\d{4})");
                    if (mt.Success)
                    {
                        thang = int.Parse(mt.Groups[1].Value);
                        nam = int.Parse(mt.Groups[2].Value);
                        title = true;
                        break;
                    }
                    if (s.Contains("QUÝ")) { nam = 0; break; }
                }
                if (nam < 2000 || thang < 1 || thang > 12) continue;
                if (!title && !m.Success) continue;
                if (TimDongTieuDe(t) < 0) continue;
                list.Add(new TrangThang { Trang = t, Nam = nam, Thang = thang });
            }
            return list.OrderBy(x => x.SoThu).ToList();
        }

        static int TimDongTieuDe(TrangXls t)
        {
            for (int r = 1; r <= 25; r++)
            {
                if (Thuong(t.Chu(r, CA)) == "stt" && Thuong(t.Chu(r, CE)).Contains("phát ra")) return r;
            }
            return -1;
        }

        // ------------------------------------------------------------------ biểu thức tuyến tính

        /// <summary>Công thức Excel dạng tổng tuyến tính: Σ hệ số × ô + hằng số.</summary>
        class Lin
        {
            public Dictionary<string, double> HeSo = new Dictionary<string, double>();
            public double HangSo;
            public bool LamTron;

            public static Lin So(double v) { return new Lin { HangSo = v }; }
            public bool LaHang { get { return HeSo.Count == 0; } }

            public Lin Nhan(double k)
            {
                var r = new Lin { HangSo = HangSo * k, LamTron = LamTron };
                foreach (var p in HeSo) r.HeSo[p.Key] = p.Value * k;
                return r;
            }

            public Lin Cong(Lin b, double k)
            {
                var r = new Lin { HangSo = HangSo + b.HangSo * k, LamTron = LamTron || b.LamTron };
                foreach (var p in HeSo) r.HeSo[p.Key] = p.Value;
                foreach (var p in b.HeSo)
                {
                    double v;
                    r.HeSo.TryGetValue(p.Key, out v);
                    r.HeSo[p.Key] = v + p.Value * k;
                }
                return r;
            }
        }

        static string KhoaO(string trang, int row, int col) { return (trang ?? "") + "|" + row + "|" + col; }

        static void TachKhoa(string key, out string trang, out int row, out int col)
        {
            string[] p = key.Split('|');
            trang = p[0].Length > 0 ? p[0] : null;
            row = int.Parse(p[1]);
            col = int.Parse(p[2]);
        }

        static readonly Regex TokRef = new Regex(
            @"\G(?<sheet>'(?:[^']|'')+'!|[^\W\d][\w\.]*!)?\$?(?<c1>[A-Z]{1,3})\$?(?<r1>\d+)(?::\$?(?<c2>[A-Z]{1,3})\$?(?<r2>\d+))?(?![\w(])",
            RegexOptions.Compiled);

        class BoDoc
        {
            readonly string s;
            int i;

            public BoDoc(string s) { this.s = s; }

            void Trang() { while (i < s.Length && s[i] == ' ') i++; }

            public Lin Doc()
            {
                Lin r = Tong();
                Trang();
                if (r == null || i != s.Length) return null;
                return r;
            }

            Lin Tong()
            {
                Lin a = Tich();
                while (a != null)
                {
                    Trang();
                    if (i < s.Length && (s[i] == '+' || s[i] == '-'))
                    {
                        double k = s[i] == '-' ? -1 : 1;
                        i++;
                        Lin b = Tich();
                        if (b == null) return null;
                        a = a.Cong(b, k);
                    }
                    else break;
                }
                return a;
            }

            Lin Tich()
            {
                Lin a = Nhan();
                while (a != null)
                {
                    Trang();
                    if (i < s.Length && (s[i] == '*' || s[i] == '/'))
                    {
                        char op = s[i++];
                        Lin b = Nhan();
                        if (b == null) return null;
                        if (op == '*')
                        {
                            if (b.LaHang) a = a.Nhan(b.HangSo);
                            else if (a.LaHang) a = b.Nhan(a.HangSo);
                            else return null;
                        }
                        else
                        {
                            if (!b.LaHang || b.HangSo == 0) return null;
                            a = a.Nhan(1 / b.HangSo);
                        }
                    }
                    else break;
                }
                return a;
            }

            Lin Nhan()
            {
                Trang();
                if (i >= s.Length) return null;
                char c = s[i];
                if (c == '+' || c == '-')
                {
                    i++;
                    Lin x = Nhan();
                    return x == null ? null : (c == '-' ? x.Nhan(-1) : x);
                }
                if (c == '(')
                {
                    i++;
                    Lin x = Tong();
                    Trang();
                    if (x == null || i >= s.Length || s[i] != ')') return null;
                    i++;
                    return x;
                }
                if (char.IsDigit(c) || c == '.')
                {
                    Match m = Regex.Match(s.Substring(i), @"^\d*\.?\d+(?:[eE][+-]?\d+)?");
                    if (!m.Success) return null;
                    i += m.Length;
                    return Lin.So(double.Parse(m.Value, CultureInfo.InvariantCulture));
                }
                Match f = Regex.Match(s.Substring(i), @"^(ROUND|SUM)\(", RegexOptions.IgnoreCase);
                if (f.Success)
                {
                    string fn = f.Groups[1].Value.ToUpperInvariant();
                    i += f.Length;
                    var args = new List<Lin>();
                    while (true)
                    {
                        Lin a = Tong();
                        if (a == null) return null;
                        args.Add(a);
                        Trang();
                        if (i < s.Length && s[i] == ',') { i++; continue; }
                        if (i < s.Length && s[i] == ')') { i++; break; }
                        return null;
                    }
                    if (fn == "ROUND")
                    {
                        if (args.Count != 2 || !args[1].LaHang || args[1].HangSo != 0) return null;
                        Lin x = args[0];
                        x.LamTron = true;
                        return x;
                    }
                    Lin sum = Lin.So(0);
                    foreach (Lin a in args) sum = sum.Cong(a, 1);
                    return sum;
                }
                Match rm = TokRef.Match(s, i);
                if (rm.Success && rm.Index == i)
                {
                    i += rm.Length;
                    string sheet = rm.Groups["sheet"].Value;
                    if (sheet.Length > 0)
                    {
                        sheet = sheet.Substring(0, sheet.Length - 1);
                        if (sheet.StartsWith("'")) sheet = sheet.Substring(1, sheet.Length - 2).Replace("''", "'");
                    }
                    int c1 = Cot(rm.Groups["c1"].Value), r1 = int.Parse(rm.Groups["r1"].Value);
                    var lin = new Lin();
                    if (rm.Groups["c2"].Success)
                    {
                        int c2 = Cot(rm.Groups["c2"].Value), r2 = int.Parse(rm.Groups["r2"].Value);
                        for (int rr = Math.Min(r1, r2); rr <= Math.Max(r1, r2); rr++)
                            for (int cc = Math.Min(c1, c2); cc <= Math.Max(c1, c2); cc++)
                                lin.HeSo[KhoaO(sheet.Length > 0 ? sheet : null, rr, cc)] = 1;
                    }
                    else lin.HeSo[KhoaO(sheet.Length > 0 ? sheet : null, r1, c1)] = 1;
                    return lin;
                }
                return null;
            }

            static int Cot(string letters)
            {
                int col = 0;
                foreach (char ch in letters) col = col * 26 + (ch - 'A' + 1);
                return col;
            }
        }

        static Lin TuyenTinh(string formula)
        {
            if (string.IsNullOrEmpty(formula)) return null;
            return new BoDoc(formula.Trim()).Doc();
        }

        // ------------------------------------------------------------------ đọc 1 trang

        class Dong
        {
            public int Row;
            public Muc Muc;
            public string Nhom = "";
            public Lin FormE, FormF;
            public string LienKetTrang;     // trang tháng trước theo công thức lũy kế
            public int LienKetDong;
            public double? E, F, G, H, K, L, M;
            public bool LaDonVi;
        }

        class TrangDoc
        {
            public TrangThang Nguon;
            public ThangBaoCao Thang = new ThangBaoCao();
            public List<Dong> Dong = new List<Dong>();
            public Dictionary<int, Dong> TheoDong = new Dictionary<int, Dong>();
            public Dictionary<int, KeyValuePair<int?, double>> KeHoach = new Dictionary<int, KeyValuePair<int?, double>>();   // dòng → (năm, %)
            public List<LienKetKH> LienKetKeHoach = new List<LienKetKH>();
            public Dictionary<string, TrangKeHoach> CacTrangKeHoach;
            public string Cty1, Cty2, DiaDanh;

            public TrangKeHoach TimKeHoach(string tenTrang)
            {
                TrangKeHoach kh;
                return CacTrangKeHoach != null && CacTrangKeHoach.TryGetValue(ChuanHoa(tenTrang), out kh) ? kh : null;
            }
        }

        public static int TinhCap(string stt)
        {
            if (stt.Length == 0) return 1;
            if (Regex.IsMatch(stt, "^[A-Z]$")) return 0;
            if (Regex.IsMatch(stt, "^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV)$")) return 0;
            return stt.Split('.').Length;
        }

        static string TenNganTuDong(Muc m)
        {
            string ten = m.TenMotDong;
            Match d = Regex.Match(ten, @"ĐỘI CẤP NƯỚC SỐ\s*(\d+)", RegexOptions.IgnoreCase);
            if (m.VaiTro == VaiTro.Doi && d.Success) return "Đội Cấp nước số " + d.Groups[1].Value;
            if (m.VaiTro == VaiTro.KhuVuc)
            {
                Match k = Regex.Match(ten, @"^Khu\s+vực\s+(.+)$", RegexOptions.IgnoreCase);
                if (k.Success)
                {
                    string rest = k.Groups[1].Value;
                    int cut = rest.Length;
                    foreach (string stop in new[] { " TLK", " (", " - " })
                    {
                        int p = rest.IndexOf(stop, StringComparison.OrdinalIgnoreCase);
                        if (p > 0 && p < cut) cut = p;
                    }
                    rest = rest.Substring(0, cut).Trim().TrimEnd(':');
                    if (rest.StartsWith("Trạm ", StringComparison.OrdinalIgnoreCase)) rest = rest.Substring(5);
                    return "KV. " + rest;
                }
            }
            return "";
        }

        static TrangDoc DocTrang(TrangThang nguon, Dictionary<string, TrangKeHoach> keHoach)
        {
            TrangXls x = nguon.Trang;
            var td = new TrangDoc { Nguon = nguon, CacTrangKeHoach = keHoach };
            td.Thang.Nam = nguon.Nam;
            td.Thang.Thang = nguon.Thang;
            td.Thang.KyHoaDon = ThangBaoCao.KyMacDinh(nguon.Nam, nguon.Thang);
            int h = TimDongTieuDe(x);
            int start = h + 1;
            if (x.Chu(start, CA).Trim().Length == 0 && x.Chu(start, CB).Trim().Length == 0) start++;

            // Thông tin đầu trang.
            td.Cty1 = ChuanHoa(x.Chu(1, CA));
            td.Cty2 = ChuanHoa(x.Chu(2, CA));
            for (int r = 1; r < h; r++)
            {
                string s = ChuanHoa(x.Chu(r, CA));
                Match ky = Regex.Match(s, @"KỲ\s*(\d{1,2}\s*/\s*\d{4})", RegexOptions.IgnoreCase);
                if (ky.Success) td.Thang.KyHoaDon = ky.Groups[1].Value.Replace(" ", "");
                Match tt = Regex.Match(s, @"từ\s+ngày\s+(\d+)\s+tháng\s+(\d+)(?:\s+năm\s+(\d{4}))?.*?đến\s+ngày\s+(\d+)\s+tháng\s+(\d+)\s+năm\s+(\d{4})", RegexOptions.IgnoreCase);
                if (tt.Success)
                {
                    td.Thang.DenNgay = TaoNgay(tt, 4);
                    if (tt.Groups[3].Success) td.Thang.TuNgay = TaoNgay(tt, 1);
                    else if (td.Thang.DenNgay.HasValue)
                    {
                        // "từ ngày 17 tháng 11 đến ngày 17 tháng 12 năm 2025": năm đầu = năm cuối (lùi 1 năm nếu qua năm mới)
                        int nam = td.Thang.DenNgay.Value.Year, thang = int.Parse(tt.Groups[2].Value);
                        if (thang > td.Thang.DenNgay.Value.Month) nam--;
                        try { td.Thang.TuNgay = new DateTime(nam, thang, int.Parse(tt.Groups[1].Value)); }
                        catch (ArgumentException) { }
                    }
                }
            }

            // Các dòng số liệu.
            int end = start;
            int trong = 0;
            string nhom = "";
            for (int r = start; r <= x.SoDong; r++)
            {
                string a = ChuanHoa(x.Chu(r, CA)), b = ChuanHoa(x.Chu(r, CB));
                string au = a.ToUpper(CultureInfo.GetCultureInfo("vi-VN"));
                if (au.StartsWith("*") || au.Contains("GHI CHÚ") || au.Contains("GIÁM ĐỐC") || au.Contains("KT.")) break;
                bool coSo = x.Lay(r, CE) != null && !x.Lay(r, CE).IsEmpty;
                if (a.Length == 0 && b.Length == 0)
                {
                    if (!coSo && ++trong > 5) break;
                    continue;
                }
                trong = 0;
                end = r;
                var d = new Dong { Row = r };
                var m = new Muc { Stt = a, Ten = (x.Chu(r, CB) ?? "").Trim().Normalize(NormalizationForm.FormC), Cap = TinhCap(a) };
                if (m.Cap == 0) nhom = a;
                d.Nhom = nhom;
                d.Muc = m;
                d.E = x.So(r, CE);
                d.F = x.So(r, CF);
                d.G = x.So(r, CG);
                d.H = x.So(r, CH);
                d.K = x.So(r, CK);
                d.L = x.So(r, CL);
                d.M = x.So(r, CM);
                td.Dong.Add(d);
                td.TheoDong[r] = d;
            }

            foreach (Dong d in td.Dong) PhanLoai(x, d, td);

            // Ghi chú, ngày lập, người ký phía dưới bảng.
            for (int r = end + 1; r <= x.SoDong; r++)
            {
                string a = x.Chu(r, CA);
                string an = ChuanHoa(a);
                if (an.StartsWith("*") && td.Thang.GhiChu.Length == 0)
                {
                    string g = a.Trim();
                    int colon = g.IndexOf(':');
                    g = colon >= 0 && colon < 20 ? g.Substring(colon + 1) : g.TrimStart('*');
                    td.Thang.GhiChu = string.Join("\n", g.Replace("\r", "").Split('\n').Select(l => l.TrimEnd())).Trim('\n', ' ');
                }
                for (int c = 1; c <= 20; c++)
                {
                    string s = ChuanHoa(x.Chu(r, c));
                    if (s.Length > 80) continue;
                    Match nm = Regex.Match(s, @"^(.{0,40}?),?\s*ngày\s+(\d+)\s+tháng\s+(\d+)\s+năm\s+(\d{4})", RegexOptions.IgnoreCase);
                    if (nm.Success && !td.Thang.NgayLap.HasValue)
                    {
                        try { td.Thang.NgayLap = new DateTime(int.Parse(nm.Groups[4].Value), int.Parse(nm.Groups[3].Value), int.Parse(nm.Groups[2].Value)); }
                        catch (ArgumentException) { }
                        string dd = nm.Groups[1].Value.Trim().TrimEnd(',');
                        if (dd.Length > 0) td.DiaDanh = dd;
                    }
                }
                if (Enumerable.Range(1, 20).Any(c => ChuanHoa(x.Chu(r, c)).ToUpper(CultureInfo.GetCultureInfo("vi-VN")).Contains("LẬP BIỂU")))
                    DocNguoiKy(x, r, td.Thang);
            }
            return td;
        }

        static DateTime? TaoNgay(Match m, int g)
        {
            try
            {
                return new DateTime(int.Parse(m.Groups[g + 2].Value), int.Parse(m.Groups[g + 1].Value), int.Parse(m.Groups[g].Value));
            }
            catch (ArgumentException)
            {
                return null;
            }
        }

        static void DocNguoiKy(TrangXls x, int r, ThangBaoCao t)
        {
            var cols = Enumerable.Range(1, 20).Where(c => ChuanHoa(x.Chu(r, c)).Length > 0).ToList();
            if (cols.Count == 0) return;
            int[] slot = cols.Count >= 3 ? new[] { cols[0], cols[1], cols[cols.Count - 1] }
                       : cols.Count == 2 ? new[] { cols[0], -1, cols[1] } : new[] { -1, -1, cols[0] };
            int tenRow = -1;
            for (int rr = r + 2; rr <= Math.Min(x.SoDong, r + 10); rr++)
            {
                if (slot.Any(c => c > 0 && ChuanHoa(x.Chu(rr, c)).Length > 0)) { tenRow = rr; break; }
            }
            for (int i = 0; i < 3; i++)
            {
                if (slot[i] < 0) { t.Ky[i] = new NguoiKy(); continue; }
                string d2 = ChuanHoa(x.Chu(r + 1, slot[i]));
                t.Ky[i] = new NguoiKy(ChuanHoa(x.Chu(r, slot[i])), d2, tenRow > 0 ? ChuanHoa(x.Chu(tenRow, slot[i])) : "");
            }
        }

        static double GiaTri(TrangXls x, string key)
        {
            string trang;
            int row, col;
            TachKhoa(key, out trang, out row, out col);
            return trang == null ? (x.So(row, col) ?? 0) : 0;
        }

        static void PhanLoai(TrangXls x, Dong d, TrangDoc td)
        {
            Muc m = d.Muc;
            int r = d.Row;
            OXls cC = x.Lay(r, CC), cD = x.Lay(r, CD);
            double? vC = cC != null ? cC.Number : null, vD = cD != null ? cD.Number : null;
            string fE = x.CongThuc(r, CE);
            Lin lin = TuyenTinh(fE);
            string keyC = KhoaO(null, r, CC), keyD = KhoaO(null, r, CD);
            string ghiChuF = null;

            if (fE != null && lin != null && (lin.HeSo.ContainsKey(keyD) || lin.HeSo.ContainsKey(keyC)))
            {
                // TLK: E = k × (D − C) + phần khác
                m.Loai = LoaiMuc.DongHo;
                m.ChiSoCu = vC;
                m.ChiSoMoi = vD;
                m.LamTron = lin.LamTron;
                double k = 0;
                lin.HeSo.TryGetValue(keyD, out k);
                if (Math.Abs(k) > 1e-12 && Math.Abs(k - 1) > 1e-9) m.SaiSo = Math.Round(100 / k - 100, 6);
                double them = lin.HangSo;
                foreach (var p in lin.HeSo)
                    if (p.Key != keyC && p.Key != keyD) them += p.Value * GiaTri(x, p.Key);
                m.DieuChinh = Math.Round(them, 6);
                if (vC.HasValue && vD.HasValue && d.E.HasValue)
                {
                    double tinh = (vD.Value - vC.Value) * (m.SaiSo != 0 ? 100 / (100 + m.SaiSo) : 1) + m.DieuChinh;
                    if (m.LamTron) tinh = BoTinh.LamTron(tinh);
                    if (Math.Abs(tinh - d.E.Value) > 0.005) m.SanLuong = d.E;
                }
                else if (d.E.HasValue) m.SanLuong = d.E;   // thiếu 1 chỉ số (Excel coi ô trống = 0)
            }
            else if (fE != null && lin != null && lin.HeSo.Count > 0 && lin.HeSo.Keys.All(key => key.StartsWith("|")))
            {
                // Dòng công thức: cộng trừ cột E các dòng khác (+ hằng số nếu có).
                m.Loai = LoaiMuc.CongThuc;
                d.FormE = lin;
                m.LamTron = lin.LamTron;
                m.MoTa = cC != null && cC.Text != null ? ChuanHoa(cC.Text) : "";
            }
            else if (d.E.HasValue)
            {
                if (vC.HasValue && vD.HasValue)
                {
                    m.Loai = LoaiMuc.DongHo;
                    m.ChiSoCu = vC;
                    m.ChiSoMoi = vD;
                    double lech = d.E.Value - (vD.Value - vC.Value);
                    if (Math.Abs(lech) > 1e-9) m.DieuChinh = Math.Round(lech, 6);
                }
                else if (vD.HasValue && fE == null)
                {
                    m.Loai = LoaiMuc.DongHo;
                    m.ChiSoMoi = vD;
                    m.ChiSoCu = vC;
                    m.SanLuong = d.E;
                }
                else
                {
                    m.Loai = LoaiMuc.NhapTay;
                    m.SanLuong = d.E;
                }
            }
            else if (vC.HasValue && vD.HasValue)
            {
                m.Loai = LoaiMuc.DongHo;
                m.ChiSoCu = vC;
                m.ChiSoMoi = vD;
                if (Math.Abs(vD.Value - vC.Value) > 1e-9) m.SanLuong = 0;   // Excel để trống ô sản lượng (= 0)
            }
            else
            {
                m.Loai = LoaiMuc.NhapTay;
            }

            // Chuẩn thu + các cột so sánh chỉ có ở dòng tính thất thoát (cột G có số).
            OXls cG = x.Lay(r, CG);
            d.LaDonVi = cG != null && (cG.Formula != null || cG.Number.HasValue);
            OXls cF = x.Lay(r, CF);
            if (d.LaDonVi)
            {
                Lin lf = cF != null ? TuyenTinh(cF.Formula) : null;
                if (lf != null && lf.HeSo.Count > 0 && lf.HeSo.Keys.All(key => key.StartsWith("|")))
                {
                    m.ChuanThuLoai = LoaiChuanThu.CongThuc;
                    d.FormF = lf;
                }
                else
                {
                    m.ChuanThuLoai = LoaiChuanThu.Nhap;
                    m.ChuanThu = d.F;
                }
                m.VaiTro = m.Cap == 0
                    ? (Thuong(m.Ten).Contains("toàn công ty") ? VaiTro.ToanCongTy : VaiTro.Doi)
                    : VaiTro.KhuVuc;
                m.TenNgan = TenNganTuDong(m);
                foreach (int col in new[] { CH, CI, CJ, CN }) PhanTichSoSanh(x, d, col, td);
                if (d.L.HasValue) m.LuyKeChuanThuTruoc = Math.Round(d.L.Value - (d.F ?? 0), 6);
            }
            else if (cF != null && !string.IsNullOrWhiteSpace(cF.Text) && !cF.Number.HasValue)
            {
                ghiChuF = cF.Text.Trim();
            }
            if (ghiChuF != null && ghiChuF.Length > 0)
            {
                m.GhiChu = ghiChuF;
                if ((ghiChuF.EndsWith(" là") || ghiChuF.EndsWith(":")) && m.DieuChinh != 0)
                    m.GhiChu = ghiChuF + " " + So.M3(m.DieuChinh) + " m³";
            }

            if (d.K.HasValue) m.LuyKePhatRaTruoc = Math.Round(d.K.Value - (d.E ?? 0), 6);
            string fK = x.CongThuc(r, CK);
            foreach (ThamChieu tc in XlsxReader.CacThamChieu(fK))
            {
                if (tc.Trang != null && tc.Cot == CK)
                {
                    d.LienKetTrang = ChuanHoa(tc.Trang);
                    d.LienKetDong = tc.Dong;
                }
            }
        }

        /// <summary>Cột H/I/J/N dạng "=G20 - X": X là kế hoạch, tháng trước hoặc số cùng kỳ năm trước.</summary>
        static void PhanTichSoSanh(TrangXls x, Dong d, int col, TrangDoc td)
        {
            string f = x.CongThuc(d.Row, col);
            double? v = x.So(d.Row, col);
            if (f == null || !v.HasValue) return;
            var refs = XlsxReader.CacThamChieu(f);
            if (refs.Count == 0) return;
            ThamChieu goc = refs[0];
            if (goc.Trang != null || goc.Dong != d.Row || (goc.Cot != CG && goc.Cot != CM)) return;
            double? vGoc = goc.Cot == CG ? d.G : d.M;
            if (!vGoc.HasValue) return;
            double x2 = Math.Round(vGoc.Value - v.Value, 6);
            if (refs.Count == 1)
            {
                if (goc.Cot == CG) d.Muc.CungKyThang = Math.Round(x2, 4);
                else d.Muc.CungKyLuyKe = Math.Round(x2, 4);
                return;
            }
            ThamChieu khac = refs[1];
            if (khac.Trang == null) return;
            TrangKeHoach kh = td.TimKeHoach(khac.Trang);
            if (kh != null)
            {
                // Trang kế hoạch: cột "tỷ lệ thất thoát" là kế hoạch; cột khác (vd "thất thoát tháng 12 năm trước") là tháng trước.
                if (kh.Cot.ContainsKey(LoaiChiTieu.TyLe) && kh.Cot[LoaiChiTieu.TyLe] == khac.Cot)
                {
                    if (Math.Abs(x2) > 1e-9) td.KeHoach[d.Row] = new KeyValuePair<int?, double>(kh.NamTieuDe, Math.Round(x2, 4));
                    td.LienKetKeHoach.Add(new LienKetKH { Trang = kh, Dong = khac.Dong, Muc = d.Muc, Nam = td.Thang.Nam });
                }
                else if (goc.Cot == CG) d.Muc.TyLeThangTruoc = x2;
                return;
            }
            string trang = BoDau(khac.Trang).ToUpperInvariant().Replace(" ", "");
            if (trang.Contains("KEHOACH") && khac.Cot == CC)
            {
                if (Math.Abs(x2) > 1e-9) td.KeHoach[d.Row] = new KeyValuePair<int?, double>(null, Math.Round(x2, 4));   // ô kế hoạch trống (= 0) thì bỏ qua
            }
            else if (goc.Cot == CG) d.Muc.TyLeThangTruoc = x2;
        }

        // ------------------------------------------------------------------ trang kế hoạch năm

        /// <summary>Trang "KẾ HOẠCH NĂM" / "KẾ HOẠCH GIAO CHỈ TIÊU NĂM": dòng tiêu đề + cột của từng chỉ tiêu.</summary>
        public class TrangKeHoach
        {
            public TrangXls Trang;
            public int DongTieuDe, CotTen;
            public readonly Dictionary<LoaiChiTieu, int> Cot = new Dictionary<LoaiChiTieu, int>();
            public int? NamTieuDe;      // năm ghi trên tiêu đề trang (nếu có)
            public int? NamDoan;        // năm suy ra để hiển thị khi chọn nhập

            public override string ToString()
            {
                var ten = new List<string>();
                foreach (LoaiChiTieu l in Cot.Keys) ten.Add(TenChiTieu(l).ToLower());
                return Trang.Ten + "  (kế hoạch" + (NamDoan.HasValue ? " năm " + NamDoan : "") + ": " + string.Join(", ", ten) + ")";
            }
        }

        class LienKetKH
        {
            public TrangKeHoach Trang;
            public int Dong, Nam;
            public Muc Muc;
        }

        public static string TenChiTieu(LoaiChiTieu l)
        {
            switch (l)
            {
                case LoaiChiTieu.PhatRa: return "Sản lượng phát ra";
                case LoaiChiTieu.ChuanThu: return "Sản lượng chuẩn thu";
                case LoaiChiTieu.DoanhThu: return "Doanh thu tiền nước";
                case LoaiChiTieu.TyLe: return "Tỷ lệ thất thoát";
                default: return "Tồn hoá đơn";
            }
        }

        /// <summary>Bỏ dấu tiếng Việt, chữ thường: "Khu Vực Ngã Bảy" → "khu vuc nga bay".</summary>
        public static string BoDau(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            string d = ChuanHoa(s).Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(d.Length);
            foreach (char c in d)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
            return sb.ToString().Normalize(NormalizationForm.FormC).Replace('đ', 'd').Replace('Đ', 'D').ToLowerInvariant();
        }

        public static TrangKeHoach DocTrangKeHoach(TrangXls t)
        {
            if (!BoDau(t.Ten).Replace(" ", "").Contains("kehoach")) return null;
            for (int r = 1; r <= Math.Min(25, t.SoDong); r++)
            {
                int cotTen = -1;
                for (int c = 1; c <= 15; c++) if (BoDau(t.Chu(r, c)) == "ten don vi") cotTen = c;
                if (cotTen < 0) continue;
                var kh = new TrangKeHoach { Trang = t, DongTieuDe = r, CotTen = cotTen };
                for (int c = cotTen + 1; c <= 20; c++)
                {
                    string h = BoDau(t.Chu(r, c) + " " + t.Chu(r + 1, c));
                    LoaiChiTieu? l = null;
                    if (h.Contains("thang")) l = null;                       // "thất thoát tháng 12 năm trước": số tham khảo
                    else if (h.Contains("phat ra")) l = LoaiChiTieu.PhatRa;
                    else if (h.Contains("chuan thu")) l = LoaiChiTieu.ChuanThu;
                    else if (h.Contains("doanh thu")) l = LoaiChiTieu.DoanhThu;
                    else if (h.Contains("ton hoa don")) l = LoaiChiTieu.TonHoaDon;
                    else if (h.Contains("that thoat")) l = LoaiChiTieu.TyLe;
                    if (l.HasValue && !kh.Cot.ContainsKey(l.Value)) kh.Cot[l.Value] = c;
                }
                if (kh.Cot.Count == 0) return null;
                for (int rr = 1; rr < r; rr++)
                    for (int c = 1; c <= 15; c++)
                    {
                        Match m = Regex.Match(BoDau(t.Chu(rr, c)), @"(?:ke hoach|chi tieu).*nam\s*(\d{4})");
                        if (m.Success) kh.NamTieuDe = int.Parse(m.Groups[1].Value);
                    }
                return kh;
            }
            return null;
        }

        public static List<TrangKeHoach> TimTrangKeHoach(List<TrangXls> book, List<TrangThang> thang)
        {
            var list = new List<TrangKeHoach>();
            foreach (TrangXls t in book)
            {
                TrangKeHoach kh = DocTrangKeHoach(t);
                if (kh == null) continue;
                kh.NamDoan = kh.NamTieuDe;
                if (!kh.NamDoan.HasValue && thang.Count > 0)
                    kh.NamDoan = thang.GroupBy(x => x.Nam).OrderByDescending(g => g.Count()).ThenByDescending(g => g.Key).First().Key;
                list.Add(kh);
            }
            return list;
        }

        /// <summary>Khoá so tên đơn vị: bỏ dấu, bỏ "+", "KV.", "Khu vực", "TX.", "Trạm", phần trong ngoặc, phần "TLK …".</summary>
        static string KhoaDonVi(string s)
        {
            string k = BoDau(s).Trim(' ', '+', '-', '*', ':', '.');
            k = Regex.Replace(k, @"\(.*?\)", " ");
            k = Regex.Replace(k, @"\s+tlk\b.*$", "");
            foreach (string p in new[] { "kv.", "kv ", "khu vuc ", "tx.", "tx ", "tp.", "tp ", "thi xa ", "thanh pho ", "tram " })
            {
                k = k.Trim();
                if (k.StartsWith(p)) k = k.Substring(p.Length);
            }
            k = Regex.Replace(k, @"[^a-z0-9 ]", " ");
            return Regex.Replace(k, @"\s+", " ").Trim();
        }

        // ------------------------------------------------------------------ vùng DMA trong bảng TỔNG HỢP

        /// <summary>Trang "TỔNG HỢP" năm: cột từng tháng, cột lũy kế; các dòng không nối công thức với trang tháng là vùng DMA.</summary>
        public class TrangTongHop
        {
            public TrangXls Trang;
            public int Nam, DongDau, CotTen, CotLkPr = -1, CotLkCt = -1, ThangLk;
            public readonly Dictionary<int, int> CotThang = new Dictionary<int, int>();   // cột → tháng
            public List<DongDma> Dma = new List<DongDma>();
            public List<string> BoQua = new List<string>();

            public override string ToString()
            {
                return Trang.Ten + "  (vùng DMA năm " + Nam + ": " + Dma.Count + " vùng)";
            }
        }

        public class DongDma
        {
            public int Dong, DongCha;
            public string Ten, TenCha;
            public readonly Dictionary<int, double> TyLe = new Dictionary<int, double>();      // tháng → %
            public readonly Dictionary<int, string> TinhTrang = new Dictionary<int, string>(); // tháng → "TLK đứng kim"…
            public double? LkPhatRa, LkChuanThu;
            public int ThangDau { get { return TyLe.Keys.Concat(TinhTrang.Keys).DefaultIfEmpty(13).Min(); } }
        }

        static bool CoThamChieuTrang(OXls o)
        {
            return o != null && o.Formula != null && o.Formula.Contains("!");
        }

        public static TrangTongHop DocTrangTongHop(TrangXls t)
        {
            if (!BoDau(t.Ten).Replace(" ", "").Contains("tonghop")) return null;
            var th = new TrangTongHop { Trang = t };
            int hr = -1;
            for (int r = 1; r <= Math.Min(15, t.SoDong) && hr < 0; r++)
                for (int c = 1; c <= 5; c++)
                    if (BoDau(t.Chu(r, c)) == "ten don vi") { hr = r; th.CotTen = c; break; }
            if (hr < 0) return null;
            int dongThang = hr;
            for (int rr = hr; rr <= hr + 1; rr++)
            {
                var cot = new Dictionary<int, int>();
                for (int c = th.CotTen + 1; c <= 40; c++)
                {
                    string h = BoDau(t.Chu(rr, c));
                    Match m = Regex.Match(h, @"^thang\s*(\d{1,2})(\D|$)");
                    if (m.Success && !h.Contains("+") && !h.Contains("luy ke")) cot[c] = int.Parse(m.Groups[1].Value);
                }
                if (cot.Count > th.CotThang.Count)
                {
                    th.CotThang.Clear();
                    foreach (var p in cot) th.CotThang[p.Key] = p.Value;
                    dongThang = rr;
                }
            }
            if (th.CotThang.Count == 0) return null;
            for (int c = th.CotTen + 1; c <= 40; c++)
            {
                string h = BoDau(t.Chu(dongThang, c));
                if (h.Contains("ky") || h.Contains("+")) continue;
                if (h.Contains("phat ra") && th.CotLkPr < 0) th.CotLkPr = c;
                else if (h.Contains("chuan thu") && th.CotLkCt < 0) th.CotLkCt = c;
            }
            for (int r = 1; r <= dongThang; r++)
                for (int c = 1; c <= 40; c++)
                {
                    string h = BoDau(t.Chu(r, c));
                    Match lk = Regex.Match(h, @"luy ke den thang\s*(\d{1,2})");
                    if (lk.Success) th.ThangLk = int.Parse(lk.Groups[1].Value);
                    else if (h.StartsWith("luy ke nam") && th.ThangLk == 0) th.ThangLk = 12;
                    Match nm = Regex.Match(h, @"nam\s*(\d{4})");
                    if (nm.Success && th.Nam == 0 && !h.Contains("ke hoach") && !h.Contains("ky ")) th.Nam = int.Parse(nm.Groups[1].Value);
                }
            if (th.Nam == 0) return null;
            th.DongDau = dongThang + 1;

            // Dòng đơn vị: có ô lấy số từ trang tháng ('Tháng 9-2026'!G20). Dòng DMA: dòng có tên nằm dưới đơn vị, gõ số tay.
            int cha = -1;
            for (int r = th.DongDau; r <= t.SoDong; r++)
            {
                string ten = ChuanHoa(t.Chu(r, th.CotTen));
                string bd = BoDau(ten);
                if (ten.Length == 0) continue;
                bool donVi = th.CotThang.Keys.Any(c => CoThamChieuTrang(t.Lay(r, c))) ||
                             (th.CotLkPr > 0 && CoThamChieuTrang(t.Lay(r, th.CotLkPr)));
                if (donVi)
                {
                    cha = r;
                    if (bd.Contains("toan cong ty")) break;
                    continue;
                }
                if (cha < 0 || bd.StartsWith("so ")) continue;
                var d = new DongDma { Dong = r, DongCha = cha, Ten = ten, TenCha = ChuanHoa(t.Chu(cha, th.CotTen)) };
                foreach (var p in th.CotThang)
                {
                    OXls o = t.Lay(r, p.Key);
                    if (o == null || o.IsEmpty) continue;
                    double v;
                    string s = o.Text != null ? o.Text.Trim() : null;
                    if (o.Number.HasValue) d.TyLe[p.Value] = Math.Round(o.Number.Value, 4);
                    else if (s != null && double.TryParse(s.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out v)) d.TyLe[p.Value] = Math.Round(v, 4);
                    else if (s != null && s.Length > 0 && s != "-" && !s.StartsWith("#")) d.TinhTrang[p.Value] = s;
                }
                if (th.CotLkPr > 0) d.LkPhatRa = t.So(r, th.CotLkPr);
                if (th.CotLkCt > 0) d.LkChuanThu = t.So(r, th.CotLkCt);
                bool coSo = d.TyLe.Count + d.TinhTrang.Count > 0 || (d.LkPhatRa.HasValue && d.LkPhatRa > 0);
                if (!coSo) continue;   // dòng mẫu trống "DMA…"
                if (t.DongAn.Contains(r))
                {
                    th.BoQua.Add(ten + " (dòng " + r + " đang ẩn)");
                    continue;
                }
                th.Dma.Add(d);
            }
            if (th.ThangLk == 0) th.ThangLk = th.CotThang.Values.Max();
            return th;
        }

        public static List<TrangTongHop> TimTrangTongHop(List<TrangXls> book)
        {
            return book.Select(DocTrangTongHop).Where(x => x != null && x.Dma.Count > 0).ToList();
        }

        /// <summary>
        /// Đưa vùng DMA của bảng TỔNG HỢP vào các tháng của năm đó: tạo vùng dưới đúng đội / khu vực,
        /// tỷ lệ từng tháng (hoặc tình trạng "TLK đứng kim"), lũy kế phát ra / chuẩn thu ở tháng lũy kế.
        /// </summary>
        static void NhapDmaTuTongHop(TrangTongHop th, DuLieu data, KetQuaNhap kq)
        {
            var thang = data.Thang.Where(t => t.Nam == th.Nam).OrderBy(t => t.Thang).ToList();
            if (thang.Count == 0)
            {
                kq.ThongBao.Add("Vùng DMA (trang " + th.Trang.Ten + "): chưa có số liệu tháng nào của năm " + th.Nam + " — nhập các trang tháng trước.");
                return;
            }
            // Id: vùng cùng tên đã có (kể cả năm khác) thì dùng lại để so cùng kỳ được.
            var ids = new Dictionary<DongDma, int>();
            foreach (DongDma d in th.Dma)
            {
                string key = BoDau(d.Ten);
                Muc cu = data.Thang.OrderBy(t => Math.Abs(t.Nam - th.Nam)).SelectMany(t => t.Muc)
                             .FirstOrDefault(m => m.VaiTro == VaiTro.Dma && BoDau(m.Ten) == key && !ids.ContainsValue(m.Id));
                ids[d] = cu != null ? cu.Id : data.CapId();
            }
            var daDat = new HashSet<DongDma>();
            var soVung = new Dictionary<string, int>();
            foreach (ThangBaoCao t in thang)
            {
                var donVi = t.Muc.Where(m => m.CoChuanThu && m.VaiTro != VaiTro.Dma).ToList();
                var cha = new Dictionary<int, Muc>();
                int nhom = -1;
                Muc doi = null;
                var dongDonVi = th.Dma.Select(d => d.DongCha).Distinct().OrderBy(r => r).ToList();
                // Đi lần lượt các dòng đơn vị của bảng để biết khu vực thuộc đội nào.
                for (int r = th.DongDau; r <= th.Trang.SoDong; r++)
                {
                    string ten = ChuanHoa(th.Trang.Chu(r, th.CotTen));
                    if (ten.Length == 0) continue;
                    bool laDonVi = th.CotThang.Keys.Any(c => CoThamChieuTrang(th.Trang.Lay(r, c))) ||
                                   (th.CotLkPr > 0 && CoThamChieuTrang(th.Trang.Lay(r, th.CotLkPr)));
                    if (!laDonVi) continue;
                    bool dongDoi = Regex.IsMatch(BoDau(ten), @"doi\s*cap\s*nuoc\s*so");
                    Muc m = TimDonVi(t, donVi, ten, nhom, false);
                    if (dongDoi) doi = m != null && m.VaiTro == VaiTro.Doi ? m : null;
                    if (m != null && m.VaiTro == VaiTro.Doi) nhom = t.ViTri(m.Id);
                    if (m != null && m.VaiTro == VaiTro.ToanCongTy) break;
                    // Tháng chưa có khu vực đó (cấu trúc cũ): đặt vùng DMA tạm dưới đội.
                    if (dongDonVi.Contains(r)) cha[r] = m ?? (dongDoi ? null : doi);
                }
                foreach (DongDma d in th.Dma)
                {
                    if (t.Thang < d.ThangDau && !(d.ThangDau == 13 && t.Thang == th.ThangLk)) continue;
                    Muc p;
                    if (!cha.TryGetValue(d.DongCha, out p) || p == null) continue;
                    daDat.Add(d);
                    int id = ids[d];
                    Muc m = t.Tim(id);
                    if (m == null)
                    {
                        m = VungDma.TaoMuc(id, d.Ten, p, LoaiMuc.NhapTay);
                        VungDma.Chen(t, m, p.Id);
                    }
                    double v;
                    string s;
                    if (d.TyLe.TryGetValue(t.Thang, out v)) m.TyLeNhap = v;
                    if (d.TinhTrang.TryGetValue(t.Thang, out s)) m.GhiChu = s;
                    if (t.Thang == th.ThangLk && d.LkPhatRa.HasValue)
                    {
                        double pr = m.Loai == LoaiMuc.NhapTay ? (m.SanLuong ?? 0) : 0;
                        m.LuyKePhatRaTruoc = Math.Round(d.LkPhatRa.Value - pr, 6);
                        if (d.LkChuanThu.HasValue) m.LuyKeChuanThuTruoc = Math.Round(d.LkChuanThu.Value - (m.ChuanThu ?? 0), 6);
                    }
                    if (t.Thang == th.ThangLk || t == thang[thang.Count - 1])
                        soVung[p.TenTongHop] = Math.Max(soVung.ContainsKey(p.TenTongHop) ? soVung[p.TenTongHop] : 0, VungDma.CuaDonVi(t, p).Count);
                }
            }

            // Đối chiếu: tỷ lệ từng tháng và lũy kế phần mềm tính lại so với bảng TỔNG HỢP.
            var bt = new BoTinh(data);
            int khop = 0;
            foreach (DongDma d in th.Dma)
            {
                foreach (ThangBaoCao t in thang)
                {
                    KetQua k = bt.Tinh(t)[ids[d]];
                    if (k == null) continue;
                    double v;
                    if (d.TyLe.TryGetValue(t.Thang, out v))
                    {
                        if (k.TyLe.HasValue && Math.Abs(k.TyLe.Value - v) < 0.0001) khop++;
                        else kq.SaiLech.Add(th.Trang.Ten + ", " + d.Ten + ", tháng " + t.Thang + ": phần mềm = " + So.P2(k.TyLe) + ", Excel = " + So.P2(v));
                    }
                    if (t.Thang == th.ThangLk && d.LkPhatRa > 0 && d.LkChuanThu.HasValue)
                    {
                        double lk = (d.LkPhatRa.Value - d.LkChuanThu.Value) / d.LkPhatRa.Value * 100;
                        if (k.LkTyLe.HasValue && Math.Abs(k.LkTyLe.Value - lk) < 0.0001) khop++;
                        else kq.SaiLech.Add(th.Trang.Ten + ", " + d.Ten + ", lũy kế: phần mềm = " + So.P2(k.LkTyLe) + ", Excel = " + So.P2(lk));
                    }
                }
            }
            kq.SoDongKhop += khop;
            var khongGhep = th.Dma.Where(d => !daDat.Contains(d)).Select(d => "\"" + d.Ten + "\" (thuộc \"" + d.TenCha + "\")").ToList();
            var batThuong = th.Dma.SelectMany(d => d.TyLe.Where(p => Math.Abs(p.Value) > 100).Select(p => d.Ten + " tháng " + p.Key + " = " + So.P2(p.Value) + "%")).ToList();
            if (batThuong.Count > 0)
                kq.ThongBao.Add("Lưu ý — tỷ lệ DMA bất thường trong bảng " + th.Trang.Ten + " (có thể gõ nhầm, sửa ở trang Vùng DMA): " + string.Join("; ", batThuong) + ".");
            kq.ThongBao.Add("Vùng DMA năm " + th.Nam + " (trang " + th.Trang.Ten + "): " + daDat.Count + " vùng — " +
                            string.Join(", ", soVung.Select(p => p.Key + ": " + p.Value)) + "; " + khop + " số tỷ lệ khớp với bảng." +
                            (th.BoQua.Count > 0 ? " Bỏ qua: " + string.Join("; ", th.BoQua) + "." : "") +
                            (khongGhep.Count > 0 ? " Không tìm thấy đơn vị chứa: " + string.Join("; ", khongGhep) + "." : ""));
        }

        /// <summary>
        /// Tìm đơn vị (đội / khu vực / toàn công ty) theo tên ghi trong Excel: "ĐỘI CẤP NƯỚC SỐ 1", "KV. Long Mỹ",
        /// "TX.Long Mỹ", "Trạm Lương Tâm", "Khu vực Ngã Sáu:"… Khu vực tìm trong khối đội đang xét ([nhom] = vị trí dòng đội).
        /// </summary>
        static Muc TimDonVi(ThangBaoCao cauTruc, List<Muc> donVi, string ten, int nhom, bool kemDma)
        {
            string bd = BoDau(ten);
            Match so = Regex.Match(bd, @"doi\s*cap\s*nuoc\s*so\s*(\d+)");
            if (so.Success)
                return donVi.FirstOrDefault(x => x.VaiTro == VaiTro.Doi && Regex.IsMatch(BoDau(x.Ten), @"\bso\s*" + so.Groups[1].Value + @"\b"));
            if (bd.Contains("toan cong ty")) return donVi.FirstOrDefault(x => x.VaiTro == VaiTro.ToanCongTy);
            string key = KhoaDonVi(ten);
            if (key.Length == 0) return null;
            IEnumerable<Muc> nguon = donVi.Where(x => x.VaiTro == VaiTro.KhuVuc || (kemDma && x.VaiTro == VaiTro.Dma));
            if (nhom >= 0)
            {
                int dau = nhom, cuoi = cauTruc.Muc.FindIndex(dau + 1, x => x.Cap == 0);
                if (cuoi < 0) cuoi = cauTruc.Muc.Count;
                nguon = nguon.Where(x => { int i = cauTruc.ViTri(x.Id); return i > dau && i < cuoi; });
            }
            var cands = nguon.Where(x =>
            {
                string a = KhoaDonVi(x.TenNgan), b = KhoaDonVi(x.Ten);
                return a == key || b == key || (a.Length > 0 && (a.Contains(key) || key.Contains(a))) || b.StartsWith(key);
            }).ToList();
            if (cands.Count == 0 && key.Contains(" "))
            {
                // Tên dài kiểu "Tổng lượng nước mua sỉ … Cấp thoát nước Long Mỹ": khớp nguyên cụm từ "long my".
                cands = nguon.Where(x => (" " + KhoaDonVi(x.Ten) + " ").Contains(" " + key + " ")).ToList();
            }
            return cands.Count == 1 ? cands[0] : null;
        }

        static int NamCuaTrangKeHoach(TrangKeHoach kh, List<LienKetKH> links, List<TrangDoc> lo, DuLieu data)
        {
            if (kh.NamTieuDe.HasValue) return kh.NamTieuDe.Value;
            var nam = links.Where(l => l.Trang == kh).GroupBy(l => l.Nam).OrderByDescending(g => g.Count()).ThenByDescending(g => g.Key).FirstOrDefault();
            if (nam != null) return nam.Key;
            if (kh.NamDoan.HasValue) return kh.NamDoan.Value;
            if (lo.Count > 0) return lo[lo.Count - 1].Thang.Nam;
            return data.ThangCuoi != null ? data.ThangCuoi.Nam : DateTime.Today.Year;
        }

        /// <summary>Nhập mọi chỉ tiêu của trang kế hoạch: ghép dòng theo công thức các trang tháng, rồi theo tên đơn vị.</summary>
        static void NhapTrangKeHoachVao(TrangKeHoach kh, List<LienKetKH> links, List<TrangDoc> lo, DuLieu data, KetQuaNhap kq)
        {
            int nam = NamCuaTrangKeHoach(kh, links, lo, data);
            ThangBaoCao cauTruc = data.Thang.Where(x => x.Nam == nam).OrderBy(x => x.Thang).LastOrDefault()
                               ?? data.Thang.Where(x => x.Nam < nam).OrderBy(x => x.SoThu).LastOrDefault()
                               ?? data.ThangCuoi;
            if (cauTruc == null)
            {
                kq.ThongBao.Add("Kế hoạch (trang " + kh.Trang.Ten + "): chưa có cấu trúc đơn vị để ghép — nhập các trang tháng trước.");
                return;
            }
            var donVi = cauTruc.Muc.Where(m => m.CoChuanThu).ToList();
            TrangXls t = kh.Trang;
            int soDong = 0, trong = 0, nhom = -1;
            var khongGhep = new List<string>();
            var daGhep = new HashSet<int>();
            for (int r = kh.DongTieuDe + 1; r <= t.SoDong; r++)
            {
                string ten = ChuanHoa(t.Chu(r, kh.CotTen));
                bool coSo = kh.Cot.Values.Any(c => t.So(r, c).HasValue);
                if (ten.Length == 0 || BoDau(ten) == "ten don vi")
                {
                    if (++trong > 5) break;
                    continue;
                }
                trong = 0;
                if (!coSo) continue;
                Muc m = null;
                var lk = links.Where(l => l.Trang == kh && l.Dong == r && cauTruc.Tim(l.Muc.Id) != null).OrderByDescending(l => l.Nam).FirstOrDefault();
                if (lk != null) m = cauTruc.Tim(lk.Muc.Id);
                if (m == null) m = TimDonVi(cauTruc, donVi, ten, nhom, true);
                if (m == null || daGhep.Contains(m.Id))
                {
                    khongGhep.Add("\"" + ten + "\" (dòng " + r + ")");
                    continue;
                }
                daGhep.Add(m.Id);
                if (m.VaiTro == VaiTro.Doi) nhom = cauTruc.ViTri(m.Id);
                else if (m.VaiTro == VaiTro.ToanCongTy) nhom = -1;
                foreach (var c in kh.Cot)
                {
                    double? v = t.So(r, c.Value);
                    if (v.HasValue) data.DatKeHoach(nam, m.Id, c.Key, Math.Round(v.Value, 4));
                }
                soDong++;
            }
            kq.ThongBao.Add("Kế hoạch năm " + nam + " (trang " + kh.Trang.Ten + "): " + soDong + " đơn vị — " +
                            string.Join(", ", kh.Cot.Keys.Select(l => TenChiTieu(l).ToLower())) + "." +
                            (khongGhep.Count > 0 ? " Không ghép được với đơn vị nào của " + cauTruc.Ten.ToLower() + ": " + string.Join("; ", khongGhep) + "." : ""));
        }

        // ------------------------------------------------------------------ nối dòng giữa các tháng

        static string KhoaTen(string nhom, Muc m)
        {
            return nhom + "|" + Thuong(m.Ten);
        }

        static string KhoaStt(string nhom, Muc m)
        {
            return nhom + "|" + m.Stt.ToUpperInvariant();
        }

        static List<KeyValuePair<string, Muc>> KhoaCua(ThangBaoCao t)
        {
            var list = new List<KeyValuePair<string, Muc>>();
            string nhom = "";
            foreach (Muc m in t.Muc)
            {
                if (m.Cap == 0) nhom = m.Stt;
                list.Add(new KeyValuePair<string, Muc>(nhom, m));
            }
            return list;
        }

        static Muc TimTheoKhoa(List<KeyValuePair<string, Muc>> nguon, Dong d, HashSet<int> daDung)
        {
            var ten = nguon.Where(p => !daDung.Contains(p.Value.Id) && KhoaTen(p.Key, p.Value) == KhoaTen(d.Nhom, d.Muc)).ToList();
            if (ten.Count == 1) return ten[0].Value;
            var stt = nguon.Where(p => !daDung.Contains(p.Value.Id) && d.Muc.Stt.Length > 0 && KhoaStt(p.Key, p.Value) == KhoaStt(d.Nhom, d.Muc)).ToList();
            if (stt.Count == 1) return stt[0].Value;
            var tenToanBang = nguon.Where(p => !daDung.Contains(p.Value.Id) && Thuong(p.Value.Ten) == Thuong(d.Muc.Ten)).ToList();
            if (tenToanBang.Count == 1) return tenToanBang[0].Value;
            return null;
        }

        // ------------------------------------------------------------------ nhập

        /// <summary>Nhập các trang tháng đã chọn và mọi trang kế hoạch có trong file.</summary>
        public static KetQuaNhap Nhap(List<TrangXls> book, List<TrangThang> chon, DuLieu data)
        {
            return Nhap(book, chon, TimTrangKeHoach(book, chon), TimTrangTongHop(book), data);
        }

        public static KetQuaNhap Nhap(List<TrangXls> book, List<TrangThang> chon, List<TrangKeHoach> chonKeHoach,
                                      List<TrangTongHop> chonTongHop, DuLieu data)
        {
            var kq = new KetQuaNhap();
            var daDoc = new Dictionary<string, TrangDoc>(StringComparer.OrdinalIgnoreCase);
            var thuTu = chon.OrderBy(c => c.SoThu).ToList();
            var cacTrang = new List<TrangDoc>();
            // Mọi trang kế hoạch trong file (kể cả không chọn nhập) để hiểu đúng cột "So kế hoạch" của các trang tháng.
            var keHoach = new Dictionary<string, TrangKeHoach>(StringComparer.OrdinalIgnoreCase);
            foreach (TrangKeHoach k in TimTrangKeHoach(book, chon)) keHoach[ChuanHoa(k.Trang.Ten)] = k;
            foreach (TrangKeHoach k in chonKeHoach) keHoach[ChuanHoa(k.Trang.Ten)] = k;

            foreach (TrangThang tt in thuTu)
            {
                TrangDoc td = DocTrang(tt, keHoach);
                ThangBaoCao cu = data.TimThang(tt.Nam, tt.Thang);
                ThangBaoCao truoc = data.TimThang(tt.SoThu - 1);
                var daDung = new HashSet<int>();

                // Gán Id: giữ Id của tháng đang có (nhập đè) → theo công thức lũy kế → khớp tên với tháng trước.
                var nguonCu = cu != null ? KhoaCua(cu) : null;
                var nguonTruoc = truoc != null ? KhoaCua(truoc) : null;
                foreach (Dong d in td.Dong)
                {
                    Muc khop = null;
                    if (nguonCu != null) khop = TimTheoKhoa(nguonCu, d, daDung);
                    if (khop == null && d.LienKetTrang != null)
                    {
                        TrangDoc tr;
                        Dong dl;
                        if (daDoc.TryGetValue(d.LienKetTrang, out tr) && tr.TheoDong.TryGetValue(d.LienKetDong, out dl) && !daDung.Contains(dl.Muc.Id))
                            khop = dl.Muc;
                    }
                    if (khop == null && nguonTruoc != null) khop = TimTheoKhoa(nguonTruoc, d, daDung);
                    d.Muc.Id = khop != null && !daDung.Contains(khop.Id) ? khop.Id : data.CapId();
                    daDung.Add(d.Muc.Id);
                }

                // Công thức: đổi dòng Excel → Id.
                foreach (Dong d in td.Dong)
                {
                    if (d.FormE != null) d.Muc.CongThuc = DoiSoHang(x: tt.Trang, td: td, lin: d.FormE, col: CE, owner: d, hangSo: out d.Muc.DieuChinh);
                    if (d.FormF != null)
                    {
                        double bo;
                        d.Muc.CongThucChuanThu = DoiSoHang(tt.Trang, td, d.FormF, CF, d, out bo);
                    }
                    KeyValuePair<int?, double> kh;
                    if (td.KeHoach.TryGetValue(d.Row, out kh)) data.DatKeHoach(kh.Key ?? tt.Nam, d.Muc.Id, kh.Value);
                }

                ThangBaoCao t = td.Thang;
                t.Muc = td.Dong.Select(d => d.Muc).ToList();
                if (string.IsNullOrEmpty(t.Ky[2].Ten) && cu != null) t.Ky = cu.Ky.Select(k => k.Chep()).ToArray();
                if (cu != null) VungDma.GiuLaiKhiThay(cu, t);
                if (td.DiaDanh != null && string.IsNullOrWhiteSpace(data.CaiDat.DiaDanh)) data.CaiDat.DiaDanh = td.DiaDanh;
                if (cu != null) data.Thang.Remove(cu);
                data.Thang.Add(t);
                data.SapXep();
                daDoc[ChuanHoa(tt.Trang.Ten)] = td;
                cacTrang.Add(td);
                kq.Thang.Add(t);
            }

            // Nhập năm cũ sau năm mới (vd file 2025 sau file 2026): nối Id tháng cuối của lô với tháng ngay sau
            // đã có trong phần mềm, để "so tháng trước" / "so cùng kỳ" của năm mới tự tính từ năm cũ.
            if (cacTrang.Count > 0)
            {
                TrangDoc cuoiLo = cacTrang[cacTrang.Count - 1];
                ThangBaoCao sau = data.TimThang(cuoiLo.Thang.SoThu + 1);
                if (sau != null && !kq.Thang.Contains(sau)) NoiIdVoiThangSau(data, cacTrang, cuoiLo, sau);
            }

            // Trang kế hoạch giao chỉ tiêu: sản lượng phát ra, chuẩn thu, doanh thu, tỷ lệ thất thoát, tồn hoá đơn.
            var links = cacTrang.SelectMany(td => td.LienKetKeHoach).ToList();
            foreach (TrangKeHoach k in chonKeHoach) NhapTrangKeHoachVao(k, links, cacTrang, data, kq);

            // Vùng DMA ghi tay trong bảng TỔNG HỢP năm.
            foreach (TrangTongHop th in chonTongHop) NhapDmaTuTongHop(th, data, kq);

            // Người ký mặc định = người ký tháng mới nhất vừa nhập (khi lô nhập là số liệu mới nhất).
            if (cacTrang.Count > 0 && data.ThangCuoi == cacTrang[cacTrang.Count - 1].Thang)
            {
                ThangBaoCao moi = cacTrang[cacTrang.Count - 1].Thang;
                if (!string.IsNullOrEmpty(moi.Ky[2].Ten))
                    for (int i = 0; i < 3; i++) data.CaiDat.KyMacDinh[i] = moi.Ky[i].Chep();
                TrangDoc last = cacTrang[cacTrang.Count - 1];
                if (!string.IsNullOrEmpty(last.Cty1) && last.Cty1.Length < 60) data.CaiDat.TenCongTy1 = last.Cty1;
                if (!string.IsNullOrEmpty(last.Cty2) && last.Cty2.Length < 60) data.CaiDat.TenCongTy2 = last.Cty2;
            }

            // Bỏ số lũy kế / tháng trước nhập từ Excel nếu tự tính ra đúng như vậy (để sửa tháng trước thì tháng sau tự cập nhật).
            var bt = new BoTinh(data);
            foreach (TrangDoc td in cacTrang)
            {
                ThangBaoCao t = td.Thang;
                ThangBaoCao truoc = data.TimThang(t.SoThu - 1);
                bt.XoaBoNho();
                KetQuaThang kqT = truoc != null ? bt.Tinh(truoc) : null;
                KetQuaThang kqNay = bt.Tinh(t);
                foreach (Dong d in td.Dong)
                {
                    Muc m = d.Muc;
                    KetQua rt = kqT != null ? kqT[m.Id] : null;
                    bool noi = t.Thang == 1 || (truoc != null && truoc.Nam == t.Nam);
                    if (noi && m.LuyKePhatRaTruoc.HasValue)
                    {
                        double chain = t.Thang == 1 || rt == null ? 0 : rt.LkPhatRa;
                        if (Math.Abs(chain - m.LuyKePhatRaTruoc.Value) < 0.01) m.LuyKePhatRaTruoc = null;
                    }
                    if (noi && m.LuyKeChuanThuTruoc.HasValue)
                    {
                        double chain = t.Thang == 1 || rt == null || !rt.LkChuanThu.HasValue ? 0 : rt.LkChuanThu.Value;
                        if (Math.Abs(chain - m.LuyKeChuanThuTruoc.Value) < 0.01) m.LuyKeChuanThuTruoc = null;
                    }
                    if (m.TyLeThangTruoc.HasValue && rt != null && rt.TyLe.HasValue && Math.Abs(rt.TyLe.Value - m.TyLeThangTruoc.Value) < 1e-6)
                        m.TyLeThangTruoc = null;
                    if (!m.CoChuanThu)
                    {
                        m.LuyKeChuanThuTruoc = null;
                        m.TyLeThangTruoc = null;
                    }
                }
            }

            // Tính lại và so với số Excel.
            bt.XoaBoNho();
            foreach (TrangDoc td in cacTrang)
            {
                KetQuaThang r = bt.Tinh(td.Thang);
                foreach (Dong d in td.Dong)
                {
                    KetQua k = r[d.Muc.Id];
                    string ten = td.Nguon.Trang.Ten + ", dòng " + d.Row + " (" + d.Muc + "): ";
                    bool ok = true;
                    ok &= SoSanh(kq, ten + "sản lượng", k.PhatRa, d.E, 0.01, d.E.HasValue || k.PhatRa.HasValue && k.PhatRa != 0);
                    if (d.LaDonVi)
                    {
                        ok &= SoSanh(kq, ten + "chuẩn thu", k.ChuanThu, d.F, 0.01, d.F.HasValue);
                        ok &= SoSanh(kq, ten + "tỷ lệ thất thoát", k.TyLe, d.G, 0.0001, d.G.HasValue);
                        ok &= SoSanh(kq, ten + "lũy kế tỷ lệ", k.LkTyLe, d.M, 0.0001, d.M.HasValue);
                    }
                    if (d.K.HasValue) ok &= SoSanh(kq, ten + "lũy kế phát ra", k.LkPhatRa, d.K, 0.01, true);
                    if (ok) kq.SoDongKhop++;
                }
            }
            return kq;
        }

        static void NoiIdVoiThangSau(DuLieu data, List<TrangDoc> lo, TrangDoc cuoi, ThangBaoCao sau)
        {
            var nguon = KhoaCua(sau);
            var daDung = new HashSet<int>();
            var map = new Dictionary<int, int>();
            foreach (Dong d in cuoi.Dong)
            {
                Muc khop = TimTheoKhoa(nguon, d, daDung);
                if (khop == null) continue;
                daDung.Add(khop.Id);
                if (khop.Id != d.Muc.Id) map[d.Muc.Id] = khop.Id;
            }
            var idLo = new HashSet<int>(lo.SelectMany(t => t.Thang.Muc.Select(m => m.Id)));
            foreach (int k in map.Keys.ToList()) if (idLo.Contains(map[k])) map.Remove(k);   // tránh trùng Id trong lô
            if (map.Count == 0) return;
            foreach (TrangDoc t in lo)
            {
                foreach (Muc m in t.Thang.Muc)
                {
                    int n;
                    if (map.TryGetValue(m.Id, out n)) m.Id = n;
                    foreach (SoHang s in m.CongThuc.Concat(m.CongThucChuanThu)) if (map.TryGetValue(s.Id, out n)) s.Id = n;
                }
            }
            foreach (int nam in lo.Select(t => t.Thang.Nam).Distinct())
            {
                Dictionary<int, ChiTieu> kh;
                if (!data.KeHoach.TryGetValue(nam, out kh)) continue;
                foreach (var p in kh.Where(p => map.ContainsKey(p.Key)).ToList())
                {
                    kh.Remove(p.Key);
                    kh[map[p.Key]] = p.Value;
                }
            }
        }

        static bool SoSanh(KetQuaNhap kq, string ten, double? app, double? excel, double tol, bool can)
        {
            if (!can) return true;
            double a = app ?? 0, e = excel ?? 0;
            if (Math.Abs(a - e) <= tol) return true;
            kq.SaiLech.Add(ten + " phần mềm = " + (tol < 0.01 ? So.P2(app) : So.M3(app)) + ", Excel = " + (tol < 0.01 ? So.P2(excel) : So.M3(excel)));
            return false;
        }

        static List<SoHang> DoiSoHang(TrangXls x, TrangDoc td, Lin lin, int col, Dong owner, out double hangSo)
        {
            var list = new List<SoHang>();
            hangSo = lin.HangSo;
            foreach (var p in lin.HeSo)
            {
                string trang;
                int row, c;
                TachKhoa(p.Key, out trang, out row, out c);
                Dong d;
                if (trang == null && c == col && row != owner.Row && td.TheoDong.TryGetValue(row, out d))
                    list.Add(new SoHang(d.Muc.Id, p.Value));
                else
                    hangSo += p.Value * (trang == null ? (x.So(row, c) ?? 0) : 0);
            }
            hangSo = Math.Round(hangSo, 6);
            return list;
        }
    }
}
