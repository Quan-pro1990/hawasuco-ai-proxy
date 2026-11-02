/* Đọc / ghi file Excel (.xlsx) và CSV – không cần thư viện ngoài, chạy offline.
   Ghi: nén kiểu "store" (không nén) – Excel, LibreOffice, Google Sheets đều mở được.
   Đọc: giải nén bằng DecompressionStream có sẵn trong trình duyệt. */
(function (root) {
  'use strict';

  /* ---------- tiện ích ---------- */
  var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  function utf8(s) { return enc.encode(s); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; })
      // bỏ ký tự điều khiển không hợp lệ trong XML
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  function cotChu(i) { // 0 -> A
    var s = '';
    i++;
    while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function chuCot(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n - 1; }
  function oRef(r, c) { return cotChu(c) + (r + 1); }

  /* ---------- CRC32 + ZIP (store) ---------- */
  var CRC_T = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(files) { // [{ten, data:Uint8Array}]
    var parts = [], central = [], offset = 0;
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = utf8(f.ten), data = f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(e.buffer)]);
    var total = all.reduce(function (s, p) { return s + p.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  /* ---------- Kiểu ô (style) ---------- */
  // Kiểu: {b, i, sz, mau, nen, vien, ngang, doc, xuong, so}
  function BoKieu() {
    this.fonts = ['<font><sz val="11"/><name val="Times New Roman"/><family val="1"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border>'];
    this.numFmts = [];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.map = {};
    this.fmap = {}; this.fillmap = {}; this.nmap = {};
  }
  BoKieu.prototype.lay = function (k) {
    if (!k) return 0;
    var key = JSON.stringify(k);
    if (this.map[key] != null) return this.map[key];
    // font
    var fk = (k.b ? 'b' : '') + (k.i ? 'i' : '') + '|' + (k.sz || 11) + '|' + (k.mau || '');
    var fontId = this.fmap[fk];
    if (fontId == null) {
      fontId = this.fonts.length;
      this.fonts.push('<font>' + (k.b ? '<b/>' : '') + (k.i ? '<i/>' : '') + '<sz val="' + (k.sz || 11) + '"/>' +
        (k.mau ? '<color rgb="FF' + k.mau.replace('#', '') + '"/>' : '') + '<name val="Times New Roman"/><family val="1"/></font>');
      this.fmap[fk] = fontId;
    }
    var fillId = 0;
    if (k.nen) {
      fillId = this.fillmap[k.nen];
      if (fillId == null) {
        fillId = this.fills.length;
        this.fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF' + k.nen.replace('#', '') + '"/><bgColor indexed="64"/></patternFill></fill>');
        this.fillmap[k.nen] = fillId;
      }
    }
    var numId = 0;
    if (k.so) {
      if (k.so === 'General') numId = 0;
      else {
        numId = this.nmap[k.so];
        if (numId == null) { numId = 164 + this.numFmts.length; this.numFmts.push('<numFmt numFmtId="' + numId + '" formatCode="' + esc(k.so) + '"/>'); this.nmap[k.so] = numId; }
      }
    }
    var al = '';
    if (k.ngang || k.doc || k.xuong) {
      al = '<alignment' + (k.ngang ? ' horizontal="' + k.ngang + '"' : '') + ' vertical="' + (k.doc || 'center') + '"' + (k.xuong ? ' wrapText="1"' : '') + '/>';
    }
    var xf = '<xf numFmtId="' + numId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + (k.vien ? 1 : 0) + '" xfId="0"' +
      (numId ? ' applyNumberFormat="1"' : '') + ' applyFont="1"' + (fillId ? ' applyFill="1"' : '') + (k.vien ? ' applyBorder="1"' : '') +
      (al ? ' applyAlignment="1">' + al + '</xf>' : '/>');
    var id = this.xfs.length;
    this.xfs.push(xf);
    this.map[key] = id;
    return id;
  };
  BoKieu.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (this.numFmts.length ? '<numFmts count="' + this.numFmts.length + '">' + this.numFmts.join('') + '</numFmts>' : '') +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  /* ---------- Ghi workbook ---------- */
  function sheetXml(sh, bk) {
    var rows = sh.dong || [];
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    x += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
    x += '<sheetViews><sheetView workbookViewId="0"' + (sh.anLuoi ? ' showGridLines="0"' : '') + '>';
    if (sh.co && (sh.co.r || sh.co.c)) {
      var r = sh.co.r || 0, c = sh.co.c || 0;
      var pane = c && r ? 'bottomRight' : (r ? 'bottomLeft' : 'topRight');
      x += '<pane' + (c ? ' xSplit="' + c + '"' : '') + (r ? ' ySplit="' + r + '"' : '') + ' topLeftCell="' + oRef(r, c) + '" activePane="' + pane + '" state="frozen"/>';
      x += '<selection pane="' + pane + '"/>';
    }
    x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
    if (sh.cot && sh.cot.length) {
      x += '<cols>';
      sh.cot.forEach(function (w, i) { if (w) x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; });
      x += '</cols>';
    }
    x += '<sheetData>';
    var cao = sh.cao || {};
    rows.forEach(function (row, ri) {
      if (!row) row = [];
      var h = cao[ri];
      x += '<row r="' + (ri + 1) + '"' + (h ? ' ht="' + h + '" customHeight="1"' : '') + '>';
      row.forEach(function (cell, ci) {
        if (cell == null) return;
        var v = cell, s = null;
        if (typeof cell === 'object' && !(cell instanceof Date)) { v = cell.v; s = cell.s; }
        var sid = bk.lay(s);
        var ref = oRef(ri, ci);
        if (v == null || v === '') { if (sid) x += '<c r="' + ref + '" s="' + sid + '"/>'; return; }
        if (typeof v === 'number' && isFinite(v)) x += '<c r="' + ref + '" s="' + sid + '"><v>' + v + '</v></c>';
        else if (typeof v === 'boolean') x += '<c r="' + ref + '" s="' + sid + '" t="b"><v>' + (v ? 1 : 0) + '</v></c>';
        else x += '<c r="' + ref + '" s="' + sid + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (sh.gop && sh.gop.length) x += '<mergeCells count="' + sh.gop.length + '">' + sh.gop.map(function (g) { return '<mergeCell ref="' + g + '"/>'; }).join('') + '</mergeCells>';
    x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
    x += '<pageSetup paperSize="9" orientation="' + (sh.ngang ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/>';
    x += '</worksheet>';
    return x;
  }

  function tenSheetHopLe(t, dung) {
    var s = String(t || 'Sheet').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet';
    var goc = s, i = 2;
    while (dung[s.toLowerCase()]) { s = goc.slice(0, 27) + ' (' + i++ + ')'; }
    dung[s.toLowerCase()] = true;
    return s;
  }

  function ghi(sheets) {
    var bk = new BoKieu(), dung = {};
    var files = [], names = [];
    sheets.forEach(function (sh, i) {
      names.push(tenSheetHopLe(sh.ten, dung));
      files.push({ ten: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: utf8(sheetXml(sh, bk)) });
    });
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '</Types>';
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
      names.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>';
    var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      names.map(function (n, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (names.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    var all = [
      { ten: '[Content_Types].xml', data: utf8(ct) },
      { ten: '_rels/.rels', data: utf8(rels) },
      { ten: 'xl/workbook.xml', data: utf8(wb) },
      { ten: 'xl/_rels/workbook.xml.rels', data: utf8(wbRels) },
      { ten: 'xl/styles.xml', data: utf8(bk.xml()) }
    ].concat(files);
    return zip(all);
  }

  function taiXuong(tenFile, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = tenFile;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- Đọc .xlsx ---------- */
  function giaiNen(bytes) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Trình duyệt quá cũ, không đọc được file .xlsx. Hãy lưu file thành .csv rồi nhập lại.'));
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function moZip(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(buf);
    var eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('File không phải định dạng .xlsx (hoặc bị hỏng).');
    var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true);
    var entries = {};
    var dec = new TextDecoder('utf-8');
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
      var nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
      var lho = dv.getUint32(off + 42, true);
      var name = dec.decode(u8.subarray(off + 46, off + 46 + nlen));
      entries[name] = { method: method, csize: csize, lho: lho };
      off += 46 + nlen + elen + clen;
    }
    return {
      co: function (name) { return !!entries[name]; },
      doc: function (name) {
        var e = entries[name];
        if (!e) return Promise.resolve(null);
        var l = e.lho, start = l + 30 + dv.getUint16(l + 26, true) + dv.getUint16(l + 28, true);
        var data = u8.subarray(start, start + e.csize);
        var p = e.method === 8 ? giaiNen(data) : Promise.resolve(data);
        return p.then(function (b) { return dec.decode(b); });
      }
    };
  }

  function xmlDoc(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  function theo(el, ten) { return Array.prototype.slice.call(el.getElementsByTagName(ten)); }

  var DATE_IDS = { 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 45: 1, 46: 1, 47: 1 };
  function serialSangChuoi(v) {
    // số ngày kiểu Excel -> 'yyyy-mm-dd hh:mm' / 'hh:mm'
    var ngay = Math.floor(v), phan = v - ngay;
    var ph = Math.round(phan * 1440);
    if (ph >= 1440) { ngay++; ph -= 1440; }
    var gio = String(Math.floor(ph / 60)).padStart(2, '0') + ':' + String(ph % 60).padStart(2, '0');
    if (ngay < 1) return gio;
    var d = new Date(Date.UTC(1899, 11, 30) + ngay * 86400000);
    var s = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    return ph ? s + ' ' + gio : s;
  }

  function doc(buf) {
    var z;
    try { z = moZip(buf); } catch (e) { return Promise.reject(e); }
    return Promise.all([z.doc('xl/workbook.xml'), z.doc('xl/_rels/workbook.xml.rels'), z.doc('xl/sharedStrings.xml'), z.doc('xl/styles.xml')])
      .then(function (a) {
        if (!a[0]) throw new Error('Không tìm thấy dữ liệu trong file .xlsx.');
        var wb = xmlDoc(a[0]), rels = a[1] ? xmlDoc(a[1]) : null;
        var ss = [];
        if (a[2]) theo(xmlDoc(a[2]), 'si').forEach(function (si) { ss.push(theo(si, 't').filter(function (t) { return t.parentNode.nodeName !== 'rPh'; }).map(function (t) { return t.textContent; }).join('')); });
        var laNgay = [];
        if (a[3]) {
          var st = xmlDoc(a[3]), fmts = {};
          theo(st, 'numFmt').forEach(function (f) { fmts[f.getAttribute('numFmtId')] = f.getAttribute('formatCode') || ''; });
          var cx = st.getElementsByTagName('cellXfs')[0];
          if (cx) theo(cx, 'xf').forEach(function (xf) {
            var id = +xf.getAttribute('numFmtId');
            var code = (fmts[id] || '').replace(/"[^"]*"|\[[^\]]*\]/g, '');
            laNgay.push(!!DATE_IDS[id] || (id >= 164 && /[dmyhs]/i.test(code) && !/^[#0.,\s%]*$/.test(code)));
          });
        }
        var relMap = {};
        if (rels) theo(rels, 'Relationship').forEach(function (r) { relMap[r.getAttribute('Id')] = r.getAttribute('Target'); });
        var sheets = theo(wb, 'sheet').map(function (s) {
          var rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
          var t = relMap[rid] || '';
          t = t.replace(/^\/?xl\//, '').replace(/^\//, '');
          return { ten: s.getAttribute('name'), path: 'xl/' + t };
        });
        return Promise.all(sheets.map(function (s) { return z.doc(s.path); })).then(function (xs) {
          return sheets.map(function (s, i) {
            var dong = [];
            if (xs[i]) {
              theo(xmlDoc(xs[i]), 'row').forEach(function (row) {
                var ri = (+row.getAttribute('r') || dong.length + 1) - 1;
                var arr = dong[ri] = [];
                var ciAuto = 0;
                theo(row, 'c').forEach(function (c) {
                  var ref = c.getAttribute('r');
                  var ci = ref ? chuCot(ref.replace(/\d+/g, '')) : ciAuto;
                  ciAuto = ci + 1;
                  var t = c.getAttribute('t'), sIdx = +(c.getAttribute('s') || 0);
                  var vEl = c.getElementsByTagName('v')[0];
                  var v = vEl ? vEl.textContent : null;
                  if (t === 's') v = ss[+v];
                  else if (t === 'inlineStr') v = theo(c, 't').map(function (x) { return x.textContent; }).join('');
                  else if (t === 'b') v = v === '1';
                  else if (t === 'str' || t === 'e') v = v;
                  else if (v != null) { v = +v; if (laNgay[sIdx]) v = serialSangChuoi(v); }
                  arr[ci] = v;
                });
              });
            }
            for (var k = 0; k < dong.length; k++) if (!dong[k]) dong[k] = [];
            return { ten: s.ten, dong: dong };
          });
        });
      });
  }

  /* ---------- CSV ---------- */
  function giaiMaVanBan(buf) {
    var u8 = new Uint8Array(buf);
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8.subarray(2));
    var s = new TextDecoder('utf-8').decode(u8);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    if (s.indexOf('�') >= 0) { try { s = new TextDecoder('windows-1258').decode(u8); } catch (e) { /* giữ utf-8 */ } }
    return s;
  }

  function docCSV(text) {
    var dong1 = text.split(/\r?\n/)[0] || '';
    var dem = { ',': 0, ';': 0, '\t': 0 };
    for (var i = 0; i < dong1.length; i++) if (dem[dong1[i]] != null) dem[dong1[i]]++;
    var sep = Object.keys(dem).sort(function (a, b) { return dem[b] - dem[a]; })[0];
    if (!dem[sep]) sep = /\s{2,}|\t/.test(dong1) ? '\t' : ',';
    var rows = [], row = [], cur = '', q = false;
    for (var k = 0; k < text.length; k++) {
      var ch = text[k];
      if (q) {
        if (ch === '"') { if (text[k + 1] === '"') { cur += '"'; k++; } else q = false; }
        else cur += ch;
      } else if (ch === '"' && cur === '') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[k + 1] === '\n') k++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  function taoCSV(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  /** Đọc file người dùng chọn (.xlsx/.csv/.txt) -> Promise<[{ten, dong}]> */
  function docFile(file) {
    return file.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf);
      if (u8[0] === 0x50 && u8[1] === 0x4B) return doc(buf);
      if (u8[0] === 0xD0 && u8[1] === 0xCF) throw new Error('File Excel đời cũ (.xls) chưa đọc được. Mở file bằng Excel rồi "Lưu thành" .xlsx hoặc .csv, sau đó nhập lại.');
      return [{ ten: file.name, dong: docCSV(giaiMaVanBan(buf)) }];
    });
  }

  root.XL = {
    ghi: ghi, taiXuong: taiXuong, doc: doc, docFile: docFile, docCSV: docCSV, taoCSV: taoCSV,
    cotChu: cotChu, oRef: oRef, zip: zip, crc32: crc32
  };
})(this);
