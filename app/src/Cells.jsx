import React, { useRef, useState } from 'react';
import { Popover, Avatar, ColorGrid } from './ui.jsx';
import { PALETTE, fmtDate, todayStr, isoWeek, weekAdd, fmtWeek } from './constants.js';
import { uid } from './api.js';
import { LocationCell, locText } from './Location.jsx';
import { Plus, Pencil, Trash2, Check, X, ExternalLink, UserPlus, AlertCircle, Play, Pause, Network } from 'lucide-react';

export function LabelEditor({ col, onUpdateColumn }) {
  const labels = col.settings.labels || [];
  const [colorFor, setColorFor] = useState(null);
  const set = (labels) => onUpdateColumn({ ...col, settings: { ...col.settings, labels } });
  return (
    <div className="label-editor">
      {labels.map((l) => (
        <div key={l.id} className="label-edit-row">
          <button className="swatch big" style={{ background: l.color }} onClick={() => setColorFor(colorFor === l.id ? null : l.id)} title="Colour" />
          <input defaultValue={l.label} placeholder="(blank)" onBlur={(e) => e.target.value !== l.label && set(labels.map((x) => x.id === l.id ? { ...x, label: e.target.value } : x))} />
          <button className="icon-btn" onClick={() => set(labels.filter((x) => x.id !== l.id))} title="Delete"><Trash2 size={14} /></button>
          {colorFor === l.id && <div className="label-colors"><ColorGrid colors={PALETTE} value={l.color} onPick={(c) => { set(labels.map((x) => x.id === l.id ? { ...x, color: c } : x)); setColorFor(null); }} /></div>}
        </div>
      ))}
      <button className="add-label" onClick={() => set([...labels.filter((l) => l.label !== '' ), { id: uid('l'), label: 'New label', color: PALETTE[(labels.length * 3) % PALETTE.length] }, ...labels.filter((l) => l.label === '')])}><Plus size={14} /> New label</button>
    </div>
  );
}

function StatusCell({ col, value, onChange, onUpdateColumn }) {
  const ref = useRef(); const [open, setOpen] = useState(false); const [editing, setEditing] = useState(false);
  const labels = col.settings.labels || [];
  const cur = labels.find((l) => l.id === value);
  return (
    <>
      <div ref={ref} className="cell-status" style={{ background: cur ? cur.color : '#c4c4c4' }} onClick={() => setOpen(true)} data-testid="status-cell">
        <span>{cur?.label || ''}</span><span className="fold" />
      </div>
      {open && (
        <Popover anchor={ref.current} onClose={() => { setOpen(false); setEditing(false); }} width={editing ? 280 : 200} align="center">
          {editing ? (
            <>
              <LabelEditor col={col} onUpdateColumn={onUpdateColumn} />
              <button className="btn primary full" onClick={() => setEditing(false)}><Check size={14} /> Apply</button>
            </>
          ) : (
            <>
              <div className="label-list">
                {labels.map((l) => (
                  <button key={l.id} className="label-pill" style={{ background: l.color }} onClick={() => { onChange(l.label === '' ? null : l.id); setOpen(false); }}>{l.label || '\u00a0'}</button>
                ))}
              </div>
              {onUpdateColumn && <button className="link-btn" onClick={() => setEditing(true)}><Pencil size={13} /> Edit labels</button>}
            </>
          )}
        </Popover>
      )}
    </>
  );
}

