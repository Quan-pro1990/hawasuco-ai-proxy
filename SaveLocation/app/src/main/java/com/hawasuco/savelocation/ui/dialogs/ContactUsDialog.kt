package com.hawasuco.savelocation.ui.dialogs

import android.app.Dialog
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.databinding.DialogContactUsBinding
import com.hawasuco.savelocation.databinding.ItemContactUsOptionBinding
import com.hawasuco.savelocation.ui.ContactFormActivity

/** "Liên hệ": chọn chủ đề (Góp ý, Báo lỗi, Đề nghị tính năng, Giải pháp cho đơn vị) → biểu mẫu liên hệ. */
class ContactUsDialog : DialogFragment() {
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val b = DialogContactUsBinding.inflate(layoutInflater)
        val dialog = AlertDialog.Builder(requireContext()).setView(b.root).create()
        val options = listOf(
            R.drawable.ic_feedback to R.string.contact_us_feedback,
            R.drawable.ic_report to R.string.contact_us_report_issue,
            R.drawable.ic_lightbulb to R.string.contact_us_feature_request,
            R.drawable.ic_business to R.string.contact_us_business,
        )
        options.forEach { (icon, label) ->
            val row = ItemContactUsOptionBinding.inflate(layoutInflater, b.rvContactUsOptions, false)
            row.ivIcon.setImageResource(icon)
            row.tvLabel.setText(label)
            row.root.setOnClickListener {
                startActivity(Intent(requireContext(), ContactFormActivity::class.java)
                    .putExtra(ContactFormActivity.EXTRA_TOPIC, getString(label)))
                dismiss()
            }
            b.rvContactUsOptions.addView(row.root)
        }
        b.ivContactUsClose.setOnClickListener { dismiss() }
        return dialog
    }
}
