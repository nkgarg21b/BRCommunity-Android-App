# Chrome Session Controller

## Targeting invariant

The native controller is fail-closed. An engagement or close operation is permitted only when all of the following are true:

1. The requested session ID exists or can be represented as a transient request.
2. The expected URL is valid and normalized.
3. The active accessibility package is `com.android.chrome`.
4. Chrome exposes a URL-bar value through the accessibility tree.
5. The observed URL is an **exact normalized URL match** to the expected URL.
6. After the first successful verification, the accessibility window ID must remain unchanged.
7. On Android 13/API 33+, when Chrome exposes a root `uniqueId`, it must remain unchanged for the bound session.

If any check fails, the controller returns `false` and does not click or close anything.

## What was removed

The previous implementation used `getRootInActiveWindow()` plus host/domain text matching and could then act on whichever Chrome tab happened to be active. It also opened the tab switcher as a fallback and attempted to close a tab asynchronously while returning `false` synchronously.

The new implementation:

- never uses hostname-only matching as authorization;
- never opens the tab switcher as an automated fallback;
- never rebinds a scheduled session to a different accessibility window;
- verifies the URL immediately before the action;
- treats a missing URL-bar value as an unsafe/unknown state;
- returns the actual result of the close/engagement action.

## Platform limitation

Android's public AccessibilityService API does not expose Chrome's private internal tab identifier. Chrome documents that its web-content accessibility provider is associated with each tab, but a third-party accessibility service cannot directly address Chrome's internal tab object by the custom `tabId` sent in an Intent.

Therefore, absolute identity between two Chrome tabs that contain the **same URL and otherwise indistinguishable accessibility state** cannot be proven using this API alone. The controller deliberately refuses to guess in ambiguous cases. The security property provided here is therefore:

> No action is performed unless the currently controllable Chrome page is freshly and exactly verified as the requested URL/session surface.

For a stronger per-tab identity guarantee, the product would need a Chrome-controlled integration that exposes tab IDs, rather than relying on Android AccessibilityService alone.

## Verification performed

The pure-Java `ChromeSessionPolicy` was compiled and executed independently with tests covering:

- URL case normalization;
- different video/page rejection;
- different path rejection;
- root-path normalization;
- unsafe scheme rejection.

The Expo config plugin JavaScript was also syntax-checked. A full Android Gradle compile could not be completed in this environment because the Gradle wrapper attempted to download Gradle from `services.gradle.org`, while this environment has no outbound network access.
