<#
.SYNOPSIS
  Cai dat may chu Quan ly tai san theo kieu hoi - dap, danh cho nguoi moi (giong trinh cai may chu HawaMap).
  Nhap dup CAI-DAT-MAY-CHU.bat de chay.

.DESCRIPTION
  1. Bat IIS.
  2. Kiem tra .NET Framework 4.5+ (co san trong Windows Server 2016 tro len).
  3. Kiem tra URL Rewrite va HttpPlatformHandler (mo trang tai ve, cho cai xong roi kiem tra lai).
  4. Hoi ten mien (chua co ten mien: cong http va chung chi tu ky de dien thoai van quet QR qua https).
     Cau tra loi duoc nho trong <ThuMucDuLieu>\cai-dat-may-chu.json cho lan chay sau.
  5. Goi cai-dat-iis.ps1 de dung site (lan dau hoi tai khoan quan tri cua phan mem).
  6. De nghi dat lich sao luu du lieu moi ngay.
  Chay lai de cap nhat phien ban moi hoac bat HTTPS sau khi co chung chi: nhan Enter o moi cau hoi.
  Huong dan day du: trien-khai\HUONG_DAN_MAY_CHU.md (hoac HUONG-DAN-CAI-DAT.html trong goi cai dat).
#>
[CmdletBinding()]
param(
  [string]$ThuMuc = 'C:\inetpub\QuanLyTaiSan',
  [string]$ThuMucDuLieu = 'C:\QuanLyTaiSanData'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { $Host.UI.RawUI.WindowTitle = 'Cai dat may chu Quan ly tai san' } catch { }
$TenSite = 'QuanLyTaiSan'

function TieuDe([string]$s) { Write-Host ''; Write-Host "=== $s ===" -ForegroundColor Cyan }
function Tot([string]$s) { Write-Host "  [OK] $s" -ForegroundColor Green }
function ChuY([string]$s) { Write-Host "  [CHU Y] $s" -ForegroundColor Yellow }
function Loi([string]$s) { Write-Host "  [LOI] $s" -ForegroundColor Red }

function Hoi([string]$cau, [string]$macDinh = '') {
  $goiY = if ($macDinh) { " [$macDinh]" } else { '' }
  $tl = Read-Host "  $cau$goiY"
  if ([string]::IsNullOrWhiteSpace($tl)) { return $macDinh }
  return $tl.Trim()
}

function DongY([string]$cau, [bool]$macDinh = $true) {
  $goiY = if ($macDinh) { 'C/k' } else { 'c/K' }
  while ($true) {
    $tl = Read-Host "  $cau ($goiY)"
    if ([string]::IsNullOrWhiteSpace($tl)) { return $macDinh }
    if ($tl.Trim() -match '^(c|co|y|yes)$') { return $true }
    if ($tl.Trim() -match '^(k|khong|n|no)$') { return $false }
  }
}

function MoTrang([string]$url) { try { Start-Process $url } catch { } }

# ------------------------------------------------------------------ quyen quan tri
$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) {
  Loi 'Can quyen Administrator: nhap dup CAI-DAT-MAY-CHU.bat va chon Yes, hoac chuot phai > Run as administrator.'
  exit 1
}

Write-Host ''
Write-Host '  CAI DAT MAY CHU PHAN MEM QUAN LY TAI SAN (quet tem QR xem thong tin, anh tai san)' -ForegroundColor White
Write-Host '  Gom cac buoc: bat IIS, kiem tra .NET Framework, kiem tra 2 module cua IIS, hoi ten mien - roi dung trang web.'
Write-Host '  Cau hoi co gia tri trong [ngoac vuong]: nhan Enter de dung gia tri do.'

