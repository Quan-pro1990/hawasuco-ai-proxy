package com.hawasuco.savelocation.geofence

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.hawasuco.savelocation.data.Prefs

/** Sau khi khởi động lại máy / cập nhật ứng dụng: đăng ký lại vùng cảnh báo. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in ACTIONS) return
        Prefs.init(context)
        val pending = goAsync()
        Thread {
            try {
                GeofenceManager.registerAll(context)
                Thread.sleep(3000) // chờ Play services xử lý
            } catch (_: Exception) {
            } finally {
                pending.finish()
            }
        }.start()
    }

    companion object {
        private val ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, "android.intent.action.QUICKBOOT_POWERON",
        )
    }
}
