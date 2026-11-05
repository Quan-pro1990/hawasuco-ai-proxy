# Công cụ TRIỂN KHAI TỰ ĐỘNG máy chủ IIS cho phần mềm "Quản lý thất thoát nước".
#
# Một lần chạy làm đủ các bước (phần nào đã có thì bỏ qua):
#   1. Cài nền máy chủ:
#        - .NET Framework 4.8 khi máy còn bản cũ hơn 4.6.2 (vd Windows Server 2012 R2);
#        - IIS (Web Server, Request Filtering, IIS Manager);
#        - ASP.NET Core Hosting Bundle: TẢI bản mới nhất từ Microsoft, kiểm tra mã băm SHA-512 và chữ ký số rồi cài.
#   2. Lấy phần mềm và BIÊN DỊCH ThatThoatNuoc.exe bằng build.ps1 (trình biên dịch C# có sẵn trong Windows):
#        - mã nguồn trên máy này (công cụ nằm trong thư mục iis của mã nguồn), hoặc
#        - TẢI mã nguồn mới nhất từ GitHub (không có mã nguồn, hoặc chạy với -Nguon GitHub).
#      Công cụ nằm trong gói cài IIS (cạnh CaiDat-IIS.ps1 và web\ThatThoatNuoc.exe) thì dùng luôn gói đó.
#   3. Đóng gói ThatThoatNuoc-MayChu-IIS (giống nút "Tạo gói cài IIS…" trong phần mềm) + tệp .zip.
#   4. Chạy CaiDat-IIS.ps1 của gói: app pool, site https cổng 8080 (hoặc ứng dụng con), chứng chỉ, tường lửa,
#      tài khoản quản trị.
#
# Chạy bằng TrienKhai-IIS.bat (tự xin quyền quản trị). Tham số tuỳ chọn, vd:
#   TrienKhai-IIS.bat                                  làm đủ 4 bước
#   TrienKhai-IIS.bat -ChiTaoGoi                       chỉ biên dịch + tạo gói (.zip) trên Desktop, không cần quyền quản trị
#   TrienKhai-IIS.bat -ChiCaiNen                       chỉ cài nền: IIS + Hosting Bundle (+ .NET Framework nếu thiếu)
#   TrienKhai-IIS.bat -Nguon GitHub                    luôn tải mã nguồn mới nhất từ GitHub (vd để cập nhật máy chủ)
#   TrienKhai-IIS.bat -Nguon GitHub -Nhanh <nhánh>     tải nhánh khác (mặc định main)
#   TrienKhai-IIS.bat -KhongBienDich                   dùng ThatThoatNuoc.exe có sẵn trong mã nguồn, không biên dịch lại
#   TrienKhai-IIS.bat -DotNet 8.0                      chọn dòng Hosting Bundle (mặc định: bản LTS mới nhất)
#   TrienKhai-IIS.bat -Ra D:\Goi                       nơi đặt gói (mặc định %LOCALAPPDATA%\ThatThoatNuoc-TrienKhai;
#                                                      -ChiTaoGoi: Desktop)
# Tham số của CaiDat-IIS được chuyển tiếp nguyên vẹn:
#   -Cong 9443  -DuLieu D:\ThatThoatNuocData  -DuongDan /thatthoat  -ChungChi <thumbprint>  -TenMien tenmien.vn  -DatMatKhau
#
# Chạy lại bao nhiêu lần cũng được: phần đã cài thì bỏ qua; dữ liệu và mật khẩu trên máy chủ giữ nguyên.
param(
    [ValidateSet('TuDong', 'MayNay', 'GitHub')]
    [string]$Nguon = 'TuDong',
    [string]$Repo = 'Quan-pro1990/hawasuco-ai-proxy',
    [string]$Nhanh = 'main',
    [switch]$KhongBienDich,
    [ValidatePattern('^(\d+\.\d+)?$')]
    [string]$DotNet = '',
    [switch]$ChiTaoGoi,
    [switch]$ChiCaiNen,
    [string]$Ra = '',
    # chuyển tiếp cho CaiDat-IIS.ps1
    [int]$Cong = 0,
    [string]$DuLieu = '',
    [string]$DuongDan = '',
    [string]$ChungChi = '',
    [string]$TenMien = '',
    [switch]$DatMatKhau
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# PowerShell 5.1 trên Windows Server cũ mặc định chưa bật TLS 1.2: Microsoft và GitHub đòi TLS 1.2
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
$tenGoi = 'ThatThoatNuoc-MayChu-IIS'
$tepGoi = @('CaiDat-IIS.bat', 'CaiDat-IIS.ps1', 'HUONG_DAN_IIS.txt', 'HUONG_DAN_CHI_TIET.html', 'TrienKhai-IIS.bat', 'TrienKhai-IIS.ps1')
$nguonPhatHanh = @('https://builds.dotnet.microsoft.com/dotnet/release-metadata',
                   'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata')
$netFx48 = 'https://go.microsoft.com/fwlink/?linkid=2088631'   # .NET Framework 4.8, bản cài offline

function Buoc([string]$s) { Write-Host ''; Write-Host "== $s" -ForegroundColor Cyan }
function Dung([string]$s) { Write-Host ''; Write-Host "LỖI: $s" -ForegroundColor Red; exit 1 }
function CanhBao([string]$s) { Write-Host $s -ForegroundColor Yellow }

trap { Dung $_.Exception.Message }

function Chay([string]$exe, [string[]]$thamSo) {
    $cu = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $ra = & $exe @thamSo 2>&1 | ForEach-Object { "$_" } }
    finally { $ErrorActionPreference = $cu }
    [pscustomobject]@{ Ma = $LASTEXITCODE; Ra = ($ra -join "`n") }
}

