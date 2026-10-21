// 🛞 Dekkhotell control page (#/dekk): boards, booking link + QR, settings (company / services / capacity), invoices, outbox, integrations.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CalendarDays, Users, Car, Warehouse, Receipt, Settings, Mail, Plug, Link2, FileText, Send, CreditCard, Check, Plus, Trash2, ExternalLink } from 'lucide-react';

const BOARDS = [['bookinger', 'Bookinger', CalendarDays, '#579bfc'], ['kunder', 'Kunder', Users, '#00c875'], ['kjoretoy', 'Kjøretøy', Car, '#fdab3d'], ['lager', 'Dekkhotell lager', Warehouse, '#784bd1'], ['faktura', 'Fakturaer', Receipt, '#ff6d3b']];
const TABS = [['oversikt', 'Oversikt', Link2], ['fakturaer', 'Fakturaer', Receipt], ['utboks', 'Utboks', Mail], ['oppsett', 'Oppsett', Settings], ['integrasjoner', 'Betaling & nøkler', Plug]];
const DAYS = [[1, 'Man'], [2, 'Tir'], [3, 'Ons'], [4, 'Tor'], [5, 'Fre'], [6, 'Lør'], [0, 'Søn']];
const kr = (n) => (+n || 0).toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' kr';

export default function DekkAdmin({ hash, user }) {
  const tab = hash.split('/')[2] || 'oversikt';
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
      <h1 className="dk-title">🛞 Dekkhotell</h1>
      <div className="dk-tabs">{TABS.map(([k, t, I]) => <a key={k} href={'#/dekk/' + k} data-testid={'dk-tab-' + k} className={'dk-tab' + (tab === k ? ' on' : '')}><I size={18} /> {t}</a>)}</div>
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
        {out.map((o) => <div key={o.id} className="dk-mail" data-testid="dk-outbox-item"><div className="dk-mail-h"><b>{o.kind === 'sms' ? '💬 SMS' : '✉️ E-post'}</b> til {o.to_addr || '—'} <span className="dk-st">{o.status}</span></div>{o.subject && <div><b>{o.subject}</b></div>}<pre>{o.body}</pre>{o.attachment && <div className="muted">📎 {o.attachment}</div>}</div>)}
        {!out.length && <div className="muted">Tom</div>}</div>}
      {tab === 'oppsett' && <Setup s={s} save={save} admin={user?.role === 'admin'} />}
      {tab === 'integrasjoner' && <div className="dk-box"><p className="muted">Nøkler legges inn som miljøvariabler (Render → Environment). Ingen ekte nøkler ligger i koden. Bruk testmodus først.</p>
        <div className="dk-ints">{d.integrations.map((x) => <div key={x.key} className={'dk-int' + (x.active ? ' on' : '')} data-testid={'dk-int-' + x.key}>
          <div className="dk-int-h"><b>{x.name}</b><span className={'dk-badge' + (x.active ? ' on' : '')}>{x.active ? 'Aktiv' : 'Ikke aktiv'}</span></div>
          <code>{x.env}</code>{x.note && <div className="muted">{x.note}</div>}{x.docs && <a href={x.docs} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Dokumentasjon</a>}</div>)}</div></div>}
    </div>
  );
}

function Setup({ s, save, admin }) {
  const [c, setC] = useState(s.company); const [sv, setSv] = useState(s.services); const [cap, setCap] = useState(s.capacity); const [iv, setIv] = useState(s.invoice);
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
