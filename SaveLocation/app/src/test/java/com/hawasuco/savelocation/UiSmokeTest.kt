package com.hawasuco.savelocation

import android.Manifest
import android.app.Activity
import android.app.Dialog
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.location.Location
import android.location.LocationManager
import android.os.Looper
import android.view.View
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.FragmentActivity
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.ui.ChangeLocationActivity
import com.hawasuco.savelocation.ui.ContactFormActivity
import com.hawasuco.savelocation.ui.HomeActivity
import com.hawasuco.savelocation.ui.ImportCsvActivity
import com.hawasuco.savelocation.ui.OptimizeUsabilityActivity
import com.hawasuco.savelocation.ui.PermissionActivity
import com.hawasuco.savelocation.ui.SearchActivity
import com.hawasuco.savelocation.ui.ShowOnMapActivity
import com.hawasuco.savelocation.ui.dialogs.AddEditGroupSheet
import com.hawasuco.savelocation.ui.dialogs.ContactUsDialog
import com.hawasuco.savelocation.ui.dialogs.FeatureAnnouncementDialog
import com.hawasuco.savelocation.ui.dialogs.ImageUploadDialog
import com.hawasuco.savelocation.ui.dialogs.SaveLocationDialog
import com.hawasuco.savelocation.ui.dialogs.SelectGroupSheet
import com.hawasuco.savelocation.ui.list.LocationsListFragment
import com.hawasuco.savelocation.ui.live.LiveStatusSheet
import com.hawasuco.savelocation.ui.live.LiveUpdateSettingsDialog
import com.hawasuco.savelocation.ui.live.ShareLocationSheet
import com.hawasuco.savelocation.util.MapUtil
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowLooper
import java.io.File
import java.time.Duration

