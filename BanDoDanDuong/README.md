# HawaMap — Bản đồ dẫn đường

Ứng dụng bản đồ dẫn đường chạy trên trình duyệt, cài được lên điện thoại như ứng dụng (PWA). Bố cục và chức năng theo kiểu
các ứng dụng dẫn đường Việt Nam như VietMap Live: tìm địa điểm, chỉ đường, dẫn đường bằng giọng nói tiếng Việt, cảnh báo
tốc độ / camera giám sát, báo cáo giao thông của cộng đồng, camera hành trình. Các chức năng cảnh báo giao thông bổ sung
(biển báo, khúc cua, HUD kính lái, OBD-II, bong bóng nổi…) xây dựng sau khi phân tích ứng dụng DATMAP — xem
[`docs/PHAN_TICH_DATMAP.md`](docs/PHAN_TICH_DATMAP.md).

> Ứng dụng độc lập, không liên kết với VietMap. Dữ liệu nền là OpenStreetMap; có thể dùng thêm VietMap Maps API nếu có khoá.

## Chức năng

| Nhóm | Chức năng |
|---|---|
| **Bản đồ** | Bản đồ vector xoay / nghiêng 3D, nhà 3D; 4 kiểu: Tiêu chuẩn, Giao thông, Vệ tinh, Ban đêm (tự chuyển theo giờ mặt trời lặn / mọc); tên địa danh tiếng Việt; hiện Quần đảo Hoàng Sa, Trường Sa (Việt Nam); lưu ô bản đồ đã xem để dùng khi mất mạng |
| **Dữ liệu & cập nhật** | Bản đồ nền luôn theo phiên bản dữ liệu mới nhất của máy chủ bản đồ (OpenFreeMap cập nhật hằng tuần), ô đã lưu quá 7 ngày tự tải lại; dữ liệu camera, biển báo, trạm thu phí lưu trong máy theo khu vực ~11 km và **tự cập nhật mỗi tuần** (máy chủ HawaMap cũng tự cập nhật mỗi tuần cho mọi máy); bảng phí trạm thu phí tải lại mỗi tuần; tuỳ chọn chỉ cập nhật qua Wi-Fi; trang **Cập nhật dữ liệu** xem ngày cập nhật, cập nhật ngay |
| **Bản đồ offline** | Tải vùng đang xem (3 mức chi tiết, báo trước số ô / dung lượng, tối đa 8.000 ô) gồm cả style, phông chữ tiếng Việt, biểu tượng; danh sách vùng đã tải, tải lại, xoá; tự cập nhật mỗi tuần (vùng quá 7 ngày hoặc máy chủ đổi phiên bản ô) |
| **Tìm kiếm** | Gợi ý khi đang gõ, tìm bằng giọng nói, nhập toạ độ; dán / chia sẻ liên kết Google Maps, Apple Maps, `geo:` (kể cả liên kết rút gọn `maps.app.goo.gl`) để mở địa điểm hoặc chỉ đường; tìm nhanh quanh đây: cây xăng, bãi đỗ xe, ATM, cà phê, nhà hàng, bệnh viện, nhà thuốc, khách sạn, sửa xe, rửa xe, trạm sạc, nhà vệ sinh; nhấn giữ bản đồ để chọn vị trí bất kỳ; lịch sử tìm kiếm |
| **Địa điểm** | Thông tin, khoảng cách, giờ mở cửa, điện thoại; lưu yêu thích; đặt Nhà riêng / Cơ quan; chia sẻ liên kết vị trí |
| **Chỉ đường** | Ô tô, xe máy (tự tránh cao tốc), đi bộ, xe đạp; tuyến thay thế (bấm tuyến xám hoặc nhãn thời gian để chọn); nhãn "Nhanh nhất", "Có đoạn cao tốc"; **phí dự kiến** các trạm thu phí trên tuyến theo loại xe (1–5); **dẫn đường thông minh**: tuyến có kẹt xe / tai nạn / ngập / cấm đường do cộng đồng báo cáo được cộng thời gian chậm trễ, tuyến tránh được lên đầu ("Tránh kẹt xe"); tránh cao tốc / trạm thu phí; thêm tới 3 điểm dừng; đảo chiều; danh sách các bước |
| **Dẫn đường** | Bố cục theo kiểu các ứng dụng dẫn đường Việt Nam như VietMap Live: bảng chỉ hướng xanh dương (mũi tên lớn, tên đường sắp vào, "Còn 500 mét, rẽ phải", làn nên đi, "sau đó…"); thanh dưới với thời gian còn lại (chữ cam), quãng đường • giờ đến, nút kết thúc và nút xem toàn tuyến; nút "Về giữa" khi kéo bản đồ; giọng nói tiếng Việt ("Sau 300 mét, rẽ phải vào Trần Phú"); bản đồ xoay theo hướng đi, **nút 2D / 3D**, tự zoom theo tốc độ; tự tính lại khi đi sai đường; **có báo cáo mới phía trước thì tìm đường khác và gợi ý "Đổi đường"** (màn hình xe: tự đổi khi nhanh hơn từ 5 phút); tìm cây xăng dọc đường và thêm làm điểm dừng; giữ màn hình sáng; **Chạy thử** lộ trình (tua ×1 ×2 ×4, tăng giảm tốc độ) |
| **Cảnh báo** | Đồng hồ tốc độ + biển giới hạn tốc độ của con đường đang đi, **kèm giới hạn kế tiếp trên tuyến và khoảng cách tới đó** (tìm trước 800 m); vượt tốc độ: đồng hồ đỏ, âm báo, giọng nói; đọc giới hạn mới khi đổi đường, **báo trước giới hạn tốc độ phía trước** trên tuyến; **camera phạt nguội** (phạt tốc độ / đèn đỏ / đo tốc độ trung bình / giám sát), điểm kiểm tra tốc độ, đọc kèm giới hạn của đường, đang vượt tốc độ gần camera thì nhắc giảm tốc ngay; **đường cấm** theo loại xe (kể cả cấm theo giờ) và **đi ngược chiều** đường một chiều; **đoạn cấm vượt** (biển trên màn hình, đọc "bắt đầu / hết"); **cấm dừng, cấm đỗ** (nhắc khi xe chậm lại để dừng, biển cấm đỗ ngày chẵn / lẻ theo ngày); biển báo Việt Nam P.101, P.102, P.103a, P.104, P.125, DP.133, P.130, P.131a/b/c; **khúc cua nguy hiểm** (tính từ hình dạng tuyến, trừ chỗ rẽ đã có hướng dẫn); **biển cấm rẽ / chỉ được rẽ** tại giao lộ phía trước (chỉ khi đang đi trên đường bị cấm, theo loại xe); đoạn nguy hiểm, đường sắt giao cắt, trường học, gờ giảm tốc, hầm, **trạm thu phí (đọc kèm mức phí)**, trạm dừng nghỉ, đèn tín hiệu, vạch qua đường; vào / ra khu đông dân cư; báo cáo kẹt xe / tai nạn / CSGT…; mỗi loại chọn được **Tắt / Chỉ hiển thị / Hiển thị + giọng nói**; hiệu chỉnh tốc độ GPS (%) cho khớp đồng hồ xe; báo mất tín hiệu GPS; nhắc bật đèn khi trời tối / tắt đèn khi trời sáng; hoạt động cả khi không dẫn đường (**Chế độ lái xe**) |
| **HUD kính lái** | Màn hình nền đen chữ lớn (tốc độ, biển giới hạn, mũi tên rẽ + khoảng cách, cảnh báo, giờ đến), **lật gương** dọc / ngang để phản chiếu lên kính chắn gió, giữ màn hình sáng |
| **Thông số xe (OBD-II)** | Bộ chuyển ELM327 Bluetooth: vòng tua, tốc độ, nhiệt độ nước / dầu / khí nạp, áp suất khí nạp, bướm ga, tải động cơ, mức nhiên liệu, điện áp; số khung (VIN); đọc / xoá mã lỗi động cơ; cảnh báo nước làm mát quá nóng. Chrome / Edge: bộ chuyển Bluetooth LE; ứng dụng Android: bộ chuyển Bluetooth thường (đã ghép đôi) |
| **Báo cáo giao thông** | Kẹt xe, tai nạn, CSGT, camera (chọn loại: phạt tốc độ / đèn đỏ / giám sát), ngập nước, công trình, vật cản, cấm đường; người khác xác nhận "Vẫn còn" / "Không còn"; tự hết hạn; dùng chung qua máy chủ |
| **Camera hành trình** | Quay bằng camera sau hoặc camera khác / **webcam USB** (nút đổi camera), in giờ / tốc độ / toạ độ / tên đường lên hình; **tự ghi khi xe chạy trên 5 km/h, tự dừng sau 20 giây đứng yên**; tự mở camera (thu nhỏ) khi dẫn đường; 3 mức chất lượng; ghi vòng theo số đoạn và **dung lượng tối đa**; khoá đoạn quan trọng; **chụp ảnh**; xem, tải về |
| **Khác** | Lịch sử hành trình (quãng đường, thời gian, tốc độ TB / cao nhất, thời gian dừng, số lần vượt tốc độ, **biểu đồ tốc độ**, xuất GPX); ứng dụng Android: **bong bóng nổi** tốc độ / giới hạn / cảnh báo trên ứng dụng khác khi HawaMap chạy nền; cài đặt giọng đọc, âm lượng, ngưỡng cảnh báo…; giao diện điện thoại và máy tính |

