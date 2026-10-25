# Cài HawaMap lên điện thoại Android và dùng với Android Auto không dây

## 1. Lấy tệp APK

Tệp APK được build tự động trên GitHub mỗi khi mã ứng dụng thay đổi.

1. Mở trang kho mã trên GitHub → tab **Actions** → chọn **Build APK HawaMap**.
2. Bấm vào lần chạy mới nhất có dấu tích xanh.
3. Kéo xuống mục **Artifacts**, bấm **HawaMap-apk** để tải tệp zip, giải nén ra tệp `HawaMap-<phiên bản>.apk`.

Muốn build lại bằng tay: tab **Actions** → **Build APK HawaMap** → **Run workflow**.

## 2. Cài lên điện thoại

1. Chép tệp APK sang điện thoại (Zalo, Google Drive, email, hoặc cáp USB).
2. Trên điện thoại, mở tệp APK. Lần đầu Android hỏi quyền **Cài ứng dụng không rõ nguồn gốc** cho ứng dụng đang mở tệp (Tệp, Chrome, Zalo…): bật cho phép rồi quay lại.
3. Bấm **Cài đặt**. Nếu Google Play Protect cảnh báo ứng dụng lạ: bấm **Thông tin chi tiết** → **Vẫn cài đặt**.
4. Mở HawaMap, cho phép **vị trí** (dẫn đường, cảnh báo tốc độ), **thông báo** (dẫn đường chạy nền); micro, camera chỉ cần khi dùng tìm bằng giọng nói, camera hành trình.

Cần Android 8.0 trở lên. Bản sau cài đè được lên bản trước (cùng khoá ký), không mất dữ liệu.

## 3. Cho Android Auto hiện HawaMap

Android Auto **chỉ hiện ứng dụng cài từ Google Play**, trừ khi bật "nguồn không xác định". Làm một lần:

1. Mở cài đặt Android Auto trên điện thoại: **Cài đặt** → **Thiết bị đã kết nối** → **Lựa chọn ưu tiên kết nối** → **Android Auto** (máy Samsung: tìm "Android Auto" trong ô tìm kiếm của Cài đặt).
2. Kéo xuống cuối, bấm **10 lần** vào dòng **Phiên bản** (Version) → đồng ý bật chế độ nhà phát triển.
3. Bấm menu **⋮** ở góc trên → **Cài đặt cho nhà phát triển** (Developer settings).
4. Tích **Nguồn không xác định** (Unknown sources).
5. Quay lại cài đặt Android Auto → **Tùy chỉnh trình chạy** (Customize launcher): kiểm tra HawaMap đang được tích.

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
| Không thấy HawaMap trên màn hình xe | Chưa bật **Nguồn không xác định** (mục 3), hoặc chưa tích HawaMap trong **Tùy chỉnh trình chạy**. Ngắt kết nối rồi kết nối lại xe |
| Không kết nối không dây được | Kiểm tra xe / bộ chuyển có hỗ trợ không dây; bật Bluetooth và Wi-Fi; xoá ghép đôi cũ trên xe và trên điện thoại rồi ghép lại; thử cắm cáp một lần |
| Điện thoại báo "Ứng dụng chưa được cài đặt" | Gỡ bản HawaMap cũ có khoá ký khác rồi cài lại |
| Bản đồ trên xe trắng hoặc không có vị trí | Cho phép quyền vị trí cho HawaMap; mở HawaMap trên điện thoại một lần trước khi kết nối xe |
| Muốn thử trên máy tính, không cần xe | Dùng Desktop Head Unit (DHU) theo README, mục "Build Android (Android Auto)" |

Bản APK này dành để cài thử. Khi đưa lên Google Play cần khoá ký riêng giữ kín, và ứng dụng cho Android Auto phải qua kiểm duyệt riêng của Google.
