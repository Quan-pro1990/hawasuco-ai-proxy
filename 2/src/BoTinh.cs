using System;
using System.Collections.Generic;
using System.Linq;

namespace ThatThoatNuoc
{
    /// <summary>Kết quả tính của 1 dòng trong 1 tháng (các cột E..N của báo cáo).</summary>
    public class KetQua
    {
        public double? PhatRa;          // E
        public double? ChuanThu;        // F
        public double? TyLe;            // G
        public double? TyLeThangTruoc;
        public double? SoThangTruoc;    // H
        public double? KeHoach;
        public double? SoKeHoach;       // I
        public double? CungKy;
        public double? SoCungKy;        // J
        public double LkPhatRa;         // K
        public double? LkChuanThu;      // L
        public double? LkTyLe;          // M
        public double? LkCungKy;
        public double? LkSoCungKy;      // N
        public double? ThatThoat { get { return PhatRa.HasValue && ChuanThu.HasValue ? PhatRa - ChuanThu : null; } }
        public bool ThieuSoLieu;        // có số đầu vào chưa nhập (đã tính như 0)
        public string Loi;
        public string CachTinh = "";    // diễn giải cách ra sản lượng
        public bool CungKyTuDong, LkCungKyTuDong, ThangTruocTuDong;
    }

    public class KetQuaThang
    {
        public ThangBaoCao Thang;
        public Dictionary<int, KetQua> TheoId = new Dictionary<int, KetQua>();

        public KetQua this[int id]
        {
            get
            {
                KetQua k;
                return TheoId.TryGetValue(id, out k) ? k : null;
            }
        }
    }

    public class CanhBao
    {
        public int Id;
        public string NoiDung;
        public int MucDo;   // 2 = lỗi, 1 = cần xem, 0 = nhắc

        public CanhBao(int id, int mucDo, string noiDung)
        {
            Id = id;
            MucDo = mucDo;
            NoiDung = noiDung;
        }
    }

    /// <summary>Tổng hợp nhiều tháng của 1 dòng (quý, gộp tháng).</summary>
    public class KetQuaGop
    {
        public Muc Muc;
        public double PhatRa;
        public double? ChuanThu;
        public double? TyLe;
        public double?[] TheoThang;     // phát ra từng tháng
        public double? SoSanhTruoc, CungKy, SoCungKy, KeHoach, SoKeHoach;
        public bool QuyTruocTuDong, CungKyTuDong;
    }

    /// <summary>
    /// Tính toán giống hệt các công thức trong file Excel báo cáo thất thoát:
    /// E = D − C (TLK) hoặc cộng trừ các dòng; G = (E − F) / E × 100; H = G − G tháng trước;
    /// I = G − kế hoạch; J = G − cùng kỳ; K = E + K tháng trước; M = (K − L) / K × 100.
    /// </summary>
    public class BoTinh
    {
        readonly DuLieu data;
        readonly Dictionary<ThangBaoCao, KetQuaThang> cache = new Dictionary<ThangBaoCao, KetQuaThang>();

        public BoTinh(DuLieu data)
        {
            this.data = data;
        }

        public DuLieu DuLieu { get { return data; } }

        /// <summary>Gọi sau mọi thay đổi số liệu / cấu trúc.</summary>
        public void XoaBoNho()
        {
            cache.Clear();
        }

        class Ctx
        {
            public ThangBaoCao T;
            public Dictionary<int, Muc> ById = new Dictionary<int, Muc>();
            public KetQuaThang Kq;
            public Dictionary<int, int> TrangThaiPr = new Dictionary<int, int>();
            public Dictionary<int, int> TrangThaiCt = new Dictionary<int, int>();
        }

        public static double LamTron(double v)
        {
            return Math.Round(v, 0, MidpointRounding.AwayFromZero);
        }

