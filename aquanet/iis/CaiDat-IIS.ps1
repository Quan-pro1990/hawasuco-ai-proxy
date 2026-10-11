# Cài AquaNet GIS lên máy chủ Windows có IIS – xem hướng dẫn chi tiết trong HUONG_DAN_IIS.md.
#
# Máy chủ cần có sẵn (cài 1 lần, xem Phần 1 của hướng dẫn):
#   IIS + ASP.NET Core Hosting Bundle · PostgreSQL + PostGIS · Python 3.11–3.13 (cài cho mọi người dùng)
#   · Node.js LTS (chỉ để dựng giao diện; không cần nếu dùng gói dựng sẵn)
#
# Chạy bằng CaiDat-IIS.bat (tự xin quyền quản trị). Tham số tuỳ chọn, vd:
#   CaiDat-IIS.bat -Cong 8443                 cổng HTTPS (mặc định 8443)
#   CaiDat-IIS.bat -DuLieu D:\AquaNetData     thư mục dữ liệu (mặc định C:\AquaNetData)
#   CaiDat-IIS.bat -ChungChi <thumbprint>     dùng chứng chỉ có sẵn (vd chứng chỉ thật của tên miền)
#   CaiDat-IIS.bat -TenMien gis.tenmien.vn    tên miền ghi vào chứng chỉ tự tạo và địa chỉ in ra
#   CaiDat-IIS.bat -DuLieuMau                 lần cài đầu: tạo dữ liệu mẫu để dùng thử
#   CaiDat-IIS.bat -DatMatKhau                đặt lại mật khẩu tài khoản quản trị admin
#   CaiDat-IIS.bat -KiemTra                   gọi thử máy chủ, in lỗi gần nhất
#   CaiDat-IIS.bat -GoBo                      gỡ site (giữ nguyên CSDL và thư mục dữ liệu)
#   CaiDat-IIS.bat -TaoGoi D:\GoiAquaNet      dựng sẵn gói cài cho máy chủ không có internet
param(
    [int]$Cong = 8443,
    [string]$TenSite = 'AquaNet',
    [string]$ThuMuc = "$env:SystemDrive\inetpub\AquaNet",
    [string]$DuLieu = "$env:SystemDrive\AquaNetData",
    [string]$ChungChi = '',
    [string]$TenMien = '',
    [string]$PgHost = 'localhost',
    [int]$PgPort = 5432,
    [string]$PgSuperUser = 'postgres',
    [string]$TenCsdl = 'capnuoc',
    [string]$PgUser = 'aquanet',
    [string]$Python = '',
    [switch]$DuLieuMau,
    [switch]$DatMatKhau,
    [switch]$KhongSaoLuu,
    [switch]$KiemTra,
    [switch]$GoBo,
    [string]$TaoGoi = ''
)

[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

$thuMucIis = Split-Path -Parent $MyInvocation.MyCommand.Path
$goc = Split-Path -Parent $thuMucIis          # thư mục aquanet: backend\, frontend\, iis\
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
$tenTuongLua = 'AquaNet GIS (IIS)'
$tenChungChi = 'AquaNet GIS (IIS)'
$tenTacVu = 'AquaNet GIS - Sao luu'
$appId = '{4b8f2e17-9c3a-4d6e-b1f5-7a2c9e0d3f68}'
$tepCaiDat = Join-Path $ThuMuc 'caidat.txt'
$tepEnv = Join-Path $DuLieu 'aquanet.env'
$venvPy = Join-Path $ThuMuc 'venv\Scripts\python.exe'

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }
function CanhBao([string]$s) { Write-Host $s -ForegroundColor Yellow }

# Chạy chương trình, gom kết quả (không hiện ra màn hình)
function Chay([string]$exe, [string[]]$thamSo) {
    $cu = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $ra = & $exe @thamSo 2>&1 | ForEach-Object { "$_" } }
    finally { $ErrorActionPreference = $cu }
    [pscustomobject]@{ Ma = $LASTEXITCODE; Ra = ($ra -join "`n") }
}

function AppCmd([string[]]$thamSo) {
    $r = Chay $appcmd $thamSo
    if ($r.Ma -ne 0) { Dung "appcmd $($thamSo -join ' '):`n$($r.Ra)" }
}

function CoTrongIis([string]$loai, [string]$ten) { (Chay $appcmd @('list', $loai, "/name:$ten")).Ma -eq 0 }

# Chạy python của venv tại thư mục cài đặt, hiện kết quả trực tiếp, trả về mã thoát
function ChayPy([string[]]$thamSo) {
    Push-Location $ThuMuc
    try { & $venvPy @thamSo | Out-Host; $ma = $LASTEXITCODE }
    finally { Pop-Location }
    $ma
}

