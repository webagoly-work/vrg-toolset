#!/usr/bin/env node
// build.js — assemble BRIDGE/09_catalogue/src/*.js into SMARTHOME-DB-001.json + smarthome-db.html (offline viewer)
// Every cross-reference is checked; a broken one fails the build (exit 1). Warnings do not fail it.
//   node BRIDGE/09_catalogue/tools/build.js            build
//   node BRIDGE/09_catalogue/tools/build.js --check    validate only, write nothing
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), SRC = path.join(ROOT, 'src');
const checkOnly = process.argv.includes('--check');

const V = require(path.join(SRC, '00-vocab.js'));
const gases = require(path.join(SRC, '10-gases.js'));
const sensors = require(path.join(SRC, '20-sensors.js'));
const combos = require(path.join(SRC, '30-combos.js'));
const switches = require(path.join(SRC, '40-switches.js'));
const lighting = require(path.join(SRC, '50-lighting.js'));
const abus = require(path.join(SRC, '60-abus.js'));
const seqled = require(path.join(SRC, '65-seqled.js'));
const control = require(path.join(SRC, '70-control.js'));
const rooms = require(path.join(SRC, '80-rooms.js'));
const tuya = require(path.join(SRC, '90-tuya.js'));
const ulp = require(path.join(SRC, '95-ulp.js'));

const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const keysOf = list => new Set(list.map(x => x.k));
const uniq = (list, what) => { const s = new Set(); list.forEach(x => { if (s.has(x.k)) err(`${what}: duplicate key ${x.k}`); s.add(x.k); }); };

const ROOM = new Set(V.roomTypes), ZONE = new Set(Object.keys(V.zones).concat('-')), PWR = new Set(Object.keys(V.power));
const MN = new Set(Object.keys(V.multinode)), BATT = new Set(Object.keys(V.battery)), LAYER = new Set(V.layers);
const SEN = keysOf(sensors.list), GAS = keysOf(gases), MS = keysOf(combos.multisensors), FLT = keysOf(combos.fleet);
const SW = keysOf(switches), LIT = keysOf(lighting.items), USE = keysOf(abus.uses), AMB = keysOf(abus.ambientPoints);
const IFC = keysOf(control.interfaces), SQ = keysOf(seqled.methods), RM = keysOf(rooms);
const ANY = new Set([...SEN, ...MS, ...FLT, ...SW, ...LIT, ...USE, ...AMB, ...IFC, ...SQ, 'seqled']);

[[gases, 'gas'], [sensors.list, 'sensor'], [combos.multisensors, 'multisensor'], [combos.fleet, 'fleet'], [switches, 'switch'],
 [lighting.items, 'light'], [abus.uses, 'abus'], [abus.ambientPoints, 'ambient'], [seqled.methods, 'seqled'],
 [control.interfaces, 'control'], [control.features, 'feature'], [rooms, 'room'], [ulp, 'ulp']].forEach(([l, w]) => uniq(l, w));
// gases are their own namespace (referenced only through `gas` fields), so a gas and a sensor may share a key
const allKeys = [sensors.list, combos.multisensors, combos.fleet, switches, lighting.items, abus.uses, abus.ambientPoints,
  seqled.methods, control.interfaces, control.features, rooms, ulp].flat().map(x => x.k);
const dupAcross = allKeys.filter((k, i) => allKeys.indexOf(k) !== i);
if (dupAcross.length) err('key used in two sections: ' + [...new Set(dupAcross)].join(', '));

const roomList = (rs, where) => (rs || []).forEach(r => { if (r !== '*' && !ROOM.has(r)) err(`${where}: unknown room "${r}"`); });
const refList = (rs, set, where, what) => (rs || []).forEach(r => { if (!set.has(r)) err(`${where}: unknown ${what} "${r}"`); });

// ---- gases ----
gases.forEach(g => { roomList(g.rooms, 'gas ' + g.k); refList(g.sensor, SEN, 'gas ' + g.k, 'sensor');
  if (!['ceiling', 'breathing', 'floor'].includes(g.pos)) err(`gas ${g.k}: pos "${g.pos}"`); });
// ---- sensors ----
sensors.list.forEach(s => { const w = 'sensor ' + s.k;
  if (!sensors.groups[s.grp]) err(`${w}: group "${s.grp}"`);
  roomList(s.rooms, w); roomList(s.avoid, w + ' avoid');
  (s.zone || []).forEach(z => { if (!ZONE.has(z)) err(`${w}: zone "${z}"`); });
  (s.pwr || []).forEach(p => { if (!PWR.has(p)) err(`${w}: power "${p}"`); });
  if (!MN.has(s.mn)) err(`${w}: multinode "${s.mn}"`); if (!BATT.has(s.batt)) err(`${w}: battery "${s.batt}"`);
  if (!LAYER.has(s.layer)) err(`${w}: layer "${s.layer}"`);
  refList(s.partners, SEN, w, 'partner'); refList(s.gas, GAS, w, 'gas');
  if (!s.pro || !s.con) err(`${w}: pro / con missing`); });
