/*
 * Luật trên con đường, đọc từ thẻ OpenStreetMap: phương tiện bị cấm (kể cả cấm theo giờ, thẻ ":conditional"),
 * đường một chiều, cấm dừng / đỗ, cấm vượt; và biển báo Việt Nam gắn trên nút (traffic_sign=VN:…, mã theo QCVN 41:2019/BGTVT).
 */

const NGAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MA_NGAY = '(?:Mo|Tu|We|Th|Fr|Sa|Su)';
const KHOANG_GIO = '\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}';
const QUY_TAC = new RegExp(`^(${MA_NGAY}(?:-${MA_NGAY})?(?:\\s*,\\s*${MA_NGAY}(?:-${MA_NGAY})?)*)?\\s*(${KHOANG_GIO}(?:\\s*,\\s*${KHOANG_GIO})*)?$`);

function phut(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function hopNgay(dsNgay, thu) {
  return dsNgay.split(',').some(p => {
    const [a, b] = p.trim().split('-').map(x => NGAY.indexOf(x));
    if (b === undefined) return a === thu;
    return a <= b ? thu >= a && thu <= b : thu >= a || thu <= b;
  });
}

/**
 * Điều kiện thời gian kiểu opening_hours đơn giản ("Mo-Fr 06:00-09:00,16:00-19:00", "Sa,Su", "22:00-05:00")
 * có đúng vào lúc `luc` không. Điều kiện khác (thời tiết, trọng tải…) hoặc không đọc được: null.
 */
export function trongDieuKien(dk, luc = new Date()) {
  const thu = luc.getDay(), bayGio = luc.getHours() * 60 + luc.getMinutes();
  let coQuyTac = false;
  for (const qt of String(dk).split(';').map(s => s.trim()).filter(Boolean)) {
    const m = QUY_TAC.exec(qt);
    if (!m || (!m[1] && !m[2])) return null;
    coQuyTac = true;
    if (m[1] && !hopNgay(m[1].replace(/\s/g, ''), thu)) continue;
    if (!m[2]) return true;
    for (const k of m[2].split(',')) {
      const [a, b] = k.trim().split('-').map(phut);
      if (a <= b ? bayGio >= a && bayGio < b : bayGio >= a || bayGio < b) return true;
    }
  }
  return coQuyTac ? false : null;
}

/** "no @ (06:00-09:00); yes @ (Su)" → [{ giaTri, dieuKien }]. */
export function docConditional(s) {
  const kq = [];
  for (const m of String(s || '').matchAll(/([^;@]+?)\s*@\s*(\([^)]*\)|[^;]+)/g)) {
    kq.push({ giaTri: m[1].trim(), dieuKien: m[2].trim().replace(/^\(|\)$/g, '') });
  }
  return kq;
}

/** Giá trị thẻ `khoa` vào lúc `luc`: thẻ ":conditional" đang có hiệu lực được ưu tiên. */
export function giaTriLuc(tags, khoa, luc = new Date()) {
  for (const c of docConditional(tags[khoa + ':conditional'])) {
    if (trongDieuKien(c.dieuKien, luc) === true) return { giaTri: c.giaTri, dieuKien: c.dieuKien };
  }
  return tags[khoa] != null ? { giaTri: tags[khoa], dieuKien: null } : null;
}

const THU_BAC = { oto: ['motorcar', 'motor_vehicle', 'vehicle', 'access'], xemay: ['motorcycle', 'motor_vehicle', 'vehicle', 'access'] };
const TEN_XE = { oto: 'ô tô', xemay: 'xe máy' };

/**
 * Con đường cấm phương tiện đang đi? Thẻ cụ thể hơn được ưu tiên (motorcar → motor_vehicle → vehicle → access).
 * Xe máy không được vào đường cao tốc. @returns null hoặc { ten, nghe, dieuKien }
 */
