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
| **Bản đồ offline** | Tải vùng đang xem (3 mức chi tiết, báo trước số ô / dung lượng, tối đa 8.000 ô) gồm cả style, phông chữ tiếng Việt, biểu tượng; danh sách vùng đã tải, tải lại, xoá; tự cập nhật khi có Wi-Fi (vùng quá 30 ngày hoặc máy chủ đổi phiên bản ô) |
| **Tìm kiếm** | Gợi ý khi đang gõ, tìm bằng giọng nói, nhập toạ độ; dán / chia sẻ liên kết Google Maps, Apple Maps, `geo:` (kể cả liên kết rút gọn `maps.app.goo.gl`) để mở địa điểm hoặc chỉ đường; tìm nhanh quanh đây: cây xăng, bãi đỗ xe, ATM, cà phê, nhà hàng, bệnh viện, nhà thuốc, khách sạn, sửa xe, rửa xe, trạm sạc, nhà vệ sinh; nhấn giữ bản đồ để chọn vị trí bất kỳ; lịch sử tìm kiếm |
| **Địa điểm** | Thông tin, khoảng cách, giờ mở cửa, điện thoại; lưu yêu thích; đặt Nhà riêng / Cơ quan; chia sẻ liên kết vị trí |
| **Chỉ đường** | Ô tô, xe máy (tự tránh cao tốc), đi bộ, xe đạp; tuyến thay thế (bấm tuyến xám hoặc nhãn thời gian để chọn); nhãn "Nhanh nhất", "Có trạm thu phí", "Có đoạn cao tốc"; tránh cao tốc / trạm thu phí; thêm tới 3 điểm dừng; đảo chiều; danh sách các bước |
| **Dẫn đường** | Bảng chỉ hướng (mũi tên, khoảng cách, tên đường, làn nên đi, "sau đó…"); giọng nói tiếng Việt ("Sau 300 mét, rẽ phải vào Trần Phú"); bản đồ xoay theo hướng đi, nghiêng 3D, tự zoom theo tốc độ; giờ đến / thời gian / quãng đường còn lại; tự tính lại khi đi sai đường; tìm cây xăng dọc đường và thêm làm điểm dừng; giữ màn hình sáng; **Chạy thử** lộ trình (tua ×1 ×2 ×4, tăng giảm tốc độ) |
| **Cảnh báo** | Đồng hồ tốc độ + biển giới hạn tốc độ của con đường đang đi; vượt tốc độ: đồng hồ đỏ, âm báo, giọng nói; đọc giới hạn mới khi đổi đường, **báo trước giới hạn tốc độ phía trước** trên tuyến; camera phạt tốc độ / đèn đỏ / đo tốc độ trung bình / giám sát, điểm kiểm tra tốc độ; **khúc cua nguy hiểm** (tính từ hình dạng tuyến, trừ chỗ rẽ đã có hướng dẫn); **biển cấm rẽ / chỉ được rẽ** tại giao lộ phía trước (chỉ khi đang đi trên đường bị cấm, theo loại xe); đoạn nguy hiểm, đường sắt giao cắt, trường học, gờ giảm tốc, hầm, trạm thu phí, trạm dừng nghỉ, đèn tín hiệu, vạch qua đường; vào / ra khu đông dân cư; báo cáo kẹt xe / tai nạn / CSGT…; mỗi loại chọn được **Tắt / Chỉ hiển thị / Hiển thị + giọng nói**; hiệu chỉnh tốc độ GPS (%) cho khớp đồng hồ xe; báo mất tín hiệu GPS; nhắc bật đèn khi trời tối / tắt đèn khi trời sáng; hoạt động cả khi không dẫn đường (**Chế độ lái xe**) |
| **HUD kính lái** | Màn hình nền đen chữ lớn (tốc độ, biển giới hạn, mũi tên rẽ + khoảng cách, cảnh báo, giờ đến), **lật gương** dọc / ngang để phản chiếu lên kính chắn gió, giữ màn hình sáng |
| **Thông số xe (OBD-II)** | Bộ chuyển ELM327 Bluetooth: vòng tua, tốc độ, nhiệt độ nước / dầu / khí nạp, áp suất khí nạp, bướm ga, tải động cơ, mức nhiên liệu, điện áp; số khung (VIN); đọc / xoá mã lỗi động cơ; cảnh báo nước làm mát quá nóng. Chrome / Edge: bộ chuyển Bluetooth LE; ứng dụng Android: bộ chuyển Bluetooth thường (đã ghép đôi) |
| **Báo cáo giao thông** | Kẹt xe, tai nạn, CSGT, camera (chọn loại: phạt tốc độ / đèn đỏ / giám sát), ngập nước, công trình, vật cản, cấm đường; người khác xác nhận "Vẫn còn" / "Không còn"; tự hết hạn; dùng chung qua máy chủ |
| **Camera hành trình** | Quay bằng camera sau hoặc camera khác / **webcam USB** (nút đổi camera), in giờ / tốc độ / toạ độ / tên đường lên hình; **tự ghi khi xe chạy trên 5 km/h, tự dừng sau 20 giây đứng yên**; tự mở camera (thu nhỏ) khi dẫn đường; 3 mức chất lượng; ghi vòng theo số đoạn và **dung lượng tối đa**; khoá đoạn quan trọng; **chụp ảnh**; xem, tải về |
| **Khác** | Lịch sử hành trình (quãng đường, thời gian, tốc độ TB / cao nhất, thời gian dừng, số lần vượt tốc độ, **biểu đồ tốc độ**, xuất GPX); ứng dụng Android: **bong bóng nổi** tốc độ / giới hạn / cảnh báo trên ứng dụng khác khi HawaMap chạy nền; cài đặt giọng đọc, âm lượng, ngưỡng cảnh báo…; giao diện điện thoại và máy tính |

