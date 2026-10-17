import test from 'node:test';
import assert from 'node:assert/strict';
import { GhiHanhTrinh, rutGonMau, svgBieuDoTocDo } from '../public/js/hanh-trinh.js';

test('ghi hành trình: tốc độ trung bình, biểu đồ tốc độ, số lần vượt tốc độ', () => {
  const g = new GhiHanhTrinh();
  g.batDau('Đi làm');
  const t0 = g.batDauLuc;
  // 120 giây, mỗi giây một vị trí, đi thẳng lên phía Bắc 10 m/s (36 km/h); vượt tốc độ ở giây 20–29 và 60–69
  for (let i = 0; i <= 120; i++) {
    g.them({ viTri: [105.85, 21.0 + i * 10 / 110574], tocDo: 10, doChinhXac: 5, thoiGian: t0 + i * 1000 },
      { vuotToc: (i >= 20 && i < 30) || (i >= 60 && i < 70) });
  }
  const ht = g.ketThuc();
  assert.ok(Math.abs(ht.quangDuong - 1200) < 15, String(ht.quangDuong));
  assert.equal(ht.tocDoTB, 36);
  assert.equal(ht.tocDoMax, 36);
  assert.equal(ht.soLanVuot, 2);
  assert.equal(ht.tgVuot, 20);
  assert.equal(ht.bieuDo.length, 12);                    // mỗi 10 giây một mẫu
  assert.deepEqual(ht.bieuDo[0], [10, 36]);
  const svg = svgBieuDoTocDo(ht.bieuDo);
  assert.match(svg, /<polyline points="[\d., ]+" class="bd-duong"\/>/);
  assert.match(svg, />2 phút</);
  assert.equal(svgBieuDoTocDo([[10, 30]]), '');
});

test('rút gọn mẫu biểu đồ', () => {
  const mau = Array.from({ length: 1000 }, (_, i) => [i * 10, i % 2 ? 40 : 20]);
  const r = rutGonMau(mau, 100);
  assert.equal(r.length, 100);
  assert.ok(r.every(m => m[1] === 30));
  assert.equal(r[r.length - 1][0], 9990);
  assert.deepEqual(rutGonMau([[1, 2]], 10), [[1, 2]]);
});
