import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Modal, Avatar, dialog } from './ui.jsx';
import { Mail, Lock, LogIn, Eye, EyeOff, Plus, KeyRound, Trash2, Shield, User, Copy } from 'lucide-react';

export function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await api.post('/auth/login', { email, password: pw }); onLogin(r.user); }
    catch (x) { setErr(x.message || 'Could not log in'); } finally { setBusy(false); }
  };
  return (
    <div className="login-page">
      <div className="login-left">
        <a className="brand big"><span className="logo"><i style={{ background: '#e2445c' }} /><i style={{ background: '#fdab3d' }} /><i style={{ background: '#00c875' }} /></span><b>mondo</b></a>
        <form className="login-card" onSubmit={go}>
          <h1>Welcome back 👋</h1>
          <p className="muted">Log in to your work.</p>
          <label className="mini-label">Email</label>
          <div className="login-field"><Mail size={18} /><input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" data-testid="login-email" /></div>
          <label className="mini-label">Password</label>
          <div className="login-field"><Lock size={18} /><input type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" data-testid="login-password" />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} title={show ? 'Hide' : 'Show'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {err && <div className="login-err" data-testid="login-error">⚠️ {err}</div>}
          <button className="btn primary big full" disabled={busy || !email || !pw} data-testid="login-submit"><LogIn size={18} /> {busy ? 'Logging in…' : 'Log in'}</button>
          <p className="muted small center">No account? Ask your admin.</p>
        </form>
      </div>
      <div className="login-right">
        <div className="login-art">
          {[['Working on it', '#fdab3d'], ['Done', '#00c875'], ['Stuck', '#e2445c'], ['Done', '#00c875'], ['Planned', '#a25ddc']].map(([l, c], k) => (
            <div key={k} className="art-row" style={{ animationDelay: k * 0.12 + 's' }}><span className="art-bar" style={{ background: ['#579bfc', '#a25ddc', '#00c875', '#fdab3d', '#ff158a'][k] }} /><span className="art-name" /><span className="art-pill" style={{ background: c }}>{l}</span></div>
          ))}
        </div>
        <h2>📋 Boards · ✅ Status · 💬 Updates</h2>
        <p>All your work in one colourful place.</p>
      </div>
    </div>
  );
}

export function PasswordModal({ onClose }) {
  const [old, setOld] = useState(''); const [pw, setPw] = useState(''); const [msg, setMsg] = useState('');
  return (
    <Modal onClose={onClose} width={420}>
      <h2 className="modal-title"><KeyRound /> Change password</h2>
      <label className="mini-label">Old password</label><input className="text-input" type="password" value={old} onChange={(e) => setOld(e.target.value)} />
      <label className="mini-label">New password (8+)</label><input className="text-input" type="text" value={pw} onChange={(e) => setPw(e.target.value)} />
      {msg && <div className="login-err">{msg}</div>}
      <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={pw.length < 8} onClick={async () => { try { await api.post('/auth/password', { old, password: pw }); onClose(); dialog.confirm('✅ Password changed', 'OK'); } catch (e) { setMsg(e.message); } }}>Save</button></div>
    </Modal>
  );
}

export function UsersPage({ ctx, me }) {
  const [users, setUsers] = useState([]); const [add, setAdd] = useState(false); const [shown, setShown] = useState(null);
  const load = () => api.get('/users').then(setUsers);
  useEffect(() => { load(); }, []);
  const P = (u) => ctx.people.find((p) => p.id === u.person_id) || { name: u.name, color: '#579bfc' };
  const reset = async (u) => { const { password } = await api.get('/users/suggest-password'); await api.patch('/users/' + u.id, { password }); setShown({ email: u.email, password }); };
  return (
    <div className="home">
      <div className="home-hello"><div><h1>👥 Users</h1><p className="muted">Who can log in.</p></div><button className="btn primary big" onClick={() => setAdd(true)} data-testid="add-user"><Plus size={18} /> Add user</button></div>
      <div className="home-card" style={{ marginTop: 20 }}>
        {users.map((u) => (
          <div key={u.id} className="user-row" data-testid="user-row">
            <Avatar person={P(u)} size={36} />
            <div className="grow"><b>{u.name}</b><div className="muted small">{u.email}</div></div>
            <span className={'role ' + u.role}>{u.role === 'admin' ? <><Shield size={13} /> Group administrator</> : <><User size={13} /> Asset manager</>}</span>
            <span className="muted small">{u.last_login ? 'Last in: ' + new Date(u.last_login).toLocaleDateString('en-GB') : 'Never logged in'}</span>
            {u.id !== me.id && <>
              <button className="btn small" onClick={async () => { await api.patch('/users/' + u.id, { role: u.role === 'admin' ? 'member' : 'admin' }); load(); }}>{u.role === 'admin' ? 'Make asset manager' : 'Make group admin'}</button>
              <button className="btn small" onClick={() => reset(u)}><KeyRound size={13} /> New password</button>
              <button className="icon-btn" onClick={async () => { if (await dialog.confirm(`Remove ${u.name}?`)) { await api.del('/users/' + u.id); load(); } }}><Trash2 size={16} /></button>
            </>}
          </div>
        ))}
      </div>
      {add && <AddUser onClose={() => setAdd(false)} onDone={async (r) => { setAdd(false); setShown(r); await ctx.reload(); load(); }} />}
      {shown && <Modal onClose={() => setShown(null)} width={460}>
        <h2 className="modal-title">🔑 Login for {shown.email}</h2>
        <p className="muted">Send this to the person. It is shown only now.</p>
        <div className="pw-box" data-testid="new-password">{shown.password}</div>
        <div className="modal-actions"><button className="btn" onClick={() => navigator.clipboard?.writeText(`${location.origin}\n${shown.email}\n${shown.password}`)}><Copy size={15} /> Copy</button><button className="btn primary" onClick={() => setShown(null)}>Done</button></div>
      </Modal>}
    </div>
  );
}

function AddUser({ onClose, onDone }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState('member'); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { api.get('/users/suggest-password').then((r) => setPw(r.password)); }, []);
  return (
    <Modal onClose={onClose} width={460}>
      <h2 className="modal-title"><Plus /> Add user</h2>
      <label className="mini-label">Name</label><input className="text-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} data-testid="user-name" />
      <label className="mini-label">Email</label><input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="user-email" />
      <label className="mini-label">Password</label><input className="text-input" value={pw} onChange={(e) => setPw(e.target.value)} />
      <label className="mini-label">Role</label>
      <div className="row-gap"><button className={'btn' + (role === 'member' ? ' primary' : '')} onClick={() => setRole('member')}><User size={15} /> Asset manager</button><button className={'btn' + (role === 'admin' ? ' primary' : '')} onClick={() => setRole('admin')}><Shield size={15} /> Group administrator</button></div>
      {err && <div className="login-err">⚠️ {err}</div>}
      <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!name || !email || pw.length < 8} data-testid="user-save" onClick={async () => { try { await api.post('/users', { name, email, password: pw, role }); onDone({ email, password: pw }); } catch (e) { setErr(e.message); } }}>Add user</button></div>
    </Modal>
  );
}
