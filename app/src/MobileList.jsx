import React, { useState } from 'react';
import { Cell } from './Cells.jsx';
import { Avatar } from './ui.jsx';
import { fmtDate, todayStr } from './constants.js';
import { locText, dirUrl } from './Location.jsx';
import { ChevronDown, ChevronRight, MessageCircle, Plus, Navigation, Phone } from 'lucide-react';

// Phone layout: one card per item, like the monday mobile app
export default function MobileList({ groups, top, A, ctx }) {
  const b = ctx.board;
  const status = b.columns.filter((c) => c.type === 'status' || c.type === 'priority');
  const people = b.columns.filter((c) => c.type === 'people');
  const date = b.columns.find((c) => c.type === 'date') || b.columns.find((c) => c.type === 'timeline');
  // address / phone can come straight from the board or through a mirror of the linked customer (e.g. Kunde VIKTIG → Alle Kunder)
  const viaMirror = (type) => {
    for (const m of b.columns.filter((c) => c.type === 'mirror')) {
      const cc = b.columns.find((c) => c.id === m.settings.connectCol); const other = cc && ctx.linked?.[cc.settings.boardId];
      const src = other?.board.columns.find((c) => c.id === m.settings.colId);
      if (src?.type === type) return (it) => { const li = other.items.find((i) => i.id === (it.vals[cc.id] || [])[0]); return li?.vals[src.id]; };
    }
    return null;
  };
  const own = (type) => { const c = b.columns.find((x) => x.type === type); return c ? (it) => it.vals[c.id] : viaMirror(type); };
  const locOf = own('location'), phoneOf = own('phone');
  const [adding, setAdding] = useState({});
  return (
    <div className="m-list" data-testid="mobile-list">
      {groups.map((g) => {
        const its = top.filter((i) => i.group_id === g.id);
        if (ctx.filtering && !its.length) return null;
        return (
          <section key={g.id} className="m-group" style={{ '--gc': g.color }}>
            <button className="m-group-head" onClick={() => A.updateGroup({ ...g, collapsed: !g.collapsed })} data-testid="m-group">
              {g.collapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}<b>{g.name}</b><span className="m-count">{its.length}</span>
            </button>
            {!g.collapsed && <>
              {its.map((it) => {
                const ppl = [...new Set(people.flatMap((c) => it.vals[c.id] || []))];
                const dv = date && it.vals[date.id]; const d = date?.type === 'timeline' ? dv?.from : dv;
                const subs = (ctx.subsByParent[it.id] || []).length; const nUp = ctx.updateCounts[it.id] || 0;
                const lv = locOf && locOf(it); const pv = phoneOf && phoneOf(it);
                return (
                  <article key={it.id} className="m-card" data-testid="m-card">
                    <div className="m-top" onClick={() => A.openItem(it.id)} data-testid="m-open">
                      <b className="m-name">{it.name}</b>
                      <span className="m-icons">{subs > 0 && <span className="m-sub">↳ {subs}</span>}{nUp > 0 && <span className="m-up"><MessageCircle size={14} /> {nUp}</span>}</span>
                    </div>
                    {status.slice(0, 2).map((c) => (
                      <div key={c.id} className="m-status"><span className="m-label">{c.title}</span>
                        <div className="m-pill"><Cell col={c} value={it.vals[c.id]} ctx={{ ...ctx, item: it, groupColor: g.color }} onChange={(v) => A.updateItem(it.id, { vals: { [c.id]: v } })} onUpdateColumn={(nc) => A.updateColumn(nc)} /></div></div>
                    ))}
                    <div className="m-meta">
                      {ppl.length > 0 && <span className="avatars">{ppl.slice(0, 3).map((id) => <Avatar key={id} person={ctx.people.find((p) => p.id === id)} size={26} ring />)}</span>}
                      {d && <span className={'date-text' + (d < todayStr() && !ctx.doneOf(it) ? ' late' : '')}>📅 {fmtDate(d)}</span>}
                      <span className="grow" />
                      {pv && <a className="m-act" href={'tel:' + String(pv).replace(/\s/g, '')} title="Call" data-testid="m-call"><Phone size={16} /></a>}
                      {locText(lv) && <a className="m-act blue" href={dirUrl(lv)} target="_blank" rel="noreferrer" title="Directions" data-testid="m-directions"><Navigation size={16} /></a>}
                    </div>
                    {locText(lv) && <div className="m-loc small muted">📍 {locText(lv)}</div>}
                  </article>
                );
              })}
              {adding[g.id] != null ? (
                <input className="m-add-input" autoFocus placeholder="Item name" value={adding[g.id]} onChange={(e) => setAdding({ ...adding, [g.id]: e.target.value })} data-testid="m-add-input"
                  onKeyDown={(e) => { if (e.key === 'Enter' && adding[g.id].trim()) { A.addItem(g.id, adding[g.id].trim()); setAdding({ ...adding, [g.id]: '' }); } }}
                  onBlur={() => { if (adding[g.id].trim()) A.addItem(g.id, adding[g.id].trim()); setAdding({ ...adding, [g.id]: undefined }); }} />
              ) : <button className="m-add" onClick={() => setAdding({ ...adding, [g.id]: '' })} data-testid="m-add"><Plus size={16} /> Add item</button>}
            </>}
          </section>
        );
      })}
      <button className="add-group-btn" onClick={() => A.addGroup(false)}><Plus size={16} /> Add group</button>
    </div>
  );
}
