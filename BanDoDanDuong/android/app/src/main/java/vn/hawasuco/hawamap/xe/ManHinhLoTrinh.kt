package vn.hawasuco.hawamap.xe

import android.text.SpannableString
import android.text.Spanned
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.DurationSpan
import androidx.car.app.model.ItemList
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.RoutePreviewNavigationTemplate
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import org.json.JSONArray
import org.json.JSONObject

/** Xem trước các tuyến tới một địa điểm (tuyến vẽ trên bản đồ xe), chọn tuyến rồi Bắt đầu / Chạy thử. */
class ManHinhLoTrinh(carContext: CarContext, private val dk: DieuKhienXe, private val diem: JSONObject) : Screen(carContext) {
    private var tuyen: List<JSONObject>? = null
    private var loi: String? = null
    private var chon = 0
    private var daBatDau = false

    init {
        tai()
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                if (!daBatDau) dk.lenh("huyXemTruoc")
            }
        })
    }

    private fun tai() {
        tuyen = null
        loi = null
        dk.lenh("xemTruoc", JSONObject().put("diem", diem)) { kq, l ->
            val a = kq as? JSONArray
            tuyen = a?.let { (0 until it.length()).map { i -> it.getJSONObject(i) } }
            loi = l ?: if (a == null || a.length() == 0) "Không tìm được đường đi" else null
            chon = 0
            invalidate()
        }
    }

    override fun onGetTemplate(): Template {
        val ten = diem.optString("ten").ifEmpty { "Lộ trình" }
        loi?.let {
            return MessageTemplate.Builder(it)
                .setTitle(ten)
                .setHeaderAction(Action.BACK)
                .addAction(Action.Builder().setTitle("Thử lại").setOnClickListener { tai(); invalidate() }.build())
                .build()
        }
        val b = RoutePreviewNavigationTemplate.Builder()
            .setTitle(ten)
            .setHeaderAction(Action.BACK)
            .setNavigateAction(Action.Builder().setTitle("Bắt đầu").setOnClickListener { batDau(false) }.build())
        val ds = tuyen ?: return b.setLoading(true).build()
        val list = ItemList.Builder()
        ds.forEach { t ->
            // ký tự đầu được thay bằng thời gian đi (định dạng theo ngôn ngữ của xe)
            val tieuDe = SpannableString("  · " + t.optString("quangDuongChu"))
            tieuDe.setSpan(DurationSpan.create(t.optLong("thoiGian")), 0, 1, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
            val nhan = mutableListOf<String>()
            if (t.optBoolean("nhanhNhat") && ds.size > 1) nhan.add("Nhanh nhất")
            if (t.optBoolean("coThuPhi")) nhan.add("Có trạm thu phí")
            if (t.optBoolean("coCaoToc")) nhan.add("Có cao tốc")
            val qua = t.optString("duongChinh")
            val r = Row.Builder().setTitle(tieuDe)
            if (qua.isNotEmpty()) r.addText("Qua $qua")
            if (nhan.isNotEmpty()) r.addText(nhan.joinToString(" · "))
            list.addItem(r.build())
        }
        list.setOnSelectedListener { i ->
            chon = i
            dk.lenh("chonTuyen", JSONObject().put("i", i))
        }
        list.setSelectedIndex(chon)
        return b.setItemList(list.build())
            .setActionStrip(ActionStrip.Builder().addAction(Action.Builder().setTitle("Chạy thử").setOnClickListener { batDau(true) }.build()).build())
            .build()
    }

    private fun batDau(moPhong: Boolean) {
        daBatDau = true
        dk.lenh("batDau", JSONObject().put("moPhong", moPhong)) { _, l ->
            if (l != null) CarToast.makeText(carContext, l, CarToast.LENGTH_LONG).show()
        }
        screenManager.popToRoot()
    }
}
