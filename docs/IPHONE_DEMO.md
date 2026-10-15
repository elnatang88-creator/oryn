# Opening ORIAN on an iPhone today

There is **no hosted staging environment and no deployment credentials in this repository or session**, so no preview URL exists yet. Nothing below invents one. Two honest routes, fastest first.

## Route A — your Mac + your iPhone on the same Wi-Fi (10 minutes, no accounts)
Camera, geolocation and the install-to-home-screen flow need HTTPS; plain HTTP works for the card journey (sign up → card → Studio → publish → share → public card → save contact → connect).

```bash
git clone <repo> && cd oryn && git checkout oryn-v1
npm ci
cp .env.example .env.local
# edit .env.local — minimum for a LAN demo:
#   ORYN_SECRET=<32+ random chars>
#   ORYN_SEED_DEMO=true          # fictional demo accounts, clearly labelled in the UI
#   ORYN_INSECURE_COOKIES=true   # only because this is plain http on a private network
#   ORYN_DEMO_PASSWORD=<pick one; never share it publicly>
npm run build && npm start -- -H 0.0.0.0 -p 3000
```
On the iPhone (same Wi-Fi) open Safari → `http://<your-mac-ip>:3000/welcome` (find the IP in System Settings → Wi-Fi → Details). Sign up with a fresh email, or sign in with the demo account you set the password for.

For HTTPS on the LAN (enables camera check-in, Nearby location and "Add to Home Screen" as an app): `brew install caddy`, then `caddy reverse-proxy --from <mac-name>.local --to localhost:3000` and accept Caddy's local certificate on the phone once.

## Route B — a public URL on a VPS (about 30 minutes, needs a domain)
Uses the reference Docker stack in `deploy/` (Caddy TLS, app, scheduler, PostgreSQL 16, backups). See DEPLOYMENT.md.
1. A VPS (2 vCPU / 4 GB is plenty) with Docker, and a DNS A record `orian.<your-domain>` → VPS IP.
2. `git clone … && cd oryn/deploy && cp .env.example .env && ./gen-env.sh` → set `ORYN_DOMAIN`, keep `ORYN_SEED_DEMO=false` for anything public (or `true` only for a private, password-protected demo host).
3. `docker compose up -d --build` → Caddy obtains the certificate; open `https://orian.<your-domain>/welcome` on the iPhone.
4. Add to Home Screen → the app opens on the entry stage, full screen.

## What to show (5 minutes)
1. Entry stage → Create my card → name, email, password.
2. Profile type → Your card → Collection **Obsidian Black** (then try **Platinum Elite**, **Royal Gold**) → upload a logo → Save.
3. Share screen: the card reveals; drag it with a finger; double-tap to flip; tilt the phone.
4. Share another way → copy link → open it in a private tab: the public card, Save contact (vCard).
5. Nearby → open a demo member → Connect → the Pulse moment → People → Today.

## Do not
- Do not post the demo password anywhere public; production builds never print it.
- Do not call the wallet passes "issued": the Wallet Center shows the honest status (Apple/Google integration pending until the company's certificates exist).
