// 🌐 Public landing page v2 (premium dark) – all content from #/dekk → Nettside. Placeholders [..] stay visible.
import React, { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import { api } from '../api.js';
import { Phone, MapPin, Clock, CalendarCheck, MessageCircle, X, Send, Navigation, Mail, ArrowRight, RefreshCw, Warehouse, CircleDot, Wrench, ShieldCheck, Gauge, Star, Sparkles, Menu } from 'lucide-react';

const ph = (s) => /\[[^\]]*\]/.test(String(s || ''));
const Txt = ({ v }) => String(v ?? '').split(/(\[[^\]]*\])/).map((p, k) => (p.startsWith('[') ? <mark key={k} className="w2-ph">{p}</mark> : <React.Fragment key={k}>{p}</React.Fragment>));
const ICONS = [[/hotell|lagr/i, Warehouse], [/skift|bytte/i, RefreshCw], [/nye dekk|dekk/i, CircleDot], [/punkt|lekk|repar/i, Wrench], [/balans/i, Gauge], [/vask|rens/i, Sparkles]];
const iconFor = (t) => (ICONS.find(([re]) => re.test(t)) || [0, ShieldCheck])[1];
function useReveal() { useEffect(() => { const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 }); document.querySelectorAll('.w2-rv').forEach((el) => io.observe(el)); return () => io.disconnect(); }); }