# ------------------------------------------------------------------ tải về, kiểm tra

function MoiWebClient {
    $wc = New-Object Net.WebClient
    $wc.Headers['User-Agent'] = 'ThatThoatNuoc-TrienKhai'
    if ($wc.Proxy) { $wc.Proxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials }   # proxy công ty
    $wc
}

function TaiTep([string]$url, [string]$den) {
    Write-Host "Tải $url"
    for ($lan = 1; ; $lan++) {
        try {
            if (Test-Path -LiteralPath $den) { Remove-Item -LiteralPath $den -Force }
            (MoiWebClient).DownloadFile($url, $den)
            Write-Host ("  → {0} ({1:N1} MB)" -f $den, ((Get-Item -LiteralPath $den).Length / 1MB))
            return
        }
        catch {
            if ($lan -ge 4) { throw "Không tải được $url — $($_.Exception.Message) Kiểm tra mạng Internet / proxy rồi chạy lại." }
            CanhBao "  Lỗi mạng, thử lại sau $([Math]::Pow(2, $lan)) giây..."
            Start-Sleep -Seconds ([Math]::Pow(2, $lan))
        }
    }
}

function DocJson([string]$url) {
    $wc = MoiWebClient
    $wc.Encoding = [Text.Encoding]::UTF8
    $text = $wc.DownloadString($url)
    Add-Type -AssemblyName System.Web.Extensions
    $js = New-Object Web.Script.Serialization.JavaScriptSerializer
    $js.MaxJsonLength = [int]::MaxValue   # releases.json của .NET có thể dài hơn giới hạn mặc định (2 MB)
    $js.DeserializeObject($text)
}

# Lấy khoá trong Dictionary đọc từ JSON (không có thì $null)
function Lay($d, [string]$k) { if ($d -is [Collections.IDictionary] -and $d.ContainsKey($k)) { $d[$k] } else { $null } }

function DocJsonPhatHanh([string]$ten) {
    $loi = ''
    foreach ($g in $nguonPhatHanh) {
        try { return DocJson "$g/$ten" } catch { $loi = $_.Exception.Message }
    }
    throw "Không đọc được danh sách phiên bản .NET của Microsoft ($ten): $loi"
}

