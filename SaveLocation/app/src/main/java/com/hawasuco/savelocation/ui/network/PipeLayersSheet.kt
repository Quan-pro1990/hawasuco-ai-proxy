package com.hawasuco.savelocation.ui.network

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.ItemPipeGroupBinding
import com.hawasuco.savelocation.databinding.ItemPipeLayerBinding
import com.hawasuco.savelocation.databinding.SheetPipeLayersBinding
import com.hawasuco.savelocation.network.LoadedLayer
import com.hawasuco.savelocation.network.PipeDash
import com.hawasuco.savelocation.network.PipeKind
import com.hawasuco.savelocation.network.PipeStore
import com.hawasuco.savelocation.network.PipeStyle
import com.hawasuco.savelocation.network.PipeSync
import com.hawasuco.savelocation.util.dp
import com.hawasuco.savelocation.util.toast
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.net.URI

/**
 * Bảng "Lớp đường ống" (giống bảng lớp của web SCADA, chỉ giữ các lớp ống):
 * nhóm Tuyến ống / Ống đang triển khai / Ống dự kiến, bật tắt từng lớp, xem lớp, cập nhật ngay.
 */
class PipeLayersSheet : BottomSheetDialogFragment() {
    private var _b: SheetPipeLayersBinding? = null
    private val b get() = _b!!
    private val expanded = HashSet<String>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = SheetPipeLayersBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.apply { state = BottomSheetBehavior.STATE_EXPANDED; skipCollapsed = true }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        savedInstanceState?.getStringArrayList("expanded")?.let { expanded.addAll(it) } ?: expanded.addAll(PipeKind.ALL)
        b.switchOnMaps.isChecked = Prefs.pipesOnMaps
        b.switchOnMaps.setOnCheckedChangeListener { _, c ->
            Prefs.pipesOnMaps = c
            PipeStore.notifyStyleChanged()
        }
        b.btnSyncNow.setOnClickListener {
            if (!PipeSync.hasCode()) { openAccess(); return@setOnClickListener }
            val ctx = requireContext().applicationContext
            PipeSync.syncInBackground(ctx) { r -> ctx.toast(NetworkFragment.syncMessage(ctx, r)) }
        }
        b.btnCode.setOnClickListener { openAccess() }
        viewLifecycleOwner.lifecycleScope.launch {
            PipeStore.ensureLoaded(requireContext())
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                PipeStore.version.combine(PipeSync.running) { v, r -> v to r }.collect { (_, running) -> render(running) }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putStringArrayList("expanded", ArrayList(expanded))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }

    private fun openAccess() {
        val host = parentFragment
        if (host != null) ScadaAccessDialog().show(host.childFragmentManager, ScadaAccessDialog.TAG)
        else ScadaAccessDialog().show(parentFragmentManager, ScadaAccessDialog.TAG)
    }

    private fun render(running: Boolean) {
        _b ?: return
        val ctx = requireContext()
        val host = runCatching { URI(Prefs.scadaUrl).host }.getOrNull() ?: Prefs.scadaUrl
        val status = when {
            running -> getString(R.string.pipe_syncing)
            !PipeSync.hasCode() -> getString(R.string.pipe_need_code)
            Prefs.pipeLastError.isNotBlank() -> PipeSync.errorText(ctx, Prefs.pipeLastError)
            Prefs.pipeLastSync > 0 -> getString(R.string.pipe_status,
                com.hawasuco.savelocation.util.Formats.date(Prefs.pipeLastSync), PipeStore.totalPipes())
            else -> getString(R.string.pipe_status_never)
        }
        b.tvSource.text = getString(R.string.pipe_source, host) + "\n" + status
        b.btnSyncNow.isEnabled = !running
        b.btnSyncNow.setText(if (running) R.string.pipe_syncing else R.string.pipe_sync_now)

        b.groups.removeAllViews()
        val all = PipeStore.snapshot()
        for (kind in PipeKind.ALL) {
            val layers = all.filter { it.layer.kind == kind }
            if (layers.isEmpty()) continue
            addGroup(kind, layers)
        }
        if (all.isEmpty()) {
            b.groups.addView(TextView(ctx).apply {
                text = getString(R.string.pipe_empty_desc)
                setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
                setPadding(ctx.dp(18), ctx.dp(8), ctx.dp(18), ctx.dp(8))
            })
        }
    }

    private fun addGroup(kind: String, layers: List<LoadedLayer>) {
        val inflater = layoutInflater
        val g = ItemPipeGroupBinding.inflate(inflater, b.groups, false)
        val total = layers.sumOf { it.layer.featureCount }
        g.tvGroup.text = kindLabel(kind) + " (" + total + ")"
        val first = layers.first().layer
        g.swatch.set(first.color.takeIf { it != 0 } ?: PipeStyle.kindColor(kind), first.weight, kindDash(kind))
        val allOn = layers.all { it.layer.visible }
        g.cbGroup.isChecked = allOn
        g.cbGroup.alpha = if (!allOn && layers.any { it.layer.visible }) 0.6f else 1f
        g.cbGroup.setOnClickListener {
            val on = g.cbGroup.isChecked
            layers.forEach { PipeStore.setVisible(requireContext(), it.layer.id, on) }
        }
        val open = kind in expanded
        g.ivExpand.rotation = if (open) 90f else 0f
        g.root.setOnClickListener {
            if (!expanded.remove(kind)) expanded.add(kind)
            render(PipeSync.running.value)
        }
        b.groups.addView(g.root)
        if (!open) return
        for (ll in layers) {
            val l = ll.layer
            val r = ItemPipeLayerBinding.inflate(inflater, b.groups, false)
            r.tvName.text = l.name
            r.tvCount.text = buildString {
                append(getString(R.string.pipe_feature_count, l.featureCount))
                if (l.missingDiameter > 0) append(" · ").append(getString(R.string.pipe_missing_diameter, l.missingDiameter))
            }
            r.swatch.set(l.color, l.weight, kindDash(kind))
            r.cbLayer.isChecked = l.visible
            r.cbLayer.setOnClickListener { PipeStore.setVisible(requireContext(), l.id, r.cbLayer.isChecked) }
            r.root.setOnClickListener { r.cbLayer.performClick() }
            r.btnZoom.setOnClickListener {
                val bb = bounds(ll) ?: return@setOnClickListener
                if (!l.visible) PipeStore.setVisible(requireContext(), l.id, true)
                (parentFragment as? PipeMapHost)?.zoomToBounds(bb)
                dismiss()
            }
            b.groups.addView(r.root)
        }
    }

    private fun bounds(ll: LoadedLayer): DoubleArray? {
        if (ll.features.isEmpty()) return null
        return doubleArrayOf(
            ll.features.minOf { it.minLat }, ll.features.minOf { it.minLon },
            ll.features.maxOf { it.maxLat }, ll.features.maxOf { it.maxLon },
        )
    }

    private fun kindLabel(kind: String) = getString(kindLabelRes(kind))

    companion object {
        const val TAG = "pipe_layers"

        fun kindLabelRes(kind: String) = when (kind) {
            PipeKind.BUILD -> R.string.pipe_kind_build
            PipeKind.PLAN -> R.string.pipe_kind_plan
            else -> R.string.pipe_kind_pipe
        }

        fun kindDash(kind: String) = when (kind) {
            PipeKind.BUILD -> PipeDash.BUILD
            PipeKind.PLAN -> PipeDash.PLANNED
            else -> PipeDash.SOLID
        }
    }
}
