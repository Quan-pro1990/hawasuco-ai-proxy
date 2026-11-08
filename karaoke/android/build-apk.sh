#!/usr/bin/env bash
# Đóng gói KaraLED.apk bằng bộ công cụ Android SDK (không cần Gradle / Android Studio).
#
#   ANDROID_HOME=/duong/dan/android-sdk ./build-apk.sh
#
# Cần: JDK 17+, Android SDK có "platforms;android-34" và "build-tools;35.0.0" (d8 bản 34 lỗi với JDK 21).
# Khóa ký app: android/keystore/karaled.jks (tự tạo lần đầu, KHÔNG đưa lên GitHub).
# Cài bản mới đè lên bản cũ chỉ được khi ký cùng một khóa: hãy giữ file khóa này.
set -euo pipefail
cd "$(dirname "$0")"

VERSION_CODE=${VERSION_CODE:-1}
VERSION_NAME=${VERSION_NAME:-1.0}
BT_VER=${BT_VER:-35.0.0}
SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
[ -n "$SDK" ] || { echo "Chưa đặt ANDROID_HOME (thư mục Android SDK)"; exit 1; }
BT="$SDK/build-tools/$BT_VER"
PLAT="$SDK/platforms/android-34/android.jar"
[ -x "$BT/aapt2" ] && [ -f "$PLAT" ] || { echo "Thiếu build-tools;$BT_VER hoặc platforms;android-34 trong $SDK"; exit 1; }

OUT=build
rm -rf "$OUT"
mkdir -p "$OUT/assets/web" "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "[1/6] Chép giao diện web (karaoke/public) vào assets"
cp -r ../public/. "$OUT/assets/web/"

echo "[2/6] Biên dịch tài nguyên"
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android">#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="vn.karaled">#' \
  app/src/main/AndroidManifest.xml > "$OUT/AndroidManifest.xml"
"$BT/aapt2" compile --dir app/src/main/res -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$PLAT" --manifest "$OUT/AndroidManifest.xml" \
  --min-sdk-version 21 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$OUT/assets" --java "$OUT/gen" "$OUT/res.zip"

echo "[3/6] Biên dịch Java"
javac -nowarn -encoding UTF-8 --release 8 -Xlint:-options -cp "$PLAT" -d "$OUT/classes" \
  app/src/main/java/vn/karaled/*.java "$OUT/gen/vn/karaled/R.java"

echo "[4/6] Chuyển sang DEX"
"$BT/d8" --release --min-api 21 --lib "$PLAT" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

echo "[5/6] Ghép APK"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "[6/6] Ký APK"
KS=keystore/karaled.jks
KS_PASS=${KS_PASS:-karaled}
if [ ! -f "$KS" ]; then
  mkdir -p keystore
  keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias karaled \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=KaraLED, O=KaraLED, C=VN" >/dev/null 2>&1
  echo "      Đã tạo khóa ký mới: $KS (giữ lại để cập nhật app sau này)"
fi
"$BT/apksigner" sign --v4-signing-enabled false --ks "$KS" --ks-pass "pass:$KS_PASS" --ks-key-alias karaled --out ../KaraLED.apk "$OUT/aligned.apk"
"$BT/apksigner" verify ../KaraLED.apk
echo "Xong: karaoke/KaraLED.apk ($(du -h ../KaraLED.apk | cut -f1))"
