#!/bin/bash
# Đóng gói bản phát hành vào ../PhatHanh:
#   ChinhAnhAI-<phiên bản>-CaiDat.exe   bộ cài Windows (NSIS)
#   ChinhAnhAI-<phiên bản>-DiDong.zip   bản chạy ngay không cần cài
#   HUONG_DAN.pdf                        hướng dẫn cài đặt và chỉnh ảnh
#   SHA256SUMS.txt                       mã kiểm tra tệp tải về
# Cần: ../ChinhAnhAI.exe (tạo bằng build.bat), makensis (NSIS 3), zip, sha256sum.
# Có Node + Playwright thì tạo lại PDF từ HuongDan/huong_dan.html; không thì dùng PDF có sẵn.
set -euo pipefail
cd "$(dirname "$0")"
PB=$(grep -o 'PhienBan = "[^"]*"' ../src/ThongSo.cs | cut -d'"' -f2)
RA=../PhatHanh
mkdir -p "$RA"
[ -f ../ChinhAnhAI.exe ] || { echo "Thiếu ../ChinhAnhAI.exe — chạy build.bat trước"; exit 1; }

if command -v node >/dev/null && node -e "require('playwright')" 2>/dev/null; then
  node tao_pdf.js "$RA/HUONG_DAN.pdf"
fi
[ -f "$RA/HUONG_DAN.pdf" ] || { echo "Thiếu $RA/HUONG_DAN.pdf"; exit 1; }

makensis -V2 -DPHIEN_BAN_RA="$PB" ChinhAnhAI.nsi
echo "Đã tạo: $RA/ChinhAnhAI-$PB-CaiDat.exe"

TAM=$(mktemp -d)
mkdir "$TAM/ChinhAnhAI"
cp ../ChinhAnhAI.exe ../GIAY_PHEP_BEN_THU_BA.txt "$RA/HUONG_DAN.pdf" "$TAM/ChinhAnhAI/"
cp DOC_TRUOC.txt "$TAM/ChinhAnhAI/DOC_TRUOC.txt"   # tên không dấu: giải nén trên Windows không lỗi
rm -f "$RA/ChinhAnhAI-$PB-DiDong.zip"
(cd "$TAM" && zip -q -r -X "$OLDPWD/$RA/ChinhAnhAI-$PB-DiDong.zip" ChinhAnhAI)
rm -r "$TAM"
echo "Đã tạo: $RA/ChinhAnhAI-$PB-DiDong.zip"

(cd "$RA" && sha256sum "ChinhAnhAI-$PB-CaiDat.exe" "ChinhAnhAI-$PB-DiDong.zip" HUONG_DAN.pdf > SHA256SUMS.txt)
cat "$RA/SHA256SUMS.txt"
