import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { DialogHost, dialog, Menu, Modal } from './ui.jsx';
import Board from './Board.jsx';
import Home from './Home.jsx';
import { PublicForm } from './Forms.jsx';
import { Login, UsersPage, PasswordModal } from './Auth.jsx';
import { InstallBanner, OfflineBar, clearOfflineData, useInstall } from './pwa.jsx';
import { Notifications } from './Home.jsx';
import AssetsModule from './assets/Assets.jsx';
import { PublicScan } from './assets/Scan.jsx';
import Book from './dekk/Book.jsx';
import Pay from './dekk/Pay.jsx';
import DekkAdmin from './dekk/DekkAdmin.jsx';
import Site from './dekk/Site.jsx';
import Portal from './dekk/Portal.jsx';
import { Tag, Camera } from 'lucide-react';
if (window.location.pathname === '/book' || window.location.pathname === '/book/') history.replaceState(null, '', '/#/book' + window.location.search);
if (/^\/minside\/?$/.test(window.location.pathname)) history.replaceState(null, '', '/#/minside');
const SITE = (window.location.pathname.match(/^\/([a-z0-9-]{2,40})\/?$/) || [])[1];
// sticker URLs look like https://<host>/s/ABCD-EFGH → hand over to the hash router
if (window.location.pathname.startsWith('/s/')) history.replaceState(null, '', '/#/scan/' + encodeURIComponent(decodeURIComponent(window.location.pathname.slice(3))));
import { LogOut, KeyRound, UsersRound, House, Plus, Search, ChevronDown, Star, MoreHorizontal, Pencil, Copy, Trash2, Briefcase, Check, ChevronsLeft, ChevronsRight } from 'lucide-react';

