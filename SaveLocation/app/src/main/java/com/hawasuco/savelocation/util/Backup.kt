package com.hawasuco.savelocation.util

import android.content.Context
import android.net.Uri
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.SavedLocation
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Sao lưu toàn bộ dữ liệu ra một file .zip (data.json + thư mục images/) và khôi phục lại.
 * Thay cho tính năng đăng nhập / đồng bộ đám mây của ứng dụng gốc.
 */
object Backup {
    private const val FORMAT = "hawasuco-save-location-backup"

    data class Stats(val locations: Int, val groups: Int, val images: Int)

    fun write(context: Context, uri: Uri): Stats {
        val db = Db.get(context)
        val locations = db.getLocations()
        val groups = db.getGroups()
        var images = 0
        context.contentResolver.openOutputStream(uri)!!.use { os ->
            ZipOutputStream(os).use { zip ->
                val json = JSONObject()
                json.put("format", FORMAT)
                json.put("version", 1)
                json.put("created", System.currentTimeMillis())
                json.put("groups", JSONArray().apply {
                    groups.forEach { g ->
                        put(JSONObject().put("id", g.id).put("name", g.name).put("color", g.color)
                            .put("order", g.displayOrder).put("created", g.createdAt))
                    }
                })
                json.put("locations", JSONArray().apply {
                    locations.forEach { l ->
                        put(JSONObject()
                            .put("lat", l.latitude).put("lng", l.longitude).put("title", l.title)
                            .put("address", l.address).put("contact", l.contactNumber).put("note", l.note)
                            .put("date", l.dateMillis).put("group", l.groupId ?: JSONObject.NULL)
                            .put("favorite", l.favorite).put("geofence", l.geofence).put("radius", l.geofenceRadius)
                            .put("images", JSONArray(l.images.map { File(it).name })))
                    }
                })
                zip.putNextEntry(ZipEntry("data.json"))
                zip.write(json.toString(1).toByteArray())
                zip.closeEntry()
                locations.flatMap { it.images }.distinct().forEach { path ->
                    val f = File(path)
                    if (f.exists()) {
                        zip.putNextEntry(ZipEntry("images/" + f.name))
                        f.inputStream().use { it.copyTo(zip) }
                        zip.closeEntry()
                        images++
                    }
                }
            }
        }
        return Stats(locations.size, groups.size, images)
    }

    /** Khôi phục. [replace] = xoá dữ liệu hiện có trước; ngược lại gộp (nhóm trùng id được giữ). */
    fun restore(context: Context, uri: Uri, replace: Boolean): Stats {
        val imgDir = ImageStore.dir(context)
        val tmpDir = File(context.cacheDir, "restore_${System.currentTimeMillis()}").apply { mkdirs() }
        var json: JSONObject? = null
        try {
            context.contentResolver.openInputStream(uri)!!.use { input ->
                ZipInputStream(input).use { zip ->
                    var e = zip.nextEntry
                    while (e != null) {
                        val name = e.name
                        when {
                            name == "data.json" -> json = JSONObject(zip.readBytes().toString(Charsets.UTF_8))
                            name.startsWith("images/") && !e.isDirectory -> {
                                val safe = File(name).name
                                if (safe.isNotBlank()) File(tmpDir, safe).outputStream().use { zip.copyTo(it) }
                            }
                        }
                        e = zip.nextEntry
                    }
                }
            }
            val data = json ?: throw IllegalArgumentException("no data.json")
            if (data.optString("format") != FORMAT) throw IllegalArgumentException("format")
            val db = Db.get(context)
            if (replace) db.deleteAll(imgDir)
            val existingGroups = db.getGroups().associateBy { it.id }
            val ga = data.getJSONArray("groups")
            var groupCount = 0
            for (i in 0 until ga.length()) {
                val o = ga.getJSONObject(i)
                val id = o.getString("id")
                if (id in existingGroups) continue
                val byName = db.findGroupByName(o.getString("name"))
                if (byName != null) continue
                db.insertGroup(LocationGroup(id, o.getString("name"), o.getInt("color"), o.optInt("order"), o.optLong("created")))
                groupCount++
            }
            val nameToId = db.getGroups().associate { it.name.lowercase() to it.id }
            val idSet = db.getGroups().map { it.id }.toSet()
            val groupNamesById = (0 until ga.length()).associate { ga.getJSONObject(it).let { o -> o.getString("id") to o.getString("name") } }
            val la = data.getJSONArray("locations")
            for (i in 0 until la.length()) {
                val o = la.getJSONObject(i)
                val imgs = o.optJSONArray("images")
                val paths = ArrayList<String>()
                if (imgs != null) for (k in 0 until imgs.length()) {
                    val src = File(tmpDir, File(imgs.getString(k)).name)
                    if (src.exists()) {
                        val dst = ImageStore.newFile(context)
                        src.copyTo(dst, overwrite = true)
                        paths += dst.absolutePath
                    }
                }
                val gid = if (o.isNull("group")) null else o.getString("group").let { g ->
                    if (g in idSet) g else groupNamesById[g]?.lowercase()?.let { nameToId[it] }
                }
                db.insertLocation(SavedLocation(
                    latitude = o.getDouble("lat"), longitude = o.getDouble("lng"), title = o.optString("title"),
                    address = o.optString("address"), contactNumber = o.optString("contact"), note = o.optString("note"),
                    dateMillis = o.optLong("date", System.currentTimeMillis()), groupId = gid,
                    favorite = o.optBoolean("favorite"), geofence = o.optBoolean("geofence"),
                    geofenceRadius = o.optInt("radius", 200), images = paths,
                ))
            }
            return Stats(la.length(), groupCount, 0)
        } finally {
            tmpDir.deleteRecursively()
        }
    }
}
