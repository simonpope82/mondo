// 🌐 Public landing pages (e.g. /web-bil) + FAQ chat bot (keyword/fuzzy, no paid AI). Texts, FAQ and look are edited in #/dekk → Nettside.
// Only public business facts are seeded; everything unverified is a [placeholder] for Simon to fill.
const J = (s, d) => { try { return JSON.parse(s) ?? d; } catch { return d; } };
const P = (t) => `[${t} – fylles inn]`;
const isPh = (s) => !s || /^\s*\[.*\]\s*$/.test(String(s));

const DEFAULTS = {
  'web-bil': () => ({
    slug: 'web-bil', name: 'Web-Bil', full_name: 'Web-Bil Bjørn Erik Walle', color: '#0b5cad', accent: '#ffb400',
    hero_title: 'Dekkskift og dekkhotell i Kroer',
    hero_text: 'Lokalt dekkverksted på Danskerud i Ås. Bestill time på nett – du får svar med en gang.',
    eyebrow: 'Dekkverksted · Kroer, Ås',
    hero_image: '/web-bil/hero.webp', hotel_image: '/web-bil/hotell.webp',
    hotel_title: 'Dekkhotell – vi tar vare på hjulene', hotel_text: 'Hjulene dine vaskes, sjekkes og lagres trygt til neste sesong. Du får beskjed når det er tid for skift.',
    stats: [{ value: 'Siden 1997', label: 'Registrert foretak' }, { value: P('antall'), label: 'Hjulsett på hotellet' }, { value: '1 min', label: 'Å bestille time' }],
    reviews: [{ text: P('Kundeomtale 1'), name: P('Navn'), stars: 5 }, { text: P('Kundeomtale 2'), name: P('Navn'), stars: 5 }, { text: P('Kundeomtale 3'), name: P('Navn'), stars: 5 }],
    rating: P('vurdering, f.eks. 4,8 / 5'),
    local_badge: 'Lokalt verksted på Kroer', local_badge_sub: 'Ås · siden 1997',
    local_kicker: 'Her i nabolaget', local_title: 'Naboer som hjelper naboer',
    local_text: 'Vi er et lite verksted på Danskerud i Kroer, og kundene våre er naboene våre. Kort vei hit, kjente fjes og service du kan stole på.',
    local_points: [{ title: 'Kort kjøretur', text: 'Like ved, uten å måtte inn til byen.' }, { title: 'Dekkene dine blir i Ås', text: 'Dekkhotellet ligger her på verkstedet.' }, { title: 'Støtt lokale bedrifter', text: 'Pengene du bruker her blir i bygda.' }],
    local_places: [{ name: 'Kroer', dist: 'Her er vi' }, { name: 'Ås sentrum', dist: 'ca. 3 km' }, { name: 'Vestby', dist: 'ca. 7 km' }, { name: 'Ski', dist: 'ca. 8 km' }, { name: 'Nordby', dist: 'ca. 9 km' }, { name: 'Drøbak', dist: 'ca. 12 km' }],
    local_places_note: 'Avstander er omtrentlige, i luftlinje.',
    local_supplier: P('dekkmerker/leverandør'),
    local_image: '/web-bil/lokal.webp', local_cta: 'Bestill time hos naboen',
    badges: ['🛞 Dekkhotell', '🔄 Hjulskift', '📍 Kroer, Ås', '📅 Book på nett'],
    about: 'Web-Bil har drevet dekkhotell og dekkskift ved Danskerud i Kroer siden 1990-tallet. ' + P('Mer om oss – Simon skriver'),
    services: [
      { icon: '🔄', title: 'Hjulskift', text: 'Sommer til vinter og vinter til sommer. Vi sjekker mønster og lufttrykk.', price: P('pris') },
      { icon: '🏨', title: 'Dekkhotell', text: 'Vi lagrer hjulene dine trygt til neste sesong.', price: P('pris per sesong') },
      { icon: '🛞', title: 'Nye dekk', text: 'Vi hjelper deg å velge og monterer nye dekk.', price: P('pris') },
      { icon: '🩹', title: 'Punktering', text: 'Lekk dekk? Vi reparerer når det er mulig.', price: P('pris') },
    ],
    prices: [{ name: 'Hjulskift personbil', price: P('kr') }, { name: 'Hjulskift + dekkhotell', price: P('kr') }, { name: 'Balansering 4 hjul', price: P('kr') }, { name: 'Punktering', price: P('kr') }],
    price_note: 'Prisene er veiledende. Endelig pris står i bestillingen.',
    hours: [{ day: 'Mandag–fredag', time: P('åpningstid, f.eks. 08–16') }, { day: 'Lørdag', time: P('åpent/stengt') }, { day: 'Søndag', time: 'Stengt' }],
    address: 'Kroerveien 115', postal: '1435 Ås', area: 'Danskerud, Kroer', lat: 59.64666, lng: 10.832072,
    phone: P('telefon'), email: P('e-post'), orgnr: '979 189 087',
    directions: P('Veibeskrivelse / parkering'),
    faqs: [
      { id: 'f1', q: 'Hvor ligger dere?', a: 'Vi ligger i Kroerveien 115, 1435 Ås (Danskerud i Kroer). Se kartet nederst på siden.', keywords: 'adresse hvor ligger finne kart veibeskrivelse kroer ås' },
      { id: 'f2', q: 'Hvordan bestiller jeg time?', a: 'Trykk «Bestill time». Velg tjeneste, skriv regnr og velg en ledig tid. Timen blir bekreftet med en gang.', keywords: 'bestille booke time timebestilling ledig' },
      { id: 'f3', q: 'Hva koster hjulskift?', a: P('Svar om pris på hjulskift'), keywords: 'pris koster kost hjulskift dekkskift hvor mye' },
      { id: 'f4', q: 'Har dere dekkhotell?', a: 'Ja, vi har dekkhotell. Du kan legge til dekkhotell når du bestiller time. ' + P('pris per sesong'), keywords: 'dekkhotell lagring lagre oppbevaring hotell' },
      { id: 'f5', q: 'Når har dere åpent?', a: P('Svar om åpningstider'), keywords: 'åpent åpningstid åpningstider stengt lørdag når' },
      { id: 'f6', q: 'Hvor lang tid tar et hjulskift?', a: 'Et vanlig hjulskift tar ca. 30 minutter.', keywords: 'tid tar lang minutter vente' },
      { id: 'f7', q: 'Kan jeg vente mens dere jobber?', a: P('Svar om venterom / vente på stedet'), keywords: 'vente venterom kaffe mens' },
      { id: 'f8', q: 'Hvordan kan jeg betale?', a: P('Svar om betaling (kort, Vipps, faktura)'), keywords: 'betale betaling vipps kort faktura kontant' },
      { id: 'f9', q: 'Selger dere nye dekk?', a: P('Svar om nye dekk / merker'), keywords: 'nye dekk kjøpe selger vinterdekk sommerdekk piggdekk piggfri merke' },
      { id: 'f10', q: 'Hva må jeg ha med meg?', a: 'Ta med låsebolt-nøkkelen hvis bilen har låsebolter.', keywords: 'ha med låsebolt nøkkel ta med' },
      { id: 'f11', q: 'Kan jeg avbestille eller flytte timen?', a: P('Svar om avbestilling'), keywords: 'avbestille flytte endre kansellere avlyse' },
      { id: 'f12', q: 'Reparerer dere punktering?', a: 'Ja, vi reparerer punktering når dekket kan repareres. Bestill «Punktering» på nett.', keywords: 'punktering lekk hull reparere spiker' },
    ],
    bot_name: 'Dekk-hjelperen', bot_hello: 'Hei! 👋 Spør meg om time, priser, dekkhotell eller åpningstider.',
    placeholders_note: 'Felter i [klammer] er plassholdere som Simon fyller inn.',
  }),
};

