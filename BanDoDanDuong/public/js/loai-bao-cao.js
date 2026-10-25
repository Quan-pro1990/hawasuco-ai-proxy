/* Các loại báo cáo giao thông do người dùng gửi. Dùng chung cho trang web và máy chủ (server.js). */

/**
 * hetHan: số phút báo cáo còn hiệu lực (0 = không tự hết hạn). nghe: câu đọc khi cảnh báo. phu: loại chi tiết
 * (batBuocPhu: phải chọn một loại chi tiết; tieuDePhu: tiêu đề khi chọn).
 */
export const LOAI_BAO_CAO = {
  ketxe: { ten: 'Kẹt xe', mau: '#e53935', icon: 'ketxe', hetHan: 60, nghe: 'kẹt xe' },
  tainan: { ten: 'Tai nạn', mau: '#d81b60', icon: 'tainan', hetHan: 120, nghe: 'tai nạn' },
  csgt: { ten: 'CSGT', mau: '#1e40af', icon: 'csgt', hetHan: 120, nghe: 'cảnh sát giao thông' },
  camera: {
    ten: 'Camera', mau: '#6d28d9', icon: 'camera', hetHan: 0, nghe: 'camera giám sát',
    // loại camera (phu) → loại cảnh báo tương ứng trong loai-canh-bao.js
    phu: {
      tocdo: { ten: 'Camera phạt tốc độ', canhBao: 'camera' },
      dendo: { ten: 'Camera phạt đèn đỏ', canhBao: 'cameraden' },
      giamsat: { ten: 'Camera phạt nguội (giám sát)', canhBao: 'cameragiamsat' }
    }
  },
  // biển báo mới / biển dữ liệu còn thiếu: cộng đồng cùng cập nhật, giữ tới khi nhiều người báo "không còn"
  bienbao: {
    ten: 'Biển báo', mau: '#c62828', icon: 'duongcam', hetHan: 0, nghe: 'biển báo', batBuocPhu: true, tieuDePhu: 'Biển báo nào?',
    // biển → mã biển trong luat-duong.js (BIEN_VN), so: số ghi trên biển
    phu: {
      tocdo40: { ten: 'Tốc độ tối đa 40 km/h', bien: 'P127', so: 40 },
      tocdo50: { ten: 'Tốc độ tối đa 50 km/h', bien: 'P127', so: 50 },
      tocdo60: { ten: 'Tốc độ tối đa 60 km/h', bien: 'P127', so: 60 },
      tocdo70: { ten: 'Tốc độ tối đa 70 km/h', bien: 'P127', so: 70 },
      tocdo80: { ten: 'Tốc độ tối đa 80 km/h', bien: 'P127', so: 80 },
      tocdo90: { ten: 'Tốc độ tối đa 90 km/h', bien: 'P127', so: 90 },
      tocdo100: { ten: 'Tốc độ tối đa 100 km/h', bien: 'P127', so: 100 },
      tocdo120: { ten: 'Tốc độ tối đa 120 km/h', bien: 'P127', so: 120 },
      camretrai: { ten: 'Cấm rẽ trái', bien: 'P123A' },
      camrephai: { ten: 'Cấm rẽ phải', bien: 'P123B' },
      camquaydau: { ten: 'Cấm quay đầu', bien: 'P124A' },
      nguocchieu: { ten: 'Cấm đi ngược chiều', bien: 'P102' },
      duongcam: { ten: 'Đường cấm', bien: 'P101' },
      camoto: { ten: 'Cấm ô tô', bien: 'P103A' },
      cammoto: { ten: 'Cấm mô tô, xe máy', bien: 'P104' },
      camvuot: { ten: 'Cấm vượt', bien: 'P125' },
      camdungdo: { ten: 'Cấm dừng và đỗ xe', bien: 'P130' },
      camdo: { ten: 'Cấm đỗ xe', bien: 'P131A' },
      stop: { ten: 'Dừng lại (STOP)', bien: 'R122' },
      khudancu: { ten: 'Bắt đầu khu đông dân cư', bien: 'R420' },
      treem: { ten: 'Trẻ em', bien: 'W225' },
      giaonhau: { ten: 'Đường giao nhau', bien: 'W205A' },
      congtruong: { ten: 'Công trường', bien: 'W227' }
    }
  },
  ngap: { ten: 'Ngập nước', mau: '#0284c7', icon: 'ngap', hetHan: 360, nghe: 'đường ngập nước' },
  congtrinh: { ten: 'Công trình', mau: '#ea580c', icon: 'congtrinh', hetHan: 7 * 24 * 60, nghe: 'công trình đang thi công' },
  vatcan: { ten: 'Vật cản', mau: '#ca8a04', icon: 'vatcan', hetHan: 60, nghe: 'vật cản trên đường' },
  camduong: { ten: 'Cấm đường', mau: '#b91c1c', icon: 'camduong', hetHan: 12 * 60, nghe: 'đường bị cấm' }
};

/** Số phiếu "không còn" cần có để gỡ báo cáo. */
export function soPhieuGo(loai) {
  return LOAI_BAO_CAO[loai] && LOAI_BAO_CAO[loai].hetHan === 0 ? 3 : 2;
}
