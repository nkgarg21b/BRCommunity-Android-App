#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/brcommunity-chrome-session-policy-test"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cat > "$BUILD_DIR/ChromeSessionPolicyCheck.java" <<'JAVA'
import com.anonymous.brcommunityandroidhelper.ChromeSessionPolicy;
public class ChromeSessionPolicyCheck {
  private static void check(boolean ok, String name) {
    if (!ok) throw new AssertionError(name);
  }
  public static void main(String[] args) {
    check(ChromeSessionPolicy.urlMatches("HTTPS://WWW.YouTube.com/watch?v=abc", "https://www.youtube.com/watch?v=abc"), "case normalization");
    check(!ChromeSessionPolicy.urlMatches("https://www.youtube.com/watch?v=abc", "https://www.youtube.com/watch?v=xyz"), "different page");
    check(!ChromeSessionPolicy.urlMatches("https://www.youtube.com/watch?v=abc", "https://www.youtube.com/"), "different path");
    check("https://youtube.com/".equals(ChromeSessionPolicy.normalizeUrl("https://youtube.com")), "root path");
    check(ChromeSessionPolicy.normalizeUrl("javascript:alert(1)") == null, "unsafe scheme");
  }
}
JAVA
javac -d "$BUILD_DIR" \
  "$ROOT/android/app/src/main/java/com/anonymous/brcommunityandroidhelper/ChromeSessionPolicy.java" \
  "$BUILD_DIR/ChromeSessionPolicyCheck.java"
java -cp "$BUILD_DIR" ChromeSessionPolicyCheck
echo "Chrome session policy: PASS"
