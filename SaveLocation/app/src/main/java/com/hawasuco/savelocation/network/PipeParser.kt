package com.hawasuco.savelocation.network

import android.graphics.Color
import android.location.Location
import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale

/**
 * Đọc dữ liệu của bản đồ mạng lưới SCADA: danh sách lớp (LAYER_META trong trang) và
 * GeoJSON đường ống của từng lớp (kèm khối "scada": featureId, diameterMm, lengthM, material).
 * Quy tắc nhận tên, tuyến dự kiến... làm giống trang web.
 */
object PipeParser {

    data class LayerMeta(val id: Long, val name: String, val kind: String, val color: Int, val weight: Float, val visible: Boolean, val sourceFile: String)

    private val LAYER_META_RE = Regex("""const\s+LAYER_META\s*=\s*(\[.*?\]);""", RegexOption.DOT_MATCHES_ALL)

    /** Lấy danh sách lớp từ HTML trang bản đồ; null nếu trang chưa mở được (sai mã / hết phiên). */
    fun layerMeta(html: String): List<LayerMeta>? {
        val json = LAYER_META_RE.find(html)?.groupValues?.get(1) ?: return null
        val arr = JSONArray(json)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            LayerMeta(
                id = o.getLong("LayerId"),
                name = o.optString("LayerName"),
                kind = o.optString("LayerKind"),
                color = parseColor(o.optString("Color"), Color.parseColor("#38bdf8")),
                weight = o.optDouble("Weight", 3.0).toFloat(),
                visible = o.optBoolean("Visible", true),
                sourceFile = o.optString("SourceFile"),
            )
        }
    }

    fun parseColor(s: String?, def: Int): Int = try {
        if (s.isNullOrBlank()) def else Color.parseColor(s.trim())
    } catch (_: Exception) {
        def
    }

    /** GeoJSON đường ống của một lớp → các đoạn ống (chỉ LineString / MultiLineString). */
    fun features(json: String, layerId: Long, kind: String): List<PipeFeature> {
        val root = JSONObject(json)
        val arr = root.optJSONArray("features") ?: return emptyList()
        val out = ArrayList<PipeFeature>(arr.length())
        for (i in 0 until arr.length()) {
            val f = arr.optJSONObject(i) ?: continue
            val geom = f.optJSONObject("geometry") ?: continue
            val parts = lineParts(geom)
            if (parts.isEmpty()) continue
            val props = f.optJSONObject("properties") ?: JSONObject()
            val scada = f.optJSONObject("scada") ?: JSONObject()
            var minLat = 90.0; var maxLat = -90.0; var minLon = 180.0; var maxLon = -180.0
            for (p in parts) {
                var k = 0
                while (k < p.size) {
                    val la = p[k]; val lo = p[k + 1]
                    if (la < minLat) minLat = la; if (la > maxLat) maxLat = la
                    if (lo < minLon) minLon = lo; if (lo > maxLon) maxLon = lo
                    k += 2
                }
            }
            val id = when {
                scada.has("featureId") -> scada.optLong("featureId")
                f.has("id") -> f.optLong("id", i.toLong())
                else -> i.toLong()
            }
            val diameter = scada.optDouble("diameterMm", Double.NaN).takeIf { !it.isNaN() && it > 0 }
                ?: diameterFrom(props)
            val length = scada.optDouble("lengthM", Double.NaN).takeIf { !it.isNaN() && it > 0 } ?: lengthOf(parts)
            val material = scada.optString("material").takeIf { it.isNotBlank() && it != "null" }
                ?: pickField(props, listOf("vat_lieu", "material")).ifBlank { null }
            out += PipeFeature(
                id = id, layerId = layerId, parts = parts,
                minLat = minLat, minLon = minLon, maxLat = maxLat, maxLon = maxLon,
                title = featureName(props).ifBlank { null },
                diameterMm = diameter, lengthM = length, material = material,
                dash = dashFor(kind, props),
                props = props.toString(),
            )
        }
        return out
    }

    /** Toạ độ GeoJSON [kinh độ, vĩ độ, (cao độ)] → mảng (vĩ độ, kinh độ) xen kẽ. */
    private fun lineParts(geom: JSONObject): Array<DoubleArray> {
        val coords = geom.optJSONArray("coordinates")
        return when (geom.optString("type")) {
            "LineString" -> if (coords != null) arrayOf(line(coords)).filter { it.size >= 4 }.toTypedArray() else emptyArray()
            "MultiLineString" -> if (coords != null) (0 until coords.length()).mapNotNull { coords.optJSONArray(it)?.let(::line) }
                .filter { it.size >= 4 }.toTypedArray() else emptyArray()
            "GeometryCollection" -> {
                val g = geom.optJSONArray("geometries") ?: return emptyArray()
                (0 until g.length()).flatMap { k -> g.optJSONObject(k)?.let { lineParts(it).toList() } ?: emptyList() }.toTypedArray()
            }
            else -> emptyArray()
        }
    }

    private fun line(a: JSONArray): DoubleArray {
        val out = DoubleArray(a.length() * 2)
        var n = 0
        for (i in 0 until a.length()) {
            val p = a.optJSONArray(i) ?: continue
            val lon = p.optDouble(0, Double.NaN)
            val lat = p.optDouble(1, Double.NaN)
            if (lat.isNaN() || lon.isNaN()) continue
            out[n++] = lat; out[n++] = lon
        }
        return if (n == out.size) out else out.copyOf(n)
    }

    fun lengthOf(parts: Array<DoubleArray>): Double {
        var total = 0.0
        val r = FloatArray(1)
        for (p in parts) {
            var k = 2
            while (k < p.size) {
                Location.distanceBetween(p[k - 2], p[k - 1], p[k], p[k + 1], r)
                total += r[0]
                k += 2
            }
        }
        return total
    }

    // ------------------------------------------------------------------ Tên trường (giống web)

    /** So tên trường bỏ dấu, bỏ gạch dưới và khoảng trắng: "Tên đội", "ten_doi", "TenDoi" là một. */
    fun fieldKey(value: String?): String {
        val s = Normalizer.normalize(value ?: "", Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "").replace('đ', 'd').replace('Đ', 'd')
            .lowercase(Locale.ROOT)
        return s.filter { it.isLetterOrDigit() }
    }

    fun plainName(value: String?): String =
        Normalizer.normalize(value ?: "", Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
            .replace('đ', 'd').replace('Đ', 'D').lowercase(Locale.ROOT).replace(Regex("\\s+"), " ").trim()

    /** Giá trị của trường đầu tiên có mặt trong danh sách, theo thứ tự ưu tiên. */
    fun pickField(props: JSONObject, names: List<String>): String {
        val keys = props.keys().asSequence().toList()
        for (name in names) {
            val wanted = fieldKey(name)
            val hit = keys.firstOrNull { fieldKey(it) == wanted } ?: continue
            if (props.isNull(hit)) continue
            val v = props.opt(hit)?.toString()?.trim().orEmpty()
            if (v.isNotEmpty()) return v
        }
        return ""
    }

    fun featureName(props: JSONObject): String = pickField(props, listOf("ten_tram", "ten_van", "ten", "name", "tram", "label"))

    /**
     * Tuyến dự kiến: trường trang_thai / tinh_trang là căn cứ chắc nhất; không có thì tên phải ghi đủ
     * chữ "dự kiến" ("dk" trong tên thường là "đường kính" nên không tính).
     */
    fun isPlanned(props: JSONObject): Boolean {
        val status = fieldKey(pickField(props, listOf("trang_thai", "tinh_trang", "status")))
        if (status.isNotEmpty()) return status == "dukien"
        val name = plainName(pickField(props, listOf("ten", "name"))).replace(Regex("[^a-z0-9]+"), " ")
        return Regex("\\b(du kien|dukien)\\b").containsMatchIn(name)
    }

    /** Nét vẽ: đoạn dự kiến nét đứt ở mọi lớp; lớp dự kiến mà đoạn chưa ghi tình trạng cũng đứt; lớp đang triển khai gạch chấm. */
    fun dashFor(kind: String, props: JSONObject): Int = when {
        isPlanned(props) -> PipeDash.PLANNED
        kind == PipeKind.PLAN && pickField(props, listOf("trang_thai", "tinh_trang", "status")).isEmpty() -> PipeDash.PLANNED
        kind == PipeKind.BUILD -> PipeDash.BUILD
        else -> PipeDash.SOLID
    }

    private val DIAMETER_RE = Regex("""(?:\bD|DN|OD|Ø|ø|Φ)\s*\.?\s*(\d{2,4})""", RegexOption.IGNORE_CASE)

    /** Đường kính (mm) khi máy chủ chưa tính sẵn: trường "Đường kính" hoặc tên kiểu "Ống PVC D.114". */
    fun diameterFrom(props: JSONObject): Double? {
        pickField(props, listOf("duong_kinh", "dk", "dn", "diameter", "d")).let { v ->
            Regex("""\d+(?:[.,]\d+)?""").find(v)?.value?.replace(',', '.')?.toDoubleOrNull()?.let { if (it > 0) return it }
        }
        val name = pickField(props, listOf("ten", "name"))
        return DIAMETER_RE.find(name)?.groupValues?.get(1)?.toDoubleOrNull()?.takeIf { it in 10.0..3000.0 }
    }

    // ------------------------------------------------------------------ Thông tin khi mất mạng

    private val INFO_FIELDS = listOf(
        listOf("chieu_dai") to "Chiều dài theo hồ sơ",
        listOf("nam_xd", "nam_xay_dung") to "Năm xây dựng",
        listOf("xa_phuong", "xa", "phuong") to "Xã/Phường",
        listOf("ghi_chu") to "Ghi chú",
        listOf("doi", "doi_quan_ly", "ten_doi") to "Đội quản lý",
        listOf("tinh_trang", "trang_thai") to "Tình trạng",
    )

    /** Dựng thẻ thông tin từ dữ liệu đã lưu (khi không gọi được máy chủ). */
    fun offlineInfo(f: PipeFeature, layerName: String): PipeInfo {
        val props = runCatching { JSONObject(f.props) }.getOrDefault(JSONObject())
        val rows = ArrayList<Pair<String, String>>()
        f.material?.let { rows += "Vật liệu" to it }
        f.diameterMm?.let { rows += "Đường kính" to "${formatNumber(it)} mm" }
        f.lengthM?.let { rows += "Chiều dài" to "${formatNumber(it)} m" }
        describe(props)?.let { rows += "Mô tả" to it }
        for ((names, label) in INFO_FIELDS) {
            val v = pickField(props, names)
            if (v.isNotEmpty() && rows.none { it.first == label }) rows += label to v
        }
        return PipeInfo(f.title ?: layerName, f.dash == PipeDash.PLANNED, rows, fromServer = false)
    }

    /** "mô tả: Kdc Liên Minh<br>Năm XD: " → "Kdc Liên Minh". */
    fun describe(props: JSONObject): String? {
        val direct = pickField(props, listOf("mo_ta"))
        if (direct.isNotEmpty()) return direct
        val d = pickField(props, listOf("description"))
        if (d.isEmpty()) return null
        val lines = d.split(Regex("(?i)<br\\s*/?>|\\n")).map { it.replace(Regex("<[^>]+>"), "").trim() }.filter { it.isNotEmpty() }
        for (l in lines) {
            val idx = l.indexOf(':')
            if (idx > 0 && fieldKey(l.substring(0, idx)) == "mota") return l.substring(idx + 1).trim().ifEmpty { null }
        }
        return lines.firstOrNull { !it.contains(':') }
    }

    /** 445.04 → "445"; 23.15 → "23,15" (giống cách web ghi số). */
    fun formatNumber(v: Double): String {
        if (v >= 100 || v == Math.floor(v)) return String.format(Locale.US, "%.0f", v)
        return String.format(Locale.US, "%.2f", v).trimEnd('0').trimEnd('.').replace('.', ',')
    }

    /** Thẻ thông tin trả về từ máy chủ: {"title","planned","rows":[{"label","value"}]} */
    fun serverInfo(json: String): PipeInfo {
        val o = JSONObject(json)
        val rows = o.optJSONArray("rows") ?: JSONArray()
        return PipeInfo(
            title = o.optString("title"),
            planned = o.optBoolean("planned"),
            rows = (0 until rows.length()).mapNotNull { rows.optJSONObject(it) }
                .map { it.optString("label") to it.optString("value") }
                .filter { it.second.isNotBlank() },
            fromServer = true,
        )
    }
}
