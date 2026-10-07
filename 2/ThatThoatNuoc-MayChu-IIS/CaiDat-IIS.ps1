# Cài máy chủ IIS cho phần mềm "Quản lý thất thoát nước" — website HTTP cổng 80.
# Dữ liệu nằm trên máy chủ; trình duyệt (máy tính, điện thoại), app Android và phần mềm trên máy tính vào qua http://<máy chủ>/.
# Máy chủ cần có sẵn IIS + ASP.NET Core Hosting Bundle (vd 9.0) — script KHÔNG cài thêm tính năng Windows nào.
#
# Chạy bằng CaiDat-IIS.bat (tự xin quyền quản trị). Tham số tuỳ chọn, vd:
#   CaiDat-IIS.bat -Cong 8081                        dùng cổng khác 80
#   CaiDat-IIS.bat -DuLieu D:\ThatThoatNuocData      thư mục dữ liệu (mặc định C:\ThatThoatNuocData)
#   CaiDat-IIS.bat -DuongDan /thatthoat              tên ứng dụng con khi cổng 80 đã có site khác (mặc định /thatthoat)
#   CaiDat-IIS.bat -TenMien thatthoat.tenmien.vn     site riêng theo tên miền (host header), dùng chung cổng 80 với site khác
#   CaiDat-IIS.bat -ThaySiteMacDinh                  dừng "Default Web Site" (trang chào IIS) để phần mềm ở ngay http://<máy chủ>/
#   CaiDat-IIS.bat -DatMatKhau                       đặt lại mật khẩu tài khoản quản trị
#   CaiDat-IIS.bat -KiemTra                          gọi thử máy chủ
#   CaiDat-IIS.bat -GoBo                             gỡ site / ứng dụng (giữ nguyên thư mục dữ liệu)
param(
    [int]$Cong = 80,
    [string]$TenSite = 'ThatThoatNuoc',
    [string]$ThuMuc = "$env:SystemDrive\inetpub\ThatThoatNuoc",
    [string]$DuLieu = "$env:SystemDrive\ThatThoatNuocData",
    [string]$DuongDan = '',
    [string]$TenMien = '',
    [switch]$ThaySiteMacDinh,
    [switch]$DatMatKhau,
    [switch]$KiemTra,
    [switch]$GoBo
)

$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
$exeGoi = Join-Path $goc 'web\ThatThoatNuoc.exe'
$tenTuongLua = 'Quan ly that thoat nuoc (IIS)'
$tenChungChiCu = 'That thoat nuoc (IIS)'      # chứng chỉ tự ký do bản cũ (HTTPS cổng 8080) tạo — bản này gỡ đi
$siteMacDinh = 'Default Web Site'
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

function CoUngDung([string]$app) { (Chay $appcmd @('list', 'app', $app)).Ma -eq 0 }

# Đọc lại lựa chọn của lần cài trước (site riêng hay ứng dụng con của site nào, cổng, thư mục dữ liệu)
$caiTruoc = @{}
if (Test-Path $tepCaiDat) {
    Get-Content $tepCaiDat -Encoding UTF8 | ForEach-Object { if ($_ -match '^\s*([A-Za-z]+)\s*=\s*(.*)$') { $caiTruoc[$Matches[1]] = $Matches[2].Trim() } }
}
# Lần cài trước là bản HTTP này thì giữ cổng / tên miền cũ khi không ghi tham số; bản HTTPS 8080 cũ thì chuyển sang cổng 80.
$laBanHttp = $caiTruoc['GiaoThuc'] -eq 'http'
if (-not $PSBoundParameters.ContainsKey('DuLieu') -and $caiTruoc['DuLieu']) { $DuLieu = $caiTruoc['DuLieu'] }
if ($laBanHttp -and -not $PSBoundParameters.ContainsKey('Cong') -and $caiTruoc['Cong']) { $Cong = [int]$caiTruoc['Cong'] }
if ($laBanHttp -and -not $PSBoundParameters.ContainsKey('TenMien') -and $caiTruoc['TenMien']) { $TenMien = $caiTruoc['TenMien'] }
if ($caiTruoc['DaDungSiteMacDinh'] -eq '1') { $ThaySiteMacDinh = $true }
$TenMien = $TenMien.Trim().ToLowerInvariant()

function DiaChi([string]$may, [int]$cong, [string]$duong) {
    $c = if ($cong -eq 80) { '' } else { ":$cong" }
    "http://$may$c$duong/"
}

