// 🛞 Wear registration, new-tyre choices on booking, staff warning, automatic reminder (default September), customer-visible notes.
// SMS/e-mail are only drafts in the outbox. Customer web push only if the customer has Min side + push turned on.
const crypto = require('crypto');
const CCOOKIE = 'mondo_kunde';
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const parseCookies = (h) => Object.fromEntries(String(h || '').split(';').map((x) => x.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const digits = (s) => String(s || '').replace(/\D/g, ''); const pk = (s) => digits(s).slice(-8);
const nreg = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9ÆØÅ]/g, '');
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const DEF_TEXTS = {
  prev_title: 'Notat fra forrige gang', worn_line: 'Husk: du trenger nye dekk', worn_detail: 'Dine dekk er slitte og må byttes',
  choice_yes: 'Ja, bestill nye dekk til timen', choice_offer: 'Gi meg et tilbud først', choice_no: 'Nei takk',
  generic_q: 'Trenger du nye dekk?', generic_yes: 'Ja, gi meg et tilbud', generic_no: 'Nei takk',
  staff_popup: 'Disse dekkene må det bestilles nye dekk til', remind_staff: 'Husk: denne kunden trenger nye dekk',
  remind_customer: 'Hei! Dekkene dine er slitte. Vil du at vi bestiller nye dekk før sesongen? Svar her eller bestill time.',
};
const CHOICES = { yes: 'choice_yes', offer: 'choice_offer', no: 'choice_no', generic_yes: 'generic_yes', generic_no: 'generic_no' };

