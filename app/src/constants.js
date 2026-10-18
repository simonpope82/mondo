import { CalendarDays, Timer, Network, Copy as Mirror, History, Clock, MapPin, Type, CircleDot, Users, Calendar, GanttChart, Hash, ListChecks, CheckSquare, Flag, Link2, AlignLeft, Phone, Mail } from 'lucide-react';

export const PALETTE = ['#00c875', '#9cd326', '#cab641', '#ffcb00', '#fdab3d', '#ff642e', '#e2445c', '#bb3354', '#ff158a', '#ff5ac4', '#a25ddc', '#784bd1', '#579bfc', '#0086c0', '#66ccff', '#037f4c', '#225091', '#333333', '#7f5347', '#c4c4c4'];
export const GROUP_COLORS = ['#579bfc', '#00c875', '#a25ddc', '#fdab3d', '#e2445c', '#ff642e', '#037f4c', '#9cd326', '#ff158a', '#66ccff', '#784bd1', '#0086c0'];

export const COLUMN_TYPES = {
  text: { label: 'Text', icon: Type, color: '#579bfc', width: 160 },
  status: { label: 'Status', icon: CircleDot, color: '#00c875', width: 150 },
  people: { label: 'People', icon: Users, color: '#66ccff', width: 120 },
  date: { label: 'Date', icon: Calendar, color: '#a25ddc', width: 130 },
  week: { label: 'Week', icon: CalendarDays, color: '#a25ddc', width: 120 },
  timeline: { label: 'Timeline', icon: GanttChart, color: '#784bd1', width: 180 },
  numbers: { label: 'Number', icon: Hash, color: '#fdab3d', width: 120 },
  dropdown: { label: 'Dropdown', icon: ListChecks, color: '#ff642e', width: 170 },
  checkbox: { label: 'Checkbox', icon: CheckSquare, color: '#037f4c', width: 100 },
  priority: { label: 'Priority', icon: Flag, color: '#225091', width: 140 },
  link: { label: 'Link', icon: Link2, color: '#0086c0', width: 160 },
  long_text: { label: 'Long text', icon: AlignLeft, color: '#7f5347', width: 200 },
  phone: { label: 'Phone', icon: Phone, color: '#00c875', width: 150 },
  email: { label: 'Email', icon: Mail, color: '#ff158a', width: 180 },
  location: { label: 'Location', icon: MapPin, color: '#e2445c', width: 180 },
  time_tracking: { label: 'Time tracking', icon: Timer, color: '#bb3354', width: 150 },
  connect: { label: 'Connect board', icon: Network, color: '#784bd1', width: 180 },
  mirror: { label: 'Mirror', icon: Mirror, color: '#784bd1', width: 160 },
  creation_log: { label: 'Created', icon: History, color: '#676879', width: 150 },
  last_updated: { label: 'Last updated', icon: Clock, color: '#676879', width: 150 },
};
const lab = (arr) => arr.map(([label, color]) => ({ id: 'l_' + Math.random().toString(36).slice(2, 8), label, color }));
export function newColumn(type) {
  const id = 'c_' + Math.random().toString(36).slice(2, 9);
  const title = COLUMN_TYPES[type].label;
  if (type === 'status') return { id, type, title, settings: { labels: lab([['Working on it', '#fdab3d'], ['Done', '#00c875'], ['Stuck', '#e2445c'], ['', '#c4c4c4']]) } };
  if (type === 'priority') return { id, type, title, settings: { labels: lab([['Critical ⚠️', '#333333'], ['High', '#225091'], ['Medium', '#0086c0'], ['Low', '#579bfc'], ['', '#c4c4c4']]) } };
  if (type === 'dropdown') return { id, type, title, settings: { options: [] } };
  return { id, type, title, settings: {} };
}
export const VIEW_TYPES = {
  table: { label: 'Table', emoji: '📋' },
  kanban: { label: 'Kanban', emoji: '🗂️' },
  calendar: { label: 'Calendar', emoji: '📅' },
  timeline: { label: 'Timeline', emoji: '📊' },
  chart: { label: 'Chart', emoji: '📈' },
  map: { label: 'Map', emoji: '🗺️' },
};
export const fmtDate = (s) => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
export const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const initials = (n = '') => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
export const timeAgo = (iso) => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; };
export const isDoneLabel = (l) => !!l && (l.color === '#00c875' || /done|ferdig|fixed|won|invoiced/i.test(l.label));

// ISO week helpers – value format "2026-W44"
export const isoWeek = (d = new Date()) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7); return `${y}-W${String(w).padStart(2, '0')}`; };
export const weekAdd = (v, n) => { const [y, w] = v.split('-W').map(Number); const jan4 = new Date(Date.UTC(y, 0, 4)); const mon = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000 + (w - 1 + n) * 7 * 86400000); return isoWeek(new Date(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate())); };
export const fmtWeek = (v) => { if (!v) return ''; const [y, w] = String(v).split('-W'); return y === String(new Date().getFullYear()) ? `Uke ${Number(w)}` : `Uke ${Number(w)} ’${String(y).slice(2)}`; };
