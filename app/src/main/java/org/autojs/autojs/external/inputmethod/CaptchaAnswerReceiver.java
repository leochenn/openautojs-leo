package org.autojs.autojs.external.inputmethod;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class CaptchaAnswerReceiver extends BroadcastReceiver {

    private static final String TAG = "CaptchaInputMethod";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !CaptchaImeBridge.ACTION_SET_ANSWER.equals(intent.getAction())) {
            return;
        }
        String requestId = intent.getStringExtra(CaptchaImeBridge.EXTRA_REQUEST_ID);
        CaptchaImeBridge.saveAnswer(
                context,
                intent.getStringExtra(CaptchaImeBridge.EXTRA_ANSWER),
                requestId
        );
        Log.i(TAG, "received captcha answer requestId=" + requestId);
        CaptchaNumberInputMethodService.commitPendingAnswerIfActive();
    }
}
