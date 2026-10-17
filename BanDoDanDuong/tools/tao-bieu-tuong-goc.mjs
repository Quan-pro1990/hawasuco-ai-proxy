/*
 * Sinh biểu tượng cho ứng dụng gốc từ cùng nguồn với trang web (public/js/bieu-tuong.js):
 *  - Android: res/drawable/ic_*.xml (nút, danh mục) và mt_*.xml (mũi tên rẽ cho Android Auto)
 *  - iOS:     Assets.xcassets/<tên>.imageset (SVG, dùng làm template image cho CarPlay)
 * Chạy lại sau khi sửa bieu-tuong.js:   node tools/tao-bieu-tuong-goc.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tatCaBieuTuong, muiTenRe } from '../public/js/bieu-tuong.js';

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const THU_MUC_ANDROID = path.join(GOC, 'android/app/src/main/res/drawable');
const THU_MUC_IOS = path.join(GOC, 'ios/HawaMap/Assets.xcassets');

/** Các mũi tên rẽ: tên → bước dẫn đường (loai / huong) như trong chi-duong.js. */
const MUI_TEN = {
  thang: { loai: 'turn', huong: 'straight' },
  cheo_phai: { loai: 'turn', huong: 'slight right' }, re_phai: { loai: 'turn', huong: 'right' }, gat_phai: { loai: 'turn', huong: 'sharp right' },
  cheo_trai: { loai: 'turn', huong: 'slight left' }, re_trai: { loai: 'turn', huong: 'left' }, gat_trai: { loai: 'turn', huong: 'sharp left' },
  quay_dau: { loai: 'turn', huong: 'uturn' },
  vong_xuyen: { loai: 'roundabout', huong: 'straight' },
  vong_xuyen_cheo_phai: { loai: 'roundabout', huong: 'slight right' }, vong_xuyen_phai: { loai: 'roundabout', huong: 'right' },
  vong_xuyen_gat_phai: { loai: 'roundabout', huong: 'sharp right' }, vong_xuyen_cheo_trai: { loai: 'roundabout', huong: 'slight left' },
  vong_xuyen_trai: { loai: 'roundabout', huong: 'left' }, vong_xuyen_gat_trai: { loai: 'roundabout', huong: 'sharp left' },
  den_noi: { loai: 'arrive', huong: '' }
};

const so = x => +(+x).toFixed(3);
function thuocTinh(chuoi) {
  const tt = {};
  for (const m of chuoi.matchAll(/([\w:-]+)="([^"]*)"/g)) tt[m[1]] = m[2];
  return tt;
}

/** Tách các hình (path / circle / rect) thành danh sách { d, fill, stroke, strokeWidth, strokeOpacity }. */
function tachHinh(noiDung, macDinh) {
  const ds = [];
  for (const m of noiDung.matchAll(/<(path|circle|rect)\s+([^>]*?)\/?>/g)) {
    const t = thuocTinh(m[2]);
    let d;
    if (m[1] === 'path') d = t.d;
    else if (m[1] === 'circle') {
      const cx = +t.cx, cy = +t.cy, r = +t.r;
      d = `M${so(cx - r)},${so(cy)}a${so(r)},${so(r)} 0 1,0 ${so(2 * r)},0a${so(r)},${so(r)} 0 1,0 ${so(-2 * r)},0z`;
    } else {
      const x = +t.x, y = +t.y, w = +t.width, h = +t.height, r = Math.min(+(t.rx || 0), w / 2, h / 2);
      d = r ? `M${so(x + r)},${so(y)}h${so(w - 2 * r)}a${so(r)},${so(r)} 0 0,1 ${so(r)},${so(r)}v${so(h - 2 * r)}a${so(r)},${so(r)} 0 0,1 ${so(-r)},${so(r)}` +
        `h${so(-(w - 2 * r))}a${so(r)},${so(r)} 0 0,1 ${so(-r)},${so(-r)}v${so(-(h - 2 * r))}a${so(r)},${so(r)} 0 0,1 ${so(r)},${so(-r)}z`
        : `M${so(x)},${so(y)}h${so(w)}v${so(h)}h${so(-w)}z`;
    }
    ds.push({
      d, fill: t.fill || macDinh.fill, stroke: t.stroke || macDinh.stroke,
      strokeWidth: t['stroke-width'] || macDinh.strokeWidth, strokeOpacity: t['stroke-opacity']
    });
  }
  return ds;
}

