package com.hawasuco.savelocation.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.view.LayoutInflater
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.DrawableCompat
import com.hawasuco.savelocation.BuildConfig
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.DialogMapStyleChooserBinding
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.MapTileProviderBasic
import org.osmdroid.tileprovider.tilesource.ITileSource
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.tileprovider.tilesource.TileSourcePolicy
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.GeoPoint
import org.osmdroid.util.MapTileIndex
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.CopyrightOverlay
import org.osmdroid.views.overlay.TilesOverlay
import java.io.File

/**
 * Bản đồ OpenStreetMap (osmdroid) — không cần khoá API.
 * 4 kiểu như app gốc: Bản đồ đường, Vệ tinh, Kết hợp (vệ tinh + nhãn), Địa hình.
 */
object MapUtil {
    const val TYPE_ROAD = 0
    const val TYPE_SATELLITE = 1
    const val TYPE_HYBRID = 2
    const val TYPE_TERRAIN = 3

    /** Ảnh vệ tinh Esri: thứ tự ô là z/y/x. */
    private class EsriSource(name: String, path: String, maxZoom: Int, copyright: String) : OnlineTileSourceBase(
        name, 0, maxZoom, 256, "",
        arrayOf("https://server.arcgisonline.com/ArcGIS/rest/services/$path/MapServer/tile/"),
        copyright,
        TileSourcePolicy(2, TileSourcePolicy.FLAG_NO_PREVENTIVE or TileSourcePolicy.FLAG_USER_AGENT_MEANINGFUL or TileSourcePolicy.FLAG_USER_AGENT_NORMALIZED),
    ) {
        override fun getTileURLString(pMapTileIndex: Long): String =
            baseUrl + MapTileIndex.getZoom(pMapTileIndex) + "/" + MapTileIndex.getY(pMapTileIndex) + "/" + MapTileIndex.getX(pMapTileIndex)
    }

    private val SATELLITE: ITileSource = EsriSource("EsriWorldImagery", "World_Imagery", 19, "Imagery © Esri")
    private val LABELS: ITileSource = EsriSource("EsriBoundariesPlaces", "Reference/World_Boundaries_and_Places", 19, "© Esri")
    private val TOPO: ITileSource = XYTileSource(
        "OpenTopoMap", 0, 17, 256, ".png",
        arrayOf("https://a.tile.opentopomap.org/", "https://b.tile.opentopomap.org/", "https://c.tile.opentopomap.org/"),
        "© OpenTopoMap (CC-BY-SA)",
    )

    fun init(context: Context) {
        val conf = Configuration.getInstance()
        conf.userAgentValue = BuildConfig.APPLICATION_ID + "/" + BuildConfig.VERSION_NAME
        conf.osmdroidBasePath = File(context.cacheDir, "osmdroid")
        conf.osmdroidTileCache = File(context.cacheDir, "osmdroid/tiles")
        conf.tileFileSystemCacheMaxBytes = 200L * 1024 * 1024
        conf.tileFileSystemCacheTrimBytes = 160L * 1024 * 1024
    }

    /** Thiết lập chung cho mọi MapView. */
    fun setup(map: MapView, zoom: Double = 16.0) {
        map.setMultiTouchControls(true)
        map.zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
        map.isTilesScaledToDpi = true
        map.minZoomLevel = 2.0
        map.maxZoomLevel = 20.0
        map.controller.setZoom(zoom)
        map.setHorizontalMapRepetitionEnabled(true)
        map.setVerticalMapRepetitionEnabled(false)
        map.overlays.add(CopyrightOverlay(map.context).apply { setTextSize(9) })
        applyType(map, Prefs.mapType)
    }

    fun applyType(map: MapView, type: Int) {
        map.overlays.removeAll { it is LabelsOverlay }
        when (type) {
            TYPE_SATELLITE -> map.setTileSource(SATELLITE)
            TYPE_HYBRID -> {
                map.setTileSource(SATELLITE)
                val provider = MapTileProviderBasic(map.context.applicationContext, LABELS)
                val labels = LabelsOverlay(provider, map.context)
                labels.setLoadingBackgroundColor(Color.TRANSPARENT)
                labels.setLoadingLineColor(Color.TRANSPARENT)
                map.overlays.add(0, labels)
            }
            TYPE_TERRAIN -> map.setTileSource(TOPO)
            else -> map.setTileSource(TileSourceFactory.MAPNIK)
        }
        map.invalidate()
    }

    /** Lớp nhãn (ranh giới, địa danh) phủ lên ảnh vệ tinh ở chế độ "Kết hợp". */
    private class LabelsOverlay(provider: MapTileProviderBasic, ctx: Context) : TilesOverlay(provider, ctx)

    fun typeIcon(type: Int): Int = when (type) {
        TYPE_SATELLITE -> R.drawable.ic_satellite
        TYPE_HYBRID -> R.drawable.ic_layers
        TYPE_TERRAIN -> R.drawable.ic_terrain
        else -> R.drawable.ic_map
    }

