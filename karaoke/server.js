'use strict';
/*
 * KaraLED - phần mềm karaoke YouTube cho màn hình LED / TV.
 *
 * Máy chủ nhỏ chạy bằng Node.js (không cần cài thêm thư viện):
 *   - phục vụ trang điều khiển (điện thoại / máy tính) và trang màn hình LED;
 *   - giữ danh sách phát, đồng bộ mọi thiết bị theo thời gian thực (Server-Sent Events);
 *   - tìm bài trên YouTube bằng YouTube Data API v3 chính thức (khóa API miễn phí),
 *     có bộ nhớ đệm để tiết kiệm lượt tìm; dán link YouTube thì không cần khóa.
 *
 * Chạy:  node server.js   (Node 18 trở lên)
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
loadEnv(path.join(ROOT, '.env'));

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const YT_API = (process.env.YT_API_BASE || 'https://www.googleapis.com/youtube/v3').replace(/\/$/, '');
const YT_OEMBED = process.env.YT_OEMBED_URL || 'https://www.youtube.com/oembed';
const MAX_UPLOAD = 300 * 1024 * 1024;
const CACHE_TTL = 3 * 24 * 3600 * 1000;
const CACHE_MAX = 800;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

if (typeof fetch !== 'function') {
  console.error('Can Node.js 18 tro len. Tai tai https://nodejs.org (ban LTS).');
  process.exit(1);
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------------------------------------------------------------ */
/* Cấu hình + trạng thái                                               */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  appName: 'KARALED',
  slogan: 'Karaoke YouTube cho màn hình LED',
  hotline: '',
  showQr: true,           // màn hình chờ hiện mã QR để khách quét chọn bài
  autoPlay: true,         // thêm bài khi đang trống thì tự phát
  regionCode: 'VN',
  apiKeys: [],            // khóa YouTube Data API nhập từ phần Cài đặt (ngoài .env)
  pin: '',                // mã quản lý nhập từ phần Cài đặt (ưu tiên hơn CONTROL_PIN trong .env)
};

const DEFAULT_STATE = {
  queue: [],
  current: null,
  history: [],
  playback: { status: 'stopped', position: 0, at: 0, duration: 0 },
  seek: { seq: 0, to: 0 },
  screen: 'show',          // show | standby | blackout
  volume: 80,
  muted: false,
  repeatOne: false,
  loopQueue: false,
  ticker: { text: '', show: false, color: '#ffe14d', speed: 'normal', position: 'bottom', size: 'medium' },
  effect: 'none',
  standby: { type: 'default', src: '', ver: 0 },
};

const settings = Object.assign({}, DEFAULT_SETTINGS, readJson(path.join(DATA_DIR, 'settings.json'), {}));
const state = mergeState(readJson(path.join(DATA_DIR, 'state.json'), {}));
const searchCache = new Map(Object.entries(readJson(path.join(DATA_DIR, 'cache.json'), {})));

function mergeState(saved) {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  for (const k of Object.keys(s)) {
    if (saved[k] === undefined) continue;
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && saved[k] && typeof saved[k] === 'object') {
      Object.assign(s[k], saved[k]);
    } else {
      s[k] = saved[k];
    }
  }
  // Sau khi khởi động lại: bài đang hát giữ nguyên nhưng tạm dừng tại chỗ cũ.
  if (s.playback.status === 'playing') {
    s.playback.status = 'paused';
  }
  s.playback.at = Date.now();
  return s;
}

function envKeys() {
  return String(process.env.YOUTUBE_API_KEY || '').split(/[,;\s]+/).filter(Boolean);
}
function allKeys() {
  return [...new Set([...envKeys(), ...(settings.apiKeys || [])])];
}
function controlPin() {
  return String(settings.pin || process.env.CONTROL_PIN || '');
}

