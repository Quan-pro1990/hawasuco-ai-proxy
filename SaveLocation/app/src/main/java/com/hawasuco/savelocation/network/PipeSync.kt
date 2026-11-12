package com.hawasuco.savelocation.network

import android.content.Context
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.net.UnknownHostException
import java.security.MessageDigest

/** Đường ống đã tải, giữ trong bộ nhớ để vẽ nhanh. [version] tăng mỗi khi dữ liệu / lớp hiện đổi. */
object PipeStore {
    @Volatile
    private var loaded: List<LoadedLayer>? = null
    val version = MutableStateFlow(0L)

    fun snapshot(): List<LoadedLayer> = loaded ?: emptyList()

    fun isLoaded() = loaded != null

    fun visibleLayers(): List<LoadedLayer> = snapshot().filter { it.layer.visible && it.features.isNotEmpty() }

    fun totalPipes(): Int = snapshot().sumOf { it.features.size }

    suspend fun ensureLoaded(context: Context) {
        if (loaded == null) reload(context)
    }

    suspend fun reload(context: Context) {
        val ctx = context.applicationContext
        loaded = withContext(Dispatchers.IO) {
            val db = PipeDb.get(ctx)
            db.layers().map { LoadedLayer(it, db.features(it.id)) }
        }
        version.value = version.value + 1
    }

    fun setVisible(context: Context, layerId: Long, visible: Boolean) {
        snapshot().firstOrNull { it.layer.id == layerId }?.layer?.visible = visible
        version.value = version.value + 1
        val ctx = context.applicationContext
        PipeSync.scope.launch { PipeDb.get(ctx).setVisible(layerId, visible) }
    }

    fun notifyStyleChanged() {
        version.value = version.value + 1
    }

    fun clearMemory() {
        loaded = emptyList()
        version.value = version.value + 1
    }
}

/**
 * Đồng bộ đường ống từ bản đồ mạng lưới SCADA: mỗi lần lấy danh sách lớp mới nhất và GeoJSON từng lớp ống;
 * lớp nào có nội dung khác lần trước thì ghi đè, lớp bị xoá trên web thì xoá theo. Nhờ vậy khi
 * SCADA cập nhật (nhập lại từ QGIS) thì ứng dụng cũng cập nhật.
 */
object PipeSync {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val running = MutableStateFlow(false)
    private val mutex = Mutex()
    private var client: ScadaClient? = null
    private var clientKey = ""
    private val infoCache = HashMap<Long, PipeInfo>()

    data class Result(val ok: Boolean, val changedLayers: Int, val totalPipes: Int, val error: String = "")

    const val ERR_NO_CODE = "no_code"
    const val ERR_WRONG_CODE = "wrong_code"
    const val ERR_NETWORK = "network"

    fun hasCode() = Prefs.scadaCode.isNotBlank()

    @Synchronized
    private fun client(): ScadaClient {
        val key = Prefs.scadaUrl + "|" + Prefs.scadaCode
        if (client == null || key != clientKey) {
            client = ScadaClient(Prefs.scadaUrl, Prefs.scadaCode)
            clientKey = key
            synchronized(infoCache) { infoCache.clear() }
        }
        return client!!
    }

    /** Đồng bộ nền nếu lần kiểm tra trước đã cũ hơn [maxAgeMs]. */
    fun syncIfStale(context: Context, maxAgeMs: Long) {
        if (!hasCode() || running.value) return
        if (System.currentTimeMillis() - Prefs.pipeLastCheck < maxAgeMs) return
        val ctx = context.applicationContext
        scope.launch { sync(ctx) }
    }

    fun syncInBackground(context: Context, onDone: ((Result) -> Unit)? = null) {
        val ctx = context.applicationContext
        scope.launch {
            val r = sync(ctx)
            if (onDone != null) withContext(Dispatchers.Main) { onDone(r) }
        }
    }

    /** Thử mã truy cập (không lưu gì). */
    suspend fun testCode(url: String, code: String): String? = withContext(Dispatchers.IO) {
        try {
            ScadaClient(url, code).login(); null
        } catch (e: Exception) {
            errorKey(e)
        }
    }

