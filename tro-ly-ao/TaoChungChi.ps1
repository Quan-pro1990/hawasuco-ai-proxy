# Tạo chứng chỉ HTTPS cho Trợ lý ảo (trình duyệt chỉ cho dùng micro trên trang https).
#   TaoChungChi.bat                         tạo chứng chỉ tự ký 10 năm cho tên máy + localhost
#   TaoChungChi.bat -TenMien tenmien.vn     ghi thêm tên miền / địa chỉ IP vào chứng chỉ (cách nhau dấu phẩy)
#   TaoChungChi.bat -Thumbprint <mã>        dùng chứng chỉ có sẵn trong máy (vd chứng chỉ thật của tên miền, phải cho xuất khoá)
# Kết quả: file chungchi.pfx cạnh script + 2 dòng HTTPS_PFX, HTTPS_PFX_MATKHAU trong file .env.
param(
    [string]$TenMien = '',
    [string]$Thumbprint = ''
)
$ErrorActionPreference = 'Stop'
$thuMuc = Split-Path -Parent $MyInvocation.MyCommand.Path
$pfx = Join-Path $thuMuc 'chungchi.pfx'
$tepEnv = Join-Path $thuMuc '.env'

$kyTu = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 24
$rng.GetBytes($bytes)
$matKhau = -join ($bytes | ForEach-Object { $kyTu[$_ % $kyTu.Length] })
$ss = ConvertTo-SecureString $matKhau -AsPlainText -Force

function XuatPfx($cert) {
    $ts = @{ Cert = $cert; FilePath = $pfx; Password = $ss }
    # Windows mới: mã hoá AES256 (Node.js đọc tốt). Windows cũ không có tuỳ chọn này thì dùng mặc định.
    if ((Get-Command Export-PfxCertificate).Parameters.ContainsKey('CryptoAlgorithmOption')) { $ts.CryptoAlgorithmOption = 'AES256_SHA256' }
    Export-PfxCertificate @ts | Out-Null
}

if ($Thumbprint) {
    $tp = $Thumbprint -replace '\s', ''
    $cert = Get-ChildItem Cert:\LocalMachine\My, Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $tp } | Select-Object -First 1
    if (-not $cert) { throw "Không tìm thấy chứng chỉ $tp trong kho LocalMachine\My hoặc CurrentUser\My." }
    XuatPfx $cert
    Write-Host "Đã xuất chứng chỉ có sẵn: $($cert.Subject)"
} else {
    $ten = @($env:COMPUTERNAME, 'localhost')
    if ($TenMien) { $ten += ($TenMien -split '[,;\s]+' | Where-Object { $_ }) }
    $ten = @($ten | Select-Object -Unique)
    $dns = @($ten | Where-Object { -not ($_ -as [ipaddress]) })
    $ips = @($ten | Where-Object { $_ -as [ipaddress] })
    $san = @($dns | ForEach-Object { "DNS=$_" }) + @($ips | ForEach-Object { "IPAddress=$_" })
    $cert = New-SelfSignedCertificate -Subject "CN=$($dns[0])" `
        -TextExtension @("2.5.29.17={text}" + ($san -join '&')) `
        -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(10) `
        -FriendlyName 'Tro ly ao giong noi' -KeyExportPolicy Exportable -KeyAlgorithm RSA -KeyLength 2048
    XuatPfx $cert
    Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)"
    Write-Host "Đã tạo chứng chỉ tự ký 10 năm cho: $($ten -join ', ')"
}

# Ghi vào .env (thay 2 dòng cũ nếu có)
$dong = @()
if (Test-Path $tepEnv) { $dong = @(Get-Content $tepEnv -Encoding UTF8 | Where-Object { $_ -notmatch '^\s*HTTPS_PFX(_MATKHAU)?\s*=' }) }
$dong += 'HTTPS_PFX=chungchi.pfx'
$dong += "HTTPS_PFX_MATKHAU=$matKhau"
[IO.File]::WriteAllLines($tepEnv, [string[]]$dong, (New-Object Text.UTF8Encoding $false))

Write-Host "Đã lưu $pfx và cập nhật .env."
Write-Host 'Chạy lại trợ lý (Chay.bat hoặc khởi động lại tác vụ tự chạy) để dùng https.'
Write-Host 'Lần đầu mở trên điện thoại, trình duyệt cảnh báo chứng chỉ tự ký: bấm "Nâng cao" → "Tiếp tục".'
