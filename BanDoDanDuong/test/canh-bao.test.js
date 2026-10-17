import test from 'node:test';
import assert from 'node:assert/strict';
import { docTocDo, gioiHanTuTag, uocTinhGioiHan, ThongTinDuong, cauTruyVanDiem, docDiemOverpass } from '../public/js/duong-xa.js';
import { CanhBao, timKhucCua, bienReChoXe } from '../public/js/canh-bao.js';
import { caiDat } from '../public/js/kho.js';
import { chuanHoaOsrm } from '../public/js/chi-duong.js';
import { DanDuong } from '../public/js/dan-duong.js';
import { diemTaiS, phuongVi } from '../public/js/hinh-hoc.js';
import { tuyenOsrm, overpassDuong, overpassDiem, overpassDiemDayDu, DIEM } from './du-lieu-mau.js';

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
    assert.ok(noi.some(s => /camera phạt tốc độ, tốc độ tối đa 30/.test(s)));
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

// ------------------------------------------------------------------ các loại cảnh báo mở rộng
const VI_DO = 21.03, M_LAT = 110574, M_LNG = 111320 * Math.cos(VI_DO * Math.PI / 180);
/** Đổi toạ độ phẳng (mét, x = Đông, y = Bắc) quanh Hà Nội sang [lng, lat]. */
const ll = (x, y) => [105.85 + x / M_LNG, VI_DO + y / M_LAT];

test('truy vấn Overpass chỉ gồm các loại đang bật', () => {
  const p = [105.85, 21.03];
  const q = cauTruyVanDiem(p, new Set(['camera', 'ham', 'truonghoc', 'camre']));
  assert.match(q, /highway=speed_camera/);
  assert.match(q, /type=enforcement/);
  assert.match(q, /out tags geom/);          // hầm: lấy hình dạng để biết hai cửa hầm
  assert.match(q, /out body center/);        // trường học: điểm giữa khuôn viên
  assert.match(q, /type=restriction/);
  assert.doesNotMatch(q, /traffic_signals|level_crossing|toll_booth/);
  assert.equal(cauTruyVanDiem(p, new Set()), null);
  assert.match(cauTruyVanDiem(p, new Set(['dentinhieu'])), /highway=traffic_signals/);
});

test('đọc điểm cảnh báo từ Overpass: loại camera, hầm, trường học, biển cấm rẽ', () => {
  const ds = docDiemOverpass(overpassDiemDayDu().elements);
  const loai = id => ds.get(id) && ds.get(id).loai;
  assert.equal(loai('osm9101'), 'cameraden');          // camera nằm trong quan hệ enforcement=traffic_signals
  assert.equal(loai('osm9102'), 'cameratb');
  assert.equal(loai('osm9103'), 'gogiam');
  assert.equal(loai('osm9104'), 'dentinhieu');
  assert.equal(loai('osm9105'), 'nguyhiem');
  assert.equal(ds.get('osm9105').nguyHiem, 'dangerous_junction');
  assert.equal(loai('osmw9201'), 'truonghoc');
  assert.deepEqual(ds.get('osmw9201').viTri, [105.8512, 21.0312]);
  assert.equal(loai('ham9301'), 'ham');
  assert.equal(loai('ham9301b'), 'ham');
  assert.equal(ds.get('ham9301').cung, 'ham9301');
  const re = ds.get('re9401');
  assert.equal(re.loai, 'camre');
  assert.deepEqual(re.tuDuong, [2]);
  assert.deepEqual(re.viTri, DIEM.C);
  assert.equal(re.the.restriction, 'no_left_turn');
  assert.ok(!ds.has('re9402'), 'biển có via là đường thì bỏ qua');
  // biển cấm có ngoại lệ cho xe máy
  assert.equal(bienReChoXe({ restriction: 'no_u_turn', except: 'motorcycle;bicycle' }, 'xemay'), null);
  assert.equal(bienReChoXe({ restriction: 'no_u_turn', except: 'motorcycle;bicycle' }, 'oto'), 'no_u_turn');
  assert.equal(bienReChoXe({ 'restriction:motorcar': 'only_right_turn' }, 'oto'), 'only_right_turn');
  assert.equal(bienReChoXe({ 'restriction:motorcar': 'only_right_turn' }, 'xemay'), null);
});

/** Đường đi theo từng đoạn [dài (m), đổi hướng (độ) đều trên đoạn], bắt đầu đi lên phía Bắc, điểm cách nhau 5 m. */
function duongTheoHuong(doan, huong = 0) {
  let x = 0, y = 0;
  const g = [ll(0, 0)];
  for (const [dai, doi] of doan) {
    const n = Math.round(dai / 5);
    for (let i = 0; i < n; i++) {
      huong += doi / n;
      x += 5 * Math.sin(huong * Math.PI / 180);
      y += 5 * Math.cos(huong * Math.PI / 180);
      g.push(ll(x, y));
    }
  }
  return g;
}

