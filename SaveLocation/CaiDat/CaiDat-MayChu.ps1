# Cài máy chủ "Chia sẻ vị trí trực tiếp" cho ứng dụng Lưu Vị Trí trên Windows (máy tính / máy chủ chạy 24/7).
# Máy chủ là một file Node.js (MayChu\live-server.js). Script sẽ:
#   - kiểm tra Node.js, nếu chưa có thì tự cài bản LTS (winget hoặc bộ cài .msi từ nodejs.org);
#   - chép máy chủ vào C:\LuuViTriMayChu, dữ liệu ở C:\LuuViTriMayChu\data;
#   - tạo tác vụ tự chạy khi bật máy (Task Scheduler, tài khoản SYSTEM, tự khởi động lại nếu lỗi);
#   - mở tường lửa cổng 3000, chạy thử và in ra địa chỉ để nhập vào app.
#
# Chạy bằng CaiDat-MayChu.bat (tự xin quyền quản trị). Tham số tuỳ chọn:
#   CaiDat-MayChu.bat -Cong 3100                 cổng khác (mặc định 3000)
#   CaiDat-MayChu.bat -ThuMuc D:\LuuViTriMayChu   thư mục cài khác
#   CaiDat-MayChu.bat -KiemTra                    gọi thử máy chủ đang chạy
#   CaiDat-MayChu.bat -GoBo                       gỡ tác vụ + tường lửa (giữ thư mục dữ liệu)
param(
    [int]$Cong = 0,
    [string]$ThuMuc = '',
    [switch]$KiemTra,
    [switch]$GoBo
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
$nguon = Join-Path $goc 'MayChu'
$tenTacVu = 'LuuViTri - May chu vi tri truc tiep'
$tenTuongLua = 'LuuViTri - May chu vi tri truc tiep'
$thuMucMacDinh = "$env:SystemDrive\LuuViTriMayChu"

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }
function CanhBao([string]$s) { Write-Host $s -ForegroundColor Yellow }
function Tot([string]$s) { Write-Host $s -ForegroundColor Green }

# Đọc lựa chọn của lần cài trước (cổng, thư mục)
$tepCaiDatCu = Join-Path $(if ($ThuMuc) { $ThuMuc } else { $thuMucMacDinh }) 'caidat.txt'
$cu = @{}
if (Test-Path $tepCaiDatCu) {
    foreach ($d in Get-Content $tepCaiDatCu) { if ($d -match '^(\w+)=(.*)$') { $cu[$Matches[1]] = $Matches[2] } }
}
if (-not $ThuMuc) { $ThuMuc = $(if ($cu['ThuMuc']) { $cu['ThuMuc'] } else { $thuMucMacDinh }) }
if ($Cong -le 0) { $Cong = $(if ($cu['Cong']) { [int]$cu['Cong'] } else { 3000 }) }
$tepCaiDat = Join-Path $ThuMuc 'caidat.txt'

function DiaChiLan {
    try {
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
            ForEach-Object { $_.IPAddress }
    } catch { @() }
}

