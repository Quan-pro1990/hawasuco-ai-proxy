package com.hawasuco.savelocation.ui.dialogs

import android.app.Activity
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.os.bundleOf
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.DialogSaveLocationBinding
import com.hawasuco.savelocation.geofence.GeofenceManager
import com.hawasuco.savelocation.ui.ChangeLocationActivity
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.GeocoderHelper
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.MapUtil
import com.hawasuco.savelocation.util.hideKeyboard
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Calendar
import java.util.Locale

/**
 * Bảng "Lưu vị trí": ảnh, tọa độ (nhập thập phân hoặc độ-phút-giây, hoặc xem UTM), tên, ngày (khi sửa),
 * địa chỉ, số điện thoại, ghi chú, nhóm. Dùng cho 3 trường hợp: lưu từ bản đồ, thêm vị trí mới, sửa vị trí.
 */
class SaveLocationDialog : BottomSheetDialogFragment() {
    private var _b: DialogSaveLocationBinding? = null
    private val b get() = _b!!

    private var mode = MODE_MAP
    private var editing: SavedLocation? = null
    private val images = mutableListOf<String>()
    private val newImages = mutableListOf<String>()
    private var groupId: String? = null
    private var dateMillis = System.currentTimeMillis()
    private var nsNegative = false
    private var ewNegative = false
    private var saved = false

    private val picker = ImagePicker(this) { f -> addImage(f.absolutePath) }

    private val changeLocationLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val d = r.data ?: return@registerForActivityResult
        if (r.resultCode != Activity.RESULT_OK) return@registerForActivityResult
        setCoordinates(d.getDoubleExtra(ChangeLocationActivity.EXTRA_LAT, 0.0), d.getDoubleExtra(ChangeLocationActivity.EXTRA_LNG, 0.0))
        d.getStringExtra(ChangeLocationActivity.EXTRA_ADDRESS)?.takeIf { it.isNotBlank() }?.let { b.etAddress.setText(it) }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogSaveLocationBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            skipCollapsed = true
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val args = requireArguments()
        mode = args.getInt(ARG_MODE)
        val ctx = requireContext()

        childFragmentManager.setFragmentResultListener(SelectGroupSheet.RESULT, viewLifecycleOwner) { _, bundle ->
            groupId = bundle.getString(SelectGroupSheet.KEY_GROUP_ID)
            showGroup()
        }
        childFragmentManager.setFragmentResultListener(ImageUploadDialog.RESULT, viewLifecycleOwner) { _, bundle ->
            val list = bundle.getStringArrayList(ImageUploadDialog.KEY_IMAGES) ?: arrayListOf()
            bundle.getStringArrayList(ImageUploadDialog.KEY_NEW)?.let { newImages.addAll(it) }
            images.clear(); images.addAll(list)
            showImages()
        }

        if (savedInstanceState == null) {
            when (mode) {
                MODE_EDIT -> {
                    val id = args.getLong(ARG_ID)
                    viewLifecycleOwner.lifecycleScope.launch {
                        val loc = withContext(Dispatchers.IO) { Db.get(ctx).getLocation(id) }
                        if (loc == null) { dismissAllowingStateLoss(); return@launch }
                        editing = loc
                        fill(loc)
                    }
                }
                MODE_ADD -> {
                    b.etLat.setText(""); b.etLng.setText("")
                    if (args.containsKey(ARG_LAT)) setCoordinates(args.getDouble(ARG_LAT), args.getDouble(ARG_LNG))
                    else prefillCurrentLocation()
                }
                else -> {
                    setCoordinates(args.getDouble(ARG_LAT), args.getDouble(ARG_LNG))
                    b.etAddress.setText(args.getString(ARG_ADDRESS).orEmpty())
                    b.etTitle.setText(args.getString(ARG_NAME).orEmpty())
                }
            }
        }

        val utm = Prefs.coordFormat == "UTM" && mode != MODE_ADD
        b.llDdContainer.visible(!utm)
        b.llUtmContainer.visible(utm)
        b.tilDate.visible(mode == MODE_EDIT)
        b.tilGroup.visible(Prefs.groupMode)
        showGroup()
        showImages()

