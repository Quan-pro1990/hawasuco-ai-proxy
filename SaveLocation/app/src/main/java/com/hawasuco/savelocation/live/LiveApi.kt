package com.hawasuco.savelocation.live

import com.hawasuco.savelocation.BuildConfig
import com.hawasuco.savelocation.data.Prefs
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom

/**
 * Gọi máy chủ vị trí trực tiếp (thư mục server/ trong dự án). Mọi hàm đều chặn luồng — gọi từ Dispatchers.IO.
 *  POST /api/live              {id, token, name, expiresAt}   → tạo phiên
 *  POST /api/live/{id}/update  {token, lat, lng, acc, ts}     → cập nhật vị trí
 *  POST /api/live/{id}/stop    {token}                        → dừng
 *  Trang xem: {server}/l/{id}
 */
object LiveApi {
    private val rnd = SecureRandom()
    private const val ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    fun randomId(len: Int) = buildString { repeat(len) { append(ALPHABET[rnd.nextInt(ALPHABET.length)]) } }

    fun linkFor(id: String) = Prefs.liveServerUrl + "/l/" + id

    fun start(id: String, token: String, name: String, expiresAt: Long) {
        post("/api/live", JSONObject().put("id", id).put("token", token).put("name", name).put("expiresAt", expiresAt))
    }

    fun update(id: String, token: String, lat: Double, lng: Double, acc: Float, ts: Long) {
        post("/api/live/$id/update", JSONObject().put("token", token).put("lat", lat).put("lng", lng).put("acc", acc.toDouble()).put("ts", ts))
    }

    fun stop(id: String, token: String) {
        post("/api/live/$id/stop", JSONObject().put("token", token))
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val base = Prefs.liveServerUrl
        require(base.isNotBlank()) { "server" }
        val conn = URL(base + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 10000
            conn.readTimeout = 15000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.setRequestProperty("User-Agent", BuildConfig.APPLICATION_ID + "/" + BuildConfig.VERSION_NAME)
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IllegalStateException("HTTP $code ${text.take(120)}")
            return runCatching { JSONObject(text) }.getOrDefault(JSONObject())
        } finally {
            conn.disconnect()
        }
    }
}
