@echo off
rem Cai 1 click phan mem Nhan su - Cham cong - Tien luong len may chu IIS (tu xin quyen quan tri).
rem Mac dinh: ten mien qlns.capnuochaugiang.vn, du lieu va sao luu o D:\ChamCongData.
rem Tham so them (tuy chon): -TenMien ten.vn  -DuLieu E:\ChamCongData  -SaoLuu E:\SaoLuu  -ChungChi <thumbprint>
rem   -TenMien khong -CongHttps 8443  -KhongHttp  -SiteCha "Default Web Site" -DuongDan /chamcong  -DatMatKhau  -KiemTra  -GoBo
net session >nul 2>&1
if errorlevel 1 (
  if "%~1"=="" (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  ) else (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
  )
  exit /b
)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CaiDat-IIS.ps1" %*
echo.
pause
