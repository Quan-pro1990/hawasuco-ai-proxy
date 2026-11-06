package com.hawasuco.savelocation.ui.geofence

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import androidx.core.view.MenuProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.FragmentAddGeofenceBinding
import com.hawasuco.savelocation.geofence.GeofenceManager
import com.hawasuco.savelocation.util.singleChoice
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** "Thêm vùng cảnh báo": tick chọn vị trí (tối đa 100), chọn bán kính, bấm Xong. */
class AddGeofenceFragment : Fragment() {
    private var _b: FragmentAddGeofenceBinding? = null
    private val b get() = _b!!
    private lateinit var adapter: GeofenceAdapter
    private var all: List<SavedLocation> = emptyList()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentAddGeofenceBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = GeofenceAdapter(viewLifecycleOwner.lifecycleScope, selectable = true, onClick = {})
        b.rvGeofence.layoutManager = LinearLayoutManager(requireContext())
        b.rvGeofence.adapter = adapter
        b.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) = filter()
        })
        showRadius()
        requireActivity().addMenuProvider(object : MenuProvider {
            override fun onCreateMenu(menu: Menu, menuInflater: MenuInflater) = menuInflater.inflate(R.menu.menu_add_geofence, menu)
            override fun onMenuItemSelected(item: MenuItem): Boolean = when (item.itemId) {
                R.id.action_geofence_radius -> { pickRadius(); true }
                R.id.action_done -> { done(); true }
                else -> false
            }
        }, viewLifecycleOwner, Lifecycle.State.RESUMED)

        val ctx = requireContext()
        viewLifecycleOwner.lifecycleScope.launch {
            val (list, groups) = withContext(Dispatchers.IO) {
                Db.get(ctx).let { it.getLocations() to it.getGroups().associateBy { g -> g.id } }
            }
            all = list
            adapter.groups = groups
            adapter.checked.addAll(list.filter { it.geofence }.map { it.id })
            filter()
        }
    }

    override fun onResume() {
        super.onResume()
        requireActivity().title = getString(R.string.add_geofence)
    }

    private fun filter() {
        val q = b.etSearch.text.toString().trim().lowercase()
        val list = if (q.isEmpty()) all else all.filter { it.title.lowercase().contains(q) }
        adapter.items = list
        b.tvErrorMessage.visible(list.isEmpty())
    }

    private fun showRadius() {
        b.tvRadius.text = getString(R.string.geofence_notification_text, Prefs.geofenceRadius)
    }

    private fun pickRadius() {
        val values = RADII
        val labels = values.map { if (it < 1000) "$it m" else "${it / 1000} km" }
        requireContext().singleChoice(R.string.geofence_radius, labels, values.indexOf(Prefs.geofenceRadius)) {
            Prefs.geofenceRadius = values[it]; showRadius()
        }
    }

    private fun done() {
        val ids = adapter.checked.toSet()
        if (ids.size > GeofenceManager.MAX_GEOFENCES) {
            requireContext().toast(R.string.geofence_limit_message); return
        }
        val ctx = requireContext().applicationContext
        val radius = Prefs.geofenceRadius
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                Db.get(ctx).setGeofenceSelection(ids, radius)
                GeofenceManager.registerAll(ctx)
            }
            DataBus.notifyChanged()
            ctx.toast(ctx.getString(R.string.geofence_saved, ids.size))
            parentFragmentManager.popBackStack()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        val RADII = listOf(100, 200, 300, 500, 1000, 2000, 5000)
    }
}