# da cai truoc day: lay thu muc du lieu dang dung (web.config cua site), ke ca site cai bang goi cu (CaiDat-IIS.bat)
if (-not $PSBoundParameters.ContainsKey('ThuMucDuLieu')) {
  $wc = Join-Path $ThuMuc 'web.config'
  if (Test-Path $wc) {
    try {
      $n = ([xml](Get-Content -Raw $wc)).SelectSingleNode("//environmentVariable[@name='QLTS_DULIEU']")
      if ($n -and $n.GetAttribute('value') -and $n.GetAttribute('value') -notmatch '__') { $ThuMucDuLieu = $n.GetAttribute('value') }
    } catch { }
  }
}
$tepCaiDat = Join-Path $ThuMucDuLieu 'cai-dat-may-chu.json'
$cu = $null
if (Test-Path $tepCaiDat) { try { $cu = Get-Content -Raw $tepCaiDat | ConvertFrom-Json } catch { } }
if ($cu) {
  $tenCu = if ($cu.TenMien) { $cu.TenMien } else { 'khong co' }
  Write-Host "  May nay da cai Quan ly tai san (ten mien: $tenCu). Lan nay se cap nhat phien ban moi; du lieu trong $ThuMucDuLieu duoc giu nguyen."
} elseif (Test-Path (Join-Path $ThuMucDuLieu 'taisan.xml')) {
  Write-Host "  Da co du lieu Quan ly tai san trong $ThuMucDuLieu (ban cai truoc): duoc giu nguyen."
}

# ------------------------------------------------------------------ 1. IIS
TieuDe 'Buoc 1/5: Bat IIS (may chu web cua Windows)'
Write-Host '  Dang bat IIS, lan dau co the mat vai phut...'
if (Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue) {
  # Windows Server
  $kq = Install-WindowsFeature -Name Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Http-Logging,
    Web-Filtering, Web-AppInit, Web-Mgmt-Console
  $canKhoiDongLai = "$($kq.RestartNeeded)" -eq 'Yes'
} else {
  # Windows 10 / 11
  $kq = Enable-WindowsOptionalFeature -Online -All -NoRestart -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-StaticContent,
    IIS-DefaultDocument, IIS-HttpErrors, IIS-HttpLogging, IIS-RequestFiltering, IIS-ApplicationInit, IIS-ManagementConsole
  $canKhoiDongLai = [bool]$kq.RestartNeeded
}
if ($canKhoiDongLai) {
  ChuY 'Windows can khoi dong lai de bat xong IIS. Khoi dong lai may chu roi nhap dup CAI-DAT-MAY-CHU.bat lan nua.'
  exit 1
}
Import-Module WebAdministration
Tot 'IIS da bat'

# ------------------------------------------------------------------ 2. .NET Framework
TieuDe 'Buoc 2/5: .NET Framework (chuong trinh QuanLyTaiSan.exe chay tren nen nay)'
function PhienBanNet {
  $k = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -ErrorAction SilentlyContinue
  if ($k -and [int]$k.Release -ge 378389) { return $k.Version }
  return $null
}
$v = PhienBanNet
while (-not $v) {
  ChuY 'May chua co .NET Framework 4.5 tro len (Windows Server 2012 R2 tro ve truoc).'
  Write-Host '  Tai ".NET Framework 4.8 Runtime" (offline installer), chay file vua tai, khoi dong lai may neu duoc hoi.'
  MoTrang 'https://dotnet.microsoft.com/download/dotnet-framework/net48'
  [void](Read-Host '  Cai xong nhan Enter de kiem tra lai')
  $v = PhienBanNet
}
Tot ".NET Framework $v"

# ------------------------------------------------------------------ 3. module IIS
TieuDe 'Buoc 3/5: Module cua IIS'

function CoModule([string]$ten) {
  # doc thang applicationHost.config moi lan (module vua cai xong thi thay ngay)
  $tep = Join-Path $env:windir 'System32\inetsrv\config\applicationHost.config'
  try { $x = [xml](Get-Content -Raw $tep) } catch { return $false }
  return @($x.configuration.'system.webServer'.globalModules.add | Where-Object { $_.name -eq $ten }).Count -gt 0
}

$dsModule = @(
  @{ Ten = 'URL Rewrite 2.1'; Module = 'RewriteModule'; Trang = 'https://www.iis.net/downloads/microsoft/url-rewrite' },
  @{ Ten = 'HttpPlatformHandler 1.2'; Module = 'httpPlatformHandler'; Trang = 'https://www.iis.net/downloads/microsoft/httpplatformhandler' }
)
foreach ($m in $dsModule) {
  while (-not (CoModule $m.Module)) {
    ChuY "Chua cai $($m.Ten)."
    Write-Host "  Dang mo trang tai ve: $($m.Trang)"
    Write-Host '  Chon ban x64 (tieng Anh - English), chay file .msi, dong y dieu khoan va bam Install.'
    Write-Host '  Trinh duyet tren Windows Server chan trang: tai tren may cua ban roi chep sang may chu.'
    MoTrang $m.Trang
    [void](Read-Host '  Cai xong nhan Enter de kiem tra lai')
  }
  Tot "$($m.Ten) (may da cai HawaMap thi co san)"
}

