import test from 'node:test';
import assert from 'node:assert/strict';
import { docTocDo, gioiHanTuTag, uocTinhGioiHan, ThongTinDuong, cauTruyVanO, docDiemOverpass, maO, khungO, oQuanh } from '../public/js/duong-xa.js';
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

test('ô lưới dữ liệu giao thông và câu truy vấn từng lớp', () => {
  assert.equal(maO(105.8522, 21.0287), '2858_1110');
  assert.deepEqual(khungO('2858_1110'), [105.8, 21, 105.9, 21.1]);
  assert.deepEqual(oQuanh([105.85, 21.05], 4000), ['2858_1110']);                  // giữa ô: một ô
  assert.deepEqual(oQuanh([105.85, 21.03], 4000), ['2858_1109', '2858_1110']);    // gần mép dưới: thêm ô bên dưới
  const q = cauTruyVanO([105.8, 21, 105.9, 21.1], 'chinh');
  assert.match(q, /\(21,105\.8,21\.1,105\.9\)/);                                   // (nam,tây,bắc,đông)
  assert.match(q, /highway=speed_camera/);
  assert.match(q, /traffic_sign~"\^VN:"/);
  assert.match(q, /type=enforcement/);
  assert.match(q, /type=restriction/);
  assert.match(q, /out tags geom/);
  assert.doesNotMatch(q, /traffic_signals|highway=crossing/);
  const nho = cauTruyVanO([105.8, 21, 105.9, 21.1], 'nho');
  assert.match(nho, /highway=traffic_signals/);
  assert.match(nho, /highway=crossing/);
  assert.doesNotMatch(nho, /speed_camera|restriction/);
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
    return { ok: true, json: async () => (q.includes('around:500') ? overpassDuong() : overpassDiemDayDu()) };
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

// ------------------------------------------------------------------ đường cấm, ngược chiều, cấm vượt, cấm dừng / đỗ
function duongLuat() {
  const ttd = new ThongTinDuong({ nguon: { layNhieu: async () => ({ ds: [], loi: [] }) } });
  const way = (id, ten, tags, a, b) => ({ id, tags: { highway: 'tertiary', name: ten, ...tags }, toaDo: [a, b] });
  ttd.duong = [
    way(501, 'Lê Thái Tổ', { oneway: 'yes', overtaking: 'no', 'parking:both': 'no', 'parking:both:restriction': 'no_stopping' }, [105.860, 21.040], [105.866, 21.040]),
    way(502, 'Hàng Khay', { motorcar: 'no' }, [105.866, 21.040], [105.872, 21.040]),
    way(503, 'Bà Triệu', {}, [105.872, 21.040], [105.878, 21.040])
  ];
  const noi = [];
  const cb = new CanhBao({ thongTinDuong: ttd, layBaoCao: () => [], noi: s => noi.push(s), bip: () => {} });
  return { ttd, cb, noi };
}

test('đi ngược chiều đường một chiều và vào đường cấm: báo sau 3 lần liên tiếp', () => {
  const { cb, noi } = duongLuat();
  const tay = { viTri: [105.863, 21.04], huong: 270, tocDo: 10 };       // đi về phía Tây trên đường một chiều hướng Đông
  assert.equal(cb.capNhat(tay, null, 'oto').luat.nguocChieu, false);
  cb.capNhat(tay, null, 'oto');
  const kq = cb.capNhat(tay, null, 'oto');
  assert.equal(kq.luat.nguocChieu, true);
  assert.equal(kq.canhBao.loai, 'duongcam');
  assert.equal(kq.canhBao.hienTai, true);
  assert.ok(noi.some(s => /ngược chiều đường một chiều/.test(s)), noi.join('|'));
  // đi đúng chiều: không báo
  const { cb: cb2 } = duongLuat();
  for (let i = 0; i < 3; i++) assert.equal(cb2.capNhat({ viTri: [105.863, 21.04], huong: 90, tocDo: 10 }, null, 'oto').luat.nguocChieu, false);
  // đường cấm ô tô: ô tô bị báo, xe máy thì không
  const { cb: cb3, noi: noi3 } = duongLuat();
  let r;
  for (let i = 0; i < 3; i++) r = cb3.capNhat({ viTri: [105.869, 21.04], huong: 90, tocDo: 10 }, null, 'oto');
  assert.match(r.luat.duongCam.ten, /cấm ô tô/);
  assert.ok(noi3.some(s => /đường cấm ô tô/.test(s)));
  const { cb: cb4 } = duongLuat();
  for (let i = 0; i < 3; i++) r = cb4.capNhat({ viTri: [105.869, 21.04], huong: 90, tocDo: 10 }, null, 'xemay');
  assert.equal(r.luat.duongCam, null);
});

test('đoạn cấm vượt: báo bắt đầu / hết khi đổi đường; nhắc cấm dừng đỗ khi xe chậm lại', () => {
  const { cb, noi } = duongLuat();
  const tren501 = { viTri: [105.863, 21.04], huong: 90, tocDo: 10 };
  cb.capNhat(tren501, null, 'xemay');
  const kq = cb.capNhat(tren501, null, 'xemay');
  assert.equal(kq.luat.camVuot, true);                        // trạng thái đầu tiên: chỉ hiển thị, không đọc
  assert.ok(!noi.some(s => /cấm vượt/.test(s)));
  assert.equal(kq.luat.camDungDo, 'camdung');
  const tren503 = { viTri: [105.875, 21.04], huong: 90, tocDo: 10 };
  cb.capNhat(tren503, null, 'xemay');
  assert.equal(cb.capNhat(tren503, null, 'xemay').luat.camVuot, false);
  assert.ok(noi.some(s => /^Hết đoạn cấm vượt/.test(s)), noi.join('|'));
  cb.capNhat(tren501, null, 'xemay');
  cb.capNhat(tren501, null, 'xemay');
  assert.ok(noi.some(s => /^Bắt đầu đoạn cấm vượt/.test(s)), noi.join('|'));
  // xe chậm lại để dừng trên đoạn cấm dừng, đỗ
  cb.capNhat({ ...tren501, tocDo: 1 }, null, 'xemay');
  assert.ok(noi.some(s => /cấm dừng và đỗ xe/.test(s)), noi.join('|'));
  const dem = noi.length;
  cb.capNhat({ ...tren501, tocDo: 8 }, null, 'xemay');
  cb.capNhat({ ...tren501, tocDo: 1 }, null, 'xemay');
  assert.equal(noi.filter(s => /cấm dừng/.test(s)).length, 1, 'không nhắc lại trong 10 phút');
  assert.ok(noi.length >= dem);
});

test('trên tuyến dẫn đường: báo trước đường cấm phía trước', () => {
  const { cb } = duongLuat();
  const toaDo = [[105.860, 21.040], [105.866, 21.040], [105.872, 21.040]];
  const tuyen = { toaDo, tichLuy: tichLuyTest(toaDo), buoc: [] };
  const ds = cb.phiaTruocTrenTuyen({ tuyen, tt: { s: 420 } }, 'oto', 50, {});
  const dc = ds.find(d => d.loai === 'duongcam');
  assert.ok(dc && dc.id === 'dc502' && dc.kc > 150 && dc.kc < 300, JSON.stringify(ds));
  assert.match(cb.cauCanhBao(dc), /đường cấm ô tô/);
  assert.equal(cb.phiaTruocTrenTuyen({ tuyen, tt: { s: 420 } }, 'xemay', 50, {}).filter(d => d.loai === 'duongcam').length, 0);
});

test('giới hạn tốc độ kế tiếp trên tuyến: hiện từ 800 m, chỉ báo / đọc khi còn 300 m', () => {
  const { ttd, cb } = duongLuat();
  ttd.duong[2].tags.maxspeed = '40';
  const toaDo = [[105.860, 21.040], [105.866, 21.040], [105.872, 21.040], [105.878, 21.040]];
  const tuyen = { toaDo, tichLuy: tichLuyTest(toaDo), buoc: [] };
  const batDau503 = tuyen.tichLuy[2];
  cb.ghTiep = null;
  let ds = cb.phiaTruocTrenTuyen({ tuyen, tt: { s: batDau503 - 560 } }, 'xemay', 50, {});
  assert.equal(ds.filter(d => d.loai === 'gioihan').length, 0, 'còn xa: chưa báo');
  assert.equal(cb.ghTiep && cb.ghTiep.gioiHan, 40);
  assert.ok(cb.ghTiep.kc > 520 && cb.ghTiep.kc <= 620, JSON.stringify(cb.ghTiep));
  cb.ghTiep = null;
  ds = cb.phiaTruocTrenTuyen({ tuyen, tt: { s: batDau503 - 220 } }, 'xemay', 50, {});
  const gh = ds.find(d => d.loai === 'gioihan');
  assert.ok(gh && gh.gioiHan === 40 && gh.ten === 'Giảm giới hạn tốc độ', JSON.stringify(ds));
  assert.ok(cb.ghTiep.kc > 180 && cb.ghTiep.kc <= 300);
  // cùng giới hạn với đường đang đi: không có giới hạn kế tiếp
  cb.ghTiep = null;
  cb.phiaTruocTrenTuyen({ tuyen, tt: { s: batDau503 - 220 } }, 'xemay', 40, {});
  assert.equal(cb.ghTiep, null);
});

test('biển báo Việt Nam trên bản đồ: theo loại xe, ngày chẵn / lẻ; biển cấm ngược chiều ở đầu kia đường một chiều', () => {
  const { ttd, cb } = duongLuat();
  ttd.diem = docDiemOverpass([
    { type: 'node', id: 1, lat: 21.0401, lon: 105.8655, tags: { traffic_sign: 'VN:P.102' } },
    { type: 'node', id: 2, lat: 21.0401, lon: 105.8640, tags: { traffic_sign: 'VN:P.103a' } },
    { type: 'node', id: 3, lat: 21.0401, lon: 105.8645, tags: { traffic_sign: 'VN:P.131b' } },
    { type: 'node', id: 4, lat: 21.0401, lon: 105.8646, tags: { traffic_sign: 'VN:P.131c' } },
    { type: 'node', id: 5, lat: 21.0401, lon: 105.8700, tags: { traffic_sign: 'VN:P.125;VN:P.130' } }
  ]);
  assert.equal(ttd.diem.size, 6);
  const oto = cb.danhSachDiem('oto').map(d => d.bien);
  assert.ok(oto.includes('P103A') && oto.includes('P125') && oto.includes('P130'));
  assert.equal(oto.filter(b => b === 'P131B' || b === 'P131C').length, 1, 'chỉ biển cấm đỗ của ngày hôm nay');
  assert.ok(!cb.danhSachDiem('xemay').some(d => d.bien === 'P103A'));
  // đi đúng chiều trên đường một chiều tới biển P.102 ở cuối đường: không báo
  for (let i = 0; i < 2; i++) {
    const kq = cb.capNhat({ viTri: [105.8648, 21.04], huong: 90, tocDo: 6 }, null, 'xemay');
    assert.ok(!kq.canhBao || kq.canhBao.bien !== 'P102', JSON.stringify(kq.canhBao));
  }
});

test('camera phạt nguội: đọc kèm giới hạn của đường, nhắc giảm tốc khi đang vượt tốc độ; trạm thu phí đọc kèm mức phí', async () => {
  const fetchCu = globalThis.fetch;
  globalThis.fetch = moPhongOverpass();
  try {
    const ttd = new ThongTinDuong();
    await ttd.taiDuong(DIEM.B);
    ttd.diem = docDiemOverpass([
      { type: 'node', id: 8001, lat: 21.0304, lon: 105.8530, tags: { man_made: 'surveillance', surveillance: 'traffic' } },
      { type: 'node', id: 8002, lat: 21.0330, lon: 105.8548, tags: { barrier: 'toll_booth', name: 'Trạm Lý Thái Tổ', charge: '35000 VND' } }
    ]);
    const noi = [];
    const cb = new CanhBao({
      thongTinDuong: ttd, layBaoCao: () => [], noi: s => noi.push(s), bip: () => {},
      layPhi: d => (d.phiOsm ? { phi: d.phiOsm, loaiXe: 1 } : null)
    });
    // Tràng Tiền (30 km/h), đi 45 km/h về phía Đông, camera phạt nguội cách ~180 m
    const kq = cb.capNhat({ viTri: [105.8513, 21.0304], huong: 90, tocDo: 12.5 }, null, 'oto');
    assert.equal(kq.canhBao.loai, 'cameragiamsat');
    assert.ok(noi.some(s => /camera phạt nguội, tốc độ tối đa 30/.test(s)), noi.join('|'));
    assert.ok(noi.some(s => /^Giảm tốc độ ngay, phía trước có camera phạt nguội/.test(s)), noi.join('|'));
    const truoc = noi.length;
    cb.capNhat({ viTri: [105.8516, 21.0304], huong: 90, tocDo: 12.5 }, null, 'oto');
    assert.equal(noi.filter(s => /Giảm tốc độ ngay/.test(s)).length, 1, 'mỗi camera chỉ nhắc một lần');
    assert.ok(noi.length >= truoc);
    // trên Lý Thái Tổ đi lên phía Bắc, tới trạm thu phí
    const tram = cb.capNhat({ viTri: [105.8548, 21.0318], huong: 0, tocDo: 10 }, null, 'oto');
    assert.equal(tram.canhBao.loai, 'thuphi');
    assert.equal(tram.canhBao.phu, 'Phí xe loại 1: 35.000 đ');
    assert.ok(noi.some(s => /trạm thu phí Trạm Lý Thái Tổ, phí khoảng 35\.000 đồng/.test(s)), noi.join('|'));
  } finally {
    globalThis.fetch = fetchCu;
  }
});
