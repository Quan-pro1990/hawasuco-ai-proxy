package com.hawasuco.savelocation.ui.network

import android.os.Bundle
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.MenuProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.FragmentNetworkBinding
import com.hawasuco.savelocation.network.PipeOverlay
import com.hawasuco.savelocation.network.PipeStore
import com.hawasuco.savelocation.network.PipeStyle
import com.hawasuco.savelocation.network.PipeSync
import com.hawasuco.savelocation.ui.view.PipeSwatchView
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.MapUtil
import com.hawasuco.savelocation.util.dp
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.infowindow.InfoWindow

/**
 * Bản đồ mạng lưới đường ống — giống trang PublishWeb/NetworkMap của SCADA:
 * chỉ các lớp đường ống, nút "Lớp", "Màu theo cỡ ống" kèm chú giải, chạm vào ống để xem thông tin.
 * Dữ liệu đọc trực tiếp từ SCADA (tự cập nhật khi web thay đổi) và lưu lại để xem khi mất mạng.
 */
class NetworkFragment : Fragment(), PipeMapHost {
    private var _b: FragmentNetworkBinding? = null
    private val b get() = _b!!
    private lateinit var overlay: PipeOverlay
    private lateinit var locHelper: LocationHelper
    private var myMarker: Marker? = null
    private var fitted = false

