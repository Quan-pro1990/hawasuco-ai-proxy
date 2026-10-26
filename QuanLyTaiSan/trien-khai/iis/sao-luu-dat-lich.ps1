<#
.SYNOPSIS
  Dat lich sao luu thu muc du lieu phan mem Quan ly tai san moi ngay (Task Scheduler, tai khoan SYSTEM).

.DESCRIPTION
  Moi ngay chep cac tep moi / thay doi cua thu muc du lieu (taisan.xml, LichSu, Anh, taikhoan.xml, SaoLuu) sang
  <thu muc dich>\HienTai bang robocopy. KHONG xoa gi o thu muc dich. Nhat ky: <thu muc dich>\saoluu.log
  Nhap dup trien-khai\SAO-LUU-DAT-LICH.bat de chay (hoi tung cau), trinh cai dat goi voi -KhongHoi.
  Xoa lich: Task Scheduler > "QuanLyTaiSan - Sao luu du lieu" > Delete.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\sao-luu-dat-lich.ps1 -Dich E:\SaoLuu\QuanLyTaiSan -Gio 22:00
#>
[CmdletBinding()]
param(
  [string]$Nguon = '',
  [string]$Dich = '',
  [string]$Gio = '23:30',
  [string]$ThuMuc = 'C:\inetpub\QuanLyTaiSan',
  [switch]$KhongHoi
)

$ErrorActionPreference = 'Stop'
$tenTacVu = 'QuanLyTaiSan - Sao luu du lieu'
function Dung([string]$s) { Write-Host "  [LOI] $s" -ForegroundColor Red; exit 1 }
function Hoi([string]$cau, [string]$macDinh) {
  if ($KhongHoi) { return $macDinh }
  $tl = Read-Host "  $cau [$macDinh]"
  if ([string]::IsNullOrWhiteSpace($tl)) { return $macDinh }
  return $tl.Trim()
}

$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Dung 'Can quyen Administrator (nhap dup SAO-LUU-DAT-LICH.bat, chon Yes).' }

if (-not $Nguon) {
  $Nguon = 'C:\QuanLyTaiSanData'
  $wc = Join-Path $ThuMuc 'web.config'
  if (Test-Path $wc) {
    $n = ([xml](Get-Content -Raw $wc)).SelectSingleNode("//environmentVariable[@name='QLTS_DULIEU']")
    if ($n -and $n.GetAttribute('value')) { $Nguon = $n.GetAttribute('value') }
  }
}
if (-not $Dich) {
  # nen dat o o dia khac: may co o D: (o cung, khong phai o CD / USB) thi dung D:
  $oD = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='D:'" -ErrorAction SilentlyContinue
  $Dich = if ($oD -and $oD.DriveType -eq 3) { 'D:\SaoLuu\QuanLyTaiSan' } else { "$env:SystemDrive\SaoLuu\QuanLyTaiSan" }
}

Write-Host ''
Write-Host '  DAT LICH SAO LUU DU LIEU - QUAN LY TAI SAN' -ForegroundColor Cyan
$Nguon = Hoi 'Thu muc du lieu' $Nguon
if (-not (Test-Path (Join-Path $Nguon 'taisan.xml'))) { Dung "Khong thay $Nguon\taisan.xml - kiem tra lai thu muc du lieu." }
$Dich = Hoi 'Thu muc sao luu (nen o o dia khac)' $Dich
if ($Dich.TrimEnd('\') -eq $Nguon.TrimEnd('\')) { Dung 'Thu muc sao luu phai khac thu muc du lieu.' }
$Gio = Hoi 'Gio chay hang ngay (HH:MM)' $Gio
if ($Gio -notmatch '^([01]?\d|2[0-3]):[0-5]\d$') { Dung 'Gio phai co dang HH:MM, vd 23:30.' }

$hienTai = Join-Path $Dich 'HienTai'
New-Item -ItemType Directory -Force -Path $hienTai | Out-Null
# thu muc sao luu chua tai khoan, anh: chi quan tri may va SYSTEM doc duoc
icacls $Dich /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' /Q | Out-Null
$global:LASTEXITCODE = 0

$thuMucScript = Join-Path $env:ProgramData 'QuanLyTaiSan-SaoLuu'
New-Item -ItemType Directory -Force -Path $thuMucScript | Out-Null
$script = Join-Path $thuMucScript 'SaoLuu.cmd'
@(
  '@echo off',
  'rem Tao boi sao-luu-dat-lich.ps1 - sao luu du lieu phan mem Quan ly tai san',
  "robocopy `"$Nguon`" `"$hienTai`" /E /COPY:DAT /R:2 /W:10 /NP /NFL /NDL /XF dang-chay.lock /LOG+:`"$(Join-Path $Dich 'saoluu.log')`"",
  'if errorlevel 8 exit /b 1',
  'exit /b 0'
) | Set-Content -Path $script -Encoding ASCII

$hanhDong = New-ScheduledTaskAction -Execute "$env:windir\System32\cmd.exe" -Argument "/c `"$script`""
$kichHoat = New-ScheduledTaskTrigger -Daily -At $Gio
$nguoiChay = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$tuyChon = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 6)
Register-ScheduledTask -TaskName $tenTacVu -Action $hanhDong -Trigger $kichHoat -Principal $nguoiChay -Settings $tuyChon -Force | Out-Null
Start-ScheduledTask -TaskName $tenTacVu

Write-Host "  [OK] Da dat lich: moi ngay luc $Gio" -ForegroundColor Green
Write-Host "       Tu  : $Nguon"
Write-Host "       Den : $hienTai   (lan sao luu dau dang chay ngam; nhat ky $(Join-Path $Dich 'saoluu.log'))"
Write-Host "       Xem / sua lich: Task Scheduler > `"$tenTacVu`". Nen chep tiep thu muc sao luu ra may khac dinh ky."
