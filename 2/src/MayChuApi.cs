using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;

namespace ThatThoatNuoc
{
    using O = Dictionary<string, object>;

    /// <summary>Các địa chỉ /api/... của máy chủ (JSON). Điện thoại: xem số liệu, nhập đồng hồ cấp 1, tải Excel / PDF. Máy tính: đồng bộ cả bộ dữ liệu.</summary>
    static class ApiMayChu
    {
        public static TraLoi XuLy(DichVuMayChu dv, NguCanh ctx)
        {
            string d = ctx.Duong.Substring(4).TrimEnd('/');
            string m = ctx.PhuongThuc;
            if (d == "/ping") return Ping(dv);
            if (d == "/dangnhap" && m == "POST") return DangNhap(dv, ctx);
            if (d.StartsWith("/tai/") && (m == "GET" || m == "HEAD"))
            {
                TepTam t = dv.LayTep(d.Substring(5));
                if (t == null) return TraLoi.Loi(404, "Liên kết tải đã hết hạn — hãy bấm tải lại.");
                return TraLoi.Tep(t.Than, t.Loai, t.Ten);
            }

            string token = Bearer(ctx);
            TaiKhoanMayChu tk = dv.XacThuc(token);
            if (tk == null) return TraLoi.Loi(401, "Phiên đăng nhập đã hết — hãy đăng nhập lại.");
            ctx.NguoiDung = tk;

            switch (m + " " + d)
            {
                case "GET /toi": return TraLoi.Json(Toi(dv, tk));
                case "POST /dangxuat": dv.DangXuat(token); return TraLoi.Json(new O { { "ok", true } });
                case "POST /doimatkhau":
                    {
                        O b = JsonMayChu.Doc(ctx.Than);
                        dv.DoiMatKhau(tk, JsonMayChu.Chu(b, "cu"), JsonMayChu.Chu(b, "moi"), token);
                        return TraLoi.Json(new O { { "ok", true } });
                    }
                case "GET /phienban": lock (dv.Khoa) return TraLoi.Json(new O { { "phienBan", dv.PhienBan } });
                case "GET /dulieu": return LayDuLieu(dv);   // mọi tài khoản xem được (máy tính chỉ xem tải về); gửi lên chỉ Admin
                case "PUT /dulieu": CanQuyen(tk, VaiTroMayChu.QuanTri); return GuiDuLieu(dv, ctx);
                case "GET /tongquan": return TraLoi.Json(TongQuan(dv, ctx));
                case "GET /tonghop": return TraLoi.Json(TongHop(dv, ctx));
                case "GET /cap1": return TraLoi.Json(Cap1(dv, ctx, null));
                case "POST /cap1/chiso": CanQuyen(tk, VaiTroMayChu.NhapLieu); return TraLoi.Json(NhapChiSo(dv, ctx));
                case "POST /cap1/chot": CanQuyen(tk, VaiTroMayChu.NhapLieu); return TraLoi.Json(NhapChot(dv, ctx));
                case "POST /cap1/taothang": CanQuyen(tk, VaiTroMayChu.NhapLieu); return TraLoi.Json(TaoThangCap1(dv, ctx));
                case "GET /baocao": return TraLoi.Json(DanhSachBaoCao(dv));
                case "POST /baocao/lienket": return TraLoi.Json(LienKetBaoCao(dv, ctx));
                case "GET /taikhoan": CanQuyen(tk, VaiTroMayChu.QuanTri); return TraLoi.Json(DanhSachTaiKhoan(dv));
                case "POST /taikhoan": CanQuyen(tk, VaiTroMayChu.QuanTri); return LuuTaiKhoan(dv, ctx);
                case "DELETE /taikhoan":
                    CanQuyen(tk, VaiTroMayChu.QuanTri);
                    dv.XoaTaiKhoan(tk, ctx.Q("ten"));
                    return TraLoi.Json(new O { { "ok", true } });
            }
            return TraLoi.Loi(404, "Không có địa chỉ này.");
        }

        static string Bearer(NguCanh ctx)
        {
            string a = ctx.Header("Authorization") ?? "";
            return a.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? a.Substring(7).Trim() : null;
        }

