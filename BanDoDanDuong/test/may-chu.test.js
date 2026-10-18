import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import zlib from 'node:zlib';
import { taoMayChu, ipKhach } from '../server.js';

async function khoiDong(tuyChon = {}) {
  const thuMuc = await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-'));
  const mc = taoMayChu({ thuMucDuLieu: thuMuc, ghiLog: false, henGio: false, ...tuyChon });
  await new Promise(ok => mc.listen(0, '127.0.0.1', ok));
  const goc = `http://127.0.0.1:${mc.address().port}`;
  const goi = async (duong, o = {}) => {
    const r = await fetch(goc + duong, { ...o, headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined });
    const chu = await r.text();
    let json = null;
    try { json = JSON.parse(chu); } catch (e) { /* không phải JSON */ }
    return { ma: r.status, json, chu, r };
  };
  return { mc, goi, thuMuc, dong: () => new Promise(ok => mc.close(ok)) };
}

test('máy chủ: trang web, chặn đọc file ngoài thư mục public', async () => {
  const { goi, dong } = await khoiDong();
  try {
    const trang = await goi('/');
    assert.equal(trang.ma, 200);
    assert.match(trang.chu, /HawaMap/);
    assert.match(trang.r.headers.get('content-type'), /text\/html/);
    const js = await goi('/js/main.js');
    assert.match(js.r.headers.get('content-type'), /javascript/);
    const etag = js.r.headers.get('etag');
    const lai = await fetch(js.r.url, { headers: { 'If-None-Match': etag } });
    assert.equal(lai.status, 304);
    for (const duong of ['/%2e%2e/server.js', '/..%2fserver.js', '/js/..%2f..%2fserver.js']) {
      const r = await goi(duong);
      assert.notEqual(r.ma, 200, duong);
      assert.doesNotMatch(r.chu, /taoMayChu/);
    }
    assert.equal((await goi('/khong-co.js')).ma, 404);
    assert.equal((await goi('/api/trang-thai')).json.ok, true);
  } finally {
    await dong();
  }
});

test('máy chủ: gửi, lọc, xác nhận, gỡ và xoá báo cáo', async () => {
  const { mc, goi, thuMuc, dong } = await khoiDong();
  try {
    const sai = await goi('/api/bao-cao', { method: 'POST', body: { loai: 'abc', lng: 105.85, lat: 21.03, thietBi: 'a' } });
    assert.equal(sai.ma, 400);

    const tao = await goi('/api/bao-cao', { method: 'POST', body: { loai: 'ketxe', lng: 105.85, lat: 21.03, huong: 90, thietBi: 'may-a' } });
    assert.equal(tao.ma, 201);
    const bc = tao.json.baoCao;
    assert.equal(bc.cuaToi, true);
    assert.equal(bc.thietBiBam, undefined);
    assert.ok(bc.hetHan > Date.now() + 59 * 60000);

    // báo cáo trùng gần đó → gộp, tăng xác nhận
    const trung = await goi('/api/bao-cao', { method: 'POST', body: { loai: 'ketxe', lng: 105.8501, lat: 21.0301, thietBi: 'may-b' } });
    assert.equal(trung.json.trung, true);
    assert.equal(trung.json.baoCao.conTon, 1);

    const trongKhung = await goi('/api/bao-cao?bbox=105.8,21,105.9,21.1&thietBi=may-b');
    assert.equal(trongKhung.json.baoCao.length, 1);
    assert.equal(trongKhung.json.baoCao[0].cuaToi, false);
    assert.equal((await goi('/api/bao-cao?bbox=106,22,107,23')).json.baoCao.length, 0);

    // người khác xoá: bị từ chối
    assert.equal((await goi(`/api/bao-cao/${bc.id}?thietBi=may-b`, { method: 'DELETE' })).ma, 403);

    // 2 phiếu "không còn" nhiều hơn "vẫn còn" → gỡ
    await goi(`/api/bao-cao/${bc.id}/xac-nhan`, { method: 'POST', body: { conTon: false, thietBi: 'may-c' } });
    const k1b = await goi(`/api/bao-cao/${bc.id}/xac-nhan`, { method: 'POST', body: { conTon: false, thietBi: 'may-c' } });
    assert.equal(k1b.json.baoCao.khongCon, 1);                  // bấm lại không tính thêm phiếu
    const k2 = await goi(`/api/bao-cao/${bc.id}/xac-nhan`, { method: 'POST', body: { conTon: false, thietBi: 'may-d' } });
    assert.equal(k2.json.daGo, true);                           // 2 "không còn" > 1 "vẫn còn" (may-b)
    assert.equal((await goi('/api/bao-cao')).json.baoCao.length, 0);

    // camera: người gửi tự xoá được; dữ liệu được lưu ra file
    const cam = await goi('/api/bao-cao', { method: 'POST', body: { loai: 'camera', phu: 'dendo', lng: 105.86, lat: 21.04, thietBi: 'may-a' } });
    assert.equal(cam.json.baoCao.hetHan, 0);
    assert.equal(cam.json.baoCao.phu, 'dendo');                  // loại camera
    // camera loại khác ngay cạnh là báo cáo riêng; loại không hợp lệ bị bỏ
    const cam2 = await goi('/api/bao-cao', { method: 'POST', body: { loai: 'camera', phu: 'xyz', lng: 105.8601, lat: 21.0401, thietBi: 'may-b' } });
    assert.equal(cam2.ma, 201);
    assert.equal(cam2.json.baoCao.phu, undefined);
    assert.equal((await goi(`/api/bao-cao/${cam2.json.baoCao.id}?thietBi=may-b`, { method: 'DELETE' })).json.ok, true);
    await mc.luuNgay();
    const file = JSON.parse(await fs.readFile(path.join(thuMuc, 'bao-cao.json'), 'utf8'));
    assert.equal(file.length, 1);
    assert.equal((await goi(`/api/bao-cao/${cam.json.baoCao.id}?thietBi=may-a`, { method: 'DELETE' })).json.ok, true);
  } finally {
    await dong();
  }
});

