# Dong goi TinhTienNuoc: nhung TinhTienNuoc.html vao TinhTienNuoc.exe roi nen thanh TinhTienNuoc.zip.
# Sua giao dien / bang gia trong TinhTienNuoc.html, roi nhay dup build.bat.
# Chi dung PowerShell co san trong Windows, khong can cai them gi.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $root 'TinhTienNuoc.exe'
$html = Join-Path $root 'TinhTienNuoc.html'
$zip = Join-Path $root 'TinhTienNuoc.zip'
foreach ($f in $exe, $html) { if (-not (Test-Path $f)) { throw "Thieu $f" } }

Add-Type -Path (Join-Path $root 'NhungHtml.cs')
[NhungHtml]::Chay($exe, $html)
Compress-Archive -LiteralPath $exe -DestinationPath $zip -Force
"Da tao: $exe"
"Da dong goi: $zip"
