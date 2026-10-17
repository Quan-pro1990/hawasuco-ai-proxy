package vn.hawasuco.hawamap

import android.app.Application
import vn.hawasuco.hawamap.cau.GiongNoi
import vn.hawasuco.hawamap.cau.TrungTam

class HawaMapApp : Application() {
    override fun onCreate() {
        super.onCreate()
        TrungTam.khoiTao(this)
        GiongNoi.khoiTao(this)
    }
}