# Gọi http://127.0.0.1:cổng/đường-dẫn/api/ping (gửi kèm tên miền nếu site theo host header)
function GoiThu([int]$cong, [string]$duong, [string]$tenMay) {
    $kq = [pscustomobject]@{ Ok = $false; Than = ''; Loi = '' }
    try {
        $tcp = New-Object Net.Sockets.TcpClient('127.0.0.1', $cong)
        $tcp.ReceiveTimeout = 90000
        $ns = $tcp.GetStream()
        $h = if ($tenMay) { $tenMay } else { 'localhost' }
        $yc = [Text.Encoding]::ASCII.GetBytes("GET $($duong.TrimEnd('/'))/api/ping HTTP/1.1`r`nHost: $h`r`nConnection: close`r`n`r`n")
        $ns.Write($yc, 0, $yc.Length)
        $ns.Flush()
        $sr = New-Object IO.StreamReader($ns, [Text.Encoding]::UTF8)
        $text = $sr.ReadToEnd()
        $tcp.Close()
        $kq.Than = $text
        $kq.Ok = ($text -split "`n")[0] -match ' 200 ' -and $text -match 'ThatThoatNuoc'
        if (-not $kq.Ok) { $kq.Loi = ($text -split "`n")[0].Trim() }
    }
    catch { $kq.Loi = $_.Exception.Message }
    $kq
}

# Bản cũ (HTTPS cổng 8080) gắn chứng chỉ tự ký vào cổng bằng netsh: gỡ binding và chứng chỉ đó.
function DonBanHttpsCu {
    $cc = @(Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.FriendlyName -eq $tenChungChiCu })
    if ($cc.Count -eq 0) { return }
    $congCu = @('8080')
    if ($caiTruoc['Cong']) { $congCu += $caiTruoc['Cong'] }
    foreach ($c in $cc) {
        foreach ($p in ($congCu | Select-Object -Unique)) {
            if ((Chay netsh.exe @('http', 'show', 'sslcert', "ipport=0.0.0.0:$p")).Ra -match $c.Thumbprint) {
                Chay netsh.exe @('http', 'delete', 'sslcert', "ipport=0.0.0.0:$p") | Out-Null
            }
        }
        Remove-Item $c.PSPath -ErrorAction SilentlyContinue
    }
    Write-Host "Đã gỡ chứng chỉ tự ký của bản HTTPS cũ (không dùng nữa)."
}

function MoLaiSiteMacDinh {
    if ($caiTruoc['DaDungSiteMacDinh'] -ne '1' -or -not (CoTrongIis 'site' $siteMacDinh)) { return }
    Chay $appcmd @('set', 'site', "/site.name:$siteMacDinh", '/serverAutoStart:true') | Out-Null
    Chay $appcmd @('start', 'site', "/site.name:$siteMacDinh") | Out-Null
    Write-Host "Đã chạy lại '$siteMacDinh'."
}

# ------------------------------------------------------------------ kiểm tra quyền, IIS

$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Cần quyền quản trị: hãy chạy CaiDat-IIS.bat (tự xin quyền).' }
if (-not (Test-Path $appcmd)) { Dung 'Máy này chưa có IIS.' }

if ($KiemTra) {
    $duong = if ($caiTruoc['DuongDan']) { $caiTruoc['DuongDan'] } else { $DuongDan }
    $tenMay = if ($caiTruoc['SiteCha']) { '' } else { $TenMien }
    Buoc "Gọi thử $(DiaChi '127.0.0.1' $Cong $duong)api/ping"
    $t = GoiThu $Cong $duong $tenMay
    if ($t.Ok) {
        Write-Host 'OK: máy chủ Thất thoát nước trả lời bình thường.' -ForegroundColor Green
        exit 0
    }
    Write-Host "Chưa được: $($t.Loi)" -ForegroundColor Red
    if ($t.Than) { Write-Host ($t.Than.Substring(0, [Math]::Min(600, $t.Than.Length))) }
    Write-Host "Xem thêm nhật ký: $DuLieu\NhatKy và $DuLieu\loi-khoi-dong.txt"
    exit 1
}

# ------------------------------------------------------------------ gỡ

