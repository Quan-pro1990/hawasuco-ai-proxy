package com.hawasuco.savelocation

import android.os.Looper
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hawasuco.savelocation.ui.SearchActivity
import com.hawasuco.savelocation.util.MapUtil
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.robolectric.Robolectric
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

/** Hồi quy: di chuyển tới đúng điểm đang ở giữa không được làm bản đồ nhảy ra zoom nhỏ nhất. */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class MapUtilTest {
    private fun idle(ms: Long) = shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(ms))

    @Test
    fun moveAndFitKeepZoom() {
        val a = Robolectric.buildActivity(SearchActivity::class.java).setup().get()
        val map = MapView(a)
        a.setContentView(map)
        idle(300)
        MapUtil.setup(map, 16.0)
        val p = GeoPoint(9.78, 105.47)
        map.controller.setCenter(p)
        idle(300)

        MapUtil.fit(map, listOf(p, GeoPoint(9.78, 105.47)), 40)
        idle(2000)
        assertEquals(17.0, map.zoomLevelDouble, 0.01)
        assertEquals(105.47, map.mapCenter.longitude, 0.001)

        MapUtil.moveTo(map, p)
        idle(2000)
        assertEquals(17.0, map.zoomLevelDouble, 0.01)
        assertEquals(9.78, map.mapCenter.latitude, 0.001)

        val two = listOf(GeoPoint(9.78, 105.47), GeoPoint(10.04, 105.74))
        MapUtil.fit(map, two, 40)
        idle(2000)
        val z = map.zoomLevelDouble
        MapUtil.fit(map, two, 40) // lần 2: cùng tâm
        idle(2000)
        assertEquals(z, map.zoomLevelDouble, 0.05)
        assertEquals(105.605, map.mapCenter.longitude, 0.05)
    }
}
