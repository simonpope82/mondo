const C = { green:'#00c875', orange:'#fdab3d', red:'#e2445c', grey:'#c4c4c4', blue:'#0086c0', purple:'#a25ddc', lblue:'#579bfc', dark:'#333333', yellow:'#ffcb00', pink:'#ff158a', lime:'#9cd326', navy:'#225091' };
let n = 0; const cid = (p) => p + '_' + (++n).toString(36) + Math.random().toString(36).slice(2, 6);

const statusLabels = (arr) => arr.map(([label, color]) => ({ id: cid('l'), label, color }));
const DEFAULT_STATUS = () => statusLabels([['Working on it', C.orange], ['Done', C.green], ['Stuck', C.red], ['', C.grey]]);
const PRIORITY = () => statusLabels([['Critical ⚠️', C.dark], ['High', C.navy], ['Medium', C.blue], ['Low', C.lblue], ['', C.grey]]);

function col(type, title, settings = {}) {
  const c = { id: cid('c'), type, title, settings };
  if (type === 'status' && !settings.labels) c.settings = { labels: DEFAULT_STATUS() };
  if (type === 'priority' && !settings.labels) c.settings = { labels: PRIORITY() };
  if (type === 'dropdown' && !settings.options) c.settings = { options: [] };
  return c;
}
const opts = (arr) => arr.map((label) => ({ id: cid('o'), label }));
const grp = (name, color) => ({ id: cid('g'), name, color, collapsed: false });
const subCols = () => [col('people', 'Owner'), col('status', 'Status'), col('date', 'Date')];

const TEMPLATES = {
  blank: {
    name: 'New board', icon: '📋', label: 'Blank board', desc: 'Start from zero',
    make: () => ({ columns: [col('people', 'Person'), col('status', 'Status'), col('date', 'Date')], groups: [grp('To do', C.lblue), grp('Done', C.green)], items: [['Item 1', 0], ['Item 2', 0], ['Item 3', 1]] }),
  },
  project: {
    name: 'Project', icon: '🚀', label: 'Project', desc: 'Plan work with owners and dates',
    make: () => ({ columns: [col('people', 'Owner'), col('status', 'Status'), col('priority', 'Priority'), col('timeline', 'Timeline'), col('date', 'Due date'), col('numbers', 'Budget', { unit: 'kr' }), col('checkbox', 'Done?'), col('long_text', 'Notes')], groups: [grp('This month', C.lblue), grp('Next month', C.purple), grp('Done', C.green)], items: [['Plan the work', 0], ['Kick-off meeting', 0], ['Final check', 1]] }),
  },
  service: {
    name: 'Service jobs', icon: '🛠️', label: 'Service jobs', desc: 'Faults, visits and invoices',
    make: () => ({ columns: [col('people', 'Tech'), col('date', 'Planned'), col('status', 'Job status', { labels: statusLabels([['New', C.red], ['Planned', C.orange], ['Fixed', C.green], ['Waiting parts', C.purple], ['', C.grey]]) }), col('dropdown', 'Machine', { options: opts(['Coffee machine', 'Water filter', 'Grinder', 'Fridge']) }), col('status', 'Invoice?', { labels: statusLabels([['Yes', C.orange], ['No', C.grey], ['Invoiced', C.green], ['', C.grey]]) }), col('location', 'Address'), col('phone', 'Phone'), col('long_text', 'What is wrong')], groups: [grp('New jobs', C.red), grp('Waiting for invoice', C.orange), grp('Done jobs', C.green)], items: [['Customer A', 0], ['Customer B', 1]] }),
  },
  crm: {
    name: 'Customers', icon: '🤝', label: 'Customers (CRM)', desc: 'Leads, deals and contacts',
    make: () => ({ columns: [col('people', 'Owner'), col('status', 'Stage', { labels: statusLabels([['Lead', C.lblue], ['Talking', C.orange], ['Won', C.green], ['Lost', C.red], ['', C.grey]]) }), col('text', 'Contact'), col('phone', 'Phone'), col('email', 'Email'), col('numbers', 'Deal value', { unit: 'kr' }), col('link', 'Website'), col('date', 'Next call')], groups: [grp('Active', C.lblue), grp('Closed', C.grey)], items: [['New customer', 0]] }),
  },
  event: {
    name: 'Events', icon: '🎉', label: 'Events', desc: 'Plan events and guests',
    make: () => ({ columns: [col('people', 'Owner'), col('status', 'Planning'), col('date', 'Event date'), col('timeline', 'Prep time'), col('text', 'Location'), col('numbers', 'Guests'), col('numbers', 'Price', { unit: 'kr' }), col('checkbox', 'Invoiced')], groups: [grp('New events', C.purple), grp('Done', C.green)], items: [['Summer party', 0]] }),
  },
};
module.exports = { TEMPLATES, col, grp, subCols, cid, C };
Object.assign(TEMPLATES, require('./templates-kk'));
Object.assign(TEMPLATES, require('./templates-more'));
Object.assign(TEMPLATES, require('./templates-dekk'));
