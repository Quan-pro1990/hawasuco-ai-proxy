package com.hawasuco.savelocation.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.util.LocationHelper

/** Màn hình khởi động: lần đầu (chưa có quyền vị trí) → màn hình cấp quyền, ngược lại → màn hình chính. */
class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val next = if (!Prefs.onboardingDone && !LocationHelper.hasLocationPermission(this)) PermissionActivity::class.java
        else HomeActivity::class.java
        startActivity(Intent(this, next))
        finish()
    }
}
