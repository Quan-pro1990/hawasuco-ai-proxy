package vn.hawasuco.hawamap.xe

import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.constraints.ConstraintManager
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import org.json.JSONArray
import org.json.JSONObject
import vn.hawasuco.hawamap.R

/** Một dòng trong danh sách trên xe. */
class DongXe(val tieuDe: String, val phu: String = "", val icon: Int = 0, val bam: () -> Unit)

/** Số dòng tối đa xe cho phép hiện trong danh sách (xe đang chạy thường chỉ cho ít dòng). */
fun gioiHanDanhSach(ctx: CarContext): Int = try {
    ctx.getCarService(ConstraintManager::class.java).getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST)
} catch (e: Exception) {
    6
}

/**
 * Danh sách chung trên xe (địa điểm đã lưu, danh mục quanh đây, kết quả, loại báo cáo).
 * `tai` lấy dữ liệu rồi gọi lại với danh sách dòng hoặc thông báo lỗi.
 */
class ManHinhDanhSach(
    carContext: CarContext,
    private val tieuDe: String,
    private val tai: (ManHinhDanhSach, (List<DongXe>?, String?) -> Unit) -> Unit
) : Screen(carContext) {
    private var dong: List<DongXe>? = null
    private var loi: String? = null

    init {
        tai(this) { ds, l ->
            dong = ds ?: emptyList()
            loi = l
            invalidate()
        }
    }

    override fun onGetTemplate(): Template {
        val b = ListTemplate.Builder().setTitle(tieuDe).setHeaderAction(Action.BACK)
        val ds = dong ?: return b.setLoading(true).build()
        val list = ItemList.Builder()
        ds.take(gioiHanDanhSach(carContext)).forEach { d ->
            val r = Row.Builder().setTitle(d.tieuDe).setOnClickListener { d.bam() }
            if (d.phu.isNotEmpty()) r.addText(d.phu)
            if (d.icon != 0) r.setImage(ChuyenDoiXe.icon(carContext, d.icon))
            list.addItem(r.build())
        }
        list.setNoItemsMessage(loi ?: "Không có mục nào")
        return b.setSingleList(list.build()).build()
    }

    companion object {
        private fun dongDiaDiem(m: ManHinhDanhSach, dk: DieuKhienXe, dd: JSONObject, icon: Int, tieuDe: String? = null) =
            DongXe(tieuDe ?: dd.optString("ten"), listOf(dd.optString("kcChu"), dd.optString("diaChi")).filter { it.isNotEmpty() }.joinToString(" · "), icon) {
                m.screenManager.push(ManHinhLoTrinh(m.carContext, dk, dd))
            }

        private fun mang(a: JSONArray?): List<JSONObject> = a?.let { (0 until it.length()).map { i -> it.getJSONObject(i) } } ?: emptyList()

        /** Nhà riêng, cơ quan, yêu thích, tìm gần đây. */
        fun daLuu(ctx: CarContext, dk: DieuKhienXe) = ManHinhDanhSach(ctx, "Đã lưu") { m, xong ->
            dk.lenh("daLuu") { kq, l ->
                val o = kq as? JSONObject
                if (o == null) { xong(null, l); return@lenh }
                val ds = mutableListOf<DongXe>()
                o.optJSONObject("nha")?.let { ds.add(dongDiaDiem(m, dk, it, R.drawable.ic_nha, "Nhà riêng")) }
                o.optJSONObject("coQuan")?.let { ds.add(dongDiaDiem(m, dk, it, R.drawable.ic_coquan, "Cơ quan")) }
                mang(o.optJSONArray("yeuThich")).forEach { ds.add(dongDiaDiem(m, dk, it, R.drawable.ic_saodac)) }
                mang(o.optJSONArray("ganDay")).forEach { ds.add(dongDiaDiem(m, dk, it, R.drawable.ic_dongho)) }
                xong(ds, if (ds.isEmpty()) "Chưa có địa điểm đã lưu. Lưu địa điểm trên điện thoại để dùng ở đây." else null)
            }
        }

        /** Danh mục quanh đây (cây xăng, trạm sạc, bãi đỗ xe…). */
        fun danhMuc(ctx: CarContext, dk: DieuKhienXe) = ManHinhDanhSach(ctx, "Quanh đây") { m, xong ->
            dk.lenh("danhMuc") { kq, l ->
                val ds = mang(kq as? JSONArray).map { d ->
                    val id = d.optString("id")
                    val ten = d.optString("ten")
                    DongXe(ten, icon = iconDanhMuc(id)) { m.screenManager.push(ketQuaDanhMuc(m.carContext, dk, id, ten)) }
                }
                xong(ds, l)
            }
        }

        fun ketQuaDanhMuc(ctx: CarContext, dk: DieuKhienXe, id: String, ten: String) = ManHinhDanhSach(ctx, ten) { m, xong ->
            dk.lenh("quanhDay", JSONObject().put("danhMuc", id)) { kq, l ->
                xong(mang(kq as? JSONArray).map { dongDiaDiem(m, dk, it, iconDanhMuc(id)) }, l)
            }
        }

        /** Gửi báo cáo giao thông tại vị trí hiện tại. */
        fun baoCao(ctx: CarContext, dk: DieuKhienXe) = ManHinhDanhSach(ctx, "Báo cáo giao thông") { m, xong ->
            dk.lenh("loaiBaoCao") { kq, l ->
                xong(mang(kq as? JSONArray).map { b ->
                    val id = b.optString("id")
                    DongXe(b.optString("ten"), icon = iconBaoCao(id)) {
                        dk.lenh("baoCao", JSONObject().put("loai", id)) { ten, loi ->
                            CarToast.makeText(m.carContext, loi ?: "Đã báo cáo $ten. Cảm ơn bạn!", CarToast.LENGTH_LONG).show()
                            m.screenManager.pop()
                        }
                    }
                }, l)
            }
        }

        private fun iconDanhMuc(id: String) = when (id) {
            "xang" -> R.drawable.ic_xang
            "doxe" -> R.drawable.ic_doxe
            "atm" -> R.drawable.ic_atm
            "cafe" -> R.drawable.ic_cafe
            "nhahang" -> R.drawable.ic_nhahang
            "benhvien" -> R.drawable.ic_benhvien
            "thuoc" -> R.drawable.ic_thuoc
            "khachsan" -> R.drawable.ic_khachsan
            "suaxe" -> R.drawable.ic_suaxe
            "ruaxe" -> R.drawable.ic_ruaxe
            "sacdien" -> R.drawable.ic_sacdien
            "wc" -> R.drawable.ic_wc
            else -> R.drawable.ic_ghim
        }

        private fun iconBaoCao(id: String) = when (id) {
            "ketxe" -> R.drawable.ic_ketxe
            "tainan" -> R.drawable.ic_tainan
            "csgt" -> R.drawable.ic_csgt
            "camera" -> R.drawable.ic_camera
            "ngap" -> R.drawable.ic_ngap
            "congtrinh" -> R.drawable.ic_congtrinh
            "vatcan" -> R.drawable.ic_vatcan
            "camduong" -> R.drawable.ic_camduong
            else -> R.drawable.ic_canhbao
        }
    }
}
