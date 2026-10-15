# Cài máy chủ IIS cho phần mềm "Quản lý tài sản" (quét tem QR xem thông tin, ảnh tài sản).
# Dữ liệu nằm trên máy chủ; máy tính và điện thoại dùng trình duyệt kết nối vào qua HTTPS (camera quét QR cần https).
# Máy chủ cần có sẵn IIS + ASP.NET Core Hosting Bundle (script KHÔNG cài thêm tính năng Windows nào).
#
# Chạy bằng CaiDat-IIS.bat (tự xin quyền quản trị). Tham số tuỳ chọn, vd:
#   CaiDat-IIS.bat -Cong 8080                        cổng (mặc định 8080)
#   CaiDat-IIS.bat -DuLieu D:\QuanLyTaiSanData       thư mục dữ liệu (mặc định C:\QuanLyTaiSanData)
#   CaiDat-IIS.bat -DuongDan /taisan                 cài thành ứng dụng con của site đang dùng cổng đó (mặc định /taisan)
#   CaiDat-IIS.bat -ChungChi <thumbprint>            dùng chứng chỉ có sẵn (vd chứng chỉ tên miền) thay vì tự tạo
#   CaiDat-IIS.bat -TenMien tenmien.vn               tên miền / IP ghi vào chứng chỉ tự tạo
#   CaiDat-IIS.bat -DatMatKhau                       đặt lại mật khẩu tài khoản quản trị
#   CaiDat-IIS.bat -KiemTra                          gọi thử máy chủ
#   CaiDat-IIS.bat -GoBo                             gỡ site / ứng dụng (giữ nguyên thư mục dữ liệu)
param(
    [int]$Cong = 8080,
    [string]$TenSite = 'QuanLyTaiSan',
    [string]$ThuMuc = "$env:SystemDrive\inetpub\QuanLyTaiSan",
    [string]$DuLieu = "$env:SystemDrive\QuanLyTaiSanData",
    [string]$DuongDan = '',
    [string]$ChungChi = '',
    [string]$TenMien = '',
    [switch]$DatMatKhau,
    [switch]$KiemTra,
    [switch]$GoBo
)

$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
$exeGoi = Join-Path $goc 'web\QuanLyTaiSan.exe'
$tenTuongLua = 'Quan ly tai san (IIS)'
$tenChungChi = 'Quan ly tai san (IIS)'
$appId = '{6d1b3f0e-9a4c-4e58-b2d7-31c5a8e0f497}'
$tepCaiDat = Join-Path $ThuMuc 'caidat.txt'

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }
function CanhBao([string]$s) { Write-Host $s -ForegroundColor Yellow }

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

function MaNhanDang($cert) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $h = [BitConverter]::ToString($sha.ComputeHash($cert.GetRawCertData())) -replace '-', ''
    ($h.Substring(0, 4), $h.Substring(4, 4), $h.Substring(8, 4), $h.Substring(12, 4)) -join '-'
}

# Đọc lại lựa chọn của lần cài trước (site riêng hay ứng dụng con của site nào)
$caiTruoc = @{}
if (Test-Path $tepCaiDat) {
    Get-Content $tepCaiDat -Encoding UTF8 | ForEach-Object { if ($_ -match '^\s*([A-Za-z]+)\s*=\s*(.*)$') { $caiTruoc[$Matches[1]] = $Matches[2].Trim() } }
}

