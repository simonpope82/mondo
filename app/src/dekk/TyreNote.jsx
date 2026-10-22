// 🛞 "Notat fra forrige gang" + new-tyre choices (booking page, confirmation, Min side).
import React from 'react';
import { AlertTriangle, StickyNote, CircleHelp } from 'lucide-react';
const mm = (n) => String(n).replace('.', ',');
export function PrevNote({ info }) {
  if (!info?.known || (!info.worn && !info.note)) return null; const T = info.texts;
  return <div className="tn-card" data-testid="prev-note"><div className="tn-h"><StickyNote size={20} /> <b>{T.prev_title}</b></div>
    {info.worn && <div className={'tn-worn lv-' + info.worn.level}><AlertTriangle size={18} /><div><b>{info.worn.level === 'Ja' ? T.worn_detail : 'Dekkene begynner å bli slitte'}</b><small>{info.worn.season} · minst {mm(info.worn.min)} mm{info.worn.depths?.length ? ' (' + info.worn.depths.map(mm).join(' / ') + ')' : ''}</small></div></div>}
    {info.note && <p className="tn-note" data-testid="prev-note-staff">💬 {info.note}</p>}</div>;
}
export function TyreChoice({ worn, texts: T, value, onChoose, saved }) {
  if (!T) return null;
  const opts = worn ? [['yes', T.choice_yes], ['offer', T.choice_offer], ['no', T.choice_no]] : [['generic_yes', T.generic_yes], ['generic_no', T.generic_no]];
  return <div className={'tn-choice' + (worn ? ' worn' : '')} data-testid="tyre-choice"><div className="tn-q">{worn ? <AlertTriangle size={20} /> : <CircleHelp size={20} />}<b>{worn ? T.worn_line : T.generic_q}</b>{worn && worn.min != null && <small>{worn.season}: {mm(worn.min)} mm</small>}</div>
    <div className="tn-opts">{opts.map(([k, t]) => <button type="button" key={k} data-testid={'tc-' + k} className={'tn-opt' + (value === k ? ' on' : '')} onClick={() => onChoose(k)}>{t}</button>)}</div>
    {saved && <div className="tn-saved" data-testid="tc-saved">✅ Lagret: {saved}</div>}</div>;
}
