const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { TEMPLATES, subCols, cid } = require('./templates');
const auth = require('./auth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'mondo.db'));
db.pragma('journal_mode = WAL');
db.exec(`
create table if not exists workspaces(id text primary key, name text, color text, pos integer, created text);
create table if not exists boards(id text primary key, workspace_id text, name text, description text, icon text, columns text, sub_columns text, groups_ text, views text, favorite integer default 0, pos integer, created text, updated text);
create table if not exists items(id text primary key, board_id text, group_id text, parent_id text, name text, vals text, pos real, created text, updated text);
create table if not exists updates(id text primary key, item_id text, board_id text, author text, body text, created text);
create table if not exists activity(id integer primary key autoincrement, board_id text, item_id text, who text, text text, created text);
create table if not exists people(id text primary key, name text, color text);
create table if not exists notifications(id integer primary key autoincrement, person text, text text, board_id text, item_id text, created text, read integer default 0);

`);

const addCol = (t, c, def) => { const cols = db.prepare(`pragma table_info(${t})`).all().map((r) => r.name); if (!cols.includes(c)) db.exec(`alter table ${t} add column ${c} ${def}`); };
addCol('boards', 'automations', "text default '[]'"); addCol('boards', 'form', "text default '{}'"); addCol('updates', 'parent_id', 'text');
const now = () => new Date().toISOString();
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const AVATAR_COLORS = ['#579bfc', '#a25ddc', '#00c875', '#fdab3d', '#e2445c', '#ff642e', '#037f4c', '#ff158a', '#784bd1', '#0086c0'];
const ME_SEED = 'p_simon';
const me = () => auth.current()?.person_id || ME_SEED;
const meName = () => auth.current()?.name || 'Someone';

function boardRow(b) {
  return { id: b.id, workspace_id: b.workspace_id, name: b.name, description: b.description || '', icon: b.icon || '📋', columns: J(b.columns, []), sub_columns: J(b.sub_columns, []), groups: J(b.groups_, []), views: J(b.views, []), automations: J(b.automations, []), form: J(b.form, {}), favorite: !!b.favorite, pos: b.pos, created: b.created, updated: b.updated };
}
function itemRow(i) { return { id: i.id, board_id: i.board_id, group_id: i.group_id, parent_id: i.parent_id, name: i.name, vals: J(i.vals, {}), pos: i.pos, created: i.created, updated: i.updated }; }
function getBoard(id) { const b = db.prepare('select * from boards where id=?').get(id); return b ? boardRow(b) : null; }
function fullBoard(id) {
  const board = getBoard(id); if (!board) return null;
  const items = db.prepare('select * from items where board_id=? order by pos').all(id).map(itemRow);
  const counts = {}; db.prepare('select item_id, count(*) n from updates where board_id=? group by item_id').all(id).forEach((r) => (counts[r.item_id] = r.n));
  return { board, items, updateCounts: counts };
}
function log(board_id, item_id, text) { db.prepare('insert into activity(board_id,item_id,who,text,created) values(?,?,?,?,?)').run(board_id, item_id, me(), text, now()); }
function touch(board_id) { db.prepare('update boards set updated=? where id=?').run(now(), board_id); }

function fmtVal(col, v) {
  if (v == null || v === '') return '—';
  const s = col.settings || {};
  switch (col.type) {
    case 'status': case 'priority': return (s.labels || []).find((l) => l.id === v)?.label || '—';
    case 'dropdown': return (v || []).map((id) => (s.options || []).find((o) => o.id === id)?.label).filter(Boolean).join(', ') || '—';
    case 'people': return (v || []).map((id) => db.prepare('select name from people where id=?').get(id)?.name).filter(Boolean).join(', ') || '—';
    case 'timeline': return `${v.from || '?'} → ${v.to || '?'}`;
    case 'checkbox': return v ? '✔' : '✖';
    case 'link': return v.text || v.url || '—';
    case 'location': return (typeof v === 'object' ? v.address : v) || '—';
    default: return String(v).slice(0, 60);
  }
}

const BOARD_INS = 'insert into boards(id,workspace_id,name,description,icon,columns,sub_columns,groups_,views,favorite,pos,created,updated) values(?,?,?,?,?,?,?,?,?,?,?,?,?)';
function createBoard({ workspace_id, name, template = 'blank', icon }) {
  const t = TEMPLATES[template] || TEMPLATES.blank;
  const m = t.make();
  const id = cid('b');
  const pos = (db.prepare('select max(pos) m from boards where workspace_id=?').get(workspace_id).m || 0) + 1;
  const views = [{ id: cid('v'), type: 'table', name: 'Main table' }, { id: cid('v'), type: 'kanban', name: 'Kanban' }];
  db.prepare(BOARD_INS).run(id, workspace_id, name || t.name, '', icon || t.icon, JSON.stringify(m.columns), JSON.stringify(subCols()), JSON.stringify(m.groups), JSON.stringify(views), 0, pos, now(), now());
  m.items.forEach(([n, gi], k) => insertItem(id, m.groups[gi].id, n, null, {}, k + 1));
  return { id, columns: m.columns, groups: m.groups };
}
function insertItem(board_id, group_id, name, parent_id, vals, pos) {
  const id = cid('i');
  if (pos == null) pos = (db.prepare(`select max(pos) m from items where board_id=? and group_id=? and coalesce(parent_id,'')=?`).get(board_id, group_id, parent_id || '').m || 0) + 1;
  db.prepare('insert into items values(?,?,?,?,?,?,?,?,?)').run(id, board_id, group_id, parent_id || null, name, JSON.stringify(vals || {}), pos, now(), now());
  return id;
}

const A = auth.setup(db);
const app = express();
app.set('trust proxy', process.env.TRUST_PROXY ? (isNaN(process.env.TRUST_PROXY) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY)) : 'loopback');
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY'); next(); });
app.use(express.json({ limit: '5mb' }));
app.use(A.middleware);
A.routes(app);
const PUSH = require('./push').setup(db, DATA_DIR); PUSH.routes(app, me);
require('./geo').setup(db).routes(app);
const wrap = (fn) => (req, res) => { try { const r = fn(req, res); if (r !== undefined) res.json(r); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); } };
const notFound = (res) => { res.status(404).json({ error: 'not found' }); };

