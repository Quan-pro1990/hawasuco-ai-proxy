package com.hawasuco.savelocation.util

import com.hawasuco.savelocation.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.osmdroid.util.GeoPoint
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

/** Tìm đường lái xe bằng máy chủ OSRM công cộng (OpenStreetMap), không cần khoá API. */
object Routing {
    data class Route(val points: List<GeoPoint>, val distanceMeters: Double, val durationSeconds: Double)

    suspend fun drivingRoute(fromLat: Double, fromLng: Double, toLat: Double, toLng: Double): Route? = withContext(Dispatchers.IO) {
        runCatching {
            val url = String.format(Locale.US,
                "https://router.project-osrm.org/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=full&geometries=polyline",
                fromLng, fromLat, toLng, toLat)
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 10000
            conn.readTimeout = 15000
            conn.setRequestProperty("User-Agent", BuildConfig.APPLICATION_ID)
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()
            val json = JSONObject(body)
            if (json.optString("code") != "Ok") return@runCatching null
            val r = json.getJSONArray("routes").getJSONObject(0)
            Route(decodePolyline(r.getString("geometry")), r.getDouble("distance"), r.getDouble("duration"))
        }.getOrNull()
    }

    /** Giải mã chuỗi polyline (độ chính xác 1e5). */
    fun decodePolyline(encoded: String): List<GeoPoint> {
        val poly = ArrayList<GeoPoint>()
        var index = 0
        var lat = 0
        var lng = 0
        while (index < encoded.length) {
            var b: Int
            var shift = 0
            var result = 0
            do {
                b = encoded[index++].code - 63
                result = result or ((b and 0x1f) shl shift)
                shift += 5
            } while (b >= 0x20)
            lat += if (result and 1 != 0) (result shr 1).inv() else result shr 1
            shift = 0
            result = 0
            do {
                b = encoded[index++].code - 63
                result = result or ((b and 0x1f) shl shift)
                shift += 5
            } while (b >= 0x20)
            lng += if (result and 1 != 0) (result shr 1).inv() else result shr 1
            poly.add(GeoPoint(lat / 1e5, lng / 1e5))
        }
        return poly
    }
}
