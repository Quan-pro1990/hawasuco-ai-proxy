@echo off
rem Cai may chu IIS cho phan mem Quan ly that thoat nuoc (tu xin quyen quan tri).
rem Tham so them (tuy chon): -Cong 8080  -DuLieu D:\ThatThoatNuocData  -DuongDan /thatthoat  -ChungChi <thumbprint>  -TenMien ten.vn  -DatMatKhau  -KiemTra  -GoBo
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