# ------------------------------------------------------------------ 4. ten mien
TieuDe 'Buoc 4/5: Ten mien'
Write-Host '  Ten mien la dia chi nguoi dung go vao trinh duyet, vd. taisan.congty.vn. Phai tao ban ghi A cua ten mien'
Write-Host '  tro ve IP cong khai cua may chu nay truoc (xem huong dan). Can ten mien de bat HTTPS that - dien thoai chi cho'
Write-Host '  dung camera quet QR qua HTTPS.  Chua co ten mien: de trong va nhan Enter.'
Write-Host '  May nay da co HawaMap: dung ten mien khac cho Quan ly tai san (vd. bando.congty.vn va taisan.congty.vn).'
if ($cu -and $cu.TenMien) { Write-Host '  Muon bo ten mien da nhap lan truoc: go dau -' }
$macDinh = if ($cu) { [string]$cu.TenMien } else { '' }
while ($true) {
  $TenMien = (Hoi 'Ten mien' $macDinh).ToLower() -replace '^https?://', '' -replace '/.*$', ''
  if ($TenMien -eq '-') { $TenMien = '' }
  if ($TenMien -eq '' -or $TenMien -match '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') { break }
  Loi 'Ten mien khong hop le: chi gom chu khong dau, so, dau "-" va dau "." (vd. taisan.congty.vn).'
}

# cong dang bi site khac / chuong trinh khac dung (bo qua site Quan ly tai san va site vua dung de nhuong cong)
$siteNhuong = @()
function TenSiteCua($b) { if ($b.ItemXPath -match "@name='([^']+)'") { return $Matches[1] } return '?' }
function CongBan([int]$cong, [string]$giaoThuc) {
  foreach ($b in @(Get-WebBinding -ErrorAction SilentlyContinue)) {
    $ten = TenSiteCua $b
    if ($ten -eq $TenSite -or $siteNhuong -contains $ten) { continue }
    $p = "$($b.bindingInformation)".Split(':')
    if ($p.Count -lt 3 -or $p[1] -ne "$cong") { continue }
    if ($b.protocol -ne $giaoThuc) { return "site '$ten' ($($b.protocol))" }   # http va https khong dung chung 1 cong
    if ($p[2] -eq '') { return "site '$ten'" }                                   # cung giao thuc, khong kem ten mien
  }
  # chuong trinh khac (khong phai IIS / http.sys - tien trinh 4) dang nghe cong nay
  $nghe = @(Get-NetTCPConnection -LocalPort $cong -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 4 })
  if ($nghe.Count) {
    $pr = Get-Process -Id $nghe[0].OwningProcess -ErrorAction SilentlyContinue
    return "chuong trinh '$(if ($pr) { $pr.ProcessName } else { $nghe[0].OwningProcess })'"
  }
  return $null
}
function CongHopLe([string]$c) { return $c -match '^\d{2,5}$' -and [int]$c -ge 1 -and [int]$c -le 65535 }

