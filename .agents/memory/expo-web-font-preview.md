---
name: Expo web font preview
description: The web preview can time out while waiting for bundled Expo Google fonts even when Android font loading is healthy.
---

When the mobile app's web preview hits a FontFaceObserver timeout, use platform-specific font handling: load bundled product fonts and vector icons only on native platforms, and use system/text fallbacks on web.

**Why:** The preview browser can fail the font observer independently of the Android runtime, and Expo vector icons can start the same observer dynamically on authenticated screens.

**How to apply:** Keep native font loading and splash gating intact; do not call Expo's useFonts hook or render Expo vector icon components on web. Use platform-specific wrappers instead.