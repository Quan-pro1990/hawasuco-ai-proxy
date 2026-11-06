package com.hawasuco.savelocation.ui.groups

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuInflater
import android.view.MenuItem
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import androidx.core.view.MenuProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.FragmentGroupListBinding
import com.hawasuco.savelocation.databinding.ListItemsGroupBinding
import com.hawasuco.savelocation.ui.HomeActivity
import com.hawasuco.savelocation.ui.dialogs.AddEditGroupSheet
import com.hawasuco.savelocation.ui.list.LocationsListFragment
import com.hawasuco.savelocation.util.confirm
import com.hawasuco.savelocation.util.singleChoice
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Collections

/**
 * Danh sách nhóm (chế độ nhóm): "Tất cả – N" rồi từng nhóm với màu và số vị trí.
 * Chế độ sửa: kéo để sắp xếp, sửa / xoá nhóm. Nút + để thêm nhóm.
 */
class GroupListFragment : Fragment(), HomeActivity.BackHandler {
    private var _b: FragmentGroupListBinding? = null
    private val b get() = _b!!
    private var groups = mutableListOf<LocationGroup>()
    private var total = 0
    private var editMode = false
    private val adapter = Adapter()
    private lateinit var touchHelper: ItemTouchHelper

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentGroupListBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.lvNoteGroups.layoutManager = LinearLayoutManager(requireContext())
        b.lvNoteGroups.adapter = adapter
        touchHelper = ItemTouchHelper(object : ItemTouchHelper.SimpleCallback(ItemTouchHelper.UP or ItemTouchHelper.DOWN, 0) {
            override fun isLongPressDragEnabled() = editMode
            override fun getMovementFlags(rv: RecyclerView, vh: RecyclerView.ViewHolder): Int =
                if (vh.bindingAdapterPosition == 0 || !editMode) 0 else super.getMovementFlags(rv, vh)

            override fun onMove(rv: RecyclerView, from: RecyclerView.ViewHolder, to: RecyclerView.ViewHolder): Boolean {
                val f = from.bindingAdapterPosition - 1
                val t = to.bindingAdapterPosition - 1
                if (f < 0 || t < 0) return false
                Collections.swap(groups, f, t)
                adapter.notifyItemMoved(from.bindingAdapterPosition, to.bindingAdapterPosition)
                return true
            }

            override fun onSwiped(vh: RecyclerView.ViewHolder, direction: Int) {}

            override fun clearView(rv: RecyclerView, vh: RecyclerView.ViewHolder) {
                super.clearView(rv, vh)
                saveOrder()
            }
        })
        touchHelper.attachToRecyclerView(b.lvNoteGroups)
        b.fabAddGroup.setOnClickListener { AddEditGroupSheet.newInstance(null).show(childFragmentManager, "add_group") }

        requireActivity().addMenuProvider(object : MenuProvider {
            override fun onCreateMenu(menu: Menu, menuInflater: MenuInflater) = menuInflater.inflate(R.menu.menu_groups, menu)
            override fun onPrepareMenu(menu: Menu) {
                val edit = menu.findItem(R.id.action_edit)
                if (editMode) { edit.icon = null; edit.setTitle(R.string.done) } else { edit.setIcon(R.drawable.ic_edit); edit.setTitle(R.string.edit) }
                menu.findItem(R.id.action_sort).isEnabled = !editMode
                menu.findItem(R.id.action_sort).icon?.alpha = if (editMode) 60 else 255
            }

            override fun onMenuItemSelected(item: MenuItem): Boolean = when (item.itemId) {
                R.id.action_sort -> { showSort(); true }
                R.id.action_edit -> { setEditMode(!editMode); true }
                else -> false
            }
        }, viewLifecycleOwner, Lifecycle.State.RESUMED)

