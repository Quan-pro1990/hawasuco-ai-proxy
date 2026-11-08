# Hướng dẫn cài đặt KaraLED từng bước

Làm theo thứ tự: **Chuẩn bị → Bước 1 (lấy khóa YouTube) → Bước 2 (chọn một cách cài) → Bước 3 (nhập khóa) →
Bước 4 (nối điện thoại khách) → Bước 5 (kiểm tra)**. Lần đầu mất khoảng 20–30 phút.

Link tải (kho GitHub công khai, không cần đăng nhập):

| File | Link |
|---|---|
| App Android `KaraLED.apk` | https://github.com/Quan-pro1990/hawasuco-ai-proxy/raw/ccr-a7db12b1-e4v7la/karaoke/KaraLED.apk |
| Bản máy tính Windows (file ZIP) | https://github.com/Quan-pro1990/hawasuco-ai-proxy/archive/refs/heads/ccr-a7db12b1-e4v7la.zip |

> Link đang trỏ tới nhánh `ccr-a7db12b1-e4v7la`. Sau khi gộp vào nhánh `main`, thay chữ `ccr-a7db12b1-e4v7la`
> trong link bằng `main`.

---

## Chuẩn bị

- **Internet** ổn định (Wi-Fi hoặc dây mạng), nên từ 10 Mbps trở lên để phát video HD không giật.
- **Một thiết bị nối với màn hình LED**, chọn một trong ba:
  - TV box Android / Android TV (khuyên dùng cho sân khấu, rẻ, chạy cả ngày);
  - máy tính Windows 10/11;
  - điện thoại hoặc máy tính bảng Android có cổng xuất hình (cáp USB-C → HDMI) hoặc chiếu không dây.
- **Một tài khoản Gmail** để lấy khóa YouTube API (miễn phí, không cần thẻ ngân hàng).
- **Điện thoại của khách / người quản lý** dùng **chung Wi-Fi** với thiết bị ở trên.

---

## Bước 1. Lấy khóa YouTube API (làm một lần, khoảng 5 phút)

Khóa này để phần mềm **tìm bài** trên YouTube. Không có khóa vẫn thêm bài bằng cách dán link YouTube, nhưng không tìm được.
Nên làm trên máy tính cho dễ thao tác.

1. Mở **https://console.cloud.google.com** và đăng nhập Gmail.
   Lần đầu Google hỏi *Quốc gia* → chọn **Việt Nam**, tick đồng ý *Điều khoản dịch vụ* → **Đồng ý và tiếp tục**
   (*Agree and continue*).
2. **Tạo dự án**: bấm ô chọn dự án ở thanh trên cùng (bên phải chữ *Google Cloud*) → **Dự án mới** (*New project*)
   → đặt tên `karaled` → **Tạo** (*Create*). Chờ khoảng 10 giây, bấm **Chọn dự án** (*Select project*) trong thông báo.
   Ô chọn dự án ở thanh trên phải ghi `karaled`.
3. **Bật YouTube Data API v3**: mở **https://console.cloud.google.com/apis/library/youtube.googleapis.com**
   → bấm **Bật** (*Enable*). Chờ vài giây đến khi trang chuyển sang mục *API/Service details*.
4. **Tạo khóa**: mở **https://console.cloud.google.com/apis/credentials** → **+ Tạo thông tin xác thực**
   (*+ Create credentials*) → **Khóa API** (*API key*). Cửa sổ hiện khóa dạng `AIzaSy…` (39 ký tự) → bấm nút sao chép.
5. **Giới hạn khóa** (nên làm, để lỡ lộ khóa người khác cũng không dùng vào việc khác được):
   bấm vào tên khóa (*API key 1*) → mục **Giới hạn API** (*API restrictions*) → chọn **Giới hạn khóa** (*Restrict key*)
   → trong danh sách tick **YouTube Data API v3** → **OK** → **Lưu** (*Save*).
   Mục *Giới hạn ứng dụng* (*Application restrictions*) để **Không có** (*None*).
