import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import { hasPin, locText, MapButtons } from './Location.jsx';
import { Avatar } from './ui.jsx';
import { fmtDate } from './constants.js';
import { X, Maximize2, MapPin } from 'lucide-react';

export function MapView({ top, A, ctx }) {
  const locCols = ctx.board.columns.filter((c) => c.type === 'location');
  const col = locCols.find((c) => c.id === ctx.view.settings?.col) || locCols[0];
  const colorBy = ctx.view.settings?.colorBy || 'group';
  const statusCols = ctx.board.columns.filter((c) => c.type === 'status' || c.type === 'priority');
  const sc = statusCols.find((c) => c.id === colorBy);
  const el = useRef(); const map = useRef(); const layer = useRef();
  const [sel, setSel] = useState(null); const [finding, setFinding] = useState(null);
  const colorOf = (it) => { if (sc) return sc.settings.labels.find((l) => l.id === it.vals[sc.id])?.color || '#c4c4c4'; return ctx.board.groups.find((g) => g.id === it.group_id)?.color || '#579bfc'; };
  const pins = col ? top.filter((it) => hasPin(it.vals[col.id])) : [];
  const noPin = col ? top.filter((it) => locText(it.vals[col.id]) && !hasPin(it.vals[col.id])) : [];

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([62.5, 10.5], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, [!!col]);
  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    pins.forEach((it) => {
      const v = it.vals[col.id];
      const icon = L.divIcon({ className: 'pin-icon', html: `<span style="background:${colorOf(it)}"></span>`, iconSize: [28, 36], iconAnchor: [14, 34] });
      L.marker([v.lat, v.lng], { icon, title: it.name }).on('click', () => setSel(it.id)).addTo(layer.current);
    });
    if (pins.length && !map.current._fitted) { map.current.fitBounds(L.latLngBounds(pins.map((it) => [it.vals[col.id].lat, it.vals[col.id].lng])), { padding: [40, 40], maxZoom: 13 }); map.current._fitted = true; }
    setTimeout(() => map.current?.invalidateSize(), 50);
  }, [JSON.stringify(pins.map((p) => [p.id, p.vals[col?.id], colorOf(p)]))]);

  if (!col) return <div className="empty-view">Add a 📍 Location column to see the map<br /><button className="btn primary" style={{ marginTop: 16 }} onClick={() => A.addColumn('location')}>+ Add Location column</button></div>;
  const it = sel && top.find((i) => i.id === sel);
  const findPins = async () => {
    for (let k = 0; k < noPin.length; k++) {
      setFinding(`${k + 1}/${noPin.length}`);
      try { const r = await api.get('/geocode?q=' + encodeURIComponent(locText(noPin[k].vals[col.id]))); if (r[0]) await A.updateItem(noPin[k].id, { vals: { [col.id]: { address: locText(noPin[k].vals[col.id]), lat: r[0].lat, lng: r[0].lng } } }); } catch {}
    }
    setFinding(null);
  };
  return (
    <div className="map-view">
      <div className="cal-head">
        {locCols.length > 1 && <label className="col-picker">Place from <select value={col.id} onChange={(e) => A.patchView({ settings: { col: e.target.value } })}>{locCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
        <label className="col-picker">Colour by <select value={colorBy} onChange={(e) => A.patchView({ settings: { colorBy: e.target.value } })} data-testid="map-color"><option value="group">Group</option>{statusCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <span className="muted">📍 {pins.length} on map</span>
        {noPin.length > 0 && <button className="btn small" onClick={findPins} disabled={!!finding}><MapPin size={14} /> {finding ? 'Finding ' + finding : `Find ${noPin.length} missing pins`}</button>}
      </div>
      <div className="map-wrap"><div ref={el} className="map-el" data-testid="map" /></div>
      <div className="map-legend">{(sc ? sc.settings.labels.filter((l) => l.label) : ctx.board.groups).map((x) => <span key={x.id}><i style={{ background: x.color }} />{x.label || x.name}</span>)}</div>
      {it && createPortal(<MapCard it={it} col={col} ctx={ctx} A={A} color={colorOf(it)} onClose={() => setSel(null)} />, document.body)}
    </div>
  );
}

function MapCard({ it, col, ctx, A, color, onClose }) {
  const v = it.vals[col.id];
  const st = ctx.board.columns.find((c) => c.type === 'status');
  const l = st?.settings.labels.find((x) => x.id === it.vals[st.id]);
  const date = ctx.board.columns.find((c) => c.type === 'date');
  const ppl = ctx.board.columns.filter((c) => c.type === 'people').flatMap((c) => it.vals[c.id] || []);
  return (
    <div className="map-card" style={{ borderTopColor: color }} data-testid="map-card">
      <div className="map-card-head"><b>{it.name}</b><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
      <div className="map-card-meta">
        {l && <span className="mini-pill" style={{ background: l.color }}>{l.label}</span>}
        {date && it.vals[date.id] && <span className="small">📅 {fmtDate(it.vals[date.id])}</span>}
        <span className="avatars">{[...new Set(ppl)].map((id) => <Avatar key={id} person={ctx.people.find((p) => p.id === id)} size={22} ring />)}</span>
      </div>
      <div className="small muted">📍 {locText(v)}</div>
      <MapButtons v={v} big />
      <button className="btn full" onClick={() => { A.openItem(it.id); onClose(); }}><Maximize2 size={14} /> Open item</button>
    </div>
  );
}
