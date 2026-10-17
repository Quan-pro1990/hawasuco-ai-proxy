/* Giọng nói tiếng Việt (Web Speech API) và âm báo (Web Audio). */
import { caiDat } from './kho.js';
import { laAppGoc, guiGoc } from './cau-noi.js';

const coTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
let giong = null;
let amThanh = null;

function chonGiong() {
  if (!coTTS) return;
  const ds = danhSachGiong();
  giong = ds.find(v => v.name === caiDat.tenGiong) || ds.find(v => /google|natural|online/i.test(v.name)) || ds[0] || null;
}
if (coTTS) {
  chonGiong();
  speechSynthesis.addEventListener('voiceschanged', chonGiong);
}

export function danhSachGiong() {
  return coTTS ? speechSynthesis.getVoices().filter(v => /^vi/i.test(v.lang)) : [];
}

export function doiGiong() { chonGiong(); }

export function coGiongNoi() { return coTTS || laAppGoc; }

/** Đọc một câu. `chen`: ngắt câu đang đọc (cảnh báo khẩn). */
export function noi(vanBan, { chen = false, batBuoc = false } = {}) {
  if (!vanBan || (!caiDat.giongNoi && !batBuoc)) return;
  // trong ứng dụng gốc: đọc bằng giọng của hệ điều hành (ra loa xe qua Android Auto / CarPlay)
  if (laAppGoc) { guiGoc('noi', { chu: vanBan, chen, amLuong: caiDat.amLuong, toc: caiDat.tocDoNoi }); return; }
  if (!coTTS) return;
  if (chen) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(vanBan);
  u.lang = 'vi-VN';
  if (giong) u.voice = giong;
  u.volume = caiDat.amLuong;
  u.rate = caiDat.tocDoNoi;
  speechSynthesis.speak(u);
}

export function imLang() {
  if (laAppGoc) guiGoc('imLang');
  else if (coTTS) speechSynthesis.cancel();
}

/** Trình duyệt điện thoại chỉ cho phát tiếng sau một lần chạm: gọi trong sự kiện bấm nút. */
export function moKhoaAmThanh() {
  try {
    if (!amThanh) amThanh = new (window.AudioContext || window.webkitAudioContext)();
    if (amThanh.state === 'suspended') amThanh.resume();
  } catch (e) { /* không hỗ trợ */ }
  if (coTTS && !moKhoaAmThanh.xong) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    moKhoaAmThanh.xong = true;
  }
}

function tieng(tanSo, batDau, dai, am) {
  const o = amThanh.createOscillator(), g = amThanh.createGain();
  o.type = 'sine';
  o.frequency.value = tanSo;
  g.gain.setValueAtTime(0, batDau);
  g.gain.linearRampToValueAtTime(am, batDau + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, batDau + dai);
  o.connect(g).connect(amThanh.destination);
  o.start(batDau);
  o.stop(batDau + dai + 0.02);
}

/** Âm báo: 'vuottoc' (bíp bíp gấp), 'canhbao' (ding-dong), 'den' (hai nốt lên). */
export function bip(loai = 'canhbao') {
  if (!amThanh || amThanh.state !== 'running') return;
  const t = amThanh.currentTime + 0.02;
  const am = 0.35 * caiDat.amLuong;
  if (loai === 'vuottoc') { tieng(1320, t, 0.12, am); tieng(1320, t + 0.18, 0.12, am); }
  else if (loai === 'den') { tieng(660, t, 0.18, am); tieng(990, t + 0.2, 0.3, am); }
  else { tieng(988, t, 0.25, am); tieng(740, t + 0.28, 0.4, am); }
}
