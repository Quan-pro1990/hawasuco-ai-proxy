# Kết nối Zalo OA với phần mềm quản lý khách hàng nước EOS

Khách hàng nhắn tin cho Zalo Official Account (OA) của công ty để:

- **liên kết** tài khoản Zalo với mã khách hàng (xác minh bằng 4 số cuối số điện thoại đã đăng ký trong EOS);
- xem **thông tin khách hàng**: tên, địa chỉ, đồng hồ, đối tượng giá, tình trạng;
- xem **lịch sử sử dụng**: chỉ số cũ / mới, m³ tiêu thụ, tiền nước các kỳ gần nhất, bình quân;
- xem **danh sách hoá đơn** (đã / chưa thanh toán) và **nhận file PDF hoá đơn** ngay trong khung chat Zalo.

Thư mục này là **máy chủ trung gian** đứng giữa Zalo và EOS (Node.js, không cần cài thư viện ngoài).

```
 Khách hàng (app Zalo)
        │ nhắn "HD 09/2026"
        ▼
 Máy chủ Zalo ──── webhook HTTPS ────►  Máy chủ trung gian zalo-eos  ──── API (chỉ đọc) ────►  Phần mềm EOS
        ▲                               (Node.js chạy trên IIS)       ◄─── thông tin, hoá đơn ──
        └──── tin trả lời / file PDF ────────────┘
```

Vì sao cần máy chủ trung gian: Zalo không gọi thẳng được vào EOS; EOS vẫn nằm trong mạng nội bộ, chỉ mở API chỉ đọc
cho máy chủ trung gian. Máy chủ trung gian lo xác minh khách hàng, giữ token Zalo, đổi dữ liệu EOS thành tin nhắn.

---

## Cần chuẩn bị

| Hạng mục | Ghi chú |
|---|---|
| **Zalo OA đã xác thực** của công ty | Tài khoản Zalo dùng để cài đặt phải là **quản trị viên** của OA. Kiểm tra gói dịch vụ OA đang dùng có quyền gọi API gửi tin. |
| **Tên miền phụ** cho máy chủ trung gian, vd `zalo.tencongty.vn` | Trỏ về IP công khai của máy chủ, mở cổng **443**. |
| **Chứng chỉ SSL thật** cho tên miền đó | Zalo chỉ gửi webhook tới HTTPS có chứng chỉ hợp lệ — **không dùng được chứng chỉ tự ký** như cổng 8080 của phần mềm Thất thoát nước. Dùng Let's Encrypt miễn phí qua [win-acme](https://www.win-acme.com/). |
| **Máy chủ Windows có IIS + ASP.NET Core Hosting Bundle** | Máy chủ IIS đang chạy phần mềm Thất thoát nước dùng được luôn. Cài thêm **Node.js LTS** (bản 22). |
| **API của EOS** | Nhà cung cấp EOS mở API chỉ đọc (xem Bước 1). Máy chủ trung gian phải gọi tới được EOS (cùng mạng LAN, hoặc qua VPN / cho phép theo IP). |

---

## Bước 1 — Đề nghị nhà cung cấp EOS mở API (chỉ đọc)

