package vn.hawasuco.hawamap

import android.Manifest
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
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
import vn.hawasuco.hawamap.cau.GiongNoi
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

    private val xinQuyen = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { kq ->
        if (kq[Manifest.permission.ACCESS_FINE_LOCATION] == true || kq[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            NguonViTri.batDauLai(this)
        }
        yeuCauWeb?.let { capQuyenWeb(it) }
        yeuCauWeb = null
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

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (!trang.sanSang) { moveTaskToBack(true); return }
                trang.lenh("quayLai") { kq, _ ->
                    if ((kq as? JSONObject)?.optBoolean("daXuLy") != true) moveTaskToBack(true)
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        if (GiongNoi.thieuTiengViet && !daNhacCaiGiong) {
            daNhacCaiGiong = true
            Toast.makeText(this, "Máy chưa có giọng đọc tiếng Việt. Hãy cài trong Cài đặt → Chuyển văn bản thành giọng nói.", Toast.LENGTH_LONG).show()
            try { startActivity(Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)) } catch (e: Exception) { /* không có ứng dụng cài giọng */ }
        }
    }

    override fun onDestroy() {
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

    private fun xuLyTin(loai: String, du: JSONObject) {
        when (loai) {
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