6. Gửi khóa sang thiết bị sẽ cài phần mềm (vd nhắn Zalo cho chính mình, hoặc lưu vào ghi chú).
   **Không đăng khóa lên mạng / nhóm chat đông người.**

Mỗi khóa tìm được khoảng **100 lần/ngày** (kết quả được lưu 3 ngày, tìm lại cùng chữ không tốn lượt).
Quán đông khách: lặp lại bước 2 → 5 để tạo thêm dự án và khóa, rồi nhập tất cả vào phần mềm — hết lượt khóa này
phần mềm tự dùng khóa khác. Lượt được cấp lại mỗi ngày khoảng 14–15 giờ chiều (giờ Việt Nam).

---

## Bước 2. Cài phần mềm — chọn MỘT cách

### Cách A. TV box / Android TV cắm vào màn hình LED (khuyên dùng)

**A1. Nối dây**
1. Cắm cáp HDMI từ TV box vào màn hình LED (cổng HDMI của bộ xử lý video / card phát LED, hoặc TV).
2. Nối mạng cho TV box: **dây mạng LAN** (ổn định nhất) hoặc Wi-Fi: *Cài đặt → Mạng & Internet → Wi-Fi*.
3. Âm thanh: đi theo HDMI. Nếu dùng amply / loa kéo, cắm dây AV hoặc dây quang từ TV box (hoặc từ màn hình) sang amply.

**A2. Tải app lên TV box** — chọn một cách:
- **Bằng app Downloader** (không cần USB):
  1. Trên TV box mở **CH Play** (*Google Play*), tìm và cài **Downloader** (biểu tượng màu cam, của *AFTVnews*).
  2. Mở Downloader → cho phép truy cập bộ nhớ nếu hỏi → ô *Enter a URL* gõ link APK ở đầu trang → **Go**.
  3. Tải xong, bấm **Install** (*Cài đặt*).
- **Bằng USB**:
  1. Trên máy tính tải `KaraLED.apk` (link ở đầu trang), chép vào USB.
  2. Cắm USB vào TV box → mở trình quản lý file (*File Manager*, *Tệp*, *X-plore*, *File Commander*) → vào USB →
     bấm vào `KaraLED.apk`.

**A3. Cho phép cài và cài đặt**
1. Nếu TV box báo *"Vì lý do bảo mật, TV không được phép cài ứng dụng không rõ nguồn"* → bấm **Cài đặt** (*Settings*)
   → bật công tắc cho app đang dùng (Downloader hoặc trình quản lý file) → bấm Quay lại → **Cài đặt** (*Install*).
   - TV box Android 7 trở về trước: *Cài đặt → Bảo mật* (*Security*) → bật **Nguồn không xác định** (*Unknown sources*).
2. Nếu **Play Protect** cảnh báo *"Ứng dụng chưa được xác minh / chưa quét"* → **Vẫn cài đặt** (*Install anyway*).
   Lý do: app tự phát hành, không đưa lên CH Play.
3. Cài xong bấm **Mở** (*Open*).

**A4. Chạy lần đầu**
1. App mở thẳng **màn hình LED**: tên phần mềm, đồng hồ, mã QR ở góc dưới bên phải.
   Nếu hỏi *cho phép gửi thông báo* → **Cho phép** (giúp app chạy nền ổn định).
2. Lần sau mở lại: tìm **KaraLED** trong danh sách ứng dụng (Android TV: hàng *Ứng dụng*; có thể ghim ra màn hình chính).
3. Nút trên điều khiển TV: **Back** hoặc **Menu** → hộp chọn **Trang điều khiển** / **Tải lại trang** / **Thoát hẳn**.

Tiếp tục **Bước 3**, dùng điện thoại quét mã QR trên màn LED để mở trang điều khiển.

> TV box đời cũ: vào CH Play cập nhật **Android System WebView** (và **Chrome**). WebView quá cũ thì video YouTube không phát.

---

### Cách B. Điện thoại / máy tính bảng Android

