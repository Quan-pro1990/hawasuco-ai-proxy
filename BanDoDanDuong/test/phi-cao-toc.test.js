import test from 'node:test';
import assert from 'node:assert/strict';
import { docPhiOsm, phiCuaTram, phiTuyen, datBangPhi, capNhatBangPhi, thongTinBangPhi, dinhDangTien } from '../public/js/phi-cao-toc.js';

// Bảng phí giả lập cho kiểm thử (không phải mức phí thật)
const BANG = {
  capNhat: '2026-10-01', nguon: 'kiểm thử',
  tram: [
    { ten: 'Trạm A', osm: [7001], phi: [10000, 20000, 30000, 40000, 50000] },
    { ten: 'Trạm B', viTri: [105.866, 21.040], banKinh: 200, phi: [15000, 25000, 0, 0, 0] }
  ]
};

test('đọc mức phí ghi trên OpenStreetMap', () => {
  assert.equal(docPhiOsm('35000 VND'), 35000);
  assert.equal(docPhiOsm('35.000 đ'), 35000);
  assert.equal(docPhiOsm('35,000 VND/car'), 35000);
  assert.equal(docPhiOsm('yes'), null);
  assert.equal(docPhiOsm('2 EUR'), null);
  assert.equal(docPhiOsm('50'), null);
  assert.equal(dinhDangTien(35000), '35.000 đ');
});

test('phí của trạm theo loại xe: bảng phí trước, thẻ OSM sau, không đoán', () => {
  datBangPhi(BANG);
  assert.deepEqual(phiCuaTram({ id: 'osm7001', viTri: [100, 10] }, 2), { phi: 20000, loaiXe: 2, ten: 'Trạm A', nguon: 'bang' });
  assert.equal(phiCuaTram({ id: 'osm9', viTri: [105.8661, 21.0401] }, 1).phi, 15000);           // khớp theo vị trí
  assert.equal(phiCuaTram({ id: 'osm9', viTri: [105.8661, 21.0401] }, 3), null);                // loại 3 chưa có mức phí
  assert.equal(phiCuaTram({ id: 'osm8', viTri: [106, 20], phiOsm: 35000 }, 1).nguon, 'osm');
  assert.equal(phiCuaTram({ id: 'osm8', viTri: [106, 20], phiOsm: 35000 }, 2), null);           // thẻ OSM chỉ là phí xe con
  assert.equal(phiCuaTram({ id: 'osm8', viTri: [106, 20] }, 1), null);
  // tổng phí dọc tuyến: chỉ trạm nằm trên tuyến
  const tuyen = { toaDo: [[105.860, 21.040], [105.872, 21.040]] };
  assert.deepEqual(phiTuyen(tuyen, 1), { tong: 15000, soTram: 1, ds: [{ ten: 'Trạm B', phi: 15000 }] });
  assert.equal(phiTuyen({ toaDo: [[105.860, 21.050], [105.872, 21.050]] }, 1).soTram, 0);
  datBangPhi(null);
  assert.equal(phiTuyen(tuyen, 1).soTram, 0);
});

test('bảng phí tự tải lại mỗi tuần: máy chủ trước, tệp đi kèm sau', async () => {
  const goi = [];
  const cu = globalThis.fetch;
  globalThis.fetch = async url => {
    goi.push(url);
    if (String(url).startsWith('http://mc')) return { ok: false, status: 500 };
    return { ok: true, json: async () => BANG };
  };
  try {
    datBangPhi(null);
    const du = await capNhatBangPhi({ layMayChu: () => 'http://mc/api' });
    assert.equal(du.tram.length, 2);
    assert.deepEqual(goi, ['http://mc/api/phi-cao-toc', 'du-lieu/phi-cao-toc.json']);
    await capNhatBangPhi({ layMayChu: () => 'http://mc/api' });
    assert.equal(goi.length, 2, 'chưa tới 7 ngày thì không tải lại');
    await capNhatBangPhi({ bayGio: Date.now() + 8 * 86400000 });
    assert.equal(goi.length, 3);
    assert.equal(thongTinBangPhi().soTram, 2);
  } finally {
    globalThis.fetch = cu;
    datBangPhi(null);
  }
});
