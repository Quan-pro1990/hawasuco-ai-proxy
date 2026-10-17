package vn.hawasuco.hawamap.xe

import android.os.Handler
import android.os.Looper
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.Row
import androidx.car.app.model.SearchTemplate
import androidx.car.app.model.Template
import org.json.JSONArray
import org.json.JSONObject

/** Tìm địa điểm bằng bàn phím / giọng nói của xe. Chọn kết quả → xem trước lộ trình. */
class ManHinhTimKiem(carContext: CarContext, private val dk: DieuKhienXe) : Screen(carContext) {
    private val chinh = Handler(Looper.getMainLooper())
    private var henTim: Runnable? = null
    private var chuoi = ""
    private var ketQua: List<JSONObject> = emptyList()
    private var dangTim = false
    private var loi: String? = null
    private var lanTim = 0

    override fun onGetTemplate(): Template {
        val b = SearchTemplate.Builder(object : SearchTemplate.SearchCallback {
            override fun onSearchTextChanged(searchText: String) = hen(searchText, 500)
            override fun onSearchSubmitted(searchText: String) = hen(searchText, 0)
        })
            .setHeaderAction(Action.BACK)
            .setSearchHint("Tìm địa điểm, địa chỉ")
            .setInitialSearchText(chuoi)
            .setShowKeyboardByDefault(ketQua.isEmpty())
        if (dangTim) return b.setLoading(true).build()
        val ds = ItemList.Builder()
        ketQua.take(gioiHanDanhSach(carContext)).forEach { dd ->
            val r = Row.Builder().setTitle(dd.optString("ten")).setOnClickListener {
                screenManager.push(ManHinhLoTrinh(carContext, dk, dd))
            }
            val phu = listOf(dd.optString("kcChu"), dd.optString("diaChi")).filter { it.isNotEmpty() }.joinToString(" · ")
            if (phu.isNotEmpty()) r.addText(phu)
            ds.addItem(r.build())
        }
        ds.setNoItemsMessage(loi ?: if (chuoi.isBlank()) "Nhập tên địa điểm hoặc địa chỉ" else "Không tìm thấy \"$chuoi\"")
        return b.setItemList(ds.build()).build()
    }

    private fun hen(s: String, tre: Long) {
        chuoi = s
        henTim?.let { chinh.removeCallbacks(it) }
        if (s.isBlank()) {
            ketQua = emptyList()
            invalidate()
            return
        }
        val r = Runnable { tim(s) }
        henTim = r
        chinh.postDelayed(r, tre)
    }

    private fun tim(s: String) {
        val lan = ++lanTim
        dangTim = true
        invalidate()
        dk.lenh("timKiem", JSONObject().put("chuoi", s)) { kq, l ->
            if (lan != lanTim) return@lenh
            dangTim = false
            loi = l
            ketQua = (kq as? JSONArray)?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } } ?: emptyList()
            invalidate()
        }
    }
}
