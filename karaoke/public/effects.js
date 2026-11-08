/* Hiệu ứng vẽ đè lên màn hình LED: tuyết, pháo hoa, kim tuyến, tim, sao, hoa mai/đào, bong bóng, viền đèn */
'use strict';
window.LedFx = (function () {
  var canvas, ctx, W = 0, H = 0, scale = 1;
  var effect = 'none';
  var parts = [];
  var rockets = [];
  var raf = 0, last = 0, t = 0;

  var CONFETTI = ['#ff3b6b', '#ffd23f', '#3fa9ff', '#3ddc84', '#b06bff', '#ff8a3d'];
  var FIREWORK = ['#ff4d4d', '#ffd23f', '#4dd2ff', '#7dff6b', '#ff6bf0', '#ffffff', '#ff9a3d'];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function resize() {
    // vẽ ở độ phân giải vừa phải để máy yếu vẫn mượt
    scale = Math.min(1, 1280 / Math.max(1, window.innerWidth));
    W = Math.round(window.innerWidth * scale);
    H = Math.round(window.innerHeight * scale);
    canvas.width = W;
    canvas.height = H;
  }

  var U = function () { return Math.min(W, H) / 100; }; // 1 đơn vị = 1% cạnh ngắn

  function spawn(kind) {
    var u = U();
    switch (kind) {
      case 'snow':
        return { x: rnd(0, W), y: rnd(-H * 0.1, 0), r: rnd(0.3, 1.1) * u, vy: rnd(4, 11) * u, vx: rnd(-1.5, 1.5) * u, ph: rnd(0, 6.28), a: rnd(0.6, 1) };
      case 'confetti':
        return { x: rnd(0, W), y: rnd(-H * 0.1, 0), w: rnd(0.8, 1.6) * u, h: rnd(0.4, 0.8) * u, vy: rnd(10, 20) * u, vx: rnd(-3, 3) * u, rot: rnd(0, 6.28), vr: rnd(-6, 6), ph: rnd(0, 6.28), c: pick(CONFETTI) };
      case 'hearts':
        return { x: rnd(0, W), y: H + rnd(0, H * 0.1), s: rnd(1.6, 3.6) * u, vy: -rnd(8, 16) * u, ph: rnd(0, 6.28), c: pick(['#ff3b6b', '#ff6b9a', '#ff1f5a', '#ff8fb1']), a: rnd(0.7, 1) };
      case 'stars':
        return { x: rnd(0, W), y: rnd(0, H), s: rnd(0.6, 2.2) * u, life: 0, max: rnd(0.8, 2.2), c: pick(['#fff6c2', '#ffffff', '#ffd23f', '#bfe3ff']) };
      case 'petals':
        return { x: rnd(0, W), y: rnd(-H * 0.1, 0), s: rnd(1.2, 2.4) * u, vy: rnd(5, 10) * u, vx: rnd(-2, 2) * u, rot: rnd(0, 6.28), vr: rnd(-2, 2), ph: rnd(0, 6.28), c: Math.random() < 0.55 ? '#ffd21f' : '#ff9cc6' };
      case 'bubbles':
        return { x: rnd(0, W), y: H + rnd(0, H * 0.1), r: rnd(1, 3.5) * u, vy: -rnd(6, 12) * u, ph: rnd(0, 6.28), hue: rnd(0, 360) };
    }
    return null;
  }

  var RATE = { snow: 70, confetti: 45, hearts: 6, stars: 18, petals: 10, bubbles: 8 };
  var MAX = { snow: 260, confetti: 220, hearts: 40, stars: 70, petals: 60, bubbles: 45 };
  var acc = 0;

  function drawHeart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.fill();
  }

  function drawStar(x, y, s) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var ang = (i * Math.PI) / 4;
      var rr = i % 2 === 0 ? s : s * 0.22;
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawFlower(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.c;
    for (var i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -p.s * 0.55, p.s * 0.32, p.s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.c === '#ffd21f' ? '#d9480f' : '#c2185b';
    ctx.beginPath();
    ctx.arc(0, 0, p.s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* -------- Pháo hoa -------- */
  function launchRocket() {
    var u = U();
    rockets.push({ x: rnd(W * 0.15, W * 0.85), y: H, vx: rnd(-3, 3) * u, vy: -rnd(55, 75) * u, ty: rnd(H * 0.12, H * 0.45), c: pick(FIREWORK) });
  }
  function explode(r) {
    var u = U();
    var n = 70 + ((Math.random() * 40) | 0);
    var c2 = Math.random() < 0.4 ? pick(FIREWORK) : r.c;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + rnd(-0.05, 0.05);
      var sp = rnd(12, 30) * u;
      parts.push({ fw: true, x: r.x, y: r.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: rnd(1.2, 2), c: i % 3 ? r.c : c2, r: rnd(0.25, 0.45) * u });
    }
  }

  /* -------- Viền đèn chạy -------- */
  function drawBorder() {
    var u = U();
    var gap = 3.2 * u;
    var r = 0.9 * u;
    var pad = 1.4 * u;
    var per = 2 * (W + H - 4 * pad);
    var n = Math.floor(per / gap);
    for (var i = 0; i < n; i++) {
      var d = (i / n) * per;
      var x, y;
      var w = W - 2 * pad, h = H - 2 * pad;
      if (d < w) { x = pad + d; y = pad; }
      else if (d < w + h) { x = W - pad; y = pad + (d - w); }
      else if (d < 2 * w + h) { x = W - pad - (d - w - h); y = H - pad; }
      else { x = pad; y = H - pad - (d - 2 * w - h); }
      var phase = (i / 6 - t * 6) % 3;
      if (phase < 0) phase += 3;
      var hue = ((i * 7 + t * 120) % 360) | 0;
      var on = phase < 1.2;
      ctx.fillStyle = 'hsla(' + hue + ',100%,' + (on ? 65 : 30) + '%,' + (on ? 1 : 0.45) + ')';
      ctx.shadowColor = on ? 'hsl(' + hue + ',100%,60%)' : 'transparent';
      ctx.shadowBlur = on ? r * 3 : 0;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    t += dt;
    ctx.clearRect(0, 0, W, H);
    var u = U();

    if (effect === 'fireworks') {
      if (rockets.length < 4 && Math.random() < dt * 1.6) launchRocket();
      ctx.globalCompositeOperation = 'lighter';
      for (var k = rockets.length - 1; k >= 0; k--) {
        var r = rockets[k];
        r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 18 * u * dt;
        ctx.fillStyle = r.c;
        ctx.beginPath(); ctx.arc(r.x, r.y, 0.45 * u, 0, Math.PI * 2); ctx.fill();
        if (r.y <= r.ty || r.vy >= 0) { explode(r); rockets.splice(k, 1); }
      }
    } else if (RATE[effect]) {
      acc += RATE[effect] * dt;
      while (acc >= 1) {
        acc -= 1;
        if (parts.length < MAX[effect]) { var p0 = spawn(effect); if (p0) parts.push(p0); }
      }
    }

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      var dead = false;
      if (p.fw) {
        p.life += dt;
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 9 * u * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var al = 1 - p.life / p.max;
        if (al <= 0) dead = true;
        else {
          ctx.globalAlpha = al;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + al), 0, Math.PI * 2); ctx.fill();
        }
      } else if (effect === 'snow') {
        p.ph += dt; p.x += (p.vx + Math.sin(p.ph) * u) * dt; p.y += p.vy * dt;
        ctx.globalAlpha = p.a; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        dead = p.y > H + p.r;
      } else if (effect === 'confetti') {
        p.ph += dt * 3; p.rot += p.vr * dt; p.x += (p.vx + Math.sin(p.ph) * 2 * u) * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.ph));
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
        dead = p.y > H + p.w;
      } else if (effect === 'hearts') {
        p.ph += dt * 2; p.y += p.vy * dt; p.x += Math.sin(p.ph) * 3 * u * dt;
        ctx.globalAlpha = p.a * Math.min(1, (p.y / H) * 3); ctx.fillStyle = p.c;
        drawHeart(p.x, p.y, p.s);
        dead = p.y < -p.s;
      } else if (effect === 'stars') {
        p.life += dt;
        var k2 = p.life / p.max;
        ctx.globalAlpha = Math.sin(Math.min(1, k2) * Math.PI);
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = p.s;
        drawStar(p.x, p.y, p.s * (0.6 + 0.4 * Math.sin(k2 * Math.PI)));
        ctx.shadowBlur = 0;
        dead = k2 >= 1;
      } else if (effect === 'petals') {
        p.ph += dt; p.rot += p.vr * dt; p.x += (p.vx + Math.sin(p.ph) * 2 * u) * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 0.95; drawFlower(p);
        dead = p.y > H + p.s;
      } else if (effect === 'bubbles') {
        p.ph += dt * 1.5; p.y += p.vy * dt; p.x += Math.sin(p.ph) * 2 * u * dt;
        ctx.globalAlpha = 0.8;
        var g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,.9)');
        g.addColorStop(0.3, 'hsla(' + p.hue + ',90%,75%,.18)');
        g.addColorStop(1, 'hsla(' + ((p.hue + 60) % 360) + ',90%,70%,.55)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        dead = p.y < -p.r;
      } else {
        dead = true;
      }
      if (dead) parts.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (effect === 'border') drawBorder();

    if (effect === 'none' && !parts.length && !rockets.length) {
      cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function set(name) {
    if (name === effect) return;
    effect = name || 'none';
    if (effect !== 'fireworks') rockets = [];
    // giữ hạt cũ để chúng rơi hết tự nhiên, chỉ bỏ hạt khác loại
    parts = parts.filter(function (p) { return effect === 'fireworks' ? p.fw : false; });
    acc = 0;
    if (effect !== 'none' && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  return { init: init, set: set };
})();
