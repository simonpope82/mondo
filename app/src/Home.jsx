import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Popover } from './ui.jsx';
import { fmtDate, todayStr, timeAgo } from './constants.js';
import { Bell, Plus } from 'lucide-react';
import { PushToggle } from './pwa.jsx';

export function Notifications() {
  const [list, setList] = useState([]); const [open, setOpen] = useState(false); const ref = useRef();
  const load = () => api.get('/notifications').then(setList).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); window.addEventListener('notif-refresh', load); return () => { clearInterval(t); window.removeEventListener('notif-refresh', load); }; }, []);
  const unread = list.filter((n) => !n.read).length;
  return <>
    <button ref={ref} className="icon-btn bell" onClick={() => { setOpen(true); load(); }} title="Notifications" data-testid="bell"><Bell size={20} />{unread > 0 && <span className="bell-n">{unread}</span>}</button>
    {open && <Popover anchor={ref.current} onClose={() => { setOpen(false); api.post('/notifications/read').then(load); }} width={360} align="right">
      <div className="mini-label">🔔 Notifications</div>
      <PushToggle />
      {!list.length && <div className="muted pad">Nothing new 🎉</div>}
      <div className="notif-list">{list.map((n) => <a key={n.id} className={'notif' + (n.read ? '' : ' unread')} href={n.url || '#/board/' + n.board_id} onClick={() => setOpen(false)}><span>{n.text}</span><span className="muted small">{timeAgo(n.created)}</span></a>)}</div>
    </Popover>}
  </>;
}

export default function Home({ ctx, user, onNewBoard }) {
  const [o, setO] = useState(null);
  useEffect(() => { api.get('/overview').then(setO); }, [ctx.boot]);
  const h = new Date().getHours();
  const hi = h < 10 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  if (!o) return <div className="loading">Loading…</div>;
  const total = o.boards.reduce((a, b) => a + b.total, 0), done = o.boards.reduce((a, b) => a + b.done, 0), late = o.boards.reduce((a, b) => a + b.overdue, 0);
  const ws = (id) => ctx.boot.workspaces.find((w) => w.id === id);
  return (
    <div className="home">
      <div className="home-hello"><div><h1>{hi}, {(user?.name || '').split(' ')[0]}! 👋</h1><p className="muted">Here is your work today.</p></div><button className="btn primary big" onClick={onNewBoard}><Plus size={18} /> New board</button></div>
      <div className="stat-row">
        <div className="stat" style={{ '--c': '#579bfc' }}><span className="stat-ico">📋</span><b>{o.boards.length}</b><span>Boards</span></div>
        <div className="stat" style={{ '--c': '#a25ddc' }}><span className="stat-ico">🧩</span><b>{total}</b><span>Items</span></div>
        <div className="stat" style={{ '--c': '#00c875' }}><span className="stat-ico">✅</span><b>{done}</b><span>Done</span></div>
        <div className="stat" style={{ '--c': '#e2445c' }}><span className="stat-ico">⏰</span><b>{late}</b><span>Late</span></div>
        <div className="stat" style={{ '--c': '#fdab3d' }}><span className="stat-ico">🙋</span><b>{o.myItems.length}</b><span>My items</span></div>
      </div>
      <div className="home-cols">
        <section className="home-card">
          <h2>🙋 My work</h2>
          {!o.myItems.length && <div className="muted pad">Nothing for you right now 🎉</div>}
          {o.myItems.slice(0, 12).map((it) => (
            <a key={it.id} className="my-item" href={'#/board/' + it.board_id}>
              <span className="dot" style={{ background: it.group?.color }} /><b className="grow">{it.name}</b>
              <span className="muted small">{it.icon} {it.board}</span>
              {it.status ? <span className="mini-pill" style={{ background: it.status.color }}>{it.status.label}</span> : <span className="mini-pill" style={{ background: '#c4c4c4' }}>—</span>}
              <span className={'date-text small' + (it.date && it.date < todayStr() ? ' late' : '')}>{it.date ? '📅 ' + fmtDate(it.date) : ''}</span>
            </a>
          ))}
        </section>
        <section className="home-card">
          <h2>📋 My boards</h2>
          <div className="board-cards">
            {o.boards.sort((a, b) => b.updated.localeCompare(a.updated)).map((b) => (
              <a key={b.id} className="board-card" href={'#/board/' + b.id} data-testid="board-card">
                <div className="bc-top"><span className="bc-icon">{b.icon}</span><div><b>{b.name}</b><div className="muted small">{ws(b.workspace_id)?.name} · {timeAgo(b.updated)} ago</div></div></div>
                <div className="battery big">{b.dist.map((d) => <span key={d.label} style={{ width: (d.n / Math.max(1, b.total)) * 100 + '%', background: d.color }} title={`${d.label}: ${d.n}`} />)}</div>
                <div className="bc-foot"><span>🧩 {b.total}</span><span>✅ {b.done}</span>{b.overdue > 0 && <span className="late">⏰ {b.overdue}</span>}</div>
              </a>
            ))}
            <button className="board-card add" onClick={onNewBoard}><Plus size={28} /><b>New board</b></button>
          </div>
        </section>
      </div>
    </div>
  );
}
