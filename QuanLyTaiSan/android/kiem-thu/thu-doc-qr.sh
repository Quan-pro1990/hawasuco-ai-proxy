#!/bin/bash
# Kiểm thử phần đọc mã QR của app (DocQR.java + ZXing) trên máy tính, không cần điện thoại. Cần JDK; ZXing tải như build-apk.sh.
set -euo pipefail
GOC=$(cd "$(dirname "$0")/.." && pwd)
DEM=${XDG_CACHE_HOME:-$HOME/.cache}/quanlytaisan
ZXING=$DEM/zxing-core-3.5.3.jar
if [ ! -f "$ZXING" ]; then
  mkdir -p "$DEM"
  curl -fsSL --retry 3 -o "$ZXING" https://repo1.maven.org/maven2/com/google/zxing/core/3.5.3/core-3.5.3.jar
fi
echo "8d8064c1636fdaef7189dd9055c7d59950a8940a12f2293956446ec3c109fd82  $ZXING" | sha256sum -c --status || { echo "Sai SHA-256: $ZXING" >&2; exit 1; }
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
javac -encoding UTF-8 -nowarn -d "$TMP" -classpath "$ZXING" "$GOC/app/src/main/java/vn/com/hawasuco/taisan/DocQR.java" "$GOC/kiem-thu/ThuDocQR.java"
java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$TMP:$ZXING" vn.com.hawasuco.taisan.ThuDocQR
