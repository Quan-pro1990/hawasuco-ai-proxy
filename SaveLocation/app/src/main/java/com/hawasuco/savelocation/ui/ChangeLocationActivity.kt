package com.hawasuco.savelocation.ui

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.network.PipeOverlay
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.ActivityChangeLocationBinding
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.GeocoderHelper
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.MapUtil
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.util.GeoPoint

/** "Đổi vị trí": kéo bản đồ dưới ghim cố định ở giữa để chỉnh lại tọa độ, hiện địa chỉ, bấm Xong. */
class ChangeLocationActivity : AppCompatActivity() {
    private lateinit var b: ActivityChangeLocationBinding
    private var geocodeJob: Job? = null
    private var address: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityChangeLocationBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        setTitle(R.string.change_location)
        MapUtil.setup(b.map, 17.0)
        PipeOverlay.attach(this, b.map, 0)

        val hasStart = intent.hasExtra(EXTRA_LAT)
        if (hasStart) {
            b.map.controller.setCenter(GeoPoint(intent.getDoubleExtra(EXTRA_LAT, 0.0), intent.getDoubleExtra(EXTRA_LNG, 0.0)))
        } else {
            b.map.controller.setZoom(5.0)
            b.map.controller.setCenter(GeoPoint(16.0, 106.0))
            goToCurrent()
        }
        b.map.addMapListener(object : MapListener {
            override fun onScroll(event: ScrollEvent?) = false.also { onCenterChanged() }
            override fun onZoom(event: ZoomEvent?) = false.also { onCenterChanged() }
        })
        b.btnMyLocation.setOnClickListener { goToCurrent() }
        b.btnDone.setOnClickListener {
            val c = b.map.mapCenter
            setResult(RESULT_OK, Intent()
                .putExtra(EXTRA_LAT, c.latitude)
                .putExtra(EXTRA_LNG, c.longitude)
                .putExtra(EXTRA_ADDRESS, address))
            finish()
        }
        if (!Prefs.changeLocationIntroShown) {
            b.rlIntroScreen.visibility = View.VISIBLE
            b.btnGotIt.setOnClickListener {
                Prefs.changeLocationIntroShown = true
                b.rlIntroScreen.visibility = View.GONE
            }
        }
        b.map.post { onCenterChanged() }
    }

    private fun goToCurrent() {
        if (!LocationHelper.hasLocationPermission(this)) return
        lifecycleScope.launch {
            val l = LocationHelper(this@ChangeLocationActivity).getCurrentLocation(10000) ?: return@launch
            MapUtil.moveTo(b.map, GeoPoint(l.latitude, l.longitude), 17.0)
        }
    }

    private fun onCenterChanged() {
        val c = b.map.mapCenter
        b.tvCoordinates.text = Coords.displayInline(this, c.latitude, c.longitude)
        geocodeJob?.cancel()
        geocodeJob = lifecycleScope.launch {
            delay(600)
            b.tvAddress.text = getString(R.string.finding_location)
            address = GeocoderHelper.reverse(this@ChangeLocationActivity, c.latitude, c.longitude)
            b.tvAddress.text = address ?: ""
        }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_map_type, menu)
        menu.findItem(R.id.action_map_type)?.setIcon(MapUtil.typeIcon(Prefs.mapType))
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean = when (item.itemId) {
        android.R.id.home -> { finish(); true }
        R.id.action_map_type -> { MapUtil.showTypeChooser(this) { MapUtil.applyType(b.map, it); invalidateOptionsMenu() }; true }
        else -> super.onOptionsItemSelected(item)
    }

    override fun onResume() {
        super.onResume(); b.map.onResume()
    }

    override fun onPause() {
        super.onPause(); b.map.onPause()
    }

    companion object {
        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
        const val EXTRA_ADDRESS = "address"
    }
}
