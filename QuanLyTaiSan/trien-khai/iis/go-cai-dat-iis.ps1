<#
.SYNOPSIS
  Go phan mem Quan ly tai san khoi IIS: xoa site, app pool, luat tuong lua, chung chi gan vao cong.
  Thu muc chuong trinh, thu muc du lieu va lich sao luu KHONG bi xoa (xoa tay neu khong can nua).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\go-cai-dat-iis.ps1
#>
[CmdletBinding()]
param([string]$TenSite = 'QuanLyTaiSan')

$ErrorActionPreference = 'Stop'
$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Write-Host '[LOI] Hay mo PowerShell bang quyen Administrator.' -ForegroundColor Red; exit 1 }
Import-Module WebAdministration

if (Test-Path "IIS:\Sites\$TenSite") {
  # go chung chi khoi cong https cua site (binding https khong kem ten mien gan chung chi cho ca cong)
  foreach ($b in @(Get-WebBinding -Name $TenSite -Protocol https -ErrorAction SilentlyContinue)) { try { $b.RemoveSslCertificate() } catch { } }
  Remove-Website -Name $TenSite
  Write-Host "Da xoa site $TenSite"
}
if (Test-Path "IIS:\AppPools\$TenSite") { Remove-WebAppPool -Name $TenSite; Write-Host "Da xoa app pool $TenSite" }
Get-NetFirewallRule -DisplayName 'QuanLyTaiSan TCP *' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName 'Quan ly tai san (IIS)' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host 'Xong. Thu muc chuong trinh (C:\inetpub\QuanLyTaiSan), du lieu va lich sao luu van con.'
Write-Host 'Xoa lich sao luu: Task Scheduler > "QuanLyTaiSan - Sao luu du lieu" > Delete.'
