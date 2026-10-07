using System;
using System.Collections.Generic;
using System.Linq;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Vùng DMA là 1 dòng (vai trò DMA) nằm cuối khối của đội / khu vực chứa nó trong cấu trúc tháng,
    /// không in trong báo cáo tháng, hiện ngay dưới đội / khu vực đó trong bảng tổng hợp năm.
    /// Thêm / sửa / xoá áp dụng cho tháng đang chọn và mọi tháng sau đã tạo (tháng trước giữ nguyên lịch sử).
    /// </summary>
    public static class VungDma
    {
        /// <summary>Đơn vị có thể chứa vùng DMA: đội, khu vực.</summary>
        public static bool LaDonViCha(Muc m)
        {
            return m.CoChuanThu && (m.VaiTro == VaiTro.Doi || m.VaiTro == VaiTro.KhuVuc);
        }

        /// <summary>Đơn vị chứa vùng DMA [dma] (dòng đội / khu vực gần nhất phía trên, cấp nhỏ hơn).</summary>
        public static Muc Cha(ThangBaoCao t, Muc dma)
        {
            int i = t.ViTri(dma.Id);
            for (int j = i - 1; j >= 0; j--)
            {
                Muc m = t.Muc[j];
                if (m.Cap < dma.Cap && LaDonViCha(m)) return m;
                if (m.Cap == 0 && m.Cap < dma.Cap && !LaDonViCha(m)) return null;
            }
            return null;
        }

        /// <summary>Vị trí chèn vào cuối khối của dòng [cha] (trước dòng kế tiếp cùng cấp hoặc cấp cao hơn).</summary>
        public static int CuoiKhoi(ThangBaoCao t, Muc cha)
        {
            int p = t.ViTri(cha.Id);
            int j = p + 1;
            while (j < t.Muc.Count && t.Muc[j].Cap > cha.Cap) j++;
            return j;
        }

        public static List<Muc> CuaDonVi(ThangBaoCao t, Muc cha)
        {
            return t.Muc.Where(m => m.VaiTro == VaiTro.Dma && Cha(t, m) == cha).ToList();
        }

        public static Muc TaoMuc(int id, string ten, Muc cha, LoaiMuc loai)
        {
            return new Muc
            {
                Id = id,
                Ten = ten,
                Cap = cha.Cap + 1,
                Loai = loai,
                ChuanThuLoai = LoaiChuanThu.Nhap,
                VaiTro = VaiTro.Dma,
                AnBaoCaoThang = true
            };
        }

        static IEnumerable<ThangBaoCao> TuThang(DuLieu dl, ThangBaoCao tu)
        {
            return dl.Thang.Where(t => t.SoThu >= tu.SoThu).OrderBy(t => t.SoThu).ToList();
        }

        /// <summary>Chèn [dma] vào cuối khối của đơn vị [chaId] trong tháng [t]; false nếu tháng đó không có đơn vị này.</summary>
        public static bool Chen(ThangBaoCao t, Muc dma, int chaId)
        {
            Muc cha = t.Tim(chaId);
            if (cha == null) return false;
            dma.Cap = cha.Cap + 1;
            t.Muc.Insert(CuoiKhoi(t, cha), dma);
            return true;
        }

        public static Muc Them(DuLieu dl, ThangBaoCao tu, int chaId, string ten, LoaiMuc loai)
        {
            int id = dl.CapId();
            Muc dau = null;
            ThangBaoCao truoc = null;
            foreach (ThangBaoCao t in TuThang(dl, tu))
            {
                Muc cha = t.Tim(chaId);
                if (cha == null) { truoc = t; continue; }
                Muc m = TaoMuc(id, ten, cha, loai);
                if (loai == LoaiMuc.DongHo && truoc != null && truoc.Tim(id) != null) m.ChiSoCu = truoc.Tim(id).ChiSoMoi;
                Chen(t, m, chaId);
                if (dau == null) dau = m;
                truoc = t;
            }
            return dau;
        }

        public static void Sua(DuLieu dl, ThangBaoCao tu, int id, string ten, int chaId, LoaiMuc loai)
        {
            foreach (ThangBaoCao t in TuThang(dl, tu))
            {
                Muc m = t.Tim(id);
                if (m == null) continue;
                m.Ten = ten;
                if (m.Loai != loai)
                {
                    m.Loai = loai;
                    m.ChiSoCu = m.ChiSoMoi = m.ChotCu = m.DauMoi = null;
                    m.SanLuong = null;
                }
                Muc cha = Cha(t, m);
                if (cha == null || cha.Id != chaId)
                {
                    if (t.Tim(chaId) == null) continue;
                    t.Muc.Remove(m);
                    Chen(t, m, chaId);
                }
            }
        }

        public static void Xoa(DuLieu dl, ThangBaoCao tu, int id)
        {
            foreach (ThangBaoCao t in TuThang(dl, tu))
            {
                Muc m = t.Tim(id);
                if (m != null) t.Muc.Remove(m);
            }
        }

        /// <summary>Đổi thứ tự với vùng DMA kề trên (-1) / dưới (+1) cùng đơn vị.</summary>
        public static bool DiChuyen(DuLieu dl, ThangBaoCao tu, int id, int huong)
        {
            bool doi = false;
            foreach (ThangBaoCao t in TuThang(dl, tu))
            {
                Muc m = t.Tim(id);
                if (m == null) continue;
                int i = t.ViTri(id), j = i + huong;
                if (j < 0 || j >= t.Muc.Count) continue;
                Muc k = t.Muc[j];
                if (k.VaiTro != VaiTro.Dma || Cha(t, k) != Cha(t, m)) continue;
                t.Muc[i] = k;
                t.Muc[j] = m;
                doi = true;
            }
            return doi;
        }

        /// <summary>Nhập đè 1 tháng từ Excel: giữ các vùng DMA của tháng cũ (cấu trúc + số đã nhập) dưới đúng đơn vị.</summary>
        public static void GiuLaiKhiThay(ThangBaoCao cu, ThangBaoCao moi)
        {
            foreach (Muc d in cu.Muc.Where(m => m.VaiTro == VaiTro.Dma).ToList())
            {
                if (moi.Tim(d.Id) != null) continue;
                Muc cha = Cha(cu, d);
                if (cha == null || !Chen(moi, d, cha.Id))
                {
                    d.Cap = Math.Max(1, d.Cap);
                    moi.Muc.Add(d);
                }
            }
        }
    }
}
