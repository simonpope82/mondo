import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api.js';
import { Avatar } from '../ui.jsx';
import { statusColor, STATUS_COLORS, ago, when, titleOf, today, PRIO, photoUrl } from './lib.js';
import { ChevronLeft, ChevronRight, Printer, Plus, Download, Copy, Save, Trash2, ExternalLink, Navigation, X, Search } from 'lucide-react';

// ---------- map of last known positions + trail ----------
export function AssetMap({ actx, focus }) {
  const el = useRef(); const m = useRef(); const lay = useRef(); const trailLay = useRef();
  const [d, setD] = useState(null); const [sel, setSel] = useState(focus || null); const [q, setQ] = useState(''); const [sat, setSat] = useState(false); const tiles = useRef();
  useEffect(() => { api.get('/assets-map').then(setD); }, [actx.data]);
  useEffect(() => {
    m.current = L.map(el.current).setView([61, 9], 5);
    tiles.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m.current);
    lay.current = L.layerGroup().addTo(m.current); trailLay.current = L.layerGroup().addTo(m.current);
    return () => m.current.remove();
  }, []);
  useEffect(() => { // satellite toggle (Esri World Imagery, free with attribution)
    if (!m.current) return; tiles.current.remove();
    tiles.current = sat ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' }) : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    tiles.current.addTo(m.current);
  }, [sat]);
  const list = (d?.assets || []).filter((a) => !q || JSON.stringify([a.code, a.data, a.assigned_to]).toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    if (!d) return; lay.current.clearLayers();
    list.forEach((a) => L.marker([a.last_lat, a.last_lng], { title: a.code, icon: L.divIcon({ className: 'pin-icon' + (a.id === sel ? ' sel' : ''), html: `<span style="background:${statusColor(a.data.status)}"></span>`, iconSize: [28, 36], iconAnchor: [14, 34] }) }).on('click', () => { setSel(a.id); m.current.flyTo([a.last_lat, a.last_lng], Math.max(m.current.getZoom(), 12), { duration: 0.6 }); }).addTo(lay.current));
    if (!m.current._fit && list.length) { m.current.fitBounds(L.latLngBounds(list.map((a) => [a.last_lat, a.last_lng])), { padding: [40, 40], maxZoom: 14 }); m.current._fit = true; }
  }, [d, q, sel]);
  useEffect(() => {
    trailLay.current.clearLayers(); if (!d || !sel) return;
    const pts = d.trails.filter((t) => t.asset_id === sel);
    if (pts.length > 1) L.polyline(pts.map((p) => [p.lat, p.lng]), { color: '#0073ea', weight: 3, dashArray: '6 6' }).addTo(trailLay.current);
    pts.forEach((p, k) => L.circleMarker([p.lat, p.lng], { radius: 5, color: '#0073ea', fillColor: '#fff', fillOpacity: 1 }).bindTooltip(`${k + 1}. ${when(p.created)} · ${p.who_name}`).addTo(trailLay.current));
    const a = d.assets.find((x) => x.id === sel); if (a && focus === sel && !m.current._focused) { m.current.setView([a.last_lat, a.last_lng], 13); m.current._focused = true; }
  }, [d, sel]);
  const a = d && sel && d.assets.find((x) => x.id === sel); const trail = d && sel ? d.trails.filter((t) => t.asset_id === sel).slice().reverse() : [];
  return <div className="as-map-page">
    <div className="as-toolbar"><div className="as-search"><Search size={16} /><input placeholder="Search on map" value={q} onChange={(e) => setQ(e.target.value)} data-testid="am-search" /></div>
      <button className={'btn' + (sat ? ' on' : '')} onClick={() => setSat(!sat)} data-testid="am-sat">🛰️ Satellite</button><span className="muted">📍 {list.length} on map</span></div>
    <div className="as-map-wrap"><div ref={el} className="as-map" data-testid="am-map" />
      {a && <div className="am-card" data-testid="am-card"><button className="icon-btn am-x" onClick={() => setSel(null)}><X size={18} /></button>
        <div className="row-gap">{photoUrl(a) && <img className="am-img" src={photoUrl(a)} alt="" />}<div><b>{titleOf(a)}</b> {a.data.model}<br /><span className="code-pill">{a.code}</span> <span className="st-pill" style={{ background: statusColor(a.data.status) }}>{a.data.status}</span></div></div>
        <div className="small">📍 Updated {ago(a.last_seen)} by {a.last_by}{a.last_acc ? ` · ±${Math.round(a.last_acc)} m` : ''}</div>
        <div className="small">{a.checked_out ? '📤 ' + a.assigned_to : '🏠 ' + (a.data.home_location || '—')}</div>
        <div className="row-gap"><a className="btn small primary" href={'#/assets/' + a.id} data-testid="am-open">Open</a><a className="btn small" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${a.last_lat},${a.last_lng}`}><ExternalLink size={13} /> Google Maps</a><a className="btn small" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${a.last_lat},${a.last_lng}`}><Navigation size={13} /> Directions</a></div>
        <div className="am-trail"><b className="small">History ({trail.length})</b>{trail.slice(0, 6).map((t, k) => <div key={k} className="small muted">• {when(t.created)} – {t.who_name} ({t.type})</div>)}</div>
      </div>}
    </div>
    <div className="map-legend">{Object.entries(STATUS_COLORS).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}</div>
  </div>;
}

