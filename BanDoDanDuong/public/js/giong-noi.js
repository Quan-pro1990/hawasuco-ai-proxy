/* Giọng nói tiếng Việt (Web Speech API) và âm báo (Web Audio). */
import { caiDat } from './kho.js';
import { laAppGoc, nenTang, guiGoc } from './cau-noi.js';

const coTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
let giong = null;
let amThanh = null;

function chonGiong() {
  if (!coTTS) return;
  const ds = danhSachGiong();
  // giọng người dùng chọn; không thì giọng tiếng Việt chất lượng cao (Google, Natural, online), rồi giọng có sẵn trong máy
  giong = ds.find(v => v.name === caiDat.tenGiong) || ds.find(v => /google|natural|online/i.test(v.name)) ||
    ds.find(v => v.localService) || ds[0] || null;
}
if (coTTS) {
  chonGiong();
  speechSynthesis.addEventListener('voiceschanged', chonGiong);
}

export function danhSachGiong() {
  return coTTS ? speechSynthesis.getVoices().filter(v => /^vi/i.test(v.lang)) : [];
}

export function doiGiong() {
  if (laAppGoc) guiGoc('chonGiong', { ten: caiDat.tenGiong || '' });
  else chonGiong();
}

export function coGiongNoi() { return coTTS || laAppGoc; }

// ------------------------------------------------------------------ giọng của ứng dụng gốc (Android)
/** { tiengViet, dangDo, may, giong, chon, ds: [{ ten, canMang }] } do ứng dụng Android gửi lên; null nếu chưa có. */
let giongGoc = null;
export function datGiongGoc(tt) { giongGoc = tt; }
export function trangThaiGiongGoc() { return giongGoc; }

/**
 * Có giọng tiếng Việt để đọc không: true / false; null nếu chưa biết (đang dò, trình duyệt chưa tải danh sách giọng).
 */
export function coTiengViet() {
  if (laAppGoc && nenTang === 'ios') return true;           // iPhone luôn có giọng tiếng Việt
  if (laAppGoc) return giongGoc ? (giongGoc.dangDo ? null : !!giongGoc.tiengViet) : null;
  if (!coTTS) return false;
  if (!speechSynthesis.getVoices().length) return null;
  return danhSachGiong().length > 0;
}

// ------------------------------------------------------------------ đọc cho đúng tiếng Việt
// ranh giới từ không dùng lookbehind (Safari cũ không hỗ trợ): giữ ký tự đứng trước trong nhóm 1
const TRUOC = '(^|[^\\p{L}\\p{N}])';
const SAU = '(?![\\p{L}\\p{N}])';
const VIET_TAT_DOC = [
  // số hiệu đường trong tên đường OpenStreetMap: QL1A, QL.32, ĐT 420, TL10, ĐH.05, CT.01, AH1
  ['QL\\.?\\s*(\\d+[A-Z]?)', 'quốc lộ'], ['ĐT\\.?\\s*(\\d+[A-Z]?)', 'đường tỉnh'], ['TL\\.?\\s*(\\d+[A-Z]?)', 'tỉnh lộ'],
  ['ĐH\\.?\\s*(\\d+[A-Z]?)', 'đường huyện'], ['CT\\.?\\s*(\\d+[A-Z]?)', 'cao tốc'], ['AH\\s*(\\d+)', 'đường châu Á'],
  ['ĐCT\\.?\\s*(\\d+[A-Z]?)', 'đường cao tốc']
].map(([mau, chu]) => [new RegExp(TRUOC + mau + SAU, 'gu'), (_, a, so) => `${a}${chu} ${so}`]);
const TU_VIET_TAT = [
  ['km\\/h', 'ki lô mét trên giờ'], ['Ng\\.', 'ngõ'], ['Ngh\\.', 'ngách'], ['Đ\\.', 'đường'], ['TP\\.', 'thành phố'],
  ['TX\\.', 'thị xã'], ['TT\\.', 'thị trấn'], ['P\\.', 'phường'], ['Q\\.', 'quận'], ['H\\.', 'huyện'], ['KCN', 'khu công nghiệp'],
  ['KĐT', 'khu đô thị'], ['BV', 'bệnh viện'], ['THPT', 'trung học phổ thông'], ['THCS', 'trung học cơ sở'], ['ĐH', 'đại học']
].map(([mau, chu]) => [new RegExp(TRUOC + mau + '(?=\\s|$|[,.;:)])', 'gu'), (_, a) => `${a}${chu}`]);

/**
 * Câu đọc lên: chữ viết tắt trong tên đường, địa danh (OpenStreetMap) đọc thành chữ đầy đủ để giọng tiếng Việt đọc đúng.
 * "Trần Phú (QL6)" → "Trần Phú, quốc lộ 6"; "50 km/h" → "50 ki lô mét trên giờ"; "300 m" → "300 mét".
 */
export function docTiengViet(cau) {
  let s = String(cau || '');
  for (const [m, f] of VIET_TAT_DOC) s = s.replace(m, f);
  for (const [m, f] of TU_VIET_TAT) s = s.replace(m, f);
  s = s.replace(/(\d)\s*km(?![\p{L}\p{N}])/gu, '$1 ki lô mét').replace(/(\d)\s*m(?![\p{L}\p{N}])/gu, '$1 mét');
  // dấu ngoặc đọc thành chỗ ngắt
  s = s.replace(/\s*\(\s*/g, ', ').replace(/\s*\)\s*/g, ', ');
  return s.replace(/\s*,\s*(?=[,.!?;:]|$)/g, '').replace(/\s+([,.!?;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** Đọc một câu. `chen`: ngắt câu đang đọc (cảnh báo khẩn). */
export function noi(vanBan, { chen = false, batBuoc = false } = {}) {
  if (!vanBan || (!caiDat.giongNoi && !batBuoc)) return;
  vanBan = docTiengViet(vanBan);
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
