// ==========================================================================
// 07d-linkpanel.js — the corner connection panel
//
// WHERE: src/07d-linkpanel.js — after 07c-share.js, before 08-interaction.js.
//
// ── WHAT IT REPLACES ────────────────────────────────────────────────────
// The old widget in 07b-phone-camera.js was a dot, a text box and a button:
// you had to read the IP off the relay console, retype it here, and get the
// ws:// prefix right. Three chances to fail silently. 07b keeps the camera
// logic and no longer builds any UI.
//
// ── WHAT A file:// PAGE CANNOT DO ───────────────────────────────────────
// It cannot start a process. There is no browser API that launches node, and
// there will not be one — it is the whole point of the sandbox. So the relay
// still has to be started once, outside the browser. Everything after that is
// handled here: finding it, connecting, showing the address, handing it to the
// phone by QR, and saying what is wrong when something is.
//
// When no relay answers, the panel shows the exact command and a copy button
// rather than a shrug. Put a shortcut to START.cmd in shell:startup and the
// question stops coming up at all.
//
// ── THE DIAGNOSTIC THAT MATTERS ─────────────────────────────────────────
// A dead phone button and a dead socket look identical from the drawing. The
// panel shows window.PLANNER_LINK.stats() live: messages in, messages out, and what
// arrived last, with age. If the counter moves when you touch the phone, the
// transport is fine and the bug is in a handler. If it does not, the phone
// never reached this tab. One glance, no console.
//
// Single top-level name: PLANNER_PANEL. Everything else is lp-prefixed.
// ==========================================================================

