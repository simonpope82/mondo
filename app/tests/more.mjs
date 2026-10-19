// Ledelse / Employee / Biler boards: structure checks + one screenshot per board + phone. node tests/more.mjs [baseUrl]
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
const BOARDS = [
  ['Styrets handlingsplan Kaffeknappen 2025', 'w_ledelse', 6, 2, '30-styrets-handlingsplan.png'],
  ['4-banden ledelsesmøte', 'w_ledelse', 4, 2, '31-ledelsesmote.png'],
  ['Strategi 2030', 'w_ledelse', 4, 2, '32-strategi-2030.png'],
  ['Handlingsplan 2026 Service', 'w_ledelse', 9, 3, '33-handlingsplan-2026-service.png'],
  ['Employee Kaffeknappen', 'w_kk', 22, 2, '34-employee-kaffeknappen.png'],
  ['Employee Magnat', 'w_magnat', 19, 2, '35-employee-magnat.png'],
  ['KK biler', 'w_kk', 19, 2, '36-kk-biler.png'],
  ['MK biler', 'w_magnat', 11, 1, '37-mk-biler.png'],
];
for (const [name, ws, ncol, ngrp, shot] of BOARDS) {
  await step(name, async () => {
    const bd = boot.boards.find((x) => x.name === name); expect(bd && bd.workspace_id === ws, 'board/workspace');
    const d = await (await p.request.get(BASE + '/api/boards/' + bd.id)).json();
    expect(d.board.columns.length === ncol, 'columns ' + d.board.columns.length); expect(d.board.groups.length === ngrp, 'groups'); expect(d.items.length >= 2, 'rows');
    await p.goto(BASE + '/#/board/' + bd.id); await p.waitForSelector(T('item-row')); await p.waitForTimeout(700);
    if (name === 'Strategi 2030' || name === 'KK biler') { await p.locator(T('sub-toggle')).first().click(); await p.waitForSelector(T('subitem-row')); }
    await p.screenshot({ path: S + '/' + shot });
  });
}
await step('employee boards hold no salary / ID / bank / phone / address values', async () => {
  for (const n of ['Employee Kaffeknappen', 'Employee Magnat']) {
    const d = await (await p.request.get(BASE + '/api/boards/' + boot.boards.find((x) => x.name === n).id)).json();
    const sens = d.board.columns.filter((c) => /lønn|bank|person nr|kontonr|phone|telephone|adresse/i.test(c.title)).map((c) => c.id);
    expect(sens.length >= 5, 'sensitive columns exist'); expect(d.items.every((i) => sens.every((id) => i.vals[id] == null)), 'values empty');
    expect(d.items.every((i) => i.name.includes('(demo)')), 'demo names');
  }
});
await step('templates available', async () => { expect(['styret_kk', 'ledermote', 'strategi', 'handlingsplan', 'employee_kk', 'employee_mk', 'biler_kk', 'biler_mk'].every((k) => boot.templates.some((t) => t.key === k)), 'templates'); });
const ph = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }); const m = await ph.newPage(); m.on('pageerror', (e) => errs.push(e.message));
await step('phone: KK biler cards', async () => {
  await login(m); await m.goto(BASE + '/#/board/' + boot.boards.find((x) => x.name === 'KK biler').id); await m.waitForSelector(T('m-card')); await m.waitForTimeout(1200);
  if (await m.locator(T('install-banner')).count()) await m.locator(T('install-banner')).locator('button').last().tap();
  await m.screenshot({ path: S + '/38-phone-kk-biler.png' });
});
await step('phone: Strategi 2030 cards', async () => {
  await m.goto(BASE + '/#/board/' + boot.boards.find((x) => x.name === 'Strategi 2030').id); await m.waitForSelector(T('m-card')); await m.waitForTimeout(800);
  await m.screenshot({ path: S + '/39-phone-strategi-2030.png' });
});
console.log(`\n${pass} passed, ${fail} failed. Page errors: ${errs.length ? errs : 'none'}`);
await b.close(); process.exit(fail ? 1 : 0);
