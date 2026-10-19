// QR label sheets as vector PDF (pdfkit + qrcode). Sizes in mm.
const PDFDocument = require('pdfkit');
const QR = require('qrcode');
const MM = 72 / 25.4;
const LETTER = [215.9, 279.4], A4 = [210, 297];
// w,h label; cols,rows; left/top margin; pitch x/y; r = corner radius
const TEMPLATES = {
  avery6570: { name: 'Avery 6570 / 6576 – 1¾″×1¼″, 32 per Letter sheet (GoCodes default)', page: LETTER, w: 44.45, h: 31.75, cols: 4, rows: 8, left: 11.91, top: 12.7, px: 49.21, py: 31.75, r: 2.4 },
  avery5160: { name: 'Avery 5160 – 2⅝″×1″, 30 per Letter sheet', page: LETTER, w: 66.68, h: 25.4, cols: 3, rows: 10, left: 4.76, top: 12.7, px: 69.85, py: 25.4, r: 1.5 },
  avery22806: { name: 'Avery 22806 – 2″×2″ square, 12 per Letter sheet', page: LETTER, w: 50.8, h: 50.8, cols: 3, rows: 4, left: 15.88, top: 15.88, px: 66.68, py: 66.68, r: 3 },
  l7651: { name: 'Avery L7651 – 38.1×21.2 mm, 65 per A4 sheet', page: A4, w: 38.1, h: 21.2, cols: 5, rows: 13, left: 4.75, top: 10.7, px: 40.64, py: 21.2, r: 1.5 },
  l7160: { name: 'Avery L7160 – 63.5×38.1 mm, 21 per A4 sheet', page: A4, w: 63.5, h: 38.1, cols: 3, rows: 7, left: 7.2, top: 15.15, px: 66.04, py: 38.1, r: 2.5 },
  l7163: { name: 'Avery L7163 – 99.1×38.1 mm, 14 per A4 sheet', page: A4, w: 99.1, h: 38.1, cols: 2, rows: 7, left: 4.65, top: 15.15, px: 101.6, py: 38.1, r: 2.5 },
  roll50x25: { name: 'Label printer roll – 50×25 mm (one per page)', page: [50, 25], w: 50, h: 25, cols: 1, rows: 1, left: 0, top: 0, px: 50, py: 25, r: 0 },
  roll62x29: { name: 'Brother DK-11209 – 62×29 mm (one per page)', page: [62, 29], w: 62, h: 29, cols: 1, rows: 1, left: 0, top: 0, px: 62, py: 29, r: 0 },
};
function drawQR(doc, text, x, y, size) {
  const q = QR.create(text, { errorCorrectionLevel: 'M' }); const n = q.modules.size; const quiet = 2; const cell = size / (n + quiet * 2);
  doc.save().fillColor('#000');
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.get(r, c)) doc.rect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell + 0.02, cell + 0.02);
  doc.fill().restore();
}
function fit(doc, text, maxW, size, min = 4) { let s = size; doc.fontSize(s); while (s > min && doc.widthOfString(text) > maxW) { s -= 0.25; doc.fontSize(s); } return s; }
function pdf(res, { codes, base, template, start = 0, header = '', showName, names = {}, outline }) {
  const t = TEMPLATES[template] || TEMPLATES.avery6570;
  const doc = new PDFDocument({ size: [t.page[0] * MM, t.page[1] * MM], margin: 0, autoFirstPage: false, info: { Title: 'mondo QR labels', Creator: 'mondo' } });
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="labels-${template || 'avery6570'}.pdf"`);
  doc.pipe(res);
  const per = t.cols * t.rows; const slots = [...Array(Math.min(start, per - 1)).fill(null), ...codes];
  slots.forEach((code, k) => {
    const i = k % per; if (i === 0) doc.addPage();
    if (!code) return;
    const x = (t.left + (i % t.cols) * t.px) * MM, y = (t.top + Math.floor(i / t.cols) * t.py) * MM, w = t.w * MM, h = t.h * MM;
    if (outline) doc.save().lineWidth(0.3).strokeColor('#bbbbbb').roundedRect(x, y, w, h, t.r * MM).stroke().restore();
    const pad = Math.min(w, h) * 0.06;
    const put = (text, tx, ty, tw, size, align = 'left', bold, color = '#000') => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica'); const fs = fit(doc, text, tw, size); const ww = doc.widthOfString(text); doc.fillColor(color).text(text, align === 'center' ? tx + (tw - ww) / 2 : tx, ty, { lineBreak: false }); return fs; };
    const nm = showName && names[code] ? [names[code].asset_type, names[code].model].filter(Boolean).join(' · ') : '';
    if (w / h < 1.6) { // stacked: header, QR, code (Avery 6570, squares)
      let yy = y + pad * 0.7; const lines = (header ? 1 : 0) + 1 + (nm ? 1 : 0);
      const hs = Math.min(h * 0.085, 7.5); if (header) yy += put(header, x + pad, yy, w - pad * 2, hs, 'center', true) * 1.15;
      const qs = h - (yy - y) - pad * 0.5 - h * 0.13 * (lines - (header ? 1 : 0)) ; drawQR(doc, base + '/s/' + code, x + (w - qs) / 2, yy - qs * 0.03, qs); yy += qs * 0.99;
      yy += put(code, x + pad, yy, w - pad * 2, h * 0.11, 'center', true) * 1.1;
      if (nm) put(nm, x + pad, yy, w - pad * 2, h * 0.075, 'center', false, '#333');
      return;
    }
    const qs = h - pad * 2; const qx = x + pad * 0.6, qy = y + pad; drawQR(doc, base + '/s/' + code, qx, qy, qs);
    const tx = qx + qs + pad * 0.4; const tw = x + w - pad - tx; let yy = qy + qs * 0.1;
    if (header) yy += put(header, tx, yy, tw, Math.min(h * 0.13, 9), 'left', true) * 1.35;
    yy += put(code, tx, yy, tw, h * 0.2, 'left', true) * 1.25;
    if (nm) yy += put(nm, tx, yy, tw, Math.min(h * 0.11, 7)) * 1.3;
    put('Skann meg · Scan me', tx, Math.max(yy, qy + qs - h * 0.12), tw, Math.min(h * 0.1, 6.5), 'left', false, '#555');
  });
  doc.end();
}
module.exports = { pdf, TEMPLATES: Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.name])) };