# Gọi https://127.0.0.1:cổng/đường-dẫn/api/ping, lấy cả chứng chỉ máy chủ đưa ra
function GoiThu([int]$cong, [string]$duong) {
    $kq = [pscustomobject]@{ Ok = $false; ChungChi = $null; Than = ''; Loi = '' }
    try {
        $tcp = New-Object Net.Sockets.TcpClient('127.0.0.1', $cong)
        $script:ccThu = $null
        $ssl = New-Object Net.Security.SslStream($tcp.GetStream(), $false, { param($s, $c, $ch, $e) $script:ccThu = $c; $true })
        $ssl.ReadTimeout = 60000
        $ssl.AuthenticateAsClient('localhost', $null, [Security.Authentication.SslProtocols]::Tls12, $false)
        $kq.ChungChi = $script:ccThu
        $yc = [Text.Encoding]::ASCII.GetBytes("GET $($duong.TrimEnd('/'))/api/ping HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n")
        $ssl.Write($yc, 0, $yc.Length)
        $ssl.Flush()
        $sr = New-Object IO.StreamReader($ssl, [Text.Encoding]::UTF8)
        $text = $sr.ReadToEnd()
        $tcp.Close()
        $kq.Than = $text
        $kq.Ok = ($text -split "`n")[0] -match ' 200 ' -and $text -match 'QuanLyTaiSan'
    }
    catch { $kq.Loi = $_.Exception.Message }
    $kq
}

# ------------------------------------------------------------------ kiểm tra quyền, IIS

$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Cần quyền quản trị: hãy chạy CaiDat-IIS.bat (tự xin quyền).' }
if (-not (Test-Path $appcmd)) { Dung 'Máy này chưa có IIS.' }

if ($KiemTra) {
    $duong = if ($caiTruoc['DuongDan']) { $caiTruoc['DuongDan'] } else { $DuongDan }
    $c = if ($caiTruoc['Cong']) { [int]$caiTruoc['Cong'] } else { $Cong }
    Buoc "Gọi thử https://127.0.0.1:$c$duong/api/ping"
    $t = GoiThu $c $duong
    if ($t.Ok) {
        Write-Host 'OK: máy chủ Quản lý tài sản trả lời bình thường.' -ForegroundColor Green
        Write-Host "Mã nhận dạng chứng chỉ: $(MaNhanDang $t.ChungChi)"
        exit 0
    }
    Write-Host "Chưa được: $($t.Loi)" -ForegroundColor Red
    if ($t.Than) { Write-Host ($t.Than.Substring(0, [Math]::Min(600, $t.Than.Length))) }
    Write-Host "Xem thêm nhật ký: $DuLieu\NhatKy và $DuLieu\loi-khoi-dong.txt"
    exit 1
}

# ------------------------------------------------------------------ gỡ

if ($GoBo) {
    Buoc 'Gỡ máy chủ Quản lý tài sản khỏi IIS (giữ nguyên thư mục dữ liệu)'
    $siteCha = $caiTruoc['SiteCha']
    if ($siteCha) {
        $app = "$siteCha$($caiTruoc['DuongDan'])"
        if ((Chay $appcmd @('list', 'app', $app)).Ma -eq 0) { AppCmd @('delete', 'app', $app) }
    }
    if (CoTrongIis 'site' $TenSite) { AppCmd @('delete', 'site', "/site.name:$TenSite") }
    if (CoTrongIis 'apppool' $TenSite) { AppCmd @('delete', 'apppool', "/apppool.name:$TenSite") }
    $cc = @(Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $tenChungChi })
    foreach ($c in $cc) {
        $c2 = if ($caiTruoc['Cong']) { $caiTruoc['Cong'] } else { $Cong }
        if ((Chay netsh.exe @('http', 'show', 'sslcert', "ipport=0.0.0.0:$c2")).Ra -match $c.Thumbprint) {
            Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$c2") | Out-Null
        }
        Remove-Item $c.PSPath
    }
    Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    if (Test-Path $ThuMuc) { Remove-Item -Recurse -Force $ThuMuc }
    Write-Host ''
    Write-Host "Đã gỡ xong. Dữ liệu vẫn còn ở: $DuLieu" -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $exeGoi)) { Dung 'Thiếu web\QuanLyTaiSan.exe trong gói. Trên máy có mã nguồn chạy build.bat để tạo gói GoiCaiDat-IIS.' }

Buoc 'Kiểm tra IIS và ASP.NET Core Hosting Bundle'
if ((Chay $appcmd @('list', 'config', '-section:system.webServer/globalModules')).Ra -notmatch 'AspNetCoreModuleV2') {
    Dung 'IIS chưa có ASP.NET Core Module V2. Hãy cài ASP.NET Core Hosting Bundle rồi chạy lại.'
}
Write-Host 'IIS + ASP.NET Core Module V2: có.'