        DataBus.observe(viewLifecycleOwner) { load() }
        load()
    }

    override fun onResume() {
        super.onResume()
        requireActivity().title = getString(R.string.saved_locations)
    }

    override fun onBackPressed(): Boolean {
        if (editMode) { setEditMode(false); return true }
        return false
    }

    private fun setEditMode(on: Boolean) {
        editMode = on
        if (on) b.fabAddGroup.hide() else b.fabAddGroup.show()
        adapter.notifyDataSetChanged()
        requireActivity().invalidateOptionsMenu()
    }

    private fun load() {
        val ctx = requireContext()
        viewLifecycleOwner.lifecycleScope.launch {
            val (g, n) = withContext(Dispatchers.IO) { Db.get(ctx).let { it.getGroups() to it.countLocations() } }
            groups = sort(g).toMutableList()
            total = n
            adapter.notifyDataSetChanged()
            b.tvClickToAdd.visible(groups.isEmpty())
        }
    }

    private fun sort(list: List<LocationGroup>): List<LocationGroup> = when (Prefs.groupSortBy) {
        0 -> list.sortedBy { it.createdAt }
        1 -> list.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.name })
        else -> list.sortedBy { it.displayOrder }
    }

    private fun showSort() {
        val items = listOf(getString(R.string.date), getString(R.string.alphabetic))
        requireContext().singleChoice(R.string.sort_by, items, Prefs.groupSortBy) {
            Prefs.groupSortBy = it
            groups = sort(groups).toMutableList()
            adapter.notifyDataSetChanged()
        }
    }

    private fun saveOrder() {
        Prefs.groupSortBy = -1
        val ctx = requireContext().applicationContext
        val snapshot = groups.toList()
        lifecycleScope.launch(Dispatchers.IO) { Db.get(ctx).saveGroupOrder(snapshot) }
    }

    private fun openGroup(g: LocationGroup?) {
        val title = g?.name ?: getString(R.string.all)
        (activity as? HomeActivity)?.push(
            if (g == null) LocationsListFragment.newInstance(LocationsListFragment.MODE_ALL, null, title)
            else LocationsListFragment.newInstance(LocationsListFragment.MODE_GROUP, g.id, title)
        )
    }

    private fun deleteGroup(g: LocationGroup) {
        requireContext().confirm(R.string.delete_group, getString(R.string.ask_delete_group), R.string.delete) {
            val ctx = requireContext().applicationContext
            lifecycleScope.launch {
                withContext(Dispatchers.IO) { Db.get(ctx).deleteGroup(g.id) }
                DataBus.notifyChanged()
            }
        }
    }

    private inner class Adapter : RecyclerView.Adapter<Adapter.VH>() {
        inner class VH(val v: ListItemsGroupBinding) : RecyclerView.ViewHolder(v.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            VH(ListItemsGroupBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount() = groups.size + 1

        @SuppressLint("ClickableViewAccessibility")
        override fun onBindViewHolder(h: VH, position: Int) {
            val v = h.v
            val ctx = v.root.context
            if (position == 0) {
                v.tvGroupName.text = ctx.getString(R.string.all)
                v.tvCount.text = total.toString()
                v.ivGroupColor.setColorFilter(ctx.getColor(R.color.colorAccent))
                v.dragHandle.visible(false)
                v.ivEdit.visible(false)
                v.ivDelete.visible(false)
                v.ivChevron.visible(!editMode)
                v.cardGroupContainer.setOnClickListener { if (!editMode) openGroup(null) }
                return
            }
            val g = groups[position - 1]
            v.tvGroupName.text = g.name
            v.tvCount.text = g.count.toString()
            v.ivGroupColor.setColorFilter(g.color)
            v.dragHandle.visible(editMode)
            v.ivEdit.visible(editMode)
            v.ivDelete.visible(editMode)
            v.ivChevron.visible(!editMode)
            v.cardGroupContainer.setOnClickListener { if (!editMode) openGroup(g) }
            v.ivEdit.setOnClickListener { AddEditGroupSheet.newInstance(g.id).show(childFragmentManager, "edit_group") }
            v.ivDelete.setOnClickListener { deleteGroup(g) }
            v.dragHandle.setOnTouchListener { _, e ->
                if (e.actionMasked == MotionEvent.ACTION_DOWN) touchHelper.startDrag(h)
                false
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
