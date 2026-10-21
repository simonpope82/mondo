// 🛞 Dekkhotell extras: tyre-set QR labels (staff-only scan), customer portal (own login, own data only),
// daily staff overview (+ optional morning push), computed customer columns (Livstidsverdi, Bør bestille nye dekk).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const LABELS = require('./labels');
const J = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };
const parseCookies = (h) => Object.fromEntries(String(h || '').split(';').map((x) => x.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const CCOOKIE = 'mondo_kunde';
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

module.exports.setup = function setup(db, h) {
  const { now, notify, getBoard, itemRow, log, touch, B, C, label, labelName, items, setVals, settings, saveSettings, osloNow, addDays, nbDate, ASSETS, baseUrl, payToken, outbox } = h;
  db.exec(`create table if not exists cust_users(id text primary key, customer_id text unique, login text unique collate nocase, pass_hash text, created text, last_login text);
    create table if not exists cust_sessions(token text primary key, cust_user_id text, expires integer)`);
  const rules = () => ({ winter_mm: 4, summer_mm: 3, margin_mm: 1, max_age: 6, warn_age: 5, ...(settings().tyre_rules || {}) });
  const get = (id) => { const r = db.prepare('select * from items where id=?').get(id); return r ? itemRow(r) : null; };
  const has = (arr, id) => Array.isArray(arr) && arr.includes(id);

  // ---------- columns on Kunder (added once, then normal editable columns) ----------
  function ensureCols(b, defs) {
    let cols = b.columns; let changed = false;
    for (const [title, type, settingsObj] of defs) if (!cols.some((c) => c.title === title)) { cols = [...cols, { id: 'c_' + crypto.randomBytes(4).toString('hex'), type, title, settings: settingsObj || {} }]; changed = true; }
    if (changed) db.prepare('update boards set columns=? where id=?').run(JSON.stringify(cols), b.id);
    return changed ? getBoard(b.id) : b;
  }
  const L = (spec) => [...spec.map(([l, c]) => ({ id: 'l_' + crypto.randomBytes(3).toString('hex'), label: l, color: c })), { id: 'l_' + crypto.randomBytes(3).toString('hex'), label: '', color: '#c4c4c4' }];

  // tyre-set analysis
  function setInfo(lb, it) {
    const g = (t) => it.vals[C(lb, 'lager', t)?.id];
    const depths = ['Mønster VF (mm)', 'Mønster HF (mm)', 'Mønster VB (mm)', 'Mønster HB (mm)'].map((t) => +g(t)).filter((x) => x > 0);
    const season = labelName(C(lb, 'lager', 'Sesong'), g('Sesong')); const status = labelName(C(lb, 'lager', 'Lagerstatus'), g('Lagerstatus'));
    const dot = String(g('DOT / år') || ''); const yy = /^\d{4}$/.test(dot) ? 2000 + +dot.slice(2) : /^\d{2}$/.test(dot) ? 2000 + +dot : null;
    const age = yy ? new Date().getFullYear() - yy : null; const min = depths.length ? Math.min(...depths) : null;
    const r = rules(); const thr = /sommer/i.test(season) ? r.summer_mm : r.winter_mm;
    let level = 'OK'; const why = [];
    if (status === 'Skal kastes') { level = 'Ja'; why.push('kassert'); }
    if (min != null && min < thr) { level = 'Ja'; why.push(`${String(min).replace('.', ',')} mm (< ${thr} mm)`); } else if (min != null && min < thr + r.margin_mm) { if (level !== 'Ja') level = 'Snart'; why.push(`${String(min).replace('.', ',')} mm (nær ${thr} mm)`); }
    if (age != null && age >= r.max_age) { level = 'Ja'; why.push(`${age} år gamle (DOT ${dot})`); } else if (age != null && age >= r.warn_age) { if (level !== 'Ja') level = 'Snart'; why.push(`${age} år gamle`); }
    return { id: it.id, name: it.name, code: g('Hjulsett-ID') || null, location: g('Lagerplass') || '', season, status, dim: g('Dimensjon') || '', brand: g('Dekkmerke') || '', dot, age, depths, min, condition: labelName(C(lb, 'lager', 'Tilstand'), g('Tilstand')), level, why, kunde: g('Kunde') || [], bil: g('Kjøretøy') || [] };
  }

  // ---------- computed customer columns ----------
  let lastRun = 0;
  function recompute(force) {
    if (!force && Date.now() - lastRun < 3000) return; lastRun = Date.now();
    let kb = B('kunder'); const fb = B('faktura'), bb = B('bookinger'), lb = B('lager'); if (!kb || !fb || !lb) return;
    kb = ensureCols(kb, [['Livstidsverdi', 'numbers', { unit: 'kr' }], ['Bør bestille nye dekk', 'status', { labels: L([['Ja – bestill nå', '#df2f4a'], ['Snart', '#fdab3d'], ['OK', '#00c875']]) }], ['Dekk-anbefaling', 'text']]);
    const cV = kb.columns.find((c) => c.title === 'Livstidsverdi'), cR = kb.columns.find((c) => c.title === 'Bør bestille nye dekk'), cT = kb.columns.find((c) => c.title === 'Dekk-anbefaling');
    const lbl = { Ja: cR.settings.labels.find((l) => /^Ja/.test(l.label))?.id, Snart: cR.settings.labels.find((l) => l.label === 'Snart')?.id, OK: cR.settings.labels.find((l) => l.label === 'OK')?.id };
    const inv = items(fb); const cK = C(fb, 'faktura', 'Kunde'), cS = C(fb, 'faktura', 'Status'), cTot = C(fb, 'faktura', 'Totalt'), cBk = C(fb, 'faktura', 'Booking'); const paidL = label(cS, 'Betalt');
    const invoicedBookings = new Set(inv.flatMap((i) => i.vals[cBk.id] || []));
    const bks = bb ? items(bb) : []; const bP = C(bb, 'bookinger', 'Betaling'), bK = C(bb, 'bookinger', 'Kunde'), bPr = C(bb, 'bookinger', 'Pris');
    const paidB = new Set(['Betalt Vipps', 'Betalt kort', 'Betalt'].map((n) => label(bP, n)));
    const sets = items(lb).map((it) => setInfo(lb, it));
    for (const k of items(kb)) {
      const ltv = Math.round((inv.filter((i) => has(i.vals[cK.id], k.id) && i.vals[cS.id] === paidL).reduce((a, i) => a + (+i.vals[cTot.id] || 0), 0) + bks.filter((x) => has(x.vals[bK.id], k.id) && paidB.has(x.vals[bP.id]) && !invoicedBookings.has(x.id)).reduce((a, x) => a + (+x.vals[bPr.id] || 0), 0)) * 100) / 100;
      const mine = sets.filter((s) => has(s.kunde, k.id) && s.status !== 'Utlevert til kunde');
      const worst = mine.find((s) => s.level === 'Ja') || mine.find((s) => s.level === 'Snart') || null;
      const level = mine.length ? (worst ? worst.level : 'OK') : null;
      const reason = mine.filter((s) => s.level !== 'OK').map((s) => `${s.season}${s.dim ? ' ' + s.dim : ''}: ${s.why.join(', ')}`).join(' · ') || (mine.length ? 'Dekkene er OK' : '');
      const patch = {}; if (k.vals[cV.id] !== ltv) patch[cV.id] = ltv; const lv = level ? lbl[level] : null; if ((k.vals[cR.id] || null) !== lv) patch[cR.id] = lv; if ((k.vals[cT.id] || '') !== reason) patch[cT.id] = reason;
      if (Object.keys(patch).length) db.prepare('update items set vals=? where id=?').run(JSON.stringify({ ...k.vals, ...patch }), k.id);
    }
  }

  // ---------- tyre-set QR labels ----------
  const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function ensureCode(lb, it) {
    const cc = C(lb, 'lager', 'Hjulsett-ID'); let code = it.vals[cc.id];
    if (code && db.prepare("select 1 from assets where replace(code,'-','')=?").get(norm(code))) return code;
    const s = setInfo(lb, it); const a = ASSETS.createAsset({ data: { asset_type: 'Hjulsett', model: `${s.brand} ${s.dim}`.trim(), group: 'Dekkhotell', status: 'På lager', home_location: 'Dekkhotell ' + s.location } }, { text: 'Hjulsett-etikett laget' });
    setVals(it.id, { [cc.id]: a.code }); log(lb.id, it.id, '🏷️ QR-etikett laget: ' + a.code); return a.code;
  }
  function setByCode(code) { const lb = B('lager'); if (!lb) return null; const cc = C(lb, 'lager', 'Hjulsett-ID'); const it = items(lb).find((i) => norm(i.vals[cc.id]) === norm(code)); return it ? { lb, it } : null; }
  function customerCard(id) {
    const kb = B('kunder'); const k = id && get(id); if (!k) return null; const g = (t) => k.vals[C(kb, 'kunder', t)?.id];
    const adr = g('Adresse'); return { id: k.id, name: k.name, phone: g('Mobil') || '', email: g('E-post') || '', nr: g('Kundenr') || '', address: (adr && (adr.address || adr)) || '', type: labelName(C(kb, 'kunder', 'Kundetype'), g('Kundetype')), ltv: k.vals[kb.columns.find((c) => c.title === 'Livstidsverdi')?.id] || 0, board_id: kb.id };
  }
  function vehicleCard(id) { const vb = B('kjoretoy'); const v = id && get(id); if (!v) return null; const g = (t) => v.vals[C(vb, 'kjoretoy', t)?.id]; return { id: v.id, regnr: g('Regnr') || v.name, make: g('Merke') || '', model: g('Modell') || '', year: g('Årsmodell') || '', board_id: vb.id }; }

  // ---------- daily overview ----------
  function daily(date) {
    const bb = B('bookinger'), lb = B('lager'); if (!bb) return [];
    const g = (it, t) => it.vals[C(bb, 'bookinger', t)?.id]; const off = ['Ikke møtt', 'Avlyst'];
    const sets = lb ? items(lb).map((it) => setInfo(lb, it)) : [];
    const fetchedCol = bb.columns.find((c) => c.title === 'Hjul hentet frem');
    return items(bb).filter((it) => g(it, 'Dato') === date && !off.includes(labelName(C(bb, 'bookinger', 'Status'), g(it, 'Status')))).sort((a, b) => String(g(a, 'Tid')).localeCompare(String(g(b, 'Tid')))).map((it) => {
      const kid = (g(it, 'Kunde') || [])[0], vid = (g(it, 'Kjøretøy') || [])[0];
      const mine = sets.filter((s) => s.status === 'På lager' && ((vid && has(s.bil, vid)) || (!s.bil.length && kid && has(s.kunde, kid))));
      return { id: it.id, board_id: bb.id, name: it.name, time: g(it, 'Tid') || '', service: labelName(C(bb, 'bookinger', 'Tjeneste'), g(it, 'Tjeneste')), addons: g(it, 'Tillegg') || '', regnr: g(it, 'Regnr') || '', phone: g(it, 'Mobil') || '', lift: labelName(C(bb, 'bookinger', 'Løft'), g(it, 'Løft')), status: labelName(C(bb, 'bookinger', 'Status'), g(it, 'Status')), customer: kid ? get(kid)?.name : null,
        sets: mine.map((s) => ({ id: s.id, location: s.location, season: s.season, dim: s.dim, code: s.code, level: s.level, why: s.why })), fetched: !!(fetchedCol && it.vals[fetchedCol.id]) };
    });
  }
  function morningPush() {
    const d = settings().daily || { push: true, hour: 7 }; if (!d.push) return; const n = osloNow(); if (n.min < (+d.hour || 7) * 60) return;
    if (db.prepare("select value from meta where key='dk_daily_push'").get()?.value === n.date) return;
    db.prepare("insert into meta values('dk_daily_push', ?) on conflict(key) do update set value=excluded.value").run(n.date);
    const list = daily(n.date); if (!list.length) return;
    const fetch = list.flatMap((x) => x.sets.map((s) => s.location)).filter(Boolean);
    const text = `🗓️ I dag: ${list.length} kunder. Første kl ${list[0].time}.${fetch.length ? ' Hent frem: ' + fetch.slice(0, 8).join(', ') : ''}`;
    const staff = db.prepare("select distinct person_id from users where person_id is not null").all().map((r) => r.person_id);
    (staff.length ? staff : ['p_simon']).forEach((p) => notify(p, text, null, null, '/#/dekk/dagen'));
  }
  setInterval(() => { try { morningPush(); recompute(true); } catch (e) { console.error('dekk timer', e.message); } }, 10 * 60000).unref();

  // ---------- customer portal auth ----------
  function custUser(req) {
    const tok = parseCookies(req.headers.cookie)[CCOOKIE]; if (!tok) return null;
    const s = db.prepare('select * from cust_sessions where token=?').get(hash(tok)); if (!s || s.expires < Date.now()) return null;
    return db.prepare('select id, customer_id, login from cust_users where id=?').get(s.cust_user_id) || null;
  }
  const setC = (req, res, v, age) => { const p = [`${CCOOKIE}=${v}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${age}`]; if (req.secure || process.env.COOKIE_SECURE === '1') p.push('Secure'); res.setHeader('Set-Cookie', p.join('; ')); };
  const normLogin = (s) => { s = String(s || '').trim().toLowerCase(); return s.includes('@') ? s : s.replace(/\D/g, '').slice(-8); };

  function routes(app, { aw, adminOnly, limit }) {
    const err = (m, st) => Object.assign(new Error(m), { status: st });
    // tyre set page (staff)
    app.get('/api/dekk/tyreset/:code', aw((req) => {
      const f = setByCode(req.params.code); if (!f) throw err('Ukjent hjulsett', 404);
      const s = setInfo(f.lb, f.it); const bb = B('bookinger'); const today = osloNow().date; const vid = s.bil[0], kid = s.kunde[0];
      const next = bb ? items(bb).filter((x) => (has(x.vals[C(bb, 'bookinger', 'Kjøretøy').id], vid) || has(x.vals[C(bb, 'bookinger', 'Kunde').id], kid)) && (x.vals[C(bb, 'bookinger', 'Dato').id] || '') >= today).map((x) => ({ id: x.id, date: x.vals[C(bb, 'bookinger', 'Dato').id], time: x.vals[C(bb, 'bookinger', 'Tid').id], service: labelName(C(bb, 'bookinger', 'Tjeneste'), x.vals[C(bb, 'bookinger', 'Tjeneste').id]) })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) : [];
      recompute(); return { set: { ...s, board_id: f.lb.id }, customer: customerCard(kid), vehicle: vehicleCard(vid), next, rules: rules() };
    }));
    app.post('/api/dekk/tyreset-item/:id/label', aw((req) => { const lb = B('lager'); const it = get(req.params.id); if (!it || it.board_id !== lb.id) throw err('not found', 404); return { code: ensureCode(lb, it) }; }));
    app.get('/api/dekk/tyreset-labels.pdf', aw((req, res) => {
      const lb = B('lager'); const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 200); const names = {}; const codes = [];
      for (const id of ids) { const it = get(id); if (!it || it.board_id !== lb.id) continue; const code = ensureCode(lb, get(id)); const s = setInfo(lb, get(id)); const k = s.kunde[0] && get(s.kunde[0]); const v = s.bil[0] && get(s.bil[0]);
        const c = norm(code); codes.push(c); names[c] = { asset_type: [k?.name, v?.name].filter(Boolean).join(' · '), model: [s.location && 'Plass ' + s.location, s.season, s.dim].filter(Boolean).join(' · ') }; }
      if (!codes.length) throw err('Ingen hjulsett', 400);
      LABELS.pdf(res, { codes, base: baseUrl(req), template: String(req.query.template || 'roll62x29'), header: settings().company.name, showName: true, names });
    }));
    // daily overview
    app.get('/api/dekk/daily', aw(() => { const n = osloNow(); return { days: [0, 1].map((k) => { const d = addDays(n.date, k); return { date: d, text: nbDate(d), label: k ? 'I morgen' : 'I dag', list: daily(d) }; }), daily: settings().daily || { push: true, hour: 7 } }; }));
    app.post('/api/dekk/daily/:id/fetched', aw((req) => { let bb = B('bookinger'); bb = ensureCols(bb, [['Hjul hentet frem', 'checkbox']]); const it = get(req.params.id); if (!it || it.board_id !== bb.id) throw err('not found', 404);
      const c = bb.columns.find((x) => x.title === 'Hjul hentet frem'); setVals(it.id, { [c.id]: !!req.body?.on }); log(bb.id, it.id, req.body?.on ? '🛞 Hjul hentet frem' : '🛞 Hentet frem – angret'); touch(bb.id); return { ok: true }; }));
    app.put('/api/dekk/extra-settings', aw((req) => { adminOnly(req); const s = settings(); const b = req.body || {};
      if (b.tyre_rules) s.tyre_rules = Object.fromEntries(Object.entries({ ...rules(), ...b.tyre_rules }).map(([k, v]) => [k, Math.max(0, +v || 0)]));
      if (b.daily) s.daily = { push: !!b.daily.push, hour: Math.max(0, Math.min(23, +b.daily.hour || 7)) };
      saveSettings(s); recompute(true); return { tyre_rules: rules(), daily: s.daily }; }));
    app.get('/api/dekk/extra-settings', aw(() => ({ tyre_rules: rules(), daily: settings().daily || { push: true, hour: 7 } })));
    // customer logins (made by staff)
    app.post('/api/dekk/portal/invite', aw((req) => {
      adminOnly(req); const c = customerCard(req.body?.customer_id); if (!c) throw err('Ukjent kunde', 404);
      const login = normLogin(c.phone) || normLogin(c.email); if (!login || (login.length < 8 && !login.includes('@'))) throw err('Kunden mangler mobil/e-post', 400);
      const pw = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8);
      const ex = db.prepare('select id from cust_users where customer_id=?').get(c.id);
      if (ex) db.prepare('update cust_users set login=?, pass_hash=? where id=?').run(login, bcrypt.hashSync(pw, 10), ex.id); else db.prepare('insert into cust_users values(?,?,?,?,?,?)').run('cu_' + crypto.randomBytes(5).toString('hex'), c.id, login, bcrypt.hashSync(pw, 10), now(), null);
      db.prepare('delete from cust_sessions where cust_user_id in (select id from cust_users where customer_id=?)').run(c.id);
      const url = baseUrl(req) + '/minside';
      outbox({ kind: 'sms', to: c.phone, body: `Hei ${c.name.split(' ')[0]}! Din side hos ${settings().company.name}: ${url}\nBrukernavn: ${login}\nPassord: ${pw}` });
      return { ok: true, login, password: pw, url, note: 'Passordet vises bare nå. SMS-utkast ligger i Utboks (ikke sendt).' };
    }));
    app.get('/api/dekk/portal/users', aw(() => ({ users: db.prepare('select customer_id, login, created, last_login from cust_users').all() })));
    // customer portal (separate cookie, own data only – never staff data)
    app.post('/api/portal/login', aw(async (req, res) => {
      limit(req, 20); const login = normLogin(req.body?.login); const u = db.prepare('select * from cust_users where login=?').get(login);
      if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.pass_hash)) { await new Promise((r) => setTimeout(r, 400)); throw err('Feil brukernavn eller passord', 401); }
      const tok = crypto.randomBytes(24).toString('base64url'); db.prepare('insert into cust_sessions values(?,?,?)').run(hash(tok), u.id, Date.now() + 30 * 864e5); db.prepare('update cust_users set last_login=? where id=?').run(now(), u.id);
      setC(req, res, tok, 30 * 86400); return { ok: true };
    }));
    app.post('/api/portal/logout', aw((req, res) => { const tok = parseCookies(req.headers.cookie)[CCOOKIE]; if (tok) db.prepare('delete from cust_sessions where token=?').run(hash(tok)); setC(req, res, '', 0); return { ok: true }; }));
    app.get('/api/portal/me', aw((req) => {
      const u = custUser(req); if (!u) throw err('login needed', 401);
      const k = get(u.customer_id); if (!k) throw err('login needed', 401);
      const kb = B('kunder'), bb = B('bookinger'), lb = B('lager'), fb = B('faktura'); const s = settings();
      const bookings = bb ? items(bb).filter((x) => has(x.vals[C(bb, 'bookinger', 'Kunde').id], k.id)).map((x) => { const g = (t) => x.vals[C(bb, 'bookinger', t)?.id]; return { date: g('Dato'), time: g('Tid'), service: labelName(C(bb, 'bookinger', 'Tjeneste'), g('Tjeneste')), addons: x.vals[bb.columns.find((c) => c.title === 'Tillegg')?.id] || '', regnr: g('Regnr') || '', status: labelName(C(bb, 'bookinger', 'Status'), g('Status')), price: g('Pris') || 0, ref: g('Bookingref') || '' }; }).sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
      const tyres = lb ? items(lb).map((it) => setInfo(lb, it)).filter((x) => has(x.kunde, k.id)).map(({ season, status, dim, brand, depths, min, condition, level, why, dot }) => ({ season, status, dim, brand, depths, min, condition, level, why, dot })) : [];
      const invoices = fb ? items(fb).filter((x) => has(x.vals[C(fb, 'faktura', 'Kunde').id], k.id)).map((x) => { const g = (t) => x.vals[C(fb, 'faktura', t)?.id]; return { no: g('Fakturanr'), total: g('Totalt'), due: g('Forfallsdato'), status: labelName(C(fb, 'faktura', 'Status'), g('Status')), pay_url: '/#/betal/' + payToken(x.id) }; }) : [];
      const vb = B('kjoretoy'); const vehicles = vb ? items(vb).filter((v) => has(v.vals[C(vb, 'kjoretoy', 'Eier').id], k.id)).map((v) => ({ regnr: v.vals[C(vb, 'kjoretoy', 'Regnr').id] || v.name, make: v.vals[C(vb, 'kjoretoy', 'Merke').id] || '', model: v.vals[C(vb, 'kjoretoy', 'Modell').id] || '' })) : [];
      void kb; return { name: k.name, company: s.company.name, bookings, tyres, invoices, vehicles };
    }));
  }
  return { routes, recompute, setInfo, isKunder: (id) => settings().boards?.kunder === id };
};
