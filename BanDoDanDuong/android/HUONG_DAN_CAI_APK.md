# Cài HawaMap lên điện thoại Android và dùng với Android Auto không dây

## 1. Lấy tệp APK

Tệp APK (cài thẳng lên điện thoại) và tệp AAB (tải lên Google Play để dùng với Android Auto, xem mục 3) được build tự động trên GitHub
mỗi khi mã ứng dụng thay đổi.

1. Mở trang kho mã trên GitHub → tab **Actions** → chọn **Build APK HawaMap**.
2. Bấm vào lần chạy mới nhất có dấu tích xanh.
3. Kéo xuống mục **Artifacts**, bấm **HawaMap-apk** để tải tệp zip, giải nén ra tệp `HawaMap-<phiên bản>.apk`.

Muốn build lại bằng tay: tab **Actions** → **Build APK HawaMap** → **Run workflow**.

## 2. Cài lên điện thoại

1. Chép tệp APK sang điện thoại (Zalo, Google Drive, email, hoặc cáp USB).
2. Trên điện thoại, mở tệp APK. Lần đầu Android hỏi quyền **Cài ứng dụng không rõ nguồn gốc** cho ứng dụng đang mở tệp (Tệp, Chrome, Zalo…): bật cho phép rồi quay lại.
3. Bấm **Cài đặt**. Nếu Google Play Protect cảnh báo ứng dụng lạ: bấm **Thông tin chi tiết** → **Vẫn cài đặt**.
4. Mở HawaMap, cho phép **vị trí** (dẫn đường, cảnh báo tốc độ), **thông báo** (dẫn đường chạy nền); micro, camera chỉ cần khi dùng camera hành trình. Tìm bằng giọng nói dùng hộp nghe của Google: lần đầu Google có thể hỏi quyền micro cho chính nó.

Cần Android 8.0 trở lên. Bản sau cài đè được lên bản trước (cùng khoá ký), không mất dữ liệu.

## 3. Cho Android Auto hiện HawaMap: cài từ Google Play (kênh thử nghiệm nội bộ)

