package com.hawasuco.savelocation.ui.live

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.data.Prefs
import com.hawasuco.savelocation.databinding.DialogLiveLocationStatusScreenBinding
import com.hawasuco.savelocation.live.LiveApi
import com.hawasuco.savelocation.live.LiveLocationService
import com.hawasuco.savelocation.util.Formats
import com.hawasuco.savelocation.util.ShareUtil
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Trạng thái chia sẻ trực tiếp: thời gian còn lại, tần suất cập nhật, link, dừng chia sẻ. */
class LiveStatusSheet : BottomSheetDialogFragment() {
    private var _b: DialogLiveLocationStatusScreenBinding? = null
    private val b get() = _b!!
    private var pulse: ObjectAnimator? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = DialogLiveLocationStatusScreenBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.apply { state = BottomSheetBehavior.STATE_EXPANDED; skipCollapsed = true }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val link = LiveApi.linkFor(Prefs.liveSessionId)
        b.tvLiveLocationLink.text = link
        b.btnCopyLink.setOnClickListener { ShareUtil.copy(requireContext(), link, R.string.msg_live_location_link_copied) }
        b.btnShareLink.setOnClickListener { ShareLocationSheet.shareLiveLink(requireContext(), Prefs.displayName, Prefs.liveExpiresAt) }
        b.btnUpdateSettingsChange.setOnClickListener { LiveUpdateSettingsDialog().show(childFragmentManager, "update_settings") }
        childFragmentManager.setFragmentResultListener(LiveUpdateSettingsDialog.RESULT, viewLifecycleOwner) { _, _ -> renderSummary() }
        b.btnStopSharing.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle(R.string.stop_sharing)
                .setMessage(R.string.ask_stop_live_location_sharing)
                .setPositiveButton(R.string.stop_sharing_btn) { _, _ ->
                    LiveLocationService.stop(requireContext()); dismissAllowingStateLoss()
                }
                .setNegativeButton(R.string.cancel, null)
                .show()
        }
        b.btnShareCurrentLocation.setOnClickListener {
            dismiss()
            ShareLocationSheet.newInstance(null, null, null, null, live = false).show(parentFragmentManager, "share_sheet")
        }
        renderSummary()
        pulse = ObjectAnimator.ofFloat(b.viewRipple, View.ALPHA, 1f, 0.25f).apply {
            duration = 900; repeatMode = ValueAnimator.REVERSE; repeatCount = ValueAnimator.INFINITE; start()
        }
        viewLifecycleOwner.lifecycleScope.launch {
            while (isActive) {
                if (!Prefs.isLiveActive) { dismissAllowingStateLoss(); break }
                val ctx = context ?: break
                b.tvRemainingTime.text = getString(R.string.live_location_remaining, Formats.duration(ctx, Prefs.liveExpiresAt - System.currentTimeMillis()))
                b.tvSharingDuration.text = getString(R.string.sharing_for_duration, Formats.duration(ctx, Prefs.liveExpiresAt - Prefs.liveStartedAt)) +
                    " • " + getString(R.string.share_until_time, Formats.timeShort(Prefs.liveExpiresAt))
                delay(1000)
            }
        }
    }

    private fun renderSummary() {
        _b ?: return
        b.tvUpdateSettingsSummary.text = summary(requireContext())
    }

    override fun onDestroyView() {
        pulse?.cancel()
        super.onDestroyView()
        _b = null
    }

    companion object {
        fun summary(ctx: android.content.Context): String = ctx.getString(
            R.string.update_settings_summary,
            ctx.getString(R.string.seconds_short, Prefs.liveIntervalSec),
            ctx.getString(R.string.meters_short, Prefs.liveDisplacementM),
        )
    }
}
