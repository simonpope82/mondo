// Forgot/reset password, staff + Min side, with a throwaway test user: node tests/reset.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.argv[2] || 'http://localhost:4321'; const S = process.env.SHOTS || '/workspace/web-bil/screenshots'; fs.mkdirSync(S, { recursive: true });
const T = (id) => `[data-testid="${id}"]`; let ok = 0, fail = 0; const errs = [];
const step = async (n, fn) => { try { await fn(); ok++; console.log('✅', n); } catch (e) { fail++; console.log('❌', n, '-', e.message.split('\n')[0]); } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch();
const req = async (p, m, u, body) => { const r = await p.request[m](BASE + '/api' + u, body ? { data: body } : undefined); return { st: r.status(), j: await r.json().catch(() => ({})) }; };
const ad = await (await b.newContext()).newPage();
await step('simpope@gmail.com logs in with admin-password.txt', async () => { const r = await req(ad, 'post', '/auth/login', { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD }); expect(r.st === 200 && r.j.user?.role === 'admin', 'status ' + r.st); });
const email = `reset-test-${Date.now()}@example.com`; const pw0 = 'Start-pass-123', pw1 = 'Nytt-pass-456';
let uid;
await step('create throwaway test user', async () => { const r = await req(ad, 'post', '/users', { email, name: 'Reset Test', password: pw0 }); uid = r.j.id || r.j.user?.id; if (!uid) uid = (await req(ad, 'get', '/users')).j.find((u) => u.email === email)?.id; expect(uid, JSON.stringify(r.j)); });
const tc = await b.newContext({ ...devices['iPhone 13'] }); const tu = await tc.newPage(); tu.on('pageerror', (e) => errs.push('tu ' + e.message));
await req(tu, 'post', '/auth/login', { email, password: pw0 });
await step('login page: "Glemt passord?" link + neutral message (known = unknown)', async () => {

  const anon = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); anon.on('pageerror', (e) => errs.push('anon ' + e.message)); await anon.goto(BASE + '/'); await anon.waitForSelector(T('forgot-link'));
  await anon.screenshot({ path: S + '/reset-01-login-glemt-passord.png' }); await anon.click(T('forgot-link')); await anon.fill(T('forgot-email'), email); await anon.click(T('forgot-submit')); await anon.waitForSelector(T('forgot-sent'));
  const known = await anon.textContent(T('forgot-sent')); await anon.screenshot({ path: S + '/reset-02-noytral-melding.png' });
  const unk = await req(anon, 'post', '/auth/forgot', { email: 'nobody-' + Date.now() + '@example.com' }); expect(known.includes(unk.j.message) && unk.st === 200, 'neutral');
});
let link;
await step('no SMTP → draft; admin sees/copies link on Users page', async () => {
  const d = (await req(ad, 'get', '/users/reset-drafts')).j; const x = d.find((r) => r.to_addr === email); link = x?.link; expect(link && /\/reset\?token=/.test(link), 'draft link');
  await ad.setViewportSize({ width: 1300, height: 900 }); await ad.goto(BASE + '/#/users'); await ad.waitForSelector(T('reset-drafts')); await ad.locator(T('reset-drafts')).screenshot({ path: S + '/reset-03-admin-lenker.png' });
});
await step('reset page: set new password → sessions invalidated → old link dead', async () => {
  expect((await req(tu, 'get', '/auth/me')).j.user?.email === email, 'logged in before');
  const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); p.on('pageerror', (e) => errs.push(p.url() + ' ' + e.message));
  const path = new URL(link).pathname + new URL(link).search; await p.goto(BASE + path); await p.waitForSelector(T('reset-pw'));
  await p.fill(T('reset-pw'), 'short'); expect(await p.locator(T('reset-submit')).isDisabled(), '8+'); await p.fill(T('reset-pw'), pw1); await p.fill(T('reset-pw2'), pw1); await p.screenshot({ path: S + '/reset-04-nytt-passord.png' });
  await p.click(T('reset-submit')); await p.waitForSelector(T('reset-done')); await p.screenshot({ path: S + '/reset-05-ferdig.png' });
  expect(!(await req(tu, 'get', '/auth/me')).j.user, 'old session killed');
  expect((await req(tu, 'post', '/auth/login', { email, password: pw0 })).st === 401, 'old pw dead'); expect((await req(tu, 'post', '/auth/login', { email, password: pw1 })).st === 200, 'new pw works');
  const again = await req(tu, 'post', '/auth/reset', { token: new URL(link).searchParams.get('token'), password: 'Another-pass-789' }); expect(again.st === 400, 'single use');
  await p.goto(BASE + path); await p.waitForSelector(T('reset-invalid'));
});
await step('rate limit on forgot', async () => { let last; for (let k = 0; k < 4; k++) last = await req(tu, 'post', '/auth/forgot', { email }); expect(last.st === 429, 'got ' + last.st); });
await step('Min side: "Glemt passord?" → link → new password → login (then restored to demo password)', async () => {
  const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(p.url() + ' ' + e.message));
  await p.goto(BASE + '/minside'); await p.fill(T('portal-user'), '40000101'); await p.click(T('portal-forgot-link')); await p.click(T('portal-forgot-submit')); await p.waitForSelector(T('portal-forgot-sent')); await p.screenshot({ path: S + '/reset-06-minside-glemt.png' });
  const unk = await req(p, 'post', '/portal/forgot', { login: '49999999' }); expect((await p.textContent(T('portal-forgot-sent'))).includes(unk.j.message), 'neutral');
  const d = (await req(ad, 'get', '/users/reset-drafts')).j.find((r) => r.to_addr === 'kari.demo@example.com'); expect(d?.link, 'cust draft');
  const tok = new URL(d.link).searchParams.get('token'); await p.goto(BASE + '/reset?token=' + tok); await p.waitForSelector(T('reset-pw')); expect((await p.textContent(T('reset-page'))).includes('Velg nytt passord'), 'norsk');
  await p.fill(T('reset-pw'), 'Kari-ny-1234'); await p.fill(T('reset-pw2'), 'Kari-ny-1234'); await p.click(T('reset-submit')); await p.waitForSelector(T('reset-done'));
  expect((await req(p, 'post', '/portal/login', { login: '40000101', password: 'Kari-ny-1234' })).st === 200, 'cust new pw');
  await req(p, 'post', '/portal/forgot', { login: '40000101' });
  const d2 = (await req(ad, 'get', '/users/reset-drafts')).j.find((r) => r.to_addr === 'kari.demo@example.com'); await req(p, 'post', '/auth/reset', { token: new URL(d2.link).searchParams.get('token'), password: 'demo-kunde' });
  expect((await req(p, 'post', '/portal/login', { login: '40000101', password: 'demo-kunde' })).st === 200, 'restored');
});
await step('cleanup test user', async () => { expect((await req(ad, 'delete', '/users/' + uid, {})).st === 200, 'del'); });
await b.close(); if (errs.length) { fail++; console.log('❌ page errors', errs.join(' | ')); }
console.log(`\n${ok} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
