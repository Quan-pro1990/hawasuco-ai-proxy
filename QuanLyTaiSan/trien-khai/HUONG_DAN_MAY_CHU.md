# Hướng dẫn dựng máy chủ Quản lý tài sản cho người mới

Làm xong hướng dẫn này, phần mềm **Quản lý tài sản** chạy trên máy chủ của công ty tại `https://<tên-miền-của-bạn>`:
máy tính và điện thoại mở bằng trình duyệt, quét tem QR xem thông tin và ảnh tài sản, kiểm kê, điều chuyển; dữ liệu
nằm trên máy chủ, tự sao lưu mỗi ngày; máy chủ tự chạy lại khi máy khởi động.

Cách dựng **giống hệt máy chủ bản đồ HawaMap**: cùng IIS, cùng hai module URL Rewrite và HttpPlatformHandler, cùng trình
cài nhấp đúp `CAI-DAT-MAY-CHU.bat`, cùng cách bật HTTPS miễn phí bằng win-acme. Máy chủ đã chạy HawaMap thì cài thêm Quản
lý tài sản lên chính máy đó, chỉ cần một tên miền khác (bước 4).

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
9. [Bắt đầu dùng phần mềm](#9-bắt-đầu-dùng-phần-mềm)
10. [Dùng trên điện thoại](#10-dùng-trên-điện-thoại)
11. [Vận hành hằng ngày](#11-vận-hành-hằng-ngày)
12. [Gặp lỗi](#12-gặp-lỗi)
13. [Phụ lục](#13-phụ-lục)

## 1. Chuẩn bị

### Máy chủ

Một máy Windows chạy suốt ngày đêm. Có thể là:

- **Máy chủ đang chạy HawaMap** hoặc phần mềm Thất thoát nước — dùng chung được, không ảnh hưởng nhau;
- một **VPS Windows** thuê của nhà cung cấp (chọn gói Windows Server có IP công khai; nhà cung cấp gửi **địa chỉ IP**,
  **tên đăng nhập** — thường là `Administrator` — và **mật khẩu**);
- máy chủ đặt tại công ty: cần IP tĩnh của nhà mạng và mở cổng (NAT / port forwarding) 80, 443 trên modem về máy đó.

| Thành phần | Tối thiểu | Nên dùng |
|---|---|---|
| Hệ điều hành | Windows Server 2016 | Windows Server 2022 hoặc 2019 |
| CPU | 1 nhân | 2 nhân |
| RAM | 2 GB | 4 GB |
| Ổ đĩa còn trống | 10 GB | 40 GB (ảnh tài sản khoảng 0,3 MB / ảnh; 10.000 ảnh ≈ 3 GB) |
| Mạng | IP công khai cố định, mở được cổng 80 và 443 | như tối thiểu |

Phần mềm nhẹ: một tệp chương trình `QuanLyTaiSan.exe` (khoảng 1,5 MB) chạy trên .NET Framework có sẵn trong Windows,
không cần cơ sở dữ liệu riêng.

### Tên miền

Cần tên miền để bật HTTPS thật: điện thoại chỉ cho trang web mở **camera quét QR** và lấy GPS khi chạy HTTPS. Cách dễ nhất
là dùng **tên miền con** của tên miền công ty, ví dụ `taisan.congty.vn` — không tốn tiền, chỉ cần người quản lý tên miền
thêm một bản ghi (bước 4). Máy chủ đã có HawaMap ở `bando.congty.vn` thì thêm `taisan.congty.vn` trỏ cùng IP.

Chưa có tên miền vẫn cài và dùng được bằng địa chỉ IP với chứng chỉ tự ký (trình duyệt cảnh báo lần đầu) — xem
[Phụ lục C](#phụ-lục-c-chưa-có-tên-miền-dùng-ip-và-chứng-chỉ-tự-ký).

Trong hướng dẫn này lấy ví dụ tên miền `taisan.congty.vn` và IP máy chủ `203.0.113.10`; thay bằng của bạn.

### Gói cài đặt

Tệp `quanlytaisan-may-chu-<phiên bản>.zip` (khoảng 1 MB). Nhận từ người phát triển, hoặc tự tạo từ mã nguồn (xem
[Phụ lục A](#phụ-lục-a-tạo-gói-cài-đặt-từ-mã-nguồn)). Trong gói có sẵn hướng dẫn này (`HUONG-DAN-CAI-DAT.html`).

### Máy tính của bạn

Để điều khiển máy chủ từ xa. Windows có sẵn **Remote Desktop Connection**; máy Mac cài ứng dụng **Windows App** (tên cũ:
Microsoft Remote Desktop) từ App Store.

### Vài từ cần biết

| Từ | Nghĩa |
|---|---|
| VPS / máy chủ | Máy tính chạy suốt ngày đêm trong trung tâm dữ liệu (hoặc phòng máy công ty), bạn điều khiển từ xa |
| IP công khai | Địa chỉ số của máy chủ trên Internet, ví dụ `203.0.113.10` |
| Tên miền | Địa chỉ dễ nhớ thay cho IP, ví dụ `taisan.congty.vn` |
| Bản ghi A (DNS) | Dòng cấu hình của tên miền, nghĩa là "tên miền này ở IP này" |
| Remote Desktop | Cách mở màn hình máy chủ ngay trên máy tính của bạn |
| IIS | Phần mềm máy chủ web có sẵn trong Windows |
| URL Rewrite, HttpPlatformHandler | Hai module miễn phí của Microsoft cho IIS (HawaMap cũng dùng); HttpPlatformHandler giúp IIS tự chạy và trông chừng `QuanLyTaiSan.exe` |
| HTTPS / chứng chỉ | Kết nối mã hoá, có hình ổ khoá trên trình duyệt; chứng chỉ Let's Encrypt miễn phí |
| Administrator | Tài khoản quản trị của Windows, có quyền cài phần mềm |
| Tài khoản quản trị phần mềm | Tài khoản đăng nhập vào chính phần mềm Quản lý tài sản (khác tài khoản Windows), toàn quyền: danh mục, tài khoản nhân viên, cài đặt |

## 2. Đăng nhập vào máy chủ

1. Trên máy của bạn: bấm **Start**, gõ `mstsc` rồi nhấn Enter — cửa sổ **Remote Desktop Connection** hiện ra.
2. Ô **Computer**: gõ IP máy chủ, ví dụ `203.0.113.10`, bấm **Connect**.
3. Nhập tên đăng nhập `Administrator` và mật khẩu, bấm **OK**.
4. Hiện câu "The identity of the remote computer cannot be verified": tích **Don't ask me again** rồi bấm **Yes**.
5. Màn hình máy chủ hiện ra trong cửa sổ. Từ đây, mọi việc làm trong cửa sổ này, trừ khi hướng dẫn ghi "trên máy của bạn".

Nên làm ngay: đổi mật khẩu Administrator nếu nhà cung cấp gửi qua email (nhấn `Ctrl + Alt + End` trong cửa sổ Remote
Desktop → **Change a password**), và chạy **Windows Update** cho đủ bản vá.

## 3. Mở cổng 80 và 443

Người dùng vào trang web qua cổng **80** (http) và **443** (https). Có hai lớp tường lửa:

- **Tường lửa Windows** trên máy chủ: trình cài đặt tự mở, không cần làm gì.
- **Tường lửa của nhà cung cấp** (thường gọi là Firewall, Security Group, Network Security Group trong trang quản lý
  VPS) hoặc **modem / router** của công ty: thêm hai luật cho phép kết nối vào (Inbound) qua TCP cổng `80` và `443` từ mọi
  nơi (`0.0.0.0/0`); máy chủ ở công ty thì chuyển (NAT) hai cổng này về IP nội bộ của máy chủ. Giữ luật cổng `3389`
  (Remote Desktop), tốt nhất chỉ cho phép từ IP của bạn.

Máy chủ đã chạy HawaMap thì hai cổng này đã mở sẵn.

## 4. Trỏ tên miền về máy chủ

Làm trên máy của bạn, ở trang quản lý tên miền (nơi mua tên miền, hoặc nhờ người quản lý tên miền công ty):

1. Đăng nhập, mở mục **Quản lý DNS** (DNS records, Zone editor…).
2. Thêm một bản ghi như bảng dưới.
3. Lưu lại. Thường mất 5 – 30 phút để có hiệu lực, đôi khi lâu hơn.

| Loại | Tên (Host) | Giá trị (Value / Points to) | TTL |
|---|---|---|---|
| A | `taisan` | `203.0.113.10` | để mặc định, hoặc 300 |

Kiểm tra: trên máy của bạn bấm **Start**, gõ `cmd`, Enter, rồi gõ `nslookup taisan.congty.vn`. Thấy dòng
`Address: 203.0.113.10` (đúng IP máy chủ) là xong.

> Dùng chung máy chủ với HawaMap: giữ nguyên bản ghi của HawaMap (vd. `bando`), thêm bản ghi `taisan` trỏ **cùng IP**. IIS phân biệt hai trang theo tên miền. Tên miền dùng Cloudflare: để biểu tượng đám mây **màu xám** (DNS only) cho bản ghi này, ít nhất cho tới khi xong bước 8.

## 5. Đưa gói cài đặt lên máy chủ

1. Trên máy của bạn: chuột phải tệp `quanlytaisan-may-chu-<phiên bản>.zip` → **Copy**.
2. Trong cửa sổ Remote Desktop: mở **File Explorer** → **This PC** → ổ **C:** → chuột phải vào chỗ trống → **Paste**.
   (Không dán được thì gửi tệp qua email / Google Drive rồi tải về bằng trình duyệt trên máy chủ.)
3. Tệp tải về từ Internet: chuột phải tệp zip → **Properties** → tích **Unblock** (nếu có) → **OK**. Bước này tránh các
   cảnh báo bảo mật khi chạy trình cài.
4. Chuột phải tệp zip → **Extract All…** → **Extract**. Bạn có thư mục `C:\quanlytaisan-may-chu-<phiên bản>` với các tệp
   `CAI-DAT-MAY-CHU.bat`, `HUONG-DAN-CAI-DAT.html`, `QuanLyTaiSan.exe` và thư mục `trien-khai`.

Thư mục này chỉ là bộ cài: trình cài đặt chép chương trình sang `C:\inetpub\QuanLyTaiSan`. Giữ lại tệp zip để cài lại khi cần.

## 6. Chạy trình cài đặt

Mở thư mục vừa giải nén và **nhấp đúp `CAI-DAT-MAY-CHU.bat`**. Windows có thể hỏi vài câu trước khi chạy:

| Windows hiện | Bấm |
|---|---|
| "Windows protected your PC" | **More info** → **Run anyway** |
| "Open File - Security Warning" | **Run** |
| "Do you want to allow this app to make changes to your device?" | **Yes** |

Cửa sổ cài đặt hiện ra và làm 5 bước. Câu hỏi có gợi ý `(C/k)` thì nhấn Enter là **Có**; gõ `k` rồi Enter là **Không**.
Câu hỏi có giá trị trong `[ngoặc vuông]`: nhấn Enter để dùng giá trị đó.

| Bước | Cửa sổ cài đặt hỏi / báo | Bạn làm |
|---|---|---|
| 1 | `Dang bat IIS, lan dau co the mat vai phut...` | Chờ. Nếu báo cần khởi động lại: khởi động lại máy chủ rồi nhấp đúp `CAI-DAT-MAY-CHU.bat` lần nữa |
| 2 | `.NET Framework 4.x` | Windows Server 2016 trở lên có sẵn — không phải làm gì. Máy cũ hơn: trình duyệt mở trang tải .NET Framework 4.8, cài xong nhấn Enter |
| 3 | `Chua cai URL Rewrite 2.1.` rồi `Cai xong nhan Enter de kiem tra lai` | Trình duyệt mở trang tải. Bấm liên kết bản **x64** (English), chạy tệp `.msi` vừa tải, tích đồng ý, bấm **Install**, **Finish**. Quay lại cửa sổ cài đặt, nhấn Enter |
| 3 | `Chua cai HttpPlatformHandler 1.2.` | Làm giống như trên: tải bản **x64**, cài, quay lại nhấn Enter |
| 4 | `Ten mien` | Gõ tên miền, ví dụ `taisan.congty.vn`, nhấn Enter. Chưa có tên miền: nhấn Enter luôn rồi trả lời thêm câu hỏi về cổng và chứng chỉ tự ký ([Phụ lục C](#phụ-lục-c-chưa-có-tên-miền-dùng-ip-và-chứng-chỉ-tự-ký)) |
| 5 | `Ten dang nhap [admin]` (chỉ hỏi lần đầu) | Tên tài khoản quản trị **của phần mềm**: nhấn Enter để dùng `admin`, hoặc gõ tên khác |
| 5 | `Mat khau (it nhat 6 ky tu...)` và `Nhap lai mat khau` | Gõ mật khẩu (chữ không hiện khi gõ — bình thường), Enter; gõ lại lần nữa. Ghi lại cẩn thận |
| sau | `Dat lich sao luu thu muc du lieu moi ngay luc 23:30? (C/k)` | Nhấn Enter: mỗi đêm chép toàn bộ dữ liệu sang `D:\SaoLuu\QuanLyTaiSan` (máy không có ổ D: thì `C:\SaoLuu\QuanLyTaiSan`) |
| cuối | `Mo http://... ngay bay gio? (C/k)` | Nhấn Enter để mở thử trang |

Máy nào đã có sẵn IIS, URL Rewrite, HttpPlatformHandler (ví dụ máy đã cài HawaMap) thì trình cài bỏ qua các câu tương ứng.

Cài thành công khi thấy chữ **Xong.** màu xanh lá và bảng tóm tắt giống thế này:

```
Xong.
  Trang web      : http://taisan.congty.vn  (HTTPS: https://taisan.congty.vn - chua bat)
  Du lieu        : C:\QuanLyTaiSanData  (taisan.xml, LichSu, Anh, taikhoan.xml; tu sao luu taisan.xml moi ngay trong SaoLuu)
  Nhat ky        : C:\inetpub\QuanLyTaiSan\logs , C:\QuanLyTaiSanData\NhatKy
```

Thấy dòng màu đỏ bắt đầu bằng `[LOI]`: đọc nội dung dòng đó và xem [mục 12](#12-gặp-lỗi). Sửa xong thì nhấp đúp
`CAI-DAT-MAY-CHU.bat` lại — chạy lại bao nhiêu lần cũng được, các câu trả lời cũ được nhớ (chỉ cần nhấn Enter), mật khẩu
quản trị không bị hỏi lại.

Trình cài đã: bật IIS, chép chương trình vào `C:\inetpub\QuanLyTaiSan`, tạo thư mục dữ liệu `C:\QuanLyTaiSanData` (chỉ
quản trị máy và IIS đọc được — trong đó có tài khoản, ảnh tài sản), tạo tài khoản quản trị của phần mềm, tạo site
**QuanLyTaiSan** trong IIS, mở tường lửa Windows và đặt lịch sao lưu. Từ giờ IIS tự chạy phần mềm mỗi khi máy khởi động,
tự bật lại nếu phần mềm gặp lỗi.

> Trình duyệt trên Windows Server không mở được trang tải (Internet Explorer báo chặn nội dung): mở **Server Manager** → **Local Server** → **IE Enhanced Security Configuration** → chọn **Off** cho Administrators; hoặc tải tệp trên máy của bạn rồi copy sang máy chủ như ở bước 5.

## 7. Kiểm tra máy chủ

1. Trên máy chủ, mở trình duyệt vào `http://taisan.congty.vn/api/trang-thai`. Thấy dòng bắt đầu bằng
   `{"ok":true,"ten":"QuanLyTaiSan"` là phần mềm đang chạy.
2. Trên điện thoại, **tắt Wi-Fi** (dùng 4G cho chắc là đi từ Internet vào), mở `http://taisan.congty.vn`. Thấy trang đăng
   nhập Quản lý tài sản có logo công ty là được.
3. Điện thoại không mở được: xem lại tường lửa của nhà cung cấp / modem ([bước 3](#3-mở-cổng-80-và-443)) và bản ghi A
   ([bước 4](#4-trỏ-tên-miền-về-máy-chủ)).

Lúc này trang còn chạy `http://` nên điện thoại chưa mở được camera quét QR trong trang. Bước tiếp theo bật HTTPS.

## 8. Bật HTTPS miễn phí

Dùng **win-acme** để xin chứng chỉ miễn phí của Let's Encrypt (máy đã cài HawaMap thì đã có sẵn `C:\win-acme`, bỏ qua
bước 1, 2). Cần có: tên miền đã trỏ đúng (bước 4) và từ điện thoại mở được `http://taisan.congty.vn` (bước 7).

1. Trên máy chủ, mở trang `https://www.win-acme.com` → **Download** → tải bản **x64** (tệp zip có chữ `x64` trong tên).
2. Giải nén vào thư mục `C:\win-acme`. Để cố định thư mục này: win-acme tự gia hạn chứng chỉ từ đây.
3. Trong `C:\win-acme`: chuột phải `wacs.exe` → **Run as administrator**.
4. Trả lời các câu hỏi (chữ có thể hơi khác tuỳ phiên bản, cứ chọn mặc định):
   gõ `N` (Create certificate, default settings) → chọn site **QuanLyTaiSan** (gõ số đứng trước tên site) → nhấn Enter để
   chọn mọi tên miền của site → nhập email của bạn (Let's Encrypt báo khi có vấn đề) → gõ `y` để đồng ý điều khoản.
5. Thấy thông báo đã tạo chứng chỉ và đã thêm binding https là xong. win-acme tạo sẵn tác vụ tự gia hạn: chứng chỉ có hạn
   90 ngày và được gia hạn tự động trước khi hết hạn.
6. **Nhấp đúp `CAI-DAT-MAY-CHU.bat` lần nữa**, nhấn Enter ở mọi câu hỏi. Trình cài thấy site đã có HTTPS nên bật tự chuyển
   `http://` sang `https://` và mở cổng 443 trên tường lửa Windows. Bảng tóm tắt không còn chữ `chua bat`.
7. Mở `https://taisan.congty.vn` trên điện thoại: có hình ổ khoá cạnh địa chỉ là thành công.

win-acme báo lỗi xác minh (validation): kiểm tra lại bản ghi A, cổng 80 từ Internet vào (bước 3, bước 7) và Cloudflare
(đám mây màu xám). Quản lý tài sản trả được tệp xác minh của Let's Encrypt cho cả hai cách xác minh `http-01` của win-acme
(lưu tệp vào thư mục site, hoặc phục vụ từ bộ nhớ).

Đã mua chứng chỉ của nhà cung cấp khác: xem [Phụ lục B](#phụ-lục-b-tuỳ-chọn-nâng-cao).

## 9. Bắt đầu dùng phần mềm

Trên máy tính, mở `https://taisan.congty.vn`, đăng nhập bằng tài khoản quản trị vừa tạo ở bước 6, rồi:

1. **Cài đặt** → tên công ty, địa danh, người lập biểu, kế toán trưởng, giám đốc (in trên sổ, biên bản kiểm kê, biên bản
   giao nhận). Ô **Địa chỉ in trong mã QR**: gõ `https://taisan.congty.vn` — đây là địa chỉ điện thoại mở khi quét tem;
   **đặt trước khi in tem**.
2. **Danh mục** → kiểm tra loại tài sản, các đội cấp nước và phòng ban (có sẵn danh mục mẫu của ngành nước).
3. **Nhập từ Excel** → đưa sổ tài sản cố định đang dùng vào; hoặc **Thêm tài sản** từng cái.
4. **Tài khoản** → tạo tài khoản cho nhân viên: *Chỉ xem*, *Nhân viên kiểm tra* (quét tem kiểm tra, kiểm kê, báo hỏng),
   *Cán bộ quản lý tài sản* (thêm, sửa, điều chuyển, in tem…); có thể giới hạn tài khoản theo 1 đội / phòng ban.
5. **In tem QR** → in tem dán lên tài sản.

Hướng dẫn sử dụng chi tiết từng chức năng: tệp `HUONG_DAN.md` trong mã nguồn phần mềm.

## 10. Dùng trên điện thoại

- **Android (Chrome):** mở `https://taisan.congty.vn` → đăng nhập → menu ba chấm → **Thêm vào màn hình chính** (hoặc
  **Cài đặt ứng dụng**). Lần đầu quét QR, cho phép trình duyệt dùng **camera**.
- **iPhone (Safari):** mở trang → nút **Chia sẻ** → **Thêm vào MH chính**.
- Quét tem bằng nút tròn **Quét QR** ở giữa thanh dưới; hoặc dùng **ứng dụng Camera** có sẵn của điện thoại — tem chứa
  địa chỉ trang tài sản nên mở thẳng trong trình duyệt. Mỗi lần quét (tài khoản Nhân viên kiểm tra trở lên) là ghi nhận
  tài sản đã kiểm kê năm nay.
- Điện thoại cần vào được Internet (4G hoặc Wi-Fi). Máy chủ đặt trong mạng nội bộ công ty mà không mở ra Internet thì điện
  thoại phải nối Wi-Fi công ty.

## 11. Vận hành hằng ngày

### Máy chủ tự làm

- Tự chạy khi máy chủ khởi động lại, tự bật lại khi phần mềm gặp lỗi.
- Mỗi ngày giữ một bản sao `taisan.xml` trong `C:\QuanLyTaiSanData\SaoLuu` (giữ 90 ngày); mỗi đêm sao lưu cả thư mục dữ
  liệu sang ổ khác (nếu đã đồng ý đặt lịch ở bước 6).
- Chứng chỉ HTTPS tự gia hạn (win-acme).

### Cập nhật phiên bản mới

1. Nhận tệp zip mới, giải nén như bước 5.
2. Nhấp đúp `CAI-DAT-MAY-CHU.bat` trong thư mục mới, nhấn Enter ở mọi câu hỏi.

Dữ liệu trong `C:\QuanLyTaiSanData` và tài khoản được giữ nguyên. Máy tính, điện thoại tự nhận bản mới khi mở lại trang.

### Sao lưu

Chỉ cần sao lưu thư mục `C:\QuanLyTaiSanData`:

| Tệp / thư mục | Nội dung |
|---|---|
| `taisan.xml` | danh mục, tài sản, kiểm kê các năm, cài đặt |
| `LichSu\` | lịch sử kiểm tra, bảo dưỡng, điều chuyển (phiếu), kiểm kê — mỗi tháng 1 tệp |
| `Anh\` | ảnh tài sản (mỗi tài sản 1 thư mục) |
| `taikhoan.xml` | tài khoản người dùng (mật khẩu đã băm) |
| `SaoLuu\` | bản sao `taisan.xml` mỗi ngày |
| `cai-dat-may-chu.json` | câu trả lời của trình cài đặt |

Đặt / đổi lịch sao lưu mỗi đêm: nhấp đúp `trien-khai\SAO-LUU-DAT-LICH.bat` (chọn thư mục đích, giờ chạy). Nên chép tiếp thư
mục sao lưu ra nơi khác định kỳ (ổ cứng ngoài, Google Drive…). Khôi phục: cài lại theo bước 5, 6 rồi chép thư mục dữ liệu
về chỗ cũ (dừng site **QuanLyTaiSan** trong IIS Manager trước khi chép, chép xong bật lại).

### Quên mật khẩu quản trị

Nhấp đúp `trien-khai\DAT-LAI-MAT-KHAU-QUAN-TRI.bat` (trong thư mục bộ cài trên máy chủ), nhập tên tài khoản quản trị và mật
khẩu mới. Mật khẩu của nhân viên thì quản trị đặt lại trong trang **Tài khoản** của phần mềm.

### Xem nhật ký khi có lỗi

- Nhật ký phần mềm: `C:\QuanLyTaiSanData\NhatKy` (đăng nhập, thay đổi quan trọng, lỗi) và `C:\QuanLyTaiSanData\loi-khoi-dong.txt`.
- Đầu ra của chương trình: `C:\inetpub\QuanLyTaiSan\logs`.
- Lỗi khởi động của IIS: **Event Viewer** → **Windows Logs** → **Application**.

### Gỡ cài đặt

Nhấp đúp `trien-khai\GO-CAI-DAT.bat`, gõ `Y`. Lệnh này xoá site, app pool và luật tường lửa của Quản lý tài sản; giữ lại
`C:\inetpub\QuanLyTaiSan`, thư mục dữ liệu `C:\QuanLyTaiSanData` và lịch sao lưu (xoá tay nếu không cần nữa).

## 12. Gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Nhấp đúp `CAI-DAT-MAY-CHU.bat`, cửa sổ hiện rồi tắt ngay | Chuột phải tệp → **Run as administrator**. Kiểm tra đã **Extract All** (không chạy thẳng bên trong tệp zip) |
| `[LOI] Thieu thu muc trien-khai` | Đang chạy bên trong tệp zip: giải nén trước (bước 5) |
| Không mở được trang tải module | Tắt IE Enhanced Security Configuration (xem cuối bước 6) hoặc tải trên máy của bạn rồi copy sang |
| `[LOI] Ten mien ... dang gan cho site ...` | Tên miền đã dùng cho trang khác (vd. HawaMap): dùng tên miền khác cho Quản lý tài sản |
| Trang báo `HTTP Error 500.19` | Thiếu URL Rewrite hoặc HttpPlatformHandler: cài bản x64 rồi chạy lại trình cài đặt |
| Trang báo `HTTP Error 502.3` hoặc `502.5` | Phần mềm không khởi động được: xem `C:\QuanLyTaiSanData\loi-khoi-dong.txt` và `C:\inetpub\QuanLyTaiSan\logs`. Thường do thiếu quyền ghi thư mục dữ liệu: chạy lại trình cài đặt (cấp lại quyền) |
| Bảng tóm tắt báo site chưa chạy được, cổng 80 đang bị dùng | Không có tên miền thì dừng **Default Web Site** (trình cài hỏi ở bước 4) hoặc chọn cổng khác. Phần mềm khác chiếm cổng: chạy `netstat -ano` trong `cmd` để tìm |
| Vào bằng IP thấy trang chào mừng của IIS hoặc trang HawaMap | Bình thường khi đã cài với tên miền: hãy vào bằng tên miền |
| Trên máy chủ mở được, máy khác hoặc điện thoại không mở được | Tường lửa của nhà cung cấp / modem (bước 3); bản ghi A chưa đúng hoặc chưa có hiệu lực (bước 4, `nslookup`) |
| win-acme báo lỗi xác minh | Bản ghi A, cổng 80 từ Internet vào, Cloudflare đang bật proxy (xem bước 8) |
| Trang Quét QR báo không mở được camera | Phải mở bằng `https://`; cho phép quyền camera cho trình duyệt trong cài đặt điện thoại. Tạm thời: bấm **Chụp ảnh mã QR**, hoặc quét tem bằng ứng dụng Camera của điện thoại |
| Tem in ra mở sai địa chỉ (localhost, IP cũ…) | **Cài đặt** → **Địa chỉ in trong mã QR** chưa đặt hoặc sai: sửa rồi in lại tem (tem đã dán vẫn dùng được nếu địa chỉ cũ còn vào được) |
| Quên mật khẩu quản trị | `trien-khai\DAT-LAI-MAT-KHAU-QUAN-TRI.bat` (mục 11) |
| Muốn đổi sang tên miền khác | Trỏ tên miền mới (bước 4), chạy lại trình cài đặt và nhập tên miền mới, xin chứng chỉ cho tên miền mới (bước 8), sửa **Địa chỉ in trong mã QR** |

## 13. Phụ lục

### Phụ lục A: Tạo gói cài đặt từ mã nguồn

Trên máy Windows có mã nguồn (thư mục `QuanLyTaiSan`): nhấp đúp `build.bat`. Trình biên dịch C# có sẵn trong Windows
(.NET Framework 4) tạo `QuanLyTaiSan.exe`, rồi đóng gói thành thư mục `dist\quanlytaisan-may-chu` và tệp
`dist\quanlytaisan-may-chu-<phiên bản>.zip`. Không cần cài Visual Studio.

Trên Linux / macOS (để phát triển): `./build.sh` (cần Mono và Node.js 18+); lệnh này tạo lại cả `HUONG-DAN-CAI-DAT.html`
từ tệp hướng dẫn này.

Gói gồm: `CAI-DAT-MAY-CHU.bat`, `HUONG-DAN-CAI-DAT.html`, `QuanLyTaiSan.exe` (giao diện web nhúng sẵn bên trong) và thư
mục `trien-khai` (script cài IIS, tiện ích đặt lại mật khẩu, sao lưu, gỡ cài đặt). Thư mục mã nguồn có cùng bố cục, nên
nhấp đúp `CAI-DAT-MAY-CHU.bat` ngay trong thư mục mã nguồn (sau khi build) cũng cài được.

### Phụ lục B: Tuỳ chọn nâng cao

Trình cài nhấp đúp gọi script `trien-khai\iis\cai-dat-iis.ps1`. Người đã quen có thể chạy thẳng script này trong
PowerShell **Run as administrator** (đứng trong thư mục bộ cài) để chọn thêm tuỳ chọn:

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `-TenMien` | (trống) | tên miền của site |
| `-ThuMuc` | `C:\inetpub\QuanLyTaiSan` | nơi đặt chương trình |
| `-ThuMucDuLieu` | `C:\QuanLyTaiSanData` | nơi lưu dữ liệu (tài sản, ảnh, lịch sử, tài khoản) |
| `-CongHttp` / `-CongHttps` | `80` / `443` | cổng của site |
| `-VanTayChungChi` | (trống) | vân tay (thumbprint) chứng chỉ HTTPS đã nhập vào máy |
| `-TuKy` | tắt | chưa có tên miền: tạo chứng chỉ tự ký, gắn vào cổng `-CongHttps` |
| `-TenSite` | `QuanLyTaiSan` | tên site và app pool trong IIS |

Dùng chứng chỉ đã mua (tệp `.pfx`): nhấp đúp tệp → chọn **Local Machine** → để Windows tự chọn kho (hoặc chọn **Personal**)
→ xong. Lấy vân tay rồi chạy lại script:

```powershell
Get-ChildItem Cert:\LocalMachine\My | Format-List Subject, Thumbprint, NotAfter
powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\cai-dat-iis.ps1 -TenMien taisan.congty.vn -VanTayChungChi <Thumbprint>
```

Chạy thử trên một máy tính bất kỳ, không cần IIS: nhấp đúp `QuanLyTaiSan.exe` → trình duyệt mở `http://localhost:18090`
(dữ liệu nằm trong thư mục `DuLieu` cạnh tệp `.exe`).

### Phụ lục C: Chưa có tên miền: dùng IP và chứng chỉ tự ký

Ở bước 4 của trình cài, để trống tên miền. Trình cài hỏi thêm:

| Cửa sổ cài đặt hỏi | Bạn làm |
|---|---|
| `Dung site "Default Web Site" de nhuong cong 80 ...? (C/k)` | Nhấn Enter (trang chào mừng mặc định của IIS không cần nữa) |
| `Cong http cho Quan ly tai san [80]` | Nhấn Enter. Cổng 80 đã dùng cho trang khác (vd. HawaMap chưa có tên miền) thì trình cài gợi ý `8080` |
| `Tao chung chi tu ky de dung https://<IP may chu>? (C/k)` | Nhấn Enter: có HTTPS để điện thoại mở được camera quét QR |
| `Cong https [443]` | Nhấn Enter (cổng 443 đã dùng thì trình cài gợi ý `8443`) |

Người dùng vào bằng `https://203.0.113.10` (thêm `:8443` nếu dùng cổng khác). Lần đầu trình duyệt báo "Kết nối không riêng
tư" vì chứng chỉ tự ký: bấm **Nâng cao** → **Tiếp tục truy cập** (iPhone: **Hiển thị chi tiết** → **truy cập trang web
này**). Bảng tóm tắt cuối trình cài in **mã nhận dạng** chứng chỉ: bấm biểu tượng cảnh báo trên thanh địa chỉ → xem chứng
chỉ để so (khác mã thì đừng đăng nhập — có thể bị chặn giữa đường). Nhớ mở cổng http / https đã chọn ở tường lửa nhà cung
cấp / modem (bước 3) và đặt **Địa chỉ in trong mã QR** = `https://203.0.113.10` (bước 9).

Khi có tên miền: tạo bản ghi A, chạy lại `CAI-DAT-MAY-CHU.bat`, nhập tên miền, rồi bật HTTPS (bước 8). Tem đã in theo IP
vẫn dùng được nếu còn giữ IP đó; in tem mới theo tên miền cho chắc.

### Phụ lục D: Dùng chung máy chủ với HawaMap và phần mềm Thất thoát nước

- **HawaMap** (site `HawaMap`, cổng 80 / 443 với tên miền riêng) và **Quản lý tài sản** (site `QuanLyTaiSan`) chạy cạnh
  nhau, cùng dùng URL Rewrite và HttpPlatformHandler; IIS chọn trang theo tên miền. Mỗi phần mềm một thư mục dữ liệu
  (`C:\HawaMapData`, `C:\QuanLyTaiSanData`), cài / cập nhật / gỡ riêng.
- Cả hai đều chưa có tên miền: chỉ một trang được giữ cổng 80 — trình cài Quản lý tài sản tự gợi ý cổng `8080`.
- **Thất thoát nước** (site HTTPS cổng 8080 của gói `CaiDat-IIS.bat`): trình cài Quản lý tài sản kiểm tra cổng trước khi
  dùng — cổng nào đã có trang khác hoặc chương trình khác dùng thì báo và gợi ý cổng trống, không đụng site Thất thoát nước.

### Phụ lục E: Nâng cấp từ gói cài cũ (QuanLyTaiSan-GoiCaiDat-IIS)

Máy đã cài bằng gói cũ (`CaiDat-IIS.bat`, HTTPS cổng 8080, cần ASP.NET Core Hosting Bundle): chỉ cần giải nén gói mới và
nhấp đúp `CAI-DAT-MAY-CHU.bat`. Trình cài dùng lại site **QuanLyTaiSan**, thư mục chương trình, thư mục dữ liệu và chứng chỉ
tự ký cũ, chuyển sang chạy bằng HttpPlatformHandler như HawaMap. Không có tên miền thì nhấn Enter ở câu hỏi cổng https để
giữ cổng 8080 cũ — địa chỉ và tem đã in vẫn dùng được. ASP.NET Core Hosting Bundle không cần nữa (gỡ hay giữ đều được).

Gói cũ cài thành **ứng dụng con** (vd. `https://<máy chủ>:8080/taisan/` dưới site Thất thoát nước): trình cài gỡ ứng dụng con
đó và tạo site riêng (bảng tóm tắt in địa chỉ mới). Sửa **Cài đặt → Địa chỉ in trong mã QR** theo địa chỉ mới và in lại tem
đã dán theo địa chỉ cũ.
