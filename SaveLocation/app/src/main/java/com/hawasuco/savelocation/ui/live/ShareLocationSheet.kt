package com.hawasuco.savelocation.ui.live

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.DialogShareLiveLocationBinding
import com.hawasuco.savelocation.databinding.ItemDurationRowBinding
import com.hawasuco.savelocation.live.LiveApi
import com.hawasuco.savelocation.live.LiveLocationService
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.GeocoderHelper
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.ShareUtil
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Bảng "Chia sẻ vị trí" với 2 lựa chọn: Vị trí hiện tại (một lần, kèm link bản đồ)
 * và Vị trí trực tiếp (chọn thời gian 30 phút / 1 / 4 / 8 giờ — tất cả miễn phí).
 */
class ShareLocationSheet : BottomSheetDialogFragment() {
    private var _b: DialogShareLiveLocationBinding? = null
    private val b get() = _b!!

    private var lat: Double? = null
    private var lng: Double? = null
    private var address: String? = null
    private var live = false
    private var durationIdx = 1
    private val durations = listOf(30, 60, 240, 480) // phút
    private val durationRows = ArrayList<ItemDurationRowBinding>()

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        if (LocationHelper.hasLocationPermission(requireContext())) startLive()
        else requireContext().toast(R.string.msg_location_permission_live_location, long = true)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogShareLiveLocationBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.apply { state = BottomSheetBehavior.STATE_EXPANDED; skipCollapsed = true }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val args = requireArguments()
        if (args.containsKey(ARG_LAT)) { lat = args.getDouble(ARG_LAT); lng = args.getDouble(ARG_LNG) }
        address = args.getString(ARG_ADDRESS)
        live = args.getBoolean(ARG_LIVE, Prefs.sharingMode == 0)
        b.etLocationName.setText(args.getString(ARG_NAME).orEmpty())
        b.etDisplayName.setText(Prefs.displayName)

        durations.forEachIndexed { i, min ->
            val row = ItemDurationRowBinding.inflate(layoutInflater, b.layoutDurationList, false)
            row.tvDuration.setText(listOf(R.string.duration_30_min, R.string.duration_1_hour, R.string.duration_4_hours, R.string.duration_8_hours)[i])
            row.tvShareUntil.text = getString(R.string.share_until_time, Formats.timeShort(System.currentTimeMillis() + min * 60_000L))
            row.root.setOnClickListener { durationIdx = i; renderDurations() }
            durationRows += row
            b.layoutDurationList.addView(row.root)
        }
        renderDurations()

        b.layoutLocationTypeToggle.check(if (live) R.id.segmentLiveLocation else R.id.segmentCurrentLocation)
        b.layoutLocationTypeToggle.addOnButtonCheckedListener { _, id, checked -> if (checked) { live = id == R.id.segmentLiveLocation; renderMode() } }
        renderMode()
        renderCurrent()
        if (lat == null) loadCurrent()

