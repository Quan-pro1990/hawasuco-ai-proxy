package com.hawasuco.savelocation.ui.dialogs

import android.app.Activity
import android.content.Intent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.ui.CameraActivity
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Chụp ảnh (CameraActivity) hoặc chọn ảnh từ thư viện; kết quả là file đã lưu trong bộ nhớ ứng dụng.
 * Phải tạo trong phần khai báo thuộc tính của Fragment (trước onStart).
 */
class ImagePicker(private val fragment: Fragment, private val onPicked: (File) -> Unit) {

    private val camera = fragment.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val path = r.data?.getStringExtra(CameraActivity.EXTRA_PATH)
        if (r.resultCode == Activity.RESULT_OK && path != null) onPicked(File(path))
    }

    private val gallery = fragment.registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri ?: return@registerForActivityResult
        val ctx = fragment.context ?: return@registerForActivityResult
        fragment.lifecycleScope.launch {
            val f = withContext(Dispatchers.IO) { ImageStore.importFromUri(ctx, uri) }
            if (f != null) onPicked(f) else ctx.toast(R.string.msg_image_not_found)
        }
    }

    fun takePhoto() = camera.launch(Intent(fragment.requireContext(), CameraActivity::class.java))

    fun chooseFromGallery() = gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
}
