# Gỡ "Chỉnh ảnh AI": xoá phần mềm trong %LOCALAPPDATA%\Programs\ChinhAnhAI và các lối tắt.
# Cài đặt (API key, thư mục lưu…) ở %APPDATA%\ChinhAnhAI được giữ lại, trừ khi chọn xoá.
$ErrorActionPreference = 'Continue'
$ten = 'Chỉnh ảnh AI'
$dich = Join-Path $env:LOCALAPPDATA 'Programs\ChinhAnhAI'
foreach ($thuMuc in [Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('SendTo')) {
    $l = Join-Path $thuMuc "$ten.lnk"
    if (Test-Path $l) { Remove-Item $l -Force }
}
if (Test-Path $dich) {
    try { Remove-Item $dich -Recurse -Force -ErrorAction Stop }
    catch { Write-Host 'Phần mềm đang mở: đóng cửa sổ Chỉnh ảnh AI rồi chạy lại GoCaiDat.bat.'; exit 1 }
}
$cd = Join-Path $env:APPDATA 'ChinhAnhAI'
if (Test-Path $cd) {
    $tl = Read-Host 'Xoá luôn cài đặt (API key, thư mục lưu...)? Gõ C rồi Enter để xoá, Enter để giữ'
    if ($tl -eq 'C' -or $tl -eq 'c') { Remove-Item $cd -Recurse -Force }
}
Write-Host 'Đã gỡ Chỉnh ảnh AI. Ảnh đã chỉnh của bạn không bị xoá.'
