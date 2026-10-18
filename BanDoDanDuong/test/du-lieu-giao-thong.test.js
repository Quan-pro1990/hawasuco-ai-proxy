import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { NguonDuLieuGiaoThong, khoBoNho, CHU_KY_CAP_NHAT } from '../public/js/du-lieu-giao-thong.js';
import { taoKhoGiaoThong } from '../kho-giao-thong.js';
import { taoMayChu } from '../server.js';
import { overpassDiemDayDu } from './du-lieu-mau.js';

const NGAY = 86400000;
const doiFetch = f => { const cu = globalThis.fetch; globalThis.fetch = f; return () => { globalThis.fetch = cu; }; };

test('trình duyệt: ô dữ liệu lưu trong máy, ô quá 7 ngày tải lại ở nền, ô bỏ không quá 30 ngày thì xoá', async () => {
  let goi = 0;
  const tra = doiFetch(async () => { goi++; return { ok: true, json: async () => overpassDiemDayDu() }; });
  try {
    const kho = khoBoNho();
    const n = new NguonDuLieuGiaoThong({ kho });
    const { ds } = await n.layNhieu(['2858_1110'], ['chinh']);
    assert.equal(goi, 1);
    assert.ok(ds[0].diem.some(d => d.loai === 'camre'));
    await n.layNhieu(['2858_1110'], ['chinh']);
    assert.equal(goi, 1, 'lần sau dùng bản trong bộ nhớ');
    const n2 = new NguonDuLieuGiaoThong({ kho });                 // mở lại ứng dụng: đọc từ máy, không cần mạng
    assert.equal((await n2.layNhieu(['2858_1110'], ['chinh'])).ds[0].diem.length, ds[0].diem.length);
    assert.equal(goi, 1);
    // ô đã cũ: trả ngay bản cũ, tải lại ở nền
    const cu = await kho.lay('2858_1110:chinh');
    await kho.luu({ ...cu, capNhat: Date.now() - CHU_KY_CAP_NHAT - 1000 });
    const n3 = new NguonDuLieuGiaoThong({ kho });
    let coMoi = 0;
    n3.khiCoMoi = () => coMoi++;
    await n3.layNhieu(['2858_1110'], ['chinh']);
    await new Promise(ok => setTimeout(ok, 20));
    assert.equal(goi, 2);
    assert.equal(coMoi, 1);
    assert.ok(Date.now() - (await kho.lay('2858_1110:chinh')).capNhat < 5000);
    // cập nhật định kỳ: ô cũ được tải lại, ô bỏ không lâu bị xoá
    await kho.luu({ khoa: '2858_1111:chinh', ma: '2858_1111', lop: 'chinh', capNhat: Date.now() - 10 * NGAY, dungLuc: Date.now() - 2 * NGAY, diem: [] });
    await kho.luu({ khoa: '2850_1100:chinh', ma: '2850_1100', lop: 'chinh', capNhat: Date.now() - 40 * NGAY, dungLuc: Date.now() - 31 * NGAY, diem: [] });
    const kq = await n3.capNhatDinhKy();
    assert.deepEqual([kq.soLamMoi, kq.soXoa, kq.soLoi], [1, 1, 0]);
    assert.equal(await kho.lay('2850_1100:chinh'), undefined);
    const tt = await n3.trangThai();
    assert.equal(tt.soO, 2);
    assert.ok(tt.soDiem > 0 && tt.moiNhat >= tt.cuNhat);
  } finally { tra(); }
});

test('trình duyệt: có máy chủ thì lấy ô từ máy chủ, máy chủ lỗi thì gọi thẳng Overpass', async () => {
  const goi = [];
  const tra = doiFetch(async (url) => {
    goi.push(String(url));
    if (String(url).includes('/giao-thong?')) {
      if (String(url).includes('lop=nho')) return { ok: false, status: 502, json: async () => ({ loi: 'lỗi' }) };
      return { ok: true, json: async () => ({ o: { '2858_1110': { capNhat: 123, diem: [{ id: 'osm1', loai: 'camera', viTri: [105.85, 21.03] }] } } }) };
    }
    return { ok: true, json: async () => ({ elements: [] }) };
  });
  try {
    const n = new NguonDuLieuGiaoThong({ kho: khoBoNho(), layMayChu: () => 'http://may-chu/api' });
    const { ds, loi } = await n.layNhieu(['2858_1110'], ['chinh', 'nho']);
    assert.equal(loi.length, 0);
    assert.equal(ds.find(o => o.lop === 'chinh').capNhat, 123);
    assert.equal(goi[0], 'http://may-chu/api/giao-thong?lop=chinh&o=2858_1110');
    assert.ok(goi.some(u => /interpreter/.test(u)), 'lớp máy chủ không trả được thì gọi Overpass');
  } finally { tra(); }
});

