# Tài khoản & phân quyền
<!-- trang: | nhom: Thiết lập | them: caidat -->

**Dùng để:** cấp tài khoản đăng nhập cho từng người / từng phòng, đội và giới hạn phần được xem, được sửa.
Chỉ có khi phần mềm **chạy trên máy chủ** (https://qlns.capnuochaugiang.vn/) và chỉ **tài khoản quản trị** làm được.

## Thêm tài khoản
1. Đăng nhập bằng tài khoản **quản trị** → **Cài đặt & dữ liệu** → thẻ **Dữ liệu & tài khoản** → mục *Tài khoản đăng nhập*.
2. Bấm **Thêm tài khoản**: nhập *Tên đăng nhập* (không dấu cách, vd `chamcong.d1`), *Mật khẩu* (ít nhất 6 ký tự).
3. Chọn **Mẫu phân quyền** để điền nhanh, hoặc tự chọn:
   - **Cấp**: *Quản trị* · *Cấp công ty* (mọi phòng, đội) · *Cấp phòng / đội* (đánh dấu các đơn vị được giao).
   - **Quyền từng phần** – Không / Xem / Sửa: *Chấm công*, *Nhân sự*, *Tiền lương*, *Thiết lập*
     (cấp phòng / đội: tiền lương tối đa *Xem*, không có thiết lập).
4. **Lưu**. Người dùng đăng nhập rồi tự đổi mật khẩu.

## Tạo nhanh cho tất cả phòng / đội
**Tạo tài khoản cho từng phòng / đội…** → chọn quyền (mặc định trưởng phòng / đội trưởng) → đánh dấu đơn vị → **Tạo tài khoản**.
Mật khẩu ngẫu nhiên **chỉ hiện 1 lần** – bấm **In danh sách** để phát.

## Mẫu phân quyền
| Mẫu | Phạm vi | Chấm công | Nhân sự | Tiền lương | Thiết lập |
|---|---|---|---|---|---|
| Kế toán tiền lương | Công ty | Xem | Xem | Sửa | Sửa |
| Cán bộ tổ chức – nhân sự | Công ty | Sửa | Sửa | Xem | Xem |
| Lãnh đạo | Công ty | Xem | Xem | Xem | Xem |
| Trưởng phòng, đội trưởng | Đơn vị | Sửa | Sửa | Xem | – |
| Chấm công đơn vị | Đơn vị | Sửa | – | – | – |

## Không thêm được tài khoản?
- Đang **chạy 1 file trên máy** (mở tệp `.html`): không có tài khoản – phải dùng bản trên máy chủ.
- Không phải tài khoản **quản trị**: thẻ *Dữ liệu & tài khoản* không có mục tài khoản – nhờ người quản trị.
- Báo lỗi khi lưu – đọc dòng báo đỏ góc phải dưới:
  - *Tên đăng nhập 2–40 ký tự, không có dấu cách* → bỏ dấu cách (vd `chamcong.doi1`).
  - *Mật khẩu phải có ít nhất 6 ký tự*.
  - *Chọn ít nhất 1 phòng / đội…* → tài khoản cấp phòng / đội phải đánh dấu đơn vị được giao.
  - *Chọn ít nhất 1 quyền Xem hoặc Sửa*.
- Vừa cập nhật phần mềm mà máy chủ vẫn chạy bản cũ: chạy lại `CaiDat-MayChu-IIS.bat` của bộ cài mới (dữ liệu, tài khoản giữ nguyên).

> Máy chủ kiểm tra lại quyền: phần không được xem thì không gửi về máy; phần chỉ được xem thì không lưu thay đổi;
> tài khoản đội không sửa được người ngoài đội, không sửa kỳ đã chốt.
