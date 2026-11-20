@echo off
rem Tao chung chi HTTPS cho Tro ly ao. Tham so them (tuy chon): -TenMien tenmien.vn,192.168.1.10   -Thumbprint <ma chung chi co san>
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0TaoChungChi.ps1" %*
echo.
pause
