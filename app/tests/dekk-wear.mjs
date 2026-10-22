// Worn tyres: booking note + choices, staff pop-up, reminder setting, customer notice/push: node tests/dekk-wear.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://localhost:4321'; const S = process.env.SHOTS || '/workspace/web-bil/screenshots'; fs.mkdirSync(S, { recursive: true });
const T = (id) => `[data-testid="${id}"]`; let ok = 0, fail = 0; const errs = [];
const step = async (n, fn) => { try { await fn(); ok++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();
const api = async (p, u, body, m) => { const r = m === 'put' ? await p.request.put(BASE + '/api' + u, { data: body }) : body ? await p.request.post(BASE + '/api' + u, { data: body }) : await p.request.get(BASE + '/api' + u); return r.json(); };
const ph = await b.newContext({ ...devices['iPhone 13'] }); const m = await ph.newPage(); m.on('pageerror', (e) => errs.push(e.message));
async function bookTo(p, reg, name, phone) {
  await p.goto(BASE + '/book?site=web-bil'); await p.click(T('bk-svc-hjulskift')); await p.click(T('bk-next')); await p.fill(T('bk-reg'), reg); await p.click(T('bk-next'));
  await p.waitForSelector('.bk-time:not([disabled])'); await p.locator('.bk-time:not([disabled])').nth(3).click(); await p.click(T('bk-next'));
  await p.fill(T('bk-name'), name); await p.fill(T('bk-phone'), phone);
}
await step('public API: note only when phone AND regnr match', async () => {
  const a = await api(m, '/book/prev?phone=40000103&regnr=DM10003'); expect(a.known && a.worn?.level === 'Ja', JSON.stringify(a).slice(0, 200));
  const x = await api(m, '/book/prev?phone=40000103&regnr=DM10001'); expect(!x.known && !x.worn && !x.note, 'leak');
});
await step('booking: "Notat fra forrige gang" + choices for known customer with worn tyres', async () => {
  await bookTo(m, 'DM 10003', 'Lise Prøve', '400 00 103'); await m.waitForSelector(T('prev-note')); const t = await m.textContent(T('prev-note'));
  expect(t.includes('Notat fra forrige gang') && /mm/.test(t), t); await m.click(T('tc-offer')); await m.locator(T('prev-note')).scrollIntoViewIfNeeded(); await m.waitForTimeout(300);
  await m.screenshot({ path: S + '/v4-notat-forrige-gang.png' });
  await m.click(T('bk-submit')); await m.waitForSelector(T('bk-done')); await m.waitForSelector(T('tc-saved'));
  expect((await m.textContent(T('tyre-choice'))).includes('Husk: du trenger nye dekk'), 'worn line'); await m.locator(T('tyre-choice')).scrollIntoViewIfNeeded(); await m.screenshot({ path: S + '/v4-bekreftelse-valg.png' });
  await m.click(T('tc-yes')); await m.waitForFunction(() => document.querySelector('[data-testid="tc-saved"]')?.textContent.includes('Ja, bestill'));
});
await step('booking: generic "Trenger du nye dekk?" for unknown customer', async () => {
  await bookTo(m, 'XX 99887', 'Ny Demokunde', '499 88 776'); await m.waitForTimeout(700); expect(!(await m.locator(T('prev-note')).count()), 'no note'); await m.click(T('bk-submit')); await m.waitForSelector(T('tyre-choice'));
  expect((await m.textContent(T('tyre-choice'))).includes('Trenger du nye dekk?'), 'generic'); await m.click(T('tc-generic_yes')); await m.waitForSelector(T('tc-saved')); await m.screenshot({ path: S + '/v4-bekreftelse-ny-kunde.png' });
});
const st0 = await b.newContext({ ...devices['iPhone 13'] }); const s = await st0.newPage(); s.on('pageerror', (e) => errs.push(e.message));
await s.goto(BASE + '/#/home'); await s.fill(T('login-email'), process.env.E2E_EMAIL); await s.fill(T('login-password'), process.env.E2E_PASSWORD); await s.click(T('login-submit')); await s.waitForSelector(T('board-card'));
const st = (await api(s, '/dekk/settings')).settings;
await step('staff: choice visible on booking', async () => { const bk = await api(s, '/boards/' + st.boards.bookinger); const c = bk.board.columns.find((x) => x.title === 'Nye dekk-valg'); expect(bk.items.some((i) => /Ja, bestill nye dekk/.test(i.vals[c.id] || '')), 'choice col'); });
await step('staff: gamle dekk tatt av → pop-up, task on customer, notification', async () => {
  const lb = await api(s, '/boards/' + st.boards.lager); const cId = lb.board.columns.find((c) => c.title === 'Hjulsett-ID').id; const set = lb.items.find((i) => /Nina Test – Vinter/.test(i.name));
  await s.goto(BASE + '/#/dekk/hjulsett/' + set.vals[cId]); await s.click(T('ts-wear'));
  for (const [w, v] of [['VF', '2,9'], ['HF', '3,1'], ['VB', '2,6'], ['HB', '2,8']]) await s.fill(T('wm-' + w), v);
  await s.screenshot({ path: S + '/v4-staff-registrer-monster.png' }); await s.click(T('wm-save')); await s.waitForSelector(T('wear-alert'));
  expect((await s.textContent(T('wear-alert'))).includes('Disse dekkene må det bestilles nye dekk til'), 'popup'); await s.screenshot({ path: S + '/v4-staff-popup.png' });
  const kb = await api(s, '/boards/' + st.boards.kunder); const c = kb.board.columns.find((x) => x.title === 'Oppgave'); const nina = kb.items.find((i) => i.name === 'Nina Test');
  expect(c.settings.labels.find((l) => l.id === nina.vals[c.id])?.label === 'Bestill nye dekk', 'task');
  const n = await api(s, '/notifications'); expect(JSON.stringify(n).includes('Disse dekkene må det bestilles nye dekk til'), 'notif');
});
await step('Oppsett: reminder month/day setting (marked to be decided)', async () => {
  await s.setViewportSize({ width: 390, height: 1100 }); await s.goto(BASE + '/#/dekk/oppsett'); await s.waitForSelector(T('wear-settings')); expect(await s.locator(T('wear-undecided')).count(), 'undecided');
  await s.locator(T('wear-settings')).scrollIntoViewIfNeeded(); await s.locator(T('wear-settings')).screenshot({ path: S + '/v4-paaminnelse-innstilling.png' });
  const w = await api(s, '/dekk/wear/settings'); expect(w.reminder.month === 9, 'default Sept');
});
await step('reminder run: staff notice + customer notice/push + SMS/e-mail drafts only', async () => {
  const r = await api(s, '/dekk/wear/run-reminders', { today: '2099-12-31' }); expect(r.sent >= 1, JSON.stringify(r));
  const ob = await api(s, '/dekk/outbox'); const list = ob.items || ob.outbox || ob; expect(JSON.stringify(list).includes('Dekkene dine er slitte') && !JSON.stringify(list).includes('"Sendt"'), 'drafts');
});
await step('Min side: notat fra forrige gang, visible staff note only, notice', async () => {
  const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/minside'); await p.fill(T('portal-user'), '40000101'); await p.fill(T('portal-pass'), 'demo-kunde'); await p.click(T('portal-submit')); await p.waitForSelector(T('prev-note'));
  const t = await p.textContent('body'); expect(t.includes('Låsebolten ligger i hanskerommet') && !t.includes('Internt') && t.includes('Husk: du trenger nye dekk'), 'notes');
  await p.waitForSelector(T('portal-notice')); await p.click(T('tc-offer')); await p.waitForSelector(T('tc-saved')); await p.screenshot({ path: S + '/v4-minside-notat.png' });
  await p.locator(T('portal-push')).scrollIntoViewIfNeeded(); await p.screenshot({ path: S + '/v4-kunde-push.png' });
});
await b.close(); if (errs.length) { fail++; console.log('❌ page errors', errs.join(' | ')); }
console.log(`\n${ok} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
