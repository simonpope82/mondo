// Assets module (GoCodes-style): QR-coded assets, scans with GPS, check in/out, tasks, documents, finder messages, labels PDF, reports.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALPH = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I – easy to read off a sticker
const fmtCode = (s) => s.slice(0, 4) + '-' + s.slice(4, 8);
const normCode = (raw) => { const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length >= 8 ? fmtCode(s.slice(-8)) : null; }; // works for our URLs, gkd.bz/<ID> and typed codes
const randCode = () => fmtCode(Array.from(crypto.randomBytes(8), (b) => ALPH[b % 32]).join(''));

// Built-in fields as in GoCodes (key, label, type, default on). "always" fields can't be switched off.
const BUILTIN = [
  ['asset_type', 'Asset type', 'dropdown', 1], ['other_id', 'Other Asset ID', 'text', 1], ['sub_type', 'Sub type', 'dropdown', 0], ['group', 'Group', 'dropdown', 1],
  ['serial', 'Serial number', 'text', 1], ['model', 'Model', 'dropdown', 1], ['reward', 'Reward', 'text', 1], ['description', 'Description', 'text', 1],
  ['date_purchased', 'Date purchased', 'date', 1], ['original_cost', 'Original cost', 'number', 1], ['salvage_value', 'Salvage value', 'number', 1], ['asset_life', 'Asset life (years)', 'number', 1],
  ['warranty', 'Warranty terms', 'text', 0], ['last_filter_changed', 'Last filter changed', 'date', 1], ['last_service_notes', 'Last service notes', 'text', 1], ['next_filter_change', 'Next filter change', 'date', 1],
  ['home_location', 'Home location', 'text', 1, true], ['status', 'Status', 'dropdown', 1], ['quantity', 'Quantity', 'number', 0], ['min_quantity', 'Minimum quantity', 'number', 0],
  ['documentation', 'Documentation', 'url', 1, true],
];
const OPTS = {
  asset_type: ['Kaffemaskin', 'Kvern', 'Vannfilter', 'Kjøleskap', 'Melkekjøler', 'Verktøy', 'PC / nettbrett', 'Annet'],
  group: ['Kaffeknappen', 'Magnat', 'Lager', 'Utleie'],
  sub_type: ['2-grupps', '1-grupps', 'Automat', 'Filter'],
  model: ['Demo Espresso 2G', 'Demo Super-auto S', 'Demo Kvern 64', 'Demo Filter XL', 'Demo Kjøler 5L'],
  status: ['I drift', 'Hos kunde', 'På lager', 'Til service', 'Savnet', 'Utrangert'],
};
const CUSTOM = [ // Simon's custom fields (names from his GoCodes account; options are made-up placeholders)
  ['c_co2', 'Co2', 'dropdown', ['Ja', 'Nei']], ['c_adresse', 'Adresse', 'text'], ['c_etg', 'Etg', 'dropdown', ['U1', '1', '2', '3', '4', '5+']], ['c_plassering', 'Plassering', 'text'],
  ['c_aquastop', 'Aquastop levert av KK', 'dropdown', ['Ja', 'Nei', 'Ukjent']], ['c_grut', 'Grutgjennomføring', 'dropdown', ['Ja', 'Nei']], ['c_fresk', 'Fresk melk', 'dropdown', ['Ja', 'Nei']],
  ['c_avdeling', 'Avdeling', 'dropdown', ['Kaffeknappen', 'Magnat', 'Service']], ['c_filter', 'Filter', 'dropdown', ['Demo Filter S', 'Demo Filter M', 'Demo Filter XL', 'Ingen']], ['c_kontakt', 'Kontakt person og Nr', 'text'],
];
const defaultSettings = () => ({
  org: 'Kaffeknappen (demo)',
  fields: BUILTIN.map(([key, label, type, on, always]) => ({ key, label, type, on: !!on, always: !!always, options: OPTS[key] })),
  custom: CUSTOM.map(([key, label, type, options]) => ({ key, label, type, options })),
  public_fields: ['asset_type', 'model', 'serial', 'reward', 'description'],
  alerts: { email: '', alt_emails: '', phone: '', timezone: 'Europe/Oslo', inventory: false, low_inventory: false, overdue: true, service: true, doc_public: false },
});

