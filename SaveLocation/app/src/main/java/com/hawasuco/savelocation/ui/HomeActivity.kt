package com.hawasuco.savelocation.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.ActionBarDrawerToggle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.GravityCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.DataBus
import com.hawasuco.savelocation.data.Db
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.ActivityHomeBinding
import com.hawasuco.savelocation.databinding.NavMenuItemBinding
import com.hawasuco.savelocation.ui.backup.BackupFragment
import com.hawasuco.savelocation.ui.dialogs.ContactUsDialog
import com.hawasuco.savelocation.ui.dialogs.SaveLocationDialog
import com.hawasuco.savelocation.ui.export.ExportFragment
import com.hawasuco.savelocation.ui.geofence.ManageGeofenceFragment
import com.hawasuco.savelocation.ui.groups.GroupListFragment
import com.hawasuco.savelocation.ui.home.HomeFragment
import com.hawasuco.savelocation.ui.list.LocationsListFragment
import com.hawasuco.savelocation.ui.settings.SettingsFragment
import com.hawasuco.savelocation.util.LinkParser
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Màn hình khung: thanh công cụ + menu trái (giống app gốc) và vùng nội dung thay đổi theo mục chọn.
 */
class HomeActivity : AppCompatActivity() {

    enum class Screen { HOME, SAVED, FAVOURITES, GEOFENCE, BACKUP, EXPORT, SETTINGS }

    private data class NavItem(val id: Int, val icon: Int, val title: Int)

    private lateinit var b: ActivityHomeBinding
    private lateinit var toggle: ActionBarDrawerToggle
    var currentScreen = Screen.HOME
        private set

