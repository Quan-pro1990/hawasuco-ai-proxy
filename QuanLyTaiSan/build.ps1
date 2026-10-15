# Biên dịch QuanLyTaiSan.exe bằng trình biên dịch C# có sẵn trong Windows (.NET Framework 4.x) và tạo gói cài IIS.
# Không cần cài Visual Studio hay .NET SDK.
#   build.bat                 tạo QuanLyTaiSan.exe + thư mục GoiCaiDat-IIS (chép sang máy chủ, chạy CaiDat-IIS.bat)
#   build.bat -Out D:\x.exe   chỉ biên dịch ra file khác
param([string]$Out)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root 'src'

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw 'Khong tim thay csc.exe cua .NET Framework 4' }

$icon = Join-Path $src 'app.ico'
$out = if ($Out) { $Out } else { Join-Path $root 'QuanLyTaiSan.exe' }
$files = @(Get-ChildItem $src -Filter *.cs | ForEach-Object { $_.FullName })
$refs = @('System.dll', 'System.Core.dll', 'System.Xml.dll', 'System.Xml.Linq.dll', 'System.IO.Compression.dll',
          'System.IO.Compression.FileSystem.dll', 'System.Web.Extensions.dll') | ForEach-Object { "/r:$_" }
# Trang web (máy tính + điện thoại) nhúng vào file .exe
$res = @()
foreach ($f in Get-ChildItem (Join-Path $root 'web') -File) { $res += "/resource:$($f.FullName),QuanLyTaiSan.web.$($f.Name)" }

& $csc /nologo /target:exe /optimize+ /codepage:65001 /warn:4 "/out:$out" "/win32icon:$icon" $res $refs $files
if ($LASTEXITCODE -ne 0) { throw 'Bien dich that bai' }
"Da tao: $out"

if (-not $Out) {
    # Gói cài IIS: GoiCaiDat-IIS\CaiDat-IIS.bat + web\QuanLyTaiSan.exe + web\web.config
    $goi = Join-Path $root 'GoiCaiDat-IIS'
    New-Item -ItemType Directory -Force (Join-Path $goi 'web') | Out-Null
    Copy-Item $out (Join-Path $goi 'web\QuanLyTaiSan.exe') -Force
    Copy-Item (Join-Path $root 'iis\web.config') (Join-Path $goi 'web\web.config') -Force
    foreach ($f in 'CaiDat-IIS.bat', 'CaiDat-IIS.ps1', 'HUONG_DAN_IIS.txt') { Copy-Item (Join-Path $root "iis\$f") (Join-Path $goi $f) -Force }
    "Da tao goi cai IIS: $goi"
}
