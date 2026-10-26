# App Android "Quản lý tài sản"

App kết nối **máy chủ Quản lý tài sản** của công ty (máy chủ IIS cài bằng `CAI-DAT-MAY-CHU.bat`) và mở trang web
của phần mềm trong app, thêm những việc trình duyệt trên điện thoại không làm được hoặc không tiện:

| Việc | Trình duyệt điện thoại | App Android |
|---|---|---|
| Quét tem QR bằng camera | chỉ khi máy chủ có **https** hợp lệ | luôn được — camera của app, đọc QR ngay trên máy (ZXing), cả khi máy chủ chạy `http://IP:8080` |
| Quét liên tục khi kiểm kê / điều chuyển | quét trong khung nhỏ trên trang | camera toàn màn hình, hiện kết quả từng tem (đã kiểm kê / đã thêm / lỗi), rung báo |
| Máy chủ chưa có tên miền (chứng chỉ tự ký `https://IP:8443`) | cảnh báo "không an toàn" mỗi lần | hỏi **một lần** theo *mã nhận dạng chứng chỉ*, sau đó ghim chứng chỉ đó |
| Xuất Excel, tải ảnh | tải vào thư mục Download | hỏi **Mở** (Excel, WPS…), **Chia sẻ** (Zalo, email…), **Lưu vào máy** |
| Lấy vị trí GPS cho tài sản | chỉ khi https | luôn được |
| In tem QR | — | dịch vụ in của Android (máy in Wi-Fi, lưu PDF) |
| Cập nhật | — | máy chủ có bản app mới → app tự hỏi cập nhật |

Đăng nhập, phân quyền, dữ liệu đều ở máy chủ: app chỉ nhớ địa chỉ máy chủ (và phiên đăng nhập như trình duyệt).

## Cài lên điện thoại

File cài: `QuanLyTaiSan-DienThoai.apk` (cạnh `QuanLyTaiSan.exe`). Gói máy chủ (`dist/quanlytaisan-may-chu-*.zip`) có sẵn
file này; bộ cài IIS chép nó vào thư mục site, điện thoại tải tại **`<địa chỉ trang web>/tai-app`**, hoặc:

- mở trang web bằng Chrome trên điện thoại → trang đăng nhập (hoặc **Thêm**) có **Tải app** / **Mở bằng app**
  ("Mở bằng app" mở app và điền sẵn địa chỉ máy chủ; chưa cài app thì tải app);
- quản trị trên máy tính: **Cài đặt** có mã QR tải app — nhân viên quét bằng camera điện thoại.

Lần đầu Android hỏi cho phép cài ứng dụng không rõ nguồn → cho phép. Mở app → nhập địa chỉ máy chủ
(vd `taisan.congty.vn`, hoặc IP `192.168.1.10` — app tự thử https/http, cổng 8443/8080), hoặc bấm
**Quét tem QR để lấy địa chỉ** và quét tem dán trên một tài sản bất kỳ. Máy chủ chưa có tên miền: app hiện
**mã nhận dạng chứng chỉ** (vd `3A1B-9C2D-4E5F-6071`) — so với mã bộ cài máy chủ in ra ở bước cuối rồi bấm **Tin cậy**.

Đổi máy chủ: **Thêm → App điện thoại → Đổi máy chủ**.

## Cấu trúc

```
android/
  app/build.gradle                 phiên bản app (versionCode, versionName), ký app
  app/src/main/AndroidManifest.xml quyền: Internet, Camera, Vị trí, Rung, Cài bản cập nhật
  app/src/main/java/vn/com/hawasuco/taisan/
    MainActivity.java   màn hình kết nối, WebView, cầu nối cho trang web, tải file, chọn / chụp ảnh, in, GPS, cập nhật
    KetNoi.java         tìm máy chủ (api/ping), ghim chứng chỉ tự ký theo SHA-256, mã nhận dạng
    ManQuet.java        màn hình quét tem: camera (TextureView), khung ngắm, đèn, kết quả từng tem
    DocQR.java          đọc mã QR trong khung hình camera bằng ZXing (Java thuần — kiểm thử được trên máy tính)
    TepProvider.java    đưa file vừa tải cho ứng dụng khác; nhận ảnh từ ứng dụng Camera
  app/src/main/res/                icon (logo công ty + huy hiệu QR), màu, network_security_config (xml/mang.xml)
  build-apk.sh                     build không cần Gradle (Linux)
  kiem-thu/                        kiểm thử: đọc QR trên máy tính, chạy app trên máy ảo Android (GitHub Actions)
```

