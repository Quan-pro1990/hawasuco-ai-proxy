'use strict';
/*
 * Kiểm tra máy chủ: chạy server.js với một "YouTube giả" để không cần Internet hay khóa thật.
 *   node test/test.js
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');

const ids = Array.from({ length: 25 }, (_, i) => ('vid' + String(i).padStart(8, '0')).slice(0, 11));
let searchCalls = 0;
let quotaKey = 'KEY_QUOTA_EXHAUSTED_000000';

function mockYouTube(req, res) {
  const u = new URL(req.url, 'http://x');
  const send = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  const key = u.searchParams.get('key');
  if (u.pathname === '/oembed') {
    const v = new URL(u.searchParams.get('url')).searchParams.get('v');
    if (v === 'noEmbed0000') return send(401, {});
    return send(200, { title: 'oEmbed ' + v, author_name: 'Kênh oEmbed' });
  }
  if (key === quotaKey) return send(403, { error: { errors: [{ reason: 'quotaExceeded' }] } });
  if (u.pathname === '/search') {
    searchCalls++;
    const q = u.searchParams.get('q');
    const start = u.searchParams.get('pageToken') ? 20 : 0;
    const items = ids.slice(start, start + 20).map((id) => ({ id: { videoId: id }, snippet: { title: q + ' ' + id } }));
    return send(200, { items, nextPageToken: start ? '' : 'PAGE2', pageInfo: { totalResults: 25 } });
  }
  if (u.pathname === '/videos') {
    const list = u.searchParams.get('id').split(',');
    return send(200, {
      items: list.filter((id) => id !== 'missing0000').map((id, i) => ({
        id,
        snippet: { title: 'Bài &amp; hát ' + id, channelTitle: 'Kênh ' + i, liveBroadcastContent: 'none' },
        contentDetails: { duration: 'PT4M' + (10 + i) + 'S' },
        statistics: { viewCount: String(1000 * (i + 1)) },
        status: { embeddable: id !== 'vid00000003' },
      })),
    });
  }
  if (u.pathname === '/playlistItems') {
    return send(200, { items: ids.slice(0, 5).map((id) => ({ contentDetails: { videoId: id } })) });
  }
  if (u.pathname === '/playlists') {
    return send(200, { items: [{ snippet: { title: 'Danh sách thử' } }] });
  }
  send(404, {});
}

function listen(server) {
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
}

async function main() {
  const yt = http.createServer(mockYouTube);
  const ytPort = await listen(yt);
  const probe = http.createServer();
  const port = await listen(probe);
  probe.close();

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'karaled-test-'));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      YOUTUBE_API_KEY: quotaKey + ',KEY_GOOD_0000000000000000',
      CONTROL_PIN: '',
      YT_API_BASE: `http://127.0.0.1:${ytPort}`,
      YT_OEMBED_URL: `http://127.0.0.1:${ytPort}/oembed`,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => child.stdout.on('data', (d) => { if (/dang chay/.test(String(d))) resolve(); }));

  const base = `http://127.0.0.1:${port}`;
  const get = async (p) => {
    const r = await fetch(base + p);
    return { status: r.status, body: await r.json() };
  };
  const post = async (p, body, headers) => {
    const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const act = (type, data, headers) => post('/api/action', { type, ...(data || {}) }, headers);
  const state = async () => (await get('/api/state')).body;
  let passed = 0;
  const ok = (name) => { passed++; console.log('  ✓ ' + name); };

  try {
    // Trang tĩnh
    for (const p of ['/', '/led', '/app.js', '/led.js', '/vendor/qrcode.js', '/icon.svg']) {
      const r = await fetch(base + p);
      assert.strictEqual(r.status, 200, p);
    }
    assert.strictEqual((await fetch(base + '/..%2f..%2fserver.js')).status, 404);
    assert.strictEqual((await fetch(base + '/uploads/..%2f..%2fserver.js')).status, 404);
    ok('phục vụ trang, chặn đường dẫn ra ngoài');

    // Tìm kiếm + bộ nhớ đệm + đổi khóa khi hết lượt
    let r = await get('/api/search?q=' + encodeURIComponent('tình xưa karaoke'));
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.items.length, 19, 'bỏ video không cho nhúng');
    assert.strictEqual(r.body.items[0].title, 'Bài & hát vid00000000');
    assert.strictEqual(r.body.items[0].duration, 250);
    assert.strictEqual(r.body.nextPageToken, 'PAGE2');
    assert.ok(!r.body.items.some((x) => x.videoId === 'vid00000003'));
    const calls = searchCalls;
    r = await get('/api/search?q=' + encodeURIComponent('Tình xưa KARAOKE'));
    assert.strictEqual(r.body.cached, true);
    assert.strictEqual(searchCalls, calls, 'tìm lại không gọi YouTube');
    r = await get('/api/search?q=abc&pageToken=PAGE2');
    assert.strictEqual(r.body.items.length, 5);
    ok('tìm kiếm, lưu đệm, tự chuyển khóa khi hết lượt');

    // Link
    r = await get('/api/link?url=' + encodeURIComponent('https://youtu.be/vid00000001?si=abc'));
    assert.strictEqual(r.body.video.videoId, 'vid00000001');
    r = await get('/api/link?url=' + encodeURIComponent('https://www.youtube.com/watch?v=vid00000002&list=PLabcdefghijk'));
    assert.strictEqual(r.body.playlist.items.length, 4);
    assert.strictEqual(r.body.playlist.title, 'Danh sách thử');
    r = await get('/api/link?url=' + encodeURIComponent('https://m.youtube.com/shorts/vid00000004'));
    assert.strictEqual(r.body.video.videoId, 'vid00000004');
    r = await get('/api/link?url=' + encodeURIComponent('https://example.com/watch?v=vid00000004'));
    assert.strictEqual(r.status, 400);
    r = await get('/api/link?url=' + encodeURIComponent('https://youtube.com/watch?v=vid00000003'));
    assert.strictEqual(r.status, 400, 'video cấm nhúng');
    ok('thêm bằng link bài / danh sách phát / shorts');

    // Danh sách phát
    const v = (i) => ({ videoId: ids[i], title: 'Bài ' + i, channel: 'K', duration: 200 });
    r = await act('add', { video: v(0), singer: 'Lan' });
    assert.strictEqual(r.status, 200);
    let s = await state();
    assert.strictEqual(s.current.videoId, ids[0], 'tự phát khi đang trống');
    assert.strictEqual(s.current.singer, 'Lan');
    assert.strictEqual(s.playback.status, 'playing');
    await act('add', { videos: [v(1), v(2), v(4)] });
    await act('add', { video: v(5), next: true });
    s = await state();
    assert.deepStrictEqual(s.queue.map((x) => x.videoId), [ids[5], ids[1], ids[2], ids[4]]);
    await act('move', { uid: s.queue[3].uid, to: 'top' });
    s = await state();
    await act('move', { uid: s.queue[1].uid, to: 'down' });
    s = await state();
    assert.deepStrictEqual(s.queue.map((x) => x.videoId), [ids[4], ids[1], ids[5], ids[2]]);
    await act('remove', { uid: s.queue[2].uid });
    s = await state();
    assert.deepStrictEqual(s.queue.map((x) => x.videoId), [ids[4], ids[1], ids[2]]);
    ok('thêm, ưu tiên, đổi thứ tự, xóa');

    // Màn hình báo hết bài -> tự chuyển
    const playId = s.current.playId;
    await post('/api/display/status', { playId, time: 42, duration: 200, playing: true });
    s = await state();
    assert.ok(s.playback.position >= 42 && s.playback.position < 44);
    await post('/api/display/ended', { playId });
    await post('/api/display/ended', { playId }); // màn hình thứ hai báo trùng: bỏ qua
    s = await state();
    assert.strictEqual(s.current.videoId, ids[4]);
    assert.strictEqual(s.history[0].videoId, ids[0]);
    assert.strictEqual(s.queue.length, 2);
    ok('hết bài tự chuyển, nhiều màn hình không chuyển trùng');

    // Lặp 1 bài
    await act('repeatOne', { value: true });
    const seq = s.seek.seq;
    await post('/api/display/ended', { playId: s.current.playId });
    s = await state();
    assert.strictEqual(s.current.videoId, ids[4]);
    assert.strictEqual(s.seek.seq, seq + 1);
    await act('repeatOne', { value: false });
    ok('lặp 1 bài');

    // Điều khiển
    await act('pause');
    s = await state();
    assert.strictEqual(s.playback.status, 'paused');
    await act('seek', { to: 30 });
    s = await state();
    assert.strictEqual(s.seek.to, 30);
    await act('stop');
    s = await state();
    assert.strictEqual(s.playback.status, 'stopped');
    await act('play');
    s = await state();
    assert.strictEqual(s.playback.status, 'playing');
    await act('next');
    s = await state();
    assert.strictEqual(s.current.videoId, ids[1]);
    await act('prev');
    s = await state();
    assert.strictEqual(s.current.videoId, ids[4]);
    assert.strictEqual(s.queue[0].videoId, ids[1]);
    await act('screen', { value: 'standby' });
    s = await state();
    assert.strictEqual(s.screen, 'standby');
    assert.strictEqual(s.playback.status, 'paused');
    await act('screen', { value: 'standby' });
    assert.strictEqual((await state()).screen, 'show', 'bấm lại thì tắt màn hình chờ');
    await act('volume', { value: 150 });
    assert.strictEqual((await state()).volume, 100);
    await act('ticker', { text: 'Chúc mừng sinh nhật', show: true, color: '#ff0000', speed: 'fast' });
    s = await state();
    assert.strictEqual(s.ticker.show, true);
    assert.strictEqual(s.ticker.color, '#ff0000');
    await act('effect', { value: 'snow' });
    assert.strictEqual((await state()).effect, 'snow');
    await act('effect', { value: '<script>' });
    assert.strictEqual((await state()).effect, 'none');
    ok('phát, dừng, tua, bài trước/sau, màn hình chờ, âm lượng, chữ chạy, hiệu ứng');

    // Lỗi phát (video cấm nhúng) -> bỏ qua
    s = await state();
    const before = s.current.videoId;
    await post('/api/display/error', { playId: s.current.playId, code: 150 });
    s = await state();
    assert.notStrictEqual(s.current.videoId, before);
    ok('video lỗi được bỏ qua');

    // Mã quản lý
    await act('settings', { newPin: '1234' });
    r = await act('pause');
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.code, 'pin');
    r = await act('add', { video: v(6), next: true });
    assert.strictEqual(r.status, 200, 'khách vẫn thêm bài được');
    s = await state();
    assert.strictEqual(s.queue[s.queue.length - 1].videoId, ids[6], 'khách không chen lên đầu');
    r = await act('pause', {}, { 'X-Pin': '1234' });
    assert.strictEqual(r.status, 200);
    r = await post('/api/check-pin', { pin: '9999' });
    assert.strictEqual(r.status, 403);
    r = await post('/api/check-pin', { pin: '1234' });
    assert.strictEqual(r.status, 200);
    r = await post('/api/upload', {});
    assert.strictEqual(r.status, 403);
    ok('mã quản lý: khách chỉ thêm bài');

    // Tải ảnh màn hình chờ
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a1c40000000049454e44ae426082', 'hex');
    let up = await fetch(base + '/api/upload', { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-Pin': '1234' }, body: png });
    assert.strictEqual(up.status, 200);
    s = await state();
    assert.strictEqual(s.standby.type, 'image');
    up = await fetch(base + s.standby.src);
    assert.strictEqual(up.status, 200);
    assert.strictEqual(Buffer.from(await up.arrayBuffer()).length, png.length);
    up = await fetch(base + s.standby.src, { headers: { Range: 'bytes=0-7' } });
    assert.strictEqual(up.status, 206);
    up = await fetch(base + '/api/upload', { method: 'POST', headers: { 'Content-Type': 'text/html', 'X-Pin': '1234' }, body: '<b>' });
    assert.strictEqual(up.status, 400);
    await act('standbyReset', {}, { 'X-Pin': '1234' });
    s = await state();
    assert.strictEqual(s.standby.type, 'default');
    ok('tải ảnh màn hình chờ, hỗ trợ tua video (Range)');

    // SSE
    const ctrl = new AbortController();
    const es = await fetch(base + '/api/events?role=display', { signal: ctrl.signal });
    const reader = es.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.ok(/event: state|retry/.test(first));
    s = await state();
    assert.strictEqual(s.displays, 1);
    ctrl.abort();
    ok('kết nối thời gian thực, đếm màn hình LED');

    // Lưu trạng thái khi khởi động lại
    await new Promise((r2) => setTimeout(r2, 600));
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8'));
    assert.ok(saved.queue.length > 0);
    assert.ok(fs.existsSync(path.join(dataDir, 'settings.json')));
    ok('lưu danh sách phát vào thư mục dữ liệu');

    console.log(`\n  ${passed} nhóm kiểm tra đều đạt.`);
  } finally {
    child.kill('SIGTERM');
    yt.close();
    await new Promise((r2) => setTimeout(r2, 200));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error('\n  ✗ ' + (e.stack || e));
  process.exit(1);
});