Biển giới hạn tốc độ lấy từ dữ liệu OpenStreetMap (có phân biệt riêng cho xe máy). Đường chưa có biển trong dữ liệu thì ứng dụng
**ước tính** theo Thông tư 38/2024/TT-BGTVT và vẽ biển viền nét đứt — luôn tuân theo biển báo thực tế.
Camera, biển báo, đường cấm, một chiều, cấm vượt, cấm dừng / đỗ, trạm thu phí… cũng lấy từ OpenStreetMap (thẻ `access`, `oneway`,
`overtaking`, `parking:*`, `*:conditional`, `traffic_sign=VN:…`) cùng báo cáo cộng đồng; độ đầy đủ tuỳ khu vực và tuỳ cộng đồng
đã vẽ. HawaMap không có cơ sở dữ liệu biển báo / camera riêng. "Khu đông dân cư" là ước tính theo mật độ đường nhỏ quanh vị trí.

**Mức phí trạm thu phí** không được đoán: lấy từ bảng phí do đơn vị vận hành cập nhật (`du-lieu/phi-cao-toc.json` trong thư mục dữ liệu
của máy chủ, hoặc `public/du-lieu/phi-cao-toc.json` đi kèm trang — bản phát hành để trống), sau đó tới thẻ `charge` của trạm trên
OpenStreetMap (coi là phí xe loại 1). Trạm không có dữ liệu thì chỉ báo "có trạm thu phí". Mẫu một trạm trong bảng phí
(số liệu minh hoạ, không phải mức phí thật):

