---
name: BRCommunity Helper identity
description: Authentication requirements for BRCommunity Helper clients.
---

BRCommunity Helper login requires a stable client device_id and may use device_label to identify the Helper installation.

**Why:** The server rejects credential-only extension login attempts with a fresh-Helper/device-identity error.

**How to apply:** Generate the identity once per installation, persist it with the other Helper credentials, and send it in every extension-login request.