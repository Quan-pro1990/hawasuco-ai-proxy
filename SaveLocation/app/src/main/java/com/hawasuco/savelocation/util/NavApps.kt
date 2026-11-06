package com.hawasuco.savelocation.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.DialogSelectMapBinding

/** Mở ứng dụng dẫn đường: Google Maps, Waze, HERE WeGo, Sygic (giống hộp thoại chọn bản đồ của app gốc). */
object NavApps {
    const val GOOGLE = 0
    const val WAZE = 1
    const val HERE = 2
    const val SYGIC = 3

    private val PACKAGES = mapOf(
        GOOGLE to "com.google.android.apps.maps",
        WAZE to "com.waze",
        HERE to "com.here.app.maps",
        SYGIC to "com.sygic.aura",
    )

    fun isInstalled(context: Context, app: Int): Boolean {
        val pkg = PACKAGES[app] ?: return false
        return try {
            if (Build.VERSION.SDK_INT >= 33) context.packageManager.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
            else @Suppress("DEPRECATION") context.packageManager.getPackageInfo(pkg, 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun installedApps(context: Context): List<Int> = listOf(GOOGLE, WAZE, HERE, SYGIC).filter { isInstalled(context, it) }

    fun label(context: Context, app: Int): String = context.getString(
        when (app) {
            GOOGLE -> R.string.google_maps
            WAZE -> R.string.waze
            HERE -> R.string.here_map
            SYGIC -> R.string.sygic_map
            else -> R.string.ask_every_time
        }
    )

    /** Chỉ đường tới (lat, lng): dùng app mặc định nếu đã chọn, ngược lại hiện hộp thoại chọn. */
    fun navigate(context: Context, lat: Double, lng: Double, title: String?) {
        val def = Prefs.navigationApp
        if (def >= 0 && isInstalled(context, def)) {
            open(context, def, lat, lng, title); return
        }
        showChooser(context, lat, lng, title)
    }

    fun showChooser(context: Context, lat: Double, lng: Double, title: String?) {
        val b = DialogSelectMapBinding.inflate(LayoutInflater.from(context))
        val dialog = AlertDialog.Builder(context).setView(b.root).create()
        b.llTitle.visibility = View.VISIBLE
        val rows = mapOf(GOOGLE to b.llGoogleMap, WAZE to b.llWaze, HERE to b.llHereMap, SYGIC to b.llSygicMap)
        rows.forEach { (app, row) ->
            row.visibility = if (app == GOOGLE || isInstalled(context, app)) View.VISIBLE else View.GONE
            row.setOnClickListener { dialog.dismiss(); open(context, app, lat, lng, title) }
        }
        b.lineWaze.visibility = b.llWaze.visibility
        b.lineHereMap.visibility = b.llHereMap.visibility
        b.lineSygic.visibility = b.llSygicMap.visibility
        b.llOther.setOnClickListener { dialog.dismiss(); openGeo(context, lat, lng, title) }
        dialog.show()
    }

    fun open(context: Context, app: Int, lat: Double, lng: Double, title: String?) {
        val la = Coords.dd(lat)
        val lo = Coords.dd(lng)
        val uri = when (app) {
            GOOGLE -> if (isInstalled(context, GOOGLE)) "google.navigation:q=$la,$lo"
            else "https://www.google.com/maps/dir/?api=1&destination=$la,$lo"
            WAZE -> "https://waze.com/ul?ll=$la,$lo&navigate=yes"
            HERE -> "here.directions://v1.0/mylocation/$la,$lo"
            SYGIC -> "com.sygic.aura://coordinate|$lo|$la|drive"
            else -> "geo:$la,$lo?q=$la,$lo"
        }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        if (app in PACKAGES && isInstalled(context, app)) intent.setPackage(PACKAGES[app])
        try {
            context.startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            openGeo(context, lat, lng, title)
        }
    }

    fun openGeo(context: Context, lat: Double, lng: Double, title: String?) {
        val la = Coords.dd(lat)
        val lo = Coords.dd(lng)
        val label = Uri.encode(title?.ifBlank { null } ?: "$la,$lo")
        try {
            context.startActivity(Intent.createChooser(
                Intent(Intent.ACTION_VIEW, Uri.parse("geo:$la,$lo?q=$la,$lo($label)")),
                context.getString(R.string.select_navigation_app)))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(context, R.string.no_navigation_app, Toast.LENGTH_SHORT).show()
        }
    }
}
