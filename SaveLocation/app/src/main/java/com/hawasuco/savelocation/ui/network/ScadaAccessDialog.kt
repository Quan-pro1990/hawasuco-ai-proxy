package com.hawasuco.savelocation.ui.network

import android.app.Dialog
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.DialogScadaAccessBinding
import com.hawasuco.savelocation.network.PipeStore
import com.hawasuco.savelocation.network.PipeSync
import com.hawasuco.savelocation.util.hideKeyboard
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.launch

/** Nhập mã truy cập bản đồ mạng lưới SCADA (giống ô "Mã truy cập" trên web), kiểm tra rồi tải đường ống. */
class ScadaAccessDialog : DialogFragment() {

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val ctx = requireContext()
        val v = DialogScadaAccessBinding.inflate(layoutInflater)
        if (savedInstanceState == null) {
            v.etCode.setText(Prefs.scadaCode)
            v.etUrl.setText(Prefs.scadaUrl)
        }
        val dialog = AlertDialog.Builder(ctx)
            .setTitle(R.string.pipe_access_title)
            .setView(v.root)
            .setPositiveButton(R.string.ok, null)
            .setNegativeButton(R.string.cancel, null)
            .create()
        dialog.setOnShowListener {
            val ok = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            ok.setOnClickListener {
                val code = v.etCode.text?.toString()?.trim().orEmpty()
                var url = v.etUrl.text?.toString()?.trim()?.trimEnd('/').orEmpty().ifBlank { Prefs.DEFAULT_SCADA_URL }
                if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://$url"
                v.tilCode.error = null
                if (code.isEmpty()) { v.tilCode.error = getString(R.string.pipe_need_code); return@setOnClickListener }
                v.root.hideKeyboard()
                ok.isEnabled = false
                v.tvResult.visible(true)
                v.tvResult.setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
                v.tvResult.setText(R.string.pipe_checking)
                lifecycleScope.launch {
                    val err = PipeSync.testCode(url, code)
                    if (!isAdded) return@launch
                    ok.isEnabled = true
                    if (err != null) {
                        v.tvResult.setTextColor(ContextCompat.getColor(ctx, R.color.danger))
                        v.tvResult.text = PipeSync.errorText(ctx, err)
                        if (err == PipeSync.ERR_WRONG_CODE) v.tilCode.error = getString(R.string.pipe_wrong_code)
                        return@launch
                    }
                    Prefs.scadaUrl = url
                    Prefs.scadaCode = code
                    Prefs.pipeLastError = ""
                    PipeStore.notifyStyleChanged()
                    val app = ctx.applicationContext
                    app.toast(R.string.pipe_connected)
                    PipeSync.syncInBackground(app) { r -> app.toast(NetworkFragment.syncMessage(app, r)) }
                    dismissAllowingStateLoss()
                }
            }
        }
        return dialog
    }

    companion object {
        const val TAG = "scada_access"
    }
}
