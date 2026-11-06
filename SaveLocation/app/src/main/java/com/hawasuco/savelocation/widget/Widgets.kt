package com.hawasuco.savelocation.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.ui.QuickActionActivity

/** Widget màn hình chính (giống 3 widget của app gốc): Lưu & Chia sẻ, chỉ Lưu, chỉ Chia sẻ. */
private fun actionIntent(context: Context, action: String): PendingIntent {
    val i = Intent(context, QuickActionActivity::class.java)
        .setAction(action)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    return PendingIntent.getActivity(context, action.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}

class SaveShareWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val v = RemoteViews(context.packageName, R.layout.widget_save_share)
        v.setOnClickPendingIntent(R.id.btn_save, actionIntent(context, QuickActionActivity.ACTION_SAVE))
        v.setOnClickPendingIntent(R.id.btn_share, actionIntent(context, QuickActionActivity.ACTION_SHARE))
        manager.updateAppWidget(ids, v)
    }
}

class SaveWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val v = RemoteViews(context.packageName, R.layout.widget_save)
        v.setOnClickPendingIntent(R.id.btn_save, actionIntent(context, QuickActionActivity.ACTION_SAVE))
        manager.updateAppWidget(ids, v)
    }
}

class ShareWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val v = RemoteViews(context.packageName, R.layout.widget_share)
        v.setOnClickPendingIntent(R.id.btn_share, actionIntent(context, QuickActionActivity.ACTION_SHARE))
        manager.updateAppWidget(ids, v)
    }
}
