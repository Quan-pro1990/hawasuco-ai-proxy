/*
 * Chuyển Markdown đơn giản sang một trang HTML tự chứa (dùng cho hướng dẫn cài đặt trong gói máy chủ:
 * Windows Server không có sẵn trình xem Markdown). Hỗ trợ: tiêu đề #..####, đoạn văn, danh sách - / 1. (một cấp),
 * khối mã ```, bảng |…|, trích dẫn >, đường kẻ ---, `mã`, **đậm**, [liên kết](địa chỉ).
 */

const thoat = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Chữ trong dòng: `mã`, **đậm**, [chữ](liên kết http(s) hoặc #neo). */
function dongChu(s) {
  const ma = [];
  let r = s.replace(/`([^`]+)`/g, (_, x) => { ma.push(x); return `\u0000${ma.length - 1}\u0000`; });
  r = thoat(r)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|#)[^)\s]+)\)/g, (_, chu, url) =>
      `<a href="${url}"${url.startsWith('#') ? '' : ' target="_blank" rel="noopener"'}>${chu}</a>`);
  return r.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${thoat(ma[+i])}</code>`);
}

/** Neo của tiêu đề, cùng cách GitHub tạo (để mục lục chạy cả trên GitHub lẫn bản HTML). */
export function neo(tieuDe) {
  return tieuDe.replace(/[`*]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

const LA_DS = /^(\s{0,3})([-*]|\d+\.)\s+/;
const LA_KHOI = d => /^```/.test(d) || /^#{1,4}\s/.test(d) || /^\|/.test(d) || /^>/.test(d) || /^---+\s*$/.test(d) || LA_DS.test(d);

export function mdSangHtml(md) {
  const dong = md.replace(/\r\n?/g, '\n').split('\n');
  const ra = [];
  let tieuDe = 'Hướng dẫn';
  let i = 0;
  const o = (k, d) => (d || '').split('|').slice(1, -1).map(x => `<${k}>${dongChu(x.trim())}</${k}>`).join('');
  while (i < dong.length) {
    const d = dong[i];
    let m;
    if (d.trim() === '') { i++; continue; }
    if (/^```/.test(d)) {
      const ma = [];
      for (i++; i < dong.length && !/^```/.test(dong[i]); i++) ma.push(dong[i]);
      i++;
      ra.push(`<pre><code>${thoat(ma.join('\n'))}</code></pre>`);
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(d))) {
      const n = m[1].length;
      if (n === 1) tieuDe = m[2].replace(/[`*]/g, '');
      ra.push(`<h${n} id="${thoat(neo(m[2]))}">${dongChu(m[2])}</h${n}>`);
      i++;
    } else if (/^\|/.test(d)) {
      const hang = [];
      for (; i < dong.length && /^\|/.test(dong[i]); i++) hang.push(dong[i].trim());
      const than = hang.slice(2).map(h => `<tr>${o('td', h)}</tr>`).join('\n');
      ra.push(`<div class="bang"><table>\n<thead><tr>${o('th', hang[0])}</tr></thead>\n<tbody>\n${than}\n</tbody></table></div>`);
    } else if (/^>/.test(d)) {
      const t = [];
      for (; i < dong.length && /^>/.test(dong[i]); i++) t.push(dong[i].replace(/^>\s?/, ''));
      ra.push(`<blockquote><p>${dongChu(t.join(' '))}</p></blockquote>`);
    } else if (/^---+\s*$/.test(d)) {
      ra.push('<hr>');
      i++;
    } else if ((m = LA_DS.exec(d))) {
      const coSo = /\d/.test(m[2]);
      const muc = [];
      while (i < dong.length) {
        const x = dong[i];
        const mm = LA_DS.exec(x);
        if (mm && /\d/.test(mm[2]) === coSo) { muc.push(x.slice(mm[0].length)); i++; continue; }
        // dòng tiếp của mục (thụt vào), hoặc dòng trống giữa hai mục
        if (x.trim() !== '' && /^\s{2,}/.test(x) && muc.length) { muc[muc.length - 1] += ' ' + x.trim(); i++; continue; }
        if (x.trim() === '' && i + 1 < dong.length && LA_DS.test(dong[i + 1]) && /\d/.test(LA_DS.exec(dong[i + 1])[2]) === coSo) { i++; continue; }
        break;
      }
      const the = coSo ? 'ol' : 'ul';
      const batDau = coSo ? parseInt(m[2], 10) : 1;
      ra.push(`<${the}${batDau > 1 ? ` start="${batDau}"` : ''}>\n${muc.map(x => `<li>${dongChu(x)}</li>`).join('\n')}\n</${the}>`);
    } else {
      const t = [];
      for (; i < dong.length && dong[i].trim() !== '' && (!t.length || !LA_KHOI(dong[i])); i++) t.push(dong[i].trim());
      ra.push(`<p>${dongChu(t.join(' '))}</p>`);
    }
  }
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${thoat(tieuDe)}</title>
<style>
:root { --nen: #ffffff; --chu: #1d2733; --phu: #5b6775; --vien: #d9e0e7; --ma: #f2f5f8; --nhan: #0b63c5; }
@media (prefers-color-scheme: dark) { :root { --nen: #141a21; --chu: #e4e9ee; --phu: #9aa6b2; --vien: #2c3743; --ma: #1e2630; --nhan: #6cb2ff; } }
body { margin: 0; background: var(--nen); color: var(--chu); font: 16px/1.6 "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; }
main { max-width: 860px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.9em; line-height: 1.25; margin: .2em 0 .6em; }
h2 { font-size: 1.4em; margin: 2em 0 .6em; padding-top: .6em; border-top: 1px solid var(--vien); }
h3 { font-size: 1.15em; margin: 1.6em 0 .4em; }
a { color: var(--nhan); }
code { background: var(--ma); border-radius: 4px; padding: .1em .35em; font: .92em Consolas, "Cascadia Mono", monospace; overflow-wrap: anywhere; }
pre { background: var(--ma); border: 1px solid var(--vien); border-radius: 8px; padding: 12px 14px; overflow-x: auto; }
pre code { background: none; padding: 0; overflow-wrap: normal; }
blockquote { margin: 1em 0; padding: .6em 1em; border-left: 4px solid var(--nhan); background: var(--ma); border-radius: 0 8px 8px 0; }
blockquote p { margin: 0; }
.bang { overflow-x: auto; margin: 1em 0; }
table { border-collapse: collapse; min-width: 100%; }
th, td { border: 1px solid var(--vien); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: var(--ma); }
li { margin: .25em 0; }
hr { border: 0; border-top: 1px solid var(--vien); margin: 2em 0; }
</style>
</head>
<body>
<main>
${ra.join('\n')}
</main>
</body>
</html>
`;
}