app.get('/api/bootstrap', wrap(() => ({
  me: me(), user: auth.current(),
  workspaces: db.prepare('select * from workspaces order by pos').all(),
  boards: db.prepare('select b.id,b.workspace_id,b.name,b.icon,b.favorite,b.pos,b.updated,(select count(*) from items i where i.board_id=b.id and i.parent_id is null) items from boards b order by pos').all().map((b) => ({ ...b, favorite: !!b.favorite })),
  people: db.prepare('select * from people order by name').all(),
  templates: Object.entries(TEMPLATES).map(([k, t]) => ({ key: k, label: t.label, icon: t.icon, desc: t.desc })),
})));

// workspaces
app.post('/api/workspaces', wrap((req) => { const id = cid('w'); const pos = (db.prepare('select max(pos) m from workspaces').get().m || 0) + 1; db.prepare('insert into workspaces values(?,?,?,?,?)').run(id, req.body.name || 'New workspace', req.body.color || AVATAR_COLORS[pos % AVATAR_COLORS.length], pos, now()); return { id }; }));
app.patch('/api/workspaces/:id', wrap((req) => { const w = db.prepare('select * from workspaces where id=?').get(req.params.id); db.prepare('update workspaces set name=?, color=? where id=?').run(req.body.name ?? w.name, req.body.color ?? w.color, w.id); return { ok: true }; }));
app.delete('/api/workspaces/:id', wrap((req) => {
  const boards = db.prepare('select id from boards where workspace_id=?').all(req.params.id);
  db.transaction(() => { boards.forEach((b) => deleteBoard(b.id)); db.prepare('delete from workspaces where id=?').run(req.params.id); })();
  return { ok: true };
}));

// people
app.post('/api/people', wrap((req) => { const id = cid('p'); const n = db.prepare('select count(*) n from people').get().n; db.prepare('insert into people values(?,?,?)').run(id, req.body.name, AVATAR_COLORS[n % AVATAR_COLORS.length]); return { id, name: req.body.name, color: AVATAR_COLORS[n % AVATAR_COLORS.length] }; }));

