package vn.hawasuco.hawamap.cau

import android.content.Context
import android.location.Location
import org.json.JSONException
import org.json.JSONObject
import vn.hawasuco.hawamap.DanDuongService
import vn.hawasuco.hawamap.R

/**
 * Trung tâm nối các trang HawaMap: trang trên điện thoại (MainActivity) và trang trên màn hình xe (Android Auto).
 *  - chuyển vị trí GPS tới mọi trang
 *  - chỉ đọc giọng nói từ một nơi (màn hình xe nếu đang kết nối)
 *  - bắt đầu / kết thúc dẫn đường ở màn hình này thì màn hình kia làm theo (đồng bộ tuyến)
 * Mọi hàm chạy trên luồng chính.
 */
object TrungTam {
    private lateinit var app: Context

    var dienThoai: TrangWeb? = null
        private set
    var xe: TrangWeb? = null
        private set

    /** Bộ điều khiển Android Auto nhận tin từ trang trên xe (trạng thái dẫn đường…). */
    var ngheXe: ((String, JSONObject) -> Unit)? = null
    /** MainActivity nhận tin từ trang trên điện thoại (giữ sáng màn hình, lưu tệp…). */
    var ngheDienThoai: ((String, JSONObject) -> Unit)? = null

    /** Tuyến đang dẫn (tin "batDau" gần nhất) để chuyển cho màn hình mở sau. */
    private var phien: String? = null
    var dangDanDuong = false
        private set

    private val ngheViTri = HashMap<TrangWeb, (Location) -> Unit>()

    fun khoiTao(ctx: Context) {
        app = ctx.applicationContext
        GiongNoi.khiDoi = { baoGiongNoi() }
    }

    /** Gửi trạng thái giọng đọc (có tiếng Việt không, danh sách giọng) cho các trang để hiện trong Cài đặt. */
    fun baoGiongNoi(chi: TrangWeb? = null) {
        val js = "window.hawamap&&hawamap.goc.giongNoi(${JSONObject.quote(GiongNoi.trangThai().toString())})"
        if (chi != null) chi.goi(js) else listOfNotNull(dienThoai, xe).forEach { it.goi(js) }
    }

    fun dangKy(t: TrangWeb) {
        if (t.vaiTro == VaiTro.XE) xe = t else dienThoai = t
        val f: (Location) -> Unit = { t.viTri(it) }
        ngheViTri[t] = f
        NguonViTri.them(app, f)
    }

    fun huyDangKy(t: TrangWeb) {
        if (xe === t) xe = null
        if (dienThoai === t) dienThoai = null
        ngheViTri.remove(t)?.let { NguonViTri.bo(it) }
    }

    private fun khac(t: TrangWeb) = if (t.vaiTro == VaiTro.XE) dienThoai else xe

    fun cauHinh(vaiTro: VaiTro): JSONObject = JSONObject()
        .put("vaiTro", vaiTro.ma)
        .put("nenTang", "android")
        .put("hud", "trai")
        // tìm bằng giọng nói qua ứng dụng (MainActivity.ngheTim), chỉ trên điện thoại
        .put("nghe", vaiTro == VaiTro.DIEN_THOAI)
        .put("mayChuBaoCao", app.getString(R.string.may_chu_bao_cao))

    fun nhanTin(tu: TrangWeb, loai: String, duChuoi: String) {
        val du = try { JSONObject(duChuoi) } catch (e: JSONException) { JSONObject() }
        when (loai) {
            "sanSang" -> {
                tu.daSanSang()
                NguonViTri.cuoi?.let { tu.viTri(it) }
                val p = phien
                if (dangDanDuong && p != null) tu.goi("hawamap.goc.dongBoBatDau(${JSONObject.quote(p)})")
                baoGiongNoi(tu)
                baoMoi(tu, loai, du)
            }
            "chonGiong" -> GiongNoi.chonGiong(du.optString("ten"))
            "caiGiongViet" -> GiongNoi.moCaiGiong(app)
            "hoiGiong" -> baoGiongNoi(tu)
            "traLoi" -> tu.nhanTraLoi(du)
            "noi" -> if (laNguonGiongNoi(tu)) {
                GiongNoi.noi(du.optString("chu"), du.optBoolean("chen"), du.optDouble("amLuong", 1.0).toFloat(), du.optDouble("toc", 1.0).toFloat())
            }
            "imLang" -> if (laNguonGiongNoi(tu)) GiongNoi.imLang()
            "batDau" -> {
                phien = duChuoi
                dangDanDuong = true
                khac(tu)?.goi("hawamap.goc.dongBoBatDau(${JSONObject.quote(duChuoi)})")
                if (!du.optBoolean("moPhong")) DanDuongService.bat(app, du.optString("tenDen"))
            }
            "ketThuc" -> {
                ketThucPhien()
                khac(tu)?.goi("hawamap.goc.dongBoKetThuc()")
            }
            else -> baoMoi(tu, loai, du)
        }
    }

    /** Màn hình xe đang kết nối thì chỉ đọc câu từ trang trên xe, tránh đọc hai lần. */
    private fun laNguonGiongNoi(tu: TrangWeb) = tu.vaiTro == VaiTro.XE || xe == null

    private fun baoMoi(tu: TrangWeb, loai: String, du: JSONObject) {
        if (tu.vaiTro == VaiTro.XE) ngheXe?.invoke(loai, du) else ngheDienThoai?.invoke(loai, du)
    }

    private fun ketThucPhien() {
        phien = null
        dangDanDuong = false
        DanDuongService.tat(app)
    }
}