$CongHttp = 80
$CongHttps = 443
$TuKy = $false
$ipMay = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | ForEach-Object { $_.IPAddress })
if ($TenMien) {
  try {
    $ipTen = @(Resolve-DnsName -Name $TenMien -Type A -DnsOnly -ErrorAction Stop | Where-Object { $_.Type -eq 'A' } | ForEach-Object { $_.IPAddress })
  } catch { $ipTen = @() }
  if ($ipTen.Count -eq 0) {
    ChuY "$TenMien chua tro ve dau ca (chua tao ban ghi A, hoac vua tao nen chua co hieu luc - doi 5 - 30 phut)."
    ChuY 'Van cai tiep duoc; vao bang ten mien se chay khi ban ghi A co hieu luc.'
  } elseif (@($ipTen | Where-Object { $ipMay -contains $_ }).Count) {
    Tot "$TenMien tro ve may nay ($($ipTen -join ', '))"
  } else {
    Write-Host "  $TenMien dang tro ve: $($ipTen -join ', ').  IP tren card mang cua may nay: $($ipMay -join ', ')."
    Write-Host '  May chu thue tren cloud thuong co IP cong khai khac IP tren card mang: kiem tra IP cong khai trong trang'
    Write-Host '  quan ly may chu cua nha cung cap. Neu IP cong khai khac IP o tren, sua lai ban ghi A.'
  }
  $trung = @(Get-WebBinding -Protocol http -ErrorAction SilentlyContinue | Where-Object {
      $_.bindingInformation -eq "*:80:$TenMien" -and (TenSiteCua $_) -ne $TenSite })
  if ($trung.Count) { Loi "Ten mien $TenMien dang gan cho site '$(TenSiteCua $trung[0])'. Dung ten mien khac cho Quan ly tai san."; exit 1 }
} else {
  # khong co ten mien: site can 1 cong http khong kem ten mien
  $macDinhCong = if ($cu -and $cu.CongHttp) { [int]$cu.CongHttp } else { 80 }
  $chiem = CongBan $macDinhCong 'http'
  if ($chiem -eq "site 'Default Web Site'") {
    ChuY "Site mac dinh cua IIS (""Default Web Site"") dang dung cong $macDinhCong."
    if (DongY "Dung site ""Default Web Site"" de nhuong cong $macDinhCong cho Quan ly tai san?") {
      Stop-Website -Name 'Default Web Site'
      Set-ItemProperty 'IIS:\Sites\Default Web Site' -Name serverAutoStart -Value $false
      $siteNhuong += 'Default Web Site'
      Tot 'Da dung "Default Web Site"'
      $chiem = CongBan $macDinhCong 'http'
    }
  }
  if ($chiem) {
    ChuY "Cong $macDinhCong dang dung cho $chiem (vd. HawaMap chua co ten mien, That thoat nuoc cong 8080)."
    $macDinhCong = 8080
    while (CongBan $macDinhCong 'http') { $macDinhCong++ }
  }
  while ($true) {
    $c = Hoi 'Cong http cho Quan ly tai san' ([string]$macDinhCong)
    $ban = if (CongHopLe $c) { CongBan ([int]$c) 'http' } else { 'so cong khong hop le' }
    if (-not $ban) { $CongHttp = [int]$c; break }
    Loi "Khong dung duoc cong $c`: $ban."
  }

  # HTTPS khong co ten mien: chung chi tu ky (trinh duyet canh bao lan dau, bam Nang cao > Tiep tuc)
  Write-Host ''
  Write-Host '  Chua co ten mien thi chua xin duoc chung chi HTTPS that. Dien thoai chi mo camera quet QR trong trang qua HTTPS:'
  Write-Host '  co the dung chung chi tu ky (trinh duyet canh bao lan dau, bam "Nang cao" > "Tiep tuc").'
  $tuKyCu = if ($cu -and $null -ne $cu.TuKy) { [bool]$cu.TuKy } else { $true }
  $TuKy = DongY 'Tao chung chi tu ky de dung https://<IP may chu>?' $tuKyCu
  if ($TuKy) {
    # cong https cua lan cai truoc (ke ca goi cu dung https cong 8080) neu co
    $macDinhHttps = if ($cu -and $cu.CongHttps) { [int]$cu.CongHttps } else { 443 }
    if (-not $cu -and (Test-Path "IIS:\Sites\$TenSite")) {
      $b = @(Get-WebBinding -Name $TenSite -Protocol https -ErrorAction SilentlyContinue | Where-Object { $_.bindingInformation -match '^\*:\d+:$' })
      if ($b.Count) { $macDinhHttps = [int]$b[0].bindingInformation.Split(':')[1] }
    }
    while ((CongBan $macDinhHttps 'https') -or $macDinhHttps -eq $CongHttp) {
      $macDinhHttps = if ($macDinhHttps -eq 443) { 8443 } else { $macDinhHttps + 1 }
    }
    while ($true) {
      $c = Hoi 'Cong https' ([string]$macDinhHttps)
      $ban = if (-not (CongHopLe $c)) { 'so cong khong hop le' } elseif ([int]$c -eq $CongHttp) { 'trung cong http' } else { CongBan ([int]$c) 'https' }
      if (-not $ban) { $CongHttps = [int]$c; break }
      Loi "Khong dung duoc cong $c`: $ban."
    }
  }
}

