package org.autojs.autojs.external.inputmethod

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.inputmethod.InputMethodInfo
import android.view.inputmethod.InputMethodManager

object CaptchaInputMethodStatus {
    fun isEnabled(context: Context): Boolean {
        val manager = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            ?: return false
        val serviceName = CaptchaNumberInputMethodService::class.java.name
        return manager.enabledInputMethodList.any { info: InputMethodInfo ->
            context.packageName == info.packageName && serviceName == info.serviceName
        }
    }

    fun isSelected(context: Context): Boolean {
        val selectedInputMethod = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.DEFAULT_INPUT_METHOD
        )
        return selectedInputMethod?.contains(CaptchaNumberInputMethodService::class.java.name) == true
    }

    fun openInputMethodSettings(context: Context) {
        context.startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
    }

    fun showInputMethodPicker(context: Context) {
        val manager = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        manager?.showInputMethodPicker()
    }
}
