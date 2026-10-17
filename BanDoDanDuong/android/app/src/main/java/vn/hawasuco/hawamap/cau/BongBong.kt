package vn.hawasuco.hawamap.cau

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import org.json.JSONObject
import kotlin.math.abs

/**
 * Bong bóng nổi trên ứng dụng khác (Google Maps, nghe nhạc…) khi HawaMap chạy nền: tốc độ, biển giới hạn,
 * cảnh báo phía trước. Dữ liệu do trang gửi qua tin "hud" mỗi lần có vị trí mới. Cần quyền "Hiển thị trên ứng dụng khác".
 */
object BongBong {
    private var khung: KhungBongBong? = null
    private var du = JSONObject()
    private var lucCapNhat = 0L
    private var viTriX = 24
    private var viTriY = 320

    fun capNhat(moi: JSONObject) {
        du = moi
        lucCapNhat = SystemClock.elapsedRealtime()
        khung?.datDuLieu(moi)
    }

    /** Có nên hiện khi ứng dụng xuống nền: người dùng bật, đang dẫn đường hoặc xe đang chạy, dữ liệu còn mới. */
    fun nenHien(ctx: Context): Boolean = du.optBoolean("bat") && Settings.canDrawOverlays(ctx) &&
        SystemClock.elapsedRealtime() - lucCapNhat < 60_000 && (du.optBoolean("dangDanDuong") || du.optBoolean("dangDi"))

    fun hien(ctx: Context) {
        if (khung != null || !Settings.canDrawOverlays(ctx)) return
        val app = ctx.applicationContext
        val wm = app.getSystemService(WindowManager::class.java)
        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = viTriX
            y = viTriY
        }
        val k = KhungBongBong(app, wm, lp) { x, y -> viTriX = x; viTriY = y }
        k.datDuLieu(du)
        try { wm.addView(k, lp); khung = k } catch (e: RuntimeException) { /* không được vẽ đè (quyền bị thu hồi) */ }
    }

    fun an(ctx: Context) {
        val k = khung ?: return
        khung = null
        try { ctx.applicationContext.getSystemService(WindowManager::class.java).removeView(k) } catch (e: IllegalArgumentException) { /* đã gỡ */ }
    }
}

/** Hình tròn tốc độ + biển giới hạn nhỏ + dòng cảnh báo; kéo để dời chỗ, chạm để mở HawaMap. */
@SuppressLint("ViewConstructor")
class KhungBongBong(
    ctx: Context,
    private val wm: WindowManager,
    private val lp: WindowManager.LayoutParams,
    private val luuViTri: (Int, Int) -> Unit
) : View(ctx) {
    private val dp = resources.displayMetrics.density
    private val nen = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(235, 17, 24, 39) }
    private val chu = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textAlign = Paint.Align.CENTER; isFakeBoldText = true }
    private val vienBien = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(211, 47, 47); style = Paint.Style.STROKE }
    private val nenBien = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val nenCanhBao = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(240, 202, 138, 4) }
    private var tocDo = 0
    private var gioiHan = 0
    private var vuotToc = false
    private var canhBao = ""
    private var chamX = 0f
    private var chamY = 0f
    private var goc = intArrayOf(0, 0)
    private var daKeo = false

    fun datDuLieu(du: JSONObject) {
        tocDo = du.optInt("tocDo")
        gioiHan = du.optInt("gioiHan")
        vuotToc = du.optBoolean("vuotToc")
        val cb = du.optJSONObject("canhBao")
        canhBao = if (cb != null) "${cb.optString("ten")} · ${cb.optString("kcChu")}" else ""
        requestLayout()
        invalidate()
    }

    private val tron get() = 84 * dp
    private val bien get() = 34 * dp

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val rong = if (canhBao.isEmpty()) tron + bien / 2 else maxOf(tron + bien / 2, chu.apply { textSize = 13 * dp }.measureText(canhBao) + 24 * dp)
        setMeasuredDimension(rong.toInt(), (tron + bien / 4 + if (canhBao.isEmpty()) 0f else 30 * dp).toInt())
    }

    override fun onDraw(c: Canvas) {
        val cx = tron / 2
        val cy = bien / 4 + tron / 2
        nen.color = if (vuotToc) Color.rgb(229, 57, 53) else Color.argb(235, 17, 24, 39)
        c.drawCircle(cx, cy, tron / 2, nen)
        chu.color = Color.WHITE
        chu.textSize = 34 * dp
        c.drawText(tocDo.toString(), cx, cy + 10 * dp, chu)
        chu.textSize = 11 * dp
        c.drawText("km/h", cx, cy + 26 * dp, chu)
        if (gioiHan > 0) {
            val bx = tron - bien / 4
            val by = bien / 2
            vienBien.strokeWidth = 4 * dp
            c.drawCircle(bx, by, bien / 2 - 2 * dp, nenBien)
            c.drawCircle(bx, by, bien / 2 - 2 * dp, vienBien)
            chu.color = Color.BLACK
            chu.textSize = 14 * dp
            c.drawText(gioiHan.toString(), bx, by + 5 * dp, chu)
        }
        if (canhBao.isNotEmpty()) {
            val top = bien / 4 + tron + 4 * dp
            c.drawRoundRect(RectF(0f, top, width.toFloat(), top + 26 * dp), 13 * dp, 13 * dp, nenCanhBao)
            chu.color = Color.WHITE
            chu.textSize = 13 * dp
            c.drawText(canhBao, width / 2f, top + 18 * dp, chu)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> { chamX = e.rawX; chamY = e.rawY; goc = intArrayOf(lp.x, lp.y); daKeo = false }
            MotionEvent.ACTION_MOVE -> {
                val dx = e.rawX - chamX
                val dy = e.rawY - chamY
                if (abs(dx) > 8 * dp || abs(dy) > 8 * dp) daKeo = true
                if (daKeo) {
                    lp.x = goc[0] + dx.toInt()
                    lp.y = goc[1] + dy.toInt()
                    try { wm.updateViewLayout(this, lp) } catch (ex: IllegalArgumentException) { /* đã gỡ */ }
                }
            }
            MotionEvent.ACTION_UP -> {
                if (daKeo) luuViTri(lp.x, lp.y)
                else context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
                    it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    context.startActivity(it)
                }
            }
        }
        return true
    }
}
