# Phân tích ứng dụng DATMAP – Cảnh báo giao thông (bản 1.9.1)

Mục đích: hiểu DATMAP **làm được gì** để HawaMap tự xây chức năng tương đương bằng mã và dữ liệu của mình.
Chỉ đọc phần công khai của gói cài đặt (`.apks` tải từ APKCube): AndroidManifest, tên tài nguyên, chuỗi giao diện
tiếng Việt, tên thư viện. Không dịch ngược mã, không dùng hình ảnh, cơ sở dữ liệu camera hay máy chủ của DATMAP.

## 1. Cấu trúc kỹ thuật

| Mục | DATMAP | Ghi chú |
|---|---|---|
| Gói / phiên bản | `com.datmap.app` 1.9.1 (mã 57), Android 7.0+ (minSdk 24), targetSdk 36 | phát hành trên Google Play, có kiểm tra bản quyền Play (pairip) |
| Nền tảng | Flutter (Dart biên dịch sẵn `libapp.so`) | một mã nguồn cho Android, có thể cả iOS |
| Bản đồ | MapLibre Native (`libmaplibre.so`) | cùng họ thư viện với HawaMap (MapLibre GL JS) |
| Lọc GPS | thư viện riêng `libgpsfilter.so` | làm mượt vị trí / tốc độ (kiểu bộ lọc Kalman) |
| Camera | CameraX + `libusb`, `libflutter_ffi_uvc.so` | camera điện thoại, webcam USB (UVC qua OTG), camera WiFi (RTSP) |
| Android Auto | `DatmapCarAppService`, quyền `NAVIGATION_TEMPLATES`, `ACCESS_SURFACE`, minCarApiLevel 5 | ứng dụng dẫn đường trên màn hình xe |
| Dịch vụ nền | `CameraFgsService` (camera + đồng bộ), `VehicleFgsService` (thiết bị kết nối), overlay (đặc biệt + vị trí), Geolocator | ghi hình, giữ kết nối xe, bong bóng nổi, GPS khi chạy nền |
| Quyền đáng chú ý | vị trí nền, `SYSTEM_ALERT_WINDOW`, Bluetooth quét / kết nối, camera, micro, thông báo | bong bóng đè lên ứng dụng khác, thiết bị Bluetooth trên xe |
| Tài khoản | Đăng nhập Google, đồng bộ địa điểm / lịch sử giữa điện thoại và màn hình Android trên xe | "Bỏ qua đăng nhập" có thể bị khoá khi máy chủ bảo trì |
| Nhận liên kết | `geo:`, `google.navigation:`, chia sẻ văn bản (`SEND text/plain`) | mở điểm đến từ Google Maps / ứng dụng khác |

## 2. Chức năng (suy ra từ tài nguyên và chuỗi giao diện)

**Bản đồ & hiển thị:** chế độ tối ban đêm, nhà 3D, đèn giao thông trên bản đồ, chế độ "đầy đủ" / "đơn giản" /
"mô phỏng đường 3D, ẩn bản đồ", tự phóng to/thu nhỏ theo tốc độ (3 kiểu: theo tốc độ, giữ mức zoom của người dùng, không tự zoom),
nghiêng bản đồ, luôn hiện la bàn, chọn biểu tượng xe (5 màu, kích thước), bản đồ offline tự tải qua Wi-Fi theo vị trí và lịch sử đi lại.

**Cảnh báo tốc độ:** thanh tốc độ và/hoặc biển ghim trên bản đồ, báo trước giới hạn tốc độ phía trước (khoảng cách cài được),
báo khi giới hạn thay đổi, ngưỡng vượt tốc độ cài được, **hiệu chỉnh tốc độ GPS** cho khớp đồng hồ xe.

**Camera giám sát** (biểu tượng riêng từng loại): tốc độ, đèn đỏ, đèn đỏ + tốc độ, tổng hợp, camera AI, camera dừng,
camera khoảng cách, camera tiếng ồn, camera giả; điểm kiểm tra tốc độ.

