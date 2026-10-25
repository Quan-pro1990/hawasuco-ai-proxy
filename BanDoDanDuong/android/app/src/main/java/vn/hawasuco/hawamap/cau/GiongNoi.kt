package vn.hawasuco.hawamap.cau

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Đọc hướng dẫn bằng giọng tiếng Việt của Android. Dùng loại âm thanh "hướng dẫn dẫn đường"
 * để Android Auto phát ra loa xe và tự giảm nhạc trong lúc đọc.
 *
 * Bộ đọc mặc định của nhiều máy (vd. Samsung) không có tiếng Việt: khi đó thử lần lượt các bộ đọc khác
 * đã cài (ưu tiên Google), chọn giọng tiếng Việt cài sẵn trong máy. Không có tiếng Việt thì không đọc
 * (tránh đọc câu tiếng Việt bằng giọng nước ngoài) và báo để người dùng cài giọng.
 */
object GiongNoi : TextToSpeech.OnInitListener {
    private val TIENG_VIET: Locale = Locale.forLanguageTag("vi-VN")
    private const val GOOGLE_TTS = "com.google.android.tts"

    private var app: Context? = null
    private var tts: TextToSpeech? = null
    private var am: AudioManager? = null
    private var sanSang = false
    private val cho = ArrayList<Array<Any>>()
    private var soCau = 0
    private var dangDoc = 0

    /** Gói bộ đọc đang khởi tạo (null = bộ đọc mặc định của máy) và các bộ đọc đã thử. */
    private var mayDangThu: String? = null
    private val daThu = HashSet<String>()

    /** Máy chưa có giọng đọc tiếng Việt ở bộ đọc nào. */
    var thieuTiengViet = false
        private set
    /** Bộ đọc và giọng đang dùng. */
    var mayDoc = ""
        private set
    var giongDangDung = ""
        private set

    /** Báo khi trạng thái giọng đọc thay đổi (TrungTam chuyển cho trang web). */
    var khiDoi: (() -> Unit)? = null

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
        if (app != null) return
        app = ctx.applicationContext
        am = ctx.applicationContext.getSystemService(AudioManager::class.java)
        taoMay(null)
    }

    /** Dò lại từ đầu (vd. người dùng vừa cài giọng tiếng Việt rồi quay lại ứng dụng). */
    fun thuLai() {
        if (app == null) return
        daThu.clear()
        taoMay(null)
    }

    private fun taoMay(goi: String?) {
        sanSang = false
        tts?.shutdown()
        mayDangThu = goi
        tts = if (goi == null) TextToSpeech(app, this) else TextToSpeech(app, this, goi)
    }

    override fun onInit(status: Int) {
        val t = tts ?: return
        val goi = mayDangThu ?: (t.defaultEngine ?: "")
        daThu.add(goi)
        if (status == TextToSpeech.SUCCESS && coTiengViet(t)) {
            dungMay(t, goi)
            return
        }
        // bộ đọc này không có tiếng Việt: thử bộ đọc khác, Google trước
        val ke = t.engines.map { it.name }.sortedBy { if (it == GOOGLE_TTS) 0 else 1 }.firstOrNull { it !in daThu }
        if (ke != null) {
            taoMay(ke)
            return
        }
        thieuTiengViet = true
        mayDoc = ""
        giongDangDung = ""
        synchronized(cho) { cho.clear() }
        khiDoi?.invoke()
    }

    private fun coTiengViet(t: TextToSpeech): Boolean = try {
        t.isLanguageAvailable(TIENG_VIET) >= TextToSpeech.LANG_AVAILABLE
    } catch (e: Exception) {
        false
    }

    private fun dungMay(t: TextToSpeech, goi: String) {
        t.setAudioAttributes(thuocTinh)
        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) = xong()
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = xong()
        })
        thieuTiengViet = false
        mayDoc = goi
        chonGiongTrong(t)
        sanSang = true
        val ds = synchronized(cho) { ArrayList(cho).also { cho.clear() } }
        ds.forEach { noi(it[0] as String, it[1] as Boolean, it[2] as Float, it[3] as Float) }
        khiDoi?.invoke()
    }

    /** Các giọng tiếng Việt đã có trong máy: giọng không cần mạng và chất lượng cao trước. */
    private fun dsGiongViet(t: TextToSpeech): List<Voice> = try {
        (t.voices ?: emptySet<Voice>())
            .filter { it.locale.language == "vi" && TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features }
            .sortedWith(compareBy<Voice>({ it.isNetworkConnectionRequired }, { -it.quality }, { it.name }))
    } catch (e: Exception) {
        emptyList()
    }

    private fun tenGiongMuon(): String =
        app?.getSharedPreferences("giong_noi", Context.MODE_PRIVATE)?.getString("ten", "") ?: ""

    private fun chonGiongTrong(t: TextToSpeech) {
        val ds = dsGiongViet(t)
        val muon = tenGiongMuon()
        val v = ds.firstOrNull { it.name == muon } ?: ds.firstOrNull()
        if (v == null || t.setVoice(v) != TextToSpeech.SUCCESS) t.setLanguage(TIENG_VIET)
        giongDangDung = try { t.voice?.name ?: "" } catch (e: Exception) { "" }
    }

    /** Người dùng chọn giọng trong Cài đặt ("" = tự chọn). */
    fun chonGiong(ten: String) {
        app?.getSharedPreferences("giong_noi", Context.MODE_PRIVATE)?.edit()?.putString("ten", ten)?.apply()
        val t = tts
        if (t != null && sanSang) chonGiongTrong(t)
        khiDoi?.invoke()
    }

    /** Trạng thái cho trang Cài đặt: có tiếng Việt không, bộ đọc, giọng đang dùng, danh sách giọng tiếng Việt. */
    fun trangThai(): JSONObject {
        val ds = JSONArray()
        val t = tts
        if (t != null && sanSang) {
            dsGiongViet(t).forEach { ds.put(JSONObject().put("ten", it.name).put("canMang", it.isNetworkConnectionRequired)) }
        }
        return JSONObject()
            .put("tiengViet", sanSang && !thieuTiengViet)
            .put("dangDo", !sanSang && !thieuTiengViet)
            .put("may", mayDoc)
            .put("giong", giongDangDung)
            .put("chon", tenGiongMuon())
            .put("ds", ds)
    }

    /** Mở chỗ cài giọng tiếng Việt: trang tải dữ liệu giọng của Google, chưa có Google thì mở Google Play. */
    fun moCaiGiong(ctx: Context) {
        val moi = Intent.FLAG_ACTIVITY_NEW_TASK
        val ds = listOf(
            Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA).setPackage(GOOGLE_TTS),
            Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$GOOGLE_TTS")),
            Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$GOOGLE_TTS"))
        )
        for (i in ds) {
            try {
                ctx.startActivity(i.addFlags(moi))
                return
            } catch (e: ActivityNotFoundException) {
                // thử cách tiếp theo
            }
        }
    }

    fun noi(chu: String, chen: Boolean, amLuong: Float, toc: Float) {
        if (chu.isBlank() || thieuTiengViet) return
        val t = tts
        if (t == null || !sanSang) {
            synchronized(cho) { cho.add(arrayOf(chu, chen, amLuong, toc)) }
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
