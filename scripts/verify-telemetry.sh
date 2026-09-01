#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

grep -q '"@sentry/react-native": "8.24.0"' package.json
if [ -f ../../pnpm-lock.yaml ]; then
  if grep -q 'artifacts/brcommunity-android-helper:' ../../pnpm-lock.yaml && ! sed -n '/artifacts\/brcommunity-android-helper:/,/^[^ ]/p' ../../pnpm-lock.yaml | grep -q "@sentry/react-native"; then
    printf 'WARNING: pnpm-lock.yaml is stale; run pnpm install before frozen-lockfile CI.\n' >&2
  fi
fi
test -f lib/telemetry.ts
test -f app.config.js
test -f android/app/src/main/java/com/anonymous/brcommunityandroidhelper/TelemetryLog.java
grep -q 'Sentry.wrap' app/_layout.tsx
grep -q 'captureException' components/ErrorBoundary.tsx
grep -q 'getSentryExpoConfig' metro.config.js
grep -q 'EXPO_PUBLIC_SENTRY_DSN' .env.sentry.example
grep -q 'SENTRY_AUTH_TOKEN' docs/TELEMETRY_CRASH_REPORTING.md
! grep -R "SENTRY_AUTH_TOKEN=.*[A-Za-z0-9]" -n .env* 2>/dev/null || true
printf 'Telemetry/crash-reporting checks: PASS\n'
