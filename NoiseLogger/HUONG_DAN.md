# Phần mềm Noise Logger — dò tìm rò rỉ

Phần mềm riêng (tách khỏi phần mềm Quản lý thất thoát nước) để quản lý thiết bị **noise logger** dò tìm rò rỉ:
danh mục logger, điểm đặt logger theo đội / vùng DMA, số đo tiếng ồn ban đêm, kết luận điểm nghi rò rỉ, theo dõi từng ca rò đến khi sửa xong,
xuất Excel / in báo cáo.

Noise logger gắn (nam châm) lên van, trụ cứu hoả, đồng hồ…, tự ghi tiếng ồn trên ống lúc 2h–4h sáng khi vắng người dùng nước.
Rò rỉ phát ra tiếng ồn **đều, liên tục cả đêm**: mức ồn tối thiểu cao, độ trải (spread) nhỏ, lặp lại nhiều đêm liền.

Mở phần mềm: chạy `NoiseLogger.exe` (không cần cài đặt; máy có sẵn .NET Framework 4.8 của Windows 10/11).
Lần đầu (hoặc sau khi sửa mã nguồn): nhấp đúp `build.bat` để tạo `NoiseLogger.exe` — xem mục "Biên dịch" cuối trang.

Thanh menu bên trái: **Điểm đo** (Ctrl+1), **Ca rò rỉ** (Ctrl+2), **Thiết bị** (Ctrl+3), **Đội / vùng DMA** (Ctrl+4), **Cài đặt** (Ctrl+5).

## Bắt đầu

1. **Đội / vùng DMA** → **Lấy từ phần mềm Thất thoát nước…**: chọn file `DuLieu\thatthoat.xml` của phần mềm Quản lý thất thoát nước
   (để 2 phần mềm cạnh nhau thì hộp chọn file tự mở đúng thư mục). Phần mềm lấy danh sách đội → khu vực → vùng DMA theo cấu trúc tháng mới nhất,
   tên công ty, địa danh, người ký. Thêm DMA mới ở phần mềm thất thoát thì lấy lại lần nữa: chỉ thêm / cập nhật, không xoá đơn vị đang có.
   Hoặc tự thêm: **+ Đội**, **+ Khu vực / DMA của đơn vị chọn**, **Sửa…** (đổi tên, loại, chuyển sang đơn vị khác), **▲ ▼**, **Xoá**.
2. **Thiết bị** → **+ Thêm logger**: mã / số seri **đúng như trong phần mềm của hãng** (phần mềm dựa vào mã này để biết số đo
   của logger nào), hãng / model.
3. **Điểm đo** → **+ Thêm điểm**: tên điểm (vd "Van D150 ngã ba Trần Hưng Đạo – 30/4"), gắn vào van / trụ cứu hoả / đồng hồ…,
   thuộc đội / khu vực / DMA nào, đường ống, toạ độ (chép từ Google Maps, không bắt buộc).
4. Chọn điểm → **Lắp / thu logger…**: chọn logger, ngày lắp. Cùng hộp thoại này để **thu logger về** (ghi ngày thu),
   **thay logger**, hoặc **chuyển logger** đang ở điểm khác sang đây ("lift & shift" — đo xong DMA này chuyển sang DMA khác):
   phần mềm tự ghi ngày thu ở điểm cũ bằng ngày lắp ở điểm mới.
5. **Cài đặt**: kiểm tra tên công ty, địa danh, người ký in trên báo cáo; **Sửa ngưỡng…** theo hãng logger đang dùng.

## Hằng ngày: số đo ban đêm

