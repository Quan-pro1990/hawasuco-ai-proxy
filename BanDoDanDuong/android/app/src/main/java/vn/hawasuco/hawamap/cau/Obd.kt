package vn.hawasuco.hawamap.cau

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Bộ chuyển OBD-II ELM327 Bluetooth thường (cổng nối tiếp SPP) cho trang HawaMap.
 * Trang (public/js/obd.js, CongGoc) gửi lệnh dạng chữ; mọi dữ liệu nhận được chuyển nguyên về trang qua hawamap.goc.obd().
 * Gọi khi đã có quyền BLUETOOTH_CONNECT (Android 12 trở lên).
 */
class KetNoiObd(private val hoatDong: Activity, private val trang: TrangWeb) {
    private var socket: BluetoothSocket? = null
    @Volatile private var dangChay = false
    private val luongGhi = Executors.newSingleThreadExecutor()

    @SuppressLint("MissingPermission")
    fun chonThietBi() {
        val bt = (hoatDong.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
        if (bt == null) { bao("loi", "Máy không có Bluetooth"); return }
        if (!bt.isEnabled) { bao("loi", "Hãy bật Bluetooth rồi thử lại"); return }
        val ds = bt.bondedDevices.orEmpty().sortedByDescending { laBoChuyenObd(it.name) }
        if (ds.isEmpty()) {
            bao("loi", "Chưa ghép đôi bộ chuyển OBD: vào Cài đặt → Bluetooth để ghép đôi (mã PIN thường là 1234)")
            return
        }
        AlertDialog.Builder(hoatDong)
            .setTitle("Chọn bộ chuyển OBD-II")
            .setItems(ds.map { it.name ?: it.address }.toTypedArray()) { _, i -> ketNoi(ds[i]) }
            .setOnCancelListener { bao("loi", "Chưa chọn bộ chuyển OBD") }
            .show()
    }

    @SuppressLint("MissingPermission")
    private fun ketNoi(thietBi: BluetoothDevice) {
        Thread {
            var daKetNoi = false
            try {
                val s = thietBi.createRfcommSocketToServiceRecord(SPP)
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                    (hoatDong.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter?.cancelDiscovery()
                }
                s.connect()
                socket = s
                dangChay = true
                daKetNoi = true
                bao("ketNoi", thietBi.name ?: "ELM327")
                val dem = ByteArray(1024)
                val vao = s.inputStream
                while (dangChay) {
                    val n = vao.read(dem)
                    if (n < 0) break
                    bao("nhan", String(dem, 0, n, Charsets.ISO_8859_1))
                }
            } catch (e: IOException) {
                if (!daKetNoi) bao("loi", "Không kết nối được ${thietBi.name ?: "bộ chuyển"}: bật khoá điện và thử lại")
            } finally {
                dong()
                if (daKetNoi) bao("ngat", "")
            }
        }.start()
    }

    fun gui(chuoi: String) {
        val s = socket ?: return
        luongGhi.execute {
            try {
                s.outputStream.write(chuoi.toByteArray(Charsets.ISO_8859_1))
                s.outputStream.flush()
            } catch (e: IOException) {
                dong()
            }
        }
    }

    fun ngat() {
        dangChay = false
        dong()
    }

    private fun dong() {
        try { socket?.close() } catch (e: IOException) { /* đã đóng */ }
        socket = null
    }

    private fun bao(loai: String, du: String) {
        trang.goi("window.hawamap&&hawamap.goc.obd(${JSONObject.quote(loai)},${JSONObject.quote(du)})")
    }

    private fun laBoChuyenObd(ten: String?): Boolean = ten != null && Regex("OBD|ELM|V-?LINK|VEEPEAK|ICAR|KONNWEI", RegexOption.IGNORE_CASE).containsMatchIn(ten)

    companion object {
        /** Cổng nối tiếp Bluetooth (Serial Port Profile). */
        val SPP: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }
}
