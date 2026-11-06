@echo off
rem Cai ung dung "Luu Vi Tri" len dien thoai Android qua cap USB (hoac Wi-Fi), co huong dan tung buoc.
rem Khong can quyen quan tri. Tham so tuy chon:  -WiFi   -KhongCapQuyen   -Apk duong_dan.apk
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CaiDat-DienThoai.ps1" %*
echo.
pause
