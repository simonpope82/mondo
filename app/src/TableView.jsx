import React, { useRef, useState } from 'react';
import { Cell, fmtNum, LabelEditor } from './Cells.jsx';
import { Popover, Menu, EditableText, ColorGrid, dialog } from './ui.jsx';
import { COLUMN_TYPES, GROUP_COLORS } from './constants.js';
import MobileList from './MobileList.jsx';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Trash2, Pencil, Palette, ArrowLeft, ArrowRight, GripVertical, MessageCircle, Copy, ChevronsDownUp, ChevronsUpDown, Maximize2, Link2 } from 'lucide-react';

const isPhone = () => window.innerWidth < 800;
const W = (c) => c.width || COLUMN_TYPES[c.type]?.width || 150;
let drag = null; // {kind:'item'|'group'|'col', id, sub}

export default function TableView({ groups, top, columns, A, ctx }) {
  if (isPhone() && !ctx.view.settings?.wideOnPhone) return <MobileList groups={groups} top={top} A={A} ctx={ctx} />;
  const [drop, setDrop] = useState(null);
  const [expanded, setExpanded] = useState({});
  const leadW = isPhone() ? 170 : 380;
  const rowW = leadW + columns.reduce((s, c) => s + W(c), 0) + 60;
  const allCollapsed = groups.every((g) => g.collapsed);
  return (
    <div className="table-scroll" onDragEnd={() => { drag = null; setDrop(null); }}>
      <div style={{ minWidth: rowW }}>
        <div className="table-tools">
          <button className="link-btn" onClick={() => A.patchBoard({ groups: groups.map((g) => ({ ...g, collapsed: !allCollapsed })) })}>{allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />} {allCollapsed ? 'Open all groups' : 'Close all groups'}</button>
        </div>
        {groups.map((g) => {
          const gItems = top.filter((i) => i.group_id === g.id);
          if (ctx.filtering && !gItems.length) return null;
          return <Group key={g.id} g={g} items={gItems} columns={columns} A={A} ctx={ctx} drop={drop} setDrop={setDrop} expanded={expanded} setExpanded={setExpanded} leadW={leadW} />;
        })}
        <button className="add-group-btn" onClick={() => A.addGroup(false)} data-testid="add-group"><Plus size={16} /> Add new group</button>
      </div>
    </div>
  );
}

