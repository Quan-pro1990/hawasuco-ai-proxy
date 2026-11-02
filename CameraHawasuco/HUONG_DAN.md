# HAWASUCO Camera — chụp ảnh hiện trường có giờ, tọa độ, địa chỉ

Ứng dụng Android chụp ảnh kiểu **Timemark**: ngay trên khung ngắm và trên ảnh lưu có

- băng rôn **HAWASUCO | giờ:phút | logo công ty**, 5 ngôi sao phía trên;
- **ngày + thứ**, **địa chỉ** (tự tra từ GPS), **tọa độ GPS**, **Nhân viên**, **Đội**, **Thiết bị**, nơi làm việc, nội dung công việc;
- **bản đồ nhỏ** (vệ tinh hoặc đường phố) góc trên trái, có ghim vị trí và hình quạt xanh chỉ hướng camera;
- **mã ảnh** viết dọc mép phải, chữ "HAWASUCO Camera — Ảnh chụp thực tế" góc phải dưới.

Ảnh lưu vào **Thư viện ảnh → thư mục DCIM/HAWASUCO**, kèm EXIF (tọa độ GPS, giờ chụp) nên mở trong
Google Photos / Thư viện vẫn xem được vị trí. Giờ trên ảnh lấy theo vệ tinh GPS nếu giờ điện thoại bị chỉnh sai quá 1 phút.

## Cài đặt trên điện thoại

1. Chép tệp **`HawasucoCamera.apk`** vào điện thoại (gửi qua Zalo, cáp USB, hoặc tải từ GitHub:
   mở `https://github.com/Quan-pro1990/hawasuco-ai-proxy` → thư mục `CameraHawasuco` → `HawasucoCamera.apk` → nút tải xuống).
2. Mở tệp APK. Lần đầu Android hỏi **"Cho phép cài ứng dụng không rõ nguồn gốc"** → bật cho ứng dụng đang mở tệp
   (Zalo / Chrome / Quản lý tệp) → quay lại bấm **Cài đặt**.
   Nếu Google Play Protect cảnh báo "ứng dụng chưa được xác minh" → **Thêm chi tiết → Vẫn cài đặt**.
3. Mở **HAWASUCO Camera** → cho phép **Camera** và **Vị trí** (chọn **"Vị trí chính xác"**, "Khi dùng ứng dụng").
   Android 9 trở xuống hỏi thêm quyền **Bộ nhớ** để lưu ảnh.
4. Lần đầu mở, app hiện bảng nhập **Nhân viên** và **Đội** (bấm **Chọn ▾** để lấy Đội Cấp nước số 1–6, hoặc gõ tay).
5. Bật **Vị trí (GPS)** của điện thoại. Chấm trên cùng chuyển xanh "GPS ±5 m" là có tọa độ.

Yêu cầu: Android 6.0 trở lên. Cần mạng (4G/Wi-Fi) để tra địa chỉ và tải bản đồ; mất mạng vẫn chụp được,
ảnh vẫn có giờ và tọa độ (địa chỉ / bản đồ đã tải trước đó vẫn dùng được ở khu vực cũ).

## Sử dụng

| Thao tác | Cách làm |
|---|---|
| Chụp | Nút tròn trắng, hoặc **phím âm lượng** |
| Sửa nhân viên, đội, thiết bị, nơi làm việc, nội dung | Nút ⚙ góc phải trên, hoặc **chạm vào phần chữ** trên khung ngắm |
| Lấy nét | Chạm vào khung ngắm |
| Zoom | Chụm / mở 2 ngón tay |
| Đèn flash | Nút tia sét góc trái trên: tắt → tự động → luôn bật |
| Camera trước / sau | Nút mũi tên tròn góc phải dưới |
| Xem lại, **chia sẻ Zalo**, xoá | Chạm ảnh nhỏ góc trái dưới |

Trong trang **Thông tin & cài đặt** (nút ⚙):

- **Địa chỉ**: tự động đầy đủ (ấp, xã, huyện, tỉnh) / tự động rút gọn ("Châu Thành, Cần Thơ") / tự nhập
  (khi địa chỉ tự tra chưa đúng, nhất là sau sáp nhập tỉnh, xã).
- **Nhân viên**, **Đội**: chữ to in đậm, luôn nằm trên một dòng (tên dài thì chữ tự nhỏ lại cho vừa);
  chưa nhập thì khung ngắm nhắc "(chạm để nhập)", ảnh lưu bỏ dòng trống;
  **Thiết bị** (bấm **Chọn ▾**: đồng hồ nước, TLK, SCADA, van, trụ cứu hỏa… hoặc gõ tay), nơi làm việc và
  nội dung công việc (không bắt buộc, để trống thì không in lên ảnh).
- Bật / tắt từng dòng: bản đồ, địa chỉ, tọa độ, nhân viên, đội, thiết bị, nơi làm việc, nội dung, mã ảnh.
- **Kiểu bản đồ**: vệ tinh (Esri) hoặc đường phố (OpenStreetMap).
- **Ảnh lớn** (nét nhất, tối đa ~12 MP) hoặc **Ảnh vừa** (~3 MP, nhẹ, gửi nhanh).
- **Lưu thêm ảnh gốc** không watermark (vào DCIM/HAWASUCO/Anh goc).

Ảnh chụp khi cầm ngang sẽ lưu thành ảnh ngang, watermark vẫn ở góc trái dưới.

**Nhân viên và Đội chỉ cần nhập một lần**: được lưu trong máy, mở lại app hay **cài bản mới đè lên bản cũ**
đều giữ nguyên (không cần gỡ app cũ trước khi cài bản mới). Nếu gỡ hẳn app rồi cài lại, Android tự khôi phục
cài đặt từ bản sao lưu Google của máy (khi máy bật Sao lưu); không có sao lưu thì phải nhập lại.

## Build lại tệp APK (dành cho người sửa mã nguồn)

Mã nguồn Java trong `src/`, không cần Android Studio. Trên Ubuntu / Debian:

```bash
sudo apt install openjdk-17-jdk android-sdk-platform-23 aapt dalvik-exchange zipalign apksigner
./build.sh
```

`build.sh` ký APK bằng khoá `ky-ung-dung.jks`. **Giữ kỹ tệp khoá này** (không đưa lên GitHub — đã chặn trong `.gitignore`):
bản cập nhật phải ký đúng khoá cũ thì điện thoại mới cài đè được; mất khoá thì phải gỡ app cũ rồi cài lại
(ảnh đã chụp trong Thư viện không mất). Tăng `android:versionCode` / `versionName` trong `AndroidManifest.xml` mỗi lần phát hành.

| Tệp | Nội dung |
|---|---|
| `MainActivity.java` | màn hình chụp, quyền, nút bấm |
| `CameraController.java` | camera (Camera2): khung ngắm, lấy nét, flash, zoom, chụp |
| `Watermark.java` | vẽ watermark (dùng chung cho khung ngắm và ảnh lưu) |
| `LocationTracker.java`, `AddressLookup.java` | GPS, la bàn, giờ GPS, tra địa chỉ (Google Geocoder → OpenStreetMap) |
| `MapTiles.java` | ghép bản đồ nhỏ, lưu đệm ô bản đồ để dùng khi mất mạng |
| `PhotoSaver.java` | xoay ảnh, ghi EXIF, lưu vào DCIM/HAWASUCO |
| `Dialogs.java`, `Views.java` | hộp thoại cài đặt / xem lại ảnh, các nút vẽ tay |
