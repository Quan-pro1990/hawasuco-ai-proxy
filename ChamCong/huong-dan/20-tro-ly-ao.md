# Trợ lý ảo Hawasuco
<!-- trang: | nhom: Trợ giúp -->

**Dùng để:** hỏi cách làm, tìm nhanh thông tin, hỏi số liệu bằng chữ hoặc giọng nói. Trả lời theo quyền của tài khoản; dữ liệu nhân sự không gửi ra ngoài.
Có máy chủ thì bật được **bộ não AI Claude** để trả lời tự nhiên như trợ lý ảo trên web.capnuochaugiang.vn.

## Cách dùng
1. Bấm vào **robot** ở góc phải dưới (hoặc **Ctrl + K**), gõ câu hỏi rồi Enter. Gõ không dấu cũng được.
2. Ví dụ: *ai sắp hết hạn hợp đồng*, *ai đang thử việc*, *hôm nay ai nghỉ*, *lương của* + họ tên, *cách nâng bậc lương*,
   *tỷ lệ bảo hiểm sửa ở đâu*, *mở bảng lương*, gõ mã NV hoặc số hợp đồng.
3. Bấm các nút trong câu trả lời để mở đúng trang / hồ sơ.
4. Hỏi rộng hơn: chế độ lao động – tiền lương (*thử việc tối đa bao lâu*, *cưới vợ được nghỉ mấy ngày*, *nghỉ thai sản bao lâu*, *trợ cấp thôi việc*…),
   tính nhanh (*lương 10 triệu thực lĩnh bao nhiêu*, *thuế TNCN thu nhập 25 triệu 1 người phụ thuộc*, *làm thêm 4 giờ chủ nhật lương 8 triệu*,
   *nữ sinh tháng 5/1975 bao giờ nghỉ hưu*, *âm lịch hôm nay*, *còn bao nhiêu ngày đến Tết*), hỏi về trợ lý (*bạn là ai*, *bạn làm được gì*).
   Câu trả lời về luật có ghi nguồn (điều luật); số liệu (tỷ lệ BH, giảm trừ, biểu thuế…) lấy từ Cài đặt của công ty.

## Bộ não AI Claude (như trợ lý ảo trên web.capnuochaugiang.vn)
- Khi người quản trị bật **bộ não AI**, cạnh tên trợ lý có nhãn **AI**: câu hỏi cách làm, chế độ lao động – tiền lương, yêu cầu *viết, soạn, giải thích, tư vấn…*
  được **AI Claude** trả lời tự nhiên, chữ hiện dần như đang gõ (bấm vào câu trả lời để hiện hết ngay), kèm nút mở trang, hướng dẫn liên quan.
- Câu hỏi **về dữ liệu** (ai sắp hết hạn hợp đồng, lương của một người, ai nghỉ hôm nay…) vẫn trả lời **ngay trên máy**, không gửi cho AI.
- Gửi tới AI (qua máy chủ của công ty): câu hỏi – **tên nhân viên, số điện thoại, CCCD, số tài khoản trong câu hỏi được che** thành *[tên nhân viên]*, *[số]* –
  cùng hướng dẫn sử dụng, kiến thức chung, cài đặt của công ty. **Không gửi** hồ sơ, chấm công, lương của nhân viên. Khóa API chỉ lưu trên máy chủ.
- AI chưa bật, mất mạng hoặc lỗi: trợ lý tự trả lời bằng bộ trả lời có sẵn. Mỗi tài khoản hỏi AI tối đa 40 câu / 10 phút.
- Không muốn dùng AI trên máy mình: nút **Cài đặt trợ lý** (biểu tượng thanh trượt) → bỏ chọn *Dùng AI Claude…*. Chạy 1 file trên máy (không có máy chủ): không có bộ não AI.

### Người quản trị bật bộ não AI
1. Đăng nhập tài khoản **quản trị** → **Cài đặt & dữ liệu** → thẻ **Dữ liệu & tài khoản** → khung **Trợ lý ảo AI (Claude)**.
2. Chọn **Cách kết nối**:
   - **Trực tiếp Anthropic**: dán **khóa API** (tạo ở console.anthropic.com → API Keys).
   - **Qua máy chủ AI trung gian của công ty** (hawasuco-ai-proxy, dùng chung với trợ lý trên web): nhập địa chỉ `https://<máy chủ AI>:3000/v1/messages` và **mã truy cập** (PROXY_AUTH_TOKEN).
3. Chọn **Mô hình AI**: *Claude Opus 5.5* (thông minh nhất, mặc định), *Claude Sonnet 5.5* (nhanh, chi phí vừa) hoặc *Claude Haiku 5.5* (nhanh nhất, rẻ nhất).
4. Đánh dấu **Bật bộ não AI cho trợ lý ảo** → **Lưu & thử kết nối**: thấy ✅ *Kết nối được* là xong.
5. Máy chủ phải ra được Internet (HTTPS, cổng 443) tới `api.anthropic.com` hoặc tới máy chủ AI trung gian. Số token mỗi lần hỏi ghi ở **Nhật ký máy chủ**;
   phần hướng dẫn, kiến thức được lưu đệm phía AI nên các câu hỏi sau nhanh và rẻ hơn.

## Nói chuyện bằng giọng nói (Chrome, Edge)
1. Bấm **micro** 🎤 rồi nói câu hỏi tiếng Việt – lần đầu chọn *Cho phép* dùng micro.
2. Trợ lý trả lời và **đọc to**. Nút **loa** 🔊 bật đọc cả câu hỏi gõ tay; nút loa nhỏ trên câu trả lời để đọc lại.
3. Nút **cài đặt trợ lý**: bật / tắt AI trên máy này, chọn giọng đọc, tốc độ, **nói chuyện liên tục**, **Nghe thử**; tắt / bật chuyển động của robot.
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