function GoiThu([int]$soLan) {
    for ($i = 0; $i -lt $soLan; $i++) {
        try {
            # WebClient không qua proxy hệ thống (máy có cấu hình proxy vẫn gọi được 127.0.0.1)
            $wc = New-Object Net.WebClient
            $wc.Proxy = $null
            $noiDung = $wc.DownloadString("http://127.0.0.1:$Cong/health")
            if ($noiDung -match '"ok":true') { return $true }
        } catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

function DungMayChuCu {
    if (Get-ScheduledTask -TaskName $tenTacVu -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $tenTacVu -ErrorAction SilentlyContinue
    }
    $mau = '*' + $ThuMuc.TrimEnd('\') + '*'
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like $mau } |
        ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
}

function InDiaChi {
    Write-Host ''
    Tot 'Nhập một trong các địa chỉ sau vào app (Cài đặt -> Máy chủ vị trí trực tiếp):'
    $ds = @(DiaChiLan)
    foreach ($ip in $ds) { Write-Host "    http://${ip}:$Cong" }
    if ($ds.Count -eq 0) { Write-Host "    http://<địa chỉ IP máy này>:$Cong" }
    Write-Host ''
    Write-Host 'Địa chỉ trong mạng nội bộ chỉ dùng được khi điện thoại và người xem cùng mạng.'
    Write-Host "Để người ngoài mở được link: mở cổng $Cong trên modem/router (port forwarding) về máy này"
    Write-Host "rồi dùng http://<IP tĩnh hoặc tên miền>:$Cong — hoặc đặt sau IIS/HTTPS (xem HUONG_DAN_CAI_DAT.txt)."
}

# ------------------------------------------------------------------ Gỡ bỏ
if ($GoBo) {
    Buoc 'Gỡ máy chủ vị trí trực tiếp'
    DungMayChuCu
    if (Get-ScheduledTask -TaskName $tenTacVu -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $tenTacVu -Confirm:$false
        Write-Host 'Đã xoá tác vụ tự chạy.'
    }
    Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host 'Đã xoá quy tắc tường lửa.'
    Tot "Xong. Thư mục $ThuMuc (có dữ liệu) vẫn giữ nguyên — xoá tay nếu không cần."
    exit 0
}

# ------------------------------------------------------------------ Kiểm tra
if ($KiemTra) {
    Buoc "Gọi thử http://127.0.0.1:$Cong/health"
    if (GoiThu 3) { Tot 'Máy chủ đang chạy bình thường.'; InDiaChi } else {
        Dung "Không gọi được máy chủ. Xem nhật ký $ThuMuc\data\log.txt hoặc chạy lại CaiDat-MayChu.bat."
    }
    exit 0
}

Write-Host '=================================================='
Write-Host '  CÀI MÁY CHỦ "CHIA SẺ VỊ TRÍ TRỰC TIẾP" (LƯU VỊ TRÍ)'
Write-Host '=================================================='
Write-Host "Thư mục cài: $ThuMuc    Cổng: $Cong"
foreach ($f in @('live-server.js', 'viewer.html')) {
    if (-not (Test-Path (Join-Path $nguon $f))) { Dung "Thiếu $nguon\$f — hãy giải nén đầy đủ gói cài đặt." }
}

# ------------------------------------------------------------------ 1. Node.js
Buoc '1. Kiểm tra Node.js'
function TimNode {
    $lenh = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($lenh) { return $lenh.Source }
    foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe")) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}
$node = TimNode
if (-not $node) {
    CanhBao 'Máy chưa có Node.js — tự cài bản LTS...'
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host 'Cài bằng winget...'
        & $winget.Source install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements | Out-Host
        $node = TimNode
    }
    if (-not $node) {
        Write-Host 'Tải bộ cài từ nodejs.org...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        try {
            $ds = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
            $lts = $ds | Where-Object { $_.lts } | Select-Object -First 1
            $kieu = $(if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' })
            $url = "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-$kieu.msi"
            $msi = Join-Path $env:TEMP "node-$($lts.version)-$kieu.msi"
            Write-Host "Đang tải $url ..."
            Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
            Write-Host 'Đang cài Node.js (1-2 phút)...'
            $p = Start-Process msiexec.exe -ArgumentList @('/i', "`"$msi`"", '/qn', '/norestart') -Wait -PassThru
            Remove-Item $msi -ErrorAction SilentlyContinue
            if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { Dung "Cài Node.js lỗi (mã $($p.ExitCode))." }
        } catch {
            Dung "Không tự cài được Node.js: $($_.Exception.Message)`nHãy tải và cài bản LTS tại https://nodejs.org rồi chạy lại."
        }
        $node = TimNode
    }
    if (-not $node) { Dung 'Đã cài Node.js nhưng chưa tìm thấy node.exe — khởi động lại máy rồi chạy lại script.' }
}
$phienBan = (& $node -v).Trim()
$so = 0
[void][int]::TryParse(($phienBan.TrimStart('v') -split '\.')[0], [ref]$so)
if ($so -lt 18) { Dung "Node.js $phienBan quá cũ, cần bản 18 trở lên (https://nodejs.org)." }
Tot "Node.js $phienBan  ($node)"

# ------------------------------------------------------------------ 2. Cổng
Buoc "2. Kiểm tra cổng $Cong"
DungMayChuCu
Start-Sleep -Seconds 1
$dangDung = Get-NetTCPConnection -LocalPort $Cong -State Listen -ErrorAction SilentlyContinue
if ($dangDung) {
    $pid0 = ($dangDung | Select-Object -First 1).OwningProcess
    $ten = (Get-Process -Id $pid0 -ErrorAction SilentlyContinue).ProcessName
    Dung "Cổng $Cong đang được chương trình khác dùng ($ten, PID $pid0). Chạy lại với cổng khác, vd:  CaiDat-MayChu.bat -Cong 3100"
}
Tot "Cổng $Cong còn trống."

# ------------------------------------------------------------------ 3. Chép chương trình
Buoc "3. Chép máy chủ vào $ThuMuc"
New-Item -ItemType Directory -Force -Path $ThuMuc | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ThuMuc 'data') | Out-Null
foreach ($f in @('live-server.js', 'viewer.html', 'README.md')) {
    $src = Join-Path $nguon $f
    if (Test-Path $src) { Copy-Item $src -Destination $ThuMuc -Force }
}
$chay = Join-Path $ThuMuc 'chay.cmd'
$noiDung = @(
    '@echo off',
    'rem Chay may chu vi tri truc tiep (do CaiDat-MayChu.bat tao ra)',
    "set PORT=$Cong",
    'cd /d "%~dp0"',
    "`"$node`" `"%~dp0live-server.js`" >> `"%~dp0data\log.txt`" 2>&1"
)
[IO.File]::WriteAllLines($chay, $noiDung, (New-Object Text.ASCIIEncoding))
[IO.File]::WriteAllLines($tepCaiDat, @("ThuMuc=$ThuMuc", "Cong=$Cong", "Node=$node"), (New-Object Text.UTF8Encoding($false)))
Tot 'Đã chép.'

# ------------------------------------------------------------------ 4. Tự chạy khi bật máy
Buoc '4. Tạo tác vụ tự chạy khi bật máy (Task Scheduler)'
if (Get-ScheduledTask -TaskName $tenTacVu -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $tenTacVu -Confirm:$false
}
$hanhDong = New-ScheduledTaskAction -Execute "$env:windir\System32\cmd.exe" -Argument "/c `"$chay`"" -WorkingDirectory $ThuMuc
$kichHoat = New-ScheduledTaskTrigger -AtStartup
$taiKhoan = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$caiDatTV = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $tenTacVu -Action $hanhDong -Trigger $kichHoat -Principal $taiKhoan -Settings $caiDatTV `
    -Description 'May chu chia se vi tri truc tiep cho ung dung Luu Vi Tri' | Out-Null
Tot "Đã tạo tác vụ '$tenTacVu'."

# ------------------------------------------------------------------ 5. Tường lửa
Buoc "5. Mở tường lửa cổng $Cong"
Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $tenTuongLua -Direction Inbound -Protocol TCP -LocalPort $Cong -Action Allow -Profile Any | Out-Null
Tot 'Đã mở.'

# ------------------------------------------------------------------ 6. Chạy thử
Buoc '6. Chạy máy chủ và gọi thử'
Start-ScheduledTask -TaskName $tenTacVu
if (GoiThu 15) {
    Tot "Máy chủ đang chạy: http://127.0.0.1:$Cong/health"
} else {
    $nk = Join-Path $ThuMuc 'data\log.txt'
    if (Test-Path $nk) { Get-Content $nk -Tail 15 | Out-Host }
    Dung "Máy chủ chưa phản hồi. Xem nhật ký $nk"
}
InDiaChi
Write-Host ''
Write-Host 'Máy chủ tự chạy lại mỗi khi bật máy. Gỡ bỏ: CaiDat-MayChu.bat -GoBo'
