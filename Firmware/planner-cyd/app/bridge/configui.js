// configui.js - the MAKRÓK settings page: http://localhost:8788
//
// Edit up to 6 button sets ("készletek") of 12 macropad buttons each (colour, label, type,
// value), choose which set the CYD shows, add buttons from a library of everyday Windows
// presets, try one before saving, and switch "start with Windows" on or off. Saving writes
// macros.json and sends the active set to the CYD at once. The CYD's KEZDŐLAP can switch the
// active set too; the page follows it while nothing is being edited.
//
// Only this PC's own browser can use it: it listens on 127.0.0.1 and ::1, checks the Host and
// Origin headers, and takes JSON only - so another web page cannot press buttons or save
// (the same rules as the RL CYD's settings page).

'use strict';
const http = require('http');

// opts: { port, macros, templates, presets, types, max, maxSets, autostart, getStatus(), log }
function startConfigUi(opts) {
  const { port, log } = opts;
  const okHost = h => new RegExp(`^(localhost|127\\.0\\.0\\.1|\\[::1\\]):${port}$`).test(h || '');

  const handler = (req, res) => {
    if (!okHost(req.headers.host)) return reply(res, 403, { error: 'forbidden' });
    if (req.headers.origin && !okHost(req.headers.origin.replace(/^https?:\/\//, ''))) return reply(res, 403, { error: 'forbidden' });

    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(PAGE);
    }
    if (req.method === 'GET' && req.url === '/api/state') {
      return reply(res, 200, {
        app: 'planner-cyd-bridge', doc: opts.macros.doc(), templates: opts.templates, presets: opts.presets, types: opts.types, max: opts.max, maxSets: opts.maxSets,
        autostart: safe(() => opts.autostart.status(), false), status: opts.getStatus()
      });
    }
    if (req.method === 'POST' && ['/api/macros', '/api/test', '/api/autostart'].includes(req.url)) {
      if (!/^application\/json/.test(req.headers['content-type'] || '')) return reply(res, 415, { error: 'json only' });
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch (e) { return reply(res, 400, { error: 'bad json' }); }
        try {
          if (req.url === '/api/macros') {
            const saved = opts.macros.save(data.doc !== undefined ? data.doc : data.macros);
            log(`Settings page: ${saved.sets.length} sets saved; "${saved.sets[saved.active].name}" sent to the CYD.`);
            return reply(res, 200, { doc: saved });
          }
          if (req.url === '/api/test') { opts.macros.runDef(data.macro); return reply(res, 200, { ok: true }); }
          const on = opts.autostart.set(!!data.on);
          log(`Settings page: start with Windows ${on ? 'ON' : 'OFF'}`);
          return reply(res, 200, { autostart: on });
        } catch (e) { return reply(res, 500, { error: e.message }); }
      });
      return;
    }
    reply(res, 404, { error: 'not found' });
  };

  // "localhost" may resolve to ::1 or 127.0.0.1: listen on both
  const v4 = http.createServer(handler);
  v4.on('error', e => {
    if (e.code === 'EADDRINUSE') log(`Settings page: port ${port} is busy (another bridge running?). Use --ui-port to pick another.`);
    else log('Settings page error:', e.message);
  });
  v4.listen(port, '127.0.0.1', () => log(`MAKROK settings page: http://localhost:${port}`));
  const v6 = http.createServer(handler);
  v6.on('error', () => {});
  v6.listen(port, '::1');
}

function safe(f, d) { try { return f(); } catch (e) { return d; } }

