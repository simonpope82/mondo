// 🔑 /reset?token=… – choose a new password (staff or Min side customer). Single-use link.
import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
export default function Reset() {
  const token = new URLSearchParams(window.location.hash.split('?')[1] || '').get('token') || '';
  const [chk, setChk] = useState(null); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = 'Nytt passord'; api.get('/auth/reset/check?token=' + encodeURIComponent(token)).then(setChk).catch(() => setChk({ ok: false })); }, []);
  const no = chk?.kind === 'cust'; const t = (n, e) => (no ? n : e);
  const go = async (e) => { e.preventDefault(); setErr(''); if (pw !== pw2) return setErr(t('Passordene er ikke like', 'Passwords do not match')); setBusy(true); try { setDone(await api.post('/auth/reset', { token, password: pw })); } catch (x) { setErr(x.message); } setBusy(false); };
  const home = no || done?.kind === 'cust' ? '/minside' : '/';
  return <div className="login-page reset-page"><div className="login-left"><a className="brand big" href="/"><span className="logo"><i style={{ background: '#e2445c' }} /><i style={{ background: '#fdab3d' }} /><i style={{ background: '#00c875' }} /></span><b>mondo</b></a>
    <div className="login-card" data-testid="reset-page">
      {chk === null && <p className="muted">…</p>}
      {chk && !chk.ok && !done && <><h1><AlertTriangle color="#e2445c" /> {t('Lenken virker ikke', 'Link not valid')}</h1><p className="muted" data-testid="reset-invalid">Lenken er ugyldig, brukt eller utløpt. Be om en ny med «Glemt passord?». / The link is invalid, used or expired – ask for a new one.</p><a className="btn primary big full" href="/">{t('Til innlogging', 'Go to login')}</a></>}
      {done && <><h1><CheckCircle2 color="#00c875" /> {done.kind === 'cust' ? 'Passordet er endret' : 'Password changed'}</h1><p className="muted" data-testid="reset-done">{done.kind === 'cust' ? 'Du er logget ut overalt. Logg inn med det nye passordet.' : 'You are logged out everywhere. Log in with the new password.'}</p><a className="btn primary big full" href={home} data-testid="reset-login">{done.kind === 'cust' ? 'Logg inn' : 'Log in'}</a></>}
      {chk?.ok && !done && <form onSubmit={go}><h1>🔑 {t('Velg nytt passord', 'Choose a new password')}</h1><p className="muted">{t('Minst 8 tegn.', 'At least 8 characters.')}</p>
        <label className="mini-label">{t('Nytt passord', 'New password')}</label>
        <div className="login-field"><Lock size={18} /><input type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} data-testid="reset-pw" /><button type="button" className="icon-btn" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        <label className="mini-label">{t('Gjenta passord', 'Repeat password')}</label>
        <div className="login-field"><Lock size={18} /><input type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} data-testid="reset-pw2" /></div>
        {pw && pw.length < 8 && <div className="muted small">{pw.length}/8</div>}
        {err && <div className="login-err" data-testid="reset-error">⚠️ {err}</div>}
        <button className="btn primary big full" disabled={busy || pw.length < 8 || !pw2} data-testid="reset-submit">{t('Lagre nytt passord', 'Save new password')}</button></form>}
    </div></div></div>;
}
