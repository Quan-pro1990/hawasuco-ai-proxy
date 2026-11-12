package com.hawasuco.savelocation

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URI
import java.net.URLDecoder
import java.util.UUID
import kotlin.concurrent.thread

/**
 * Máy chủ giả lập trang PublishWeb/NetworkMap của SCADA để kiểm thử (dữ liệu tự tạo, không phải mạng lưới thật):
 * trang nhập mã có khoá chống giả mạo, cookie phiên, 403 khi hết phiên, LAYER_META trong HTML,
 * GeoJSON từng lớp (kèm khối "scada") và FeatureInfo.
 */
class FakeScada(private val code: String = CODE) : AutoCloseable {
    class Layer(val id: Long, var name: String, val kind: String, val color: String, val weight: Double, var features: JSONArray)

    /** Một yêu cầu HTTP tối giản (đủ cho HttpURLConnection). */
    private class HttpExchange(val requestMethod: String, val requestURI: URI, val headers: Map<String, List<String>>, val body: ByteArray) {
        var status = 200
        val responseHeaders = ArrayList<Pair<String, String>>()
        var response = ByteArray(0)
        fun cookieHeader(): List<String> = headers["cookie"] ?: emptyList()
    }

    private val server = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
    private val sessions = HashSet<String>()
    val layers = ArrayList<Layer>()
    var logins = 0
        private set
    var featureRequests = 0
        private set

    val url: String get() = "http://127.0.0.1:${server.localPort}"

    init {
        layers += Layer(27, "Tuyến ống cấp nước", "pipe", "#38bdf8", 4.0, mainNetwork())
        layers += Layer(31, "Ống đang thi công 2026", "pipe_build", "#fb923c", 3.0, buildNetwork())
        layers += Layer(35, "Ống dự kiến mở rộng", "pipe_plan", "#a3e635", 3.0, planNetwork())
        // Lớp không phải đường ống (điểm trạm) — ứng dụng phải bỏ qua.
        layers += Layer(40, "Trạm bơm", "station", "#e11d48", 2.0, JSONArray().put(point(9.7801, 105.4702)))
        thread(isDaemon = true, name = "fake-scada") {
            while (!server.isClosed) {
                val sock = runCatching { server.accept() }.getOrNull() ?: break
                thread(isDaemon = true) { serve(sock) }
            }
        }
    }

    override fun close() = server.close()

    private fun serve(sock: Socket) = sock.use {
        val input = BufferedInputStream(sock.getInputStream())
        val requestLine = readLine(input) ?: return
        val (method, target) = requestLine.split(" ").let { it[0] to it[1] }
        val headers = LinkedHashMap<String, MutableList<String>>()
        while (true) {
            val line = readLine(input) ?: break
            if (line.isEmpty()) break
            headers.getOrPut(line.substringBefore(':').trim().lowercase()) { ArrayList() } += line.substringAfter(':').trim()
        }
        val len = headers["content-length"]?.firstOrNull()?.toIntOrNull() ?: 0
        val body = ByteArray(len)
        var read = 0
        while (read < len) { val n = input.read(body, read, len - read); if (n < 0) break; read += n }
        val ex = HttpExchange(method, URI(target), headers, body)
        synchronized(this) { runCatching { handle(ex) }.onFailure { ex.send(500, "text/plain", it.toString()) } }
        val head = StringBuilder("HTTP/1.1 ${ex.status} X\r\n")
        ex.responseHeaders.forEach { (k, v) -> head.append(k).append(": ").append(v).append("\r\n") }
        head.append("Content-Length: ${ex.response.size}\r\nConnection: close\r\n\r\n")
        val out = sock.getOutputStream()
        out.write(head.toString().toByteArray())
        out.write(ex.response)
        out.flush()
    }

    private fun readLine(input: InputStream): String? {
        val buf = ByteArrayOutputStream()
        while (true) {
            val c = input.read()
            if (c < 0) return if (buf.size() == 0) null else buf.toString("UTF-8")
            if (c == '\n'.code) return buf.toString("UTF-8").trimEnd('\r')
            buf.write(c)
        }
    }

    fun expireSessions() = sessions.clear()

