@echo off
rem Cai may chu "Chia se vi tri truc tiep" tren may tinh / may chu Windows (tu xin quyen quan tri).
rem Tham so tuy chon:  -Cong 3000   -ThuMuc C:\LuuViTriMayChu   -KiemTra   -GoBo
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
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CaiDat-MayChu.ps1" %*
echo.
pause
