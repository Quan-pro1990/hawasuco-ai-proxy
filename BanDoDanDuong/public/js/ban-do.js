/* global maplibregl */
/*
 * Bản đồ (MapLibre GL): kiểu bản đồ, các lớp tuyến đường / báo cáo / điểm cảnh báo / kết quả tìm kiếm,
 * chấm vị trí của tôi và camera bám theo xe khi dẫn đường (nghiêng 3D, xoay theo hướng đi).
 */
import { CAU_HINH, kieuVietmap } from './cau-hinh.js';
import { caiDat, doc, ghi } from './kho.js';
import { lechGoc, khungBao } from './hinh-hoc.js';
import { svgBieuTuongBanDo, svgBienBao, svgBienVN, svgDiemBanDo, SVG_MUI_TEN_TUYEN, SVG_CO_DICH, taiAnh, icon } from './bieu-tuong.js';
import { BIEN_VN, bieuTuongBien } from './luat-duong.js';
import { LOAI_BAO_CAO } from './loai-bao-cao.js';
import { LOAI_CANH_BAO, BIEN_RE } from './loai-canh-bao.js';
import { DANH_MUC } from './dia-diem.js';
import { veTinhLai } from './ve-tinh.js';
import { BIEN_DOI, NHOM_DIEM, ANH_DIEM } from './kieu-google.js';

/** Hàm tô lại kiểu bản đồ theo tên "bienDoi" trong cau-hinh.js. */
const BIEN_DOI_KIEU = { ...BIEN_DOI, veTinh: veTinhLai };

const RONG = { type: 'FeatureCollection', features: [] };
/** [viền, lõi] của đường tuyến: xanh dương khi xem lộ trình, xanh lá khi dẫn đường. */
const MAU_TUYEN = { thuong: ['#0b4a9e', '#1a73e8'], danduong: ['#13843a', '#2fbf55'] };
const NGUON = ['hanh-trinh', 'tuyen-phu', 'tuyen', 'da-di', 'canh-bao', 'bao-cao', 'ket-qua'];

function duong(toaDo, props = {}) {
  return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: toaDo } };
}
function diem(p, props = {}) {
  return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: p } };
}

export function layKieuBanDo(ten) {
  if (ten === 'vietmap' && caiDat.styleVietmap) return { ten: 'VietMap', style: caiDat.styleVietmap, vietmap: true };
  return kieuVietmap(ten, caiDat.khoaVietmap) || CAU_HINH.kieuBanDo[ten] || CAU_HINH.kieuBanDo.tieuchuan;
}

