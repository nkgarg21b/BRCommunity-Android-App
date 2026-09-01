# BRCommunity Android Helper — Production Readiness

## Release identity

- [x] Production Android application ID: `com.brcommunity.androidhelper`
- [x] `app.json` is the source of truth for the Android package.
- [x] Release script regenerates the Android project with Expo before Gradle build.
- [ ] Verify the generated package on a physical device.

## Sentry

Required GitHub Actions secrets:

- `EXPO_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT` (recommended: `brcommunity-android-helper`)
- `SENTRY_AUTH_TOKEN`
- `SENTRY_URL` (normally `https://sentry.io/`)

The DSN is public client configuration; the auth token is secret and must never be committed.

## Signing

Required GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The release workflow decodes the upload keystore only for the build and removes it in an `always()` cleanup step. Never commit a `.jks`, `.keystore`, `keystore.properties`, or signing credentials.

## Physical-device checklist

Run on at least two clean Android devices, preferably one Pixel/reference device and one OEM device:

1. Fresh install signed release AAB.
2. Cold launch and first-run flow.
3. Sign in and sign out.
4. Enable/disable Chrome Accessibility service.
5. Verify Chrome detection.
6. Open a supported YouTube URL in Chrome.
7. Verify exact URL gating before engagement.
8. Verify Like/Subscribe action only on the intended surface.
9. Verify close-tab lifecycle.
10. Background the app during an active lifecycle.
11. Lock/unlock the device during an active lifecycle.
12. Trigger screen rotation/configuration changes where applicable.
13. Kill and relaunch the app; verify stale sessions are not resurrected.
14. Reboot the device and verify no unauthorized lifecycle is restored.
15. Test Chrome tab switching while a lifecycle is pending; controller must fail closed.
16. Test invalid/non-HTTPS/non-allowlisted URLs; controller must refuse them.
17. Verify telemetry reaches the production Sentry project without credentials, cookies, email, or managed URLs.
18. Verify no crashes in release build and inspect Android logcat for native errors.
19. Verify battery/background behavior on stock Android and at least one OEM skin.
20. Verify app uninstall/reinstall clears app-owned state as expected.

## Distribution decision

**Recommended initial channel: controlled sideload/internal distribution, not public Google Play.**

The current product uses AccessibilityService to automate Chrome and can autonomously perform actions such as Like/Subscribe. Google Play's current Accessibility API policy prohibits apps from using AccessibilityService to autonomously initiate, plan, and execute actions or decisions unless the app is a genuine accessibility tool whose core purpose is disability support. This product does not meet that accessibility-tool exception based on its current purpose.

Public Play distribution should therefore not be treated as the default path unless the automation design and policy position are changed and validated with Google Play's current requirements.

## Build command

```bash
./scripts/build-android-release.sh
```

The script fails closed if release signing is not configured and regenerates the Android native project before running `bundleRelease`.

## Current blockers

- Sentry production values must be supplied through GitHub Actions secrets.
- A production upload keystore must be generated and supplied through GitHub Actions secrets.
- Physical-device verification requires real Android devices and Chrome.
- Final distribution approval depends on the chosen deployment model and current platform policy.
