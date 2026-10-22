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

## Ledelse, Employee and car boards
Also created on a fresh database, and available as templates. The structure is copied from monday; the rows are **made up**.
- **Ledelse:**
  - 🏛️ **Styrets handlingsplan Kaffeknappen 2025**: Status, Kategori, Prioritet, People, Tidsfrist, Tiltak 2021. Done → moved to Done.
  - 🤝 **4-banden ledelsesmøte**: Person, Status, Date, Files. Done → moved to group 2.
  - 🎯 **Strategi 2030**: Avdeling, Person, Status, Label (year). Delmål are subitems with Owner, Status, Timeline and Progress.
  - 🗺️ **Handlingsplan 2026 Service**: one goal per group. The group names are placeholders.
- **Kaffeknappen:** 👥 **Employee Kaffeknappen** and 🚐 **KK biler** (subitems; when EU-kontroll / Dekkskift / Service Dato arrives the driver gets a notification; changing KM STAND sets SIST LEST KM to today).
- **Magnat:** 👥 **Employee Magnat** and 🚐 **MK biler**.
- ⚠️ The employee boards have the same columns as monday, including salary, person nr and bank nr. The demo rows leave those columns **empty**. Never enter real HR data on the public test site.
- New automation triggers: **a column changes** and **a date arrives** (checked every 15 minutes, and straight away when the date is set to today).
- `tests/more.mjs` checks the structure and takes screenshots 30–39.

## 🏷️ Assets (GoCodes-style QR asset tracking)
Menu → **Assets** (or the 📷 **Scan** button). Everything here is made-up demo data.
- **Asset list**: GoCodes built-in fields (you can switch each one on/off and rename it), plus Simon's custom fields (Co2, Adresse, Etg, Plassering, Aquastop levert av KK, Grutgjennomføring, Fresk melk, Avdeling, Filter, Kontakt person og Nr). Also: search, a column picker, filters per column, group by type, double-click a cell to edit, 50 per page, CSV export, print labels for the selected rows. On a phone you get cards instead.
- **Asset page**: photo (phone camera), "Location updated X ago" with a map and the scan trail, a check in/out badge with Check out / Transfer / Check in (to a person, location or job site, with return date and note; GPS is stamped on it), financial info (current value, end of life), tabs for Check In/Out, Tasks, Documents, Messages, Jobs (board items that mention the code, e.g. the *Gocodes* column on Feilmeldinger; or press "New job"), and History. Menu: Copy to another tag, Print label, Deactivate.
- **QR tags**: codes look like `ABCD-EFGH` (no 0/O/1/I). Each sticker's URL is `PUBLIC_URL/s/ABCD-EFGH`. **Labels** tab: generate unused tags and download a PDF for Avery 6570/6576 (the GoCodes size), 5160, 22806, L7651, L7160, L7163, or 50×25 / 62×29 roll labels. You can skip used labels on a sheet and draw outlines for a test print.
- **Scanning**: the normal phone camera opens `/s/<code>`. If you're logged in, a GPS scan is saved (lat/lng/accuracy/user/time) and the asset opens. An unused tag opens **Activate asset tag** (new or existing asset). If you're not logged in, you see the public fields, the reward and a "message the owner" form, and admins get a 🔔 alert. The in-app scanner (BarcodeDetector, or jsQR on iPhone) also reads **old GoCodes stickers** (`gkd.bz/<ID>`) through the "Old GoCodes ID" field. If the camera fails, you can type the code.
- **Map** (all last-known positions, satellite toggle, history trail), **Agenda** (service scheduled, end of life, due back, tasks), **Tasks**, **Messages**, **Reports** (CSV: all asset data, assignment, change history, depreciation SL half-year / SL monthly / DB150 / DB200), **Settings** (fields, public fields, alerts: overdue, scheduled service and low inventory go to 🔔 + phone push).
- Roles: admin = *Group administrator* (settings, deactivate), member = *Asset manager*.
- ⚠️ **Before printing real stickers**: point a domain you own at the service (e.g. `assets.kaffeknappen.no`) and set `PUBLIC_URL`. Printed QR codes contain that URL for good. Also use the paid plan with a disk: the free plan wipes generated codes, scans and photos on restart. The demo tags are deterministic, so they survive resets.
- Tests: `node tests/assets.mjs` (desktop + phone, including a fake-camera scan of an old GoCodes sticker).

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
- `PUBLIC_URL` – base URL printed in QR stickers (default: the URL the request came in on)
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

## 🛞 Dekkhotell (tyre change booking + tyre hotel + CRM)
Workspace **Dekkhotell** with editable template boards (also available under *New board → Dekk: …*):
**Kunder** (CRM) · **Kjøretøy** · **Bookinger** (calendar, status Bestilt/Bekreftet/Møtt/Ferdig/Ikke møtt, lift, price, payment) · **Dekkhotell lager** (location, 4× tread depth, condition, rims/bolts/TPMS, photos, QR wheel-set ID from Assets, season date) · **Fakturaer** (amount, VAT, status, due date, KID, PDF + payment link).

- **Public booking page:** `/book` (or `#/book`). Service → reg. no. (lookup) → free slot (lifts × opening hours ÷ duration) → contact details → confirmation. It creates or links a customer + vehicle and adds a booking.
- **Automations:**
  - Bekreftet → notification + SMS/email **draft**.
  - Ferdig → invoice created + payment status set to "Fakturert".
  - Season change date → call-in reminder 3 weeks before.
  - Tread depth "Må byttes" → reminder to offer new tyres.