// boards
app.post('/api/boards', wrap((req) => createBoard(req.body)));
app.get('/api/boards/:id', wrap((req, res) => fullBoard(req.params.id) || notFound(res)));
app.patch('/api/boards/:id', wrap((req, res) => {
  const b = getBoard(req.params.id); if (!b) return notFound(res);
  const p = req.body;
  db.prepare('update boards set name=?, description=?, icon=?, columns=?, sub_columns=?, groups_=?, views=?, favorite=?, workspace_id=?, updated=? where id=?').run(
    p.name ?? b.name, p.description ?? b.description, p.icon ?? b.icon, JSON.stringify(p.columns ?? b.columns), JSON.stringify(p.sub_columns ?? b.sub_columns), JSON.stringify(p.groups ?? b.groups), JSON.stringify(p.views ?? b.views), (p.favorite ?? b.favorite) ? 1 : 0, p.workspace_id ?? b.workspace_id, now(), b.id);
  if (p.automations || p.form) db.prepare('update boards set automations=?, form=? where id=?').run(JSON.stringify(p.automations ?? b.automations), JSON.stringify(p.form ?? b.form), b.id);
  return fullBoard(b.id);
}));
function deleteBoard(id) {
  db.prepare('delete from items where board_id=?').run(id); db.prepare('delete from updates where board_id=?').run(id);
  db.prepare('delete from activity where board_id=?').run(id); db.prepare('delete from boards where id=?').run(id);
}
app.delete('/api/boards/:id', wrap((req) => { db.transaction(() => deleteBoard(req.params.id))(); return { ok: true }; }));
app.post('/api/boards/:id/duplicate', wrap((req, res) => {
  const b = getBoard(req.params.id); if (!b) return notFound(res);
  const nid = cid('b');
  db.transaction(() => {
    db.prepare(BOARD_INS).run(nid, b.workspace_id, req.body.name || b.name + ' (copy)', b.description, b.icon, JSON.stringify(b.columns), JSON.stringify(b.sub_columns), JSON.stringify(b.groups), JSON.stringify(b.views), 0, b.pos + 0.5, now(), now());
    db.prepare('update boards set automations=?, form=? where id=?').run(JSON.stringify(b.automations), JSON.stringify(b.form), nid);
    const map = {};
    const items = db.prepare('select * from items where board_id=? order by parent_id is not null, pos').all(b.id);
    items.forEach((i) => { const ni = cid('i'); map[i.id] = ni; db.prepare('insert into items values(?,?,?,?,?,?,?,?,?)').run(ni, nid, i.group_id, i.parent_id ? map[i.parent_id] : null, i.name, req.body.withItems === false ? '{}' : i.vals, i.pos, now(), now()); });
  })();
  return { id: nid };
}));
app.delete('/api/boards/:id/groups/:gid', wrap((req, res) => {
  const b = getBoard(req.params.id); if (!b) return notFound(res);
  db.transaction(() => {
    db.prepare('delete from items where board_id=? and group_id=?').run(b.id, req.params.gid);
    db.prepare('update boards set groups_=? where id=?').run(JSON.stringify(b.groups.filter((g) => g.id !== req.params.gid)), b.id);
  })();
  return fullBoard(b.id);
}));

