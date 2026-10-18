import React, { useEffect, useRef, useState } from 'react';
import { Popover } from './ui.jsx';
import { api } from './api.js';
import { MapPin, Navigation, Search, Trash2, Check } from 'lucide-react';

export const locText = (v) => (v == null ? '' : typeof v === 'object' ? v.address || '' : String(v));
export const hasPin = (v) => !!v && typeof v === 'object' && Number.isFinite(v.lat) && Number.isFinite(v.lng);
export const mapsUrl = (v) => hasPin(v) ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locText(v))}`;
export const dirUrl = (v) => hasPin(v) ? `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locText(v))}`;
const short = (a) => a.split(',').slice(0, 3).join(',').trim();

export function MapButtons({ v, big }) {
  if (!locText(v)) return null;
  return <div className={'map-btns' + (big ? ' big' : '')}>
    <a className="btn small" href={mapsUrl(v)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} data-testid="open-gmaps"><MapPin size={14} /> Google Maps</a>
    <a className="btn small primary" href={dirUrl(v)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} data-testid="directions"><Navigation size={14} /> Directions</a>
  </div>;
}

export function LocationEditor({ value, onChange, onDone }) {
  const [q, setQ] = useState(locText(value));
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const t = useRef();
  const run = async (text) => {
    if (text.trim().length < 3) { setRes(null); return; }
    setBusy(true); setErr('');
    try { setRes(await api.get('/geocode?q=' + encodeURIComponent(text))); } catch (e) { setErr(e.message); setRes(null); } finally { setBusy(false); }
  };
  useEffect(() => () => clearTimeout(t.current), []);
  return <div className="loc-editor">
    <div className="login-field small"><Search size={16} /><input autoFocus placeholder="Type an address" value={q} data-testid="loc-input"
      onChange={(e) => { setQ(e.target.value); clearTimeout(t.current); const v = e.target.value; t.current = setTimeout(() => run(v), 800); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { clearTimeout(t.current); run(q); } }} /></div>
    {busy && <div className="muted small pad">🔎 Searching…</div>}
    {err && <div className="login-err small">{err}</div>}
    {res && !res.length && !busy && <div className="muted small pad">No match. You can still save the text.</div>}
    {res && res.map((r, k) => <button key={k} className="menu-item loc-hit" onClick={() => { onChange({ address: short(r.address), lat: r.lat, lng: r.lng }); onDone(); }} data-testid="loc-hit"><MapPin size={15} color="#e2445c" /> <span>{short(r.address)}<small className="muted">{r.address.split(',').slice(3).join(',')}</small></span></button>)}
    <div className="row-gap">
      {q.trim() && q.trim() !== locText(value) && <button className="btn small" onClick={() => { onChange({ address: q.trim() }); onDone(); }}><Check size={13} /> Save text (no pin)</button>}
      {locText(value) && <button className="btn small ghost" onClick={() => { onChange(null); onDone(); }}><Trash2 size={13} /> Clear</button>}
    </div>
    {locText(value) && <><div className="mini-label">{hasPin(value) ? '📍 Pin saved' : 'No pin yet'}</div><MapButtons v={value} /></>}
    <div className="osm-credit">Search © OpenStreetMap</div>
  </div>;
}

export function LocationCell({ value, onChange }) {
  const ref = useRef(); const [open, setOpen] = useState(false);
  const txt = locText(value);
  return <>
    <div ref={ref} className="cell-text" onClick={() => setOpen(true)} data-testid="location-cell">
      {txt ? <span className="loc"><span className={'pin' + (hasPin(value) ? ' on' : '')}>📍</span><span className="truncate">{txt}</span><a className="dir" href={dirUrl(value)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Directions" data-testid="cell-directions">🧭</a></span> : <span className="ghost-plus"><MapPin size={14} /></span>}
    </div>
    {open && <Popover anchor={ref.current} onClose={() => setOpen(false)} width={320}><LocationEditor value={value} onChange={onChange} onDone={() => setOpen(false)} /></Popover>}
  </>;
}
