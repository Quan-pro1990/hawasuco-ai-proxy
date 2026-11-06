# Máy chủ "Chia sẻ vị trí trực tiếp"

Một file Node.js, **không cần cài thư viện**. Lưu phiên chia sẻ vào `data/live.json`, tự xoá phiên hết hạn sau 2 giờ.

Trên Windows dùng bộ cài: nhấp đúp `CaiDat-MayChu.bat` (trong `LuuViTri-CaiDat.zip`) — tự cài Node.js,
tạo tác vụ tự chạy khi bật máy, mở tường lửa. Phần dưới dành cho cài tay / Linux.

## Chạy thử

```bash
node live-server.js                # cổng 3000
PORT=8090 node live-server.js      # cổng khác (Windows PowerShell: $env:PORT=8090; node live-server.js)
```

Mở `http://<địa chỉ máy>:3000/health` thấy `{"ok":true,...}` là chạy được.
Trong app: Cài đặt → Máy chủ vị trí trực tiếp → `http://<địa chỉ máy>:3000`.

## Đưa lên mạng (để người ngoài mở được link)

Người nhận link phải truy cập được máy chủ, nên máy chủ cần địa chỉ công khai, nên dùng **HTTPS**:

- **Windows + IIS**: chạy `node live-server.js` như một dịch vụ (ví dụ bằng NSSM hoặc Task Scheduler "At startup"),
  rồi trong IIS bật *Application Request Routing* + *URL Rewrite*, tạo quy tắc Reverse Proxy chuyển
  `https://vitri.congty.vn/*` → `http://localhost:3000/*`.
- **Linux**: `pm2 start live-server.js --name live` (hoặc systemd), đặt Nginx/Caddy phía trước làm HTTPS.

Cũng có thể đặt dưới một thư mục con, ví dụ `https://congty.vn/vitri/` → `http://localhost:3000/`;
khi đó nhập `https://congty.vn/vitri` trong app.

## API

| Yêu cầu | Nội dung | Ghi chú |
|---|---|---|
| `POST /api/live` | `{id, token, name, expiresAt}` | App tạo phiên (id và token ngẫu nhiên do app sinh) |
| `POST /api/live/{id}/update` | `{token, lat, lng, acc, ts}` | Cập nhật vị trí; sai token → 403, hết hạn → 410 |
| `POST /api/live/{id}/stop` | `{token}` | Dừng chia sẻ |
| `GET /api/live/{id}` | | Vị trí mới nhất + đường đi (trang xem dùng) |
| `GET /l/{id}` | | Trang bản đồ cho người nhận link (OpenStreetMap + Leaflet) |

Biến môi trường: `PORT`, `HOST` (mặc định `0.0.0.0`), `DATA_FILE` (mặc định `data/live.json`).
Mỗi phiên tối đa 24 giờ; chỉ ai có token (chính điện thoại chia sẻ) mới cập nhật / dừng được.