function PeopleCell({ value, onChange, ctx }) {
  const ref = useRef(); const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const ids = value || [];
  const sel = ids.map((id) => ctx.people.find((p) => p.id === id)).filter(Boolean);
  const others = ctx.people.filter((p) => !ids.includes(p.id) && p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div ref={ref} className="cell-people" onClick={() => setOpen(true)} data-testid="people-cell">
        {sel.length ? <div className="avatars">{sel.slice(0, 3).map((p) => <Avatar key={p.id} person={p} ring />)}{sel.length > 3 && <span className="more">+{sel.length - 3}</span>}</div>
          : <span className="empty-person"><UserPlus size={16} /></span>}
      </div>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={260} align="center">
          <div className="chips">{sel.map((p) => <span key={p.id} className="chip"><Avatar person={p} size={20} /> {p.name.split(' ')[0]} <X size={12} onClick={() => onChange(ids.filter((x) => x !== p.id))} /></span>)}</div>
          <input className="text-input" autoFocus placeholder="Search or add name" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="people-list">
            {others.map((p) => <button key={p.id} className="menu-item" onClick={() => onChange([...ids, p.id])}><Avatar person={p} size={22} /> {p.name}</button>)}
            {q.trim() && !ctx.people.some((p) => p.name.toLowerCase() === q.trim().toLowerCase()) && (
              <button className="menu-item" onClick={async () => { const p = await ctx.addPerson(q.trim()); onChange([...ids, p.id]); setQ(''); }}><Plus size={16} /> Add “{q.trim()}”</button>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

function WeekCell({ value, onChange }) {
  const ref = useRef(); const [open, setOpen] = useState(false);
  const base = isoWeek(); const weeks = Array.from({ length: 30 }, (_, k) => weekAdd(base, k - 4));
  return (
    <>
      <div ref={ref} className="cell-center" onClick={() => setOpen(true)} data-testid="week-cell">
        {value ? <span className={'date-text' + (value === base ? ' week-now' : '')}>🗓️ {fmtWeek(value)}</span> : <span className="ghost-plus"><Plus size={14} /></span>}
      </div>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={230} align="center">
          <div className="mini-label">Pick a week</div>
          <div className="week-grid">{weeks.map((w) => <button key={w} className={'week-btn' + (w === value ? ' on' : '') + (w === base ? ' now' : '')} onClick={() => { onChange(w); setOpen(false); }}>{fmtWeek(w).replace('Uke ', '')}</button>)}</div>
          {value && <button className="btn small ghost" onClick={() => { onChange(null); setOpen(false); }}><Trash2 size={13} /> Clear</button>}
        </Popover>
      )}
    </>
  );
}

function DateCell({ value, onChange, ctx }) {
  const ref = useRef(); const [open, setOpen] = useState(false);
  const late = value && value < todayStr() && !ctx.done;
  return (
    <>
      <div ref={ref} className="cell-center" onClick={() => setOpen(true)} data-testid="date-cell">
        {value ? <span className={'date-text' + (late ? ' late' : '')}>{late && <AlertCircle size={13} />} {fmtDate(value)}</span> : <span className="ghost-plus"><Plus size={14} /></span>}
      </div>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={230} align="center">
          <input type="date" className="text-input" autoFocus value={value || ''} onChange={(e) => onChange(e.target.value || null)} />
          <div className="row-gap">
            <button className="btn small" onClick={() => { onChange(todayStr()); setOpen(false); }}>Today</button>
            {value && <button className="btn small ghost" onClick={() => { onChange(null); setOpen(false); }}><Trash2 size={13} /> Clear</button>}
          </div>
        </Popover>
      )}
    </>
  );
}

function TimelineCell({ value, onChange, ctx }) {
  const ref = useRef(); const [open, setOpen] = useState(false);
  const v = value || {};
  let pct = 0;
  if (v.from && v.to) { const a = new Date(v.from), b = new Date(v.to), n = new Date(); pct = Math.max(0, Math.min(100, ((n - a) / Math.max(1, b - a)) * 100)); }
  return (
    <>
      <div ref={ref} className="cell-center" onClick={() => setOpen(true)} data-testid="timeline-cell">
        {v.from ? (
          <div className="timeline-pill" style={{ background: `linear-gradient(90deg, ${ctx.groupColor} ${pct}%, #333 ${pct}%)` }}>
            {fmtDate(v.from)} – {fmtDate(v.to || v.from)}
          </div>
        ) : <span className="ghost-plus"><Plus size={14} /></span>}
      </div>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={250} align="center">
          <label className="mini-label">Start</label>
          <input type="date" className="text-input" value={v.from || ''} onChange={(e) => onChange({ ...v, from: e.target.value, to: v.to && v.to >= e.target.value ? v.to : e.target.value })} />
          <label className="mini-label">End</label>
          <input type="date" className="text-input" value={v.to || ''} min={v.from} onChange={(e) => onChange({ ...v, to: e.target.value, from: v.from || e.target.value })} />
          {v.from && <button className="btn small ghost" onClick={() => { onChange(null); setOpen(false); }}><Trash2 size={13} /> Clear</button>}
        </Popover>
      )}
    </>
  );
}

