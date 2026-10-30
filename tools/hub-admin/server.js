#!/usr/bin/env node
// ---------------------------------------------------------------------------
// hub-admin/server.js — the owner's admin page for the VRG Kapu allowed list.
//
// One place for "let a new person in": edit Hub/data/access.json, raise rev,
// sign it (tools/hub-sign.js), verify, rebuild Kapu (tools/build-hub.js, plus
// the OneDrive copy when its folder is set), run tools/check-hub.js. Any failed
// step puts the previous access.json back, so the list is never left unsigned.
//
//   node tools/hub-admin/server.js            http://127.0.0.1:8798 (opens the browser)
//   node tools/hub-admin/server.js --no-open
//
// Listens on 127.0.0.1 only. Every POST needs the per-run token the page is
// served with, so another page in the browser cannot drive it.
// Settings (the OneDrive 00_START folder) live outside the repo, in
// H:\VRG\Full\_admin\hub-admin.json — never committed, never guessed.
// GitHub: the login is looked up on the public API (no token); the repo invite
// is not automated — the page opens the Collaborators settings for you.
// ---------------------------------------------------------------------------

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ACCESS = path.join(REPO, 'Hub', 'data', 'access.json');
const PAGE = path.join(__dirname, 'page.html');
const SHARED_CSS = path.join(REPO, 'shared', 'melyviz.css');
const CONFIG = 'H:\\VRG\\Full\\_admin\\hub-admin.json';
const REPO_SLUG = 'webagoly-work/vrg-toolset';
const PORT = 8798;
const TOKEN = crypto.randomBytes(16).toString('hex');
const ALL_LAYERS = ['L1', 'L2', 'L3', 'L4'];

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const config = () => readJson(CONFIG, { onedrive: '' });
const today = () => new Date().toISOString().slice(0, 10);

