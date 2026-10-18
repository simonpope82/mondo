import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initials } from './constants.js';

export function Popover({ anchor, onClose, children, width = 240, align = 'left', className = '' }) {
  const ref = useRef();
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const h = ref.current?.offsetHeight || 200;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    let left = align === 'right' ? r.right - width : align === 'center' ? r.left + r.width / 2 - width / 2 : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top, left });
  }, [anchor, width, align]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && !(anchor && anchor.contains(e.target))) onClose(); };
    const k = (e) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [anchor, onClose]);
  return createPortal(<div ref={ref} className={'popover ' + className} style={{ top: pos.top, left: pos.left, width }} onMouseDown={(e) => e.stopPropagation()}>{children}</div>, document.body);
}

export function Menu({ anchor, onClose, items, width = 220 }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={width}>
      <div className="menu">
        {items.filter(Boolean).map((it, k) => it === '-' ? <div key={k} className="menu-sep" /> : (
          <button key={k} className={'menu-item' + (it.danger ? ' danger' : '')} onClick={() => { onClose(); it.onClick(); }}>
            {it.icon && <it.icon size={16} />}<span>{it.label}</span>
          </button>
        ))}
      </div>
    </Popover>
  );
}

export function EditableText({ value, onSave, className = '', placeholder = '', multiline = false, autoEdit = false, testid }) {
  const [edit, setEdit] = useState(autoEdit);
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  const save = () => { setEdit(false); const t = v.trim(); if (t !== (value || '')) onSave(t); };
  if (edit) {
    const P = { autoFocus: true, value: v, onChange: (e) => setV(e.target.value), onBlur: save, className: 'edit-input ' + className, onFocus: (e) => e.target.select(), 'data-testid': testid ? testid + '-input' : undefined,
      onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') { setV(value || ''); setEdit(false); } } };
    return multiline ? <textarea {...P} rows={3} /> : <input {...P} />;
  }
  return <span className={'editable ' + className + (value ? '' : ' placeholder')} data-testid={testid} onClick={(e) => { e.stopPropagation(); setEdit(true); }} title="Click to edit">{value || placeholder}</span>;
}

export function Avatar({ person, size = 26, ring }) {
  if (!person) return null;
  return <span className="avatar" title={person.name} style={{ width: size, height: size, background: person.color, fontSize: size * 0.42, boxShadow: ring ? '0 0 0 2px #fff' : undefined }}>{initials(person.name)}</span>;
}

let dialogSetter = null;
export const dialog = {
  confirm: (text, okLabel = 'Delete') => new Promise((res) => dialogSetter({ kind: 'confirm', text, okLabel, res })),
  prompt: (text, def = '') => new Promise((res) => dialogSetter({ kind: 'prompt', text, def, res })),
};
export function DialogHost() {
  const [d, setD] = useState(null);
  const [v, setV] = useState('');
  dialogSetter = (x) => { setV(x.def || ''); setD(x); };
  if (!d) return null;
  const close = (r) => { d.res(r); setD(null); };
  return (
    <Modal onClose={() => close(d.kind === 'prompt' ? null : false)} width={420}>
      <h3 className="modal-title">{d.text}</h3>
      {d.kind === 'prompt' && <input className="text-input" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && v.trim() && close(v.trim())} data-testid="prompt-input" />}
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => close(d.kind === 'prompt' ? null : false)}>Cancel</button>
        {d.kind === 'confirm' ? <button className="btn danger" onClick={() => close(true)} data-testid="confirm-ok">{d.okLabel}</button>
          : <button className="btn primary" disabled={!v.trim()} onClick={() => close(v.trim())} data-testid="prompt-ok">OK</button>}
      </div>
    </Modal>
  );
}

export function Modal({ children, onClose, width = 560 }) {
  return createPortal(
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </div>, document.body);
}

export function ColorGrid({ colors, value, onPick }) {
  return <div className="color-grid">{colors.map((c) => <button key={c} className={'swatch' + (c === value ? ' on' : '')} style={{ background: c }} onClick={() => onPick(c)} />)}</div>;
}
