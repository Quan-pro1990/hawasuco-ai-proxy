/* Các loại báo cáo giao thông do người dùng gửi. Dùng chung cho trang web và máy chủ (server.js). */

/** hetHan: số phút báo cáo còn hiệu lực (0 = không tự hết hạn). nghe: câu đọc khi cảnh báo. phu: loại chi tiết (không bắt buộc). */
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
      giamsat: { ten: 'Camera giám sát, phạt nguội', canhBao: 'cameragiamsat' }
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
