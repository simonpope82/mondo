// 🛞 Dekkhotell module: public booking (capacity → free slots), CRM matching, invoices (PDF + e-mail DRAFTS only),
// payment links designed for Stripe Checkout + Vipps ePayment – INACTIVE until keys are put in env vars.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QR = require('qrcode');

const J = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };
const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + (m || 0); };
const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const digits = (s) => String(s || '').replace(/\D/g, '');
const phoneKey = (s) => digits(s).slice(-8);
const normReg = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9ÆØÅ]/g, '').slice(0, 10);
const prettyReg = (r) => (/^[A-Z]{2}\d{4,5}$/.test(r) ? r.slice(0, 2) + ' ' + r.slice(2) : r);
const kr = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0|\u202f/g, ' ') + ' kr';
const WD = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const nbDate = (d) => { const x = new Date(d + 'T12:00:00Z'); return `${WD[x.getUTCDay()]} ${x.getUTCDate()}.${x.getUTCMonth() + 1}.${x.getUTCFullYear()}`; };
function osloNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const kidMod10 = (num) => { const s = String(num); let sum = 0; s.split('').reverse().forEach((c, i) => { let v = +c * (i % 2 === 0 ? 2 : 1); if (v > 9) v -= 9; sum += v; }); return s + ((10 - (sum % 10)) % 10); };

const defaultSettings = () => ({
  company: { name: 'Demo Dekk AS', orgnr: '[Org.nr 999 999 999 MVA]', address: '[Gateadresse 1]', postal: '[0000 Sted]', phone: '[+47 000 00 000]', email: '[post@firma.no]', account: '[Kontonr 0000.00.00000]', web: '[www.firma.no]' },
  services: [
    { id: 'hjulskift', name: 'Hjulskift', minutes: 30, price: 790, icon: '🔄', desc: 'Bytte fra sommer til vinter (eller motsatt). Med kontroll av mønster og lufttrykk.' },
    { id: 'hjulskift_hotell', name: 'Hjulskift + dekkhotell', minutes: 30, price: 1690, icon: '🏨', desc: 'Hjulskift, vask og lagring av hjulene til neste sesong.' },
    { id: 'nye_dekk', name: 'Nye dekk montering', minutes: 60, price: 1200, icon: '🛞', desc: 'Montering og balansering av 4 nye dekk (dekk kommer i tillegg).' },
    { id: 'balansering', name: 'Balansering', minutes: 30, price: 600, icon: '⚖️', desc: 'Balansering av 4 hjul.' },
    { id: 'punktering', name: 'Punktering', minutes: 30, price: 450, icon: '🩹', desc: 'Reparasjon av punktert dekk.' },
  ],
  capacity: { lifts: 3, slot: 30, days_ahead: 21, min_notice_min: 60, hours: { 1: ['08:00', '17:00'], 2: ['08:00', '17:00'], 3: ['08:00', '17:00'], 4: ['08:00', '19:00'], 5: ['08:00', '16:00'], 6: ['09:00', '14:00'], 0: null }, closed: [] },
  invoice: { due_days: 14, mva: 25, prices_incl_mva: true, next_no: 10001 },
  boards: {}, map: {},
});

