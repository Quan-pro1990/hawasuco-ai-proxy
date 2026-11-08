# Bien dich ITToolkit.exe bang trinh bien dich C# co san trong Windows (.NET Framework 4.x).
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
$manifest = Join-Path $src 'app.manifest'
foreach ($f in $icon, $manifest) { if (-not (Test-Path $f)) { throw "Thieu $f" } }

$out = if ($Out) { $Out } else { Join-Path $root 'ITToolkit.exe' }
$files = @(Get-ChildItem $src -Filter *.cs | ForEach-Object { $_.FullName })
$refs = @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.Management.dll',
          'System.ServiceProcess.dll', 'System.DirectoryServices.dll') | ForEach-Object { "/r:$_" }

& $csc /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 /warn:4 "/out:$out" "/win32manifest:$manifest" "/win32icon:$icon" $refs $files
if ($LASTEXITCODE -ne 0) { throw 'Bien dich that bai' }
"Da tao: $out"
