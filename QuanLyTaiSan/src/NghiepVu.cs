using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace QuanLyTaiSan
{
    /// <summary>Nghiệp vụ tài sản: danh mục, khai báo / sửa, lịch sử, ảnh, kiểm kê. Mọi hàm tự lấy khoá và lưu dữ liệu.</summary>
    partial class DichVu
    {
        // ------------------------------------------------------------------ quyền

        public static void CanQuyen(TaiKhoan tk, VaiTro can)
        {
            if (tk.VaiTro >= can) return;
            switch (can)
            {
                case VaiTro.QuanTri: throw new LoiApi(403, "Cần tài khoản quản trị.");
                case VaiTro.CapNhat: throw new LoiApi(403, "Tài khoản này không được thêm / sửa tài sản.");
                default: throw new LoiApi(403, "Tài khoản này chỉ được xem.");
            }
        }

        /// <summary>Tài khoản giới hạn 1 đơn vị chỉ sửa được tài sản của đơn vị đó.</summary>
        void CanDonVi(TaiKhoan tk, int donVi)
        {
            if (tk.VaiTro == VaiTro.QuanTri || tk.DonVi < 0 || tk.DonVi == donVi) return;
            throw new LoiApi(403, "Tài khoản này chỉ được sửa tài sản của " + Dl.TenDonVi(tk.DonVi) + ".");
        }

        public bool DuocSua(TaiKhoan tk, TaiSan t)
        {
            return tk.VaiTro >= VaiTro.CapNhat && (tk.VaiTro == VaiTro.QuanTri || tk.DonVi < 0 || tk.DonVi == t.DonViId);
        }

        TaiSan LayTaiSan(int id)
        {
            TaiSan t = Dl.Tim(id);
            if (t == null) throw new LoiApi(404, "Không có tài sản này (có thể đã bị xoá).");
            return t;
        }

        SuKien MoiSuKien(TaiKhoan tk, TaiSan t, string loai)
        {
            return new SuKien { TaiSan = t.Id, Loai = loai, Luc = DateTime.Now, Nguoi = tk.Ten, HoTen = tk.HoTen.Length > 0 ? tk.HoTen : tk.Ten };
        }

        void LuuDuLieu()
        {
            Kho.Luu();
        }

        // ------------------------------------------------------------------ danh mục

        public LoaiTaiSan LuuLoai(TaiKhoan tk, int id, string ten, string tienTo, string nhom, int soNam, int chuKy, List<string> truong)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            ten = VanBan.Cat(ten, 120);
            if (ten.Length == 0) throw new LoiApi(400, "Nhập tên loại tài sản.");
            if (soNam < 0 || soNam > 100) throw new LoiApi(400, "Số năm khấu hao 0–100.");
            if (chuKy < 0 || chuKy > 3650) throw new LoiApi(400, "Chu kỳ bảo dưỡng 0–3650 ngày.");
            lock (Khoa)
            {
                LoaiTaiSan l = id > 0 ? Dl.TimLoai(id) : null;
                if (id > 0 && l == null) throw new LoiApi(404, "Không có loại tài sản này.");
                if (Dl.Loai.Any(x => x != l && string.Equals(x.Ten, ten, StringComparison.OrdinalIgnoreCase))) throw new LoiApi(400, "Đã có loại \"" + ten + "\".");
                if (l == null)
                {
                    l = new LoaiTaiSan { Id = ++Dl.IdLoai };
                    Dl.Loai.Add(l);
                }
                l.Ten = ten;
                l.TienTo = MaTaiSan.ChuanTienTo(tienTo);
                l.Nhom = VanBan.Cat(nhom, 120);
                l.SoNamKhauHao = soNam;
                l.ChuKyBaoTri = chuKy;
                l.Truong = truong.Select(x => VanBan.Cat(x, 60)).Where(x => x.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).Take(30).ToList();
                LuuDuLieu();
                return l;
            }
        }

        public void XoaLoai(TaiKhoan tk, int id)
        {
            CanQuyen(tk, VaiTro.QuanTri);
            lock (Khoa)
            {
                LoaiTaiSan l = Dl.TimLoai(id);
                if (l == null) throw new LoiApi(404, "Không có loại tài sản này.");
                int n = Dl.TaiSan.Count(t => t.LoaiId == id);
                if (n > 0) throw new LoiApi(400, "Còn " + n + " tài sản thuộc loại này — chuyển sang loại khác trước khi xoá.");
                Dl.Loai.Remove(l);
                LuuDuLieu();
            }
        }

        /// <param name="khoi">Khoi.Doi / Khoi.VanPhong; trống = giữ khối cũ (đơn vị mới: đoán theo tên)</param>
        public DonVi LuuDonVi(TaiKhoan tk, int id, string ten, string ghiChu, string khoi)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            ten = VanBan.Cat(ten, 120);
            if (ten.Length == 0) throw new LoiApi(400, "Nhập tên đơn vị.");
            lock (Khoa)
            {
                DonVi d = id > 0 ? Dl.TimDonVi(id) : null;
                if (id > 0 && d == null) throw new LoiApi(404, "Không có đơn vị này.");
                if (Dl.DonVi.Any(x => x != d && string.Equals(x.Ten, ten, StringComparison.OrdinalIgnoreCase))) throw new LoiApi(400, "Đã có đơn vị \"" + ten + "\".");
                if (d == null)
                {
                    d = new DonVi { Id = ++Dl.IdDonVi };
                    Dl.DonVi.Add(d);
                }
                bool moi = d.Ten.Length == 0;
                d.Ten = ten;
                d.GhiChu = VanBan.Cat(ghiChu, 300);
                if (!string.IsNullOrEmpty(khoi)) d.Khoi = Khoi.Chuan(khoi);
                else if (moi) d.Khoi = Khoi.TuTen(ten);
                LuuDuLieu();
                return d;
            }
        }

        public void XoaDonVi(TaiKhoan tk, int id)
        {
            CanQuyen(tk, VaiTro.QuanTri);
            lock (Khoa)
            {
                DonVi d = Dl.TimDonVi(id);
                if (d == null) throw new LoiApi(404, "Không có đơn vị này.");
                int n = Dl.TaiSan.Count(t => t.DonViId == id);
                if (n > 0) throw new LoiApi(400, "Còn " + n + " tài sản của đơn vị này — điều chuyển trước khi xoá.");
                if (DanhSachTaiKhoan().Any(t => t.DonVi == id)) throw new LoiApi(400, "Còn tài khoản giới hạn theo đơn vị này.");
                Dl.DonVi.Remove(d);
                LuuDuLieu();
            }
        }

        public void LuuCaiDat(TaiKhoan tk, Dictionary<string, object> b)
        {
            CanQuyen(tk, VaiTro.QuanTri);
            string qr = Json.Gon(b, "diaChiQr", 200).TrimEnd('/');
            if (qr.Length > 0 && !qr.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && !qr.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                throw new LoiApi(400, "Địa chỉ in trên mã QR phải bắt đầu bằng https://");
            lock (Khoa)
            {
                CaiDat c = Dl.CaiDat;
                c.TenCongTy = Json.Gon(b, "tenCongTy", 200);
                c.DiaChiQr = qr;
                c.DiaDanh = Json.Gon(b, "diaDanh", 80);
                c.NguoiLap = Json.Gon(b, "nguoiLap", 80);
                c.KeToanTruong = Json.Gon(b, "keToanTruong", 80);
                c.GiamDoc = Json.Gon(b, "giamDoc", 80);
                c.NgayNhacKiemTra = Math.Max(0, Math.Min(3650, Json.So(b, "ngayNhacKiemTra", 180)));
                LuuDuLieu();
            }
            Ghi("Sửa cài đặt bởi '" + tk.Ten + "'");
        }

        // ------------------------------------------------------------------ khai báo / sửa tài sản

        static string So(double? v) { return v.HasValue ? v.Value.ToString("#,##0.##", CultureInfo.GetCultureInfo("vi-VN")) : "(trống)"; }
        static string Chu(string v) { return string.IsNullOrEmpty(v) ? "(trống)" : v; }

        static void Doi(List<string> ds, string ten, string cu, string moi)
        {
            if ((cu ?? "") != (moi ?? "")) ds.Add(ten + ": " + Chu(cu) + " → " + Chu(moi));
        }

        /// <summary>Thêm mới (nhap.Id = 0) hoặc sửa tài sản. phienBanGoc = phiên bản người dùng đã mở (0 = không kiểm).</summary>
        public TaiSan LuuTaiSan(TaiKhoan tk, TaiSan nhap, int phienBanGoc)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            nhap.Ten = VanBan.Cat(nhap.Ten, 200);
            if (nhap.Ten.Length == 0) throw new LoiApi(400, "Nhập tên tài sản.");
            if (!TinhTrang.HopLe(nhap.TinhTrang)) throw new LoiApi(400, "Tình trạng không hợp lệ.");
            if (nhap.NguyenGia.HasValue && (nhap.NguyenGia < 0 || nhap.NguyenGia > 1e15)) throw new LoiApi(400, "Nguyên giá không hợp lệ.");
            if (nhap.NamSX.HasValue && (nhap.NamSX < 1900 || nhap.NamSX > DateTime.Today.Year + 1)) throw new LoiApi(400, "Năm sản xuất không hợp lệ.");
            if (nhap.SoNamKhauHao.HasValue && (nhap.SoNamKhauHao < 0 || nhap.SoNamKhauHao > 100)) throw new LoiApi(400, "Số năm khấu hao 0–100.");
            if (nhap.ChuKyBaoTri.HasValue && (nhap.ChuKyBaoTri < 0 || nhap.ChuKyBaoTri > 3650)) throw new LoiApi(400, "Chu kỳ bảo dưỡng 0–3650 ngày.");
            if (nhap.ViDo.HasValue != nhap.KinhDo.HasValue || nhap.ViDo.HasValue && (Math.Abs(nhap.ViDo.Value) > 90 || Math.Abs(nhap.KinhDo.Value) > 180))
                throw new LoiApi(400, "Toạ độ không hợp lệ.");
            lock (Khoa)
            {
                LoaiTaiSan loai = Dl.TimLoai(nhap.LoaiId);
                if (loai == null) throw new LoiApi(400, "Chọn loại tài sản.");
                if (Dl.TimDonVi(nhap.DonViId) == null) throw new LoiApi(400, "Chọn đơn vị quản lý.");
                CanDonVi(tk, nhap.DonViId);
                string ma = MaTaiSan.Chuan(nhap.Ma);
                if (ma.Length > 0 && !MaTaiSan.HopLe(ma))
                    throw new LoiApi(400, "Mã tài sản chỉ gồm chữ không dấu, số, dấu - . _ (tối đa 40 ký tự).");
                TaiSan khac = ma.Length > 0 ? Dl.TimMa(ma) : null;
                DateTime bayGio = DateTime.Now;
                if (nhap.Id == 0)
                {
                    if (khac != null) throw new LoiApi(400, "Mã " + ma + " đã dùng cho \"" + khac.Ten + "\".");
                    var t = new TaiSan { Id = ++Dl.IdTaiSan, Ma = ma.Length > 0 ? ma : Dl.CapMa(loai.TienTo), Tao = bayGio, NguoiTao = tk.Ten };
                    Dl.GhiNhanMa(t.Ma);
                    ChepThongTin(nhap, t);
                    t.Sua = bayGio;
                    t.NguoiSua = tk.Ten;
                    Dl.Them(t);
                    LuuDuLieu();
                    SuKien s = MoiSuKien(tk, t, LoaiSuKien.Tao);
                    s.TinhTrang = t.TinhTrang;
                    Kho.GhiSuKien(s);
                    return t;
                }
                TaiSan cu = LayTaiSan(nhap.Id);
                CanDonVi(tk, cu.DonViId);
                if (phienBanGoc > 0 && phienBanGoc != cu.PhienBan)
                    throw new LoiApi(409, "Tài sản vừa được " + (cu.NguoiSua.Length > 0 ? cu.NguoiSua : "người khác") + " sửa. Hãy mở lại để xem bản mới rồi sửa tiếp.");
                if (ma.Length == 0) ma = cu.Ma;
                if (khac != null && khac != cu) throw new LoiApi(400, "Mã " + ma + " đã dùng cho \"" + khac.Ten + "\".");
                List<string> doi = SoSanh(cu, nhap, ma);
                if (doi.Count == 0) return cu;
                if (ma != cu.Ma)
                {
                    Dl.DoiMa(cu, ma);
                    Dl.GhiNhanMa(ma);
                }
                ChepThongTin(nhap, cu);
                cu.PhienBan++;
                cu.Sua = bayGio;
                cu.NguoiSua = tk.Ten;
                LuuDuLieu();
                SuKien sk = MoiSuKien(tk, cu, LoaiSuKien.Sua);
                sk.ChiTiet = string.Join("\n", doi);
                Kho.GhiSuKien(sk);
                return cu;
            }
        }

        static void ChepThongTin(TaiSan tu, TaiSan den)
        {
            den.Ten = tu.Ten; den.LoaiId = tu.LoaiId; den.DonViId = tu.DonViId;
            den.ViTri = VanBan.Cat(tu.ViTri, 300); den.NguoiSuDung = VanBan.Cat(tu.NguoiSuDung, 120);
            den.HangSX = VanBan.Cat(tu.HangSX, 120); den.Model = VanBan.Cat(tu.Model, 120); den.SoSeri = VanBan.Cat(tu.SoSeri, 120);
            den.NuocSX = VanBan.Cat(tu.NuocSX, 80); den.NamSX = tu.NamSX; den.NgaySuDung = tu.NgaySuDung; den.NguyenGia = tu.NguyenGia;
            den.SoNamKhauHao = tu.SoNamKhauHao; den.BaoHanhDen = tu.BaoHanhDen; den.ChuKyBaoTri = tu.ChuKyBaoTri; den.BaoTriCuoi = tu.BaoTriCuoi;
            den.TinhTrang = tu.TinhTrang; den.ViDo = tu.ViDo; den.KinhDo = tu.KinhDo;
            den.GhiChu = VanBan.Cat(tu.GhiChu, 4000);
            den.ThongSo.Clear();
            foreach (var p in tu.ThongSo)
            {
                string k = VanBan.Cat(p.Key, 60), v = VanBan.Cat(p.Value, 300);
                if (k.Length > 0 && v.Length > 0 && !den.ThongSo.Any(x => string.Equals(x.Key, k, StringComparison.OrdinalIgnoreCase)))
                    den.ThongSo.Add(new KeyValuePair<string, string>(k, v));
            }
            den.DaDoi();
        }

        List<string> SoSanh(TaiSan cu, TaiSan moi, string maMoi)
        {
            var d = new List<string>();
            Doi(d, "Mã", cu.Ma, maMoi);
            Doi(d, "Tên", cu.Ten, VanBan.Cat(moi.Ten, 200));
            Doi(d, "Loại", Dl.TenLoai(cu.LoaiId), Dl.TenLoai(moi.LoaiId));
            Doi(d, "Đơn vị", Dl.TenDonVi(cu.DonViId), Dl.TenDonVi(moi.DonViId));
            Doi(d, "Vị trí", cu.ViTri, VanBan.Cat(moi.ViTri, 300));
            Doi(d, "Người sử dụng", cu.NguoiSuDung, VanBan.Cat(moi.NguoiSuDung, 120));
            Doi(d, "Hãng sản xuất", cu.HangSX, VanBan.Cat(moi.HangSX, 120));
            Doi(d, "Model", cu.Model, VanBan.Cat(moi.Model, 120));
            Doi(d, "Số seri", cu.SoSeri, VanBan.Cat(moi.SoSeri, 120));
            Doi(d, "Nước sản xuất", cu.NuocSX, VanBan.Cat(moi.NuocSX, 80));
            Doi(d, "Năm sản xuất", cu.NamSX.HasValue ? cu.NamSX.Value.ToString() : "", moi.NamSX.HasValue ? moi.NamSX.Value.ToString() : "");
            Doi(d, "Ngày đưa vào sử dụng", VanBan.NgayVn(cu.NgaySuDung), VanBan.NgayVn(moi.NgaySuDung));
            if (cu.NguyenGia != moi.NguyenGia) d.Add("Nguyên giá: " + So(cu.NguyenGia) + " → " + So(moi.NguyenGia));
            if (cu.SoNamKhauHao != moi.SoNamKhauHao) d.Add("Số năm khấu hao: " + So(cu.SoNamKhauHao) + " → " + So(moi.SoNamKhauHao));
            Doi(d, "Bảo hành đến", VanBan.NgayVn(cu.BaoHanhDen), VanBan.NgayVn(moi.BaoHanhDen));
            if (cu.ChuKyBaoTri != moi.ChuKyBaoTri) d.Add("Chu kỳ bảo dưỡng (ngày): " + So(cu.ChuKyBaoTri) + " → " + So(moi.ChuKyBaoTri));
            Doi(d, "Bảo dưỡng lần cuối", VanBan.NgayVn(cu.BaoTriCuoi), VanBan.NgayVn(moi.BaoTriCuoi));
            Doi(d, "Tình trạng", TinhTrang.Ten(cu.TinhTrang), TinhTrang.Ten(moi.TinhTrang));
            if (cu.ViDo != moi.ViDo || cu.KinhDo != moi.KinhDo) d.Add("Toạ độ: " + ToaDo(cu.ViDo, cu.KinhDo) + " → " + ToaDo(moi.ViDo, moi.KinhDo));
            Doi(d, "Ghi chú", cu.GhiChu, VanBan.Cat(moi.GhiChu, 4000));
            var ten = cu.ThongSo.Select(x => x.Key).Concat(moi.ThongSo.Select(x => x.Key)).Distinct(StringComparer.OrdinalIgnoreCase);
            foreach (string k in ten) Doi(d, k, cu.LayThongSo(k), VanBan.Cat(moi.LayThongSo(k), 300));
            return d;
        }

        static string ToaDo(double? vd, double? kd)
        {
            return vd.HasValue && kd.HasValue ? vd.Value.ToString("0.######", CultureInfo.InvariantCulture) + ", " + kd.Value.ToString("0.######", CultureInfo.InvariantCulture) : "(trống)";
        }

        public void XoaTaiSan(TaiKhoan tk, int id)
        {
            CanQuyen(tk, VaiTro.QuanTri);
            lock (Khoa)
            {
                TaiSan t = LayTaiSan(id);
                Dl.Bo(t);
                foreach (DotKiemKe d in Dl.KiemKe) d.DanhSach.Remove(id);
                LuuDuLieu();
                Ghi("Xoá tài sản " + t.Ma + " \"" + t.Ten + "\" (id " + t.Id + ") bởi '" + tk.Ten + "'. Ảnh vẫn giữ trong Anh\\" + t.Id);
            }
        }

        /// <summary>Cấp trước 1 dãy mã để in tem dán lên tài sản trước, khai báo sau (quét tem → tạo tài sản với mã đó).</summary>
        public List<string> DatTruocMa(TaiKhoan tk, string tienTo, int soLuong)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            if (soLuong < 1 || soLuong > 1000) throw new LoiApi(400, "Số tem 1–1000.");
            lock (Khoa)
            {
                var ds = new List<string>();
                for (int i = 0; i < soLuong; i++) ds.Add(Dl.CapMa(tienTo));
                LuuDuLieu();
                Ghi("Cấp trước " + soLuong + " mã " + ds[0] + " … " + ds[ds.Count - 1] + " bởi '" + tk.Ten + "'");
                return ds;
            }
        }

        // ------------------------------------------------------------------ lịch sử: kiểm tra, bảo dưỡng, điều chuyển, thanh lý

        public class YeuCauSuKien
        {
            public string Loai, TinhTrang, NoiDung = "";
            public double? ChiPhi, ViDo, KinhDo;
            public bool CapNhatToaDo;
            public DateTime? Ngay;
            public int DonVi;
            public string ViTri, NguoiSuDung;
            public List<string> Anh = new List<string>();
        }

        public SuKien GhiSuKien(TaiKhoan tk, int taiSan, YeuCauSuKien y)
        {
            if (y.TinhTrang != null && !TinhTrang.HopLe(y.TinhTrang)) throw new LoiApi(400, "Tình trạng không hợp lệ.");
            if (y.ViDo.HasValue != y.KinhDo.HasValue || y.ViDo.HasValue && (Math.Abs(y.ViDo.Value) > 90 || Math.Abs(y.KinhDo.Value) > 180))
                throw new LoiApi(400, "Toạ độ không hợp lệ.");
            if (y.ChiPhi.HasValue && (y.ChiPhi < 0 || y.ChiPhi > 1e13)) throw new LoiApi(400, "Chi phí không hợp lệ.");
            y.NoiDung = VanBan.Cat(y.NoiDung, 2000);
            lock (Khoa)
            {
                TaiSan t = LayTaiSan(taiSan);
                SuKien s = MoiSuKien(tk, t, y.Loai);
                var doi = new List<string>();
                switch (y.Loai)
                {
                    case LoaiSuKien.KiemTra:
                        CanQuyen(tk, VaiTro.KiemTra);
                        s.TinhTrang = y.TinhTrang ?? t.TinhTrang;
                        break;
                    case LoaiSuKien.BaoTri:
                        CanQuyen(tk, VaiTro.KiemTra);
                        if (y.NoiDung.Length == 0) throw new LoiApi(400, "Ghi nội dung bảo dưỡng / sửa chữa.");
                        DateTime ngay = (y.Ngay ?? DateTime.Today).Date;
                        if (ngay > DateTime.Today.AddDays(1)) throw new LoiApi(400, "Ngày bảo dưỡng không được sau hôm nay.");
                        s.TinhTrang = y.TinhTrang ?? TinhTrang.Tot;
                        s.ChiPhi = y.ChiPhi;
                        if (ngay != DateTime.Today) s.ChiTiet = "Ngày thực hiện: " + VanBan.NgayVn(ngay);
                        if (!t.BaoTriCuoi.HasValue || ngay > t.BaoTriCuoi.Value) t.BaoTriCuoi = ngay;
                        break;
                    case LoaiSuKien.DieuChuyen:
                        CanQuyen(tk, VaiTro.CapNhat);
                        CanDonVi(tk, t.DonViId);
                        if (Dl.TimDonVi(y.DonVi) == null) throw new LoiApi(400, "Chọn đơn vị nhận.");
                        string viTri = VanBan.Cat(y.ViTri ?? t.ViTri, 300), nguoi = VanBan.Cat(y.NguoiSuDung ?? t.NguoiSuDung, 120);
                        Doi(doi, "Đơn vị", Dl.TenDonVi(t.DonViId), Dl.TenDonVi(y.DonVi));
                        Doi(doi, "Vị trí", t.ViTri, viTri);
                        Doi(doi, "Người sử dụng", t.NguoiSuDung, nguoi);
                        if (doi.Count == 0) throw new LoiApi(400, "Đơn vị, vị trí, người sử dụng không đổi.");
                        t.DonViId = y.DonVi;
                        t.ViTri = viTri;
                        t.NguoiSuDung = nguoi;
                        break;
                    case LoaiSuKien.ThanhLy:
                        CanQuyen(tk, VaiTro.CapNhat);
                        CanDonVi(tk, t.DonViId);
                        if (t.TinhTrang == TinhTrang.ThanhLy) throw new LoiApi(400, "Tài sản đã thanh lý.");
                        if (y.NoiDung.Length == 0) throw new LoiApi(400, "Ghi số quyết định / biên bản thanh lý.");
                        s.TinhTrang = TinhTrang.ThanhLy;
                        break;
                    default:
                        throw new LoiApi(400, "Loại ghi nhận không hợp lệ.");
                }
                foreach (string a in y.Anh.Distinct())
                {
                    if (!Kho.CoAnh(t.Id, a)) throw new LoiApi(400, "Ảnh đính kèm không còn trên máy chủ — hãy chụp lại.");
                    s.Anh.Add(a);
                }
                if (s.Anh.Count > 20) throw new LoiApi(400, "Tối đa 20 ảnh cho 1 lần ghi.");
                s.NoiDung = y.NoiDung;
                if (y.ViDo.HasValue)
                {
                    s.ViDo = y.ViDo;
                    s.KinhDo = y.KinhDo;
                    if (y.CapNhatToaDo && DuocSua(tk, t) || y.CapNhatToaDo && !t.ViDo.HasValue && tk.VaiTro >= VaiTro.KiemTra)
                    {
                        if (t.ViDo != y.ViDo || t.KinhDo != y.KinhDo) doi.Add("Toạ độ: " + ToaDo(t.ViDo, t.KinhDo) + " → " + ToaDo(y.ViDo, y.KinhDo));
                        t.ViDo = y.ViDo;
                        t.KinhDo = y.KinhDo;
                    }
                }
                if (s.TinhTrang != null && s.TinhTrang != t.TinhTrang)
                {
                    doi.Add("Tình trạng: " + TinhTrang.Ten(t.TinhTrang) + " → " + TinhTrang.Ten(s.TinhTrang));
                    t.TinhTrang = s.TinhTrang;
                }
                if (y.Loai == LoaiSuKien.KiemTra) t.KiemTraCuoi = s.Luc;
                if (doi.Count > 0) s.ChiTiet = (s.ChiTiet.Length > 0 ? s.ChiTiet + "\n" : "") + string.Join("\n", doi);
                t.PhienBan++;
                t.DaDoi();
                LuuDuLieu();
                Kho.GhiSuKien(s);
                return s;
            }
        }

        // ------------------------------------------------------------------ ảnh

        static bool LaJpeg(byte[] b)
        {
            return b != null && b.Length > 200 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF;
        }

        /// <summary>Lưu ảnh JPEG (trình duyệt đã thu nhỏ). boAnh = đưa vào bộ ảnh tài sản; false = ảnh đính kèm lần kiểm tra.</summary>
        public string ThemAnh(TaiKhoan tk, int taiSan, byte[] lon, byte[] nho, bool boAnh, bool chinh)
        {
            CanQuyen(tk, VaiTro.KiemTra);
            if (!LaJpeg(lon) || nho != null && !LaJpeg(nho)) throw new LoiApi(400, "Ảnh phải là JPEG.");
            if (lon.Length > 8 * 1024 * 1024) throw new LoiApi(413, "Ảnh quá lớn (tối đa 8 MB).");
            lock (Khoa)
            {
                TaiSan t = LayTaiSan(taiSan);
                if (boAnh && tk.VaiTro < VaiTro.CapNhat && t.Anh.Count >= 60) throw new LoiApi(400, "Tài sản đã có 60 ảnh.");
                string ma = Kho.LuuAnh(t.Id, lon, nho);
                if (boAnh)
                {
                    t.Anh.Add(ma);
                    if (chinh || t.Anh.Count == 1) t.AnhChinh = ma;
                    t.PhienBan++;
                    LuuDuLieu();
                    SuKien s = MoiSuKien(tk, t, LoaiSuKien.Anh);
                    s.Anh.Add(ma);
                    Kho.GhiSuKien(s);
                }
                return ma;
            }
        }

        public void BoAnh(TaiKhoan tk, int taiSan, string anh)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            lock (Khoa)
            {
                TaiSan t = LayTaiSan(taiSan);
                CanDonVi(tk, t.DonViId);
                if (!t.Anh.Remove(anh)) throw new LoiApi(404, "Ảnh không có trong bộ ảnh.");
                if (t.AnhChinh == anh) t.AnhChinh = "";
                t.PhienBan++;
                LuuDuLieu();
                SuKien s = MoiSuKien(tk, t, LoaiSuKien.Sua);
                s.ChiTiet = "Bỏ 1 ảnh khỏi bộ ảnh tài sản";
                Kho.GhiSuKien(s);
            }
        }

        public void DatAnhChinh(TaiKhoan tk, int taiSan, string anh)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            lock (Khoa)
            {
                TaiSan t = LayTaiSan(taiSan);
                CanDonVi(tk, t.DonViId);
                if (!t.Anh.Contains(anh)) throw new LoiApi(404, "Ảnh không có trong bộ ảnh.");
                t.AnhChinh = anh;
                t.PhienBan++;
                LuuDuLieu();
            }
        }

        // ------------------------------------------------------------------ kiểm kê

        public DotKiemKe LuuDot(TaiKhoan tk, int id, string ten, DateTime tuNgay, DateTime? denNgay, List<int> donVi, string ghiChu)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            ten = VanBan.Cat(ten, 160);
            if (ten.Length == 0) throw new LoiApi(400, "Nhập tên đợt kiểm kê.");
            if (denNgay.HasValue && denNgay < tuNgay) throw new LoiApi(400, "Ngày kết thúc trước ngày bắt đầu.");
            lock (Khoa)
            {
                foreach (int d in donVi) if (Dl.TimDonVi(d) == null) throw new LoiApi(400, "Không có đơn vị " + d + ".");
                DotKiemKe k;
                if (id > 0)
                {
                    k = Dl.TimDot(id);
                    if (k == null) throw new LoiApi(404, "Không có đợt kiểm kê này.");
                }
                else
                {
                    k = new DotKiemKe { Id = ++Dl.IdKiemKe, Tao = DateTime.Now, NguoiTao = tk.Ten, DonVi = donVi.Distinct().ToList() };
                    // sổ sách lúc mở đợt: tài sản còn quản lý của các đơn vị được chọn
                    foreach (TaiSan t in Dl.TaiSan)
                        if (TinhTrang.ConDung(t.TinhTrang) && (k.DonVi.Count == 0 || k.DonVi.Contains(t.DonViId))) k.DanhSach.Add(t.Id);
                    Dl.KiemKe.Add(k);
                }
                k.Ten = ten;
                k.TuNgay = tuNgay.Date;
                k.DenNgay = denNgay;
                k.GhiChu = VanBan.Cat(ghiChu, 1000);
                LuuDuLieu();
                if (id == 0) Ghi("Mở đợt kiểm kê '" + ten + "' (" + k.DanhSach.Count + " tài sản) bởi '" + tk.Ten + "'");
                return k;
            }
        }

        /// <summary>Đưa thêm vào sổ sách của đợt các tài sản khai báo sau khi mở đợt (thuộc phạm vi đơn vị của đợt).</summary>
        public int BoSungDot(TaiKhoan tk, int id)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            lock (Khoa)
            {
                DotKiemKe k = Dl.TimDot(id);
                if (k == null) throw new LoiApi(404, "Không có đợt kiểm kê này.");
                int n = 0;
                foreach (TaiSan t in Dl.TaiSan)
                    if (TinhTrang.ConDung(t.TinhTrang) && (k.DonVi.Count == 0 || k.DonVi.Contains(t.DonViId)) && k.DanhSach.Add(t.Id)) n++;
                if (n > 0) LuuDuLieu();
                return n;
            }
        }

        public void DongDot(TaiKhoan tk, int id, bool dong)
        {
            CanQuyen(tk, VaiTro.CapNhat);
            lock (Khoa)
            {
                DotKiemKe k = Dl.TimDot(id);
                if (k == null) throw new LoiApi(404, "Không có đợt kiểm kê này.");
                k.Dong = dong;
                if (dong && !k.DenNgay.HasValue) k.DenNgay = DateTime.Today;
                LuuDuLieu();
                Ghi((dong ? "Kết thúc" : "Mở lại") + " đợt kiểm kê '" + k.Ten + "' bởi '" + tk.Ten + "'");
            }
        }

        public void XoaDot(TaiKhoan tk, int id)
        {
            CanQuyen(tk, VaiTro.QuanTri);
            lock (Khoa)
            {
                DotKiemKe k = Dl.TimDot(id);
                if (k == null) throw new LoiApi(404, "Không có đợt kiểm kê này.");
                Dl.KiemKe.Remove(k);
                LuuDuLieu();
                Ghi("Xoá đợt kiểm kê '" + k.Ten + "' bởi '" + tk.Ten + "' (lịch sử kiểm kê của từng tài sản vẫn giữ)");
            }
        }

        public SuKien QuetKiemKe(TaiKhoan tk, int dot, int taiSan, string tinhTrang, string ghiChu, double? viDo, double? kinhDo, List<string> anh, out bool ngoaiDanhSach)
        {
            CanQuyen(tk, VaiTro.KiemTra);
            if (tinhTrang != null && !TinhTrang.HopLe(tinhTrang)) throw new LoiApi(400, "Tình trạng không hợp lệ.");
            if (viDo.HasValue != kinhDo.HasValue) throw new LoiApi(400, "Toạ độ không hợp lệ.");
            lock (Khoa)
            {
                DotKiemKe k = Dl.TimDot(dot);
                if (k == null) throw new LoiApi(404, "Không có đợt kiểm kê này.");
                if (k.Dong) throw new LoiApi(400, "Đợt kiểm kê \"" + k.Ten + "\" đã kết thúc.");
                TaiSan t = LayTaiSan(taiSan);
                ngoaiDanhSach = !k.DanhSach.Contains(t.Id);
                SuKien s = MoiSuKien(tk, t, LoaiSuKien.KiemKe);
                s.Dot = k.Id;
                s.TinhTrang = tinhTrang ?? t.TinhTrang;
                s.NoiDung = VanBan.Cat(ghiChu, 2000);
                s.ViDo = viDo;
                s.KinhDo = kinhDo;
                foreach (string a in (anh ?? new List<string>()).Distinct().Take(20))
                {
                    if (!Kho.CoAnh(t.Id, a)) throw new LoiApi(400, "Ảnh đính kèm không còn trên máy chủ — hãy chụp lại.");
                    s.Anh.Add(a);
                }
                var doi = new List<string> { "Đợt: " + k.Ten };
                if (ngoaiDanhSach) doi.Add("Ngoài sổ sách của đợt (đơn vị " + Dl.TenDonVi(t.DonViId) + ")");
                if (s.TinhTrang != t.TinhTrang)
                {
                    doi.Add("Tình trạng: " + TinhTrang.Ten(t.TinhTrang) + " → " + TinhTrang.Ten(s.TinhTrang));
                    t.TinhTrang = s.TinhTrang;
                }
                s.ChiTiet = string.Join("\n", doi);
                t.KiemTraCuoi = s.Luc;
                t.PhienBan++;
                t.DaDoi();
                LuuDuLieu();
                Kho.GhiSuKien(s);
                return s;
            }
        }
    }
}
