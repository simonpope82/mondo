// 🛞 Dekkhotell control page (#/dekk): boards, booking link + QR, settings (company / services / capacity), invoices, outbox, integrations.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { TyreSet, Daily, Customers, TyreLabels, Rules } from './Staff.jsx';
import { CalendarDays, Users, Car, Warehouse, Receipt, Settings, Mail, Plug, Link2, FileText, Send, CreditCard, Check, Plus, Trash2, ExternalLink, Globe, Inbox, Printer } from 'lucide-react';

const BOARDS = [['bookinger', 'Bookinger', CalendarDays, '#579bfc'], ['kunder', 'Kunder', Users, '#00c875'], ['kjoretoy', 'Kjøretøy', Car, '#fdab3d'], ['lager', 'Dekkhotell lager', Warehouse, '#784bd1'], ['faktura', 'Fakturaer', Receipt, '#ff6d3b']];
const TABS = [['dagen', 'I dag', CalendarDays], ['oversikt', 'Oversikt', Link2], ['kunder', 'Kunder', Users], ['etiketter', 'QR-etiketter', Printer], ['nettside', 'Nettside & chat', Globe], ['epost', 'E-post inn', Inbox], ['fakturaer', 'Fakturaer', Receipt], ['utboks', 'Utboks', Mail], ['oppsett', 'Oppsett', Settings], ['integrasjoner', 'Betaling & nøkler', Plug]];
const DAYS = [[1, 'Man'], [2, 'Tir'], [3, 'Ons'], [4, 'Tor'], [5, 'Fre'], [6, 'Lør'], [0, 'Søn']];
const kr = (n) => (+n || 0).toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' kr';