function BamDung([string]$tep, [string]$bam) {
    (Test-Path -LiteralPath $tep) -and ((Get-FileHash -LiteralPath $tep -Algorithm SHA512).Hash -eq $bam)
}

function KiemChuKyMicrosoft([string]$tep) {
    $k = Get-AuthenticodeSignature -FilePath $tep
    if ($k.Status -ne 'Valid' -or -not $k.SignerCertificate -or $k.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
        Remove-Item -LiteralPath $tep -Force -ErrorAction SilentlyContinue
        Dung "Tệp tải về không có chữ ký số hợp lệ của Microsoft ($($k.Status)) — đã xoá: $tep"
    }
    Write-Host '  Chữ ký số Microsoft: hợp lệ.'
}

function ChayTrinhCai([string]$tep, [string[]]$thamSo) {
    $p = Start-Process -FilePath $tep -ArgumentList $thamSo -Wait -PassThru
    $p.ExitCode
}

# ------------------------------------------------------------------ nền máy chủ

function BanNetFramework {
    $k = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -ErrorAction SilentlyContinue
    if ($k -and $k.Release) { [int]$k.Release } else { 0 }
}

function TenNetFramework([int]$r) {
    $bang = (533320, '4.8.1'), (528040, '4.8'), (461808, '4.7.2'), (461308, '4.7.1'), (460798, '4.7'),
            (394802, '4.6.2'), (394254, '4.6.1'), (393295, '4.6'), (379893, '4.5.2'), (378675, '4.5.1'), (378389, '4.5')
    foreach ($b in $bang) { if ($r -ge $b[0]) { return $b[1] } }
    if ($r -gt 0) { '4.0' } else { 'chưa có' }
}

function CoAncm {
    (Test-Path $appcmd) -and ((Chay $appcmd @('list', 'config', '-section:system.webServer/globalModules')).Ra -match 'AspNetCoreModuleV2')
}

function KhoiDongLaiIis {
    Write-Host 'Khởi động lại IIS để nạp module mới (các site đang chạy gián đoạn vài giây)...'
    Chay net.exe @('stop', 'was', '/y') | Out-Null
    Chay net.exe @('start', 'w3svc') | Out-Null
}

function ChonKenhDotNet {
    if ($DotNet) { return $DotNet }
    # Windows Server 2012 R2: dùng dòng 8.0 (các dòng mới hơn không còn hỗ trợ hệ điều hành này)
    if ([Environment]::OSVersion.Version.Major -lt 10) { return '8.0' }
    $idx = DocJsonPhatHanh 'releases-index.json'
    $lts = @(Lay $idx 'releases-index' | Where-Object { (Lay $_ 'release-type') -eq 'lts' -and (Lay $_ 'support-phase') -eq 'active' } |
             Sort-Object { [version](Lay $_ 'channel-version') } -Descending)
    if ($lts.Count -gt 0) { return (Lay $lts[0] 'channel-version') }
    '10.0'
}

# Bản phát hành mới nhất (đầu danh sách) có Hosting Bundle: phiên bản, đường tải, mã băm SHA-512 do Microsoft công bố
function TimHostingBundle([string]$kenh) {
    $d = DocJsonPhatHanh "$kenh/releases.json"
    foreach ($r in @(Lay $d 'releases')) {
        $a = Lay $r 'aspnetcore-runtime'
        foreach ($f in @(Lay $a 'files')) {
            if ((Lay $f 'name') -eq 'dotnet-hosting-win.exe' -and (Lay $f 'url') -and (Lay $f 'hash')) {
                return [pscustomobject]@{ PhienBan = (Lay $a 'version'); Url = (Lay $f 'url'); Bam = (Lay $f 'hash') }
            }
        }
    }
    throw "Không tìm thấy ASP.NET Core Hosting Bundle dòng $kenh trong danh sách phát hành của Microsoft."
}

# ------------------------------------------------------------------ mã nguồn, gói

function LaThuMucNguon([string]$d) {
    $d -and (Test-Path (Join-Path $d 'build.ps1')) -and (Test-Path (Join-Path $d 'src')) -and
        (Test-Path (Join-Path $d 'iis\CaiDat-IIS.ps1')) -and (Test-Path (Join-Path $d 'iis\web.config'))
}