function useHash() {
  const [h, setH] = useState(window.location.hash || '#/home');
  useEffect(() => { const f = () => setH(window.location.hash || '#/home'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
}
export const go = (h) => { window.location.hash = h; };

export default function App() {
  const [boot, setBoot] = useState(null);
  const [user, setUser] = useState(undefined);
  const [pwModal, setPwModal] = useState(false);
  const [wsId, setWsId] = useState(localStorage.getItem('ws') || null);
  const [newBoard, setNewBoard] = useState(false);
  const [collapsed, setCollapsed] = useState(window.innerWidth < 800);
  const hash = useHash();
  const reload = useCallback(async () => { const b = await api.get('/bootstrap'); setBoot(b); return b; }, []);
  useEffect(() => { api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)); }, []);
  useEffect(() => { if (user) reload(); }, [user, reload]);
  useEffect(() => { const f = () => { setUser(null); setBoot(null); }; window.addEventListener('mondo-logout', f); return () => window.removeEventListener('mondo-logout', f); }, []);
  useEffect(() => { if (window.innerWidth < 800) setCollapsed(true); }, [hash]);
  const boardId = hash.startsWith('#/board/') ? hash.split('/')[2] : null;
  useEffect(() => { // keep workspace in sync with open board
    if (boot && boardId) { const b = boot.boards.find((x) => x.id === boardId); if (b && b.workspace_id !== wsId) setWsId(b.workspace_id); }
  }, [boardId, boot]);
  useEffect(() => { if (wsId) localStorage.setItem('ws', wsId); }, [wsId]);
  if (SITE && !window.location.hash) return <Site slug={SITE} />;
  if (hash.startsWith('#/site/')) return <Site slug={hash.split('/')[2]} />;
  if (hash.startsWith('#/minside')) return <Portal />;
  if (hash.startsWith('#/book')) return <Book />;
  if (hash.startsWith('#/betal/')) return <Pay token={hash.slice(8)} />;
  if (hash.startsWith('#/form/')) return <PublicForm boardId={hash.split('/')[2]} />;
  if (user === undefined) return <div className="loading">Loading…</div>;
  if (!user && hash.startsWith('#/scan/')) return <PublicScan code={hash.split('/')[2]} />;
  if (!user) return <Login onLogin={(u) => setUser(u)} />;
  if (!boot) return <div className="loading">Loading…</div>;
  const logout = async () => { await api.post('/auth/logout').catch(() => {}); clearOfflineData(); setUser(null); setBoot(null); };
  const ws = boot.workspaces.find((w) => w.id === wsId) || boot.workspaces[0];
  const ctx = {
    people: boot.people, me: boot.me, boot, reload,
    addPerson: async (name) => { const p = await api.post('/people', { name }); await reload(); return p; },
  };
  return (
    <div className={'app' + (collapsed ? ' side-collapsed' : '')}>
      <TopBar user={user} onLogout={logout} onPassword={() => setPwModal(true)} />
      <div className="app-body">
        <Sidebar boot={boot} ws={ws} setWsId={setWsId} reload={reload} boardId={boardId} hash={hash} onNewBoard={() => setNewBoard(true)} collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="main">
          {hash.startsWith('#/dekk') ? <DekkAdmin hash={hash} user={user} /> : hash.startsWith('#/assets') || hash.startsWith('#/scan') ? <AssetsModule hash={hash} ctx={ctx} user={user} /> : boardId ? <Board key={boardId} boardId={boardId} ctx={ctx} /> : hash.startsWith('#/users') && user.role === 'admin' ? <UsersPage ctx={ctx} me={user} /> : <Home ctx={ctx} user={user} onNewBoard={() => setNewBoard(true)} />}
        </main>
      </div>
      {newBoard && <NewBoardModal boot={boot} ws={ws} onClose={() => setNewBoard(false)} onCreated={async (id) => { setNewBoard(false); await reload(); go('#/board/' + id); }} />}
      {pwModal && <PasswordModal onClose={() => setPwModal(false)} />}
      <InstallBanner />
      <OfflineBar />
      <DialogHost />
    </div>
  );
}

function TopBar({ user, onLogout, onPassword }) {
  const [menu, setMenu] = useState(null);
  const inst = useInstall();
  const ini = (user?.name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  return (
    <header className="topbar">
      <a className="brand" href="#/home"><span className="logo"><i style={{ background: '#e2445c' }} /><i style={{ background: '#fdab3d' }} /><i style={{ background: '#00c875' }} /></span><b>mondo</b><span className="brand-sub">work management</span></a>
      <div className="topbar-right"><button className="icon-btn top-scan" onClick={() => go('#/scan')} title="Scan QR tag" data-testid="top-scan"><Camera size={20} /><span>Scan</span></button><Notifications /><button className="avatar-btn" onClick={(e) => setMenu(e.currentTarget)} data-testid="user-menu" title={user?.name}><span className="avatar" style={{ background: '#579bfc', width: 32, height: 32, fontSize: 13 }}>{ini}</span></button>
        {menu && <Menu anchor={menu} onClose={() => setMenu(null)} width={230} items={[
          { label: `${user.name} (${user.email})`, icon: UsersRound, onClick: () => {} }, '-',
          user.role === 'admin' && { label: 'Users', icon: UsersRound, onClick: () => go('#/users') },
          { label: 'Activate asset tag', icon: Tag, onClick: () => go('#/scan') },
          { label: 'Change password', icon: KeyRound, onClick: onPassword },
          inst.canPrompt && { label: 'Install app 📲', icon: KeyRound, onClick: inst.install },
          { label: 'Log out', icon: LogOut, danger: true, onClick: onLogout },
        ]} />}</div>
    </header>
  );
}

function Sidebar({ boot, ws, setWsId, reload, boardId, hash, onNewBoard, collapsed, setCollapsed }) {
  const [wsMenu, setWsMenu] = useState(null);
  const [boardMenu, setBoardMenu] = useState(null);
  const [q, setQ] = useState('');
  const wsRef = useRef();
  if (collapsed) return <aside className="sidebar mini"><button className="icon-btn" onClick={() => setCollapsed(false)} title="Open menu"><ChevronsRight size={18} /></button></aside>;
  const boards = boot.boards.filter((b) => b.workspace_id === ws?.id && b.name.toLowerCase().includes(q.toLowerCase()));
  const favs = boot.boards.filter((b) => b.favorite);
  const BoardLink = ({ b }) => (
    <div className={'side-board' + (b.id === boardId ? ' active' : '')} onClick={() => go('#/board/' + b.id)} data-testid="side-board">
      <span className="side-icon">{b.icon}</span><span className="side-name">{b.name}</span>
      <button className="icon-btn hover-show" onClick={(e) => { e.stopPropagation(); setBoardMenu({ el: e.currentTarget, b }); }}><MoreHorizontal size={16} /></button>
    </div>
  );
  const addWs = async () => { const name = await dialog.prompt('Name of new workspace', 'New workspace'); if (!name) return; const { id } = await api.post('/workspaces', { name }); await reload(); setWsId(id); };
  return (
    <aside className="sidebar">
      <div className="side-top">
        <a className={'side-link' + (hash.startsWith('#/home') ? ' active' : '')} href="#/home"><House size={18} /> Home</a>
        <button className="icon-btn" onClick={() => setCollapsed(true)} title="Hide menu"><ChevronsLeft size={18} /></button>
      </div>
      <a className={'side-link' + (hash.startsWith('#/assets') || hash.startsWith('#/scan') ? ' active' : '')} href="#/assets" data-testid="side-assets"><Tag size={18} /> Assets</a>
      <a className={'side-link' + (hash.startsWith('#/dekk') ? ' active' : '')} href="#/dekk" data-testid="side-dekk"><span style={{ fontSize: 17, width: 18, textAlign: 'center' }}>🛞</span> Dekkhotell</a>
      {boot.user?.role === 'admin' && <a className={'side-link' + (hash.startsWith('#/users') ? ' active' : '')} href="#/users" data-testid="side-users"><UsersRound size={18} /> Users</a>}
      {favs.length > 0 && <div className="side-section"><div className="side-title"><Star size={14} fill="#ffcb00" color="#ffcb00" /> Favourites</div>{favs.map((b) => <BoardLink key={b.id} b={b} />)}</div>}
      <div className="side-section">
        <div className="side-title"><Briefcase size={14} /> Workspace</div>
        <button ref={wsRef} className="ws-switch" onClick={() => setWsMenu(true)} data-testid="ws-switch">
          <span className="ws-icon" style={{ background: ws?.color || '#579bfc' }}>{(ws?.name || '?')[0]}</span><span className="side-name">{ws?.name || 'No workspace'}</span><ChevronDown size={16} />
        </button>
        {wsMenu && <Menu anchor={wsRef.current} onClose={() => setWsMenu(null)} width={240} items={[
          ...boot.workspaces.map((w) => ({ label: w.name, icon: w.id === ws?.id ? Check : Briefcase, onClick: () => setWsId(w.id) })), '-',
          { label: 'Add workspace', icon: Plus, onClick: addWs },
          ws && { label: 'Rename workspace', icon: Pencil, onClick: async () => { const n = await dialog.prompt('Rename workspace', ws.name); if (n) { await api.patch('/workspaces/' + ws.id, { name: n }); reload(); } } },
          ws && { label: 'Delete workspace', icon: Trash2, danger: true, onClick: async () => { if (await dialog.confirm(`Delete “${ws.name}” and all its boards?`)) { await api.del('/workspaces/' + ws.id); const b = await reload(); setWsId(b.workspaces[0]?.id); go('#/home'); } } },
        ]} />}
        <div className="side-actions">
          <button className="btn primary small grow" onClick={() => ws ? onNewBoard() : addWs()} data-testid="add-board"><Plus size={16} /> {ws ? 'New board' : 'New workspace'}</button>
        </div>
        <div className="side-search"><Search size={14} /><input placeholder="Search boards" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="side-boards">{boards.map((b) => <BoardLink key={b.id} b={b} />)}{!boards.length && <div className="muted small pad">No boards yet</div>}</div>
      </div>
      {boardMenu && <Menu anchor={boardMenu.el} onClose={() => setBoardMenu(null)} items={[
        { label: boardMenu.b.favorite ? 'Remove favourite' : 'Add to favourites', icon: Star, onClick: async () => { await api.patch('/boards/' + boardMenu.b.id, { favorite: !boardMenu.b.favorite }); reload(); } },
        { label: 'Rename', icon: Pencil, onClick: async () => { const n = await dialog.prompt('Rename board', boardMenu.b.name); if (n) { await api.patch('/boards/' + boardMenu.b.id, { name: n }); reload(); window.dispatchEvent(new Event('board-refresh')); } } },
        { label: 'Duplicate', icon: Copy, onClick: async () => { const { id } = await api.post(`/boards/${boardMenu.b.id}/duplicate`); await reload(); go('#/board/' + id); } },
        ...boot.workspaces.filter((w) => w.id !== boardMenu.b.workspace_id).map((w) => ({ label: 'Move to ' + w.name, icon: Briefcase, onClick: async () => { await api.patch('/boards/' + boardMenu.b.id, { workspace_id: w.id }); reload(); } })),
        '-',
        { label: 'Delete board', icon: Trash2, danger: true, onClick: async () => { if (await dialog.confirm(`Delete board “${boardMenu.b.name}”?`)) { await api.del('/boards/' + boardMenu.b.id); await reload(); if (boardId === boardMenu.b.id) go('#/home'); } } },
      ]} />}
    </aside>
  );
}

function NewBoardModal({ boot, ws, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState('blank');
  const [wid, setWid] = useState(ws?.id);
  const create = async () => { const r = await api.post('/boards', { name: name.trim() || undefined, template: tpl, workspace_id: wid }); onCreated(r.id); };
  return (
    <Modal onClose={onClose} width={640}>
      <h2 className="modal-title">✨ New board</h2>
      <label className="mini-label">Board name</label>
      <input className="text-input big" autoFocus placeholder={boot.templates.find((t) => t.key === tpl)?.label} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} data-testid="new-board-name" />
      <label className="mini-label">Pick a start</label>
      <div className="tpl-grid">
        {boot.templates.map((t) => (
          <button key={t.key} className={'tpl' + (tpl === t.key ? ' on' : '')} onClick={() => setTpl(t.key)} data-testid={'tpl-' + t.key}>
            <span className="tpl-icon">{t.icon}</span><b>{t.label}</b><span className="muted small">{t.desc}</span>
          </button>
        ))}
      </div>
      <label className="mini-label">Workspace</label>
      <select className="text-input" value={wid} onChange={(e) => setWid(e.target.value)}>{boot.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={create} data-testid="create-board">Create board</button></div>
    </Modal>
  );
}
