#!/usr/bin/env node
/*
 * Máy chủ "Chia sẻ vị trí trực tiếp" cho ứng dụng Lưu Vị Trí.
 * Không cần cài thư viện: chỉ cần Node.js 18 trở lên.
 *
 *   node live-server.js              (cổng mặc định 3000)
 *   PORT=8090 node live-server.js
 *
 * API (ứng dụng Android gọi):
 *   POST /api/live                 {id, token, name, expiresAt}      tạo phiên chia sẻ
 *   POST /api/live/:id/update      {token, lat, lng, acc, ts}        cập nhật vị trí
 *   POST /api/live/:id/stop        {token}                           dừng chia sẻ
 *   GET  /api/live/:id                                               vị trí mới nhất (cho trang xem)
 * Trang xem (gửi link này cho người khác):
 *   GET  /l/:id
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'live.json');
const MAX_SESSIONS = 5000;
const MAX_DURATION_MS = 24 * 3600 * 1000;   // tối đa 24 giờ một phiên
const KEEP_AFTER_END_MS = 2 * 3600 * 1000;  // giữ phiên đã kết thúc 2 giờ rồi xoá
const MAX_TRAIL = 300;                      // số điểm lưu lại để vẽ đường đi

/** @type {Map<string, any>} */
const sessions = new Map();

// ------------------------------------------------------------------ Lưu / nạp dữ liệu
function load() {
  try {
    const arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const s of arr) sessions.set(s.id, s);
    console.log(`Đã nạp ${sessions.size} phiên từ ${DATA_FILE}`);
  } catch (_) { /* chưa có file */ }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify([...sessions.values()]));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { console.error('Lỗi lưu dữ liệu:', e.message); }
  }, 2000);
}

function cleanup() {
  const now = Date.now();
  let changed = false;
  for (const [id, s] of sessions) {
    const end = s.stoppedAt || s.expiresAt;
    if (now - end > KEEP_AFTER_END_MS) { sessions.delete(id); changed = true; }
  }
  if (changed) scheduleSave();
}
setInterval(cleanup, 10 * 60 * 1000).unref();

// ------------------------------------------------------------------ Tiện ích
const ID_RE = /^[A-Za-z0-9]{6,40}$/;

function send(res, code, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 16 * 1024) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sameToken(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function isActive(s) { return !s.stoppedAt && s.expiresAt > Date.now(); }

function publicView(s) {
  return {
    name: s.name || '',
    active: isActive(s),
    expiresAt: s.expiresAt,
    stoppedAt: s.stoppedAt || null,
    last: s.last || null,
    trail: (s.trail || []).map((p) => [p.lat, p.lng]),
  };
}

// ------------------------------------------------------------------ Xử lý API
async function handleApi(req, res, parts) {
  // parts: ['api','live', id?, action?]
  const id = parts[2];
  const action = parts[3];

  if (req.method === 'GET' && id && !action) {
    const s = sessions.get(id);
    if (!s) return send(res, 404, { error: 'not_found' });
    return send(res, 200, publicView(s));
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });

  let body;
  try { body = await readJson(req); } catch (_) { return send(res, 400, { error: 'bad_json' }); }

  if (!id) {
    // Tạo phiên
    const { id: newId, token, name } = body;
    let expiresAt = Number(body.expiresAt);
    if (!ID_RE.test(String(newId || '')) || !ID_RE.test(String(token || ''))) return send(res, 400, { error: 'bad_id' });
    if (!Number.isFinite(expiresAt)) return send(res, 400, { error: 'bad_expiry' });
    expiresAt = Math.min(expiresAt, Date.now() + MAX_DURATION_MS);
    const existing = sessions.get(newId);
    if (existing && !sameToken(existing.token, token)) return send(res, 409, { error: 'exists' });
    if (!existing && sessions.size >= MAX_SESSIONS) { cleanup(); if (sessions.size >= MAX_SESSIONS) return send(res, 503, { error: 'full' }); }
    sessions.set(newId, {
      id: newId, token, name: String(name || '').slice(0, 60),
      createdAt: Date.now(), expiresAt, stoppedAt: null, last: null, trail: [],
    });
    scheduleSave();
    return send(res, 200, { ok: true, url: `/l/${newId}` });
  }

  const s = sessions.get(id);
  if (!s) return send(res, 404, { error: 'not_found' });
  if (!sameToken(s.token, body.token)) return send(res, 403, { error: 'forbidden' });

  if (action === 'update') {
    if (!isActive(s)) return send(res, 410, { error: 'ended' });
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return send(res, 400, { error: 'bad_coords' });
    const acc = Number(body.acc);
    const p = { lat, lng, acc: Number.isFinite(acc) ? Math.round(acc) : null, ts: Date.now() };
    s.last = p;
    const prev = s.trail[s.trail.length - 1];
    if (!prev || Math.abs(prev.lat - lat) > 1e-5 || Math.abs(prev.lng - lng) > 1e-5) {
      s.trail.push({ lat, lng });
      if (s.trail.length > MAX_TRAIL) s.trail.splice(0, s.trail.length - MAX_TRAIL);
    }
    scheduleSave();
    return send(res, 200, { ok: true });
  }
  if (action === 'stop') {
    s.stoppedAt = Date.now();
    scheduleSave();
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not_found' });
}

// ------------------------------------------------------------------ Trang xem
const VIEWER = fs.readFileSync(path.join(__dirname, 'viewer.html'), 'utf8');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'api' && parts[1] === 'live') return await handleApi(req, res, parts);
    if (req.method === 'GET' && parts[0] === 'l' && parts[1] && ID_RE.test(parts[1]) && parts.length === 2) {
      return send(res, 200, VIEWER, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, sessions: sessions.size });
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, '<!doctype html><meta charset="utf-8"><title>Live location</title><p>Máy chủ vị trí trực tiếp đang chạy.</p>', 'text/html; charset=utf-8');
    }
    send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'server' });
  }
});

load();
server.listen(PORT, HOST, () => console.log(`Máy chủ vị trí trực tiếp: http://${HOST}:${PORT}`));

module.exports = { server, sessions };