let saveStateTimer = null;
function saveState() {
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(() => writeJson(path.join(DATA_DIR, 'state.json'), state), 400);
}
function saveSettings() {
  writeJson(path.join(DATA_DIR, 'settings.json'), settings, 2);
}
let saveCacheTimer = null;
function saveCache() {
  clearTimeout(saveCacheTimer);
  saveCacheTimer = setTimeout(() => {
    const now = Date.now();
    for (const [k, v] of searchCache) if (now - v.t > CACHE_TTL) searchCache.delete(k);
    while (searchCache.size > CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
    writeJson(path.join(DATA_DIR, 'cache.json'), Object.fromEntries(searchCache));
  }, 2000);
}

/* ------------------------------------------------------------------ */
/* Kết nối thời gian thực (SSE)                                        */
/* ------------------------------------------------------------------ */

const clients = new Set();

function displayCount() {
  let n = 0;
  for (const c of clients) if (c.role === 'display') n++;
  return n;
}

function publicState() {
  return {
    ...state,
    playback: { ...state.playback, position: currentPosition() },
    serverTime: Date.now(),
    displays: displayCount(),
    controllers: clients.size - displayCount(),
    settings: {
      appName: settings.appName,
      slogan: settings.slogan,
      hotline: settings.hotline,
      showQr: settings.showQr,
      autoPlay: settings.autoPlay,
      hasApiKey: allKeys().length > 0,
      pinRequired: !!controlPin(),
    },
    lanUrls: lanUrls(),
  };
}

function send(client, event, data) {
  client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

let broadcastPending = false;
function broadcastState() {
  saveState();
  if (broadcastPending) return;
  broadcastPending = true;
  setImmediate(() => {
    broadcastPending = false;
    const data = publicState();
    for (const c of clients) send(c, 'state', data);
  });
}

function broadcast(event, data, role) {
  for (const c of clients) if (!role || c.role === role) send(c, event, data);
}

function notice(text, level) {
  broadcast('notice', { text, level: level || 'info' });
}

setInterval(() => {
  for (const c of clients) c.res.write(': ping\n\n');
}, 20000);

/* ------------------------------------------------------------------ */
/* Điều khiển phát                                                      */
/* ------------------------------------------------------------------ */

function currentPosition() {
  const p = state.playback;
  if (p.status !== 'playing') return p.position;
  const pos = p.position + (Date.now() - p.at) / 1000;
  return p.duration ? Math.min(pos, p.duration) : pos;
}

function setPlayback(status, position) {
  state.playback.status = status;
  state.playback.position = Math.max(0, position == null ? currentPosition() : position);
  state.playback.at = Date.now();
}

function doSeek(to) {
  state.seek = { seq: state.seek.seq + 1, to: Math.max(0, to) };
  state.playback.position = state.seek.to;
  state.playback.at = Date.now();
}

function newUid() {
  return crypto.randomBytes(6).toString('hex');
}

function cleanText(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200);
}

function makeItem(v, singer) {
  if (!v || !VIDEO_ID_RE.test(v.videoId)) throw httpError(400, 'Mã video không hợp lệ');
  return {
    uid: newUid(),
    videoId: v.videoId,
    title: cleanText(v.title, 200) || 'Video YouTube',
    channel: cleanText(v.channel, 100),
    thumb: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
    duration: Math.max(0, parseInt(v.duration, 10) || 0),
    singer: cleanText(singer != null ? singer : v.singer, 40),
    addedAt: Date.now(),
  };
}

function cloneItem(item) {
  return { ...item, uid: newUid(), addedAt: Date.now() };
}

function setCurrent(item, startAt) {
  state.current = item ? { ...item, playId: newUid(), startedAt: Date.now() } : null;
  state.playback.duration = item ? item.duration || 0 : 0;
  if (item) {
    if (state.screen === 'standby') state.screen = 'show';
    setPlayback('playing', startAt || 0);
    doSeek(startAt || 0);
  } else {
    setPlayback('stopped', 0);
  }
}

function toHistory(item) {
  if (!item) return;
  const h = { ...item };
  delete h.playId;
  delete h.startedAt;
  h.playedAt = Date.now();
  state.history.unshift(h);
  if (state.history.length > 100) state.history.length = 100;
}

/* Bài hiện tại kết thúc (hết bài / qua bài) */
function finishCurrent() {
  const cur = state.current;
  if (!cur) return;
  toHistory(cur);
  if (state.loopQueue) state.queue.push(cloneItem(cur));
}

function startNext() {
  const next = state.queue.shift();
  setCurrent(next || null);
}

function onEnded() {
  if (!state.current) return;
  if (state.repeatOne) {
    setPlayback('playing', 0);
    doSeek(0);
    return;
  }
  finishCurrent();
  startNext();
}

function findQueue(uid) {
  const i = state.queue.findIndex((x) => x.uid === uid);
  if (i < 0) throw httpError(404, 'Bài không còn trong danh sách');
  return i;
}

const GUEST_ACTIONS = new Set(['add']);

const actions = {
  add(a) {
    if (state.queue.length >= 500) throw httpError(400, 'Danh sách đã đủ 500 bài');
    const items = (Array.isArray(a.videos) ? a.videos : [a.video]).slice(0, 200).map((v) => makeItem(v, a.singer));
    if (a.next) state.queue.unshift(...items);
    else state.queue.push(...items);
    if (!state.current && settings.autoPlay && state.screen !== 'blackout') startNext();
    return { added: items.length };
  },
  remove(a) {
    state.queue.splice(findQueue(a.uid), 1);
  },
  move(a) {
    const i = findQueue(a.uid);
    const [item] = state.queue.splice(i, 1);
    let j = i;
    if (a.to === 'up') j = Math.max(0, i - 1);
    else if (a.to === 'down') j = Math.min(state.queue.length, i + 1);
    else if (a.to === 'top') j = 0;
    else if (a.to === 'bottom') j = state.queue.length;
    else if (Number.isInteger(a.to)) j = Math.max(0, Math.min(state.queue.length, a.to));
    state.queue.splice(j, 0, item);
  },
  clearQueue() {
    state.queue = [];
  },
  shuffle() {
    const q = state.queue;
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
  },
  playNow(a) {
    let item;
    if (a.uid) {
      const i = findQueue(a.uid);
      item = state.queue.splice(i, 1)[0];
    } else if (a.historyUid) {
      const h = state.history.find((x) => x.uid === a.historyUid);
      if (!h) throw httpError(404, 'Bài không còn trong lịch sử');
      item = cloneItem(h);
    } else {
      item = makeItem(a.video, a.singer);
    }
    finishCurrent();
    setCurrent(item);
  },
  requeue(a) {
    const h = state.history.find((x) => x.uid === a.historyUid);
    if (!h) throw httpError(404, 'Bài không còn trong lịch sử');
    state.queue.push(cloneItem(h));
    if (!state.current && settings.autoPlay && state.screen !== 'blackout') startNext();
  },
  removeHistory(a) {
    state.history = state.history.filter((x) => x.uid !== a.historyUid);
  },
  clearHistory() {
    state.history = [];
  },
  play() {
    if (state.screen !== 'show') state.screen = 'show';
    if (!state.current) return startNext();
    if (state.playback.status === 'stopped') {
      setPlayback('playing', 0);
      doSeek(0);
    } else {
      setPlayback('playing');
    }
  },
  pause() {
    if (state.current && state.playback.status === 'playing') setPlayback('paused');
  },
  toggle() {
    if (state.current && state.playback.status === 'playing' && state.screen === 'show') actions.pause();
    else actions.play();
  },
  restart() {
    if (!state.current) return;
    if (state.screen !== 'show') state.screen = 'show';
    setPlayback('playing', 0);
    doSeek(0);
  },
  stop() {
    if (!state.current) return;
    setPlayback('stopped', 0);
    doSeek(0);
  },
  seek(a) {
    if (!state.current) return;
    const to = Number(a.to);
    if (!isFinite(to)) throw httpError(400, 'Vị trí không hợp lệ');
    const status = state.playback.status === 'stopped' ? 'paused' : state.playback.status;
    setPlayback(status, to);
    doSeek(to);
  },
  next() {
    finishCurrent();
    startNext();
  },
  prev() {
    const h = state.history[0];
    if (!h) throw httpError(400, 'Chưa có bài nào đã phát');
    state.history.shift();
    if (state.current) {
      const back = { ...state.current };
      delete back.playId;
      delete back.startedAt;
      state.queue.unshift(back);
    }
    setCurrent(h);
  },
  volume(a) {
    state.volume = Math.max(0, Math.min(100, Math.round(Number(a.value) || 0)));
    if (state.volume > 0) state.muted = false;
  },
  mute(a) {
    state.muted = a.value == null ? !state.muted : !!a.value;
  },
  repeatOne(a) {
    state.repeatOne = a.value == null ? !state.repeatOne : !!a.value;
  },
  loopQueue(a) {
    state.loopQueue = a.value == null ? !state.loopQueue : !!a.value;
  },
  screen(a) {
    const v = ['show', 'standby', 'blackout'].includes(a.value) ? a.value : 'show';
    // bấm lại nút đang bật thì quay về màn hình bình thường
    state.screen = state.screen === v && v !== 'show' ? 'show' : v;
    if (state.screen !== 'show' && state.playback.status === 'playing') setPlayback('paused');
  },
  ticker(a) {
    const t = state.ticker;
    if (a.text !== undefined) t.text = cleanText(a.text, 300);
    if (a.show !== undefined) t.show = !!a.show;
    if (/^#[0-9a-f]{6}$/i.test(a.color || '')) t.color = a.color;
    if (['slow', 'normal', 'fast'].includes(a.speed)) t.speed = a.speed;
    if (['top', 'bottom'].includes(a.position)) t.position = a.position;
    if (['small', 'medium', 'large'].includes(a.size)) t.size = a.size;
    if (t.show && !t.text) t.show = false;
  },
  effect(a) {
    const allowed = ['none', 'snow', 'fireworks', 'confetti', 'hearts', 'stars', 'petals', 'bubbles', 'border'];
    state.effect = allowed.includes(a.value) ? a.value : 'none';
  },
  standbyReset() {
    removeUploads();
    state.standby = { type: 'default', src: '', ver: state.standby.ver + 1 };
  },
  announce(a) {
    const text = cleanText(a.text, 200);
    if (text) broadcast('announce', { text, seconds: Math.max(3, Math.min(30, parseInt(a.seconds, 10) || 8)) }, 'display');
  },
  settings(a) {
    if (a.appName !== undefined) settings.appName = cleanText(a.appName, 40) || DEFAULT_SETTINGS.appName;
    if (a.slogan !== undefined) settings.slogan = cleanText(a.slogan, 80);
    if (a.hotline !== undefined) settings.hotline = cleanText(a.hotline, 40);
    if (a.showQr !== undefined) settings.showQr = !!a.showQr;
    if (a.autoPlay !== undefined) settings.autoPlay = !!a.autoPlay;
    if (a.addApiKey) {
      const k = cleanText(a.addApiKey, 100);
      if (!/^[A-Za-z0-9_-]{20,}$/.test(k)) throw httpError(400, 'Khóa API không đúng dạng (thường bắt đầu bằng AIza…)');
      settings.apiKeys = [...new Set([...(settings.apiKeys || []), k])];
    }
    if (a.clearApiKeys) settings.apiKeys = [];
    if (a.newPin !== undefined) {
      const p = cleanText(a.newPin, 20);
      if (p && !/^\d{4,8}$/.test(p)) throw httpError(400, 'Mã quản lý gồm 4–8 chữ số');
      settings.pin = p;
    }
    saveSettings();
  },
};

/* ------------------------------------------------------------------ */
/* YouTube                                                              */
/* ------------------------------------------------------------------ */

const keyBlockedUntil = new Map();

async function ytApi(endpoint, params) {
  const keys = allKeys();
  if (!keys.length) {
    throw httpError(400, 'Chưa có khóa YouTube API nên chưa tìm được. Vẫn dán được link YouTube để thêm bài. '
      + 'Xem HUONG_DAN.md mục "Lấy khóa YouTube API" (miễn phí).', 'nokey');
  }
  let lastErr = null;
  for (const key of keys) {
    if ((keyBlockedUntil.get(key) || 0) > Date.now()) continue;
    const url = `${YT_API}/${endpoint}?${new URLSearchParams({ ...params, key })}`;
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch (e) {
      throw httpError(502, 'Không kết nối được YouTube. Kiểm tra Internet của máy chủ.');
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body;
    const reason = (((body.error || {}).errors || [])[0] || {}).reason || '';
    if (/quota|dailyLimit|rateLimit/i.test(reason)) {
      keyBlockedUntil.set(key, Date.now() + 30 * 60 * 1000);
      lastErr = httpError(429, 'Đã hết lượt tìm kiếm miễn phí hôm nay của khóa YouTube API (10.000 đơn vị/ngày). '
        + 'Thêm khóa khác trong Cài đặt, hoặc dán link YouTube để thêm bài. Lượt tìm được cấp lại sau 14–15 giờ chiều (giờ VN).', 'quota');
      continue;
    }
    if (/keyInvalid|badRequest|API_KEY_INVALID/i.test(reason + JSON.stringify(body))) {
      keyBlockedUntil.set(key, Date.now() + 10 * 60 * 1000);
      lastErr = httpError(400, 'Khóa YouTube API không đúng. Kiểm tra lại khóa trong Cài đặt hoặc file .env.', 'keyinvalid');
      continue;
    }
    if (res.status === 403) {
      keyBlockedUntil.set(key, Date.now() + 10 * 60 * 1000);
      lastErr = httpError(403, 'Khóa YouTube API bị từ chối (chưa bật "YouTube Data API v3" cho dự án, hoặc khóa bị giới hạn sai). '
        + 'Xem HUONG_DAN.md.', 'forbidden');
      continue;
    }
    throw httpError(502, `YouTube báo lỗi ${res.status}${reason ? ' (' + reason + ')' : ''}`);
  }
  throw lastErr || httpError(429, 'Các khóa YouTube API đang tạm khóa, thử lại sau ít phút.', 'quota');
}

function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

async function videoDetails(ids) {
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await ytApi('videos', {
      part: 'snippet,contentDetails,statistics,status',
      id: ids.slice(i, i + 50).join(','),
      maxResults: '50',
    });
    for (const v of data.items || []) {
      out.push({
        videoId: v.id,
        title: decodeEntities(v.snippet.title),
        channel: decodeEntities(v.snippet.channelTitle),
        duration: parseDuration(v.contentDetails && v.contentDetails.duration),
        views: +((v.statistics || {}).viewCount || 0),
        live: (v.snippet.liveBroadcastContent || 'none') !== 'none',
        embeddable: !v.status || v.status.embeddable !== false,
      });
    }
  }
  return out;
}

async function searchYouTube(q, pageToken) {
  const cacheKey = `${q.toLowerCase()}|${pageToken || ''}`;
  const hit = searchCache.get(cacheKey);
  if (hit && Date.now() - hit.t < CACHE_TTL) return { ...hit.data, cached: true };

  const params = {
    part: 'snippet',
    type: 'video',
    q,
    maxResults: '20',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    regionCode: settings.regionCode || 'VN',
    relevanceLanguage: 'vi',
    safeSearch: 'moderate',
  };
  if (pageToken) params.pageToken = pageToken;
  const data = await ytApi('search', params);
  const ids = (data.items || []).map((x) => x.id && x.id.videoId).filter(Boolean);
  const details = await videoDetails(ids);
  const byId = new Map(details.map((d) => [d.videoId, d]));
  const items = ids.map((id) => byId.get(id)).filter((d) => d && d.embeddable && !d.live);
  const result = { items, nextPageToken: data.nextPageToken || '', total: (data.pageInfo || {}).totalResults || 0 };
  searchCache.set(cacheKey, { t: Date.now(), data: result });
  saveCache();
  return result;
}

function parseYouTubeUrl(input) {
  const s = String(input || '').trim();
  if (VIDEO_ID_RE.test(s)) return { videoId: s };
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
  } catch (e) {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let videoId = null;
  if (host === 'youtu.be') videoId = u.pathname.slice(1, 12);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.searchParams.get('v')) videoId = u.searchParams.get('v');
    else {
      const m = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
      if (m) videoId = m[1];
    }
  } else {
    return null;
  }
  const listId = u.searchParams.get('list') || '';
  return {
    videoId: VIDEO_ID_RE.test(videoId || '') ? videoId : null,
    listId: /^[A-Za-z0-9_-]{10,64}$/.test(listId) && !/^RD/.test(listId) ? listId : null,
  };
}

