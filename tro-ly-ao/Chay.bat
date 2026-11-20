@echo off
rem Chay Tro ly ao giong noi. Dong cua so nay = tat tro ly.
cd /d "%~dp0"
title Tro ly ao giong noi
if not exist "node_modules\@anthropic-ai\sdk" (
  echo Chua cai thu vien - hay chay CaiDat.bat truoc.
  pause
  exit /b 1
)
node server.js
echo.
echo Tro ly da dung. Xem thong bao loi o tren (neu co).
pause
