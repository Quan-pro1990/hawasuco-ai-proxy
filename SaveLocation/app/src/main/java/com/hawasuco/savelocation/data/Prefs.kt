package com.hawasuco.savelocation.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

/** Toàn bộ cài đặt của ứng dụng (SharedPreferences). */
object Prefs {
    private lateinit var sp: SharedPreferences

    fun init(context: Context) {
        if (!::sp.isInitialized) sp = context.applicationContext.getSharedPreferences("settings", Context.MODE_PRIVATE)
    }

    private fun bool(key: String, def: Boolean) = sp.getBoolean(key, def)
    private fun setBool(key: String, v: Boolean) = sp.edit { putBoolean(key, v) }
    private fun int(key: String, def: Int) = sp.getInt(key, def)
    private fun setInt(key: String, v: Int) = sp.edit { putInt(key, v) }
    private fun str(key: String, def: String) = sp.getString(key, def) ?: def
    private fun setStr(key: String, v: String) = sp.edit { putString(key, v) }
    private fun long(key: String, def: Long) = sp.getLong(key, def)
    private fun setLong(key: String, v: Long) = sp.edit { putLong(key, v) }

    // ---- Bản đồ
    /** 0 = đường, 1 = vệ tinh, 2 = kết hợp, 3 = địa hình */
    var mapType: Int get() = int("map_type", 0); set(v) = setInt("map_type", v)
    var isMapFull: Boolean get() = bool("is_map_full", false); set(v) = setBool("is_map_full", v)
    /** Bán kính lọc điểm trên tab bản đồ (theo đơn vị đang chọn), 0 = tắt. */
    var mapRadius: Int get() = int("map_radius", 0); set(v) = setInt("map_radius", v)
    var clusterMarkers: Boolean get() = bool("cluster_markers", true); set(v) = setBool("cluster_markers", v)

    // ---- Cài đặt chung
    /** 0 = km, 1 = dặm */
    var distanceUnit: Int get() = int("distance_unit", 0); set(v) = setInt("distance_unit", v)
    /** 0 = chia sẻ trực tiếp (mở bảng chọn), 1 = chia sẻ vị trí ngay */
    var sharingMode: Int get() = int("sharing_mode", 0); set(v) = setInt("sharing_mode", v)
    var dateFormat: Int get() = int("datetime_format", 5); set(v) = setInt("datetime_format", v)
    var showDirection: Boolean get() = bool("show_direction", true); set(v) = setBool("show_direction", v)
    var autoGpsUpdate: Boolean get() = bool("automatic_gps_update", true); set(v) = setBool("automatic_gps_update", v)
    var driveMode: Boolean get() = bool("driving_mode", false); set(v) = setBool("driving_mode", v)
    var groupMode: Boolean get() = bool("group_mode", true); set(v) = setBool("group_mode", v)
    /** 0 = theo hệ thống, 1 = sáng, 2 = tối */
    var theme: Int get() = int("app_theme", 0); set(v) = setInt("app_theme", v)
    /** "" = theo hệ thống, "en", "vi" */
    var language: String get() = str("language", ""); set(v) = setStr("language", v)
    /** "DD", "DMS", "DDM", "UTM" */
    var coordFormat: String get() = str("latlng_format", "DD"); set(v) = setStr("latlng_format", v)
    /** -1 = luôn hỏi, 0 = Google Maps, 1 = Waze, 2 = HERE, 3 = Sygic */
    var navigationApp: Int get() = int("navigation_app", -1); set(v) = setInt("navigation_app", v)
    /** 0 = ngày giảm dần, 1 = ngày tăng dần, 2 = khoảng cách, 3 = theo tên */
    var sortBy: Int get() = int("sort_by", 0); set(v) = setInt("sort_by", v)
    /** 0 = ngày tạo, 1 = theo tên, -1 = thứ tự tự kéo thả */
    var groupSortBy: Int get() = int("group_sort_by", 0); set(v) = setInt("group_sort_by", v)

