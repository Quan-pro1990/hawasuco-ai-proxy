package vn.hawasuco.hawamap.cau

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.location.Location
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/** Trang HawaMap đang chạy trên màn hình nào. */
enum class VaiTro(val ma: String) { DIEN_THOAI("dienthoai"), XE("xe") }

/**
 * Một trang HawaMap (thư mục public/ được chép vào assets/web) chạy trong WebView,
 * cùng cầu nối JavaScript ↔ Kotlin. Xem public/js/cau-noi.js cho phía JavaScript.
 *
 * Trang được nạp qua https://appassets.androidplatform.net/ (WebViewAssetLoader) để là "secure context":
 * chạy được ES module, camera, IndexedDB… như trên trình duyệt.
 */
@SuppressLint("SetJavaScriptEnabled")
class TrangWeb(val webView: WebView, val vaiTro: VaiTro) {
    private val chinh = Handler(Looper.getMainLooper())
    private val choTraLoi = HashMap<Int, (Any?, String?) -> Unit>()
    private val hangDoi = ArrayList<String>()
    private var maLenh = 0

    /** Trang đã chạy xong main.js (đã gửi tin "sanSang"). */
    var sanSang = false
        private set

    init {
        val boTai = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(webView.context))
            .build()
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setGeolocationEnabled(false)          // vị trí do ứng dụng gửi vào (NguonViTri)
            allowFileAccess = false
            allowContentAccess = false
            textZoom = 100
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                boTai.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                // liên kết ngoài (tel:, trang OpenStreetMap…): mở bằng ứng dụng khác
                try {
                    view.context.startActivity(Intent(Intent.ACTION_VIEW, request.url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (e: ActivityNotFoundException) {
                    // không có ứng dụng mở được liên kết
                }
                return true
            }
        }
        webView.addJavascriptInterface(CauJs(), "HawaMapAndroid")
    }

    fun tai() {
        sanSang = false
        webView.loadUrl(DIA_CHI + if (vaiTro == VaiTro.XE) "?xe=1" else "")
    }

    /** Chạy một đoạn JavaScript; trang chưa sẵn sàng thì xếp hàng chờ. */
    fun goi(js: String) {
        chinh.post {
            if (sanSang) webView.evaluateJavascript(js, null) else hangDoi.add(js)
        }
    }

    /**
     * Gửi lệnh tới trang (xem LENH_GOC trong main.js). traLoi(kếtQuả, lỗi) chạy trên luồng chính;
     * kếtQuả là JSONObject, JSONArray, String, Boolean, Number hoặc null.
     */
    fun lenh(ten: String, thamSo: JSONObject = JSONObject(), traLoi: ((Any?, String?) -> Unit)? = null) {
        chinh.post {
            val id = ++maLenh
            if (traLoi != null) choTraLoi[id] = traLoi
            goi("window.hawamap&&hawamap.goc.lenh($id,${JSONObject.quote(ten)},$thamSo)")
        }
    }

    /** Gửi vị trí GPS mới cho trang. */
    fun viTri(l: Location) {
        val tocDo = if (l.hasSpeed()) l.speed.toString() else "null"
        val huong = if (l.hasBearing()) l.bearing.toString() else "null"
        goi("window.hawamap&&hawamap.goc.viTri(${l.longitude},${l.latitude},$tocDo,$huong,${l.accuracy},${l.time})")
    }

    internal fun daSanSang() {
        sanSang = true
        val ds = ArrayList(hangDoi)
        hangDoi.clear()
        ds.forEach { webView.evaluateJavascript(it, null) }
    }

    internal fun nhanTraLoi(du: JSONObject) {
        val f = choTraLoi.remove(du.optInt("id")) ?: return
        if (du.has("loi")) f(null, du.optString("loi")) else f(du.opt("ketQua").takeUnless { it == JSONObject.NULL }, null)
    }

    fun huy() {
        sanSang = false
        choTraLoi.clear()
        hangDoi.clear()
        webView.removeJavascriptInterface("HawaMapAndroid")
        webView.destroy()
    }

    /** Đối tượng JavaScript window.HawaMapAndroid. Các hàm được gọi trên luồng riêng của WebView. */
    private inner class CauJs {
        @JavascriptInterface
        fun guiTin(loai: String, du: String) {
            chinh.post { TrungTam.nhanTin(this@TrangWeb, loai, du) }
        }

        @JavascriptInterface
        fun cauHinh(): String = TrungTam.cauHinh(vaiTro).toString()
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val DIA_CHI = "https://$HOST/assets/web/index.html"
    }
}