**B1. Cài app**
1. Trên điện thoại mở **Chrome**, vào link APK ở đầu trang (hoặc quét mã QR trên trang hướng dẫn).
2. Chrome hỏi *"File có thể gây hại"* → **Vẫn tải xuống**. Tải xong bấm **Mở**.
3. Điện thoại báo *"Không được phép cài ứng dụng không rõ nguồn"* → **Cài đặt** → bật **Cho phép từ nguồn này** cho Chrome
   → Quay lại → **Cài đặt**. Play Protect cảnh báo → **Vẫn cài đặt**.
4. Mở **KaraLED**, cho phép thông báo. App mở **trang điều khiển**.

**B2. Giữ app chạy khi tắt màn hình** (quan trọng, để điện thoại khách không bị mất kết nối)
- Đa số máy: *Cài đặt → Ứng dụng → KaraLED → Pin* → **Không hạn chế** (*Unrestricted*).
- Xiaomi / Redmi / POCO: thêm *Cài đặt → Ứng dụng → Quản lý ứng dụng → KaraLED* → bật **Tự khởi động**,
  *Tiết kiệm pin* → **Không hạn chế**.
- Oppo / Realme / Vivo: *Pin* → cho phép **hoạt động nền**.
- Cắm sạc khi dùng lâu.

**B3. Đưa hình ra màn hình LED** — chọn một cách:

| Cách nối | Làm gì |
|---|---|
| **Cáp USB-C → HDMI** | Chỉ dùng được với máy hỗ trợ xuất hình qua cổng sạc (đa số Samsung Galaxy S / Note / Tab S, một số máy cao cấp khác). Cắm cáp → màn hình LED **tự hiện trên màn hình ngoài**, điện thoại thành bàn điều khiển. Máy Samsung tự vào chế độ **DeX**: chuyển sang **Phản chiếu màn hình** (*Screen mirroring*) trong bảng thông báo. |
| **Chiếu không dây** (Smart View, Miracast, *Phát màn hình*) | Bật chiếu tới TV / bộ thu → màn hình LED tự hiện trên TV. |
| **Smart TV có trình duyệt** | Trên trang điều khiển bấm **Kết nối thiết bị**, xem địa chỉ ở mục *Màn hình LED / TV* (vd `192.168.1.20:3000/led`), gõ vào trình duyệt của TV, bấm vào màn hình một lần để bật tiếng. |
| **Máy tính bảng làm màn hình** | Bấm **MỞ LED** → máy chuyển sang màn hình LED toàn màn hình. Vuốt / bấm Quay lại để về trang điều khiển. |

Chromecast / *Truyền màn hình Google* chỉ phản chiếu nguyên màn hình điện thoại: khi đó bấm **MỞ LED** để điện thoại
hiện màn hình LED, và dùng điện thoại khác để điều khiển.

---

### Cách C. Máy tính Windows

**C1. Cài Node.js** (một lần)
1. Mở **https://nodejs.org** → bấm nút tải bản **LTS** (bản khuyên dùng) → được file `node-v…-x64.msi`.
2. Mở file → **Next** → tick *I accept…* → **Next** liên tục (giữ mặc định) → **Install** → **Finish**.

**C2. Tải phần mềm**
1. Tải file ZIP (link ở đầu trang).
2. Chuột phải file ZIP → **Giải nén tất cả** (*Extract All*) → **Giải nén**.
3. Trong thư mục vừa giải nén, chép thư mục **`karaoke`** ra chỗ dễ tìm, vd `D:\karaoke`
   (không để trong thư mục có dấu tiếng Việt lạ hoặc OneDrive đang đồng bộ).

**C3. Chạy**
1. Vào `D:\karaoke`, nhấp đúp **`ChayKaraoke.bat`**.
2. Windows hiện *"Windows đã bảo vệ PC của bạn"* (*Windows protected your PC*) → **Thông tin bổ sung** (*More info*)
   → **Vẫn chạy** (*Run anyway*).
