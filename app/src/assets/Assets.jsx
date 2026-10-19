import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api.js';
import { Modal, Menu, dialog, Avatar } from '../ui.jsx';
import { allColumns, DEFAULT_COLS, statusColor, ago, when, kr, titleOf, photoUrl, getPos, resizeImage, fileToDataUrl, today, PRIO, normCode } from './lib.js';
import { ScanFlow, ScanModal } from './Scan.jsx';
import { AssetMap, Agenda, Tasks, Messages, Labels, Reports, Settings } from './AssetPages.jsx';
import { Tag, Map as MapIcon, CalendarDays, ListChecks, MessageSquare, Printer, BarChart3, Settings as Cog, Camera, Plus, Search, Columns3, Download, RotateCcw, Layers, MapPin, X, LogOut as OutIcon, LogIn as InIcon, ArrowLeftRight, Pencil, History, Copy, Trash2, Image as ImageIcon, Paperclip, Link2, Send, MoreHorizontal, Navigation, ExternalLink, Filter, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';

export const goto = (h, replace) => { if (replace) { history.replaceState(null, '', '/' + h); window.dispatchEvent(new HashChangeEvent('hashchange')); } else window.location.hash = h; };
const TABS = [['assets', 'Assets', Tag], ['assets-map', 'Map', MapIcon], ['assets-agenda', 'Agenda', CalendarDays], ['assets-tasks', 'Tasks', ListChecks], ['assets-messages', 'Messages', MessageSquare], ['assets-labels', 'Labels', Printer], ['assets-reports', 'Reports', BarChart3], ['assets-settings', 'Settings', Cog]];

export default function AssetsModule({ hash, ctx, user }) {
  const [data, setData] = useState(null); const [scan, setScan] = useState(false); const [err, setErr] = useState('');
  const reload = useCallback(() => api.get('/assets').then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => { reload(); }, [reload]);
  const [path, query] = hash.slice(2).split('?'); const parts = path.split('/'); const q = new URLSearchParams(query || '');
  const tab = parts[0] === 'scan' ? 'scan' : parts[0];
  const actx = { ...ctx, data, reload, user, isAdmin: user.role === 'admin', openScan: () => setScan(true) };
  let body;
  if (tab === 'scan' && parts[1]) body = <ScanFlow key={parts[1]} code={normCode(parts[1]) || parts[1]} go={(h, r) => { reload(); goto(h, r); }} />;
  else if (tab === 'scan') body = <ScanModal go={goto} onClose={() => goto('#/assets', true)} />;
  else if (!data) body = <div className="loading">{err || 'Loading…'}</div>;
  else if (tab === 'assets' && parts[1] === 'code') body = <CodeJump code={parts[2]} />;
  else if (tab === 'assets-map') body = <AssetMap actx={actx} focus={q.get('a')} />;
  else if (tab === 'assets-agenda') body = <Agenda actx={actx} />;
  else if (tab === 'assets-tasks') body = <Tasks actx={actx} />;
  else if (tab === 'assets-messages') body = <Messages actx={actx} />;
  else if (tab === 'assets-labels') body = <Labels actx={actx} preset={q.get('codes')} />;
  else if (tab === 'assets-reports') body = <Reports actx={actx} />;
  else if (tab === 'assets-settings') body = <Settings actx={actx} />;
  else body = <AssetList actx={actx} openId={parts[1]} q={q} />;
  return (
    <div className="assets-mod" data-testid="assets-mod">
      <div className="as-head">
        <h1 className="as-title"><span className="as-logo">🏷️</span> Assets</h1>
        <nav className="as-tabs">{TABS.map(([k, label, I]) => <a key={k} href={'#/' + k} className={'as-tab' + (tab === k ? ' on' : '')} data-testid={'as-tab-' + k}><I size={16} /><span>{label}</span>{k === 'assets-messages' && data && data.assets.some((a) => a.last_message) ? <i className="dot" /> : null}</a>)}</nav>
        <button className="btn primary scan-btn" onClick={() => setScan(true)} data-testid="as-scan"><Camera size={18} /> Scan</button>
      </div>
      <div className="as-body">{body}</div>
      {scan && <ScanModal go={goto} onClose={() => setScan(false)} />}
    </div>
  );
}

function CodeJump({ code }) { // link from a board cell: open the asset (no scan recorded)
  const [msg, setMsg] = useState('Opening ' + code + '…');
  useEffect(() => { api.get('/scan/' + encodeURIComponent(code)).then((r) => { if (r.kind === 'asset') goto('#/assets/' + r.id, true); else if (r.kind === 'unassigned') goto('#/scan/' + r.code, true); else setMsg('No asset with code ' + code); }); }, [code]);
  return <div className="loading">{msg}</div>;
}

const isPhone = () => window.innerWidth < 760;
function AssetList({ actx, openId, q }) {
  const { data, reload } = actx; const s = data.settings;
  const cols = useMemo(() => allColumns(s, actx.people), [s, actx.people]);
  const [vis, setVis] = useState(() => JSON.parse(localStorage.getItem('as-cols') || 'null') || DEFAULT_COLS);
  const [search, setSearch] = useState(''); const [filters, setFilters] = useState({}); const [showF, setShowF] = useState(false);
  const [group, setGroup] = useState(false); const [page, setPage] = useState(0); const [sel, setSel] = useState(new Set()); const [colMenu, setColMenu] = useState(false);
  const [edit, setEdit] = useState(null); const [newA, setNewA] = useState(false); const [sort, setSort] = useState(null); const [phone, setPhone] = useState(isPhone());
  useEffect(() => { const f = () => setPhone(isPhone()); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  useEffect(() => localStorage.setItem('as-cols', JSON.stringify(vis)), [vis]);
  const shown = vis.map((k) => cols.find((c) => c.key === k)).filter(Boolean);
  let rows = data.assets.filter((a) => {
    if (search) { const t = search.toLowerCase(); if (!JSON.stringify([a.code, a.legacy_code, a.data, a.assigned_to]).toLowerCase().includes(t)) return false; }
    return Object.entries(filters).every(([k, v]) => !v || String(cols.find((c) => c.key === k)?.get(a) ?? '').toLowerCase().includes(v.toLowerCase()));
  });
  if (sort) { const c = cols.find((x) => x.key === sort.k) || { get: (a) => a.code }; rows = [...rows].sort((x, y) => String(c.get(x)).localeCompare(String(c.get(y)), 'nb', { numeric: true }) * sort.d); }
  const PER = 50; const pages = Math.max(1, Math.ceil(rows.length / PER)); const pg = Math.min(page, pages - 1); const pageRows = rows.slice(pg * PER, pg * PER + PER);
  const groups = group ? [...new Set(pageRows.map((a) => a.data.asset_type || '—'))].map((g) => [g, pageRows.filter((a) => (a.data.asset_type || '—') === g)]) : [[null, pageRows]];
  const save = async (a, key, v) => {
    if (['assigned_to', 'checked_out', 'return_date', 'current_value', 'end_of_life', 'updated', 'updated_by', 'last_seen', 'last_message'].includes(key)) return;
    if (key === 'legacy_code') await api.patch('/assets/' + a.id, { legacy_code: v }); else await api.patch('/assets/' + a.id, { data: { [key]: v } });
    reload();
  };
  const toggle = (id, multi) => setSel((p) => { const n = new Set(multi ? p : []); if (p.has(id) && multi) n.delete(id); else n.add(id); return n; });
  const open = openId && data.assets.find((a) => a.id === openId);
  const selCodes = data.assets.filter((a) => sel.has(a.id)).map((a) => a.code);
  const exportCsv = () => { window.location.href = '/api/assets-report/all'; };
  return (
    <div className="as-list">
      <div className="as-toolbar">
        <div className="as-search"><Search size={16} /><input placeholder="Search everything (serial, model, place, code…)" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} data-testid="as-search" /></div>
        <button className="btn primary" onClick={() => setNewA(true)} data-testid="as-new"><Plus size={16} /> {phone ? 'New' : 'New asset'}</button>
        {!phone && <>
          <button className={'btn' + (group ? ' on' : '')} onClick={() => setGroup(!group)} title="Group by asset type" data-testid="as-group"><Layers size={16} /> Group</button>
          <button className={'btn' + (showF ? ' on' : '')} onClick={() => setShowF(!showF)} data-testid="as-filters"><Filter size={16} /> Filters</button>
          <button className="btn" onClick={(e) => setColMenu(e.currentTarget)} data-testid="as-columns"><Columns3 size={16} /> Columns</button>
          <button className="btn" onClick={() => goto('#/assets-labels' + (selCodes.length ? '?codes=' + selCodes.join(',') : ''))} data-testid="as-print"><Printer size={16} /> Print labels{selCodes.length ? ` (${selCodes.length})` : ''}</button>
          <button className="btn" onClick={exportCsv} data-testid="as-export"><Download size={16} /> Export</button>
          <button className="btn ghost" onClick={() => { setVis(DEFAULT_COLS); setFilters({}); setSort(null); setGroup(false); setSearch(''); }} title="Reset grid"><RotateCcw size={16} /></button>
        </>}
      </div>
      <div className="as-count muted small">{rows.length} assets · {data.unassigned} unused tags {sel.size > 0 && <>· <b>{sel.size} selected</b> <button className="link-btn" onClick={() => setSel(new Set())}>clear</button></>}</div>
      {phone ? <div className="as-cards" data-testid="as-cards">{pageRows.map((a) => <AssetCard key={a.id} a={a} />)}</div> : (
        <div className="as-table-wrap"><table className="as-table" data-testid="as-table">
          <thead><tr><th className="ck"><input type="checkbox" checked={pageRows.length > 0 && pageRows.every((a) => sel.has(a.id))} onChange={(e) => setSel(e.target.checked ? new Set(pageRows.map((a) => a.id)) : new Set())} /></th>
            <th onClick={() => setSort({ k: 'code', d: sort?.k === 'code' ? -sort.d : 1 })}>Asset ID</th>{shown.map((c) => <th key={c.key} onClick={() => setSort({ k: c.key, d: sort?.k === c.key ? -sort.d : 1 })}>{c.label}{sort?.k === c.key ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}</th>)}</tr>
            {showF && <tr className="frow"><th /><th><input placeholder="filter" value={filters.code || ''} onChange={(e) => setFilters({ ...filters, code: e.target.value })} /></th>{shown.map((c) => <th key={c.key}><input placeholder="filter" value={filters[c.key] || ''} onChange={(e) => { setFilters({ ...filters, [c.key]: e.target.value }); setPage(0); }} data-testid={'as-f-' + c.key} /></th>)}</tr>}
          </thead>
          <tbody>{groups.map(([g, list]) => <React.Fragment key={g || 'all'}>
            {g && <tr className="grow-row"><td colSpan={shown.length + 2}><b>{g}</b> <span className="muted">({list.length})</span></td></tr>}
            {list.map((a) => <tr key={a.id} className={sel.has(a.id) ? 'sel' : ''} onClick={(e) => (e.ctrlKey || e.metaKey) && toggle(a.id, true)} data-testid="as-row">
              <td className="ck"><input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id, true)} /></td>
              <td className="idc"><a href={'#/assets/' + a.id} data-testid="as-open">{a.code}</a>{a.photo && <Camera size={13} className="ico" />}{a.last_lat != null && <MapPin size={13} className="ico" />}</td>
              {shown.map((c) => <td key={c.key} onDoubleClick={() => setEdit({ a, c })} title="Double-click to edit" data-testid={'as-cell-' + c.key}>
                {edit && edit.a.id === a.id && edit.c.key === c.key ? <CellEdit c={c} v={c.get(a)} onDone={(v) => { setEdit(null); if (v !== undefined && v !== c.get(a)) save(a, c.key, v); }} /> : <CellView c={c} a={a} />}</td>)}
            </tr>)}
          </React.Fragment>)}</tbody>
        </table>{!rows.length && <div className="empty-view">No assets match. <button className="link-btn" onClick={() => { setSearch(''); setFilters({}); }}>Clear search</button></div>}</div>)}
      {pages > 1 && <div className="pager"><button className="btn small" disabled={pg === 0} onClick={() => setPage(pg - 1)}><ChevronLeft size={14} /></button> Page {pg + 1} / {pages} <button className="btn small" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}><ChevronRight size={14} /></button></div>}
      {colMenu && <ColumnPicker anchor={colMenu} cols={cols} vis={vis} setVis={setVis} onClose={() => setColMenu(false)} />}
      {newA && <EditInfo actx={actx} onClose={() => setNewA(false)} onSaved={(a) => { setNewA(false); reload(); goto('#/assets/' + a.id); }} />}
      {open && <AssetDetail key={open.id} actx={actx} a={open} q={q} onClose={() => goto('#/assets')} />}
      {openId && !open && <div className="loading">Asset not found</div>}
    </div>
  );
}
function CellView({ c, a }) {
  const v = c.get(a); if (v === '' || v == null) return <span className="muted">—</span>;
  if (c.key === 'status') return <span className="st-pill" style={{ background: statusColor(v) }}>{v}</span>;
  if (c.key === 'assigned_to') return <span className="as-assigned">📤 {v}</span>;
  if (c.key === 'return_date' && a.checked_out && v < today()) return <span className="overdue">⏰ {v}</span>;
  if (c.field?.type === 'url' || /^https?:/.test(v)) return <a href={v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>🔗 link</a>;
  return <span>{c.fmt ? c.fmt(v) : String(v)}</span>;
}
function CellEdit({ c, v, onDone }) {
  const [x, setX] = useState(v ?? ''); const t = c.field?.type;
  const done = (val) => onDone(val);
  if (t === 'dropdown') return <select autoFocus className="cell-input" value={x} onChange={(e) => done(e.target.value)} onBlur={() => done(undefined)} data-testid="as-cell-edit"><option value="">—</option>{(c.field.options || []).map((o) => <option key={o}>{o}</option>)}{x && !(c.field.options || []).includes(x) && <option>{x}</option>}</select>;
  return <input autoFocus className="cell-input" type={t === 'date' ? 'date' : t === 'number' ? 'number' : 'text'} value={x} onChange={(e) => setX(e.target.value)} onBlur={() => done(x)} onKeyDown={(e) => { if (e.key === 'Enter') done(x); if (e.key === 'Escape') done(undefined); }} data-testid="as-cell-edit" />;
}
function ColumnPicker({ anchor, cols, vis, setVis, onClose }) {
  const ref = useRef(); const r = anchor.getBoundingClientRect();
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target) && !anchor.contains(e.target)) onClose(); }; setTimeout(() => document.addEventListener('mousedown', h)); return () => document.removeEventListener('mousedown', h); }, []);
  return <div ref={ref} className="popover col-pick" style={{ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 300), width: 290 }} data-testid="as-colpick">
    <div className="small muted pad">Show columns (order = click order)</div>
    {cols.map((c) => <label key={c.key} className="ck-row"><input type="checkbox" checked={vis.includes(c.key)} onChange={(e) => setVis(e.target.checked ? [...vis, c.key] : vis.filter((k) => k !== c.key))} data-testid={'as-col-' + c.key} /> {c.label}</label>)}
  </div>;
}
function AssetCard({ a }) {
  const p = photoUrl(a);
  return <a className="as-card" href={'#/assets/' + a.id} data-testid="as-card">
    <span className="as-thumb">{p ? <img src={p} alt="" /> : <Tag size={22} />}</span>
    <span className="as-card-main"><b>{titleOf(a)}</b> <span className="muted">{a.data.model}</span><br />
      <span className="code-pill">{a.code}</span> {a.data.status && <span className="st-pill" style={{ background: statusColor(a.data.status) }}>{a.data.status}</span>}<br />
      <span className="small muted">{a.checked_out ? <>📤 {a.assigned_to}{a.return_date && a.return_date < today() ? <b className="overdue"> · overdue</b> : ''}</> : <>🏠 {a.data.home_location || '—'}</>}{a.last_seen && <> · 📍 {ago(a.last_seen)}</>}</span></span>
  </a>;
}

