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
        CaptchaImeBridge.saveAnswer(context, intent.getStringExtra(CaptchaImeBridge.EXTRA_ANSWER));
        Log.i(TAG, "received captcha answer");
        CaptchaNumberInputMethodService.commitPendingAnswerIfActive();
    }
}
