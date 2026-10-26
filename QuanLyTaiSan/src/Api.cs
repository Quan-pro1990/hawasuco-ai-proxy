using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;

namespace QuanLyTaiSan
{
    using O = Dictionary<string, object>;

    /// <summary>Các địa chỉ /api/... (JSON) cho trang web trên máy tính và điện thoại.</summary>
    static class Api
    {
        static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
        static readonly O Ok = new O { { "ok", true } };

        public static TraLoi XuLy(DichVu dv, NguCanh ctx)
        {
            string d = ctx.Duong.Substring(4).TrimEnd('/');
            string m = ctx.PhuongThuc == "HEAD" ? "GET" : ctx.PhuongThuc;
            if (d == "/ping" || d == "/trang-thai") return TraLoi.Json(Ping(dv));
            if (d == "/dangnhap" && m == "POST") return DangNhap(dv, ctx);
            if (d.StartsWith("/tai/") && m == "GET")
            {
                TepTam t = dv.LayTep(d.Substring(5));
                if (t == null) return TraLoi.Loi(404, "Liên kết tải đã hết hạn — hãy bấm tải lại.");
                return TraLoi.Tep(t.Than, t.Loai, t.Ten);
            }

            string token = Bearer(ctx);
            TaiKhoan tk = dv.XacThuc(token);
            if (tk == null) return TraLoi.Loi(401, "Phiên đăng nhập đã hết — hãy đăng nhập lại.");
            ctx.NguoiDung = tk;
            O b = m == "POST" || m == "PUT" ? (LaJson(ctx) ? Json.Doc(ctx.Than) : null) : null;

            // /taisan/123, /taisan/123/anh, /anh/123/<mã ảnh>, /kiemke/5 ...
            string[] p = d.Trim('/').Split('/');
            int id = p.Length > 1 ? SoNguyen(p[1], -1) : -1;
            if (p[0] == "anh" && p.Length == 3 && m == "GET") return Anh(dv, SoNguyen(p[1], -1), p[2], ctx.Q("nho") == "1");
            if (p[0] == "taisan" && p.Length >= 2 && id > 0)
            {
                string con = p.Length > 2 ? p[2] : "";
                switch (m + " " + con)
                {
                    case "GET ": return TraLoi.Json(ChiTiet(dv, tk, id));
                    case "POST sukien": return TraLoi.Json(GhiSuKien(dv, tk, id, b));
                    case "POST anh": return TraLoi.Json(ThemAnh(dv, tk, id, b));
                    case "DELETE anh": dv.BoAnh(tk, id, ctx.Q("anh")); return TraLoi.Json(ChiTiet(dv, tk, id));
                    case "POST anhchinh": dv.DatAnhChinh(tk, id, Json.Chu(b, "anh")); return TraLoi.Json(ChiTiet(dv, tk, id));
                    case "POST kiemke": return TraLoi.Json(KiemKeKhiQuet(dv, tk, id, b));
                }
                return TraLoi.Loi(404, "Không có địa chỉ này.");
            }
            if (p[0] == "kiemke" && p.Length >= 2 && id > 0)
            {
                string con = p.Length > 2 ? p[2] : "";
                switch (m + " " + con)
                {
                    case "GET ": return TraLoi.Json(ChiTietDot(dv, ctx, id));
                    case "POST quet": return TraLoi.Json(QuetKiemKe(dv, tk, id, b));
                    case "POST dong": dv.DongDot(tk, id, Json.Dung(b, "dong")); return TraLoi.Json(Ok);
                    case "POST bosung": return TraLoi.Json(new O { { "them", dv.BoSungDot(tk, id) } });
                    case "POST xuat": return TraLoi.Json(Link(dv, BaoCao.KiemKe(dv, id)));
                }
                return TraLoi.Loi(404, "Không có địa chỉ này.");
            }

            switch (m + " " + d)
            {
                case "GET /toi": return TraLoi.Json(Toi(dv, tk));
                case "POST /dangxuat": dv.DangXuat(token); return TraLoi.Json(Ok);
                case "POST /doimatkhau": dv.DoiMatKhau(tk, Json.Chu(b, "cu"), Json.Chu(b, "moi"), token); return TraLoi.Json(Ok);

                case "GET /danhmuc": return TraLoi.Json(DanhMuc(dv));
                case "POST /loai":
                    dv.LuuLoai(tk, Json.So(b, "id", 0), Json.Chu(b, "ten"), Json.Chu(b, "tienTo"), Json.Chu(b, "nhom"),
                               Json.So(b, "soNamKhauHao", 0), Json.So(b, "chuKyBaoTri", 0), Json.MangChu(b, "truong"));
                    return TraLoi.Json(DanhMuc(dv));
                case "DELETE /loai": dv.XoaLoai(tk, SoNguyen(ctx.Q("id"), 0)); return TraLoi.Json(DanhMuc(dv));
                case "POST /donvi": dv.LuuDonVi(tk, Json.So(b, "id", 0), Json.Chu(b, "ten"), Json.Chu(b, "ghiChu"), Json.Chu(b, "khoi")); return TraLoi.Json(DanhMuc(dv));
                case "GET /theodonvi": return TraLoi.Json(TheoDonVi(dv));
                case "POST /xuat/donvi": return TraLoi.Json(Link(dv, BaoCao.SoTheoDonVi(dv, Json.Chu(b, "khoi") ?? "", Json.So(b, "donvi", 0))));
                case "DELETE /donvi": dv.XoaDonVi(tk, SoNguyen(ctx.Q("id"), 0)); return TraLoi.Json(DanhMuc(dv));
                case "POST /caidat": dv.LuuCaiDat(tk, b); return TraLoi.Json(DanhMuc(dv));

                case "GET /taisan": return TraLoi.Json(DanhSach(dv, ctx));
                case "POST /taisan": return TraLoi.Json(LuuTaiSan(dv, tk, b));
                case "DELETE /taisan": dv.XoaTaiSan(tk, SoNguyen(ctx.Q("id"), 0)); return TraLoi.Json(Ok);
                case "GET /tim": return TraLoi.Json(Tim(dv, tk, ctx.Q("ma")));
                case "GET /nhan": return TraLoi.Json(Nhan(dv, LocTuQuery(ctx)));
                case "POST /nhan": return TraLoi.Json(Nhan(dv, LocTuJson(b)));   // nhiều tài sản đã chọn: danh sách mã số trong thân (IIS giới hạn độ dài địa chỉ)
                case "POST /nhan/datruoc":
                    {
                        DichVu.CanQuyen(tk, VaiTro.CapNhat);
                        List<string> ds = dv.DatTruocMa(tk, Json.Chu(b, "tienTo"), Json.So(b, "soLuong", 0));
                        return TraLoi.Json(new O { { "ma", ds } });
                    }
                case "GET /makhaitiep":
                    lock (dv.Khoa)
                    {
                        LoaiTaiSan l = dv.Dl.TimLoai(SoNguyen(ctx.Q("loai"), 0));
                        return TraLoi.Json(new O { { "ma", l == null ? "" : dv.Dl.MaKeTiep(l.TienTo, 1) } });
                    }
                case "GET /thongke": return TraLoi.Json(ThongKe(dv, tk));
                case "GET /hoatdong": return TraLoi.Json(HoatDong(dv, ctx));

                case "POST /dieuchuyen": return TraLoi.Json(DieuChuyen(dv, tk, b));
                case "GET /dieuchuyen": return TraLoi.Json(string.IsNullOrEmpty(ctx.Q("so")) ? DanhSachPhieu(dv, ctx) : ChiTietPhieu(dv, ctx.Q("so")));
                case "POST /xuat/dieuchuyen": return TraLoi.Json(Link(dv, BaoCao.BienBanDieuChuyen(dv, Json.Chu(b, "so"))));

                case "GET /kiemke": return TraLoi.Json(DanhSachDot(dv));
                case "POST /kiemke":
                    {
                        // id = 0: mở kiểm kê của năm (mỗi năm 1 đợt toàn công ty); id > 0: sửa tên, thời gian, ghi chú
                        int idDot = Json.So(b, "id", 0);
                        DotKiemKe k;
                        if (idDot == 0) k = dv.MoKiemKeNam(tk, Json.So(b, "nam", DateTime.Today.Year));
                        else
                        {
                            DateTime? tu = VanBan.Ngay(Json.Chu(b, "tuNgay"), "Ngày bắt đầu");
                            k = dv.LuuDot(tk, idDot, Json.Chu(b, "ten"), tu ?? DateTime.Today, VanBan.Ngay(Json.Chu(b, "denNgay"), "Ngày kết thúc"), Json.Chu(b, "ghiChu"));
                        }
                        return TraLoi.Json(new O { { "id", k.Id } });
                    }
                case "DELETE /kiemke": dv.XoaDot(tk, SoNguyen(ctx.Q("id"), 0)); return TraLoi.Json(Ok);

                case "POST /xuat/taisan": return TraLoi.Json(Link(dv, BaoCao.DanhSachTaiSan(dv, LocTuJson(b))));
                case "GET /xuat/mau": return TraLoi.Json(Link(dv, BaoCao.MauNhap(dv)));
                case "POST /nhap":
                    {
                        DichVu.CanQuyen(tk, VaiTro.CapNhat);
                        if (tk.DonVi >= 0 && tk.VaiTro < VaiTro.QuanTri) throw new LoiApi(403, "Tài khoản giới hạn theo đơn vị không nhập Excel được.");
                        return TraLoi.Json(BaoCao.Nhap(dv, tk, ctx.Than, ctx.Q("thu") == "1"));
                    }

                case "GET /taikhoan": DichVu.CanQuyen(tk, VaiTro.QuanTri); return TraLoi.Json(DanhSachTaiKhoan(dv));
                case "POST /taikhoan":
                    {
                        DichVu.CanQuyen(tk, VaiTro.QuanTri);
                        VaiTro v;
                        if (!Enum.TryParse(Json.Chu(b, "vaiTro") ?? "", out v) || !Enum.IsDefined(typeof(VaiTro), v)) throw new LoiApi(400, "Chọn quyền.");
                        dv.LuuTaiKhoan(tk, Json.Chu(b, "ten"), Json.Chu(b, "hoTen"), v, Json.So(b, "donVi", -1), Json.Dung(b, "khoa"),
                                       Json.Chu(b, "matKhau"), Json.Dung(b, "moi"));
                        return TraLoi.Json(DanhSachTaiKhoan(dv));
                    }
                case "DELETE /taikhoan": DichVu.CanQuyen(tk, VaiTro.QuanTri); dv.XoaTaiKhoan(tk, ctx.Q("ten")); return TraLoi.Json(DanhSachTaiKhoan(dv));
            }
            return TraLoi.Loi(404, "Không có địa chỉ này.");
        }

