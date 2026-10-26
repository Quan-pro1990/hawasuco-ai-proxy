<#
.SYNOPSIS
  Tao / dat lai tai khoan QUAN TRI cua phan mem Quan ly tai san tren may chu (khi cai lan dau, hoac khi quen mat khau).

.DESCRIPTION
  Hoi ten dang nhap + mat khau roi goi "QuanLyTaiSan.exe --dat-quan-tri <ten>" (mat khau qua bien moi truong, khong ghi ra dia).
  Chuong trinh khoa thu muc du lieu khi dang chay nen script tam dung app pool roi bat lai.
  Thu muc du lieu doc tu web.config cua site (bien QLTS_DULIEU) neu khong truyen -ThuMucDuLieu.
  Nhap dup trien-khai\DAT-LAI-MAT-KHAU-QUAN-TRI.bat de chay.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\tai-khoan-quan-tri.ps1
#>
[CmdletBinding()]
param(
  [string]$TenSite = 'QuanLyTaiSan',
  [string]$ThuMuc = 'C:\inetpub\QuanLyTaiSan',
  [string]$ThuMucDuLieu = '',
  [switch]$NeuChuaCo,      # chi hoi khi du lieu chua co tai khoan quan tri nao (cai dat lan dau)
  [switch]$TrongLucCai     # goi tu cai-dat-iis.ps1: app pool da dung, khong bat lai
)

$ErrorActionPreference = 'Stop'
function Dung([string]$s) { Write-Host "[LOI] $s" -ForegroundColor Red; exit 1 }

$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Can quyen Administrator (nhap dup DAT-LAI-MAT-KHAU-QUAN-TRI.bat, chon Yes).' }

$exe = Join-Path $ThuMuc 'QuanLyTaiSan.exe'
if (-not (Test-Path $exe)) { Dung "Khong thay $exe - may nay chua cai may chu Quan ly tai san (chay CAI-DAT-MAY-CHU.bat truoc)." }
if (-not $ThuMucDuLieu) {
  $ThuMucDuLieu = 'C:\QuanLyTaiSanData'
  $wc = Join-Path $ThuMuc 'web.config'
  if (Test-Path $wc) {
    $n = ([xml](Get-Content -Raw $wc)).SelectSingleNode("//environmentVariable[@name='QLTS_DULIEU']")
    if ($n -and $n.GetAttribute('value')) { $ThuMucDuLieu = $n.GetAttribute('value') }
  }
}

$tepTaiKhoan = Join-Path $ThuMucDuLieu 'taikhoan.xml'
$coQuanTri = (Test-Path $tepTaiKhoan) -and ((Get-Content -Raw -Encoding UTF8 $tepTaiKhoan) -match 'vaiTro="QuanTri"')
if ($NeuChuaCo -and $coQuanTri) { exit 0 }

Write-Host ''
Write-Host '==> Tai khoan QUAN TRI cua phan mem (toan quyen: danh muc, tai khoan nguoi dung, cai dat)' -ForegroundColor Cyan
if ($coQuanTri) { Write-Host '    Nhap ten tai khoan quan tri can dat lai mat khau (hoac ten moi de tao them 1 tai khoan quan tri).' }
$ten = (Read-Host '    Ten dang nhap [admin]').Trim()
if (-not $ten) { $ten = 'admin' }
while ($true) {
  $m1 = Read-Host '    Mat khau (it nhat 6 ky tu, chu khong hien khi go)' -AsSecureString
  $m2 = Read-Host '    Nhap lai mat khau' -AsSecureString
  $p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($m1))
  $p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($m2))
  if ($p1 -ne $p2) { Write-Host '    Hai lan nhap khong giong nhau, nhap lai.' -ForegroundColor Yellow; continue }
  if ($p1.Length -lt 6) { Write-Host '    Mat khau qua ngan, nhap lai.' -ForegroundColor Yellow; continue }
  break
}

# chuong trinh dang chay (dang giu khoa thu muc du lieu): tam dung app pool
$batLai = $false
if (-not $TrongLucCai) {
  Import-Module WebAdministration
  if ((Test-Path "IIS:\AppPools\$TenSite") -and (Get-WebAppPoolState -Name $TenSite).Value -ne 'Stopped') {
    try { Stop-WebAppPool -Name $TenSite } catch { }
    $batLai = $true
    for ($i = 0; $i -lt 30; $i++) {
      $con = @(Get-CimInstance Win32_Process -Filter "Name='QuanLyTaiSan.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.ExecutablePath -eq $exe })
      if ($con.Count -eq 0) { break }
      Start-Sleep -Seconds 1
    }
  }
}

$env:QLTS_DULIEU = $ThuMucDuLieu
$env:QLTS_MATKHAU = $p1
try {
  $pr = Start-Process -FilePath $exe -ArgumentList @('--dat-quan-tri', $ten) -Wait -PassThru -NoNewWindow
} finally {
  Remove-Item Env:\QLTS_MATKHAU -ErrorAction SilentlyContinue
  $p1 = $null; $p2 = $null
}
if ($batLai) { Start-WebAppPool -Name $TenSite -ErrorAction SilentlyContinue }
if ($pr.ExitCode -ne 0) {
  Dung "Khong dat duoc tai khoan (ma $($pr.ExitCode)). Ten chi gom chu khong dau, so, dau . _ -; xem them $ThuMucDuLieu\loi-khoi-dong.txt"
}
Write-Host "    Da dat tai khoan quan tri '$ten'." -ForegroundColor Green
exit 0
