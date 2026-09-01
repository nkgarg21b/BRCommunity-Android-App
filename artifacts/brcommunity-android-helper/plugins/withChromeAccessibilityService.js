const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');

const SERVICE_CLASS = 'ChromeAccessibilityService';
const MODULE_CLASS = 'ChromeControlModule';
const PACKAGE_CLASS = 'ChromeControlPackage';

function androidPackage(config) {
  return config.android?.package || 'com.anonymous.brcommunityandroidhelper';
}

function javaPackagePath(packageName) {
  return packageName.split('.').join(path.sep);
}

function ensureMainApplicationPackage(contents, packageName) {
  const importLine = `import ${packageName}.${PACKAGE_CLASS}`;
  let next = contents;
  if (!next.includes(importLine)) {
    next = next.replace(/(package\s+[^\n]+\n)/, `$1\n${importLine}\n`);
  }
  if (next.includes(`add(${PACKAGE_CLASS}())`)) return next;
  if (next.includes('PackageList(this).packages.apply {')) {
    return next.replace('PackageList(this).packages.apply {', `PackageList(this).packages.apply {\n        add(${PACKAGE_CLASS}())`);
  }
  return next.replace('PackageList(this).packages', `PackageList(this).packages.apply {\n        add(${PACKAGE_CLASS}())\n      }`);
}

