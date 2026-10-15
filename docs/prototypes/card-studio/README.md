# ORYN Card Studio (prototype)

Interactive design prototype, published as a private claude.ai artifact on 2026-09-30:
https://claude.ai/artifact/8WkJnaY8EaL9bWuF3Po2DC

- Design a luxury card for an Identity Capsule: 7 materials (obsidian, midnight, pearl, carbon, marble, titanium, any colour), 7 foils, 3 finishes (matte, foil, holographic), 4 fonts with Hebrew support, 4 layouts, photo/logo upload.
- Per-detail sharing: shown now / on request / private. Private details are never put into the QR or link.
- The back of the card holds a QR; the link carries the design (compressed) and opens the recipient view on another device.
- Runs entirely in the browser; nothing is sent to a server. Not yet part of the ORYN app — see PRODUCT_DECISIONS.

Build: `python3 build.py <public-url>` → `index.html` (inlines the QR encoder bundled from the `qrcode` package).