export function camPhuongTien(tags, phuongTien, luc = new Date()) {
  const bac = THU_BAC[phuongTien];
  if (!bac) return null;
  if (phuongTien === 'xemay' && /^motorway/.test(tags.highway || '')) {
    return { ten: 'Cao tốc cấm xe máy', nghe: 'đường cao tốc cấm xe máy', dieuKien: null };
  }
  for (const k of bac) {
    const v = giaTriLuc(tags, k, luc);
    if (!v) continue;
    if (v.giaTri !== 'no') return null;
    const gio = v.dieuKien ? ` (${v.dieuKien})` : '';
    return { ten: `Đường cấm ${TEN_XE[phuongTien]}${gio}`, nghe: `đường cấm ${TEN_XE[phuongTien]}${v.dieuKien ? ' trong giờ này' : ''}`, dieuKien: v.dieuKien };
  }
  return null;
}

/** Chiều được đi của đường: 1 (theo chiều vẽ đường), -1 (ngược chiều vẽ), 0 (hai chiều). */
export function chieuMotChieu(tags, phuongTien) {
  if (phuongTien === 'xemay' && (tags['oneway:motorcycle'] === 'no' || tags['oneway:moped'] === 'no')) return 0;
  if (phuongTien === 'xedap' && tags['oneway:bicycle'] === 'no') return 0;
  let ow = tags.oneway;
  if (ow == null && (tags.junction === 'roundabout' || tags.junction === 'circular' || tags.highway === 'motorway')) ow = 'yes';
  if (ow === 'yes' || ow === 'true' || ow === '1') return 1;
  if (ow === '-1' || ow === 'reverse') return -1;
  return 0;
}

/** Đang đi ngược chiều đường một chiều? `xuoi`: đang đi theo chiều vẽ đường. */
export function diNguocChieu(tags, xuoi, phuongTien) {
  const c = chieuMotChieu(tags, phuongTien);
  return c === 1 ? !xuoi : c === -1 ? !!xuoi : false;
}

/**
 * Cấm dừng / đỗ bên phải chiều đang đi (Việt Nam đi bên phải): 'camdung' (cấm dừng và đỗ), 'camdo' (cấm đỗ) hoặc null.
 * Đọc cả kiểu thẻ mới (parking:right=no, parking:right:restriction=no_stopping) và cũ (parking:lane:*, parking:condition:*).
 */
export function camDungDo(tags, xuoi, luc = new Date()) {
  const ben = xuoi ? 'right' : 'left';
  for (const s of [ben, 'both']) {
    let han = tags[`parking:${s}:restriction`] || tags[`parking:condition:${s}`] || tags[`parking:lane:${s}`];
    for (const c of docConditional(tags[`parking:${s}:restriction:conditional`])) {
      if (trongDieuKien(c.dieuKien, luc) === true) han = c.giaTri;
    }
    if (/no_stopping|no_standing|fire_lane/.test(han || '')) return 'camdung';
    if (/no_parking/.test(han || '')) return 'camdo';
    if (tags[`parking:${s}`] === 'no' || tags[`parking:lane:${s}`] === 'no') return 'camdo';
  }
  return null;
}

/** Đoạn cấm vượt theo chiều đang đi (overtaking=no, overtaking:forward / backward). */
export function camVuot(tags, xuoi) {
  const v = tags[xuoi ? 'overtaking:forward' : 'overtaking:backward'] || tags.overtaking;
  return v === 'no';
}

/**
 * Biển báo Việt Nam nhận biết được (QCVN 41:2019/BGTVT): mã (bỏ dấu chấm, chữ hoa) → loại cảnh báo (loai-canh-bao.js).
 * icon: hình biển trên bản đồ (bieu-tuong.js); nghe: câu đọc; xe: chỉ áp dụng cho loại xe đó; ngay: chẵn / lẻ;
 * het: biển hết hiệu lực; so: biển ghi số (tocdo km/h, hettocdo, tai = tấn, cao = mét) — "{}" trong ten / nghe là số đó.
 */
