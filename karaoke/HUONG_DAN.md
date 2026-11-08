# KaraLED – Phần mềm karaoke YouTube miễn phí cho màn hình LED / TV

Một máy tính nối màn hình LED (hoặc TV) chạy phần mềm; điện thoại của khách quét mã QR để tìm và chọn bài
trên YouTube; người quản lý điều khiển phát / dừng / âm lượng / hiệu ứng từ điện thoại hoặc máy tính.
Không cài app, không tốn phí, phần mềm không chèn quảng cáo.

```
  Điện thoại khách ─┐                       ┌─> Màn hình LED / TV  (trang /led, trình phát YouTube chính thức)
  Điện thoại quản lý ┼─ Wi-Fi ─> Máy chạy ──┤
  Máy tính          ─┘          node server.js └─> YouTube Data API (tìm bài, có lưu đệm)
```

## Tính năng

- **Tìm bài trên YouTube**: nút **KARAOKE** tự thêm chữ "karaoke"; gợi ý *Tone Nam / Tone Nữ / Song ca / Beat chuẩn*,
  Bolero, Nhạc trẻ, Nhạc sống…; tìm bằng **giọng nói** (tiếng Việt, Hoa, Quảng Đông, Hàn, Nhật, Anh…).
- **Thể loại**: DJ Remix, Không lời, Nhạc Hoa, Noel & Tết (tự đổi theo mùa), Nền LED sân khấu (video nền VJ loop).
- **Dán link YouTube** (bài, shorts, cả danh sách phát) — không cần khóa API cho link từng bài.
- **Danh sách phát**: thêm, *ưu tiên* (chen lên sau bài đang hát), lên/xuống, đưa lên đầu, phát ngay, trộn bài, xóa;
  **Tự động lặp** danh sách; **Bài đã phát** để hát lại; ghi **tên người hát** cho từng bài.
- **Điều khiển**: Phát, Tạm dừng, Hát lại, Dừng, Bài trước, Qua bài, Lặp 1 bài, Tắt tiếng, âm lượng, tua bài.
- **Màn hình LED**: tên quán + hotline + đồng hồ + mã QR chọn bài khi chờ; báo "Đang phát" khi đổi bài và
  "Bài tiếp theo – mời … chuẩn bị" gần hết bài; **Màn hình chờ** (ảnh / video riêng), **Tắt màn hình** (đen);
  **chữ chạy** (màu, tốc độ, trên/dưới, cỡ chữ); **thông báo giữa màn hình** ("Mời bạn Lan lên sân khấu");
  **hiệu ứng**: tuyết rơi, pháo hoa, kim tuyến, trái tim, lấp lánh, hoa mai đào, bong bóng, viền đèn chạy.
- **Nhiều thiết bị cùng lúc**, tự đồng bộ tức thì; mất mạng tự nối lại; tắt máy mở lại vẫn còn danh sách.
- **Mã quản lý**: đặt mã thì khách chỉ tìm và thêm bài; điều khiển / xóa / đổi thứ tự cần mã.
- Video chủ kênh cấm phát ngoài YouTube được tự lọc khỏi kết quả, lỡ gặp thì tự bỏ qua sang bài sau.

## Cài đặt (Windows)

1. Cài **Node.js** bản LTS tại <https://nodejs.org> (Next → Next → Finish). Máy cần Internet.
2. Chép cả thư mục `karaoke` vào máy nối màn hình LED.
3. Nhấp đúp **`ChayKaraoke.bat`**. Lần đầu Windows hỏi tường lửa cho *Node.js*: tick **Private networks** → **Allow**
   (để điện thoại trong Wi-Fi vào được). Trình duyệt tự mở trang điều khiển `http://localhost:3000`.
4. Vào **Cài đặt** (nút ⚙) → dán **khóa YouTube API** (xem mục dưới) → Lưu. Đặt tên quán, hotline, mã quản lý nếu muốn.

Đóng cửa sổ đen (cmd) là tắt phần mềm. Máy Linux / macOS: `node server.js` trong thư mục `karaoke`.

## Lấy khóa YouTube API (miễn phí, khoảng 5 phút)

1. Vào <https://console.cloud.google.com>, đăng nhập Gmail, bấm **Select a project → New project**, đặt tên bất kỳ → Create.
2. Menu **APIs & Services → Library**, tìm **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**. Chép khóa (dạng `AIza…`).
4. (Nên làm) bấm vào khóa → **API restrictions → Restrict key → chọn YouTube Data API v3** → Save.
5. Dán khóa vào **Cài đặt** của phần mềm (hoặc ghi vào file `.env`: `YOUTUBE_API_KEY=AIza…`).

Không cần thẻ thanh toán. Mỗi khóa được 10.000 đơn vị/ngày, mỗi lần tìm tốn khoảng 100 → **khoảng 100 lần tìm/ngày**.
Phần mềm lưu kết quả 3 ngày nên tìm lại cùng chữ không tốn lượt; dán link không tốn lượt. Quán đông khách: tạo thêm
2–3 dự án, mỗi dự án một khóa, nhập hết vào Cài đặt — hết lượt khóa này phần mềm tự chuyển sang khóa khác.
Lượt được cấp lại lúc 0 giờ giờ Mỹ (khoảng 14–15 giờ chiều giờ Việt Nam).

## Nối màn hình LED / TV

