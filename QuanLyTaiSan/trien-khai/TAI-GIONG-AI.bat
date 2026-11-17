@echo off
rem ============================================================
rem  TAI GIONG DOC AI TIENG VIET cho Tro ly ao Hawasuco (lay tu phan mem QLNS https://qlns.capnuochaugiang.vn)
rem  Nhap dup, chon "Yes" khi Windows hoi quyen Administrator.
rem  Tuy chon: TAI-GIONG-AI.bat "D:\inetpub\QuanLyTaiSan"  (neu site o thu muc khac)
rem ============================================================
cd /d "%~dp0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Dang xin quyen Administrator...
  if "%~1"=="" (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs") else (powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '\"%~1\"' -Verb RunAs")
  exit /b
)
set "SITE=%~1"
if "%SITE%"=="" for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "try{Import-Module WebAdministration -EA Stop;[Environment]::ExpandEnvironmentVariables((Get-Website -Name QuanLyTaiSan).physicalPath)}catch{'C:\inetpub\QuanLyTaiSan'}"`) do set "SITE=%%P"
echo Thu muc site: %SITE%
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iis\giong-ai.ps1" -ThuMuc "%SITE%" -Force
if errorlevel 1 (echo. & echo [LOI] Chua tai duoc giong doc AI. Kiem tra may chu nay mo duoc https://qlns.capnuochaugiang.vn) else (echo. & echo HOAN TAT. Mo phan mem, bam Ctrl+F5, mo Tro ly ao va bam nut loa.)
echo.
pause
