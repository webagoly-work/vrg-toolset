/* ==========================================================================
   11b-backup.js — Varler Planner · Teljes mentés / visszatöltés (backup bundle)
   --------------------------------------------------------------------------
   PURPOSE
     Export EVERY saved project (plus the planner's other localStorage state)
     into ONE .vbundle.json file, and restore it in another browser profile.
     Built for the portable Opera GX migration: a standalone/USB Opera GX is a
     NEW profile, so localStorage — and with it the whole project library —
     starts empty. Export before you switch, import after.

   WHERE IT GOES
     src/11b-backup.js   (between 11-controls.js and 12-boot.js)
     The NNx naming means build.js picks it up with NO renumbering.
     Then: node build.js && node --check on the extracted <script>.

   DEPENDENCY SURFACE — deliberately almost zero
     This module does NOT touch the state object, the action registry, the
     render pipeline or any internal identifier, because guessing your names
     is exactly what caused the SC collision and the wrong-button-id bugs.
     It works on localStorage directly, and reloads the page after an import
     so the normal load path (with migrate()) does the rest.

     It declares exactly ONE top-level name: VBACKUP.
     Grep before building:  grep -n "VBACKUP" src/*.js   → must be this file only.

     Soft, guarded references (safe if absent, via typeof):
       VERSION        — stamped into the bundle for information only
       #pjExport      — the Projektek panel button; its parent hosts the new
                        button. If missing, a floating launcher is used instead.

   WHAT IT DOES NOT DO
     No cloud, no network, no auto-upload. One file, your hands, your pendrive.

   OPTIONAL — wire into the ⌘K palette (05c-actions.js), your registry call:
       { id:'backup.open', label:'Teljes mentés / visszatöltés…',
         group:'projekt', icon:'🗄', alias:'backup export bundle import',
         hint:'Minden projekt egyetlen fájlba',
         when:()=>true, run:()=>VBACKUP.open() }
   ========================================================================== */

