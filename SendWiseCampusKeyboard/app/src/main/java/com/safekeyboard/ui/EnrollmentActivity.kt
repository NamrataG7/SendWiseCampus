package com.safekeyboard.ui

import android.app.Activity
import android.content.Context
import android.content.RestrictionsManager
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.safekeyboard.R

/**
 * Campus enrollment stub.
 *
 * Replaces the upstream SafeKeyboardApp PairingActivity (parent<->child OTP flow).
 * The campus fork receives a "campus_code" via Android [RestrictionsManager]
 * managed configuration, pushed by campus IT through an MDM/EMM provider
 * (Intune, Jamf, Google Workspace, etc.).
 *
 * TODO(campus-mdm):
 *   1. Register a RestrictionsManager broadcast receiver for
 *      ACTION_APPLICATION_RESTRICTIONS_CHANGED so the code updates live.
 *   2. Persist the campus_code (EncryptedSharedPreferences) so the IME
 *      service can attach it to any aggregate telemetry.
 *   3. Wire enrollment status to the IME service enable/disable UX
 *      (Settings.Secure.getString(ENABLED_INPUT_METHODS)).
 *   4. Add app-restrictions.xml under res/xml/ declaring the campus_code
 *      key so MDM consoles can surface it as a managed setting.
 */
class EnrollmentActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }

        val title = TextView(this).apply {
            text = getString(R.string.enrollment_title)
            textSize = 22f
            gravity = Gravity.CENTER
        }

        val label = TextView(this).apply {
            text = getString(R.string.enrollment_code_label)
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, 48, 0, 8)
        }

        val code = TextView(this).apply {
            text = readCampusCode() ?: getString(R.string.enrollment_code_missing)
            textSize = 28f
            gravity = Gravity.CENTER
        }

        val note = TextView(this).apply {
            text = getString(R.string.enrollment_note)
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(0, 48, 0, 0)
        }

        root.addView(title)
        root.addView(label)
        root.addView(code)
        root.addView(note)
        setContentView(root)
    }

    private fun readCampusCode(): String? {
        val rm = getSystemService(Context.RESTRICTIONS_SERVICE) as? RestrictionsManager
            ?: return null
        val bundle = rm.applicationRestrictions ?: return null
        val value = bundle.getString(KEY_CAMPUS_CODE)
        return if (value.isNullOrBlank()) null else value
    }

    companion object {
        /** MDM-managed configuration key. Mirror this in res/xml/app-restrictions.xml. */
        const val KEY_CAMPUS_CODE = "campus_code"
    }
}