if ($GoBo) {
    Buoc 'Gỡ máy chủ Thất thoát nước khỏi IIS (giữ nguyên thư mục dữ liệu)'
    $siteCha = $caiTruoc['SiteCha']
    if ($siteCha) {
        $app = "$siteCha$($caiTruoc['DuongDan'])"
        if (CoUngDung $app) { AppCmd @('delete', 'app', $app) }
    }
    if (CoTrongIis 'site' $TenSite) { AppCmd @('delete', 'site', "/site.name:$TenSite") }
    if (CoTrongIis 'apppool' $TenSite) { AppCmd @('delete', 'apppool', "/apppool.name:$TenSite") }
    DonBanHttpsCu
    MoLaiSiteMacDinh
    Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    if (Test-Path $ThuMuc) { Remove-Item -Recurse -Force $ThuMuc }
    Write-Host ''
    Write-Host "Đã gỡ xong. Dữ liệu vẫn còn ở: $DuLieu" -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $exeGoi)) { Dung 'Thiếu web\ThatThoatNuoc.exe trong gói. Hãy tạo lại gói trong phần mềm: Cài đặt → Máy chủ dữ liệu → Tạo gói cài IIS.' }

Buoc 'Kiểm tra IIS và ASP.NET Core Hosting Bundle'
if ((Chay $appcmd @('list', 'config', '-section:system.webServer/globalModules')).Ra -notmatch 'AspNetCoreModuleV2') {
    Dung 'IIS chưa có ASP.NET Core Module V2. Hãy cài ASP.NET Core Hosting Bundle (vd 9.0) rồi chạy lại.'
}
$ancm = Join-Path $env:ProgramFiles 'IIS\Asp.Net Core Module\V2\aspnetcorev2.dll'
$pbAncm = if (Test-Path $ancm) { ' (phiên bản ' + (Get-Item $ancm).VersionInfo.ProductVersion + ')' } else { '' }
Write-Host "IIS + ASP.NET Core Module V2$($pbAncm): có."

# ------------------------------------------------------------------ chọn cách cài: site riêng hay ứng dụng con

Buoc "HTTP cổng $Cong"
$siteCha = ''
$giaoThucCha = 'http'
$trungTenMien = ''
$dungMacDinh = $false
$dsSite = [xml](Chay $appcmd @('list', 'site', '/xml')).Ra
foreach ($s in @($dsSite.appcmd.SITE)) {
    if (-not $s -or $s.'SITE.NAME' -eq $TenSite) { continue }
    foreach ($b in ($s.bindings -split ',')) {
        if ($b -notmatch "^(https?)/(.*):${Cong}:([^:]*)$") { continue }
        $gt = $Matches[1]
        $hh = $Matches[3].Trim().ToLowerInvariant()
        if ($TenMien) {
            if ($hh -eq $TenMien) { $trungTenMien = $s.'SITE.NAME' }
            continue
        }
        if ($hh) { continue }   # site khác chỉ nhận 1 tên miền: không chiếm cổng của ta
        if ($ThaySiteMacDinh -and $s.'SITE.NAME' -eq $siteMacDinh) { $dungMacDinh = $true; continue }
        $siteCha = $s.'SITE.NAME'
        $giaoThucCha = $gt
    }
}
if ($trungTenMien) { Dung "Site IIS '$trungTenMien' đã dùng tên miền $TenMien ở cổng $Cong." }

if ($siteCha) {
    if (-not $DuongDan) { $DuongDan = if ($caiTruoc['DuongDan']) { $caiTruoc['DuongDan'] } else { '/thatthoat' } }
    if (-not $DuongDan.StartsWith('/')) { $DuongDan = '/' + $DuongDan }
    $DuongDan = $DuongDan.TrimEnd('/')
    if ($DuongDan.Length -lt 2) { Dung 'Đường dẫn ứng dụng con không hợp lệ (vd /thatthoat).' }
    Write-Host "Cổng $Cong đang dùng cho site IIS '$siteCha' → cài thành ứng dụng con: $siteCha$DuongDan"
    if ($giaoThucCha -ne 'http') { CanhBao "Lưu ý: site '$siteCha' dùng $giaoThucCha ở cổng $Cong — địa chỉ sẽ là ${giaoThucCha}://…" }
    if ($siteCha -eq $siteMacDinh) {
        Write-Host "Muốn phần mềm ở ngay http://<máy chủ>/ (thay trang chào của IIS): chạy lại với  -ThaySiteMacDinh"
    }
}
else {
    $DuongDan = ''
    if (-not $TenMien) {
        $nghe = @(Get-NetTCPConnection -LocalPort $Cong -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 4 })
        if ($nghe.Count -gt 0) {
            $p = Get-Process -Id $nghe[0].OwningProcess -ErrorAction SilentlyContinue
            Dung "Cổng $Cong đang bị chương trình '$($p.ProcessName)' (không phải IIS) dùng."
        }
    }
    if ($TenMien) { Write-Host "Cài thành site riêng '$TenSite', http cổng $Cong, tên miền $TenMien." }
    else { Write-Host "Cài thành site riêng '$TenSite', http cổng $Cong." }
    if ($dungMacDinh) { Write-Host "Sẽ dừng '$siteMacDinh' (trang chào của IIS) — gỡ phần mềm bằng -GoBo thì site đó chạy lại." }
}

