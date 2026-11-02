# Phần mềm Chấm công & Tính lương

Mở file **`ChamCong_TinhLuong.html`** bằng trình duyệt (Chrome, Edge, Cốc Cốc, Firefox) là dùng được ngay:
không cần cài đặt, không cần Internet, không cần máy chủ. Có thể chép file này sang máy khác, USB, hoặc đặt lên IIS
như các phần mềm khác trong thư mục này.

Lần mở đầu tiên phần mềm nạp **dữ liệu mẫu** (17 nhân viên, 13 tháng chấm công) để xem thử mọi chức năng.
Khi dùng thật: trang **Tổng quan** → bấm **Xoá dữ liệu mẫu, bắt đầu nhập thật** (giữ lại cài đặt, ký hiệu, phụ cấp, ngày lễ).

> Dữ liệu lưu trong trình duyệt của máy đang dùng. Vào **Cài đặt & dữ liệu → Sao lưu dữ liệu** mỗi tuần để có file `.json`
> dự phòng; muốn chuyển sang máy khác thì sao lưu ở máy cũ rồi **Khôi phục từ file** ở máy mới.

## Thiết lập ban đầu (làm 1 lần)

1. **Cài đặt & dữ liệu → Đơn vị & chữ ký**: tên đơn vị, địa danh (vd *Cần Thơ*), mẫu biểu theo TT 133 hay TT 200,
   tiêu đề bảng lương (vd *BẢNG THANH TOÁN TIỀN LƯƠNG VĂN PHÒNG CÔNG TY*), người ký.
2. **Kỳ công & giờ làm**: chọn **kỳ công bắt đầu từ ngày** – vd *ngày 21* thì bảng chấm công tháng 10 tính từ 21/9 đến 20/10.
   Chọn ngày nghỉ hằng tuần chung, giờ vào – ra (dùng khi đọc máy chấm công).
3. **Danh mục**: phòng ban / bộ phận (thứ tự in trên bảng), phụ cấp, ký hiệu chấm công, ngày lễ (bấm *Tạo tự động* cho từng năm).
4. **Nhân viên**: thêm từng người hoặc **Nhập từ Excel** (bấm *Tải file mẫu* để có đúng các cột). Mỗi người cần:
   - **Lịch làm việc**: *Thứ 2 – Thứ 6* (công chuẩn thường 22) hoặc *Thứ 2 – Thứ 7* (thường 26). Cần cố định số công thì nhập *Công chuẩn riêng*.
   - **Mức lương/HĐ**, phụ cấp (vd cơm trưa 50.000 đ/ngày), có tham gia BH không, đoàn viên công đoàn, số người phụ thuộc.
   - **Mã chấm công** = số ID của người đó trên máy chấm công vân tay (nếu dùng).

## Hằng ngày / hằng tháng

### 1. Bảng chấm công
- Chọn kỳ ở góc trên bên phải. Bấm **Chấm đủ công…** để điền `+` cho mọi ngày làm việc (theo lịch của từng người), rồi chỉ sửa ngày khác.
- Chọn ô (kéo chuột để chọn nhiều ô, nhiều người) → bấm ký hiệu trên thanh màu. Hoặc gõ thẳng: `+` (hoặc `x`), `sp`, `p`, `o` (= Ô), `kl`… rồi Enter.
- Phím: mũi tên di chuyển, Shift + mũi tên chọn vùng, Delete xoá, Ctrl+Z hoàn tác, Ctrl+C / Ctrl+V chép – dán (dán được cả vùng ký hiệu từ Excel).
- Chế độ **Làm thêm (giờ)** và **Đi muộn / về sớm (phút)** dùng chung lưới.
- **Xuất Excel (mẫu 01a)**: mỗi bộ phận 1 trang tính theo mẫu 01a-LĐTL, có phần *Quy ra công*:
  32 công lương sản phẩm · 33 công lương thời gian (*Lương*) và ngày làm thực tế (*Cơm*) · 34 nghỉ hưởng 100% lương ·
  35 nghỉ không hưởng lương · 36 hưởng BHXH, kèm ký hiệu chấm công và chữ ký *Người chấm công – Phụ trách bộ phận – Người duyệt*.

Ký hiệu mặc định (sửa được ở Danh mục):

| Ký hiệu | Ý nghĩa | Tính lương |
|---|---|---|
| `+` | Lương thời gian (đi làm cả ngày) | 1 công lương thời gian, 1 ngày cơm |
| `+/2` | Đi làm nửa ngày | 0,5 công |
| `SP` | Lương sản phẩm | không tính lương thời gian, vẫn tính ngày cơm; tiền = sản lượng × đơn giá |
| `CT`, `H` | Công tác; hội nghị, học tập | như đi làm |
| `P`, `P/2` | Nghỉ phép (trừ phép năm) | hưởng lương thời gian |
| `L`, `NB`, `R` | Lễ Tết; nghỉ bù; việc riêng có lương | hưởng lương thời gian |
| `N` | Ngừng việc hưởng lương | cột 34, % lương đặt trong Cài đặt |
| `Ô`, `Cô`, `TS`, `T` | Ốm; con ốm; thai sản; tai nạn | BHXH trả (cột 36) |
| `KL`, `KP` | Nghỉ không lương; không phép | không hưởng lương (cột 35) |

