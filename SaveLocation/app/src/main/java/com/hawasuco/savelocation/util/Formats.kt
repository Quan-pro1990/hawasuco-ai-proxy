package com.hawasuco.savelocation.util

import android.content.Context
import android.location.Location
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object Formats {
    /** Các định dạng ngày giờ giống ứng dụng gốc (6 lựa chọn). */
    val DATE_PATTERNS = arrayOf(
        "yyyy-MM-dd HH:mm:ss",
        "MM-dd-yyyy HH:mm:ss",
        "MMM dd, yyyy HH:mm:ss",
        "yyyy-MM-dd hh:mm:ss a",
        "MM-dd-yyyy hh:mm:ss a",
        "MMM dd, yyyy hh:mm:ss a",
    )
    val DATE_DISPLAY_SAMPLES = arrayOf(
        "2018-12-31 15:59:59",
        "12-31-2018 15:59:59",
        "Dec 31, 2018 15:59:59",
        "2018-12-31 03:59:59 PM",
        "12-31-2018 03:59:59 PM",
        "Dec 31, 2018 03:59:59 PM",
    )

    /** Các định dạng chấp nhận khi nhập CSV. */
    private val PARSE_PATTERNS = DATE_PATTERNS + arrayOf(
        "yyyy-MM-dd HH:mm", "yyyy-MM-dd", "dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy HH:mm", "dd/MM/yyyy",
        "MM/dd/yyyy HH:mm:ss", "yyyy/MM/dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss", "MMM dd, yyyy",
    )

    fun date(millis: Long, pattern: String = DATE_PATTERNS[Prefs.dateFormat.coerceIn(0, DATE_PATTERNS.size - 1)]): String =
        SimpleDateFormat(pattern, Locale.US).format(Date(millis))

    fun isoDate(millis: Long): String = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(millis))

    fun isoUtc(millis: Long): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(Date(millis))

    fun timeShort(millis: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(millis))

    fun parseDate(text: String?): Long? {
        val t = text?.trim().orEmpty()
        if (t.isEmpty()) return null
        for (p in PARSE_PATTERNS) {
            try {
                val f = SimpleDateFormat(p, Locale.US).apply { isLenient = false }
                return f.parse(t)?.time
            } catch (_: Exception) {
            }
        }
        return t.toLongOrNull()
    }

    fun distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val r = FloatArray(1)
        Location.distanceBetween(lat1, lng1, lat2, lng2, r)
        return r[0].toDouble()
    }

    /** "850 m", "12.35 km" hoặc "0.53 mi" theo đơn vị đang chọn. */
    fun distance(context: Context, meters: Double): String {
        return if (Prefs.distanceUnit == 1) {
            val miles = meters / 1609.344
            if (miles < 0.1) String.format(Locale.US, "%.0f ft", meters * 3.28084)
            else String.format(Locale.US, "%.2f mi", miles)
        } else {
            if (meters < 1000) String.format(Locale.US, "%.0f m", meters)
            else String.format(Locale.US, "%.2f km", meters / 1000.0)
        }
    }

    fun distanceUnitLabel(context: Context): String =
        context.getString(if (Prefs.distanceUnit == 1) R.string.mile else R.string.km)

    /** Đổi giá trị bán kính (theo đơn vị đang chọn) sang mét. */
    fun radiusToMeters(value: Int): Double = if (Prefs.distanceUnit == 1) value * 1609.344 else value * 1000.0

    fun duration(context: Context, millis: Long): String {
        val totalMin = (millis / 60000).coerceAtLeast(0)
        val h = totalMin / 60
        val m = totalMin % 60
        return when {
            h > 0 && m > 0 -> "${h}h ${m}m"
            h > 0 -> "${h}h"
            else -> context.getString(R.string.minutes_short, m.toInt().coerceAtLeast(1))
        }
    }

    fun travelTime(seconds: Double): String {
        val min = (seconds / 60).toInt()
        return if (min >= 60) "${min / 60}h ${min % 60}m" else "${min.coerceAtLeast(1)} min"
    }
}