# ------------------------------------------------------------------ chép chương trình

Buoc "Chép chương trình vào $ThuMuc"
if (CoTrongIis 'apppool' $TenSite) {
    Chay $appcmd @('stop', 'apppool', "/apppool.name:$TenSite") | Out-Null
    Start-Sleep -Seconds 4   # chờ ThatThoatNuoc.exe cũ lưu dữ liệu và thoát
}
New-Item -ItemType Directory -Force $ThuMuc | Out-Null
try { Copy-Item (Join-Path $goc 'web\*') $ThuMuc -Recurse -Force -ErrorAction Stop }
catch { Dung "Không chép được vào $ThuMuc`: $($_.Exception.Message)" }
$cfgWeb = Join-Path $ThuMuc 'web.config'
$x = New-Object Xml.XmlDocument
$x.PreserveWhitespace = $true
$x.Load($cfgWeb)
$x.SelectSingleNode("//environmentVariable[@name='THATTHOAT_DULIEU']").SetAttribute('value', $DuLieu)
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
Write-Host "App pool '$TenSite' được ghi; người dùng thường không đọc được (có tài khoản, mật khẩu đã băm)."

$tepMayChu = Join-Path $DuLieu 'maychu.xml'
$coQuanTri = (Test-Path $tepMayChu) -and ((Get-Content $tepMayChu -Raw -Encoding UTF8) -match 'vaiTro="QuanTri"')
if (-not $coQuanTri -or $DatMatKhau) {
    Buoc 'Tài khoản quản trị (đăng nhập trang web, phần mềm máy tính; tạo tài khoản cho người khác)'
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
    $env:THATTHOAT_DULIEU = $DuLieu
    $env:THATTHOAT_MATKHAU = $p1
    try {
        $pr = Start-Process -FilePath (Join-Path $ThuMuc 'ThatThoatNuoc.exe') -ArgumentList @('--dat-quan-tri', $ten) -Wait -PassThru -NoNewWindow
    }
    finally {
        Remove-Item Env:\THATTHOAT_MATKHAU -ErrorAction SilentlyContinue
        $p1 = $null; $p2 = $null
    }
    if ($pr.ExitCode -ne 0) { Dung "Không tạo được tài khoản (mã $($pr.ExitCode)). Xem $DuLieu\loi-khoi-dong.txt" }
    Write-Host "Đã đặt tài khoản quản trị '$ten'." -ForegroundColor Green
}

# ------------------------------------------------------------------ site / ứng dụng con

# Lần cài trước là ứng dụng con ở chỗ khác (vd site cổng 8080 của bản HTTPS cũ): gỡ, tránh 2 bản cùng ghi 1 thư mục dữ liệu
$siteCu = $caiTruoc['SiteCha']
if ($siteCu -and ($siteCu -ne $siteCha -or $caiTruoc['DuongDan'] -ne $DuongDan)) {
    $appCu = "$siteCu$($caiTruoc['DuongDan'])"
    if (CoUngDung $appCu) { AppCmd @('delete', 'app', $appCu); Write-Host "Đã gỡ ứng dụng cũ '$appCu'." }
}
DonBanHttpsCu

if ($siteCha) {
    Buoc "Ứng dụng '$siteCha$DuongDan'"
    if (CoTrongIis 'site' $TenSite) { AppCmd @('delete', 'site', "/site.name:$TenSite") }
    $app = "$siteCha$DuongDan"
    if (CoUngDung $app) {
        AppCmd @('set', 'app', $app, "/applicationPool:$TenSite")
        AppCmd @('set', 'vdir', "$app/", "/physicalPath:$ThuMuc")
    }
    else {
        AppCmd @('add', 'app', "/site.name:$siteCha", "/path:$DuongDan", "/physicalPath:$ThuMuc", "/applicationPool:$TenSite")
    }
    Write-Host "Đã tạo: $(DiaChi '<máy chủ>' $Cong $DuongDan)"
}
else {
    if ($dungMacDinh) {
        Buoc "Dừng '$siteMacDinh'"
        Chay $appcmd @('stop', 'site', "/site.name:$siteMacDinh") | Out-Null
        AppCmd @('set', 'site', "/site.name:$siteMacDinh", '/serverAutoStart:false')
        Write-Host "Đã dừng '$siteMacDinh' (không xoá; chạy lại trong IIS Manager khi cần)."
    }
    Buoc "Site '$TenSite'"
    $binding = "http/*:${Cong}:$TenMien"
    if (CoTrongIis 'site' $TenSite) {
        AppCmd @('set', 'site', "/site.name:$TenSite", "/bindings:$binding")
        AppCmd @('set', 'vdir', "$TenSite/", "/physicalPath:$ThuMuc")
    }
    else {
        AppCmd @('add', 'site', "/name:$TenSite", "/bindings:$binding", "/physicalPath:$ThuMuc")
    }
    AppCmd @('set', 'app', "$TenSite/", "/applicationPool:$TenSite")
    Write-Host "Site '$TenSite': $binding → $ThuMuc"
}

