# Chuẩn bị máy chủ Windows MỚI CÀI cho AquaNet GIS – cài toàn bộ phần mềm nền, rồi (tuỳ chọn) cài luôn AquaNet.
# Xem HUONG_DAN_IIS.md, Phần 0 và Phần 1.
#
# Script tự bỏ qua phần mềm đã có, nên chạy lại nhiều lần an toàn. Cài lần lượt:
#   1. Cấu hình chung: múi giờ Việt Nam (UTC+7), chế độ điện năng hiệu năng cao
#   2. IIS (kèm IIS Manager, Application Initialization)
#   3. ASP.NET Core Hosting Bundle (module để IIS chạy AquaNet)
#   4. PostgreSQL 16 (hỏi mật khẩu tài khoản postgres)  5. PostGIS
#   6. Python 3.12 (cho mọi người dùng)  7. Node.js LTS
#
# Tệp cài đặt đặt sẵn trong thư mục tải về (mặc định C:\CaiDat\TaiVe) được dùng trước, không tải lại – máy chủ
# không có internet: chép sẵn các tệp cài vào đó (xem Phần 6 của hướng dẫn).
#
# Chạy bằng ChuanBi-MayChu.bat (tự xin quyền quản trị). Tham số tuỳ chọn, vd:
#   ChuanBi-MayChu.bat -PgDuLieu D:\PostgreSQL\16\data -DuLieu D:\AquaNetData
#                       dữ liệu PostgreSQL và dữ liệu AquaNet (ảnh, sao lưu) trên ổ D (khuyên dùng khi có ổ D)
#   ChuanBi-MayChu.bat -KhongCaiAquaNet       chỉ cài phần mềm nền, không hỏi cài AquaNet
param(
    [int]$PgPhienBan = 16,
    [string]$PgDuLieu = '',
    [string]$DuLieu = '',            # chuyển cho CaiDat-IIS.ps1 (thư mục dữ liệu AquaNet)
    [string]$PythonPhienBan = '3.12.10',
    [string]$ThuMucTai = "$env:SystemDrive\CaiDat\TaiVe",
    [switch]$KhongCaiAquaNet
)

[Console]::OutputEncoding = [Text.Encoding]::UTF8
# Windows Server 2016 mặc định chưa bật TLS 1.2 cho PowerShell -> không tải được từ các trang hiện nay
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'   # thanh tiến trình làm Invoke-WebRequest chậm hàng chục lần

$thuMucIis = Split-Path -Parent $MyInvocation.MyCommand.Path
$canKhoiDongLai = $false
$coMang = $true
$ketQua = New-Object Collections.ArrayList

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }
function CanhBao([string]$s) { Write-Host $s -ForegroundColor Yellow }
function Ghi([string]$ten, [string]$tt) { [void]$ketQua.Add([pscustomobject]@{ 'Thành phần' = $ten; 'Trạng thái' = $tt }); Write-Host "$ten`: $tt" }