// ---------- agenda (Service scheduled / End of life / due back / tasks) ----------
export function Agenda({ actx }) {
  const [mon, setMon] = useState(() => today().slice(0, 7)); const [tasks, setTasks] = useState([]);
  useEffect(() => { api.get('/asset-tasks').then(setTasks); }, []);
  const ev = useMemo(() => {
    const out = [];
    for (const a of actx.data.assets) {
      if (a.data.next_filter_change) out.push({ d: a.data.next_filter_change, k: 'svc', t: `🔧 Service scheduled: ${titleOf(a)} ${a.code}`, a });
      if (a.end_of_life) out.push({ d: a.end_of_life, k: 'eol', t: `⏳ End of life: ${titleOf(a)} ${a.code}`, a });
      if (a.checked_out && a.return_date) out.push({ d: a.return_date, k: 'ret', t: `↩️ Due back: ${titleOf(a)} (${a.assigned_to})`, a });
    }
    for (const t of tasks) if (t.due && !t.done) out.push({ d: t.due, k: 'task', t: `📋 ${t.title} (${t.code})`, a: { id: t.asset_id } });
    return out;
  }, [actx.data, tasks]);
  const [y, m] = mon.split('-').map(Number); const first = new Date(y, m - 1, 1); const off = (first.getDay() + 6) % 7; const days = new Date(y, m, 0).getDate();
  const cells = [...Array(off).fill(null), ...Array.from({ length: days }, (_, k) => k + 1)];
  const shift = (n) => { const d = new Date(y, m - 1 + n, 1); setMon(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  return <div className="agenda" data-testid="agenda">
    <div className="as-toolbar"><button className="btn" onClick={() => shift(-1)}><ChevronLeft size={16} /></button><h2 className="ag-title">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2><button className="btn" onClick={() => shift(1)}><ChevronRight size={16} /></button><button className="btn ghost" onClick={() => setMon(today().slice(0, 7))}>Today</button>
      <span className="ag-legend"><i className="svc" />Service scheduled <i className="eol" />End of life <i className="ret" />Due back <i className="task" />Task</span></div>
    <div className="ag-grid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="ag-dow">{d}</div>)}
      {cells.map((n, k) => { const ds = n && `${mon}-${String(n).padStart(2, '0')}`; const list = n ? ev.filter((e) => e.d === ds) : [];
        return <div key={k} className={'ag-day' + (!n ? ' empty' : '') + (ds === today() ? ' today' : '')}>{n && <span className="ag-n">{n}</span>}{list.map((e, j) => <a key={j} href={'#/assets/' + e.a.id} className={'ag-ev ' + e.k} title={e.t} data-testid="ag-ev">{e.t}</a>)}</div>; })}</div>
  </div>;
}

// ---------- tasks ----------
export function Tasks({ actx }) {
  const [list, setList] = useState(null); const [all, setAll] = useState(false);
  const load = () => api.get('/asset-tasks').then(setList); useEffect(() => { load(); }, []);
  if (!list) return <div className="loading">Loading…</div>;
  const rows = list.filter((t) => all || !t.done);
  return <div className="pad2" data-testid="tasks-page">
    <div className="as-toolbar"><h2 className="ag-title">✅ Tasks</h2><label className="ck-row"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show done</label></div>
    <table className="as-table"><thead><tr><th /><th>Priority</th><th>Title</th><th>Asset</th><th>Assignee</th><th>Due</th></tr></thead>
      <tbody>{rows.map((t) => <tr key={t.id} className={t.done ? 'done' : ''} data-testid="task-row"><td className="ck"><input type="checkbox" checked={!!t.done} onChange={async (e) => { await api.patch('/asset-tasks/' + t.id, { done: e.target.checked }); load(); }} /></td>
        <td><span className="prio" style={{ background: PRIO[t.priority] }}>{t.priority}</span></td><td>{t.title}</td><td><a href={'#/assets/' + t.asset_id}>{t.asset_type} {t.code}</a></td>
        <td>{t.assignee ? <span className="row-gap"><Avatar person={actx.people.find((p) => p.id === t.assignee)} size={22} />{actx.people.find((p) => p.id === t.assignee)?.name}</span> : '—'}</td><td className={t.due && t.due < today() && !t.done ? 'overdue' : ''}>{t.due || '—'}</td></tr>)}</tbody></table>
    {!rows.length && <div className="empty-view">No open tasks 🎉 – add tasks from an asset.</div>}
  </div>;
}

// ---------- messages from finders (public scan) + team notes ----------
export function Messages({ actx }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.get('/asset-messages').then(setList); api.post('/asset-messages/read').catch(() => {}); }, []);
  if (!list) return <div className="loading">Loading…</div>;
  const csv = () => { const rows = [['Time', 'Asset ID', 'Direction', 'Name', 'Email', 'Phone', 'Message', 'Lat', 'Lng'], ...list.map((m) => [m.created, m.code, m.dir, m.name, m.email, m.phone, m.text, m.lat, m.lng])]; const b = new Blob(['\ufeff' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')], { type: 'text/csv' }); const u = URL.createObjectURL(b); const x = document.createElement('a'); x.href = u; x.download = 'messages.csv'; x.click(); };
  return <div className="pad2" data-testid="messages-page">
    <div className="as-toolbar"><h2 className="ag-title">💬 Messages</h2><span className="muted small">Anyone who scans a tag can send a message. You get a 🔔 alert.</span><span className="grow" /><button className="btn" onClick={csv}><Download size={15} /> Export CSV</button></div>
    {list.map((m) => <a key={m.id} href={'#/assets/' + m.asset_id} className={'msg-row ' + m.dir + (m.read ? '' : ' unread')} data-testid="msg-row"><span className="big-ico">{m.dir === 'in' ? '📨' : '💬'}</span><span className="grow"><b>{m.dir === 'in' ? m.name || 'Finder' : m.name}</b> about <b>{m.asset_type} {m.code}</b><br />{m.text}<br /><span className="small muted">{when(m.created)} {m.email} {m.phone}</span></span></a>)}
    {!list.length && <div className="empty-view">No messages yet</div>}
  </div>;
}

// ---------- labels: unused tags, generate, PDF ----------
const TPL = [['avery6570', 'Avery 6570 / 6576 – 1¾″×1¼″, 32 per Letter sheet (GoCodes)'], ['avery5160', 'Avery 5160 – 2⅝″×1″, 30 per Letter'], ['avery22806', 'Avery 22806 – 2″ square, 12 per Letter'], ['l7651', 'Avery L7651 – 38×21 mm, 65 per A4'], ['l7160', 'Avery L7160 – 63.5×38 mm, 21 per A4'], ['l7163', 'Avery L7163 – 99×38 mm, 14 per A4'], ['roll50x25', 'Label printer – 50×25 mm roll'], ['roll62x29', 'Brother DK-11209 – 62×29 mm']];
export function Labels({ actx, preset }) {
  const [qr, setQr] = useState(null); const [src, setSrc] = useState(preset ? 'sel' : 'unassigned'); const [tpl, setTpl] = useState('avery6570'); const [start, setStart] = useState(0);
  const [header, setHeader] = useState(actx.data.settings.org); const [showName, setShowName] = useState(true); const [outline, setOutline] = useState(false); const [n, setN] = useState(32); const [url, setUrl] = useState(null);
  const load = () => api.get('/qr').then(setQr); useEffect(() => { load(); }, []);
  const make = () => { const p = new URLSearchParams({ template: tpl, start, header, name: showName ? '1' : '0', outline: outline ? '1' : '0' }); if (src === 'unassigned') p.set('unassigned', '1'); else if (src === 'all') p.set('all', '1'); else p.set('codes', preset || ''); return '/api/labels.pdf?' + p; };
  const count = src === 'unassigned' ? qr?.codes.length : src === 'all' ? actx.data.assets.length : (preset || '').split(',').filter(Boolean).length;
  return <div className="labels-page pad2" data-testid="labels-page">
    <div className="lab-grid">
      <div className="lab-form">
        <h2 className="ag-title">🖨️ Print QR labels</h2>
        <label className="mini-label">Which labels</label>
        <div className="seg col">{preset && <button className={src === 'sel' ? 'on' : ''} onClick={() => setSrc('sel')}>☑️ Selected ({(preset || '').split(',').length})</button>}
          <button className={src === 'unassigned' ? 'on' : ''} onClick={() => setSrc('unassigned')} data-testid="lab-unassigned">🏷️ Unused tags ({qr?.codes.length ?? '…'})</button>
          <button className={src === 'all' ? 'on' : ''} onClick={() => setSrc('all')} data-testid="lab-all">📦 All assets ({actx.data.assets.length})</button></div>
        <label className="mini-label">Label sheet</label>
        <select className="text-input" value={tpl} onChange={(e) => setTpl(e.target.value)} data-testid="lab-tpl">{TPL.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="mini-label">Text on label</label><input className="text-input" value={header} onChange={(e) => setHeader(e.target.value)} data-testid="lab-header" />
        <label className="mini-label">Skip first labels (used sheet)</label><input className="text-input" type="number" min="0" value={start} onChange={(e) => setStart(Math.max(0, +e.target.value || 0))} />
        <label className="ck-row"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Asset type + model on label</label>
        <label className="ck-row"><input type="checkbox" checked={outline} onChange={(e) => setOutline(e.target.checked)} /> Draw outlines (test print on plain paper)</label>
        <div className="row-gap"><button className="btn primary big" disabled={!count} onClick={() => setUrl(make() + '&t=' + Date.now())} data-testid="lab-preview"><Printer size={18} /> Make PDF ({count || 0})</button>{url && <a className="btn big" href={url} target="_blank" rel="noreferrer" data-testid="lab-open">Open PDF</a>}</div>
        <p className="small muted">Print at <b>100 % / Actual size</b> (no "fit to page"). Test one sheet on plain paper first.</p>
        <div className="lab-gen"><h3>➕ New unused tags</h3><p className="small muted">Make codes now, print and stick them on. The first scan asks which asset it belongs to ("Activate asset tag").</p>
          <div className="row-gap"><input className="text-input" type="number" min="1" max="500" value={n} onChange={(e) => setN(+e.target.value)} style={{ width: 90, margin: 0 }} data-testid="lab-n" /><button className="btn" onClick={async () => { await api.post('/qr/generate', { count: n }); load(); actx.reload(); setSrc('unassigned'); }} data-testid="lab-generate"><Plus size={15} /> Generate</button></div>
          <div className="code-list" data-testid="lab-codes">{(qr?.codes || []).slice(0, 60).map((c) => <a key={c.code} className="code-pill" href={'#/scan/' + c.code} title="Activate">{c.code}</a>)}{qr && qr.codes.length > 60 && <span className="muted small">+{qr.codes.length - 60} more</span>}</div>
          <p className="small muted">QR links go to <b>{qr?.base}/s/&lt;code&gt;</b>. Use a domain you own before printing real stickers.</p></div>
      </div>
      <div className="lab-preview">{url ? <iframe title="labels" src={url} data-testid="lab-frame" /> : <div className="empty-view">Press <b>Make PDF</b> to preview the sheet</div>}</div>
    </div>
  </div>;
}

// ---------- reports ----------
export function Reports({ actx }) {
  const [method, setMethod] = useState('SL half-year'); const [year, setYear] = useState(new Date().getFullYear());
  const R = ({ icon, title, desc, href, id }) => <a className="rep" href={href} data-testid={'rep-' + id}><span className="big-ico">{icon}</span><span className="grow"><b>{title}</b><br /><span className="small muted">{desc}</span></span><Download size={18} /></a>;
  return <div className="pad2 reports" data-testid="reports-page"><h2 className="ag-title">📊 Reports (CSV for Excel)</h2>
    <R id="all" icon="📦" title="All asset data" desc="Every asset with all fields, GPS and values" href="/api/assets-report/all" />
    <R id="assignment" icon="📤" title="Asset assignment" desc="Who has what, since when, return date, overdue" href="/api/assets-report/assignment" />
    <R id="history" icon="🕓" title="Change history" desc="Every scan, check in/out and edit with user, time and GPS" href="/api/assets-report/history" />
    <div className="rep"><span className="big-ico">💰</span><span className="grow"><b>Fixed asset depreciation</b><br /><span className="small muted">Uses Original cost, Salvage value, Asset life and Date purchased</span>
      <div className="row-gap"><select className="text-input" value={method} onChange={(e) => setMethod(e.target.value)} data-testid="rep-method">{['SL half-year', 'SL monthly', 'DB150', 'DB200'].map((m) => <option key={m}>{m}</option>)}</select><input className="text-input" type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} /></div></span>
      <a className="btn primary" href={`/api/assets-report/depreciation?method=${encodeURIComponent(method)}&year=${year}`} data-testid="rep-dep"><Download size={16} /> CSV</a></div>
  </div>;
}

// ---------- settings: built-in field toggles, custom fields, public fields, alerts ----------
export function Settings({ actx }) {
  const [s, setS] = useState(JSON.parse(JSON.stringify(actx.data.settings))); const [msg, setMsg] = useState('');
  const ro = !actx.isAdmin;
  const save = async () => { await api.put('/assets/settings', s); await actx.reload(); setMsg('✅ Saved'); setTimeout(() => setMsg(''), 2000); };
  const upF = (list, k, p) => setS({ ...s, [list]: s[list].map((f) => (f.key === k ? { ...f, ...p } : f)) });
  const al = s.alerts; const setAl = (p) => setS({ ...s, alerts: { ...al, ...p } });
  const opts = (f, list) => f.type === 'dropdown' && <input className="text-input small-in" disabled={ro} value={(f.options || []).join(', ')} onChange={(e) => upF(list, f.key, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="Choices, comma separated" />;
  return <div className="pad2 settings-page" data-testid="settings-page">
    <div className="as-toolbar"><h2 className="ag-title">⚙️ Customization</h2>{ro && <span className="muted">Only a Group administrator can change this.</span>}<span className="grow" />{msg}<button className="btn primary" disabled={ro} onClick={save} data-testid="set-save"><Save size={16} /> Save</button></div>
    <div className="set-grid">
      <section><h3>Built-in fields</h3>{s.fields.map((f) => <div key={f.key} className="set-row"><label className="switch-row"><input type="checkbox" disabled={ro || f.always} checked={f.on || f.always} onChange={(e) => upF('fields', f.key, { on: e.target.checked })} data-testid={'set-on-' + f.key} /> Use</label>
        <input className="text-input" disabled={ro} value={f.label} onChange={(e) => upF('fields', f.key, { label: e.target.value })} /><span className="muted small">{f.type}{f.always ? ' · always' : ''}</span>{opts(f, 'fields')}</div>)}</section>
      <section><h3>Custom fields</h3>{s.custom.map((f) => <div key={f.key} className="set-row"><input className="text-input" disabled={ro} value={f.label} onChange={(e) => upF('custom', f.key, { label: e.target.value })} data-testid="set-custom-label" />
        <select className="text-input" disabled={ro} value={f.type} onChange={(e) => upF('custom', f.key, { type: e.target.value })}>{['text', 'dropdown', 'number', 'date'].map((t) => <option key={t}>{t}</option>)}</select>
        <button className="icon-btn" disabled={ro} onClick={() => setS({ ...s, custom: s.custom.filter((x) => x.key !== f.key) })}><Trash2 size={15} /></button>{opts(f, 'custom')}</div>)}
        <button className="btn" disabled={ro} onClick={() => setS({ ...s, custom: [...s.custom, { key: 'c_' + Math.random().toString(36).slice(2, 8), label: 'New field', type: 'text' }] })} data-testid="set-add-custom"><Plus size={15} /> Add custom field</button>
        <h3>Shown to the public when they scan</h3>{[...s.fields.filter((f) => f.on), ...s.custom].map((f) => <label key={f.key} className="ck-row"><input type="checkbox" disabled={ro} checked={s.public_fields.includes(f.key)} onChange={(e) => setS({ ...s, public_fields: e.target.checked ? [...s.public_fields, f.key] : s.public_fields.filter((k) => k !== f.key) })} /> {f.label}</label>)}
        <h3>Account</h3><label className="mini-label">Company name (on labels and public scan page)</label><input className="text-input" disabled={ro} value={s.org} onChange={(e) => setS({ ...s, org: e.target.value })} />
        <h3>Alerts</h3>
        <label className="mini-label">Notification email</label><input className="text-input" disabled={ro} value={al.email} onChange={(e) => setAl({ email: e.target.value })} placeholder="name@company.no" />
        <label className="mini-label">Alternate emails</label><input className="text-input" disabled={ro} value={al.alt_emails} onChange={(e) => setAl({ alt_emails: e.target.value })} />
        <label className="mini-label">Mobile phone</label><input className="text-input" disabled={ro} value={al.phone} onChange={(e) => setAl({ phone: e.target.value })} />
        <label className="mini-label">Time zone</label><input className="text-input" disabled={ro} value={al.timezone} onChange={(e) => setAl({ timezone: e.target.value })} />
        {[['inventory', 'Inventory quantity tracking'], ['low_inventory', 'Low-inventory alerts'], ['overdue', 'Overdue asset alerts'], ['service', 'Scheduled service alerts'], ['doc_public', 'Documentation link visible to anyone who scans']].map(([k, l]) => <label key={k} className="ck-row"><input type="checkbox" disabled={ro} checked={!!al[k]} onChange={(e) => { setAl({ [k]: e.target.checked }); if (k === 'inventory') setS((x) => ({ ...x, alerts: { ...x.alerts, inventory: e.target.checked }, fields: x.fields.map((f) => (['quantity', 'min_quantity'].includes(f.key) ? { ...f, on: e.target.checked } : f)) })); }} data-testid={'set-al-' + k} /> {l}</label>)}
        <p className="small muted">Alerts arrive as 🔔 mondo notifications and phone push for Group administrators. (Email/SMS sending isn't set up yet.)</p>
      </section>
    </div>
  </div>;
}
