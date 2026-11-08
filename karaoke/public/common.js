/* Tiện ích dùng chung cho trang điều khiển và trang màn hình LED */
'use strict';
window.KL = (function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var ss = (s < 10 ? '0' : '') + s;
    return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
  }

  function fmtViews(n) {
    n = +n || 0;
    function d(x) { return (x < 10 ? x.toFixed(1) : Math.round(x).toString()).replace('.', ',').replace(/,0$/, ''); }
    if (n >= 1e9) return d(n / 1e9) + ' Tỷ';
    if (n >= 1e6) return d(n / 1e6) + ' Tr';
    if (n >= 1e3) return d(n / 1e3) + ' N';
    return String(n);
  }

  function qrSvg(text) {
    var q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 8, scalable: true, alt: text });
  }

  /* Kết nối thời gian thực tới máy chủ, tự nối lại khi mất mạng */
  function connect(role, handlers) {
    var es = null;
    var retryTimer = null;
    function open() {
      clearTimeout(retryTimer);
      es = new EventSource('/api/events?role=' + role);
      es.onopen = function () { if (handlers.status) handlers.status(true); };
      es.onerror = function () {
        if (handlers.status) handlers.status(false);
        if (es.readyState === 2) retryTimer = setTimeout(open, 3000);
      };
      ['state', 'progress', 'notice', 'announce'].forEach(function (ev) {
        es.addEventListener(ev, function (e) {
          if (!handlers[ev]) return;
          var data;
          try { data = JSON.parse(e.data); } catch (err) { return; }
          handlers[ev](data);
        });
      });
    }
    open();
    return { reconnect: function () { if (es) es.close(); open(); } };
  }

  function postJson(url, body, headers) {
    return fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) {
          var err = new Error(data.error || ('Lỗi ' + res.status));
          err.status = res.status;
          err.code = data.code || '';
          throw err;
        }
        return data;
      });
    });
  }

  return { esc: esc, fmtTime: fmtTime, fmtViews: fmtViews, qrSvg: qrSvg, connect: connect, postJson: postJson };
})();