export class BanDo {
  /**
   * @param idKhung  id thẻ chứa bản đồ
   * @param cb       { nhanGiu(p), chamBaoCao(id, p), chamKetQua(i), chamTuyenPhu(i), chamDiaDiem({ten, viTri}), boTheoDoi() }
   */
  constructor(idKhung, cb, kieuDau = caiDat.kieuBanDo) {
    this.cb = cb;
    this.duLieu = Object.fromEntries(NGUON.map(n => [n, RONG]));
    this.theoDoi = 'khong';         // khong | bac (giữ hướng Bắc) | huong (xoay theo hướng đi, nghiêng 3D)
    this.nghieng = 55;              // độ nghiêng khi xoay theo hướng đi: 55 = 3D, 0 = 2D
    this.ganRe = false;             // sắp tới chỗ rẽ: bản đồ phẳng, phóng to cho dễ nhìn chỗ rẽ
    this.le = { tren: 90, duoi: 30, trai: 0, phai: 0 };
    this.hienThi = null;
    this.lucZoomTay = 0;
    this.anh = this.taiCacAnh();
    this.anhBienSo = new Map();     // 'cb-bs-tocdo-50' → ảnh biển ghi số đã tạo

    const cu = doc('khungnhin', null);
    this.kieu = kieuDau;
    const k = layKieuBanDo(this.kieu);
    this.map = new maplibregl.Map({
      container: idKhung,
      style: k.bienDoi ? undefined : k.style,
      center: cu ? cu.c : CAU_HINH.viTriMacDinh.tam,
      zoom: cu ? cu.z : CAU_HINH.viTriMacDinh.zoom,
      attributionControl: { compact: true },
      maxPitch: 70,
      fadeDuration: 150,
      locale: {
        'AttributionControl.ToggleAttribution': 'Nguồn dữ liệu',
        'NavigationControl.ZoomIn': 'Phóng to', 'NavigationControl.ZoomOut': 'Thu nhỏ'
      }
    });
    if (k.bienDoi) this.napKieu(k);
    this.map.on('style.load', () => this.sauKhiTaiStyle());
    this.map.on('moveend', () => {
      const c = this.map.getCenter();
      ghi('khungnhin', { c: [+c.lng.toFixed(5), +c.lat.toFixed(5)], z: +this.map.getZoom().toFixed(2) });
    });
    this.map.on('error', e => {
      console.warn('Bản đồ:', e && e.error ? e.error.message : e);
      // không tải được kiểu bản đồ VietMap (khoá sai, hết hạn mức, kiểu chưa được cấp quyền): báo để quay về kiểu mặc định
      const loi = e && e.error, st = loi && loi.status;
      if (layKieuBanDo(this.kieu).vietmap && !this.map.isStyleLoaded() && this.loiKieuDaBao !== this.kieu &&
        (st === 401 || st === 403 || /style/i.test((loi && loi.url) || ''))) {
        // còn đường dẫn dự phòng (VietMap có hai dạng đường dẫn style): thử tiếp trước khi báo lỗi
        if (this.styleCho && this.styleCho.length) { this.map.setStyle(this.styleCho.shift(), { diff: false }); return; }
        this.loiKieuDaBao = this.kieu;
        if (this.cb.loiKieu) this.cb.loiKieu(this.kieu, st);
      }
    });
    // người dùng tự kéo / xoay bản đồ thì thôi bám theo vị trí
    for (const ev of ['dragstart', 'rotatestart', 'pitchstart']) {
      this.map.on(ev, e => {
        if (e.originalEvent && this.theoDoi !== 'khong') {
          this.datTheoDoi('khong');
          this.cb.boTheoDoi && this.cb.boTheoDoi();
        }
      });
    }
    this.map.on('zoomstart', e => { if (e.originalEvent) this.lucZoomTay = Date.now(); });
    this.ganNhanGiu();
    this.ganCham();
    this.themNhanQuanDao();
  }

  // ---------------------------------------------------------------- kiểu bản đồ
  doiKieu(ten) {
    if (ten === this.kieu) return;
    this.kieu = ten;
    this.napKieu(layKieuBanDo(ten));
  }

  /** Nạp lại kiểu đang dùng (lấy bản mới nhất từ máy chủ bản đồ). */
  taiLaiKieu() { this.napKieu(layKieuBanDo(this.kieu)); }

  /** Kiểu có "bienDoi": tải kiểu gốc rồi tô lại (màu Google Maps, ảnh vệ tinh…) trước khi vẽ. */
  napKieu(k) {
    this.loiKieuDaBao = null;
    this.styleCho = [...(k.styleDuPhong || [])];
    const bd = k.bienDoi && BIEN_DOI_KIEU[k.bienDoi];
    this.map.setStyle(k.style, bd ? { diff: false, transformStyle: bd } : { diff: false });
  }

  laKieuToi() { return !!layKieuBanDo(this.kieu).toi; }

  /**
   * Ngày của phiên bản dữ liệu bản đồ nền, đọc từ địa chỉ ô vector (OpenFreeMap: …/planet/20251022_001001_pt/{z}/{x}/{y}.pbf);
   * null nếu máy chủ bản đồ không ghi ngày (CARTO) hoặc chưa tải xong.
   */
  ngayDuLieuNen() {
    const st = this.map.getStyle();
    for (const id of Object.keys((st && st.sources) || {})) {
      const s = this.map.getSource(id);
      const m = s && s.type === 'vector' && s.tiles && /\/(20\d{2})(\d{2})(\d{2})_\d+/.exec(s.tiles[0]);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    }
    return null;
  }

