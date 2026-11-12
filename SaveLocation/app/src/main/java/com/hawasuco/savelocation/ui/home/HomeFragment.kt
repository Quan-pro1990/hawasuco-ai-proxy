package com.hawasuco.savelocation.ui.home

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.location.Location
import android.os.Bundle
import android.view.GestureDetector
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.MenuProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.FragmentHomeBinding
import com.hawasuco.savelocation.ui.HomeActivity
import com.hawasuco.savelocation.ui.SearchActivity
import com.hawasuco.savelocation.ui.dialogs.FeatureAnnouncementDialog
import com.hawasuco.savelocation.ui.dialogs.SaveLocationDialog
import com.hawasuco.savelocation.ui.live.LiveStatusSheet
import com.hawasuco.savelocation.ui.live.ShareLocationSheet
import com.hawasuco.savelocation.network.PipeOverlay
import com.hawasuco.savelocation.ui.network.PipeInfoSheet
import com.hawasuco.savelocation.ui.network.PipeMapHost
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.GeocoderHelper
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.MapUtil
import com.hawasuco.savelocation.util.ShareUtil
import com.hawasuco.savelocation.util.isOnline
import com.hawasuco.savelocation.util.openAppSettings
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.infowindow.InfoWindow
import kotlin.math.abs

/**
 * Màn hình chính: bản đồ + tấm thông tin màu xanh phía dưới (độ chính xác, tọa độ, địa chỉ)
 * với hai nút "Lưu vị trí" và "Chia sẻ vị trí". Nhấn giữ trên bản đồ để đặt ghim chọn vị trí khác.
 */
class HomeFragment : Fragment(), PipeMapHost {
    private var _b: FragmentHomeBinding? = null
    private val b get() = _b!!

    private lateinit var locHelper: LocationHelper
    private var currentLocation: Location? = null
    private var selLat: Double? = null
    private var selLng: Double? = null
    private var selIsCurrent = true
    private var selName: String? = null
    private var selAddress: String? = null
    private var geocodedAt: GeoPoint? = null
    private var geocodeJob: Job? = null
    private var hasCentered = false

    private var currentMarker: Marker? = null
    private var pinMarker: Marker? = null
    private var pipes: PipeOverlay? = null

