// 🛞 Dekkhotell template set: Kunder (CRM) · Kjøretøy · Bookinger · Dekkhotell lager · Fakturaer.
// Plain mondo boards: Simon can rename/add columns, labels and automations afterwards.
// The booking page / invoice code finds columns by id (saved in the Dekkhotell settings) so renaming is safe.
const { col, grp, cid } = require('./templates');

const L = (spec) => spec.split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(.*)\[(#[0-9a-f]{6})\]$/i); return { id: cid('l'), label: m[1].trim(), color: m[2] }; });
const st = (title, spec) => col('status', title, { labels: [...L(spec), { id: cid('l'), label: '', color: '#c4c4c4' }] });
const by = (cols, t) => cols.find((c) => c.title === t);
const lab = (c, name) => c.settings.labels.find((l) => l.label === name)?.id;
const mirrors = (columns, conn, list) => list.forEach(([t, from]) => columns.push(col('mirror', t, { connectCol: conn.id, colTitle: from })));

function kunder() {
  const columns = [
    col('phone', 'Mobil'), col('email', 'E-post'), col('location', 'Adresse'),
    st('Kundetype', 'Privat[#579bfc]; Bedrift[#784bd1]; Flåte/leasing[#ff6d3b]'),
    st('Kundestatus', 'Aktiv[#00c875]; Ny[#fdab3d]; Inaktiv[#c4c4c4]; Sperret[#df2f4a]'),
    col('connect', 'Kjøretøy', { boardRef: 'dk_kjoretoy' }),
    col('checkbox', 'SMS-samtykke'), col('checkbox', 'Markedsføring OK'),
    col('text', 'Kundenr'), col('text', 'Org.nr'), col('date', 'Sist besøk'), col('long_text', 'Notat'),
  ];
  const groups = [grp('Privatkunder', '#579bfc'), grp('Bedriftskunder', '#784bd1'), grp('Inaktive', '#c4c4c4')];
  return { columns, groups, items: [['Ny kunde', 0]], description: '👤 Kunder (CRM) – mobil er nøkkelen. Kobles til kjøretøy, bookinger, dekkhotell og fakturaer. (Demo: oppdiktede kunder.)',
    views: [{ type: 'map', name: 'Kart', settings: { colorBy: columns[3].id } }] };
}

function kjoretoy() {
  const columns = [
    col('text', 'Regnr'), col('connect', 'Eier', { boardRef: 'dk_kunder' }),
    col('text', 'Merke'), col('text', 'Modell'), col('numbers', 'Årsmodell'),
    col('text', 'Dekkdimensjon sommer'), col('text', 'Dekkdimensjon vinter'),
    st('Biltype', 'Personbil[#579bfc]; SUV / 18"+[#784bd1]; Varebil[#fdab3d]; Elbil[#00c875]'),
    st('TPMS', 'Ja[#00c875]; Nei[#c4c4c4]; Ukjent[#fdab3d]'),
    st('Låsebolt', 'Ingen[#c4c4c4]; I bilen[#579bfc]; På dekkhotellet[#784bd1]'),
    col('date', 'Neste EU-kontroll'), col('long_text', 'Notat'),
  ];
  mirrors(columns, columns[1], [['Mobil', 'Mobil']]);
  const groups = [grp('Kjøretøy', '#579bfc'), grp('Solgt / inaktiv', '#c4c4c4')];
  return { columns, groups, items: [['AB 12345', 0]], description: '🚗 Kjøretøy – regnr er nøkkelen. Eier kobles til Kunder.', needs: ['dk_kunder'],
    automations: [{ trigger: { type: 'date_arrives', col: by(columns, 'Neste EU-kontroll').id, offset: -30 }, action: { type: 'notify', person: 'p_simon', text: 'EU-kontroll om 30 dager – tilby time' } }] };
}

function bookinger() {
  const columns = [
    col('date', 'Dato'), col('text', 'Tid'),
    st('Status', 'Bestilt[#fdab3d]; Bekreftet[#579bfc]; Møtt[#784bd1]; Ferdig[#00c875]; Ikke møtt[#df2f4a]; Avlyst[#c4c4c4]'),
    st('Tjeneste', 'Hjulskift[#579bfc]; Hjulskift + dekkhotell[#784bd1]; Nye dekk montering[#ff6d3b]; Balansering[#fdab3d]; Punktering[#df2f4a]; Dekkhotell innlevering[#037f4c]'),
    col('text', 'Regnr'),
    col('connect', 'Kunde', { boardRef: 'dk_kunder' }), col('connect', 'Kjøretøy', { boardRef: 'dk_kjoretoy' }),
    col('phone', 'Mobil'), col('email', 'E-post'),
    st('Løft', 'Løft 1[#579bfc]; Løft 2[#00c875]; Løft 3[#fdab3d]; Løft 4[#784bd1]'),
    col('people', 'Mekaniker'), col('numbers', 'Varighet (min)'), col('numbers', 'Pris', { unit: 'kr' }),
    st('Betaling', 'Ikke betalt[#df2f4a]; Betales ved henting[#fdab3d]; Betalt Vipps[#ff5ac4]; Betalt kort[#579bfc]; Fakturert[#784bd1]; Betalt[#00c875]'),
    st('Kilde', 'Nettbooking[#00c875]; Telefon[#579bfc]; Drop-in[#fdab3d]; Innkalling[#784bd1]'),
    col('long_text', 'Kommentar'), col('text', 'Bookingref'),
  ];
  const groups = [grp('Nye bookinger', '#fdab3d'), grp('Bekreftet', '#579bfc'), grp('Ferdig', '#00c875'), grp('Ikke møtt / avlyst', '#df2f4a')];
  const s = by(columns, 'Status');
  const automations = [
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Bekreftet') }, action: { type: 'move_group', group: groups[1].id } },
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Bekreftet') }, action: { type: 'notify', person: 'p_simon', text: 'Booking bekreftet – bekreftelse (SMS/e-post) ligger klar i Utboks' } },
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Bekreftet') }, action: { type: 'dk_confirm' } },
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Ferdig') }, action: { type: 'move_group', group: groups[2].id } },
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Ferdig') }, action: { type: 'dk_invoice' } },
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Ikke møtt') }, action: { type: 'move_group', group: groups[3].id } },
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Avlyst') }, action: { type: 'move_group', group: groups[3].id } },
    { trigger: { type: 'date_arrives', col: by(columns, 'Dato').id, offset: -1 }, action: { type: 'notify', person: 'p_simon', text: 'Time i morgen – påminnelse til kunden (SMS-utkast)' } },
  ];
  return { columns, groups, items: [['Ny booking', 0]], automations, needs: ['dk_kunder', 'dk_kjoretoy'],
    description: '📅 Bookinger – Bestilt → Bekreftet ⚡ varsel → Møtt → Ferdig ⚡ faktura lages. Nettbooking legger inn nye her.',
    views: [{ type: 'calendar', name: 'Kalender', settings: { col: columns[0].id } }, { type: 'kanban', name: 'Status', settings: { col: s.id } }, { type: 'chart', name: 'Diagram', settings: { col: by(columns, 'Tjeneste').id } }] };
}

function lager() {
  const columns = [
    col('connect', 'Kunde', { boardRef: 'dk_kunder' }), col('connect', 'Kjøretøy', { boardRef: 'dk_kjoretoy' }),
    col('text', 'Hjulsett-ID'), col('text', 'Lagerplass'),
    st('Seksjon', 'A[#579bfc]; B[#00c875]; C[#fdab3d]; D[#784bd1]; Container[#7f5347]'),
    st('Sesong', 'Sommer[#ffcb00]; Vinter piggfri[#579bfc]; Vinter pigg[#225091]; Helår[#00c875]'),
    st('Lagerstatus', 'På lager[#00c875]; På bilen nå[#579bfc]; Utlevert til kunde[#c4c4c4]; Skal kastes[#df2f4a]'),
    col('text', 'Dimensjon'), col('text', 'Dekkmerke'), col('text', 'DOT / år'),
    col('numbers', 'Mønster VF (mm)'), col('numbers', 'Mønster HF (mm)'), col('numbers', 'Mønster VB (mm)'), col('numbers', 'Mønster HB (mm)'),
    st('Tilstand', 'God[#00c875]; OK[#9cd326]; Bør byttes snart[#fdab3d]; Må byttes[#df2f4a]'),
    st('Felg', 'Stålfelg[#757575]; Alufelg[#579bfc]; Uten felg[#c4c4c4]'),
    col('checkbox', 'Bolter med'), col('checkbox', 'TPMS-sensorer'),
    col('link', 'Bilder'), col('numbers', 'Lagerleie', { unit: 'kr' }),
    st('Lagerleie betalt', 'Ikke betalt[#df2f4a]; Betalt[#00c875]; Inkludert i avtale[#579bfc]'),
    col('date', 'Innlevert'), col('date', 'Neste sesongbytte'), col('long_text', 'Notat'),
  ];
  const groups = [grp('Vintersett på lager', '#579bfc'), grp('Sommersett på lager', '#ffcb00'), grp('Utlevert / avsluttet', '#c4c4c4')];
  const tl = by(columns, 'Tilstand'), ls = by(columns, 'Lagerstatus');
  const automations = [
    { trigger: { type: 'date_arrives', col: by(columns, 'Neste sesongbytte').id, offset: -21 }, action: { type: 'notify', person: 'p_simon', text: 'Sesongbytte om 3 uker – send innkalling med bookinglenke' } },
    { trigger: { type: 'status_change', col: tl.id, to: lab(tl, 'Må byttes') }, action: { type: 'notify', person: 'p_simon', text: 'Dekk må byttes – send tilbud på nye dekk før timen' } },
    { trigger: { type: 'status_change', col: ls.id, to: lab(ls, 'Utlevert til kunde') }, action: { type: 'move_group', group: groups[2].id } },
  ];
  return { columns, groups, items: [['Nytt hjulsett', 0]], automations, needs: ['dk_kunder', 'dk_kjoretoy'],
    description: '🛞 Dekkhotell lager – lagerplass, 4× mønsterdybde, tilstand og bilder. Hjulsett-ID er en QR-etikett fra Assets. Rødt = må byttes.',
    views: [{ type: 'kanban', name: 'Lagerstatus', settings: { col: ls.id } }, { type: 'chart', name: 'Tilstand', settings: { col: tl.id } }] };
}

function faktura() {
  const columns = [
    col('text', 'Fakturanr'), col('connect', 'Kunde', { boardRef: 'dk_kunder' }), col('connect', 'Booking', { boardRef: 'dk_bookinger' }),
    col('numbers', 'Beløp eks. mva', { unit: 'kr' }), col('numbers', 'MVA 25 %', { unit: 'kr' }), col('numbers', 'Totalt', { unit: 'kr' }),
    st('Status', 'Utkast[#c4c4c4]; Sendt[#579bfc]; Betalt[#00c875]; Forfalt[#df2f4a]; Kreditert[#757575]'),
    col('date', 'Fakturadato'), col('date', 'Forfallsdato'),
    st('Betalingsmåte', 'Faktura[#784bd1]; Vipps[#ff5ac4]; Kort (Stripe)[#579bfc]; Ved henting[#fdab3d]'),
    col('email', 'E-post'), col('text', 'KID'),
    st('Regnskap', 'Ikke overført[#c4c4c4]; Overført Fiken[#00c875]; Overført Tripletex[#579bfc]; Overført PowerOffice[#784bd1]'),
    col('link', 'Faktura-PDF'), col('link', 'Betalingslenke'),
  ];
  const groups = [grp('Åpne fakturaer', '#579bfc'), grp('Betalt', '#00c875')];
  const s = by(columns, 'Status');
  const automations = [
    { trigger: { type: 'status_change', col: s.id, to: lab(s, 'Betalt') }, action: { type: 'move_group', group: groups[1].id } },
    { trigger: { type: 'date_arrives', col: by(columns, 'Forfallsdato').id, offset: 1 }, action: { type: 'notify', person: 'p_simon', text: 'Faktura forfalt i går – sjekk betaling' } },
  ];
  return { columns, groups, items: [], automations, needs: ['dk_kunder', 'dk_bookinger'],
    description: '🧾 Fakturaer – lages automatisk når en booking settes til Ferdig. PDF, e-postutkast og betalingslenke (Vipps/Stripe – ikke aktiv før nøkler legges inn).' };
}

const wrapNeeds = (fn) => () => { const m = fn(); delete m.needs; return m; };
module.exports = {
  dk_kunder: { name: 'Kunder', icon: '👤', label: 'Dekk: Kunder (CRM)', desc: 'Kunder med mobil, kjøretøy og samtykke', make: wrapNeeds(kunder) },
  dk_kjoretoy: { name: 'Kjøretøy', icon: '🚗', label: 'Dekk: Kjøretøy', desc: 'Regnr, dimensjoner, TPMS, eier', make: wrapNeeds(kjoretoy), needs: ['dk_kunder'] },
  dk_bookinger: { name: 'Bookinger', icon: '📅', label: 'Dekk: Bookinger', desc: 'Timebok med løft, status og betaling', make: wrapNeeds(bookinger), needs: ['dk_kunder', 'dk_kjoretoy'] },
  dk_lager: { name: 'Dekkhotell lager', icon: '🛞', label: 'Dekk: Dekkhotell lager', desc: 'Hjulsett, lagerplass, mønsterdybde', make: wrapNeeds(lager), needs: ['dk_kunder', 'dk_kjoretoy'] },
  dk_faktura: { name: 'Fakturaer', icon: '🧾', label: 'Dekk: Fakturaer', desc: 'Faktura, MVA, forfall, betaling', make: wrapNeeds(faktura), needs: ['dk_kunder', 'dk_bookinger'] },
};