function nativeSources(packageName) {
  const pkg = packageName;
  return {
    [`${SERVICE_CLASS}.java`]: `package ${pkg};

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.Build;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Deterministic Chrome session controller.
 *
 * Security invariant:
 *   NEVER perform an engagement/close action unless the currently active Chrome
 *   surface has been freshly verified against the session's exact normalized URL.
 *
 * Important platform limitation:
 *   Android AccessibilityService does not expose Chrome's private tab ID. Two
 *   Chrome tabs showing the same URL are therefore indistinguishable to a third-
 *   party accessibility service. In that case this controller refuses to act if
 *   the URL cannot be verified, rather than guessing.
 */
public class ChromeAccessibilityService extends AccessibilityService {
  private static final String CHROME_PACKAGE = "com.android.chrome";
  private static final String PREFS = "brcommunity_chrome_control";
  private static final String PREF_SCHEDULED = "scheduled_tabs";
  private static final long RETRY_MS = 1200L;
  private static final long VERIFY_TIMEOUT_MS = 8000L;
  private static final long POST_ACTION_VERIFY_MS = 350L;

  private static volatile ChromeAccessibilityService instance;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Map<String, Session> sessions = new HashMap<>();
  private final AtomicLong generation = new AtomicLong(0L);
  private SharedPreferences preferences;

  private static final class Session {
    final String id;
    final String expectedUrl;
    final long closeAt;
    final long engageAt;
    boolean engaged;
    boolean bound;
    int boundWindowId = AccessibilityWindowInfo.WINDOW_ID_NONE;
    long boundAt;
    long lastVerifiedAt;
    String boundUniqueId;
    final long token;
    Runnable runnable;

    Session(String id, String expectedUrl, long closeAt, long engageAt, boolean engaged) {
      this.id = id;
      this.expectedUrl = normalizeUrl(expectedUrl);
      this.closeAt = closeAt;
      this.engageAt = Math.max(0L, engageAt);
      this.engaged = engaged;
      this.token = System.nanoTime();
    }
  }

  private static final class SurfaceSnapshot {
    final int windowId;
    final String url;
    final String packageName;
    final String uniqueId;

    SurfaceSnapshot(int windowId, String url, String packageName, String uniqueId) {
      this.windowId = windowId;
      this.url = url;
      this.packageName = packageName;
      this.uniqueId = uniqueId;
    }
  }

  public static ChromeAccessibilityService getInstance() {
    return instance;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
  }

  @Override
  protected void onServiceConnected() {
    super.onServiceConnected();
    instance = this;
    // Persisted lifecycle entries belong to a previous service/app process.
    // Never resurrect them automatically: the JS manager will explicitly re-arm
    // current sessions after it has established a fresh runtime session.
    clearPersistedSchedules();
  }

  @Override
  public void onAccessibilityEvent(AccessibilityEvent event) {
    if (event == null || event.getPackageName() == null || !CHROME_PACKAGE.contentEquals(event.getPackageName())) {
      return;
    }
    // Chrome's accessibility tree can change without a stable synchronous view.
    // Re-evaluate due sessions on the main thread after the event has settled.
    handler.post(this::runDueLifecycleActions);
  }

  @Override
  public void onInterrupt() {
    // Do not mutate session state. Android may reconnect the service later.
  }

  @Override
  public void onDestroy() {
    if (instance == this) instance = null;
    generation.incrementAndGet();
    handler.removeCallbacksAndMessages(null);
    synchronized (sessions) {
      for (Session session : sessions.values()) session.runnable = null;
    }
    super.onDestroy();
  }

  /**
   * Engage only the currently verified session. A missing or stale URL bar is a
   * hard failure; we never fall back to domain/text matching.
   */
  public boolean engageTab(String sessionId, String expectedUrl) {
    Session session = getExistingSession(sessionId, expectedUrl);
    if (session == null) return false;

    SurfaceSnapshot surface = verifyAndBind(session);
    if (surface == null) return false;

    boolean clicked = false;
    AccessibilityNodeInfo root = getRootForWindow(surface.windowId);
    if (root == null) return false;

    AccessibilityNodeInfo like = findClickableAction(root, "like", "like this video");
    if (like != null) {
      clicked = like.performAction(AccessibilityNodeInfo.ACTION_CLICK) || clicked;
    }

    AccessibilityNodeInfo subscribe = findClickableAction(root, "subscribe");
    if (subscribe != null) {
      clicked = subscribe.performAction(AccessibilityNodeInfo.ACTION_CLICK) || clicked;
    }

    if (clicked) {
      // Re-verify after the action. This does not prove the remote site accepted
      // it, but it proves we did not continue after the Chrome surface changed.
      handler.postDelayed(() -> verifyAndBind(session), POST_ACTION_VERIFY_MS);
    }
    return clicked;
  }

  /**
   * Close only after the exact URL bar has been verified. We deliberately do not
   * use the old "current tab" name because that API encouraged accidental targeting.
   */
  public boolean closeTab(String sessionId, String expectedUrl) {
    Session session = getExistingSession(sessionId, expectedUrl);
    if (session == null) return false;

    SurfaceSnapshot surface = verifyAndBind(session);
    if (surface == null) return false;

    AccessibilityNodeInfo root = getRootForWindow(surface.windowId);
    if (root == null) return false;

    AccessibilityNodeInfo close = findClickableAction(root, "close tab");
    if (close != null) {
      return close.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }

    // Opening the tab switcher is intentionally not used as a fallback. Once the
    // controller loses the direct target, it must refuse instead of guessing which
    // tab in the switcher is the requested session.
    return false;
  }

  public void scheduleTab(String id, String expectedUrl, long closeAt, long engageAt) {
    scheduleTab(id, expectedUrl, closeAt, engageAt, false);
  }

  private void scheduleTab(String id, String expectedUrl, long closeAt, long engageAt, boolean engaged) {
    if (TextUtils.isEmpty(id) || TextUtils.isEmpty(expectedUrl) || closeAt <= 0) return;
    cancelTab(id, false);
    Session session = new Session(id, expectedUrl, closeAt, engageAt, engaged);
    synchronized (sessions) {
      sessions.put(id, session);
    }
    scheduleLifecycle(session);
    persistScheduledTabs();
  }

  public void cancelTab(String id) {
    cancelTab(id, true);
  }

  private void cancelTab(String id, boolean persist) {
    if (TextUtils.isEmpty(id)) return;
    synchronized (sessions) {
      Session session = sessions.remove(id);
      if (session != null && session.runnable != null) {
        handler.removeCallbacks(session.runnable);
      }
    }
    if (persist) persistScheduledTabs();
  }

  public void clearTabs() {
    synchronized (sessions) {
      for (Session session : sessions.values()) {
        if (session.runnable != null) handler.removeCallbacks(session.runnable);
      }
      sessions.clear();
    }
    persistScheduledTabs();
  }

  private Session getExistingSession(String id, String expectedUrl) {
    if (TextUtils.isEmpty(id) || TextUtils.isEmpty(expectedUrl)) return null;
    String normalized = normalizeUrl(expectedUrl);
    if (normalized == null) return null;
    synchronized (sessions) {
      Session existing = sessions.get(id);
      if (existing == null || !normalized.equals(existing.expectedUrl)) return null;
      return existing;
    }
  }

  private void scheduleLifecycle(Session session) {
    long now = System.currentTimeMillis();
    long target = !session.engaged && session.engageAt > now ? session.engageAt : session.closeAt;
    long delay = Math.max(100L, target - now);
    final long token = session.token;
    Runnable action = () -> runLifecycle(session.id, token);
    session.runnable = action;
    handler.postDelayed(action, delay);
  }

  private void runLifecycle(String id, long token) {
    Session session;
    synchronized (sessions) {
      session = sessions.get(id);
    }
    if (session == null || session.token != token) return;

    long now = System.currentTimeMillis();
    if (!session.engaged && session.engageAt > 0 && now >= session.engageAt && now < session.closeAt) {
      if (engageTab(session.id, session.expectedUrl)) {
        session.engaged = true;
        persistScheduledTabs();
      }
    }

    if (now >= session.closeAt) {
      if (closeTab(session.id, session.expectedUrl)) {
        cancelTab(session.id, true);
        return;
      }
      // Refuse-and-retry. A different active tab, missing URL bar, or changed
      // page never becomes an acceptable target merely because a timer expired.
      session.runnable = () -> runLifecycle(id, session.token);
      handler.postDelayed(session.runnable, RETRY_MS);
      return;
    }

    scheduleLifecycle(session);
  }

  private void runDueLifecycleActions() {
    long now = System.currentTimeMillis();
    List<String> due = new ArrayList<>();
    synchronized (sessions) {
      for (Session session : sessions.values()) {
        if (now >= session.closeAt || (!session.engaged && session.engageAt > 0 && now >= session.engageAt)) {
          due.add(session.id);
        }
      }
    }
    for (String id : due) {
      Session current;
      synchronized (sessions) { current = sessions.get(id); }
      if (current != null) {
        final long token = current.token;
        handler.post(() -> runLifecycle(id, token));
      }
    }
  }

  /**
   * The only gate through which a session can acquire a Chrome surface.
   * Exact URL equality is mandatory. If Chrome does not expose its URL bar we
   * fail closed rather than using page text/domain heuristics.
   */
  private SurfaceSnapshot verifyAndBind(Session session) {
    AccessibilityNodeInfo root = getRootInActiveWindow();
    if (root == null) return null;
    SurfaceSnapshot snapshot = inspectSurface(root);
    if (snapshot == null) return null;
    if (!CHROME_PACKAGE.equals(snapshot.packageName)) return null;
    if (!urlMatches(session.expectedUrl, snapshot.url)) return null;

    if (!session.bound) {
      session.bound = true;
      session.boundWindowId = snapshot.windowId;
      session.boundAt = System.currentTimeMillis();
      session.boundUniqueId = snapshot.uniqueId;
    } else if (session.boundWindowId != snapshot.windowId) {
      // The active accessibility window changed. We do not silently rebind a
      // scheduled session to another window.
      return null;
    }
    if (!TextUtils.isEmpty(session.boundUniqueId) && !TextUtils.isEmpty(snapshot.uniqueId)
        && !session.boundUniqueId.equals(snapshot.uniqueId)) {
      return null;
    }

    session.lastVerifiedAt = System.currentTimeMillis();
    return snapshot;
  }

  private SurfaceSnapshot inspectSurface(AccessibilityNodeInfo root) {
    if (root == null) return null;
    int windowId = root.getWindowId();
    String url = findChromeUrl(root);
    String packageName = root.getPackageName() == null ? "" : root.getPackageName().toString();
    if (TextUtils.isEmpty(url)) return null;
    String uniqueId = "";
    if (Build.VERSION.SDK_INT >= 33) {
      uniqueId = safe(root.getUniqueId());
    }
    return new SurfaceSnapshot(windowId, normalizeUrl(url), packageName, uniqueId);
  }

  private AccessibilityNodeInfo getRootForWindow(int expectedWindowId) {
    if (expectedWindowId == AccessibilityWindowInfo.WINDOW_ID_NONE) return null;
    AccessibilityNodeInfo root = getRootInActiveWindow();
    if (root == null || root.getWindowId() != expectedWindowId) return null;
    return root;
  }

  private String findChromeUrl(AccessibilityNodeInfo root) {
    ArrayDeque<AccessibilityNodeInfo> pending = new ArrayDeque<>();
    pending.add(root);
    while (!pending.isEmpty()) {
      AccessibilityNodeInfo node = pending.removeFirst();
      String viewId = safe(node.getViewIdResourceName());
      String text = safe(node.getText());
      String description = safe(node.getContentDescription());
      if (viewId.toLowerCase(Locale.ROOT).contains("url_bar") || viewId.toLowerCase(Locale.ROOT).contains("location_bar")) {
        String candidate = !TextUtils.isEmpty(text) ? text : description;
        if (looksLikeUrl(candidate)) return candidate;
      }
      if (looksLikeUrl(text) && isLikelyChromeUrlBar(node)) return text;
      if (looksLikeUrl(description) && isLikelyChromeUrlBar(node)) return description;
      for (int i = 0; i < node.getChildCount(); i++) {
        AccessibilityNodeInfo child = node.getChild(i);
        if (child != null) pending.add(child);
      }
    }
    return "";
  }

  private boolean isLikelyChromeUrlBar(AccessibilityNodeInfo node) {
    String viewId = safe(node.getViewIdResourceName()).toLowerCase(Locale.ROOT);
    if (viewId.contains("url_bar") || viewId.contains("location_bar")) return true;
    CharSequence className = node.getClassName();
    return className != null && className.toString().toLowerCase(Locale.ROOT).contains("edittext");
  }

  private boolean looksLikeUrl(String value) {
    if (TextUtils.isEmpty(value)) return false;
    String candidate = value.trim();
    return candidate.startsWith("https://") || candidate.startsWith("http://") || candidate.matches("^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$");
  }

  private AccessibilityNodeInfo findClickableAction(AccessibilityNodeInfo root, String... labels) {
    ArrayDeque<AccessibilityNodeInfo> pending = new ArrayDeque<>();
    pending.add(root);
    while (!pending.isEmpty()) {
      AccessibilityNodeInfo node = pending.removeFirst();
      String description = safe(node.getContentDescription()).toLowerCase(Locale.ROOT);
      String text = safe(node.getText()).toLowerCase(Locale.ROOT);
      for (String label : labels) {
        String needle = label.toLowerCase(Locale.ROOT);
        if (description.contains(needle) || text.contains(needle)) {
          AccessibilityNodeInfo clickable = node.isClickable() ? node : findClickableAncestor(node);
          if (clickable != null) return clickable;
        }
      }
      for (int i = 0; i < node.getChildCount(); i++) {
        AccessibilityNodeInfo child = node.getChild(i);
        if (child != null) pending.add(child);
      }
    }
    return null;
  }

  private AccessibilityNodeInfo findClickableAncestor(AccessibilityNodeInfo node) {
    AccessibilityNodeInfo current = node;
    for (int depth = 0; current != null && depth < 5; depth++) {
      if (current.isClickable()) return current;
      current = current.getParent();
    }
    return null;
  }

  private static String safe(CharSequence value) {
    return value == null ? "" : value.toString();
  }

  static String normalizeUrl(String value) {
    return ChromeSessionPolicy.normalizeUrl(value);
  }

  static boolean urlMatches(String expected, String observed) {
    return ChromeSessionPolicy.urlMatches(expected, observed);
  }

  private void persistScheduledTabs() {
    if (preferences == null) return;
    JSONArray array = new JSONArray();
    synchronized (sessions) {
      for (Session session : sessions.values()) {
        try {
          JSONObject item = new JSONObject();
          item.put("id", session.id);
          item.put("url", session.expectedUrl);
          item.put("closeAt", session.closeAt);
          item.put("engageAt", session.engageAt);
          item.put("engaged", session.engaged);
          array.put(item);
        } catch (Exception ignored) {}
      }
    }
    preferences.edit().putString(PREF_SCHEDULED, array.toString()).apply();
  }

  private void clearPersistedSchedules() {
    if (preferences != null) preferences.edit().remove(PREF_SCHEDULED).apply();
  }
}
`,
    [`ChromeSessionPolicy.java`]: `package ${pkg};

import java.net.URI;
import java.util.Locale;

/** Pure-Java session identity policy; deliberately has no Android dependencies. */
public final class ChromeSessionPolicy {
  private ChromeSessionPolicy() {}

  public static String normalizeUrl(String value) {
    if (value == null || value.trim().isEmpty()) return null;
    try {
      URI uri = URI.create(value.trim());
      String scheme = uri.getScheme();
      String host = uri.getHost();
      if (scheme == null || host == null) return null;
      scheme = scheme.toLowerCase(Locale.ROOT);
      host = host.toLowerCase(Locale.ROOT);
      if (!"https".equals(scheme) && !"http".equals(scheme)) return null;
      String path = uri.getPath() == null || uri.getPath().isEmpty() ? "/" : uri.getPath();
      StringBuilder normalized = new StringBuilder();
      normalized.append(scheme).append("://").append(host);
      if (uri.getPort() != -1) normalized.append(':').append(uri.getPort());
      normalized.append(path);
      if (uri.getQuery() != null && !uri.getQuery().isEmpty()) normalized.append('?').append(uri.getQuery());
      return normalized.toString();
    } catch (Exception ignored) {
      return null;
    }
  }

  public static boolean urlMatches(String expected, String observed) {
    String a = normalizeUrl(expected);
    String b = normalizeUrl(observed);
    return a != null && a.equals(b);
  }
}
`,
    [`${MODULE_CLASS}.java`]: `package ${pkg};

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

public class ${MODULE_CLASS} extends ReactContextBaseJavaModule {
  private static final String CHROME_PACKAGE = "com.android.chrome";
  private static final String CHROME_MAIN_ACTIVITY = "com.google.android.apps.chrome.Main";

  public ${MODULE_CLASS}(ReactApplicationContext context) {
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
    ${SERVICE_CLASS} service = ${SERVICE_CLASS}.getInstance();
    if (service == null) {
      promise.reject("CHROME_SERVICE_UNAVAILABLE", "Chrome accessibility service is not connected.");
      return;
    }
     promise.resolve(service.closeTab(tabId, expectedUrl));
  }

  @ReactMethod
   public void engageTab(String tabId, String expectedUrl, Promise promise) {
    ${SERVICE_CLASS} service = ${SERVICE_CLASS}.getInstance();
    if (service == null) {
      promise.reject("CHROME_SERVICE_UNAVAILABLE", "Chrome accessibility service is not connected.");
      return;
    }
     promise.resolve(service.engageTab(tabId, expectedUrl));
   }

   @ReactMethod
   public void scheduleTabLifecycle(String tabId, String expectedUrl, double closeAt, double engageAt, Promise promise) {
     try {
       ${SERVICE_CLASS} service = ${SERVICE_CLASS}.getInstance();
       if (service == null) throw new IllegalStateException("Chrome control service is not connected.");
       service.scheduleTab(tabId, expectedUrl, (long) closeAt, (long) engageAt);
       promise.resolve(null);
     } catch (Exception error) {
       promise.reject("CHROME_SCHEDULE_FAILED", error);
     }
   }

   @ReactMethod
   public void cancelTabLifecycle(String tabId, Promise promise) {
     try {
       ${SERVICE_CLASS} service = ${SERVICE_CLASS}.getInstance();
       if (service == null) throw new IllegalStateException("Chrome control service is not connected.");
       service.cancelTab(tabId);
       promise.resolve(null);
     } catch (Exception error) {
       promise.reject("CHROME_CANCEL_FAILED", error);
     }
   }

   @ReactMethod
   public void clearTabLifecycles(Promise promise) {
     try {
       ${SERVICE_CLASS} service = ${SERVICE_CLASS}.getInstance();
       if (service == null) {
         promise.resolve(null);
         return;
       }
       service.clearTabs();
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
    ComponentName expected = new ComponentName(getReactApplicationContext(), ${SERVICE_CLASS}.class);
    for (String entry : enabled.split(":")) {
      ComponentName actual = ComponentName.unflattenFromString(entry);
      if (expected.equals(actual)) return true;
    }
    return false;
  }
}
`,
    [`${PACKAGE_CLASS}.java`]: `package ${pkg};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ${PACKAGE_CLASS} implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new ${MODULE_CLASS}(context));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.emptyList();
  }
}
`,
  };
}