function Group({ g, items, columns, A, ctx, drop, setDrop, expanded, setExpanded, leadW }) {
  const [menu, setMenu] = useState(null);
  const [colorPop, setColorPop] = useState(null);
  const [newName, setNewName] = useState('');
  const headRef = useRef();
  const ids = items.map((i) => i.id);
  const allSel = ids.length > 0 && ids.every((id) => ctx.selected.has(id));
  const onHeadDrop = (e) => { e.preventDefault(); if (drag?.kind === 'group' && drag.id !== g.id) A.moveGroup(drag.id, g.id); if (drag?.kind === 'item') A.moveItem(drag.id, g.id, null); setDrop(null); };
  return (
    <div className="group" style={{ '--gc': g.color }} data-testid="group">
      <div className={'group-head' + (drop?.group === g.id ? ' drop-on' : '')} onDragOver={(e) => { if (drag?.kind === 'group' || drag?.kind === 'item') { e.preventDefault(); setDrop({ group: g.id }); } }} onDrop={onHeadDrop}>
        <span className="grip" draggable onDragStart={(e) => { drag = { kind: 'group', id: g.id }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.id); }}><GripVertical size={16} /></span>
        <button ref={headRef} className="icon-btn" onClick={() => setMenu(headRef.current)} data-testid="group-menu"><MoreHorizontal size={16} /></button>
        <button className="icon-btn" style={{ color: g.color }} onClick={() => A.updateGroup({ ...g, collapsed: !g.collapsed })} data-testid="group-toggle">{g.collapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}</button>
        <EditableText value={g.name} onSave={(name) => name && A.updateGroup({ ...g, name })} className="group-name" testid="group-name" />
        <span className="group-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
      </div>
      {menu && <Menu anchor={menu} onClose={() => setMenu(null)} items={[
        { label: g.collapsed ? 'Open group' : 'Close group', icon: ChevronDown, onClick: () => A.updateGroup({ ...g, collapsed: !g.collapsed }) },
        { label: 'Rename group', icon: Pencil, onClick: async () => { const n = await dialog.prompt('Rename group', g.name); if (n) A.updateGroup({ ...g, name: n }); } },
        { label: 'Change colour', icon: Palette, onClick: () => setColorPop(headRef.current) },
        { label: 'Add item', icon: Plus, onClick: () => A.addItem(g.id, 'New item') },
        { label: 'Add group', icon: Plus, onClick: () => A.addGroup(false) },
        '-', { label: 'Delete group', icon: Trash2, danger: true, onClick: () => A.deleteGroup(g) },
      ]} />}
      {colorPop && <Popover anchor={colorPop} onClose={() => setColorPop(null)} width={220}><ColorGrid colors={GROUP_COLORS} value={g.color} onPick={(color) => { A.updateGroup({ ...g, color }); setColorPop(null); }} /></Popover>}

      {g.collapsed ? (
        <div className="trow collapsed-row" onClick={() => A.updateGroup({ ...g, collapsed: false })}>
          <div className="cell lead" style={{ width: leadW }}><b style={{ color: g.color }}>{g.name}</b>&nbsp;<span className="muted">· {items.length} items</span></div>
          {columns.map((c) => <div key={c.id} className="cell" style={{ width: W(c) }}><Summary col={c} items={items} ctx={ctx} /></div>)}
        </div>
      ) : (
        <>
          <HeaderRow columns={columns} A={A} ctx={ctx} leadW={leadW} first allSel={allSel} onSelAll={() => A.selectMany(ids, !allSel)} />
          {items.map((it) => (
            <React.Fragment key={it.id}>
              <ItemRow it={it} g={g} columns={columns} A={A} ctx={ctx} leadW={leadW} drop={drop} setDrop={setDrop} open={!!expanded[it.id]} toggle={() => setExpanded((e) => ({ ...e, [it.id]: !e[it.id] }))} />
              {expanded[it.id] && <SubItems parent={it} g={g} A={A} ctx={ctx} leadW={leadW} />}
            </React.Fragment>
          ))}
          <div className={'trow add-row' + (drop?.group === g.id && drop.end ? ' drop-line' : '')} onDragOver={(e) => { if (drag?.kind === 'item') { e.preventDefault(); setDrop({ group: g.id, end: true }); } }} onDrop={(e) => { e.preventDefault(); if (drag?.kind === 'item') A.moveItem(drag.id, g.id, null); setDrop(null); }}>
            <div className="cell lead add" style={{ width: leadW }}>
              <span className="lead-check" />
              <input placeholder="+ Add item" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="add-item-input"
                onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { A.addItem(g.id, newName.trim()); setNewName(''); } }}
                onBlur={() => { if (newName.trim()) { A.addItem(g.id, newName.trim()); setNewName(''); } }} />
            </div>
          </div>
          <div className="trow summary-row">
            <div className="cell lead blank" style={{ width: leadW }} />
            {columns.map((c) => <div key={c.id} className="cell sum" style={{ width: W(c) }}><Summary col={c} items={items} ctx={ctx} /></div>)}
          </div>
        </>
      )}
    </div>
  );
}

