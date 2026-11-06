package com.hawasuco.savelocation.ui.backup

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.FragmentBackupBinding
import com.hawasuco.savelocation.geofence.GeofenceManager
import com.hawasuco.savelocation.util.Backup
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Sao lưu & khôi phục toàn bộ dữ liệu ra file (Google Drive, bộ nhớ máy...) — thay cho "Đồng bộ dữ liệu". */
class BackupFragment : Fragment() {
    private var _b: FragmentBackupBinding? = null
    private val b get() = _b!!

    private val createDoc = registerForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        uri?.let { doBackup(it) }
    }
    private val openDoc = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@registerForActivityResult
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.restore_mode_title)
            .setMessage(R.string.restore_mode_msg)
            .setPositiveButton(R.string.restore_merge) { _, _ -> doRestore(uri, false) }
            .setNegativeButton(R.string.restore_replace) { _, _ -> doRestore(uri, true) }
            .setNeutralButton(R.string.cancel, null)
            .show()
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentBackupBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.btnBackup.setOnClickListener {
            createDoc.launch("location_backup_" + SimpleDateFormat("yyyy-MM-dd_HHmm", Locale.US).format(Date()) + ".zip")
        }
        b.btnRestore.setOnClickListener { openDoc.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) }
        showLast()
    }

    override fun onResume() {
        super.onResume()
        requireActivity().title = getString(R.string.backup_restore)
    }

    private fun showLast() {
        val t = Prefs.lastBackupMillis
        b.tvLastBackup.text = if (t > 0) getString(R.string.last_backup, Formats.date(t)) else ""
    }

    private fun busy(on: Boolean) {
        b.progress.visibility = if (on) View.VISIBLE else View.GONE
        b.btnBackup.isEnabled = !on
        b.btnRestore.isEnabled = !on
    }

    private fun doBackup(uri: Uri) {
        val ctx = requireContext().applicationContext
        busy(true)
        viewLifecycleOwner.lifecycleScope.launch {
            val r = withContext(Dispatchers.IO) { runCatching { Backup.write(ctx, uri) } }
            busy(false)
            r.onSuccess {
                Prefs.lastBackupMillis = System.currentTimeMillis()
                showLast()
                ctx.toast(getString(R.string.backup_done, it.locations, it.images), long = true)
            }.onFailure { ctx.toast(getString(R.string.export_failed, it.message ?: ""), long = true) }
        }
    }

    private fun doRestore(uri: Uri, replace: Boolean) {
        val ctx = requireContext().applicationContext
        busy(true)
        viewLifecycleOwner.lifecycleScope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching { Backup.restore(ctx, uri, replace).also { GeofenceManager.registerAll(ctx) } }
            }
            busy(false)
            r.onSuccess {
                DataBus.notifyChanged()
                ctx.toast(getString(R.string.restore_done, it.locations, it.groups), long = true)
            }.onFailure { ctx.toast(R.string.backup_invalid, long = true) }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
