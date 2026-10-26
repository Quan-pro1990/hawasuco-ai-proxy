#!/bin/sh
# Biên dịch trên Linux / macOS bằng Mono (để phát triển, chạy thử): ./build.sh
#   → QuanLyTaiSan.exe, HUONG-DAN-CAI-DAT.html (từ trien-khai/HUONG_DAN_MAY_CHU.md),
#     gói máy chủ dist/quanlytaisan-may-chu/ và dist/quanlytaisan-may-chu-<phiên bản>.zip (cần Node.js 18+)
# Chạy thử: mono QuanLyTaiSan.exe   (hoặc QLTS_WEB=web mono QuanLyTaiSan.exe để sửa giao diện không cần biên dịch lại)
# -langversion:5 giữ mã nguồn dịch được bằng csc.exe có sẵn trong Windows (C# 5).
set -e
cd "$(dirname "$0")"
RES=""
for f in web/*; do RES="$RES -resource:$f,QuanLyTaiSan.web.$(basename "$f")"; done
mcs -langversion:5 -target:exe -codepage:utf8 -warn:4 -optimize+ -out:QuanLyTaiSan.exe -win32icon:src/app.ico $RES \
  -r:System.dll -r:System.Core.dll -r:System.Xml.dll -r:System.Xml.Linq.dll -r:System.IO.Compression.dll \
  -r:System.IO.Compression.FileSystem.dll -r:System.Web.Extensions.dll src/*.cs
echo "Da tao: QuanLyTaiSan.exe"
node tools/dong-goi.mjs