    /** Hộp thoại chọn kiểu bản đồ (giống dialog_map_style_chooser của app gốc). */
    fun showTypeChooser(context: Context, onChosen: (Int) -> Unit) {
        val b = DialogMapStyleChooserBinding.inflate(LayoutInflater.from(context))
        val dialog = AlertDialog.Builder(context).setView(b.root).create()
        val rows = listOf(b.llTypeNormal to TYPE_ROAD, b.llTypeSatellite to TYPE_SATELLITE,
            b.llTypeHybrid to TYPE_HYBRID, b.llTypeTerrain to TYPE_TERRAIN)
        rows.forEach { (row, type) ->
            row.isSelected = Prefs.mapType == type
            row.setOnClickListener {
                Prefs.mapType = type
                dialog.dismiss()
                onChosen(type)
            }
        }
        b.ivClose.setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    fun geo(lat: Double, lng: Double) = GeoPoint(lat, lng)

    /**
     * Di chuyển bản đồ tới điểm [p]. Lưu ý: animateTo() của osmdroid tới đúng điểm đang ở giữa
     * làm bản đồ nhảy ra mức zoom nhỏ nhất, nên trường hợp đó chỉ đặt tâm (không hiệu ứng).
     */
    fun moveTo(map: MapView, p: GeoPoint, zoom: Double? = null, animate: Boolean = true) {
        if (zoom != null) map.controller.setZoom(zoom)
        val c = map.mapCenter
        val same = kotlin.math.abs(c.latitude - p.latitude) < 1e-5 && kotlin.math.abs(c.longitude - p.longitude) < 1e-5
        if (!animate || same || map.width == 0) map.controller.setCenter(p) else map.controller.animateTo(p)
    }

    /** Đưa các điểm vào khung nhìn; nếu các điểm gần như trùng nhau thì chỉ căn giữa ở mức zoom 17. */
    fun fit(map: MapView, points: List<GeoPoint>, paddingPx: Int, animate: Boolean = true) {
        if (points.isEmpty()) return
        val minLat = points.minOf { it.latitude }
        val maxLat = points.maxOf { it.latitude }
        val minLon = points.minOf { it.longitude }
        val maxLon = points.maxOf { it.longitude }
        // Các điểm gần như trùng nhau: BoundingBox suy biến của osmdroid bị hiểu là "vắt qua kinh tuyến 180" → tâm sai.
        if (maxLat - minLat < 0.0005 && maxLon - minLon < 0.0005) {
            moveTo(map, GeoPoint((minLat + maxLat) / 2, (minLon + maxLon) / 2), 17.0, animate)
            return
        }
        val box = org.osmdroid.util.BoundingBox(maxLat, maxLon, minLat, minLon)
        val run = Runnable {
            val c = map.mapCenter
            val bc = box.centerWithDateLine
            val same = kotlin.math.abs(c.latitude - bc.latitude) < 1e-5 && kotlin.math.abs(c.longitude - bc.longitude) < 1e-5
            map.zoomToBoundingBox(box.increaseByScale(1.3f), animate && !same, paddingPx)
        }
        if (map.width > 0 && map.height > 0) run.run() else map.post(run)
    }

    /** Ghim màu (dùng màu nhóm) cho điểm đánh dấu. */
    fun pin(context: Context, color: Int = Color.parseColor("#E53935")): Drawable {
        val base = ContextCompat.getDrawable(context, R.drawable.ic_place)!!.mutate()
        val d = DrawableCompat.wrap(base)
        DrawableCompat.setTint(d, color)
        val size = (40 * context.resources.displayMetrics.density).toInt()
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        d.setBounds(0, 0, size, size)
        d.draw(c)
        return BitmapDrawable(context.resources, bmp)
    }

    fun drawable(context: Context, res: Int): Drawable = ContextCompat.getDrawable(context, res)!!

    /** Biểu tượng cụm điểm: vòng tròn có số. */
    fun clusterIcon(context: Context, count: Int): Drawable {
        val d = context.resources.displayMetrics.density
        val size = (if (count < 10) 36 else if (count < 100) 42 else 48) * d
        val bmp = Bitmap.createBitmap(size.toInt(), size.toInt(), Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
        p.color = ContextCompat.getColor(context, R.color.colorAccent)
        c.drawCircle(size / 2, size / 2, size / 2, p)
        p.color = Color.WHITE
        p.style = android.graphics.Paint.Style.STROKE
        p.strokeWidth = 3 * d
        c.drawCircle(size / 2, size / 2, size / 2 - 2 * d, p)
        p.style = android.graphics.Paint.Style.FILL
        p.textSize = 14 * d
        p.textAlign = android.graphics.Paint.Align.CENTER
        p.isFakeBoldText = true
        c.drawText(count.toString(), size / 2, size / 2 - (p.descent() + p.ascent()) / 2, p)
        return BitmapDrawable(context.resources, bmp)
    }

    fun setMapTypeRowIcon(icon: ImageView, label: TextView, type: Int) {
        icon.setImageResource(typeIcon(type))
        label.isSelected = Prefs.mapType == type
    }
}
