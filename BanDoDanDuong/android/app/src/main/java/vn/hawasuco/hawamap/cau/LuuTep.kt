package vn.hawasuco.hawamap.cau

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import java.io.File

/** Lưu tệp do trang gửi (vd. hành trình GPX) vào thư mục Tải xuống. */
object LuuTep {
    /** Trả về nơi đã lưu (để báo người dùng) hoặc null nếu lỗi. */
    fun luu(ctx: Context, ten: String, kieu: String, base64: String): String? {
        val du = try { Base64.decode(base64, Base64.DEFAULT) } catch (e: IllegalArgumentException) { return null }
        val tenSach = ten.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifBlank { "hawamap.txt" }
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val giaTri = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, tenSach)
                    put(MediaStore.MediaColumns.MIME_TYPE, kieu.ifBlank { "application/octet-stream" })
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val phanGiai = ctx.contentResolver
                val uri = phanGiai.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, giaTri) ?: return null
                phanGiai.openOutputStream(uri)?.use { it.write(du) } ?: return null
                giaTri.clear()
                giaTri.put(MediaStore.MediaColumns.IS_PENDING, 0)
                phanGiai.update(uri, giaTri, null, null)
                "Tải xuống/$tenSach"
            } else {
                val thuMuc = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: return null
                val tep = File(thuMuc, tenSach)
                tep.writeBytes(du)
                tep.absolutePath
            }
        } catch (e: Exception) {
            null
        }
    }
}
