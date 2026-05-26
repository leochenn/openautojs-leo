package org.autojs.autojs.external.inputmethod;

import android.content.Context;
import android.content.SharedPreferences;

public final class CaptchaImeBridge {

    public static final String ACTION_SET_ANSWER = "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER";
    public static final String EXTRA_ANSWER = "answer";
    public static final String EXTRA_REQUEST_ID = "requestId";

    private static final String PREFS_NAME = "captcha_number_input_method";
    private static final String KEY_ANSWER = "answer";
    private static final String KEY_REQUEST_ID = "request_id";
    private static final String KEY_TIMESTAMP = "timestamp";
    private static final String KEY_COMMITTED_REQUEST_ID = "committed_request_id";
    private static final String KEY_COMMITTED_TIMESTAMP = "committed_timestamp";
    private static final String KEY_COMMITTED_REASON = "committed_reason";
    private static final long MAX_PENDING_AGE_MS = 15000L;

    private CaptchaImeBridge() {
    }

    static void saveAnswer(Context context, String answer, String requestId) {
        String sanitized = sanitizeAnswer(answer);
        if (sanitized.length() == 0) {
            clearAnswer(context);
            return;
        }
        prefs(context).edit()
                .putString(KEY_ANSWER, sanitized)
                .putString(KEY_REQUEST_ID, sanitizeRequestId(requestId))
                .putLong(KEY_TIMESTAMP, System.currentTimeMillis())
                .apply();
    }

    static String getFreshAnswer(Context context) {
        SharedPreferences prefs = prefs(context);
        String answer = prefs.getString(KEY_ANSWER, "");
        long timestamp = prefs.getLong(KEY_TIMESTAMP, 0L);
        if (answer == null || answer.length() == 0) {
            return "";
        }
        if (System.currentTimeMillis() - timestamp > MAX_PENDING_AGE_MS) {
            clearAnswer(context);
            return "";
        }
        return answer;
    }

    static String getPendingRequestId(Context context) {
        String requestId = prefs(context).getString(KEY_REQUEST_ID, "");
        return requestId == null ? "" : requestId;
    }

    static void clearAnswer(Context context) {
        prefs(context).edit()
                .remove(KEY_ANSWER)
                .remove(KEY_REQUEST_ID)
                .remove(KEY_TIMESTAMP)
                .apply();
    }

    static void markCommitted(Context context, String reason) {
        SharedPreferences prefs = prefs(context);
        String requestId = prefs.getString(KEY_REQUEST_ID, "");
        if (requestId == null || requestId.length() == 0) {
            return;
        }
        prefs.edit()
                .putString(KEY_COMMITTED_REQUEST_ID, requestId)
                .putLong(KEY_COMMITTED_TIMESTAMP, System.currentTimeMillis())
                .putString(KEY_COMMITTED_REASON, reason == null ? "" : reason)
                .apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String sanitizeAnswer(String answer) {
        if (answer == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < answer.length(); i++) {
            char c = answer.charAt(i);
            if (c >= '0' && c <= '9') {
                builder.append(c);
            }
        }
        return builder.toString();
    }

    private static String sanitizeRequestId(String requestId) {
        if (requestId == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < requestId.length(); i++) {
            char c = requestId.charAt(i);
            if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') ||
                    (c >= 'A' && c <= 'Z') || c == '_' || c == '-') {
                builder.append(c);
            }
        }
        return builder.toString();
    }
}