    private fun HttpExchange.send(status: Int, type: String, body: String, extra: Map<String, String> = emptyMap()) {
        this.status = status
        responseHeaders += "Content-Type" to "$type; charset=utf-8"
        extra.forEach { (k, v) -> responseHeaders += k to v }
        response = body.toByteArray()
    }

    private fun HttpExchange.cookie(name: String): String? =
        cookieHeader().flatMap { it.split(";") }.map { it.trim() }
            .firstOrNull { it.startsWith("$name=") }?.substringAfter('=')

    private fun handle(ex: HttpExchange) {
        val path = ex.requestURI.path
        val query = ex.requestURI.rawQuery.orEmpty().split("&").filter { it.contains('=') }
            .associate { it.substringBefore('=') to URLDecoder.decode(it.substringAfter('='), "UTF-8") }
        val authed = ex.cookie(".AspNetCore.Session") in sessions
        when {
            path == MAP && ex.requestMethod == "GET" ->
                if (authed) ex.send(200, "text/html", mapPage())
                else ex.send(200, "text/html", accessPage(false), mapOf("Set-Cookie" to ".AspNetCore.Antiforgery.x=af1; path=/; samesite=strict; httponly"))
            path == "$MAP/Access" && ex.requestMethod == "POST" -> {
                val form = ex.body.toString(Charsets.UTF_8).split("&")
                    .associate { URLDecoder.decode(it.substringBefore('='), "UTF-8") to URLDecoder.decode(it.substringAfter('='), "UTF-8") }
                if (ex.cookie(".AspNetCore.Antiforgery.x") != "af1" || form["__RequestVerificationToken"] != TOKEN) {
                    ex.send(400, "text/plain", "Bad Request"); return
                }
                if (form["code"]?.trim()?.uppercase() == code) {
                    val sid = UUID.randomUUID().toString()
                    sessions += sid
                    logins++
                    ex.send(302, "text/html", "", mapOf("Location" to MAP, "Set-Cookie" to ".AspNetCore.Session=$sid; path=/; samesite=lax; httponly"))
                } else {
                    ex.send(200, "text/html", accessPage(true))
                }
            }
            path == "$MAP/Features" -> {
                if (!authed) { ex.send(403, "text/plain", ""); return }
                featureRequests++
                val l = layers.firstOrNull { it.id == query["layerId"]?.toLong() } ?: run { ex.send(404, "text/plain", ""); return }
                ex.send(200, "application/json", JSONObject().put("type", "FeatureCollection").put("features", l.features).toString())
            }
            path == "$MAP/FeatureInfo" -> {
                if (!authed) { ex.send(403, "text/plain", ""); return }
                val id = query["id"]?.toLong()
                val f = layers.flatMap { l -> (0 until l.features.length()).map { l.features.getJSONObject(it) } }
                    .firstOrNull { it.optJSONObject("scada")?.optLong("featureId") == id } ?: run { ex.send(404, "text/plain", ""); return }
                val s = f.getJSONObject("scada")
                val p = f.getJSONObject("properties")
                val rows = JSONArray()
                    .put(JSONObject().put("label", "Vật liệu").put("value", s.optString("material")))
                    .put(JSONObject().put("label", "Đường kính").put("value", s.optInt("diameterMm").toString() + " mm"))
                    .put(JSONObject().put("label", "Chiều dài").put("value", s.optInt("lengthM").toString() + " m"))
                    .put(JSONObject().put("label", "Năm xây dựng").put("value", p.optString("nam_xd")))
                    .put(JSONObject().put("label", "Đội quản lý").put("value", "Đội mẫu số 1"))
                ex.send(200, "application/json", JSONObject().put("title", p.optString("ten")).put("planned", false).put("rows", rows).toString())
            }
            else -> ex.send(404, "text/plain", "")
        }
    }

    private fun accessPage(error: Boolean) = """
        <!DOCTYPE html><html><head><title>Bản đồ mạng lưới</title></head><body>
        <form method="post" action="$MAP/Access">
          <input name="code" type="password" placeholder="Mã truy cập" />
          <input name="__RequestVerificationToken" type="hidden" value="$TOKEN" />
          <button type="submit">Xem bản đồ</button>
        </form>
        <script>const hasError = ${if (error) "true" else "false"};</script>
        </body></html>
    """.trimIndent()

