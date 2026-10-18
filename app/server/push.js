// Web push (VAPID). Keys from env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; if missing they are generated once and kept in DATA_DIR/vapid.json.
const fs = require('fs'); const path = require('path');
let webpush = null; try { webpush = require('web-push'); } catch {}
function setup(db, DATA_DIR) {
  db.exec('create table if not exists push_subs(endpoint text primary key, person text, keys text, ua text, created text)');
  let keys = null;
  if (webpush) {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    else {
      const f = path.join(DATA_DIR, 'vapid.json');
      try { keys = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { keys = webpush.generateVAPIDKeys(); fs.writeFileSync(f, JSON.stringify(keys), { mode: 0o600 }); }
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:' + (process.env.ADMIN_EMAIL || 'admin@example.com'), keys.publicKey, keys.privateKey);
  }
  const enabled = !!(webpush && keys);
  async function send(person, payload) {
    if (!enabled) return;
    for (const s of db.prepare('select * from push_subs where person=?').all(person)) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify(payload), { TTL: 3600 }); }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) db.prepare('delete from push_subs where endpoint=?').run(s.endpoint); else console.warn('push failed', e.statusCode || e.message); }
    }
  }
  function routes(app, me) {
    app.get('/api/push/key', (req, res) => res.json({ enabled, publicKey: enabled ? keys.publicKey : null }));
    app.post('/api/push/subscribe', (req, res) => {
      const s = req.body || {}; if (!s.endpoint || !s.keys || !/^https:\/\//.test(s.endpoint)) return res.status(400).json({ error: 'bad subscription' });
      db.prepare('insert or replace into push_subs values(?,?,?,?,?)').run(s.endpoint, me(), JSON.stringify(s.keys), String(req.headers['user-agent'] || '').slice(0, 200), new Date().toISOString());
      res.json({ ok: true });
    });
    app.post('/api/push/unsubscribe', (req, res) => { db.prepare('delete from push_subs where endpoint=? and person=?').run(req.body?.endpoint || '', me()); res.json({ ok: true }); });
    app.post('/api/push/test', (req, res) => { send(me(), { title: 'mondo 🔔', body: 'Push works!', url: '/#/home' }); res.json({ ok: true }); });
  }
  return { send, routes, enabled };
}
module.exports = { setup };
