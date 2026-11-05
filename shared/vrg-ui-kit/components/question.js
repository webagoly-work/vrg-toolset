/* VRG UI Kit — components/question.js — DECISION cards: lettered options, keyboard-first, one-line answers.
     var q = VK.question.mount(el, {
       questions: [{ id: 'q1', title: 'Melyik védelmi eszköz legyen a fürdőszobában?',
                     context: 'VRG-2611-03 · F2 áramkör, 2,5 mm², 16 A',
                     options: ['30 mA RCBO áramkörönként', '30 mA RCD csoportosan', 'Csak kismegszakító'],
                     recommended: 0,            // index of the "Ajánlott" option (default 0 = A; null = none)
                     other: true,               // free-text "Más:" option (default true; a string renames it)
                     answer: {key: 'B'} }],     // optional pre-set answer ({key:'D', text:'…'} for Más)
       onAnswer: function (a) {},               // a = {index, id, key, label, text, line, question}
       title: 'Döntések'                         // stack micro label
     })
     → { answers(), line(), copy(), focus(i), reopen(i), set(questions), destroy() }
   Keys inside a card: A/B/C… choose (the letter after the last option = Más, focuses its text box),
   ↑↓ / ←→ move and choose (radiogroup), Home/End, Space chooses, Enter confirms (on a fresh card Enter takes
   the focused option, so Enter·Enter·Enter accepts every recommendation). In the Más box: Enter confirms,
   ↑↓ leave it, Esc returns to the option. Answered cards show one line + "Módosítás".
   MINIs: progress (value "2/4", ring = share answered, click = first open card) and copy ("1A 2C 3D „…”").
   Suggested registry action for apps: 'question.copyAll' → inst.copy().
   Fires 'vk:answer' (bubbling) on el. Depends on: core.js, mini.js, button.css. */