New-Item -ItemType Directory -Force -Path $ThuMucDuLieu | Out-Null
@{ TenMien = $TenMien; CongHttp = $CongHttp; CongHttps = $CongHttps; TuKy = $TuKy; ThuMucDuLieu = $ThuMucDuLieu
   LanCaiCuoi = (Get-Date).ToString('yyyy-MM-dd HH:mm') } | ConvertTo-Json | Set-Content -Path $tepCaiDat -Encoding ASCII

# ------------------------------------------------------------------ dung site
TieuDe 'Buoc 5/5: Dung trang web Quan ly tai san tren IIS'
# chay trong tien trinh moi de doc cau hinh IIS moi nhat (module vua cai)
$thamSo = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'cai-dat-iis.ps1'),
  '-ThuMuc', $ThuMuc, '-ThuMucDuLieu', $ThuMucDuLieu, '-CongHttp', $CongHttp, '-CongHttps', $CongHttps)
if ($TenMien) { $thamSo += @('-TenMien', $TenMien) }
if ($TuKy) { $thamSo += '-TuKy' }
& (Join-Path $PSHOME 'powershell.exe') @thamSo
if ($LASTEXITCODE -ne 0) {
  Loi 'Cai dat chua xong. Doc dong [LOI] o tren, sua theo muc "Gap loi" trong huong dan roi nhap dup CAI-DAT-MAY-CHU.bat lai.'
  exit 1
}

# ------------------------------------------------------------------ sao luu
$tacVuSaoLuu = 'QuanLyTaiSan - Sao luu du lieu'
if (-not (Get-ScheduledTask -TaskName $tacVuSaoLuu -ErrorAction SilentlyContinue)) {
  TieuDe 'Sao luu du lieu'
  Write-Host '  Phan mem tu giu ban sao taisan.xml moi ngay trong thu muc du lieu. Nen sao luu ca thu muc (gom anh, lich su)'
  Write-Host '  sang o dia khac moi dem.'
  if (DongY 'Dat lich sao luu thu muc du lieu moi ngay luc 23:30?') {
    & (Join-Path $PSHOME 'powershell.exe') -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'sao-luu-dat-lich.ps1') `
      -Nguon $ThuMucDuLieu -KhongHoi
  }
}

# ------------------------------------------------------------------ viec tiep theo
$hauTo = { param($c, $md) if ($c -eq $md) { '' } else { ":$c" } }
if ($TenMien) { $diaChi = "http://$TenMien" } elseif ($TuKy) { $diaChi = "https://localhost$(& $hauTo $CongHttps 443)" } else { $diaChi = "http://localhost$(& $hauTo $CongHttp 80)" }
TieuDe 'Viec tiep theo'
Write-Host "  1. Mo thu $diaChi  (tren may nay), dang nhap bang tai khoan quan tri vua tao."
if ($TenMien) {
  Write-Host "     Tu may khac / dien thoai: http://$TenMien"
} elseif ($TuKy) {
  Write-Host "     Tu may khac / dien thoai: https://<IP cong khai cua may chu>$(& $hauTo $CongHttps 443)  (lan dau bam Nang cao > Tiep tuc)"
} else {
  Write-Host "     Tu may khac / dien thoai: http://<IP cong khai cua may chu>$(& $hauTo $CongHttp 80)"
}
Write-Host "  2. Mo cong $CongHttp$(if ($TenMien -or $TuKy) { " va $CongHttps" }) trong tuong lua cua nha cung cap may chu / modem (neu co), roi thu tu dien thoai dung 4G."
if ($TenMien) {
  Write-Host '  3. Bat HTTPS mien phi bang win-acme (Let''s Encrypt), xem huong dan buoc 8. Xong thi nhap dup'
  Write-Host '     CAI-DAT-MAY-CHU.bat lan nua (nhan Enter o moi cau hoi) de tu chuyen http sang https.'
} else {
  Write-Host '  3. Khi co ten mien: tao ban ghi A, nhap dup CAI-DAT-MAY-CHU.bat lan nua va nhap ten mien, roi bat HTTPS.'
}
Write-Host '  4. Trong phan mem: Cai dat > "Dia chi in trong ma QR" = dia chi https dien thoai vao, roi Danh muc, Nhap tu Excel, In tem QR.'
Write-Host ''
if (DongY "Mo $diaChi ngay bay gio?") { MoTrang $diaChi }
