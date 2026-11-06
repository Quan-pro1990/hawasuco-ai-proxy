package com.hawasuco.savelocation.widget

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.hawasuco.savelocation.ui.QuickActionActivity

/** Ô "Lưu nhanh" trong Cài đặt nhanh (kéo thanh thông báo xuống): lưu vị trí hiện tại bằng một chạm. */
class QuickSaveTileService : TileService() {

    override fun onStartListening() {
        qsTile?.apply { state = Tile.STATE_INACTIVE; updateTile() }
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    override fun onClick() {
        val intent = Intent(this, QuickActionActivity::class.java)
            .setAction(QuickActionActivity.ACTION_SAVE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 7, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
