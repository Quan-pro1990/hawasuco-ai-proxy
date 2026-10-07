using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Dựng các mẫu báo cáo Excel giống file báo cáo thất thoát của công ty: báo cáo tháng,
    /// quý, bảng tổng hợp năm, bảng tóm tắt, gộp nhiều tháng, kế hoạch năm, sổ cả năm.
    /// Ô tính toán ghi kèm công thức nên sửa số trong Excel vẫn tự tính lại.
    /// </summary>
    public class BaoCao
    {
        const int A = 1, B = 2, C = 3, D = 4, E = 5, F = 6, G = 7, H = 8, I = 9, J = 10, K = 11, L = 12, M = 13, N = 14;
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
        static readonly CultureInfo VnUpper = CultureInfo.GetCultureInfo("vi-VN");

        readonly DuLieu data;
        readonly BoTinh bt;

        public BaoCao(DuLieu data, BoTinh bt)
        {
            this.data = data;
            this.bt = bt;
        }

        // ------------------------------------------------------------------ kiểu ô

        static readonly XKieu Thuong = new XKieu();
        static readonly XKieu CtyK = new XKieu { Dam = true, Co = 13, Ngang = "center" };
        static readonly XKieu CtyGach = new XKieu { Dam = true, Co = 13, Ngang = "center", GachChan = true };
        static readonly XKieu TieuDeK = new XKieu { Dam = true, Co = 16, Ngang = "center", XuongDong = true };
        static readonly XKieu PhuDeK = new XKieu { Dam = true, Co = 13, Ngang = "center" };
        static readonly XKieu PhuDeNghieng = new XKieu { Nghieng = true, Co = 13, Ngang = "center" };
        static readonly XKieu CotK = new XKieu { Dam = true, Co = 12, Ngang = "center", XuongDong = true, Khung = true, Nen = "FFE8EEF5" };
        static readonly XKieu SttK = new XKieu { Khung = true, Ngang = "center" };
        static readonly XKieu TenK = new XKieu { Khung = true, Ngang = "left", XuongDong = true };
        static readonly XKieu SoK = new XKieu { Khung = true, Ngang = "right", DinhDang = "#,##0" };
        static readonly XKieu SoLeK = new XKieu { Khung = true, Ngang = "right", DinhDang = "#,##0.00" };
        static readonly XKieu PtK = new XKieu { Khung = true, Ngang = "right", DinhDang = "0.00" };
        static readonly XKieu MoTaK = new XKieu { Khung = true, Ngang = "center", Nghieng = true, Co = 11, XuongDong = true };
        static readonly XKieu GhiChuO = new XKieu { Khung = true, Ngang = "left", Nghieng = true, Co = 11, XuongDong = true };
        static readonly XKieu TrongK = new XKieu { Khung = true };
        static readonly XKieu GhiChuK = new XKieu { Ngang = "left", Doc = "top", XuongDong = true, Co = 12 };
        static readonly XKieu NgayK = new XKieu { Nghieng = true, Co = 13, Ngang = "center" };
        static readonly XKieu KyK = new XKieu { Dam = true, Co = 13, Ngang = "center", XuongDong = true };
        static readonly XKieu TinhTrangK = new XKieu { Khung = true, Ngang = "center", Nghieng = true, Co = 10, XuongDong = true };

        static XKieu Dam(XKieu k) { return k.Voi(x => x.Dam = true); }
        static XKieu DamNghieng(XKieu k) { return k.Voi(x => { x.Dam = true; x.Nghieng = true; }); }

        static XKieu KieuDong(Muc m, XKieu k)
        {
            if (m.Cap == 0) return Dam(k);
            if (m.VaiTro == VaiTro.KhuVuc || m.VaiTro == VaiTro.Dma) return DamNghieng(k);
            return k;
        }

        static XKieu KieuSo(double? v, XKieu baseKieu)
        {
            bool le = v.HasValue && Math.Abs(v.Value - Math.Round(v.Value)) > 0.0000001;
            return le ? baseKieu.Voi(x => x.DinhDang = "#,##0.00") : baseKieu;
        }

        static string Hs(double v)
        {
            return v.ToString("R", Inv);
        }

        static string Cong(double v)
        {
            return v < 0 ? "-" + Hs(-v) : "+" + Hs(v);
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

        string NgayLapChu(DateTime? d)
        {
            DateTime x = d ?? DateTime.Today;
            string dia = string.IsNullOrWhiteSpace(data.CaiDat.DiaDanh) ? "" : data.CaiDat.DiaDanh.Trim() + ", ";
            return dia + So.NgayChu(x);
        }

        void DauTrang(XTrang s, int lastCol, int splitCol)
        {
            s.GopO(1, 1, 1, splitCol - 2, data.CaiDat.TenCongTy1, CtyK);
            s.GopO(2, 1, 2, splitCol - 2, data.CaiDat.TenCongTy2, CtyGach);
            s.GopO(1, splitCol, 1, lastCol, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", CtyK);
            s.GopO(2, splitCol, 2, lastCol, "Độc lập - Tự do - Hạnh phúc", CtyGach);
            s.CaoDong[1] = 18;
            s.CaoDong[2] = 18;
        }

        /// <summary>Ngày lập + 3 khối ký (trái, giữa, phải). Trả dòng kế tiếp.</summary>
        int PhanKy(XTrang s, int row, NguoiKy[] ky, int[][] cot, DateTime? ngay)
        {
            s.GopO(row, cot[2][0], row, cot[2][1], NgayLapChu(ngay), NgayK);
            row++;
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

        static string ChuoiThoiGian(DateTime? tu, DateTime? den)
        {
            if (!tu.HasValue || !den.HasValue) return "";
            return "(Nước tiêu thụ từ " + So.NgayChu(tu.Value) + " đến " + So.NgayChu(den.Value) + ")";
        }

        // ------------------------------------------------------------------ báo cáo tháng

        /// <summary>Ghi chú trang tháng trước để tham chiếu công thức (sổ cả năm).</summary>
        public class ThamChieuThang
        {
            public string TenTrang;
            public ThangBaoCao Thang;
            public Dictionary<int, int> DongTheoId = new Dictionary<int, int>();
        }

        public XSo SoThang(ThangBaoCao t)
        {
            var so = new XSo();
            TrangThang(so, t, null);
            return so;
        }

        public ThamChieuThang TrangThang(XSo so, ThangBaoCao t, ThamChieuThang truoc)
        {
            XTrang s = so.Them(t.TenTrang);
            var tc = new ThamChieuThang { TenTrang = s.Ten, Thang = t };
            KetQuaThang kq = bt.Tinh(t);
            double[] w = { 0, 7, 62, 14, 14, 13.5, 13.5, 9.5, 10, 10, 10, 14.5, 14.5, 9.5, 10 };
            for (int c = 1; c <= N; c++) s.RongCot[c] = w[c];
            DauTrang(s, N, E);
            s.GopO(4, A, 4, N, "BÁO CÁO TỶ LỆ THẤT THOÁT NƯỚC THÁNG " + t.Thang + " NĂM " + t.Nam, TieuDeK);
            s.CaoDong[4] = 24;
            s.GopO(5, A, 5, N, string.IsNullOrWhiteSpace(t.KyHoaDon) ? "" : "(HÓA ĐƠN KỲ " + t.KyHoaDon + ")", PhuDeK);
            s.GopO(6, A, 6, N, ChuoiThoiGian(t.TuNgay, t.DenNgay), PhuDeNghieng);

            s.GopO(8, A, 9, A, "STT", CotK);
            s.GopO(8, B, 9, B, "Tên đơn vị", CotK);
            s.GopO(8, C, 9, C, "Chỉ số TLK\ntháng trước\n(m3)", CotK);
            s.GopO(8, D, 9, D, "Chỉ số TLK\nhiện tại\n(m3)", CotK);
            s.GopO(8, E, 9, E, "Sản lượng\nphát ra\n(m3)", CotK);
            s.GopO(8, F, 9, F, "Chuẩn thu\n(m3)", CotK);
            s.GopO(8, G, 8, J, "Thực hiện trong tháng báo cáo", CotK);
            s.GopO(8, K, 8, N, "Luỹ kế đến tháng " + t.Thang + " năm " + t.Nam, CotK);
            string[] sub = { "Thất thoát\n(%)", "So với\ntháng trước", "So\nKế hoạch\nnăm " + t.Nam, "So\ncùng kỳ\nnăm trước",
                             "Phát ra\n(m3)", "Chuẩn thu\n(m3)", "Thất thoát\n(%)", "So\ncùng kỳ\nnăm trước" };
            for (int i = 0; i < sub.Length; i++) s.Dat(9, G + i, sub[i], CotK);
            s.CaoDong[8] = 24;
            s.CaoDong[9] = 52;
            s.LapTu = 8;
            s.LapDen = 9;
            s.CoDinhDong = 9;

            var hien = t.Muc.Where(m => !m.AnBaoCaoThang).ToList();
            int row = 10;
            foreach (Muc m in hien) tc.DongTheoId[m.Id] = row++;
            bool cungNam = truoc != null && truoc.Thang.Nam == t.Nam && truoc.Thang.SoThu == t.SoThu - 1;
            KetQuaThang kqTruoc = truoc != null && truoc.Thang.SoThu == t.SoThu - 1 ? bt.Tinh(truoc.Thang) : null;
            var ghiChuThem = new List<string>();

            foreach (Muc m in hien)
            {
                int r = tc.DongTheoId[m.Id];
                KetQua k = kq[m.Id];
                s.Dat(r, A, m.Stt, KieuDong(m, SttK));
                s.Dat(r, B, m.Ten.Replace("\r", ""), KieuDong(m, TenK));
                s.CaoDong[r] = Math.Max(SoDongChu(m.Ten, w[B]), 1) * 16.5 + 3;

                // C, D: chỉ số hoặc mô tả công thức
                if (m.Loai == LoaiMuc.CongThuc)
                {
                    string moTa = m.MoTa ?? CongThucText.HienThi(t, m, m.CongThuc);
                    s.GopO(r, C, r, D, moTa, MoTaK);
                    s.CaoDong[r] = Math.Max(s.CaoDong[r], SoDongChu(moTa, (w[C] + w[D]) * 0.95) * 15 + 3);
                }
                else
                {
                    s.Dat(r, C, m.ChiSoCu, KieuSo(m.ChiSoCu, SoK));
                    s.Dat(r, D, m.ChiSoMoi, KieuSo(m.ChiSoMoi, SoK));
                }

                // E: sản lượng
                XKieu kE = KieuDong(m, KieuSo(k.PhatRa, SoK));
                string fE = CongThucE(t, m, k, r, tc);
                if (!k.PhatRa.HasValue) s.Dat(r, E, null, kE);
                else if (fE != null) s.CongThuc(r, E, fE, k.PhatRa.Value, kE);
                else s.Dat(r, E, k.PhatRa.Value, kE);

                // F..J
                string note = m.GhiChu ?? "";
                if (m.ThayDongHo && m.ChotCu.HasValue && m.DauMoi.HasValue)
                    note = (note.Length > 0 ? note + "\n" : "") + "Thay đồng hồ: chốt ĐH cũ " + So.N0(m.ChotCu) + ", đầu ĐH mới " + So.N0(m.DauMoi);
                if (m.CoChuanThu)
                {
                    XKieu kF = KieuDong(m, KieuSo(k.ChuanThu, SoK));
                    if (!k.ChuanThu.HasValue) s.Dat(r, F, null, kF);
                    else if (m.ChuanThuLoai == LoaiChuanThu.CongThuc)
                    {
                        string fF = TongTham(t, m, m.CongThucChuanThu, F, tc, true);
                        if (fF != null) s.CongThuc(r, F, fF, k.ChuanThu.Value, kF);
                        else s.Dat(r, F, k.ChuanThu.Value, kF);
                    }
                    else s.Dat(r, F, k.ChuanThu.Value, kF);
                    XKieu kP = KieuDong(m, PtK);
                    string g = "G" + r;
                    O(s, r, G, k.TyLe, "(E" + r + "-F" + r + ")/E" + r + "*100", kP);
                    string fH = null;
                    if (k.SoThangTruoc.HasValue)
                    {
                        int pr;
                        if (k.ThangTruocTuDong && truoc != null && kqTruoc != null && truoc.DongTheoId.TryGetValue(m.Id, out pr))
                            fH = g + "-" + XSo.ThamChieuTrang(truoc.TenTrang) + "G" + pr;
                        else fH = g + "-" + Hs(k.TyLeThangTruoc.Value);
                    }
                    O(s, r, H, k.SoThangTruoc, fH, kP);
                    O(s, r, I, k.SoKeHoach, k.KeHoach.HasValue ? g + "-" + Hs(k.KeHoach.Value) : null, kP);
                    O(s, r, J, k.SoCungKy, k.CungKy.HasValue ? g + "-" + Hs(k.CungKy.Value) : null, kP);
                    if (note.Length > 0) ghiChuThem.Add("- " + m.TenMotDong + ": " + note);
                }
                else if (note.Length > 0)
                {
                    s.GopO(r, F, r, J, note, GhiChuO);
                    s.CaoDong[r] = Math.Max(s.CaoDong[r], SoDongChu(note, 58) * 15 + 3);
                }
                else for (int c = F; c <= J; c++) s.Kieu(r, c, TrongK);

                // K..N: lũy kế
                XKieu kK = KieuDong(m, KieuSo(k.LkPhatRa, SoK));
                double baseK = k.LkPhatRa - (k.PhatRa ?? 0);
                int prK;
                string fK;
                if (cungNam && !m.LuyKePhatRaTruoc.HasValue && truoc.DongTheoId.TryGetValue(m.Id, out prK))
                    fK = "E" + r + "+" + XSo.ThamChieuTrang(truoc.TenTrang) + "K" + prK;
                else fK = Math.Abs(baseK) < 1e-9 ? "E" + r : "E" + r + Cong(baseK);
                s.CongThuc(r, K, fK, k.LkPhatRa, kK);
                if (m.CoChuanThu && k.LkChuanThu.HasValue)
                {
                    XKieu kL = KieuDong(m, KieuSo(k.LkChuanThu, SoK));
                    double baseL = k.LkChuanThu.Value - (k.ChuanThu ?? 0);
                    string fL;
                    if (cungNam && !m.LuyKeChuanThuTruoc.HasValue && truoc.DongTheoId.TryGetValue(m.Id, out prK))
                        fL = "F" + r + "+" + XSo.ThamChieuTrang(truoc.TenTrang) + "L" + prK;
                    else fL = Math.Abs(baseL) < 1e-9 ? "F" + r : "F" + r + Cong(baseL);
                    s.CongThuc(r, L, fL, k.LkChuanThu.Value, kL);
                    XKieu kP = KieuDong(m, PtK);
                    O(s, r, M, k.LkTyLe, "(K" + r + "-L" + r + ")/K" + r + "*100", kP);
                    O(s, r, N, k.LkSoCungKy, k.LkCungKy.HasValue ? "M" + r + "-" + Hs(k.LkCungKy.Value) : null, kP);
                }
                else for (int c = L; c <= N; c++) s.Kieu(r, c, TrongK);
            }

            row = 10 + hien.Count;
            string ghiChu = (t.GhiChu ?? "").Replace("\r", "").Trim('\n');
            if (ghiChuThem.Count > 0) ghiChu = (ghiChu.Length > 0 ? ghiChu + "\n" : "") + string.Join("\n", ghiChuThem);
            string ghiChuDu = "* Ghi chú: " + (ghiChu.Length > 0 ? "\n" + ghiChu : "");
            s.GopO(row, A, row, N, ghiChuDu, GhiChuK);
            s.CaoDong[row] = Math.Min(409, SoDongChu(ghiChuDu, w.Skip(1).Sum()) * 16.5 + 6);
            row += 1;
            PhanKy(s, row, t.Ky, new[] { new[] { A, B }, new[] { C, I }, new[] { J, N } }, t.NgayLap);
            return tc;
        }

        static void O(XTrang s, int r, int c, double? v, string f, XKieu k)
        {
            if (!v.HasValue) s.Dat(r, c, null, k);
            else if (f != null) s.CongThuc(r, c, f, v.Value, k);
            else s.Dat(r, c, v.Value, k);
        }

        string CongThucE(ThangBaoCao t, Muc m, KetQua k, int r, ThamChieuThang tc)
        {
            if (m.GhiDe || m.Loai == LoaiMuc.NhapTay) return null;
            string expr;
            if (m.Loai == LoaiMuc.DongHo)
            {
                if (m.ThayDongHo)
                {
                    if (!m.ChotCu.HasValue || !m.DauMoi.HasValue) return null;
                    expr = "(" + Hs(m.ChotCu.Value) + "-C" + r + ")+(D" + r + "-" + Hs(m.DauMoi.Value) + ")";
                }
                else expr = "D" + r + "-C" + r;
                if (m.SaiSo != 0) expr = "(" + expr + ")*100/(100" + Cong(m.SaiSo) + ")";
            }
            else
            {
                expr = TongTham(t, m, m.CongThuc, E, tc, false);
                if (expr == null) return null;
            }
            if (m.DieuChinh != 0) expr = "(" + expr + ")" + Cong(m.DieuChinh);
            if (m.LamTron) expr = "ROUND(" + expr + ",0)";
            return expr;
        }

        /// <summary>Công thức cộng trừ theo dòng Excel; dòng không có trong trang thì ghi số.</summary>
        string TongTham(ThangBaoCao t, Muc owner, List<SoHang> terms, int col, ThamChieuThang tc, bool chuanThu)
        {
            if (terms.Count == 0) return null;
            KetQuaThang kq = bt.Tinh(t);
            var parts = new List<string>();
            foreach (SoHang s in terms)
            {
                int row;
                string p;
                double k = Math.Abs(s.HeSo);
                string heSo = Math.Abs(k - 1) < 1e-12 ? "" : Hs(k) + "*";
                if (tc.DongTheoId.TryGetValue(s.Id, out row)) p = heSo + XlsxReader.TenCot(col) + row;
                else
                {
                    KetQua r = kq[s.Id];
                    double v = r == null ? 0 : ((chuanThu ? r.ChuanThu : r.PhatRa) ?? 0);
                    p = Hs(v * k);
                }
                parts.Add((s.HeSo < 0 ? "-" : "+") + p);
            }
            string expr = string.Concat(parts);
            return expr.StartsWith("+") ? expr.Substring(1) : expr;
        }

        // ------------------------------------------------------------------ báo cáo quý

        public static string TenQuy(int quy) { return "Quý " + quy; }

        public XSo SoQuy(int nam, int quy)
        {
            var so = new XSo();
            TrangQuy(so, nam, quy);
            return so;
        }

        public void TrangQuy(XSo so, int nam, int quy)
        {
            List<ThangBaoCao> thang = bt.ThangCuaQuy(nam, quy);
            if (thang.Count == 0) throw new InvalidOperationException("Quý " + quy + "/" + nam + " chưa có tháng nào");
            List<KetQuaGop> rows = bt.TinhQuy(nam, quy);
            ThangBaoCao cuoi = thang[thang.Count - 1];
            XTrang s = so.Them("Quý " + quy + "-" + nam);
            double[] w = { 0, 7, 70, 15, 14, 12, 12, 12, 12 };
            for (int c = 1; c <= H; c++) s.RongCot[c] = w[c];
            DauTrang(s, H, C);
            s.GopO(4, A, 4, H, "BÁO CÁO TỶ LỆ THẤT THOÁT NƯỚC", TieuDeK);
            s.GopO(5, A, 5, H, "QUÝ " + So.LaMa(quy) + " NĂM " + nam + (thang.Count < 3 ? " (mới có " + thang.Count + " tháng)" : ""), PhuDeK);
            s.GopO(6, A, 6, H, ChuoiThoiGian(thang[0].TuNgay, cuoi.DenNgay), PhuDeNghieng);
            s.CaoDong[4] = 22;
            s.GopO(8, A, 9, A, "STT", CotK);
            s.GopO(8, B, 9, B, "Tên đơn vị", CotK);
            s.GopO(8, C, 9, C, "Sản lượng\nphát ra\n(m3)", CotK);
            s.GopO(8, D, 9, D, "Chuẩn thu\n(m3)", CotK);
            s.GopO(8, E, 8, H, "Tỷ lệ thất thoát nước trong Quý (%)", CotK);
            string[] sub = { "Thực hiện", "So với\nquý trước", "So với\ncùng kỳ\nnăm trước", "So với\nkế hoạch\nnăm " + nam };
            for (int i = 0; i < 4; i++) s.Dat(9, E + i, sub[i], CotK);
            s.CaoDong[8] = 22;
            s.CaoDong[9] = 52;
            s.LapTu = 8;
            s.LapDen = 9;
            s.CoDinhDong = 9;
            int r = 10;
            foreach (KetQuaGop g in rows)
            {
                Muc m = g.Muc;
                if (m.AnBaoCaoThang) continue;
                s.Dat(r, A, m.Stt, KieuDong(m, SttK));
                s.Dat(r, B, m.Ten.Replace("\r", ""), KieuDong(m, TenK));
                s.CaoDong[r] = SoDongChu(m.Ten, w[B]) * 16.5 + 3;
                s.Dat(r, C, g.PhatRa, KieuDong(m, KieuSo(g.PhatRa, SoK)));
                if (m.CoChuanThu)
                {
                    s.Dat(r, D, g.ChuanThu, KieuDong(m, KieuSo(g.ChuanThu, SoK)));
                    XKieu kP = KieuDong(m, PtK);
                    O(s, r, E, g.TyLe, g.ChuanThu.HasValue && g.PhatRa != 0 ? "(C" + r + "-D" + r + ")/C" + r + "*100" : null, kP);
                    O(s, r, F, g.SoSanhTruoc, null, kP);
                    O(s, r, G, g.SoCungKy, g.CungKy.HasValue ? "E" + r + "-" + Hs(g.CungKy.Value) : null, kP);
                    O(s, r, H, g.SoKeHoach, g.KeHoach.HasValue ? "E" + r + "-" + Hs(g.KeHoach.Value) : null, kP);
                }
                else for (int c = D; c <= H; c++) s.Kieu(r, c, TrongK);
                r++;
            }
            r++;
            PhanKy(s, r, cuoi.Ky, new[] { new[] { A, B }, new[] { C, E }, new[] { F, H } }, cuoi.NgayLap);
        }

        // ------------------------------------------------------------------ tổng hợp năm

        public XSo SoTongHopNam(int nam)
        {
            var so = new XSo();
            TrangTongHopNam(so, nam);
            return so;
        }

        public ThangBaoCao ThangCuoiCuaNam(int nam)
        {
            return data.Thang.Where(t => t.Nam == nam).OrderBy(t => t.Thang).LastOrDefault();
        }

        public void TrangTongHopNam(XSo so, int nam)
        {
            ThangBaoCao cuoi = ThangCuoiCuaNam(nam);
            if (cuoi == null) throw new InvalidOperationException("Năm " + nam + " chưa có số liệu");
            KetQuaThang kqCuoi = bt.Tinh(cuoi);
            var kqThang = new KetQuaThang[13];
            for (int th = 1; th <= 12; th++)
            {
                ThangBaoCao t = data.TimThang(nam, th);
                if (t != null) kqThang[th] = bt.Tinh(t);
            }
            XTrang s = so.Them("TỔNG HỢP " + nam);
            s.RongCot[A] = 6;
            s.RongCot[B] = 34;
            for (int c = C; c <= N; c++) s.RongCot[c] = 10.5;
            s.RongCot[15] = 14; s.RongCot[16] = 14; s.RongCot[17] = 13; s.RongCot[18] = 9.5; s.RongCot[19] = 9.5; s.RongCot[20] = 9.5; s.RongCot[21] = 10.5;
            s.GopO(1, A, 1, E, data.CaiDat.TenCongTy1, CtyK);
            s.GopO(2, A, 2, E, data.CaiDat.TenCongTy2, CtyGach);
            s.GopO(3, A, 3, 21, "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC NĂM " + nam, TieuDeK);
            s.CaoDong[3] = 26;
            s.GopO(5, A, 6, A, "STT", CotK);
            s.GopO(5, B, 6, B, "Tên đơn vị", CotK);
            s.GopO(5, C, 5, N, "Tỷ lệ thất thoát từng tháng năm " + nam, CotK);
            for (int th = 1; th <= 12; th++)
            {
                ThangBaoCao t = data.TimThang(nam, th);
                string ky = t != null && !string.IsNullOrWhiteSpace(t.KyHoaDon) ? t.KyHoaDon : ThangBaoCao.KyMacDinh(nam, th);
                string kyChu = ky.EndsWith("/" + nam) ? ky.Substring(0, ky.Length - nam.ToString().Length - 1) : ky.Replace("/", " năm ");
                s.Dat(6, C + th - 1, "Tháng " + th + "\n(HĐ Kỳ " + kyChu + ")", CotK);
            }
            s.GopO(5, 15, 5, 20, "Luỹ kế đến tháng " + cuoi.Thang + " năm " + nam, CotK);
            string[] lk = { "Tổng nước\nphát ra", "Tổng nước\nchuẩn thu", "Nước\nthất thoát", "Tỷ lệ TT\n%", "So với\ncùng kỳ", "So KH\n" + nam };
            for (int i = 0; i < lk.Length; i++) s.Dat(6, 15 + i, lk[i], CotK);
            s.GopO(5, 21, 6, 21, "Kế hoạch\nnăm " + nam, CotK);
            s.CaoDong[5] = 22;
            s.CaoDong[6] = 50;
            s.LapTu = 5;
            s.LapDen = 6;
            s.CoDinhDong = 6;
            s.CoDinhCot = 2;

            int r = 7, sttDma = 0;
            Muc toan = null;
            foreach (Muc m in bt.DongTongHopNam(nam))
            {
                if (m.VaiTro == VaiTro.ToanCongTy) toan = m;
                bool dam = m.VaiTro == VaiTro.Doi || m.VaiTro == VaiTro.ToanCongTy;
                bool dma = m.VaiTro == VaiTro.Dma;
                sttDma = dma ? sttDma + 1 : 0;
                XKieu st = dam ? Dam(SttK) : SttK, tn = dam ? Dam(TenK) : TenK, pt = dam ? Dam(PtK) : PtK, so0 = dam ? Dam(SoK) : SoK;
                s.Dat(r, A, dma ? sttDma.ToString() : m.Stt, st);
                s.Dat(r, B, m.VaiTro == VaiTro.Doi || m.VaiTro == VaiTro.ToanCongTy ? m.TenTongHop.ToUpper(VnUpper) : m.TenTongHop, tn);
                bool coChu = false;
                for (int th = 1; th <= 12; th++)
                {
                    KetQua k = kqThang[th] != null ? kqThang[th][m.Id] : null;
                    string tinhTrang = dma && k != null && !k.TyLe.HasValue ? BoTinh.TinhTrangDma(kqThang[th].Thang.Tim(m.Id)) : "";
                    if (tinhTrang.Length > 0)
                    {
                        s.Dat(r, C + th - 1, tinhTrang, TinhTrangK);
                        coChu = true;
                    }
                    else s.Dat(r, C + th - 1, k != null ? k.TyLe : null, pt);
                }
                // Lũy kế: tháng cuối năm; vùng DMA đã bỏ thì lấy tháng cuối cùng còn vùng đó.
                KetQua kc = kqCuoi[m.Id];
                for (int th = 12; kc == null && th >= 1; th--) if (kqThang[th] != null) kc = kqThang[th][m.Id];
                double? kh = data.LayKeHoach(nam, m.Id);
                if (kc != null && m.CoChuanThu)
                {
                    s.Dat(r, 15, kc.LkPhatRa, KieuSo(kc.LkPhatRa, so0));
                    s.Dat(r, 16, kc.LkChuanThu, KieuSo(kc.LkChuanThu, so0));
                    double? q = kc.LkChuanThu.HasValue ? kc.LkPhatRa - kc.LkChuanThu.Value : (double?)null;
                    O(s, r, 17, q, "O" + r + "-P" + r, KieuSo(q, so0));
                    O(s, r, 18, kc.LkTyLe, "Q" + r + "/O" + r + "*100", pt);
                    O(s, r, 19, kc.LkSoCungKy, kc.LkCungKy.HasValue ? "R" + r + "-" + Hs(kc.LkCungKy.Value) : null, pt);
                    O(s, r, 20, kc.LkTyLe.HasValue && kh.HasValue ? kc.LkTyLe - kh : null, kh.HasValue ? "R" + r + "-U" + r : null, pt);
                }
                else for (int c = 15; c <= 20; c++) s.Kieu(r, c, TrongK);
                s.Dat(r, 21, kh, pt);
                s.CaoDong[r] = Math.Max(SoDongChu(m.TenTongHop, 34), coChu ? 2 : 1) * 16.5 + 3;
                r++;
            }
            if (toan != null)
            {
                string[] nhan = { "So tháng trước", "So KH " + nam, "So cùng kỳ" };
                for (int i = 0; i < 3; i++)
                {
                    s.Dat(r, A, "", SttK);
                    s.Dat(r, B, nhan[i], DamNghieng(TenK));
                    for (int th = 1; th <= 12; th++)
                    {
                        KetQua k = kqThang[th] != null ? kqThang[th][toan.Id] : null;
                        double? v = k == null ? null : (i == 0 ? k.SoThangTruoc : i == 1 ? k.SoKeHoach : k.SoCungKy);
                        s.Dat(r, C + th - 1, v, PtK);
                    }
                    for (int c = 15; c <= 21; c++) s.Kieu(r, c, TrongK);
                    r++;
                }
            }
            r++;
            PhanKy(s, r, cuoi.Ky, new[] { new[] { A, C }, new[] { D, 16 }, new[] { 17, 21 } }, cuoi.NgayLap);
        }

        // ------------------------------------------------------------------ bảng tóm tắt

        public XSo SoTomTat(ThangBaoCao t)
        {
            var so = new XSo();
            TrangTomTat(so, t);
            return so;
        }

        public void TrangTomTat(XSo so, ThangBaoCao t)
        {
            KetQuaThang kq = bt.Tinh(t);
            XTrang s = so.Them("TÓM TẮT T" + t.Thang + "-" + t.Nam);
            s.Ngang = false;
            s.RongCot[A] = 7; s.RongCot[B] = 36; s.RongCot[C] = 22; s.RongCot[D] = 26;
            s.GopO(1, A, 1, D, "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC THÁNG " + t.Thang + "/" + t.Nam, TieuDeK);
            s.CaoDong[1] = 24;
            s.Dat(3, A, "STT", CotK);
            s.Dat(3, B, "Tên đơn vị", CotK);
            s.Dat(3, C, "Tỷ lệ thất\nthoát nước tháng " + t.Thang + "/" + t.Nam + " (%)", CotK);
            s.Dat(3, D, "Luỹ kế tỷ lệ thất thoát nước\nđến tháng " + t.Thang + "/" + t.Nam, CotK);
            s.CaoDong[3] = 48;
            int r = 4, doi = 0;
            foreach (Muc m in bt.DongTongHop(t))
            {
                if (m.VaiTro == VaiTro.Dma) continue;
                KetQua k = kq[m.Id];
                bool dam = m.VaiTro != VaiTro.KhuVuc;
                string stt = m.VaiTro == VaiTro.Doi ? (++doi).ToString() : "";
                s.Dat(r, A, stt, dam ? Dam(SttK) : SttK);
                s.Dat(r, B, m.TenTongHop, dam ? Dam(TenK) : TenK);
                s.Dat(r, C, k.TyLe, dam ? Dam(PtK) : PtK);
                s.Dat(r, D, k.LkTyLe, dam ? Dam(PtK) : PtK);
                s.CaoDong[r] = 20;
                r++;
            }
        }

        // ------------------------------------------------------------------ gộp nhiều tháng

        public XSo SoGop(List<ThangBaoCao> thang)
        {
            var so = new XSo();
            TrangGop(so, thang);
            return so;
        }

        public void TrangGop(XSo so, List<ThangBaoCao> thang)
        {
            if (thang.Count == 0) throw new InvalidOperationException("Chưa chọn tháng");
            List<KetQuaGop> rows = bt.Gop(thang);
            string ten = string.Join(" + ", thang.Select(t => "T" + t.Thang));
            XTrang s = so.Them("Gộp " + ten);
            int nT = thang.Count;
            int cTong = C + nT, cCt = cTong + 1, cTl = cTong + 2;
            s.RongCot[A] = 7; s.RongCot[B] = 30;
            for (int i = 0; i < nT; i++) s.RongCot[C + i] = 14;
            s.RongCot[cTong] = 15; s.RongCot[cCt] = 16; s.RongCot[cTl] = 12;
            s.GopO(1, A, 1, B, data.CaiDat.TenCongTy1, CtyK);
            s.GopO(2, A, 2, B, data.CaiDat.TenCongTy2, CtyGach);
            bool cungNam = thang.All(t => t.Nam == thang[0].Nam);
            string tieuDe = "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC TOÀN CÔNG TY\n" +
                            string.Join(" + ", thang.Select(t => "THÁNG " + t.Thang + (cungNam ? "" : "/" + t.Nam))) + (cungNam ? " NĂM " + thang[0].Nam : "");
            s.GopO(4, A, 4, cTl, tieuDe, TieuDeK);
            s.CaoDong[4] = 44;
            s.Dat(6, A, "STT", CotK);
            s.Dat(6, B, "Đơn vị", CotK);
            for (int i = 0; i < nT; i++) s.Dat(6, C + i, "Sản lượng\nphát ra\ntháng " + thang[i].Thang + "\n(m3)", CotK);
            s.Dat(6, cTong, "Tổng\nsản lượng\n(m3)", CotK);
            s.Dat(6, cCt, "Tổng sản lượng\nchuẩn thu\n(m3)", CotK);
            s.Dat(6, cTl, "Tỷ lệ\nthất thoát\n(%)", CotK);
            s.CaoDong[6] = 68;
            int r = 7, doi = 0, kv = 0;
            foreach (KetQuaGop g in rows)
            {
                Muc m = g.Muc;
                if (m.VaiTro == VaiTro.Khac || m.VaiTro == VaiTro.Dma) continue;
                string stt;
                if (m.VaiTro == VaiTro.Doi) { stt = (++doi).ToString(); kv = 0; }
                else if (m.VaiTro == VaiTro.KhuVuc) stt = doi + "." + (++kv);
                else stt = (doi + 1).ToString();
                bool dam = m.VaiTro != VaiTro.KhuVuc;
                XKieu so0 = dam ? Dam(SoK) : SoK;
                s.Dat(r, A, stt, dam ? Dam(SttK) : SttK);
                s.Dat(r, B, m.TenTongHop, dam ? Dam(TenK) : TenK);
                for (int i = 0; i < nT; i++) s.Dat(r, C + i, g.TheoThang[i], KieuSo(g.TheoThang[i], so0));
                string first = XlsxReader.TenCot(C) + r, last = XlsxReader.TenCot(C + nT - 1) + r;
                s.CongThuc(r, cTong, "SUM(" + first + ":" + last + ")", g.PhatRa, KieuSo(g.PhatRa, so0));
                s.Dat(r, cCt, g.ChuanThu, KieuSo(g.ChuanThu, so0));
                string ct = XlsxReader.TenCot(cTong) + r, cc = XlsxReader.TenCot(cCt) + r;
                O(s, r, cTl, g.TyLe, "(" + ct + "-" + cc + ")/" + ct + "*100", dam ? Dam(PtK) : PtK);
                s.CaoDong[r] = 20;
                r++;
            }
        }

        // ------------------------------------------------------------------ kế hoạch năm

        /// <summary>Kế hoạch giao chỉ tiêu + (nếu năm đã có số liệu) tình hình thực hiện kế hoạch.</summary>
        public XSo SoKeHoach(int nam)
        {
            var so = new XSo();
            TrangKeHoach(so, nam);
            if (so.Trang.Count == 0) throw new InvalidOperationException("Chưa có cấu trúc đơn vị để lập kế hoạch năm " + nam + ".");
            TrangThucHienKeHoach(so, nam);
            return so;
        }

        /// <summary>Tháng lấy danh sách đơn vị cho kế hoạch: tháng cuối của năm, hoặc tháng mới nhất trước đó (lập kế hoạch năm sau).</summary>
        ThangBaoCao ThangCauTrucKeHoach(int nam)
        {
            return ThangCuoiCuaNam(nam) ?? data.Thang.Where(t => t.Nam < nam).OrderBy(t => t.SoThu).LastOrDefault();
        }

        List<Muc> DonViKeHoach(ThangBaoCao t, int nam)
        {
            return t.Muc.Where(m => m.CoChuanThu && (m.VaiTro != VaiTro.Dma || data.LayChiTieu(nam, m.Id) != null)).ToList();
        }

        static string SttKeHoach(Muc m, ref int doi)
        {
            if (m.VaiTro == VaiTro.Doi) return (++doi).ToString();
            if (m.VaiTro == VaiTro.ToanCongTy) return "*";
            return "";
        }

        public void TrangKeHoach(XSo so, int nam)
        {
            ThangBaoCao cuoi = ThangCauTrucKeHoach(nam);
            if (cuoi == null) return;
            XTrang s = so.Them("KẾ HOẠCH NĂM " + nam);
            double[] w = { 0, 7, 32, 17, 17, 20, 13, 12, 15 };
            for (int c = A; c <= H; c++) s.RongCot[c] = w[c];
            DauTrang(s, H, D);
            s.GopO(4, A, 4, H, "KẾ HOẠCH GIAO CHỈ TIÊU NĂM " + nam, TieuDeK);
            s.CaoDong[4] = 24;
            string[] heads = { "STT", "Tên đơn vị", "Sản lượng\nphát ra\n(m3)", "Sản lượng\nchuẩn thu\n(m3)", "Doanh thu\ntiền nước\n(đồng)",
                               "Tỷ lệ\nthất thoát\nnước (%)", "Tồn\nhoá đơn\nnước (%)", "Thất thoát\ntháng 12\nnăm " + (nam - 1) + " (%)" };
            for (int i = 0; i < heads.Length; i++) s.Dat(6, A + i, heads[i], CotK);
            s.CaoDong[6] = 54;
            s.LapTu = 6;
            s.LapDen = 6;
            s.CoDinhDong = 6;
            ThangBaoCao dec = data.TimThang(nam - 1, 12);
            KetQuaThang kqDec = dec != null ? bt.Tinh(dec) : null;
            ThangBaoCao jan = data.TimThang(nam, 1);
            int r = 7, doi = 0;
            foreach (Muc m in DonViKeHoach(cuoi, nam))
            {
                bool dam = m.VaiTro != VaiTro.KhuVuc && m.VaiTro != VaiTro.Dma;
                ChiTieu ct = data.LayChiTieu(nam, m.Id) ?? new ChiTieu();
                XKieu so0 = dam ? Dam(SoK) : SoK, pt = dam ? Dam(PtK) : PtK;
                s.Dat(r, A, SttKeHoach(m, ref doi), dam ? Dam(SttK) : SttK);
                s.Dat(r, B, dam ? m.TenTongHop : "+ " + m.TenTongHop, dam ? Dam(TenK) : TenK);
                s.Dat(r, C, ct.PhatRa, KieuSo(ct.PhatRa, so0));
                s.Dat(r, D, ct.ChuanThu, KieuSo(ct.ChuanThu, so0));
                s.Dat(r, E, ct.DoanhThu, so0);
                s.Dat(r, F, ct.TyLe, pt);
                s.Dat(r, G, ct.TonHoaDon, pt);
                double? t12 = null;
                if (kqDec != null && kqDec[m.Id] != null) t12 = kqDec[m.Id].TyLe;
                else if (jan != null && jan.Tim(m.Id) != null) t12 = jan.Tim(m.Id).TyLeThangTruoc;
                s.Dat(r, H, t12, pt);
                s.CaoDong[r] = 20;
                r++;
            }
            r++;
            ThangBaoCao ky = ThangCuoiCuaNam(nam) ?? cuoi;
            PhanKy(s, r, ky.Ky, new[] { new[] { A, B }, new[] { C, E }, new[] { F, H } }, null);
        }

        /// <summary>So thực hiện lũy kế với kế hoạch: % hoàn thành sản lượng phát ra, chuẩn thu; tỷ lệ thất thoát so kế hoạch.</summary>
        public void TrangThucHienKeHoach(XSo so, int nam)
        {
            ThangBaoCao cuoi = ThangCuoiCuaNam(nam);
            if (cuoi == null) return;
            KetQuaThang kq = bt.Tinh(cuoi);
            XTrang s = so.Them("THỰC HIỆN KH " + nam);
            double[] w = { 0, 7, 30, 15, 15, 10, 15, 15, 10, 11, 11, 10 };
            for (int c = A; c <= K; c++) s.RongCot[c] = w[c];
            DauTrang(s, K, D);
            s.GopO(4, A, 4, K, "TÌNH HÌNH THỰC HIỆN KẾ HOẠCH NĂM " + nam, TieuDeK);
            s.GopO(5, A, 5, K, "(Lũy kế đến tháng " + cuoi.Thang + " năm " + nam + ")", PhuDeNghieng);
            s.CaoDong[4] = 24;
            s.GopO(7, A, 8, A, "STT", CotK);
            s.GopO(7, B, 8, B, "Tên đơn vị", CotK);
            s.GopO(7, C, 7, E, "Sản lượng phát ra (m3)", CotK);
            s.GopO(7, F, 7, H, "Sản lượng chuẩn thu (m3)", CotK);
            s.GopO(7, I, 7, K, "Tỷ lệ thất thoát (%)", CotK);
            string[] sub = { "Kế hoạch", "Thực hiện", "% hoàn\nthành", "Kế hoạch", "Thực hiện", "% hoàn\nthành", "Kế hoạch", "Thực hiện", "So\nkế hoạch" };
            for (int i = 0; i < sub.Length; i++) s.Dat(8, C + i, sub[i], CotK);
            s.CaoDong[7] = 22;
            s.CaoDong[8] = 38;
            s.LapTu = 7;
            s.LapDen = 8;
            s.CoDinhDong = 8;
            int r = 9, doi = 0;
            foreach (Muc m in DonViKeHoach(cuoi, nam))
            {
                bool dam = m.VaiTro != VaiTro.KhuVuc && m.VaiTro != VaiTro.Dma;
                ChiTieu ct = data.LayChiTieu(nam, m.Id) ?? new ChiTieu();
                KetQua k = kq[m.Id];
                XKieu so0 = dam ? Dam(SoK) : SoK, pt = dam ? Dam(PtK) : PtK;
                s.Dat(r, A, SttKeHoach(m, ref doi), dam ? Dam(SttK) : SttK);
                s.Dat(r, B, dam ? m.TenTongHop : "+ " + m.TenTongHop, dam ? Dam(TenK) : TenK);
                double? thPr = k != null ? (double?)k.LkPhatRa : null, thCt = k != null ? k.LkChuanThu : null, thTl = k != null ? k.LkTyLe : null;
                s.Dat(r, C, ct.PhatRa, KieuSo(ct.PhatRa, so0));
                s.Dat(r, D, thPr, KieuSo(thPr, so0));
                O(s, r, E, ct.PhatRa.HasValue && thPr.HasValue && ct.PhatRa != 0 ? thPr / ct.PhatRa * 100 : null, "D" + r + "/C" + r + "*100", pt);
                s.Dat(r, F, ct.ChuanThu, KieuSo(ct.ChuanThu, so0));
                s.Dat(r, G, thCt, KieuSo(thCt, so0));
                O(s, r, H, ct.ChuanThu.HasValue && thCt.HasValue && ct.ChuanThu != 0 ? thCt / ct.ChuanThu * 100 : null, "G" + r + "/F" + r + "*100", pt);
                s.Dat(r, I, ct.TyLe, pt);
                s.Dat(r, J, thTl, pt);
                O(s, r, K, ct.TyLe.HasValue && thTl.HasValue ? thTl - ct.TyLe : null, "J" + r + "-I" + r, pt);
                s.CaoDong[r] = 20;
                r++;
            }
            r++;
            PhanKy(s, r, cuoi.Ky, new[] { new[] { A, B }, new[] { C, G }, new[] { H, K } }, cuoi.NgayLap);
        }

        // ------------------------------------------------------------------ sổ cả năm

        /// <summary>Đủ các trang như file Excel đang làm: kế hoạch, tóm tắt, tổng hợp, từng tháng, từng quý.</summary>
        public XSo SoCaNam(int nam)
        {
            var so = new XSo();
            ThangBaoCao cuoi = ThangCuoiCuaNam(nam);
            if (cuoi == null) throw new InvalidOperationException("Năm " + nam + " chưa có số liệu");
            TrangKeHoach(so, nam);
            TrangTomTat(so, cuoi);
            TrangTongHopNam(so, nam);
            ThamChieuThang truoc = null;
            for (int th = 1; th <= 12; th++)
            {
                ThangBaoCao t = data.TimThang(nam, th);
                if (t == null) { truoc = null; continue; }
                truoc = TrangThang(so, t, truoc);
                if (th % 3 == 0) TrangQuy(so, nam, th / 3);
            }
            if (cuoi.Thang % 3 != 0) TrangQuy(so, nam, (cuoi.Thang + 2) / 3);
            return so;
        }
    }
}
