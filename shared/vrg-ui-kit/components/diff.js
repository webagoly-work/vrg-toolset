/* VRG UI Kit — components/diff.js — line diff (unified and side-by-side) and drift list ("elvárt vs tényleges").
   Every change carries a marker AND a colour: + added (ok) · − removed (crit) · ~ changed (warn, with the changed
   part of the line marked) · and for drift lists − hiány (crit) · + többlet (info) · ~ eltérés (warn) · = egyezik.

     var d = VK.diff.mount(el, { a: textOrLines, b: textOrLines, mode: 'unified'|'split',
                                 labels: ['elvárt', 'tényleges'], context: 3 (Infinity = no folding), title })
       → { setText(a, b), setMode(mode), next(), prev(), getStats(), destroy() }
     var dl = VK.diff.drift(el, { items: [{ id, label, group, kind: 'missing'|'extra'|'changed'|'match',
                                            expected, actual, unit, note }],
                                  label, show: ['missing','extra','changed'], onActivate(item) })
       → { setItems(items), filter(kinds), next(), prev(), getCounts(), destroy() }
     VK.diff.lines(a, b) → [{t:'=', a, b} | {t:'-', a} | {t:'+', b} | {t:'~', a, b}]   (indexes into the line arrays)

   Keyboard: ↑/↓ line by line · N or J = next change · P or K = previous change · Home/End ·
   Enter on a folded run expands it (diff) / activates the item (drift) · 1-4 toggle a kind filter (drift).
   Depends on: core.js, mini.js. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.diff) return;

  function toLines(x) { return Array.isArray(x) ? x.map(String) : String(x == null ? '' : x).replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n'); }

  /** LCS line diff; pairs neighbouring removals and additions as changes ('~'). */
  function lines(a, b) {
    a = toLines(a); b = toLines(b);
    var n = a.length, m = b.length, ops = [];
    var pre = 0; while (pre < n && pre < m && a[pre] === b[pre]) pre++;
    var suf = 0; while (suf < n - pre && suf < m - pre && a[n - 1 - suf] === b[m - 1 - suf]) suf++;
    for (var i = 0; i < pre; i++) ops.push({ t: '=', a: i, b: i });
    var A = a.slice(pre, n - suf), B = b.slice(pre, m - suf), N = A.length, M = B.length;
    if (N * M > 4e6) { A.forEach(function (_, k) { ops.push({ t: '-', a: pre + k }); }); B.forEach(function (_, k) { ops.push({ t: '+', b: pre + k }); }); }
    else {
      var L = []; for (var x = 0; x <= N; x++) L.push(new Uint32Array(M + 1));
      for (x = N - 1; x >= 0; x--) for (var y = M - 1; y >= 0; y--) L[x][y] = A[x] === B[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
      x = 0; y = 0;
      while (x < N || y < M) {
        if (x < N && y < M && A[x] === B[y]) { ops.push({ t: '=', a: pre + x, b: pre + y }); x++; y++; }
        else if (y < M && (x >= N || L[x][y + 1] >= L[x + 1][y])) { ops.push({ t: '+', b: pre + y }); y++; }
        else { ops.push({ t: '-', a: pre + x }); x++; }
      }
    }
    for (i = 0; i < suf; i++) ops.push({ t: '=', a: n - suf + i, b: m - suf + i });
    // pair runs of removals/additions into changes
    var out = [], k = 0;
    while (k < ops.length) {
      if (ops[k].t === '=') { out.push(ops[k++]); continue; }
      var dels = [], adds = [];
      while (k < ops.length && ops[k].t !== '=') { (ops[k].t === '-' ? dels : adds).push(ops[k]); k++; }
      var p = Math.min(dels.length, adds.length);
      for (var q = 0; q < p; q++) out.push({ t: '~', a: dels[q].a, b: adds[q].b });
      dels.slice(p).forEach(function (d) { out.push(d); });
      adds.slice(p).forEach(function (d) { out.push(d); });
    }
    return out;
  }

  /** split two strings into [prefix, middle, suffix] around their differing part */
  function mid(s, t) {
    var i = 0; while (i < s.length && i < t.length && s[i] === t[i]) i++;
    var j = 0; while (j < s.length - i && j < t.length - i && s[s.length - 1 - j] === t[t.length - 1 - j]) j++;
    return [[s.slice(0, i), s.slice(i, s.length - j), s.slice(s.length - j)], [t.slice(0, i), t.slice(i, t.length - j), t.slice(t.length - j)]];
  }
  var SR = { add: 'hozzáadva: ', del: 'törölve: ', chg: 'módosítva: ', eq: '' };
  var MARK = { add: '+', del: '−', chg: '~', eq: ' ' };
  function textCell(kind, txt, parts, side) {
    var c = VK.el('span.vk-diff__txt');
    if (SR[kind]) c.appendChild(VK.el('span.vk-sr-only', { text: SR[kind] + (side ? side + ' ' : '') }));
    if (parts && parts[1]) { c.appendChild(document.createTextNode(parts[0])); c.appendChild(VK.el('mark.vk-diff__hl', { text: parts[1] })); c.appendChild(document.createTextNode(parts[2])); }
    else c.appendChild(document.createTextNode(txt === '' ? ' ' : txt));
    return c;
  }
  function roveKeys(container, rowsSel, onExtra) {
    return function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;
      var list = Array.prototype.slice.call(container.querySelectorAll(rowsSel)).filter(function (r) { return r.offsetParent !== null; });
      var i = list.indexOf(document.activeElement); if (i < 0) return;
      var t = null;
      if (e.key === 'ArrowDown') t = list[i + 1]; else if (e.key === 'ArrowUp') t = list[i - 1];
      else if (e.key === 'Home') t = list[0]; else if (e.key === 'End') t = list[list.length - 1];
      else if (e.key === 'PageDown' || e.key === 'PageUp') t = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'PageDown' ? 10 : -10)))];
      else if (onExtra && onExtra(e, list, i)) { e.preventDefault(); return; }
      if (t) { e.preventDefault(); focusRow(container, rowsSel, t); }
    };
  }
  function focusRow(container, sel, r) {
    container.querySelectorAll(sel).forEach(function (x) { x.tabIndex = -1; });
    r.tabIndex = 0; r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ======================= line diff =======================
  function mount(el, o) {
    o = o || {};
    var A = [], B = [], ops = [], mode = o.mode || 'unified', ctx = o.context == null ? 3 : o.context, open = {}, cur = -1, off = [];
    var labels = o.labels || ['elvárt', 'tényleges'];
    el.classList.add('vk-diff'); el.textContent = '';
    var stats = VK.el('span.vk-diff__stats');
    var pos = VK.el('span.vk-diff__pos', { role: 'status', 'aria-live': 'polite' });
    var seg = VK.el('div.vk-btn-group', { role: 'radiogroup', 'aria-label': 'Nézet' });
    [['unified', 'Egyesített'], ['split', 'Kétoldalas']].forEach(function (m) {
      seg.appendChild(VK.el('button.vk-btn.vk-btn--sm', { type: 'button', role: 'radio', 'data-v': m[0], text: m[1] }));
    });
    var prevB = VK.el('button.vk-btn.vk-btn--sm.vk-btn--icon', { type: 'button', 'aria-label': 'Előző változás (P)', title: 'Előző változás (P / K)' }, [VK.icon('arrow-up')]);
    var nextB = VK.el('button.vk-btn.vk-btn--sm.vk-btn--icon', { type: 'button', 'aria-label': 'Következő változás (N)', title: 'Következő változás (N / J)' }, [VK.icon('arrow-down')]);
    var head = VK.el('div.vk-diff__head', null, [
      VK.el('span.vk-diff__files', null, [VK.el('span', { 'data-k': 'del', text: '− ' + labels[0] }), VK.el('span', { 'data-k': 'add', text: '+ ' + labels[1] })]),
      stats, VK.el('span.vk-diff__sp'), pos, prevB, nextB, seg]);
    var body = VK.el('div.vk-diff__body', { role: 'list', 'aria-label': o.title || 'Különbség: ' + labels[0] + ' → ' + labels[1] });
    el.appendChild(head); el.appendChild(body);

    function hunks() {
      var hs = [], inH = false;
      ops.forEach(function (op, k) { if (op.t !== '=') { if (!inH) hs.push(k); inH = true; } else inH = false; });
      return hs;
    }
    function render() {
      el.setAttribute('data-mode', mode);
      Array.prototype.forEach.call(seg.children, function (b) { var on = b.dataset.v === mode; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      body.textContent = '';
      var s = getStats();
      stats.textContent = '';
      stats.appendChild(VK.el('span', { 'data-k': 'add', text: '+' + s.add })); stats.appendChild(VK.el('span', { 'data-k': 'del', text: '−' + s.del })); stats.appendChild(VK.el('span', { 'data-k': 'chg', text: '~' + s.chg }));
      if (!s.add && !s.del && !s.chg) body.appendChild(VK.el('div.vk-diff__empty', null, [VK.icon('ok'), 'Nincs eltérés — a két változat azonos']));
      // folding: '=' runs farther than ctx from a change
      var near = ops.map(function () { return false; });
      ops.forEach(function (op, k) { if (op.t !== '=') for (var d = -ctx; d <= ctx; d++) if (k + d >= 0 && k + d < ops.length) near[k + d] = true; });
      var k = 0;
      while (k < ops.length) {
        if (ops[k].t === '=' && !near[k] && !open[k] && isFinite(ctx)) {
          var start = k; while (k < ops.length && ops[k].t === '=' && !near[k]) k++;
          var fold = VK.el('div.vk-diff__ln.vk-diff__fold', { role: 'listitem', tabindex: -1, 'data-k': 'fold', 'data-start': start },
            [VK.icon('more-h'), (k - start) + ' változatlan sor — Enter: kibontás']);
          fold._range = [start, k];
          body.appendChild(fold);
          continue;
        }
        body.appendChild(row(ops[k], k));
        k++;
      }
      var first = body.querySelector('.vk-diff__ln'); if (first) first.tabIndex = 0;
      cur = -1; pos.textContent = hunks().length ? hunks().length + ' változás' : '';
    }
    function lno(n) { return VK.el('span.vk-diff__no', { 'aria-hidden': 'true', text: n == null ? '' : String(n + 1) }); }
    function mk(kind) { return VK.el('span.vk-diff__mk', { 'aria-hidden': 'true', text: MARK[kind] }); }
    function row(op, k) {
      var r;
      var kind = op.t === '+' ? 'add' : op.t === '-' ? 'del' : op.t === '~' ? 'chg' : 'eq';
      var ta = op.a != null ? A[op.a] : null, tb = op.b != null ? B[op.b] : null;
      var parts = op.t === '~' ? mid(ta, tb) : null;
      if (mode === 'split') {
        r = VK.el('div.vk-diff__ln', { role: 'listitem', tabindex: -1, 'data-k': kind, 'data-op': k });
        var L = VK.el('span.vk-diff__half', { 'data-side': 'a', 'data-empty': ta == null ? '' : null }, ta == null ? [lno(null)] : [lno(op.a), mk(kind === 'add' ? 'eq' : kind), textCell(kind === 'add' ? 'eq' : kind, ta, parts && parts[0], kind === 'chg' ? labels[0] + ':' : '')]);
        var R = VK.el('span.vk-diff__half', { 'data-side': 'b', 'data-empty': tb == null ? '' : null }, tb == null ? [lno(null)] : [lno(op.b), mk(kind === 'del' ? 'eq' : kind), textCell(kind === 'del' ? 'eq' : kind, tb, parts && parts[1], kind === 'chg' ? labels[1] + ':' : '')]);
        r.appendChild(L); r.appendChild(R);
        return r;
      }
      if (op.t === '~') {
        var frag = document.createDocumentFragment();
        frag.appendChild(VK.el('div.vk-diff__ln', { role: 'listitem', tabindex: -1, 'data-k': 'chg', 'data-v': 'old', 'data-op': k }, [lno(op.a), lno(null), mk('chg'), textCell('chg', ta, parts[0], labels[0] + ':')]));
        frag.appendChild(VK.el('div.vk-diff__ln', { role: 'listitem', tabindex: -1, 'data-k': 'chg', 'data-v': 'new', 'data-op': k }, [lno(null), lno(op.b), mk('chg'), textCell('chg', tb, parts[1], labels[1] + ':')]));
        return frag;
      }
      return VK.el('div.vk-diff__ln', { role: 'listitem', tabindex: -1, 'data-k': kind, 'data-op': k }, [lno(op.a), lno(op.b), mk(kind), textCell(kind, ta != null ? ta : tb)]);
    }
    function go(dir) {
      var hs = hunks(); if (!hs.length) return;
      var foc = document.activeElement && body.contains(document.activeElement) ? +document.activeElement.dataset.op : NaN;
      var here = isNaN(foc) ? (cur >= 0 ? hs[cur] : -1) : foc, n;
      if (dir > 0) { n = hs.findIndex(function (h) { return cur < 0 ? h >= here : h > here; }); if (n < 0) n = 0; }
      else {
        var before = hs.filter(function (h) { return h < here; }).length;   // hunks starting before the focus
        var inside = before > 0 && sameHunk(here, hs[before - 1]);
        n = (inside ? before - 2 : before - 1);
        if (here === -1 || n < 0) n = hs.length - 1;
      }
      cur = n;
      body.querySelectorAll('[data-current]').forEach(function (x) { x.removeAttribute('data-current'); });
      var k = hs[n], rowsOf = [];
      for (var j = k; j < ops.length && ops[j].t !== '='; j++) body.querySelectorAll('[data-op="' + j + '"]').forEach(function (x) { rowsOf.push(x); });
      rowsOf.forEach(function (x) { x.setAttribute('data-current', ''); });
      if (rowsOf[0]) focusRow(body, '.vk-diff__ln', rowsOf[0]);
      pos.textContent = 'Változás ' + (n + 1) + ' / ' + hs.length;
    }
    function sameHunk(a, h) { for (var j = h; j < ops.length && ops[j].t !== '='; j++) if (j === a) return true; return false; }
    function expand(f) { for (var j = f._range[0]; j < f._range[1]; j++) open[j] = true; var at = f._range[0]; render(); var r = body.querySelector('[data-op="' + at + '"]'); if (r) focusRow(body, '.vk-diff__ln', r); }

    function on(t, type, fn) { t.addEventListener(type, fn); off.push(function () { t.removeEventListener(type, fn); }); }
    on(body, 'keydown', roveKeys(body, '.vk-diff__ln', function (e, list, i) {
      var k = e.key.toLowerCase();
      if (k === 'n' || k === 'j') { go(1); return true; }
      if (k === 'p' || k === 'k') { go(-1); return true; }
      if (e.key === 'Enter' && list[i]._range) { expand(list[i]); return true; }
      return false;
    }));
    on(body, 'click', function (e) { var r = e.target.closest('.vk-diff__ln'); if (!r) return; if (r._range) expand(r); else focusRow(body, '.vk-diff__ln', r); });
    on(prevB, 'click', function () { go(-1); });
    on(nextB, 'click', function () { go(1); });
    on(seg, 'click', function (e) { var b = e.target.closest('[role="radio"]'); if (b) { setMode(b.dataset.v); b.focus(); } });
    on(seg, 'keydown', function (e) {
      if (e.shiftKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      e.preventDefault(); setMode(mode === 'split' ? 'unified' : 'split'); seg.querySelector('[data-v="' + mode + '"]').focus();
    });
    function setMode(m) { mode = m === 'split' ? 'split' : 'unified'; render(); }
    function getStats() { var s = { add: 0, del: 0, chg: 0, eq: 0 }; ops.forEach(function (op) { s[op.t === '+' ? 'add' : op.t === '-' ? 'del' : op.t === '~' ? 'chg' : 'eq']++; }); return s; }
    var api = {
      el: el, setMode: setMode, next: function () { go(1); }, prev: function () { go(-1); }, getStats: getStats,
      setText: function (a, b) { A = toLines(a); B = toLines(b); ops = lines(A, B); open = {}; render(); },
      destroy: function () { off.forEach(function (f) { f(); }); off = []; el.textContent = ''; el.classList.remove('vk-diff'); }
    };
    api.setText(o.a, o.b);
    return api;
  }

  // ======================= drift list =======================
  var KINDS = {
    missing: { mark: '−', label: 'Hiány', cap: 'HIÁNY', icon: 'gap' },
    extra: { mark: '+', label: 'Többlet', cap: 'TÖBBLET', icon: 'plus' },
    changed: { mark: '~', label: 'Eltérés', cap: 'ELTÉRÉS', icon: 'drift' },
    match: { mark: '=', label: 'Egyezik', cap: 'EGYEZIK', icon: 'ok' }
  };
  var ORDER = ['missing', 'extra', 'changed', 'match'];
  function fmt(v) { return v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('hu-HU') : String(v); }

  function drift(el, o) {
    o = o || {};
    var items = [], show = new Set(o.show || ['missing', 'extra', 'changed']), off = [];
    var labels = o.labels || ['Elvárt', 'Tényleges'];
    el.classList.add('vk-drift'); el.textContent = '';
    var minis = {};
    var filt = VK.el('div.vk-drift__filters.vk-mini-row', { role: 'group', 'aria-label': 'Szűrés fajta szerint' });
    ORDER.forEach(function (k, i) {
      var m = VK.mini.create({ icon: KINDS[k].icon, label: KINDS[k].label + ' mutatása (' + (i + 1) + ')', caption: KINDS[k].cap, pressed: show.has(k), size: 'sm',
        onClick: function () { toggle(k); } });
      m.setAttribute('data-kind', k); minis[k] = m; filt.appendChild(m);
    });
    var sum = VK.el('div.vk-drift__sum', { role: 'status', 'aria-live': 'polite' });
    var cols = VK.el('div.vk-drift__row.vk-drift__cols', { 'aria-hidden': 'true' },
      [VK.el('span'), VK.el('span', { text: 'Tétel' }), VK.el('span.vk-drift__n', { text: labels[0] }), VK.el('span.vk-drift__arr'), VK.el('span.vk-drift__n', { text: labels[1] }), VK.el('span.vk-drift__n.vk-drift__d', { text: 'Δ' })]);
    var list = VK.el('div.vk-drift__list', { role: 'listbox', 'aria-label': o.label || 'Eltérések: elvárt és tényleges' });
    el.appendChild(VK.el('div.vk-drift__head', null, [filt, sum]));
    el.appendChild(cols); el.appendChild(list);

    function counts() { var c = { missing: 0, extra: 0, changed: 0, match: 0 }; items.forEach(function (it) { c[it.kind] = (c[it.kind] || 0) + 1; }); return c; }
    function delta(it) {
      if (typeof it.expected === 'number' && typeof it.actual === 'number') { var d = it.actual - it.expected; return d === 0 ? '0' : (d > 0 ? '+' : '−') + Math.abs(d).toLocaleString('hu-HU'); }
      return it.kind === 'match' ? '' : '≠';
    }
    function render() {
      var c = counts(), keepId = document.activeElement && list.contains(document.activeElement) ? document.activeElement.dataset.id : null;
      ORDER.forEach(function (k) { VK.mini.set(minis[k], { value: String(c[k] || 0), pressed: show.has(k) }); });
      var dev = c.missing + c.extra + c.changed;
      sum.textContent = items.length + ' tétel · ' + dev + ' eltérés' + (dev ? ' (' + ORDER.slice(0, 3).filter(function (k) { return c[k]; }).map(function (k) { return c[k] + ' ' + KINDS[k].label.toLowerCase(); }).join(', ') + ')' : '');
      list.textContent = '';
      var shown = items.filter(function (it) { return show.has(it.kind); });
      shown.forEach(function (it) {
        var K = KINDS[it.kind] || KINDS.changed;
        var r = VK.el('div.vk-drift__row', { role: 'option', tabindex: -1, 'aria-selected': 'false', 'data-kind': it.kind, 'data-id': it.id,
          'aria-label': K.label + ': ' + it.label + ', ' + labels[0].toLowerCase() + ' ' + fmt(it.expected) + (it.unit ? ' ' + it.unit : '') + ', ' + labels[1].toLowerCase() + ' ' + fmt(it.actual) + (it.unit ? ' ' + it.unit : '') + (it.note ? ', ' + it.note : '') }, [
          VK.el('span.vk-drift__mk', { 'aria-hidden': 'true', text: K.mark }),
          VK.el('span.vk-drift__label', null, [it.group ? VK.el('span.vk-drift__grp', { text: it.group }) : null, VK.el('span.vk-ellipsis', { text: it.label }), it.note ? VK.el('span.vk-drift__note', { text: it.note }) : null]),
          VK.el('span.vk-drift__n', { text: fmt(it.expected) + (it.unit && it.expected != null ? ' ' + it.unit : '') }),
          VK.el('span.vk-drift__arr', { 'aria-hidden': 'true', text: '→' }),
          VK.el('span.vk-drift__n.vk-drift__act', { text: fmt(it.actual) + (it.unit && it.actual != null ? ' ' + it.unit : '') }),
          VK.el('span.vk-drift__n.vk-drift__d', { text: delta(it) })
        ]);
        r._it = it;
        list.appendChild(r);
      });
      if (!shown.length) list.appendChild(VK.el('div.vk-drift__empty', null, [VK.icon(items.length ? 'filter' : 'ok'), items.length ? 'A szűrő minden tételt elrejt' : 'Nincs eltérés']));
      var keep = keepId && list.querySelector('[data-id="' + keepId + '"]');
      var first = keep || list.querySelector('.vk-drift__row');
      if (first) { first.tabIndex = 0; if (keep) keep.focus({ preventScroll: true }); }
    }
    function toggle(k) { if (show.has(k)) show.delete(k); else show.add(k); render(); }
    function go(dir) {
      var rows = Array.prototype.slice.call(list.querySelectorAll('.vk-drift__row'));
      var dev = rows.filter(function (r) { return r.dataset.kind !== 'match'; }); if (!dev.length) return;
      var i = rows.indexOf(document.activeElement), t = null;
      if (dir > 0) t = dev.find(function (r) { return rows.indexOf(r) > i; }) || dev[0];
      else { for (var j = dev.length - 1; j >= 0; j--) if (rows.indexOf(dev[j]) < i) { t = dev[j]; break; } t = t || dev[dev.length - 1]; }
      sel(t);
    }
    function sel(r) {
      list.querySelectorAll('[aria-selected="true"]').forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
      r.setAttribute('aria-selected', 'true'); focusRow(list, '.vk-drift__row', r);
    }
    function on(t, type, fn) { t.addEventListener(type, fn); off.push(function () { t.removeEventListener(type, fn); }); }
    on(list, 'keydown', roveKeys(list, '.vk-drift__row', function (e, rows, i) {
      var k = e.key.toLowerCase();
      if (k === 'n' || k === 'j') { go(1); return true; }
      if (k === 'p' || k === 'k') { go(-1); return true; }
      if (/^[1-4]$/.test(e.key)) { toggle(ORDER[+e.key - 1]); return true; }
      if (e.key === 'Enter') { if (o.onActivate) o.onActivate(rows[i]._it); return true; }
      return false;
    }));
    on(list, 'focusin', function (e) { var r = e.target.closest('.vk-drift__row'); if (r) { list.querySelectorAll('[aria-selected="true"]').forEach(function (x) { if (x !== r) x.setAttribute('aria-selected', 'false'); }); r.setAttribute('aria-selected', 'true'); } });
    on(list, 'click', function (e) { var r = e.target.closest('.vk-drift__row'); if (r) sel(r); });
    on(list, 'dblclick', function (e) { var r = e.target.closest('.vk-drift__row'); if (r && o.onActivate) o.onActivate(r._it); });

    var api = {
      el: el, getCounts: counts, next: function () { go(1); }, prev: function () { go(-1); },
      filter: function (kinds) { show = new Set(kinds || ORDER); render(); },
      setItems: function (list2) { items = (list2 || []).slice(); render(); },
      destroy: function () { off.forEach(function (f) { f(); }); off = []; el.textContent = ''; el.classList.remove('vk-drift'); }
    };
    api.setItems(o.items);
    return api;
  }

  VK.diff = { mount: mount, drift: drift, lines: lines, KINDS: KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
