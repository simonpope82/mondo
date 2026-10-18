import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, uid } from './api.js';
import { Popover, Menu, EditableText, Avatar, dialog } from './ui.jsx';
import { COLUMN_TYPES, VIEW_TYPES, GROUP_COLORS, newColumn, isDoneLabel } from './constants.js';
import TableView from './TableView.jsx';
import { KanbanView, CalendarView, TimelineView, ChartView } from './Views.jsx';
import ItemPanel from './ItemPanel.jsx';
import { MapView } from './MapView.jsx';
import { AutomationsModal } from './Automations.jsx';
import { FormModal } from './Forms.jsx';
import { Plus, Search, User, Filter, ArrowUpDown, EyeOff, Star, MoreHorizontal, Trash2, Pencil, Copy, X, MoveRight, Zap, FileText, Activity } from 'lucide-react';

export default function Board({ boardId, ctx }) {
  const [data, setData] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState(null);
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [openItem, setOpenItem] = useState(null);
  const [pop, setPop] = useState(null); // {kind, el}
  const [modal, setModal] = useState(null);
  const [linked, setLinked] = useState({}); // boardId -> full data for connect/mirror
  const dataRef = useRef(); dataRef.current = data;

  const load = useCallback(async () => setData(await api.get('/boards/' + boardId)), [boardId]);
  useEffect(() => { load(); const f = () => load(); window.addEventListener('board-refresh', f); return () => window.removeEventListener('board-refresh', f); }, [load]);
  useEffect(() => { // load linked boards for connect columns
    if (!data) return;
    const ids = [...new Set(data.board.columns.filter((c) => c.type === 'connect' && c.settings.boardId).map((c) => c.settings.boardId))];
    ids.filter((id) => !linked[id]).forEach(async (id) => { try { const d = await api.get('/boards/' + id); setLinked((l) => ({ ...l, [id]: d })); } catch {} });
  }, [data?.board.columns]);

  if (!data) return <div className="loading">Loading board…</div>;
  const { board, items } = data;
  const view = board.views.find((v) => v.id === viewId) || board.views[0] || { id: 'main', type: 'table', name: 'Main table', settings: {} };
  const hidden = view.settings?.hidden || [];
  const columns = board.columns.filter((c) => !hidden.includes(c.id));

  // ---------- actions ----------
  const setFull = (r) => { if (r && r.board) setData((d) => ({ ...r, updateCounts: r.updateCounts || d.updateCounts })); return r; };
  const patchBoard = async (p) => { setData((d) => ({ ...d, board: { ...d.board, ...p } })); const r = setFull(await api.patch('/boards/' + boardId, p)); if (p.name || p.icon || p.favorite !== undefined) ctx.reload(); return r; };
  const A = {
    patchBoard,
    updateItem: async (id, patch, skipAuto) => {
      const before = dataRef.current.items.find((i) => i.id === id);
      setData((d) => ({ ...d, items: d.items.map((i) => i.id === id ? { ...i, ...patch, vals: patch.vals ? { ...i.vals, ...patch.vals } : i.vals } : i) }));
      const r = setFull(await api.patch('/items/' + id, patch));
      if (patch.vals && (dataRef.current.board.automations || []).length) { ctx.reload(); window.dispatchEvent(new Event('notif-refresh')); }
      return r;
    },
    addItem: async (group_id, name, parent_id, vals, top) => {
      const r = setFull(await api.post(`/boards/${boardId}/items`, { group_id, name, parent_id, vals, top }));
      ctx.reload(); return r.newId;
    },
    deleteItem: async (id) => { setFull(await api.del('/items/' + id)); if (openItem === id) setOpenItem(null); ctx.reload(); },
    duplicateItem: async (id) => setFull(await api.post(`/items/${id}/duplicate`)),
    moveItem: async (id, group_id, before_id) => {
      setData((d) => ({ ...d, items: d.items.map((i) => i.id === id ? { ...i, group_id } : i) }));
      setFull(await api.post(`/items/${id}/move`, { group_id, before_id }));
    },
    bulk: async (action, group_id) => { setFull(await api.post(`/boards/${boardId}/bulk`, { action, ids: [...selected], group_id })); setSelected(new Set()); ctx.reload(); },
    updateColumn: (col, sub) => { const key = sub ? 'sub_columns' : 'columns'; return patchBoard({ [key]: dataRef.current.board[key].map((c) => c.id === col.id ? col : c) }); },
    addColumn: (type, sub, extra) => { const key = sub ? 'sub_columns' : 'columns'; const c = { ...newColumn(type), ...(extra || {}) }; return patchBoard({ [key]: [...dataRef.current.board[key], c] }); },
    deleteColumn: async (col, sub) => { if (!(await dialog.confirm(`Delete column “${col.title}”?`))) return; const key = sub ? 'sub_columns' : 'columns'; patchBoard({ [key]: dataRef.current.board[key].filter((c) => c.id !== col.id) }); },
    moveColumn: (colId, beforeId, sub) => {
      const key = sub ? 'sub_columns' : 'columns'; const cols = [...dataRef.current.board[key]];
      const from = cols.findIndex((c) => c.id === colId); const [c] = cols.splice(from, 1);
      let to = beforeId ? cols.findIndex((x) => x.id === beforeId) : cols.length; if (to < 0) to = cols.length;
      cols.splice(to, 0, c); patchBoard({ [key]: cols });
    },
    addGroup: (top) => { const g = { id: uid('g'), name: 'New group', color: GROUP_COLORS[dataRef.current.board.groups.length % GROUP_COLORS.length], collapsed: false }; const gs = dataRef.current.board.groups; return patchBoard({ groups: top ? [g, ...gs] : [...gs, g] }); },
    updateGroup: (g) => patchBoard({ groups: dataRef.current.board.groups.map((x) => x.id === g.id ? g : x) }),
    deleteGroup: async (g) => { if (!(await dialog.confirm(`Delete group “${g.name}” and its items?`))) return; setFull(await api.del(`/boards/${boardId}/groups/${g.id}`)); ctx.reload(); },
    moveGroup: (gid, beforeId) => {
      const gs = [...dataRef.current.board.groups]; const [g] = gs.splice(gs.findIndex((x) => x.id === gid), 1);
      let to = beforeId ? gs.findIndex((x) => x.id === beforeId) : gs.length; if (to < 0) to = gs.length; gs.splice(to, 0, g); patchBoard({ groups: gs });
    },
    openItem: setOpenItem,
    toggleSelect: (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    selectMany: (ids, on) => setSelected((s) => { const n = new Set(s); ids.forEach((id) => on ? n.add(id) : n.delete(id)); return n; }),
    patchView: (p) => patchBoard({ views: dataRef.current.board.views.map((v) => v.id === view.id ? { ...v, ...p, settings: { ...(v.settings || {}), ...(p.settings || {}) } } : v) }),
  };

  // ---------- filtering ----------
  const statusCol = board.columns.find((c) => c.type === 'status');
  const doneOf = (it) => statusCol && isDoneLabel(statusCol.settings.labels.find((l) => l.id === it.vals[statusCol.id]));
  const peopleCols = board.columns.filter((c) => c.type === 'people');
  const subsByParent = {};
  items.filter((i) => i.parent_id).forEach((i) => (subsByParent[i.parent_id] ||= []).push(i));
  const textOf = (it) => [it.name, ...board.columns.map((c) => { const v = it.vals[c.id]; if (v == null) return ''; if (c.type === 'status' || c.type === 'priority') return c.settings.labels.find((l) => l.id === v)?.label || ''; if (c.type === 'dropdown') return (v || []).map((id) => c.settings.options.find((o) => o.id === id)?.label).join(' '); if (c.type === 'people') return (v || []).map((id) => ctx.people.find((p) => p.id === id)?.name).join(' '); if (typeof v === 'object') return Object.values(v).join(' '); return String(v); })].join(' ').toLowerCase();
  const matchFilter = (it, colId, sel) => {
    if (colId === '__group') return sel.includes(it.group_id);
    const c = board.columns.find((x) => x.id === colId); if (!c) return true; const v = it.vals[colId];
    if (c.type === 'checkbox') return sel.includes(v ? 'yes' : 'no');
    if (Array.isArray(v)) return v.length ? v.some((x) => sel.includes(x)) : sel.includes('__empty');
    return sel.includes(v == null ? '__empty' : v);
  };
  let top = items.filter((i) => !i.parent_id);
  const q = search.trim().toLowerCase();
  if (q) top = top.filter((it) => textOf(it).includes(q) || (subsByParent[it.id] || []).some((s) => s.name.toLowerCase().includes(q)));
  if (person) top = top.filter((it) => peopleCols.some((c) => (it.vals[c.id] || []).includes(person)));
  Object.entries(filters).forEach(([cid, sel]) => { if (sel.length) top = top.filter((it) => matchFilter(it, cid, sel)); });
  if (sort) {
    const c = board.columns.find((x) => x.id === sort.col);
    const key = (it) => { if (sort.col === '__name') return it.name.toLowerCase(); const v = it.vals[sort.col]; if (v == null) return null; if (c?.type === 'status' || c?.type === 'priority') return c.settings.labels.findIndex((l) => l.id === v); if (c?.type === 'timeline') return v.from; if (Array.isArray(v)) return v.length; return v; };
    top = [...top].sort((a, b) => { const x = key(a), y = key(b); if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'desc' ? -1 : 1); });
  }
  const nFilters = Object.values(filters).reduce((s, a) => s + a.length, 0);
  const vctx = { ...ctx, board, items, subsByParent, doneOf, updateCounts: data.updateCounts || {}, selected, linked, view, filtering: !!(q || person || nFilters) };

  const addView = (type) => { const v = { id: uid('v'), type, name: VIEW_TYPES[type].label, settings: {} }; patchBoard({ views: [...board.views, v] }); setViewId(v.id); };
  const P = (kind) => (e) => setPop({ kind, el: e.currentTarget });

  return (
    <div className="board">
      <div className="board-head">
        <div className="board-title-row">
          <button className="board-icon" onClick={P('icon')} title="Change icon">{board.icon}</button>
          <EditableText value={board.name} onSave={(name) => name && patchBoard({ name })} className="board-title" testid="board-title" />
          <button className="icon-btn" onClick={() => patchBoard({ favorite: !board.favorite })} title="Favourite"><Star size={20} fill={board.favorite ? '#ffcb00' : 'none'} color={board.favorite ? '#ffcb00' : '#676879'} /></button>
          <div className="grow" />
          <button className="btn ghost" onClick={() => setModal('form')} data-testid="btn-form"><FileText size={16} /> Form</button>
          <button className="btn ghost" onClick={() => setModal('auto')} data-testid="btn-auto"><Zap size={16} color="#fdab3d" /> Automate {(board.automations || []).filter((a) => a.on).length > 0 && <span className="count-badge">{board.automations.filter((a) => a.on).length}</span>}</button>
          <button className="btn ghost" onClick={P('boardmenu')}><MoreHorizontal size={18} /></button>
        </div>
        <EditableText value={board.description} onSave={(description) => patchBoard({ description })} className="board-desc" placeholder="Add a short description" />
        <div className="view-tabs">
          {board.views.map((v) => (
            <div key={v.id} className={'view-tab' + (v.id === view.id ? ' active' : '')} onClick={() => setViewId(v.id)} data-testid={'view-' + v.type}>
              <span>{VIEW_TYPES[v.type]?.emoji}</span> {v.name}
              {v.id === view.id && <button className="icon-btn tiny" onClick={(e) => { e.stopPropagation(); setPop({ kind: 'viewmenu', el: e.currentTarget, v }); }}><MoreHorizontal size={14} /></button>}
            </div>
          ))}
          <button className="view-tab add" onClick={P('addview')} data-testid="add-view"><Plus size={16} /></button>
        </div>
      </div>

      <div className="toolbar">
        <div className="split-btn">
          <button className="btn primary" onClick={async () => { const id = await A.addItem(board.groups[0]?.id, 'New item', null, null, true); }} data-testid="new-item"><Plus size={16} /> New item</button>
          <button className="btn primary narrow" onClick={() => A.addGroup(true)} title="New group" data-testid="new-group-top">+ Group</button>
        </div>
        <div className={'tool-search' + (search ? ' on' : '')}><Search size={16} /><input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="board-search" />{search && <X size={14} onClick={() => setSearch('')} />}</div>
        <button className={'tool-btn' + (person ? ' on' : '')} onClick={P('person')}>{person ? <Avatar person={ctx.people.find((p) => p.id === person)} size={20} /> : <User size={16} />} Person</button>
        <button className={'tool-btn' + (nFilters ? ' on' : '')} onClick={P('filter')} data-testid="filter-btn"><Filter size={16} /> Filter{nFilters ? ` / ${nFilters}` : ''}</button>
        <button className={'tool-btn' + (sort ? ' on' : '')} onClick={P('sort')}><ArrowUpDown size={16} /> Sort</button>
        <button className={'tool-btn' + (hidden.length ? ' on' : '')} onClick={P('hide')}><EyeOff size={16} /> Hide{hidden.length ? ` / ${hidden.length}` : ''}</button>
        <button className="tool-btn" onClick={() => setModal('activity')}><Activity size={16} /> Log</button>
        {(q || person || nFilters || sort) && <button className="link-btn" onClick={() => { setSearch(''); setPerson(null); setFilters({}); setSort(null); }}>Clear all</button>}
      </div>

      <div className="view-body">
        {view.type === 'table' && <TableView groups={board.groups} top={top} columns={columns} A={A} ctx={vctx} />}
        {view.type === 'kanban' && <KanbanView top={top} A={A} ctx={vctx} />}
        {view.type === 'calendar' && <CalendarView top={top} A={A} ctx={vctx} />}
        {view.type === 'timeline' && <TimelineView top={top} A={A} ctx={vctx} />}
        {view.type === 'chart' && <ChartView top={top} A={A} ctx={vctx} />}
        {view.type === 'map' && <MapView top={top} A={A} ctx={vctx} />}
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar" data-testid="bulk-bar">
          <span className="bulk-count">{selected.size}</span><b>selected</b>
          <button className="bulk-btn" onClick={P('bulkmove')}><MoveRight size={18} /> Move</button>
          <button className="bulk-btn danger" onClick={async () => { if (await dialog.confirm(`Delete ${selected.size} items?`)) A.bulk('delete'); }}><Trash2 size={18} /> Delete</button>
          <button className="icon-btn" onClick={() => setSelected(new Set())}><X size={18} /></button>
        </div>
      )}

      {openItem && items.find((i) => i.id === openItem) && <ItemPanel item={items.find((i) => i.id === openItem)} A={A} ctx={vctx} onClose={() => setOpenItem(null)} onUpdatesChanged={load} />}
      {modal === 'auto' && <AutomationsModal board={board} ctx={ctx} A={A} onClose={() => setModal(null)} />}
      {modal === 'form' && <FormModal board={board} ctx={ctx} A={A} onClose={() => setModal(null)} />}
      {modal === 'activity' && <BoardLog boardId={boardId} ctx={ctx} onClose={() => setModal(null)} />}

      {pop?.kind === 'icon' && <Popover anchor={pop.el} onClose={() => setPop(null)} width={260}><div className="emoji-grid">{'📋🚀🛠️🤝🎉☕📞🚚👥💰📅✅🔥⭐🏠📦🧾🧰💧🗂️🎯📈🧑‍🔧🏢'.match(/\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic})*\ufe0f?/gu).map((e) => <button key={e} onClick={() => { patchBoard({ icon: e }); setPop(null); }}>{e}</button>)}</div></Popover>}
      {pop?.kind === 'boardmenu' && <Menu anchor={pop.el} onClose={() => setPop(null)} items={[
        { label: 'Duplicate board', icon: Copy, onClick: async () => { const { id } = await api.post(`/boards/${boardId}/duplicate`); await ctx.reload(); window.location.hash = '#/board/' + id; } },
        { label: 'Duplicate (no data)', icon: Copy, onClick: async () => { const { id } = await api.post(`/boards/${boardId}/duplicate`, { withItems: false, name: board.name + ' (new)' }); await ctx.reload(); window.location.hash = '#/board/' + id; } },
        { label: 'Export to CSV', icon: FileText, onClick: () => exportCsv(board, items, ctx) },
        '-', { label: 'Delete board', icon: Trash2, danger: true, onClick: async () => { if (await dialog.confirm(`Delete board “${board.name}”?`)) { await api.del('/boards/' + boardId); await ctx.reload(); window.location.hash = '#/home'; } } },
      ]} />}
      {pop?.kind === 'addview' && <Menu anchor={pop.el} onClose={() => setPop(null)} items={Object.entries(VIEW_TYPES).map(([k, v]) => ({ label: `${v.emoji}  ${v.label}`, onClick: () => addView(k) }))} />}
      {pop?.kind === 'viewmenu' && <Menu anchor={pop.el} onClose={() => setPop(null)} items={[
        { label: 'Rename view', icon: Pencil, onClick: async () => { const n = await dialog.prompt('Rename view', pop.v.name); if (n) patchBoard({ views: board.views.map((v) => v.id === pop.v.id ? { ...v, name: n } : v) }); } },
        { label: 'Duplicate view', icon: Copy, onClick: () => { const v = { ...pop.v, id: uid('v'), name: pop.v.name + ' copy' }; patchBoard({ views: [...board.views, v] }); setViewId(v.id); } },
        board.views.length > 1 && { label: 'Delete view', icon: Trash2, danger: true, onClick: () => { patchBoard({ views: board.views.filter((v) => v.id !== pop.v.id) }); setViewId(null); } },
      ]} />}
      {pop?.kind === 'person' && <Popover anchor={pop.el} onClose={() => setPop(null)} width={260}>
        <div className="mini-label">Show items for</div>
        <div className="person-filter">{ctx.people.map((p) => <button key={p.id} className={'pf' + (person === p.id ? ' on' : '')} onClick={() => setPerson(person === p.id ? null : p.id)} title={p.name}><Avatar person={p} size={34} /><span>{p.name.split(' ')[0]}</span></button>)}</div>
      </Popover>}
      {pop?.kind === 'filter' && <Popover anchor={pop.el} onClose={() => setPop(null)} width={Math.min(900, window.innerWidth - 40)}>
        <FilterPanel board={board} filters={filters} setFilters={setFilters} ctx={ctx} items={items.filter((i) => !i.parent_id)} />
      </Popover>}
      {pop?.kind === 'sort' && <Popover anchor={pop.el} onClose={() => setPop(null)} width={280}>
        <div className="mini-label">Sort by</div>
        <select className="text-input" value={sort?.col || ''} onChange={(e) => setSort(e.target.value ? { col: e.target.value, dir: sort?.dir || 'asc' } : null)}>
          <option value="">— none —</option><option value="__name">Name</option>{board.columns.filter((c) => c.type !== 'long_text').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {sort && <div className="row-gap"><button className={'btn small' + (sort.dir === 'asc' ? ' primary' : '')} onClick={() => setSort({ ...sort, dir: 'asc' })}>A → Z ↑</button><button className={'btn small' + (sort.dir === 'desc' ? ' primary' : '')} onClick={() => setSort({ ...sort, dir: 'desc' })}>Z → A ↓</button></div>}
      </Popover>}
      {pop?.kind === 'hide' && <Popover anchor={pop.el} onClose={() => setPop(null)} width={260}>
        <div className="mini-label">Show columns (this view)</div>
        {board.columns.map((c) => { const T = COLUMN_TYPES[c.type] || COLUMN_TYPES.text; return <label key={c.id} className="menu-item"><input type="checkbox" checked={!hidden.includes(c.id)} onChange={(e) => A.patchView({ settings: { hidden: e.target.checked ? hidden.filter((x) => x !== c.id) : [...hidden, c.id] } })} /> <T.icon size={15} color={T.color} /> {c.title}</label>; })}
      </Popover>}
      {pop?.kind === 'bulkmove' && <Menu anchor={pop.el} onClose={() => setPop(null)} items={board.groups.map((g) => ({ label: g.name, icon: () => <span className="dot" style={{ background: g.color }} />, onClick: () => A.bulk('move', g.id) }))} />}
    </div>
  );
}