    private fun mapPage(): String {
        val meta = JSONArray()
        layers.forEach { l ->
            meta.put(JSONObject().put("LayerId", l.id).put("LayerName", l.name).put("LayerKind", l.kind)
                .put("Color", l.color).put("Weight", l.weight).put("Visible", true).put("SourceFile", "${l.name}.qgz"))
        }
        return """
            <!DOCTYPE html><html><head><title>Bản đồ mạng lưới</title></head><body><div id="map"></div>
            <script>
              const LAYER_META = $meta;
              const map = L.map('map').setView([9.78, 105.47], 12);
            </script></body></html>
        """.trimIndent()
    }

    companion object {
        const val MAP = "/PublishWeb/NetworkMap"
        const val CODE = "TESTCODE"
        const val TOKEN = "CfDJ8-fake-token"
        private var nextId = 1000L

        fun line(name: String, diameter: Int?, material: String, vararg pts: Pair<Double, Double>, extra: Map<String, String> = emptyMap()): JSONObject {
            val coords = JSONArray()
            pts.forEach { (lat, lon) -> coords.put(JSONArray().put(lon).put(lat)) }
            val props = JSONObject().put("ten", name).put("vat_lieu", material).put("nam_xd", "2019")
                .put("description", "mô tả: Khu dân cư mẫu<br>Năm XD: 2019")
            extra.forEach { (k, v) -> props.put(k, v) }
            val scada = JSONObject().put("featureId", nextId++).put("material", material).put("lengthM", 250 + pts.size * 37)
            if (diameter != null) scada.put("diameterMm", diameter)
            return JSONObject().put("type", "Feature").put("properties", props).put("scada", scada)
                .put("geometry", JSONObject().put("type", "LineString").put("coordinates", coords))
        }

        fun point(lat: Double, lon: Double): JSONObject = JSONObject().put("type", "Feature")
            .put("properties", JSONObject().put("ten_tram", "Trạm mẫu"))
            .put("geometry", JSONObject().put("type", "Point").put("coordinates", JSONArray().put(lon).put(lat)))

        /** Mạng lưới tự tạo quanh toạ độ mặc định của bản đồ web: một trục chính và các nhánh nhiều cỡ ống. */
        fun mainNetwork(): JSONArray {
            val a = JSONArray()
            a.put(line("Ống gang D400 trục chính", 400, "Gang", 9.765 to 105.440, 9.772 to 105.455, 9.778 to 105.470, 9.785 to 105.488, 9.792 to 105.502))
            a.put(line("Ống HDPE D250", 250, "HDPE", 9.778 to 105.470, 9.795 to 105.468, 9.812 to 105.466))
            a.put(line("Ống HDPE D160", 160, "HDPE", 9.772 to 105.455, 9.758 to 105.452, 9.745 to 105.449))
            a.put(line("Ống PVC D114", 114, "PVC", 9.785 to 105.488, 9.800 to 105.492, 9.808 to 105.497))
            a.put(line("Ống PVC D90", 90, "PVC", 9.795 to 105.468, 9.797 to 105.452, 9.799 to 105.440))
            a.put(line("Ống PVC D63", 63, "PVC", 9.758 to 105.452, 9.757 to 105.468, 9.756 to 105.480))
            a.put(line("Ống PVC D49", 49, "PVC", 9.800 to 105.492, 9.792 to 105.478))
            a.put(line("Ống chưa rõ cỡ", null, "PVC", 9.745 to 105.449, 9.740 to 105.462, 9.742 to 105.475))
            // Đoạn dự kiến nằm trong lớp hiện hữu (theo trường tình trạng) → nét đứt.
            a.put(line("Ống PVC D110 nối dài", 110, "PVC", 9.812 to 105.466, 9.822 to 105.470, extra = mapOf("tinh_trang" to "Dự kiến")))
            return a
        }

        fun buildNetwork(): JSONArray = JSONArray()
            .put(line("Ống HDPE D200 đang thi công", 200, "HDPE", 9.792 to 105.502, 9.800 to 105.515, 9.806 to 105.528))

        fun planNetwork(): JSONArray = JSONArray()
            .put(line("Tuyến dự kiến D160", 160, "HDPE", 9.765 to 105.440, 9.752 to 105.430, 9.740 to 105.422))
            .put(line("Tuyến dự kiến D90", 90, "PVC", 9.808 to 105.497, 9.818 to 105.505))
    }
}
