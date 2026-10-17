package vn.hawasuco.hawamap.cau

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * Đọc hướng dẫn bằng giọng tiếng Việt của Android. Dùng loại âm thanh "hướng dẫn dẫn đường"
 * để Android Auto phát ra loa xe và tự giảm nhạc trong lúc đọc.
 */
object GiongNoi : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var am: AudioManager? = null
    private var sanSang = false
    private val cho = ArrayList<Array<Any>>()
    private var soCau = 0
    private var dangDoc = 0

    /** Máy chưa có giọng đọc tiếng Việt (cần cài thêm trong Cài đặt → Chuyển văn bản thành giọng nói). */
    var thieuTiengViet = false
        private set

    private val thuocTinh: AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    private val yeuCauTieuDiem: AudioFocusRequest by lazy {
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(thuocTinh)
            .build()
    }

    fun khoiTao(ctx: Context) {
        if (tts != null) return
        am = ctx.applicationContext.getSystemService(AudioManager::class.java)
        tts = TextToSpeech(ctx.applicationContext, this)
    }

    override fun onInit(status: Int) {
        val t = tts ?: return
        if (status != TextToSpeech.SUCCESS) return
        val kq = t.setLanguage(Locale.forLanguageTag("vi-VN"))
        thieuTiengViet = kq == TextToSpeech.LANG_MISSING_DATA || kq == TextToSpeech.LANG_NOT_SUPPORTED
        t.setAudioAttributes(thuocTinh)
        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) = xong()
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = xong()
        })
        sanSang = true
        val ds = ArrayList(cho)
        cho.clear()
        ds.forEach { noi(it[0] as String, it[1] as Boolean, it[2] as Float, it[3] as Float) }
    }

    fun noi(chu: String, chen: Boolean, amLuong: Float, toc: Float) {
        if (chu.isBlank()) return
        val t = tts
        if (t == null || !sanSang) {
            cho.add(arrayOf(chu, chen, amLuong, toc))
            return
        }
        am?.requestAudioFocus(yeuCauTieuDiem)
        t.setSpeechRate(toc)
        val thamSo = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, amLuong.coerceIn(0f, 1f)) }
        synchronized(this) { dangDoc++ }
        t.speak(chu, if (chen) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, thamSo, "hawamap-" + (++soCau))
    }

    fun imLang() {
        tts?.stop()
        synchronized(this) { dangDoc = 0 }
        am?.abandonAudioFocusRequest(yeuCauTieuDiem)
    }

    private fun xong() {
        val conDoc = synchronized(this) {
            dangDoc = (dangDoc - 1).coerceAtLeast(0)
            dangDoc
        }
        if (conDoc == 0) am?.abandonAudioFocusRequest(yeuCauTieuDiem)
    }
}
