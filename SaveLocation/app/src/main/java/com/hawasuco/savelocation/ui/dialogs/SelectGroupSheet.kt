package com.hawasuco.savelocation.ui.dialogs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.databinding.DialogSelectGroupBottomSheetBinding
import com.hawasuco.savelocation.databinding.ItemGroupPickBinding
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Bảng "Chọn nhóm" trong hộp thoại Lưu vị trí. Có dòng "+ Thêm nhóm mới". */
class SelectGroupSheet : BottomSheetDialogFragment() {
    private var _b: DialogSelectGroupBottomSheetBinding? = null
    private val b get() = _b!!
    private var groups: List<LocationGroup?> = emptyList()
    private var selected: String? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogSelectGroupBottomSheetBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        selected = requireArguments().getString(ARG_SELECTED)
        b.rvGroups.layoutManager = LinearLayoutManager(requireContext())
        b.rvGroups.adapter = Adapter()
        b.rowAddNewGroup.setOnClickListener {
            AddEditGroupSheet.newInstance(null).show(childFragmentManager, "add_group")
        }
        childFragmentManager.setFragmentResultListener(AddEditGroupSheet.RESULT, viewLifecycleOwner) { _, bundle ->
            pick(bundle.getString(AddEditGroupSheet.KEY_ID))
        }
        load()
    }

    private fun load() {
        val ctx = requireContext()
        viewLifecycleOwner.lifecycleScope.launch {
            val list = withContext(Dispatchers.IO) { Db.get(ctx).getGroups() }
            groups = listOf<LocationGroup?>(null) + list
            b.rvGroups.adapter?.notifyDataSetChanged()
        }
    }

    private fun pick(id: String?) {
        parentFragmentManager.setFragmentResult(RESULT, bundleOf(KEY_GROUP_ID to id))
        dismissAllowingStateLoss()
    }

    private inner class Adapter : RecyclerView.Adapter<Adapter.VH>() {
        inner class VH(val v: ItemGroupPickBinding) : RecyclerView.ViewHolder(v.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            VH(ItemGroupPickBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount() = groups.size

        override fun onBindViewHolder(h: VH, position: Int) {
            val g = groups[position]
            h.v.tvName.text = g?.name ?: getString(R.string.all)
            h.v.ivColor.setColorFilter(g?.color ?: requireContext().getColor(R.color.text_secondary))
            h.v.ivCheck.visible(g?.id == selected)
            h.v.root.setOnClickListener { pick(g?.id) }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        const val RESULT = "group_selected"
        const val KEY_GROUP_ID = "group_id"
        private const val ARG_SELECTED = "selected"

        fun newInstance(selected: String?) = SelectGroupSheet().apply { arguments = bundleOf(ARG_SELECTED to selected) }
    }
}