// ---------- detail ----------
function AssetDetail({ actx, a, q, onClose }) {
  const [d, setD] = useState(null); const [editing, setEditing] = useState(q.get('edit') === '1'); const [out, setOut] = useState(null); const [menu, setMenu] = useState(null); const [tab, setTab] = useState('checks');
  const [banner, setBanner] = useState(q.get('scanned') ? (q.get('scanned') === 'nogps' ? '📷 Scan saved – no GPS (location not allowed)' : `📍 Scan saved with GPS (±${q.get('scanned')} m)`) : q.get('activated') ? '🏷️ Tag activated' : '');
  const load = () => api.get('/assets/' + a.id).then(setD);
  useEffect(() => { load(); }, [a.id, a.updated]);
  const s = actx.data.settings; const fields = [...s.fields.filter((f) => f.on), ...s.custom];
  const refresh = async () => { await actx.reload(); load(); };
  const photoIn = useRef();
  const setPhoto = async (file) => { if (!file) return; const data = await resizeImage(file); const gps = await getPos(4000); await api.post(`/assets/${a.id}/photo`, { data, gps }); refresh(); };
  const updateLoc = async () => { setBanner('📍 Getting location…'); const p = await getPos(); if (!p) { setBanner('Location not available – allow location for this site'); return; } await api.post(`/assets/${a.id}/scan`, { ...p, note: 'Location updated' }); setBanner(`📍 Location saved (±${p.acc} m)`); refresh(); };
  const fin = ['date_purchased', 'original_cost', 'salvage_value', 'asset_life'].filter((k) => s.fields.find((f) => f.key === k)?.on);
  const label = (k) => fields.find((f) => f.key === k)?.label || k;
  const pic = photoUrl(a);
  return (
    <div className="as-drawer-back" onMouseDown={onClose}><div className="as-drawer" onMouseDown={(e) => e.stopPropagation()} data-testid="as-detail">
      <div className="asd-top"><button className="icon-btn" onClick={onClose} data-testid="asd-close"><X size={22} /></button><span className="grow" />
        <button className="btn small" onClick={() => setEditing(true)} data-testid="asd-edit"><Pencil size={14} /> Edit info</button>
        <button className="icon-btn" onClick={(e) => setMenu(e.currentTarget)} data-testid="asd-menu"><MoreHorizontal size={20} /></button></div>
      {banner && <div className="asd-banner" data-testid="asd-banner">{banner}</div>}
      <div className="asd-head">
        <div className="asd-photo" onClick={() => photoIn.current.click()} title="Change photo" data-testid="asd-photo">{pic ? <img src={pic} alt="" /> : <span><ImageIcon size={30} /><br />Add photo</span>}</div>
        <input ref={photoIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => setPhoto(e.target.files[0])} data-testid="asd-photo-input" />
        <div className="asd-titles"><h2 data-testid="asd-title">{titleOf(a)}</h2><div><span className="code-pill big" data-testid="asd-code">{a.code}</span> {a.data.group && <span className="muted">· {a.data.group}</span>}</div>
          {a.legacy_code && <div className="small muted">Old GoCodes ID: {a.legacy_code}</div>}
          <div className="asd-sub">{a.data.model} {a.data.serial && <>· SN {a.data.serial}</>}</div>
          {a.data.description && <div className="small">{a.data.description}</div>}
          {a.data.status && <span className="st-pill" style={{ background: statusColor(a.data.status) }}>{a.data.status}</span>}</div>
      </div>
      <div className="asd-box asd-loc"><div className="asd-row"><MapPin size={18} /><div className="grow">{a.last_lat != null ? <><b>Location updated {ago(a.last_seen)}</b><div className="small muted">by {a.last_by} {a.last_acc ? `· ±${Math.round(a.last_acc)} m` : ''}</div></> : <b>No GPS yet – scan the tag with a phone</b>}</div>
        <button className="btn small" onClick={updateLoc} data-testid="asd-gps"><Navigation size={14} /> Update</button></div>
        {a.last_lat != null && <><MiniMap a={a} events={d?.events || []} /><div className="row-gap"><a className="btn small" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${a.last_lat},${a.last_lng}`}><ExternalLink size={14} /> Google Maps</a><a className="btn small" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${a.last_lat},${a.last_lng}`}><Navigation size={14} /> Directions</a><a className="btn small" href={'#/assets-map?a=' + a.id}><MapIcon size={14} /> Big map</a></div></>}</div>
      <div className={'asd-box asd-check ' + (a.checked_out ? 'is-out' : 'is-in')} data-testid="asd-check">
        <div className="asd-row"><span className="check-badge">{a.checked_out ? '📤 Checked out' : '✅ Checked in'}</span><span className="grow" />
          {a.checked_out ? <><button className="btn small" onClick={() => setOut('transfer')} data-testid="asd-transfer"><ArrowLeftRight size={14} /> Transfer</button><button className="btn primary" onClick={() => setOut('in')} data-testid="asd-checkin"><InIcon size={16} /> Check in</button></> : <button className="btn primary" onClick={() => setOut('out')} data-testid="asd-checkout"><OutIcon size={16} /> Check out</button>}</div>
        {a.checked_out && <div className="small">To <b data-testid="asd-assigned">{a.assigned_to}</b> since {when(a.checked_out_at)}{a.return_date && <> · return <b className={a.return_date < today() ? 'overdue' : ''}>{a.return_date}</b></>}</div>}
      </div>
      {fin.length > 0 && <div className="asd-box"><div className="asd-h">💰 Financial</div><dl className="kv">{fin.map((k) => a.data[k] != null && <React.Fragment key={k}><dt>{label(k)}</dt><dd>{k.includes('cost') || k.includes('value') ? kr(a.data[k]) : a.data[k]}</dd></React.Fragment>)}
        {a.current_value != null && <><dt>Current value</dt><dd><b>{kr(a.current_value)}</b> <span className="muted small">(straight line)</span></dd></>}{a.end_of_life && <><dt>End of life</dt><dd>{a.end_of_life}</dd></>}</dl></div>}
      <div className="asd-box"><div className="asd-h">📋 Other</div><dl className="kv">
        <dt>Home location</dt><dd>{a.data.home_location || '—'}</dd>
        {fields.filter((f) => !['asset_type', 'model', 'serial', 'description', 'group', 'status', 'home_location', ...fin].includes(f.key) && a.data[f.key] != null && a.data[f.key] !== '').map((f) => <React.Fragment key={f.key}><dt>{f.label}</dt><dd>{/^https?:/.test(a.data[f.key]) ? <a href={a.data[f.key]} target="_blank" rel="noreferrer">🔗 open</a> : String(f.key.includes('cost') ? kr(a.data[f.key]) : a.data[f.key])}</dd></React.Fragment>)}</dl></div>
      <div className="asd-tabs">{[['checks', 'Check In/Out'], ['tasks', 'Tasks'], ['docs', 'Documents'], ['msgs', 'Messages'], ['jobs', 'Jobs'], ['hist', 'History']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={'asd-tab-' + k}>{l}{d && k === 'tasks' && d.tasks.filter((t) => !t.done).length ? ` (${d.tasks.filter((t) => !t.done).length})` : ''}{d && k === 'msgs' && d.messages.length ? ` (${d.messages.length})` : ''}{d && k === 'jobs' && d.jobs.length ? ` (${d.jobs.length})` : ''}</button>)}</div>
      {!d ? <div className="muted pad">Loading…</div> : <div className="asd-sec">
        {tab === 'checks' && <EventList events={d.events.filter((e) => ['checkout', 'checkin', 'transfer'].includes(e.type))} empty="Never checked out" />}
        {tab === 'tasks' && <TaskBox a={a} d={d} actx={actx} reload={load} />}
        {tab === 'docs' && <DocBox a={a} d={d} reload={load} />}
        {tab === 'msgs' && <MsgBox a={a} d={d} reload={load} />}
        {tab === 'jobs' && <JobBox a={a} d={d} actx={actx} reload={load} />}
        {tab === 'hist' && <EventList events={d.events} empty="No history" />}
      </div>}
      {menu && <Menu anchor={menu} onClose={() => setMenu(null)} items={[
        { label: 'Edit info', icon: Pencil, onClick: () => setEditing(true) },
        { label: 'History', icon: History, onClick: () => setTab('hist') },
        { label: 'Print label', icon: Printer, onClick: () => goto('#/assets-labels?codes=' + a.code) },
        { label: 'Copy to another tag', icon: Copy, onClick: async () => { const c = await dialog.prompt('Copy info to which tag? (scan or type code)'); if (!c) return; try { const n = await api.post(`/assets/${a.id}/copy`, { code: c }); await actx.reload(); goto('#/assets/' + n.id); } catch (e) { setBanner('⚠️ ' + e.message); } } },
        actx.isAdmin && '-', actx.isAdmin && { label: 'Deactivate', icon: Trash2, danger: true, onClick: async () => { if (await dialog.confirm(`Deactivate ${a.code}?`, 'Deactivate')) { await api.post(`/assets/${a.id}/deactivate`); await actx.reload(); onClose(); } } },
      ]} />}
      {editing && <EditInfo actx={actx} a={a} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />}
      {out && <CheckModal mode={out} a={a} actx={actx} onClose={() => setOut(null)} onDone={(msg) => { setOut(null); setBanner(msg); refresh(); }} />}
    </div></div>
  );
}
function MiniMap({ a, events }) {
  const el = useRef(); const m = useRef();
  useEffect(() => {
    m.current = L.map(el.current, { zoomControl: false, attributionControl: false, dragging: !L.Browser.mobile, scrollWheelZoom: false }).setView([a.last_lat, a.last_lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m.current);
    return () => m.current.remove();
  }, []);
  useEffect(() => {
    const pts = events.filter((e) => e.lat != null).reverse().map((e) => [e.lat, e.lng]);
    const lay = L.layerGroup().addTo(m.current);
    if (pts.length > 1) L.polyline(pts, { color: '#579bfc', weight: 3, dashArray: '6 6' }).addTo(lay);
    pts.forEach((p) => L.circleMarker(p, { radius: 4, color: '#579bfc', fillOpacity: 0.8 }).addTo(lay));
    if (a.last_acc) L.circle([a.last_lat, a.last_lng], { radius: a.last_acc, color: '#00c875', weight: 1, fillOpacity: 0.12 }).addTo(lay);
    L.marker([a.last_lat, a.last_lng], { icon: L.divIcon({ className: 'pin-icon', html: `<span style="background:${statusColor(a.data.status)}"></span>`, iconSize: [28, 36], iconAnchor: [14, 34] }) }).addTo(lay);
    return () => lay.remove();
  }, [events.length, a.last_lat]);
  return <div ref={el} className="mini-map" data-testid="asd-map" />;
}
const EV_ICON = { create: '✨', scan: '📍', checkout: '📤', checkin: '📥', transfer: '🔁', edit: '✏️', photo: '📷', task: '📋', doc: '📎', message: '💬', activate: '🏷️', job: '🧰', deactivate: '🚫' };
function EventList({ events, empty }) {
  if (!events.length) return <div className="muted pad">{empty}</div>;
  return <div className="ev-list" data-testid="ev-list">{events.map((e) => <div key={e.id} className="ev"><span className="ev-ico">{EV_ICON[e.type] || '•'}</span><div className="grow"><div>{e.text}</div><div className="small muted">{when(e.created)} · {e.who_name}{e.lat != null && <> · <a href={`https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`} target="_blank" rel="noreferrer">📍 {e.lat.toFixed(4)}, {e.lng.toFixed(4)}{e.acc ? ` ±${Math.round(e.acc)} m` : ''}</a></>}</div></div></div>)}</div>;
}
function TaskBox({ a, d, actx, reload }) {
  const [t, setT] = useState({ title: '', priority: 'Medium', assignee: '', due: '' });
  return <div>
    {d.tasks.map((x) => <div key={x.id} className={'task' + (x.done ? ' done' : '')} data-testid="asd-task"><input type="checkbox" checked={!!x.done} onChange={async (e) => { await api.patch('/asset-tasks/' + x.id, { done: e.target.checked }); reload(); }} />
      <span className="prio" style={{ background: PRIO[x.priority] }}>{x.priority}</span><span className="grow">{x.title}</span>{x.assignee && <Avatar person={actx.people.find((p) => p.id === x.assignee)} size={22} />}<span className={'small ' + (x.due && x.due < today() && !x.done ? 'overdue' : 'muted')}>{x.due}</span></div>)}
    <div className="task-new"><input className="text-input" placeholder="New task…" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} data-testid="asd-task-title" />
      <select className="text-input" value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value })}>{Object.keys(PRIO).map((p) => <option key={p}>{p}</option>)}</select>
      <select className="text-input" value={t.assignee} onChange={(e) => setT({ ...t, assignee: e.target.value })}><option value="">Nobody</option>{actx.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input className="text-input" type="date" value={t.due} onChange={(e) => setT({ ...t, due: e.target.value })} />
      <button className="btn primary" disabled={!t.title.trim()} onClick={async () => { await api.post(`/assets/${a.id}/tasks`, { ...t, assignee: t.assignee || null, due: t.due || null }); setT({ title: '', priority: 'Medium', assignee: '', due: '' }); reload(); }} data-testid="asd-task-add"><Plus size={14} /> New task</button></div>
  </div>;
}
function DocBox({ a, d, reload }) {
  const inp = useRef(); const [err, setErr] = useState('');
  return <div>
    {d.docs.map((x) => <div key={x.id} className="doc"><Paperclip size={15} /><a className="grow" href={'/api/asset-docs/' + x.id} target="_blank" rel="noreferrer">{x.name}</a><span className="small muted">{x.created.slice(0, 10)}</span><button className="icon-btn" onClick={async () => { if (await dialog.confirm('Remove ' + x.name + '?', 'Remove')) { await api.del('/asset-docs/' + x.id); reload(); } }}><Trash2 size={14} /></button></div>)}
    {!d.docs.length && <div className="muted pad">No documents</div>}
    {err && <div className="err">{err}</div>}
    <div className="row-gap"><button className="btn" onClick={() => inp.current.click()} data-testid="asd-attach"><Paperclip size={14} /> Attach file</button>
      <button className="btn" onClick={async () => { const u = await dialog.prompt('Link (https://…)'); if (u) { try { await api.post(`/assets/${a.id}/docs`, { url: u }); reload(); } catch (e) { setErr(e.message); } } }}><Link2 size={14} /> Add link</button></div>
    <input ref={inp} type="file" hidden onChange={async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 6e6) return setErr('Max 6 MB'); try { await api.post(`/assets/${a.id}/docs`, { name: f.name, data: await fileToDataUrl(f) }); reload(); } catch (er) { setErr(er.message); } }} data-testid="asd-attach-input" />
  </div>;
}
function MsgBox({ a, d, reload }) {
  const [t, setT] = useState(''); const link = d.scan_url;
  return <div>
    <div className="small muted">Public scan link: <a href={link} target="_blank" rel="noreferrer" data-testid="asd-public-link">{link}</a> <button className="link-btn" onClick={() => navigator.clipboard?.writeText(link)}><Copy size={13} /> copy</button></div>
    {d.messages.map((m) => <div key={m.id} className={'msg ' + m.dir}><div><b>{m.dir === 'in' ? '📨 ' + (m.name || 'Finder') : '💬 ' + m.name}</b> <span className="small muted">{when(m.created)}</span></div><div>{m.text}</div>{(m.email || m.phone) && <div className="small">{m.email} {m.phone}</div>}{m.lat != null && <a className="small" href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`} target="_blank" rel="noreferrer">📍 where it was found</a>}</div>)}
    <div className="task-new"><input className="text-input" placeholder="Write a note / message…" value={t} onChange={(e) => setT(e.target.value)} /><button className="btn primary" disabled={!t.trim()} onClick={async () => { await api.post(`/assets/${a.id}/messages`, { text: t }); setT(''); reload(); }}><Send size={14} /> Send</button></div>
  </div>;
}
function JobBox({ a, d, actx, reload }) {
  const boards = actx.boot.boards; const [bid, setBid] = useState(boards.find((b) => /feilmelding/i.test(b.name))?.id || boards[0]?.id);
  return <div>
    <div className="small muted">Board items that mention {a.code}{a.legacy_code ? ' or ' + a.legacy_code : ''} (e.g. the "Gocodes" column on Feilmeldinger):</div>
    {d.jobs.map((j) => <a key={j.id} className="job" href={'#/board/' + j.board_id} data-testid="asd-job"><span>{j.icon}</span><b>{j.name}</b><span className="muted small">{j.board}</span></a>)}
    {!d.jobs.length && <div className="muted pad">No jobs yet</div>}
    <div className="task-new"><select className="text-input" value={bid} onChange={(e) => setBid(e.target.value)}>{boards.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</select>
      <button className="btn primary" onClick={async () => { const r = await api.post(`/assets/${a.id}/job`, { board_id: bid, name: `${titleOf(a)} ${a.data.model || ''} – service (${a.code})` }); await actx.reload(); goto('#/board/' + r.board_id); }} data-testid="asd-new-job"><Briefcase size={14} /> New job</button></div>
  </div>;
}
function CheckModal({ mode, a, actx, onClose, onDone }) {
  const [to, setTo] = useState(''); const [kind, setKind] = useState('person'); const [person, setPerson] = useState(''); const [ret, setRet] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const places = [...new Set(actx.data.assets.map((x) => x.data.home_location).concat(actx.data.assets.map((x) => x.assigned_to)).filter(Boolean))];
  const go = async () => {
    setBusy(true); setErr(''); const gps = await getPos(6000);
    try {
      if (mode === 'in') { await api.post(`/assets/${a.id}/checkin`, { note, ...(gps || {}) }); onDone('📥 Checked in' + (gps ? ` · 📍 ±${gps.acc} m` : '')); }
      else { await api.post(`/assets/${a.id}/checkout`, { to: kind === 'person' ? (actx.people.find((p) => p.id === person)?.name || to) : to, person: kind === 'person' ? person || null : null, kind, return_date: ret || null, note, ...(gps || {}) }); onDone((mode === 'transfer' ? '🔁 Transferred' : '📤 Checked out') + (gps ? ` · 📍 ±${gps.acc} m` : '')); }
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return <Modal onClose={onClose} width={460}>
    <h2 className="modal-title">{mode === 'in' ? '📥 Check in' : mode === 'transfer' ? '🔁 Transfer' : '📤 Check out'} {a.code}</h2>
    {mode !== 'in' && <>
      <div className="seg">{[['person', '👤 Person'], ['location', '🏠 Location'], ['job', '🏗️ Job site']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)} data-testid={'co-kind-' + k}>{l}</button>)}</div>
      {kind === 'person' ? <select className="text-input big" value={person} onChange={(e) => setPerson(e.target.value)} data-testid="co-person"><option value="">Pick a person…</option>{actx.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        : <><input className="text-input big" list="co-places" placeholder={kind === 'job' ? 'Customer / job site' : 'Location (e.g. Servicebil 1)'} value={to} onChange={(e) => setTo(e.target.value)} data-testid="co-to" /><datalist id="co-places">{places.map((p) => <option key={p} value={p} />)}</datalist></>}
      <label className="mini-label">Return date (optional – sends an overdue alert)</label><input className="text-input" type="date" value={ret} onChange={(e) => setRet(e.target.value)} data-testid="co-return" />
    </>}
    <label className="mini-label">Note</label><input className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Condition, service request…" data-testid="co-note" />
    <div className="small muted">📍 Your phone's location is saved with it (if allowed).</div>
    {err && <div className="err">{err}</div>}
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary big" disabled={busy || (mode !== 'in' && !(kind === 'person' ? person : to.trim()))} onClick={go} data-testid="co-save">{busy ? 'Saving…' : mode === 'in' ? 'Check in' : mode === 'transfer' ? 'Transfer' : 'Check out'}</button></div>
  </Modal>;
}
export function EditInfo({ actx, a, onClose, onSaved }) {
  const s = actx.data.settings; const fields = [...s.fields.filter((f) => f.on), ...s.custom];
  const [v, setV] = useState({ ...(a?.data || { asset_type: 'Kaffemaskin' }) }); const [legacy, setLegacy] = useState(a?.legacy_code || ''); const [code, setCode] = useState(''); const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    try {
      if (a) { const data = {}; fields.forEach((f) => { if ((v[f.key] ?? '') !== (a.data[f.key] ?? '')) data[f.key] = v[f.key] === '' ? null : v[f.key]; }); const r = await api.patch('/assets/' + a.id, { data, legacy_code: legacy || null }); onSaved(r); }
      else { const r = await api.post('/assets', { code: code || undefined, legacy_code: legacy || undefined, data: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x != null)), gps: await getPos(4000) }); onSaved(r); }
    } catch (e) { setErr(e.message); }
  };
  return <Modal onClose={onClose} width={720}>
    <h2 className="modal-title">{a ? '✏️ Edit ' + a.code : '✨ New asset'}</h2>
    <div className="form-grid two" data-testid="edit-info">
      {!a && <label>Asset ID (empty = new code)<input className="text-input" placeholder="auto" value={code} onChange={(e) => setCode(e.target.value)} data-testid="ei-code" /></label>}
      <label>Old GoCodes ID<input className="text-input" placeholder="XXXX-XXXX" value={legacy} onChange={(e) => setLegacy(e.target.value)} data-testid="ei-legacy" /></label>
      {fields.map((f) => <label key={f.key}>{f.label}{f.type === 'dropdown' ? <select className="text-input" value={v[f.key] || ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} data-testid={'ei-' + f.key}><option value="">—</option>{(f.options || []).map((o) => <option key={o}>{o}</option>)}{v[f.key] && !(f.options || []).includes(v[f.key]) && <option>{v[f.key]}</option>}</select>
        : <input className="text-input" type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'} value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: f.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value })} data-testid={'ei-' + f.key} />}</label>)}
    </div>
    {err && <div className="err">{err}</div>}
    <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} data-testid="ei-save">Save</button></div>
  </Modal>;
}