// ---- combos ----
combos.multisensors.forEach(m => { refList(m.members, SEN, 'ms ' + m.k, 'sensor'); refList(m.opt, SEN, 'ms ' + m.k, 'sensor'); roomList(m.rooms, 'ms ' + m.k); });
combos.fleet.forEach(f => { refList(f.members, SEN, 'fleet ' + f.k, 'sensor'); refList(f.opt, SEN, 'fleet ' + f.k, 'sensor');
  Object.values(f.tiers || {}).forEach(t => refList(t, SEN, 'fleet ' + f.k + ' tier', 'sensor')); });
// ---- switches / lighting / bus A ----
switches.forEach(s => { roomList(s.rooms, 'switch ' + s.k); (s.pwr || []).forEach(p => { if (!PWR.has(p)) err(`switch ${s.k}: power "${p}"`); }); });
lighting.items.forEach(l => { roomList(l.rooms, 'light ' + l.k); if (!lighting.drives[l.drive]) err(`light ${l.k}: drive "${l.drive}"`);
  if (!['main', 'extra', 'ambient', 'path', 'notify'].includes(l.kind)) err(`light ${l.k}: kind "${l.kind}"`); });
abus.uses.forEach(u => { roomList(u.rooms, 'abus ' + u.k); if (u.light && !LIT.has(u.light)) err(`abus ${u.k}: light "${u.light}"`); if (!ZONE.has(u.zone)) err(`abus ${u.k}: zone "${u.zone}"`); });
abus.ambientPoints.forEach(a => { roomList(a.rooms, 'ambient ' + a.k); if (!ZONE.has(a.zone)) err(`ambient ${a.k}: zone "${a.zone}"`); });
seqled.rules.sensing.forEach(s => { if (!SEN.has(s.k)) err(`seqled sensing: "${s.k}"`); });
// ---- control ----
control.interfaces.forEach(c => { roomList(c.rooms, 'control ' + c.k); });
control.features.forEach(f => { (f.layers || []).forEach(l => { if (!LAYER.has(l)) err(`feature ${f.k}: layer "${l}"`); });
  (f.needs || []).forEach(n => n.split('|').forEach(a => { if (!ANY.has(a)) err(`feature ${f.k}: need "${a}"`); })); });
// ---- rooms ----
rooms.forEach(r => { const w = 'room ' + r.k; if (!ROOM.has(r.k)) err(`${w}: not in vocab.roomTypes`);
  ['main', 'extra', 'ambient'].forEach(k => refList(r.light[k], LIT, w + ' light.' + k, 'light'));
  (r.health || []).forEach(h => { if (!GAS.has(h.gas)) err(`${w}: health gas "${h.gas}"`); });
  refList(r.sense, SEN, w, 'sensor'); refList(r.abus, USE, w, 'abus use'); refList(r.sw, SW, w, 'switch');
  if (r.k !== 'kert' && !(r.health || []).length) warn(`${w}: no health gas`);
  // the health rule: at least one health-grade sensor in the room's own list must cover one of its gases
  const gs = new Set((r.health || []).map(h => h.gas));
  const covered = (r.sense || []).some(k => { const s = sensors.list.find(x => x.k === k); return s && s.health && (s.gas || []).some(g => gs.has(g)); });
  if (gs.size && !covered) warn(`${w}: no health-grade sensor in "sense" covers its gases (${[...gs].join(', ')}) — FLT-A / ms_air expected`); });
V.roomTypes.forEach(t => { if (!RM.has(t)) err(`roomType ${t} has no room entry`); });
// ---- tuya ----
const tc = tuya.cats, codes = new Set();
tc.forEach(c => { const w = 'tuya ' + c.code; if (codes.has(c.code)) err(`${w}: duplicate`); codes.add(c.code);
  if (!tuya.groups[c.grp]) err(`${w}: group "${c.grp}"`); roomList(c.rooms, w);
  if (!ZONE.has(c.zone)) err(`${w}: zone "${c.zone}"`); c.pwr.forEach(p => { if (!PWR.has(p)) err(`${w}: power "${p}"`); });
  if (!['bridge', 'integrate', 'appliance', 'out'].includes(c.rel)) err(`${w}: rel "${c.rel}"`);
  if (!LAYER.has(c.layer)) err(`${w}: layer "${c.layer}"`); if (c.ref && !ANY.has(c.ref)) err(`${w}: ref "${c.ref}"`); });
const nOff = tc.filter(c => c.status === 'official').length, nDoc = tc.filter(c => c.status === 'documented').length, nField = tc.filter(c => c.status === 'field').length;
if (nOff !== 103) err(`tuya: ${nOff} official, expected 103`); if (tc.length !== 140) err(`tuya: ${tc.length} codes, expected 140 (HA 2026.10.0)`);
// ---- ulp ----
ulp.forEach(u => { roomList(u.rooms, 'ulp ' + u.k); if (u.ref && !ANY.has(u.ref)) err(`ulp ${u.k}: ref "${u.ref}"`); });