**Nguy hiểm & biển báo:** giao lộ phức tạp, khúc cua nguy hiểm, gờ giảm tốc, vạch người đi bộ, giao cắt đường sắt,
trường học, nhập làn, đèn tín hiệu, trạm thu phí (ETC / không ETC), trạm dừng nghỉ cao tốc, hầm, đông xe;
biển cấm rẽ trái / phải / quay đầu / đi thẳng và các tổ hợp, biển chỉ được rẽ, cấm ô tô / xe máy, cấm vượt / hết cấm vượt,
vào / hết khu dân cư, cấm dừng đỗ, cấm đỗ ngày chẵn / lẻ (chỉ hiện khi đi chậm dưới mức cài đặt), khoảng cách an toàn trên cao tốc.

**Âm thanh:** âm riêng từng loại cảnh báo, chọn loại được đọc, nhắc lại định kỳ, thông báo ngắn gọn, tự giảm âm lượng nhạc
khi cảnh báo, kênh âm thanh, nhắc cài giọng đọc tiếng Việt, **cảnh báo mất tín hiệu GPS**, **nhắc bật đèn buổi tối / tắt đèn buổi sáng**.

**Bong bóng cảnh báo nổi** trên ứng dụng khác (5 kiểu: đầy đủ, tối ưu ngang / dọc, đơn giản ngang / dọc): giữ GPS,
cảnh báo và giọng nói khi đang dùng Google Maps, nghe nhạc…

**Dẫn đường:** tìm kiếm (cả giọng nói), lộ trình, tối đa 3 điểm dừng, hướng dẫn làn đường, tính lại khi lệch tuyến,
toàn cảnh tuyến, tiếp tục chuyến dở dang, loại phương tiện (có ô tô điện), nhận liên kết Google Maps.

**Chế độ HUD:** giao diện đơn giản **lật gương** để phản chiếu lên kính lái; kết nối màn hình HUD Bluetooth riêng của hãng.

**Thiết bị trên xe (Bluetooth):** đọc **OBD-II** (ELM327: vòng tua, nhiệt độ nước / dầu / khí nạp, áp suất khí nạp,
bướm ga, tải động cơ, mức nhiên liệu, điện áp ắc quy, VIN, đọc / xoá mã lỗi); **TPMS** áp suất lốp (ngưỡng áp suất / nhiệt độ,
rò hơi, pin yếu, đảo lốp; cảm biến TPMS Aware, iCar TPMS hoặc qua HUD).

**Camera hành trình:** camera điện thoại, webcam USB, camera WiFi RTSP; **tự ghi khi xe chạy trên 5 km/h, tự dừng sau ~20 giây
đứng yên**; ghi khi chạy nền; chất lượng (bitrate); giới hạn dung lượng (GB); chọn thư mục lưu (thẻ SD); chụp ảnh; thu nhỏ
thành bong bóng trên bản đồ.

**Thống kê:** quãng đường, thời gian chạy, tốc độ trung bình, biểu đồ.

## 3. Đối chiếu với HawaMap

