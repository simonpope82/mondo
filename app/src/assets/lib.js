import { api } from '../api.js';
export const normCode = (raw) => { const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length >= 8 ? s.slice(-8, -4) + '-' + s.slice(-4) : null; };
export const isCode = (v) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(String(v || '').trim());
export const STATUS_COLORS = { 'I drift': '#00c875', 'Hos kunde': '#579bfc', 'På lager': '#9aadbd', 'Til service': '#fdab3d', 'Savnet': '#e2445c', 'Utrangert': '#333333' };
export const statusColor = (s) => STATUS_COLORS[s] || '#a25ddc';
export const PRIO = { Critical: '#333333', High: '#e2445c', Medium: '#fdab3d', Low: '#579bfc' };
export const ago = (iso) => { if (!iso) return 'never'; const s = (Date.now() - new Date(iso)) / 1000; if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; const d = Math.round(s / 86400); return d === 1 ? '1 day ago' : d + ' days ago'; };
export const when = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
export const kr = (n) => n == null || n === '' ? '' : Number(n).toLocaleString('nb-NO') + ' kr';
export const titleOf = (a) => a.data.asset_type || 'Asset';
export const photoUrl = (a) => a.photo ? `/api/assets/${a.id}/photo?v=${a.photo}` : null;
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
// GPS from the phone (asks permission the first time). Resolves null if refused/unavailable.
export function getPos(timeout = 9000) {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    let done = false; const t = setTimeout(() => { if (!done) { done = true; res(null); } }, timeout + 1000);
    navigator.geolocation.getCurrentPosition((p) => { if (done) return; done = true; clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); },
      () => { if (done) return; done = true; clearTimeout(t); res(null); }, { enableHighAccuracy: true, timeout, maximumAge: 20000 });
  });
}
export async function resizeImage(file, max = 1280) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); return c.toDataURL('image/jpeg', 0.82);
}
export const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
export const loadAssets = () => api.get('/assets');
// columns for the asset list
export function allColumns(settings, people = []) {
  const pn = (id) => people.find((p) => p.id === id)?.name || '';
  const f = (key) => [...settings.fields, ...settings.custom].find((x) => x.key === key);
  const data = (key) => ({ key, label: f(key)?.label || key, get: (a) => a.data[key] ?? '', field: f(key) });
  const cols = [
    ...settings.fields.filter((x) => x.on && !['documentation', 'quantity', 'min_quantity'].includes(x.key)).map((x) => data(x.key)),
    { key: 'assigned_to', label: 'Assigned To', get: (a) => a.assigned_to || '' },
    { key: 'checked_out', label: 'Checked Out', get: (a) => (a.checked_out ? 'Yes' : 'No') },
    { key: 'return_date', label: 'Return Date', get: (a) => a.return_date || '' },
    { key: 'current_value', label: 'Current Value', get: (a) => a.current_value ?? '', fmt: kr },
    { key: 'end_of_life', label: 'End of life', get: (a) => a.end_of_life || '' },
    ...(f('documentation')?.on ? [{ key: 'documentation', label: 'Documentation', get: (a) => a.data.documentation || (a.docs ? a.docs + ' file(s)' : '') }] : []),
    ...(f('quantity')?.on ? [data('quantity'), data('min_quantity')] : []),
    { key: 'legacy_code', label: 'GoCodes ID (old)', get: (a) => a.legacy_code || '' },
    { key: 'updated', label: 'Last Updated', get: (a) => (a.updated || '').slice(0, 10) },
    { key: 'updated_by', label: 'Last Changed By', get: (a) => pn(a.updated_by) },
    { key: 'last_seen', label: 'Last Scan', get: (a) => (a.last_seen ? ago(a.last_seen) : '') },
    { key: 'last_message', label: 'Last Message', get: (a) => a.last_message ? `${a.last_message.text} (${a.last_message.name || a.last_message.email || '?'}, ${a.last_message.created.slice(0, 10)})` : '' },
    ...settings.custom.map((x) => data(x.key)),
  ];
  return cols;
}
export const DEFAULT_COLS = ['asset_type', 'serial', 'model', 'home_location', 'assigned_to', 'status'];
