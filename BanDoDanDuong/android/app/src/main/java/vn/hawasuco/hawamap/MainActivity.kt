package vn.hawasuco.hawamap

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognizerIntent
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import vn.hawasuco.hawamap.cau.BongBong
import vn.hawasuco.hawamap.cau.GiongNoi
import vn.hawasuco.hawamap.cau.KetNoiObd
import vn.hawasuco.hawamap.cau.LienKet
import vn.hawasuco.hawamap.cau.LuuTep
import vn.hawasuco.hawamap.cau.NguonViTri
import vn.hawasuco.hawamap.cau.TrangWeb
import vn.hawasuco.hawamap.cau.TrungTam
import vn.hawasuco.hawamap.cau.VaiTro

/** Màn hình điện thoại: toàn bộ giao diện HawaMap (trang web trong WebView). */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var trang: TrangWeb
    private var yeuCauWeb: PermissionRequest? = null
    private var obd: KetNoiObd? = null
    private var choQuyenObd = false

    private val xinQuyen = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { kq ->
        if (kq[Manifest.permission.ACCESS_FINE_LOCATION] == true || kq[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            NguonViTri.batDauLai(this)
        }
        yeuCauWeb?.let { capQuyenWeb(it) }
        yeuCauWeb = null
        if (choQuyenObd) {
            choQuyenObd = false
            if (coQuyenBluetooth()) ketNoiObd().chonThietBi()
            else trang.goi("window.hawamap&&hawamap.goc.obd('loi','Cần quyền Thiết bị lân cận (Bluetooth) để kết nối OBD')")
        }
    }

    /** Tìm bằng giọng nói: hộp nghe của máy (thường là của Google), chữ nghe được trả cho trang (main.js ketQuaNgheGoc). */
    private val ngheGiong = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { kq ->
        val chu = kq.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull { it.isNotBlank() }
        traKetQuaNghe(
            when {
                kq.resultCode == Activity.RESULT_OK && chu != null -> JSONObject().put("chu", chu)
                kq.resultCode == Activity.RESULT_CANCELED -> JSONObject().put("loi", "huy")
                else -> JSONObject().put("loi", "khongnghe")
            }
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0)

        webView = WebView(this)
        val khung = FrameLayout(this)
        khung.addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(khung)
        // Android 15 vẽ tràn viền: chừa chỗ cho thanh trạng thái, thanh điều hướng và bàn phím
        ViewCompat.setOnApplyWindowInsetsListener(khung) { v, insets ->
            val b = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime() or WindowInsetsCompat.Type.displayCutout()
            )
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }

        trang = TrangWeb(webView, VaiTro.DIEN_THOAI)
        webView.webChromeClient = object : WebChromeClient() {
            // camera hành trình (getUserMedia) trong trang
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { xuLyQuyenWeb(request) }
            }
        }
        TrungTam.ngheDienThoai = { loai, du -> xuLyTin(loai, du) }
        TrungTam.dangKy(trang)
        trang.tai()
        xinQuyenBanDau()
        if (savedInstanceState == null) moTuIntent(intent)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (!trang.sanSang) { moveTaskToBack(true); return }
                trang.lenh("quayLai") { kq, _ ->
                    if ((kq as? JSONObject)?.optBoolean("daXuLy") != true) moveTaskToBack(true)
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        moTuIntent(intent)
    }

    /** Liên kết / văn bản chia sẻ từ ứng dụng khác: trang đọc ra địa điểm (public/js/lien-ket.js); lệnh xếp hàng tới khi trang sẵn sàng. */
    private fun moTuIntent(intent: Intent?) {
        val chuoi = when (intent?.action) {
            Intent.ACTION_VIEW -> intent.dataString
            Intent.ACTION_SEND -> listOfNotNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getStringExtra(Intent.EXTRA_TEXT))
                .joinToString("\n")
            else -> null
        }
        if (chuoi.isNullOrBlank()) return
        // liên kết rút gọn: mở ra liên kết đầy đủ trên luồng nền trước
        val rutGon = LienKet.timRutGon(chuoi)
        if (rutGon == null) { guiLienKet(chuoi); return }
        Thread {
            val day = try { LienKet.moRutGon(rutGon) } catch (e: Exception) { null }
            runOnUiThread { guiLienKet(day ?: chuoi) }
        }.start()
    }

    private fun guiLienKet(chuoi: String) {
        trang.lenh("moLienKet", JSONObject().put("chuoi", chuoi.take(4000))) { kq, _ ->
            if (kq != true) Toast.makeText(this, "HawaMap không đọc được địa điểm từ nội dung được chia sẻ", Toast.LENGTH_LONG).show()
        }
    }

    override fun onStart() {
        super.onStart()
        BongBong.an(this)
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations && BongBong.nenHien(this)) BongBong.hien(this)
    }

    override fun onResume() {
        super.onResume()
        if (GiongNoi.thieuTiengViet) {
            if (!daNhacCaiGiong) {
                // lần đầu: nhắc và mở chỗ cài giọng tiếng Việt của Google
                daNhacCaiGiong = true
                Toast.makeText(this, "Máy chưa có giọng đọc tiếng Việt. Hãy cài giọng tiếng Việt cho \"Dịch vụ lời nói của Google\" để nghe dẫn đường.", Toast.LENGTH_LONG).show()
                GiongNoi.moCaiGiong(this)
            } else {
                // quay lại sau khi cài: dò lại bộ đọc có tiếng Việt
                GiongNoi.thuLai()
            }
        }
    }

    override fun onDestroy() {
        obd?.ngat()
        BongBong.an(this)
        TrungTam.huyDangKy(trang)
        if (TrungTam.dienThoai == null) TrungTam.ngheDienThoai = null
        trang.huy()
        super.onDestroy()
    }

    private fun xinQuyenBanDau() {
        val can = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) can.add(Manifest.permission.POST_NOTIFICATIONS)
        val thieu = can.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (thieu.isNotEmpty()) xinQuyen.launch(thieu.toTypedArray())
    }

    private fun quyenCanCho(request: PermissionRequest): List<String> = request.resources.mapNotNull {
        when (it) {
            PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
            PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
            else -> null
        }
    }

    private fun xuLyQuyenWeb(request: PermissionRequest) {
        val thieu = quyenCanCho(request).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (thieu.isEmpty()) capQuyenWeb(request)
        else {
            yeuCauWeb = request
            xinQuyen.launch(thieu.toTypedArray())
        }
    }

    private fun capQuyenWeb(request: PermissionRequest) {
        val duoc = request.resources.filter {
            (it == PermissionRequest.RESOURCE_VIDEO_CAPTURE && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) ||
                (it == PermissionRequest.RESOURCE_AUDIO_CAPTURE && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
        }
        if (duoc.isEmpty()) request.deny() else request.grant(duoc.toTypedArray())
    }

    /**
     * WebView không có nhận dạng giọng nói (Web Speech API) như Chrome: mở hộp nghe tiếng Việt của máy.
     * Không cần quyền micro cho HawaMap, ứng dụng nghe (Google) tự xin quyền của nó.
     */
    private fun ngheTim() {
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "vi-VN")
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "vi-VN")
            .putExtra(RecognizerIntent.EXTRA_PROMPT, "Nói tên địa điểm cần tìm")
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        try {
            ngheGiong.launch(i)
        } catch (e: ActivityNotFoundException) {
            traKetQuaNghe(JSONObject().put("loi", "khongco"))
        }
    }

    private fun traKetQuaNghe(du: JSONObject) {
        trang.goi("window.hawamap&&hawamap.goc.ketQuaNghe(${JSONObject.quote(du.toString())})")
    }

    private fun coQuyenBluetooth(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun ketNoiObd(): KetNoiObd = obd ?: KetNoiObd(this, trang).also { obd = it }

    private fun xuLyTin(loai: String, du: JSONObject) {
        when (loai) {
            "obdKetNoi" -> if (coQuyenBluetooth()) ketNoiObd().chonThietBi() else {
                choQuyenObd = true
                xinQuyen.launch(arrayOf(Manifest.permission.BLUETOOTH_CONNECT))
            }
            "obdGui" -> obd?.gui(du.optString("chuoi"))
            "ngheTim" -> ngheTim()
            "hud" -> BongBong.capNhat(du)
            // người dùng bật bong bóng nổi: mở trang cấp quyền "Hiển thị trên ứng dụng khác" nếu chưa có
            "xinQuyenNoi" -> if (!Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "Bật \"Cho phép hiển thị trên ứng dụng khác\" cho HawaMap", Toast.LENGTH_LONG).show()
                try {
                    startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
                } catch (e: Exception) { /* máy không có trang cài đặt này */ }
            }
            "obdNgat" -> obd?.ngat()
            "giuManHinh" ->
                if (du.optBoolean("bat")) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            "luuTep" -> {
                val noi = LuuTep.luu(this, du.optString("ten"), du.optString("kieu"), du.optString("base64"))
                Toast.makeText(this, if (noi != null) "Đã lưu: $noi" else "Không lưu được tệp", Toast.LENGTH_LONG).show()
            }
        }
    }

    private companion object {
        var daNhacCaiGiong = false
    }
}
