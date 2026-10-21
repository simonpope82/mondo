// 🛞 Staff pages: tyre set (QR target), daily overview, customers (LTV + tyre advice + customer login), tyre-set labels.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Phone, Printer, CalendarDays, Car, User, MapPin, Check, KeyRound, ExternalLink } from 'lucide-react';

const LV = { Ja: ['🔴', 'Bør bestille nye dekk'], Snart: ['🟠', 'Snart nye dekk'], OK: ['🟢', 'Dekkene er OK'] };
const kr = (n) => (+n || 0).toLocaleString('nb-NO', { maximumFractionDigits: 0 }) + ' kr';
const printUrl = (ids) => '/api/dekk/tyreset-labels.pdf?ids=' + ids.join(',');

export function TyreSet({ code }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.get('/dekk/tyreset/' + encodeURIComponent(code)).then(setD).catch((e) => setErr(e.message)); }, [code]);
  if (err) return <div className="dk-box">{err}</div>; if (!d) return <div className="dk-box">Laster…</div>;
  const s = d.set, c = d.customer, v = d.vehicle;
  return <div className="ts-page" data-testid="tyreset">
    <div className="ts-loc"><MapPin size={26} /><div><small>Lagerplass</small><b data-testid="ts-location">{s.location || '—'}</b></div><span className="code-pill">{s.code}</span></div>
    {c && <div className="dk-box ts-cust"><div className="ts-h"><User size={22} /><b data-testid="ts-customer">{c.name}</b><span className="muted">{c.nr}</span></div>
      {c.phone && <a className="ts-call" href={'tel:' + c.phone.replace(/\s/g, '')}><Phone size={20} /> {c.phone}</a>}
      {c.email && <div className="muted">✉️ {c.email}</div>}{c.address && <div className="muted">📍 {c.address}</div>}
      <div className="ts-kv"><span>💰 Livstidsverdi</span><b>{kr(c.ltv)}</b></div>
      <a className="dk-btn" href={'#/board/' + c.board_id}><ExternalLink size={16} /> Åpne kundekort</a></div>}
    {v && <div className="dk-box"><div className="ts-h"><Car size={22} /><b>{v.regnr}</b><span>{v.make} {v.model} {v.year}</span></div></div>}
    <div className={'dk-box ts-level lv-' + s.level} data-testid="ts-level"><b>{LV[s.level][0]} {LV[s.level][1]}</b>{s.why.length > 0 && <div>{s.why.join(' · ')}</div>}</div>
    <div className="dk-box"><div className="ts-h"><span style={{ fontSize: 22 }}>🛞</span><b>{s.season}</b><span>{s.dim} · {s.brand}</span></div>
      <div className="ts-wheels">{['VF', 'HF', 'VB', 'HB'].map((w, k) => <div key={w} className={s.depths[k] != null && s.depths[k] < (/sommer/i.test(s.season) ? d.rules.summer_mm : d.rules.winter_mm) ? 'bad' : ''}><small>{w}</small><b>{s.depths[k] != null ? String(s.depths[k]).replace('.', ',') : '—'}</b><small>mm</small></div>)}</div>
      <div className="ts-kv"><span>DOT</span><b>{s.dot || '—'}{s.age != null ? ` (${s.age} år)` : ''}</b></div><div className="ts-kv"><span>Status</span><b>{s.status}</b></div><div className="ts-kv"><span>Tilstand</span><b>{s.condition || '—'}</b></div></div>
    {d.next.length > 0 && <div className="dk-box"><h3><CalendarDays size={18} /> Neste time</h3>{d.next.map((n) => <div key={n.id} className="ts-kv"><span>{n.date} kl {n.time}</span><b>{n.service}</b></div>)}</div>}
    <div className="ts-actions"><a className="dk-save" href={printUrl([s.id])} target="_blank" rel="noreferrer" data-testid="ts-print"><Printer size={18} /> Skriv ut ny etikett</a><a className="dk-btn" href={'#/board/' + s.board_id}>Åpne på Dekkhotell lager</a></div>
  </div>;
}

