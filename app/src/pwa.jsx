import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { X, Download, Share } from 'lucide-react';

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.hostname === 'localhost' && location.port === '5173') return; // not in vite dev
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('sw', e)));
}
export function clearOfflineData() { try { navigator.serviceWorker?.controller?.postMessage('clear-data'); caches?.delete('mondo-data-v1'); } catch {} }

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

let deferred = null; const subs = new Set();
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()); });
window.addEventListener('appinstalled', () => { deferred = null; localStorage.setItem('install-done', '1'); subs.forEach((f) => f()); });

export function useInstall() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  const canPrompt = !!deferred;
  const ios = isIOS() && !isStandalone();
  return { canPrompt, ios, installed: isStandalone(), install: async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; tick((x) => x + 1); } };
}

export function InstallBanner() {
  const { canPrompt, ios, installed, install } = useInstall();
  const [hide, setHide] = useState(localStorage.getItem('install-hide') === '1');
  if (installed || hide || (!canPrompt && !ios)) return null;
  const close = () => { localStorage.setItem('install-hide', '1'); setHide(true); };
  return (
    <div className="install-banner" data-testid="install-banner">
      <img src="/icon-192.png" alt="" />
      <div className="grow">
        <b>Get the mondo app 📲</b>
        {ios ? <span>Tap <Share size={14} /> <b>Share</b>, then <b>“Add to Home Screen”</b>.</span> : <span>Full screen, on your home screen.</span>}
      </div>
      {!ios && <button className="btn primary" onClick={install} data-testid="install-btn"><Download size={16} /> Install</button>}
      <button className="icon-btn" onClick={close} title="Not now"><X size={18} /></button>
    </div>
  );
}

// ---- web push ----
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// After a server restart with fresh keys (Render free plan) an old browser subscription no longer matches – detect that.
const sameKey = (sub, publicKey) => { try { const a = new Uint8Array(sub.options.applicationServerKey), b = b64(publicKey); return a.length === b.length && a.every((x, i) => x === b[i]); } catch { return true; } };
export async function pushState() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  const { enabled, publicKey } = await api.get('/push/key'); if (!enabled) return 'server-off';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub || !sameKey(sub, publicKey)) return 'off';
  api.post('/push/subscribe', sub.toJSON()).catch(() => {}); // re-register in case the server's database was reset
  return 'on';
}
export async function enablePush() {
  const perm = await Notification.requestPermission(); if (perm !== 'granted') return 'denied';
  const { publicKey } = await api.get('/push/key');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, publicKey)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
  await api.post('/push/subscribe', sub.toJSON()); return 'on';
}
export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { await api.post('/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); } return 'off';
}
export function PushToggle() {
  const [st, setSt] = useState('…');
  useEffect(() => { pushState().then(setSt).catch(() => setSt('unsupported')); }, []);
  const label = { on: '🔔 Phone alerts are ON', off: '🔕 Turn on phone alerts', denied: '🚫 Alerts blocked in browser settings', unsupported: 'Phone alerts not supported here', 'server-off': 'Alerts not set up on server', 'ios-install': '📲 Add to Home Screen first to get alerts', '…': '…' }[st];
  const can = st === 'on' || st === 'off';
  return <button className={'push-toggle' + (st === 'on' ? ' on' : '')} disabled={!can} data-testid="push-toggle"
    onClick={async () => { try { setSt(st === 'on' ? await disablePush() : await enablePush()); } catch (e) { console.warn(e); setSt('unsupported'); } }}>{label}</button>;
}

export function OfflineBar() {
  const [off, setOff] = useState(!navigator.onLine);
  useEffect(() => { const a = () => setOff(false), b = () => setOff(true); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []);
  if (!off) return null;
  return <div className="offline-bar" data-testid="offline-bar">📴 Offline – you can look, but changes are not saved</div>;
}
