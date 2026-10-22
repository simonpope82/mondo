// 🌐 Public booking page (#/book or /book) – phone first, 4 big steps, Norwegian.
import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PrevNote, TyreChoice } from './TyreNote.jsx';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import { Car, CalendarDays, User, CheckCircle2, ChevronLeft, Clock, Wrench } from 'lucide-react';

const STEPS = [['Tjeneste', Wrench], ['Bil', Car], ['Tid', CalendarDays], ['Deg', User]];
export default function Book() {
  const [cfg, setCfg] = useState(null); const [step, setStep] = useState(0); const [err, setErr] = useState('');
  const site = new URLSearchParams(window.location.hash.split('?')[1] || '').get('site'); const [brand, setBrand] = useState(null);
  const [f, setF] = useState({ addons: [], service: '', regnr: '', date: '', time: '', name: '', phone: '', email: '', comment: '', consent: true, tyre_choice: '' });
  const [prev, setPrev] = useState(null); const [saved, setSaved] = useState('');
  const [car, setCar] = useState(null); const [days, setDays] = useState([]); const [slots, setSlots] = useState(null); const [done, setDone] = useState(null); const [busy, setBusy] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  useEffect(() => { document.title = 'Bestill time'; api.get('/book/config').then(setCfg).catch((e) => setErr(e.message)); if (site) api.get('/site/' + site).then((b) => { setBrand(b); document.title = 'Bestill time – ' + b.name; }).catch(() => {}); }, []);
  const aq = f.addons.join(',');
  useEffect(() => { const p = f.phone.replace(/\D/g, ''); if (step !== 3 || p.length < 8) { setPrev(null); return; } const t = setTimeout(() => api.get(`/book/prev?phone=${encodeURIComponent(f.phone)}&regnr=${encodeURIComponent(f.regnr)}`).then(setPrev).catch(() => {}), 350); return () => clearTimeout(t); }, [step, f.phone, f.regnr]);
  useEffect(() => { if (step === 2 && f.service) api.get(`/book/days?service=${f.service}&addons=${aq}`).then((r) => { setDays(r.days); const first = r.days.find((d) => d.free > 0); if (!f.date && first) set({ date: first.date }); }); }, [step, f.service, aq]);
  useEffect(() => { if (f.date && f.service) { setSlots(null); api.get(`/book/slots?date=${f.date}&service=${f.service}&addons=${aq}`).then((r) => setSlots(r.slots)); } }, [f.date, f.service, aq]);
  useEffect(() => { const r = f.regnr.replace(/\s/g, ''); setCar(null); if (r.length < 6) return; const t = setTimeout(() => api.get('/book/regnr/' + encodeURIComponent(r)).then(setCar).catch(() => {}), 350); return () => clearTimeout(t); }, [f.regnr]);
  if (!cfg) return <div className="bk-page"><div className="bk-card">{err || 'Laster…'}</div></div>;
  const svc = cfg.services.find((s) => s.id === f.service);
  const adds = (cfg.addons || []).filter((a) => f.addons.includes(a.id)); const total = (svc?.price || 0) + adds.reduce((a, x) => a + (+x.price || 0), 0);
  const company = brand?.full_name || cfg.company; const style = brand ? { '--acc': brand.accent } : {}; const skin = site ? ' bk-w2' : '';
  const toggle = (id) => set({ addons: f.addons.includes(id) ? f.addons.filter((x) => x !== id) : [...f.addons, id], time: '' });
  const ok = [!!svc, f.regnr.replace(/\s/g, '').length >= 2, !!f.time, f.name.trim() && f.phone.replace(/\D/g, '').length >= 8][step];
  const submit = async () => { setBusy(true); setErr(''); try { setDone(await api.post('/book/create', { ...f, site: site || undefined, brand: brand?.full_name })); } catch (e) { setErr(e.message); if (/ledig/.test(e.message)) { setStep(2); set({ time: '' }); api.get(`/book/slots?date=${f.date}&service=${f.service}&addons=${aq}`).then((r) => setSlots(r.slots)); } } setBusy(false); };
  if (done) return (
    <div className={"bk-page" + skin} style={style}><div className="bk-card bk-done" data-testid="bk-done">
      <CheckCircle2 size={64} color="#00c875" />
      <h1>{done.confirmed ? 'Timen er bekreftet ✅' : 'Takk! Timen er bestilt'}</h1>
      <div className="bk-sum">
        <div><Wrench size={20} /> {done.service}</div><div><CalendarDays size={20} /> {done.date_text}</div><div><Clock size={20} /> kl {done.time} ({done.minutes} min)</div><div><Car size={20} /> {done.regnr}</div>
        {done.addons?.length > 0 && <div>➕ {done.addons.join(', ')}</div>}<div className="bk-price">Pris ca. {done.price} kr</div>
      </div>
      {done.tyre_prompt && <TyreChoice worn={done.tyre_prompt.worn} texts={done.tyre_prompt.texts} value={f.tyre_choice} saved={saved || done.tyre_choice} onChoose={async (k) => { set({ tyre_choice: k }); try { const r = await api.post('/book/tyre-choice', { ref: done.ref, phone: f.phone, choice: k }); setSaved(r.text); } catch (e) { setErr(e.message); } }} />}
      <p>Bookingnummer <b data-testid="bk-ref">{done.ref}</b>. {done.confirmed ? 'Velkommen! Du trenger ikke gjøre mer.' : `Vi sender bekreftelse på SMS${f.email ? ' og e-post' : ''} når timen er godkjent.`}</p>
      <p className="muted">Husk låsebolt hvis bilen har det. Betal med Vipps, kort eller på stedet.</p>
      <button className="bk-btn" onClick={() => { setDone(null); setSaved(''); setStep(0); set({ time: '', service: '', addons: [], tyre_choice: '' }); }}>Bestill en time til</button>{site && <a className="bk-back" href={'/' + site}>← Tilbake til {brand?.name || 'forsiden'}</a>}
    </div></div>
  );
  return (
    <div className={"bk-page" + skin} style={style}>
      <header className="bk-head">{site ? <a className="bk-logo" href={'/' + site}>🛞</a> : <div className="bk-logo">🛞</div>}<div><b>{company}</b><div className="muted">Bestill dekkskift på 1 minutt</div></div></header>
      <div className="bk-steps">{STEPS.map(([t, I], k) => <button key={t} className={'bk-step' + (k === step ? ' on' : k < step ? ' done' : '')} disabled={k > step} onClick={() => setStep(k)}><I size={18} /><span>{t}</span></button>)}</div>
      <div className="bk-card">
        {step === 0 && <>
          <h2>Hva trenger du?</h2>
          <div className="bk-services">{cfg.services.map((s) => <button key={s.id} data-testid={'bk-svc-' + s.id} className={'bk-svc' + (f.service === s.id ? ' on' : '')} onClick={() => set({ service: s.id, time: '' })}>
            <span className="bk-ico">{s.icon}</span><span className="bk-svc-t"><b>{s.name}</b><small>{s.desc}</small></span><span className="bk-svc-p"><b>{s.price} kr</b><small>{s.minutes} min</small></span></button>)}</div>
          {svc && (cfg.addons || []).length > 0 && <><h3 className="bk-h3">➕ Legg til</h3><div className="bk-addons">{cfg.addons.map((a) => <label key={a.id} className={'bk-add' + (f.addons.includes(a.id) ? ' on' : '')} data-testid={'bk-add-' + a.id}>
            <input type="checkbox" checked={f.addons.includes(a.id)} onChange={() => toggle(a.id)} /><span className="bk-add-i">{a.icon}</span><span className="bk-add-n">{a.name}</span><b>{a.price ? '+' + a.price + ' kr' : 'Gratis'}</b></label>)}</div></>}
          {svc && <div className="bk-total" data-testid="bk-total"><span>Totalt ca.</span><b>{total} kr</b></div>}
        </>}
        {step === 1 && <>
          <h2>Hvilken bil?</h2>
          <label className="bk-label">Registreringsnummer</label>
          <div className="bk-plate"><span className="bk-nor">N</span><input data-testid="bk-reg" autoFocus value={f.regnr} onChange={(e) => set({ regnr: e.target.value.toUpperCase() })} placeholder="AB 12345" maxLength={10} autoCapitalize="characters" /></div>
          {car?.found && <div className="bk-car" data-testid="bk-car"><Car size={18} /> {car.make} {car.model}</div>}
          {car && !car.found && <div className="muted bk-small">Vi finner bilen når du kommer – helt greit.</div>}
        </>}
        {step === 2 && <>
          <h2>Velg dag og tid</h2>
          <div className="bk-days">{days.map((d) => <button key={d.date} data-testid={'bk-day-' + d.date} disabled={!d.free} className={'bk-day' + (f.date === d.date ? ' on' : '')} onClick={() => set({ date: d.date, time: '' })}>
            <small>{d.text.split(' ')[0].slice(0, 3)}</small><b>{d.text.split(' ')[1].split('.').slice(0, 2).join('.')}</b><small>{d.free ? d.free + ' ledige' : 'fullt'}</small></button>)}</div>
          <div className="bk-times">{slots == null ? 'Laster…' : slots.filter((s) => s.free > 0).length === 0 ? <div className="muted">Ingen ledige tider denne dagen</div> : slots.map((s) => <button key={s.time} data-testid={'bk-time-' + s.time} disabled={!s.free} className={'bk-time' + (f.time === s.time ? ' on' : '')} onClick={() => set({ time: s.time })}>{s.time}</button>)}</div>
        </>}
        {step === 3 && <>
          <h2>Hvem er du?</h2>
          <label className="bk-label">Navn</label><input className="bk-in" data-testid="bk-name" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
          <label className="bk-label">Mobil</label><input className="bk-in" data-testid="bk-phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="400 00 000" />
          <PrevNote info={prev} />
          {prev?.worn && <TyreChoice worn={prev.worn} texts={prev.texts} value={f.tyre_choice} onChoose={(k) => set({ tyre_choice: k })} />}
          <label className="bk-label">E-post (valgfritt)</label><input className="bk-in" data-testid="bk-email" value={f.email} onChange={(e) => set({ email: e.target.value })} inputMode="email" autoComplete="email" />
          <label className="bk-label">Melding (valgfritt)</label><textarea className="bk-in" value={f.comment} onChange={(e) => set({ comment: e.target.value })} rows={2} placeholder="F.eks. låsebolt ligger i hanskerommet" />
          <label className="bk-check"><input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} /> Send meg SMS om timen og når hjulene skal byttes</label>
          <div className="bk-sum small"><div>{svc?.icon} {svc?.name}{adds.length ? ' + ' + adds.map((a) => a.name).join(', ') : ''}</div><div>💰 ca. {total} kr</div><div>📅 {days.find((d) => d.date === f.date)?.text} kl {f.time}</div><div>🚗 {f.regnr}</div></div>
        </>}
        {err && <div className="bk-err" data-testid="bk-err">{err}</div>}
        <div className="bk-nav">
          {step > 0 && <button className="bk-back" onClick={() => setStep(step - 1)}><ChevronLeft size={20} /> Tilbake</button>}
          {step < 3 && (step > 0 || svc) && <button className="bk-btn" data-testid="bk-next" disabled={!ok} onClick={() => setStep(step + 1)}>Neste</button>}
          {step === 3 && <button className="bk-btn" data-testid="bk-submit" disabled={!ok || busy} onClick={submit}>{busy ? 'Bestiller…' : 'Bestill time'}</button>}
        </div>
      </div>
      <p className="bk-foot muted">{cfg.auto_confirm ? '✅ Timen bekreftes automatisk · ' : ''}Drevet av mondo</p>
    </div>
  );
}