export const BIEN_VN = {
  // biển cấm: đường cấm, cấm phương tiện
  P101: { loai: 'duongcam', ten: 'Đường cấm', nghe: 'đường cấm', icon: 'duongcam' },
  P102: { loai: 'duongcam', ten: 'Cấm đi ngược chiều', nghe: 'biển cấm đi ngược chiều', icon: 'camduong' },
  P103A: { loai: 'duongcam', ten: 'Cấm ô tô', nghe: 'đường cấm ô tô', icon: 'camoto', xe: 'oto' },
  P104: { loai: 'duongcam', ten: 'Cấm mô tô', nghe: 'đường cấm xe máy', icon: 'cammoto', xe: 'xemay' },
  P110A: { loai: 'duongcam', ten: 'Cấm xe đạp', nghe: 'đường cấm xe đạp', icon: 'camxedap', xe: 'xedap' },
  P111A: { loai: 'duongcam', ten: 'Cấm xe gắn máy', nghe: 'đường cấm xe gắn máy', icon: 'cammoto', xe: 'xemay' },
  P112: { loai: 'duongcam', ten: 'Cấm người đi bộ', nghe: 'đường cấm người đi bộ', icon: 'camdibo', xe: 'dibo' },
  // cấm vượt, cấm dừng / đỗ
  P125: { loai: 'camvuot', ten: 'Cấm vượt', nghe: 'biển cấm vượt', icon: 'camvuot' },
  DP133: { loai: 'camvuot', ten: 'Hết đoạn cấm vượt', nghe: 'hết đoạn cấm vượt', icon: 'hetcamvuot', het: true },
  P130: { loai: 'camdungdo', ten: 'Cấm dừng và đỗ xe', nghe: 'biển cấm dừng và đỗ xe', icon: 'camdungdo' },
  P131A: { loai: 'camdungdo', ten: 'Cấm đỗ xe', nghe: 'biển cấm đỗ xe', icon: 'camdo' },
  P131B: { loai: 'camdungdo', ten: 'Cấm đỗ xe ngày lẻ', nghe: 'biển cấm đỗ xe ngày lẻ', icon: 'camdole', ngay: 'le' },
  P131C: { loai: 'camdungdo', ten: 'Cấm đỗ xe ngày chẵn', nghe: 'biển cấm đỗ xe ngày chẵn', icon: 'camdochan', ngay: 'chan' },
  // biển cấm khác, biển hiệu lệnh STOP
  P103B: { loai: 'biencam', ten: 'Cấm ô tô rẽ phải', nghe: 'biển cấm ô tô rẽ phải', icon: 'camrephai', xe: 'oto' },
  P103C: { loai: 'biencam', ten: 'Cấm ô tô rẽ trái', nghe: 'biển cấm ô tô rẽ trái', icon: 'camretrai', xe: 'oto' },
  P115: { loai: 'biencam', ten: 'Hạn chế tải trọng {} tấn', nghe: 'biển hạn chế tải trọng {} tấn', icon: 'tai', so: 'tai' },
  P117: { loai: 'biencam', ten: 'Hạn chế chiều cao {} m', nghe: 'biển hạn chế chiều cao {} mét', icon: 'cao', so: 'cao' },
  P123A: { loai: 'biencam', ten: 'Cấm rẽ trái', nghe: 'biển cấm rẽ trái', icon: 'camretrai' },
  P123B: { loai: 'biencam', ten: 'Cấm rẽ phải', nghe: 'biển cấm rẽ phải', icon: 'camrephai' },
  P124A: { loai: 'biencam', ten: 'Cấm quay đầu xe', nghe: 'biển cấm quay đầu xe', icon: 'camquaydau' },
  P124B: { loai: 'biencam', ten: 'Cấm ô tô quay đầu xe', nghe: 'biển cấm ô tô quay đầu xe', icon: 'camquaydau', xe: 'oto' },
  P128: { loai: 'biencam', ten: 'Cấm sử dụng còi', nghe: 'biển cấm bóp còi', icon: 'camcoi' },
  P136: { loai: 'biencam', ten: 'Cấm đi thẳng', nghe: 'biển cấm đi thẳng', icon: 'camdithang' },
  DP135: { loai: 'biencam', ten: 'Hết tất cả các lệnh cấm', nghe: 'hết tất cả các lệnh cấm', icon: 'hetcam', het: true },
  R122: { loai: 'biencam', ten: 'Dừng lại (STOP)', nghe: 'biển dừng lại', icon: 'stop' },
  // tốc độ tối đa ghi trên biển
  P127: { loai: 'bientocdo', ten: 'Tốc độ tối đa {} km/h', nghe: 'biển tốc độ tối đa {} ki lô mét trên giờ', icon: 'tocdo', so: 'tocdo' },
  DP134: { loai: 'bientocdo', ten: 'Hết hạn chế tốc độ {} km/h', nghe: 'hết hạn chế tốc độ tối đa', icon: 'hettocdo', so: 'hettocdo', het: true },
  // biển báo nguy hiểm (tam giác vàng)
  W201A: { loai: 'biennguyhiem', ten: 'Chỗ ngoặt nguy hiểm bên trái', nghe: 'chỗ ngoặt nguy hiểm bên trái', icon: 'w-cuatrai' },
  W201B: { loai: 'biennguyhiem', ten: 'Chỗ ngoặt nguy hiểm bên phải', nghe: 'chỗ ngoặt nguy hiểm bên phải', icon: 'w-cuaphai' },
  W202A: { loai: 'biennguyhiem', ten: 'Nhiều chỗ ngoặt nguy hiểm liên tiếp', nghe: 'nhiều chỗ ngoặt nguy hiểm liên tiếp', icon: 'w-cuakep' },
  W202B: { loai: 'biennguyhiem', ten: 'Nhiều chỗ ngoặt nguy hiểm liên tiếp', nghe: 'nhiều chỗ ngoặt nguy hiểm liên tiếp', icon: 'w-cuakep' },
  W203A: { loai: 'biennguyhiem', ten: 'Đường bị hẹp cả hai bên', nghe: 'đường bị hẹp', icon: 'w-hep' },
  W203B: { loai: 'biennguyhiem', ten: 'Đường bị hẹp về phía trái', nghe: 'đường bị hẹp bên trái', icon: 'w-hep' },
  W203C: { loai: 'biennguyhiem', ten: 'Đường bị hẹp về phía phải', nghe: 'đường bị hẹp bên phải', icon: 'w-hep' },
  W205A: { loai: 'biennguyhiem', ten: 'Đường giao nhau', nghe: 'đường giao nhau', icon: 'w-giaonhau' },
  W205B: { loai: 'biennguyhiem', ten: 'Đường giao nhau', nghe: 'đường giao nhau', icon: 'w-giaonhau' },
  W205C: { loai: 'biennguyhiem', ten: 'Đường giao nhau', nghe: 'đường giao nhau', icon: 'w-giaonhau' },
  W205D: { loai: 'biennguyhiem', ten: 'Đường giao nhau', nghe: 'đường giao nhau', icon: 'w-giaonhau' },
  W205E: { loai: 'biennguyhiem', ten: 'Đường giao nhau', nghe: 'đường giao nhau', icon: 'w-giaonhau' },
  W207: { loai: 'biennguyhiem', ten: 'Giao nhau với đường không ưu tiên', nghe: 'giao nhau với đường không ưu tiên', icon: 'w-uutien' },
  W208: { loai: 'biennguyhiem', ten: 'Giao nhau với đường ưu tiên', nghe: 'giao nhau với đường ưu tiên, chú ý nhường đường', icon: 'nhuong' },
  W209: { loai: 'biennguyhiem', ten: 'Giao nhau có tín hiệu đèn', nghe: 'giao nhau có đèn tín hiệu', icon: 'w-den' },
  W210: { loai: 'biennguyhiem', ten: 'Giao nhau với đường sắt có rào chắn', nghe: 'giao nhau với đường sắt có rào chắn', icon: 'w-raochan' },
  W211A: { loai: 'biennguyhiem', ten: 'Giao nhau với đường sắt không có rào chắn', nghe: 'giao nhau với đường sắt không có rào chắn', icon: 'w-tau' },
  W219: { loai: 'biennguyhiem', ten: 'Dốc xuống nguy hiểm', nghe: 'dốc xuống nguy hiểm', icon: 'w-docxuong' },
  W220: { loai: 'biennguyhiem', ten: 'Dốc lên nguy hiểm', nghe: 'dốc lên nguy hiểm', icon: 'w-doclen' },
  W221A: { loai: 'biennguyhiem', ten: 'Đường có ổ gà, lồi lõm', nghe: 'đường có ổ gà, lồi lõm', icon: 'w-xoc' },
  W221B: { loai: 'biennguyhiem', ten: 'Đường có gồ giảm tốc', nghe: 'đường có gồ giảm tốc', icon: 'w-go' },
  W224: { loai: 'biennguyhiem', ten: 'Đường người đi bộ cắt ngang', nghe: 'đường người đi bộ cắt ngang', icon: 'w-dibo' },
  W225: { loai: 'biennguyhiem', ten: 'Trẻ em', nghe: 'biển trẻ em, chú ý giảm tốc độ', icon: 'w-treem' },
  W227: { loai: 'biennguyhiem', ten: 'Công trường', nghe: 'công trường', icon: 'w-congtruong' },
  W233: { loai: 'biennguyhiem', ten: 'Nguy hiểm khác', nghe: 'biển báo nguy hiểm', icon: 'w-cham' },
  W245A: { loai: 'biennguyhiem', ten: 'Đi chậm', nghe: 'biển đi chậm', icon: 'w-dicham' }
};

