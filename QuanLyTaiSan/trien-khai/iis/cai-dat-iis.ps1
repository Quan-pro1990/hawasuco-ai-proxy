<#
.SYNOPSIS
  Cai may chu phan mem Quan ly tai san (quet tem QR xem thong tin, anh tai san) len IIS tren Windows Server 2016
  tro len / Windows 10, 11. Cach dung site giong may chu HawaMap.

.DESCRIPTION
  - Bat IIS (neu chua co), kiem tra .NET Framework 4.5+, URL Rewrite 2.1, HttpPlatformHandler 1.2.
  - Chep QuanLyTaiSan.exe vao thu muc site, tao web.config, app pool "No Managed Code", cap quyen thu muc.
  - Lan dau: hoi ten + mat khau tai khoan quan tri cua phan mem.
  - Tao site, gan binding HTTP theo ten mien (va HTTPS neu co van tay chung chi, hoac chung chi tu ky khi chua co ten mien).
  - Site da co binding HTTPS cho ten mien (vd. win-acme gan chung chi Let's Encrypt): bat chuyen http -> https, mo cong 443.
  - IIS tu chay va giam sat QuanLyTaiSan.exe qua HttpPlatformHandler: tu chay khi may khoi dong, tu bat lai khi loi.
  Chay lai script de cap nhat phien ban moi (du lieu trong -ThuMucDuLieu duoc giu nguyen).
  Nguoi moi: nhap dup CAI-DAT-MAY-CHU.bat (goi cai-dat-nhanh.ps1: hoi tung buoc roi goi script nay).

.EXAMPLE
  # chay trong PowerShell "Run as administrator", tu thu muc goi cai dat:
  powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\cai-dat-iis.ps1 -TenMien taisan.congty.vn

.EXAMPLE
  # co chung chi HTTPS da nhap vao kho "Local Computer\Personal" (lay van tay trong IIS > Server Certificates):
  .\trien-khai\iis\cai-dat-iis.ps1 -TenMien taisan.congty.vn -VanTayChungChi 3A1B...F9

.EXAMPLE
  # chua co ten mien: http cong 8080, https bang chung chi tu ky cong 8443 (dien thoai canh bao lan dau)
  .\trien-khai\iis\cai-dat-iis.ps1 -CongHttp 8080 -TuKy -CongHttps 8443
#>
[CmdletBinding()]
param(
  [string]$TenSite = 'QuanLyTaiSan',
  [string]$ThuMuc = 'C:\inetpub\QuanLyTaiSan',
  [string]$ThuMucDuLieu = 'C:\QuanLyTaiSanData',
  [string]$TenMien = '',
  [int]$CongHttp = 80,
  [int]$CongHttps = 443,
  [string]$VanTayChungChi = '',
  [switch]$TuKy,
  [switch]$BoQuaChepTep
)

$ErrorActionPreference = 'Stop'

function Buoc([string]$s) { Write-Host "==> $s" -ForegroundColor Cyan }
function CanhBao([string]$s) { Write-Host "[CANH BAO] $s" -ForegroundColor Yellow }
function Dung([string]$s) { Write-Host "[LOI] $s" -ForegroundColor Red; exit 1 }

# ------------------------------------------------------------------ 0. quyen quan tri, goi cai dat
$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Hay mo PowerShell bang quyen Administrator (chuot phai > Run as administrator).' }

# script nam o <goi cai dat>\trien-khai\iis
$Goc = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$exeGoi = Join-Path $Goc 'QuanLyTaiSan.exe'
if (-not (Test-Path $exeGoi)) { Dung "Khong thay QuanLyTaiSan.exe trong $Goc. Hay giai nen (Extract All) ca goi cai dat roi chay lai." }
$VanTayChungChi = ($VanTayChungChi -replace '[^0-9A-Fa-f]', '').ToUpper()
$TenMien = $TenMien.Trim().ToLower()
if ($TenMien -and $TuKy) { CanhBao 'Da co ten mien: bo qua -TuKy (dung chung chi Let''s Encrypt bang win-acme, xem huong dan).'; $TuKy = $false }

# ------------------------------------------------------------------ 1. IIS
Buoc 'Bat IIS (neu chua co)'
if (Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue) {
  # Windows Server
  Install-WindowsFeature -Name Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Http-Logging,
    Web-Filtering, Web-AppInit, Web-Mgmt-Console | Out-Null
} else {
  # Windows 10 / 11
  Enable-WindowsOptionalFeature -Online -All -NoRestart -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-StaticContent,
    IIS-DefaultDocument, IIS-HttpErrors, IIS-HttpLogging, IIS-RequestFiltering, IIS-ApplicationInit, IIS-ManagementConsole | Out-Null
}
Import-Module WebAdministration
$ApHost = 'MACHINE/WEBROOT/APPHOST'

# ------------------------------------------------------------------ 2. .NET Framework
Buoc 'Kiem tra .NET Framework 4.5+'
$net = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -ErrorAction SilentlyContinue
if (-not $net -or [int]$net.Release -lt 378389) {
  Dung 'Chua co .NET Framework 4.5 tro len (Windows Server 2016+ co san). Cai .NET Framework 4.8: https://dotnet.microsoft.com/download/dotnet-framework/net48 roi chay lai.'
}
Write-Host "    .NET Framework $($net.Version)"

# ------------------------------------------------------------------ 3. module IIS can thiet
Buoc 'Kiem tra module IIS'
function CoMuc([string]$muc) {
  try { return $null -ne (Get-WebConfiguration -PSPath $ApHost -Filter $muc -ErrorAction Stop) } catch { return $false }
}
$thieu = @()
if (-not (CoMuc 'system.webServer/rewrite/rules')) { $thieu += 'URL Rewrite 2.1  : https://www.iis.net/downloads/microsoft/url-rewrite' }
if (-not (CoMuc 'system.webServer/httpPlatform')) { $thieu += 'HttpPlatformHandler 1.2 : https://www.iis.net/downloads/microsoft/httpplatformhandler' }
if ($thieu.Count -gt 0) {
  Write-Host 'Can cai them cac module sau cho IIS (ban x64), roi chay lai script:' -ForegroundColor Red
  $thieu | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

# ------------------------------------------------------------------ 4. dung ban dang chay, chep chuong trinh
$pool = $TenSite
$exeDich = Join-Path $ThuMuc 'QuanLyTaiSan.exe'
if (Test-Path "IIS:\AppPools\$pool") {
  Buoc "Dung app pool $pool (de thay chuong trinh)"
  if ((Get-WebAppPoolState -Name $pool).Value -ne 'Stopped') { try { Stop-WebAppPool -Name $pool } catch { } }
}
# cho QuanLyTaiSan.exe cu luu du lieu va thoat (file khoa trong thu muc du lieu)
for ($i = 0; $i -lt 30; $i++) {
  $con = @(Get-CimInstance Win32_Process -Filter "Name='QuanLyTaiSan.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -eq $exeDich) })
  if ($con.Count -eq 0) { break }
  if ($i -eq 20) { $con | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
  Start-Sleep -Seconds 1
}

Buoc "Chep chuong trinh vao $ThuMuc"
$thuMucLog = Join-Path $ThuMuc 'logs'
New-Item -ItemType Directory -Force -Path $ThuMuc, $ThuMucDuLieu, $thuMucLog | Out-Null
$cungThuMuc = (Resolve-Path $Goc).Path.TrimEnd('\') -eq (Resolve-Path $ThuMuc).Path.TrimEnd('\')
if (-not $BoQuaChepTep -and -not $cungThuMuc) {
  try { Copy-Item $exeGoi $ThuMuc -Force } catch { Dung "Khong chep duoc QuanLyTaiSan.exe vao $ThuMuc`: $($_.Exception.Message)" }
}

# ------------------------------------------------------------------ 5. web.config
Buoc 'Tao web.config (HttpPlatformHandler)'
# HTTPS cua ten mien: co van tay chung chi, hoac site da co binding https cua dung ten mien nay
# (chung chi do win-acme / IIS Manager gan va tu gia han; binding cua ten mien cu khong tinh)
$coHttps = [bool]$VanTayChungChi -and [bool]$TenMien
if (-not $coHttps -and $TenMien -and (Test-Path "IIS:\Sites\$TenSite")) {
  $duoiHttps = ':' + $CongHttps + ':' + [regex]::Escape($TenMien) + '$'
  $coHttps = @(Get-WebBinding -Name $TenSite -Protocol https -ErrorAction SilentlyContinue |
    Where-Object { $_.bindingInformation -match $duoiHttps }).Count -gt 0
}
$noiDung = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'web.config')
$noiDung = $noiDung.Replace('__THU_MUC__', $ThuMuc.TrimEnd('\'))
$noiDung = $noiDung.Replace('__DU_LIEU__', $ThuMucDuLieu.TrimEnd('\'))
$xml = [xml]$noiDung
if ($coHttps) {
  foreach ($r in $xml.configuration.'system.webServer'.rewrite.rules.rule) {
    if ($r.name -eq 'QuanLyTaiSan-HTTPS') { $r.SetAttribute('enabled', 'true') }
  }
}
$xml.Save((Join-Path $ThuMuc 'web.config'))

# URL Rewrite chi cho dat bien may chu da khai bao o muc may chu
$daCo = @(Get-WebConfiguration -PSPath $ApHost -Filter 'system.webServer/rewrite/allowedServerVariables/add' |
  Where-Object { $_.name -eq 'HTTP_X_FORWARDED_FOR' })
if ($daCo.Count -eq 0) {
  Add-WebConfigurationProperty -PSPath $ApHost -Filter 'system.webServer/rewrite/allowedServerVariables' -Name '.' -Value @{ name = 'HTTP_X_FORWARDED_FOR' }
}

# ------------------------------------------------------------------ 6. app pool
Buoc "Tao app pool $pool"
if (-not (Test-Path "IIS:\AppPools\$pool")) { New-WebAppPool -Name $pool | Out-Null }
Set-ItemProperty "IIS:\AppPools\$pool" -Name managedRuntimeVersion -Value ''
Set-ItemProperty "IIS:\AppPools\$pool" -Name startMode -Value 'AlwaysRunning'
Set-ItemProperty "IIS:\AppPools\$pool" -Name processModel.idleTimeout -Value '00:00:00'
# khi IIS khoi dong lai app pool: ban cu thoat han (nha file khoa du lieu) roi ban moi moi chay
Set-ItemProperty "IIS:\AppPools\$pool" -Name recycling.disallowOverlappingRotation -Value $true
# app pool moi tao tu chay: dung lai cho toi khi tao xong tai khoan quan tri (chuong trinh khoa thu muc du lieu khi chay)
if ((Get-WebAppPoolState -Name $pool).Value -ne 'Stopped') { try { Stop-WebAppPool -Name $pool } catch { } }

# ------------------------------------------------------------------ 7. quyen thu muc
Buoc 'Cap quyen thu muc'
$taiKhoan = "IIS AppPool\$pool"
icacls $ThuMuc /grant "${taiKhoan}:(OI)(CI)RX" /T /Q | Out-Null
icacls $thuMucLog /grant "${taiKhoan}:(OI)(CI)M" /T /Q | Out-Null
# du lieu (tai khoan, mat khau da bam, anh tai san): chi quan tri may, SYSTEM va app pool vao duoc
icacls $ThuMucDuLieu /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' "${taiKhoan}:(OI)(CI)M" /Q | Out-Null
if ($LASTEXITCODE -ne 0) { Dung "Khong cap duoc quyen ghi thu muc du lieu $ThuMucDuLieu cho $taiKhoan." }
$global:LASTEXITCODE = 0

# ------------------------------------------------------------------ 8. tai khoan quan tri cua phan mem (lan dau)
& (Join-Path $PSScriptRoot 'tai-khoan-quan-tri.ps1') -TenSite $TenSite -ThuMuc $ThuMuc -ThuMucDuLieu $ThuMucDuLieu -NeuChuaCo -TrongLucCai
if ($LASTEXITCODE -ne 0) { Dung 'Chua tao duoc tai khoan quan tri.' }

# ------------------------------------------------------------------ 9. site va binding
Buoc "Tao site $TenSite"
# goi cai cu co the da cai Quan ly tai san thanh ung dung con (vd. /taisan) cua site khac: go di, chi giu 1 site rieng
foreach ($ud in @(Get-WebApplication -ErrorAction SilentlyContinue | Where-Object { $_.applicationPool -eq $pool -or $_.PhysicalPath -eq $ThuMuc })) {
  $siteCua = if ($ud.ItemXPath -match "@name='([^']+)'") { $Matches[1] } else { '' }
  if ($siteCua -and $siteCua -ne $TenSite -and $ud.path -and $ud.path -ne '/') {
    Remove-WebApplication -Site $siteCua -Name $ud.path.Trim('/')
    CanhBao "Da go ung dung con cu '$siteCua$($ud.path)' (goi cai cu). Dia chi moi xem o bang tom tat ben duoi; tem in theo dia chi cu can in lai."
  }
}
if (Test-Path "IIS:\Sites\$TenSite") {
  Set-ItemProperty "IIS:\Sites\$TenSite" -Name physicalPath -Value $ThuMuc
  Set-ItemProperty "IIS:\Sites\$TenSite" -Name applicationPool -Value $pool
  # chay lai voi ten mien / cong khac: thay binding http cu
  $canCo = "*:${CongHttp}:$TenMien"
  $dsHttp = @(Get-WebBinding -Name $TenSite -Protocol http)
  if (-not ($dsHttp | Where-Object { $_.bindingInformation -eq $canCo })) {
    foreach ($b in $dsHttp) {
      $p = $b.bindingInformation.Split(':')
      Remove-WebBinding -Name $TenSite -Protocol http -Port $p[1] -HostHeader $p[2]
    }
    New-WebBinding -Name $TenSite -Protocol http -Port $CongHttp -HostHeader $TenMien
  }
} else {
  New-Website -Name $TenSite -PhysicalPath $ThuMuc -ApplicationPool $pool -Port $CongHttp -HostHeader $TenMien | Out-Null
}
# khoi dong san QuanLyTaiSan.exe khi IIS khoi dong (Application Initialization)
try { Set-ItemProperty "IIS:\Sites\$TenSite" -Name applicationDefaults.preloadEnabled -Value $true } catch { CanhBao 'Khong bat duoc preloadEnabled: chuong trinh se chay khi co yeu cau dau tien.' }

function GanChungChi([string]$tenMienGan, [string]$vanTay) {
  # binding https cua ten mien cu (doi ten mien): go di, gan lai cho ten mien moi
  foreach ($b in @(Get-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -ErrorAction SilentlyContinue)) {
    if ($b.bindingInformation -ne "*:${CongHttps}:$tenMienGan") {
      try { $b.RemoveSslCertificate() } catch { }
      $p = $b.bindingInformation.Split(':')
      Remove-WebBinding -Name $TenSite -Protocol https -Port $p[1] -HostHeader $p[2]
    }
  }
  if (-not (Get-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -HostHeader $tenMienGan -ErrorAction SilentlyContinue)) {
    $sni = if ($tenMienGan) { 1 } else { 0 }
    New-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -HostHeader $tenMienGan -SslFlags $sni
  }
  $binding = Get-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -HostHeader $tenMienGan
  # chay lai script (gia han / doi chung chi): go chung chi cu roi gan chung chi moi
  try { $binding.RemoveSslCertificate() } catch { }
  $binding.AddSslCertificate($vanTay, 'My')
}

$tenChungChiTuKy = 'Quan ly tai san (IIS)'   # cung ten voi chung chi tu ky cua goi cai cu (dung lai khi cap nhat)
$chungChiTuKy = $null
if ($VanTayChungChi -and $TenMien) {
  $chungChi = Get-Item "Cert:\LocalMachine\My\$VanTayChungChi" -ErrorAction SilentlyContinue
  if (-not $chungChi) { Dung "Khong thay chung chi $VanTayChungChi trong kho Local Computer\Personal." }
  GanChungChi $TenMien $VanTayChungChi
} elseif ($coHttps) {
  Write-Host '    Site da co binding HTTPS (chung chi do cong cu khac quan ly, vd. win-acme): giu nguyen, bat chuyen http -> https.'
} elseif ($TuKy) {
  Buoc "Chung chi tu ky cho HTTPS cong $CongHttps (chua co ten mien)"
  # cong https khong kem ten mien chi gan duoc 1 chung chi: site khac dang dung thi bao loi, khong ghi de
  $khac = @(Get-WebBinding -Protocol https -ErrorAction SilentlyContinue | Where-Object {
      $_.bindingInformation -eq "*:${CongHttps}:" -and $_.ItemXPath -notmatch "@name='$([regex]::Escape($TenSite))'" })
  if ($khac.Count -gt 0) { Dung "Cong $CongHttps (https, khong ten mien) dang dung cho site khac. Chay lai voi -CongHttps 8443 (hoac cong trong khac)." }
  $chungChiTuKy = Get-ChildItem Cert:\LocalMachine\My | Where-Object {
      $_.FriendlyName -eq $tenChungChiTuKy -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(30) } |
    Sort-Object NotAfter -Descending | Select-Object -First 1
  if (-not $chungChiTuKy) {
    $tenDns = @($env:COMPUTERNAME, 'localhost') | Select-Object -Unique
    $chungChiTuKy = New-SelfSignedCertificate -DnsName $tenDns -CertStoreLocation Cert:\LocalMachine\My -NotAfter (Get-Date).AddYears(10) `
      -FriendlyName $tenChungChiTuKy -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy NonExportable
    Write-Host '    Da tao chung chi tu ky 10 nam (trinh duyet canh bao lan dau: bam Nang cao > Tiep tuc).'
  }
  GanChungChi '' $chungChiTuKy.Thumbprint
} else {
  CanhBao 'Chua co HTTPS: tren dien thoai, camera quet QR / GPS chi chay qua HTTPS. Xin chung chi mien phi bang win-acme (xem huong dan) roi chay lai script nay.'
}

# ------------------------------------------------------------------ 10. tuong lua
Buoc 'Mo cong tren tuong lua'
$dsCong = @($CongHttp)
if ($coHttps -or $TuKy) { $dsCong += $CongHttps }
foreach ($cong in $dsCong) {
  if (-not (Get-NetFirewallRule -DisplayName "QuanLyTaiSan TCP $cong" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "QuanLyTaiSan TCP $cong" -Direction Inbound -Protocol TCP -LocalPort $cong -Action Allow | Out-Null
  }
}

# ------------------------------------------------------------------ 11. khoi dong va kiem tra
Buoc 'Khoi dong site'
Start-WebAppPool -Name $pool -ErrorAction SilentlyContinue
Start-Website -Name $TenSite -ErrorAction SilentlyContinue
if ((Get-Website -Name $TenSite).State -ne 'Started') {
  CanhBao "Site $TenSite chua chay duoc: cong $CongHttp co the dang bi site khac dung (vd. 'Default Web Site', HawaMap). Dung site do, hoac chay lai voi -TenMien / -CongHttp khac."
}

# goi /api/trang-thai qua IIS (dung ten mien trong header Host de khop binding; https thi gui SNI)
function GoiThu([int]$cong, [string]$may, [bool]$ssl) {
  try {
    $tcp = New-Object Net.Sockets.TcpClient('127.0.0.1', $cong)
    $luong = $tcp.GetStream()
    if ($ssl) {
      $luong = New-Object Net.Security.SslStream($luong, $false, { $true })
      $luong.AuthenticateAsClient($(if ($may) { $may } else { 'localhost' }))
    }
    $luong.ReadTimeout = 30000
    $yc = [Text.Encoding]::ASCII.GetBytes("GET /api/trang-thai HTTP/1.1`r`nHost: $(if ($may) { $may } else { 'localhost' })`r`nConnection: close`r`n`r`n")
    $luong.Write($yc, 0, $yc.Length)
    $luong.Flush()
    $text = (New-Object IO.StreamReader($luong, [Text.Encoding]::UTF8)).ReadToEnd()
    $tcp.Close()
    return $text
  } catch { return '' }
}
$https = $coHttps -or $TuKy
$congThu = if ($https) { $CongHttps } else { $CongHttp }
$ok = $false
for ($i = 0; $i -lt 15 -and -not $ok; $i++) {
  Start-Sleep -Seconds 2
  $tl = GoiThu $congThu $TenMien $https
  $ok = $tl -match '"ok":true' -and $tl -match 'QuanLyTaiSan'
}
if ($ok) { Write-Host "    May chu tra loi: /api/trang-thai" -ForegroundColor Green }
else { CanhBao "Chua goi duoc /api/trang-thai. Xem nhat ky trong $thuMucLog, $ThuMucDuLieu\NhatKy, $ThuMucDuLieu\loi-khoi-dong.txt va Event Viewer > Windows Logs > Application." }

function HauToCong([int]$c, [int]$macDinh) { if ($c -eq $macDinh) { return '' } return ":$c" }
$may = if ($TenMien) { $TenMien } else { '<IP may chu>' }
$diaChi = "http://$may$(HauToCong $CongHttp 80)"
$diaChiHttps = "https://$may$(HauToCong $CongHttps 443)"
Write-Host ''
Write-Host 'Xong.' -ForegroundColor Green
if ($https) {
  Write-Host "  Trang web      : $diaChiHttps$(if ($TuKy) { '  (chung chi tu ky: trinh duyet canh bao lan dau)' })"
} else {
  Write-Host "  Trang web      : $diaChi  (HTTPS: $diaChiHttps - chua bat)"
}
Write-Host "  Du lieu        : $ThuMucDuLieu  (taisan.xml, LichSu, Anh, taikhoan.xml; tu sao luu taisan.xml moi ngay trong SaoLuu)"
Write-Host "  Nhat ky        : $thuMucLog , $ThuMucDuLieu\NhatKy"
if ($chungChiTuKy) {
  $sha = [Security.Cryptography.SHA256]::Create().ComputeHash($chungChiTuKy.GetRawCertData())
  $h = ([BitConverter]::ToString($sha) -replace '-', '')
  Write-Host "  Ma nhan dang chung chi tu ky: $($h.Substring(0,4))-$($h.Substring(4,4))-$($h.Substring(8,4))-$($h.Substring(12,4))"
}
