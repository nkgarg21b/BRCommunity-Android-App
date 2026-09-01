#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="${1:-$PWD/brcommunity-upload.jks}"
ALIAS="${2:-brcommunity-upload}"

if [[ -e "$OUT_FILE" ]]; then
  echo "Refusing to overwrite existing keystore: $OUT_FILE" >&2
  exit 2
fi

keytool -genkeypair \
  -v \
  -keystore "$OUT_FILE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -sigalg SHA256withRSA

echo "Created keystore: $OUT_FILE"
echo "Store it in secure backup(s). Do not commit it to source control."
