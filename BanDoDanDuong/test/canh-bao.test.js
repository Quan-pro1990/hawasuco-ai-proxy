import test from 'node:test';
import assert from 'node:assert/strict';
import { docTocDo, gioiHanTuTag, uocTinhGioiHan, ThongTinDuong } from '../public/js/duong-xa.js';
import { CanhBao } from '../public/js/canh-bao.js';
import { chuanHoaOsrm } from '../public/js/chi-duong.js';
import { DanDuong } from '../public/js/dan-duong.js';
import { diemTaiS, phuongVi } from '../public/js/hinh-hoc.js';
import { tuyenOsrm, overpassDuong, overpassDiem, DIEM } from './du-lieu-mau.js';

test('đọc giới hạn tốc độ OSM', () => {
  assert.equal(docTocDo('50'), 50);
  assert.equal(docTocDo('30 mph'), 48);
  assert.equal(docTocDo('VN:urban'), 50);
  assert.equal(docTocDo('VN:rural', 'xemay'), 60);
  assert.equal(docTocDo('none'), null);
  assert.equal(gioiHanTuTag({ maxspeed: '80' }, true, 'oto'), 80);
  assert.equal(gioiHanTuTag({ maxspeed: '80' }, true, 'xemay'), 70);          // xe máy tối đa 70 km/h
  assert.equal(gioiHanTuTag({ maxspeed: '60', 'maxspeed:motorcycle': '50' }, true, 'xemay'), 50);
  assert.equal(gioiHanTuTag({ 'maxspeed:forward': '60', 'maxspeed:backward': '40' }, false, 'oto'), 40);
});

test('ước tính giới hạn theo Thông tư 38/2024', () => {
  assert.equal(uocTinhGioiHan({ highway: 'primary' }, true, 'oto'), 50);
  assert.equal(uocTinhGioiHan({ highway: 'primary', oneway: 'yes', lanes: '3' }, true, 'oto'), 60);
  assert.equal(uocTinhGioiHan({ highway: 'trunk', oneway: 'yes' }, false, 'oto'), 90);
  assert.equal(uocTinhGioiHan({ highway: 'trunk' }, false, 'oto'), 80);
  assert.equal(uocTinhGioiHan({ highway: 'trunk' }, false, 'xemay'), 60);
  assert.equal(uocTinhGioiHan({ highway: 'motorway' }, false, 'xemay'), null);
  assert.equal(uocTinhGioiHan({ highway: 'service' }, true, 'oto'), null);
});

function moPhongOverpass() {
  return async (url, o) => {
    const q = decodeURIComponent(String(o.body).slice(5));
    return { ok: true, json: async () => (q.includes('speed_camera') ? overpassDiem() : overpassDuong()) };
  };
}