- **Nhập số đo từ file…**: file CSV / TXT / Excel (.xlsx) xuất từ phần mềm của hãng logger. Phần mềm tự tìm dòng tiêu đề và đoán cột
  (mã logger, tên điểm, ngày, giờ, mức ồn, độ trải, tần số; tiêu đề tiếng Việt hay tiếng Anh đều được) — chọn lại nếu đoán sai,
  khung dưới cho biết sẽ nhập bao nhiêu đêm, dòng nào bị bỏ qua và vì sao (mã logger chưa có trong danh mục, logger chưa ghi lắp…).
  - Số đo gán vào điểm có logger đó **đang lắp vào đêm đó**; file có cột tên điểm thì gán theo tên điểm.
  - **Ngày của đêm = ngày buổi sáng** (đêm 15 rạng sáng 16 → ngày 16). Giờ ghi từ 12h trưa trở đi tính cho đêm rạng sáng hôm sau.
  - File ghi **từng lần đo** (nhiều dòng / đêm): mức ồn lấy số nhỏ nhất của đêm, độ trải = chênh lệch giữa các lần ghi (P90 − P10).
  - Ngày kiểu dd/MM/yyyy, MM/dd/yyyy (tự nhận), yyyy-MM-dd, ô ngày của Excel; số có dấu phẩy hay dấu chấm thập phân đều được.
  - Phần mềm của hãng không xuất được file: **Lưu file mẫu…** (CSV mở bằng Excel, sẵn mã các logger đang lắp) → ghi số → nhập lại.
  - Trước khi nhập, phần mềm tự sao lưu dữ liệu (thư mục `SaoLuu`).
- Hoặc gõ thẳng **mức ồn / độ trải / tần số** của đêm đang xem vào ô nền vàng (Enter xuống điểm kế tiếp, Delete để xoá).
- Chọn đêm ở ô **Đêm** (◀ ▶ hoặc Alt+← / Alt+→; **Đêm mới nhất**). Nhấp đúp ô của 1 đêm trước để xem đêm đó.

## Đọc kết quả

Mỗi điểm có 6 cột mức ồn các đêm trước, **mức nền** (trung vị 30 ngày trước tuần gần nhất) và **kết luận**:

| Kết luận | Khi nào |
|---|---|
| **Nghi rò rỉ** (đỏ) | mức ồn ≥ ngưỡng rò (mặc định 30 dB) **và** độ trải ≤ ngưỡng (10) trong **2 đêm liền** trở lên |
| **Cần theo dõi** (vàng) | mới vượt ngưỡng rò 1 đêm; hoặc mức ồn cao nhưng độ trải lớn (tiếng ồn lúc có lúc không — dùng nước, máy bơm); hoặc mức ồn ≥ ngưỡng theo dõi (20 dB); hoặc **tăng ≥ 6 dB so với mức nền** (có thể vừa xuất hiện rò mới) |
| Bình thường (xanh) | còn lại |
| Chưa có số đo | chưa có số, hoặc số mới nhất đã cũ hơn 3 ngày (logger đã thu / chuyển đi, hết pin…) |

- **Ngưỡng…**: mỗi hãng logger dùng thang số khác nhau — chỉnh ngưỡng theo hướng dẫn của hãng và kinh nghiệm các điểm đã dò thấy rò.
- Thẻ phía trên: số điểm có số đo, số điểm nghi rò rỉ (bao nhiêu điểm chưa có ca xử lý), cần theo dõi, ca rò rỉ đã sửa trong năm.
- **Biểu đồ** phía dưới: mức ồn 60 đêm của điểm đang chọn, đường ngưỡng, độ trải, ngày phát hiện / sửa rò, thời gian lắp logger.

## Ca rò rỉ

Điểm nghi rò rỉ: **+ Ca rò rỉ…** để giao tổ dò tìm (nghe đất, máy tương quan) → cập nhật trạng thái **Chờ dò tìm** →
**Đã xác định, chờ sửa** (ghi vị trí rò, hạng mục: ống chính / ống nhánh / đồng hồ…) → **Đã sửa** (ngày sửa) hoặc **Không thấy rò**.
Nhập **lưu lượng rò ước tính (m³/h)** → phần mềm tính **nước tiết kiệm ≈ lưu lượng × 24 × 30 m³/tháng**.
Mục **Ca rò rỉ** liệt kê các ca theo năm (ca năm trước chưa xong vẫn hiện), số ngày xử lý, **mức ồn trước → sau sửa**
(sửa đúng chỗ thì tiếng ồn giảm hẳn; giảm ít thì có thể còn điểm rò khác gần đó).

