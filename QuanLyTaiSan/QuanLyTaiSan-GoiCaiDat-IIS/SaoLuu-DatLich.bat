@echo off
rem ============================================================
rem  Dat lich sao luu thu muc du lieu phan mem Quan ly tai san
rem  moi ngay (Task Scheduler, tai khoan SYSTEM).
rem  Chep cac tep moi / thay doi sang <thu muc dich>\HienTai,
rem  KHONG xoa gi o thu muc dich. Nhat ky: <thu muc dich>\saoluu.log
rem  Xoa lich: schtasks /Delete /TN "QuanLyTaiSan - Sao luu du lieu" /F
rem ============================================================
setlocal EnableExtensions
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
title Dat lich sao luu - Quan ly tai san
set "TENTACVU=QuanLyTaiSan - Sao luu du lieu"
set "NGUON=C:\QuanLyTaiSanData"
set "CAIDAT=%SystemDrive%\inetpub\QuanLyTaiSan\caidat.txt"
if exist "%CAIDAT%" for /f "usebackq tokens=1,* delims==" %%a in ("%CAIDAT%") do if /i "%%a"=="DuLieu" set "NGUON=%%b"
set "DICH=D:\SaoLuu\QuanLyTaiSan"
if not exist D:\ set "DICH=%SystemDrive%\SaoLuu\QuanLyTaiSan"
set "GIO=23:30"

echo ==================================================
echo   DAT LICH SAO LUU DU LIEU - QUAN LY TAI SAN
echo ==================================================
echo Bam Enter de giu gia tri trong ngoac vuong.
echo.
set /p "NGUON=Thu muc du lieu [%NGUON%]: "
if not exist "%NGUON%\taisan.xml" goto :loiNguon
set /p "DICH=Thu muc sao luu - nen o o dia khac [%DICH%]: "
if /i "%DICH%"=="%NGUON%" goto :loiTrung
set /p "GIO=Gio chay hang ngay, dang HH:MM [%GIO%]: "

if not exist "%DICH%\HienTai" mkdir "%DICH%\HienTai"
if not exist "%DICH%\HienTai" goto :loiDich

set "THUMUCSCRIPT=%ProgramData%\QuanLyTaiSan-SaoLuu"
if not exist "%THUMUCSCRIPT%" mkdir "%THUMUCSCRIPT%"
set "SCRIPT=%THUMUCSCRIPT%\SaoLuu.cmd"
> "%SCRIPT%" echo @echo off
>> "%SCRIPT%" echo rem Tao boi SaoLuu-DatLich.bat - sao luu du lieu phan mem Quan ly tai san
>> "%SCRIPT%" echo robocopy "%NGUON%" "%DICH%\HienTai" /E /COPY:DAT /R:2 /W:10 /NP /NFL /NDL /XF dang-chay.lock /LOG+:"%DICH%\saoluu.log"
>> "%SCRIPT%" echo if errorlevel 8 exit /b 1
>> "%SCRIPT%" echo exit /b 0

schtasks /Create /F /TN "%TENTACVU%" /SC DAILY /ST %GIO% /RU SYSTEM /RL HIGHEST /TR "\"%SCRIPT%\""
if errorlevel 1 goto :loiLich

echo.
echo Chay thu sao luu lan dau (co the mat vai phut neu nhieu anh)...
call "%SCRIPT%"
if errorlevel 1 goto :loiChay
echo.
echo ==================================================
echo   DA DAT LICH: moi ngay luc %GIO%
echo   Tu:  %NGUON%
echo   Den: %DICH%\HienTai
echo   Nhat ky: %DICH%\saoluu.log
echo   Xem / sua lich: Task Scheduler ^> "%TENTACVU%"
echo ==================================================
echo Nen chep tiep thu muc sao luu ra may khac / o cung roi dinh ky.
goto :ketthuc

:loiNguon
echo [LOI] Khong thay "%NGUON%\taisan.xml" - kiem tra lai thu muc du lieu.
goto :ketthuc
:loiTrung
echo [LOI] Thu muc sao luu phai khac thu muc du lieu.
goto :ketthuc
:loiDich
echo [LOI] Khong tao duoc "%DICH%\HienTai" - kiem tra o dia / quyen ghi.
goto :ketthuc
:loiLich
echo [LOI] Khong tao duoc lich (gio phai dang HH:MM, vd 23:30).
goto :ketthuc
:loiChay
echo [LOI] Sao luu thu bi loi - xem "%DICH%\saoluu.log".
goto :ketthuc

:ketthuc
echo.
pause
endlocal