async function oembedInfo(videoId) {
  try {
    const url = `${YT_OEMBED}?${new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}`, format: 'json' })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.status === 401 || res.status === 403) {
      throw httpError(400, 'Video này không cho phát nhúng ngoài YouTube (chủ kênh đã tắt).');
    }
    if (res.status === 404 || res.status === 400) throw httpError(404, 'Không tìm thấy video (đã xóa hoặc ở chế độ riêng tư).');
    if (!res.ok) throw new Error('oembed ' + res.status);
    const d = await res.json();
    return { videoId, title: d.title || '', channel: d.author_name || '', duration: 0 };
  } catch (e) {
    if (e.status) throw e;
    return { videoId, title: 'Video YouTube ' + videoId, channel: '', duration: 0 };
  }
}

async function linkInfo(input) {
  const p = parseYouTubeUrl(input);
  if (!p || (!p.videoId && !p.listId)) throw httpError(400, 'Link không phải video YouTube');
  const hasKey = allKeys().length > 0;

  if (p.listId && hasKey) {
    const ids = [];
    let pageToken = '';
    let title = '';
    do {
      const params = { part: 'contentDetails', playlistId: p.listId, maxResults: '50' };
      if (pageToken) params.pageToken = pageToken;
      const d = await ytApi('playlistItems', params);
      for (const it of d.items || []) if (it.contentDetails) ids.push(it.contentDetails.videoId);
      pageToken = d.nextPageToken || '';
    } while (pageToken && ids.length < 200);
    const details = (await videoDetails(ids)).filter((d) => d.embeddable && !d.live);
    if (details.length) {
      try {
        const pl = await ytApi('playlists', { part: 'snippet', id: p.listId });
        title = decodeEntities((((pl.items || [])[0] || {}).snippet || {}).title || '');
      } catch (e) { /* không quan trọng */ }
      return { playlist: { title, items: details } };
    }
  }
  if (!p.videoId) {
    throw httpError(400, hasKey ? 'Danh sách phát trống hoặc ở chế độ riêng tư.'
      : 'Thêm cả danh sách phát cần có khóa YouTube API. Hãy dán link từng bài.');
  }
  if (hasKey) {
    try {
      const [d] = await videoDetails([p.videoId]);
      if (!d) throw httpError(404, 'Không tìm thấy video (đã xóa hoặc ở chế độ riêng tư).');
      if (!d.embeddable) throw httpError(400, 'Video này không cho phát nhúng ngoài YouTube (chủ kênh đã tắt).');
      return { video: d };
    } catch (e) {
      if (e.status === 404 || (e.status === 400 && !e.code)) throw e;
      // hết lượt API: lấy thông tin bằng oEmbed (không tốn lượt)
    }
  }
  return { video: await oembedInfo(p.videoId) };
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                 */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
};
const UPLOAD_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-m4v': '.m4v',
};

