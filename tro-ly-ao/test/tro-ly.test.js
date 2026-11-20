// Kiểm thử toàn bộ đường đi: trình duyệt → server.js → (giả) Claude + (giả) máy chủ thất thoát nước.
// Chạy: npm test

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { giaLapClaude, giaLapThatThoat } from './gia-lap.js';
import { MayChuThatThoat, chuanHoaMa } from '../lib/thatthoat.js';
import { chuanHoaNoiDung } from '../lib/tro-ly.js';
import { kiemTraDauVao } from '../lib/cong-cu.js';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nghe = (sv) => new Promise((ok) => sv.listen(0, '127.0.0.1', () => ok(sv.address().port)));

let claude, thatThoat, troLy, congTroLy, chungChi, maNhanDang, tmp;

/** Tạo chứng chỉ tự ký bằng openssl (giống máy chủ IIS dùng chứng chỉ tự ký). */
function taoChungChi() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'troly-'));
  const key = path.join(tmp, 'key.pem'), cert = path.join(tmp, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  const pem = fs.readFileSync(cert, 'utf8');
  const der = Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ''), 'base64');
  return { cert: pem, key: fs.readFileSync(key, 'utf8'), vanTay: crypto.createHash('sha256').update(der).digest('hex').toUpperCase() };
}

async function choSan(port) {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/api/thongtin`); if (r.ok) return; } catch { /* chưa lên */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server.js không khởi động được');
}

before(async () => {
  chungChi = taoChungChi();
  maNhanDang = [0, 1, 2, 3].map((i) => chungChi.vanTay.substr(i * 4, 4)).join('-');
  claude = giaLapClaude();
  const congClaude = await nghe(claude.sv);
  thatThoat = giaLapThatThoat({ cert: chungChi.cert, key: chungChi.key });
  const congTT = await nghe(thatThoat.sv);

  congTroLy = 18000 + Math.floor(Math.random() * 2000);
  troLy = spawn(process.execPath, ['server.js'], {
    cwd: GOC,
    env: {
      ...process.env,
      TRO_LY_ENV: path.join(tmp, 'khong-co.env'),
      ANTHROPIC_API_KEY: 'sk-ant-gia-lap',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${congClaude}`,
      MAYCHU_DIACHI: `localhost:${congTT}`,
      MAYCHU_MANHANDANG: maNhanDang,
      CONG: String(congTroLy),
      DIA_CHI_NGHE: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  troLy.stdout.on('data', (d) => process.env.DEBUG && process.stdout.write(d));
  troLy.stderr.on('data', (d) => process.stderr.write(d));
  await choSan(congTroLy);
});

after(() => {
  troLy?.kill();
  claude?.sv.close();
  thatThoat?.sv.close();
  thatThoat?.sv.closeAllConnections?.();
});

const url = (d) => `http://127.0.0.1:${congTroLy}/api/${d}`;

async function dangNhap() {
  const r = await fetch(url('dangnhap'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ten: 'quan', matKhau: 'matkhau' }) });
  assert.equal(r.status, 200);
  return (await r.json()).token;
}