    private val permissionLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions(),
    ) { res -> if (res.values.any { it }) goToMyLocation() }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentNetworkBinding.inflate(inflater, container, false)
        locHelper = LocationHelper(requireContext())
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        requireActivity().title = getString(R.string.network_map)
        fitted = savedInstanceState?.getBoolean("fitted") ?: false
        MapUtil.setup(b.map, DEFAULT_ZOOM)
        b.map.controller.setCenter(GeoPoint(DEFAULT_LAT, DEFAULT_LON))
        overlay = PipeOverlay(requireContext()) { hit ->
            PipeInfoSheet.newInstance(hit).show(childFragmentManager, PipeInfoSheet.TAG)
        }
        b.map.overlays.add(overlay)

        requireActivity().addMenuProvider(object : MenuProvider {
            override fun onCreateMenu(menu: Menu, menuInflater: MenuInflater) = menuInflater.inflate(R.menu.menu_network, menu)
            override fun onPrepareMenu(menu: Menu) {
                menu.findItem(R.id.action_map_type)?.setIcon(MapUtil.typeIcon(Prefs.mapType))
                menu.findItem(R.id.action_pipe_sync)?.isEnabled = !PipeSync.running.value
            }

            override fun onMenuItemSelected(item: MenuItem): Boolean = when (item.itemId) {
                R.id.action_pipe_sync -> { syncNow(); true }
                R.id.action_map_type -> {
                    MapUtil.showTypeChooser(requireContext()) { t ->
                        MapUtil.applyType(b.map, t); requireActivity().invalidateOptionsMenu()
                    }
                    true
                }
                R.id.action_pipe_zoom_all -> { zoomToNetwork(true); true }
                R.id.action_pipe_code -> { openAccess(); true }
                else -> false
            }
        }, viewLifecycleOwner, Lifecycle.State.RESUMED)

        b.btnLayers.setOnClickListener { PipeLayersSheet().show(childFragmentManager, PipeLayersSheet.TAG) }
        b.btnPipeSize.isChecked = Prefs.pipeSizeMode
        styleSizeButton(Prefs.pipeSizeMode)
        b.btnPipeSize.addOnCheckedChangeListener { _, checked ->
            if (Prefs.pipeSizeMode != checked) {
                Prefs.pipeSizeMode = checked
                PipeStore.notifyStyleChanged()
            }
            styleSizeButton(checked)
            b.cardLegend.visible(checked)
        }
        b.cardLegend.visible(Prefs.pipeSizeMode)
        buildLegend()
        b.btnMyLocation.setOnClickListener { goToMyLocation() }
        b.btnSync.setOnClickListener { syncNow() }
        b.statusBar.setOnClickListener {
            val err = Prefs.pipeLastError
            if (!PipeSync.hasCode() || err == PipeSync.ERR_WRONG_CODE) openAccess() else syncNow()
        }
        b.btnEnterCode.setOnClickListener { if (PipeSync.hasCode()) syncNow() else openAccess() }

        viewLifecycleOwner.lifecycleScope.launch {
            PipeStore.ensureLoaded(requireContext())
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                PipeStore.version.combine(PipeSync.running) { v, r -> v to r }.collect { (_, running) ->
                    _b ?: return@collect
                    if (overlay.selected != null && PipeStore.snapshot().none { l -> l.features.any { it === overlay.selected } }) {
                        overlay.selected = null
                    }
                    b.btnPipeSize.isChecked = Prefs.pipeSizeMode
                    b.map.invalidate()
                    renderStatus(running)
                    if (!fitted && PipeStore.totalPipes() > 0) {
                        fitted = true
                        zoomToNetwork(false)
                    }
                    activity?.invalidateOptionsMenu()
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("fitted", fitted)
    }

    override fun onResume() {
        super.onResume()
        b.map.onResume()
        MapUtil.applyType(b.map, Prefs.mapType)
        PipeSync.syncIfStale(requireContext(), AUTO_SYNC_MS)
    }

    override fun onPause() {
        super.onPause()
        b.map.onPause()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        b.map.onDetach()
        _b = null
    }

    /** Nút "Màu theo cỡ ống" đang bật: nền màu chủ đạo, chữ trắng (giống nút bật trên web). */
    private fun styleSizeButton(on: Boolean) {
        val ctx = requireContext()
        val bg = ContextCompat.getColor(ctx, if (on) R.color.colorAccent else R.color.card_bg)
        val fg = ContextCompat.getColor(ctx, if (on) R.color.white else R.color.text_primary)
        b.btnPipeSize.backgroundTintList = android.content.res.ColorStateList.valueOf(bg)
        b.btnPipeSize.setTextColor(fg)
        b.btnPipeSize.iconTint = android.content.res.ColorStateList.valueOf(
            if (on) fg else ContextCompat.getColor(ctx, R.color.colorAccent),
        )
    }

    private fun buildLegend() {
        val ctx = requireContext()
        (PipeStyle.SIZE_CLASSES + PipeStyle.SIZE_UNKNOWN).forEach { c ->
            val row = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(0, ctx.dp(2), 0, ctx.dp(2))
            }
            row.addView(PipeSwatchView(ctx).apply { set(c.color, c.weight) }, LinearLayout.LayoutParams(ctx.dp(30), ctx.dp(14)))
            row.addView(TextView(ctx).apply {
                text = c.label
                textSize = 12f
                setTextColor(ContextCompat.getColor(ctx, R.color.text_primary))
                setPadding(ctx.dp(8), 0, 0, 0)
            })
            b.legendRows.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
    }

    private fun renderStatus(running: Boolean) {
        val total = PipeStore.totalPipes()
        val err = Prefs.pipeLastError
        b.progressSync.visible(running)
        b.btnSync.isEnabled = !running
        b.btnSync.alpha = if (running) 0.4f else 1f
        b.tvStatus.text = when {
            running -> getString(R.string.pipe_syncing)
            !PipeSync.hasCode() -> getString(R.string.pipe_need_code)
            err.isNotBlank() -> PipeSync.errorText(requireContext(), err) +
                (if (total > 0 && Prefs.pipeLastSync > 0) "\n" + statusLine(total) else "")
            Prefs.pipeLastSync > 0 -> statusLine(total)
            else -> getString(R.string.pipe_status_never)
        }
        val empty = total == 0 && !running
        b.cardEmpty.visible(empty)
        if (empty) {
            b.tvEmptyDesc.text = when {
                !PipeSync.hasCode() -> getString(R.string.pipe_empty_desc)
                err.isNotBlank() -> PipeSync.errorText(requireContext(), err)
                else -> getString(R.string.pipe_empty_desc)
            }
            b.btnEnterCode.setText(if (PipeSync.hasCode() && err != PipeSync.ERR_WRONG_CODE) R.string.pipe_sync_now else R.string.pipe_enter_code)
        }
    }

    private fun statusLine(total: Int) = getString(R.string.pipe_status, Formats.date(Prefs.pipeLastSync), total)

    private fun syncNow() {
        if (!PipeSync.hasCode()) { openAccess(); return }
        if (PipeSync.running.value) return
        val ctx = requireContext().applicationContext
        PipeSync.syncInBackground(ctx) { r -> ctx.toast(syncMessage(ctx, r)) }
    }

    private fun openAccess() {
        ScadaAccessDialog().show(childFragmentManager, ScadaAccessDialog.TAG)
    }

    private fun zoomToNetwork(animate: Boolean) {
        val bb = PipeOverlay.visibleBounds() ?: return
        zoomToBounds(bb, animate)
    }

    override fun zoomToBounds(bounds: DoubleArray, animate: Boolean) {
        _b ?: return
        MapUtil.fit(
            b.map,
            listOf(GeoPoint(bounds[0], bounds[1]), GeoPoint(bounds[2], bounds[3])),
            requireContext().dp(24), animate,
        )
    }

    override fun onPipeInfoClosed() {
        _b ?: return
        overlay.selected = null
        b.map.invalidate()
    }

    private fun goToMyLocation() {
        if (!locHelper.hasPermission()) { permissionLauncher.launch(LocationHelper.LOCATION_PERMISSIONS); return }
        viewLifecycleOwner.lifecycleScope.launch {
            val l = locHelper.getLastKnown() ?: locHelper.getCurrentLocation()
            _b ?: return@launch
            if (l == null) { requireContext().toast(R.string.finding_location); return@launch }
            val p = GeoPoint(l.latitude, l.longitude)
            val m = myMarker ?: Marker(b.map).also {
                it.icon = MapUtil.drawable(requireContext(), R.drawable.ic_current_dot)
                it.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                it.setInfoWindow(null as InfoWindow?)
                it.setOnMarkerClickListener { _, _ -> true }
                b.map.overlays.add(it)
                myMarker = it
            }
            m.position = p
            MapUtil.moveTo(b.map, p, if (b.map.zoomLevelDouble < 16) 17.0 else null)
            b.map.invalidate()
        }
    }

    companion object {
        /** Tâm & mức zoom mặc định của bản đồ mạng lưới trên web SCADA. */
        const val DEFAULT_LAT = 9.78
        const val DEFAULT_LON = 105.47
        const val DEFAULT_ZOOM = 12.0

        /** Màn hình mạng lưới tự kiểm tra cập nhật nếu lần trước đã quá 10 phút. */
        const val AUTO_SYNC_MS = 10 * 60 * 1000L

        fun syncMessage(ctx: android.content.Context, r: PipeSync.Result): String = when {
            !r.ok -> PipeSync.errorText(ctx, r.error)
            r.changedLayers > 0 -> ctx.getString(R.string.pipe_changed, r.changedLayers)
            else -> ctx.getString(R.string.pipe_no_change)
        }
    }
}

/** Màn hình có bản đồ đường ống (để các bảng con điều khiển bản đồ). */
interface PipeMapHost {
    fun zoomToBounds(bounds: DoubleArray, animate: Boolean = true)
    fun onPipeInfoClosed()
}
