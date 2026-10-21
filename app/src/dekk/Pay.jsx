// 💳 Public payment page (#/betal/<token>) – Vipps / kort (Stripe) / betal ved henting. Inactive until keys are added.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CheckCircle2, CreditCard, Store, FileText } from 'lucide-react';

const kr = (n) => (+n || 0).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
export default function Pay({ token }) {
  const [d, setD] = useState(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  const tok = token.split('?')[0];
  const load = () => api.get('/pay/' + tok).then(setD).catch((e) => setErr(e.message));
  useEffect(() => {
    document.title = 'Betal faktura';
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const confirm = q.get('stripe') ? api.post(`/pay/${tok}/stripe/confirm`, { session_id: q.get('stripe') }) : q.get('vipps') ? api.post(`/pay/${tok}/vipps/confirm`, { reference: q.get('vipps') }) : null;
    (confirm ? confirm.catch(() => {}) : Promise.resolve()).then(load);
  }, [tok]);
  const go = async (m) => { setBusy(m); setErr(''); setMsg(''); try { const r = await api.post(`/pay/${tok}/${m}`); if (r.url) window.location.href = r.url; else if (m === 'pickup') setMsg('Notert – du betaler når du henter bilen. 👍'); else load(); } catch (e) { setErr(e.message); } setBusy(''); };
  if (err && !d) return <div className="bk-page"><div className="bk-card">{err}</div></div>;
  if (!d) return <div className="bk-page"><div className="bk-card">Laster…</div></div>;
  const paid = d.status === 'Betalt';
  return (
    <div className="bk-page">
      <header className="bk-head"><div className="bk-logo">🛞</div><div><b>{d.company}</b><div className="muted">Faktura {d.no}</div></div></header>
      <div className="bk-card" data-testid="pay-card">
        {paid ? <div className="bk-done"><CheckCircle2 size={64} color="#00c875" /><h1>Betalt – takk!</h1></div> : <>
          <div className="pay-amount"><small>Å betale</small><b data-testid="pay-total">{kr(d.total)}</b><small>inkl. mva {kr(d.mva)} · forfall {d.due}</small></div>
          <div className="muted bk-small">{d.line}</div>
          <button className="pay-btn vipps" data-testid="pay-vipps" disabled={!!busy} onClick={() => go('vipps')}><span className="pay-ico">V</span> Betal med Vipps {!d.methods.vipps.active && <em>ikke aktiv</em>}</button>
          <button className="pay-btn card" data-testid="pay-stripe" disabled={!!busy} onClick={() => go('stripe')}><CreditCard size={22} /> Betal med kort {!d.methods.stripe.active && <em>ikke aktiv</em>}</button>
          <button className="pay-btn pickup" data-testid="pay-pickup" disabled={!!busy} onClick={() => go('pickup')}><Store size={22} /> Betal når jeg henter bilen</button>
          <div className="muted bk-small">Eller nettbank: konto {d.account}, KID {d.kid}</div>
        </>}
        {(!d.methods.vipps.active || !d.methods.stripe.active) && !paid && <div className="pay-note" data-testid="pay-note">⚠️ Demo: Vipps og kort er <b>ikke aktivert</b> før verkstedet legger inn nøkler (testmodus først).</div>}
        {msg && <div className="bk-ok">{msg}</div>}{err && <div className="bk-err" data-testid="pay-err">{err}</div>}
        <a className="bk-back" href={`/api/pay/${tok}/pdf`} target="_blank" rel="noreferrer"><FileText size={18} /> Se faktura (PDF)</a>
      </div>
    </div>
  );
}