const PLANNER_PANEL = (function () {
  'use strict';

  const PORTS = [47291, 47292, 47293, 47294, 47295, 47296, 47297, 47298];
  const PROBE_TIMEOUT = 700;
  const LS_URL = 'varler_link_url';

  let open = false, built = false, timer = null;
  let found = null;          // {base, port, addresses[], interfaces[], primary, iface}
  let probing = false;

  /* ---- discovery -----------------------------------------------------------
     Same job as 05f's qrProbe, but this module must work in a build without
     the QR subsystem, so it asks that one first and falls back to its own. */

  function lpProbe(done) {
    if (typeof qrProbe === 'function' && typeof QRNET !== 'undefined') {
      qrProbe(function () {
        if (QRNET.state === 'up' || QRNET.state === 'manual') {
          found = {
            base: QRNET.base, port: QRNET.port,
            addresses: QRNET.lan || [], interfaces: QRNET.ifaces || [],
            primary: (QRNET.base || '').replace(/^https?:\/\//, '').split(':')[0],
            iface: QRNET.iface || null
          };
        } else found = null;
        done && done(found);
      });
      return;
    }
    lpOwnProbe(0, done);
  }

  function lpOwnProbe(i, done) {
    if (i >= PORTS.length) { found = null; done && done(null); return; }
    const p = PORTS[i];
    const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    const to = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) { } }, PROBE_TIMEOUT);
    fetch('http://127.0.0.1:' + p + '/whoami', ctl ? { signal: ctl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(to);
        if (!j || !/^varler[-a-z]*relay$/.test(String(j.app || ''))) return lpOwnProbe(i + 1, done);
        found = {
          base: 'http://' + (j.primary || (j.addresses || [])[0] || '127.0.0.1') + ':' + (j.port || p),
          port: j.port || p,
          addresses: j.addresses || j.lan || [],
          interfaces: j.interfaces || [],
          primary: j.primary || null, iface: j.primaryIface || null
        };
        done && done(found);
      })
      .catch(function () { clearTimeout(to); lpOwnProbe(i + 1, done); });
  }

  function lpWsUrl(base) {
    if (!base) return null;
    return base.replace(/^http/, 'ws').replace(/\/+$/, '');
  }

  /* ---- connect -------------------------------------------------------------
     The address is derived, never typed. A saved URL only survives if it still
     answers — a stale entry from a previous network is worse than none, because
     it fails in a way that looks like the phone's fault. */

  function lpConnect(url) {
    if (!window.PLANNER_LINK) { lpMsg('07a-link.js nincs a buildben.', true); return false; }
    url = url || lpWsUrl(found && found.base) || localStorage.getItem(LS_URL);
    if (!url) { lpMsg('Nem találom a relét.', true); return false; }
    try { localStorage.setItem(LS_URL, url); } catch (e) { }
    window.PLANNER_LINK.connect(url);
    lpPaint();
    return true;
  }

  function lpDisconnect() {
    if (window.PLANNER_LINK) window.PLANNER_LINK.disconnect();
    try { localStorage.removeItem(LS_URL); } catch (e) { }
    lpPaint();
  }

  // Find, then connect, in one go. This is what the panel does on open and
  // what the ⌘K action does.
  function lpAuto() {
    if (probing) return;
    probing = true; lpPaint();
    lpProbe(function (f) {
      probing = false;
      if (f) lpConnect(lpWsUrl(f.base));
      else { lpMsg('Nem fut a relé.', true); lpPaint(); }
    });
  }

  /* ---- state for the UI ----------------------------------------------------- */

  let msg = '', msgWarn = false;
  function lpMsg(m, warn) { msg = m || ''; msgWarn = !!warn; lpPaint(); }

  function lpState() {
    const S = window.PLANNER_LINK ? window.PLANNER_LINK.status() : { connected: false, peer: null };
    if (probing) return 'probing';
    if (!found && !S.connected) return 'norelay';
    if (S.connected && S.peer) return 'paired';
    if (S.connected) return 'waiting';
    return 'idle';
  }

  const TITLES = {
    probing: 'Relé keresése…',
    norelay: 'Nem fut a relé',
    idle: 'Relé megvan — nincs kapcsolat',
    waiting: 'Csatlakozva — várom a telefont',
    paired: 'Telefon csatlakozva'
  };

  /* ---- dom ------------------------------------------------------------------ */

  function lpEnsure() {
    if (built) return;
    const st = document.createElement('style');
    st.textContent = `
    #lpDock{position:fixed;right:12px;bottom:12px;z-index:9998;
      font:12px ui-monospace,"SF Mono","Cascadia Code",monospace;color:#f2e9dc}
    #lpTab{display:flex;align-items:center;gap:7px;background:#1f1a14;border:1px solid #3a2f22;
      border-radius:8px;padding:7px 10px;cursor:pointer;box-shadow:0 3px 10px #0004}
    #lpDot{width:9px;height:9px;border-radius:50%;background:#8a6a3a;flex:none;transition:background .25s}
    #lpDot.up{background:#6fae63}#lpDot.mid{background:#e8a33d}#lpDot.bad{background:#c9553f}
    #lpBody{display:none;margin-bottom:6px;width:274px;background:#1f1a14;border:1px solid #3a2f22;
      border-radius:8px;box-shadow:0 6px 18px #0005;overflow:hidden}
    #lpDock.on #lpBody{display:block}
    #lpBody h6{margin:0;padding:8px 10px;background:#241d15;border-bottom:1px solid #3a2f22;
      font-size:12px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
    .lpB{padding:9px 10px}
    .lpRow{display:flex;align-items:center;gap:6px;margin-bottom:5px}
    .lpRow code{background:#14110d;border:1px solid #2e261c;border-radius:4px;padding:3px 5px;
      flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#e8c98d}
    .lpMuted{color:#8a7f6c;font-size:11px;line-height:1.45}
    .lpBtn{background:#2a2219;color:#f2e9dc;border:1px solid #3a2f22;border-radius:5px;
      padding:4px 8px;cursor:pointer;font:11px ui-monospace,monospace}
    .lpBtn:hover{border-color:#e8a33d}
    .lpBtn.pri{background:#e8a33d;color:#14110d;border-color:#c8862b;font-weight:700}
    .lpBtns{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
    .lpMsg{margin-top:7px;font-size:11px;color:#8a7f6c}
    .lpMsg.warn{color:#e8a33d}
    .lpStat{margin-top:8px;padding-top:7px;border-top:1px dashed #3a2f22;
      font-size:10.5px;color:#7d735f;display:flex;justify-content:space-between;gap:6px}
    .lpStat b{color:#a89a7c;font-weight:600}
    #lpQr{position:fixed;inset:0;z-index:9999;background:#0009;display:none;
      align-items:center;justify-content:center}
    #lpQr.on{display:flex}
    #lpQrBox{background:#fbf9f4;border-radius:10px;padding:16px;text-align:center;max-width:86vw}
    #lpQrBox svg{width:min(58vw,300px);height:auto;display:block;margin:0 auto 10px}
    #lpQrBox .u{font:12px ui-monospace,monospace;color:#3a2f22;word-break:break-all;margin-bottom:10px}`;
    document.head.appendChild(st);

    const d = document.createElement('div');
    d.id = 'lpDock';
    d.innerHTML =
      `<div id="lpBody"><h6><span id="lpTitle">…</span>
         <button class="lpBtn" id="lpClose" style="padding:1px 6px">✕</button></h6>
       <div class="lpB" id="lpContent"></div></div>
       <div id="lpTab"><span id="lpDot"></span><span id="lpLabel">Telefon</span></div>`;
    document.body.appendChild(d);

    const q = document.createElement('div');
    q.id = 'lpQr';
    q.innerHTML = `<div id="lpQrBox"><div id="lpQrSvg"></div><div class="u" id="lpQrUrl"></div>
      <button class="lpBtn pri" id="lpQrClose">Bezár</button></div>`;
    document.body.appendChild(q);
    q.addEventListener('click', function (e) { if (e.target === q) lpQrHide(); });
    document.getElementById('lpQrClose').onclick = lpQrHide;

    document.getElementById('lpTab').onclick = function () { lpToggle(); };
    document.getElementById('lpClose').onclick = function (e) { e.stopPropagation(); lpToggle(false); };

    built = true;
    if (window.PLANNER_LINK) window.PLANNER_LINK.onStatus(function () { lpPaint(); });
    timer = setInterval(function () { if (open) lpPaintStats(); }, 700);
  }

  function lpToggle(on) {
    lpEnsure();
    open = (on == null) ? !open : !!on;
    document.getElementById('lpDock').classList.toggle('on', open);
    if (open && !found && !probing) lpAuto();
    lpPaint();
  }

  /* ---- painting -------------------------------------------------------------- */

  function lpPaint() {
    if (!built) return;
    const S = window.PLANNER_LINK ? window.PLANNER_LINK.status() : { connected: false, peer: null };
    const st = lpState();

    const dot = document.getElementById('lpDot');
    dot.className = st === 'paired' ? 'up' : st === 'waiting' || st === 'probing' ? 'mid'
      : st === 'norelay' ? 'bad' : '';
    document.getElementById('lpLabel').textContent =
      st === 'paired' ? 'Telefon ✓' : st === 'waiting' ? 'Várakozás' :
      st === 'probing' ? 'Keresés…' : st === 'norelay' ? 'Nincs relé' : 'Telefon';
    document.getElementById('lpTitle').textContent = TITLES[st];

    if (!open) return;
    const c = document.getElementById('lpContent');

    if (st === 'norelay') {
      c.innerHTML =
        `<div class="lpMuted">A böngésző nem tud programot indítani, ezért a relét egyszer
         kézzel kell elindítani. Utána ez a panel mindent elintéz.</div>
         <div class="lpRow" style="margin-top:7px"><code>node tools\\phone-relay-server.js</code>
         <button class="lpBtn" id="lpCopy">másol</button></div>
         <div class="lpMuted">Vagy: <b>START.cmd → 4</b>. Ha indítópultba teszed
         (<code>shell:startup</code>), többé nem kell rá gondolni.</div>
         <div class="lpBtns"><button class="lpBtn pri" id="lpRetry">Keresés újra</button></div>`;
      const cp = document.getElementById('lpCopy');
      if (cp) cp.onclick = function () {
        try { navigator.clipboard.writeText('node tools\\phone-relay-server.js'); lpMsg('Vágólapra másolva.'); }
        catch (e) { lpMsg('Másolás nem sikerült — gépeld be.', true); }
      };
      document.getElementById('lpRetry').onclick = lpAuto;
      lpTail(c);
      return;
    }

    const httpUrl = found ? found.base + '/' : null;
    const alts = found ? (found.addresses || []).filter(a => httpUrl.indexOf(a) < 0) : [];

    c.innerHTML =
      (httpUrl
        ? `<div class="lpMuted">Nyisd meg ezt a telefonon:</div>
           <div class="lpRow"><code id="lpUrl">${lpEsc(httpUrl)}</code>
             <button class="lpBtn" id="lpCopyUrl">másol</button></div>`
        : '')
      + (found && found.iface ? `<div class="lpMuted">interfész: <b>${lpEsc(found.iface)}</b></div>` : '')
      + (alts.length
        ? `<div class="lpMuted" style="margin-top:5px">Másik cím: `
          + alts.map(a => `<button class="lpBtn lpAlt" data-a="${lpEsc(a)}">${lpEsc(a)}</button>`).join(' ')
          + `</div>` : '')
      + `<div class="lpBtns">
           <button class="lpBtn pri" id="lpQrBtn">QR a telefonhoz</button>
           ${S.connected ? `<button class="lpBtn" id="lpDisc">Bontás</button>`
                         : `<button class="lpBtn" id="lpConn">Csatlakozás</button>`}
           <button class="lpBtn" id="lpRetry2">Újrakeresés</button>
         </div>`
      + (S.peer ? `<div class="lpMuted" style="margin-top:6px">Telefon: <b>${lpEsc(S.peer.app || '?')}</b>
          · ${(S.peer.caps || []).length} képesség</div>` : '');

    const cu = document.getElementById('lpCopyUrl');
    if (cu) cu.onclick = function () {
      try { navigator.clipboard.writeText(httpUrl); lpMsg('Cím a vágólapon.'); }
      catch (e) { lpMsg('Másolás nem sikerült.', true); }
    };
    Array.prototype.forEach.call(c.querySelectorAll('.lpAlt'), function (b) {
      b.onclick = function () {
        found.base = 'http://' + b.getAttribute('data-a') + ':' + found.port;
        const hit = (found.interfaces || []).find(i => i.address === b.getAttribute('data-a'));
        found.iface = hit ? hit.name : null;
        if (typeof qrUseAddress === 'function') qrUseAddress(b.getAttribute('data-a'));
        lpConnect(lpWsUrl(found.base));
      };
    });
    const qb = document.getElementById('lpQrBtn'); if (qb) qb.onclick = function () { lpQrShow(httpUrl); };
    const cn = document.getElementById('lpConn'); if (cn) cn.onclick = function () { lpConnect(); };
    const dc = document.getElementById('lpDisc'); if (dc) dc.onclick = lpDisconnect;
    const r2 = document.getElementById('lpRetry2'); if (r2) r2.onclick = lpAuto;
    lpTail(c);
  }

  function lpTail(c) {
    c.insertAdjacentHTML('beforeend',
      `<div class="lpMsg${msgWarn ? ' warn' : ''}" id="lpMsg">${lpEsc(msg)}</div>
       <div class="lpStat" id="lpStat"></div>`);
    lpPaintStats();
  }

  // The counters. This is the part that answers "is the phone reaching me".
  function lpPaintStats() {
    const el = document.getElementById('lpStat');
    if (!el || !window.PLANNER_LINK || !window.PLANNER_LINK.stats) return;
    const s = window.PLANNER_LINK.stats();
    const age = s.lastInAt ? ((Date.now() - s.lastInAt) / 1000).toFixed(1) + 's' : '—';
    el.innerHTML = `<span>be <b>${s.in}</b> · ki <b>${s.out}</b>${s.bad ? ' · hibás <b>' + s.bad + '</b>' : ''}</span>`
      + `<span>utolsó: <b>${lpEsc(s.lastIn || '—')}</b> ${age}</span>`;
  }

  function lpEsc(x) {
    return String(x == null ? '' : x)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- the QR hand-off ------------------------------------------------------
     Encodes the HTTP address, not the WebSocket one: the phone needs to LOAD a
     page, and a ws:// code would scan to something no phone browser can open. */

  function lpQrShow(url) {
    if (!url) { lpMsg('Nincs cím, amit kódolhatnék.', true); return; }
    const box = document.getElementById('lpQrSvg');
    if (typeof qrSvg === 'function') {
      const svg = qrSvg(url, { ecc: 'M', quiet: 2 });
      box.innerHTML = svg || '<div style="color:#a33">A kód nem generálható.</div>';
    } else {
      box.innerHTML = '<div style="color:#7a6a4a;font:12px system-ui">A QR modul (05f-qr.js) nincs a buildben — '
        + 'gépeld be a címet a telefonon.</div>';
    }
    document.getElementById('lpQrUrl').textContent = url;
    document.getElementById('lpQr').classList.add('on');
  }
  function lpQrHide() { const q = document.getElementById('lpQr'); if (q) q.classList.remove('on'); }

  /* ---- actions --------------------------------------------------------------- */

  if (typeof registerActions === 'function') registerActions([
    { id: 'link.panel', label: 'Telefon kapcsolat panel', icon: '📶', group: 'Telefon',
      alias: 'phone link relay connect kapcsolat telefon rele',
      hint: 'Relé keresése, csatlakozás, QR a telefonhoz, forgalom számláló.',
      run: () => lpToggle() },
    { id: 'link.auto', label: 'Relé keresése és csatlakozás', icon: '🔌', group: 'Telefon',
      alias: 'relay probe connect auto', run: () => { lpToggle(true); lpAuto(); } },
    { id: 'link.qr', label: 'QR a telefonhoz', icon: '▦', group: 'Telefon',
      alias: 'qr phone url', run: () => { lpToggle(true); lpQrShow(found ? found.base + '/' : null); } }
  ]);

  function lpInit() {
    lpEnsure();
    // Quiet auto-attempt on boot: if the relay is already up, the tab is
    // connected before the user thinks about it. Silent when it isn't.
    setTimeout(function () {
      lpProbe(function (f) { if (f) lpConnect(lpWsUrl(f.base)); lpPaint(); });
    }, 600);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lpInit);
    else lpInit();
  }

  const api = {
    toggle: lpToggle, auto: lpAuto, probe: lpProbe, connect: lpConnect,
    disconnect: lpDisconnect, qr: lpQrShow, state: lpState, wsUrl: lpWsUrl,
    found: function () { return found; }
  };
  if (typeof window !== 'undefined') window.PLANNER_PANEL = api;
  return api;
})();
