#!/usr/bin/env bash
# Đóng gói lại trên Linux / macOS: build APK rồi tạo gói cài đặt LuuViTri-CaiDat.zip
#   ./donggoi.sh               build + đóng gói
#   ./donggoi.sh --bo-qua-build  chỉ đóng gói lại (dùng CaiDat/LuuViTri.apk đang có)
set -euo pipefail
cd "$(dirname "$0")"
GOC="$(pwd)"
GOI="$GOC/CaiDat"
if [ "${1:-}" != "--bo-qua-build" ]; then
  echo "== Build APK (release)"
  ./gradlew --no-daemon assembleRelease
  cp app/build/outputs/apk/release/app-release.apk "$GOI/LuuViTri.apk"
fi
[ -f "$GOI/LuuViTri.apk" ] || { echo "LỖI: thiếu $GOI/LuuViTri.apk"; exit 1; }
echo "== Chép máy chủ vào CaiDat/MayChu"
mkdir -p "$GOI/MayChu"
cp server/live-server.js server/viewer.html server/README.md "$GOI/MayChu/"
echo "== Tạo LuuViTri-CaiDat.zip"
python3 - "$GOI" "$GOC/LuuViTri-CaiDat.zip" <<'PY'
import os, sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
if os.path.exists(dst): os.remove(dst)
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        dirs[:] = sorted(d for d in dirs if d not in ('platform-tools',))
        for f in sorted(files):
            p = os.path.join(root, f)
            z.write(p, os.path.join('LuuViTri-CaiDat', os.path.relpath(p, src)))
print(dst, os.path.getsize(dst) // 1024, 'KB')
PY
