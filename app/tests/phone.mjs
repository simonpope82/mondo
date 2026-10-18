// Phone tests (390x844): node tests/phone.mjs [baseUrl]   env E2E_EMAIL / E2E_PASSWORD
import { chromium, devices } from 'playwright';
const JOB = 'Phone job ' + Date.now().toString().slice(-5);
const BASE = process.argv[2] || 'http://localhost:4399';
const S = process.env.SHOTS || '/workspace/monday-clone/screenshots';
const T = (id) => `[data-testid="${id}"]`;
let ok = 0, fail = 0; const errs = [];
const step = async (n, fn) => { try { await fn(); ok++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();

async function login(p) { await p.goto(BASE + '/#/home'); await p.fill(T('login-email'), process.env.E2E_EMAIL); await p.fill(T('login-password'), process.env.E2E_PASSWORD); await p.tap(T('login-submit')); await p.waitForSelector(T('board-card')); }

// iPhone (Safari UA) – install hint
const ios = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
const p = await ios.newPage(); p.on('pageerror', (e) => errs.push(e.message));
await step('login on phone', () => login(p));
await step('iOS: Add to Home Screen hint shows', async () => { await p.waitForSelector(T('install-banner')); await p.waitForTimeout(400); await p.screenshot({ path: S + '/16-phone-install-ios.png' }); await p.locator(T('install-banner')).locator('button').last().tap(); });
await step('phone list: cards, not the wide table', async () => {
  await p.locator(T('board-card'), { hasText: 'Service jobs' }).tap(); await p.waitForSelector(T('mobile-list'));
  expect(await p.locator(T('m-card')).count() >= 5, 'cards'); expect(await p.locator(T('item-row')).count() === 0, 'no table rows');
  expect((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'no sideways scroll');
  await p.waitForTimeout(300); await p.screenshot({ path: S + '/17-phone-list.png' });
});
await step('change status from card', async () => {
  const card = p.locator(T('m-card'), { hasText: 'Hotel Fjord' });
  await card.locator(T('status-cell')).first().tap(); await p.locator('.popover .label-pill', { hasText: 'Planned' }).tap(); await p.waitForTimeout(500);
  expect((await card.locator(T('status-cell')).first().textContent()).includes('Planned'), 'status');
});
await step('directions button uses saved pin', async () => {
  const href = await p.locator(T('m-card'), { hasText: 'Hotel Fjord' }).locator(T('m-directions')).getAttribute('href');
  expect(href.startsWith('https://www.google.com/maps/dir/?api=1&destination=60.39'), href);
});
await step('open item + post update', async () => {
  await p.locator(T('m-card'), { hasText: 'Hotel Fjord' }).locator(T('m-open')).tap(); await p.waitForSelector(T('item-panel'));
  await p.fill(T('update-input'), 'On my way 🚐'); await p.tap(T('post-update')); await p.waitForTimeout(400);
  expect(await p.locator(T('update-card')).count() >= 1, 'update'); await p.tap(T('close-panel'));
});
await step('add item on phone', async () => {
  await p.locator(T('m-add')).first().tap(); await p.fill(T('m-add-input'), JOB); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  expect(await p.locator(T('m-card'), { hasText: JOB }).count() === 1, 'added');
});
await step('address search (geocoding) saves a pin', async () => {
  await p.locator(T('m-card'), { hasText: JOB }).locator(T('m-open')).tap(); await p.tap(T('tab-info'));
  await p.locator(T('location-cell')).tap(); await p.fill(T('loc-input'), 'Nidarosdomen Trondheim'); await p.keyboard.press('Enter');
  await p.waitForSelector(T('loc-hit'), { timeout: 15000 }); await p.screenshot({ path: S + '/18-phone-address-search.png' });
  await p.locator(T('loc-hit')).first().tap(); await p.waitForTimeout(500);
  expect((await p.locator(T('location-cell')).textContent()).toLowerCase().includes('nidaros'), 'saved'); await p.tap(T('close-panel'));
});
await step('map view: pins + card with Google Maps buttons', async () => {
  await p.tap(T('view-map')); await p.waitForSelector('.pin-icon'); await p.waitForTimeout(1500);
  expect(await p.locator('.pin-icon').count() >= 7, 'pins ' + await p.locator('.pin-icon').count());
  await p.screenshot({ path: S + '/19-phone-map.png' });
  await p.locator('.pin-icon').first().tap({ force: true }); await p.waitForSelector(T('map-card'));
  const d = await p.locator(T('map-card')).locator(T('directions')).getAttribute('href'); expect(d.includes('/maps/dir/'), d);
  await p.screenshot({ path: S + '/20-phone-map-card.png' });
});
await step('kanban: long-press drag with finger', async () => {
  await p.tap(T('view-kanban')); await p.waitForSelector(T('lane'));
  const card = p.locator(T('card'), { hasText: 'Gym Nord' }); const cb = await card.boundingBox();
  const cdp = await ios.newCDPSession(p);
  const pt = (x, y) => [{ x, y, id: 1 }];
  const x0 = cb.x + 40, y0 = cb.y + 20;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
  await p.waitForTimeout(450);
  // target: the "Planned" lane – scroll lanes so it is visible, move finger towards the right edge
  for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + k * 25, y0 + 5) }); await p.waitForTimeout(40); }
  await p.waitForTimeout(600);
  const lanes = await p.locator(T('lane')).evaluateAll((ls) => ls.map((l) => [l.querySelector('.lane-head').textContent, l.getBoundingClientRect().left]));
  const target = lanes.find(([t, left]) => left > -10 && left < 300 && !t.startsWith('New'));
  const tx = Math.max(20, (target ? target[1] : 200) + 60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(tx, y0 + 40) }); await p.waitForTimeout(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(700);
  const lane = p.locator(T('lane'), { has: p.locator(T('card'), { hasText: 'Gym Nord' }) });
  const head = await lane.locator('.lane-head').textContent(); expect(!head.startsWith('New'), 'still in ' + head);
  console.log('   moved to lane:', head);
  await p.screenshot({ path: S + '/21-phone-kanban.png' });
});