### 2. Giờ vào / ra (máy chấm công vân tay, thẻ, khuôn mặt)
Xuất dữ liệu từ phần mềm máy chấm công ra `.xlsx` / `.csv` / `.txt` → chọn file → kiểm tra cột *Mã chấm công*, *Ngày*, *Giờ*
→ **Đọc dữ liệu**. Phần mềm lấy lần chấm đầu tiên làm giờ vào, lần cuối làm giờ ra, tính giờ làm, đi muộn, về sớm, làm thêm.
Sửa giờ trực tiếp nếu ai quên chấm, rồi **Áp dụng vào bảng chấm công**.

### 3. Bảng lương
Cột theo mẫu *Bảng thanh toán tiền lương*: Mức lương/HĐ · Lương sản phẩm (số HĐ, số tiền) · Lương thời gian (số công, số tiền) ·
Phụ cấp cơm trưa (số công, số tiền) · phụ cấp khác · Thưởng · Tổng thu nhập · Tạm ứng kỳ I ·
BHXH 8% · BHYT 1,5% · BHTN 1% · Công đoàn 0,5% · Thuế TNCN · Khấu trừ khác · Cộng · **Lãnh kỳ II** · Ký nhận.

- Ô nền vàng nhập trực tiếp: **sản lượng (số HĐ)**, thưởng, khoản cộng khác, **tạm ứng kỳ I**, khấu trừ khác, ghi chú.
- Bấm tên nhân viên để xem **chi tiết cách tính** từng con số.
- **Xuất Excel** (kèm trang *Bảo hiểm*), **File chuyển khoản** cho ngân hàng, **In**.
- **Chốt lương tháng**: khoá chấm công và bảng lương của kỳ, lưu cố định số liệu (không đổi khi sau này sửa mức lương,
  tỷ lệ BH, biểu thuế). Mở khoá được khi cần sửa.

Cách tính chính:
- Lương thời gian = Mức lương × tỷ lệ hưởng ÷ công chuẩn × số công lương thời gian
  (vd 8.000.000 ÷ 22 × 19 = 6.909.091).
- Lương sản phẩm = sản lượng × đơn giá (vd 2.490 HĐ × 1.200 đ = 2.988.000).
- Cơm trưa = đơn giá × ngày làm thực tế (gồm cả ngày SP).
- BH trên lương đóng BH (mặc định = mức lương + phụ cấp có đánh dấu đóng BH), có trần 20 × lương cơ sở (BHXH, BHYT)
  và 20 × lương tối thiểu vùng (BHTN). Nghỉ không lương từ 14 ngày trở lên trong kỳ thì không đóng BH.
- Thuế TNCN biểu lũy tiến 5 bậc, giảm trừ bản thân 15,5 triệu, người phụ thuộc 6,2 triệu; phần lương làm thêm vượt
  lương thường và phụ cấp không chịu thuế được loại trừ. Hợp đồng dưới 3 tháng: khấu trừ 10%.
- **Lãnh kỳ II** = Tổng thu nhập − Tạm ứng kỳ I − Cộng các khoản khấu trừ.

### 4. Phiếu lương, báo cáo
- **Phiếu lương**: in 2 phiếu / trang A4 (hoặc *Lưu thành PDF* để gửi Zalo), xuất Excel.
- **Báo cáo**: tổng hợp theo phòng ban, bảo hiểm & công đoàn, thuế TNCN cả năm (theo từng tháng, để quyết toán),
  quỹ lương 12 tháng, theo dõi phép năm, đi muộn – nghỉ – làm thêm. Báo cáo nào cũng xuất Excel / in được.

## Tham số pháp lý mặc định (sửa ở Cài đặt khi Nhà nước thay đổi)

| Tham số | Mặc định |
|---|---|
| BH người lao động | BHXH 8%, BHYT 1,5%, BHTN 1% |
| BH doanh nghiệp | BHXH 17,5%, BHYT 3%, BHTN 1%, KPCĐ 2% |
| Đoàn phí công đoàn | 0,5% lương đóng BH (tối đa 10% lương cơ sở) |
| Lương cơ sở | 2.530.000 đ (từ 01/7/2026) |
| Lương tối thiểu vùng 2026 | I 5.310.000 · II 4.730.000 · III 4.140.000 · IV 3.700.000 |
| Giảm trừ gia cảnh | bản thân 15.500.000 · người phụ thuộc 6.200.000 |
| Biểu thuế (thu nhập tính thuế / tháng) | ≤10 tr 5% · 10–30 tr 10% · 30–60 tr 20% · 60–100 tr 30% · >100 tr 35% |
| Làm thêm giờ | ngày thường 150% · nghỉ tuần 200% · lễ 300% |

Hãy đối chiếu lại với văn bản hiện hành của cơ quan thuế, BHXH trước khi dùng số liệu để nộp.

## Dành cho người sửa phần mềm

- Mã nguồn trong `src/` (mở thẳng `src/index.html` cũng chạy được). Sửa xong chạy `node build.js` để đóng gói lại
  thành `ChamCong_TinhLuong.html` (1 file duy nhất, không dùng thư viện ngoài).
- `src/tinhluong.js`: toàn bộ cách tính (kỳ công, công chuẩn, lương, BH, thuế). `src/amlich.js`: lịch âm để tạo ngày lễ.
  `src/xlsx.js`: đọc / ghi Excel. Các trang giao diện: `src/p-*.js`.
- Kiểm thử cách tính: `node test/tinhluong.test.js` (có ca đối chiếu đúng 1 dòng bảng lương mẫu tháng 10/2026).
