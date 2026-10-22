// 🔑 Forgot password for staff (users) and customers (cust_users, Min side).
// Single-use token, stored only as sha256, 30 min (admin-created links up to 2 h). Neutral answers (no account enumeration), rate-limited.
// Delivery: real e-mail via SMTP env (SMTP_HOST/PORT/USER/PASS/FROM) if set; otherwise logged + saved as draft in Utboks (admin can copy the link).
// SMS only via provider env (SMS_PROVIDER – none implemented yet) → otherwise draft.
const crypto = require('crypto'); const bcrypt = require('bcryptjs');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const TTL = 30 * 60000, MAX_TTL = 2 * 3600000;
const NEUTRAL = { staff: 'If an account exists for that email, we have sent a link to reset the password. The link is valid for 30 minutes.', cust: 'Hvis vi finner deg, sender vi en lenke for nytt passord. Lenken gjelder i 30 minutter.' };
module.exports.setup = function setup(db) {
  db.exec(`create table if not exists pw_resets(token_hash text primary key, kind text, uid text, created integer, expires integer, used integer);
    create table if not exists dk_outbox(id integer primary key autoincrement, kind text, to_addr text, subject text, body text, attachment text, board_id text, item_id text, status text, created text)`);
  const hits = new Map(); setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (v.until < t) hits.delete(k); db.prepare('delete from pw_resets where expires < ?').run(t - 86400000); }, 60000).unref();
  const limited = (key, max) => { const t = Date.now(); const h = hits.get(key); const n = h && h.until > t ? h.n + 1 : 1; hits.set(key, { n, until: h && h.until > t ? h.until : t + 15 * 60000 }); return n > max; };
  const smtpOn = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const base = (req) => (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  function create(kind, uid, req, ttl = TTL) {
    db.prepare('update pw_resets set used=1 where kind=? and uid=? and used=0').run(kind, uid); // only newest link works
    const tok = crypto.randomBytes(32).toString('base64url'); const t = Date.now(); const exp = t + Math.min(Math.max(ttl, 60000), MAX_TTL);
    db.prepare('insert into pw_resets values(?,?,?,?,?,0)').run(sha(tok), kind, uid, t, exp);
    return { link: `${base(req)}/reset?token=${tok}`, expires: new Date(exp).toISOString() };
  }
  async function deliver({ to, subject, text, kind }) {
    if (kind === 'email' && to && smtpOn()) {
      try {
        const nm = require('nodemailer'); const port = +process.env.SMTP_PORT || 587;
        await nm.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }).sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
        db.prepare('insert into dk_outbox(kind,to_addr,subject,body,status,created) values(?,?,?,?,?,?)').run('reset', to, subject, '[sendt på e-post – lenken vises ikke her]', 'Sendt (SMTP)', new Date().toISOString()); return 'sent';
      } catch (e) { console.warn('reset mail failed', e.message); }
    }
    console.log(`🔑 password reset (${kind}) for ${to || '?'} – not sent, saved as draft in Utboks`);
    db.prepare('insert into dk_outbox(kind,to_addr,subject,body,status,created) values(?,?,?,?,?,?)').run(kind === 'sms' ? 'sms' : 'reset', to || '', subject, text, kind === 'sms' ? 'Utkast – SMS-leverandør ikke satt opp' : 'Utkast – SMTP ikke satt opp (kopier lenken)', new Date().toISOString()); return 'draft';
  }
  const staffText = (u, l) => ({ subject: 'Reset your mondo password', text: `Hi ${u.name || ''}!\n\nSomeone asked to reset the password for ${u.email}.\nOpen this link within 30 minutes to choose a new password:\n${l.link}\n\nIf it wasn't you, ignore this email – your password stays the same.` });
  const custText = (l) => ({ subject: 'Nytt passord – Min side', text: `Hei!\n\nDu (eller noen) ba om nytt passord til Min side.\nÅpne lenken innen 30 minutter for å velge nytt passord:\n${l.link}\n\nVar det ikke deg? Da kan du se bort fra denne meldingen.` });
  const normLogin = (s) => { s = String(s || '').trim().toLowerCase(); return s.includes('@') ? s : s.replace(/\D/g, '').slice(-8); };
  const custEmail = (cu) => {
    if (cu.login.includes('@')) return cu.login;
    try { const r = db.prepare('select vals, board_id from items where id=?').get(cu.customer_id); const b = r && db.prepare('select columns from boards where id=?').get(r.board_id); const col = b && JSON.parse(b.columns).find((c) => c.title === 'E-post'); const v = col && JSON.parse(r.vals)[col.id]; return v ? String(v) : ''; } catch { return ''; }
  };
  function routes(app, admin) {
    const later = (res, body) => setTimeout(() => res.json(body), 300 + crypto.randomInt(300)); // same timing whether or not the account exists
    app.post('/api/auth/forgot', (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 200);
      if (limited('ip|' + req.ip, 10) || limited('e|' + email, 3)) return res.status(429).json({ error: 'Too many tries. Wait 15 min.' });
      const u = email && db.prepare('select id,email,name from users where email=?').get(email);
      if (u) { const l = create('staff', u.id, req); deliver({ to: u.email, kind: 'email', ...staffText(u, l) }).catch(() => {}); }
      later(res, { ok: true, message: NEUTRAL.staff });
    });
    app.post('/api/portal/forgot', (req, res) => {
      const login = normLogin(req.body?.login);
      if (limited('ip|' + req.ip, 10) || limited('c|' + login, 3)) return res.status(429).json({ error: 'For mange forsøk. Vent 15 minutter.' });
      const cu = login && db.prepare('select id, customer_id, login from cust_users where login=?').get(login);
      if (cu) {
        const l = create('cust', cu.id, req); const m = custText(l); const em = custEmail(cu);
        if (em) deliver({ to: em, kind: 'email', ...m }).catch(() => {});
        else deliver({ to: cu.login, kind: 'sms', subject: m.subject, text: `Nytt passord til Min side (gjelder 30 min): ${l.link}` }).catch(() => {}); // SMS provider not set up → draft
      }
      later(res, { ok: true, message: NEUTRAL.cust });
    });
    const find = (tok) => { const r = tok && db.prepare('select * from pw_resets where token_hash=?').get(sha(String(tok))); return r && !r.used && r.expires > Date.now() ? r : null; };
    app.get('/api/auth/reset/check', (req, res) => { if (limited('chk|' + req.ip, 30)) return res.status(429).json({ error: 'Too many tries' }); const r = find(req.query.token); res.json(r ? { ok: true, kind: r.kind, expires: new Date(r.expires).toISOString() } : { ok: false }); });
    app.post('/api/auth/reset', (req, res) => {
      if (limited('rs|' + req.ip, 10)) return res.status(429).json({ error: 'Too many tries. Wait 15 min.' });
      const pw = String(req.body?.password || ''); if (pw.length < 8) return res.status(400).json({ error: 'Passordet må ha minst 8 tegn / Password must be 8+ characters' });
      if (pw.length > 200) return res.status(400).json({ error: 'Too long' });
      const r = find(req.body?.token); if (!r) return res.status(400).json({ error: 'Lenken er ugyldig eller utløpt. Be om en ny. / The link is invalid or expired.' });
      const h = bcrypt.hashSync(pw, 12);
      db.transaction(() => {
        db.prepare('update pw_resets set used=1 where token_hash=?').run(r.token_hash);
        db.prepare('update pw_resets set used=1 where kind=? and uid=?').run(r.kind, r.uid);
        if (r.kind === 'staff') { db.prepare('update users set pass_hash=? where id=?').run(h, r.uid); db.prepare('delete from sessions where user_id=?').run(r.uid); }
        else { db.prepare('update cust_users set pass_hash=? where id=?').run(h, r.uid); db.prepare('delete from cust_sessions where cust_user_id=?').run(r.uid); }
      })();
      res.json({ ok: true, kind: r.kind });
    });
    // admin: make a link for a staff user (shown once) + list pending drafted links
    app.post('/api/users/:id/reset-link', admin, (req, res) => {
      const u = db.prepare('select id,email from users where id=?').get(req.params.id); if (!u) return res.status(404).json({ error: 'not found' });
      const hours = Math.min(2, Math.max(0.5, +req.body?.hours || 0.5)); res.json({ email: u.email, ...create('staff', u.id, req, hours * 3600000) });
    });
    app.get('/api/users/reset-drafts', admin, (req, res) => res.json(db.prepare("select id, kind, to_addr, subject, body, status, created from dk_outbox where kind in ('reset','sms') and (subject like '%password%' or subject like '%passord%') and created > ? order by id desc limit 20").all(new Date(Date.now() - 2 * 3600000).toISOString()).map((x) => ({ ...x, link: (String(x.body).match(/https?:\/\/\S+\/reset\?token=[\w-]+/) || [])[0] || null }))));
  }
  return { routes, smtpOn };
};
