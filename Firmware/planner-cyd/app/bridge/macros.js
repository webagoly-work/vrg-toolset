// macros.js - the MAKRÓK page: up to 12 buttons, set up in macros.json next to this file.
//
// macros.json holds up to 6 named sets ("készletek") of buttons and which one is active:
//   { "active": 0, "sets": [ { "name": "Windows", "buttons": [ ... ] }, ... ] }
// The CYD's KEZDŐLAP picks the active set; the settings page edits all of them. An older file
// that is a plain list of buttons is read as one set called "Saját".
//
// Each button is {label, color, type, value, args}:
//   type 'planner'  value = a Planner action id (any registered one: check.list, doc.print,
//                   view.style.blueprint...), run in the open tab through the relay
//   type 'keys'     value = a key combination (ctrl+c, win+shift+s, volume_mute...), pressed
//                   into whatever window has focus (winkeys.ps1)
//   type 'run'      value = a program, file or URL, args = its arguments
//
// Edit them on the settings page (configui.js, http://localhost:8788) or by hand in macros.json,
// which is written with the defaults on the first run and watched for saves. The saved JSON is
// never trusted: normalize() keeps only the fields and types above.

'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const MAX = 12, MAX_SETS = 6;
const TYPES = ['planner', 'keys', 'run'];
const C_PLANNER = '#2B5FAF', C_VIEW = '#3A4F7A', C_WIN = '#3A4256';

const DEFAULTS = [
  { label: 'Ellenőrzés', color: C_PLANNER, type: 'planner', value: 'check.list' },
  { label: 'Anyagkimutatás', color: C_PLANNER, type: 'planner', value: 'doc.totals' },
  { label: 'Nyomtatás / PDF', color: C_PLANNER, type: 'planner', value: 'doc.print' },
  { label: 'Kép (PNG)', color: C_PLANNER, type: 'planner', value: 'doc.png' },
  { label: 'Blueprint nézet', color: C_VIEW, type: 'planner', value: 'view.style.blueprint' },
  { label: 'Normál nézet', color: C_VIEW, type: 'planner', value: 'view.style.plan' },
  { label: 'Kijelölt törlése', color: '#8A3030', type: 'planner', value: 'edit.delete' },
  { label: 'Parancsok (Ctrl+K)', color: C_VIEW, type: 'keys', value: 'ctrl+k' },
  { label: 'Másolás', color: C_WIN, type: 'keys', value: 'ctrl+c' },
  { label: 'Beillesztés', color: C_WIN, type: 'keys', value: 'ctrl+v' },
  { label: 'Képernyőkép', color: '#6A4FC0', type: 'keys', value: 'win+shift+s' },
  { label: 'Számológép', color: '#2E7D5B', type: 'run', value: 'calc.exe' }
];

// The settings page's library: everyday Windows use first, the Planner last.
const C_MEDIA = '#22313F', C_EDIT = '#4A5568', C_WEB = '#2C5282', C_APP = '#2E7D5B', C_RED = '#B83A3A';
const k = (group, label, color, value) => ({ group, label, color, type: 'keys', value, args: '' });
const r = (group, label, color, value, args) => ({ group, label, color, type: 'run', value, args: args || '' });
const p = (label, color, value) => ({ group: 'Planner', label, color, type: 'planner', value, args: '' });
const PRESETS = [
  k('Windows', 'Feladatkezelő', '#3A4256', 'ctrl+shift+esc'),
  k('Windows', 'Képernyőkép', '#6A4FC0', 'win+shift+s'),
  k('Windows', 'Asztal', '#1873FF', 'win+d'),
  k('Windows', 'Intéző', '#C08A1E', 'win+e'),
  r('Windows', 'Gép zárolása', C_RED, 'rundll32.exe', 'user32.dll,LockWorkStation'),
  k('Windows', 'Futtatás', C_EDIT, 'win+r'),
  k('Windows', 'Vágólap-előzmények', '#2B6CB0', 'win+v'),
  k('Windows', 'Emoji', '#B7791F', 'win+period'),
  k('Windows', 'Feladatnézet', '#2C5282', 'win+tab'),
  k('Windows', 'Asztal balra', '#2C5282', 'ctrl+win+left'),
  k('Windows', 'Asztal jobbra', '#2C5282', 'ctrl+win+right'),
  k('Windows', 'Beállítások', C_EDIT, 'win+i'),
  k('Windows', 'Kivetítés', C_EDIT, 'win+p'),
  k('Média', 'Lejátszás / szünet', '#2F855A', 'media_play_pause'),
  k('Média', 'Előző', C_MEDIA, 'media_prev'),
  k('Média', 'Következő', C_MEDIA, 'media_next'),
  k('Média', 'Némítás', C_MEDIA, 'volume_mute'),
  k('Média', 'Hangerő le', C_MEDIA, 'volume_down'),
  k('Média', 'Hangerő fel', C_MEDIA, 'volume_up'),
  k('Szerkesztés', 'Másolás', C_EDIT, 'ctrl+c'),
  k('Szerkesztés', 'Kivágás', C_EDIT, 'ctrl+x'),
  k('Szerkesztés', 'Beillesztés', C_EDIT, 'ctrl+v'),
  k('Szerkesztés', 'Visszavonás', C_EDIT, 'ctrl+z'),
  k('Szerkesztés', 'Mindent kijelöl', C_EDIT, 'ctrl+a'),
  k('Szerkesztés', 'Mentés', '#2F855A', 'ctrl+s'),
  k('Szerkesztés', 'Keresés', C_EDIT, 'ctrl+f'),
  k('Böngésző', 'Új lap', C_WEB, 'ctrl+t'),
  k('Böngésző', 'Lap bezárása', C_WEB, 'ctrl+w'),
  k('Böngésző', 'Bezárt lap vissza', C_WEB, 'ctrl+shift+t'),
  k('Böngésző', 'Frissítés', C_WEB, 'f5'),
  k('Böngésző', 'Ablak bezárása', C_RED, 'alt+f4'),
  r('Programok', 'Számológép', C_APP, 'calc.exe'),
  r('Programok', 'Jegyzettömb', C_APP, 'notepad.exe'),
  r('Programok', 'Parancssor', '#1A202C', 'cmd.exe'),
  r('Programok', 'START.cmd', '#2B5FAF', path.join(__dirname, '../../../../Planner/START.cmd')),
  p('Ellenőrzés', C_PLANNER, 'check.list'),
  p('Anyagkimutatás', C_PLANNER, 'doc.totals'),
  p('Nyomtatás / PDF', C_PLANNER, 'doc.print'),
  p('Kép (PNG)', C_PLANNER, 'doc.png'),
  p('Projekt mentése', '#2F855A', 'proj.save'),
  p('Visszavonás', C_PLANNER, 'edit.undo'),
  p('Blueprint nézet', C_VIEW, 'view.style.blueprint'),
  p('Normál nézet', C_VIEW, 'view.style.plan'),
  p('2D / 3D', C_VIEW, 'view.toggle3d'),
  p('Kijelölt törlése', '#8A3030', 'edit.delete'),
  k('Planner', 'Parancsok (Ctrl+K)', C_VIEW, 'ctrl+k')
];