function LamMoiPath {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

# Tệp tải về phải đúng loại (đề phòng trang tải trả về trang báo lỗi HTML)
function DungLoai([string]$tep) {
    $b = New-Object byte[] 4
    $f = [IO.File]::OpenRead($tep)
    try { [void]$f.Read($b, 0, 4) } finally { $f.Close() }
    switch ([IO.Path]::GetExtension($tep).ToLower()) {
        '.exe' { return $b[0] -eq 0x4D -and $b[1] -eq 0x5A }                       # MZ
        '.msi' { return $b[0] -eq 0xD0 -and $b[1] -eq 0xCF -and $b[2] -eq 0x11 }   # OLE
        '.zip' { return $b[0] -eq 0x50 -and $b[1] -eq 0x4B }                       # PK
        default { return $true }
    }
}

function Tai([string]$url, [string]$tep) {
    if (-not $script:coMang) { return $false }
    New-Item -ItemType Directory -Force (Split-Path $tep) | Out-Null
    for ($lan = 1; $lan -le 3; $lan++) {
        try {
            # TimeoutSec 0: không giới hạn tổng thời gian (bộ cài PostgreSQL ~300 MB)
            Invoke-WebRequest -Uri $url -OutFile $tep -UseBasicParsing -TimeoutSec 0 -ErrorAction Stop
            if ((Get-Item $tep).Length -gt 0 -and (DungLoai $tep)) { return $true }
            break
        }
        catch {
            $ma = 0
            if ($_.Exception.Response) { $ma = [int]$_.Exception.Response.StatusCode }
            if ($ma -ge 400 -and $ma -lt 500) { break }   # không có tệp: khỏi thử lại
            if ($lan -lt 3) { Start-Sleep -Seconds (5 * $lan) }
        }
    }
    Remove-Item $tep -Force -ErrorAction SilentlyContinue
    return $false
}

# Tệp cài có sẵn trong thư mục tải về (bản mới nhất: so số theo giá trị, 16.10 > 16.9), $loc: biểu thức chính quy lọc thêm tên tệp
function TepCoSan([string]$mau, [string]$loc = '') {
    $dem = [Text.RegularExpressions.MatchEvaluator] { param($m) $m.Value.PadLeft(8, '0') }
    Get-ChildItem -Path $ThuMucTai -Filter $mau -File -ErrorAction SilentlyContinue |
        Where-Object { (-not $loc -or $_.Name -match $loc) -and (DungLoai $_.FullName) } |
        Sort-Object { [regex]::Replace($_.Name, '\d+', $dem) } -Descending | Select-Object -First 1 | ForEach-Object { $_.FullName }
}

function ThieuTep([string]$ten, [string]$mau, [string]$noiTai) {
    Dung ("Không tải được $ten" + $(if (-not $coMang) { ' (máy không có internet)' } else { '' }) +
          ".`n  Tải tay tại $noiTai, chép tệp ($mau) vào $ThuMucTai rồi chạy lại.")
}

# Chạy bộ cài, chờ xong; 0 = được, 3010 / 1641 = được nhưng cần khởi động lại máy
function ChayCai([string]$exe, [string]$thamSo, [string]$ten) {
    Write-Host "Đang cài $ten (vài phút, cửa sổ có thể đứng yên)…"
    $p = Start-Process -FilePath $exe -ArgumentList $thamSo -Wait -PassThru
    if ($p.ExitCode -in 3010, 1641) { $script:canKhoiDongLai = $true; return $true }
    if ($p.ExitCode -ne 0) { CanhBao "Bộ cài $ten trả mã lỗi $($p.ExitCode)."; return $false }
    return $true
}

function CoAncm {
    $appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
    if (-not (Test-Path $appcmd)) { return $false }
    ((& $appcmd list config -section:system.webServer/globalModules) -join "`n") -match 'AspNetCoreModuleV2'
}

function TimThuMucPg([int]$ban) {
    foreach ($k in @(Get-ChildItem 'HKLM:\SOFTWARE\PostgreSQL\Installations' -ErrorAction SilentlyContinue)) {
        $b = (Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue).'Base Directory'
        if ($b -and (Test-Path (Join-Path $b 'bin\psql.exe')) -and ($k.PSChildName -match "-$ban$" -or $b -match "\\$ban$")) { return $b }
    }
    $mac = Join-Path $env:ProgramFiles "PostgreSQL\$ban"
    if (Test-Path (Join-Path $mac 'bin\psql.exe')) { return $mac }
    return $null
}

function TimPython {
    $ung = New-Object Collections.ArrayList
    foreach ($f in @(Get-ChildItem "$env:ProgramFiles\Python3*\python.exe" -ErrorAction SilentlyContinue)) { [void]$ung.Add($f.FullName) }
    foreach ($c in @(Get-Command python.exe -All -ErrorAction SilentlyContinue)) { if ($c.Source -notmatch 'WindowsApps') { [void]$ung.Add($c.Source) } }
    foreach ($u in $ung) {
        if ($u -like "$env:SystemDrive\Users\*") { continue }
        $v = (& $u -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null)   # không dùng dấu " trong tham số (lỗi của PowerShell 5.1)
        if ($LASTEXITCODE -eq 0 -and $v -and [version]$v -ge [version]'3.11' -and [version]$v -lt [version]'3.14') {
            return [pscustomobject]@{ Exe = $u; Ver = $v }
        }
    }
    return $null
}

function TimNode {
    $ung = @((Get-Command node.exe -ErrorAction SilentlyContinue | ForEach-Object { $_.Source }), (Join-Path $env:ProgramFiles 'nodejs\node.exe'))
    foreach ($u in $ung) {
        if ($u -and (Test-Path $u)) {
            $v = (& $u -v 2>$null)
            if ($v -and [version]($v.TrimStart('v')) -ge [version]'18.0') { return $v }
        }
    }
    return $null
}

# ------------------------------------------------------------------ 0. quyền, mạng

$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Cần quyền quản trị: hãy chạy ChuanBi-MayChu.bat (tự xin quyền).' }
$os = Get-CimInstance Win32_OperatingSystem
$laServer = $os.ProductType -ne 1
Write-Host "Máy: $env:COMPUTERNAME · $($os.Caption) · RAM $([Math]::Round($os.TotalVisibleMemorySize / 1MB, 1)) GB"
if ([Environment]::Is64BitOperatingSystem -eq $false) { Dung 'Cần Windows 64-bit.' }
New-Item -ItemType Directory -Force $ThuMucTai | Out-Null
$tmp = Join-Path $env:TEMP 'kiemtra-mang.json'
$dsNode = $null
$coMang = Tai 'https://nodejs.org/dist/index.json' $tmp
if ($coMang) { $dsNode = Get-Content $tmp -Raw -Encoding UTF8 | ConvertFrom-Json }
else {
    CanhBao ("Máy chủ chưa ra được internet (hoặc cần proxy). Chỉ dùng được tệp cài có sẵn trong $ThuMucTai" +
             ' – xem Phần 6 của hướng dẫn.')
}
foreach ($o in Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -ne $null -and $_.Root -match '^[A-Z]:\\$' }) {
    if ($o.Free -lt 20GB -and $o.Root -eq "$env:SystemDrive\") { CanhBao "Ổ $($o.Root) chỉ còn $([Math]::Round($o.Free / 1GB)) GB trống (nên có từ 30 GB)." }
}

# ------------------------------------------------------------------ 1. cấu hình chung

Buoc '1/7 Cấu hình chung'
if ((Get-TimeZone).Id -ne 'SE Asia Standard Time') {
    Set-TimeZone -Id 'SE Asia Standard Time'
    Ghi 'Múi giờ' 'đã đặt UTC+07:00 (Bangkok, Hà Nội, Jakarta)'
}
else { Ghi 'Múi giờ' 'UTC+07:00 – đúng' }
& powercfg.exe /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null | Out-Null   # High performance
if ($LASTEXITCODE -eq 0) { Ghi 'Điện năng' 'hiệu năng cao (không ngủ, không tắt ổ đĩa)' }
else { Ghi 'Điện năng' 'giữ nguyên (máy không có chế độ High performance)' }

# ------------------------------------------------------------------ 2. IIS

Buoc '2/7 IIS'
if ($laServer) {
    $tinh = @('Web-Server', 'Web-Mgmt-Console', 'Web-AppInit', 'Web-Request-Monitor', 'Web-Http-Logging', 'Web-Filtering')
    $thieu = @($tinh | Where-Object { -not (Get-WindowsFeature $_).Installed })
    if ($thieu.Count) {
        Write-Host "Đang bật: $($thieu -join ', ')"
        $r = Install-WindowsFeature -Name $thieu -IncludeManagementTools
        if (-not $r.Success) { Dung 'Không bật được IIS. Thử lại bằng Server Manager › Add Roles and Features › Web Server (IIS).' }
        if ($r.RestartNeeded -eq 'Yes') { $canKhoiDongLai = $true }
        Ghi 'IIS' 'đã cài'
    }
    else { Ghi 'IIS' 'đã có' }
}
else {
    $tinh = @('IIS-WebServerRole', 'IIS-WebServer', 'IIS-ManagementConsole', 'IIS-ApplicationInit', 'IIS-RequestMonitor', 'IIS-HttpLogging', 'IIS-RequestFiltering')
    $thieu = @($tinh | Where-Object { (Get-WindowsOptionalFeature -Online -FeatureName $_).State -ne 'Enabled' })
    if ($thieu.Count) {
        $r = Enable-WindowsOptionalFeature -Online -All -NoRestart -FeatureName $thieu
        if ($r.RestartNeeded) { $canKhoiDongLai = $true }
        Ghi 'IIS' 'đã cài'
    }
    else { Ghi 'IIS' 'đã có' }
}

# ------------------------------------------------------------------ 3. ASP.NET Core Hosting Bundle (sau IIS)

Buoc '3/7 ASP.NET Core Hosting Bundle'
if (CoAncm) { Ghi 'Hosting Bundle' 'đã có' }
else {
    $tep = TepCoSan 'dotnet-hosting-*.exe'
    if (-not $tep) {
        $tep = Join-Path $ThuMucTai 'dotnet-hosting-win.exe'
        $ok = $false
        foreach ($u in 'https://dotnet.microsoft.com/permalink/dotnetcore-current-windows-runtime-bundle-installer',
                       'https://aka.ms/dotnet/8.0/dotnet-hosting-win.exe') {
            if (Tai $u $tep) { $ok = $true; break }
        }
        if (-not $ok) { ThieuTep 'Hosting Bundle' 'dotnet-hosting-….exe' 'https://dotnet.microsoft.com/download/dotnet (ASP.NET Core Runtime › Hosting Bundle)' }
    }
    if (-not (ChayCai $tep '/install /quiet /norestart' 'Hosting Bundle')) { Dung 'Cài Hosting Bundle lỗi.' }
    & net.exe stop was /y 2>$null | Out-Null
    & net.exe start w3svc 2>$null | Out-Null
    if (-not (CoAncm)) { $canKhoiDongLai = $true; CanhBao 'Chưa thấy ASP.NET Core Module trong IIS – sẽ có sau khi khởi động lại máy.' }
    Ghi 'Hosting Bundle' 'đã cài'
}

# ------------------------------------------------------------------ 4. PostgreSQL

Buoc "4/7 PostgreSQL $PgPhienBan"
$pgDir = TimThuMucPg $PgPhienBan
if ($pgDir) { Ghi 'PostgreSQL' "đã có ($pgDir)" }
else {
    Write-Host 'Đặt mật khẩu cho tài khoản quản trị CSDL "postgres". GHI RA GIẤY – bộ cài AquaNet sẽ hỏi lại mật khẩu này.'
    while ($true) {
        $m1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host 'Mật khẩu postgres (ít nhất 8 ký tự)' -AsSecureString)))
        $m2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host 'Nhập lại' -AsSecureString)))
        if ($m1 -ne $m2) { CanhBao 'Hai lần nhập không giống nhau.'; continue }
        if ($m1.Length -lt 8) { CanhBao 'Mật khẩu quá ngắn.'; continue }
        if ($m1 -match '["\s]') { CanhBao 'Mật khẩu không được chứa dấu nháy kép hay khoảng trắng.'; continue }
        break
    }
    # bộ cài EDB: tệp có sẵn, hoặc thử tải từ bản vá mới nhất trở xuống
    $tep = TepCoSan "postgresql-$PgPhienBan.*-windows-x64.exe"
    for ($va = 25; -not $tep -and $coMang -and $va -ge 0; $va--) {
        $ten = "postgresql-$PgPhienBan.$va-1-windows-x64.exe"
        $t = Join-Path $ThuMucTai $ten
        Write-Host "Thử tải $ten…"
        if (Tai "https://get.enterprisedb.com/postgresql/$ten" $t) { $tep = $t }
    }
    if (-not $tep) { ThieuTep "bộ cài PostgreSQL $PgPhienBan" "postgresql-$PgPhienBan.x-1-windows-x64.exe" 'https://www.enterprisedb.com/downloads/postgres-postgresql-downloads' }
    $thamSo = "--mode unattended --unattendedmodeui minimal --superpassword `"$m1`" --serverport 5432"
    if ($PgDuLieu) { New-Item -ItemType Directory -Force (Split-Path $PgDuLieu) | Out-Null; $thamSo += " --datadir `"$PgDuLieu`"" }
    $ok = ChayCai $tep $thamSo "PostgreSQL ($(Split-Path $tep -Leaf))"
    $m1 = $null; $m2 = $null; $thamSo = $null
    $pgDir = TimThuMucPg $PgPhienBan
    if (-not $ok -or -not $pgDir) { Dung 'Cài PostgreSQL chưa thành công. Xem nhật ký trong %TEMP% (install-postgresql.log).' }
    Ghi 'PostgreSQL' "đã cài ($pgDir)"
}
$dv = Get-Service -Name "postgresql*$PgPhienBan*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($dv) {
    Set-Service $dv.Name -StartupType Automatic
    if ($dv.Status -ne 'Running') { Start-Service $dv.Name }
}