- **Control page:** `#/dekk` – overview + booking QR, invoices (PDF / email draft / payment link / mark as paid), Outbox (drafts), Setup (company details, services, capacity, opening hours), Payment & keys.
- **Nothing is sent automatically.** Email/SMS only become drafts in the Outbox.
- **Payment page:** `#/betal/<token>`. Vipps / card / pay on collection. These stay **inactive until keys are added**:

| Function | Env vars |
|---|---|
| Stripe Checkout | `STRIPE_SECRET_KEY` (use `sk_test_…` first) |
| Vipps ePayment | `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MSN`, `VIPPS_ENV=test` |
| Reg. no. lookup | `VEGVESEN_API_KEY` |
| SMTP (prepared only) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Pay-link signing | `PAY_LINK_SECRET` (optional) |

- **Tests:** `node tests/dekk.mjs [baseUrl]`.

## 🌐 Landing page + chat (Web-Bil) and 📧 e-mail intake
- **Landing page:** `/web-bil` – edit everything under `#/dekk/nettside` (texts, services, prices, opening hours, map, chat Q&A). Fields in `[brackets]` are placeholders.
- **Booking:** `/book?site=web-bil` uses Web-Bil branding. Customers can tick add-ons, which you edit under Oppsett. Online bookings are confirmed automatically when a lift is free (this can be switched off).
- **Chat:** answers by keyword/fuzzy matching against the Q&A list – no AI key needed. If an answer is missing or still a placeholder, it offers "Send spørsmål" (the question goes to the Outbox + a notification) or "Bestill time".
- **E-mail intake:** `#/dekk/epost`.
  - Mail is parsed for name, phone, reg. no., date, time and service and becomes an item on **Bookinger**. If something is missing, the item goes to the group "📧 E-post – må sjekkes".
  - **Nothing is ever replied to.**
  - **IMAP (read-only, PEEK):** `IMAP_HOST`, `IMAP_PORT` (993), `IMAP_USER`, `IMAP_PASS` (app password), `IMAP_FOLDER`, `IMAP_TLS`. Then switch on "Slå på henting".
  - **Webhook:** `POST /api/mail/inbound/<MAIL_WEBHOOK_SECRET>` with JSON `{from, subject, text}`.
- **Tests:** `node tests/webbil.mjs`.

## 🏷️ Tyre-set QR, roles, daily overview, customer value
- **QR label per tyre set:**
  - Print from `#/dekk/etiketter` or from the tyre-set page (62×29 mm roll; `?template=` for other formats).
  - A scan (`/s/<code>`) **requires staff login** and then opens the customer + tyre set right away (`#/dekk/hjulsett/<code>`).
  - Without login, the scan shows no data.
- **Roles:**
  - Owner = admin. Workers = staff users; they can view, but only admin can change setup.
  - Customers get their own login at `/minside`. Staff create it under Dekkhotell → Kunder, and an SMS draft is put in the Outbox, not sent.
  - Customers use a separate cookie and only see their own bookings, tyres, cars and invoices. They have no access to the staff API.
- **I dag:** `#/dekk/dagen` – today's and tomorrow's customers with service, add-ons, lift and **shelf location** (plus "Hent"). An optional morning push to staff is set under Oppsett.
- **Kunder board** gets live columns:
  - **Livstidsverdi** – paid invoices + paid bookings.
  - **Bør bestille nye dekk** – Ja / Snart / OK.
  - **Dekk-anbefaling** – the reason.
  - The rules (winter/summer mm, age from DOT) are editable under Oppsett.
- **Demo customer login:** 40000101 / `demo-kunde` (made-up customer Kari Demo).

## 🛞 Slitte dekk: valg ved booking, varsel til verkstedet, påminnelse (server/dekk-wear.js)
- Booking (`/book`): når mobil + regnr matcher samme kunde vises «Notat fra forrige gang» (slitasje med mm + kunde-synlig notat) og valgene «Ja, bestill nye dekk til timen / Gi meg et tilbud først / Nei takk». Nye kunder får «Trenger du nye dekk?». Valget lagres i kolonnen «Nye dekk-valg» på Bookinger og vises i «I dag».
- Verkstedet: «Gamle dekk tatt av» (hjulsett-siden og «I dag») → mønster per hjul. Under grensen: pop-up «Disse dekkene må det bestilles nye dekk til», push til ansatte, Oppgave «Bestill nye dekk» på kunden, påminnelsesdato på hjulsettet.
- Påminnelse: standard 1. september (Oppsett → «Påminnelse om nye dekk», merket «må avklares»), egen dato per kunde i kolonnen «Påminnelse nye dekk (egen dato)». Varsel til verkstedet + web push til kunden (kun med Min side + varsler på). SMS/e-post bare som utkast.
- Kunder: «Notat til kunde (synlig)» vises for kunden; «Notat» er internt og vises aldri.
- Test: `node tests/dekk-wear.mjs <url>` (skjermbilder v4-*).

## 🔑 Glemt passord (server/reset.js)
- «Glemt passord? / Forgot password?» on the staff login and on Min side. Neutral answer, rate-limited (3 per account / 10 per IP per 15 min).
- Single-use token, stored only as sha256, valid 30 min (admin-made links: 30 min – 2 h). `/reset?token=…` sets a new password (8+) and logs the account out everywhere.
- Delivery: e-mail via SMTP if `SMTP_HOST`, `SMTP_PORT` (587/465), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` are set. Otherwise logged + saved as draft in Utboks, and the admin can copy the link on the Users page. SMS: no provider yet → draft.
- Links use `PUBLIC_URL` (or Render's `RENDER_EXTERNAL_URL`), not the request Host header.
- Test: `node tests/reset.mjs <url>` (throwaway user, cleaned up).
