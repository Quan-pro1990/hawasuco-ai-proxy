# Cài ứng dụng "Lưu Vị Trí" (LuuViTri.apk) lên điện thoại Android, có hướng dẫn từng bước.
# Kết nối bằng cáp USB (hoặc Wi-Fi với Android 11+), dùng công cụ adb của Google
# (tự tải về thư mục này nếu máy chưa có, khoảng 7 MB, chỉ lần đầu).
#
# Chạy bằng CaiDat-DienThoai.bat (nhấp đúp). Tham số tuỳ chọn:
#   CaiDat-DienThoai.bat -WiFi             kết nối qua Wi-Fi (Gỡ lỗi không dây, Android 11+)
#   CaiDat-DienThoai.bat -Usb              bỏ qua bước chọn, dùng cáp USB
#   CaiDat-DienThoai.bat -KhongCapQuyen    không cấp sẵn quyền (vị trí, camera, thông báo)
#   CaiDat-DienThoai.bat -Apk D:\khac.apk  cài file APK khác
param(
    [string]$Apk = '',
    [string]$Adb = '',
    [switch]$WiFi,
    [switch]$Usb,
    [switch]$KhongCapQuyen
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
$goi = 'com.hawasuco.savelocation'
if (-not $Apk) { $Apk = Join-Path $goc 'LuuViTri.apk' }
$script:adb = $Adb
$script:may = ''

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }
function CanhBao([string]$s) { Write-Host $s -ForegroundColor Yellow }
function Tot([string]$s) { Write-Host $s -ForegroundColor Green }

# Hỏi Có/Không. Chữ in hoa trong câu hỏi là lựa chọn mặc định khi chỉ bấm Enter.
function Hoi([string]$cauHoi, [bool]$macDinh) {
    $r = Read-Host $cauHoi
    if ($null -eq $r -or $r.Trim() -eq '') { return $macDinh }
    $r = $r.Trim().ToLower()
    return ($r.StartsWith('c') -or $r.StartsWith('y'))
}

function Adb([string[]]$thamSo) {
    $cu = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $ra = & $script:adb @thamSo 2>&1 | ForEach-Object { "$_" } }
    finally { $ErrorActionPreference = $cu }
    [pscustomobject]@{ Ma = $LASTEXITCODE; Ra = (($ra | Where-Object { $_ }) -join "`n").Trim() }
}

function AdbMay([string[]]$thamSo) { Adb (@('-s', $script:may) + $thamSo) }

function Prop([string]$ten) {
    $r = AdbMay @('shell', 'getprop', $ten)
    return (($r.Ra -split "`n") | Select-Object -Last 1).Trim()
}

# ------------------------------------------------------------------ 1. Tìm / tải adb
function TimAdb {
    if ($script:adb) {
        if (-not (Test-Path $script:adb)) { Dung "Không thấy $($script:adb)" }
        return
    }
    $ungVien = @(
        (Join-Path $goc 'platform-tools\adb.exe'),
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
    )
    $lenh = Get-Command adb -ErrorAction SilentlyContinue
    if ($lenh) { $ungVien += $lenh.Source }
    foreach ($u in $ungVien) {
        if ($u -and (Test-Path $u)) { $script:adb = $u; return }
    }
    Buoc 'Tải công cụ adb (Android SDK Platform-Tools) của Google — chỉ lần đầu'
    $url = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'
    $zip = Join-Path $env:TEMP 'platform-tools-latest-windows.zip'
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Write-Host "Đang tải $url ..."
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        Expand-Archive -Path $zip -DestinationPath $goc -Force
        Remove-Item $zip -ErrorAction SilentlyContinue
    } catch {
        Dung ("Không tải được adb: $($_.Exception.Message)`n" +
              "Kiểm tra Internet, hoặc tự tải $url, giải nén vào thư mục này (có thư mục platform-tools) rồi chạy lại.`n" +
              "Hoặc cài không cần máy tính: chép LuuViTri.apk vào điện thoại rồi bấm vào file để cài.")
    }
    $script:adb = Join-Path $goc 'platform-tools\adb.exe'
    if (-not (Test-Path $script:adb)) { Dung 'Giải nén platform-tools không thành công.' }
    Tot "Đã có adb: $($script:adb)"
}

