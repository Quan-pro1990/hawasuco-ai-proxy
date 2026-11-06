package com.hawasuco.savelocation.data

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

/** Báo cho các màn hình biết dữ liệu (vị trí / nhóm / vùng cảnh báo / chia sẻ trực tiếp) đã thay đổi để tải lại. */
object DataBus {
    private val version = MutableStateFlow(0L)

    fun notifyChanged() {
        version.value = version.value + 1
    }

    /** Gọi [onChange] mỗi khi dữ liệu đổi (chỉ khi màn hình đang hiển thị). */
    fun observe(owner: LifecycleOwner, onChange: () -> Unit) {
        owner.lifecycleScope.launch {
            owner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                version.drop(1).collect { onChange() }
            }
        }
    }
}
