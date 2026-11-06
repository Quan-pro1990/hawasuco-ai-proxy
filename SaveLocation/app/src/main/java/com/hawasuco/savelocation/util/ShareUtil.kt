package com.hawasuco.savelocation.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.Prefs.Share
import com.hawasuco.savelocation.data.SavedLocation
import java.io.File
import java.util.Locale

/** Tạo nội dung chia sẻ / sao chép theo "Nội dung khi chia sẻ" trong Cài đặt. */
object ShareUtil {

    fun googleMapsUrl(lat: Double, lng: Double) =
        "https://maps.google.com/maps?q=${Coords.dd(lat)},${Coords.dd(lng)}"

    fun wazeUrl(lat: Double, lng: Double) =
        "https://waze.com/ul?ll=${Coords.dd(lat)},${Coords.dd(lng)}&navigate=yes"

    fun osmUrl(lat: Double, lng: Double) =
        "https://www.openstreetmap.org/?mlat=${Coords.dd(lat)}&mlon=${Coords.dd(lng)}#map=17/${Coords.dd(lat)}/${Coords.dd(lng)}"

    fun buildText(context: Context, loc: SavedLocation, includeDate: Boolean = true): String {
        val sb = StringBuilder()
        fun line(label: String, value: String) {
            if (value.isBlank()) return
            if (sb.isNotEmpty()) sb.append('\n')
            sb.append(label).append(": ").append(value)
        }
        if (Prefs.shareField(Share.TITLE)) line(context.getString(R.string.title), loc.title)
        if (Prefs.coordFormat == "UTM") {
            val u = Coords.toUtm(loc.latitude, loc.longitude)
            if (Prefs.shareField(Share.UTM_N)) line(context.getString(R.string.utm_northing), u.northingText)
            if (Prefs.shareField(Share.UTM_E)) line(context.getString(R.string.utm_easting), u.eastingText)
            if (Prefs.shareField(Share.UTM_ZONE)) line(context.getString(R.string.utm_zone), u.zoneText)
        } else {
            val d = Coords.display(context, loc.latitude, loc.longitude)
            if (Prefs.shareField(Share.LAT)) line(context.getString(R.string.latitude), d.first)
            if (Prefs.shareField(Share.LNG)) line(context.getString(R.string.longitude), d.second)
        }
        if (Prefs.shareField(Share.ADDRESS)) line(context.getString(R.string.address), loc.address)
        if (Prefs.shareField(Share.CONTACT)) line(context.getString(R.string.contact_number), loc.contactNumber)
        if (Prefs.shareField(Share.NOTE)) line(context.getString(R.string.note), loc.note)
        if (includeDate && Prefs.shareField(Share.DATE)) line(context.getString(R.string.date), Formats.date(loc.dateMillis))
        if (Prefs.shareField(Share.GOOGLE)) {
            if (sb.isNotEmpty()) sb.append("\n\n")
            sb.append(context.getString(R.string.google_maps)).append(":\n").append(googleMapsUrl(loc.latitude, loc.longitude))
        }
        if (Prefs.shareField(Share.WAZE)) {
            if (sb.isNotEmpty()) sb.append("\n\n")
            sb.append(context.getString(R.string.waze)).append(":\n").append(wazeUrl(loc.latitude, loc.longitude))
        }
        if (Prefs.shareField(Share.OSM)) {
            if (sb.isNotEmpty()) sb.append("\n\n")
            sb.append("OpenStreetMap:\n").append(osmUrl(loc.latitude, loc.longitude))
        }
        if (sb.isEmpty()) sb.append(googleMapsUrl(loc.latitude, loc.longitude))
        return sb.toString()
    }

    fun share(context: Context, loc: SavedLocation) {
        val text = buildText(context, loc)
        val images = loc.images.map { File(it) }.filter { it.exists() }
        val intent = if (images.isEmpty()) {
            Intent(Intent.ACTION_SEND).apply { type = "text/plain" }
        } else {
            val uris = ArrayList<Uri>(images.map { fileUri(context, it) })
            if (uris.size == 1) Intent(Intent.ACTION_SEND).apply {
                type = "image/*"; putExtra(Intent.EXTRA_STREAM, uris[0])
            } else Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                type = "image/*"; putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            }.also { it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        }
        intent.putExtra(Intent.EXTRA_SUBJECT, loc.title.ifBlank { context.getString(R.string.app_name) })
        intent.putExtra(Intent.EXTRA_TEXT, text)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startChooser(context, intent)
    }

    fun shareText(context: Context, text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text)
        }
        startChooser(context, intent)
    }

    fun shareFile(context: Context, file: File, mime: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, fileUri(context, file))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startChooser(context, intent, context.getString(R.string.share_file_chooser_title))
    }

    private fun startChooser(context: Context, intent: Intent, title: String = context.getString(R.string.share_via)) {
        val chooser = Intent.createChooser(intent, title)
        if (context !is android.app.Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(chooser)
    }

    fun fileUri(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)

    fun copy(context: Context, text: String, toastRes: Int = R.string.msg_location_copied_to_clipboard) {
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("location", text))
        Toast.makeText(context, toastRes, Toast.LENGTH_SHORT).show()
    }

    fun copyLocation(context: Context, loc: SavedLocation) = copy(context, buildText(context, loc))

    /** Văn bản tên nhóm của vị trí (để hiển thị). */
    fun groupName(context: Context, groupId: String?): String =
        Db.get(context).getGroup(groupId)?.name ?: context.getString(R.string.all)

    fun lowerTrim(s: String) = s.trim().lowercase(Locale.getDefault())
}
