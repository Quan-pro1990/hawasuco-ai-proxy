<#
.SYNOPSIS
  Cai HawaMap (trang web + may chu Node) len IIS tren Windows Server 2016 tro len / Windows 10, 11.

.DESCRIPTION
  - Bat IIS (neu chua co), kiem tra Node.js 18+, URL Rewrite, HttpPlatformHandler (hoac ARR).
  - Chep ung dung vao thu muc site, tao web.config, app pool "No Managed Code", cap quyen thu muc.
  - Tao site, gan binding HTTP (va HTTPS neu co van tay chung chi), mo tuong lua.
  - Site da co binding HTTPS cho ten mien (vd. do win-acme gan chung chi Let's Encrypt): bat chuyen http -> https, mo cong 443.
  - Che do HttpPlatform (mac dinh): IIS tu chay va giam sat node server.js.
    Che do Proxy: node chay nen bang Task Scheduler (tai khoan NETWORK SERVICE) tai 127.0.0.1:<CongNode>,
    IIS chuyen tiep bang URL Rewrite + ARR.
  Chay lai script de cap nhat phien ban moi (du lieu trong -ThuMucDuLieu duoc giu nguyen).
  Nguoi moi: nhap dup CAI-DAT-MAY-CHU.bat (goi cai-dat-nhanh.ps1: hoi tung buoc roi goi script nay).

.EXAMPLE
  # chay trong PowerShell "Run as administrator", tu thu muc ung dung:
  powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\cai-dat-iis.ps1 -TenMien bando.congty.vn

.EXAMPLE
  # co chung chi HTTPS da nhap vao kho "Local Computer\Personal" (lay van tay trong IIS > Server Certificates):
  .\trien-khai\iis\cai-dat-iis.ps1 -TenMien bando.congty.vn -VanTayChungChi 3A1B...F9

.EXAMPLE
  # dung reverse proxy (URL Rewrite + ARR) thay cho HttpPlatformHandler:
  .\trien-khai\iis\cai-dat-iis.ps1 -CheDo Proxy -CongNode 8080
#>
[CmdletBinding()]
param(
  [string]$TenSite = 'HawaMap',
  [string]$ThuMuc = 'C:\inetpub\hawamap',
  [string]$ThuMucDuLieu = 'C:\HawaMapData',
  [string]$TenMien = '',
  [int]$CongHttp = 80,
  [int]$CongHttps = 443,
  [string]$VanTayChungChi = '',
  [ValidateSet('HttpPlatform', 'Proxy')]
  [string]$CheDo = 'HttpPlatform',
  [int]$CongNode = 8080,
  [switch]$BoQuaChepTep
)

$ErrorActionPreference = 'Stop'

function Buoc([string]$s) { Write-Host "==> $s" -ForegroundColor Cyan }
function CanhBao([string]$s) { Write-Host "[CANH BAO] $s" -ForegroundColor Yellow }
function Dung([string]$s) { Write-Host "[LOI] $s" -ForegroundColor Red; exit 1 }

# ------------------------------------------------------------------ 0. quyen quan tri, thu muc ung dung
$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Hay mo PowerShell bang quyen Administrator (chuot phai > Run as administrator).' }

# script nam o <ung dung>\trien-khai\iis
$Goc = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $Goc 'server.js'))) { Dung "Khong thay server.js trong $Goc" }
$VanTayChungChi = ($VanTayChungChi -replace '[^0-9A-Fa-f]', '').ToUpper()

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

# ------------------------------------------------------------------ 2. Node.js
Buoc 'Kiem tra Node.js'
$lenhNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $lenhNode) { Dung 'Chua cai Node.js 18 tro len. Tai ban LTS cho Windows x64 tai https://nodejs.org roi chay lai script.' }
$duongNode = $lenhNode.Source
$phienBan = (& $duongNode --version).Trim().TrimStart('v')
if ([int]($phienBan.Split('.')[0]) -lt 18) { Dung "Node.js $phienBan qua cu, can ban 18 tro len." }
if ($duongNode -like "$env:SystemDrive\Users\*") {
  CanhBao "Node.js dang nam trong thu muc nguoi dung ($duongNode): tai khoan cua IIS co the khong doc duoc. Nen cai Node.js cho moi nguoi dung (C:\Program Files\nodejs)."
}
Write-Host "    Node.js $phienBan : $duongNode"

