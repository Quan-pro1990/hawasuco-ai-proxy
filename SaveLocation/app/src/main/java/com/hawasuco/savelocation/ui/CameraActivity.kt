package com.hawasuco.savelocation.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.databinding.ActivityCameraBinding
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** Chụp ảnh vị trí bằng CameraX (nút chụp, đổi camera trước/sau, Hủy). Trả về đường dẫn file ảnh. */
class CameraActivity : AppCompatActivity() {
    private lateinit var b: ActivityCameraBinding
    private var capture: ImageCapture? = null
    private var lensFacing = CameraSelector.LENS_FACING_BACK

    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) startCamera() else { toast(R.string.camera_permission_required); finish() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityCameraBinding.inflate(layoutInflater)
        setContentView(b.root)
        b.tvCancel.setOnClickListener { finish() }
        b.imgCapture.setOnClickListener { takePhoto() }
        b.imgFlipCamera.setOnClickListener {
            lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
            startCamera()
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera()
        else permission.launch(Manifest.permission.CAMERA)
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val preview = Preview.Builder().build().also { it.surfaceProvider = b.viewFinder.surfaceProvider }
            capture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build()
            val selector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
            runCatching {
                provider.unbindAll()
                provider.bindToLifecycle(this, selector, preview, capture)
            }.onFailure {
                if (lensFacing == CameraSelector.LENS_FACING_FRONT) {
                    lensFacing = CameraSelector.LENS_FACING_BACK; startCamera()
                } else { toast(R.string.camera_error); finish() }
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val cap = capture ?: return
        val raw = File(cacheDir, "camera_${System.currentTimeMillis()}.jpg")
        b.imgCapture.isEnabled = false
        b.progress.visibility = View.VISIBLE
        cap.takePicture(ImageCapture.OutputFileOptions.Builder(raw).build(), ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    lifecycleScope.launch {
                        val f = withContext(Dispatchers.IO) { ImageStore.normalize(this@CameraActivity, raw).also { raw.delete() } }
                        if (f == null) { toast(R.string.camera_error); finish(); return@launch }
                        setResult(RESULT_OK, Intent().putExtra(EXTRA_PATH, f.absolutePath))
                        finish()
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    b.imgCapture.isEnabled = true
                    b.progress.visibility = View.GONE
                    toast(R.string.camera_error)
                }
            })
    }

    companion object {
        const val EXTRA_PATH = "path"
    }
}
