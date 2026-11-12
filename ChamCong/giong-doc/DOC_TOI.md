# Giọng đọc tiếng Việt tích hợp (eSpeak NG)

Trợ lý ảo đọc câu trả lời bằng bộ tổng hợp giọng nói **eSpeak NG 1.51** biên dịch sang WebAssembly, chỉ kèm dữ liệu
tiếng Việt (giọng miền Bắc `vi`, miền Nam `vi-vn-x-south`, miền Trung `vi-vn-x-central`, biến thể giọng nữ `f2`–`f4`).
Bộ đọc chạy ngay trong trình duyệt: không cần cài giọng tiếng Việt cho Windows, không cần Internet, văn bản không gửi ra ngoài.

| Tệp | Nội dung |
|---|---|
| `espeakng-vi.js` | mã nạp do Emscripten tạo (hàm `GiongDocVN`) |
| `espeakng-vi.wasm` | eSpeak NG + dữ liệu tiếng Việt (~1 MB; `build.js` nén gzip rồi nhúng vào `ChamCong_TinhLuong.html`) |
| `giongdoc_glue.c` | cầu nối nhỏ: khởi tạo, chọn giọng, đặt tốc độ, đọc văn bản -> mẫu PCM 16-bit 22050 Hz |
| `dung.sh` | lệnh dựng lại (Ubuntu 24.04: `apt-get install emscripten espeak-ng-data`, `apt-get source espeak-ng`) |
| `COPYING-espeak-ng.txt` | giấy phép GNU GPL phiên bản 3 của eSpeak NG |

Phần dùng bộ đọc trong phần mềm: `src/giongdoc.js` (phát âm thanh bằng Web Audio) và `src/trolyao.js` (chọn giọng, đọc câu trả lời).

**Giấy phép**: eSpeak NG là phần mềm tự do theo GNU GPL v3 (hoặc mới hơn). Dùng nội bộ trong đơn vị không bị ràng buộc gì thêm.
Nếu phân phối phần mềm cho tổ chức khác thì phải kèm giấy phép này và cung cấp mã nguồn tương ứng: mã nguồn eSpeak NG 1.51
(gói nguồn `espeak-ng_1.51+dfsg` của Ubuntu, hoặc https://github.com/espeak-ng/espeak-ng/releases/tag/1.51) cùng các tệp trong thư mục này.