3. Cửa sổ đen hiện dòng `KARALED dang chay` và các địa chỉ. **Không đóng cửa sổ này** (đóng là tắt phần mềm).
4. Tường lửa Windows hỏi về *Node.js* → tick **Mạng riêng** (*Private networks*) → **Cho phép truy cập** (*Allow access*).
5. Trình duyệt tự mở trang điều khiển `http://localhost:3000`.

**C4. Màn hình LED** (LED nối vào máy tính như màn hình thứ hai)
1. Bấm **Windows + P** → chọn **Mở rộng** (*Extend*).
2. Nhấp đúp **`MoManHinhLED.bat`** → màn hình LED toàn màn hình, tự phát có tiếng. Thoát: **Alt + F4**.
   - Màn hình chính không phải loại rộng 1920 điểm ảnh (vd laptop 1366): chuột phải `MoManHinhLED.bat` → *Tạo lối tắt*
     (*Create shortcut*) → chuột phải lối tắt → *Thuộc tính* → ô **Đích** (*Target*) thêm vào cuối: ` "" 1366` → OK.
   - Hoặc: bấm **MỞ LED** trên trang điều khiển → kéo cửa sổ sang màn LED → bấm vào nó một lần → phím **F**.
3. Muốn hết quảng cáo bằng YouTube Premium: chạy **`MoManHinhLED.bat dangnhap`** một lần, đăng nhập YouTube Premium
   trong cửa sổ hiện ra, đóng lại rồi chạy `MoManHinhLED.bat` như thường.

**C5. Tự chạy khi bật máy** (tùy chọn)
1. Chuột phải `ChayKaraoke.bat` → *Tạo lối tắt*. Làm tương tự với `MoManHinhLED.bat`.
2. Bấm **Windows + R**, gõ `shell:startup` → Enter. Kéo hai lối tắt vào thư mục vừa mở.

---

## Bước 3. Nhập khóa YouTube API và thông tin quán

1. Mở trang điều khiển:
   - TV box: lấy điện thoại **cùng Wi-Fi**, mở camera **quét mã QR** trên màn LED;
   - điện thoại / máy tính bảng: ngay trong app KaraLED;
   - máy tính: trang `http://localhost:3000` vừa mở.
2. Bấm **⚙ Cài đặt** (trên điện thoại là nút biểu tượng thanh trượt cạnh nút *Karaoke*).
3. Mục **Khóa YouTube API**: dán khóa `AIzaSy…` → **Thêm khóa**. Dòng trạng thái đổi thành *"✓ Đã có khóa, tìm bài được"*.
4. Điền **Tên hiển thị** (tên quán), **Khẩu hiệu**, **Hotline** → hiện trên màn hình chờ.
5. **Mã quản lý** (nên đặt nếu khách được quét QR): gõ 4–8 chữ số → **Lưu**.
   Khi đó khách chỉ tìm và thêm bài; điều khiển, xóa bài, đổi thứ tự cần mã.
   Người quản lý bấm nút **Khách** (biểu tượng ổ khóa) trên đầu trang → nhập mã → thành **Quản lý**.
6. Bấm **Lưu**.

---

## Bước 4. Nối điện thoại của khách

1. Điện thoại bắt **cùng Wi-Fi** với thiết bị chạy phần mềm.
2. Quét **mã QR** trên màn hình chờ của LED (hoặc trong **Kết nối thiết bị**) → bấm link hiện ra.
   - iPhone: mở **Camera**, hướng vào mã QR, bấm khung vàng hiện ra.
   - Địa chỉ có dạng `http://192.168.1.20:3000` (bắt đầu bằng **http**, không có chữ *s*).
3. Muốn dùng như app: Chrome **⋮ → Thêm vào màn hình chính**; iPhone Safari **Chia sẻ → Thêm vào MH chính**.
4. Tìm bài → **+ THÊM**. Có thể ghi **Người hát** để màn LED mời đúng tên khi tới lượt.

Không vào được? Xem bảng lỗi bên dưới (thường do Wi-Fi khách của router chặn các máy thấy nhau).

