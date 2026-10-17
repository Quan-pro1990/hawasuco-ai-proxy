import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { docLienKet, laMienGoogle, boQuaTrangDongY } from '../public/js/lien-ket.js';
import { taoMayChu } from '../server.js';

test('đọc toạ độ, geo: và google.navigation:', () => {
  assert.deepEqual(docLienKet('21.0287, 105.8522'), { viTri: [105.8522, 21.0287], ten: '' });
  assert.deepEqual(docLienKet('geo:21.0287,105.8522?q=21.0287,105.8522(Hồ Gươm)'), { viTri: [105.8522, 21.0287], ten: 'Hồ Gươm' });
  assert.deepEqual(docLienKet('geo:0,0?q=Nh%C3%A0%20h%C3%A1t%20l%E1%BB%9Bn'), { truyVan: 'Nhà hát lớn' });
  assert.deepEqual(docLienKet('geo:10.7725,106.698'), { viTri: [106.698, 10.7725] });
  assert.deepEqual(docLienKet('google.navigation:q=21.03,105.85&mode=d'), { chiDuong: true, viTri: [105.85, 21.03] });
  assert.equal(docLienKet('xin chào'), null);
  assert.equal(docLienKet('geo:0,0'), null);
  assert.equal(docLienKet('200, 300'), null);
});

test('đọc liên kết Google Maps, Apple Maps', () => {
  const noi = docLienKet('https://www.google.com/maps/place/Nh%C3%A0+h%C3%A1t+L%E1%BB%9Bn+H%C3%A0+N%E1%BB%99i/@21.0242,105.8555,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d21.024199!4d105.857565');
  assert.deepEqual(noi.viTri, [105.857565, 21.024199]);      // điểm của địa điểm, không phải tâm khung nhìn
  assert.equal(noi.ten, 'Nhà hát Lớn Hà Nội');
  assert.deepEqual(docLienKet('https://maps.google.com/?q=21.0287,105.8522').viTri, [105.8522, 21.0287]);
  assert.deepEqual(docLienKet('https://www.google.com/maps/search/?api=1&query=Ch%E1%BB%A3+B%E1%BA%BFn+Th%C3%A0nh'), { truyVan: 'Chợ Bến Thành' });
  const dir = docLienKet('https://www.google.com/maps/dir/?api=1&destination=10.7725,106.698&travelmode=driving');
  assert.equal(dir.chiDuong, true);
  assert.deepEqual(dir.viTri, [106.698, 10.7725]);
  const dir2 = docLienKet('https://www.google.com/maps/dir/21.03,105.85/Ch%E1%BB%A3+%C4%90%E1%BB%93ng+Xu%C3%A2n/@21.0,105.8,14z');
  assert.equal(dir2.chiDuong, true);
  assert.equal(dir2.truyVan, 'Chợ Đồng Xuân');
  assert.deepEqual(docLienKet('https://www.google.com.vn/maps/@21.0287,105.8522,15z').viTri, [105.8522, 21.0287]);
  assert.deepEqual(docLienKet('https://maps.apple.com/?ll=21.03,105.85&q=H%E1%BB%93%20G%C6%B0%C6%A1m'), { viTri: [105.85, 21.03], ten: 'Hồ Gươm' });
  // văn bản chia sẻ từ ứng dụng Google Maps: tên, địa chỉ và liên kết rút gọn
  assert.deepEqual(docLienKet('Nhà hát Lớn Hà Nội\n1 Tràng Tiền, Hoàn Kiếm\nhttps://maps.app.goo.gl/AbCdEf123'), { rutGon: 'https://maps.app.goo.gl/AbCdEf123' });
  assert.equal(docLienKet('https://example.com/maps?q=21.03,105.85'), null);
  assert.equal(docLienKet('https://www.google.com/search?q=21.03,105.85'), null);
});

test('tên miền Google và trang đồng ý cookie', () => {
  for (const h of ['www.google.com', 'maps.google.com', 'www.google.com.vn', 'google.co.uk', 'maps.app.goo.gl']) assert.equal(laMienGoogle(h), true, h);
  for (const h of ['google.com.evil.com', 'evilgoogle.com', 'google.evil', 'goo.gl.evil.com', '127.0.0.1']) assert.equal(laMienGoogle(h), false, h);
  assert.equal(boQuaTrangDongY('https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2F%4021.03%2C105.85%2C15z'),
    'https://www.google.com/maps/@21.03,105.85,15z');
});

test('máy chủ mở liên kết rút gọn, chỉ đi qua tên miền Google', async () => {
  const goiRa = [];
  const chuyen = {
    'https://maps.app.goo.gl/AbC123': 'https://consent.google.com/m?continue=' + encodeURIComponent('https://www.google.com/maps/place/H%E1%BB%93+G%C6%B0%C6%A1m/data=!3d21.0287!4d105.8522'),
    'https://maps.app.goo.gl/XauXa': 'https://evil.example/maps/place/x/@1,2,3z',
    'https://maps.app.goo.gl/Vong': 'https://maps.app.goo.gl/Vong'
  };
  const layMang = async (url) => {
    goiRa.push(url);
    return { status: chuyen[url] ? 302 : 200, headers: new Headers(chuyen[url] ? { location: chuyen[url] } : {}), body: null };
  };
  const thuMuc = await fs.mkdtemp(path.join(os.tmpdir(), 'hawamap-'));
  const mc = taoMayChu({ thuMucDuLieu: thuMuc, ghiLog: false, layMang });
  await new Promise(ok => mc.listen(0, '127.0.0.1', ok));
  const goi = async u => { const r = await fetch(`http://127.0.0.1:${mc.address().port}/api/mo-lien-ket?url=${encodeURIComponent(u)}`); return { ma: r.status, json: await r.json() }; };
  try {
    const ok = await goi('https://maps.app.goo.gl/AbC123');
    assert.equal(ok.ma, 200);
    assert.deepEqual(ok.json.diaDiem.viTri, [105.8522, 21.0287]);
    assert.equal(ok.json.diaDiem.ten, 'Hồ Gươm');
    assert.equal((await goi('https://maps.app.goo.gl/XauXa')).ma, 400);          // chuyển ra ngoài Google: dừng
    assert.equal((await goi('https://maps.app.goo.gl/Vong')).ma, 422);           // vòng lặp chuyển hướng: dừng sau vài lần
    const truoc = goiRa.length;
    for (const u of ['http://maps.app.goo.gl/AbC123', 'https://127.0.0.1/x', 'https://evil.example/', 'https://maps.app.goo.gl:8443/x', 'không phải url']) {
      assert.equal((await goi(u)).ma, 400, u);
    }
    assert.equal(goiRa.length, truoc, 'không gọi ra ngoài với liên kết không hợp lệ');
    assert.ok(!goiRa.some(u => u.includes('evil')));
  } finally {
    await new Promise(ok => mc.close(ok));
  }
});
