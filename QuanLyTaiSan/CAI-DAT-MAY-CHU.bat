@echo off
rem ============================================================
rem  CAI DAT MAY CHU QUAN LY TAI SAN len IIS (Windows Server 2016+ / Windows 10, 11)
rem  Nhap dup vao file nay, chon "Yes" khi Windows hoi quyen Administrator,
rem  roi tra loi tung cau hoi. Huong dan: HUONG-DAN-CAI-DAT.html
rem  Chay lai file nay de cap nhat phien ban moi (du lieu duoc giu nguyen).
rem ============================================================
cd /d "%~dp0"
if not exist "%~dp0trien-khai\iis\cai-dat-nhanh.ps1" (
  echo [LOI] Thieu thu muc trien-khai. Hay giai nen ^(Extract All^) ca goi cai dat truoc khi chay.
  pause
  exit /b 1
)
fltmc >nul 2>&1
if errorlevel 1 (
  echo Dang xin quyen Administrator...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0trien-khai\iis\cai-dat-nhanh.ps1"
echo.
pause
