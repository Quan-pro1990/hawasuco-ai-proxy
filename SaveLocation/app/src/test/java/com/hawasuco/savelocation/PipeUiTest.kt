package com.hawasuco.savelocation

import android.Manifest
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Point
import android.location.Location
import android.location.LocationManager
import android.os.Looper
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import androidx.core.view.GravityCompat
import androidx.drawerlayout.widget.DrawerLayout
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.Fragment
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.android.material.button.MaterialButton
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.network.PipeDb
import com.hawasuco.savelocation.network.PipeOverlay
import com.hawasuco.savelocation.network.PipeStore
import com.hawasuco.savelocation.network.PipeSync
import com.hawasuco.savelocation.ui.HomeActivity
import com.hawasuco.savelocation.ui.home.HomeFragment
import com.hawasuco.savelocation.ui.network.NetworkFragment
import com.hawasuco.savelocation.ui.network.PipeInfoSheet
import com.hawasuco.savelocation.ui.network.PipeLayersSheet
import com.hawasuco.savelocation.ui.network.ScadaAccessDialog
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowLooper
import java.io.File
import java.time.Duration

/** Màn hình "Bản đồ mạng lưới" với dữ liệu đồng bộ từ máy chủ SCADA giả lập; lưu ảnh vào app/build/screenshots. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "vi-w400dp-h860dp-xhdpi")
class PipeUiTest {
    private val app = ApplicationProvider.getApplicationContext<App>()
    private val dir = File(System.getProperty("screenshot.dir") ?: "build/screenshots").apply { mkdirs() }
    private lateinit var fake: FakeScada

    @Before
    fun setUp() {
        Prefs.init(app)
        Prefs.introShown = true
        Prefs.featureAnnouncementShown = true
        Prefs.pipeSizeMode = false
        Prefs.pipesOnMaps = true
        shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        val lm = app.getSystemService(LocationManager::class.java)
        shadowOf(lm).setProviderEnabled(LocationManager.GPS_PROVIDER, true)
        shadowOf(lm).simulateLocation(Location(LocationManager.GPS_PROVIDER).apply {
            latitude = 9.7785; longitude = 105.4712; accuracy = 6f; time = System.currentTimeMillis()
        })
        PipeDb.get(app).clear()
        PipeStore.clearMemory()
        fake = FakeScada()
        Prefs.scadaUrl = fake.url
        Prefs.scadaCode = FakeScada.CODE
        val r = runBlocking { PipeSync.sync(app) }
        assertTrue(r.error, r.ok)
        Prefs.pipeLastCheck = System.currentTimeMillis()
    }

    @After
    fun tearDown() {
        fake.close()
        Prefs.scadaCode = ""
        Prefs.scadaUrl = Prefs.DEFAULT_SCADA_URL
        Prefs.pipeSizeMode = false
    }

    private fun idle(seconds: Long = 1) {
        ShadowLooper.idleMainLooper()
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(seconds))
        ShadowLooper.idleMainLooper()
    }

    /** Chờ việc chạy nền (Dispatchers.IO) xong rồi chạy tiếp hàng đợi luồng chính. */
    private fun waitUntil(maxMs: Long = 5000, cond: () -> Boolean) {
        val end = System.currentTimeMillis() + maxMs
        while (System.currentTimeMillis() < end) {
            idle()
            if (cond()) return
            Thread.sleep(50)
        }
        idle()
    }

    private fun shot(view: View, name: String) {
        val bmp = Bitmap.createBitmap(view.width.coerceAtLeast(1), view.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(Color.parseColor("#9E9E9E"))
        view.draw(c)
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun shotDialog(host: Fragment, tag: String, name: String, close: Boolean = true) {
        idle()
        val f = host.childFragmentManager.findFragmentByTag(tag) as DialogFragment
        val d = f.requireDialog()
        assertTrue("$tag not showing", d.isShowing)
        shot(d.window!!.decorView, name)
        if (close) { f.dismissAllowingStateLoss(); idle() }
    }

    private fun home(): HomeActivity {
        val c = Robolectric.buildActivity(HomeActivity::class.java).setup()
        idle(2)
        return c.get()
    }

    private fun MapView.pipeOverlay() = overlays.filterIsInstance<PipeOverlay>().single()

    @Test
    fun networkMapScreens() {
        val a = home()
        a.showScreen(HomeActivity.Screen.NETWORK)
        waitUntil { (a.currentFragment() as? NetworkFragment)?.view?.findViewById<View>(R.id.card_empty)?.visibility == View.GONE }
        val frag = a.currentFragment() as NetworkFragment
        val map = a.findViewById<MapView>(R.id.map)
        assertEquals(View.GONE, a.findViewById<View>(R.id.card_empty).visibility)
        // Bản đồ đã tự phóng tới mạng lưới
        assertTrue(map.zoomLevelDouble > 11)
        shot(a.window.decorView, "50_network_map")

        // Màu theo cỡ ống + chú giải
        a.findViewById<MaterialButton>(R.id.btn_pipe_size).performClick(); idle()
        assertTrue(Prefs.pipeSizeMode)
        assertEquals(View.VISIBLE, a.findViewById<View>(R.id.card_legend).visibility)
        shot(a.window.decorView, "51_network_pipe_size")

        // Bảng lớp đường ống
        a.findViewById<View>(R.id.btn_layers).performClick()
        shotDialog(frag, PipeLayersSheet.TAG, "52_pipe_layers")

        // Chạm vào ống D160 → thẻ thông tin (lấy từ máy chủ)
        val overlay = map.pipeOverlay()
        val target = PipeStore.snapshot()[0].features.first { it.title == "Ống HDPE D160" }
        val p = Point()
        val pt = target.parts[0]
        map.projection.toPixels(GeoPoint((pt[0] + pt[2]) / 2, (pt[1] + pt[3]) / 2), p) // giữa đoạn đầu (tránh nút nối)
        val hit = overlay.hitTest(p.x.toFloat() + 3, p.y.toFloat() + 3, map)
        assertNotNull(hit)
        assertEquals(target.id, hit!!.feature.id)
        val now = SystemClock.uptimeMillis()
        val ev = MotionEvent.obtain(now, now, MotionEvent.ACTION_UP, p.x.toFloat(), p.y.toFloat(), 0)
        assertTrue(overlay.onSingleTapConfirmed(ev, map))
        waitUntil {
            val s = frag.childFragmentManager.findFragmentByTag(PipeInfoSheet.TAG) as? DialogFragment
            s?.dialog?.findViewById<View>(R.id.loading)?.visibility == View.GONE
        }
        map.invalidate(); idle()
        shot(a.window.decorView, "53_network_selected")
        val sheet = frag.childFragmentManager.findFragmentByTag(PipeInfoSheet.TAG) as DialogFragment
        assertEquals(View.VISIBLE, sheet.requireDialog().findViewById<View>(R.id.table).visibility)
        shotDialog(frag, PipeInfoSheet.TAG, "54_pipe_info")
        assertEquals(null, overlay.selected) // bỏ chọn khi đóng thẻ

        // Hộp nhập mã truy cập
        ScadaAccessDialog().show(frag.childFragmentManager, ScadaAccessDialog.TAG)
        shotDialog(frag, ScadaAccessDialog.TAG, "55_scada_access")

        // Menu trái có mục "Bản đồ mạng lưới"
        a.findViewById<DrawerLayout>(R.id.drawer_layout).openDrawer(GravityCompat.START, false); idle()
        shot(a.window.decorView, "56_drawer_network")
        a.findViewById<DrawerLayout>(R.id.drawer_layout).closeDrawer(GravityCompat.START, false); idle()

        // Trang chủ: đường ống hiện dưới ghim vị trí
        Prefs.pipeSizeMode = false
        a.showScreen(HomeActivity.Screen.HOME); idle(3)
        val homeMap = (a.currentFragment() as HomeFragment).requireView().findViewById<MapView>(R.id.map)
        assertTrue(homeMap.pipeOverlay().isEnabled)
        homeMap.controller.setZoom(14.0); homeMap.controller.setCenter(GeoPoint(9.7785, 105.4712)); idle()
        shot(a.window.decorView, "57_home_with_pipes")

        // Tắt "Hiện đường ống trên các bản đồ khác"
        Prefs.pipesOnMaps = false
        PipeStore.notifyStyleChanged(); idle()
        assertTrue(!homeMap.pipeOverlay().isEnabled)
        Prefs.pipesOnMaps = true
    }

    /** Ảnh mạng lưới thật — chỉ chạy khi có biến môi trường SCADA_CODE (mã không ghi trong mã nguồn). */
    @Test
    fun liveNetworkScreenshot() {
        val code = System.getenv("SCADA_CODE").orEmpty()
        org.junit.Assume.assumeTrue(code.isNotBlank())
        Prefs.scadaUrl = System.getenv("SCADA_URL") ?: Prefs.DEFAULT_SCADA_URL
        Prefs.scadaCode = code
        val r = runBlocking { PipeSync.sync(app) }
        assertTrue(r.error, r.ok)
        Prefs.pipeLastCheck = System.currentTimeMillis()
        val a = home()
        a.showScreen(HomeActivity.Screen.NETWORK); idle(2)
        shot(a.window.decorView, "90_live_network")
        a.findViewById<MaterialButton>(R.id.btn_pipe_size).performClick(); idle()
        shot(a.window.decorView, "91_live_network_size")
        val map = a.findViewById<MapView>(R.id.map)
        map.controller.setZoom(15.0); map.controller.setCenter(GeoPoint(9.7845, 105.4706)); idle()
        shot(a.window.decorView, "92_live_network_zoom")
    }

    @Test
    fun emptyStateAsksForCode() {
        Prefs.scadaCode = ""
        PipeDb.get(app).clear()
        runBlocking { PipeStore.reload(app) }
        val a = home()
        a.showScreen(HomeActivity.Screen.NETWORK); idle(2)
        assertEquals(View.VISIBLE, a.findViewById<View>(R.id.card_empty).visibility)
        shot(a.window.decorView, "58_network_no_code")
        a.findViewById<View>(R.id.btn_enter_code).performClick(); idle()
        val frag = a.currentFragment() as NetworkFragment
        assertNotNull(frag.childFragmentManager.findFragmentByTag(ScadaAccessDialog.TAG))
    }
}
