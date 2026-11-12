package com.hawasuco.savelocation.network

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Point
import android.view.MotionEvent
import com.hawasuco.savelocation.data.Prefs
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.launch
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.Projection
import org.osmdroid.views.overlay.Overlay
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max

/**
 * Vẽ các lớp đường ống (đã đồng bộ từ SCADA) lên bản đồ osmdroid, giống web:
 * màu / độ dày theo lớp hoặc theo cỡ ống, ống dự kiến nét đứt, đang triển khai nét gạch chấm.
 * Chạm vào ống → [onPipeTap] (nếu có) với đoạn ống gần nhất.
 */
class PipeOverlay(
    context: Context,
    private val onPipeTap: ((PipeHit) -> Unit)? = null,
) : Overlay() {

    class PipeHit(val layer: PipeLayer, val feature: PipeFeature, val point: GeoPoint)

    private val density = context.resources.displayMetrics.density
    private val paints = HashMap<Long, Paint>()
    private val pathPool = ArrayList<Path>()
    private val pathsByStyle = LinkedHashMap<Long, Path>()
    private val gp = GeoPoint(0.0, 0.0)
    private val pt = Point()
    private val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND; color = Color.WHITE
    }
    private val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND; color = Color.parseColor("#1E293B")
    }

    /** Đoạn ống đang chọn (vẽ viền sáng). */
    var selected: PipeFeature? = null

    private fun paintFor(color: Int, weightDp: Float, dash: Int): Paint {
        val key = (color.toLong() and 0xffffffffL) or (weightDp.times(10).toLong() shl 32) or (dash.toLong() shl 48)
        return paints.getOrPut(key) {
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
                this.color = color
                alpha = (0.9f * 255).toInt()
                strokeWidth = weightDp * density
                PipeStyle.dashPattern(dash)?.let { pattern ->
                    strokeCap = Paint.Cap.BUTT
                    pathEffect = DashPathEffect(FloatArray(pattern.size) { pattern[it] * density }, 0f)
                }
            }
        }
    }

    private fun styleOf(layer: PipeLayer, f: PipeFeature, sizeMode: Boolean): Triple<Int, Float, Int> {
        val isPipe = layer.kind in PipeKind.ALL
        return if (isPipe && sizeMode) {
            val c = PipeStyle.sizeClass(f.diameterMm)
            Triple(c.color, c.weight, f.dash)
        } else Triple(layer.color, layer.weight, f.dash)
    }

    override fun draw(c: Canvas, mapView: MapView, shadow: Boolean) {
        if (shadow || !isEnabled) return
        val layers = PipeStore.visibleLayers()
        if (layers.isEmpty()) return
        val pj = mapView.projection
        val bb = pj.boundingBox
        val north = bb.latNorth
        val south = bb.latSouth
        var west = bb.lonWest
        var east = bb.lonEast
        if (west > east) { west = -180.0; east = 180.0 }
        val sizeMode = Prefs.pipeSizeMode
        for (ll in layers) {
            pathsByStyle.clear()
            var used = 0
            for (f in ll.features) {
                if (f.maxLat < south || f.minLat > north || f.maxLon < west || f.minLon > east) continue
                val (color, weight, dash) = styleOf(ll.layer, f, sizeMode)
                val key = (color.toLong() and 0xffffffffL) or (weight.times(10).toLong() shl 32) or (dash.toLong() shl 48)
                val path = pathsByStyle.getOrPut(key) {
                    if (used >= pathPool.size) pathPool.add(Path())
                    pathPool[used++].apply { rewind() }
                }
                addToPath(path, f, pj)
            }
            for ((key, path) in pathsByStyle) {
                val color = (key and 0xffffffffL).toInt()
                val weight = ((key shr 32) and 0xffffL) / 10f
                val dash = ((key shr 48) and 0xffL).toInt()
                c.drawPath(path, paintFor(color, weight, dash))
            }
        }
        selected?.let { f ->
            val ll = layers.firstOrNull { it.layer.id == f.layerId } ?: return@let
            val (_, weight, _) = styleOf(ll.layer, f, sizeMode)
            val p = Path()
            addToPath(p, f, pj)
            outlinePaint.strokeWidth = (weight + 7f) * density
            haloPaint.strokeWidth = (weight + 4f) * density
            c.drawPath(p, outlinePaint)
            c.drawPath(p, haloPaint)
            val (color, w, dash) = styleOf(ll.layer, f, sizeMode)
            c.drawPath(p, paintFor(color, w, dash))
        }
    }

    private fun addToPath(path: Path, f: PipeFeature, pj: Projection) {
        for (part in f.parts) {
            var k = 0
            var lastX = 0
            var lastY = 0
            var first = true
            while (k < part.size) {
                gp.setCoords(part[k], part[k + 1])
                pj.toPixels(gp, pt)
                if (first) {
                    path.moveTo(pt.x.toFloat(), pt.y.toFloat()); first = false; lastX = pt.x; lastY = pt.y
                } else if (abs(pt.x - lastX) + abs(pt.y - lastY) >= 2 || k == part.size - 2) {
                    path.lineTo(pt.x.toFloat(), pt.y.toFloat()); lastX = pt.x; lastY = pt.y
                }
                k += 2
            }
        }
    }

    /** Tìm đoạn ống gần điểm chạm nhất (trong khoảng ~14dp). */
    fun hitTest(x: Float, y: Float, mapView: MapView): PipeHit? {
        val layers = PipeStore.visibleLayers()
        if (layers.isEmpty()) return null
        val pj = mapView.projection
        val sizeMode = Prefs.pipeSizeMode
        var best: PipeFeature? = null
        var bestLayer: PipeLayer? = null
        var bestDist = Double.MAX_VALUE
        val tolLat = pj.fromPixels(x.toInt(), y.toInt())
        val tol2 = pj.fromPixels((x + 30 * density).toInt(), (y + 30 * density).toInt())
        val dLat = abs(tolLat.latitude - tol2.latitude)
        val dLon = abs(tolLat.longitude - tol2.longitude)
        val p1 = Point()
        val p2 = Point()
        val g = GeoPoint(0.0, 0.0)
        for (ll in layers.asReversed()) for (f in ll.features) {
            if (f.maxLat < tolLat.latitude - dLat || f.minLat > tolLat.latitude + dLat ||
                f.maxLon < tolLat.longitude - dLon || f.minLon > tolLat.longitude + dLon
            ) continue
            val weight = styleOf(ll.layer, f, sizeMode).second
            val limit = 14 * density + weight * density / 2
            for (part in f.parts) {
                var k = 0
                while (k + 3 < part.size) {
                    g.setCoords(part[k], part[k + 1]); pj.toPixels(g, p1)
                    g.setCoords(part[k + 2], part[k + 3]); pj.toPixels(g, p2)
                    val d = segDist(x.toDouble(), y.toDouble(), p1, p2)
                    if (d < limit && d < bestDist) { bestDist = d; best = f; bestLayer = ll.layer }
                    k += 2
                }
            }
        }
        val f = best ?: return null
        val at = pj.fromPixels(x.toInt(), y.toInt())
        return PipeHit(bestLayer!!, f, GeoPoint(at.latitude, at.longitude))
    }

    private fun segDist(px: Double, py: Double, a: Point, b: Point): Double {
        val dx = (b.x - a.x).toDouble()
        val dy = (b.y - a.y).toDouble()
        val len2 = dx * dx + dy * dy
        if (len2 == 0.0) return hypot(px - a.x, py - a.y)
        val t = max(0.0, minOf(1.0, ((px - a.x) * dx + (py - a.y) * dy) / len2))
        return hypot(px - (a.x + t * dx), py - (a.y + t * dy))
    }

    override fun onSingleTapConfirmed(e: MotionEvent, mapView: MapView): Boolean {
        val cb = onPipeTap ?: return false
        if (!isEnabled) return false
        val hit = hitTest(e.x, e.y, mapView) ?: return false
        selected = hit.feature
        mapView.invalidate()
        cb(hit)
        return true
    }

    companion object {
        /**
         * Gắn lớp đường ống vào [map] của một màn hình khác (Trang chủ, Đổi vị trí, Xem trên bản đồ):
         * nạp dữ liệu đã lưu, vẽ lại khi dữ liệu / cài đặt đổi; ẩn khi tắt "Hiện đường ống trên các bản đồ khác".
         */
        fun attach(
            owner: LifecycleOwner, map: MapView, index: Int,
            onTap: ((PipeHit) -> Unit)? = null,
        ): PipeOverlay {
            val o = PipeOverlay(map.context, onTap)
            o.isEnabled = Prefs.pipesOnMaps
            map.overlays.add(index.coerceIn(0, map.overlays.size), o)
            owner.lifecycleScope.launch {
                PipeStore.ensureLoaded(map.context)
                owner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                    PipeStore.version.collect {
                        o.isEnabled = Prefs.pipesOnMaps
                        if (!o.isEnabled) o.selected = null
                        map.invalidate()
                    }
                }
            }
            return o
        }

        /** Bao các đoạn ống đang hiện (để "phóng tới mạng lưới"). */
        fun visibleBounds(): DoubleArray? {
            var minLat = 90.0; var maxLat = -90.0; var minLon = 180.0; var maxLon = -180.0
            var any = false
            for (ll in PipeStore.visibleLayers()) for (f in ll.features) {
                any = true
                if (f.minLat < minLat) minLat = f.minLat
                if (f.maxLat > maxLat) maxLat = f.maxLat
                if (f.minLon < minLon) minLon = f.minLon
                if (f.maxLon > maxLon) maxLon = f.maxLon
            }
            return if (any) doubleArrayOf(minLat, minLon, maxLat, maxLon) else null
        }
    }
}