export default function DekkAdmin({ hash, user }) {
  const tab = hash.split('/')[2] || 'dagen';
  const [d, setD] = useState(null); const [inv, setInv] = useState([]); const [out, setOut] = useState([]); const [msg, setMsg] = useState('');
  const load = () => { api.get('/dekk/settings').then(setD); api.get('/dekk/invoices').then((r) => setInv(r.invoices)); api.get('/dekk/outbox').then((r) => setOut(r.outbox)); };
  useEffect(load, []);
  if (!d) return <div className="dk-page">Laster…</div>;
  const s = d.settings; const bookUrl = window.location.origin + '/book';
  const save = async (patch) => { const r = await api.put('/dekk/settings', patch); setD(r); setMsg('✅ Lagret'); setTimeout(() => setMsg(''), 2000); };
  const email = async (id) => { const r = await api.post(`/dekk/invoice/${id}/email`); setMsg('✉️ ' + r.note); load(); };
  const paid = async (id) => { await api.post(`/dekk/invoice/${id}/paid`, { method: null }); load(); };
  return (
    <div className="dk-page" data-testid="dekk-admin">
      {tab !== 'hjulsett' && <h1 className="dk-title">🛞 Dekkhotell</h1>}
      {tab === 'hjulsett' ? <a className="dk-btn" href="#/dekk/dagen" style={{ marginBottom: 12 }}>← I dag</a> : <div className="dk-tabs">{TABS.map(([k, t, I]) => <a key={k} href={'#/dekk/' + k} data-testid={'dk-tab-' + k} className={'dk-tab' + (tab === k ? ' on' : '')}><I size={18} /> {t}</a>)}</div>}
      {msg && <div className="dk-msg" data-testid="dk-msg">{msg}</div>}
      {tab === 'oversikt' && <>
        <div className="dk-tiles">{BOARDS.map(([k, t, I, c]) => s.boards[k] && <a key={k} className="dk-tile" href={'#/board/' + s.boards[k]} style={{ '--c': c }}><I size={34} /><b>{t}</b></a>)}</div>
        <div className="dk-box dk-booklink">
          <img src="/api/dekk/booking-qr.svg" alt="QR til bookingsiden" width={120} height={120} />
          <div><h3>🌐 Bookingside for kunder</h3><a href="/book" target="_blank" rel="noreferrer" data-testid="dk-booklink">{bookUrl}</a>
            <p className="muted">Del lenken på nettside, Google, Facebook og i SMS-innkallingen. Kundene velger tjeneste, regnr og ledig tid – bookingen havner på <b>Bookinger</b> som «Bestilt».</p></div>
        </div>
        <div className="dk-box"><h3>⚡ Slik flyter det</h3><ol className="dk-flow">
          <li><b>Bestilt</b> – fra nettbooking (kunde + bil lages/kobles automatisk)</li><li><b>Bekreftet</b> → varsel + SMS/e-post-utkast i Utboks</li><li><b>Møtt</b> → registrer hjulsett på Dekkhotell lager (QR-etikett)</li><li><b>Ferdig</b> → faktura lages automatisk + betalingslenke</li><li><b>Sesongbytte</b>-dato på hjulsett → varsel 3 uker før: send innkalling</li></ol></div>
      </>}
      {tab === 'fakturaer' && <div className="dk-box">
        <table className="dk-table" data-testid="dk-invoices"><thead><tr><th>Nr</th><th>Kunde</th><th>Totalt</th><th>Forfall</th><th>Status</th><th></th></tr></thead><tbody>
          {inv.map((i) => <tr key={i.id}><td>{i.no}</td><td>{i.customer.name}</td><td>{kr(i.total)}</td><td>{i.due}</td><td><span className={'dk-st st-' + i.status}>{i.status}</span></td>
            <td className="dk-acts"><a className="dk-btn" href={`/api/dekk/invoice/${i.id}.pdf`} target="_blank" rel="noreferrer" data-testid="dk-pdf"><FileText size={16} /> PDF</a>
              <button className="dk-btn" onClick={() => email(i.id)} data-testid="dk-email"><Send size={16} /> E-postutkast</button>
              <a className="dk-btn" href={i.pay_url} target="_blank" rel="noreferrer"><CreditCard size={16} /> Betal-lenke</a>
              {i.status !== 'Betalt' && <button className="dk-btn" onClick={() => paid(i.id)}><Check size={16} /> Betalt</button>}</td></tr>)}
          {!inv.length && <tr><td colSpan={6} className="muted">Ingen fakturaer ennå – sett en booking til «Ferdig».</td></tr>}
        </tbody></table></div>}
      {tab === 'utboks' && <div className="dk-box"><p className="muted">📭 Ingenting sendes automatisk. Dette er utkast (SMS og e-post) som er klare når SMS/SMTP er satt opp.</p>
        {out.map((o) => <div key={o.id} className="dk-mail" data-testid="dk-outbox-item"><div className="dk-mail-h"><b>{o.kind === 'sms' ? '💬 SMS' : o.kind === 'question' ? '❓ Spørsmål fra nettsiden' : '✉️ E-post'}</b> til {o.to_addr || '—'} <span className="dk-st">{o.status}</span></div>{o.subject && <div><b>{o.subject}</b></div>}<pre>{o.body}</pre>{o.attachment && <div className="muted">📎 {o.attachment}</div>}</div>)}
        {!out.length && <div className="muted">Tom</div>}</div>}
      {tab === 'hjulsett' && <TyreSet code={hash.split('/')[3]} />}
      {tab === 'dagen' && <Daily />}
      {tab === 'kunder' && <Customers boards={s.boards} admin={user?.role === 'admin'} />}
      {tab === 'etiketter' && <TyreLabels boards={s.boards} />}
      {tab === 'epost' && <MailIn admin={user?.role === 'admin'} setMsg={setMsg} />}
      {tab === 'nettside' && <SiteEdit admin={user?.role === 'admin'} setMsg={setMsg} />}
      {tab === 'oppsett' && <><Setup s={s} save={save} admin={user?.role === 'admin'} /><Rules admin={user?.role === 'admin'} setMsg={setMsg} /></>}
      {tab === 'integrasjoner' && <div className="dk-box"><p className="muted">Nøkler legges inn som miljøvariabler (Render → Environment). Ingen ekte nøkler ligger i koden. Bruk testmodus først.</p>
        <div className="dk-ints">{d.integrations.map((x) => <div key={x.key} className={'dk-int' + (x.active ? ' on' : '')} data-testid={'dk-int-' + x.key}>
          <div className="dk-int-h"><b>{x.name}</b><span className={'dk-badge' + (x.active ? ' on' : '')}>{x.active ? 'Aktiv' : 'Ikke aktiv'}</span></div>
          <code>{x.env}</code>{x.note && <div className="muted">{x.note}</div>}{x.docs && <a href={x.docs} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Dokumentasjon</a>}</div>)}</div></div>}
    </div>
  );
}