        static bool LaJson(NguCanh ctx)
        {
            string ct = ctx.Header("Content-Type") ?? "";
            return ct.Length == 0 || ct.IndexOf("json", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        static string Bearer(NguCanh ctx)
        {
            string a = ctx.Header("Authorization") ?? "";
            return a.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? a.Substring(7).Trim() : null;
        }

        static int SoNguyen(string s, int macDinh)
        {
            int v;
            return int.TryParse(s, NumberStyles.Integer, Inv, out v) ? v : macDinh;
        }

        static O Link(DichVu dv, KeyValuePair<string, byte[]> tep)
        {
            string ma = dv.GiuTep(tep.Value, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", tep.Key);
            return new O { { "link", "api/tai/" + ma }, { "ten", tep.Key } };
        }

        // ------------------------------------------------------------------ đăng nhập

        static O Ping(DichVu dv)
        {
            O app = AppDienThoai.ThongTin();   // đọc tệp APK ngoài khoá dữ liệu
            lock (dv.Khoa)
                return new O
                {
                    { "ok", true }, { "ten", "QuanLyTaiSan" }, { "ungDung", "QuanLyTaiSan" }, { "phienBanPhanMem", UngDung.PhienBan }, { "congTy", dv.Dl.CaiDat.TenCongTy },
                    { "coTaiKhoan", dv.CoTaiKhoan }, { "app", app }
                };
        }

        static TraLoi DangNhap(DichVu dv, NguCanh ctx)
        {
            O b = Json.Doc(ctx.Than);
            TaiKhoan tk;
            string token = dv.DangNhap(Json.Chu(b, "ten"), Json.Chu(b, "matKhau"), ctx.Ip, Json.Chu(b, "thietBi") ?? ctx.Header("User-Agent"), out tk);
            O r = Toi(dv, tk);
            r["token"] = token;
            return TraLoi.Json(r);
        }

        static O Toi(DichVu dv, TaiKhoan tk)
        {
            lock (dv.Khoa)
                return new O
                {
                    { "ten", tk.Ten }, { "hoTen", tk.HoTen }, { "vaiTro", tk.VaiTro.ToString() }, { "capQuyen", (int)tk.VaiTro },
                    { "tenVaiTro", TenVaiTro.Cua(tk.VaiTro) }, { "donVi", tk.DonVi }, { "tenDonVi", tk.DonVi >= 0 ? dv.Dl.TenDonVi(tk.DonVi) : null },
                    { "congTy", dv.Dl.CaiDat.TenCongTy }, { "phienBanPhanMem", UngDung.PhienBan }
                };
        }

        static O DanhSachTaiKhoan(DichVu dv)
        {
            var ds = new List<object>();
            foreach (TaiKhoan t in dv.DanhSachTaiKhoan())
                ds.Add(new O
                {
                    { "ten", t.Ten }, { "hoTen", t.HoTen }, { "vaiTro", t.VaiTro.ToString() }, { "tenVaiTro", TenVaiTro.Cua(t.VaiTro) },
                    { "donVi", t.DonVi }, { "tenDonVi", t.DonVi >= 0 ? dv.Dl.TenDonVi(t.DonVi) : null }, { "khoa", t.Khoa }, { "soPhien", dv.SoPhien(t.Ten) }
                });
            var vt = new List<object>();
            foreach (VaiTro v in Enum.GetValues(typeof(VaiTro)))
                vt.Add(new O { { "ma", v.ToString() }, { "ten", TenVaiTro.Cua(v) }, { "moTa", TenVaiTro.MoTa(v) } });
            return new O { { "ds", ds }, { "vaiTro", vt } };
        }

        // ------------------------------------------------------------------ danh mục

        static O DanhMuc(DichVu dv)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                var dem = dl.TaiSan.GroupBy(t => t.LoaiId).ToDictionary(g => g.Key, g => g.Count());
                var demDv = dl.TaiSan.GroupBy(t => t.DonViId).ToDictionary(g => g.Key, g => g.Count());
                int n;
                return new O
                {
                    { "loai", dl.Loai.OrderBy(l => l.Ten, VanBan.SoSanhTen).Select(l => (object)new O
                        {
                            { "id", l.Id }, { "ten", l.Ten }, { "tienTo", l.TienTo }, { "nhom", l.Nhom }, { "soNamKhauHao", l.SoNamKhauHao },
                            { "chuKyBaoTri", l.ChuKyBaoTri }, { "truong", l.Truong }, { "soTaiSan", dem.TryGetValue(l.Id, out n) ? n : 0 }
                        }).ToList() },
                    { "donVi", dl.DonViTheoThuTu().Select(x => (object)new O
                        {
                            { "id", x.Id }, { "ten", x.Ten }, { "ghiChu", x.GhiChu }, { "khoi", x.Khoi }, { "tenKhoi", Khoi.Ten(x.Khoi) },
                            { "soTaiSan", demDv.TryGetValue(x.Id, out n) ? n : 0 }
                        }).ToList() },
                    { "khoi", Khoi.Ma.Select(x => (object)new O { { "ma", x }, { "ten", Khoi.Ten(x) } }).ToList() },
                    { "tinhTrang", TinhTrang.Ma.Select(x => (object)new O { { "ma", x }, { "ten", TinhTrang.Ten(x) } }).ToList() },
                    { "nhom", new[] { "Nhà cửa, vật kiến trúc", "Máy móc, thiết bị", "Phương tiện vận tải, thiết bị truyền dẫn",
                                      "Thiết bị, dụng cụ quản lý", "Tài sản cố định khác", "Công cụ, dụng cụ" } },
                    { "caiDat", new O
                        {
                            { "tenCongTy", dl.CaiDat.TenCongTy }, { "diaChiQr", dl.CaiDat.DiaChiQr }, { "diaDanh", dl.CaiDat.DiaDanh },
                            { "nguoiLap", dl.CaiDat.NguoiLap }, { "keToanTruong", dl.CaiDat.KeToanTruong }, { "giamDoc", dl.CaiDat.GiamDoc },
                            { "ngayNhacKiemTra", dl.CaiDat.NgayNhacKiemTra }
                        } }
                };
            }
        }

        // ------------------------------------------------------------------ danh sách, tìm, lọc

        public class Loc
        {
            public string Q = "", TinhTrang = "", Them = "", Khoi = "";
            public int Loai, DonVi;
            public string Sap = "ma";
            public List<int> Ids;
        }

        static Loc LocTuQuery(NguCanh ctx)
        {
            var l = new Loc
            {
                Q = ctx.Q("q") ?? "", TinhTrang = ctx.Q("tinhtrang") ?? "", Them = ctx.Q("them") ?? "", Loai = SoNguyen(ctx.Q("loai"), 0),
                DonVi = SoNguyen(ctx.Q("donvi"), 0), Sap = ctx.Q("sap") ?? "ma", Khoi = ctx.Q("khoi") ?? ""
            };
            string ids = ctx.Q("ids");
            if (!string.IsNullOrEmpty(ids)) l.Ids = ids.Split(',').Select(x => SoNguyen(x, 0)).Where(x => x > 0).ToList();
            return l;
        }

        static Loc LocTuJson(O b)
        {
            var l = new Loc
            {
                Q = Json.Chu(b, "q") ?? "", TinhTrang = Json.Chu(b, "tinhtrang") ?? "", Them = Json.Chu(b, "them") ?? "",
                Loai = Json.So(b, "loai", 0), DonVi = Json.So(b, "donvi", 0), Sap = Json.Chu(b, "sap") ?? "ma", Khoi = Json.Chu(b, "khoi") ?? ""
            };
            if (Json.Co(b, "ids")) l.Ids = Json.MangSo(b, "ids");
            return l;
        }

        /// <summary>Lọc trong khoá. them: "baotri" = đến hạn bảo dưỡng (≤ 7 ngày), "lauchuakiem" = lâu chưa kiểm tra, "dangquanly" = bỏ đã thanh lý / mất.</summary>
        public static List<TaiSan> LocTaiSan(DuLieu dl, Loc l)
        {
            IEnumerable<TaiSan> q = dl.TaiSan;
            if (l.Ids != null)
            {
                var set = new HashSet<int>(l.Ids);
                q = q.Where(t => set.Contains(t.Id));
            }
            if (l.Loai > 0) q = q.Where(t => t.LoaiId == l.Loai);
            if (l.DonVi > 0) q = q.Where(t => t.DonViId == l.DonVi);
            if (l.Khoi.Length > 0) q = q.Where(t => dl.KhoiCua(t.DonViId) == l.Khoi);
            if (l.TinhTrang.Length > 0) q = q.Where(t => t.TinhTrang == l.TinhTrang);
            DateTime homNay = DateTime.Today;
            if (l.Them == "baotri")
                q = q.Where(t => { DateTime? h = TinhToan.HanBaoTri(dl, t); return h.HasValue && h.Value <= homNay.AddDays(7); });
            else if (l.Them == "lauchuakiem")
            {
                int ngay = Math.Max(1, dl.CaiDat.NgayNhacKiemTra);
                q = q.Where(t => TinhTrang.ConDung(t.TinhTrang) && (!t.KiemTraCuoi.HasValue || t.KiemTraCuoi.Value < homNay.AddDays(-ngay)));
            }
            else if (l.Them == "dangquanly") q = q.Where(t => TinhTrang.ConDung(t.TinhTrang));
            else if (l.Them == "chuaanh") q = q.Where(t => t.Anh.Count == 0);
            string tu = VanBan.BoDau(l.Q).Trim();
            if (tu.Length > 0)
            {
                string[] cac = tu.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                q = q.Where(t => cac.All(c => t.KhoaTim.Contains(c)));
            }
            switch (l.Sap)
            {
                case "ten": q = q.OrderBy(t => t.Ten, VanBan.SoSanhTen); break;
                case "moi": q = q.OrderByDescending(t => t.Sua); break;
                case "kiemtra": q = q.OrderBy(t => t.KiemTraCuoi ?? DateTime.MinValue); break;
                case "baotri": q = q.OrderBy(t => TinhToan.HanBaoTri(dl, t) ?? DateTime.MaxValue); break;
                case "gia": q = q.OrderByDescending(t => t.NguyenGia ?? 0); break;
                default: q = q.OrderBy(t => t.Ma, StringComparer.OrdinalIgnoreCase); break;
            }
            return q.ToList();
        }

        static O TomTat(DuLieu dl, TaiSan t)
        {
            DateTime? han = TinhToan.HanBaoTri(dl, t);
            return new O
            {
                { "id", t.Id }, { "ma", t.Ma }, { "ten", t.Ten }, { "loai", t.LoaiId }, { "tenLoai", dl.TenLoai(t.LoaiId) },
                { "donVi", t.DonViId }, { "tenDonVi", dl.TenDonVi(t.DonViId) }, { "khoi", dl.KhoiCua(t.DonViId) }, { "viTri", t.ViTri }, { "tinhTrang", t.TinhTrang },
                { "anh", t.AnhDaiDien }, { "soAnh", t.Anh.Count }, { "nguyenGia", t.NguyenGia },
                { "kiemTraCuoi", t.KiemTraCuoi.HasValue ? (object)t.KiemTraCuoi.Value : null }, { "hanBaoTri", VanBan.NgayIso(han) }
            };
        }

        static O DanhSach(DichVu dv, NguCanh ctx)
        {
            Loc l = LocTuQuery(ctx);
            int trang = Math.Max(1, SoNguyen(ctx.Q("trang"), 1));
            int co = Math.Max(10, Math.Min(500, SoNguyen(ctx.Q("co"), 50)));
            lock (dv.Khoa)
            {
                List<TaiSan> ds = LocTaiSan(dv.Dl, l);
                DateTime homNay = DateTime.Today;
                return new O
                {
                    { "tong", ds.Count }, { "trang", trang }, { "co", co },
                    { "tongNguyenGia", ds.Sum(t => t.NguyenGia ?? 0) },
                    { "tongConLai", ds.Sum(t => TinhToan.GiaTriConLai(dv.Dl, t, homNay) ?? 0) },
                    { "ds", ds.Skip((trang - 1) * co).Take(co).Select(t => (object)TomTat(dv.Dl, t)).ToList() }
                };
            }
        }

        /// <summary>Nội dung đọc từ mã QR (địa chỉ …/t/MÃ, "ma=MÃ" hoặc chính mã) → tài sản.</summary>
        public static string MaTuQr(string s)
        {
            s = (s ?? "").Trim();
            int i = s.LastIndexOf("/t/", StringComparison.OrdinalIgnoreCase);
            if (i >= 0) s = s.Substring(i + 3);
            else
            {
                int h = s.IndexOf("#/ma/", StringComparison.OrdinalIgnoreCase);
                if (h >= 0) s = s.Substring(h + 5);
                else
                {
                    int q = s.IndexOf("ma=", StringComparison.OrdinalIgnoreCase);
                    if (q >= 0 && (q == 0 || s[q - 1] == '?' || s[q - 1] == '&')) s = s.Substring(q + 3);
                }
            }
            int cut = s.IndexOfAny(new[] { '?', '#', '&', '/' });
            if (cut >= 0) s = s.Substring(0, cut);
            try { s = Uri.UnescapeDataString(s); } catch (Exception) { }
            return MaTaiSan.Chuan(s);
        }

        static O Tim(DichVu dv, TaiKhoan tk, string noiDung)
        {
            string ma = MaTuQr(noiDung);
            lock (dv.Khoa)
            {
                TaiSan t = dv.Dl.TimMa(ma);
                if (t != null) return new O { { "id", t.Id }, { "ma", t.Ma }, { "taiSan", TomTat(dv.Dl, t) }, { "duocSua", dv.DuocSua(tk, t) } };
                return new O { { "id", 0 }, { "ma", ma }, { "hopLe", MaTaiSan.HopLe(ma) }, { "duocTao", tk.VaiTro >= VaiTro.CapNhat && MaTaiSan.HopLe(ma) } };
            }
        }

        static O Nhan(DichVu dv, Loc l)
        {
            lock (dv.Khoa)
            {
                List<TaiSan> ds = LocTaiSan(dv.Dl, l);
                if (ds.Count > 3000) throw new LoiApi(400, "Quá nhiều tem (" + ds.Count + ") — lọc bớt (tối đa 3000 tem 1 lần in).");
                return new O
                {
                    { "congTy", dv.Dl.CaiDat.TenCongTy }, { "diaChiQr", dv.Dl.CaiDat.DiaChiQr },
                    { "ds", ds.Select(t => (object)new O { { "id", t.Id }, { "ma", t.Ma }, { "ten", t.Ten }, { "tenDonVi", dv.Dl.TenDonVi(t.DonViId) }, { "tenLoai", dv.Dl.TenLoai(t.LoaiId) } }).ToList() }
                };
            }
        }

        // ------------------------------------------------------------------ chi tiết tài sản

        static O ChiTiet(DichVu dv, TaiKhoan tk, int id)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                TaiSan t = dl.Tim(id);
                if (t == null) throw new LoiApi(404, "Không có tài sản này (có thể đã bị xoá).");
                DateTime homNay = DateTime.Today;
                O r = TomTat(dl, t);
                LoaiTaiSan loai = dl.TimLoai(t.LoaiId);
                r["phienBan"] = t.PhienBan;
                r["nhom"] = loai == null ? "" : loai.Nhom;
                r["nguoiSuDung"] = t.NguoiSuDung;
                r["hangSX"] = t.HangSX;
                r["model"] = t.Model;
                r["soSeri"] = t.SoSeri;
                r["nuocSX"] = t.NuocSX;
                r["namSX"] = t.NamSX;
                r["ngaySuDung"] = VanBan.NgayIso(t.NgaySuDung);
                r["soNamKhauHao"] = t.SoNamKhauHao;
                r["soNamKhauHaoApDung"] = TinhToan.SoNamKhauHao(dl, t);
                r["khauHaoLuyKe"] = TinhToan.KhauHaoLuyKe(dl, t, homNay);
                r["giaTriConLai"] = TinhToan.GiaTriConLai(dl, t, homNay);
                r["baoHanhDen"] = VanBan.NgayIso(t.BaoHanhDen);
                r["chuKyBaoTri"] = t.ChuKyBaoTri;
                r["chuKyBaoTriApDung"] = TinhToan.ChuKyBaoTri(dl, t);
                r["baoTriCuoi"] = VanBan.NgayIso(t.BaoTriCuoi);
                r["viDo"] = t.ViDo;
                r["kinhDo"] = t.KinhDo;
                r["ghiChu"] = t.GhiChu;
                r["thongSo"] = t.ThongSo.Select(x => (object)new O { { "ten", x.Key }, { "gt", x.Value } }).ToList();
                r["truongLoai"] = loai == null ? new List<string>() : loai.Truong;
                r["boAnh"] = t.Anh.AsEnumerable().Reverse().ToList();
                r["anhChinh"] = t.AnhDaiDien;
                r["tao"] = t.Tao;
                r["sua"] = t.Sua;
                r["nguoiTao"] = t.NguoiTao;
                r["nguoiSua"] = t.NguoiSua;
                r["duocSua"] = dv.DuocSua(tk, t);
                r["lichSu"] = dv.Kho.LichSu(t.Id).AsEnumerable().Reverse().Take(300).Select(s => (object)SuKienJson(dl, s, false)).ToList();
                r["kiemKeNam"] = KiemKeNamCua(dv, t);
                return r;
            }
        }