module.exports = function withChromeAccessibilityService(config) {
  const packageName = androidPackage(config);

  config = withAndroidManifest(config, (mod) => {
    const services = mod.modResults.manifest.application?.[0]?.service || [];
    const alreadyRegistered = services.some((service) => service.$?.['android:name'] === `.${SERVICE_CLASS}`);
    if (!alreadyRegistered) {
      services.push({
        $: {
          'android:name': `.${SERVICE_CLASS}`,
          'android:label': 'BRCommunity Chrome control',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }] }],
        'meta-data': [{ $: { 'android:name': 'android.accessibilityservice', 'android:resource': '@xml/chrome_accessibility_service_config' } }],
      });
    }
    mod.modResults.manifest.application[0].service = services;
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    mod.modResults.contents = ensureMainApplicationPackage(mod.modResults.contents, packageName);
    return mod;
  });

  config = withDangerousMod(config, ['android', async (mod) => {
    const androidRoot = mod.modRequest.platformProjectRoot;
    const packageDir = path.join(androidRoot, 'app', 'src', 'main', 'java', javaPackagePath(packageName));
    fs.mkdirSync(packageDir, { recursive: true });
    for (const [filename, contents] of Object.entries(nativeSources(packageName))) {
      fs.writeFileSync(path.join(packageDir, filename), contents);
    }
    const xmlDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, 'chrome_accessibility_service_config.xml'), `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged|typeViewClicked"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:packageNames="com.android.chrome"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true" />`);
    return mod;
  }]);

  return config;
};