function DropdownCell({ col, value, onChange, onUpdateColumn }) {
  const ref = useRef(); const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const opts = col.settings.options || []; const ids = value || [];
  const sel = ids.map((id) => opts.find((o) => o.id === id)).filter(Boolean);
  return (
    <>
      <div ref={ref} className="cell-dropdown" onClick={() => setOpen(true)} data-testid="dropdown-cell">
        {sel.length ? sel.map((o) => <span key={o.id} className="tag">{o.label}</span>) : <span className="ghost-plus"><Plus size={14} /></span>}
      </div>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={240} align="center">
          <input className="text-input" autoFocus placeholder="Search or add option" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) addOpt(); }} />
          <div className="people-list">
            {opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).map((o) => (
              <label key={o.id} className="menu-item"><input type="checkbox" checked={ids.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...ids, o.id] : ids.filter((x) => x !== o.id))} /> <span className="tag">{o.label}</span></label>
            ))}
            {q.trim() && !opts.some((o) => o.label.toLowerCase() === q.trim().toLowerCase()) && <button className="menu-item" onClick={addOpt}><Plus size={16} /> Add “{q.trim()}”</button>}
          </div>
        </Popover>
      )}
    </>
  );
  function addOpt() { const o = { id: uid('o'), label: q.trim() }; onUpdateColumn({ ...col, settings: { ...col.settings, options: [...opts, o] } }); onChange([...ids, o.id]); setQ(''); }
}

function TextCell({ value, onChange, type, align }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState('');
  if (edit) return <input className={'cell-input ' + (align || '')} autoFocus type={type === 'numbers' ? 'number' : 'text'} value={v} onChange={(e) => setV(e.target.value)} data-testid="cell-input"
    onBlur={() => { setEdit(false); commit(); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setV(value ?? ''); setEdit(false); } }} />;
  return <div className={'cell-text ' + (align || '')} onClick={() => { setV(value ?? ''); setEdit(true); }} data-testid="text-cell">{display()}</div>;
  function commit() {
    let nv = v.trim();
    if (type === 'numbers') nv = nv === '' ? null : Number(nv);
    if (nv === '') nv = null;
    if (nv !== (value ?? null)) onChange(nv);
  }
  function display() {
    if (value == null || value === '') return <span className="ghost-plus"><Plus size={14} /></span>;
    if (type === 'phone') return <a href={'tel:' + value} onClick={(e) => e.stopPropagation()}>📞 {value}</a>;
    if (type === 'location') return <span className="loc"><a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(value)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Show on map">📍 {value}</a><a className="dir" href={'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(value)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Directions" data-testid="directions">🧭</a></span>;
    if (type === 'email') return <a href={'mailto:' + value} onClick={(e) => e.stopPropagation()}>✉️ {value}</a>;
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(String(value).trim())) return <a className="asset-link" href={'#/assets/code/' + String(value).trim().toUpperCase()} onClick={(e) => e.stopPropagation()} title="Open asset" data-testid="asset-link">🏷️ {value}</a>;
    return value;
  }
}

function NumberCell({ col, value, onChange }) {
  const unit = col.settings.unit;
  const [edit, setEdit] = useState(false);
  if (edit) return <TextCellEdit value={value} onDone={(v) => { setEdit(false); if (v !== value) onChange(v); }} />;
  return <div className="cell-text center" onClick={() => setEdit(true)} data-testid="number-cell">{value == null ? <span className="ghost-plus"><Plus size={14} /></span> : <b>{fmtNum(value)}{unit ? ' ' + unit : ''}</b>}</div>;
}
function TextCellEdit({ value, onDone }) {
  const [v, setV] = useState(value ?? '');
  return <input className="cell-input center" type="number" autoFocus value={v} onChange={(e) => setV(e.target.value)} data-testid="cell-input"
    onBlur={() => onDone(v === '' ? null : Number(v))} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') onDone(value); }} />;
}
export const fmtNum = (n) => Number(n).toLocaleString('nb-NO', { maximumFractionDigits: 2 });

function LongTextCell({ value, onChange }) {
  const ref = useRef(); const [open, setOpen] = useState(false); const [v, setV] = useState('');
  return (
    <>
      <div ref={ref} className="cell-text" onClick={() => { setV(value || ''); setOpen(true); }} data-testid="longtext-cell">{value ? <span className="truncate">{value}</span> : <span className="ghost-plus"><Plus size={14} /></span>}</div>
      {open && (
        <Popover anchor={ref.current} onClose={() => { setOpen(false); if (v !== (value || '')) onChange(v || null); }} width={320}>
          <textarea className="text-input" rows={6} autoFocus value={v} onChange={(e) => setV(e.target.value)} />
        </Popover>
      )}
    </>
  );
}

