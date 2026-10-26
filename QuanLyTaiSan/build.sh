#!/bin/sh
# Biên dịch trên Linux / macOS bằng Mono (để phát triển, chạy thử): ./build.sh
#   → QuanLyTaiSan.exe, HUONG-DAN-CAI-DAT.html (từ trien-khai/HUONG_DAN_MAY_CHU.md),
#     gói máy chủ dist/quanlytaisan-may-chu/ và dist/quanlytaisan-may-chu-<phiên bản>.zip (cần Node.js 18+)
# Chạy thử: mono QuanLyTaiSan.exe   (hoặc QLTS_WEB=web mono QuanLyTaiSan.exe để sửa giao diện không cần biên dịch lại)
# -langversion:5 giữ mã nguồn dịch được bằng csc.exe có sẵn trong Windows (C# 5).
# Biên dịch theo thư viện tham chiếu .NET Framework 4.5 (gói NuGet Microsoft.NETFramework.ReferenceAssemblies.net45,
# tải 1 lần vào ~/.cache), KHÔNG theo thư viện của Mono: Mono có thêm hàm của .NET Core (vd String.TrimEnd(char)) mà
# .NET Framework trên Windows không có — file .exe sẽ lỗi MissingMethodException khi chạy trên máy chủ.
set -e
cd "$(dirname "$0")"
REF="${QLTS_NET45:-$HOME/.cache/quanlytaisan/net45}"
if [ ! -f "$REF/mscorlib.dll" ]; then
  echo "Tai thu vien tham chieu .NET Framework 4.5 (NuGet) vao $REF ..."
  TAM=$(mktemp -d)
  curl -fsSL -o "$TAM/goi.nupkg" \
    https://api.nuget.org/v3-flatcontainer/microsoft.netframework.referenceassemblies.net45/1.0.3/microsoft.netframework.referenceassemblies.net45.1.0.3.nupkg
  unzip -q -o "$TAM/goi.nupkg" 'build/.NETFramework/v4.5/*.dll' -d "$TAM/x"
  mkdir -p "$REF"
  cp "$TAM"/x/build/.NETFramework/v4.5/*.dll "$REF"/
  rm -rf "$TAM"
fi
RES=""
for f in web/*; do RES="$RES -resource:$f,QuanLyTaiSan.web.$(basename "$f")"; done
mcs -noconfig -nostdlib -langversion:5 -target:exe -codepage:utf8 -warn:4 -optimize+ -out:QuanLyTaiSan.exe -win32icon:src/app.ico $RES \
  -r:"$REF/mscorlib.dll" -r:"$REF/System.dll" -r:"$REF/System.Core.dll" -r:"$REF/System.Xml.dll" -r:"$REF/System.Xml.Linq.dll" \
  -r:"$REF/System.IO.Compression.dll" -r:"$REF/System.IO.Compression.FileSystem.dll" -r:"$REF/System.Web.Extensions.dll" src/*.cs
echo "Da tao: QuanLyTaiSan.exe"
node tools/dong-goi.mjs
