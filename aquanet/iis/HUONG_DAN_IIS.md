# Cài AquaNet GIS trên máy chủ Windows (IIS) – hướng dẫn cho người mới

```
 Máy tính (trình duyệt) ─┐
 Điện thoại (/field)    ─┼─ HTTPS cổng 8443 ─> IIS ─> AquaNet (Python) ─> PostgreSQL + PostGIS
 Cổng SCADA, QGIS…      ─┘                     C:\inetpub\AquaNet        CSDL "capnuoc"
                                               C:\AquaNetData: ảnh, nhật ký, sao lưu, cấu hình bí mật
```

Thời gian lần đầu: khoảng 2–3 giờ với máy chủ Windows vừa cài xong (phần lớn là chờ Windows Update và tải phần mềm).

**Thứ tự làm:**

| | Việc | Thời gian |
|---|---|---|
| [Phần 0](#phần-0-máy-chủ-windows-mới-cài--làm-gì-trước-tiên) | Cấu hình Windows: tên máy, IP tĩnh, cập nhật, điều khiển từ xa | 1–2 giờ |
| [Phần 1](#phần-1-cài-phần-mềm-nền-làm-một-lần) | Cài phần mềm nền: chạy **`ChuanBi-MayChu.bat`** (tự cài IIS, Hosting Bundle, PostgreSQL + PostGIS, Python, Node.js) | 20–30 phút |
| [Phần 2](#phần-2-cài-aquanet) | Cài AquaNet: chạy **`CaiDat-IIS.bat`** | 10–15 phút |
| [Phần 3](#phần-3-dùng-thử-và-đưa-vào-sử-dụng) | Đăng nhập, tạo người dùng, nhập dữ liệu | |
| [Phần 4](#phần-4-chứng-chỉ-https-thật-cần-cho-ứng-dụng-hiện-trường) + [Phần 8](#phần-8-hoàn-thiện-máy-chủ--danh-sách-kiểm-tra) | Tên miền, chứng chỉ thật, sao lưu ra ngoài, bảo mật → **máy chủ hoàn chỉnh** | 1 giờ |

Phần 5–7 dùng khi vận hành, khi máy chủ không có internet và khi gặp lỗi.

> Ký hiệu: **cmd quản trị** = bấm Start, gõ `cmd`, chuột phải *Command Prompt* › *Run as administrator*.
> **PowerShell quản trị** tương tự với *Windows PowerShell*.

---

## Phần 0. Máy chủ Windows mới cài – làm gì trước tiên

Làm các việc dưới đây **trước khi cài bất kỳ phần mềm nào**, theo đúng thứ tự. Máy chủ đã chạy ổn định từ trước
(ví dụ đang chạy phần mềm *Quản lý thất thoát nước*) thì chỉ cần xem lại 0.5 rồi sang Phần 1.

### 0.1. Cấu hình máy chủ nên có

| | Tối thiểu | Nên dùng |
|---|---|---|
| Hệ điều hành | Windows Server 2016, 64-bit | **Windows Server 2022 / 2025 Standard** |
| CPU | 4 nhân | 8 nhân |
| RAM | 8 GB | 16 GB (mạng lưới hàng trăm nghìn đối tượng, hoặc chạy chung phần mềm khác) |
| Ổ đĩa | 1 ổ SSD 120 GB | **2 ổ:** `C:` 120 GB cho Windows và phần mềm · `D:` SSD từ 250 GB cho CSDL, ảnh hiện trường, sao lưu |
| Mạng | IP cố định trong mạng nội bộ | IP công cộng tĩnh của nhà mạng (để truy cập từ internet) |
| Điện | | Bộ lưu điện (UPS) |

Máy ảo (Hyper-V, VMware, Proxmox) hay máy chủ thuê (VPS) đều dùng được. Tách ổ `D:` giúp Windows hỏng thì dữ liệu
vẫn còn, và ổ `C:` không bị đầy vì ảnh, sao lưu.

### 0.2. Mật khẩu quản trị và tài khoản dự phòng

1. Đặt mật khẩu **Administrator** mạnh: từ 14 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt.
2. Tạo thêm **một tài khoản quản trị dự phòng** (phòng khi quên mật khẩu hoặc tài khoản bị khóa). Mở
   **PowerShell quản trị**, dán từng dòng:

   ```powershell
   $mk = Read-Host 'Mật khẩu cho tài khoản quanly' -AsSecureString
   New-LocalUser -Name 'quanly' -Password $mk -FullName 'Quản trị dự phòng' -PasswordNeverExpires
   Add-LocalGroupMember -Group 'Administrators' -Member 'quanly'
   ```

3. Ghi cả hai mật khẩu vào sổ máy chủ (xem [8.7](#87-sổ-máy-chủ)), cất nơi an toàn – **không** lưu tệp văn bản
   trên màn hình máy chủ.

### 0.3. Đặt tên máy chủ

Tên mặc định kiểu `WIN-8K2J4...` khó nhớ và **được ghi vào chứng chỉ HTTPS** khi cài AquaNet, nên đổi ngay từ đầu.
PowerShell quản trị (tên tối đa 15 ký tự, không dấu, không khoảng trắng):

```powershell
Rename-Computer -NewName 'HAWASUCO-GIS' -Restart
```

(Hoặc *Server Manager › Local Server* › bấm vào *Computer name* › *Change*.) Máy chủ tự khởi động lại.

### 0.4. Đặt địa chỉ IP tĩnh

Máy chủ phải giữ một IP cố định, nếu không máy khác và router sẽ "mất" máy chủ sau mỗi lần khởi động lại.
Hỏi người quản lý mạng 4 thông số: **IP** (vd `192.168.1.20`), **mặt nạ mạng** (`255.255.255.0` = `/24`),
**cổng mặc định** (vd `192.168.1.1`), **DNS** (vd `192.168.1.1`, `8.8.8.8`).

- **Cách bấm chuột:** `Win + R` › gõ `ncpa.cpl` › Enter › chuột phải card mạng › *Properties* ›
  *Internet Protocol Version 4 (TCP/IPv4)* › *Properties* › *Use the following IP address* › điền 4 thông số › *OK*.
- **Cách PowerShell** (quản trị):

  ```powershell
  Get-NetAdapter     # xem tên card mạng, thường là "Ethernet"
  New-NetIPAddress -InterfaceAlias 'Ethernet' -IPAddress 192.168.1.20 -PrefixLength 24 -DefaultGateway 192.168.1.1
  Set-DnsClientServerAddress -InterfaceAlias 'Ethernet' -ServerAddresses 192.168.1.1, 8.8.8.8
  ```

> Làm bước này **tại màn hình máy chủ** (hoặc bảng điều khiển máy ảo), không qua Remote Desktop – đổi IP sẽ làm
> mất kết nối. Máy chủ thuê (VPS) đã có IP do nhà cung cấp cấp: bỏ qua bước này.

**Kiểm tra:** PowerShell › `ping 8.8.8.8` và `ping github.com` → có trả lời.

### 0.5. Cập nhật Windows

*Settings › Windows Update* (Server 2016/2019: *Settings › Update & Security › Windows Update*) › **Check for updates**
› cài › khởi động lại › **lặp lại đến khi báo "You're up to date"**. Máy mới cài thường phải lặp 2–4 lần
(30–60 phút). Cách khác: gõ `sconfig` trong PowerShell › mục *Install updates* / *Download and Install Updates*.

Cập nhật xong mới cài phần mềm, để bộ cài PostgreSQL, Python… không bị Windows Update khởi động lại giữa chừng.

### 0.6. Bật điều khiển từ xa (Remote Desktop)

Để quản trị máy chủ từ máy tính của mình: *Server Manager › Local Server* › *Remote Desktop: Disabled* › bấm vào ›
**Allow remote connections to this computer** (giữ dấu *Network Level Authentication*) › *OK*. Hoặc PowerShell quản trị:

```powershell
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -Value 0
Enable-NetFirewallRule -Name 'RemoteDesktop-UserMode-In-TCP', 'RemoteDesktop-UserMode-In-UDP'
net accounts /lockoutthreshold:10 /lockoutwindow:15 /lockoutduration:15   # khóa 15 phút nếu đoán sai mật khẩu 10 lần
```

Từ máy tính khác: `Win + R` › `mstsc` › nhập IP máy chủ › đăng nhập *Administrator*.

> ⚠️ **Không bao giờ** mở (NAT) cổng Remote Desktop **3389** ra internet – máy chủ sẽ bị dò mật khẩu liên tục.
> Cần quản trị từ xa ngoài cơ quan thì dùng VPN của router / tường lửa.

### 0.7. Chuẩn bị ổ dữ liệu D:

Máy có ổ đĩa thứ hai còn trống: `Win + R` › `diskmgmt.msc` › Windows hỏi *Initialize Disk* › chọn **GPT** › *OK* ›
chuột phải vùng *Unallocated* › *New Simple Volume* › *Next* › chữ ổ **D** › *NTFS*, đặt tên `DuLieu` › *Finish*.
(Nếu chữ `D:` đang là ổ DVD: chuột phải ổ DVD › *Change Drive Letter and Paths* › đổi sang `E:` trước.)

### 0.8. Trình duyệt trên máy chủ

Windows Server 2022/2025 có sẵn Microsoft Edge. Server 2016/2019 chỉ có Internet Explorer, chặn tải tệp và không mở
được GitHub: tải tệp trên máy tính của mình rồi **chép sang máy chủ** (qua Remote Desktop: sao chép tệp ở máy mình,
dán vào máy chủ; hoặc thư mục chia sẻ, USB), hoặc cài Edge từ <https://www.microsoft.com/edge>.

✅ Xong Phần 0: máy chủ có tên dễ nhớ, IP tĩnh, đã cập nhật, quản trị được từ xa, có ổ `D:` cho dữ liệu.

---

## Phần 1. Cài phần mềm nền (làm một lần)

### Cách nhanh (khuyên dùng): `ChuanBi-MayChu.bat`

Script tự tải và cài tất cả phần mềm nền ở các Bước 2–6 bên dưới, tự bỏ qua phần mềm đã có (chạy lại nhiều lần
được), đặt múi giờ UTC+7, chế độ điện năng hiệu năng cao, cho PostgreSQL tự chạy khi khởi động máy.

1. **Tải mã nguồn AquaNet về máy chủ** – làm [Bước 7](#bước-7-tải-mã-nguồn-aquanet-về-máy-chủ) trước.
2. Mở thư mục `C:\CaiDat\hawasuco-ai-proxy\aquanet\iis`, nhấp đúp **`ChuanBi-MayChu.bat`** › *Yes*.
   - Máy có ổ `D:` (Phần 0.7): mở **cmd quản trị** tại thư mục đó (trong cmd gõ `cd /d C:\CaiDat\hawasuco-ai-proxy\aquanet\iis`)
     và chạy `ChuanBi-MayChu.bat -PgDuLieu D:\PostgreSQL\16\data -DuLieu D:\AquaNetData` để dữ liệu PostgreSQL và
     dữ liệu AquaNet (ảnh, nhật ký, sao lưu) nằm trên ổ `D:`.
3. Script hỏi **mật khẩu cho tài khoản `postgres`** (quản trị CSDL), nhập 2 lần. **Ghi ra giấy** – bộ cài AquaNet
   sẽ hỏi lại. Mật khẩu không được có khoảng trắng hay dấu `"`.
4. Chờ 20–30 phút (tải khoảng 500 MB). Cuối cùng hiện bảng kết quả từng phần mềm:
   - Báo **cần khởi động lại** → gõ `C` để khởi động lại, sau đó sang [Phần 2](#phần-2-cài-aquanet)
     (script in sẵn lệnh cần chạy, kể cả `-DuLieu D:\AquaNetData` nếu đã chọn).
   - Không cần khởi động lại → script hỏi *Cài AquaNet GIS ngay bây giờ?* → gõ `C` để chạy luôn Phần 2.

Tệp tải về được giữ trong `C:\CaiDat\TaiVe` (dùng lại khi chạy lại). Script báo lỗi ở phần nào thì làm tay phần đó
theo các bước dưới đây, rồi chạy lại script.

### Cách làm tay (từng bước)

Dùng khi script báo lỗi một phần, hoặc khi muốn tự cài.

### Bước 1. Kiểm tra máy chủ

- Windows Server 2016 / 2019 / 2022 / 2025, 64-bit (dùng thử được trên Windows 10/11 Pro).
- RAM từ 8 GB, ổ đĩa còn trống từ 30 GB.
- Đăng nhập bằng tài khoản **Administrator**. Đã làm Phần 0.
- Có internet trong lúc cài. Máy chủ không có internet: xem [Phần 6](#phần-6-máy-chủ-không-có-internet).
- Nên tạo thư mục `C:\CaiDat` để chứa các tệp tải về.

### Bước 2. Bật IIS

> Bỏ qua bước này nếu máy chủ đã chạy phần mềm *Quản lý thất thoát nước* (IIS đã có).

Mở **PowerShell quản trị**, dán lệnh sau rồi Enter:

```powershell
Install-WindowsFeature Web-Server -IncludeManagementTools
```

(Windows 10/11: *Control Panel › Programs › Turn Windows features on or off* › đánh dấu
*Internet Information Services* › OK.)

**Kiểm tra:** mở trình duyệt trên máy chủ, vào `http://localhost` → thấy trang chào màu xanh của IIS.

### Bước 3. Cài ASP.NET Core Hosting Bundle

> Bỏ qua nếu đã cài cho phần mềm *Quản lý thất thoát nước*.

1. Vào <https://dotnet.microsoft.com/download/dotnet/8.0>, mục **ASP.NET Core Runtime** › dòng *Windows*
   › bấm **Hosting Bundle** để tải.
2. Chạy tệp vừa tải › *Install* › *Close*.
3. Mở **cmd quản trị**, gõ `iisreset` rồi Enter (hoặc khởi động lại máy chủ).

AquaNet viết bằng Python, không dùng .NET. Hosting Bundle chỉ cung cấp cho IIS một module (ASP.NET Core
Module) để khởi chạy chương trình Python và chuyển yêu cầu của người dùng cho nó.

### Bước 4. Cài PostgreSQL 16 và PostGIS

1. Vào <https://www.enterprisedb.com/downloads/postgres-postgresql-downloads>, dòng **PostgreSQL 16.x**,
   cột *Windows x86-64* › tải về.
2. Chạy tệp cài: *Next* › giữ thư mục mặc định › giữ đủ các thành phần (*PostgreSQL Server, pgAdmin 4,
   Stack Builder, Command Line Tools*) › *Next*.
3. **Đặt mật khẩu cho tài khoản `postgres`.** Ghi ra giấy và cất cẩn thận – bộ cài AquaNet sẽ hỏi mật khẩu này.
4. *Port*: giữ `5432` › *Locale*: *Default locale* › *Next* … › chờ cài xong.
5. Màn hình cuối: đánh dấu **Launch Stack Builder at exit** › *Finish*.
   (Lỡ bỏ qua: Start › *PostgreSQL 16* › *Application Stack Builder*.)
6. Trong Stack Builder:
   - Chọn `PostgreSQL 16 (x64) on port 5432` › *Next*.
   - Mở nhóm **Spatial Extensions** › đánh dấu **PostGIS 3.x Bundle for PostgreSQL 16** › *Next* › *Next* (tải về).
   - Bộ cài PostGIS: *I Agree* › ở màn hình chọn thành phần **bỏ dấu** *Create spatial database* (AquaNet tự tạo)
     › *Next* … Các câu hỏi về biến môi trường (`GDAL_DATA`, `POSTGIS_ENABLE_OUTDB_RASTERS`…) chọn **Yes** › *Close*.

**Kiểm tra:** Start › *pgAdmin 4* › nhập mật khẩu `postgres` › thấy *Servers › PostgreSQL 16*.

### Bước 5. Cài Python 3.12

1. Vào <https://www.python.org/downloads/windows/> › bản **Python 3.12.x** mới nhất › *Windows installer (64-bit)*.
2. Chạy tệp cài:
   - Đánh dấu **Add python.exe to PATH** (ô dưới cùng).
   - Bấm **Customize installation** › *Next*.
   - Ở *Advanced Options* đánh dấu **Install Python 3.12 for all users** › thư mục sẽ là
     `C:\Program Files\Python312` › *Install*.

> ⚠️ Bắt buộc chọn *Install for all users*. IIS chạy AquaNet bằng một tài khoản riêng, tài khoản này không đọc
> được Python cài riêng cho người dùng (trong `C:\Users\...`). Bộ cài sẽ báo lỗi nếu chọn sai.

**Kiểm tra:** mở cmd **mới**, gõ `py -3.12 --version` → hiện `Python 3.12.x`.

### Bước 6. Cài Node.js LTS (để dựng giao diện)

Vào <https://nodejs.org> › tải bản **LTS** (*Windows Installer .msi*) › chạy, giữ mặc định
(không cần đánh dấu *Tools for Native Modules*).

**Kiểm tra:** cmd mới › `node -v` → hiện `v20…` hoặc `v22…`.

### Bước 7. Tải mã nguồn AquaNet về máy chủ

- **Cách 1 (dễ nhất):** trên trang GitHub của dự án, chọn đúng nhánh có thư mục `aquanet`, bấm
  **Code › Download ZIP** (Server 2016/2019: tải trên máy tính của mình rồi chép sang, xem Phần 0.8).
  Chuột phải tệp zip › *Properties* › đánh dấu **Unblock** › *OK* (để Windows không chặn script).
  Giải nén vào `C:\CaiDat`, rồi **đổi tên** thư mục vừa giải nén (tên dài kiểu `hawasuco-ai-proxy-<tên nhánh>`)
  thành `hawasuco-ai-proxy`.
- **Cách 2 (có Git):** `git clone https://github.com/Quan-pro1990/hawasuco-ai-proxy.git C:\CaiDat\hawasuco-ai-proxy`
  (thêm `-b <tên nhánh>` nếu thư mục `aquanet` nằm ở nhánh khác nhánh chính).

**Kiểm tra:** có tệp `C:\CaiDat\hawasuco-ai-proxy\aquanet\iis\CaiDat-IIS.bat`. Đây là thư mục dùng ở Phần 1 (cách
nhanh) và Phần 2.

---

## Phần 2. Cài AquaNet

1. Mở thư mục `C:\CaiDat\hawasuco-ai-proxy\aquanet\iis`, nhấp đúp **CaiDat-IIS.bat** › *Yes* (cho quyền quản trị).
   Máy có ổ `D:`: mở **cmd quản trị** tại thư mục đó, chạy `CaiDat-IIS.bat -DuLieu D:\AquaNetData` để ảnh, nhật ký,
   sao lưu nằm trên ổ `D:` (chỉ cần chỉ ra ở lần cài đầu, các lần cập nhật sau tự nhớ).
2. Cửa sổ đen chạy lần lượt 9 bước. Lần đầu sẽ hỏi:
   - **Mật khẩu tài khoản `postgres`** (đặt khi cài PostgreSQL ở Phần 1). Gõ mật khẩu không hiện chữ là bình thường – gõ xong Enter.
   - **Mật khẩu cho tài khoản quản trị `admin`** của AquaNet (ít nhất 8 ký tự), nhập 2 lần.
3. Chờ 5–15 phút (tải thư viện, dựng giao diện). Đừng tắt cửa sổ.
4. Hiện khung xanh **ĐÃ CÀI XONG** kèm địa chỉ truy cập và *mã nhận dạng chứng chỉ*. Chụp lại màn hình này.

Bộ cài làm những gì (để biết chỗ kiểm tra khi cần):

| Bước | Việc |
|---|---|
| 1 | Kiểm tra IIS, Hosting Bundle, Python, PostgreSQL, cổng 8443 còn trống |
| 2 | Dựng giao diện web (Node.js) |
| 3 | Chép chương trình vào `C:\inetpub\AquaNet` |
| 4 | Tạo môi trường Python riêng, cài thư viện |
| 5 | Tạo app pool `AquaNet`; thư mục dữ liệu `C:\AquaNetData` (chỉ quản trị và app pool đọc/ghi) |
| 6 | Tạo tài khoản CSDL riêng `aquanet` (mật khẩu ngẫu nhiên, không dùng `postgres`), CSDL `capnuoc`, PostGIS, các bảng; tài khoản `admin` |
| 7 | Site IIS `AquaNet`, HTTPS cổng 8443, chứng chỉ tự ký 10 năm |
| 8 | Mở tường lửa Windows cổng 8443; lịch sao lưu 1:30 sáng hằng ngày |
| 9 | Khởi động và gọi thử |

Muốn có **dữ liệu mẫu** để làm quen (mạng lưới, khách hàng, SCADA giả lập): ở lần cài đầu, mở cmd tại thư mục
`iis` và chạy `CaiDat-IIS.bat -DuLieuMau`. Không dùng cho máy chủ thật – dữ liệu là giả và có thêm các tài khoản mẫu
mật khẩu đơn giản (`kythuat`, `hientruong`, `xem`).

---

## Phần 3. Dùng thử và đưa vào sử dụng

1. **Trên máy chủ:** mở Chrome/Edge › `https://localhost:8443`. Trình duyệt báo *Kết nối không riêng tư*
   (do chứng chỉ tự ký) › *Nâng cao* › *Tiếp tục* › đăng nhập `admin`.
2. **Tạo người dùng:** *Quản trị & dữ liệu* › *Người dùng*. Vai trò: *Kỹ thuật* (được sửa mạng lưới),
   *Tổ hiện trường* (ghi chỉ số, báo sự cố, bảo trì), *Chỉ xem*.
3. **Máy khác trong mạng nội bộ:** `https://<tên máy chủ hoặc IP>:8443`.
4. **Từ internet:** nhờ người quản lý mạng chuyển cổng (*port forwarding*) 8443 trên router / tường lửa về máy chủ.
5. **Nhập dữ liệu mạng lưới** từ QGIS (GeoJSON): *Quản trị & dữ liệu › Trao đổi dữ liệu với QGIS* – xem
   `README.md` và `qgis/HUONG_DAN_QGIS.md`.
6. **Điện thoại tổ hiện trường:** `https://<địa chỉ>:8443/field` – đọc Phần 4 để chạy được khi mất sóng.

---

## Phần 4. Chứng chỉ HTTPS thật (cần cho ứng dụng hiện trường)

Chứng chỉ tự ký đủ để dùng trên máy tính (bấm *Tiếp tục*). Nhưng trên điện thoại, trình duyệt **chỉ cho cài ứng
dụng ra màn hình chính, chạy khi mất sóng và lấy vị trí GPS khi chứng chỉ hợp lệ**. Cách lấy chứng chỉ miễn phí
(Let's Encrypt) bằng **win-acme**:

1. Có tên miền, ví dụ `gis.hawasuco.vn`, trỏ bản ghi A về IP công cộng của máy chủ.
2. Cổng **80** từ internet phải tới được máy chủ (win-acme dùng để xác minh tên miền khi cấp và mỗi lần gia hạn).
3. Tải win-acme tại <https://www.win-acme.com>, giải nén vào `C:\win-acme`, chạy `wacs.exe` bằng quyền quản trị.
4. Chọn **M** (*Create certificate, full options*) › *Manual input* › nhập `gis.hawasuco.vn` ›
   cách xác minh: **[http] Serve verification files from memory** › khóa RSA ›
   nơi lưu: **Windows Certificate Store** (Local Computer) ›
   bước cài đặt: **Run a custom script**, Script = `C:\inetpub\AquaNet\GanChungChi.ps1`,
   Parameters = `{CertThumbprint}`.
5. win-acme cấp chứng chỉ, gắn ngay vào cổng 8443 và tự gia hạn trước khi hết hạn (tạo sẵn tác vụ trong
   Task Scheduler). Mở `https://gis.hawasuco.vn:8443` để kiểm tra – không còn cảnh báo.
   Chạy lại `CaiDat-IIS.bat` để cập nhật phiên bản vẫn giữ nguyên chứng chỉ này.

Đã có chứng chỉ thương mại (tệp `.pfx`): nhấp đúp tệp › *Local Machine* › nhập mật khẩu › để mặc định › rồi chạy
`CaiDat-IIS.bat -ChungChi <thumbprint> -TenMien gis.hawasuco.vn`. Xem thumbprint bằng PowerShell:
`Get-ChildItem Cert:\LocalMachine\My | Select-Object Subject, Thumbprint, NotAfter`.

---

## Phần 5. Vận hành hằng ngày

| Việc | Cách làm |
|---|---|
| **Cập nhật phiên bản mới** | Tải mã nguồn mới (Phần 1, Bước 7) › chạy lại `CaiDat-IIS.bat`. Không hỏi lại mật khẩu, không mất dữ liệu; CSDL tự nâng cấp. |
| **Sao lưu** | Tự động 1:30 sáng vào `C:\AquaNetData\SaoLuu` (giữ 30 ngày, kèm ảnh hiện trường). **Nên chép thư mục này sang ổ/máy khác hằng tuần.** Chạy ngay: Task Scheduler › *AquaNet GIS - Sao luu* › *Run*. Nhật ký: `C:\AquaNetData\NhatKy\saoluu.log`. |
| **Khôi phục** | cmd quản trị: `"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -h localhost -U postgres -d capnuoc --clean --if-exists C:\AquaNetData\SaoLuu\capnuoc_<ngày>.dump` |
| **Quên mật khẩu admin** | `CaiDat-IIS.bat -DatMatKhau` |
| **Khởi động lại ứng dụng** | IIS Manager (`inetmgr`) › *Application Pools* › `AquaNet` › *Recycle* |
| **Xem lỗi** | `C:\AquaNetData\NhatKy\aquanet.log`, `loi-khoi-dong.txt`, `NhatKy\stdout_*.log`; hoặc `CaiDat-IIS.bat -KiemTra` |
| **Kết nối SCADA / đồng hồ thông minh** | Khóa API nằm ở dòng `INGEST_API_KEYS` trong `C:\AquaNetData\aquanet.env` (xem README, mục *Kết nối SCADA*). Sửa tệp này xong thì *Recycle* app pool. |
| **QGIS trên máy chủ** | Kết nối PostGIS `localhost:5432`, CSDL `capnuoc`. QGIS ở máy khác: sửa `listen_addresses` trong `postgresql.conf`, thêm dòng mạng nội bộ vào `pg_hba.conf` (thư mục `C:\Program Files\PostgreSQL\16\data`), mở tường lửa cổng 5432 **chỉ cho mạng nội bộ**, khởi động lại dịch vụ PostgreSQL. |
| **Gỡ cài đặt** | `CaiDat-IIS.bat -GoBo` (giữ lại CSDL và `C:\AquaNetData`) |

---

## Phần 6. Máy chủ không có internet

Chuẩn bị trên một máy Windows **có internet**, chép sang máy chủ bằng USB hoặc mạng nội bộ.

1. **Gói AquaNet dựng sẵn:** trên máy có internet, cài cùng phiên bản Python với máy chủ (vd 3.12) và Node.js, tải mã
   nguồn (Phần 1, Bước 7), mở cmd tại thư mục `aquanet\iis`, chạy `CaiDat-IIS.bat -TaoGoi E:\GoiAquaNet` – bộ cài
   dựng giao diện và tải sẵn mọi thư viện Python vào `E:\GoiAquaNet`.
2. **Tệp cài phần mềm nền:** tải về thư mục `E:\TaiVe` (giữ nguyên tên tệp):

   | Phần mềm | Tệp | Nơi tải |
   |---|---|---|
   | ASP.NET Core Hosting Bundle | `dotnet-hosting-8.0.x-win.exe` | <https://dotnet.microsoft.com/download/dotnet/8.0> › *Hosting Bundle* |
   | PostgreSQL 16 | `postgresql-16.x-1-windows-x64.exe` | <https://www.enterprisedb.com/downloads/postgres-postgresql-downloads> |
   | PostGIS | `postgis-bundle-pg16-3.x.xx64.zip` | <https://download.osgeo.org/postgis/windows/pg16/> |
   | Python 3.12 | `python-3.12.10-amd64.exe` | <https://www.python.org/downloads/windows/> |

   (Node.js không cần trên máy chủ khi dùng gói dựng sẵn.)
3. Trên máy chủ: chép `E:\TaiVe` thành `C:\CaiDat\TaiVe`, chép `E:\GoiAquaNet` vào `C:\CaiDat\GoiAquaNet`.
4. Chạy `C:\CaiDat\GoiAquaNet\iis\ChuanBi-MayChu.bat` – script thấy không có internet sẽ cài từ các tệp trong
   `C:\CaiDat\TaiVe` (IIS bật từ chính Windows, không cần tải) – rồi chạy `C:\CaiDat\GoiAquaNet\iis\CaiDat-IIS.bat`.

---

## Phần 7. Xử lý sự cố

| Thông báo / hiện tượng | Cách xử lý |
|---|---|
| `ChuanBi-MayChu.bat` báo *Không tải được …* | Tải tay tệp đó theo đường dẫn script in ra, chép vào `C:\CaiDat\TaiVe`, chạy lại script (script dùng tệp có sẵn trước khi tải). Hoặc làm tay bước tương ứng ở Phần 1. |
| *Máy này chưa bật IIS* | Chạy `ChuanBi-MayChu.bat` (Phần 1, cách nhanh), hoặc làm Phần 1, Bước 2. |
| *IIS chưa có ASP.NET Core Module V2* | Chạy `ChuanBi-MayChu.bat`, hoặc cài Hosting Bundle (Bước 3) rồi chạy `iisreset`. Sau đó chạy lại bộ cài. |
| *Python đang cài riêng cho một người dùng* | Gỡ Python (*Settings › Apps*), cài lại với *Install for all users* (Bước 5). |
| *Chưa cài PostgreSQL trên máy này* | Chạy `ChuanBi-MayChu.bat`, hoặc làm Bước 4. PostgreSQL ở máy khác: thêm `-PgHost <địa chỉ>`. |
| *Không kết nối được PostgreSQL … mật khẩu* | Nhập đúng mật khẩu `postgres` đặt ở Bước 4 (được thử 3 lần). Quên mật khẩu: sửa `pg_hba.conf`, đổi `scram-sha-256` thành `trust` ở dòng `127.0.0.1/32`, khởi động lại dịch vụ PostgreSQL, chạy `psql -U postgres -c "ALTER USER postgres PASSWORD 'mat-khau-moi'"`, rồi **đổi lại** `scram-sha-256` và khởi động lại dịch vụ. |
| *PostgreSQL chưa cài PostGIS* | Chạy `ChuanBi-MayChu.bat`, hoặc cài PostGIS bằng Stack Builder (Bước 4, mục 6). |
| *npm ci lỗi* / *Cài thư viện Python lỗi* | Máy chủ không ra được internet (hoặc cần proxy: đặt biến `HTTPS_PROXY`). Dùng Phần 6. |
| *Cổng 8443 đang dùng cho …* | Chọn cổng khác: `CaiDat-IIS.bat -Cong 8444`. |
| Trình duyệt báo lỗi **502.5 / 500.30 / 503** | Xem `C:\AquaNetData\loi-khoi-dong.txt` và `NhatKy\stdout_*.log`; chạy `CaiDat-IIS.bat -KiemTra`. Hay gặp: PostgreSQL bị dừng (*services.msc* › *postgresql-x64-16* › *Start*). |
| Máy khác không vào được | Trên máy đó chạy PowerShell: `Test-NetConnection <máy chủ> -Port 8443`. *False* → kiểm tra tường lửa mạng / router. |
| Điện thoại không cài được ứng dụng hiện trường, không chạy offline, không lấy được GPS | Cần chứng chỉ hợp lệ – Phần 4. |
| Sau khi khởi động lại máy chủ, AquaNet không vào được | Chờ 1–2 phút. Vẫn lỗi: *services.msc* › kiểm tra *postgresql-x64-16* và *World Wide Web Publishing Service* đang *Running*, kiểu khởi động *Automatic*; chạy `CaiDat-IIS.bat -KiemTra`. |

---

## Phần 8. Hoàn thiện máy chủ – danh sách kiểm tra

Cài xong Phần 2 là dùng được trong mạng nội bộ. Để thành một máy chủ **hoàn chỉnh** chạy lâu dài, làm thêm các mục dưới.

### 8.1. Truy cập từ internet bằng tên miền

1. Xin nhà mạng **IP công cộng tĩnh** cho đường truyền của cơ quan.
2. Có tên miền (vd `gis.hawasuco.vn`): vào trang quản lý tên miền, tạo **bản ghi A** trỏ về IP công cộng đó.
3. Trên router / tường lửa, **chuyển cổng (NAT / port forwarding)** về IP tĩnh của máy chủ (Phần 0.4):

   | Cổng ngoài | Về máy chủ | Dùng cho |
   |---|---|---|
   | TCP **8443** | `192.168.1.20:8443` | AquaNet |
   | TCP **80** | `192.168.1.20:80` | Let's Encrypt xác minh tên miền khi cấp / gia hạn chứng chỉ (Phần 4) |

   Chỉ mở đúng các cổng này. **Không** mở 3389 (Remote Desktop), 5432 (PostgreSQL), 445 (chia sẻ tệp).
4. Lấy **chứng chỉ HTTPS thật** – làm [Phần 4](#phần-4-chứng-chỉ-https-thật-cần-cho-ứng-dụng-hiện-trường).
5. **Kiểm tra** bằng điện thoại dùng 4G (không dùng wifi cơ quan): mở `https://gis.hawasuco.vn:8443` → không có cảnh báo.

Không có IP tĩnh hoặc không muốn mở cổng ra internet: dùng trong mạng nội bộ / qua VPN cũng được, nhưng điện thoại
vẫn cần chứng chỉ hợp lệ để chạy offline và lấy GPS. Khi đó vẫn dùng tên miền + win-acme, chọn cách xác minh qua
**DNS** thay cho cổng 80 (xem tài liệu win-acme).

### 8.2. Sao lưu ra ngoài máy chủ

Bộ cài đã tạo lịch sao lưu 1:30 sáng hằng ngày, **nhưng bản sao lưu vẫn nằm trên chính máy chủ** – máy hỏng ổ, bị mã
độc tống tiền là mất cả. Cần thêm:

1. **Chép tự động sang NAS / máy khác** hằng đêm: *Task Scheduler* › *Create Task…*
   - *General*: tên `AquaNet GIS - Chep sao luu`, chọn tài khoản quản trị có quyền ghi vào NAS (vd `quanly`),
     **Run whether user is logged on or not**.
   - *Triggers* › *New* › *Daily*, lúc **3:00**.
   - *Actions* › *New* › Program: `robocopy.exe` · Arguments (sửa đường dẫn cho đúng):
     `D:\AquaNetData\SaoLuu \\NAS\SaoLuu\AquaNet /E /XO /R:2 /W:30 /NP /LOG+:D:\AquaNetData\NhatKy\chep-saoluu.log`
2. **Hằng tháng chép thêm ra ổ cứng rời** rồi rút ra cất ở nơi khác (chống mã độc mã hóa cả NAS).
3. Cất riêng một bản tệp `C:\AquaNetData\aquanet.env` (hoặc `D:\AquaNetData\aquanet.env`) ở nơi an toàn: trong đó có
   khóa API của cổng SCADA (`INGEST_API_KEYS`) – khi dựng lại máy chủ, chép lại các khóa này thì cổng SCADA không
   phải cấu hình lại.
4. **Mỗi quý thử khôi phục một lần** lên máy thử (lệnh *Khôi phục* ở Phần 5). Sao lưu chưa từng thử khôi phục thì
   chưa chắc dùng được.

### 8.3. Cập nhật Windows định kỳ

- Mỗi tháng một lần (sau thứ Ba tuần thứ hai, ngày Microsoft phát hành bản vá): cài cập nhật **ngoài giờ làm việc**,
  khởi động lại, rồi mở AquaNet kiểm tra (hoặc `CaiDat-IIS.bat -KiemTra`). IIS, PostgreSQL và AquaNet tự chạy lại sau
  khởi động.
- Đặt *Active hours* (*Settings › Windows Update › Advanced options*) theo giờ làm việc để Windows không tự khởi động
  lại giữa ngày.
- Cập nhật AquaNet: Phần 5, dòng *Cập nhật phiên bản mới*.

### 8.4. Bảo mật

- [ ] Tường lửa Windows bật ở cả 3 hồ sơ (*Domain, Private, Public*); chỉ mở các cổng cần dùng (8443, 80 nếu dùng
      Let's Encrypt, 8080 nếu chạy phần mềm *Quản lý thất thoát nước*). Kiểm tra cổng đang mở cho PostgreSQL – PowerShell:
      `Get-NetFirewallPortFilter | Where-Object LocalPort -eq 5432 | Get-NetFirewallRule | Select-Object DisplayName, Enabled`
      – không cần QGIS từ máy khác thì tắt các quy tắc đó.
- [ ] Router **không** chuyển cổng 3389, 5432, 445 ra internet. Quản trị từ xa qua VPN.
- [ ] Windows Defender đang bật (*Windows Security › Virus & threat protection*). `ChuanBi-MayChu.bat` chỉ loại trừ
      thư mục dữ liệu PostgreSQL khỏi quét.
- [ ] Mỗi cán bộ CNTT dùng tài khoản Windows riêng; không dùng chung *Administrator*.
- [ ] Trong AquaNet: đổi mật khẩu `admin` định kỳ, mỗi nhân viên một tài khoản với vai trò vừa đủ (Phần 3), khóa tài
      khoản của người nghỉ việc.
- [ ] Khóa API SCADA (`INGEST_API_KEYS`) chỉ cấp cho cổng thu thập; nghi lộ thì đổi và *Recycle* app pool.

### 8.5. Theo dõi hằng tuần (5 phút)

- [ ] `CaiDat-IIS.bat -KiemTra` báo OK.
- [ ] `D:\AquaNetData\NhatKy\saoluu.log` có dòng *Đã sao lưu CSDL* của đêm qua; tệp chép sang NAS có ngày mới.
- [ ] Ổ `C:` và `D:` còn trống trên 20% (*This PC*).
- [ ] Chứng chỉ còn hạn (win-acme tự gia hạn – mở trang bằng điện thoại không thấy cảnh báo là được).

Muốn được báo khi máy chủ ngừng chạy: dùng dịch vụ theo dõi từ ngoài (vd UptimeRobot, gói miễn phí) gọi
`https://gis.hawasuco.vn:8443/api/health` mỗi 5 phút, gửi email / tin nhắn khi lỗi.

### 8.6. Điện và phần cứng

- Cắm máy chủ qua **UPS**, cài phần mềm của UPS để tự tắt máy an toàn khi hết pin.
- Trong BIOS của máy chủ, đặt *Restore on AC power loss* = **Power On** để máy tự bật lại khi có điện.
- Máy ảo: đặt máy ảo tự khởi động cùng máy chủ vật lý.

### 8.7. Sổ máy chủ

Ghi lại và cất nơi an toàn (két, trình quản lý mật khẩu của cơ quan) – người tiếp quản cần những thông tin này:

| Mục | Giá trị |
|---|---|
| Tên máy chủ, IP nội bộ, IP công cộng | `HAWASUCO-GIS`, `192.168.1.20`, … |
| Tài khoản quản trị Windows (`Administrator`, `quanly`) | mật khẩu |
| Mật khẩu `postgres` (quản trị CSDL) | |
| Mật khẩu `admin` của AquaNet | |
| Tên miền, nơi quản lý tên miền, ngày hết hạn tên miền | |
| Cổng đã chuyển trên router | 8443, 80 |
| Thư mục dữ liệu, nơi chép sao lưu | `D:\AquaNetData`, `\\NAS\SaoLuu\AquaNet` |
| Ngày cài, phiên bản | |

### 8.8. Chạy chung với phần mềm *Quản lý thất thoát nước*

Hai phần mềm chạy chung một máy chủ được: dùng chung IIS và Hosting Bundle, mỗi phần mềm một site và app pool riêng
(*Quản lý thất thoát nước* cổng 8080, AquaNet cổng 8443). Nên có RAM 16 GB. Cập nhật phần mềm này không ảnh hưởng
phần mềm kia.

✅ Làm xong Phần 8: máy chủ truy cập được bằng tên miền với chứng chỉ thật, sao lưu ra ngoài, cập nhật và theo dõi
định kỳ, chỉ mở cổng cần thiết – một máy chủ hoàn chỉnh.

---

## Tham số của ChuanBi-MayChu.bat

| Tham số | Ý nghĩa | Mặc định |
|---|---|---|
| `-PgDuLieu` | Thư mục dữ liệu PostgreSQL (vd `D:\PostgreSQL\16\data`) – chỉ có tác dụng khi chưa cài PostgreSQL | trong thư mục cài PostgreSQL |
| `-DuLieu` | Thư mục dữ liệu AquaNet, chuyển cho `CaiDat-IIS.bat` khi cài luôn (vd `D:\AquaNetData`) | `C:\AquaNetData` |
| `-ThuMucTai` | Nơi để tệp cài tải về / tệp cài chép sẵn | `C:\CaiDat\TaiVe` |
| `-PythonPhienBan` | Bản Python sẽ cài | `3.12.10` |
| `-KhongCaiAquaNet` | Chỉ cài phần mềm nền, không hỏi cài AquaNet | |

## Tham số của CaiDat-IIS.bat

Chạy từ cmd tại thư mục `iis`, ví dụ `CaiDat-IIS.bat -Cong 9443 -DuLieu D:\AquaNetData`.
Lần chạy sau tự dùng lại cổng và thư mục dữ liệu của lần cài trước.

| Tham số | Ý nghĩa | Mặc định |
|---|---|---|
| `-Cong` | Cổng HTTPS | `8443` |
| `-DuLieu` | Thư mục dữ liệu (ảnh, nhật ký, sao lưu, cấu hình bí mật) | `C:\AquaNetData` |
| `-ThuMuc` | Thư mục chương trình | `C:\inetpub\AquaNet` |
| `-TenSite` | Tên site và app pool trong IIS | `AquaNet` |
| `-ChungChi` | Thumbprint chứng chỉ có sẵn (thay cho chứng chỉ tự ký) | |
| `-TenMien` | Tên miền ghi vào chứng chỉ tự ký và địa chỉ in ra | |
| `-PgHost`, `-PgPort`, `-PgSuperUser` | Máy chủ PostgreSQL, cổng, tài khoản quản trị CSDL | `localhost`, `5432`, `postgres` |
| `-TenCsdl`, `-PgUser` | Tên CSDL và tài khoản CSDL của ứng dụng | `capnuoc`, `aquanet` |
| `-Python` | Đường dẫn `python.exe` muốn dùng | tự tìm |
| `-DuLieuMau` | Lần cài đầu: tạo dữ liệu mẫu | |
| `-DatMatKhau` | Đặt lại mật khẩu `admin` | |
| `-KhongSaoLuu` | Không tạo lịch sao lưu tự động | |
| `-KiemTra` | Gọi thử máy chủ, in lỗi gần nhất | |
| `-GoBo` | Gỡ khỏi IIS (giữ CSDL và dữ liệu) | |
| `-TaoGoi <thư mục>` | Tạo gói dựng sẵn cho máy chủ không có internet | |

Các tệp trong thư mục `iis`: `ChuanBi-MayChu.bat`/`.ps1` (cài phần mềm nền cho máy chủ mới),
`CaiDat-IIS.bat`/`.ps1` (bộ cài AquaNet), `web.config` (mẫu cấu hình site), `run_iis.py`
(khởi chạy ứng dụng dưới IIS), `caidat.py` (tạo CSDL, tài khoản), `SaoLuu.ps1` (sao lưu),
`GanChungChi.ps1` (gắn chứng chỉ).
