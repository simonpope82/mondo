// End-to-end test: node tests/e2e.mjs [baseUrl]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4321';
const SHOTS = process.env.SHOTS || '/workspace/monday-clone/screenshots';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 920 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
let ok = 0, fail = 0;
const step = async (name, fn) => { try { await fn(); ok++; console.log('✅', name); } catch (e) { fail++; console.log('❌', name, '-', e.message.split('\n')[0]); } };
const expect = (c, msg) => { if (!c) throw new Error(msg); };
const T = (id) => `[data-testid="${id}"]`;

const EMAIL = process.env.E2E_EMAIL, PASS = process.env.E2E_PASSWORD;
await step('protected: login page shown, API 401', async () => {
  await p.goto(BASE + '/#/home'); await p.waitForSelector(T('login-email')); await p.waitForTimeout(1200);
  const r = await p.request.get(BASE + '/api/bootstrap'); expect(r.status() === 401, 'api ' + r.status());
  await p.screenshot({ path: SHOTS + '/09-login.png' });
});
await step('wrong password is refused', async () => {
  await p.fill(T('login-email'), EMAIL); await p.fill(T('login-password'), 'wrong-password'); await p.click(T('login-submit'));
  await p.waitForSelector(T('login-error'));
});
await step('login works', async () => {
  await p.fill(T('login-password'), PASS); await p.click(T('login-submit')); await p.waitForSelector(T('board-card'));
  const c = (await p.context().cookies()).find((c) => c.name === 'mondo_sid'); expect(c && c.httpOnly, 'httpOnly cookie');
});
const name = 'Test board ' + Date.now().toString().slice(-4);