// items
app.post('/api/boards/:id/items', wrap((req, res) => {
  const b = getBoard(req.params.id); if (!b) return notFound(res);
  const { group_id, name, parent_id, vals, top } = req.body;
  let gid = group_id || (parent_id ? db.prepare('select group_id from items where id=?').get(parent_id)?.group_id : b.groups[0]?.id);
  let pos;
  if (top) pos = (db.prepare('select min(pos) m from items where board_id=? and group_id=? and parent_id is null').get(b.id, gid).m || 1) - 1;
  const id = insertItem(b.id, gid, name || 'New item', parent_id, vals, pos);
  log(b.id, id, parent_id ? 'Created subitem' : 'Created item'); touch(b.id);
  if (!parent_id) runAutomations(b.id, id, 'create', {});
  return { ...fullBoard(b.id), newId: id };
}));
app.patch('/api/items/:id', wrap((req, res) => {
  const i = db.prepare('select * from items where id=?').get(req.params.id); if (!i) return notFound(res);
  const b = getBoard(i.board_id); const vals = J(i.vals, {});
  if (req.body.name != null && req.body.name !== i.name) log(b.id, i.id, `Name: "${i.name}" → "${req.body.name}"`);
  if (req.body.vals) {
    const cols = [...b.columns, ...b.sub_columns];
    for (const [k, v] of Object.entries(req.body.vals)) {
      const c = cols.find((c) => c.id === k);
      if (c) log(b.id, i.id, `${c.title}: ${fmtVal(c, vals[k])} → ${fmtVal(c, v)}`);
      if (v === null) delete vals[k]; else vals[k] = v;
    }
  }
  db.prepare('update items set name=?, vals=?, group_id=?, updated=? where id=?').run(req.body.name ?? i.name, JSON.stringify(vals), req.body.group_id ?? i.group_id, now(), i.id);
  if (req.body.group_id && req.body.group_id !== i.group_id) db.prepare('update items set group_id=? where parent_id=?').run(req.body.group_id, i.id);
  if (req.body.vals && !i.parent_id) runAutomations(b.id, i.id, 'change', req.body.vals, vals);
  touch(b.id);
  return fullBoard(b.id);
}));
app.delete('/api/items/:id', wrap((req, res) => {
  const i = db.prepare('select * from items where id=?').get(req.params.id); if (!i) return notFound(res);
  db.prepare('delete from items where id=? or parent_id=?').run(i.id, i.id); db.prepare('delete from updates where item_id=?').run(i.id);
  touch(i.board_id); return fullBoard(i.board_id);
}));
function moveItem(id, group_id, before_id) {
  const i = db.prepare('select * from items where id=?').get(id);
  const sibs = db.prepare('select id from items where board_id=? and group_id=? and parent_id is null and id<>? order by pos').all(i.board_id, group_id, id).map((r) => r.id);
  let idx = before_id ? sibs.indexOf(before_id) : -1; if (idx < 0) idx = sibs.length;
  sibs.splice(idx, 0, id);
  const up = db.prepare('update items set pos=?, group_id=? where id=?');
  sibs.forEach((sid, k) => up.run(k + 1, group_id, sid));
  db.prepare('update items set group_id=? where parent_id=?').run(group_id, id);
  if (i.group_id !== group_id) { const b = getBoard(i.board_id); log(i.board_id, id, `Moved to group "${b.groups.find((g) => g.id === group_id)?.name}"`); }
  return i.board_id;
}
app.post('/api/items/:id/move', wrap((req) => {
  const i = db.prepare('select * from items where id=?').get(req.params.id);
  if (i.parent_id) { // reorder subitem within parent
    const sibs = db.prepare('select id from items where parent_id=? and id<>? order by pos').all(i.parent_id, i.id).map((r) => r.id);
    let idx = req.body.before_id ? sibs.indexOf(req.body.before_id) : -1; if (idx < 0) idx = sibs.length; sibs.splice(idx, 0, i.id);
    sibs.forEach((sid, k) => db.prepare('update items set pos=? where id=?').run(k + 1, sid));
    return fullBoard(i.board_id);
  }
  const bid = db.transaction(() => moveItem(req.params.id, req.body.group_id, req.body.before_id))();
  touch(bid); return fullBoard(bid);
}));
app.post('/api/items/:id/duplicate', wrap((req) => {
  const i = db.prepare('select * from items where id=?').get(req.params.id);
  const nid = insertItem(i.board_id, i.group_id, i.name + ' (copy)', i.parent_id, J(i.vals, {}), i.pos + 0.01);
  db.prepare('select * from items where parent_id=? order by pos').all(i.id).forEach((s) => insertItem(i.board_id, i.group_id, s.name, nid, J(s.vals, {}), s.pos));
  return fullBoard(i.board_id);
}));
app.post('/api/boards/:id/bulk', wrap((req) => {
  const { action, ids, group_id } = req.body;
  db.transaction(() => ids.forEach((id) => {
    if (action === 'delete') { db.prepare('delete from items where id=? or parent_id=?').run(id, id); db.prepare('delete from updates where item_id=?').run(id); }
    if (action === 'move') moveItem(id, group_id, null);
  }))();
  return fullBoard(req.params.id);
}));

// updates & activity
app.get('/api/items/:id/updates', wrap((req) => ({
  updates: db.prepare('select * from updates where item_id=? order by created desc').all(req.params.id),
  activity: db.prepare('select * from activity where item_id=? order by id desc limit 200').all(req.params.id),
})));
app.post('/api/items/:id/updates', wrap((req) => {
  const i = db.prepare('select * from items where id=?').get(req.params.id);
  db.prepare('insert into updates(id,item_id,board_id,author,body,created,parent_id) values(?,?,?,?,?,?,?)').run(cid('u'), i.id, i.board_id, me(), req.body.body, now(), req.body.parent_id || null);
  (req.body.mentions || []).forEach((p) => notify(p, `💬 ${meName()} mentioned you on “${i.name}”: ${req.body.body.slice(0, 80)}`, i.board_id, i.id));
  log(i.board_id, i.id, req.body.parent_id ? 'Replied to an update' : 'Wrote an update'); return { ok: true };
}));
app.delete('/api/updates/:id', wrap((req) => { db.prepare('delete from updates where id=?').run(req.params.id); return { ok: true }; }));
app.get('/api/boards/:id/activity', wrap((req) => db.prepare('select a.*, i.name item from activity a left join items i on i.id=a.item_id where a.board_id=? order by a.id desc limit 200').all(req.params.id)));

