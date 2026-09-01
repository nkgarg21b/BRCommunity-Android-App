#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
if find "$root" -type f \( -name '*.jks' -o -name '*.keystore' \) -print -quit | grep -q .; then echo 'ERROR: keystore committed'; fail=1; fi
if grep -RInE 'BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY|ghp_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+' "$root" --exclude-dir=.git --exclude='*.png' --exclude='*.webp' --exclude='*.jar' >/dev/null 2>&1; then echo 'ERROR: private/token material detected'; fail=1; fi
if grep -RIn 'signingConfig signingConfigs.debug' "$root/android" >/dev/null 2>&1; then echo 'ERROR: debug signing used by release'; fail=1; fi
for f in context/ManagerContext.tsx lib/storage.ts android/app/src/main/java/com/anonymous/brcommunityandroidhelper/NativeChromeScheduler.java android/app/src/main/java/com/anonymous/brcommunityandroidhelper/ChromeScheduleReceiver.java; do test -f "$root/$f" || { echo "ERROR: missing $f"; fail=1; }; done
if grep -q 'workspace:*' "$root/package.json"; then echo 'ERROR: unresolved workspace dependency'; fail=1; fi
if test ! -f "$root/pnpm-lock.yaml"; then echo 'ERROR: pnpm-lock.yaml is required for reproducible CI/release builds'; fail=1; fi
exit "$fail"
