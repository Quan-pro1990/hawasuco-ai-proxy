# App Android "Thất thoát nước"

App mở website của phần mềm trên máy chủ IIS (HTTP cổng 80, vd `http://192.168.1.10/` hoặc
`http://tenmien.vn/thatthoat/`) trong WebView, thêm những việc trình duyệt trên điện thoại làm không tiện:

- Lần đầu mở: nhập địa chỉ máy chủ, app gọi thử `api/ping` để chắc đúng máy chủ Thất thoát nước
  (không ghi đường dẫn mà máy chủ cài thành ứng dụng con thì app tự thử thêm `/thatthoat/`).
- Báo cáo PDF: **In** thẳng qua dịch vụ in của Android (máy in Wi-Fi / mạng, hoặc "Lưu dưới dạng PDF").
- Excel / PDF: **Mở** bằng ứng dụng khác, **Chia sẻ** (Zalo, email…), **Lưu vào máy** (chọn thư mục).
- Nút **Đổi máy chủ** ở thẻ Tài khoản; phím Back đóng hộp thoại đang mở trên trang.
- Cho phép HTTP không mã hoá (`usesCleartextTraffic`); địa chỉ `https://` cũng dùng được.

Trang web gọi app qua `window.ThatThoatApp`: `taiVe(url, tên, pdf)`, `doiMayChu()`, `phienBan()`.
Không dùng thư viện ngoài (không AndroidX), chạy từ Android 5.0 (minSdk 21), targetSdk 34.

## Cài lên điện thoại

File cài: `ThatThoatNuoc-DienThoai.apk` (cạnh `ThatThoatNuoc.exe`). Gói cài IIS chép file này vào máy chủ,
điện thoại tải tại `http://<máy chủ>/tai-app`. Lần đầu Android hỏi cho phép cài ứng dụng không rõ nguồn → cho phép.

Đang có app cũ (bản HTTPS cổng 8080): **gỡ app cũ trước** — khác chữ ký nên không cài đè được.

## Build lại APK

Đổi `versionCode` (tăng 1) và `versionName` trong `app/build.gradle` mỗi lần phát hành bản mới.

**Cách 1 — Android Studio** (Windows): File → Open → chọn thư mục `android` → Build → Generate App Bundles or APKs →
Build APK(s). File ra ở `app/build/outputs/apk/release/`.

**Cách 2 — GitHub Actions**: mỗi lần đẩy lên GitHub, workflow `.github/workflows/build.yml` build APK và `ThatThoatNuoc.exe`,
tải ở tab Actions → lần chạy mới nhất → Artifacts.

**Cách 3 — Linux không cần Gradle**: `./build-apk.sh` (cần JDK và các gói `android-sdk-platform-23 aapt dalvik-exchange
zipalign apksigner` của Ubuntu/Debian). Ra file `../ThatThoatNuoc-DienThoai.apk`.

### Khoá ký

APK ký bằng khoá `ky-app/thatthoat.jks` (mật khẩu mặc định `thatthoat-hawasuco`, đổi bằng biến môi trường `KY_MATKHAU`).
`build-apk.sh` tự tạo khoá nếu chưa có. Thư mục `ky-app/` **không** đưa lên GitHub (xem `.gitignore`): hãy cất giữ file
`.jks` — bản sau phải ký cùng khoá thì mới cài đè được bản trước; mất khoá thì người dùng phải gỡ app rồi cài lại
(dữ liệu nằm trên máy chủ nên không mất gì, chỉ phải nhập lại địa chỉ và đăng nhập).

Muốn GitHub Actions ký bằng cùng khoá: GitHub → Settings → Secrets and variables → Actions → thêm secret
`ANDROID_KY_BASE64` = nội dung base64 của file `.jks` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("thatthoat.jks"))`)
và `KY_MATKHAU` nếu đã đổi mật khẩu. Không có secret thì Actions ký bằng khoá debug (chỉ để thử).
