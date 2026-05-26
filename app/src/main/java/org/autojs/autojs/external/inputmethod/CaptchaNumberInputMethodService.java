package org.autojs.autojs.external.inputmethod;

import android.inputmethodservice.InputMethodService;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;

import org.openautojs.autojs.R;

public class CaptchaNumberInputMethodService extends InputMethodService {

    private static final String TAG = "CaptchaInputMethod";
    private static final long COMMIT_DELAY_MS = 60L;
    private static final long RETRY_DELAY_MS = 120L;
    private static CaptchaNumberInputMethodService activeService;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable retryCommitRunnable = () -> commitPendingAnswer("retry_120");
    private final Runnable commitRunnable = () -> {
        boolean committed = commitPendingAnswer("delayed_60");
        if (!committed && CaptchaImeBridge.getFreshAnswer(this).length() > 0) {
            handler.postDelayed(retryCommitRunnable, RETRY_DELAY_MS);
        }
    };

    static void commitPendingAnswerIfActive() {
        CaptchaNumberInputMethodService service = activeService;
        if (service != null) {
            service.scheduleCommitAttempts();
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        activeService = this;
    }

    @Override
    public void onDestroy() {
        if (activeService == this) {
            activeService = null;
        }
        handler.removeCallbacks(commitRunnable);
        handler.removeCallbacks(retryCommitRunnable);
        super.onDestroy();
    }

    @Override
    public View onCreateInputView() {
        View view = getLayoutInflater().inflate(R.layout.captcha_number_keyboard, null);
        bindNumberKey(view, R.id.captcha_key_0, "0");
        bindNumberKey(view, R.id.captcha_key_1, "1");
        bindNumberKey(view, R.id.captcha_key_2, "2");
        bindNumberKey(view, R.id.captcha_key_3, "3");
        bindNumberKey(view, R.id.captcha_key_4, "4");
        bindNumberKey(view, R.id.captcha_key_5, "5");
        bindNumberKey(view, R.id.captcha_key_6, "6");
        bindNumberKey(view, R.id.captcha_key_7, "7");
        bindNumberKey(view, R.id.captcha_key_8, "8");
        bindNumberKey(view, R.id.captcha_key_9, "9");
        view.findViewById(R.id.captcha_key_delete).setOnClickListener(v -> deletePreviousCharacter());
        view.findViewById(R.id.captcha_key_done).setOnClickListener(v -> hideInputMethod());
        return view;
    }

    @Override
    public void onStartInput(EditorInfo attribute, boolean restarting) {
        super.onStartInput(attribute, restarting);
        scheduleCommitAttempts();
    }

    @Override
    public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        scheduleCommitAttempts();
    }

    @Override
    public void onWindowShown() {
        super.onWindowShown();
        scheduleCommitAttempts();
    }

    @Override
    public boolean onEvaluateFullscreenMode() {
        return false;
    }

    private void scheduleCommitAttempts() {
        handler.removeCallbacks(commitRunnable);
        handler.removeCallbacks(retryCommitRunnable);
        if (CaptchaImeBridge.getFreshAnswer(this).length() == 0) {
            return;
        }
        handler.postDelayed(commitRunnable, COMMIT_DELAY_MS);
    }

    private void bindNumberKey(View root, int viewId, String number) {
        root.findViewById(viewId).setOnClickListener(v -> commitManualNumber(number));
    }

    private void commitManualNumber(String number) {
        handler.removeCallbacks(commitRunnable);
        handler.removeCallbacks(retryCommitRunnable);
        CaptchaImeBridge.clearAnswer(this);
        InputConnection connection = getCurrentInputConnection();
        if (connection == null) {
            Log.i(TAG, "no input connection for manual number");
            return;
        }
        connection.commitText(number, 1);
    }

    private void deletePreviousCharacter() {
        handler.removeCallbacks(commitRunnable);
        handler.removeCallbacks(retryCommitRunnable);
        CaptchaImeBridge.clearAnswer(this);
        InputConnection connection = getCurrentInputConnection();
        if (connection == null) {
            Log.i(TAG, "no input connection for delete");
            return;
        }
        CharSequence selectedText = connection.getSelectedText(0);
        if (selectedText != null && selectedText.length() > 0) {
            connection.commitText("", 1);
            return;
        }
        if (!connection.deleteSurroundingText(1, 0)) {
            connection.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DEL));
            connection.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DEL));
        }
    }

    private void hideInputMethod() {
        handler.removeCallbacks(commitRunnable);
        handler.removeCallbacks(retryCommitRunnable);
        CaptchaImeBridge.clearAnswer(this);
        requestHideSelf(0);
    }

    private boolean commitPendingAnswer(String reason) {
        String answer = CaptchaImeBridge.getFreshAnswer(this);
        if (answer.length() == 0) {
            return false;
        }
        InputConnection connection = getCurrentInputConnection();
        if (connection == null) {
            Log.i(TAG, "no input connection reason=" + reason);
            return false;
        }
        String requestId = CaptchaImeBridge.getPendingRequestId(this);
        boolean committed = connection.commitText(answer, 1);
        Log.i(TAG, "commit answer result=" + committed + " reason=" + reason +
                " requestId=" + requestId);
        if (committed) {
            CaptchaImeBridge.markCommitted(this, reason);
            CaptchaImeBridge.clearAnswer(this);
        }
        return committed;
    }
}