**Vì sao tệp APK tự cài không hiện trên xe:** theo [tài liệu của Google](https://developer.android.com/training/cars/testing),
xe chỉ chạy ứng dụng cài từ nguồn tin cậy như Google Play. Mục **Nguồn không xác định** (Unknown sources) trong cài đặt cho nhà
phát triển của Android Auto **chỉ áp dụng cho ứng dụng nghe nhạc, tin nhắn và ứng dụng dùng khi đỗ xe**, không áp dụng cho ứng dụng
dẫn đường viết bằng thư viện Android for Cars như HawaMap. Vì vậy bật mục đó cũng không làm HawaMap hiện trên xe.
Ở bản Android Auto mới, chế độ nhà phát triển bật bằng cách bấm 10 lần vào **Phiên bản và thông tin về quyền** trong mục **Giới thiệu**
(xem cuối mục này); nhưng dù tìm thấy "Nguồn không xác định", HawaMap vẫn không hiện trên xe nếu không cài từ Google Play.

Cách đúng là cài HawaMap qua **Google Play – Thử nghiệm nội bộ** (Internal testing): Google không cần duyệt, tối đa 100 người thử,
bản cài từ Google Play nên Android Auto chấp nhận.

**Làm một lần (người quản lý ứng dụng):**

1. Tạo tài khoản nhà phát triển tại [play.google.com/console](https://play.google.com/console) (phí một lần 25 USD, cần xác minh danh tính).
2. **Tạo ứng dụng** → tên *HawaMap*, ngôn ngữ Tiếng Việt, loại *Ứng dụng*, *Miễn phí*.
3. Lấy tệp **.aab** từ GitHub: tab **Actions** → **Build APK HawaMap** → lần chạy mới nhất → **Artifacts** → **HawaMap-aab** → giải nén
   ra `HawaMap-<phiên bản>.aab`.
4. Trong Play Console: **Thử nghiệm** → **Thử nghiệm nội bộ** → **Tạo bản phát hành mới**. Lần đầu Play hỏi về khoá ký ứng dụng: chọn
   để **Google quản lý khoá ký** (Play App Signing). Tải tệp `.aab` lên → **Tiếp** → **Lưu** → **Phát hành cho thử nghiệm nội bộ**.
5. Thẻ **Người thử nghiệm**: tạo danh sách email (tài khoản Google dùng trên điện thoại cần cài), lưu, rồi **sao chép đường liên kết tham gia**.
6. Nếu Play Console báo cần khai báo, điền các mục bắt buộc trong **Bảng điều khiển** (chính sách quyền riêng tư, quyền truy cập ứng dụng,
   đối tượng mục tiêu…). Thử nghiệm nội bộ không phải chờ duyệt.

**Trên mỗi điện thoại:**

1. **Gỡ bản HawaMap cài bằng tệp APK** trước (khác khoá ký nên không cài đè được; cài đặt và địa điểm đã lưu trên máy sẽ mất).
2. Mở đường liên kết tham gia (đăng nhập đúng tài khoản Google có trong danh sách) → **Trở thành người thử nghiệm** → **Tải xuống trên Google Play** → **Cài đặt**.
3. Mở cài đặt Android Auto → **Tùy chỉnh trình chạy** (Customize launcher): kiểm tra HawaMap đang được tích.

Bản mới: mỗi lần có bản mới, tải `.aab` mới lên Thử nghiệm nội bộ (mã phiên bản tự tăng theo `versionCode`); điện thoại tự cập nhật qua Google Play.

**Khoá tải lên riêng (nên làm trước khi phát hành rộng):** tệp `.aab` mặc định ký bằng khoá thử công khai trong kho mã. Để dùng khoá riêng:

```
keytool -genkeypair -v -keystore hawamap-tai-len.jks -alias hawamap -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 hawamap-tai-len.jks     # (Windows PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("hawamap-tai-len.jks")))
```

Trên GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, tạo: `HAWAMAP_KHOA_TAI_LEN_BASE64`
(chuỗi base64 ở trên), `HAWAMAP_MAT_KHAU_KHO` (mật khẩu kho khoá), `HAWAMAP_BI_DANH_KHOA` (`hawamap`), và `HAWAMAP_MAT_KHAU_KHOA` nếu mật khẩu
khoá khác mật khẩu kho. Giữ tệp `.jks` và mật khẩu ở nơi an toàn. Nếu đã tải lên bằng khoá thử, đổi khoá tải lên trong Play Console →
**Thiết lập** → **Tính toàn vẹn của ứng dụng** → **Yêu cầu đặt lại khoá tải lên**.

**Thử trên máy tính, không cần xe:** dùng Desktop Head Unit (DHU) theo README, mục "Build Android (Android Auto)". DHU chạy được cả bản APK
tự cài. Bật chế độ nhà phát triển của Android Auto: cài đặt Android Auto → **Giới thiệu** (About) → bấm 10 lần vào **Phiên bản và thông tin
về quyền** (Version and permission info) → **OK**; sau đó menu **⋮** có **Cài đặt cho nhà phát triển** và **Khởi động máy chủ đầu xe**
(Start head unit server). Tên mục có thể khác chút tuỳ máy và phiên bản Android Auto.

## 4. Kết nối Android Auto không dây

Ứng dụng không cần cài đặt gì thêm: Android Auto không dây và có dây chạy cùng một ứng dụng.

**Điều kiện**

- Điện thoại Android 11 trở lên (một số máy Pixel, Samsung chạy Android 10 cũng được), có Wi-Fi 5 GHz.
- Màn hình xe hỗ trợ **Android Auto không dây**. Xe chỉ có Android Auto cắm dây thì dùng **bộ chuyển không dây** (adapter cắm cổng USB của xe).

**Kết nối lần đầu**

1. Bật Bluetooth và Wi-Fi trên điện thoại (không cần nối vào mạng Wi-Fi nào).
2. Trong cài đặt Android Auto, bật **Android Auto không dây** (Wireless Android Auto).
3. Trên màn hình xe, chọn kết nối điện thoại mới / Android Auto, ghép đôi Bluetooth với điện thoại và đồng ý các câu hỏi hiện trên điện thoại. Nhiều xe yêu cầu cắm cáp USB một lần đầu rồi mới dùng không dây được.
4. Lần sau, khi lên xe và khởi động xe, điện thoại tự kết nối.

**Mở HawaMap trên xe:** bấm biểu tượng danh sách ứng dụng trên màn hình Android Auto → **HawaMap**. Bắt đầu dẫn đường trên điện thoại khi đang kết nối thì màn hình xe tự dẫn theo cùng tuyến, và ngược lại.

## 5. Gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Không thấy HawaMap trên màn hình xe | HawaMap phải được cài từ Google Play (Thử nghiệm nội bộ, mục 3); bản APK tự cài không hiện trên xe kể cả khi bật "Nguồn không xác định". Kiểm tra HawaMap đã được tích trong **Tùy chỉnh trình chạy**, rồi ngắt kết nối và kết nối lại xe |
| Không tìm thấy mục "Nguồn không xác định" trong Android Auto | Không cần mục này: nó không áp dụng cho ứng dụng dẫn đường như HawaMap. Cài HawaMap từ Google Play theo mục 3 |
| Không kết nối không dây được | Kiểm tra xe / bộ chuyển có hỗ trợ không dây; bật Bluetooth và Wi-Fi; xoá ghép đôi cũ trên xe và trên điện thoại rồi ghép lại; thử cắm cáp một lần |
| Điện thoại báo "Ứng dụng chưa được cài đặt" | Gỡ bản HawaMap cũ có khoá ký khác rồi cài lại |
| Giọng dẫn đường không phải tiếng Việt, hoặc không đọc | Vào HawaMap → **Cài đặt** → **Giọng nói**: dòng đầu cho biết máy có giọng tiếng Việt chưa. Chưa có thì bấm **Cài giọng tiếng Việt** (cài "Dịch vụ lời nói của Google" và tải tiếng Việt), xong quay lại HawaMap. Có nhiều giọng thì chọn ở mục **Giọng đọc tiếng Việt**, bấm **Nghe thử** |
| Bấm micro tìm bằng giọng nói báo "chưa có dịch vụ nhận dạng giọng nói" | Cài / bật ứng dụng **Google** (hoặc "Dịch vụ lời nói của Google") từ Google Play; trong ứng dụng Google cho phép **Micro**. Muốn nhận dạng khi không có mạng: ứng dụng Google → Cài đặt → Giọng nói → Nhận dạng giọng nói ngoại tuyến → tải **Tiếng Việt** |
| Bản đồ trên xe trắng hoặc không có vị trí | Cho phép quyền vị trí cho HawaMap; mở HawaMap trên điện thoại một lần trước khi kết nối xe |
| Muốn thử trên máy tính, không cần xe | Dùng Desktop Head Unit (DHU) theo README, mục "Build Android (Android Auto)" |

Bản APK dùng trên điện thoại (không có màn hình xe). Muốn dùng trên xe qua Android Auto: cài từ Google Play theo mục 3. Phát hành công khai
trên Google Play (kênh chính thức) thì ứng dụng cho Android Auto phải qua kiểm duyệt riêng của Google.