# ------------------------------------------------------------------ chọn cách cài: site riêng hay ứng dụng con

Buoc "Cổng $Cong"
$siteCha = ''
$giaoThuc = 'https'
$dsSite = [xml](Chay $appcmd @('list', 'site', '/xml')).Ra
foreach ($s in @($dsSite.appcmd.SITE)) {
    if (-not $s -or $s.'SITE.NAME' -eq $TenSite) { continue }
    foreach ($b in ($s.bindings -split ',')) {
        if ($b -match "^(https?)/[^:]*:${Cong}:") { $siteCha = $s.'SITE.NAME'; $giaoThuc = $Matches[1] }
    }
}
if ($siteCha) {
    if (-not $DuongDan) { $DuongDan = if ($caiTruoc['DuongDan']) { $caiTruoc['DuongDan'] } else { '/taisan' } }
    if (-not $DuongDan.StartsWith('/')) { $DuongDan = '/' + $DuongDan }
    $DuongDan = $DuongDan.TrimEnd('/')
    Write-Host "Cổng $Cong đang dùng cho site IIS '$siteCha' ($giaoThuc) → cài thành ứng dụng con: $siteCha$DuongDan"
    if ($giaoThuc -ne 'https') {
        CanhBao "CẢNH BÁO: site '$siteCha' dùng http (không mã hoá) — mật khẩu và số liệu đi qua internet không được bảo vệ."
        CanhBao 'Nên đổi binding cổng này sang https trong IIS Manager (hoặc cài site riêng ở cổng khác: -Cong <số>).'
    }
}
else {
    $DuongDan = ''
    $nghe = @(Get-NetTCPConnection -LocalPort $Cong -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 4 })
    if ($nghe.Count -gt 0) {
        $p = Get-Process -Id $nghe[0].OwningProcess -ErrorAction SilentlyContinue
        Dung "Cổng $Cong đang bị chương trình '$($p.ProcessName)' (không phải IIS) dùng."
    }
    Write-Host "Cài thành site riêng '$TenSite', https cổng $Cong."
}

# ------------------------------------------------------------------ chép chương trình

Buoc "Chép chương trình vào $ThuMuc"
if (CoTrongIis 'apppool' $TenSite) {
    Chay $appcmd @('stop', 'apppool', "/apppool.name:$TenSite") | Out-Null
    Start-Sleep -Seconds 4   # chờ QuanLyTaiSan.exe cũ lưu dữ liệu và thoát
}
New-Item -ItemType Directory -Force $ThuMuc | Out-Null
try { Copy-Item (Join-Path $goc 'web\*') $ThuMuc -Recurse -Force -ErrorAction Stop }
catch { Dung "Không chép được vào $ThuMuc`: $($_.Exception.Message)" }
$cfgWeb = Join-Path $ThuMuc 'web.config'
$x = New-Object Xml.XmlDocument
$x.PreserveWhitespace = $true
$x.Load($cfgWeb)
$x.SelectSingleNode("//environmentVariable[@name='QLTS_DULIEU']").SetAttribute('value', $DuLieu)
$x.Save($cfgWeb)
$r = Chay icacls.exe @($ThuMuc, '/inheritance:r', '/grant:r', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F',
                       '*S-1-5-32-568:(OI)(CI)RX', '*S-1-5-17:(OI)(CI)RX')
if ($r.Ma -ne 0) { CanhBao "Không đặt được quyền thư mục web: $($r.Ra)" }
Write-Host 'Đã chép.'

# ------------------------------------------------------------------ app pool

Buoc "App pool '$TenSite'"
if (-not (CoTrongIis 'apppool' $TenSite)) { AppCmd @('add', 'apppool', "/name:$TenSite") }
AppCmd @('set', 'apppool', "/apppool.name:$TenSite", '/managedRuntimeVersion:', '/managedPipelineMode:Integrated',
         '/processModel.idleTimeout:00:00:00', '/startMode:AlwaysRunning')