        /// <summary>Tình hình kiểm kê năm nay của 1 tài sản (đợt chưa mở: dot = 0).</summary>
        static O KiemKeNamCua(DichVu dv, TaiSan t)
        {
            int nam = DateTime.Today.Year;
            DotKiemKe k = dv.DotCuaNam(nam);
            SuKien kq = null;
            if (k != null) k.KetQua.TryGetValue(t.Id, out kq);
            return new O
            {
                { "nam", nam }, { "dot", k == null ? 0 : k.Id }, { "ten", k == null ? null : k.Ten }, { "dong", k != null && k.Dong },
                { "trongSo", k != null && k.DanhSach.Contains(t.Id) }, { "daKiem", kq != null },
                { "luc", kq == null ? null : (object)kq.Luc }, { "nguoi", kq == null ? null : kq.HoTen }, { "tinhTrang", kq == null ? null : kq.TinhTrang },
                { "ghiChu", kq == null ? null : kq.NoiDung }
            };
        }

        static O KiemKeKhiQuet(DichVu dv, TaiKhoan tk, int id, O b)
        {
            string tt = Json.Chu(b, "tinhTrang");
            DichVu.KetQuaQuet kq = dv.KiemKeKhiQuet(tk, id, string.IsNullOrEmpty(tt) ? null : tt, Json.Chu(b, "ghiChu"), Json.Dung(b, "lai"),
                                                    Json.SoThuc(b, "viDo"), Json.SoThuc(b, "kinhDo"), Json.MangChu(b, "anh"));
            lock (dv.Khoa)
            {
                TaiSan t = dv.Dl.Tim(id);
                return new O
                {
                    { "moi", kq.Moi }, { "ngoaiSo", kq.NgoaiSo }, { "dot", DotJson(dv.Dl, kq.Dot) },
                    { "luc", kq.KetQua.Luc }, { "hoTen", kq.KetQua.HoTen }, { "tinhTrang", kq.KetQua.TinhTrang }, { "ghiChu", kq.KetQua.NoiDung },
                    { "taiSan", t == null ? null : TomTat(dv.Dl, t) }
                };
            }
        }

