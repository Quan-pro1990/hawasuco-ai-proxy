# IT Toolkit — Bộ công cụ kỹ thuật viên

Phần mềm Windows (giao diện tiếng Việt, sáng / tối) gom các việc kỹ thuật hay làm: kiểm tra cấu hình, tạo USB cài Win,
driver, sao lưu, cài Office, bản quyền, sửa lỗi Windows, BitLocker, **sửa lỗi máy in & chia sẻ LAN**, cài phần mềm.

- Không cần cài đặt: 1 tệp `ITToolkit.exe`, chép USB mang đi được. Máy cần Windows 10 / 11 (.NET Framework 4.8 có sẵn).
- Tự xin quyền Administrator khi mở (UAC).
- Chỉ dùng công cụ có sẵn của Windows (registry, `sc`, `netsh`, `dism`, `pnputil`, PowerShell...) và nguồn tải chính hãng
  (Microsoft, winget). Mọi lệnh đã chạy hiện ở ô **Nhật ký** phía dưới và được lưu vào `C:\ProgramData\ITToolkit\NhatKy\`.
- Các tác vụ chạy nền, song song (góc trên hiện "Đang chạy N tác vụ"), giao diện không bị treo.

## Tải về & chạy

Gói `ITToolkit_1.0.0.zip` có sẵn `ITToolkit.exe` đã biên dịch: giải nén, nhấp đúp `ITToolkit.exe` (xem `DOC_TRUOC.txt`).
Tệp chưa ký số nên Windows SmartScreen có thể hỏi: *More info → Run anyway* (hoặc *Unblock* tệp .zip trước khi giải nén).

Tự biên dịch lại: chạy `build.bat` (nhấp đúp) trên máy Windows → được `ITToolkit.exe` cạnh tệp `build.bat`
(trong gói: thư mục `MaNguon`). Dùng trình biên dịch C# có sẵn của Windows (`csc.exe` trong .NET Framework 4), không cần Visual Studio.

## Các trang chức năng

| Trang | Chức năng |
|---|---|
| **Kiểm tra cấu hình** | Windows (bản, build, ngày cài), hãng / model, mainboard, BIOS, UEFI / Legacy, Secure Boot, TPM, pin; CPU, từng thanh RAM (DDR, MHz); ổ cứng SSD / HDD / NVMe + sức khỏe, dung lượng trống từng ổ; card màn hình; card mạng (IP, MAC, gateway, DNS). Sao chép / lưu .txt, báo cáo pin laptop, kiểm tra RAM, chkdsk. |
| **Tạo USB cài Windows** | Chọn USB + ISO → xóa, định dạng FAT32 (MBR chạy cả UEFI và Legacy, hoặc GPT), chép bộ cài, tự chia `install.wim` > 4 GB, ghi boot code Legacy. Tạo `autounattend.xml`: tài khoản cục bộ, bỏ tài khoản Microsoft, múi giờ Việt Nam, tùy chọn bỏ kiểm tra TPM / Secure Boot / RAM. Chỉ nhận ổ USB, không nhận ổ đang chứa Windows, phải gõ `XOA` để xác nhận. |
| **Driver - Thiết bị** | Liệt kê thiết bị thiếu driver / báo lỗi (mã lỗi Device Manager), tìm driver theo Hardware ID trên Microsoft Update Catalog. Sao lưu toàn bộ driver (`pnputil /export-driver`), cài lại cả thư mục driver 1 lần. Liên kết trang driver chính hãng. |
| **Sao lưu - Phục hồi** | Tạo điểm khôi phục (tự bật System Protection), mở System Restore. Sao lưu / phục hồi dữ liệu người dùng (Desktop, Documents, Downloads, trình duyệt Chrome / Edge / Cốc Cốc / Firefox, Zalo PC, Outlook...) bằng `robocopy`. Sao lưu / phục hồi Wi-Fi kèm mật khẩu. |
| **Ghost - Acronis** | Sao lưu / bung tệp **.gho** bằng Ghost qua WinPE tự dựng (không cần USB), kiểm tra tệp .gho, Ghost Explorer. Mở / bung tệp **.tib / .tibx** bằng Acronis True Image. Khởi động 1 lần vào WinPE cứu hộ của bạn (.wim / .iso). Xem mục bên dưới. |
| **Cài đặt Office** | Office Deployment Tool chính hãng của Microsoft: Microsoft 365, Office LTSC 2024 / 2021 / 2019, Home 2024; chọn 32/64-bit, tiếng Việt / Anh, chọn ứng dụng; cài ngay, tải bộ cài offline (kèm `CaiDat.cmd`), gỡ sạch Office. |
| **Bản quyền - Gỡ crack** | Trạng thái kích hoạt Windows & Office (kênh Retail / OEM / Volume, 5 ký tự cuối key, máy chủ KMS). Nhập key Windows / Office hợp lệ và kích hoạt online. **Gỡ crack**: quét và gỡ dấu vết KMSpico, KMSAuto, AAct, KMS_VL_ALL... (tác vụ hẹn giờ, dịch vụ, thư mục, hook SppExtComObj, loại trừ Defender, máy chủ KMS lạ). |
| **Tiện ích - Sửa lỗi Win** | DISM / SFC, reset Windows Update, sửa Microsoft Store, chkdsk, đồng bộ giờ, .NET 3.5; dọn Temp / thùng rác / WinSxS; flush DNS, xin lại IP, reset Winsock, đặt DNS; hiện đuôi tệp, tệp ẩn, This PC, menu chuột phải kiểu cũ Win 11, tắt Fast Startup, nguồn hiệu suất cao; mở nhanh 16 công cụ hệ thống. |
| **BitLocker - EFS** | Trạng thái mã hóa từng ổ; xem / lưu khóa khôi phục; tắt BitLocker (giải mã), tạm dừng / bật lại; mở khóa ổ bằng khóa khôi phục; chặn Windows tự mã hóa ổ. Tìm và giải mã tệp EFS. |
| **Máy in - Chia sẻ LAN** | 5 tab, xem bên dưới. |
| **Kho phần mềm** | Tích chọn rồi cài im lặng hàng loạt bằng winget (Chrome, Cốc Cốc, Foxit, 7-Zip, UltraViewer, AnyDesk, Zoom, VLC, VC++ Runtime, CPU-Z, CrystalDiskInfo, Rufus, Ventoy...), cập nhật tất cả phần mềm, tìm ID phần mềm. Liên kết tải ISO Windows, ODT, Zalo, UniKey. |

### Máy in - Chia sẻ LAN

1. **Fix máy in mạng LAN** — Bảng máy in & cổng (port), trạng thái, chia sẻ, mặc định.
   Nút: đặt mặc định, chia sẻ / ngừng chia sẻ, **thêm máy in qua Local Port** (cách vượt lỗi 0x11b / 0x709 / 0x7c),
   kết nối máy in mạng, in trang thử, mở hàng đợi, xóa sạch máy in (kèm driver, cổng).
   Bên phải: tích mã lỗi theo cột **Máy trạm / Máy chủ / Cả 2 máy** rồi bấm *Sửa các mã lỗi đã chọn*
   (rê chuột lên mã lỗi để xem nguyên nhân và các bước). Thêm: Fix Spooler, cài lại Print to PDF, sửa lỗi đặt mặc định 0x709,
   fix không cài được driver, sao lưu / phục hồi máy in & driver (PrintBrm), *One Click* sửa tất cả, **Khôi phục bảo mật mặc định**.
2. **Windows Credentials** — Lưu tài khoản đăng nhập máy chủ (cho cả tên máy và IP) để máy trạm tự đăng nhập khi in / mở thư mục chia sẻ.
3. **Tạo user chia sẻ - LAN** — Tạo tài khoản cục bộ (mật khẩu không hết hạn, ẩn khỏi màn hình đăng nhập), đặt lại mật khẩu, khóa, xóa.
4. **Fix chia sẻ dữ liệu** — Lỗi chia theo **máy chủ** và **máy trạm**, mỗi lỗi có hình mô phỏng đúng hộp thoại Windows để nhận ra;
   bấm vào để xem nguyên nhân, các bước sẽ làm, rồi *Sửa lỗi này ngay*. Công cụ chung: chia sẻ thư mục & cấp quyền (Share + NTFS),
   xem thư mục đang chia sẻ, đổi tên máy / Workgroup, bật Network Discovery, reset ngăn xếp mạng, khôi phục bảo mật chia sẻ,
   xem SID máy và **đổi SID bằng Sysprep** (cho các máy nhân bản Ghost / clone trùng SID — Windows 11 24H2 / 25H2 cập nhật từ cuối 2025
   có thể từ chối đăng nhập chia sẻ giữa các máy này).
5. **Sửa lỗi Scan** — Tạo thư mục nhận scan (Scan to Folder), sửa lỗi máy photocopy không quét vào thư mục được, bật / tắt SMB 1.0
   cho máy đời cũ, khởi động lại dịch vụ WIA, cài Windows Fax and Scan.

#### Mã lỗi máy in

| Mã lỗi | Chạy ở | Phần mềm làm gì |
|---|---|---|
| 0x00000bc4 | Máy trạm | RPC over named pipes (`RpcUseNamedPipeProtocol = 1`), làm mới Spooler |
| 0x00000bcb | Máy trạm | Cho tải driver từ máy chủ (Point and Print), named pipes, Spooler |
| 0x0000007c | Máy trạm | Point and Print, named pipes, Spooler |
| 0x00004005 | Máy trạm | Làm mới Spooler, named pipes, Point and Print |
| Policy In Effect | Máy trạm | Point and Print, Spooler |
| 0x0000011b | Máy chủ | `RpcAuthnLevelPrivacyEnabled = 0`, nhận RPC qua TCP + named pipes, Spooler |
| 0x000006d9 | Máy chủ | Bật dịch vụ Windows Firewall, mở luật chia sẻ, Spooler |
| 0x00000709 | Cả 2 máy | Tắt "Windows quản lý máy in mặc định", named pipes, RPC, Spooler |
| 0x00000012 | Cả 2 máy | RPC, named pipes, Point and Print, Spooler |

#### Lỗi chia sẻ dữ liệu

| Lỗi | Chạy ở | Phần mềm làm gì |
|---|---|---|
| Limit local account use of blank passwords | Máy chủ | `LimitBlankPasswordUse = 0` |
| You do not have permission to access | Máy chủ | Chia sẻ lại thư mục, cấp quyền Share + NTFS cho Everyone / 1 tài khoản |
| This user can't sign in because this account is currently disabled | Máy chủ | Bật Guest, gỡ Guest khỏi "Deny access to this computer from the network" |
| Máy chủ không hiện trong Network | Máy chủ | Bật dịch vụ chia sẻ, tường lửa, mạng Private, NetBIOS |
| 0x80070044 An extended error has occurred | Máy trạm | Tắt bắt buộc ký SMB, cho phép Guest, khởi động lại Workstation |
| 0x80070035 The network path was not found | Máy trạm | Dịch vụ chia sẻ, tường lửa, mạng Private, NetBIOS, Client for MS Networks |
| 0x800704f8 security policies block unauthenticated guest access | Máy trạm | `AllowInsecureGuestAuth = 1`, tắt bắt buộc ký SMB |
| 0x800704cf The network location cannot be reached | Máy trạm | Client for MS Networks, dịch vụ chia sẻ, NetBIOS |
| 0x80004005 (NAS / máy cũ) | Máy trạm | Bật SMB 1.0 Client (chỉ khi thiết bị không hỗ trợ SMB2) |

> Các bản sửa máy in / chia sẻ là **nới lỏng bảo mật** của Windows (bản vá PrintNightmare, chặn Guest, ký SMB) để máy cũ và máy mới
> nói chuyện được với nhau — chỉ dùng trong mạng nội bộ tin cậy. Nút **Khôi phục bảo mật mặc định** đưa mọi thứ về như cũ.
> Sau khi sửa lỗi chia sẻ nên khởi động lại máy.

### Ghost - Acronis (.gho / .tib)

`.gho` (Symantec / Broadcom Ghost) và `.tib` (Acronis True Image) là định dạng riêng — chỉ chính các phần mềm đó đọc / ghi được,
nên IT Toolkit **điều khiển ghost64.exe / Acronis của bạn** chứ không tự đọc tệp. Phần mềm không kèm sẵn Ghost / Acronis
(có bản quyền): chọn đường dẫn ở thẻ *Công cụ*, hoặc đặt `ghost64.exe` vào thư mục `Tools` cạnh `ITToolkit.exe` để tự nhận.

**Sao lưu / bung .gho (kể cả ổ Windows đang chạy, không cần USB boot):**

1. Chọn phân vùng trong bảng, chọn *Sao lưu* hoặc *Bung*, chọn tệp `.gho` (nằm ở phân vùng **khác**; đường dẫn không dấu,
   không khoảng trắng, vd `D:\Ghost\Win10.gho`). Bung phải gõ `BUNG` để xác nhận.
2. Bấm **Chuẩn bị & khởi động lại vào WinPE**: phần mềm lấy `winre.wim` có sẵn của máy, chép `ghost64.exe` + kịch bản vào,
   tạo mục khởi động ramdisk (bcdedit) và đặt khởi động **1 lần** — lần sau nữa máy tự về Windows.
3. Trong WinPE, kịch bản tìm đúng ổ theo tệp đánh dấu (chữ ổ trong WinPE thường khác Windows) rồi:
   - **Chọn tay (mặc định, an toàn nhất)**: hiện hướng dẫn chọn ổ / phân vùng nào (số đĩa, nhãn, dung lượng) rồi mở Ghost.
   - **Tự động** (tích ô *Tự động chạy lệnh Ghost*): kiểm tra lại số Disk / Partition bằng `diskpart`; khớp thì chạy
     `ghost64 -clone,mode=pdump|pload,...`, không khớp thì quay về chọn tay. Khi bung, Ghost vẫn hỏi xác nhận lần cuối.
4. Xong: sao lưu thì kiểm tra tệp (`-chkimg`); bung vào ổ Windows thì chạy `bcdboot` cập nhật khởi động; xóa tệp đánh dấu,
   xóa mục khởi động, khởi động lại. Khi Ghost báo xong hãy chọn **Continue** (không chọn *Reset Computer*).

Lưu ý:
- WinPE không đọc được ổ đang mã hóa **BitLocker** — phần mềm chặn trước, tắt BitLocker ở trang BitLocker - EFS.
- Máy dùng Intel RST / VMD hoặc RAID mà Windows RE thiếu driver thì WinPE không thấy ổ: kịch bản báo lỗi, cho mở Ghost chọn tay hoặc khởi động lại.
- Cách Ghost đánh số phân vùng có thể khác Windows trên ổ có phân vùng logical / MSR: hãy chạy chế độ **chọn tay** trước trên loại máy đó.
- Cần `ghost64.exe` (WinPE của Windows 64-bit không chạy được `ghost32.exe`). Máy không có Windows RE: dùng *WinPE của bạn*.
- Sau khi xong việc, bấm **Hủy lịch / dọn tệp WinPE** để xóa `C:\ITToolkitPE` (khoảng 1 GB).

**.tib / .tibx (Acronis True Image):** *Mở / bung tệp .tib* mở tệp bằng Acronis đã cài (bung toàn bộ, bung từng tệp, xem nội dung);
khi phục hồi ổ Windows đang chạy, Acronis tự khởi động lại vào môi trường riêng của nó. Máy chưa cài Acronis: tạo WinPE có Acronis
bằng *Acronis Media Builder* (WinPE-based) rồi dùng *Khởi động 1 lần vào WinPE cứu hộ của bạn*.

**WinPE cứu hộ của bạn:** chọn tệp `.wim` (hoặc `.iso` có `sources\boot.wim`: Hiren's BootCD PE, WinPE Acronis...) — máy nạp vào RAM
ở lần khởi động tới mà không cần USB. WinPE chưa ký số Microsoft có thể bị Secure Boot chặn.

## Những thứ cố ý KHÔNG làm

- **Không kích hoạt lậu** (KMS crack, patch...): trang Bản quyền chỉ nhập key hợp lệ và *gỡ* crack — các công cụ crack thường kèm mã độc.
- **Không kèm Ghost / Acronis**: trang Ghost - Acronis dùng bản của bạn (xem ở trên).
- **Không kèm phần mềm reset máy in Epson / Canon bản lậu** (Adjustment Program...). Reset tràn mực thải: mang đến bảo hành
  hoặc dùng công cụ chính hãng của hãng. Nếu bạn có công cụ hợp lệ, thêm vào bằng `phanmem.txt` hoặc tự mở.

## Thêm phần mềm vào Kho phần mềm

Tạo tệp `phanmem.txt` (UTF-8) cạnh `ITToolkit.exe`, mỗi dòng `Nhóm|Tên hiển thị|WingetID`, ví dụ:

```
# dòng bắt đầu bằng # là ghi chú
Liên lạc - họp|Zalo PC|<ID tìm được>
Lập trình|Git|Git.Git
```

Tìm ID bằng ô **Tìm trên winget** ở đầu trang (kết quả hiện trong Nhật ký).

## Tệp phần mềm tạo ra

- `C:\ProgramData\ITToolkit\NhatKy\yyyy-MM-dd.log` — nhật ký mọi thao tác.
- `C:\ProgramData\ITToolkit\Office\` — setup.exe của Office Deployment Tool và tệp cấu hình.
- `C:\ITToolkitPE\` — WinPE tạm cho Ghost / WinPE của bạn (`pe.wim`, `boot.sdi`, bản sao `winre.wim`); xóa bằng nút *Hủy lịch / dọn tệp WinPE*.
- `ITTK_*.txt` ở gốc các ổ — tệp đánh dấu để WinPE nhận đúng ổ, tự xóa khi xong.
- `%AppData%\ITToolkit\caidat.ini` — giao diện sáng / tối, trang mở gần nhất, chiều cao ô nhật ký, đường dẫn Ghost / Acronis.

## Mã nguồn (`src`)

| Tệp | Nội dung |
|---|---|
| `Program.cs` | Khởi động, xin quyền Admin, chỉ cho mở 1 cửa sổ, cài đặt người dùng |
| `MainForm.cs` | Cửa sổ chính: menu trái, thanh tiêu đề (tác vụ đang chạy, đồng hồ, sáng / tối), ô nhật ký |
| `Ui.cs`, `DieuKhien.cs` | Bảng màu sáng / tối, nút bo góc, thẻ, menu, tab, hình mô phỏng hộp lỗi Windows |
| `HeThong.cs` | Chạy lệnh / PowerShell, registry, dịch vụ, WMI, tải tệp, tường lửa |
| `NhatKy.cs` | Nhật ký dùng chung + chạy tác vụ nền song song |
| `SuaLoi.cs` | Danh mục lỗi máy in / chia sẻ LAN và các bước sửa |
| `WinPE.cs` | Dựng WinPE từ Windows RE, mục khởi động ramdisk 1 lần (bcdedit), kịch bản Ghost chạy trong WinPE |
| `TaiKhoan.cs` | Windows Credentials (Credential Manager), tài khoản cục bộ |
| `HopThoai.cs` | Hộp thoại nhập liệu, cửa sổ xem nội dung |
| `Trang*.cs` | Từng trang chức năng |