    // ---- Lần đầu
    var introShown: Boolean get() = bool("intro_shown", false); set(v) = setBool("intro_shown", v)
    var changeLocationIntroShown: Boolean get() = bool("change_intro_shown", false); set(v) = setBool("change_intro_shown", v)
    var featureAnnouncementShown: Boolean get() = bool("feature_live_shown", false); set(v) = setBool("feature_live_shown", v)
    var onboardingDone: Boolean get() = bool("onboarding_done", false); set(v) = setBool("onboarding_done", v)
    var lastBackupMillis: Long get() = long("last_backup", 0L); set(v) = setLong("last_backup", v)

    // ---- Vùng cảnh báo
    var geofenceRadius: Int get() = int("geofence_radius", 200); set(v) = setInt("geofence_radius", v)

    // ---- Bản đồ mạng lưới đường ống (đồng bộ từ SCADA)
    var scadaUrl: String get() = str("scada_url", DEFAULT_SCADA_URL); set(v) = setStr("scada_url", v.trim().trimEnd('/'))
    var scadaCode: String get() = str("scada_code", ""); set(v) = setStr("scada_code", v.trim())
    /** Tô màu ống theo cỡ (đường kính) thay cho màu của lớp — như nút "Màu theo cỡ ống" trên web SCADA. */
    var pipeSizeMode: Boolean get() = bool("pipe_size_mode", false); set(v) = setBool("pipe_size_mode", v)
    /** Hiện đường ống trên bản đồ chính và các bản đồ khác. */
    var pipesOnMaps: Boolean get() = bool("pipes_on_maps", true); set(v) = setBool("pipes_on_maps", v)
    var pipeLastSync: Long get() = long("pipe_last_sync", 0L); set(v) = setLong("pipe_last_sync", v)
    var pipeLastCheck: Long get() = long("pipe_last_check", 0L); set(v) = setLong("pipe_last_check", v)
    var pipeLastError: String get() = str("pipe_last_error", ""); set(v) = setStr("pipe_last_error", v)

    const val DEFAULT_SCADA_URL = "https://scada.capnuochaugiang.vn"

    // ---- Nội dung khi chia sẻ
    fun shareField(key: String): Boolean = bool("share_$key", true)
    fun setShareField(key: String, v: Boolean) = setBool("share_$key", v)

    // ---- Trường hiển thị trong danh sách
    fun listField(key: String): Boolean = bool("list_$key", true)
    fun setListField(key: String, v: Boolean) = setBool("list_$key", v)

    // ---- Vị trí trực tiếp
    var liveServerUrl: String get() = str("live_server", ""); set(v) = setStr("live_server", v.trim().trimEnd('/'))
    var displayName: String get() = str("display_name", ""); set(v) = setStr("display_name", v)
    var liveIntervalSec: Int get() = int("live_interval", 10); set(v) = setInt("live_interval", v)
    var liveDisplacementM: Int get() = int("live_displacement", 10); set(v) = setInt("live_displacement", v)
    var liveSessionId: String get() = str("live_id", ""); set(v) = setStr("live_id", v)
    var liveToken: String get() = str("live_token", ""); set(v) = setStr("live_token", v)
    var liveStartedAt: Long get() = long("live_started", 0L); set(v) = setLong("live_started", v)
    var liveExpiresAt: Long get() = long("live_expires", 0L); set(v) = setLong("live_expires", v)

    val isLiveActive: Boolean get() = liveSessionId.isNotEmpty() && liveExpiresAt > System.currentTimeMillis()

    fun clearLiveSession() = sp.edit {
        remove("live_id"); remove("live_token"); remove("live_started"); remove("live_expires")
    }

    // Khoá chuẩn cho các trường chia sẻ / hiển thị
    object Share {
        const val LAT = "latitude"
        const val LNG = "longitude"
        const val UTM_N = "utm_northing"
        const val UTM_E = "utm_easting"
        const val UTM_ZONE = "utm_zone"
        const val TITLE = "title"
        const val ADDRESS = "address"
        const val CONTACT = "contact"
        const val NOTE = "note"
        const val DATE = "date"
        const val GOOGLE = "google_url"
        const val WAZE = "waze_url"
        const val OSM = "osm_url"
    }

    object ListField {
        const val TITLE = "title"
        const val IMAGE = "image"
        const val ADDRESS = "address"
        const val COORDS = "coordinates"
        const val CONTACT = "contact"
        const val NOTE = "note"
        const val DATE = "date"
        const val DISTANCE = "distance"
        const val GROUP = "group"
    }
}
