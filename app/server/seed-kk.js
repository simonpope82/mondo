// Kaffeknappen workspace: the 3 most used monday boards (structure only) filled with MADE-UP example rows.
// Runs once per database (flag in the meta table), so it also appears on Render's free plan after every reset.
module.exports = function seedKK(db, { createBoard, insertItem, getBoard, now, cid, ME }) {
  db.exec('create table if not exists meta(key text primary key, value text)');
  if (db.prepare("select 1 from meta where key='seed_kk'").get()) return;
  db.prepare("insert into meta values('seed_kk', ?)").run(now());
  if (!db.prepare("select 1 from people where id='p_anna'").get()) return; // people come from the main demo seed

  const ws = 'w_kk';
  db.prepare('insert or ignore into workspaces values(?,?,?,?,?)').run(ws, 'Kaffeknappen', '#7f5347', 0, now());

  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const week = (n) => { const d = new Date(); d.setDate(d.getDate() + 7 * n); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y = t.getUTCFullYear(); return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`; };
  const helpers = (b) => {
    const C = (t, sub) => (sub ? b.sub_columns : b.columns).find((c) => c.title === t && c.type !== 'mirror');
    const S = (t, label, sub) => { const c = C(t, sub); const l = c.settings.labels.find((x) => x.label === label); if (!l) throw new Error(`label ${label} missing in ${t}`); return l.id; };
    const G = (name) => b.groups.find((g) => g.name === name).id;
    return { C, S, G };
  };
  const clear = (bid) => db.prepare('delete from items where board_id=?').run(bid);
  const up = (bid, iid, who, body, mins) => db.prepare('insert into updates(id,item_id,board_id,author,body,created) values(?,?,?,?,?,?)').run(cid('u'), iid, bid, who, body, new Date(Date.now() - mins * 60000).toISOString());

  // 👨‍👩‍👧‍👦 Alle Kunder
  const kid = createBoard({ workspace_id: ws, template: 'kk_kunder' }).id; clear(kid);
  let b = getBoard(kid); let { C, S, G } = helpers(b);
  const kunder = {};
  [
    ['Demo Kaffebar Sentrum', 'Kunde', 'FLYT', 'Torggata 10, Oslo', 59.9157, 10.7510, 'K-90001', 'Oslo', 'Anna Berg', 'Erik Lund', 'Kunde', 'Levering bakdør, ring før'],
    ['Fjordkontoret Demo AS', 'Kunde', 'FLYT VIP', 'Strandkaien 2, Bergen', 60.3946, 5.3248, 'K-90002', 'Bergen', 'Maria Holm', 'Jonas Dahl', 'Kunde', 'Resepsjon 2. etasje'],
    ['Nordlys Demo Hotell', 'Kunde', 'NS avtale-hver 4. uke', 'Olav Tryggvasons gate 20, Trondheim', 63.4337, 10.3984, 'K-90003', 'Trondheim', 'Anna Berg', 'Simon Pope', 'Kunde', 'Varemottak ved kjøkkenet'],
    ['Testbedrift Vest', 'Kunde', 'Kun service', 'Klubbgata 3, Stavanger', 58.9690, 5.7320, 'K-90004', 'Stavanger', 'Maria Holm', 'Erik Lund', 'Working on it', ''],
    ['Eksempel Skole Øst', 'PD Kunder', 'Årlig serviceavtale', 'Trondheimsveien 100, Oslo', 59.9260, 10.7770, 'K-90005', 'Oslo', 'Anna Berg', 'Jonas Dahl', 'Kunde', 'Kun hverdager 08–15'],
    ['Demo Treningssenter', 'PD Kunder', 'FLYT online', 'Lars Hilles gate 30, Bergen', 60.3890, 5.3270, 'K-90006', 'Bergen', 'Maria Holm', 'Simon Pope', 'Tapt kunde', ''],
  ].forEach(([n, g, av, adr, lat, lng, nr, avd, va, sa, ks, info], k) => {
    kunder[n] = insertItem(kid, G(g), n, null, {
      [C('Avtale').id]: S('Avtale', av), [C('Addresse').id]: { address: adr, lat, lng }, [C('Phone').id]: `+47 400 90 ${String(k + 1).padStart(3, '0')}`,
      [C('Kunde Nr').id]: nr, [C('Avdeling').id]: S('Avdeling', avd), [C('VA').id]: S('VA', va), [C('SA').id]: S('SA', sa),
      [C('Kunde status').id]: S('Kunde status', ks), ...(info ? { [C('Leverings info').id]: info } : {}),
    }, k + 1);
  });

  // 🚨 Feilmeldinger/Oppdrag
  const fid = createBoard({ workspace_id: ws, template: 'kk_feil' }).id; clear(fid);
  b = getBoard(fid); ({ C, S, G } = helpers(b));
  const tt = C('Time tracking').id;
  const feil = {};
  [
    ['Demo Kaffebar Sentrum', 'Kunde', ['p_erik'], 1, 'MELK', 'Planlagt', 'Eversys', 'VET IKKE', null],
    ['Fjordkontoret Demo AS', 'Kunde', ['p_jonas'], 0, 'KVÆRN', 'På vei/under arbeid', 'Jura', 'VET IKKE', { total: 0, since: new Date(Date.now() - 40 * 60000).toISOString() }],
    ['Nordlys Demo Hotell', 'Kunde', [], 3, 'LEKKASJE', 'Ikke fordelt', 'De Jong Duke', 'VET IKKE', null],
    ['Testbedrift Vest', 'Kunde', ['p_erik'], 5, 'FLYTTING', 'På vent', 'Animo', 'info kommer', { total: 1800, since: null }],
    ['Eksempel Skole Øst', 'Completed Feilmeldinger', ['p_jonas'], -2, 'PROGRAM/SOFTWARE', 'Fikset over tlf', 'WMF', 'NEI', { total: 900, since: null }],
    ['Demo Treningssenter', 'Completed Feilmeldinger', ['p_erik'], -6, 'BRYGGER', 'Ferdig', 'Eversys', 'Fakturert', { total: 5400, since: null }],
  ].forEach(([n, g, tech, off, fe, ps, m, fk, time], k) => {
    feil[n] = insertItem(fid, G(g), n, null, JSON.parse(JSON.stringify({
      [C('Serviceperson').id]: tech, [C('Kunde VIKTIG').id]: [kunder[n]], [C('Planlagt').id]: day(off), [C('FEIL').id]: S('FEIL', fe),
      [C('Process Status').id]: S('Process Status', ps), [C('LEV').id]: S('LEV', k % 2 ? 'Nei' : 'JA'), [C('Maskin som er feil').id]: S('Maskin som er feil', m),
      [C('Fakturere?').id]: S('Fakturere?', fk), [tt]: time || undefined,
    })), k + 1);
  });
  up(fid, feil['Fjordkontoret Demo AS'], 'p_anna', 'Kunden sier kvernen lager mye lyd og kaffen renner sakte. @Jonas Dahl kan du ta en titt i dag?', 90);
  up(fid, feil['Fjordkontoret Demo AS'], 'p_jonas', 'På vei nå 🚐 Tar med ny kvernskive.', 45);
  up(fid, feil['Demo Kaffebar Sentrum'], 'p_anna', 'Melkesystemet skummer ikke. Planlagt i morgen formiddag.', 200);
  up(fid, feil['Demo Treningssenter'], 'p_erik', 'Byttet brygger og testet. Alt ok ✅', 3000);

  // 🔨 Monteringsplan
  const mid = createBoard({ workspace_id: ws, template: 'kk_montering' }).id; clear(mid);
  b = getBoard(mid); ({ C, S, G } = helpers(b));
  const m = {};
  [
    ['Demo Kaffebar Sentrum – ny maskin', 'Kunde Navn', 'Demo Kaffebar Sentrum', 'Ny kunde', 'Ferdig', 6, 'OSLO', 'Venter', 'Venter på varer order', 'FLYT Basic', '.', 2, 1, 0, 0],
    ['Fjordkontoret Demo AS – utvidelse', 'Kunde Navn', 'Fjordkontoret Demo AS', 'Utvidelse', 'Planlagt', 12, 'BERGEN', 'Venter', 'Working on it', 'FLYT VIP', '.', 1, 1, 0, 0],
    ['Nordlys Demo Hotell – fornyelse', 'Montert ferdig, venter på faktuering', 'Nordlys Demo Hotell', 'Fornyelser', 'Trenger ikke', -3, 'TRONDHEIM', 'JA', 'Varer klart', 'FLYT + AQUA', 'Klar til fakturering', 1, 0, 1, 0],
    ['Testbedrift Vest – henting', 'Ferdig montert og Faktuert', 'Testbedrift Vest', 'Henting', 'Trenger ikke', -10, 'STAVANGER', 'JA', 'Skal ikke ha varer', 'Ingen avtale', 'Fakturert', 0, 0, 1, 1],
  ].forEach(([n, g, kunde, type, bef, off, kontor, utf, varer, sa, mf, kut, vut, kinn, vinn], k) => {
    m[n] = insertItem(mid, G(g), n, null, {
      [C('SA').id]: ['p_simon'], [C('Kunde').id]: [kunder[kunde]], [C('Type').id]: S('Type', type), [C('Befaring').id]: S('Befaring', bef),
      [C('Befaring dato').id]: day(off - 5), [C('Planlagt Montering').id]: day(off), [C('VA').id]: ['p_anna'], [C('Klargjørings dato').id]: day(off - 1),
      [C('Status varer').id]: S('Status varer', varer), [C('Service avtale').id]: S('Service avtale', sa), [C('UTFØRT?').id]: S('UTFØRT?', utf),
      [C('Tekkie').id]: [k % 2 ? 'p_jonas' : 'p_erik'], [C('Kontor').id]: S('Kontor', kontor), [C('NS liste').id]: S('NS liste', k > 1 ? 'Oppdatert' : 'Ikke oppdatert'),
      [C('Msk Faktuert').id]: S('Msk Faktuert', mf), [C('Ønsket mont.').id]: day(off),
      [C('Total Kaffe ut').id]: kut, [C('Total Vann ut').id]: vut, [C('Totalt Kaffe inn').id]: kinn, [C('Totalt Vann inn').id]: vinn,
      [C('vente på Fak').id]: mf === 'Klar til fakturering' ? 14900 : 0, [C('Fakturert').id]: mf === 'Fakturert' ? 2500 : 0,
      [C('Ordergrunnlag').id]: { url: 'https://example.com/ordre/demo-' + (k + 1), text: 'Ordre DEMO-' + (k + 1) },
    }, k + 1);
  });
  // machines as subitems: Klargjort, Antall, LAGER, På lager, Forventet levering (week), Serial Nr, Følgeseddel nr, Date
  const sub = (parent, name, klar, antall, lager, wk, serial, fs) => insertItem(mid, db.prepare('select group_id from items where id=?').get(m[parent]).group_id, name, m[parent], JSON.parse(JSON.stringify({
    [C('Klargjort', true).id]: S('Klargjort', klar, true), [C('Antall', true).id]: antall, [C('LAGER', true).id]: ['p_maria'],
    [C('På lager', true).id]: S('På lager', lager, true), [C('Forventet levering', true).id]: wk == null ? undefined : week(wk),
    [C('Serial Nr', true).id]: serial || undefined, [C('Følgeseddel nr', true).id]: fs || undefined, [C('Date', true).id]: day(-1),
  })));
  sub('Demo Kaffebar Sentrum – ny maskin', 'Eversys Cameo (demo)', 'JA', 1, 'JA', 0, 'DEMO-SN-0001', 'FS-1001');
  sub('Demo Kaffebar Sentrum – ny maskin', 'Vannfilter (demo)', 'Nei', 1, 'Bestilt', 1);
  sub('Fjordkontoret Demo AS – utvidelse', 'Jura GIGA (demo)', 'Nei', 1, 'Må Bestilles', 3);
  sub('Fjordkontoret Demo AS – utvidelse', 'Vannkjøler (demo)', 'Working on it', 1, 'Bestilt', 2);
  sub('Nordlys Demo Hotell – fornyelse', 'De Jong Duke (demo)', 'JA', 2, 'JA', -1, 'DEMO-SN-0003', 'FS-1003');
  sub('Testbedrift Vest – henting', 'Animo (demo)', 'JA', 1, 'Henting', -2, 'DEMO-SN-0004');
  up(mid, m['Demo Kaffebar Sentrum – ny maskin'], 'p_anna', 'Befaring ok. Strøm og vann er klart, avløp må legges. @Erik Lund ta med vannstopp.', 300);
  // most used board first, Kaffeknappen workspace first
  [[fid, 1], [mid, 2], [kid, 3]].forEach(([id, p]) => db.prepare('update boards set pos=? where id=?').run(p, id));
  db.prepare('update workspaces set pos=0 where id=?').run(ws);
};
