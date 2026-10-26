# Thiết kế phần mềm Quản lý tài sản — quét mã QR xem thông tin, hình ảnh tài sản

Công ty TNHH MTV Cấp nước Hậu Giang (HAWASUCO). Phiên bản 1.0 — 10/2026.

## 1. Mục tiêu

- Mỗi tài sản (máy bơm, tủ điện, thuỷ lượng kế, van, trụ cứu hoả, giếng, bể chứa, xe, thiết bị văn phòng…) có **1 tem QR** dán trên thân.
- Nhân viên dùng **điện thoại quét tem** → thấy ngay **thông tin, ảnh, thông số kỹ thuật, lịch sử kiểm tra / sửa chữa** của tài sản,
  ghi kết quả kiểm tra, báo hỏng, chụp ảnh tại chỗ (kèm toạ độ GPS).
- Cán bộ quản lý tài sản theo dõi trên máy tính: danh sách, tình trạng, giá trị (nguyên giá, khấu hao tạm tính), hạn bảo dưỡng,
  **kiểm kê mỗi năm 1 lần bằng quét QR** (quét tem là ghi nhận đã kiểm kê) thay cho đối chiếu giấy, xuất biên bản Excel.
- Dùng chung hạ tầng đang có: **máy chủ IIS cổng 8080** của phần mềm Quản lý thất thoát nước, không cần mua thêm phần mềm / CSDL.

## 2. Kiến trúc