function LinkCell({ value, onChange }) {
  const ref = useRef(); const [open, setOpen] = useState(false);
  const v = value || {}; const [url, setUrl] = useState(''); const [text, setText] = useState('');
  return (
    <>
      <div ref={ref} className="cell-text" onClick={() => { setUrl(v.url || ''); setText(v.text || ''); setOpen(true); }} data-testid="link-cell">
        {v.url ? <a href={v.url.startsWith('http') ? v.url : 'https://' + v.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> {v.text || v.url}</a> : <span className="ghost-plus"><Plus size={14} /></span>}
      </div>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={280}>
          <label className="mini-label">Web address</label>
          <input className="text-input" autoFocus placeholder="www.example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <label className="mini-label">Text to show</label>
          <input className="text-input" placeholder="Example" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary full" onClick={() => { onChange(url ? { url, text } : null); setOpen(false); }}>Save</button>
        </Popover>
      )}
    </>
  );
}

export function Cell({ col, value, onChange, ctx, onUpdateColumn }) {
  switch (col.type) {
    case 'status': case 'priority': return <StatusCell col={col} value={value} onChange={onChange} onUpdateColumn={onUpdateColumn} />;
    case 'people': return <PeopleCell value={value} onChange={onChange} ctx={ctx} />;
    case 'date': return <DateCell value={value} onChange={onChange} ctx={ctx} />;
    case 'week': return <WeekCell value={value} onChange={onChange} />;
    case 'timeline': return <TimelineCell value={value} onChange={onChange} ctx={ctx} />;
    case 'dropdown': return <DropdownCell col={col} value={value} onChange={onChange} onUpdateColumn={onUpdateColumn} />;
    case 'checkbox': return <div className="cell-center" onClick={() => onChange(!value)} data-testid="checkbox-cell"><span className={'check' + (value ? ' on' : '')}>{value && <Check size={14} strokeWidth={3} />}</span></div>;
    case 'numbers': return <NumberCell col={col} value={value} onChange={onChange} />;
    case 'long_text': return <LongTextCell value={value} onChange={onChange} />;
    case 'link': return <LinkCell value={value} onChange={onChange} />;
    case 'time_tracking': case 'connect': case 'mirror': case 'creation_log': case 'last_updated': case 'location': return <ExtraCell col={col} value={value} onChange={onChange} ctx={ctx} />;
    default: return <TextCell value={value} onChange={onChange} type={col.type} />;
  }
}

