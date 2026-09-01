package com.anonymous.brcommunityandroidhelper;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ChromeScheduleReceiver extends BroadcastReceiver {
  public static final String EXTRA_ID = "session_id";
  public static final String EXTRA_ACTION = "action";
  public static final String EXTRA_TOKEN = "token";

  @Override public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    String id = intent.getStringExtra(EXTRA_ID);
    long token = intent.getLongExtra(EXTRA_TOKEN, 0L);
    if (id == null || token == 0L) return;
    NativeChromeScheduler.get(context).onAlarm(id, token);
  }
}
