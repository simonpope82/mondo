// Demo assets for the Assets module – all MADE-UP (no real customers, serials or GoCodes IDs). Runs once per database.
const { fmtCode, ALPH } = require('./assets');
module.exports = function seedAssets(db, ASSETS, { now }) {
  if (db.prepare("select 1 from meta where key='seed_assets'").get()) return;
  db.prepare("insert into meta values('seed_assets', ?)").run(now());
  // deterministic codes so demo stickers printed on the free plan still work after a reset
  let s = 20261019; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0); }; // mulberry32
  const code = () => fmtCode(Array.from({ length: 8 }, () => ALPH[rnd() % 32]).join(''));
  const iso = (daysAgo, h = 10) => { const d = new Date(Date.now() - daysAgo * 86400000); d.setUTCHours(h, 15, 0, 0); return d.toISOString(); };
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const P = { simon: ['p_simon', 'Simon Pope'], anna: ['p_anna', 'Anna Berg'], erik: ['p_erik', 'Erik Lund'], maria: ['p_maria', 'Maria Holm'], jonas: ['p_jonas', 'Jonas Dahl'] };
  const ins = db.prepare('insert into asset_events(asset_id,code,type,who,who_name,lat,lng,acc,text,data,created) values(?,?,?,?,?,?,?,?,?,?,?)');
  // [type, model, sub, group, status, home, place(lat,lng), customFields, assigned?, extra]
  const L = { oslo: [59.9139, 10.7522], grun: [59.9233, 10.7591], majo: [59.9296, 10.7140], bergen: [60.3929, 5.3241], trd: [63.4305, 10.3951], stv: [58.9700, 5.7331], lager: [59.9050, 10.8330], van: [59.9420, 10.8000] };
  const list = [
    ['Kaffemaskin', 'Demo Espresso 2G', '2-grupps', 'Kaffeknappen', 'Hos kunde', 'Kafé Demo Sentrum', 'oslo', { c_adresse: 'Demogata 1, 0150 Oslo', c_etg: '1', c_plassering: 'Bak disken', c_co2: 'Nei', c_aquastop: 'Ja', c_grut: 'Ja', c_fresk: 'Ja', c_avdeling: 'Kaffeknappen', c_filter: 'Demo Filter M', c_kontakt: 'Kari Demo, 400 00 000' }, null, { date_purchased: '2022-03-15', original_cost: 145000, salvage_value: 15000, asset_life: 7, last_filter_changed: day(-170), next_filter_change: day(10), last_service_notes: 'Byttet pakninger (demo).' }],
    ['Kaffemaskin', 'Demo Super-auto S', 'Automat', 'Kaffeknappen', 'Hos kunde', 'Kontor Demo AS', 'grun', { c_adresse: 'Eksempelveien 12, 0550 Oslo', c_etg: '4', c_plassering: 'Kantine', c_co2: 'Nei', c_aquastop: 'Nei', c_fresk: 'Ja', c_avdeling: 'Kaffeknappen', c_filter: 'Demo Filter S', c_kontakt: 'Ola Demo, 400 00 001' }, null, { date_purchased: '2023-09-01', original_cost: 89000, salvage_value: 8000, asset_life: 5, next_filter_change: day(-3), last_service_notes: 'Avkalket (demo).' }],
    ['Kaffemaskin', 'Demo Espresso 2G', '2-grupps', 'Kaffeknappen', 'Hos kunde', 'Hotell Demo Bergen', 'bergen', { c_adresse: 'Testbryggen 3, 5003 Bergen', c_etg: '1', c_plassering: 'Frokostsal', c_co2: 'Ja', c_aquastop: 'Ja', c_grut: 'Nei', c_avdeling: 'Kaffeknappen', c_filter: 'Demo Filter XL', c_kontakt: 'Per Demo, 400 00 002' }, null, { date_purchased: '2021-05-20', original_cost: 160000, salvage_value: 20000, asset_life: 7, next_filter_change: day(25) }],
    ['Kaffemaskin', 'Demo Super-auto S', 'Automat', 'Magnat', 'Til service', 'Verksted Oslo', 'lager', { c_avdeling: 'Service', c_filter: 'Ingen', c_plassering: 'Benk 2' }, null, { date_purchased: '2020-11-02', original_cost: 72000, salvage_value: 5000, asset_life: 5, last_service_notes: 'Venter på deler (demo).' }],
    ['Kaffemaskin', 'Demo Espresso 2G', '1-grupps', 'Utleie', 'Hos kunde', 'Messe Demo Trondheim', 'trd', { c_adresse: 'Prøvegata 7, 7011 Trondheim', c_etg: '2', c_plassering: 'Stand B12', c_avdeling: 'Magnat', c_kontakt: 'Lise Demo, 400 00 003' }, ['Messe Demo Trondheim', null, 'job'], { date_purchased: '2024-02-10', original_cost: 98000, salvage_value: 10000, asset_life: 6 }],
    ['Kvern', 'Demo Kvern 64', '', 'Kaffeknappen', 'Hos kunde', 'Kafé Demo Sentrum', 'oslo', { c_plassering: 'Ved maskinen', c_avdeling: 'Kaffeknappen' }, null, { date_purchased: '2022-03-15', original_cost: 24000, salvage_value: 2000, asset_life: 5 }],
    ['Kvern', 'Demo Kvern 64', '', 'Kaffeknappen', 'Hos kunde', 'Hotell Demo Bergen', 'bergen', { c_avdeling: 'Kaffeknappen' }, null, { date_purchased: '2021-05-20', original_cost: 24000, asset_life: 5 }],
    ['Kvern', 'Demo Kvern 64', '', 'Lager', 'På lager', 'Lager Oslo', 'lager', { c_plassering: 'Hylle A3' }, null, { date_purchased: '2025-01-08', original_cost: 26000, asset_life: 5 }],
    ['Vannfilter', 'Demo Filter XL', 'Filter', 'Kaffeknappen', 'Hos kunde', 'Hotell Demo Bergen', 'bergen', { c_filter: 'Demo Filter XL' }, null, { last_filter_changed: day(-160), next_filter_change: day(5) }],
    ['Vannfilter', 'Demo Filter XL', 'Filter', 'Lager', 'På lager', 'Lager Oslo', 'lager', {}, null, { quantity: 3, min_quantity: 5 }],
    ['Melkekjøler', 'Demo Kjøler 5L', '', 'Kaffeknappen', 'Hos kunde', 'Kontor Demo AS', 'grun', { c_fresk: 'Ja', c_etg: '4' }, null, { date_purchased: '2023-09-01', original_cost: 12000, asset_life: 6 }],
    ['Verktøy', 'Servicekoffert (demo)', '', 'Lager', 'I drift', 'Servicebil 1 (demo)', 'van', {}, ['Erik Lund', 'p_erik', 'person'], { description: 'Verktøykoffert for service (demo)', reward: 'Finnerlønn 500 kr', date_purchased: '2024-06-01', original_cost: 9000, asset_life: 4 }],
    ['PC / nettbrett', 'Nettbrett 10″ (demo)', '', 'Lager', 'I drift', 'Kontor Oslo', 'majo', {}, ['Anna Berg', 'p_anna', 'person'], { description: 'Nettbrett til servicebilen (demo)', reward: 'Finnerlønn 300 kr', date_purchased: '2025-03-01', original_cost: 6500, salvage_value: 500, asset_life: 3 }],
    ['Kjøleskap', 'Demo Kjøl 140L', '', 'Utleie', 'Hos kunde', 'Skole Demo Stavanger', 'stv', { c_adresse: 'Lærerveien 2, 4006 Stavanger' }, null, { date_purchased: '2019-08-15', original_cost: 15000, salvage_value: 1000, asset_life: 8 }],
  ];
  const ids = [];
  list.forEach(([type, model, sub, group, status, home, place, custom, assigned, extra], k) => {
    const c = code(); const [lat, lng] = L[place];
    const data = { asset_type: type, model, sub_type: sub || undefined, group, status, home_location: home, serial: 'DEMO-' + String(1001 + k), other_id: 'INT-' + String(201 + k), ...custom, ...extra };
    Object.keys(data).forEach((x) => data[x] == null && delete data[x]);
    const created = iso(60 - k, 8);
    const legacy = k < 4 ? 'DEMO-GC0' + (k + 2) : null; // shows how old GoCodes IDs can be kept (made-up)
    const a = ASSETS.createAsset({ code: c, data, legacy_code: legacy }, { who: P.simon[0], whoName: P.simon[1], lat: L.lager[0], lng: L.lager[1], acc: 12 });
    db.prepare('update assets set created=?, updated=? where id=?').run(created, iso(2 + (k % 5)), a.id);
    db.prepare('update asset_events set created=? where asset_id=?').run(created, a.id);
    // scan trail: warehouse -> van -> site (small jitter)
    const who = [P.erik, P.jonas, P.maria][k % 3];
    const trail = [[L.lager, 40 - k], [L.van, 20 - (k % 7)], [[lat, lng], 3 + (k % 4)]];
    trail.forEach(([[la, ln], ago], j) => { const jl = la + ((k * 7 + j * 3) % 9 - 4) * 0.0002, jg = ln + ((k * 5 + j) % 9 - 4) * 0.0003; ins.run(a.id, c, 'scan', who[0], who[1], jl, jg, 8 + ((k + j) % 4) * 6, 'Scanned', null, iso(Math.max(ago, 1), 9 + j)); });
    const last = trail[2][0];
    db.prepare('update assets set last_lat=?, last_lng=?, last_acc=?, last_seen=?, last_by=? where id=?').run(last[0] + ((k * 7 + 6) % 9 - 4) * 0.0002, last[1] + ((k * 5 + 2) % 9 - 4) * 0.0003, 14, iso(Math.max(trail[2][1], 1), 11), who[1], a.id);
    if (assigned) {
      const [to, person, kind] = assigned; const out = iso(k === 12 ? 12 : 4, 7); const ret = k === 12 ? day(-2) : k === 4 ? day(9) : day(14);
      db.prepare('update assets set assigned_to=?, assigned_person=?, checked_out=1, checked_out_at=?, return_date=? where id=?').run(to, person, out, ret, a.id);
      ins.run(a.id, c, 'checkout', who[0], who[1], L.lager[0], L.lager[1], 10, `Checked out to ${to} · return ${ret}`, JSON.stringify({ to, kind, return_date: ret }), out);
    }
    ids.push({ id: a.id, code: c, type });
  });
  // a finished loan (check-out + check-in) so the history shows durations
  ins.run(ids[7].id, ids[7].code, 'checkout', 'p_jonas', 'Jonas Dahl', L.lager[0], L.lager[1], 9, 'Checked out to Messe Demo Oslo · return ' + day(-18), null, iso(25, 8));
  ins.run(ids[7].id, ids[7].code, 'checkin', 'p_jonas', 'Jonas Dahl', L.lager[0], L.lager[1], 11, 'Checked in from Messe Demo Oslo after 6.0 days', null, iso(19, 8));
  // tasks, documents, finder message
  const T = db.prepare('insert into asset_tasks values(?,?,?,?,?,?,?,?)');
  T.run('t_demo1', ids[1].id, 'Bytt vannfilter (demo)', 'High', 'p_erik', day(-3), 0, iso(10)); T.run('t_demo2', ids[0].id, 'Årlig service (demo)', 'Medium', 'p_jonas', day(10), 0, iso(8));
  T.run('t_demo3', ids[3].id, 'Bestill deler (demo)', 'Critical', 'p_maria', day(1), 0, iso(3)); T.run('t_demo4', ids[2].id, 'Sjekk kvernjustering (demo)', 'Low', null, day(25), 0, iso(5)); T.run('t_demo5', ids[0].id, 'Montering (demo)', 'Medium', 'p_erik', day(-40), 1, iso(45));
  const D = db.prepare('insert into asset_docs values(?,?,?,?,?,?,?,?)');
  D.run('d_demo1', ids[0].id, 'Brukermanual (eksempel-lenke)', null, null, 'https://example.com/manual-demo.pdf', iso(30), 'p_simon');
  D.run('d_demo2', ids[2].id, 'Servicerapport (eksempel-lenke)', null, null, 'https://example.com/service-demo', iso(12), 'p_simon');
  db.prepare('insert into asset_messages values(?,?,?,?,?,?,?,?,?,?,?,?)').run('m_demo1', ids[11].id, ids[11].code, 'in', 'Finner (demo)', 'finner@example.com', '', 'Fant denne kofferten på parkeringsplassen (demo).', 59.9152, 10.7590, iso(6, 13), 0);
  ins.run(ids[11].id, ids[11].code, 'message', null, 'Public scan', 59.9152, 10.7590, 30, 'Finder message: Fant denne kofferten på parkeringsplassen (demo).', null, iso(6, 13));
  // pre-printed, not yet activated tags
  const Q = db.prepare('insert or ignore into qr_codes values(?,?,?,?)'); for (let k = 0; k < 24; k++) Q.run(code(), null, 'demo-batch', iso(5));
  // link a few demo jobs on the Kaffeknappen "Feilmeldinger" board to machines via its Gocodes column
  const fb = db.prepare("select id, columns from boards where workspace_id='w_kk' and name like '%Feilmeldinger%' limit 1").get();
  if (fb) {
    const gc = JSON.parse(fb.columns).find((c) => c.title === 'Gocodes');
    const items = db.prepare('select id, vals from items where board_id=? and parent_id is null order by pos limit 3').all(fb.id);
    if (gc) items.forEach((it, k) => { const v = JSON.parse(it.vals || '{}'); v[gc.id] = ids[k].code; db.prepare('update items set vals=? where id=?').run(JSON.stringify(v), it.id); });
  }
};
