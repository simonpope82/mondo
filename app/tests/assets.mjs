// Assets module tests (desktop + phone): node tests/assets.mjs [baseUrl]   env E2E_EMAIL / E2E_PASSWORD
import { chromium, devices } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import QR from 'qrcode';
const BASE = process.argv[2] || 'http://localhost:4321';
const S = process.env.SHOTS || '/workspace/gocodes-clone/screenshots';
fs.mkdirSync(S, { recursive: true });
const T = (id) => `[data-testid="${id}"]`;
let ok = 0, fail = 0; const errs = [];
const step = async (n, fn) => { try { await fn(); ok++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();
async function login(p) { await p.goto(BASE + '/#/home'); await p.fill(T('login-email'), process.env.E2E_EMAIL); await p.fill(T('login-password'), process.env.E2E_PASSWORD); await p.click(T('login-submit')); await p.waitForSelector(T('board-card')); }
const api = async (p, u, body) => { const r = body ? await p.request.post(BASE + '/api' + u, { data: body }) : await p.request.get(BASE + '/api' + u); return r.json(); };

// ---------------- desktop ----------------
const dc = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: 59.9139, longitude: 10.7522, accuracy: 15 } });
const p = await dc.newPage(); p.on('pageerror', (e) => errs.push('desktop: ' + e.message));
await step('login', () => login(p));
let all;
await step('asset list: table with GoCodes columns', async () => {
  await p.click(T('side-assets')); await p.waitForSelector(T('as-table'));
  expect(await p.locator(T('as-row')).count() >= 14, 'rows'); const head = await p.locator('.as-table thead').textContent();
  for (const h of ['Asset ID', 'Asset type', 'Serial number', 'Model', 'Home location', 'Assigned To', 'Status']) expect(head.includes(h), 'missing col ' + h);
  all = (await api(p, '/assets')).assets; await p.waitForTimeout(300); await p.screenshot({ path: S + '/01-asset-list.png' });
});
await step('column picker adds custom field (Co2) + Last Scan', async () => {
  await p.click(T('as-columns')); await p.check(T('as-col-c_co2')); await p.check(T('as-col-last_seen')); await p.mouse.click(1000, 860);
  const head = await p.locator('.as-table thead').textContent(); expect(head.includes('Co2') && head.includes('Last Scan'), 'cols');
});
await step('per-column filter (Status = Hos kunde)', async () => {
  await p.click(T('as-filters')); await p.fill(T('as-f-status'), 'Hos kunde'); await p.waitForTimeout(200);
  const n = await p.locator(T('as-row')).count(); expect(n > 0 && n < all.length, 'filtered ' + n); await p.fill(T('as-f-status'), ''); await p.click(T('as-filters'));
});
await step('double-click cell to edit (Serial number)', async () => {
  const row = p.locator(T('as-row')).first(); await row.locator(T('as-cell-serial')).dblclick(); await p.fill(T('as-cell-edit'), 'DEMO-EDIT-1'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  expect((await row.locator(T('as-cell-serial')).textContent()).includes('DEMO-EDIT-1'), 'edited');
});
await step('group by asset type', async () => { await p.click(T('as-group')); expect(await p.locator('.grow-row').count() >= 4, 'groups'); await p.click(T('as-group')); });
const machine = () => all.find((a) => a.legacy_code && a.data.asset_type === 'Kaffemaskin');
await step('asset detail: photo, location, check status, sections', async () => {
  await p.goto(BASE + '/#/assets/' + machine().id); await p.waitForSelector(T('as-detail')).catch(async (e) => { await p.screenshot({ path: '/tmp/fail-detail.png' }); throw e; });
  expect((await p.textContent(T('asd-title'))).includes('Kaffemaskin'), 'title'); await p.waitForSelector(T('asd-map'));
  expect((await p.textContent(T('as-detail'))).includes('Location updated'), 'loc'); expect((await p.textContent(T('as-detail'))).includes('Old GoCodes ID'), 'legacy');
  for (const t of ['checks', 'tasks', 'docs', 'msgs', 'jobs', 'hist']) await p.waitForSelector(T('asd-tab-' + t));
  await p.waitForTimeout(800); await p.screenshot({ path: S + '/02-asset-detail.png' });
});
await step('photo upload', async () => {
  const jpg = '/tmp/demo-photo.jpg'; execSync(`ffmpeg -y -loglevel error -f lavfi -i "color=c=0x8b5a2b:s=640x480,drawbox=x=200:y=120:w=240:h=260:color=0x333333:t=fill" -frames:v 1 ${jpg}`);
  await p.setInputFiles(T('asd-photo-input'), jpg); await p.waitForSelector(T('asd-photo') + ' img', { timeout: 8000 });
});
await step('check out to person (with GPS) → check in', async () => {
  await p.click(T('asd-checkout')); await p.selectOption(T('co-person'), 'p_maria'); await p.fill(T('co-return'), '2026-11-30'); await p.fill(T('co-note'), 'Test loan'); await p.click(T('co-save'));
  await p.waitForSelector(T('asd-checkin')); expect((await p.textContent(T('asd-assigned'))).includes('Maria'), 'assigned');
  expect((await p.textContent(T('asd-banner'))).includes('±'), 'gps on checkout');
  await p.click(T('asd-checkin')); await p.click(T('co-save')); await p.waitForSelector(T('asd-checkout'));
  await p.click(T('asd-tab-checks')); const t = await p.textContent(T('ev-list')); expect(t.includes('Checked in from Maria') && t.includes('Checked out to Maria'), 'history');
});
await step('task + document link', async () => {
  await p.click(T('asd-tab-tasks')); await p.fill(T('asd-task-title'), 'Test task'); await p.click(T('asd-task-add')); await p.waitForTimeout(400);
  expect((await p.locator(T('asd-task')).allTextContents()).some((x) => x.includes('Test task')), 'task');
  await p.goto(BASE + '/#/assets/' + all.find((a) => a.docs > 0).id); await p.waitForSelector(T('as-detail')); await p.click(T('asd-tab-docs')); await p.waitForTimeout(400); expect((await p.textContent(T('as-detail'))).includes('eksempel-lenke'), 'doc');
});
await step('linked jobs from Feilmeldinger (Gocodes column)', async () => {
  const first = all.find((a) => a.data.asset_type === 'Kaffemaskin' && a.data.home_location === 'Kafé Demo Sentrum');
  await p.goto(BASE + '/#/assets/' + first.id); await p.waitForSelector(T('as-detail')); await p.click(T('asd-tab-jobs')); await p.waitForTimeout(400);
  expect(await p.locator(T('asd-job')).count() >= 1, 'job');
});
await step('board cell code → opens asset', async () => {
  await p.locator(T('asd-job')).first().click(); await p.waitForSelector(T('asset-link')); await p.locator(T('asset-link')).first().click(); await p.waitForSelector(T('as-detail'));
});
let pdfCodes;
await step('generate unused tags + labels PDF (Avery 6570)', async () => {
  await p.goto(BASE + '/#/assets-labels'); await p.waitForSelector(T('labels-page')); await p.fill(T('lab-n'), '8'); await p.click(T('lab-generate')); await p.waitForTimeout(600);
  pdfCodes = (await api(p, '/qr')).codes; expect(pdfCodes.length >= 32, 'codes ' + pdfCodes.length);
  await p.click(T('lab-unassigned')); await p.click(T('lab-preview')); await p.waitForSelector(T('lab-open'));
  const r = await p.request.get(BASE + '/api/labels.pdf?unassigned=1&template=avery6570&name=0'); expect(r.headers()['content-type'] === 'application/pdf', 'pdf type');
  fs.writeFileSync('/tmp/sheet.pdf', await r.body()); const pages = execSync('pdfinfo /tmp/sheet.pdf').toString().match(/Pages:\s+(\d+)/)[1]; expect(+pages >= 1, 'pages');
  execSync(`pdftoppm -r 90 -png -f 1 -l 1 /tmp/sheet.pdf /tmp/sheetimg && mv /tmp/sheetimg-1.png ${S}/03-qr-print-sheet-avery6570.png`);
  const r2 = await p.request.get(BASE + '/api/labels.pdf?all=1&template=l7160&name=1'); fs.writeFileSync('/tmp/sheet2.pdf', await r2.body());
  execSync(`pdftoppm -r 90 -png -f 1 -l 1 /tmp/sheet2.pdf /tmp/sheetimg2 && mv /tmp/sheetimg2-1.png ${S}/04-qr-print-sheet-l7160-assets.png`);
  await p.screenshot({ path: S + '/05-labels-page.png' });
});
await step('map: pins + card + trail', async () => {
  await p.goto(BASE + '/#/assets-map'); await p.waitForSelector(T('am-map') + ' .pin-icon'); expect(await p.locator('.pin-icon').count() >= 10, 'pins');
  await p.locator('.pin-icon').nth(2).click({ force: true }); await p.waitForSelector(T('am-card')); await p.waitForTimeout(800); await p.screenshot({ path: S + '/06-map.png' });
});
await step('agenda shows service scheduled / end of life', async () => { await p.goto(BASE + '/#/assets-agenda'); await p.waitForSelector(T('agenda')); expect(await p.locator(T('ag-ev')).count() >= 1, 'events'); await p.screenshot({ path: S + '/07-agenda.png' }); });
await step('tasks page sorted by priority', async () => { await p.goto(BASE + '/#/assets-tasks'); await p.waitForSelector(T('task-row')); expect((await p.locator(T('task-row')).first().textContent()).includes('Critical'), 'critical first'); });
await step('reports CSV incl. depreciation', async () => {
  for (const k of ['all', 'assignment', 'history']) { const r = await p.request.get(BASE + '/api/assets-report/' + k); expect(r.ok() && (await r.text()).split('\n').length > 2, k); }
  const r = await p.request.get(BASE + '/api/assets-report/depreciation?method=DB150'); const t = await r.text(); expect(t.includes('Book value') && t.split('\n').length > 5, 'dep');
  await p.goto(BASE + '/#/assets-reports'); await p.waitForSelector(T('rep-dep')); await p.screenshot({ path: S + '/08-reports.png' });
});
await step('settings: built-in field toggle + custom fields', async () => {
  await p.goto(BASE + '/#/assets-settings'); await p.waitForSelector(T('settings-page'));
  const labels = await p.locator(T('set-custom-label')).evaluateAll((els) => els.map((e) => e.value));
  for (const n of ['Co2', 'Adresse', 'Etg', 'Plassering', 'Aquastop levert av KK', 'Grutgjennomføring', 'Fresk melk', 'Avdeling', 'Filter', 'Kontakt person og Nr']) expect(labels.includes(n), 'custom ' + n);
  await p.uncheck(T('set-on-warranty')).catch(() => {}); await p.check(T('set-on-warranty')); await p.click(T('set-save')); await p.waitForTimeout(400);
  const s = await api(p, '/assets/settings'); expect(s.fields.find((f) => f.key === 'warranty').on, 'saved'); await p.screenshot({ path: S + '/09-settings.png' });
});

// ---------------- phone ----------------
const geo = { latitude: 59.9116, longitude: 10.7490, accuracy: 12 };
const pc = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: geo });
const m = await pc.newPage(); m.on('pageerror', (e) => errs.push('phone: ' + e.message));
await step('phone login', () => login(m));
const target = all.find((a) => a.data.asset_type === 'Kvern');
await step('phone camera opens sticker URL /s/<code> → GPS scan saved', async () => {
  await m.goto(BASE + '/s/' + target.code); await m.waitForSelector(T('asd-banner'), { timeout: 15000 });
  expect((await m.textContent(T('asd-banner'))).includes('GPS'), 'banner'); expect(m.url().includes('#/assets/'), 'url');
  const a = (await api(m, '/assets/' + target.id)).asset; expect(Math.abs(a.last_lat - geo.latitude) < 1e-4 && Math.abs(a.last_lng - geo.longitude) < 1e-4, 'gps saved ' + a.last_lat);
  await m.locator('.install-banner button, [data-testid="install-banner"] button').last().tap().catch(() => {});
  await m.waitForTimeout(900); await m.screenshot({ path: S + '/10-phone-scan-saved.png' });
});
await step('phone list = cards, no sideways scroll', async () => {
  await m.goto(BASE + '/#/assets'); await m.waitForSelector(T('as-cards')); expect(await m.locator(T('as-card')).count() >= 14, 'cards');
  expect((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'no h-scroll'); await m.screenshot({ path: S + '/11-phone-asset-list.png' });
});
const fresh = pdfCodes[0].code;
await step('activate unused tag on scan', async () => {
  await m.goto(BASE + '/s/' + fresh); await m.waitForSelector(T('activate')); await m.screenshot({ path: S + '/12-phone-activate-tag.png' });
  await m.selectOption(T('act-type'), 'Kvern'); await m.fill(T('act-model'), 'Demo Kvern 64'); await m.tap(T('act-save'));
  await m.waitForSelector(T('asd-code')); expect((await m.textContent(T('asd-code'))).includes(fresh), 'activated code');
  const r = await api(m, '/scan/' + fresh); expect(r.kind === 'asset', 'resolves');
});
await step('phone check-out on the spot', async () => {
  await m.locator(T('install-banner')).locator('button').last().tap().catch(() => {});
  await m.tap(T('asd-checkout')); await m.tap(T('co-kind-job')); await m.fill(T('co-to'), 'Kafé Demo Sentrum'); await m.tap(T('co-save')); await m.waitForSelector(T('asd-checkin'));
});
await step('phone map', async () => { await m.goto(BASE + '/#/assets-map'); await m.waitForSelector('.pin-icon'); await m.waitForTimeout(800); await m.screenshot({ path: S + '/13-phone-map.png' }); });
await step('scanner: type-code fallback works', async () => {
  await m.goto(BASE + '/#/assets'); await m.waitForSelector(T('as-cards')); await m.tap(T('as-scan')); await m.waitForSelector(T('scanner'));
  await m.waitForTimeout(800); await m.screenshot({ path: S + '/14-phone-scanner.png' });
  if (!(await m.locator(T('scanner-code')).count())) await m.tap(T('scanner-type'));
  await m.fill(T('scanner-code'), target.code.toLowerCase().replace('-', '')); await m.tap(T('scanner-go')); await m.waitForSelector(T('asd-banner'), { timeout: 15000 });
});

// in-app camera scanner with a fake camera that films a GoCodes-style sticker (gkd.bz/<ID>) → matched via old GoCodes ID
const legacyA = all.find((a) => a.legacy_code);
await step('in-app camera reads old GoCodes sticker (fake camera)', async () => {
  await QR.toFile('/tmp/qr.png', 'https://gkd.bz/' + legacyA.legacy_code.replace('-', ''), { width: 360, margin: 4 });
  execSync('ffmpeg -y -loglevel error -loop 1 -i /tmp/qr.png -vf "pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p" -t 3 -r 10 /tmp/qr.y4m');
  const b2 = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=/tmp/qr.y4m'] });
  const c2 = await b2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation', 'camera'], geolocation: geo });
  const q = await c2.newPage(); await login(q); await q.goto(BASE + '/#/scan'); await q.waitForSelector(T('scanner'));
  await q.waitForURL(new RegExp('#/assets/' + legacyA.id), { timeout: 15000 }); await q.waitForSelector(T('asd-banner'));
  await b2.close();
});
await step('public scan (not logged in): public fields + reward + message to owner', async () => {
  const withReward = all.find((a) => a.data.reward);
  const pub = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const x = await pub.newPage();
  await x.goto(BASE + '/s/' + withReward.code); await x.waitForSelector(T('public-scan')); const t = await x.textContent(T('public-scan'));
  expect(t.includes('Finnerlønn') && !t.includes('Erik') && !t.includes('Servicebil'), 'public only'); await x.fill(T('ps-text'), 'Found it by the door (test)');
  await x.screenshot({ path: S + '/15-phone-public-scan.png' }); await x.tap(T('ps-send')); await x.waitForSelector(T('ps-sent'));
  const msgs = await api(m, '/asset-messages'); expect(msgs.some((g) => g.text.includes('Found it by the door')), 'inbox'); await pub.close();
  const priv = await (await b.newContext()).request.get(BASE + '/api/assets'); expect(priv.status() === 401, 'assets api protected');
});
await b.close();
console.log(`\n${ok} passed, ${fail} failed`); if (errs.length) console.log('page errors:', errs.slice(0, 5));
process.exit(fail ? 1 : 0);