function Setup({ s, save, admin }) {
  const [c, setC] = useState(s.company); const [sv, setSv] = useState(s.services); const [cap, setCap] = useState(s.capacity); const [iv, setIv] = useState(s.invoice); const [ad, setAd] = useState(s.addons || []); const [auto, setAuto] = useState(s.booking?.auto_confirm !== false);
  const dis = !admin;
  return <>
    {!admin && <div className="dk-msg">Bare administrator kan endre oppsettet.</div>}
    <div className="dk-box"><h3>🏢 Firma (vises på faktura)</h3><div className="dk-grid">
      {[['name', 'Firmanavn'], ['orgnr', 'Org.nr'], ['address', 'Adresse'], ['postal', 'Postnr / sted'], ['phone', 'Telefon'], ['email', 'E-post'], ['account', 'Kontonr'], ['web', 'Nettside']].map(([k, t]) => <label key={k}><span>{t}</span><input disabled={dis} value={c[k] || ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></label>)}
    </div><button className="dk-save" disabled={dis} onClick={() => save({ company: c })}>Lagre firma</button></div>
    <div className="dk-box"><h3>🔧 Tjenester (vises på bookingsiden)</h3>
      <table className="dk-table"><thead><tr><th>Ikon</th><th>Navn</th><th>Min</th><th>Pris</th><th>Beskrivelse</th><th></th></tr></thead><tbody>
        {sv.map((x, k) => { const u = (p) => setSv(sv.map((y, j) => (j === k ? { ...y, ...p } : y))); return <tr key={k}>
          <td><input disabled={dis} className="dk-ico" value={x.icon} onChange={(e) => u({ icon: e.target.value })} /></td><td><input disabled={dis} value={x.name} onChange={(e) => u({ name: e.target.value })} /></td>
          <td><input disabled={dis} type="number" className="dk-num" value={x.minutes} onChange={(e) => u({ minutes: +e.target.value })} /></td><td><input disabled={dis} type="number" className="dk-num" value={x.price} onChange={(e) => u({ price: +e.target.value })} /></td>
          <td><input disabled={dis} value={x.desc} onChange={(e) => u({ desc: e.target.value })} /></td><td><button disabled={dis} className="dk-btn" onClick={() => setSv(sv.filter((_, j) => j !== k))}><Trash2 size={16} /></button></td></tr>; })}
      </tbody></table>
      <button className="dk-btn" disabled={dis} onClick={() => setSv([...sv, { id: 'ny' + Date.now(), name: 'Ny tjeneste', minutes: 30, price: 500, icon: '🔧', desc: '' }])}><Plus size={16} /> Ny tjeneste</button>
      <button className="dk-save" disabled={dis} onClick={() => save({ services: sv })}>Lagre tjenester</button>
      <p className="muted">Nye tjenester legges også til som etikett i «Tjeneste» på Bookinger.</p></div>
    <div className="dk-box"><h3>➕ Tillegg (kunden kan krysse av)</h3>
      <table className="dk-table"><thead><tr><th>Ikon</th><th>Navn</th><th>+ Min</th><th>+ Pris</th><th></th></tr></thead><tbody>
        {ad.map((x, k) => { const u = (p) => setAd(ad.map((y, j) => (j === k ? { ...y, ...p } : y))); return <tr key={k}>
          <td><input disabled={dis} className="dk-ico" value={x.icon} onChange={(e) => u({ icon: e.target.value })} /></td><td><input disabled={dis} value={x.name} onChange={(e) => u({ name: e.target.value })} /></td>
          <td><input disabled={dis} type="number" className="dk-num" value={x.minutes} onChange={(e) => u({ minutes: +e.target.value })} /></td><td><input disabled={dis} type="number" className="dk-num" value={x.price} onChange={(e) => u({ price: +e.target.value })} /></td>
          <td><button disabled={dis} className="dk-btn" onClick={() => setAd(ad.filter((_, j) => j !== k))}><Trash2 size={16} /></button></td></tr>; })}
      </tbody></table>
      <button className="dk-btn" disabled={dis} onClick={() => setAd([...ad, { id: 'a' + Date.now(), name: 'Nytt tillegg', minutes: 0, price: 100, icon: '➕' }])}><Plus size={16} /> Nytt tillegg</button>
      <button className="dk-save" disabled={dis} onClick={() => save({ addons: ad })} data-testid="dk-save-addons">Lagre tillegg</button>
      <label className="bk-check"><input disabled={dis} type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); save({ booking: { auto_confirm: e.target.checked } }); }} /> ✅ Bekreft nettbookinger automatisk (når et løft er ledig)</label></div>
    <div className="dk-box"><h3>🏗️ Kapasitet</h3><div className="dk-grid">
      <label><span>Antall løft / plasser</span><input disabled={dis} type="number" data-testid="dk-lifts" value={cap.lifts} onChange={(e) => setCap({ ...cap, lifts: +e.target.value })} /></label>
      <label><span>Tidsluke (min)</span><input disabled={dis} type="number" value={cap.slot} onChange={(e) => setCap({ ...cap, slot: +e.target.value })} /></label>
      <label><span>Dager frem i tid</span><input disabled={dis} type="number" value={cap.days_ahead} onChange={(e) => setCap({ ...cap, days_ahead: +e.target.value })} /></label>
      <label><span>Minste varsel (min)</span><input disabled={dis} type="number" value={cap.min_notice_min} onChange={(e) => setCap({ ...cap, min_notice_min: +e.target.value })} /></label>
    </div>
      <div className="dk-hours">{DAYS.map(([n, t]) => { const h = cap.hours[n]; const set = (v) => setCap({ ...cap, hours: { ...cap.hours, [n]: v } }); return <div key={n} className="dk-hour"><b>{t}</b>
        <label className="bk-check"><input disabled={dis} type="checkbox" checked={!!h} onChange={(e) => set(e.target.checked ? ['08:00', '16:00'] : null)} /> Åpent</label>
        {h && <><input disabled={dis} type="time" value={h[0]} onChange={(e) => set([e.target.value, h[1]])} /> – <input disabled={dis} type="time" value={h[1]} onChange={(e) => set([h[0], e.target.value])} /></>}</div>; })}</div>
      <label className="dk-closed"><span>Stengte dager (ÅÅÅÅ-MM-DD, komma)</span><input disabled={dis} value={(cap.closed || []).join(', ')} onChange={(e) => setCap({ ...cap, closed: e.target.value.split(/[,\s]+/).filter(Boolean) })} /></label>
      <button className="dk-save" disabled={dis} onClick={() => save({ capacity: cap })} data-testid="dk-save-cap">Lagre kapasitet</button>
      <p className="muted">Ledige tider = løft × åpningstid ÷ varighet. En time bruker ett løft hele varigheten.</p></div>
    <div className="dk-box"><h3>🧾 Faktura</h3><div className="dk-grid">
      <label><span>Betalingsfrist (dager)</span><input disabled={dis} type="number" value={iv.due_days} onChange={(e) => setIv({ ...iv, due_days: +e.target.value })} /></label>
      <label><span>MVA %</span><input disabled={dis} type="number" value={iv.mva} onChange={(e) => setIv({ ...iv, mva: +e.target.value })} /></label></div>
      <button className="dk-save" disabled={dis} onClick={() => save({ invoice: iv })}>Lagre faktura</button><p className="muted">Priser på tjenester er inkl. mva.</p></div>
  </>;
}

