import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { api } from '../api.js';
import { Modal } from '../ui.jsx';
import { Login } from '../Auth.jsx';
import { normCode, getPos, titleOf } from './lib.js';
import { Camera, Keyboard, X, MapPin, Send, Tag, Plus, Search, LogIn } from 'lucide-react';

// Live camera QR reader: BarcodeDetector where the phone has it (Android Chrome), jsQR otherwise (iPhone Safari)
export function QRScanner({ onCode, onClose }) {
  const vid = useRef(); const [err, setErr] = useState(''); const [typed, setTyped] = useState(''); const [typing, setTyping] = useState(false);
  useEffect(() => {
    let stream, stop = false, det = null;
    const cv = document.createElement('canvas'); const ctx = cv.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        if ('BarcodeDetector' in window) { try { const f = await window.BarcodeDetector.getSupportedFormats(); if (f.includes('qr_code')) det = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch {} }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (stop) return; vid.current.srcObject = stream; await vid.current.play().catch(() => {});
        const tick = async () => {
          if (stop) return; const v = vid.current;
          if (v && v.readyState >= 2 && v.videoWidth) {
            let txt = null;
            try {
              if (det) { const r = await det.detect(v); txt = r[0]?.rawValue || null; }
              else { const k = Math.min(1, 720 / v.videoWidth); cv.width = v.videoWidth * k; cv.height = v.videoHeight * k; ctx.drawImage(v, 0, 0, cv.width, cv.height); const im = ctx.getImageData(0, 0, cv.width, cv.height); txt = jsQR(im.data, im.width, im.height, { inversionAttempts: 'dontInvert' })?.data || null; }
            } catch {}
            const c = txt && normCode(txt);
            if (c) { stop = true; navigator.vibrate?.(60); onCode(c, txt); return; }
          }
          setTimeout(tick, 120);
        };
        tick();
      } catch (e) { setErr(e.name === 'NotAllowedError' ? 'Camera not allowed. Allow camera in the browser settings – or type the code.' : 'No camera found – type the code instead.'); setTyping(true); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="scanner" data-testid="scanner">
      <div className="scanner-top"><b><Camera size={18} /> Scan QR tag</b><button className="icon-btn light" onClick={onClose} data-testid="scanner-close"><X size={22} /></button></div>
      <div className="scanner-view"><video ref={vid} playsInline muted /><div className="scanner-frame" /></div>
      {err && <div className="scanner-err">{err}</div>}
      <div className="scanner-bottom">
        <div className="muted-light small">Works with mondo stickers and old GoCodes stickers.</div>
        {typing ? <form className="row-gap" onSubmit={(e) => { e.preventDefault(); const c = normCode(typed); if (c) onCode(c, typed); }}>
          <input className="text-input big" autoFocus placeholder="ABCD-EFGH" value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="scanner-code" style={{ margin: 0 }} /><button className="btn primary big" data-testid="scanner-go">Go</button></form>
          : <button className="btn big" onClick={() => setTyping(true)} data-testid="scanner-type"><Keyboard size={18} /> Type the code</button>}
      </div>
    </div>
  );
}

// Logged-in scan: resolve tag → save GPS scan → open asset; or activate an unused tag
export function ScanFlow({ code, go, onDone }) {
  const [st, setSt] = useState({ step: 'look' });
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await api.get('/scan/' + encodeURIComponent(code)).catch((e) => ({ kind: 'error', error: e.message }));
      if (!live) return;
      if (r.kind === 'asset') {
        setSt({ step: 'gps' }); const p = await getPos();
        await api.post(`/assets/${r.id}/scan`, p ? { ...p } : { note: 'Scanned (no GPS)' });
        if (live) go(`#/assets/${r.id}?scanned=${p ? p.acc : 'nogps'}`, true);
      } else setSt({ step: r.kind, code: r.code || code, error: r.error });
    })();
    return () => { live = false; };
  }, [code]);
  if (st.step === 'look' || st.step === 'gps') return <div className="scan-wait" data-testid="scan-wait"><div className="spinner" /><b>{st.step === 'look' ? 'Looking up ' + code : '📍 Saving location…'}</b>{st.step === 'gps' && <span className="muted">Allow location if the phone asks.</span>}</div>;
  if (st.step === 'unassigned') return <Activate code={st.code} go={go} />;
  return (
    <div className="scan-card" data-testid="scan-unknown">
      <div className="big-emoji">❓</div><h2>Unknown tag {st.code}</h2>
      <p className="muted">This code isn't in mondo. If it is an old GoCodes sticker, you can add it as a new asset and keep the old ID.</p>
      <button className="btn primary big" onClick={async () => { const p = await getPos(); const a = await api.post('/assets', { legacy_code: st.code, data: { asset_type: 'Annet' }, gps: p }); go('#/assets/' + a.id + '?edit=1', true); }} data-testid="scan-add-legacy"><Plus size={18} /> Add asset (old GoCodes ID {st.code})</button>
      <button className="btn big" onClick={() => go('#/assets', true)}>Back to assets</button>
    </div>
  );
}

