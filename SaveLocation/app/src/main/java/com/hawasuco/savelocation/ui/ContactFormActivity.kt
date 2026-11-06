package com.hawasuco.savelocation.ui

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Patterns
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import com.hawasuco.savelocation.BuildConfig
import com.hawasuco.savelocation.R
import com.hawasuco.savelocation.databinding.ActivityContactFormBinding
import com.hawasuco.savelocation.util.toast

/** Biểu mẫu liên hệ (Họ tên, Email, SĐT, Nội dung) → soạn email gửi tới địa chỉ hỗ trợ cấu hình trong strings.xml. */
class ContactFormActivity : AppCompatActivity() {
    private lateinit var b: ActivityContactFormBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityContactFormBinding.inflate(layoutInflater)
        setContentView(b.root)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        title = intent.getStringExtra(EXTRA_TOPIC) ?: getString(R.string.contact_us)
        b.btnSend.setOnClickListener { send() }
    }

    private fun send() {
        val name = b.etName.text.toString().trim()
        val email = b.etEmail.text.toString().trim()
        val msg = b.etMessage.text.toString().trim()
        if (name.isEmpty() || email.isEmpty() || msg.isEmpty()) { toast(R.string.msg_all_fields_are_compulsory); return }
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) { b.etEmail.error = getString(R.string.valid_email); return }
        val body = buildString {
            appendLine(msg); appendLine()
            appendLine("—")
            appendLine("${getString(R.string.contact_name).trimEnd('*')}: $name")
            appendLine("Email: $email")
            b.etPhoneNumber.text.toString().trim().takeIf { it.isNotEmpty() }?.let { appendLine("${getString(R.string.phonenumber)}: $it") }
            appendLine("App: ${getString(R.string.app_name)} ${BuildConfig.VERSION_NAME}")
            appendLine("Device: ${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}")
        }
        val to = getString(R.string.support_email)
        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$to")).apply {
            putExtra(Intent.EXTRA_SUBJECT, "${getString(R.string.app_name)} – $title")
            putExtra(Intent.EXTRA_TEXT, body)
        }
        try {
            startActivity(intent); finish()
        } catch (_: ActivityNotFoundException) {
            toast(R.string.error_no_email_client)
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == android.R.id.home) { finish(); return true }
        return super.onOptionsItemSelected(item)
    }

    companion object {
        const val EXTRA_TOPIC = "topic"
    }
}