// overview for home dashboard
app.get('/api/overview', wrap(() => {
  const boards = db.prepare('select * from boards').all().map(boardRow);
  const today = new Date().toISOString().slice(0, 10);
  const out = { boards: [], myItems: [] };
  for (const b of boards) {
    const items = db.prepare('select * from items where board_id=? and parent_id is null').all(b.id).map(itemRow);
    const status = b.columns.find((c) => c.type === 'status');
    const dateCol = b.columns.find((c) => c.type === 'date');
    const peopleCols = b.columns.filter((c) => c.type === 'people');
    const dist = {};
    let done = 0, overdue = 0;
    for (const it of items) {
      const lab = status ? status.settings.labels.find((l) => l.id === it.vals[status.id]) : null;
      const key = lab ? lab.id : '_';
      dist[key] = (dist[key] || 0) + 1;
      const isDone = lab && (lab.color === '#00c875' || /done|ferdig|fixed|won|invoiced/i.test(lab.label));
      if (isDone) done++;
      const d = dateCol && it.vals[dateCol.id];
      if (d && d < today && !isDone) overdue++;
      if (peopleCols.some((c) => (it.vals[c.id] || []).includes(me())) && !isDone) out.myItems.push({ id: it.id, name: it.name, board_id: b.id, board: b.name, icon: b.icon, status: lab || null, date: d || null, group: b.groups.find((g) => g.id === it.group_id) });
    }
    out.boards.push({ id: b.id, name: b.name, icon: b.icon, workspace_id: b.workspace_id, updated: b.updated, total: items.length, done, overdue, statusCol: status ? status.title : null, dist: status ? [...status.settings.labels.filter((l) => dist[l.id]).map((l) => ({ label: l.label, color: l.color, n: dist[l.id] })), ...(dist._ ? [{ label: 'Empty', color: '#c4c4c4', n: dist._ }] : [])] : [] });
  }
  out.myItems.sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  return out;
}));

// automations (run on server so forms + all edits trigger them)
function notify(person, text, board_id, item_id) {
  db.prepare('insert into notifications(person,text,board_id,item_id,created) values(?,?,?,?,?)').run(person, text, board_id, item_id, now());
  PUSH.send(person, { title: 'mondo', body: text, url: '/#/board/' + board_id, tag: item_id }).catch(() => {});
}
function runAutomations(board_id, item_id, trigger, changed, depth = 0) {
  if (depth > 3) return;
  const b = getBoard(board_id); const rules = (b.automations || []).filter((r) => r.on !== false);
  if (!rules.length) return;
  const i = itemRow(db.prepare('select * from items where id=?').get(item_id));
  const set = {};
  for (const r of rules) {
    const t = r.trigger || {};
    let hit = false;
    if (trigger === 'create' && t.type === 'item_created') hit = true;
    if (trigger === 'change' && t.type === 'status_change' && t.col in changed && (!t.to || changed[t.col] === t.to)) hit = true;
    if (!hit) continue;
    const a = r.action || {};
    const colT = (id) => b.columns.find((c) => c.id === id)?.title;
    if (a.type === 'move_group' && a.group) { db.prepare('update items set group_id=? where id=? or parent_id=?').run(a.group, i.id, i.id); log(b.id, i.id, `⚡ Automation moved item to "${b.groups.find((g) => g.id === a.group)?.name}"`); }
    if (a.type === 'set_status' && a.col) { set[a.col] = a.to || null; log(b.id, i.id, `⚡ Automation set ${colT(a.col)}`); }
    if (a.type === 'set_date' && a.col) { set[a.col] = new Date().toISOString().slice(0, 10); log(b.id, i.id, `⚡ Automation set ${colT(a.col)} to today`); }
    if (a.type === 'notify' && a.person) { const target = a.person === '__owner' ? (b.columns.filter((c) => c.type === 'people').flatMap((c) => i.vals[c.id] || [])) : [a.person]; target.forEach((p) => notify(p, `⚡ ${a.text || 'Item changed'}: “${i.name}” (${b.name})`, b.id, i.id)); }
    if (a.type === 'time' && a.col) {
      const v = i.vals[a.col] || { total: 0, since: null };
      if (a.mode === 'start' && !v.since) set[a.col] = { total: v.total, since: new Date().toISOString() };
      if (a.mode === 'stop' && v.since) set[a.col] = { total: v.total + Math.floor((Date.now() - new Date(v.since)) / 1000), since: null };
    }
  }
  if (Object.keys(set).length) {
    const cur = itemRow(db.prepare('select * from items where id=?').get(item_id));
    db.prepare('update items set vals=? where id=?').run(JSON.stringify({ ...cur.vals, ...set }), item_id);
    runAutomations(board_id, item_id, 'change', set, depth + 1);
  }
}
app.get('/api/notifications', wrap(() => db.prepare('select n.*, i.name item from notifications n left join items i on i.id=n.item_id where person=? order by n.id desc limit 50').all(me())));
app.post('/api/notifications/read', wrap(() => { db.prepare('update notifications set read=1 where person=?').run(me()); return { ok: true }; }));

