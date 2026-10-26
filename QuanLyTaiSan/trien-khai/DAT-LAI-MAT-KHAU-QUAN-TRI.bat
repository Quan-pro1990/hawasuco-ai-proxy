@echo off
rem ============================================================
rem  DAT LAI MAT KHAU tai khoan quan tri phan mem Quan ly tai san (khi quen mat khau)
rem  Nhap dup, chon "Yes" khi Windows hoi quyen Administrator.
rem ============================================================
cd /d "%~dp0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Dang xin quyen Administrator...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iis\tai-khoan-quan-tri.ps1"
echo.
pause