function FilterPanel({ board, filters, setFilters, ctx, items }) {
  const toggle = (cid, v) => setFilters((f) => { const cur = f[cid] || []; return { ...f, [cid]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }; });
  const count = (fn) => items.filter(fn).length;
  const cols = board.columns.filter((c) => ['status', 'priority', 'people', 'dropdown', 'checkbox'].includes(c.type));
  return (
    <div className="filter-panel">
      <div className="filter-col">
        <div className="filter-head">Group</div>
        {board.groups.map((g) => <button key={g.id} className={'filter-opt' + ((filters.__group || []).includes(g.id) ? ' on' : '')} onClick={() => toggle('__group', g.id)}><span className="dot" style={{ background: g.color }} />{g.name}<span className="n">{count((i) => i.group_id === g.id)}</span></button>)}
      </div>
      {cols.map((c) => {
        const sel = filters[c.id] || [];
        let opts = [];
        if (c.type === 'status' || c.type === 'priority') opts = c.settings.labels.filter((l) => l.label).map((l) => ({ v: l.id, label: l.label, dot: l.color }));
        if (c.type === 'people') opts = ctx.people.map((p) => ({ v: p.id, label: p.name, person: p }));
        if (c.type === 'dropdown') opts = c.settings.options.map((o) => ({ v: o.id, label: o.label }));
        if (c.type === 'checkbox') opts = [{ v: 'yes', label: '✔ Checked' }, { v: 'no', label: '☐ Not checked' }];
        if (c.type !== 'checkbox') opts.push({ v: '__empty', label: 'Blank', dot: '#c4c4c4' });
        return (
          <div key={c.id} className="filter-col">
            <div className="filter-head">{c.title}</div>
            {opts.map((o) => <button key={o.v} className={'filter-opt' + (sel.includes(o.v) ? ' on' : '')} onClick={() => toggle(c.id, o.v)} data-testid="filter-opt">
              {o.person ? <Avatar person={o.person} size={18} /> : o.dot ? <span className="dot" style={{ background: o.dot }} /> : null}{o.label}
            </button>)}
          </div>
        );
      })}
    </div>
  );
}

