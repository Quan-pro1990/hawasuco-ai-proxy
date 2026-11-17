package vn.com.hawasuco.taisan;

import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Giọng nói cho Trợ lý ảo Hawasuco trong trang web (WebView không có Web Speech API):
 * <ul>
 * <li>nghe: nhận dạng giọng nói tiếng Việt của Android (SpeechRecognizer) → window.ungDungNghe({tam|xong|loi|het});</li>
 * <li>đọc: TextToSpeech tiếng Việt → window.ungDungDocXong() khi đọc xong.</li>
 * </ul>
 * Mọi hàm gọi trên luồng giao diện.
 */
class GiongNoi {
    final MainActivity hd;
    SpeechRecognizer nhan;
    boolean dangNghe;
    TextToSpeech tts;
    boolean ttsSan, ttsLoi, daBaoThieuGiong;
    String choDoc, idDoc = "";
    int soDoc;

    GiongNoi(MainActivity hd) { this.hd = hd; }

    void baoNghe(String khoa, String gt) {
        JSONObject j = new JSONObject();
        try { j.put(khoa, gt); } catch (Exception e) { /* không xảy ra */ }
        hd.goiJs("ungDungNghe", j.toString());
    }

    // ------------------------------------------------------------------ nghe

    void nghe() {
        dungDoc();
        if (!SpeechRecognizer.isRecognitionAvailable(hd)) {
            baoNghe("loi", "khong-ho-tro");
            return;
        }
        if (nhan == null) {
            nhan = SpeechRecognizer.createSpeechRecognizer(hd);
            nhan.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle b) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float v) { }
                @Override public void onBufferReceived(byte[] b) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onEvent(int loai, Bundle b) { }

                @Override
                public void onPartialResults(Bundle b) {
                    String s = dauTien(b);
                    if (s != null) baoNghe("tam", s);
                }

                @Override
                public void onResults(Bundle b) {
                    dangNghe = false;
                    String s = dauTien(b);
                    if (s == null || s.trim().length() == 0) baoNghe("loi", "no-speech");
                    else baoNghe("xong", s);
                }

                @Override
                public void onError(int loi) {
                    dangNghe = false;
                    switch (loi) {
                        case SpeechRecognizer.ERROR_NO_MATCH:
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: baoNghe("loi", "no-speech"); break;
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: baoNghe("loi", "not-allowed"); break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                        case SpeechRecognizer.ERROR_SERVER: baoNghe("loi", "network"); break;
                        case SpeechRecognizer.ERROR_AUDIO: baoNghe("loi", "audio-capture"); break;
                        default: baoNghe("het", "1"); break;   // người dùng bấm dừng, bộ nhận dạng bận…
                    }
                }
            });
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "vi-VN");
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "vi-VN");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, hd.getPackageName());
        try {
            if (dangNghe) nhan.cancel();
            nhan.startListening(i);
            dangNghe = true;
        } catch (Exception e) {
            dangNghe = false;
            baoNghe("loi", "khong-ho-tro");
        }
    }

    static String dauTien(Bundle b) {
        if (b == null) return null;
        ArrayList<String> ds = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return ds == null || ds.isEmpty() ? null : ds.get(0);
    }

    void dungNghe() {
        if (nhan != null && dangNghe) {
            try { nhan.stopListening(); } catch (Exception e) { /* đã dừng */ }
        }
    }

    // ------------------------------------------------------------------ đọc

    void doc(String s) {
        if (s == null || s.trim().length() == 0) { docXong(); return; }
        if (tts == null) {
            choDoc = s;
            tts = new TextToSpeech(hd, new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int tt) {
                    if (tt == TextToSpeech.SUCCESS) {
                        int r = tts.setLanguage(new Locale("vi", "VN"));
                        ttsSan = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
                        ttsLoi = !ttsSan;
                        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                            @Override public void onStart(String id) { }
                            @Override public void onDone(String id) { xongTu(id); }
                            @Override public void onError(String id) { xongTu(id); }
                            @Override public void onStop(String id, boolean ngat) { xongTu(id); }
                        });
                    } else ttsLoi = true;
                    String c = choDoc;
                    choDoc = null;
                    if (c != null) doc(c);
                }
            });
            return;
        }
        if (!ttsSan) {
            if (!ttsLoi) { choDoc = s; return; }   // còn đang khởi động
            if (!daBaoThieuGiong) {
                daBaoThieuGiong = true;
                hd.bao("Điện thoại chưa có giọng đọc tiếng Việt: vào Cài đặt → Hệ thống → Ngôn ngữ → Chuyển văn bản thành giọng nói, chọn / tải tiếng Việt.");
            }
            docXong();
            return;
        }
        soDoc++;
        idDoc = "troly" + soDoc;
        int max = TextToSpeech.getMaxSpeechInputLength();
        if (s.length() > max) s = s.substring(0, max);
        if (tts.speak(s, TextToSpeech.QUEUE_FLUSH, null, idDoc) != TextToSpeech.SUCCESS) docXong();
    }

    void xongTu(final String id) {
        hd.ui.post(new Runnable() {
            @Override
            public void run() { if (id != null && id.equals(idDoc)) { idDoc = ""; docXong(); } }
        });
    }

    void docXong() { hd.goiJs("ungDungDocXong", ""); }

    void dungDoc() {
        choDoc = null;
        idDoc = "";
        if (tts != null && ttsSan) {
            try { tts.stop(); } catch (Exception e) { /* đã dừng */ }
        }
    }

    void huy() {
        if (nhan != null) {
            try { nhan.destroy(); } catch (Exception e) { /* bỏ qua */ }
            nhan = null;
        }
        if (tts != null) {
            try { tts.shutdown(); } catch (Exception e) { /* bỏ qua */ }
            tts = null;
        }
    }
}
