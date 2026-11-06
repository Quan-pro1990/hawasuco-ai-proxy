package com.hawasuco.savelocation.live

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.App
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.ui.HomeActivity
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.LocationHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Dịch vụ chạy nền (foreground, loại location) gửi vị trí lên máy chủ trong thời gian chia sẻ trực tiếp.
 * Gửi khi di chuyển theo cài đặt (mỗi X giây / sau Y mét) và "nhịp tim" 60 giây khi đứng yên.
 */
class LiveLocationService : LifecycleService() {
    private lateinit var helper: LocationHelper
    private var last: Location? = null
    private var lastSentAt = 0L
    private var timerJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        helper = LocationHelper(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_STOP -> { stopSharing(); return START_NOT_STICKY }
            ACTION_RESTART_UPDATES -> { startUpdates(); return START_STICKY }
        }
        if (!Prefs.isLiveActive || !helper.hasPermission()) {
            Prefs.clearLiveSession(); stopSelf(); return START_NOT_STICKY
        }
        val n = notification()
        val type = if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        runCatching { ServiceCompat.startForeground(this, NOTIF_ID, n, type) }.onFailure { stopSelf(); return START_NOT_STICKY }
        startUpdates()
        timerJob?.cancel()
        timerJob = lifecycleScope.launch {
            while (isActive) {
                if (!Prefs.isLiveActive) { stopSharing(); break }
                // Nhịp tim: đứng yên lâu thì vẫn gửi lại vị trí cuối
                val l = last
                if (l != null && System.currentTimeMillis() - lastSentAt > HEARTBEAT_MS) send(l)
                delay(5000)
            }
        }
        return START_STICKY
    }

    private fun startUpdates() {
        helper.stopUpdates()
        helper.startUpdates(Prefs.liveIntervalSec * 1000L, Prefs.liveDisplacementM.toFloat()) { l ->
            last = l
            send(l)
        }
    }

    private fun send(l: Location) {
        val id = Prefs.liveSessionId
        val token = Prefs.liveToken
        if (id.isEmpty()) return
        lastSentAt = System.currentTimeMillis()
        lifecycleScope.launch(Dispatchers.IO) {
            runCatching { LiveApi.update(id, token, l.latitude, l.longitude, l.accuracy, System.currentTimeMillis()) }
        }
    }

    private fun stopSharing() {
        val id = Prefs.liveSessionId
        val token = Prefs.liveToken
        helper.stopUpdates()
        timerJob?.cancel()
        Prefs.clearLiveSession()
        DataBus.notifyChanged()
        if (id.isNotEmpty()) {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) { runCatching { LiveApi.stop(id, token) } }
                finishService()
            }
        } else finishService()
    }

    private fun finishService() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        helper.stopUpdates()
        super.onDestroy()
    }

    private fun notification(): android.app.Notification {
        val open = PendingIntent.getActivity(this, 1,
            Intent(this, HomeActivity::class.java).putExtra(HomeActivity.EXTRA_OPEN, HomeActivity.OPEN_LIVE_STATUS)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 2,
            Intent(this, LiveLocationService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, App.CHANNEL_LIVE)
            .setSmallIcon(R.drawable.ic_tile_save)
            .setContentTitle(getString(R.string.live_location_is_active))
            .setContentText(getString(R.string.foreground_location_service_notification_text, Formats.timeShort(Prefs.liveExpiresAt)))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(open)
            .addAction(R.drawable.ic_stop, getString(R.string.stop_sharing_btn), stop)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    companion object {
        private const val NOTIF_ID = 4201
        private const val HEARTBEAT_MS = 60_000L
        const val ACTION_STOP = "stop"
        const val ACTION_RESTART_UPDATES = "restart_updates"

        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, LiveLocationService::class.java))
        }

        fun stop(context: Context) {
            context.startService(Intent(context, LiveLocationService::class.java).setAction(ACTION_STOP))
        }

        fun restartUpdates(context: Context) {
            if (Prefs.isLiveActive) context.startService(Intent(context, LiveLocationService::class.java).setAction(ACTION_RESTART_UPDATES))
        }
    }
}