        static void CanQuyen(TaiKhoanMayChu tk, VaiTroMayChu can)
        {
            if (tk.VaiTro < can)
                throw new LoiApi(403, can == VaiTroMayChu.QuanTri ? "Cần tài khoản quản trị." : "Tài khoản này chỉ được xem, không được nhập số liệu.");
        }

        static int SoNguyen(string s, int macDinh)
        {
            int v;
            return int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out v) ? v : macDinh;
        }

        static O Thang(int nam, int thang, string ten) { return new O { { "nam", nam }, { "thang", thang }, { "ten", ten } }; }

        static string Ngay(DateTime? d) { return d.HasValue ? d.Value.ToString("dd/MM/yyyy") : null; }

        // ------------------------------------------------------------------ chung

        static TraLoi Ping(DichVuMayChu dv)
        {
            lock (dv.Khoa)
                return TraLoi.Json(new O
                {
                    { "ungDung", "ThatThoatNuoc" }, { "phienBanPhanMem", UngDung.PhienBan }, { "coDuLieu", dv.CoDuLieu },
                    { "coTaiKhoan", dv.CoTaiKhoan }, { "congTy", (dv.Kho.DuLieu.CaiDat.TenCongTy1 + " " + dv.Kho.DuLieu.CaiDat.TenCongTy2).Trim() },
                    { "coApp", File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ThatThoatNuoc-DienThoai.apk")) }
                });
        }

        static TraLoi DangNhap(DichVuMayChu dv, NguCanh ctx)
        {
            O b = JsonMayChu.Doc(ctx.Than);
            TaiKhoanMayChu tk;
            string token = dv.DangNhap(JsonMayChu.Chu(b, "ten"), JsonMayChu.Chu(b, "matKhau"), ctx.Ip,
                                       JsonMayChu.Chu(b, "thietBi") ?? ctx.Header("User-Agent"), out tk);
            O r = Toi(dv, tk);
            r["token"] = token;
            return TraLoi.Json(r);
        }

        static O Toi(DichVuMayChu dv, TaiKhoanMayChu tk)
        {
            string doi = null;
            lock (dv.Khoa)
            {
                DoiCap1 dc = tk.DoiCap1 >= 0 ? dv.Kho.DuLieu.Cap1.TimDoi(tk.DoiCap1) : null;
                if (dc != null) doi = dc.Ten;
                return new O
                {
                    { "ten", tk.Ten }, { "hoTen", tk.HoTen }, { "vaiTro", tk.VaiTro.ToString() }, { "tenVaiTro", TaiKhoanMayChu.TenVaiTro(tk.VaiTro) },
                    { "doi", tk.DoiCap1 }, { "tenDoi", doi }, { "duocNhap", tk.VaiTro >= VaiTroMayChu.NhapLieu },
                    { "congTy", (dv.Kho.DuLieu.CaiDat.TenCongTy1 + " " + dv.Kho.DuLieu.CaiDat.TenCongTy2).Trim() },
                    { "phienBanPhanMem", UngDung.PhienBan },
                    { "coApp", File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ThatThoatNuoc-DienThoai.apk")) }
                };
            }
        }

        // ------------------------------------------------------------------ đồng bộ với phần mềm trên máy tính

        static TraLoi LayDuLieu(DichVuMayChu dv)
        {
            long pb;
            byte[] b = dv.LayDuLieu(out pb);
            var t = new TraLoi { Status = 200, Loai = "application/xml", Than = b };
            t.Header["X-PhienBan"] = pb.ToString(CultureInfo.InvariantCulture);
            return t;
        }

        static TraLoi GuiDuLieu(DichVuMayChu dv, NguCanh ctx)
        {
            long goc;
            if (!long.TryParse(ctx.Header("X-PhienBan-Goc"), NumberStyles.Integer, CultureInfo.InvariantCulture, out goc))
                throw new LoiApi(400, "Thiếu phiên bản gốc.");
            bool ghiDe = ctx.Header("X-GhiDe") == "1";
            DichVuMayChu.KetQuaGui kq = dv.NhanTuMayTinh(ctx.Than, goc, ctx.Header("X-May") ?? "", ctx.NguoiDung.Ten, ghiDe);
            return TraLoi.Json(new O { { "phienBan", kq.PhienBan }, { "daGop", kq.DaGop }, { "boQua", kq.BoQua } });
        }

        // ------------------------------------------------------------------ thất thoát: tháng, cả năm

        static O TongQuan(DichVuMayChu dv, NguCanh ctx)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Kho.DuLieu;
                var r = new O();
                r["thang"] = dl.Thang.AsEnumerable().Reverse().Select(t => Thang(t.Nam, t.Thang, t.Ten)).ToList();
                ThangBaoCao chon = dl.TimThang(SoNguyen(ctx.Q("nam"), 0), SoNguyen(ctx.Q("thang"), 0)) ?? dl.ThangCuoi;
                if (chon == null) { r["chon"] = null; r["donVi"] = new List<object>(); return r; }
                O c = Thang(chon.Nam, chon.Thang, chon.Ten);
                c["kyHoaDon"] = chon.KyHoaDon;
                c["tuNgay"] = Ngay(chon.TuNgay);
                c["denNgay"] = Ngay(chon.DenNgay);
                r["chon"] = c;
                KetQuaThang kq = dv.Bt.Tinh(chon);
                var list = new List<object>();
                foreach (Muc m in dv.Bt.DongTongHop(chon))
                {
                    KetQua k = kq[m.Id] ?? new KetQua();
                    list.Add(new O
                    {
                        { "id", m.Id }, { "stt", m.Stt }, { "ten", m.TenTongHop }, { "tenDay", m.TenMotDong }, { "vaiTro", m.VaiTro.ToString() },
                        { "tyLe", k.TyLe }, { "keHoach", k.KeHoach }, { "soThangTruoc", k.SoThangTruoc }, { "soKeHoach", k.SoKeHoach },
                        { "soCungKy", k.SoCungKy }, { "phatRa", k.PhatRa }, { "chuanThu", k.ChuanThu },
                        { "lkTyLe", k.LkTyLe }, { "lkPhatRa", k.LkPhatRa }, { "lkChuanThu", k.LkChuanThu }, { "lkSoCungKy", k.LkSoCungKy },
                        { "thieu", k.ThieuSoLieu }, { "tinhTrang", k.TyLe.HasValue ? "" : BoTinh.TinhTrangDma(m) }
                    });
                }
                r["donVi"] = list;
                return r;
            }
        }

