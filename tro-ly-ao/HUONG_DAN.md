# Trợ lý ảo giao tiếp bằng giọng nói

Hỏi bằng giọng nói, trợ lý trả lời và **đọc to** bằng tiếng Việt. Trợ lý tra được số liệu của phần mềm
**Quản lý thất thoát nước** (tỷ lệ thất thoát từng tháng, cả năm, so kế hoạch / tháng trước / cùng kỳ,
sản lượng khai thác đồng hồ cấp 1) và trả lời các câu hỏi chung trong công việc.

```
 Điện thoại / máy tính (Chrome, Edge)          Máy chủ công ty                         Internet
 ┌────────────────────────────┐   https   ┌──────────────────────────────┐   ┌──────────────────────┐
 │ nói → chữ (nhận giọng nói) │ ───────>  │ Trợ lý ảo (Node.js, cổng 8090)│──>│ Claude (Anthropic)   │
 │ chữ → đọc to (giọng vi-VN) │ <───────  │  giữ khoá API trong file .env │   └──────────────────────┘
 └────────────────────────────┘           │        │ chỉ đọc, đúng quyền   │
                                          │        ▼ tài khoản người dùng  │
                                          │ ThatThoatNuoc.exe trên IIS     │
                                          │ (cổng 8080, có sẵn)            │
                                          └──────────────────────────────┘
```

Ví dụ câu hỏi:

- "Tỷ lệ thất thoát tháng này bao nhiêu?" · "Đội nào cao nhất?" · "Đội 3 so với kế hoạch thế nào?"
- "Lũy kế năm nay so với cùng kỳ năm trước?" · "Tháng 8 năm ngoái toàn công ty bao nhiêu?"
- "Vùng DMA nào đang đứng kim?" · "Sản lượng nước mặt tháng 9?" · "Trạm nào chưa nhập chỉ số?"
- "Soạn giúp thông báo tạm ngưng cấp nước sáng thứ bảy."

Trợ lý **chỉ đọc** số liệu, không sửa gì. Mỗi người đăng nhập bằng tài khoản phần mềm thất thoát nước của mình,
nên chỉ xem được những gì tài khoản đó được xem (vd tài khoản giới hạn 1 đội chỉ thấy đội đó).

## Cài đặt (trên máy chủ IIS đang chạy phần mềm thất thoát nước)

