# Câu hỏi thường gặp
<!-- trang: | nhom: Trợ giúp -->

## Không thêm được tài khoản người dùng / tài khoản chấm công
Chỉ **tài khoản quản trị** trên **máy chủ** mới thêm được: Cài đặt & dữ liệu → **Dữ liệu & tài khoản** → *Tài khoản đăng nhập* →
**Thêm tài khoản** hoặc **Tạo tài khoản cho từng phòng / đội…**. Chạy 1 file trên máy thì không có tài khoản.
Tài khoản cấp phòng / đội phải đánh dấu ít nhất 1 phòng / đội; tên đăng nhập không có dấu cách; mật khẩu từ 6 ký tự.
Chi tiết: [Tài khoản & phân quyền](#huongdan?p=tai-khoan-phan-quyen).

## Ổ C máy chủ sắp đầy / dữ liệu, bản sao lưu đang nằm ở ổ C
Trên máy chủ, mở thư mục bộ cài **ChamCong**, nhấp đúp **ChuyenDuLieu-SangO-D.bat** → bấm *Yes*. Dữ liệu, tài khoản, hồ sơ scan và bản
sao lưu được chuyển sang `D:\ChamCongData` (chép, kiểm tra từng tệp rồi mới xoá bản trên ổ C); phần mềm tạm dừng khoảng 1 phút.
Lỗi giữa chừng thì dữ liệu ở ổ C giữ nguyên. Xem nơi lưu và chỗ trống: **Cài đặt & dữ liệu → Dữ liệu & tài khoản** (tài khoản quản trị).
Bản sao lưu hằng ngày được nén; ổ còn dưới 1 GB trống thì máy chủ tự xoá bớt bản cũ nhất.

## Sao lưu, khôi phục dữ liệu
- Chạy 1 file trên máy: **Cài đặt & dữ liệu → Sao lưu dữ liệu → Sao lưu ra file** mỗi tuần (chép file `.json` ra USB, Google Drive…);
  sang máy khác: **Khôi phục từ file…**.
- Trên máy chủ: máy chủ tự sao lưu mỗi ngày vào ổ D (giữ 120 ngày gần nhất); **Cài đặt & dữ liệu → Dữ liệu & tài khoản** →
  **Tải bản sao lưu về máy** để cất riêng; tài khoản quản trị xem và khôi phục các bản sao lưu hằng ngày.

## Quên mật khẩu
Nhờ tài khoản quản trị: Dữ liệu & tài khoản → dòng tài khoản → **Đặt lại mật khẩu / vai trò**.

## Bảng chấm công / bảng lương không sửa được
Kỳ đã **chốt lương** (dấu 🔒 cạnh tháng): Bảng lương → **Mở khoá** (cần quyền sửa tiền lương). Hoặc tài khoản chỉ có quyền *Xem*.

## Nhập khung giờ làm thêm bị báo “không hợp lệ”
- Viết dạng `17:30-21:00` (giờ:phút, gạch nối); nhiều khung cách nhau dấu phẩy và **không chồng nhau** (`17-19, 22-2`); giờ từ 0 đến 24.
- Tài khoản cấp phòng / đội nhập 2 khung giờ trở lên mà máy chủ báo *Giá trị ô chấm công không hợp lệ*: máy chủ là bản cũ –
  chạy lại **CaiDat-MayChu-IIS.bat** bản mới để cập nhật (dữ liệu giữ nguyên).

## Màn hình chói mắt / muốn nền tối
Bấm nút **mặt trăng** trên thanh tiêu đề (cạnh nút *Hướng dẫn*) để chuyển sang giao diện **tối dịu mắt**; bấm nút **mặt trời** để về sáng.
Hoặc **Cài đặt & dữ liệu → Đơn vị & chữ ký → Giao diện màu**: *Sáng*, *Tối*, *Theo Windows* (tự theo chế độ sáng / tối của máy).
Lựa chọn lưu riêng cho từng máy; phiếu lương, bảng lương khi in vẫn là màu sáng.

## Lương sai so với tính tay
Bấm tên người trên bảng lương để xem chi tiết. Kiểm tra: loại lao động / công chuẩn, ký hiệu chấm công, mức lương theo kỳ, thời gian thử việc,
quyết định nâng lương có ngày hiệu lực, người phụ thuộc theo tháng.

## Có người vừa lưu dữ liệu, phần mềm hỏi tải bản mới
Chọn **Tải bản mới nhất** (bỏ thay đổi vừa làm, làm lại) hoặc **Ghi đè** (mất thay đổi của người kia). Chấm công theo ô thì phần mềm tự ghép.

## Đổi máy / chạy 1 file bị mất dữ liệu
Chạy 1 file: dữ liệu nằm trong trình duyệt – thường xuyên **Sao lưu ra file**, sang máy mới **Khôi phục từ file**. Trên máy chủ dữ liệu
nằm ở ổ D và tự sao lưu mỗi ngày.

## Trợ lý không trả lời bằng AI (không thấy nhãn AI)
- Bộ não AI chỉ có khi dùng **máy chủ**; người quản trị bật ở Cài đặt & dữ liệu → Dữ liệu & tài khoản → **Trợ lý ảo AI (Claude)** → **Lưu & thử kết nối**.
- *Khóa / mã truy cập không hợp lệ*: nhập lại khóa API (hoặc mã PROXY_AUTH_TOKEN). *Không kết nối được*: máy chủ cần ra Internet (HTTPS) tới api.anthropic.com
  hoặc máy chủ AI trung gian – kiểm tra tường lửa, proxy.
- Trên máy mình đã tắt: nút **Cài đặt trợ lý** → chọn lại *Dùng AI Claude…*. Câu hỏi về dữ liệu nhân viên luôn trả lời trên máy, không qua AI.

## Micro / giọng đọc của trợ lý không chạy
- Micro: dùng Chrome / Edge, cho phép micro trên thanh địa chỉ; kiểm tra Cài đặt → Đơn vị & chữ ký → Trợ lý ảo.
- Giọng đọc: cài đặt giọng nói → chọn **Giọng AI tiếng Việt** → **Nghe thử**; kiểm tra loa / âm lượng máy. Lần đầu phải chờ tải giọng AI (~63 MB).
  Báo *Máy chủ chưa có giọng đọc AI* hoặc *Máy chủ đang chặn giọng đọc*: chạy lại `CaiDat-MayChu-IIS.bat` của bộ cài mới trên máy chủ.
