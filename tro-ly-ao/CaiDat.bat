@echo off
rem ============================================================
rem  CaiDat.bat - cai dat Tro ly ao giong noi (chay 1 lan).
rem  Yeu cau: Node.js 20.12 tro len (khuyen dung ban LTS) - https://nodejs.org
rem ============================================================
setlocal
cd /d "%~dp0"
title Cai dat Tro ly ao

where node >nul 2>&1
if errorlevel 1 (
  echo [LOI] May chua cai Node.js.
  echo       Tai ban LTS tai https://nodejs.org , cai xong mo lai file nay.
  goto :het
)
for /f "delims=" %%V in ('node -p "process.versions.node"') do set "NODEVER=%%V"
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>20||(a===20&&b>=12)?0:1)"
if errorlevel 1 (
  echo [LOI] Node.js %NODEVER% qua cu. Can ban 20.12 tro len - tai tai https://nodejs.org
  goto :het
)
echo [1/2] Node.js %NODEVER% - cai thu vien...
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 (
  echo [LOI] Cai thu vien that bai. Kiem tra mang Internet roi chay lai.
  goto :het
)

echo [2/2] File cau hinh .env
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo       Da tao file .env - hay dien ANTHROPIC_API_KEY va MAYCHU_DIACHI roi luu lai.
  start "" notepad ".env"
) else (
  echo       Da co file .env - giu nguyen.
)
echo.
echo Xong. Cac buoc tiep theo:
echo   - TaoChungChi.bat : tao chung chi HTTPS de dung micro tren dien thoai
echo   - Chay.bat        : chay thu tro ly
echo   - TuKhoiDong.bat  : cho tro ly tu chay moi khi bat may chu
:het
echo.
pause
endlocal
