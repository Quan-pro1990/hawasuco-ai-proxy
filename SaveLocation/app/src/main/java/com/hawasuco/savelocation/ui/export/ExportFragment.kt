package com.hawasuco.savelocation.ui.export

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.DialogExportGroupwiseBinding
import com.hawasuco.savelocation.databinding.FragmentExportBinding
import com.hawasuco.savelocation.ui.ImportCsvActivity
import com.hawasuco.savelocation.util.Exporter
import com.hawasuco.savelocation.util.ShareUtil
import com.hawasuco.savelocation.util.toast
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.OutputStream

/** Nhập/Xuất dữ liệu: GPX, KML, CSV, nhập CSV, chia sẻ CSV, PDF, ảnh — giống danh sách của app gốc (mở khoá sẵn). */
class ExportFragment : Fragment() {
    private var _b: FragmentExportBinding? = null
    private val b get() = _b!!

    private enum class Kind(val label: Int, val ext: String, val mime: String) {
        GPX(R.string.export_gpx, "gpx", "application/gpx+xml"),
        KML(R.string.export_kml, "kml", "application/vnd.google-earth.kml+xml"),
        CSV(R.string.export_csv, "csv", "text/csv"),
        SHARE_CSV(R.string.share_csv, "csv", "text/csv"),
        PDF(R.string.export_pdf, "pdf", "application/pdf"),
        IMAGES(R.string.export_images, "zip", "application/zip"),
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentExportBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.tvHint.text = getString(R.string.export_hint, Exporter.folderName(requireContext()))
        b.llExportGpx.setOnClickListener { chooseThen(Kind.GPX) }
        b.llExportKml.setOnClickListener { chooseThen(Kind.KML) }
        b.llExportCsv.setOnClickListener { chooseThen(Kind.CSV) }
        b.llShareCsv.setOnClickListener { chooseThen(Kind.SHARE_CSV) }
        b.llExportPdf.setOnClickListener { chooseThen(Kind.PDF) }
        b.llExportImages.setOnClickListener { chooseThen(Kind.IMAGES) }
        b.llImportCsv.setOnClickListener { startActivity(Intent(requireContext(), ImportCsvActivity::class.java)) }
        b.tvSampleCsv.setOnClickListener { sampleCsv() }
    }

    override fun onResume() {
        super.onResume()
        requireActivity().title = getString(R.string.import_export_data)
    }

    /** Ở chế độ nhóm: hỏi xuất tất cả hay chọn nhóm (giống "export groupwise" của app gốc). */
    private fun chooseThen(kind: Kind) {
        val ctx = requireContext()
        viewLifecycleOwner.lifecycleScope.launch {
            val groups = withContext(Dispatchers.IO) { Db.get(ctx).getGroups() }
            if (!Prefs.groupMode || groups.isEmpty()) { run(kind, null); return@launch }
            val db = DialogExportGroupwiseBinding.inflate(layoutInflater)
            val boxes = ArrayList<Pair<CheckBox, String?>>()
            (listOf<LocationGroup?>(null) + groups).forEach { g ->
                val cb = CheckBox(ctx).apply { text = g?.name ?: getString(R.string.no_group); isChecked = true }
                db.llGroups.addView(cb); boxes += cb to g?.id
            }
            db.radioGroup.setOnCheckedChangeListener { _, id -> db.llGroups.visible(id == R.id.rb_group) }
            AlertDialog.Builder(ctx)
                .setTitle(R.string.export_groupwise)
                .setView(db.root)
                .setPositiveButton(kind.label) { _, _ ->
                    if (db.rbAll.isChecked) run(kind, null)
                    else {
                        val sel = boxes.filter { it.first.isChecked }.map { it.second }.toSet()
                        if (sel.isEmpty()) ctx.toast(R.string.must_select_group) else run(kind, sel)
                    }
                }
                .setNegativeButton(R.string.cancel, null)
                .show()
        }
    }

    private fun run(kind: Kind, groupIds: Set<String?>?) {
        val ctx = requireContext().applicationContext
        b.progressOverlay.visibility = View.VISIBLE
        b.tvProgress.setText(if (kind == Kind.IMAGES) R.string.exporting_images else R.string.exporting)
        viewLifecycleOwner.lifecycleScope.launch {
            val outcome = withContext(Dispatchers.IO) {
                runCatching {
                    val db = Db.get(ctx)
                    val groups = db.getGroups().associateBy { it.id }
                    var list: List<SavedLocation> = db.getLocations()
                    if (groupIds != null) list = list.filter { it.groupId in groupIds }
                    if (list.isEmpty()) return@runCatching null
                    if (kind == Kind.IMAGES && list.none { it.images.isNotEmpty() }) return@runCatching null
                    val writer: (OutputStream) -> Unit = when (kind) {
                        Kind.GPX -> { o -> o.write(Exporter.gpxText(ctx, list).toByteArray()) }
                        Kind.KML -> { o -> o.write(Exporter.kmlText(ctx, list, groups).toByteArray()) }
                        Kind.CSV, Kind.SHARE_CSV -> { o ->
                            o.write(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())) // BOM để Excel đọc đúng tiếng Việt
                            o.write(Exporter.csvText(ctx, list, groups).toByteArray())
                        }
                        Kind.PDF -> { o -> Exporter.writePdf(ctx, list, groups, o) }
                        Kind.IMAGES -> { o -> Exporter.writeImagesZip(list, o) }
                    }
                    val prefix = if (kind == Kind.IMAGES) "location_images" else "saved_locations"
                    Exporter.saveToDownloads(ctx, Exporter.fileName(prefix, kind.ext), kind.mime, writer)
                }
            }
            _b ?: return@launch
            b.progressOverlay.visibility = View.GONE
            val result = outcome.getOrElse {
                ctx.toast(getString(R.string.export_failed, it.message ?: it.javaClass.simpleName), long = true); return@launch
            }
            if (result == null) { ctx.toast(R.string.no_data_to_export); return@launch }
            val label = getString(kind.label).substringAfter(' ')
            ctx.toast(getString(R.string.export_done, label))
            val pathView: TextView = when (kind) {
                Kind.GPX -> b.tvGpxFilePath
                Kind.KML -> b.tvKmlFilePath
                Kind.CSV -> b.tvFilePath
                Kind.SHARE_CSV -> b.tvShareHint
                Kind.PDF -> b.tvPdfFilePath
                Kind.IMAGES -> b.tvImageFilePath
            }
            pathView.text = getString(R.string.exported_file_path, result.displayPath)
            pathView.visibility = View.VISIBLE
            if (kind == Kind.SHARE_CSV || kind == Kind.PDF) ShareUtil.shareFile(requireContext(), result.file, kind.mime)
        }
    }

    private fun sampleCsv() {
        val items = arrayOf(getString(R.string.download), getString(R.string.share))
        AlertDialog.Builder(requireContext()).setItems(items) { _, which ->
            val ctx = requireContext()
            viewLifecycleOwner.lifecycleScope.launch {
                val r = withContext(Dispatchers.IO) {
                    runCatching {
                        Exporter.saveToDownloads(ctx, "sample_locations.csv", "text/csv") { it.write(Exporter.sampleCsv().toByteArray()) }
                    }.getOrNull()
                } ?: run { ctx.toast(R.string.unknown_error); return@launch }
                if (which == 0) {
                    b.tvSampleCsvPath.text = getString(R.string.sample_csv_file_path, r.displayPath)
                    b.tvSampleCsvPath.visibility = View.VISIBLE
                } else {
                    ShareUtil.shareFile(ctx, r.file, "text/csv")
                }
            }
        }.show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
