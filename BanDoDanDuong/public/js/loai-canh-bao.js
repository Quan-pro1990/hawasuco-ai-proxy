/*
 * Các loại cảnh báo trên đường. Mỗi loại có mức riêng trong cài đặt:
 * 0 = tắt, 1 = chỉ hiển thị, 2 = hiển thị và đọc bằng giọng nói (kèm âm báo).
 *
 * kc: khoảng cách báo trước (m, 'camera' = theo cài đặt "Báo trước camera"); lech: điểm cách mép đường tối đa (m);
 * uuTien: loại nào được hiện khi có nhiều cảnh báo cùng lúc; nho: chỉ vẽ trên bản đồ khi phóng to;
 * khongBanDo: không phải điểm trên bản đồ (tính từ tuyến đường / dữ liệu đường).
 */
import { caiDat } from './kho.js';

export const MUC_CANH_BAO = [[0, 'Tắt'], [1, 'Chỉ hiển thị'], [2, 'Hiển thị + giọng nói']];

export const LOAI_CANH_BAO = {
  camera: { ten: 'Camera phạt tốc độ', icon: 'cameratocdo', mau: '#6d28d9', kc: 'camera', uuTien: 3, macDinh: 2 },
  cameraden: { ten: 'Camera phạt đèn đỏ', icon: 'cameraden', mau: '#7c3aed', kc: 'camera', uuTien: 3, macDinh: 2 },
  cameratb: { ten: 'Camera đo tốc độ trung bình', icon: 'cameratb', mau: '#5b21b6', kc: 'camera', uuTien: 3, macDinh: 2 },
  cameragiamsat: { ten: 'Camera phạt nguội (giám sát giao thông)', icon: 'cameragiamsat', mau: '#4c1d95', kc: 'camera', uuTien: 3, macDinh: 2 },
  kiemtra: { ten: 'Điểm kiểm tra tốc độ', icon: 'kiemtra', mau: '#1e40af', kc: 'camera', uuTien: 3, macDinh: 2 },
  gioihan: { ten: 'Giới hạn tốc độ thay đổi', icon: 'tocke', mau: '#dc2626', kc: 300, uuTien: 2, macDinh: 2, khongBanDo: true },
  khuccua: { ten: 'Khúc cua nguy hiểm', icon: 'cuaphai', mau: '#d97706', kc: 300, uuTien: 2, macDinh: 2, khongBanDo: true },
  nguyhiem: { ten: 'Đoạn đường nguy hiểm', icon: 'canhbao', mau: '#dc2626', kc: 400, uuTien: 2, macDinh: 2 },
  duongcam: { ten: 'Đường cấm, đi ngược chiều đường một chiều', icon: 'duongcam', mau: '#b91c1c', kc: 200, uuTien: 4, macDinh: 2 },
  camvuot: { ten: 'Đoạn cấm vượt', icon: 'camvuot', mau: '#c62828', kc: 300, uuTien: 2, macDinh: 2 },
  camdungdo: { ten: 'Cấm dừng, cấm đỗ xe (khi đi chậm)', icon: 'camdungdo', mau: '#1d4ed8', kc: 150, uuTien: 1, macDinh: 2 },
  camre: { ten: 'Biển cấm rẽ, chỉ được rẽ', icon: 'camretrai', mau: '#c62828', kc: 200, uuTien: 2, macDinh: 2 },
  biencam: { ten: 'Biển cấm khác, biển STOP (cấm quay đầu, tải trọng, chiều cao…)', icon: 'duongcam', mau: '#c62828', kc: 200, uuTien: 1, macDinh: 2 },
  biennguyhiem: { ten: 'Biển báo nguy hiểm (giao nhau, chỗ ngoặt, dốc, công trường, trẻ em…)', icon: 'canhbao', mau: '#e0a800', kc: 250, uuTien: 1, macDinh: 2 },
  bientocdo: { ten: 'Biển tốc độ tối đa (tốc độ của đường đã có ở mục giới hạn)', icon: 'tocke', mau: '#dc2626', kc: 300, uuTien: 0, macDinh: 1 },
  duongsat: { ten: 'Đường sắt giao cắt', icon: 'duongsat', mau: '#b45309', kc: 300, uuTien: 2, macDinh: 2 },
  truonghoc: { ten: 'Trường học', icon: 'truonghoc', mau: '#ca8a04', kc: 300, lech: 120, uuTien: 1, macDinh: 2 },
  gogiam: { ten: 'Gờ giảm tốc', icon: 'gogiam', mau: '#a16207', kc: 150, uuTien: 1, macDinh: 2, nho: true },
  ham: { ten: 'Hầm đường bộ', icon: 'ham', mau: '#475569', kc: 500, uuTien: 1, macDinh: 2 },
  thuphi: { ten: 'Trạm thu phí', icon: 'thuphi', mau: '#0f766e', kc: 1000, uuTien: 1, macDinh: 2 },
  tramdung: { ten: 'Trạm dừng nghỉ', icon: 'tramdung', mau: '#15803d', kc: 2000, lech: 250, uuTien: 1, macDinh: 2 },
  dentinhieu: { ten: 'Đèn tín hiệu', icon: 'dentinhieu', mau: '#16a34a', kc: 150, uuTien: 0, macDinh: 0, nho: true },
  vachqua: { ten: 'Vạch người đi bộ qua đường', icon: 'vachqua', mau: '#2563eb', kc: 100, uuTien: 0, macDinh: 0, nho: true },
  khudancu: { ten: 'Vào / ra khu đông dân cư', icon: 'khudancu', mau: '#0369a1', macDinh: 2, khongBanDo: true },
  baocao: { ten: 'Báo cáo giao thông (kẹt xe, tai nạn, CSGT…)', icon: 'loabao', mau: '#e53935', kc: 800, uuTien: 2, macDinh: 2, khongBanDo: true }
};

