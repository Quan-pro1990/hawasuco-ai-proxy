package com.hawasuco.savelocation.ui.dialogs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.os.bundleOf
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.databinding.DialogShowFullImageBinding
import com.hawasuco.savelocation.databinding.ItemLocationImageBinding
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Xem ảnh toàn màn hình (vuốt qua lại, phóng to), nút "Tải về" lưu vào thư viện ảnh. */
class ImageViewerDialog : DialogFragment() {
    private var _b: DialogShowFullImageBinding? = null
    private val b get() = _b!!
    private lateinit var images: List<String>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NO_TITLE, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogShowFullImageBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        images = requireArguments().getStringArrayList(ARG_IMAGES).orEmpty()
        b.viewpagerImages.adapter = object : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
            override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
                val v = ItemLocationImageBinding.inflate(LayoutInflater.from(parent.context), parent, false)
                return object : RecyclerView.ViewHolder(v.root) {}
            }

            override fun getItemCount() = images.size

            override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
                val iv = holder.itemView as com.hawasuco.savelocation.ui.view.ZoomImageView
                iv.resetZoom()
                ImageStore.loadThumb(viewLifecycleOwner.lifecycleScope, iv, images[position], 1600, R.drawable.ic_image)
            }
        }
        b.viewpagerImages.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                b.tvPage.text = if (images.size > 1) "${position + 1}/${images.size}" else ""
            }
        })
        b.viewpagerImages.setCurrentItem(requireArguments().getInt(ARG_POS), false)
        b.imgClose.setOnClickListener { dismiss() }
        b.tvDownload.setOnClickListener {
            val path = images.getOrNull(b.viewpagerImages.currentItem) ?: return@setOnClickListener
            val ctx = requireContext().applicationContext
            lifecycleScope.launch {
                val ok = withContext(Dispatchers.IO) { ImageStore.saveToGallery(ctx, path, com.hawasuco.savelocation.util.Exporter.folderName(ctx)) }
                ctx.toast(if (ok) R.string.download else R.string.unknown_error)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        private const val ARG_IMAGES = "images"
        private const val ARG_POS = "pos"

        fun newInstance(images: List<String>, position: Int) = ImageViewerDialog().apply {
            arguments = bundleOf(ARG_IMAGES to ArrayList(images), ARG_POS to position)
        }
    }
}