> Nên cố định địa chỉ IP cho thiết bị chạy phần mềm (trong trang quản lý router: *DHCP → Đặt trước địa chỉ*
> / *Address Reservation*). Nếu không, sau khi khởi động lại router địa chỉ có thể đổi; mã QR trên LED tự cập nhật
> nhưng lối tắt khách đã lưu sẽ phải quét lại.

---

## Bước 5. Kiểm tra sau khi cài

- [ ] Màn LED hiện màn hình chờ có tên quán, đồng hồ, mã QR.
- [ ] Điện thoại quét mã QR mở được trang điều khiển.
- [ ] Trang điều khiển (mục *Màn hình LED*) ghi **"✓ 1 màn hình LED đang kết nối"**.
- [ ] Gõ `tình xưa nghĩa cũ` → **KARAOKE** → có danh sách kết quả.
- [ ] **+ THÊM** một bài → màn LED phát **có tiếng**.
- [ ] **Tạm dừng**, **Phát**, **Qua bài**, kéo **Âm lượng** đều chạy.
- [ ] Bấm **Màn hình chờ** rồi bấm lại → LED chuyển qua lại đúng.

---

## Lỗi thường gặp khi cài

| Hiện tượng | Cách xử lý |
|---|---|
| *"Ứng dụng chưa được cài đặt"* / *"Xung đột gói"* | Đã có bản KaraLED ký khác trên máy: gỡ bản cũ (*Cài đặt → Ứng dụng → KaraLED → Gỡ cài đặt*) rồi cài lại. Phải nhập lại khóa API. |
| *"Lỗi phân tích cú pháp gói"* | File APK tải chưa xong hoặc máy dưới Android 5.0. Tải lại file. |
| Không thấy KaraLED trên TV box sau khi cài | Vào *Cài đặt → Ứng dụng → Xem tất cả*, hoặc mở bằng Downloader / trình quản lý file (*Mở*). |
| Màn LED đen, không phát video | Cập nhật *Android System WebView* và *Chrome* trên CH Play; kiểm tra Internet của TV box. |
| Có hình không có tiếng | TV box: kiểm tra âm lượng TV box và loa/amply. Máy tính: bấm vào màn LED một lần, hoặc dùng `MoManHinhLED.bat`. |
| Điện thoại khách không mở được trang | Cùng Wi-Fi chưa? Router bật *Cách ly AP* / *AP Isolation* hoặc đang dùng *Wi-Fi khách* → dùng Wi-Fi chính hoặc tắt cách ly. Máy tính: tường lửa đã cho phép Node.js (*Mạng riêng*), và Wi-Fi trên Windows đặt là *Mạng riêng* (*Private*). |
| Bấm `ChayKaraoke.bat` báo *chua cai Node.js* | Cài Node.js (C1) rồi **khởi động lại máy**. |
| Cửa sổ đen báo *Cong 3000 dang bi chuong trinh khac dung* | Mở `karaoke\.env` bằng Notepad, sửa `PORT=3001`, lưu, chạy lại. |
| *"Chưa có khóa YouTube API"* | Làm Bước 1 và Bước 3. |
| *"Khóa YouTube API bị từ chối"* | Chưa **Bật** YouTube Data API v3 (Bước 1.3) đúng dự án, hoặc ở bước 1.5 tick nhầm API khác. |
| *"Hết lượt tìm kiếm hôm nay"* | Thêm khóa thứ hai (tạo dự án mới), hoặc dán link YouTube để thêm bài. |
| Điện thoại khách mất kết nối khi máy chủ tắt màn hình (Cách B) | Làm B2 (tắt tiết kiệm pin cho KaraLED). |

---

## Cập nhật / gỡ bỏ

- **Android**: cài file APK mới đè lên (cùng khóa ký thì giữ nguyên danh sách phát và cài đặt).
  Gỡ: *Cài đặt → Ứng dụng → KaraLED → Gỡ cài đặt*.
- **Windows**: tải ZIP mới, chép đè các file vào `D:\karaoke` **trừ thư mục `data`** và file `.env`
  (chứa danh sách phát, cài đặt, khóa API). Gỡ: xóa thư mục `D:\karaoke`.
