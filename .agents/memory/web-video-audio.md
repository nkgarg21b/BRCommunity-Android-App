---
name: Web video audio
description: Audio behavior for embedded and in-app managed video playback.
---

Web browsers commonly block audible autoplay, so managed preview players must start muted and provide a user-gesture control to unmute and resume playback.

**Why:** Setting autoplay alone is not enough for sound; browsers allow muted autoplay more reliably than audible autoplay.

**How to apply:** Include the provider's playback API when embedding, expose an Enable sound action, and keep native WebView audio unmute available through an explicit user tap.