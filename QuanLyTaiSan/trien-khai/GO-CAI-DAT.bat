@echo off
rem ============================================================
rem  GO phan mem Quan ly tai san khoi IIS. GIU NGUYEN thu muc du lieu (tai san, anh, lich su).
rem  Nhap dup, chon "Yes" khi Windows hoi quyen Administrator.
rem ============================================================
cd /d "%~dp0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Dang xin quyen Administrator...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo Go site, app pool, luat tuong lua cua Quan ly tai san. Du lieu duoc GIU NGUYEN.
choice /C YN /M "Tiep tuc go"
if errorlevel 2 exit /b
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iis\go-cai-dat-iis.ps1"
echo.
pause
