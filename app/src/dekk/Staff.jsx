// 🛞 Staff pages: tyre set (QR target), daily overview, customers (LTV + tyre advice + customer login), tyre-set labels.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import { Phone, Printer, CalendarDays, Car, User, MapPin, Check, KeyRound, ExternalLink, Ruler, AlertTriangle, Bell, X } from 'lucide-react';

const LV = { Ja: ['🔴', 'Bør bestille nye dekk'], Snart: ['🟠', 'Snart nye dekk'], OK: ['🟢', 'Dekkene er OK'] };
const kr = (n) => (+n || 0).toLocaleString('nb-NO', { maximumFractionDigits: 0 }) + ' kr';
const printUrl = (ids) => '/api/dekk/tyreset-labels.pdf?ids=' + ids.join(',');

// 📏 "Gamle dekk tatt av" – register tread depth; pop-up if below the limit
export function WearModal({ set, onClose, onDone }) {
  const [d, setD] = useState(['', '', '', '']); const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setErr(''); try { const r = await api.post('/dekk/wear/register', { set_id: set.id, depths: d }); setRes(r); onDone && onDone(r); } catch (e) { setErr(e.message); } setBusy(false); };
  return createPortal(<div className="wm-back" onClick={onClose}><div className="wm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} data-testid="wear-modal">
    <button className="wm-x" onClick={onClose} aria-label="Lukk"><X size={20} /></button>
    {!res && <><h3><Ruler size={22} /> Gamle dekk tatt av</h3><p className="muted">{set.season} {set.dim} – skriv mønsterdybde (mm)</p>
      <div className="wm-wheels">{['VF', 'HF', 'VB', 'HB'].map((w, k) => <label key={w}><small>{w}</small><input inputMode="decimal" data-testid={'wm-' + w} value={d[k]} onChange={(e) => setD(d.map((x, i) => (i === k ? e.target.value : x)))} placeholder="mm" /></label>)}</div>
      {err && <div className="dk-msg err">{err}</div>}<button className="dk-save wm-go" disabled={busy || d.some((x) => !x)} onClick={save} data-testid="wm-save"><Check size={18} /> Lagre</button></>}
    {res && res.popup && <div className="wm-alert" data-testid="wear-alert"><AlertTriangle size={54} /><h2>{res.text}</h2><p><b>{res.customer}</b> · {res.season} · {String(res.min).replace('.', ',')} mm</p>
      <ul><li>🚩 Oppgave «Bestill nye dekk» lagt på kunden</li><li>🔔 Varsel sendt til verkstedet</li><li>📅 Påminnelse til kunden {res.reminder}</li></ul><button className="dk-save" onClick={onClose}>Skjønner</button></div>}
    {res && !res.popup && <div className={'wm-ok lv-' + res.level} data-testid="wear-ok"><h2>{res.level === 'Snart' ? '🟠 Nær grensen' : '🟢 Dekkene er OK'}</h2><p>{res.why.join(', ') || String(res.min).replace('.', ',') + ' mm'}</p>{res.reminder && <p>📅 Påminnelse {res.reminder}</p>}<button className="dk-save" onClick={onClose}>OK</button></div>}
  </div></div>, document.body);
}