# ------------------------------------------------------------------ 2. Hướng dẫn và kết nối
function HuongDanUsb {
    Buoc 'BƯỚC 1 — Bật "Gỡ lỗi USB" trên điện thoại (chỉ làm 1 lần cho mỗi máy)'
    Write-Host '  a) Cài đặt -> Thông tin điện thoại (Giới thiệu điện thoại) -> bấm liên tục 7 lần vào "Số hiệu bản dựng"'
    Write-Host '     (Samsung: Thông tin phần mềm -> Số hiệu bản dựng; Xiaomi: Phiên bản MIUI / HyperOS;'
    Write-Host '      Oppo/Realme: Phiên bản -> Số hiệu bản dựng) cho đến khi báo "Bạn đã là nhà phát triển".'
    Write-Host '  b) Cài đặt -> Hệ thống (hoặc Cài đặt bổ sung) -> Tùy chọn nhà phát triển -> bật "Gỡ lỗi USB".'
    Write-Host '     Xiaomi: bật thêm "Cài đặt qua USB". Oppo/Vivo: tắt "Giám sát ứng dụng cài qua ADB" nếu có.'
    Buoc 'BƯỚC 2 — Cắm cáp USB vào máy tính và mở khoá màn hình điện thoại'
    Write-Host '  Nếu điện thoại hỏi "Sử dụng USB cho..." -> chọn "Truyền tệp".'
    Buoc 'BƯỚC 3 — Trên điện thoại hiện "Cho phép gỡ lỗi USB?"'
    Write-Host '  Tick "Luôn cho phép từ máy tính này" -> bấm "Cho phép".'
}

function KetNoiWiFi {
    Buoc 'Kết nối qua Wi-Fi (Android 11 trở lên)'
    Write-Host '  1) Điện thoại và máy tính dùng CÙNG mạng Wi-Fi.'
    Write-Host '  2) Bật Tùy chọn nhà phát triển (bấm 7 lần vào "Số hiệu bản dựng" trong Thông tin điện thoại).'
    Write-Host '  3) Tùy chọn nhà phát triển -> "Gỡ lỗi không dây" -> bật -> chạm vào chữ "Gỡ lỗi không dây"'
    Write-Host '     -> "Ghép nối thiết bị bằng mã ghép nối". Điện thoại hiện địa chỉ IP & cổng và mã 6 số.'
    while ($true) {
        $diaChi = Read-Host '  Nhập "Địa chỉ IP và cổng" ở bảng ghép nối (vd 192.168.1.23:37155)'
        $ma = Read-Host '  Nhập "Mã ghép nối Wi-Fi" (6 số)'
        $r = Adb @('pair', $diaChi.Trim(), $ma.Trim())
        if ($r.Ra -match 'Successfully paired') { Tot '  Đã ghép nối.'; break }
        CanhBao "  Ghép nối không được: $($r.Ra)"
        if (-not (Hoi '  Thử lại? (C/k)' $true)) { Dung 'Đã huỷ.' }
    }
    Write-Host '  4) Trên màn hình "Gỡ lỗi không dây" (sau khi đóng bảng ghép nối) có dòng "Địa chỉ IP và cổng" (cổng khác cổng ghép nối).'
    while ($true) {
        $diaChi = Read-Host '  Nhập địa chỉ đó (vd 192.168.1.23:41027)'
        $r = Adb @('connect', $diaChi.Trim())
        if ($r.Ra -match 'connected to') { Tot "  $($r.Ra)"; return }
        CanhBao "  Kết nối không được: $($r.Ra)"
        if (-not (Hoi '  Thử lại? (C/k)' $true)) { Dung 'Đã huỷ.' }
    }
}