# ------------------------------------------------------------------ 5. PostGIS

Buoc '5/7 PostGIS'
if (Test-Path (Join-Path $pgDir 'share\extension\postgis.control')) { Ghi 'PostGIS' 'đã có' }
else {
    $mauZip = "postgis-bundle-pg$PgPhienBan-(\d+\.\d+\.\d+)x64\.zip"
    $zip = TepCoSan "postgis-bundle-pg$PgPhienBan-*x64.zip" $mauZip
    if (-not $zip -and $coMang) {
        # danh sách tệp trên trang chính thức -> chọn bản mới nhất
        $goc = "https://download.osgeo.org/postgis/windows/pg$PgPhienBan/"
        $ds = $null
        try { $ds = (Invoke-WebRequest -Uri $goc -UseBasicParsing -TimeoutSec 60).Content } catch { }
        $ban = @()
        if ($ds) { $ban = @([regex]::Matches($ds, $mauZip) | ForEach-Object { $_.Groups[1].Value } | Sort-Object { [version]$_ } -Descending -Unique) }
        if ($ban.Count) {
            $ten = "postgis-bundle-pg$PgPhienBan-$($ban[0])x64.zip"
            $zip = Join-Path $ThuMucTai $ten
            if (-not (Tai ($goc + $ten) $zip)) { $zip = $null }
        }
    }
    if (-not $zip) {
        ThieuTep 'PostGIS' "postgis-bundle-pg$PgPhienBan-3.x.xx64.zip" ("https://download.osgeo.org/postgis/windows/pg$PgPhienBan/" +
                 "`n  (hoặc cài bằng Stack Builder: Start › PostgreSQL › Application Stack Builder › Spatial Extensions › PostGIS)")
    }
    $banPostgis = ([regex]::Match((Split-Path $zip -Leaf), $mauZip)).Groups[1].Value
    $giai = Join-Path $ThuMucTai 'postgis'
    Remove-Item -Recurse -Force $giai -ErrorAction SilentlyContinue
    Expand-Archive -Path $zip -DestinationPath $giai -Force
    $nguon = Get-ChildItem $giai -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'share') } | Select-Object -First 1
    if (-not $nguon) { $nguon = Get-Item $giai }
    # gói zip chính thức: chép nguyên bin, lib, share… vào thư mục cài PostgreSQL (dừng dịch vụ để không bị khóa tệp)
    if ($dv) { Stop-Service $dv.Name -Force }
    foreach ($d in @(Get-ChildItem $nguon.FullName -Directory)) {
        Copy-Item -Path $d.FullName -Destination $pgDir -Recurse -Force
    }
    if ($dv) { Start-Service $dv.Name }
    if (-not (Test-Path (Join-Path $pgDir 'share\extension\postgis.control'))) { Dung 'Chép PostGIS chưa đúng – cài tay bằng Stack Builder.' }
    Ghi 'PostGIS' "đã cài $banPostgis"
}

