package vn.hawasuco.hawamap.xe

import android.Manifest
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarColor
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.RoutingInfo
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import org.json.JSONObject
import vn.hawasuco.hawamap.R
import vn.hawasuco.hawamap.cau.NguonViTri

/**
 * Màn hình gốc trên xe: bản đồ với các nút Tìm kiếm / Đã lưu / Quanh đây / Báo cáo;
 * khi đang dẫn đường thì hiện thẻ chỉ hướng, thời gian và quãng đường còn lại.
 */
class ManHinhChinh(carContext: CarContext, private val dk: DieuKhienXe) : Screen(carContext) {
    private val doi: () -> Unit = { invalidate() }
    private var loaBat = true

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) { dk.them(doi) }
            override fun onStop(owner: LifecycleOwner) { dk.bo(doi) }
        })
    }

    override fun onGetTemplate(): Template {
        if (!NguonViTri.coQuyen(carContext)) return mauXinQuyen()
        val tt = dk.trangThai
        return if (tt != null && tt.optBoolean("dangDanDuong")) mauDanDuong(tt) else mauBanDo()
    }

    private fun nut(icon: Int, bam: () -> Unit): Action =
        Action.Builder().setIcon(ChuyenDoiXe.icon(carContext, icon)).setOnClickListener { bam() }.build()

    private fun nutBanDo(): ActionStrip = ActionStrip.Builder()
        .addAction(Action.PAN)
        .addAction(nut(R.drawable.ic_cong) { dk.lenh("banDo", JSONObject().put("loai", "phongTo")) })
        .addAction(nut(R.drawable.ic_tru) { dk.lenh("banDo", JSONObject().put("loai", "thuNho")) })
        .addAction(nut(R.drawable.ic_vitri) { dk.lenh("banDo", JSONObject().put("loai", "veGiua")) })
        .build()

    private fun mauBanDo(): Template = NavigationTemplate.Builder()
        .setActionStrip(
            ActionStrip.Builder()
                .addAction(nut(R.drawable.ic_timkiem) { screenManager.push(ManHinhTimKiem(carContext, dk)) })
                .addAction(nut(R.drawable.ic_sao) { screenManager.push(ManHinhDanhSach.daLuu(carContext, dk)) })
                .addAction(nut(R.drawable.ic_xang) { screenManager.push(ManHinhDanhSach.danhMuc(carContext, dk)) })
                .addAction(nut(R.drawable.ic_loabao) { screenManager.push(ManHinhDanhSach.baoCao(carContext, dk)) })
                .build()
        )
        .setMapActionStrip(nutBanDo())
        .build()

    private fun mauDanDuong(tt: JSONObject): Template {
        val ke = tt.optJSONObject("ke")
        val thongTin = if (tt.optBoolean("dangTinhLai") || ke == null) {
            RoutingInfo.Builder().setLoading(true).build()
        } else {
            val b = RoutingInfo.Builder().setCurrentStep(ChuyenDoiXe.buoc(carContext, ke), ChuyenDoiXe.khoangCach(ke.optDouble("kc")))
            tt.optJSONObject("sau")?.let { b.setNextStep(ChuyenDoiXe.buoc(carContext, it)) }
            b.build()
        }
        return NavigationTemplate.Builder()
            .setNavigationInfo(thongTin)
            .setDestinationTravelEstimate(ChuyenDoiXe.uocTinh(tt.optDouble("conLai"), tt.optLong("thoiGianConLai"), tt.optLong("gioDen")))
            .setActionStrip(
                ActionStrip.Builder()
                    .addAction(nut(R.drawable.ic_loabao) { screenManager.push(ManHinhDanhSach.baoCao(carContext, dk)) })
                    .addAction(nut(if (loaBat) R.drawable.ic_loa else R.drawable.ic_tatloa) {
                        dk.lenh("loa", JSONObject().put("bat", !loaBat)) { kq, _ ->
                            loaBat = kq as? Boolean ?: loaBat
                            invalidate()
                        }
                    })
                    .addAction(Action.Builder().setTitle("Kết thúc").setOnClickListener { dk.lenh("ketThuc") }.build())
                    .build()
            )
            .setMapActionStrip(nutBanDo())
            .setBackgroundColor(CarColor.GREEN)
            .build()
    }

    private fun mauXinQuyen(): Template = MessageTemplate.Builder("HawaMap cần quyền vị trí để dẫn đường. Hãy cho phép trên điện thoại.")
        .setTitle("HawaMap")
        .addAction(
            Action.Builder().setTitle("Cho phép").setOnClickListener {
                carContext.requestPermissions(listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) { duoc, _ ->
                    if (duoc.isNotEmpty()) NguonViTri.batDauLai(carContext)
                    invalidate()
                }
            }.build()
        )
        .build()
}
