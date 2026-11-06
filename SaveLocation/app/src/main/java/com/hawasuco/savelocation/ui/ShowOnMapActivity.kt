package com.hawasuco.savelocation.ui

import android.graphics.Color
import android.location.Location
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.ActivityShowOnMapBinding
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.MapUtil
import com.hawasuco.savelocation.util.NavApps
import com.hawasuco.savelocation.util.Routing
import com.hawasuco.savelocation.util.dp
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import org.osmdroid.views.overlay.infowindow.InfoWindow

/**
 * Xem một vị trí đã lưu trên bản đồ. Nếu bật "Chỉ đường" trong Cài đặt: vẽ đường đi từ vị trí hiện tại
 * và hiện khoảng cách. Nút chỉ đường mở Google Maps / Waze / HERE / Sygic.
 */
class ShowOnMapActivity : AppCompatActivity() {
    private lateinit var b: ActivityShowOnMapBinding
    private var loc: SavedLocation? = null
    private var current: Location? = null
    private var route: Polyline? = null
    private var currentMarker: Marker? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityShowOnMapBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        MapUtil.setup(b.map, 16.0)

        b.fabNavigate.setOnClickListener { loc?.let { NavApps.navigate(this, it.latitude, it.longitude, it.title) } }
        b.fabMyLocation.setOnClickListener { fitBoth() }

        val id = intent.getLongExtra(EXTRA_ID, -1)
        lifecycleScope.launch {
            val l = if (id >= 0) withContext(Dispatchers.IO) { Db.get(this@ShowOnMapActivity).getLocation(id) }
            else SavedLocation(
                latitude = intent.getDoubleExtra(EXTRA_LAT, 0.0), longitude = intent.getDoubleExtra(EXTRA_LNG, 0.0),
                title = intent.getStringExtra(EXTRA_TITLE).orEmpty(),
            )
            if (l == null) { finish(); return@launch }
            loc = l
            title = l.title.ifBlank { getString(R.string.show_on_map) }
            val color = withContext(Dispatchers.IO) {
                l.groupId?.let { Db.get(this@ShowOnMapActivity).getGroup(it)?.color } ?: Color.parseColor("#E53935")
            }
            showDestination(l, color)
            loadCurrentAndRoute(l)
        }
    }

    private fun showDestination(l: SavedLocation, color: Int) {
        val p = GeoPoint(l.latitude, l.longitude)
        Marker(b.map).apply {
            position = p
            icon = MapUtil.pin(this@ShowOnMapActivity, color)
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
            title = l.title
            snippet = l.address
            b.map.overlays.add(this)
        }
        b.map.controller.setCenter(p)
    }

    private fun loadCurrentAndRoute(l: SavedLocation) {
        if (!LocationHelper.hasLocationPermission(this)) return
        lifecycleScope.launch {
            val h = LocationHelper(this@ShowOnMapActivity)
            val c = h.getLastKnown() ?: h.getCurrentLocation(10000) ?: return@launch
            current = c
            currentMarker = Marker(b.map).apply {
                position = GeoPoint(c.latitude, c.longitude)
                icon = MapUtil.drawable(this@ShowOnMapActivity, R.drawable.ic_current_dot)
                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                setInfoWindow(null as InfoWindow?)
            }
            b.map.overlays.add(currentMarker)
            val straight = Formats.distanceMeters(c.latitude, c.longitude, l.latitude, l.longitude)
            b.rlDistance.visibility = View.VISIBLE
            b.tvDistance.text = getString(R.string.route_distance, Formats.distance(this@ShowOnMapActivity, straight))
            fitBoth()
            if (Prefs.showDirection) drawRoute(c, l)
        }
    }

    private suspend fun drawRoute(c: Location, l: SavedLocation) {
        b.progressRoute.visibility = View.VISIBLE
        val r = Routing.drivingRoute(c.latitude, c.longitude, l.latitude, l.longitude)
        b.progressRoute.visibility = View.GONE
        if (r == null || r.points.size < 2) {
            toast(R.string.msg_no_route_found); return
        }
        route?.let { b.map.overlays.remove(it) }
        route = Polyline(b.map).apply {
            setPoints(r.points)
            outlinePaint.color = Color.parseColor("#1E88E5")
            outlinePaint.strokeWidth = dp(6).toFloat()
            setInfoWindow(null as InfoWindow?)
        }
        b.map.overlays.add(0, route)
        b.tvDistance.text = getString(R.string.route_distance_time,
            Formats.distance(this, r.distanceMeters), Formats.travelTime(r.durationSeconds))
        MapUtil.fit(b.map, r.points, dp(48))
    }

    private fun fitBoth() {
        val l = loc ?: return
        val c = current ?: run { MapUtil.moveTo(b.map, GeoPoint(l.latitude, l.longitude)); return }
        MapUtil.fit(b.map, listOf(GeoPoint(l.latitude, l.longitude), GeoPoint(c.latitude, c.longitude)), dp(48))
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_show_on_map, menu)
        menu.findItem(R.id.action_map_type)?.setIcon(MapUtil.typeIcon(Prefs.mapType))
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean = when (item.itemId) {
        android.R.id.home -> { finish(); true }
        R.id.action_map_type -> {
            MapUtil.showTypeChooser(this) { MapUtil.applyType(b.map, it); invalidateOptionsMenu() }; true
        }
        R.id.action_show_direction -> {
            loc?.let { NavApps.showChooser(this, it.latitude, it.longitude, it.title) }; true
        }
        else -> super.onOptionsItemSelected(item)
    }

    override fun onResume() {
        super.onResume()
        b.map.onResume()
    }

    override fun onPause() {
        super.onPause()
        b.map.onPause()
    }

    companion object {
        const val EXTRA_ID = "id"
        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
        const val EXTRA_TITLE = "title"
    }
}