function reply(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const PAGE = String.raw`<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CYD makropad</title>
<style>
  :root { --bg:#080b12; --panel:#161c28; --line:#262e3e; --text:#f0f4fa; --muted:#8a94a6; --accent:#2b5faf; --ok:#3cd26e; --bad:#e64646; color-scheme:dark; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.45 "Segoe UI",system-ui,sans-serif; }
  header { max-width:1100px; margin:0 auto; padding:20px 24px 6px; display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
  h1 { font-size:22px; margin:0; } h1 span { color:#6fa0ff; }
  #status { color:var(--muted); font-size:13px; } #status b { color:var(--text); font-weight:600; }
  main { max-width:1100px; margin:0 auto; padding:8px 24px 110px; display:grid; gap:16px; grid-template-columns:340px 1fr; align-items:start; }
  .preview-wrap { max-width:420px; }
  section { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px 18px; }
  section.wide { grid-column:1 / -1; }
  h2 { font-size:15px; margin:0 0 4px; } .hint { color:var(--muted); font-size:13px; margin:0 0 12px; }
  input[type=text], select { background:#0e131d; color:var(--text); border:1px solid var(--line); border-radius:8px; padding:6px 8px; font:inherit; min-width:0; width:100%; }
  input[type=color] { width:36px; height:32px; border:1px solid var(--line); border-radius:8px; background:none; padding:2px; }
  button { font:inherit; color:var(--text); background:#222b3b; border:1px solid var(--line); border-radius:8px; padding:6px 10px; cursor:pointer; }
  button:hover { border-color:#3a465c; } button:disabled { opacity:.35; cursor:default; }
  button.primary { background:var(--accent); border-color:var(--accent); font-weight:600; padding:10px 24px; }
  .preview { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; background:#000; border-radius:12px; padding:8px; }
  .preview div { aspect-ratio:76/67; border-radius:9px; display:grid; place-items:center; text-align:center; font-size:clamp(9.5px, 2.4vw, 12.5px); line-height:1.2; padding:4px; cursor:pointer; overflow:hidden; border:2px solid transparent; }
  .preview div.empty { border:1px solid #1d2433; cursor:default; }
  .preview div.sel { border-color:#fff; }
  .row { display:grid; grid-template-columns:26px 36px 1.2fr 110px 1.5fr auto; gap:6px; align-items:center; padding:7px 0; border-top:1px solid var(--line); }
  .row:first-child { border-top:0; } .row.sel { background:#1b2232; border-radius:8px; }
  .row .no { color:var(--muted); font-size:12px; text-align:right; }
  .row .tools { display:flex; gap:4px; } .row .tools button { padding:5px 8px; }
  .row .args { grid-column:5; }
  .lib-group { margin:12px 0 0; } .lib-group h3 { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin:0 0 8px; }
  .lib { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:6px; }
  .chip { display:flex; align-items:center; gap:8px; padding:7px 9px; border:1px solid var(--line); border-radius:9px; background:#0e131d; cursor:pointer; text-align:left; }
  .chip i { width:14px; height:14px; border-radius:4px; flex:none; } .chip small { display:block; color:var(--muted); font-size:11px; }
  .switch { display:flex; gap:10px; align-items:center; }
  .sets { display:flex; gap:6px; flex-wrap:wrap; margin:0 0 10px; }
  .sets button.cur { background:#2a3550; border-color:#6fa0ff; }
  .sets button .act { color:var(--ok); margin-left:6px; font-size:12px; }
  .setbar { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:0 0 12px; padding:0 0 12px; border-bottom:1px solid var(--line); }
  .setbar input[type=text] { width:170px; } .setbar select { width:auto; }
  .setbar .on { color:var(--ok); font-size:13px; }
  footer { position:fixed; left:0; right:0; bottom:0; background:#0b0f18ee; border-top:1px solid var(--line); padding:12px 16px; display:flex; gap:12px; justify-content:center; align-items:center; flex-wrap:wrap; }
  #msg { color:var(--muted); font-size:13px; flex:0 1 260px; min-width:0; } #msg.ok { color:var(--ok); } #msg.bad { color:var(--bad); }
  @media (max-width:1000px) { main { grid-template-columns:1fr; } }
  @media (max-width:560px) { main { padding:8px 16px 110px; } .row { grid-template-columns:22px 34px 1fr 100px; } .row .val, .row .args, .row .tools { grid-column:2 / -1; } }
</style>
</head>
<body>
<header><h1>CYD <span>makropad</span></h1><div id="status">betöltés…</div></header>
<main>
  <section>
    <h2>Előnézet</h2>
    <p class="hint">Így látszik a CYD MAKRÓK oldalán. Kattints egy gombra a szerkesztéséhez.</p>
    <div class="preview" id="preview"></div>
    <div style="margin-top:16px">
      <h2>Indítás a Windowszal</h2>
      <p class="hint">Bejelentkezéskor kis ablakban elindul a makropad (Indítópult mappa: Win+R, <code>shell:startup</code>).</p>
      <label class="switch"><input type="checkbox" id="auto"> <span id="autoTxt">…</span></label>
    </div>
  </section>
  <section>
    <h2>Készletek</h2>
    <p class="hint">Több gombkészletet is tarthatsz (pl. Windows, Média, Iroda); a CYD a <b>KEZDŐLAP</b>-on választ közülük, vagy itt az „Ez legyen a CYD-n” gomb.</p>
    <div class="sets" id="sets"></div>
    <div class="setbar">
      <input type="text" id="setName" maxlength="16" placeholder="Készlet neve" title="A készlet neve (a CYD-n is ez látszik)">
      <button id="setActive">Ez legyen a CYD-n</button>
      <select id="newFrom" title="Új készlet"><option value="">+ Új készlet…</option></select>
      <button id="setDel">Készlet törlése</button>
    </div>
    <h2>Gombok <small style="color:var(--muted);font-weight:400" id="count"></small></h2>
    <p class="hint"><b>Billentyű</b>: kombináció a fókuszban lévő ablaknak (pl. <code>ctrl+shift+s</code>, <code>win+d</code>, <code>volume_mute</code>, <code>f5</code>).
      <b>Program</b>: program, fájl vagy webcím, mellette az argumentumok. <b>Planner</b>: Planner-művelet azonosítója (pl. <code>doc.print</code>), csak megnyitott Plannerrel.</p>
    <div id="rows"></div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button id="add">+ Üres gomb</button><select id="reset" style="width:auto"><option value="">Sablon betöltése ebbe a készletbe…</option></select>
    </div>
  </section>
  <section class="wide">
    <h2>Gyűjtemény</h2>
    <p class="hint">Kattintásra a kijelölt gomb helyére kerül (ha nincs kijelölve, a végére).</p>
    <div id="library"></div>
  </section>
</main>
<footer><span id="msg"></span><button class="primary" id="save">Mentés és küldés a CYD-re</button></footer>
<script>
const $ = s => document.querySelector(s);
const TYPE_HU = { keys: 'Billentyű', run: 'Program', planner: 'Planner' };
let S = null, doc = null, cur = 0, list = [], sel = -1, dirty = false;
const copyDoc = d => JSON.parse(JSON.stringify(d));
function pick(i) { cur = i; list = doc.sets[cur].buttons; sel = -1; }

function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function ink(hex) { const v = parseInt(hex.slice(1), 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#080b12' : '#f0f4fa'; }
function msg(t, cls) { const m = $('#msg'); m.textContent = t; m.className = cls || ''; }
function mark() { dirty = true; msg('Nincs mentve.'); }

async function api(url, body) {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}

function drawPreview() {
  const p = $('#preview'); p.innerHTML = '';
  for (let i = 0; i < S.max; i++) {
    const m = list[i], d = document.createElement('div');
    if (!m) { d.className = 'empty'; p.appendChild(d); continue; }
    d.textContent = m.label; d.style.background = m.color; d.style.color = ink(m.color);
    if (i === sel) d.className = 'sel';
    d.onclick = () => { sel = i === sel ? -1 : i; draw(); };
    p.appendChild(d);
  }
}

function drawRows() {
  const box = $('#rows'); box.innerHTML = '';
  $('#count').textContent = list.length + ' / ' + S.max;
  list.forEach((m, i) => {
    const r = document.createElement('div'); r.className = 'row' + (i === sel ? ' sel' : '');
    r.innerHTML = '<span class="no">' + (i + 1) + '</span>' +
      '<input type="color" value="' + m.color + '" title="Szín">' +
      '<input type="text" class="lab" value="' + esc(m.label) + '" placeholder="Felirat" maxlength="40">' +
      '<select>' + S.types.map(t => '<option value="' + t + '"' + (t === m.type ? ' selected' : '') + '>' + TYPE_HU[t] + '</option>').join('') + '</select>' +
      '<input type="text" class="val" value="' + esc(m.value) + '" placeholder="' + (m.type === 'keys' ? 'ctrl+c' : m.type === 'run' ? 'calc.exe' : 'doc.print') + '">' +
      '<span class="tools"><button data-a="try" title="Kipróbálás most">Próba</button><button data-a="up" title="Feljebb"' + (i ? '' : ' disabled') + '>↑</button>' +
      '<button data-a="down" title="Lejjebb"' + (i < list.length - 1 ? '' : ' disabled') + '>↓</button><button data-a="del" title="Törlés">✕</button></span>' +
      (m.type === 'run' ? '<span></span><span></span><span></span><span></span><input type="text" class="args" value="' + esc(m.args) + '" placeholder="argumentumok (nem kötelező)">' : '');
    const [color, lab, type, val] = r.querySelectorAll('input[type=color], input.lab, select, input.val');
    color.oninput = () => { m.color = color.value; mark(); drawPreview(); };
    lab.oninput = () => { m.label = lab.value; mark(); drawPreview(); };
    type.onchange = () => { m.type = type.value; mark(); draw(); };
    val.oninput = () => { m.value = val.value.trim(); mark(); };
    const args = r.querySelector('input.args'); if (args) args.oninput = () => { m.args = args.value; mark(); };
    r.onclick = e => { if (!e.target.closest('input,select,button') && sel !== i) { sel = i; draw(); } };
    r.querySelector('.tools').onclick = async e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'try') { try { await api('/api/test', { macro: m }); msg('Elküldve: ' + m.label, 'ok'); } catch (x) { msg('Hiba: ' + x.message, 'bad'); } return; }
      if (a === 'del') { list.splice(i, 1); if (sel >= list.length) sel = list.length - 1; }
      if (a === 'up') { [list[i - 1], list[i]] = [list[i], list[i - 1]]; sel = i - 1; }
      if (a === 'down') { [list[i + 1], list[i]] = [list[i], list[i + 1]]; sel = i + 1; }
      mark(); draw();
    };
    box.appendChild(r);
  });
  $('#add').disabled = list.length >= S.max;
}

function drawLibrary() {
  const box = $('#library'); box.innerHTML = '';
  const groups = [...new Set(S.presets.map(p => p.group))];
  for (const g of groups) {
    const sec = document.createElement('div'); sec.className = 'lib-group';
    sec.innerHTML = '<h3>' + esc(g) + '</h3><div class="lib"></div>';
    for (const p of S.presets.filter(x => x.group === g)) {
      const c = document.createElement('button'); c.className = 'chip';
      c.innerHTML = '<i style="background:' + p.color + '"></i><span>' + esc(p.label) + '<small>' + esc(TYPE_HU[p.type] + ': ' + (p.type === 'run' ? p.value.split(/[\\/]/).pop() : p.value)) + '</small></span>';
      c.onclick = () => {
        const m = { label: p.label, color: p.color, type: p.type, value: p.value, args: p.args || '' };
        if (sel >= 0 && sel < list.length) list[sel] = m;
        else if (list.length < S.max) { list.push(m); sel = list.length - 1; }
        else { msg('Mind a 12 hely foglalt: jelölj ki egyet a cseréhez.', 'bad'); return; }
        mark(); draw();
      };
      sec.querySelector('.lib').appendChild(c);
    }
    box.appendChild(sec);
  }
}

function drawSets() {
  const box = $('#sets'); box.innerHTML = '';
  doc.sets.forEach((x, i) => {
    const b = document.createElement('button'); if (i === cur) b.className = 'cur';
    b.innerHTML = esc(x.name) + (i === doc.active ? '<span class="act" title="Ez látszik a CYD-n">● CYD</span>' : '');
    b.onclick = () => { pick(i); draw(); };
    box.appendChild(b);
  });
  $('#setName').value = doc.sets[cur].name;
  const a = $('#setActive');
  a.disabled = cur === doc.active; a.textContent = cur === doc.active ? 'Ez van a CYD-n' : 'Ez legyen a CYD-n';
  $('#setDel').disabled = doc.sets.length < 2;
  $('#newFrom').disabled = doc.sets.length >= S.maxSets;
}

function draw() { drawSets(); drawPreview(); drawRows(); }

function drawStatus() {
  const st = S.status;
  $('#status').innerHTML = 'CYD: <b>' + esc(st.cyd) + '</b> · Planner: <b>' + (st.planner ? 'nyitva' : 'nincs') + '</b>';
  $('#auto').checked = !!S.autostart;
  $('#autoTxt').textContent = S.autostart ? 'Be - bejelentkezéskor elindul' : 'Ki';
}

async function load() {
  S = await api('/api/state');
  doc = copyDoc(S.doc); pick(doc.active);
  const opt = (v, t) => '<option value="' + v + '">' + esc(t) + '</option>';
  $('#newFrom').innerHTML = opt('', '+ Új készlet…') + opt('empty', 'Üres') + S.templates.map((t, i) => opt(i, 'Sablon: ' + t.name)).join('');
  $('#reset').innerHTML = opt('', 'Sablon betöltése ebbe a készletbe…') + S.templates.map((t, i) => opt(i, t.name + ' (' + t.buttons.length + ' gomb)')).join('');
  drawStatus(); draw(); drawLibrary();
}

$('#add').onclick = () => { if (list.length < S.max) { list.push({ label: 'Új gomb', color: '#3A4256', type: 'keys', value: '', args: '' }); sel = list.length - 1; mark(); draw(); } };
$('#reset').onchange = e => {
  const t = S.templates[e.target.value]; e.target.value = '';
  if (!t || !confirm('Ennek a készletnek a gombjait lecseréled erre: ' + t.name + '? (Mentésig nem változik semmi.)')) return;
  doc.sets[cur].buttons = copyDoc(t.buttons); list = doc.sets[cur].buttons; sel = -1; mark(); draw();
};
$('#setName').oninput = e => { doc.sets[cur].name = e.target.value; mark(); drawSets(); };
$('#setActive').onclick = () => { doc.active = cur; mark(); drawSets(); msg('Mentéskor ez a készlet kerül a CYD-re.'); };
$('#newFrom').onchange = e => {
  const v = e.target.value; e.target.value = '';
  if (v === '' || doc.sets.length >= S.maxSets) return;
  const t = v === 'empty' ? { name: 'Új készlet', buttons: [] } : S.templates[v];
  doc.sets.push({ name: t.name, buttons: copyDoc(t.buttons) }); pick(doc.sets.length - 1); mark(); draw();
  $('#setName').select();
};
$('#setDel').onclick = () => {
  if (doc.sets.length < 2 || !confirm('Törlöd ezt a készletet: ' + doc.sets[cur].name + '? (Mentésig nem változik semmi.)')) return;
  doc.sets.splice(cur, 1);
  if (doc.active > cur) doc.active--; else if (doc.active === cur) doc.active = 0;
  pick(Math.min(cur, doc.sets.length - 1)); mark(); draw();
};
$('#save').onclick = async () => {
  try {
    const r = await api('/api/macros', { doc }); const keep = cur;
    doc = copyDoc(r.doc); pick(Math.min(keep, doc.sets.length - 1)); dirty = false; draw();
    msg('Elmentve, a CYD megkapta: ' + doc.sets[doc.active].name + '.', 'ok');
  } catch (x) { msg('Nem sikerült: ' + x.message, 'bad'); }
};
$('#auto').onchange = async e => {
  try { const r = await api('/api/autostart', { on: e.target.checked }); S.autostart = r.autostart; drawStatus(); msg(r.autostart ? 'Indítás a Windowszal: be.' : 'Indítás a Windowszal: ki.', 'ok'); }
  catch (x) { e.target.checked = !e.target.checked; msg('Nem sikerült: ' + x.message, 'bad'); }
};
window.onbeforeunload = () => dirty ? 'Nincs mentve.' : undefined;
setInterval(async () => {
  try {
    const d = await api('/api/state'); S.status = d.status; S.autostart = d.autostart; drawStatus();
    // the CYD (or macros.json by hand) changed the sets: follow it while nothing is being edited
    if (!dirty && JSON.stringify(d.doc) !== JSON.stringify(doc)) { const keep = cur === doc.active ? -1 : cur; doc = copyDoc(d.doc); pick(keep < 0 || keep >= doc.sets.length ? doc.active : keep); draw(); }
  } catch (e) { $('#status').textContent = 'A bridge nem fut.'; }
}, 3000);
load().catch(e => { $('#status').textContent = 'A bridge nem fut: ' + e.message; });
</script>
</body>
</html>`;

module.exports = { startConfigUi };