function DocMatKhau([string]$hoi, [int]$toiThieu = 8, [switch]$KhongXacNhan) {
    while ($true) {
        $m1 = Read-Host $hoi -AsSecureString
        $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($m1))
        if ($KhongXacNhan) { return $p1 }
        if ($p1.Length -lt $toiThieu) { CanhBao "Mật khẩu cần ít nhất $toiThieu ký tự."; continue }
        $m2 = Read-Host 'Nhập lại mật khẩu' -AsSecureString
        $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($m2))
        if ($p1 -ne $p2) { CanhBao 'Hai lần nhập không giống nhau, nhập lại.'; continue }
        return $p1
    }
}

function SinhKhoa([int]$soByte = 32) {
    $b = New-Object byte[] $soByte
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    -join ($b | ForEach-Object { $_.ToString('x2') })
}

function GhiTep([string]$duong, [string[]]$dong) {
    [IO.File]::WriteAllText($duong, (($dong -join "`r`n") + "`r`n"), (New-Object Text.UTF8Encoding $false))
}

function DatQuyen([string]$duong, [string[]]$quyen) {
    $r = Chay icacls.exe (@($duong, '/inheritance:r', '/grant:r') + $quyen)
    if ($r.Ma -ne 0) { Dung "Không đặt được quyền cho $duong`:`n$($r.Ra)" }
}

function SaoChep([string]$nguon, [string]$dich) {
    & robocopy.exe $nguon $dich /MIR /XD __pycache__ node_modules /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Dung "Không chép được $nguon -> $dich (robocopy mã $LASTEXITCODE)" }
}

function MaNhanDang($cert) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $h = [BitConverter]::ToString($sha.ComputeHash($cert.GetRawCertData())) -replace '-', ''
    ($h.Substring(0, 4), $h.Substring(4, 4), $h.Substring(8, 4), $h.Substring(12, 4)) -join '-'
}

# Tìm Python 3.11+ cài cho mọi người dùng (app pool của IIS không đọc được Python trong C:\Users\...)
function TimPython {
    $ung = New-Object Collections.ArrayList
    if ($Python) { [void]$ung.Add($Python) }
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        foreach ($v in '3.12', '3.13', '3.11') {
            $r = Chay $py.Source @("-$v", '-c', 'import sys; print(sys.executable)')
            if ($r.Ma -eq 0) { [void]$ung.Add((($r.Ra.Trim()) -split "`n")[-1].Trim()) }
        }
    }
    foreach ($c in @(Get-Command python.exe -All -ErrorAction SilentlyContinue)) {
        if ($c.Source -notmatch 'WindowsApps') { [void]$ung.Add($c.Source) }
    }
    foreach ($f in @(Get-ChildItem "$env:ProgramFiles\Python3*\python.exe" -ErrorAction SilentlyContinue)) { [void]$ung.Add($f.FullName) }
    $caNhan = $null
    foreach ($u in $ung) {
        if (-not $u -or -not (Test-Path $u)) { continue }
        $r = Chay $u @('-c', 'import sys; print("%d.%d" % sys.version_info[:2])')
        if ($r.Ma -ne 0) { continue }
        $ver = $r.Ra.Trim()
        if ([version]$ver -lt [version]'3.11' -or [version]$ver -ge [version]'3.14') { continue }
        $exe = (Resolve-Path $u).Path
        if ($exe -like "$env:SystemDrive\Users\*") { if (-not $caNhan) { $caNhan = $exe }; continue }
        return [pscustomobject]@{ Exe = $exe; Ver = $ver }
    }
    if ($caNhan) {
        Dung ("Python đang cài riêng cho một người dùng ($caNhan) nên IIS không chạy được.`n" +
              "  Cài lại Python: chọn 'Customize installation' rồi đánh dấu 'Install Python for all users'.")
    }
    return $null
}

function TimNode {
    $n = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $n) { return $null }
    $v = (Chay $n.Source @('-v')).Ra.Trim().TrimStart('v')
    if ([version]$v -lt [version]'18.0') { CanhBao "Node.js $v quá cũ (cần 18 trở lên)."; return $null }
    $npm = Join-Path (Split-Path $n.Source) 'npm.cmd'
    if (-not (Test-Path $npm)) { return $null }
    [pscustomobject]@{ Node = $n.Source; Npm = $npm; Ver = $v }
}

function TimPgBin {
    $ds = New-Object Collections.ArrayList
    foreach ($k in @(Get-ChildItem 'HKLM:\SOFTWARE\PostgreSQL\Installations' -ErrorAction SilentlyContinue)) {
        $b = (Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue).'Base Directory'
        if ($b) { [void]$ds.Add((Join-Path $b 'bin')) }
    }
    $thu = @(Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { $v = 0; [void][int]::TryParse($_.Parent.Name, [ref]$v); $v } -Descending)
    foreach ($d in $thu) { [void]$ds.Add($d.FullName) }
    foreach ($d in $ds) { if (Test-Path (Join-Path $d 'pg_dump.exe')) { return $d } }
    return $null
}