test('máy chủ: kho ô dùng chung, lưu tệp, tự cập nhật sau 7 ngày, API /api/giao-thong', async () => {
  const thuMuc = await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-gt-'));
  let goi = 0;
  const layMang = async () => { goi++; return { ok: true, json: async () => overpassDiemDayDu() }; };
  const kho = taoKhoGiaoThong({ thuMuc: path.join(thuMuc, 'giao-thong'), layMang });
  const [a, b] = await Promise.all([kho.lay('2858_1110'), kho.lay('2858_1110')]);
  assert.equal(goi, 1, 'hai người hỏi cùng lúc chỉ gọi Overpass một lần');
  assert.equal(a.diem.length, b.diem.length);
  await kho.lay('2858_1110');
  assert.equal(goi, 1, 'đọc lại từ tệp');
  await assert.rejects(kho.lay('../etc'), /không hợp lệ/);
  // tệp quá 7 ngày: trả bản cũ ngay, tải lại ở nền
  const tep = path.join(thuMuc, 'giao-thong', '2858_1110.json');
  const o = JSON.parse(await fs.readFile(tep, 'utf8'));
  await fs.writeFile(tep, JSON.stringify({ ...o, capNhat: Date.now() - 8 * NGAY }));
  const cu = await kho.lay('2858_1110');
  assert.ok(Date.now() - cu.capNhat > 7 * NGAY);
  await new Promise(ok => setTimeout(ok, 50));
  assert.equal(goi, 2);
  // kiểm tra định kỳ: ô không ai dùng 30 ngày bị xoá
  await fs.writeFile(path.join(thuMuc, 'giao-thong', '2850_1100.json'), JSON.stringify({ ma: '2850_1100', lop: 'chinh', capNhat: 0, dungLuc: Date.now() - 31 * NGAY, diem: [] }));
  assert.deepEqual(await kho.capNhatDinhKy(), { soLamMoi: 0, soXoa: 1 });
  assert.equal((await kho.trangThai()).soO, 1);

  const mc = taoMayChu({ thuMucDuLieu: thuMuc, ghiLog: false, layMang, henGio: false });
  await new Promise(ok => mc.listen(0, '127.0.0.1', ok));
  const goc = `http://127.0.0.1:${mc.address().port}`;
  try {
    const r = await (await fetch(goc + '/api/giao-thong?o=2858_1110,2858_1109')).json();
    assert.ok(r.o['2858_1110'].diem.length > 0 && r.o['2858_1109'].diem.length > 0);
    assert.equal((await fetch(goc + '/api/giao-thong?o=1_2,../x')).status, 400);
    assert.equal((await fetch(goc + '/api/giao-thong?o=' + Array(10).fill('1_2').join(','))).status, 400);
    const tt = await (await fetch(goc + '/api/giao-thong/trang-thai')).json();
    assert.equal(tt.chuKyNgay, 7);
    const phi = await (await fetch(goc + '/api/phi-cao-toc')).json();
    assert.ok(Array.isArray(phi.tram));
    // bảng phí người vận hành đặt trong thư mục dữ liệu được ưu tiên
    await fs.writeFile(path.join(thuMuc, 'phi-cao-toc.json'), JSON.stringify({ capNhat: '2026-10-01', tram: [{ ten: 'Trạm A', viTri: [105.9, 21.0], phi: [1, 2, 3, 4, 5] }] }));
    assert.equal((await (await fetch(goc + '/api/phi-cao-toc')).json()).tram[0].ten, 'Trạm A');
  } finally {
    await new Promise(ok => mc.close(ok));
  }
});

test('giãn cách lần thử khi Overpass lỗi hoặc máy chủ vẫn trả bản cũ', async () => {
  const thuMuc = await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-gt-'));
  let goi = 0;
  const kho = taoKhoGiaoThong({ thuMuc, layMang: async () => { goi++; return { ok: false, status: 429 }; } });
  await assert.rejects(kho.lay('2858_1110'), /429/);
  const truoc = goi;
  await assert.rejects(kho.lay('2858_1110'), /429/);
  assert.equal(goi, truoc, 'không gọi lại Overpass ngay sau khi lỗi');
  // trình duyệt: ô cũ chỉ thử làm mới một lần mỗi giờ
  let lan = 0;
  const tra = doiFetch(async () => { lan++; return { ok: true, json: async () => ({ elements: [] }) }; });
  try {
    const k = khoBoNho();
    await k.luu({ khoa: '1_1:chinh', ma: '1_1', lop: 'chinh', capNhat: Date.now() - 8 * NGAY, dungLuc: Date.now(), diem: [] });
    const n = new NguonDuLieuGiaoThong({ kho: k });
    await n.layNhieu(['1_1'], ['chinh']);
    await new Promise(ok => setTimeout(ok, 20));
    await n.layNhieu(['1_1'], ['chinh'], Date.now());
    await new Promise(ok => setTimeout(ok, 20));
    assert.equal(lan, 1);
  } finally { tra(); }
});