Thư viện ngoài duy nhất: [ZXing core](https://github.com/zxing/zxing) 3.5.3 (Apache License 2.0) để đọc mã QR;
không dùng AndroidX. Chạy từ Android 5.0 (minSdk 21), targetSdk 34.

### Trang web ↔ app

App gắn `window.QuanLyTaiSanApp` vào trang (trang web dùng khi có, xem `web/app.js`):

| Hàm | Việc |
|---|---|
| `phienBan()`, `maPhienBan()`, `mayChu()`, `maChungChi()` | thông tin app, máy chủ đang dùng |
| `coQuet()`, `moQuet(cheDo, tieuDe, goiY)`, `dongQuet()` | mở / đóng camera quét (`cheDo`: `mot` / `lientuc`) |
| `baoQuet(tin, loai)` | trang báo kết quả tem vừa quét lên màn hình camera (`ok` / `loi` / ``) |
| `taiVe(url, ten, token)` | tải file của máy chủ rồi hỏi mở / chia sẻ / lưu |
| `rung(mau)`, `inTrang(ten)`, `layViTri()`, `capNhat()`, `doiMayChu()` | rung, in, GPS, cập nhật app, đổi máy chủ |

App gọi lại trang: `ungDungQuet(maQR)`, `ungDungDongQuet()`, `ungDungViTri({viDo, kinhDo, saiSo} | {loi})`,
`ungDungInXong()`, `ungDungQuayLai()` (phím Back: trang đóng hộp thoại đang mở → trả 1).

Máy chủ: `/tai-app` trả file APK; `/api/ping` có `app: {phienBan, ma, kichThuoc}` đọc từ AndroidManifest trong APK
(`src/AppDienThoai.cs`) — app so `ma` với `versionCode` của chính nó để hỏi cập nhật.

## Build lại APK

Mỗi lần phát hành: tăng `versionCode` (1, 2, 3…) và đổi `versionName` trong `app/build.gradle`.

**Cách 1 — Linux, không cần Gradle**: `./build-apk.sh` (cần JDK và các gói Ubuntu/Debian
`aapt dalvik-exchange zipalign apksigner`). Ra file `../QuanLyTaiSan-DienThoai.apk`, cạnh `QuanLyTaiSan.exe`. Rồi chạy
`../build.sh` (hoặc `build.bat` trên Windows) để đóng lại gói máy chủ có app mới; cài lại máy chủ (hoặc chép file APK
vào thư mục site, vd `C:\inetpub\QuanLyTaiSan`) — điện thoại mở app sẽ được hỏi cập nhật.

**Cách 2 — Android Studio** (Windows): File → Open → chọn thư mục `android` → Build → Generate App Bundles or APKs →
Build APK(s). File ra ở `app/build/outputs/apk/release/app-release.apk` → đổi tên thành `QuanLyTaiSan-DienThoai.apk`.

**Cách 3 — GitHub Actions**: workflow `.github/workflows/quanlytaisan-android.yml` build bằng Gradle và `build-apk.sh`,
chạy app trên máy ảo Android 14 (kết nối https tự ký, đăng nhập, quét kiểm kê, GPS, tải Excel, cập nhật app);
APK và ảnh chụp màn hình ở tab Actions → Artifacts.

Kiểm thử phần đọc QR trên máy tính: `kiem-thu/thu-doc-qr.sh`.

### Khoá ký

APK ký bằng khoá `ky-app/quanlytaisan.jks` (mật khẩu mặc định `quanlytaisan-hawasuco`, đổi bằng biến môi trường
`KY_MATKHAU`). `build-apk.sh` tự tạo khoá nếu chưa có. Thư mục `ky-app/` **không** đưa lên GitHub (repo công khai —
xem `.gitignore`): hãy cất giữ file `.jks`. Bản sau phải ký cùng khoá thì mới cài đè được bản trước; ký khoá khác thì
app báo **"Cần gỡ app cũ"** khi cập nhật — gỡ app rồi cài lại (dữ liệu nằm trên máy chủ nên không mất gì, chỉ phải nhập
lại địa chỉ máy chủ và đăng nhập).
