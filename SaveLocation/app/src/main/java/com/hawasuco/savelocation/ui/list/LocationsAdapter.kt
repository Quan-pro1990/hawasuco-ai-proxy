package com.hawasuco.savelocation.ui.list

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.lifecycle.LifecycleCoroutineScope
import androidx.recyclerview.widget.RecyclerView
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.Prefs.ListField
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.ListItemsBinding
import com.hawasuco.savelocation.util.Coords
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.visible

/** Thẻ vị trí trong danh sách: ảnh, tên, ngày, khoảng cách, yêu thích, địa chỉ, tọa độ... và hàng nút thao tác. */
class LocationsAdapter(
    private val scope: LifecycleCoroutineScope,
    private val listener: Listener,
) : RecyclerView.Adapter<LocationsAdapter.VH>() {

    interface Listener {
        fun onItemClick(loc: SavedLocation)
        fun onImageClick(loc: SavedLocation)
        fun onFavourite(loc: SavedLocation)
        fun onShowOnMap(loc: SavedLocation)
        fun onEdit(loc: SavedLocation)
        fun onShare(loc: SavedLocation)
        fun onCopy(loc: SavedLocation)
        fun onDelete(loc: SavedLocation)
        fun onSelectionChanged()
    }

    var items: List<SavedLocation> = emptyList()
        set(value) { field = value; notifyDataSetChanged() }
    var groups: Map<String, LocationGroup> = emptyMap()
    var editMode = false
        set(value) { field = value; notifyDataSetChanged() }

    class VH(val v: ListItemsBinding) : RecyclerView.ViewHolder(v.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ListItemsBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount() = items.size

    override fun onBindViewHolder(h: VH, position: Int) {
        val loc = items[position]
        val v = h.v
        val ctx = v.root.context

        v.checkbox.visible(editMode)
        v.checkbox.setOnCheckedChangeListener(null)
        v.checkbox.isChecked = loc.selected
        v.checkbox.setOnCheckedChangeListener { _, c -> loc.selected = c; listener.onSelectionChanged() }

        v.tvItemTitle.visible(Prefs.listField(ListField.TITLE))
        v.tvItemTitle.text = loc.title

        val showImage = Prefs.listField(ListField.IMAGE)
        v.flImage.visible(showImage)
        if (showImage) {
            val first = loc.images.firstOrNull()
            ImageStore.loadThumb(scope, v.ivLocationImage, first, 200, R.drawable.ic_image)
            v.tvImagesCount.visible(loc.images.size > 1)
            v.tvImagesCount.text = loc.images.size.toString()
        }

        v.tvItemDate.visible(Prefs.listField(ListField.DATE))
        v.tvItemDate.text = Formats.date(loc.dateMillis)

        val dist = loc.distanceMeters
        v.llDistance.visible(Prefs.listField(ListField.DISTANCE) && dist != null)
        if (dist != null) v.tvItemDistance.text = Formats.distance(ctx, dist)

        v.btnFavourite.setImageResource(if (loc.favorite) R.drawable.ic_favorite else R.drawable.ic_favorite_border)

        v.tvItemAddress.visible(Prefs.listField(ListField.ADDRESS) && loc.address.isNotBlank())
        v.tvItemAddress.text = loc.address

        v.llCoordinatesView.visible(Prefs.listField(ListField.COORDS))
        v.tvItemCoordinates.text = Coords.displayInline(ctx, loc.latitude, loc.longitude)

        v.llContactNumber.visible(Prefs.listField(ListField.CONTACT) && loc.contactNumber.isNotBlank())
        v.tvContactNumber.text = loc.contactNumber

        v.llNoteView.visible(Prefs.listField(ListField.NOTE) && loc.note.isNotBlank())
        v.tvItemNote.text = loc.note

        val g = loc.groupId?.let { groups[it] }
        v.llGroup.visible(Prefs.groupMode && Prefs.listField(ListField.GROUP))
        v.tvItemGroup.text = g?.name ?: ctx.getString(R.string.all)
        v.ivGroupColor.visible(g != null)
        if (g != null) v.ivGroupColor.setColorFilter(g.color)

        v.llActions.visible(!editMode)
        v.itemCardview.setOnClickListener {
            if (editMode) v.checkbox.isChecked = !v.checkbox.isChecked else listener.onItemClick(loc)
        }
        v.ivLocationImage.setOnClickListener {
            if (editMode) v.checkbox.isChecked = !v.checkbox.isChecked
            else if (loc.images.isNotEmpty()) listener.onImageClick(loc) else listener.onItemClick(loc)
        }
        v.btnFavourite.setOnClickListener { listener.onFavourite(loc) }
        v.btnShowOnMap.setOnClickListener { listener.onShowOnMap(loc) }
        v.btnEdit.setOnClickListener { listener.onEdit(loc) }
        v.btnShare.setOnClickListener { listener.onShare(loc) }
        v.btnCopy.setOnClickListener { listener.onCopy(loc) }
        v.btnDelete.setOnClickListener { listener.onDelete(loc) }
    }
}