# ------------------------------------------------------------------ 6. Python

Buoc "6/7 Python"
$py = TimPython
if ($py) { Ghi 'Python' "đã có $($py.Ver) ($($py.Exe))" }
else {
    $tep = TepCoSan 'python-3.1*-amd64.exe' '^python-3\.1[123]\.\d+-amd64\.exe$'
    if (-not $tep) {
        $ten = "python-$PythonPhienBan-amd64.exe"
        $tep = Join-Path $ThuMucTai $ten
        if (-not (Tai "https://www.python.org/ftp/python/$PythonPhienBan/$ten" $tep)) {
            ThieuTep 'Python' "python-$PythonPhienBan-amd64.exe" 'https://www.python.org/downloads/windows/ (Windows installer 64-bit)'
        }
    }
    if (-not (ChayCai $tep '/quiet InstallAllUsers=1 PrependPath=1 Include_test=0 Include_launcher=1 InstallLauncherAllUsers=1' "Python ($(Split-Path $tep -Leaf))")) {
        Dung 'Cài Python lỗi.'
    }
    LamMoiPath
    $py = TimPython
    if (-not $py) { Dung 'Đã chạy bộ cài nhưng chưa thấy Python trong C:\Program Files.' }
    Ghi 'Python' "đã cài $($py.Ver)"
}