Biển giới hạn tốc độ lấy từ dữ liệu OpenStreetMap (có phân biệt riêng cho xe máy). Đường chưa có biển trong dữ liệu thì ứng dụng
**ước tính** theo Thông tư 38/2024/TT-BGTVT và vẽ biển viền nét đứt — luôn tuân theo biển báo thực tế.
Camera, biển báo, đèn tín hiệu… cũng lấy từ OpenStreetMap (Overpass API, chỉ tải những loại đang bật) cùng báo cáo cộng đồng;
độ đầy đủ tuỳ khu vực. "Khu đông dân cư" là ước tính theo mật độ đường nhỏ quanh vị trí.

Giới hạn hiện có: bản đồ offline dùng trên bản web / PWA (cần service worker; ứng dụng gốc chỉ giữ ô đã xem gần đây);
OBD-II trên iPhone / Safari chưa hỗ trợ (web không có Bluetooth); bong bóng nổi chỉ có trên Android; chưa có TPMS áp suất lốp,
màn hình HUD Bluetooth riêng của các hãng và camera WiFi (RTSP).

## Chạy thử trên máy tính

Cần [Node.js](https://nodejs.org) 18 trở lên (không phải cài thêm thư viện nào).

- Windows: nhấp đúp `ChayBanDo.bat` → trình duyệt mở `http://localhost:8080`.
- Hoặc trong thư mục này: `npm start` (đổi cổng: `set PORT=9000` rồi `npm start`).

Trên máy tính không có GPS: tìm một địa điểm → **Chỉ đường** → bấm ô "Vị trí của bạn" để chọn điểm xuất phát → **Chạy thử**.

## Đưa lên mạng để dùng trên điện thoại

Điện thoại chỉ cho dùng GPS, micro, camera khi trang chạy **HTTPS**.

1. **Có máy chủ báo cáo dùng chung (khuyên dùng):** chạy `node server.js` trên máy chủ (đặt biến `PORT`, `BANDO_DULIEU`
   nếu cần) và đưa ra ngoài qua HTTPS — ví dụ IIS + URL Rewrite / ARR làm reverse proxy, hoặc nginx. Dữ liệu báo cáo lưu ở
   `du-lieu/bao-cao.json`.
2. **Chỉ trang tĩnh:** chép thư mục `public/` lên IIS (đã có sẵn `web.config`) hoặc bất kỳ host tĩnh nào có HTTPS.
   Mọi chức năng đều chạy, riêng báo cáo giao thông chỉ lưu trên từng máy. Có thể trỏ tới máy chủ báo cáo ở nơi khác trong
   **Cài đặt → Nâng cao → Máy chủ báo cáo** (ví dụ `https://bando.congty.vn/api`).

Mở trang trên điện thoại → menu trình duyệt → **Thêm vào màn hình chính**.

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
| Giới hạn tốc độ, camera, đường sắt, trạm thu phí, địa điểm quanh đây | Overpass API | `cau-hinh.js` |
| Tìm kiếm / chỉ đường / nền VietMap | Tắt — nhập khoá VietMap API và đường dẫn style trong **Cài đặt → Nâng cao** (lỗi thì tự quay về dịch vụ mặc định) | trong ứng dụng |

Các máy chủ miễn phí trên có giới hạn lượt dùng, hợp với thử nghiệm và số người dùng nhỏ. Dùng chính thức cho nhiều người
nên tự dựng OSRM / Nominatim / Overpass hoặc dùng dịch vụ trả phí (VietMap API…). Ứng dụng không có dữ liệu tình trạng
giao thông thời gian thực như các hãng bản đồ thương mại; thay vào đó dùng báo cáo của cộng đồng.

## Cấu trúc thư mục

```
BanDoDanDuong/
├─ server.js                 máy chủ Node: phục vụ trang web + API báo cáo giao thông (không cần thư viện)
├─ ChayBanDo.bat             chạy nhanh trên Windows
├─ package.json              lệnh: npm start / npm test / npm run test:e2e
├─ public/                   toàn bộ ứng dụng web (có thể chép riêng lên host tĩnh)
│  ├─ index.html             khung giao diện: bản đồ, thanh tìm kiếm, lộ trình, dẫn đường, menu, camera
│  ├─ css/app.css            giao diện (sáng / tối, điện thoại / máy tính)
│  ├─ sw.js                  service worker: cài ứng dụng, dùng khi mất mạng
│  ├─ manifest.webmanifest   thông tin ứng dụng để cài lên màn hình chính
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
├─ tools/tao-bieu-tuong-goc.mjs  sinh biểu tượng Android / iOS từ public/js/bieu-tuong.js
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
| GET | `/api/mo-lien-ket?url=https://maps.app.goo.gl/…` | Mở liên kết rút gọn Google Maps → `{ url, diaDiem: { viTri, ten?, truyVan?, chiDuong? } }`; chỉ nhận `maps.app.goo.gl`, `goo.gl`, `g.co` qua HTTPS và chỉ đi theo chuyển hướng trong tên miền Google; tối đa 60 lần / 10 phút mỗi IP |

`thietBi` là mã ngẫu nhiên tạo trên từng máy (máy chủ chỉ lưu dạng băm), không chứa thông tin cá nhân. Mỗi IP gửi tối đa
30 báo cáo / 10 phút; báo cáo cùng loại trong bán kính ~60 m được gộp lại.

## Kiểm thử

```
npm test            # hình học, câu chỉ dẫn, bộ máy dẫn đường, cảnh báo (khúc cua, biển cấm rẽ, giới hạn phía trước…),
                    # nhắc nhở / giờ mặt trời, camera hành trình, bản đồ offline, liên kết chia sẻ, OBD-II, hành trình, API máy chủ
npm run test:e2e    # giao diện trên Chromium với dịch vụ bản đồ giả lập + "hợp đồng" lệnh / tin giữa trang và
                    # ứng dụng Android / iOS (giả lập cầu nối)   — cần: npm i -D playwright
```

Mã Kotlin đã được biên dịch thử với thư viện khung Android 14; mã Android Auto (AndroidX) và mã Swift / CarPlay
chưa được build trong môi trường này — build lần đầu bằng Android Studio / Xcode như hướng dẫn ở trên.
