package vn.hawasuco.hawamap

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Dịch vụ chạy nền trong lúc dẫn đường: giữ GPS hoạt động khi tắt màn hình điện thoại
 * hoặc khi chỉ dùng màn hình xe (Android Auto).
 */
class DanDuongService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val ql = getSystemService(NotificationManager::class.java)
        ql.createNotificationChannel(NotificationChannel(KENH, getString(R.string.kenh_dan_duong), NotificationManager.IMPORTANCE_LOW))
        val moApp = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE
        )
        val den = intent?.getStringExtra(THAM_SO_DEN).orEmpty()
        val tb = Notification.Builder(this, KENH)
            .setSmallIcon(R.drawable.ic_muiten)
            .setContentTitle(getString(R.string.dang_dan_duong))
            .setContentText(if (den.isNotEmpty()) "Đến $den" else "")
            .setContentIntent(moApp)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_NAVIGATION)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(MA_THONG_BAO, tb, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        else startForeground(MA_THONG_BAO, tb)
        return START_NOT_STICKY
    }

    companion object {
        private const val KENH = "dan-duong"
        private const val MA_THONG_BAO = 1
        private const val THAM_SO_DEN = "den"

        fun bat(ctx: Context, den: String) {
            try {
                ctx.startForegroundService(Intent(ctx, DanDuongService::class.java).putExtra(THAM_SO_DEN, den))
            } catch (e: Exception) {
                // Android 12+ chặn mở dịch vụ nền khi ứng dụng không hiển thị: vẫn dẫn đường được khi màn hình sáng
                Log.w("HawaMap", "Không mở được dịch vụ dẫn đường nền", e)
            }
        }

        fun tat(ctx: Context) {
            ctx.stopService(Intent(ctx, DanDuongService::class.java))
        }
    }
}
