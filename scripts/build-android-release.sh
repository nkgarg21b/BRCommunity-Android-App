#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

required=(ANDROID_KEYSTORE_FILE ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD)
missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then missing+=("$name"); fi
done

if (( ${#missing[@]} > 0 )) && [[ ! -f "$ANDROID_DIR/keystore.properties" ]]; then
  echo "ERROR: production signing is not configured." >&2
  echo "Set: ${required[*]} or create android/keystore.properties from android/keystore.properties.example." >&2
  exit 2
fi

cd "$ANDROID_DIR"
./gradlew clean bundleRelease

AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB" ]]; then
  echo "ERROR: expected release AAB was not produced: $AAB" >&2
  exit 3
fi

echo "Release AAB: $AAB"
