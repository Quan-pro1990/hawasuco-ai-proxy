# Cài AquaNet GIS trên máy chủ Windows (IIS) – hướng dẫn cho người mới

```
 Máy tính (trình duyệt) ─┐
 Điện thoại (/field)    ─┼─ HTTPS cổng 8443 ─> IIS ─> AquaNet (Python) ─> PostgreSQL + PostGIS
 Cổng SCADA, QGIS…      ─┘                     C:\inetpub\AquaNet        CSDL "capnuoc"
                                               C:\AquaNetData: ảnh, nhật ký, sao lưu, cấu hình bí mật
```

Thời gian lần đầu: khoảng 45–60 phút (phần lớn là tải và cài phần mềm nền).
Làm lần lượt **Phần 1 → Phần 2 → Phần 3**. Các phần sau dùng khi cần.

> Ký hiệu: **cmd quản trị** = bấm Start, gõ `cmd`, chuột phải *Command Prompt* › *Run as administrator*.
> **PowerShell quản trị** tương tự với *Windows PowerShell*.

---

## Phần 1. Chuẩn bị máy chủ (làm một lần)

### Bước 1. Kiểm tra máy chủ

- Windows Server 2016 / 2019 / 2022 / 2025, 64-bit (dùng thử được trên Windows 10/11 Pro).
- RAM từ 8 GB, ổ đĩa còn trống từ 30 GB.
- Đăng nhập bằng tài khoản **Administrator**.
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
  **Code › Download ZIP**. Chuột phải tệp zip › *Properties* › đánh dấu **Unblock** › *OK*
  (để Windows không chặn script), rồi giải nén vào `C:\CaiDat\hawasuco-ai-proxy`.
- **Cách 2 (có Git):** `git clone https://github.com/Quan-pro1990/hawasuco-ai-proxy.git C:\CaiDat\hawasuco-ai-proxy`

Thư mục dùng ở Phần 2: `C:\CaiDat\hawasuco-ai-proxy\aquanet\iis`.

---

## Phần 2. Cài AquaNet

1. Mở thư mục `C:\CaiDat\hawasuco-ai-proxy\aquanet\iis`, nhấp đúp **CaiDat-IIS.bat** › *Yes* (cho quyền quản trị).
2. Cửa sổ đen chạy lần lượt 9 bước. Lần đầu sẽ hỏi:
   - **Mật khẩu tài khoản `postgres`** (đặt ở Phần 1, Bước 4). Gõ mật khẩu không hiện chữ là bình thường – gõ xong Enter.
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

1. Trên một máy Windows **có internet**, cài cùng phiên bản Python với máy chủ (vd 3.12) và Node.js, tải mã nguồn
   (Phần 1, Bước 7).
2. Mở cmd tại thư mục `aquanet\iis`, chạy: `CaiDat-IIS.bat -TaoGoi D:\GoiAquaNet` – bộ cài dựng giao diện và tải sẵn
   mọi thư viện Python vào `D:\GoiAquaNet`.
3. Chép thư mục `D:\GoiAquaNet` sang máy chủ (USB, mạng nội bộ…). Trên máy chủ chỉ cần làm Phần 1 các bước 2–5
   (không cần Node.js), rồi chạy `D:\GoiAquaNet\iis\CaiDat-IIS.bat`.

Các tệp cài IIS / Hosting Bundle / PostgreSQL / PostGIS / Python cũng tải trước trên máy có internet rồi chép sang.

---

## Phần 7. Xử lý sự cố

| Thông báo / hiện tượng | Cách xử lý |
|---|---|
| *Máy này chưa bật IIS* | Làm Phần 1, Bước 2. |
| *IIS chưa có ASP.NET Core Module V2* | Cài Hosting Bundle (Bước 3), chạy `iisreset`, chạy lại bộ cài. |
| *Python đang cài riêng cho một người dùng* | Gỡ Python (*Settings › Apps*), cài lại với *Install for all users* (Bước 5). |
| *Chưa cài PostgreSQL trên máy này* | Làm Bước 4. PostgreSQL ở máy khác: thêm `-PgHost <địa chỉ>`. |
| *Không kết nối được PostgreSQL … mật khẩu* | Nhập đúng mật khẩu `postgres` đặt ở Bước 4 (được thử 3 lần). Quên mật khẩu: sửa `pg_hba.conf`, đổi `scram-sha-256` thành `trust` ở dòng `127.0.0.1/32`, khởi động lại dịch vụ PostgreSQL, chạy `psql -U postgres -c "ALTER USER postgres PASSWORD 'mat-khau-moi'"`, rồi **đổi lại** `scram-sha-256` và khởi động lại dịch vụ. |
| *PostgreSQL chưa cài PostGIS* | Chạy Stack Builder, cài PostGIS (Bước 4, mục 6). |
| *npm ci lỗi* / *Cài thư viện Python lỗi* | Máy chủ không ra được internet (hoặc cần proxy: đặt biến `HTTPS_PROXY`). Dùng Phần 6. |
| *Cổng 8443 đang dùng cho …* | Chọn cổng khác: `CaiDat-IIS.bat -Cong 8444`. |
| Trình duyệt báo lỗi **502.5 / 500.30 / 503** | Xem `C:\AquaNetData\loi-khoi-dong.txt` và `NhatKy\stdout_*.log`; chạy `CaiDat-IIS.bat -KiemTra`. Hay gặp: PostgreSQL bị dừng (*services.msc* › *postgresql-x64-16* › *Start*). |
| Máy khác không vào được | Trên máy đó chạy PowerShell: `Test-NetConnection <máy chủ> -Port 8443`. *False* → kiểm tra tường lửa mạng / router. |
| Điện thoại không cài được ứng dụng hiện trường, không chạy offline, không lấy được GPS | Cần chứng chỉ hợp lệ – Phần 4. |

---

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

Các tệp trong thư mục `iis`: `CaiDat-IIS.bat`/`.ps1` (bộ cài), `web.config` (mẫu cấu hình site), `run_iis.py`
(khởi chạy ứng dụng dưới IIS), `caidat.py` (tạo CSDL, tài khoản), `SaoLuu.ps1` (sao lưu),
`GanChungChi.ps1` (gắn chứng chỉ).