function LaGoi([string]$d) {
    (Test-Path (Join-Path $d 'CaiDat-IIS.ps1')) -and (Test-Path (Join-Path $d 'web\ThatThoatNuoc.exe')) -and
        (Test-Path (Join-Path $d 'web\web.config'))
}

function TaiMaNguon {
    Buoc "Tải mã nguồn từ GitHub: $Repo (nhánh $Nhanh)"
    $zip = Join-Path $tai 'ma-nguon.zip'
    TaiTep "https://github.com/$Repo/archive/refs/heads/$Nhanh.zip" $zip
    $giai = Join-Path $lam 'MaNguon'
    if (Test-Path -LiteralPath $giai) { Remove-Item -LiteralPath $giai -Recurse -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $giai)
    $d = Get-ChildItem -LiteralPath $giai -Recurse -Filter 'build.ps1' | ForEach-Object { $_.DirectoryName } |
         Where-Object { LaThuMucNguon $_ } | Select-Object -First 1
    if (-not $d) { Dung "Không thấy mã nguồn phần mềm (build.ps1, src, iis) trong $Repo nhánh $Nhanh." }
    Write-Host "Mã nguồn: $d"
    $d
}

# Chạy thử ThatThoatNuoc.exe ở chế độ máy chủ với thư mục dữ liệu tạm: "" = chạy được, còn lại là lỗi
function ThuChayExe([string]$exe) {
    $thu = Join-Path $lam 'KiemTraExe'
    if (Test-Path -LiteralPath $thu) { Remove-Item -LiteralPath $thu -Recurse -Force }
    try {
        $psi = New-Object Diagnostics.ProcessStartInfo($exe, '--kiem-tra-may-chu')
        # chạy thẳng (không qua Explorer): tệp mang dấu "tải từ Internet" không bị hộp thoại cảnh báo chặn lại
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.EnvironmentVariables['THATTHOAT_DULIEU'] = $thu
        $p = [Diagnostics.Process]::Start($psi)
        if (-not $p.WaitForExit(60000)) { try { $p.Kill() } catch { }; return 'quá 60 giây không trả lời' }
        if ($p.ExitCode -eq 0) { return '' }
        $tepLoi = Join-Path $thu 'loi-khoi-dong.txt'
        if (Test-Path -LiteralPath $tepLoi) { return "mã $($p.ExitCode): $(Get-Content -LiteralPath $tepLoi -Raw -Encoding UTF8)" }
        return "mã $($p.ExitCode)"
    }
    finally {
        Remove-Item -LiteralPath $thu -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Gói giống nút "Tạo gói cài IIS…" trong phần mềm: web\ThatThoatNuoc.exe + web.config (+ APK) + script cài, hướng dẫn
function TaoGoi([string]$nguonMa, [string]$exe, [string]$noi) {
    $g = Join-Path $noi $tenGoi
    if (Test-Path -LiteralPath $g) { Remove-Item -LiteralPath $g -Recurse -Force }
    $web = Join-Path $g 'web'
    New-Item -ItemType Directory -Force $web | Out-Null
    Copy-Item -LiteralPath $exe (Join-Path $web 'ThatThoatNuoc.exe')
    Copy-Item -LiteralPath (Join-Path $nguonMa 'iis\web.config') (Join-Path $web 'web.config')
    foreach ($t in $tepGoi) {
        $f = Join-Path $nguonMa "iis\$t"
        if (-not (Test-Path -LiteralPath $f)) { $f = Join-Path $goc $t }   # mã nguồn tải về chưa có công cụ này: chép chính nó
        if (Test-Path -LiteralPath $f) { Copy-Item -LiteralPath $f (Join-Path $g $t) }   # chép nguyên byte (giữ BOM UTF-8)
    }
    foreach ($t in 'CaiDat-IIS.bat', 'CaiDat-IIS.ps1') {
        if (-not (Test-Path -LiteralPath (Join-Path $g $t))) { Dung "Mã nguồn thiếu iis\$t." }
    }
    $apk = Join-Path $nguonMa 'ThatThoatNuoc-DienThoai.apk'
    if (Test-Path -LiteralPath $apk) { Copy-Item -LiteralPath $apk (Join-Path $web 'ThatThoatNuoc-DienThoai.apk') }

    $zip = "$g.zip"
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($g, $zip, [IO.Compression.CompressionLevel]::Optimal, $true)
    $g
}

# ================================================================== bắt đầu

Write-Host '=============================================================='
Write-Host ' TRIỂN KHAI TỰ ĐỘNG MÁY CHỦ IIS — Quản lý thất thoát nước'
Write-Host '=============================================================='

if ($ChiTaoGoi -and $ChiCaiNen) { Dung 'Chỉ chọn một trong hai: -ChiTaoGoi hoặc -ChiCaiNen.' }
$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $ChiTaoGoi -and -not $laQuanTri) {
    Dung 'Cần quyền quản trị: hãy chạy TrienKhai-IIS.bat (tự xin quyền). Chỉ tạo gói thì thêm -ChiTaoGoi.'
}

# Thư mục làm việc trong hồ sơ của tài khoản đang chạy: người dùng khác không ghi được vào đây,
# nên không ai tráo được tệp cài / gói giữa lúc tải, biên dịch và lúc chạy bằng quyền quản trị.
$lam = Join-Path $(if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { $env:TEMP }) 'ThatThoatNuoc-TrienKhai'
New-Item -ItemType Directory -Force $lam | Out-Null
$tai = Join-Path $lam 'TaiVe'
New-Item -ItemType Directory -Force $tai | Out-Null
try { Start-Transcript -Path (Join-Path $lam ('NhatKy-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')) | Out-Null } catch { }

# ------------------------------------------------------------------ 1. nền máy chủ

if (-not $ChiTaoGoi) {
    $os = Get-CimInstance Win32_OperatingSystem
    $laMayChu = $os.ProductType -ne 1
    Write-Host "Máy: $($os.Caption) (bản $($os.Version))"
    $canKhoiDongLai = $false

    Buoc '.NET Framework 4'
    $rel = BanNetFramework
    if ($rel -ge 394802) {
        Write-Host "Có .NET Framework $(TenNetFramework $rel)."
    }
    else {
        Write-Host "Máy có .NET Framework $(TenNetFramework $rel), cần 4.6.2 trở lên → cài .NET Framework 4.8."
        $tep = Join-Path $tai 'ndp48-x86-x64-allos-enu.exe'
        TaiTep $netFx48 $tep
        KiemChuKyMicrosoft $tep
        Write-Host 'Đang cài .NET Framework 4.8 (vài phút)...'
        $ma = ChayTrinhCai $tep @('/q', '/norestart')
        if ($ma -eq 5100) { Dung 'Máy chưa đủ điều kiện cài .NET Framework 4.8 (Windows Server 2012 R2 cần bản cập nhật KB2919355). Chạy Windows Update rồi chạy lại.' }
        if (@(0, 1641, 3010) -notcontains $ma) { Dung "Cài .NET Framework 4.8 lỗi (mã $ma)." }
        if ($ma -ne 0) { $canKhoiDongLai = $true }
        Write-Host 'Đã cài .NET Framework 4.8.' -ForegroundColor Green
    }

    Buoc 'IIS (Web Server)'
    if ($laMayChu) {
        $canCo = @('Web-Server', 'Web-WebServer', 'Web-Common-Http', 'Web-Default-Doc', 'Web-Static-Content', 'Web-Http-Errors',
                   'Web-Health', 'Web-Http-Logging', 'Web-Performance', 'Web-Stat-Compression', 'Web-Security', 'Web-Filtering')
        $nenCo = @('Web-Mgmt-Tools', 'Web-Mgmt-Console')   # IIS Manager: không có trên Server Core
        $thieu = @(Get-WindowsFeature -Name $canCo | Where-Object { $_.InstallState -eq 'Available' } | ForEach-Object { $_.Name })
        if ($thieu.Count -gt 0) {
            Write-Host "Cài: $($thieu -join ', ') (vài phút)..."
            $kq = Install-WindowsFeature -Name $thieu
            if (-not $kq.Success) { Dung 'Cài IIS không thành công. Xem Server Manager → Notifications, hoặc cài vai trò Web Server (IIS) bằng tay rồi chạy lại.' }
            if ("$($kq.RestartNeeded)" -eq 'Yes') { $canKhoiDongLai = $true }
        }
        $thieu = @(Get-WindowsFeature -Name $nenCo | Where-Object { $_.InstallState -eq 'Available' } | ForEach-Object { $_.Name })
        if ($thieu.Count -gt 0) {
            try { Install-WindowsFeature -Name $thieu | Out-Null } catch { CanhBao "Không cài được IIS Manager (không bắt buộc): $($_.Exception.Message)" }
        }
    }
    else {
        # Windows 10 / 11
        $canCo = @('IIS-WebServerRole', 'IIS-WebServer', 'IIS-CommonHttpFeatures', 'IIS-DefaultDocument', 'IIS-StaticContent',
                   'IIS-HttpErrors', 'IIS-HealthAndDiagnostics', 'IIS-HttpLogging', 'IIS-Performance', 'IIS-HttpCompressionStatic',
                   'IIS-Security', 'IIS-RequestFiltering', 'IIS-WebServerManagementTools', 'IIS-ManagementConsole')
        $thieu = @(Get-WindowsOptionalFeature -Online | Where-Object { $canCo -contains $_.FeatureName -and "$($_.State)" -ne 'Enabled' } |
                   ForEach-Object { $_.FeatureName })
        if ($thieu.Count -gt 0) {
            Write-Host "Bật tính năng Windows: $($thieu -join ', ') (vài phút)..."
            $kq = Enable-WindowsOptionalFeature -Online -FeatureName $thieu -All -NoRestart
            if ($kq.RestartNeeded) { $canKhoiDongLai = $true }
        }
    }
    if (-not (Test-Path $appcmd)) {
        if ($canKhoiDongLai) { CanhBao 'IIS sẽ có sau khi khởi động lại máy.' }
        else { Dung 'Không thấy IIS sau khi cài (thiếu appcmd.exe).' }
    }
    else {
        foreach ($dv in 'WAS', 'W3SVC') {
            Set-Service -Name $dv -StartupType Automatic
            if ((Get-Service -Name $dv).Status -ne 'Running') { Start-Service -Name $dv }
        }
        Write-Host 'IIS: có, đang chạy.'
    }

    Buoc 'ASP.NET Core Hosting Bundle (ASP.NET Core Module V2 cho IIS)'
    if (CoAncm) {
        Write-Host 'Đã có ASP.NET Core Module V2 — bỏ qua.'
    }
    elseif (Test-Path $appcmd) {
        $kenh = ChonKenhDotNet
        Write-Host "Tìm bản mới nhất của dòng $kenh..."
        $b = TimHostingBundle $kenh
        $tep = Join-Path $tai ([IO.Path]::GetFileName(([Uri]$b.Url).AbsolutePath))
        if (BamDung $tep $b.Bam) { Write-Host "Đã tải sẵn: $tep" }
        else { TaiTep $b.Url $tep }
        if (-not (BamDung $tep $b.Bam)) {
            Remove-Item -LiteralPath $tep -Force -ErrorAction SilentlyContinue
            Dung 'Mã băm SHA-512 của tệp tải về khác với mã Microsoft công bố (tệp hỏng hoặc bị tráo) — đã xoá. Chạy lại.'
        }
        Write-Host '  Mã băm SHA-512: khớp với Microsoft công bố.'
        KiemChuKyMicrosoft $tep

        Write-Host "Đang cài ASP.NET Core Hosting Bundle $($b.PhienBan)..."
        $log = Join-Path $lam 'hosting-bundle.log'
        $ma = ChayTrinhCai $tep @('/install', '/quiet', '/norestart', '/log', "`"$log`"")
        if (@(0, 1638, 1641, 3010) -notcontains $ma) { Dung "Cài Hosting Bundle lỗi (mã $ma). Xem $log" }
        if ($ma -eq 1641 -or $ma -eq 3010) { $canKhoiDongLai = $true }
        KhoiDongLaiIis
        if (-not (CoAncm)) {
            # Hosting Bundle đã cài từ trước khi có IIS: phải sửa (repair) để module được đăng ký vào IIS
            Write-Host 'Đăng ký lại module vào IIS (repair)...'
            $ma = ChayTrinhCai $tep @('/repair', '/quiet', '/norestart', '/log', "`"$log`"")
            if ($ma -eq 1641 -or $ma -eq 3010) { $canKhoiDongLai = $true }
            KhoiDongLaiIis
        }
        if (CoAncm) { Write-Host "Đã cài ASP.NET Core Hosting Bundle $($b.PhienBan)." -ForegroundColor Green }
        elseif (-not $canKhoiDongLai) { Dung "IIS vẫn chưa có ASP.NET Core Module V2 sau khi cài. Xem $log" }
    }

    if ($canKhoiDongLai) {
        Write-Host ''
        CanhBao '=============================================================='
        CanhBao ' Cần KHỞI ĐỘNG LẠI máy để hoàn tất cài đặt.'
        CanhBao ' Khởi động lại xong, chạy lại TrienKhai-IIS.bat (phần đã cài sẽ được bỏ qua).'
        CanhBao '=============================================================='
        exit 3010
    }
    if ($ChiCaiNen) {
        Write-Host ''
        Write-Host 'ĐÃ CÀI XONG nền máy chủ: IIS + ASP.NET Core Module V2. Tiếp theo chạy TrienKhai-IIS.bat (không tham số) hoặc CaiDat-IIS.bat của gói.' -ForegroundColor Green
        exit 0
    }
}

# ------------------------------------------------------------------ 2. lấy phần mềm, biên dịch

$goi = ''       # thư mục gói sẽ cài
$nguonMa = ''   # thư mục mã nguồn (có build.ps1, src, iis)
if ($Nguon -ne 'GitHub') {
    if (LaGoi $goc) {
        if ($ChiTaoGoi) { Dung "Công cụ đang nằm trong gói cài IIS ($goc): gói đã sẵn sàng, chép cả thư mục sang máy chủ." }
        $goi = $goc
        Buoc "Dùng gói cài IIS có sẵn: $goi"
        # Gói giải nén từ tệp .zip tải trên mạng: gỡ dấu "tải từ Internet" để Windows không chặn / hỏi lại khi chạy
        try { Get-ChildItem -LiteralPath $goi -Recurse -File | Unblock-File }
        catch { CanhBao "Không gỡ được dấu tải từ Internet (không bắt buộc): $($_.Exception.Message)" }
    }
    else {
        foreach ($d in @($goc, (Split-Path -Parent $goc))) {
            if (LaThuMucNguon $d) { $nguonMa = (Resolve-Path -LiteralPath $d).Path; break }
        }
        if ($nguonMa) { Buoc "Mã nguồn trên máy này: $nguonMa" }
        elseif ($Nguon -eq 'MayNay') { Dung "Không thấy mã nguồn (build.ps1, src, iis) quanh $goc." }
    }
}
if (-not $goi -and -not $nguonMa) { $nguonMa = TaiMaNguon }

if ($nguonMa) {
    $exe = Join-Path $lam 'ThatThoatNuoc.exe'
    if ($KhongBienDich) {
        $co = Join-Path $nguonMa 'ThatThoatNuoc.exe'
        if (-not (Test-Path -LiteralPath $co)) { Dung "Không có $co (bỏ -KhongBienDich để biên dịch từ mã nguồn)." }
        Copy-Item -LiteralPath $co $exe -Force
        Buoc "Dùng ThatThoatNuoc.exe có sẵn trong mã nguồn (không biên dịch)"
    }
    else {
        Buoc 'Biên dịch ThatThoatNuoc.exe (build.ps1)'
        if (Test-Path -LiteralPath $exe) { Remove-Item -LiteralPath $exe -Force }
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $nguonMa 'build.ps1') -Out $exe
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exe)) {
            Dung 'Biên dịch thất bại (xem lỗi ở trên). Có thể chạy lại với -KhongBienDich để dùng ThatThoatNuoc.exe có sẵn trong mã nguồn.'
        }
    }
    Write-Host "Phiên bản tệp: $((Get-Item -LiteralPath $exe).LastWriteTime.ToString('yyyy-MM-dd HH:mm')), $([Math]::Round((Get-Item -LiteralPath $exe).Length / 1KB)) KB"
}

