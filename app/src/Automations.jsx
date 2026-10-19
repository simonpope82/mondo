import React, { useState } from 'react';
import { Modal } from './ui.jsx';
import { uid } from './api.js';
import { Zap, Trash2, Plus } from 'lucide-react';

const statusCols = (b) => b.columns.filter((c) => c.type === 'status' || c.type === 'priority');
const Sel = ({ value, onChange, children, testid }) => <select className="auto-sel" value={value || ''} onChange={(e) => onChange(e.target.value)} data-testid={testid}>{children}</select>;

function Rule({ r, board, ctx, onChange, onDelete }) {
  const sc = statusCols(board);
  const t = r.trigger, a = r.action;
  const labelsOf = (cid) => (board.columns.find((c) => c.id === cid)?.settings.labels || []).filter((l) => l.label);
  const setT = (p) => onChange({ ...r, trigger: { ...t, ...p } });
  const setA = (p) => onChange({ ...r, action: { ...a, ...p } });
  return (
    <div className={'auto-rule' + (r.on === false ? ' off' : '')} data-testid="auto-rule">
      <label className="switch"><input type="checkbox" checked={r.on !== false} onChange={(e) => onChange({ ...r, on: e.target.checked })} /><span /></label>
      <div className="auto-sentence">
        <b>When</b>
        <Sel value={t.type} onChange={(v) => setT({ type: v })}><option value="status_change">status changes</option><option value="item_created">an item is created</option><option value="subitem_created">a subitem is created</option><option value="column_change">a column changes</option><option value="date_arrives">a date arrives</option></Sel>
        {t.type === 'status_change' && <>
          <Sel value={t.col} onChange={(v) => setT({ col: v, to: '' })}><option value="">pick column</option>{sc.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>
          <b>to</b>
          <Sel value={t.to} onChange={(v) => setT({ to: v })}><option value="">anything</option>{labelsOf(t.col).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Sel>
        </>}
        {t.type === 'column_change' && <Sel value={t.col} onChange={(v) => setT({ col: v })}><option value="">pick column</option>{board.columns.filter((c) => !['mirror', 'creation_log', 'last_updated'].includes(c.type)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>}
        {t.type === 'date_arrives' && <>
          <Sel value={t.col} onChange={(v) => setT({ col: v })}><option value="">pick date column</option>{board.columns.filter((c) => c.type === 'date').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>
          <Sel value={String(t.offset || 0)} onChange={(v) => setT({ offset: Number(v) })}>{[0, 1, 3, 7, 14, 30].map((n) => <option key={n} value={n}>{n ? `${n} days before` : 'on the day'}</option>)}</Sel>
        </>}
        <b>then</b>
        <Sel value={a.type} onChange={(v) => setA({ type: v })}>
          <option value="move_group">move item to group</option><option value="set_status">set status</option><option value="notify">notify someone</option><option value="set_date">set date to today</option><option value="time">start/stop time tracking</option>
        </Sel>
        {a.type === 'move_group' && <Sel value={a.group} onChange={(v) => setA({ group: v })}><option value="">pick group</option>{board.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Sel>}
        {a.type === 'set_status' && <>
          <Sel value={a.col} onChange={(v) => setA({ col: v, to: '' })}><option value="">pick column</option>{sc.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>
          <b>to</b><Sel value={a.to} onChange={(v) => setA({ to: v })}><option value="">blank</option>{labelsOf(a.col).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Sel>
        </>}
        {a.type === 'set_date' && <Sel value={a.col} onChange={(v) => setA({ col: v })}><option value="">pick date column</option>{(t.type === 'subitem_created' ? board.sub_columns || [] : board.columns).filter((c) => c.type === 'date').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>}
        {a.type === 'notify' && <>
          <Sel value={a.person} onChange={(v) => setA({ person: v })}><option value="">pick person</option><option value="__owner">the item's people</option>{ctx.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
          <input className="auto-sel" placeholder="message" value={a.text || ''} onChange={(e) => setA({ text: e.target.value })} />
        </>}
        {a.type === 'time' && <>
          <Sel value={a.mode} onChange={(v) => setA({ mode: v })}><option value="start">start</option><option value="stop">stop</option></Sel>
          <Sel value={a.col} onChange={(v) => setA({ col: v })}><option value="">pick time column</option>{board.columns.filter((c) => c.type === 'time_tracking').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Sel>
        </>}
      </div>
      <button className="icon-btn" onClick={onDelete}><Trash2 size={16} /></button>
    </div>
  );
}

export function AutomationsModal({ board, ctx, A, onClose }) {
  const [rules, setRules] = useState(board.automations || []);
  const save = (rs) => { setRules(rs); A.patchBoard({ automations: rs }); };
  const sc = statusCols(board);
  const recipes = [
    sc[0] && { label: `When ${sc[0].title} is “${sc[0].settings.labels.find((l) => /done|fixed|ferdig/i.test(l.label))?.label || sc[0].settings.labels[0]?.label}” → move to last group`, make: () => ({ trigger: { type: 'status_change', col: sc[0].id, to: (sc[0].settings.labels.find((l) => /done|fixed|ferdig/i.test(l.label)) || sc[0].settings.labels[0]).id }, action: { type: 'move_group', group: board.groups[board.groups.length - 1]?.id } }) },
    sc[0] && { label: `When item is created → set ${sc[0].title}`, make: () => ({ trigger: { type: 'item_created' }, action: { type: 'set_status', col: sc[0].id, to: sc[0].settings.labels[0]?.id } }) },
    sc[0] && { label: `When ${sc[0].title} changes → notify the item's people`, make: () => ({ trigger: { type: 'status_change', col: sc[0].id, to: '' }, action: { type: 'notify', person: '__owner', text: 'Status changed' } }) },
  ].filter(Boolean);
  return (
    <Modal onClose={onClose} width={860}>
      <h2 className="modal-title"><Zap color="#fdab3d" /> Automations</h2>
      <p className="muted">Simple rules: <b>When</b> something happens → <b>then</b> do something.</p>
      {rules.map((r) => <Rule key={r.id} r={r} board={board} ctx={ctx} onChange={(nr) => save(rules.map((x) => x.id === r.id ? nr : x))} onDelete={() => save(rules.filter((x) => x.id !== r.id))} />)}
      {!rules.length && <div className="empty-updates">⚡<b>No automations yet</b><span>Pick a ready recipe below, or make your own.</span></div>}
      <div className="mini-label">Quick recipes</div>
      <div className="recipes">
        {recipes.map((rc, k) => <button key={k} className="recipe" onClick={() => save([...rules, { id: uid('a'), on: true, ...rc.make() }])} data-testid="recipe">⚡ {rc.label}</button>)}
        <button className="recipe blank" onClick={() => save([...rules, { id: uid('a'), on: true, trigger: { type: 'status_change', col: sc[0]?.id || '' }, action: { type: 'move_group' } }])}><Plus size={14} /> Make my own</button>
      </div>
      <div className="modal-actions"><button className="btn primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}
