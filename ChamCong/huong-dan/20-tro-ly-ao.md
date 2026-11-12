# Trợ lý ảo Hawasuco
<!-- trang: | nhom: Trợ giúp -->

**Dùng để:** hỏi cách làm, tìm nhanh thông tin, hỏi số liệu bằng chữ hoặc giọng nói. Trả lời theo quyền của tài khoản; dữ liệu nhân sự không gửi ra ngoài.

## Cách dùng
1. Bấm vào **robot** ở góc phải dưới (hoặc **Ctrl + K**), gõ câu hỏi rồi Enter. Gõ không dấu cũng được.
2. Ví dụ: *ai sắp hết hạn hợp đồng*, *ai đang thử việc*, *hôm nay ai nghỉ*, *lương của* + họ tên, *cách nâng bậc lương*,
   *tỷ lệ bảo hiểm sửa ở đâu*, *mở bảng lương*, gõ mã NV hoặc số hợp đồng.
3. Bấm các nút trong câu trả lời để mở đúng trang / hồ sơ.
4. Hỏi rộng hơn: chế độ lao động – tiền lương (*thử việc tối đa bao lâu*, *cưới vợ được nghỉ mấy ngày*, *nghỉ thai sản bao lâu*, *trợ cấp thôi việc*…),
   tính nhanh (*lương 10 triệu thực lĩnh bao nhiêu*, *thuế TNCN thu nhập 25 triệu 1 người phụ thuộc*, *làm thêm 4 giờ chủ nhật lương 8 triệu*,
   *nữ sinh tháng 5/1975 bao giờ nghỉ hưu*, *âm lịch hôm nay*, *còn bao nhiêu ngày đến Tết*), hỏi về trợ lý (*bạn là ai*, *bạn làm được gì*).
   Câu trả lời về luật có ghi nguồn (điều luật); số liệu (tỷ lệ BH, giảm trừ, biểu thuế…) lấy từ Cài đặt của công ty.

## Nói chuyện bằng giọng nói (Chrome, Edge)
1. Bấm **micro** 🎤 rồi nói câu hỏi tiếng Việt – lần đầu chọn *Cho phép* dùng micro.
2. Trợ lý trả lời và **đọc to**. Nút **loa** 🔊 bật đọc cả câu hỏi gõ tay; nút loa nhỏ trên câu trả lời để đọc lại.
3. Nút **cài đặt giọng nói**: chọn giọng đọc, tốc độ, **nói chuyện liên tục**, **Nghe thử**; tắt / bật chuyển động của robot.
4. Lệnh nói: *dừng*, *đọc lại*, *kết thúc*.

## Giọng đọc AI tiếng Việt
- Mặc định trợ lý đọc bằng **giọng AI tiếng Việt** – giọng nữ tự nhiên, rõ ràng, có ngữ điệu; chạy ngay trên máy, **văn bản không gửi ra ngoài**,
  không cần cài giọng cho Windows.
- **Lần đầu** trình duyệt tải giọng AI từ máy chủ (khoảng 63 MB, trợ lý báo *Đang tải giọng đọc AI… %*), sau đó lưu lại – lần sau đọc ngay.
- Cài đặt giọng nói → *Giọng đọc*: **Giọng AI tiếng Việt** (khuyên dùng), các **giọng máy eSpeak** (miền Nam / Bắc / Trung, nhẹ nhưng nghe còn “máy”),
  hoặc giọng tiếng Việt cài trên Windows. Kéo **Tốc độ đọc** chậm lại nếu cần nghe kỹ → **Nghe thử**.
- Trợ lý báo *Máy chủ chưa có giọng đọc AI*: nhờ người quản trị chạy lại `CaiDat-MayChu-IIS.bat` của bộ cài mới (bộ cài tự tải giọng AI).
- Chạy 1 file trên máy: cài đặt giọng nói → **Nạp tệp giọng AI…** → chọn `vi_VN-vais1000-medium.onnx` và `ort-wasm-simd.wasm`.

> Nói câu hỏi (micro): Chrome / Edge gửi âm thanh câu hỏi tới dịch vụ nhận dạng giọng nói (cần Internet). Đọc câu trả lời bằng giọng tích hợp thì không gửi gì ra ngoài.
