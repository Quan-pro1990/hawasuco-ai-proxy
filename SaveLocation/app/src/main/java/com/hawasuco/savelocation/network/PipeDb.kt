package com.hawasuco.savelocation.network

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Lưu đường ống đã tải từ SCADA trên máy (dùng được khi mất mạng). CSDL riêng: network.db */
class PipeDb private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "network.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE pipe_layers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                color INTEGER NOT NULL,
                weight REAL NOT NULL,
                visible INTEGER NOT NULL,
                sort INTEGER NOT NULL,
                feature_count INTEGER NOT NULL DEFAULT 0,
                missing_diameter INTEGER NOT NULL DEFAULT 0,
                hash TEXT NOT NULL DEFAULT '',
                source_file TEXT NOT NULL DEFAULT '',
                updated_at INTEGER NOT NULL DEFAULT 0
            )"""
        )
        db.execSQL(
            """CREATE TABLE pipes (
                id INTEGER NOT NULL,
                layer_id INTEGER NOT NULL,
                min_lat REAL, min_lon REAL, max_lat REAL, max_lon REAL,
                coords BLOB NOT NULL,
                title TEXT,
                diameter REAL,
                length REAL,
                material TEXT,
                dash INTEGER NOT NULL DEFAULT 0,
                props TEXT NOT NULL DEFAULT '{}'
            )"""
        )
        db.execSQL("CREATE INDEX idx_pipes_layer ON pipes(layer_id)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    fun layers(): MutableList<PipeLayer> =
        readableDatabase.query("pipe_layers", null, null, null, null, null, "sort ASC").use { c ->
            val out = ArrayList<PipeLayer>()
            while (c.moveToNext()) {
                out += PipeLayer(
                    id = c.getLong(c.getColumnIndexOrThrow("id")),
                    name = c.getString(c.getColumnIndexOrThrow("name")),
                    kind = c.getString(c.getColumnIndexOrThrow("kind")),
                    color = c.getInt(c.getColumnIndexOrThrow("color")),
                    weight = c.getFloat(c.getColumnIndexOrThrow("weight")),
                    visible = c.getInt(c.getColumnIndexOrThrow("visible")) == 1,
                    order = c.getInt(c.getColumnIndexOrThrow("sort")),
                    featureCount = c.getInt(c.getColumnIndexOrThrow("feature_count")),
                    missingDiameter = c.getInt(c.getColumnIndexOrThrow("missing_diameter")),
                    hash = c.getString(c.getColumnIndexOrThrow("hash")),
                    sourceFile = c.getString(c.getColumnIndexOrThrow("source_file")),
                    updatedAt = c.getLong(c.getColumnIndexOrThrow("updated_at")),
                )
            }
            out
        }

    fun features(layerId: Long): List<PipeFeature> =
        readableDatabase.query("pipes", null, "layer_id = ?", arrayOf(layerId.toString()), null, null, null).use { c ->
            val out = ArrayList<PipeFeature>(c.count)
            val iId = c.getColumnIndexOrThrow("id")
            val iCoords = c.getColumnIndexOrThrow("coords")
            val iDia = c.getColumnIndexOrThrow("diameter")
            val iLen = c.getColumnIndexOrThrow("length")
            while (c.moveToNext()) {
                out += PipeFeature(
                    id = c.getLong(iId),
                    layerId = layerId,
                    parts = decode(c.getBlob(iCoords)),
                    minLat = c.getDouble(c.getColumnIndexOrThrow("min_lat")),
                    minLon = c.getDouble(c.getColumnIndexOrThrow("min_lon")),
                    maxLat = c.getDouble(c.getColumnIndexOrThrow("max_lat")),
                    maxLon = c.getDouble(c.getColumnIndexOrThrow("max_lon")),
                    title = c.getString(c.getColumnIndexOrThrow("title")),
                    diameterMm = if (c.isNull(iDia)) null else c.getDouble(iDia),
                    lengthM = if (c.isNull(iLen)) null else c.getDouble(iLen),
                    material = c.getString(c.getColumnIndexOrThrow("material")),
                    dash = c.getInt(c.getColumnIndexOrThrow("dash")),
                    props = c.getString(c.getColumnIndexOrThrow("props")),
                )
            }
            out
        }

    /** Ghi lại thông tin lớp (giữ nguyên các đoạn ống). */
    fun upsertLayer(l: PipeLayer) {
        writableDatabase.insertWithOnConflict("pipe_layers", null, l.toValues(), SQLiteDatabase.CONFLICT_REPLACE)
    }

    /** Thay toàn bộ đoạn ống của một lớp (trong một giao dịch). */
    fun replaceLayer(l: PipeLayer, features: List<PipeFeature>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete("pipes", "layer_id = ?", arrayOf(l.id.toString()))
            val stmt = db.compileStatement(
                "INSERT INTO pipes (id, layer_id, min_lat, min_lon, max_lat, max_lon, coords, title, diameter, length, material, dash, props) " +
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
            )
            for (f in features) {
                stmt.clearBindings()
                stmt.bindLong(1, f.id)
                stmt.bindLong(2, l.id)
                stmt.bindDouble(3, f.minLat); stmt.bindDouble(4, f.minLon)
                stmt.bindDouble(5, f.maxLat); stmt.bindDouble(6, f.maxLon)
                stmt.bindBlob(7, encode(f.parts))
                if (f.title == null) stmt.bindNull(8) else stmt.bindString(8, f.title)
                if (f.diameterMm == null) stmt.bindNull(9) else stmt.bindDouble(9, f.diameterMm)
                if (f.lengthM == null) stmt.bindNull(10) else stmt.bindDouble(10, f.lengthM)
                if (f.material == null) stmt.bindNull(11) else stmt.bindString(11, f.material)
                stmt.bindLong(12, f.dash.toLong())
                stmt.bindString(13, f.props)
                stmt.executeInsert()
            }
            db.insertWithOnConflict("pipe_layers", null, l.toValues(), SQLiteDatabase.CONFLICT_REPLACE)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun deleteLayer(id: Long) {
        writableDatabase.delete("pipes", "layer_id = ?", arrayOf(id.toString()))
        writableDatabase.delete("pipe_layers", "id = ?", arrayOf(id.toString()))
    }

    fun setVisible(id: Long, visible: Boolean) {
        writableDatabase.update("pipe_layers", ContentValues().apply { put("visible", if (visible) 1 else 0) },
            "id = ?", arrayOf(id.toString()))
    }

    fun clear() {
        writableDatabase.delete("pipes", null, null)
        writableDatabase.delete("pipe_layers", null, null)
    }

    private fun PipeLayer.toValues() = ContentValues().apply {
        put("id", id); put("name", name); put("kind", kind); put("color", color); put("weight", weight)
        put("visible", if (visible) 1 else 0); put("sort", order); put("feature_count", featureCount)
        put("missing_diameter", missingDiameter); put("hash", hash); put("source_file", sourceFile); put("updated_at", updatedAt)
    }

    companion object {
        @Volatile
        private var instance: PipeDb? = null

        fun get(context: Context): PipeDb =
            instance ?: synchronized(this) { instance ?: PipeDb(context).also { instance = it } }

        fun encode(parts: Array<DoubleArray>): ByteArray {
            val size = 4 + parts.sumOf { 4 + it.size * 8 }
            val b = ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN)
            b.putInt(parts.size)
            for (p in parts) {
                b.putInt(p.size)
                for (v in p) b.putDouble(v)
            }
            return b.array()
        }

        fun decode(bytes: ByteArray): Array<DoubleArray> {
            val b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
            return Array(b.int) { DoubleArray(b.int) { b.double } }
        }
    }
}
