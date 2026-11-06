package com.hawasuco.savelocation.data

import android.graphics.Color

/** Một vị trí đã lưu. Ảnh (tối đa 3) là đường dẫn file trong bộ nhớ riêng của ứng dụng. */
data class SavedLocation(
    var id: Long = 0,
    var latitude: Double = 0.0,
    var longitude: Double = 0.0,
    var title: String = "",
    var address: String = "",
    var contactNumber: String = "",
    var note: String = "",
    var dateMillis: Long = System.currentTimeMillis(),
    var groupId: String? = null,
    var favorite: Boolean = false,
    var geofence: Boolean = false,
    var geofenceRadius: Int = 100,
    var images: MutableList<String> = mutableListOf(),
) {
    /** Khoảng cách tới vị trí hiện tại (mét), chỉ dùng để hiển thị / sắp xếp. */
    @Transient
    var distanceMeters: Double? = null

    @Transient
    var selected: Boolean = false

    companion object {
        const val MAX_IMAGES = 3
    }
}

data class LocationGroup(
    var id: String,
    var name: String,
    var color: Int = Color.parseColor("#E53935"),
    var displayOrder: Int = 0,
    var createdAt: Long = System.currentTimeMillis(),
    var count: Int = 0,
) {
    companion object {
        /** Mã giả cho mục "Tất cả" trong danh sách nhóm. */
        const val ALL_ID = "__all__"
    }
}
