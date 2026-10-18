import test from 'node:test';
import assert from 'node:assert/strict';
import { chuanHoaOsrm, chuanHoaGraphhopper, taoChiDan, thaoTacNgan, timDuong } from '../public/js/chi-duong.js';
import { tuyenOsrm, DIEM } from './du-lieu-mau.js';

test('chuẩn hoá tuyến OSRM: ghép toạ độ, vị trí bước, câu chỉ dẫn', () => {
  const t = chuanHoaOsrm(tuyenOsrm().routes[0]);
  assert.equal(t.toaDo.length, 7 + 5 + 4);                       // các bước nối nhau không lặp điểm
  assert.deepEqual(t.buoc.map(b => b.chiSo), [0, 6, 11, 15]);
  assert.deepEqual(t.toaDo[6], DIEM.B);
  assert.ok(Math.abs(t.buoc[1].batDau - 600) < 5, String(t.buoc[1].batDau));
  assert.deepEqual(t.buoc.map(b => b.chiDan), [
    'Đi về hướng Bắc theo Hàng Bài', 'Rẽ phải vào Tràng Tiền', 'Rẽ trái vào Lý Thái Tổ', 'Đến nơi, điểm đến ở bên phải'
  ]);
  assert.equal(t.buoc[1].lanes.length, 3);
  assert.equal(t.duongChinh, 'Hàng Bài, Tràng Tiền');
  assert.equal(t.coThuPhi, false);
  assert.equal(chuanHoaOsrm(tuyenOsrm().routes[1]).coThuPhi, true);
});

test('câu chỉ dẫn cho các loại thao tác', () => {
  const b = (o) => taoChiDan({ huong: '', ten: '', ref: '', ...o });
  assert.equal(b({ loai: 'roundabout', loiRa: 2, ten: 'Kim Mã' }), 'Vào vòng xuyến, đi theo lối ra thứ hai vào Kim Mã');
  assert.equal(b({ loai: 'turn', huong: 'uturn' }), 'Quay đầu');
  assert.equal(b({ loai: 'turn', huong: 'slight left', ten: 'Láng', ref: 'QL32' }), 'Chếch sang trái vào Láng (QL32)');
  assert.equal(b({ loai: 'off ramp', huong: 'slight right', dichDen: 'Nội Bài' }), 'Đi vào lối ra bên phải hướng Nội Bài');
  assert.equal(b({ loai: 'on ramp', huong: 'right', ten: 'Vành đai 3' }), 'Đi vào đường dẫn bên phải lên Vành đai 3');
  assert.equal(b({ loai: 'fork', huong: 'slight left', ten: 'Pháp Vân' }), 'Đi theo nhánh trái vào Pháp Vân');
  assert.equal(b({ loai: 'new name', ten: 'Giải Phóng' }), 'Tiếp tục đi vào Giải Phóng');
  assert.equal(b({ loai: 'continue', huong: 'straight', ten: 'Giải Phóng' }), 'Tiếp tục đi thẳng trên Giải Phóng');
  assert.equal(b({ loai: 'end of road', huong: 'left', ten: 'Đê La Thành' }), 'Đến cuối đường, rẽ trái vào Đê La Thành');
  assert.equal(b({ loai: 'merge', huong: 'slight right' }), 'Nhập làn bên phải');
  assert.equal(b({ loai: 'arrive', diemDung: true }), 'Đến điểm dừng');
});

test('chuẩn hoá tuyến dạng GraphHopper (VietMap)', () => {
  const p = {
    distance: 1500, time: 155000, points_encoded: false,
    points: { coordinates: [DIEM.A, DIEM.B, DIEM.C, DIEM.D] },
    instructions: [
      { sign: 0, street_name: 'Hàng Bài', distance: 600, time: 60000, interval: [0, 1] },
      { sign: 2, street_name: 'Tràng Tiền', distance: 500, time: 50000, interval: [1, 2] },
      { sign: 6, exit_number: 3, street_name: 'Lý Thái Tổ', distance: 400, time: 45000, interval: [2, 3] },
      { sign: 4, street_name: '', distance: 0, time: 0, interval: [3, 3] }
    ]
  };
  const t = chuanHoaGraphhopper(p);
  assert.equal(t.thoiGian, 155);
  assert.deepEqual(t.buoc.map(b => b.loai), ['depart', 'turn', 'roundabout', 'arrive']);
  assert.equal(t.buoc[1].chiDan, 'Rẽ phải vào Tràng Tiền');
  assert.equal(t.buoc[2].chiDan, 'Vào vòng xuyến, đi theo lối ra thứ ba vào Lý Thái Tổ');
  assert.equal(t.nguon, 'vietmap');
});

test('timDuong: xe máy loại trừ cao tốc, máy chủ không nhận thì bỏ tuỳ chọn và thử lại', async () => {
  const goi = [];
  const fetchCu = globalThis.fetch;
  globalThis.fetch = async (url) => {
    goi.push(url);
    if (url.includes('exclude=')) return { ok: false, status: 400, json: async () => ({ code: 'InvalidValue', message: 'Exclude flag combination is not supported' }) };
    return { ok: true, status: 200, json: async () => tuyenOsrm() };
  };
  try {
    const ds = await timDuong({ diem: [DIEM.A, DIEM.D], phuongTien: 'xemay' });
    assert.equal(ds.length, 2);
    assert.match(goi[0], /exclude=motorway/);
    assert.match(goi[0], /alternatives=true/);
    assert.doesNotMatch(goi[1], /exclude=/);
  } finally {
    globalThis.fetch = fetchCu;
  }
});

test('timDuong: báo lỗi tiếng Việt khi không có đường', async () => {
  const fetchCu = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ code: 'NoRoute', message: 'Impossible route' }) });
  try {
    await assert.rejects(timDuong({ diem: [DIEM.A, DIEM.D], phuongTien: 'dibo' }), /Không tìm thấy đường đi/);
  } finally {
    globalThis.fetch = fetchCu;
  }
});

test('thao tác ngắn cho bảng chỉ hướng ("Còn 200 mét, rẽ phải")', () => {
  const b = o => thaoTacNgan({ huong: '', ten: '', ref: '', loai: 'turn', ...o });
  assert.equal(b({ huong: 'right' }), 'rẽ phải');
  assert.equal(b({ huong: 'sharp left' }), 'rẽ gắt sang trái');
  assert.equal(b({ huong: 'uturn' }), 'quay đầu');
  assert.equal(b({ loai: 'end of road', huong: 'left' }), 'rẽ trái');
  assert.equal(b({ loai: 'roundabout', loiRa: 2 }), 'vào vòng xuyến, lối ra thứ hai');
  assert.equal(b({ loai: 'off ramp', huong: 'slight right' }), 'vào lối ra bên phải');
  assert.equal(b({ loai: 'fork', huong: 'slight left' }), 'đi theo nhánh trái');
  assert.equal(b({ loai: 'continue', huong: 'straight' }), 'đi thẳng');
  assert.equal(b({ loai: 'arrive' }), 'đến nơi');
  assert.equal(b({ loai: 'arrive', diemDung: true }), 'đến điểm dừng');
  assert.equal(thaoTacNgan(null), '');
});