const mauAndroid = (m, trang = '#FFFFFFFF') => m === 'currentColor' ? trang : /^#[0-9a-f]{6}$/i.test(m) ? '#FF' + m.slice(1).toUpperCase() : null;

function vectorDrawable(hinh, kichThuoc = 24) {
  const dong = hinh.map(h => {
    const tt = [`android:pathData="${h.d}"`];
    const f = h.fill && h.fill !== 'none' ? mauAndroid(h.fill) : null;
    tt.push(`android:fillColor="${f || '#00000000'}"`);
    const s = h.stroke && h.stroke !== 'none' ? mauAndroid(h.stroke) : null;
    if (s) {
      tt.push(`android:strokeColor="${s}"`, `android:strokeWidth="${h.strokeWidth}"`, 'android:strokeLineCap="round"', 'android:strokeLineJoin="round"');
      if (h.strokeOpacity) tt.push(`android:strokeAlpha="${h.strokeOpacity}"`);
    }
    return `  <path\n      ${tt.join('\n      ')} />`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n<!-- Sinh tự động bởi tools/tao-bieu-tuong-goc.mjs — không sửa tay -->\n` +
    `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="${kichThuoc}dp"\n    android:height="${kichThuoc}dp"\n` +
    `    android:viewportWidth="24"\n    android:viewportHeight="24">\n${dong.join('\n')}\n</vector>\n`;
}

function svgIos(hinh) {
  const mau = m => m === 'currentColor' ? '#000000' : m;
  const dong = hinh.map(h => {
    const f = h.fill && h.fill !== 'none' ? mau(h.fill) : 'none';
    const s = h.stroke && h.stroke !== 'none' ? mau(h.stroke) : 'none';
    return `<path d="${h.d}" fill="${f}" stroke="${s}"` + (s !== 'none' ? ` stroke-width="${h.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"` : '') +
      (h.strokeOpacity ? ` stroke-opacity="${h.strokeOpacity}"` : '') + '/>';
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${dong.join('')}</svg>\n`;
}

function ghiIos(ten, svg) {
  const tm = path.join(THU_MUC_IOS, ten + '.imageset');
  fs.mkdirSync(tm, { recursive: true });
  fs.writeFileSync(path.join(tm, ten + '.svg'), svg);
  fs.writeFileSync(path.join(tm, 'Contents.json'), JSON.stringify({
    images: [{ filename: ten + '.svg', idiom: 'universal' }],
    info: { author: 'xcode', version: 1 },
    properties: { 'preserves-vector-representation': true, 'template-rendering-intent': 'template' }
  }, null, 2) + '\n');
}

fs.mkdirSync(THU_MUC_ANDROID, { recursive: true });
fs.mkdirSync(THU_MUC_IOS, { recursive: true });
let dem = 0;
for (const [ten, noiDung] of Object.entries(tatCaBieuTuong())) {
  const hinh = tachHinh(noiDung, { fill: 'none', stroke: 'currentColor', strokeWidth: '2' });
  fs.writeFileSync(path.join(THU_MUC_ANDROID, 'ic_' + ten + '.xml'), vectorDrawable(hinh));
  ghiIos('ic_' + ten, svgIos(hinh));
  dem++;
}
for (const [ten, buoc] of Object.entries(MUI_TEN)) {
  const svg = muiTenRe(buoc);
  const goc = thuocTinh(svg.slice(0, svg.indexOf('>')));
  const hinh = tachHinh(svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')), { fill: 'none', stroke: 'currentColor', strokeWidth: goc['stroke-width'] });
  fs.writeFileSync(path.join(THU_MUC_ANDROID, 'mt_' + ten + '.xml'), vectorDrawable(hinh, 48));
  ghiIos('mt_' + ten, svgIos(hinh));
  dem++;
}
fs.writeFileSync(path.join(THU_MUC_IOS, 'Contents.json'), JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) + '\n');
console.log(`Đã sinh ${dem} biểu tượng cho Android và iOS`);