# Dựng giao diện (React) – trả về thư mục chứa index.html
function DungGiaoDien {
    $fe = Join-Path $goc 'frontend'
    $dist = Join-Path $fe 'dist'
    $node = TimNode
    if ((Test-Path (Join-Path $fe 'package.json')) -and $node) {
        Buoc "Dựng giao diện bằng Node.js $($node.Ver) (lần đầu mất vài phút)"
        Push-Location $fe
        try {
            & $node.Npm ci --no-audit --no-fund | Out-Host
            if ($LASTEXITCODE -ne 0) { Dung 'npm ci lỗi – máy chủ cần internet để tải thư viện (hoặc dùng gói dựng sẵn: -TaoGoi).' }
            & $node.Npm run build | Out-Host
            if ($LASTEXITCODE -ne 0) { Dung 'Dựng giao diện lỗi (npm run build).' }
        }
        finally { Pop-Location }
    }
    elseif (Test-Path (Join-Path $dist 'index.html')) {
        if (Test-Path (Join-Path $fe 'package.json')) {
            CanhBao 'Chưa cài Node.js: dùng giao diện đã dựng sẵn trong frontend\dist (có thể là bản cũ).'
        }
        else { Write-Host 'Dùng giao diện dựng sẵn trong gói.' }
    }
    else {
        Dung ('Chưa có Node.js để dựng giao diện. Cài Node.js LTS (https://nodejs.org) rồi chạy lại,' +
              "`n  hoặc tạo gói dựng sẵn trên máy khác: CaiDat-IIS.bat -TaoGoi D:\GoiAquaNet")
    }
    if (-not (Test-Path (Join-Path $dist 'index.html'))) { Dung "Không thấy $dist\index.html sau khi dựng." }
    $dist
}

# Gọi https://127.0.0.1:cổng/api/health, lấy cả chứng chỉ máy chủ đưa ra
function GoiThu([int]$cong) {
    $kq = [pscustomobject]@{ Ok = $false; ChungChi = $null; Than = ''; Loi = '' }
    try {
        $tcp = New-Object Net.Sockets.TcpClient('127.0.0.1', $cong)
        $script:ccThu = $null
        $ssl = New-Object Net.Security.SslStream($tcp.GetStream(), $false, { param($s, $c, $ch, $e) $script:ccThu = $c; $true })
        $ssl.ReadTimeout = 120000
        $ssl.AuthenticateAsClient('localhost', $null, [Security.Authentication.SslProtocols]::Tls12, $false)
        $kq.ChungChi = $script:ccThu
        $yc = [Text.Encoding]::ASCII.GetBytes("GET /api/health HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n")
        $ssl.Write($yc, 0, $yc.Length)
        $ssl.Flush()
        $text = (New-Object IO.StreamReader($ssl, [Text.Encoding]::UTF8)).ReadToEnd()
        $tcp.Close()
        $kq.Than = $text
        $kq.Ok = ($text -split "`n")[0] -match ' 200 ' -and $text -match '"status"\s*:\s*"ok"'
    }
    catch { $kq.Loi = $_.Exception.Message }
    $kq
}

function InLoiGanNhat {
    $loi = Join-Path $DuLieu 'loi-khoi-dong.txt'
    if (Test-Path $loi) { Write-Host '--- loi-khoi-dong.txt:'; Get-Content $loi -Encoding UTF8 | Select-Object -Last 25 }
    $so = Get-ChildItem (Join-Path $DuLieu 'NhatKy') -Filter 'stdout*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1
    if ($so) { Write-Host "--- $($so.Name):"; Get-Content $so.FullName -Encoding UTF8 | Select-Object -Last 25 }
    $nk = Join-Path $DuLieu 'NhatKy\aquanet.log'
    if (Test-Path $nk) { Write-Host '--- aquanet.log:'; Get-Content $nk -Encoding UTF8 | Select-Object -Last 15 }
}

$caiTruoc = @{}
if (Test-Path $tepCaiDat) {
    Get-Content $tepCaiDat -Encoding UTF8 | ForEach-Object { if ($_ -match '^\s*([A-Za-z]+)\s*=\s*(.*)$') { $caiTruoc[$Matches[1]] = $Matches[2].Trim() } }
}
# chạy lại (cập nhật) không cần gõ lại tham số: dùng cổng và thư mục dữ liệu của lần cài trước
if ($caiTruoc['Cong'] -and -not $PSBoundParameters.ContainsKey('Cong')) { $Cong = [int]$caiTruoc['Cong'] }
if ($caiTruoc['DuLieu'] -and -not $PSBoundParameters.ContainsKey('DuLieu')) {
    $DuLieu = $caiTruoc['DuLieu']
    $tepEnv = Join-Path $DuLieu 'aquanet.env'
}