function BoardLog({ boardId, ctx, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get(`/boards/${boardId}/activity`).then(setRows); }, [boardId]);
  return (
    <div className="side-panel" style={{ width: 480 }}>
      <div className="panel-head"><h2>🕘 Activity log</h2><button className="icon-btn" onClick={onClose}><X size={20} /></button></div>
      <div className="panel-body">{!rows ? 'Loading…' : rows.map((r) => <div key={r.id} className="act-row"><Avatar person={ctx.people.find((p) => p.id === r.who)} size={24} /><div><b>{r.item || '—'}</b><div className="small">{r.text}</div></div><span className="muted small">{new Date(r.created).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>)}</div>
    </div>
  );
}

function exportCsv(board, items, ctx) {
  const esc = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const val = (c, v) => { if (v == null) return ''; if (c.type === 'status' || c.type === 'priority') return c.settings.labels.find((l) => l.id === v)?.label; if (c.type === 'dropdown') return v.map((id) => c.settings.options.find((o) => o.id === id)?.label).join(', '); if (c.type === 'people') return v.map((id) => ctx.people.find((p) => p.id === id)?.name).join(', '); if (c.type === 'timeline') return `${v.from} - ${v.to}`; if (c.type === 'link') return v.url; if (c.type === 'location') return typeof v === 'object' ? v.address : v; if (typeof v === 'object') return JSON.stringify(v); return v; };
  const rows = [['Group', 'Item', ...board.columns.map((c) => c.title)], ...items.filter((i) => !i.parent_id).map((i) => [board.groups.find((g) => g.id === i.group_id)?.name, i.name, ...board.columns.map((c) => val(c, i.vals[c.id]))])];
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = board.name + '.csv'; a.click();
}