        public KetQuaThang Tinh(ThangBaoCao t)
        {
            KetQuaThang kq;
            if (cache.TryGetValue(t, out kq)) return kq;
            kq = new KetQuaThang { Thang = t };
            var ctx = new Ctx { T = t, Kq = kq };
            foreach (Muc m in t.Muc)
            {
                ctx.ById[m.Id] = m;
                kq.TheoId[m.Id] = new KetQua();
            }
            foreach (Muc m in t.Muc) PhatRa(ctx, m);
            foreach (Muc m in t.Muc) ChuanThu(ctx, m);

            ThangBaoCao truoc = data.TimThang(t.SoThu - 1);
            KetQuaThang kqTruoc = truoc != null ? Tinh(truoc) : null;
            ThangBaoCao namTruoc = data.TimThang(t.SoThu - 12);
            KetQuaThang kqNamTruoc = namTruoc != null ? Tinh(namTruoc) : null;

            foreach (Muc m in t.Muc)
            {
                KetQua r = kq.TheoId[m.Id];
                if (m.CoChuanThu && r.PhatRa.HasValue && r.ChuanThu.HasValue && r.PhatRa.Value != 0)
                    r.TyLe = (r.PhatRa.Value - r.ChuanThu.Value) / r.PhatRa.Value * 100;
                else if (m.CoChuanThu && m.TyLeNhap.HasValue) r.TyLe = m.TyLeNhap;   // chỉ có tỷ lệ (vd DMA đội báo lên)

                KetQua rt = kqTruoc != null ? kqTruoc[m.Id] : null;
                if (m.CoChuanThu)
                {
                    if (rt != null && rt.TyLe.HasValue)
                    {
                        r.TyLeThangTruoc = rt.TyLe;
                        r.ThangTruocTuDong = true;
                    }
                    else r.TyLeThangTruoc = m.TyLeThangTruoc;
                    if (r.TyLe.HasValue && r.TyLeThangTruoc.HasValue) r.SoThangTruoc = r.TyLe - r.TyLeThangTruoc;

                    r.KeHoach = data.LayKeHoach(t.Nam, m.Id);
                    if (r.TyLe.HasValue && r.KeHoach.HasValue) r.SoKeHoach = r.TyLe - r.KeHoach;

                    KetQua rn = kqNamTruoc != null ? kqNamTruoc[m.Id] : null;
                    if (m.CungKyThang.HasValue) r.CungKy = m.CungKyThang;
                    else if (rn != null && rn.TyLe.HasValue)
                    {
                        r.CungKy = rn.TyLe;
                        r.CungKyTuDong = true;
                    }
                    if (r.TyLe.HasValue && r.CungKy.HasValue) r.SoCungKy = r.TyLe - r.CungKy;

                    if (m.CungKyLuyKe.HasValue) r.LkCungKy = m.CungKyLuyKe;
                    else if (rn != null && rn.LkTyLe.HasValue)
                    {
                        r.LkCungKy = rn.LkTyLe;
                        r.LkCungKyTuDong = true;
                    }
                }

                // Lũy kế trong năm: cộng nối từ tháng trước cùng năm; tháng 1 luôn bắt đầu lại (bỏ qua cả số nhập tay).
                bool coTruoc = truoc != null && truoc.Nam == t.Nam && rt != null;
                bool thang1 = t.Thang == 1;
                double baseE = thang1 ? 0 : m.LuyKePhatRaTruoc.HasValue ? m.LuyKePhatRaTruoc.Value : (coTruoc ? rt.LkPhatRa : 0);
                r.LkPhatRa = (r.PhatRa ?? 0) + baseE;
                if (m.CoChuanThu)
                {
                    double baseF = thang1 ? 0 : m.LuyKeChuanThuTruoc.HasValue ? m.LuyKeChuanThuTruoc.Value
                                 : (coTruoc && rt.LkChuanThu.HasValue ? rt.LkChuanThu.Value : 0);
                    r.LkChuanThu = (r.ChuanThu ?? 0) + baseF;
                    if (r.LkPhatRa != 0) r.LkTyLe = (r.LkPhatRa - r.LkChuanThu.Value) / r.LkPhatRa * 100;
                    if (r.LkTyLe.HasValue && r.LkCungKy.HasValue) r.LkSoCungKy = r.LkTyLe - r.LkCungKy;
                }
            }
            cache[t] = kq;
            return kq;
        }

