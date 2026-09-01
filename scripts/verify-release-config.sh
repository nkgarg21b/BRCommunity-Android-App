#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT_DIR/android/app/build.gradle"
PROPS_EXAMPLE="$ROOT_DIR/android/keystore.properties.example"

fail=0
require() { grep -qF "$1" "$2" || { echo "FAIL: $1"; fail=1; }; }
require 'minifyEnabled true' "$BUILD"
require 'shrinkResources enableShrinkResources' "$BUILD"
require 'proguard-android-optimize.txt' "$BUILD"
require 'if (releaseSigningConfigured)' "$BUILD"
require 'ANDROID_KEYSTORE_FILE' "$BUILD"
require 'Debug signing is never used for release builds.' "$BUILD"
require 'storeFile=' "$PROPS_EXAMPLE"
require 'storePassword=' "$PROPS_EXAMPLE"
require 'keyAlias=' "$PROPS_EXAMPLE"
require 'keyPassword=' "$PROPS_EXAMPLE"

if grep -qE "signingConfig signingConfigs\.debug|storePassword ['\"]android['\"]|keyAlias ['\"]androiddebugkey['\"]" "$BUILD"; then
  echo "FAIL: release build still contains debug signing credentials/configuration"
  fail=1
fi

if [[ -f "$ROOT_DIR/android/app/debug.keystore" ]]; then
  echo "FAIL: debug keystore must not be committed in the production source tree"
  fail=1
fi

if (( fail )); then exit 1; fi
echo "Release configuration checks: PASS"
