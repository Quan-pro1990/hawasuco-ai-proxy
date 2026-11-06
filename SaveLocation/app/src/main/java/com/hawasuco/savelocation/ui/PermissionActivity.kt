package com.hawasuco.savelocation.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.ActivityPermissionBinding
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.openAppSettings

/**
 * Màn hình giới thiệu lần đầu: thẻ "Quyền truy cập vị trí" và "Dịch vụ định vị" với trạng thái,
 * nút Bắt đầu lần lượt xin quyền và bật GPS rồi vào màn hình chính.
 */
class PermissionActivity : AppCompatActivity() {
    private lateinit var b: ActivityPermissionBinding
    private lateinit var helper: LocationHelper

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        updateStatus()
        if (res.values.any { it }) next()
        else AlertDialog.Builder(this)
            .setMessage(R.string.msg_permission_denied_settings)
            .setPositiveButton(R.string.open_settings) { _, _ -> openAppSettings() }
            .setNegativeButton(R.string.skip) { _, _ -> goHome() }
            .show()
    }

    private val gpsLauncher = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) {
        updateStatus(); next()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityPermissionBinding.inflate(layoutInflater)
        setContentView(b.root)
        helper = LocationHelper(this)
        b.btnContinue.setOnClickListener { next() }
        b.cardLocation.setOnClickListener { if (!helper.hasPermission()) permLauncher.launch(LocationHelper.LOCATION_PERMISSIONS) }
        b.cardGps.setOnClickListener { if (!helper.isLocationEnabled()) enableGps() }
        b.tvSkip.setOnClickListener { goHome() }
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun updateStatus() {
        val perm = helper.hasPermission()
        val gps = helper.isLocationEnabled()
        listOf(b.ivStatusLocation to perm, b.ivStatusGps to gps).forEach { (iv, ok) ->
            iv.setImageResource(if (ok) R.drawable.ic_check_circle else R.drawable.ic_circle_outline)
            iv.setColorFilter(getColor(if (ok) R.color.live_green else R.color.text_secondary))
        }
        b.tvContinue.setText(if (perm || gps) R.string.btn_continue else R.string.btn_start)
    }

    private fun next() {
        when {
            !helper.hasPermission() -> permLauncher.launch(LocationHelper.LOCATION_PERMISSIONS)
            !helper.isLocationEnabled() -> enableGps()
            else -> goHome()
        }
    }

    private fun enableGps() {
        if (!LocationHelper.isPlayServicesAvailable(this)) {
            runCatching { startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)) }; return
        }
        val req = LocationSettingsRequest.Builder()
            .addLocationRequest(LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000).build())
            .setAlwaysShow(true).build()
        LocationServices.getSettingsClient(this).checkLocationSettings(req)
            .addOnSuccessListener { updateStatus(); goHome() }
            .addOnFailureListener { e ->
                if (e is ResolvableApiException) gpsLauncher.launch(IntentSenderRequest.Builder(e.resolution).build())
                else runCatching { startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)) }
            }
    }

    private fun goHome() {
        Prefs.onboardingDone = true
        startActivity(Intent(this, HomeActivity::class.java))
        finish()
    }
}
