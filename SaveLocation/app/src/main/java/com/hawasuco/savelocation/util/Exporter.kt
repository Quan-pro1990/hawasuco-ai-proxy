package com.hawasuco.savelocation.util

import android.content.ContentValues
import android.content.Context
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.SavedLocation
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Xuất / nhập dữ liệu: CSV, GPX, KML, PDF, ảnh (ZIP). File được lưu vào Download/<tên app>. */
object Exporter {

    val CSV_HEADER = listOf("location name", "latitude", "longitude", "address", "contact number", "note", "date", "group name")

    data class Result(val file: File, val displayPath: String)

    data class ImportResult(val imported: Int, val errors: List<String>)

    private fun stamp() = SimpleDateFormat("yyyy_MM_dd_HH_mm_ss", Locale.US).format(Date())

    /** Thư mục con trong Download/Pictures (cố định, không đổi theo ngôn ngữ). */
    @Suppress("UNUSED_PARAMETER")
    fun folderName(context: Context) = "LuuViTri"

    // ------------------------------------------------------------------ CSV

    private fun csvField(v: String): String =
        if (v.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) "\"" + v.replace("\"", "\"\"") + "\"" else v

    fun csvText(context: Context, list: List<SavedLocation>, groups: Map<String, LocationGroup>): String {
        val sb = StringBuilder()
        sb.append(CSV_HEADER.joinToString(",")).append("\r\n")
        list.forEach { l ->
            val row = listOf(
                l.title, Coords.dd(l.latitude), Coords.dd(l.longitude), l.address, l.contactNumber, l.note,
                Formats.isoDate(l.dateMillis), l.groupId?.let { groups[it]?.name } ?: "",
            )
            sb.append(row.joinToString(",") { csvField(it) }).append("\r\n")
        }
        return sb.toString()
    }

    fun sampleCsv(): String = buildString {
        append(CSV_HEADER.joinToString(",")).append("\r\n")
        append("Home,10.776889,106.700806,\"1 Le Duan, Ben Nghe, District 1, Ho Chi Minh City\",0901234567,Main gate,2024-01-15 08:30:00,Family\r\n")
        append("Office,21.028511,105.804817,\"Hoan Kiem, Ha Noi\",,Parking B2,2024-02-20 17:45:00,Work\r\n")
        append("Water meter A1,9.784167,105.470833,Vi Thanh,,,2024-03-01 09:00:00,\r\n")
    }

    /** Đọc CSV (hỗ trợ dấu ngoặc kép, xuống dòng trong ô). */
    fun parseCsv(text: String): List<List<String>> {
        val rows = ArrayList<List<String>>()
        var row = ArrayList<String>()
        val cell = StringBuilder()
        var inQuotes = false
        var i = 0
        val t = text.removePrefix("\uFEFF")
        // File CSV từ Excel (máy cài tiếng Việt) thường dùng dấu chấm phẩy
        val firstLine = t.lineSequence().firstOrNull().orEmpty()
        val sep = if (firstLine.count { it == ';' } > firstLine.count { it == ',' }) ';' else ','
        while (i < t.length) {
            val c = t[i]
            when {
                inQuotes && c == '"' && i + 1 < t.length && t[i + 1] == '"' -> { cell.append('"'); i++ }
                c == '"' -> inQuotes = !inQuotes
                !inQuotes && c == sep -> { row.add(cell.toString()); cell.clear() }
                !inQuotes && (c == '\n' || c == '\r') -> {
                    if (c == '\r' && i + 1 < t.length && t[i + 1] == '\n') i++
                    row.add(cell.toString()); cell.clear()
                    if (row.any { it.isNotBlank() }) rows.add(row)
                    row = ArrayList()
                }
                else -> cell.append(c)
            }
            i++
        }
        if (cell.isNotEmpty() || row.isNotEmpty()) {
            row.add(cell.toString())
            if (row.any { it.isNotBlank() }) rows.add(row)
        }
        return rows
    }