export function Summary({ col, items, ctx }) {
  if (col.type === 'status' || col.type === 'priority') {
    const n = items.length; if (!n) return <div className="battery empty" />;
    const counts = col.settings.labels.filter((l) => l.label !== '').map((l) => ({ l, n: items.filter((i) => i.vals[col.id] === l.id).length }));
    const blank = n - counts.reduce((a, c) => a + c.n, 0);
    return <div className="battery">{counts.filter((c) => c.n).map((c) => <span key={c.l.id} style={{ width: (c.n / n) * 100 + '%', background: c.l.color }} title={`${c.l.label}: ${c.n}`} />)}{blank > 0 && <span style={{ width: (blank / n) * 100 + '%', background: '#c4c4c4' }} title={`Blank: ${blank}`} />}</div>;
  }
  if (col.type === 'numbers' && col.settings.hideFooter) return null;
  if (col.type === 'numbers') { const s = items.reduce((a, i) => a + (Number(i.vals[col.id]) || 0), 0); return <div className="sum-num" data-testid="sum"><b>{fmtNum(s)}{col.settings.unit ? ' ' + col.settings.unit : ''}</b><span>sum</span></div>; }
  if (col.type === 'checkbox') { const s = items.filter((i) => i.vals[col.id]).length; return <div className="sum-num"><b>{s}/{items.length}</b><span>✔</span></div>; }
  if (col.type === 'time_tracking') { const s = items.reduce((a, i) => a + (i.vals[col.id]?.total || 0), 0); return <div className="sum-num"><b>{Math.floor(s / 3600)}h {Math.floor((s % 3600) / 60)}m</b><span>sum</span></div>; }
  return null;
}

function HeaderRow({ columns, A, ctx, leadW, sub, allSel, onSelAll }) {
  const [addPop, setAddPop] = useState(null);
  return (
    <div className={'trow head-row' + (sub ? ' sub' : '')}>
      <div className="cell lead head" style={{ width: leadW }}>
        {!sub && <span className="lead-check"><input type="checkbox" checked={!!allSel} onChange={onSelAll} /></span>}
        <span className="head-title">{sub ? 'Subitem' : 'Item'}</span>
      </div>
      {columns.map((c) => <ColumnHeader key={c.id} c={c} A={A} sub={sub} ctx={ctx} />)}
      <div className="cell head add-col" style={{ width: 60 }}><button className="icon-btn" onClick={(e) => setAddPop(e.currentTarget)} title="Add column" data-testid={sub ? 'add-subcolumn' : 'add-column'}><Plus size={18} /></button></div>
      {addPop && <AddColumnPop anchor={addPop} onClose={() => setAddPop(null)} A={A} sub={sub} ctx={ctx} />}
    </div>
  );
}

function AddColumnPop({ anchor, onClose, A, sub, ctx }) {
  const [connect, setConnect] = useState(false);
  const types = Object.entries(COLUMN_TYPES).filter(([k]) => !(sub && (k === 'connect' || k === 'mirror')) && k !== 'mirror');
  if (connect) {
    return <Popover anchor={anchor} onClose={onClose} width={280} align="right">
      <div className="mini-label">Connect to which board?</div>
      {ctx.boot.boards.filter((b) => b.id !== ctx.board.id).map((b) => <button key={b.id} className="menu-item" onClick={() => { A.addColumn('connect', false, { title: b.name, settings: { boardId: b.id } }); onClose(); }}>{b.icon} {b.name}</button>)}
    </Popover>;
  }
  const mirrorSources = ctx.board.columns.filter((c) => c.type === 'connect' && ctx.linked[c.settings.boardId]);
  return (
    <Popover anchor={anchor} onClose={onClose} width={340} align="right">
      <div className="mini-label">Add column</div>
      <div className="type-grid">
        {types.map(([k, t]) => <button key={k} className="type-btn" onClick={() => { if (k === 'connect') return setConnect(true); A.addColumn(k, sub); onClose(); }} data-testid={'coltype-' + k}><span className="type-ico" style={{ background: t.color }}><t.icon size={15} color="#fff" /></span>{t.label}</button>)}
      </div>
      {!sub && mirrorSources.length > 0 && <>
        <div className="mini-label">🪞 Mirror (show a column from a connected board)</div>
        {mirrorSources.map((cc) => ctx.linked[cc.settings.boardId].board.columns.filter((x) => !['connect', 'mirror'].includes(x.type)).map((x) => (
          <button key={cc.id + x.id} className="menu-item" onClick={() => { A.addColumn('mirror', false, { title: x.title, settings: { connectCol: cc.id, colId: x.id } }); onClose(); }}>{cc.title} → {x.title}</button>
        )))}
      </>}
    </Popover>
  );
}