Write-Host 'No Managed Code, không tự tắt khi rảnh.'

# ------------------------------------------------------------------ thư mục dữ liệu

Buoc "Thư mục dữ liệu $DuLieu"
New-Item -ItemType Directory -Force $DuLieu | Out-Null
$r = Chay icacls.exe @($DuLieu, '/inheritance:r', '/grant:r', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', "IIS AppPool\${TenSite}:(OI)(CI)M")
if ($r.Ma -ne 0) { Dung "Không cấp quyền ghi thư mục dữ liệu cho app pool:`n$($r.Ra)" }
Write-Host "App pool '$TenSite' được ghi; người dùng thường không đọc được (tài khoản, mật khẩu đã băm, ảnh tài sản)."

$tepMayChu = Join-Path $DuLieu 'taikhoan.xml'
$coQuanTri = (Test-Path $tepMayChu) -and ((Get-Content $tepMayChu -Raw -Encoding UTF8) -match 'vaiTro="QuanTri"')
if (-not $coQuanTri -or $DatMatKhau) {
    Buoc 'Tài khoản quản trị (toàn quyền: danh mục, tài khoản người dùng, cài đặt)'
    $ten = Read-Host 'Tên đăng nhập quản trị [admin]'
    if (-not $ten) { $ten = 'admin' }
    while ($true) {
        $m1 = Read-Host 'Mật khẩu (ít nhất 6 ký tự)' -AsSecureString
        $m2 = Read-Host 'Nhập lại mật khẩu' -AsSecureString
        $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($m1))
        $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($m2))
        if ($p1 -ne $p2) { CanhBao 'Hai lần nhập không giống nhau, nhập lại.'; continue }
        if ($p1.Length -lt 6) { CanhBao 'Mật khẩu quá ngắn.'; continue }
        break
    }
    $env:QLTS_DULIEU = $DuLieu
    $env:QLTS_MATKHAU = $p1
    try {
        $pr = Start-Process -FilePath (Join-Path $ThuMuc 'QuanLyTaiSan.exe') -ArgumentList @('--dat-quan-tri', $ten) -Wait -PassThru -NoNewWindow
    }
    finally {
        Remove-Item Env:\QLTS_MATKHAU -ErrorAction SilentlyContinue
        $p1 = $null; $p2 = $null
    }
    if ($pr.ExitCode -ne 0) { Dung "Không tạo được tài khoản (mã $($pr.ExitCode)). Xem $DuLieu\loi-khoi-dong.txt" }
    Write-Host "Đã đặt tài khoản quản trị '$ten'." -ForegroundColor Green
}

# ------------------------------------------------------------------ site / ứng dụng con

$cert = $null
if ($siteCha) {
    Buoc "Ứng dụng '$siteCha$DuongDan'"
    if (CoTrongIis 'site' $TenSite) { AppCmd @('delete', 'site', "/site.name:$TenSite") }
    $app = "$siteCha$DuongDan"
    if ((Chay $appcmd @('list', 'app', $app)).Ma -eq 0) {
        AppCmd @('set', 'app', $app, "/applicationPool:$TenSite")
        AppCmd @('set', 'vdir', "$app/", "/physicalPath:$ThuMuc")
    }
    else {
        AppCmd @('add', 'app', "/site.name:$siteCha", "/path:$DuongDan", "/physicalPath:$ThuMuc", "/applicationPool:$TenSite")
    }
    Write-Host "Đã tạo: https://<máy chủ>:$Cong$DuongDan/"
}
else {
    Buoc 'Chứng chỉ HTTPS'
    if ($ChungChi) {
        $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq ($ChungChi -replace '\s', '').ToUpper() } | Select-Object -First 1
        if (-not $cert) { Dung "Không thấy chứng chỉ $ChungChi trong LocalMachine\My." }
    }
    else {
        $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $tenChungChi -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
            Sort-Object NotAfter -Descending | Select-Object -First 1
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
            Write-Host 'Đã tạo chứng chỉ tự ký (trình duyệt sẽ cảnh báo lần đầu; nên dùng chứng chỉ thật của tên miền: -ChungChi).'
        }
    }
    Write-Host "Chứng chỉ: $($cert.Subject) — mã nhận dạng $(MaNhanDang $cert)"

    Buoc "Site '$TenSite'"
    if (CoTrongIis 'site' $TenSite) {
        AppCmd @('set', 'site', "/site.name:$TenSite", "/bindings:https/*:${Cong}:")
        AppCmd @('set', 'vdir', "$TenSite/", "/physicalPath:$ThuMuc")
    }
    else {
        AppCmd @('add', 'site', "/name:$TenSite", "/bindings:https/*:${Cong}:", "/physicalPath:$ThuMuc")
    }
    AppCmd @('set', 'app', "$TenSite/", "/applicationPool:$TenSite")
    Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$Cong") | Out-Null
    $r = Chay netsh.exe @('http', 'add', 'sslcert', "ipport=0.0.0.0:$Cong", "certhash=$($cert.Thumbprint)", "appid=$appId", 'certstorename=MY')
    if ($r.Ma -ne 0) { Dung "Không gắn được chứng chỉ vào cổng $Cong`:`n$($r.Ra)" }
    Write-Host "Site '$TenSite': https cổng $Cong → $ThuMuc"
}