const VBACKUP = (function () {
  'use strict';

  /* ---- constants -------------------------------------------------------- */

  const FORMAT = 'varler-planner-bundle';
  const BUNDLE_VERSION = 1;

  const PROJECT_KEY = 'villanyterv_projects_v1';   // the project library
  const LAST_KEY = 'varler_backup_last';           // our own bookkeeping
  const KEY_MATCH = /^(villanyterv|varler|planner|domoszlo)/i;
  const KEY_SKIP = [LAST_KEY];

  const EXT = '.vbundle.json';

  /* ---- tiny helpers ----------------------------------------------------- */

  const now = () => new Date();
  const iso = d => d.toISOString();
  const stamp = d => d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

  function appVersion() {
    try { return (typeof VERSION !== 'undefined' && VERSION) ? String(VERSION) : '?'; }
    catch (e) { return '?'; }
  }

  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' kB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function safeName(s) {
    return String(s || 'projekt').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  function huDate(v) {
    if (!v) return '—';
    const d = (typeof v === 'number') ? new Date(v) : new Date(String(v));
    return isNaN(d) ? String(v).slice(0, 19) : d.toLocaleString('hu-HU');
  }

  // FNV-1a — enough to catch a truncated or half-copied file.
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  /* ---- reading the store ------------------------------------------------ */

  function storeKeys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || KEY_SKIP.indexOf(k) >= 0) continue;
      if (KEY_MATCH.test(k)) out.push(k);
    }
    return out.sort();
  }

  function readStore() {
    const store = {};
    storeKeys().forEach(k => { store[k] = localStorage.getItem(k); });
    return store;
  }

  // The library may be an array of projects or an id→project map. Handle both,
  // and never assume a field name — read defensively.
  function listProjects(raw) {
    let parsed;
    try { parsed = JSON.parse(raw || 'null'); } catch (e) { return []; }
    if (!parsed) return [];

    let entries;
    if (Array.isArray(parsed)) entries = parsed.map((p, i) => [p && (p.id || p.key) || String(i), p]);
    else if (typeof parsed === 'object') entries = Object.keys(parsed).map(k => [k, parsed[k]]);
    else return [];

    return entries.map(([id, p]) => {
      p = p || {};
      const size = JSON.stringify(p).length;
      return {
        id: String(p.id || p.key || id),
        name: String(p.name || p.title || p.projectName || '(névtelen)'),
        date: p.saved || p.updated || p.modified || p.date || p.ts || p.mtime || null,
        size: size,
        raw: p
      };
    });
  }

  function currentProjects() { return listProjects(localStorage.getItem(PROJECT_KEY)); }

  /* ---- building a bundle ------------------------------------------------ */

  function build() {
    const store = readStore();
    const projects = listProjects(store[PROJECT_KEY]);
    const canon = JSON.stringify(store);
    return {
      format: FORMAT,
      bundleVersion: BUNDLE_VERSION,
      app: appVersion(),
      created: iso(now()),
      origin: { href: location.href, ua: navigator.userAgent },
      counts: { projects: projects.length, keys: Object.keys(store).length, bytes: canon.length },
      index: projects.map(p => ({ id: p.id, name: p.name, date: p.date, size: p.size })),
      store: store,
      checksum: hash(canon)
    };
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }

  function exportAll() {
    const b = build();
    const text = JSON.stringify(b, null, 1);
    download('varler-planner-' + stamp(now()) + EXT, text);
    try { localStorage.setItem(LAST_KEY, iso(now())); } catch (e) { }
    return { projects: b.counts.projects, bytes: text.length };
  }

  // Secondary path: one .vplan.json per project, for cherry-picking later.
  function exportEach(onProgress) {
    const list = currentProjects();
    list.forEach((p, i) => {
      setTimeout(() => {
        download(safeName(p.name) + '.vplan.json', JSON.stringify(p.raw, null, 1));
        if (onProgress) onProgress(i + 1, list.length);
      }, i * 350);
    });
    return list.length;
  }

  /* ---- reading a bundle back -------------------------------------------- */

  function parse(text) {
    let b;
    try { b = JSON.parse(text); }
    catch (e) { throw new Error('Nem érvényes JSON — a fájl sérült vagy nem teljes.'); }

    if (!b || b.format !== FORMAT)
      throw new Error('Ez nem Varler Planner mentés. Várt formátum: ' + FORMAT);
    if (!(b.bundleVersion <= BUNDLE_VERSION))
      throw new Error('A mentés újabb formátumú (v' + b.bundleVersion + '), mint amit ez a verzió olvasni tud (v' + BUNDLE_VERSION + ').');
    if (!b.store || typeof b.store !== 'object')
      throw new Error('A mentésből hiányzik a tartalom.');

    b.__checksumOk = (b.checksum === hash(JSON.stringify(b.store)));
    b.__projects = listProjects(b.store[PROJECT_KEY]);
    return b;
  }

  /* Modes:
       'merge'     — add projects that aren't here yet, leave existing alone
       'overwrite' — add, and replace same-id projects with the bundle's copy
       'replace'   — wipe the planner's localStorage keys, restore the bundle
     Returns a report; the caller reloads the page so the app re-reads
     everything through its normal load path (which runs migrate()).          */
  function apply(bundle, mode, ids) {
    const pick = ids && ids.length ? {} : null;
    if (pick) ids.forEach(id => { pick[id] = true; });

    const report = { added: 0, replaced: 0, skipped: 0, keys: 0, mode: mode };

    if (mode === 'replace') {
      storeKeys().forEach(k => localStorage.removeItem(k));
      Object.keys(bundle.store).forEach(k => {
        if (k === PROJECT_KEY && pick) return;
        localStorage.setItem(k, bundle.store[k]);
        report.keys++;
      });
      if (pick) {
        const keep = bundle.__projects.filter(p => pick[p.id]).map(p => p.raw);
        localStorage.setItem(PROJECT_KEY, JSON.stringify(keep));
        report.added = keep.length;
        report.keys++;
      } else {
        report.added = bundle.__projects.length;
      }
      return report;
    }

    // merge / overwrite — projects first
    const mine = currentProjects();
    const byId = {};
    mine.forEach(p => { byId[p.id] = p; });
    const out = mine.map(p => p.raw);
    const posOf = {};
    mine.forEach((p, i) => { posOf[p.id] = i; });

    bundle.__projects.forEach(p => {
      if (pick && !pick[p.id]) return;
      if (byId[p.id]) {
        if (mode === 'overwrite') { out[posOf[p.id]] = p.raw; report.replaced++; }
        else report.skipped++;
      } else {
        out.push(p.raw); report.added++;
      }
    });
    localStorage.setItem(PROJECT_KEY, JSON.stringify(out));
    report.keys++;

    // other keys: only fill gaps, unless overwriting
    Object.keys(bundle.store).forEach(k => {
      if (k === PROJECT_KEY) return;
      if (mode === 'overwrite' || localStorage.getItem(k) === null) {
        localStorage.setItem(k, bundle.store[k]);
        report.keys++;
      }
    });
    return report;
  }

  /* ---- dialog ------------------------------------------------------------
     Self-contained on purpose: this is a maintenance screen that has to work
     even when the rest of the app is in a bad state, so it doesn't route
     through openModal(). Swap the two build* functions below if you'd rather
     it inherit the app's dialog chrome.                                      */

  let host = null, loaded = null;

  const CSS = `
.vbk-ov{position:fixed;inset:0;background:rgba(8,10,12,.72);z-index:99999;display:flex;
  align-items:center;justify-content:center;font:13px/1.45 system-ui,Segoe UI,sans-serif}
.vbk-pn{background:#1d2126;color:#e8e6e3;border:1px solid #3a4048;border-radius:8px;
  width:min(680px,94vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 18px 48px rgba(0,0,0,.55)}
.vbk-hd{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #313841}
.vbk-hd b{font-size:14px;font-weight:600;flex:1}
.vbk-x{background:none;border:0;color:#9aa3ad;font-size:18px;cursor:pointer;padding:0 4px}
.vbk-x:hover{color:#e8e6e3}
.vbk-tb{display:flex;gap:4px;padding:10px 14px 0}
.vbk-tb button{background:#252a30;border:1px solid #3a4048;color:#b8c0c8;padding:6px 14px;
  border-radius:5px 5px 0 0;cursor:pointer;font:inherit}
.vbk-tb button.on{background:#2f3640;color:#fff;border-bottom-color:#2f3640}
.vbk-bd{padding:14px;overflow:auto;flex:1}
.vbk-bd p{margin:0 0 10px;color:#b8c0c8}
.vbk-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
.vbk-btn{background:#3a6ea5;border:1px solid #4a80bd;color:#fff;padding:8px 16px;border-radius:5px;
  cursor:pointer;font:inherit}
.vbk-btn:hover{background:#4a80bd}
.vbk-btn.sec{background:#2b3138;border-color:#3a4048;color:#cfd6dd}
.vbk-btn.sec:hover{background:#353c44}
.vbk-btn[disabled]{opacity:.45;cursor:default}
.vbk-list{border:1px solid #313841;border-radius:5px;max-height:230px;overflow:auto;margin:10px 0}
.vbk-li{display:flex;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid #262c33}
.vbk-li:last-child{border-bottom:0}
.vbk-li .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vbk-li .mt{color:#8b949e;font-size:11.5px;white-space:nowrap}
.vbk-li.new .nm:after{content:' új';color:#5ec97a;font-size:11px}
.vbk-li.dup .nm:after{content:' ütközik';color:#e0a33e;font-size:11px}
.vbk-note{background:#232830;border-left:3px solid #b8863b;padding:9px 11px;border-radius:0 4px 4px 0;
  color:#d6c9ae;margin:10px 0}
.vbk-err{background:#2d2022;border-left:3px solid #c05a5a;padding:9px 11px;border-radius:0 4px 4px 0;
  color:#e9b7b7;margin:10px 0;white-space:pre-wrap}
.vbk-ok{background:#1f2b22;border-left:3px solid #5ec97a;padding:9px 11px;border-radius:0 4px 4px 0;
  color:#bfe4c8;margin:10px 0}
.vbk-lbl{display:flex;gap:6px;align-items:center;color:#b8c0c8}
.vbk-ft{padding:10px 14px;border-top:1px solid #313841;display:flex;justify-content:space-between;
  align-items:center;color:#7f8892;font-size:11.5px}
.vbk-launch{position:fixed;right:14px;bottom:14px;z-index:9998}
`;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function ensureCss() {
    if (document.getElementById('vbk-css')) return;
    const s = document.createElement('style');
    s.id = 'vbk-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function close() {
    if (host) { host.remove(); host = null; }
    loaded = null;
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }

  function open(tab) {
    ensureCss();
    close();
    host = el('div', 'vbk-ov');
    const pn = el('div', 'vbk-pn');
    const hd = el('div', 'vbk-hd', '<b>🗄 Teljes mentés</b>');
    const x = el('button', 'vbk-x', '✕'); x.onclick = close; hd.appendChild(x);
    const tb = el('div', 'vbk-tb');
    const bSave = el('button', '', 'Mentés');
    const bLoad = el('button', '', 'Visszatöltés');
    tb.appendChild(bSave); tb.appendChild(bLoad);
    const bd = el('div', 'vbk-bd');
    const ft = el('div', 'vbk-ft');

    function show(which) {
      bSave.className = which === 'save' ? 'on' : '';
      bLoad.className = which === 'load' ? 'on' : '';
      bd.innerHTML = '';
      (which === 'save' ? paintSave : paintLoad)(bd, ft);
    }
    bSave.onclick = () => show('save');
    bLoad.onclick = () => show('load');

    pn.appendChild(hd); pn.appendChild(tb); pn.appendChild(bd); pn.appendChild(ft);
    host.appendChild(pn);
    host.addEventListener('mousedown', e => { if (e.target === host) close(); });
    document.body.appendChild(host);
    document.addEventListener('keydown', onKey, true);
    show(tab === 'load' ? 'load' : 'save');
  }

  function paintSave(bd, ft) {
    const list = currentProjects();
    const total = list.reduce((s, p) => s + p.size, 0);
    const last = localStorage.getItem(LAST_KEY);

    bd.appendChild(el('p', '', 'Minden projekt egyetlen fájlba, a planner többi mentett beállításával együtt. ' +
      'Ez a fájl visz át mindent egy másik böngészőbe vagy gépre.'));

    if (!list.length) {
      bd.appendChild(el('div', 'vbk-note', 'Nincs mentett projekt ebben a böngészőben. ' +
        'Ha itt kellene lennie a Domoszlónak, valószínűleg egy másik böngészőprofilban van.'));
    } else {
      const ul = el('div', 'vbk-list');
      list.forEach(p => {
        const li = el('div', 'vbk-li');
        li.appendChild(el('span', 'nm', p.name));
        li.appendChild(el('span', 'mt', huDate(p.date) + ' · ' + bytes(p.size)));
        ul.appendChild(li);
      });
      bd.appendChild(ul);
    }

    const row = el('div', 'vbk-row');
    const one = el('button', 'vbk-btn', '⬇ Mentés fájlba (' + list.length + ' projekt)');
    one.disabled = !list.length;
    one.onclick = () => {
      const r = exportAll();
      bd.insertBefore(el('div', 'vbk-ok',
        'Elmentve: ' + r.projects + ' projekt, ' + bytes(r.bytes) +
        '. Tedd a data/projects/ mappába a pendrive-on.'), bd.firstChild);
    };
    const each = el('button', 'vbk-btn sec', '⬇ Külön fájlokba');
    each.disabled = !list.length;
    each.onclick = () => {
      const n = exportEach();
      bd.insertBefore(el('div', 'vbk-ok', n + ' darab .vplan.json letöltése indul, egyenként.'), bd.firstChild);
    };
    row.appendChild(one); row.appendChild(each);
    bd.appendChild(row);

    ft.innerHTML = 'Planner ' + appVersion() + ' · ' + bytes(total) + ' projektadat · ' +
      'utolsó mentés: ' + (last ? huDate(last) : 'még soha');
  }

  function paintLoad(bd, ft) {
    bd.appendChild(el('p', '', 'Válaszd ki a korábban mentett ' + EXT + ' fájlt.'));

    const inp = el('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.style.cssText = 'display:block;margin:8px 0 4px;color:#b8c0c8';
    bd.appendChild(inp);
    const zone = el('div'); bd.appendChild(zone);

    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        zone.innerHTML = '';
        try { loaded = parse(String(fr.result)); }
        catch (err) { zone.appendChild(el('div', 'vbk-err', err.message)); return; }
        paintPreview(zone, f);
      };
      fr.onerror = () => { zone.innerHTML = ''; zone.appendChild(el('div', 'vbk-err', 'A fájlt nem sikerült beolvasni.')); };
      fr.readAsText(f);
    };

    ft.innerHTML = 'A visszatöltés után a planner újratölt, hogy az adatok érvényre jussanak.';
  }

  function paintPreview(zone, file) {
    const b = loaded;
    const mine = {}; currentProjects().forEach(p => { mine[p.id] = true; });

    zone.appendChild(el('div', 'vbk-note',
      '<b>' + file.name + '</b><br>' +
      b.__projects.length + ' projekt · készült: ' + huDate(b.created) +
      ' · planner ' + b.app + ' (most: ' + appVersion() + ')'));

    if (!b.__checksumOk) {
      zone.appendChild(el('div', 'vbk-err',
        'Az ellenőrző összeg nem egyezik — a fájl valószínűleg sérült vagy nem teljesen másolódott át. ' +
        'A visszatöltés folytatható, de előbb érdemes újramásolni.'));
    }

    const ul = el('div', 'vbk-list');
    const boxes = [];
    b.__projects.forEach(p => {
      const dup = !!mine[p.id];
      const li = el('div', 'vbk-li' + (dup ? ' dup' : ' new'));
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = true; cb.dataset.id = p.id;
      boxes.push(cb);
      li.appendChild(cb);
      li.appendChild(el('span', 'nm', p.name));
      li.appendChild(el('span', 'mt', huDate(p.date) + ' · ' + bytes(p.size)));
      ul.appendChild(li);
    });
    zone.appendChild(ul);

    const modeRow = el('div', 'vbk-row');
    const sel = el('select');
    sel.style.cssText = 'background:#252a30;color:#e8e6e3;border:1px solid #3a4048;border-radius:4px;padding:6px 8px;font:inherit';
    sel.innerHTML =
      '<option value="merge">Hozzáadás — a meglévők maradnak</option>' +
      '<option value="overwrite">Hozzáadás és felülírás — az azonos projektek cserélődnek</option>' +
      '<option value="replace">Csere — minden mostani adat törlődik</option>';
    modeRow.appendChild(el('span', 'vbk-lbl', 'Mit tegyen az ütközésekkel:'));
    modeRow.appendChild(sel);
    zone.appendChild(modeRow);

    const warn = el('div', 'vbk-err', 'A csere törli az ebben a böngészőben tárolt összes projektet. Előbb ments!');
    warn.style.display = 'none';
    zone.appendChild(warn);
    sel.onchange = () => { warn.style.display = sel.value === 'replace' ? '' : 'none'; };

    const go = el('button', 'vbk-btn', '⬆ Visszatöltés');
    go.onclick = () => {
      const ids = boxes.filter(c => c.checked).map(c => c.dataset.id);
      if (!ids.length) return;
      if (sel.value === 'replace' &&
        !confirm('Biztosan lecseréled a jelenlegi adatokat? Ez nem vonható vissza.')) return;
      let r;
      try { r = apply(b, sel.value, ids); }
      catch (err) { zone.appendChild(el('div', 'vbk-err', 'Nem sikerült: ' + err.message)); return; }
      const done = el('div', 'vbk-ok',
        'Kész — ' + r.added + ' új, ' + r.replaced + ' felülírva, ' + r.skipped + ' kihagyva. ' +
        'A planner most újratölt.');
      zone.appendChild(done);
      setTimeout(() => location.reload(), 1200);
    };
    const row = el('div', 'vbk-row'); row.appendChild(go);
    zone.appendChild(row);
  }

  /* ---- mounting the launcher -------------------------------------------- */

  function mount() {
    if (document.getElementById('vbkOpen')) return true;
    const btn = el('button', '', '🗄 Teljes mentés…');
    btn.id = 'vbkOpen';
    btn.title = 'Minden projekt egyetlen fájlba — böngészőváltás előtt futtasd';
    btn.onclick = () => open('save');

    const anchor = document.getElementById('pjExport');
    if (anchor && anchor.parentElement) {
      btn.className = anchor.className;          // inherit the panel's button look
      anchor.parentElement.insertBefore(btn, anchor.nextSibling);
      return true;
    }
    return false;
  }

  function mountFallback() {
    ensureCss();
    if (document.getElementById('vbkOpen')) return;
    const btn = el('button', 'vbk-btn vbk-launch', '🗄 Teljes mentés…');
    btn.id = 'vbkOpen';
    btn.onclick = () => open('save');
    document.body.appendChild(btn);
  }

  function boot() {
    let tries = 0;
    (function attempt() {
      if (mount()) return;
      if (++tries > 40) { mountFallback(); return; }   // ~4 s, then float it
      setTimeout(attempt, 100);
    })();
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

  /* ---- public API (also used by tests) ---------------------------------- */

  const api = {
    open: open, close: close,
    exportAll: exportAll, exportEach: exportEach,
    build: build, parse: parse, apply: apply,
    projects: currentProjects, storeKeys: storeKeys, hash: hash,
    FORMAT: FORMAT, BUNDLE_VERSION: BUNDLE_VERSION, PROJECT_KEY: PROJECT_KEY
  };
  if (typeof window !== 'undefined') window.VBACKUP = api;
  return api;
})();