# ------------------------------------------------------------------ quyền quản trị

$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Cần quyền quản trị: hãy chạy CaiDat-IIS.bat (tự xin quyền).' }

# ------------------------------------------------------------------ tạo gói cho máy chủ không có internet

if ($TaoGoi) {
    Buoc "Tạo gói cài đặt dựng sẵn tại $TaoGoi"
    $py = TimPython
    if (-not $py) { Dung 'Cần Python 3.11–3.13 để tải thư viện cho gói.' }
    $dist = DungGiaoDien
    foreach ($d in 'backend', 'frontend', 'iis', 'wheels') { New-Item -ItemType Directory -Force (Join-Path $TaoGoi $d) | Out-Null }
    SaoChep (Join-Path $goc 'backend\app') (Join-Path $TaoGoi 'backend\app')
    Copy-Item (Join-Path $goc 'backend\requirements.txt') (Join-Path $TaoGoi 'backend') -Force
    SaoChep $dist (Join-Path $TaoGoi 'frontend\dist')
    SaoChep $thuMucIis (Join-Path $TaoGoi 'iis')
    Copy-Item (Join-Path $goc 'README.md') $TaoGoi -Force -ErrorAction SilentlyContinue
    Buoc "Tải thư viện Python cho Python $($py.Ver) (64-bit)"
    & $py.Exe -m pip download --disable-pip-version-check --only-binary=:all: -r (Join-Path $goc 'backend\requirements.txt') -d (Join-Path $TaoGoi 'wheels')
    if ($LASTEXITCODE -ne 0) { Dung 'pip download lỗi.' }
    GhiTep (Join-Path $TaoGoi 'wheels\PYTHON.txt') @($py.Ver)
    Write-Host ''
    Write-Host "ĐÃ TẠO GÓI: $TaoGoi" -ForegroundColor Green
    Write-Host "Chép cả thư mục sang máy chủ (đã cài Python $($py.Ver) cho mọi người dùng), chạy iis\CaiDat-IIS.bat."
    exit 0
}

if (-not (Test-Path $appcmd)) { Dung 'Máy này chưa bật IIS (xem Phần 1, bước 2 trong HUONG_DAN_IIS.md).' }

# ------------------------------------------------------------------ kiểm tra

if ($KiemTra) {
    $c = if ($caiTruoc['Cong']) { [int]$caiTruoc['Cong'] } else { $Cong }
    Buoc "Gọi thử https://127.0.0.1:$c/api/health"
    $t = GoiThu $c
    if ($t.Ok) {
        Write-Host 'OK: AquaNet GIS trả lời bình thường.' -ForegroundColor Green
        Write-Host "Mã nhận dạng chứng chỉ: $(MaNhanDang $t.ChungChi)"
        exit 0
    }
    Write-Host "Chưa được: $($t.Loi)" -ForegroundColor Red
    if ($t.Than) { Write-Host ($t.Than.Substring(0, [Math]::Min(800, $t.Than.Length))) }
    InLoiGanNhat
    exit 1
}

# ------------------------------------------------------------------ gỡ

if ($GoBo) {
    Buoc 'Gỡ AquaNet GIS khỏi IIS (giữ nguyên CSDL và thư mục dữ liệu)'
    if (CoTrongIis 'site' $TenSite) { AppCmd @('delete', 'site', "/site.name:$TenSite") }
    if (CoTrongIis 'apppool' $TenSite) { AppCmd @('delete', 'apppool', "/apppool.name:$TenSite") }
    $c2 = if ($caiTruoc['Cong']) { $caiTruoc['Cong'] } else { $Cong }
    foreach ($c in @(Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $tenChungChi })) {
        if ((Chay netsh.exe @('http', 'show', 'sslcert', "ipport=0.0.0.0:$c2")).Ra -match $c.Thumbprint) {
            Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$c2") | Out-Null
        }
        Remove-Item $c.PSPath
    }
    Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Unregister-ScheduledTask -TaskName $tenTacVu -Confirm:$false -ErrorAction SilentlyContinue
    if (Test-Path $ThuMuc) { Remove-Item -Recurse -Force $ThuMuc }
    Write-Host ''
    Write-Host "Đã gỡ xong. Còn giữ: thư mục dữ liệu $DuLieu và CSDL '$TenCsdl' trong PostgreSQL." -ForegroundColor Green
    Write-Host 'Muốn xóa hẳn CSDL: mở pgAdmin › Databases › capnuoc › Delete (hãy sao lưu trước).'
    exit 0
}

