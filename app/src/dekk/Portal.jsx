// 👤 Customer portal (#/minside or /minside) – own login, own bookings/tyres/invoices only.
import React, { useEffect, useState } from 'react';
import { CalendarDays, LogOut, Bell, BellOff } from 'lucide-react';
import { PrevNote, TyreChoice } from './TyreNote.jsx';
const j = async (m, u, b) => { const r = await fetch('/api' + u, { method: m, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(x.error || r.status); return x; };
const LV = { Ja: '🔴 Bør byttes', Snart: '🟠 Snart', OK: '🟢 OK' };
export default function Portal() {
  const [fg, setFg] = useState(false); const [fgMsg, setFgMsg] = useState('');
  const [me, setMe] = useState(undefined); const [f, setF] = useState({ login: '', password: '' }); const [err, setErr] = useState('');
  const [prev, setPrev] = useState(null); const [pick, setPick] = useState(''); const [saved, setSaved] = useState(''); const [pmsg, setPmsg] = useState('');
  const load = () => j('GET', '/portal/me').then((m) => { setMe(m); j('GET', '/portal/prev').then(setPrev).catch(() => {}); }).catch(() => setMe(null));
  const enablePush = async () => {
    setPmsg('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Denne nettleseren støtter ikke varsler. På iPhone: legg siden til på Hjem-skjermen først.');
      const { key } = await j('GET', '/portal/push/key'); if (!key) throw new Error('Varsler er ikke satt opp på serveren ennå.');
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('Du må tillate varsler.');
      const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      const pad = '='.repeat((4 - (key.length % 4)) % 4); const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
      await j('POST', '/portal/push/subscribe', sub.toJSON()); setPmsg('✅ Varsler er på'); j('GET', '/portal/prev').then(setPrev);
    } catch (e) { setPmsg(e.message); }
  };
  useEffect(() => { document.title = 'Min side'; load(); }, []);
  if (me === undefined) return <div className="bk-page"><div className="bk-card">Laster…</div></div>;
  if (!me) return <div className="bk-page"><header className="bk-head"><div className="bk-logo">🛞</div><div><b>Min side</b><div className="muted">Se timer, dekk og fakturaer</div></div></header>
    <form className="bk-card" onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await j('POST', '/portal/login', f); load(); } catch (x) { setErr(x.message); } }} data-testid="portal-login">
      <label className="bk-label">Mobil eller e-post</label><input className="bk-in" data-testid="portal-user" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} autoComplete="username" />
      <label className="bk-label">Passord</label><input className="bk-in" type="password" data-testid="portal-pass" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />
      {err && <div className="bk-err">{err}</div>}<div className="bk-nav"><button className="bk-btn" data-testid="portal-submit">Logg inn</button></div><button type="button" className="pt-forgot" onClick={() => setFg(true)} data-testid="portal-forgot-link">Glemt passord?</button>
      {fg && <div className="pt-fg" data-testid="portal-forgot">{fgMsg ? <p data-testid="portal-forgot-sent">✅ {fgMsg}</p> : <><p className="muted">Skriv mobil eller e-post over, så sender vi en lenke.</p><button type="button" className="bk-btn" data-testid="portal-forgot-submit" disabled={!f.login} onClick={async () => { try { setFgMsg((await j('POST', '/portal/forgot', { login: f.login })).message); } catch (x) { setErr(x.message); } }}>Send lenke</button></>}</div>}
      <p className="muted bk-small">Har du ikke passord? Spør verkstedet.</p></form></div>;
  const up = me.bookings.filter((b) => b.date >= new Date().toISOString().slice(0, 10));
  return <div className="bk-page" data-testid="portal">
    <header className="bk-head"><div className="bk-logo">🛞</div><div style={{ flex: 1 }}><b>Hei, {me.name.split(' ')[0]}!</b><div className="muted">{me.company}</div></div><button className="bk-back" onClick={async () => { await j('POST', '/portal/logout'); setMe(null); }}><LogOut size={18} /></button></header>
    {prev && (prev.worn || prev.note) && <div className="bk-card"><PrevNote info={prev} />{prev.worn && <TyreChoice worn={prev.worn} texts={prev.texts} value={pick} saved={saved} onChoose={async (k) => { setPick(k); const r = await j('POST', '/portal/tyre-choice', { choice: k }); setSaved(r.text); }} />}</div>}
    {prev && <div className="bk-card" data-testid="portal-push"><h2>🔔 Varsler</h2>
      {prev.notices?.map((n) => <div key={n.id} className="tn-notice" data-testid="portal-notice"><Bell size={18} /><div><b>{n.text}</b><small className="muted">{n.created.slice(0, 10)}{n.pushed ? ' · sendt som push' : ''}</small></div></div>)}
      {prev.push?.has ? <div className="tn-saved"><Bell size={16} /> Varsler er på for denne enheten</div> : <button className="bk-btn" data-testid="portal-push-on" onClick={enablePush}><Bell size={18} /> Slå på varsler</button>}
      {pmsg && <p className="muted">{pmsg}</p>}<p className="muted bk-small"><BellOff size={13} /> Vi sender bare varsel når det gjelder dekkene dine.</p></div>}
    <div className="bk-card"><h2>📅 Timer</h2>{up.length ? up.map((b) => <div key={b.ref + b.date} className="pt-row"><b>{b.date} kl {b.time}</b><span>{b.service}{b.addons ? ' + ' + b.addons : ''}</span><span className="dk-st">{b.status}</span></div>) : <div className="muted">Ingen kommende timer</div>}
      <a className="bk-btn pt-book" href="/book"><CalendarDays size={18} /> Bestill ny time</a></div>
    <div className="bk-card"><h2>🛞 Mine dekk</h2>{me.tyres.map((t, k) => <div key={k} className="pt-tyre"><div><b>{t.season}</b> {t.dim} · {t.brand}</div><div className="pt-depth">{t.depths.map((d, i) => <span key={i}>{String(d).replace('.', ',')} mm</span>)}</div><div>{LV[t.level]} {t.why.join(', ')}</div><small className="muted">{t.status}</small></div>)}{!me.tyres.length && <div className="muted">Ingen dekk på hotellet</div>}</div>
    <div className="bk-card"><h2>🚗 Biler</h2>{me.vehicles.map((v) => <div key={v.regnr} className="pt-row"><b>{v.regnr}</b><span>{v.make} {v.model}</span></div>)}</div>
    <div className="bk-card"><h2>🧾 Fakturaer</h2>{me.invoices.map((i) => <div key={i.no} className="pt-row"><b>{i.no}</b><span>{(+i.total).toLocaleString('nb-NO')} kr</span><span className="dk-st">{i.status}</span>{i.status !== 'Betalt' && <a href={i.pay_url}>Betal</a>}</div>)}{!me.invoices.length && <div className="muted">Ingen</div>}</div>
    <div className="bk-card"><h2>📜 Tidligere</h2>{me.bookings.filter((b) => !up.includes(b)).map((b) => <div key={b.ref + b.date} className="pt-row"><b>{b.date}</b><span>{b.service}</span><span className="muted">{b.regnr}</span></div>)}</div>
  </div>;
}
