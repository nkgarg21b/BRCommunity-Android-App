package com.anonymous.brcommunityandroidhelper;

import android.util.Log;
import org.json.JSONObject;

final class TelemetryLog {
  private static final String TAG = "BRCommunityTelemetry";

  private TelemetryLog() {}

  static void event(String name, String sessionId, String outcome) {
    try {
      JSONObject data = new JSONObject();
      data.put("event", name);
      data.put("outcome", outcome == null ? "unknown" : outcome);
      if (sessionId != null) data.put("session_id", sessionId);
      data.put("timestamp", System.currentTimeMillis());
      Log.i(TAG, data.toString());
    } catch (Exception ignored) {
      Log.i(TAG, name);
    }
  }

  static void error(String name, String sessionId, Throwable error) {
    try {
      JSONObject data = new JSONObject();
      data.put("event", name);
      data.put("outcome", "error");
      if (sessionId != null) data.put("session_id", sessionId);
      data.put("error_type", error == null ? "unknown" : error.getClass().getSimpleName());
      data.put("timestamp", System.currentTimeMillis());
      Log.e(TAG, data.toString(), error);
    } catch (Exception ignored) {
      Log.e(TAG, name, error);
    }
  }
}