@("Cong=$Cong", "SiteCha=$siteCha", "DuongDan=$DuongDan", "DuLieu=$DuLieu") | Set-Content $tepCaiDat -Encoding UTF8

Buoc "Tường lửa Windows: cho phép cổng $Cong"
Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $tenTuongLua -Direction Inbound -Protocol TCP -LocalPort $Cong -Action Allow -Profile Any | Out-Null
Write-Host "Đã thêm quy tắc '$tenTuongLua'."

Buoc 'Khởi động và gọi thử'
Chay $appcmd @('start', 'apppool', "/apppool.name:$TenSite") | Out-Null
if (-not $siteCha) { Chay $appcmd @('start', 'site', "/site.name:$TenSite") | Out-Null }
Start-Sleep -Seconds 2
$t = GoiThu $Cong $DuongDan
$ma = if ($t.ChungChi) { MaNhanDang $t.ChungChi } elseif ($cert) { MaNhanDang $cert } else { '?' }

$diaChi = if ($TenMien) { $TenMien } else { '<tên miền hoặc IP công cộng của máy chủ>' }
Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
Write-Host " ĐÃ CÀI XONG máy chủ Quản lý tài sản — HTTPS cổng $Cong" -ForegroundColor Green
Write-Host " Địa chỉ:              https://${diaChi}:$Cong$DuongDan/"
Write-Host " Mã nhận dạng:         $ma   (so với chứng chỉ trình duyệt hiện khi bấm ổ khoá)"
Write-Host " Dữ liệu:              $DuLieu   (taisan.xml, LichSu, Anh — tự sao lưu taisan.xml mỗi ngày trong SaoLuu)"
Write-Host ''
Write-Host ' Bước tiếp:'
Write-Host '   1. Mở địa chỉ trên bằng trình duyệt, đăng nhập tài khoản quản trị vừa tạo.'
Write-Host '   2. Cài đặt → "Địa chỉ in trong mã QR" = địa chỉ trên (điện thoại vào bằng địa chỉ này).'
Write-Host '   3. Danh mục → kiểm tra loại tài sản, đơn vị; Nhập từ Excel → đưa sổ tài sản vào; In tem QR.'
Write-Host '   4. Tài khoản → tạo tài khoản cho nhân viên (kiểm tra / cán bộ quản lý tài sản / chỉ xem).'
Write-Host ' Điện thoại: mở địa chỉ trên bằng Chrome, "Thêm vào màn hình chính"; trang Quét QR dùng camera.'
Write-Host '==============================================================' -ForegroundColor Green
if (-not $t.Ok) {
    CanhBao " Gọi thử CHƯA thành công: $($t.Loi)"
    CanhBao " Xem: $DuLieu\NhatKy, $DuLieu\loi-khoi-dong.txt, rồi chạy lại: CaiDat-IIS.bat -KiemTra"
}