    fun importCsv(context: Context, text: String): ImportResult {
        val rows = parseCsv(text)
        if (rows.isEmpty()) return ImportResult(0, listOf(context.getString(R.string.msg_incorrect_csv_format)))
        val header = rows[0].map { it.trim().lowercase() }
        val hasHeader = header.any { it.contains("lat") || it.contains("name") || it.contains("tên") || it.contains("vĩ") }
        if (!hasHeader && rows[0].size < 3) return ImportResult(0, listOf(context.getString(R.string.msg_incorrect_csv_format)))
        fun idx(vararg keys: String, def: Int): Int {
            if (!hasHeader) return def
            val i = header.indexOfFirst { h -> keys.any { k -> h.contains(k) } }
            return if (i >= 0) i else def
        }
        val iTitle = idx("location name", "name", "title", "tên", def = 0)
        val iLat = idx("latitude", "lat", "vĩ độ", def = 1)
        val iLng = idx("longitude", "lng", "lon", "kinh độ", def = 2)
        val iAddr = idx("address", "địa chỉ", def = 3)
        val iContact = idx("contact", "phone", "điện thoại", def = 4)
        val iNote = idx("note", "ghi chú", def = 5)
        val iDate = idx("date", "ngày", def = 6)
        val iGroup = idx("group", "nhóm", def = 7)

        val db = Db.get(context)
        val groupCache = HashMap<String, LocationGroup>()
        db.getGroups().forEach { groupCache[it.name.lowercase()] = it }
        val errors = ArrayList<String>()
        var count = 0
        val data = if (hasHeader) rows.drop(1) else rows
        data.forEachIndexed { n, r ->
            val rowNo = n + if (hasHeader) 2 else 1
            fun get(i: Int) = r.getOrNull(i)?.trim().orEmpty()
            val title = get(iTitle)
            if (title.isEmpty()) { errors += context.getString(R.string.msg_import_csv_title_empty, rowNo); return@forEachIndexed }
            val lat = get(iLat).replace(',', '.').toDoubleOrNull()
            val lng = get(iLng).replace(',', '.').toDoubleOrNull()
            if (lat == null || lat !in -90.0..90.0) { errors += context.getString(R.string.msg_import_csv_latitude_range_error, rowNo); return@forEachIndexed }
            if (lng == null || lng !in -180.0..180.0) { errors += context.getString(R.string.msg_import_csv_longitude_range_error, rowNo); return@forEachIndexed }
            val dateText = get(iDate)
            var date = Formats.parseDate(dateText)
            if (date == null) {
                if (dateText.isNotEmpty()) errors += context.getString(R.string.msg_import_csv_date_format_error, rowNo)
                date = System.currentTimeMillis()
            }
            val groupName = get(iGroup)
            val groupId = if (groupName.isEmpty()) null else {
                groupCache.getOrPut(groupName.lowercase()) {
                    LocationGroup(id = java.util.UUID.randomUUID().toString(), name = groupName,
                        color = GROUP_COLORS[groupCache.size % GROUP_COLORS.size]).also { db.insertGroup(it) }
                }.id
            }
            db.insertLocation(SavedLocation(
                latitude = lat, longitude = lng, title = title, address = get(iAddr), contactNumber = get(iContact),
                note = get(iNote), dateMillis = date, groupId = groupId,
            ))
            count++
        }
        return ImportResult(count, errors)
    }

    private val GROUP_COLORS = intArrayOf(
        0xFFE53935.toInt(), 0xFF1E88E5.toInt(), 0xFF43A047.toInt(), 0xFFFB8C00.toInt(),
        0xFF8E24AA.toInt(), 0xFF00ACC1.toInt(), 0xFF6D4C41.toInt(), 0xFFD81B60.toInt(),
    )

    // ------------------------------------------------------------------ GPX / KML