    private val permissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        if (res.values.any { it }) startLocation() else updatePermissionUi()
    }

    private val gpsLauncher = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) {
        if (it.resultCode == Activity.RESULT_OK) startLocation()
    }

    private val searchLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val data = r.data ?: return@registerForActivityResult
        if (r.resultCode == Activity.RESULT_OK) {
            showLocation(
                data.getDoubleExtra(SearchActivity.EXTRA_LAT, 0.0),
                data.getDoubleExtra(SearchActivity.EXTRA_LNG, 0.0),
                data.getStringExtra(SearchActivity.EXTRA_NAME),
                data.getStringExtra(SearchActivity.EXTRA_ADDRESS),
            )
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentHomeBinding.inflate(inflater, container, false)
        locHelper = LocationHelper(requireContext())
        return b.root
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        requireActivity().title = getString(R.string.app_name)
        MapUtil.setup(b.map, 4.0)
        b.map.controller.setCenter(GeoPoint(16.0, 106.0))
        b.map.overlays.add(0, MapEventsOverlay(object : MapEventsReceiver {
            override fun singleTapConfirmedHelper(p: GeoPoint?) = false
            override fun longPressHelper(p: GeoPoint?): Boolean {
                p ?: return false
                setSelected(p.latitude, p.longitude, isCurrent = false)
                return true
            }
        }))
        // Lớp đường ống SCADA (dưới các ghim): chạm vào ống để xem thông tin.
        pipes = PipeOverlay.attach(viewLifecycleOwner, b.map, 1) { hit ->
            if (childFragmentManager.findFragmentByTag(PipeInfoSheet.TAG) == null) {
                PipeInfoSheet.newInstance(hit).show(childFragmentManager, PipeInfoSheet.TAG)
            }
        }

        requireActivity().addMenuProvider(object : MenuProvider {
            override fun onCreateMenu(menu: Menu, menuInflater: MenuInflater) = menuInflater.inflate(R.menu.menu_home, menu)
            override fun onPrepareMenu(menu: Menu) {
                menu.findItem(R.id.action_map_type)?.setIcon(MapUtil.typeIcon(Prefs.mapType))
            }

            override fun onMenuItemSelected(item: MenuItem): Boolean = when (item.itemId) {
                R.id.action_list -> { (activity as? HomeActivity)?.showScreen(HomeActivity.Screen.SAVED); true }
                R.id.action_map_type -> {
                    MapUtil.showTypeChooser(requireContext()) { t ->
                        MapUtil.applyType(b.map, t); requireActivity().invalidateOptionsMenu()
                    }
                    true
                }
                else -> false
            }
        }, viewLifecycleOwner, Lifecycle.State.RESUMED)

        b.btnSearchPlaces.setOnClickListener { searchLauncher.launch(Intent(requireContext(), SearchActivity::class.java)) }
        b.btnMyLocation.setOnClickListener { goToCurrent() }
        b.details.copyContainer.setOnClickListener { copyCoordinates() }
        b.btnAddNote.setOnClickListener { saveSelected() }
        b.btnShare.setOnClickListener { shareSelected() }
        b.tvLocationError.setOnClickListener { requestPermission() }
        b.details.tvLiveSharingStatus.setOnClickListener { openLiveStatus() }
        b.ivArrow.setOnClickListener { setCollapsed(!Prefs.isMapFull) }

        // Vuốt tấm thông tin xuống để thu gọn (bản đồ rộng hơn), vuốt lên để mở lại.
        val detector = GestureDetector(requireContext(), object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true
            override fun onFling(e1: MotionEvent?, e2: MotionEvent, velocityX: Float, velocityY: Float): Boolean {
                if (abs(velocityY) > abs(velocityX) && abs(velocityY) > 300) {
                    setCollapsed(velocityY > 0); return true
                }
                return false
            }
        })
        b.rlContents.setOnTouchListener { _, e -> detector.onTouchEvent(e) }
        setCollapsed(Prefs.isMapFull)

        if (!Prefs.introShown) {
            b.rlIntroScreen.visibility = View.VISIBLE
            b.btnGotIt.setOnClickListener {
                Prefs.introShown = true
                b.rlIntroScreen.visibility = View.GONE
                maybeShowFeatureAnnouncement()
            }
        } else {
            maybeShowFeatureAnnouncement()
        }

        DataBus.observe(viewLifecycleOwner) { updateLiveBadge() }
        updateCoordinatesUi()
        if (!locHelper.hasPermission()) requestPermission()
    }

    private fun maybeShowFeatureAnnouncement() {
        if (Prefs.featureAnnouncementShown) return
        Prefs.featureAnnouncementShown = true
        b.root.postDelayed({
            if (isAdded && !isStateSaved) FeatureAnnouncementDialog().show(childFragmentManager, "feature")
        }, 800)
    }

    override fun onResume() {
        super.onResume()
        b.map.onResume()
        MapUtil.applyType(b.map, Prefs.mapType)
        updateLiveBadge()
        updateCoordinatesUi()
        updatePermissionUi()
        if (locHelper.hasPermission()) startLocation()
    }

    override fun onPause() {
        super.onPause()
        b.map.onPause()
        locHelper.stopUpdates()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        b.map.onDetach()
        pipes = null
        _b = null
    }

    override fun zoomToBounds(bounds: DoubleArray, animate: Boolean) {
        _b ?: return
        MapUtil.fit(b.map, listOf(GeoPoint(bounds[0], bounds[1]), GeoPoint(bounds[2], bounds[3])), requireContext().resources.displayMetrics.density.times(24).toInt(), animate)
    }

    override fun onPipeInfoClosed() {
        _b ?: return
        pipes?.selected = null
        b.map.invalidate()
    }

    // ------------------------------------------------------------------ Vị trí

    private fun requestPermission() {
        if (locHelper.hasPermission()) return
        if (!shouldShowRequestPermissionRationale(android.Manifest.permission.ACCESS_FINE_LOCATION) &&
            Prefs.onboardingDone && b.tvLocationError.visibility == View.VISIBLE
        ) {
            requireContext().openAppSettings()
        } else {
            permissionLauncher.launch(LocationHelper.LOCATION_PERMISSIONS)
        }
    }

    private fun updatePermissionUi() {
        _b ?: return
        b.tvLocationError.visible(!locHelper.hasPermission())
    }

    private fun startLocation() {
        _b ?: return
        updatePermissionUi()
        if (!locHelper.isLocationEnabled()) promptEnableGps()
        if (currentLocation == null) b.mapProgressbar.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            val last = locHelper.getLastKnown()
            if (last != null && currentLocation == null) onLocation(last)
            val fresh = locHelper.getCurrentLocation()
            if (fresh != null) onLocation(fresh)
            _b?.mapProgressbar?.visibility = View.GONE
        }
        if (Prefs.autoGpsUpdate) locHelper.startUpdates(5000L) { onLocation(it) }
    }

    private fun promptEnableGps() {
        if (!LocationHelper.isPlayServicesAvailable(requireContext())) {
            requireContext().toast(R.string.gps_not_enabled); return
        }
        val req = LocationSettingsRequest.Builder()
            .addLocationRequest(LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000).build())
            .setAlwaysShow(true).build()
        LocationServices.getSettingsClient(requireActivity()).checkLocationSettings(req)
            .addOnFailureListener { e ->
                if (e is ResolvableApiException && isAdded) {
                    runCatching { gpsLauncher.launch(IntentSenderRequest.Builder(e.resolution).build()) }
                }
            }
    }

    private fun onLocation(l: Location) {
        _b ?: return
        b.mapProgressbar.visibility = View.GONE
        currentLocation = l
        val p = GeoPoint(l.latitude, l.longitude)
        val m = currentMarker ?: Marker(b.map).also {
            it.icon = MapUtil.drawable(requireContext(), R.drawable.ic_current_dot)
            it.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
            it.setOnMarkerClickListener { _, _ -> goToCurrent(); true }
            it.setInfoWindow(null as InfoWindow?)
            b.map.overlays.add(it)
            currentMarker = it
        }
        m.position = p
        if (selIsCurrent) {
            setSelected(l.latitude, l.longitude, isCurrent = true, animate = !hasCentered)
            hasCentered = true
        }
        b.map.invalidate()
    }

    private fun goToCurrent() {
        if (!locHelper.hasPermission()) { requestPermission(); return }
        val l = currentLocation
        if (l == null) {
            requireContext().toast(R.string.finding_location); startLocation(); return
        }
        setSelected(l.latitude, l.longitude, isCurrent = true, animate = true)
        if (!Prefs.autoGpsUpdate) startLocation()
    }

    /** Hiện một vị trí cụ thể (từ tìm kiếm hoặc link chia sẻ). */
    fun showLocation(lat: Double, lng: Double, name: String?, address: String? = null) {
        if (_b == null) return
        setSelected(lat, lng, isCurrent = false, animate = true, name = name, address = address)
    }

    private fun setSelected(
        lat: Double, lng: Double, isCurrent: Boolean, animate: Boolean = false,
        name: String? = null, address: String? = null,
    ) {
        _b ?: return
        selLat = lat; selLng = lng; selIsCurrent = isCurrent
        selName = if (isCurrent) null else name
        val p = GeoPoint(lat, lng)
        if (isCurrent) {
            pinMarker?.let { b.map.overlays.remove(it) }; pinMarker = null
        } else {
            val m = pinMarker ?: Marker(b.map).also {
                it.icon = MapUtil.drawable(requireContext(), R.drawable.ic_marker_pin)
                it.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                it.setInfoWindow(null as InfoWindow?)
                it.setOnMarkerClickListener { _, _ -> true }
                b.map.overlays.add(it)
                pinMarker = it
            }
            m.position = p
        }
        if (animate) MapUtil.moveTo(b.map, p, if (b.map.zoomLevelDouble < 15) 17.0 else null)
        b.map.invalidate()
        updateCoordinatesUi()
        if (address != null) {
            selAddress = address; geocodedAt = p; b.details.tvAddress.text = address
        } else {
            reverseGeocode(p)
        }
    }

    private fun reverseGeocode(p: GeoPoint) {
        val prev = geocodedAt
        if (prev != null && prev.distanceToAsDouble(p) < 15 && selAddress != null) return
        geocodeJob?.cancel()
        b.details.progressBar.visibility = View.VISIBLE
        if (selAddress == null) b.details.tvAddress.text = ""
        geocodeJob = viewLifecycleOwner.lifecycleScope.launch {
            val addr = GeocoderHelper.reverse(requireContext(), p.latitude, p.longitude)
            _b ?: return@launch
            b.details.progressBar.visibility = View.GONE
            geocodedAt = p
            selAddress = addr ?: ""
            b.details.tvAddress.text = addr ?: when {
                !GeocoderHelper.isAvailable() -> getString(R.string.geocoder_not_available)
                !requireContext().isOnline() -> getString(R.string.no_internet_connection)
                else -> ""
            }
        }
    }

    private fun updateCoordinatesUi() {
        _b ?: return
        val d = b.details
        val lat = selLat
        val lng = selLng
        val utm = Prefs.coordFormat == "UTM"
        d.lblFirst.setText(if (utm) R.string.utm_northing else R.string.latitude)
        d.lblSecond.setText(if (utm) R.string.utm_easting else R.string.longitude)
        d.lblZone.visible(utm); d.sepZone.visible(utm); d.tvZone.visible(utm)
        if (lat == null || lng == null) {
            d.tvLat.text = "—"; d.tvLong.text = "—"; d.tvZone.text = "—"
            d.tvAddress.text = getString(R.string.finding_location)
            d.tvAccuracy.visibility = View.GONE
            return
        }
        val disp = Coords.display(requireContext(), lat, lng)
        d.tvLat.text = disp.first
        d.tvLong.text = disp.second
        d.tvZone.text = disp.zone ?: ""
        val acc = currentLocation?.takeIf { selIsCurrent && it.hasAccuracy() }?.accuracy
        if (acc != null) {
            d.tvAccuracy.text = getString(R.string.accuracy_title_text, acc.toInt().coerceAtLeast(1))
            d.tvAccuracy.visibility = View.VISIBLE
        } else {
            d.tvAccuracy.visibility = View.GONE
        }
    }

    private fun setCollapsed(collapsed: Boolean) {
        Prefs.isMapFull = collapsed
        b.llContents.visible(!collapsed)
    }

    private fun updateLiveBadge() {
        _b?.details?.tvLiveSharingStatus?.visible(Prefs.isLiveActive)
    }

    fun openLiveStatus() {
        if (Prefs.isLiveActive) LiveStatusSheet().show(childFragmentManager, "live_status")
    }

    // ------------------------------------------------------------------ Hành động

    private fun copyCoordinates() {
        val lat = selLat ?: run { requireContext().toast(R.string.msg_nothing_to_copy); return }
        val lng = selLng!!
        val text = buildString {
            append(Coords.displayInline(requireContext(), lat, lng))
            selAddress?.takeIf { it.isNotBlank() }?.let { append('\n').append(it) }
        }
        ShareUtil.copy(requireContext(), text)
    }

    private fun saveSelected() {
        val lat = selLat ?: run { requireContext().toast(R.string.msg_no_location_to_save); return }
        val lng = selLng!!
        if (Prefs.driveMode) {
            val title = selName ?: selAddress?.split(",")?.firstOrNull()?.trim()?.takeIf { it.isNotBlank() }
                ?: getString(R.string.untitled_location, Formats.date(System.currentTimeMillis()))
            val loc = SavedLocation(latitude = lat, longitude = lng, title = title, address = selAddress.orEmpty())
            viewLifecycleOwner.lifecycleScope.launch {
                withContext(Dispatchers.IO) { Db.get(requireContext()).insertLocation(loc) }
                DataBus.notifyChanged()
                requireContext().toast(getString(R.string.drive_mode_saved, title))
            }
            return
        }
        SaveLocationDialog.newFromMap(lat, lng, selAddress, selName).show(childFragmentManager, SaveLocationDialog.TAG)
    }

    private fun shareSelected() {
        val lat = selLat ?: run { requireContext().toast(R.string.msg_no_location_to_share); return }
        val lng = selLng!!
        if (Prefs.sharingMode == 1) {
            ShareUtil.share(requireContext(), SavedLocation(latitude = lat, longitude = lng,
                title = selName.orEmpty(), address = selAddress.orEmpty()))
        } else {
            ShareLocationSheet.newInstance(lat, lng, selAddress, selName).show(childFragmentManager, "share_sheet")
        }
    }
}