    private val navItems = listOf(
        NavItem(NAV_HOME, R.drawable.ic_my_location, R.string.current_location),
        NavItem(NAV_SAVED, R.drawable.ic_list, R.string.saved_locations),
        NavItem(NAV_ADD, R.drawable.ic_add_circle, R.string.add_new_location),
        NavItem(NAV_GEOFENCE, R.drawable.ic_geofence, R.string.manage_geofence),
        NavItem(NAV_FAVOURITES, R.drawable.ic_favorite, R.string.favourites),
        NavItem(NAV_BACKUP, R.drawable.ic_backup, R.string.backup_restore),
        NavItem(NAV_EXPORT, R.drawable.ic_import_export, R.string.import_export_data),
        NavItem(NAV_SETTINGS, R.drawable.ic_settings, R.string.settings),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(b.root)
        setSupportActionBar(b.toolbar)

        toggle = ActionBarDrawerToggle(this, b.drawerLayout, b.toolbar, R.string.nav_open, R.string.nav_close)
        b.drawerLayout.addDrawerListener(toggle)
        toggle.syncState()
        toggle.setToolbarNavigationClickListener { onBackPressedDispatcher.onBackPressed() }

        b.navRecyclerView.layoutManager = LinearLayoutManager(this)
        b.navRecyclerView.adapter = NavAdapter()
        b.tvContactUs.setOnClickListener {
            closeDrawer()
            ContactUsDialog().show(supportFragmentManager, "contact")
        }

        supportFragmentManager.addOnBackStackChangedListener { updateNavIndicator() }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    b.drawerLayout.isDrawerOpen(GravityCompat.START) -> closeDrawer()
                    (currentFragment() as? BackHandler)?.onBackPressed() == true -> Unit
                    supportFragmentManager.backStackEntryCount > 0 -> supportFragmentManager.popBackStack()
                    currentScreen != Screen.HOME -> showScreen(Screen.HOME)
                    else -> finish()
                }
            }
        })

        if (savedInstanceState == null) {
            showScreen(Screen.HOME)
            handleIntent(intent)
        } else {
            currentScreen = Screen.entries[savedInstanceState.getInt("screen", 0)]
        }
        DataBus.observe(this) { refreshHeader() }
        refreshHeader()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt("screen", currentScreen.ordinal)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    /** Mở vị trí từ link chia sẻ (ACTION_SEND), geo:, hoặc yêu cầu nội bộ. */
    private fun handleIntent(intent: Intent?) {
        intent ?: return
        if (intent.hasExtra(EXTRA_LAT)) {
            val lat = intent.getDoubleExtra(EXTRA_LAT, 0.0)
            val lng = intent.getDoubleExtra(EXTRA_LNG, 0.0)
            showOnHome(lat, lng, intent.getStringExtra(EXTRA_NAME))
            intent.removeExtra(EXTRA_LAT)
            return
        }
        when (intent.getStringExtra(EXTRA_OPEN)) {
            OPEN_LIVE_STATUS -> {
                showScreen(Screen.HOME)
                b.root.post { (currentFragment() as? HomeFragment)?.openLiveStatus() }
                intent.removeExtra(EXTRA_OPEN)
                return
            }
            OPEN_GEOFENCE -> {
                showScreen(Screen.GEOFENCE); intent.removeExtra(EXTRA_OPEN); return
            }
        }
        val text = when (intent.action) {
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)
            Intent.ACTION_VIEW -> intent.dataString
            else -> null
        } ?: return
        intent.action = null
        lifecycleScope.launch {
            val parsed = LinkParser.parse(text)
            if (parsed == null) toast(R.string.msg_no_location_to_share)
            else showOnHome(parsed.lat, parsed.lng, parsed.name)
        }
    }

    private fun showOnHome(lat: Double, lng: Double, name: String?) {
        if (currentScreen != Screen.HOME) showScreen(Screen.HOME)
        supportFragmentManager.executePendingTransactions()
        (currentFragment() as? HomeFragment)?.showLocation(lat, lng, name)
            ?: b.root.post { (currentFragment() as? HomeFragment)?.showLocation(lat, lng, name) }
    }

    fun currentFragment(): Fragment? = supportFragmentManager.findFragmentById(R.id.content_frame)

    fun showScreen(screen: Screen) {
        supportFragmentManager.popBackStackImmediate(null, FragmentManager.POP_BACK_STACK_INCLUSIVE)
        val f: Fragment = when (screen) {
            Screen.HOME -> HomeFragment()
            Screen.SAVED -> if (Prefs.groupMode) GroupListFragment() else LocationsListFragment.newInstance(LocationsListFragment.MODE_ALL)
            Screen.FAVOURITES -> LocationsListFragment.newInstance(LocationsListFragment.MODE_FAVOURITES)
            Screen.GEOFENCE -> ManageGeofenceFragment()
            Screen.BACKUP -> BackupFragment()
            Screen.EXPORT -> ExportFragment()
            Screen.SETTINGS -> SettingsFragment()
        }
        currentScreen = screen
        supportFragmentManager.beginTransaction().replace(R.id.content_frame, f).commitAllowingStateLoss()
        b.navRecyclerView.adapter?.notifyDataSetChanged()
        updateNavIndicator()
    }

    /** Mở màn hình con (có nút quay lại), ví dụ danh sách vị trí của một nhóm. */
    fun push(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.content_frame, fragment)
            .addToBackStack(null)
            .commit()
    }

    private fun updateNavIndicator() {
        val sub = supportFragmentManager.backStackEntryCount > 0
        toggle.isDrawerIndicatorEnabled = !sub
        supportActionBar?.setDisplayHomeAsUpEnabled(sub)
        if (!sub) toggle.syncState()
    }

    fun closeDrawer() = b.drawerLayout.closeDrawer(GravityCompat.START)

    private fun refreshHeader() {
        lifecycleScope.launch {
            val n = withContext(Dispatchers.IO) { Db.get(this@HomeActivity).countLocations() }
            b.tvLocationCount.text = getString(R.string.nav_header_subtitle, n)
        }
    }

    private fun onNavClick(id: Int) {
        closeDrawer()
        b.drawerLayout.postDelayed({
            when (id) {
                NAV_HOME -> showScreen(Screen.HOME)
                NAV_SAVED -> showScreen(Screen.SAVED)
                NAV_ADD -> SaveLocationDialog.newAdd().show(supportFragmentManager, SaveLocationDialog.TAG)
                NAV_GEOFENCE -> showScreen(Screen.GEOFENCE)
                NAV_FAVOURITES -> showScreen(Screen.FAVOURITES)
                NAV_BACKUP -> showScreen(Screen.BACKUP)
                NAV_EXPORT -> showScreen(Screen.EXPORT)
                NAV_SETTINGS -> showScreen(Screen.SETTINGS)
            }
        }, 220)
    }

    private fun isNavSelected(id: Int): Boolean = when (id) {
        NAV_HOME -> currentScreen == Screen.HOME
        NAV_SAVED -> currentScreen == Screen.SAVED
        NAV_GEOFENCE -> currentScreen == Screen.GEOFENCE
        NAV_FAVOURITES -> currentScreen == Screen.FAVOURITES
        NAV_BACKUP -> currentScreen == Screen.BACKUP
        NAV_EXPORT -> currentScreen == Screen.EXPORT
        NAV_SETTINGS -> currentScreen == Screen.SETTINGS
        else -> false
    }

    private inner class NavAdapter : RecyclerView.Adapter<NavAdapter.VH>() {
        inner class VH(val v: NavMenuItemBinding) : RecyclerView.ViewHolder(v.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            VH(NavMenuItemBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount() = navItems.size

        override fun onBindViewHolder(h: VH, position: Int) {
            val item = navItems[position]
            h.v.ivNavIcon.setImageResource(item.icon)
            h.v.tvNavTitle.setText(item.title)
            h.v.root.isActivated = isNavSelected(item.id)
            h.v.tvNavTitle.paint.isFakeBoldText = isNavSelected(item.id)
            h.v.root.setOnClickListener { onNavClick(item.id) }
        }
    }

    /** Fragment xử lý nút Back riêng (vd thoát chế độ sửa). Trả về true nếu đã xử lý. */
    interface BackHandler {
        fun onBackPressed(): Boolean
    }

    companion object {
        private const val NAV_HOME = 10001
        private const val NAV_SAVED = 10002
        private const val NAV_ADD = 10003
        private const val NAV_GEOFENCE = 10004
        private const val NAV_FAVOURITES = 10005
        private const val NAV_BACKUP = 10006
        private const val NAV_EXPORT = 10008
        private const val NAV_SETTINGS = 10010

        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
        const val EXTRA_NAME = "name"
        const val EXTRA_OPEN = "open"
        const val OPEN_LIVE_STATUS = "live_status"
        const val OPEN_GEOFENCE = "geofence"

        fun showLocationIntent(context: Context, lat: Double, lng: Double, name: String?) =
            Intent(context, HomeActivity::class.java).apply {
                putExtra(EXTRA_LAT, lat); putExtra(EXTRA_LNG, lng); putExtra(EXTRA_NAME, name)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
    }
}
