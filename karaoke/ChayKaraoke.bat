@echo off
rem ============================================================
rem  ChayKaraoke.bat - chay phan mem KaraLED (karaoke YouTube)
rem  Can Node.js 18 tro len: https://nodejs.org (ban LTS)
rem  Dong cua so nay = tat phan mem.
rem ============================================================
setlocal EnableExtensions
cd /d "%~dp0"
title KaraLED - Karaoke YouTube

where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] May chua cai Node.js.
    echo       Tai ban LTS tai https://nodejs.org , cai xong chay lai file nay.
    start "" https://nodejs.org
    pause
    exit /b 1
)

if not exist ".env" if exist ".env.example" copy ".env.example" ".env" >nul

set "PORT=3000"
if exist ".env" for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do if /i "%%A"=="PORT" if not "%%B"=="" set "PORT=%%B"

rem Mo trinh duyet sau 3 giay (cho phan mem khoi dong xong)
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:%PORT%/"

node server.js
echo.
echo Phan mem da dung.
pause
endlocal
