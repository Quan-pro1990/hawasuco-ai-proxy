# Bien dich NoiseLogger.exe bang trinh bien dich C# co san trong Windows (.NET Framework 4.x).
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

$out = if ($Out) { $Out } else { Join-Path $root 'NoiseLogger.exe' }
# ma nguon gom thu muc src va src\Chung (giao dien, Excel, in dung chung)
$files = @(Get-ChildItem $src -Filter *.cs -Recurse | ForEach-Object { $_.FullName })
$refs = @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll',
          'System.Xml.dll', 'System.Xml.Linq.dll', 'System.IO.Compression.dll') | ForEach-Object { "/r:$_" }

& $csc /nologo /target:winexe /optimize+ /codepage:65001 /warn:4 "/out:$out" "/win32manifest:$(Join-Path $src 'app.manifest')" "/win32icon:$icon" "/resource:$logo,NoiseLogger.logo.png" "/resource:$icon,NoiseLogger.app.ico" $refs $files
if ($LASTEXITCODE -ne 0) { throw 'Bien dich that bai' }
"Da tao: $out"