/** Biển cấm rẽ / chỉ được rẽ (thẻ restriction của OpenStreetMap). */
export const BIEN_RE = {
  no_left_turn: { icon: 'camretrai', ten: 'Cấm rẽ trái', nghe: 'cấm rẽ trái' },
  no_right_turn: { icon: 'camrephai', ten: 'Cấm rẽ phải', nghe: 'cấm rẽ phải' },
  no_u_turn: { icon: 'camquaydau', ten: 'Cấm quay đầu', nghe: 'cấm quay đầu' },
  no_straight_on: { icon: 'camdithang', ten: 'Cấm đi thẳng', nghe: 'cấm đi thẳng' },
  only_left_turn: { icon: 'chiretrai', ten: 'Chỉ được rẽ trái', nghe: 'chỉ được rẽ trái' },
  only_right_turn: { icon: 'chirephai', ten: 'Chỉ được rẽ phải', nghe: 'chỉ được rẽ phải' },
  only_straight_on: { icon: 'chidithang', ten: 'Chỉ được đi thẳng', nghe: 'chỉ được đi thẳng' }
};

/** Loại nguy hiểm (thẻ hazard của OpenStreetMap). */
export const NGUY_HIEM = {
  dangerous_junction: 'giao lộ nguy hiểm', curve: 'khúc cua nguy hiểm', curves: 'nhiều khúc cua nguy hiểm',
  school_zone: 'khu vực trường học', children: 'khu vực có trẻ em', pedestrians: 'nhiều người đi bộ',
  animal_crossing: 'động vật băng qua đường', cattle: 'gia súc băng qua đường', falling_rocks: 'đá lở',
  landslide: 'sạt lở đất', slippery: 'đường trơn', flooding: 'đoạn dễ ngập nước', accident: 'đoạn hay xảy ra tai nạn',
  bump: 'đường xóc', dip: 'đường lõm', steep_incline: 'dốc nguy hiểm', narrow_road: 'đường hẹp', fog: 'sương mù'
};

/** Mức đang chọn cho một loại cảnh báo. */
export function mucCanhBao(loai) {
  const m = caiDat.mucCanhBao && caiDat.mucCanhBao[loai];
  if (m === 0 || m === 1 || m === 2) return m;
  return LOAI_CANH_BAO[loai] ? LOAI_CANH_BAO[loai].macDinh : 0;
}

/** Khoảng cách báo trước (m) của một loại. */
export function kcBaoTruoc(loai) {
  const k = LOAI_CANH_BAO[loai];
  if (!k) return 500;
  return k.kc === 'camera' ? caiDat.kcCanhBaoCamera : k.kc || 500;
}
