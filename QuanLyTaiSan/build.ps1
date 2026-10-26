# Bien dich QuanLyTaiSan.exe bang trinh bien dich C# co san trong Windows (.NET Framework 4.x) va dong goi may chu
# (cung kieu goi may chu HawaMap). Khong can cai Visual Studio hay .NET SDK.
#   build.bat                 tao QuanLyTaiSan.exe + thu muc dist\quanlytaisan-may-chu va tep dist\quanlytaisan-may-chu-<phien ban>.zip
#                             (chep tep zip len may chu, Extract All, nhap dup CAI-DAT-MAY-CHU.bat)
#   build.bat -Out D:\x.exe   chi bien dich ra file khac
param([string]$Out)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root 'src'

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw 'Khong tim thay csc.exe cua .NET Framework 4' }

$icon = Join-Path $src 'app.ico'
# chu y: PowerShell khong phan biet hoa thuong - bien nay phai khac ten tham so `$Out
$tepRa = if ($Out) { $Out } else { Join-Path $root 'QuanLyTaiSan.exe' }
$files = @(Get-ChildItem $src -Filter *.cs | ForEach-Object { $_.FullName })
$refs = @('System.dll', 'System.Core.dll', 'System.Xml.dll', 'System.Xml.Linq.dll', 'System.IO.Compression.dll',
          'System.IO.Compression.FileSystem.dll', 'System.Web.Extensions.dll') | ForEach-Object { "/r:$_" }
# Trang web (may tinh + dien thoai) nhung vao file .exe
$res = @()
foreach ($f in Get-ChildItem (Join-Path $root 'web') -File) { $res += "/resource:$($f.FullName),QuanLyTaiSan.web.$($f.Name)" }

& $csc /nologo /target:exe /optimize+ /codepage:65001 /warn:4 "/out:$tepRa" "/win32icon:$icon" $res $refs $files
if ($LASTEXITCODE -ne 0) { throw 'Bien dich that bai' }
"Da tao: $tepRa"

if (-not $Out) {
    # Goi may chu: CAI-DAT-MAY-CHU.bat, HUONG-DAN-CAI-DAT.html, QuanLyTaiSan.exe, trien-khai\ (tep nam ngay goc tep zip)
    $phienBan = [regex]::Match((Get-Content -Raw -Encoding UTF8 (Join-Path $src 'MoHinh.cs')), 'PhienBan\s*=\s*"([^"]+)"').Groups[1].Value
    $dist = Join-Path $root 'dist'
    $goi = Join-Path $dist 'quanlytaisan-may-chu'
    if (Test-Path $goi) { Remove-Item -Recurse -Force $goi }
    New-Item -ItemType Directory -Force $goi | Out-Null
    foreach ($f in 'CAI-DAT-MAY-CHU.bat', 'HUONG-DAN-CAI-DAT.html', 'QuanLyTaiSan.exe') { Copy-Item (Join-Path $root $f) (Join-Path $goi $f) }
    Copy-Item (Join-Path $root 'trien-khai') (Join-Path $goi 'trien-khai') -Recurse
    Get-ChildItem $dist -Filter 'quanlytaisan-may-chu-*.zip' | Remove-Item
    $zip = Join-Path $dist "quanlytaisan-may-chu-$phienBan.zip"
    Compress-Archive -Path (Join-Path $goi '*') -DestinationPath $zip
    "Da dong goi: $goi"
    "Tep zip: $zip  (chep len may chu > Extract All > nhap dup CAI-DAT-MAY-CHU.bat)"
}