        static O SuKienJson(DuLieu dl, SuKien s, bool kemTaiSan)
        {
            var o = new O
            {
                { "id", s.Id }, { "loai", s.Loai }, { "tenLoai", LoaiSuKien.Ten(s.Loai) }, { "luc", s.Luc }, { "nguoi", s.Nguoi }, { "hoTen", s.HoTen },
                { "tinhTrang", s.TinhTrang }, { "noiDung", s.NoiDung }, { "chiTiet", s.ChiTiet }, { "chiPhi", s.ChiPhi },
                { "viDo", s.ViDo }, { "kinhDo", s.KinhDo }, { "anh", s.Anh }, { "dot", s.Dot }, { "taiSan", s.TaiSan }, { "phieu", s.Phieu }
            };
            if (kemTaiSan)
            {
                TaiSan t = dl.Tim(s.TaiSan);
                o["ma"] = t == null ? "" : t.Ma;
                o["ten"] = t == null ? "(đã xoá)" : t.Ten;
            }
            return o;
        }

        static TaiSan TuJson(O b)
        {
            var t = new TaiSan
            {
                Id = Json.So(b, "id", 0), Ma = Json.Chu(b, "ma") ?? "", Ten = Json.Chu(b, "ten") ?? "", LoaiId = Json.So(b, "loai", 0), DonViId = Json.So(b, "donVi", 0),
                ViTri = Json.Chu(b, "viTri") ?? "", NguoiSuDung = Json.Chu(b, "nguoiSuDung") ?? "", HangSX = Json.Chu(b, "hangSX") ?? "",
                Model = Json.Chu(b, "model") ?? "", SoSeri = Json.Chu(b, "soSeri") ?? "", NuocSX = Json.Chu(b, "nuocSX") ?? "", GhiChu = Json.Chu(b, "ghiChu") ?? "",
                TinhTrang = Json.Chu(b, "tinhTrang") ?? TinhTrang.Tot, NguyenGia = Json.SoThuc(b, "nguyenGia"), ViDo = Json.SoThuc(b, "viDo"), KinhDo = Json.SoThuc(b, "kinhDo"),
                NgaySuDung = VanBan.Ngay(Json.Chu(b, "ngaySuDung"), "Ngày đưa vào sử dụng"), BaoHanhDen = VanBan.Ngay(Json.Chu(b, "baoHanhDen"), "Bảo hành đến"),
                BaoTriCuoi = VanBan.Ngay(Json.Chu(b, "baoTriCuoi"), "Bảo dưỡng lần cuối")
            };
            double? x = Json.SoThuc(b, "namSX");
            t.NamSX = x.HasValue ? (int?)(int)x.Value : null;
            x = Json.SoThuc(b, "soNamKhauHao");
            t.SoNamKhauHao = x.HasValue ? (int?)(int)x.Value : null;
            x = Json.SoThuc(b, "chuKyBaoTri");
            t.ChuKyBaoTri = x.HasValue ? (int?)(int)x.Value : null;
            foreach (object o in Json.Mang(b, "thongSo"))
            {
                var p = o as O;
                if (p != null) t.ThongSo.Add(new KeyValuePair<string, string>(Json.Chu(p, "ten") ?? "", Json.Chu(p, "gt") ?? ""));
            }
            return t;
        }