test('IP người dùng sau IIS: chỉ tin X-Forwarded-For từ proxy trên chính máy, lấy địa chỉ cuối', () => {
  const yc = (goc, xff) => ({ socket: { remoteAddress: goc }, headers: xff ? { 'x-forwarded-for': xff } : {} });
  assert.equal(ipKhach(yc('127.0.0.1', '113.161.1.2')), '113.161.1.2');
  assert.equal(ipKhach(yc('::1', '1.2.3.4, 113.161.1.2')), '113.161.1.2');            // địa chỉ đầu do người dùng tự gửi: bỏ
  assert.equal(ipKhach(yc('::ffff:127.0.0.1', '113.161.1.2')), '113.161.1.2');
  assert.equal(ipKhach(yc('203.0.113.9', '1.2.3.4')), '203.0.113.9');                // gọi thẳng: không tin header
  assert.equal(ipKhach(yc('127.0.0.1')), '127.0.0.1');
});

test('máy chủ nén gzip trang, mã nguồn và JSON lớn', async () => {
  const { goi, dong, mc } = await khoiDong();
  try {
    const lay = duong => new Promise((ok, loi) => {
      http.get({ host: '127.0.0.1', port: mc.address().port, path: duong, headers: { 'Accept-Encoding': 'gzip' } }, r => {
        const manh = [];
        r.on('data', c => manh.push(c));
        r.on('end', () => ok({ r, than: Buffer.concat(manh) }));
      }).on('error', loi);
    });
    const js = await lay('/vendor/maplibre-gl/maplibre-gl.js');
    assert.equal(js.r.headers['content-encoding'], 'gzip');
    assert.match(js.r.headers.vary, /Accept-Encoding/);
    const goc = zlib.gunzipSync(js.than);
    assert.ok(goc.length > js.than.length * 2, 'nén còn dưới một nửa');
    const anh = await lay('/icons/icon-192.png');
    assert.equal(anh.r.headers['content-encoding'], undefined);                      // ảnh PNG không nén lại
    const nho = await lay('/api/trang-thai');
    assert.equal(nho.r.headers['content-encoding'], undefined);                      // JSON nhỏ không cần nén
    assert.equal((await goi('/api/trang-thai')).json.ok, true);
  } finally {
    await dong();
  }
});

test('máy chủ trả tệp xác minh tên miền khi xin chứng chỉ HTTPS (Let\'s Encrypt)', async () => {
  const acme = await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-acme-'));
  await fs.writeFile(path.join(acme, 'Abc_123-xyzTOKEN'), 'Abc_123-xyzTOKEN.khoa-tai-khoan');
  const { goi, dong } = await khoiDong({ thuMucAcme: acme });
  try {
    const r = await goi('/.well-known/acme-challenge/Abc_123-xyzTOKEN');
    assert.equal(r.ma, 200);
    assert.equal(r.chu, 'Abc_123-xyzTOKEN.khoa-tai-khoan');
    assert.match(r.r.headers.get('content-type'), /text\/plain/);
    assert.equal((await goi('/.well-known/acme-challenge/khong-co-tep')).ma, 404);
    for (const duong of ['/.well-known/acme-challenge/..%2f..%2fserver.js', '/.well-known/acme-challenge/a.b', '/.well-known/acme-challenge/']) {
      const x = await goi(duong);
      assert.equal(x.ma, 404, duong);
      assert.doesNotMatch(x.chu, /taoMayChu/);
    }
  } finally {
    await dong();
  }
});
