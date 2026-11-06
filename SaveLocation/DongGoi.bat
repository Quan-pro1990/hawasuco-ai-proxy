@echo off
rem Dong goi lai: build APK tu ma nguon roi tao goi cai dat LuuViTri-CaiDat.zip.
rem Can Android Studio (hoac JDK 17 + Android SDK). Tham so: -BoQuaBuild (chi dong goi lai, khong build)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DongGoi.ps1" %*
echo.
pause
