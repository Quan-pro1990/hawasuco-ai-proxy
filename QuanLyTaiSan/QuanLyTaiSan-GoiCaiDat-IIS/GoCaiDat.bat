@echo off
rem Go phan mem Quan ly tai san khoi IIS. GIU NGUYEN thu muc du lieu (C:\QuanLyTaiSanData).
echo Go phan mem Quan ly tai san khoi IIS (site / ung dung, app pool, chuong trinh, tuong lua).
echo Thu muc du lieu (tai san, anh, lich su) duoc GIU NGUYEN.
choice /C YN /M "Tiep tuc go"
if errorlevel 2 exit /b
call "%~dp0CaiDat-IIS.bat" -GoBo