export function Daily() {
  const [d, setD] = useState(null); const load = () => api.get('/dekk/daily').then(setD); useEffect(() => { load(); }, []);
  if (!d) return <div className="dk-box">Laster…</div>;
  const toggle = async (x) => { await api.post(`/dekk/daily/${x.id}/fetched`, { on: !x.fetched }); load(); };
  return <div data-testid="daily">{d.days.map((day) => <div key={day.date} className="dk-box"><h3>{day.label === 'I dag' ? '🗓️' : '➡️'} {day.label} – {day.text} <span className="dk-st">{day.list.length} kunder</span></h3>
    {(() => { const locs = day.list.flatMap((x) => x.sets.map((s) => s.location)).filter(Boolean); return locs.length > 0 && <div className="dl-fetch">🛞 Hent frem: {locs.map((l) => <b key={l}>{l}</b>)}</div>; })()}
    {day.list.map((x) => <div key={x.id} className={'dl-row' + (x.fetched ? ' done' : '')} data-testid="daily-row">
      <div className="dl-time">{x.time}<small>{x.lift}</small></div>
      <div className="dl-main"><b>{x.customer || x.name}</b> <span className="muted">{x.regnr}</span><div>🔧 {x.service}{x.addons && <span className="dl-add"> ➕ {x.addons}</span>}</div>
        {x.sets.map((s) => <a key={s.id} className={'dl-set lv-' + s.level} href={'#/dekk/hjulsett/' + s.code}><MapPin size={14} /> <b>{s.location}</b> {s.season} {s.dim}{s.level !== 'OK' && ' ⚠️ ' + s.why.join(', ')}</a>)}
        {!x.sets.length && <div className="muted">Ingen hjul på lager</div>}</div>
      <div className="dl-act">{x.phone && <a className="dk-btn" href={'tel:' + x.phone.replace(/\s/g, '')}><Phone size={16} /></a>}
        {x.sets.length > 0 && <button className={'dk-btn' + (x.fetched ? ' on' : '')} onClick={() => toggle(x)} data-testid="daily-fetched"><Check size={16} /> {x.fetched ? 'Hentet' : 'Hent'}</button>}</div>
    </div>)}{!day.list.length && <div className="muted">Ingen kunder</div>}</div>)}
    <p className="muted">🔔 Morgenvarsel kl {String(d.daily.hour).padStart(2, '0')}:00 {d.daily.push ? 'er på' : 'er av'} (endres under Oppsett).</p></div>;
}

export function Customers({ boards, admin }) {
  const [b, setB] = useState(null); const [inv, setInv] = useState(null); const [users, setUsers] = useState([]);
  const load = () => { api.get('/boards/' + boards.kunder).then((r) => setB({ ...r.board, items: r.items })); api.get('/dekk/portal/users').then((r) => setUsers(r.users)); };
  useEffect(() => { load(); }, []);
  if (!b) return <div className="dk-box">Laster…</div>;
  const col = (t) => b.columns.find((c) => c.title === t); const cL = col('Livstidsverdi'), cR = col('Bør bestille nye dekk'), cT = col('Dekk-anbefaling'), cM = col('Mobil');
  const lab = (c, id) => c?.settings.labels.find((l) => l.id === id);
  const rows = [...b.items].sort((x, y) => (+y.vals[cL?.id] || 0) - (+x.vals[cL?.id] || 0));
  const invite = async (id) => { setInv(await api.post('/dekk/portal/invite', { customer_id: id })); load(); };
  return <div className="dk-box"><h3>👤 Kunder – verdi og dekkråd</h3>
    {inv && <div className="dk-msg" data-testid="invite-result">🔑 Kundeinnlogging: <b>{inv.login}</b> / <b>{inv.password}</b> · {inv.url}<br /><small>{inv.note}</small></div>}
    <table className="dk-table" data-testid="cust-table"><thead><tr><th>Kunde</th><th>💰 Livstidsverdi</th><th>🛞 Nye dekk?</th><th>Hvorfor</th><th>Min side</th></tr></thead><tbody>
      {rows.map((k) => { const l = lab(cR, k.vals[cR?.id]); const u = users.find((x) => x.customer_id === k.id); return <tr key={k.id}><td><b>{k.name}</b><div className="muted">{k.vals[cM?.id]}</div></td><td><b>{kr(k.vals[cL?.id])}</b></td>
        <td>{l?.label ? <span className="dk-st" style={{ background: l.color }}>{l.label}</span> : '—'}</td><td className="muted">{k.vals[cT?.id]}</td>
        <td>{u ? <span className="muted">✅ {u.login}</span> : null} {admin && <button className="dk-btn" onClick={() => invite(k.id)} data-testid="invite"><KeyRound size={14} /> {u ? 'Nytt passord' : 'Lag innlogging'}</button>}</td></tr>; })}
    </tbody></table><p className="muted">Livstidsverdi = sum av betalte fakturaer og betalte bookinger. Dekkråd følger reglene under Oppsett.</p></div>;
}

