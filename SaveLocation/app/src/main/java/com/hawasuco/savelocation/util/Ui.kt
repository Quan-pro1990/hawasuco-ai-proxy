package com.hawasuco.savelocation.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import com.hawasuco.savelocation.R

fun Context.toast(res: Int, long: Boolean = false) =
    Toast.makeText(this, res, if (long) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()

fun Context.toast(text: String, long: Boolean = false) =
    Toast.makeText(this, text, if (long) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()

fun Context.toastCenter(res: Int) = Toast.makeText(this, res, Toast.LENGTH_SHORT).apply {
    @Suppress("DEPRECATION") setGravity(Gravity.CENTER, 0, 0)
}.show()

fun Context.dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

fun View.hideKeyboard() {
    (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(windowToken, 0)
}

fun View.visible(show: Boolean) {
    visibility = if (show) View.VISIBLE else View.GONE
}

/** Hộp thoại chọn một mục (giống các hộp thoại "Sắp xếp theo", "Đơn vị"... của app gốc). */
fun Context.singleChoice(title: Int, items: List<String>, checked: Int, onPick: (Int) -> Unit) {
    val adapter = ArrayAdapter(this, R.layout.item_single_choice, R.id.text, items)
    AlertDialog.Builder(this)
        .setTitle(title)
        .setSingleChoiceItems(adapter, checked) { d, which -> d.dismiss(); onPick(which) }
        .setNegativeButton(R.string.cancel, null)
        .show()
}

fun Context.confirm(title: Int?, message: String, positive: Int = R.string.yes, onYes: () -> Unit) {
    AlertDialog.Builder(this).apply {
        if (title != null) setTitle(title)
        setMessage(message)
        setPositiveButton(positive) { _, _ -> onYes() }
        setNegativeButton(R.string.cancel, null)
    }.show()
}

fun Context.openAppSettings() {
    startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

fun Context.isOnline(): Boolean {
    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
    val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
    return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
}

fun Context.openUrl(url: String) {
    runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}
