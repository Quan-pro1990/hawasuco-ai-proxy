using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Nhập file Excel "BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG mm/yyyy" của đồng hồ cấp 1:
    /// dòng I/II… = đội, 1/2… = trạm / nhà máy (cột C ghi thời gian chốt), 1.1/2.1… = đồng hồ (chỉ số cũ, mới).
    /// </summary>
    public static class NhapCap1
    {
        const int CA = 1, CB = 2, CC = 3, CD = 4, CE = 5, CG = 7, CH = 8;

        public class TrangCap1
        {
            public TrangXls Trang;
            public int Nam, Thang, DongTieuDe;
            public override string ToString() { return Trang.Ten + "  (sản lượng khai thác tháng " + Thang + "/" + Nam + ")"; }
        }

        public class KetQua
        {
            public KyCap1 Ky;
            public int Doi, Tram, DongHo, Khop;
            public List<string> ThongBao = new List<string>();
            public List<string> SaiLech = new List<string>();
        }

        static string B(string s) { return NhapExcel.BoDau(s); }

        public static List<TrangCap1> TimTrang(List<TrangXls> book)
        {
            var list = new List<TrangCap1>();
            foreach (TrangXls t in book)
            {
                int nam = 0, thang = 0, hr = -1;
                for (int r = 1; r <= Math.Min(12, t.SoDong); r++)
                {
                    string s = B(t.Chu(r, CA));
                    if (!s.Contains("san luong")) continue;
                    Match m = Regex.Match(s, @"thang\s*(\d{1,2})\s*(?:/|nam)\s*(\d{4})");
                    if (m.Success) { thang = int.Parse(m.Groups[1].Value); nam = int.Parse(m.Groups[2].Value); }
                }
                for (int r = 1; r <= Math.Min(20, t.SoDong); r++)
                    if (B(t.Chu(r, CB)) == "ten don vi" && B(t.Chu(r, CC)).Contains("chi so")) { hr = r; break; }
                if (hr < 0 || nam < 2000 || thang < 1 || thang > 12) continue;
                list.Add(new TrangCap1 { Trang = t, Nam = nam, Thang = thang, DongTieuDe = hr });
            }
            return list;
        }

        static string TenDoiChuan(string ten)
        {
            Match m = Regex.Match(B(ten), @"doi\s*cap\s*nuoc\s*so\s*(\d+)");
            return m.Success ? "Đội Cấp nước số " + m.Groups[1].Value : NhapExcel.ChuanHoa(ten);
        }

        static NguonNuoc? DoanNguon(string tenDongHo)
        {
            string s = B(tenDongHo);
            if (s.Contains("gieng") || s.Contains("ngam")) return NguonNuoc.Gieng;
            if (s.Contains("nuoc mat") || s.Contains("song") || s.Contains("kenh")) return NguonNuoc.NuocMat;
            return null;
        }

        public static KetQua Nhap(TrangCap1 tr, DuLieu dl)
        {
            DuLieuCap1 d = dl.Cap1;
            Cap1Ops.KhoiTaoDoi(dl);
            var kq = new KetQua();
            TrangXls x = tr.Trang;
            KyCap1 ky = d.TimKy(tr.Nam, tr.Thang);
            if (ky == null)
            {
                ky = new KyCap1 { Nam = tr.Nam, Thang = tr.Thang, KyHoaDon = ThangBaoCao.KyMacDinh(tr.Nam, tr.Thang) };
                d.Ky.Add(ky);
                d.SapXep();
            }
            kq.Ky = ky;
            for (int r = 1; r < tr.DongTieuDe; r++)
            {
                string s = B(x.Chu(r, CA));
                Match k = Regex.Match(s, @"ky\s*(\d{1,2}\s*/\s*\d{4})");
                if (k.Success) ky.KyHoaDon = k.Groups[1].Value.Replace(" ", "");
                var ngay = Regex.Matches(s, @"ngay\s*(\d{1,2})\s*thang\s*(\d{1,2})(?:\s*/\s*(\d{4})|\s*nam\s*(\d{4}))?");
                if (ngay.Count >= 2)
                {
                    DateTime? den = TaoNgay(ngay[1], null);
                    DateTime? tu = TaoNgay(ngay[0], den);
                    if (tu.HasValue && den.HasValue) { ky.TuNgay = tu; ky.DenNgay = den; }
                }
            }

            DoiCap1 doi = null;
            TramCap1 tram = null;
            int trong = 0;
            var daNhap = new List<KeyValuePair<DongHoCap1, double?>>();
            for (int r = tr.DongTieuDe + 1; r <= x.SoDong; r++)
            {
                string stt = NhapExcel.ChuanHoa(x.Chu(r, CA)), ten = NhapExcel.ChuanHoa(x.Chu(r, CB));
                string bt = B(stt + " " + ten);
                if (bt.Contains("giam doc") || bt.Contains("lap bieu") || bt.StartsWith("*")) break;
                if (B(ten).StartsWith("tong cong") || B(ten).StartsWith("trong do")) break;   // các dòng tổng cuối bảng (file do phần mềm xuất)
                if (ten.Length == 0) { if (++trong > 5) break; continue; }
                trong = 0;
                bool laDoi = Regex.IsMatch(stt, "^(I|II|III|IV|V|VI|VII|VIII|IX|X)$") || B(ten).StartsWith("doi ");
                bool laDongHo = stt.Contains(".");
                if (laDoi)
                {
                    string tenDoi = TenDoiChuan(ten);
                    doi = Cap1Ops.TimDoiTheoTen(d, tenDoi);
                    if (doi == null)
                    {
                        doi = new DoiCap1 { Id = d.CapId(), Ten = tenDoi };
                        d.Doi.Add(doi);
                    }
                    kq.Doi++;
                    tram = null;
                }
                else if (!laDongHo)
                {
                    if (doi == null)
                    {
                        kq.ThongBao.Add("Dòng " + r + " \"" + ten + "\": chưa có dòng đội phía trên — bỏ qua.");
                        continue;
                    }
                    tram = d.TramCuaDoi(doi.Id).FirstOrDefault(v => B(v.Ten) == B(ten));
                    if (tram == null)
                    {
                        tram = new TramCap1 { Id = d.CapId(), DoiId = doi.Id, Ten = ten };
                        d.Tram.Add(tram);
                    }
                    OXls c = x.Lay(r, CC);
                    if (c != null && !string.IsNullOrWhiteSpace(c.Text) && !c.Number.HasValue && c.Formula == null)
                        ky.ThoiGianChot[tram.Id] = NhapExcel.ChuanHoa(c.Text);
                    kq.Tram++;
                }
                else
                {
                    if (tram == null)
                    {
                        kq.ThongBao.Add("Dòng " + r + " \"" + ten + "\": chưa có dòng trạm phía trên — bỏ qua.");
                        continue;
                    }
                    DongHoCap1 dh = d.DongHoCuaTram(tram.Id).FirstOrDefault(v => B(v.Ten) == B(ten));
                    if (dh == null)
                    {
                        string g = B(x.Chu(r, CG));
                        NguonNuoc? n = g == "gieng" ? NguonNuoc.Gieng : g == "nuoc mat" ? NguonNuoc.NuocMat : DoanNguon(ten);
                        dh = new DongHoCap1 { Id = d.CapId(), TramId = tram.Id, Ten = ten, Nguon = n ?? (B(tram.Ten).Contains("nha may") ? NguonNuoc.NuocMat : NguonNuoc.Gieng) };
                        d.DongHo.Add(dh);
                        Cap1Ops.DuaVaoTuKy(d, ky, dh.Id);   // đồng hồ mới: có cả ở các tháng sau đã tạo
                        if (!n.HasValue)
                            kq.ThongBao.Add("\"" + ten + "\" (" + tram.Ten + "): tên không ghi rõ giếng hay nước mặt — tạm đặt " +
                                            DuLieuCap1.TenNguon(dh.Nguon).ToLower() + ", sửa ở nút Sửa… nếu sai.");
                    }
                    ChiSoCap1 cs = ky.Tim(dh.Id);
                    if (cs == null)
                    {
                        cs = new ChiSoCap1 { DongHoId = dh.Id };
                        ky.ChiSo.Add(cs);
                    }
                    cs.ChiSoCu = x.So(r, CC);
                    cs.ChiSoMoi = x.So(r, CD);
                    double? e = x.So(r, CE);
                    cs.SanLuongNhap = null;
                    string ct;
                    double? tinhDuoc = TinhCap1.SanLuong(cs, dh, out ct);
                    // sản lượng trong file khác (chỉ số − chỉ số): đồng hồ hỏng / ước tính → giữ số của file
                    OXls oe = x.Lay(r, CE);
                    bool congThucTrong = oe != null && oe.Formula != null && e == 0 && !cs.ChiSoCu.HasValue && !cs.ChiSoMoi.HasValue;
                    if (e.HasValue && !congThucTrong && (!tinhDuoc.HasValue || Math.Abs(tinhDuoc.Value - e.Value) > 0.01)) cs.SanLuongNhap = e;
                    if (congThucTrong) e = null;
                    daNhap.Add(new KeyValuePair<DongHoCap1, double?>(dh, e));
                    kq.DongHo++;
                }
            }
            // đồng hồ đang dùng khác (đội khác) đã có trong tháng thì giữ; tháng mới tạo thì thêm đủ danh mục
            foreach (DongHoCap1 dh in d.DongHo.Where(v => !v.Ngung && ky.Tim(v.Id) == null))
                ky.ChiSo.Add(new ChiSoCap1 { DongHoId = dh.Id });

            var tinh = new TinhCap1(d);
            var r2 = tinh.Tinh(ky);
            foreach (var p in daNhap)
            {
                double? app = r2[p.Key.Id].SanLuong;
                if (!p.Value.HasValue || (app.HasValue && Math.Abs(app.Value - p.Value.Value) < 0.01)) kq.Khop++;
                else kq.SaiLech.Add(p.Key.Ten + ": phần mềm " + So.M3(app) + ", Excel " + So.M3(p.Value));
            }
            return kq;
        }

        static DateTime? TaoNgay(Match m, DateTime? sau)
        {
            int ngay = int.Parse(m.Groups[1].Value), thang = int.Parse(m.Groups[2].Value);
            int nam = m.Groups[3].Success ? int.Parse(m.Groups[3].Value) : m.Groups[4].Success ? int.Parse(m.Groups[4].Value)
                    : sau.HasValue ? (thang > sau.Value.Month ? sau.Value.Year - 1 : sau.Value.Year) : DateTime.Today.Year;
            try { return new DateTime(nam, thang, ngay); }
            catch (ArgumentException) { return null; }
        }
    }
}
