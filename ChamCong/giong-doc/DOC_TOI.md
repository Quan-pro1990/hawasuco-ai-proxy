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

## Giọng đọc AI tiếng Việt (mặc định)

| Tệp | Nội dung |
|---|---|
| `ai/vi_VN-vais1000-medium.onnx.json` | cấu hình mô hình Piper (bảng âm vị, tần số mẫu 22 050 Hz) – nhúng vào HTML khi đóng gói |
| `ai/NGUON.json` | địa chỉ tải + mã SHA-256 của `vi_VN-vais1000-medium.onnx` (63 MB) và `ort-wasm-simd.wasm` (10,5 MB) |
| `ort/ort.wasm-core.min.js` | ONNX Runtime Web 1.17.3 (MIT) – chạy mô hình trong luồng nền (Web Worker) |

Hai tệp lớn không lưu trong git: bộ cài máy chủ tự tải và kiểm tra SHA-256 (hoặc chép sẵn vào `giong-doc/ai`), máy chủ phục vụ
tại `giong-doc/ai/…`; trình duyệt tải 1 lần rồi lưu trong IndexedDB. Chữ được eSpeak NG phiên âm IPA (giọng `vi`, đúng cách Piper
phiên âm khi huấn luyện) rồi đưa vào mô hình; mỗi câu tổng hợp riêng, câu đầu ngắn để bắt đầu đọc sớm.

**Giấy phép**: mô hình Piper `vi_VN-vais1000-medium` (https://huggingface.co/rhasspy/piper-voices, MIT), huấn luyện trên bộ dữ liệu
VAIS-1000 (CC BY 4.0 – ghi nguồn: VAIS-1000 Vietnamese speech synthesis corpus); ONNX Runtime Web (MIT, Microsoft).