        double? GiaTriSoHang(Ctx ctx, Muc owner, SoHang s, bool chuanThu, KetQua r, List<string> dien)
        {
            Muc target;
            if (!ctx.ById.TryGetValue(s.Id, out target))
            {
                r.Loi = "Công thức có dòng đã bị xoá";
                return null;
            }
            double? v = chuanThu ? ChuanThu(ctx, target) : PhatRa(ctx, target);
            KetQua rv = ctx.Kq.TheoId[target.Id];
            if (rv.Loi != null && r.Loi == null) r.Loi = rv.Loi.StartsWith("Vòng lặp") ? rv.Loi : "Dòng " + target.Stt + " đang lỗi";
            if (!v.HasValue)
            {
                bool nhapTayTrong = !chuanThu && target.Loai == LoaiMuc.NhapTay;
                if (!nhapTayTrong) r.ThieuSoLieu = true;
            }
            else if (rv.ThieuSoLieu) r.ThieuSoLieu = true;
            if (dien != null)
            {
                string ma = CongThucText.MaThamChieu(ctx.T, owner, target);
                dien.Add((s.HeSo < 0 ? "− " : "+ ") + (Math.Abs(Math.Abs(s.HeSo) - 1) > 1e-12 ? Math.Abs(s.HeSo) + "×" : "") +
                         ma + " (" + (v.HasValue ? So.M3(v) : "chưa có") + ")");
            }
            return v.HasValue ? v.Value * s.HeSo : (double?)null;   // chưa có số: người gọi tự coi là 0 khi cộng
        }

        double? PhatRa(Ctx ctx, Muc m)
        {
            KetQua r = ctx.Kq.TheoId[m.Id];
            int st;
            ctx.TrangThaiPr.TryGetValue(m.Id, out st);
            if (st == 2) return r.PhatRa;
            if (st == 1)
            {
                r.Loi = "Vòng lặp công thức tại dòng " + m.Stt;
                return null;
            }
            ctx.TrangThaiPr[m.Id] = 1;
            double? v = null;
            switch (m.Loai)
            {
                case LoaiMuc.NhapTay:
                    v = m.SanLuong;
                    r.CachTinh = m.SanLuong.HasValue ? "Nhập trực tiếp" : "Chưa nhập (tính như 0 khi cộng vào đội)";
                    break;
                case LoaiMuc.DongHo:
                    v = TinhDongHo(m, r);
                    break;
                case LoaiMuc.CongThuc:
                {
                    var dien = new List<string>();
                    double sum = 0;
                    foreach (SoHang s in m.CongThuc) sum += GiaTriSoHang(ctx, m, s, false, r, dien) ?? 0;
                    if (m.DieuChinh != 0)
                    {
                        sum += m.DieuChinh;
                        dien.Add((m.DieuChinh < 0 ? "− " : "+ ") + So.M3(Math.Abs(m.DieuChinh)) + " (điều chỉnh)");
                    }
                    if (m.LamTron) sum = LamTron(sum);
                    v = sum;
                    string txt = string.Join(" ", dien);
                    if (txt.StartsWith("+ ")) txt = txt.Substring(2);
                    r.CachTinh = txt + " = " + So.M3(v) + (m.LamTron ? " (làm tròn)" : "");
                    break;
                }
            }
            if (m.Loai != LoaiMuc.NhapTay && m.SanLuong.HasValue)
            {
                r.CachTinh = "Nhập tay (ghi đè) " + So.M3(m.SanLuong) + "  — kết quả tính: " + (v.HasValue ? So.M3(v) : "chưa đủ số liệu");
                v = m.SanLuong;
                r.ThieuSoLieu = false;
            }
            if (r.Loi != null && r.Loi.StartsWith("Vòng lặp")) v = null;
            r.PhatRa = v;
            ctx.TrangThaiPr[m.Id] = 2;
            return v;
        }

        /// <summary>Sản lượng TLK = (mới − cũ), có thay đồng hồ thì cộng 2 đoạn, có sai số thì quy đổi, rồi điều chỉnh.</summary>
        public static double? TinhDongHo(Muc m, KetQua r)
        {
            string dien;
            double raw;
            if (m.ThayDongHo)
            {
                if (!m.ChiSoCu.HasValue || !m.ChiSoMoi.HasValue || !m.ChotCu.HasValue || !m.DauMoi.HasValue)
                {
                    if (r != null) r.CachTinh = "Thay đồng hồ: cần đủ chỉ số tháng trước, chốt ĐH cũ, đầu ĐH mới, chỉ số hiện tại";
                    return null;
                }
                raw = (m.ChotCu.Value - m.ChiSoCu.Value) + (m.ChiSoMoi.Value - m.DauMoi.Value);
                dien = "(" + So.N0(m.ChotCu) + " − " + So.N0(m.ChiSoCu) + ") + (" + So.N0(m.ChiSoMoi) + " − " + So.N0(m.DauMoi) + ")";
            }
            else
            {
                if (!m.ChiSoCu.HasValue || !m.ChiSoMoi.HasValue)
                {
                    if (r != null) r.CachTinh = "Chưa nhập " + (!m.ChiSoMoi.HasValue ? "chỉ số hiện tại" : "chỉ số tháng trước");
                    return null;
                }
                raw = m.ChiSoMoi.Value - m.ChiSoCu.Value;
                dien = So.N0(m.ChiSoMoi) + " − " + So.N0(m.ChiSoCu);
            }
            double v = raw;
            if (m.SaiSo != 0)
            {
                v = raw * 100 / (100 + m.SaiSo);
                dien = "(" + dien + ") × 100 / (100 " + (m.SaiSo > 0 ? "+ " : "− ") + So.P2(Math.Abs(m.SaiSo)) + ")";
            }
            if (m.DieuChinh != 0)
            {
                v += m.DieuChinh;
                dien += (m.DieuChinh > 0 ? " + " : " − ") + So.M3(Math.Abs(m.DieuChinh)) + " (điều chỉnh)";
            }
            if (m.LamTron) v = LamTron(v);
            if (r != null) r.CachTinh = dien + " = " + So.M3(v);
            return v;
        }

