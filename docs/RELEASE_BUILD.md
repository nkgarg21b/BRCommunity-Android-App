# Production Android Release Build

## Signing policy

Release builds are **fail-closed**: the `release` variant never falls back to the Android debug keystore.

Signing can be supplied either by environment variables (recommended for CI) or by a local, ignored `android/keystore.properties` file.

Environment variables:

- `ANDROID_KEYSTORE_FILE`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The local file uses the same four values as `key=value` entries. Start from `android/keystore.properties.example`.

## CI example

Store the keystore as a protected CI secret/file and export:

```text
ANDROID_KEYSTORE_FILE=/secure/runner/brcommunity-upload.jks
ANDROID_KEYSTORE_PASSWORD=***
ANDROID_KEY_ALIAS=brcommunity-upload
ANDROID_KEY_PASSWORD=***
ANDROID_VERSION_CODE=2
ANDROID_VERSION_NAME=1.0.1
```

Then run:

```bash
./scripts/build-android-release.sh
```

The production artifact is:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Local keystore generation

Only generate a new upload/release key when the product's key-management policy allows it:

```bash
./scripts/generate-release-keystore.sh /secure/path/brcommunity-upload.jks brcommunity-upload
```

Back up the keystore and credentials securely. Never place either in Git, the application bundle, or a public artifact.

## Versioning

`ANDROID_VERSION_CODE` and `ANDROID_VERSION_NAME` override the Gradle defaults. Keep `versionCode` monotonically increasing for Play releases. `app.json` also declares the matching Android version code for Expo/prebuild consistency.

## Release optimizations

The release variant enforces:

- R8/minification
- resource shrinking
- non-debuggable APK/AAB
- optimized Android ProGuard defaults
- no debug signing fallback
- no cleartext traffic through the application network configuration

## Verification checklist

Before publishing:

1. Verify the AAB is signed with the intended production/upload key.
2. Verify the application ID is the production package.
3. Verify version code/name.
4. Run a clean install/upgrade test on a physical device.
5. Test AccessibilityService registration after install/upgrade.
6. Test Chrome lifecycle behavior with the release build.
7. Preserve the signing key and Play Console recovery material in secure, independent backups.
