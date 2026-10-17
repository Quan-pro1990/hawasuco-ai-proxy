package vn.hawasuco.hawamap.cau

import android.net.Uri
import java.net.HttpURLConnection
import java.net.URL

/**
 * Mở liên kết rút gọn của Google Maps (maps.app.goo.gl…) ngay trên điện thoại, không cần máy chủ HawaMap.
 * Chỉ đi theo chuyển hướng trong các tên miền Google (giống /api/mo-lien-ket của server.js).
 */
object LienKet {
    private val RUT_GON = setOf("maps.app.goo.gl", "goo.gl", "g.co")
    private val GOOGLE = Regex("^([a-z0-9-]+\\.)*google\\.(com|[a-z]{2}|com?\\.[a-z]{2})$")
    private val TIM_RUT_GON = Regex("https://(maps\\.app\\.goo\\.gl|goo\\.gl|g\\.co)/[^\\s<>\"]+")

    fun laMienGoogle(host: String): Boolean = host.lowercase().let { it in RUT_GON || GOOGLE.matches(it) }

    /** Liên kết rút gọn trong văn bản chia sẻ, null nếu không có. */
    fun timRutGon(chuoi: String): String? = TIM_RUT_GON.find(chuoi)?.value

    /** Liên kết đầy đủ sau các lần chuyển hướng, null nếu không mở được. Gọi trên luồng nền. */
    fun moRutGon(diaChi: String): String? {
        var hienTai = diaChi
        repeat(6) {
            val url = URL(hienTai)
            if (url.protocol != "https" || !laMienGoogle(url.host)) return null
            val ketNoi = url.openConnection() as HttpURLConnection
            try {
                ketNoi.instanceFollowRedirects = false
                ketNoi.connectTimeout = 8000
                ketNoi.readTimeout = 8000
                ketNoi.setRequestProperty("User-Agent", "Mozilla/5.0 (HawaMap)")
                val ma = ketNoi.responseCode
                val den = ketNoi.getHeaderField("Location")
                if (ma !in 300..399 || den == null) return if (url.host.lowercase() in RUT_GON) null else hienTai
                var tiep = URL(url, den).toString()
                val u = Uri.parse(tiep)
                if (u.host == "consent.google.com") u.getQueryParameter("continue")?.let { tiep = it }
                val host = URL(tiep).host.lowercase()
                if (!laMienGoogle(host)) return null
                hienTai = tiep
                if (host !in RUT_GON) return hienTai
            } finally {
                ketNoi.disconnect()
            }
        }
        return null
    }
}
