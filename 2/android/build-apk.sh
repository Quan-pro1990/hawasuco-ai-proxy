#!/bin/bash
# Build app Android ThatThoatNuoc-DienThoai.apk KHÔNG cần Gradle / Android Studio (Linux).
# Cần: JDK 11+ và các gói Ubuntu/Debian: android-sdk-platform-23 aapt dalvik-exchange zipalign apksigner
#   sudo apt-get install -y default-jdk-headless android-sdk-platform-23 aapt dalvik-exchange zipalign apksigner
# Dùng:  ./build-apk.sh [file-ra.apk]      (mặc định ../ThatThoatNuoc-DienThoai.apk, cạnh ThatThoatNuoc.exe)
# Khoá ký ở ky-app/thatthoat.jks (tự tạo lần đầu, KHÔNG đưa lên GitHub). Giữ file này để bản sau cài đè được bản trước.
set -euo pipefail
GOC=$(cd "$(dirname "$0")" && pwd)
APP=$GOC/app/src/main
ANDROID_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
RA=${1:-$GOC/../ThatThoatNuoc-DienThoai.apk}
PHIEN_BAN=$(sed -n "s/.*versionName *'\(.*\)'.*/\1/p" $GOC/app/build.gradle)
MA=$(sed -n "s/.*versionCode *\([0-9]*\).*/\1/p" $GOC/app/build.gradle)
MIN_SDK=$(sed -n "s/.*minSdk *\([0-9]*\).*/\1/p" $GOC/app/build.gradle)
TARGET_SDK=$(sed -n "s/.*targetSdk *\([0-9]*\).*/\1/p" $GOC/app/build.gradle)
KY=${KY:-$GOC/ky-app/thatthoat.jks}
MK=${KY_MATKHAU:-thatthoat-hawasuco}
DX=$(command -v d8 || command -v dalvik-exchange || command -v dx)

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/gen" "$TMP/classes"
# Gradle lấy tên gói từ build.gradle (namespace); aapt cần ghi trong manifest
sed 's#<manifest #<manifest package="vn.com.hawasuco.thatthoat" #' "$APP/AndroidManifest.xml" > "$TMP/AndroidManifest.xml"

echo "== aapt: tài nguyên, manifest (phiên bản $PHIEN_BAN, mã $MA, minSdk $MIN_SDK, targetSdk $TARGET_SDK)"
aapt package -f -m -J "$TMP/gen" -M "$TMP/AndroidManifest.xml" -S "$APP/res" -I "$ANDROID_JAR" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" --version-code "$MA" --version-name "$PHIEN_BAN" \
  -F "$TMP/app.unaligned.apk"

echo "== javac"
javac --release 8 -encoding UTF-8 -nowarn -Xlint:-options -d "$TMP/classes" -classpath "$ANDROID_JAR" \
  "$TMP"/gen/vn/com/hawasuco/thatthoat/R.java "$APP"/java/vn/com/hawasuco/thatthoat/*.java

echo "== dex ($DX)"
if [[ "$DX" == *d8 ]]; then
  "$DX" --min-api "$MIN_SDK" --lib "$ANDROID_JAR" --output "$TMP" $(find "$TMP/classes" -name '*.class')
else
  "$DX" --dex --min-sdk-version="$MIN_SDK" --output="$TMP/classes.dex" "$TMP/classes"
fi
(cd "$TMP" && aapt add app.unaligned.apk classes.dex > /dev/null)
zipalign -f 4 "$TMP/app.unaligned.apk" "$TMP/app.aligned.apk"

if [ ! -f "$KY" ]; then
  echo "== tạo khoá ký mới: $KY  (giữ lại file này cho các bản sau)"
  mkdir -p "$(dirname "$KY")"
  keytool -genkeypair -keystore "$KY" -storetype PKCS12 -storepass "$MK" -keypass "$MK" -alias thatthoat \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=That thoat nuoc, O=HAWASUCO, C=VN"
fi
echo "== ký"
apksigner sign --ks "$KY" --ks-pass "pass:$MK" --ks-key-alias thatthoat --key-pass "pass:$MK" --out "$RA" "$TMP/app.aligned.apk"
apksigner verify "$RA"
rm -f "$RA.idsig"
echo "Đã tạo: $RA"
