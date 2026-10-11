@echo off
rem Chuan bi may chu Windows moi cai cho AquaNet GIS (tu xin quyen quan tri). Xem HUONG_DAN_IIS.md, Phan 0-1.
rem Cai: IIS, ASP.NET Core Hosting Bundle, PostgreSQL 16 + PostGIS, Python 3.12, Node.js LTS. Chay lai nhieu lan an toan.
rem Tham so (tuy chon): -PgDuLieu D:\PostgreSQL\16\data -DuLieu D:\AquaNetData   -KhongCaiAquaNet
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
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ChuanBi-MayChu.ps1" %*
echo.
pause
