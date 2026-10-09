#!/usr/bin/env node
// render-plan.js — a review sheet of a stack plan: one large labelled SVG page, no Planner needed.
//
//   node tools/testplans/render-plan.js <plan.vplan.json> <out.html> [level]
//
// Walls, rooms (number + name), door swings (hinge, leaf), windows, devices coloured by the stack
// role of their layer (label = ref · code · height), portal boxes, and routes: golden (channel,
// CHANNEL lane gold / 230 V lane orange), silver (ARM) and ordinary paths. For checking a generated
// test plan by eye; the Planner stays the authority on how it really draws.
'use strict';
const fs = require('fs');
const [, , IN, OUT, LVL = 'ground'] = process.argv;
if (!IN || !OUT) { console.error('usage: node tools/testplans/render-plan.js <plan.vplan.json> <out.html> [level]'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(IN, 'utf8')), P = doc.project, D = P.data;
const walls = (P.building.walls[LVL] || []).map(r => ({ id: r.id, x0: Math.min(r.x0, r.x1), y0: Math.min(r.y0, r.y1), x1: Math.max(r.x0, r.x1), y1: Math.max(r.y0, r.y1) }));
const roleOf = {}; (P.layers || []).forEach(L => { roleOf[L.id] = L.role || ''; });
const ROLE_C = { construct: '#555', mark: '#888', hw: '#1d4ed8', base: '#1d4ed8', channel: '#b8860b', arm: '#6b7280',
  'sys:MAINS': '#d1493f', 'sys:LV': '#e0a400', 'sys:BUSB': '#8a5a00', 'sys:CONTROL': '#7c3aed', 'sys:DATA': '#0f766e',
  'sys:SENSOR': '#16a34a', 'sys:HMI': '#db2777', 'sys:MEDIA': '#9333ea', 'sys:USB': '#0369a1', 'sys:SECURITY': '#111827' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
walls.forEach(r => { x0 = Math.min(x0, r.x0); y0 = Math.min(y0, r.y0); x1 = Math.max(x1, r.x1); y1 = Math.max(y1, r.y1); });
const pad = 900, W = x1 - x0 + 2 * pad, H = y1 - y0 + 2 * pad;
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0 - pad} ${y0 - pad} ${W} ${H}" width="100%" style="background:#fff;font-family:Segoe UI,Arial,sans-serif">`;
(D.floors || []).filter(f => f.level === LVL).forEach(f => {
  s += `<polygon points="${f.poly.map(p => p.join(',')).join(' ')}" fill="#f3f1ea" stroke="#c9c3b3" stroke-width="12"/>`;
  let cx = 0, cy = 0; f.poly.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= f.poly.length; cy /= f.poly.length;
  s += `<text x="${cx}" y="${cy}" font-size="230" fill="#9a927e" text-anchor="middle" font-weight="600">${esc((f.num ? f.num + ' ' : '') + (f.name || ''))}</text>`;
});
walls.forEach(r => { s += `<rect x="${r.x0}" y="${r.y0}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}" fill="#a3a3a3" stroke="#5c5c5c" stroke-width="10"/>`;
  s += `<text x="${(r.x0 + r.x1) / 2}" y="${(r.y0 + r.y1) / 2 + 35}" font-size="95" fill="#fff" text-anchor="middle">${esc(r.id || '')}</text>`; });
(D.openings || []).filter(o => o.level === LVL).forEach(o => {
  const wd = o.w || (o.type === 'window' ? 1200 : 900), horiz = Math.abs(Math.cos(o.ang || 0)) > 0.5;
  const a = horiz ? [o.x - wd / 2, o.y] : [o.x, o.y - wd / 2], b = horiz ? [o.x + wd / 2, o.y] : [o.x, o.y + wd / 2];
  s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${o.type === 'door' ? '#fff' : '#7cc3e8'}" stroke-width="${o.type === 'door' ? 330 : 150}"/>`;
  if (o.type === 'door') {          // leaf from the hinge jamb (variant bit1 = far jamb), swing to bit0's side
    const far = !!((o.variant || 0) & 2), side = ((o.variant || 0) & 1) ? 1 : -1, hg = far ? b : a, dir = far ? -1 : 1;
    const end = horiz ? [hg[0], hg[1] + side * wd] : [hg[0] + side * wd, hg[1]];
    const arcEnd = horiz ? [hg[0] + dir * wd, hg[1]] : [hg[0], hg[1] + dir * wd];
    s += `<line x1="${hg[0]}" y1="${hg[1]}" x2="${end[0]}" y2="${end[1]}" stroke="#333" stroke-width="18"/>`;
    s += `<path d="M${end[0]},${end[1]} A${wd},${wd} 0 0 ${(horiz ? side * dir : -side * dir) > 0 ? 0 : 1} ${arcEnd[0]},${arcEnd[1]}" fill="none" stroke="#333" stroke-width="8" stroke-dasharray="40 30"/>`;
  }
  s += `<text x="${o.x}" y="${o.y - 190}" font-size="90" fill="#2a7" text-anchor="middle">${esc(o.id)}</text>`;
});
const devType = {}; (D.devices || []).forEach(d => { devType[d.id] = d.type; });
// a golden route's lane: the stored carrier override, else what its two end devices make it (05r CHN_CARRIERS)
const lane = p => { if (p.carrier) return p.carrier; const e = [p.nodes[0], p.nodes[p.nodes.length - 1]].map(n => n && n.dev ? devType[n.dev] : null).sort().join('|');
  return ({ 'board|rbx': 'mains', 'board|ssc': 'mains', 'board|meter': 'feed' })[e] || 'channel'; };
(D.paths || []).forEach(p => {
  const pts = p.nodes.filter(n => n.level === LVL).map(n => n.x + ',' + n.y).join(' ');
  const c = p.route === 'channel' ? (lane(p) === 'mains' ? '#f97316' : '#d4a017') : p.route === 'arm' ? '#9ca3af' : '#555';
  s += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${p.route === 'channel' ? 70 : 40}" stroke-linejoin="round" opacity=".85"/>`;
});
(D.devices || []).filter(d => d.level === LVL).forEach(d => {
  const role = roleOf[d.layer] || '', c = d.type === 'junction' ? '#111' : (ROLE_C[role] || '#444');
  const big = ['rbx', 'base', 'board'].indexOf(d.type) >= 0;
  if (big) s += `<rect x="${d.x - 260}" y="${d.y - 260}" width="520" height="520" fill="${c}" opacity=".85"/>`;
  else if (d.type === 'junction') s += `<rect x="${d.x - 70}" y="${d.y - 70}" width="140" height="140" fill="#fff" stroke="#111" stroke-width="22"/>`;
  else s += `<circle cx="${d.x}" cy="${d.y}" r="${d.side != null ? 80 : 95}" fill="${d.side != null ? c : '#fff'}" stroke="${c}" stroke-width="26"/>`;
  const lab = [d.ref || '', d.code || (d.type === 'junction' ? '' : d.type), d.h != null ? d.h : ''].filter(x => x !== '').join(' · ');
  s += `<text x="${d.x + 120}" y="${d.y - 90}" font-size="${big ? 150 : 82}" font-weight="${big ? 700 : 400}" fill="${c}">${esc(lab)}</text>`;
});
const legend = Object.entries(ROLE_C).filter(([k]) => Object.values(roleOf).indexOf(k) >= 0);
s += `<g transform="translate(${x0 - pad + 150},${y1 + pad - 200})">` + legend.map(([k, c], i) => `<circle cx="${i * 1100}" cy="0" r="70" fill="${c}"/><text x="${i * 1100 + 110}" y="35" font-size="110">${esc(k)}</text>`).join('') + '</g>';
s += '</svg>';
fs.writeFileSync(OUT, `<!doctype html><meta charset="utf-8"><title>${esc(doc.name || 'terv')}</title><body style="margin:0">${s}`);
console.log('wrote ' + OUT);