// ---- fuzzy matching ----
const norm = (s) => String(s || '').toLowerCase().normalize('NFC').replace(/[^a-z0-9æøåéü\s]/g, ' ');
const STOP = new Set('jeg du dere vi er det en et på i og å har kan hva hvor hvordan når med til for som min mitt meg dere deres om av den de ikke the a'.split(' '));
const SYN = { koster: 'pris', kost: 'pris', priser: 'pris', prisen: 'pris', lagre: 'dekkhotell', lagring: 'dekkhotell', oppbevaring: 'dekkhotell', hotell: 'dekkhotell', booke: 'bestille', booking: 'bestille', bestilling: 'bestille', timebestilling: 'bestille', åpningstider: 'åpent', åpningstid: 'åpent', open: 'åpent', stengt: 'åpent', dekkskift: 'hjulskift', skifte: 'hjulskift', bytte: 'hjulskift', hjulbytte: 'hjulskift', lekk: 'punktering', punktert: 'punktering', adressen: 'adresse', vipps: 'betale', kort: 'betale' };
const toks = (s) => norm(s).split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t)).map((t) => SYN[t] || t);
function lev(a, b) { if (Math.abs(a.length - b.length) > 1) return 2; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
const near = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) || (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1);
function match(faqs, question) {
  const q = toks(question); if (!q.length) return null;
  let best = null;
  for (const f of faqs) {
    const kw = new Set([...toks(f.q), ...toks(f.keywords)]);
    let score = 0; for (const t of q) if ([...kw].some((k) => near(t, k))) score += t.length >= 5 ? 1.2 : 1;
    const rel = score / Math.max(2, q.length);
    if (score >= 1 && (!best || rel > best.rel)) best = { f, score, rel };
  }
  return best && best.rel >= 0.3 ? best.f : null;
}

