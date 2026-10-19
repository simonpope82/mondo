// Ledelse / admin boards – STRUCTURE copied from Simon's monday boards (names, groups, column titles/types, status labels + colours,
// subitems, automations). No real content: goals, meeting notes, staff, salaries, ID/bank numbers and cars are NOT copied.
const { col, grp, cid } = require('./templates');

// monday label colour index → hex (indexes come from the monday API)
const IDX = { 0: '#fdab3d', 1: '#00c875', 2: '#df2f4a', 3: '#007eb5', 4: '#9d50dd', 5: '#c4c4c4', 6: '#037f4c', 7: '#579bfc', 8: '#cab641', 9: '#ffcb00', 10: '#333333', 11: '#bb3354', 12: '#ff007f', 13: '#ff5ac4', 14: '#784bd1', 15: '#9cd326', 16: '#66ccff', 17: '#757575', 18: '#7f5347', 19: '#ff6d3b', 104: '#9aadbd', 105: '#68a1bd', 109: '#401694', 153: '#216edf', 156: '#74afcc', 159: '#bda8f9' };
const L = (spec) => spec.split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(.*)\[(#[0-9a-f]{6}|\d+)\]$/i); return { id: cid('l'), label: m[1].trim(), color: m[2].startsWith('#') ? m[2] : IDX[m[2]] || '#c4c4c4' }; });
const st = (title, spec) => col('status', title, { labels: [...L(spec), { id: cid('l'), label: '', color: '#c4c4c4' }] });
const dd = (title, list) => col('dropdown', title, { options: list.map((label) => ({ id: cid('o'), label })) });
const byTitle = (cols, t, n = 0) => cols.filter((c) => c.title === t)[n];
const lab = (c, name) => c.settings.labels.find((l) => l.label === name)?.id;
const file = (title) => col('link', title); // mondo has no file upload yet – a link (e.g. SharePoint/OneDrive) instead

// ---------- Styrets handlingsplan Kaffeknappen 2025 ----------
function styret() {
  const columns = [
    st('Status', 'Working on it[0]; Done[1]; Stuck[2]; Ikke startet[5]'),
    st('Kategori', 'kunder[0]; ledelse[1]; avtaler[2]; kunnskap[3]; produkter[4]; FInans Økonomi[5]; marked[6]; strategi[7]'),
    st('Prioritet', 'Høy[2]; Middels[0]; Lav[16]'),
    col('people', 'People'),
    col('date', 'Tidsfrist'),
    col('long_text', 'Tiltak 2021'),
  ];
  const groups = [grp('Group Title', '#579bfc'), grp('Done', '#00c875')];
  const s = columns[0];
  return { columns, groups, items: [['Nytt tiltak', 0]],
    automations: [{ trigger: { type: 'status_change', col: s.id, to: lab(s, 'Done') }, action: { type: 'move_group', group: groups[1].id } }],
    views: [{ type: 'kanban', name: 'Kanban', settings: { col: columns[1].id } }, { type: 'chart', name: 'Chart' }],
    description: 'Styrets handlingsplan: tiltak per kategori, prioritet og tidsfrist. Done → flyttes til Done ⚡ (Demo: plassholdertekst.)' };
}

// ---------- 4-banden ledelsesmøte ----------
function fireBanden() {
  const columns = [col('people', 'Person'), st('Status', 'Working on it[0]; Done[1]; Stuck[2]; Satt på vent[3]'), col('date', 'Date'), file('Files')];
  const groups = [grp('Group Title', '#579bfc'), grp('Group Title', '#00c875')];
  const s = columns[1];
  return { columns, groups, items: [['Nytt punkt', 0]],
    automations: [{ trigger: { type: 'status_change', col: s.id, to: lab(s, 'Done') }, action: { type: 'move_group', group: groups[1].id } }],
    description: 'Ledelsesmøte: saker, ansvarlig, status og dato. Done → flyttes til gruppe 2 ⚡ (Demo: plassholdertekst.)' };
}

// ---------- Strategi 2030 ----------
function strategi() {
  const columns = [
    st('Avdeling', 'Konsept[159]; Salg[3]; Produkt[5]; Service[105]; lager & logistikk[156]'),
    col('people', 'Person'),
    st('Status', 'Fordelt[0]; Done[1]; Ikke påbegynt[2]; Planlagt[3]'),
    st('Label', '2029[0]; 2030[104]; 2027[3]; 2026[1]; 2028[156]'),
  ];
  const sub_columns = [col('people', 'Owner'), st('Status', 'Working on it[0]; Done[1]; Stuck[2]; Not started[3]'), col('timeline', 'Timeline'), col('numbers', 'Progress tracking', { unit: '%' })];
  const groups = [grp('Hovedmål SERVICE 2030', '#68a1bd'), grp('Hovedmål SALG 2030', '#007eb5')];
  return { columns, groups, sub_columns, items: [['Nytt hovedmål', 0]],
    views: [{ type: 'kanban', name: 'Kanban', settings: { col: columns[3].id } }, { type: 'chart', name: 'Chart' }],
    description: 'Strategi 2030: hovedmål per avdeling og år, delmål som subitems med fremdrift. (Demo: plassholdertekst.)' };
}

// ---------- Handlingsplan 2026 Service ----------
function handlingsplan() {
  const columns = [
    st('Avdeling', 'Hoved[159]; Salg[3]; Produkt[5]; Service[105]; Lager/logistics[156]'),
    st('Priority', 'Working on it[0]; Done[1]; Stuck[2]'),
    st('Status', 'Working on it[0]; Done[1]; Stuck[2]'),
    col('people', 'Person'), col('date', 'Date'), file('File'), col('timeline', 'Timeline'),
    st('Status', 'Working on it[0]; Done[1]; Stuck[2]'), col('date', 'Date'),
  ];
  // the real group names are the actual 2026 goals – replaced by placeholders
  const groups = [grp('Mål 1 (plassholder)', '#df2f4a'), grp('Mål 2 (plassholder)', '#fdab3d'), grp('Mål 3 (plassholder)', '#579bfc')];
  return { columns, groups, items: [['Nytt tiltak', 0]],
    views: [{ type: 'timeline', name: 'Timeline', settings: { col: columns[6].id } }, { type: 'chart', name: 'Chart' }],
    description: 'Handlingsplan Service: ett mål per gruppe, tiltak med ansvarlig, tidslinje og status. (Demo: plassholdertekst.)' };
}

// ---------- Employee boards (columns only; never real HR data) ----------
function employee(kind) {
  const kk = kind === 'kk';
  const columns = [
    col('creation_log', 'Submission Date'),
    col('numbers', 'Start lønn', { unit: 'kr', hideFooter: true }), col('numbers', 'Lønn Nå', { unit: 'kr', hideFooter: true }),
    col('date', 'Gikk opp sist'), col('date', 'Start Date'),
    col('phone', kk ? 'Employee phone number' : 'Telephone nr'),
    col('numbers', 'Stillingsprosent', { unit: '%', hideFooter: true }),
    col('date', 'Slutt Dato'),
    file('Oppsigelse'), file('Contract'), file('CV'),
    kk ? file('Advarsel') : null,
    kk ? st('Stilling', 'Service Spesialist[#fdab3d]; Teknisksjef[#df2f4a]; Team leader[#007eb5]; Teknikker[#9d50dd]; Service Teamleader[#037f4c]; COO[#579bfc]; Teknikker leder[#cab641]')
      : st('Stilling', 'Service Spesialist[#fdab3d]; Teknisk[#00c875]; Teknisksjef[#df2f4a]; Team leader[#007eb5]; Delivery / Service[#401694]; Barista[#ff5ac4]'),
    kk ? null : file('Advarsel'),
    kk ? col('email', 'Email') : col('numbers', 'Person nr', { hideFooter: true }),
    kk ? col('location', 'Adresse') : col('location', 'Adresse'),
    kk ? col('numbers', 'Bank nr', { hideFooter: true }) : col('email', 'Email'),
    kk ? col('numbers', 'Person nr', { hideFooter: true }) : col('numbers', 'kontonr', { hideFooter: true }),
    kk ? st('Work Status', 'Sagt opp[#fdab3d]; aktiv[#00c875]; Sluttet[#df2f4a]; Prøve[#007eb5]; Kommer snart[#9d50dd]; Sykmeldt[#ff5ac4]')
      : st('Work status', 'Sagt opp[#fdab3d]; Aktiv[#00c875]; Sluttet[#df2f4a]; Prøve[#007eb5]; Kommer snart[#9d50dd]; Langtids sykemeldt[#faa1f1]'),
    kk ? st('Kontrakt type', 'Deltid[#ff6d3b]; FAST 100%[#00c875]; Timer[#5559df]; VIKAR[#ff007f]')
      : st('Kontrakt Type', 'DELTID[#fdab3d]; FAST 100%[#00c875]; TIMER[#5559df]; VIKAR[#ff007f]; 50%[#9d50dd]'),
    kk ? st('Location', 'STAVANGER[#fdab3d]; OSLO[#00c875]; BERGEN[#df2f4a]; TRONDHEIM[#007eb5]') : null,
    kk ? file('Medarbeidesamtale') : null,
    kk ? col('text', 'Ingangskort/pin.') : null,
  ].filter(Boolean);
  const groups = kk ? [grp('Service', '#579bfc'), grp('Sluttet', '#c4c4c4')] : [grp('mk folk', '#579bfc'), grp('Ferdig', '#c4c4c4')];
  const ws = columns.find((c) => /^Work status$/i.test(c.title));
  const stilling = byTitle(columns, 'Stilling');
  return { columns, groups, items: [['Ny ansatt', 0]],
    automations: [{ trigger: { type: 'status_change', col: ws.id, to: lab(ws, 'Sluttet') }, action: { type: 'move_group', group: groups[1].id } }],
    views: [{ type: 'chart', name: 'Chart', settings: { col: stilling.id } }],
    form: { title: 'Ny ansatt', desc: 'Registrer en ny ansatt', public: false, fields: [stilling.id, byTitle(columns, 'Start Date').id] },
    description: 'Ansattoversikt. ⚠️ Bare oppdiktede demo-personer – ikke legg inn ekte lønn, personnummer eller kontonummer på testsiden.' };
}

// ---------- Car boards ----------
function biler(kind) {
  const kk = kind === 'kk';
  const columns = kk ? [
    col('people', 'Driver'),
    st('Status', 'LEDIG[0]; Aktiv[1]; SKAL SELGES[2]; MÅ BYTTES UT[3]; RESERVERT[4]; Levert tilbake[18]; SOLGT[7]'), // a staff first name label → generic "RESERVERT"
    col('date', 'EU Kontrol'), col('checkbox', 'Checkbox 2'),
    st('DEKK HOS', 'KK LAGER[0]; VIANOR FURUSET[1]; MISSING[2]; VIANOR BRYN[3]; Vianor Trondheim Leangen[4]; Vianor Stavanger Forus[13]'),
    col('date', 'Dekkskift Date'), col('checkbox', 'Checkbox'),
    col('date', 'SIST LEST KM'), col('numbers', 'KM STAND', { unit: 'km' }), col('date', 'Service Dato'), col('checkbox', 'Checkbox 1'),
    st('DRIVSTOFF', 'BENSIN[7]; EL[1]; DIESEL[2]'),
    dd('BIL MODEL', ['VW CADDY MAXI', 'MB VI', 'VW BUZZ', 'VW TRANSPORTER', 'TOYOTA PROACE CITY', 'TOYOTA CITY', 'T', 'TOYOTA PROACE']),
    col('creation_log', 'Creation log'),
    st('AVDELING', 'STAVANGER[19]; OSLO[153]; BERGEN[9]; TRONDHEIM[12]'),
    col('numbers', 'Ordernr', { hideFooter: true }),
    st('Leasing/eier', 'Toyota[0]; Ayvens[1]; KK[2]'),
    st('Drift', 'Toyota[0]; Ayvens[1]; KK[2]'),
    col('text', 'Text'),
  ] : [
    col('people', 'Driver'),
    st('Status', 'Needs service[#fdab3d]; Aktiv[#00c875]; Problems[#df2f4a]; MÅ BYTTES UT[#007eb5]'),
    st('DRIVSTOFF', 'BENSIN[#579bfc]; EL[#00c875]; DIESEL[#df2f4a]'),
    dd('BIL MODEL', ['VW CADDY MAXI', 'MB VITO', 'VW BUZZ', 'VW TRANSPORTER', 'TOYOTA PROACE CITY']),
    col('creation_log', 'Creation log'),
    col('numbers', 'KM STAND', { unit: 'km' }),
    col('timeline', 'SIST LEST KM'),
    st('DEKK HOS', 'KK LAGER[#fdab3d]; VIANOR[#00c875]; MISSING[#df2f4a]'),
    st('AVDELING', 'STAVANGER[#ff6d3b]; OSLO[#216edf]; BERGEN[#ffcb00]'),
    st('Eiier', 'Kaffeknappen[#bb3354]; Ayvens[#00c875]; Magnat[#5559df]'),
    st('Drift', 'Ayvens[#00c875]; Magnat[#784bd1]'),
  ];
  const groups = kk ? [grp('Kaffeknappen service', '#579bfc'), grp('Gamle biler', '#c4c4c4')] : [grp('MAGNAT BILER', '#5559df')];
  const automations = kk ? [
    { trigger: { type: 'date_arrives', col: byTitle(columns, 'Dekkskift Date').id, offset: 0 }, action: { type: 'notify', person: '__owner', text: 'Dekkskift i dag' } },
    { trigger: { type: 'date_arrives', col: byTitle(columns, 'EU Kontrol').id, offset: 0 }, action: { type: 'notify', person: '__owner', text: 'EU-kontroll i dag' } },
    { trigger: { type: 'date_arrives', col: byTitle(columns, 'Service Dato').id, offset: 0 }, action: { type: 'notify', person: '__owner', text: 'Service på bilen i dag' } },
    { trigger: { type: 'column_change', col: byTitle(columns, 'KM STAND').id }, action: { type: 'set_date', col: byTitle(columns, 'SIST LEST KM').id } },
  ] : [];
  const sub_columns = kk ? [col('people', 'Owner'), st('Status', 'Working on it[0]; Done[1]; Stuck[2]'), col('date', 'Date')] : undefined;
  return { columns, groups, sub_columns, items: [['Ny bil', 0]], automations,
    views: [{ type: 'calendar', name: 'Calendar', settings: { col: (byTitle(columns, kk ? 'EU Kontrol' : 'KM STAND') || {}).id } }],
    description: kk ? 'Bilpark: sjåfør, EU-kontroll, dekk, km og service. Varsler sjåføren når datoen kommer ⚡ (Demo: oppdiktede biler, ingen skiltnr.)' : 'Bilpark Magnat. (Demo: oppdiktede biler, ingen skiltnr.)' };
}

module.exports = {
  styret_kk: { name: 'Styrets handlingsplan Kaffeknappen 2025', icon: '🏛️', label: 'Styrets handlingsplan', desc: 'Tiltak, kategori, prioritet, frist', make: styret },
  ledermote: { name: '4-banden ledelsesmøte', icon: '🤝', label: 'Ledelsesmøte', desc: 'Saker, ansvarlig, status', make: fireBanden },
  strategi: { name: 'Strategi 2030', icon: '🎯', label: 'Strategi', desc: 'Hovedmål med delmål og fremdrift', make: strategi },
  handlingsplan: { name: 'Handlingsplan 2026 Service', icon: '🗺️', label: 'Handlingsplan', desc: 'Mål som grupper, tiltak på tidslinje', make: handlingsplan },
  employee_kk: { name: 'Employee Kaffeknappen', icon: '👥', label: 'Ansatte (KK)', desc: 'Ansattoversikt – kun kolonner', make: () => employee('kk') },
  employee_mk: { name: 'Employee Magnat', icon: '👥', label: 'Ansatte (Magnat)', desc: 'Ansattoversikt – kun kolonner', make: () => employee('mk') },
  biler_kk: { name: 'KK biler', icon: '🚐', label: 'Biler (KK)', desc: 'Bilpark med EU-kontroll og dekk', make: () => biler('kk') },
  biler_mk: { name: 'MK biler', icon: '🚐', label: 'Biler (Magnat)', desc: 'Bilpark Magnat', make: () => biler('mk') },
};