function DanhSachMay {
    $r = Adb @('devices', '-l')
    $ds = @()
    foreach ($dong in ($r.Ra -split "`n")) {
        $d = $dong.Trim()
        if (-not $d -or $d -like 'List of devices*' -or $d -like '*daemon*') { continue }
        $p = $d -split '\s+'
        if ($p.Count -lt 2) { continue }
        $model = ''
        foreach ($x in $p) { if ($x -like 'model:*') { $model = $x.Substring(6) -replace '_', ' ' } }
        $ds += [pscustomobject]@{ Serial = $p[0]; TrangThai = $p[1]; Model = $model }
    }
    return , $ds
}

function ChoMay {
    $daNhacChoPhep = $false
    $dem = 0
    while ($true) {
        $ds = DanhSachMay
        $sanSang = @($ds | Where-Object { $_.TrangThai -eq 'device' })
        if ($sanSang.Count -eq 1) { return $sanSang[0] }
        if ($sanSang.Count -gt 1) {
            Write-Host ''
            Write-Host 'Có nhiều điện thoại đang kết nối:'
            for ($i = 0; $i -lt $sanSang.Count; $i++) { Write-Host ("  {0}. {1}  ({2})" -f ($i + 1), $sanSang[$i].Model, $sanSang[$i].Serial) }
            $chon = Read-Host "Chọn số (1-$($sanSang.Count))"
            $n = 0
            if ([int]::TryParse("$chon", [ref]$n) -and $n -ge 1 -and $n -le $sanSang.Count) { return $sanSang[$n - 1] }
            continue
        }
        if (@($ds | Where-Object { $_.TrangThai -eq 'unauthorized' }).Count -gt 0) {
            if (-not $daNhacChoPhep) {
                CanhBao 'Điện thoại chưa cho phép máy tính này: mở khoá màn hình, bấm "Cho phép" ở bảng "Cho phép gỡ lỗi USB?".'
                CanhBao '(Không thấy bảng? Rút cáp ra cắm lại, hoặc tắt/bật lại "Gỡ lỗi USB".)'
                $daNhacChoPhep = $true
            }
        } elseif ($dem % 15 -eq 0) {
            Write-Host 'Đang chờ điện thoại... (cắm cáp, mở khoá màn hình; Ctrl+C để thoát)'
        }
        if ($dem -eq 45) {
            CanhBao 'Vẫn chưa thấy điện thoại. Kiểm tra:'
            CanhBao '  - Cáp có truyền dữ liệu (không phải cáp chỉ sạc); thử cổng USB khác.'
            CanhBao '  - Đã bật "Gỡ lỗi USB"; chọn chế độ "Truyền tệp" khi cắm cáp.'
            CanhBao '  - Windows cần driver của hãng (vd Samsung USB Driver) với một số máy cũ.'
            CanhBao '  - Hoặc chạy lại với -WiFi, hoặc chép LuuViTri.apk vào điện thoại để cài tay.'
        }
        $dem++
        Start-Sleep -Seconds 2
    }
}

# ------------------------------------------------------------------ 3. Cài đặt
function CaiApk([bool]$capQuyen, [bool]$haCap) {
    $thamSo = @('install', '-r')
    if ($capQuyen) { $thamSo += '-g' }
    if ($haCap) { $thamSo += '-d' }
    $thamSo += $Apk
    return AdbMay $thamSo
}

