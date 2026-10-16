// debug-prep.js — stage 1 check: heights + portals + portal members
'use strict';
const fs = require('fs'), geom = require('./geom'), prep = require('./prep');
const [, , inFile, cfgFile] = process.argv;
const cfg = require(require('path').resolve(cfgFile || __dirname + '/p33.config.js'));
const G = geom.load(JSON.parse(fs.readFileSync(inFile, 'utf8')), cfg.level);
const E = prep.endpoints(G, cfg); prep.applyHeights(E);
const PT = prep.portals(G, E); prep.portalMembers(G, PT, E); prep.placeInPortals(G, PT, E);
PT.forEach(p => console.log(`PORTAL ${p.id} wall ${p.wall} axis ${p.axis} c ${Math.round(p.c)} half ${p.half} latch ${p.latch > 0 ? '+' : '-'} faces ${p.faces.map(f => f.room).join('/')}` +
  '\n   ' + E.filter(e => e.portal === p.id).map(e => `${e.id} ${e.code}${e.v ? '/' + e.v : ''}→${e.pFace}:${e.slot}${e.slotN > 1 ? '#' + e.slotN : ''}`).join('  ')));
console.log('\nHEIGHT CHANGES');
E.filter(e => e.hChanged).forEach(e => console.log(`${e.id.padEnd(5)} ${e.role.padEnd(12)} ${(e.code + (e.v ? '/' + e.v : '')).padEnd(11)} ${String(Math.round(e.h0)).padStart(5)} → ${String(Math.round(e.h)).padStart(5)}  ${e.room}  ${e.hRule}`));
console.log('\nunchanged:', E.filter(e => !e.hChanged).length, ' changed:', E.filter(e => e.hChanged).length, ' rooms missing:', E.filter(e => !e.room).map(e => e.id).join(' '));
