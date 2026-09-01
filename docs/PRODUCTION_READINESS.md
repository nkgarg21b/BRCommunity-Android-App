# Production readiness

## CI gates

Every push to `main` and every pull request runs:

- TypeScript typechecking for workspace libraries and artifacts.
- Workspace builds where a build script is present.
- Production dependency vulnerability audit at `high` severity.

## Android release requirements

Before shipping a production build:

1. Set `ANDROID_PACKAGE` to the final application ID.
2. Set `ANDROID_VERSION_CODE` to a monotonically increasing integer.
3. Configure EAS credentials/signing for the production profile.
4. Configure `SENTRY_ORG`, `SENTRY_PROJECT`, and optionally `SENTRY_URL`.
5. Configure `EXPO_PUBLIC_BR_API_BASE` and `EXPO_PUBLIC_BR_SITE_ORIGIN` explicitly for the release environment.
6. Build and test the signed AAB on a clean physical Android device.
7. Verify that accessibility permission, Chrome availability, login expiry, network loss, process death, and app restart are handled safely.

## Security invariants

- Tokens are stored in `expo-secure-store` on native Android.
- Managed URLs are restricted to HTTPS and the explicit YouTube/Instagram host allowlist.
- Chrome actions must pass the native service's current-surface verification gate.
- Ambiguous Chrome surfaces must fail closed rather than selecting an arbitrary tab.
- The API proxy must not log authorization headers or extension tokens.
- Secrets and signing material must never be committed to Git.

## Known platform limitation

Android AccessibilityService does not expose Chrome's private tab ID. The native controller therefore cannot guarantee independent targeting when multiple tabs expose the same URL. The correct behavior is to refuse an ambiguous action, not guess.