        double? ChuanThu(Ctx ctx, Muc m)
        {
            KetQua r = ctx.Kq.TheoId[m.Id];
            int st;
            ctx.TrangThaiCt.TryGetValue(m.Id, out st);
            if (st == 2) return r.ChuanThu;
            if (st == 1)
            {
                r.Loi = "Vòng lặp công thức chuẩn thu tại dòng " + m.Stt;
                return null;
            }
            ctx.TrangThaiCt[m.Id] = 1;
            double? v = null;
            if (m.ChuanThuLoai == LoaiChuanThu.Nhap) v = m.ChuanThu;
            else if (m.ChuanThuLoai == LoaiChuanThu.CongThuc)
            {
                double sum = 0;
                bool any = false;
                foreach (SoHang s in m.CongThucChuanThu)
                {
                    double? x = GiaTriSoHang(ctx, m, s, true, r, null);
                    if (x.HasValue) any = true;
                    sum += x ?? 0;
                }
                v = any ? sum : (double?)null;
            }
            r.ChuanThu = v;
            ctx.TrangThaiCt[m.Id] = 2;
            return v;
        }

        // ------------------------------------------------------------------ kiểm tra

        public List<CanhBao> KiemTra(ThangBaoCao t)
        {
            var list = new List<CanhBao>();
            KetQuaThang kq = Tinh(t);
            ThangBaoCao truoc = data.TimThang(t.SoThu - 1);
            KetQuaThang kqTruoc = truoc != null ? Tinh(truoc) : null;
            double nguong = data.CaiDat.NguongCanhBao;
            foreach (Muc m in t.Muc)
            {
                KetQua r = kq[m.Id];
                string ten = m.ToString();
                if (r.Loi != null)
                {
                    list.Add(new CanhBao(m.Id, 2, ten + ": " + r.Loi));
                    continue;
                }
                if (m.Loai == LoaiMuc.DongHo && !m.SanLuong.HasValue)
                {
                    if (!m.ChiSoMoi.HasValue) list.Add(new CanhBao(m.Id, 1, ten + ": chưa nhập chỉ số hiện tại"));
                    else if (!m.ChiSoCu.HasValue) list.Add(new CanhBao(m.Id, 1, ten + ": chưa có chỉ số tháng trước"));
                    else if (m.ThayDongHo && !r.PhatRa.HasValue) list.Add(new CanhBao(m.Id, 1, ten + ": thay đồng hồ nhưng chưa nhập đủ chỉ số chốt / đầu"));
                    else if (!m.ThayDongHo && m.ChiSoMoi < m.ChiSoCu)
                        list.Add(new CanhBao(m.Id, 2, ten + ": chỉ số hiện tại nhỏ hơn tháng trước — nếu đồng hồ được thay / reset, nhập ở mục \"Thay đồng hồ\""));
                }
                if (m.Loai == LoaiMuc.NhapTay && !m.SanLuong.HasValue)
                    list.Add(new CanhBao(m.Id, 0, ten + ": chưa nhập (đang tính bằng 0)"));
                if (m.ChuanThuLoai == LoaiChuanThu.Nhap && !m.ChuanThu.HasValue)
                    list.Add(new CanhBao(m.Id, 1, ten + ": chưa nhập chuẩn thu"));
                if (r.PhatRa.HasValue && r.PhatRa < 0)
                    list.Add(new CanhBao(m.Id, 2, ten + ": sản lượng âm (" + So.M3(r.PhatRa) + " m³)"));
                if (r.TyLe.HasValue && !r.ThieuSoLieu && (m.ChuanThuLoai != LoaiChuanThu.Nhap || m.ChuanThu.HasValue))
                {
                    if (r.TyLe < 0) list.Add(new CanhBao(m.Id, 2, ten + ": tỷ lệ thất thoát âm " + So.P2(r.TyLe) + "% (chuẩn thu lớn hơn phát ra)"));
                    else if (r.SoThangTruoc.HasValue && Math.Abs(r.SoThangTruoc.Value) >= 5)
                        list.Add(new CanhBao(m.Id, 1, ten + ": tỷ lệ thất thoát " + (r.SoThangTruoc > 0 ? "tăng " : "giảm ") +
                                                       So.P2(Math.Abs(r.SoThangTruoc.Value)) + "% so với tháng trước"));
                }
                if (kqTruoc != null && m.Loai == LoaiMuc.DongHo && r.PhatRa.HasValue && !m.SanLuong.HasValue)
                {
                    KetQua rt = kqTruoc[m.Id];
                    if (rt != null && rt.PhatRa.HasValue && rt.PhatRa > 500)
                    {
                        double pct = (r.PhatRa.Value - rt.PhatRa.Value) / rt.PhatRa.Value * 100;
                        if (Math.Abs(pct) >= nguong)
                            list.Add(new CanhBao(m.Id, 1, ten + ": sản lượng " + (pct > 0 ? "tăng " : "giảm ") + So.P2(Math.Abs(pct)) +
                                                           "% so với tháng trước (" + So.M3(rt.PhatRa) + " → " + So.M3(r.PhatRa) + " m³)"));
                    }
                }
            }
            return list.OrderByDescending(c => c.MucDo).ThenBy(c => t.ViTri(c.Id)).ToList();
        }