test('xác định đường đang đi và cảnh báo vượt tốc độ, camera phía trước', async () => {
  const fetchCu = globalThis.fetch;
  globalThis.fetch = moPhongOverpass();
  try {
    const ttd = new ThongTinDuong();
    await ttd.taiDuong(DIEM.B);
    await ttd.taiDiem(DIEM.B);
    assert.equal(ttd.dongDanCu, true);
    assert.equal(ttd.diem.size, 2);

    const noi = [], bip = [];
    const cb = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: (s) => noi.push(s), bip: (l) => bip.push(l) });
    // đang trên Tràng Tiền (giới hạn 30) đi về phía Đông 45 km/h, camera cách ~180 m phía trước
    const p = [105.8513, 21.0304];
    const kq = cb.capNhat({ viTri: p, huong: 90, tocDo: 12.5 }, null, 'oto');
    assert.equal(kq.duong.ten, 'Tràng Tiền');
    assert.equal(kq.gioiHan, 30);
    assert.equal(kq.uocTinh, false);
    assert.equal(kq.vuotToc, true);
    assert.equal(kq.canhBao.loai, 'camera');
    assert.ok(kq.canhBao.kc > 150 && kq.canhBao.kc < 220, String(kq.canhBao.kc));
    assert.ok(noi.some(s => /quá tốc độ/.test(s)));
    assert.ok(noi.some(s => /camera giám sát tốc độ, tốc độ tối đa 30/.test(s)));
    assert.ok(bip.includes('vuottoc') && bip.includes('canhbao'));
    // đi ngược hướng: camera ở sau lưng, không cảnh báo
    const nguoc = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: () => {}, bip: () => {} });
    assert.equal(nguoc.capNhat({ viTri: p, huong: 270, tocDo: 8 }, null, 'oto').canhBao, null);
    // đường chưa có biển: ước tính (Hàng Bài, khu đông dân cư → 50)
    const hb = cb.capNhat({ viTri: [105.85, 21.027], huong: 0, tocDo: 10 }, null, 'oto');
    assert.equal(hb.duong.ten, 'Hàng Bài');
    assert.equal(hb.gioiHan, 50);
    assert.equal(hb.uocTinh, true);
    // xe máy trên Lý Thái Tổ dùng maxspeed:motorcycle
    const ltt = cb.capNhat({ viTri: [105.8548, 21.0315], huong: 0, tocDo: 10 }, null, 'xemay');
    assert.equal(ltt.gioiHan, 40);
  } finally {
    globalThis.fetch = fetchCu;
  }
});

test('khi dẫn đường: cảnh báo điểm nằm trên tuyến phía trước, kể cả sau chỗ rẽ', async () => {
  const fetchCu = globalThis.fetch;
  globalThis.fetch = moPhongOverpass();
  try {
    const ttd = new ThongTinDuong();
    await ttd.taiDiem(DIEM.B);
    const t = chuanHoaOsrm(tuyenOsrm().routes[0]);
    const may = new DanDuong(t);
    const cb = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [{ id: 'x1', loai: 'ketxe', lng: 105.8548, lat: 21.0335, taoLuc: Date.now() - 600000 }], noi: () => {}, bip: () => {} });
    const p = diemTaiS(t.toaDo, t.tichLuy, 450);
    const tt = may.capNhat({ viTri: p.diem, tocDo: 10, huong: p.huong, doChinhXac: 5 });
    const kq = cb.capNhat({ viTri: p.diem, huong: p.huong, tocDo: 10 }, { tuyen: t, tt }, 'oto');
    // camera trên Tràng Tiền: cách ~150 m (tới chỗ rẽ) + ~311 m, trong tầm báo trước 500 m
    assert.equal(kq.canhBao.loai, 'camera');
    assert.ok(Math.abs(kq.canhBao.kc - (t.buoc[1].batDau - 450 + 311)) < 15, String(kq.canhBao.kc));
    // xa hơn tầm báo trước thì chưa cảnh báo
    const xa = diemTaiS(t.toaDo, t.tichLuy, 300);
    const cb2 = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: () => {}, bip: () => {} });
    const may2 = new DanDuong(t);
    const ttXa = may2.capNhat({ viTri: xa.diem, tocDo: 10, huong: xa.huong, doChinhXac: 5 });
    assert.equal(cb2.capNhat({ viTri: xa.diem, huong: xa.huong, tocDo: 10 }, { tuyen: t, tt: ttXa }, 'oto').canhBao, null);
    // qua camera: điểm kế tiếp là đường sắt giao cắt / kẹt xe trên Lý Thái Tổ
    const q = diemTaiS(t.toaDo, t.tichLuy, 1150);
    const tt2 = may.capNhat({ viTri: q.diem, tocDo: 10, huong: phuongVi(DIEM.C, DIEM.D), doChinhXac: 5 });
    const kq2 = cb.capNhat({ viTri: q.diem, huong: 0, tocDo: 10 }, { tuyen: t, tt: tt2 }, 'oto');
    assert.equal(kq2.canhBao.loai, 'duongsat');
  } finally {
    globalThis.fetch = fetchCu;
  }
});
