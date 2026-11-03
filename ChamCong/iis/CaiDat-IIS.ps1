# Cài 1 click phần mềm "Nhân sự – Chấm công – Tiền lương" lên máy chủ IIS.
# Chạy bằng CaiDat-IIS.bat (tự xin quyền quản trị). Bộ cài tự làm:
#   - cài IIS và ASP.NET Core Hosting Bundle nếu máy chưa có (tắt bằng -KhongCaiThem)
#   - biên dịch máy chủ ChamCongMayChu.exe bằng csc.exe có sẵn trong .NET Framework 4 (không cần Visual Studio)
#   - đặt dữ liệu, bản sao lưu hằng ngày và nhật ký IIS sang ổ D (nếu có) để không đầy ổ C
#   - tạo site IIS theo tên miền (mặc định qlns.capnuochaugiang.vn): https cổng 443, http cổng 80 tự chuyển sang https
#   - dùng chứng chỉ có sẵn của tên miền, không có thì tạo chứng chỉ tự ký
#   - tạo tài khoản quản trị, mở tường lửa, gọi thử
#
# Tham số tuỳ chọn, vd:
#   CaiDat-IIS.bat -TenMien qlns.capnuochaugiang.vn   tên miền (mặc định như bên trái)
#   CaiDat-IIS.bat -DuLieu E:\ChamCongData            thư mục dữ liệu (mặc định D:\ChamCongData, không có ổ D thì C:\ChamCongData)
#   CaiDat-IIS.bat -SaoLuu E:\SaoLuuChamCong          thư mục bản sao lưu hằng ngày (mặc định <dữ liệu>\SaoLuu)
#   CaiDat-IIS.bat -ChungChi <thumbprint>             dùng chứng chỉ có sẵn trong LocalMachine\My
#   CaiDat-IIS.bat -TenMien khong -CongHttps 8443     không dùng tên miền: truy cập bằng IP, https cổng 8443
#   CaiDat-IIS.bat -KhongHttp                         không mở cổng 80
#   CaiDat-IIS.bat -SiteCha "Default Web Site" -DuongDan /chamcong   cài thành ứng dụng con của site có sẵn
#   CaiDat-IIS.bat -DatMatKhau                        đặt lại mật khẩu tài khoản quản trị
#   CaiDat-IIS.bat -KiemTra                           gọi thử máy chủ
#   CaiDat-IIS.bat -GoBo                              gỡ site (giữ nguyên dữ liệu và bản sao lưu)
# Chạy lại bộ cài bất cứ lúc nào để cập nhật phần mềm mới: dữ liệu, tài khoản giữ nguyên.
param(
    [string]$TenMien = 'qlns.capnuochaugiang.vn',
    [int]$CongHttps = 443,
    [int]$CongHttp = 80,
    [switch]$KhongHttp,
    [string]$ChungChi = '',
    [string]$DuLieu = '',
    [string]$SaoLuu = '',
    [string]$TenSite = 'ChamCong',
    [string]$ThuMuc = "$env:SystemDrive\inetpub\ChamCong",
    [string]$SiteCha = '',
    [string]$DuongDan = '',
    [switch]$KhongCaiThem,
    [switch]$DatMatKhau,
    [switch]$KiemTra,
    [switch]$GoBo
)