  async taiCacAnh() {
    const ds = { 'mui-ten-tuyen': SVG_MUI_TEN_TUYEN };
    for (const [k, v] of Object.entries(LOAI_BAO_CAO)) ds['bc-' + k] = svgBieuTuongBanDo(v.icon, v.mau);
    for (const v of Object.values(LOAI_CANH_BAO)) if (!v.khongBanDo) ds['cb-' + v.icon] = svgBieuTuongBanDo(v.icon, v.mau);
    for (const v of Object.values(BIEN_RE)) ds['cb-' + v.icon] = svgBienBao(v.icon);
    // biển báo Việt Nam (đường cấm, cấm vượt, cấm dừng / đỗ, biển nguy hiểm, STOP…) vẽ như biển thật;
    // biển ghi số (tốc độ, tải trọng, chiều cao) tạo khi gặp (anhBienSo)
    for (const ten of new Set([...Object.values(BIEN_VN).map(b => b.icon), 'duongcam', 'camvuot', 'camdungdo'])) {
      const svg = svgBienVN(ten);
      if (svg) ds['cb-' + ten] = svg;
    }
    for (const d of DANH_MUC) ds['dm-' + d.id] = svgBieuTuongBanDo(d.icon, d.mau);
    // biểu tượng địa điểm của bản đồ nền (kieu-google.js): tròn nhỏ màu theo nhóm như Google Maps
    for (const [nhom, [ten, mau]] of Object.entries(NHOM_DIEM)) ds[ANH_DIEM(nhom)] = svgDiemBanDo(ten, mau);
    ds['dm-ghim'] = svgBieuTuongBanDo('ghim', '#e53935');
    const kq = {};
    await Promise.all(Object.entries(ds).map(async ([k, svg]) => { kq[k] = await taiAnh(svg); }));
    return kq;
  }