export default function Site({ slug }) {
  const [s, setS] = useState(null); const [open, setOpen] = useState(false); const [scrolled, setScrolled] = useState(false); const [menu, setMenu] = useState(false); const root = useRef(null);
  useEffect(() => { api.get('/site/' + slug).then((x) => { setS(x); document.title = `${x.name} – ${x.hero_title}`; }).catch(() => window.location.replace('/')); }, [slug]);
  useReveal();
  if (!s) return <div className="w2-page w2-loading" />;
  const book = `/book?site=${slug}`; const tel = ph(s.phone) ? null : 'tel:' + s.phone.replace(/\s/g, '');
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const d = 0.006; const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${s.lng - d * 2},${s.lat - d},${s.lng + d * 2},${s.lat + d}&layer=mapnik&marker=${s.lat},${s.lng}`;
  const nav = [['#tjenester', 'Tjenester'], ['#priser', 'Priser'], ['#dekkhotell', 'Dekkhotell'], ['#kontakt', 'Kontakt']];
  return (
    <div className="w2-page" ref={root} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 30)} style={{ '--acc': s.accent }} data-testid="site-page">
      <a className="w2-skip" href="#main">Hopp til innhold</a>
      <header className={'w2-nav' + (scrolled ? ' solid' : '')}>
        <a className="w2-brand" href={'/' + slug} aria-label={s.full_name}><span className="w2-mark"><CircleDot size={18} strokeWidth={2.6} /></span><b>{s.name}</b></a>
        <nav className={'w2-links' + (menu ? ' open' : '')} aria-label="Meny">{nav.map(([h, t]) => <a key={h} href={h} onClick={() => setMenu(false)}>{t}</a>)}</nav>
        <div className="w2-nav-r">{tel && <a className="w2-icon" href={tel} aria-label="Ring oss"><Phone size={18} /></a>}
          <a className="w2-btn sm" href={book} data-testid="site-book-top">Bestill</a>
          <button className="w2-icon w2-burger" aria-label="Meny" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={20} /></button></div>
      </header>
      <section className="w2-hero" id="main">
        <picture className="w2-hero-bg"><source media="(max-width: 700px)" srcSet={s.hero_image.replace('hero.webp', 'hero-m.webp')} /><img src={s.hero_image} alt="" fetchpriority="high" /></picture>
        <div className="w2-hero-in">
          <span className="w2-eyebrow"><i /> <Txt v={s.eyebrow} /></span>
          <h1><Txt v={s.hero_title} /></h1>
          <p className="w2-lead"><Txt v={s.hero_text} /></p>
          <div className="w2-cta-row"><a className="w2-btn" href={book} data-testid="site-book"><CalendarCheck size={20} /> Bestill time <ArrowRight size={18} /></a>
            <button className="w2-btn ghost" onClick={() => setOpen(true)}><MessageCircle size={20} /> Spør oss</button></div>
          <div className="w2-stats">{(s.stats || []).map((x) => <div key={x.label}><b><Txt v={x.value} /></b><span>{x.label}</span></div>)}</div>
        </div>
        <a href="#tjenester" className="w2-scroll" aria-label="Bla ned"><span /></a>
      </section>

      <section className="w2-sec" id="tjenester"><div className="w2-head w2-rv"><span className="w2-kicker">Tjenester</span><h2>Alt for hjulene dine</h2></div>
        <div className="w2-grid">{s.services.map((x, k) => { const I = iconFor(x.title); return <a key={x.title} className="w2-card w2-rv" style={{ transitionDelay: k * 70 + 'ms' }} href={book}>
          <span className="w2-ic"><I size={24} /></span><h3>{x.title}</h3><p><Txt v={x.text} /></p><span className="w2-card-f"><span className="w2-price"><Txt v={x.price} /></span><ArrowRight size={18} /></span></a>; })}</div></section>

      <section className="w2-sec w2-split" id="dekkhotell">
        <div className="w2-img w2-rv"><img src={s.hotel_image} alt="Dekkhotell med hjul i reoler" loading="lazy" /></div>
        <div className="w2-rv"><span className="w2-kicker">Dekkhotell</span><h2><Txt v={s.hotel_title} /></h2><p className="w2-lead"><Txt v={s.hotel_text} /></p>
          <ul className="w2-checks">{['Vask og sjekk av mønster', 'Trygg lagring – egen plass med QR', 'Påminnelse før sesongen', 'Se dekkene dine på Min side'].map((t) => <li key={t}><ShieldCheck size={18} /> {t}</li>)}</ul>
          <a className="w2-btn" href={book}>Bestill hjulskift + hotell <ArrowRight size={18} /></a></div>
      </section>

      <section className="w2-sec" id="priser"><div className="w2-head w2-rv"><span className="w2-kicker">Priser</span><h2>Enkle priser</h2><p className="w2-sub"><Txt v={s.price_note} /></p></div>
        <div className="w2-prices">{s.prices.map((p, k) => <div key={p.name} className={'w2-pcard w2-rv' + (k === 1 ? ' hl' : '')} style={{ transitionDelay: k * 70 + 'ms' }}>{k === 1 && <span className="w2-tag">Mest valgt</span>}<span>{p.name}</span><b><Txt v={p.price} /></b><a href={book} className={'w2-btn ' + (k === 1 ? '' : 'ghost') + ' sm'}>Velg</a></div>)}</div></section>

      <section className="w2-sec" id="omtaler"><div className="w2-head w2-rv"><span className="w2-kicker">Kundene sier</span><h2><Star size={26} className="w2-star" /> <Txt v={s.rating} /></h2></div>
        <div className="w2-reviews">{(s.reviews || []).map((r, k) => <figure key={k} className="w2-review w2-rv"><div className="w2-stars" aria-label={r.stars + ' av 5'}>{Array.from({ length: r.stars }, (_, i) => <Star key={i} size={16} fill="currentColor" />)}</div><blockquote><Txt v={r.text} /></blockquote><figcaption><Txt v={r.name} /></figcaption></figure>)}</div></section>

      <section className="w2-sec" id="kontakt"><div className="w2-contact w2-rv">
        <div className="w2-cinfo"><span className="w2-kicker">Kontakt</span><h2>Finn oss i Kroer</h2>
          <div className="w2-row"><MapPin size={20} /><div><b>{s.address}, {s.postal}</b><span>{s.area}</span></div></div>
          <div className="w2-row"><Phone size={20} /><div>{tel ? <a href={tel}>{s.phone}</a> : <Txt v={s.phone} />}</div></div>
          <div className="w2-row"><Mail size={20} /><div>{ph(s.email) ? <Txt v={s.email} /> : <a href={'mailto:' + s.email}>{s.email}</a>}</div></div>
          <div className="w2-row"><Clock size={20} /><div className="w2-hours">{s.hours.map((h) => <span key={h.day}><em>{h.day}</em> <Txt v={h.time} /></span>)}</div></div>
          <div className="w2-row"><Navigation size={20} /><div><Txt v={s.directions} /></div></div>
          <div className="w2-cta-row"><a className="w2-btn" href={book}>Bestill time</a><a className="w2-btn ghost" href={maps} target="_blank" rel="noreferrer"><Navigation size={18} /> Veibeskrivelse</a></div></div>
        <div className="w2-map"><iframe title="Kart til verkstedet" src={osm} loading="lazy" /></div></div></section>

      <section className="w2-sec w2-about w2-rv"><span className="w2-kicker">Om oss</span><p><Txt v={s.about} /></p></section>
      <section className="w2-final w2-rv"><h2>Klar for hjulskift?</h2><p>Velg tid selv – timen bekreftes med en gang.</p><a className="w2-btn lg" href={book}><CalendarCheck size={22} /> Bestill time nå</a></section>
      <footer className="w2-foot"><div><b>{s.full_name}</b><span>{s.address}, {s.postal}</span><span>Org.nr {s.orgnr}</span></div><div><a href={book}>Bestill time</a><a href="/minside">Min side</a><a href="#kontakt">Kontakt</a></div><small>© {new Date().getFullYear()} {s.name} · Laget med mondo</small></footer>
      <a className="w2-sticky" href={book}><CalendarCheck size={20} /> Bestill time</a>
      <Bot s={s} slug={slug} open={open} setOpen={setOpen} book={book} />
    </div>
  );
}

function Bot({ s, slug, open, setOpen, book }) {
  const [msgs, setMsgs] = useState([{ from: 'bot', text: s.bot_hello, chips: s.faqs.slice(0, 4) }]); const [q, setQ] = useState(''); const [form, setForm] = useState(null); const [typing, setTyping] = useState(false); const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs, form, open, typing]);
  const ask = async (text, id) => {
    if (!text.trim()) return; setQ(''); setMsgs((m) => [...m, { from: 'me', text }]); setTyping(true);
    const [r] = await Promise.all([api.post(`/site/${slug}/ask`, { q: text, id }).catch(() => ({ found: false, text: 'Noe gikk galt. Prøv igjen.' })), new Promise((ok) => setTimeout(ok, 450))]);
    setTyping(false); setMsgs((m) => [...m, { from: 'bot', text: r.text, handoff: !r.found || r.unanswered, chips: r.suggest, ask: text }]);
  };
  const send = async () => { try { await api.post(`/site/${slug}/question`, form); setMsgs((m) => [...m, { from: 'bot', text: '✅ Takk! Spørsmålet er sendt til verkstedet. Vi svarer deg så fort vi kan.' }]); setForm(null); } catch (e) { setForm({ ...form, err: e.message }); } };
  return <>
    <button className={'w2-fab' + (open ? ' hide' : '')} onClick={() => setOpen(true)} data-testid="bot-open" aria-label="Åpne chat"><MessageCircle size={24} /><span>Spør oss</span></button>
    <div className={'w2-bot' + (open ? ' open' : '')} data-testid={open ? 'bot' : undefined} role="dialog" aria-label="Chat" aria-hidden={!open}>
      <div className="w2-bot-h"><span className="w2-av"><Sparkles size={18} /></span><div><b>{s.bot_name}</b><small><i /> Svarer med en gang</small></div><button onClick={() => setOpen(false)} aria-label="Lukk chat"><X size={20} /></button></div>
      <div className="w2-bot-body">{msgs.map((m, k) => <div key={k} className={'w2-msg ' + m.from}><div className="w2-bubble" data-testid={m.from === 'bot' ? 'bot-msg' : undefined}>{m.text}</div>
        {m.chips && <div className="w2-chips">{m.chips.map((c) => <button key={c.id} onClick={() => ask(c.q, c.id)}>{c.q}</button>)}</div>}
        {m.handoff && <div className="w2-chips"><button className="hl" data-testid="bot-handoff" onClick={() => setForm({ text: m.ask || '', name: '', contact: '' })}>✉️ Send spørsmål</button><a className="hl" href={book}>📅 Bestill time</a></div>}</div>)}
        {typing && <div className="w2-msg bot"><div className="w2-bubble w2-typing"><i /><i /><i /></div></div>}
        {form && <div className="w2-qform" data-testid="bot-form"><input aria-label="Navn" placeholder="Navn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input aria-label="Mobil eller e-post" data-testid="bot-contact" placeholder="Mobil eller e-post" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <textarea aria-label="Spørsmål" rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />{form.err && <div className="w2-err">{form.err}</div>}<button className="w2-btn sm" data-testid="bot-send" onClick={send}>Send</button></div>}
        <div ref={end} /></div>
      <form className="w2-bot-in" onSubmit={(e) => { e.preventDefault(); ask(q); }}><input data-testid="bot-input" aria-label="Skriv et spørsmål" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Skriv et spørsmål…" /><button aria-label="Send"><Send size={18} /></button></form>
    </div>
  </>;
}