// ---------- 🌐 Nettside & chat editor ----------
const SLUG = 'web-bil';
function SiteEdit({ admin, setMsg }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.get('/dekk/site/' + SLUG).then(setS); }, []);
  if (!s) return <div className="dk-box">Laster…</div>;
  const dis = !admin; const u = (p) => setS({ ...s, ...p });
  const save = async () => { setS(await api.put('/dekk/site/' + SLUG, s)); setMsg('✅ Nettsiden er lagret'); setTimeout(() => setMsg(''), 2500); };
  const F = ({ k, t, area }) => <label><span>{t}</span>{area ? <textarea disabled={dis} rows={3} defaultValue={s[k]} onBlur={(e) => u({ [k]: e.target.value })} /> : <input disabled={dis} defaultValue={s[k]} onBlur={(e) => u({ [k]: e.target.value })} />}</label>;
  const List = ({ k, fields, add }) => <><table className="dk-table"><tbody>{s[k].map((x, i) => <tr key={i + (x.id || x.title || x.name || x.day || '')}>
    {fields.map(([f, w]) => <td key={f} style={{ width: w }}>{f === 'a' ? <textarea disabled={dis} rows={2} defaultValue={x[f]} onBlur={(e) => u({ [k]: s[k].map((y, j) => (j === i ? { ...y, [f]: e.target.value } : y)) })} className={/^\s*\[/.test(x[f]) ? 'dk-ph' : ''} />
      : <input disabled={dis} defaultValue={x[f]} placeholder={f} onBlur={(e) => u({ [k]: s[k].map((y, j) => (j === i ? { ...y, [f]: e.target.value } : y)) })} className={/^\s*\[/.test(x[f]) ? 'dk-ph' : ''} />}</td>)}
    <td style={{ width: 40 }}><button disabled={dis} className="dk-btn" onClick={() => u({ [k]: s[k].filter((_, j) => j !== i) })}><Trash2 size={16} /></button></td></tr>)}</tbody></table>
    <button className="dk-btn" disabled={dis} onClick={() => u({ [k]: [...s[k], add()] })}><Plus size={16} /> Legg til</button></>;
  return <>
    <div className="dk-box dk-booklink"><div><h3>🌐 {s.full_name}</h3><a href={'/' + SLUG} target="_blank" rel="noreferrer" data-testid="dk-sitelink">{window.location.origin}/{SLUG}</a>
      <p className="muted">🟨 Gule felt / [klammer] = plassholdere som må fylles inn. Trykk <b>Lagre nettside</b> etterpå.</p></div>
      <button className="dk-save" disabled={dis} onClick={save} data-testid="dk-save-site">Lagre nettside</button></div>
    <div className="dk-box"><h3>✏️ Tekster</h3><div className="dk-grid">
      <F k="eyebrow" t="Liten tekst over overskrift" /><F k="hero_image" t="Hovedbilde (URL)" /><F k="hotel_title" t="Dekkhotell: overskrift" /><F k="hotel_text" t="Dekkhotell: tekst" area /><F k="hotel_image" t="Dekkhotell: bilde (URL)" /><F k="rating" t="Vurdering (omtaler)" /><F k="name" t="Kort navn" /><F k="full_name" t="Fullt navn" /><F k="hero_title" t="Stor overskrift" /><F k="hero_text" t="Undertekst" area /><F k="about" t="Om oss" area /><F k="price_note" t="Pris-merknad" />
      <F k="phone" t="Telefon" /><F k="email" t="E-post" /><F k="address" t="Adresse" /><F k="postal" t="Postnr / sted" /><F k="area" t="Område" /><F k="directions" t="Veibeskrivelse" area />
      <F k="lat" t="Kart: breddegrad" /><F k="lng" t="Kart: lengdegrad" /><F k="accent" t="Aksentfarge (hex)" /><F k="bot_name" t="Chat-navn" /><F k="bot_hello" t="Chat-hilsen" area />
    </div></div>
    <div className="dk-box"><h3>🔧 Tjenester på siden</h3><List k="services" fields={[['icon', 50], ['title', 160], ['text'], ['price', 140]]} add={() => ({ icon: '🔧', title: 'Ny tjeneste', text: '', price: '[pris – fylles inn]' })} /></div>
    <div className="dk-box"><h3>🌲 Lokalt</h3><F k="local_badge" t="Merke i toppen" /><F k="local_badge_sub" t="Merke: liten tekst" /><F k="local_kicker" t="Lokalt: liten tittel" /><F k="local_title" t="Lokalt: overskrift" /><F k="local_text" t="Lokalt: tekst" area /><F k="local_image" t="Lokalt: bilde (URL)" /><F k="local_cta" t="Lokalt: knappetekst" /><F k="local_places_note" t="Merknad om avstander" /><F k="local_supplier" t="Leverandør/merker (kun hvis sant)" />
      <List k="local_points" fields={[['title', 200], ['text']]} add={() => ({ title: 'Ny', text: '' })} />
      <List k="local_places" fields={[['name', 180], ['dist', 140]]} add={() => ({ name: 'Sted', dist: '[ca. km]' })} /></div>
    <div className="dk-box"><h3>📊 Tall under overskriften</h3><List k="stats" fields={[['value', 200], ['label']]} add={() => ({ value: '[tall]', label: 'Tekst' })} /></div>
    <div className="dk-box"><h3>⭐ Kundeomtaler</h3><List k="reviews" fields={[['text'], ['name', 180], ['stars', 70]]} add={() => ({ text: '[Kundeomtale – fylles inn]', name: '[Navn]', stars: 5 })} /></div>
    <div className="dk-box"><h3>💰 Prisliste</h3><List k="prices" fields={[['name'], ['price', 180]]} add={() => ({ name: 'Ny pris', price: '[kr – fylles inn]' })} /></div>
    <div className="dk-box"><h3>🕗 Åpningstider</h3><List k="hours" fields={[['day', 200], ['time']]} add={() => ({ day: 'Dag', time: '' })} /></div>
    <div className="dk-box" data-testid="dk-faq"><h3>🤖 Chat: spørsmål og svar</h3><p className="muted">Chatten finner svaret ved å se etter ord i spørsmålet og i «stikkord». Svar i [klammer] = ikke besvart ennå – da tilbyr chatten «Send spørsmål».</p>
      <List k="faqs" fields={[['q', 220], ['a'], ['keywords', 220]]} add={() => ({ id: 'f' + Date.now(), q: 'Nytt spørsmål?', a: '[Svar – fylles inn]', keywords: '' })} /></div>
    <button className="dk-save" disabled={dis} onClick={save}>Lagre nettside</button>
  </>;
}

// ---------- 📧 E-post inn ----------
const MISS = { name: 'navn', phone: 'mobil', regnr: 'regnr', date: 'dato', time: 'tid', service: 'tjeneste' };
function MailIn({ admin, setMsg }) {
  const [d, setD] = useState(null); const [c, setC] = useState(null);
  const [t, setT] = useState({ from: 'Ola Test <ola.test@example.com>', subject: 'Dekkskift', text: 'Hei! Kan jeg få skifte til vinterdekk fredag kl 10? Bilen er DM 10004. Ring meg på 400 00 104.\nMvh Per Fiktiv' }); const [pv, setPv] = useState(null);
  const load = () => api.get('/dekk/mail').then((r) => { setD(r); setC(r.config); });
  useEffect(() => { load(); }, []);
  if (!d) return <div className="dk-box">Laster…</div>;
  const dis = !admin;
  const save = async () => { await api.put('/dekk/mail', c); setMsg('✅ Lagret'); load(); };
  const test = async (preview) => { const r = await api.post('/dekk/mail/test', { ...t, preview }); if (preview) setPv(r.parsed); else { setMsg(r.complete ? '✅ Booking laget fra test-e-post' : '⚠️ Laget som «Må sjekkes» – ' + r.why); load(); } };
  return <>
    <div className="dk-box"><h3>📧 Bookinger på e-post → rett inn i mondo</h3>
      <p className="muted">E-post blir lest automatisk. Navn, mobil, regnr, dato, tid og tjeneste hentes ut. Mangler noe → havner i gruppen «📧 E-post – må sjekkes». <b>Vi svarer aldri automatisk.</b></p>
      <div className="dk-grid">
        <label><span>Bedriftens e-post</span><input disabled={dis} data-testid="mail-address" value={c.address} placeholder="[e-post – fylles inn]" onChange={(e) => setC({ ...c, address: e.target.value })} /></label>
        <label><span>Leverandør</span><input disabled={dis} value={c.provider} placeholder="f.eks. Gmail, Outlook, Telenor/online.no" onChange={(e) => setC({ ...c, provider: e.target.value })} /></label>
        <label><span>Sjekk hvert (min)</span><input disabled={dis} type="number" value={c.poll_min} onChange={(e) => setC({ ...c, poll_min: +e.target.value })} /></label>
      </div>
      <label className="bk-check"><input disabled={dis} type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} /> Slå på henting av e-post (IMAP)</label>
      <button className="dk-save" disabled={dis} onClick={save}>Lagre</button></div>
    <div className="dk-ints">
      <div className={'dk-int' + (d.imap.active ? ' on' : '')} data-testid="mail-imap"><div className="dk-int-h"><b>IMAP (leser innboksen)</b><span className={'dk-badge' + (d.imap.active ? ' on' : '')}>{d.imap.active ? 'Nøkler lagt inn' : 'Ikke aktiv'}</span></div>
        <code>IMAP_HOST, IMAP_PORT=993, IMAP_USER, IMAP_PASS (app-passord), IMAP_FOLDER=INBOX</code><div className="muted">Bare lesing. Mailer blir ikke merket, flyttet eller slettet.</div>
        {d.imap.last_poll && <div className="muted">Sist sjekket: {new Date(d.imap.last_poll).toLocaleString('nb-NO')}</div>}{d.imap.last_error && <div className="bk-err">{d.imap.last_error}</div>}</div>
      <div className={'dk-int' + (d.webhook.active ? ' on' : '')} data-testid="mail-webhook"><div className="dk-int-h"><b>Webhook (videresending)</b><span className={'dk-badge' + (d.webhook.active ? ' on' : '')}>{d.webhook.active ? 'Aktiv' : 'Ikke aktiv'}</span></div>
        <code>POST {window.location.origin}{d.webhook.path}</code><div className="muted">JSON: from, subject, text. Krever MAIL_WEBHOOK_SECRET.</div></div>
    </div>
    <div className="dk-box"><h3>🧪 Test med en e-post</h3><div className="dk-grid"><label><span>Fra</span><input value={t.from} onChange={(e) => setT({ ...t, from: e.target.value })} /></label><label><span>Emne</span><input value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} /></label></div>
      <textarea className="bk-in" rows={4} data-testid="mail-text" value={t.text} onChange={(e) => setT({ ...t, text: e.target.value })} style={{ marginTop: 8 }} />
      <button className="dk-btn" onClick={() => test(true)} data-testid="mail-preview">🔍 Se hva som hentes ut</button> <button className="dk-save" disabled={dis} onClick={() => test(false)} data-testid="mail-create">➕ Lag booking</button>
      {pv && <div className="dk-parsed" data-testid="mail-parsed">{Object.keys(MISS).map((k) => <span key={k} className={pv[k] ? 'ok' : 'no'}>{pv[k] ? '✅' : '❓'} {MISS[k]}: <b>{pv[k] || '—'}</b></span>)}</div>}</div>
    <div className="dk-box"><h3>📥 Siste e-poster</h3><table className="dk-table" data-testid="mail-log"><tbody>{d.log.map((r) => <tr key={r.id}><td>{new Date(r.created).toLocaleString('nb-NO')}</td><td>{r.from_addr}</td><td>{r.subject}</td><td><span className={'dk-st' + (r.status === 'Booking laget' ? ' st-Betalt' : ' st-Forfalt')}>{r.status}</span></td><td className="muted">{r.source}</td></tr>)}
      {!d.log.length && <tr><td className="muted">Ingen ennå</td></tr>}</tbody></table></div>
  </>;
}
