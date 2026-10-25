# Hướng dẫn dựng máy chủ HawaMap cho người mới

Làm xong hướng dẫn này, bạn có bản đồ dẫn đường HawaMap chạy trên máy chủ của mình tại `https://<tên-miền-của-bạn>`:
mọi người mở trên điện thoại, cài lên màn hình chính, dùng chung báo cáo giao thông; máy chủ tự cập nhật dữ liệu camera,
biển báo, đường cấm, trạm thu phí mỗi tuần và tự chạy lại khi máy khởi động.

> Không cần biết lập trình. Lần đầu mất khoảng 1 giờ, phần lớn là chờ tải phần mềm và chờ tên miền có hiệu lực. Cứ làm lần lượt từng bước; chữ trong khung xám như `mstsc` là thứ bạn gõ hoặc thấy trên màn hình.

## Mục lục

1. [Chuẩn bị](#1-chuẩn-bị)
2. [Đăng nhập vào máy chủ](#2-đăng-nhập-vào-máy-chủ)
3. [Mở cổng 80 và 443](#3-mở-cổng-80-và-443)
4. [Trỏ tên miền về máy chủ](#4-trỏ-tên-miền-về-máy-chủ)
5. [Đưa gói cài đặt lên máy chủ](#5-đưa-gói-cài-đặt-lên-máy-chủ)
6. [Chạy trình cài đặt](#6-chạy-trình-cài-đặt)
7. [Kiểm tra máy chủ](#7-kiểm-tra-máy-chủ)
8. [Bật HTTPS miễn phí](#8-bật-https-miễn-phí)
9. [Dùng trên điện thoại](#9-dùng-trên-điện-thoại)
10. [Vận hành hằng ngày](#10-vận-hành-hằng-ngày)
11. [Gặp lỗi](#11-gặp-lỗi)
12. [Phụ lục](#12-phụ-lục)

## 1. Chuẩn bị

### Máy chủ

Một máy Windows chạy suốt ngày đêm, có địa chỉ IP công khai. Cách dễ nhất cho người mới là **thuê một VPS Windows**
(máy chủ ảo) của nhà cung cấp trong nước hoặc quốc tế: chọn gói có hệ điều hành Windows Server và IP công khai, nhà cung
cấp sẽ gửi cho bạn **địa chỉ IP**, **tên đăng nhập** (thường là `Administrator`) và **mật khẩu**.

| Thành phần | Tối thiểu | Nên dùng |
|---|---|---|
| Hệ điều hành | Windows Server 2016 | Windows Server 2022 hoặc 2019 |
| CPU | 1 nhân | 2 nhân |
| RAM | 2 GB | 4 GB |
| Ổ đĩa còn trống | 10 GB | 20 GB |
| Mạng | IP công khai cố định, mở được cổng 80 và 443 | như tối thiểu |

Máy chủ HawaMap nhẹ: bản đồ nền và tìm đường do trình duyệt của người dùng lấy thẳng từ các dịch vụ bản đồ công cộng,
máy chủ chỉ phục vụ trang web, báo cáo giao thông và dữ liệu cảnh báo.

Dùng máy tính để bàn ở công ty (Windows 10 / 11 Pro) cũng được, nhưng cần IP tĩnh của nhà mạng và mở cổng (NAT /
port forwarding) 80, 443 trên modem về máy đó. Cách này khó hơn, chỉ nên chọn khi đã quen.

### Tên miền

Cần tên miền để bật HTTPS (điện thoại chỉ cho trang web dùng GPS, micro, camera khi chạy HTTPS). Có thể:

- Mua tên miền mới (đuôi `.vn`, `.com.vn`, `.com`…) ở một nhà đăng ký tên miền, hoặc
- Dùng một tên miền con của tên miền công ty đã có, ví dụ `bando.congty.vn` — không tốn thêm tiền, chỉ cần người quản lý
  tên miền thêm một bản ghi (bước 4).

Trong hướng dẫn này lấy ví dụ tên miền `bando.congty.vn` và IP máy chủ `203.0.113.10`; thay bằng của bạn.

### Gói cài đặt

Tệp `hawamap-may-chu-<phiên bản>.zip` (khoảng 1 MB). Nhận từ người phát triển, hoặc tự tạo từ mã nguồn (xem
[Phụ lục A](#phụ-lục-a-tạo-gói-cài-đặt-từ-mã-nguồn)). Trong gói có sẵn hướng dẫn này (`HUONG-DAN-CAI-DAT.html`).

### Máy tính của bạn

Để điều khiển máy chủ từ xa. Windows có sẵn **Remote Desktop Connection**; máy Mac cài ứng dụng **Windows App** (tên cũ:
Microsoft Remote Desktop) từ App Store.

### Vài từ cần biết

| Từ | Nghĩa |
|---|---|
| VPS / máy chủ | Máy tính chạy suốt ngày đêm trong trung tâm dữ liệu, bạn điều khiển từ xa |
| IP công khai | Địa chỉ số của máy chủ trên Internet, ví dụ `203.0.113.10` |
| Tên miền | Địa chỉ dễ nhớ thay cho IP, ví dụ `bando.congty.vn` |
| Bản ghi A (DNS) | Dòng cấu hình của tên miền, nghĩa là "tên miền này ở IP này" |
| Remote Desktop | Cách mở màn hình máy chủ ngay trên máy tính của bạn |
| IIS | Phần mềm máy chủ web có sẵn trong Windows |
| Node.js | Chương trình chạy máy chủ HawaMap (trình cài đặt tự cài) |
| HTTPS / chứng chỉ | Kết nối mã hoá, có hình ổ khoá trên trình duyệt; chứng chỉ Let's Encrypt miễn phí |
| Administrator | Tài khoản quản trị của Windows, có quyền cài phần mềm |

## 2. Đăng nhập vào máy chủ

1. Trên máy của bạn: bấm **Start**, gõ `mstsc` rồi nhấn Enter — cửa sổ **Remote Desktop Connection** hiện ra.
2. Ô **Computer**: gõ IP máy chủ, ví dụ `203.0.113.10`, bấm **Connect**.
3. Nhập tên đăng nhập `Administrator` và mật khẩu nhà cung cấp gửi, bấm **OK**.
4. Hiện câu "The identity of the remote computer cannot be verified": tích **Don't ask me again** rồi bấm **Yes**.
5. Màn hình máy chủ hiện ra trong cửa sổ. Từ đây, mọi việc làm trong cửa sổ này, trừ khi hướng dẫn ghi "trên máy của bạn".

Nên làm ngay: đổi mật khẩu Administrator nếu nhà cung cấp gửi qua email (nhấn `Ctrl + Alt + End` trong cửa sổ Remote
Desktop → **Change a password**), và chạy **Windows Update** cho đủ bản vá.

## 3. Mở cổng 80 và 443

Người dùng vào trang web qua cổng **80** (http) và **443** (https). Có hai lớp tường lửa:

- **Tường lửa Windows** trên máy chủ: trình cài đặt tự mở, không cần làm gì.
- **Tường lửa của nhà cung cấp** (thường gọi là Firewall, Security Group, Network Security Group trong trang quản lý
  VPS): nếu có, thêm hai luật cho phép kết nối vào (Inbound) qua TCP cổng `80` và `443` từ mọi nơi (`0.0.0.0/0`).
  Giữ luật cổng `3389` (Remote Desktop), tốt nhất chỉ cho phép từ IP của bạn.

Không thấy mục tường lửa trong trang quản lý VPS thì thường là nhà cung cấp để mở sẵn; hỏi bộ phận hỗ trợ nếu sau này
máy khác không vào được trang.

## 4. Trỏ tên miền về máy chủ

Làm trên máy của bạn, ở trang quản lý tên miền (nơi mua tên miền, hoặc nhờ người quản lý tên miền công ty):

1. Đăng nhập, mở mục **Quản lý DNS** (DNS records, Zone editor…).
2. Thêm một bản ghi như bảng dưới. Muốn dùng chính tên miền gốc (ví dụ `congty.vn`) thì ô Tên nhập `@`.
3. Lưu lại. Thường mất 5 – 30 phút để có hiệu lực, đôi khi lâu hơn.

| Loại | Tên (Host) | Giá trị (Value / Points to) | TTL |
|---|---|---|---|
| A | `bando` | `203.0.113.10` | để mặc định, hoặc 300 |

Kiểm tra: trên máy của bạn bấm **Start**, gõ `cmd`, Enter, rồi gõ `nslookup bando.congty.vn`. Thấy dòng
`Address: 203.0.113.10` (đúng IP máy chủ) là xong.

> Tên miền dùng Cloudflare: để biểu tượng đám mây **màu xám** (DNS only) cho bản ghi này, ít nhất cho tới khi xong bước 8.

## 5. Đưa gói cài đặt lên máy chủ

1. Trên máy của bạn: chuột phải tệp `hawamap-may-chu-<phiên bản>.zip` → **Copy**.
2. Trong cửa sổ Remote Desktop: mở **File Explorer** → **This PC** → ổ **C:** → chuột phải vào chỗ trống → **Paste**.
   (Không dán được thì gửi tệp qua email / Google Drive rồi tải về bằng trình duyệt trên máy chủ.)
3. Tệp tải về từ Internet: chuột phải tệp zip → **Properties** → tích **Unblock** (nếu có) → **OK**. Bước này tránh các
   cảnh báo bảo mật khi chạy trình cài.
4. Chuột phải tệp zip → **Extract All…** → **Extract**. Bạn có thư mục `C:\hawamap-may-chu-<phiên bản>` với các tệp
   `CAI-DAT-MAY-CHU.bat`, `HUONG-DAN-CAI-DAT.html`…

Thư mục này chỉ là bộ cài: trình cài đặt chép ứng dụng sang `C:\inetpub\hawamap`. Giữ lại tệp zip để cài lại khi cần.

## 6. Chạy trình cài đặt

Mở thư mục vừa giải nén và **nhấp đúp `CAI-DAT-MAY-CHU.bat`**. Windows có thể hỏi vài câu trước khi chạy:

| Windows hiện | Bấm |
|---|---|
| "Windows protected your PC" | **More info** → **Run anyway** |
| "Open File - Security Warning" | **Run** |
| "Do you want to allow this app to make changes to your device?" | **Yes** |

Cửa sổ cài đặt hiện ra và làm 4 bước. Câu hỏi có gợi ý `(C/k)` thì nhấn Enter là **Có**; gõ `k` rồi Enter là **Không**.

| Bước | Cửa sổ cài đặt hỏi / báo | Bạn làm |
|---|---|---|
| 1 | `Dang bat IIS, lan dau co the mat vai phut...` | Chờ. Nếu báo cần khởi động lại: khởi động lại máy chủ rồi nhấp đúp `CAI-DAT-MAY-CHU.bat` lần nữa |
| 2 | `Tu dong tai va cai Node.js ban LTS tu nodejs.org? (C/k)` | Nhấn Enter. Trình cài tự tải (khoảng 30 MB) và cài Node.js |
| 3 | `Chua cai URL Rewrite 2.1.` rồi `Cai xong nhan Enter de kiem tra lai` | Trình duyệt mở trang tải. Bấm liên kết bản **x64** (English), chạy tệp `.msi` vừa tải, tích đồng ý, bấm **Install**, **Finish**. Quay lại cửa sổ cài đặt, nhấn Enter |
| 3 | `Chua cai HttpPlatformHandler 1.2.` | Làm giống như trên: tải bản **x64**, cài, quay lại nhấn Enter |
| 4 | `Ten mien` | Gõ tên miền, ví dụ `bando.congty.vn`, nhấn Enter. Chưa có tên miền: nhấn Enter luôn |
| 4 | `Dung site "Default Web Site" de nhuong cong 80 cho HawaMap? (C/k)` (chỉ hỏi khi không nhập tên miền) | Nhấn Enter |
| cuối | `Mo http://... ngay bay gio? (C/k)` | Nhấn Enter để mở thử trang |

Máy nào đã có sẵn Node.js, URL Rewrite, HttpPlatformHandler thì trình cài bỏ qua câu hỏi tương ứng.

Cài thành công khi thấy chữ **Xong.** màu xanh lá và bảng tóm tắt giống thế này:

```
Xong.
  Trang web      : http://bando.congty.vn  (HTTPS: https://bando.congty.vn - chua bat)
  Du lieu        : C:\HawaMapData  (bao cao, du lieu giao thong, phi-cao-toc.json)
  Nhat ky Node   : C:\inetpub\hawamap\logs
```

Thấy dòng màu đỏ bắt đầu bằng `[LOI]`: đọc nội dung dòng đó và xem [mục 11](#11-gặp-lỗi). Sửa xong thì nhấp đúp
`CAI-DAT-MAY-CHU.bat` lại — chạy lại bao nhiêu lần cũng được, các câu trả lời cũ được nhớ (chỉ cần nhấn Enter).

Trình cài đã: bật IIS, cài Node.js, chép ứng dụng vào `C:\inetpub\hawamap`, tạo thư mục dữ liệu `C:\HawaMapData`, tạo
site **HawaMap** trong IIS và mở tường lửa Windows. Từ giờ IIS tự chạy máy chủ HawaMap mỗi khi máy khởi động, tự bật lại
nếu máy chủ HawaMap bị lỗi.

> Trình duyệt trên Windows Server không mở được trang tải (Internet Explorer báo chặn nội dung): mở **Server Manager** → **Local Server** → **IE Enhanced Security Configuration** → chọn **Off** cho Administrators; hoặc tải tệp trên máy của bạn rồi copy sang máy chủ như ở bước 5.

## 7. Kiểm tra máy chủ

1. Trên máy chủ, mở trình duyệt vào `http://bando.congty.vn/api/trang-thai` (không có tên miền thì
   `http://localhost/api/trang-thai`). Thấy dòng bắt đầu bằng `{"ok":true,"ten":"HawaMap"` là máy chủ đang chạy.
2. Trên điện thoại, **tắt Wi-Fi** (dùng 4G cho chắc là đi từ Internet vào), mở `http://bando.congty.vn` (hoặc
   `http://203.0.113.10` nếu không có tên miền). Thấy bản đồ HawaMap là được.
3. Điện thoại không mở được: xem lại tường lửa của nhà cung cấp ([bước 3](#3-mở-cổng-80-và-443)) và bản ghi A
   ([bước 4](#4-trỏ-tên-miền-về-máy-chủ)).

Lúc này trang còn chạy `http://` nên điện thoại chưa cho lấy vị trí GPS. Bước tiếp theo bật HTTPS.

## 8. Bật HTTPS miễn phí

Dùng **win-acme** để xin chứng chỉ miễn phí của Let's Encrypt. Cần có: tên miền đã trỏ đúng (bước 4) và từ điện thoại
mở được `http://bando.congty.vn` (bước 7).

1. Trên máy chủ, mở trang `https://www.win-acme.com` → **Download** → tải bản **x64** (tệp zip có chữ `x64` trong tên).
2. Giải nén vào thư mục `C:\win-acme`. Để cố định thư mục này: win-acme tự gia hạn chứng chỉ từ đây.
3. Trong `C:\win-acme`: chuột phải `wacs.exe` → **Run as administrator**.
4. Trả lời các câu hỏi (chữ có thể hơi khác tuỳ phiên bản, cứ chọn mặc định):
   gõ `N` (Create certificate, default settings) → chọn site **HawaMap** (gõ số đứng trước tên site) → nhấn Enter để chọn
   mọi tên miền của site → nhập email của bạn (Let's Encrypt báo khi có vấn đề) → gõ `y` để đồng ý điều khoản.
5. Thấy thông báo đã tạo chứng chỉ và đã thêm binding https là xong. win-acme tạo sẵn tác vụ tự gia hạn: chứng chỉ có hạn
   90 ngày và được gia hạn tự động trước khi hết hạn.
6. **Nhấp đúp `CAI-DAT-MAY-CHU.bat` lần nữa**, nhấn Enter ở mọi câu hỏi. Trình cài thấy site đã có HTTPS nên bật tự chuyển
   `http://` sang `https://` và mở cổng 443 trên tường lửa Windows. Bảng tóm tắt không còn chữ `chua bat`.
7. Mở `https://bando.congty.vn` trên điện thoại: có hình ổ khoá cạnh địa chỉ là thành công.

win-acme báo lỗi xác minh (validation): kiểm tra lại bản ghi A, cổng 80 từ Internet vào (bước 3, bước 7) và Cloudflare
(đám mây màu xám). HawaMap trả được tệp xác minh của Let's Encrypt cho cả hai cách xác minh `http-01` của win-acme (lưu
tệp vào thư mục site, hoặc phục vụ từ bộ nhớ).

Đã mua chứng chỉ của nhà cung cấp khác: xem [Phụ lục B](#phụ-lục-b-tuỳ-chọn-nâng-cao).

## 9. Dùng trên điện thoại

- **Android (Chrome):** mở `https://bando.congty.vn` → cho phép truy cập vị trí → menu ba chấm → **Thêm vào màn hình
  chính** (hoặc **Cài đặt ứng dụng**).
- **iPhone (Safari):** mở trang → nút **Chia sẻ** → **Thêm vào MH chính**.
- Khi được hỏi, cho phép **vị trí** (dẫn đường, cảnh báo tốc độ), **micro** (tìm bằng giọng nói) và **camera** (camera hành
  trình).
- Ứng dụng Android (Android Auto) và iPhone (CarPlay) build từ mã nguồn: đặt địa chỉ máy chủ `https://bando.congty.vn/api`
  trước khi build (README, mục "Android Auto và Apple CarPlay").
- Trang HawaMap đặt ở nơi khác muốn dùng chung báo cáo với máy chủ này: **Cài đặt → Nâng cao → Máy chủ báo cáo** →
  `https://bando.congty.vn/api`.

## 10. Vận hành hằng ngày

### Máy chủ tự làm

- Tự chạy khi máy chủ khởi động lại, tự bật lại khi gặp lỗi.
- Mỗi tuần tải lại dữ liệu camera, biển báo, đường cấm, cấm vượt, trạm thu phí từ OpenStreetMap cho những khu vực có người
  dùng; khu vực không ai dùng trong 30 ngày thì xoá cho nhẹ. Xem tình trạng tại `https://bando.congty.vn/api/giao-thong/trang-thai`.
- Chứng chỉ HTTPS tự gia hạn (win-acme).

Máy chủ cần ra được Internet tới `overpass-api.de` (nguồn dữ liệu giao thông). Mạng công ty chặn truy cập ra ngoài thì nhờ
mở cho máy chủ.

### Cập nhật phiên bản mới

1. Nhận tệp zip mới, giải nén như bước 5.
2. Nhấp đúp `CAI-DAT-MAY-CHU.bat` trong thư mục mới, nhấn Enter ở mọi câu hỏi.

Dữ liệu trong `C:\HawaMapData` được giữ nguyên. Điện thoại tự nhận bản mới khi mở lại trang.

### Sao lưu

Chỉ cần sao lưu thư mục `C:\HawaMapData`:

| Tệp / thư mục | Nội dung |
|---|---|
| `bao-cao.json` | báo cáo giao thông của người dùng |
| `giao-thong\` | dữ liệu cảnh báo đã tải theo khu vực (mất thì máy chủ tự tải lại) |
| `phi-cao-toc.json` | bảng phí trạm thu phí (nếu bạn đã tạo) |
| `cai-dat-may-chu.json` | câu trả lời của trình cài đặt |

Chép thư mục này ra nơi khác định kỳ (ổ khác, Google Drive…) hoặc dùng Windows Server Backup. Khôi phục: cài lại theo
bước 5, 6 rồi chép thư mục về chỗ cũ.

### Bảng phí trạm thu phí

Gói cài đặt **không kèm mức phí** (để tránh báo sai). Muốn ứng dụng báo phí qua trạm, đơn vị vận hành tạo tệp
`C:\HawaMapData\phi-cao-toc.json` theo biểu phí chính thức của từng trạm. Cách ghi từng trạm có trong tệp mẫu
`public\du-lieu\phi-cao-toc.json` (mục `ghiChu`) và trong README (mục "Chức năng", đoạn "Mức phí trạm thu phí"). Lưu bằng
Notepad thì chọn **Encoding: UTF-8**. Không cần khởi động lại; điện thoại tự tải bảng phí mới trong vòng một tuần.

### Xem nhật ký khi có lỗi

- Nhật ký máy chủ HawaMap: `C:\inetpub\hawamap\logs` (các tệp `node_*.log`).
- Lỗi khởi động: **Event Viewer** → **Windows Logs** → **Application**.

### Gỡ cài đặt

Bấm **Start**, gõ `powershell`, chuột phải **Windows PowerShell** → **Run as administrator**, rồi chạy (thay đường dẫn
thư mục bộ cài cho đúng):

```powershell
powershell -ExecutionPolicy Bypass -File C:\hawamap-may-chu-1.2.2\trien-khai\iis\go-cai-dat-iis.ps1
```

Lệnh này xoá site, app pool và luật tường lửa của HawaMap; giữ lại `C:\inetpub\hawamap` và `C:\HawaMapData` (xoá tay nếu
không cần nữa).

## 11. Gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Nhấp đúp `CAI-DAT-MAY-CHU.bat`, cửa sổ hiện rồi tắt ngay | Chuột phải tệp → **Run as administrator**. Kiểm tra đã **Extract All** (không chạy thẳng bên trong tệp zip) |
| `[LOI] Thieu thu muc trien-khai` | Đang chạy bên trong tệp zip: giải nén trước (bước 5) |
| Không tự cài được Node.js | Máy chủ không vào được `nodejs.org`: trên máy của bạn tải bản LTS **Windows Installer (.msi)** 64-bit tại `https://nodejs.org`, copy sang máy chủ, cài, rồi nhấn Enter trong cửa sổ cài đặt |
| Không mở được trang tải module | Tắt IE Enhanced Security Configuration (xem cuối bước 6) hoặc tải trên máy của bạn rồi copy sang |
| Trang báo `HTTP Error 500.19` | Thiếu URL Rewrite hoặc HttpPlatformHandler: cài bản x64 rồi chạy lại trình cài đặt |
| Trang báo `HTTP Error 502.3` hoặc `502.5` | Máy chủ HawaMap không khởi động được: xem `C:\inetpub\hawamap\logs`. Muốn thấy lỗi trực tiếp: mở `cmd`, gõ `cd /d C:\inetpub\hawamap` rồi `node server.js` (nhấn `Ctrl + C` để dừng) |
| Bảng tóm tắt báo site chưa chạy được, cổng 80 đang bị dùng | Không có tên miền thì dừng **Default Web Site** (trình cài hỏi ở bước 4). Phần mềm khác chiếm cổng: chạy `netstat -ano` trong `cmd` để tìm |
| Vào bằng IP thấy trang chào mừng của IIS | Bình thường khi đã cài với tên miền: hãy vào bằng tên miền |
| Trên máy chủ mở được, máy khác hoặc điện thoại không mở được | Tường lửa của nhà cung cấp (bước 3); bản ghi A chưa đúng hoặc chưa có hiệu lực (bước 4, `nslookup`) |
| win-acme báo lỗi xác minh | Bản ghi A, cổng 80 từ Internet vào, Cloudflare đang bật proxy (xem bước 8) |
| Điện thoại không lấy được vị trí | Phải mở bằng `https://`; cho phép quyền vị trí cho trình duyệt trong cài đặt điện thoại |
| Không thấy camera, biển báo, trạm thu phí | Lần đầu mỗi khu vực mất ít phút để tải; máy chủ phải ra được `overpass-api.de`; xem `/api/giao-thong/trang-thai`. Độ đầy đủ tuỳ dữ liệu OpenStreetMap từng khu vực |
| Báo cáo giao thông không lưu được | Thiếu quyền ghi `C:\HawaMapData`: chạy lại trình cài đặt (cấp lại quyền) |
| Muốn đổi sang tên miền khác | Trỏ tên miền mới (bước 4), chạy lại trình cài đặt và nhập tên miền mới, rồi xin chứng chỉ cho tên miền mới (bước 8) |

## 12. Phụ lục

### Phụ lục A: Tạo gói cài đặt từ mã nguồn

Trên máy có mã nguồn và Node.js 18 trở lên, trong thư mục `BanDoDanDuong`:

```
npm test
npm run dong-goi
```

Kết quả: thư mục `dist/hawamap-may-chu/` và tệp `dist/hawamap-may-chu-<phiên bản>.zip` (phiên bản lấy từ `package.json`).
Gói chỉ gồm những gì máy chủ cần: `server.js`, `kho-giao-thong.js`, thư mục `public`, `trien-khai`, trình cài
`CAI-DAT-MAY-CHU.bat`, hướng dẫn `HUONG-DAN-CAI-DAT.html` (tạo từ tệp này) — không có kiểm thử và mã ứng dụng Android / iOS.

### Phụ lục B: Tuỳ chọn nâng cao

Trình cài nhấp đúp gọi script `trien-khai\iis\cai-dat-iis.ps1`. Người đã quen có thể chạy thẳng script này trong
PowerShell **Run as administrator** (đứng trong thư mục bộ cài) để chọn thêm tuỳ chọn:

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `-TenMien` | (trống) | tên miền của site |
| `-ThuMuc` | `C:\inetpub\hawamap` | nơi đặt ứng dụng |
| `-ThuMucDuLieu` | `C:\HawaMapData` | nơi lưu dữ liệu (báo cáo, dữ liệu giao thông, bảng phí) |
| `-CongHttp` / `-CongHttps` | `80` / `443` | cổng của site |
| `-VanTayChungChi` | (trống) | vân tay (thumbprint) chứng chỉ HTTPS đã nhập vào máy |
| `-CheDo` | `HttpPlatform` | `Proxy`: Node chạy nền riêng, IIS chuyển tiếp bằng URL Rewrite + ARR 3.0 |
| `-CongNode` | `8080` | cổng nội bộ của Node ở chế độ `Proxy` |
| `-TenSite` | `HawaMap` | tên site và app pool trong IIS |

Dùng chứng chỉ đã mua (tệp `.pfx`): nhấp đúp tệp → chọn **Local Machine** → để Windows tự chọn kho (hoặc chọn **Personal**)
→ xong. Lấy vân tay rồi chạy lại script:

```powershell
Get-ChildItem Cert:\LocalMachine\My | Format-List Subject, Thumbprint, NotAfter
powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\cai-dat-iis.ps1 -TenMien bando.congty.vn -VanTayChungChi <Thumbprint>
```

Chạy thử trên một máy tính bất kỳ, không cần IIS: nhấp đúp `ChayBanDo.bat` (cần Node.js) rồi mở `http://localhost:8080`.

### Phụ lục C: Máy chủ Linux

HawaMap chạy được ở mọi nơi có Node.js 18 trở lên (không cần cài thư viện). Trên Ubuntu / Debian, chép thư mục gói cài
đặt vào `/opt/hawamap`, chạy máy chủ như một dịch vụ systemd và dùng Caddy làm reverse proxy (Caddy tự xin và gia hạn
chứng chỉ HTTPS). Tệp `/etc/systemd/system/hawamap.service`:

```ini
[Unit]
Description=HawaMap
After=network-online.target
Wants=network-online.target

[Service]
Environment=PORT=8080 HOST=127.0.0.1 BANDO_DULIEU=/var/lib/hawamap NODE_ENV=production
ExecStart=/usr/bin/node /opt/hawamap/server.js
Restart=always
DynamicUser=yes
StateDirectory=hawamap

[Install]
WantedBy=multi-user.target
```

Tệp `/etc/caddy/Caddyfile`:

```
bando.congty.vn {
	reverse_proxy 127.0.0.1:8080
}
```

Rồi chạy `sudo systemctl enable --now hawamap` và `sudo systemctl reload caddy`. Mở cổng 80, 443 như bước 3 và trỏ tên
miền như bước 4.