module.exports.routes = function routes(app, { db, aw, limit, adminOnly, notify, now }) {
  const get = (slug) => { const d = DEFAULTS[slug]; const s = J(db.prepare('select value from meta where key=?').get('site_' + slug)?.value, null); return s ? { ...(d ? d() : {}), ...s } : d ? d() : null; };
  const save = (slug, v) => db.prepare('insert into meta values(?, ?) on conflict(key) do update set value=excluded.value').run('site_' + slug, JSON.stringify(v));
  const err = (m, status) => Object.assign(new Error(m), { status });
  app.get('/api/site/:slug', aw((req) => { const s = get(req.params.slug); if (!s) throw err('not found', 404); const { faqs, ...pub } = s; return { ...pub, faqs: faqs.map(({ id, q }) => ({ id, q })) }; }));
  app.post('/api/site/:slug/ask', aw((req) => {
    limit(req, 200); const s = get(req.params.slug); if (!s) throw err('not found', 404);
    const q = String(req.body?.q || '').slice(0, 300); const f = req.body?.id ? s.faqs.find((x) => x.id === req.body.id) : match(s.faqs, q);
    if (!f) return { found: false, text: 'Det vet jeg ikke helt 🤔 Du kan sende spørsmålet til verkstedet, eller bestille time direkte.', suggest: s.faqs.slice(0, 3).map(({ id, q: qq }) => ({ id, q: qq })) };
    if (isPh(f.a)) return { found: true, q: f.q, unanswered: true, text: 'Godt spørsmål! Svaret kommer snart her. Send spørsmålet ditt, så svarer verkstedet deg.' };
    return { found: true, q: f.q, text: f.a.replace(/\s*\[[^\]]*\]/g, '').trim() || f.a };
  }));
  app.post('/api/site/:slug/question', aw((req) => {
    limit(req, 10); const s = get(req.params.slug); if (!s) throw err('not found', 404);
    const name = String(req.body?.name || '').trim().slice(0, 80), contact = String(req.body?.contact || '').trim().slice(0, 120), text = String(req.body?.text || '').trim().slice(0, 1000);
    if (!text || !contact) throw err('Skriv spørsmål og mobil eller e-post', 400);
    db.prepare('insert into dk_outbox(kind,to_addr,subject,body,attachment,board_id,item_id,status,created) values(?,?,?,?,?,?,?,?,?)').run('question', contact, `Spørsmål fra ${s.name}-nettsiden${name ? ' – ' + name : ''}`, text, null, null, null, 'Nytt spørsmål – svar kunden selv', now());
    notify('p_simon', `💬 Nytt spørsmål fra ${s.name}-nettsiden: “${text.slice(0, 80)}”`, null, null, '/#/dekk/utboks');
    return { ok: true };
  }));
  app.get('/api/dekk/site/:slug', aw((req) => { const s = get(req.params.slug); if (!s) throw err('not found', 404); return s; }));
  app.put('/api/dekk/site/:slug', aw((req) => {
    adminOnly(req); const cur = get(req.params.slug); if (!cur) throw err('not found', 404); const b = req.body || {};
    const next = { ...cur }; const str = (v, n = 600) => String(v ?? '').slice(0, n);
    for (const k of ['eyebrow', 'hero_image', 'hotel_image', 'hotel_title', 'hotel_text', 'rating', 'local_badge', 'local_badge_sub', 'local_kicker', 'local_title', 'local_text', 'local_places_note', 'local_supplier', 'local_image', 'local_cta', 'name', 'full_name', 'hero_title', 'hero_text', 'about', 'price_note', 'address', 'postal', 'area', 'phone', 'email', 'orgnr', 'directions', 'bot_name', 'bot_hello', 'color', 'accent']) if (k in b) next[k] = str(b[k], k === 'about' ? 2000 : 300);
    for (const k of ['lat', 'lng']) if (k in b && !isNaN(+b[k])) next[k] = +b[k];
    if (Array.isArray(b.badges)) next.badges = b.badges.map((x) => str(x, 40)).filter(Boolean).slice(0, 8);
    if (Array.isArray(b.services)) next.services = b.services.slice(0, 12).map((x) => ({ icon: str(x.icon, 4), title: str(x.title, 60), text: str(x.text, 300), price: str(x.price, 60) })).filter((x) => x.title);
    if (Array.isArray(b.prices)) next.prices = b.prices.slice(0, 30).map((x) => ({ name: str(x.name, 80), price: str(x.price, 40) })).filter((x) => x.name);
    if (Array.isArray(b.local_points)) next.local_points = b.local_points.slice(0, 6).map((x) => ({ title: str(x.title, 80), text: str(x.text, 200) })).filter((x) => x.title);
    if (Array.isArray(b.local_places)) next.local_places = b.local_places.slice(0, 10).map((x) => ({ name: str(x.name, 40), dist: str(x.dist, 40) })).filter((x) => x.name);
    if (Array.isArray(b.stats)) next.stats = b.stats.slice(0, 4).map((x) => ({ value: str(x.value, 40), label: str(x.label, 60) })).filter((x) => x.value);
    if (Array.isArray(b.reviews)) next.reviews = b.reviews.slice(0, 12).map((x) => ({ text: str(x.text, 500), name: str(x.name, 60), stars: Math.max(1, Math.min(5, +x.stars || 5)) })).filter((x) => x.text);
    if (Array.isArray(b.hours)) next.hours = b.hours.slice(0, 10).map((x) => ({ day: str(x.day, 40), time: str(x.time, 60) })).filter((x) => x.day);
    if (Array.isArray(b.faqs)) next.faqs = b.faqs.slice(0, 100).map((x, k) => ({ id: str(x.id || 'f' + Date.now() + k, 30), q: str(x.q, 200), a: str(x.a, 2000), keywords: str(x.keywords, 300) })).filter((x) => x.q);
    save(req.params.slug, next); return next;
  }));
};
module.exports.match = match;
