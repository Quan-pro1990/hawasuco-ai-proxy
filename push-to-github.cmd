@echo off
rem ============================================================
rem  push-to-github.cmd
rem  Tu dong day TOAN BO thu muc chua file nay len GitHub.
rem  Khong can tai repo ve may truoc.
rem
rem  Noi dung tren GitHub se bi DE BANG dung noi dung thu muc nay:
rem  file nao co tren GitHub ma khong co o day se bi xoa khoi repo.
rem  Lich su cu van duoc giu tren GitHub, co the khoi phuc khi can.
rem
rem  Cach dung:
rem    1. Dat file nay vao thu muc goc muon dua len GitHub.
rem    2. Nhay dup de chay. Hoac chay trong CMD kem ghi chu:
rem         push-to-github.cmd "Sua loi doc chi so"
rem
rem  Yeu cau: da cai Git for Windows - https://git-scm.com/download/win
rem  Lan dau day len, Git se mo trinh duyet de dang nhap GitHub.
rem
rem  File .env (chua API key that) luon bi chan, khong bao gio bi day len.
rem ============================================================
setlocal EnableExtensions

rem ----- Cau hinh: doi REPO_URL neu dung cho repo khac -----
set "REPO_URL=https://github.com/Quan-pro1990/hawasuco-ai-proxy.git"
set "DEFAULT_BRANCH=main"

cd /d "%~dp0"
title Day len GitHub

echo ==================================================
echo   DAY THU MUC LEN GITHUB
echo   Thu muc : %CD%
echo ==================================================
echo.

rem ---------- 1. Kiem tra Git ----------
where git >nul 2>&1
if errorlevel 1 (
    echo [LOI] May chua cai Git.
    echo       Tai va cai dat tai: https://git-scm.com/download/win
    echo       Cai xong, dong cua so nay roi chay lai file nay.
    goto :fail
)

call :ensure_config user.name  "Nhap ten cua ban - hien thi tren commit: "
call :ensure_config user.email "Nhap email tai khoan GitHub: "

rem ---------- 2. Khoi tao Git neu chay lan dau ----------
if exist ".git" goto :have_repo
echo [1/4] Lan dau chay: khoi tao Git trong thu muc nay...
git init -q
if errorlevel 1 goto :fail
git symbolic-ref HEAD refs/heads/%DEFAULT_BRANCH%

:have_repo
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin "%REPO_URL%"

set "BRANCH="
for /f "delims=" %%B in ('git symbolic-ref --short -q HEAD') do set "BRANCH=%%B"
if not defined BRANCH set "BRANCH=%DEFAULT_BRANCH%"

rem Tao .gitignore neu chua co, de khong lo day file bi mat / rac
if not exist ".gitignore" (
    echo [*] Tao file .gitignore...
    > ".gitignore" (
        echo # Bi mat - chua API key that, KHONG duoc day len GitHub
        echo .env
        echo .env.*
        echo !.env.example
        echo.
        echo # Thu vien cai bang npm
        echo node_modules/
        echo.
        echo # Log / rac he dieu hanh
        echo *.log
        echo .DS_Store
        echo Thumbs.db
    )
)

rem ---------- 3. Lay ban moi nhat tren GitHub ----------
rem Chi dich lich su toi ban moi nhat tren GitHub, file tren may giu nguyen.
rem Nho vay commit tiep theo de noi dung GitHub bang dung thu muc nay,
rem khong bao gio bi xung dot va khong can force-push.
echo [2/4] Lay thong tin moi nhat tu GitHub...
git ls-remote --exit-code --heads origin %BRANCH% >nul
set "RC=%errorlevel%"
if "%RC%"=="2" (
    echo       Tren GitHub chua co nhanh %BRANCH%, se tao moi.
    goto :stage
)
if not "%RC%"=="0" goto :fail_remote
git fetch -q origin %BRANCH%
if errorlevel 1 goto :fail_remote
git reset -q origin/%BRANCH%
if errorlevel 1 goto :fail

rem ---------- 4. Gom thay doi va commit ----------
:stage
echo [3/4] Gom cac thay doi...
git add -A
if errorlevel 1 goto :fail

rem Chot chan cuoi: go file .env khoi danh sach neu lo bi them vao
for /f "delims=" %%F in ('git ls-files -- ".env" "*/.env"') do (
    echo [CANH BAO] Bo qua file bi mat: %%F
    git rm -q --cached -- "%%F"
)

git diff --cached --quiet
if not errorlevel 1 (
    echo       Khong co thay doi moi nao, GitHub da giong het thu muc nay.
    goto :done
)

echo.
echo Cac file se duoc cap nhat tren GitHub:
echo   A = them moi, M = sua, D = xoa, R = doi ten/di chuyen
git status --short
echo.

set "MSG=%~1"
if not defined MSG set /p "MSG=Nhap ghi chu - Enter de dung mac dinh, Ctrl+C de huy: "
if not defined MSG set "MSG=Cap nhat %date% %time:~0,8%"
set "MSG=%MSG:"='%"

git commit -q -m "%MSG%"
if errorlevel 1 goto :fail

rem ---------- 5. Day len GitHub ----------
echo [4/4] Day len GitHub, nhanh %BRANCH%...
git push -u origin %BRANCH%
if errorlevel 1 goto :fail_push

set "WEB_URL="
for /f "delims=" %%U in ('git remote get-url origin') do set "WEB_URL=%%U"
if defined WEB_URL set "WEB_URL=%WEB_URL:.git=%"

echo.
echo ==================================================
echo   THANH CONG! Xem tren GitHub:
echo   %WEB_URL%
echo ==================================================

:done
echo.
pause
endlocal
exit /b 0

rem ============================================================
rem  Cac ham phu
rem ============================================================

:ensure_config
git config %1 >nul 2>&1
if not errorlevel 1 exit /b 0
set "VAL="
:ensure_config_ask
set /p "VAL=%~2"
if not defined VAL goto :ensure_config_ask
git config --global %1 "%VAL%"
exit /b 0

:fail_remote
echo.
echo [LOI] Khong ket noi duoc toi repo tren GitHub.
echo       - Kiem tra mang Internet.
echo       - Kiem tra REPO_URL o dau file nay co dung khong.
echo       - Neu repo rieng tu: dang nhap dung tai khoan co quyen.
goto :fail

:fail_push
echo.
echo [LOI] Day len GitHub that bai.
echo       - Neu bi hoi dang nhap: dang nhap tai khoan GitHub co quyen ghi repo.
echo       - Neu bao "rejected": vua co nguoi cap nhat cung luc, chay lai file nay.
goto :fail

:fail
echo.
echo Thao tac CHUA hoan tat. Xem thong bao loi o tren.
echo.
pause
endlocal
exit /b 1
