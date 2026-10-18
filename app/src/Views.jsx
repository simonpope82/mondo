import React, { useEffect, useRef, useState } from 'react';
import { Avatar, dialog } from './ui.jsx';
import { fmtDate, todayStr } from './constants.js';
import { displayValue } from './Cells.jsx';
import { ChevronLeft, ChevronRight, Plus, MessageCircle } from 'lucide-react';

function ColPicker({ label, cols, value, onChange }) {
  if (cols.length < 2) return null;
  return <label className="col-picker">{label} <select value={value} onChange={(e) => onChange(e.target.value)}>{cols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>;
}

function Card({ it, ctx, A, draggable = true, small }) {
  const g = ctx.board.groups.find((x) => x.id === it.group_id);
  const ppl = ctx.board.columns.filter((c) => c.type === 'people').flatMap((c) => it.vals[c.id] || []);
  const date = ctx.board.columns.find((c) => c.type === 'date');
  const nUp = ctx.updateCounts[it.id] || 0;
  const extra = ctx.board.columns.filter((c) => ['status', 'priority', 'dropdown'].includes(c.type) && c.id !== ctx.view.settings?.col).slice(0, 2);
  return (
    <div data-item={it.id} className={'card' + (small ? ' small' : '')} draggable={draggable} onDragStart={(e) => e.dataTransfer.setData('text/item', it.id)} onClick={() => A.openItem(it.id)} style={{ borderLeftColor: g?.color }} data-testid="card">
      <div className="card-name">{it.name}</div>
      {!small && <>
        <div className="card-meta">
          {extra.map((c) => { const v = it.vals[c.id]; if (!v) return null; const l = c.settings.labels?.find((x) => x.id === v); return l ? <span key={c.id} className="mini-pill" style={{ background: l.color }}>{l.label}</span> : <span key={c.id} className="tag">{displayValue(c, v, ctx.people)}</span>; })}
        </div>
        <div className="card-foot">
          <div className="avatars">{[...new Set(ppl)].slice(0, 3).map((id) => <Avatar key={id} person={ctx.people.find((p) => p.id === id)} size={22} ring />)}</div>
          {date && it.vals[date.id] && <span className={'date-text small' + (it.vals[date.id] < todayStr() && !ctx.doneOf(it) ? ' late' : '')}>📅 {fmtDate(it.vals[date.id])}</span>}
          {nUp > 0 && <span className="small muted"><MessageCircle size={12} /> {nUp}</span>}
        </div>
      </>}
    </div>
  );
}

export function KanbanView({ top, A, ctx }) {
  const cols = ctx.board.columns.filter((c) => c.type === 'status' || c.type === 'priority');
  const col = cols.find((c) => c.id === ctx.view.settings?.col) || cols[0];
  const [over, setOver] = useState(null);
  const [wrapEl, setWrapEl] = useState(null); const dropRef = useRef(); dropRef.current = (id, lane) => A.updateItem(id, { vals: { [col.id]: lane === '' ? null : lane } });
  useTouchDrag(wrapEl, (id, lane) => dropRef.current(id, lane), setOver);
  if (!col) return <Empty text="Add a Status column to use Kanban 🗂️" />;
  const lanes = [...col.settings.labels.filter((l) => l.label !== ''), { id: null, label: 'Blank', color: '#c4c4c4' }];
  return (
    <div className="kanban-wrap" ref={setWrapEl}>
      <ColPicker label="Lanes by" cols={cols} value={col.id} onChange={(v) => A.patchView({ settings: { col: v } })} />
      <div className="kanban">
        {lanes.map((l) => {
          const its = top.filter((i) => (i.vals[col.id] || null) === l.id || (l.id === null && !col.settings.labels.some((x) => x.id === i.vals[col.id] && x.label)));
          return (
            <div key={l.id || 'blank'} data-lane={l.id || ''} className={'lane' + (over === l.id ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(l.id); }} onDragLeave={() => setOver(undefined)}
              onDrop={(e) => { e.preventDefault(); setOver(undefined); const id = e.dataTransfer.getData('text/item'); if (id) A.updateItem(id, { vals: { [col.id]: l.id } }); }} data-testid="lane">
              <div className="lane-head" style={{ background: l.color }}>{l.label} <span>{its.length}</span></div>
              <div className="lane-body">
                {its.map((it) => <Card key={it.id} it={it} ctx={ctx} A={A} />)}
                <button className="lane-add" onClick={async () => { const n = await dialog.prompt('New item name', 'New item'); if (n) A.addItem(ctx.board.groups[0]?.id, n, null, l.id ? { [col.id]: l.id } : null); }}><Plus size={14} /> Add item</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function CalendarView({ top, A, ctx }) {
  const cols = ctx.board.columns.filter((c) => c.type === 'date' || c.type === 'timeline');
  const col = cols.find((c) => c.id === ctx.view.settings?.col) || cols[0];
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  if (!col) return <Empty text="Add a Date column to use the Calendar 📅" />;
  const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, k) => { const d = new Date(start); d.setDate(start.getDate() + k); return d; });
  const dateOf = (it) => { const v = it.vals[col.id]; return col.type === 'timeline' ? v?.from : v; };
  const today = todayStr();
  const status = ctx.board.columns.find((c) => c.type === 'status');
  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button>
        <h2>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button>
        <button className="btn small" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</button>
        <ColPicker label="Date from" cols={cols} value={col.id} onChange={(v) => A.patchView({ settings: { col: v } })} />
      </div>
      <div className="cal-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {days.map((d) => {
          const ds = dstr(d); const its = top.filter((i) => dateOf(i) === ds);
          return (
            <div key={ds} className={'cal-day' + (d.getMonth() !== month.getMonth() ? ' other' : '') + (ds === today ? ' today' : '')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData('text/item'); if (!id) return; const it = top.find((i) => i.id === id); if (col.type === 'timeline') { const v = it.vals[col.id] || {}; const len = v.from && v.to ? (new Date(v.to) - new Date(v.from)) : 0; const to = new Date(new Date(ds).getTime() + len); A.updateItem(id, { vals: { [col.id]: { from: ds, to: dstr(to) } } }); } else A.updateItem(id, { vals: { [col.id]: ds } }); }}>
              <div className="cal-num">{d.getDate()}<button className="icon-btn tiny hover-show" onClick={async () => { const n = await dialog.prompt(`New item on ${fmtDate(ds)}`, 'New item'); if (n) A.addItem(ctx.board.groups[0]?.id, n, null, { [col.id]: col.type === 'timeline' ? { from: ds, to: ds } : ds }); }}><Plus size={13} /></button></div>
              {its.map((it) => { const l = status?.settings.labels.find((x) => x.id === it.vals[status.id]); return <div key={it.id} className="cal-item" draggable onDragStart={(e) => e.dataTransfer.setData('text/item', it.id)} onClick={() => A.openItem(it.id)} style={{ background: l?.color || ctx.board.groups.find((g) => g.id === it.group_id)?.color }}>{it.name}</div>; })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineView({ top, A, ctx }) {
  const cols = ctx.board.columns.filter((c) => c.type === 'timeline' || c.type === 'date');
  const col = cols.find((c) => c.id === ctx.view.settings?.col) || cols[0];
  const [offset, setOffset] = useState(-7);
  if (!col) return <Empty text="Add a Timeline or Date column 📊" />;
  const DAYW = 34, N = 49;
  const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() + offset);
  const days = Array.from({ length: N }, (_, k) => { const d = new Date(base); d.setDate(base.getDate() + k); return d; });
  const idx = (s) => Math.round((new Date(s + 'T00:00:00') - base) / 86400000);
  const range = (it) => { const v = it.vals[col.id]; if (!v) return null; return col.type === 'timeline' ? (v.from ? [v.from, v.to || v.from] : null) : [v, v]; };
  return (
    <div className="timeline">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setOffset(offset - 14)}><ChevronLeft /></button>
        <button className="btn small" onClick={() => setOffset(-7)}>Today</button>
        <button className="icon-btn" onClick={() => setOffset(offset + 14)}><ChevronRight /></button>
        <ColPicker label="Bars from" cols={cols} value={col.id} onChange={(v) => A.patchView({ settings: { col: v } })} />
      </div>
      <div className="tl-scroll">
        <div className="tl-grid" style={{ width: 220 + DAYW * N }}>
          <div className="tl-row tl-days"><div className="tl-label" />{days.map((d, k) => <div key={k} className={'tl-day' + (dstr(d) === todayStr() ? ' today' : '') + ([0, 6].includes(d.getDay()) ? ' wkend' : '')} style={{ width: DAYW }}>{d.getDate() === 1 || k === 0 ? <b>{d.toLocaleDateString('en-GB', { month: 'short' })}</b> : null}<span>{d.getDate()}</span></div>)}</div>
          {ctx.board.groups.map((g) => {
            const its = top.filter((i) => i.group_id === g.id); if (!its.length) return null;
            return (
              <React.Fragment key={g.id}>
                <div className="tl-row tl-group" style={{ color: g.color }}><div className="tl-label"><b>{g.name}</b></div></div>
                {its.map((it) => {
                  const r = range(it);
                  const a = r ? idx(r[0]) : 0, b = r ? idx(r[1]) : 0;
                  return (
                    <div key={it.id} className="tl-row">
                      <div className="tl-label" onClick={() => A.openItem(it.id)}>{it.name}</div>
                      <div className="tl-track" style={{ width: DAYW * N }}>
                        {days.map((d, k) => [0, 6].includes(d.getDay()) && <div key={k} className="tl-wk" style={{ left: k * DAYW, width: DAYW }} />)}
                        {r && b >= 0 && a < N && <div className="tl-bar" onClick={() => A.openItem(it.id)} style={{ left: Math.max(0, a) * DAYW + 2, width: (Math.min(N - 1, b) - Math.max(0, a) + 1) * DAYW - 4, background: g.color }} title={`${fmtDate(r[0])} – ${fmtDate(r[1])}`}>{it.name}</div>}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
          <div className="tl-today" style={{ left: 220 + idx(todayStr()) * DAYW + DAYW / 2 }} />
        </div>
      </div>
    </div>
  );
}

export function ChartView({ top, A, ctx }) {
  const cols = ctx.board.columns.filter((c) => ['status', 'priority', 'people', 'dropdown'].includes(c.type));
  const opts = [{ id: '__group', title: 'Group' }, ...cols];
  const key = ctx.view.settings?.col || cols[0]?.id || '__group';
  const col = cols.find((c) => c.id === key);
  let bars = [];
  if (key === '__group') bars = ctx.board.groups.map((g) => ({ label: g.name, color: g.color, n: top.filter((i) => i.group_id === g.id).length }));
  else if (col.type === 'status' || col.type === 'priority') bars = [...col.settings.labels.filter((l) => l.label).map((l) => ({ label: l.label, color: l.color, n: top.filter((i) => i.vals[col.id] === l.id).length })), { label: 'Blank', color: '#c4c4c4', n: top.filter((i) => !col.settings.labels.some((l) => l.label && l.id === i.vals[col.id])).length }];
  else if (col.type === 'people') bars = ctx.people.map((p) => ({ label: p.name, color: p.color, n: top.filter((i) => (i.vals[col.id] || []).includes(p.id)).length }));
  else bars = col.settings.options.map((o, k) => ({ label: o.label, color: ['#579bfc', '#a25ddc', '#00c875', '#fdab3d', '#e2445c', '#ff642e'][k % 6], n: top.filter((i) => (i.vals[col.id] || []).includes(o.id)).length }));
  bars = bars.filter((b) => b.n > 0);
  const max = Math.max(1, ...bars.map((b) => b.n)); const total = bars.reduce((a, b) => a + b.n, 0);
  let acc = 0; const conic = bars.map((b) => { const s = (acc / Math.max(1, total)) * 360; acc += b.n; return `${b.color} ${s}deg ${(acc / Math.max(1, total)) * 360}deg`; }).join(',');
  return (
    <div className="chart-view">
      <label className="col-picker">Count by <select value={key} onChange={(e) => A.patchView({ settings: { col: e.target.value } })}>{opts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <div className="chart-row">
        <div className="chart-card">
          <h3>📊 Items by {opts.find((o) => o.id === key)?.title}</h3>
          <div className="bars">{bars.map((b) => <div key={b.label} className="bar-col"><span className="bar-n">{b.n}</span><div className="bar" style={{ height: (b.n / max) * 200, background: b.color }} /><span className="bar-l">{b.label}</span></div>)}</div>
        </div>
        <div className="chart-card">
          <h3>🍩 Share</h3>
          <div className="donut" style={{ background: total ? `conic-gradient(${conic})` : '#eee' }}><div><b>{total}</b><span>items</span></div></div>
          <div className="legend">{bars.map((b) => <span key={b.label}><i style={{ background: b.color }} />{b.label} · {Math.round((b.n / Math.max(1, total)) * 100)}%</span>)}</div>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) { return <div className="empty-view">{text}</div>; }

// Long-press (300 ms) then drag a card with a finger; drop on a lane to change status.
function useTouchDrag(root, onDrop, setOver) {
  useEffect(() => {
    if (!root) return;
    let st = null; // {id, el, x, y, timer, ghost, active, dx, dy}
    const laneAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('[data-lane]'); };
    const end = () => { if (!st) return; clearTimeout(st.timer); st.ghost?.remove(); st.el?.classList.remove('dragging-src'); clearInterval(st.scroll); if (st.k) st.k.style.scrollSnapType = ''; st = null; setOver(undefined); };
    const start = (e) => {
      const card = e.target.closest('[data-item]'); if (!card || e.touches.length !== 1) return;
      const t = e.touches[0];
      st = { id: card.dataset.item, el: card, x: t.clientX, y: t.clientY, active: false };
      st.timer = setTimeout(() => {
        if (!st) return; st.active = true; navigator.vibrate?.(30);
        const r = card.getBoundingClientRect(); st.dx = st.x - r.left; st.dy = st.y - r.top;
        const g = card.cloneNode(true); g.classList.add('touch-ghost'); g.style.width = r.width + 'px'; g.style.left = r.left + 'px'; g.style.top = r.top + 'px';
        document.body.appendChild(g); st.ghost = g; card.classList.add('dragging-src');
        const k = root.querySelector('.kanban'); if (k) { k.style.scrollSnapType = 'none'; st.k = k; } // snapping would undo the small auto-scroll steps
        st.scroll = setInterval(() => { if (!st || !k) return; if (st.lx > window.innerWidth - 40) k.scrollLeft += 12; if (st.lx < 40) k.scrollLeft -= 12; }, 30);
      }, 300);
    };
    const move = (e) => {
      if (!st) return; const t = e.touches[0];
      if (!st.active) { if (Math.hypot(t.clientX - st.x, t.clientY - st.y) > 8) { clearTimeout(st.timer); st = null; } return; }
      e.preventDefault(); st.lx = t.clientX; st.ly = t.clientY;
      st.ghost.style.left = t.clientX - st.dx + 'px'; st.ghost.style.top = t.clientY - st.dy + 'px';
      const lane = laneAt(t.clientX, t.clientY); setOver(lane ? (lane.dataset.lane || null) : undefined);
    };
    const up = (e) => {
      if (!st) return;
      if (st.active) { e.preventDefault(); const lane = laneAt(st.lx ?? st.x, st.ly ?? st.y); const id = st.id; end(); if (lane) onDrop(id, lane.dataset.lane); }
      else end();
    };
    const ctxmenu = (e) => { if (st) e.preventDefault(); };
    root.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up, { passive: false });
    document.addEventListener('touchcancel', end);
    root.addEventListener('contextmenu', ctxmenu);
    return () => { root.removeEventListener('touchstart', start); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up); document.removeEventListener('touchcancel', end); root.removeEventListener('contextmenu', ctxmenu); end(); };
  }, [root]); // onDrop/setOver must be stable (refs / state setters)
}