function httpError(status, message, code) {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, 'Dữ liệu quá lớn'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readBody(req, 1024 * 1024);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (e) {
    throw httpError(400, 'JSON không hợp lệ');
  }
}

function pinOk(req) {
  const pin = controlPin();
  if (!pin) return true;
  const given = String(req.headers['x-pin'] || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(pin).digest();
  return crypto.timingSafeEqual(a, b);
}

function requirePin(req) {
  if (!pinOk(req)) throw httpError(403, 'Cần mã quản lý để dùng chức năng này', 'pin');
}

function lanUrls() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      if (/^169\.254\./.test(a.address)) continue;
      if (/vEthernet|VirtualBox|VMware|docker|br-|veth|ZeroTier|Hyper-V/i.test(name)) continue;
      out.push(`http://${a.address}:${PORT}`);
    }
  }
  out.sort((x, y) => (/\/\/192\.168\./.test(y) ? 1 : 0) - (/\/\/192\.168\./.test(x) ? 1 : 0));
  if (!out.length) out.push(`http://localhost:${PORT}`);
  return out;
}

function removeUploads(keep) {
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    if (/^standby-/.test(f) && f !== keep) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
  }
}

async function handleUpload(req, res) {
  requirePin(req);
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = UPLOAD_EXT[type];
  if (!ext) throw httpError(400, 'Chỉ nhận ảnh (JPG, PNG, GIF, WEBP) hoặc video (MP4, WEBM, MOV)');
  const len = parseInt(req.headers['content-length'], 10) || 0;
  if (len > MAX_UPLOAD) throw httpError(413, 'File quá lớn (tối đa 300 MB)');
  const name = `standby-${Date.now()}${ext}`;
  const tmp = path.join(UPLOAD_DIR, name + '.part');
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_UPLOAD) {
        req.destroy();
        out.destroy();
        reject(httpError(413, 'File quá lớn (tối đa 300 MB)'));
      }
    });
    req.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    req.pipe(out);
  }).catch(async (e) => {
    await fsp.rm(tmp, { force: true });
    throw e;
  });
  removeUploads(name + '.part');
  await fsp.rename(tmp, path.join(UPLOAD_DIR, name));
  state.standby = { type: type.startsWith('video/') ? 'video' : 'image', src: '/uploads/' + name, ver: state.standby.ver + 1 };
  broadcastState();
  sendJson(res, 200, { ok: true, standby: state.standby });
}

function serveFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Không tìm thấy');
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Cache-Control': file.startsWith(UPLOAD_DIR) ? 'public, max-age=86400' : 'no-cache',
      'Accept-Ranges': 'bytes',
      'Last-Modified': st.mtime.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? parseInt(range[1], 10) : st.size - parseInt(range[2], 10);
      let end = range[1] && range[2] ? parseInt(range[2], 10) : st.size - 1;
      start = Math.max(0, start);
      end = Math.min(end, st.size - 1);
      if (start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        res.end();
        return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function safeJoin(base, p) {
  let rel;
  try {
    rel = decodeURIComponent(p);
  } catch (e) {
    return null;
  }
  if (rel.includes('\0')) return null;
  const full = path.resolve(base, '.' + path.posix.normalize('/' + rel));
  return full.startsWith(base + path.sep) || full === base ? full : null;
}

const PAGES = { '/': 'index.html', '/led': 'led.html', '/man-hinh': 'led.html' };

async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const client = { res, role: url.searchParams.get('role') === 'display' ? 'display' : 'controller' };
    clients.add(client);
    send(client, 'state', publicState());
    if (client.role === 'display') broadcastState();
    req.on('close', () => {
      clients.delete(client);
      if (client.role === 'display') broadcastState();
    });
    return;
  }

  if (p.startsWith('/api/')) {
    if (req.method === 'GET' && p === '/api/state') return sendJson(res, 200, publicState());

    if (req.method === 'GET' && p === '/api/search') {
      const q = cleanText(url.searchParams.get('q'), 100);
      if (!q) throw httpError(400, 'Nhập tên bài hát cần tìm');
      return sendJson(res, 200, await searchYouTube(q, cleanText(url.searchParams.get('pageToken'), 100)));
    }

    if (req.method === 'GET' && p === '/api/link') {
      return sendJson(res, 200, await linkInfo(url.searchParams.get('url')));
    }

    if (req.method === 'POST' && p === '/api/check-pin') {
      const body = await readJsonBody(req);
      const ok = pinOk({ headers: { 'x-pin': String(body.pin || '') } });
      return sendJson(res, ok ? 200 : 403, { ok, pinRequired: !!controlPin() });
    }

    if (req.method === 'POST' && p === '/api/action') {
      const a = await readJsonBody(req);
      const fn = Object.prototype.hasOwnProperty.call(actions, a.type) ? actions[a.type] : null;
      if (!fn) throw httpError(400, 'Lệnh không hợp lệ');
      if (!GUEST_ACTIONS.has(a.type)) requirePin(req);
      else if (a.next && !pinOk(req)) a.next = false; // khách không được chen lên đầu danh sách
      const result = fn(a) || {};
      broadcastState();
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (req.method === 'POST' && p === '/api/upload') return handleUpload(req, res);

    // Báo cáo từ màn hình LED
    if (req.method === 'POST' && p.startsWith('/api/display/')) {
      const a = await readJsonBody(req);
      const cur = state.current;
      const same = cur && a.playId === cur.playId;
      if (p === '/api/display/status') {
        if (same) {
          const dur = Number(a.duration) || 0;
          if (dur > 0 && Math.abs(dur - state.playback.duration) > 1) {
            state.playback.duration = dur;
            if (!cur.duration) cur.duration = Math.round(dur);
          }
          const t = Number(a.time);
          if (isFinite(t) && state.playback.status === 'playing' && a.playing) {
            state.playback.position = t;
            state.playback.at = Date.now();
          }
          broadcast('progress', {
            playId: cur.playId, position: currentPosition(), duration: state.playback.duration,
            status: state.playback.status, buffering: !!a.buffering,
          }, 'controller');
        }
      } else if (p === '/api/display/ended') {
        if (same) {
          onEnded();
          broadcastState();
        }
      } else if (p === '/api/display/error') {
        if (same) {
          const code = parseInt(a.code, 10) || 0;
          const why = code === 101 || code === 150 || code === 153
            ? 'chủ kênh không cho phát ngoài YouTube'
            : code === 100 ? 'video đã bị xóa hoặc riêng tư' : 'lỗi phát video (mã ' + code + ')';
          notice(`Bỏ qua "${cur.title}": ${why}.`, 'warn');
          state.current = null;
          startNext();
          broadcastState();
        }
      } else {
        throw httpError(404, 'Không có');
      }
      return sendJson(res, 200, { ok: true });
    }

    throw httpError(404, 'Không có chức năng này');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, 'Không hỗ trợ');

  if (p.startsWith('/uploads/')) {
    const file = safeJoin(UPLOAD_DIR, p.slice('/uploads/'.length));
    if (!file) throw httpError(404, 'Không có');
    return serveFile(req, res, file);
  }
  const file = safeJoin(PUBLIC_DIR, PAGES[p] || p);
  if (!file) throw httpError(404, 'Không có');
  return serveFile(req, res, file);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    const status = err.status || 500;
    if (status >= 500 && !err.status) console.error(err);
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, status, { ok: false, error: err.message || 'Lỗi máy chủ', code: err.code || '' });
  });
});
server.requestTimeout = 0; // tải video màn hình chờ có thể lâu

