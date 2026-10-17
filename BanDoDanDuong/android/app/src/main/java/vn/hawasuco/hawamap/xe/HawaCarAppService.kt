package vn.hawasuco.hawamap.xe

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.car.app.CarAppService
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.ScreenManager
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator
import org.json.JSONArray
import org.json.JSONObject

/** Điểm vào của Android Auto (khai báo trong AndroidManifest.xml với category NAVIGATION). */
class HawaCarAppService : CarAppService() {
    override fun createHostValidator(): HostValidator =
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
        else HostValidator.Builder(applicationContext).addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample).build()

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onCreateSession(): Session = PhienXe()
}

/** Một lần cắm điện thoại vào xe. */
class PhienXe : Session() {
    private var dieuKhien: DieuKhienXe? = null

    override fun onCreateScreen(intent: Intent): Screen {
        val dk = DieuKhienXe(carContext, lifecycle)
        dieuKhien = dk
        val chinh = ManHinhChinh(carContext, dk)
        if (intent.action == CarContext.ACTION_NAVIGATE) {
            // màn hình gốc phải trả về trước, nên đẩy màn hình lộ trình lên sau
            Handler(Looper.getMainLooper()).post { moTheoIntent(intent, dk) }
        }
        return chinh
    }

    override fun onNewIntent(intent: Intent) {
        val dk = dieuKhien ?: return
        if (intent.action == CarContext.ACTION_NAVIGATE) moTheoIntent(intent, dk)
    }

    /** "geo:21.0287,105.8522" hoặc "geo:0,0?q=Hồ Gươm" (từ Google Assistant). */
    private fun moTheoIntent(intent: Intent, dk: DieuKhienXe) {
        val uri: Uri = intent.data ?: return
        val phan = uri.schemeSpecificPart.orEmpty()
        val toaDo = phan.substringBefore('?').split(',')
        val q = Uri.decode(phan.substringAfter("q=", "").substringBefore('&')).trim()
        val lat = toaDo.getOrNull(0)?.toDoubleOrNull() ?: 0.0
        val lng = toaDo.getOrNull(1)?.toDoubleOrNull() ?: 0.0
        val sm = carContext.getCarService(ScreenManager::class.java)
        if (lat != 0.0 || lng != 0.0) {
            val dd = JSONObject().put("ten", q.ifEmpty { "Điểm đến" }).put("diaChi", "").put("viTri", JSONArray().put(lng).put(lat))
            sm.push(ManHinhLoTrinh(carContext, dk, dd))
        } else if (q.isNotEmpty()) {
            dk.lenh("timKiem", JSONObject().put("chuoi", q)) { kq, _ ->
                val dau = (kq as? JSONArray)?.optJSONObject(0)
                if (dau != null) sm.push(ManHinhLoTrinh(carContext, dk, dau))
                else sm.push(ManHinhTimKiem(carContext, dk))
            }
        }
    }
}
