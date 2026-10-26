#!/bin/bash
# Build app Android QuanLyTaiSan-DienThoai.apk KHÔNG cần Gradle / Android Studio (Linux).
# Cần: JDK 11+ và các gói Ubuntu/Debian: aapt dalvik-exchange zipalign apksigner
#   sudo apt-get install -y default-jdk-headless aapt dalvik-exchange zipalign apksigner
# android.jar (API 34) lấy từ Android SDK ($ANDROID_HOME) nếu có, không thì tải về ~/.cache/quanlytaisan (chỉ để biên dịch);
# ZXing core 3.5.3 (đọc mã QR) tải từ Maven Central. Cả hai được kiểm tra SHA-256.
# Dùng:  ./build-apk.sh [file-ra.apk]       (mặc định ../QuanLyTaiSan-DienThoai.apk, cạnh QuanLyTaiSan.exe)
#        GO_LOI=1 ./build-apk.sh thu.apk    bản gỡ lỗi (debuggable, bật gỡ lỗi WebView) — chỉ để kiểm thử
# Khoá ký ở ky-app/quanlytaisan.jks (tự tạo lần đầu, KHÔNG đưa lên GitHub). Giữ file này để bản sau cài đè được bản trước.
set -euo pipefail
GOC=$(cd "$(dirname "$0")" && pwd)
APP=$GOC/app/src/main
GOI=vn.com.hawasuco.taisan
RA=${1:-$GOC/../QuanLyTaiSan-DienThoai.apk}
DEM=${XDG_CACHE_HOME:-$HOME/.cache}/quanlytaisan
mkdir -p "$DEM"

PHIEN_BAN=$(sed -n "s/^ *versionName *'\(.*\)'.*/\1/p" "$GOC/app/build.gradle")
MA=$(sed -n "s/^ *versionCode *\([0-9][0-9]*\).*/\1/p" "$GOC/app/build.gradle")
MIN_SDK=$(sed -n "s/^ *minSdk *\([0-9][0-9]*\).*/\1/p" "$GOC/app/build.gradle")
TARGET_SDK=$(sed -n "s/^ *targetSdk *\([0-9][0-9]*\).*/\1/p" "$GOC/app/build.gradle")
KY=${KY:-$GOC/ky-app/quanlytaisan.jks}
MK=${KY_MATKHAU:-quanlytaisan-hawasuco}

# tải file (nếu chưa có) và kiểm tra SHA-256
tai() {
  local tep=$1 url=$2 sha=$3
  if [ ! -f "$tep" ] || ! echo "$sha  $tep" | sha256sum -c --status; then
    echo "== tải $url"
    curl -fsSL --retry 3 -o "$tep.tmp" "$url"
    echo "$sha  $tep.tmp" | sha256sum -c --status || { echo "Sai SHA-256: $url" >&2; rm -f "$tep.tmp"; exit 1; }
    mv "$tep.tmp" "$tep"
  fi
}

if [ -z "${ANDROID_JAR:-}" ]; then
  for d in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" /usr/lib/android-sdk; do
    if [ -n "$d" ] && [ -f "$d/platforms/android-$TARGET_SDK/android.jar" ]; then ANDROID_JAR=$d/platforms/android-$TARGET_SDK/android.jar; break; fi
  done
fi
if [ -z "${ANDROID_JAR:-}" ]; then
  ANDROID_JAR=$DEM/android-34.jar
  tai "$ANDROID_JAR" https://raw.githubusercontent.com/Sable/android-platforms/master/android-34/android.jar \
    6cea1df3efb77103ac3e2beb9bf4718964b0e0869ab16d39d29d5cbae1c147ad
fi
ZXING=$DEM/zxing-core-3.5.3.jar
tai "$ZXING" https://repo1.maven.org/maven2/com/google/zxing/core/3.5.3/core-3.5.3.jar \
  8d8064c1636fdaef7189dd9055c7d59950a8940a12f2293956446ec3c109fd82
DX=$(command -v d8 || command -v dalvik-exchange || command -v dx)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/gen" "$TMP/classes"
# Gradle lấy tên gói từ build.gradle (namespace); aapt cần ghi trong manifest
sed "s#<manifest #<manifest package=\"$GOI\" #" "$APP/AndroidManifest.xml" > "$TMP/AndroidManifest.xml"
GO=()
if [ -n "${GO_LOI:-}" ]; then GO=(--debug-mode); echo "== bản gỡ lỗi (debuggable)"; fi

echo "== aapt: tài nguyên, manifest (phiên bản $PHIEN_BAN, mã $MA, minSdk $MIN_SDK, targetSdk $TARGET_SDK)"
aapt package -f -m -J "$TMP/gen" -M "$TMP/AndroidManifest.xml" -S "$APP/res" -I "$ANDROID_JAR" "${GO[@]}" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" --version-code "$MA" --version-name "$PHIEN_BAN" \
  -F "$TMP/app.unaligned.apk"

echo "== javac"
javac --release 8 -encoding UTF-8 -nowarn -Xlint:-options -d "$TMP/classes" -classpath "$ANDROID_JAR:$ZXING" \
  "$TMP"/gen/vn/com/hawasuco/taisan/R.java "$APP"/java/vn/com/hawasuco/taisan/*.java

# ZXing: chỉ lấy phần đọc mã QR (bỏ mã vạch 1D, PDF417, Aztec, DataMatrix…) cho APK nhỏ
(cd "$TMP/classes" && unzip -qo "$ZXING" 'com/google/zxing/*.class' 'com/google/zxing/common/*' 'com/google/zxing/qrcode/*')

echo "== dex ($DX)"
if [[ "$DX" == *d8 ]]; then
  "$DX" --release --min-api "$MIN_SDK" --lib "$ANDROID_JAR" --output "$TMP" $(find "$TMP/classes" -name '*.class')
else
  "$DX" --dex --min-sdk-version="$MIN_SDK" --output="$TMP/classes.dex" "$TMP/classes"
fi
(cd "$TMP" && aapt add app.unaligned.apk classes.dex > /dev/null)
zipalign -f 4 "$TMP/app.unaligned.apk" "$TMP/app.aligned.apk"

if [ ! -f "$KY" ]; then
  echo "== tạo khoá ký mới: $KY  (giữ lại file này cho các bản sau)"
  mkdir -p "$(dirname "$KY")"
  keytool -genkeypair -keystore "$KY" -storetype PKCS12 -storepass "$MK" -keypass "$MK" -alias quanlytaisan \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Quan ly tai san, O=HAWASUCO, C=VN"
fi
echo "== ký"
apksigner sign --ks "$KY" --ks-pass "pass:$MK" --ks-key-alias quanlytaisan --key-pass "pass:$MK" --out "$RA" "$TMP/app.aligned.apk"
apksigner verify "$RA"
rm -f "$RA.idsig"
echo "Đã tạo: $RA ($(du -k "$RA" | cut -f1) KB)"
