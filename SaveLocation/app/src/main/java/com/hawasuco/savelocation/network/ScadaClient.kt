package com.hawasuco.savelocation.network

import com.hawasuco.savelocation.BuildConfig
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Đọc bản đồ mạng lưới công khai của SCADA (PublishWeb/NetworkMap) bằng mã truy cập công ty,
 * đúng như trình duyệt làm: mở trang → gửi mã (kèm khoá chống giả mạo) → nhận cookie phiên →
 * đọc danh sách lớp trong trang và GeoJSON từng lớp. Hết phiên (máy chủ trả 403) thì tự nhập mã lại.
 * Mọi hàm chặn luồng — gọi từ Dispatchers.IO.
 */
class ScadaClient(baseUrl: String, private val code: String) {
    private val base = baseUrl.trim().trimEnd('/')
    private val cookies = LinkedHashMap<String, String>()
    private var layerHtml: String? = null

    class WrongCodeException : IOException("wrong_code")
    class ServerException(val status: Int) : IOException("HTTP $status")

    private class Resp(val code: Int, val body: String, val location: String?)

    private fun request(path: String, form: Map<String, String>? = null): Resp {
        val url = if (path.startsWith("http")) path else base + path
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 15000
            conn.readTimeout = 60000
            conn.setRequestProperty("User-Agent", BuildConfig.APPLICATION_ID + "/" + BuildConfig.VERSION_NAME + " (Android)")
            conn.setRequestProperty("Accept", "text/html,application/json")
            if (cookies.isNotEmpty()) conn.setRequestProperty("Cookie", cookies.entries.joinToString("; ") { "${it.key}=${it.value}" })
            if (form != null) {
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                val body = form.entries.joinToString("&") { URLEncoder.encode(it.key, "UTF-8") + "=" + URLEncoder.encode(it.value, "UTF-8") }
                conn.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = conn.responseCode
            conn.headerFields?.forEach { (k, values) ->
                if (k != null && k.equals("Set-Cookie", ignoreCase = true)) values.forEach(::rememberCookie)
            }
            val stream = if (status >= 400) conn.errorStream else conn.inputStream
            val text = stream?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""
            return Resp(status, text, conn.getHeaderField("Location"))
        } finally {
            conn.disconnect()
        }
    }

    private fun rememberCookie(header: String) {
        val pair = header.substringBefore(';')
        val eq = pair.indexOf('=')
        if (eq <= 0) return
        val name = pair.substring(0, eq).trim()
        val value = pair.substring(eq + 1).trim()
        if (value.isEmpty() || header.contains("expires=Thu, 01 Jan 1970", ignoreCase = true)) cookies.remove(name) else cookies[name] = value
    }

    private fun get(path: String): Resp {
        var r = request(path)
        var hops = 0
        while (r.code in 300..399 && r.location != null && hops++ < 5) r = request(absolute(r.location!!))
        return r
    }

    private fun absolute(loc: String) = if (loc.startsWith("http")) loc else base + (if (loc.startsWith("/")) loc else "/$loc")

    /** Nhập mã truy cập; trả về HTML trang bản đồ (có LAYER_META). */
    fun login(): String {
        cookies.clear()
        val page = get(MAP_PATH)
        if (page.code != 200) throw ServerException(page.code)
        PipeParser.layerMeta(page.body)?.let { layerHtml = page.body; return page.body }
        val token = TOKEN_RE.find(page.body)?.groupValues?.get(1) ?: throw ServerException(page.code)
        var r = request("$MAP_PATH/Access", mapOf("__RequestVerificationToken" to token, "code" to code))
        var hops = 0
        while (r.code in 300..399 && r.location != null && hops++ < 5) r = request(absolute(r.location!!))
        if (r.code != 200) throw ServerException(r.code)
        if (PipeParser.layerMeta(r.body) == null) throw WrongCodeException()
        layerHtml = r.body
        return r.body
    }

    fun layers(): List<PipeParser.LayerMeta> {
        val html = layerHtml ?: login()
        return PipeParser.layerMeta(html) ?: throw WrongCodeException()
    }

    /** GeoJSON đường ống của một lớp (chuỗi gốc để so sánh có thay đổi hay không). */
    fun featuresJson(layerId: Long): String = authed("$MAP_PATH/Features?layerId=$layerId")

    fun featureInfoJson(featureId: Long): String = authed("$MAP_PATH/FeatureInfo?id=$featureId")

    private fun authed(path: String): String {
        if (layerHtml == null) login()
        var r = get(path)
        if (r.code == 401 || r.code == 403 || (r.code == 200 && r.body.trimStart().startsWith("<"))) {
            login()
            r = get(path)
        }
        if (r.code != 200) throw ServerException(r.code)
        return r.body
    }

    companion object {
        const val MAP_PATH = "/PublishWeb/NetworkMap"
        private val TOKEN_RE = Regex("""name="__RequestVerificationToken"[^>]*?value="([^"]+)"""")
    }
}
