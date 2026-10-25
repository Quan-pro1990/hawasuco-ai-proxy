import test from 'node:test';
import assert from 'node:assert/strict';
import { docTiengViet } from '../public/js/giong-noi.js';

test('câu đọc lên: chữ viết tắt trong tên đường đọc thành chữ đầy đủ tiếng Việt', () => {
  const ca = [
    ['Sau 300 mét, rẽ phải vào Trần Phú (QL6).', 'Sau 300 mét, rẽ phải vào Trần Phú, quốc lộ 6.'],
    ['Đi vào QL1A hướng Hà Nội', 'Đi vào quốc lộ 1A hướng Hà Nội'],
    ['Rẽ trái vào ĐT.420', 'Rẽ trái vào đường tỉnh 420'],
    ['Tiếp tục trên Đại lộ Thăng Long (ĐCT08)', 'Tiếp tục trên Đại lộ Thăng Long, đường cao tốc 08'],
    ['Nhập làn vào CT.01', 'Nhập làn vào cao tốc 01'],
    ['Tốc độ tối đa 50 km/h.', 'Tốc độ tối đa 50 ki lô mét trên giờ.'],
    ['Phía trước 300 m có camera', 'Phía trước 300 mét có camera'],
    ['Còn 2 km', 'Còn 2 ki lô mét'],
    ['Rẽ phải vào Ng. 91 Cầu Diễn', 'Rẽ phải vào ngõ 91 Cầu Diễn'],
    ['Đến BV Bạch Mai', 'Đến bệnh viện Bạch Mai'],
    ['Trường THPT Nguyễn Trãi', 'Trường trung học phổ thông Nguyễn Trãi'],
    ['ĐH Bách Khoa', 'đại học Bách Khoa']
  ];
  for (const [vao, ra] of ca) assert.equal(docTiengViet(vao), ra, vao);
  // không đổi câu đã đúng, tên có chữ giống viết tắt nằm trong từ khác
  for (const s of ['Phố Huế', 'Đường Quang Trung', 'Camera phạt tốc độ', 'Sau 1,5 ki lô mét, đi thẳng.', 'Hoàng Quốc Việt']) assert.equal(docTiengViet(s), s, s);
  assert.equal(docTiengViet(''), '');
});
