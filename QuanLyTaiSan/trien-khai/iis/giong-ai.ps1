<#
.SYNOPSIS
  Tai GIONG DOC AI tieng Viet cho Tro ly ao Hawasuco trong phan mem Quan ly tai san (cung bo doc voi website va phan mem
  Nhan su - Cham cong QLNS): eSpeak NG (phien am) + mo hinh Piper vi_VN-vais1000-medium, chay ngay trong trinh duyet.

.DESCRIPTION
  Lay 4 tep JS tu trang QLNS (moi khoi mo dau bang /* ===== ten.js ===== */) va 2 tep mo hinh / bo chay (~73 MB) trong
  giong-doc/ai/ cua may chu QLNS. Ket qua dat tai <thu muc site>\giong-doc\ (canh QuanLyTaiSan.exe), may chu phuc vu o /giong-doc/.
  Khong co Internet toi QLNS thi bo qua - tro ly ao dung giong tieng Viet cua trinh duyet / dien thoai.
  Nhap dup trien-khai\TAI-GIONG-AI.bat de chay.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\trien-khai\iis\giong-ai.ps1 -ThuMuc C:\inetpub\QuanLyTaiSan
#>
[CmdletBinding()]
param(
  [string]$ThuMuc = 'C:\inetpub\QuanLyTaiSan',
  [string]$Nguon = 'https://qlns.capnuochaugiang.vn/',
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
function Dung([string]$s) { Write-Host "[LOI] $s" -ForegroundColor Red; exit 1 }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
if (-not (Test-Path (Join-Path $ThuMuc 'QuanLyTaiSan.exe'))) { Dung "Khong thay QuanLyTaiSan.exe trong $ThuMuc (truyen -ThuMuc <thu muc site>)." }
if (-not $Nguon.EndsWith('/')) { $Nguon += '/' }
$dst = Join-Path $ThuMuc 'giong-doc'; $ai = Join-Path $dst 'ai'
New-Item -ItemType Directory -Force -Path $ai | Out-Null
$wc = New-Object Net.WebClient
$wc.Headers['User-Agent'] = 'QuanLyTaiSan-Setup'

# 1. Bon tep JS (nam san trong trang cua QLNS)
Write-Host "   ... Doc trang $Nguon"
try { $html = [Text.Encoding]::UTF8.GetString($wc.DownloadData($Nguon)) } catch { Dung "Khong mo duoc $Nguon : $($_.Exception.Message)" }
$min = @{ 'giongdoc-vi.js' = 400000; 'giongdoc.js' = 3000; 'giongai-ort.js' = 40000; 'giongai.js' = 8000 }
foreach ($n in 'giongdoc-vi.js', 'giongdoc.js', 'giongai-ort.js', 'giongai.js') {
  $mark = "/* ===== $n ===== */"
  $i = $html.IndexOf($mark)
  if ($i -lt 0) { Dung "Trang QLNS khong co khoi $n (phan mem QLNS chua co giong doc AI?)" }
  $j = $html.IndexOf('</script>', $i)
  if ($j -lt 0) { Dung "Khong tach duoc $n" }
  $js = $html.Substring($i, $j - $i)
  if ($js.Length -lt $min[$n]) { Dung "Khoi $n qua ngan ($($js.Length) ky tu)" }
  [IO.File]::WriteAllText((Join-Path $dst $n), $js, (New-Object Text.UTF8Encoding($false)))
  Write-Host ("   OK  {0,-16} {1:N0} KB" -f $n, ($js.Length / 1KB)) -ForegroundColor Green
}

# 2. Mo hinh giong AI va bo chay WebAssembly (tai lai khi khac kich thuoc)
foreach ($n in 'ort-wasm-simd.wasm', 'vi_VN-vais1000-medium.onnx') {
  $url = $Nguon + 'giong-doc/ai/' + $n; $f = Join-Path $ai $n
  $len = -1
  try { $rq = [Net.HttpWebRequest]::Create($url); $rq.Method = 'HEAD'; $rq.Timeout = 20000; $rs = $rq.GetResponse(); $len = $rs.ContentLength; $rs.Close() } catch { }
  if (-not $Force -and (Test-Path $f) -and $len -gt 0 -and (Get-Item $f).Length -eq $len) { Write-Host ("   OK  {0} da co ({1:N1} MB)" -f $n, ($len / 1MB)) -ForegroundColor Green; continue }
  Write-Host ("   ... Tai {0} ({1:N1} MB, co the mat vai phut)" -f $n, ($len / 1MB))
  $tmp = "$f.tmp"
  try { $wc.DownloadFile($url, $tmp) } catch { Dung "Khong tai duoc $url : $($_.Exception.Message)" }
  if ($len -gt 0 -and (Get-Item $tmp).Length -ne $len) { Remove-Item $tmp -Force; Dung "Tai $n chua tron" }
  Move-Item $tmp $f -Force
  Write-Host ("   OK  {0} ({1:N1} MB)" -f $n, ((Get-Item $f).Length / 1MB)) -ForegroundColor Green
}
Set-Content -Path (Join-Path $dst 'nguon.txt') -Value "Giong doc AI tieng Viet lay tu $Nguon luc $(Get-Date -Format 'dd/MM/yyyy HH:mm'). Chay trien-khai\TAI-GIONG-AI.bat de cap nhat."
Write-Host ''
Write-Host "Xong. Giong doc AI nam o $dst" -ForegroundColor Green
exit 0
