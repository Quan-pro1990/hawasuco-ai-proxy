/* Trang màn hình LED: phát video YouTube theo lệnh từ máy chủ, hiện màn hình chờ, chữ chạy, hiệu ứng */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  var S = null;              // trạng thái mới nhất từ máy chủ
  var receivedAt = 0;
  var player = null;
  var playerReady = false;
  var loadedPlayId = null;
  var lastSeekSeq = -1;
  var endedPlayId = null;
  var erroredPlayId = null;
  var unlocked = params.get('auto') === '1';
  var mutedByPolicy = false;
  var notPlayingSince = 0;
  var lastVol = -1, lastMuted = null;
  var bannerTimer = 0, announceTimer = 0;
  var nextShownFor = null;
  var qrFor = '';
  var standbyVer = -1;
  var tickerKey = '';

  var YT_PLAYING = 1, YT_BUFFERING = 3, YT_ENDED = 0;

  LedFx.init($('fx'));

  /* ---------------- Bắt đầu / toàn màn hình ---------------- */
  if (unlocked) $('start').classList.remove('on');

  function unlock() {
    unlocked = true;
    $('start').classList.remove('on');
    var el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function () {});
    if (mutedByPolicy) {
      mutedByPolicy = false;
      lastMuted = null;
    }
    requestWakeLock();
    reconcile();
  }
  $('start').addEventListener('click', unlock);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    } else if (e.key === 'Enter' || e.key === ' ') {
      unlock();
    }
  });
  document.addEventListener('dblclick', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  });

  var cursorTimer = 0;
  document.addEventListener('mousemove', function () {
    document.body.classList.add('show-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function () { document.body.classList.remove('show-cursor'); }, 2500);
  });

  var wakeLock = null;
  function requestWakeLock() {
    if (!navigator.wakeLock || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l;
      l.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
  requestWakeLock();

  /* ---------------- YouTube ---------------- */
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        rel: 0,
        playsinline: 1,
        modestbranding: 1,
        cc_load_policy: 0,
        origin: location.origin,
      },
      events: {
        onReady: function () {
          playerReady = true;
          $('yt-error').classList.remove('on');
          reconcile();
        },
        onStateChange: function (e) {
          if (e.data === YT_ENDED && loadedPlayId && endedPlayId !== loadedPlayId) {
            endedPlayId = loadedPlayId;
            KL.postJson('/api/display/ended', { playId: loadedPlayId }).catch(function () {});
          }
          if (e.data === YT_PLAYING) notPlayingSince = 0;
        },
        onError: function (e) {
          if (!loadedPlayId || erroredPlayId === loadedPlayId) return;
          erroredPlayId = loadedPlayId;
          KL.postJson('/api/display/error', { playId: loadedPlayId, code: e.data }).catch(function () {});
        },
      },
    });
  };
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = function () { ytError('Không tải được trình phát YouTube. Kiểm tra Internet rồi tải lại trang (F5).'); };
  document.head.appendChild(tag);
  setTimeout(function () {
    if (!playerReady) ytError('Trình phát YouTube chưa sẵn sàng. Kiểm tra Internet rồi tải lại trang (F5).');
  }, 20000);

  function ytError(msg) {
    $('yt-error').textContent = msg;
    $('yt-error').classList.add('on');
  }

  function estPos() {
    var p = S.playback;
    if (p.status !== 'playing') return p.position;
    return p.position + (Date.now() - receivedAt) / 1000;
  }

  function wantPlay() {
    return !!(S && S.current && S.playback.status === 'playing' && S.screen === 'show');
  }

  /* Đưa trình phát về đúng trạng thái máy chủ yêu cầu */
  function reconcile() {
    if (!S) return;
    applyVisuals();
    if (!playerReady) return;
    var cur = S.current;
    if (!cur) {
      if (loadedPlayId) {
        player.stopVideo();
        loadedPlayId = null;
        hideBanner();
      }
      return;
    }
    if (cur.playId !== loadedPlayId) {
      loadedPlayId = cur.playId;
      lastSeekSeq = S.seek.seq;
      endedPlayId = null;
      erroredPlayId = null;
      notPlayingSince = 0;
      var start = Math.max(0, estPos());
      if (wantPlay()) player.loadVideoById({ videoId: cur.videoId, startSeconds: start });
      else player.cueVideoById({ videoId: cur.videoId, startSeconds: start });
      if (start < 5) showBanner('ĐANG PHÁT', cur.title, cur.singer ? '🎤 ' + cur.singer : '');
    } else if (S.seek.seq !== lastSeekSeq) {
      lastSeekSeq = S.seek.seq;
      endedPlayId = null;
      player.seekTo(S.seek.to, true);
    }
    enforcePlayState();
    applyVolume();
  }

  function enforcePlayState() {
    if (!playerReady || !loadedPlayId) return;
    var ps = player.getPlayerState();
    if (wantPlay()) {
      if (ps === YT_ENDED && endedPlayId === loadedPlayId) return; // chờ máy chủ chuyển bài
      if (ps !== YT_PLAYING && ps !== YT_BUFFERING) {
        player.playVideo();
        if (!notPlayingSince) notPlayingSince = Date.now();
        // trình duyệt chặn tự phát có tiếng: phát không tiếng và nhắc bấm vào màn hình
        if (!unlocked && !mutedByPolicy && Date.now() - notPlayingSince > 2500) {
          mutedByPolicy = true;
          lastMuted = null;
          applyVolume();
          player.playVideo();
          var st = $('start');
          st.querySelector('.start-title').textContent = 'Bấm vào màn hình để bật tiếng';
          st.classList.add('on');
        }
      } else {
        notPlayingSince = 0;
      }
    } else if (ps === YT_PLAYING || ps === YT_BUFFERING) {
      player.pauseVideo();
    }
  }

  function applyVolume() {
    if (!playerReady) return;
    if (S.volume !== lastVol) {
      player.setVolume(S.volume);
      lastVol = S.volume;
    }
    var m = S.muted || mutedByPolicy;
    if (m !== lastMuted) {
      if (m) player.mute(); else player.unMute();
      lastMuted = m;
    }
  }

  /* ---------------- Phần hiển thị ---------------- */
  function applyVisuals() {
    var st = S.settings || {};
    var cur = S.current;
    $('sb-name').textContent = st.appName || 'KARALED';
    $('sb-slogan').textContent = st.slogan || '';
    $('sb-hotline').textContent = st.hotline ? '☎ ' + st.hotline : '';
    document.title = (st.appName || 'KARALED') + ' – Màn hình LED';

    var standbyOn = !cur || S.playback.status === 'stopped' || S.screen === 'standby';
    var sb = $('standby');
    sb.classList.toggle('on', standbyOn);
    sb.dataset.type = S.standby.type || 'default';
    if (S.standby.ver !== standbyVer) {
      standbyVer = S.standby.ver;
      var img = sb.querySelector('.sb-image');
      var vid = sb.querySelector('.sb-video');
      if (S.standby.type === 'image') img.src = S.standby.src; else img.removeAttribute('src');
      if (S.standby.type === 'video') { vid.src = S.standby.src; } else { vid.removeAttribute('src'); vid.load(); }
    }
    var vid2 = sb.querySelector('.sb-video');
    if (S.standby.type === 'video') {
      if (standbyOn && vid2.paused) vid2.play().catch(function () {});
      else if (!standbyOn && !vid2.paused) vid2.pause();
    }

    var status = '';
    if (cur && S.screen === 'standby') status = '⏸ Tạm dừng: ' + cur.title;
    else if (cur && S.playback.status === 'stopped') status = '■ Đã dừng: ' + cur.title;
    else if (!cur && !S.queue.length) status = 'Mời quý khách chọn bài';
    $('sb-status').textContent = status;

    var next = S.queue.slice(0, 3);
    $('sb-next').innerHTML = next.length
      ? '<b>Bài tiếp theo</b>' + next.map(function (x, i) {
        return '<div class="row">' + (i + 1) + '. ' + KL.esc(x.title) + (x.singer ? ' — 🎤 ' + KL.esc(x.singer) : '') + '</div>';
      }).join('')
      : '';

    var qrBox = $('sb-qr');
    qrBox.hidden = !st.showQr;
    if (st.showQr) {
      var isLocal = /^(localhost|127\.|\[::1\])/.test(location.hostname);
      var url = isLocal ? (S.lanUrls || [])[0] || location.origin : location.origin;
      if (url !== qrFor) {
        qrFor = url;
        $('sb-qr-img').innerHTML = KL.qrSvg(url + '/');
      }
    }

    $('blackout').classList.toggle('on', S.screen === 'blackout');

    var t = S.ticker || {};
    var tk = $('ticker');
    var showTicker = !!(t.show && t.text);
    tk.classList.toggle('on', showTicker);
    tk.classList.toggle('top', t.position === 'top');
    tk.classList.remove('small', 'large');
    if (t.size === 'small' || t.size === 'large') tk.classList.add(t.size);
    document.documentElement.style.setProperty('--ticker-color', t.color || '#ffe14d');
    var key = [t.text, t.speed, t.size, showTicker].join('|');
    if (showTicker && key !== tickerKey) {
      tickerKey = key;
      $('ticker-text').textContent = t.text;
      requestAnimationFrame(function () {
        var track = tk.querySelector('.ticker-track');
        var pxPerSec = { slow: 0.09, normal: 0.15, fast: 0.24 }[t.speed] || 0.15;
        var dur = Math.max(6, track.scrollWidth / (window.innerWidth * pxPerSec));
        document.documentElement.style.setProperty('--ticker-duration', dur.toFixed(1) + 's');
        track.style.animation = 'none';
        void track.offsetWidth;
        track.style.animation = '';
      });
    } else if (!showTicker) {
      tickerKey = '';
    }

    LedFx.set(S.effect || 'none');
  }

  function showBanner(label, title, sub, seconds) {
    $('bn-label').textContent = label;
    $('bn-title').textContent = title;
    $('bn-sub').textContent = sub || '';
    $('banner').classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, (seconds || 8) * 1000);
  }
  function hideBanner() {
    clearTimeout(bannerTimer);
    $('banner').classList.remove('on');
  }

  /* ---------------- Báo cáo về máy chủ ---------------- */
  setInterval(function () {
    if (!S) return;
    enforcePlayState();
    if (!playerReady || !S.current || loadedPlayId !== S.current.playId) return;
    var ps = player.getPlayerState();
    var time = player.getCurrentTime() || 0;
    var dur = player.getDuration() || 0;
    KL.postJson('/api/display/status', {
      playId: loadedPlayId, time: time, duration: dur, playing: ps === YT_PLAYING, buffering: ps === YT_BUFFERING,
    }).catch(function () {});

    // sắp hết bài: báo bài tiếp theo
    if (ps === YT_PLAYING && dur > 60 && dur - time < 25 && nextShownFor !== loadedPlayId && S.queue.length && !S.repeatOne) {
      nextShownFor = loadedPlayId;
      var n = S.queue[0];
      showBanner('BÀI TIẾP THEO', n.title, n.singer ? '🎤 Mời ' + n.singer + ' chuẩn bị' : '', 12);
    }
  }, 1000);

  /* ---------------- Đồng hồ màn hình chờ ---------------- */
  function clock() {
    var d = new Date();
    $('sb-time').textContent = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    $('sb-date').textContent = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  clock();
  setInterval(clock, 1000);

  /* ---------------- Kết nối máy chủ ---------------- */
  KL.connect('display', {
    status: function (ok) { $('conn').classList.toggle('on', !ok); },
    state: function (s) {
      S = s;
      receivedAt = Date.now();
      reconcile();
    },
    announce: function (a) {
      $('announce-text').textContent = a.text;
      $('announce').classList.add('on');
      clearTimeout(announceTimer);
      announceTimer = setTimeout(function () { $('announce').classList.remove('on'); }, (a.seconds || 8) * 1000);
    },
  });
})();