```
 Điện thoại (Chrome / Safari)  ──┐                 ┌───────────────────── Máy chủ Windows (IIS) ──────────────────────┐
   • trang Quét QR (camera)      │                 │                                                                   │
   • ứng dụng Camera quét tem ───┼── HTTPS 8080 ──>│ IIS + ASP.NET Core Module ──> QuanLyTaiSan.exe (127.0.0.1:cổng)   │
 Máy tính (trình duyệt)        ──┘   /taisan/...   │      (cùng cổng với site       • trang web nhúng trong .exe       │
   • quản lý, in tem, Excel                        │       Thất thoát nước)         • API JSON /api/...                │
                                                   │                                • dữ liệu C:\QuanLyTaiSanData       │
                                                   └───────────────────────────────────────────────────────────────────┘
```

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Máy chủ | 1 file `QuanLyTaiSan.exe` (C#, .NET Framework 4.x), IIS chạy qua ASP.NET Core Module (out-of-process) | Giống hệt cách triển khai `ThatThoatNuoc.exe` đang chạy; biên dịch bằng `csc.exe` có sẵn trong Windows, không cần Visual Studio |
| Giao diện | Trang web 1 trang (HTML/CSS/JS thuần) nhúng trong .exe, dùng chung cho máy tính và điện thoại; cài được lên màn hình chính (PWA) | Không phải cài app; 1 giao diện cho mọi thiết bị; cập nhật chỉ cần thay file .exe |
| Đọc QR | `BarcodeDetector` của trình duyệt (Chrome Android), dự phòng `jsQR.js` (Apache-2.0, đi kèm) cho iPhone / trình duyệt khác; thêm nút "Chụp ảnh mã QR" và ô gõ mã | Camera trong trang web cần **https** — vì vậy chạy sau IIS |
| Tạo QR | `maqr.js` viết riêng (chuẩn ISO/IEC 18004, phiên bản 1–40, mức sửa lỗi L/M/Q/H), vẽ SVG sắc nét khi in | Không phụ thuộc thư viện; đã kiểm bằng 2 bộ đọc độc lập (zxing, jsQR) ở mọi phiên bản |
| Lưu trữ | XML + tệp ghi thêm (không cần SQL Server) | Đủ cho vài chục nghìn tài sản; sao lưu = chép thư mục; cùng cách với phần mềm thất thoát nước |
| Excel | Tự đọc / ghi .xlsx (mã đã dùng trong phần mềm thất thoát nước) | Không cần cài Excel trên máy chủ |

Chạy thử không cần IIS: nhấp đúp `QuanLyTaiSan.exe` → mở `http://localhost:18090` (dữ liệu ở thư mục `DuLieu` cạnh file .exe).

## 3. Mã tài sản và tem QR

**Mã tài sản**: `<tiền tố loại>-<5 chữ số>`, vd `MB-00012` (máy bơm), `DH-00003` (thuỷ lượng kế), `VA-00150` (van).
Phần mềm tự cấp mã kế tiếp theo loại; có thể ghi mã sẵn có (vd số hiệu trong sổ kế toán). Chỉ dùng chữ không dấu, số, `-` `.` `_`.

**Nội dung QR** = địa chỉ web: `https://<máy chủ>:8080/taisan/t/MB-00012`

- Quét bằng **ứng dụng Camera bất kỳ** → trình duyệt mở thẳng trang tài sản (đăng nhập nếu chưa).
- Quét trong trang **Quét QR** của phần mềm → phần mềm lấy phần mã sau `/t/` → kể cả khi đổi tên miền / địa chỉ máy chủ,
  tem cũ vẫn dùng được, không phải in lại.
- Mã đứng một mình (vd tem in từ hệ thống khác chỉ chứa `MB-00012`) cũng được nhận.

**Mẫu tem** (in từ trang In tem QR, trình duyệt in thẳng ra máy in):

| Mẫu | Dùng cho |
|---|---|
| A4 — 24 tem 70 × 37 mm | mặc định: thiết bị trong nhà trạm, tủ điện, văn phòng |
| A4 — 40 tem 52,5 × 29,7 mm | thiết bị nhỏ |
| A4 — 12 tem 105 × 49,5 mm | thiết bị ngoài trời, nhìn từ xa |
| A4 — 65 tem 38,1 × 21,2 mm | dụng cụ nhỏ (chỉ QR + mã) |
| Tem cuộn 50 × 30, 60 × 40 mm | máy in tem nhiệt (Xprinter, Brother…) |

Tem gồm: QR, tên công ty, **mã tài sản chữ to**, tên tài sản, đơn vị, dòng "Quét mã để xem thông tin". Mức chống bẩn/xước của QR chọn được
(15% / 25% / 30%). **Tem trắng**: cấp trước một dãy mã, in, dán lên tài sản ngoài hiện trường, sau đó quét tem → "Khai báo tài sản với mã này".

Gợi ý vật liệu cho ngành nước: trong nhà trạm dùng decal PVC / giấy decal ép màng; ngoài trời, nơi ẩm (máy bơm giếng, van, trụ cứu hoả,
hố đồng hồ) dùng **tem nhôm / inox khắc laser** hoặc decal PVC phủ màng chống UV, dán trên mặt phẳng sạch dầu mỡ; van trong hố có thể
treo thẻ nhôm bằng dây inox. Dán ở vị trí đứng thẳng quét được, không bị nước đọng.

## 4. Người dùng và phân quyền

Quyền tăng dần, quyền trên làm được mọi việc của quyền dưới:

| Quyền | Được làm |
|---|---|
| Chỉ xem | Quét QR, xem thông tin / ảnh / lịch sử, xem tổng quan, xuất Excel |
| Nhân viên kiểm tra | + ghi kiểm tra (báo hỏng), ghi bảo dưỡng / sửa chữa, chụp ảnh, kiểm kê (quét tem là ghi nhận) |
| Cán bộ quản lý tài sản | + thêm / sửa tài sản, điều chuyển, thanh lý, in tem, cấp tem trắng, nhập Excel, bắt đầu / kết thúc / mở lại kiểm kê năm, thêm loại / đơn vị |
| Quản trị | + xoá tài sản / loại / đơn vị / kiểm kê năm, quản lý tài khoản, cài đặt |

Tài khoản có thể **giới hạn 1 đơn vị** (vd tài khoản của Đội cấp nước số 2): chỉ thêm / sửa / điều chuyển tài sản của đơn vị đó;
kiểm tra và kiểm kê vẫn quét được mọi tài sản (để ghi nhận tài sản nằm sai chỗ).

## 5. Dữ liệu

| Đối tượng | Thông tin chính |
|---|---|
| Loại tài sản | tên, tiền tố mã, nhóm TSCĐ (nhà cửa vật kiến trúc / máy móc thiết bị / phương tiện vận tải, truyền dẫn / thiết bị dụng cụ quản lý / khác / công cụ dụng cụ), số năm khấu hao mặc định, chu kỳ bảo dưỡng mặc định (ngày), **danh sách thông số kỹ thuật riêng** (vd máy bơm: lưu lượng, cột áp, công suất) |
| Đơn vị quản lý | tên, ghi chú, **khối**: *Các đội cấp nước* (Đội Cấp nước số 1–6, trạm, nhà máy) hoặc *Khối văn phòng* (Ban Giám đốc, các phòng) |
| Tài sản | mã, tên, loại, đơn vị, vị trí, toạ độ GPS, người sử dụng, hãng, model, số seri, nước / năm sản xuất, ngày đưa vào sử dụng, nguyên giá, số năm khấu hao, bảo hành đến, chu kỳ bảo dưỡng, lần bảo dưỡng cuối, tình trạng, thông số kỹ thuật, ghi chú, bộ ảnh (ảnh chính), lần kiểm tra cuối |
| Sự kiện (lịch sử) | khai báo, sửa thông tin (ghi rõ trường nào đổi từ gì sang gì), kiểm tra, bảo dưỡng / sửa chữa (chi phí), điều chuyển, thanh lý, thêm ảnh, kiểm kê — kèm người làm, thời gian, tình trạng ghi nhận, ghi chú, ảnh, toạ độ |
| Kiểm kê năm | **năm** (mỗi năm 1 đợt toàn công ty), tên, thời gian, **sổ sách lúc bắt đầu** (danh sách tài sản, tài sản khai báo thêm trong năm tự vào sổ), kết quả từng tài sản (dựng lại từ lịch sử), đã kết thúc hay chưa |

Tình trạng: *Đang sử dụng tốt · Cần theo dõi · Hỏng, cần sửa chữa · Đang sửa chữa / bảo dưỡng · Ngừng sử dụng · Đã thanh lý · Mất / không tìm thấy*
(luôn hiện kèm biểu tượng + chữ, không chỉ bằng màu).

Số tính tự động:
- **Khấu hao luỹ kế, giá trị còn lại**: đường thẳng theo ngày từ ngày đưa vào sử dụng, ghi rõ "tạm tính" — để tham khảo khi kiểm tra
  hiện trường; số chính thức vẫn theo sổ kế toán.
- **Hạn bảo dưỡng** = lần bảo dưỡng cuối + chu kỳ (chưa ghi lần nào: tính từ ngày khai báo vào phần mềm). Tổng quan nhắc tài sản đến hạn trong 7 ngày.
- **Lâu chưa kiểm tra**: quá N ngày (mặc định 180, đổi ở Cài đặt).

Thư mục dữ liệu trên máy chủ:

```
C:\QuanLyTaiSanData\
  taisan.xml             danh mục, tài sản, kiểm kê các năm, cài đặt (ghi file tạm rồi thay; bản trước ở .bak)
  LichSu\2026-10.jsonl   lịch sử — chỉ ghi thêm, mỗi dòng 1 sự kiện (không sửa / xoá được: đảm bảo vết kiểm tra)
  Anh\<số>\*.jpg         ảnh từng tài sản (ảnh lớn ≤ 1600 px + ảnh nhỏ), điện thoại nén trước khi gửi (~200–400 KB/ảnh)
  SaoLuu\                mỗi ngày 1 bản taisan.xml, giữ 90 ngày
  taikhoan.xml           tài khoản (mật khẩu băm PBKDF2), phiên đăng nhập
  NhatKy\                nhật ký máy chủ (đăng nhập, nhập Excel, xoá…)
```

## 6. Màn hình

| Màn hình | Nội dung |
|---|---|
| Đăng nhập | tên, mật khẩu; mở từ tem thì đăng nhập xong vào thẳng tài sản |
| Tổng quan | số tài sản, nguyên giá, giá trị còn lại, hỏng / đang sửa, đến hạn bảo dưỡng, lâu chưa kiểm tra, chưa có ảnh; biểu đồ theo tình trạng / loại / đơn vị (bấm để lọc); tiến độ kiểm kê năm nay; hoạt động gần đây |
| Tài sản | tìm (không dấu cũng được), lọc loại / đơn vị / cả khối / tình trạng / đến hạn bảo dưỡng / lâu chưa kiểm tra / chưa có ảnh, sắp xếp; chọn nhiều → in tem, xuất Excel. Tài khoản 1 đơn vị: mở ra là lọc sẵn đơn vị mình |
| **Theo đơn vị** | chia theo khối (Các đội cấp nước / Khối văn phòng), mỗi đội / phòng ban 1 thẻ: số tài sản, nguyên giá, còn lại, loại chính, việc cần xử lý (hỏng, đến hạn bảo dưỡng, lâu chưa kiểm tra, chưa có ảnh); nút danh sách, in tem, sổ Excel của đơn vị / của khối / cả công ty |
| **Quét QR** | camera sau, khung ngắm, đèn pin (nếu máy hỗ trợ), rung khi đọc được; chụp ảnh mã QR; gõ mã. Mã chưa có → khai báo mới với mã đó. Quét = **ghi nhận kiểm kê năm nay** rồi mở trang tài sản; chế độ **quét liên tục**: ở lại camera, mỗi tem quét hiện vào danh sách "Vừa quét" (bấm để ghi tình trạng) |
| **Trang tài sản** | ảnh lớn + dải ảnh (xem toàn màn hình, vuốt qua lại), mã, tình trạng, tên, loại, đơn vị, vị trí; nút Kiểm tra · Chụp ảnh · Bảo dưỡng / sửa · Sửa · Điều chuyển · In tem · Thanh lý; thông tin chung, thông số kỹ thuật, giá trị & bảo dưỡng, tem QR, **lịch sử dạng dòng thời gian** có ảnh và vị trí; ô kiểm kê năm nay (vừa ghi nhận / đã kiểm lúc… / chưa kiểm — nút Xác nhận, Ghi tình trạng kiểm kê) |
| Thêm / sửa | đủ các trường, thông số kỹ thuật theo loại + thêm tuỳ ý, lấy toạ độ GPS hiện tại, chụp ảnh ngay khi khai báo |
| Kiểm kê | mở thẳng kiểm kê năm nay (chưa bắt đầu: hướng dẫn + nút Bắt đầu, các năm trước); tiến độ theo khối → đơn vị, tab Chưa kiểm / Đã kiểm / Ngoài sổ, chọn năm, nút **Quét kiểm kê** (quét liên tục), xuất biên bản, kết thúc / mở lại |
| Điều chuyển | các phiếu điều chuyển (lọc đơn vị giao / nhận), chi tiết phiếu, tải biên bản giao nhận; nút **Quét tem để điều chuyển** (trang Quét, chế độ Điều chuyển: gom tài sản bằng quét tem rồi chuyển 1 lần) |
| In tem QR | chọn mẫu tem, nội dung tem, bỏ qua n ô đầu tờ (tờ decal dùng dở), mức chống bẩn, xem trước, in; cấp tem trắng |
| Nhập từ Excel | tải mẫu; chọn file → xem trước (thêm / cập nhật / lỗi từng dòng) → nhập |
| Danh mục, Tài khoản, Cài đặt, Hoạt động | như tên |

## 7. Quy trình nghiệp vụ

1. **Đưa tài sản vào phần mềm** — nhập file Excel sổ tài sản cố định đang dùng (phần mềm tự nhận cột theo tiêu đề; mã đã có = cập nhật;
   loại / đơn vị chưa có thì tạo mới) hoặc thêm từng tài sản.
2. **Giao tài sản cho đơn vị** — mỗi tài sản thuộc 1 đội cấp nước hoặc 1 phòng ban; mỗi đơn vị in **Sổ theo dõi tài sản tại đơn vị sử dụng**
   (Excel) để trưởng đơn vị ký nhận; tài khoản của đội / phòng chỉ sửa được tài sản của mình.
3. **Dán tem** — in tem theo đơn vị / loại, giao đội dán; hoặc in tem trắng, dán ngoài hiện trường rồi quét để khai báo (chụp ảnh, lấy GPS tại chỗ).
4. **Kiểm tra định kỳ / tuần tra** — quét tem → Kiểm tra → chọn tình trạng, ghi chú, chụp ảnh, ghi vị trí → lưu. Tình trạng tài sản cập nhật ngay;
   tổng quan hiện danh sách hỏng.
5. **Báo hỏng → sửa chữa** — người kiểm tra chọn "Hỏng, cần sửa chữa" kèm ảnh; tổ sửa chữa xử lý xong quét tem → Bảo dưỡng / sửa:
   nội dung, chi phí, tình trạng sau sửa, ảnh. Lịch sử giữ đủ, cộng được chi phí sửa chữa theo tài sản.
6. **Bảo dưỡng theo chu kỳ** — tổng quan nhắc tài sản đến hạn; ghi bảo dưỡng xong hạn tự lùi theo chu kỳ.
7. **Điều chuyển** — trên điện thoại quét tem nhiều tài sản (hoặc chọn trong danh sách, hoặc từ trang 1 tài sản) → chọn đội / phòng ban nhận,
   vị trí, người sử dụng, số quyết định → phần mềm lập **phiếu điều chuyển** DC-năm-số, đổi đơn vị ngay, lịch sử ghi "Đơn vị: A → B";
   in **biên bản giao nhận Excel** (bên giao, bên nhận, danh sách, nguyên giá, giá trị còn lại, chữ ký) bất cứ lúc nào từ phiếu.
8. **Kiểm kê hằng năm** — mỗi năm 1 lần, toàn công ty. Lần quét tem đầu tiên trong năm tự bắt đầu kiểm kê năm đó (hoặc cán bộ quản lý bấm Bắt đầu):
   phần mềm chốt sổ sách = mọi tài sản đang quản lý; tài sản khai báo thêm trong năm tự vào sổ; kiểm kê năm trước còn mở thì tự kết thúc.
   **Quét tem = ghi nhận đã kiểm kê** (giữ tình trạng hiện có; quét lại trong năm không ghi trùng). Tài sản có vấn đề thì ghi thêm tình trạng thực tế,
   ghi chú, ảnh. Theo dõi tiến độ theo khối → đơn vị, danh sách **chưa tìm thấy**, tài sản **ngoài sổ** (quét được nhưng không có trong sổ sách đầu kỳ).
   Cuối năm xuất **biên bản kiểm kê Excel** (theo sổ sách / thực tế / chênh lệch, tình trạng, người kiểm, chữ ký người lập – kế toán trưởng – giám đốc)
   và trang tiến độ theo đơn vị, rồi kết thúc (sau đó quét tem không ghi nhận nữa; mở lại được).
9. **Thanh lý** — ghi số quyết định / biên bản, giá trị thu hồi; tài sản chuyển "Đã thanh lý", không còn nhắc bảo dưỡng, không vào sổ kiểm kê các năm sau.

## 8. API (JSON, `https://<máy chủ>/taisan/api/...`, đăng nhập bằng `Authorization: Bearer <token>`)

| Địa chỉ | Việc |
|---|---|
| `POST dangnhap`, `POST dangxuat`, `GET toi`, `POST doimatkhau` | đăng nhập (sai 5 lần khoá 10 phút), phiên 60 ngày |
| `GET danhmuc`, `POST/DELETE loai`, `POST/DELETE donvi`, `POST caidat` | danh mục, cài đặt |
| `GET taisan?q=&loai=&donvi=&khoi=&tinhtrang=&them=&sap=&trang=` | danh sách có lọc (khoi = doi / vanphong), phân trang |
| `GET theodonvi`, `POST xuat/donvi` | số liệu theo khối → đơn vị; sổ tài sản Excel (cả công ty / 1 khối / 1 đơn vị) |
| `GET taisan/{id}`, `POST taisan`, `DELETE taisan?id=` | chi tiết (kèm lịch sử, ảnh, kiểm kê năm nay), thêm / sửa (chặn sửa đè bằng số phiên bản), xoá |
| `GET tim?ma=<nội dung QR>` | đổi nội dung tem → tài sản |
| `POST taisan/{id}/sukien` | kiểm tra, bảo dưỡng, thanh lý |
| `POST dieuchuyen` (`taiSan: [id…], donVi, viTri?, nguoiSuDung?, noiDung`), `GET dieuchuyen?donvi=`, `GET dieuchuyen?so=`, `POST xuat/dieuchuyen` | điều chuyển 1 hoặc nhiều tài sản chung 1 phiếu; danh sách / chi tiết phiếu; biên bản giao nhận Excel |
| `POST taisan/{id}/anh`, `DELETE taisan/{id}/anh?anh=`, `POST taisan/{id}/anhchinh`, `GET anh/{id}/{mã ảnh}?nho=1` | ảnh |
| `GET nhan?...`, `POST nhan/datruoc` | dữ liệu in tem, cấp tem trắng |
| `POST taisan/{id}/kiemke` (`lai: true` = ghi lại tình trạng, ghi chú, ảnh) | quét tem = ghi nhận kiểm kê năm nay (chưa bắt đầu thì tự bắt đầu; đã kiểm trong năm thì trả lần trước) |
| `GET kiemke`, `POST kiemke` (`id: 0, nam` = bắt đầu năm; `id` = sửa tên / thời gian / ghi chú), `DELETE kiemke?id=`, `GET kiemke/{id}?loc=&donvi=&q=`, `POST kiemke/{id}/quet`, `.../dong`, `.../bosung`, `.../xuat` | kiểm kê năm |
| `GET thongke`, `GET hoatdong` | tổng quan, hoạt động |
| `POST xuat/taisan`, `GET xuat/mau`, `POST nhap?thu=1` | Excel: trả liên kết tải file (hết hạn sau 10 phút); nhập có chế độ xem trước |
| `GET/POST/DELETE taikhoan` | quản lý tài khoản |
| `GET /t/<mã>` (ngoài /api) | địa chỉ trong tem: chuyển tới trang tài sản |

## 9. Bảo mật

- Chỉ chạy sau IIS https (camera, GPS của trình duyệt cũng đòi https). Mật khẩu băm PBKDF2-SHA1 100.000 vòng, có muối; token ngẫu nhiên 256 bit,
  máy chủ chỉ lưu mã băm SHA-256 của token. Khoá / đổi mật khẩu tài khoản là đăng xuất ngay mọi thiết bị.
- Ảnh chỉ tải được khi đã đăng nhập (không có đường dẫn công khai); kiểm tra định dạng JPEG, giới hạn 8 MB/ảnh, ảnh trả về kèm
  `Content-Security-Policy: sandbox`. Trang web có CSP chặn script lạ, chống nhúng khung.
- Thư mục dữ liệu chỉ app pool IIS được ghi. Lịch sử chỉ ghi thêm. Nhật ký máy chủ ghi đăng nhập sai, xoá, nhập Excel.
- Chỉ IIS gọi được `QuanLyTaiSan.exe` (nghe 127.0.0.1, kiểm tra mã `MS-ASPNETCORE-TOKEN`).

## 10. Giới hạn và hướng phát triển

- Dữ liệu XML phù hợp tới khoảng vài chục nghìn tài sản. Nếu sau này quản lý cả **đồng hồ nước khách hàng** (hàng trăm nghìn) nên chuyển
  phần lưu trữ sang SQL Server — giao diện và API giữ nguyên.
- Chưa làm: dùng khi mất mạng (lưu tạm trên điện thoại rồi gửi sau), app Android riêng (có thể bọc trang web như app Thất thoát nước),
  bản đồ GIS toàn mạng lưới (đã có toạ độ từng tài sản, có thể vẽ lên bản đồ), gắn tài sản thuỷ lượng kế với số liệu thất thoát nước,
  nhắc bảo dưỡng qua Zalo / email, đính kèm hồ sơ PDF (hợp đồng, biên bản bàn giao, bản vẽ), xuất theo mẫu sổ TSCĐ của phần mềm kế toán.
