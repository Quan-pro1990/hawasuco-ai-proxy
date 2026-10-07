@echo off
rem Cai may chu IIS cho phan mem Quan ly that thoat nuoc - website HTTP cong 80 (tu xin quyen quan tri).
rem Can co san: IIS + ASP.NET Core Hosting Bundle (vd 9.0).
rem Tham so them (tuy chon): -Cong 80  -DuLieu D:\ThatThoatNuocData  -DuongDan /thatthoat  -TenMien ten.vn  -ThaySiteMacDinh  -DatMatKhau  -KiemTra  -GoBo
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
