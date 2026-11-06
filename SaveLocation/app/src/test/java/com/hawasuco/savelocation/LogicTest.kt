package com.hawasuco.savelocation

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.Exporter
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.LinkParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class LogicTest {
    private val ctx = ApplicationProvider.getApplicationContext<App>()

    @Test
    fun utmMatchesReferenceValues() {
        // Giá trị tham chiếu tính bằng pyproj (WGS84)
        data class R(val lat: Double, val lon: Double, val zone: String, val e: Double, val n: Double)
        listOf(
            R(10.776889, 106.700806, "48P", 685966.49, 1191826.35),
            R(21.028511, 105.804817, "48Q", 583629.84, 2325513.81),
            R(-33.8688, 151.2093, "56H", 334368.63, 6250948.35),
            R(51.5074, -0.1278, "30U", 699316.23, 5710163.76),
            R(9.784167, 105.470833, "48P", 551635.42, 1081585.44),
        ).forEach { r ->
            val u = Coords.toUtm(r.lat, r.lon)
            assertEquals(r.zone, u.zoneText)
            assertEquals(r.e, u.easting, 0.5)
            assertEquals(r.n, u.northing, 0.5)
        }
    }

    @Test
    fun dmsAndDdm() {
        assertEquals("10°46′36.80″ N", Coords.dms(ctx, 10.776889, true))
        assertEquals("106°42′02.90″ E", Coords.dms(ctx, 106.700806, false))
        assertEquals("33°52′07.68″ S", Coords.dms(ctx, -33.8688, true))
        assertEquals("10°46.6133′ N", Coords.ddm(ctx, 10.776889, true))
        assertEquals(10.776889, Coords.fromDms(10.0, 46.0, 36.8, false), 1e-5)
        assertEquals(-33.8688, Coords.fromDms(33.0, 52.0, 7.68, true), 1e-5)
    }

    @Test
    fun linkParser() {
        fun p(s: String) = LinkParser.parseText(s)
        assertEquals(10.7769, p("https://www.google.com/maps/place/Ben+Thanh/@10.7769,106.7009,17z")!!.lat, 1e-6)
        assertEquals(106.7009, p("https://maps.google.com/maps?q=10.7769,106.7009")!!.lng, 1e-6)
        assertEquals(21.0285, p("geo:21.0285,105.8048?q=21.0285,105.8048(Ha Noi)")!!.lat, 1e-6)
        assertEquals("Ha Noi", p("geo:21.0285,105.8048?q=21.0285,105.8048(Ha Noi)")!!.name)
        assertEquals(105.8048, p("https://www.openstreetmap.org/?mlat=21.0285&mlon=105.8048#map=17/21.0285/105.8048")!!.lng, 1e-6)
        assertEquals(9.7841, p("Vị trí: 9.7841, 105.4708 gần cầu")!!.lat, 1e-6)
        assertEquals(-33.8688, p("https://waze.com/ul?ll=-33.8688,151.2093&navigate=yes")!!.lat, 1e-6)
        assertNull(p("hello world"))
        assertNull(p("call 0901234567"))
    }

    @Test
    fun csvParseAndImport() {
        val rows = Exporter.parseCsv("a,\"b, c\",\"d \"\"q\"\"\"\r\nx,y,z\n")
        assertEquals(listOf("a", "b, c", "d \"q\""), rows[0])
        assertEquals(listOf("x", "y", "z"), rows[1])
        val semi = Exporter.parseCsv("tên;vĩ độ;kinh độ\nA;10,5;106,1\n")
        assertEquals(listOf("A", "10,5", "106,1"), semi[1])

        Prefs.init(ctx)
        val before = Db.get(ctx).countLocations()
        val groupsBefore = Db.get(ctx).getGroups().size
        val csv = Exporter.sampleCsv() +
            "Bad lat,95,106,,,,,\r\n" +
            ",10,106,,,,,\r\n" +
            "Bad date,10,106,,,,31-31-2020,\r\n"
        val r = Exporter.importCsv(ctx, csv)
        assertEquals(4, r.imported) // 3 dòng mẫu + "Bad date" (dùng giờ hiện tại)
        assertEquals(3, r.errors.size)
        val db = Db.get(ctx)
        assertEquals(before + 4, db.countLocations())
        // Nhóm trùng tên không bị tạo lại
        assertTrue(db.getGroups().size <= groupsBefore + 2)
        val groups = db.getGroups().map { it.name }.toSet()
        assertTrue(groups.containsAll(listOf("Family", "Work")))
        val home = db.getLocations().last { it.title == "Home" }
        assertEquals("1 Le Duan, Ben Nghe, District 1, Ho Chi Minh City", home.address)
        assertEquals("2024-01-15 08:30:00", Formats.isoDate(home.dateMillis))

        // Xuất lại CSV rồi đọc lại phải ra đúng các trường
        val out = Exporter.csvText(ctx, db.getLocations(), db.getGroups().associateBy { it.id })
        val back = Exporter.parseCsv(out)
        assertEquals(Exporter.CSV_HEADER, back[0])
        assertNotNull(back.firstOrNull { it[0] == "Home" && it[7] == "Family" })
    }

    @Test
    fun gpxKmlContainPoints() {
        Prefs.init(ctx)
        Exporter.importCsv(ctx, Exporter.sampleCsv())
        val list = Db.get(ctx).getLocations()
        val gpx = Exporter.gpxText(ctx, list)
        assertTrue(gpx.contains("<wpt lat=\"10.776889\" lon=\"106.700806\">"))
        val kml = Exporter.kmlText(ctx, list, emptyMap())
        assertTrue(kml.contains("<coordinates>106.700806,10.776889,0</coordinates>"))
    }
}