function ColumnHeader({ c, A, sub, ctx }) {
  const [menu, setMenu] = useState(null);
  const [labels, setLabels] = useState(null);
  const [over, setOver] = useState(false);
  const ref = useRef();
  const T = COLUMN_TYPES[c.type] || COLUMN_TYPES.text;
  return (
    <div ref={ref} className={'cell head col-head' + (over ? ' drop-left' : '')} style={{ width: W(c) }} draggable
      onDragStart={(e) => { drag = { kind: 'col', id: c.id, sub }; e.dataTransfer.setData('text/plain', c.id); }}
      onDragOver={(e) => { if (drag?.kind === 'col' && !!drag.sub === !!sub && drag.id !== c.id) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (drag?.kind === 'col') A.moveColumn(drag.id, c.id, sub); }}>
      <T.icon size={13} color={T.color} className="col-ico" />
      <EditableText value={c.title} onSave={(title) => title && A.updateColumn({ ...c, title }, sub)} className="col-title" testid="col-title" />
      <button className="icon-btn tiny hover-show" onClick={() => setMenu(ref.current)} data-testid="col-menu"><MoreHorizontal size={14} /></button>
      {menu && <Menu anchor={menu} onClose={() => setMenu(null)} items={[
        { label: 'Rename', icon: Pencil, onClick: async () => { const n = await dialog.prompt('Rename column', c.title); if (n) A.updateColumn({ ...c, title: n }, sub); } },
        (c.type === 'status' || c.type === 'priority') && { label: 'Edit labels', icon: Palette, onClick: () => setLabels(ref.current) },
        c.type === 'numbers' && { label: 'Set unit (kr, h, pcs…)', icon: Pencil, onClick: async () => { const u = await dialog.prompt('Unit to show after numbers', c.settings.unit || ''); if (u !== null) A.updateColumn({ ...c, settings: { ...c.settings, unit: u } }, sub); } },
        { label: 'Make wider', icon: ArrowRight, onClick: () => A.updateColumn({ ...c, width: W(c) + 40 }, sub) },
        { label: 'Make smaller', icon: ArrowLeft, onClick: () => A.updateColumn({ ...c, width: Math.max(80, W(c) - 40) }, sub) },
        { label: 'Duplicate column', icon: Copy, onClick: () => A.addColumn(c.type, sub, { title: c.title + ' copy', settings: JSON.parse(JSON.stringify(c.settings)) }) },
        '-', { label: 'Delete column', icon: Trash2, danger: true, onClick: () => A.deleteColumn(c, sub) },
      ]} />}
      {labels && <Popover anchor={labels} onClose={() => setLabels(null)} width={290}><div className="mini-label">Labels for “{c.title}”</div><LabelEditor col={c} onUpdateColumn={(nc) => A.updateColumn(nc, sub)} /></Popover>}
    </div>
  );
}