$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
$tepHtml = Join-Path (Split-Path -Parent $goc) 'ChamCong_TinhLuong.html'
$tepCs = Join-Path $goc 'MayChuChamCong.cs'
$tepWebConfig = Join-Path $goc 'web.config'
$tenExe = 'ChamCongMayChu.exe'
$tenTuongLua = 'Nhan su - Cham cong - Tien luong (IIS)'
$tenChungChi = 'Cham cong - Tien luong (IIS)'
$appId = '{5d7c2e19-8a4b-4f63-9c21-0b7e3f5a6d18}'
$tepCaiDat = Join-Path $ThuMuc 'caidat.txt'
$linkHostingBundle = @(
    'https://dotnet.microsoft.com/permalink/dotnetcore-current-windows-runtime-bundle-installer',
    'https://aka.ms/dotnet/8.0/dotnet-hosting-win.exe'
)

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }
function CanhBao([string]$s) { Write-Host $s -ForegroundColor Yellow }
function Tot([string]$s) { Write-Host $s -ForegroundColor Green }

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
function CapQuyen([string]$thuMuc, [string[]]$them) {
    $ts = @($thuMuc, '/inheritance:r', '/grant:r', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F') + $them
    $r = Chay icacls.exe $ts
    if ($r.Ma -ne 0) { Dung "Không đặt được quyền cho $thuMuc`:`n$($r.Ra)" }
}

# ------------------------------------------------------------------ lần cài trước (để chạy lại / cập nhật giữ nguyên lựa chọn)

$caiTruoc = @{}
if (Test-Path $tepCaiDat) {
    Get-Content $tepCaiDat -Encoding UTF8 | ForEach-Object { if ($_ -match '^\s*([A-Za-z]+)\s*=\s*(.*)$') { $caiTruoc[$Matches[1]] = $Matches[2].Trim() } }
}
foreach ($k in @('TenMien', 'DuLieu', 'SaoLuu', 'SiteCha', 'DuongDan')) {
    if (-not $PSBoundParameters.ContainsKey($k) -and $caiTruoc.ContainsKey($k)) { Set-Variable -Name $k -Value $caiTruoc[$k] }
}
foreach ($k in @('CongHttps', 'CongHttp')) {
    if (-not $PSBoundParameters.ContainsKey($k) -and $caiTruoc[$k]) { Set-Variable -Name $k -Value ([int]$caiTruoc[$k]) }
}
if (-not $PSBoundParameters.ContainsKey('KhongHttp') -and $caiTruoc['KhongHttp'] -eq '1') { $KhongHttp = $true }
$TenMien = ($TenMien.Trim().ToLower() -replace '^https?://', '').TrimEnd('/')
if (@('khong', 'none', '-', 'ip') -contains $TenMien) { $TenMien = '' }
if (-not $TenMien -and -not $PSBoundParameters.ContainsKey('CongHttps') -and -not $caiTruoc['CongHttps']) { $CongHttps = 8443 }

# Thư mục dữ liệu: ưu tiên ổ D (ổ cứng cố định) để không đầy ổ C
if (-not $DuLieu) {
    $oD = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'" -ErrorAction SilentlyContinue
    if ($oD -and $oD.DriveType -eq 3) { $DuLieu = 'D:\ChamCongData' }
    else { $DuLieu = "$env:SystemDrive\ChamCongData"; $canhBaoOC = $true }
}
$DuLieu = $DuLieu.TrimEnd('\')
if (-not $SaoLuu) { $SaoLuu = Join-Path $DuLieu 'SaoLuu' }
$SaoLuu = $SaoLuu.TrimEnd('\')

# ------------------------------------------------------------------ gọi thử

# Gửi GET tới 127.0.0.1:cổng (https có SNI theo tên miền), trả về dòng trạng thái, header, nội dung
function GoiThu([int]$cong, [bool]$https, [string]$tenMay, [string]$duong) {
    $kq = [pscustomobject]@{ Ok = $false; ChuyenHttps = $false; ChungChi = $null; Than = ''; Loi = '' }
    if (-not $tenMay) { $tenMay = 'localhost' }
    try {
        $tcp = New-Object Net.Sockets.TcpClient('127.0.0.1', $cong)
        $luong = $tcp.GetStream()
        if ($https) {
            $script:ccThu = $null
            $ssl = New-Object Net.Security.SslStream($luong, $false, { param($s, $c, $ch, $e) $script:ccThu = $c; $true })
            $ssl.ReadTimeout = 90000
            $ssl.AuthenticateAsClient($tenMay, $null, [Security.Authentication.SslProtocols]::Tls12, $false)
            $kq.ChungChi = $script:ccThu
            $luong = $ssl
        }
        $yc = [Text.Encoding]::ASCII.GetBytes("GET $($duong.TrimEnd('/'))/api/ping HTTP/1.1`r`nHost: $tenMay`r`nConnection: close`r`n`r`n")
        $luong.Write($yc, 0, $yc.Length)
        $luong.Flush()
        $text = (New-Object IO.StreamReader($luong, [Text.Encoding]::UTF8)).ReadToEnd()
        $tcp.Close()
        $kq.Than = $text
        $dau = ($text -split "`n")[0]
        $kq.Ok = $dau -match ' 200 ' -and $text -match '"ungDung":"ChamCong"'
        $kq.ChuyenHttps = $dau -match ' 301 ' -and $text -match '(?im)^Location: https://'
    }
    catch { $kq.Loi = $_.Exception.Message }
    $kq
}

function KiemTraTatCa {
    $ok = $true
    if ($SiteCha) {
        $b = Chay $appcmd @('list', 'site', "/name:$SiteCha")
        $https = $b.Ra -match 'https/'
        $cong = if ($b.Ra -match "$(if ($https) { 'https' } else { 'http' })/[^:]*:(\d+):") { [int]$Matches[1] } else { 80 }
        Write-Host "Gọi thử $(if ($https) { 'https' } else { 'http' })://127.0.0.1:$cong$DuongDan/api/ping"
        $t = GoiThu $cong $https $TenMien $DuongDan
        if ($t.Ok) { Tot '  OK' } else { $ok = $false; CanhBao "  Chưa được: $($t.Loi) $($t.Than.Substring(0, [Math]::Min(300, $t.Than.Length)))" }
        return $ok
    }
    Write-Host "Gọi thử https://$(if ($TenMien) { $TenMien } else { '127.0.0.1' }):$CongHttps/api/ping (qua 127.0.0.1)"
    $t = GoiThu $CongHttps $true $TenMien ''
    if ($t.Ok) { Tot "  OK – chứng chỉ: $($t.ChungChi.Subject), mã nhận dạng $(MaNhanDang $t.ChungChi)" }
    else { $ok = $false; CanhBao "  Chưa được: $($t.Loi) $($t.Than.Substring(0, [Math]::Min(300, $t.Than.Length)))" }
    if ($TenMien -and -not $KhongHttp) {
        Write-Host "Gọi thử http://${TenMien}:$CongHttp/ (phải tự chuyển sang https)"
        $t2 = GoiThu $CongHttp $false $TenMien ''
        if ($t2.ChuyenHttps) { Tot '  OK – chuyển sang https' }
        else { $ok = $false; CanhBao "  Chưa được: $($t2.Loi) $($t2.Than.Substring(0, [Math]::Min(300, $t2.Than.Length)))" }
    }
    $ok
}

# ------------------------------------------------------------------ quyền quản trị

$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Cần quyền quản trị: hãy chạy CaiDat-IIS.bat (tự xin quyền).' }

if ($KiemTra) {
    if (-not (Test-Path $appcmd)) { Dung 'Máy này chưa có IIS.' }
    Buoc 'Kiểm tra máy chủ chấm công'
    if (KiemTraTatCa) { Tot 'Máy chủ trả lời bình thường.'; exit 0 }
    Write-Host "Xem thêm nhật ký: $DuLieu\NhatKy và $DuLieu\loi-khoi-dong.txt"
    exit 1
}

# ------------------------------------------------------------------ gỡ

if ($GoBo) {
    if (-not (Test-Path $appcmd)) { Dung 'Máy này chưa có IIS.' }
    Buoc 'Gỡ phần mềm chấm công khỏi IIS (giữ nguyên dữ liệu và bản sao lưu)'
    if ($SiteCha) {
        $app = "$SiteCha$DuongDan"
        if ((Chay $appcmd @('list', 'app', $app)).Ma -eq 0) { AppCmd @('delete', 'app', $app) }
    }
    if (CoTrongIis 'site' $TenSite) { AppCmd @('delete', 'site', "/site.name:$TenSite") }
    if (CoTrongIis 'apppool' $TenSite) { AppCmd @('delete', 'apppool', "/apppool.name:$TenSite") }
    if ($TenMien) { Chay netsh.exe @('http', 'delete', 'sslcert', "hostnameport=${TenMien}:$CongHttps") | Out-Null }
    else { Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$CongHttps") | Out-Null }
    Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $tenChungChi } | ForEach-Object { Remove-Item $_.PSPath }
    Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    if (Test-Path $ThuMuc) { Remove-Item -Recurse -Force $ThuMuc }
    Tot "Đã gỡ xong. Dữ liệu vẫn còn ở: $DuLieu ; bản sao lưu: $SaoLuu"
    exit 0
}

if (-not (Test-Path $tepHtml)) { Dung "Thiếu $tepHtml. Hãy giữ nguyên cấu trúc thư mục ChamCong (file ChamCong_TinhLuong.html nằm cạnh thư mục iis)." }
if (-not (Test-Path $tepCs)) { Dung "Thiếu $tepCs." }
if (-not (Test-Path $tepWebConfig)) { Dung "Thiếu $tepWebConfig." }

Write-Host ''
Write-Host '==============================================================' -ForegroundColor Cyan
Write-Host ' CÀI ĐẶT: Nhân sự – Chấm công – Tiền lương trên IIS' -ForegroundColor Cyan
Write-Host "  Địa chỉ:    $(if ($SiteCha) { "site '$SiteCha'$DuongDan" } elseif ($TenMien) { "https://$TenMien/" } else { "https://<IP máy chủ>:$CongHttps/" })"
Write-Host "  Dữ liệu:    $DuLieu"
Write-Host "  Sao lưu:    $SaoLuu"
Write-Host "  Chương trình: $ThuMuc"
Write-Host '==============================================================' -ForegroundColor Cyan
if ($canhBaoOC) { CanhBao "Máy không có ổ D (ổ cứng cố định) – dữ liệu đặt ở $DuLieu. Có thể chạy lại với -DuLieu <ổ khác>\ChamCongData." }

# ------------------------------------------------------------------ IIS

Buoc 'IIS'
if (-not (Test-Path $appcmd)) {
    if ($KhongCaiThem) { Dung 'Máy này chưa có IIS (bỏ -KhongCaiThem để bộ cài tự cài).' }
    Write-Host 'Chưa có IIS – đang cài (vài phút)…'
    if (Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue) {
        $r = Install-WindowsFeature -Name Web-Server, Web-Mgmt-Console, Web-Http-Logging, Web-Filtering, Web-Stat-Compression, Web-Dyn-Compression
        if (-not $r.Success) { Dung 'Không cài được IIS (Install-WindowsFeature).' }
    }
    else {
        Enable-WindowsOptionalFeature -Online -All -NoRestart -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-ManagementConsole, IIS-HttpLogging, IIS-RequestFiltering, IIS-HttpCompressionStatic | Out-Null
    }
    if (-not (Test-Path $appcmd)) { Dung 'Đã cài IIS nhưng chưa thấy appcmd.exe – hãy khởi động lại máy rồi chạy lại bộ cài.' }
}
$phienBanIis = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\InetStp' -ErrorAction SilentlyContinue).MajorVersion
Write-Host "IIS phiên bản ${phienBanIis}: có."
if ($TenMien -and -not $SiteCha -and $phienBanIis -lt 8) { Dung 'IIS dưới 8 (Windows Server 2008) không hỗ trợ nhiều chứng chỉ theo tên miền (SNI). Dùng -TenMien khong để cài theo IP.' }

Buoc 'ASP.NET Core Module V2 (ASP.NET Core Hosting Bundle)'
function CoAncm { (Chay $appcmd @('list', 'config', '-section:system.webServer/globalModules')).Ra -match 'AspNetCoreModuleV2' }
if (-not (CoAncm)) {
    if ($KhongCaiThem) { Dung 'IIS chưa có ASP.NET Core Module V2. Hãy cài ASP.NET Core Hosting Bundle (https://dotnet.microsoft.com/download/dotnet) rồi chạy lại.' }
    Write-Host 'Chưa có – đang tải ASP.NET Core Hosting Bundle từ Microsoft…'
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $tepBundle = Join-Path $env:TEMP 'dotnet-hosting-win.exe'
    $daTai = $false
    foreach ($u in $linkHostingBundle) {
        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $u -OutFile $tepBundle -UseBasicParsing -ErrorAction Stop
            if ((Get-Item $tepBundle).Length -gt 10MB) { $daTai = $true; break }
        }
        catch { CanhBao "  Không tải được từ $u : $($_.Exception.Message)" }
    }
    if (-not $daTai) {
        Dung ("Không tải được Hosting Bundle (máy chủ không ra được internet?). Hãy tải 'ASP.NET Core Runtime – Hosting Bundle' " +
            "tại https://dotnet.microsoft.com/download/dotnet trên máy khác, chép sang, cài, rồi chạy lại bộ cài.")
    }
    Write-Host 'Đang cài Hosting Bundle…'
    $p = Start-Process -FilePath $tepBundle -ArgumentList '/install', '/quiet', '/norestart' -Wait -PassThru
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { Dung "Cài Hosting Bundle lỗi (mã $($p.ExitCode))." }
    Remove-Item $tepBundle -ErrorAction SilentlyContinue
    Write-Host 'Khởi động lại dịch vụ IIS để nạp module…'
    Chay net.exe @('stop', 'was', '/y') | Out-Null
    Chay net.exe @('start', 'w3svc') | Out-Null
    if (-not (CoAncm)) { Dung 'Đã cài Hosting Bundle nhưng IIS chưa có AspNetCoreModuleV2 – hãy khởi động lại máy rồi chạy lại bộ cài.' }
}
Write-Host 'AspNetCoreModuleV2: có.'

# ------------------------------------------------------------------ biên dịch máy chủ

Buoc 'Biên dịch ChamCongMayChu.exe'
$csc = @("$env:windir\Microsoft.NET\Framework64\v4.0.30319\csc.exe", "$env:windir\Microsoft.NET\Framework\v4.0.30319\csc.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { Dung 'Không thấy csc.exe của .NET Framework 4 (cần .NET Framework 4.5 trở lên).' }
$tam = Join-Path $env:TEMP ('ChamCong_' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tam | Out-Null
$r = Chay $csc @('/nologo', '/optimize+', '/codepage:65001', '/target:exe', "/out:$tam\$tenExe", '/r:System.Web.Extensions.dll', $tepCs)
if ($r.Ma -ne 0 -or -not (Test-Path "$tam\$tenExe")) { Dung "Biên dịch lỗi:`n$($r.Ra)" }
Write-Host "Đã biên dịch bằng $csc"

# ------------------------------------------------------------------ chọn cách cài

$tuKy = $false
$cert = $null
$nghePort = {
    param([int]$cong)
    @(Get-NetTCPConnection -LocalPort $cong -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 4 })
}
if ($SiteCha) {
    if (-not (CoTrongIis 'site' $SiteCha)) { Dung "Không có site IIS '$SiteCha'." }
    if (-not $DuongDan) { $DuongDan = '/chamcong' }
    if (-not $DuongDan.StartsWith('/')) { $DuongDan = '/' + $DuongDan }
    $DuongDan = $DuongDan.TrimEnd('/')
    Write-Host "Cài thành ứng dụng con: $SiteCha$DuongDan"
}
else {
    $DuongDan = ''
    foreach ($c in @($CongHttps) + $(if ($TenMien -and -not $KhongHttp) { @($CongHttp) } else { @() })) {
        $n = & $nghePort $c
        if ($n.Count -gt 0) {
            $p = Get-Process -Id $n[0].OwningProcess -ErrorAction SilentlyContinue
            Dung "Cổng $c đang bị chương trình '$($p.ProcessName)' (không phải IIS) dùng."
        }
    }
    # site khác của IIS đã dùng đúng tên miền + cổng?
    $dsSite = [xml](Chay $appcmd @('list', 'site', '/xml')).Ra
    foreach ($s in @($dsSite.appcmd.SITE)) {
        if (-not $s -or $s.'SITE.NAME' -eq $TenSite) { continue }
        foreach ($b in ($s.bindings -split ',')) {
            if ($TenMien -and $b -match "^https?/[^:]*:(\d+):$([regex]::Escape($TenMien))$" -and (@($CongHttps, $CongHttp) -contains [int]$Matches[1])) {
                Dung "Tên miền $TenMien cổng $($Matches[1]) đang thuộc site IIS '$($s.'SITE.NAME')'. Gỡ binding đó hoặc dùng -SiteCha '$($s.'SITE.NAME')'."
            }
            if (-not $TenMien -and $b -match "^https?/[^:]*:${CongHttps}:$") {
                Dung "Cổng $CongHttps đang dùng cho site IIS '$($s.'SITE.NAME')'. Chọn cổng khác: -CongHttps <số>."
            }
        }
    }

    Buoc 'Chứng chỉ HTTPS'
    if ($ChungChi) {
        $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq ($ChungChi -replace '\s', '').ToUpper() } | Select-Object -First 1
        if (-not $cert) { Dung "Không thấy chứng chỉ $ChungChi trong LocalMachine\My." }
        if (-not $cert.HasPrivateKey) { Dung 'Chứng chỉ không có khoá riêng (private key).' }
    }
    elseif ($TenMien) {
        # chứng chỉ thật của tên miền (vd mua, hoặc Let's Encrypt qua win-acme) đã có trong máy
        $cha = ($TenMien -split '\.', 2)[1]
        $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object {
            $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(7) -and $_.Issuer -ne $_.Subject -and
            (@($_.DnsNameList | ForEach-Object { "$_".ToLower() }) | Where-Object { $_ -eq $TenMien -or $_ -eq "*.$cha" })
        } | Sort-Object NotAfter -Descending | Select-Object -First 1
        if ($cert) { Write-Host 'Dùng chứng chỉ thật của tên miền có sẵn trong máy.' }
    }
    if (-not $cert) {
        $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $tenChungChi -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(30) -and
            ((-not $TenMien) -or (@($_.DnsNameList | ForEach-Object { "$_".ToLower() }) -contains $TenMien)) } | Sort-Object NotAfter -Descending | Select-Object -First 1
        if (-not $cert) {
            $ten = @($TenMien, $env:COMPUTERNAME, 'localhost') | Where-Object { $_ } | Select-Object -Unique
            try {
                $cert = New-SelfSignedCertificate -DnsName $ten -CertStoreLocation Cert:\LocalMachine\My -NotAfter (Get-Date).AddYears(5) `
                    -FriendlyName $tenChungChi -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy NonExportable -ErrorAction Stop
            }
            catch {
                # Windows Server 2012 R2: lệnh không có các tham số trên
                $cert = New-SelfSignedCertificate -DnsName $ten -CertStoreLocation Cert:\LocalMachine\My
                $cert.FriendlyName = $tenChungChi
            }
            Write-Host 'Đã tạo chứng chỉ tự ký.'
        }
    }
    $tuKy = $cert.Issuer -eq $cert.Subject
    Write-Host "Chứng chỉ: $($cert.Subject) – hết hạn $($cert.NotAfter.ToString('dd/MM/yyyy')) – mã nhận dạng $(MaNhanDang $cert)"
    if ($tuKy) { CanhBao 'Chứng chỉ TỰ KÝ: trình duyệt sẽ cảnh báo. Nên cài chứng chỉ thật cho tên miền (xem HUONG_DAN_IIS.txt) rồi chạy lại bộ cài.' }
}

# ------------------------------------------------------------------ chép chương trình

Buoc "Chép chương trình vào $ThuMuc"
if (CoTrongIis 'apppool' $TenSite) {
    Chay $appcmd @('stop', 'apppool', "/apppool.name:$TenSite") | Out-Null
    Start-Sleep -Seconds 4   # chờ máy chủ cũ lưu xong và thoát
    Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($tenExe)) -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -and $_.Path.StartsWith($ThuMuc, [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force $ThuMuc | Out-Null
try {
    Copy-Item "$tam\$tenExe" (Join-Path $ThuMuc $tenExe) -Force -ErrorAction Stop
    Copy-Item $tepHtml (Join-Path $ThuMuc 'index.html') -Force -ErrorAction Stop
    Copy-Item $tepWebConfig (Join-Path $ThuMuc 'web.config') -Force -ErrorAction Stop
}
catch { Dung "Không chép được vào $ThuMuc`: $($_.Exception.Message)" }
Remove-Item -Recurse -Force $tam -ErrorAction SilentlyContinue
$cfgWeb = Join-Path $ThuMuc 'web.config'
$x = New-Object Xml.XmlDocument
$x.PreserveWhitespace = $true
$x.Load($cfgWeb)
$datBien = { param($ten, $giaTri) $x.SelectSingleNode("//environmentVariable[@name='$ten']").SetAttribute('value', $giaTri) }
& $datBien 'CHAMCONG_DULIEU' $DuLieu
& $datBien 'CHAMCONG_SAOLUU' $SaoLuu
& $datBien 'CHAMCONG_CHI_HTTPS' $(if ($TenMien -and -not $SiteCha) { '1' } else { '0' })
& $datBien 'CHAMCONG_HSTS' $(if ($TenMien -and -not $SiteCha -and -not $tuKy) { '1' } else { '0' })
$x.Save($cfgWeb)
CapQuyen $ThuMuc @('*S-1-5-32-568:(OI)(CI)RX', '*S-1-5-17:(OI)(CI)RX')
Write-Host 'Đã chép: ChamCongMayChu.exe, index.html, web.config.'

# ------------------------------------------------------------------ app pool

Buoc "App pool '$TenSite'"
if (-not (CoTrongIis 'apppool' $TenSite)) { AppCmd @('add', 'apppool', "/name:$TenSite") }
AppCmd @('set', 'apppool', "/apppool.name:$TenSite", '/managedRuntimeVersion:', '/managedPipelineMode:Integrated',
    '/processModel.idleTimeout:00:00:00', '/startMode:AlwaysRunning', '/recycling.periodicRestart.time:00:00:00')
Write-Host 'No Managed Code, chạy liên tục (không tự tắt khi rảnh).'

# ------------------------------------------------------------------ dữ liệu, sao lưu

Buoc 'Thư mục dữ liệu và sao lưu'
$quyenPool = "IIS AppPool\${TenSite}:(OI)(CI)M"
New-Item -ItemType Directory -Force $DuLieu | Out-Null
CapQuyen $DuLieu @($quyenPool)
New-Item -ItemType Directory -Force $SaoLuu | Out-Null
if (-not $SaoLuu.StartsWith($DuLieu + '\', [StringComparison]::OrdinalIgnoreCase)) { CapQuyen $SaoLuu @($quyenPool) }
Write-Host "Dữ liệu: $DuLieu"
Write-Host "Sao lưu tự động mỗi ngày (giữ 120 bản): $SaoLuu"
Write-Host 'Chỉ quản trị máy chủ và app pool đọc được (tài khoản, mật khẩu đã băm).'
foreach ($o in @($DuLieu, $SaoLuu) | ForEach-Object { $_.Substring(0, 2) } | Select-Object -Unique) {
    $dia = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$o'" -ErrorAction SilentlyContinue
    if ($dia -and $dia.Size) { Write-Host ("  Ổ {0} còn trống {1:N1} GB / {2:N1} GB" -f $o, ($dia.FreeSpace / 1GB), ($dia.Size / 1GB)) }
}

# ------------------------------------------------------------------ tài khoản quản trị

$tepTaiKhoan = Join-Path $DuLieu 'taikhoan.json'
$coQuanTri = (Test-Path $tepTaiKhoan) -and ((Get-Content $tepTaiKhoan -Raw -Encoding UTF8) -match '"vaiTro"\s*:\s*"quan_tri"')
if (-not $coQuanTri -or $DatMatKhau) {
    Buoc 'Tài khoản quản trị phần mềm'
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
    $env:CHAMCONG_DULIEU = $DuLieu
    $env:CHAMCONG_SAOLUU = $SaoLuu
    $env:CHAMCONG_MATKHAU = $p1
    try { $pr = Start-Process -FilePath (Join-Path $ThuMuc $tenExe) -ArgumentList @('--dat-mat-khau', $ten) -Wait -PassThru -NoNewWindow }
    finally { Remove-Item Env:\CHAMCONG_MATKHAU -ErrorAction SilentlyContinue; $p1 = $null; $p2 = $null }
    if ($pr.ExitCode -ne 0) { Dung "Không tạo được tài khoản (mã $($pr.ExitCode)). Xem $DuLieu\loi-khoi-dong.txt" }
    CapQuyen $DuLieu @($quyenPool)   # file mới tạo bằng tài khoản quản trị: cấp lại quyền cho app pool
    Tot "Đã đặt tài khoản quản trị '$ten'."
}

# ------------------------------------------------------------------ site

if ($SiteCha) {
    Buoc "Ứng dụng '$SiteCha$DuongDan'"
    if (CoTrongIis 'site' $TenSite) { AppCmd @('delete', 'site', "/site.name:$TenSite") }
    $app = "$SiteCha$DuongDan"
    if ((Chay $appcmd @('list', 'app', $app)).Ma -eq 0) {
        AppCmd @('set', 'app', $app, "/applicationPool:$TenSite")
        AppCmd @('set', 'vdir', "$app/", "/physicalPath:$ThuMuc")
    }
    else { AppCmd @('add', 'app', "/site.name:$SiteCha", "/path:$DuongDan", "/physicalPath:$ThuMuc", "/applicationPool:$TenSite") }
    Write-Host "Đã tạo ứng dụng $SiteCha$DuongDan"
}
else {
    Buoc "Site '$TenSite'"
    $bHttps = "https/*:${CongHttps}:$TenMien"
    $dsBinding = @($bHttps)
    if ($TenMien -and -not $KhongHttp) { $dsBinding += "http/*:${CongHttp}:$TenMien" }
    if (CoTrongIis 'site' $TenSite) {
        AppCmd @('set', 'site', "/site.name:$TenSite", "/bindings:$($dsBinding -join ',')")
        AppCmd @('set', 'vdir', "$TenSite/", "/physicalPath:$ThuMuc")
    }
    else { AppCmd @('add', 'site', "/name:$TenSite", "/bindings:$($dsBinding -join ',')", "/physicalPath:$ThuMuc") }
    AppCmd @('set', 'app', "$TenSite/", "/applicationPool:$TenSite")
    if ($TenMien) {
        # nhiều site cùng cổng 443: chứng chỉ theo tên miền (SNI)
        AppCmd @('set', 'site', "/site.name:$TenSite", "/bindings.[protocol='https',bindingInformation='*:${CongHttps}:$TenMien'].sslFlags:1")
        Chay netsh.exe @('http', 'delete', 'sslcert', "hostnameport=${TenMien}:$CongHttps") | Out-Null
        $r = Chay netsh.exe @('http', 'add', 'sslcert', "hostnameport=${TenMien}:$CongHttps", "certhash=$($cert.Thumbprint)", "appid=$appId", 'certstorename=MY')
    }
    else {
        Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$CongHttps") | Out-Null
        $r = Chay netsh.exe @('http', 'add', 'sslcert', "ipport=0.0.0.0:$CongHttps", "certhash=$($cert.Thumbprint)", "appid=$appId", 'certstorename=MY')
    }
    if ($r.Ma -ne 0) { Dung "Không gắn được chứng chỉ vào cổng $CongHttps`:`n$($r.Ra)" }
    # nhật ký truy cập IIS của site đặt cạnh dữ liệu (ổ D) để không đầy ổ C
    $thuMucLog = Join-Path $DuLieu 'IISLogs'
    New-Item -ItemType Directory -Force $thuMucLog | Out-Null
    AppCmd @('set', 'site', "/site.name:$TenSite", "/logFile.directory:$thuMucLog")
    Write-Host "Bindings: $($dsBinding -join ', ')"
    Write-Host "Nhật ký IIS: $thuMucLog"
}

@("TenMien=$TenMien", "CongHttps=$CongHttps", "CongHttp=$CongHttp", "KhongHttp=$(if ($KhongHttp) { '1' } else { '0' })",
  "DuLieu=$DuLieu", "SaoLuu=$SaoLuu", "SiteCha=$SiteCha", "DuongDan=$DuongDan") | Set-Content $tepCaiDat -Encoding UTF8

if (-not $SiteCha) {
    Buoc 'Tường lửa Windows'
    $cong = @($CongHttps) + $(if ($TenMien -and -not $KhongHttp) { @($CongHttp) } else { @() })
    Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $tenTuongLua -Direction Inbound -Protocol TCP -LocalPort $cong -Action Allow -Profile Any | Out-Null
    Write-Host "Đã mở cổng $($cong -join ', ')."
}

# ------------------------------------------------------------------ khởi động, gọi thử

Buoc 'Khởi động và gọi thử'
Chay $appcmd @('start', 'apppool', "/apppool.name:$TenSite") | Out-Null
if (-not $SiteCha) { Chay $appcmd @('start', 'site', "/site.name:$TenSite") | Out-Null }
Start-Sleep -Seconds 2
$ok = KiemTraTatCa

$diaChi = if ($SiteCha) { "<địa chỉ site $SiteCha>$DuongDan/" } elseif ($TenMien) { "https://$TenMien$(if ($CongHttps -ne 443) { ":$CongHttps" })/" } else { "https://<IP máy chủ>:$CongHttps/" }
Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
Write-Host ' ĐÃ CÀI XONG: Nhân sự – Chấm công – Tiền lương' -ForegroundColor Green
Write-Host " Địa chỉ:   $diaChi"
Write-Host " Dữ liệu:   $DuLieu"
Write-Host " Sao lưu:   $SaoLuu   (tự động mỗi ngày, giữ 120 bản)"
Write-Host ''
Write-Host ' Bước tiếp:'
if ($TenMien -and -not $SiteCha) {
    Write-Host "  1. Bản ghi DNS: $TenMien  →  IP công cộng của máy chủ (bản ghi A); mở cổng 443$(if (-not $KhongHttp) { ', 80' }) trên tường lửa / modem."
    if ($tuKy) { Write-Host '  2. Cài chứng chỉ thật cho tên miền (xem HUONG_DAN_IIS.txt mục 3) rồi chạy lại CaiDat-IIS.bat.' }
}
Write-Host "  - Mở $diaChi bằng trình duyệt, đăng nhập tài khoản quản trị,"
Write-Host '    chọn dữ liệu ban đầu (đưa dữ liệu trên máy này lên, nhập file sao lưu, hoặc bắt đầu trống).'
Write-Host '  - Cài đặt & dữ liệu → Dữ liệu: tạo tài khoản chấm công cho từng phòng / đội.'
Write-Host '==============================================================' -ForegroundColor Green
if (-not $ok) {
    CanhBao ' Gọi thử CHƯA thành công. Xem nhật ký:'
    CanhBao "   $DuLieu\NhatKy, $DuLieu\loi-khoi-dong.txt; rồi chạy: CaiDat-IIS.bat -KiemTra"
}
