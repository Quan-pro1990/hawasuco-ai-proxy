package com.hawasuco.savelocation.ui

import android.content.Intent
import android.location.Address
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.hawasuco.savelocation.databinding.ActivitySearchBinding
import com.hawasuco.savelocation.databinding.ListSearchAddressItemBinding
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.GeocoderHelper
import com.hawasuco.savelocation.util.LinkParser
import com.hawasuco.savelocation.util.hideKeyboard
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Tìm địa điểm theo tên (Geocoder của Android). Cũng nhận dán tọa độ "vĩ độ, kinh độ" hoặc link bản đồ.
 * Chọn một kết quả → quay về màn hình chính và đặt ghim tại đó.
 */
class SearchActivity : AppCompatActivity() {
    private lateinit var b: ActivitySearchBinding
    private var results: List<Address> = emptyList()
    private var job: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivitySearchBinding.inflate(layoutInflater)
        setContentView(b.root)
        b.toolbar.setNavigationOnClickListener { finish() }
        b.rvResults.layoutManager = LinearLayoutManager(this)
        b.rvResults.adapter = Adapter()
        b.searchBar.requestFocus()
        b.searchBar.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?): Boolean {
                search(query.orEmpty(), immediate = true); b.searchBar.hideKeyboard(); return true
            }

            override fun onQueryTextChange(newText: String?): Boolean {
                search(newText.orEmpty(), immediate = false); return true
            }
        })
    }

    private fun search(q: String, immediate: Boolean) {
        job?.cancel()
        if (q.isBlank()) {
            results = emptyList(); render(); b.tvSearchGuidelineText.visible(true); return
        }
        job = lifecycleScope.launch {
            if (!immediate) delay(700)
            // Cho phép dán tọa độ hoặc link
            LinkParser.parseText(q)?.let { p ->
                finishWith(p.lat, p.lng, p.name ?: Coords.displayInline(this@SearchActivity, p.lat, p.lng), null); return@launch
            }
            b.tvSearchGuidelineText.visible(false)
            b.progressBar.visible(true)
            results = GeocoderHelper.search(this@SearchActivity, q)
            b.progressBar.visible(false)
            render()
        }
    }

    private fun render() {
        b.rvResults.adapter?.notifyDataSetChanged()
        b.tvNoResult.visible(results.isEmpty() && b.searchBar.query.isNotBlank() && b.progressBar.visibility != View.VISIBLE)
    }

    private fun finishWith(lat: Double, lng: Double, name: String?, address: String?) {
        setResult(RESULT_OK, Intent()
            .putExtra(EXTRA_LAT, lat).putExtra(EXTRA_LNG, lng)
            .putExtra(EXTRA_NAME, name).putExtra(EXTRA_ADDRESS, address))
        finish()
    }

    private inner class Adapter : RecyclerView.Adapter<Adapter.VH>() {
        inner class VH(val v: ListSearchAddressItemBinding) : RecyclerView.ViewHolder(v.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
            VH(ListSearchAddressItemBinding.inflate(LayoutInflater.from(parent.context), parent, false))

        override fun getItemCount() = results.size

        override fun onBindViewHolder(h: VH, position: Int) {
            val a = results[position]
            val name = GeocoderHelper.title(a)
            val addr = GeocoderHelper.formatAddress(a)
            h.v.tvName.text = name
            h.v.tvAddress.text = addr
            h.v.root.setOnClickListener { finishWith(a.latitude, a.longitude, name, addr) }
        }
    }

    companion object {
        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
        const val EXTRA_NAME = "name"
        const val EXTRA_ADDRESS = "address"
    }
}