function run(label, script, args = []) {
  const r = spawnSync(process.execPath, [path.join(REPO, script), ...args], { cwd: REPO, encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  return { label, ok: r.status === 0, out };
}

/* Sign, verify, build (+ OneDrive), check. Stops at the first failure. */
function publish(sign = true) {
  const steps = [];
  const od = config().onedrive;
  const plan = [
    ...(sign ? [['Aláírás', 'tools/hub-sign.js']] : []),
    ['Ellenőrzés', 'tools/hub-sign.js', ['--verify']],
    ['Kapu építése' + (od ? ' + OneDrive' : ''), 'tools/build-hub.js', od ? ['--onedrive', od] : []],
    ['check-hub', 'tools/check-hub.js']
  ];
  for (const [label, script, args] of plan) {
    const s = run(label, script, args);
    steps.push(s);
    if (!s.ok) return { ok: false, steps };
  }
  return { ok: true, steps };
}

/* Apply fn to the body, raise rev, publish; restore the old file if anything fails. */
function change(fn) {
  const before = fs.readFileSync(ACCESS, 'utf8');
  const a = JSON.parse(before);
  const err = fn(a.body);
  if (err) return { ok: false, steps: [{ label: 'Lista', ok: false, out: err }] };
  a.body.rev = (a.body.rev || 0) + 1;
  a.body.updated = today();
  a.sig = '';
  fs.writeFileSync(ACCESS, JSON.stringify(a, null, 2) + '\n');
  const res = publish();
  if (!res.ok) {
    fs.writeFileSync(ACCESS, before);
    run('Visszaállítás', 'tools/build-hub.js');
    res.steps.push({ label: 'Visszaállítva', ok: true, out: 'Az előző, aláírt lista visszakerült; a Kapu újraépítve belőle.' });
  }
  return res;
}

async function ghUser(login) {
  try {
    const r = await fetch('https://api.github.com/users/' + encodeURIComponent(login),
      { headers: { 'user-agent': 'vrg-hub-admin', accept: 'application/vnd.github+json' } });
    if (r.status === 404) return { exists: false };
    if (!r.ok) return { exists: null, note: 'GitHub ' + r.status };
    const u = await r.json();
    return { exists: true, login: u.login, name: u.name || '' };
  } catch (e) { return { exists: null, note: 'nincs hálózat' }; }
}

function clean(p) {
  const name = String(p.name || '').trim();
  const github = String(p.github || '').trim();
  const emails = [].concat(p.emails || []).map(s => String(s).trim()).filter(Boolean);
  const layers = [].concat(p.layers || []).filter(l => ALL_LAYERS.includes(l));
  if (!name) return { err: 'Hiányzik a név.' };
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(github)) return { err: 'Érvénytelen GitHub felhasználónév.' };
  if (emails.some(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return { err: 'Érvénytelen e-mail cím.' };
  if (!layers.length) return { err: 'Legalább egy réteg kell.' };
  return { person: { name, github, emails, role: 'member', layers } };
}

function message(person) {
  return [
    'Szia ' + person.name + '!',
    '',
    'Hozzáférést kaptál a VRG eszközökhöz (VRG Kapu).',
    '',
    '1. Fogadd el a GitHub meghívót a ' + REPO_SLUG + ' tárolóhoz (e-mailben érkezik, vagy: https://github.com/' + REPO_SLUG + '/invitations).',
    '2. Nyisd meg a VRG Kaput (a megosztott OneDrive mappában: VRG-Megosztott\\00_START\\vrg-kapu.html).',
    '3. Kattints a „Token oldal megnyitása” gombra, készíts egy tokent, és másold be a Belépés mezőbe.',
    '   A „Hogyan kapok tokent? (5 lépés)” rész végigvezet rajta.',
    '',
    'A token csak a te böngésződben marad. Ne küldd el senkinek.',
    'GitHub fiók: ' + person.github
  ].join('\n');
}

function state() {
  const a = readJson(ACCESS, null);
  const v = run('Aláírás ellenőrzése', 'tools/hub-sign.js', ['--verify']);
  return { body: a && a.body, sigOk: v.ok, sigOut: v.out, config: config(), configPath: CONFIG, repo: REPO_SLUG, layers: ALL_LAYERS };
}

function page() {
  const css = fs.readFileSync(SHARED_CSS, 'utf8');
  return fs.readFileSync(PAGE, 'utf8').replace('/*@melyviz*/', () => css).replace('@TOKEN@', TOKEN);
}

function body(req) {
  return new Promise((ok, no) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } });
  });
}

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(page());
    }
    if (req.method === 'GET' && req.url === '/api/state') return send(res, 200, state());
    if (req.method !== 'POST') return send(res, 404, { error: 'nincs ilyen' });
    if (req.headers['x-hub-admin'] !== TOKEN) return send(res, 403, { error: 'rossz token — töltsd újra az oldalt' });
    const p = await body(req);

    if (req.url === '/api/lookup') return send(res, 200, await ghUser(String(p.github || '').trim()));

    if (req.url === '/api/add') {
      const c = clean(p);
      if (c.err) return send(res, 400, { ok: false, steps: [{ label: 'Űrlap', ok: false, out: c.err }] });
      const gh = await ghUser(c.person.github);
      if (gh.exists === false) return send(res, 400, { ok: false, steps: [{ label: 'GitHub', ok: false, out: 'Nincs ilyen GitHub felhasználó: ' + c.person.github }] });
      if (gh.login) c.person.github = gh.login;
      const r = change(b => {
        if (b.people.some(x => x.github.toLowerCase() === c.person.github.toLowerCase())) return 'Már a listán van: ' + c.person.github;
        b.people.push(c.person);
      });
      if (r.ok) r.message = message(c.person);
      return send(res, r.ok ? 200 : 500, r);
    }

    if (req.url === '/api/remove') {
      const login = String(p.github || '').toLowerCase();
      return send(res, 200, change(b => {
        const i = b.people.findIndex(x => x.github.toLowerCase() === login);
        if (i < 0) return 'Nincs a listán: ' + p.github;
        if (b.people[i].role === 'owner') return 'A tulajdonos nem vehető le.';
        b.people.splice(i, 1);
      }));
    }

    if (req.url === '/api/layers') {
      const login = String(p.github || '').toLowerCase();
      const layers = [].concat(p.layers || []).filter(l => ALL_LAYERS.includes(l));
      return send(res, 200, change(b => {
        const x = b.people.find(x => x.github.toLowerCase() === login);
        if (!x) return 'Nincs a listán: ' + p.github;
        if (!layers.length) return 'Legalább egy réteg kell.';
        x.layers = layers;
      }));
    }

    if (req.url === '/api/rebuild') return send(res, 200, publish(false));   // nothing changed: verify, don't re-sign

    if (req.url === '/api/message') {
      const a = readJson(ACCESS, { body: { people: [] } });
      const x = a.body.people.find(x => x.github.toLowerCase() === String(p.github || '').toLowerCase());
      return x ? send(res, 200, { message: message(x) }) : send(res, 404, { error: 'nincs a listán' });
    }

    if (req.url === '/api/config') {
      const od = String(p.onedrive || '').trim();
      if (od && !(fs.existsSync(od) && fs.statSync(od).isDirectory())) return send(res, 400, { error: 'Nincs ilyen mappa: ' + od });
      fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
      fs.writeFileSync(CONFIG, JSON.stringify({ onedrive: od }, null, 2) + '\n');
      return send(res, 200, { ok: true, config: config() });
    }

    send(res, 404, { error: 'nincs ilyen' });
  } catch (e) { send(res, 500, { error: String(e && e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + PORT + '/';
  console.log('VRG Kapu admin: ' + url + '  (Ctrl+C to stop)');
  if (!process.argv.includes('--no-open')) spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
});
