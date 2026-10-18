// Kaffeknappen boards: structure checks + screenshots (desktop + phone). node tests/kk.mjs [baseUrl]
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4399', S = process.env.SHOTS || '/workspace/monday-clone/screenshots';
const EMAIL = process.env.E2E_EMAIL, PASS = process.env.E2E_PASSWORD, T = (id) => `[data-testid="${id}"]`;
let pass = 0, fail = 0; const errs = [];
const step = async (n, f) => { try { await f(); pass++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();
const login = async (p) => { await p.goto(BASE + '/#/home'); await p.fill(T('login-email'), EMAIL); await p.fill(T('login-password'), PASS); await p.click(T('login-submit')); await p.waitForSelector(T('board-card')); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
await login(p);
const boot = await (await p.request.get(BASE + '/api/bootstrap')).json();
const id = (n) => boot.boards.find((x) => x.name === n).id;
const board = async (n) => (await (await p.request.get(BASE + '/api/boards/' + id(n))).json());
await step('Kaffeknappen workspace with 3 boards', async () => {
  expect(boot.workspaces.find((w) => w.id === 'w_kk')?.name === 'Kaffeknappen', 'workspace');
  for (const n of ['Feilmeldinger/Oppdrag', 'Monteringsplan', 'Alle Kunder']) expect(boot.boards.find((x) => x.name === n && x.workspace_id === 'w_kk'), n);
});
await step('Feilmeldinger: groups, columns, labels, mirrors resolved, automations', async () => {
  const d = await board('Feilmeldinger/Oppdrag');
  expect(d.board.groups.length === 14 && d.board.groups[1].name === 'Completed Feilmeldinger', 'groups');
  const fe = d.board.columns.find((c) => c.title === 'FEIL'); expect(fe.settings.labels.filter((l) => l.label).length === 16, 'FEIL labels');
  const mirrors = d.board.columns.filter((c) => c.type === 'mirror'); expect(mirrors.length === 8 && mirrors.every((m) => m.settings.colId), 'mirrors ' + mirrors.map((m) => m.title + ':' + !!m.settings.colId));
  expect(d.board.automations.length === 7, 'automations'); expect(d.items.length >= 6, 'items');
});
await step('Monteringsplan: machine subitems with stock / week / serial', async () => {
  const d = await board('Monteringsplan');
  expect(d.board.sub_columns.map((c) => c.title).join(',') === 'Klargjort,Antall,LAGER,På lager,Forventet levering,Serial Nr,Følgeseddel nr,Date', 'sub columns');
  expect(d.items.filter((i) => i.parent_id).length >= 6, 'subitems'); expect(d.board.automations.length === 8, 'automations');
});
await step('Feilmeldinger table (desktop) + mirrors show customer data', async () => {
  await p.goto(BASE + '/#/board/' + id('Feilmeldinger/Oppdrag')); await p.waitForSelector(T('item-row')); await p.waitForTimeout(1200);
  expect(await p.locator('.mirror-text', { hasText: 'K-9000' }).count() >= 1, 'Kunde nr mirror');
  await p.screenshot({ path: S + '/24-kk-feilmeldinger.png' });
});
await step('automation: Process Status → Ferdig moves to Completed', async () => {
  const row = p.locator(T('item-row'), { hasText: 'Nordlys Demo Hotell' });
  await row.locator(T('status-cell')).nth(1).click(); await p.locator('.popover .label-pill', { hasText: /^Ferdig$/ }).first().click(); await p.waitForTimeout(800);
  const d2 = await board('Feilmeldinger/Oppdrag'); const it = d2.items.find((i) => i.name === 'Nordlys Demo Hotell');
  expect(it.group_id === d2.board.groups[1].id, 'moved');
});
await step('Monteringsplan with machines expanded (desktop)', async () => {
  await p.goto(BASE + '/#/board/' + id('Monteringsplan')); await p.waitForSelector(T('item-row')); await p.waitForTimeout(800);
  await p.locator(T('item-row'), { hasText: 'Demo Kaffebar Sentrum' }).locator(T('sub-toggle')).click(); await p.waitForSelector(T('subitem-row'));
  expect(await p.locator(T('week-cell'), { hasText: 'Uke' }).count() >= 1, 'week cells'); expect(await p.locator(T('sub-mirror')).count() >= 1, 'På lager mirror');
  await p.screenshot({ path: S + '/25-kk-monteringsplan.png' });
});
await step('Alle Kunder map (desktop)', async () => {
  await p.goto(BASE + '/#/board/' + id('Alle Kunder')); await p.waitForSelector(T('item-row')); await p.screenshot({ path: S + '/26-kk-alle-kunder.png' });
  await p.click(T('view-map')); await p.waitForSelector('.pin-icon'); await p.waitForTimeout(2000); await p.screenshot({ path: S + '/27-kk-kunder-map.png' });
});
await step('templates available in New board', async () => {
  expect(['kk_kunder', 'kk_feil', 'kk_montering'].every((k) => boot.templates.some((t) => t.key === k)), 'templates');
});
const ph = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const m = await ph.newPage(); m.on('pageerror', (e) => errs.push(e.message));
await step('phone: Feilmeldinger cards', async () => {
  await login(m); await m.goto(BASE + '/#/board/' + id('Feilmeldinger/Oppdrag')); await m.waitForSelector(T('m-card')); await m.waitForTimeout(1200);
  if (await m.locator(T('install-banner')).count()) await m.locator(T('install-banner')).locator('button').last().tap();
  expect(await m.locator(T('m-directions')).count() >= 3 && await m.locator(T('m-call')).count() >= 3, 'directions + call via customer mirror');
  await m.screenshot({ path: S + '/28-kk-phone-feilmeldinger.png' });
});
await step('phone: Monteringsplan cards', async () => {
  await m.goto(BASE + '/#/board/' + id('Monteringsplan')); await m.waitForSelector(T('m-card')); await m.waitForTimeout(800);
  await m.screenshot({ path: S + '/29-kk-phone-monteringsplan.png' });
});
console.log(`\n${pass} passed, ${fail} failed. Page errors: ${errs.length ? errs : 'none'}`);
await b.close(); process.exit(fail ? 1 : 0);
