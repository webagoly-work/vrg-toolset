const fs = require('fs'), zlib = require('zlib');
const MAP = { '0118': 'ő', '0126': 'ű' };
const ESC = { n: '\n', r: '\r', t: '\t', b: '', f: '' };

function streams(file) {
  const s = fs.readFileSync(file).toString('latin1');
  const re = /stream\r?\n/g; let m; const out = [];
  while ((m = re.exec(s))) {
    const st = m.index + m[0].length;
    const e = s.indexOf('endstream', st);
    if (e < 0) continue;
    let d; try { d = zlib.inflateSync(Buffer.from(s.slice(st, e), 'latin1')); } catch (x) { continue; }
    const t = d.toString('latin1');
    if (/\bTd\b/.test(t) && /\bTj\b/.test(t)) out.push(t);
  }
  return out;
}

function unesc(v) {
  return v.replace(/\\([0-7]{1,3})/g, (mm, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, (mm, c) => (ESC[c] !== undefined ? ESC[c] : c));
}

// Returns array of pages; each page = array of {x,y,text}
function parse(file) {
  const pages = [];
  for (const c of streams(file)) {
    const frags = [];
    let cur = null;
    const tok = /BT|ET|([-\d.]+)\s+([-\d.]+)\s+Td|\((?:\\.|[^\\()])*\)\s*Tj|<([0-9A-Fa-f]+)>\s*Tj/g;
    let m;
    while ((m = tok.exec(c))) {
      const v = m[0];
      if (v === 'BT') { cur = null; }
      else if (v === 'ET') { if (cur) { frags.push(cur); cur = null; } }
      else if (m[1] !== undefined) { if (cur) frags.push(cur); cur = { x: +m[1], y: +m[2], text: '' }; }
      else if (m[3] !== undefined) { if (cur) cur.text += (MAP[m[3].toUpperCase()] || MAP[m[3]] || ''); }
      else { if (cur) cur.text += unesc(v.slice(v.indexOf('(') + 1, v.lastIndexOf(')'))); }
    }
    if (cur) frags.push(cur);
    pages.push(frags);
  }
  return pages;
}

const pages = parse(process.argv[2]);
pages.forEach((frags, pi) => {
  console.log('######## PAGE ' + (pi + 1));
  // group by y (rounded)
  const rows = new Map();
  for (const f of frags) {
    const key = Math.round(f.y * 2) / 2;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(f);
  }
  [...rows.keys()].sort((a, b) => b - a).forEach(y => {
    const line = rows.get(y).sort((a, b) => a.x - b.x)
      .map(f => Math.round(f.x) + '~' + f.text.trim()).join('  ||  ');
    if (line.replace(/[\d~|.\s]/g, '')) console.log(y.toFixed(1) + '  ' + line);
    else console.log(y.toFixed(1) + '  ' + line);
  });
});