        static O LuuTaiSan(DichVu dv, TaiKhoan tk, O b)
        {
            TaiSan t = dv.LuuTaiSan(tk, TuJson(b), Json.So(b, "phienBan", 0));
            return ChiTiet(dv, tk, t.Id);
        }

        static O GhiSuKien(DichVu dv, TaiKhoan tk, int id, O b)
        {
            var y = new DichVu.YeuCauSuKien
            {
                Loai = Json.Chu(b, "loai") ?? "", TinhTrang = Json.Chu(b, "tinhTrang"), NoiDung = Json.Chu(b, "noiDung") ?? "",
                ChiPhi = Json.SoThuc(b, "chiPhi"), ViDo = Json.SoThuc(b, "viDo"), KinhDo = Json.SoThuc(b, "kinhDo"), CapNhatToaDo = Json.Dung(b, "capNhatToaDo"),
                Ngay = VanBan.Ngay(Json.Chu(b, "ngay"), "Ngày"), DonVi = Json.So(b, "donVi", 0), ViTri = Json.Chu(b, "viTri"),
                NguoiSuDung = Json.Chu(b, "nguoiSuDung"), Anh = Json.MangChu(b, "anh")
            };
            if (y.TinhTrang == "") y.TinhTrang = null;
            dv.GhiSuKien(tk, id, y);
            return ChiTiet(dv, tk, id);
        }