(function (root) {
  'use strict';
  var VK = root.VK = root.VK || {};
  if (VK.question) return;

  var LETTERS = 'ABCDEFGHIJKLMNOP';
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function norm(q, i) {
    var o = {
      id: q.id || 'q' + (i + 1), title: q.title || '', context: q.context || '',
      options: (q.options || []).map(function (x) { return typeof x === 'string' ? { label: x } : x; }),
      recommended: q.recommended === undefined ? 0 : q.recommended,
      other: q.other === undefined ? true : q.other, answer: q.answer || null
    };
    o.otherKey = o.other ? LETTERS[o.options.length] : null;
    return o;
  }

  /** copy text to the clipboard; works on file:// too (falls back to a hidden textarea) */
  function copyText(text) {
    function legacy() {
      var ta = VK.el('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', left: '-9999px', top: '0', opacity: '0' } });
      ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); return ok;
    }
    if (root.navigator && navigator.clipboard && root.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(); });
    }
    return Promise.resolve(legacy());
  }

  function mount(el, o) {
    o = o || {};
    var qs = [], cards = [], answers = [];
    var prevFocus = null;
    el.classList.add('vk-question-stack');
    el.textContent = '';

    // ---- stack chrome ----
    var count = VK.el('span.vk-question-stack__count.vk-num', { 'aria-live': 'polite' });
    var progress = VK.mini.create({ icon: 'question', label: 'Megválaszolva', meter: 'ticks', size: 'sm', onClick: function () { focusFirstOpen(); } });
    progress.tabIndex = -1;
    var copyMini = VK.mini.create({ icon: 'copy', label: 'Összes válasz másolása', size: 'sm', onClick: function () { copy(); } });
    var head = VK.el('header.vk-question-stack__head', null, [
      VK.el('span.vk-label', { text: '[' + (o.title || 'Döntések') + ']' }), count,
      VK.el('div.vk-question-stack__tools', null, [progress, copyMini])
    ]);
    var list = VK.el('ol.vk-question-stack__list');
    var lineOut = VK.el('output.vk-question-stack__line', { 'aria-label': 'Válaszok egy sorban' });
    var foot = VK.el('footer.vk-question-stack__foot', null, [VK.el('span.vk-label', { text: 'Válaszok' }), lineOut]);
    el.appendChild(head); el.appendChild(list); el.appendChild(foot);

    function build(questions) {
      qs = (questions || []).map(norm);
      answers = qs.map(function (q) { return resolve(q, q.answer); });
      list.textContent = ''; cards = qs.map(card);
      cards.forEach(function (c) { list.appendChild(VK.el('li', null, c.root)); });
      refresh();
    }

    function resolve(q, a) {
      if (!a || !a.key) return null;
      var k = String(a.key).toUpperCase();
      if (k === q.otherKey) return { key: k, label: typeof q.other === 'string' ? q.other : 'Más', text: a.text || '' };
      var i = LETTERS.indexOf(k); if (i < 0 || i >= q.options.length) return null;
      return { key: k, label: q.options[i].label, text: '' };
    }

    function card(q, qi) {
      var tid = VK.uid('vk-q'), cid = tid + '-c', hid = tid + '-h';
      var radios = [];
      var group = VK.el('div.vk-question__opts', { role: 'radiogroup', 'aria-labelledby': tid, 'aria-describedby': (q.context ? cid + ' ' : '') + hid });
      q.options.forEach(function (op, i) {
        var r = VK.el('div.vk-question__opt', { role: 'radio', 'aria-checked': 'false', tabindex: '-1', 'data-key': LETTERS[i],
          'aria-keyshortcuts': LETTERS[i] }, [
          VK.el('span.vk-question__key', { 'aria-hidden': 'true', text: LETTERS[i] }),
          VK.el('span.vk-question__text', { text: op.label, title: op.label }),
          i === q.recommended ? VK.el('span.vk-question__rec', { text: 'Ajánlott' }) : null
        ]);
        if (op.hint) r.setAttribute('title', op.hint);
        radios.push(r); group.appendChild(r);
      });
      var other = null;
      if (q.other) {
        var oLabel = typeof q.other === 'string' ? q.other : 'Más';
        var or = VK.el('div.vk-question__opt.vk-question__opt--other', { role: 'radio', 'aria-checked': 'false', tabindex: '-1',
          'data-key': q.otherKey, 'aria-keyshortcuts': q.otherKey }, [
          VK.el('span.vk-question__key', { 'aria-hidden': 'true', text: q.otherKey }),
          VK.el('span.vk-question__text', { text: oLabel + ':' })
        ]);
        other = VK.el('input.vk-question__other', { type: 'text', tabindex: '-1', placeholder: 'saját válasz…',
          'aria-label': oLabel + ' — saját válasz (' + pad(qi + 1) + ')' });
        radios.push(or);
        group.appendChild(VK.el('div.vk-question__other-row', null, [or, other]));
      }
      var last = LETTERS[radios.length - 1];
      var confirmBtn = VK.el('button.vk-btn.vk-btn--sm', { type: 'button', 'data-variant': 'primary', text: 'Rögzítés' });
      var editBtn = VK.el('button.vk-btn.vk-btn--sm', { type: 'button', 'data-variant': 'quiet', text: 'Módosítás' });
      var sumKey = VK.el('span.vk-question__key', { 'aria-hidden': 'true' });
      var sumText = VK.el('span.vk-question__text');
      var art = VK.el('article.vk-question', { 'aria-labelledby': tid, 'data-state': 'open' }, [
        VK.el('header.vk-question__head', null, [
          VK.el('span.vk-question__num.vk-label', { 'aria-hidden': 'true', text: '[' + pad(qi + 1) + ']' }),
          VK.el('h3.vk-question__title', { id: tid, text: q.title })
        ]),
        q.context ? VK.el('p.vk-question__ctx', { id: cid, text: q.context }) : null,
        group,
        VK.el('div.vk-question__foot', null, [
          VK.el('span.vk-question__keys.vk-label', { id: hid, html: '<kbd>A</kbd>–<kbd>' + last + '</kbd> választ · <kbd>↑↓</kbd> mozgat · <kbd>Enter</kbd> rögzít' }),
          confirmBtn
        ]),
        VK.el('div.vk-question__summary', null, [
          VK.el('span.vk-question__done', { 'aria-hidden': 'true' }, VK.icon('check')),
          sumKey, sumText, editBtn
        ])
      ]);
      var c = { root: art, q: q, i: qi, radios: radios, other: other, group: group, sumKey: sumKey, sumText: sumText, confirm: confirmBtn, edit: editBtn };

      group.addEventListener('keydown', function (e) { onKey(c, e); });
      group.addEventListener('click', function (e) {
        var r = e.target.closest('[role="radio"]'); if (!r || !group.contains(r)) return;
        choose(c, radios.indexOf(r), true);
      });
      if (other) {
        other.addEventListener('focus', function () { choose(c, radios.length - 1, false); });
        other.addEventListener('input', function () { other.removeAttribute('aria-invalid'); });
      }
      confirmBtn.addEventListener('click', function () { confirm(c); });
      editBtn.addEventListener('click', function () { reopen(qi); });
      return c;
    }

    function checkedIndex(c) { return c.radios.findIndex(function (r) { return r.getAttribute('aria-checked') === 'true'; }); }
    function setTab(c, i) { c.radios.forEach(function (r, k) { r.tabIndex = k === i ? 0 : -1; }); }

    /** check option i of card c (and move focus to it, or into the Más box) */
    function choose(c, i, doFocus) {
      if (i < 0 || i >= c.radios.length) return;
      c.radios.forEach(function (r, k) { r.setAttribute('aria-checked', k === i ? 'true' : 'false'); });
      setTab(c, i);
      var isOther = c.other && i === c.radios.length - 1;
      if (c.other) c.other.tabIndex = isOther ? 0 : -1;
      if (doFocus) { if (isOther) c.other.focus(); else c.radios[i].focus(); }
    }

    function onKey(c, e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.shiftKey && /^Arrow/.test(e.key)) return;               // Shift+Arrow = region hop
      var inOther = e.target === c.other;
      var n = c.radios.length, cur = inOther ? n - 1 : c.radios.indexOf(e.target);
      if (cur < 0) return;
      var k = e.key;
      if (inOther) {
        if (k === 'Enter') { e.preventDefault(); confirm(c); }
        else if (k === 'ArrowUp') { e.preventDefault(); choose(c, (cur - 1 + n) % n, true); }
        else if (k === 'ArrowDown') { e.preventDefault(); choose(c, 0, true); }
        else if (k === 'Escape') { e.preventDefault(); c.radios[n - 1].focus(); }
        return;
      }
      if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); choose(c, (cur + 1) % n, true); }
      else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); choose(c, (cur - 1 + n) % n, true); }
      else if (k === 'Home') { e.preventDefault(); choose(c, 0, true); }
      else if (k === 'End') { e.preventDefault(); choose(c, n - 1, true); }
      else if (k === ' ') { e.preventDefault(); choose(c, cur, true); }
      else if (k === 'Enter') {
        e.preventDefault();
        if (checkedIndex(c) < 0) choose(c, cur, cur === n - 1 && !!c.other);
        if (!(c.other && checkedIndex(c) === n - 1 && !c.other.value.trim())) confirm(c);
      } else if (k.length === 1) {
        var li = LETTERS.indexOf(k.toUpperCase());
        if (li >= 0 && li < n) { e.preventDefault(); choose(c, li, true); }
      }
    }

    function confirm(c) {
      var i = checkedIndex(c);
      if (i < 0) { i = Math.max(0, c.radios.findIndex(function (r) { return r.tabIndex === 0; })); choose(c, i, false); }
      var isOther = c.other && i === c.radios.length - 1, text = '';
      if (isOther) {
        text = c.other.value.trim();
        if (!text) { c.other.setAttribute('aria-invalid', 'true'); c.other.placeholder = 'Írd be a saját választ…'; c.other.focus(); return; }
      }
      answers[c.i] = resolve(c.q, { key: LETTERS[i], text: text });
      var hadFocus = c.root.contains(document.activeElement);
      render(c);
      refresh();
      var a = info(c.i);
      if (o.onAnswer) { try { o.onAnswer(a); } catch (err) { console.error(err); } }
      VK.fire(el, 'answer', a);
      if (hadFocus) focusFirstOpen(c.i);
    }

    function info(i) {
      var a = answers[i]; if (!a) return null;
      return { index: i, id: qs[i].id, key: a.key, label: a.label, text: a.text, line: one(i), question: qs[i] };
    }
    function one(i) { var a = answers[i]; if (!a) return ''; return (i + 1) + a.key + (a.text ? ' „' + a.text + '”' : ''); }
    function line() { return answers.map(function (a, i) { return one(i); }).filter(Boolean).join(' '); }

    function render(c) {
      var a = answers[c.i];
      c.root.dataset.state = a ? 'answered' : 'open';
      if (!a) return;
      var idx = LETTERS.indexOf(a.key);
      choose(c, idx, false);
      if (c.other && a.text) c.other.value = a.text;
      c.sumKey.textContent = a.key;
      c.sumText.textContent = a.text ? a.label + ': ' + a.text : a.label;
      c.sumText.title = c.sumText.textContent;
      c.edit.setAttribute('aria-label', 'Módosítás: ' + c.q.title);
    }

    function refresh() {
      cards.forEach(function (c) {
        render(c);
        if (!answers[c.i] && checkedIndex(c) < 0) setTab(c, c.q.recommended != null && c.q.recommended < c.radios.length ? c.q.recommended : 0);
      });
      var done = answers.filter(Boolean).length, total = qs.length;
      count.innerHTML = '';
      VK.append(count, [String(done), VK.el('span', { text: ' / ' + total })]);
      progress.dataset.label = 'Megválaszolva: ' + done + ' / ' + total;
      progress.title = progress.dataset.label;
      VK.mini.set(progress, { state: total && done === total ? 'done' : (done ? 'running' : 'idle'), progress: total ? done / total : 0, value: done + '/' + total });
      lineOut.textContent = line();
      copyMini.disabled = !done;
    }

    function focusFirstOpen(after) {
      var start = after === undefined ? 0 : after + 1;
      var order = cards.slice(start).concat(cards.slice(0, start));
      var c = order.find(function (x) { return !answers[x.i]; });
      if (!c) { copyMini.focus(); return; }
      var t = c.radios.find(function (r) { return r.tabIndex === 0; }) || c.radios[0];
      t.focus(); if (t.scrollIntoView) t.scrollIntoView({ block: 'nearest' });
    }

    function reopen(i) {
      var c = cards[i]; if (!c) return;
      answers[i] = null;
      c.root.dataset.state = 'open';
      refresh();
      var t = c.radios.find(function (r) { return r.tabIndex === 0; }) || c.radios[0];
      if (c.other && t === c.radios[c.radios.length - 1] && c.other.value) c.other.focus(); else t.focus();
    }

    function copy() {
      var text = line(); if (!text) return Promise.resolve(false);
      VK.mini.set(copyMini, { state: 'running', progress: null });
      return copyText(text).then(function (ok) {
        VK.mini.set(copyMini, { state: ok ? 'done' : 'error' });
        copyMini.title = ok ? 'Másolva: ' + text : 'A másolás nem sikerült';
        clearTimeout(copyMini._t);
        copyMini._t = setTimeout(function () { VK.mini.set(copyMini, { state: 'idle' }); copyMini.title = 'Összes válasz másolása'; }, 1800);
        VK.fire(el, 'copy', { text: text, ok: ok });
        return ok;
      });
    }

    build(o.questions);
    prevFocus = null;
    return {
      answers: function () { return answers.map(function (a, i) { return info(i); }); },
      line: line, copy: copy, reopen: reopen,
      focus: function (i) { if (i === undefined) focusFirstOpen(); else { var c = cards[i]; if (c) (c.radios.find(function (r) { return r.tabIndex === 0; }) || c.radios[0]).focus(); } },
      set: function (questions) { build(questions); },
      destroy: function () { clearTimeout(copyMini._t); el.textContent = ''; el.classList.remove('vk-question-stack'); }
    };
  }

  VK.question = { mount: mount, copyText: copyText };
})(typeof window !== 'undefined' ? window : globalThis);
