/* Cầu nối nhỏ: đọc tiếng Việt bằng eSpeak NG (đồng bộ), trả mẫu PCM 16-bit 22050 Hz cho JavaScript */
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "speak_lib.h"
static short *buf = NULL; static int n = 0, cap = 0, tanSo = 0;
static int nhan(short *wav, int num, espeak_EVENT *ev) {
  (void)ev;
  if (wav && num > 0) {
    if (n + num > cap) { int c = (n + num) * 2; short *b = (short *)realloc(buf, c * sizeof(short)); if (!b) return 1; buf = b; cap = c; }
    memcpy(buf + n, wav, num * sizeof(short)); n += num;
  }
  return 0;
}
EMSCRIPTEN_KEEPALIVE int gd_khoi(void) {
  if (tanSo > 0) return tanSo;
  tanSo = espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, NULL, 0);
  if (tanSo > 0) espeak_SetSynthCallback(nhan);
  return tanSo;
}
EMSCRIPTEN_KEEPALIVE int gd_giong(const char *ten) { return espeak_SetVoiceByName(ten); }
EMSCRIPTEN_KEEPALIVE int gd_dat(int thamSo, int giaTri) { return espeak_SetParameter((espeak_PARAMETER)thamSo, giaTri, 0); }
/* đọc văn bản UTF-8; trả số mẫu */
EMSCRIPTEN_KEEPALIVE int gd_doc(const char *chu) {
  n = 0;
  espeak_Synth(chu, strlen(chu) + 1, 0, POS_CHARACTER, 0, espeakCHARS_UTF8, NULL, NULL);
  espeak_Synchronize();
  return n;
}
EMSCRIPTEN_KEEPALIVE short *gd_mau(void) { return buf; }