export function WearSettings({ admin, setMsg }) {
  const [c, setC] = useState(null); useEffect(() => { api.get('/dekk/wear/settings').then(setC); }, []);
  if (!c) return null; const r = c.reminder; const T = c.texts; const up = (p) => setC({ ...c, reminder: { ...r, ...p } }); const ut = (k, v) => setC({ ...c, texts: { ...T, [k]: v } });
  const save = async () => { const x = await api.put('/dekk/wear/settings', { reminder: c.reminder, texts: c.texts }); setC({ ...c, ...x }); setMsg && setMsg('✅ Lagret'); };
  const run = async () => { const x = await api.post('/dekk/wear/run-reminders', {}); setMsg && setMsg(`🔔 ${x.sent} påminnelser sendt`); };
  const TX = [['prev_title', 'Overskrift på notat'], ['worn_line', 'Linje ved slitte dekk'], ['worn_detail', 'Slitte dekk – detalj'], ['choice_yes', 'Valg: ja'], ['choice_offer', 'Valg: tilbud'], ['choice_no', 'Valg: nei'], ['generic_q', 'Spørsmål til nye kunder'], ['generic_yes', 'Nye kunder: ja'], ['generic_no', 'Nye kunder: nei'], ['staff_popup', 'Pop-up til verkstedet'], ['remind_staff', 'Påminnelse til verkstedet'], ['remind_customer', 'Påminnelse til kunden (push / SMS-utkast)']];
  return <div className="dk-box" data-testid="wear-settings"><h3><Bell size={18} /> Påminnelse om nye dekk</h3>
    {!r.decided && <div className="dk-msg warn" data-testid="wear-undecided">⚠️ Må avklares med Simon: hvilken måned/dag påminnelsen skal gå ut. Nå: {r.day}. {c.months[r.month - 1]}.</div>}
    <label className="dk-check"><input type="checkbox" checked={r.on} disabled={!admin} onChange={(e) => up({ on: e.target.checked })} /> Send påminnelse automatisk</label>
    <div className="wm-row"><label>Måned<select value={r.month} disabled={!admin} onChange={(e) => up({ month: +e.target.value })} data-testid="wear-month">{c.months.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}</select></label>
      <label>Dag<input type="number" min="1" max="28" value={r.day} disabled={!admin} onChange={(e) => up({ day: +e.target.value })} /></label>
      <label className="dk-check"><input type="checkbox" checked={r.decided} disabled={!admin} onChange={(e) => up({ decided: e.target.checked })} /> Bestemt</label></div>
    <p className="muted">Neste standard-dato: <b>{c.next_default}</b>. Egen dato per kunde: kolonnen «Påminnelse nye dekk (egen dato)» på Kunder (f.eks. 15.08 eller 2027-08-15).</p>
    <p className="muted">Hva skjer: varsel til verkstedet · push til kunden hvis Min side + varsler er på · SMS/e-post legges bare som utkast i Utboks.</p>
    <details><summary>✏️ Tekster</summary>{TX.map(([k, t]) => <label key={k} className="wm-tx"><small>{t}</small><input className="dk-in" value={T[k]} disabled={!admin} onChange={(e) => ut(k, e.target.value)} /></label>)}</details>
    {admin && <div className="wm-row"><button className="dk-save" onClick={save} data-testid="wear-save">Lagre</button><button className="dk-btn" onClick={run} data-testid="wear-run">🔔 Kjør påminnelser nå</button></div>}</div>;
}

export function TyreSet({ code }) {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [wear, setWear] = useState(false);
  useEffect(() => { api.get('/dekk/tyreset/' + encodeURIComponent(code)).then(setD).catch((e) => setErr(e.message)); }, [code]);
  if (err) return <div className="dk-box">{err}</div>; if (!d) return <div className="dk-box">Laster…</div>;
  const s = d.set, c = d.customer, v = d.vehicle;
  return <div className="ts-page" data-testid="tyreset">{wear && <WearModal set={s} onClose={() => { setWear(false); api.get('/dekk/tyreset/' + encodeURIComponent(code)).then(setD); }} />}
    <button className="dk-save ts-wear" onClick={() => setWear(true)} data-testid="ts-wear"><Ruler size={20} /> Gamle dekk tatt av – registrer mønster</button>
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
  const [d, setD] = useState(null); const [wear, setWear] = useState(null); const load = () => api.get('/dekk/daily').then(setD); useEffect(() => { load(); }, []);
  if (!d) return <div className="dk-box">Laster…</div>;
  const toggle = async (x) => { await api.post(`/dekk/daily/${x.id}/fetched`, { on: !x.fetched }); load(); };
  return <div data-testid="daily">{wear && <WearModal set={wear} onClose={() => { setWear(null); load(); }} />}{d.days.map((day) => <div key={day.date} className="dk-box"><h3>{day.label === 'I dag' ? '🗓️' : '➡️'} {day.label} – {day.text} <span className="dk-st">{day.list.length} kunder</span></h3>
    {(() => { const locs = day.list.flatMap((x) => x.sets.map((s) => s.location)).filter(Boolean); return locs.length > 0 && <div className="dl-fetch">🛞 Hent frem: {locs.map((l) => <b key={l}>{l}</b>)}</div>; })()}
    {day.list.map((x) => <div key={x.id} className={'dl-row' + (x.fetched ? ' done' : '')} data-testid="daily-row">
      <div className="dl-time">{x.time}<small>{x.lift}</small></div>
      <div className="dl-main"><b>{x.customer || x.name}</b> <span className="muted">{x.regnr}</span><div>🔧 {x.service}{x.addons && <span className="dl-add"> ➕ {x.addons}</span>}</div>
        {x.sets.map((s) => <a key={s.id} className={'dl-set lv-' + s.level} href={'#/dekk/hjulsett/' + s.code}><MapPin size={14} /> <b>{s.location}</b> {s.season} {s.dim}{s.level !== 'OK' && ' ⚠️ ' + s.why.join(', ')}</a>)}
        {!x.sets.length && <div className="muted">Ingen hjul på lager</div>}
        {x.tyre_choice && <div className="dl-choice" data-testid="daily-choice">🛞 Kunden: «{x.tyre_choice}»</div>}</div>
      <div className="dl-act">{x.phone && <a className="dk-btn" href={'tel:' + x.phone.replace(/\s/g, '')}><Phone size={16} /></a>}
        {x.oncar?.length > 0 && <button className="dk-btn" onClick={() => setWear(x.oncar[0])} data-testid="daily-wear" title="Gamle dekk tatt av"><Ruler size={16} /> Tatt av</button>}
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