if (-not $dungMacDinh) { MoLaiSiteMacDinh }   # lần trước đã dừng Default Web Site mà lần này không cần nữa
$daDung = if ($dungMacDinh) { '1' } else { '0' }
@("GiaoThuc=http", "Cong=$Cong", "SiteCha=$siteCha", "DuongDan=$DuongDan", "TenMien=$TenMien", "DuLieu=$DuLieu",
  "DaDungSiteMacDinh=$daDung") | Set-Content $tepCaiDat -Encoding UTF8

Buoc "Tường lửa Windows: cho phép cổng $Cong"
Get-NetFirewallRule -DisplayName $tenTuongLua -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $tenTuongLua -Direction Inbound -Protocol TCP -LocalPort $Cong -Action Allow -Profile Any | Out-Null
Write-Host "Đã thêm quy tắc '$tenTuongLua'."

Buoc 'Khởi động và gọi thử'
Chay $appcmd @('start', 'apppool', "/apppool.name:$TenSite") | Out-Null
if (-not $siteCha) {
    $r = Chay $appcmd @('start', 'site', "/site.name:$TenSite")
    if ($r.Ma -ne 0 -and $r.Ra -notmatch 'already') { CanhBao "Không chạy được site '$TenSite': $($r.Ra)" }
}
Start-Sleep -Seconds 2
$t = GoiThu $Cong $DuongDan $(if ($siteCha) { '' } else { $TenMien })

$dsDiaChi = @()
if ($TenMien -and -not $siteCha) { $dsDiaChi += DiaChi $TenMien $Cong $DuongDan }
else {
    $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
             Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress)
    foreach ($ip in $ips) { $dsDiaChi += DiaChi $ip $Cong $DuongDan }
    $dsDiaChi += DiaChi $env:COMPUTERNAME $Cong $DuongDan
}
$chinh = $dsDiaChi[0]
Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
Write-Host " ĐÃ CÀI XONG máy chủ Quản lý thất thoát nước — website HTTP cổng $Cong" -ForegroundColor Green
Write-Host ' Địa chỉ (mở bằng trình duyệt trên máy tính / điện thoại):'
foreach ($d in $dsDiaChi) { Write-Host "     $d" }
if (-not $TenMien) { Write-Host "     hoặc  $(DiaChi '<tên miền / IP công cộng>' $Cong $DuongDan)  (router chuyển cổng $Cong về máy chủ này)" }
Write-Host " Dữ liệu:   $DuLieu   (tự sao lưu mỗi ngày trong SaoLuu)"
Write-Host ''
Write-Host ' Bước tiếp:'
Write-Host "   - Trình duyệt: mở địa chỉ trên, đăng nhập tài khoản quản trị → thẻ 'Quản trị' để tạo tài khoản cho người khác."
Write-Host "   - App Android: tải tại  $($chinh)tai-app , mở app và nhập địa chỉ trên."
Write-Host '   - Phần mềm trên máy tính: Cài đặt → Máy chủ dữ liệu → Kết nối máy chủ… → nhập địa chỉ trên + tài khoản quản trị'
Write-Host '     (lần đầu chọn "Đưa dữ liệu trên máy này lên máy chủ").'
Write-Host ''
CanhBao ' Lưu ý: HTTP không mã hoá — mật khẩu và số liệu đi qua mạng ở dạng thường. Nên dùng trong mạng nội bộ / VPN;'
CanhBao '        khi có chứng chỉ thật cho tên miền, thêm binding https trong IIS Manager (phần mềm và app dùng được https://).'
Write-Host '==============================================================' -ForegroundColor Green
if (-not $t.Ok) {
    CanhBao " Gọi thử CHƯA thành công: $($t.Loi)"
    CanhBao " Xem: $DuLieu\NhatKy, $DuLieu\loi-khoi-dong.txt, rồi chạy lại: CaiDat-IIS.bat -KiemTra"
}
