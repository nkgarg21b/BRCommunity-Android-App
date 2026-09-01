---
name: BRCommunity API proxy
description: Web preview connectivity for the BRCommunity API.
---

The BRCommunity API is reachable but does not provide browser CORS headers, so web preview requests must use the same-origin API proxy. Native Android can call the BRCommunity HTTPS endpoint directly.

**Why:** Browser fetch fails at the CORS boundary even when the upstream server returns healthy HTTP responses.

**How to apply:** Keep web API requests on the local `/api/brcommunity` route and preserve the upstream base URL for native builds.