# Hawasuco AI Proxy

Backend nhỏ giữ API key Anthropic thật, để app Android không bao giờ chứa key
đó trong mã nguồn/APK. App gọi tới proxy này, proxy forward sang Anthropic.

## Cách hoạt động

```
App Android  --(Bearer PROXY_AUTH_TOKEN)-->  Proxy này  --(x-api-key thật)-->  api.anthropic.com
```

App gửi request y hệt định dạng Anthropic Messages API tới
`POST /v1/messages` của proxy, kèm header `Authorization: Bearer <PROXY_AUTH_TOKEN>`
thay vì `x-api-key`. Proxy kiểm tra token nội bộ, rồi mới gắn API key Anthropic
thật và forward đi — API key thật không bao giờ rời khỏi server.

## Chạy thử ở máy local

```bash
cp .env.example .env
# Mở .env, điền ANTHROPIC_API_KEY thật và PROXY_AUTH_TOKEN tự đặt (chuỗi dài, ngẫu nhiên)

npm install
npm start
```

Server chạy ở `http://localhost:3000`, kiểm tra nhanh:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## Triển khai lên server thật

Vì công ty đã có server nội bộ (IP tĩnh, đang chạy web service ASMX ở
`125.234.113.42:8088`), cách đơn giản nhất là chạy thêm container/process này
trên cùng hạ tầng, cổng khác (vd 3000), rồi trỏ tường lửa/NAT cho phép app
truy cập.

### Cách A — Docker (khuyên dùng, gọn nhất)

```bash
docker build -t hawasuco-ai-proxy .
docker run -d \
  --name hawasuco-ai-proxy \
  --restart unless-stopped \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY="sk-ant-xxx..." \
  -e PROXY_AUTH_TOKEN="chuoi-ngau-nhien-dai-cua-ban" \
  hawasuco-ai-proxy
```

### Cách B — PM2 trên VPS có sẵn Node.js

```bash
npm install -g pm2
npm install --omit=dev
pm2 start src/server.js --name hawasuco-ai-proxy
pm2 save
pm2 startup   # để tự chạy lại khi server reboot
```

### Cách C — Dịch vụ có gói miễn phí/rẻ (không cần tự quản lý VPS)

Nếu không muốn tự quản lý server, có thể deploy y hệt code này (không cần sửa)
lên Render, Railway, hoặc Fly.io — chỉ cần cấu hình 2 biến môi trường
`ANTHROPIC_API_KEY` và `PROXY_AUTH_TOKEN` trên dashboard của dịch vụ đó.

## Cấu hình phía app Android

Trong app, vào màn hình "Cấu hình hệ thống":
- **URL proxy AI đọc chỉ số**: `https://<domain-hoặc-ip-proxy>:3000/v1/messages`
- **Token proxy AI**: giá trị `PROXY_AUTH_TOKEN` bạn đặt ở bước `.env` phía trên
  (KHÔNG phải API key Anthropic thật)

App đã tự gửi đúng header `Authorization: Bearer <token>` khớp với proxy này —
không cần sửa code, chỉ cần điền 2 ô trên.

## Bảo mật thêm nên cân nhắc

- Đặt HTTPS trước proxy (Nginx/Caddy reverse proxy + Let's Encrypt) nếu expose
  ra internet, tránh token bị nghe lén trên đường truyền.
- Có thể đổi `PROXY_AUTH_TOKEN` thành 1 token riêng theo từng nhân viên (mở
  rộng bảng token trong code) để thu hồi quyền truy cập từng người khi cần,
  thay vì 1 token dùng chung.
- Theo dõi chi phí trên console.anthropic.com — vì proxy này chưa giới hạn
  theo user, chỉ giới hạn tổng request/15 phút.