# ------------------------------------------------------------------ 1. kiểm tra máy chủ

Buoc '1/9 Kiểm tra máy chủ'
if ((Chay $appcmd @('list', 'config', '-section:system.webServer/globalModules')).Ra -notmatch 'AspNetCoreModuleV2') {
    Dung 'IIS chưa có ASP.NET Core Module V2. Cài "ASP.NET Core Hosting Bundle" (Phần 1, bước 3) rồi chạy lại.'
}
Write-Host 'IIS + ASP.NET Core Module V2: có.'
$py = TimPython
if (-not $py) { Dung 'Chưa cài Python 3.11–3.13 (Phần 1, bước 5). Nhớ chọn "Install Python for all users".' }
Write-Host "Python $($py.Ver): $($py.Exe)"
$banh = Join-Path $goc 'wheels'
if (Test-Path (Join-Path $banh 'PYTHON.txt')) {
    $verGoi = (Get-Content (Join-Path $banh 'PYTHON.txt') | Select-Object -First 1).Trim()
    if ($verGoi -ne $py.Ver) { Dung "Gói này dựng cho Python $verGoi nhưng máy chủ có Python $($py.Ver). Cài đúng Python $verGoi hoặc tạo lại gói." }
}
if (-not (Test-Path (Join-Path $goc 'backend\app\main.py'))) { Dung "Không thấy mã nguồn tại $goc\backend – hãy chạy từ thư mục aquanet\iis." }
$pgBin = TimPgBin
$laMayNay = $PgHost -in @('localhost', '127.0.0.1', $env:COMPUTERNAME)
if ($laMayNay) {
    $dv = @(Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue)
    if (-not $dv.Count) { Dung 'Chưa cài PostgreSQL trên máy này (Phần 1, bước 4).' }
    foreach ($s in $dv) { if ($s.Status -ne 'Running') { Start-Service $s.Name -ErrorAction SilentlyContinue } }
    Write-Host "PostgreSQL: $(($dv | ForEach-Object { $_.Name }) -join ', ')"
}

# chọn cổng: không trùng site IIS khác hay chương trình khác
$dsSite = [xml](Chay $appcmd @('list', 'site', '/xml')).Ra
foreach ($s in @($dsSite.appcmd.SITE)) {
    if (-not $s -or $s.'SITE.NAME' -eq $TenSite) { continue }
    foreach ($b in ($s.bindings -split ',')) {
        if ($b -match "^https?/[^:]*:${Cong}:") { Dung "Cổng $Cong đang dùng cho site IIS '$($s.'SITE.NAME')'. Chọn cổng khác, vd: CaiDat-IIS.bat -Cong 8444" }
    }
}
if (-not (CoTrongIis 'site' $TenSite)) {
    $nghe = @(Get-NetTCPConnection -LocalPort $Cong -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 4 })
    if ($nghe.Count -gt 0) {
        $p = Get-Process -Id $nghe[0].OwningProcess -ErrorAction SilentlyContinue
        Dung "Cổng $Cong đang bị chương trình '$($p.ProcessName)' dùng. Chọn cổng khác: -Cong <số>"
    }
}

# ------------------------------------------------------------------ 2. giao diện

Buoc '2/9 Giao diện web'
$dist = DungGiaoDien

# ------------------------------------------------------------------ 3. dừng bản đang chạy, chép chương trình

