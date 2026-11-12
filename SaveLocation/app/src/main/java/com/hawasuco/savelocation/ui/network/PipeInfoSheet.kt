package com.hawasuco.savelocation.ui.network

import android.content.DialogInterface
import android.graphics.Typeface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TableRow
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.SheetPipeInfoBinding
import com.hawasuco.savelocation.network.PipeFeature
import com.hawasuco.savelocation.network.PipeLayer
import com.hawasuco.savelocation.network.PipeOverlay
import com.hawasuco.savelocation.network.PipeStore
import com.hawasuco.savelocation.network.PipeStyle
import com.hawasuco.savelocation.network.PipeSync
import com.hawasuco.savelocation.ui.dialogs.SaveLocationDialog
import com.hawasuco.savelocation.util.NavApps
import com.hawasuco.savelocation.util.dp
import com.hawasuco.savelocation.util.visible
import kotlinx.coroutines.launch

/** Thẻ thông tin đoạn ống (giống popup trên web SCADA) + chỉ đường / lưu vị trí tại điểm chạm. */
class PipeInfoSheet : BottomSheetDialogFragment() {
    private var _b: SheetPipeInfoBinding? = null
    private val b get() = _b!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = SheetPipeInfoBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val args = requireArguments()
        val layerId = args.getLong(ARG_LAYER)
        val featureId = args.getLong(ARG_FEATURE)
        val lat = args.getDouble(ARG_LAT)
        val lng = args.getDouble(ARG_LNG)
        val ll = PipeStore.snapshot().firstOrNull { it.layer.id == layerId }
        val f = ll?.features?.firstOrNull { it.id == featureId }
        if (ll == null || f == null) { dismissAllowingStateLoss(); return }
        val layer = ll.layer

        val title = f.title?.takeIf { it.isNotBlank() } ?: layer.name
        b.tvTitle.text = title
        b.tvSub.text = getString(PipeLayersSheet.kindLabelRes(layer.kind)) + " · " + layer.name
        applySwatch(layer, f)

        b.btnDirections.setOnClickListener { NavApps.navigate(requireContext(), lat, lng, title) }
        b.btnSaveHere.setOnClickListener {
            SaveLocationDialog.newFromMap(lat, lng, null, title).show(parentFragmentManager, SaveLocationDialog.TAG)
            dismiss()
        }

        viewLifecycleOwner.lifecycleScope.launch {
            val info = PipeSync.info(f, layer.name)
            _b ?: return@launch
            b.loading.visibility = View.GONE
            if (info.title.isNotBlank()) b.tvTitle.text = info.title
            b.tvPlanned.visible(info.planned)
            fillTable(info.rows)
            val note = when {
                info.rows.isEmpty() -> getString(R.string.pipe_info_none)
                !info.fromServer && PipeSync.hasCode() -> getString(R.string.pipe_info_offline)
                else -> null
            }
            b.tvNote.text = note
            b.tvNote.visible(note != null)
        }
    }

    private fun applySwatch(layer: PipeLayer, f: PipeFeature) {
        if (Prefs.pipeSizeMode) {
            val c = PipeStyle.sizeClass(f.diameterMm)
            b.swatch.set(c.color, c.weight, f.dash)
        } else {
            b.swatch.set(layer.color, layer.weight, f.dash)
        }
    }

    private fun fillTable(rows: List<Pair<String, String>>) {
        val ctx = requireContext()
        b.table.removeAllViews()
        b.table.visible(rows.isNotEmpty())
        rows.forEach { (label, value) ->
            val tr = TableRow(ctx).apply { setPadding(0, ctx.dp(3), 0, ctx.dp(3)) }
            tr.addView(TextView(ctx).apply {
                text = label
                setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
                textSize = 13f
                setPadding(0, 0, ctx.dp(12), 0)
            })
            tr.addView(TextView(ctx).apply {
                text = value
                setTextColor(ContextCompat.getColor(ctx, R.color.text_primary))
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                setTextIsSelectable(true)
            })
            b.table.addView(tr)
        }
    }

    override fun onDismiss(dialog: DialogInterface) {
        super.onDismiss(dialog)
        (parentFragment as? PipeMapHost)?.onPipeInfoClosed()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    companion object {
        const val TAG = "pipe_info"
        private const val ARG_LAYER = "layer"
        private const val ARG_FEATURE = "feature"
        private const val ARG_LAT = "lat"
        private const val ARG_LNG = "lng"

        fun newInstance(hit: PipeOverlay.PipeHit) = PipeInfoSheet().apply {
            arguments = bundleOf(
                ARG_LAYER to hit.layer.id, ARG_FEATURE to hit.feature.id,
                ARG_LAT to hit.point.latitude, ARG_LNG to hit.point.longitude,
            )
        }
    }
}
