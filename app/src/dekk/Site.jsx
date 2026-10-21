// 🌐 Public landing page for a customer business (e.g. /web-bil) + FAQ chat widget. Content comes from #/dekk → Nettside.
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Phone, MapPin, Clock, CalendarCheck, MessageCircle, X, Send, Navigation, Mail } from 'lucide-react';

const ph = (s) => /^\s*\[.*\]\s*$/.test(String(s || ''));
const Txt = ({ v }) => <span className={ph(v) ? 'ph' : ''}>{v}</span>;
export default function Site({ slug }) {
  const [s, setS] = useState(null); const [open, setOpen] = useState(false);
  useEffect(() => { api.get('/site/' + slug).then((x) => { setS(x); document.title = `${x.full_name} – ${x.hero_title}`; }).catch(() => window.location.replace('/')); }, [slug]);
  if (!s) return <div className="loading">Laster…</div>;
  const book = `/book?site=${slug}`;
  const tel = ph(s.phone) ? null : 'tel:' + s.phone.replace(/\s/g, '');
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const d = 0.008; const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${s.lng - d * 2},${s.lat - d},${s.lng + d * 2},${s.lat + d}&layer=mapnik&marker=${s.lat},${s.lng}`;
  return (
    <div className="ws-page" style={{ '--c': s.color, '--a': s.accent }} data-testid="site-page">
      <header className="ws-top"><a className="ws-brand" href={'/' + slug}><span className="ws-logo">🛞</span><span><b>{s.name}</b><small>{s.area}</small></span></a>
        <div className="ws-top-r">{tel && <a className="ws-ico-btn" href={tel} aria-label="Ring"><Phone size={20} /></a>}<a className="ws-cta sm" href={book} data-testid="site-book-top">Bestill</a></div></header>
      <section className="ws-hero"><div className="ws-hero-in">
        <h1>{s.hero_title}</h1><p>{s.hero_text}</p>
        <div className="ws-badges">{s.badges.map((b) => <span key={b}>{b}</span>)}</div>
        <div className="ws-hero-btns"><a className="ws-cta" href={book} data-testid="site-book"><CalendarCheck size={22} /> Bestill time</a>
          <button className="ws-ghost" onClick={() => setOpen(true)}><MessageCircle size={20} /> Spør oss</button></div>
      </div></section>
      <section className="ws-sec"><h2>🔧 Dette gjør vi</h2><div className="ws-cards">{s.services.map((x) => <a key={x.title} className="ws-card" href={book}><span className="ws-card-i">{x.icon}</span><b>{x.title}</b><p>{x.text}</p><span className="ws-price"><Txt v={x.price} /></span></a>)}</div></section>
      <section className="ws-sec alt"><h2>💰 Priser</h2><div className="ws-prices">{s.prices.map((p) => <div key={p.name}><span>{p.name}</span><b><Txt v={p.price} /></b></div>)}</div><p className="ws-note">{s.price_note}</p>
        <a className="ws-cta" href={book}><CalendarCheck size={20} /> Se ledige tider</a></section>
      <section className="ws-sec ws-two">
        <div><h2>🕗 Åpningstider</h2><div className="ws-hours">{s.hours.map((h) => <div key={h.day}><span>{h.day}</span><b><Txt v={h.time} /></b></div>)}</div></div>
        <div><h2>📞 Kontakt</h2><div className="ws-contact">
          <div><MapPin size={20} /> <span>{s.address}, {s.postal}<br /><small>{s.area}</small></span></div>
          <div><Phone size={20} /> {tel ? <a href={tel}>{s.phone}</a> : <Txt v={s.phone} />}</div>
          <div><Mail size={20} /> {ph(s.email) ? <Txt v={s.email} /> : <a href={'mailto:' + s.email}>{s.email}</a>}</div>
          <div><Navigation size={20} /> <Txt v={s.directions} /></div>
        </div></div>
      </section>
      <section className="ws-map"><iframe title="Kart" src={osm} loading="lazy" /><a className="ws-cta" href={maps} target="_blank" rel="noreferrer"><Navigation size={20} /> Veibeskrivelse</a></section>
      <section className="ws-sec"><h2>👋 Om oss</h2><p className="ws-about"><AboutText t={s.about} /></p></section>
      <footer className="ws-foot"><b>{s.full_name}</b><span>{s.address}, {s.postal}</span><span>Org.nr {s.orgnr}</span><a href={book}>Bestill time</a><small>Laget med mondo</small></footer>
      <a className="ws-sticky" href={book}><CalendarCheck size={22} /> Bestill time</a>
      <Bot s={s} slug={slug} open={open} setOpen={setOpen} book={book} />
    </div>
  );
}
const AboutText = ({ t }) => String(t).split(/(\[[^\]]*\])/).map((p, k) => (p.startsWith('[') ? <span key={k} className="ph">{p}</span> : p));

function Bot({ s, slug, open, setOpen, book }) {
  const [msgs, setMsgs] = useState([{ from: 'bot', text: s.bot_hello, chips: s.faqs.slice(0, 4) }]); const [q, setQ] = useState(''); const [form, setForm] = useState(null); const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, form, open]);
  const ask = async (text, id) => {
    if (!text.trim()) return; setQ(''); setMsgs((m) => [...m, { from: 'me', text }]);
    const r = await api.post(`/site/${slug}/ask`, { q: text, id }).catch(() => ({ found: false, text: 'Noe gikk galt. Prøv igjen.' }));
    setMsgs((m) => [...m, { from: 'bot', text: r.text, handoff: !r.found || r.unanswered, chips: r.suggest, ask: text }]);
  };
  const send = async () => { try { await api.post(`/site/${slug}/question`, form); setMsgs((m) => [...m, { from: 'bot', text: '✅ Takk! Spørsmålet er sendt til verkstedet. Vi svarer deg så fort vi kan.' }]); setForm(null); } catch (e) { setForm({ ...form, err: e.message }); } };
  return <>
    {!open && <button className="ws-bot-btn" onClick={() => setOpen(true)} data-testid="bot-open" aria-label="Chat"><MessageCircle size={28} /><span>Spør oss</span></button>}
    {open && <div className="ws-bot" data-testid="bot">
      <div className="ws-bot-h"><span>🤖 <b>{s.bot_name}</b></span><button onClick={() => setOpen(false)} aria-label="Lukk"><X size={22} /></button></div>
      <div className="ws-bot-body">{msgs.map((m, k) => <div key={k} className={'ws-msg ' + m.from}><div className="ws-bubble" data-testid={m.from === 'bot' ? 'bot-msg' : undefined}>{m.text}</div>
        {m.chips && <div className="ws-chips">{m.chips.map((c) => <button key={c.id} onClick={() => ask(c.q, c.id)}>{c.q}</button>)}</div>}
        {m.handoff && <div className="ws-chips"><button className="hl" data-testid="bot-handoff" onClick={() => setForm({ text: m.ask || '', name: '', contact: '' })}>✉️ Send spørsmål</button><a className="hl" href={book}>📅 Bestill time</a></div>}</div>)}
        {form && <div className="ws-qform" data-testid="bot-form"><input placeholder="Navn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input data-testid="bot-contact" placeholder="Mobil eller e-post" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <textarea rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />{form.err && <div className="bk-err">{form.err}</div>}<button className="ws-cta sm" data-testid="bot-send" onClick={send}>Send</button></div>}
        <div ref={end} /></div>
      <form className="ws-bot-in" onSubmit={(e) => { e.preventDefault(); ask(q); }}><input data-testid="bot-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Skriv et spørsmål…" /><button aria-label="Send"><Send size={20} /></button></form>
    </div>}
  </>;
}
