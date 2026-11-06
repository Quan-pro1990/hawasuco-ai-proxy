package com.hawasuco.savelocation.ui.geofence

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.lifecycle.LifecycleCoroutineScope
import androidx.recyclerview.widget.RecyclerView
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.LocationGroup
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.data.SavedLocation
import com.hawasuco.savelocation.databinding.ItemGeofenceBinding
import com.hawasuco.savelocation.util.ImageStore
import com.hawasuco.savelocation.util.visible

/** Thẻ vị trí dùng chung cho "Quản lý vùng cảnh báo" (có nút bỏ) và "Thêm vùng cảnh báo" (có ô chọn). */
class GeofenceAdapter(
    private val scope: LifecycleCoroutineScope,
    private val selectable: Boolean,
    private val onClick: (SavedLocation) -> Unit,
    private val onRemove: (SavedLocation) -> Unit = {},
) : RecyclerView.Adapter<GeofenceAdapter.VH>() {

    var items: List<SavedLocation> = emptyList()
        set(v) { field = v; notifyDataSetChanged() }
    var groups: Map<String, LocationGroup> = emptyMap()
    val checked = HashSet<Long>()

    class VH(val v: ItemGeofenceBinding) : RecyclerView.ViewHolder(v.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemGeofenceBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount() = items.size

    override fun onBindViewHolder(h: VH, position: Int) {
        val loc = items[position]
        val v = h.v
        val ctx = v.root.context
        v.tvName.text = loc.title
        v.tvAddress.text = loc.address
        v.tvAddress.visible(loc.address.isNotBlank())
        v.llGroup.visible(Prefs.groupMode)
        v.tvGroupName.text = loc.groupId?.let { groups[it]?.name } ?: ctx.getString(R.string.all)
        v.tvRadius.visible(!selectable)
        v.tvRadius.text = ctx.getString(R.string.geofence_notification_text, loc.geofenceRadius)
        ImageStore.loadThumb(scope, v.ivLocationImage, loc.images.firstOrNull(), 160, R.drawable.ic_image)
        v.btnRemove.visible(!selectable)
        v.btnRemove.setOnClickListener { onRemove(loc) }
        v.checkbox.visible(selectable)
        v.checkbox.setOnCheckedChangeListener(null)
        v.checkbox.isChecked = loc.id in checked
        v.checkbox.setOnCheckedChangeListener { _, c -> if (c) checked += loc.id else checked -= loc.id }
        v.cardView.setOnClickListener {
            if (selectable) v.checkbox.isChecked = !v.checkbox.isChecked else onClick(loc)
        }
    }
}
