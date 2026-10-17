import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { taoMayChu } from '../server.js';

async function khoiDong() {
  const thuMuc = await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-'));
  const mc = taoMayChu({ thuMucDuLieu: thuMuc, ghiLog: false });
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
    const cam = await goi('/api/bao-cao', { method: 'POST', body: { loai: 'camera', lng: 105.86, lat: 21.04, thietBi: 'may-a' } });
    assert.equal(cam.json.baoCao.hetHan, 0);
    await mc.luuNgay();
    const file = JSON.parse(await fs.readFile(path.join(thuMuc, 'bao-cao.json'), 'utf8'));
    assert.equal(file.length, 1);
    assert.equal((await goi(`/api/bao-cao/${cam.json.baoCao.id}?thietBi=may-a`, { method: 'DELETE' })).json.ok, true);
  } finally {
    await dong();
  }
});