// The sets a new macros.json starts with, also offered as templates on the settings page.
// Built from the library above so a preset is defined once.
const byLabel = (group, label) => {
  const p = PRESETS.find(x => x.label === label && (!group || x.group === group));
  if (!p) throw new Error('no preset ' + label);
  return { label: p.label, color: p.color, type: p.type, value: p.value, args: p.args };
};
const SET_TEMPLATES = [
  { name: 'Windows', buttons: ['Feladatkezelő', 'Képernyőkép', 'Asztal', 'Intéző', 'Futtatás', 'Vágólap-előzmények', 'Feladatnézet',
    'Beállítások', 'Asztal balra', 'Asztal jobbra', 'Gép zárolása', 'Számológép'].map(l => byLabel(null, l)) },
  { name: 'Média', buttons: ['Lejátszás / szünet', 'Előző', 'Következő', 'Némítás', 'Hangerő le', 'Hangerő fel'].map(l => byLabel('Média', l)) },
  { name: 'Iroda', buttons: [['Szerkesztés', 'Másolás'], ['Szerkesztés', 'Kivágás'], ['Szerkesztés', 'Beillesztés'], ['Szerkesztés', 'Visszavonás'],
    ['Szerkesztés', 'Mindent kijelöl'], ['Szerkesztés', 'Mentés'], ['Szerkesztés', 'Keresés'], ['Böngésző', 'Új lap'], ['Böngésző', 'Lap bezárása'],
    ['Böngésző', 'Bezárt lap vissza'], ['Böngésző', 'Frissítés'], ['Böngésző', 'Ablak bezárása']].map(([g, l]) => byLabel(g, l)) },
  { name: 'Planner', buttons: DEFAULTS.map(m => Object.assign({ args: '' }, m)) }
];
const templateSets = () => SET_TEMPLATES.map(t => ({ name: t.name, buttons: normalize(t.buttons) }));

function normalize(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX).filter(m => m && typeof m === 'object').map(m => ({
    label: String(m.label || '?').slice(0, 40),
    color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : C_WIN,
    type: TYPES.includes(m.type) ? m.type : 'keys',
    value: String(m.value || ''),
    args: String(m.args || '')
  }));
}

const sameButtons = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

// A whole macros.json, cleaned: 1-6 sets with a name each, and a valid active index.
function normalizeDoc(raw) {
  if (Array.isArray(raw)) {
    // the old format: one list. Keep it as "Saját" unless it is just the old defaults
    // (those live on in the Planner set).
    const sets = templateSets();
    if (sameButtons(raw, DEFAULTS)) return { active: 0, sets };
    return { active: 0, sets: [{ name: 'Saját', buttons: normalize(raw) }].concat(sets).slice(0, MAX_SETS) };
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sets) || !raw.sets.length) return { active: 0, sets: templateSets() };
  const sets = raw.sets.slice(0, MAX_SETS).filter(x => x && typeof x === 'object').map((x, i) => ({
    name: String(x.name || '').trim().slice(0, 16) || 'Készlet ' + (i + 1),
    buttons: normalize(x.buttons)
  }));
  if (!sets.length) sets.push({ name: 'Saját', buttons: [] });
  const a = Number(raw.active);
  return { active: Number.isInteger(a) && a >= 0 && a < sets.length ? a : 0, sets };
}

