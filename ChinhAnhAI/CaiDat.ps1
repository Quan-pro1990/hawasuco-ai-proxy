# Cài đặt "Chỉnh ảnh AI" cho người dùng hiện tại (không cần quyền Administrator):
#  1. Biên dịch lại ChinhAnhAI.exe từ mã nguồn bằng csc.exe có sẵn của Windows (không được thì dùng bản có sẵn).
#  2. Chép vào %LOCALAPPDATA%\Programs\ChinhAnhAI.
#  3. Tạo lối tắt ở màn hình Desktop, menu Start và menu chuột phải "Gửi tới" (Send to).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $root 'ChinhAnhAI.exe'
$ten = 'Chỉnh ảnh AI'

Write-Host '[1/3] Biên dịch phần mềm...'
try { & (Join-Path $root 'build.ps1') | Out-Host }
catch {
    if (-not (Test-Path $exe)) { throw "Không biên dịch được và không có sẵn ChinhAnhAI.exe: $_" }
    Write-Host "      Không biên dịch được ($_). Dùng bản có sẵn."
}

Write-Host '[2/3] Chép vào máy...'
$dich = Join-Path $env:LOCALAPPDATA 'Programs\ChinhAnhAI'
New-Item -ItemType Directory -Force $dich | Out-Null
$exeDich = Join-Path $dich 'ChinhAnhAI.exe'
try { Copy-Item $exe $exeDich -Force }
catch { throw 'Phần mềm đang mở: đóng cửa sổ Chỉnh ảnh AI rồi chạy lại CaiDat.bat.' }

Write-Host '[3/3] Tạo lối tắt...'
$sh = New-Object -ComObject WScript.Shell
$noi = @(
    [Environment]::GetFolderPath('DesktopDirectory'),
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('SendTo')
)
foreach ($thuMuc in $noi) {
    $l = $sh.CreateShortcut((Join-Path $thuMuc "$ten.lnk"))
    $l.TargetPath = $exeDich
    $l.WorkingDirectory = $dich
    $l.IconLocation = "$exeDich,0"
    $l.Description = 'Chỉnh ảnh tự động bằng AI'
    $l.Save()
}

Write-Host ''
Write-Host "Đã cài xong: $exeDich"
Write-Host "- Mở từ biểu tượng '$ten' trên màn hình hoặc menu Start."
Write-Host "- Hoặc chọn ảnh trong thư mục -> chuột phải -> Gửi tới (Send to) -> $ten."
Start-Process $exeDich