  async sauKhiTaiStyle() {
    const m = this.map;
    // kiểu của VietMap đã ghi tên tiếng Việt theo dữ liệu của họ: giữ nguyên
    if (!layKieuBanDo(this.kieu).vietmap) this.vietHoaNhan();
    const anh = await this.anh;
    if (!m.getStyle()) return;
    for (const [k, img] of [...Object.entries(anh), ...this.anhBienSo]) if (!m.hasImage(k)) m.addImage(k, img, { pixelRatio: 2 });
    for (const n of NGUON) if (!m.getSource(n)) m.addSource(n, { type: 'geojson', data: this.duLieu[n] });

    const nhanDau = (m.getStyle().layers.find(l => l.type === 'symbol') || {}).id;
    const rong = (a, b, c) => ['interpolate', ['exponential', 1.5], ['zoom'], 10, a, 15, b, 19, c];
    const tron = { 'line-join': 'round', 'line-cap': 'round' };
    const them = (lop, truoc) => { if (!m.getLayer(lop.id)) m.addLayer(lop, truoc); };
    them({ id: 'hanh-trinh', type: 'line', source: 'hanh-trinh', layout: tron, paint: { 'line-color': '#8e24aa', 'line-width': rong(3, 6, 12), 'line-opacity': 0.85 } }, nhanDau);
    them({ id: 'tuyen-phu-vien', type: 'line', source: 'tuyen-phu', layout: tron, paint: { 'line-color': '#6b7a8c', 'line-width': rong(6, 10, 20) } }, nhanDau);
    them({ id: 'tuyen-phu', type: 'line', source: 'tuyen-phu', layout: tron, paint: { 'line-color': '#b3c1d1', 'line-width': rong(4, 7, 15) } }, nhanDau);
    const mau = MAU_TUYEN[this.mauTuyen] || MAU_TUYEN.thuong;
    them({ id: 'tuyen-vien', type: 'line', source: 'tuyen', layout: tron, paint: { 'line-color': mau[0], 'line-width': rong(7, 12, 24) } }, nhanDau);
    them({ id: 'tuyen', type: 'line', source: 'tuyen', layout: tron, paint: { 'line-color': mau[1], 'line-width': rong(4.5, 8, 18) } }, nhanDau);
    them({ id: 'da-di', type: 'line', source: 'da-di', layout: tron, paint: { 'line-color': '#9aa3ad', 'line-width': rong(7, 12, 24) } }, nhanDau);
    // mũi tên chiều đi nằm dưới lớp "đã đi" để phần đường đã qua chỉ còn màu xám
    them({
      id: 'tuyen-mui-ten', type: 'symbol', source: 'tuyen', minzoom: 13,
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 90, 'icon-image': 'mui-ten-tuyen', 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 0.9], 'icon-allow-overlap': true, 'icon-rotation-alignment': 'map' }
    }, 'da-di');
    // điểm nhỏ, dày đặc (đèn tín hiệu, vạch qua đường, gờ giảm tốc) chỉ vẽ khi phóng to
    them({
      id: 'canh-bao-nho', type: 'symbol', source: 'canh-bao', minzoom: 15, filter: ['==', ['get', 'nho'], true],
      layout: { 'icon-image': ['concat', 'cb-', ['get', 'icon']], 'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.5, 18, 0.8], 'icon-allow-overlap': false }
    });
    them({
      id: 'canh-bao', type: 'symbol', source: 'canh-bao', minzoom: 11, filter: ['!=', ['get', 'nho'], true],
      layout: { 'icon-image': ['concat', 'cb-', ['get', 'icon']], 'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.55, 16, 1], 'icon-allow-overlap': true }
    });
    them({
      id: 'bao-cao', type: 'symbol', source: 'bao-cao', minzoom: 9,
      layout: { 'icon-image': ['get', 'anh'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.55, 15, 1.05], 'icon-allow-overlap': true }
    });
    them({
      id: 'ket-qua', type: 'symbol', source: 'ket-qua',
      layout: { 'icon-image': ['get', 'icon'], 'icon-size': 1, 'icon-allow-overlap': true, 'icon-anchor': 'center' }
    });
    this.dat3D(caiDat.nha3D);
    this.hienLop(['bao-cao'], caiDat.hienBaoCao);
    this.hienLop(['canh-bao', 'canh-bao-nho'], caiDat.hienDiemCanhBao);
    for (const n of NGUON) m.getSource(n).setData(this.duLieu[n]);
    if (this.cb.daiTaiStyle) this.cb.daiTaiStyle();
  }

  /** Tên địa danh: ưu tiên tên tiếng Việt (name:vi) nếu dữ liệu có. */
  vietHoaNhan() {
    const m = this.map;
    for (const l of m.getStyle().layers) {
      if (l.type !== 'symbol' || !l.layout || !l.layout['text-field']) continue;
      const tf = JSON.stringify(l.layout['text-field']);
      if (!/name/.test(tf) || /ref/.test(tf)) continue;
      try { m.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:vi'], ['get', 'name']]); } catch (e) { /* bỏ qua */ }
    }
  }

  dat3D(bat) {
    const m = this.map;
    if (!m.getStyle()) return;
    for (const l of m.getStyle().layers) {
      if (l.type === 'fill-extrusion') m.setLayoutProperty(l.id, 'visibility', bat ? 'visible' : 'none');
    }
  }

  hienLop(ds, hien) {
    for (const id of ds) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', hien ? 'visible' : 'none');
  }

  datNguon(ten, du) {
    this.duLieu[ten] = du;
    const s = this.map.getSource(ten);
    if (s) s.setData(du);
  }

  // ---------------------------------------------------------------- dữ liệu các lớp
  datTuyen(dsTuyen, chon) {
    const t = dsTuyen[chon];
    this.datNguon('tuyen', t ? { type: 'FeatureCollection', features: [duong(t.toaDo)] } : RONG);
    this.datNguon('tuyen-phu', { type: 'FeatureCollection', features: dsTuyen.map((x, i) => i === chon ? null : duong(x.toaDo, { i })).filter(Boolean) });
    this.datNguon('da-di', RONG);
  }

  /** Màu tuyến: 'thuong' (xanh dương khi xem lộ trình) | 'danduong' (xanh lá khi dẫn đường). */
  datMauTuyen(kieu = 'thuong') {
    this.mauTuyen = kieu;
    const mau = MAU_TUYEN[kieu] || MAU_TUYEN.thuong;
    if (this.map.getLayer('tuyen')) {
      this.map.setPaintProperty('tuyen-vien', 'line-color', mau[0]);
      this.map.setPaintProperty('tuyen', 'line-color', mau[1]);
    }
  }

  /** Nhãn chỗ rẽ kế tiếp trên bản đồ (mũi tên + tên đường); null để bỏ. */
  datNhanRe(p, html) {
    if (!p) { if (this.nhanRe) this.nhanRe.remove(); this.nhanRe = null; return; }
    if (!this.nhanRe) {
      const el = document.createElement('div');
      el.className = 'nhan-re';
      this.nhanRe = new maplibregl.Marker({ element: el, anchor: 'bottom-right', offset: [-6, -6] }).setLngLat(p).addTo(this.map);
    }
    if (this.nhanRe.getElement().innerHTML !== html) this.nhanRe.getElement().innerHTML = html;
    this.nhanRe.setLngLat(p);
  }

  datDaDi(toaDo) {
    this.datNguon('da-di', toaDo && toaDo.length > 1 ? { type: 'FeatureCollection', features: [duong(toaDo)] } : RONG);
  }

  xoaTuyen() {
    this.datNguon('tuyen', RONG);
    this.datNguon('tuyen-phu', RONG);
    this.datNguon('da-di', RONG);
  }

  /** Báo cáo giao thông; báo cáo biển báo vẽ bằng hình biển thật. */
  async datBaoCao(ds) {
    const phien = this.phienBc = (this.phienBc || 0) + 1;
    const anh = b => {
      const v = b.loai === 'bienbao' && LOAI_BAO_CAO.bienbao.phu[b.phu];
      return v ? 'cb-' + bieuTuongBien(v.bien, v.so) : 'bc-' + b.loai;
    };
    const cho = this.damBaoAnhBien(ds.map(anh));
    if (cho) { await cho; if (phien !== this.phienBc) return; }
    this.datNguon('bao-cao', { type: 'FeatureCollection', features: ds.map(b => diem([b.lng, b.lat], { id: b.id, loai: b.loai, anh: anh(b) })) });
  }

  /**
   * Tạo ảnh còn thiếu cho biển ghi số ("cb-bs-tocdo-50"…) trước khi vẽ (MapLibre bỏ qua biểu tượng thiếu ảnh).
   * @returns Promise khi phải tạo ảnh, null khi đã đủ ảnh (vẽ được ngay)
   */
  damBaoAnhBien(dsAnh) {
    const thieu = [...new Set(dsAnh)].filter(k => k.startsWith('cb-bs-') && !this.anhBienSo.has(k));
    if (!thieu.length) return null;
    return Promise.all(thieu.map(async k => {
      try { this.anhBienSo.set(k, await taiAnh(svgBienVN(k.slice(3)))); } catch (e) { /* bỏ biển này */ }
    })).then(() => {
      for (const k of thieu) if (this.anhBienSo.has(k) && this.map.getStyle() && !this.map.hasImage(k)) this.map.addImage(k, this.anhBienSo.get(k), { pixelRatio: 2 });
    });
  }

  async datDiemCanhBao(ds) {
    const phien = this.phienCb = (this.phienCb || 0) + 1;
    const cho = this.damBaoAnhBien(ds.map(d => 'cb-' + d.icon));
    if (cho) { await cho; if (phien !== this.phienCb) return; }     // đã có danh sách mới hơn
    this.datNguon('canh-bao', { type: 'FeatureCollection', features: ds.map(d => diem(d.viTri, { id: d.id, icon: d.icon, nho: d.nho })) });
  }

  datKetQua(ds) {
    this.datNguon('ket-qua', { type: 'FeatureCollection', features: ds.map((d, i) => diem(d.viTri, { i, icon: d.danhMuc ? 'dm-' + d.danhMuc : 'dm-ghim' })) });
  }

  datHanhTrinh(toaDo) {
    this.datNguon('hanh-trinh', toaDo ? { type: 'FeatureCollection', features: [duong(toaDo)] } : RONG);
  }

  // ---------------------------------------------------------------- điểm đánh dấu (ghim)
  datGhim(p, kieu = 'den') {
    // kiểu 'co' (cờ ca-rô, điểm đến khi dẫn đường) neo ở giữa, các kiểu ghim neo ở chân
    if (this.ghim && (!p || (this.ghim.getElement().dataset.kieu === 'co') !== (kieu === 'co'))) { this.ghim.remove(); this.ghim = null; }
    if (!p) return;
    if (!this.ghim) {
      const el = document.createElement('div');
      el.className = 'ghim-dich';
      el.innerHTML = kieu === 'co' ? SVG_CO_DICH : icon('ghim');
      this.ghim = new maplibregl.Marker({ element: el, anchor: kieu === 'co' ? 'center' : 'bottom' }).setLngLat(p).addTo(this.map);
    }
    this.ghim.getElement().dataset.kieu = kieu;
    this.ghim.setLngLat(p);
  }

  /** Điểm xuất phát / điểm dừng của lộ trình. */
  datDiemLoTrinh(ds) {
    (this.diemLt || []).forEach(m => m.remove());
    this.diemLt = ds.map((d, i) => {
      const el = document.createElement('div');
      el.className = 'diem-lt ' + (d.loai || '');
      el.textContent = d.nhan || '';
      return new maplibregl.Marker({ element: el }).setLngLat(d.viTri).addTo(this.map);
    });
  }

  /** Nhãn thời gian trên tuyến thay thế (giống ứng dụng dẫn đường): bấm để chọn tuyến. */
  datNhanTuyen(ds) {
    (this.nhanTuyen || []).forEach(m => m.remove());
    this.nhanTuyen = ds.map(d => {
      const el = document.createElement('button');
      el.className = 'nhan-tuyen' + (d.chon ? ' chon' : '');
      el.textContent = d.chu;
      el.addEventListener('click', e => { e.stopPropagation(); this.cb.chamTuyenPhu && this.cb.chamTuyenPhu(d.i); });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(d.viTri).addTo(this.map);
    });
  }

  themNhanQuanDao() {
    const ds = [
      { ten: 'Quần đảo Hoàng Sa (Việt Nam)', p: [112.0, 16.5] },
      { ten: 'Quần đảo Trường Sa (Việt Nam)', p: [114.3, 10.2] }
    ];
    const capNhat = () => {
      const an = this.map.getZoom() > 9.5;
      this.nhanQd.forEach(m => m.getElement().classList.toggle('an', an));
    };
    this.nhanQd = ds.map(d => {
      const el = document.createElement('div');
      el.className = 'nhan-quan-dao';
      el.textContent = d.ten;
      return new maplibregl.Marker({ element: el }).setLngLat(d.p).addTo(this.map);
    });
    this.map.on('zoomend', capNhat);
    capNhat();
  }

  // ---------------------------------------------------------------- tương tác
  ganNhanGiu() {
    const m = this.map;
    let hen = null, dau = null, lanCuoi = 0;
    const huy = () => { clearTimeout(hen); hen = null; };
    const bao = p => {
      if (Date.now() - lanCuoi < 800) return;
      lanCuoi = Date.now();
      this.cb.nhanGiu && this.cb.nhanGiu(p);
    };
    m.on('touchstart', e => {
      huy();
      if (!e.originalEvent.touches || e.originalEvent.touches.length !== 1) return;
      dau = e.point;
      const p = [e.lngLat.lng, e.lngLat.lat];
      hen = setTimeout(() => bao(p), 600);
    });
    m.on('touchmove', e => { if (dau && (Math.abs(e.point.x - dau.x) > 8 || Math.abs(e.point.y - dau.y) > 8)) huy(); });
    m.on('touchend', huy);
    m.on('touchcancel', huy);
    m.on('movestart', e => { if (e.originalEvent) huy(); });
    m.on('contextmenu', e => { e.preventDefault && e.preventDefault(); bao([e.lngLat.lng, e.lngLat.lat]); });
  }

  ganCham() {
    const m = this.map;
    m.on('click', 'bao-cao', e => {
      const f = e.features[0];
      this.cb.chamBaoCao && this.cb.chamBaoCao(f.properties.id, f.geometry.coordinates);
    });
    m.on('click', 'ket-qua', e => { this.cb.chamKetQua && this.cb.chamKetQua(e.features[0].properties.i); });
    m.on('click', 'tuyen-phu', e => { this.cb.chamTuyenPhu && this.cb.chamTuyenPhu(e.features[0].properties.i); });
    for (const lop of ['bao-cao', 'ket-qua', 'tuyen-phu']) {
      m.on('mouseenter', lop, () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', lop, () => { m.getCanvas().style.cursor = ''; });
    }
    // chạm vào biểu tượng địa điểm có sẵn trên nền bản đồ
    m.on('click', e => {
      const lopRieng = ['bao-cao', 'ket-qua', 'tuyen-phu', 'canh-bao', 'canh-bao-nho'].filter(l => m.getLayer(l));
      if (lopRieng.length && m.queryRenderedFeatures(e.point, { layers: lopRieng }).length) return;
      const f = m.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]])
        .find(x => x.layer.type === 'symbol' && x.properties && x.properties.name && x.sourceLayer === 'poi');
      if (f && this.cb.chamDiaDiem) {
        const p = f.geometry.type === 'Point' ? f.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
        this.cb.chamDiaDiem({ ten: f.properties['name:vi'] || f.properties.name, viTri: p, loai: f.properties.class || '' });
      }
    });
  }

  // ---------------------------------------------------------------- khung nhìn
  /** Lề giao diện đè lên bản đồ (px): khung tìm kiếm phía trên, tấm thông tin phía dưới, khung bên trái (máy tính). */
  datLe(le) { Object.assign(this.le, le); }

  dem() {
    return { top: this.le.tren + 30, bottom: this.le.duoi + 30, left: this.le.trai + 40, right: this.le.phai + 40 };
  }

  vuaKhung(toaDo, { tucThi = false } = {}) {
    if (!toaDo || !toaDo.length) return;
    this.datTheoDoi('khong');
    if (toaDo.length === 1) { this.bayDen(toaDo[0], 16); return; }
    const k = khungBao(toaDo);
    this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    this.map.fitBounds(k, { padding: this.dem(), maxZoom: 17, duration: tucThi ? 0 : 900, bearing: 0, pitch: 0 });
  }

  bayDen(p, zoom) {
    this.datTheoDoi('khong');
    const pad = this.dem();
    this.map.flyTo({ center: p, zoom: zoom || Math.max(this.map.getZoom(), 15), padding: pad, duration: 900, essential: true });
  }

  khungHienTai() {
    const b = this.map.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  }

  tam() { const c = this.map.getCenter(); return [c.lng, c.lat]; }

  datLaiHuongBac() {
    if (this.theoDoi === 'huong') this.datTheoDoi('bac');
    this.map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }

  // ---------------------------------------------------------------- vị trí của tôi
  taoChamViTri() {
    const el = document.createElement('div');
    el.className = 'cham-vi-tri';
    el.innerHTML = '<div class="non"></div><div class="cham"></div>' +
      '<svg class="mui-dd" viewBox="0 0 40 40"><path d="M20 3l13 32-13-7-13 7z"/></svg>';
    this.chamViTri = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
      .setLngLat(this.hienThi.viTri).addTo(this.map);
  }

  /** Vị trí mới: trượt mượt chấm vị trí (và camera nếu đang bám) tới vị trí đó trong khoảng 1 giây. */
  capNhatViTri(vt) {
    const bayGio = performance.now();
    const huong = vt.huong != null && isFinite(vt.huong) ? vt.huong : (this.hienThi ? this.hienThi.huong : 0);
    if (!this.hienThi) this.hienThi = { viTri: vt.viTri, huong };
    if (!this.chamViTri) this.taoChamViTri();
    this.chamViTri.getElement().classList.toggle('co-huong', vt.huong != null && isFinite(vt.huong));
    this.tween = {
      tu: { viTri: this.hienThi.viTri.slice(), huong: this.hienThi.huong },
      den: { viTri: vt.viTri, huong },
      t0: bayGio,
      dai: this.lucCuoi ? Math.min(1100, bayGio - this.lucCuoi) : 0
    };
    this.lucCuoi = bayGio;
    this.tocDo = vt.tocDo || 0;
    this.chayKhung();
  }

  chayKhung() {
    if (this.dangChay) return;
    this.dangChay = true;
    requestAnimationFrame(t => this.khung(t));
  }

  khung(t) {
    const tw = this.tween;
    let xong = true;
    if (tw) {
      const k = tw.dai ? Math.min(1, (t - tw.t0) / tw.dai) : 1;
      const p = [tw.tu.viTri[0] + (tw.den.viTri[0] - tw.tu.viTri[0]) * k, tw.tu.viTri[1] + (tw.den.viTri[1] - tw.tu.viTri[1]) * k];
      const h = (tw.tu.huong + lechGoc(tw.tu.huong, tw.den.huong) * k + 360) % 360;
      this.hienThi = { viTri: p, huong: h };
      this.chamViTri.setLngLat(p);
      this.chamViTri.setRotation(h);
      if (k < 1) xong = false;
    }
    if (this.theoDoi !== 'khong' && this.hienThi) {
      if (!this.camera()) xong = false;
    }
    if (xong) { this.dangChay = false; return; }
    requestAnimationFrame(tt => this.khung(tt));
  }

  /** Đưa camera dần về trạng thái mục tiêu; trả về true khi đã tới nơi. */
  camera() {
    const m = this.map, dd = this.theoDoi === 'huong';
    const h = m.getContainer().clientHeight;
    const tayZoom = Date.now() - this.lucZoomTay < 8000;
    if (tayZoom && !dd) this.zoomBac = m.getZoom();     // chế độ giữ hướng Bắc: nhớ mức zoom người dùng chọn
    const ganRe = dd && this.ganRe;
    const zMucTieu = tayZoom ? m.getZoom() : dd ? Math.min(17.6, Math.max(ganRe ? 17.2 : 15, 18 - this.tocDo * 0.09)) : Math.max(this.zoomBac || 16, 3);
    const mt = {
      zoom: zMucTieu,
      pitch: dd && !ganRe ? this.nghieng : 0,
      bearing: dd ? this.hienThi.huong : 0,
      pad: dd ? { top: Math.max(this.le.tren, Math.round(h * 0.42)), bottom: this.le.duoi, left: this.le.trai, right: this.le.phai }
        : { top: this.le.tren, bottom: this.le.duoi, left: this.le.trai, right: this.le.phai }
    };
    const z = m.getZoom(), pi = m.getPitch(), be = m.getBearing(), pa = m.getPadding();
    const tien = (a, b, he) => Math.abs(b - a) < 0.01 ? b : a + (b - a) * he;
    const db = lechGoc(be, mt.bearing);
    const moi = {
      zoom: tien(z, mt.zoom, 0.08),
      pitch: tien(pi, mt.pitch, 0.1),
      bearing: Math.abs(db) < 0.1 ? mt.bearing : be + db * 0.2,
      padding: { top: tien(pa.top, mt.pad.top, 0.12), bottom: tien(pa.bottom, mt.pad.bottom, 0.12), left: tien(pa.left, mt.pad.left, 0.12), right: tien(pa.right, mt.pad.right, 0.12) }
    };
    m.jumpTo({ center: this.hienThi.viTri, ...moi });
    return Math.abs(moi.zoom - mt.zoom) < 0.02 && Math.abs(moi.pitch - mt.pitch) < 0.3 && Math.abs(lechGoc(moi.bearing, mt.bearing)) < 0.3 &&
      Math.abs(moi.padding.top - mt.pad.top) < 1 && Math.abs(moi.padding.bottom - mt.pad.bottom) < 1 &&
      Math.abs(moi.padding.left - mt.pad.left) < 1 && Math.abs(moi.padding.right - mt.pad.right) < 1;
  }

  /** Sắp tới / vừa qua chỗ rẽ (dẫn đường): camera chuyển dần sang phẳng, phóng to; qua khỏi thì nghiêng lại. */
  datGanRe(bat) {
    if (this.ganRe === !!bat) return;
    this.ganRe = !!bat;
    this.chayKhung();
  }

  /** Chế độ bám vị trí: 'khong' | 'bac' | 'huong'. */
  datTheoDoi(cheDo) {
    this.theoDoi = cheDo;
    if (this.chamViTri) this.chamViTri.getElement().classList.toggle('dan-duong', cheDo === 'huong');
    if (cheDo === 'khong') return;
    if (cheDo === 'bac') this.zoomBac = Math.max(this.map.getZoom(), 16);
    this.lucZoomTay = 0;
    if (this.hienThi) this.chayKhung();
  }
}