Buoc 'Chạy thử ThatThoatNuoc.exe ở chế độ máy chủ'
$exeThu = if ($goi) { Join-Path $goi 'web\ThatThoatNuoc.exe' } else { $exe }
$loiThu = ThuChayExe $exeThu
if ($loiThu) { Dung "ThatThoatNuoc.exe không chạy được trên máy này: $loiThu" }
Write-Host 'Chạy được.'

# ------------------------------------------------------------------ 3. đóng gói

$zip = ''
if ($nguonMa) {
    $noi = $Ra
    if (-not $noi) { $noi = if ($ChiTaoGoi) { [Environment]::GetFolderPath('DesktopDirectory') } else { $lam } }
    New-Item -ItemType Directory -Force $noi | Out-Null
    Buoc "Đóng gói $tenGoi"
    $goi = TaoGoi $nguonMa $exe $noi
    $zip = "$goi.zip"
    Write-Host "Gói:      $goi"
    Write-Host "Tệp nén:  $zip"
}

if ($ChiTaoGoi) {
    Write-Host ''
    Write-Host '==============================================================' -ForegroundColor Green
    Write-Host ' ĐÃ TẠO GÓI CÀI MÁY CHỦ IIS' -ForegroundColor Green
    Write-Host " $zip"
    Write-Host ' Chép tệp .zip sang máy chủ, giải nén, nhấp đúp TrienKhai-IIS.bat'
    Write-Host ' (tự cài IIS + ASP.NET Core Hosting Bundle nếu thiếu, rồi tạo site — xem HUONG_DAN_IIS.txt).'
    Write-Host '==============================================================' -ForegroundColor Green
    try { Stop-Transcript | Out-Null } catch { }
    exit 0
}

