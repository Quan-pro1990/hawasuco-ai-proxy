// Các công cụ (tool) để Claude tra số liệu thất thoát nước. Chỉ đọc — không công cụ nào sửa dữ liệu.
// Kết quả máy chủ được rút gọn (bỏ mã nội bộ, làm tròn số) để trợ lý đọc nhanh và tốn ít token.

import { LoiMayChu } from './thatthoat.js';

const LOAI = { Doi: 'Đội', KhuVuc: 'Khu vực', ToanCongTy: 'Toàn công ty', Dma: 'Vùng DMA', Khac: 'Khác' };

const SO_NAM = { type: 'integer', description: 'Năm, vd 2026. Bỏ trống = năm có số liệu mới nhất.' };
const SO_THANG = { type: 'integer', description: 'Tháng 1–12. Bỏ trống = tháng có số liệu mới nhất.' };

/** Định nghĩa gửi cho Claude (thứ tự cố định để giữ bộ nhớ đệm prompt). */
export const DINH_NGHIA = [
  {
    name: 'that_thoat_thang',
    description:
      'Tỷ lệ thất thoát nước của MỘT tháng: toàn công ty, từng đội, khu vực và vùng DMA. ' +
      'Mỗi đơn vị có: tyLe (% thất thoát tháng), keHoach (% kế hoạch năm), chenhKeHoach / chenhThangTruoc / chenhCungKy ' +
      '(chênh lệch tính bằng điểm phần trăm: tỷ lệ tháng này trừ kế hoạch / tháng trước / cùng kỳ năm trước; dương là thất thoát tăng, xấu hơn), ' +
      'phatRa và chuanThu (m³), luyKe (lũy kế từ tháng 1 của năm đó: tyLe, phatRa, chuanThu, chenhCungKy), ' +
      'tinhTrang (vd "TLK đứng kim" khi không có số), thieuSoLieu. Kết quả cũng liệt kê các tháng đang có số liệu. ' +
      'Dùng khi hỏi về một tháng cụ thể, tháng mới nhất, so với kế hoạch / tháng trước / cùng kỳ, đội nào cao nhất…',
    input_schema: {
      type: 'object',
      properties: { nam: SO_NAM, thang: SO_THANG },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: 'that_thoat_ca_nam',
    description:
      'Bảng tổng hợp cả năm: tỷ lệ thất thoát (%) từng tháng 1–12 của từng đội, khu vực, vùng DMA và toàn công ty, ' +
      'kèm lũy kế đến tháng mới nhất (tỷ lệ, phát ra, chuẩn thu m³, chênh lệch cùng kỳ) và tỷ lệ kế hoạch năm. ' +
      'Ô tháng có thể là chữ (vd "TLK đứng kim") khi vùng DMA không có số. Dùng khi hỏi xu hướng, so sánh giữa các tháng, cả năm.',
    input_schema: {
      type: 'object',
      properties: { nam: { type: 'integer', description: 'Năm, vd 2025. Bỏ trống = năm mới nhất.' } },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: 'khai_thac_cap_1',
    description:
      'Sản lượng khai thác nước thô / nước mặt theo đồng hồ cấp 1 của một tháng (tách riêng với báo cáo thất thoát): ' +
      'tổng toàn công ty, nước giếng (ngầm), nước mặt; từng đội và trạm cấp nước / nhà máy với sản lượng tháng, tháng trước, ' +
      'lũy kế năm (m³), số đồng hồ, số đồng hồ chưa nhập chỉ số. Đặt chi_tiet_dong_ho = true để lấy thêm từng đồng hồ ' +
      '(chỉ số cũ / mới, hệ số, ghi chú) — chỉ khi người dùng hỏi tới đồng hồ cụ thể.',
    input_schema: {
      type: 'object',
      properties: {
        nam: SO_NAM,
        thang: SO_THANG,
        doi: { type: 'integer', description: 'Mã đội (số "id" trong danh sách đội của kết quả trước). Bỏ trống = tất cả các đội.' },
        chi_tiet_dong_ho: { type: 'boolean', description: 'true = kèm từng đồng hồ.' },
      },
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
];

/** Câu ngắn hiện trên màn hình khi trợ lý đang tra. */
export function moTaDangTra(ten, vao) {
  const ky = vao && vao.thang && vao.nam ? ' tháng ' + vao.thang + '/' + vao.nam : vao && vao.nam ? ' năm ' + vao.nam : '';
  if (ten === 'that_thoat_thang') return 'Đang xem tỷ lệ thất thoát' + (ky || ' tháng mới nhất') + '…';
  if (ten === 'that_thoat_ca_nam') return 'Đang xem bảng tổng hợp' + (ky || ' năm mới nhất') + '…';
  if (ten === 'khai_thac_cap_1') return 'Đang xem sản lượng khai thác cấp 1' + ky + '…';
  return 'Đang tra cứu…';
}

// ------------------------------------------------------------------ kiểm tra đầu vào

/**
 * Kiểm tra đầu vào do mô hình sinh ra (eager input streaming: máy chủ Anthropic không kiểm tra hộ).
 * @returns {{ok: true, vao: object} | {ok: false, loi: string}}
 */
export function kiemTraDauVao(ten, vao) {
  const def = DINH_NGHIA.find((d) => d.name === ten);
  if (!def) return { ok: false, loi: 'Không có công cụ "' + ten + '".' };
  if (vao == null || typeof vao !== 'object' || Array.isArray(vao)) return { ok: false, loi: 'Đầu vào phải là một đối tượng JSON.' };
  const props = def.input_schema.properties;
  const ra = {};
  for (const [k, v] of Object.entries(vao)) {
    if (!(k in props)) return { ok: false, loi: 'Tham số không hợp lệ: ' + k };
    if (v == null) continue;
    if (props[k].type === 'integer') {
      if (!Number.isInteger(v)) return { ok: false, loi: k + ' phải là số nguyên.' };
      if (k === 'nam' && (v < 2000 || v > 2100)) return { ok: false, loi: 'Năm không hợp lệ: ' + v };
      if (k === 'thang' && (v < 1 || v > 12)) return { ok: false, loi: 'Tháng phải từ 1 đến 12.' };
      if (k === 'doi' && (v < 0 || v > 100000)) return { ok: false, loi: 'Mã đội không hợp lệ.' };
    } else if (props[k].type === 'boolean' && typeof v !== 'boolean') {
      return { ok: false, loi: k + ' phải là true hoặc false.' };
    }
    ra[k] = v;
  }
  if (ra.thang != null && ra.nam == null) return { ok: false, loi: 'Khi chọn tháng thì phải ghi cả năm.' };
  return { ok: true, vao: ra };
}

// ------------------------------------------------------------------ chạy công cụ

/**
 * Chạy 1 công cụ. Trả chuỗi JSON (gửi lại cho Claude làm tool_result).
 * Lỗi được ném ra dạng Error với thông điệp tiếng Việt để trả về is_error.
 */
export async function chayCongCu(mayChu, token, ten, vao) {
  if (!mayChu) throw new Error('Trợ lý chưa được nối với máy chủ thất thoát nước (chưa cài MAYCHU_DIACHI), nên không tra được số liệu.');
  try {
    switch (ten) {
      case 'that_thoat_thang': {
        const r = await mayChu.tongQuan(token, vao.nam, vao.thang);
        if (vao.nam && vao.thang && r.chon && (r.chon.nam !== vao.nam || r.chon.thang !== vao.thang))
          return JSON.stringify({ loi: 'Chưa có số liệu tháng ' + vao.thang + '/' + vao.nam + '.', cacThangCoSoLieu: dsThang(r.thang) });
        return JSON.stringify(gonTongQuan(r));
      }
      case 'that_thoat_ca_nam': {
        const r = await mayChu.tongHop(token, vao.nam);
        if (vao.nam && Array.isArray(r.cacNam) && !r.cacNam.includes(vao.nam))
          return JSON.stringify({ loi: 'Chưa có số liệu năm ' + vao.nam + '.', cacNamCoSoLieu: r.cacNam });
        return JSON.stringify(gonTongHop(r));
      }
      case 'khai_thac_cap_1': {
        const r = await mayChu.cap1(token, vao.nam, vao.thang, vao.doi);
        if (vao.nam && vao.thang && r.chon && (r.chon.nam !== vao.nam || r.chon.thang !== vao.thang))
          return JSON.stringify({ loi: 'Chưa có số liệu đồng hồ cấp 1 tháng ' + vao.thang + '/' + vao.nam + '.', cacThangCoSoLieu: dsThang(r.thang) });
        return JSON.stringify(gonCap1(r, !!vao.chi_tiet_dong_ho));
      }
      default:
        throw new Error('Không có công cụ "' + ten + '".');
    }
  } catch (e) {
    if (e instanceof LoiMayChu && e.status === 401) {
      const loi = new Error('Phiên đăng nhập máy chủ thất thoát nước đã hết — người dùng cần đăng nhập lại.');
      loi.hetPhien = true;
      throw loi;
    }
    throw e;
  }
}

// ------------------------------------------------------------------ rút gọn kết quả

const p2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : v ?? undefined);
const m3 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : v ?? undefined);

/** Bỏ các khoá null / undefined / chuỗi rỗng / false cho gọn. */
function gon(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '' && v !== false) r[k] = v;
  return r;
}

function dsThang(ds) {
  return (ds || []).slice(0, 36).map((t) => t.thang + '/' + t.nam);
}

function gonTongQuan(r) {
  if (!r.chon) return { loi: 'Máy chủ chưa có số liệu tháng nào.' };
  return {
    thangDangXem: gon({ thang: r.chon.thang, nam: r.chon.nam, ten: r.chon.ten, kyHoaDon: r.chon.kyHoaDon, tuNgay: r.chon.tuNgay, denNgay: r.chon.denNgay }),
    cacThangCoSoLieu: dsThang(r.thang),
    donVi: (r.donVi || []).map((d) => gon({
      ten: d.ten || d.tenDay,
      loai: LOAI[d.vaiTro] || d.vaiTro,
      tyLe: p2(d.tyLe),
      keHoach: p2(d.keHoach),
      chenhKeHoach: p2(d.soKeHoach),
      chenhThangTruoc: p2(d.soThangTruoc),
      chenhCungKy: p2(d.soCungKy),
      phatRa: m3(d.phatRa),
      chuanThu: m3(d.chuanThu),
      luyKe: (d.lkTyLe != null || d.lkPhatRa != null) ? gon({ tyLe: p2(d.lkTyLe), phatRa: m3(d.lkPhatRa), chuanThu: m3(d.lkChuanThu), chenhCungKy: p2(d.lkSoCungKy) }) : undefined,
      tinhTrang: d.tinhTrang,
      thieuSoLieu: d.thieu,
    })),
  };
}

function gonTongHop(r) {
  if (!r.dong || r.dong.length === 0) return { nam: r.nam, cacNamCoSoLieu: r.cacNam, loi: 'Năm ' + r.nam + ' chưa có số liệu.' };
  return {
    nam: r.nam,
    cacNamCoSoLieu: r.cacNam,
    soLieuDenThang: r.denThang,
    donVi: r.dong.map((d) => {
      const theoThang = {};
      (d.thang || []).forEach((v, i) => { if (v != null) theoThang[i + 1] = typeof v === 'number' ? p2(v) : v; });
      return gon({
        ten: d.ten,
        loai: LOAI[d.vaiTro] || d.vaiTro,
        tyLeTheoThang: theoThang,
        luyKe: gon({ tyLe: p2(d.lkTyLe), phatRa: m3(d.lkPhatRa), chuanThu: m3(d.lkChuanThu), chenhCungKy: p2(d.lkSoCungKy) }),
        keHoach: p2(d.keHoach),
      });
    }),
  };
}

function tongCap1(t) {
  if (!t) return undefined;
  return gon({ sanLuong: m3(t.sanLuong), thangTruoc: m3(t.thangTruoc), luyKeNam: m3(t.luyKe), soDongHo: t.soDongHo, soChuaNhap: t.soChuaNhap });
}

function gonCap1(r, chiTiet) {
  if (!r.chon) return { loi: 'Chưa có số liệu đồng hồ cấp 1.' };
  return {
    thangDangXem: gon({ thang: r.chon.thang, nam: r.chon.nam, ten: r.chon.ten, tuNgay: r.chon.tuNgay, denNgay: r.chon.denNgay }),
    cacThangCoSoLieu: dsThang(r.thang),
    danhSachDoi: (r.doi || []).map((d) => ({ id: d.id, ten: d.ten })),
    dangLocDoi: r.doiChon >= 0 ? r.doiChon : undefined,
    tong: tongCap1(r.tong),
    nuocGieng: tongCap1(r.gieng),
    nuocMat: tongCap1(r.mat),
    theoDoi: (r.nhom || []).map((d) => ({
      ...tongCap1(d),
      ten: d.ten,
      tram: (d.tram || []).map((t) => gon({
        ...tongCap1(t),
        ten: t.ten,
        thoiGianChot: t.chot,
        dongHo: chiTiet ? (t.dongHo || []).map((h) => gon({
          ten: h.ten, nguon: h.nguon, heSo: h.heSo !== 1 ? h.heSo : undefined,
          chiSoCu: h.cu, chiSoMoi: h.moi, sanLuong: m3(h.sanLuong), thangTruoc: m3(h.thangTruoc), luyKeNam: m3(h.luyKe),
          nhapTaySanLuong: h.slNhap != null ? m3(h.slNhap) : undefined, thayDongHo: h.thayDongHo, chiSoAm: h.amChiSo, ghiChu: h.ghiChu,
        })) : undefined,
      })),
    })),
  };
}
