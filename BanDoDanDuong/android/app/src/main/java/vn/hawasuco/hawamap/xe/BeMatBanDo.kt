package vn.hawasuco.hawamap.xe

import android.app.Presentation
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.webkit.WebView
import androidx.car.app.CarContext
import androidx.car.app.SurfaceCallback
import androidx.car.app.SurfaceContainer
import org.json.JSONObject
import vn.hawasuco.hawamap.cau.TrangWeb
import vn.hawasuco.hawamap.cau.TrungTam
import vn.hawasuco.hawamap.cau.VaiTro

/**
 * Vẽ bản đồ lên màn hình xe: Android Auto đưa một Surface, ta tạo màn hình ảo trên Surface đó
 * và đặt WebView chạy trang HawaMap (chế độ xe) vào. Thao tác kéo / phóng trên xe được chuyển cho trang.
 */
class BeMatBanDo(private val carContext: CarContext, private val khiCoTrang: (TrangWeb?) -> Unit) : SurfaceCallback {
    private var manHinhAo: VirtualDisplay? = null
    private var trinhChieu: Presentation? = null
    var trang: TrangWeb? = null
        private set
    private var rong = 0
    private var cao = 0
    private var vungOnDinh: Rect? = null
    private var vungThay: Rect? = null

    override fun onSurfaceAvailable(surfaceContainer: SurfaceContainer) {
        val surface = surfaceContainer.surface ?: return
        huy()
        rong = surfaceContainer.width
        cao = surfaceContainer.height
        val dm = carContext.getSystemService(DisplayManager::class.java)
        val md = dm.createVirtualDisplay(
            "HawaMapXe", rong, cao, surfaceContainer.dpi, surface, DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY
        )
        manHinhAo = md
        val p = Presentation(carContext, md.display)
        val wv = WebView(p.context)
        p.setContentView(wv)
        p.show()
        trinhChieu = p
        val t = TrangWeb(wv, VaiTro.XE)
        trang = t
        TrungTam.dangKy(t)
        t.tai()
        khiCoTrang(t)
    }

    override fun onVisibleAreaChanged(visibleArea: Rect) {
        vungThay = Rect(visibleArea)
        guiLe()
    }

    override fun onStableAreaChanged(stableArea: Rect) {
        vungOnDinh = Rect(stableArea)
        guiLe()
    }

    override fun onSurfaceDestroyed(surfaceContainer: SurfaceContainer) {
        huy()
    }

    override fun onScroll(distanceX: Float, distanceY: Float) {
        trang?.lenh("banDo", JSONObject().put("loai", "keo").put("dx", distanceX.toDouble()).put("dy", distanceY.toDouble()).put("donVi", "px"))
    }

    override fun onScale(focusX: Float, focusY: Float, scaleFactor: Float) {
        val ts = JSONObject().put("loai", "thuPhong").put("tiLe", scaleFactor.toDouble()).put("donVi", "px")
        if (focusX >= 0 && focusY >= 0) ts.put("x", focusX.toDouble()).put("y", focusY.toDouble())
        trang?.lenh("banDo", ts)
    }

    override fun onFling(velocityX: Float, velocityY: Float) {
        // bản đồ trên xe không trôi quán tính để người lái dễ kiểm soát
    }

    /** Báo cho trang phần màn hình bị giao diện Android Auto che (thẻ chỉ hướng, nút bấm). */
    fun guiLe() {
        val v = vungOnDinh ?: vungThay ?: return
        val t = trang ?: return
        t.lenh(
            "le", JSONObject().put("tren", v.top).put("duoi", (cao - v.bottom).coerceAtLeast(0))
                .put("trai", v.left).put("phai", (rong - v.right).coerceAtLeast(0)).put("donVi", "px")
        )
    }

    fun huy() {
        trang?.let {
            TrungTam.huyDangKy(it)
            it.huy()
            khiCoTrang(null)
        }
        trang = null
        trinhChieu?.dismiss()
        trinhChieu = null
        manHinhAo?.release()
        manHinhAo = null
    }
}
