package com.hawasuco.savelocation.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File
import java.util.UUID

/**
 * Cơ sở dữ liệu SQLite: bảng vị trí và bảng nhóm.
 * Mọi hàm đều chạy đồng bộ — gọi từ luồng nền (Dispatchers.IO) với dữ liệu lớn.
 */
class Db private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "save_location.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                contact_number TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                date_millis INTEGER NOT NULL,
                group_id TEXT,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                is_geofence INTEGER NOT NULL DEFAULT 0,
                geofence_radius INTEGER NOT NULL DEFAULT 100,
                images TEXT NOT NULL DEFAULT ''
            )"""
        )
        db.execSQL(
            """CREATE TABLE groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color INTEGER NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )"""
        )
        db.execSQL("CREATE INDEX idx_loc_group ON locations(group_id)")
        db.execSQL("CREATE INDEX idx_loc_fav ON locations(is_favorite)")
        db.execSQL("CREATE INDEX idx_loc_geo ON locations(is_geofence)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    // ---------------------------------------------------------------- Vị trí

    fun getLocations(
        groupId: String? = null,
        favoritesOnly: Boolean = false,
        geofenceOnly: Boolean = false,
        query: String? = null,
    ): MutableList<SavedLocation> {
        val where = mutableListOf<String>()
        val args = mutableListOf<String>()
        if (groupId != null && groupId != LocationGroup.ALL_ID) {
            where += "group_id = ?"; args += groupId
        }
        if (favoritesOnly) where += "is_favorite = 1"
        if (geofenceOnly) where += "is_geofence = 1"
        if (!query.isNullOrBlank()) {
            where += "(title LIKE ? OR address LIKE ? OR note LIKE ?)"
            val q = "%${query.trim()}%"
            args += q; args += q; args += q
        }
        val sel = if (where.isEmpty()) null else where.joinToString(" AND ")
        readableDatabase.query("locations", null, sel, args.toTypedArray(), null, null, "date_millis DESC, id DESC")
            .use { c ->
                val out = ArrayList<SavedLocation>(c.count)
                while (c.moveToNext()) out += c.toLocation()
                return out
            }
    }

    fun getLocation(id: Long): SavedLocation? =
        readableDatabase.query("locations", null, "id = ?", arrayOf(id.toString()), null, null, null)
            .use { c -> if (c.moveToFirst()) c.toLocation() else null }

    fun countLocations(): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM locations", null).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }

    fun insertLocation(loc: SavedLocation): Long {
        val id = writableDatabase.insert("locations", null, loc.toValues())
        loc.id = id
        return id
    }

    fun updateLocation(loc: SavedLocation) {
        writableDatabase.update("locations", loc.toValues(), "id = ?", arrayOf(loc.id.toString()))
    }

    fun setFavorite(id: Long, favorite: Boolean) {
        writableDatabase.update("locations", ContentValues().apply { put("is_favorite", if (favorite) 1 else 0) },
            "id = ?", arrayOf(id.toString()))
    }

    /** Đặt danh sách vị trí nằm trong vùng cảnh báo (những vị trí khác bị bỏ khỏi vùng). */
    fun setGeofenceSelection(ids: Set<Long>, radius: Int) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.execSQL("UPDATE locations SET is_geofence = 0")
            ids.forEach { id ->
                db.update("locations", ContentValues().apply {
                    put("is_geofence", 1); put("geofence_radius", radius)
                }, "id = ?", arrayOf(id.toString()))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun setGeofence(id: Long, enabled: Boolean) {
        writableDatabase.update("locations", ContentValues().apply { put("is_geofence", if (enabled) 1 else 0) },
            "id = ?", arrayOf(id.toString()))
    }

    fun deleteLocations(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            ids.forEach { id ->
                getLocation(id)?.images?.forEach { File(it).delete() }
                db.delete("locations", "id = ?", arrayOf(id.toString()))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun deleteAll(imagesDir: File) {
        writableDatabase.delete("locations", null, null)
        writableDatabase.delete("groups", null, null)
        imagesDir.listFiles()?.forEach { it.delete() }
    }

    // ---------------------------------------------------------------- Nhóm

    fun getGroups(): MutableList<LocationGroup> {
        val counts = HashMap<String, Int>()
        readableDatabase.rawQuery("SELECT group_id, COUNT(*) FROM locations WHERE group_id IS NOT NULL GROUP BY group_id", null)
            .use { c -> while (c.moveToNext()) counts[c.getString(0)] = c.getInt(1) }
        readableDatabase.query("groups", null, null, null, null, null, "display_order ASC, created_at ASC").use { c ->
            val out = ArrayList<LocationGroup>()
            while (c.moveToNext()) {
                val id = c.getString(c.getColumnIndexOrThrow("id"))
                out += LocationGroup(
                    id = id,
                    name = c.getString(c.getColumnIndexOrThrow("name")),
                    color = c.getInt(c.getColumnIndexOrThrow("color")),
                    displayOrder = c.getInt(c.getColumnIndexOrThrow("display_order")),
                    createdAt = c.getLong(c.getColumnIndexOrThrow("created_at")),
                    count = counts[id] ?: 0,
                )
            }
            return out
        }
    }

    fun getGroup(id: String?): LocationGroup? = if (id == null) null else getGroups().firstOrNull { it.id == id }

    fun findGroupByName(name: String): LocationGroup? =
        getGroups().firstOrNull { it.name.equals(name.trim(), ignoreCase = true) }

    fun insertGroup(group: LocationGroup) {
        if (group.id.isBlank()) group.id = UUID.randomUUID().toString()
        val maxOrder = readableDatabase.rawQuery("SELECT MAX(display_order) FROM groups", null)
            .use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }
        group.displayOrder = maxOrder + 1
        writableDatabase.insert("groups", null, group.toValues())
    }

    fun updateGroup(group: LocationGroup) {
        writableDatabase.update("groups", group.toValues(), "id = ?", arrayOf(group.id))
    }

    fun deleteGroup(id: String) {
        writableDatabase.update("locations", ContentValues().apply { putNull("group_id") }, "group_id = ?", arrayOf(id))
        writableDatabase.delete("groups", "id = ?", arrayOf(id))
    }

    fun saveGroupOrder(groups: List<LocationGroup>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            groups.forEachIndexed { i, g ->
                g.displayOrder = i
                db.update("groups", ContentValues().apply { put("display_order", i) }, "id = ?", arrayOf(g.id))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    // ---------------------------------------------------------------- Chuyển đổi

    private fun Cursor.toLocation(): SavedLocation {
        val imgs = getString(getColumnIndexOrThrow("images"))
        return SavedLocation(
            id = getLong(getColumnIndexOrThrow("id")),
            latitude = getDouble(getColumnIndexOrThrow("latitude")),
            longitude = getDouble(getColumnIndexOrThrow("longitude")),
            title = getString(getColumnIndexOrThrow("title")) ?: "",
            address = getString(getColumnIndexOrThrow("address")) ?: "",
            contactNumber = getString(getColumnIndexOrThrow("contact_number")) ?: "",
            note = getString(getColumnIndexOrThrow("note")) ?: "",
            dateMillis = getLong(getColumnIndexOrThrow("date_millis")),
            groupId = getString(getColumnIndexOrThrow("group_id")),
            favorite = getInt(getColumnIndexOrThrow("is_favorite")) == 1,
            geofence = getInt(getColumnIndexOrThrow("is_geofence")) == 1,
            geofenceRadius = getInt(getColumnIndexOrThrow("geofence_radius")),
            images = if (imgs.isNullOrBlank()) mutableListOf() else imgs.split(IMAGE_SEP).filter { it.isNotBlank() }.toMutableList(),
        )
    }

    private fun SavedLocation.toValues() = ContentValues().apply {
        put("latitude", latitude)
        put("longitude", longitude)
        put("title", title)
        put("address", address)
        put("contact_number", contactNumber)
        put("note", note)
        put("date_millis", dateMillis)
        if (groupId == null) putNull("group_id") else put("group_id", groupId)
        put("is_favorite", if (favorite) 1 else 0)
        put("is_geofence", if (geofence) 1 else 0)
        put("geofence_radius", geofenceRadius)
        put("images", images.joinToString(IMAGE_SEP))
    }

    private fun LocationGroup.toValues() = ContentValues().apply {
        put("id", id)
        put("name", name)
        put("color", color)
        put("display_order", displayOrder)
        put("created_at", createdAt)
    }

    companion object {
        private const val IMAGE_SEP = "|"

        @Volatile
        private var instance: Db? = null

        fun get(context: Context): Db =
            instance ?: synchronized(this) { instance ?: Db(context).also { instance = it } }
    }
}
