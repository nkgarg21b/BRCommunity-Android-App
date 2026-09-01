# Telemetry and Crash Reporting

The app uses `@sentry/react-native` for production crash reporting and a small local structured telemetry ring buffer for diagnostics.

## Runtime

Set:

- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
- `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`

The DSN is a public client identifier; the Sentry auth token is not. Do not ship `SENTRY_AUTH_TOKEN` in the APK/AAB or source repository.

The app reports JS and native crashes through Sentry when a DSN is configured. The root error boundary also explicitly captures render errors.

## Structured telemetry

Events are emitted for:

- API request success/failure
- Chrome open/close/engage operations
- Chrome service connection/destruction
- root React error-boundary failures

Only non-sensitive metadata is retained. Raw URLs, credentials, authorization headers, cookies and email addresses are deliberately excluded.

The last 200 structured events are retained locally for diagnostics and never automatically uploaded as a bulk log.

## Build-time Sentry configuration

Set `SENTRY_ORG`, `SENTRY_PROJECT`, and optionally `SENTRY_URL` in CI. `app.config.js` adds the Sentry Expo plugin only when the organization and project are present. Keep `SENTRY_AUTH_TOKEN` in the CI secret store.

Sentry's current React Native SDK supports automatic native crash tracking, offline event storage, Expo, Hermes and the React Native New Architecture. The project is pinned to `@sentry/react-native` 8.24.0. See the official Sentry documentation before upgrading.

## Dependency lockfile

The source package declares `@sentry/react-native` 8.24.0. Because this environment does not have pnpm/network access, the workspace lockfile was not regenerated here. Before a frozen-lockfile CI build, run `pnpm install` once from the workspace root and commit the resulting `pnpm-lock.yaml` update.