        // ------------------------------------------------------------------ gộp tháng / quý

        /// <summary>Cộng nhiều tháng theo cấu trúc của tháng cuối cùng có trong danh sách.</summary>
        public List<KetQuaGop> Gop(List<ThangBaoCao> thang)
        {
            var result = new List<KetQuaGop>();
            if (thang.Count == 0) return result;
            ThangBaoCao cuoi = thang[thang.Count - 1];
            var kqs = thang.Select(Tinh).ToList();
            foreach (Muc m in cuoi.Muc)
            {
                var g = new KetQuaGop { Muc = m, TheoThang = new double?[thang.Count] };
                double ct = 0;
                bool coCt = false;
                for (int i = 0; i < thang.Count; i++)
                {
                    KetQua r = kqs[i][m.Id];
                    if (r == null) continue;
                    g.TheoThang[i] = r.PhatRa;
                    g.PhatRa += r.PhatRa ?? 0;
                    if (r.ChuanThu.HasValue)
                    {
                        ct += r.ChuanThu.Value;
                        coCt = true;
                    }
                }
                if (m.CoChuanThu && coCt)
                {
                    g.ChuanThu = ct;
                    if (g.PhatRa != 0) g.TyLe = (g.PhatRa - ct) / g.PhatRa * 100;
                }
                result.Add(g);
            }
            return result;
        }

        public List<ThangBaoCao> ThangCuaQuy(int nam, int quy)
        {
            var list = new List<ThangBaoCao>();
            for (int th = quy * 3 - 2; th <= quy * 3; th++)
            {
                ThangBaoCao t = data.TimThang(nam, th);
                if (t != null) list.Add(t);
            }
            return list;
        }

