# Open ORYN on your iPhone (today, from your MacBook)

No hosted preview exists for this repository and no deployment credentials were provided, so this is the honest fastest route: your MacBook runs the app, your iPhone opens it over Wi‑Fi. Nothing is published to the internet; no accounts or services are needed.

## What you need
- A MacBook and an iPhone on the **same Wi‑Fi**.
- Node.js 20 or newer on the Mac (`node -v`). If missing: https://nodejs.org → "LTS" installer.
- Git (comes with Xcode command line tools; the Mac offers to install them the first time you type `git`).

## Steps (about 5 minutes, first run builds for 1–2 minutes)
Open **Terminal** on the Mac (⌘ Space, type "Terminal") and paste one line at a time:

```bash
git clone https://github.com/elnatang88-creator/oryn.git
cd oryn
git checkout oryn-v1
npm ci
npm run demo:iphone
```

When it says **Ready**, the Terminal shows a QR code and an address like `http://192.168.1.23:3000/welcome`.

On the iPhone: open **Camera**, point it at the QR code in the Terminal, tap the yellow link. Safari opens ORYN.
(Or type the address into Safari by hand.)

Optional: in Safari tap **Share → Add to Home Screen** to open ORYN as a full‑screen app.

## The founder demo (two phones)
1. **Create an account** → Create my card → name, email, password (any email; mail is logged, not sent).
2. **Choose a luxury card** → Profile type → the card opens as **Obsidian Black**. Tap *Edit card* → Collection: try **Platinum Elite** and **Royal Gold**.
3. **Customize** → material, foil, finish (*Engraved*), lettering, layout, back of the card, **Upload logo**. Everything previews live.
4. **Save** → the round *Save changes* pill (bottom right). Edits reach every open link at once.
5. **Flip** → on the Share screen double‑tap the card; drag it with a finger to turn it; tilt the phone (iOS asks for motion access once).
6. **Share with another phone** → *Share another way* → copy link / Messages / WhatsApp / QR → open it on the second phone.
7. **Public profile** → the second phone sees the card and only the permitted details, with no account.
8. **Save the contact** → *Save* → a contact card (vCard) with only the shared details.
9. **View the connection** → second phone taps *Connect* → first phone: Today → *Waiting for you* → Connect → People shows the person and where you met.

Or sign in as the fictional demo account printed in the Terminal (`demo@oryn.local`, password shown only there) to see Nearby demo members, an event, a station and a workspace. The demo banner marks every screen as sample data.

## Limits of this route
- Plain `http` on your private network. Camera check‑in, Nearby location and wallet passes need `https` — for those use the Docker stack with a domain (DEPLOYMENT.md).
- The Mac's firewall may ask once to allow incoming connections for `node`: click Allow.
- Keep the Terminal window open; Ctrl+C stops the server. After pulling new code: `npm run demo:iphone -- --build`.
- Wallet passes show "Integration pending" until the company's Apple/Google credentials exist. Nothing claims a pass was issued.
