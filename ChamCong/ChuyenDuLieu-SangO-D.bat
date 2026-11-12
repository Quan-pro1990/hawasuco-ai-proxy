@echo off
rem Chuyen du lieu va ban sao luu cua phan mem cham cong tren may chu tu o C sang o D (D:\ChamCongData)
rem de khong day o C. Bo cai chep du lieu, kiem tra tung tep roi moi xoa ban tren o C;
rem tai khoan, du lieu giu nguyen. Phan mem tam dung khoang 1 phut.
rem Chon o khac: ChuyenDuLieu-SangO-D.bat -DuLieu E:\ChamCongData
if "%~1"=="" (
  call "%~dp0iis\CaiDat-IIS.bat" -ChuyenSangD
) else (
  call "%~dp0iis\CaiDat-IIS.bat" %*
)
