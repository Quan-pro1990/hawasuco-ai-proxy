package vn.hawasuco.hawamap.xe

import android.util.Log
import androidx.car.app.AppManager
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.navigation.NavigationManager
import androidx.car.app.navigation.NavigationManagerCallback
import androidx.car.app.navigation.model.Destination
import androidx.car.app.navigation.model.Trip
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import org.json.JSONObject
import vn.hawasuco.hawamap.cau.TrangWeb
import vn.hawasuco.hawamap.cau.TrungTam
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Bộ điều khiển một phiên Android Auto: bản đồ trên xe, gửi lệnh cho trang, nhận trạng thái dẫn đường
 * và báo cho hệ thống xe (NavigationManager: màn hình phụ / HUD của xe, nút dừng dẫn đường).
 */
class DieuKhienXe(private val carContext: CarContext, lifecycle: Lifecycle) : DefaultLifecycleObserver {
    private val choTrang = ArrayList<Triple<String, JSONObject, ((Any?, String?) -> Unit)?>>()
    private val nguoiNghe = CopyOnWriteArrayList<() -> Unit>()
    private val dieuHuong: NavigationManager = carContext.getCarService(NavigationManager::class.java)
    private var daBaoHeThong = false
    private var trang: TrangWeb? = null

    /** Tin "danDuong" mới nhất từ trang (null khi chưa dẫn đường lần nào). */
    var trangThai: JSONObject? = null
        private set

    val beMat = BeMatBanDo(carContext) { t -> khiCoTrang(t) }

    init {
        lifecycle.addObserver(this)
        dieuHuong.setNavigationManagerCallback(object : NavigationManagerCallback {
            override fun onStopNavigation() {
                lenh("ketThuc")
            }

            override fun onAutoDriveEnabled() {
                // lệnh kiểm thử của Android Auto: chạy thử tuyến đang xem
                lenh("batDau", JSONObject().put("moPhong", true))
            }
        })
        TrungTam.ngheXe = { loai, du -> nhanTin(loai, du) }
        carContext.getCarService(AppManager::class.java).setSurfaceCallback(beMat)
    }

    fun dangDanDuong() = trangThai?.optBoolean("dangDanDuong") == true

    fun them(f: () -> Unit) { nguoiNghe.add(f) }
    fun bo(f: () -> Unit) { nguoiNghe.remove(f) }
    private fun baoDoi() = nguoiNghe.forEach { it() }

    /** Gửi lệnh cho trang trên xe; bản đồ chưa sẵn sàng thì chờ. */
    fun lenh(ten: String, thamSo: JSONObject = JSONObject(), traLoi: ((Any?, String?) -> Unit)? = null) {
        val t = trang
        if (t == null) choTrang.add(Triple(ten, thamSo, traLoi)) else t.lenh(ten, thamSo, traLoi)
    }

    private fun khiCoTrang(t: TrangWeb?) {
        trang = t
        if (t == null) return
        val ds = ArrayList(choTrang)
        choTrang.clear()
        ds.forEach { (ten, ts, tl) -> t.lenh(ten, ts, tl) }
    }

    private fun nhanTin(loai: String, du: JSONObject) {
        when (loai) {
            "sanSang" -> {
                beMat.guiLe()
                baoDoi()
            }
            "danDuong" -> {
                trangThai = du
                val dang = du.optBoolean("dangDanDuong")
                if (dang && !daBaoHeThong) {
                    try { dieuHuong.navigationStarted(); daBaoHeThong = true } catch (e: IllegalStateException) { Log.w(TAG, "navigationStarted", e) }
                } else if (!dang && daBaoHeThong) {
                    dieuHuong.navigationEnded()
                    daBaoHeThong = false
                    if (du.optBoolean("daDen")) CarToast.makeText(carContext, "Đã đến ${du.optString("tenDen")}", CarToast.LENGTH_LONG).show()
                }
                if (dang && daBaoHeThong) baoChuyenDi(du)
                baoDoi()
            }
        }
    }

    /** Thông tin chuyến đi cho màn hình phụ / HUD của xe (nếu xe hỗ trợ). */
    private fun baoChuyenDi(du: JSONObject) {
        try {
            if (du.optBoolean("dangTinhLai")) {
                dieuHuong.updateTrip(Trip.Builder().setLoading(true).build())
                return
            }
            val ke = du.optJSONObject("ke") ?: return
            val conLai = du.optDouble("conLai")
            val giay = du.optLong("thoiGianConLai")
            val kc = ke.optDouble("kc")
            val giayToiBuoc = if (conLai > 0) (giay * kc / conLai).toLong() else 0L
            val chuyenDi = Trip.Builder()
                .addStep(ChuyenDoiXe.buoc(carContext, ke), ChuyenDoiXe.uocTinh(kc, giayToiBuoc, System.currentTimeMillis() + giayToiBuoc * 1000))
                .addDestination(
                    Destination.Builder().setName(du.optString("tenDen").ifEmpty { "Điểm đến" }).build(),
                    ChuyenDoiXe.uocTinh(conLai, giay, du.optLong("gioDen"))
                )
                .build()
            dieuHuong.updateTrip(chuyenDi)
        } catch (e: RuntimeException) {
            Log.w(TAG, "updateTrip", e)
        }
    }

    override fun onDestroy(owner: LifecycleOwner) {
        if (daBaoHeThong) dieuHuong.navigationEnded()
        daBaoHeThong = false
        TrungTam.ngheXe = null
        beMat.huy()
        nguoiNghe.clear()
    }

    companion object {
        private const val TAG = "HawaMapXe"
    }
}
