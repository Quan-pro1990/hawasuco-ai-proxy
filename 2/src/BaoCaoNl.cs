using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace ThatThoatNuoc
{
    /// <summary>
    /// File Excel / bản in của noise logger: kết quả nghe tiếng ồn 1 đêm (kèm các đêm trước, kết luận),
    /// danh sách ca rò rỉ phát hiện trong năm, bảng mức ồn nhiều đêm của từng điểm.
    /// </summary>
    public class BaoCaoNl
    {
        const int A = 1, B = 2, C = 3, D = 4, E = 5, F = 6, G = 7, H = 8;
        public const int SoDemTruoc = 6;
        static readonly CultureInfo VnUpper = CultureInfo.GetCultureInfo("vi-VN");

        readonly DuLieu dl;
        readonly DuLieuNl d;

        public BaoCaoNl(DuLieu dl)
        {
            this.dl = dl;
            d = dl.Nl;
        }

        static readonly XKieu CtyK = new XKieu { Dam = true, Co = 13, Ngang = "center" };
        static readonly XKieu CtyGach = new XKieu { Dam = true, Co = 13, Ngang = "center", GachChan = true };
        static readonly XKieu TieuDeK = new XKieu { Dam = true, Co = 16, Ngang = "center", XuongDong = true };
        static readonly XKieu PhuDeK = new XKieu { Dam = true, Co = 13, Ngang = "center", XuongDong = true };
        static readonly XKieu PhuDeNghieng = new XKieu { Nghieng = true, Co = 12, Ngang = "center", XuongDong = true };
        static readonly XKieu CotK = new XKieu { Dam = true, Co = 11, Ngang = "center", XuongDong = true, Khung = true, Nen = "FFE8EEF5" };
        static readonly XKieu SttK = new XKieu { Khung = true, Ngang = "center", Co = 11 };
        static readonly XKieu TenK = new XKieu { Khung = true, Ngang = "left", XuongDong = true, Co = 11 };
        static readonly XKieu GiuaK = new XKieu { Khung = true, Ngang = "center", XuongDong = true, Co = 11 };
        static readonly XKieu SoK = new XKieu { Khung = true, Ngang = "right", DinhDang = "#,##0.0", Co = 11 };
        static readonly XKieu SoNguyenK = new XKieu { Khung = true, Ngang = "right", DinhDang = "#,##0", Co = 11 };
        static readonly XKieu GhiChuK = new XKieu { Khung = true, Ngang = "left", Nghieng = true, Co = 10, XuongDong = true };
        static readonly XKieu NhomK = new XKieu { Khung = true, Ngang = "left", Dam = true, Co = 11, Nen = "FFDCE6F1" };
        static readonly XKieu TongK = new XKieu { Khung = true, Ngang = "left", Dam = true, Co = 11, Nen = "FFFFF2CC", XuongDong = true };
        static readonly XKieu NgayK = new XKieu { Nghieng = true, Co = 13, Ngang = "center" };
        static readonly XKieu KyK = new XKieu { Dam = true, Co = 13, Ngang = "center", XuongDong = true };
        const string NenRo = "FFF8CBAD", NenTheoDoi = "FFFFE699", MauRo = "FFC00000", MauTheoDoi = "FF9C5700", MauTot = "FF1E7B34";

        static string Hoa(string s) { return (s ?? "").ToUpper(VnUpper); }

        static XKieu ToMau(XKieu k, KetLuanNl kl)
        {
            if (kl == KetLuanNl.NghiRoRi) return k.Voi(x => x.Nen = NenRo);
            if (kl == KetLuanNl.TheoDoi) return k.Voi(x => x.Nen = NenTheoDoi);
            return k;
        }

        static XKieu MauChu(XKieu k, KetLuanNl kl)
        {
            switch (kl)
            {
                case KetLuanNl.NghiRoRi: return k.Voi(x => { x.Mau = MauRo; x.Dam = true; });
                case KetLuanNl.TheoDoi: return k.Voi(x => x.Mau = MauTheoDoi);
                case KetLuanNl.BinhThuong: return k.Voi(x => x.Mau = MauTot);
                default: return k;
            }
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

        void DauTrang(XTrang s, int traiDen, int phaiTu, int cuoi)
        {
            s.GopO(1, 1, 1, traiDen, dl.CaiDat.TenCongTy1, CtyK);
            s.GopO(2, 1, 2, traiDen, dl.CaiDat.TenCongTy2, CtyGach);
            s.GopO(1, phaiTu, 1, cuoi, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", CtyK);
            s.GopO(2, phaiTu, 2, cuoi, "Độc lập - Tự do - Hạnh phúc", CtyGach);
            s.CaoDong[1] = 18;
            s.CaoDong[2] = 18;
        }

        void PhanKy(XTrang s, int row, int[][] cot)
        {
            string dia = string.IsNullOrWhiteSpace(dl.CaiDat.DiaDanh) ? "" : dl.CaiDat.DiaDanh.Trim() + ", ";
            s.GopO(row, cot[2][0], row, cot[2][1], dia + So.NgayChu(DateTime.Today), NgayK);
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
        }

        string TenLoc(int donViLoc)
        {
            return donViLoc >= 0 ? DonViNlOps.Ten(dl, donViLoc) : "";
        }

        public static string TenFileKetQua(DateTime ngay, string donVi)
        {
            return "KẾT QUẢ NOISE LOGGER ĐÊM " + ngay.ToString("dd-MM-yyyy") + (string.IsNullOrEmpty(donVi) ? "" : " - " + donVi) + ".xlsx";
        }

        public static string TenFileRoRi(int nam, string donVi)
        {
            return "DANH SÁCH CA RÒ RỈ NOISE LOGGER" + (nam > 0 ? " NĂM " + nam : "") + (string.IsNullOrEmpty(donVi) ? "" : " - " + donVi) + ".xlsx";
        }

        public static string TenFileLichSu(DateTime tu, DateTime den, string donVi)
        {
            return "MỨC ỒN NOISE LOGGER " + tu.ToString("dd-MM") + " ĐẾN " + den.ToString("dd-MM-yyyy") + (string.IsNullOrEmpty(donVi) ? "" : " - " + donVi) + ".xlsx";
        }

        /// <summary>Điểm hiện trong báo cáo đêm [ngay]: điểm đang dùng, hoặc đã ngừng nhưng có số đo đêm đó.</summary>
        public static IEnumerable<DiemNl> DiemCuaDem(DuLieuNl d, DateTime ngay)
        {
            return d.Diem.Where(p => !p.Ngung || d.TimSoDo(p.Id, ngay) != null);
        }

        // ------------------------------------------------------------------ kết quả 1 đêm

        public XSo SoKetQua(DateTime ngay, int donViLoc)
        {
            ngay = ngay.Date;
            var nhom = DonViNlOps.Nhom(dl, DiemCuaDem(d, ngay), donViLoc);
            if (nhom.Count == 0) throw new InvalidOperationException("Chưa có điểm đặt logger nào" + (donViLoc >= 0 ? " của " + TenLoc(donViLoc) : "") + ".");
            NguongNl n = d.Nguong;
            const int T1 = 8, NEN = T1 + SoDemTruoc, KL = NEN + 1, GC = KL + 1;
            var so = new XSo();
            XTrang s = so.Them("Đêm " + ngay.ToString("dd-MM-yyyy"));
            s.RongCot[A] = 5;
            s.RongCot[B] = 32;
            s.RongCot[C] = 10;
            s.RongCot[D] = 11;
            s.RongCot[E] = 8.5;
            s.RongCot[F] = 8;
            s.RongCot[G] = 8.5;
            for (int i = 0; i < SoDemTruoc; i++) s.RongCot[T1 + i] = 7;
            s.RongCot[NEN] = 8;
            s.RongCot[KL] = 12;
            s.RongCot[GC] = 34;
            DauTrang(s, C, 9, GC);
            string loc = TenLoc(donViLoc);
            s.GopO(4, A, 4, GC, "BÁO CÁO KẾT QUẢ NGHE TIẾNG ỒN DÒ TÌM RÒ RỈ (NOISE LOGGER)" + (loc.Length > 0 ? "\n" + Hoa(loc) : ""), TieuDeK);
            s.CaoDong[4] = loc.Length > 0 ? 42 : 24;
            s.GopO(5, A, 5, GC, "Đêm rạng sáng " + So.NgayChu(ngay), PhuDeK);
            s.GopO(6, A, 6, GC, "(Nghi rò rỉ: mức ồn ≥ " + So.M3(n.RoRi) + " dB và độ trải ≤ " + So.M3(n.DoTrai) + " trong " + n.SoDem + " đêm liền; cần theo dõi: mức ồn ≥ " +
                                 So.M3(n.TheoDoi) + " dB hoặc tăng ≥ " + So.M3(n.Tang) + " dB so với mức nền)", PhuDeNghieng);
            s.CaoDong[6] = 32;
            int h1 = 8, h2 = 9;
            foreach (var p in new[] { new { C = A, T = "STT" }, new { C = B, T = "Điểm đặt logger" }, new { C = C, T = "Loại điểm" }, new { C = D, T = "Mã logger" },
                                      new { C = E, T = "Mức ồn\n(dB)" }, new { C = F, T = "Độ trải" }, new { C = G, T = "Tần số\n(Hz)" },
                                      new { C = NEN, T = "Mức nền\n(dB)" }, new { C = KL, T = "Kết luận" }, new { C = GC, T = "Ghi chú / ca rò rỉ" } })
                s.GopO(h1, p.C, h2, p.C, p.T, CotK);
            s.GopO(h1, T1, h1, T1 + SoDemTruoc - 1, "Mức ồn các đêm trước (dB)", CotK);
            for (int i = 0; i < SoDemTruoc; i++) s.Dat(h2, T1 + i, ngay.AddDays(i - SoDemTruoc).ToString("dd/MM"), CotK);
            s.CaoDong[h1] = 22;
            s.CaoDong[h2] = 22;
            s.LapTu = h1;
            s.LapDen = h2;
            s.CoDinhDong = h2;

            int row = h2 + 1, stt = 0;
            var dem = new Dictionary<KetLuanNl, int>();
            foreach (KetLuanNl k in Enum.GetValues(typeof(KetLuanNl))) dem[k] = 0;
            for (int g = 0; g < nhom.Count; g++)
            {
                NhomDiemNl nd = nhom[g];
                var kqs = nd.Diem.Select(p => PhanTichNl.PhanTich(d, p, ngay)).ToList();
                int ro = kqs.Count(x => x.KetLuan == KetLuanNl.NghiRoRi), td = kqs.Count(x => x.KetLuan == KetLuanNl.TheoDoi);
                s.Dat(row, A, So.LaMa(g + 1), NhomK.Voi(x => x.Ngang = "center"));
                s.GopO(row, B, row, GC, Hoa(nd.Ten) + "   (" + nd.Diem.Count + " điểm" + (ro > 0 ? " · " + ro + " nghi rò rỉ" : "") + (td > 0 ? " · " + td + " cần theo dõi" : "") + ")", NhomK);
                s.CaoDong[row] = 20;
                row++;
                foreach (KetQuaNl kq in kqs)
                {
                    stt++;
                    dem[kq.KetLuan]++;
                    DiemNl p = kq.Diem;
                    SoDoNl so0 = kq.DemNay;
                    ThietBiNl tb = so0 != null && so0.ThietBiId >= 0 ? d.TimThietBi(so0.ThietBiId) : (kq.LapDat != null ? d.TimThietBi(kq.LapDat.ThietBiId) : null);
                    string ten = p.Ten + (p.DuongOng.Length > 0 ? " (" + p.DuongOng + ")" : "");
                    s.Dat(row, A, stt, SttK);
                    s.Dat(row, B, ten, TenK);
                    s.Dat(row, C, DuLieuNl.TenLoai(p.Loai), GiuaK);
                    s.Dat(row, D, tb != null ? tb.Ma : "", GiuaK);
                    s.Dat(row, E, so0 != null ? so0.MucOn : null, ToMau(SoK, kq.KetLuanDem).Voi(x => x.Dam = true));
                    s.Dat(row, F, so0 != null ? so0.DoTrai : null, SoK);
                    s.Dat(row, G, so0 != null ? so0.TanSo : null, SoNguyenK);
                    for (int i = 0; i < SoDemTruoc; i++)
                    {
                        SoDoNl t = d.TimSoDo(p.Id, ngay.AddDays(i - SoDemTruoc));
                        s.Dat(row, T1 + i, t != null ? t.MucOn : null, ToMau(SoK, PhanTichNl.PhanLoai(t, n)));
                    }
                    s.Dat(row, NEN, kq.MucNen, SoK);
                    s.Dat(row, KL, DuLieuNl.TenKetLuan(kq.KetLuan), MauChu(GiuaK, kq.KetLuan));
                    string gc = kq.LyDo;
                    if (kq.RoRiMo != null)
                        gc = "Ca rò rỉ từ " + So.Ngay(kq.RoRiMo.NgayPhatHien) + ": " + DuLieuNl.TenTrangThai(kq.RoRiMo.TrangThai).ToLower(VnUpper) +
                             (kq.RoRiMo.ViTri.Length > 0 ? " — " + kq.RoRiMo.ViTri : "") + (gc.Length > 0 ? "\n" + gc : "");
                    if (p.GhiChu.Length > 0) gc += (gc.Length > 0 ? "\n" : "") + p.GhiChu;
                    s.Dat(row, GC, gc, GhiChuK);
                    s.CaoDong[row] = Math.Max(Math.Max(SoDongChu(ten, 32 * 0.85) * 15, SoDongChu(gc, 34 * 1.0) * 13.5), 16.5) + 3;
                    row++;
                }
            }
            s.GopO(row, A, row, GC, "Tổng cộng: " + stt + " điểm — nghi rò rỉ: " + dem[KetLuanNl.NghiRoRi] + "; cần theo dõi: " + dem[KetLuanNl.TheoDoi] +
                                    "; bình thường: " + dem[KetLuanNl.BinhThuong] + "; chưa có số đo: " + dem[KetLuanNl.ChuaCoSo] + ".", TongK);
            s.CaoDong[row] = 22;
            row += 2;
            PhanKy(s, row, new[] { new[] { A, C }, new[] { D, 11 }, new[] { 12, GC } });
            return so;
        }

        // ------------------------------------------------------------------ danh sách ca rò rỉ

        /// <summary>Ca rò rỉ phát hiện trong năm [nam] (0 = mọi năm) cộng các ca năm trước chưa xử lý xong.</summary>
        public static List<RoRiNl> CaCuaNam(DuLieuNl d, int nam)
        {
            return d.RoRi.Where(r => nam <= 0 || r.NgayPhatHien.Year == nam || (r.NgayPhatHien.Year < nam && (r.DangMo || (r.NgaySua.HasValue && r.NgaySua.Value.Year == nam))))
                         .OrderBy(r => r.NgayPhatHien).ThenBy(r => r.Id).ToList();
        }

        public XSo SoRoRi(int nam, int donViLoc)
        {
            var diemLoc = new HashSet<int>(DonViNlOps.Nhom(dl, d.Diem, donViLoc).SelectMany(g => g.Diem).Select(p => p.Id));
            var ds = CaCuaNam(d, nam).Where(r => diemLoc.Contains(r.DiemId) || (donViLoc < 0 && d.TimDiem(r.DiemId) == null)).ToList();
            if (ds.Count == 0) throw new InvalidOperationException("Chưa có ca rò rỉ nào" + (nam > 0 ? " năm " + nam : "") + (donViLoc >= 0 ? " của " + TenLoc(donViLoc) : "") + ".");
            const int I = 9, J = 10, K = 11, L = 12, M = 13, N = 14;
            var so = new XSo();
            XTrang s = so.Them(nam > 0 ? "Rò rỉ " + nam : "Rò rỉ");
            double[] w = { 0, 5, 11, 26, 16, 24, 15, 13, 11, 8, 9, 11, 8, 8, 24 };
            for (int c = A; c <= N; c++) s.RongCot[c] = w[c];
            DauTrang(s, D, 8, N);
            string loc = TenLoc(donViLoc);
            s.GopO(4, A, 4, N, "DANH SÁCH CA RÒ RỈ PHÁT HIỆN BẰNG NOISE LOGGER" + (nam > 0 ? " NĂM " + nam : "") + (loc.Length > 0 ? "\n" + Hoa(loc) : ""), TieuDeK);
            s.CaoDong[4] = loc.Length > 0 ? 42 : 24;
            s.GopO(5, A, 5, N, "(Nước tiết kiệm ước tính = lưu lượng rò × 24 giờ × 30 ngày, tính cho các ca đã sửa)", PhuDeNghieng);
            string[] heads = { "STT", "Ngày\nphát hiện", "Điểm đặt logger", "Đơn vị", "Vị trí rò", "Hạng mục", "Trạng thái", "Ngày sửa", "Số ngày\nxử lý",
                               "Lưu lượng\nrò (m3/h)", "Nước tiết\nkiệm\n(m3/tháng)", "Mức ồn\ntrước sửa\n(dB)", "Mức ồn\nsau sửa\n(dB)", "Ghi chú" };
            for (int i = 0; i < heads.Length; i++) s.Dat(7, A + i, heads[i], CotK);
            s.CaoDong[7] = 50;
            s.LapTu = 7;
            s.LapDen = 7;
            s.CoDinhDong = 7;
            int row = 8, dau = 8;
            double tongLl = 0, tongTk = 0;
            foreach (RoRiNl r in ds)
            {
                DiemNl p = d.TimDiem(r.DiemId);
                double? truoc, sau;
                PhanTichNl.TruocSauSua(d, r, out truoc, out sau);
                XKieu tt = r.TrangThai == TrangThaiRoRi.DaSua ? GiuaK.Voi(x => x.Mau = MauTot) : r.DangMo ? GiuaK.Voi(x => { x.Mau = MauRo; x.Dam = true; }) : GiuaK;
                s.Dat(row, A, row - dau + 1, SttK);
                s.Dat(row, B, So.Ngay(r.NgayPhatHien), GiuaK);
                s.Dat(row, C, p != null ? p.Ten : "(điểm đã xoá)", TenK);
                s.Dat(row, D, p != null ? DonViNlOps.Ten(dl, p.DonViId) : "", TenK);
                s.Dat(row, E, r.ViTri, TenK);
                s.Dat(row, F, r.HangMuc, TenK);
                s.Dat(row, G, DuLieuNl.TenTrangThai(r.TrangThai), tt);
                s.Dat(row, H, So.Ngay(r.NgaySua), GiuaK);
                double? soNgay = r.NgaySua.HasValue ? (r.NgaySua.Value.Date - r.NgayPhatHien.Date).TotalDays : (r.DangMo ? (DateTime.Today - r.NgayPhatHien.Date).TotalDays : (double?)null);
                s.Dat(row, I, soNgay, SoNguyenK.Voi(x => { if (r.DangMo) x.Nghieng = true; }));
                s.Dat(row, J, r.LuuLuong, SoK.Voi(x => x.DinhDang = "#,##0.##"));
                double? tk = r.TietKiemThang;
                if (tk.HasValue) s.CongThuc(row, K, "J" + row + "*24*30", tk.Value, SoNguyenK);
                else s.Dat(row, K, null, SoNguyenK);
                s.Dat(row, L, truoc, SoK);
                s.Dat(row, M, sau, SoK);
                s.Dat(row, N, r.GhiChu, GhiChuK);
                s.CaoDong[row] = Math.Max(Math.Max(SoDongChu(p != null ? p.Ten : "", 26 * 0.85), SoDongChu(r.ViTri, 24 * 0.85)), SoDongChu(r.GhiChu, 24)) * 15 + 4;
                if (r.TrangThai == TrangThaiRoRi.DaSua) tongLl += r.LuuLuong ?? 0;
                tongTk += tk ?? 0;
                row++;
            }
            int cuoi = row - 1;
            int sua = ds.Count(r => r.TrangThai == TrangThaiRoRi.DaSua), mo = ds.Count(r => r.DangMo), khong = ds.Count(r => r.TrangThai == TrangThaiRoRi.KhongThay);
            s.GopO(row, A, row, I, "Cộng: " + ds.Count + " ca — đã sửa " + sua + ", đang xử lý " + mo + ", dò không thấy rò " + khong, TongK);
            s.CongThuc(row, J, "SUMIF(G" + dau + ":G" + cuoi + ",\"" + DuLieuNl.TenTrangThai(TrangThaiRoRi.DaSua) + "\",J" + dau + ":J" + cuoi + ")", tongLl,
                       SoK.Voi(x => { x.Dam = true; x.Nen = "FFFFF2CC"; x.DinhDang = "#,##0.##"; }));
            s.CongThuc(row, K, "SUM(K" + dau + ":K" + cuoi + ")", tongTk, SoNguyenK.Voi(x => { x.Dam = true; x.Nen = "FFFFF2CC"; }));
            s.GopO(row, L, row, N, null, TongK);
            s.CaoDong[row] = 22;
            row += 2;
            PhanKy(s, row, new[] { new[] { A, D }, new[] { E, H }, new[] { I, N } });
            return so;
        }

        // ------------------------------------------------------------------ bảng mức ồn nhiều đêm

        public XSo SoLichSu(DateTime tu, DateTime den, int donViLoc)
        {
            tu = tu.Date;
            den = den.Date;
            if (den < tu) { DateTime x = tu; tu = den; den = x; }
            int soNgay = (int)(den - tu).TotalDays + 1;
            if (soNgay > 62) throw new InvalidOperationException("Chọn tối đa 62 đêm (2 tháng) để bảng vừa khổ giấy.");
            var nhom = DonViNlOps.Nhom(dl, d.Diem.Where(p => !p.Ngung || d.SoDoCua(p.Id).Any(x => x.Ngay >= tu && x.Ngay <= den)), donViLoc);
            if (nhom.Count == 0) throw new InvalidOperationException("Chưa có điểm đặt logger nào" + (donViLoc >= 0 ? " của " + TenLoc(donViLoc) : "") + ".");
            NguongNl n = d.Nguong;
            const int T1 = 3;
            int max = T1 + soNgay, kl = max + 1;
            var so = new XSo();
            XTrang s = so.Them("Mức ồn " + tu.ToString("dd-MM") + " đến " + den.ToString("dd-MM"));
            s.RongCot[A] = 5;
            s.RongCot[B] = 30;
            for (int i = 0; i < soNgay; i++) s.RongCot[T1 + i] = 5.6;
            s.RongCot[max] = 7.5;
            s.RongCot[kl] = 12;
            int giua = Math.Max(T1 + 2, kl - 8);
            DauTrang(s, B, giua, kl);
            string loc = TenLoc(donViLoc);
            s.GopO(4, A, 4, kl, "BẢNG MỨC ỒN BAN ĐÊM CỦA CÁC ĐIỂM ĐẶT NOISE LOGGER" + (loc.Length > 0 ? " - " + Hoa(loc) : ""), TieuDeK);
            s.CaoDong[4] = 24;
            s.GopO(5, A, 5, kl, "Từ đêm " + So.Ngay(tu) + " đến đêm " + So.Ngay(den) + " — đơn vị: dB (ô đỏ: vượt ngưỡng rò " + So.M3(n.RoRi) +
                                " dB, độ trải nhỏ; ô vàng: cần theo dõi)", PhuDeNghieng);
            s.CaoDong[5] = 20;
            s.GopO(7, A, 8, A, "STT", CotK);
            s.GopO(7, B, 8, B, "Điểm đặt logger", CotK);
            int batDau = T1;
            DateTime dauThang = tu;
            for (int i = 0; i < soNgay; i++)
            {
                DateTime ng = tu.AddDays(i);
                s.Dat(8, T1 + i, ng.Day, CotK);
                if (ng.Month != dauThang.Month)
                {
                    s.GopO(7, batDau, 7, T1 + i - 1, "Tháng " + dauThang.Month + "/" + dauThang.Year, CotK);
                    dauThang = ng;
                    batDau = T1 + i;
                }
            }
            s.GopO(7, batDau, 7, T1 + soNgay - 1, "Tháng " + dauThang.Month + "/" + dauThang.Year, CotK);
            s.GopO(7, max, 8, max, "Cao\nnhất", CotK);
            s.GopO(7, kl, 8, kl, "Kết luận\nđêm " + den.ToString("dd/MM"), CotK);
            s.CaoDong[7] = 20;
            s.CaoDong[8] = 20;
            s.LapTu = 7;
            s.LapDen = 8;
            s.CoDinhDong = 8;
            s.CoDinhCot = 2;
            XKieu soK = SoNguyenK.Voi(x => { x.Co = 9; x.Ngang = "center"; x.DinhDang = "0"; });
            int row = 9, stt = 0;
            for (int g = 0; g < nhom.Count; g++)
            {
                s.Dat(row, A, So.LaMa(g + 1), NhomK.Voi(x => x.Ngang = "center"));
                s.GopO(row, B, row, kl, Hoa(nhom[g].Ten), NhomK);
                row++;
                foreach (DiemNl p in nhom[g].Diem)
                {
                    stt++;
                    s.Dat(row, A, stt, SttK);
                    s.Dat(row, B, p.Ten, TenK);
                    double? cao = null;
                    for (int i = 0; i < soNgay; i++)
                    {
                        SoDoNl t = d.TimSoDo(p.Id, tu.AddDays(i));
                        double? v = t != null && t.MucOn.HasValue ? Math.Round(t.MucOn.Value) : (double?)null;
                        s.Dat(row, T1 + i, v, ToMau(soK, PhanTichNl.PhanLoai(t, n)));
                        if (t != null && t.MucOn.HasValue && (!cao.HasValue || t.MucOn.Value > cao.Value)) cao = t.MucOn.Value;
                    }
                    if (cao.HasValue)
                        s.CongThuc(row, max, "MAX(" + XTrang.O(row, T1) + ":" + XTrang.O(row, T1 + soNgay - 1) + ")", Math.Round(cao.Value), soK.Voi(x => x.Dam = true));
                    else s.Dat(row, max, null, soK);
                    KetQuaNl kq = PhanTichNl.PhanTich(d, p, den);
                    s.Dat(row, kl, DuLieuNl.TenKetLuan(kq.KetLuan), MauChu(GiuaK.Voi(x => x.Co = 10), kq.KetLuan));
                    s.CaoDong[row] = SoDongChu(p.Ten, 30 * 0.85) * 15 + 3;
                    row++;
                }
            }
            row++;
            PhanKy(s, row, new[] { new[] { A, B }, new[] { T1, Math.Max(T1, giua - 1) }, new[] { giua, kl } });
            return so;
        }
    }
}
