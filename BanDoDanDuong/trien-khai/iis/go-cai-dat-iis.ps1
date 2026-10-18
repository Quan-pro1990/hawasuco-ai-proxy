<#
.SYNOPSIS
  Go HawaMap khoi IIS: xoa site, app pool, tac vu Node nen (che do Proxy), luat tuong lua.
  Thu muc ung dung va thu muc du lieu KHONG bi xoa (xoa tay neu khong can nua).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\go-cai-dat-iis.ps1 -TenSite HawaMap
#>
[CmdletBinding()]
param([string]$TenSite = 'HawaMap')

$ErrorActionPreference = 'Stop'
$laQuanTri = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $laQuanTri) { Write-Host '[LOI] Hay mo PowerShell bang quyen Administrator.' -ForegroundColor Red; exit 1 }
Import-Module WebAdministration

if (Test-Path "IIS:\Sites\$TenSite") { Remove-Website -Name $TenSite; Write-Host "Da xoa site $TenSite" }
if (Test-Path "IIS:\AppPools\$TenSite") { Remove-WebAppPool -Name $TenSite; Write-Host "Da xoa app pool $TenSite" }
$tenTac = "$TenSite Node"
if (Get-ScheduledTask -TaskName $tenTac -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $tenTac -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $tenTac -Confirm:$false
  Write-Host "Da xoa tac vu $tenTac"
}
Get-NetFirewallRule -DisplayName 'HawaMap TCP *' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host 'Xong. Thu muc ung dung va du lieu van con.'
