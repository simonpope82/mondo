import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Avatar, EditableText, dialog } from './ui.jsx';
import { Cell } from './Cells.jsx';
import { COLUMN_TYPES, timeAgo } from './constants.js';
import { X, Trash2, MessageCircle, Info, Activity, Send, Reply, AtSign } from 'lucide-react';

export function renderBody(body, people) {
  const names = people.map((p) => p.name).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!names.length) return body;
  const re = new RegExp('@(' + names.join('|') + ')', 'g');
  const out = []; let last = 0; let m;
  while ((m = re.exec(body))) { out.push(body.slice(last, m.index)); out.push(<span key={m.index} className="mention">@{m[1]}</span>); last = m.index + m[0].length; }
  out.push(body.slice(last)); return out;
}

export function MentionBox({ people, onSend, placeholder = 'Write an update… use @ to mention', compact }) {
  const [v, setV] = useState('');
  const [q, setQ] = useState(null);
  const ta = useRef();
  const onChange = (e) => { const t = e.target.value; setV(t); const before = t.slice(0, e.target.selectionStart); const m = before.match(/@([\p{L} ]{0,20})$/u); setQ(m ? m[1] : null); };
  const pick = (p) => { const pos = ta.current.selectionStart; const before = v.slice(0, pos).replace(/@([\p{L} ]{0,20})$/u, '@' + p.name + ' '); setV(before + v.slice(pos)); setQ(null); ta.current.focus(); };
  const send = () => { if (!v.trim()) return; const mentions = people.filter((p) => v.includes('@' + p.name)).map((p) => p.id); onSend(v.trim(), mentions); setV(''); };
  const matches = q != null ? people.filter((p) => p.name.toLowerCase().startsWith(q.toLowerCase()) || p.name.toLowerCase().includes(' ' + q.toLowerCase())).slice(0, 6) : [];
  return (
    <div className={'update-box' + (compact ? ' compact' : '')}>
      <textarea ref={ta} rows={compact ? 2 : 3} placeholder={placeholder} value={v} onChange={onChange} data-testid="update-input"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); if (e.key === 'Enter' && matches.length && q != null) { e.preventDefault(); pick(matches[0]); } }} />
      {matches.length > 0 && <div className="mention-pop">{matches.map((p) => <button key={p.id} onMouseDown={(e) => { e.preventDefault(); pick(p); }}><Avatar person={p} size={22} /> {p.name}</button>)}</div>}
      <div className="update-actions">
        <button className="icon-btn" title="Mention someone" onClick={() => { setV(v + (v.endsWith(' ') || !v ? '@' : ' @')); setQ(''); ta.current.focus(); }}><AtSign size={16} /></button>
        <button className="btn primary small" onClick={send} disabled={!v.trim()} data-testid="post-update"><Send size={14} /> Post</button>
      </div>
    </div>
  );
}

export default function ItemPanel({ item, A, ctx, onClose, onUpdatesChanged }) {
  const [tab, setTab] = useState('updates');
  const [data, setData] = useState({ updates: [], activity: [] });
  const [replyTo, setReplyTo] = useState(null);
  const load = async () => setData(await api.get(`/items/${item.id}/updates`));
  useEffect(() => { load(); }, [item.id, item.updated]);
  const g = ctx.board.groups.find((x) => x.id === item.group_id);
  const parent = item.parent_id ? ctx.items.find((i) => i.id === item.parent_id) : null;
  const cols = item.parent_id ? ctx.board.sub_columns : ctx.board.columns;
  const post = async (body, mentions, parent_id) => { await api.post(`/items/${item.id}/updates`, { body, mentions, parent_id }); setReplyTo(null); await load(); onUpdatesChanged(); window.dispatchEvent(new Event('notif-refresh')); };
  const P = (id) => ctx.people.find((p) => p.id === id);
  const roots = data.updates.filter((u) => !u.parent_id);
  const replies = (id) => data.updates.filter((u) => u.parent_id === id).reverse();
  return (
    <>
      <div className="panel-back" onClick={onClose} />
      <div className="side-panel" data-testid="item-panel">
        <div className="panel-head">
          <div>
            <div className="small muted">{parent ? <>↳ Subitem of <b>{parent.name}</b></> : <><span className="dot" style={{ background: g?.color }} /> {g?.name}</>}</div>
            <EditableText value={item.name} onSave={(name) => name && A.updateItem(item.id, { name })} className="panel-title" />
          </div>
          <button className="icon-btn" onClick={onClose} data-testid="close-panel"><X size={22} /></button>
        </div>
        <div className="panel-tabs">
          <button className={tab === 'updates' ? 'on' : ''} onClick={() => setTab('updates')}><MessageCircle size={16} /> Updates {roots.length > 0 && <span className="count-badge">{roots.length}</span>}</button>
          <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')} data-testid="tab-info"><Info size={16} /> Info</button>
          <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}><Activity size={16} /> Activity</button>
        </div>
        <div className="panel-body">
          {tab === 'updates' && <>
            <MentionBox people={ctx.people} onSend={(b, m) => post(b, m)} />
            {!roots.length && <div className="empty-updates">💬<b>No updates yet</b><span>Write a note, ask a question, or @mention someone.</span></div>}
            {roots.map((u) => (
              <div key={u.id} className="update-card" data-testid="update-card">
                <div className="update-head"><Avatar person={P(u.author)} size={32} /><b>{P(u.author)?.name || 'Someone'}</b><span className="muted small">🕒 {timeAgo(u.created)}</span>
                  <div className="grow" /><button className="icon-btn" onClick={async () => { if (await dialog.confirm('Delete this update?')) { await api.del('/updates/' + u.id); load(); onUpdatesChanged(); } }}><Trash2 size={14} /></button></div>
                <div className="update-body">{renderBody(u.body, ctx.people)}</div>
                {replies(u.id).map((r) => <div key={r.id} className="reply"><Avatar person={P(r.author)} size={24} /><div><b>{P(r.author)?.name}</b> <span className="muted small">{timeAgo(r.created)}</span><div>{renderBody(r.body, ctx.people)}</div></div></div>)}
                {replyTo === u.id ? <MentionBox compact people={ctx.people} placeholder="Write a reply…" onSend={(b, m) => post(b, m, u.id)} />
                  : <button className="link-btn" onClick={() => setReplyTo(u.id)}><Reply size={14} /> Reply</button>}
              </div>
            ))}
          </>}
          {tab === 'info' && <div className="info-list">
            {cols.map((c) => { const T = COLUMN_TYPES[c.type] || COLUMN_TYPES.text; return (
              <div key={c.id} className="info-row"><div className="info-label"><T.icon size={15} color={T.color} /> {c.title}</div>
                <div className={'info-cell c-' + c.type}><Cell col={c} value={item.vals[c.id]} ctx={{ ...ctx, groupColor: g?.color, item, done: ctx.doneOf(item) }} onChange={(v) => A.updateItem(item.id, { vals: { [c.id]: v } })} onUpdateColumn={(nc) => A.updateColumn(nc, !!item.parent_id)} /></div></div>); })}
            <button className="btn ghost danger-text" onClick={async () => { if (await dialog.confirm(`Delete “${item.name}”?`)) { A.deleteItem(item.id); onClose(); } }}><Trash2 size={15} /> Delete item</button>
          </div>}
          {tab === 'activity' && <div>{data.activity.map((a) => <div key={a.id} className="act-row"><Avatar person={P(a.who)} size={24} /><div className="small">{a.text}</div><span className="muted small">{timeAgo(a.created)}</span></div>)}</div>}
        </div>
      </div>
    </>
  );
}
