package com.hawasuco.savelocation.ui.live

import android.app.Dialog
import android.os.Bundle
import android.widget.LinearLayout
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.DialogLiveLocationUpdateSettingsBinding
import com.hawasuco.savelocation.databinding.ItemLiveLocationUpdateChipBinding
import com.hawasuco.savelocation.live.LiveLocationService

/** Tần suất cập nhật vị trí trực tiếp: "Cập nhật mỗi" (giây) và "Cập nhật khi di chuyển" (mét). */
class LiveUpdateSettingsDialog : DialogFragment() {
    private var interval = Prefs.liveIntervalSec
    private var displacement = Prefs.liveDisplacementM

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val b = DialogLiveLocationUpdateSettingsBinding.inflate(layoutInflater)
        val intervals = listOf(5, 10, 15, 30, 60)
        val distances = listOf(5, 10, 25, 50, 100)
        val intervalChips = chips(b.rvIntervalChips, intervals, advised = 10) { getString(R.string.seconds_short, it) }
        val distanceChips = chips(b.rvDisplacementChips, distances, advised = 10) { getString(R.string.meters_short, it) }
        fun render() {
            intervalChips.forEach { (v, chip) -> select(chip, v == interval) }
            distanceChips.forEach { (v, chip) -> select(chip, v == displacement) }
        }
        intervalChips.forEach { (v, chip) -> chip.tvChipLabel.setOnClickListener { interval = v; render() } }
        distanceChips.forEach { (v, chip) -> chip.tvChipLabel.setOnClickListener { displacement = v; render() } }
        render()
        b.btnCloseUpdateSettings.setOnClickListener { dismiss() }
        b.btnApplyUpdateSettings.setOnClickListener {
            Prefs.liveIntervalSec = interval
            Prefs.liveDisplacementM = displacement
            LiveLocationService.restartUpdates(requireContext())
            parentFragmentManager.setFragmentResult(RESULT, Bundle())
            dismiss()
        }
        return AlertDialog.Builder(requireContext()).setView(b.root).create()
    }

    private fun chips(
        container: LinearLayout, values: List<Int>, advised: Int, label: (Int) -> String,
    ): List<Pair<Int, ItemLiveLocationUpdateChipBinding>> = values.map { v ->
        val chip = ItemLiveLocationUpdateChipBinding.inflate(layoutInflater, container, false)
        chip.tvChipLabel.text = label(v)
        chip.tvChipRecommended.visibility = if (v == advised) android.view.View.VISIBLE else android.view.View.INVISIBLE
        container.addView(chip.root)
        v to chip
    }

    private fun select(chip: ItemLiveLocationUpdateChipBinding, on: Boolean) {
        chip.tvChipLabel.setBackgroundResource(if (on) R.drawable.bg_chip_selected else R.drawable.bg_chip)
        chip.tvChipLabel.setTextColor(requireContext().getColor(if (on) R.color.white else R.color.text_primary))
    }

    companion object {
        const val RESULT = "live_update_settings"
    }
}
