package vn.hawasuco.hawamap.cau

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import java.util.concurrent.CopyOnWriteArraySet

/**
 * GPS của điện thoại, dùng chung cho trang trên điện thoại và trang trên màn hình xe.
 * Chỉ bật khi có ít nhất một nơi đang nghe.
 */
object NguonViTri : LocationListener {
    private val nguoiNghe = CopyOnWriteArraySet<(Location) -> Unit>()
    private var lm: LocationManager? = null
    private var dangChay = false

    /** Vị trí mới nhất (null khi chưa có). */
    var cuoi: Location? = null
        private set

    fun coQuyen(ctx: Context): Boolean =
        ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ctx.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun them(ctx: Context, f: (Location) -> Unit) {
        nguoiNghe.add(f)
        batDau(ctx)
        cuoi?.let(f)
    }

    fun bo(f: (Location) -> Unit) {
        nguoiNghe.remove(f)
        if (nguoiNghe.isEmpty()) dung()
    }

    /** Gọi lại sau khi người dùng vừa cấp quyền vị trí. */
    fun batDauLai(ctx: Context) {
        if (nguoiNghe.isNotEmpty()) batDau(ctx)
    }

    @SuppressLint("MissingPermission")
    private fun batDau(ctx: Context) {
        if (dangChay || !coQuyen(ctx)) return
        val m = ctx.applicationContext.getSystemService(LocationManager::class.java) ?: return
        lm = m
        dangChay = true
        if (m.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            m.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
        }
        if (m.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            m.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000L, 0f, this, Looper.getMainLooper())
        }
        val gan = listOfNotNull(
            m.getLastKnownLocation(LocationManager.GPS_PROVIDER),
            m.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        ).maxByOrNull { it.time }
        if (gan != null && cuoi == null) onLocationChanged(gan)
    }

    private fun dung() {
        lm?.removeUpdates(this)
        dangChay = false
    }

    override fun onLocationChanged(location: Location) {
        // có GPS mới (dưới 10 giây) thì bỏ vị trí kém chính xác từ mạng
        val c = cuoi
        if (location.provider == LocationManager.NETWORK_PROVIDER && c != null &&
            c.provider == LocationManager.GPS_PROVIDER && location.time - c.time < 10_000
        ) return
        cuoi = location
        nguoiNghe.forEach { it(location) }
    }

    // Android 8–10 coi các hàm dưới là bắt buộc: khai báo rõ để không lỗi khi chạy trên máy cũ
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
    @Deprecated("Không dùng từ Android 10")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
}
