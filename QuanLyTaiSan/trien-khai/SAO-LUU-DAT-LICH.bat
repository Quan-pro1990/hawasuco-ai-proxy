@echo off
rem ============================================================
rem  DAT LICH SAO LUU thu muc du lieu Quan ly tai san moi ngay (Task Scheduler)
rem  Nhap dup, chon "Yes" khi Windows hoi quyen Administrator.
rem ============================================================
cd /d "%~dp0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Dang xin quyen Administrator...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iis\sao-luu-dat-lich.ps1"
echo.
pause
