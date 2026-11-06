package com.hawasuco.savelocation.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.databinding.ActivityOptimizeUsabilityBinding
import com.hawasuco.savelocation.util.openAppSettings

/** "Tối ưu vùng cảnh báo": danh sách kiểm tra + lối tắt tới cài đặt pin và thông báo. */
class OptimizeUsabilityActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val b = ActivityOptimizeUsabilityBinding.inflate(layoutInflater)
        setContentView(b.root)
        setTitle(R.string.optimize_usability)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        b.tvBatteryOptimizationSettings.setOnClickListener {
            runCatching { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
                .onFailure { openAppSettings() }
        }
        b.tvNotificationSettings.setOnClickListener {
            if (Build.VERSION.SDK_INT >= 26) {
                runCatching {
                    startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
                }.onFailure { openAppSettings() }
            } else openAppSettings()
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == android.R.id.home) { finish(); return true }
        return super.onOptionsItemSelected(item)
    }
}