test('tìm khúc cua theo hình dạng đường', () => {
  // thẳng 200 m, cua phải 90° (bán kính 40 m), thẳng 200 m
  const cua = timKhucCua(duongTheoHuong([[200, 0], [63, 90], [200, 0]]));
  assert.equal(cua.length, 1);
  assert.ok(cua[0].goc > 80 && cua[0].goc < 100, String(cua[0].goc));
  assert.ok(Math.abs(cua[0].s - 200) < 25, String(cua[0].s));
  // đường thẳng có sai số GPS ±2 m: không phải khúc cua
  const thang = [];
  for (let y = 0; y <= 500; y += 10) thang.push(ll((y / 10) % 2 ? 2 : -2, y));
  assert.equal(timKhucCua(thang).length, 0);
  // đường cong thoai thoải (bán kính ~300 m) không tính
  assert.equal(timKhucCua(duongTheoHuong([[100, 0], [400, 75], [100, 0]])).length, 0);
  // khúc cua chữ S: phải rồi trái
  const cs = timKhucCua(duongTheoHuong([[100, 0], [60, 70], [60, 0], [60, -70], [100, 0]]));
  assert.equal(cs.length, 2, JSON.stringify(cs));
  assert.ok(cs[0].goc > 50 && cs[1].goc < -50, JSON.stringify(cs));
});

function canhBaoDayDu(muc = {}) {
  const fetchCu = globalThis.fetch;
  globalThis.fetch = async (url, o) => {
    const q = decodeURIComponent(String(o.body).slice(5));
    return { ok: true, json: async () => (q.includes('around:4000') ? overpassDiemDayDu() : overpassDuong()) };
  };
  const mucCu = caiDat.mucCanhBao;
  caiDat.mucCanhBao = muc;
  return { tra: () => { globalThis.fetch = fetchCu; caiDat.mucCanhBao = mucCu; } };
}

test('biển cấm rẽ chỉ báo khi đang đi trên đường bị cấm; mức "chỉ hiển thị" không đọc', async () => {
  const h = canhBaoDayDu({ camre: 2, dentinhieu: 1 });
  try {
    const ttd = new ThongTinDuong();
    const noi = [];
    const cb = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: s => noi.push(s), bip: () => {} });
    assert.ok(cb.loaiCanTai().has('dentinhieu') && !cb.loaiCanTai().has('vachqua'));
    await ttd.taiDuong(DIEM.B);
    await ttd.taiDiem(DIEM.B);
    // trên Tràng Tiền đi về phía Đông, cách giao lộ Lý Thái Tổ ~135 m: biển cấm rẽ trái
    const kq = cb.capNhat({ viTri: [105.8535, 21.0304], huong: 90, tocDo: 8 }, null, 'oto');
    assert.equal(kq.canhBao.loai, 'camre');
    assert.equal(kq.canhBao.icon, 'camretrai');
    assert.ok(noi.some(x => /giao lộ cấm rẽ trái/.test(x)), noi.join('|'));
    // đèn tín hiệu (mức 1) có trong danh sách nhưng không được đọc
    const den = cb.danhSachDiem().find(d => d.loai === 'dentinhieu');
    assert.equal(den.muc, 1);
    assert.ok(!noi.some(x => /đèn tín hiệu/.test(x)));
    // đi trên Hàng Bài về phía Bắc (không phải đường bị cấm) thì không báo
    const cb2 = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: () => {}, bip: () => {} });
    const kq2 = cb2.capNhat({ viTri: [105.85, 21.0292], huong: 0, tocDo: 8 }, null, 'oto');
    assert.ok(!kq2.canhBao || kq2.canhBao.loai !== 'camre');
    // tắt hẳn (mức 0): không tải, không vẽ trên bản đồ
    caiDat.mucCanhBao = { camre: 0 };
    assert.ok(!cb.loaiCanTai().has('camre'));
    assert.ok(!cb.diemBanDo().some(d => d.icon === 'camretrai'));
  } finally { h.tra(); }
});