/** Gửi câu hỏi, đọc hết luồng sự kiện. */
async function hoi(token, cauHoi, hoiThoai) {
  const r = await fetch(url('hoi'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ cauHoi, hoiThoai }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  const chu = await r.text();
  const suKien = chu.split('\n\n').filter((k) => k.startsWith('event:')).map((k) => {
    const [d1, d2] = k.split('\n');
    return { ten: d1.slice(7), d: JSON.parse(d2.slice(6)) };
  });
  return {
    suKien,
    hoiThoai: suKien.find((e) => e.ten === 'batdau')?.d.hoiThoai,
    traLoi: suKien.filter((e) => e.ten === 'chu').map((e) => e.d.t).join(''),
  };
}

test('thông tin + tên công ty lấy từ máy chủ thất thoát nước', async () => {
  const r = await (await fetch(url('thongtin'))).json();
  assert.equal(r.cheDo, 'thatthoat');
  assert.equal(r.coSoLieu, true);
  assert.equal(r.tenCongTy, 'CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG');
});

test('chưa đăng nhập / sai mật khẩu bị chặn', async () => {
  let r = await fetch(url('hoi'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"cauHoi":"xin chào"}' });
  assert.equal(r.status, 401);
  r = await fetch(url('dangnhap'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"ten":"quan","matKhau":"sai"}' });
  assert.equal(r.status, 401);
  assert.match((await r.json()).loi, /Sai tên đăng nhập/);
});

test('trang web lạ không gọi được API (chặn CSRF)', async () => {
  const token = await dangNhap();
  const r = await fetch(url('hoi'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, Origin: 'https://trang-la.example' },
    body: '{"cauHoi":"xin chào"}',
  });
  assert.equal(r.status, 403);
});

test('hỏi số liệu: gọi công cụ, tra máy chủ bằng token người dùng, trả lời có số', async () => {
  const token = await dangNhap();
  const truoc = claude.yeuCau.length;
  const { suKien, traLoi, hoiThoai } = await hoi(token, 'Tỷ lệ thất thoát tháng 9 là bao nhiêu?');
  assert.ok(hoiThoai);
  assert.ok(suKien.some((e) => e.ten === 'congcu' && /tháng 9\/2026/.test(e.d.moTa)), 'có báo đang tra');
  assert.equal(suKien.at(-1).ten, 'xong');
  assert.match(traLoi, /12,35 phần trăm/);
  assert.match(traLoi, /Đội Cấp nước số 3 cao nhất/);

  // máy chủ thất thoát nước được gọi đúng tháng, bằng token của người dùng
  const goi = thatThoat.nhatKy.filter((x) => x.path === '/api/tongquan').at(-1);
  assert.deepEqual(goi.query, { nam: '2026', thang: '9' });
  assert.equal(goi.auth, 'Bearer ' + thatThoat.TOKEN);

  // yêu cầu gửi Claude: đúng mô hình, effort, fallback, bộ nhớ đệm, công cụ
  const [y1, y2] = claude.yeuCau.slice(truoc);
  assert.equal(y1.body.model, 'claude-opus-5-5');
  assert.deepEqual(y1.body.output_config, { effort: 'low' });
  assert.equal(y1.body.fallbacks, 'default');
  assert.match(y1.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.deepEqual(y1.body.cache_control, { type: 'ephemeral' });
  assert.deepEqual(y1.body.tools.map((t) => t.name), ['that_thoat_thang', 'that_thoat_ca_nam', 'khai_thac_cap_1']);
  assert.ok(y1.body.system.includes('CÔNG TY TNHH MTV CẤP NƯỚC HẬU GIANG'));
  assert.match(y1.body.messages[0].content[0].text, /^<thoi_diem>.+<\/thoi_diem>\nTỷ lệ thất thoát/);
  // vòng 2 nối thêm (append-only): tin trợ lý (giữ khối thinking) + kết quả công cụ
  assert.deepEqual(y2.body.messages.slice(0, 1), y1.body.messages);
  assert.equal(y2.body.messages[1].content[0].type, 'thinking');
  assert.equal(y2.body.messages[2].content[0].type, 'tool_result');
  const kq = JSON.parse(y2.body.messages[2].content[0].content);
  assert.equal(kq.donVi[0].tyLe, 12.35);                // đã làm tròn
  assert.equal(kq.donVi[0].phatRa, 1234567);
  assert.equal(kq.donVi.at(-1).tinhTrang, 'TLK đứng kim');
  assert.ok(!('id' in kq.donVi[0]));                    // bỏ mã nội bộ

  // lượt sau: lịch sử giữ nguyên, chỉ nối thêm
  const lan2 = await hoi(token, 'Cảm ơn em', hoiThoai);
  assert.equal(lan2.hoiThoai, hoiThoai);
  const y3 = claude.yeuCau.at(-1);
  assert.deepEqual(y3.body.messages.slice(0, 3), y2.body.messages);
  assert.equal(y3.body.messages.length, 5);
  assert.equal(JSON.stringify(y3.body.system), JSON.stringify(y1.body.system));
  assert.equal(JSON.stringify(y3.body.tools), JSON.stringify(y1.body.tools));
});

test('người khác không dùng được hội thoại của mình', async () => {
  const token = await dangNhap();
  const { hoiThoai } = await hoi(token, 'Xin chào');
  // token lạ → 401
  let r = await fetch(url('hoi'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-la' }, body: JSON.stringify({ cauHoi: 'x', hoiThoai }) });
  assert.equal(r.status, 401);
  // người dùng khác hợp lệ đưa mã hội thoại của người kia → được hội thoại mới, không thấy lịch sử cũ
  r = await fetch(url('dangnhap'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ten: 'lan', matKhau: 'matkhau' }) });
  const token2 = (await r.json()).token;
  const lan = await hoi(token2, 'Chào em', hoiThoai);
  assert.notEqual(lan.hoiThoai, hoiThoai);
  assert.equal(claude.yeuCau.at(-1).body.messages.length, 1);
});

test('bị từ chối: báo người dùng, không lưu lượt vào lịch sử', async () => {
  const token = await dangNhap();
  const { hoiThoai } = await hoi(token, 'Xin chào');
  const tc = await hoi(token, 'câu này sẽ bị từ chối', hoiThoai);
  assert.match(tc.traLoi, /không thể trả lời/);
  await hoi(token, 'Tiếp tục', hoiThoai);
  const y = claude.yeuCau.at(-1);
  assert.equal(y.body.messages.length, 3);               // chào + trả lời + "Tiếp tục" (lượt bị từ chối không còn)
});

test('mô hình dự phòng giữa chừng: bỏ thinking trước khối fallback khi gửi lại', async () => {
  const token = await dangNhap();
  const { hoiThoai, traLoi } = await hoi(token, 'thử dự phòng');
  assert.match(traLoi, /Phần đầu\. Phần sau từ mô hình dự phòng\./);
  await hoi(token, 'Tiếp', hoiThoai);
  const m = claude.yeuCau.at(-1).body.messages[1].content.map((b) => b.type);
  assert.deepEqual(m, ['text', 'fallback', 'thinking', 'text']);
});

test('API không nhận tính năng dự phòng: tự tắt rồi hỏi lại, người dùng không thấy lỗi', async () => {
  const token = await dangNhap();
  claude.tuChoiDuPhong.bat = true;
  const truoc = claude.yeuCau.length;
  try {
    const { traLoi, suKien } = await hoi(token, 'Xin chào');
    assert.match(traLoi, /em nghe đây/);
    assert.ok(!suKien.some((e) => e.ten === 'loi'));
    const moi = claude.yeuCau.slice(truoc);
    assert.equal(moi.length, 2);
    assert.equal(moi[0].body.fallbacks, 'default');
    assert.equal(moi[1].body.fallbacks, undefined);
    assert.ok(!/server-side-fallback/.test(moi[1].headers['anthropic-beta'] || ''));
  } finally {
    claude.tuChoiDuPhong.bat = false;
  }
});

test('ghim chứng chỉ: mã nhận dạng sai thì không gửi gì (kể cả mật khẩu)', async () => {
  const cong = thatThoat.sv.address().port;
  const truoc = thatThoat.nhatKy.length;
  const sai = new MayChuThatThoat({ diaChi: `localhost:${cong}`, maNhanDang: '0000-1111-2222-3333' });
  await assert.rejects(sai.dangNhap('quan', 'matkhau'), /Mã nhận dạng chứng chỉ máy chủ không khớp/);
  assert.equal(thatThoat.nhatKy.length, truoc, 'máy chủ không nhận được yêu cầu nào');
  // đủ 64 ký tự cũng dùng được
  const dung = new MayChuThatThoat({ diaChi: `https://localhost:${cong}`, maNhanDang: chungChi.vanTay });
  assert.equal((await dung.ping()).ungDung, 'ThatThoatNuoc');
  // không ghim → chứng chỉ tự ký bị từ chối như trình duyệt
  const khongGhim = new MayChuThatThoat({ diaChi: `localhost:${cong}` });
  await assert.rejects(khongGhim.ping());
});

test('kiểm tra đầu vào công cụ', () => {
  assert.equal(kiemTraDauVao('that_thoat_thang', {}).ok, true);
  assert.equal(kiemTraDauVao('that_thoat_thang', { nam: 2026, thang: 13 }).ok, false);
  assert.equal(kiemTraDauVao('that_thoat_thang', { thang: 9 }).ok, false);        // thiếu năm
  assert.equal(kiemTraDauVao('that_thoat_thang', { nam: '2026' }).ok, false);
  assert.equal(kiemTraDauVao('that_thoat_thang', { lenh: 'xoa' }).ok, false);
  assert.equal(kiemTraDauVao('khai_thac_cap_1', { nam: 2026, thang: 9, chi_tiet_dong_ho: true }).ok, true);
  assert.equal(kiemTraDauVao('khong_co', {}).ok, false);
  assert.equal(chuanHoaMa('abcd-ef01-2345-6789'), 'ABCDEF0123456789');
});

test('chuẩn hoá nội dung sau fallback', () => {
  const c = [
    { type: 'thinking', thinking: '', signature: 'a' },
    { type: 'tool_use', id: 't1', name: 'x', input: {} },
    { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
    { type: 'text', text: 'A' },
    { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } },
    { type: 'thinking', thinking: '', signature: 'b' },
    { type: 'tool_use', id: 't2', name: 'x', input: {} },
  ];
  assert.deepEqual(chuanHoaNoiDung(c).map((b) => b.type), ['text', 'fallback', 'thinking', 'tool_use']);
  const khong = [{ type: 'thinking' }, { type: 'text' }];
  assert.equal(chuanHoaNoiDung(khong), khong);
});
