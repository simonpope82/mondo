async function j(method, url, body) {
  const r = await fetch('/api' + url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('mondo-logout'));
  if (!r.ok) { let m = await r.text(); try { m = JSON.parse(m).error || m; } catch {} throw new Error(m); }
  return r.json();
}
export const api = { get: (u) => j('GET', u), post: (u, b) => j('POST', u, b || {}), patch: (u, b) => j('PATCH', u, b), put: (u, b) => j('PUT', u, b), del: (u) => j('DELETE', u) };
export const uid = (p = 'x') => p + '_' + Math.random().toString(36).slice(2, 9);
