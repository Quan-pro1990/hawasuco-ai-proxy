@echo off
rem ============================================================
rem  MoManHinhLED.bat - mo man hinh LED toan man hinh (kiosk),
rem  tu phat co tieng, khong can bam chuot.
rem
rem  Cach dung:
rem    MoManHinhLED.bat                 man hinh LED nam ben phai man hinh chinh 1920 px
rem    MoManHinhLED.bat "" 1366         man hinh chinh rong 1366 px
rem    MoManHinhLED.bat "" 0            mo ngay tren man hinh chinh
rem    MoManHinhLED.bat http://192.168.1.10:3000/led?auto=1    may khac chay phan mem
rem    MoManHinhLED.bat dangnhap        mo trinh duyet thuong de dang nhap YouTube Premium
rem
rem  Thoat che do toan man hinh: Alt + F4
rem ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=3000"
if exist ".env" for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do if /i "%%A"=="PORT" if not "%%B"=="" set "PORT=%%B"

set "URL=http://localhost:%PORT%/led?auto=1"
set "X=1920"
if not "%~1"=="" if /i not "%~1"=="dangnhap" set "URL=%~1"
if not "%~2"=="" set "X=%~2"

set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" goto :nobrowser

rem Ho so trinh duyet rieng cho man hinh LED (giu dang nhap YouTube Premium neu co)
set "PROFILE=%~dp0data\trinhduyet-led"
if not exist "%PROFILE%" mkdir "%PROFILE%"

if /i "%~1"=="dangnhap" (
    start "" "%BROWSER%" --user-data-dir="%PROFILE%" --no-first-run https://www.youtube.com/
    echo Dang nhap tai khoan YouTube Premium trong cua so vua mo, xong thi dong cua so do
    echo roi chay lai MoManHinhLED.bat binh thuong.
    pause
    exit /b 0
)

start "" "%BROWSER%" --user-data-dir="%PROFILE%" --no-first-run --kiosk --window-position=%X%,0 --autoplay-policy=no-user-gesture-required --disable-features=Translate --disable-session-crashed-bubble "%URL%"
exit /b 0

:nobrowser
echo [LOI] Khong tim thay Google Chrome hoac Microsoft Edge.
echo       Cai Chrome tai https://www.google.com/chrome
pause
exit /b 1
