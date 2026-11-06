package com.hawasuco.savelocation.ui.view

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

/** Thanh chọn màu (dải cầu vồng + đen/xám) cho màu nhóm. */
class ColorSeekBar @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {

    private val colors = intArrayOf(
        Color.parseColor("#E53935"), Color.parseColor("#FB8C00"), Color.parseColor("#FDD835"),
        Color.parseColor("#43A047"), Color.parseColor("#00ACC1"), Color.parseColor("#1E88E5"),
        Color.parseColor("#5E35B1"), Color.parseColor("#D81B60"), Color.parseColor("#6D4C41"),
        Color.parseColor("#546E7A"), Color.parseColor("#212121"),
    )
    private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val thumbPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val thumbStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; color = Color.WHITE
    }
    private val bar = RectF()
    private var position = 0f // 0..1

    var onColorChange: ((Int) -> Unit)? = null

    val color: Int get() = colorAt(position)

    fun setColor(c: Int) {
        // Chọn vị trí có màu gần nhất
        var best = 0f
        var bestDist = Double.MAX_VALUE
        for (i in 0..200) {
            val p = i / 200f
            val cc = colorAt(p)
            val d = sq(Color.red(cc) - Color.red(c)) + sq(Color.green(cc) - Color.green(c)) + sq(Color.blue(cc) - Color.blue(c))
            if (d < bestDist) { bestDist = d; best = p }
        }
        position = best
        invalidate()
    }

    private fun sq(v: Int) = v.toDouble() * v

    private fun colorAt(p: Float): Int {
        val f = p.coerceIn(0f, 1f) * (colors.size - 1)
        val i = f.toInt().coerceAtMost(colors.size - 2)
        val t = f - i
        val a = colors[i]
        val b = colors[i + 1]
        return Color.rgb(
            (Color.red(a) + (Color.red(b) - Color.red(a)) * t).toInt(),
            (Color.green(a) + (Color.green(b) - Color.green(a)) * t).toInt(),
            (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t).toInt(),
        )
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        val r = h / 2f
        val barH = h * 0.32f
        bar.set(r, (h - barH) / 2f, w - r, (h + barH) / 2f)
        barPaint.shader = LinearGradient(bar.left, 0f, bar.right, 0f, colors, null, Shader.TileMode.CLAMP)
        thumbStroke.strokeWidth = h * 0.08f
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawRoundRect(bar, bar.height() / 2, bar.height() / 2, barPaint)
        val x = bar.left + position * bar.width()
        val r = height * 0.38f
        thumbPaint.color = color
        canvas.drawCircle(x, height / 2f, r, thumbPaint)
        canvas.drawCircle(x, height / 2f, r, thumbStroke)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                position = ((event.x - bar.left) / bar.width()).coerceIn(0f, 1f)
                invalidate()
                onColorChange?.invoke(color)
            }
        }
        return true
    }
}