function ItemRow({ it, g, columns, A, ctx, leadW, drop, setDrop, open, toggle }) {
  const subs = ctx.subsByParent[it.id] || [];
  const nUp = ctx.updateCounts[it.id] || 0;
  const rowRef = useRef();
  const cctx = { ...ctx, groupColor: g.color, done: ctx.doneOf(it), item: it };
  const sel = ctx.selected.has(it.id);
  const [menu, setMenu] = useState(null);
  return (
    <div ref={rowRef} className={'trow item-row' + (sel ? ' selected' : '') + (drop?.before === it.id ? ' drop-line' : '')} data-testid="item-row"
      onDragOver={(e) => { if (drag?.kind === 'item' && drag.id !== it.id) { e.preventDefault(); setDrop({ before: it.id, group: null }); } }}
      onDrop={(e) => { e.preventDefault(); if (drag?.kind === 'item' && drag.id !== it.id) A.moveItem(drag.id, g.id, it.id); setDrop(null); }}>
      <div className="cell lead" style={{ width: leadW }}>
        <button className="icon-btn row-menu hover-show" onClick={(e) => setMenu(e.currentTarget)} data-testid="row-menu"><MoreHorizontal size={15} /></button>
        {menu && <Menu anchor={menu} onClose={() => setMenu(null)} items={[
          { label: 'Open item', icon: Maximize2, onClick: () => A.openItem(it.id) },
          { label: 'Add subitem', icon: Plus, onClick: async () => { await A.addItem(g.id, 'Subitem', it.id); if (!open) toggle(); } },
          { label: 'Duplicate', icon: Copy, onClick: () => A.duplicateItem(it.id) },
          ...ctx.board.groups.filter((x) => x.id !== g.id).map((x) => ({ label: 'Move to ' + x.name, icon: ArrowRight, onClick: () => A.moveItem(it.id, x.id, null) })),
          '-', { label: 'Delete item', icon: Trash2, danger: true, onClick: async () => { if (await dialog.confirm(`Delete “${it.name}”?`)) A.deleteItem(it.id); } },
        ]} />}
        <span className="grip" draggable onDragStart={(e) => { drag = { kind: 'item', id: it.id }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id); if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 20, 18); }} title="Drag to move"><GripVertical size={15} /></span>
        <span className="lead-check"><input type="checkbox" checked={sel} onChange={() => A.toggleSelect(it.id)} /></span>
        <button className={'sub-toggle' + (subs.length ? ' has' : '')} onClick={toggle} title="Subitems" data-testid="sub-toggle">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{subs.length > 0 && <span className="sub-n">{subs.length}</span>}</button>
        {isPhone() ? <span className="item-name" onClick={() => A.openItem(it.id)} data-testid="item-name">{it.name}</span>
          : <EditableText value={it.name} onSave={(name) => name && A.updateItem(it.id, { name })} className="item-name" testid="item-name" />}
        <button className="icon-btn open-btn hover-show" onClick={() => A.openItem(it.id)} title="Open" data-testid="open-item"><Maximize2 size={14} /> Open</button>
        <button className={'bubble' + (nUp ? ' has' : '')} onClick={() => A.openItem(it.id)} title="Updates" data-testid="open-updates"><MessageCircle size={18} />{nUp > 0 && <span className="bubble-n">{nUp}</span>}</button>
      </div>
      {columns.map((c) => (
        <div key={c.id} className={'cell c-' + c.type} style={{ width: W(c) }}>
          <Cell col={c} value={it.vals[c.id]} ctx={cctx} onChange={(v) => A.updateItem(it.id, { vals: { [c.id]: v } })} onUpdateColumn={(nc) => A.updateColumn(nc)} />
        </div>
      ))}
      <div className="cell" style={{ width: 60 }} />
    </div>
  );
}

function SubItems({ parent, g, A, ctx, leadW }) {
  const subs = ctx.subsByParent[parent.id] || [];
  const cols = ctx.board.sub_columns;
  const [nn, setNn] = useState('');
  const add = () => { if (nn.trim()) { A.addItem(g.id, nn.trim(), parent.id); setNn(''); } };
  return (
    <div className="subitems" data-testid="subitems">
      <HeaderRow columns={cols} A={A} ctx={ctx} leadW={leadW} sub />
      {subs.map((s) => (
        <div key={s.id} className="trow item-row sub" data-testid="subitem-row">
          <div className="cell lead" style={{ width: leadW }}>
            <EditableText value={s.name} onSave={(name) => name && A.updateItem(s.id, { name })} className="item-name" />
            <button className="icon-btn hover-show" onClick={() => A.openItem(s.id)} title="Open"><Maximize2 size={14} /></button>
            <button className="icon-btn hover-show" onClick={() => A.deleteItem(s.id)} title="Delete"><Trash2 size={14} /></button>
          </div>
          {cols.map((c) => <div key={c.id} className={'cell c-' + c.type} style={{ width: W(c) }}><Cell col={c} value={s.vals[c.id]} ctx={{ ...ctx, groupColor: g.color, item: s }} onChange={(v) => A.updateItem(s.id, { vals: { [c.id]: v } })} onUpdateColumn={(nc) => A.updateColumn(nc, true)} /></div>)}
          <div className="cell" style={{ width: 60 }} />
        </div>
      ))}
      <div className="trow add-row sub"><div className="cell lead add" style={{ width: leadW }}><input placeholder="+ Add subitem" value={nn} onChange={(e) => setNn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} data-testid="add-subitem-input" /></div></div>
    </div>
  );
}
