// 🛞 Dekkhotell demo workspace – ALL data is made up (fake names, fake plates "DM xxxxx", 400 00 xxx numbers).
module.exports = function seedDekk(db, { createBoard, insertItem, getBoard, now, DEKK, ASSETS }) {
  if (db.prepare("select 1 from meta where key='seed_dekk'").get()) return;
  db.prepare("insert into meta values('seed_dekk', ?)").run(now());
  const ws = 'w_dekk';
  db.prepare('insert or ignore into workspaces values(?,?,?,?,?)').run(ws, 'Dekkhotell', '#0086c0', 5, now());
  const mk = (t) => { const id = createBoard({ workspace_id: ws, template: t }).id; db.prepare('delete from items where board_id=?').run(id); return id; };
  const ids = { kunder: mk('dk_kunder'), kjoretoy: mk('dk_kjoretoy'), bookinger: mk('dk_bookinger'), lager: mk('dk_lager'), faktura: mk('dk_faktura') };
  // two-way link Kunder → Kjøretøy (Kunder was created before Kjøretøy existed)
  const kb = getBoard(ids.kunder); const cols = kb.columns.map((c) => (c.type === 'connect' && c.settings.boardRef === 'dk_kjoretoy' ? { ...c, settings: { ...c.settings, boardId: ids.kjoretoy } } : c));
  db.prepare('update boards set columns=? where id=?').run(JSON.stringify(cols), ids.kunder);
  const s = DEKK.defaultSettings(); s.boards = ids;
  for (const [k, id] of Object.entries(ids)) s.map[k] = Object.fromEntries(getBoard(id).columns.filter((c) => c.type !== 'mirror').map((c) => [c.title, c.id]));
  DEKK.saveSettings(s);

  const H = (key) => { const b = getBoard(ids[key]); const C = (t) => b.columns.find((c) => c.title === t && c.type !== 'mirror').id; const S = (t, l) => { const c = b.columns.find((x) => x.title === t); const id = c.settings.labels.find((x) => x.label === l)?.id; if (!id) throw new Error(`${t}: ${l}`); return id; }; const G = (n) => b.groups.find((g) => g.name === n).id; return { b, C, S, G }; };
  const day = (n) => { const d = new Date(Date.now() + n * 86400000); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(d); };

  // 👤 Kunder
  let { C, S, G } = H('kunder');
  const people = [
    ['Kari Demo', 'Privat', 'Aktiv', 'Demoveien 1, 0150 Oslo', 59.912, 10.75, 'kari.demo@example.com', true],
    ['Ola Eksempel', 'Privat', 'Aktiv', 'Testgata 5, 0558 Oslo', 59.925, 10.76, 'ola.eksempel@example.com', true],
    ['Lise Prøve', 'Privat', 'Aktiv', 'Prøvestien 2, 1361 Østerås', 59.94, 10.6, '', true],
    ['Per Fiktiv', 'Privat', 'Ny', 'Fiktivveien 9, 0870 Oslo', 59.95, 10.74, 'per.fiktiv@example.com', false],
    ['Nina Test', 'Privat', 'Aktiv', 'Eksempelgata 14, 0457 Oslo', 59.935, 10.75, 'nina.test@example.com', true],
    ['Demo Rørlegger AS', 'Bedrift', 'Aktiv', 'Industriveien 3, 1473 Lørenskog', 59.93, 10.95, 'faktura@demo-ror.example.com', false],
    ['Testflåten AS', 'Flåte/leasing', 'Aktiv', 'Flåteveien 20, 0668 Oslo', 59.91, 10.83, 'flate@testflaten.example.com', false],
    ['Jonas Prøvesen', 'Privat', 'Inaktiv', 'Gammelveien 4, 0680 Oslo', 59.9, 10.8, '', false],
  ];
  const kunder = people.map(([n, t, st, adr, lat, lng, em, sms], k) => insertItem(ids.kunder, G(t === 'Privat' ? (st === 'Inaktiv' ? 'Inaktive' : 'Privatkunder') : 'Bedriftskunder'), n, null, {
    [C('Mobil')]: `+47 400 00 ${String(101 + k)}`, ...(em ? { [C('E-post')]: em } : {}), [C('Adresse')]: { address: adr, lat, lng }, [C('Kundetype')]: S('Kundetype', t), [C('Kundestatus')]: S('Kundestatus', st),
    [C('SMS-samtykke')]: sms, [C('Markedsføring OK')]: k % 3 === 0, [C('Kundenr')]: 'K-' + (20001 + k), ...(t !== 'Privat' ? { [C('Org.nr')]: '[999 000 00' + k + ' – demo]' } : {}), [C('Sist besøk')]: day(-30 - k * 20),
    ...(k === 5 ? { [C('Notat')]: 'Faktura 30 dager. 3 varebiler.' } : {}) }, k + 1));

  // 🚗 Kjøretøy
  ({ C, S, G } = H('kjoretoy'));
  const cars = [[0, 'DM 10001', 'Toyota', 'Yaris', 2019, '185/65R15', '185/65R15', 'Personbil', 'Ja', 'Ingen'], [1, 'DM 10002', 'Volkswagen', 'ID.4', 2022, '235/50R20', '235/55R19', 'Elbil', 'Ja', 'I bilen'],
    [2, 'DM 10003', 'Volvo', 'XC60', 2020, '235/55R19', '235/60R18', 'SUV / 18"+', 'Ja', 'På dekkhotellet'], [3, 'DM 10004', 'Skoda', 'Octavia', 2017, '205/55R16', '205/55R16', 'Personbil', 'Nei', 'Ingen'],
    [4, 'DM 10005', 'Tesla', 'Model Y', 2023, '255/45R19', '255/45R19', 'Elbil', 'Ja', 'Ingen'], [5, 'DM 20001', 'Ford', 'Transit Custom', 2021, '215/65R16C', '215/65R16C', 'Varebil', 'Nei', 'Ingen'],
    [5, 'DM 20002', 'Ford', 'Transit Custom', 2021, '215/65R16C', '215/65R16C', 'Varebil', 'Nei', 'Ingen'], [6, 'DM 30001', 'Hyundai', 'Kona', 2022, '215/55R17', '215/60R16', 'Elbil', 'Ja', 'I bilen'],
    [0, 'DM 10006', 'Mazda', 'CX-5', 2018, '225/55R19', '225/65R17', 'SUV / 18"+', 'Ja', 'Ingen']];
  const biler = cars.map(([o, reg, m, mo, y, ds, dv, bt, tp, lb], k) => insertItem(ids.kjoretoy, G('Kjøretøy'), reg, null, { [C('Regnr')]: reg, [C('Eier')]: [kunder[o]], [C('Merke')]: m, [C('Modell')]: mo, [C('Årsmodell')]: y, [C('Dekkdimensjon sommer')]: ds, [C('Dekkdimensjon vinter')]: dv, [C('Biltype')]: S('Biltype', bt), [C('TPMS')]: S('TPMS', tp), [C('Låsebolt')]: S('Låsebolt', lb), [C('Neste EU-kontroll')]: day(20 + k * 47) }, k + 1));
  // link vehicles on customer cards
  const kc = getBoard(ids.kunder).columns.find((c) => c.title === 'Kjøretøy').id;
  kunder.forEach((kid, k) => { const mine = cars.map((c, j) => (c[0] === k ? biler[j] : null)).filter(Boolean); const r = db.prepare('select vals from items where id=?').get(kid); db.prepare('update items set vals=? where id=?').run(JSON.stringify({ ...JSON.parse(r.vals), [kc]: mine }), kid); });

  // 🛞 Dekkhotell lager (+ QR wheel-set tags from the Assets module)
  ({ C, S, G } = H('lager'));
  const sets = [[0, 0, 'A', 1, 3, 'Vinter piggfri', 'På lager', '185/65R15', 'Demo Nordic', '3922', [7.1, 7.0, 6.8, 6.9], 'God', 'Stålfelg'],
    [1, 1, 'A', 2, 1, 'Vinter piggfri', 'På lager', '235/55R19', 'Demo Arctic EV', '4123', [6.2, 6.0, 5.1, 5.3], 'OK', 'Alufelg'],
    [2, 2, 'B', 1, 4, 'Vinter pigg', 'På lager', '235/60R18', 'Demo Stud', '3820', [4.2, 4.0, 3.6, 3.4], 'Må byttes', 'Alufelg'],
    [3, 3, 'B', 3, 2, 'Vinter piggfri', 'På lager', '205/55R16', 'Demo Nordic', '4021', [5.0, 4.8, 4.6, 4.7], 'Bør byttes snart', 'Stålfelg'],
    [4, 4, 'C', 1, 1, 'Vinter piggfri', 'På bilen nå', '255/45R19', 'Demo Arctic EV', '4424', [8.5, 8.4, 8.6, 8.5], 'God', 'Alufelg'],
    [0, 0, 'A', 1, 4, 'Sommer', 'På bilen nå', '185/65R15', 'Demo Sport', '2122', [5.5, 5.4, 5.8, 5.9], 'OK', 'Uten felg'],
    [5, 5, 'D', 2, 1, 'Helår', 'På lager', '215/65R16C', 'Demo Van AllSeason', '1023', [6.5, 6.4, 6.0, 6.1], 'God', 'Stålfelg'],
    [6, 7, 'C', 2, 2, 'Vinter piggfri', 'På lager', '215/60R16', 'Demo Nordic', '3523', [6.9, 7.0, 6.6, 6.5], 'God', 'Stålfelg'],
    [7, null, 'Container', 1, 1, 'Sommer', 'Skal kastes', '195/65R15', 'Demo Eco', '1216', [2.1, 2.4, 1.9, 2.0], 'Må byttes', 'Uten felg']];
  sets.forEach(([cu, car, sek, hy, pl, ses, ls, dim, brand, dot, d4, tl, felg], k) => {
    const a = ASSETS.createAsset({ data: { asset_type: 'Hjulsett', model: `${brand} ${dim}`, group: 'Dekkhotell', status: ls === 'På lager' ? 'På lager' : 'I drift', home_location: `Dekkhotell ${sek}-${hy}-${pl}`, description: `${ses} – demo hjulsett` } }, { who: 'p_simon', whoName: 'Simon Pope', text: 'Hjulsett registrert (demo)' });
    const grp = ls === 'Skal kastes' ? 'Utlevert / avsluttet' : ses === 'Sommer' ? 'Sommersett på lager' : 'Vintersett på lager';
    insertItem(ids.lager, G(grp), `${people[cu][0]} – ${ses}${car != null ? ' – ' + cars[car][1] : ''}`, null, {
      [C('Kunde')]: [kunder[cu]], ...(car != null ? { [C('Kjøretøy')]: [biler[car]] } : {}), [C('Hjulsett-ID')]: a.code, [C('Lagerplass')]: `${sek}-${hy}-${pl}`, [C('Seksjon')]: S('Seksjon', sek), [C('Sesong')]: S('Sesong', ses), [C('Lagerstatus')]: S('Lagerstatus', ls),
      [C('Dimensjon')]: dim, [C('Dekkmerke')]: brand, [C('DOT / år')]: dot, [C('Mønster VF (mm)')]: d4[0], [C('Mønster HF (mm)')]: d4[1], [C('Mønster VB (mm)')]: d4[2], [C('Mønster HB (mm)')]: d4[3],
      [C('Tilstand')]: S('Tilstand', tl), [C('Felg')]: S('Felg', felg), [C('Bolter med')]: felg !== 'Uten felg', [C('TPMS-sensorer')]: felg === 'Alufelg', [C('Lagerleie')]: 990, [C('Lagerleie betalt')]: S('Lagerleie betalt', k % 4 === 1 ? 'Ikke betalt' : k === 6 ? 'Inkludert i avtale' : 'Betalt'),
      [C('Innlevert')]: day(-170 - k), [C('Neste sesongbytte')]: ses === 'Sommer' ? day(170) : day(5 + k * 3), ...(tl === 'Må byttes' ? { [C('Notat')]: 'Under 4 mm (vinter) – tilby nye dekk.' } : {}) }, k + 1);
  });

  // 📅 Bookinger
  ({ C, S, G } = H('bookinger'));
  const svc = Object.fromEntries(s.services.map((x) => [x.name, x]));
  const bk = [[0, 0, -2, '08:00', 'Hjulskift + dekkhotell', 'Ferdig', 'Løft 1', 'p_erik', 'Nettbooking'], [1, 1, -2, '09:00', 'Hjulskift', 'Ferdig', 'Løft 2', 'p_jonas', 'Telefon'],
    [5, 5, -1, '10:00', 'Hjulskift', 'Ferdig', 'Løft 1', 'p_erik', 'Innkalling'], [3, 3, -1, '13:00', 'Hjulskift', 'Ikke møtt', 'Løft 2', null, 'Nettbooking'],
    [2, 2, 0, '08:30', 'Nye dekk montering', 'Møtt', 'Løft 1', 'p_erik', 'Telefon'], [4, 4, 0, '10:00', 'Hjulskift + dekkhotell', 'Bekreftet', 'Løft 2', 'p_jonas', 'Nettbooking'],
    [6, 7, 0, '12:00', 'Balansering', 'Bekreftet', 'Løft 3', null, 'Drop-in'], [0, 8, 1, '09:00', 'Hjulskift', 'Bestilt', 'Løft 1', null, 'Nettbooking'],
    [5, 6, 1, '09:00', 'Hjulskift', 'Bekreftet', 'Løft 2', 'p_erik', 'Innkalling'], [3, 3, 2, '14:30', 'Hjulskift + dekkhotell', 'Bestilt', 'Løft 1', null, 'Nettbooking'],
    [1, 1, 3, '11:00', 'Punktering', 'Bestilt', 'Løft 3', null, 'Telefon']];
  const done = [];
  bk.forEach(([cu, car, d, t, sv, st, lift, mek, src], k) => {
    const g = st === 'Ferdig' ? 'Ferdig' : st === 'Ikke møtt' ? 'Ikke møtt / avlyst' : st === 'Bestilt' ? 'Nye bookinger' : 'Bekreftet';
    const p = people[cu];
    const id = insertItem(ids.bookinger, G(g), `${p[0]} – ${cars[car][1]}`, null, { [C('Dato')]: day(d), [C('Tid')]: t, [C('Status')]: S('Status', st), [C('Tjeneste')]: S('Tjeneste', sv), [C('Regnr')]: cars[car][1],
      [C('Kunde')]: [kunder[cu]], [C('Kjøretøy')]: [biler[car]], [C('Mobil')]: `+47 400 00 ${101 + cu}`, ...(p[6] ? { [C('E-post')]: p[6] } : {}), [C('Løft')]: S('Løft', lift), ...(mek ? { [C('Mekaniker')]: [mek] } : {}),
      [C('Varighet (min)')]: svc[sv].minutes, [C('Pris')]: svc[sv].price, [C('Betaling')]: S('Betaling', st === 'Ferdig' ? 'Ikke betalt' : 'Ikke betalt'), [C('Kilde')]: S('Kilde', src), [C('Bookingref')]: 'BDEMO' + (k + 1) }, k + 1);
    if (st === 'Ferdig') done.push(id);
  });
  // 🧾 invoices for the finished jobs (same code path as the automation)
  const bb = getBoard(ids.bookinger);
  const inv = done.map((id) => DEKK.createInvoice(bb, (({ vals, ...r }) => ({ ...r, vals: JSON.parse(vals) }))(db.prepare('select * from items where id=?').get(id))));
  // first one paid by Vipps (demo), others open; one marked "Sendt"
  const fb = getBoard(ids.faktura); const fc = (t) => fb.columns.find((c) => c.title === t);
  const lbl = (t, l) => fc(t).settings.labels.find((x) => x.label === l).id;
  const setV = (id, patch) => { const r = db.prepare('select vals from items where id=?').get(id); db.prepare('update items set vals=? where id=?').run(JSON.stringify({ ...JSON.parse(r.vals), ...patch }), id); };
  if (inv[0]) { setV(inv[0], { [fc('Status').id]: lbl('Status', 'Betalt'), [fc('Betalingsmåte').id]: lbl('Betalingsmåte', 'Vipps') }); db.prepare('update items set group_id=? where id=?').run(fb.groups[1].id, inv[0]); setV(done[0], { [bb.columns.find((c) => c.title === 'Betaling').id]: bb.columns.find((c) => c.title === 'Betaling').settings.labels.find((x) => x.label === 'Betalt Vipps').id }); }
  if (inv[2]) setV(inv[2], { [fc('Status').id]: lbl('Status', 'Sendt') });
  db.prepare("delete from notifications where text like '🧾 Faktura%'").run();
};
