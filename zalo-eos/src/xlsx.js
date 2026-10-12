'use strict';
// Ghi file Excel .xlsx 1 trang (bảng đối soát thanh toán) — không cần thư viện ngoài.
// .xlsx là file zip chứa vài file XML; ở đây chỉ dựng phần tối thiểu Excel cần để mở được.
const zlib = require('zlib');
const { crc32 } = require('./qrcode');

function xml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

function tenCot(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/** dong: mảng các dòng, mỗi dòng là mảng ô (số → ô số, còn lại → chữ). doRong: độ rộng từng cột. */
function taoXlsx(dong, { tenTrang = 'Trang1', doRong = [] } = {}) {
  const cols = doRong.length
    ? '<cols>' + doRong.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>'
    : '';
  const rows = dong.map((d, r) => `<row r="${r + 1}">` + d.map((v, c) => {
    const ref = tenCot(c) + (r + 1);
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    if (v == null || v === '') return '';
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('') + '</row>').join('');

  const NS = 'http://schemas.openxmlformats.org';
  const tep = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS}/package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + `<Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}/spreadsheetml/2006/main" `
      + `xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="${xml(tenTrang)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}/spreadsheetml/2006/main">`
      + `${cols}<sheetData>${rows}</sheetData></worksheet>`,
  };
  return nenZip(tep);
}

/** Đóng gói zip (nén deflate). */
function nenZip(tep) {
  const phan = [];
  const mucLuc = [];
  let viTri = 0;
  for (const [ten, noiDung] of Object.entries(tep)) {
    const goc = Buffer.from(noiDung, 'utf8');
    const nen = zlib.deflateRawSync(goc);
    const tenB = Buffer.from(ten, 'utf8');
    const crc = crc32(goc);
    const dau = Buffer.alloc(30);
    dau.writeUInt32LE(0x04034b50, 0);
    dau.writeUInt16LE(20, 4);
    dau.writeUInt16LE(0x0800, 6);       // tên tệp UTF-8
    dau.writeUInt16LE(8, 8);            // deflate
    dau.writeUInt16LE(0, 10);
    dau.writeUInt16LE(0x21, 12);        // ngày 1/1/1980
    dau.writeUInt32LE(crc, 14);
    dau.writeUInt32LE(nen.length, 18);
    dau.writeUInt32LE(goc.length, 22);
    dau.writeUInt16LE(tenB.length, 26);
    dau.writeUInt16LE(0, 28);
    phan.push(dau, tenB, nen);

    const ml = Buffer.alloc(46);
    ml.writeUInt32LE(0x02014b50, 0);
    ml.writeUInt16LE(20, 4);
    ml.writeUInt16LE(20, 6);
    ml.writeUInt16LE(0x0800, 8);
    ml.writeUInt16LE(8, 10);
    ml.writeUInt16LE(0, 12);
    ml.writeUInt16LE(0x21, 14);
    ml.writeUInt32LE(crc, 16);
    ml.writeUInt32LE(nen.length, 20);
    ml.writeUInt32LE(goc.length, 24);
    ml.writeUInt16LE(tenB.length, 28);
    ml.writeUInt32LE(viTri, 42);
    mucLuc.push(ml, tenB);
    viTri += dau.length + tenB.length + nen.length;
  }
  const ml = Buffer.concat(mucLuc);
  const cuoi = Buffer.alloc(22);
  cuoi.writeUInt32LE(0x06054b50, 0);
  cuoi.writeUInt16LE(Object.keys(tep).length, 8);
  cuoi.writeUInt16LE(Object.keys(tep).length, 10);
  cuoi.writeUInt32LE(ml.length, 12);
  cuoi.writeUInt32LE(viTri, 16);
  return Buffer.concat([...phan, ml, cuoi]);
}

module.exports = { taoXlsx };
