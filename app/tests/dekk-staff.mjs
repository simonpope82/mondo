// Tyre-set QR (staff-only), daily overview, customer LTV/tyre advice, customer portal: node tests/dekk-staff.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const BASE = process.argv[2] || 'http://localhost:4321';
const S = process.env.SHOTS || '/workspace/web-bil/screenshots';
fs.mkdirSync(S, { recursive: true });
const T = (id) => `[data-testid="${id}"]`;
let ok = 0, fail = 0; const errs = [];
const step = async (n, fn) => { try { await fn(); ok++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();
const fillLogin = async (p) => { await p.fill(T('login-email'), process.env.E2E_EMAIL); await p.fill(T('login-password'), process.env.E2E_PASSWORD); await p.click(T('login-submit')); };
const api = async (p, u, body, m) => { const r = m === 'put' ? await p.request.put(BASE + '/api' + u, { data: body }) : body ? await p.request.post(BASE + '/api' + u, { data: body }) : await p.request.get(BASE + '/api' + u); return r.json(); };
const dc = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await dc.newPage(); p.on('pageerror', (e) => errs.push('desktop: ' + e.message));
await p.goto(BASE + '/#/home'); await fillLogin(p); await p.waitForSelector(T('board-card'));
const st = (await api(p, '/dekk/settings')).settings;
const lager = await api(p, '/boards/' + st.boards.lager); const cId = lager.board.columns.find((c) => c.title === 'Hjulsett-ID').id;
const set = lager.items.find((i) => i.vals[cId] && /Kari Demo – Vinter/.test(i.name)) || lager.items.find((i) => i.vals[cId]);
let invite;
await step('daily overview: today/tomorrow with services, add-ons, shelf locations', async () => {
  await p.goto(BASE + '/#/dekk/dagen'); await p.waitForSelector(T('daily')); const t = await p.textContent(T('daily'));
  expect(t.includes('I dag') && t.includes('I morgen') && t.includes('Hent frem'), 'daily'); await p.screenshot({ path: S + '/20-desktop-dagens-kunder.png', fullPage: true });
  const n = await p.locator(T('daily-fetched')).count(); if (n) { await p.locator(T('daily-fetched')).first().click(); await p.waitForTimeout(400); }
});
await step('customers: Livstidsverdi + Bør bestille nye dekk with reason', async () => {
  await p.goto(BASE + '/#/dekk/kunder'); await p.waitForSelector(T('cust-table')); const t = await p.textContent(T('cust-table'));
  expect(/Ja – bestill nå/.test(t) && /mm/.test(t) && /år gamle/.test(t), 'advice'); await p.screenshot({ path: S + '/21-desktop-kunder-verdi-dekkrad.png', fullPage: true });
  await p.goto(BASE + '/#/board/' + st.boards.kunder); await p.waitForTimeout(900); const bt = await p.textContent('body'); expect(bt.includes('Livstidsverdi') && bt.includes('Bør bestille nye dekk'), 'board cols');
  await p.evaluate(() => { const s = document.querySelector('.table-scroll, .board-table, .tv-scroll') || [...document.querySelectorAll('div')].find((d) => d.scrollWidth > d.clientWidth + 200); if (s) s.scrollLeft = 99999; }); await p.waitForTimeout(300);
  await p.screenshot({ path: S + '/22-desktop-kundetavle-kolonner.png' });
});
await step('rules editable: winter limit 7 mm → Kari becomes "Ja"', async () => {
  await api(p, '/dekk/extra-settings', { tyre_rules: { winter_mm: 7.5 } }, 'put'); const kb = await api(p, '/boards/' + st.boards.kunder); const cR = kb.board.columns.find((c) => c.title === 'Bør bestille nye dekk');
  const kari = kb.items.find((i) => i.name === 'Kari Demo'); expect(cR.settings.labels.find((l) => l.id === kari.vals[cR.id])?.label.startsWith('Ja'), 'kari Ja');
  await api(p, '/dekk/extra-settings', { tyre_rules: { winter_mm: 4 } }, 'put');
});
await step('customer login created by staff (password shown once, SMS draft only)', async () => {
  await p.goto(BASE + '/#/dekk/kunder'); await p.waitForSelector(T('invite')); await p.locator('tr', { hasText: 'Ola Eksempel' }).locator(T('invite')).click(); await p.waitForSelector(T('invite-result'));
  const t = await p.textContent(T('invite-result')); const m = t.match(/innlogging: (\S+) \/ (\S+)/); expect(m, t); invite = { login: m[1], password: m[2].replace(/·.*/, '') };
});
await step('QR-labels PDF for tyre sets', async () => {
  const r = await p.request.get(BASE + '/api/dekk/tyreset-labels.pdf?ids=' + set.id); expect(r.headers()['content-type'] === 'application/pdf', 'pdf'); fs.writeFileSync('/tmp/hjul.pdf', await r.body());
  const txt = execSync('pdftotext /tmp/hjul.pdf -').toString(); expect(txt.includes('Plass'), 'label text'); execSync(`pdftoppm -png -r 200 -singlefile /tmp/hjul.pdf ${S}/23-qr-etikett-hjulsett`);
  await p.goto(BASE + '/#/dekk/etiketter'); await p.waitForSelector(T('labels-print')); await p.screenshot({ path: S + '/24-desktop-qr-etiketter.png' });
});
// phone: scan sticker without login → login required → straight to customer card
const pc = await b.newContext({ ...devices['iPhone 13'] }); const q = await pc.newPage(); q.on('pageerror', (e) => errs.push('phone: ' + e.message));
await step('phone: scan tyre label → login required (no customer data public)', async () => {
  const pub = await (await q.request.get(BASE + '/api/scan/' + set.vals[cId])).json(); expect(pub.kind === 'login_required' && !JSON.stringify(pub).includes('Kari'), JSON.stringify(pub));
  await q.goto(BASE + '/s/' + set.vals[cId]); await q.waitForSelector(T('scan-login-required')); await q.screenshot({ path: S + '/25-mobil-skann-krever-innlogging.png' });
});
await step('phone: staff logs in → tyre set + customer card opens', async () => {
  await fillLogin(q); await q.waitForSelector(T('tyreset'), { timeout: 20000 }).catch(async (e) => { await q.screenshot({ path: '/tmp/fail.png' }); console.log('URL', q.url()); throw e; }); expect((await q.textContent(T('ts-customer'))).length > 2, 'customer');
  expect((await q.textContent(T('ts-location'))).length > 1, 'loc'); await q.screenshot({ path: S + '/26-mobil-hjulsett-kundekort.png', fullPage: true });
  await q.goto(BASE + '/#/dekk/dagen'); await q.waitForSelector(T('daily')); await q.screenshot({ path: S + '/27-mobil-dagens-kunder.png', fullPage: true });
});
// customer portal
const cc = await b.newContext({ ...devices['iPhone 13'] }); const r = await cc.newPage(); r.on('pageerror', (e) => errs.push('portal: ' + e.message));
await step('customer portal: own data only, no staff access', async () => {
  await r.goto(BASE + '/minside'); await r.waitForSelector(T('portal-login')); await r.screenshot({ path: S + '/28-mobil-minside-login.png' });
  await r.fill(T('portal-user'), invite.login); await r.fill(T('portal-pass'), invite.password); await r.click(T('portal-submit')); await r.waitForSelector(T('portal'));
  const t = await r.textContent(T('portal')); expect(t.includes('Ola') && t.includes('DM 10002') && !t.includes('Kari Demo'), 'own data'); await r.screenshot({ path: S + '/29-mobil-minside.png', fullPage: true });
  for (const u of ['/api/boards/' + st.boards.kunder, '/api/dekk/daily', '/api/dekk/tyreset/' + set.vals[cId], '/api/bootstrap']) { const x = await r.request.get(BASE + u); expect(x.status() === 401, u + ' ' + x.status()); }
});
await step('no page errors', () => expect(!errs.length, errs.join(' | ')));
await b.close(); console.log(`\n${ok} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
