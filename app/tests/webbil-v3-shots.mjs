// v3 local screenshots: node tests/webbil-v3-shots.mjs [baseUrl]
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4321'; const S = process.env.SHOTS || '/workspace/web-bil/screenshots';
const b = await chromium.launch(); const errs = [];
for (const [pre, ctx] of [['mobil', devices['iPhone 13']], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
  const p = await (await b.newContext(ctx)).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/web-bil'); await p.waitForSelector('.w2-seal'); await p.waitForTimeout(1400); await p.screenshot({ path: `${S}/v3-${pre}-01-hero.png` });
  if ((await p.content()).toLowerCase().includes('kortreist')) errs.push('kortreist found');
  await p.evaluate(() => document.getElementById('lokalt').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/v3-${pre}-02-lokalt.png` });
  await p.evaluate(() => document.querySelector('.w2-radius').scrollIntoView({ behavior: 'instant', block: 'center' })); await p.waitForTimeout(900); await p.screenshot({ path: `${S}/v3-${pre}-03-lokalt-steder.png` });
}
await b.close(); console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'shots ok');