/**
 * Chạy thật từng màn hình / hộp thoại trên Robolectric để bắt lỗi khi chạy (inflate layout, null...)
 * và lưu ảnh chụp giao diện vào app/build/screenshots.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "vi-w400dp-h860dp-xhdpi")
class UiSmokeTest {
    private val app = ApplicationProvider.getApplicationContext<App>()
    private val dir = File(System.getProperty("screenshot.dir") ?: "build/screenshots").apply { mkdirs() }

    @Before
    fun setUp() {
        Prefs.init(app)
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        val lm = app.getSystemService(LocationManager::class.java)
        shadowOf(lm).setProviderEnabled(LocationManager.GPS_PROVIDER, true)
        shadowOf(lm).setLocationEnabled(true)
        shadowOf(lm).simulateLocation(Location(LocationManager.GPS_PROVIDER).apply {
            latitude = 9.784167; longitude = 105.470833; accuracy = 6f; time = System.currentTimeMillis()
        })
        seed()
    }

    private fun seed() {
        val db = Db.get(app)
        if (db.countLocations() > 0) return
        val g1 = LocationGroup("g1", "Đồng hồ tổng", Color.parseColor("#1E88E5"))
        val g2 = LocationGroup("g2", "Khách hàng", Color.parseColor("#43A047"))
        db.insertGroup(g1); db.insertGroup(g2)
        db.insertLocation(SavedLocation(latitude = 9.784167, longitude = 105.470833, title = "Trạm cấp nước Vị Thanh",
            address = "Đường Trần Hưng Đạo, Phường 5, Vị Thanh, Hậu Giang", contactNumber = "0293 3870 000",
            note = "Cổng chính, có bảo vệ", groupId = "g1", favorite = true))
        db.insertLocation(SavedLocation(latitude = 9.9300, longitude = 105.7000, title = "TLK Ngã Bảy",
            address = "Ngã Bảy, Hậu Giang", groupId = "g1"))
        db.insertLocation(SavedLocation(latitude = 10.0452, longitude = 105.7469, title = "Nhà khách hàng A",
            address = "Ninh Kiều, Cần Thơ", note = "Gọi trước khi đến", groupId = "g2", dateMillis = System.currentTimeMillis() - 86400000L))
    }

    private fun idle(seconds: Long = 1) {
        ShadowLooper.idleMainLooper()
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(seconds))
        ShadowLooper.idleMainLooper()
    }

    private fun shot(view: View, name: String) {
        if (view.width == 0 || view.height == 0) {
            val dm = view.resources.displayMetrics
            view.measure(View.MeasureSpec.makeMeasureSpec(dm.widthPixels, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(dm.heightPixels, View.MeasureSpec.AT_MOST))
            view.layout(0, 0, view.measuredWidth, view.measuredHeight)
        }
        val bmp = Bitmap.createBitmap(view.width.coerceAtLeast(1), view.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(Color.parseColor("#9E9E9E"))
        view.draw(c)
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun shotActivity(a: Activity, name: String) = shot(a.window.decorView, name)

    private fun shotDialog(a: FragmentActivity, tag: String, name: String) {
        idle()
        val f = a.supportFragmentManager.findFragmentByTag(tag) as DialogFragment
        val d: Dialog = f.requireDialog()
        assertTrue("$tag not showing", d.isShowing)
        shot(d.window!!.decorView, name)
        f.dismissAllowingStateLoss()
        idle()
    }

    private fun home(): HomeActivity {
        val c = Robolectric.buildActivity(HomeActivity::class.java).setup()
        idle(2)
        return c.get()
    }

    @Test
    fun homeAndDrawer() {
        Prefs.introShown = false
        val a = home()
        shotActivity(a, "01_home_intro")
        a.findViewById<View>(R.id.btn_got_it).performClick()
        idle()
        // Không mở thông báo tính năng mới trong ảnh chụp
        (a.supportFragmentManager.fragments.firstOrNull()?.childFragmentManager?.findFragmentByTag("feature") as? DialogFragment)?.dismissAllowingStateLoss()
        idle(3)
        shotActivity(a, "02_home")
        a.findViewById<DrawerLayout>(R.id.drawer_layout).openDrawer(GravityCompat.START, false)
        idle()
        shotActivity(a, "03_drawer")
    }

    @Test
    fun screens() {
        Prefs.introShown = true
        Prefs.featureAnnouncementShown = true
        val a = home()
        Prefs.groupMode = true
        a.showScreen(HomeActivity.Screen.SAVED); idle(2); shotActivity(a, "04_groups")
        a.push(LocationsListFragment.newInstance(LocationsListFragment.MODE_GROUP, "g1", "Đồng hồ tổng")); idle(2)
        shotActivity(a, "05_group_locations")
        Prefs.groupMode = false
        a.showScreen(HomeActivity.Screen.SAVED); idle(2); shotActivity(a, "06_saved_list")
        a.findViewById<View>(R.id.rb_map).performClick(); idle(2); shotActivity(a, "07_saved_map")
        a.findViewById<View>(R.id.rb_list).performClick(); idle()
        a.findViewById<View>(R.id.iv_edit).performClick(); idle(); shotActivity(a, "08_saved_edit_mode")
        a.showScreen(HomeActivity.Screen.FAVOURITES); idle(2); shotActivity(a, "09_favourites")
        a.showScreen(HomeActivity.Screen.GEOFENCE); idle(2); shotActivity(a, "10_geofence")
        a.showScreen(HomeActivity.Screen.BACKUP); idle(); shotActivity(a, "11_backup")
        a.showScreen(HomeActivity.Screen.EXPORT); idle(); shotActivity(a, "12_import_export")
        a.showScreen(HomeActivity.Screen.SETTINGS); idle(); shotActivity(a, "13_settings")
        Prefs.groupMode = true
    }

    @Test
    fun dialogs() {
        Prefs.introShown = true
        Prefs.featureAnnouncementShown = true
        Prefs.groupMode = true
        val a = home()
        val fm = a.supportFragmentManager
        SaveLocationDialog.newFromMap(9.784167, 105.470833, "Vị Thanh, Hậu Giang", null).show(fm, "d1")
        shotDialog(a, "d1", "20_save_location")
        SaveLocationDialog.newAdd().show(fm, "d2")
        shotDialog(a, "d2", "21_add_new_location")
        SaveLocationDialog.newEdit(1).show(fm, "d3")
        shotDialog(a, "d3", "22_edit_location")
        SelectGroupSheet.newInstance("g1").show(fm, "d4"); shotDialog(a, "d4", "23_select_group")
        AddEditGroupSheet.newInstance(null).show(fm, "d5"); shotDialog(a, "d5", "24_add_group")
        ImageUploadDialog.newInstance(arrayListOf()).show(fm, "d6"); shotDialog(a, "d6", "25_images")
        ShareLocationSheet.newInstance(9.784167, 105.470833, "Vị Thanh, Hậu Giang", null, live = false).show(fm, "d7")
        shotDialog(a, "d7", "26_share_current")
        ShareLocationSheet.newInstance(9.784167, 105.470833, "Vị Thanh, Hậu Giang", null, live = true).show(fm, "d8")
        shotDialog(a, "d8", "27_share_live")
        Prefs.liveSessionId = "abc123"; Prefs.liveToken = "t"; Prefs.liveServerUrl = "https://vitri.example.vn"
        Prefs.liveStartedAt = System.currentTimeMillis(); Prefs.liveExpiresAt = System.currentTimeMillis() + 3600_000
        LiveStatusSheet().show(fm, "d9"); shotDialog(a, "d9", "28_live_status")
        LiveUpdateSettingsDialog().show(fm, "d10"); shotDialog(a, "d10", "29_live_update_settings")
        Prefs.clearLiveSession(); Prefs.liveServerUrl = ""
        ContactUsDialog().show(fm, "d11"); shotDialog(a, "d11", "30_contact_us")
        FeatureAnnouncementDialog().show(fm, "d12"); shotDialog(a, "d12", "31_feature_live")
        MapUtil.showTypeChooser(a) {}; idle()
        val d = org.robolectric.shadows.ShadowDialog.getLatestDialog()
        shot(d.window!!.decorView, "32_map_type"); d.dismiss()
    }

    @Test
    fun otherActivities() {
        fun <T : Activity> run(cls: Class<T>, intent: Intent?, name: String) {
            val c = (if (intent != null) Robolectric.buildActivity(cls, intent) else Robolectric.buildActivity(cls)).setup()
            idle(2)
            shotActivity(c.get(), name)
            c.pause().stop().destroy()
        }
        run(ShowOnMapActivity::class.java, Intent(app, ShowOnMapActivity::class.java).putExtra(ShowOnMapActivity.EXTRA_ID, 1L), "40_show_on_map")
        run(ChangeLocationActivity::class.java, Intent(app, ChangeLocationActivity::class.java)
            .putExtra(ChangeLocationActivity.EXTRA_LAT, 9.784167).putExtra(ChangeLocationActivity.EXTRA_LNG, 105.470833), "41_change_location")
        run(SearchActivity::class.java, null, "42_search")
        run(PermissionActivity::class.java, null, "43_permission")
        run(ImportCsvActivity::class.java, null, "44_import_csv")
        run(OptimizeUsabilityActivity::class.java, null, "45_optimize_geofence")
        run(ContactFormActivity::class.java, Intent(app, ContactFormActivity::class.java).putExtra(ContactFormActivity.EXTRA_TOPIC, "Báo lỗi"), "46_contact_form")
    }
}
