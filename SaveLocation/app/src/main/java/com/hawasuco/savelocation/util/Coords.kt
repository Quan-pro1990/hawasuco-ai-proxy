package com.hawasuco.savelocation.util

import android.content.Context
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import java.util.Locale
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/** Định dạng & chuyển đổi tọa độ: DD, DMS, DDM, UTM (WGS84). */
object Coords {

    data class Utm(val zone: Int, val band: Char, val easting: Double, val northing: Double) {
        val zoneText: String get() = "$zone$band"
        val eastingText: String get() = String.format(Locale.US, "%.2f", easting)
        val northingText: String get() = String.format(Locale.US, "%.2f", northing)
    }

    /** Kết quả hiển thị theo định dạng đang chọn. Với UTM: first = Northing, second = Easting, zone != null. */
    data class Display(val first: String, val second: String, val zone: String? = null)

    fun isValid(lat: Double, lng: Double) = lat in -90.0..90.0 && lng in -180.0..180.0 && !lat.isNaN() && !lng.isNaN()

    fun dd(v: Double, decimals: Int = 6): String = String.format(Locale.US, "%.${decimals}f", v)

    fun display(context: Context, lat: Double, lng: Double, format: String = Prefs.coordFormat): Display = when (format) {
        "DMS" -> Display(dms(context, lat, true), dms(context, lng, false))
        "DDM" -> Display(ddm(context, lat, true), ddm(context, lng, false))
        "UTM" -> toUtm(lat, lng).let { Display(it.northingText, it.eastingText, it.zoneText) }
        else -> Display(dd(lat), dd(lng))
    }

    /** "lat, lng" theo định dạng đang chọn (dùng để sao chép). */
    fun displayInline(context: Context, lat: Double, lng: Double): String {
        val d = display(context, lat, lng)
        return if (d.zone != null) "${d.zone} ${d.second}E ${d.first}N" else "${d.first}, ${d.second}"
    }

    private fun hemisphere(context: Context, v: Double, isLat: Boolean): String = context.getString(
        if (isLat) (if (v >= 0) R.string.north else R.string.south) else (if (v >= 0) R.string.east else R.string.west)
    )

    fun dms(context: Context, value: Double, isLat: Boolean): String {
        val a = abs(value)
        var d = floor(a).toInt()
        val mFull = (a - d) * 60
        var m = floor(mFull).toInt()
        var s = (mFull - m) * 60
        if (s >= 59.995) { s = 0.0; m += 1 }
        if (m >= 60) { m = 0; d += 1 }
        return String.format(Locale.US, "%d°%02d′%05.2f″ %s", d, m, s, hemisphere(context, value, isLat))
    }

    fun ddm(context: Context, value: Double, isLat: Boolean): String {
        val a = abs(value)
        val d = floor(a).toInt()
        val m = (a - d) * 60
        return String.format(Locale.US, "%d°%07.4f′ %s", d, m, hemisphere(context, value, isLat))
    }

    /** Độ-phút-giây → độ thập phân. [negative] = Nam hoặc Tây. */
    fun fromDms(deg: Double, min: Double, sec: Double, negative: Boolean): Double {
        val v = abs(deg) + min / 60.0 + sec / 3600.0
        return if (negative || deg < 0) -v else v
    }

    /** Tách thành độ, phút, giây (giá trị dương). */
    fun toDmsParts(value: Double): Triple<Int, Int, Double> {
        val a = abs(value)
        val d = floor(a).toInt()
        val mFull = (a - d) * 60
        val m = floor(mFull).toInt()
        val s = (mFull - m) * 60
        return Triple(d, m, s)
    }

    /** Chuyển WGS84 sang UTM (công thức Krüger rút gọn của USGS). */
    fun toUtm(lat: Double, lon: Double): Utm {
        var zone = floor((lon + 180.0) / 6.0).toInt() + 1
        if (zone > 60) zone = 60
        // Ngoại lệ Na Uy / Svalbard
        if (lat >= 56.0 && lat < 64.0 && lon >= 3.0 && lon < 12.0) zone = 32
        if (lat >= 72.0 && lat < 84.0) {
            zone = when {
                lon >= 0.0 && lon < 9.0 -> 31
                lon >= 9.0 && lon < 21.0 -> 33
                lon >= 21.0 && lon < 33.0 -> 35
                lon >= 33.0 && lon < 42.0 -> 37
                else -> zone
            }
        }
        val a = 6378137.0
        val f = 1 / 298.257223563
        val k0 = 0.9996
        val e2 = f * (2 - f)
        val ep2 = e2 / (1 - e2)
        val phi = Math.toRadians(lat)
        val lam = Math.toRadians(lon)
        val lam0 = Math.toRadians(((zone - 1) * 6 - 180 + 3).toDouble())
        val n = a / sqrt(1 - e2 * sin(phi) * sin(phi))
        val t = tan(phi) * tan(phi)
        val c = ep2 * cos(phi) * cos(phi)
        val aa = cos(phi) * (lam - lam0)
        val e4 = e2 * e2
        val e6 = e4 * e2
        val m = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi -
                (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * sin(2 * phi) +
                (15 * e4 / 256 + 45 * e6 / 1024) * sin(4 * phi) -
                (35 * e6 / 3072) * sin(6 * phi))
        val easting = k0 * n * (aa + (1 - t + c) * aa * aa * aa / 6 +
                (5 - 18 * t + t * t + 72 * c - 58 * ep2) * aa * aa * aa * aa * aa / 120) + 500000.0
        var northing = k0 * (m + n * tan(phi) * (aa * aa / 2 +
                (5 - t + 9 * c + 4 * c * c) * aa * aa * aa * aa / 24 +
                (61 - 58 * t + t * t + 600 * c - 330 * ep2) * aa * aa * aa * aa * aa * aa / 720))
        if (lat < 0) northing += 10000000.0
        val bands = "CDEFGHJKLMNPQRSTUVWXX"
        val bandIdx = floor((lat.coerceIn(-80.0, 84.0) + 80) / 8).toInt().coerceIn(0, bands.length - 1)
        return Utm(zone, bands[bandIdx], easting, northing)
    }
}
