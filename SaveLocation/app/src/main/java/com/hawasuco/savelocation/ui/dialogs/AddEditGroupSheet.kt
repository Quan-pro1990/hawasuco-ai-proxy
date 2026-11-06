package com.hawasuco.savelocation.ui.dialogs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.databinding.DialogAddNewGroupBinding
import com.hawasuco.savelocation.util.hideKeyboard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

/** Thêm / sửa nhóm: tên nhóm + màu nhóm. */
class AddEditGroupSheet : BottomSheetDialogFragment() {
    private var _b: DialogAddNewGroupBinding? = null
    private val b get() = _b!!
    private var group: LocationGroup? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogAddNewGroupBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.state = BottomSheetBehavior.STATE_EXPANDED
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val ctx = requireContext()
        val id = requireArguments().getString(ARG_ID)
        b.colorSeekBar.onColorChange = { c -> b.ivGroupColor.setColorFilter(c) }
        b.colorSeekBar.setColor(DEFAULT_COLOR)
        b.ivGroupColor.setColorFilter(b.colorSeekBar.color)
        if (id != null) {
            b.tvTitle.setText(R.string.update_group)
            viewLifecycleOwner.lifecycleScope.launch {
                group = withContext(Dispatchers.IO) { Db.get(ctx).getGroup(id) }
                group?.let {
                    b.etGroupName.setText(it.name)
                    b.colorSeekBar.setColor(it.color)
                    b.ivGroupColor.setColorFilter(it.color)
                }
            }
        }
        b.btnCancel.setOnClickListener { dismiss() }
        b.btnSave.setOnClickListener { save() }
    }

    private fun save() {
        val name = b.etGroupName.text.toString().trim()
        if (name.isEmpty()) {
            b.tilGroupName.error = getString(R.string.group_name_empty); return
        }
        val ctx = requireContext().applicationContext
        val color = b.colorSeekBar.color
        b.root.hideKeyboard()
        lifecycleScope.launch {
            val db = Db.get(ctx)
            val existing = withContext(Dispatchers.IO) { db.findGroupByName(name) }
            if (existing != null && existing.id != group?.id) {
                _b?.tilGroupName?.error = getString(R.string.group_already_added); return@launch
            }
            val g = group?.apply { this.name = name; this.color = color }
                ?: LocationGroup(id = UUID.randomUUID().toString(), name = name, color = color)
            withContext(Dispatchers.IO) { if (group == null) db.insertGroup(g) else db.updateGroup(g) }
            DataBus.notifyChanged()
            parentFragmentManager.setFragmentResult(RESULT, bundleOf(KEY_ID to g.id))
            dismissAllowingStateLoss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        const val RESULT = "group_saved"
        const val KEY_ID = "id"
        private const val ARG_ID = "id"
        private val DEFAULT_COLOR = android.graphics.Color.parseColor("#E53935")

        fun newInstance(id: String?) = AddEditGroupSheet().apply { arguments = bundleOf(ARG_ID to id) }
    }
}