Cần: Windows 10 / Server 2016 trở lên, có Internet; **Node.js 20.12 trở lên** (tải bản LTS tại https://nodejs.org);
một **khoá API Anthropic** (https://console.anthropic.com → API Keys; tiền dùng tính vào tài khoản đó).

1. Chép cả thư mục `tro-ly-ao` sang máy chủ, vd `C:\TroLyAo`.
2. Nhấp đúp **`CaiDat.bat`**: cài thư viện và mở file `.env` bằng Notepad. Điền:
   - `ANTHROPIC_API_KEY=` khoá API.
   - `MAYCHU_DIACHI=localhost:8080` (hoặc `localhost:8080/thatthoat` nếu phần mềm cài thành ứng dụng con).
   - `MAYCHU_MANHANDANG=` mã nhận dạng chứng chỉ mà `CaiDat-IIS.bat` đã in ra (chạy `CaiDat-IIS.bat -KiemTra` để xem lại).
     Trợ lý so mã này trước khi gửi bất kỳ dữ liệu nào, giống phần mềm máy tính và app điện thoại.
   Lưu file.
3. Nhấp đúp **`TaoChungChi.bat`**: tạo chứng chỉ HTTPS (trình duyệt chỉ cho dùng micro trên trang `https://`).
   Muốn ghi thêm tên miền / IP vào chứng chỉ: `TaoChungChi.bat -TenMien tenmien.vn,192.168.1.10`.
   Có chứng chỉ thật của tên miền thì dùng nó: `TaoChungChi.bat -Thumbprint <mã chứng chỉ>`.
4. Nhấp đúp **`Chay.bat`** để chạy thử. Cửa sổ in ra địa chỉ, mô hình, trạng thái nối máy chủ thất thoát nước.
   Mở `https://localhost:8090/` trên máy chủ, đăng nhập, hỏi thử.
5. Chạy được rồi thì đóng `Chay.bat`, nhấp đúp **`TuKhoiDong.bat`**: trợ lý tự chạy mỗi khi bật máy (tác vụ
   `TroLyAoGiongNoi` trong Task Scheduler) và mở tường lửa cổng 8090. Nhật ký ở `nhat-ky.log`.
   Gỡ: `TuKhoiDong.bat -GoBo`.
6. Nếu điện thoại vào từ ngoài mạng công ty: mở / chuyển cổng **8090** trên router giống cổng 8080 đã làm.

Sửa file `.env` hoặc `loi-dan.txt` xong thì khởi động lại trợ lý (chạy lại `TuKhoiDong.bat`, hoặc trong Task Scheduler
bấm End rồi Run tác vụ `TroLyAoGiongNoi`).

**Không có máy chủ thất thoát nước?** Bỏ trống `MAYCHU_DIACHI`, đặt `TRO_LY_MAT_KHAU=` một mật khẩu chung:
trợ lý vẫn trò chuyện được nhưng không tra số liệu. Bỏ trống cả hai thì trợ lý chỉ mở được ngay trên máy chạy nó.

## Sử dụng

Mở `https://<địa chỉ máy chủ>:8090/` bằng **Chrome** (Android, máy tính) hoặc **Edge** (máy tính).
Lần đầu trình duyệt cảnh báo chứng chỉ tự ký: bấm **Nâng cao → Tiếp tục**. Trên điện thoại có thể bấm
⋮ → **Thêm vào màn hình chính** để mở như một ứng dụng.

- **Chạm micro** (nút tròn giữa) → nói → ngừng nói là trợ lý tự trả lời và đọc to từng câu ngay khi có.
  Lần đầu trình duyệt hỏi quyền micro: chọn **Cho phép**.
- Đang đọc mà muốn hỏi tiếp: **chạm micro** để ngắt và nói luôn. Đang chờ trả lời: chạm để dừng.
- **Rảnh tay** (nút bên phải micro): đọc xong trợ lý tự nghe câu tiếp theo — hợp khi đang lái xe, đi hiện trường.
  Hai lần liền không nghe thấy gì thì tự nghỉ.
- **Gõ chữ** (nút bàn phím) khi ở nơi ồn hoặc cần yên lặng. Trên máy tính: **Ctrl + Space** để bắt đầu / dừng nói.
- **+** trên cùng: cuộc trò chuyện mới. Trợ lý nhớ ngữ cảnh trong cùng cuộc trò chuyện
  ("còn tháng trước thì sao?", "đội đó so với kế hoạch?").
- **Cài đặt** (bánh răng): chọn giọng đọc, tốc độ đọc, tắt đọc to (chỉ hiện chữ), bật rảnh tay, đăng xuất.

### Giọng đọc tiếng Việt

Trợ lý dùng giọng đọc có sẵn trên máy người dùng:

- **Android**: Cài đặt → Hệ thống → Ngôn ngữ → Chuyển văn bản thành giọng nói → Công cụ của Google → tải giọng **Tiếng Việt**.
- **Máy tính Windows**: **Edge** có sẵn giọng tự nhiên *HoaiMy / NamMinh (Online, Natural)* — nghe hay nhất.
  Chrome dùng giọng của Windows: Cài đặt → Thời gian và ngôn ngữ → Giọng nói → Thêm giọng → Tiếng Việt.
- **iPhone / iPad**: Safari có giọng tiếng Việt *Linh*. Nhận giọng nói trên iPhone tuỳ phiên bản iOS; không được thì gõ chữ.

## Dữ liệu, bảo mật, chi phí

- **Khoá API** chỉ nằm trong file `.env` trên máy chủ, không bao giờ gửi xuống trình duyệt. File `.env`, `chungchi.pfx`
  đã bị chặn không đưa lên GitHub.
- **Ai được dùng**: chỉ người có tài khoản phần mềm thất thoát nước (hoặc mật khẩu chung). Đăng nhập sai 10 lần / 10 phút
  bị khoá tạm. Mỗi người tối đa `GIOI_HAN_MOI_GIO` câu hỏi / giờ (mặc định 120).
- **Đi đâu**:
  - Giọng nói được trình duyệt chuyển thành chữ bằng dịch vụ nhận giọng nói của trình duyệt (Google với Chrome, Microsoft với Edge).
  - Câu hỏi và phần số liệu cần để trả lời được gửi tới Claude (Anthropic) qua API.
  - Cuộc trò chuyện chỉ giữ trong bộ nhớ máy chủ trợ lý (tự xoá sau 2 giờ không dùng hoặc khi khởi động lại), không ghi ra đĩa.
    Nhật ký chỉ ghi ai hỏi, mất bao lâu và số token — không ghi nội dung.
- **Chi phí** tính theo số token ở tài khoản Anthropic: mô hình mặc định `claude-opus-5-5` giá 4 USD / 1 triệu token vào,
  20 USD / 1 triệu token ra. Một câu hỏi có tra số liệu thường cỡ vài nghìn token vào và vài trăm token ra, tức khoảng vài xu Mỹ.
  Xem số token từng câu trong nhật ký và tổng tiền tại console.anthropic.com → Usage. Có thể đặt hạn mức chi tiêu trong console.
- **Mức suy nghĩ** `TRO_LY_EFFORT=low` trả lời nhanh nhất (hợp với nói chuyện). Thấy trả lời chưa kỹ thì đổi sang `medium`.

## Chỉnh cách trợ lý nói

Lời dặn cho trợ lý nằm trong **`loi-dan.txt`** (cách xưng hô, độ dài câu trả lời, cách đọc số…). Sửa bằng Notepad, lưu dạng
UTF-8, rồi khởi động lại trợ lý. Mặc định trợ lý xưng "em", gọi "anh chị", trả lời 1–3 câu, đọc số kiểu Việt Nam.

## Khi có lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| "Trang đang mở bằng http nên trình duyệt chặn micro" | Chạy `TaoChungChi.bat`, khởi động lại trợ lý, mở bằng `https://`. |
| "Chưa được phép dùng micro" | Bấm ổ khoá cạnh thanh địa chỉ → Micro → Cho phép, tải lại trang. |
| Có chữ nhưng không đọc thành tiếng | Máy chưa có giọng tiếng Việt (xem mục Giọng đọc), hoặc đã tắt "Đọc to" trong Cài đặt. |
| "Mã nhận dạng chứng chỉ máy chủ không khớp" | `MAYCHU_MANHANDANG` khác mã của IIS. Chạy `CaiDat-IIS.bat -KiemTra`, chép mã đúng vào `.env`. Nếu không ai đổi chứng chỉ thì có thể đang bị chặn giữa đường. |
| "Không kết nối được máy chủ thất thoát nước" | Kiểm tra site IIS cổng 8080 đang chạy và `MAYCHU_DIACHI` đúng. |
| "Khoá API của trợ lý không hợp lệ" | Kiểm tra `ANTHROPIC_API_KEY` trong `.env` và số dư tài khoản Anthropic. |
| Không đọc được chứng chỉ HTTPS khi khởi động | Chạy lại `TaoChungChi.bat` (tạo lại cả mật khẩu trong `.env`). |
| Trợ lý không tự chạy sau khi bật máy | Xem `nhat-ky.log`; Task Scheduler → `TroLyAoGiongNoi` → Last Run Result. |

## Dành cho người sửa mã

- `server.js` — máy chủ web: đăng nhập, phục vụ trang, `POST /api/hoi` trả luồng sự kiện (`text/event-stream`).
- `lib/tro-ly.js` — vòng hội thoại với Claude (streaming, gọi công cụ, mô hình dự phòng khi bị từ chối, lưu lịch sử kiểu chỉ nối thêm).
- `lib/cong-cu.js` — 3 công cụ tra số liệu (`that_thoat_thang`, `that_thoat_ca_nam`, `khai_thac_cap_1`) và cách rút gọn kết quả.
- `lib/thatthoat.js` — gọi API của ThatThoatNuoc.exe, ghim chứng chỉ theo mã nhận dạng.
- `lib/xac-thuc.js` — đăng nhập (tài khoản thất thoát nước / mật khẩu chung / chỉ máy này).
- `public/` — trang web (nhận giọng nói + đọc to bằng Web Speech API của trình duyệt, không thư viện ngoài).
- Kiểm thử: `npm test` (dùng máy chủ giả trong `test/gia-lap.js`, không tốn tiền API).
  Thử giao diện không cần khoá thật: `node test/gia-lap.js`, rồi chạy `server.js` với
  `ANTHROPIC_BASE_URL=http://127.0.0.1:8701`, `ANTHROPIC_API_KEY=thu`, `MAYCHU_DIACHI=http://127.0.0.1:8702`
  (tài khoản `quan` / `matkhau`).