```json
{ "capNhat": "2026-10-01", "nguon": "Biểu phí công bố của các trạm",
  "tram": [ { "ten": "Trạm X", "viTri": [105.85, 20.95], "banKinh": 300, "osm": [123456789], "phi": [35000, 50000, 75000, 120000, 180000] } ] }
```

Cao tốc thu phí kín (tính theo quãng đường giữa điểm vào và ra) chưa được tính; bảng phí hiện tính theo từng trạm.

Giới hạn hiện có: bản đồ offline dùng trên bản web / PWA (cần service worker; ứng dụng gốc chỉ giữ ô đã xem gần đây);
OBD-II trên iPhone / Safari chưa hỗ trợ (web không có Bluetooth); bong bóng nổi chỉ có trên Android; chưa có TPMS áp suất lốp,
màn hình HUD Bluetooth riêng của các hãng và camera WiFi (RTSP).

## Chạy thử trên máy tính

Cần [Node.js](https://nodejs.org) 18 trở lên (không phải cài thêm thư viện nào).

- Windows: nhấp đúp `ChayBanDo.bat` → trình duyệt mở `http://localhost:8080`.
- Hoặc trong thư mục này: `npm start` (đổi cổng: `set PORT=9000` rồi `npm start`).

Trên máy tính không có GPS: tìm một địa điểm → **Chỉ đường** → bấm ô "Vị trí của bạn" để chọn điểm xuất phát → **Chạy thử**.

## Đưa lên mạng để dùng trên điện thoại

> **Mới dựng máy chủ lần đầu?** Làm theo [`trien-khai/HUONG_DAN_MAY_CHU.md`](trien-khai/HUONG_DAN_MAY_CHU.md): hướng dẫn
> từng bước từ thuê máy chủ, trỏ tên miền, chạy trình cài đặt nhấp đúp `CAI-DAT-MAY-CHU.bat`, tới bật HTTPS miễn phí và xử lý lỗi.
> Tạo gói cài đặt: `npm run dong-goi` → `dist/hawamap-may-chu-<phiên bản>.zip`.

Điện thoại chỉ cho dùng GPS, micro, camera khi trang chạy **HTTPS**.

1. **Có máy chủ báo cáo dùng chung (khuyên dùng):** chạy `node server.js` trên máy chủ (đặt biến `PORT`, `HOST`, `BANDO_DULIEU`
   nếu cần) và đưa ra ngoài qua HTTPS — trên Windows dùng IIS theo mục **Đặt lên IIS** dưới đây, trên Linux dùng nginx làm
   reverse proxy. Dữ liệu (báo cáo, dữ liệu giao thông, bảng phí) lưu trong thư mục `BANDO_DULIEU` (mặc định `du-lieu/`).
2. **Chỉ trang tĩnh:** chép thư mục `public/` lên IIS (đã có sẵn `web.config`) hoặc bất kỳ host tĩnh nào có HTTPS.
   Mọi chức năng đều chạy, riêng báo cáo giao thông chỉ lưu trên từng máy. Có thể trỏ tới máy chủ báo cáo ở nơi khác trong
   **Cài đặt → Nâng cao → Máy chủ báo cáo** (ví dụ `https://bando.congty.vn/api`).

Mở trang trên điện thoại → menu trình duyệt → **Thêm vào màn hình chính**.

## Đặt lên IIS (Windows Server)

Thư mục `trien-khai/iis/` có sẵn cấu hình và script cài đặt cho Windows Server 2016 trở lên (hoặc Windows 10 / 11).
Có hai cách chạy, cả hai đều đủ chức năng (báo cáo dùng chung, dữ liệu giao thông tự cập nhật mỗi tuần, bảng phí):

| | Cách 1 — HttpPlatformHandler (khuyên dùng) | Cách 2 — Reverse proxy (URL Rewrite + ARR) |
|---|---|---|
| Node chạy thế nào | IIS tự bật, tự khởi động lại `node server.js` khi lỗi / khi app pool tái khởi động | Node chạy nền riêng (Task Scheduler, tài khoản NETWORK SERVICE) tại `127.0.0.1:8080`, IIS chuyển tiếp yêu cầu |
| Module IIS cần cài | [URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite), [HttpPlatformHandler 1.2](https://www.iis.net/downloads/microsoft/httpplatformhandler) | [URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite), [ARR 3.0](https://www.iis.net/downloads/microsoft/application-request-routing) |
| Tệp cấu hình | `trien-khai/iis/web.config` | `trien-khai/iis/web.config.proxy` |

**Cách nhanh (người mới):** chép gói zip lên máy chủ, giải nén, nhấp đúp `CAI-DAT-MAY-CHU.bat`. Trình cài tự xin quyền
Administrator, bật IIS, đề nghị tự tải và cài Node.js LTS, mở trang tải URL Rewrite / HttpPlatformHandler nếu thiếu và chờ
cài xong, hỏi tên miền (nhớ câu trả lời cho lần sau) rồi gọi `cai-dat-iis.ps1` bên dưới. Xem
[`trien-khai/HUONG_DAN_MAY_CHU.md`](trien-khai/HUONG_DAN_MAY_CHU.md).

**Các bước (chạy script trực tiếp)**

1. Trên máy dựng: `npm run dong-goi` → thư mục `dist/hawamap-may-chu/` và tệp `dist/hawamap-may-chu-<phiên bản>.zip`
   (chỉ gồm tệp máy chủ cần: `server.js`, `kho-giao-thong.js`, `public/`, `trien-khai/`, trình cài `CAI-DAT-MAY-CHU.bat`,
   hướng dẫn `HUONG-DAN-CAI-DAT.html`). Chép lên máy chủ (hoặc chép cả mã nguồn).
2. Trên máy chủ: cài [Node.js](https://nodejs.org) 18 trở lên (bản LTS Windows x64, cài cho mọi người dùng) và các module IIS
   ở bảng trên (bản x64).
3. Mở PowerShell **Run as administrator** trong thư mục vừa chép và chạy:

   ```powershell
   # cách 1, có tên miền, chưa có chứng chỉ
   powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\cai-dat-iis.ps1 -TenMien bando.congty.vn
   # đã nhập chứng chỉ vào kho "Local Computer > Personal": thêm vân tay chứng chỉ để gắn HTTPS và tự chuyển http → https
   .\trien-khai\iis\cai-dat-iis.ps1 -TenMien bando.congty.vn -VanTayChungChi <vân tay>
   # cách 2
   .\trien-khai\iis\cai-dat-iis.ps1 -TenMien bando.congty.vn -CheDo Proxy -CongNode 8080
   ```

   Script bật IIS nếu chưa có, kiểm tra Node.js và các module, chép ứng dụng vào `C:\inetpub\hawamap` (`-ThuMuc`), tạo
   `web.config`, app pool **No Managed Code** (không tự tắt khi vắng khách), cấp quyền cho tài khoản `IIS AppPool\HawaMap`
   (đọc thư mục ứng dụng, ghi thư mục dữ liệu `C:\HawaMapData` — `-ThuMucDuLieu` — và `logs`), tạo site và binding
   HTTP / HTTPS, mở cổng tường lửa, rồi gọi thử `/api/trang-thai`.
4. **Cập nhật phiên bản mới:** đóng gói lại, chép lên và chạy lại đúng lệnh ở bước 3 — dữ liệu trong thư mục dữ liệu được giữ nguyên.
   Gỡ: `.\trien-khai\iis\go-cai-dat-iis.ps1` (không xoá thư mục ứng dụng và dữ liệu).

**HTTPS:** điện thoại chỉ cho dùng GPS, micro, camera khi trang chạy HTTPS. Chứng chỉ có thể mua, lấy từ CA nội bộ, hoặc
chứng chỉ miễn phí Let's Encrypt bằng win-acme (`server.js` trả tệp xác minh `/.well-known/acme-challenge/…` mà win-acme ghi
vào thư mục site; luật chuyển https bỏ qua đường dẫn này). Gắn bằng `-VanTayChungChi`, hoặc để win-acme gắn và tự gia hạn rồi
chạy lại script: site đã có binding https thì luật `HawaMap-HTTPS` trong `web.config` được bật (chuyển http sang https) và
cổng 443 được mở. Chạy lại với tên miền khác thì binding được đổi theo.

**Ghi chú**

- Toàn bộ yêu cầu đi qua Node (`server.js`), IIS không tự phục vụ tệp nào trong thư mục site, nên `server.js` hay thư mục dữ liệu
  không thể bị tải về. Node nén gzip trang và mã nguồn (đã tắt nén của IIS để không nén hai lần).
- IIS ghi IP thật của người dùng vào `X-Forwarded-For` (luật `HawaMap-IP`; script khai báo biến này trong
  `allowedServerVariables`). `server.js` chỉ tin header này khi yêu cầu đến từ chính máy (127.0.0.1), để giới hạn số báo cáo
  theo từng người dùng.
- Nhật ký Node: `C:\inetpub\hawamap\logs` (cách 1: `node_*.log`; cách 2: `node.log`). Lỗi khởi động: Event Viewer → Windows Logs →
  Application (nguồn HttpPlatformHandler).
- Bảng phí trạm thu phí cho mọi máy: đặt tệp `phi-cao-toc.json` vào thư mục dữ liệu (không cần khởi động lại; các máy tự tải lại
  mỗi tuần).
- Ứng dụng Android / iPhone: đặt địa chỉ máy chủ `https://<tên-miền>/api` vào `android/app/src/main/res/values/cau_hinh.xml`
  (`may_chu_bao_cao`) hoặc `ios/HoTro/Info.plist` (`HawaMapMayChuBaoCao`) trước khi build.
- iisnode không được hỗ trợ (đã ngừng phát triển và không chạy được mã ES module của `server.js`).
- Chỉ cần trang tĩnh (không báo cáo dùng chung, không lưu đệm dữ liệu giao thông trên máy chủ): trỏ site IIS vào thư mục
  `public/` — đã có `public/web.config` — không cần Node.

## Android Auto và Apple CarPlay

Android Auto và CarPlay không chạy trang web, nên có thêm hai ứng dụng gốc (thư mục `android/` và `ios/`).
Hai ứng dụng này **dùng lại nguyên trang web** trong `public/`: trang chạy trong WebView, toàn bộ tìm kiếm, tìm đường,
dẫn đường, cảnh báo vẫn do mã JavaScript đã kiểm thử đảm nhận. Phần gốc chỉ làm những việc trang web không làm được:

| Việc | Android (Kotlin) | iPhone (Swift) |
|---|---|---|
| Màn hình xe | Car App Library, mẫu `NavigationTemplate`; bản đồ vẽ lên Surface của xe (WebView trên màn hình ảo) | `CPMapTemplate`; bản đồ là WKWebView trong cửa sổ CarPlay |
| Thẻ chỉ hướng trên xe | mũi tên rẽ, khoảng cách, tên đường, bước kế tiếp, giờ đến, quãng đường còn lại; báo cho màn hình phụ / HUD của xe (`NavigationManager`) | `CPNavigationSession` (thao tác rẽ, ước tính thời gian), cảnh báo camera bằng `CPNavigationAlert` |
| Tìm kiếm / danh sách trên xe | `SearchTemplate`, danh sách Đã lưu · Quanh đây · Báo cáo, xem trước tuyến `RoutePreviewNavigationTemplate` (Bắt đầu / Chạy thử) | `CPSearchTemplate`, `CPListTemplate`, xem trước tuyến (Bắt đầu / Tuyến khác / Chạy thử) |
| Giọng nói | TextToSpeech tiếng Việt, loại âm "hướng dẫn dẫn đường" (ra loa xe, tự giảm nhạc) | AVSpeechSynthesizer `vi-VN`, chế độ `voicePrompt` |
| GPS | LocationManager, dịch vụ chạy nền khi dẫn đường | CLLocationManager, chế độ nền `location` |
| Khác | "Ok Google, chỉ đường tới …" (intent `geo:`), nút Back, lưu GPX vào Tải xuống | giữ sáng màn hình, chia sẻ tệp GPX |
| Mở từ ứng dụng khác | `geo:`, `google.navigation:`, liên kết Google Maps ("Mở bằng HawaMap"), "Chia sẻ" văn bản; tự mở liên kết rút gọn `maps.app.goo.gl` (chỉ đi qua tên miền Google) | dán liên kết vào ô tìm kiếm |
| OBD-II | ELM327 Bluetooth thường (SPP) đã ghép đôi, quyền "Thiết bị lân cận" | — |
| Bong bóng nổi | lớp phủ `TYPE_APPLICATION_OVERLAY` khi ứng dụng xuống nền (quyền "Hiển thị trên ứng dụng khác"), kéo để dời, chạm để mở lại | — |

Bắt đầu dẫn đường trên điện thoại khi đang cắm xe thì màn hình xe tự dẫn theo cùng tuyến (và ngược lại); giọng nói chỉ đọc
từ một nơi. Biểu tượng mũi tên rẽ của hai ứng dụng được sinh từ cùng nguồn với trang web: `npm run bieu-tuong`.

### Build Android (Android Auto)

1. Cài [Android Studio](https://developer.android.com/studio), mở thư mục `android/` (hoặc dòng lệnh: `cd android && ./gradlew assembleDebug`).
   Mỗi lần build, trang web trong `public/` được chép tự động vào ứng dụng.
2. Thử trên máy tính bằng **Desktop Head Unit**: cài "Android Auto Desktop Head Unit Emulator" trong SDK Manager; trên điện thoại
   bật chế độ nhà phát triển của Android Auto (bấm 10 lần vào phiên bản trong cài đặt Android Auto) → *Start head unit server*;
   chạy `adb forward tcp:5277 tcp:5277` rồi mở `desktop-head-unit`. Bấm nút "Chạy thử" ở màn hình xem trước tuyến để thử dẫn đường.
3. Máy chủ báo cáo dùng chung: điền vào `android/app/src/main/res/values/cau_hinh.xml`.
4. Phát hành: Google Play duyệt riêng ứng dụng cho Android Auto (Play Console → Advanced settings → Form factors → Android Auto),
   ứng dụng phải đạt [hướng dẫn chất lượng cho ứng dụng trên xe](https://developer.android.com/docs/quality-guidelines/car-app-quality).
   Trước khi gửi duyệt, thay `HostValidator` trong `HawaCarAppService.kt` bằng danh sách máy chủ Android Auto chính thức.

### Build iPhone (CarPlay)

1. Cần máy Mac có Xcode 15 trở lên và [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`,
   rồi `cd ios && xcodegen generate && open HawaMap.xcodeproj`. Điền Team ID vào `DEVELOPMENT_TEAM` trong `ios/project.yml`.
2. Thử CarPlay trên máy ảo: chạy ứng dụng trên iPhone Simulator → menu *I/O → External Displays → CarPlay*.
3. Chạy trên iPhone thật và xe thật cần quyền **CarPlay Navigation** (`com.apple.developer.carplay-maps`): xin Apple tại
   [developer.apple.com/carplay](https://developer.apple.com/carplay/), sau khi được cấp thì bật quyền đó cho App ID và tạo lại provisioning profile.
4. Máy chủ báo cáo dùng chung: khoá `HawaMapMayChuBaoCao` trong `ios/HoTro/Info.plist`.

## Dịch vụ bản đồ

| Việc | Mặc định (miễn phí, không cần khoá) | Đổi ở |
|---|---|---|
| Nền bản đồ | OpenFreeMap, CARTO, Esri (vệ tinh) | `public/js/cau-hinh.js` |
| Chỉ đường | OSRM (router.project-osrm.org, routing.openstreetmap.de) | `cau-hinh.js` |
| Tìm kiếm | Photon (gợi ý), Nominatim (tìm đầy đủ, địa chỉ theo toạ độ) | `cau-hinh.js` |
| Giới hạn tốc độ, camera, biển báo, trạm thu phí, địa điểm quanh đây | Overpass API (máy chủ HawaMap lưu đệm theo khu vực, tự cập nhật mỗi tuần) | `cau-hinh.js` |
| Tìm kiếm / chỉ đường / nền VietMap | Tắt — nhập khoá VietMap API và đường dẫn style trong **Cài đặt → Nâng cao** (lỗi thì tự quay về dịch vụ mặc định) | trong ứng dụng |

Các máy chủ miễn phí trên có giới hạn lượt dùng, hợp với thử nghiệm và số người dùng nhỏ. Dùng chính thức cho nhiều người
nên tự dựng OSRM / Nominatim / Overpass hoặc dùng dịch vụ trả phí (VietMap API…). Ứng dụng không có dữ liệu tình trạng
giao thông thời gian thực như các hãng bản đồ thương mại; thay vào đó dùng báo cáo của cộng đồng.

## Cấu trúc thư mục

```
BanDoDanDuong/
├─ server.js                 máy chủ Node: phục vụ trang web + API báo cáo giao thông (không cần thư viện)
├─ kho-giao-thong.js         máy chủ: kho dữ liệu cảnh báo theo khu vực, tự cập nhật từ OpenStreetMap mỗi tuần
├─ ChayBanDo.bat             chạy nhanh trên Windows
├─ CAI-DAT-MAY-CHU.bat       trình cài máy chủ IIS nhấp đúp (tự xin quyền Administrator, hỏi từng bước)
├─ package.json              lệnh: npm start / npm test / npm run test:e2e / npm run dong-goi
├─ public/                   toàn bộ ứng dụng web (có thể chép riêng lên host tĩnh)
│  ├─ index.html             khung giao diện: bản đồ, thanh tìm kiếm, lộ trình, dẫn đường, menu, camera
│  ├─ css/app.css            giao diện (sáng / tối, điện thoại / máy tính)
│  ├─ sw.js                  service worker: cài ứng dụng, dùng khi mất mạng
│  ├─ manifest.webmanifest   thông tin ứng dụng để cài lên màn hình chính
│  ├─ du-lieu/phi-cao-toc.json bảng phí trạm thu phí mặc định (để trống, đơn vị vận hành điền)
│  ├─ web.config             cấu hình khi đặt lên IIS
│  ├─ vendor/maplibre-gl/    thư viện bản đồ MapLibre GL JS 5.24 (BSD-3-Clause)
│  └─ js/
│     ├─ main.js             điều khiển chính: nối các phần, xử lý nút bấm, các trang
│     ├─ cau-hinh.js         địa chỉ dịch vụ bản đồ, kiểu bản đồ
│     ├─ ban-do.js           bản đồ: lớp tuyến / báo cáo / cảnh báo, chấm vị trí, camera bám xe
│     ├─ tim-kiem.js         tìm địa điểm, địa chỉ theo toạ độ (Photon, Nominatim, VietMap)
│     ├─ chi-duong.js        tìm đường (OSRM, VietMap), câu chỉ dẫn tiếng Việt
│     ├─ dan-duong.js        bộ máy dẫn đường: bám tuyến, câu nhắc, đi sai đường, đến nơi
│     ├─ duong-xa.js         thông tin đường đang đi: giới hạn tốc độ; tải điểm cảnh báo (camera, biển cấm rẽ, hầm…) từ OSM
│     ├─ canh-bao.js         cảnh báo vượt tốc độ, giới hạn phía trước, khúc cua, khu dân cư, điểm phía trước
│     ├─ loai-canh-bao.js    các loại cảnh báo, mức Tắt / Hiển thị / Giọng nói, biển cấm rẽ, loại nguy hiểm
│     ├─ luat-duong.js       đường cấm (cả theo giờ), một chiều, cấm dừng / đỗ, cấm vượt, biển báo Việt Nam
│     ├─ du-lieu-giao-thong.js dữ liệu cảnh báo theo khu vực trong máy (IndexedDB), tự cập nhật mỗi tuần
│     ├─ phi-cao-toc.js      phí trạm thu phí theo loại xe, bảng phí tự tải lại mỗi tuần
│     ├─ dan-duong-thong-minh.js xếp hạng tuyến và gợi ý đổi tuyến theo báo cáo kẹt xe, tai nạn, cấm đường
│     ├─ nhac-nho.js         mất / có lại GPS, nhắc bật / tắt đèn, giờ mặt trời mọc / lặn
│     ├─ ban-do-offline.js   tải vùng bản đồ offline, danh sách vùng, tự cập nhật qua Wi-Fi
│     ├─ lien-ket.js         đọc liên kết Google Maps / Apple Maps / geo: (dùng chung với server.js)
│     ├─ obd.js              OBD-II: phản hồi ELM327, mã lỗi, VIN, Bluetooth LE / cầu nối Android
│     ├─ bao-cao.js          báo cáo giao thông (máy chủ hoặc lưu trên máy)
│     ├─ loai-bao-cao.js     các loại báo cáo (dùng chung với server.js)
│     ├─ dia-diem.js         tìm quanh đây / dọc đường theo danh mục
│     ├─ vi-tri.js           GPS (tự tính tốc độ, hướng khi thiết bị không báo)
│     ├─ mo-phong.js         chạy thử lộ trình
│     ├─ giong-noi.js        giọng đọc tiếng Việt, âm báo
│     ├─ hanh-trinh.js       ghi lịch sử hành trình, xuất GPX
│     ├─ camera-hanh-trinh.js camera hành trình: tự ghi, chất lượng, giới hạn dung lượng, chụp ảnh, đổi camera
│     ├─ giao-dien.js        thông báo, hộp thoại, tấm trượt, trang
│     ├─ bieu-tuong.js       biểu tượng SVG, mũi tên rẽ, mũi tên làn đường
│     ├─ kho.js              lưu cài đặt, địa điểm, lịch sử (localStorage, IndexedDB)
│     ├─ hinh-hoc.js         tính khoảng cách, phương vị, bắt điểm lên tuyến…
│     ├─ dinh-dang.js        định dạng quãng đường, thời gian kiểu Việt Nam
│     └─ cau-noi.js          cầu nối với ứng dụng gốc Android / iOS (chế độ màn hình xe)
├─ android/                  ứng dụng Android + Android Auto (Kotlin, Gradle)
│  └─ app/src/main/java/vn/hawasuco/hawamap/
│     ├─ MainActivity.kt     màn hình điện thoại (WebView chạy trang HawaMap)
│     ├─ DanDuongService.kt  dịch vụ chạy nền khi dẫn đường
│     ├─ cau/                cầu nối JS ↔ Kotlin (TrangWeb, TrungTam), GPS, giọng nói, lưu tệp,
│     │                      OBD-II Bluetooth (Obd.kt), bong bóng nổi (BongBong.kt), mở liên kết rút gọn (LienKet.kt)
│     └─ xe/                 Android Auto: CarAppService, bản đồ trên Surface, các màn hình mẫu
├─ ios/                      ứng dụng iPhone + CarPlay (Swift, tạo dự án bằng XcodeGen: project.yml)
│  ├─ HawaMap/               AppDelegate, TrangWeb (WKWebView + cầu nối), TrungTam, GPS, giọng nói, CarPlay.swift
│  └─ HoTro/                 Info.plist, quyền CarPlay (entitlements)
├─ docs/PHAN_TICH_DATMAP.md  phân tích chức năng ứng dụng DATMAP và đối chiếu với HawaMap
├─ trien-khai/
│  ├─ HUONG_DAN_MAY_CHU.md   hướng dẫn dựng máy chủ từng bước cho người mới
│  └─ iis/                   web.config (HttpPlatformHandler / reverse proxy), cai-dat-nhanh.ps1 (hỏi - đáp),
│                            cai-dat-iis.ps1 (cài đặt), go-cai-dat-iis.ps1 (gỡ)
├─ tools/tao-bieu-tuong-goc.mjs  sinh biểu tượng Android / iOS từ public/js/bieu-tuong.js
├─ tools/dong-goi.mjs        đóng gói bản máy chủ (npm run dong-goi → dist/hawamap-may-chu-<phiên bản>.zip)
├─ tools/md-html.mjs         chuyển hướng dẫn Markdown sang HTML cho gói cài đặt
└─ test/                     kiểm thử (node --test), kiểm thử giao diện và cầu nối ứng dụng gốc (Playwright)
```

## API máy chủ báo cáo

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/trang-thai` | Kiểm tra máy chủ |
| GET | `/api/bao-cao?bbox=tây,nam,đông,bắc&thietBi=…` | Báo cáo còn hiệu lực trong khung |
| POST | `/api/bao-cao` | Gửi báo cáo `{ loai, phu?, lng, lat, huong?, ghiChu?, thietBi }` (`phu`: loại camera `tocdo` / `dendo` / `giamsat`) |
| POST | `/api/bao-cao/:id/xac-nhan` | `{ conTon: true/false, thietBi }` — đủ phiếu "không còn" thì gỡ |
| DELETE | `/api/bao-cao/:id?thietBi=…` | Người gửi xoá báo cáo của mình |
| GET | `/api/giao-thong?o=2858_1110,2858_1109&lop=chinh` | Điểm cảnh báo theo khu vực 0,1° (`lop=nho`: đèn tín hiệu, vạch qua đường); tối đa 9 khu vực mỗi lần; máy chủ lưu tệp trong `du-lieu/giao-thong/`, khu vực quá 7 ngày tự tải lại, khu vực không ai dùng 30 ngày thì xoá |
| GET | `/api/giao-thong/trang-thai` | Số khu vực đang lưu, lần cập nhật cũ / mới nhất |
| GET | `/api/phi-cao-toc` | Bảng phí trạm thu phí (`du-lieu/phi-cao-toc.json` nếu có, không thì bản mặc định) |
| GET | `/api/mo-lien-ket?url=https://maps.app.goo.gl/…` | Mở liên kết rút gọn Google Maps → `{ url, diaDiem: { viTri, ten?, truyVan?, chiDuong? } }`; chỉ nhận `maps.app.goo.gl`, `goo.gl`, `g.co` qua HTTPS và chỉ đi theo chuyển hướng trong tên miền Google; tối đa 60 lần / 10 phút mỗi IP |

`thietBi` là mã ngẫu nhiên tạo trên từng máy (máy chủ chỉ lưu dạng băm), không chứa thông tin cá nhân. Mỗi IP gửi tối đa
30 báo cáo / 10 phút; báo cáo cùng loại trong bán kính ~60 m được gộp lại.

## Kiểm thử

```
npm test            # hình học, câu chỉ dẫn, bộ máy dẫn đường, cảnh báo (khúc cua, biển cấm rẽ, giới hạn phía trước…),
                    # luật đường (đường cấm, một chiều, cấm vượt, cấm dừng / đỗ, biển báo), dữ liệu theo khu vực và tự cập nhật,
                    # phí trạm thu phí, dẫn đường thông minh, nhắc nhở / giờ mặt trời, camera hành trình, bản đồ offline,
                    # liên kết chia sẻ, OBD-II, hành trình, API máy chủ, cấu hình IIS, đóng gói zip
npm run test:e2e    # giao diện trên Chromium với dịch vụ bản đồ giả lập + "hợp đồng" lệnh / tin giữa trang và
                    # ứng dụng Android / iOS (giả lập cầu nối)   — cần: npm i -D playwright
```

Mã Kotlin đã được biên dịch thử với thư viện khung Android 14; mã Android Auto (AndroidX) và mã Swift / CarPlay
chưa được build trong môi trường này — build lần đầu bằng Android Studio / Xcode như hướng dẫn ở trên.
