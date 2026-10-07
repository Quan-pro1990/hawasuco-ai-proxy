using System;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Tạo tháng mới — dùng chung cho trang Nhập số liệu tháng và trang Vùng DMA.</summary>
    static class ThaoTacThang
    {
        /// <summary>Tên tháng sẽ tạo kế tiếp (sau tháng cuối có số liệu), vd "tháng 11/2026".</summary>
        public static string TenThangSau(DuLieu dl)
        {
            ThangBaoCao cuoi = dl.ThangCuoi;
            if (cuoi == null) return null;
            int thang = cuoi.Thang == 12 ? 1 : cuoi.Thang + 1, nam = cuoi.Thang == 12 ? cuoi.Nam + 1 : cuoi.Nam;
            return "tháng " + thang + "/" + nam;
        }

        public static string NhanNut(DuLieu dl)
        {
            string ten = TenThangSau(dl);
            return ten == null ? "+ Tạo tháng mới" : "+ Tạo " + ten;
        }

        /// <summary>Nội dung hộp xác nhận tạo tháng; sang tháng 1 thì báo lũy kế bắt đầu lại và nhắc kế hoạch năm mới.</summary>
        public static string NoiDungXacNhan(DuLieu dl, ThangBaoCao cuoi, ThangBaoCao moi)
        {
            int thieu = cuoi.Muc.Count(m => m.Loai == LoaiMuc.DongHo && m.VaiTro != VaiTro.Dma && !m.ChiSoMoi.HasValue);
            int dma = cuoi.Muc.Count(m => m.VaiTro == VaiTro.Dma);
            int dmaThieu = cuoi.Muc.Count(m => m.VaiTro == VaiTro.Dma && m.Loai == LoaiMuc.DongHo && !m.ChiSoMoi.HasValue);
            return "Tạo " + moi.Ten + " từ " + cuoi.Ten + ":\n\n" +
                   "• Chép nguyên cấu trúc (" + cuoi.Muc.Count(m => m.VaiTro != VaiTro.Dma) + " dòng, công thức, đội / khu vực).\n" +
                   "• Chỉ số tháng trước = chỉ số hiện tại của " + cuoi.Ten.ToLower() + ".\n" +
                   (dma > 0 ? "• Chép danh sách " + dma + " vùng DMA; số liệu vùng DMA tháng mới để trống chờ nhập.\n" : "") +
                   "• Hoá đơn kỳ " + moi.KyHoaDon + (moi.TuNgay.HasValue ? ", nước tiêu thụ " + So.Ngay(moi.TuNgay) + " → " + So.Ngay(moi.DenNgay) : "") +
                   " (sửa được ở Thông tin kỳ báo cáo).\n" +
                   (moi.Thang == 1
                       ? "• Sang năm " + moi.Nam + ": lũy kế bắt đầu lại từ tháng 1 (không cộng số năm " + cuoi.Nam + "); " +
                         "\"so tháng trước\" của tháng 1 so với tháng 12/" + cuoi.Nam + ".\n" +
                         (dl.CoKeHoach(moi.Nam) ? "" : "• Năm " + moi.Nam + " chưa có kế hoạch — nhập ở trang Kế hoạch năm (có nút chép kế hoạch " + cuoi.Nam + ").\n")
                       : "") +
                   (thieu > 0 ? "\nLưu ý: " + cuoi.Ten.ToLower() + " còn " + thieu + " đồng hồ chưa có chỉ số hiện tại — các dòng đó sẽ trống chỉ số tháng trước.\n" : "") +
                   (dmaThieu > 0 ? (thieu > 0 ? "" : "\n") + "Lưu ý: " + dmaThieu + " vùng DMA đo bằng đồng hồ chưa có chỉ số hiện tại " + cuoi.Ten.ToLower() + ".\n" : "") +
                   "\nTiếp tục?";
        }

        /// <summary>
        /// Tạo tháng kế tiếp từ tháng cuối: chép cấu trúc + danh sách vùng DMA, chỉ số tháng trước = chỉ số hiện tại
        /// tháng cuối. Hỏi xác nhận (trừ khi [hoi] = false). Trả tháng mới, hoặc null nếu huỷ / chưa có tháng nào.
        /// </summary>
        public static ThangBaoCao TaoThangSau(IWin32Window owner, PhienLam phien, bool hoi)
        {
            DuLieu dl = phien.Dl;
            ThangBaoCao cuoi = dl.ThangCuoi;
            if (cuoi == null) return null;
            ThangBaoCao moi = dl.TaoThangSau(cuoi);
            if (hoi && MessageBox.Show(owner, NoiDungXacNhan(dl, cuoi, moi), UngDung.Ten, MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK)
                return null;
            dl.Thang.Add(moi);
            dl.SapXep();
            phien.ChonThang(moi);
            phien.Luu(null);
            return moi;
        }
    }
}