module.exports.setup = function setup(db, { now, notify, insertItem, getBoard, itemRow, log, touch, runAutomations, DATA_DIR, ASSETS }) {
  db.exec(`create table if not exists dk_outbox(id integer primary key autoincrement, kind text, to_addr text, subject text, body text, attachment text, board_id text, item_id text, status text, created text)`);
  const secretFile = path.join(DATA_DIR, 'dk-pay-secret');
  const SECRET = process.env.PAY_LINK_SECRET || (fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8') : (() => { const s = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(secretFile, s, { mode: 0o600 }); return s; })());

  const settings = () => { const s = J(db.prepare("select value from meta where key='dekk_settings'").get()?.value, null); const d = defaultSettings(); return s ? { ...d, ...s, capacity: { ...d.capacity, ...s.capacity }, invoice: { ...d.invoice, ...s.invoice }, company: { ...d.company, ...s.company } } : d; };
  const saveSettings = (s) => db.prepare("insert into meta values('dekk_settings', ?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(s));

  // column lookup: id saved at setup (survives renames) → fallback by title
  const B = (key) => { const id = settings().boards[key]; return id ? getBoard(id) : null; };
  const C = (b, key, title) => { const m = settings().map[key] || {}; const id = m[title]; return b.columns.find((c) => c.id === id) || b.columns.find((c) => c.title === title && c.type !== 'mirror'); };
  const label = (col, name) => col?.settings.labels?.find((l) => l.label.toLowerCase() === String(name).toLowerCase())?.id || null;
  const labelName = (col, id) => col?.settings.labels?.find((l) => l.id === id)?.label || '';
  const items = (b) => db.prepare('select * from items where board_id=? and parent_id is null').all(b.id).map(itemRow);
  const setVals = (id, patch) => { const cur = itemRow(db.prepare('select * from items where id=?').get(id)); db.prepare('update items set vals=?, updated=? where id=?').run(JSON.stringify({ ...cur.vals, ...patch }), now(), id); };
  const baseUrl = (req) => (process.env.PUBLIC_URL || (req ? `${req.protocol}://${req.get('host')}` : '')).replace(/\/$/, '');
  const payToken = (id) => id + '.' + crypto.createHmac('sha256', SECRET).update('pay:' + id).digest('base64url').slice(0, 16);
  const fromToken = (t) => { const [id] = String(t).split('.'); return id && payToken(id) === t ? id : null; };
  const outbox = (o) => db.prepare('insert into dk_outbox(kind,to_addr,subject,body,attachment,board_id,item_id,status,created) values(?,?,?,?,?,?,?,?,?)').run(o.kind, o.to || '', o.subject || '', o.body || '', o.attachment || null, o.board_id || null, o.item_id || null, smtpOn() && o.kind === 'email' ? 'Utkast – SMTP satt opp, men automatisk sending er slått av' : 'Utkast – ikke sendt', now()).lastInsertRowid;
  const smtpOn = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  const stripeOn = () => !!process.env.STRIPE_SECRET_KEY;
  const vippsOn = () => !!(process.env.VIPPS_CLIENT_ID && process.env.VIPPS_CLIENT_SECRET && process.env.VIPPS_SUBSCRIPTION_KEY && process.env.VIPPS_MSN);
  const vippsBase = () => (process.env.VIPPS_ENV === 'production' ? 'https://api.vipps.no' : 'https://apitest.vipps.no');

  // ---------- capacity / slots ----------
  function dayBookings(date) {
    const b = B('bookinger'); if (!b) return [];
    const cD = C(b, 'bookinger', 'Dato'), cT = C(b, 'bookinger', 'Tid'), cS = C(b, 'bookinger', 'Status'), cV = C(b, 'bookinger', 'Varighet (min)'), cL = C(b, 'bookinger', 'Løft');
    const off = [label(cS, 'Ikke møtt'), label(cS, 'Avlyst')];
    return items(b).filter((i) => i.vals[cD.id] === date && i.vals[cT.id] && !off.includes(i.vals[cS.id])).map((i) => ({ start: toMin(i.vals[cT.id]), dur: +i.vals[cV?.id] || 30, lift: i.vals[cL?.id] }));
  }
  function slots(date, service) {
    const s = settings(); const cap = s.capacity; const svc = s.services.find((x) => x.id === service) || s.services[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || cap.closed?.includes(date)) return [];
    const hours = cap.hours[new Date(date + 'T12:00:00Z').getUTCDay()]; if (!hours) return [];
    const n = osloNow(); if (date < n.date || date > addDays(n.date, cap.days_ahead)) return [];
    const open = toMin(hours[0]), close = toMin(hours[1]), step = +cap.slot || 30, dur = +svc.minutes || step;
    const bk = dayBookings(date); const out = [];
    for (let t = open; t + dur <= close; t += step) {
      if (date === n.date && t < n.min + (+cap.min_notice_min || 0)) continue;
      let maxUsed = 0;
      for (let u = t; u < t + dur; u += 5) maxUsed = Math.max(maxUsed, bk.filter((x) => x.start <= u && u < x.start + x.dur).length);
      out.push({ time: fromMin(t), free: Math.max(0, cap.lifts - maxUsed) });
    }
    return out;
  }
  function pickLift(b, date, start, dur) {
    const cL = C(b, 'bookinger', 'Løft'); const bk = dayBookings(date).filter((x) => x.start < start + dur && start < x.start + x.dur);
    const used = new Set(bk.map((x) => x.lift)); const labels = (cL?.settings.labels || []).filter((l) => l.label);
    return (labels.slice(0, settings().capacity.lifts).find((l) => !used.has(l.id)) || {}).id || null;
  }

  // ---------- CRM matching ----------
  function findOrCreateCustomer({ name, phone, email, consent }) {
    const b = B('kunder'); const cM = C(b, 'kunder', 'Mobil'), cE = C(b, 'kunder', 'E-post'), cS = C(b, 'kunder', 'Kundestatus'), cSms = C(b, 'kunder', 'SMS-samtykke'), cNr = C(b, 'kunder', 'Kundenr');
    const key = phoneKey(phone); const hit = key.length >= 8 && items(b).find((i) => phoneKey(i.vals[cM.id]) === key);
    if (hit) { const patch = {}; if (email && !hit.vals[cE.id]) patch[cE.id] = email; if (consent) patch[cSms.id] = true; if (Object.keys(patch).length) setVals(hit.id, patch); return { id: hit.id, created: false }; }
    const nr = 'K-' + (20000 + items(b).length + 1);
    const id = insertItem(b.id, b.groups[0].id, name, null, { [cM.id]: phone, ...(email ? { [cE.id]: email } : {}), [cS.id]: label(cS, 'Ny'), [cSms.id]: !!consent, [cNr.id]: nr });
    log(b.id, id, '🌐 Ny kunde fra nettbooking'); touch(b.id); return { id, created: true };
  }
  function findOrCreateVehicle(reg, customerId, info = {}) {
    const b = B('kjoretoy'); const cR = C(b, 'kjoretoy', 'Regnr'), cO = C(b, 'kjoretoy', 'Eier');
    const hit = items(b).find((i) => normReg(i.vals[cR.id]) === reg);
    if (hit) { if (!(hit.vals[cO.id] || []).includes(customerId)) setVals(hit.id, { [cO.id]: [...(hit.vals[cO.id] || []), customerId] }); return { id: hit.id, created: false }; }
    const vals = { [cR.id]: prettyReg(reg), [cO.id]: [customerId] };
    if (info.make) vals[C(b, 'kjoretoy', 'Merke').id] = info.make; if (info.model) vals[C(b, 'kjoretoy', 'Modell').id] = info.model;
    const id = insertItem(b.id, b.groups[0].id, prettyReg(reg), null, vals); log(b.id, id, '🌐 Nytt kjøretøy fra nettbooking'); touch(b.id);
    // link vehicle on the customer card too (two-way)
    const kb = B('kunder'); const cK = C(kb, 'kunder', 'Kjøretøy'); const cust = itemRow(db.prepare('select * from items where id=?').get(customerId));
    if (cK && !(cust.vals[cK.id] || []).includes(id)) setVals(customerId, { [cK.id]: [...(cust.vals[cK.id] || []), id] });
    return { id, created: true };
  }
  async function regLookup(reg) {
    const b = B('kjoretoy'); if (b) { const hit = items(b).find((i) => normReg(i.vals[C(b, 'kjoretoy', 'Regnr').id]) === reg); if (hit) return { found: true, source: 'kjøretøyregister', make: hit.vals[C(b, 'kjoretoy', 'Merke').id] || '', model: hit.vals[C(b, 'kjoretoy', 'Modell').id] || '' }; }
    if (process.env.VEGVESEN_API_KEY) {
      try {
        const r = await fetch('https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata?kjennemerke=' + encodeURIComponent(reg), { headers: { 'SVV-Authorization': 'Apikey ' + process.env.VEGVESEN_API_KEY }, signal: AbortSignal.timeout(5000) });
        if (r.ok) { const j = await r.json(); const g = j.kjoretoydataListe?.[0]?.godkjenning?.tekniskGodkjenning?.tekniskeData?.generelt; return { found: true, source: 'Statens vegvesen', make: g?.merke?.[0]?.merke || '', model: g?.handelsbetegnelse?.[0] || '' }; }
      } catch (e) { console.error('vegvesen', e.message); }
    }
    return { found: false, vegvesen: !!process.env.VEGVESEN_API_KEY };
  }

  // ---------- booking ----------
  function createBooking(body) {
    const s = settings(); const svc = s.services.find((x) => x.id === body.service);
    const name = String(body.name || '').trim().slice(0, 100), phone = String(body.phone || '').trim().slice(0, 30), email = String(body.email || '').trim().slice(0, 120);
    const reg = normReg(body.regnr); const date = String(body.date || ''), time = String(body.time || '');
    if (!svc) throw Object.assign(new Error('Velg en tjeneste'), { status: 400 });
    if (!name || phoneKey(phone).length < 8) throw Object.assign(new Error('Skriv navn og mobilnummer'), { status: 400 });
    if (reg.length < 2) throw Object.assign(new Error('Skriv registreringsnummer'), { status: 400 });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Object.assign(new Error('E-postadressen ser feil ut'), { status: 400 });
    const slot = slots(date, svc.id).find((x) => x.time === time);
    if (!slot || slot.free < 1) throw Object.assign(new Error('Tiden er ikke ledig lenger – velg en annen'), { status: 409 });
    const b = B('bookinger');
    const cust = findOrCreateCustomer({ name, phone, email, consent: !!body.consent });
    const veh = findOrCreateVehicle(reg, cust.id, body.vehicle || {});
    const ref = 'B' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const v = (t) => C(b, 'bookinger', t).id;
    const vals = { [v('Dato')]: date, [v('Tid')]: time, [v('Status')]: label(C(b, 'bookinger', 'Status'), 'Bestilt'), [v('Tjeneste')]: label(C(b, 'bookinger', 'Tjeneste'), svc.name),
      [v('Regnr')]: prettyReg(reg), [v('Kunde')]: [cust.id], [v('Kjøretøy')]: [veh.id], [v('Mobil')]: phone, ...(email ? { [v('E-post')]: email } : {}),
      [v('Løft')]: pickLift(b, date, toMin(time), +svc.minutes || 30), [v('Varighet (min)')]: +svc.minutes || 30, [v('Pris')]: +svc.price || 0,
      [v('Betaling')]: label(C(b, 'bookinger', 'Betaling'), 'Ikke betalt'), [v('Kilde')]: label(C(b, 'bookinger', 'Kilde'), 'Nettbooking'), [v('Bookingref')]: ref,
      ...(body.comment ? { [v('Kommentar')]: String(body.comment).slice(0, 1000) } : {}) };
    const id = insertItem(b.id, b.groups[0].id, `${name} – ${prettyReg(reg)}`, null, vals);
    log(b.id, id, '🌐 Booket på nett'); runAutomations(b.id, id, 'create', {}); touch(b.id);
    notify('p_simon', `📅 Ny nettbooking: ${svc.name} ${nbDate(date)} kl ${time} – ${prettyReg(reg)}`, b.id, id);
    const text = `Hei ${name.split(' ')[0]}! Takk for bestillingen hos ${s.company.name}.\n${svc.name} ${nbDate(date)} kl ${time}. Regnr ${prettyReg(reg)}.\nPris fra ${svc.price} kr. Ref ${ref}.\nVi bekrefter timen så snart vi kan.`;
    outbox({ kind: 'sms', to: phone, body: text, board_id: b.id, item_id: id });
    if (email) outbox({ kind: 'email', to: email, subject: `Bestilling mottatt – ${svc.name} ${nbDate(date)} kl ${time}`, body: text, board_id: b.id, item_id: id });
    return { ok: true, ref, service: svc.name, price: svc.price, minutes: svc.minutes, date, date_text: nbDate(date), time, regnr: prettyReg(reg), company: s.company.name, new_customer: cust.created };
  }

  // ---------- invoices ----------
  function createInvoice(bb, bi) {
    const fb = B('faktura'); if (!fb) return null;
    const cBk = C(fb, 'faktura', 'Booking');
    const exists = items(fb).find((x) => (x.vals[cBk.id] || []).includes(bi.id)); if (exists) return exists.id;
    const s = settings(); const no = s.invoice.next_no; saveSettings({ ...s, invoice: { ...s.invoice, next_no: no + 1 } });
    const g = (t) => bi.vals[C(bb, 'bookinger', t)?.id];
    const price = +g('Pris') || 0; const rate = (+s.invoice.mva || 25) / 100;
    const eks = s.invoice.prices_incl_mva ? Math.round((price / (1 + rate)) * 100) / 100 : price; const mva = Math.round(eks * rate * 100) / 100; const tot = Math.round((eks + mva) * 100) / 100;
    const today = osloNow().date; const f = (t) => C(fb, 'faktura', t).id;
    const vals = { [f('Fakturanr')]: String(no), [f('Kunde')]: g('Kunde') || [], [f('Booking')]: [bi.id], [f('Beløp eks. mva')]: eks, [f('MVA 25 %')]: mva, [f('Totalt')]: tot,
      [f('Status')]: label(C(fb, 'faktura', 'Status'), 'Utkast'), [f('Fakturadato')]: today, [f('Forfallsdato')]: addDays(today, s.invoice.due_days),
      [f('Betalingsmåte')]: label(C(fb, 'faktura', 'Betalingsmåte'), 'Faktura'), [f('KID')]: kidMod10(no), [f('Regnskap')]: label(C(fb, 'faktura', 'Regnskap'), 'Ikke overført'),
      ...(g('E-post') ? { [f('E-post')]: g('E-post') } : {}) };
    const id = insertItem(fb.id, fb.groups[0].id, `Faktura ${no} – ${bi.name}`, null, vals);
    setVals(id, { [f('Faktura-PDF')]: { url: `/api/dekk/invoice/${id}.pdf`, text: `PDF ${no}` }, [f('Betalingslenke')]: { url: `/#/betal/${payToken(id)}`, text: 'Betal' } });
    log(fb.id, id, `⚡ Faktura laget fra booking “${bi.name}”`); touch(fb.id);
    const cB = C(bb, 'bookinger', 'Betaling'); const cur = labelName(cB, bi.vals[cB?.id]);
    if (cB && (!cur || cur === 'Ikke betalt')) setVals(bi.id, { [cB.id]: label(cB, 'Fakturert') });
    notify('p_simon', `🧾 Faktura ${no} laget (${kr(tot)}) – “${bi.name}”`, fb.id, id);
    return id;
  }
  function invoiceData(id) {
    const fb = B('faktura'); const row = db.prepare('select * from items where id=? and board_id=?').get(id, fb?.id); if (!row) return null;
    const i = itemRow(row); const g = (t) => i.vals[C(fb, 'faktura', t)?.id];
    const kb = B('kunder'); const custId = (g('Kunde') || [])[0]; const cust = custId && db.prepare('select * from items where id=?').get(custId);
    const cv = cust ? itemRow(cust).vals : {}; const addr = cv[C(kb, 'kunder', 'Adresse')?.id];
    const bb = B('bookinger'); const bkId = (g('Booking') || [])[0]; const bk = bkId && db.prepare('select * from items where id=?').get(bkId);
    const bv = bk ? itemRow(bk).vals : {}; const bg = (t) => bv[C(bb, 'bookinger', t)?.id];
    const svc = labelName(C(bb, 'bookinger', 'Tjeneste'), bg('Tjeneste')) || 'Verkstedtjeneste';
    return { id, name: i.name, no: g('Fakturanr'), eks: +g('Beløp eks. mva') || 0, mva: +g('MVA 25 %') || 0, total: +g('Totalt') || 0, date: g('Fakturadato'), due: g('Forfallsdato'), kid: g('KID'),
      status: labelName(C(fb, 'faktura', 'Status'), g('Status')), email: g('E-post') || cv[C(kb, 'kunder', 'E-post')?.id] || '',
      customer: { name: cust ? cust.name : '—', address: (addr && (addr.address || addr)) || '', phone: cv[C(kb, 'kunder', 'Mobil')?.id] || '', nr: cv[C(kb, 'kunder', 'Kundenr')?.id] || '' },
      line: `${svc}${bg('Regnr') ? ' – ' + bg('Regnr') : ''}${bg('Dato') ? ' – ' + bg('Dato') + (bg('Tid') ? ' kl ' + bg('Tid') : '') : ''}`, company: settings().company, mva_rate: settings().invoice.mva };
  }
  function invoicePdf(d, res) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Faktura ${d.no}`, Author: d.company.name, Creator: 'mondo' } });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="faktura-${d.no}.pdf"`); doc.pipe(res);
    const c = d.company; const W = 495;
    doc.rect(0, 0, 595, 8).fill('#0073ea');
    doc.fillColor('#323338').font('Helvetica-Bold').fontSize(22).text(c.name, 50, 45);
    doc.font('Helvetica').fontSize(9).fillColor('#676879').text([c.address, c.postal, c.phone, c.email, c.web, c.orgnr].filter(Boolean).join('\n'), 50, 75);
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#0073ea').text('FAKTURA', 50, 45, { width: W, align: 'right' });
    const meta = [['Fakturanr', d.no], ['Fakturadato', d.date], ['Forfallsdato', d.due], ['KID', d.kid], ['Kontonr', c.account], ['Kundenr', d.customer.nr]];
    meta.forEach(([k, v], n) => { doc.font('Helvetica').fontSize(9).fillColor('#676879').text(k, 340, 85 + n * 15, { width: 80 }); doc.font('Helvetica-Bold').fillColor('#323338').text(v || '—', 420, 85 + n * 15, { width: 125, align: 'right' }); });
    doc.font('Helvetica').fontSize(9).fillColor('#676879').text('Faktura til', 50, 175);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#323338').text(d.customer.name, 50, 188);
    doc.font('Helvetica').fontSize(10).text([d.customer.address, d.customer.phone, d.email].filter(Boolean).join('\n'), 50, 204);
    let y = 280; doc.rect(50, y, W, 22).fill('#f5f6f8'); doc.fillColor('#323338').font('Helvetica-Bold').fontSize(9);
    const cols = [[50 + 8, 'Beskrivelse', 230, 'left'], [290, 'Antall', 40, 'right'], [335, 'Pris eks. mva', 80, 'right'], [420, `MVA ${d.mva_rate} %`, 55, 'right'], [480, 'Sum', 57, 'right']];
    cols.forEach(([x, t, w, a]) => doc.text(t, x, y + 7, { width: w, align: a }));
    y += 30; doc.font('Helvetica').fontSize(10);
    [[d.line, '1', kr(d.eks), kr(d.mva), kr(d.total)]].forEach((r) => { r.forEach((t, k) => doc.text(t, cols[k][0], y, { width: cols[k][2], align: cols[k][3] })); y += 34; });
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e6e9ef').stroke(); y += 12;
    [['Sum eks. mva', kr(d.eks)], [`MVA ${d.mva_rate} %`, kr(d.mva)]].forEach(([k, v]) => { doc.fontSize(10).fillColor('#676879').text(k, 335, y, { width: 140, align: 'right' }); doc.fillColor('#323338').text(v, 480, y, { width: 57, align: 'right' }); y += 16; });
    doc.rect(330, y + 2, 215, 28).fill('#0073ea'); doc.fillColor('#fff').font('Helvetica-Bold').fontSize(13).text('Å betale', 340, y + 10); doc.text(kr(d.total), 420, y + 10, { width: 117, align: 'right' }); y += 60;
    doc.fillColor('#323338').font('Helvetica').fontSize(10).text(`Betal til konto ${c.account} med KID ${d.kid} innen ${d.due}.`, 50, y, { width: W });
    doc.text('Du kan også betale med Vipps eller kort via betalingslenken du har fått (når betaling er aktivert).', 50, y + 16, { width: W });
    doc.fontSize(8).fillColor('#9699a6').text('DEMO-FAKTURA – firmaopplysninger i [klammer] er plassholdere. Endre dem under Dekkhotell > Oppsett. EHF/regnskap (Fiken/Tripletex/PowerOffice) er ikke koblet til ennå.', 50, 770, { width: W, align: 'center' });
    doc.end();
  }
  function markPaid(id, method) {
    const fb = B('faktura'); const cS = C(fb, 'faktura', 'Status'), cM = C(fb, 'faktura', 'Betalingsmåte');
    setVals(id, { [cS.id]: label(cS, 'Betalt'), ...(method ? { [cM.id]: label(cM, method) } : {}) }); runAutomations(fb.id, id, 'change', { [cS.id]: label(cS, 'Betalt') }); touch(fb.id);
    const d = invoiceData(id); notify('p_simon', `💳 Faktura ${d.no} betalt (${method || 'manuelt'})`, fb.id, id);
    const bb = B('bookinger'); const bkId = (itemRow(db.prepare('select * from items where id=?').get(id)).vals[C(fb, 'faktura', 'Booking').id] || [])[0];
    if (bkId) { const cB = C(bb, 'bookinger', 'Betaling'); setVals(bkId, { [cB.id]: label(cB, method === 'Vipps' ? 'Betalt Vipps' : method === 'Kort (Stripe)' ? 'Betalt kort' : 'Betalt') }); }
  }

  // automation hook: dk_invoice (booking → Ferdig), dk_confirm (booking → Bekreftet)
  function action(type, b, i) {
    try {
      if (type === 'dk_invoice') createInvoice(b, i);
      if (type === 'dk_confirm') {
        const g = (t) => i.vals[C(b, 'bookinger', t)?.id]; const s = settings();
        const svc = labelName(C(b, 'bookinger', 'Tjeneste'), g('Tjeneste')) || 'Time';
        const text = `Timen din er bekreftet: ${svc} ${g('Dato') ? nbDate(g('Dato')) : ''} kl ${g('Tid') || ''} hos ${s.company.name}. Regnr ${g('Regnr') || ''}. Husk låsebolt hvis du har det. Ref ${g('Bookingref') || ''}.`;
        if (g('Mobil')) outbox({ kind: 'sms', to: g('Mobil'), body: text, board_id: b.id, item_id: i.id });
        if (g('E-post')) outbox({ kind: 'email', to: g('E-post'), subject: `Bekreftet: ${svc} ${g('Dato') || ''} kl ${g('Tid') || ''}`, body: text, board_id: b.id, item_id: i.id });
      }
    } catch (e) { console.error('dekk action', e); }
  }

  // ---------- routes ----------
  const aw = (fn) => async (req, res) => { try { const r = await fn(req, res); if (r !== undefined) res.json(r); } catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.message }); } };
  const hits = new Map(); const limit = (req, max) => { const k = req.ip; const h = (hits.get(k) || []).filter((t) => t > Date.now() - 3600e3); h.push(Date.now()); hits.set(k, h); if (h.length > max) throw Object.assign(new Error('For mange forsøk – prøv igjen senere'), { status: 429 }); };
  const adminOnly = (req) => { if (req.user?.role !== 'admin') throw Object.assign(new Error('Bare administrator'), { status: 403 }); };
  const payInfo = () => ({ stripe: { active: stripeOn(), test: (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_') }, vipps: { active: vippsOn(), test: process.env.VIPPS_ENV !== 'production' }, pickup: true });

  function routes(app) {
    // public booking
    app.get('/api/book/config', aw(() => { const s = settings(); const n = osloNow(); return { company: s.company.name, services: s.services, capacity: { slot: s.capacity.slot, days_ahead: s.capacity.days_ahead, hours: s.capacity.hours, closed: s.capacity.closed }, today: n.date, ready: !!B('bookinger') }; }));
    app.get('/api/book/slots', aw((req) => ({ date: req.query.date, slots: slots(String(req.query.date || ''), String(req.query.service || '')) })));
    app.get('/api/book/days', aw((req) => { const s = settings(); const n = osloNow(); const out = []; for (let k = 0; k <= s.capacity.days_ahead; k++) { const d = addDays(n.date, k); const sl = slots(d, String(req.query.service || '')); out.push({ date: d, text: nbDate(d), free: sl.filter((x) => x.free > 0).length }); } return { days: out }; }));
    app.get('/api/book/regnr/:nr', aw(async (req) => { limit(req, 120); const r = normReg(req.params.nr); return r.length < 2 ? { found: false } : regLookup(r); }));
    app.post('/api/book/create', aw((req) => { limit(req, 20); return createBooking(req.body || {}); }));

    // settings + admin
    app.get('/api/dekk/settings', aw(() => ({ settings: settings(), integrations: integrations() })));
    app.put('/api/dekk/settings', aw((req) => { adminOnly(req); const cur = settings(); const b = req.body || {}; const next = { ...cur };
      if (b.company) next.company = { ...cur.company, ...b.company };
      if (Array.isArray(b.services)) next.services = b.services.filter((x) => x && x.name).map((x, k) => ({ id: String(x.id || 's' + k).replace(/\W/g, '_'), name: String(x.name).slice(0, 60), minutes: Math.max(5, +x.minutes || 30), price: Math.max(0, +x.price || 0), icon: String(x.icon || '🔧').slice(0, 4), desc: String(x.desc || '').slice(0, 200) }));
      if (b.capacity) next.capacity = { ...cur.capacity, ...b.capacity, lifts: Math.max(1, Math.min(20, +(b.capacity.lifts ?? cur.capacity.lifts))), slot: Math.max(5, +(b.capacity.slot ?? cur.capacity.slot)) };
      if (b.invoice) next.invoice = { ...cur.invoice, due_days: +(b.invoice.due_days ?? cur.invoice.due_days), mva: +(b.invoice.mva ?? cur.invoice.mva) };
      // make sure every service exists as a Tjeneste label on Bookinger (so the board stays editable + in sync)
      const bb = B('bookinger'); if (bb) { const cT = C(bb, 'bookinger', 'Tjeneste'); const missing = next.services.filter((x) => !label(cT, x.name)); if (missing.length) { const cols = bb.columns.map((c) => (c.id === cT.id ? { ...c, settings: { ...c.settings, labels: [...c.settings.labels.filter((l) => l.label), ...missing.map((x) => ({ id: 'l_' + crypto.randomBytes(3).toString('hex'), label: x.name, color: '#0086c0' })), { id: 'l_' + crypto.randomBytes(3).toString('hex'), label: '', color: '#c4c4c4' }] } } : c)); db.prepare('update boards set columns=? where id=?').run(JSON.stringify(cols), bb.id); } }
      saveSettings(next); return { settings: next, integrations: integrations() }; }));
    app.get('/api/dekk/invoices', aw(() => { const fb = B('faktura'); if (!fb) return { invoices: [] }; return { board_id: fb.id, invoices: items(fb).map((i) => ({ ...invoiceData(i.id), pay_url: '/#/betal/' + payToken(i.id) })).sort((a, b) => +b.no - +a.no) }; }));
    app.get('/api/dekk/invoice/:id.pdf', aw((req, res) => { const d = invoiceData(req.params.id); if (!d) return res.status(404).json({ error: 'not found' }); invoicePdf(d, res); }));
    app.post('/api/dekk/invoice/:id/email', aw((req, res) => {
      const d = invoiceData(req.params.id); if (!d) return res.status(404).json({ error: 'not found' });
      const pay = baseUrl(req) + '/#/betal/' + payToken(d.id);
      const body = `Hei ${d.customer.name.split(' ')[0]}!\n\nVedlagt er faktura ${d.no} fra ${d.company.name} på ${kr(d.total)} (inkl. mva ${kr(d.mva)}).\nForfall: ${d.due}. KID: ${d.kid}. Kontonr: ${d.company.account}.\n\nBetal enkelt med Vipps eller kort: ${pay}\n\nMed vennlig hilsen\n${d.company.name}`;
      const oid = outbox({ kind: 'email', to: d.email, subject: `Faktura ${d.no} fra ${d.company.name}`, body, attachment: `faktura-${d.no}.pdf`, board_id: B('faktura').id, item_id: d.id });
      log(B('faktura').id, d.id, '✉️ E-postutkast laget (ikke sendt)');
      return { ok: true, sent: false, draft: db.prepare('select * from dk_outbox where id=?').get(oid), note: smtpOn() ? 'SMTP er satt opp, men automatisk sending er slått av i denne versjonen – utkastet er lagret.' : 'Ikke sendt: SMTP er ikke satt opp. Utkastet er lagret i Utboks.' };
    }));
    app.post('/api/dekk/invoice/:id/paid', aw((req, res) => { if (!invoiceData(req.params.id)) return res.status(404).json({ error: 'not found' }); markPaid(req.params.id, req.body?.method || null); return { ok: true }; }));
    app.get('/api/dekk/outbox', aw(() => ({ outbox: db.prepare('select * from dk_outbox order by id desc limit 100').all() })));
    app.get('/api/dekk/booking-qr.svg', aw(async (req, res) => { const svg = await QR.toString(baseUrl(req) + '/book', { type: 'svg', margin: 1, color: { dark: '#323338' } }); res.type('image/svg+xml').send(svg); }));

    // public payment page
    const inv = (req) => { const id = fromToken(req.params.token); const d = id && invoiceData(id); if (!d) throw Object.assign(new Error('Ukjent betalingslenke'), { status: 404 }); return d; };
    app.get('/api/pay/:token', aw((req) => { const d = inv(req); return { no: d.no, total: d.total, mva: d.mva, due: d.due, status: d.status, company: d.company.name, line: d.line, kid: d.kid, account: d.company.account, methods: payInfo() }; }));
    app.get('/api/pay/:token/pdf', aw((req, res) => invoicePdf(inv(req), res)));
    app.post('/api/pay/:token/pickup', aw((req) => { limit(req, 30); const d = inv(req); const fb = B('faktura'); const cM = C(fb, 'faktura', 'Betalingsmåte'); setVals(d.id, { [cM.id]: label(cM, 'Ved henting') });
      const bk = (itemRow(db.prepare('select * from items where id=?').get(d.id)).vals[C(fb, 'faktura', 'Booking').id] || [])[0]; const bb = B('bookinger'); if (bk) { const cB = C(bb, 'bookinger', 'Betaling'); setVals(bk, { [cB.id]: label(cB, 'Betales ved henting') }); }
      log(fb.id, d.id, '🏪 Kunden valgte å betale ved henting'); touch(fb.id); return { ok: true }; }));
    const inactive = (what, env) => Object.assign(new Error(`${what} er ikke aktiv ennå – legg inn ${env} (testnøkler først).`), { status: 503 });
    app.post('/api/pay/:token/stripe', aw(async (req) => {
      limit(req, 30); const d = inv(req); if (!stripeOn()) throw inactive('Kortbetaling (Stripe)', 'STRIPE_SECRET_KEY');
      if (d.status === 'Betalt') return { paid: true };
      const back = baseUrl(req) + '/#/betal/' + req.params.token;
      const f = new URLSearchParams({ mode: 'payment', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'nok', 'line_items[0][price_data][unit_amount]': String(Math.round(d.total * 100)), 'line_items[0][price_data][product_data][name]': `Faktura ${d.no} – ${d.company.name}`, success_url: back + '?stripe={CHECKOUT_SESSION_ID}', cancel_url: back, 'metadata[invoice]': d.id, ...(d.email ? { customer_email: d.email } : {}) });
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: f });
      const j = await r.json(); if (!r.ok) throw Object.assign(new Error('Stripe: ' + (j.error?.message || r.status)), { status: 502 }); return { url: j.url };
    }));
    app.post('/api/pay/:token/stripe/confirm', aw(async (req) => {
      const d = inv(req); if (!stripeOn()) throw inactive('Kortbetaling (Stripe)', 'STRIPE_SECRET_KEY');
      const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(String(req.body?.session_id || '')), { headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY } }); const j = await r.json();
      if (r.ok && j.payment_status === 'paid' && j.metadata?.invoice === d.id) { if (d.status !== 'Betalt') markPaid(d.id, 'Kort (Stripe)'); return { paid: true }; } return { paid: false };
    }));
    const vippsHeaders = async () => {
      const t = await fetch(vippsBase() + '/accesstoken/get', { method: 'POST', headers: { client_id: process.env.VIPPS_CLIENT_ID, client_secret: process.env.VIPPS_CLIENT_SECRET, 'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY, 'Merchant-Serial-Number': process.env.VIPPS_MSN } });
      const tj = await t.json(); if (!t.ok) throw Object.assign(new Error('Vipps innlogging feilet'), { status: 502 });
      return { Authorization: 'Bearer ' + tj.access_token, 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUBSCRIPTION_KEY, 'Merchant-Serial-Number': process.env.VIPPS_MSN, 'Vipps-System-Name': 'mondo', 'Vipps-System-Version': '1.0' };
    };
    app.post('/api/pay/:token/vipps', aw(async (req) => {
      limit(req, 30); const d = inv(req); if (!vippsOn()) throw inactive('Vipps', 'VIPPS_CLIENT_ID, VIPPS_CLIENT_SECRET, VIPPS_SUBSCRIPTION_KEY og VIPPS_MSN');
      if (d.status === 'Betalt') return { paid: true };
      const ref = `mondo-${d.no}-${crypto.randomBytes(3).toString('hex')}`; const h = await vippsHeaders();
      const r = await fetch(vippsBase() + '/epayment/v1/payments', { method: 'POST', headers: { ...h, 'Idempotency-Key': ref }, body: JSON.stringify({ amount: { currency: 'NOK', value: Math.round(d.total * 100) }, paymentMethod: { type: 'WALLET' }, reference: ref, userFlow: 'WEB_REDIRECT', returnUrl: baseUrl(req) + '/#/betal/' + req.params.token + '?vipps=' + ref, paymentDescription: `Faktura ${d.no} – ${d.company.name}` }) });
      const j = await r.json(); if (!r.ok) throw Object.assign(new Error('Vipps: ' + (j.title || j.detail || r.status)), { status: 502 }); return { url: j.redirectUrl };
    }));
    app.post('/api/pay/:token/vipps/confirm', aw(async (req) => {
      const d = inv(req); if (!vippsOn()) throw inactive('Vipps', 'VIPPS_* nøkler'); const ref = String(req.body?.reference || '');
      if (!ref.startsWith(`mondo-${d.no}-`)) return { paid: false };
      const h = await vippsHeaders(); const r = await fetch(vippsBase() + '/epayment/v1/payments/' + encodeURIComponent(ref), { headers: h }); const j = await r.json();
      if (j.state === 'AUTHORIZED') { const c = await fetch(vippsBase() + `/epayment/v1/payments/${encodeURIComponent(ref)}/capture`, { method: 'POST', headers: { ...h, 'Idempotency-Key': ref + '-cap' }, body: JSON.stringify({ modificationAmount: j.amount }) }); if (c.ok) { markPaid(d.id, 'Vipps'); return { paid: true }; } }
      return { paid: false, state: j.state };
    }));
  }
  function integrations() {
    return [
      { key: 'stripe', name: 'Stripe Checkout (kort)', active: stripeOn(), env: 'STRIPE_SECRET_KEY (sk_test_… først)', docs: 'https://docs.stripe.com/checkout/quickstart' },
      { key: 'vipps', name: 'Vipps ePayment', active: vippsOn(), env: 'VIPPS_CLIENT_ID, VIPPS_CLIENT_SECRET, VIPPS_SUBSCRIPTION_KEY, VIPPS_MSN, VIPPS_ENV=test', docs: 'https://developer.vippsmobilepay.com/docs/APIs/epayment-api/' },
      { key: 'smtp', name: 'E-post (SMTP)', active: smtpOn(), env: 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM', note: 'Bare utkast – sending er slått av', docs: '' },
      { key: 'sms', name: 'SMS (f.eks. Link Mobility / Sveve)', active: false, env: 'SMS_PROVIDER, SMS_API_KEY', note: 'Bare utkast', docs: '' },
      { key: 'vegvesen', name: 'Regnr-oppslag (Statens vegvesen)', active: !!process.env.VEGVESEN_API_KEY, env: 'VEGVESEN_API_KEY', docs: 'https://www.vegvesen.no/fag/teknologi/apne-data/et-utvalg-apne-data/api-for-tekniske-kjoretoyopplysninger/' },
      { key: 'regnskap', name: 'Regnskap / EHF (Fiken, Tripletex, PowerOffice)', active: false, env: 'FIKEN_TOKEN eller TRIPLETEX_CONSUMER_TOKEN + TRIPLETEX_EMPLOYEE_TOKEN', note: 'Ikke bygget ennå – status-kolonnen «Regnskap» er klar', docs: 'https://developer.tripletex.no' },
    ];
  }
  return { routes, action, settings, saveSettings, createInvoice, createBooking, slots, B, C, label, payToken, defaultSettings };
};
