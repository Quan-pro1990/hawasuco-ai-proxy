package com.hawasuco.savelocation.util

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * Lấy vị trí: ưu tiên Fused Location (Google Play services), nếu máy không có thì dùng LocationManager.
 */
class LocationHelper(context: Context) {
    private val ctx = context.applicationContext
    private val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val hasPlay = isPlayServicesAvailable(ctx)
    private val fused by lazy { LocationServices.getFusedLocationProviderClient(ctx) }

    private var fusedCallback: LocationCallback? = null
    private var lmListener: LocationListener? = null

    fun hasPermission(): Boolean = hasLocationPermission(ctx)

    fun isLocationEnabled(): Boolean = LocationManagerCompat.isLocationEnabled(lm)

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(timeoutMs: Long = 15000): Location? {
        if (!hasPermission()) return null
        val fresh = withTimeoutOrNull(timeoutMs) {
            if (hasPlay) {
                suspendCancellableCoroutine { cont ->
                    val cts = CancellationTokenSource()
                    fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                        .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
                        .addOnFailureListener { if (cont.isActive) cont.resume(null) }
                    cont.invokeOnCancellation { cts.cancel() }
                }
            } else {
                singleUpdateFromManager()
            }
        }
        return fresh ?: getLastKnown()
    }

    @SuppressLint("MissingPermission")
    suspend fun getLastKnown(): Location? {
        if (!hasPermission()) return null
        if (hasPlay) {
            val l = suspendCancellableCoroutine<Location?> { cont ->
                fused.lastLocation
                    .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
                    .addOnFailureListener { if (cont.isActive) cont.resume(null) }
            }
            if (l != null) return l
        }
        return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
            .mapNotNull { p -> runCatching { lm.getLastKnownLocation(p) }.getOrNull() }
            .maxByOrNull { it.time }
    }

    @SuppressLint("MissingPermission")
    private suspend fun singleUpdateFromManager(): Location? = suspendCancellableCoroutine { cont ->
        val provider = when {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> null
        }
        if (provider == null) {
            cont.resume(null); return@suspendCancellableCoroutine
        }
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                lm.removeUpdates(this)
                if (cont.isActive) cont.resume(location)
            }

            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }
        lm.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
        cont.invokeOnCancellation { lm.removeUpdates(listener) }
    }

    /** Nhận cập nhật vị trí liên tục (trên luồng chính). */
    @SuppressLint("MissingPermission")
    fun startUpdates(intervalMs: Long, minDistanceM: Float = 0f, onLocation: (Location) -> Unit) {
        stopUpdates()
        if (!hasPermission()) return
        if (hasPlay) {
            val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
                .setMinUpdateIntervalMillis((intervalMs / 2).coerceAtLeast(1000))
                .setMinUpdateDistanceMeters(minDistanceM)
                .build()
            val cb = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    result.lastLocation?.let(onLocation)
                }
            }
            fusedCallback = cb
            fused.requestLocationUpdates(req, cb, Looper.getMainLooper())
        } else {
            val listener = LocationListener { onLocation(it) }
            lmListener = listener
            listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).forEach { p ->
                if (lm.isProviderEnabled(p)) lm.requestLocationUpdates(p, intervalMs, minDistanceM, listener, Looper.getMainLooper())
            }
        }
    }

    fun stopUpdates() {
        fusedCallback?.let { fused.removeLocationUpdates(it) }
        fusedCallback = null
        lmListener?.let { lm.removeUpdates(it) }
        lmListener = null
    }

    companion object {
        fun hasLocationPermission(ctx: Context): Boolean =
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

        fun hasBackgroundPermission(ctx: Context): Boolean =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
                ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED

        fun isPlayServicesAvailable(ctx: Context): Boolean = try {
            GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx) == ConnectionResult.SUCCESS
        } catch (_: Throwable) {
            false
        }

        val LOCATION_PERMISSIONS = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    }
}
