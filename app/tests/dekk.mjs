// Dekkhotell tests (desktop + phone): node tests/dekk.mjs [baseUrl]   env E2E_EMAIL / E2E_PASSWORD
import { chromium, devices } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const BASE = process.argv[2] || 'http://localhost:4321';
const S = process.env.SHOTS || '/workspace/dekkhotell/screenshots';
fs.mkdirSync(S, { recursive: true });
const T = (id) => `[data-testid="${id}"]`;
let ok = 0, fail = 0; const errs = [];
const step = async (n, fn) => { try { await fn(); ok++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();
async function login(p) { await p.goto(BASE + '/#/home'); await p.fill(T('login-email'), process.env.E2E_EMAIL); await p.fill(T('login-password'), process.env.E2E_PASSWORD); await p.click(T('login-submit')); await p.waitForSelector(T('board-card')); }
const api = async (p, u, body, method) => { const r = method === 'patch' ? await p.request.patch(BASE + '/api' + u, { data: body }) : method === 'put' ? await p.request.put(BASE + '/api' + u, { data: body }) : body ? await p.request.post(BASE + '/api' + u, { data: body }) : await p.request.get(BASE + '/api' + u); return r.json(); };

const board = async (p, id) => { const r = await api(p, '/boards/' + id); return { ...r.board, items: r.items }; };
const dc = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await dc.newPage(); p.on('pageerror', (e) => errs.push('desktop: ' + e.message));
await step('login', () => login(p));
let st;
await step('Dekkhotell page: 5 boards + booking link + QR', async () => {
  await p.click(T('side-dekk')); await p.waitForSelector(T('dekk-admin'));
  expect(await p.locator('.dk-tile').count() === 5, 'tiles'); expect((await p.textContent(T('dk-booklink'))).endsWith('/book'), 'link');
  st = (await api(p, '/dekk/settings')).settings; await p.waitForTimeout(400); await p.screenshot({ path: S + '/00-dekkhotell-oversikt.png' });
});
await step('Bookinger board: calendar view', async () => {
  await p.goto(BASE + '/#/board/' + st.boards.bookinger); await p.waitForSelector(T('view-calendar')); await p.click(T('view-calendar')); await p.waitForTimeout(700);
  expect((await p.textContent('body')).includes('DM 1000'), 'bookings in calendar'); await p.screenshot({ path: S + '/02-bookinger-kalender.png' });
  await p.click(T('view-table')); await p.waitForTimeout(500); await p.screenshot({ path: S + '/02b-bookinger-tabell.png' });
});
await step('Kunder (CRM) board with linked vehicles', async () => {
  await p.goto(BASE + '/#/board/' + st.boards.kunder); await p.waitForTimeout(900);
  const t = await p.textContent('body'); expect(t.includes('Kari Demo') && t.includes('DM 10001'), 'crm'); await p.screenshot({ path: S + '/03-kunder-crm.png' });
});
await step('Dekkhotell lager board: tread depth + condition + QR id', async () => {
  await p.goto(BASE + '/#/board/' + st.boards.lager); await p.waitForTimeout(900);
  const t = await p.textContent('body'); expect(t.includes('Må byttes') && t.includes('Mønster VF'), 'lager'); await p.screenshot({ path: S + '/04-dekkhotell-lager.png' });
});
let newInv;
await step('automation: booking → Ferdig creates invoice + Betaling=Fakturert', async () => {
  const before = (await api(p, '/dekk/invoices')).invoices.length;
  const bk = await board(p, st.boards.bookinger);
  const cS = bk.columns.find((c) => c.title === 'Status'); const ferdig = cS.settings.labels.find((l) => l.label === 'Ferdig').id;
  const lid = (n) => cS.settings.labels.find((l) => l.label === n).id; const it = bk.items.find((i) => i.vals[cS.id] === lid('Møtt')) || bk.items.find((i) => i.vals[cS.id] === lid('Bekreftet')); expect(it, 'Møtt/Bekreftet item');
  await api(p, '/items/' + it.id, { vals: { [cS.id]: ferdig } }, 'patch');
  const inv = (await api(p, '/dekk/invoices')).invoices; expect(inv.length === before + 1, 'invoice count ' + inv.length); newInv = inv[0];
  const b2 = await board(p, st.boards.bookinger); const cB = b2.columns.find((c) => c.title === 'Betaling');
  expect(b2.items.find((i) => i.id === it.id).vals[cB.id] === cB.settings.labels.find((l) => l.label === 'Fakturert').id, 'betaling');
  expect(Math.abs(newInv.eks + newInv.mva - newInv.total) < 0.02 && newInv.kid.length >= 6, 'sums');
});
await step('invoices tab: e-mail = draft only (not sent)', async () => {
  await p.goto(BASE + '/#/dekk/fakturaer'); await p.waitForSelector(T('dk-invoices'));
  await p.locator(T('dk-email')).first().click(); await p.waitForSelector(T('dk-msg')); expect(/Ikke sendt|slått av/.test(await p.textContent(T('dk-msg'))), 'draft msg');
  await p.screenshot({ path: S + '/06-fakturaer.png' });
  await p.click(T('dk-tab-utboks')); await p.waitForSelector(T('dk-outbox-item')); expect((await p.textContent('.dk-page')).includes('Faktura'), 'outbox'); await p.screenshot({ path: S + '/07-utboks-utkast.png' });
});
await step('invoice PDF renders', async () => {
  const r = await p.request.get(BASE + `/api/dekk/invoice/${newInv.id}.pdf`); expect(r.headers()['content-type'] === 'application/pdf', 'pdf');
  fs.writeFileSync('/tmp/faktura.pdf', await r.body()); const txt = execSync('pdftotext /tmp/faktura.pdf -').toString();
  expect(txt.includes('FAKTURA') && txt.includes(newInv.no) && txt.includes('KID'), 'pdf text');
  execSync(`pdftoppm -png -r 80 -singlefile /tmp/faktura.pdf ${S}/05-faktura-pdf`);
});
await step('integrations: Stripe/Vipps/SMTP not active', async () => {
  await p.goto(BASE + '/#/dekk/integrasjoner'); await p.waitForSelector(T('dk-int-vipps'));
  for (const k of ['stripe', 'vipps', 'smtp']) expect((await p.textContent(T('dk-int-' + k))).includes('Ikke aktiv'), k);
  await p.screenshot({ path: S + '/08-betaling-nokler.png' });
});
await step('capacity setting changes free slots (lifts 3→4→3)', async () => {
  const day = (await api(p, '/book/days?service=hjulskift')).days.find((d) => d.free > 0 && d.date > new Date().toISOString().slice(0, 10)).date;
  const free = async () => (await api(p, `/book/slots?date=${day}&service=hjulskift`)).slots.reduce((a, s) => a + s.free, 0);
  const f3 = await free(); await p.goto(BASE + '/#/dekk/oppsett'); await p.fill(T('dk-lifts'), '4'); await p.click(T('dk-save-cap')); await p.waitForTimeout(400);
  const f4 = await free(); expect(f4 > f3, `${f3} → ${f4}`); await p.screenshot({ path: S + '/09-oppsett.png', fullPage: true });
  await api(p, '/dekk/settings', { capacity: { lifts: 3 } }, 'put');
});

// ---------------- phone: public booking (not logged in) ----------------
const pc = await b.newContext({ ...devices['iPhone 13'] });
const q = await pc.newPage(); q.on('pageerror', (e) => errs.push('phone: ' + e.message));
let ref;
await step('phone: /book → service → reg nr lookup', async () => {
  await q.goto(BASE + '/book'); await q.waitForSelector(T('bk-svc-hjulskift_hotell')); await q.screenshot({ path: S + '/01a-booking-mobil-tjeneste.png' });
  await q.click(T('bk-svc-hjulskift_hotell')); await q.click(T('bk-next')); await q.fill(T('bk-reg'), 'DM 10002'); await q.waitForSelector(T('bk-car')); expect((await q.textContent(T('bk-car'))).includes('ID.4'), 'car');
  await q.screenshot({ path: S + '/01b-booking-mobil-regnr.png' }); await q.click(T('bk-next'));
});
await step('phone: pick day + free time', async () => {
  await q.waitForSelector('.bk-day:not([disabled])'); await q.locator('.bk-day:not([disabled])').nth(1).click(); await q.waitForSelector('.bk-time:not([disabled])');
  await q.locator('.bk-time:not([disabled])').nth(2).click(); await q.screenshot({ path: S + '/01c-booking-mobil-tid.png' }); await q.click(T('bk-next'));
});
await step('phone: contact + confirm → confirmation', async () => {
  await q.fill(T('bk-name'), 'Test Testesen'); await q.fill(T('bk-phone'), '400 00 777'); await q.fill(T('bk-email'), 'test.testesen@example.com');
  await q.screenshot({ path: S + '/01d-booking-mobil-kontakt.png' }); await q.click(T('bk-submit')); await q.waitForSelector(T('bk-done')); ref = await q.textContent(T('bk-ref'));
  await q.screenshot({ path: S + '/01e-booking-mobil-bekreftet.png' });
});
await step('booking landed on Bookinger + customer created in CRM', async () => {
  const bb = await board(p, st.boards.bookinger); const cR = bb.columns.find((c) => c.title === 'Bookingref'); const it = bb.items.find((i) => i.vals[cR.id] === ref); expect(it, 'booking ' + ref);
  const kb = await board(p, st.boards.kunder); expect(kb.items.some((i) => i.name === 'Test Testesen'), 'customer');
  const out = (await api(p, '/dekk/outbox')).outbox; expect(out.some((o) => o.kind === 'sms' && o.body.includes(ref)), 'sms draft');
});
await step('phone: pay page – Vipps/kort clearly inactive, pickup works', async () => {
  await q.goto(BASE + newInv.pay_url); await q.waitForSelector(T('pay-card')); expect((await q.textContent(T('pay-note'))).includes('ikke aktivert'), 'note');
  await q.click(T('pay-vipps')); await q.waitForSelector(T('pay-err')); expect((await q.textContent(T('pay-err'))).includes('ikke aktiv'), 'vipps inactive');
  await q.screenshot({ path: S + '/10-betal-mobil.png' }); await q.click(T('pay-pickup')); await q.waitForSelector('.bk-ok');
});
await step('phone (logged in): Dekkhotell page usable', async () => {
  const lc = await b.newContext({ ...devices['iPhone 13'] }); const r = await lc.newPage(); r.on('pageerror', (e) => errs.push('phone2: ' + e.message)); await login(r);
  await r.goto(BASE + '/#/dekk/fakturaer'); await r.waitForSelector(T('dk-invoices')); await r.screenshot({ path: S + '/11-fakturaer-mobil.png' });
  await r.goto(BASE + '/#/board/' + st.boards.lager); await r.waitForTimeout(1000); await r.screenshot({ path: S + '/12-lager-mobil.png' }); await lc.close();
});
await step('no page errors', () => expect(!errs.length, errs.join(' | ')));
await b.close();
console.log(`\n${ok} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
