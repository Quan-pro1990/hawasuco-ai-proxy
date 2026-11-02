#!/usr/bin/env bash
# Build HawasucoCamera.apk không cần Android Studio / Gradle.
# Cần (Ubuntu/Debian): sudo apt install openjdk-17-jdk android-sdk-platform-23 aapt dalvik-exchange zipalign apksigner
#
# Khoá ký ứng dụng: ky-ung-dung.jks (KHÔNG đưa lên GitHub). Các bản cập nhật phải ký cùng khoá này
# thì điện thoại mới cài đè lên bản cũ được; mất khoá thì phải gỡ app cũ rồi cài lại.
# Mật khẩu khoá lấy từ biến môi trường KEYSTORE_PASS (mặc định: hawasuco).
set -euo pipefail
cd "$(dirname "$0")"

SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
PLATFORM=$SDK/platforms/android-23/android.jar
KEYSTORE=${KEYSTORE:-ky-ung-dung.jks}
PASS=${KEYSTORE_PASS:-hawasuco}
OUT=build
APK=HawasucoCamera.apk

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes"

echo "[1/5] Đóng gói tài nguyên"
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$PLATFORM" -F "$OUT/res.apk"

echo "[2/5] Biên dịch Java"
javac -nowarn -Xlint:-options -encoding UTF-8 -source 8 -target 8 -bootclasspath "$PLATFORM" \
    -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')

echo "[3/5] Chuyển sang dex"
dalvik-exchange --dex --min-sdk-version=23 --output="$OUT/classes.dex" "$OUT/classes"

echo "[4/5] Ghép APK"
cp "$OUT/res.apk" "$OUT/unsigned.apk"
(cd "$OUT" && aapt add -k unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "[5/5] Ký APK"
if [ ! -f "$KEYSTORE" ]; then
    echo "  Chưa có khoá ký, tạo mới: $KEYSTORE"
    keytool -genkeypair -keystore "$KEYSTORE" -alias hawasuco -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass "$PASS" -keypass "$PASS" -dname "CN=HAWASUCO Camera, O=HAWASUCO, C=VN"
fi
apksigner sign --ks "$KEYSTORE" --ks-key-alias hawasuco --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
    --out "$APK" "$OUT/aligned.apk"
apksigner verify "$APK"
rm -f "$APK.idsig"
echo "Xong: $(pwd)/$APK"
