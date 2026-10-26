// HTTPS chứng chỉ tự ký đặt trước máy chủ thử — giống máy chủ IIS chưa có tên miền (https://IP:8443).
// node https-thu.cjs <khoá.pem> <chứng-chỉ.pem> [cổng https=18443] [cổng máy chủ=18090]
const https = require('node:https'), http = require('node:http'), fs = require('node:fs');
const [, , khoa, cc, cong = '18443', dich = '18090'] = process.argv;
https.createServer({ key: fs.readFileSync(khoa), cert: fs.readFileSync(cc) }, (yc, tl) => {
  const p = http.request({ host: '127.0.0.1', port: +dich, path: yc.url, method: yc.method, headers: yc.headers }, r => {
    tl.writeHead(r.statusCode, r.headers);
    r.pipe(tl);
  });
  p.on('error', e => { tl.writeHead(502); tl.end(String(e)); });
  yc.pipe(p);
}).listen(+cong, () => console.log('HTTPS thử: cổng ' + cong + ' → ' + dich));