        public List<KetQuaGop> TinhQuy(int nam, int quy)
        {
            List<KetQuaGop> rows = Gop(ThangCuaQuy(nam, quy));
            int namT = quy == 1 ? nam - 1 : nam, quyT = quy == 1 ? 4 : quy - 1;
            List<KetQuaGop> truoc = ThangCuaQuy(namT, quyT).Count > 0 ? Gop(ThangCuaQuy(namT, quyT)) : null;
            List<KetQuaGop> namTruoc = ThangCuaQuy(nam - 1, quy).Count > 0 ? Gop(ThangCuaQuy(nam - 1, quy)) : null;
            foreach (KetQuaGop g in rows)
            {
                if (!g.Muc.CoChuanThu) continue;
                SoSanhQuy ss = data.LaySoSanhQuy(nam, quy, g.Muc.Id, false);
                KetQuaGop t = truoc != null ? truoc.FirstOrDefault(x => x.Muc.Id == g.Muc.Id) : null;
                double? quyTruoc = ss != null && ss.QuyTruoc.HasValue ? ss.QuyTruoc : null;
                if (!quyTruoc.HasValue && t != null && t.TyLe.HasValue)
                {
                    quyTruoc = t.TyLe;
                    g.QuyTruocTuDong = true;
                }
                if (g.TyLe.HasValue && quyTruoc.HasValue) g.SoSanhTruoc = g.TyLe - quyTruoc;
                KetQuaGop n = namTruoc != null ? namTruoc.FirstOrDefault(x => x.Muc.Id == g.Muc.Id) : null;
                g.CungKy = ss != null && ss.CungKy.HasValue ? ss.CungKy : null;
                if (!g.CungKy.HasValue && n != null && n.TyLe.HasValue)
                {
                    g.CungKy = n.TyLe;
                    g.CungKyTuDong = true;
                }
                if (g.TyLe.HasValue && g.CungKy.HasValue) g.SoCungKy = g.TyLe - g.CungKy;
                g.KeHoach = data.LayKeHoach(nam, g.Muc.Id);
                if (g.TyLe.HasValue && g.KeHoach.HasValue) g.SoKeHoach = g.TyLe - g.KeHoach;
            }
            return rows;
        }

        /// <summary>Tỷ lệ quý trước của 1 dòng (tự tính nếu có số liệu) — dùng hiển thị gợi ý.</summary>
        public double? TyLeQuyTruocTuDong(int nam, int quy, int id)
        {
            int namT = quy == 1 ? nam - 1 : nam, quyT = quy == 1 ? 4 : quy - 1;
            var thang = ThangCuaQuy(namT, quyT);
            if (thang.Count == 0) return null;
            KetQuaGop g = Gop(thang).FirstOrDefault(x => x.Muc.Id == id);
            return g != null ? g.TyLe : null;
        }

        public double? TyLeCungKyQuyTuDong(int nam, int quy, int id)
        {
            var thang = ThangCuaQuy(nam - 1, quy);
            if (thang.Count == 0) return null;
            KetQuaGop g = Gop(thang).FirstOrDefault(x => x.Muc.Id == id);
            return g != null ? g.TyLe : null;
        }

        /// <summary>Các dòng đưa vào bảng tổng hợp năm (đội, khu vực, DMA, toàn công ty) theo tháng cuối của năm.</summary>
        public List<Muc> DongTongHop(ThangBaoCao t)
        {
            return t.Muc.Where(m => m.VaiTro != VaiTro.Khac).ToList();
        }

        /// <summary>
        /// Như DongTongHop của tháng cuối năm, cộng thêm vùng DMA đã có trong năm nhưng đã bỏ ở tháng cuối
        /// (đặt dưới đúng đội / khu vực) để bảng tổng hợp vẫn thấy số của các tháng trước.
        /// </summary>
        public List<Muc> DongTongHopNam(int nam)
        {
            var thang = data.Thang.Where(t => t.Nam == nam).OrderBy(t => t.Thang).ToList();
            if (thang.Count == 0) return new List<Muc>();
            List<Muc> list = DongTongHop(thang[thang.Count - 1]);
            for (int i = thang.Count - 2; i >= 0; i--)
            {
                ThangBaoCao t = thang[i];
                foreach (Muc d in t.Muc.Where(m => m.VaiTro == VaiTro.Dma))
                {
                    if (list.Any(m => m.Id == d.Id)) continue;
                    Muc cha = VungDma.Cha(t, d);
                    int p = cha != null ? list.FindIndex(m => m.Id == cha.Id) : -1;
                    if (p < 0)
                    {
                        int toan = list.FindIndex(m => m.VaiTro == VaiTro.ToanCongTy);
                        list.Insert(toan >= 0 ? toan : list.Count, d);
                        continue;
                    }
                    int j = p + 1;
                    while (j < list.Count && list[j].VaiTro == VaiTro.Dma) j++;
                    list.Insert(j, d);
                }
            }
            return list;
        }

        /// <summary>Chữ hiện ở ô tháng của dòng DMA khi không có tỷ lệ (vd "TLK đứng kim").</summary>
        public static string TinhTrangDma(Muc m)
        {
            if (m == null || m.VaiTro != VaiTro.Dma || string.IsNullOrWhiteSpace(m.GhiChu)) return "";
            return m.GhiChu.Replace("\r", " ").Replace("\n", " ").Trim();
        }
    }
}
