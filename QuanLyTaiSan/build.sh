#!/bin/sh
# Biên dịch trên Linux / macOS bằng Mono (để phát triển, chạy thử): ./build.sh  → QuanLyTaiSan.exe
# Chạy thử: mono QuanLyTaiSan.exe   (hoặc QLTS_WEB=web mono QuanLyTaiSan.exe để sửa giao diện không cần biên dịch lại)
# -langversion:5 giữ mã nguồn dịch được bằng csc.exe có sẵn trong Windows (C# 5).
set -e
cd "$(dirname "$0")"
RES=""
for f in web/*; do RES="$RES -resource:$f,QuanLyTaiSan.web.$(basename "$f")"; done
mcs -langversion:5 -target:exe -codepage:utf8 -warn:4 -optimize+ -out:QuanLyTaiSan.exe -win32icon:src/app.ico $RES \
  -r:System.dll -r:System.Core.dll -r:System.Xml.dll -r:System.Xml.Linq.dll -r:System.IO.Compression.dll \
  -r:System.IO.Compression.FileSystem.dll -r:System.Web.Extensions.dll src/*.cs
mkdir -p GoiCaiDat-IIS/web
cp QuanLyTaiSan.exe GoiCaiDat-IIS/web/QuanLyTaiSan.exe
cp iis/web.config GoiCaiDat-IIS/web/web.config
cp iis/CaiDat-IIS.bat iis/CaiDat-IIS.ps1 iis/HUONG_DAN_IIS.txt GoiCaiDat-IIS/
echo "Da tao: QuanLyTaiSan.exe va GoiCaiDat-IIS/"