// ---- depreciation (per fiscal year, calendar years) ----
function depreciation(a, method, year = new Date().getFullYear()) {
  const d = a.data || {}; const cost = +d.original_cost || 0; const salv = +d.salvage_value || 0; const life = +d.asset_life || 0; const start = d.date_purchased;
  if (!cost || !life || !start) return null;
  const y0 = +start.slice(0, 4); const base = Math.max(0, cost - salv);
  const sched = []; // depreciation per calendar year from y0
  if (method === 'SL monthly') {
    const m0 = +start.slice(5, 7); const per = base / (life * 12); let left = life * 12; let y = y0; let m = m0;
    while (left > 0) { const n = Math.min(left, 13 - m); sched.push(per * n); left -= n; y++; m = 1; }
  } else if (method === 'SL half-year') {
    const full = base / life; sched.push(full / 2); for (let k = 1; k < life; k++) sched.push(full); sched.push(full / 2);
  } else { // DB150 / DB200, half-year first year, switch to straight line when better
    const f = method === 'DB200' ? 2 : 1.5; let book = cost; const rate = f / life;
    for (let k = 0; k <= life && book > salv + 0.005; k++) {
      const yrsLeft = life - k + (k === 0 ? 0 : 0.5);
      let db = book * rate * (k === 0 ? 0.5 : 1); const sl = (book - salv) / Math.max(yrsLeft, 0.5);
      let dep = Math.max(db, k === 0 ? 0 : sl); dep = Math.min(dep, book - salv); sched.push(dep); book -= dep;
    }
  }
  const idx = year - y0; const sum = (n) => sched.slice(0, Math.max(0, n)).reduce((s, x) => s + x, 0);
  const thisYear = idx >= 0 && idx < sched.length ? sched[idx] : 0; const acc = sum(idx + 1);
  return { method, year, cost, salvage: salv, life, thisYear: Math.round(thisYear), accumulated: Math.round(Math.min(acc, base)), book: Math.round(cost - Math.min(acc, base)) };
}
const currentValue = (a) => depreciation(a, 'SL monthly')?.book ?? null;
const endOfLife = (a) => { const d = a.data || {}; if (!d.date_purchased || !+d.asset_life) return null; const t = new Date(d.date_purchased + 'T12:00:00'); t.setMonth(t.getMonth() + Math.round(+d.asset_life * 12)); return t.toISOString().slice(0, 10); };

