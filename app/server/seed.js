module.exports = function seed(db, { createBoard, insertItem, getBoard, now, cid, ME, AVATAR_COLORS }) {
  if (db.prepare('select count(*) n from workspaces').get().n > 0) return;
  const people = [[ME, 'Simon Pope'], ['p_anna', 'Anna Berg'], ['p_erik', 'Erik Lund'], ['p_maria', 'Maria Holm'], ['p_jonas', 'Jonas Dahl']];
  people.forEach(([id, name], k) => db.prepare('insert into people values(?,?,?)').run(id, name, AVATAR_COLORS[k]));
  const ws1 = 'w_main', ws2 = 'w_service';
  db.prepare('insert into workspaces values(?,?,?,?,?)').run(ws1, 'Main workspace', '#579bfc', 1, now());
  db.prepare('insert into workspaces values(?,?,?,?,?)').run(ws2, 'Service team', '#ff642e', 2, now());

  const d = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };

  // Demo project board
  const { id: bid } = createBoard({ workspace_id: ws1, name: 'Demo project', template: 'project' });
  db.prepare('delete from items where board_id=?').run(bid);
  const b = getBoard(bid);
  const [owner, status, prio, timeline, due, budget, done, notes] = b.columns;
  const L = (c, name) => c.settings.labels.find((l) => l.label.startsWith(name))?.id;
  const [g1, g2, g3] = b.groups;
  const rows = [
    [g1, 'Plan new website', [ME], 'Working on it', 'High', [-3, 10], 5, 25000, false, 'Pages: home, shop, contact.'],
    [g1, 'Order new coffee machines', ['p_anna'], 'Stuck', 'Critical', [-1, 4], 2, 120000, false, 'Waiting for price from supplier.'],
    [g1, 'Staff training day', ['p_erik', ME], 'Done', 'Medium', [-8, -6], -6, 8000, true, ''],
    [g1, 'Update price list', ['p_maria'], '', 'Low', [2, 6], 6, 0, false, ''],
    [g2, 'Summer campaign', ['p_jonas'], 'Working on it', 'Medium', [12, 30], 30, 40000, false, 'Instagram + newsletter'],
    [g2, 'Hire 2 new techs', [ME], '', 'High', [15, 40], 40, 0, false, ''],
    [g3, 'Move office', ['p_anna', 'p_erik'], 'Done', 'High', [-30, -20], -20, 60000, true, ''],
  ];
  const ids = [];
  rows.forEach(([g, name, ppl, st, pr, [a, z], du, bud, dn, nt], k) => {
    const vals = { [owner.id]: ppl, [prio.id]: L(prio, pr), [timeline.id]: { from: d(a), to: d(z) }, [due.id]: d(du), [budget.id]: bud || undefined, [done.id]: dn, [notes.id]: nt || undefined };
    if (st) vals[status.id] = L(status, st);
    ids.push(insertItem(bid, g.id, name, null, JSON.parse(JSON.stringify(vals)), k + 1));
  });
  const [sOwner, sStatus, sDate] = b.sub_columns;
  const sL = (n) => sStatus.settings.labels.find((l) => l.label === n).id;
  insertItem(bid, g1.id, 'Write texts', ids[0], { [sOwner.id]: [ME], [sStatus.id]: sL('Done'), [sDate.id]: d(1) }, 1);
  insertItem(bid, g1.id, 'Take photos', ids[0], { [sOwner.id]: ['p_maria'], [sStatus.id]: sL('Working on it'), [sDate.id]: d(4) }, 2);
  insertItem(bid, g1.id, 'Choose web shop', ids[0], { [sOwner.id]: ['p_jonas'] }, 3);
  const up = (iid, who, body, mins) => db.prepare('insert into updates(id,item_id,board_id,author,body,created) values(?,?,?,?,?,?)').run(cid('u'), iid, bid, who, body, new Date(Date.now() - mins * 60000).toISOString());
  up(ids[1], 'p_anna', 'Supplier says new price comes on Friday.', 120);
  up(ids[1], ME, 'Ok 👍 Ping me when you have it.', 60);
  up(ids[0], ME, 'Started on the plan. Texts are almost done.', 30);
  b.views.push({ id: cid('v'), type: 'calendar', name: 'Calendar' }, { id: cid('v'), type: 'timeline', name: 'Timeline' }, { id: cid('v'), type: 'chart', name: 'Chart' });
  db.prepare('update boards set views=?, description=? where id=?').run(JSON.stringify(b.views), 'Demo board – try changing a status!', bid);

  // Service jobs board
  const { id: sid } = createBoard({ workspace_id: ws2, name: 'Service jobs', template: 'service' });
  db.prepare('delete from items where board_id=?').run(sid);
  const s = getBoard(sid);
  const [tech, planned, job, mach, inv, addr, phone, what] = s.columns;
  const SL = (c, n) => c.settings.labels.find((l) => l.label === n).id;
  const O = (n) => mach.settings.options.find((o) => o.label === n).id;
  [
    [0, 'Café Sol', ['p_erik'], 1, 'Planned', ['Coffee machine'], 'No', ['Karl Johans gate 1, Oslo', 59.9111, 10.7503], '+47 400 00 001', 'Machine leaks water'],
    [0, 'Hotel Fjord', ['p_jonas'], 0, 'New', ['Water filter'], 'Yes', ['Bryggen 5, Bergen', 60.3975, 5.3245], '+47 400 00 002', 'Change filter'],
    [0, 'Office Park AS', [], 3, 'Waiting parts', ['Grinder'], 'Yes', ['Fornebuveien 1, Lysaker', 59.9050, 10.6290], '+47 400 00 003', 'Grinder is noisy'],
    [1, 'Bakery Nord', ['p_erik'], -2, 'Fixed', ['Coffee machine', 'Water filter'], 'Yes', ['Munkegata 10, Trondheim', 63.4305, 10.3951], '+47 400 00 004', ''],
    [2, 'School Øst', ['p_jonas'], -7, 'Fixed', ['Fridge'], 'Invoiced', ['Kirkegata 5, Stavanger', 58.9700, 5.7331], '+47 400 00 005', ''],
    [0, 'Gym Nord', ['p_erik'], 2, 'New', ['Coffee machine'], 'No', ['Storgata 50, Tromsø', 69.6489, 18.9551], '+47 400 00 006', 'No hot water'],
    [0, 'Kontor Drammen', ['p_jonas'], 4, 'Planned', ['Water filter'], 'Yes', ['Bragernes torg 1, Drammen', 59.7440, 10.2045], '+47 400 00 007', 'Yearly filter change'],
  ].forEach(([gi, name, ppl, off, js, ms, iv, ad, ph, wt], k) => insertItem(sid, s.groups[gi].id, name, null, JSON.parse(JSON.stringify({ [tech.id]: ppl, [planned.id]: d(off), [job.id]: SL(job, js), [mach.id]: ms.map(O), [inv.id]: SL(inv, iv), [addr.id]: { address: ad[0], lat: ad[1], lng: ad[2] }, [phone.id]: ph, [what.id]: wt || undefined })), k + 1));

  // Customers board + connect/mirror + automations + time tracking on Service jobs
  const { id: cust } = createBoard({ workspace_id: ws2, name: 'Customers', template: 'crm' });
  db.prepare('delete from items where board_id=?').run(cust);
  const cb = getBoard(cust);
  const [cOwner, cStage, cContact, cPhone, cEmail, cValue] = cb.columns;
  const CS = (n) => cStage.settings.labels.find((l) => l.label === n).id;
  const custIds = {};
  [['Café Sol', 'Won', 'Kari', '+47 400 00 001', 12000], ['Hotel Fjord', 'Won', 'Ola', '+47 400 00 002', 48000], ['Office Park AS', 'Talking', 'Per', '+47 400 00 003', 30000], ['Bakery Nord', 'Won', 'Lise', '+47 400 00 004', 9000], ['School Øst', 'Lead', 'Nina', '+47 400 00 005', 15000]]
    .forEach(([n, st, ct, ph, val], k) => { custIds[n] = insertItem(cust, cb.groups[0].id, n, null, { [cOwner.id]: [ME], [cStage.id]: CS(st), [cContact.id]: ct, [cPhone.id]: ph, [cEmail.id]: ct.toLowerCase() + '@example.com', [cValue.id]: val }, k + 1); });
  const s2 = getBoard(sid);
  const conn = { id: cid('c'), type: 'connect', title: 'Customer', settings: { boardId: cust } };
  const mir = { id: cid('c'), type: 'mirror', title: 'Contact', settings: { connectCol: conn.id, colId: cContact.id } };
  const tt = { id: cid('c'), type: 'time_tracking', title: 'Work time', settings: {} };
  const cols = [...s2.columns]; cols.splice(1, 0, conn, mir); cols.push(tt);
  const jobCol = s2.columns.find((c) => c.title === 'Job status');
  const L2 = (n) => jobCol.settings.labels.find((l) => l.label === n).id;
  const autos = [
    { id: cid('a'), on: true, trigger: { type: 'item_created' }, action: { type: 'set_status', col: jobCol.id, to: L2('New') } },
    { id: cid('a'), on: true, trigger: { type: 'status_change', col: jobCol.id, to: L2('Fixed') }, action: { type: 'move_group', group: s2.groups[1].id } },
    { id: cid('a'), on: true, trigger: { type: 'status_change', col: jobCol.id, to: L2('Fixed') }, action: { type: 'notify', person: ME, text: 'Job fixed – ready to invoice' } },
  ];
  const sviews = [...s2.views, { id: cid('v'), type: 'map', name: 'Map', settings: { colorBy: jobCol.id } }];
  db.prepare('update boards set columns=?, automations=?, description=?, views=? where id=?').run(JSON.stringify(cols), JSON.stringify(autos), 'Made-up demo jobs. Try: set Job status to Fixed ⚡', JSON.stringify(sviews), sid);
  db.prepare('select * from items where board_id=?').all(sid).forEach((it) => { const v = JSON.parse(it.vals); if (custIds[it.name]) v[conn.id] = [custIds[it.name]]; db.prepare('update items set vals=? where id=?').run(JSON.stringify(v), it.id); });
};