test('báo khúc cua khi dẫn đường (trừ chỗ rẽ có hướng dẫn) và giới hạn tốc độ phía trước', async () => {
  const h = canhBaoDayDu({});
  try {
    const ttd = new ThongTinDuong();
    await ttd.taiDuong(DIEM.B);
    const noi = [];
    const cb = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: s => noi.push(s), bip: () => {} });
    const t = chuanHoaOsrm(tuyenOsrm().routes[0]);
    // chỗ rẽ phải Hàng Bài → Tràng Tiền là bước dẫn đường, không tính là khúc cua
    assert.equal(cb.khucCuaPhiaTruoc({}, { tuyen: t, tt: { s: 400 } }, null).length, 0);
    // trên Hàng Bài (ước tính 50 km/h), 150 m trước chỗ rẽ vào Tràng Tiền (biển 30 km/h)
    const may = new DanDuong(t);
    const p = diemTaiS(t.toaDo, t.tichLuy, 450);
    const tt = may.capNhat({ viTri: p.diem, tocDo: 12, huong: p.huong, doChinhXac: 5 });
    const kq = cb.capNhat({ viTri: p.diem, huong: p.huong, tocDo: 12 }, { tuyen: t, tt }, 'oto');
    assert.equal(kq.gioiHan, 50);
    assert.equal(kq.canhBao.loai, 'gioihan');
    assert.equal(kq.canhBao.gioiHan, 30);
    assert.ok(kq.canhBao.kc > 140 && kq.canhBao.kc < 300, String(kq.canhBao.kc));
    assert.ok(noi.some(x => /tốc độ tối đa 30/.test(x)), noi.join('|'));
    // tuyến có khúc cua giữa đường (không phải chỗ rẽ): báo trước khi tới gần
    const g = duongTheoHuong([[400, 0], [63, 90], [400, 0]]);
    const tuyen = { toaDo: g, tichLuy: tichLuyTest(g), buoc: [{ loai: 'depart', batDau: 0 }, { loai: 'arrive', batDau: 900 }] };
    const cua = cb.khucCuaPhiaTruoc({}, { tuyen, tt: { s: 200 } }, null);
    assert.equal(cua.length, 1);
    assert.equal(cua[0].cuaPhai, true);
    assert.equal(cua[0].icon, 'cuaphai');
    assert.ok(Math.abs(cua[0].kc - 200) < 25, String(cua[0].kc));
    assert.equal(cb.khucCuaPhiaTruoc({}, { tuyen, tt: { s: 50 } }, null).length, 0);   // còn xa hơn 300 m
    assert.match(cb.cauCanhBao(cua[0]), /khúc cua gấp bên phải/);
  } finally { h.tra(); }
});

test('đọc giới hạn mới khi đổi đường; vào / ra khu đông dân cư', async () => {
  const h = canhBaoDayDu({});
  try {
    const ttd = new ThongTinDuong();
    await ttd.taiDuong(DIEM.B);
    const noi = [];
    const cb = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: s => noi.push(s), bip: () => {} });
    const lt = { viTri: [105.8548, 21.032], huong: 0, tocDo: 9 };      // Lý Thái Tổ, 50 km/h
    const tt = { viTri: [105.852, 21.0304], huong: 90, tocDo: 7 };     // Tràng Tiền, 30 km/h
    cb.capNhat(lt, null, 'oto');
    cb.capNhat(lt, null, 'oto');                                        // lần đầu chỉ ghi nhận
    assert.ok(!noi.some(x => /Tốc độ tối đa/.test(x)));
    cb.capNhat(tt, null, 'oto');
    assert.ok(!noi.some(x => /Tốc độ tối đa 30/.test(x)), 'chờ xác nhận lần thứ hai');
    cb.capNhat(tt, null, 'oto');
    assert.ok(noi.some(x => /^Tốc độ tối đa 30/.test(x)), noi.join('|'));
    // khu dân cư: cần hai lần tải dữ liệu đường liên tiếp cùng kết quả
    assert.equal(cb.capNhat(tt, null, 'oto').khuDanCu, true);
    ttd.dongDanCu = false; ttd.phienDuong++;
    cb.capNhat(tt, null, 'oto');
    assert.ok(!noi.some(x => /Ra khỏi khu vực đông dân cư/.test(x)));
    ttd.phienDuong++;
    const kq = cb.capNhat(tt, null, 'oto');
    assert.equal(kq.khuDanCu, false);
    assert.ok(noi.some(x => /Ra khỏi khu vực đông dân cư/.test(x)), noi.join('|'));
  } finally { h.tra(); }
});

function tichLuyTest(g) {
  const c = [0];
  for (let i = 1; i < g.length; i++) {
    const dx = (g[i][0] - g[i - 1][0]) * M_LNG, dy = (g[i][1] - g[i - 1][1]) * M_LAT;
    c.push(c[i - 1] + Math.hypot(dx, dy));
  }
  return c;
}
