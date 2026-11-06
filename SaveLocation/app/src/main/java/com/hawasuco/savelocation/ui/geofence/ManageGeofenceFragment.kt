package com.hawasuco.savelocation.ui.geofence

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.databinding.FragmentManageGeofenceBinding
import com.hawasuco.savelocation.geofence.GeofenceManager
import com.hawasuco.savelocation.ui.HomeActivity
import com.hawasuco.savelocation.ui.OptimizeUsabilityActivity
import com.hawasuco.savelocation.ui.ShowOnMapActivity
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.confirm
import com.hawasuco.savelocation.util.openAppSettings
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Quản lý vùng cảnh báo: bật quyền vị trí nền, lối tắt tối ưu, danh sách vị trí đang cảnh báo, nút + để thêm.
 */
class ManageGeofenceFragment : Fragment() {
    private var _b: FragmentManageGeofenceBinding? = null
    private val b get() = _b!!
    private lateinit var adapter: GeofenceAdapter

    private val fgPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        if (LocationHelper.hasLocationPermission(requireContext())) requestBackground() else updateSwitch()
    }
    private val bgPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        updateSwitch()
        if (granted) {
            val ctx = requireContext().applicationContext
            lifecycleScope.launch(Dispatchers.IO) { GeofenceManager.registerAll(ctx) }
        }
    }
    private val notifPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentManageGeofenceBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = GeofenceAdapter(viewLifecycleOwner.lifecycleScope, selectable = false,
            onClick = { startActivity(Intent(requireContext(), ShowOnMapActivity::class.java).putExtra(ShowOnMapActivity.EXTRA_ID, it.id)) },
            onRemove = { loc ->
                requireContext().confirm(null, getString(R.string.ask_remove_geofence), R.string.remove) {
                    val ctx = requireContext().applicationContext
                    viewLifecycleOwner.lifecycleScope.launch {
                        withContext(Dispatchers.IO) {
                            Db.get(ctx).setGeofence(loc.id, false); GeofenceManager.registerAll(ctx)
                        }
                        DataBus.notifyChanged()
                    }
                }
            })
        b.rvGeofence.layoutManager = LinearLayoutManager(requireContext())
        b.rvGeofence.adapter = adapter
        b.tvOptimizeUsability.setOnClickListener { startActivity(Intent(requireContext(), OptimizeUsabilityActivity::class.java)) }
        b.switchBackgroundPermission.setOnClickListener {
            val sw = b.switchBackgroundPermission
            if (sw.isChecked) {
                sw.isChecked = false
                askBackgroundPermission()
            } else {
                // Không thể tự thu hồi quyền: mở cài đặt ứng dụng
                sw.isChecked = true
                requireContext().openAppSettings()
            }
        }
        b.fabAddGeofence.setOnClickListener {
            if (!LocationHelper.isPlayServicesAvailable(requireContext())) {
                requireContext().toast(R.string.geofence_play_services_missing, long = true); return@setOnClickListener
            }
            if (Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            (activity as? HomeActivity)?.push(AddGeofenceFragment())
        }
        DataBus.observe(viewLifecycleOwner) { load() }
        load()
    }

    override fun onResume() {
        super.onResume()
        requireActivity().title = getString(R.string.manage_geofence)
        updateSwitch()
    }

    private fun updateSwitch() {
        _b ?: return
        val ctx = requireContext()
        b.switchBackgroundPermission.isChecked = LocationHelper.hasLocationPermission(ctx) && LocationHelper.hasBackgroundPermission(ctx)
    }

    private fun askBackgroundPermission() {
        val ctx = requireContext()
        if (!LocationHelper.hasLocationPermission(ctx)) {
            fgPermission.launch(LocationHelper.LOCATION_PERMISSIONS); return
        }
        requestBackground()
    }

    private fun requestBackground() {
        if (Build.VERSION.SDK_INT < 29) { updateSwitch(); return }
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.manage_geofence)
            .setMessage(R.string.grant_access_to_background_location)
            .setPositiveButton(R.string.ok) { _, _ ->
                if (Build.VERSION.SDK_INT >= 30) {
                    requireContext().toast(R.string.geofence_permission_warning, long = true)
                }
                bgPermission.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun load() {
        val ctx = requireContext()
        viewLifecycleOwner.lifecycleScope.launch {
            val (list, groups) = withContext(Dispatchers.IO) {
                Db.get(ctx).let { it.getLocations(geofenceOnly = true) to it.getGroups().associateBy { g -> g.id } }
            }
            adapter.groups = groups
            adapter.items = list
            b.tvErrorMessage.visible(list.isEmpty())
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