        static O TongHop(DichVuMayChu dv, NguCanh ctx)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Kho.DuLieu;
                List<int> cacNam = dl.CacNam();
                int nam = SoNguyen(ctx.Q("nam"), cacNam.Count > 0 ? cacNam.Max() : DateTime.Today.Year);
                var r = new O { { "cacNam", cacNam.AsEnumerable().Reverse().ToList() }, { "nam", nam } };
                var kqThang = new KetQuaThang[13];
                var coThang = new List<object>();
                for (int th = 1; th <= 12; th++)
                {
                    ThangBaoCao t = dl.TimThang(nam, th);
                    if (t != null) { kqThang[th] = dv.Bt.Tinh(t); coThang.Add(th); }
                }
                r["coThang"] = coThang;
                ThangBaoCao cuoi = dl.Thang.Where(t => t.Nam == nam).OrderBy(t => t.Thang).LastOrDefault();
                var dong = new List<object>();
                if (cuoi != null)
                {
                    KetQuaThang kc = dv.Bt.Tinh(cuoi);
                    foreach (Muc m in dv.Bt.DongTongHopNam(nam))
                    {
                        var thang = new List<object>();
                        for (int th = 1; th <= 12; th++)
                        {
                            KetQua k = kqThang[th] != null ? kqThang[th][m.Id] : null;
                            if (k == null) { thang.Add(null); continue; }
                            string tt = m.VaiTro == VaiTro.Dma && !k.TyLe.HasValue ? BoTinh.TinhTrangDma(kqThang[th].Thang.Tim(m.Id)) : "";
                            thang.Add(tt.Length > 0 ? (object)tt : k.TyLe);
                        }
                        KetQua lk = kc[m.Id];
                        for (int th = 12; lk == null && th >= 1; th--) if (kqThang[th] != null) lk = kqThang[th][m.Id];
                        lk = lk ?? new KetQua();
                        dong.Add(new O
                        {
                            { "id", m.Id }, { "stt", m.Stt }, { "ten", m.TenTongHop }, { "vaiTro", m.VaiTro.ToString() }, { "thang", thang },
                            { "lkTyLe", lk.LkTyLe }, { "lkPhatRa", lk.LkPhatRa }, { "lkChuanThu", lk.LkChuanThu }, { "lkSoCungKy", lk.LkSoCungKy },
                            { "keHoach", dl.LayKeHoach(nam, m.Id) }
                        });
                    }
                    r["denThang"] = cuoi.Thang;
                }
                r["dong"] = dong;
                return r;
            }
        }

        // ------------------------------------------------------------------ đồng hồ cấp 1

        static O SoLieuTong(TongCap1 t)
        {
            return new O { { "sanLuong", t.SanLuong }, { "thangTruoc", t.ThangTruoc }, { "luyKe", t.LuyKe }, { "soDongHo", t.SoDongHo }, { "soChuaNhap", t.SoChuaNhap } };
        }

        /// <summary>Gọi trong khoá.</summary>
        static O Cap1(DichVuMayChu dv, NguCanh ctx, KyCap1 kyChon)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Kho.DuLieu;
                DuLieuCap1 d = dl.Cap1;
                Cap1Ops.KhoiTaoDoi(dl);
                TaiKhoanMayChu tk = ctx.NguoiDung;
                var r = new O();
                r["thang"] = d.Ky.AsEnumerable().Reverse().Select(k => Thang(k.Nam, k.Thang, k.Ten)).ToList();
                r["doi"] = d.Doi.Select(x => new O { { "id", x.Id }, { "ten", x.Ten } }).ToList();
                int doi = tk.DoiCap1 >= 0 ? tk.DoiCap1 : SoNguyen(ctx.Q("doi"), -1);
                if (doi >= 0 && d.TimDoi(doi) == null) doi = -1;
                r["doiChon"] = doi;
                r["coDinhDoi"] = tk.DoiCap1 >= 0;
                bool nhap = tk.VaiTro >= VaiTroMayChu.NhapLieu;
                r["duocNhap"] = nhap;
                KyCap1 ky = kyChon ?? d.TimKy(SoNguyen(ctx.Q("nam"), 0), SoNguyen(ctx.Q("thang"), 0)) ?? d.KyCuoi;
                KyCap1 cuoi = d.KyCuoi;
                r["thangSau"] = cuoi == null ? null : (cuoi.Thang == 12 ? "1/" + (cuoi.Nam + 1) : (cuoi.Thang + 1) + "/" + cuoi.Nam);
                r["duocTaoThang"] = nhap && cuoi != null;
                if (ky == null) { r["chon"] = null; r["nhom"] = new List<object>(); return r; }
                O c = Thang(ky.Nam, ky.Thang, ky.Ten);
                c["kyHoaDon"] = ky.KyHoaDon;
                c["tuNgay"] = Ngay(ky.TuNgay);
                c["denNgay"] = Ngay(ky.DenNgay);
                c["laCuoi"] = ky == cuoi;
                r["chon"] = c;

                var tinh = new TinhCap1(d);
                Dictionary<int, KetQuaCap1> kq = tinh.Tinh(ky);
                Func<DongHoCap1, bool> loc = doi >= 0 ? tinh.CuaDoi(doi) : TinhCap1.TatCa;
                r["tong"] = SoLieuTong(tinh.Tong(ky, loc));
                r["gieng"] = SoLieuTong(tinh.Tong(ky, x => loc(x) && x.Nguon == NguonNuoc.Gieng));
                r["mat"] = SoLieuTong(tinh.Tong(ky, x => loc(x) && x.Nguon == NguonNuoc.NuocMat));
                var nhom = new List<object>();
                foreach (NhomDoiCap1 nd in d.Cay(ky.ChiSo.Select(x => x.DongHoId), doi))
                {
                    var trams = new List<object>();
                    foreach (NhomTramCap1 nt in nd.Tram)
                    {
                        var dhs = new List<object>();
                        foreach (DongHoCap1 dh in nt.DongHo)
                        {
                            ChiSoCap1 cs = ky.Tim(dh.Id);
                            KetQuaCap1 k = kq[dh.Id];
                            dhs.Add(new O
                            {
                                { "id", dh.Id }, { "ten", dh.Ten }, { "nguon", dh.Nguon == NguonNuoc.Gieng ? "Giếng" : "Nước mặt" }, { "heSo", dh.HeSo },
                                { "cu", cs.ChiSoCu }, { "moi", cs.ChiSoMoi }, { "slNhap", cs.SanLuongNhap }, { "sanLuong", k.SanLuong },
                                { "thangTruoc", k.ThangTruoc }, { "luyKe", k.LuyKe }, { "ghiChu", cs.GhiChu ?? "" }, { "thayDongHo", cs.ThayDongHo },
                                { "amChiSo", k.AmChiSo }, { "cachTinh", k.CachTinh }, { "duocNhap", nhap && (tk.DoiCap1 < 0 || nd.Doi.Id == tk.DoiCap1) }
                            });
                        }
                        O tt = SoLieuTong(tinh.Tong(ky, nt.Loc));
                        tt["id"] = nt.Tram.Id;
                        tt["ten"] = nt.Tram.Ten;
                        tt["chot"] = nt.Tram.Id >= 0 ? ky.LayThoiGianChot(nt.Tram.Id) : "";
                        tt["dongHo"] = dhs;
                        trams.Add(tt);
                    }
                    O dd = SoLieuTong(tinh.Tong(ky, nd.Loc));
                    dd["id"] = nd.Doi.Id;
                    dd["ten"] = nd.Doi.Ten;
                    dd["tram"] = trams;
                    nhom.Add(dd);
                }
                r["nhom"] = nhom;
                return r;
            }
        }

        static KyCap1 KyCuaYeuCau(DuLieuCap1 d, O b)
        {
            KyCap1 ky = d.TimKy(JsonMayChu.So(b, "nam", 0), JsonMayChu.So(b, "thang", 0));
            if (ky == null) throw new LoiApi(404, "Không có tháng này (có thể máy tính vừa xoá). Hãy tải lại trang.");
            return ky;
        }

        static double? DocSo(string s, string ten)
        {
            double? v;
            if (!So.TryDoc(s, out v)) throw new LoiApi(400, ten + ": \"" + s + "\" không phải số hợp lệ.");
            if (v.HasValue && (double.IsNaN(v.Value) || Math.Abs(v.Value) > 1e12)) throw new LoiApi(400, ten + " không hợp lệ.");
            return v;
        }

        /// <summary>Nhập 1 đồng hồ: chỉ số hiện tại / tháng trước, sản lượng nhập thẳng, ghi chú (trường nào gửi lên thì đổi).</summary>
        static O NhapChiSo(DichVuMayChu dv, NguCanh ctx)
        {
            O b = JsonMayChu.Doc(ctx.Than);
            TaiKhoanMayChu tk = ctx.NguoiDung;
            KyCap1 ky;
            lock (dv.Khoa)
            {
                DuLieuCap1 d = dv.Kho.DuLieu.Cap1;
                ky = KyCuaYeuCau(d, b);
                int id = JsonMayChu.So(b, "dongHo", -1);
                ChiSoCap1 cs = ky.Tim(id);
                DongHoCap1 dh = d.TimDongHo(id);
                if (cs == null || dh == null) throw new LoiApi(404, "Đồng hồ này không còn trong tháng (có thể máy tính vừa sửa danh mục). Hãy tải lại trang.");
                if (tk.DoiCap1 >= 0)
                {
                    TramCap1 tr = d.TimTram(dh.TramId);
                    if (tr == null || tr.DoiId != tk.DoiCap1) throw new LoiApi(403, "Tài khoản này chỉ được nhập đồng hồ của đội mình.");
                }
                KyCap1 sau = d.TimKy(ky.SoThu + 1);
                ChiSoCap1 csSau = sau != null ? sau.Tim(id) : null;
                string[] truong = { "cu", "moi", "sl", "gc" };
                var truoc = truong.ToDictionary(t => t, t => DichVuMayChu.GiaTri(cs, t));
                string truocSau = csSau != null ? DichVuMayChu.GiaTri(csSau, "cu") : null;

                if (JsonMayChu.Co(b, "cu")) cs.ChiSoCu = DocSo(JsonMayChu.Chu(b, "cu"), "Chỉ số tháng trước");
                if (JsonMayChu.Co(b, "moi")) Cap1Ops.DatChiSoMoi(d, ky, cs, DocSo(JsonMayChu.Chu(b, "moi"), "Chỉ số hiện tại"));
                if (JsonMayChu.Co(b, "sanLuong")) cs.SanLuongNhap = DocSo(JsonMayChu.Chu(b, "sanLuong"), "Sản lượng");
                if (JsonMayChu.Co(b, "ghiChu"))
                {
                    string g = (JsonMayChu.Chu(b, "ghiChu") ?? "").Trim();
                    cs.GhiChu = g.Length > 300 ? g.Substring(0, 300) : g;
                }

                var ops = new List<ThaoTac>();
                foreach (string t in truong)
                {
                    string moi = DichVuMayChu.GiaTri(cs, t);
                    if (moi != truoc[t])
                        ops.Add(new ThaoTac { Loai = "cs", Nam = ky.Nam, Thang = ky.Thang, Id = id, Truong = t, Cu = truoc[t], Moi = moi, Ten = tk.Ten, Luc = DateTime.UtcNow });
                }
                if (csSau != null && DichVuMayChu.GiaTri(csSau, "cu") != truocSau)
                    ops.Add(new ThaoTac { Loai = "cs", Nam = sau.Nam, Thang = sau.Thang, Id = id, Truong = "cu", Cu = truocSau, Moi = DichVuMayChu.GiaTri(csSau, "cu"), Ten = tk.Ten, Luc = DateTime.UtcNow });
                if (ops.Count > 0)
                {
                    dv.DaSua(ops);
                    dv.Ghi("Điện thoại '" + tk.Ten + "' nhập " + dh.Ten + " (" + ky.Ten + "): " + string.Join(", ", ops.Select(o => o.Truong + " " + o.Cu + "→" + o.Moi)));
                }
            }
            return Cap1(dv, ctx, ky);
        }

        static O NhapChot(DichVuMayChu dv, NguCanh ctx)
        {
            O b = JsonMayChu.Doc(ctx.Than);
            TaiKhoanMayChu tk = ctx.NguoiDung;
            KyCap1 ky;
            lock (dv.Khoa)
            {
                DuLieuCap1 d = dv.Kho.DuLieu.Cap1;
                ky = KyCuaYeuCau(d, b);
                TramCap1 tr = d.TimTram(JsonMayChu.So(b, "tram", -1));
                if (tr == null) throw new LoiApi(404, "Không có trạm này.");
                if (tk.DoiCap1 >= 0 && tr.DoiId != tk.DoiCap1) throw new LoiApi(403, "Tài khoản này chỉ được nhập trạm của đội mình.");
                string cu = ky.LayThoiGianChot(tr.Id), moi = (JsonMayChu.Chu(b, "chot") ?? "").Trim();
                if (moi.Length > 120) moi = moi.Substring(0, 120);
                if (moi != cu)
                {
                    if (moi.Length == 0) ky.ThoiGianChot.Remove(tr.Id);
                    else ky.ThoiGianChot[tr.Id] = moi;
                    dv.DaSua(new List<ThaoTac> { new ThaoTac { Loai = "chot", Nam = ky.Nam, Thang = ky.Thang, Id = tr.Id, Truong = "chot", Cu = cu, Moi = moi, Ten = tk.Ten, Luc = DateTime.UtcNow } });
                }
            }
            return Cap1(dv, ctx, ky);
        }

        static O TaoThangCap1(DichVuMayChu dv, NguCanh ctx)
        {
            TaiKhoanMayChu tk = ctx.NguoiDung;
            KyCap1 moi;
            lock (dv.Khoa)
            {
                DuLieuCap1 d = dv.Kho.DuLieu.Cap1;
                KyCap1 cuoi = d.KyCuoi;
                if (cuoi == null) throw new LoiApi(400, "Chưa có tháng nào — tháng đầu tiên tạo trên phần mềm máy tính.");
                moi = Cap1Ops.TaoKySau(d, cuoi);
                d.Ky.Add(moi);
                d.SapXep();
                dv.DaSua(new List<ThaoTac> { new ThaoTac { Loai = "taoky", Nam = moi.Nam, Thang = moi.Thang, Ten = tk.Ten, Luc = DateTime.UtcNow } });
                dv.Ghi("Điện thoại '" + tk.Ten + "' tạo " + moi.Ten + " (đồng hồ cấp 1)");
            }
            return Cap1(dv, ctx, moi);
        }

        // ------------------------------------------------------------------ báo cáo: Excel / PDF

        static O DanhSachBaoCao(DichVuMayChu dv)
        {
            lock (dv.Khoa)
            {
                DuLieu dl = dv.Kho.DuLieu;
                var quy = new List<object>();
                foreach (int nam in dl.CacNam().AsEnumerable().Reverse())
                    for (int q = 4; q >= 1; q--)
                        if (dl.Thang.Any(t => t.Nam == nam && (t.Thang - 1) / 3 + 1 == q)) quy.Add(new O { { "nam", nam }, { "quy", q }, { "ten", "Quý " + So.LaMa(q) + "/" + nam } });
                return new O
                {
                    { "thang", dl.Thang.AsEnumerable().Reverse().Select(t => Thang(t.Nam, t.Thang, t.Ten)).ToList() },
                    { "nam", dl.CacNam().AsEnumerable().Reverse().ToList() },
                    { "namKeHoach", dl.KeHoach.Keys.OrderByDescending(x => x).ToList() },
                    { "quy", quy },
                    { "cap1Thang", dl.Cap1.Ky.AsEnumerable().Reverse().Select(k => Thang(k.Nam, k.Thang, k.Ten)).ToList() },
                    { "cap1Nam", dl.Cap1.Ky.Select(k => k.Nam).Distinct().OrderByDescending(x => x).ToList() },
                    { "doi", dl.Cap1.Doi.Select(x => new O { { "id", x.Id }, { "ten", x.Ten } }).ToList() }
                };
            }
        }

        /// <summary>Dựng file ngay rồi trả liên kết tải dùng trong 10 phút (để trình duyệt / app tải về mà không cần gửi kèm mã đăng nhập).</summary>
        static O LienKetBaoCao(DichVuMayChu dv, NguCanh ctx)
        {
            O b = JsonMayChu.Doc(ctx.Than);
            string loai = JsonMayChu.Chu(b, "loai") ?? "";
            bool pdf = (JsonMayChu.Chu(b, "dinhDang") ?? "xlsx") == "pdf";
            int nam = JsonMayChu.So(b, "nam", 0), thang = JsonMayChu.So(b, "thang", 0), quy = JsonMayChu.So(b, "quy", 0);
            int doi = ctx.NguoiDung.DoiCap1 >= 0 ? ctx.NguoiDung.DoiCap1 : JsonMayChu.So(b, "doi", -1);
            DuLieu dl = dv.BanSao();
            var bt = new BoTinh(dl);
            var bc = new BaoCao(dl, bt);
            XSo so;
            string ten;
            switch (loai)
            {
                case "thang":
                case "tomtat":
                    {
                        ThangBaoCao t = dl.TimThang(nam, thang);
                        if (t == null) throw new LoiApi(404, "Không có tháng này.");
                        so = loai == "thang" ? bc.SoThang(t) : bc.SoTomTat(t);
                        ten = loai == "thang" ? "BÁO CÁO THẤT THOÁT THÁNG " + t.Thang + " NĂM " + t.Nam : "TÓM TẮT THẤT THOÁT THÁNG " + t.Thang + "-" + t.Nam;
                        break;
                    }
                case "quy":
                    if (bt.ThangCuaQuy(nam, quy).Count == 0) throw new LoiApi(404, "Quý này chưa có tháng nào.");
                    so = bc.SoQuy(nam, quy);
                    ten = "BÁO CÁO THẤT THOÁT QUÝ " + So.LaMa(quy) + " NĂM " + nam;
                    break;
                case "tonghop":
                    if (!dl.Thang.Any(t => t.Nam == nam)) throw new LoiApi(404, "Năm này chưa có số liệu.");
                    so = bc.SoTongHopNam(nam);
                    ten = "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC NĂM " + nam;
                    break;
                case "kehoach":
                    so = bc.SoKeHoach(nam);
                    ten = "KẾ HOẠCH GIAO CHỈ TIÊU NĂM " + nam;
                    break;
                case "socanam":
                    if (pdf) throw new LoiApi(400, "Sổ cả năm chỉ tải dạng Excel.");
                    if (!dl.Thang.Any(t => t.Nam == nam)) throw new LoiApi(404, "Năm này chưa có số liệu.");
                    so = bc.SoCaNam(nam);
                    ten = "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC NĂM " + nam + " (SỔ CẢ NĂM)";
                    break;
                case "cap1thang":
                    {
                        KyCap1 k = dl.Cap1.TimKy(nam, thang);
                        if (k == null) throw new LoiApi(404, "Không có tháng này.");
                        DoiCap1 dc = doi >= 0 ? dl.Cap1.TimDoi(doi) : null;
                        so = new BaoCaoCap1(dl).SoThang(k, dc != null ? doi : -1);
                        ten = Path.GetFileNameWithoutExtension(BaoCaoCap1.TenFileThang(k, dc));
                        break;
                    }
                case "cap1nam":
                    {
                        DoiCap1 dc = doi >= 0 ? dl.Cap1.TimDoi(doi) : null;
                        so = new BaoCaoCap1(dl).SoNam(nam, dc != null ? doi : -1);
                        ten = Path.GetFileNameWithoutExtension(BaoCaoCap1.TenFileNam(nam, dc));
                        break;
                    }
                default:
                    throw new LoiApi(400, "Không có mẫu báo cáo này.");
            }
            byte[] than;
            try
            {
                than = pdf ? XuatPdf.Tao(so) : so.LuuBytes();
            }
            catch (InvalidOperationException ex)
            {
                throw new LoiApi(400, ex.Message);
            }
            string tenFile = ten + (pdf ? ".pdf" : ".xlsx");
            string ma = dv.GiuTep(than, pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", tenFile);
            dv.Ghi("'" + ctx.NguoiDung.Ten + "' tải " + tenFile);
            return new O { { "url", "api/tai/" + ma }, { "ten", tenFile }, { "kichThuoc", than.Length }, { "loai", pdf ? "pdf" : "xlsx" } };
        }

        // ------------------------------------------------------------------ tài khoản (quản trị)

        static O DanhSachTaiKhoan(DichVuMayChu dv)
        {
            List<TaiKhoanMayChu> ds = dv.DanhSachTaiKhoan();
            lock (dv.Khoa)
            {
                DuLieuCap1 d = dv.Kho.DuLieu.Cap1;
                return new O
                {
                    { "taiKhoan", ds.Select(t => new O
                        {
                            { "ten", t.Ten }, { "hoTen", t.HoTen }, { "vaiTro", t.VaiTro.ToString() }, { "tenVaiTro", TaiKhoanMayChu.TenVaiTro(t.VaiTro) },
                            { "doi", t.DoiCap1 }, { "tenDoi", t.DoiCap1 >= 0 && d.TimDoi(t.DoiCap1) != null ? d.TimDoi(t.DoiCap1).Ten : "" },
                            { "khoa", t.Khoa }, { "soPhien", dv.SoPhien(t.Ten) }
                        }).ToList() },
                    { "doi", d.Doi.Select(x => new O { { "id", x.Id }, { "ten", x.Ten } }).ToList() }
                };
            }
        }

        static TraLoi LuuTaiKhoan(DichVuMayChu dv, NguCanh ctx)
        {
            O b = JsonMayChu.Doc(ctx.Than);
            VaiTroMayChu v;
            if (!Enum.TryParse(JsonMayChu.Chu(b, "vaiTro") ?? "", out v)) v = VaiTroMayChu.Xem;
            string kh = JsonMayChu.Chu(b, "khoa");
            dv.LuuTaiKhoan(ctx.NguoiDung, JsonMayChu.Chu(b, "ten"), JsonMayChu.Chu(b, "hoTen"), v, JsonMayChu.So(b, "doi", -1),
                           kh == "True" || kh == "true", JsonMayChu.Chu(b, "matKhau"), JsonMayChu.Chu(b, "moi") == "True" || JsonMayChu.Chu(b, "moi") == "true");
            return TraLoi.Json(DanhSachTaiKhoan(dv));
        }
    }
}
