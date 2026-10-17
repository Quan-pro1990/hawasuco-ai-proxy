package vn.hawasuco.hawamap.xe

import androidx.car.app.CarContext
import androidx.car.app.model.CarIcon
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Distance
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.Step
import androidx.car.app.navigation.model.TravelEstimate
import androidx.core.graphics.drawable.IconCompat
import org.json.JSONObject
import vn.hawasuco.hawamap.R
import java.util.TimeZone
import kotlin.math.roundToLong

/**
 * Đổi dữ liệu dẫn đường từ trang HawaMap (bước kiểu OSRM: loai / huong / loiRa) sang mô hình của Android Auto.
 */
object ChuyenDoiXe {

    fun khoangCach(m: Double): Distance = when {
        m >= 10_000 -> Distance.create((m / 1000).roundToLong().toDouble(), Distance.UNIT_KILOMETERS)
        m >= 1000 -> Distance.create((m / 100).roundToLong() / 10.0, Distance.UNIT_KILOMETERS_P1)
        m >= 100 -> Distance.create((m / 50).roundToLong() * 50.0, Distance.UNIT_METERS)
        else -> Distance.create((m / 10).roundToLong() * 10.0, Distance.UNIT_METERS)
    }

    fun uocTinh(conLaiMet: Double, giay: Long, gioDen: Long): TravelEstimate =
        TravelEstimate.Builder(khoangCach(conLaiMet.coerceAtLeast(0.0)), DateTimeWithZone.create(gioDen, TimeZone.getDefault()))
            .setRemainingTimeSeconds(giay.coerceAtLeast(0))
            .build()

    fun buoc(ctx: CarContext, b: JSONObject): Step {
        val loai = b.optString("loai")
        val huong = b.optString("huong")
        val loiRa = b.optInt("loiRa")
        val kieu = kieuThaoTac(loai, huong, loiRa)
        val tt = Maneuver.Builder(kieu)
        if (kieu == Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW) tt.setRoundaboutExitNumber(loiRa)
        tt.setIcon(CarIcon.Builder(IconCompat.createWithResource(ctx, bieuTuong(loai, huong))).build())
        val sb = Step.Builder(b.optString("chiDan")).setManeuver(tt.build())
        val ten = b.optString("ten")
        if (ten.isNotEmpty()) sb.setRoad(ten)
        return sb.build()
    }

    private fun trai(h: String) = h.contains("left")
    private fun phai(h: String) = h.contains("right")

    /** Việt Nam đi bên phải: vòng xuyến đi ngược chiều kim đồng hồ (CCW), quay đầu sang trái. */
    fun kieuThaoTac(loai: String, huong: String, loiRa: Int): Int = when {
        loai == "arrive" -> when {
            trai(huong) -> Maneuver.TYPE_DESTINATION_LEFT
            phai(huong) -> Maneuver.TYPE_DESTINATION_RIGHT
            else -> Maneuver.TYPE_DESTINATION
        }
        loai == "depart" -> Maneuver.TYPE_DEPART
        loai == "roundabout" || loai == "rotary" ->
            if (loiRa > 0) Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW else Maneuver.TYPE_ROUNDABOUT_ENTER_CCW
        loai == "exit roundabout" || loai == "exit rotary" -> Maneuver.TYPE_ROUNDABOUT_EXIT_CCW
        huong == "uturn" -> Maneuver.TYPE_U_TURN_LEFT
        loai == "fork" -> if (trai(huong)) Maneuver.TYPE_FORK_LEFT else Maneuver.TYPE_FORK_RIGHT
        loai == "merge" -> when {
            trai(huong) -> Maneuver.TYPE_MERGE_LEFT
            phai(huong) -> Maneuver.TYPE_MERGE_RIGHT
            else -> Maneuver.TYPE_MERGE_SIDE_UNSPECIFIED
        }
        loai == "on ramp" -> when (huong) {
            "sharp left" -> Maneuver.TYPE_ON_RAMP_SHARP_LEFT
            "left" -> Maneuver.TYPE_ON_RAMP_NORMAL_LEFT
            "slight left" -> Maneuver.TYPE_ON_RAMP_SLIGHT_LEFT
            "sharp right" -> Maneuver.TYPE_ON_RAMP_SHARP_RIGHT
            "right" -> Maneuver.TYPE_ON_RAMP_NORMAL_RIGHT
            else -> Maneuver.TYPE_ON_RAMP_SLIGHT_RIGHT
        }
        loai == "off ramp" -> when (huong) {
            "left", "sharp left" -> Maneuver.TYPE_OFF_RAMP_NORMAL_LEFT
            "slight left" -> Maneuver.TYPE_OFF_RAMP_SLIGHT_LEFT
            "right", "sharp right" -> Maneuver.TYPE_OFF_RAMP_NORMAL_RIGHT
            else -> Maneuver.TYPE_OFF_RAMP_SLIGHT_RIGHT
        }
        loai == "new name" -> Maneuver.TYPE_NAME_CHANGE
        else -> when (huong) {
            "sharp right" -> Maneuver.TYPE_TURN_SHARP_RIGHT
            "right" -> Maneuver.TYPE_TURN_NORMAL_RIGHT
            "slight right" -> Maneuver.TYPE_TURN_SLIGHT_RIGHT
            "sharp left" -> Maneuver.TYPE_TURN_SHARP_LEFT
            "left" -> Maneuver.TYPE_TURN_NORMAL_LEFT
            "slight left" -> Maneuver.TYPE_TURN_SLIGHT_LEFT
            else -> Maneuver.TYPE_STRAIGHT
        }
    }

    /** Mũi tên rẽ (sinh từ public/js/bieu-tuong.js bằng tools/tao-bieu-tuong-goc.mjs). */
    fun bieuTuong(loai: String, huong: String): Int {
        if (loai == "arrive") return R.drawable.mt_den_noi
        if (huong == "uturn") return R.drawable.mt_quay_dau
        if (loai == "roundabout" || loai == "rotary") return when (huong) {
            "slight right" -> R.drawable.mt_vong_xuyen_cheo_phai
            "right" -> R.drawable.mt_vong_xuyen_phai
            "sharp right" -> R.drawable.mt_vong_xuyen_gat_phai
            "slight left" -> R.drawable.mt_vong_xuyen_cheo_trai
            "left" -> R.drawable.mt_vong_xuyen_trai
            "sharp left" -> R.drawable.mt_vong_xuyen_gat_trai
            else -> R.drawable.mt_vong_xuyen
        }
        return when (huong) {
            "slight right" -> R.drawable.mt_cheo_phai
            "right" -> R.drawable.mt_re_phai
            "sharp right" -> R.drawable.mt_gat_phai
            "slight left" -> R.drawable.mt_cheo_trai
            "left" -> R.drawable.mt_re_trai
            "sharp left" -> R.drawable.mt_gat_trai
            else -> R.drawable.mt_thang
        }
    }

    fun icon(ctx: CarContext, resId: Int): CarIcon = CarIcon.Builder(IconCompat.createWithResource(ctx, resId)).build()
}
