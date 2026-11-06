package com.hawasuco.savelocation.ui.dialogs

import android.app.Dialog
import android.os.Bundle
import android.widget.ImageView
import androidx.appcompat.app.AlertDialog
import androidx.core.os.bundleOf
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.DialogImageUploadBinding
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.toast
import java.io.File

/** Hộp thoại "Thêm ảnh": 3 ô ảnh; chạm để chụp / chọn từ thư viện / xem / xoá. */
class ImageUploadDialog : DialogFragment() {
    private lateinit var b: DialogImageUploadBinding
    private val images = ArrayList<String>()
    private val added = ArrayList<String>()
    private var targetSlot = 0
    private var committed = false

    private val picker = ImagePicker(this) { f ->
        val p = f.absolutePath
        added += p
        if (targetSlot < images.size) images[targetSlot] = p else images += p
        render()
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        b = DialogImageUploadBinding.inflate(layoutInflater)
        if (savedInstanceState == null) images.addAll(requireArguments().getStringArrayList(ARG_IMAGES).orEmpty())
        else images.addAll(savedInstanceState.getStringArrayList(ARG_IMAGES).orEmpty())
        val slots = listOf(b.cardImg1, b.cardImg2, b.cardImg3)
        val labels = listOf(b.tvLabelImage1, b.tvLabelImage2, b.tvLabelImage3)
        labels.forEachIndexed { i, t -> t.text = getString(R.string.image_n, i + 1) }
        slots.forEachIndexed { i, card -> card.setOnClickListener { onSlot(i) } }
        b.btnCancel.setOnClickListener { dismiss() }
        b.btnSave.setOnClickListener {
            committed = true
            parentFragmentManager.setFragmentResult(RESULT, bundleOf(KEY_IMAGES to ArrayList(images), KEY_NEW to ArrayList(added)))
            dismiss()
        }
        render()
        return AlertDialog.Builder(requireContext()).setView(b.root).create()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putStringArrayList(ARG_IMAGES, images)
    }

    private fun onSlot(i: Int) {
        val ctx = requireContext()
        if (i < images.size) {
            val items = arrayOf(getString(R.string.view_photo), getString(R.string.take_photo),
                getString(R.string.choose_from_gallery), getString(R.string.remove_photo))
            AlertDialog.Builder(ctx).setItems(items) { _, which ->
                when (which) {
                    0 -> ImageViewerDialog.newInstance(images, i).show(parentFragmentManager, "viewer")
                    1 -> { targetSlot = i; picker.takePhoto() }
                    2 -> { targetSlot = i; picker.chooseFromGallery() }
                    3 -> { images.removeAt(i); render() }
                }
            }.show()
        } else {
            if (i > images.size) { ctx.toast(R.string.upload_image_sequence); return }
            val items = arrayOf(getString(R.string.take_photo), getString(R.string.choose_from_gallery))
            AlertDialog.Builder(ctx).setItems(items) { _, which ->
                targetSlot = images.size
                if (which == 0) picker.takePhoto() else picker.chooseFromGallery()
            }.show()
        }
    }

    private fun render() {
        val views = listOf(b.img1, b.img2, b.img3)
        views.forEachIndexed { i, iv ->
            val path = images.getOrNull(i)
            if (path == null) {
                iv.scaleType = ImageView.ScaleType.CENTER_INSIDE
                iv.setImageResource(R.drawable.ic_add_photo)
                iv.alpha = if (i == images.size) 1f else 0.4f
            } else {
                iv.alpha = 1f
                iv.scaleType = ImageView.ScaleType.CENTER_CROP
                ImageStore.loadThumb(lifecycleScope, iv, path, 300, R.drawable.ic_image)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (!committed && activity?.isChangingConfigurations != true) {
            added.forEach { File(it).delete() }
        }
    }

    companion object {
        const val RESULT = "images_result"
        const val KEY_IMAGES = "images"
        const val KEY_NEW = "new_images"
        private const val ARG_IMAGES = "images"

        fun newInstance(images: ArrayList<String>) = ImageUploadDialog().apply {
            arguments = bundleOf(ARG_IMAGES to ArrayList(images.take(SavedLocation.MAX_IMAGES)))
        }
    }
}
