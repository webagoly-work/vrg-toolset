/* VRG UI Kit — components/filemanager.js — dual-pane file manager (Total Commander style).

     var fm = VK.filemanager.mount(el, {
       provider: (path) => entries | Promise<entries>,   // entries: [{name, dir: bool, size: bytes, date: 'YYYY-MM-DD HH:MM'}]
       left: '/', right: '/Inventory',                    // start paths ('/' = root)
       rootLabel: 'vrg-toolset', surface: 'fkeys',        // registry surface the F-key bar renders
       onOpen(entry, path, fm) })                         // Enter on a file (default: runs the F3 action)
     → { cd(path, side?), up(side?), refresh(side?), getActive(), getOther(), getTargets(), mark(names, on, side?),
         setStatus(text, kind?), refreshKeys(), switchPane(), focus(), destroy() }

   The F-key bar is NOT a hard-coded list: it renders VK.actions.forSurface(surface) in key order, each action as
   a key cap + label whose icon is a MINI (action.progress / action.state drive the meter, e.g. F5 copy).
   Actions receive ctx = { fm, pane, other, targets, cursor } where pane/other = { side, path, entries }.
   Register them with keys ['f3'] … ['f8'] and at: ['fkeys'] (see the gallery fragment for the full set).

   Keyboard (in a list): ↑/↓ PageUp/PageDown Home/End move the cursor · Enter opens a folder (or the file) ·
   Backspace = parent folder · Insert = mark and step down · Space = mark · Ctrl+A = mark all · Esc = clear marks ·
   Tab = other pane (Shift+Tab leaves the component) · F3…F8 = registry actions · letters = jump by name.
   Shift+Arrow is left to region hopping (each pane and the F-key bar is a [data-vk-hop] region).
   Depends on: core.js, focus.js, actions.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.filemanager) return;

  var coll = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator('hu', { numeric: true, sensitivity: 'base' }) : null;
  function cmp(a, b) { return coll ? coll.compare(a, b) : a < b ? -1 : a > b ? 1 : 0; }
  function size(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    var u = ['kB', 'MB', 'GB'], i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toLocaleString('hu-HU', { maximumFractionDigits: n < 10 ? 1 : 0 }) + ' ' + u[i];
  }
  function split(name, dir) {
    if (dir) return [name, ''];
    var i = name.lastIndexOf('.');
    return i > 0 ? [name.slice(0, i), name.slice(i + 1)] : [name, ''];
  }
  function norm(p) { p = '/' + String(p || '').split('/').filter(Boolean).join('/'); return p; }
  function parent(p) { var a = norm(p).split('/').filter(Boolean); a.pop(); return '/' + a.join('/'); }
  function kindIcon(e) {
    if (e.up) return 'arrow-up';
    if (e.dir) return 'folder';
    var x = split(e.name)[1].toLowerCase();
    if (/^(js|ts|ps1|cmd|bat|py|ino|h|c|cpp|kt|css|html)$/.test(x)) return 'file-code';
    if (/^(json|csv|tsv|db|sqlite)$/.test(x)) return 'database';
    return 'file';
  }

  function mount(el, o) {
    o = o || {};
    var surface = o.surface || 'fkeys', off = [], activeSide = 0;
    el.classList.add('vk-fm');
    el.textContent = '';

    var panesEl = VK.el('div.vk-fm__panes');
    var status = VK.el('div.vk-fm__status', { role: 'status', 'aria-live': 'polite' });
    var keysBar = VK.el('div.vk-fm__fkeys', { role: 'toolbar', 'aria-label': 'Funkcióbillentyűk', 'data-vk-hop': '' });
    el.appendChild(panesEl); el.appendChild(status); el.appendChild(keysBar);

    var panes = [0, 1].map(function (i) {
      var side = i ? 'right' : 'left', name = i ? 'Jobb panel' : 'Bal panel';
      var sec = VK.el('section.vk-fm__pane', { 'data-vk-hop': '', 'data-side': side, 'aria-label': name });
      var crumbs = VK.el('nav.vk-fm__crumbs', { 'aria-label': name + ' útvonal' });
      var busy = VK.mini.create({ icon: 'folder-open', label: 'Mappa olvasása', size: 'sm' });
      busy.tabIndex = -1; busy.setAttribute('aria-hidden', 'true'); busy.dataset.meter = 'square';
      var head = VK.el('div.vk-fm__head', null, [VK.el('span.vk-fm__side', { 'aria-hidden': 'true', text: i ? '[B]' : '[A]' }), crumbs, busy]);
      var cols = VK.el('div.vk-fm__cols', { 'aria-hidden': 'true' }, [VK.el('span', { text: 'Név' }), VK.el('span.vk-fm__c-ext', { text: 'Kit.' }), VK.el('span.vk-fm__c-size', { text: 'Méret' }), VK.el('span.vk-fm__c-date', { text: 'Dátum' })]);
      var list = VK.el('div.vk-fm__list', { role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': name + ' — fájlok' });
      var sum = VK.el('div.vk-fm__sum');
      sec.appendChild(head); sec.appendChild(cols); sec.appendChild(list); sec.appendChild(sum);
      panesEl.appendChild(sec);
      return { i: i, side: side, name: name, sec: sec, crumbs: crumbs, busy: busy, list: list, sum: sum,
        path: norm(i ? o.right || '/' : o.left || '/'), entries: [], rows: [], cursor: 0, marks: new Set(), seq: 0 };
    });

    // ---------- loading and rendering ----------
    function load(p, path, focusName) {
      var seq = ++p.seq;
      p.path = norm(path);
      VK.mini.set(p.busy, { state: 'running', progress: null });
      p.sec.setAttribute('aria-busy', 'true');
      var r; try { r = Promise.resolve(o.provider(p.path)); } catch (e) { r = Promise.reject(e); }
      return r.then(function (list) {
        if (seq !== p.seq) return;
        var ents = (list || []).map(function (e) { return { name: e.name, dir: !!e.dir, size: e.size, date: e.date || '', data: e }; });
        ents.sort(function (a, b) { return a.dir !== b.dir ? (a.dir ? -1 : 1) : cmp(a.name, b.name); });
        if (p.path !== '/') ents.unshift({ name: '..', up: true, dir: true });
        p.entries = ents; p.error = null;
        p.marks.forEach(function (n) { if (!ents.some(function (e) { return e.name === n; })) p.marks.delete(n); });
        var fi = focusName ? ents.findIndex(function (e) { return e.name === focusName; }) : -1;
        p.cursor = fi >= 0 ? fi : Math.min(p.cursor, Math.max(0, ents.length - 1));
        VK.mini.set(p.busy, { state: 'idle', progress: 0 });
        p.sec.setAttribute('aria-busy', 'false');
        render(p);
      }, function (err) {
        if (seq !== p.seq) return;
        p.entries = p.path !== '/' ? [{ name: '..', up: true, dir: true }] : []; p.cursor = 0;
        p.error = (err && err.message) || 'Nem olvasható';
        VK.mini.set(p.busy, { state: 'error', progress: 1 });
        p.sec.setAttribute('aria-busy', 'false');
        render(p);
      });
    }

    function crumbsOf(p) {
      p.crumbs.textContent = '';
      var parts = p.path.split('/').filter(Boolean), acc = '';
      var mk = function (label, path, last) {
        var b = VK.el('button.vk-fm__crumb', { type: 'button', tabindex: -1, text: label, 'aria-current': last ? 'location' : null });
        b.addEventListener('click', function () { activate(p.i); load(p, path).then(function () { focusCursor(p); }); });
        return b;
      };
      p.crumbs.appendChild(mk(o.rootLabel || '/', '/', !parts.length));
      parts.forEach(function (s, k) { acc += '/' + s; p.crumbs.appendChild(VK.el('span.vk-fm__sep', { 'aria-hidden': 'true', text: '/' })); p.crumbs.appendChild(mk(s, acc, k === parts.length - 1)); });
      p.crumbs.scrollLeft = p.crumbs.scrollWidth;
      p.sec.setAttribute('aria-label', p.name + ': ' + (o.rootLabel || '') + p.path);
    }

    function render(p) {
      crumbsOf(p);
      var hadFocus = p.list.contains(document.activeElement);
      p.list.textContent = '';
      p.rows = p.entries.map(function (e, k) {
        var nm = split(e.name, e.dir);
        var row = VK.el('div.vk-fm__row', { role: 'option', tabindex: -1, 'data-i': k, 'aria-selected': p.marks.has(e.name) ? 'true' : 'false',
          'aria-label': e.up ? 'Szülőmappa (..)' : (e.dir ? 'Mappa: ' : '') + e.name + (e.dir ? '' : ', ' + size(e.size)) + (e.date ? ', ' + e.date : '') });
        if (e.dir) row.setAttribute('data-dir', '');
        if (e.up) row.setAttribute('data-up', '');
        row.appendChild(VK.el('span.vk-fm__name', null, [VK.icon(kindIcon(e)), VK.el('span.vk-ellipsis', { text: e.up ? '..' : e.dir ? '[' + nm[0] + ']' : nm[0] })]));
        row.appendChild(VK.el('span.vk-fm__c-ext', { text: nm[1] }));
        row.appendChild(VK.el('span.vk-fm__c-size', { text: e.up ? '' : e.dir ? 'MAPPA' : size(e.size) }));
        row.appendChild(VK.el('span.vk-fm__c-date', { text: e.date || '' }));
        p.list.appendChild(row);
        return row;
      });
      if (p.error) p.list.appendChild(VK.el('div.vk-fm__msg', { 'data-kind': 'error' }, [VK.icon('error'), p.error]));
      else if (!p.entries.filter(function (e) { return !e.up; }).length) p.list.appendChild(VK.el('div.vk-fm__msg', null, [VK.icon('folder'), 'Üres mappa']));
      paintCursor(p, hadFocus);
      summary(p);
      refreshKeys();
    }

    function paintCursor(p, doFocus) {
      p.rows.forEach(function (r, k) { var on = k === p.cursor; r.tabIndex = on && p.i === activeSide ? 0 : -1; r.toggleAttribute('data-cursor', on); });
      if (p.i !== activeSide && p.rows[p.cursor]) p.rows[p.cursor].tabIndex = 0;
      var r = p.rows[p.cursor]; if (!r) return;
      if (doFocus) r.focus({ preventScroll: true });
      var l = p.list, top = r.offsetTop - l.offsetTop;
      if (top < l.scrollTop) l.scrollTop = top; else if (top + r.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = top + r.offsetHeight - l.clientHeight;
    }
    function focusCursor(p) { activate(p.i); paintCursor(p, true); }

    function summary(p) {
      var files = p.entries.filter(function (e) { return !e.dir; }), dirs = p.entries.filter(function (e) { return e.dir && !e.up; });
      var mk = p.entries.filter(function (e) { return p.marks.has(e.name); });
      var tot = files.reduce(function (s, e) { return s + (e.size || 0); }, 0), ms = mk.reduce(function (s, e) { return s + (e.size || 0); }, 0);
      p.sum.textContent = '';
      p.sum.appendChild(VK.el('span', { 'data-on': mk.length ? '' : null }, [VK.el('b', { text: String(mk.length) }), ' / ' + (files.length + dirs.length) + ' jelölve']));
      p.sum.appendChild(VK.el('span', { text: size(ms) + ' / ' + size(tot) }));
      p.sum.appendChild(VK.el('span', { text: dirs.length + ' mappa · ' + files.length + ' fájl' }));
    }

    // ---------- pane focus ----------
    function activate(i) {
      if (activeSide === i && panes[i].sec.hasAttribute('data-active')) return;
      activeSide = i;
      panes.forEach(function (p) { p.sec.toggleAttribute('data-active', p.i === i); paintCursor(p, false); });
      refreshKeys();
    }
    function moveCursor(p, k) {
      if (!p.entries.length) return;
      p.cursor = Math.max(0, Math.min(p.entries.length - 1, k));
      paintCursor(p, true); refreshKeys();
    }
    function toggleMark(p, k, v) {
      var e = p.entries[k]; if (!e || e.up) return;
      var on = v === undefined ? !p.marks.has(e.name) : v;
      if (on) p.marks.add(e.name); else p.marks.delete(e.name);
      p.rows[k].setAttribute('aria-selected', on ? 'true' : 'false');
      summary(p); refreshKeys();
    }
    function open(p, k) {
      var e = p.entries[k]; if (!e) return;
      if (e.up) return goUp(p);
      if (e.dir) return load(p, (p.path === '/' ? '' : p.path) + '/' + e.name).then(function () { p.cursor = 0; paintCursor(p, true); refreshKeys(); });
      if (o.onOpen) o.onOpen(e.data, p.path, api);
      else { var a = keyAction('f3'); if (a) VK.actions.run(a, ctx()); }
    }
    function goUp(p) {
      if (p.path === '/') return;
      var from = p.path.split('/').filter(Boolean).pop();
      return load(p, parent(p.path), from).then(function () { paintCursor(p, true); });
    }

    // ---------- registry: the F-key bar ----------
    function info(p) { return { side: p.side, path: p.path, entries: p.entries.filter(function (e) { return !e.up; }).map(function (e) { return e.data; }) }; }
    function targets(p) {
      p = p || panes[activeSide];
      var mk = p.entries.filter(function (e) { return p.marks.has(e.name); });
      if (!mk.length && p.entries[p.cursor] && !p.entries[p.cursor].up) mk = [p.entries[p.cursor]];
      return mk.map(function (e) { return e.data; });
    }
    function ctx() {
      var p = panes[activeSide], c = p.entries[p.cursor];
      return VK.actions.ctx({ fm: api, pane: info(p), other: info(panes[1 - activeSide]), targets: targets(p), cursor: c && !c.up ? c.data : null });
    }
    function fkeyActions() {
      var list = VK.actions ? VK.actions.forSurface(surface, ctx(), { all: true }) : [];
      return list.slice().sort(function (a, b) {
        var ka = +((a.keys[0] || '').replace(/\D/g, '') || 99), kb = +((b.keys[0] || '').replace(/\D/g, '') || 99); return ka - kb; });
    }
    function keyAction(k) { return fkeyActions().find(function (a) { return a.keys.indexOf(k) >= 0; }) || null; }
    var keyBtns = [], roving = null;
    function buildKeys() {
      keysBar.textContent = ''; keyBtns = [];
      fkeyActions().forEach(function (a) {
        var meter = VK.el('span.vk-mini', { 'data-size': 'sm', 'aria-hidden': 'true' }, [VK.icon(a.icon || 'dot')]);
        meter.dataset.label = a.label;
        var key = a.keys[0] ? VK.actions.keyLabel(a.keys[0]) : '';
        var b = VK.el('button.vk-fm__fkey', { type: 'button', tabindex: -1, 'data-action': a.id, title: (a.hint || a.label) + (key ? ' (' + key + ')' : '') },
          [meter, VK.el('kbd.vk-fm__kcap', { text: key }), VK.el('span.vk-fm__klabel', { text: a.label })]);
        b.addEventListener('click', function () { VK.actions.run(a, ctx(), 'fkeys'); refreshKeys(); });
        b._a = a; b._m = meter; b._k = key;
        keysBar.appendChild(b); keyBtns.push(b);
      });
      if (keyBtns[0]) keyBtns[0].tabIndex = 0;
      if (roving) roving.destroy();
      roving = VK.focus.roving(keysBar, { items: '.vk-fm__fkey', orientation: 'horizontal', typeahead: false });
      refreshKeys();
    }
    function refreshKeys() {
      if (!keyBtns.length) return;
      var c = ctx();
      keyBtns.forEach(function (b) {
        var a = b._a, en = VK.actions.enabled(a, c), st = {};
        b.setAttribute('aria-disabled', en ? 'false' : 'true');
        if (a.progress) { try { st.progress = a.progress(c); } catch (e) { /* keep */ } }
        if (a.state) { try { st.state = a.state(c); } catch (e) { /* keep */ } }
        VK.mini.set(b._m, st);
        b.setAttribute('aria-label', b._k + ' ' + (b._m.getAttribute('aria-label') || a.label));
      });
    }
    function setStatus(text, kind) {
      status.textContent = '';
      if (kind) status.setAttribute('data-kind', kind); else status.removeAttribute('data-kind');
      if (text) status.appendChild(VK.el('span', { text: text }));
    }

    // ---------- events ----------
    function on(t, type, fn) { t.addEventListener(type, fn); off.push(function () { t.removeEventListener(type, fn); }); }
    var buf = '', bufT = 0;
    panes.forEach(function (p) {
      on(p.list, 'keydown', function (e) {
        if (e.defaultPrevented || e.altKey) return;
        if (e.shiftKey && /^Arrow/.test(e.key)) return;
        var mod = e.ctrlKey || e.metaKey, h = true, k = e.key;
        var page = Math.max(1, Math.floor(p.list.clientHeight / ((p.rows[0] && p.rows[0].offsetHeight) || 24)) - 1);
        if (/^F\d+$/.test(k)) {
          var a = keyAction(k.toLowerCase());
          if (a) { e.preventDefault(); e.stopPropagation(); VK.actions.run(a, ctx(), 'key'); refreshKeys(); }
          return;
        }
        switch (k) {
          case 'ArrowDown': moveCursor(p, p.cursor + 1); break;
          case 'ArrowUp': moveCursor(p, p.cursor - 1); break;
          case 'PageDown': moveCursor(p, p.cursor + page); break;
          case 'PageUp': moveCursor(p, p.cursor - page); break;
          case 'Home': moveCursor(p, 0); break;
          case 'End': moveCursor(p, p.entries.length - 1); break;
          case 'Enter': open(p, p.cursor); break;
          case 'Backspace': goUp(p); break;
          case 'Insert': toggleMark(p, p.cursor); moveCursor(p, p.cursor + 1); break;
          case ' ': case 'Spacebar': toggleMark(p, p.cursor); break;
          case 'Tab': if (e.shiftKey) { h = false; break; } switchPane(); break;
          case 'Escape': if (p.marks.size) { p.marks.clear(); render(p); paintCursor(p, true); } else h = false; break;
          default:
            h = false;
            if (mod && (k === 'a' || k === 'A')) { p.entries.forEach(function (x, i) { if (!x.up) toggleMark(p, i, true); }); h = true; }
            else if (!mod && k.length === 1 && /\S/.test(k)) {
              var now = Date.now(); buf = (now - bufT > 700 ? '' : buf) + VK.fold(k); bufT = now;
              for (var j = 1; j <= p.entries.length; j++) {
                var q = (p.cursor + (buf.length > 1 ? j - 1 : j)) % p.entries.length;
                if (VK.fold(p.entries[q].name).indexOf(buf) === 0) { moveCursor(p, q); h = true; break; }
              }
            }
        }
        if (h) { e.preventDefault(); e.stopPropagation(); }
      });
      on(p.list, 'mousedown', function (e) { if (e.shiftKey) e.preventDefault(); });
      on(p.list, 'click', function (e) {
        var r = e.target.closest('.vk-fm__row'); activate(p.i);
        if (!r) { paintCursor(p, true); return; }
        var k = +r.dataset.i;
        if (e.ctrlKey || e.metaKey) toggleMark(p, k);
        else if (e.shiftKey) { var a = Math.min(k, p.cursor), b = Math.max(k, p.cursor); for (var i = a; i <= b; i++) toggleMark(p, i, true); }
        p.cursor = k; paintCursor(p, true); refreshKeys();
      });
      on(p.list, 'dblclick', function (e) { var r = e.target.closest('.vk-fm__row'); if (r) open(p, +r.dataset.i); });
      on(p.sec, 'focusin', function () { activate(p.i); });
    });
    on(keysBar, 'keydown', function (e) {
      if (/^F\d+$/.test(e.key)) { var a = keyAction(e.key.toLowerCase()); if (a) { e.preventDefault(); VK.actions.run(a, ctx(), 'key'); refreshKeys(); } }
      else if (e.key === 'Escape') { e.preventDefault(); focusCursor(panes[activeSide]); }
    });
    if (VK.actions) off.push(VK.actions.subscribe(function (kind) { if (kind === 'register' || kind === 'unregister') { clearTimeout(buildKeys.t); buildKeys.t = setTimeout(buildKeys, 30); } else if (kind === 'run') refreshKeys(); }));

    function switchPane() { var p = panes[1 - activeSide]; activate(p.i); paintCursor(p, true); }
    function side(s) { return s === 'right' || s === 1 ? panes[1] : s === 'left' || s === 0 ? panes[0] : panes[activeSide]; }
    var api = {
      el: el,
      cd: function (path, s) { var p = side(s); return load(p, path); },
      up: function (s) { return goUp(side(s)); },
      refresh: function (s) { var ps = s === undefined ? panes : [side(s)]; return Promise.all(ps.map(function (p) { var c = p.entries[p.cursor]; return load(p, p.path, c && c.name); })); },
      getActive: function () { return info(panes[activeSide]); }, getOther: function () { return info(panes[1 - activeSide]); },
      getTargets: function () { return targets(); },
      mark: function (names, v, s) { var p = side(s); (names || []).forEach(function (n) { var k = p.entries.findIndex(function (e) { return e.name === n; }); if (k >= 0) toggleMark(p, k, v !== false); }); },
      clearMarks: function (s) { var p = side(s); p.marks.clear(); render(p); },
      setStatus: setStatus, refreshKeys: refreshKeys, switchPane: switchPane,
      focus: function () { focusCursor(panes[activeSide]); },
      destroy: function () { off.forEach(function (f) { f(); }); off = []; if (roving) roving.destroy(); el.textContent = ''; el.classList.remove('vk-fm'); }
    };
    panes[0].sec.setAttribute('data-active', '');
    buildKeys();
    load(panes[0], panes[0].path); load(panes[1], panes[1].path);
    return api;
  }

  VK.filemanager = { mount: mount, formatSize: size };
})(typeof window !== 'undefined' ? window : globalThis);