// ---- derived per-room index (what the Planner / F4 reads) ----
const inRoom = (rs, room) => (rs || []).includes('*') || (rs || []).includes(room);
const roomIndex = {};
V.roomTypes.forEach(t => { roomIndex[t] = {
  sensors: sensors.list.filter(s => inRoom(s.rooms, t) && !inRoom(s.avoid, t)).map(s => s.k),
  avoidSensors: sensors.list.filter(s => (s.avoid || []).includes(t)).map(s => s.k),
  gases: gases.filter(g => inRoom(g.rooms, t)).map(g => g.k),
  switches: switches.filter(s => inRoom(s.rooms, t)).map(s => s.k),
  tuya: tc.filter(c => inRoom(c.rooms, t) && c.rel !== 'out').map(c => c.code),
  ulp: ulp.filter(u => inRoom(u.rooms, t)).map(u => u.k) }; });

if (warns.length) { console.log(`warnings (${warns.length}):`); warns.forEach(w => console.log('  ! ' + w)); }
if (errors.length) { console.log(`ERRORS (${errors.length}):`); errors.forEach(e => console.log('  x ' + e)); process.exit(1); }

const db = {
  id: 'SMARTHOME-DB-001', rev: 'r1', date: '2026-10-11', lang: 'hu',
  about: 'BRIDGE okosotthon-katalógus: érzékelők egyedi szenzorig bontva, gázok vertikális szabállyal, multiszenzorok és portál-flottamodulok, kapcsolók (rejtett is), világítás, A busz, mozgásvonal, vezérlés (a volt HMI réteg), szobák, Tuya kategóriák, elemes / ULP eszközök.',
  sources: [
    { n: 'Tuya Developer Platform — Standard Instruction Set', url: 'https://developer.tuya.com/en/docs/iot/standarddescription?id=K9i5ql6waswzq', use: '103 kategória, 11 csoport' },
    { n: 'Home Assistant core 2026.10.0 — tuya/const.py DeviceCategory (Apache-2.0)', url: 'https://github.com/home-assistant/core/blob/2026.10.0/homeassistant/components/tuya/const.py', use: '140 kód, angol nevek' },
    { n: '12/2014. (II. 21.) BM rendelet — CO-érzékelő', url: 'https://njt.hu/', use: 'CO kötelezettség ⚑ hatályosság ellenőrizendő' },
    { n: 'EN 50244:2016 — éghető gáz érzékelők telepítése lakásban', url: 'https://knowledge.bsigroup.com/', use: 'magasságok ⚑ a szabványszövegből ellenőrizendő' },
    { n: 'WLED Animated Staircase usermod', url: 'https://mm.kno.wled.ge/usermods/staircase/', use: 'szekvenciális fény referencia' }
  ],
  counts: { sensors: sensors.list.length, gases: gases.length, multisensors: combos.multisensors.length, fleet: combos.fleet.length,
    switches: switches.length, lights: lighting.items.length, abusUses: abus.uses.length, ambientPoints: abus.ambientPoints.length,
    seqledMethods: seqled.methods.length, controls: control.interfaces.length, features: control.features.length, rooms: rooms.length,
    tuya: { total: tc.length, official: nOff, documentedElsewhere: nDoc, field: nField }, ulp: ulp.length },
  vocab: V, gases, sensorGroups: sensors.groups, sensors: sensors.list, multisensors: combos.multisensors, fleet: combos.fleet,
  switches, lightingDrives: lighting.drives, lighting: lighting.items, abus: abus.uses, ambientPoints: abus.ambientPoints,
  seqled, control: control.interfaces, features: control.features, rooms, roomIndex,
  tuya: { groups: tuya.groups, cats: tc }, ulp
};

console.log(`ok — ${db.counts.sensors} sensors · ${db.counts.gases} gases · ${db.counts.multisensors} multisensors · ${db.counts.fleet} fleet · ` +
  `${db.counts.switches} switches · ${db.counts.lights} lights · ${db.counts.abusUses} bus-A uses · ${db.counts.ambientPoints} ambient points · ` +
  `${db.counts.seqledMethods} seq-LED methods · ${db.counts.controls} controls · ${db.counts.rooms} rooms · ` +
  `tuya ${tc.length} (${nOff} official + ${nDoc} documented elsewhere + ${nField} field) · ${db.counts.ulp} ULP`);
if (checkOnly) process.exit(0);

const json = JSON.stringify(db, null, 1);
fs.writeFileSync(path.join(ROOT, 'SMARTHOME-DB-001.json'), json + '\n');
const tpl = fs.readFileSync(path.join(__dirname, 'viewer.html'), 'utf8');
const html = tpl.replace('/*__DB__*/null', JSON.stringify(db).replace(/</g, '\\u003c'));
fs.writeFileSync(path.join(ROOT, 'smarthome-db.html'), html);
console.log('wrote SMARTHOME-DB-001.json (' + (json.length / 1024).toFixed(0) + ' KB) + smarthome-db.html');