# ------------------------------------------------------------------ 7. Node.js LTS (dựng giao diện)

Buoc '7/7 Node.js LTS'
$nv = TimNode
if ($nv) { Ghi 'Node.js' "đã có $nv" }
else {
    $tep = TepCoSan 'node-v*-x64.msi'
    if (-not $tep -and $dsNode) {
        $lts = $dsNode | Where-Object { $_.lts -and ($_.files -contains 'win-x64-msi') } | Select-Object -First 1
        if ($lts) {
            $tep = Join-Path $ThuMucTai "node-$($lts.version)-x64.msi"
            if (-not (Tai "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-x64.msi" $tep)) { $tep = $null }
        }
    }
    if ($tep) {
        $ten = Split-Path $tep -Leaf
        if (-not (ChayCai 'msiexec.exe' "/i `"$tep`" /qn /norestart" "Node.js ($ten)")) { Dung 'Cài Node.js lỗi.' }
        LamMoiPath
        Ghi 'Node.js' "đã cài ($ten)"
    }
    elseif (-not $coMang) { Ghi 'Node.js' 'bỏ qua (không có internet; gói dựng sẵn -TaoGoi không cần Node.js)' }
    else { ThieuTep 'Node.js' 'node-v….-x64.msi' 'https://nodejs.org (bản LTS, Windows Installer .msi)' }
}

# Windows Defender: không quét thư mục dữ liệu PostgreSQL (khuyến cáo của PostgreSQL, tránh chậm và lỗi khóa tệp)
if (Get-Command Add-MpPreference -ErrorAction SilentlyContinue) {
    $pgData = if ($PgDuLieu) { $PgDuLieu } else { Join-Path $pgDir 'data' }
    try { Add-MpPreference -ExclusionPath $pgData -ErrorAction Stop; Ghi 'Windows Defender' "bỏ qua quét $pgData" } catch { }
}

# ------------------------------------------------------------------ tổng kết

Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
Write-Host ' ĐÃ CHUẨN BỊ XONG MÁY CHỦ' -ForegroundColor Green
$ketQua | Format-Table -AutoSize | Out-Host
Write-Host '==============================================================' -ForegroundColor Green
# lệnh cài AquaNet (giữ thư mục dữ liệu đã chọn)
$lenhCai = 'CaiDat-IIS.bat' + $(if ($DuLieu) { " -DuLieu $DuLieu" } else { '' })
if ($canKhoiDongLai) {
    CanhBao "Cần KHỞI ĐỘNG LẠI máy chủ. Sau khi khởi động lại, chạy $lenhCai (thư mục $thuMucIis) để cài AquaNet."
    $tl = Read-Host 'Khởi động lại ngay bây giờ? (C/K)'
    if ($tl -match '^[cCyY]') { Restart-Computer -Force }
    exit 0
}
if ($KhongCaiAquaNet -or (-not $coMang -and -not (Test-Path (Join-Path $thuMucIis '..\wheels')))) {
    Write-Host "Bước tiếp theo: chạy $lenhCai để cài AquaNet (máy không có internet: dùng gói dựng sẵn, Phần 6)."
    exit 0
}
$tl = Read-Host 'Cài AquaNet GIS ngay bây giờ? (C/K)'
if ($tl -match '^[cCyY]') {
    LamMoiPath
    $ts = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $thuMucIis 'CaiDat-IIS.ps1'))
    if ($DuLieu) { $ts += @('-DuLieu', $DuLieu) }
    & powershell.exe @ts
    exit $LASTEXITCODE
}
Write-Host "Khi sẵn sàng: chạy $lenhCai để cài AquaNet."
