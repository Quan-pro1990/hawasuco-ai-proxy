package com.hawasuco.savelocation.network

import android.graphics.Color

/** Bảng màu theo cỡ ống — cùng bảng với web SCADA ("Màu theo cỡ ống"). */
object PipeStyle {
    class SizeClass(val max: Double, val color: Int, val weight: Float, val label: String)

    val SIZE_CLASSES = listOf(
        SizeClass(50.0, Color.parseColor("#67e8f9"), 2f, "Đến D50"),
        SizeClass(90.0, Color.parseColor("#38bdf8"), 3f, "D51 – D90"),
        SizeClass(125.0, Color.parseColor("#4ade80"), 4f, "D91 – D125"),
        SizeClass(200.0, Color.parseColor("#facc15"), 5f, "D126 – D200"),
        SizeClass(315.0, Color.parseColor("#fb923c"), 6.5f, "D201 – D315"),
        SizeClass(Double.MAX_VALUE, Color.parseColor("#f87171"), 8f, "Trên D315"),
    )
    val SIZE_UNKNOWN = SizeClass(-1.0, Color.parseColor("#94a3b8"), 2f, "Chưa có cỡ ống")

    fun sizeClass(diameter: Double?): SizeClass =
        if (diameter == null || diameter <= 0) SIZE_UNKNOWN else SIZE_CLASSES.first { diameter <= it.max }

    /** Mẫu nét (đơn vị dp) giống web: dự kiến "8 7", đang triển khai "12 5 2 5". */
    fun dashPattern(dash: Int): FloatArray? = when (dash) {
        PipeDash.PLANNED -> floatArrayOf(8f, 7f)
        PipeDash.BUILD -> floatArrayOf(12f, 5f, 2f, 5f)
        else -> null
    }

    /** Màu mặc định mỗi nhóm (khi lớp không ghi màu). */
    fun kindColor(kind: String): Int = when (kind) {
        PipeKind.BUILD -> Color.parseColor("#fb923c")
        PipeKind.PLAN -> Color.parseColor("#a3e635")
        else -> Color.parseColor("#38bdf8")
    }
}
