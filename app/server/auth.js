const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
const COOKIE = 'mondo_sid';
const DAYS = 30;
const DUMMY = bcrypt.hashSync('not-a-real-password', 12);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const WORDS = ('sun moon star boat lake tree fish bird wolf bear frog duck lime plum pear kiwi corn rice milk tea cake gold blue red pink jade ruby snow rain wind leaf rock sand hill road town farm barn mint salt sock shoe hat cap coat kite drum bell horn harp ship rope nest seed rose lily fern moss oak pine elk owl fox hen cow goat lamb deer seal crab clam yak zebra lion tiger panda koala camel horse pony mouse otter swan crow dove hawk robin wren apple melon grape lemon peach berry olive bean nut honey bread soup pizza pasta toast jam cookie candy sugar spoon fork cup bowl lamp desk door key box bag map pen ink book card gift ball game song dance smile happy brave calm cool fast tall soft warm sunny lucky jolly merry')
  .split(/\s+/);
const cap = (w) => w[0].toUpperCase() + w.slice(1);
function easyPassword() {
  const w = () => cap(WORDS[crypto.randomInt(WORDS.length)]);
  return `${w()}-${w()}-${w()}-${String(crypto.randomInt(10, 100))}`;
}

function setup(db) {
  db.exec(`
  create table if not exists users(id text primary key, email text unique collate nocase, name text, pass_hash text, role text default 'member', person_id text, created text, last_login text);
  create table if not exists sessions(token_hash text primary key, user_id text, created text, expires text, ua text);
  `);
  db.prepare('delete from sessions where expires < ?').run(new Date().toISOString());

  const fails = new Map(); // key -> {n, until}
  const limited = (key, max) => { const f = fails.get(key); return f && f.n >= max && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; };
  const fail = (key) => { const f = fails.get(key); const n = f && f.until > Date.now() ? f.n + 1 : 1; fails.set(key, { n, until: Date.now() + 15 * 60 * 1000 }); };
  setInterval(() => { const t = Date.now(); for (const [k, v] of fails) if (v.until < t) fails.delete(k); }, 60000).unref();

  const parseCookies = (h = '') => Object.fromEntries(h.split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  function userFromReq(req) {
    const tok = parseCookies(req.headers.cookie)[COOKIE];
    if (!tok) return null;
    const s = db.prepare('select * from sessions where token_hash=?').get(sha(tok));
    if (!s || s.expires < new Date().toISOString()) return null;
    return db.prepare('select id,email,name,role,person_id from users where id=?').get(s.user_id) || null;
  }
  function setCookie(req, res, value, maxAge) {
    const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
    if (req.secure || process.env.COOKIE_SECURE === '1') parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }
  function createSession(req, res, user) {
    const tok = crypto.randomBytes(32).toString('base64url');
    const exp = new Date(Date.now() + DAYS * 86400000).toISOString();
    db.prepare('insert into sessions values(?,?,?,?,?)').run(sha(tok), user.id, new Date().toISOString(), exp, String(req.headers['user-agent'] || '').slice(0, 200));
    db.prepare('update users set last_login=? where id=?').run(new Date().toISOString(), user.id);
    setCookie(req, res, tok, DAYS * 86400);
  }
  function createUser({ email, name, password, role = 'member', person_id }) {
    email = String(email || '').trim().toLowerCase(); name = String(name || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Bad email');
    if (!name) throw new Error('Name needed');
    if (String(password || '').length < 8) throw new Error('Password must be 8+ characters');
    if (db.prepare('select 1 from users where email=?').get(email)) throw new Error('Email already used');
    if (!person_id) {
      person_id = 'p_' + crypto.randomBytes(4).toString('hex');
      const n = db.prepare('select count(*) n from people').get().n;
      const colors = ['#579bfc', '#a25ddc', '#00c875', '#fdab3d', '#e2445c', '#ff642e', '#037f4c', '#ff158a', '#784bd1', '#0086c0'];
      db.prepare('insert into people values(?,?,?)').run(person_id, name, colors[n % colors.length]);
    }
    const id = 'u_' + crypto.randomBytes(5).toString('hex');
    db.prepare('insert into users values(?,?,?,?,?,?,?,?)').run(id, email, name, bcrypt.hashSync(password, 12), role === 'admin' ? 'admin' : 'member', person_id, new Date().toISOString(), null);
    return { id, email, name, role, person_id };
  }

  const PUBLIC = (req) => req.path === '/api/auth/login' || req.path === '/api/health' || req.path === '/api/push/key' || req.path.startsWith('/api/forms/');
  function middleware(req, res, next) {
    if (!req.path.startsWith('/api')) return next();
    // CSRF guard: state-changing API calls must be JSON (cross-site forms can't send that without CORS)
    if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.headers['content-type'] || '').includes('application/json')) return res.status(415).json({ error: 'JSON only' });
    const user = userFromReq(req);
    req.user = user;
    if (!user && !PUBLIC(req)) return res.status(401).json({ error: 'login needed' });
    als.run({ user }, next);
  }
  const admin = (req, res, next) => (req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'admin only' }));

  function routes(app) {
    app.post('/api/auth/login', (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const key = req.ip + '|' + email; const ipKey = 'ip|' + req.ip;
      const wait = Math.max(limited(key, 5), limited(ipKey, 20));
      if (wait) return res.status(429).json({ error: `Too many tries. Wait ${Math.ceil(wait / 60)} min.` });
      const u = db.prepare('select * from users where email=?').get(email);
      const ok = bcrypt.compareSync(String(req.body?.password || ''), u ? u.pass_hash : DUMMY) && !!u;
      if (!ok) { fail(key); fail(ipKey); return res.status(401).json({ error: 'Wrong email or password' }); }
      fails.delete(key);
      createSession(req, res, u);
      res.json({ ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role, person_id: u.person_id } });
    });
    app.post('/api/auth/logout', (req, res) => {
      const tok = parseCookies(req.headers.cookie)[COOKIE];
      if (tok) db.prepare('delete from sessions where token_hash=?').run(sha(tok));
      setCookie(req, res, '', 0); res.json({ ok: true });
    });
    app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
    app.post('/api/auth/password', (req, res) => {
      const u = db.prepare('select * from users where id=?').get(req.user.id);
      if (!bcrypt.compareSync(String(req.body.old || ''), u.pass_hash)) return res.status(400).json({ error: 'Old password is wrong' });
      if (String(req.body.password || '').length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });
      db.prepare('update users set pass_hash=? where id=?').run(bcrypt.hashSync(req.body.password, 12), u.id);
      res.json({ ok: true });
    });
    app.get('/api/users', admin, (req, res) => res.json(db.prepare('select id,email,name,role,person_id,created,last_login from users order by created').all()));
    app.get('/api/users/suggest-password', admin, (req, res) => res.json({ password: easyPassword() }));
    app.post('/api/users', admin, (req, res) => { try { res.json(createUser(req.body)); } catch (e) { res.status(400).json({ error: e.message }); } });
    app.patch('/api/users/:id', admin, (req, res) => {
      const u = db.prepare('select * from users where id=?').get(req.params.id); if (!u) return res.status(404).json({ error: 'not found' });
      if (req.body.password) { if (String(req.body.password).length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' }); db.prepare('update users set pass_hash=? where id=?').run(bcrypt.hashSync(req.body.password, 12), u.id); db.prepare('delete from sessions where user_id=?').run(u.id); }
      if (req.body.role && u.id !== req.user.id) db.prepare('update users set role=? where id=?').run(req.body.role === 'admin' ? 'admin' : 'member', u.id);
      if (req.body.name) { db.prepare('update users set name=? where id=?').run(req.body.name, u.id); db.prepare('update people set name=? where id=?').run(req.body.name, u.person_id); }
      res.json({ ok: true });
    });
    app.delete('/api/users/:id', admin, (req, res) => {
      if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete yourself" });
      db.prepare('delete from sessions where user_id=?').run(req.params.id); db.prepare('delete from users where id=?').run(req.params.id); res.json({ ok: true });
    });
  }
  return { middleware, routes, createUser, easyPassword };
}
const current = () => als.getStore()?.user || null;
module.exports = { setup, current, easyPassword };