    suspend fun sync(context: Context): Result = mutex.withLock {
        val ctx = context.applicationContext
        if (!hasCode()) return@withLock Result(false, 0, 0, ERR_NO_CODE)
        running.value = true
        try {
            val r = withContext(Dispatchers.IO) { doSync(ctx) }
            PipeStore.reload(ctx)
            r
        } catch (e: Exception) {
            Prefs.pipeLastCheck = System.currentTimeMillis()
            Prefs.pipeLastError = errorKey(e)
            if (!PipeStore.isLoaded()) runCatching { PipeStore.reload(ctx) }
            Result(false, 0, PipeStore.totalPipes(), Prefs.pipeLastError)
        } finally {
            running.value = false
        }
    }

    private fun doSync(ctx: Context): Result {
        val c = client()
        val html = c.login()
        val metas = (PipeParser.layerMeta(html) ?: throw ScadaClient.WrongCodeException()).filter { it.kind in PipeKind.ALL }
        val db = PipeDb.get(ctx)
        val local = db.layers().associateBy { it.id }
        var changed = 0
        var total = 0
        val now = System.currentTimeMillis()
        metas.forEachIndexed { idx, m ->
            val json = c.featuresJson(m.id)
            val hash = sha1(json)
            val old = local[m.id]
            val layer = PipeLayer(
                id = m.id, name = m.name, kind = m.kind, color = m.color, weight = m.weight,
                visible = old?.visible ?: m.visible, order = idx, sourceFile = m.sourceFile,
            )
            if (old != null && old.hash == hash) {
                layer.featureCount = old.featureCount
                layer.missingDiameter = old.missingDiameter
                layer.hash = old.hash
                layer.updatedAt = old.updatedAt
                db.upsertLayer(layer)
            } else {
                val feats = PipeParser.features(json, m.id, m.kind)
                layer.featureCount = feats.size
                layer.missingDiameter = feats.count { it.diameterMm == null }
                layer.hash = hash
                layer.updatedAt = now
                db.replaceLayer(layer, feats)
                changed++
            }
            total += layer.featureCount
        }
        val ids = metas.map { it.id }.toSet()
        local.keys.filter { it !in ids }.forEach { db.deleteLayer(it); changed++ }
        synchronized(infoCache) { infoCache.clear() }
        Prefs.pipeLastSync = now
        Prefs.pipeLastCheck = now
        Prefs.pipeLastError = ""
        return Result(true, changed, total)
    }

    /** Thẻ thông tin của một đoạn ống: hỏi máy chủ (giống web), không được thì dựng từ dữ liệu đã lưu. */
    suspend fun info(f: PipeFeature, layerName: String): PipeInfo {
        synchronized(infoCache) { infoCache[f.id] }?.let { return it }
        if (hasCode()) {
            val fromServer = withContext(Dispatchers.IO) {
                withTimeoutOrNull(10000) { runCatching { PipeParser.serverInfo(client().featureInfoJson(f.id)) }.getOrNull() }
            }
            if (fromServer != null && (fromServer.rows.isNotEmpty() || fromServer.title.isNotBlank())) {
                val fixed = if (fromServer.title.isBlank()) fromServer.copy(title = f.title ?: layerName) else fromServer
                synchronized(infoCache) { infoCache[f.id] = fixed }
                return fixed
            }
        }
        return PipeParser.offlineInfo(f, layerName)
    }

    fun errorKey(e: Throwable): String = when (e) {
        is ScadaClient.WrongCodeException -> ERR_WRONG_CODE
        is ScadaClient.ServerException -> "server:${e.status}"
        is UnknownHostException -> ERR_NETWORK
        is java.io.IOException -> ERR_NETWORK
        else -> "error:" + (e.message ?: e.javaClass.simpleName).take(80)
    }

    fun errorText(context: Context, key: String): String = when {
        key == ERR_NO_CODE -> context.getString(R.string.pipe_need_code)
        key == ERR_WRONG_CODE -> context.getString(R.string.pipe_wrong_code)
        key == ERR_NETWORK -> context.getString(R.string.pipe_network_error)
        key.startsWith("server:") -> context.getString(R.string.pipe_server_error, key.substringAfter(':'))
        else -> context.getString(R.string.pipe_sync_failed, key.substringAfter(':'))
    }

    private fun sha1(s: String): String =
        MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
}
