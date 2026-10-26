using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace QuanLyTaiSan
{
    using O = Dictionary<string, object>;

    /// <summary>Xuất Excel (danh sách tài sản, biên bản kiểm kê, mẫu nhập) và nhập danh sách tài sản từ Excel.</summary>
    static class BaoCao
    {
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        static readonly XKieu Thuong = new XKieu { Co = 11 };
        static readonly XKieu Khung = new XKieu { Co = 11, Khung = true, XuongDong = true };
        static readonly XKieu KhungGiua = Khung.Voi(k => k.Ngang = "center");
        static readonly XKieu KhungSo = Khung.Voi(k => { k.Ngang = "right"; k.DinhDang = "#,##0"; });
        static readonly XKieu TieuDeCot = new XKieu { Co = 11, Dam = true, Khung = true, XuongDong = true, Ngang = "center", Nen = "FFDCE6F1" };
        static readonly XKieu Nhom = new XKieu { Co = 11, Dam = true, Khung = true, Nen = "FFF2F2F2" };
        static readonly XKieu NhomSo = Nhom.Voi(k => { k.Ngang = "right"; k.DinhDang = "#,##0"; });
        static readonly XKieu NhomKhoi = new XKieu { Co = 11, Dam = true, Khung = true, Nen = "FFD6E4F0" };
        static readonly XKieu NhomKhoiSo = NhomKhoi.Voi(k => { k.Ngang = "right"; k.DinhDang = "#,##0"; });
        static readonly XKieu TieuDe = new XKieu { Co = 15, Dam = true, Ngang = "center" };
        static readonly XKieu GiuaDam = new XKieu { Co = 11, Ngang = "center", Dam = true };
        static readonly XKieu GiuaNghieng = new XKieu { Co = 11, Ngang = "center", Nghieng = true };

        static string Ngay(DateTime? d) { return VanBan.NgayVn(d); }

        static string TenTep(string goc) { return goc + " " + DateTime.Now.ToString("yyyy-MM-dd", Inv) + ".xlsx"; }

        // ------------------------------------------------------------------ danh sách tài sản (sổ theo dõi)

        static readonly string[] CotDanhSach =
        {
            "STT", "Mã tài sản", "Tên tài sản", "Loại tài sản", "Nhóm", "Đơn vị quản lý", "Vị trí", "Người sử dụng", "Hãng sản xuất",
            "Model / quy cách", "Số seri", "Nước sản xuất", "Năm sản xuất", "Ngày đưa vào sử dụng", "Nguyên giá (đồng)", "Số năm khấu hao",
            "Khấu hao luỹ kế (tạm tính)", "Giá trị còn lại (tạm tính)", "Tình trạng", "Kiểm tra lần cuối", "Bảo dưỡng lần cuối", "Hạn bảo dưỡng",
            "Thông số kỹ thuật", "Toạ độ (vĩ độ, kinh độ)", "Số ảnh", "Ghi chú"
        };

        static readonly double[] RongDanhSach = { 5, 13, 32, 22, 18, 22, 26, 16, 14, 16, 14, 11, 9, 12, 15, 9, 15, 15, 16, 12, 12, 12, 34, 20, 7, 30 };

        public static KeyValuePair<string, byte[]> DanhSachTaiSan(DichVu dv, Api.Loc loc)
        {
            var so = new XSo();
            XTrang t = so.Them("Danh sách tài sản");
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                List<TaiSan> ds = Api.LocTaiSan(dl, loc);
                DateTime homNay = DateTime.Today;
                int n = CotDanhSach.Length;
                t.GopO(1, 1, 1, 6, dl.CaiDat.TenCongTy, new XKieu { Co = 11, Dam = true });
                t.GopO(2, 1, 2, n, "DANH SÁCH TÀI SẢN", TieuDe);
                t.GopO(3, 1, 3, n, "Tính đến ngày " + Ngay(homNay) + " — " + ds.Count + " tài sản" + MoTaLoc(dl, loc), GiuaNghieng);
                for (int c = 0; c < n; c++)
                {
                    t.Dat(5, c + 1, CotDanhSach[c], TieuDeCot);
                    t.RongCot[c + 1] = RongDanhSach[c];
                }
                t.CaoDong[5] = 33;
                int r = 6;
                foreach (TaiSan x in ds)
                {
                    LoaiTaiSan l = dl.TimLoai(x.LoaiId);
                    int soNam = TinhToan.SoNamKhauHao(dl, x);
                    object[] v =
                    {
                        r - 5, x.Ma, x.Ten, l == null ? "" : l.Ten, l == null ? "" : l.Nhom, dl.TenDonVi(x.DonViId), x.ViTri, x.NguoiSuDung, x.HangSX,
                        x.Model, x.SoSeri, x.NuocSX, x.NamSX.HasValue ? (object)x.NamSX.Value : "", Ngay(x.NgaySuDung),
                        x.NguyenGia.HasValue ? (object)x.NguyenGia.Value : "", soNam > 0 ? (object)soNam : "",
                        So(TinhToan.KhauHaoLuyKe(dl, x, homNay)), So(TinhToan.GiaTriConLai(dl, x, homNay)), TinhTrang.Ten(x.TinhTrang),
                        Ngay(x.KiemTraCuoi), Ngay(x.BaoTriCuoi), Ngay(TinhToan.HanBaoTri(dl, x)),
                        string.Join("; ", x.ThongSo.Select(p => p.Key + ": " + p.Value)),
                        x.ViDo.HasValue ? x.ViDo.Value.ToString("0.######", Inv) + ", " + x.KinhDo.Value.ToString("0.######", Inv) : "",
                        x.Anh.Count, x.GhiChu
                    };
                    for (int c = 0; c < n; c++)
                    {
                        bool laSo = c == 14 || c == 16 || c == 17;
                        t.Dat(r, c + 1, v[c], laSo ? KhungSo : c == 0 || c == 12 || c == 13 || c == 15 || c >= 19 && c <= 21 || c == 24 ? KhungGiua : Khung);
                    }
                    r++;
                }
                if (ds.Count > 0)
                {
                    t.GopO(r, 1, r, 14, "TỔNG CỘNG", Nhom.Voi(k => k.Ngang = "center"));
                    t.CongThuc(r, 15, "SUM(O6:O" + (r - 1) + ")", ds.Sum(x => x.NguyenGia ?? 0), NhomSo);
                    t.Dat(r, 16, "", Nhom);
                    t.CongThuc(r, 17, "SUM(Q6:Q" + (r - 1) + ")", ds.Sum(x => TinhToan.KhauHaoLuyKe(dl, x, homNay) ?? 0), NhomSo);
                    t.CongThuc(r, 18, "SUM(R6:R" + (r - 1) + ")", ds.Sum(x => TinhToan.GiaTriConLai(dl, x, homNay) ?? 0), NhomSo);
                    for (int c = 19; c <= n; c++) t.Dat(r, c, "", Nhom);
                    r += 2;
                    t.GopO(r, 1, r, 12, "Khấu hao luỹ kế, giá trị còn lại: tạm tính theo phương pháp đường thẳng từ ngày đưa vào sử dụng (để tham khảo; số liệu kế toán chính thức theo sổ kế toán).",
                           new XKieu { Co = 10, Nghieng = true });
                }
                t.LapTu = 5;
                t.LapDen = 5;
                t.CoDinhDong = 5;
                t.CoDinhCot = 3;
                t.Ngang = true;
            }
            return new KeyValuePair<string, byte[]>(TenTep("Danh sach tai san"), so.LuuBytes());
        }

        static object So(double? v) { return v.HasValue ? (object)v.Value : ""; }

        static string MoTaLoc(DuLieu dl, Api.Loc l)
        {
            var p = new List<string>();
            if (l.Loai > 0) p.Add("loại " + dl.TenLoai(l.Loai));
            if (l.DonVi > 0) p.Add(dl.TenDonVi(l.DonVi));
            if (l.TinhTrang.Length > 0) p.Add(TinhTrang.Ten(l.TinhTrang).ToLowerInvariant());
            if (l.Them == "baotri") p.Add("đến hạn bảo dưỡng");
            if (l.Them == "lauchuakiem") p.Add("lâu chưa kiểm tra");
            if (l.Q.Trim().Length > 0) p.Add("tìm \"" + l.Q.Trim() + "\"");
            return p.Count == 0 ? "" : " (" + string.Join(", ", p) + ")";
        }

        // ------------------------------------------------------------------ biên bản kiểm kê

        public static KeyValuePair<string, byte[]> KiemKe(DichVu dv, int id)
        {
            var so = new XSo();
            string ten;
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                DotKiemKe k = dl.TimDot(id);
                if (k == null) throw new LoiApi(404, "Không có đợt kiểm kê này.");
                ten = k.Ten;
                DateTime homNay = DateTime.Today;
                XTrang t = so.Them("Biên bản kiểm kê");
                string[] cot = { "STT", "Mã tài sản", "Tên tài sản", "Loại tài sản", "Vị trí", "Nguyên giá (đồng)", "Giá trị còn lại (tạm tính)",
                                 "Theo sổ sách (SL)", "Thực tế kiểm kê (SL)", "Chênh lệch (SL)", "Tình trạng khi kiểm kê", "Người kiểm kê", "Thời gian kiểm", "Ghi chú" };
                double[] rong = { 5, 13, 32, 20, 24, 15, 15, 10, 10, 10, 18, 18, 15, 28 };
                int n = cot.Length;
                t.GopO(1, 1, 1, 5, dl.CaiDat.TenCongTy, new XKieu { Co = 11, Dam = true, Ngang = "center" });
                t.GopO(1, 9, 1, n, "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", GiuaDam);
                t.GopO(2, 9, 2, n, "Độc lập - Tự do - Hạnh phúc", GiuaDam);
                t.GopO(4, 1, 4, n, "BIÊN BẢN KIỂM KÊ TÀI SẢN", TieuDe);
                t.GopO(5, 1, 5, n, k.Ten, GiuaDam);
                t.GopO(6, 1, 6, n, "Thời gian: từ ngày " + Ngay(k.TuNgay) + (k.DenNgay.HasValue ? " đến ngày " + Ngay(k.DenNgay) : "") +
                                   " — Phạm vi: " + (k.DonVi.Count == 0 ? "toàn công ty" : string.Join(", ", k.DonVi.Select(x => dl.TenDonVi(x)))), GiuaNghieng);
                for (int c = 0; c < n; c++)
                {
                    t.Dat(8, c + 1, cot[c], TieuDeCot);
                    t.RongCot[c + 1] = rong[c];
                }
                t.CaoDong[8] = 33;
                int r = 9, stt = 0;
                var trongSo = k.DanhSach.Select(x => dl.Tim(x)).Where(x => x != null).ToList();
                var ngoaiSo = k.KetQua.Keys.Where(x => !k.DanhSach.Contains(x)).Select(x => dl.Tim(x)).Where(x => x != null).ToList();
                Action<TaiSan, bool> dong = (x, coSo) =>
                {
                    SuKien kq;
                    k.KetQua.TryGetValue(x.Id, out kq);
                    int soSach = coSo ? 1 : 0, thucTe = kq != null ? 1 : 0;
                    object[] v =
                    {
                        ++stt, x.Ma, x.Ten, dl.TenLoai(x.LoaiId), x.ViTri, So(x.NguyenGia), So(TinhToan.GiaTriConLai(dl, x, homNay)),
                        soSach, thucTe, thucTe - soSach, kq == null ? "Chưa tìm thấy" : TinhTrang.Ten(kq.TinhTrang),
                        kq == null ? "" : kq.HoTen, kq == null ? "" : kq.Luc.ToString("dd/MM/yyyy HH:mm", Inv), kq == null ? "" : kq.NoiDung
                    };
                    for (int c = 0; c < n; c++)
                        t.Dat(r, c + 1, v[c], c == 5 || c == 6 ? KhungSo : c == 0 || c >= 7 && c <= 9 || c == 12 ? KhungGiua : Khung);
                    r++;
                };
                // dòng tổng của 1 nhóm (khối hoặc đơn vị): nguyên giá, còn lại, sổ sách, thực tế, chênh lệch
                Action<string, List<TaiSan>, XKieu, XKieu> dongNhom = (tieuDe, gl, kieu, kieuSo) =>
                {
                    t.GopO(r, 1, r, 5, tieuDe, kieu);
                    t.Dat(r, 6, gl.Sum(x => x.NguyenGia ?? 0), kieuSo);
                    t.Dat(r, 7, gl.Sum(x => TinhToan.GiaTriConLai(dl, x, homNay) ?? 0), kieuSo);
                    t.Dat(r, 8, gl.Count, kieuSo);
                    int daKiem = gl.Count(x => k.KetQua.ContainsKey(x.Id));
                    t.Dat(r, 9, daKiem, kieuSo);
                    t.Dat(r, 10, daKiem - gl.Count, kieuSo);
                    for (int c = 11; c <= n; c++) t.Dat(r, c, "", kieu);
                    r++;
                };
                var thuTu = dl.DonViTheoThuTu().Select(x => x.Id).ToList();
                var theoDv = trongSo.GroupBy(x => x.DonViId).OrderBy(g => thuTu.IndexOf(g.Key) < 0 ? int.MaxValue : thuTu.IndexOf(g.Key)).ToList();
                int soKhoi = 0;
                foreach (string kh in Khoi.Ma)
                {
                    var cacDv = theoDv.Where(g => dl.KhoiCua(g.Key) == kh).ToList();
                    if (cacDv.Count == 0) continue;
                    dongNhom((char)('A' + soKhoi++) + ". " + Khoi.Ten(kh).ToUpper(CultureInfo.GetCultureInfo("vi-VN")), cacDv.SelectMany(g => g).ToList(), NhomKhoi, NhomKhoiSo);
                    int nhom = 0;
                    foreach (var g in cacDv)
                    {
                        dongNhom(LaMa(++nhom) + ". " + dl.TenDonVi(g.Key), g.ToList(), Nhom, NhomSo);
                        foreach (TaiSan x in g.OrderBy(x => x.Ma, StringComparer.OrdinalIgnoreCase)) dong(x, true);
                    }
                }
                if (ngoaiSo.Count > 0)
                {
                    t.GopO(r, 1, r, n, (char)('A' + soKhoi++) + ". Tài sản kiểm kê thấy nhưng không có trong sổ sách đầu kỳ (vd lúc bắt đầu kiểm kê đang ghi đã thanh lý / mất)", NhomKhoi);
                    r++;
                    foreach (TaiSan x in ngoaiSo.OrderBy(x => x.Ma, StringComparer.OrdinalIgnoreCase)) dong(x, false);
                }
                int tongSo = trongSo.Count, tongKiem = trongSo.Count(x => k.KetQua.ContainsKey(x.Id));
                r++;
                t.GopO(r++, 1, r - 1, n, "Tổng hợp: theo sổ sách " + tongSo + " tài sản; kiểm kê thấy " + tongKiem + "; chưa tìm thấy " + (tongSo - tongKiem) +
                                         "; ngoài sổ sách " + ngoaiSo.Count + ".", new XKieu { Co = 11, Dam = true });
                var theoTT = k.KetQua.Values.GroupBy(s => s.TinhTrang).Select(g => TinhTrang.Ten(g.Key) + ": " + g.Count()).ToList();
                if (theoTT.Count > 0) t.GopO(r++, 1, r - 1, n, "Tình trạng khi kiểm kê — " + string.Join("; ", theoTT) + ".", Thuong);
                r++;
                ChuKy(t, r, n, dl.CaiDat, new[] { "NGƯỜI LẬP BIỂU", "KẾ TOÁN TRƯỞNG", "GIÁM ĐỐC" },
                      new[] { dl.CaiDat.NguoiLap, dl.CaiDat.KeToanTruong, dl.CaiDat.GiamDoc });
                t.LapTu = 8;
                t.LapDen = 8;
                t.CoDinhDong = 8;
                t.Ngang = true;

                XTrang th = so.Them("Theo đơn vị");
                string[] c2 = { "STT", "Đơn vị", "Theo sổ sách", "Đã kiểm kê", "Chưa tìm thấy", "Tỷ lệ hoàn thành (%)", "Hỏng / đang sửa", "Ngừng sử dụng / mất" };
                double[] r2 = { 6, 34, 13, 13, 13, 14, 14, 16 };
                th.GopO(1, 1, 1, c2.Length, "TIẾN ĐỘ KIỂM KÊ THEO ĐƠN VỊ — " + k.Ten, TieuDe);
                for (int c = 0; c < c2.Length; c++)
                {
                    th.Dat(3, c + 1, c2[c], TieuDeCot);
                    th.RongCot[c + 1] = r2[c];
                }
                int rr = 4, sttDv = 0;
                Action<string, string, IEnumerable<TaiSan>, XKieu, XKieu> dongTienDo = (sttDong, tenDong, ds, kieu, kieuSo) =>
                {
                    var l = ds.ToList();
                    var kqs = l.Select(x => { SuKien s; return k.KetQua.TryGetValue(x.Id, out s) ? s : null; }).Where(s => s != null).ToList();
                    th.Dat(rr, 1, sttDong, kieu == Khung ? KhungGiua : kieu);
                    th.Dat(rr, 2, tenDong, kieu);
                    th.Dat(rr, 3, l.Count, kieuSo);
                    th.Dat(rr, 4, kqs.Count, kieuSo);
                    th.CongThuc(rr, 5, "C" + rr + "-D" + rr, l.Count - kqs.Count, kieuSo);
                    th.CongThuc(rr, 6, "IF(C" + rr + "=0,0,ROUND(D" + rr + "/C" + rr + "*100,1))", l.Count == 0 ? 0 : Math.Round(kqs.Count * 100.0 / l.Count, 1),
                                kieu.Voi(x => { x.Ngang = "right"; x.DinhDang = "0.0"; }));
                    th.Dat(rr, 7, kqs.Count(s => s.TinhTrang == TinhTrang.Hong || s.TinhTrang == TinhTrang.DangSua), kieuSo);
                    th.Dat(rr, 8, kqs.Count(s => s.TinhTrang == TinhTrang.Ngung || s.TinhTrang == TinhTrang.Mat), kieuSo);
                    rr++;
                };
                int soKhoi2 = 0;
                foreach (string kh in Khoi.Ma)
                {
                    var cacDv = theoDv.Where(g => dl.KhoiCua(g.Key) == kh).ToList();
                    if (cacDv.Count == 0) continue;
                    dongTienDo(((char)('A' + soKhoi2++)).ToString(), Khoi.Ten(kh), cacDv.SelectMany(g => g), NhomKhoi, NhomKhoiSo);
                    foreach (var g in cacDv) dongTienDo((++sttDv).ToString(), dl.TenDonVi(g.Key), g, Khung, KhungSo);
                }
                if (trongSo.Count > 0) dongTienDo("", "TỔNG CỘNG", trongSo, Nhom, NhomSo);
                th.Ngang = false;
            }
            return new KeyValuePair<string, byte[]>(TenTep("Bien ban kiem ke - " + VanBan.BoDauGiuHoa(ten)), so.LuuBytes());
        }

        // ------------------------------------------------------------------ biên bản giao nhận khi điều chuyển

        /// <summary>Biên bản giao nhận tài sản của 1 phiếu điều chuyển (bên giao → bên nhận, danh sách tài sản, chữ ký 2 bên + kế toán).</summary>
        public static KeyValuePair<string, byte[]> BienBanDieuChuyen(DichVu dv, string soPhieu)
        {
            var so = new XSo();
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                List<SuKien> l = dv.Kho.SuKienPhieu(soPhieu);
                if (l == null) throw new LoiApi(404, "Không có phiếu điều chuyển " + soPhieu + ".");
                SuKien dau = l[0];
                DateTime ngay = dau.Luc.Date;
                XTrang t = so.Them("Biên bản giao nhận");
                string[] cot = { "STT", "Mã tài sản", "Tên tài sản", "Loại tài sản", "Số seri", "Đơn vị giao", "Vị trí sau khi nhận", "Nguyên giá (đồng)", "Giá trị còn lại (tạm tính)", "Tình trạng" };
                double[] rong = { 5, 13, 34, 20, 13, 22, 24, 15, 15, 16 };
                int n = cot.Length;
                t.GopO(1, 1, 1, 4, dl.CaiDat.TenCongTy, new XKieu { Co = 11, Dam = true, Ngang = "center" });
                t.GopO(2, 1, 2, 4, "Số: " + dau.Phieu, new XKieu { Co = 11, Ngang = "center" });
                t.GopO(1, 6, 1, n, "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", GiuaDam);
                t.GopO(2, 6, 2, n, "Độc lập - Tự do - Hạnh phúc", GiuaDam);
                t.GopO(4, 1, 4, n, "BIÊN BẢN GIAO NHẬN TÀI SẢN", TieuDe);
                t.GopO(5, 1, 5, n, "(Điều chuyển tài sản giữa các đơn vị trong công ty)", GiuaNghieng);
                var tu = l.Select(s => s.TuDonVi).Distinct().Select(x => dl.TenDonVi(x)).ToList();
                int r = 7;
                Action<string> dongChu = s => { t.GopO(r, 1, r, n, s, Thuong); r++; };
                dongChu("Hôm nay, ngày " + ngay.Day + " tháng " + ngay.Month + " năm " + ngay.Year + (dl.CaiDat.DiaDanh.Length > 0 ? ", tại " + dl.CaiDat.DiaDanh : "") + ", chúng tôi gồm:");
                dongChu("Bên giao: " + string.Join(", ", tu));
                dongChu("Bên nhận: " + dl.TenDonVi(dau.DenDonVi) + " (" + Khoi.Ten(dl.KhoiCua(dau.DenDonVi)).ToLower(CultureInfo.GetCultureInfo("vi-VN")) + ")");
                if (dau.NoiDung.Length > 0) dongChu("Căn cứ / lý do: " + dau.NoiDung);
                dongChu("Đã giao nhận " + l.Count + " tài sản dưới đây (ghi trên phần mềm lúc " + dau.Luc.ToString("HH:mm dd/MM/yyyy", Inv) + ", người lập: " + dau.HoTen + "):");
                r++;
                int dauBang = r;
                for (int c = 0; c < n; c++)
                {
                    t.Dat(r, c + 1, cot[c], TieuDeCot);
                    t.RongCot[c + 1] = rong[c];
                }
                t.CaoDong[r] = 33;
                r++;
                int dongDau = r, stt = 0;
                double tongGia = 0, tongCon = 0;
                foreach (SuKien s in l)
                {
                    TaiSan x = dl.Tim(s.TaiSan);
                    double? con = x == null ? null : TinhToan.GiaTriConLai(dl, x, ngay);
                    tongGia += x == null ? 0 : x.NguyenGia ?? 0;
                    tongCon += con ?? 0;
                    object[] v =
                    {
                        ++stt, x == null ? "" : x.Ma, x == null ? "(tài sản đã xoá)" : x.Ten, x == null ? "" : dl.TenLoai(x.LoaiId), x == null ? "" : x.SoSeri,
                        dl.TenDonVi(s.TuDonVi), s.ViTri ?? (x == null ? "" : x.ViTri), x == null ? "" : So(x.NguyenGia), So(con),
                        s.TinhTrang != null ? TinhTrang.Ten(s.TinhTrang) : x == null ? "" : TinhTrang.Ten(x.TinhTrang)
                    };
                    for (int c = 0; c < n; c++) t.Dat(r, c + 1, v[c], c == 7 || c == 8 ? KhungSo : c == 0 ? KhungGiua : Khung);
                    r++;
                }
                t.GopO(r, 1, r, 7, "CỘNG (" + l.Count + " tài sản)", Nhom.Voi(k => k.Ngang = "center"));
                t.CongThuc(r, 8, "SUM(H" + dongDau + ":H" + (r - 1) + ")", tongGia, NhomSo);
                t.CongThuc(r, 9, "SUM(I" + dongDau + ":I" + (r - 1) + ")", tongCon, NhomSo);
                t.Dat(r, 10, "", Nhom);
                r += 2;
                dongChu("Bên nhận đã kiểm tra, nhận đủ các tài sản trên đúng tình trạng ghi trong biên bản và chịu trách nhiệm quản lý, sử dụng từ ngày nhận.");
                dongChu("Biên bản lập thành 03 bản: bên giao giữ 01 bản, bên nhận giữ 01 bản, phòng Kế toán giữ 01 bản.");
                r++;
                ChuKy(t, r, n, dl.CaiDat, new[] { "ĐẠI DIỆN BÊN GIAO", "ĐẠI DIỆN BÊN NHẬN", "KẾ TOÁN TRƯỞNG" }, new[] { "", "", dl.CaiDat.KeToanTruong }, ngay);
                t.LapTu = dauBang;
                t.LapDen = dauBang;
                t.Ngang = true;
            }
            return new KeyValuePair<string, byte[]>(TenTep("Bien ban giao nhan - " + soPhieu), so.LuuBytes());
        }

        // ------------------------------------------------------------------ sổ tài sản theo đơn vị (từng đội / phòng ban)

        /// <summary>
        /// Sổ theo dõi tài sản tại đơn vị sử dụng: trang "Tổng hợp" (theo khối → đơn vị) + mỗi đơn vị 1 trang danh sách.
        /// khoi = "" mọi khối; donVi = 0 mọi đơn vị. Chỉ tài sản đang quản lý (không gồm đã thanh lý / mất).
        /// </summary>
        public static KeyValuePair<string, byte[]> SoTheoDonVi(DichVu dv, string khoi, int donVi)
        {
            var so = new XSo();
            string tenTep;
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                DateTime homNay = DateTime.Today;
                var cacDv = dl.DonViTheoThuTu().Where(d => (string.IsNullOrEmpty(khoi) || d.Khoi == khoi) && (donVi <= 0 || d.Id == donVi)).ToList();
                if (cacDv.Count == 0) throw new LoiApi(404, "Không có đơn vị này.");
                var ds = cacDv.ToDictionary(d => d.Id, d => dl.TaiSan.Where(t => t.DonViId == d.Id && TinhTrang.ConDung(t.TinhTrang))
                                                                    .OrderBy(t => VanBan.KhoaTuNhien(dl.TenLoai(t.LoaiId)), VanBan.SoSanhTen)
                                                                    .ThenBy(t => t.Ma, StringComparer.OrdinalIgnoreCase).ToList());
                if (cacDv.Count > 1) TrangTongHopDonVi(so, dl, cacDv, ds, homNay);
                foreach (DonVi d in cacDv)
                    if (ds[d.Id].Count > 0 || cacDv.Count == 1) TrangDonVi(so, dl, d, ds[d.Id], homNay);
                tenTep = donVi > 0 ? "So tai san - " + VanBan.BoDauGiuHoa(cacDv[0].Ten)
                       : !string.IsNullOrEmpty(khoi) ? "So tai san - " + VanBan.BoDauGiuHoa(Khoi.Ten(khoi)) : "So tai san theo don vi";
            }
            return new KeyValuePair<string, byte[]>(TenTep(tenTep), so.LuuBytes());
        }

        static void TrangTongHopDonVi(XSo so, DuLieu dl, List<DonVi> cacDv, Dictionary<int, List<TaiSan>> ds, DateTime homNay)
        {
            XTrang t = so.Them("Tổng hợp");
            int ngayNhac = Math.Max(1, dl.CaiDat.NgayNhacKiemTra);
            string[] cot = { "STT", "Đơn vị", "Số tài sản", "Nguyên giá (đồng)", "Khấu hao luỹ kế (tạm tính)", "Giá trị còn lại (tạm tính)",
                             "Đang dùng tốt", "Cần theo dõi", "Hỏng / đang sửa", "Ngừng sử dụng", "Đến hạn bảo dưỡng (≤ 7 ngày)", "Chưa kiểm tra > " + ngayNhac + " ngày" };
            double[] rong = { 6, 34, 11, 17, 17, 17, 11, 11, 11, 11, 13, 13 };
            int n = cot.Length;
            t.GopO(1, 1, 1, 6, dl.CaiDat.TenCongTy, new XKieu { Co = 11, Dam = true });
            t.GopO(2, 1, 2, n, "TỔNG HỢP TÀI SẢN THEO ĐƠN VỊ", TieuDe);
            t.GopO(3, 1, 3, n, "Tính đến ngày " + Ngay(homNay) + " — tài sản đang quản lý (không gồm đã thanh lý, mất)", GiuaNghieng);
            for (int c = 0; c < n; c++)
            {
                t.Dat(5, c + 1, cot[c], TieuDeCot);
                t.RongCot[c + 1] = rong[c];
            }
            t.CaoDong[5] = 45;
            int r = 6, soKhoi = 0, stt = 0;
            Action<string, string, List<TaiSan>, XKieu, XKieu> dong = (sttDong, ten, l, kieu, kieuSo) =>
            {
                t.Dat(r, 1, sttDong, kieu == Khung ? KhungGiua : kieu);
                t.Dat(r, 2, ten, kieu);
                t.Dat(r, 3, l.Count, kieuSo);
                t.Dat(r, 4, l.Sum(x => x.NguyenGia ?? 0), kieuSo);
                t.Dat(r, 5, l.Sum(x => TinhToan.KhauHaoLuyKe(dl, x, homNay) ?? 0), kieuSo);
                t.Dat(r, 6, l.Sum(x => TinhToan.GiaTriConLai(dl, x, homNay) ?? 0), kieuSo);
                t.Dat(r, 7, l.Count(x => x.TinhTrang == TinhTrang.Tot), kieuSo);
                t.Dat(r, 8, l.Count(x => x.TinhTrang == TinhTrang.TheoDoi), kieuSo);
                t.Dat(r, 9, l.Count(x => x.TinhTrang == TinhTrang.Hong || x.TinhTrang == TinhTrang.DangSua), kieuSo);
                t.Dat(r, 10, l.Count(x => x.TinhTrang == TinhTrang.Ngung), kieuSo);
                t.Dat(r, 11, l.Count(x => { DateTime? h = TinhToan.HanBaoTri(dl, x); return h.HasValue && h.Value <= homNay.AddDays(7); }), kieuSo);
                t.Dat(r, 12, l.Count(x => !x.KiemTraCuoi.HasValue || x.KiemTraCuoi.Value < homNay.AddDays(-ngayNhac)), kieuSo);
                r++;
            };
            foreach (string kh in Khoi.Ma)
            {
                var trongKhoi = cacDv.Where(d => d.Khoi == kh).ToList();
                if (trongKhoi.Count == 0) continue;
                dong(((char)('A' + soKhoi++)).ToString(), Khoi.Ten(kh).ToUpper(CultureInfo.GetCultureInfo("vi-VN")), trongKhoi.SelectMany(d => ds[d.Id]).ToList(), NhomKhoi, NhomKhoiSo);
                foreach (DonVi d in trongKhoi) dong((++stt).ToString(), d.Ten, ds[d.Id], Khung, KhungSo);
            }
            dong("", "TỔNG CỘNG", cacDv.SelectMany(d => ds[d.Id]).ToList(), Nhom, NhomSo);
            r++;
            t.GopO(r++, 1, r - 1, n, "Khấu hao luỹ kế, giá trị còn lại: tạm tính theo đường thẳng từ ngày đưa vào sử dụng (tham khảo; số chính thức theo sổ kế toán).",
                   new XKieu { Co = 10, Nghieng = true });
            r++;
            ChuKy(t, r, n, dl.CaiDat, new[] { "NGƯỜI LẬP BIỂU", "KẾ TOÁN TRƯỞNG", "GIÁM ĐỐC" }, new[] { dl.CaiDat.NguoiLap, dl.CaiDat.KeToanTruong, dl.CaiDat.GiamDoc });
            t.LapTu = 5;
            t.LapDen = 5;
            t.CoDinhDong = 5;
            t.Ngang = true;
        }

        static void TrangDonVi(XSo so, DuLieu dl, DonVi d, List<TaiSan> ds, DateTime homNay)
        {
            XTrang t = so.Them(d.Ten);
            string[] cot = { "STT", "Mã tài sản", "Tên tài sản", "Loại tài sản", "Vị trí", "Người sử dụng", "Hãng / model", "Số seri", "Năm SX",
                             "Ngày đưa vào SD", "Nguyên giá (đồng)", "Khấu hao luỹ kế (tạm tính)", "Giá trị còn lại (tạm tính)", "Tình trạng", "Kiểm tra lần cuối", "Ghi chú" };
            double[] rong = { 5, 13, 32, 20, 24, 16, 18, 13, 7, 11, 15, 15, 15, 16, 11, 24 };
            int n = cot.Length;
            t.GopO(1, 1, 1, 5, dl.CaiDat.TenCongTy, new XKieu { Co = 11, Dam = true });
            t.GopO(2, 1, 2, n, "SỔ THEO DÕI TÀI SẢN TẠI ĐƠN VỊ SỬ DỤNG", TieuDe);
            t.GopO(3, 1, 3, n, "Đơn vị: " + d.Ten + " (" + Khoi.Ten(d.Khoi).ToLower(CultureInfo.GetCultureInfo("vi-VN")) + ")", GiuaDam);
            t.GopO(4, 1, 4, n, "Tính đến ngày " + Ngay(homNay) + " — " + ds.Count + " tài sản đang quản lý", GiuaNghieng);
            for (int c = 0; c < n; c++)
            {
                t.Dat(6, c + 1, cot[c], TieuDeCot);
                t.RongCot[c + 1] = rong[c];
            }
            t.CaoDong[6] = 33;
            int r = 7;
            foreach (TaiSan x in ds)
            {
                string hang = (x.HangSX + (x.HangSX.Length > 0 && x.Model.Length > 0 ? " / " : "") + x.Model).Trim();
                object[] v =
                {
                    r - 6, x.Ma, x.Ten, dl.TenLoai(x.LoaiId), x.ViTri, x.NguoiSuDung, hang, x.SoSeri, x.NamSX.HasValue ? (object)x.NamSX.Value : "",
                    Ngay(x.NgaySuDung), So(x.NguyenGia), So(TinhToan.KhauHaoLuyKe(dl, x, homNay)), So(TinhToan.GiaTriConLai(dl, x, homNay)),
                    TinhTrang.Ten(x.TinhTrang), Ngay(x.KiemTraCuoi), x.GhiChu
                };
                for (int c = 0; c < n; c++)
                    t.Dat(r, c + 1, v[c], c >= 10 && c <= 12 ? KhungSo : c == 0 || c == 8 || c == 9 || c == 14 ? KhungGiua : Khung);
                r++;
            }
            t.GopO(r, 1, r, 10, "TỔNG CỘNG (" + ds.Count + " tài sản)", Nhom.Voi(k => k.Ngang = "center"));
            for (int c = 11; c <= 13; c++)
            {
                string cotChu = XlsxReader.TenCot(c);
                double tong = c == 11 ? ds.Sum(x => x.NguyenGia ?? 0) : c == 12 ? ds.Sum(x => TinhToan.KhauHaoLuyKe(dl, x, homNay) ?? 0) : ds.Sum(x => TinhToan.GiaTriConLai(dl, x, homNay) ?? 0);
                if (ds.Count > 0) t.CongThuc(r, c, "SUM(" + cotChu + "7:" + cotChu + (r - 1) + ")", tong, NhomSo);
                else t.Dat(r, c, 0, NhomSo);
            }
            for (int c = 14; c <= n; c++) t.Dat(r, c, "", Nhom);
            r += 2;
            ChuKy(t, r, n, dl.CaiDat, new[] { "NGƯỜI LẬP BIỂU", "TRƯỞNG ĐƠN VỊ", "KẾ TOÁN TRƯỞNG" }, new[] { dl.CaiDat.NguoiLap, "", dl.CaiDat.KeToanTruong });
            t.LapTu = 6;
            t.LapDen = 6;
            t.CoDinhDong = 6;
            t.CoDinhCot = 3;
            t.Ngang = true;
        }

        static void ChuKy(XTrang t, int r, int n, CaiDat cd, string[] chucDanh, string[] ten, DateTime? ngay = null)
        {
            // 3 khối chữ ký chia đều bề ngang, không chồng cột (trang 12 cột trước đây bị chồng → mất chữ ký thứ 3)
            int w = n / 3;
            DateTime d = ngay ?? DateTime.Today;
            t.GopO(r, 2 * w + 1, r, n, (cd.DiaDanh.Length > 0 ? cd.DiaDanh + ", " : "") + "ngày " + d.Day + " tháng " + d.Month + " năm " + d.Year, GiuaNghieng);
            r++;
            int[] cot = { 1, w + 1, 2 * w + 1 };
            int[] den = { w, 2 * w, n };
            for (int i = 0; i < 3; i++)
            {
                t.GopO(r, cot[i], r, den[i], chucDanh[i], GiuaDam);
                t.GopO(r + 1, cot[i], r + 1, den[i], "(Ký, ghi rõ họ tên)", GiuaNghieng);
                t.GopO(r + 5, cot[i], r + 5, den[i], ten[i] ?? "", GiuaDam);
            }
        }

        static string LaMa(int n)
        {
            string[] m = { "M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I" };
            int[] v = { 1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1 };
            var s = "";
            for (int i = 0; i < v.Length; i++) while (n >= v[i]) { s += m[i]; n -= v[i]; }
            return s;
        }

        // ------------------------------------------------------------------ mẫu nhập

        static readonly string[] CotMau =
        {
            "Mã tài sản", "Tên tài sản", "Loại tài sản", "Đơn vị quản lý", "Vị trí", "Người sử dụng", "Hãng sản xuất", "Model / quy cách", "Số seri",
            "Nước sản xuất", "Năm sản xuất", "Ngày đưa vào sử dụng", "Nguyên giá (đồng)", "Số năm khấu hao", "Tình trạng", "Bảo dưỡng lần cuối",
            "Chu kỳ bảo dưỡng (ngày)", "Bảo hành đến", "Thông số kỹ thuật", "Toạ độ (vĩ độ, kinh độ)", "Ghi chú"
        };

        public static KeyValuePair<string, byte[]> MauNhap(DichVu dv)
        {
            var so = new XSo();
            XTrang t = so.Them("Tài sản");
            for (int c = 0; c < CotMau.Length; c++)
            {
                t.Dat(1, c + 1, CotMau[c], TieuDeCot);
                t.RongCot[c + 1] = c == 1 ? 34 : c == 18 ? 40 : c == 4 ? 28 : 18;
            }
            t.CaoDong[1] = 33;
            object[] vd =
            {
                "", "Máy bơm trục ngang số 1 - Trạm bơm cấp 2", "Máy bơm", "Đội Cấp nước số 1", "Nhà máy nước Vị Thanh - nhà bơm cấp 2", "Nguyễn Văn A",
                "Grundfos", "NK 100-250", "SN123456", "Đan Mạch", 2020, "15/06/2020", 350000000, 8, "Đang sử dụng tốt", "01/09/2026", 90, "15/06/2022",
                "Lưu lượng (m³/h): 200; Cột áp (m): 45; Công suất (kW): 37", "9.7845, 105.4701", "Dòng ví dụ — xoá trước khi nhập"
            };
            for (int c = 0; c < vd.Length; c++) t.Dat(2, c + 1, vd[c], Khung.Voi(k => k.Nghieng = true));
            t.CoDinhDong = 1;

            XTrang h = so.Them("Hướng dẫn");
            h.RongCot[1] = 28;
            h.RongCot[2] = 90;
            int r = 1;
            h.Dat(r++, 1, "HƯỚNG DẪN NHẬP DANH SÁCH TÀI SẢN", new XKieu { Co = 13, Dam = true });
            string[][] hd =
            {
                new[] { "Dòng tiêu đề", "Giữ nguyên dòng 1 của trang \"Tài sản\" (có thể đổi thứ tự cột, bỏ cột không dùng). Mỗi dòng sau là 1 tài sản." },
                new[] { "Mã tài sản", "Để trống: phần mềm tự cấp theo tiền tố của loại (vd MB-00001). Đã có mã (vd từ sổ kế toán): ghi vào — chỉ chữ không dấu, số, dấu - . _" },
                new[] { "Mã đã có trong phần mềm", "Dòng có mã trùng tài sản đã có = cập nhật: chỉ các ô có số liệu được ghi đè, ô trống giữ nguyên." },
                new[] { "Loại / đơn vị", "Ghi đúng tên trong danh mục (bên dưới). Tên chưa có: phần mềm tạo mới loại / đơn vị đó." },
                new[] { "Ngày", "Dạng ngày/tháng/năm (15/06/2020) hoặc ô ngày của Excel. Chỉ có năm: ghi 2020." },
                new[] { "Nguyên giá", "Số đồng, vd 350000000 hoặc 350.000.000" },
                new[] { "Tình trạng", string.Join("; ", TinhTrang.Ma.Select(x => TinhTrang.Ten(x))) + ". Để trống = Đang sử dụng tốt." },
                new[] { "Thông số kỹ thuật", "Dạng \"tên: giá trị; tên: giá trị\". Hoặc thêm cột có tiêu đề đúng tên thông số của loại (vd \"Công suất (kW)\")." },
                new[] { "Ảnh", "Ảnh chụp trên điện thoại sau khi nhập: quét tem QR → Chụp ảnh." }
            };
            foreach (string[] x in hd)
            {
                h.Dat(r, 1, x[0], new XKieu { Co = 11, Dam = true, Doc = "top" });
                h.Dat(r, 2, x[1], new XKieu { Co = 11, XuongDong = true, Doc = "top" });
                r++;
            }
            r++;
            lock (dv.Khoa)
            {
                h.Dat(r++, 1, "LOẠI TÀI SẢN ĐANG CÓ", new XKieu { Co = 11, Dam = true });
                foreach (LoaiTaiSan l in dv.Dl.Loai.OrderBy(x => x.Ten, VanBan.SoSanhTen))
                {
                    h.Dat(r, 1, l.Ten, Thuong);
                    h.Dat(r, 2, "Tiền tố mã " + l.TienTo + (l.Truong.Count > 0 ? " — thông số: " + string.Join("; ", l.Truong) : ""), Thuong);
                    r++;
                }
                r++;
                h.Dat(r++, 1, "ĐƠN VỊ QUẢN LÝ", new XKieu { Co = 11, Dam = true });
                foreach (DonVi d in dv.Dl.DonViTheoThuTu())
                {
                    h.Dat(r, 1, d.Ten, Thuong);
                    h.Dat(r++, 2, Khoi.Ten(d.Khoi), Thuong);
                }
            }
            h.Ngang = false;
            return new KeyValuePair<string, byte[]>("Mau nhap tai san.xlsx", so.LuuBytes());
        }

        // ------------------------------------------------------------------ nhập từ Excel

        public class DongNhap
        {
            public int Dong;
            public string Ma = "", Ten = "", Loai = "", DonVi = "", ViTri, NguoiSuDung, HangSX, Model, SoSeri, NuocSX, TinhTrang, GhiChu;
            public int? NamSX, SoNam, ChuKy;
            public DateTime? NgaySuDung, BaoTriCuoi, BaoHanh;
            public double? NguyenGia, ViDo, KinhDo;
            public readonly List<KeyValuePair<string, string>> ThongSo = new List<KeyValuePair<string, string>>();
            public readonly List<string> CanhBao = new List<string>();
            public string Loi;
        }

        enum Truong { Bo, Ma, Ten, Loai, DonVi, ViTri, Nguoi, Hang, Model, Seri, Nuoc, NamSX, NgaySD, NguyenGia, SoNam, TinhTrang, BaoTri, ChuKy, BaoHanh, ThongSo, ToaDo, GhiChu }

        static Truong NhanCot(string tieuDe)
        {
            string h = VanBan.BoDau(tieuDe).Replace("\n", " ").Trim();
            if (h.Length == 0 || h == "stt" || h == "tt" || h.StartsWith("so thu tu")) return Truong.Bo;
            if (h.Contains("khau hao luy ke") || h.Contains("gia tri con lai") || h.Contains("kiem tra lan cuoi") || h.Contains("han bao duong") ||
                h == "so anh" || h == "nhom") return Truong.Bo;
            if (h.StartsWith("ma") && (h == "ma" || h.Contains("tai san") || h.StartsWith("ma ts") || h.Contains("so hieu"))) return Truong.Ma;
            if (h.Contains("so hieu tai san") || h.Contains("ma so")) return Truong.Ma;
            if (h.StartsWith("ten") && !h.Contains("don vi")) return Truong.Ten;
            if (h.StartsWith("loai") || h.Contains("loai tai san")) return Truong.Loai;
            if (h.Contains("don vi") || h.Contains("bo phan")) return Truong.DonVi;
            if (h.Contains("vi tri") || h.Contains("dia diem") || h.Contains("noi dat")) return Truong.ViTri;
            if (h.Contains("nguoi su dung") || h.Contains("nguoi quan ly") || h.Contains("nguoi phu trach")) return Truong.Nguoi;
            if (h.Contains("hang")) return Truong.Hang;
            if (h.Contains("model") || h.Contains("quy cach") || h.Contains("ky hieu") || h.Contains("ma hieu")) return Truong.Model;
            if (h.Contains("seri") || h.Contains("serial")) return Truong.Seri;
            if (h.Contains("nuoc san xuat") || h.Contains("nuoc sx") || h.Contains("xuat xu")) return Truong.Nuoc;
            if (h.Contains("nam san xuat") || h.Contains("nam sx")) return Truong.NamSX;
            if (h.Contains("ngay dua vao") || h.Contains("ngay su dung") || h.Contains("ngay sd") || h.Contains("nam su dung") || h.Contains("nam dua vao")) return Truong.NgaySD;
            if (h.Contains("nguyen gia")) return Truong.NguyenGia;
            if (h.Contains("so nam khau hao") || h.Contains("thoi gian khau hao") || h.Contains("thoi gian su dung")) return Truong.SoNam;
            if (h.Contains("tinh trang")) return Truong.TinhTrang;
            if (h.Contains("chu ky")) return Truong.ChuKy;
            if (h.Contains("bao duong") || h.Contains("bao tri")) return Truong.BaoTri;
            if (h.Contains("bao hanh")) return Truong.BaoHanh;
            if (h.Contains("thong so")) return Truong.ThongSo;
            if (h.Contains("toa do") || h.Contains("gps")) return Truong.ToaDo;
            if (h.Contains("ghi chu")) return Truong.GhiChu;
            return Truong.Bo;
        }

        static double? DocSo(OXls o)
        {
            if (o == null) return null;
            if (o.Number.HasValue) return o.Number;
            string s = (o.Text ?? "").Trim().Replace(" ", "").Replace("đ", "").Replace("VND", "").Replace("vnđ", "");
            if (s.Length == 0) return null;
            if (s.IndexOf(',') >= 0 && s.IndexOf('.') >= 0) s = s.Replace(".", "").Replace(',', '.');
            else if (s.Split('.').Length > 2 || s.Split('.').Length == 2 && s.Split('.')[1].Length == 3) s = s.Replace(".", "");
            else if (s.Split(',').Length > 2 || s.Split(',').Length == 2 && s.Split(',')[1].Length == 3) s = s.Replace(",", "");
            else s = s.Replace(',', '.');
            double v;
            if (double.TryParse(s, NumberStyles.Float, Inv, out v)) return v;
            throw new LoiApi(400, "\"" + o.Text + "\" không phải số");
        }

        static DateTime? DocNgay(OXls o, string ten)
        {
            if (o == null) return null;
            if (o.Number.HasValue)
            {
                double v = o.Number.Value;
                if (v >= 1900 && v <= 2200 && Math.Floor(v) == v) return new DateTime((int)v, 1, 1);
                if (v > 0 && v < 100000) return DateTime.FromOADate(v).Date;
                throw new LoiApi(400, ten + ": ngày không hợp lệ");
            }
            return VanBan.Ngay(o.Text, ten);
        }

        static string Chu(OXls o) { return o == null ? "" : o.Chu.Trim(); }

        public static O Nhap(DichVu dv, TaiKhoan tk, byte[] tep, bool thu)
        {
            if (tep == null || tep.Length < 100) throw new LoiApi(400, "Chưa chọn file Excel.");
            List<TrangXls> cacTrang;
            try { cacTrang = XlsxReader.Doc(tep); }
            catch (Exception) { throw new LoiApi(400, "File không phải Excel .xlsx (file .xls cũ: mở bằng Excel rồi lưu thành .xlsx)."); }
            TrangXls trang = null;
            int dongTieuDe = 0;
            var cot = new Dictionary<int, Truong>();
            var cotThongSo = new Dictionary<int, string>();
            foreach (TrangXls tr in cacTrang)
            {
                for (int r = 1; r <= Math.Min(20, tr.SoDong) && trang == null; r++)
                {
                    var c = new Dictionary<int, Truong>();
                    for (int col = 1; col <= 60; col++)
                    {
                        Truong f = NhanCot(tr.Chu(r, col));
                        if (f != Truong.Bo && !c.ContainsValue(f)) c[col] = f;
                    }
                    if (c.ContainsValue(Truong.Ten) && (c.ContainsValue(Truong.Ma) || c.ContainsValue(Truong.Loai) || c.ContainsValue(Truong.DonVi)))
                    {
                        trang = tr;
                        dongTieuDe = r;
                        cot = c;
                    }
                }
                if (trang != null) break;
            }
            if (trang == null) throw new LoiApi(400, "Không thấy dòng tiêu đề có cột \"Tên tài sản\" và \"Mã tài sản\" / \"Loại tài sản\" / \"Đơn vị\". Hãy dùng file mẫu.");
            lock (dv.Khoa)
            {
                // cột chưa nhận ra nhưng trùng tên thông số của 1 loại (vd "Công suất (kW)") → thông số kỹ thuật
                var tenThongSo = new HashSet<string>(dv.Dl.Loai.SelectMany(l => l.Truong).Select(x => VanBan.BoDau(x)));
                for (int col = 1; col <= 60; col++)
                {
                    string h = trang.Chu(dongTieuDe, col).Trim();
                    if (!cot.ContainsKey(col) && h.Length > 0 && tenThongSo.Contains(VanBan.BoDau(h))) cotThongSo[col] = h;
                }
            }
            var ds = new List<DongNhap>();
            int trong = 0;
            for (int r = dongTieuDe + 1; r <= trang.SoDong && trong < 30; r++)
            {
                if (trang.DongAn.Contains(r)) continue;
                var d = new DongNhap { Dong = r };
                bool coGi = false;
                foreach (var kv in cot)
                {
                    OXls o = trang.Lay(r, kv.Key);
                    if (o == null || o.IsEmpty) continue;
                    coGi = true;
                    try
                    {
                        switch (kv.Value)
                        {
                            case Truong.Ma: d.Ma = Chu(o); break;
                            case Truong.Ten: d.Ten = Chu(o); break;
                            case Truong.Loai: d.Loai = Chu(o); break;
                            case Truong.DonVi: d.DonVi = Chu(o); break;
                            case Truong.ViTri: d.ViTri = Chu(o); break;
                            case Truong.Nguoi: d.NguoiSuDung = Chu(o); break;
                            case Truong.Hang: d.HangSX = Chu(o); break;
                            case Truong.Model: d.Model = Chu(o); break;
                            case Truong.Seri: d.SoSeri = Chu(o); break;
                            case Truong.Nuoc: d.NuocSX = Chu(o); break;
                            case Truong.NamSX: { double? v = DocSo(o); if (v.HasValue) d.NamSX = (int)v.Value; break; }
                            case Truong.NgaySD: d.NgaySuDung = DocNgay(o, "Ngày đưa vào sử dụng"); break;
                            case Truong.NguyenGia: d.NguyenGia = DocSo(o); break;
                            case Truong.SoNam: { double? v = DocSo(o); if (v.HasValue) d.SoNam = (int)Math.Round(v.Value); break; }
                            case Truong.TinhTrang: d.TinhTrang = Chu(o); break;
                            case Truong.BaoTri: d.BaoTriCuoi = DocNgay(o, "Bảo dưỡng lần cuối"); break;
                            case Truong.ChuKy: { double? v = DocSo(o); if (v.HasValue) d.ChuKy = (int)Math.Round(v.Value); break; }
                            case Truong.BaoHanh: d.BaoHanh = DocNgay(o, "Bảo hành đến"); break;
                            case Truong.GhiChu: d.GhiChu = Chu(o); break;
                            case Truong.ThongSo:
                                foreach (string p in Chu(o).Split(';', '\n'))
                                {
                                    int c = p.IndexOf(':');
                                    if (c > 0 && p.Substring(c + 1).Trim().Length > 0)
                                        d.ThongSo.Add(new KeyValuePair<string, string>(p.Substring(0, c).Trim(), p.Substring(c + 1).Trim()));
                                }
                                break;
                            case Truong.ToaDo:
                                {
                                    string[] p = Chu(o).Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                    double a, b;
                                    if (p.Length == 2 && double.TryParse(p[0], NumberStyles.Float, Inv, out a) && double.TryParse(p[1], NumberStyles.Float, Inv, out b) &&
                                        Math.Abs(a) <= 90 && Math.Abs(b) <= 180) { d.ViDo = a; d.KinhDo = b; }
                                    else d.CanhBao.Add("toạ độ \"" + Chu(o) + "\" không đọc được (ghi dạng 9.7845, 105.4701)");
                                    break;
                                }
                        }
                    }
                    catch (LoiApi ex)
                    {
                        d.Loi = ex.Message;
                    }
                }
                foreach (var kv in cotThongSo)
                {
                    string v = Chu(trang.Lay(r, kv.Key));
                    if (v.Length == 0) continue;
                    coGi = true;
                    d.ThongSo.Add(new KeyValuePair<string, string>(kv.Value, v));
                }
                if (!coGi) { trong++; continue; }
                trong = 0;
                ds.Add(d);
            }
            if (ds.Count == 0) throw new LoiApi(400, "File không có dòng tài sản nào dưới dòng tiêu đề.");
            if (ds.Count > 20000) throw new LoiApi(400, "Tối đa 20.000 dòng mỗi lần nhập.");
            O kq = dv.NhapHangLoat(tk, ds, thu);
            kq["trang"] = trang.Ten;
            kq["dongTieuDe"] = dongTieuDe;
            kq["cot"] = cot.OrderBy(x => x.Key).Select(x => (object)(XlsxReader.TenCot(x.Key) + ": " + trang.Chu(dongTieuDe, x.Key).Trim()))
                           .Concat(cotThongSo.Select(x => (object)(XlsxReader.TenCot(x.Key) + ": " + x.Value + " (thông số)"))).ToList();
            return kq;
        }
    }

    partial class DichVu
    {
        /// <summary>Áp các dòng đọc từ Excel trong 1 lần khoá, lưu 1 lần. thu = chỉ xem trước, không đổi gì.</summary>
        public O NhapHangLoat(TaiKhoan tk, List<BaoCao.DongNhap> ds, bool thu)
        {
            lock (Khoa)
            {
                var loaiMoi = new List<string>();
                var donViMoi = new List<string>();
                var loi = new List<object>();
                var canhBao = new List<object>();
                var xem = new List<object>();
                var maTrongFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var taoLoai = new Dictionary<string, LoaiTaiSan>();
                var taoDonVi = new Dictionary<string, DonVi>();
                int them = 0, capNhat = 0, khongDoi = 0;
                DateTime bayGio = DateTime.Now;
                var suKien = new List<SuKien>();
                var tienToDuKien = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

                Func<string, LoaiTaiSan> timLoai = ten =>
                {
                    string k = VanBan.BoDau(ten).Trim();
                    LoaiTaiSan l = Dl.Loai.FirstOrDefault(x => VanBan.BoDau(x.Ten) == k) ?? Dl.Loai.FirstOrDefault(x => VanBan.BoDau(x.TienTo) == k);
                    if (l != null) return l;
                    if (taoLoai.TryGetValue(k, out l)) return l;
                    string tt = new string(VanBan.BoDauGiuHoa(ten).Split(new[] { ' ', ',', '-' }, StringSplitOptions.RemoveEmptyEntries)
                                           .Select(w => char.ToUpperInvariant(w[0])).Where(c => char.IsLetterOrDigit(c)).Take(3).ToArray());
                    l = new LoaiTaiSan { Ten = VanBan.Cat(ten, 120), TienTo = MaTaiSan.ChuanTienTo(tt), Nhom = "Tài sản cố định khác", SoNamKhauHao = 5 };
                    taoLoai[k] = l;
                    loaiMoi.Add(l.Ten);
                    return l;
                };
                Func<string, DonVi> timDonVi = ten =>
                {
                    string k = VanBan.BoDau(ten).Trim();
                    DonVi d = Dl.DonVi.FirstOrDefault(x => VanBan.BoDau(x.Ten) == k);
                    if (d != null) return d;
                    if (taoDonVi.TryGetValue(k, out d)) return d;
                    d = new DonVi { Ten = VanBan.Cat(ten, 120), Khoi = Khoi.TuTen(ten) };
                    taoDonVi[k] = d;
                    donViMoi.Add(d.Ten);
                    return d;
                };
                Action<LoaiTaiSan> ganIdLoai = l => { if (l.Id == 0 && !thu) { l.Id = ++Dl.IdLoai; Dl.Loai.Add(l); } };
                Action<DonVi> ganIdDonVi = d => { if (d.Id == 0 && !thu) { d.Id = ++Dl.IdDonVi; Dl.DonVi.Add(d); } };

                foreach (BaoCao.DongNhap d in ds)
                {
                    string hanhDong;
                    try
                    {
                        if (d.Loi != null) throw new LoiApi(400, d.Loi);
                        string ma = MaTaiSan.Chuan(d.Ma);
                        if (ma.Length > 0 && !MaTaiSan.HopLe(ma)) throw new LoiApi(400, "mã \"" + d.Ma + "\" có ký tự không dùng được (chỉ chữ không dấu, số, - . _)");
                        if (ma.Length > 0 && !maTrongFile.Add(ma)) throw new LoiApi(400, "mã " + ma + " lặp lại trong file");
                        string tt = null;
                        if (!string.IsNullOrEmpty(d.TinhTrang))
                        {
                            tt = TinhTrang.TuChu(d.TinhTrang);
                            if (tt == null) d.CanhBao.Add("tình trạng \"" + d.TinhTrang + "\" không rõ — để \"Đang sử dụng tốt\"");
                        }
                        TaiSan cu = ma.Length > 0 ? Dl.TimMa(ma) : null;
                        if (cu == null && d.Ten.Length == 0) throw new LoiApi(400, "thiếu tên tài sản");
                        if (cu != null && tk.VaiTro < VaiTro.QuanTri && tk.DonVi >= 0 && cu.DonViId != tk.DonVi) throw new LoiApi(400, "tài sản thuộc đơn vị khác");
                        LoaiTaiSan loai = d.Loai.Length > 0 ? timLoai(d.Loai) : cu != null ? Dl.TimLoai(cu.LoaiId) : timLoai("Tài sản khác");
                        DonVi donVi = d.DonVi.Length > 0 ? timDonVi(d.DonVi) : cu != null ? Dl.TimDonVi(cu.DonViId) : timDonVi("Chưa xác định đơn vị");
                        if (cu == null && d.DonVi.Length == 0) d.CanhBao.Add("thiếu đơn vị — đưa vào \"Chưa xác định đơn vị\"");
                        var nhap = new TaiSan();
                        if (cu != null) ChepThongTin(cu, nhap);
                        if (d.Ten.Length > 0) nhap.Ten = VanBan.Cat(d.Ten, 200);
                        if (d.ViTri != null) nhap.ViTri = d.ViTri;
                        if (d.NguoiSuDung != null) nhap.NguoiSuDung = d.NguoiSuDung;
                        if (d.HangSX != null) nhap.HangSX = d.HangSX;
                        if (d.Model != null) nhap.Model = d.Model;
                        if (d.SoSeri != null) nhap.SoSeri = d.SoSeri;
                        if (d.NuocSX != null) nhap.NuocSX = d.NuocSX;
                        if (d.GhiChu != null) nhap.GhiChu = d.GhiChu;
                        if (d.NamSX.HasValue)
                        {
                            if (d.NamSX < 1900 || d.NamSX > DateTime.Today.Year + 1) throw new LoiApi(400, "năm sản xuất " + d.NamSX + " không hợp lệ");
                            nhap.NamSX = d.NamSX;
                        }
                        if (d.NgaySuDung.HasValue) nhap.NgaySuDung = d.NgaySuDung;
                        if (d.NguyenGia.HasValue)
                        {
                            if (d.NguyenGia < 0 || d.NguyenGia > 1e15) throw new LoiApi(400, "nguyên giá không hợp lệ");
                            nhap.NguyenGia = Math.Round(d.NguyenGia.Value);
                        }
                        if (d.SoNam.HasValue)
                        {
                            if (d.SoNam < 0 || d.SoNam > 100) throw new LoiApi(400, "số năm khấu hao 0–100");
                            nhap.SoNamKhauHao = d.SoNam == loai.SoNamKhauHao && cu == null ? null : d.SoNam;
                        }
                        if (d.ChuKy.HasValue)
                        {
                            if (d.ChuKy < 0 || d.ChuKy > 3650) throw new LoiApi(400, "chu kỳ bảo dưỡng 0–3650 ngày");
                            nhap.ChuKyBaoTri = d.ChuKy == loai.ChuKyBaoTri && cu == null ? null : d.ChuKy;
                        }
                        if (d.BaoTriCuoi.HasValue) nhap.BaoTriCuoi = d.BaoTriCuoi;
                        if (d.BaoHanh.HasValue) nhap.BaoHanhDen = d.BaoHanh;
                        if (d.ViDo.HasValue) { nhap.ViDo = d.ViDo; nhap.KinhDo = d.KinhDo; }
                        nhap.TinhTrang = tt ?? (cu != null ? cu.TinhTrang : TinhTrang.Tot);
                        foreach (var p in d.ThongSo)
                        {
                            nhap.ThongSo.RemoveAll(x => string.Equals(x.Key, p.Key, StringComparison.OrdinalIgnoreCase));
                            nhap.ThongSo.Add(p);
                        }
                        if (cu == null)
                        {
                            if (tk.VaiTro < VaiTro.QuanTri && tk.DonVi >= 0 && donVi.Id != tk.DonVi) throw new LoiApi(400, "chỉ được nhập tài sản của đơn vị mình");
                            hanhDong = "thêm";
                            them++;
                            if (!thu)
                            {
                                ganIdLoai(loai);
                                ganIdDonVi(donVi);
                                nhap.LoaiId = loai.Id;
                                nhap.DonViId = donVi.Id;
                                var t = new TaiSan { Id = ++Dl.IdTaiSan, Ma = ma.Length > 0 ? ma : Dl.CapMa(loai.TienTo), Tao = bayGio, NguoiTao = tk.Ten };
                                Dl.GhiNhanMa(t.Ma);
                                ChepThongTin(nhap, t);
                                t.Sua = bayGio;
                                t.NguoiSua = tk.Ten;
                                Dl.Them(t);
                                ThemVaoDotMo(t);
                                ma = t.Ma;
                                SuKien s = MoiSuKien(tk, t, LoaiSuKien.Tao);
                                s.TinhTrang = t.TinhTrang;
                                s.ChiTiet = "Nhập từ Excel (dòng " + d.Dong + ")";
                                suKien.Add(s);
                            }
                            else if (ma.Length == 0)
                            {
                                int cong;
                                tienToDuKien.TryGetValue(loai.TienTo, out cong);
                                tienToDuKien[loai.TienTo] = cong + 1;
                                ma = Dl.MaKeTiep(loai.TienTo, cong + 1) + " (tự cấp)";
                            }
                        }
                        else
                        {
                            if (!thu)
                            {
                                ganIdLoai(loai);
                                ganIdDonVi(donVi);
                            }
                            nhap.LoaiId = loai.Id;
                            nhap.DonViId = donVi.Id;
                            List<string> doi = loai.Id == 0 || donVi.Id == 0 ? new List<string> { "loại / đơn vị mới" } : SoSanh(cu, nhap, cu.Ma);
                            if (doi.Count == 0) { hanhDong = "không đổi"; khongDoi++; }
                            else
                            {
                                hanhDong = "cập nhật";
                                capNhat++;
                                if (!thu)
                                {
                                    ChepThongTin(nhap, cu);
                                    cu.PhienBan++;
                                    cu.Sua = bayGio;
                                    cu.NguoiSua = tk.Ten;
                                    SuKien s = MoiSuKien(tk, cu, LoaiSuKien.Sua);
                                    s.ChiTiet = "Nhập từ Excel (dòng " + d.Dong + ")\n" + string.Join("\n", doi);
                                    suKien.Add(s);
                                }
                            }
                        }
                        foreach (string c in d.CanhBao) canhBao.Add(new O { { "dong", d.Dong }, { "noiDung", c } });
                        if (xem.Count < 30)
                            xem.Add(new O { { "dong", d.Dong }, { "ma", ma }, { "ten", nhap.Ten }, { "loai", loai.Ten }, { "donVi", donVi.Ten }, { "hanhDong", hanhDong } });
                    }
                    catch (LoiApi ex)
                    {
                        loi.Add(new O { { "dong", d.Dong }, { "ma", d.Ma }, { "ten", d.Ten }, { "loi", ex.Message } });
                    }
                }
                if (!thu && (them > 0 || capNhat > 0 || loaiMoi.Count > 0 || donViMoi.Count > 0))
                {
                    Kho.Luu();
                    foreach (SuKien s in suKien) Kho.GhiSuKien(s);
                    Ghi("Nhập Excel bởi '" + tk.Ten + "': thêm " + them + ", cập nhật " + capNhat + ", lỗi " + loi.Count);
                }
                return new O
                {
                    { "thu", thu }, { "soDong", ds.Count }, { "them", them }, { "capNhat", capNhat }, { "khongDoi", khongDoi },
                    { "loaiMoi", loaiMoi }, { "donViMoi", donViMoi }, { "loi", loi.Take(300).ToList() }, { "soLoi", loi.Count },
                    { "canhBao", canhBao.Take(300).ToList() }, { "xem", xem }
                };
            }
        }
    }
}