// "Activate asset tag": link a pre-printed unused code to an asset (new or existing)
export function Activate({ code, go }) {
  const [mode, setMode] = useState('new'); const [list, setList] = useState(null); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const [d, setD] = useState({ asset_type: 'Kaffemaskin', model: '', serial: '', home_location: '' }); const [types, setTypes] = useState([]);
  useEffect(() => { api.get('/assets').then((r) => { setList(r.assets); setTypes(r.settings.fields.find((f) => f.key === 'asset_type')?.options || []); }); }, []);
  const act = async (body) => { setBusy(true); const gps = await getPos(); const a = await api.post(`/qr/${code}/activate`, { ...body, gps }); go('#/assets/' + a.id + '?activated=1', true); };
  const found = (list || []).filter((a) => !q || JSON.stringify([a.code, a.data]).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="scan-card" data-testid="activate">
      <div className="big-emoji">🏷️</div><h2>New tag <span className="code-pill">{code}</span></h2>
      <p className="muted">This sticker isn't used yet. Put it on:</p>
      <div className="seg"><button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')} data-testid="act-new"><Plus size={16} /> A new asset</button><button className={mode === 'old' ? 'on' : ''} onClick={() => setMode('old')} data-testid="act-existing"><Search size={16} /> An existing asset</button></div>
      {mode === 'new' ? <div className="form-grid">
        <label>Asset type<select className="text-input" value={d.asset_type} onChange={(e) => setD({ ...d, asset_type: e.target.value })} data-testid="act-type">{types.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label>Model<input className="text-input" value={d.model} onChange={(e) => setD({ ...d, model: e.target.value })} data-testid="act-model" /></label>
        <label>Serial number<input className="text-input" value={d.serial} onChange={(e) => setD({ ...d, serial: e.target.value })} /></label>
        <label>Home location<input className="text-input" value={d.home_location} onChange={(e) => setD({ ...d, home_location: e.target.value })} /></label>
        <button className="btn primary big full" disabled={busy} onClick={() => act({ data: Object.fromEntries(Object.entries(d).filter(([, v]) => v)) })} data-testid="act-save"><Tag size={18} /> {busy ? 'Saving…' : 'Activate tag'}</button>
      </div> : <div>
        <input className="text-input big" placeholder="Search serial, model, place…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="act-search" />
        <div className="pick-list">{found.map((a) => <button key={a.id} className="pick" disabled={busy} onClick={() => act({ asset_id: a.id })} data-testid="act-pick"><b>{titleOf(a)}</b> {a.data.model} <span className="muted">· {a.code} · {a.data.home_location}</span></button>)}</div>
        <p className="muted small">The asset gets this new tag; its old code stops working.</p>
      </div>}
    </div>
  );
}

// Public scan page (finder / not logged in): public fields + send a message to the owner
export function PublicScan({ code }) {
  const [r, setR] = useState(null); const [m, setM] = useState({ name: '', email: '', phone: '', text: '' }); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [login, setLogin] = useState(false);
  useEffect(() => { api.get('/scan/' + encodeURIComponent(code)).then(setR).catch(() => setR({ kind: 'unknown' })); }, [code]);
  if (login) return <Login onLogin={() => window.location.reload()} />;
  if (!r) return <div className="loading">Loading…</div>;
  const send = async () => { setErr(''); try { const p = await getPos(6000); await api.post(`/scan/${code}/message`, { ...m, ...(p || {}) }); setSent(true); } catch (e) { setErr(e.message); } };
  return (
    <div className="public-scan" data-testid="public-scan">
      <div className="ps-head"><span className="logo"><i style={{ background: '#e2445c' }} /><i style={{ background: '#fdab3d' }} /><i style={{ background: '#00c875' }} /></span><b>{r.org || 'mondo'}</b></div>
      {r.kind === 'public' ? <>
        <div className="ps-card"><div className="big-emoji">🏷️</div><h1>{r.title}</h1><div className="code-pill big">{r.code}</div>
          <dl className="ps-fields">{Object.entries(r.fields).map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{/^https?:/.test(v) ? <a href={v} target="_blank" rel="noreferrer">{v}</a> : v}</dd></React.Fragment>)}</dl>
          {r.reward && <div className="ps-reward">🎁 {r.reward}</div>}
        </div>
        <div className="ps-card">
          {sent ? <div className="center" data-testid="ps-sent"><div className="big-emoji">✅</div><h2>Thank you!</h2><p className="muted">The owner got your message.</p></div> : <>
            <h2>📨 Found this? Tell the owner</h2>
            <textarea className="text-input" rows={3} placeholder="Where did you find it?" value={m.text} onChange={(e) => setM({ ...m, text: e.target.value })} data-testid="ps-text" />
            <input className="text-input" placeholder="Your name (optional)" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
            <input className="text-input" placeholder="Email or phone (optional)" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} />
            {err && <div className="err">{err}</div>}
            <button className="btn primary big full" disabled={!m.text.trim()} onClick={send} data-testid="ps-send"><Send size={18} /> Send message</button>
            <p className="muted small">Your location is shared only if you allow it.</p></>}
        </div>
      </> : <div className="ps-card"><div className="big-emoji">❓</div><h2>Tag {r.code || code}</h2><p className="muted">This tag is not in use yet.</p></div>}
      <button className="btn ghost full" onClick={() => setLogin(true)} data-testid="ps-login"><LogIn size={16} /> I work here – log in</button>
    </div>
  );
}

export function ScanModal({ go, onClose }) {
  return <div className="scanner-back"><QRScanner onClose={onClose} onCode={(c) => { onClose(); go('#/scan/' + c); }} /></div>;
}
