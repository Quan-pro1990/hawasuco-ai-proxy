@echo off
rem Trien khai tu dong may chu IIS cho phan mem Quan ly that thoat nuoc (tu xin quyen quan tri):
rem   cai IIS + tai va cai ASP.NET Core Hosting Bundle (neu thieu), bien dich phan mem tu ma nguon
rem   (hoac tai ma nguon moi nhat tu GitHub), dong goi, roi chay CaiDat-IIS de tao site https.
rem Tham so them (tuy chon):
rem   -ChiTaoGoi  -ChiCaiNen  -Nguon GitHub  -Nhanh main  -KhongBienDich  -DotNet 8.0  -Ra D:\Goi
rem   -Cong 8080  -DuLieu D:\ThatThoatNuocData  -DuongDan /thatthoat  -ChungChi <thumbprint>  -TenMien ten.vn  -DatMatKhau
rem Chi tiet: dau file TrienKhai-IIS.ps1 va HUONG_DAN_IIS.txt
setlocal
rem -ChiTaoGoi (chi bien dich + tao goi) khong can quyen quan tri
echo.%* | find /i "-ChiTaoGoi" >nul
if not errorlevel 1 goto chay
net session >nul 2>&1
if not errorlevel 1 goto chay
if "%~1"=="" (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
) else (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs"
)
exit /b
:chay
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0TrienKhai-IIS.ps1" %*
echo.
pause