await step('create board from template', async () => {
  await p.click(T('add-board')); await p.fill(T('new-board-name'), name); await p.click(T('tpl-project')); await p.click(T('create-board'));
  await p.waitForSelector(T('board-title')); expect((await p.textContent(T('board-title'))) === name, 'title');
});
await step('add group + rename', async () => {
  const before = await p.locator(T('group')).count();
  await p.click(T('add-group')); await p.waitForTimeout(400);
  expect((await p.locator(T('group')).count()) === before + 1, 'group count');
  await p.locator(T('group-name')).last().click(); await p.fill(T('group-name-input'), 'Ideas 💡'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  expect((await p.locator(T('group-name')).last().textContent()) === 'Ideas 💡', 'rename');
});
await step('add item', async () => {
  await p.locator(T('add-item-input')).first().fill('Call the supplier'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  expect(await p.getByText('Call the supplier').count() === 1, 'item visible');
});
const row = () => p.locator(T('item-row'), { hasText: 'Call the supplier' });
await step('change status to Done', async () => {
  await row().locator(T('status-cell')).first().click();
  await p.locator('.popover .label-pill', { hasText: 'Done' }).click(); await p.waitForTimeout(400);
  expect((await row().locator(T('status-cell')).first().textContent()).includes('Done'), 'status');
});
await step('edit status labels (add new label)', async () => {
  await row().locator(T('status-cell')).first().click(); await p.click('text=Edit labels'); await p.click('text=New label');
  await p.waitForTimeout(300); await p.click('.popover >> text=Apply'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape');
});
await step('set person, number, date', async () => {
  await row().locator(T('people-cell')).click(); await p.locator('.popover .menu-item', { hasText: 'Anna' }).click(); await p.keyboard.press('Escape');
  await row().locator(T('number-cell')).click(); await p.fill(T('cell-input'), '1500'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  expect((await row().locator(T('number-cell')).textContent()).includes('1'), 'number');
  await row().locator(T('date-cell')).click(); await p.click('.popover >> text=Today'); await p.waitForTimeout(300);
  const sums = await p.locator(T('sum')).first().textContent(); expect(sums.includes('500'), 'group sum ' + sums);
});
await step('add column (Dropdown) and rename', async () => {
  const before = await p.locator('.head-row:not(.sub)').first().locator('.col-head').count();
  await p.locator(T('add-column')).first().click(); await p.click(T('coltype-dropdown')); await p.waitForTimeout(400);
  expect((await p.locator('.head-row:not(.sub)').first().locator('.col-head').count()) === before + 1, 'col added');
});
await step('add subitem', async () => {
  await row().locator(T('sub-toggle')).click(); await p.fill(T('add-subitem-input'), 'Find phone number'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  expect(await p.locator(T('subitem-row'), { hasText: 'Find phone number' }).count() === 1, 'subitem');
});
await step('item panel + update with @mention', async () => {
  await row().locator(T('open-updates')).click(); await p.waitForSelector(T('item-panel'));
  await p.fill(T('update-input'), 'Hi @Anna Berg please call them today'); await p.click(T('post-update')); await p.waitForTimeout(500);
  expect(await p.locator(T('update-card')).count() === 1, 'update'); expect(await p.locator('.mention').count() >= 1, 'mention');
  await p.screenshot({ path: SHOTS + '/04-item-panel.png' });
  await p.click(T('close-panel'));
});
await step('search filters rows', async () => {
  await p.fill(T('board-search'), 'supplier'); await p.waitForTimeout(300);
  expect(await p.locator(T('item-row')).count() === 1, 'one row'); await p.fill(T('board-search'), '');
});
await step('drag item to another group', async () => {
  await row().locator('.grip').dragTo(p.locator(T('add-item-input')).nth(1)); await p.waitForTimeout(600);
  const g2 = p.locator(T('group')).nth(1); expect(await g2.getByText('Call the supplier').count() === 1, 'moved');
});
await step('kanban view + drag card to Stuck', async () => {
  await p.click(T('view-kanban')); await p.waitForSelector(T('lane'));
  const card = p.locator(T('card'), { hasText: 'Call the supplier' });
  await card.dragTo(p.locator(T('lane'), { hasText: 'Stuck' })); await p.waitForTimeout(600);
  expect(await p.locator(T('lane'), { hasText: 'Stuck' }).getByText('Call the supplier').count() === 1, 'in Stuck lane');
});
await step('persist after reload', async () => {
  await p.reload(); await p.waitForSelector(T('board-title')); await p.waitForTimeout(500);
  expect(await p.getByText('Call the supplier').count() >= 1, 'persisted');
});

// demo board screenshots
await p.goto(BASE + '/#/home'); await p.waitForSelector(T('board-card'));
await p.locator(T('board-card'), { hasText: 'Demo project' }).click(); await p.waitForSelector(T('item-row'));
await p.locator(T('item-row'), { hasText: 'Plan new website' }).locator(T('sub-toggle')).click(); await p.waitForTimeout(300);
await p.screenshot({ path: SHOTS + '/01-table-view.png' });
await p.click(T('view-kanban')); await p.waitForTimeout(500); await p.screenshot({ path: SHOTS + '/02-kanban-view.png' });
await step('calendar, timeline, chart views render', async () => {
  await p.click(T('view-calendar')); await p.waitForSelector('.cal-grid'); await p.screenshot({ path: SHOTS + '/05-calendar-view.png' });
  await p.click(T('view-timeline')); await p.waitForSelector('.tl-bar'); await p.screenshot({ path: SHOTS + '/06-timeline-view.png' });
  await p.click(T('view-chart')); await p.waitForSelector('.donut');
});
await step('filter by status', async () => {
  await p.click(T('view-table')); await p.click(T('filter-btn')); await p.locator('.filter-opt', { hasText: 'Stuck' }).first().click(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  expect(await p.locator(T('item-row')).count() === 1, 'one stuck'); await p.click('text=Clear all');
});

// automations on service board
await step('automation: Fixed → moves group + notification', async () => {
  await p.goto(BASE + '/#/home'); await p.locator(T('board-card'), { hasText: 'Service jobs' }).click(); await p.waitForSelector(T('item-row'));
  const r = p.locator(T('item-row'), { hasText: 'Café Sol' });
  await r.locator(T('status-cell')).first().click(); await p.locator('.popover .label-pill', { hasText: 'Fixed' }).click(); await p.waitForTimeout(800);
  const g2 = p.locator(T('group')).nth(1); expect(await g2.locator(T('item-row'), { hasText: 'Café Sol' }).count() === 1, 'moved by automation');
  expect((await p.textContent(T('bell'))).trim() !== '', 'bell badge');
  expect(await p.locator('.mirror-text', { hasText: 'Kari' }).count() >= 1, 'mirror column shows contact');
  await p.waitForTimeout(300); await p.screenshot({ path: SHOTS + '/03-service-board-automation.png' });
});
await step('form creates item', async () => {
  const FC = 'Form customer ' + Date.now().toString().slice(-5);
  const bid = (await p.evaluate(() => location.hash)).split('/')[2];
  await p.goto(BASE + '/#/form/' + bid); await p.fill(T('form-name'), FC); await p.screenshot({ path: SHOTS + '/07-form.png' });
  await p.click(T('form-submit')); await p.waitForSelector('text=Thank you');
  await p.goto(BASE + '/#/board/' + bid); await p.waitForSelector(T('item-row'));
  expect(await p.getByText(FC).count() === 1, 'form item');
  expect((await p.locator(T('item-row'), { hasText: FC }).locator(T('status-cell')).first().textContent()).includes('New'), 'auto default status');
});
await step('delete test board', async () => {
  await p.goto(BASE + '/#/home'); await p.locator(T('board-card'), { hasText: name }).click(); await p.waitForSelector(T('board-title'));
  await p.locator(T('side-board'), { hasText: name }).hover(); await p.locator(T('side-board'), { hasText: name }).locator('button').click();
  await p.click('text=Delete board'); await p.click(T('confirm-ok')); await p.waitForTimeout(500);
  expect(await p.locator(T('side-board'), { hasText: name }).count() === 0, 'deleted');
});
await step('admin adds a user', async () => {
  await p.goto(BASE + '/#/users'); await p.click(T('add-user')); await p.fill(T('user-name'), 'Test Person'); await p.fill(T('user-email'), 'person' + Date.now() + '@example.com');
  await p.waitForTimeout(300); await p.click(T('user-save')); await p.waitForSelector(T('new-password'));
  expect((await p.textContent(T('new-password'))).length >= 8, 'pw shown'); await p.keyboard.press('Escape'); await p.click('text=Done');
});
await step('form is private until shared', async () => {
  const boards = await (await p.request.get(BASE + '/api/bootstrap')).json(); const bid = boards.boards[0].id;
  const anon = await chromium.launch(); const ap = await anon.newPage();
  let r = await ap.request.get(BASE + '/api/forms/' + bid); expect(r.status() === 404, 'private ' + r.status());
  await p.request.patch(BASE + '/api/boards/' + bid, { data: { form: { public: true } } });
  r = await ap.request.get(BASE + '/api/forms/' + bid); expect(r.status() === 200, 'public ' + r.status());
  await p.request.patch(BASE + '/api/boards/' + bid, { data: { form: { public: false } } });
  await anon.close();
});
await p.goto(BASE + '/#/home'); await p.waitForTimeout(800); await p.screenshot({ path: SHOTS + '/00-home.png' });
await step('map view on desktop: pins + card', async () => {
  await p.goto(BASE + '/#/home'); await p.locator(T('board-card'), { hasText: 'Service jobs' }).click(); await p.waitForSelector(T('item-row'));
  await p.click(T('view-map')); await p.waitForSelector('.pin-icon', { timeout: 15000 }); await p.waitForTimeout(1500);
  expect(await p.locator('.pin-icon').count() >= 5, 'pins'); await p.screenshot({ path: SHOTS + '/23-desktop-map.png' });
  await p.locator('.pin-icon').first().click({ force: true }); await p.waitForSelector(T('map-card'));
  expect((await p.getAttribute(T('directions'), 'href')).includes('google.com/maps/dir'), 'directions link');
});
await step('logout', async () => {
  await p.click(T('user-menu')); await p.click('text=Log out'); await p.waitForSelector(T('login-email'));
  const r = await p.request.get(BASE + '/api/bootstrap'); expect(r.status() === 401, 'after logout ' + r.status());
});
const mc = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const m = await mc.newPage(); await m.goto(BASE + '/#/home'); await m.fill(T('login-email'), EMAIL); await m.fill(T('login-password'), PASS); await m.click(T('login-submit')); await m.waitForSelector(T('board-card')); await m.waitForTimeout(800); await m.screenshot({ path: SHOTS + '/08-mobile-home.png' });
console.log(`\n${ok} passed, ${fail} failed. Page errors:`, errs.length ? errs : 'none');
await b.close(); process.exit(fail ? 1 : 0);