        b.switchLatLongDMS.setOnCheckedChangeListener { _, checked -> toggleDms(checked) }
        b.btnNS.setOnClickListener { nsNegative = !nsNegative; b.btnNS.setText(if (nsNegative) R.string.south else R.string.north) }
        b.btnEW.setOnClickListener { ewNegative = !ewNegative; b.btnEW.setText(if (ewNegative) R.string.west else R.string.east) }
        b.imgChangeLocation.setOnClickListener {
            val (lat, lng) = readCoordinates(silent = true) ?: (null to null)
            changeLocationLauncher.launch(Intent(ctx, ChangeLocationActivity::class.java).apply {
                if (lat != null && lng != null) {
                    putExtra(ChangeLocationActivity.EXTRA_LAT, lat); putExtra(ChangeLocationActivity.EXTRA_LNG, lng)
                }
            })
        }
        b.cvLocationImage.setOnClickListener { openImageDialog() }
        b.ivCameraFab.setOnClickListener {
            if (images.size >= SavedLocation.MAX_IMAGES) openImageDialog() else picker.takePhoto()
        }
        b.etGroup.setOnClickListener { pickGroup() }
        b.tilGroup.setEndIconOnClickListener { pickGroup() }
        b.etDate.setOnClickListener { pickDate() }
        b.tilDate.setEndIconOnClickListener { pickDate() }
        b.btnCancel.setOnClickListener { dismiss() }
        b.btnSave.setOnClickListener { save() }
    }

    private fun prefillCurrentLocation() {
        val ctx = requireContext()
        if (!LocationHelper.hasLocationPermission(ctx)) return
        viewLifecycleOwner.lifecycleScope.launch {
            val l = LocationHelper(ctx).getLastKnown() ?: return@launch
            if (_b != null && b.etLat.text.isNullOrBlank()) {
                setCoordinates(l.latitude, l.longitude)
                GeocoderHelper.reverse(ctx, l.latitude, l.longitude)?.let { if (_b != null && b.etAddress.text.isNullOrBlank()) b.etAddress.setText(it) }
            }
        }
    }

    private fun fill(loc: SavedLocation) {
        setCoordinates(loc.latitude, loc.longitude)
        b.etTitle.setText(loc.title)
        b.etAddress.setText(loc.address)
        b.etContactNumber.setText(loc.contactNumber)
        b.etNote.setText(loc.note)
        dateMillis = loc.dateMillis
        b.etDate.setText(Formats.date(dateMillis))
        groupId = loc.groupId
        images.clear(); images.addAll(loc.images)
        showGroup()
        showImages()
    }

    private fun setCoordinates(lat: Double, lng: Double) {
        b.etLat.setText(Coords.dd(lat))
        b.etLng.setText(Coords.dd(lng))
        if (b.switchLatLongDMS.isChecked) fillDms(lat, lng)
        val u = Coords.toUtm(lat, lng)
        b.tvUtmNorthing.text = getString(R.string.utm_northing) + " : " + u.northingText
        b.tvUtmEasting.text = getString(R.string.utm_easting) + " : " + u.eastingText
        b.tvUtmZone.text = getString(R.string.utm_zone) + " : " + u.zoneText
        // lưu tạm để nút đổi vị trí dùng khi đang ở chế độ UTM
        b.root.tag = lat to lng
    }

    private fun fillDms(lat: Double, lng: Double) {
        val (d1, m1, s1) = Coords.toDmsParts(lat)
        val (d2, m2, s2) = Coords.toDmsParts(lng)
        nsNegative = lat < 0; ewNegative = lng < 0
        b.btnNS.setText(if (nsNegative) R.string.south else R.string.north)
        b.btnEW.setText(if (ewNegative) R.string.west else R.string.east)
        b.etNSDegree.setText(d1.toString()); b.etNSMinute.setText(m1.toString())
        b.etNSSecond.setText(String.format(Locale.US, "%.2f", s1))
        b.etEWDegree.setText(d2.toString()); b.etEWMinute.setText(m2.toString())
        b.etEWSecond.setText(String.format(Locale.US, "%.2f", s2))
    }

    private fun toggleDms(dms: Boolean) {
        if (dms) {
            val lat = b.etLat.text.toString().toDoubleOrNull()
            val lng = b.etLng.text.toString().toDoubleOrNull()
            if (lat != null && lng != null) fillDms(lat, lng)
        } else {
            readDms()?.let { (lat, lng) -> b.etLat.setText(Coords.dd(lat)); b.etLng.setText(Coords.dd(lng)) }
        }
        b.llLatLong.visible(!dms)
        b.llDMS.visible(dms)
    }

    private fun readDms(): Pair<Double, Double>? {
        fun d(e: android.widget.EditText) = e.text.toString().replace(',', '.').toDoubleOrNull()
        val nd = d(b.etNSDegree) ?: return null
        val ed = d(b.etEWDegree) ?: return null
        val lat = Coords.fromDms(nd, d(b.etNSMinute) ?: 0.0, d(b.etNSSecond) ?: 0.0, nsNegative)
        val lng = Coords.fromDms(ed, d(b.etEWMinute) ?: 0.0, d(b.etEWSecond) ?: 0.0, ewNegative)
        return lat to lng
    }

    private fun readCoordinates(silent: Boolean = false): Pair<Double, Double>? {
        if (b.llUtmContainer.visibility == View.VISIBLE) {
            @Suppress("UNCHECKED_CAST")
            return b.root.tag as? Pair<Double, Double>
        }
        val pair = if (b.switchLatLongDMS.isChecked) readDms() else {
            val lat = b.etLat.text.toString().replace(',', '.').trim().toDoubleOrNull()
            val lng = b.etLng.text.toString().replace(',', '.').trim().toDoubleOrNull()
            if (lat == null || lng == null) null else lat to lng
        }
        if (pair == null) {
            if (!silent) requireContext().toast(R.string.msg_latlng_must_not_empty)
            return null
        }
        if (!Coords.isValid(pair.first, pair.second)) {
            if (!silent) requireContext().toast(R.string.msg_improper_latlng, long = true)
            return null
        }
        return pair
    }

    private fun showGroup() {
        _b ?: return
        val ctx = requireContext()
        viewLifecycleOwner.lifecycleScope.launch {
            val g = withContext(Dispatchers.IO) { Db.get(ctx).getGroup(groupId) }
            if (g == null) groupId = null
            b.etGroup.setText(g?.name ?: getString(R.string.all))
            b.tilGroup.startIconDrawable = if (g != null) MapUtil.pin(ctx, g.color) else null
        }
    }

    private fun showImages() {
        _b ?: return
        b.tvImagesCount.visible(images.size > 1)
        b.tvImagesCount.text = images.size.toString()
        val first = images.firstOrNull()
        if (first == null) {
            b.ivLocationImage.scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE
            b.ivLocationImage.setImageResource(R.drawable.ic_add_photo)
            b.ivLocationImage.imageTintList = android.content.res.ColorStateList.valueOf(requireContext().getColor(R.color.text_secondary))
        } else {
            b.ivLocationImage.scaleType = android.widget.ImageView.ScaleType.CENTER_CROP
            b.ivLocationImage.imageTintList = null
            ImageStore.loadThumb(viewLifecycleOwner.lifecycleScope, b.ivLocationImage, first, 300, R.drawable.ic_image)
        }
    }

    private fun addImage(path: String) {
        if (images.size >= SavedLocation.MAX_IMAGES) return
        images.add(path); newImages.add(path)
        showImages()
    }

    private fun openImageDialog() {
        ImageUploadDialog.newInstance(ArrayList(images)).show(childFragmentManager, "images")
    }

    private fun pickGroup() {
        SelectGroupSheet.newInstance(groupId).show(childFragmentManager, "select_group")
    }

    private fun pickDate() {
        val ctx = requireContext()
        val cal = Calendar.getInstance().apply { timeInMillis = dateMillis }
        DatePickerDialog(ctx, { _, y, m, d ->
            TimePickerDialog(ctx, { _, h, min ->
                cal.set(y, m, d, h, min)
                dateMillis = cal.timeInMillis
                b.etDate.setText(Formats.date(dateMillis))
            }, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), true).show()
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
    }

    private fun save() {
        val coords = readCoordinates() ?: return
        val title = b.etTitle.text.toString().trim()
        if (title.isEmpty()) {
            b.tilTitle.error = getString(R.string.msg_title_must_not_empty)
            b.etTitle.requestFocus()
            return
        }
        b.tilTitle.error = null
        b.root.hideKeyboard()
        val ctx = requireContext().applicationContext
        val loc = (editing?.copy() ?: SavedLocation()).apply {
            latitude = coords.first
            longitude = coords.second
            this.title = title
            address = b.etAddress.text.toString().trim()
            contactNumber = b.etContactNumber.text.toString().trim()
            note = b.etNote.text.toString().trim()
            groupId = this@SaveLocationDialog.groupId
            images = ArrayList(this@SaveLocationDialog.images)
            if (mode == MODE_EDIT) dateMillis = this@SaveLocationDialog.dateMillis
        }
        val removed = editing?.images?.filter { it !in images }.orEmpty() + newImages.filter { it !in images }
        saved = true
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                val db = Db.get(ctx)
                if (mode == MODE_EDIT) db.updateLocation(loc) else db.insertLocation(loc)
                removed.forEach { File(it).delete(); ImageStore.evict(it) }
                if (loc.geofence) GeofenceManager.registerAll(ctx)
            }
            DataBus.notifyChanged()
            ctx.toast(if (mode == MODE_EDIT) R.string.location_updated else R.string.location_saved)
            parentFragmentManager.setFragmentResult(RESULT_SAVED, bundleOf(KEY_ID to loc.id))
            dismissAllowingStateLoss()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // Ảnh vừa thêm nhưng không lưu → xoá file tạm
        if (!saved) newImages.forEach { File(it).delete() }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        const val TAG = "save_location"
        const val RESULT_SAVED = "location_saved"
        const val KEY_ID = "id"
        private const val ARG_MODE = "mode"
        private const val ARG_ID = "id"
        private const val ARG_LAT = "lat"
        private const val ARG_LNG = "lng"
        private const val ARG_ADDRESS = "address"
        private const val ARG_NAME = "name"
        private const val MODE_MAP = 0
        private const val MODE_ADD = 1
        private const val MODE_EDIT = 2

        fun newFromMap(lat: Double, lng: Double, address: String?, name: String?) = SaveLocationDialog().apply {
            arguments = bundleOf(ARG_MODE to MODE_MAP, ARG_LAT to lat, ARG_LNG to lng, ARG_ADDRESS to address, ARG_NAME to name)
        }

        fun newAdd() = SaveLocationDialog().apply { arguments = bundleOf(ARG_MODE to MODE_ADD) }

        fun newEdit(id: Long) = SaveLocationDialog().apply { arguments = bundleOf(ARG_MODE to MODE_EDIT, ARG_ID to id) }
    }
}
