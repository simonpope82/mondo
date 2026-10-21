// Web-Bil landing page + chat bot + add-on booking + e-mail intake: node tests/webbil.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://localhost:4321';
const S = process.env.SHOTS || '/workspace/web-bil/screenshots';
fs.mkdirSync(S, { recursive: true });
const T = (id) => `[data-testid="${id}"]`;
let ok = 0, fail = 0; const errs = [];
const step = async (n, fn) => { try { await fn(); ok++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();
async function login(p) { await p.goto(BASE + '/#/home'); await p.fill(T('login-email'), process.env.E2E_EMAIL); await p.fill(T('login-password'), process.env.E2E_PASSWORD); await p.click(T('login-submit')); await p.waitForSelector(T('board-card')); }
const api = async (p, u, body, m) => { const r = m === 'put' ? await p.request.put(BASE + '/api' + u, { data: body }) : body ? await p.request.post(BASE + '/api' + u, { data: body }) : await p.request.get(BASE + '/api' + u); return r.json(); };
const board = async (p, id) => { const r = await api(p, '/boards/' + id); return { ...r.board, items: r.items }; };

// phone, not logged in
const pc = await b.newContext({ ...devices['iPhone 13'] }); const q = await pc.newPage(); q.on('pageerror', (e) => errs.push('phone: ' + e.message));
await step('phone: /web-bil landing page', async () => {
  await q.goto(BASE + '/web-bil'); await q.waitForSelector(T('site-page')); const t = await q.textContent('body');
  expect(t.includes('Kroerveien 115') && t.includes('Dekkhotell') && t.includes('979 189 087'), 'facts'); await q.waitForTimeout(800);
  await q.screenshot({ path: S + '/01-mobil-forside.png' }); await q.screenshot({ path: S + '/02-mobil-hele-siden.png', fullPage: true });
});
await step('phone: chat bot answers + handoff', async () => {
  await q.click(T('bot-open')); await q.fill(T('bot-input'), 'hvor ligger dere?'); await q.press(T('bot-input'), 'Enter');
  await q.waitForFunction(() => document.querySelectorAll('[data-testid="bot-msg"]').length >= 2); expect((await q.locator(T('bot-msg')).nth(1).textContent()).includes('Kroerveien'), 'answer');
  await q.fill(T('bot-input'), 'tar dere imot elbil med spesielle felger fra mars?'); await q.press(T('bot-input'), 'Enter'); await q.waitForSelector(T('bot-handoff'));
  await q.screenshot({ path: S + '/03-mobil-chat.png' });
  await q.locator(T('bot-handoff')).last().click(); await q.fill(T('bot-contact'), '400 00 888'); await q.click(T('bot-send'));
  await q.waitForFunction(() => [...document.querySelectorAll('[data-testid="bot-msg"]')].some((x) => x.textContent.includes('sendt')));
  await q.screenshot({ path: S + '/04-mobil-chat-sendt.png' });
});
let ref;
await step('phone: book from site with add-ons → auto-confirmed', async () => {
  await q.goto(BASE + '/web-bil'); await q.click(T('site-book')); await q.waitForSelector(T('bk-svc-hjulskift'));
  await q.click(T('bk-svc-hjulskift')); await q.click(T('bk-add-vask')); await q.click(T('bk-add-balansering'));
  expect((await q.textContent(T('bk-total'))).includes('1590'), 'total ' + await q.textContent(T('bk-total'))); await q.screenshot({ path: S + '/05-mobil-booking-tillegg.png', fullPage: true });
  await q.click(T('bk-next')); await q.fill(T('bk-reg'), 'DM 10005'); await q.click(T('bk-next'));
  await q.waitForSelector('.bk-day:not([disabled])'); await q.locator('.bk-day:not([disabled])').nth(1).click(); await q.waitForSelector('.bk-time:not([disabled])'); await q.locator('.bk-time:not([disabled])').nth(3).click();
  await q.screenshot({ path: S + '/06-mobil-booking-tid.png' }); await q.click(T('bk-next'));
  await q.fill(T('bk-name'), 'Web Testkunde'); await q.fill(T('bk-phone'), '400 00 999'); await q.click(T('bk-submit')); await q.waitForSelector(T('bk-done'));
  expect((await q.textContent(T('bk-done'))).includes('bekreftet'), 'confirmed'); ref = await q.textContent(T('bk-ref')); await q.screenshot({ path: S + '/07-mobil-booking-bekreftet.png' });
});
// desktop
const dc = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await dc.newPage(); p.on('pageerror', (e) => errs.push('desktop: ' + e.message));
await step('desktop: landing page', async () => { await p.goto(BASE + '/web-bil'); await p.waitForSelector(T('site-page')); await p.waitForTimeout(900); await p.screenshot({ path: S + '/10-desktop-forside.png' }); await p.screenshot({ path: S + '/11-desktop-hele-siden.png', fullPage: true }); });
let st;
await step('booking in mondo: Bekreftet, add-ons, price', async () => {
  await login(p); st = (await api(p, '/dekk/settings')).settings; const bb = await board(p, st.boards.bookinger);
  const c = (t) => bb.columns.find((x) => x.title === t); const it = bb.items.find((i) => i.vals[c('Bookingref').id] === ref); expect(it, 'item');
  expect(it.vals[c('Status').id] === c('Status').settings.labels.find((l) => l.label === 'Bekreftet').id, 'status'); expect(it.vals[c('Pris').id] === 1590 && /Hjulvask/.test(it.vals[c('Tillegg').id]), 'addons');
  const out = (await api(p, '/dekk/outbox')).outbox; expect(out.some((o) => o.kind === 'question'), 'question in outbox');
});
await step('admin: Nettside & chat editor – edit FAQ answer → bot uses it', async () => {
  await p.goto(BASE + '/#/dekk/nettside'); await p.waitForSelector(T('dk-faq')); await p.screenshot({ path: S + '/12-admin-nettside.png', fullPage: true });
  const s = await api(p, '/dekk/site/web-bil'); const orig = s.faqs; const faqs = orig.map((f) => (f.id === 'f5' ? { ...f, a: 'TEST-SVAR åpningstider' } : f));
  await api(p, '/dekk/site/web-bil', { faqs }, 'put'); const r = await api(p, '/site/web-bil/ask', { q: 'når har dere åpent' }); expect(r.text.includes('TEST-SVAR'), r.text);
  await api(p, '/dekk/site/web-bil', { faqs: orig }, 'put');
});
await step('admin: add-ons editor + auto-confirm', async () => { await p.goto(BASE + '/#/dekk/oppsett'); await p.waitForSelector(T('dk-save-addons')); await p.locator(T('dk-save-addons')).scrollIntoViewIfNeeded(); await p.screenshot({ path: S + '/13-admin-tillegg.png' }); });
await step('admin: E-post inn – parse + create booking request (no reply)', async () => {
  await p.goto(BASE + '/#/dekk/epost'); await p.waitForSelector(T('mail-text')); await p.click(T('mail-preview')); await p.waitForSelector(T('mail-parsed'));
  expect((await p.textContent(T('mail-parsed'))).includes('DM 10004'), 'regnr'); await p.click(T('mail-create')); await p.waitForSelector(T('dk-msg')); await p.waitForTimeout(500);
  expect((await p.textContent(T('mail-log'))).includes('Dekkskift'), 'log'); expect((await p.textContent(T('mail-imap'))).includes('Ikke aktiv'), 'imap inactive');
  await p.screenshot({ path: S + '/14-admin-epost-inn.png', fullPage: true });
});
await step('webhook rejects wrong secret', async () => { const r = await p.request.post(BASE + '/api/mail/inbound/wrong-secret', { data: { text: 'x' } }); expect([404, 503].includes(r.status()), 'status ' + r.status()); });
await step('no page errors', () => expect(!errs.length, errs.join(' | ')));
await b.close(); console.log(`\n${ok} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