        static byte[] Base64(O b, string k)
        {
            string s = Json.Chu(b, k);
            if (string.IsNullOrEmpty(s)) return null;
            int c = s.IndexOf(',');
            if (s.StartsWith("data:") && c > 0) s = s.Substring(c + 1);
            try { return Convert.FromBase64String(s); }
            catch (FormatException) { throw new LoiApi(400, "Ảnh gửi lên bị hỏng."); }
        }

        static O ThemAnh(DichVu dv, TaiKhoan tk, int id, O b)
        {
            byte[] lon = Base64(b, "anh");
            if (lon == null) throw new LoiApi(400, "Chưa có ảnh.");
            bool boAnh = !Json.Co(b, "boAnh") || Json.Dung(b, "boAnh");
            string ma = dv.ThemAnh(tk, id, lon, Base64(b, "nho"), boAnh, Json.Dung(b, "chinh"));
            return new O { { "anh", ma } };
        }

        static TraLoi Anh(DichVu dv, int taiSan, string ma, bool nho)
        {
            string p = dv.Kho.DuongAnh(taiSan, ma, nho);
            if (p == null || !File.Exists(p)) return TraLoi.Loi(404, "Không có ảnh này.");
            var t = new TraLoi { Status = 200, Loai = "image/jpeg", Than = File.ReadAllBytes(p) };
            t.Header["Cache-Control"] = "private, max-age=31536000, immutable";
            t.Header["Content-Security-Policy"] = "default-src 'none'; sandbox";
            return t;
        }

        // ------------------------------------------------------------------ tổng quan