module.exports.setup = function setup(db, h) {
  const { now, notify, getBoard, log, touch, B, C, label, labelName, items, setVals, settings, saveSettings, osloNow, outbox, setInfo, push, recompute } = h;
  db.exec('create table if not exists cust_notices(id integer primary key autoincrement, customer_id text, text text, url text, created text, pushed integer)');
  const conf = () => { const w = settings().wear || {}; return { texts: { ...DEF_TEXTS, ...(w.texts || {}) }, reminder: { on: true, month: 9, day: 1, decided: false, ...(w.reminder || {}) } }; };
  const get = (id) => { const r = db.prepare('select * from items where id=?').get(id); return r ? h.itemRow(r) : null; };
  const has = (a, id) => Array.isArray(a) && a.includes(id);
  function ensureCols(b, defs) {
    let cols = b.columns; let ch = false;
    for (const [title, type, s] of defs) if (!cols.some((c) => c.title === title)) { cols = [...cols, { id: 'c_' + crypto.randomBytes(4).toString('hex'), type, title, settings: s || {} }]; ch = true; }
    if (ch) db.prepare('update boards set columns=? where id=?').run(JSON.stringify(cols), b.id);
    return ch ? getBoard(b.id) : b;
  }
  const L = (spec) => [...spec.map(([l, c]) => ({ id: 'l_' + crypto.randomBytes(3).toString('hex'), label: l, color: c })), { id: 'l_' + crypto.randomBytes(3).toString('hex'), label: '', color: '#c4c4c4' }];
  const col = (b, t) => b.columns.find((c) => c.title === t);
  let seeding = false;
  function boards() {
    let kb = B('kunder'), lb = B('lager'), bb = B('bookinger'); if (!kb || !lb || !bb) return null;
    kb = ensureCols(kb, [['Notat til kunde (synlig)', 'long_text'], ['Påminnelse nye dekk (egen dato)', 'text'], ['Oppgave', 'status', { labels: L([['Bestill nye dekk', '#df2f4a'], ['Gi tilbud på dekk', '#fdab3d'], ['Ferdig', '#00c875']]) }]]);
    lb = ensureCols(lb, [['Slitasje registrert', 'date'], ['Slitasje-notat', 'text'], ['Påminnelse nye dekk', 'date'], ['Påminnelse sendt', 'checkbox']]);
    bb = ensureCols(bb, [['Nye dekk-valg', 'text']]);
    if (!seeding) { seeding = true; try { seedDemo(); } catch (e) { console.error('wear seed', e.message); } }
    return { kb, lb, bb };
  }
  const staff = () => { const p = db.prepare('select distinct person_id from users where person_id is not null').all().map((r) => r.person_id); return p.length ? p : ['p_simon']; };
  const task = (kb, kid, name) => { const c = col(kb, 'Oppgave'); const id = label(c, name); if (id) { setVals(kid, { [c.id]: id }); touch(kb.id); } };

  function findCustomer(phone, reg) {
    const bs = boards(); if (!bs) return null; const p = pk(phone), r = nreg(reg); if (p.length < 8 || r.length < 2) return null;
    const cm = C(bs.kb, 'kunder', 'Mobil'); const vb = B('kjoretoy');
    const cands = items(bs.kb).filter((k) => pk(k.vals[cm.id]) === p); if (!cands.length || !vb) return null;
    const cR = C(vb, 'kjoretoy', 'Regnr'), cE = C(vb, 'kjoretoy', 'Eier');
    const v = items(vb).find((x) => nreg(x.vals[cR.id] || x.name) === r && cands.some((k) => has(x.vals[cE.id], k.id)));
    return v ? cands.find((k) => has(v.vals[cE.id], k.id)) : null;
  }
  function prevInfo(kid) {
    const bs = boards(); const k = kid && get(kid); if (!bs || !k) return { known: false };
    const sets = items(bs.lb).map((it) => ({ ...setInfo(bs.lb, it), wear_note: it.vals[col(bs.lb, 'Slitasje-notat').id] || '', wear_date: it.vals[col(bs.lb, 'Slitasje registrert').id] || '' })).filter((s) => has(s.kunde, k.id) && !['Utlevert til kunde', 'Skal kastes'].includes(s.status));
    const worn = sets.find((s) => s.level === 'Ja') || sets.find((s) => s.level === 'Snart') || null;
    const note = String(k.vals[col(bs.kb, 'Notat til kunde (synlig)').id] || '').trim();
    return { known: true, first: k.name.split(' ')[0], worn: worn ? { level: worn.level, min: worn.min, season: worn.season, dim: worn.dim, depths: worn.depths, note: worn.wear_note, date: worn.wear_date } : null, note, texts: conf().texts };
  }
  function saveChoice(kid, bookingId, choice, src) {
    const bs = boards(); if (!bs || !CHOICES[choice]) return null; const t = conf().texts[CHOICES[choice]]; const k = get(kid);
    if (bookingId) { setVals(bookingId, { [col(bs.bb, 'Nye dekk-valg').id]: t }); log(bs.bb.id, bookingId, '🛞 Kunden svarte: ' + t); touch(bs.bb.id); }
    if (k && ['yes', 'offer', 'generic_yes'].includes(choice)) { task(bs.kb, k.id, choice === 'yes' ? 'Bestill nye dekk' : 'Gi tilbud på dekk'); log(bs.kb.id, k.id, `🛞 ${t} (${src})`); staff().forEach((p) => notify(p, `🛞 ${k.name}: «${t}»`, bookingId ? bs.bb.id : bs.kb.id, bookingId || k.id)); }
    return t;
  }
  function onBooking(res, body) {
    try {
      const bs = boards(); if (!bs) return; const cRef = C(bs.bb, 'bookinger', 'Bookingref'); const bk = items(bs.bb).find((x) => x.vals[cRef.id] === res.ref); if (!bk) return;
      const kid = (bk.vals[C(bs.bb, 'bookinger', 'Kunde').id] || [])[0]; const info = findCustomer(body.phone, body.regnr) ? prevInfo(kid) : { known: false };
      res.tyre_prompt = { worn: info.worn ? { level: info.worn.level, min: info.worn.min, season: info.worn.season } : null, texts: conf().texts };
      if (body.tyre_choice) res.tyre_choice = saveChoice(kid, bk.id, String(body.tyre_choice), 'nettbooking');
    } catch (e) { console.error('wear onBooking', e.message); }
  }
  function nextReminder(kid) {
    const bs = boards(); const r = conf().reminder; const today = osloNow().date; const y = +today.slice(0, 4);
    const ov = String((kid && get(kid)?.vals[col(bs.kb, 'Påminnelse nye dekk (egen dato)').id]) || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(ov)) return ov;
    let md = `${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`; const m = ov.match(/^(\d{1,2})[.\-/](\d{1,2})$/); if (m) md = `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // override "15.08" = 15 Aug
    const d = `${y}-${md}`; return d > today ? d : `${y + 1}-${md}`;
  }
  function register(setId, depths, who) {
    const bs = boards(); const it = get(setId); if (!bs || !it || it.board_id !== bs.lb.id) throw Object.assign(new Error('Ukjent hjulsett'), { status: 404 });
    const ds = (Array.isArray(depths) ? depths : []).slice(0, 4).map((x) => Math.round(parseFloat(String(x).replace(',', '.')) * 10) / 10);
    if (ds.length !== 4 || ds.some((x) => !(x >= 0 && x < 20))) throw Object.assign(new Error('Skriv mønsterdybde (mm) for alle 4 hjul'), { status: 400 });
    const patch = {}; ['VF', 'HF', 'VB', 'HB'].forEach((w, k) => { patch[C(bs.lb, 'lager', `Mønster ${w} (mm)`).id] = ds[k]; });
    const cS = C(bs.lb, 'lager', 'Lagerstatus'); const onLager = label(cS, 'På lager'); if (onLager) patch[cS.id] = onLager;
    patch[col(bs.lb, 'Slitasje registrert').id] = osloNow().date; setVals(it.id, patch);
    const s = setInfo(bs.lb, get(it.id)); const kid = s.kunde[0]; const k = kid && get(kid); const T = conf().texts;
    const out = { level: s.level, min: s.min, why: s.why, season: s.season, customer: k?.name || null, popup: s.level === 'Ja', text: T.staff_popup };
    const mm = String(s.min).replace('.', ',');
    if (s.level === 'Ja' || s.level === 'Snart') {
      const rem = nextReminder(kid); const note = `${s.level === 'Ja' ? T.worn_detail : 'Dekkene begynner å bli slitte'} (${mm} mm, ${s.season})`;
      setVals(it.id, { [col(bs.lb, 'Slitasje-notat').id]: note, [col(bs.lb, 'Påminnelse nye dekk').id]: rem, [col(bs.lb, 'Påminnelse sendt').id]: false });
      out.reminder = rem; out.note = note;
      log(bs.lb.id, it.id, `📏 Gamle dekk tatt av: ${ds.join(' / ')} mm – ${s.level === 'Ja' ? 'under grensen' : 'nær grensen'}. Påminnelse ${rem}.`);
      if (k && s.level === 'Ja') { task(bs.kb, k.id, 'Bestill nye dekk'); log(bs.kb.id, k.id, `🛞 ${T.staff_popup} (${mm} mm)`); }
      if (s.level === 'Ja') staff().forEach((p) => notify(p, `⚠️ ${T.staff_popup}: ${k?.name || it.name} (${mm} mm)`, bs.lb.id, it.id, '/#/dekk/hjulsett/' + (s.code || '')));
    } else { setVals(it.id, { [col(bs.lb, 'Slitasje-notat').id]: '', [col(bs.lb, 'Påminnelse nye dekk').id]: '' }); log(bs.lb.id, it.id, `📏 Gamle dekk tatt av: ${ds.join(' / ')} mm – OK.`); }
    touch(bs.lb.id); try { recompute(true); } catch {} void who; return out;
  }
  function runReminders(today) {
    const bs = boards(); if (!bs) return { sent: 0 }; const r = conf(); if (!r.reminder.on && !today) return { sent: 0 }; today = today || osloNow().date;
    const cD = col(bs.lb, 'Påminnelse nye dekk'), cX = col(bs.lb, 'Påminnelse sendt'); let sent = 0; const done = [];
    for (const it of items(bs.lb)) {
      const d = it.vals[cD.id]; if (!d || d > today || it.vals[cX.id]) continue;
      const s = setInfo(bs.lb, it); if (s.level === 'OK') { setVals(it.id, { [cX.id]: true }); continue; }
      const kid = s.kunde[0]; const k = kid && get(kid); const mm = String(s.min).replace('.', ',');
      staff().forEach((p) => notify(p, `🔔 ${r.texts.remind_staff}: ${k?.name || it.name} (${s.season}, ${mm} mm)`, bs.kb.id, kid || it.id));
      const cu = kid && db.prepare('select id from cust_users where customer_id=?').get(kid); let pushed = 0;
      if (cu) { const subs = db.prepare('select count(*) n from push_subs where person=?').get('cust:' + kid).n; db.prepare('insert into cust_notices(customer_id,text,url,created,pushed) values(?,?,?,?,?)').run(kid, r.texts.remind_customer, '/minside', now(), subs ? 1 : 0); if (subs) { pushed = 1; push('cust:' + kid, { title: settings().company?.name || 'Dekkverksted', body: r.texts.remind_customer, url: '/minside', tag: 'dekk-' + it.id }).catch(() => {}); } }
      const phone = k && k.vals[C(bs.kb, 'kunder', 'Mobil').id]; const email = k && k.vals[C(bs.kb, 'kunder', 'E-post').id];
      const body = `${r.texts.remind_customer}\n(${s.season}, ${mm} mm)`;
      if (phone) outbox({ kind: 'sms', to: phone, body, board_id: bs.kb.id, item_id: kid });
      if (email) outbox({ kind: 'email', to: email, subject: r.texts.worn_line, body, board_id: bs.kb.id, item_id: kid });
      setVals(it.id, { [cX.id]: true }); log(bs.lb.id, it.id, `🔔 Påminnelse nye dekk: varsel til verkstedet${pushed ? ', push til kunden' : ''}, SMS/e-post lagt som utkast`); sent++; done.push({ customer: k?.name, pushed: !!pushed });
    }
    if (sent) touch(bs.lb.id); return { sent, done };
  }
  setInterval(() => { try { const n = osloNow(); if (n.min >= 9 * 60) runReminders(); } catch (e) { console.error('wear timer', e.message); } }, 15 * 60000).unref();

  function seedDemo() {
    if (db.prepare("select value from meta where key='dk_wear_seed'").get()) return; const bs = boards(); if (!bs) { seeding = false; return; }
    db.prepare("insert into meta values('dk_wear_seed','1') on conflict(key) do nothing").run();
    const kari = items(bs.kb).find((k) => k.name === 'Kari Demo'); if (!kari) return;
    setVals(kari.id, { [col(bs.kb, 'Notat til kunde (synlig)').id]: 'Låsebolten ligger i hanskerommet. Vi anbefaler å sjekke bremseklosser neste gang. (demo)', [C(bs.kb, 'kunder', 'Notat').id]: 'Internt: liker SMS, ikke ring før kl 10. (demo – skjult for kunden)' });
    const summer = items(bs.lb).find((it) => /Kari Demo – Sommer/.test(it.name)); if (summer) try { register(summer.id, [2.8, 2.9, 3.1, 3.0], 'seed'); } catch {}
  }

  const custOf = (req) => { const tok = parseCookies(req.headers.cookie)[CCOOKIE]; if (!tok) return null; const s = db.prepare('select * from cust_sessions where token=?').get(hash(tok)); if (!s || s.expires < Date.now()) return null; return db.prepare('select id, customer_id from cust_users where id=?').get(s.cust_user_id) || null; };
  function routes(app, { aw, adminOnly, limit }) {
    const err = (m, st) => Object.assign(new Error(m), { status: st });
    // public: booking page – note only when phone AND regnr match the same customer
    app.get('/api/book/prev', aw((req) => { limit(req, 40); const k = findCustomer(req.query.phone, req.query.regnr); return k ? prevInfo(k.id) : { known: false, texts: conf().texts }; }));
    app.post('/api/book/tyre-choice', aw((req) => {
      limit(req, 20); const b = req.body || {}; const bs = boards(); const cRef = C(bs.bb, 'bookinger', 'Bookingref'); const bk = items(bs.bb).find((x) => x.vals[cRef.id] === String(b.ref || ''));
      if (!bk || pk(bk.vals[C(bs.bb, 'bookinger', 'Mobil').id]) !== pk(b.phone)) throw err('Fant ikke bestillingen', 404);
      return { ok: true, text: saveChoice((bk.vals[C(bs.bb, 'bookinger', 'Kunde').id] || [])[0], bk.id, String(b.choice), 'bekreftelse') };
    }));
    // customer portal
    app.get('/api/portal/prev', aw((req) => { const u = custOf(req); if (!u) throw err('login needed', 401); const n = db.prepare('select id, text, url, created, pushed from cust_notices where customer_id=? order by id desc limit 10').all(u.customer_id); return { ...prevInfo(u.customer_id), notices: n, push: { has: !!db.prepare('select 1 from push_subs where person=?').get('cust:' + u.customer_id) } }; }));
    app.post('/api/portal/tyre-choice', aw((req) => { const u = custOf(req); if (!u) throw err('login needed', 401); return { ok: true, text: saveChoice(u.customer_id, null, String(req.body?.choice), 'Min side') }; }));
    app.get('/api/portal/push/key', aw(() => ({ key: h.pushKey ? h.pushKey() : null })));
    app.post('/api/portal/push/subscribe', aw((req) => { const u = custOf(req); if (!u) throw err('login needed', 401); const s = req.body || {}; if (!s.endpoint || !s.keys || !/^https:\/\//.test(s.endpoint)) throw err('bad subscription', 400);
      db.prepare('insert or replace into push_subs values(?,?,?,?,?)').run(s.endpoint, 'cust:' + u.customer_id, JSON.stringify(s.keys), String(req.headers['user-agent'] || '').slice(0, 200), now()); return { ok: true }; }));
    app.post('/api/portal/push/unsubscribe', aw((req) => { const u = custOf(req); if (!u) throw err('login needed', 401); db.prepare('delete from push_subs where person=?').run('cust:' + u.customer_id); return { ok: true }; }));
    // staff
    app.post('/api/dekk/wear/register', aw((req) => register(String(req.body?.set_id || ''), req.body?.depths, req)));
    app.get('/api/dekk/wear/settings', aw(() => { const c = conf(); return { ...c, months: MONTHS, next_default: nextReminder(null) }; }));
    app.put('/api/dekk/wear/settings', aw((req) => { adminOnly(req); const s = settings(); const b = req.body || {}; const cur = conf();
      const r = b.reminder || {}; const reminder = { on: r.on !== undefined ? !!r.on : cur.reminder.on, month: Math.max(1, Math.min(12, +r.month || cur.reminder.month)), day: Math.max(1, Math.min(28, +r.day || cur.reminder.day)), decided: r.decided !== undefined ? !!r.decided : cur.reminder.decided };
      const texts = { ...cur.texts }; for (const k of Object.keys(DEF_TEXTS)) if (b.texts && typeof b.texts[k] === 'string') texts[k] = b.texts[k].slice(0, 300) || DEF_TEXTS[k];
      s.wear = { reminder, texts }; saveSettings(s); return conf(); }));
    app.post('/api/dekk/wear/run-reminders', aw((req) => { adminOnly(req); const d = String(req.body?.today || ''); return runReminders(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : osloNow().date); }));
  }
  return { routes, onBooking, register };
};