Gửi nhà cung cấp EOS danh sách dưới đây. Nếu họ làm **đúng mẫu này** thì máy chủ trung gian chạy được ngay, chỉ cần điền
địa chỉ + khoá vào `.env`. Nếu API của họ đã có sẵn với tên khác, xem mục [Khai báo API EOS](#khai-báo-api-eos) — vẫn nối được,
không phải sửa code (trừ trường hợp hiếm).

| # | API | Trả về |
|---|---|---|
| 1 | `GET /api/khachhang/{maKH}` | Thông tin 1 khách hàng. Không có thì HTTP 404. |
| 2 | `GET /api/khachhang/{maKH}/tieuthu?soKy=6` | Các kỳ gần nhất: kỳ, chỉ số cũ, chỉ số mới, m³ tiêu thụ, tổng tiền. |
| 3 | `GET /api/khachhang/{maKH}/hoadon?soKy=6` | Các hoá đơn gần nhất: số hoá đơn, kỳ, tổng tiền, đã thanh toán chưa, mã tra cứu HĐĐT, link PDF (nếu có). |
| 4 | `GET /api/hoadon/{soHD}/pdf` | File PDF hoá đơn (`application/pdf`), hoặc JSON `{"pdf": "<base64>"}`, hoặc JSON `{"url": "<link PDF>"}`. |

Mẫu dữ liệu:

```jsonc
// 1. GET /api/khachhang/KH0001
{ "maKH": "KH0001", "tenKH": "Nguyễn Văn A", "diaChi": "Số 1 Đường ..., Phường ...",
  "soDienThoai": "0901234567", "soSeriDongHo": "DH-0001", "doiTuongGia": "Sinh hoạt", "trangThai": "Đang sử dụng" }

// 2. GET /api/khachhang/KH0001/tieuthu?soKy=6
[ { "ky": "09/2026", "chiSoCu": 3144, "chiSoMoi": 3161, "tieuThu": 17, "tongTien": 153000 },
  { "ky": "08/2026", "chiSoCu": 3125, "chiSoMoi": 3144, "tieuThu": 19, "tongTien": 171000 } ]

// 3. GET /api/khachhang/KH0001/hoadon?soKy=6
[ { "soHoaDon": "0001300", "ky": "09/2026", "tongTien": 153000, "daThanhToan": false,
    "maTraCuu": "AB12CD34", "linkPdf": "" } ]
```

Yêu cầu thêm với nhà cung cấp EOS:

- **Chỉ đọc**: tài khoản / khoá API riêng cho Zalo, không có quyền sửa, xoá.
- **Xác thực**: khoá API (header `Authorization: Bearer …` hoặc `X-API-Key: …`), hoặc tài khoản đăng nhập lấy token — loại nào cũng dùng được.
- **Giới hạn IP**: EOS chỉ nhận yêu cầu từ IP máy chủ trung gian. Nếu EOS ở ngoài mạng nội bộ thì bắt buộc HTTPS.
- **Môi trường thử** + tài liệu (Swagger / Postman) + vài mã khách hàng thử.
- **Hoá đơn điện tử**: nếu file PDF nằm ở nhà cung cấp HĐĐT (VNPT, Viettel, MISA…), EOS trả `linkPdf` (link tải PDF)
  hoặc `maTraCuu` — máy chủ trung gian tự tải PDF nếu link là file PDF, còn link trang tra cứu thì gửi link cho khách.

> EOS không có API và nhà cung cấp chỉ cho đọc cơ sở dữ liệu (vd view chỉ đọc trên SQL Server): vẫn làm được, nhưng phải viết
> lại 4 hàm trong `src/eos.js` để đọc SQL (cài thêm thư viện `mssql`). Nên ưu tiên đề nghị API.

---

## Bước 2 — Tạo ứng dụng trên Zalo for Developers

Làm tại <https://developers.zalo.me>, đăng nhập bằng tài khoản Zalo **quản trị viên OA**
(tên các mục trên trang có thể khác đôi chút theo phiên bản giao diện của Zalo):

1. **Tạo ứng dụng mới** (tên vd "Tra cứu tiền nước"). Mở ứng dụng → **Cài đặt / Thông tin ứng dụng**: chép
   **ID ứng dụng** → `ZALO_APP_ID`, **Khóa bí mật của ứng dụng** → `ZALO_SECRET_KEY`.
2. Thêm sản phẩm **Official Account** → **Thiết lập chung**:
   - **Official Account Callback Url**: `https://zalo.tencongty.vn/zalo/callback`
   - Chọn các quyền: **gửi tin và thông báo qua OA**, **quản lý thông tin người dùng**, **tải lên tệp / hình ảnh**.
3. Mục **Webhook**: chép **OA Secret Key** → `ZALO_OA_SECRET_KEY`. (URL webhook điền ở Bước 4, khi máy chủ đã chạy.)

---

## Bước 3 — Cài máy chủ trung gian

### 3.1. Chạy thử trên máy tính (chưa cần Zalo, chưa cần EOS)

Cài [Node.js LTS](https://nodejs.org/), mở cmd tại thư mục `zalo-eos`:

```bat
copy .env.example .env
npm test
npm run thu
```

`npm test` chạy bộ kiểm tra tự động. `npm run thu` mở khung chat giả lập: gõ như khách nhắn OA, dùng dữ liệu mẫu (`EOS_CHE_DO=mau`):

```
> DK KH0001 4567
> TT
> LS
> HD
> HD 09/2026          (file PDF mẫu lưu vào du-lieu\thu\)
```

### 3.2. Nối API EOS thật

Trong `.env`: `EOS_CHE_DO=api`, điền `EOS_URL`, cách xác thực (`EOS_XAC_THUC`, `EOS_KHOA` …) và các `EOS_DUONG_…` theo tài liệu API EOS
(xem [Khai báo API EOS](#khai-báo-api-eos)). Rồi chạy lại `npm run thu` với **mã khách hàng thật**:

```bat
npm run thu "DK <mã KH thật> <4 số cuối SĐT>" TT LS HD
```

Thấy đúng tên, địa chỉ, chỉ số, tiền → đã nối đúng EOS. Báo lỗi thì xem dòng lỗi (in rõ địa chỉ API và mã lỗi HTTP).

### 3.3. Đưa lên IIS

1. Cài **Node.js LTS** lên máy chủ (mở cmd gõ `where node`, thường là `C:\Program Files\nodejs\node.exe`).
2. Chép thư mục `zalo-eos` (gồm `src`, `public`, `package.json`, `.env`) vào `C:\inetpub\ZaloEos`.
   Chép `iis\web.config` ra **thư mục gốc**: `C:\inetpub\ZaloEos\web.config`.
3. Tạo thư mục dữ liệu và thư mục nhật ký, cấp quyền cho app pool (cmd quyền Administrator):

   ```bat
   mkdir C:\ZaloEosData
   mkdir C:\inetpub\ZaloEos\logs
   ```

4. **IIS Manager → Application Pools → Add**: tên `ZaloEos`, **.NET CLR version: No Managed Code**.
   Advanced Settings: **Start Mode = AlwaysRunning**, **Idle Time-out = 0** (để máy chủ luôn chạy, token Zalo luôn được làm mới).
5. Cấp quyền:

   ```bat
   icacls C:\ZaloEosData /grant "IIS AppPool\ZaloEos:(OI)(CI)M"
   icacls C:\inetpub\ZaloEos\logs /grant "IIS AppPool\ZaloEos:(OI)(CI)M"
   icacls C:\inetpub\ZaloEos\.env /inheritance:r /grant "Administrators:F" "SYSTEM:F" "IIS AppPool\ZaloEos:R"
   ```

6. **Sites → Add Website**: tên `ZaloEos`, app pool `ZaloEos`, thư mục `C:\inetpub\ZaloEos`,
   binding **https**, cổng **443**, host name `zalo.tencongty.vn`, tích **Require Server Name Indication**.
7. Lấy chứng chỉ thật: chạy `wacs.exe` (win-acme) → chọn site `ZaloEos` → win-acme tự gắn chứng chỉ và tự gia hạn.
8. Mở `https://zalo.tencongty.vn/` → thấy **"Máy chủ Zalo OA - EOS đang chạy."**
   Lỗi 502.5 / 500.30: kiểm tra đường dẫn `node.exe` trong `web.config`, xem `C:\inetpub\ZaloEos\logs\stdout_*.log`.

> Không dùng IIS: chạy `npm start` (cổng `PORT` trong `.env`) sau một reverse proxy HTTPS bất kỳ cũng được.

---

## Bước 4 — Xác thực tên miền, bật webhook, cấp quyền OA

1. **Xác thực tên miền** (developers.zalo.me → ứng dụng → **Xác thực tên miền**): nhập `zalo.tencongty.vn`, tải file xác thực
   Zalo đưa (dạng `zalo_verifier….html`), chép vào `C:\inetpub\ZaloEos\public\` → bấm **Xác thực**.
2. **Webhook**: URL `https://zalo.tencongty.vn/zalo/webhook`. Bật các sự kiện:
   - **Người dùng gửi tin nhắn văn bản** (`user_send_text`) — bắt buộc;
   - **Người dùng quan tâm OA** (`follow`), **bỏ quan tâm OA** (`unfollow`);
   - (tuỳ chọn) gửi hình ảnh, sticker — máy chủ chỉ nhắc cách dùng.
3. **Cấp quyền OA cho máy chủ** (làm 1 lần): mở trình duyệt
   `https://zalo.tencongty.vn/zalo/cap-quyen?khoa=<KHOA_QUAN_TRI>` → đăng nhập Zalo quản trị viên → chọn OA → **Cho phép**
   → trang báo **"Đã cấp quyền"**.
4. Kiểm tra: `https://zalo.tencongty.vn/trang-thai?khoa=<KHOA_QUAN_TRI>` → `"daCapQuyen": true`, `"thieuCauHinh": []`.
5. Ứng dụng Zalo phải ở trạng thái **kích hoạt / đang hoạt động** (không phải chỉ thử nghiệm) để mọi khách dùng được.

---

## Bước 5 — Thử trên điện thoại và gắn menu OA

1. Dùng Zalo trên điện thoại **quan tâm** OA → nhận lời chào. Nhắn `DK <mã KH> <4 số cuối SĐT>`, rồi `TT`, `LS`, `HD`, `HD 09/2026`.
2. Gắn **menu OA** để khách bấm thay vì gõ (trang quản lý OA <https://oa.zalo.me> → **Quản lý → Menu**), mỗi mục chọn hành động
   **gửi tin nhắn** với nội dung:

   | Tên mục | Nội dung gửi |
   |---|---|
   | Thông tin khách hàng | `TT` |
   | Lịch sử dùng nước | `LS` |
   | Hoá đơn tiền nước | `HD` |
   | Hướng dẫn | `MENU` |

3. In mã QR của OA và cú pháp `DK <mã KH> <4 số cuối SĐT>` lên hoá đơn / giấy báo tiền nước.

---

## Khách hàng dùng thế nào

Gõ có dấu hay không dấu, hoa hay thường đều được (vd `đk kh0001 4567`, `Hóa đơn 9/2026`, `tra cứu hoá đơn`).

| Khách gửi | OA trả lời |
|---|---|
| `DK KH0001 4567` | Liên kết mã KH0001 nếu 4 số cuối SĐT trong hồ sơ EOS là 4567 (gõ đủ số điện thoại cũng được). Mỗi tài khoản Zalo liên kết tối đa 5 mã. |
| `TT` (thông tin, tra cứu) | Thông tin các mã đã liên kết (số điện thoại được che: 090\*\*\*\*567). |
| `LS` (lịch sử) — `LS KH0002` | Lịch sử chỉ số, m³, tiền các kỳ gần nhất + bình quân. Liên kết nhiều mã thì thêm mã sau lệnh. |
| `HD` (hoá đơn) | Danh sách hoá đơn gần nhất: số tiền, đã / chưa thanh toán. |
| `HD 09/2026` | Gửi file PDF hoá đơn kỳ 09/2026. |
| `HUY` — `HUY KH0001` | Huỷ tất cả liên kết / huỷ 1 mã. |
| `MENU` hoặc `?` | Hướng dẫn. |
| Tin khác (vd "nhà tôi bị mất nước") | Nhắc menu tối đa 1 lần / 30 phút; tin vẫn nằm trong hộp thư OA để nhân viên CSKH trả lời như bình thường. |

Ví dụ:

```
Khách:  HD 09/2026
OA:     Hoá đơn kỳ 09/2026 – mã KH0001: 153.000 đ – chưa thanh toán
OA:     [file đính kèm] HoaDon_KH0001_09-2026.pdf
```

---

## Khai báo API EOS

Tất cả trong `.env`:

- `EOS_URL`: địa chỉ gốc, vd `http://10.0.0.5:8080`.
- `EOS_DUONG_KHACH_HANG`, `EOS_DUONG_LICH_SU`, `EOS_DUONG_HOA_DON`, `EOS_DUONG_TAI_HOA_DON`: đường dẫn từng API, có tham số
  `{maKH}` `{soKy}` `{soHD}` `{ky}` `{thang}` `{nam}` `{maTraCuu}`. Mặc định là GET; API cần POST thì viết
  `POST /api/tracuu` — các tham số được gửi dạng JSON (`{"maKH": "...", ...}`). Không có API tải PDF thì ghi `khong`.
  Ví dụ: `EOS_DUONG_TAI_HOA_DON=/api/hoadon/pdf?ma={maKH}&thang={thang}&nam={nam}`.
- `EOS_XAC_THUC`: `bearer` / `header` / `basic` / `dangnhap` / `khong` (giải thích trong `.env.example`).

Máy chủ tự hiểu:

- **lớp bọc** hay gặp: `{ "success": true, "data": ... }`, `{ "result": ... }`, `{ "d": ... }` (ASP.NET), danh sách nằm trong `items` / `rows` …;
- **tên trường** thường gặp, không phân biệt hoa thường, bỏ qua `_`: vd mã KH là `maKH`, `MaKhachHang`, `MaDanhBo`, `danh_bo`,
  `customerCode` …; kỳ là `ky`, `KyHoaDon`, `thangNam` hoặc cặp `Thang` + `Nam`; kỳ dạng `09/2026`, `2026-09`, `202609` đều được;
- **số** dạng `153000`, `"153.000"`, `"153,000"`; **thanh toán** dạng `true/false`, `1/0`, `"Đã thu"`, `"Chưa thanh toán"`;
- `{ "success": false, "message": "Không tìm thấy..." }` hoặc HTTP 404 = không có khách hàng.

API EOS dùng tên trường lạ hơn (vd tên khách là `TenChuHo`): mở `src/eos.js`, thêm tên đó vào **đầu** danh sách tương ứng
trong `TRUONG` (vd `ten: ['TenChuHo', 'tenKH', ...]`), chạy lại `npm run thu` để kiểm tra.

---

## Cách hoạt động (cho cán bộ IT)

| File | Việc |
|---|---|
| `src/server.js` | Máy chủ HTTP: nhận webhook, kiểm chữ ký, trang cấp quyền, liên kết tải hoá đơn tạm, trang trạng thái. |
| `src/zalo.js` | Gọi Zalo OA API: OAuth v4 + PKCE, tự làm mới token, gửi tin tư vấn (`/v3.0/oa/message/cs`), tải file lên (`/v2.0/oa/upload/file`) rồi gửi file. |
| `src/eos.js` | Lớp nối EOS: chế độ `mau` (dữ liệu mẫu) và `api` (REST/JSON). |
| `src/hoithoai.js` | Kịch bản trò chuyện: hiểu lệnh, xác minh khách, định dạng tin trả lời. |
| `src/thu.js` | Khung chat giả lập (`npm run thu`). |
| `test/` | Kiểm tra tự động (`npm test`). |

- **Token Zalo**: access token hạn khoảng 25 giờ, refresh token hạn 3 tháng và **mỗi refresh token chỉ dùng được 1 lần**.
  Máy chủ tự làm mới (kiểm mỗi giờ, và khi Zalo báo token hỏng), ghi ngay token mới vào `C:\ZaloEosData\zalo-token.json`.
  Chỉ phải cấp quyền lại (Bước 4.3) khi: máy chủ ngừng chạy quá 3 tháng, mất file token, hoặc OA gỡ quyền ứng dụng.
- **Dữ liệu lưu trên máy chủ trung gian**: chỉ `lien-ket.json` (Zalo user id ↔ mã KH) và token. Thông tin khách hàng, chỉ số,
  hoá đơn **không lưu lại**, lần nào cũng hỏi EOS — EOS sửa gì khách thấy ngay.
- **Gửi file**: PDF ≤ 5 MB tải lên Zalo rồi gửi dạng file. Zalo không nhận (file lớn, lỗi) thì gửi **liên kết tải tạm**
  `https://zalo.tencongty.vn/hd/<mã ngẫu nhiên>`, dùng được 30 phút.
- Zalo chỉ cho OA gửi **tin tư vấn** trong một khoảng thời gian sau khi khách nhắn / tương tác (theo chính sách tin nhắn OA hiện hành).
  Máy chủ chỉ trả lời ngay khi khách nhắn nên luôn nằm trong khoảng đó.

---

## Bảo mật và dữ liệu cá nhân

- Chỉ chủ hồ sơ mới xem được: liên kết cần **mã KH + số điện thoại trong hồ sơ EOS**. Sai mã hay sai số đều nhận cùng 1 câu trả lời
  (không dò được mã nào tồn tại); sai 5 lần thì khoá đăng ký 30 phút.
- Khi gửi `DK`, khách được báo rõ mục đích dùng dữ liệu (đồng ý theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân);
  `HUY` huỷ bất cứ lúc nào; khách **bỏ quan tâm OA** thì liên kết tự xoá.
- Sự kiện webhook phải đúng chữ ký `X-ZEvent-Signature` (OA Secret Key) mới được xử lý. Trang cấp quyền / trạng thái cần `KHOA_QUAN_TRI`.
- API EOS chỉ đọc, chỉ nhận IP máy chủ trung gian, không mở ra Internet.
- `.env` (khoá bí mật) và thư mục dữ liệu (token, liên kết) đã có trong `.gitignore` — **không bao giờ** đưa lên GitHub.
  Lỡ lộ `ZALO_SECRET_KEY` / `ZALO_OA_SECRET_KEY`: đổi khoá trên developers.zalo.me, sửa `.env`, cấp quyền lại.

---

## Mở rộng sau

- **Chủ động gửi thông báo tiền nước hằng tháng**: dùng **ZNS** (Zalo Notification Service) — gửi theo số điện thoại kể cả khi
  khách chưa nhắn OA. Cần đăng ký mẫu tin ZNS (Zalo duyệt), tính phí theo tin. EOS xuất danh sách hoá đơn kỳ mới → gọi API ZNS.
- **Liên kết bằng số điện thoại Zalo**: gửi tin "yêu cầu chia sẻ thông tin", khách bấm đồng ý → Zalo gửi số điện thoại về
  (sự kiện `user_submit_info`) → tìm khách hàng theo SĐT (cần thêm API tìm theo SĐT bên EOS).
- **Thanh toán**: gửi kèm mã QR / liên kết thanh toán nếu EOS hoặc ngân hàng hỗ trợ.

---

## Xử lý sự cố

Nhật ký máy chủ: `C:\inetpub\ZaloEos\logs\stdout_*.log`.

| Hiện tượng / dòng nhật ký | Cách xử lý |
|---|---|
| Không lưu được URL webhook trên developers.zalo.me | Máy chủ phải đang chạy, URL là HTTPS có chứng chỉ thật, tên miền đã xác thực. |
| `Từ chối sự kiện webhook: sai chữ ký` | `ZALO_OA_SECRET_KEY` / `ZALO_APP_ID` trong `.env` chưa đúng với ứng dụng. Sửa `.env` rồi recycle app pool. |
| `Chưa cấp quyền Zalo OA` | Làm Bước 4.3. |
| `Zalo không cấp token … refresh token` | Refresh token hết hạn / OA đã gỡ quyền: làm lại Bước 4.3. |
| `Zalo báo lỗi -216` lặp lại | Token không còn hiệu lực: làm lại Bước 4.3. |
| `Không gọi được EOS …` | Máy chủ trung gian không tới được EOS: kiểm tra mạng / VPN / tường lửa, IP đã được EOS cho phép chưa. |
| `EOS trả lỗi HTTP 401 / 403` | Sai khoá API / tài khoản EOS. |
| Khách báo "không khớp với hồ sơ" dù gõ đúng | Hồ sơ EOS chưa có / sai số điện thoại → CSKH cập nhật số trong EOS. |
| Khách nhận liên kết thay vì file | Zalo không nhận file (vd lớn hơn 5 MB); liên kết vẫn tải được trong 30 phút. Cần `URL_CONG_KHAI` đúng. |
| IIS báo 502.5 / 500.30 | Sai đường dẫn `node.exe` trong `web.config`, hoặc app pool không đọc được thư mục site / ghi được `C:\ZaloEosData`. |