// forms
const FORM_TYPES = ['text', 'long_text', 'numbers', 'date', 'status', 'priority', 'dropdown', 'people', 'phone', 'email', 'link', 'location', 'checkbox'];
const formAllowed = (req, b) => req.user || (b.form && b.form.public);
app.get('/api/forms/:id', wrap((req, res) => {
  const b = getBoard(req.params.id); if (!b || !formAllowed(req, b)) return notFound(res);
  const f = b.form || {}; const fields = (f.fields || b.columns.filter((c) => FORM_TYPES.includes(c.type)).map((c) => c.id));
  const pub = !req.user; // public visitors only see field definitions, not the people list unless a people field is shown
  return { board: { id: b.id, name: b.name, icon: b.icon }, title: f.title || b.name, description: f.description || '', columns: fields.map((id) => b.columns.find((c) => c.id === id)).filter(Boolean).map(({ id, type, title, settings }) => ({ id, type, title, settings: { labels: settings.labels, options: settings.options } })), people: (fields.some((id) => b.columns.find((c) => c.id === id)?.type === 'people') || !pub) ? db.prepare('select * from people order by name').all() : [] };
}));
app.post('/api/forms/:id', wrap((req, res) => {
  const b = getBoard(req.params.id); if (!b || !formAllowed(req, b)) return notFound(res);
  const gid = (b.form && b.form.group) || b.groups[0]?.id;
  const f = b.form || {}; const allowedCols = new Set(f.fields || b.columns.filter((c) => FORM_TYPES.includes(c.type)).map((c) => c.id));
  const vals = Object.fromEntries(Object.entries(req.body.vals || {}).filter(([k]) => allowedCols.has(k)));
  const id = insertItem(b.id, gid, String(req.body.name || 'Form answer').slice(0, 200), null, vals);
  log(b.id, id, '📝 Created from form'); runAutomations(b.id, id, 'create', {}); touch(b.id);
  return { ok: true };
}));

app.get('/api/health', (req, res) => { try { db.prepare('select 1').get(); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false }); } });

// seed made-up demo data on an empty database (SEED_DEMO=0 to start empty)
if (process.env.SEED_DEMO !== '0') db.transaction(() => require('./seed')(db, { createBoard, insertItem, getBoard, now, cid, ME: ME_SEED, AVATAR_COLORS }))();

const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist, { setHeaders: (res, f) => { if (/(sw\.js|index\.html|\.webmanifest)$/.test(f)) res.setHeader('Cache-Control', 'no-cache'); else if (f.includes(path.sep + 'assets' + path.sep)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
app.use((req, res, next) => { if (req.method === 'GET' && !req.path.startsWith('/api')) return res.sendFile(path.join(dist, 'index.html')); next(); });

// first start (e.g. on Render): create the admin from env vars if there are no users yet
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !db.prepare('select count(*) n from users').get().n) {
  A.createUser({ email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME || 'Simon', password: process.env.ADMIN_PASSWORD, role: 'admin', person_id: db.prepare("select id from people where id='p_simon'").get() ? 'p_simon' : undefined });
  console.log('Admin user created for', process.env.ADMIN_EMAIL);
}
const PORT = process.env.PORT || 4321;
app.listen(PORT, process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1'), () => console.log(`mondo running on http://localhost:${PORT}`));
