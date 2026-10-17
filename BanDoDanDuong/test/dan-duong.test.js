import test from 'node:test';
import assert from 'node:assert/strict';
import { chuanHoaOsrm } from '../public/js/chi-duong.js';
import { DanDuong } from '../public/js/dan-duong.js';
import { diemTaiS, diemDich } from '../public/js/hinh-hoc.js';
import { tuyenOsrm } from './du-lieu-mau.js';

const tuyen = () => chuanHoaOsrm(tuyenOsrm().routes[0]);

/** Cho "xe" chạy dọc tuyến, mỗi giây 10 m/s, ghi lại câu nhắc và sự kiện. */
function chay(t, v = 10) {
  const dd = new DanDuong(t);
  const loi = [dd.loiBatDau()], suKien = [];
  const tong = t.tichLuy.at(-1);
  let tt;
  for (let s = 0; s <= tong + 5; s += v) {
    const p = diemTaiS(t.toaDo, t.tichLuy, Math.min(s, tong));
    tt = dd.capNhat({ viTri: p.diem, tocDo: v, huong: p.huong, doChinhXac: 5 });
    if (tt.noi) loi.push(Math.round(s) + ': ' + tt.noi);
    suKien.push(...tt.suKien.map(e => e.loai));
  }
  return { loi, suKien, tt };
}

test('đọc nhắc rẽ theo thứ tự và báo đến nơi', () => {
  const { loi, suKien, tt } = chay(tuyen());
  const chu = loi.join('\n');
  assert.match(loi[0], /^Bắt đầu dẫn đường\. Đi về hướng Bắc theo Hàng Bài\. Sau 600 mét, rẽ phải vào Tràng Tiền\.$/);
  const iGan = loi.findIndex(x => /Sau 1\d0 mét, rẽ phải vào Tràng Tiền/.test(x));
  const iNgay = loi.findIndex(x => /: Rẽ phải vào Tràng Tiền\.$/.test(x));
  const iTrai = loi.findIndex(x => /: Rẽ trái vào Lý Thái Tổ/.test(x));
  assert.ok(iGan > 0 && iNgay > iGan && iTrai > iNgay, chu);
  assert.match(chu, /Sau \d+ mét, rẽ trái vào Lý Thái Tổ/);
  assert.match(loi.at(-1), /Bạn đã đến nơi\. Điểm đến ở bên phải\./);
  assert.deepEqual(suKien.filter(e => e === 'dennoi'), ['dennoi']);
  assert.ok(!suKien.includes('lechtuyen'));
  assert.equal(tt.daDen, true);
  // mỗi câu nhắc chỉ đọc một lần
  assert.equal(new Set(loi.map(x => x.replace(/^\d+: /, ''))).size, loi.length, chu);
});

test('quãng đường, thời gian còn lại và bước kế tiếp', () => {
  const t = tuyen();
  const dd = new DanDuong(t);
  const p = diemTaiS(t.toaDo, t.tichLuy, 300);
  const tt = dd.capNhat({ viTri: p.diem, tocDo: 10, huong: p.huong, doChinhXac: 5 });
  assert.ok(Math.abs(tt.s - 300) < 1);
  assert.ok(Math.abs(tt.kcDenRe - (t.buoc[1].batDau - 300)) < 1);
  assert.equal(tt.ke.chiDan, 'Rẽ phải vào Tràng Tiền');
  assert.equal(tt.keNua.chiDan, 'Rẽ trái vào Lý Thái Tổ');
  // còn nửa bước đầu (30 s) + 50 s + 45 s
  assert.ok(Math.abs(tt.thoiGianConLai - 125) < 2, String(tt.thoiGianConLai));
  assert.ok(Math.abs(tt.conLai - (t.tichLuy.at(-1) - 300)) < 1);
});

test('đi lệch tuyến 3 lần liên tiếp thì báo đi sai đường', () => {
  const t = tuyen();
  const dd = new DanDuong(t);
  const p = diemTaiS(t.toaDo, t.tichLuy, 200);
  dd.capNhat({ viTri: p.diem, tocDo: 10, huong: 0, doChinhXac: 5 });
  const xa = diemDich(p.diem, 270, 120);
  const sk = [];
  for (let i = 0; i < 4; i++) sk.push(dd.capNhat({ viTri: xa, tocDo: 10, huong: 270, doChinhXac: 5 }).suKien.map(e => e.loai));
  assert.deepEqual(sk, [[], [], ['lechtuyen'], []]);
  // quay lại tuyến: hết lệch
  const lai = dd.capNhat({ viTri: diemTaiS(t.toaDo, t.tichLuy, 230).diem, tocDo: 10, huong: 0, doChinhXac: 5 });
  assert.equal(lai.lech, false);
  assert.equal(dd.lanLech, 0);
});

test('GPS chập chờn lệch vài mét vẫn bám đúng tuyến', () => {
  const t = tuyen();
  const dd = new DanDuong(t);
  for (let s = 0; s < 550; s += 25) {
    const p = diemTaiS(t.toaDo, t.tichLuy, s);
    const tt = dd.capNhat({ viTri: diemDich(p.diem, 90, (s % 50 ? 12 : -12)), tocDo: 10, huong: 0, doChinhXac: 15 });
    assert.equal(tt.lech, false);
    assert.ok(Math.abs(tt.s - s) < 3);
  }
});
