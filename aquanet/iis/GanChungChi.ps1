# Gắn (hoặc đổi) chứng chỉ HTTPS cho site AquaNet GIS mà không cài lại.
# Dùng khi có chứng chỉ thật của tên miền, và để win-acme tự gọi sau mỗi lần gia hạn Let's Encrypt:
#   win-acme › Installation: "Run a custom script"
#     Script:     C:\inetpub\AquaNet\GanChungChi.ps1
#     Parameters: {CertThumbprint}
# Chạy tay (PowerShell quản trị):  .\GanChungChi.ps1 <thumbprint>
param(
    [Parameter(Mandatory = $true)][string]$Thumbprint,
    [int]$Cong = 0,
    [string]$ThuMuc = "$env:SystemDrive\inetpub\AquaNet"
)
$appId = '{4b8f2e17-9c3a-4d6e-b1f5-7a2c9e0d3f68}'   # trùng với CaiDat-IIS.ps1
if (-not $Cong) {
    $tep = Join-Path $ThuMuc 'caidat.txt'
    $dong = if (Test-Path $tep) { Get-Content $tep -Encoding UTF8 | Where-Object { $_ -match '^Cong=' } | Select-Object -First 1 }
    $Cong = if ($dong) { [int]($dong -replace '^Cong=', '') } else { 8443 }
}
$tp = ($Thumbprint -replace '\s', '').ToUpper()
$cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $tp } | Select-Object -First 1
if (-not $cert) { Write-Host "LỖI: không thấy chứng chỉ $tp trong LocalMachine\My" -ForegroundColor Red; exit 1 }
& netsh.exe http delete sslcert "ipport=0.0.0.0:$Cong" | Out-Null
& netsh.exe http add sslcert "ipport=0.0.0.0:$Cong" "certhash=$tp" "appid=$appId" 'certstorename=MY' | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "LỖI: không gắn được chứng chỉ vào cổng $Cong" -ForegroundColor Red; exit 1 }
Write-Host "Đã gắn chứng chỉ $($cert.Subject) (hết hạn $($cert.NotAfter.ToString('dd/MM/yyyy'))) vào cổng $Cong." -ForegroundColor Green
