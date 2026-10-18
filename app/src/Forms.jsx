import React, { useEffect, useState } from 'react';
import { Modal, Avatar } from './ui.jsx';
import { api } from './api.js';
import { COLUMN_TYPES } from './constants.js';
import { Copy, ExternalLink, Check } from 'lucide-react';

const FORM_TYPES = ['text', 'long_text', 'numbers', 'date', 'status', 'priority', 'dropdown', 'people', 'phone', 'email', 'link', 'location', 'checkbox'];

export function FormModal({ board, A, onClose }) {
  const f = board.form || {};
  const ok = board.columns.filter((c) => FORM_TYPES.includes(c.type));
  const fields = f.fields || ok.map((c) => c.id);
  const set = (p) => A.patchBoard({ form: { ...f, fields, ...p } });
  const url = `${window.location.origin}/#/form/${board.id}`;
  const [copied, setCopied] = useState(false);
  return (
    <Modal onClose={onClose} width={620}>
      <h2 className="modal-title">📝 Form for this board</h2>
      <p className="muted">People fill in the form → a new item lands on the board.</p>
      <label className="mini-label">Form title</label>
      <input className="text-input" defaultValue={f.title || board.name} onBlur={(e) => set({ title: e.target.value })} />
      <label className="mini-label">Short text on top</label>
      <input className="text-input" defaultValue={f.description || ''} placeholder="e.g. Tell us what is wrong" onBlur={(e) => set({ description: e.target.value })} />
      <label className="mini-label">New items go to group</label>
      <select className="text-input" value={f.group || board.groups[0]?.id} onChange={(e) => set({ group: e.target.value })}>{board.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      <label className="share-toggle"><span className="switch"><input type="checkbox" checked={!!f.public} onChange={(e) => set({ public: e.target.checked })} data-testid="form-public" /><span /></span> 🌍 Anyone with the link can fill in (no login)</label>
      <label className="mini-label">Questions</label>
      <div className="form-fields">{ok.map((c) => { const T = COLUMN_TYPES[c.type]; return <label key={c.id} className="menu-item"><input type="checkbox" checked={fields.includes(c.id)} onChange={(e) => set({ fields: e.target.checked ? [...fields, c.id] : fields.filter((x) => x !== c.id) })} /><T.icon size={15} color={T.color} /> {c.title}</label>; })}</div>
      <div className="form-link"><input className="text-input" readOnly value={url} data-testid="form-url" />
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}>{copied ? <Check size={15} /> : <Copy size={15} />} Copy</button>
        <a className="btn primary" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open</a></div>
    </Modal>
  );
}

export function PublicForm({ boardId }) {
  const [f, setF] = useState(null); const [name, setName] = useState(''); const [vals, setVals] = useState({}); const [done, setDone] = useState(false);
  useEffect(() => { api.get('/forms/' + boardId).then(setF).catch(() => setF({ error: true })); }, [boardId]);
  if (!f) return <div className="loading">Loading…</div>;
  if (f.error) return <div className="pub-form"><div className="pub-card center"><div style={{ fontSize: 54 }}>🔒</div><h1>Form not shared</h1><p className="muted">Ask the owner to share it, or <a href="#/home">log in</a>.</p></div></div>;
  const set = (k, v) => setVals((x) => ({ ...x, [k]: v }));
  if (done) return <div className="pub-form"><div className="pub-card center"><div style={{ fontSize: 64 }}>✅</div><h1>Thank you!</h1><p>Your answer is sent.</p><button className="btn primary" onClick={() => { setDone(false); setName(''); setVals({}); }}>Send another</button></div></div>;
  return (
    <div className="pub-form">
      <div className="pub-card">
        <div className="pub-top">{f.board.icon}</div>
        <h1>{f.title}</h1>{f.description && <p className="muted">{f.description}</p>}
        <label className="mini-label">Name *</label>
        <input className="text-input big" value={name} onChange={(e) => setName(e.target.value)} data-testid="form-name" />
        {f.columns.map((c) => (
          <div key={c.id}>
            <label className="mini-label">{c.title}</label>
            {(c.type === 'status' || c.type === 'priority') ? <div className="label-list row">{c.settings.labels.filter((l) => l.label).map((l) => <button key={l.id} className={'label-pill' + (vals[c.id] === l.id ? ' picked' : '')} style={{ background: l.color }} onClick={() => set(c.id, vals[c.id] === l.id ? null : l.id)}>{l.label}</button>)}</div>
              : c.type === 'dropdown' ? <div className="chips">{c.settings.options.map((o) => <button key={o.id} className={'tag big' + ((vals[c.id] || []).includes(o.id) ? ' picked' : '')} onClick={() => { const cur = vals[c.id] || []; set(c.id, cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id]); }}>{o.label}</button>)}</div>
              : c.type === 'people' ? <div className="person-filter">{f.people.map((p) => <button key={p.id} className={'pf' + ((vals[c.id] || []).includes(p.id) ? ' on' : '')} onClick={() => { const cur = vals[c.id] || []; set(c.id, cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]); }}><Avatar person={p} size={30} /><span>{p.name.split(' ')[0]}</span></button>)}</div>
              : c.type === 'checkbox' ? <input type="checkbox" checked={!!vals[c.id]} onChange={(e) => set(c.id, e.target.checked)} />
              : c.type === 'long_text' ? <textarea className="text-input" rows={4} value={vals[c.id] || ''} onChange={(e) => set(c.id, e.target.value)} />
              : c.type === 'link' ? <input className="text-input" value={vals[c.id]?.url || ''} onChange={(e) => set(c.id, { url: e.target.value, text: '' })} />
              : <input className="text-input" type={c.type === 'numbers' ? 'number' : c.type === 'date' ? 'date' : c.type === 'email' ? 'email' : 'text'} value={vals[c.id] ?? ''} onChange={(e) => set(c.id, c.type === 'numbers' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} />}
          </div>
        ))}
        <button className="btn primary big full" disabled={!name.trim()} onClick={async () => { await api.post('/forms/' + boardId, { name: name.trim(), vals }); setDone(true); }} data-testid="form-submit">Send ✉️</button>
        <div className="muted small center">Made with mondo</div>
      </div>
    </div>
  );
}
