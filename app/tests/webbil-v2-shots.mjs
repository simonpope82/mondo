// v2 screenshots of /web-bil + /book?site=web-bil: node tests/webbil-v2-shots.mjs [baseUrl]
import { chromium, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:4321'; const S = process.env.SHOTS || '/workspace/web-bil/screenshots';
const b = await chromium.launch(); const errs = [];
async function sections(p, pre) {
  await p.goto(BASE + '/web-bil'); await p.waitForSelector('[data-testid="site-page"]'); await p.waitForTimeout(1400); await p.screenshot({ path: `${S}/v2-${pre}-01-hero.png` });
  for (const [id, n] of [['tjenester', '02-tjenester'], ['dekkhotell', '03-dekkhotell'], ['priser', '04-priser'], ['omtaler', '05-omtaler'], ['kontakt', '06-kontakt']]) {
    await p.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: 'instant', block: 'start' }), id); await p.waitForTimeout(1100); await p.screenshot({ path: `${S}/v2-${pre}-${n}.png` });
  }
  await p.evaluate(() => { const e = document.querySelector('.w2-page'); e.scrollTop = e.scrollHeight; }); await p.waitForTimeout(1000); await p.screenshot({ path: `${S}/v2-${pre}-07-bunn.png` });
  await p.click('[data-testid="bot-open"]'); await p.fill('[data-testid="bot-input"]', 'har dere dekkhotell?'); await p.press('[data-testid="bot-input"]', 'Enter'); await p.waitForTimeout(1300); await p.screenshot({ path: `${S}/v2-${pre}-08-chat.png` });
  await p.goto(BASE + '/book?site=web-bil'); await p.waitForSelector('[data-testid="bk-svc-hjulskift"]'); await p.click('[data-testid="bk-svc-hjulskift"]'); await p.click('[data-testid="bk-add-vask"]'); await p.waitForTimeout(400); await p.screenshot({ path: `${S}/v2-${pre}-09-booking-tjeneste.png` });
  await p.click('[data-testid="bk-next"]'); await p.fill('[data-testid="bk-reg"]', 'DM 10005'); await p.waitForTimeout(700); await p.screenshot({ path: `${S}/v2-${pre}-10-booking-regnr.png` }); await p.click('[data-testid="bk-next"]');
  await p.waitForSelector('.bk-time:not([disabled])'); await p.locator('.bk-time:not([disabled])').nth(2).click(); await p.waitForTimeout(300); await p.screenshot({ path: `${S}/v2-${pre}-11-booking-tid.png` }); await p.click('[data-testid="bk-next"]');
  await p.fill('[data-testid="bk-name"]', 'Demo Kunde'); await p.fill('[data-testid="bk-phone"]', '400 00 321'); await p.screenshot({ path: `${S}/v2-${pre}-12-booking-kontakt.png` }); await p.click('[data-testid="bk-submit"]'); await p.waitForSelector('[data-testid="bk-done"]'); await p.waitForTimeout(300); await p.screenshot({ path: `${S}/v2-${pre}-13-booking-bekreftet.png` });
}
const ph = await b.newContext({ ...devices['iPhone 13'] }); const p1 = await ph.newPage(); p1.on('pageerror', (e) => errs.push(e.message)); await sections(p1, 'mobil');
await p1.goto(BASE + '/web-bil'); await p1.waitForTimeout(800); await p1.click('.w2-burger'); await p1.waitForTimeout(500); await p1.screenshot({ path: `${S}/v2-mobil-14-meny.png` });
const dc = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p2 = await dc.newPage(); p2.on('pageerror', (e) => errs.push(e.message)); await sections(p2, 'desktop');
await b.close(); console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'shots ok');
