package com.hawasuco.savelocation.ui.dialogs

import android.app.Dialog
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.hawasuco.savelocation.databinding.DialogFeatureAnnouncementBinding
import com.hawasuco.savelocation.ui.live.ShareLocationSheet

/** Giới thiệu tính năng mới "Chia sẻ vị trí trực tiếp" (hiện một lần). */
class FeatureAnnouncementDialog : DialogFragment() {
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val b = DialogFeatureAnnouncementBinding.inflate(layoutInflater)
        b.ivFeatureAnnouncementClose.setOnClickListener { dismiss() }
        b.btnFeatureAnnouncementPrimary.setOnClickListener {
            dismiss()
            ShareLocationSheet.newInstance(null, null, null, null, live = true).show(parentFragmentManager, "share_sheet")
        }
        return AlertDialog.Builder(requireContext()).setView(b.root).create()
    }
}
