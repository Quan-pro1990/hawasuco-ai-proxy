@echo off
rem Bien dich ThatThoatNuoc.exe va tao goi cai may chu IIS (thu muc ThatThoatNuoc-MayChu-IIS).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Goi
pause
