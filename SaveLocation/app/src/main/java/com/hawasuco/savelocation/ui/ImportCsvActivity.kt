package com.hawasuco.savelocation.ui

import android.os.Bundle
import android.view.MenuItem
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.databinding.ActivityImportCsvBinding
import com.hawasuco.savelocation.util.Exporter
import com.hawasuco.savelocation.util.ShareUtil
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.charset.Charset

/** Nhập vị trí từ file CSV: hướng dẫn định dạng + ví dụ, nút "Chọn file", báo các dòng lỗi. */
class ImportCsvActivity : AppCompatActivity() {
    private lateinit var b: ActivityImportCsvBinding

    private val picker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@registerForActivityResult
        b.progress.visibility = View.VISIBLE
        b.btnSelectFile.isEnabled = false
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = contentResolver.openInputStream(uri)!!.use { it.readBytes() }
                    val text = decode(bytes)
                    Exporter.importCsv(this@ImportCsvActivity, text)
                }
            }
            b.progress.visibility = View.GONE
            b.btnSelectFile.isEnabled = true
            val r = result.getOrElse { toast(R.string.msg_incorrect_csv_format); return@launch }
            DataBus.notifyChanged()
            val msg = getString(R.string.msg_csv_import_success, r.imported)
            if (r.errors.isEmpty()) {
                toast(msg); finish()
            } else {
                AlertDialog.Builder(this@ImportCsvActivity)
                    .setTitle(if (r.imported > 0) msg else getString(R.string.import_errors_title))
                    .setMessage(r.errors.take(30).joinToString("\n") + if (r.errors.size > 30) "\n…" else "")
                    .setPositiveButton(R.string.ok) { _, _ -> if (r.imported > 0) finish() }
                    .show()
            }
        }
    }

    /** UTF-8 (có/không BOM); nếu không hợp lệ thì thử Windows-1258 / 1252 (file CSV cũ từ Excel). */
    private fun decode(bytes: ByteArray): String {
        val utf8 = String(bytes, Charsets.UTF_8)
        if (!utf8.contains('\uFFFD')) return utf8
        for (cs in listOf("windows-1258", "windows-1252")) {
            runCatching { return String(bytes, Charset.forName(cs)) }
        }
        return utf8
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityImportCsvBinding.inflate(layoutInflater)
        setContentView(b.root)
        setTitle(R.string.import_csv)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        b.text2.text = Exporter.sampleCsv().trim()
        b.btnSelectFile.setOnClickListener {
            picker.launch(arrayOf("text/csv", "text/comma-separated-values", "text/plain", "application/csv", "application/vnd.ms-excel", "*/*"))
        }
        b.tvSample.setOnClickListener {
            lifecycleScope.launch {
                val r = withContext(Dispatchers.IO) {
                    runCatching { Exporter.saveToDownloads(this@ImportCsvActivity, "sample_locations.csv", "text/csv") { it.write(Exporter.sampleCsv().toByteArray()) } }.getOrNull()
                }
                if (r != null) ShareUtil.shareFile(this@ImportCsvActivity, r.file, "text/csv")
            }
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == android.R.id.home) { finish(); return true }
        return super.onOptionsItemSelected(item)
    }
}