## Xuất Excel / in

Nút **Xuất Excel ▾** / **In ▾** (theo đội / DMA đang lọc):

| Mẫu | Nội dung |
|---|---|
| Kết quả nghe tiếng ồn 1 đêm | từng điểm theo đội / DMA: logger, mức ồn, độ trải, tần số, 6 đêm trước, mức nền, kết luận, ca rò rỉ; tô đỏ / vàng; người ký |
| Bảng mức ồn 31 đêm | mỗi điểm 1 dòng, mỗi đêm 1 cột (tối đa 62 đêm), cột cao nhất, kết luận đêm cuối |
| Danh sách ca rò rỉ năm | ngày phát hiện, vị trí, hạng mục, trạng thái, ngày sửa, số ngày xử lý, lưu lượng, nước tiết kiệm (có công thức), mức ồn trước / sau sửa |

## Lưu ý

- Điểm đã có số đo không xoá hẳn được: **Xoá** = ngừng dùng (số đo cũ vẫn giữ; xem lại bằng ô "Cả điểm đã ngừng").
  Logger đã từng lắp không xoá được: **Sửa…** → đánh dấu "Hỏng / thanh lý".
- Mục **Thiết bị** nhắc (chữ cam) logger đang lắp mà quá 3 ngày chưa có số đo mới — kiểm tra pin / tải số liệu.
- Xoá 1 đội / DMA: các điểm của nó chuyển sang đơn vị cha (hoặc "Chưa xếp đội / DMA"); đơn vị còn đơn vị con thì không xoá được.

## Đã nhập số liệu Noise Logger ở phần mềm Quản lý thất thoát nước bản 1.1.0?

Bản 1.1.0 có trang Noise Logger nằm trong phần mềm thất thoát; nay trang đó đã bỏ (phần mềm thất thoát trở lại như trước).
Số liệu đã nhập ở đó vẫn nằm trong `DuLieu\thatthoat.xml`: mở phần mềm này → **Cài đặt** (hoặc Đội / vùng DMA) →
**Lấy từ phần mềm Quản lý thất thoát nước…** → chọn file đó **trước khi** mở lại phần mềm thất thoát bản cũ
(phần mềm thất thoát bản cũ lưu lại file sẽ bỏ phần Noise Logger; khi đó chọn bản sao lưu trong `DuLieu\SaoLuu`).
Logger, điểm, lần lắp, số đo, ca rò rỉ, ngưỡng được chép sang, điểm gắn đúng đội / DMA. Chỉ lấy khi phần mềm này chưa có số liệu (tránh trùng).

## Dữ liệu và sao lưu

- Toàn bộ số liệu nằm trong `DuLieu\noiselogger.xml` cạnh file `NoiseLogger.exe` (riêng, không dùng chung file với phần mềm thất thoát).
  Chép cả thư mục `NoiseLogger` sang máy khác là mang theo đủ dữ liệu.
- Mỗi lần sửa đều tự lưu. Bản trước đó giữ ở `noiselogger.xml.bak`; mỗi ngày giữ 1 bản trong `DuLieu\SaoLuu` (90 ngày gần nhất).
  Nút "Sao lưu ngay" ở trang Cài đặt tạo thêm 1 bản bất kỳ lúc nào; trước khi nhập file số đo phần mềm cũng tự sao lưu.

## Biên dịch (tạo NoiseLogger.exe)

Chạy `build.bat`. Dùng trình biên dịch C# có sẵn trong Windows (.NET Framework 4), không cần Visual Studio.
Mã nguồn nằm trong thư mục `src` (`src\Chung`: giao diện, đọc / ghi Excel, in — chép từ phần mềm thất thoát nước, dùng riêng ở đây).
