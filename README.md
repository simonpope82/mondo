# mondo – a monday.com-style work app for Simon

Boards, groups, items, subitems, 20+ column types, updates with @mentions, Kanban, Calendar, Timeline, Chart and **Map** views, automations, forms, a dashboard, users and login. It also runs as a **phone app** (PWA) that you add to the Home Screen.
All data in this repo is made-up demo data.

## Kaffeknappen boards
On a fresh database mondo creates the workspace **Kaffeknappen** with the three most used boards. Their structure is copied from Simon's monday boards (names, groups, column titles and types, status labels and colours, connect and mirror columns, automations). They are filled with **made-up example rows only**.
- 🚨 **Feilmeldinger/Oppdrag**: groups Kunde → Completed Feilmeldinger → CF Jan…Dec. Columns: FEIL (16 labels), Process Status, LEV, Maskin som er feil, Fakturere?, Time tracking. **Kunde VIKTIG** links to Alle Kunder and mirrors Avtale, Adressen, Tlf nr, Avdeling, Info, Kunde nr, VA and SA. Automations: a new item gets Ikke fordelt + VET IKKE; Ferdig → moved to Completed; På vei starts the timer and Ferdig/På vent stops it; FLYTTING → a notification is sent.
- 🔨 **Monteringsplan**: groups Kunde Navn → Montert ferdig, venter på faktuering → Ferdig montert og Faktuert → FF months. It has 28 columns, plus a link to Alle Kunder. **Maskiner as subitems** with Klargjort, Antall, LAGER, På lager, Forventet levering (**week**), Serial Nr, Følgeseddel nr and Date. **På lager** on the main row shows the subitems' stock status. Automations: UTFØRT? = JA → moved to "venter på faktuering" and Msk Faktuert set to Klar til fakturering; Fakturert → moved to Faktuert; Ordren klar / STAVANGER → a notification; a new subitem → Date is set to today.
- 👨‍👩‍👧‍👦 **Alle Kunder**: groups Kunde and PD Kunder. Columns: Avtale (19 types), Addresse (map), Phone, Kunde Nr, Avdeling, VA, SA, Kunde status, Leverings info, Notes 2, Last Updated. Has a Map view.
- All three are also **templates** under *New board*. Feilmeldinger and Monteringsplan reuse the workspace's Alle Kunder board, or create one if it is missing.
- On phones, Feilmeldinger cards get 📞 and ➤ buttons from the linked customer's phone number and address.
- `tests/kk.mjs` checks the structure and takes screenshots 24–29.

## Run it locally
```bash
cd app
npm install
npm run build        # builds the React frontend into dist/
ADMIN_EMAIL=you@example.org ADMIN_PASSWORD='Some-Long-Pass-12' npm start   # http://localhost:4321
```
- The admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` only on first start, when there are no users yet. You can also run `npm run create-admin -- <email> <name>`.
- Data lives in `DATA_DIR` (default `app/data/`): `mondo.db` (SQLite) and `vapid.json` (push keys). On an empty database the demo boards are added (`SEED_DEMO=0` turns this off).
- Tests (with the server running): `E2E_EMAIL=… E2E_PASSWORD=… node tests/e2e.mjs http://localhost:4321` (desktop, 25 steps) and `node tests/phone.mjs http://localhost:4321` (390×844 iPhone and Android, 14 steps). Screenshots are saved to `screenshots/`.

## Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 4321 | HTTP port (Render sets this itself) |
| `HOST` | 127.0.0.1 (0.0.0.0 on Render) | listen address |
| `DATA_DIR` | `app/data` | where the DB and push keys are stored |
| `TRUST_PROXY` | loopback | set `1` behind Render's proxy |
| `COOKIE_SECURE` | auto | `1` = login cookie only over HTTPS |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | – | first admin (first start only) |
| `SEED_DEMO` | 1 | `0` = start with no demo boards (including Kaffeknappen) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | auto-generated in DATA_DIR | web push keys |
| `GEOCODE_CONTACT` / `GEOCODE_USER_AGENT` | ADMIN_EMAIL | contact sent to OpenStreetMap Nominatim (needs a real address) |
| `GEOCODE_COUNTRIES` | no,se,dk | limits address search |

## Phone app (PWA)
- **iPhone:** open the site in Safari → Share → *Add to Home Screen*. Push alerts need iOS 16.4+ and must be turned on from the Home Screen app.
- **Android:** Chrome shows an **Install** button in mondo (or ⋮ → *Install app*).
- On phones the table is shown as cards with big status buttons and 📞 / ➤ (directions) buttons. In Kanban, press and hold a card, then drag it.
- 🔔 *Phone alerts* (on Home) sends push for @mentions and automation notifications.
- If the phone is offline, boards you have already opened still show (read-only).

## Map view
Add a **Location** column, type an address (search uses OpenStreetMap Nominatim, max 1 lookup per second, results cached), then add a 🗺️ Map view. Pins are coloured by status or group. Tap a pin to get **Google Maps** and **Directions** buttons.

## Deploy to Render
- **Free test plan (now):** `RENDER_API_KEY=rnd_… ./deploy-render.sh` creates (or reuses) the web service **mondo** in Frankfurt from https://github.com/simonpope82/mondo, sets the env vars, waits until it is live and prints the `onrender.com` URL. `./deploy-render.sh --dry-run` only checks and prints what it would do. The same setup is also in `render.yaml` (Blueprint).
  - There is no disk on the free plan, so **all data is reset** on every deploy or restart, and after about 15 minutes with no visits. Each fresh start creates the demo boards and the admin again (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`), and everyone has to log in again. The push keys are fixed in env vars (`vapid-keys.json` on the box, not in git). After a reset each phone just turns 🔔 on again.
- **Paid, with data that is kept (later):** `render-paid-disk.yaml`: Starter plan with a 1 GB disk at `/var/data`, about $7.25/month.

## Files
- `app/server/`: `index.js` (API, automations, forms, notifications), `auth.js` (login, sessions, users), `push.js` (web push), `geo.js` (address search), `templates.js`, `seed.js` (demo data).
- `app/src/`: `App.jsx`, `Board.jsx`, `TableView.jsx`, `MobileList.jsx`, `Cells.jsx`, `Location.jsx`, `MapView.jsx`, `Views.jsx`, `ItemPanel.jsx`, `Automations.jsx`, `Forms.jsx`, `Home.jsx`, `Auth.jsx`, `pwa.jsx`.
- `app/public/`: manifest, icons, service worker (`sw.js`).
