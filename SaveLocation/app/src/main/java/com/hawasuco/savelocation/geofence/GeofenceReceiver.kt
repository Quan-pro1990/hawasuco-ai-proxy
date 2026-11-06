package com.hawasuco.savelocation.geofence

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import com.hawasuco.savelocation.App
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.ui.ShowOnMapActivity

/** Nhận sự kiện vào/rời vùng cảnh báo và hiện thông báo. */
class GeofenceReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Prefs.init(context)
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) return
        val transition = event.geofenceTransition
        if (transition != Geofence.GEOFENCE_TRANSITION_ENTER && transition != Geofence.GEOFENCE_TRANSITION_EXIT) return
        val ids = event.triggeringGeofences?.mapNotNull { it.requestId.toLongOrNull() } ?: return
        val pending = goAsync()
        Thread {
            try {
                val db = Db.get(context)
                ids.forEach { id ->
                    val loc = db.getLocation(id) ?: return@forEach
                    notify(context, id, loc.title, loc.geofenceRadius, transition == Geofence.GEOFENCE_TRANSITION_ENTER)
                }
            } finally {
                pending.finish()
            }
        }.start()
    }

    private fun notify(context: Context, id: Long, title: String, radius: Int, enter: Boolean) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val open = Intent(context, ShowOnMapActivity::class.java).putExtra(ShowOnMapActivity.EXTRA_ID, id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(context, id.toInt(), open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(context, App.CHANNEL_GEOFENCE)
            .setSmallIcon(R.drawable.ic_tile_save)
            .setContentTitle(context.getString(if (enter) R.string.geofence_enter_title else R.string.geofence_exit_title, title))
            .setContentText(context.getString(R.string.geofence_notification_text, radius))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify((id * 2 + if (enter) 0 else 1).toInt(), n) }
    }
}