export function TyreLabels({ boards }) {
  const [b, setB] = useState(null); const [sel, setSel] = useState([]);
  useEffect(() => { api.get('/boards/' + boards.lager).then((r) => setB({ ...r.board, items: r.items })); }, []);
  if (!b) return <div className="dk-box">Laster…</div>;
  const col = (t) => b.columns.find((c) => c.title === t);
  return <div className="dk-box"><h3>🏷️ QR-etiketter for hjulsett</h3><p className="muted">Skriv ut når hjulene settes inn. Etiketten er 62×29 mm (rull). Skann → kundekortet åpnes (krever ansatt-innlogging).</p>
    <a className={'dk-save' + (sel.length ? '' : ' off')} href={sel.length ? printUrl(sel) : undefined} target="_blank" rel="noreferrer" data-testid="labels-print"><Printer size={16} /> Skriv ut {sel.length || ''} valgte</a>
    <table className="dk-table"><tbody>{b.items.map((it) => <tr key={it.id}><td><input type="checkbox" checked={sel.includes(it.id)} onChange={() => setSel(sel.includes(it.id) ? sel.filter((x) => x !== it.id) : [...sel, it.id])} /></td>
      <td><b>{it.vals[col('Lagerplass').id]}</b></td><td>{it.name}</td><td>{it.vals[col('Hjulsett-ID').id] && <a href={'#/dekk/hjulsett/' + it.vals[col('Hjulsett-ID').id]} className="code-pill">{it.vals[col('Hjulsett-ID').id]}</a>}</td>
      <td><a className="dk-btn" href={printUrl([it.id])} target="_blank" rel="noreferrer"><Printer size={14} /></a></td></tr>)}</tbody></table></div>;
}

export function Rules({ admin, setMsg }) {
  const [r, setR] = useState(null); useEffect(() => { api.get('/dekk/extra-settings').then(setR); }, []);
  if (!r) return null; const dis = !admin; const t = r.tyre_rules;
  const save = async () => { setR(await api.put('/dekk/extra-settings', r)); setMsg('✅ Lagret'); };
  const N = ({ k, label }) => <label><span>{label}</span><input disabled={dis} type="number" step="0.5" defaultValue={t[k]} onBlur={(e) => setR({ ...r, tyre_rules: { ...t, [k]: +e.target.value } })} /></label>;
  return <div className="dk-box"><h3>🛞 Regler for «Bør bestille nye dekk»</h3><div className="dk-grid">
    <N k="winter_mm" label="Vinter: under mm" /><N k="summer_mm" label="Sommer: under mm" /><N k="margin_mm" label="«Snart»-margin mm" /><N k="max_age" label="Maks alder (år)" /><N k="warn_age" label="«Snart» fra alder (år)" /></div>
    <h3 style={{ marginTop: 16 }}>🔔 Morgenvarsel til ansatte</h3><label className="bk-check"><input disabled={dis} type="checkbox" checked={r.daily.push} onChange={(e) => setR({ ...r, daily: { ...r.daily, push: e.target.checked } })} /> Send push hver morgen med dagens kunder og lagerplasser</label>
    <div className="dk-grid"><label><span>Klokkeslett (time)</span><input disabled={dis} type="number" value={r.daily.hour} onChange={(e) => setR({ ...r, daily: { ...r.daily, hour: +e.target.value } })} /></label></div>
    <button className="dk-save" disabled={dis} onClick={save} data-testid="rules-save">Lagre regler</button></div>;
}
