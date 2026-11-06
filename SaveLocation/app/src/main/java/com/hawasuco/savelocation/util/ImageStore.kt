package com.hawasuco.savelocation.util

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.LruCache
import android.widget.ImageView
import androidx.exifinterface.media.ExifInterface
import androidx.lifecycle.LifecycleCoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.UUID

/** Lưu ảnh vị trí vào bộ nhớ riêng của ứng dụng (đã xoay đúng chiều, thu nhỏ tối đa 1600px). */
object ImageStore {
    private const val MAX_SIDE = 1600

    private val cache = object : LruCache<String, Bitmap>((Runtime.getRuntime().maxMemory() / 16).toInt()) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    fun dir(context: Context): File = File(context.filesDir, "images").apply { mkdirs() }

    fun newFile(context: Context): File = File(dir(context), "img_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}.jpg")

    /** Sao chép ảnh từ Uri (thư viện) về file của ứng dụng. */
    fun importFromUri(context: Context, uri: Uri): File? = runCatching {
        val tmp = File(context.cacheDir, "import_${System.currentTimeMillis()}")
        context.contentResolver.openInputStream(uri)?.use { input -> FileOutputStream(tmp).use { input.copyTo(it) } }
        val out = normalize(context, tmp)
        tmp.delete()
        out
    }.getOrNull()

    /** Chuẩn hóa file ảnh chụp từ camera (xoay theo EXIF, thu nhỏ) thành file mới. */
    fun normalize(context: Context, src: File): File? {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(src.absolutePath, opts)
        if (opts.outWidth <= 0) return null
        var sample = 1
        while (opts.outWidth / sample > MAX_SIDE * 2 || opts.outHeight / sample > MAX_SIDE * 2) sample *= 2
        var bmp = BitmapFactory.decodeFile(src.absolutePath, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return null
        val rotation = runCatching {
            when (ExifInterface(src.absolutePath).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        }.getOrDefault(0f)
        val scale = minOf(1f, MAX_SIDE.toFloat() / maxOf(bmp.width, bmp.height))
        if (rotation != 0f || scale < 1f) {
            val m = Matrix().apply { postScale(scale, scale); postRotate(rotation) }
            val r = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            if (r != bmp) bmp.recycle()
            bmp = r
        }
        val out = newFile(context)
        FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, 88, it) }
        bmp.recycle()
        return out
    }

    fun decodeSampled(path: String, reqSize: Int): Bitmap? {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, opts)
        if (opts.outWidth <= 0) return null
        var sample = 1
        while (opts.outWidth / (sample * 2) >= reqSize && opts.outHeight / (sample * 2) >= reqSize) sample *= 2
        return BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
    }

    /** Nạp ảnh thu nhỏ vào ImageView (có bộ nhớ đệm). */
    fun loadThumb(scope: LifecycleCoroutineScope, view: ImageView, path: String?, sizePx: Int, placeholder: Int) {
        view.tag = path
        if (path.isNullOrBlank()) {
            view.setImageResource(placeholder); return
        }
        val key = "$path@$sizePx"
        cache.get(key)?.let { view.setImageBitmap(it); return }
        view.setImageResource(placeholder)
        scope.launch {
            val bmp = withContext(Dispatchers.IO) { decodeSampled(path, sizePx) }
            if (bmp != null) {
                cache.put(key, bmp)
                if (view.tag == path) view.setImageBitmap(bmp)
            }
        }
    }

    fun evict(path: String) {
        cache.snapshot().keys.filter { it.startsWith("$path@") }.forEach { cache.remove(it) }
    }

    /** Lưu một bản sao ảnh vào thư mục Pictures/<tên app> để xem bằng Thư viện. */
    fun saveToGallery(context: Context, path: String, folder: String): Boolean = runCatching {
        val name = "location_${System.currentTimeMillis()}.jpg"
        if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + folder)
            }
            val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return false
            context.contentResolver.openOutputStream(uri)?.use { out -> File(path).inputStream().use { it.copyTo(out) } }
        } else {
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), folder).apply { mkdirs() }
            File(path).copyTo(File(dir, name), overwrite = true)
        }
        true
    }.getOrDefault(false)

    fun copyStream(input: InputStream, dest: File) {
        FileOutputStream(dest).use { input.copyTo(it) }
    }
}
