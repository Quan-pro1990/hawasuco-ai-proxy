package com.hawasuco.savelocation.util

import android.content.Context
import android.location.Address
import android.location.Geocoder
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import kotlin.coroutines.resume

/** Tra địa chỉ từ tọa độ và tìm địa điểm theo tên bằng Geocoder của Android (không cần khoá API). */
object GeocoderHelper {

    fun isAvailable(): Boolean = Geocoder.isPresent()

    suspend fun reverse(context: Context, lat: Double, lng: Double): String? {
        if (!Geocoder.isPresent()) return null
        val list = withTimeoutOrNull(10000) { fromLocation(context, lat, lng) } ?: return null
        return list.firstOrNull()?.let { formatAddress(it) }
    }

    suspend fun search(context: Context, query: String, max: Int = 10): List<Address> {
        if (!Geocoder.isPresent() || query.isBlank()) return emptyList()
        return withTimeoutOrNull(15000) {
            val g = Geocoder(context, Locale.getDefault())
            if (Build.VERSION.SDK_INT >= 33) {
                suspendCancellableCoroutine { cont ->
                    g.getFromLocationName(query, max, object : Geocoder.GeocodeListener {
                        override fun onGeocode(addresses: MutableList<Address>) {
                            if (cont.isActive) cont.resume(addresses)
                        }

                        override fun onError(errorMessage: String?) {
                            if (cont.isActive) cont.resume(emptyList())
                        }
                    })
                }
            } else {
                withContext(Dispatchers.IO) {
                    @Suppress("DEPRECATION")
                    runCatching { g.getFromLocationName(query, max) }.getOrNull() ?: emptyList()
                }
            }
        } ?: emptyList()
    }

    private suspend fun fromLocation(context: Context, lat: Double, lng: Double): List<Address> {
        val g = Geocoder(context, Locale.getDefault())
        return if (Build.VERSION.SDK_INT >= 33) {
            suspendCancellableCoroutine { cont ->
                g.getFromLocation(lat, lng, 1, object : Geocoder.GeocodeListener {
                    override fun onGeocode(addresses: MutableList<Address>) {
                        if (cont.isActive) cont.resume(addresses)
                    }

                    override fun onError(errorMessage: String?) {
                        if (cont.isActive) cont.resume(emptyList())
                    }
                })
            }
        } else {
            withContext(Dispatchers.IO) {
                @Suppress("DEPRECATION")
                runCatching { g.getFromLocation(lat, lng, 1) }.getOrNull() ?: emptyList()
            }
        }
    }

    fun formatAddress(a: Address): String {
        val lines = (0..a.maxAddressLineIndex).mapNotNull { a.getAddressLine(it) }
        if (lines.isNotEmpty()) return lines.joinToString(", ")
        return listOfNotNull(a.featureName, a.thoroughfare, a.subLocality, a.locality, a.adminArea, a.countryName)
            .distinct().joinToString(", ")
    }

    fun title(a: Address): String =
        a.featureName?.takeIf { it.isNotBlank() && it.any { ch -> ch.isLetter() } }
            ?: a.thoroughfare ?: a.locality ?: a.subAdminArea ?: a.adminArea ?: formatAddress(a)
}
