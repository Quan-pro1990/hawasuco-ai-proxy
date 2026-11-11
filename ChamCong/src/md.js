/* Chuyển Markdown đơn giản (tiêu đề, đoạn, danh sách nhiều cấp, bảng, ghi chú >, đậm, nghiêng, mã, liên kết) sang HTML.
   Dùng chung: trong phần mềm (trang Hướng dẫn sử dụng) và khi đóng gói (tạo HUONG_DAN_SU_DUNG.html). */
(function (g) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /** Định dạng trong dòng. lk(chữ đã escape, href) -> html liên kết */
  function dong(s, lk) {
    var ma = [];
    s = String(s).replace(/`([^`]+)`/g, function (_, c) { ma.push(c); return '\u0001' + (ma.length - 1) + '\u0001'; });
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, href) { return lk ? lk(t, href.replace(/&amp;/g, '&')) : '<a href="' + href + '">' + t + '</a>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<i>$2</i>');
    return s.replace(/\u0001(\d+)\u0001/g, function (_, i) { return '<code>' + esc(ma[+i]) + '</code>'; });
  }

  /** o.lienKet(chu, href): đổi liên kết; o.boTieuDe: bỏ tiêu đề cấp 1; o.capTD: cộng thêm cấp tiêu đề (## -> h3 khi capTD = 1) */
  function md(src, o) {
    o = o || {};
    var lk = o.lienKet, ls = String(src || '').replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
    var out = [], doan = [], ds = [], i;
    function xongDoan() { if (doan.length) { out.push('<p>' + dong(doan.join(' '), lk) + '</p>'); doan = []; } }
    function xongDS(den) { while (ds.length > den) out.push('</li></' + ds.pop().the + '>'); }
    for (i = 0; i < ls.length; i++) {
      var l = ls[i];
      if (!l.trim()) { xongDoan(); xongDS(0); continue; }
      var td = /^(#{1,4})\s+(.*)$/.exec(l);
      if (td) {
        xongDoan(); xongDS(0);
        if (td[1].length === 1 && o.boTieuDe) continue;
        var cap = Math.min(6, td[1].length + (o.capTD || 0));
        out.push('<h' + cap + '>' + dong(td[2], lk) + '</h' + cap + '>');
        continue;
      }
      if (/^\|/.test(l)) {
        xongDoan(); xongDS(0);
        var hang = [];
        for (; i < ls.length && /^\|/.test(ls[i]); i++) if (!/^\|[\s:|-]+\|\s*$/.test(ls[i])) hang.push(ls[i].trim().replace(/^\||\|$/g, '').split('|').map(function (x) { return x.trim(); }));
        i--;
        out.push('<div class="hd-cuon"><table class="bang hd-bang">' + hang.map(function (r, j) {
          return '<tr>' + r.map(function (x) { return j ? '<td>' + dong(x, lk) + '</td>' : '<th>' + dong(x, lk) + '</th>'; }).join('') + '</tr>';
        }).join('') + '</table></div>');
        continue;
      }
      if (/^>/.test(l)) {
        xongDoan(); xongDS(0);
        var gc = [];
        for (; i < ls.length && /^>/.test(ls[i]); i++) gc.push(dong(ls[i].replace(/^>\s?/, ''), lk));
        i--;
        out.push('<div class="hd-ghichu">' + gc.join('<br>') + '</div>');
        continue;
      }
      var m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
      if (m) {
        xongDoan();
        var thut = m[1].length, the = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (ds.length && thut < ds[ds.length - 1].thut) out.push('</li></' + ds.pop().the + '>');
        var tren = ds[ds.length - 1];
        if (tren && thut <= tren.thut && tren.the !== the) { out.push('</li></' + ds.pop().the + '>'); tren = ds[ds.length - 1]; }
        if (!tren || thut > tren.thut) { out.push('<' + the + '><li>' + dong(m[3], lk)); ds.push({ the: the, thut: thut }); }
        else out.push('</li><li>' + dong(m[3], lk));
        continue;
      }
      if (ds.length && /^\s+\S/.test(l)) { out.push(' ' + dong(l.trim(), lk)); continue; }
      xongDS(0);
      doan.push(l.trim());
    }
    xongDoan(); xongDS(0);
    return out.join('\n');
  }

  /** Thông tin đầu tệp hướng dẫn: # Tiêu đề, <!-- trang: a, b | nhom: X | them: c --> */
  function thongTin(src) {
    var t = /^#\s+(.+)$/m.exec(src || ''), c = /<!--([\s\S]*?)-->/.exec(src || ''), kq = { tieuDe: t ? t[1].trim() : '', trang: [], them: [], nhom: '' };
    if (c) c[1].split('|').forEach(function (p) {
      var kv = /^\s*([a-z]+)\s*:\s*(.*?)\s*$/.exec(p); if (!kv) return;
      if (kv[1] === 'nhom') kq.nhom = kv[2];
      else if (kv[1] === 'trang' || kv[1] === 'them') kq[kv[1]] = kv[2].split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    });
    return kq;
  }

  var MD = { html: md, dong: dong, thongTin: thongTin, esc: esc };
  if (typeof module === 'object' && module.exports) module.exports = MD; else g.MD = MD;
})(typeof window !== 'undefined' ? window : this);
