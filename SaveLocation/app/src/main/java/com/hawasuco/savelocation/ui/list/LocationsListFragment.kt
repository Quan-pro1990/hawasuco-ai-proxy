package com.hawasuco.savelocation.ui.list

import android.content.Intent
import android.graphics.Color
import android.graphics.Point
import android.location.Location
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.widget.SwitchCompat
import androidx.core.os.bundleOf
import androidx.core.view.MenuProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.Prefs.ListField
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.CustomInfoWindowBinding
import com.hawasuco.savelocation.databinding.DialogRadiusBinding
import com.hawasuco.savelocation.databinding.DialogSwitchListBinding
import com.hawasuco.savelocation.databinding.FragmentLocationListBinding
import com.hawasuco.savelocation.geofence.GeofenceManager
import com.hawasuco.savelocation.ui.HomeActivity
import com.hawasuco.savelocation.ui.ShowOnMapActivity
import com.hawasuco.savelocation.ui.dialogs.ImageViewerDialog
import com.hawasuco.savelocation.ui.dialogs.SaveLocationDialog
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.MapUtil
import com.hawasuco.savelocation.util.ShareUtil
import com.hawasuco.savelocation.util.confirm
import com.hawasuco.savelocation.util.dp
import com.hawasuco.savelocation.util.hideKeyboard
import com.hawasuco.savelocation.util.singleChoice
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.events.DelayedMapListener
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon
import org.osmdroid.views.overlay.infowindow.InfoWindow

/**
 * Danh sách vị trí đã lưu (tất cả / theo nhóm / yêu thích) với 2 tab Danh sách – Bản đồ,
 * tìm kiếm, tùy chọn hiển thị, chế độ sửa (chọn nhiều để xoá), sắp xếp.
 */
class LocationsListFragment : Fragment(), LocationsAdapter.Listener, HomeActivity.BackHandler {
    private var _b: FragmentLocationListBinding? = null
    private val b get() = _b!!

    private lateinit var adapter: LocationsAdapter
    private var all: List<SavedLocation> = emptyList()
    private var groups: Map<String, LocationGroup> = emptyMap()
    private var current: Location? = null
    private var mapTab = false
    private var mapFitted = false
    private var loadJob: Job? = null
    private val markers = ArrayList<Marker>()
    private var radiusCircle: Polygon? = null
    private var currentMarker: Marker? = null

    private val mode get() = requireArguments().getInt(ARG_MODE)
    private val groupId get() = requireArguments().getString(ARG_GROUP)

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentLocationListBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = LocationsAdapter(viewLifecycleOwner.lifecycleScope, this)
        b.listview.layoutManager = LinearLayoutManager(requireContext())
        b.listview.adapter = adapter