Buoc "3/9 Chép chương trình vào $ThuMuc"
if (CoTrongIis 'apppool' $TenSite) {
    Chay $appcmd @('stop', 'apppool', "/apppool.name:$TenSite") | Out-Null
    Start-Sleep -Seconds 5
}
$cu = @(Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ThuMuc*run_iis.py*" })
foreach ($p in $cu) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force $ThuMuc | Out-Null
SaoChep (Join-Path $goc 'backend\app') (Join-Path $ThuMuc 'app')
SaoChep $dist (Join-Path $ThuMuc 'static')
foreach ($f in @((Join-Path $goc 'backend\requirements.txt'), (Join-Path $thuMucIis 'run_iis.py'),
                 (Join-Path $thuMucIis 'caidat.py'), (Join-Path $thuMucIis 'SaoLuu.ps1'),
                 (Join-Path $thuMucIis 'GanChungChi.ps1'))) {
    Copy-Item $f $ThuMuc -Force
}
Write-Host 'Đã chép mã nguồn và giao diện.'

# ------------------------------------------------------------------ 4. môi trường Python

Buoc '4/9 Thư viện Python'
if (Test-Path $venvPy) {
    $r = Chay $venvPy @('-c', 'import sys; print("%d.%d" % sys.version_info[:2])')
    if ($r.Ma -ne 0 -or $r.Ra.Trim() -ne $py.Ver) {
        CanhBao 'Môi trường Python cũ không khớp phiên bản – tạo lại.'
        Remove-Item -Recurse -Force (Join-Path $ThuMuc 'venv')
    }
}
if (-not (Test-Path $venvPy)) {
    & $py.Exe -m venv (Join-Path $ThuMuc 'venv')
    if ($LASTEXITCODE -ne 0) { Dung 'Không tạo được môi trường Python (venv).' }
}
$req = Join-Path $ThuMuc 'requirements.txt'
if (Test-Path $banh) {
    & $venvPy -m pip install --disable-pip-version-check --no-index --find-links $banh -r $req
}
else {
    & $venvPy -m pip install --disable-pip-version-check -r $req
}
if ($LASTEXITCODE -ne 0) { Dung 'Cài thư viện Python lỗi – máy chủ cần internet (hoặc dùng gói dựng sẵn: -TaoGoi).' }
& $venvPy -m compileall -q (Join-Path $ThuMuc 'app') | Out-Null
Write-Host 'Thư viện Python: đủ.'

# ------------------------------------------------------------------ 5. app pool, thư mục dữ liệu

Buoc "5/9 App pool '$TenSite' và thư mục dữ liệu $DuLieu"
if (-not (CoTrongIis 'apppool' $TenSite)) { AppCmd @('add', 'apppool', "/name:$TenSite") }
AppCmd @('set', 'apppool', "/apppool.name:$TenSite", '/managedRuntimeVersion:', '/managedPipelineMode:Integrated',
         '/processModel.idleTimeout:00:00:00', '/startMode:AlwaysRunning')
foreach ($d in @($DuLieu, (Join-Path $DuLieu 'anh'), (Join-Path $DuLieu 'NhatKy'), (Join-Path $DuLieu 'SaoLuu'), (Join-Path $DuLieu 'tmp'))) {
    New-Item -ItemType Directory -Force $d | Out-Null
}
DatQuyen $DuLieu @('*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', "IIS AppPool\${TenSite}:(OI)(CI)M")
DatQuyen $ThuMuc @('*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-568:(OI)(CI)RX', '*S-1-5-17:(OI)(CI)RX')
Write-Host "Chỉ quản trị và app pool '$TenSite' đọc/ghi được thư mục dữ liệu."

# ------------------------------------------------------------------ 6. CSDL

Buoc "6/9 Cơ sở dữ liệu PostgreSQL '$TenCsdl'"
if (-not (Test-Path $tepEnv)) {
    $matKhauCsdl = SinhKhoa 24
    $env:AQUANET_DB_PASSWORD = $matKhauCsdl
    try {
        for ($lan = 1; $lan -le 3; $lan++) {
            $env:PG_SUPER_PASSWORD = DocMatKhau "Mật khẩu tài khoản '$PgSuperUser' của PostgreSQL (đặt lúc cài PostgreSQL)" -KhongXacNhan
            $ma = ChayPy @('caidat.py', 'taocsdl', '--host', $PgHost, '--port', "$PgPort", '--superuser', $PgSuperUser,
                           '--db', $TenCsdl, '--user', $PgUser)
            if ($ma -ne 2) { break }
            CanhBao 'Thử lại.'
        }
    }
    finally {
        Remove-Item Env:\PG_SUPER_PASSWORD, Env:\AQUANET_DB_PASSWORD -ErrorAction SilentlyContinue
    }
    if ($ma -ne 0) { Dung 'Không tạo được CSDL (xem thông báo ở trên).' }
    GhiTep $tepEnv @(
        '# Cấu hình bí mật của AquaNet GIS – chỉ quản trị và app pool đọc được. KHÔNG gửi tệp này cho người khác.',
        '# Sửa xong: IIS Manager › Application Pools › AquaNet › Recycle (hoặc chạy lại CaiDat-IIS.bat).',
        "DATABASE_URL=postgresql+psycopg://${PgUser}:${matKhauCsdl}@${PgHost}:${PgPort}/${TenCsdl}",
        "SECRET_KEY=$(SinhKhoa 32)",
        '# khóa cho cổng thu thập SCADA / đồng hồ thông minh gửi số liệu (header X-API-Key)',
        "INGEST_API_KEYS=$(SinhKhoa 20)",
        'TIMEZONE=Asia/Ho_Chi_Minh',
        "SEED_DEMO=$(if ($DuLieuMau) { '1' } else { '0' })",
        '# TILE_URL_TEMPLATE=http://may-chu:3000/aquanet_network/{z}/{x}/{y}'
    )
    GhiTep (Join-Path $DuLieu 'pgpass.conf') @("${PgHost}:${PgPort}:${TenCsdl}:${PgUser}:${matKhauCsdl}")
    $matKhauCsdl = $null
    Write-Host "Đã lưu cấu hình vào $tepEnv"
}
else { Write-Host "Đã có cấu hình $tepEnv – giữ nguyên." }
DatQuyen $tepEnv @('*S-1-5-32-544:F', '*S-1-5-18:F', "IIS AppPool\${TenSite}:R")
if (Test-Path (Join-Path $DuLieu 'pgpass.conf')) { DatQuyen (Join-Path $DuLieu 'pgpass.conf') @('*S-1-5-32-544:F', '*S-1-5-18:F') }

$env:AQUANET_DULIEU = $DuLieu
$thamSo = @('caidat.py', 'khoitao')
if ($DuLieuMau) { $thamSo += '--dulieumau' }
$ma = ChayPy $thamSo
if ($ma -eq 3 -or ($ma -eq 0 -and $DatMatKhau)) {
    Buoc 'Tài khoản quản trị AquaNet (tên đăng nhập: admin)'
    $env:AQUANET_ADMIN_PASSWORD = DocMatKhau 'Mật khẩu cho admin (ít nhất 8 ký tự)'
    try {
        if ($ma -eq 3) { $ma = ChayPy $thamSo } else { $ma = ChayPy @('caidat.py', 'matkhau') }
    }
    finally { Remove-Item Env:\AQUANET_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
}
if ($ma -ne 0) { Dung 'Khởi tạo CSDL lỗi (xem thông báo ở trên).' }

# ------------------------------------------------------------------ 7. web.config, chứng chỉ, site

Buoc '7/9 Site IIS và chứng chỉ HTTPS'
$cfg = Join-Path $ThuMuc 'web.config'
Copy-Item (Join-Path $thuMucIis 'web.config') $cfg -Force
$x = New-Object Xml.XmlDocument
$x.PreserveWhitespace = $true
$x.Load($cfg)
$a = $x.SelectSingleNode('//aspNetCore')
$a.SetAttribute('processPath', $venvPy)
$a.SetAttribute('arguments', '"' + (Join-Path $ThuMuc 'run_iis.py') + '"')
$a.SetAttribute('stdoutLogFile', (Join-Path $DuLieu 'NhatKy\stdout'))
$x.SelectSingleNode("//environmentVariable[@name='AQUANET_DULIEU']").SetAttribute('value', $DuLieu)
foreach ($ten in 'TEMP', 'TMP') { $x.SelectSingleNode("//environmentVariable[@name='$ten']").SetAttribute('value', (Join-Path $DuLieu 'tmp')) }
$x.Save($cfg)

if ($ChungChi) {
    $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq ($ChungChi -replace '\s', '').ToUpper() } | Select-Object -First 1
    if (-not $cert) { Dung "Không thấy chứng chỉ $ChungChi trong LocalMachine\My." }
}
else {
    # giữ chứng chỉ còn hạn đang gắn trên cổng (vd. chứng chỉ thật do win-acme / GanChungChi.ps1 gắn)
    $cert = $null
    $m = [regex]::Match((Chay netsh.exe @('http', 'show', 'sslcert', "ipport=0.0.0.0:$Cong")).Ra, '\b[0-9a-fA-F]{40}\b')
    if ($m.Success) {
        $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $m.Value.ToUpper() -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } |
            Select-Object -First 1
        if ($cert) { Write-Host 'Giữ chứng chỉ đang gắn trên cổng này.' }
    }
    if (-not $cert) {
        $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $tenChungChi -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
    }
    if (-not $cert) {
        $ten = @($TenMien, $env:COMPUTERNAME, 'localhost') | Where-Object { $_ } | Select-Object -Unique
        try {
            $cert = New-SelfSignedCertificate -DnsName $ten -CertStoreLocation Cert:\LocalMachine\My -NotAfter (Get-Date).AddYears(10) `
                -FriendlyName $tenChungChi -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy NonExportable -ErrorAction Stop
        }
        catch {
            # Windows Server 2012 R2: lệnh không có các tham số trên
            $cert = New-SelfSignedCertificate -DnsName $ten -CertStoreLocation Cert:\LocalMachine\My
            $cert.FriendlyName = $tenChungChi
        }
        Write-Host 'Đã tạo chứng chỉ tự ký (dùng thử được; dùng thật nên có chứng chỉ tên miền – xem hướng dẫn Phần 4).'
    }
}
Write-Host "Chứng chỉ: $($cert.Subject) – mã nhận dạng $(MaNhanDang $cert)"

if (CoTrongIis 'site' $TenSite) {
    AppCmd @('set', 'site', "/site.name:$TenSite", "/bindings:https/*:${Cong}:")
    AppCmd @('set', 'vdir', "$TenSite/", "/physicalPath:$ThuMuc")
}
else {
    AppCmd @('add', 'site', "/name:$TenSite", "/bindings:https/*:${Cong}:", "/physicalPath:$ThuMuc")
}
AppCmd @('set', 'app', "$TenSite/", "/applicationPool:$TenSite", '/preloadEnabled:true')
$cuCong = $caiTruoc['Cong']
if ($cuCong -and $cuCong -ne "$Cong") { Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$cuCong") | Out-Null }
Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$Cong") | Out-Null
$r = Chay netsh.exe @('http', 'add', 'sslcert', "ipport=0.0.0.0:$Cong", "certhash=$($cert.Thumbprint)", "appid=$appId", 'certstorename=MY')
if ($r.Ma -ne 0) { Dung "Không gắn được chứng chỉ vào cổng $Cong`:`n$($r.Ra)" }
Write-Host "Site '$TenSite': https cổng $Cong -> $ThuMuc"
GhiTep $tepCaiDat @("Cong=$Cong", "DuLieu=$DuLieu", "Python=$($py.Ver)", "PgBin=$pgBin", "CaiLuc=$(Get-Date -Format s)")

# ------------------------------------------------------------------ 8. tường lửa, sao lưu

Buoc "8/9 Tường lửa (cổng $Cong) và sao lưu tự động"
Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $tenTuongLua -Direction Inbound -Protocol TCP -LocalPort $Cong -Action Allow -Profile Any | Out-Null
Write-Host "Tường lửa Windows: đã mở cổng $Cong."
$saoLuu = 'tắt'
if ($KhongSaoLuu) { Unregister-ScheduledTask -TaskName $tenTacVu -Confirm:$false -ErrorAction SilentlyContinue }
elseif (-not $pgBin) { CanhBao 'Không thấy pg_dump.exe (PostgreSQL không cài trên máy này?) – bỏ qua sao lưu tự động.' }
else {
    $lenh = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $ThuMuc 'SaoLuu.ps1')`" -DuLieu `"$DuLieu`" -PgBin `"$pgBin`""
    $tv = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $lenh
    $kh = New-ScheduledTaskTrigger -Daily -At '01:30'
    $ai = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $tenTacVu -Action $tv -Trigger $kh -Principal $ai -Force | Out-Null
    $saoLuu = "1:30 sáng hằng ngày -> $DuLieu\SaoLuu (giữ 30 ngày)"
    Write-Host "Sao lưu tự động: $saoLuu"
}

# ------------------------------------------------------------------ 9. khởi động, gọi thử

Buoc '9/9 Khởi động và gọi thử (lần đầu Python khởi động mất vài giây)'
Chay $appcmd @('start', 'apppool', "/apppool.name:$TenSite") | Out-Null
Chay $appcmd @('start', 'site', "/site.name:$TenSite") | Out-Null
$t = $null
for ($i = 0; $i -lt 12; $i++) {
    $t = GoiThu $Cong
    if ($t.Ok) { break }
    Start-Sleep -Seconds 5
}
$maCc = if ($t.ChungChi) { MaNhanDang $t.ChungChi } else { MaNhanDang $cert }
$diaChi = if ($TenMien) { $TenMien } else { $env:COMPUTERNAME }
$ip = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { $_.IPAddress })

Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
Write-Host " ĐÃ CÀI XONG AquaNet GIS – HTTPS cổng $Cong" -ForegroundColor Green
Write-Host " Mở trên máy chủ:      https://localhost:$Cong/"
Write-Host " Máy khác trong mạng:  https://${diaChi}:$Cong/   $(if ($ip) { '(hoặc https://' + $ip[0] + ":$Cong/)" })"
Write-Host " Ứng dụng hiện trường: https://${diaChi}:$Cong/field"
Write-Host ' Đăng nhập:            admin / (mật khẩu bạn vừa đặt)'
Write-Host " Mã nhận dạng chứng chỉ: $maCc"
Write-Host " Dữ liệu:              $DuLieu   (ảnh, nhật ký, sao lưu, cấu hình aquanet.env)"
Write-Host " Sao lưu:              $saoLuu"
Write-Host ''
Write-Host ' Trình duyệt báo "Kết nối không riêng tư" là do chứng chỉ tự ký: bấm Nâng cao › Tiếp tục.'
Write-Host ' Ứng dụng hiện trường chạy offline trên điện thoại cần chứng chỉ thật – xem HUONG_DAN_IIS.md, Phần 4.'
Write-Host '==============================================================' -ForegroundColor Green
if (-not $t.Ok) {
    CanhBao " Gọi thử CHƯA thành công: $($t.Loi)"
    InLoiGanNhat
    CanhBao ' Sửa lỗi rồi chạy lại CaiDat-IIS.bat, hoặc kiểm tra lại: CaiDat-IIS.bat -KiemTra'
    exit 1
}
