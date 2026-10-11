@echo off
rem Cai AquaNet GIS len may chu IIS (tu xin quyen quan tri). Xem HUONG_DAN_IIS.md.
rem Tham so them (tuy chon): -Cong 8443  -DuLieu D:\AquaNetData  -ChungChi <thumbprint>  -TenMien ten.vn
rem                          -DuLieuMau  -DatMatKhau  -KiemTra  -GoBo  -TaoGoi D:\GoiAquaNet
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