    private fun xml(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

    fun gpxText(context: Context, list: List<SavedLocation>): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8"?>""").append('\n')
        append("""<gpx version="1.1" creator="${xml(context.getString(R.string.app_name))}" xmlns="http://www.topografix.com/GPX/1/1">""").append('\n')
        list.forEach { l ->
            append("""  <wpt lat="${Coords.dd(l.latitude)}" lon="${Coords.dd(l.longitude)}">""").append('\n')
            append("    <time>${Formats.isoUtc(l.dateMillis)}</time>\n")
            append("    <name>${xml(l.title)}</name>\n")
            val desc = listOf(l.address, l.contactNumber, l.note).filter { it.isNotBlank() }.joinToString(" | ")
            if (desc.isNotBlank()) append("    <desc>${xml(desc)}</desc>\n")
            append("  </wpt>\n")
        }
        append("</gpx>\n")
    }

    fun kmlText(context: Context, list: List<SavedLocation>, groups: Map<String, LocationGroup>): String = buildString {
        append("""<?xml version="1.0" encoding="UTF-8"?>""").append('\n')
        append("""<kml xmlns="http://www.opengis.net/kml/2.2"><Document>""").append('\n')
        append("<name>${xml(context.getString(R.string.app_name))}</name>\n")
        list.forEach { l ->
            append("<Placemark>\n<name>${xml(l.title)}</name>\n")
            val parts = listOfNotNull(
                l.address.takeIf { it.isNotBlank() }?.let { "${context.getString(R.string.address)}: $it" },
                l.contactNumber.takeIf { it.isNotBlank() }?.let { "${context.getString(R.string.contact_number)}: $it" },
                l.note.takeIf { it.isNotBlank() }?.let { "${context.getString(R.string.note)}: $it" },
                "${context.getString(R.string.date)}: ${Formats.date(l.dateMillis)}",
                l.groupId?.let { groups[it]?.name }?.let { "${context.getString(R.string.group)}: $it" },
            )
            append("<description>${xml(parts.joinToString("\n"))}</description>\n")
            append("<Point><coordinates>${Coords.dd(l.longitude)},${Coords.dd(l.latitude)},0</coordinates></Point>\n")
            append("</Placemark>\n")
        }
        append("</Document></kml>\n")
    }

    // ------------------------------------------------------------------ PDF

    fun writePdf(context: Context, list: List<SavedLocation>, groups: Map<String, LocationGroup>, out: OutputStream) {
        val doc = PdfDocument()
        val pageW = 595
        val pageH = 842
        val margin = 36f
        val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 15f; typeface = Typeface.DEFAULT_BOLD; color = 0xFF0288D1.toInt() }
        val bodyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 10.5f; color = 0xFF212121.toInt() }
        val headPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 18f; typeface = Typeface.DEFAULT_BOLD; color = 0xFF212121.toInt() }
        val linePaint = Paint().apply { color = 0xFFDDDDDD.toInt(); strokeWidth = 1f }
        var pageNo = 0
        var page: PdfDocument.Page? = null
        var y = 0f

        fun newPage() {
            page?.let { doc.finishPage(it) }
            pageNo++
            page = doc.startPage(PdfDocument.PageInfo.Builder(pageW, pageH, pageNo).create())
            y = margin
            if (pageNo == 1) {
                page!!.canvas.drawText(context.getString(R.string.app_name) + " – " + context.getString(R.string.saved_locations), margin, y + 18, headPaint)
                y += 30
                page!!.canvas.drawText(Formats.date(System.currentTimeMillis()) + " • " + context.getString(R.string.n_locations, list.size), margin, y + 10, bodyPaint)
                y += 24
            }
        }
        newPage()
        val textWidth = (pageW - margin * 2 - 110).toInt()
        list.forEachIndexed { idx, l ->
            val text = buildString {
                append(Coords.displayInline(context, l.latitude, l.longitude)).append('\n')
                if (l.address.isNotBlank()) append(context.getString(R.string.address)).append(": ").append(l.address).append('\n')
                if (l.contactNumber.isNotBlank()) append(context.getString(R.string.contact_number)).append(": ").append(l.contactNumber).append('\n')
                if (l.note.isNotBlank()) append(context.getString(R.string.note)).append(": ").append(l.note).append('\n')
                append(context.getString(R.string.date)).append(": ").append(Formats.date(l.dateMillis))
                l.groupId?.let { groups[it]?.name }?.let { append('\n').append(context.getString(R.string.group)).append(": ").append(it) }
                append('\n').append(ShareUtil.googleMapsUrl(l.latitude, l.longitude))
            }
            val layout = StaticLayout.Builder.obtain(text, 0, text.length, bodyPaint, textWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL).setLineSpacing(2f, 1f).build()
            val titleLayout = StaticLayout.Builder.obtain("${idx + 1}. ${l.title}", 0, "${idx + 1}. ${l.title}".length, titlePaint, textWidth).build()
            val blockH = titleLayout.height + layout.height + 20f
            val imgH = if (l.images.isNotEmpty()) 96f else 0f
            if (y + maxOf(blockH, imgH + 10) > pageH - margin) newPage()
            val c = page!!.canvas
            c.save(); c.translate(margin, y); titleLayout.draw(c); c.restore()
            c.save(); c.translate(margin, y + titleLayout.height + 4); layout.draw(c); c.restore()
            l.images.firstOrNull()?.let { path ->
                ImageStore.decodeSampled(path, 200)?.let { bmp ->
                    val scale = minOf(96f / bmp.width, 96f / bmp.height)
                    val w = bmp.width * scale
                    val h = bmp.height * scale
                    val left = pageW - margin - w
                    c.drawBitmap(bmp, null, RectF(left, y, left + w, y + h), null)
                    bmp.recycle()
                }
            }
            y += maxOf(blockH, imgH + 10)
            c.drawLine(margin, y - 8, pageW - margin, y - 8, linePaint)
        }
        page?.let { doc.finishPage(it) }
        doc.writeTo(out)
        doc.close()
    }

    // ------------------------------------------------------------------ Ảnh

    fun writeImagesZip(list: List<SavedLocation>, out: OutputStream): Int {
        var n = 0
        ZipOutputStream(out).use { zip ->
            val used = HashSet<String>()
            list.forEach { l ->
                l.images.forEachIndexed { i, path ->
                    val f = File(path)
                    if (!f.exists()) return@forEachIndexed
                    val base = l.title.replace(Regex("[\\\\/:*?\"<>|]"), "_").take(60).ifBlank { "location_${l.id}" }
                    var name = "${base}_${i + 1}.jpg"
                    var k = 2
                    while (!used.add(name)) { name = "${base}_${i + 1}_$k.jpg"; k++ }
                    zip.putNextEntry(ZipEntry(name))
                    f.inputStream().use { it.copyTo(zip) }
                    zip.closeEntry()
                    n++
                }
            }
        }
        return n
    }

    // ------------------------------------------------------------------ Lưu file

    /**
     * Ghi file vào Download/<tên app> (Android 10+: MediaStore, không cần quyền).
     * Đồng thời giữ một bản trong cache để có thể chia sẻ ngay.
     */
    fun saveToDownloads(context: Context, name: String, mime: String, writer: (OutputStream) -> Unit): Result {
        val shareDir = File(context.cacheDir, "export").apply { mkdirs() }
        val cacheFile = File(shareDir, name)
        FileOutputStream(cacheFile).use { writer(it) }
        val folder = folderName(context)
        val display: String
        if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + folder)
            }
            val uri: Uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("MediaStore")
            context.contentResolver.openOutputStream(uri)?.use { out -> cacheFile.inputStream().use { it.copyTo(out) } }
            display = "Download/$folder/$name"
        } else {
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), folder).apply { mkdirs() }
            val f = File(dir, name)
            cacheFile.copyTo(f, overwrite = true)
            display = f.absolutePath
        }
        return Result(cacheFile, display)
    }

    fun fileName(prefix: String, ext: String) = "${prefix}_${stamp()}.$ext"
}