# ------------------------------------------------------------------ 4. cấu hình IIS

Buoc 'Cấu hình IIS: chạy CaiDat-IIS.ps1 của gói'
$ts = @()
if ($Cong -gt 0) { $ts += @('-Cong', "$Cong") }
if ($DuLieu) { $ts += @('-DuLieu', $DuLieu) }
if ($DuongDan) { $ts += @('-DuongDan', $DuongDan) }
if ($ChungChi) { $ts += @('-ChungChi', $ChungChi) }
if ($TenMien) { $ts += @('-TenMien', $TenMien) }
if ($DatMatKhau) { $ts += '-DatMatKhau' }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $goi 'CaiDat-IIS.ps1') @ts
$maCaiDat = $LASTEXITCODE
if ($maCaiDat -ne 0) { Dung "CaiDat-IIS.ps1 dừng với mã $maCaiDat — xem thông báo ở trên." }

Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
Write-Host ' TRIỂN KHAI XONG' -ForegroundColor Green
Write-Host " Gói đã cài:  $goi"
if ($zip) { Write-Host " Tệp nén:     $zip   (dùng cho máy chủ khác: giải nén, nhấp đúp TrienKhai-IIS.bat)" }
Write-Host " Kiểm tra lại: $(Join-Path $goi 'CaiDat-IIS.bat') -KiemTra"
Write-Host " Nhật ký:     $lam\NhatKy-*.txt"
Write-Host '==============================================================' -ForegroundColor Green
try { Stop-Transcript | Out-Null } catch { }