/** Biển nhiều kiểu con dùng chung một nghĩa (W.207a…l: giao nhau với đường không ưu tiên). */
const BIEN_GOP = { W207: /^W207[A-L]$/ };

function maBien(ma) {
  if (BIEN_VN[ma]) return ma;
  for (const [goc, mau] of Object.entries(BIEN_GOP)) if (mau.test(ma)) return goc;
  return null;
}

/**
 * Các biển báo Việt Nam trong thẻ traffic_sign kèm số ghi trên biển nếu có
 * ("VN:P.127[50];VN:W.207a" → [{ ma: 'P127', so: 50 }, { ma: 'W207', so: null }]); chỉ lấy biển đã biết.
 */
export function docBienBaoChiTiet(s) {
  const kq = [];
  for (const phan of String(s || '').split(/;|,(?![^[]*\])/)) {
    const m = /^\s*VN:\s*([A-Za-z]{0,2})[.\s-]*(\d{3})([a-zA-Z]?)\s*(?:\[\s*(\d+(?:[.,]\d+)?)\s*\])?/.exec(phan);
    if (!m) continue;
    const ma = maBien((m[1] || 'P').toUpperCase() + m[2] + m[3].toUpperCase());
    if (ma && !kq.some(b => b.ma === ma)) kq.push({ ma, so: m[4] ? +m[4].replace(',', '.') : null });
  }
  return kq;
}

/** Mã các biển báo Việt Nam trong thẻ traffic_sign ("VN:P.130;VN:P.131a" → ['P130', 'P131A']), chỉ lấy biển đã biết. */
export function docBienBao(s) {
  return docBienBaoChiTiet(s).map(b => b.ma);
}

/** Số ghi trên biển lấy từ thẻ khác của nút khi traffic_sign không ghi ([50]): maxspeed, maxweight, maxheight. */
export function soTuThe(kieu, t) {
  const v = kieu === 'tai' ? t.maxweight : kieu === 'cao' ? t.maxheight : t.maxspeed;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:t|m|km\/h)?\s*$/.exec(v || '');
  return m ? +m[1] : null;
}

/** Tên / câu đọc của biển có số ("Tốc độ tối đa {} km/h" + 50); số thập phân viết dấu phẩy. */
export function chuBien(mau, so) {
  return mau.replace('{}', so == null ? '' : String(so).replace('.', ','));
}

/** Biển cấm đỗ ngày chẵn / lẻ có áp dụng hôm nay không. */
export function apDungTheoNgay(ngay, luc = new Date()) {
  if (!ngay) return true;
  const le = luc.getDate() % 2 === 1;
  return ngay === 'le' ? le : !le;
}
