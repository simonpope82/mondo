// Ledelse, Kaffeknappen and Magnat admin boards with MADE-UP rows only (placeholder text, fake people, fake cars).
// Runs once per database (meta flag), so the boards also come back after a Render free-plan reset.
module.exports = function seedMore(db, { createBoard, insertItem, getBoard, now, cid }) {
  db.exec('create table if not exists meta(key text primary key, value text)');
  if (db.prepare("select 1 from meta where key='seed_more'").get()) return;
  db.prepare("insert into meta values('seed_more', ?)").run(now());
  if (!db.prepare("select 1 from people where id='p_anna'").get()) return;
  const W = (id, name, color, pos) => db.prepare('insert or ignore into workspaces values(?,?,?,?,?)').run(id, name, color, pos, now());
  W('w_kk', 'Kaffeknappen', '#7f5347', 0); W('w_ledelse', 'Ledelse', '#225091', 1); W('w_magnat', 'Magnat', '#5559df', 2);

  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const make = (ws, tpl) => { const id = createBoard({ workspace_id: ws, template: tpl }).id; db.prepare('delete from items where board_id=?').run(id); return getBoard(id); };
  const H = (b) => ({
    C: (t, n = 0, sub) => (sub ? b.sub_columns : b.columns).filter((c) => c.title === t)[n],
    S: (c, label) => { const l = c.settings.labels.find((x) => x.label === label); if (!l) throw new Error(`label ${label} missing in ${c.title}`); return l.id; },
    O: (c, label) => c.settings.options.find((o) => o.label === label).id,
  });
  const rows = (b, list) => list.map(([gi, name, vals, parent], k) => insertItem(b.id, b.groups[gi].id, name, parent || null, JSON.parse(JSON.stringify(vals)), k + 1));

  // 🏛️ Styrets handlingsplan Kaffeknappen 2025
  let b = make('w_ledelse', 'styret_kk'); let { C, S } = H(b);
  rows(b, [
    [0, 'Tiltak A (eksempel)', { [C('Status').id]: S(C('Status'), 'Working on it'), [C('Kategori').id]: S(C('Kategori'), 'kunder'), [C('Prioritet').id]: S(C('Prioritet'), 'Høy'), [C('People').id]: ['p_simon'], [C('Tidsfrist').id]: day(20), [C('Tiltak 2021').id]: 'Plassholdertekst – beskriv tiltaket her.' }],
    [0, 'Tiltak B (eksempel)', { [C('Status').id]: S(C('Status'), 'Ikke startet'), [C('Kategori').id]: S(C('Kategori'), 'marked'), [C('Prioritet').id]: S(C('Prioritet'), 'Middels'), [C('People').id]: ['p_anna'], [C('Tidsfrist').id]: day(45) }],
    [0, 'Tiltak C (eksempel)', { [C('Status').id]: S(C('Status'), 'Stuck'), [C('Kategori').id]: S(C('Kategori'), 'FInans Økonomi'), [C('Prioritet').id]: S(C('Prioritet'), 'Lav'), [C('People').id]: ['p_erik'], [C('Tidsfrist').id]: day(-3) }],
    [1, 'Tiltak D (eksempel)', { [C('Status').id]: S(C('Status'), 'Done'), [C('Kategori').id]: S(C('Kategori'), 'strategi'), [C('Prioritet').id]: S(C('Prioritet'), 'Høy'), [C('People').id]: ['p_simon'], [C('Tidsfrist').id]: day(-30) }],
  ]);

  // 🤝 4-banden ledelsesmøte
  b = make('w_ledelse', 'ledermote'); ({ C, S } = H(b));
  rows(b, [
    [0, 'Sak 1 (eksempel)', { [C('Person').id]: ['p_simon'], [C('Status').id]: S(C('Status'), 'Working on it'), [C('Date').id]: day(2) }],
    [0, 'Sak 2 (eksempel)', { [C('Person').id]: ['p_maria'], [C('Status').id]: S(C('Status'), 'Satt på vent'), [C('Date').id]: day(9) }],
    [0, 'Sak 3 (eksempel)', { [C('Person').id]: ['p_jonas'], [C('Status').id]: S(C('Status'), 'Stuck'), [C('Date').id]: day(-1) }],
    [1, 'Sak 4 (eksempel)', { [C('Person').id]: ['p_anna'], [C('Status').id]: S(C('Status'), 'Done'), [C('Date').id]: day(-7) }],
  ]);

  // 🎯 Strategi 2030 (delmål as subitems)
  b = make('w_ledelse', 'strategi'); ({ C, S } = H(b));
  const sc = (t) => C(t, 0, true);
  const [m1, m2, m3] = rows(b, [
    [0, 'Hovedmål 1 (plassholder)', { [C('Avdeling').id]: S(C('Avdeling'), 'Service'), [C('Person').id]: ['p_erik'], [C('Status').id]: S(C('Status'), 'Fordelt'), [C('Label').id]: S(C('Label'), '2027') }],
    [0, 'Hovedmål 2 (plassholder)', { [C('Avdeling').id]: S(C('Avdeling'), 'lager & logistikk'), [C('Person').id]: ['p_jonas'], [C('Status').id]: S(C('Status'), 'Planlagt'), [C('Label').id]: S(C('Label'), '2030') }],
    [1, 'Hovedmål 3 (plassholder)', { [C('Avdeling').id]: S(C('Avdeling'), 'Salg'), [C('Person').id]: ['p_maria'], [C('Status').id]: S(C('Status'), 'Ikke påbegynt'), [C('Label').id]: S(C('Label'), '2028') }],
  ]);
  const subStatus = sc('Status');
  [[m1, 'Delmål 1.1 (eksempel)', 'Done', 100, -60, -10], [m1, 'Delmål 1.2 (eksempel)', 'Working on it', 40, -5, 60], [m2, 'Delmål 2.1 (eksempel)', 'Not started', 0, 30, 120], [m3, 'Delmål 3.1 (eksempel)', 'Stuck', 15, -20, 40]]
    .forEach(([p, n, s, pr, f, t]) => insertItem(b.id, db.prepare('select group_id from items where id=?').get(p).group_id, n, p, { [sc('Owner').id]: ['p_simon'], [subStatus.id]: S(subStatus, s), [sc('Timeline').id]: { from: day(f), to: day(t) }, [sc('Progress tracking').id]: pr }));

  // 🗺️ Handlingsplan 2026 Service
  b = make('w_ledelse', 'handlingsplan'); ({ C, S } = H(b));
  rows(b, [
    [0, 'Tiltak 1.1 (eksempel)', { [C('Avdeling').id]: S(C('Avdeling'), 'Service'), [C('Priority').id]: S(C('Priority'), 'Stuck'), [C('Status').id]: S(C('Status'), 'Working on it'), [C('Person').id]: ['p_erik'], [C('Date').id]: day(14), [C('Timeline').id]: { from: day(-10), to: day(30) } }],
    [0, 'Tiltak 1.2 (eksempel)', { [C('Avdeling').id]: S(C('Avdeling'), 'Hoved'), [C('Priority').id]: S(C('Priority'), 'Working on it'), [C('Status').id]: S(C('Status'), 'Done'), [C('Person').id]: ['p_simon'], [C('Date').id]: day(-5), [C('Timeline').id]: { from: day(-40), to: day(-5) } }],
    [1, 'Tiltak 2.1 (eksempel)', { [C('Avdeling').id]: S(C('Avdeling'), 'Salg'), [C('Status').id]: S(C('Status'), 'Working on it'), [C('Person').id]: ['p_maria'], [C('Timeline').id]: { from: day(0), to: day(50) } }],
    [2, 'Tiltak 3.1 (eksempel)', { [C('Avdeling').id]: S(C('Avdeling'), 'Lager/logistics'), [C('Status').id]: S(C('Status'), 'Stuck'), [C('Person').id]: ['p_jonas'], [C('Timeline').id]: { from: day(7), to: day(70) } }],
  ]);

  // 👥 Employee boards – obviously fake people, no salary / ID / bank / address / phone values
  const emp = (ws, tpl, people) => {
    const e = make(ws, tpl); const h = H(e);
    const ws_ = e.columns.find((c) => /^Work status$/i.test(c.title)), kt = e.columns.find((c) => /^Kontrakt type$/i.test(c.title)), stl = h.C('Stilling'), loc = h.C('Location');
    rows(e, people.map(([gi, name, still, work, kont, pct, start, place]) => [gi, name, {
      [stl.id]: h.S(stl, still), [ws_.id]: h.S(ws_, work), [kt.id]: h.S(kt, kont), [h.C('Stillingsprosent').id]: pct, [h.C('Start Date').id]: day(start),
      [h.C('Email').id]: name.split(' ')[0].toLowerCase() + '.demo@example.com', ...(loc && place ? { [loc.id]: h.S(loc, place) } : {}),
    }]));
  };
  emp('w_kk', 'employee_kk', [
    [0, 'Ola Nordmann (demo)', 'Teknikker', 'aktiv', 'FAST 100%', 100, -400, 'OSLO'],
    [0, 'Kari Nordmann (demo)', 'Service Teamleader', 'aktiv', 'FAST 100%', 100, -900, 'BERGEN'],
    [0, 'Per Eksempel (demo)', 'Service Spesialist', 'Prøve', 'VIKAR', 60, -30, 'TRONDHEIM'],
    [1, 'Lise Testesen (demo)', 'Teknikker', 'Sluttet', 'Deltid', 50, -1200, 'STAVANGER'],
  ]);
  emp('w_magnat', 'employee_mk', [
    [0, 'Nils Demo (demo)', 'Barista', 'Aktiv', 'DELTID', 50, -200],
    [0, 'Anne Eksempel (demo)', 'Delivery / Service', 'Kommer snart', 'FAST 100%', 100, 14],
    [1, 'Tor Testmann (demo)', 'Teknisk', 'Sluttet', 'TIMER', 20, -800],
  ]);

  // 🚐 Car boards – made-up cars, no registration numbers
  b = make('w_kk', 'biler_kk'); let h = H(b);
  const car = (name, gi, drv, status, dekk, km, fuel, model, avd, eier, euOff) => [gi, name, {
    [h.C('Driver').id]: drv, [h.C('Status').id]: h.S(h.C('Status'), status), [h.C('EU Kontrol').id]: day(euOff), [h.C('DEKK HOS').id]: h.S(h.C('DEKK HOS'), dekk),
    [h.C('Dekkskift Date').id]: day(euOff + 20), [h.C('KM STAND').id]: km, [h.C('SIST LEST KM').id]: day(-3), [h.C('Service Dato').id]: day(euOff + 40),
    [h.C('DRIVSTOFF').id]: h.S(h.C('DRIVSTOFF'), fuel), [h.C('BIL MODEL').id]: [h.O(h.C('BIL MODEL'), model)], [h.C('AVDELING').id]: h.S(h.C('AVDELING'), avd),
    [h.C('Leasing/eier').id]: h.S(h.C('Leasing/eier'), eier), [h.C('Drift').id]: h.S(h.C('Drift'), eier),
  }];
  const cars = rows(b, [
    car('Servicebil 1 (demo)', 0, ['p_erik'], 'Aktiv', 'KK LAGER', 48200, 'EL', 'VW BUZZ', 'OSLO', 'Ayvens', 25),
    car('Servicebil 2 (demo)', 0, ['p_jonas'], 'Aktiv', 'VIANOR BRYN', 91350, 'DIESEL', 'VW TRANSPORTER', 'BERGEN', 'Toyota', 60),
    car('Servicebil 3 (demo)', 0, [], 'LEDIG', 'MISSING', 15800, 'BENSIN', 'TOYOTA PROACE CITY', 'TRONDHEIM', 'KK', 5),
    car('Gammel bil (demo)', 1, [], 'SOLGT', 'KK LAGER', 210400, 'DIESEL', 'VW CADDY MAXI', 'STAVANGER', 'KK', -200),
  ]);
  const ss = h.C('Status', 0, true);
  insertItem(b.id, b.groups[0].id, 'Bytte vindusviskere (eksempel)', cars[0], { [h.C('Owner', 0, true).id]: ['p_erik'], [ss.id]: h.S(ss, 'Done'), [h.C('Date', 0, true).id]: day(-2) });
  insertItem(b.id, b.groups[0].id, 'Dekkskift (eksempel)', cars[1], { [h.C('Owner', 0, true).id]: ['p_jonas'], [ss.id]: h.S(ss, 'Working on it'), [h.C('Date', 0, true).id]: day(6) });

  b = make('w_magnat', 'biler_mk'); h = H(b);
  rows(b, [
    [0, 'Varebil 1 (demo)', { [h.C('Driver').id]: ['p_maria'], [h.C('Status').id]: h.S(h.C('Status'), 'Aktiv'), [h.C('DRIVSTOFF').id]: h.S(h.C('DRIVSTOFF'), 'EL'), [h.C('BIL MODEL').id]: [h.O(h.C('BIL MODEL'), 'MB VITO')], [h.C('KM STAND').id]: 33100, [h.C('SIST LEST KM').id]: { from: day(-30), to: day(-2) }, [h.C('DEKK HOS').id]: h.S(h.C('DEKK HOS'), 'VIANOR'), [h.C('AVDELING').id]: h.S(h.C('AVDELING'), 'OSLO'), [h.C('Eiier').id]: h.S(h.C('Eiier'), 'Magnat'), [h.C('Drift').id]: h.S(h.C('Drift'), 'Magnat') }],
    [0, 'Varebil 2 (demo)', { [h.C('Driver').id]: ['p_anna'], [h.C('Status').id]: h.S(h.C('Status'), 'Needs service'), [h.C('DRIVSTOFF').id]: h.S(h.C('DRIVSTOFF'), 'DIESEL'), [h.C('BIL MODEL').id]: [h.O(h.C('BIL MODEL'), 'VW CADDY MAXI')], [h.C('KM STAND').id]: 120900, [h.C('DEKK HOS').id]: h.S(h.C('DEKK HOS'), 'KK LAGER'), [h.C('AVDELING').id]: h.S(h.C('AVDELING'), 'BERGEN'), [h.C('Eiier').id]: h.S(h.C('Eiier'), 'Ayvens'), [h.C('Drift').id]: h.S(h.C('Drift'), 'Ayvens') }],
  ]);
};
