using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace ThatThoatNuoc
{
    /// <summary>
    /// File Excel của đồng hồ cấp 1: báo cáo sản lượng nước khai thác tháng (cùng mẫu "BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG")
    /// và bảng tổng hợp khai thác cả năm theo tháng. Ô tổng ghi kèm công thức, sửa số trong Excel vẫn tự tính lại.
    /// </summary>
    public class BaoCaoCap1
    {
        const int A = 1, B = 2, C = 3, D = 4, E = 5, F = 6, G = 7, H = 8;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
        static readonly CultureInfo VnUpper = CultureInfo.GetCultureInfo("vi-VN");

        readonly DuLieu dl;
        readonly DuLieuCap1 d;
        readonly TinhCap1 tinh;

        public BaoCaoCap1(DuLieu dl)
        {
            this.dl = dl;
            d = dl.Cap1;
            tinh = new TinhCap1(d);
        }

        static readonly XKieu CtyK = new XKieu { Dam = true, Co = 13, Ngang = "center" };
        static readonly XKieu CtyGach = new XKieu { Dam = true, Co = 13, Ngang = "center", GachChan = true };
        static readonly XKieu TieuDeK = new XKieu { Dam = true, Co = 16, Ngang = "center", XuongDong = true };
        static readonly XKieu PhuDeK = new XKieu { Dam = true, Co = 13, Ngang = "center" };
        static readonly XKieu PhuDeNghieng = new XKieu { Nghieng = true, Co = 13, Ngang = "center" };
        static readonly XKieu CotK = new XKieu { Dam = true, Co = 12, Ngang = "center", XuongDong = true, Khung = true, Nen = "FFE8EEF5" };
        static readonly XKieu SttK = new XKieu { Khung = true, Ngang = "center" };
        static readonly XKieu TenK = new XKieu { Khung = true, Ngang = "left", XuongDong = true };
        static readonly XKieu SoK = new XKieu { Khung = true, Ngang = "right", DinhDang = "#,##0" };
        static readonly XKieu MoTaK = new XKieu { Khung = true, Ngang = "center", Nghieng = true, Co = 11, XuongDong = true };
        static readonly XKieu GhiChuO = new XKieu { Khung = true, Ngang = "left", Nghieng = true, Co = 11, XuongDong = true };
        static readonly XKieu NguonK = new XKieu { Khung = true, Ngang = "center", Co = 11 };
        static readonly XKieu NgayK = new XKieu { Nghieng = true, Co = 13, Ngang = "center" };
        static readonly XKieu KyK = new XKieu { Dam = true, Co = 13, Ngang = "center", XuongDong = true };
        const string NenDoi = "FFDCE6F1", NenTram = "FFF2F6FA", NenTong = "FFFFF2CC";

        static XKieu Dam(XKieu k, string nen) { return k.Voi(x => { x.Dam = true; x.Nen = nen; }); }
        static XKieu Nghieng(XKieu k) { return k.Voi(x => { x.Nghieng = true; x.Dam = false; }); }

        static XKieu KieuSo(double? v, XKieu baseKieu)
        {
            bool le = v.HasValue && Math.Abs(v.Value - Math.Round(v.Value)) > 0.0000001;
            return le ? baseKieu.Voi(x => x.DinhDang = "#,##0.00") : baseKieu;
        }

        static string Hs(double v) { return v.ToString("R", Inv); }
        static string Cong(double v) { return v < 0 ? "-" + Hs(-v) : "+" + Hs(v); }

        /// <summary>Phần chênh giữa số phải có và tổng các ô được cộng (đồng hồ đã ngừng trong năm…) ghi thêm vào công thức.</summary>
        static string ThemChenh(string f, double phaiCo, double tongO)
        {
            double chenh = Math.Round(phaiCo - tongO, 6);
            return Math.Abs(chenh) < 0.005 ? f : f + Cong(chenh);
        }

        static int SoDongChu(string text, double rong)
        {
            if (string.IsNullOrEmpty(text)) return 1;
            int perLine = Math.Max(1, (int)(rong * 1.15));
            int lines = 0;
            foreach (string part in text.Replace("\r", "").Split('\n'))
                lines += Math.Max(1, (part.Length + perLine - 1) / perLine);
            return lines;
        }

        static void O(XTrang s, int r, int c, double? v, string f, XKieu k)
        {
            if (!v.HasValue) s.Dat(r, c, null, k);
            else if (f != null) s.CongThuc(r, c, f, v.Value, k);
            else s.Dat(r, c, v.Value, k);
        }

        void DauTrang(XTrang s, int traiDen, int phaiTu, int cuoi)
        {
            s.GopO(1, 1, 1, traiDen, dl.CaiDat.TenCongTy1, CtyK);
            s.GopO(2, 1, 2, traiDen, dl.CaiDat.TenCongTy2, CtyGach);
            s.GopO(1, phaiTu, 1, cuoi, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", CtyK);
            s.GopO(2, phaiTu, 2, cuoi, "Độc lập - Tự do - Hạnh phúc", CtyGach);
            s.CaoDong[1] = 18;
            s.CaoDong[2] = 18;
        }

        int PhanKy(XTrang s, int row, int[][] cot, DateTime? ngay)
        {
            DateTime x = ngay ?? DateTime.Today;
            string dia = string.IsNullOrWhiteSpace(dl.CaiDat.DiaDanh) ? "" : dl.CaiDat.DiaDanh.Trim() + ", ";
            s.GopO(row, cot[2][0], row, cot[2][1], dia + So.NgayChu(x), NgayK);
            row++;
            NguoiKy[] ky = dl.CaiDat.KyMacDinh;
            for (int i = 0; i < 3; i++)
            {
                s.GopO(row, cot[i][0], row, cot[i][1], ky[i].Dong1, KyK);
                s.GopO(row + 1, cot[i][0], row + 1, cot[i][1], ky[i].Dong2, KyK);
                s.GopO(row + 6, cot[i][0], row + 6, cot[i][1], ky[i].Ten, KyK);
            }
            s.CaoDong[row] = 18;
            s.CaoDong[row + 1] = 18;
            return row + 7;
        }

        static string Hoa(string s) { return (s ?? "").ToUpper(VnUpper); }

        /// <summary>"(Nước khai thác từ ngày 21 tháng 08/2026 đến ngày 20 tháng 09 năm 2026)" như báo cáo đang dùng.</summary>
        public static string ChuoiKhaiThac(KyCap1 k)
        {
            if (!k.TuNgay.HasValue || !k.DenNgay.HasValue) return "";
            DateTime t = k.TuNgay.Value, n = k.DenNgay.Value;
            return "(Nước khai thác từ ngày " + t.Day.ToString("00") + " tháng " + t.Month.ToString("00") + "/" + t.Year +
                   " đến ngày " + n.Day.ToString("00") + " tháng " + n.Month.ToString("00") + " năm " + n.Year + ")";
        }

        public static string TenFileThang(KyCap1 k, DoiCap1 doi)
        {
            return "BÁO CÁO SẢN LƯỢNG NƯỚC KHAI THÁC THÁNG " + k.Thang.ToString("00") + "-" + k.Nam + (doi != null ? " - " + doi.Ten : "") + ".xlsx";
        }

        public static string TenFileNam(int nam, DoiCap1 doi)
        {
            return "TỔNG HỢP SẢN LƯỢNG NƯỚC KHAI THÁC NĂM " + nam + (doi != null ? " - " + doi.Ten : "") + ".xlsx";
        }

        static string GhiChuDongHo(ChiSoCap1 cs, DongHoCap1 dh)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(cs.GhiChu)) parts.Add(cs.GhiChu.Trim());
            if (cs.ThayDongHo && !cs.SanLuongNhap.HasValue)
                parts.Add("Thay đồng hồ: chốt ĐH cũ " + So.N0(cs.ChotCu) + ", đầu ĐH mới " + So.N0(cs.DauMoi));
            if (dh.HeSo != 1 && !cs.SanLuongNhap.HasValue) parts.Add("Hệ số ×" + So.Nhap(dh.HeSo));
            return string.Join("\n", parts);
        }

        static string CongThucE(ChiSoCap1 cs, DongHoCap1 dh, int r)
        {
            if (cs.SanLuongNhap.HasValue) return null;
            string expr;
            if (cs.ThayDongHo)
            {
                if (!cs.ChiSoCu.HasValue || !cs.ChiSoMoi.HasValue || !cs.ChotCu.HasValue || !cs.DauMoi.HasValue) return null;
                expr = "(" + Hs(cs.ChotCu.Value) + "-C" + r + ")+(D" + r + "-" + Hs(cs.DauMoi.Value) + ")";
            }
            else
            {
                if (!cs.ChiSoCu.HasValue || !cs.ChiSoMoi.HasValue) return null;
                expr = "D" + r + "-C" + r;
            }
            double hs = dh.HeSo > 0 ? dh.HeSo : 1;
            if (hs != 1) expr = "(" + expr + ")*" + Hs(hs);
            return expr;
        }

        // ------------------------------------------------------------------ báo cáo tháng

        public XSo SoThang(KyCap1 k, int doiId)
        {
            DoiCap1 doiLoc = doiId >= 0 ? d.TimDoi(doiId) : null;
            var cay = d.Cay(k.ChiSo.Select(c => c.DongHoId), doiId);
            if (cay.Count == 0) throw new InvalidOperationException(k.Ten + " chưa có đồng hồ nào" + (doiLoc != null ? " của " + doiLoc.Ten : "") + ".");
            var so = new XSo();
            XTrang s = so.Them("Tháng " + k.Thang + "-" + k.Nam);
            s.Ngang = false;
            double[] w = { 0, 7, 46, 15, 15, 15, 16, 11, 26 };
            for (int c = A; c <= H; c++) s.RongCot[c] = w[c];
            DauTrang(s, B, D, H);
            s.GopO(4, A, 4, H, "BÁO CÁO SẢN LƯỢNG NƯỚC KHAI THÁC THÁNG " + k.Thang.ToString("00") + "/" + k.Nam +
                               (doiLoc != null ? "\n" + Hoa(doiLoc.Ten) : ""), TieuDeK);
            s.CaoDong[4] = doiLoc != null ? 42 : 24;
            s.GopO(5, A, 5, H, string.IsNullOrWhiteSpace(k.KyHoaDon) ? "" : "HÓA ĐƠN KỲ " + k.KyHoaDon, PhuDeK);
            s.GopO(6, A, 6, H, ChuoiKhaiThac(k), PhuDeNghieng);
            string[] heads = { "STT", "Tên đơn vị", "Chỉ số TLK\ntháng trước\n(m3)", "Chỉ số TLK\nhiện tại\n(m3)", "Sản lượng\nkhai thác\n(m3)",
                               "Luỹ kế\nnăm " + k.Nam + "\n(m3)", "Nguồn\nnước", "Ghi chú" };
            for (int i = 0; i < heads.Length; i++) s.Dat(8, A + i, heads[i], CotK);
            s.CaoDong[8] = 52;
            s.LapTu = 8;
            s.LapDen = 8;
            s.CoDinhDong = 8;

            var kq = tinh.Tinh(k);
            int row = 9, dau = 9;
            var dongDoi = new List<int>();
            double tongSl = 0, tongLk = 0;
            for (int iDoi = 0; iDoi < cay.Count; iDoi++)
            {
                NhomDoiCap1 nd = cay[iDoi];
                int rDoi = row++;
                var dongTram = new List<int>();
                double doiSl = 0, doiLk = 0;
                for (int iTram = 0; iTram < nd.Tram.Count; iTram++)
                {
                    NhomTramCap1 nt = nd.Tram[iTram];
                    int rTram = row++, a = row;
                    double tramSl = 0, tramLk = 0;
                    for (int iDh = 0; iDh < nt.DongHo.Count; iDh++)
                    {
                        DongHoCap1 dh = nt.DongHo[iDh];
                        ChiSoCap1 cs = k.Tim(dh.Id);
                        KetQuaCap1 rk = kq[dh.Id];
                        int r = row++;
                        s.Dat(r, A, (iTram + 1) + "." + (iDh + 1), SttK);
                        s.Dat(r, B, dh.Ten, TenK);
                        s.Dat(r, C, cs.ChiSoCu, KieuSo(cs.ChiSoCu, SoK));
                        s.Dat(r, D, cs.ChiSoMoi, KieuSo(cs.ChiSoMoi, SoK));
                        O(s, r, E, rk.SanLuong, CongThucE(cs, dh, r), KieuSo(rk.SanLuong, SoK));
                        double nen = rk.LuyKe - (rk.SanLuong ?? 0);
                        s.CongThuc(r, F, Math.Abs(nen) < 1e-9 ? "E" + r : "E" + r + Cong(nen), rk.LuyKe, KieuSo(rk.LuyKe, SoK));
                        s.Dat(r, G, DuLieuCap1.TenNguon(dh.Nguon), NguonK);
                        string gc = GhiChuDongHo(cs, dh);
                        s.Dat(r, H, gc, GhiChuO);
                        s.CaoDong[r] = Math.Max(Math.Max(SoDongChu(dh.Ten, w[B] * 0.85) * 16.5, SoDongChu(gc, w[H] * 0.9) * 15), 16.5) + 3;
                        tramSl += rk.SanLuong ?? 0;
                        tramLk += rk.LuyKe;
                    }
                    int b = row - 1;
                    TongCap1 tt = tinh.Tong(k, nt.Loc);
                    s.Dat(rTram, A, (iTram + 1).ToString(), Dam(SttK, NenTram));
                    s.Dat(rTram, B, nt.Tram.Ten, Dam(TenK, NenTram));
                    string chot = nt.Tram.Id >= 0 ? k.LayThoiGianChot(nt.Tram.Id) : "";
                    s.GopO(rTram, C, rTram, D, chot, Nghieng(Dam(MoTaK, NenTram)));
                    s.CongThuc(rTram, E, ThemChenh("SUM(E" + a + ":E" + b + ")", tt.SanLuong, tramSl), tt.SanLuong, KieuSo(tt.SanLuong, Dam(SoK, NenTram)));
                    s.CongThuc(rTram, F, ThemChenh("SUM(F" + a + ":F" + b + ")", tt.LuyKe, tramLk), tt.LuyKe, KieuSo(tt.LuyKe, Dam(SoK, NenTram)));
                    s.Dat(rTram, G, null, Dam(NguonK, NenTram));
                    s.Dat(rTram, H, null, Dam(GhiChuO, NenTram));
                    s.CaoDong[rTram] = Math.Max(SoDongChu(nt.Tram.Ten, w[B] * 0.75) * 16.5, SoDongChu(chot, (w[C] + w[D]) * 0.9) * 15) + 3;
                    dongTram.Add(rTram);
                    doiSl += tt.SanLuong;
                    doiLk += tt.LuyKe;
                }
                TongCap1 td = tinh.Tong(k, nd.Loc);
                s.Dat(rDoi, A, So.LaMa(iDoi + 1), Dam(SttK, NenDoi));
                s.Dat(rDoi, B, Hoa(nd.Doi.Ten), Dam(TenK, NenDoi));
                s.GopO(rDoi, C, rDoi, D, string.Join(" + ", Enumerable.Range(1, nd.Tram.Count)), Nghieng(Dam(MoTaK, NenDoi)));
                s.CongThuc(rDoi, E, ThemChenh(string.Join("+", dongTram.Select(x => "E" + x)), td.SanLuong, doiSl), td.SanLuong, KieuSo(td.SanLuong, Dam(SoK, NenDoi)));
                s.CongThuc(rDoi, F, ThemChenh(string.Join("+", dongTram.Select(x => "F" + x)), td.LuyKe, doiLk), td.LuyKe, KieuSo(td.LuyKe, Dam(SoK, NenDoi)));
                s.Dat(rDoi, G, null, Dam(NguonK, NenDoi));
                s.Dat(rDoi, H, null, Dam(GhiChuO, NenDoi));
                s.CaoDong[rDoi] = 21;
                dongDoi.Add(rDoi);
                tongSl += td.SanLuong;
                tongLk += td.LuyKe;
            }
            int cuoi = row - 1;

            Func<DongHoCap1, bool> locDoi = doiId >= 0 ? (Func<DongHoCap1, bool>)(x => cay[0].Loc(x)) : TinhCap1.TatCa;
            if (dongDoi.Count > 1)
            {
                TongCap1 tc = tinh.Tong(k, locDoi);
                int r = row++;
                s.Dat(r, A, null, Dam(SttK, NenTong));
                s.Dat(r, B, "TỔNG CỘNG (" + string.Join(" + ", Enumerable.Range(1, dongDoi.Count).Select(So.LaMa)) + ")", Dam(TenK, NenTong));
                s.GopO(r, C, r, D, null, Dam(MoTaK, NenTong));
                s.CongThuc(r, E, ThemChenh(string.Join("+", dongDoi.Select(x => "E" + x)), tc.SanLuong, tongSl), tc.SanLuong, KieuSo(tc.SanLuong, Dam(SoK, NenTong)));
                s.CongThuc(r, F, ThemChenh(string.Join("+", dongDoi.Select(x => "F" + x)), tc.LuyKe, tongLk), tc.LuyKe, KieuSo(tc.LuyKe, Dam(SoK, NenTong)));
                s.Dat(r, G, null, Dam(NguonK, NenTong));
                s.Dat(r, H, null, Dam(GhiChuO, NenTong));
                s.CaoDong[r] = 21;
            }
            foreach (NguonNuoc n in new[] { NguonNuoc.Gieng, NguonNuoc.NuocMat })
            {
                NguonNuoc nn = n;
                TongCap1 tn = tinh.Tong(k, x => locDoi(x) && x.Nguon == nn);
                double oSl = 0, oLk = 0;
                foreach (ChiSoCap1 c in k.ChiSo)
                {
                    DongHoCap1 dh = d.TimDongHo(c.DongHoId);
                    if (dh == null || dh.Nguon != n || !locDoi(dh) || !cay.Any(x => x.Tram.Any(t => t.DongHo.Contains(dh)))) continue;
                    oSl += kq[dh.Id].SanLuong ?? 0;
                    oLk += kq[dh.Id].LuyKe;
                }
                string ten = DuLieuCap1.TenNguon(n);
                string vung = "$G$" + dau + ":$G$" + cuoi;
                int r = row++;
                s.Dat(r, A, null, SttK);
                s.Dat(r, B, (n == NguonNuoc.Gieng ? "Trong đó: - Nước giếng (nước ngầm)" : "               - Nước mặt"), Nghieng(TenK));
                s.GopO(r, C, r, D, null, MoTaK);
                s.CongThuc(r, E, ThemChenh("SUMIF(" + vung + ",\"" + ten + "\",E$" + dau + ":E$" + cuoi + ")", tn.SanLuong, oSl), tn.SanLuong, KieuSo(tn.SanLuong, Nghieng(SoK)));
                s.CongThuc(r, F, ThemChenh("SUMIF(" + vung + ",\"" + ten + "\",F$" + dau + ":F$" + cuoi + ")", tn.LuyKe, oLk), tn.LuyKe, KieuSo(tn.LuyKe, Nghieng(SoK)));
                s.Dat(r, G, ten, NguonK);
                s.Dat(r, H, null, GhiChuO);
                s.CaoDong[r] = 19;
            }
            row++;
            PhanKy(s, row, new[] { new[] { A, B }, new[] { C, E }, new[] { F, H } }, k.NgayLap);
            return so;
        }

        // ------------------------------------------------------------------ tổng hợp năm

        public XSo SoNam(int nam, int doiId)
        {
            DoiCap1 doiLoc = doiId >= 0 ? d.TimDoi(doiId) : null;
            var kys = new KyCap1[13];
            foreach (KyCap1 k in d.Ky.Where(x => x.Nam == nam)) kys[k.Thang] = k;
            var ids = d.Ky.Where(x => x.Nam == nam).SelectMany(x => x.ChiSo.Select(c => c.DongHoId)).Distinct().ToList();
            var cay = d.Cay(ids, doiId);
            if (cay.Count == 0) throw new InvalidOperationException("Năm " + nam + " chưa có số liệu đồng hồ cấp 1" + (doiLoc != null ? " của " + doiLoc.Ten : "") + ".");
            const int T1 = 4, CN = 16;
            var so = new XSo();
            XTrang s = so.Them("Khai thác năm " + nam);
            s.RongCot[A] = 6;
            s.RongCot[B] = 42;
            s.RongCot[C] = 10;
            for (int c = T1; c < T1 + 12; c++) s.RongCot[c] = 11.5;
            s.RongCot[CN] = 13.5;
            DauTrang(s, B, 10, CN);
            s.GopO(4, A, 4, CN, "TỔNG HỢP SẢN LƯỢNG NƯỚC KHAI THÁC NĂM " + nam + (doiLoc != null ? " - " + Hoa(doiLoc.Ten) : ""), TieuDeK);
            s.CaoDong[4] = 24;
            s.GopO(5, A, 5, CN, "(Theo đồng hồ cấp 1 tại các trạm cấp nước — đơn vị tính: m3)", PhuDeNghieng);
            s.Dat(7, A, "STT", CotK);
            s.Dat(7, B, "Tên đơn vị", CotK);
            s.Dat(7, C, "Nguồn\nnước", CotK);
            for (int t = 1; t <= 12; t++) s.Dat(7, T1 + t - 1, "Tháng\n" + t, CotK);
            s.Dat(7, CN, "Cộng năm\n" + nam, CotK);
            s.CaoDong[7] = 36;
            s.LapTu = 7;
            s.LapDen = 7;
            s.CoDinhDong = 7;
            s.CoDinhCot = 2;

            var kq = new Dictionary<int, KetQuaCap1>[13];
            for (int t = 1; t <= 12; t++) if (kys[t] != null) kq[t] = tinh.Tinh(kys[t]);
            Func<int, int, string> cot = (c, r) => XlsxReader.TenCot(c) + r;
            int row = 8, dau = 8;
            var dongDoi = new List<int>();
            for (int iDoi = 0; iDoi < cay.Count; iDoi++)
            {
                NhomDoiCap1 nd = cay[iDoi];
                int rDoi = row++;
                var dongTram = new List<int>();
                var doiT = new double[13];
                for (int iTram = 0; iTram < nd.Tram.Count; iTram++)
                {
                    NhomTramCap1 nt = nd.Tram[iTram];
                    int rTram = row++, a = row;
                    var tramT = new double[13];
                    var coT = new bool[13];
                    for (int iDh = 0; iDh < nt.DongHo.Count; iDh++)
                    {
                        DongHoCap1 dh = nt.DongHo[iDh];
                        int r = row++;
                        s.Dat(r, A, (iTram + 1) + "." + (iDh + 1), SttK);
                        s.Dat(r, B, dh.Ten, TenK);
                        s.Dat(r, C, DuLieuCap1.TenNguon(dh.Nguon), NguonK);
                        double cong = 0;
                        for (int t = 1; t <= 12; t++)
                        {
                            KetQuaCap1 rk;
                            double? v = kq[t] != null && kq[t].TryGetValue(dh.Id, out rk) ? rk.SanLuong : null;
                            s.Dat(r, T1 + t - 1, v, KieuSo(v, SoK));
                            if (v.HasValue) { cong += v.Value; tramT[t] += v.Value; coT[t] = true; }
                        }
                        s.CongThuc(r, CN, "SUM(" + cot(T1, r) + ":" + cot(T1 + 11, r) + ")", cong, KieuSo(cong, Dam(SoK, null)));
                        s.CaoDong[r] = SoDongChu(dh.Ten, 42 * 0.85) * 16.5 + 3;
                    }
                    int b = row - 1;
                    s.Dat(rTram, A, (iTram + 1).ToString(), Dam(SttK, NenTram));
                    s.Dat(rTram, B, nt.Tram.Ten, Dam(TenK, NenTram));
                    s.Dat(rTram, C, null, Dam(NguonK, NenTram));
                    for (int t = 1; t <= 12; t++)
                    {
                        int c = T1 + t - 1;
                        if (coT[t]) s.CongThuc(rTram, c, "SUM(" + cot(c, a) + ":" + cot(c, b) + ")", tramT[t], KieuSo(tramT[t], Dam(SoK, NenTram)));
                        else s.Dat(rTram, c, null, Dam(SoK, NenTram));
                        doiT[t] += tramT[t];
                    }
                    s.CongThuc(rTram, CN, "SUM(" + cot(T1, rTram) + ":" + cot(T1 + 11, rTram) + ")", tramT.Sum(), KieuSo(tramT.Sum(), Dam(SoK, NenTram)));
                    s.CaoDong[rTram] = SoDongChu(nt.Tram.Ten, 42 * 0.75) * 16.5 + 3;
                    dongTram.Add(rTram);
                }
                s.Dat(rDoi, A, So.LaMa(iDoi + 1), Dam(SttK, NenDoi));
                s.Dat(rDoi, B, Hoa(nd.Doi.Ten), Dam(TenK, NenDoi));
                s.Dat(rDoi, C, null, Dam(NguonK, NenDoi));
                for (int t = 1; t <= 12; t++)
                {
                    int c = T1 + t - 1;
                    if (kys[t] != null) s.CongThuc(rDoi, c, string.Join("+", dongTram.Select(x => cot(c, x))), doiT[t], KieuSo(doiT[t], Dam(SoK, NenDoi)));
                    else s.Dat(rDoi, c, null, Dam(SoK, NenDoi));
                }
                s.CongThuc(rDoi, CN, "SUM(" + cot(T1, rDoi) + ":" + cot(T1 + 11, rDoi) + ")", doiT.Sum(), KieuSo(doiT.Sum(), Dam(SoK, NenDoi)));
                s.CaoDong[rDoi] = 21;
                dongDoi.Add(rDoi);
            }
            int cuoi = row - 1;
            var tongT = new double[13];
            var gieng = new double[13];
            var mat = new double[13];
            foreach (NhomDoiCap1 nd in cay)
                foreach (NhomTramCap1 nt in nd.Tram)
                    foreach (DongHoCap1 dh in nt.DongHo)
                        for (int t = 1; t <= 12; t++)
                        {
                            KetQuaCap1 rk;
                            if (kq[t] == null || !kq[t].TryGetValue(dh.Id, out rk) || !rk.SanLuong.HasValue) continue;
                            tongT[t] += rk.SanLuong.Value;
                            (dh.Nguon == NguonNuoc.Gieng ? gieng : mat)[t] += rk.SanLuong.Value;
                        }
            if (dongDoi.Count > 1)
            {
                int r = row++;
                s.Dat(r, A, null, Dam(SttK, NenTong));
                s.Dat(r, B, "TỔNG CỘNG (" + string.Join(" + ", Enumerable.Range(1, dongDoi.Count).Select(So.LaMa)) + ")", Dam(TenK, NenTong));
                s.Dat(r, C, null, Dam(NguonK, NenTong));
                for (int t = 1; t <= 12; t++)
                {
                    int c = T1 + t - 1;
                    if (kys[t] != null) s.CongThuc(r, c, string.Join("+", dongDoi.Select(x => cot(c, x))), tongT[t], KieuSo(tongT[t], Dam(SoK, NenTong)));
                    else s.Dat(r, c, null, Dam(SoK, NenTong));
                }
                s.CongThuc(r, CN, "SUM(" + cot(T1, r) + ":" + cot(T1 + 11, r) + ")", tongT.Sum(), KieuSo(tongT.Sum(), Dam(SoK, NenTong)));
                s.CaoDong[r] = 21;
            }
            foreach (NguonNuoc n in new[] { NguonNuoc.Gieng, NguonNuoc.NuocMat })
            {
                double[] v = n == NguonNuoc.Gieng ? gieng : mat;
                string ten = DuLieuCap1.TenNguon(n);
                int r = row++;
                s.Dat(r, A, null, SttK);
                s.Dat(r, B, n == NguonNuoc.Gieng ? "Trong đó: - Nước giếng (nước ngầm)" : "               - Nước mặt", Nghieng(TenK));
                s.Dat(r, C, ten, NguonK);
                for (int t = 1; t <= 12; t++)
                {
                    int c = T1 + t - 1;
                    string col = XlsxReader.TenCot(c);
                    if (kys[t] != null)
                        s.CongThuc(r, c, "SUMIF($C$" + dau + ":$C$" + cuoi + ",\"" + ten + "\"," + col + "$" + dau + ":" + col + "$" + cuoi + ")", v[t], KieuSo(v[t], Nghieng(SoK)));
                    else s.Dat(r, c, null, SoK);
                }
                s.CongThuc(r, CN, "SUM(" + cot(T1, r) + ":" + cot(T1 + 11, r) + ")", v.Sum(), KieuSo(v.Sum(), Nghieng(SoK)));
                s.CaoDong[r] = 19;
            }
            row++;
            PhanKy(s, row, new[] { new[] { A, B }, new[] { C, 9 }, new[] { 10, CN } }, null);
            return so;
        }
    }
}
