<#
.SYNOPSIS
  Cai dat may chu HawaMap theo kieu hoi - dap, danh cho nguoi moi. Nhap dup CAI-DAT-MAY-CHU.bat de chay.

.DESCRIPTION
  1. Bat IIS.
  2. Kiem tra Node.js 18+ (de nghi tu tai va cai ban LTS tu nodejs.org neu chua co).
  3. Kiem tra URL Rewrite va HttpPlatformHandler (mo trang tai ve, cho cai xong roi kiem tra lai).
  4. Hoi ten mien (nho cau tra loi trong <ThuMucDuLieu>\cai-dat-may-chu.json cho lan chay sau).
  5. Goi cai-dat-iis.ps1 de dung site.
  Chay lai de cap nhat phien ban moi hoac bat HTTPS sau khi co chung chi: nhan Enter o moi cau hoi.
  Huong dan day du: trien-khai\HUONG_DAN_MAY_CHU.md (hoac HUONG-DAN-CAI-DAT.html trong goi cai dat).
#>
[CmdletBinding()]
param(
  [string]$ThuMuc = 'C:\inetpub\hawamap',
  [string]$ThuMucDuLieu = 'C:\HawaMapData'
)

$ErrorActionPreference = 'Stop'
# thanh tien do lam Invoke-WebRequest cua PowerShell 5.1 cham di nhieu lan
$ProgressPreference = 'SilentlyContinue'
try { $Host.UI.RawUI.WindowTitle = 'Cai dat may chu HawaMap' } catch { }

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
Write-Host '  CAI DAT MAY CHU BAN DO HAWAMAP' -ForegroundColor White
Write-Host '  Gom 4 buoc: bat IIS, kiem tra Node.js, kiem tra 2 module cua IIS, hoi ten mien - roi dung trang web.'
Write-Host '  Cau hoi co gia tri trong [ngoac vuong]: nhan Enter de dung gia tri do.'

$tepCaiDat = Join-Path $ThuMucDuLieu 'cai-dat-may-chu.json'
$cu = $null
if (Test-Path $tepCaiDat) { try { $cu = Get-Content -Raw $tepCaiDat | ConvertFrom-Json } catch { } }
if ($cu) {
  $tenCu = if ($cu.TenMien) { $cu.TenMien } else { 'khong co' }
  Write-Host "  May nay da cai HawaMap (ten mien: $tenCu). Lan nay se cap nhat phien ban moi; du lieu trong $ThuMucDuLieu duoc giu nguyen."
}

# ------------------------------------------------------------------ 1. IIS
TieuDe 'Buoc 1/4: Bat IIS (may chu web cua Windows)'
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

# ------------------------------------------------------------------ 2. Node.js
TieuDe 'Buoc 2/4: Node.js (chuong trinh chay may chu HawaMap)'

function PhienBanNode {
  # doc lai PATH: Node.js vua cai xong chua co trong PATH cua cua so nay
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $lenh = Get-Command node -ErrorAction SilentlyContinue
  if (-not $lenh) { return $null }
  try { return (& $lenh.Source --version).Trim().TrimStart('v') } catch { return $null }
}
function DuMoi([string]$v) { return $v -and ([int]($v.Split('.')[0]) -ge 18) }

