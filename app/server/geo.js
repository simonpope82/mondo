// Address search via OpenStreetMap Nominatim: max 1 request/second, proper User-Agent, results cached in SQLite.
function setup(db) {
  db.exec('create table if not exists geocache(q text primary key, results text, created text)');
  // Nominatim needs a real contact in the User-Agent (example.com addresses are refused with 403)
  const UA = process.env.GEOCODE_USER_AGENT || `mondo-work-app/1.0 (${process.env.GEOCODE_CONTACT || process.env.ADMIN_EMAIL || 'contact-not-set'})`;
  let last = 0; let chain = Promise.resolve();
  const slot = () => (chain = chain.then(async () => { const wait = last + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last = Date.now(); }));
  async function search(q, countries) {
    q = String(q || '').trim().slice(0, 200); if (q.length < 3) return [];
    const key = q.toLowerCase() + '|' + (countries || '');
    const hit = db.prepare('select results from geocache where q=?').get(key);
    if (hit) return JSON.parse(hit.results);
    await slot();
    const u = new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('q', q); u.searchParams.set('format', 'jsonv2'); u.searchParams.set('limit', '5');
    if (countries) u.searchParams.set('countrycodes', countries);
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'nb,en' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('geocode ' + r.status);
    const out = (await r.json()).map((x) => ({ address: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
    db.prepare('insert or replace into geocache values(?,?,?)').run(key, JSON.stringify(out), new Date().toISOString());
    return out;
  }
  function routes(app) {
    app.get('/api/geocode', async (req, res) => {
      try { res.json(await search(req.query.q, req.query.cc === 'all' ? '' : (req.query.cc || process.env.GEOCODE_COUNTRIES || 'no,se,dk'))); }
      catch (e) { console.warn('geocode failed', e.message); res.status(502).json({ error: 'Address search is not available right now' }); }
    });
  }
  return { routes, search };
}
module.exports = { setup };
