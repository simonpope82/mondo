// Kaffeknappen boards – same STRUCTURE as Simon's most used monday boards (names, groups, column titles/types,
// status labels + colours, connect/mirror, automations). No real data: example rows are made up in seed-kk.js.
const { col, grp, cid } = require('./templates');

const L = (spec) => spec.split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(.*)\[(#[0-9a-f]{6})\]$/i); return { id: cid('l'), label: m[1].trim(), color: m[2] }; });
const st = (title, spec) => { const c = col('status', title, { labels: [...L(spec), { id: cid('l'), label: '', color: '#c4c4c4' }] }); return c; };
const MONTHS = ['Jan', 'Feb', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dec'];
const MONTHS2 = ['Jan', 'Feb', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'Augs', 'Sep', 'Okt', 'Nov', 'Dec'];
const monthGroups = (prefix, names) => names.map((m) => ({ ...grp(`${prefix} ${m}`, '#c4c4c4'), collapsed: true }));
const byTitle = (cols, t) => cols.find((c) => c.title === t);
const lab = (c, name) => c.settings.labels.find((l) => l.label === name)?.id;

// ---------- 👨‍👩‍👧‍👦 Alle Kunder (KK alle Kunde main) ----------
function kunder() {
  const columns = [
    col('long_text', 'Leverings info'),
    st('Avtale', 'FLYT Vip[#df2f4a]; FLYT ekstra[#00c875]; MAGNAT[#579bfc]; Kontrakt[#5559df]; FLYT[#037f4c]; FLYT - AQUA[#66ccff]; FLYT online[#74afcc]; FLYT VIP[#ff5ac4]; Kun ingredienser[#333333]; Kun kaldtvann[#bb3354]; Kun service[#ff007f]; NS avtale[#784bd1]; NS avtale-hver 4. uke[#ffcb00]; NS avtale-hver 6. uke[#9cd326]; Partner[#757575]; Serveringsavtale[#7f5347]; Spesialavtale[#ff6d3b]; Anbudskunde[#faa1f1]; Årlig serviceavtale[#ffadad]'),
    col('location', 'Addresse'),
    col('phone', 'Phone'),
    col('text', 'Kunde Nr'),
    st('Avdeling', 'Oslo[#00c875]; Trondheim[#9d50dd]; Stavanger[#ff007f]; Bergen[#579bfc]; 16[#fdab3d]; 17[#007eb5]; 214[#df2f4a]; 215[#cab641]'),
    // in monday VA/SA are status columns whose labels are staff names/numbers – here with made-up names
    st('VA', 'Anna Berg[#fdab3d]; Maria Holm[#00c875]; Oslo[#bb3354]'),
    st('SA', 'Erik Lund[#fdab3d]; Jonas Dahl[#00c875]; Simon Pope[#df2f4a]'),
    col('text', 'Notes 2'),
    col('last_updated', 'Last Updated'),
    st('Kunde status', 'Working on it[#fdab3d]; Done[#00c875]; Stuck[#df2f4a]; Kunde[#007eb5]; Tapt kunde[#9d50dd]'),
  ];
  const groups = [grp('Kunde', '#579bfc'), grp('PD Kunder', '#9d50dd')];
  const avd = byTitle(columns, 'Avdeling');
  return {
    columns, groups, items: [['Ny kunde', 0]],
    sub_columns: [col('people', 'Owner'), col('status', 'Status'), col('date', 'Date')],
    description: 'Kundekartotek – alle kunder med avtale, adresse og kontaktinfo. (Demo: oppdiktede kunder.)',
    views: [{ type: 'map', name: 'Map', settings: { colorBy: avd.id } }, { type: 'table', name: 'Sist oppdatert' }],
  };
}

// ---------- 🚨 Feilmeldinger/Oppdrag (26KK) ----------
function feil() {
  const columns = [
    col('people', 'Serviceperson'),
    col('connect', 'Kunde VIKTIG', { boardRef: 'kk_kunder' }),
    col('date', 'Planlagt'),
    st('FEIL', 'PULVER/MIKSERKOPP[#fdab3d]; MELK[#00c875]; PROGRAM/SOFTWARE[#df2f4a]; BRYGGER[#007eb5]; KVÆRN[#9d50dd]; LEKKASJE[#037f4c]; SMAK / INSTILLINGER[#579bfc]; CLEANING[#cab641]; EKSTERN PROBLEM[#ff007f]; OTHER[#333333]; FLYTTING[#cd9282]; SENSOR[#ffcb00]; KJØLESKAPET[#ff5ac4]; KAFFESMAKING[#784bd1]; PUMPE[#9cd326]; VANNKJØLER[#66ccff]'),
    st('Process Status', 'På vei/under arbeid[#fdab3d]; Ferdig[#00c875]; Ikke fordelt[#df2f4a]; Tas ved service[#c4c4c4]; På vent[#037f4c]; Må tilbake[#579bfc]; Fikset over tlf[#333333]; Planlagt[#ff6d3b]'),
    st('LEV', 'JA[#00c875]; Nei[#df2f4a]'),
    st('Maskin som er feil', 'Eversys[#fdab3d]; De Jong Duke[#00c875]; Jura[#df2f4a]; Escowa[#007eb5]; Animo[#9d50dd]; La Cimbali[#037f4c]; Crem International[#579bfc]; Bonamat[#cab641]; Melitta[#ffcb00]; Schærer[#333333]; Annet[#bb3354]; Filter bytte[#ff007f]; WMF[#ff5ac4]; Borg & Overstom[#784bd1]; Aequator[#9cd326]; AVY XL[#66ccff]; Aqablue[#a9bee8]; KAFFESMAKING[#7f5347]; IKKE MASKIN FEIL[#ff6d3b]; Låne maskin[#ff7575]'),
    st('Fakturere?', 'VET IKKE[#fdab3d]; JA[#ff007f]; NEI[#df2f4a]; info kommer[#007eb5]; Fakturert[#00c875]'),
  ];
  const conn = columns[1];
  const mir = (title, from) => col('mirror', title, { connectCol: conn.id, colTitle: from });
  columns.push(mir('Avtale', 'Avtale'), mir('Adressen', 'Addresse'), mir('Tlf nr', 'Phone'), mir('Avdeling', 'Avdeling'), mir('Info', 'Leverings info'), mir('Kunde nr', 'Kunde Nr'));
  columns.push(col('creation_log', 'Creation Log'), col('time_tracking', 'Time tracking'), mir('VA', 'VA'), mir('SA', 'SA'), col('numbers', 'Number'), col('text', 'Gocodes'));
  const groups = [grp('Kunde', '#df2f4a'), grp('Completed Feilmeldinger', '#00c875'), ...monthGroups('CF', MONTHS)];
  const ps = byTitle(columns, 'Process Status'), fk = byTitle(columns, 'Fakturere?'), fe = byTitle(columns, 'FEIL'), tt = byTitle(columns, 'Time tracking');
  const automations = [
    { trigger: { type: 'item_created' }, action: { type: 'set_status', col: ps.id, to: lab(ps, 'Ikke fordelt') } },
    { trigger: { type: 'item_created' }, action: { type: 'set_status', col: fk.id, to: lab(fk, 'VET IKKE') } },
    { trigger: { type: 'status_change', col: ps.id, to: lab(ps, 'Ferdig') }, action: { type: 'move_group', group: groups[1].id } },
    { trigger: { type: 'status_change', col: ps.id, to: lab(ps, 'På vei/under arbeid') }, action: { type: 'time', mode: 'start', col: tt.id } },
    { trigger: { type: 'status_change', col: ps.id, to: lab(ps, 'Ferdig') }, action: { type: 'time', mode: 'stop', col: tt.id } },
    { trigger: { type: 'status_change', col: ps.id, to: lab(ps, 'På vent') }, action: { type: 'time', mode: 'stop', col: tt.id } },
    { trigger: { type: 'status_change', col: fe.id, to: lab(fe, 'FLYTTING') }, action: { type: 'notify', person: 'p_anna', text: 'Vi skal flytte denne kunden – sjekk avtale og planlegg' } },
  ];
  return {
    columns, groups, items: [['Ny feilmelding', 0]], automations,
    description: 'Feilmeldinger og oppdrag: mottak → fordel tekniker → planlegg → Ferdig flytter til Completed ⚡ (Demo: oppdiktede data.)',
    views: [{ type: 'kanban', name: 'Kanban', settings: { col: ps.id } }, { type: 'chart', name: 'Chart' }],
    form: { title: 'Kunden / Feil', desc: 'Meld inn en feil', public: false, fields: [fe.id, byTitle(columns, 'Maskin som er feil').id, byTitle(columns, 'Planlagt').id] },
  };
}

// ---------- 🔨 Monteringsplan (26 KK) ----------
function montering() {
  const sub_columns = [
    st('Klargjort', 'Working on it[#fdab3d]; JA[#00c875]; Nei[#df2f4a]'),
    col('numbers', 'Antall'),
    col('people', 'LAGER'),
    st('På lager', 'Bestilt[#fdab3d]; JA[#00c875]; Må Bestilles[#df2f4a]; Flytting[#007eb5]; Henting[#9d50dd]; Venter på info[#c4c4c4]; Forlengelse[#579bfc]; Eksisterende/Allerede montert[#333333]'),
    col('week', 'Forventet levering'),
    col('text', 'Serial Nr'),
    col('text', 'Følgeseddel nr'),
    col('date', 'Date'),
  ];
  const columns = [
    col('people', 'SA'),
    col('connect', 'Kunde', { boardRef: 'kk_kunder' }),
    col('mirror', 'På lager', { connectCol: '__sub', colId: sub_columns[3].id }),
    st('Type', 'Fornyelser[#fdab3d]; Ny kunde[#00c875]; Henting[#df2f4a]; Flytting[#007eb5]; Lånemaskin[#9d50dd]; Utvidelse[#ff6d3b]; Prøve[#ff007f]; kort tids leie[#66ccff]; Forlengelse[#7f5347]'),
    st('Befaring', 'Planlagt[#fdab3d]; Ferdig[#00c875]; Må planlegges[#df2f4a]; Trenger ikke[#9cd326]'),
    col('date', 'Befaring dato'),
    col('date', 'Planlagt Montering'),
    col('people', 'VA'),
    col('date', 'Klargjørings dato'),
    col('link', 'Ordergrunnlag'),
    st('Status varer', 'Working on it[#fdab3d]; Varer klart[#00c875]; Venter på varer order[#df2f4a]; Skal ikke ha varer[#579bfc]'),
    st('Service avtale', 'Egen avtale[#fdab3d]; FLYT Basic[#00c875]; KJØP[#df2f4a]; FLYT + AQUA[#007eb5]; Flyt Online[#ff5ac4]; Årlig Service[#74afcc]; Ingen avtale[#579bfc]; Servering[#333333]; FLYT VIP[#ff007f]; FLYT AQUA[#784bd1]; Gamle avtale NS[#faa1f1]; PÅ TEST[#7e3b8a]'),
    st('UTFØRT?', 'På stede[#fdab3d]; JA[#00c875]; Venter[#df2f4a]; Arbeidet startet[#9d50dd]; Må tilbake[#579bfc]; Satt på vent[#ff6d3b]'),
    col('people', 'Tekkie'),
    st('Kontor', 'BERGEN[#fdab3d]; TRONDHEIM[#bca58a]; OSLO[#ff007f]; STAVANGER[#784bd1]'),
    st('NS liste', 'Kun vannkjøler[#fdab3d]; Oppdatert[#00c875]; Ikke oppdatert[#df2f4a]; Spesiell avtale[#bda8f9]; Årlig service[#9d50dd]; Ikke service[#ffcb00]'),
    st('Deler/utsyr', 'working on it[#fdab3d]; tillegg[#00c875]; ikke tillegg[#df2f4a]'),
    st('Msk Faktuert', 'Fakturert[#00c875]; Klar til fakturering[#9cd326]; .[#c4c4c4]; Vent med fakturering[#ffcb00]; Ordren klar (PCK)[#ff6d3b]; Skal ikke faktureres[#7f5347]'),
    col('long_text', 'Service Faktura'),
    st('PD/PCK', 'Oppdatert[#00c875]; Venter[#df2f4a]'),
    col('date', 'Ønsket mont.'),
    col('creation_log', 'Creation Log'),
    col('numbers', 'Total Kaffe ut'), col('numbers', 'Total Vann ut'), col('numbers', 'Totalt Kaffe inn'), col('numbers', 'Totalt Vann inn'),
    col('numbers', 'vente på Fak', { unit: 'kr' }), col('numbers', 'Fakturert', { unit: 'kr' }),
  ];
  const conn = columns[1];
  columns.splice(2, 0, col('mirror', 'Addresse', { connectCol: conn.id, colTitle: 'Addresse' }));
  const groups = [grp('Kunde Navn', '#579bfc'), grp('Montert ferdig, venter på faktuering', '#fdab3d'), grp('Ferdig montert og Faktuert', '#00c875'), ...monthGroups('FF', MONTHS2)];
  const ut = byTitle(columns, 'UTFØRT?'), mf = byTitle(columns, 'Msk Faktuert'), sv = byTitle(columns, 'Status varer'), ns = byTitle(columns, 'NS liste'), ko = byTitle(columns, 'Kontor');
  const automations = [
    { trigger: { type: 'item_created' }, action: { type: 'set_status', col: sv.id, to: lab(sv, 'Venter på varer order') } },
    { trigger: { type: 'item_created' }, action: { type: 'set_status', col: ns.id, to: lab(ns, 'Ikke oppdatert') } },
    { trigger: { type: 'status_change', col: ut.id, to: lab(ut, 'JA') }, action: { type: 'move_group', group: groups[1].id } },
    { trigger: { type: 'status_change', col: ut.id, to: lab(ut, 'JA') }, action: { type: 'set_status', col: mf.id, to: lab(mf, 'Klar til fakturering') } },
    { trigger: { type: 'status_change', col: mf.id, to: lab(mf, 'Fakturert') }, action: { type: 'move_group', group: groups[2].id } },
    { trigger: { type: 'status_change', col: mf.id, to: lab(mf, 'Ordren klar (PCK)') }, action: { type: 'notify', person: 'p_maria', text: 'Order ligger klart til fakturering' } },
    { trigger: { type: 'status_change', col: ko.id, to: lab(ko, 'STAVANGER') }, action: { type: 'notify', person: 'p_jonas', text: 'Montering Stavanger' } },
    { trigger: { type: 'subitem_created' }, action: { type: 'set_date', col: sub_columns[7].id } },
  ];
  return {
    columns, groups, sub_columns, items: [['Ny montering', 0]], automations,
    description: 'Monteringsplan: maskiner som subitems (lager, leveringsuke, serienr). UTFØRT? = JA → venter på faktura ⚡ (Demo: oppdiktede data.)',
    views: [{ type: 'calendar', name: 'Calendar', settings: { col: byTitle(columns, 'Planlagt Montering').id } }, { type: 'chart', name: 'Chart' }],
  };
}

module.exports = {
  kk_kunder: { name: 'Alle Kunder', icon: '👨‍👩‍👧‍👦', label: 'Alle Kunder (KK)', desc: 'Kundekartotek med avtale, adresse og kart', make: kunder },
  kk_feil: { name: 'Feilmeldinger/Oppdrag', icon: '🚨', label: 'Feilmeldinger/Oppdrag (KK)', desc: 'Feil, tekniker, status og faktura', make: feil, needs: ['kk_kunder'] },
  kk_montering: { name: 'Monteringsplan', icon: '🔨', label: 'Monteringsplan (KK)', desc: 'Monteringer med maskiner som subitems', make: montering, needs: ['kk_kunder'] },
};