| Chức năng DATMAP | HawaMap trước đợt này | Đợt này |
|---|---|---|
| Bản đồ, chế độ tối, 3D, tìm kiếm, giọng nói, địa điểm đã lưu | Có | — |
| Dẫn đường, làn đường, tính lại tuyến, 3 điểm dừng, Android Auto | Có (thêm CarPlay) | — |
| Giới hạn tốc độ, vượt tốc độ, camera tốc độ, đường sắt, trạm thu phí | Có (dữ liệu OSM + ước tính) | Thêm **giới hạn phía trước**, **vào / hết khu dân cư** |
| Phân loại camera (tốc độ, đèn đỏ, tổng hợp, AI…) | Một loại | **Thêm** (OSM + báo cáo cộng đồng có chọn loại camera) |
| Đèn tín hiệu, gờ giảm tốc, vạch qua đường, trường học, khúc cua, hầm, trạm dừng nghỉ, giao lộ nguy hiểm | Chưa | **Thêm** (OSM; khúc cua tính từ hình dạng tuyến) |
| Biển cấm rẽ / chỉ được rẽ | Chưa | **Thêm** (quan hệ `restriction` của OSM tại giao lộ phía trước) |
| Bật / tắt hiển thị và âm thanh từng loại cảnh báo | Một số | **Thêm** đủ từng loại |
| Hiệu chỉnh tốc độ GPS, cảnh báo mất GPS, nhắc bật / tắt đèn | Chưa | **Thêm** |
| Chế độ HUD lật gương | Chưa | **Thêm** |
| Bong bóng nổi trên ứng dụng khác | Chưa | **Thêm** (ứng dụng Android; trình duyệt không cho phép) |
| Camera hành trình tự ghi khi xe chạy, giới hạn dung lượng, chất lượng, chụp ảnh, webcam USB | Ghi tay, ghi vòng | **Thêm** (webcam USB khi trình duyệt / thiết bị nhận) |
| Bản đồ offline | Chỉ lưu ô đã xem | **Thêm** tải vùng đang xem, tự cập nhật khi có Wi-Fi |
| Nhận liên kết Google Maps | Chưa | **Thêm** (chia sẻ vào ứng dụng, dán liên kết, link rút gọn) |
| OBD-II qua Bluetooth | Chưa | **Thêm** (Bluetooth LE ELM327: Chrome / Edge và ứng dụng Android) |
| Thống kê chuyến đi, biểu đồ | Có quãng đường, thời gian | **Thêm** biểu đồ tốc độ |
| TPMS áp suất lốp | Chưa | **Không làm đợt này**: mỗi hãng cảm biến phát dữ liệu theo định dạng riêng không công bố, không có thiết bị để kiểm thử |
| Màn hình HUD Bluetooth của hãng | Chưa | **Không làm**: giao thức độc quyền của phần cứng DATMAP |
| Camera WiFi RTSP | Chưa | **Không làm đợt này**: trình duyệt không phát được RTSP; cần trình phát gốc trong ứng dụng |
| Đăng nhập Google, đồng bộ tài khoản | Chưa | Để sau: cần OAuth client của công ty và máy chủ tài khoản |
| Cơ sở dữ liệu camera / biển báo riêng | — | HawaMap dùng OpenStreetMap + báo cáo cộng đồng; không sao chép dữ liệu của DATMAP |

## 4. Đã xây dựng trong HawaMap

| Chức năng | Mã nguồn | Kiểm thử |
|---|---|---|
| Các loại cảnh báo mới, mức Tắt / Hiển thị / Giọng nói từng loại | `public/js/loai-canh-bao.js`, `canh-bao.js`, `duong-xa.js` (truy vấn Overpass theo loại đang bật) | `test/canh-bao.test.js` |
| Khúc cua từ hình dạng tuyến, giới hạn tốc độ phía trước, biển cấm rẽ theo đường đang đi, vào / ra khu dân cư | `public/js/canh-bao.js` | `test/canh-bao.test.js`, `test/e2e/giao-dien.mjs` |
| Loại camera trong báo cáo cộng đồng | `public/js/loai-bao-cao.js`, `server.js` | `test/may-chu.test.js` |
| Hiệu chỉnh tốc độ GPS, mất GPS, nhắc bật / tắt đèn (giờ mặt trời) | `public/js/nhac-nho.js` | `test/nhac-nho.test.js` |
| HUD lật gương | `public/js/main.js` (batHud, renderManHud), `css/app.css` | `test/e2e/giao-dien.mjs` |
| Camera hành trình: tự ghi, chất lượng, dung lượng, ảnh, đổi camera / webcam USB | `public/js/camera-hanh-trinh.js` | `test/camera.test.js`, `test/e2e/giao-dien.mjs` |
| Bản đồ offline | `public/js/ban-do-offline.js`, `public/sw.js` | `test/ban-do-offline.test.js`, `test/e2e/giao-dien.mjs` |
| Liên kết Google Maps (dán, chia sẻ, `geo:`, rút gọn) | `public/js/lien-ket.js`, `server.js` (`/api/mo-lien-ket`), Android `MainActivity.kt`, `cau/LienKet.kt` | `test/lien-ket.test.js`, `test/e2e/xe.mjs` |
| OBD-II ELM327 | `public/js/obd.js`, Android `cau/Obd.kt` | `test/obd.test.js`, `test/e2e/xe.mjs` |
| Bong bóng nổi (Android) | Android `cau/BongBong.kt`, tin `hud` trong `main.js` | `test/e2e/xe.mjs` (dữ liệu gửi sang Android) |
| Thống kê chuyến đi, biểu đồ tốc độ | `public/js/hanh-trinh.js` | `test/hanh-trinh.test.js` |