// Android Chrome – install button (event simulated, headless Chrome never fires it)
const and = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
const a = await and.newPage(); a.on('pageerror', (e) => errs.push(e.message));
await step('Android: Install button from beforeinstallprompt', async () => {
  await login(a);
  await a.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
  await a.waitForSelector(T('install-btn')); await a.waitForTimeout(300); await a.screenshot({ path: S + '/22-phone-install-android.png' });
  await a.tap(T('install-btn')); await a.waitForTimeout(200); expect(await a.evaluate(() => window.__prompted), 'prompt called');
});
await step('PWA: manifest + service worker active', async () => {
  const m = await (await a.request.get(BASE + '/manifest.webmanifest')).json(); expect(m.display === 'standalone' && m.icons.length >= 3, 'manifest');
  await a.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.getRegistration().then((r) => !!r?.active), null, { timeout: 10000 });
});
await step('offline: board still readable from cache', async () => {
  await a.locator(T('board-card'), { hasText: 'Service jobs' }).tap(); await a.waitForSelector(T('mobile-list')); await a.waitForTimeout(800);
  await a.reload(); await a.waitForSelector(T('mobile-list')); await a.waitForTimeout(500);
  await and.setOffline(true); await a.reload(); await a.waitForSelector(T('mobile-list'), { timeout: 10000 });
  expect(await a.locator(T('m-card')).count() >= 5, 'cards offline'); await and.setOffline(false);
});
await step('push toggle shows state', async () => {
  await and.grantPermissions(['notifications'], { origin: BASE });
  await a.tap(T('bell')); await a.waitForSelector(T('push-toggle')); await a.waitForTimeout(800);
  const txt = await a.textContent(T('push-toggle')); console.log('   push toggle:', txt);
  if (txt.includes('Turn on')) { await a.tap(T('push-toggle')); await a.waitForTimeout(3000); console.log('   after tap:', await a.textContent(T('push-toggle'))); }
});
console.log(`\n${ok} passed, ${fail} failed. Page errors:`, errs.length ? errs : 'none');
await b.close(); process.exit(fail ? 1 : 0);
