#!/usr/bin/env bash
# Chạy bộ kiểm tra test/test.js với máy chủ Java của app Android (chạy ngay trên máy tính, không cần điện thoại).
#   ./test-server.sh        (cần JDK 17+ và Node.js 18+)
set -euo pipefail
cd "$(dirname "$0")"
OUT=build/desktop
rm -rf "$OUT" && mkdir -p "$OUT"
javac -nowarn -encoding UTF-8 --release 8 -Xlint:-options -d "$OUT" \
  app/src/main/java/vn/karaled/Json.java app/src/main/java/vn/karaled/KaraServer.java desktop/vn/karaled/DesktopMain.java
SERVER_CMD="java -cp $OUT vn.karaled.DesktopMain $(cd ../public && pwd)" node ../test/test.js
