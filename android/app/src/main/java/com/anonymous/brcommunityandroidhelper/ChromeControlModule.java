package com.anonymous.brcommunityandroidhelper;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class ChromeControlModule extends ReactContextBaseJavaModule {
  private static final String CHROME_PACKAGE = "com.android.chrome";
  private static final String CHROME_MAIN_ACTIVITY = "com.google.android.apps.chrome.Main";

  public ChromeControlModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "ChromeControl";
  }

  @ReactMethod
  public void getStatus(Promise promise) {
    try {
      WritableMap result = Arguments.createMap();
      result.putBoolean("supported", true);
      result.putBoolean("enabled", isAccessibilityEnabled());
      result.putBoolean("chromeInstalled", isChromeInstalled());
      promise.resolve(result);
    } catch (Exception error) {
      promise.reject("CHROME_STATUS_FAILED", error);
    }
  }

  @ReactMethod
  public void openAccessibilitySettings(Promise promise) {
    try {
      Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getReactApplicationContext().startActivity(intent);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("ACCESSIBILITY_SETTINGS_FAILED", error);
    }
  }

  @ReactMethod
   public void openChromeUrl(String url, String tabId, boolean incognito, Promise promise) {
    try {
      if (!isChromeInstalled()) throw new IllegalStateException("Google Chrome is not installed.");
      if (!isAccessibilityEnabled()) throw new IllegalStateException("Enable Chrome control in Android Accessibility settings first.");
      Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
      intent.setPackage(CHROME_PACKAGE);
      intent.setComponent(new ComponentName(CHROME_PACKAGE, CHROME_MAIN_ACTIVITY));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NEW_DOCUMENT | Intent.FLAG_ACTIVITY_MULTIPLE_TASK);
      intent.putExtra("brcommunity_tab_id", tabId);
      intent.putExtra("com.google.android.apps.chrome.EXTRA_OPEN_NEW_INCOGNITO_TAB", incognito);
      if (intent.resolveActivity(getReactApplicationContext().getPackageManager()) == null) {
        throw new IllegalStateException("Google Chrome cannot open this link on this device.");
      }
      getReactApplicationContext().startActivity(intent);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("CHROME_OPEN_FAILED", error);
    }
  }

  @ReactMethod
   public void closeTab(String tabId, String expectedUrl, Promise promise) {
    ChromeAccessibilityService service = ChromeAccessibilityService.getInstance();
    if (service == null) {
      promise.reject("CHROME_SERVICE_UNAVAILABLE", "Chrome accessibility service is not connected.");
      return;
    }
     promise.resolve(service.closeTab(tabId, expectedUrl));
  }

  @ReactMethod
   public void engageTab(String tabId, String expectedUrl, Promise promise) {
    ChromeAccessibilityService service = ChromeAccessibilityService.getInstance();
    if (service == null) {
      promise.reject("CHROME_SERVICE_UNAVAILABLE", "Chrome accessibility service is not connected.");
      return;
    }
     promise.resolve(service.engageTab(tabId, expectedUrl));
   }

   @ReactMethod
   public void beginChromeRuntimeSession(String runtimeId, Promise promise) {
     try {
       ChromeAccessibilityService service = ChromeAccessibilityService.getInstance();
       if (service == null) throw new IllegalStateException("Chrome control service is not connected.");
       NativeChromeScheduler.get(getReactApplicationContext()).beginRuntimeSession(runtimeId);
       promise.resolve(null);
     } catch (Exception error) { promise.reject("CHROME_RUNTIME_BEGIN_FAILED", error); }
   }

   @ReactMethod
   public void touchChromeRuntimeSession(String runtimeId, Promise promise) {
     try {
       ChromeAccessibilityService service = ChromeAccessibilityService.getInstance();
       if (service == null) throw new IllegalStateException("Chrome control service is not connected.");
       NativeChromeScheduler.get(getReactApplicationContext()).touchRuntime(runtimeId);
       promise.resolve(null);
     } catch (Exception error) { promise.reject("CHROME_RUNTIME_TOUCH_FAILED", error); }
   }

   @ReactMethod
   public void scheduleTabLifecycle(String tabId, String expectedUrl, double closeAt, double engageAt, Promise promise) {
     try {
       ChromeAccessibilityService service = ChromeAccessibilityService.getInstance();
       if (service == null) throw new IllegalStateException("Chrome control service is not connected.");
       String runtimeId = NativeChromeScheduler.get(getReactApplicationContext()).getActiveRuntimeId();
       if (runtimeId == null || runtimeId.isEmpty()) throw new IllegalStateException("Native Chrome runtime is not active.");
       NativeChromeScheduler.get(getReactApplicationContext()).schedule(runtimeId, tabId, expectedUrl, (long) closeAt, (long) engageAt, false, System.nanoTime());
       promise.resolve(null);
     } catch (Exception error) {
       promise.reject("CHROME_SCHEDULE_FAILED", error);
     }
   }

   @ReactMethod
   public void cancelTabLifecycle(String tabId, Promise promise) {
     try {
       ChromeAccessibilityService service = ChromeAccessibilityService.getInstance();
       if (service == null) throw new IllegalStateException("Chrome control service is not connected.");
       NativeChromeScheduler.get(getReactApplicationContext()).cancel(tabId);
       promise.resolve(null);
     } catch (Exception error) {
       promise.reject("CHROME_CANCEL_FAILED", error);
     }
   }

   @ReactMethod
   public void clearTabLifecycles(Promise promise) {
     try {
       ChromeAccessibilityService service = ChromeAccessibilityService.getInstance();
       if (service == null) {
         promise.resolve(null);
         return;
       }
       NativeChromeScheduler.get(getReactApplicationContext()).clear();
       promise.resolve(null);
     } catch (Exception error) {
       promise.reject("CHROME_CLEAR_SCHEDULE_FAILED", error);
     }
  }

  private boolean isChromeInstalled() {
    try {
      getReactApplicationContext().getPackageManager().getPackageInfo(CHROME_PACKAGE, 0);
      return true;
    } catch (PackageManager.NameNotFoundException ignored) {
      return false;
    }
  }

  private boolean isAccessibilityEnabled() {
    String enabled = Settings.Secure.getString(getReactApplicationContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
    if (enabled == null) return false;
    ComponentName expected = new ComponentName(getReactApplicationContext(), ChromeAccessibilityService.class);
    for (String entry : enabled.split(":")) {
      ComponentName actual = ComponentName.unflattenFromString(entry);
      if (expected.equals(actual)) return true;
    }
    return false;
  }
}