- **Cùng máy (màn hình LED là màn hình thứ 2)**: bấm **MỞ LED** trên trang điều khiển → kéo cửa sổ sang màn hình LED →
  bấm vào cửa sổ một lần (để trình duyệt cho phát tiếng) → phím **F** để toàn màn hình.
  Trong **Kết nối thiết bị** có nút cho phép "Mở LED" tự đưa cửa sổ sang màn hình thứ hai (Chrome / Edge).
- **Tự động, không cần bấm**: nhấp đúp **`MoManHinhLED.bat`** — mở Chrome toàn màn hình (kiosk) ở màn hình bên phải,
  tự phát có tiếng. Màn hình chính không phải 1920 px thì chạy `MoManHinhLED.bat "" 1366` (số = bề ngang màn hình chính).
  Thoát kiosk: **Alt + F4**.
- **Smart TV / máy khác**: mở trình duyệt, vào địa chỉ trong **Kết nối thiết bị** (dạng `http://192.168.1.10:3000/led`).

Có thể mở nhiều màn hình LED cùng lúc, tất cả hiện cùng một bài.

## Điện thoại chọn bài

Điện thoại vào **cùng Wi-Fi** với máy chạy phần mềm, quét mã QR trên màn hình chờ hoặc trong **Kết nối thiết bị**.
Trên Chrome có thể *Thêm vào màn hình chính* để dùng như app. Tìm bằng giọng nói trên điện thoại: dùng nút micro
của bàn phím (trình duyệt chỉ cho dùng micro trực tiếp trên trang `localhost` hoặc `https`).

## Về quảng cáo

- Phần mềm **không chèn bất kỳ quảng cáo nào** của riêng nó.
- Video phát bằng **trình phát nhúng chính thức của YouTube**, nên quảng cáo *trong video* (nếu có) do YouTube và chủ
  kênh quyết định. Nhiều video beat karaoke không bật quảng cáo nên phát thẳng.
- Muốn hết quảng cáo một cách hợp lệ: đăng nhập tài khoản **YouTube Premium** trên trình duyệt của máy LED.
  Nếu dùng `MoManHinhLED.bat`, chạy **`MoManHinhLED.bat dangnhap`** một lần để đăng nhập trong đúng hồ sơ trình duyệt đó.
  Với Premium, trình phát nhúng thường không hiện quảng cáo; nên thử vài bài để chắc chắn.
- Phần mềm **không chặn hay tự bỏ qua quảng cáo YouTube**: việc đó vi phạm điều khoản của YouTube, có thể làm khóa API
  bị thu hồi và khiến phần mềm ngừng hoạt động.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Màn LED có hình nhưng không có tiếng | Bấm vào màn hình LED một lần (trình duyệt chặn tự phát tiếng), hoặc dùng `MoManHinhLED.bat`. |
| "Chưa có màn hình LED nào kết nối" | Chưa mở trang `/led` — bấm **MỞ LED** hoặc chạy `MoManHinhLED.bat`. |
| Điện thoại không vào được | Cùng Wi-Fi chưa? Tường lửa Windows đã cho phép Node.js (Private)? Thử đúng địa chỉ trong **Kết nối thiết bị**. Wi-Fi khách của một số router chặn các máy thấy nhau — dùng Wi-Fi chính. |
| "Hết lượt tìm kiếm hôm nay" | Thêm khóa API khác trong Cài đặt, hoặc dán link YouTube. |
| "Khóa YouTube API bị từ chối" | Chưa **Enable** YouTube Data API v3 cho dự án, hoặc giới hạn khóa sai loại. |
| Bài bị bỏ qua: "chủ kênh không cho phát ngoài YouTube" | Chọn bản khác của bài đó (kênh khác). |
| Cổng 3000 bị dùng | Ghi `PORT=3001` vào file `.env` rồi chạy lại. |
| Quên mã quản lý | Tắt phần mềm, mở `data/settings.json` bằng Notepad, sửa `"pin": "…"` thành `"pin": ""` (và để trống `CONTROL_PIN` trong `.env`), chạy lại. |

## Thư mục và kỹ thuật

```
karaoke/
  server.js            máy chủ Node.js, không cần cài thư viện (npm install không cần)
  public/              trang điều khiển (index.html, app.js, app.css) và màn hình LED (led.html, led.js, effects.js)
  data/                tự tạo khi chạy: danh sách phát, cài đặt, khóa API nhập trong phần mềm, lưu đệm tìm kiếm,
                       ảnh/video màn hình chờ (không đưa lên GitHub)
  .env.example         mẫu cấu hình: YOUTUBE_API_KEY, CONTROL_PIN, PORT
  ChayKaraoke.bat      chạy phần mềm trên Windows
  MoManHinhLED.bat     mở màn hình LED toàn màn hình (kiosk), tự phát tiếng
  test/test.js         kiểm tra máy chủ với YouTube giả lập: node test/test.js
```

- Tìm bài: YouTube Data API v3 (`search` + `videos` để lấy thời lượng, lượt xem; chỉ lấy video cho phép nhúng).
  Thông tin link từng bài khi không có khóa: YouTube oEmbed.
- Phát: YouTube IFrame Player API trên trang `/led`; trang này báo vị trí phát mỗi giây và báo hết bài / lỗi về máy chủ.
- Đồng bộ: Server-Sent Events (`/api/events`); lệnh gửi bằng `POST /api/action`.
