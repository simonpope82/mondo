import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:4321/#/home';
const out = process.argv[3] || '/tmp/s.png';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(url); await p.waitForTimeout(1500);
if (process.argv[4]) await p.click(process.argv[4]).catch(e=>errs.push('click '+e.message)), await p.waitForTimeout(800);
await p.screenshot({ path: out }); console.log('errors:', errs); await b.close();
