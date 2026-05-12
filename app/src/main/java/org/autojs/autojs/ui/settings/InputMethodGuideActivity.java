package org.autojs.autojs.ui.settings;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.autojs.autojs.external.inputmethod.CaptchaImeBridge;
import org.autojs.autojs.external.inputmethod.CaptchaNumberInputMethodService;
import org.autojs.autojs.ui.BaseActivity;
import org.openautojs.autojs.R;

import java.util.List;

public class InputMethodGuideActivity extends BaseActivity {

    private TextView enableStatus;
    private TextView defaultStatus;
    private EditText testInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_input_method_guide);
        setToolbarAsBack(getString(R.string.text_captcha_input_method));

        enableStatus = findViewById(R.id.input_method_enable_status);
        defaultStatus = findViewById(R.id.input_method_default_status);
        testInput = findViewById(R.id.input_method_test_input);
        findViewById(R.id.open_input_method_settings).setOnClickListener(v -> openInputMethodSettings());
        findViewById(R.id.switch_input_method).setOnClickListener(v -> showInputMethodPicker());
        findViewById(R.id.test_input_method).setOnClickListener(v -> testInputMethod());
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    private void refreshStatus() {
        boolean enabled = isInputMethodEnabled();
        boolean selected = isInputMethodSelected();
        enableStatus.setText(enabled ? R.string.text_enabled : R.string.text_not_enabled);
        defaultStatus.setText(selected ? R.string.text_selected : R.string.text_not_selected);
    }

    private boolean isInputMethodEnabled() {
        InputMethodManager manager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (manager == null) {
            return false;
        }
        List<InputMethodInfo> inputMethods = manager.getEnabledInputMethodList();
        String serviceName = CaptchaNumberInputMethodService.class.getName();
        for (InputMethodInfo info : inputMethods) {
            if (getPackageName().equals(info.getPackageName())
                    && serviceName.equals(info.getServiceName())) {
                return true;
            }
        }
        return false;
    }

    private boolean isInputMethodSelected() {
        String selectedInputMethod = Settings.Secure.getString(
                getContentResolver(), Settings.Secure.DEFAULT_INPUT_METHOD);
        return selectedInputMethod != null
                && selectedInputMethod.contains(CaptchaNumberInputMethodService.class.getName());
    }

    private void openInputMethodSettings() {
        startActivity(new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS));
    }

    private void showInputMethodPicker() {
        InputMethodManager manager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (manager != null) {
            manager.showInputMethodPicker();
        }
    }

    private void testInputMethod() {
        if (!isInputMethodEnabled()) {
            Toast.makeText(this, R.string.text_please_enable_captcha_input_method, Toast.LENGTH_SHORT).show();
            openInputMethodSettings();
            return;
        }
        if (!isInputMethodSelected()) {
            Toast.makeText(this, R.string.text_please_select_captcha_input_method, Toast.LENGTH_SHORT).show();
            showInputMethodPicker();
            return;
        }
        testInput.setText("");
        testInput.requestFocus();
        InputMethodManager manager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (manager != null) {
            manager.showSoftInput(testInput, InputMethodManager.SHOW_IMPLICIT);
        }
        testInput.postDelayed(() -> {
            Intent intent = new Intent(CaptchaImeBridge.ACTION_SET_ANSWER);
            intent.setPackage(getPackageName());
            intent.putExtra(CaptchaImeBridge.EXTRA_ANSWER, String.valueOf(System.currentTimeMillis() / 1000L));
            sendBroadcast(intent);
        }, 200L);
    }
}
