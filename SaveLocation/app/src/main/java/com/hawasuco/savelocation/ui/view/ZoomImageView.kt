package com.hawasuco.savelocation.ui.view

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Matrix
import android.graphics.RectF
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import androidx.appcompat.widget.AppCompatImageView

/** ImageView phóng to/thu nhỏ bằng hai ngón, kéo khi đã phóng, chạm đúp để phóng nhanh. */
class ZoomImageView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) :
    AppCompatImageView(context, attrs) {

    private val m = Matrix()
    private var scale = 1f
    private val maxScale = 5f

    private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(d: ScaleGestureDetector): Boolean {
            val newScale = (scale * d.scaleFactor).coerceIn(1f, maxScale)
            val f = newScale / scale
            scale = newScale
            m.postScale(f, f, d.focusX, d.focusY)
            fixTranslation()
            imageMatrix = m
            return true
        }
    })

    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDoubleTap(e: MotionEvent): Boolean {
            if (scale > 1f) resetZoom() else {
                scale = 2.5f
                m.postScale(2.5f, 2.5f, e.x, e.y)
                fixTranslation()
                imageMatrix = m
            }
            return true
        }

        override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dx: Float, dy: Float): Boolean {
            if (scale <= 1f) return false
            m.postTranslate(-dx, -dy)
            fixTranslation()
            imageMatrix = m
            return true
        }
    })

    init {
        scaleType = ScaleType.MATRIX
    }

    override fun setImageDrawable(drawable: android.graphics.drawable.Drawable?) {
        super.setImageDrawable(drawable)
        post { resetZoom() }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        resetZoom()
    }

    fun resetZoom() {
        val d = drawable ?: return
        if (width == 0 || height == 0) return
        val dw = d.intrinsicWidth.toFloat().coerceAtLeast(1f)
        val dh = d.intrinsicHeight.toFloat().coerceAtLeast(1f)
        val s = minOf(width / dw, height / dh)
        m.reset()
        m.postScale(s, s)
        m.postTranslate((width - dw * s) / 2f, (height - dh * s) / 2f)
        scale = 1f
        imageMatrix = m
    }

    private fun fixTranslation() {
        val d = drawable ?: return
        val r = RectF(0f, 0f, d.intrinsicWidth.toFloat(), d.intrinsicHeight.toFloat())
        m.mapRect(r)
        var dx = 0f
        var dy = 0f
        if (r.width() <= width) dx = (width - r.width()) / 2f - r.left
        else if (r.left > 0) dx = -r.left else if (r.right < width) dx = width - r.right
        if (r.height() <= height) dy = (height - r.height()) / 2f - r.top
        else if (r.top > 0) dy = -r.top else if (r.bottom < height) dy = height - r.bottom
        m.postTranslate(dx, dy)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)
        // Khi đang phóng to, không cho ViewPager lấy thao tác vuốt.
        parent?.requestDisallowInterceptTouchEvent(scale > 1f || event.pointerCount > 1)
        return true
    }
}
