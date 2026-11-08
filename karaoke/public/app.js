/* Trang điều khiển: tìm bài YouTube, quản lý danh sách phát, điều khiển màn hình LED */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = KL.esc;
  var fmtTime = KL.fmtTime;

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('karaled.' + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('karaled.' + k, v); } catch (e) { /* bỏ qua */ } },
  };

  var S = null;
  var pin = store.get('pin', '');
  var pinVerified = false;
  var admin = false;
  var progress = { playId: null, position: 0, duration: 0, status: 'stopped', at: 0 };
  var seeking = false;
  var volDragging = false;
  var results = [];
  var nextPageToken = '';
  var lastQuery = '';
  var activeGenre = 'karaoke';
  var renderKeys = {};
  var firstState = true;

  /* ------------------------------------------------------------ */
  /* Thể loại và gợi ý                                             */
  /* ------------------------------------------------------------ */
  var month = new Date().getMonth() + 1;
  var tetSeason = month <= 3;
  function c(l, q, mod) { return { l: l, q: q, mod: !!mod }; }
  var GENRES = {
    karaoke: {
      title: 'Tìm kiếm YouTube', q: 'karaoke beat chuẩn dễ hát',
      chips: [c('Tone Nam', 'tone nam', 1), c('Tone Nữ', 'tone nữ', 1), c('Song ca', 'song ca', 1), c('Beat chuẩn', 'beat chuẩn', 1),
        c('Bolero', 'karaoke bolero'), c('Nhạc trẻ', 'karaoke nhạc trẻ'), c('Nhạc sống', 'karaoke nhạc sống'), c('Trữ tình', 'karaoke trữ tình'),
        c('Liên khúc', 'karaoke liên khúc'), c('Nhạc Trịnh', 'karaoke nhạc trịnh'), c('Thiếu nhi', 'karaoke thiếu nhi'),
        c('Cách mạng', 'karaoke nhạc cách mạng'), c('Remix', 'karaoke remix')],
    },
    remix: {
      title: 'DJ Remix', q: 'nhạc remix dj hay nhất',
      chips: [c('Vinahouse', 'nhạc vinahouse'), c('Remix TikTok', 'nhạc remix tiktok'), c('Nonstop', 'nonstop dj'), c('EDM', 'nhạc edm'),
        c('Karaoke Remix', 'karaoke remix'), c('Remix Bolero', 'bolero remix')],
    },
    instrumental: {
      title: 'Nhạc không lời', q: 'nhạc không lời hay nhất',
      chips: [c('Piano', 'nhạc không lời piano'), c('Guitar', 'nhạc không lời guitar'), c('Saxophone', 'nhạc saxophone'),
        c('Hòa tấu', 'hòa tấu nhạc việt'), c('Lofi', 'nhạc lofi chill'), c('Phòng trà', 'nhạc phòng trà không lời'), c('Thiền', 'nhạc thiền')],
    },
    chinese: {
      title: 'Nhạc Hoa', q: 'karaoke nhạc hoa lời việt',
      chips: [c('Nhạc Hoa lời Việt', 'nhạc hoa lời việt'), c('Karaoke nhạc Hoa', 'karaoke nhạc hoa lời việt'), c('Nhạc Hoa gốc', 'nhạc hoa bất hủ'),
        c('Tiếng Quảng', 'nhạc hoa tiếng quảng'), c('Nhạc phim TVB', 'nhạc phim tvb'), c('Nhạc Hoa remix', 'nhạc hoa remix')],
    },
    season: {
      title: 'Noel & Tết', q: tetSeason ? 'nhạc tết hay nhất' : 'nhạc noel hay nhất',
      chips: [c('Nhạc Noel', 'nhạc noel'), c('Karaoke Noel', 'karaoke nhạc noel'), c('Noel thiếu nhi', 'nhạc noel thiếu nhi'),
        c('Nhạc Tết', 'nhạc tết'), c('Karaoke Tết', 'karaoke nhạc tết'), c('Nhạc Xuân', 'nhạc xuân hay nhất'), c('Đếm ngược', 'countdown năm mới')],
    },
    led: {
      title: 'Nền LED sân khấu', q: 'led background stage visual 4k loop',
      chips: [c('Nền sân khấu', 'led background stage'), c('VJ loop', 'vj loop 4k'), c('Đám cưới', 'background led đám cưới'),
        c('Pháo hoa', 'fireworks background 4k'), c('Tết', 'background tết led'), c('Noel', 'christmas background loop 4k'), c('Hạt sáng', 'particles background 4k')],
    },
  };

  var FX = [
    ['none', '⛔', 'Không'], ['snow', '❄️', 'Tuyết rơi'], ['fireworks', '🎆', 'Pháo hoa'],
    ['confetti', '🎊', 'Kim tuyến'], ['hearts', '❤️', 'Trái tim'], ['stars', '✨', 'Lấp lánh'],
    ['petals', '🌸', 'Hoa mai đào'], ['bubbles', '🫧', 'Bong bóng'], ['border', '💡', 'Viền đèn'],
  ];

  /* ------------------------------------------------------------ */
  /* Tiện ích                                                      */
  /* ------------------------------------------------------------ */
  function toast(msg, level) {
    var box = $('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (level || '');
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { el.remove(); }, level === 'error' || level === 'warn' ? 6000 : 3000);
  }

  function act(type, data) {
    return KL.postJson('/api/action', Object.assign({ type: type }, data || {}), pin ? { 'X-Pin': pin } : {})
      .catch(function (err) {
        if (err.code === 'pin') {
          pinVerified = false;
          applyRole();
          openPin();
        }
        toast(err.message, 'error');
        return null;
      });
  }

  function getJson(url) {
    return fetch(url).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var e = new Error(d.error || 'Lỗi ' + r.status);
          e.code = d.code || '';
          throw e;
        }
        return d;
      });
    });
  }

  function thumb(id, big) {
    return 'https://i.ytimg.com/vi/' + id + '/' + (big ? 'hqdefault' : 'mqdefault') + '.jpg';
  }

  function singer() { return $('singer').value.trim(); }

  function inList(videoId) {
    if (!S) return false;
    if (S.current && S.current.videoId === videoId) return true;
    return S.queue.some(function (x) { return x.videoId === videoId; });
  }

  function looksLikeLink(s) {
    return /(youtube\.com|youtu\.be)\//i.test(s);
  }

  /* ------------------------------------------------------------ */
  /* Quyền quản lý                                                 */
  /* ------------------------------------------------------------ */
  function applyRole() {
    var required = !!(S && S.settings.pinRequired);
    admin = !required || pinVerified;
    document.body.classList.toggle('guest', !admin);
    var lock = $('btn-lock');
    lock.hidden = !required;
    lock.classList.toggle('admin', admin);
    $('lock-label').textContent = admin ? 'Quản lý' : 'Khách';
    lock.querySelector('use').setAttribute('href', admin ? '#i-unlock' : '#i-lock');
    renderKeys = {};
  }

  function checkPin(p) {
    return KL.postJson('/api/check-pin', { pin: p }).then(function () { return true; }, function () { return false; });
  }

  function openPin() {
    $('pin-err').textContent = '';
    $('pin-input').value = '';
    $('pin-logout').hidden = !pinVerified;
    if (!$('dlg-pin').open) $('dlg-pin').showModal();
    setTimeout(function () { $('pin-input').focus(); }, 50);
  }

  $('btn-lock').addEventListener('click', openPin);
  $('pin-close').addEventListener('click', function () { $('dlg-pin').close(); });
  $('pin-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('pin-input').value.trim();
    checkPin(p).then(function (ok) {
      if (!ok) {
        $('pin-err').textContent = 'Mã không đúng.';
        $('pin-input').select();
        return;
      }
      pin = p;
      store.set('pin', p);
      pinVerified = true;
      $('dlg-pin').close();
      applyRole();
      render();
      toast('Đã vào chế độ quản lý');
    });
  });
  $('pin-logout').addEventListener('click', function () {
    pin = '';
    store.set('pin', '');
    pinVerified = false;
    $('dlg-pin').close();
    applyRole();
    render();
  });

  /* ------------------------------------------------------------ */
  /* Tìm kiếm                                                      */
  /* ------------------------------------------------------------ */
  function withKaraoke(q) {
    q = q.trim();
    return /karaoke/i.test(q) ? q : q + ' karaoke';
  }

  function search(q, opts) {
    opts = opts || {};
    if (!opts.append) {
      var mode = opts.mode || 'plain';
      var full = mode === 'karaoke' ? withKaraoke(q) : q.trim();
      if (!full) return;
      lastQuery = full;
      nextPageToken = '';
      results = [];
      $('result-info').textContent = '';
      $('results').innerHTML = '<div class="empty">Đang tìm “' + esc(full) + '”…</div>';
    }
    var more = $('more-btn');
    if (more) { more.disabled = true; more.textContent = 'Đang tải…'; }
    var params = new URLSearchParams({ q: lastQuery });
    if (opts.append && nextPageToken) params.set('pageToken', nextPageToken);
    getJson('/api/search?' + params).then(function (d) {
      var seen = {};
      results.forEach(function (r) { seen[r.videoId] = 1; });
      var add = (d.items || []).filter(function (r) { return !seen[r.videoId]; });
      results = opts.append ? results.concat(add) : add;
      nextPageToken = d.nextPageToken || '';
      renderResults(d.cached);
    }).catch(function (err) {
      if (opts.append) {
        toast(err.message, 'error');
        renderResults(false);
      } else {
        renderSearchError(err);
      }
    });
  }

  function resultHtml(r) {
    var has = inList(r.videoId);
    return '<div class="item" data-vid="' + esc(r.videoId) + '">'
      + '<div class="thumb"><img loading="lazy" src="' + thumb(r.videoId) + '" alt="">'
      + (r.duration ? '<span class="dur">' + fmtTime(r.duration) + '</span>' : '') + '</div>'
      + '<div class="meta"><div class="title">' + esc(r.title) + '</div>'
      + '<div class="sub"><span class="ch"><b>Kênh:</b> <span>' + esc(r.channel) + '</span></span>'
      + (r.views ? '<span class="views">👁 ' + KL.fmtViews(r.views) + '</span>' : '') + '</div></div>'
      + '<div class="acts">'
      + '<button class="ib ib-blue admin-only" data-r="next" title="Ưu tiên: hát ngay sau bài đang phát" aria-label="Ưu tiên"><svg class="ic"><use href="#i-top"/></svg></button>'
      + '<button class="add-btn' + (has ? ' done' : '') + '" data-r="add">' + (has ? '✓ Đã thêm' : '<svg class="ic"><use href="#i-plus"/></svg>Thêm') + '</button>'
      + '</div></div>';
  }

  function renderResults(cached) {
    $('result-info').textContent = results.length
      ? 'Tìm thấy ' + results.length + ' bài cho “' + lastQuery + '”' + (cached ? ' · kết quả đã lưu, không tốn lượt tìm' : '')
      : '';
    var html = results.map(resultHtml).join('');
    if (!results.length) html = '<div class="empty">Không thấy bài nào cho “' + esc(lastQuery) + '”. Thử bỏ bớt chữ hoặc đổi cách viết.</div>';
    if (nextPageToken && results.length) html += '<button class="btn more-btn" id="more-btn">Xem thêm</button>';
    $('results').innerHTML = html;
  }

  function markResults() {
    $$('#results .item').forEach(function (el) {
      var has = inList(el.dataset.vid);
      var b = el.querySelector('.add-btn');
      if (b.classList.contains('done') === has) return;
      b.classList.toggle('done', has);
      b.innerHTML = has ? '✓ Đã thêm' : '<svg class="ic"><use href="#i-plus"/></svg>Thêm';
    });
  }

  function renderSearchError(err) {
    $('result-info').textContent = '';
    if (err.code === 'nokey' || err.code === 'keyinvalid' || err.code === 'forbidden' || err.code === 'quota') {
      var head = err.code === 'nokey' ? 'Chưa có khóa YouTube API'
        : err.code === 'quota' ? 'Hết lượt tìm kiếm hôm nay' : 'Khóa YouTube API chưa dùng được';
      $('results').innerHTML = '<div class="notice-card"><h4>' + head + '</h4>'
        + '<div>' + esc(err.message) + '</div>'
        + (err.code === 'nokey' ? '<ol><li>Vào <b>console.cloud.google.com</b>, tạo dự án (miễn phí).</li>'
          + '<li>Bật <b>YouTube Data API v3</b>.</li><li>Tạo <b>API key</b> (Credentials → Create credentials).</li>'
          + '<li>Dán khóa vào <b>Cài đặt</b> của phần mềm.</li></ol>' : '')
        + '<div>Trong lúc chờ: dán link YouTube vào ô <b>Danh sách phát</b> để thêm bài.</div>'
        + (admin ? '<button class="btn btn-blue" id="open-settings-2">Mở Cài đặt</button>' : '')
        + '</div>';
      var b = $('open-settings-2');
      if (b) b.addEventListener('click', openSettings);
      return;
    }
    $('results').innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
  }

  $('results').addEventListener('click', function (e) {
    if (e.target.closest('#more-btn')) {
      search('', { append: true });
      return;
    }
    var b = e.target.closest('[data-r]');
    if (!b) return;
    var vid = b.closest('.item').dataset.vid;
    var r = results.filter(function (x) { return x.videoId === vid; })[0];
    if (!r) return;
    var next = b.dataset.r === 'next';
    act('add', { video: r, singer: singer(), next: next }).then(function (res) {
      if (res) toast((next ? 'Ưu tiên: ' : 'Đã thêm: ') + r.title);
    });
  });

  // Enter trên trang Karaoke: tìm bản karaoke; nút TÌM: tìm đúng chữ đã gõ
  function enterMode() { return activeGenre === 'karaoke' ? 'karaoke' : 'plain'; }
  function runSearch(mode, fallback) {
    var q = $('q').value.trim();
    if (looksLikeLink(q)) return addLink(q, function () { $('q').value = ''; });
    if (!q && !fallback) { $('q').focus(); return; }
    $('q').blur();
    search(q || fallback, { mode: mode });
  }
  $('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    runSearch(enterMode());
  });
  $('btn-find').addEventListener('click', function () { runSearch('plain'); });
  $('btn-karaoke').addEventListener('click', function () { runSearch('karaoke', 'nhạc trẻ'); });

  function renderChips() {
    var g = GENRES[activeGenre];
    $('search-title').textContent = g.title;
    $('chips').innerHTML = g.chips.map(function (ch, i) {
      return '<button class="chip' + (ch.mod ? ' mod' : '') + '" data-i="' + i + '">' + (ch.mod ? '+ ' : '') + esc(ch.l) + '</button>';
    }).join('');
    $$('[data-genre]').forEach(function (b) { b.classList.toggle('on', b.dataset.genre === activeGenre); });
  }

  $('chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    var ch = GENRES[activeGenre].chips[+b.dataset.i];
    if (ch.mod) {
      // bổ sung vào ô tìm (vd thêm "tone nữ")
      var cur = $('q').value.trim();
      if (!cur) {
        toast('Gõ tên bài trước, rồi bấm “' + ch.l + '”', 'warn');
        $('q').focus();
        return;
      }
      if (cur.toLowerCase().indexOf(ch.q) < 0) cur = cur + ' ' + ch.q;
      $('q').value = cur;
      search(cur, { mode: 'karaoke' });
    } else {
      $('q').value = '';
      search(ch.q, { mode: 'plain' });
      $$('#chips .chip').forEach(function (x) { x.classList.toggle('on', x === b); });
    }
  });

  function selectGenre(name) {
    activeGenre = name;
    renderChips();
    $('q').value = '';
    showTab('search');
    if (S && !S.settings.hasApiKey) {
      renderSearchError({ code: 'nokey', message: 'Chưa có khóa YouTube API nên chưa tìm được. Vẫn dán được link YouTube để thêm bài.' });
      return;
    }
    search(GENRES[name].q, { mode: 'plain' });
  }
  $$('[data-genre]').forEach(function (b) {
    b.addEventListener('click', function () { selectGenre(b.dataset.genre); });
  });

  /* Giọng nói */
  var voiceLang = $('voice-lang');
  voiceLang.value = store.get('voiceLang', '');
  voiceLang.addEventListener('change', function () { store.set('voiceLang', voiceLang.value); });
  var recognition = null;
  $('btn-voice').addEventListener('click', function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast('Trình duyệt này chưa hỗ trợ tìm bằng giọng nói. Hãy dùng Chrome, hoặc nút micro trên bàn phím điện thoại.', 'warn');
      return;
    }
    if (!window.isSecureContext) {
      toast('Tìm bằng giọng nói chỉ chạy trên máy chủ (localhost) hoặc trang https. Trên điện thoại hãy bấm nút micro trên bàn phím.', 'warn');
      return;
    }
    if (recognition) {
      recognition.stop();
      return;
    }
    recognition = new SR();
    recognition.lang = voiceLang.value || navigator.language || 'vi-VN';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    $('btn-voice').classList.add('listening');
    $('q').value = '';
    $('q').placeholder = 'Đang nghe… hãy nói tên bài hát';
    recognition.onresult = function (e) {
      var text = '';
      for (var i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      $('q').value = text;
      if (e.results[e.results.length - 1].isFinal) search(text, { mode: enterMode() });
    };
    recognition.onerror = function (e) {
      var m = { 'not-allowed': 'Chưa cho phép dùng micro.', 'no-speech': 'Không nghe thấy gì, thử lại.', network: 'Nhận giọng nói cần Internet.' }[e.error];
      toast(m || 'Lỗi nhận giọng nói: ' + e.error, 'warn');
    };
    recognition.onend = function () {
      recognition = null;
      $('btn-voice').classList.remove('listening');
      $('q').placeholder = 'Tên bài hát, ca sĩ…';
    };
    recognition.start();
  });

  var singerInput = $('singer');
  singerInput.value = store.get('singer', '');
  singerInput.addEventListener('change', function () { store.set('singer', singerInput.value.trim()); });

  /* ------------------------------------------------------------ */
  /* Thêm bằng link                                                */
  /* ------------------------------------------------------------ */
  function addLink(url, done) {
    getJson('/api/link?' + new URLSearchParams({ url: url })).then(function (d) {
      if (d.playlist) {
        var n = d.playlist.items.length;
        if (!confirm('Thêm ' + n + ' bài từ danh sách phát' + (d.playlist.title ? ' “' + d.playlist.title + '”' : '') + '?')) return;
        return act('add', { videos: d.playlist.items, singer: singer() }).then(function (res) {
          if (res) { toast('Đã thêm ' + res.added + ' bài'); if (done) done(); }
        });
      }
      return act('add', { video: d.video, singer: singer() }).then(function (res) {
        if (res) { toast('Đã thêm: ' + d.video.title); if (done) done(); }
      });
    }).catch(function (err) { toast(err.message, 'error'); });
  }
  $('link-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('link').value.trim();
    if (!v) { $('link').focus(); return; }
    addLink(v, function () { $('link').value = ''; });
  });

  /* ------------------------------------------------------------ */
  /* Danh sách phát                                                */
  /* ------------------------------------------------------------ */
  function itemHtml(x, o) {
    var sub = '<span class="ch"><b>Kênh:</b> <span>' + esc(x.channel || 'YouTube') + '</span></span>'
      + (x.singer ? '<span class="singer">🎤 ' + esc(x.singer) + '</span>' : '')
      + (x.duration ? '<span class="dur-t">' + fmtTime(x.duration) + '</span>' : '');
    var acts = '';
    if (o.current) {
      var st = S.playback.status;
      var label = S.screen !== 'show' ? 'Đang chờ' : st === 'playing' ? 'Đang phát' : st === 'paused' ? 'Tạm dừng' : 'Đã dừng';
      acts = '<span class="now-badge' + (st === 'playing' && S.screen === 'show' ? '' : ' paused') + '">' + label + '</span>';
    } else if (o.history) {
      acts = '<button class="ib ib-blue admin-only" data-h="play" title="Phát ngay" aria-label="Phát ngay"><svg class="ic"><use href="#i-play"/></svg></button>'
        + '<button class="ib ib-green" data-h="add" title="Thêm lại vào danh sách" aria-label="Thêm lại"><svg class="ic"><use href="#i-plus"/></svg></button>'
        + '<button class="ib ib-red admin-only" data-h="remove" title="Xóa khỏi lịch sử" aria-label="Xóa"><svg class="ic"><use href="#i-x"/></svg></button>';
    } else if (admin) {
      acts = '<button class="ib ib-blue" data-q="playNow" title="Phát ngay" aria-label="Phát ngay"><svg class="ic"><use href="#i-play"/></svg></button>'
        + '<div class="updown"><button data-q="up" title="Lên" aria-label="Lên"><svg class="ic"><use href="#i-up"/></svg></button>'
        + '<button data-q="down" title="Xuống" aria-label="Xuống"><svg class="ic"><use href="#i-down"/></svg></button></div>'
        + '<button class="ib" data-q="top" title="Đưa lên đầu" aria-label="Đưa lên đầu"><svg class="ic"><use href="#i-top"/></svg></button>'
        + '<button class="ib ib-red" data-q="remove" title="Xóa khỏi danh sách" aria-label="Xóa"><svg class="ic"><use href="#i-x"/></svg></button>';
    }
    return '<div class="item' + (o.current ? ' current' : '') + '" data-uid="' + esc(x.uid) + '">'
      + '<div class="thumb"><img loading="lazy" src="' + thumb(x.videoId) + '" alt=""></div>'
      + '<div class="meta"><div class="title">' + (o.idx ? '<span class="idx">' + o.idx + '.</span>' : '') + esc(x.title) + '</div>'
      + '<div class="sub">' + sub + '</div></div>'
      + (acts ? '<div class="acts">' + acts + '</div>' : '')
      + '</div>';
  }

  function renderQueue() {
    var key = JSON.stringify([S.current && S.current.playId, S.playback.status, S.screen, S.queue.map(function (x) { return x.uid; }), admin]);
    if (key !== renderKeys.queue) {
      renderKeys.queue = key;
      var html = '';
      var n = 0;
      if (S.current) html += itemHtml(S.current, { current: true, idx: ++n });
      S.queue.forEach(function (x) { html += itemHtml(x, { idx: ++n }); });
      if (!html) {
        html = '<div class="empty">Danh sách trống.<br>Tìm bài rồi bấm <b>+ Thêm</b>, hoặc dán link YouTube ở trên.</div>';
      }
      $('queue').innerHTML = html;
    }
    var total = S.queue.length + (S.current ? 1 : 0);
    $('queue-count').textContent = total;
    $('tab-badge').textContent = S.queue.length || '';

    var hkey = JSON.stringify([S.history.map(function (x) { return x.uid; }), admin]);
    if (hkey !== renderKeys.history) {
      renderKeys.history = hkey;
      $('history').innerHTML = S.history.length
        ? S.history.map(function (x, i) { return itemHtml(x, { history: true, idx: i + 1 }); }).join('')
        : '<div class="empty">Chưa có bài nào đã phát.</div>';
    }
    $('history-count').textContent = S.history.length;
    $('loop-queue').checked = !!S.loopQueue;
  }

  $('queue').addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]');
    if (!b) return;
    var uid = b.closest('.item').dataset.uid;
    var q = b.dataset.q;
    if (q === 'playNow') act('playNow', { uid: uid });
    else if (q === 'remove') act('remove', { uid: uid });
    else act('move', { uid: uid, to: q });
  });
  $('history').addEventListener('click', function (e) {
    var b = e.target.closest('[data-h]');
    if (!b) return;
    var uid = b.closest('.item').dataset.uid;
    var h = S.history.filter(function (x) { return x.uid === uid; })[0];
    if (!h) return;
    if (b.dataset.h === 'play') act('playNow', { historyUid: uid });
    else if (b.dataset.h === 'remove') act('removeHistory', { historyUid: uid });
    else {
      act('add', { video: h, singer: h.singer }).then(function (res) { if (res) toast('Đã thêm lại: ' + h.title); });
    }
  });
  $('loop-queue').addEventListener('change', function (e) { act('loopQueue', { value: e.target.checked }); });
  $('btn-shuffle').addEventListener('click', function () { act('shuffle'); });
  $('btn-clear-queue').addEventListener('click', function () {
    if (S.queue.length && confirm('Xóa hết ' + S.queue.length + ' bài đang chờ?')) act('clearQueue');
  });
  $('btn-clear-history').addEventListener('click', function () {
    if (S.history.length && confirm('Xóa lịch sử bài đã phát?')) act('clearHistory');
  });

  /* ------------------------------------------------------------ */
  /* Màn hình LED / điều khiển                                     */
  /* ------------------------------------------------------------ */
  function renderPreview() {
    var cur = S.current;
    var view = S.screen === 'blackout' ? 'blackout'
      : !cur || S.playback.status === 'stopped' || S.screen === 'standby' ? 'standby' : 'video';
    $('preview').dataset.view = view;
    var img = $('pv-thumb');
    if (cur && img.dataset.vid !== cur.videoId) {
      img.dataset.vid = cur.videoId;
      img.onerror = function () { img.onerror = null; img.src = thumb(cur.videoId, true); };
      img.src = 'https://i.ytimg.com/vi/' + cur.videoId + '/maxresdefault.jpg';
    }
    $('pv-standby-text').textContent = S.screen === 'standby' ? 'Màn hình chờ'
      : !cur ? 'Màn hình chờ · chưa có bài' : 'Đã dừng · màn hình chờ';
    $('np-title').textContent = cur ? cur.title : 'Chưa phát bài nào';
    $('np-sub').textContent = cur
      ? [cur.channel, cur.singer ? '🎤 ' + cur.singer : ''].filter(Boolean).join(' · ')
      : S.queue.length ? 'Bấm Phát để bắt đầu' : 'Tìm bài và bấm + Thêm';

    var live = $('live-badge');
    var playing = cur && S.playback.status === 'playing' && S.screen === 'show';
    live.textContent = playing ? 'ĐANG PHÁT' : cur && S.playback.status === 'paused' ? 'TẠM DỪNG' : S.screen === 'blackout' ? 'TẮT MÀN HÌNH' : '';
    live.classList.toggle('paused', !playing);

    var fx = FX.filter(function (f) { return f[0] === S.effect; })[0];
    $('pv-fx').textContent = fx && fx[0] !== 'none' ? fx[1] + ' ' + fx[2] : '';
    var t = S.ticker;
    var pt = $('pv-ticker');
    pt.classList.toggle('on', !!(t.show && t.text));
    pt.classList.toggle('top', t.position === 'top');
    pt.style.color = t.color;
    pt.firstElementChild.textContent = t.text;

    var d = $('displays');
    if (S.displays > 0) {
      d.textContent = '✓ ' + S.displays + ' màn hình LED đang kết nối';
      d.classList.remove('warn');
    } else {
      d.textContent = '⚠ Chưa có màn hình LED nào kết nối. Bấm “Mở LED” hoặc “Kết nối thiết bị”.';
      d.classList.add('warn');
    }

    $('btn-repeat').classList.toggle('on', !!S.repeatOne);
    $('btn-mute').classList.toggle('on', !!S.muted);
    if (!volDragging) {
      $('volume').value = S.volume;
      $('vol-val').textContent = S.muted ? 'Tắt tiếng' : S.volume + '%';
    }
    $$('[data-screen]').forEach(function (b) { b.classList.toggle('on', S.screen === b.dataset.screen); });
    $$('#fx-grid .fx-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.fx === S.effect); });
    $('standby-info').textContent = S.standby.type === 'image' ? 'đang dùng ảnh riêng'
      : S.standby.type === 'video' ? 'đang dùng video riêng' : 'mặc định';

    // ô chữ chạy: chỉ điền khi người dùng không đang gõ
    if (document.activeElement !== $('ticker-input') && firstTicker) {
      firstTicker = false;
      $('ticker-input').value = t.text || '';
      $('ticker-color').value = t.color || '#ffe14d';
      $('ticker-speed').value = t.speed || 'normal';
      $('ticker-pos').value = t.position || 'bottom';
      $('ticker-size').value = t.size || 'medium';
    }

    // thanh mini trên điện thoại
    $('mini').classList.toggle('hidden', !cur);
    if (cur) {
      $('mini-title').textContent = cur.title;
      var mt = $('mini-thumb');
      if (mt.dataset.vid !== cur.videoId) { mt.dataset.vid = cur.videoId; mt.src = thumb(cur.videoId); }
      $('mini-toggle').querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    }
  }
  var firstTicker = true;

  function tickProgress() {
    var pos = progress.position;
    if (progress.status === 'playing') pos += (Date.now() - progress.at) / 1000;
    var dur = progress.duration || 0;
    if (dur) pos = Math.min(pos, dur);
    if (!S || !S.current) { pos = 0; dur = 0; }
    var seek = $('seek');
    if (!seeking) {
      seek.max = Math.max(1, Math.floor(dur));
      seek.value = Math.floor(pos);
      $('t-pos').textContent = fmtTime(pos);
    }
    $('t-dur').textContent = fmtTime(dur);
    $('mini-time').textContent = S && S.current ? fmtTime(pos) + ' / ' + fmtTime(dur) : '';
  }
  setInterval(tickProgress, 250);

  var seekEl = $('seek');
  seekEl.addEventListener('input', function () {
    seeking = true;
    $('t-pos').textContent = fmtTime(+seekEl.value);
  });
  seekEl.addEventListener('change', function () {
    seeking = false;
    if (!S || !S.current) return;
    progress.position = +seekEl.value;
    progress.at = Date.now();
    act('seek', { to: +seekEl.value });
  });

  $$('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = b.dataset.act;
      if (a === 'repeatOne') act('repeatOne', { value: !S.repeatOne });
      else if (a === 'mute') act('mute', { value: !S.muted });
      else if (a === 'next' && !S.queue.length && S.current && !confirm('Danh sách hết bài. Vẫn tắt bài đang hát?')) return;
      else act(a);
    });
  });
  $('mini-toggle').addEventListener('click', function () { act('toggle'); });

  var volTimer = 0;
  var volEl = $('volume');
  volEl.addEventListener('input', function () {
    volDragging = true;
    $('vol-val').textContent = volEl.value + '%';
    clearTimeout(volTimer);
    volTimer = setTimeout(function () { act('volume', { value: +volEl.value }); }, 120);
  });
  volEl.addEventListener('change', function () {
    clearTimeout(volTimer);
    act('volume', { value: +volEl.value }).then(function () { volDragging = false; });
  });

  $('fx-grid').innerHTML = FX.map(function (f) {
    return '<button class="fx-btn" data-fx="' + f[0] + '"><span>' + f[1] + '</span>' + esc(f[2]) + '</button>';
  }).join('');
  $('fx-grid').addEventListener('click', function (e) {
    var b = e.target.closest('.fx-btn');
    if (!b) return;
    var v = b.dataset.fx;
    act('effect', { value: v === S.effect ? 'none' : v });
  });

  function tickerData() {
    return {
      text: $('ticker-input').value.trim(),
      color: $('ticker-color').value,
      speed: $('ticker-speed').value,
      position: $('ticker-pos').value,
      size: $('ticker-size').value,
    };
  }
  $('ticker-show').addEventListener('click', function () {
    var d = tickerData();
    if (!d.text) { toast('Nhập chữ cần hiện trước', 'warn'); $('ticker-input').focus(); return; }
    d.show = true;
    act('ticker', d);
  });
  $('ticker-hide').addEventListener('click', function () { act('ticker', { show: false }); });
  ['ticker-color', 'ticker-speed', 'ticker-pos', 'ticker-size'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var d = tickerData();
      delete d.text;
      act('ticker', d);
    });
  });

  $('announce-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('announce-input').value.trim();
    if (!text) return;
    act('announce', { text: text, seconds: 8 }).then(function (res) {
      if (res) { $('announce-input').value = ''; toast('Đã hiện thông báo trên LED'); }
    });
  });

  $$('[data-screen]').forEach(function (b) {
    b.addEventListener('click', function () { act('screen', { value: b.dataset.screen }); });
  });

  /* Màn hình chờ: tải ảnh / video */
  function upload(file) {
    if (!file) return;
    if (file.size > 300 * 1024 * 1024) { toast('File quá lớn (tối đa 300 MB)', 'error'); return; }
    var bar = $('upload-bar');
    bar.classList.add('on');
    bar.firstElementChild.style.width = '0';
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    if (pin) xhr.setRequestHeader('X-Pin', pin);
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) bar.firstElementChild.style.width = (e.loaded / e.total * 100).toFixed(0) + '%';
    };
    xhr.onload = function () {
      bar.classList.remove('on');
      var d = {};
      try { d = JSON.parse(xhr.responseText); } catch (err) { /* bỏ qua */ }
      if (xhr.status === 200) toast('Đã đổi màn hình chờ');
      else toast(d.error || 'Tải lên không được', 'error');
    };
    xhr.onerror = function () { bar.classList.remove('on'); toast('Mất kết nối khi tải lên', 'error'); };
    xhr.send(file);
  }
  $('up-video').addEventListener('change', function (e) { upload(e.target.files[0]); e.target.value = ''; });
  $('up-image').addEventListener('change', function (e) { upload(e.target.files[0]); e.target.value = ''; });
  $('standby-reset').addEventListener('click', function () { act('standbyReset'); });

  /* Mở cửa sổ màn hình LED */
  function openLed() {
    if (window.matchMedia('(max-width: 760px)').matches) {
      openConnect();
      return;
    }
    var features = 'popup,width=1280,height=720';
    function go(f) {
      var w = window.open('/led', 'karaled-led', f);
      if (!w) toast('Trình duyệt chặn cửa sổ mới. Cho phép cửa sổ bật lên (pop-up) cho trang này, hoặc mở ' + location.origin + '/led', 'warn');
      else {
        w.focus();
        toast('Kéo cửa sổ sang màn hình LED, bấm vào nó một lần để bật tiếng (phím F: toàn màn hình)');
      }
    }
    if (!('getScreenDetails' in window) || !navigator.permissions) return go(features);
    navigator.permissions.query({ name: 'window-management' }).then(function (p) {
      if (p.state !== 'granted') return go(features);
      return window.getScreenDetails().then(function (sd) {
        var others = sd.screens.filter(function (s) { return s !== sd.currentScreen; });
        var t = others.filter(function (s) { return !s.isInternal; })[0] || others[0];
        if (t) features = 'popup,left=' + t.availLeft + ',top=' + t.availTop + ',width=' + t.availWidth + ',height=' + t.availHeight;
        go(features);
      });
    }).catch(function () { go(features); });
  }
  $('btn-open-led').addEventListener('click', openLed);

  /* ------------------------------------------------------------ */
  /* Kết nối thiết bị                                              */
  /* ------------------------------------------------------------ */
  function baseUrls() {
    var list = (S && S.lanUrls) || [];
    var local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    if (!local && list.indexOf(location.origin) < 0) list = [location.origin].concat(list);
    else if (!local) list = [location.origin].concat(list.filter(function (u) { return u !== location.origin; }));
    return list.length ? list : [location.origin];
  }
  function renderConnect() {
    var urls = baseUrls();
    var pick = $('lan-pick');
    var chosen = pick.value && urls.indexOf(pick.value) >= 0 ? pick.value : urls[0];
    pick.innerHTML = urls.map(function (u) { return '<option' + (u === chosen ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('');
    $('lan-pick-row').hidden = urls.length < 2;
    $('qr-ctl').innerHTML = KL.qrSvg(chosen + '/');
    $('qr-led').innerHTML = KL.qrSvg(chosen + '/led');
    $('url-ctl').textContent = chosen.replace(/^https?:\/\//, '');
    $('url-ctl').href = chosen + '/';
    $('url-led').textContent = chosen.replace(/^https?:\/\//, '') + '/led';
    $('url-led').href = chosen + '/led';
    if (S) $('conn-status').textContent = 'Đang kết nối: ' + S.displays + ' màn hình LED · ' + S.controllers + ' thiết bị điều khiển';
  }
  function openConnect() {
    renderConnect();
    $('btn-screens').hidden = !('getScreenDetails' in window);
    $('dlg-connect').showModal();
  }
  $('btn-connect').addEventListener('click', openConnect);
  $('lan-pick').addEventListener('change', renderConnect);
  $('btn-screens').addEventListener('click', function () {
    window.getScreenDetails().then(function (sd) {
      toast(sd.screens.length > 1 ? 'Đã cho phép. Bấm “Mở LED” để mở thẳng sang màn hình thứ hai.' : 'Máy đang chỉ có 1 màn hình.');
    }).catch(function () { toast('Chưa được cho phép quản lý cửa sổ.', 'warn'); });
  });

  /* ------------------------------------------------------------ */
  /* Cài đặt                                                       */
  /* ------------------------------------------------------------ */
  function openSettings() {
    var st = S.settings;
    $('set-name').value = st.appName || '';
    $('set-slogan').value = st.slogan || '';
    $('set-hotline').value = st.hotline || '';
    $('set-qr').checked = !!st.showQr;
    $('set-autoplay').checked = !!st.autoPlay;
    $('set-key').value = '';
    $('set-pin').value = '';
    renderSettingsStatus();
    $('dlg-settings').showModal();
  }
  function renderSettingsStatus() {
    var st = S.settings;
    $('key-status').textContent = st.hasApiKey ? '✓ Đã có khóa, tìm bài được.' : '✗ Chưa có khóa: chỉ thêm bài bằng link YouTube được.';
    $('pin-status').textContent = st.pinRequired ? '✓ Đang dùng mã quản lý.' : 'Chưa đặt mã: ai mở trang này cũng điều khiển được.';
    $('btn-remove-pin').hidden = !st.pinRequired;
  }
  $('btn-settings').addEventListener('click', openSettings);
  $('settings-cancel').addEventListener('click', function () { $('dlg-settings').close(); });
  $('btn-add-key').addEventListener('click', function () {
    var k = $('set-key').value.trim();
    if (!k) { $('set-key').focus(); return; }
    act('settings', { addApiKey: k }).then(function (res) {
      if (!res) return;
      $('set-key').value = '';
      toast('Đã thêm khóa YouTube API');
      setTimeout(renderSettingsStatus, 300);
    });
  });
  $('btn-clear-keys').addEventListener('click', function () {
    if (!confirm('Xóa các khóa YouTube API đã nhập trong Cài đặt? (Khóa trong file .env vẫn giữ)')) return;
    act('settings', { clearApiKeys: true }).then(function (res) {
      if (res) { toast('Đã xóa khóa'); setTimeout(renderSettingsStatus, 300); }
    });
  });
  $('btn-remove-pin').addEventListener('click', function () {
    if (!confirm('Bỏ mã quản lý? Ai mở trang điều khiển cũng điều khiển được.')) return;
    act('settings', { newPin: '' }).then(function (res) {
      if (res) { toast('Đã bỏ mã quản lý'); setTimeout(renderSettingsStatus, 300); }
    });
  });
  $('settings-save').addEventListener('click', function () {
    var data = {
      appName: $('set-name').value,
      slogan: $('set-slogan').value,
      hotline: $('set-hotline').value,
      showQr: $('set-qr').checked,
      autoPlay: $('set-autoplay').checked,
    };
    var newPin = $('set-pin').value.trim();
    if (newPin) {
      if (!/^\d{4,8}$/.test(newPin)) { toast('Mã quản lý gồm 4–8 chữ số', 'error'); return; }
      data.newPin = newPin;
    }
    act('settings', data).then(function (res) {
      if (!res) return;
      if (newPin) {
        pin = newPin;
        store.set('pin', newPin);
        pinVerified = true;
      }
      $('dlg-settings').close();
      toast('Đã lưu cài đặt');
    });
  });

  /* ------------------------------------------------------------ */
  /* Chuyển trang trên điện thoại                                  */
  /* ------------------------------------------------------------ */
  function showTab(t) {
    $('layout').dataset.tab = t;
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    store.set('tab', t);
  }
  $$('.tabbar button').forEach(function (b) {
    b.addEventListener('click', function () {
      showTab(b.dataset.tab);
      window.scrollTo(0, document.querySelector('.layout').offsetTop - 4);
    });
  });
  showTab(store.get('tab', 'search'));
  $('mini').addEventListener('click', function (e) {
    if (!e.target.closest('button')) showTab('control');
  });

  /* Phím tắt trên máy tính */
  document.addEventListener('keydown', function (e) {
    if (!admin || !S || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.querySelector('dialog[open]')) return;
    if (e.code === 'Space') { e.preventDefault(); act('toggle'); }
    else if (e.key === 'n' || e.key === 'N') act('next');
  });

  /* ------------------------------------------------------------ */
  /* Nhận dữ liệu từ máy chủ                                       */
  /* ------------------------------------------------------------ */
  function render() {
    if (!S) return;
    var st = S.settings;
    $('brand-name').textContent = st.appName;
    $('brand-sub').textContent = st.slogan || '';
    $('brand-hot').textContent = st.hotline ? '📱 ' + st.hotline : '';
    document.title = st.appName + ' – Điều khiển';
    renderQueue();
    renderPreview();
    markResults();
    if ($('dlg-connect').open) renderConnect();
  }

  KL.connect('controller', {
    status: function (ok) {
      $('conn-dot').classList.toggle('ok', ok);
      $('conn-dot').title = ok ? 'Đã kết nối máy chủ' : 'Mất kết nối máy chủ';
    },
    state: function (s) {
      var wasRequired = S && S.settings.pinRequired;
      S = s;
      progress = {
        playId: s.current && s.current.playId,
        position: s.playback.position,
        duration: s.playback.duration || (s.current && s.current.duration) || 0,
        status: s.screen === 'show' ? s.playback.status : 'paused',
        at: Date.now(),
      };
      if (firstState || wasRequired !== s.settings.pinRequired) {
        if (s.settings.pinRequired && pin && !pinVerified) {
          checkPin(pin).then(function (ok) {
            pinVerified = ok;
            if (!ok) { pin = ''; store.set('pin', ''); }
            applyRole();
            render();
          });
        }
        applyRole();
      }
      render();
      if (firstState) {
        firstState = false;
        renderChips();
        if (s.settings.hasApiKey) search(GENRES.karaoke.q, { mode: 'plain' });
        else renderSearchError({ code: 'nokey', message: 'Chưa có khóa YouTube API nên chưa tìm được. Vẫn dán được link YouTube để thêm bài.' });
      }
    },
    progress: function (p) {
      if (!S || !S.current || p.playId !== S.current.playId) return;
      progress = {
        playId: p.playId, position: p.position, duration: p.duration || progress.duration,
        status: S.screen === 'show' && !p.buffering ? p.status : 'paused', at: Date.now(),
      };
    },
    notice: function (n) { toast(n.text, n.level); },
  });
})();
