package com.hawasuco.savelocation.ui.settings

import android.os.Bundle
import android.text.InputType
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.widget.SwitchCompat
import androidx.core.view.MenuProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.App
import com.hawasuco.savelocation.BuildConfig
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.Prefs.Share
import com.hawasuco.savelocation.databinding.DialogSwitchListBinding
import com.hawasuco.savelocation.databinding.FragmentSettingsBinding
import com.hawasuco.savelocation.geofence.GeofenceManager
import com.hawasuco.savelocation.network.PipeStore
import com.hawasuco.savelocation.network.PipeSync
import com.hawasuco.savelocation.ui.network.ScadaAccessDialog
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.NavApps
import com.hawasuco.savelocation.util.confirm
import com.hawasuco.savelocation.util.dp
import com.hawasuco.savelocation.util.openUrl
import com.hawasuco.savelocation.util.singleChoice
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Cài đặt — cùng các mục như app gốc (đơn vị, kiểu chia sẻ, định dạng ngày, chỉ đường, GPS, lái xe, nhóm, giao diện...). */
class SettingsFragment : Fragment() {
    private var _b: FragmentSettingsBinding? = null
    private val b get() = _b!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentSettingsBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val ctx = requireContext()
        requireActivity().addMenuProvider(object : MenuProvider {
            override fun onCreateMenu(menu: Menu, menuInflater: MenuInflater) {
                menuInflater.inflate(R.menu.menu_settings, menu)
                menu.findItem(R.id.menu_version)?.title = getString(R.string.version, BuildConfig.VERSION_NAME)
            }

            override fun onMenuItemSelected(item: MenuItem) = false
        }, viewLifecycleOwner, Lifecycle.State.RESUMED)

        b.llLocationAccuracy.setOnClickListener { ctx.openUrl(getString(R.string.location_accuracy_link)) }
        b.llDistanceUnit.setOnClickListener {
            ctx.singleChoice(R.string.select_distance_unit, listOf(getString(R.string.km), getString(R.string.mile)), Prefs.distanceUnit) {
                Prefs.distanceUnit = it; refresh()
            }
        }
        b.llSharingMode.setOnClickListener {
            ctx.singleChoice(R.string.select_sharing_type, listOf(getString(R.string.share_live_location), getString(R.string.share_location)), Prefs.sharingMode) {
                Prefs.sharingMode = it; refresh()
            }
        }
        b.llDatetimeFormat.setOnClickListener {
            ctx.singleChoice(R.string.select_datetime_format, Formats.DATE_DISPLAY_SAMPLES.toList(), Prefs.dateFormat) {
                Prefs.dateFormat = it; refresh()
            }
        }
        toggle(b.llShowDirection, b.switchShowDirection, { Prefs.showDirection }, { Prefs.showDirection = it })
        toggle(b.llGpsUpdate, b.switchGpsUpdate, { Prefs.autoGpsUpdate }, { Prefs.autoGpsUpdate = it }, R.string.msg_dialog_gps_update)
        toggle(b.llDrivingMode, b.switchDrivingMode, { Prefs.driveMode }, { Prefs.driveMode = it }, R.string.msg_dialog_driving_mode)
        toggle(b.llGroupMode, b.switchGroupMode, { Prefs.groupMode }, { Prefs.groupMode = it }, R.string.msg_dialog_group_mode)