        b.segmentedGroup.addOnButtonCheckedListener { _, id, checked ->
            if (checked) setMapTab(id == R.id.rb_map)
        }
        b.ivCustomize.setOnClickListener { showCustomize() }
        b.ivEdit.setOnClickListener { setEditMode(true) }
        b.tvDone.setOnClickListener { setEditMode(false) }
        b.ivRadius.setOnClickListener { showRadiusDialog() }
        b.btnMapType.setOnClickListener { MapUtil.showTypeChooser(requireContext()) { MapUtil.applyType(b.map, it) } }
        b.checkbox.setOnCheckedChangeListener { btn, checked ->
            if (!btn.isPressed) return@setOnCheckedChangeListener
            adapter.items.forEach { it.selected = checked }
            adapter.notifyDataSetChanged()
            onSelectionChanged()
        }
        b.tvSelectAll.setOnClickListener { b.checkbox.performClick() }
        b.btnDeleteAll.setOnClickListener { deleteSelected() }
        b.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) = applyFilter()
        })

        MapUtil.setup(b.map, 5.0)
        b.map.addMapListener(DelayedMapListener(object : MapListener {
            override fun onScroll(event: ScrollEvent?) = false.also { if (mapTab) renderMarkers() }
            override fun onZoom(event: ZoomEvent?) = false.also { if (mapTab) renderMarkers() }
        }, 250))

        requireActivity().addMenuProvider(object : MenuProvider {
            override fun onCreateMenu(menu: Menu, menuInflater: MenuInflater) = menuInflater.inflate(R.menu.menu_list, menu)
            override fun onMenuItemSelected(item: MenuItem): Boolean = when (item.itemId) {
                R.id.action_sort -> { showSort(); true }
                R.id.action_current_location -> { (activity as? HomeActivity)?.showScreen(HomeActivity.Screen.HOME); true }
                else -> false
            }
        }, viewLifecycleOwner, Lifecycle.State.RESUMED)

        DataBus.observe(viewLifecycleOwner) { load() }
        load()
        fetchCurrentLocation()
    }

    override fun onResume() {
        super.onResume()
        b.map.onResume()
        requireActivity().title = when (mode) {
            MODE_FAVOURITES -> getString(R.string.favourites)
            MODE_GROUP -> requireArguments().getString(ARG_TITLE) ?: getString(R.string.saved_locations)
            else -> getString(R.string.saved_locations)
        }
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

    override fun onBackPressed(): Boolean {
        if (adapter.editMode) { setEditMode(false); return true }
        if (mapTab) { b.segmentedGroup.check(R.id.rb_list); return true }
        return false
    }

    // ------------------------------------------------------------------ Dữ liệu

    private fun fetchCurrentLocation() {
        val ctx = requireContext()
        if (!LocationHelper.hasLocationPermission(ctx)) return
        viewLifecycleOwner.lifecycleScope.launch {
            val h = LocationHelper(ctx)
            current = h.getLastKnown() ?: h.getCurrentLocation(8000)
            if (current != null) { computeDistances(); applyFilter() }
        }
    }

    private fun load() {
        val ctx = requireContext()
        loadJob?.cancel()
        b.progressbar.visibility = View.VISIBLE
        loadJob = viewLifecycleOwner.lifecycleScope.launch {
            val (list, g) = withContext(Dispatchers.IO) {
                val db = Db.get(ctx)
                val l = db.getLocations(
                    groupId = if (mode == MODE_GROUP) groupId else null,
                    favoritesOnly = mode == MODE_FAVOURITES,
                )
                l to db.getGroups().associateBy { it.id }
            }
            val selectedIds = all.filter { it.selected }.map { it.id }.toSet()
            list.forEach { it.selected = it.id in selectedIds }
            all = list
            groups = g
            adapter.groups = g
            computeDistances()
            b.progressbar.visibility = View.GONE
            applyFilter()
        }
    }

    private fun computeDistances() {
        val c = current ?: return
        all.forEach { it.distanceMeters = Formats.distanceMeters(c.latitude, c.longitude, it.latitude, it.longitude) }
    }

    private fun applyFilter() {
        _b ?: return
        val q = b.etSearch.text.toString().trim().lowercase()
        var list = if (q.isEmpty()) all else all.filter {
            it.title.lowercase().contains(q) || it.address.lowercase().contains(q) || it.note.lowercase().contains(q)
        }
        list = when (Prefs.sortBy) {
            1 -> list.sortedWith(compareBy<SavedLocation> { it.dateMillis }.thenBy { it.id })
            2 -> list.sortedWith(compareBy(nullsLast()) { it.distanceMeters })
            3 -> list.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.title })
            else -> list.sortedWith(compareByDescending<SavedLocation> { it.dateMillis }.thenByDescending { it.id })
        }
        adapter.items = list
        b.tvNoData.visible(list.isEmpty() && !mapTab)
        onSelectionChanged()
        if (mapTab) renderMarkers(fit = !mapFitted)
    }

    // ------------------------------------------------------------------ Tab / chế độ sửa

    private fun setMapTab(map: Boolean) {
        mapTab = map
        if (map) { setEditMode(false); b.etSearch.hideKeyboard() }
        b.mapframelayout.visible(map)
        b.listview.visible(!map)
        b.rlSearch.visible(!map)
        b.ivEdit.visible(!map && !adapter.editMode)
        b.ivRadius.visible(map)
        b.ivCustomize.visibility = if (map) View.INVISIBLE else View.VISIBLE
        b.tvNoData.visible(!map && adapter.items.isEmpty())
        if (map) b.map.post { renderMarkers(fit = !mapFitted) }
    }

    private fun setEditMode(on: Boolean) {
        if (on == adapter.editMode) return
        if (!on) all.forEach { it.selected = false }
        adapter.editMode = on
        b.ivEdit.visible(!on && !mapTab)
        b.tvDone.visible(on)
        b.etSearch.visible(!on)
        b.llDeleteAll.visible(on)
        b.checkbox.isChecked = false
        onSelectionChanged()
    }

    override fun onSelectionChanged() {
        _b ?: return
        val n = adapter.items.count { it.selected }
        b.tvSelectionCount.text = if (adapter.editMode) "$n/${adapter.items.size}" else ""
        b.checkbox.isChecked = n > 0 && n == adapter.items.size
    }

    private fun deleteSelected() {
        val ids = adapter.items.filter { it.selected }.map { it.id }
        if (ids.isEmpty()) { requireContext().toast(R.string.nothing_to_delete); return }
        requireContext().confirm(R.string.ask_delete_location_title, getString(R.string.ask_delete_multiple_location, ids.size), R.string.delete) {
            deleteIds(ids)
            setEditMode(false)
        }
    }

    private fun deleteIds(ids: List<Long>) {
        val ctx = requireContext().applicationContext
        viewLifecycleOwner.lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                Db.get(ctx).deleteLocations(ids)
                GeofenceManager.registerAll(ctx)
            }
            DataBus.notifyChanged()
        }
    }

    // ------------------------------------------------------------------ Hộp thoại

    private fun showSort() {
        val items = listOf(getString(R.string.date_descending), getString(R.string.date_ascending),
            getString(R.string.distance), getString(R.string.alphabetic))
        requireContext().singleChoice(R.string.sort_by, items, Prefs.sortBy) {
            Prefs.sortBy = it
            if (it == 2 && current == null) fetchCurrentLocation()
            applyFilter()
        }
    }

    private fun showCustomize() {
        val ctx = requireContext()
        val db = DialogSwitchListBinding.inflate(layoutInflater)
        db.tvTitle.setText(R.string.set_customization)
        val fields = listOf(
            ListField.TITLE to R.string.title, ListField.IMAGE to R.string.image, ListField.ADDRESS to R.string.address,
            ListField.COORDS to R.string.coordinates, ListField.CONTACT to R.string.contact_number, ListField.NOTE to R.string.note,
            ListField.DATE to R.string.date, ListField.DISTANCE to R.string.distance, ListField.GROUP to R.string.group,
        )
        fields.forEach { (key, label) ->
            if (key == ListField.GROUP && !Prefs.groupMode) return@forEach
            db.container.addView(SwitchCompat(ctx).apply {
                setText(label)
                textSize = 16f
                minHeight = ctx.dp(48)
                isChecked = Prefs.listField(key)
                setOnCheckedChangeListener { _, c -> Prefs.setListField(key, c); adapter.notifyDataSetChanged() }
            })
        }
        val dialog = AlertDialog.Builder(ctx).setView(db.root).create()
        db.ivClose.setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    private fun showRadiusDialog() {
        val ctx = requireContext()
        val rb = DialogRadiusBinding.inflate(layoutInflater)
        rb.tilRadius.hint = getString(R.string.radius_hint, Formats.distanceUnitLabel(ctx))
        rb.etSetRadius.setText(Prefs.mapRadius.toString())
        rb.switchClustering.isChecked = Prefs.clusterMarkers
        AlertDialog.Builder(ctx)
            .setTitle(R.string.set_radius)
            .setView(rb.root)
            .setPositiveButton(R.string.apply) { _, _ ->
                Prefs.mapRadius = rb.etSetRadius.text.toString().toIntOrNull()?.coerceAtLeast(0) ?: 0
                Prefs.clusterMarkers = rb.switchClustering.isChecked
                if (Prefs.mapRadius > 0 && current == null) fetchCurrentLocation()
                renderMarkers(fit = true)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    // ------------------------------------------------------------------ Bản đồ

    private fun mapItems(): List<SavedLocation> {
        val c = current
        val r = Prefs.mapRadius
        return if (r > 0 && c != null) {
            val meters = Formats.radiusToMeters(r)
            adapter.items.filter { (it.distanceMeters ?: Double.MAX_VALUE) <= meters }
        } else adapter.items
    }

    private fun renderMarkers(fit: Boolean = false) {
        val map = _b?.map ?: return
        InfoWindow.closeAllInfoWindowsOn(map)
        markers.forEach { map.overlays.remove(it) }
        markers.clear()
        radiusCircle?.let { map.overlays.remove(it) }; radiusCircle = null
        currentMarker?.let { map.overlays.remove(it) }; currentMarker = null

        val items = mapItems()
        val ctx = requireContext()
        val c = current
        if (c != null) {
            currentMarker = Marker(map).apply {
                position = GeoPoint(c.latitude, c.longitude)
                icon = MapUtil.drawable(ctx, R.drawable.ic_current_dot)
                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                setInfoWindow(null as InfoWindow?)
            }
            map.overlays.add(currentMarker)
            if (Prefs.mapRadius > 0) {
                radiusCircle = Polygon(map).apply {
                    setPoints(Polygon.pointsAsCircle(GeoPoint(c.latitude, c.longitude), Formats.radiusToMeters(Prefs.mapRadius)))
                    fillPaint.color = Color.argb(30, 2, 136, 209)
                    outlinePaint.color = Color.argb(160, 2, 136, 209)
                    outlinePaint.strokeWidth = 3f
                    setInfoWindow(null as InfoWindow?)
                }
                map.overlays.add(0, radiusCircle)
            }
        }

        if (fit && items.isNotEmpty() && map.width > 0) {
            mapFitted = true
            MapUtil.fit(map, items.map { GeoPoint(it.latitude, it.longitude) }, ctx.dp(40), animate = false)
            // Vẽ lại sau khi bản đồ đã đổi khung nhìn
            viewLifecycleOwner.lifecycleScope.launch { delay(150); renderMarkers(false) }
            return
        }

        val clusters = if (Prefs.clusterMarkers) cluster(map, items) else items.map { listOf(it) }
        clusters.forEach { group ->
            val m = Marker(map)
            if (group.size == 1) {
                val loc = group[0]
                m.position = GeoPoint(loc.latitude, loc.longitude)
                m.icon = MapUtil.pin(ctx, loc.groupId?.let { groups[it]?.color } ?: Color.parseColor("#E53935"))
                m.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                m.title = loc.title
                m.setInfoWindow(LocationInfoWindow(map, loc))
            } else {
                val lat = group.map { it.latitude }.average()
                val lng = group.map { it.longitude }.average()
                m.position = GeoPoint(lat, lng)
                m.icon = MapUtil.clusterIcon(ctx, group.size)
                m.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                m.setInfoWindow(null as InfoWindow?)
                m.setOnMarkerClickListener { _, mv ->
                    MapUtil.fit(mv, group.map { GeoPoint(it.latitude, it.longitude) }, ctx.dp(40))
                    true
                }
            }
            markers += m
            map.overlays.add(m)
        }
        map.invalidate()
    }

    /** Gom các điểm gần nhau trên màn hình (ô lưới ~56dp) thành một cụm. */
    private fun cluster(map: MapView, items: List<SavedLocation>): List<List<SavedLocation>> {
        val cell = requireContext().dp(56)
        val proj = map.projection
        val buckets = LinkedHashMap<Long, MutableList<SavedLocation>>()
        val pt = Point()
        items.forEach {
            proj.toPixels(GeoPoint(it.latitude, it.longitude), pt)
            val key = (Math.floorDiv(pt.x, cell).toLong() shl 32) or (Math.floorDiv(pt.y, cell).toLong() and 0xffffffffL)
            buckets.getOrPut(key) { mutableListOf() }.add(it)
        }
        return buckets.values.toList()
    }

    /** Cửa sổ thông tin khi chạm vào điểm trên bản đồ (giống custom_info_window của app gốc). */
    private inner class LocationInfoWindow(map: MapView, private val loc: SavedLocation) :
        InfoWindow(R.layout.custom_info_window, map) {
        override fun onOpen(item: Any?) {
            closeAllInfoWindowsOn(mapView)
            val v = CustomInfoWindowBinding.bind(view)
            val ctx = view.context
            v.tvItemTitle.text = loc.title
            v.tvItemAddress.visible(loc.address.isNotBlank())
            v.tvItemAddress.text = loc.address
            v.tvItemCoordinates.text = Coords.displayInline(ctx, loc.latitude, loc.longitude)
            v.tvItemNote.visible(loc.note.isNotBlank())
            v.tvItemNote.text = loc.note
            v.tvItemDate.text = Formats.date(loc.dateMillis)
            v.tvItemDistance.visible(loc.distanceMeters != null)
            loc.distanceMeters?.let { v.tvItemDistance.text = getString(R.string.route_distance, Formats.distance(ctx, it)) }
            v.flImage.visible(loc.images.isNotEmpty())
            v.tvImagesCount.visible(loc.images.size > 1)
            v.tvImagesCount.text = loc.images.size.toString()
            ImageStore.loadThumb(viewLifecycleOwner.lifecycleScope, v.ivLocationImage, loc.images.firstOrNull(), 160, R.drawable.ic_image)
            view.setOnClickListener { close(); onShowOnMap(loc) }
        }

        override fun onClose() {}
    }

    // ------------------------------------------------------------------ Thao tác trên thẻ

    override fun onItemClick(loc: SavedLocation) = onShowOnMap(loc)

    override fun onImageClick(loc: SavedLocation) {
        ImageViewerDialog.newInstance(loc.images, 0).show(childFragmentManager, "viewer")
    }

    override fun onFavourite(loc: SavedLocation) {
        val ctx = requireContext().applicationContext
        loc.favorite = !loc.favorite
        viewLifecycleOwner.lifecycleScope.launch {
            withContext(Dispatchers.IO) { Db.get(ctx).setFavorite(loc.id, loc.favorite) }
            ctx.toast(if (loc.favorite) R.string.added_to_favourites else R.string.removed_from_favourites)
            if (mode == MODE_FAVOURITES) DataBus.notifyChanged() else adapter.notifyDataSetChanged()
        }
    }

    override fun onShowOnMap(loc: SavedLocation) {
        startActivity(Intent(requireContext(), ShowOnMapActivity::class.java).putExtra(ShowOnMapActivity.EXTRA_ID, loc.id))
    }

    override fun onEdit(loc: SavedLocation) {
        SaveLocationDialog.newEdit(loc.id).show(childFragmentManager, SaveLocationDialog.TAG)
    }

    override fun onShare(loc: SavedLocation) = ShareUtil.share(requireContext(), loc)

    override fun onCopy(loc: SavedLocation) = ShareUtil.copyLocation(requireContext(), loc)

    override fun onDelete(loc: SavedLocation) {
        requireContext().confirm(R.string.ask_delete_location_title, getString(R.string.ask_delete_location), R.string.delete) {
            deleteIds(listOf(loc.id))
        }
    }

    companion object {
        const val MODE_ALL = 0
        const val MODE_GROUP = 1
        const val MODE_FAVOURITES = 2
        private const val ARG_MODE = "mode"
        private const val ARG_GROUP = "group"
        private const val ARG_TITLE = "title"

        fun newInstance(mode: Int, groupId: String? = null, title: String? = null) = LocationsListFragment().apply {
            arguments = bundleOf(ARG_MODE to mode, ARG_GROUP to groupId, ARG_TITLE to title)
        }
    }
}