function setup(db, h) {
  const { me, meName, now, notify, insertItem, getBoard, DATA_DIR, auth } = h;
  db.exec(`
  create table if not exists assets(id text primary key, code text unique, legacy_code text, data text default '{}', photo text, assigned_to text, assigned_person text, checked_out integer default 0, checked_out_at text, return_date text,
    last_lat real, last_lng real, last_acc real, last_seen text, last_by text, active integer default 1, created text, updated text, updated_by text);
  create table if not exists qr_codes(code text primary key, asset_id text, batch text, created text);
  create table if not exists asset_events(id integer primary key autoincrement, asset_id text, code text, type text, who text, who_name text, lat real, lng real, acc real, text text, data text, created text);
  create table if not exists asset_tasks(id text primary key, asset_id text, title text, priority text, assignee text, due text, done integer default 0, created text);
  create table if not exists asset_docs(id text primary key, asset_id text, name text, file text, mime text, url text, created text, who text);
  create table if not exists asset_messages(id text primary key, asset_id text, code text, dir text, name text, email text, phone text, text text, lat real, lng real, created text, read integer default 0);
  create table if not exists meta(key text primary key, value text);
  `);
  const UP = path.join(DATA_DIR, 'uploads'); fs.mkdirSync(UP, { recursive: true });
  const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
  const settings = () => { const s = J(db.prepare("select value from meta where key='asset_settings'").get()?.value, null); return s || defaultSettings(); };
  const saveSettings = (s) => db.prepare("insert into meta values('asset_settings',?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(s));
  const row = (a) => a && ({ ...a, data: J(a.data, {}), checked_out: !!a.checked_out, active: !!a.active });
  const enrich = (a) => a && { ...a, current_value: currentValue(a), end_of_life: endOfLife(a) };
  const getA = (id) => enrich(row(db.prepare('select * from assets where id=?').get(id)));
  const byCode = (code) => { const c = normCode(code); if (!c) return null; return row(db.prepare('select * from assets where code=? or legacy_code=?').get(c, c)); };
  const ev = (a, type, text, p = {}, data) => db.prepare('insert into asset_events(asset_id,code,type,who,who_name,lat,lng,acc,text,data,created) values(?,?,?,?,?,?,?,?,?,?,?)')
    .run(a.id, a.code, type, p.who === undefined ? me() : p.who, p.whoName || meName(), num(p.lat), num(p.lng), num(p.acc), text || '', data ? JSON.stringify(data) : null, now());
  const num = (x) => (x === '' || x == null || !Number.isFinite(+x) ? null : +x);
  const gps = (a, p, by) => { if (num(p.lat) == null || num(p.lng) == null) return; db.prepare('update assets set last_lat=?, last_lng=?, last_acc=?, last_seen=?, last_by=? where id=?').run(+p.lat, +p.lng, num(p.acc), now(), by, a.id); };
  const allFields = () => { const s = settings(); return [...s.fields, ...s.custom]; };
  const label = (k) => allFields().find((f) => f.key === k)?.label || k;
  const baseUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const isAdmin = (req) => req.user?.role === 'admin';
  const admins = () => db.prepare("select person_id from users where role='admin'").all().map((r) => r.person_id).filter(Boolean);
  const newId = () => 'a_' + crypto.randomBytes(5).toString('hex');
  const freeCode = () => { for (;;) { const c = randCode(); if (!db.prepare('select 1 from qr_codes where code=?').get(c) && !db.prepare('select 1 from assets where code=? or legacy_code=?').get(c, c)) return c; } };

  function createAsset({ code, data = {}, legacy_code, photo }, p = {}) {
    code = normCode(code) || freeCode();
    if (db.prepare('select 1 from assets where code=?').get(code)) throw new Error('Code already used: ' + code);
    const id = newId();
    db.prepare('insert into assets(id,code,legacy_code,data,photo,created,updated,updated_by) values(?,?,?,?,?,?,?,?)').run(id, code, normCode(legacy_code), JSON.stringify(data), photo || null, p.at || now(), p.at || now(), me());
    db.prepare('insert into qr_codes(code,asset_id,batch,created) values(?,?,?,?) on conflict(code) do update set asset_id=excluded.asset_id').run(code, id, 'asset', now());
    const a = getA(id); ev(a, 'create', p.text || 'Asset created', p); return a;
  }
  function patchAsset(a, body) {
    const data = { ...a.data }; const changes = [];
    for (const [k, v] of Object.entries(body.data || {})) { if ((data[k] ?? '') === (v ?? '')) continue; changes.push(`${label(k)}: ${data[k] || '—'} → ${v || '—'}`); if (v === null || v === '') delete data[k]; else data[k] = v; }
    let legacy = a.legacy_code; if ('legacy_code' in body) { const n = body.legacy_code ? normCode(body.legacy_code) : null; if (n !== legacy) { changes.push(`GoCodes ID: ${legacy || '—'} → ${n || '—'}`); legacy = n; } }
    if (!changes.length) return a;
    db.prepare('update assets set data=?, legacy_code=?, updated=?, updated_by=? where id=?').run(JSON.stringify(data), legacy, now(), me(), a.id);
    ev(a, 'edit', changes.join('; '), body.gps || {}); return getA(a.id);
  }
  function detail(a, req) {
    const codes = [a.code, a.legacy_code].filter(Boolean);
    const jobs = []; // board items that mention this code (like the "Gocodes" column on Feilmeldinger)
    for (const c of codes) for (const it of db.prepare('select i.id, i.board_id, i.name, i.updated, b.name board, b.icon from items i join boards b on b.id=i.board_id where i.vals like ?').all('%' + c + '%')) if (!jobs.some((j) => j.id === it.id)) jobs.push(it);
    return {
      asset: a, scan_url: baseUrl(req) + '/s/' + a.code,
      events: db.prepare('select * from asset_events where asset_id=? order by id desc limit 300').all(a.id),
      tasks: db.prepare('select * from asset_tasks where asset_id=? order by done, due is null, due').all(a.id),
      docs: db.prepare('select id,name,mime,url,created,who from asset_docs where asset_id=? order by created desc').all(a.id),
      messages: db.prepare('select * from asset_messages where asset_id=? order by created desc').all(a.id),
      jobs: jobs.slice(0, 50), depreciation: ['SL half-year', 'SL monthly', 'DB150', 'DB200'].map((m) => depreciation(a, m)).filter(Boolean),
    };
  }
  const listAll = () => db.prepare('select * from assets where active=1 order by created desc').all().map(row).map(enrich).map((a) => ({ ...a, last_message: db.prepare("select name,email,phone,text,created from asset_messages where asset_id=? and dir='in' order by created desc limit 1").get(a.id) || null, docs: db.prepare('select count(*) n from asset_docs where asset_id=?').get(a.id).n }));

  function checkout(a, b) {
    const to = String(b.to || '').trim(); if (!to) throw new Error('Who or where?');
    const transfer = a.checked_out;
    db.prepare('update assets set assigned_to=?, assigned_person=?, checked_out=1, checked_out_at=?, return_date=?, updated=?, updated_by=? where id=?').run(to, b.person || null, transfer ? a.checked_out_at : now(), b.return_date || null, now(), me(), a.id);
    ev(a, transfer ? 'transfer' : 'checkout', `${transfer ? 'Transferred' : 'Checked out'} to ${to}${b.return_date ? ' · return ' + b.return_date : ''}${b.note ? ' · ' + b.note : ''}`, b, { to, kind: b.kind || 'person', return_date: b.return_date || null });
    gps(a, b, meName()); return getA(a.id);
  }
  function checkin(a, b) {
    if (!a.checked_out) throw new Error('Not checked out');
    const days = Math.max(0, (Date.now() - new Date(a.checked_out_at)) / 86400000);
    db.prepare('update assets set assigned_to=null, assigned_person=null, checked_out=0, checked_out_at=null, return_date=null, updated=?, updated_by=? where id=?').run(now(), me(), a.id);
    ev(a, 'checkin', `Checked in from ${a.assigned_to} after ${days < 1 ? Math.round(days * 24) + ' h' : days.toFixed(1) + ' days'}${b.note ? ' · ' + b.note : ''}`, b, { from: a.assigned_to, days });
    gps(a, b, meName()); return getA(a.id);
  }
  function saveFile(dataUrl, max = 6e6) {
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || '')); if (!m) throw new Error('bad file');
    const buf = Buffer.from(m[2], 'base64'); if (buf.length > max) throw new Error('File too big (max ' + Math.round(max / 1e6) + ' MB)');
    const f = crypto.randomBytes(8).toString('hex'); fs.writeFileSync(path.join(UP, f), buf); return { file: f, mime: m[1] };
  }

  // public-message rate limit
  const hits = new Map();
  const limited = (ip) => { const t = Date.now(); const l = (hits.get(ip) || []).filter((x) => t - x < 3600e3); hits.set(ip, l); if (l.length >= 6) return true; l.push(t); return false; };

  // reminders: overdue returns, scheduled service, low inventory (once per asset per day) -> mondo notifications + phone push
  function checkAlerts() {
    try {
      const s = settings().alerts; const today = new Date().toISOString().slice(0, 10); const to = admins(); if (!to.length) return;
      const once = (k) => { if (db.prepare('select 1 from meta where key=?').get(k)) return false; db.prepare('insert into meta values(?,?)').run(k, now()); return true; };
      for (const a of db.prepare('select * from assets where active=1').all().map(row)) {
        const name = `${a.data.asset_type || 'Asset'} ${a.code}`;
        if (s.overdue && a.checked_out && a.return_date && a.return_date < today && once(`alert:over:${a.id}:${a.return_date}`)) to.forEach((p) => notify(p, `⏰ Overdue: ${name} (${a.assigned_to}) was due back ${a.return_date}`, null, null, '/#/assets/' + a.id));
        if (s.service && a.data.next_filter_change && a.data.next_filter_change <= today && once(`alert:svc:${a.id}:${a.data.next_filter_change}`)) to.forEach((p) => notify(p, `🔧 Service due: ${name} – filter change ${a.data.next_filter_change}`, null, null, '/#/assets/' + a.id));
        if (s.low_inventory && a.data.min_quantity != null && a.data.quantity != null && +a.data.quantity < +a.data.min_quantity && once(`alert:low:${a.id}:${today}`)) to.forEach((p) => notify(p, `📦 Low stock: ${name} (${a.data.quantity} left)`, null, null, '/#/assets/' + a.id));
      }
    } catch (e) { console.warn('asset alerts failed', e.message); }
  }

  const csv = (rows) => rows.map((r) => r.map((v) => { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  const sendCsv = (res, name, rows) => { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${name}"`); res.send('\ufeff' + csv(rows)); };

  function routes(app, wrap) {
    const nf = (res) => { res.status(404).json({ error: 'not found' }); };
    const need = (req, res) => { if (!req.user) { res.status(401).json({ error: 'login needed' }); return false; } return true; };
    const A = (req, res) => { const a = getA(req.params.id); if (!a) nf(res); return a; };

    app.get('/api/assets', wrap(() => ({ assets: listAll(), settings: settings(), unassigned: db.prepare('select count(*) n from qr_codes where asset_id is null').get().n })));
    app.get('/api/assets/settings', wrap(() => settings()));
    app.put('/api/assets/settings', wrap((req, res) => { if (!isAdmin(req)) return res.status(403).json({ error: 'Group administrator only' }); const s = { ...settings(), ...req.body }; saveSettings(s); return s; }));
    app.post('/api/assets', wrap((req) => { const a = createAsset(req.body, req.body.gps || {}); if (req.body.gps) gps(a, req.body.gps, meName()); return getA(a.id); }));
    app.get('/api/assets/:id', wrap((req, res) => { const a = A(req, res); return a && detail(a, req); }));
    app.patch('/api/assets/:id', wrap((req, res) => { const a = A(req, res); return a && patchAsset(a, req.body); }));
    app.post('/api/assets/:id/deactivate', wrap((req, res) => { if (!isAdmin(req)) return res.status(403).json({ error: 'Group administrator only' }); const a = A(req, res); if (!a) return; db.prepare('update assets set active=0 where id=?').run(a.id); ev(a, 'deactivate', 'Asset deactivated'); return { ok: true }; }));
    app.post('/api/assets/:id/checkout', wrap((req, res) => { const a = A(req, res); return a && checkout(a, req.body); }));
    app.post('/api/assets/:id/checkin', wrap((req, res) => { const a = A(req, res); return a && checkin(a, req.body); }));
    app.post('/api/assets/:id/copy', wrap((req, res) => { // "Copy to": put this asset's info on another (e.g. replacement) tag
      const a = A(req, res); if (!a) return; const code = normCode(req.body.code); if (!code) throw new Error('Scan or type the new tag');
      if (db.prepare('select 1 from assets where code=?').get(code)) throw new Error('That tag is already in use');
      const n = createAsset({ code, data: a.data }, { text: 'Copied from ' + a.code }); ev(a, 'edit', 'Info copied to ' + code); return n;
    }));
    app.post('/api/assets/:id/photo', wrap((req, res) => {
      const a = A(req, res); if (!a) return;
      if (!req.body.data) { db.prepare('update assets set photo=null where id=?').run(a.id); ev(a, 'photo', 'Photo removed'); return getA(a.id); }
      const f = saveFile(req.body.data, 4e6); if (!/^image\/(jpeg|png|webp)$/.test(f.mime)) throw new Error('Photo must be JPG/PNG/WebP');
      db.prepare('update assets set photo=?, updated=? where id=?').run(f.file, now(), a.id); ev(a, 'photo', 'Photo updated', req.body.gps || {}); return getA(a.id);
    }));
    const sendUpload = (res, file, mime) => { const p = path.join(UP, path.basename(String(file || ''))); if (!file || !fs.existsSync(p)) return nf(res); res.setHeader('Content-Type', mime || 'application/octet-stream'); res.setHeader('Cache-Control', 'private, max-age=3600'); res.sendFile(p); };
    app.get('/api/assets/:id/photo', (req, res) => { const a = getA(req.params.id); sendUpload(res, a?.photo, 'image/jpeg'); });
    app.post('/api/assets/:id/scan', wrap((req, res) => { const a = A(req, res); if (!a) return; ev(a, 'scan', req.body.note || 'Scanned', req.body); gps(a, req.body, meName()); return getA(a.id); }));
    // tasks
    app.post('/api/assets/:id/tasks', wrap((req, res) => { const a = A(req, res); if (!a) return; const id = 't_' + crypto.randomBytes(4).toString('hex'); db.prepare('insert into asset_tasks values(?,?,?,?,?,?,0,?)').run(id, a.id, String(req.body.title || 'Task').slice(0, 200), req.body.priority || 'Medium', req.body.assignee || null, req.body.due || null, now()); ev(a, 'task', 'Task: ' + req.body.title); if (req.body.assignee) notify(req.body.assignee, `📋 New task on ${a.data.asset_type || 'asset'} ${a.code}: ${req.body.title}`, null, null, '/#/assets/' + a.id); return { ok: true }; }));
    app.patch('/api/asset-tasks/:tid', wrap((req) => { const t = db.prepare('select * from asset_tasks where id=?').get(req.params.tid); if (!t) throw new Error('not found'); db.prepare('update asset_tasks set title=?, priority=?, assignee=?, due=?, done=? where id=?').run(req.body.title ?? t.title, req.body.priority ?? t.priority, req.body.assignee !== undefined ? req.body.assignee : t.assignee, req.body.due !== undefined ? req.body.due : t.due, req.body.done != null ? (req.body.done ? 1 : 0) : t.done, t.id); return { ok: true }; }));
    app.delete('/api/asset-tasks/:tid', wrap((req) => { db.prepare('delete from asset_tasks where id=?').run(req.params.tid); return { ok: true }; }));
    app.get('/api/asset-tasks', wrap(() => db.prepare("select t.*, a.code, json_extract(a.data,'$.asset_type') asset_type from asset_tasks t join assets a on a.id=t.asset_id where a.active=1 order by t.done, case t.priority when 'Critical' then 0 when 'High' then 1 when 'Medium' then 2 else 3 end, t.due is null, t.due").all()));
    // documents
    app.post('/api/assets/:id/docs', wrap((req, res) => {
      const a = A(req, res); if (!a) return; const id = 'd_' + crypto.randomBytes(4).toString('hex');
      if (req.body.url) { if (!/^https?:\/\//.test(req.body.url)) throw new Error('Link must start with http'); db.prepare('insert into asset_docs values(?,?,?,?,?,?,?,?)').run(id, a.id, String(req.body.name || req.body.url).slice(0, 200), null, null, req.body.url, now(), me()); }
      else { const f = saveFile(req.body.data); db.prepare('insert into asset_docs values(?,?,?,?,?,?,?,?)').run(id, a.id, String(req.body.name || 'file').slice(0, 200), f.file, f.mime, null, now(), me()); }
      ev(a, 'doc', 'Attached ' + (req.body.name || req.body.url)); return { ok: true };
    }));
    app.get('/api/asset-docs/:did', (req, res) => { const d = db.prepare('select * from asset_docs where id=?').get(req.params.did); if (!d) return nf(res); if (d.url) return res.redirect(d.url); const safe = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(d.mime || ''); res.setHeader('Content-Security-Policy', 'sandbox'); res.setHeader('Content-Disposition', `${safe ? 'inline' : 'attachment'}; filename="${encodeURIComponent(d.name)}"`); sendUpload(res, d.file, d.mime); });
    app.delete('/api/asset-docs/:did', wrap((req) => { db.prepare('delete from asset_docs where id=?').run(req.params.did); return { ok: true }; }));
    // messages (inbox of finder messages + notes sent from the team)
    app.get('/api/asset-messages', wrap(() => db.prepare("select m.*, a.id asset_id, json_extract(a.data,'$.asset_type') asset_type from asset_messages m left join assets a on a.id=m.asset_id order by m.created desc limit 300").all()));
    app.post('/api/asset-messages/read', wrap(() => { db.prepare('update asset_messages set read=1').run(); return { ok: true }; }));
    app.post('/api/assets/:id/messages', wrap((req, res) => { const a = A(req, res); if (!a) return; db.prepare('insert into asset_messages values(?,?,?,?,?,?,?,?,?,?,?,1)').run('m_' + crypto.randomBytes(4).toString('hex'), a.id, a.code, 'out', meName(), null, null, String(req.body.text || '').slice(0, 2000), null, null, now()); ev(a, 'message', 'Message: ' + String(req.body.text || '').slice(0, 80)); return { ok: true }; }));
    // QR codes: unassigned pre-printed tags
    app.get('/api/qr', wrap((req) => ({ base: baseUrl(req), codes: db.prepare('select * from qr_codes where asset_id is null order by created desc, code').all() })));
    app.post('/api/qr/generate', wrap((req) => { const n = Math.max(1, Math.min(500, +req.body.count || 10)); const batch = 'b' + Date.now(); const out = []; db.transaction(() => { for (let k = 0; k < n; k++) { const c = freeCode(); db.prepare('insert into qr_codes values(?,?,?,?)').run(c, null, batch, now()); out.push(c); } })(); return { codes: out, batch }; }));
    // Activate asset tag: link an unassigned tag to an existing asset (or a new one)
    app.post('/api/qr/:code/activate', wrap((req, res) => {
      const code = normCode(req.params.code); const q = code && db.prepare('select * from qr_codes where code=?').get(code);
      if (!q) throw new Error('Unknown tag ' + (code || '')); if (q.asset_id) throw new Error('Tag is already in use');
      let a;
      if (req.body.asset_id) { a = getA(req.body.asset_id); if (!a) return nf(res); const old = a.code; db.prepare('update assets set code=?, legacy_code=coalesce(legacy_code, ?), updated=? where id=?').run(code, null, now(), a.id); db.prepare('update qr_codes set asset_id=null where code=?').run(old); db.prepare('delete from qr_codes where code=? and batch=?').run(old, 'asset'); db.prepare('update qr_codes set asset_id=? where code=?').run(a.id, code); a = getA(a.id); ev(a, 'activate', `Tag ${code} activated (was ${old})`, req.body.gps || {}); }
      else { db.prepare('delete from qr_codes where code=?').run(code); a = createAsset({ code, data: req.body.data || {} }, { ...(req.body.gps || {}), text: 'Tag activated' }); }
      if (req.body.gps) gps(a, req.body.gps, meName());
      return getA(a.id);
    }));
    // scan resolve: logged in → full asset / activate; public → only the public fields + message form
    app.get('/api/scan/:code', wrap((req) => {
      const code = normCode(req.params.code); const s = settings();
      const a = code && byCode(code);
      if (!req.user) {
        if (!a || !a.active) return { kind: 'unknown', code, org: s.org };
        const pub = Object.fromEntries(s.public_fields.filter((k) => a.data[k]).map((k) => [label(k), a.data[k]]));
        if (s.alerts.doc_public && a.data.documentation) pub.Documentation = a.data.documentation;
        return { kind: 'public', code: a.code, org: s.org, title: a.data.asset_type || 'Asset', fields: pub, reward: a.data.reward || null };
      }
      if (a) return { kind: 'asset', id: a.id, code: a.code };
      if (code && db.prepare('select 1 from qr_codes where code=? and asset_id is null').get(code)) return { kind: 'unassigned', code };
      return { kind: 'unknown', code };
    }));
    app.post('/api/scan/:code/message', wrap((req, res) => {
      const a = byCode(req.params.code); if (!a || !a.active) return nf(res);
      if (limited(req.ip)) return res.status(429).json({ error: 'Too many messages – try again later' });
      const text = String(req.body.text || '').trim().slice(0, 2000); if (!text) throw new Error('Write a message');
      db.prepare('insert into asset_messages values(?,?,?,?,?,?,?,?,?,?,?,0)').run('m_' + crypto.randomBytes(4).toString('hex'), a.id, a.code, 'in', String(req.body.name || '').slice(0, 100), String(req.body.email || '').slice(0, 200), String(req.body.phone || '').slice(0, 50), text, num(req.body.lat), num(req.body.lng), now());
      ev(a, 'message', 'Finder message: ' + text.slice(0, 80), { ...req.body, who: null, whoName: 'Public scan' });
      if (num(req.body.lat) != null) gps(a, req.body, 'Public scan');
      admins().forEach((p) => notify(p, `📨 Message about ${a.data.asset_type || 'asset'} ${a.code}: ${text.slice(0, 80)}`, null, null, '/#/assets/' + a.id));
      return { ok: true };
    }));
    // links from boards: make a job on a board with the asset code filled in
    app.post('/api/assets/:id/job', wrap((req, res) => {
      const a = A(req, res); if (!a) return; const b = getBoard(req.body.board_id); if (!b) return nf(res);
      const col = b.columns.find((c) => /gocode|asset|tag/i.test(c.title) && c.type === 'text');
      const id = insertItem(b.id, b.groups[0]?.id, req.body.name || `${a.data.asset_type || 'Asset'} ${a.code}`, null, col ? { [col.id]: a.code } : {});
      ev(a, 'job', `Job created on ${b.name}`); return { board_id: b.id, item_id: id };
    }));
    // map: last known positions + trail
    app.get('/api/assets-map', wrap(() => ({ assets: listAll().filter((a) => a.last_lat != null), trails: db.prepare('select asset_id, lat, lng, acc, created, who_name, type from asset_events where lat is not null order by id').all() })));
    // labels PDF
    app.get('/api/labels.pdf', (req, res) => {
      if (!need(req, res)) return;
      try {
        let codes = String(req.query.codes || '').split(',').map(normCode).filter(Boolean);
        if (req.query.unassigned) codes = db.prepare('select code from qr_codes where asset_id is null order by created desc, code').all().map((r) => r.code);
        if (req.query.all) codes = db.prepare('select code from assets where active=1 order by created').all().map((r) => r.code);
        if (!codes.length) return res.status(400).json({ error: 'no codes' });
        const names = Object.fromEntries(db.prepare(`select code, data from assets where code in (${codes.map(() => '?').join(',')})`).all(...codes).map((r) => [r.code, J(r.data, {})]));
        require('./labels').pdf(res, { codes, base: baseUrl(req), template: req.query.template, start: +req.query.start || 0, header: req.query.header ?? settings().org, showName: req.query.name === '1', names, outline: req.query.outline === '1' });
      } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: e.message }); }
    });
    // reports (CSV)
    app.get('/api/assets-report/:kind', (req, res) => {
      if (!need(req, res)) return;
      const s = settings(); const flds = [...s.fields.filter((f) => f.on), ...s.custom]; const list = listAll(); const day = new Date().toISOString().slice(0, 10);
      const k = req.params.kind;
      if (k === 'all') return sendCsv(res, `assets-${day}.csv`, [['Asset ID', 'GoCodes ID', ...flds.map((f) => f.label), 'Assigned to', 'Checked out', 'Return date', 'Current value', 'End of life', 'Last lat', 'Last lng', 'Last seen', 'Last updated'], ...list.map((a) => [a.code, a.legacy_code, ...flds.map((f) => a.data[f.key]), a.assigned_to, a.checked_out ? 'Yes' : 'No', a.return_date, a.current_value, a.end_of_life, a.last_lat, a.last_lng, a.last_seen, a.updated])]);
      if (k === 'assignment') return sendCsv(res, `asset-assignment-${day}.csv`, [['Assigned to', 'Asset ID', 'Asset type', 'Model', 'Serial number', 'Checked out', 'Return date', 'Overdue'], ...list.filter((a) => a.checked_out).sort((x, y) => x.assigned_to.localeCompare(y.assigned_to)).map((a) => [a.assigned_to, a.code, a.data.asset_type, a.data.model, a.data.serial, a.checked_out_at?.slice(0, 10), a.return_date, a.return_date && a.return_date < day ? 'Yes' : ''])]);
      if (k === 'history') return sendCsv(res, `change-history-${day}.csv`, [['Time (UTC)', 'Asset ID', 'Type', 'What', 'By', 'Lat', 'Lng', 'Accuracy (m)'], ...db.prepare('select * from asset_events order by id desc').all().map((e) => [e.created, e.code, e.type, e.text, e.who_name, e.lat, e.lng, e.acc])]);
      if (k === 'depreciation') { const m = req.query.method || 'SL half-year'; const y = +req.query.year || new Date().getFullYear(); return sendCsv(res, `depreciation-${m.replace(/\W+/g, '')}-${y}.csv`, [['Asset ID', 'Asset type', 'Model', 'Date purchased', 'Original cost', 'Salvage value', 'Life (years)', 'Method', 'Year', 'Depreciation this year', 'Accumulated', 'Book value end of year'], ...list.map((a) => [a, depreciation(a, m, y)]).filter(([, d]) => d).map(([a, d]) => [a.code, a.data.asset_type, a.data.model, a.data.date_purchased, d.cost, d.salvage, d.life, m, y, d.thisYear, d.accumulated, d.book])]); }
      nf(res);
    });
  }
  return { routes, checkAlerts, createAsset, checkout, checkin, ev, gps, settings, saveSettings, getA, normCode };
}
module.exports = { setup, normCode, randCode, ALPH, fmtCode, depreciation, defaultSettings };