function CaiMotMay {
    $m = ChoMay
    $script:may = $m.Serial
    $hang = Prop 'ro.product.manufacturer'
    $model = Prop 'ro.product.model'
    $ban = Prop 'ro.build.version.release'
    $sdk = 0
    [void][int]::TryParse((Prop 'ro.build.version.sdk'), [ref]$sdk)
    Tot ("Đã kết nối: {0} {1} — Android {2} (API {3})" -f $hang, $model, $ban, $sdk)
    if ($sdk -gt 0 -and $sdk -lt 24) { Dung 'Ứng dụng cần Android 7.0 trở lên.' }

    $daCo = (AdbMay @('shell', 'pm', 'list', 'packages', $goi)).Ra -split "`n" | Where-Object { $_.Trim() -eq "package:$goi" }
    $capQuyen = (-not $KhongCapQuyen) -and $sdk -ge 23

    Buoc ($(if ($daCo) { 'Cập nhật Lưu Vị Trí (giữ nguyên dữ liệu)' } else { 'Cài Lưu Vị Trí' }))
    Write-Host 'Đang cài... Một số máy (Xiaomi, Oppo, Vivo) hỏi xác nhận trên màn hình điện thoại: hãy bấm "Cài đặt" / "Cho phép".'
    $haCap = $false
    $ok = $false
    for ($lan = 1; $lan -le 5 -and -not $ok; $lan++) {
        $r = CaiApk $capQuyen $haCap
        $loi = $r.Ra
        if ($loi -match '(?m)^Success') { $ok = $true; break }
        if ($loi -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match|INCONSISTENT_CERTIFICATES') {
            CanhBao 'Điện thoại đang có bản Lưu Vị Trí ký bằng khoá khác nên không cài đè được.'
            CanhBao 'Phải gỡ bản cũ: VIỆC GỠ SẼ XOÁ DỮ LIỆU CỦA BẢN CŨ (nếu cần, mở app -> Sao lưu & khôi phục trước).'
            if (Hoi 'Gỡ bản cũ rồi cài lại? (c/K)' $false) { [void](AdbMay @('uninstall', $goi)); continue }
            Dung 'Đã huỷ, chưa cài.'
        } elseif ($loi -match 'INSTALL_FAILED_VERSION_DOWNGRADE') {
            CanhBao 'Điện thoại đang có bản mới hơn — cài bản này đè lên (vẫn giữ dữ liệu).'
            $haCap = $true
        } elseif ($loi -match 'INSTALL_FAILED_USER_RESTRICTED|INSTALL_FAILED_ABORTED|canceled by user|Install canceled') {
            CanhBao 'Điện thoại từ chối cài qua USB.'
            CanhBao '  - Xiaomi: Tùy chọn nhà phát triển -> bật "Cài đặt qua USB" (cần lắp SIM, đăng nhập Mi).'
            CanhBao '  - Oppo/Vivo/Realme: bấm "Cài đặt" trên màn hình điện thoại khi được hỏi (trong vài giây).'
            if (-not (Hoi 'Thử lại? (C/k)' $true)) { Dung 'Chưa cài được.' }
        } elseif ($loi -match 'INSUFFICIENT_STORAGE') {
            Dung 'Điện thoại không đủ bộ nhớ trống.'
        } elseif ($loi -match 'device offline|no devices|not found|device unauthorized') {
            CanhBao 'Mất kết nối với điện thoại, đang chờ kết nối lại...'
            $script:may = (ChoMay).Serial
        } else {
            CanhBao $loi
            if (-not (Hoi 'Thử lại? (C/k)' $true)) { Dung 'Chưa cài được.' }
        }
    }
    if (-not $ok) { Dung 'Chưa cài được sau nhiều lần thử.' }
    Tot 'Đã cài xong.'

    if ($capQuyen) {
        # Quyền vị trí nền (cho Vùng cảnh báo) và thông báo — cấp thêm cho chắc trên một số máy
        foreach ($q in @('android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.POST_NOTIFICATIONS')) {
            [void](AdbMay @('shell', 'pm', 'grant', $goi, $q))
        }
        Write-Host 'Đã cấp sẵn quyền: vị trí (kể cả chạy nền), camera, thông báo.'
    }
    if (Hoi 'Tắt "tối ưu hoá pin" cho Lưu Vị Trí để Vùng cảnh báo / Chia sẻ trực tiếp chạy ổn định? (C/k)' $true) {
        $r = AdbMay @('shell', 'dumpsys', 'deviceidle', 'whitelist', "+$goi")
        if ($r.Ra -match 'Added|Already') { Write-Host 'Đã tắt tối ưu hoá pin cho ứng dụng.' }
        else { CanhBao 'Máy không cho đổi qua USB — tự tắt trong app: Quản lý vùng cảnh báo -> Tối ưu...' }
    }
    [void](AdbMay @('shell', 'monkey', '-p', $goi, '-c', 'android.intent.category.LAUNCHER', '1'))
    Tot 'Đã mở ứng dụng Lưu Vị Trí trên điện thoại.'
}

