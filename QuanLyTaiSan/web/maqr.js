/* Tạo mã QR (ISO/IEC 18004, chế độ byte UTF-8, phiên bản 1–40, mức sửa lỗi L/M/Q/H) — vẽ ra SVG để in tem.
   Viết riêng cho phần mềm, không dùng thư viện ngoài. */
(function (goc) {
  'use strict';

  // Số byte sửa lỗi mỗi khối và số khối, theo [mức][phiên bản] (mức: 0 = L, 1 = M, 2 = Q, 3 = H)
  var EC_KHOI = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  var SO_KHOI = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];
  var BIT_MUC = [1, 0, 3, 2];   // bit định dạng của L, M, Q, H

  function soModuleDuLieu(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      var n = Math.floor(v / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }

  function soByteDuLieu(v, muc) {
    return Math.floor(soModuleDuLieu(v) / 8) - EC_KHOI[muc][v] * SO_KHOI[muc][v];
  }

  // ---- Reed–Solomon trên GF(256), đa thức 0x11D
  function nhan(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function dathucChia(bac) {
    var kq = [];
    for (var i = 0; i < bac - 1; i++) kq.push(0);
    kq.push(1);
    var goc = 1;
    for (i = 0; i < bac; i++) {
      for (var j = 0; j < kq.length; j++) {
        kq[j] = nhan(kq[j], goc);
        if (j + 1 < kq.length) kq[j] ^= kq[j + 1];
      }
      goc = nhan(goc, 0x02);
    }
    return kq;
  }

  function phanDu(duLieu, chia) {
    var kq = chia.map(function () { return 0; });
    duLieu.forEach(function (b) {
      var f = b ^ kq.shift();
      kq.push(0);
      chia.forEach(function (c, i) { kq[i] ^= nhan(c, f); });
    });
    return kq;
  }

  function utf8(s) {
    var b = [];
    var e = unescape(encodeURIComponent(s));
    for (var i = 0; i < e.length; i++) b.push(e.charCodeAt(i));
    return b;
  }

  /** Trả { co: số module mỗi cạnh, o: mảng [y][x] true = ô đen }. muc: 'L' | 'M' | 'Q' | 'H'. */
  function tao(chu, muc) {
    var m = { L: 0, M: 1, Q: 2, H: 3 }[muc || 'M'];
    var b = utf8(chu);
    var v, bitDem;
    for (v = 1; v <= 40; v++) {
      bitDem = v <= 9 ? 8 : 16;
      if (4 + bitDem + b.length * 8 <= soByteDuLieu(v, m) * 8) break;
    }
    if (v > 40) throw new Error('Nội dung quá dài cho mã QR');
    // nâng mức sửa lỗi nếu vẫn vừa phiên bản này
    for (var mm = 3; mm > m; mm--) {
      if (4 + bitDem + b.length * 8 <= soByteDuLieu(v, mm) * 8) { m = mm; break; }
    }

    // ---- chuỗi bit dữ liệu
    var bit = [];
    function them(gt, n) { for (var i = n - 1; i >= 0; i--) bit.push((gt >>> i) & 1); }
    them(4, 4);
    them(b.length, bitDem);
    b.forEach(function (x) { them(x, 8); });
    var dungLuong = soByteDuLieu(v, m) * 8;
    them(0, Math.min(4, dungLuong - bit.length));
    them(0, (8 - bit.length % 8) % 8);
    for (var pad = 0xEC; bit.length < dungLuong; pad ^= 0xEC ^ 0x11) them(pad, 8);
    var byt = [];
    for (var i = 0; i < bit.length; i += 8) {
      var x = 0;
      for (var j = 0; j < 8; j++) x = (x << 1) | bit[i + j];
      byt.push(x);
    }

    // ---- chia khối, thêm mã sửa lỗi, xen kẽ
    var soKhoi = SO_KHOI[m][v], ecLen = EC_KHOI[m][v];
    var tongByte = Math.floor(soModuleDuLieu(v) / 8);
    var soKhoiNgan = soKhoi - tongByte % soKhoi;
    var dai = Math.floor(tongByte / soKhoi);
    var chia = dathucChia(ecLen);
    var khoi = [];
    for (i = 0, j = 0; i < soKhoi; i++) {
      var d = byt.slice(j, j + dai - ecLen + (i < soKhoiNgan ? 0 : 1));
      j += d.length;
      var ec = phanDu(d, chia);
      if (i < soKhoiNgan) d.push(0);
      khoi.push(d.concat(ec));
    }
    var cuoi = [];
    for (i = 0; i < khoi[0].length; i++) {
      for (j = 0; j < khoi.length; j++) {
        if (i !== dai - ecLen || j >= soKhoiNgan) cuoi.push(khoi[j][i]);
      }
    }

    // ---- ma trận
    var co = v * 4 + 17;
    var o = [], cn = [];
    for (i = 0; i < co; i++) { o.push(new Array(co).fill(false)); cn.push(new Array(co).fill(false)); }
    function dat(x, y, den) { o[y][x] = den; cn[y][x] = true; }

    for (i = 0; i < co; i++) { dat(6, i, i % 2 === 0); dat(i, 6, i % 2 === 0); }
    [[3, 3], [co - 4, 3], [3, co - 4]].forEach(function (p) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var xx = p[0] + dx, yy = p[1] + dy;
        if (xx < 0 || xx >= co || yy < 0 || yy >= co) continue;
        var k = Math.max(Math.abs(dx), Math.abs(dy));
        dat(xx, yy, k !== 2 && k !== 4);
      }
    });
    var viTri = [];
    if (v > 1) {
      var n = Math.floor(v / 7) + 2;
      var buoc = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
      viTri = [6];
      for (var p = co - 7; viTri.length < n; p -= buoc) viTri.splice(1, 0, p);
    }
    for (i = 0; i < viTri.length; i++) for (j = 0; j < viTri.length; j++) {
      if (i === 0 && j === 0 || i === 0 && j === viTri.length - 1 || i === viTri.length - 1 && j === 0) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++)
        dat(viTri[i] + dx2, viTri[j] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    veDinhDang(0);   // giữ chỗ
    if (v >= 7) {
      var r = v;
      for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var bv = v << 12 | r;
      for (i = 0; i < 18; i++) {
        var bt = ((bv >>> i) & 1) !== 0, a = co - 11 + i % 3, c = Math.floor(i / 3);
        dat(a, c, bt);
        dat(c, a, bt);
      }
    }

    function veDinhDang(mask) {
      var dl = BIT_MUC[m] << 3 | mask, rr = dl;
      for (var t = 0; t < 10; t++) rr = (rr << 1) ^ ((rr >>> 9) * 0x537);
      var bits = (dl << 10 | rr) ^ 0x5412;
      function g(t) { return ((bits >>> t) & 1) !== 0; }
      for (var t2 = 0; t2 <= 5; t2++) dat(8, t2, g(t2));
      dat(8, 7, g(6));
      dat(8, 8, g(7));
      dat(7, 8, g(8));
      for (t2 = 9; t2 < 15; t2++) dat(14 - t2, 8, g(t2));
      for (t2 = 0; t2 < 8; t2++) dat(co - 1 - t2, 8, g(t2));
      for (t2 = 8; t2 < 15; t2++) dat(8, co - 15 + t2, g(t2));
      dat(8, co - 8, true);
    }

    // ---- đặt dữ liệu theo đường zigzag
    var k2 = 0;
    for (var phai = co - 1; phai >= 1; phai -= 2) {
      if (phai === 6) phai = 5;
      for (var doc = 0; doc < co; doc++) {
        for (var jj = 0; jj < 2; jj++) {
          var xx2 = phai - jj;
          var len = ((phai + 1) & 2) === 0;
          var yy2 = len ? co - 1 - doc : doc;
          if (!cn[yy2][xx2] && k2 < cuoi.length * 8) {
            o[yy2][xx2] = ((cuoi[k2 >>> 3] >>> (7 - (k2 & 7))) & 1) !== 0;
            k2++;
          }
        }
      }
    }

    // ---- chọn mặt nạ ít điểm phạt nhất
    function apMat(mask) {
      for (var y = 0; y < co; y++) for (var x = 0; x < co; x++) {
        if (cn[y][x]) continue;
        var dao;
        switch (mask) {
          case 0: dao = (x + y) % 2 === 0; break;
          case 1: dao = y % 2 === 0; break;
          case 2: dao = x % 3 === 0; break;
          case 3: dao = (x + y) % 3 === 0; break;
          case 4: dao = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: dao = x * y % 2 + x * y % 3 === 0; break;
          case 6: dao = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: dao = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (dao) o[y][x] = !o[y][x];
      }
    }
    var tot = 0, diemTot = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      apMat(mk);
      veDinhDang(mk);
      var dp = diemPhat(o, co);
      if (dp < diemTot) { diemTot = dp; tot = mk; }
      apMat(mk);   // XOR lần 2 = bỏ mặt nạ
    }
    apMat(tot);
    veDinhDang(tot);
    return { co: co, o: o, phienBan: v, muc: 'LMQH'.charAt(m) };
  }

  function diemPhat(o, co) {
    var d = 0, y, x, den = 0;
    function chay(lay) {
      var s = 0;
      for (var a = 0; a < co; a++) {
        var dem = 0, truoc = null, chuoi = [];
        for (var b2 = 0; b2 < co; b2++) {
          var gt = lay(a, b2);
          if (gt === truoc) dem++;
          else {
            if (dem >= 5) s += dem - 2;
            truoc = gt; dem = 1;
          }
          chuoi.push(gt ? 1 : 0);
        }
        if (dem >= 5) s += dem - 2;
        // mẫu giống ô định vị 1:1:3:1:1 có 4 ô trắng một bên
        var str = chuoi.join('');
        var re = /(?=(10111010000|00001011101))/g, mt;
        while ((mt = re.exec(str)) !== null) { s += 40; re.lastIndex++; }
      }
      return s;
    }
    d += chay(function (a, b) { return o[a][b]; });
    d += chay(function (a, b) { return o[b][a]; });
    for (y = 0; y < co - 1; y++) for (x = 0; x < co - 1; x++) {
      var c = o[y][x];
      if (c === o[y][x + 1] && c === o[y + 1][x] && c === o[y + 1][x + 1]) d += 3;
    }
    for (y = 0; y < co; y++) for (x = 0; x < co; x++) if (o[y][x]) den++;
    var k = Math.ceil(Math.abs(den * 20 - co * co * 10) / (co * co)) - 1;
    d += Math.max(0, k) * 10;
    return d;
  }

  /** Chuỗi SVG (vuông, có lề trắng 4 module) — dùng thẳng trong trang in tem. */
  function svg(chu, muc, le) {
    var q = tao(chu, muc);
    le = le == null ? 4 : le;
    var n = q.co + le * 2, duong = [];
    for (var y = 0; y < q.co; y++) {
      for (var x = 0; x < q.co; x++) {
        if (!q.o[y][x]) continue;
        var x0 = x;
        while (x + 1 < q.co && q.o[y][x + 1]) x++;
        duong.push('M' + (x0 + le) + ' ' + (y + le) + 'h' + (x - x0 + 1) + 'v1h-' + (x - x0 + 1) + 'z');
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges">' +
      '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path fill="#000" d="' + duong.join('') + '"/></svg>';
  }

  goc.MaQR = { tao: tao, svg: svg };
})(typeof window !== 'undefined' ? window : this);