# ------------------------------------------------------------------ 3. module IIS can thiet
Buoc 'Kiem tra module IIS'
function CoMuc([string]$muc) {
  try { return $null -ne (Get-WebConfiguration -PSPath $ApHost -Filter $muc -ErrorAction Stop) } catch { return $false }
}
$thieu = @()
if (-not (CoMuc 'system.webServer/rewrite/rules')) { $thieu += 'URL Rewrite 2.1  : https://www.iis.net/downloads/microsoft/url-rewrite' }
if ($CheDo -eq 'HttpPlatform' -and -not (CoMuc 'system.webServer/httpPlatform')) {
  $thieu += 'HttpPlatformHandler 1.2 : https://www.iis.net/downloads/microsoft/httpplatformhandler'
}
if ($CheDo -eq 'Proxy' -and -not (CoMuc 'system.webServer/proxy')) {
  $thieu += 'Application Request Routing 3.0 : https://www.iis.net/downloads/microsoft/application-request-routing'
}
if ($thieu.Count -gt 0) {
  Write-Host 'Can cai them cac module sau cho IIS (ban x64), roi chay lai script:' -ForegroundColor Red
  $thieu | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

# ------------------------------------------------------------------ 4. chep ung dung
Buoc "Chep ung dung vao $ThuMuc"
$thuMucLog = Join-Path $ThuMuc 'logs'
New-Item -ItemType Directory -Force -Path $ThuMuc, $ThuMucDuLieu, $thuMucLog | Out-Null
$cungThuMuc = (Resolve-Path $Goc).Path.TrimEnd('\') -eq (Resolve-Path $ThuMuc).Path.TrimEnd('\')
if (-not $BoQuaChepTep -and -not $cungThuMuc) {
  foreach ($tep in 'server.js', 'kho-giao-thong.js', 'package.json') { Copy-Item (Join-Path $Goc $tep) $ThuMuc -Force }
  robocopy (Join-Path $Goc 'public') (Join-Path $ThuMuc 'public') /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { Dung 'Chep thu muc public that bai.' }
  $global:LASTEXITCODE = 0
}

# ------------------------------------------------------------------ 5. web.config
Buoc "Tao web.config (che do $CheDo)"
# HTTPS: co van tay chung chi, hoac site da co binding https cua dung ten mien nay
# (chung chi do win-acme / IIS Manager gan va tu gia han; binding cua ten mien cu khong tinh)
$coHttps = [bool]$VanTayChungChi
if (-not $coHttps -and (Test-Path "IIS:\Sites\$TenSite")) {
  $duoiHttps = ':' + $CongHttps + ':' + [regex]::Escape($TenMien) + '$'
  $coHttps = @(Get-WebBinding -Name $TenSite -Protocol https -ErrorAction SilentlyContinue |
    Where-Object { $_.bindingInformation -match $duoiHttps }).Count -gt 0
}
$tenMau = if ($CheDo -eq 'HttpPlatform') { 'web.config' } else { 'web.config.proxy' }
$noiDung = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot $tenMau)
$noiDung = $noiDung.Replace('__NODE__', $duongNode)
$noiDung = $noiDung.Replace('__THU_MUC__', $ThuMuc.TrimEnd('\'))
$noiDung = $noiDung.Replace('__DU_LIEU__', $ThuMucDuLieu.TrimEnd('\'))
$noiDung = $noiDung.Replace('__CONG_NODE__', [string]$CongNode)
$xml = [xml]$noiDung
if ($coHttps) {
  foreach ($r in $xml.configuration.'system.webServer'.rewrite.rules.rule) {
    if ($r.name -eq 'HawaMap-HTTPS') { $r.SetAttribute('enabled', 'true') }
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
Buoc "Tao app pool $TenSite"
$pool = $TenSite
if (-not (Test-Path "IIS:\AppPools\$pool")) { New-WebAppPool -Name $pool | Out-Null }
Set-ItemProperty "IIS:\AppPools\$pool" -Name managedRuntimeVersion -Value ''
Set-ItemProperty "IIS:\AppPools\$pool" -Name startMode -Value 'AlwaysRunning'
# khong tat tien trinh khi vang khach: may chu Node con tu cap nhat du lieu giao thong moi tuan
Set-ItemProperty "IIS:\AppPools\$pool" -Name processModel.idleTimeout -Value '00:00:00'

# ------------------------------------------------------------------ 7. quyen thu muc
Buoc 'Cap quyen thu muc'
$taiKhoan = "IIS AppPool\$pool"
icacls $ThuMuc /grant "${taiKhoan}:(OI)(CI)RX" /T /Q | Out-Null
icacls $ThuMucDuLieu /grant "${taiKhoan}:(OI)(CI)M" /T /Q | Out-Null
icacls $thuMucLog /grant "${taiKhoan}:(OI)(CI)M" /T /Q | Out-Null

# ------------------------------------------------------------------ 8. che do Proxy: node chay nen, ARR chuyen tiep
if ($CheDo -eq 'Proxy') {
  Buoc "Chay Node nen tai 127.0.0.1:$CongNode (Task Scheduler) va bat proxy cua ARR"
  Set-WebConfigurationProperty -PSPath $ApHost -Filter 'system.webServer/proxy' -Name 'enabled' -Value 'True'
  # tai du lieu giao thong lan dau co the mat toi 1-2 phut
  Set-WebConfigurationProperty -PSPath $ApHost -Filter 'system.webServer/proxy' -Name 'timeout' -Value '00:03:00'
  Set-WebConfigurationProperty -PSPath $ApHost -Filter 'system.webServer/proxy' -Name 'reverseRewriteHostInResponseHeaders' -Value 'False'

  $mayChu = 'NT AUTHORITY\NETWORK SERVICE'
  icacls $ThuMuc /grant "${mayChu}:(OI)(CI)RX" /T /Q | Out-Null
  icacls $ThuMucDuLieu /grant "${mayChu}:(OI)(CI)M" /T /Q | Out-Null
  icacls $thuMucLog /grant "${mayChu}:(OI)(CI)M" /T /Q | Out-Null
  $tepChay = Join-Path $ThuMuc 'chay-hawamap.cmd'
  @(
    '@echo off',
    "set PORT=$CongNode",
    'set HOST=127.0.0.1',
    "set BANDO_DULIEU=$ThuMucDuLieu",
    'set NODE_ENV=production',
    "`"$duongNode`" `"$(Join-Path $ThuMuc 'server.js')`" >> `"$(Join-Path $thuMucLog 'node.log')`" 2>&1"
  ) | Set-Content -Path $tepChay -Encoding ASCII

  $tenTac = "$TenSite Node"
  Stop-ScheduledTask -TaskName $tenTac -ErrorAction SilentlyContinue
  # dung ca tien trinh node cu (cap nhat phien ban moi): dung tac vu chi dung cmd.exe
  $tepServer = Join-Path $ThuMuc 'server.js'
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*$tepServer*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $hanhDong = New-ScheduledTaskAction -Execute "$env:windir\System32\cmd.exe" -Argument "/c `"$tepChay`"" -WorkingDirectory $ThuMuc
  $kichHoat = New-ScheduledTaskTrigger -AtStartup
  $nguoiChay = New-ScheduledTaskPrincipal -UserId $mayChu -LogonType ServiceAccount
  $tuyChon = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $tenTac -Action $hanhDong -Trigger $kichHoat -Principal $nguoiChay -Settings $tuyChon -Force | Out-Null
  Start-ScheduledTask -TaskName $tenTac
}

# ------------------------------------------------------------------ 9. site va binding
Buoc "Tao site $TenSite"
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
# khoi dong san Node khi IIS khoi dong (Application Initialization)
try { Set-ItemProperty "IIS:\Sites\$TenSite" -Name applicationDefaults.preloadEnabled -Value $true } catch { CanhBao 'Khong bat duoc preloadEnabled (thieu Application Initialization): Node se chay khi co yeu cau dau tien.' }

if ($VanTayChungChi) {
  $chungChi = Get-Item "Cert:\LocalMachine\My\$VanTayChungChi" -ErrorAction SilentlyContinue
  if (-not $chungChi) { Dung "Khong thay chung chi $VanTayChungChi trong kho Local Computer\Personal." }
  # binding https cua ten mien cu (doi ten mien): go di, gan lai cho ten mien moi
  foreach ($b in @(Get-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -ErrorAction SilentlyContinue)) {
    if ($b.bindingInformation -ne "*:${CongHttps}:$TenMien") {
      try { $b.RemoveSslCertificate() } catch { }
      $p = $b.bindingInformation.Split(':')
      Remove-WebBinding -Name $TenSite -Protocol https -Port $p[1] -HostHeader $p[2]
    }
  }
  if (-not (Get-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -HostHeader $TenMien -ErrorAction SilentlyContinue)) {
    $sni = if ($TenMien) { 1 } else { 0 }
    New-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -HostHeader $TenMien -SslFlags $sni
  }
  $binding = Get-WebBinding -Name $TenSite -Protocol https -Port $CongHttps -HostHeader $TenMien
  # chay lai script (gia han / doi chung chi): go chung chi cu roi gan chung chi moi
  try { $binding.RemoveSslCertificate() } catch { }
  $binding.AddSslCertificate($VanTayChungChi, 'My')
} elseif ($coHttps) {
  Write-Host '    Site da co binding HTTPS (chung chi do cong cu khac quan ly, vd. win-acme): giu nguyen, bat chuyen http -> https.'
} else {
  CanhBao 'Chua co HTTPS: tren dien thoai, GPS / micro / camera chi chay qua HTTPS. Xin chung chi mien phi bang win-acme (xem trien-khai\HUONG_DAN_MAY_CHU.md) roi chay lai script nay.'
}

# ------------------------------------------------------------------ 10. tuong lua
Buoc 'Mo cong tren tuong lua'
$dsCong = @($CongHttp)
if ($coHttps) { $dsCong += $CongHttps }
foreach ($cong in $dsCong) {
  if (-not (Get-NetFirewallRule -DisplayName "HawaMap TCP $cong" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "HawaMap TCP $cong" -Direction Inbound -Protocol TCP -LocalPort $cong -Action Allow | Out-Null
  }
}

# ------------------------------------------------------------------ 11. khoi dong va kiem tra
Buoc 'Khoi dong site'
Restart-WebAppPool -Name $pool -ErrorAction SilentlyContinue
Start-Website -Name $TenSite -ErrorAction SilentlyContinue
if ((Get-Website -Name $TenSite).State -ne 'Started') {
  CanhBao "Site $TenSite chua chay duoc: cong $CongHttp co the dang bi site khac dung (vd. 'Default Web Site'). Dung site do hoac chay lai voi -TenMien."
}

$diaChi = if ($TenMien) { "http://$TenMien" } else { "http://localhost:$CongHttp" }
if (-not $TenMien) {
  $ok = $false
  for ($i = 0; $i -lt 10 -and -not $ok; $i++) {
    Start-Sleep -Seconds 2
    try { $kq = Invoke-RestMethod -Uri "$diaChi/api/trang-thai" -TimeoutSec 10; $ok = [bool]$kq.ok } catch { }
  }
  if ($ok) { Write-Host "    May chu tra loi: $diaChi/api/trang-thai" -ForegroundColor Green }
  else { CanhBao "Chua goi duoc $diaChi/api/trang-thai. Xem nhat ky trong $thuMucLog va Event Viewer > Windows Logs > Application." }
}

Write-Host ''
Write-Host 'Xong.' -ForegroundColor Green
Write-Host "  Trang web      : $diaChi  (HTTPS: https://$(if ($TenMien) { $TenMien } else { '<ten-mien>' })$(if (-not $coHttps) { ' - chua bat' }))"
Write-Host "  Du lieu        : $ThuMucDuLieu  (bao cao, du lieu giao thong, phi-cao-toc.json)"
Write-Host "  Nhat ky Node   : $thuMucLog"
Write-Host '  Ung dung Android / iPhone: dat dia chi may chu bao cao la  https://<ten-mien>/api'
