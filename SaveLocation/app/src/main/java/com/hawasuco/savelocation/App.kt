package com.hawasuco.savelocation

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.util.MapUtil

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        MapUtil.init(this)
        applyTheme(Prefs.theme)
        applyLanguage(Prefs.language)
        createChannels()
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_GEOFENCE, getString(R.string.channel_geofence), NotificationManager.IMPORTANCE_HIGH)
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_LIVE, getString(R.string.channel_live), NotificationManager.IMPORTANCE_LOW)
        )
    }

    companion object {
        const val CHANNEL_GEOFENCE = "geofence"
        const val CHANNEL_LIVE = "live_location"

        fun applyTheme(theme: Int) {
            AppCompatDelegate.setDefaultNightMode(
                when (theme) {
                    1 -> AppCompatDelegate.MODE_NIGHT_NO
                    2 -> AppCompatDelegate.MODE_NIGHT_YES
                    else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                }
            )
        }

        fun applyLanguage(tag: String) {
            AppCompatDelegate.setApplicationLocales(
                if (tag.isBlank()) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(tag)
            )
        }
    }
}