        b.llDarkMode.setOnClickListener {
            ctx.singleChoice(R.string.select_theme, themeLabels(), Prefs.theme) {
                Prefs.theme = it; App.applyTheme(it)
            }
        }
        b.llLanguage.setOnClickListener {
            val tags = listOf("", "en", "vi")
            val labels = listOf(getString(R.string.language_system), "English", "Tiếng Việt")
            ctx.singleChoice(R.string.select_language, labels, tags.indexOf(Prefs.language).coerceAtLeast(0)) {
                Prefs.language = tags[it]; App.applyLanguage(tags[it])
            }
        }
        b.llSharePreference.setOnClickListener { showSharePreferences() }
        b.llLatlngFormat.setOnClickListener {
            val values = listOf("DD", "DMS", "DDM", "UTM")
            ctx.singleChoice(R.string.select_latlng_format, values, values.indexOf(Prefs.coordFormat).coerceAtLeast(0)) {
                Prefs.coordFormat = values[it]; refresh()
            }
        }
        b.llNavigationApp.setOnClickListener { showNavigationApps() }
        b.llLiveServer.setOnClickListener { editLiveServer() }
        b.llPipeNetwork.setOnClickListener { ScadaAccessDialog().show(childFragmentManager, ScadaAccessDialog.TAG) }
        viewLifecycleOwner.lifecycleScope.launch { PipeStore.version.collect { refresh() } }
        b.llDeleteAll.setOnClickListener {
            ctx.confirm(R.string.delete_all_label, getString(R.string.ask_delete_all), R.string.delete) {
                val app = ctx.applicationContext
                lifecycleScope.launch {
                    withContext(Dispatchers.IO) {
                        Db.get(app).deleteAll(ImageStore.dir(app)); GeofenceManager.registerAll(app)
                    }
                    DataBus.notifyChanged()
                    app.toast(R.string.all_data_deleted)
                }
            }
        }
        b.tvVersion.text = getString(R.string.app_name) + " " + getString(R.string.version, BuildConfig.VERSION_NAME)
        refresh()
    }

    override fun onResume() {
        super.onResume()
        requireActivity().title = getString(R.string.settings)
        refresh()
    }

    private fun themeLabels() = listOf(getString(R.string.system_default_theme), getString(R.string.light_theme), getString(R.string.dark_theme))

    private fun toggle(row: View, sw: SwitchCompat, get: () -> Boolean, set: (Boolean) -> Unit, info: Int? = null) {
        row.setOnClickListener {
            val v = !get()
            set(v); sw.isChecked = v
            if (v && info != null) AlertDialog.Builder(requireContext()).setMessage(info).setPositiveButton(R.string.ok, null).show()
        }
    }

    private fun refresh() {
        _b ?: return
        val ctx = requireContext()
        b.tvDistanceUnit.text = getString(if (Prefs.distanceUnit == 1) R.string.mile else R.string.km)
        b.tvSharingMode.text = getString(if (Prefs.sharingMode == 0) R.string.share_live_location else R.string.share_location)
        b.tvDatetimeFormat.text = Formats.DATE_DISPLAY_SAMPLES[Prefs.dateFormat.coerceIn(0, 5)]
        b.switchShowDirection.isChecked = Prefs.showDirection
        b.switchGpsUpdate.isChecked = Prefs.autoGpsUpdate
        b.switchDrivingMode.isChecked = Prefs.driveMode
        b.switchGroupMode.isChecked = Prefs.groupMode
        b.tvThemeMode.text = themeLabels()[Prefs.theme.coerceIn(0, 2)]
        b.tvLanguage.text = when (Prefs.language) { "en" -> "English"; "vi" -> "Tiếng Việt"; else -> getString(R.string.language_system) }
        b.tvLatlngFormat.text = Prefs.coordFormat
        b.tvNavigationApp.text = NavApps.label(ctx, Prefs.navigationApp)
        b.tvLiveServer.text = Prefs.liveServerUrl.ifBlank { getString(R.string.not_set) }
        b.tvPipeNetwork.text = if (PipeSync.hasCode()) {
            getString(R.string.pipe_connected) + " · " + (runCatching { java.net.URI(Prefs.scadaUrl).host }.getOrNull() ?: Prefs.scadaUrl)
        } else getString(R.string.not_set)
    }

    private fun showSharePreferences() {
        val ctx = requireContext()
        val db = DialogSwitchListBinding.inflate(layoutInflater)
        db.tvTitle.setText(R.string.share_preferences)
        val utm = Prefs.coordFormat == "UTM"
        val fields = buildList {
            if (utm) {
                add(Share.UTM_N to getString(R.string.utm_northing)); add(Share.UTM_E to getString(R.string.utm_easting))
                add(Share.UTM_ZONE to getString(R.string.utm_zone))
            } else {
                add(Share.LAT to getString(R.string.latitude)); add(Share.LNG to getString(R.string.longitude))
            }
            add(Share.TITLE to getString(R.string.title)); add(Share.ADDRESS to getString(R.string.address))
            add(Share.CONTACT to getString(R.string.contact_number)); add(Share.NOTE to getString(R.string.note))
            add(Share.DATE to getString(R.string.date)); add(Share.GOOGLE to getString(R.string.google_maps_url))
            add(Share.WAZE to getString(R.string.waze_url)); add(Share.OSM to getString(R.string.osm_url))
        }
        fields.forEach { (key, label) ->
            db.container.addView(SwitchCompat(ctx).apply {
                text = label
                textSize = 16f
                minHeight = ctx.dp(48)
                isChecked = Prefs.shareField(key)
                setOnCheckedChangeListener { _, c -> Prefs.setShareField(key, c) }
            })
        }
        val d = AlertDialog.Builder(ctx).setView(db.root).create()
        db.ivClose.setOnClickListener { d.dismiss() }
        d.show()
    }

    private fun showNavigationApps() {
        val ctx = requireContext()
        val apps = listOf(-1) + NavApps.installedApps(ctx).ifEmpty { listOf(NavApps.GOOGLE) }
        val labels = apps.map { NavApps.label(ctx, it) }
        ctx.singleChoice(R.string.select_navigation_app, labels, apps.indexOf(Prefs.navigationApp).coerceAtLeast(0)) {
            Prefs.navigationApp = apps[it]; refresh()
        }
    }

    private fun editLiveServer() {
        val ctx = requireContext()
        val et = EditText(ctx).apply {
            setText(Prefs.liveServerUrl)
            hint = getString(R.string.live_server_hint)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine()
        }
        val wrap = FrameLayout(ctx).apply {
            setPadding(ctx.dp(20), ctx.dp(8), ctx.dp(20), 0)
            addView(et)
        }
        AlertDialog.Builder(ctx)
            .setTitle(R.string.live_server_label)
            .setMessage(R.string.live_server_desc)
            .setView(wrap)
            .setPositiveButton(R.string.label_save) { _, _ ->
                var url = et.text.toString().trim()
                if (url.isNotEmpty() && !url.startsWith("http")) url = "https://$url"
                Prefs.liveServerUrl = url
                refresh()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