function CaiNode {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  Write-Host '  Dang tim ban Node.js LTS moi nhat tren nodejs.org...'
  $ds = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
  $lts = @($ds | Where-Object { $_.lts -and ($_.files -contains 'win-x64-msi') })[0]
  if (-not $lts) { throw 'khong tim thay ban LTS' }
  $v = $lts.version
  $tep = Join-Path $env:TEMP "node-$v-x64.msi"
  Write-Host "  Dang tai Node.js $v (khoang 30 MB)..."
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$v/node-$v-x64.msi" -OutFile $tep -UseBasicParsing
  Write-Host '  Dang cai Node.js...'
  $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList "/i `"$tep`" /qn /norestart" -Wait -PassThru
  Remove-Item $tep -ErrorAction SilentlyContinue
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw "trinh cai dat bao loi $($p.ExitCode)" }
}

$v = PhienBanNode
if (-not (DuMoi $v)) {
  if ($v) { ChuY "Node.js $v qua cu, can ban 18 tro len." } else { ChuY 'May chua cai Node.js.' }
  if (DongY 'Tu dong tai va cai Node.js ban LTS tu nodejs.org?') {
    try { CaiNode } catch { Loi "Khong tu cai duoc Node.js: $($_.Exception.Message)" }
  }
  $v = PhienBanNode
  while (-not (DuMoi $v)) {
    Write-Host '  Hay tu cai Node.js: tai ban LTS "Windows Installer (.msi)" 64-bit tai https://nodejs.org,'
    Write-Host '  chay file .msi va bam Next den het (giu tuy chon mac dinh). May chu khong vao duoc Internet thi tai'
    Write-Host '  tren may khac roi chep sang.'
    MoTrang 'https://nodejs.org/en/download'
    [void](Read-Host '  Cai xong nhan Enter de kiem tra lai')
    $v = PhienBanNode
  }
}
Tot "Node.js $v"

# ------------------------------------------------------------------ 3. module IIS
TieuDe 'Buoc 3/4: Module cua IIS'

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
  Tot $m.Ten
}

# ------------------------------------------------------------------ 4. ten mien
TieuDe 'Buoc 4/4: Ten mien'
Write-Host '  Ten mien la dia chi nguoi dung go vao trinh duyet, vd. bando.congty.vn. Phai tao ban ghi A cua ten mien'
Write-Host '  tro ve IP cong khai cua may chu nay truoc (xem huong dan). Can ten mien de bat HTTPS - dien thoai chi cho'
Write-Host '  dung GPS qua HTTPS.  Chua co ten mien: de trong va nhan Enter (vao bang http://<IP may chu> de thu).'
if ($cu -and $cu.TenMien) { Write-Host '  Muon bo ten mien da nhap lan truoc: go dau -' }
$macDinh = if ($cu) { [string]$cu.TenMien } else { '' }
while ($true) {
  $TenMien = (Hoi 'Ten mien' $macDinh).ToLower() -replace '^https?://', '' -replace '/.*$', ''
  if ($TenMien -eq '-') { $TenMien = '' }
  if ($TenMien -eq '' -or $TenMien -match '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') { break }
  Loi 'Ten mien khong hop le: chi gom chu khong dau, so, dau "-" va dau "." (vd. bando.congty.vn).'
}

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
} else {
  # khong co ten mien: site HawaMap can cong 80 khong kem ten mien, trung voi site mac dinh cua IIS
  $macDinhIis = Get-Website | Where-Object { $_.Name -eq 'Default Web Site' }
  if ($macDinhIis -and $macDinhIis.State -eq 'Started' -and
      @(Get-WebBinding -Name 'Default Web Site' -Protocol http | Where-Object { $_.bindingInformation -eq '*:80:' }).Count) {
    ChuY 'Site mac dinh cua IIS ("Default Web Site") dang dung cong 80; khong co ten mien thi HawaMap can cong nay.'
    if (DongY 'Dung site "Default Web Site" de nhuong cong 80 cho HawaMap?') {
      Stop-Website -Name 'Default Web Site'
      Set-ItemProperty 'IIS:\Sites\Default Web Site' -Name serverAutoStart -Value $false
      Tot 'Da dung "Default Web Site"'
    }
  }
}

New-Item -ItemType Directory -Force -Path $ThuMucDuLieu | Out-Null
@{ TenMien = $TenMien; LanCaiCuoi = (Get-Date).ToString('yyyy-MM-dd HH:mm') } | ConvertTo-Json | Set-Content -Path $tepCaiDat -Encoding ASCII

# ------------------------------------------------------------------ dung site
TieuDe 'Dung trang web HawaMap tren IIS'
# chay trong tien trinh moi de doc cau hinh IIS moi nhat (module vua cai)
$thamSo = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'cai-dat-iis.ps1'),
  '-ThuMuc', $ThuMuc, '-ThuMucDuLieu', $ThuMucDuLieu)
if ($TenMien) { $thamSo += @('-TenMien', $TenMien) }
& (Join-Path $PSHOME 'powershell.exe') @thamSo
if ($LASTEXITCODE -ne 0) {
  Loi 'Cai dat chua xong. Doc dong [LOI] o tren, sua theo muc "Gap loi" trong huong dan roi nhap dup CAI-DAT-MAY-CHU.bat lai.'
  exit 1
}

# ------------------------------------------------------------------ viec tiep theo
$diaChi = if ($TenMien) { "http://$TenMien" } else { 'http://localhost' }
TieuDe 'Viec tiep theo'
Write-Host "  1. Mo thu $diaChi  (tren may nay)."
Write-Host "     Tu may khac / dien thoai: http://$(if ($TenMien) { $TenMien } else { '<IP cong khai cua may chu>' })"
Write-Host '  2. Mo cong 80 va 443 trong tuong lua cua nha cung cap may chu (neu co), roi thu tu dien thoai dung 4G.'
if ($TenMien) {
  Write-Host '  3. Bat HTTPS mien phi bang win-acme (Let''s Encrypt), xem huong dan buoc 8. Xong thi nhap dup'
  Write-Host '     CAI-DAT-MAY-CHU.bat lan nua (nhan Enter o moi cau hoi) de tu chuyen http sang https.'
} else {
  Write-Host '  3. Khi co ten mien: tao ban ghi A, nhap dup CAI-DAT-MAY-CHU.bat lan nua va nhap ten mien, roi bat HTTPS.'
}
Write-Host ''
if (DongY "Mo $diaChi ngay bay gio?") { MoTrang $diaChi }
