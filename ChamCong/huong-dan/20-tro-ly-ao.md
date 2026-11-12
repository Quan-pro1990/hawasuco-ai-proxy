# Trợ lý ảo Hawasuco
<!-- trang: | nhom: Trợ giúp -->

**Dùng để:** hỏi cách làm, tìm nhanh thông tin, hỏi số liệu bằng chữ hoặc giọng nói. Trả lời theo quyền của tài khoản; dữ liệu nhân sự không gửi ra ngoài.

## Cách dùng
1. Bấm vào **robot** ở góc phải dưới (hoặc **Ctrl + K**), gõ câu hỏi rồi Enter. Gõ không dấu cũng được.
2. Ví dụ: *ai sắp hết hạn hợp đồng*, *ai đang thử việc*, *hôm nay ai nghỉ*, *lương của* + họ tên, *cách nâng bậc lương*,
   *tỷ lệ bảo hiểm sửa ở đâu*, *mở bảng lương*, gõ mã NV hoặc số hợp đồng.
3. Bấm các nút trong câu trả lời để mở đúng trang / hồ sơ.

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
