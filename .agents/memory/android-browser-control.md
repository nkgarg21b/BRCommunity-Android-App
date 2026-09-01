---
name: Android browser control
description: Why BRCommunity mobile management uses an in-app browser surface instead of silently driving the separate Chrome app.
---

Android's normal app sandbox does not allow one app to resize, close, or inject JavaScript into another app such as Chrome. The reliable equivalent is a controlled in-app WebView, where playback, engagement injection, timers, layout, and telemetry remain under app control.

**Why:** The desktop extension depends on privileged Chrome windows, tabs, scripting, and alarms APIs that do not exist for a regular Android app.

**How to apply:** Keep the in-app browser as the default managed surface. Treat external Chrome opening as an unmanaged fallback unless a future custom Android build explicitly adds and documents an AccessibilityService.