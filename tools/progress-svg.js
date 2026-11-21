#!/usr/bin/env node
// tools/progress-svg.js — one line of nodes showing how far a line of work has got (done coloured, the current one
// ringed, the rest grey) with "n/m" at the end. Used at the end of fork-session messages (the Founder's request,
// 2026-11-20): each session sends the SVG as a rendered file after its message.
//
//   node tools/progress-svg.js --title "F1 Helyszín" --steps "Terv|Modell|Térkép|…" --done 3 [--current] --out f1.svg
//
// --done n     the first n steps are done
// --current    the step after them is in progress (ringed amber)
// --color hex  the colour of the done nodes (default #2a9d8f)
'use strict';
const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);
const steps = (arg('steps', '') || '').split('|').map(s => s.trim()).filter(Boolean);
if (!steps.length) { console.error('usage: --steps "a|b|c" --done n [--current] [--title t] [--out file.svg]'); process.exit(2); }
const done = Math.max(0, Math.min(steps.length, parseInt(arg('done', '0'), 10) || 0));
const cur = has('current') && done < steps.length ? done : -1;
const title = arg('title', ''), col = arg('color', '#2a9d8f'), out = arg('out', '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const gap = 96, x0 = 40, y = title ? 58 : 34, W = x0 * 2 + gap * (steps.length - 1) + 70, H = y + 52;
const xs = steps.map((_, i) => x0 + i * gap);
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, system-ui, sans-serif">`;
s += `<rect width="${W}" height="${H}" rx="10" fill="#f6f8fa"/>`;
if (title) s += `<text x="${x0 - 14}" y="24" font-size="14" font-weight="600" fill="#1f2328">${esc(title)}</text>`;
const last = xs[xs.length - 1];
s += `<line x1="${x0}" y1="${y}" x2="${last}" y2="${y}" stroke="#d0d7de" stroke-width="4" stroke-linecap="round"/>`;
if (done > 1) s += `<line x1="${x0}" y1="${y}" x2="${xs[done - 1]}" y2="${y}" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`;
steps.forEach((label, i) => {
  const x = xs[i], d = i < done, c = i === cur;
  s += `<circle cx="${x}" cy="${y}" r="11" fill="${d ? col : c ? '#fff' : '#e6e9ed'}" stroke="${d ? col : c ? '#e09b1a' : '#b8c0c8'}" stroke-width="${c ? 3.5 : 2}"/>`;
  if (d) s += `<path d="M${x - 5},${y} l3.5,3.5 l6.5,-7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<text x="${x}" y="${y + 30}" font-size="11" text-anchor="middle" fill="${d ? '#1f2328' : c ? '#9a6700' : '#8c959f'}">${esc(label)}</text>`;
});
s += `<text x="${last + 26}" y="${y + 5}" font-size="16" font-weight="700" fill="#1f2328">${done}/${steps.length}</text>`;
s += '</svg>\n';
if (out) { fs.writeFileSync(out, s); console.log('wrote ' + out + ' (' + done + '/' + steps.length + ')'); } else process.stdout.write(s);
