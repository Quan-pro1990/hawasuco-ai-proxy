package com.hawasuco.savelocation.geofence

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.util.LocationHelper

/**
 * Đăng ký vùng cảnh báo với Google Play services (tối đa 100 vị trí).
 * Mỗi vị trí có bán kính riêng; báo khi vào và rời vùng.
 */
object GeofenceManager {
    const val MAX_GEOFENCES = 100

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, GeofenceReceiver::class.java)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
        return PendingIntent.getBroadcast(context, 0, intent, flags)
    }

    /** Đăng ký lại toàn bộ vùng từ CSDL (gọi sau khi thêm/sửa/xoá, khi khởi động máy...). Chạy được trên luồng nền. */
    @SuppressLint("MissingPermission")
    fun registerAll(context: Context) {
        val ctx = context.applicationContext
        if (!LocationHelper.isPlayServicesAvailable(ctx)) return
        val client = LocationServices.getGeofencingClient(ctx)
        val pi = pendingIntent(ctx)
        val list = Db.get(ctx).getLocations(geofenceOnly = true).take(MAX_GEOFENCES)
        client.removeGeofences(pi).addOnCompleteListener {
            if (list.isEmpty() || !LocationHelper.hasLocationPermission(ctx)) return@addOnCompleteListener
            if (!LocationHelper.hasBackgroundPermission(ctx)) return@addOnCompleteListener
            val fences = list.map {
                Geofence.Builder()
                    .setRequestId(it.id.toString())
                    .setCircularRegion(it.latitude, it.longitude, it.geofenceRadius.toFloat().coerceAtLeast(50f))
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                    .build()
            }
            val req = GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                .addGeofences(fences)
                .build()
            runCatching { client.addGeofences(req, pi) }
        }
    }
}
