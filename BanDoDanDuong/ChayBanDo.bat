@echo off
rem ============================================================
rem  Chay ban do dan duong HawaMap tren may nay.
rem  Can cai Node.js (https://nodejs.org) phien ban 18 tro len.
rem  Mo trinh duyet tai http://localhost:8080
rem ============================================================
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [LOI] May chua cai Node.js. Tai tai https://nodejs.org roi chay lai file nay.
  pause
  exit /b 1
)
start "" http://localhost:8080
node server.js
pause
