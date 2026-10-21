// 📧 E-post inn: booking requests that arrive by e-mail become items on Bookinger automatically.
// Two ways in: (1) IMAP poller (read-only, BODY.PEEK – never marks/moves/deletes, never replies)
//              (2) webhook POST /api/mail/inbound/<MAIL_WEBHOOK_SECRET> (JSON) for forwarding services.
// Credentials ONLY from env vars: IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_TLS, MAIL_WEBHOOK_SECRET.
const crypto = require('crypto');
const J = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };
const MONTHS = { jan: 1, januar: 1, feb: 2, februar: 2, mar: 3, mars: 3, apr: 4, april: 4, mai: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12 };
const WD = { søndag: 0, mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6 };

function parse(text, subject = '', from = '', today, services = []) {
  const all = `${subject}\n${text}`.replace(/\r/g, ''); const low = all.toLowerCase();
  const out = { missing: [] };
  // phone (Norwegian 8 digits, optional +47)
  const ph = all.match(/(?:\+47|0047)?[\s.-]*(\d{3}[\s.-]?\d{2}[\s.-]?\d{3}|\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})(?!\d)/); if (ph) out.phone = ph[1].replace(/\D/g, '').replace(/^(\d{3})(\d{2})(\d{3})$/, '$1 $2 $3');
  // reg nr: 2 letters + 4–5 digits
  const rg = all.match(/\b([A-ZÆØÅ]{2})[\s-]?(\d{4,5})\b/i); if (rg) out.regnr = rg[1].toUpperCase() + ' ' + rg[2];
  // name: "Hilsen X", "Mvh X", "Navn: X" or the From display name
  const nm = all.match(/(?:[Nn]avn\s*[:=]\s*|(?:[Mm]ed vennlig hilsen|[Vv]ennlig hilsen|[Mm]vh|[Hh]ilsen)[,.!]?[ \t]*\n?[ \t]*)([A-ZÆØÅ][\wæøåÆØÅ-]+(?:[ \t]+[A-ZÆØÅ][\wæøåÆØÅ-]+){0,2})/);
  const fromName = (from.match(/^\s*"?([^"<@]+?)"?\s*</) || [])[1];
  out.name = (nm && nm[1]) || (fromName && fromName.trim()) || null;
  out.email = (from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || null;
  // date: 24.10(.2026) | 24/10 | 24. oktober | i morgen | (neste) fredag
  const base = new Date(today + 'T12:00:00Z'); const iso = (d) => d.toISOString().slice(0, 10);
  const fix = (d, m, y) => { const yy = y ? (+y < 100 ? 2000 + +y : +y) : base.getUTCFullYear(); let dt = new Date(Date.UTC(yy, m - 1, d, 12)); if (!y && dt < base) dt = new Date(Date.UTC(yy + 1, m - 1, d, 12)); return isNaN(dt) ? null : iso(dt); };
  let m;
  if ((m = low.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/)) && +m[2] <= 12 && +m[1] <= 31) out.date = fix(+m[1], +m[2], m[3]);
  else if ((m = low.match(/\b(\d{1,2})\.?\s*(jan(?:uar)?|feb(?:ruar)?|mars?|apr(?:il)?|mai|juni?|juli?|aug(?:ust)?|sept?(?:ember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\b/))) out.date = fix(+m[1], MONTHS[m[2]]);
  else if (/i morgen|imorgen/.test(low)) { const d = new Date(base); d.setUTCDate(d.getUTCDate() + 1); out.date = iso(d); }
  else if ((m = low.match(/\b(mandag|tirsdag|onsdag|torsdag|fredag|lørdag)\b/))) { const d = new Date(base); let k = (WD[m[1]] - d.getUTCDay() + 7) % 7 || 7; d.setUTCDate(d.getUTCDate() + k); out.date = iso(d); }
  // time: kl 10, kl. 10:30, 10.30, 1030
  if ((m = low.match(/\bkl\.?\s*(\d{1,2})(?:[:.](\d{2}))?/)) || (m = low.match(/\b(\d{1,2})[:](\d{2})\b/))) { const h = +m[1], mi = +(m[2] || 0); if (h >= 6 && h <= 20 && mi < 60) out.time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; }
  // service by keywords
  const SV = [['hjulskift_hotell', /dekkhotell|hotell|lagr/], ['nye_dekk', /nye dekk|kjøpe dekk|montere nye/], ['punktering', /punkt|lekk/], ['balansering', /balanser/], ['hjulskift', /hjulskift|dekkskift|skifte|bytte (dekk|hjul)|vinterdekk|sommerdekk|piggdekk/]];
  const sv = SV.find(([, re]) => re.test(low)); if (sv && services.some((s) => s.id === sv[0])) out.service = sv[0];
  for (const k of ['name', 'phone', 'regnr', 'date', 'time', 'service']) if (!out[k]) out.missing.push(k);
  return out;
}

module.exports.parse = parse;
module.exports.setup = function setup(db, h) {
  const { now, notify, insertItem, getBoard, log, touch, B, C, label, setVals, settings, osloNow, slots, findOrCreateCustomer, findOrCreateVehicle, normReg, nbDate } = h;
  db.exec(`create table if not exists mail_in(id integer primary key autoincrement, msgid text unique, source text, from_addr text, subject text, body text, parsed text, item_id text, status text, created text)`);
  const cfg = () => ({ address: '', provider: '', enabled: false, poll_min: 5, ...J(db.prepare("select value from meta where key='mail_intake'").get()?.value, {}) });
  const saveCfg = (c) => db.prepare("insert into meta values('mail_intake', ?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(c));
  const imapOn = () => !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS);
  const NAMES = { name: 'navn', phone: 'mobil', regnr: 'regnr', date: 'dato', time: 'klokkeslett', service: 'tjeneste' };

  function ensureSetup(b) {
    let cols = b.columns, groups = b.groups, changed = false;
    const k = cols.find((c) => c.title === 'Kilde'); if (k && !k.settings.labels.some((l) => l.label === 'E-post')) { k.settings.labels.splice(k.settings.labels.length - 1, 0, { id: 'l_' + crypto.randomBytes(3).toString('hex'), label: 'E-post', color: '#ff7575' }); changed = true; }
    if (!groups.some((g) => g.name === '📧 E-post – må sjekkes')) { groups = [{ id: 'g_' + crypto.randomBytes(4).toString('hex'), name: '📧 E-post – må sjekkes', color: '#ff7575', collapsed: false }, ...groups]; changed = true; }
    if (changed) db.prepare('update boards set columns=?, groups_=? where id=?').run(JSON.stringify(cols), JSON.stringify(groups), b.id);
    return changed ? getBoard(b.id) : b;
  }

  // turn one mail into a booking request (never replies)
  function intake({ msgid, from = '', subject = '', text = '', source = 'webhook' }) {
    msgid = String(msgid || crypto.createHash('sha1').update(from + subject + text).digest('hex')).slice(0, 200);
    if (db.prepare('select 1 from mail_in where msgid=?').get(msgid)) return { duplicate: true };
    const s = settings(); let b = B('bookinger'); if (!b) throw new Error('Bookinger board missing'); b = ensureSetup(b);
    const p = parse(String(text).slice(0, 20000), String(subject).slice(0, 300), String(from).slice(0, 300), osloNow().date, s.services);
    const svc = s.services.find((x) => x.id === p.service);
    let slotOk = false; if (p.date && p.time && svc) slotOk = !!slots(p.date, svc.id).find((x) => x.time === p.time && x.free > 0);
    const complete = !p.missing.length && slotOk;
    const v = (t) => C(b, 'bookinger', t)?.id; const vals = {};
    let cust = null, veh = null;
    if (p.phone && p.name) { cust = findOrCreateCustomer({ name: p.name, phone: '+47 ' + p.phone, email: p.email }); vals[v('Kunde')] = [cust.id]; }
    if (p.regnr && cust) { veh = findOrCreateVehicle(normReg(p.regnr), cust.id); vals[v('Kjøretøy')] = [veh.id]; }
    if (p.date) vals[v('Dato')] = p.date; if (p.time) vals[v('Tid')] = p.time; if (p.regnr) vals[v('Regnr')] = p.regnr;
    if (p.phone) vals[v('Mobil')] = '+47 ' + p.phone; if (p.email) vals[v('E-post')] = p.email;
    if (svc) { vals[v('Tjeneste')] = label(C(b, 'bookinger', 'Tjeneste'), svc.name); vals[v('Pris')] = svc.price; vals[v('Varighet (min)')] = svc.minutes; }
    vals[v('Status')] = label(C(b, 'bookinger', 'Status'), 'Bestilt'); vals[v('Kilde')] = label(C(b, 'bookinger', 'Kilde'), 'E-post');
    const why = complete ? '' : p.missing.length ? 'Mangler: ' + p.missing.map((k) => NAMES[k]).join(', ') : 'Ønsket tid er ikke ledig';
    vals[v('Kommentar')] = `📧 Fra: ${from}\nEmne: ${subject}\n${why ? '⚠️ ' + why + '\n' : ''}\n${String(text).slice(0, 3000)}`;
    const g = complete ? b.groups.find((x) => x.name === 'Nye bookinger') : b.groups.find((x) => x.name === '📧 E-post – må sjekkes');
    const name = `${complete ? '📧' : '⚠️ Må sjekkes:'} ${p.name || from.replace(/<.*>/, '').trim() || 'Ukjent'}${p.regnr ? ' – ' + p.regnr : ''}`;
    const id = insertItem(b.id, (g || b.groups[0]).id, name.slice(0, 200), null, vals);
    log(b.id, id, `📧 Laget fra e-post (${source})${why ? ' – ' + why : ''}`); touch(b.id);
    notify('p_simon', `📧 Ny booking-forespørsel på e-post${complete ? '' : ' – må sjekkes'}: ${p.name || from}`, b.id, id);
    db.prepare('insert into mail_in(msgid,source,from_addr,subject,body,parsed,item_id,status,created) values(?,?,?,?,?,?,?,?,?)').run(msgid, source, from, subject, String(text).slice(0, 5000), JSON.stringify(p), id, complete ? 'Booking laget' : 'Må sjekkes', now());
    return { ok: true, item_id: id, complete, parsed: p, why, date_text: p.date ? nbDate(p.date) : null };
  }

  // IMAP poller – read-only (PEEK), tracks last UID in meta, never replies/moves/deletes
  let polling = false, lastPoll = null, lastErr = null;
  async function poll() {
    if (polling || !imapOn() || !cfg().enabled) return; polling = true;
    const { ImapFlow } = require('imapflow'); const { simpleParser } = require('mailparser');
    const client = new ImapFlow({ host: process.env.IMAP_HOST, port: +(process.env.IMAP_PORT || 993), secure: process.env.IMAP_TLS !== 'false', auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS }, logger: false });
    try {
      await client.connect(); const lock = await client.getMailboxLock(process.env.IMAP_FOLDER || 'INBOX');
      try {
        const key = 'mail_uid_' + process.env.IMAP_USER; let last = +(db.prepare('select value from meta where key=?').get(key)?.value || 0);
        if (!last) { last = client.mailbox.uidNext - 1; } // first run: start from "now", don't import the whole history
        for await (const m of client.fetch(`${last + 1}:*`, { uid: true, source: true }, { uid: true })) {
          if (m.uid <= last) continue; const mail = await simpleParser(m.source);
          try { intake({ msgid: mail.messageId || 'uid' + m.uid, from: mail.from?.text || '', subject: mail.subject || '', text: mail.text || '', source: 'imap' }); } catch (e) { console.error('mail intake', e.message); }
          last = m.uid;
        }
        db.prepare('insert into meta values(?, ?) on conflict(key) do update set value=excluded.value').run(key, String(last));
      } finally { lock.release(); }
      await client.logout(); lastErr = null;
    } catch (e) { lastErr = e.message; console.error('imap', e.message); try { await client.close(); } catch {} }
    lastPoll = new Date().toISOString(); polling = false;
  }
  let timer = null; const schedule = () => { clearInterval(timer); timer = setInterval(poll, Math.max(1, cfg().poll_min) * 60000); timer.unref(); };
  schedule(); setTimeout(poll, 15000).unref();

  function routes(app, { aw, adminOnly, limit }) {
    const status = () => ({ config: cfg(), imap: { active: imapOn(), host: process.env.IMAP_HOST || null, user: process.env.IMAP_USER ? process.env.IMAP_USER.replace(/(.).*(@.*)/, '$1***$2') : null, last_poll: lastPoll, last_error: lastErr }, webhook: { active: !!process.env.MAIL_WEBHOOK_SECRET, path: '/api/mail/inbound/<MAIL_WEBHOOK_SECRET>' } });
    app.get('/api/dekk/mail', aw(() => ({ ...status(), log: db.prepare('select id,source,from_addr,subject,parsed,item_id,status,created from mail_in order by id desc limit 50').all().map((r) => ({ ...r, parsed: J(r.parsed, {}) })) })));
    app.put('/api/dekk/mail', aw((req) => { adminOnly(req); const b = req.body || {}; const c = cfg();
      saveCfg({ address: String(b.address ?? c.address).slice(0, 120), provider: String(b.provider ?? c.provider).slice(0, 60), enabled: !!(b.enabled ?? c.enabled), poll_min: Math.max(1, Math.min(60, +(b.poll_min ?? c.poll_min))) }); schedule(); return status(); }));
    app.post('/api/dekk/mail/test', aw((req) => { adminOnly(req); const b = req.body || {}; if (b.preview) return { parsed: parse(String(b.text || ''), String(b.subject || ''), String(b.from || ''), osloNow().date, settings().services) }; return intake({ from: b.from || 'Test <test@example.com>', subject: b.subject || 'Test', text: b.text || '', source: 'test', msgid: 'test-' + Date.now() }); }));
    app.post('/api/dekk/mail/poll', aw(async (req) => { adminOnly(req); await poll(); return status(); }));
    // webhook for forwarding services (JSON). Accepts {from,subject,text} and common provider field names.
    app.post('/api/mail/inbound/:secret', aw((req, res) => {
      const sec = process.env.MAIL_WEBHOOK_SECRET; if (!sec) return res.status(503).json({ error: 'webhook not active – set MAIL_WEBHOOK_SECRET' });
      const a = Buffer.from(String(req.params.secret)), bb = Buffer.from(sec); if (a.length !== bb.length || !crypto.timingSafeEqual(a, bb)) return res.status(404).json({ error: 'not found' });
      limit(req, 300); const x = req.body || {};
      const from = x.from?.text || x.From || x.from || x.sender || x.FromFull?.Email || ''; const subject = x.subject || x.Subject || ''; const text = x.text || x.TextBody || x['body-plain'] || x.plain || x.html?.replace(/<[^>]+>/g, ' ') || '';
      return intake({ msgid: x.messageId || x.MessageID || x['Message-Id'] || x.headers?.['message-id'], from: String(from), subject: String(subject), text: String(text), source: 'webhook' });
    }));
  }
  return { routes, intake, poll };
};
