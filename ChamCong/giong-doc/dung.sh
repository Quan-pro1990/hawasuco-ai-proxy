#!/bin/sh
# Dựng lại bộ đọc tiếng Việt tích hợp (eSpeak NG 1.51 -> WebAssembly, chỉ kèm dữ liệu tiếng Việt).
# Cần (Ubuntu 24.04):  apt-get install emscripten espeak-ng-data   và mã nguồn espeak-ng 1.51:  apt-get source espeak-ng
# Chạy:  sh giong-doc/dung.sh <thư mục mã nguồn espeak-ng-1.51>
#   -> giong-doc/espeakng-vi.js (mã nạp) + giong-doc/espeakng-vi.wasm (bộ đọc + dữ liệu tiếng Việt); rồi chạy node build.js
set -e
NGUON=$(cd "$1" && pwd)
DICH=$(cd "$(dirname "$0")" && pwd)
DL=${ESPEAK_NG_DATA:-/usr/lib/x86_64-linux-gnu/espeak-ng-data}
TAM=$(mktemp -d)
mkdir -p "$TAM/espeak-ng-data/lang/aav" "$TAM/espeak-ng-data/voices/!v"
cp "$DL/phondata" "$DL/phonindex" "$DL/phontab" "$DL/intonations" "$DL/vi_dict" "$TAM/espeak-ng-data/"
cp "$DL"/lang/aav/vi* "$TAM/espeak-ng-data/lang/aav/"
cp "$DL/voices/!v/f2" "$DL/voices/!v/f3" "$DL/voices/!v/f4" "$TAM/espeak-ng-data/voices/!v/"
printf '#define PACKAGE_VERSION "1.51"\n#define VERSION "1.51"\n#define PACKAGE_NAME "eSpeak NG"\n#define PACKAGE "espeak-ng"\n' > "$TAM/config.h"
cd "$NGUON"
SRC="src/ucd-tools/src/case.c src/ucd-tools/src/categories.c src/ucd-tools/src/ctype.c src/ucd-tools/src/proplist.c src/ucd-tools/src/scripts.c src/ucd-tools/src/tostring.c"
for f in compiledict dictionary encoding error espeak_api ieee80 intonation mnemonics numbers readclause phoneme phonemelist setlengths soundicon spect speech ssml synthdata synthesize synth_mbrola translate tr_languages voices wavegen; do SRC="$SRC src/libespeak-ng/$f.c"; done
emcc -O3 -I"$TAM" -Isrc/include -Isrc/include/espeak-ng -Isrc/ucd-tools/src/include -Isrc/libespeak-ng \
  -DPATH_ESPEAK_DATA='"/espeak-ng-data"' -DHAVE_CONFIG_H -Wno-everything $SRC "$DICH/giongdoc_glue.c" -o "$DICH/espeakng-vi.js" \
  -s MODULARIZE=1 -s EXPORT_NAME=GiongDocVN -s ENVIRONMENT=web,node -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=1 -s EXIT_RUNTIME=0 \
  -s EXPORTED_FUNCTIONS='["_gd_khoi","_gd_giong","_gd_dat","_gd_doc","_gd_mau","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["HEAP16","HEAPU8"]' \
  --embed-file "$TAM/espeak-ng-data@/espeak-ng-data"
rm -rf "$TAM"
ls -l "$DICH/espeakng-vi.js" "$DICH/espeakng-vi.wasm"
