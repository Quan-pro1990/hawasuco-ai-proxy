# Bien dich ThatThoatNuoc.exe bang trinh bien dich C# co san trong Windows (.NET Framework 4.x).
# Khong can cai Visual Studio hay .NET SDK.
# Neu phan mem dang mo thi file .exe bi khoa: dong phan mem roi chay lai (hoac truyen -Out duong_dan_khac).
param([string]$Out)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root 'src'

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw 'Khong tim thay csc.exe cua .NET Framework 4' }

$icon = Join-Path $src 'app.ico'
$logo = Join-Path $src 'logo.png'
foreach ($f in $icon, $logo) { if (-not (Test-Path $f)) { throw "Thieu $f" } }

$out = if ($Out) { $Out } else { Join-Path $root 'ThatThoatNuoc.exe' }
# Ban cu doi ten khi cap nhat luc phan mem dang mo: xoa neu khong con chay.
$cu = Join-Path $root 'ThatThoatNuoc.ban-cu.exe'
if (Test-Path $cu) { try { Remove-Item $cu -ErrorAction Stop } catch { } }
$files = @(Get-ChildItem $src -Filter *.cs | ForEach-Object { $_.FullName })
$refs = @('System.dll', 'System.Core.dll', 'System.Data.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll',
          'System.Xml.dll', 'System.Xml.Linq.dll', 'System.IO.Compression.dll', 'System.IO.Compression.FileSystem.dll',
          'System.Web.Extensions.dll', 'System.Security.dll') | ForEach-Object { "/r:$_" }
# Trang web cho điện thoại (máy chủ IIS phục vụ) và các tệp của gói cài IIS: nhúng vào file .exe
$res = @()
foreach ($f in Get-ChildItem (Join-Path $root 'web') -File) { $res += "/resource:$($f.FullName),ThatThoatNuoc.web.$($f.Name)" }
foreach ($f in Get-ChildItem (Join-Path $root 'iis') -File) { $res += "/resource:$($f.FullName),ThatThoatNuoc.iis.$($f.Name)" }

& $csc /nologo /target:winexe /optimize+ /codepage:65001 /warn:4 "/out:$out" "/win32manifest:$(Join-Path $src 'app.manifest')" "/win32icon:$icon" "/resource:$logo,ThatThoatNuoc.logo.png" "/resource:$icon,ThatThoatNuoc.app.ico" $res $refs $files
if ($LASTEXITCODE -ne 0) { throw 'Bien dich that bai' }
"Da tao: $out"
