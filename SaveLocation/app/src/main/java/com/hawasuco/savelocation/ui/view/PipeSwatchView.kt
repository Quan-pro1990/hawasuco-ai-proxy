package com.hawasuco.savelocation.ui.view

import android.content.Context
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import com.hawasuco.savelocation.network.PipeDash
import com.hawasuco.savelocation.network.PipeStyle

/** Mẫu nét đường ống (màu, độ dày, kiểu nét) dùng trong danh sách lớp và chú giải. */
class PipeSwatchView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private val density = resources.displayMetrics.density
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private var weightDp = 4f
    private var dash = PipeDash.SOLID

    fun set(color: Int, weightDp: Float, dash: Int = PipeDash.SOLID) {
        paint.color = color
        this.weightDp = weightDp.coerceIn(1.5f, 9f)
        this.dash = dash
        paint.strokeWidth = this.weightDp * density
        val pattern = PipeStyle.dashPattern(dash)
        paint.pathEffect = pattern?.let { p -> DashPathEffect(FloatArray(p.size) { p[it] * density * 0.8f }, 0f) }
        paint.strokeCap = if (pattern != null) Paint.Cap.BUTT else Paint.Cap.ROUND
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val y = height / 2f
        val pad = paint.strokeWidth / 2 + 1
        canvas.drawLine(pad, y, width - pad, y, paint)
    }
}