// opts: { file, log, banner(kind, title, sub), planner(actionId, label), onChange() }
function createMacros(opts) {
  const file = opts.file;
  let selfWrite = 0;
  let doc = load();
  const list = () => doc.sets[doc.active].buttons;
  let helper = null, helperBroken = false;

  function load() {
    if (!fs.existsSync(file)) {
      const d = normalizeDoc(null);
      try { fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n'); opts.log(`Wrote the default sets to ${file}`); } catch (e) {}
      return d;
    }
    let raw;
    try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { opts.log(`${path.basename(file)} is not valid JSON (${e.message}); using the defaults.`); return normalizeDoc(null); }
    const d = normalizeDoc(raw);
    if (Array.isArray(raw)) {   // the old one-list file: rewrite it in the new format
      try { selfWrite = Date.now(); fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n'); opts.log(`Converted ${path.basename(file)} to button sets`); } catch (e) {}
    }
    return d;
  }

  // re-read on save (debounced: editors write in several steps)
  let reloadTimer = null;
  try {
    fs.watch(file, () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (Date.now() - selfWrite < 1500) return;   // the settings page just wrote it
        doc = load(); opts.log(`Reloaded ${doc.sets.length} sets`); opts.onChange();
      }, 300);
    });
  } catch (e) {}

  // The key helper runs for as long as the bridge does: starting PowerShell + Add-Type
  // for every press would cost about a second each.
  function keyHelper() {
    if (helper || helperBroken) return helper;
    const script = path.join(__dirname, 'winkeys.ps1');
    if (!fs.existsSync(script)) {
      helperBroken = true;
      opts.log('winkeys.ps1 is missing (an antivirus may have quarantined it). Key buttons are off; the others still work.');
      return null;
    }
    try {
      helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
        { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    } catch (e) { helperBroken = true; opts.log('Cannot start winkeys.ps1:', e.message); return null; }
    let rx = '';
    helper.stdout.on('data', b => {
      rx += b.toString('utf8');
      let i;
      while ((i = rx.indexOf('\n')) >= 0) {
        const l = rx.slice(0, i).trim();
        rx = rx.slice(i + 1);
        if (l.startsWith('error')) { opts.log('winkeys:', l); opts.banner(2, 'BILLENTYŰ', l.slice(6)); }
      }
    });
    helper.on('error', e => { opts.log('winkeys.ps1 failed:', e.message); helper = null; helperBroken = true; });
    helper.on('exit', () => { helper = null; });
    return helper;
  }

  function run(i) {
    const m = list()[i];
    if (!m) return;
    opts.log(`Macro ${i}: ${m.label} (${m.type} ${m.value})`);
    runDef(m);
  }

  // one button, saved or not (the settings page's Próba)
  function runDef(m) {
    if (!m) return;
    if (m.type === 'planner') return opts.planner(m.value, m.label);
    if (m.type === 'keys') {
      const h = keyHelper();
      if (!h) return opts.banner(2, 'NINCS BILLENTYŰ', 'winkeys.ps1 nem fut');
      h.stdin.write(m.value + '\n');
      return;
    }
    if (m.type === 'run') {
      if (!m.value) return;
      // start "" "<target>" <args>: programs, files and URLs alike, detached from the bridge
      exec(`start "" "${m.value.replace(/"/g, '')}" ${m.args}`, { windowsHide: false }, err => {
        if (err) opts.banner(3, 'NEM INDULT EL', m.label);
      });
    }
  }

  // the settings page's Mentés (a whole doc, or a plain list for the active set): clean,
  // write, send to the CYD
  function save(newDoc) {
    if (Array.isArray(newDoc)) { const d = JSON.parse(JSON.stringify(doc)); d.sets[d.active].buttons = newDoc; newDoc = d; }
    doc = normalizeDoc(newDoc);
    write();
    return doc;
  }

  function write() {
    selfWrite = Date.now();
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
    opts.onChange();
  }

  // the CYD's KEZDŐLAP: switch the active set
  function setActive(i) {
    if (!Number.isInteger(i) || i < 0 || i >= doc.sets.length) return null;
    doc.active = i;
    write();
    return doc.sets[i];
  }

  return {
    list,
    doc: () => doc,
    setActive,
    run,
    runDef: m => runDef(normalize([m])[0]),
    save,
    isSelfWrite: () => Date.now() - selfWrite < 1500,
    stop: () => { if (helper) try { helper.kill(); } catch (e) {} }
  };
}

module.exports = { createMacros, normalize, normalizeDoc, DEFAULTS, PRESETS, SET_TEMPLATES, TYPES, MAX, MAX_SETS };