        b.btnStartLiveSharing.setOnClickListener { if (live) startLiveChecked() else shareOnce() }
    }

    private fun loadCurrent() {
        val ctx = requireContext()
        if (!LocationHelper.hasLocationPermission(ctx)) return
        viewLifecycleOwner.lifecycleScope.launch {
            val l = LocationHelper(ctx).getCurrentLocation(10000) ?: return@launch
            lat = l.latitude; lng = l.longitude
            renderCurrent()
            address = GeocoderHelper.reverse(ctx, l.latitude, l.longitude)
            renderCurrent()
        }
    }

    private fun renderDurations() {
        durationRows.forEachIndexed { i, r -> r.radio.isChecked = i == durationIdx }
    }

    private fun renderMode() {
        b.layoutCurrentLocationSection.visible(!live)
        b.layoutLiveSection.visible(live)
        b.tvServerWarning.visible(live && Prefs.liveServerUrl.isBlank())
        b.tvStartLiveSharing.setText(if (live) R.string.start_live_sharing else R.string.share_location)
        b.ivStartLiveSharing.setImageResource(if (live) R.drawable.ic_broadcast else R.drawable.ic_share)
    }

    private fun renderCurrent() {
        _b ?: return
        val la = lat
        val lo = lng
        if (la == null || lo == null) {
            b.tvCurrentLatitude.setText(R.string.finding_location); b.tvCurrentLongitude.text = ""
            return
        }
        val d = Coords.display(requireContext(), la, lo)
        if (d.zone != null) {
            b.tvCurrentLatitude.text = "${getString(R.string.utm_zone)}: ${d.zone}  ${getString(R.string.utm_easting)}: ${d.second}"
            b.tvCurrentLongitude.text = "${getString(R.string.utm_northing)}: ${d.first}"
        } else {
            b.tvCurrentLatitude.text = "${getString(R.string.latitude)}: ${d.first}"
            b.tvCurrentLongitude.text = "${getString(R.string.longitude)}: ${d.second}"
        }
        b.tvCurrentAddress.text = address.orEmpty()
        b.tvCurrentLocationLink.text = ShareUtil.googleMapsUrl(la, lo)
    }

    private fun shareOnce() {
        val la = lat ?: run { requireContext().toast(R.string.msg_no_location_to_share); return }
        val lo = lng!!
        ShareUtil.share(requireContext(), SavedLocation(latitude = la, longitude = lo,
            title = b.etLocationName.text.toString().trim(), address = address.orEmpty()))
        dismiss()
    }

    private fun startLiveChecked() {
        val ctx = requireContext()
        if (Prefs.liveServerUrl.isBlank()) { ctx.toast(R.string.live_server_not_configured, long = true); return }
        if (!LocationHelper.hasLocationPermission(ctx)) {
            val perms = LocationHelper.LOCATION_PERMISSIONS.toMutableList()
            if (Build.VERSION.SDK_INT >= 33) perms += Manifest.permission.POST_NOTIFICATIONS
            permLauncher.launch(perms.toTypedArray()); return
        }
        if (Build.VERSION.SDK_INT >= 33) permLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        else startLive()
    }

    private fun startLive() {
        val ctx = requireContext().applicationContext
        val name = b.etDisplayName.text.toString().trim()
        Prefs.displayName = name
        val id = LiveApi.randomId(10)
        val token = LiveApi.randomId(32)
        val expires = System.currentTimeMillis() + durations[durationIdx] * 60_000L
        b.progressStart.visibility = View.VISIBLE
        b.btnStartLiveSharing.isEnabled = false
        lifecycleScope.launch {
            val r = withContext(Dispatchers.IO) { runCatching { LiveApi.start(id, token, name, expires) } }
            _b?.progressStart?.visibility = View.GONE
            _b?.btnStartLiveSharing?.isEnabled = true
            r.onFailure { ctx.toast(ctx.getString(R.string.live_start_failed, it.message ?: ""), long = true); return@launch }
            Prefs.liveSessionId = id
            Prefs.liveToken = token
            Prefs.liveStartedAt = System.currentTimeMillis()
            Prefs.liveExpiresAt = expires
            LiveLocationService.start(ctx)
            DataBus.notifyChanged()
            shareLiveLink(requireActivity(), name, expires)
            dismissAllowingStateLoss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        private const val ARG_LAT = "lat"
        private const val ARG_LNG = "lng"
        private const val ARG_ADDRESS = "address"
        private const val ARG_NAME = "name"
        private const val ARG_LIVE = "live"

        fun newInstance(lat: Double?, lng: Double?, address: String?, name: String?, live: Boolean? = null) = ShareLocationSheet().apply {
            arguments = Bundle().apply {
                if (lat != null && lng != null) { putDouble(ARG_LAT, lat); putDouble(ARG_LNG, lng) }
                putString(ARG_ADDRESS, address); putString(ARG_NAME, name)
                if (live != null) putBoolean(ARG_LIVE, live)
            }
        }

        fun shareLiveLink(context: android.content.Context, name: String, expires: Long) {
            val link = LiveApi.linkFor(Prefs.liveSessionId)
            val until = Formats.timeShort(expires)
            val text = if (name.isNotBlank()) context.getString(R.string.live_share_message_with_name, name, until, link)
            else context.getString(R.string.live_share_message_anonymous, until, link)
            ShareUtil.shareText(context, text)
        }
    }
}
