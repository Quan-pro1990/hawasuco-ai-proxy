# Chỉnh ảnh AI — chỉnh ảnh chuyên nghiệp chỉ với 1 cú nhấp

Mở ảnh là phần mềm tự phân tích rồi chỉnh ngay: phơi sáng, cân bằng trắng, cứu vùng cháy sáng, mở vùng tối,
khử sương mù, giảm nhiễu, làm nét, làm mịn da chân dung. Bấm **Lưu ảnh** là xong. Ảnh gốc không bao giờ bị ghi đè.

Chạy trên Windows 10 / 11 (dùng .NET Framework 4.8 có sẵn trong Windows), không cần mạng, không cần cài thêm gì.
Muốn AI "nhìn" ảnh để hiểu cảnh (hoàng hôn, món ăn, chân dung…) thì bật thêm **AI Claude** (cần API key, xem bên dưới).

## Cài đặt

Tệp cài sẵn trong thư mục `PhatHanh\`, kèm **`HUONG_DAN.pdf`** — hướng dẫn đầy đủ có ảnh chụp màn hình
(cài đặt, phong cách, tinh chỉnh từng thanh, AI Claude, chỉnh hàng loạt, mẹo theo loại ảnh, hỏi đáp).

- **Cách 1 (khuyên dùng):** chạy `PhatHanh\ChinhAnhAI-1.0.0-CaiDat.exe` → Tiến → Tiến → Cài đặt → Hoàn thành.
  Cài cho tài khoản Windows hiện tại vào `%LOCALAPPDATA%\Programs\ChinhAnhAI`, không cần quyền Administrator. Có lối tắt trên
  màn hình và menu Start, mục **Chỉnh bằng Chỉnh ảnh AI** khi chuột phải một ảnh (Windows 11: *Hiện thêm tùy chọn*),
  **Gửi tới → Chỉnh ảnh AI** cho nhiều ảnh, và gỡ được trong Settings → Apps.
- **Cách 2 — bản di động:** giải nén `PhatHanh\ChinhAnhAI-1.0.0-DiDong.zip`, nhấp đúp `ChinhAnhAI.exe`.
- **Cách 3 — từ mã nguồn:** nhấp đúp `CaiDat.bat` (biên dịch lại bằng `csc.exe` có sẵn của Windows rồi cài, tạo lối tắt);
  gỡ bằng `GoCaiDat.bat`.

Windows SmartScreen có thể hỏi lần đầu vì phần mềm không có chữ ký số: bấm **More info → Run anyway**.
Mã SHA-256 của các tệp phát hành nằm trong `PhatHanh\SHA256SUMS.txt`.

## Dùng hằng ngày (1 chạm)

1. Mở ảnh: bấm **Mở ảnh** (Ctrl+O), kéo thả ảnh vào cửa sổ, hoặc chuột phải ảnh trong thư mục → **Gửi tới → Chỉnh ảnh AI**.
2. Phần mềm tự chỉnh ngay (vạch tím–cam chạy trên cùng là đang xử lý).
3. Bấm **Lưu ảnh** (Ctrl+S): ảnh lưu cạnh ảnh gốc với tên thêm `_AI` (vd `IMG_1234_AI.jpg`), giữ nguyên thông tin EXIF
   (máy ảnh, ngày chụp, GPS). Bấm **Mở thư mục** ở góc dưới để xem. **Lưu thành…** (Ctrl+Shift+S) để chọn tên / nơi lưu khác.

So sánh với ảnh gốc:

- **Nhấn giữ chuột trên ảnh** (hoặc giữ phím cách) để xem ảnh gốc, thả ra để xem ảnh đã chỉnh.
- **So sánh trước / sau** (phím C): vạch chia giữa ảnh, kéo sang trái / phải.
- Nút **‹ ›** (phím mũi tên trái / phải): mở ảnh trước / sau trong cùng thư mục — chỉnh lần lượt cả thư mục rất nhanh.

## Phong cách

Các ô bên phải hiện sẵn ảnh của bạn theo từng kiểu, bấm để chọn:

| Phong cách | Dùng khi |
|---|---|
| **Tự động** (mặc định) | Phần mềm tự chọn theo cảnh: có khuôn mặt → Chân dung, trời / cây cỏ → Phong cảnh |
| Tự nhiên | Chỉ sửa lỗi kỹ thuật (sáng, màu), không thêm "gu" |
| Sống động | Màu tươi, rõ nét — ảnh du lịch, mạng xã hội |
| Chân dung | Da mịn tự nhiên, tông ấm, nền dịu, viền tối nhẹ |
| Phong cảnh | Trời xanh trong, cây tươi, khử sương mù |
| Sáng trong | Sáng, nhẹ, trong trẻo kiểu ảnh Hàn |
| Ấm áp | Nắng vàng, hoài niệm |
| Điện ảnh | Vùng tối xanh ngọc, vùng sáng cam, tương phản kiểu phim |
| Đen trắng | Đen trắng tương phản, cổ điển |

**Cường độ chỉnh** (0–150%): kéo xuống nếu thấy chỉnh hơi "quá", kéo lên để đậm hơn. Phong cách và cường độ vừa chọn
được nhớ cho lần sau.

**Tinh chỉnh +** mở 21 thanh như Lightroom (phơi sáng, tương phản, vùng sáng / tối, điểm trắng / đen, nhiệt độ màu,
sống động, rõ nét, khử sương mù, làm nét, giảm nhiễu, làm mịn da, viền tối, làm phai, tô màu vùng tối / sáng, đen trắng).
Các thanh hiện sẵn giá trị phần mềm đã chọn; nhấp đúp một thanh để trả về giá trị tự động; giữ Shift khi kéo để chỉnh mịn.

## AI Claude (không bắt buộc)

Không có AI, phần mềm vẫn tự chỉnh bằng phân tích ảnh trên máy: đo biểu đồ sáng, tìm điểm trung tính để cân màu, đo nhiễu,
nhận diện khuôn mặt (đo sáng theo mặt như thợ ảnh), nhận diện trời / cây cỏ / sương mù / ngược sáng / cảnh đêm.

Bật AI Claude thì AI xem ảnh (bản thu nhỏ 1280 điểm) và các số đo đó, rồi chọn thông số như một thợ hậu kỳ — phân biệt
được hoàng hôn với ám màu, cảnh đêm có chủ ý với ảnh thiếu sáng, món ăn, sản phẩm… Việc chỉnh điểm ảnh vẫn chạy trên máy,
ảnh gốc cỡ thật không gửi đi.

1. Tạo API key tại <https://console.anthropic.com/settings/keys> (cần nạp tiền vào tài khoản Anthropic).
2. **Cài đặt → AI Claude**: dán key, bấm **Kiểm tra key** (không tốn phí), tick **Dùng AI Claude…**, **Lưu cài đặt**.
   Key được mã hoá bằng tài khoản Windows của bạn (`%APPDATA%\ChinhAnhAI\caidat.xml`). Có thể dùng biến môi trường
   `ANTHROPIC_API_KEY` thay cho việc dán key.
3. Từ đó **Chỉnh tự động** và mở ảnh sẽ nhờ AI (thường 10–30 giây; trong lúc chờ đã thấy bản chỉnh trên máy).
   Hoặc bấm **Nhờ AI chỉnh ảnh này** / ô **AI Claude** bất cứ lúc nào.
4. Ô **Yêu cầu thêm cho AI** nhận mong muốn bằng lời, vd: *"tông ấm kiểu phim, da sáng hồng"*, *"giữ không khí u buồn"*.

Model mặc định `claude-opus-5-5` (chọn đẹp nhất). Đổi sang `claude-sonnet-5-5` (nhanh, rẻ hơn) hoặc `claude-haiku-5-5`
(rẻ nhất) trong Cài đặt. Chi phí ước chừng 0,03–0,07 USD mỗi ảnh với Opus (tuỳ ảnh; xem giá chính xác ở trang Anthropic).
Nếu AI lỗi (mất mạng, hết hạn mức…), phần mềm giữ nguyên bản chỉnh trên máy và báo lỗi ở khung AI.

## Chỉnh hàng loạt

**Chỉnh hàng loạt…** (Ctrl+B), hoặc chọn nhiều ảnh cùng lúc → **Gửi tới → Chỉnh ảnh AI**:

1. Thêm ảnh / thư mục (lấy cả thư mục con) hoặc kéo thả vào danh sách.
2. Chọn phong cách, cường độ, có nhờ AI từng ảnh hay không.
3. **Bắt đầu chỉnh**. Mỗi ảnh được phân tích và chỉnh riêng (không áp một bộ thông số cho tất cả). Để trống "Lưu vào"
   thì ảnh lưu vào thư mục con `Da chinh AI` cạnh từng ảnh.

## Cài đặt khác

- **Thư mục lưu**, **thêm vào tên tệp** (mặc định `_AI`), **chất lượng JPEG** (mặc định 95), **cỡ ảnh lưu**
  (giữ cỡ gốc, hoặc thu về cạnh dài 4096 / 3000 / 2048 / 1600 / 1080 điểm cho mạng xã hội).
- **Tự động chỉnh ngay khi mở ảnh**: tắt nếu muốn mở ảnh ra ở dạng gốc, chỉ chỉnh khi bấm **Chỉnh tự động** (phím A).
- Nút tạo lối tắt **Gửi tới** / **màn hình** nếu chạy bản không cài.

Dòng lệnh (cho script): `ChinhAnhAI.exe --tu-dong thu_muc_ra anh1.jpg anh2.jpg …` — chỉnh tự động theo phong cách và
cài đặt đã lưu, không mở cửa sổ.

## Định dạng hỗ trợ

Mở: JPG, PNG, BMP, TIFF, GIF. Ảnh tự xoay theo thẻ hướng chụp của điện thoại; ảnh có hồ sơ màu nhúng
(Adobe RGB, Display P3) được Windows chuyển màu khi đọc. Lưu: JPEG (mặc định), PNG / TIFF nếu ảnh gốc là PNG / TIFF.

Chưa hỗ trợ ảnh RAW (.CR2, .NEF, .ARW…) và HEIC của iPhone: chuyển sang JPEG trước (trên iPhone: Cài đặt → Camera →
Định dạng → *Tương thích nhất*).

## Phần mềm chỉnh như thế nào

Thứ tự giống quy trình hậu kỳ chuyên nghiệp, tính trên ánh sáng tuyến tính như khi chỉnh file RAW:
cân bằng trắng → phơi sáng → khử sương mù (kênh tối) → giảm nhiễu → vùng tối / vùng sáng / rõ nét (lọc dẫn hướng giữ cạnh,
không có quầng sáng) → đường cong tông (vùng sáng cuộn mềm thay vì cháy trắng) → màu (sống động bảo vệ màu da) →
làm mịn da (chỉ quanh khuôn mặt tìm được) → làm nét (có ngưỡng để không làm nổi nhiễu) → viền tối.
Chỉnh không phá huỷ: mọi thanh tính lại từ ảnh gốc. Ảnh 24 megapixel xuất mất vài giây.

## Biên dịch lại

Sửa mã trong `src\` rồi nhấp đúp `build.bat` → tạo lại `ChinhAnhAI.exe` bằng `csc.exe` có sẵn của Windows
(không cần Visual Studio). Mã viết theo C# 5 để trình biên dịch đó dịch được.

| Tệp | Nội dung |
|---|---|
| `src\XuLyAnh.cs` | Bộ máy dựng ảnh (toàn bộ các bước chỉnh) |
| `src\PhanTich.cs` | Phân tích ảnh, tính thông số tự động, các phong cách |
| `src\NhanDienMat.cs` | Nhận diện khuôn mặt (Viola-Jones, bộ phân loại của OpenCV) |
| `src\AiClaude.cs` | Gọi Claude (Anthropic Messages API) xin thông số chỉnh |
| `src\BoLoc.cs` | Bộ lọc: trung bình, lọc dẫn hướng, Gauss, chuyển đổi sRGB |
| `src\AnhNguon.cs` | Đọc / ghi ảnh, xoay theo EXIF, chép EXIF |
| `src\MainForm.cs`, `KhungAnh.cs`, `Ui.cs` | Cửa sổ chính, khung xem ảnh, thanh trượt |
| `src\HangLoatForm.cs`, `CaiDatForm.cs`, `CaiDat.cs` | Chỉnh hàng loạt, cài đặt |

Tệp `src\haarcascade_frontalface_default.xml` (bộ phân loại khuôn mặt) thuộc OpenCV, dùng theo giấy phép Intel
— xem `GIAY_PHEP_BEN_THU_BA.txt`.

## Đóng gói bản phát hành

`DongGoi\dong_goi.sh` tạo lại toàn bộ `PhatHanh\` (bộ cài, bản di động, PDF, SHA256SUMS). Cần `ChinhAnhAI.exe` đã biên dịch
(`build.bat`), NSIS 3 (`makensis`), `zip`, `sha256sum` — chạy được trên Linux hoặc WSL; có Node + Playwright thì PDF được in lại
từ `DongGoi\HuongDan\huong_dan.html` (không có thì mở tệp HTML đó bằng Chrome / Edge → Ctrl+P → Lưu dưới dạng PDF).
Đổi phiên bản: sửa `UngDung.PhienBan` trong `src\ThongSo.cs` (số phiên bản trong `.exe` và bộ cài lấy theo đó).

| Tệp | Nội dung |
|---|---|
| `DongGoi\ChinhAnhAI.nsi` | Kịch bản bộ cài NSIS (cài theo người dùng, lối tắt, menu chuột phải, gỡ cài đặt) |
| `DongGoi\HuongDan\` | Hướng dẫn HTML và ảnh minh hoạ, nguồn của `HUONG_DAN.pdf` |
| `DongGoi\tao_pdf.js` | In hướng dẫn ra PDF khổ A4 có số trang |
| `DongGoi\DOC_TRUOC.txt` | Ghi chú ngắn đặt trong bản di động |