        static O ThongKe(DichVu dv, TaiKhoan tk)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                DateTime homNay = DateTime.Today;
                var dangQL = dl.TaiSan.Where(t => TinhTrang.ConDung(t.TinhTrang)).ToList();
                int ngayNhac = Math.Max(1, dl.CaiDat.NgayNhacKiemTra);
                var hanBT = dangQL.Select(t => new { t, h = TinhToan.HanBaoTri(dl, t) }).Where(x => x.h.HasValue && x.h.Value <= homNay.AddDays(7))
                                  .OrderBy(x => x.h.Value).ToList();
                var r = new O
                {
                    { "tong", dl.TaiSan.Count }, { "dangQuanLy", dangQL.Count },
                    { "nguyenGia", dangQL.Sum(t => t.NguyenGia ?? 0) }, { "conLai", dangQL.Sum(t => TinhToan.GiaTriConLai(dl, t, homNay) ?? 0) },
                    { "kiemTraThang", dl.TaiSan.Count(t => t.KiemTraCuoi.HasValue && t.KiemTraCuoi.Value >= homNay.AddDays(-30)) },
                    { "lauChuaKiem", dangQL.Count(t => !t.KiemTraCuoi.HasValue || t.KiemTraCuoi.Value < homNay.AddDays(-ngayNhac)) },
                    { "ngayNhacKiemTra", ngayNhac },
                    { "chuaAnh", dl.TaiSan.Count(t => t.Anh.Count == 0) },
                    { "denHanBaoTri", hanBT.Count },
                    { "theoTinhTrang", TinhTrang.Ma.Select(m => (object)new O { { "ma", m }, { "ten", TinhTrang.Ten(m) }, { "so", dl.TaiSan.Count(t => t.TinhTrang == m) } }).ToList() },
                    { "theoLoai", dl.Loai.Select(l => new { l, ds = dangQL.Where(t => t.LoaiId == l.Id).ToList() }).Where(x => x.ds.Count > 0)
                                   .OrderByDescending(x => x.ds.Count)
                                   .Select(x => (object)new O { { "id", x.l.Id }, { "ten", x.l.Ten }, { "so", x.ds.Count }, { "nguyenGia", x.ds.Sum(t => t.NguyenGia ?? 0) } }).ToList() },
                    { "theoDonVi", dl.DonViTheoThuTu().Select(d => new { d, ds = dangQL.Where(t => t.DonViId == d.Id).ToList() }).Where(x => x.ds.Count > 0)
                                   .Select(x => (object)new O
                                   {
                                       { "id", x.d.Id }, { "ten", x.d.Ten }, { "khoi", x.d.Khoi }, { "so", x.ds.Count },
                                       { "hong", x.ds.Count(t => t.TinhTrang == TinhTrang.Hong || t.TinhTrang == TinhTrang.DangSua) },
                                       { "nguyenGia", x.ds.Sum(t => t.NguyenGia ?? 0) }
                                   }).ToList() },
                    { "baoTri", hanBT.Take(12).Select(x => { O o = TomTat(dl, x.t); return (object)o; }).ToList() },
                    { "hong", dl.TaiSan.Where(t => t.TinhTrang == TinhTrang.Hong).OrderByDescending(t => t.Sua).Take(12).Select(t => (object)TomTat(dl, t)).ToList() },
                    { "hoatDong", dv.Kho.TatCaSuKien.Reverse().Take(15).Select(s => (object)SuKienJson(dl, s, true)).ToList() },
                    { "namNay", homNay.Year },
                    { "kiemKeNam", dv.DotCuaNam(homNay.Year) == null ? null : DotJson(dl, dv.DotCuaNam(homNay.Year)) }
                };
                return r;
            }
        }

        /// <summary>Tài sản chia theo khối → đơn vị: số lượng, giá trị, tình trạng, việc cần làm của từng đội / phòng ban.</summary>
        static O TheoDonVi(DichVu dv)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                DateTime homNay = DateTime.Today;
                int ngayNhac = Math.Max(1, dl.CaiDat.NgayNhacKiemTra);
                Func<List<TaiSan>, O> soLieu = ds => new O
                {
                    { "so", ds.Count }, { "nguyenGia", ds.Sum(t => t.NguyenGia ?? 0) }, { "conLai", ds.Sum(t => TinhToan.GiaTriConLai(dl, t, homNay) ?? 0) },
                    { "tot", ds.Count(t => t.TinhTrang == TinhTrang.Tot) }, { "theoDoi", ds.Count(t => t.TinhTrang == TinhTrang.TheoDoi) },
                    { "hong", ds.Count(t => t.TinhTrang == TinhTrang.Hong || t.TinhTrang == TinhTrang.DangSua) },
                    { "ngung", ds.Count(t => t.TinhTrang == TinhTrang.Ngung) },
                    { "denHanBaoTri", ds.Count(t => { DateTime? h = TinhToan.HanBaoTri(dl, t); return h.HasValue && h.Value <= homNay.AddDays(7); }) },
                    { "lauChuaKiem", ds.Count(t => !t.KiemTraCuoi.HasValue || t.KiemTraCuoi.Value < homNay.AddDays(-ngayNhac)) },
                    { "chuaAnh", ds.Count(t => t.Anh.Count == 0) }
                };
                var cacKhoi = new List<object>();
                foreach (string kh in Khoi.Ma)
                {
                    var donVi = new List<object>();
                    var tatCa = new List<TaiSan>();
                    foreach (DonVi d in dl.DonViTheoThuTu().Where(x => x.Khoi == kh))
                    {
                        var ds = dl.TaiSan.Where(t => t.DonViId == d.Id && TinhTrang.ConDung(t.TinhTrang)).ToList();
                        tatCa.AddRange(ds);
                        O o = soLieu(ds);
                        o["id"] = d.Id;
                        o["ten"] = d.Ten;
                        o["ghiChu"] = d.GhiChu;
                        o["ngungQuanLy"] = dl.TaiSan.Count(t => t.DonViId == d.Id && !TinhTrang.ConDung(t.TinhTrang));
                        o["theoLoai"] = ds.GroupBy(t => t.LoaiId).OrderByDescending(g => g.Count()).Take(4)
                                          .Select(g => (object)new O { { "ten", dl.TenLoai(g.Key) }, { "so", g.Count() } }).ToList();
                        donVi.Add(o);
                    }
                    O k = soLieu(tatCa);
                    k["ma"] = kh;
                    k["ten"] = Khoi.Ten(kh);
                    k["donVi"] = donVi;
                    cacKhoi.Add(k);
                }
                return new O { { "khoi", cacKhoi }, { "ngayNhacKiemTra", ngayNhac } };
            }
        }

        static O HoatDong(DichVu dv, NguCanh ctx)
        {
            int trang = Math.Max(1, SoNguyen(ctx.Q("trang"), 1));
            string loai = ctx.Q("loai") ?? "";
            lock (dv.Khoa)
            {
                IEnumerable<SuKien> q = dv.Kho.TatCaSuKien.Reverse();
                if (loai.Length > 0) q = q.Where(s => s.Loai == loai);
                var ds = q.Skip((trang - 1) * 50).Take(51).ToList();
                return new O
                {
                    { "trang", trang }, { "conNua", ds.Count > 50 },
                    { "ds", ds.Take(50).Select(s => (object)SuKienJson(dv.Dl, s, true)).ToList() }
                };
            }
        }

        // ------------------------------------------------------------------ điều chuyển

        static O DieuChuyen(DichVu dv, TaiKhoan tk, O b)
        {
            var y = new DichVu.YeuCauDieuChuyen
            {
                TaiSan = Json.MangSo(b, "taiSan"), DonVi = Json.So(b, "donVi", 0), ViTri = Json.Chu(b, "viTri"), NguoiSuDung = Json.Chu(b, "nguoiSuDung"),
                NoiDung = Json.Chu(b, "noiDung") ?? "", Anh = Json.MangChu(b, "anh")
            };
            return ChiTietPhieu(dv, dv.DieuChuyen(tk, y).So);
        }

        static O PhieuJson(DuLieu dl, List<SuKien> l)
        {
            SuKien d = l[0];
            var tu = l.Select(s => s.TuDonVi).Distinct().ToList();
            return new O
            {
                { "so", d.Phieu }, { "luc", d.Luc }, { "nguoi", d.Nguoi }, { "hoTen", d.HoTen }, { "noiDung", d.NoiDung },
                { "denDonVi", d.DenDonVi }, { "tenDenDonVi", dl.TenDonVi(d.DenDonVi) }, { "khoiDen", dl.KhoiCua(d.DenDonVi) },
                { "tuDonVi", tu }, { "tenTuDonVi", string.Join(", ", tu.Select(x => dl.TenDonVi(x))) }, { "soTaiSan", l.Count }
            };
        }

        /// <summary>Các phiếu điều chuyển mới nhất (donvi: phiếu có đơn vị đó giao hoặc nhận).</summary>
        static O DanhSachPhieu(DichVu dv, NguCanh ctx)
        {
            int donVi = SoNguyen(ctx.Q("donvi"), 0);
            lock (dv.Khoa)
            {
                IEnumerable<List<SuKien>> q = dv.Kho.CacPhieu();
                if (donVi > 0) q = q.Where(l => l[0].DenDonVi == donVi || l.Any(s => s.TuDonVi == donVi));
                var ds = q.Take(301).ToList();
                return new O { { "ds", ds.Take(300).Select(l => (object)PhieuJson(dv.Dl, l)).ToList() }, { "conNua", ds.Count > 300 } };
            }
        }

        static O ChiTietPhieu(DichVu dv, string so)
        {
            lock (dv.Khoa)
            {
                List<SuKien> l = dv.Kho.SuKienPhieu(so);
                if (l == null) throw new LoiApi(404, "Không có phiếu điều chuyển " + so + ".");
                O r = PhieuJson(dv.Dl, l);
                r["ds"] = l.Select(s =>
                {
                    TaiSan t = dv.Dl.Tim(s.TaiSan);
                    O o = t == null ? new O { { "id", s.TaiSan }, { "ma", "" }, { "ten", "(đã xoá)" } } : TomTat(dv.Dl, t);
                    o["tuDonVi"] = s.TuDonVi;
                    o["tenTuDonVi"] = dv.Dl.TenDonVi(s.TuDonVi);
                    o["chiTiet"] = s.ChiTiet;
                    return (object)o;
                }).ToList();
                return r;
            }
        }

        // ------------------------------------------------------------------ kiểm kê

        static O DotJson(DuLieu dl, DotKiemKe k)
        {
            int daKiem = k.DanhSach.Count(id => k.KetQua.ContainsKey(id));
            return new O
            {
                { "id", k.Id }, { "nam", k.Nam }, { "ten", k.Ten }, { "tuNgay", VanBan.NgayIso(k.TuNgay) }, { "denNgay", VanBan.NgayIso(k.DenNgay) }, { "dong", k.Dong },
                { "ghiChu", k.GhiChu }, { "donVi", k.DonVi }, { "tenDonVi", MoTaPhamVi(dl, k.DonVi) },
                { "tong", k.DanhSach.Count }, { "daKiem", daKiem }, { "ngoaiSo", k.KetQua.Keys.Count(id => !k.DanhSach.Contains(id)) },
                { "nguoiTao", k.NguoiTao }, { "tao", k.Tao }
            };
        }

        /// <summary>"Toàn công ty", "Các đội cấp nước" (đủ mọi đội), hoặc danh sách tên đơn vị.</summary>
        static string MoTaPhamVi(DuLieu dl, List<int> donVi)
        {
            if (donVi.Count == 0) return "Toàn công ty";
            var chon = new HashSet<int>(donVi);
            var phan = new List<string>();
            foreach (string kh in Khoi.Ma)
            {
                var trongKhoi = dl.DonViTheoThuTu().Where(d => d.Khoi == kh).ToList();
                if (trongKhoi.Count > 1 && trongKhoi.All(d => chon.Contains(d.Id)))
                {
                    phan.Add(Khoi.Ten(kh));
                    foreach (DonVi d in trongKhoi) chon.Remove(d.Id);
                }
            }
            phan.AddRange(dl.DonViTheoThuTu().Where(d => chon.Contains(d.Id)).Select(d => d.Ten));
            return string.Join(", ", phan);
        }

        static O DanhSachDot(DichVu dv)
        {
            lock (dv.Khoa)
            {
                int nam = DateTime.Today.Year;
                DotKiemKe namNay = dv.DotCuaNam(nam);
                return new O
                {
                    { "namNay", nam }, { "dotNamNay", namNay == null ? 0 : namNay.Id },
                    { "ds", dv.Dl.KiemKe.OrderByDescending(k => k.Nam).ThenByDescending(k => k.Id).Select(k => (object)DotJson(dv.Dl, k)).ToList() }
                };
            }
        }

        static O ChiTietDot(DichVu dv, NguCanh ctx, int id)
        {
            string loc = ctx.Q("loc") ?? "chua";
            int donVi = SoNguyen(ctx.Q("donvi"), 0);
            string tu = VanBan.BoDau(ctx.Q("q") ?? "").Trim();
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Dl;
                DotKiemKe k = dl.TimDot(id);
                if (k == null) throw new LoiApi(404, "Không có đợt kiểm kê này.");
                var trongSo = k.DanhSach.Select(x => dl.Tim(x)).Where(t => t != null).ToList();
                var thuTu = dl.DonViTheoThuTu().Select(x => x.Id).ToList();
                var theoDv = trongSo.GroupBy(t => t.DonViId).OrderBy(g => thuTu.IndexOf(g.Key) < 0 ? int.MaxValue : thuTu.IndexOf(g.Key)).Select(g => (object)new O
                {
                    { "id", g.Key }, { "ten", dl.TenDonVi(g.Key) }, { "khoi", dl.KhoiCua(g.Key) }, { "tong", g.Count() },
                    { "daKiem", g.Count(t => k.KetQua.ContainsKey(t.Id)) }
                }).ToList();
                IEnumerable<TaiSan> ds;
                if (loc == "da") ds = trongSo.Where(t => k.KetQua.ContainsKey(t.Id));
                else if (loc == "ngoai") ds = k.KetQua.Keys.Where(x => !k.DanhSach.Contains(x)).Select(x => dl.Tim(x)).Where(t => t != null);
                else if (loc == "tatca") ds = trongSo;
                else ds = trongSo.Where(t => !k.KetQua.ContainsKey(t.Id));
                if (donVi > 0) ds = ds.Where(t => t.DonViId == donVi);
                if (tu.Length > 0) ds = ds.Where(t => t.KhoaTim.Contains(tu));
                var list = ds.OrderBy(t => t.Ma, StringComparer.OrdinalIgnoreCase).ToList();
                var r = DotJson(dl, k);
                r["theoDonVi"] = theoDv;
                r["namNay"] = DateTime.Today.Year;
                r["cacDot"] = dl.KiemKe.OrderByDescending(x => x.Nam).ThenByDescending(x => x.Id)
                                .Select(x => (object)new O { { "id", x.Id }, { "nam", x.Nam }, { "ten", x.Ten } }).ToList();
                r["soDong"] = list.Count;
                r["ds"] = list.Take(500).Select(t =>
                {
                    O o = TomTat(dl, t);
                    SuKien kq;
                    if (k.KetQua.TryGetValue(t.Id, out kq))
                        o["kq"] = new O { { "luc", kq.Luc }, { "hoTen", kq.HoTen }, { "tinhTrang", kq.TinhTrang }, { "noiDung", kq.NoiDung } };
                    return (object)o;
                }).ToList();
                return r;
            }
        }

        static O QuetKiemKe(DichVu dv, TaiKhoan tk, int dot, O b)
        {
            bool ngoai;
            string tt = Json.Chu(b, "tinhTrang");
            dv.QuetKiemKe(tk, dot, Json.So(b, "taiSan", 0), string.IsNullOrEmpty(tt) ? null : tt, Json.Chu(b, "ghiChu"),
                          Json.SoThuc(b, "viDo"), Json.SoThuc(b, "kinhDo"), Json.MangChu(b, "anh"), out ngoai);
            lock (dv.Khoa)
            {
                DotKiemKe k = dv.Dl.TimDot(dot);
                O r = DotJson(dv.Dl, k);
                r["laNgoaiSo"] = ngoai;
                return r;
            }
        }
    }
}