# ------------------------------------------------------------------ Chương trình chính
Write-Host '=================================================='
Write-Host '  CÀI ỨNG DỤNG "LƯU VỊ TRÍ" LÊN ĐIỆN THOẠI ANDROID'
Write-Host '=================================================='
if (-not (Test-Path $Apk)) { Dung "Không thấy file $Apk (để file LuuViTri.apk cùng thư mục với script này)." }
$kb = [math]::Round((Get-Item $Apk).Length / 1MB, 1)
Write-Host "File cài: $Apk ($kb MB)"

$cach = '1'
if ($WiFi) { $cach = '2' } elseif (-not $Usb) {
    Write-Host ''
    Write-Host 'Chọn cách cài:'
    Write-Host '  1. Qua cáp USB (khuyên dùng)'
    Write-Host '  2. Qua Wi-Fi (Android 11 trở lên, không cần cáp)'
    Write-Host '  3. Không dùng máy tính: chép file APK vào điện thoại rồi bấm vào file để cài'
    $c = Read-Host 'Chọn 1, 2 hoặc 3 (Enter = 1)'
    if ($c) { $cach = $c.Trim() }
}

if ($cach -eq '3') {
    Buoc 'Cài không cần máy tính'
    Write-Host '  1) Gửi file LuuViTri.apk sang điện thoại (Zalo "Truyền file", Google Drive, email, hoặc cáp USB -> thư mục Download).'
    Write-Host '  2) Trên điện thoại mở file đó (ứng dụng Tệp / Quản lý file -> Download).'
    Write-Host '  3) Nếu báo chặn: bấm "Cài đặt" -> cho phép "Cài ứng dụng không rõ nguồn gốc" cho ứng dụng đang mở file -> quay lại bấm Cài đặt.'
    Write-Host '     Nếu Google Play Protect cảnh báo: chọn "Thông tin chi tiết" -> "Vẫn cài đặt".'
    Write-Host '  4) Mở Lưu Vị Trí -> bấm Bắt đầu -> cho phép vị trí.'
    if ($env:OS -eq 'Windows_NT') { Start-Process explorer.exe "/select,`"$Apk`"" }
    exit 0
}

TimAdb
try {
    [void](Adb @('start-server'))
    if ($cach -eq '2') { KetNoiWiFi } else { HuongDanUsb }
    while ($true) {
        CaiMotMay
        Write-Host ''
        Tot 'HOÀN TẤT. Trên điện thoại: mở Lưu Vị Trí -> Bắt đầu -> cho phép vị trí, bật định vị.'
        Write-Host 'Có thể rút cáp. Muốn an toàn hơn: tắt "Gỡ lỗi USB" trong Tùy chọn nhà phát triển.'
        if (-not (Hoi 'Cài cho điện thoại khác? (c/K)' $false)) { break }
        Write-Host 'Rút cáp điện thoại vừa cài, cắm điện thoại tiếp theo (đã bật Gỡ lỗi USB).'
        $cu = $script:may
        while (@((DanhSachMay) | Where-Object { $_.Serial -eq $cu -and $_.TrangThai -eq 'device' }).Count -gt 0) { Start-Sleep -Seconds 2 }
    }
} finally {
    if ($script:adb -and ($script:adb -like "$goc*")) { [void](Adb @('kill-server')) }
}
