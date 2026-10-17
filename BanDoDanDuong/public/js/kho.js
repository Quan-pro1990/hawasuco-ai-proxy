/* Lưu trữ trên máy: cài đặt, địa điểm đã lưu, lịch sử tìm kiếm (localStorage) và đoạn video camera (IndexedDB). */

const TIEN_TO = 'hawamap.';

export function doc(khoa, macDinh) {
  try {
    const v = localStorage.getItem(TIEN_TO + khoa);
    return v == null ? macDinh : JSON.parse(v);
  } catch (e) { return macDinh; }
}

export function ghi(khoa, giaTri) {
  try {
    if (giaTri === undefined) localStorage.removeItem(TIEN_TO + khoa);
    else localStorage.setItem(TIEN_TO + khoa, JSON.stringify(giaTri));
    return true;
  } catch (e) { return false; }
}

// ------------------------------------------------------------------ cài đặt
export const CAI_DAT_MAC_DINH = {
  // giọng nói
  giongNoi: true, amLuong: 1, tocDoNoi: 1, tenGiong: '',
  // cảnh báo
  canhBaoTocDo: true, nguongVuot: 5, bipVuotToc: true, uocTinhGioiHan: true,
  canhBaoCamera: true, kcCanhBaoCamera: 500, canhBaoDuongSat: true, canhBaoThuPhi: true, canhBaoBaoCao: true,
  // dẫn đường
  phuongTien: 'oto', tranhCaoToc: false, tranhThuPhi: false, giuManHinh: true, tuGhiHanhTrinh: true,
  // bản đồ
  kieuBanDo: 'tieuchuan', tuDongBanDem: true, nha3D: true, hienBaoCao: true, hienDiemCanhBao: true,
  // camera hành trình
  doDaiDoanCamera: 3, soDoanToiDa: 10, camGhiAm: false,
  // nâng cao
  mayChuBaoCao: '', khoaVietmap: '', styleVietmap: ''
};

export const caiDat = Object.assign({}, CAI_DAT_MAC_DINH, doc('caidat', {}));
const nguoiNghe = new Set();

export function doiCaiDat(thay) {
  Object.assign(caiDat, thay);
  ghi('caidat', caiDat);
  nguoiNghe.forEach(f => { try { f(thay); } catch (e) { console.error(e); } });
}

export function ngheDoiCaiDat(f) { nguoiNghe.add(f); }

export function khoiPhucCaiDat() {
  doiCaiDat(Object.assign({}, CAI_DAT_MAC_DINH));
}

// ------------------------------------------------------------------ mã thiết bị (ngẫu nhiên, không chứa thông tin cá nhân)
function taoMa() {
  try { if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* trang không bảo mật */ }
  return 'tb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
export const maThietBi = doc('thietbi') || (() => { const m = taoMa(); ghi('thietbi', m); return m; })();

// ------------------------------------------------------------------ địa điểm đã lưu
/** Địa điểm: { ten, diaChi, viTri: [lng, lat], loai? } */
export function diaDiemDaLuu() {
  return Object.assign({ nha: null, coQuan: null, yeuThich: [] }, doc('daluu', {}));
}

export function luuNhaCoQuan(loai, dd) {
  const ds = diaDiemDaLuu();
  ds[loai] = dd ? gonDiaDiem(dd) : null;
  ghi('daluu', ds);
}

export function laYeuThich(dd) {
  return diaDiemDaLuu().yeuThich.some(x => cungCho(x, dd));
}

/** Thêm / bỏ yêu thích, trả về true nếu sau khi bấm là đang yêu thích. */
export function doiYeuThich(dd) {
  const ds = diaDiemDaLuu();
  const i = ds.yeuThich.findIndex(x => cungCho(x, dd));
  if (i >= 0) ds.yeuThich.splice(i, 1); else ds.yeuThich.unshift(gonDiaDiem(dd));
  ghi('daluu', ds);
  return i < 0;
}

export function boYeuThich(chiSo) {
  const ds = diaDiemDaLuu();
  ds.yeuThich.splice(chiSo, 1);
  ghi('daluu', ds);
}

// ------------------------------------------------------------------ lịch sử tìm kiếm
export function lichSuTim() { return doc('lichsu', []); }

export function themLichSu(dd) {
  const ds = lichSuTim().filter(x => !cungCho(x, dd));
  ds.unshift(gonDiaDiem(dd));
  ghi('lichsu', ds.slice(0, 15));
}

export function xoaLichSu() { ghi('lichsu', []); }

function gonDiaDiem(dd) {
  return { ten: dd.ten, diaChi: dd.diaChi || '', viTri: [+dd.viTri[0].toFixed(6), +dd.viTri[1].toFixed(6)], loai: dd.loai || '' };
}

function cungCho(a, b) {
  return Math.abs(a.viTri[0] - b.viTri[0]) < 1e-5 && Math.abs(a.viTri[1] - b.viTri[1]) < 1e-5;
}

// ------------------------------------------------------------------ IndexedDB (đoạn video camera hành trình)
let moDb = null;
function db() {
  if (!moDb) {
    moDb = new Promise((ok, loi) => {
      const r = indexedDB.open('hawamap', 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains('doancamera')) r.result.createObjectStore('doancamera', { keyPath: 'id' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => loi(r.error);
    });
  }
  return moDb;
}

function giaoDich(kho, cheDo, viec) {
  return db().then(d => new Promise((ok, loi) => {
    const tx = d.transaction(kho, cheDo);
    const r = viec(tx.objectStore(kho));
    tx.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
    tx.onerror = () => loi(tx.error);
    tx.onabort = () => loi(tx.error);
  }));
}

export const idb = {
  luu: (kho, obj) => giaoDich(kho, 'readwrite', s => s.put(obj)),
  lay: (kho, id) => giaoDich(kho, 'readonly', s => s.get(id)),
  tatCa: (kho) => giaoDich(kho, 'readonly', s => s.getAll()),
  xoa: (kho, id) => giaoDich(kho, 'readwrite', s => s.delete(id))
};
