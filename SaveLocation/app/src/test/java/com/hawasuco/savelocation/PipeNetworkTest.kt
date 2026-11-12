package com.hawasuco.savelocation

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.network.PipeDash
import com.hawasuco.savelocation.network.PipeDb
import com.hawasuco.savelocation.network.PipeKind
import com.hawasuco.savelocation.network.PipeParser
import com.hawasuco.savelocation.network.PipeStore
import com.hawasuco.savelocation.network.PipeStyle
import com.hawasuco.savelocation.network.PipeSync
import com.hawasuco.savelocation.network.ScadaClient
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Đọc dữ liệu SCADA, lưu trên máy và đồng bộ với máy chủ giả lập [FakeScada]. */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class PipeNetworkTest {
    private val app = ApplicationProvider.getApplicationContext<App>()
    private var fake: FakeScada? = null

    @Before
    fun setUp() {
        Prefs.init(app)
        PipeDb.get(app).clear()
        PipeStore.clearMemory()
        Prefs.pipeLastSync = 0; Prefs.pipeLastCheck = 0; Prefs.pipeLastError = ""
    }

    @After
    fun tearDown() {
        fake?.close()
        Prefs.scadaCode = ""
        Prefs.scadaUrl = Prefs.DEFAULT_SCADA_URL
    }

    private fun connect(code: String = FakeScada.CODE): FakeScada {
        val f = FakeScada().also { fake = it }
        Prefs.scadaUrl = f.url
        Prefs.scadaCode = code
        return f
    }

    // ------------------------------------------------------------------ Đọc dữ liệu

    @Test
    fun parsesLayerMetaFromMapPage() {
        val html = """<script>
            const LAYER_META = [{"LayerId":27,"LayerName":"Tuyến ống","LayerKind":"pipe","Color":"#38bdf8","Weight":4,"Visible":true,"SourceFile":"a.qgz"},
              {"LayerId":35,"LayerName":"Dự kiến","LayerKind":"pipe_plan","Color":"bad","Weight":2.5,"Visible":false,"SourceFile":""}];
            const other = [1];
        </script>"""
        val metas = PipeParser.layerMeta(html)!!
        assertEquals(2, metas.size)
        assertEquals(27L, metas[0].id)
        assertEquals("Tuyến ống", metas[0].name)
        assertEquals(PipeKind.PIPE, metas[0].kind)
        assertEquals(0xFF38BDF8.toInt(), metas[0].color)
        assertEquals(4f, metas[0].weight)
        assertFalse(metas[1].visible)
        assertEquals(0xFF38BDF8.toInt(), metas[1].color) // màu sai → màu mặc định
        assertNull(PipeParser.layerMeta("<html><script>const hasError = true;</script></html>"))
    }

    @Test
    fun parsesPipeGeoJson() {
        val json = JSONObject().put("type", "FeatureCollection").put("features", JSONArray()
            .put(FakeScada.line("Ống HDPE D160", 160, "HDPE", 9.70 to 105.40, 9.72 to 105.43))
            .put(JSONObject().put("type", "Feature")
                .put("properties", JSONObject().put("Tên", "Ống PVC D.114 hẻm 3").put("trang_thai", "Dự kiến"))
                .put("geometry", JSONObject().put("type", "MultiLineString").put("coordinates", JSONArray()
                    .put(JSONArray().put(JSONArray().put(105.40).put(9.70)).put(JSONArray().put(105.41).put(9.71)))
                    .put(JSONArray().put(JSONArray().put(105.42).put(9.72)).put(JSONArray().put(105.43).put(9.73))))))
            .put(FakeScada.point(9.7, 105.4))
        ).toString()
        val fs = PipeParser.features(json, 27, PipeKind.PIPE)
        assertEquals(2, fs.size) // điểm bị bỏ qua
        val a = fs[0]
        assertEquals("Ống HDPE D160", a.title)
        assertEquals(160.0, a.diameterMm!!, 0.0)
        assertEquals("HDPE", a.material)
        assertEquals(PipeDash.SOLID, a.dash)
        assertEquals(9.70, a.minLat, 1e-9); assertEquals(9.72, a.maxLat, 1e-9)
        assertEquals(105.40, a.minLon, 1e-9); assertEquals(105.43, a.maxLon, 1e-9)
        assertArrayEquals(doubleArrayOf(9.70, 105.40, 9.72, 105.43), a.parts[0], 1e-12)
        val b = fs[1]
        assertEquals(2, b.parts.size)
        assertEquals(114.0, b.diameterMm!!, 0.0) // lấy từ tên "D.114"
        assertEquals(PipeDash.PLANNED, b.dash)
        assertTrue(b.lengthM!! > 2000) // tự tính độ dài khi máy chủ không ghi
        assertEquals(PipeDash.BUILD, PipeParser.features(json, 31, PipeKind.BUILD)[0].dash)
        assertEquals(PipeDash.PLANNED, PipeParser.features(json, 35, PipeKind.PLAN)[0].dash)
    }

    @Test
    fun plannedRulesMatchWeb() {
        fun p(vararg kv: Pair<String, String>) = JSONObject().apply { kv.forEach { put(it.first, it.second) } }
        assertTrue(PipeParser.isPlanned(p("trang_thai" to "Dự kiến")))
        assertTrue(PipeParser.isPlanned(p("ten" to "Tuyến dự kiến D110")))
        assertFalse(PipeParser.isPlanned(p("ten" to "Ống dk 90"))) // "dk" là đường kính
        assertFalse(PipeParser.isPlanned(p("Tình trạng" to "Hiện hữu", "ten" to "dự kiến")))
        assertEquals(PipeDash.SOLID, PipeParser.dashFor(PipeKind.PLAN, p("tinh_trang" to "Đã xây")))
    }

    @Test
    fun fieldNamesAndNumbers() {
        assertEquals("tendoi", PipeParser.fieldKey("Tên đội"))
        assertEquals("tendoi", PipeParser.fieldKey("ten_doi"))
        assertEquals(90.0, PipeParser.diameterFrom(JSONObject().put("Đường kính", "Ø90"))!!, 0.0)
        assertEquals(63.0, PipeParser.diameterFrom(JSONObject().put("name", "PVC DN63"))!!, 0.0)
        assertNull(PipeParser.diameterFrom(JSONObject().put("name", "Ống nhánh")))
        assertEquals("445", PipeParser.formatNumber(445.04))
        assertEquals("23,15", PipeParser.formatNumber(23.15))
        assertEquals("12", PipeParser.formatNumber(12.0))
        assertEquals("7,5", PipeParser.formatNumber(7.5))
        assertEquals("Kdc Liên Minh", PipeParser.describe(JSONObject().put("description", "mô tả: Kdc Liên Minh<br>Năm XD: ")))
    }

    @Test
    fun sizeClassesMatchWebLegend() {
        assertEquals(PipeStyle.SIZE_UNKNOWN, PipeStyle.sizeClass(null))
        assertEquals("Đến D50", PipeStyle.sizeClass(50.0).label)
        assertEquals("D51 – D90", PipeStyle.sizeClass(63.0).label)
        assertEquals("D91 – D125", PipeStyle.sizeClass(114.0).label)
        assertEquals("D126 – D200", PipeStyle.sizeClass(200.0).label)
        assertEquals("D201 – D315", PipeStyle.sizeClass(250.0).label)
        assertEquals("Trên D315", PipeStyle.sizeClass(400.0).label)
    }

    @Test
    fun coordinatesRoundTrip() {
        val parts = arrayOf(doubleArrayOf(9.1, 105.2, 9.3, 105.4), doubleArrayOf(1.0, 2.0, 3.0, 4.0, 5.0, 6.0))
        val back = PipeDb.decode(PipeDb.encode(parts))
        assertEquals(2, back.size)
        assertArrayEquals(parts[0], back[0], 0.0)
        assertArrayEquals(parts[1], back[1], 0.0)
    }

    @Test
    fun offlineInfoUsesStoredFields() {
        val json = JSONObject().put("features", JSONArray().put(FakeScada.line("Ống PVC D90", 90, "PVC", 9.7 to 105.4, 9.71 to 105.41))).toString()
        val f = PipeParser.features(json, 27, PipeKind.PIPE)[0]
        val info = PipeParser.offlineInfo(f, "Tuyến ống")
        assertEquals("Ống PVC D90", info.title)
        assertFalse(info.fromServer)
        val rows = info.rows.toMap()
        assertEquals("PVC", rows["Vật liệu"])
        assertEquals("90 mm", rows["Đường kính"])
        assertEquals("Khu dân cư mẫu", rows["Mô tả"])
        assertEquals("2019", rows["Năm xây dựng"])
    }

    // ------------------------------------------------------------------ Đồng bộ với máy chủ giả lập

    @Test
    fun wrongCodeIsRejected() = runBlocking {
        val f = connect("SAI-MA")
        assertEquals(PipeSync.ERR_WRONG_CODE, PipeSync.testCode(f.url, "SAI-MA"))
        assertNull(PipeSync.testCode(f.url, FakeScada.CODE))
        assertNull(PipeSync.testCode(f.url, "testcode ")) // không phân biệt hoa thường, bỏ khoảng trắng (giống web)
        val r = PipeSync.sync(app)
        assertFalse(r.ok)
        assertEquals(PipeSync.ERR_WRONG_CODE, r.error)
        assertEquals(PipeSync.ERR_WRONG_CODE, Prefs.pipeLastError)
        assertEquals(0, PipeStore.totalPipes())
    }

    @Test
    fun noCodeMeansNoSync() = runBlocking {
        Prefs.scadaCode = ""
        val r = PipeSync.sync(app)
        assertEquals(PipeSync.ERR_NO_CODE, r.error)
    }

    @Test
    fun syncKeepsOnlyPipeLayersAndFollowsServerChanges() = runBlocking {
        val f = connect()
        // Lần đầu: tải 3 lớp ống, bỏ lớp "Trạm bơm".
        var r = PipeSync.sync(app)
        assertTrue(r.error, r.ok)
        assertEquals(3, r.changedLayers)
        assertEquals(12, r.totalPipes)
        val layers = PipeStore.snapshot().map { it.layer }
        assertEquals(listOf(27L, 31L, 35L), layers.map { it.id })
        assertEquals(listOf(PipeKind.PIPE, PipeKind.BUILD, PipeKind.PLAN), layers.map { it.kind })
        assertEquals(1, layers[0].missingDiameter)
        assertEquals(12, PipeStore.totalPipes())
        assertTrue(Prefs.pipeLastSync > 0)
        assertEquals("", Prefs.pipeLastError)

        // Không đổi gì → không ghi lại lớp nào.
        r = PipeSync.sync(app)
        assertTrue(r.ok)
        assertEquals(0, r.changedLayers)

        // Người dùng tắt một lớp → đồng bộ lại vẫn giữ lựa chọn.
        PipeStore.setVisible(app, 31, false)
        Thread.sleep(200)
        assertFalse(PipeDb.get(app).layers().first { it.id == 31L }.visible)

        // Web cập nhật lớp 27 (nhập lại từ QGIS) và xoá lớp 35 → ứng dụng cập nhật theo.
        f.layers.first { it.id == 27L }.features.put(FakeScada.line("Ống PVC D75 mới", 75, "PVC", 9.80 to 105.45, 9.81 to 105.46))
        f.layers.removeAll { it.id == 35L }
        r = PipeSync.sync(app)
        assertTrue(r.ok)
        assertEquals(2, r.changedLayers)
        val after = PipeStore.snapshot()
        assertEquals(listOf(27L, 31L), after.map { it.layer.id })
        assertEquals(10, after[0].features.size)
        assertTrue(after[0].features.any { it.title == "Ống PVC D75 mới" })
        assertFalse(after.first { it.layer.id == 31L }.layer.visible)
        assertEquals(10, PipeStore.visibleLayers().sumOf { it.features.size })
    }

    @Test
    fun sessionExpiryLogsInAgain() = runBlocking {
        val f = connect()
        assertTrue(PipeSync.sync(app).ok)
        val before = f.logins
        f.expireSessions()
        val feature = PipeStore.snapshot()[0].features[0]
        val info = PipeSync.info(feature, "Tuyến ống")
        assertTrue(info.fromServer)
        assertEquals("Ống gang D400 trục chính", info.title)
        assertEquals("Gang", info.rows.toMap()["Vật liệu"])
        assertEquals("Đội mẫu số 1", info.rows.toMap()["Đội quản lý"])
        assertTrue(f.logins > before)
    }

    @Test
    fun offlineKeepsCachedNetwork() = runBlocking {
        val f = connect()
        assertTrue(PipeSync.sync(app).ok)
        f.close()
        val r = PipeSync.sync(app)
        assertFalse(r.ok)
        assertEquals(PipeSync.ERR_NETWORK, r.error)
        // Dữ liệu đã lưu vẫn còn, thẻ thông tin dùng bản lưu.
        PipeStore.clearMemory()
        PipeStore.reload(app)
        assertEquals(12, PipeStore.totalPipes())
        val feature = PipeStore.snapshot()[0].features[1]
        val info = PipeSync.info(feature, "Tuyến ống")
        assertFalse(info.fromServer)
        assertEquals("HDPE", info.rows.toMap()["Vật liệu"])
        assertTrue(PipeSync.errorText(app, r.error).isNotBlank())
    }

    @Test
    fun serverErrorIsReported() = runBlocking {
        val e = ScadaClient.ServerException(503)
        assertEquals("server:503", PipeSync.errorKey(e))
        assertTrue(PipeSync.errorText(app, "server:503").contains("503"))
    }

    /**
     * Kiểm tra với máy chủ SCADA thật — chỉ chạy khi truyền mã qua biến môi trường SCADA_CODE
     * (mã không được ghi vào mã nguồn). Ví dụ: SCADA_CODE=... ./gradlew testDebugUnitTest --tests '*liveScada*'
     */
    @Test
    fun liveScada() = runBlocking {
        val code = System.getenv("SCADA_CODE").orEmpty()
        assumeTrue(code.isNotBlank())
        Prefs.scadaUrl = System.getenv("SCADA_URL") ?: Prefs.DEFAULT_SCADA_URL
        Prefs.scadaCode = code
        val r = PipeSync.sync(app)
        assertTrue(r.error, r.ok)
        assertTrue(PipeStore.snapshot().isNotEmpty())
        assertTrue(PipeStore.snapshot().all { it.layer.kind in PipeKind.ALL })
        val f = PipeStore.snapshot().first { it.features.isNotEmpty() }.features.first()
        assertNotNull(PipeSync.info(f, "x").title)
        println("SCADA: ${PipeStore.snapshot().size} lớp, ${PipeStore.totalPipes()} đoạn ống")
        PipeStore.snapshot().forEach { println(" - ${it.layer.id} ${it.layer.kind} ${it.layer.name}: ${it.features.size}") }
    }
}
