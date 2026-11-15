// phone.js — the Telefon panel of the VRG Asztal (WP-49): one click finds the radios, starts every local server for the phone and shows a
// QR per server. Main does the work (lib/phonelink.js, vrg.desktop.phoneScan / phoneStart / phoneQr / phonePair / phoneClear); the page
// names a server id and an address the scan returned, never a URL. A QR is an <img> of the relay's SVG (data:, no markup injected).
//   window.VRGPhone = { open(), close(), isOpen(), button(cls) }    button() = the 📱 Telefon button the top strip and the Dashboard show
(function () {
  'use strict';
  const vrg = window.vrg;
  const call = (fn, p) => (vrg && vrg.call ? vrg.call('desktop', fn, p || {}) : Promise.resolve({ ok: false, hu: 'Nincs kapcsolat a héjjal.' }));
  const setting = (k, v) => (vrg && vrg.call ? vrg.call('app', 'setting', v === undefined ? { k } : { k, v }) : Promise.resolve({}));
  const toast = (ok, hu, en) => { if (window.VRGToasts) window.VRGToasts.toast({ ok, hu, en: en || hu }); };
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c && c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const KIND_HU = { wifi: 'Wi-Fi', hotspot: 'Mobil hotspot', eth: 'Vezetékes', bt: 'Bluetooth PAN' };

  const P = { el: null, scan: null, ports: {}, ip: '', shown: new Set(), qr: new Map(), busy: false, timer: 0, pop: null };
  const svgImg = (svg, cls) => h('img', { class: cls || 'qr', alt: 'QR', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) });

  // ------------------------------------------------------------ QR codes: fetched when shown, renewed before the ticket runs out
  async function qrFor(id) {
    const k = id + '@' + P.ip, c = P.qr.get(k);
    if (c && c.until > Date.now()) return c;
    const own = id === 'pair' ? 'phonePair' : id === 'app' ? 'phoneApp' : '';
    const r = await call(own || 'phoneQr', own ? (P.ip ? { ip: P.ip } : {}) : (P.ip ? { id, ip: P.ip } : { id }));
    if (!r || r.ok === false || !r.svg) return { ok: false, hu: (r && r.hu) || 'Nincs QR.' };
    const v = { ok: true, svg: r.svg, url: r.url, until: Date.now() + Math.max(10000, (r.ttl || 60000) - 20000), pair: !!r.pair, app: r.app ? r.apk || {} : null };
    P.qr.set(k, v);
    return v;
  }
  async function fillQr(box, id) {
    box.textContent = '';
    box.append(h('span', { class: 'note' }, 'QR készül…'));
    const q = await qrFor(id);
    box.textContent = '';
    if (!q.ok) { box.append(h('span', { class: 'note warn' }, q.hu)); return; }
    box.append(svgImg(q.svg), h('div', { class: 'qrmeta' },
      h('code', { 'data-role': 'qr-url' }, q.url.replace(/([?&])(vrg_s|c)=[0-9a-f]{32}/, '$1$2=…')),
      h('span', { class: 'note' }, q.pair ? 'Párosítás: VRG Mobile → QR, vagy a telefon kamerája. 2 percig, egyszer.'
        : q.app ? 'Telefonon, ahol még nincs VRG Mobile: a kamerával olvasd be → letöltő oldal → Telepítés → QR BEOLVASÁSA → a párosító QR. 10 percig.'
          + (q.app.bytes ? ' (' + (q.app.kind || 'apk') + ', ' + (q.app.bytes / 1048576).toFixed(1) + ' MB, ' + new Date(q.app.mtime).toLocaleDateString('hu-HU') + ')' : '')
          : 'Telefon kamerája vagy VRG Mobile → QR. 5 percig olvasható, utána kb. 12 óráig nyitva marad a telefonon.')));
  }
  function popQr(anchor, id) {
    hidePop();
    const box = h('div', { class: 'qrpop', 'data-role': 'qr-pop' });
    P.pop = box;
    P.el.append(box);
    const a = anchor.getBoundingClientRect(), b = P.el.getBoundingClientRect();
    box.style.left = Math.max(8, a.left - b.left - 4) + 'px';
    box.style.top = (a.bottom - b.top + P.el.scrollTop + 4) + 'px';
    fillQr(box, id);
  }
  function hidePop() { if (P.pop) { P.pop.remove(); P.pop = null; } }

  // ------------------------------------------------------------ the panel
  async function scan(fresh) {
    P.busy = true; draw();
    const r = await call('phoneScan', fresh ? { fresh: true } : {});
    P.busy = false;
    if (!r || r.ok === false) { P.scan = { error: (r && r.hu) || 'A keresés nem sikerült.' }; draw(); return null; }
    P.scan = r;
    if (!P.ip || !(r.addresses || []).some(a => a.address === P.ip)) P.ip = ((r.addresses || [])[0] || {}).address || '';
    draw();
    return r;
  }
  async function startAll() {
    P.busy = true; draw();
    const r = await call('phoneStart');
    P.busy = false;
    if (!r || r.ok === false && !(r.started || []).length) toast(false, (r && ((r.failed || [])[0] || {}).hu) || (r && r.hu) || 'Nem indult el.', 'Did not start.');
    else toast(true, (r.started.length ? r.started.length + ' szerver indul' : 'Minden fut már') + (r.failed && r.failed.length ? ', ' + r.failed.length + ' hiba' : '') + '.', 'Servers started.');
    if (r && r.failed && r.failed.length) for (const f of r.failed.slice(0, 2)) toast(false, f.id + ': ' + f.hu);
    P.qr.clear();
    await scan(false);
    setTimeout(() => { if (P.el) scan(false); }, 4500);                 // the relay and the servers answer a moment later
  }
  async function setAuto(on) {
    await setting('phone.auto', !!on);
    if (P.scan) P.scan.auto = !!on;
    if (on && P.scan && P.scan.wireless) startAll(); else draw();
  }
  async function clearShares() {
    const r = await call('phoneClear');
    toast(!!(r && r.ok), (r && r.hu) || 'Nem sikerült.', 'Shares revoked.');
    P.qr.clear(); draw();
  }

  function radioRows(s) {
    const dot = on => h('i', { class: 'dot' + (on ? ' ok' : '') });
    const rows = [];
    const w = s.wifi || [];
    if (!w.length) rows.push(h('div', { class: 'rad', 'data-radio': 'wifi' }, dot(false), h('b', {}, 'Wi-Fi'), h('span', { class: 'note' }, 'nincs Wi-Fi adapter')));
    for (const a of w) rows.push(h('div', { class: 'rad', 'data-radio': 'wifi' }, dot(a.up && a.ips.length), h('b', {}, 'Wi-Fi'), h('span', {}, a.name),
      h('span', { class: 'note' }, a.up ? (a.ssid ? '„' + a.ssid + '”' : 'csatlakozva') + (a.ips.length ? ' · ' + a.ips.join(', ') : ' · nincs cím') : 'nincs csatlakozva')));
    for (const a of s.hotspot || []) rows.push(h('div', { class: 'rad', 'data-radio': 'hotspot' }, dot(true), h('b', {}, 'Mobil hotspot'), h('span', {}, a.name), h('span', { class: 'note' }, a.ips.join(', '))));
    const bt = s.bt || {};
    rows.push(h('div', { class: 'rad', 'data-radio': 'bt' }, dot(bt.on), h('b', {}, 'Bluetooth'),
      h('span', {}, bt.radios && bt.radios.length ? bt.radios.map(r => r.name).join(', ') : bt.present ? 'PAN adapter' : 'nincs adapter'),
      h('span', { class: 'note' }, !bt.present ? '' : (bt.on ? 'bekapcsolva' : 'kikapcsolva') + ((bt.pan || []).some(p => p.ips.length) ? ' · PAN: ' + bt.pan.filter(p => p.ips.length).map(p => p.ips.join(', ')).join(', ') : ' · a QR Wi-Fi-n vagy hotspoton megy'))));
    for (const a of (s.eth || []).filter(e => e.up)) rows.push(h('div', { class: 'rad', 'data-radio': 'eth' }, dot(a.ips.length), h('b', {}, 'Vezetékes'), h('span', {}, a.name), h('span', { class: 'note' }, a.ips.join(', ') || 'nincs cím')));
    return rows;
  }

  function serverRows(s) {
    const list = s.servers || [];
    return list.map(sv => {
      const up = !!P.ports[sv.port] || sv.up;
      const shown = P.shown.has(sv.id);
      const ico = h('button', { type: 'button', class: 'qri', 'data-qr-hover': sv.id, title: 'QR (rámutatva) / QR on hover', disabled: !up,
        onmouseenter: e => up && !shown && popQr(e.currentTarget, sv.id), onmouseleave: hidePop, onfocus: e => up && !shown && popQr(e.currentTarget, sv.id), onblur: hidePop }, '▦');
      const row = h('div', { class: 'srv', 'data-phone-server': sv.id, 'data-up': up ? '1' : '0' },
        ico, h('i', { class: 'dot' + (up ? ' ok' : '') }), h('span', { class: 'c' }, ':' + sv.port), h('span', { class: 'n' }, sv.name + (sv.relay ? ' (relé)' : '')),
        h('span', { class: 'note' }, up ? 'fut' : 'áll'),
        h('button', { type: 'button', class: 'qrt', 'data-qr-toggle': sv.id, 'aria-pressed': String(shown), disabled: !up, title: 'QR mutatása / elrejtése',
          onclick: () => { hidePop(); if (shown) P.shown.delete(sv.id); else P.shown.add(sv.id); draw(); } }, shown ? 'QR ▴' : 'QR ▾'));
      if (!shown || !up) return row;
      const box = h('div', { class: 'qrbox', 'data-qr-box': sv.id });
      fillQr(box, sv.relay ? 'pair' : sv.id);
      return [row, box];
    }).flat();
  }

  function draw() {
    if (!P.el) return;
    const s = P.scan || {};
    const body = P.el.querySelector('.body');
    const keep = P.el.scrollTop;
    body.textContent = '';
    hidePop();
    if (!P.scan) { body.append(h('div', { class: 'note' }, 'Rádiók keresése…')); return; }
    if (s.error) { body.append(h('div', { class: 'note warn' }, s.error)); return; }
    body.append(h('div', { class: 'grp' }, 'Rádiók', h('span', { class: 'en' }, 'Radios')), ...radioRows(s));
    if (!s.wireless) body.append(h('div', { class: 'note warn', 'data-role': 'no-wireless' }, (s.addresses || []).length
      ? 'Nincs vezeték nélküli kapcsolat: a telefon a vezetékes címen éri el a PC-t, ha ugyanazon a routeren van.'
      : 'Nincs hálózati cím: kapcsold be a Wi-Fi-t vagy a Windows Mobil hotspotot (Beállítások → Hálózat → Mobil hotspot).'));
    const addrs = s.addresses || [];
    if (addrs.length) body.append(h('label', { class: 'addr' }, 'Cím a QR-ben',
      h('select', { 'data-role': 'phone-ip', onchange: e => { P.ip = e.target.value; P.qr.clear(); draw(); } },
        addrs.map(a => h('option', { value: a.address, selected: a.address === P.ip }, a.address + ' · ' + (KIND_HU[a.kind] || a.kind) + ' · ' + a.name + (a.ssid ? ' „' + a.ssid + '”' : ''))))));
    const rl = s.relay || {};
    body.append(h('div', { class: 'grp' }, 'Kapcsolat', h('span', { class: 'en' }, 'Link')),
      h('div', { class: 'rad', 'data-role': 'relay' }, h('i', { class: 'dot' + (rl.up && rl.ports ? ' ok' : rl.up ? ' warn' : '') }), h('b', {}, 'Relé'),
        h('span', {}, ':' + (rl.port || '—')), h('span', { class: 'note' }, rl.up ? (rl.ports ? 'fut · telefonos megnyitás be' : 'fut, de --ports nélkül') : 'áll'),
        h('span', { class: 'sp' }),
        h('button', { type: 'button', 'data-qr-toggle': 'pair', 'aria-pressed': String(P.shown.has('pair')), disabled: !rl.up, title: 'VRG Mobile párosítása (teljes hozzáférés a telefon funkcióihoz)',
          onclick: () => { if (P.shown.has('pair')) P.shown.delete('pair'); else P.shown.add('pair'); draw(); } }, 'Telefon párosítása')));
    if (rl.up && P.shown.has('pair')) { const box = h('div', { class: 'qrbox', 'data-qr-box': 'pair' }); fillQr(box, 'pair'); body.append(box); }
    // WP-49b: a phone without the app downloads it from the relay (the APK built on this PC)
    body.append(h('div', { class: 'rad', 'data-role': 'app-row' }, h('i', { class: 'dot' + (rl.up ? ' ok' : '') }), h('b', {}, 'VRG Mobile'),
      h('span', { class: 'note' }, 'ha a telefonon még nincs: letöltés QR-ral'), h('span', { class: 'sp' }),
      h('button', { type: 'button', 'data-qr-toggle': 'app', 'aria-pressed': String(P.shown.has('app')), disabled: !rl.up, title: 'Letöltő QR a VRG Mobile alkalmazáshoz',
        onclick: () => { if (P.shown.has('app')) P.shown.delete('app'); else P.shown.add('app'); draw(); } }, 'Alkalmazás letöltése')));
    if (rl.up && P.shown.has('app')) { const box = h('div', { class: 'qrbox', 'data-qr-box': 'app' }); fillQr(box, 'app'); body.append(box); }
    body.append(h('div', { class: 'ctl' },
      h('button', { type: 'button', class: 'go', 'data-role': 'phone-start', disabled: P.busy, onclick: startAll }, P.busy ? 'Dolgozik…' : '▶ Mind indítása'),
      h('label', { title: 'Ha be van kapcsolva, a panel megnyitásakor és az Asztal indulásakor magától elindul minden, ha van vezeték nélküli kapcsolat.' },
        h('input', { type: 'checkbox', 'data-role': 'phone-auto', checked: !!s.auto, onchange: e => setAuto(e.target.checked) }), 'Automatikusan, ha van vezeték nélküli kapcsolat'),
      h('span', { class: 'sp' }),
      h('button', { type: 'button', 'data-role': 'phone-clear', disabled: !rl.up, title: 'Minden kiadott QR és a telefonokon nyitva tartott megosztás visszavonása', onclick: clearShares }, 'Megosztások visszavonása')));
    const up = (s.servers || []).filter(x => P.ports[x.port] || x.up).length;
    body.append(h('div', { class: 'grp' }, 'Szerverek', h('span', { class: 'en' }, up + ' / ' + (s.servers || []).length + ' fut')), ...serverRows(s));
    P.el.scrollTop = keep;
  }

  function onKey(e) { if (e.key === 'Escape' && P.el) { e.stopPropagation(); close(); } }
  async function open() {
    if (P.el) { P.el.querySelector('[data-role="phone-start"]') && P.el.focus(); return; }
    const old = document.querySelector('[data-role="sheet"]'); if (old) old.remove();
    call('cover', { on: true });                                        // native web / app views sit above the page: hide them meanwhile
    P.el = h('div', { 'data-role': 'phone', role: 'dialog', tabindex: '-1', 'aria-label': 'Telefon kapcsolat' },
      h('h3', {}, phoneIcon(), 'Telefon kapcsolat', h('span', { class: 'en' }, 'Phone link'), h('span', { class: 'sp' }),
        h('button', { type: 'button', 'data-role': 'phone-rescan', title: 'Újrakeresés / Scan again', onclick: () => { P.qr.clear(); scan(true); } }, '↻'),
        h('button', { type: 'button', 'data-role': 'phone-close', title: 'Bezár / Close', onclick: close }, '×')),
      h('div', { class: 'body' }));
    P.el.addEventListener('keydown', onKey);
    document.body.append(P.el);
    P.el.focus();
    draw();
    const r = await scan(true);
    if (r && r.auto && r.wireless && P.el) startAll();
    clearInterval(P.timer);
    P.timer = setInterval(() => { if (!P.el) return; for (const [k, v] of P.qr) if (v.until <= Date.now()) { P.qr.delete(k); if (P.shown.size) draw(); } }, 5000);
  }
  function close() {
    if (!P.el) return;
    hidePop();
    P.el.remove(); P.el = null;
    clearInterval(P.timer);
    call('cover', { on: false });
  }
  if (vrg && vrg.onPorts) vrg.onPorts(p => { P.ports = p || {}; if (P.el && !P.busy && !P.pop) draw(); });
  if (vrg && vrg.ports) Promise.resolve(vrg.ports()).then(p => { P.ports = p || {}; }).catch(() => {});

  // the 📱 button: the top strip (fixed, not a widget to forget) and the Dashboard view's head
  // a drawn phone, not the 📱 emoji: the frame's mono fonts have no colour emoji and drew it as a bar
  function phoneIcon() {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 12 18'); s.setAttribute('class', 'phico'); s.setAttribute('aria-hidden', 'true');
    const r = document.createElementNS(ns, 'rect');
    for (const [k, v] of Object.entries({ x: 1, y: 1, width: 10, height: 16, rx: 2, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 })) r.setAttribute(k, v);
    const d = document.createElementNS(ns, 'circle');
    for (const [k, v] of Object.entries({ cx: 6, cy: 14, r: 1, fill: 'currentColor' })) d.setAttribute(k, v);
    s.append(r, d);
    return s;
  }
  function button(cls) {
    return h('button', { type: 'button', class: cls || '', 'data-role': 'phone-open', title: 'Telefon: rádiók, minden szerver indítása, QR a telefonhoz / Phone link', onclick: open }, phoneIcon(), 'Telefon');
  }

  window.VRGPhone = { open, close, isOpen: () => !!P.el, button, state: () => ({ open: !!P.el, ip: P.ip, scan: P.scan, shown: [...P.shown] }) };
})();