// ---------- extra column types ----------
export function TimeCell({ value, onChange }) {
  const v = value || { total: 0, since: null };
  const [, tick] = useState(0);
  React.useEffect(() => { if (!v.since) return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [v.since]);
  const secs = v.total + (v.since ? Math.floor((Date.now() - new Date(v.since)) / 1000) : 0);
  const f = `${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return <div className="cell-center time-cell" data-testid="time-cell">
    <button className={'play' + (v.since ? ' on' : '')} onClick={() => onChange(v.since ? { total: secs, since: null } : { total: v.total, since: new Date().toISOString() })}>{v.since ? <Pause size={13} /> : <Play size={13} />}</button>
    <span className="mono">{f}</span>
  </div>;
}

function ConnectCell({ col, value, onChange, ctx }) {
  const ref = useRef(); const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const other = ctx.linked?.[col.settings.boardId];
  const ids = value || [];
  const all = other ? other.items.filter((i) => !i.parent_id) : [];
  const sel = ids.map((id) => all.find((i) => i.id === id)).filter(Boolean);
  return <>
    <div ref={ref} className="cell-dropdown" onClick={() => setOpen(true)} data-testid="connect-cell">
      {sel.length ? sel.map((i) => <span key={i.id} className="tag link-tag">{i.name}</span>) : <span className="ghost-plus"><Network size={14} /></span>}
    </div>
    {open && <Popover anchor={ref.current} onClose={() => setOpen(false)} width={280} align="center">
      {!other ? <div className="muted pad">Linked board not found</div> : <>
        <div className="mini-label">Link items from {other.board.icon} {other.board.name}</div>
        <input className="text-input" autoFocus placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="people-list">{all.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 50).map((i) => (
          <label key={i.id} className="menu-item"><input type="checkbox" checked={ids.includes(i.id)} onChange={(e) => onChange(e.target.checked ? [...ids, i.id] : ids.filter((x) => x !== i.id))} /> {i.name}</label>))}</div>
      </>}
    </Popover>}
  </>;
}

export function displayValue(c, v, people) {
  if (v == null || v === '') return '';
  if (c.type === 'status' || c.type === 'priority') return c.settings.labels.find((l) => l.id === v)?.label || '';
  if (c.type === 'dropdown') return (v || []).map((id) => c.settings.options.find((o) => o.id === id)?.label).filter(Boolean).join(', ');
  if (c.type === 'people') return (v || []).map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(', ');
  if (c.type === 'date') return fmtDate(v);
  if (c.type === 'week') return fmtWeek(v);
  if (c.type === 'timeline') return `${fmtDate(v.from)} – ${fmtDate(v.to)}`;
  if (c.type === 'checkbox') return v ? '✔' : '';
  if (c.type === 'link') return v.text || v.url;
  if (c.type === 'location') return locText(v);
  if (c.type === 'numbers') return fmtNum(v) + (c.settings.unit ? ' ' + c.settings.unit : '');
  if (typeof v === 'object') return '';
  return String(v);
}

function SubMirror({ col, ctx }) {
  const src = (ctx.board.sub_columns || []).find((c) => c.id === col.settings.colId);
  const subs = (ctx.subsByParent && ctx.subsByParent[ctx.item?.id]) || [];
  if (!src || !subs.length) return <div className="cell-text muted">—</div>;
  if (src.type === 'status') {
    const counts = {}; subs.forEach((s) => { const k = s.vals[src.id] || ''; counts[k] = (counts[k] || 0) + 1; });
    const parts = Object.entries(counts).map(([id, n]) => ({ l: src.settings.labels.find((x) => x.id === id), n }));
    return <div className="cell-center"><div className="battery" title={parts.map((p) => `${p.l?.label || '—'}: ${p.n}`).join('\n')} data-testid="sub-mirror">
      {parts.map((p, k) => <span key={k} style={{ flex: p.n, background: p.l?.color || '#c4c4c4' }}>{parts.length === 1 && p.l?.label}</span>)}</div></div>;
  }
  return <div className="cell-text mirror-text">{subs.map((s) => displayValue(src, s.vals[src.id], ctx.people)).filter(Boolean).join(', ')}</div>;
}

function MirrorCell({ col, ctx }) {
  if (col.settings.connectCol === '__sub') return <SubMirror col={col} ctx={ctx} />;
  const cc = ctx.board.columns.find((c) => c.id === col.settings.connectCol);
  const other = cc && ctx.linked?.[cc.settings.boardId];
  if (!other) return <div className="cell-text muted">—</div>;
  const src = other.board.columns.find((c) => c.id === col.settings.colId);
  const linkedItems = (ctx.item?.vals[cc.id] || []).map((id) => other.items.find((i) => i.id === id)).filter(Boolean);
  if (!src) return <div className="cell-text muted">—</div>;
  if ((src.type === 'status' || src.type === 'priority') && linkedItems.length) {
    const l = src.settings.labels.find((x) => x.id === linkedItems[0].vals[src.id]);
    return <div className="cell-status mirror" style={{ background: l ? l.color : '#c4c4c4' }}><span>{l?.label}</span></div>;
  }
  return <div className="cell-text mirror-text" title="Mirrored – edit on the other board">{linkedItems.map((i) => displayValue(src, i.vals[src.id], ctx.people)).filter(Boolean).join(', ')}</div>;
}

const stamp = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
export function ExtraCell({ col, value, onChange, ctx }) {
  if (col.type === 'time_tracking') return <TimeCell value={value} onChange={onChange} />;
  if (col.type === 'connect') return <ConnectCell col={col} value={value} onChange={onChange} ctx={ctx} />;
  if (col.type === 'mirror') return <MirrorCell col={col} ctx={ctx} />;
  if (col.type === 'creation_log') return <div className="cell-text center small muted">🕒 {stamp(ctx.item?.created)}</div>;
  if (col.type === 'last_updated') return <div className="cell-text center small muted">✏️ {stamp(ctx.item?.updated)}</div>;
  if (col.type === 'location') return <LocationCell value={value} onChange={onChange} />;
  return null;
}
