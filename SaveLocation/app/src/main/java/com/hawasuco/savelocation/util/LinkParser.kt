package com.hawasuco.savelocation.util

import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder

/**
 * Đọc tọa độ từ link / văn bản được chia sẻ vào ứng dụng
 * (link Google Maps, Waze, OpenStreetMap, geo:, link rút gọn, hoặc chuỗi "vĩ độ, kinh độ").
 */
object LinkParser {
    data class Parsed(val lat: Double, val lng: Double, val name: String? = null)

    private val NUM = "(-?\\d{1,3}(?:\\.\\d+)?)"
    private val patterns = listOf(
        Regex("@$NUM,$NUM"),
        Regex("[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?$NUM(?:,|%2C)\\s*$NUM"),
        Regex("geo:$NUM,$NUM"),
        Regex("mlat=$NUM&mlon=$NUM"),
        Regex("!3d$NUM!4d$NUM"),
        Regex("#map=\\d+/$NUM/$NUM"),
        Regex("latitude=$NUM&longitude=$NUM"),
        Regex("(?<![\\d.])$NUM\\s*,\\s*$NUM(?![\\d.])"),
    )
    private val urlRegex = Regex("https?://\\S+")

    fun parseText(text: String?): Parsed? {
        if (text.isNullOrBlank()) return null
        val decoded = runCatching { URLDecoder.decode(text, "UTF-8") }.getOrDefault(text)
        for (src in listOf(text, decoded)) {
            for (p in patterns) {
                val m = p.find(src) ?: continue
                val lat = m.groupValues[1].toDoubleOrNull() ?: continue
                val lng = m.groupValues[2].toDoubleOrNull() ?: continue
                if (Coords.isValid(lat, lng) && !(lat == 0.0 && lng == 0.0)) {
                    return Parsed(lat, lng, nameFrom(src))
                }
            }
        }
        return null
    }

    private fun nameFrom(text: String): String? = runCatching {
        Regex("geo:[^?]*\\?q=[^(]*\\(([^)]+)\\)").find(text)?.groupValues?.get(1)
            ?: Regex("/maps/place/([^/@]+)").find(text)?.groupValues?.get(1)?.replace('+', ' ')
            ?: Regex("[?&]name=([^&]+)").find(text)?.groupValues?.get(1)
    }.getOrNull()?.let { runCatching { URLDecoder.decode(it, "UTF-8") }.getOrDefault(it) }

    /** Phân tích; nếu là link rút gọn (maps.app.goo.gl, goo.gl…) thì mở link để lấy địa chỉ thật. */
    suspend fun parse(text: String?): Parsed? {
        parseText(text)?.let { return it }
        val url = text?.let { urlRegex.find(it)?.value } ?: return null
        val expanded = expand(url) ?: return null
        return parseText(expanded)
    }

    private suspend fun expand(url: String): String? = withContext(Dispatchers.IO) {
        runCatching {
            var current = url
            repeat(5) {
                val conn = URL(current).openConnection() as HttpURLConnection
                conn.instanceFollowRedirects = false
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.requestMethod = "GET"
                val code = conn.responseCode
                val loc = conn.getHeaderField("Location")
                if (code in 300..399 && loc != null) {
                    current = if (loc.startsWith("http")) loc else Uri.parse(current).buildUpon().encodedPath(loc).build().toString()
                    conn.disconnect()
                    if (parseText(current) != null) return@runCatching current
                } else {
                    val body = conn.inputStream.bufferedReader().use { r -> r.readText().take(200_000) }
                    conn.disconnect()
                    return@runCatching current + "\n" + body
                }
            }
            current
        }.getOrNull()
    }
}
