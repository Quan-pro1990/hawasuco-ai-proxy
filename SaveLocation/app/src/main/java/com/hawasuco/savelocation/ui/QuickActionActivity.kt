package com.hawasuco.savelocation.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.GeocoderHelper
import com.hawasuco.savelocation.util.LocationHelper
import com.hawasuco.savelocation.util.ShareUtil
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Màn hình trong suốt dùng cho widget và ô Cài đặt nhanh: lấy vị trí hiện tại rồi lưu ngay
 * (tên = địa chỉ hoặc thời gian) hoặc mở bảng chia sẻ.
 */
class QuickActionActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.init(this)
        val helper = LocationHelper(this)
        if (!helper.hasPermission()) {
            toast(R.string.location_permission_needed, long = true)
            startActivity(Intent(this, PermissionActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            finish(); return
        }
        toast(R.string.getting_location)
        lifecycleScope.launch {
            val l = helper.getCurrentLocation(20000)
            if (l == null) { toast(R.string.location_unavailable); finish(); return@launch }
            val address = withTimeoutOrNull(8000) { GeocoderHelper.reverse(this@QuickActionActivity, l.latitude, l.longitude) }.orEmpty()
            when (intent.action) {
                ACTION_SHARE -> {
                    ShareUtil.share(this@QuickActionActivity, SavedLocation(latitude = l.latitude, longitude = l.longitude, address = address))
                    finish()
                }
                else -> {
                    val title = address.split(",").firstOrNull()?.trim()?.takeIf { it.isNotBlank() }
                        ?: getString(R.string.untitled_location, Formats.date(System.currentTimeMillis()))
                    withContext(Dispatchers.IO) {
                        Db.get(this@QuickActionActivity).insertLocation(
                            SavedLocation(latitude = l.latitude, longitude = l.longitude, title = title, address = address)
                        )
                    }
                    DataBus.notifyChanged()
                    toast(getString(R.string.location_saved) + " " + title, long = true)
                    finish()
                }
            }
        }
    }

    companion object {
        const val ACTION_SAVE = "com.hawasuco.savelocation.SAVE"
        const val ACTION_SHARE = "com.hawasuco.savelocation.SHARE"
    }
}