server.listen(PORT, HOST, () => {
  const urls = lanUrls();
  console.log('');
  console.log('  ==============================================');
  console.log(`   ${settings.appName} dang chay`);
  console.log('  ==============================================');
  console.log(`   Dieu khien (may nay) : http://localhost:${PORT}`);
  for (const u of urls) console.log(`   Dieu khien (dien thoai): ${u}`);
  console.log(`   Man hinh LED          : http://localhost:${PORT}/led`);
  console.log(`   Khoa YouTube API      : ${allKeys().length ? allKeys().length + ' khoa' : 'CHUA CO (chi dan link duoc)'}`);
  console.log(`   Ma quan ly (PIN)      : ${controlPin() ? 'CO' : 'khong dat'}`);
  console.log('   Dong cua so nay = tat phan mem.');
  console.log('');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Cong ${PORT} dang bi chuong trinh khac dung. Doi PORT trong file .env hoac tat chuong trinh do.`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

function shutdown() {
  clearTimeout(saveStateTimer);
  writeJson(path.join(DATA_DIR, 'state.json'), state);
  clearTimeout(saveCacheTimer);
  writeJson(path.join(DATA_DIR, 'cache.json'), Object.fromEntries(searchCache));
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/* ------------------------------------------------------------------ */
/* Tiện ích                                                             */
/* ------------------------------------------------------------------ */

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, obj, indent) {
  try {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, indent));
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error('Khong ghi duoc ' + file + ': ' + e.message);
  }
}

function loadEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return;
  }
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
