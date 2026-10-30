/* ServiceKit command database view. ES5, works in IE11, the Dashboard and the standalone PARANCSOK.html.
   CmdView.mount(element, { lang: function () { return 'hu' | 'en'; }, toast: function (msg, isError) {} }) */
(function () {
  'use strict';
  var DATA = window.KIT_COMMANDS || { categories: [], vars: [], commands: [] };
  var TXT = {
    hu: { search: 'Keresés: parancs, feladat, kulcsszó…', all: 'Mind', fav: 'Kedvencek', vars: 'Változók', varsTip: 'A parancsokban a {IP}, {HOST}… helyére ezek kerülnek.',
          copy: 'Másolás', copied: 'Vágólapra másolva', admin: 'admin', caution: 'óvatosan', old: 'régi', re: 'helyreállításban', none: 'Nincs találat.',
          count: '{0} parancs', both: 'CMD + PS', reset: 'Alaphelyzet', clickCopy: 'Kattints a parancsra a másoláshoz.', shellAll: 'Minden shell' },
    en: { search: 'Search: command, task, keyword…', all: 'All', fav: 'Favourites', vars: 'Variables', varsTip: 'These replace {IP}, {HOST}… in the commands.',
          copy: 'Copy', copied: 'Copied to clipboard', admin: 'admin', caution: 'caution', old: 'legacy', re: 'recovery only', none: 'No results.',
          count: '{0} commands', both: 'CMD + PS', reset: 'Reset', clickCopy: 'Click a command to copy it.', shellAll: 'Any shell' }
  };

  function lsGet(k, d) { try { var v = window.localStorage.getItem('skc.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { window.localStorage.setItem('skc.' + k, JSON.stringify(v)); } catch (e) { } }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function norm(s) {
    s = String(s || '').toLowerCase();
    var from = 'áéíóöőúüű', to = 'aeiooouuu', out = '';
    for (var i = 0; i < s.length; i++) { var k = from.indexOf(s.charAt(i)); out += k >= 0 ? to.charAt(k) : s.charAt(i); }
    return out;
  }
  function hasClass(el, c) { return (' ' + el.className + ' ').indexOf(' ' + c + ' ') >= 0; }

  function copyText(s, done) {
    function legacy() {
      try {
        if (window.clipboardData) { window.clipboardData.setData('Text', s); done(true); return; }
        var ta = document.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); document.body.removeChild(ta); done(ok);
      } catch (e) { done(false); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(s).then(function () { done(true); }, legacy); return; }
    } catch (e) { }
    legacy();
  }

  function mount(root, opts) {
    opts = opts || {};
    var S = { q: '', cat: lsGet('cat', 'all'), shell: lsGet('shell', 'all'), favOnly: false, fav: lsGet('fav', {}), vars: lsGet('vars', {}), varsOpen: lsGet('varsOpen', (window.innerWidth || 1000) > 700) };
    var built = false, lastLang = '';
    function lang() { var l = opts.lang ? opts.lang() : 'hu'; return l === 'en' ? 'en' : 'hu'; }
    function t(k) { return TXT[lang()][k]; }
    function L(o) { return o ? (o[lang()] || o.hu) : ''; }
    function toast(m, e) { if (opts.toast) opts.toast(m, e); }
    function varVal(k) { var v = S.vars[k]; if (v === undefined || v === '') { for (var i = 0; i < DATA.vars.length; i++) if (DATA.vars[i].k === k) return DATA.vars[i].d; } return v; }
    function idOf(c) { return c.c + '|' + c.x; }

    function fill(cmd, html) {
      return cmd.replace(/\{(IP|HOST|PORT|USER|DRIVE|NAME|FILE)\}/g, function (m, k) {
        var v = varVal(k);
        return html ? '\u0001' + v + '\u0002' : v;
      });
    }
    function codeHtml(cmd) {
      return esc(fill(cmd, true)).replace(/\u0001/g, '<span class="cv">').replace(/\u0002/g, '</span>');
    }

    function build() {
      var h = '<div class="cmd-head"><div class="search cmd-search"><input type="text" class="cmd-q" autocomplete="off" spellcheck="false" placeholder="' + esc(t('search')) + '"></div>' +
        '<div class="cmd-shells"></div><button type="button" class="filter cmd-favbtn"></button></div>' +
        '<div class="cmd-vars panel"></div><div class="toolbar cmd-cats"></div><div class="cmd-count small muted"></div><div class="cmd-list"></div>';
      root.innerHTML = h;
      var q = root.getElementsByTagName('input')[0];
      q.value = S.q;
      var onq = function () { S.q = q.value; renderList(); };
      q.oninput = onq; q.onkeyup = function (e) { e = e || window.event; if (e.keyCode === 27) { q.value = ''; onq(); } else if (!('oninput' in q)) onq(); };
      root.onclick = onClick;
      root.oninput = onVar; root.onkeyup = root.onkeyup || null;
      built = true; lastLang = lang();
    }

    function q(cls) { var els = root.getElementsByTagName('*'); for (var i = 0; i < els.length; i++) if (hasClass(els[i], cls)) return els[i]; return null; }

    function renderChrome() {
      var counts = {}, i, c, total = 0;
      for (i = 0; i < DATA.commands.length; i++) { c = DATA.commands[i]; if (!shellOk(c)) continue; counts[c.c] = (counts[c.c] || 0) + 1; total++; }
      var h = '<button type="button" class="filter' + (S.cat === 'all' ? ' on' : '') + '" data-cmd="cat" data-v="all">' + esc(t('all')) + ' <span class="cnt">' + total + '</span></button>';
      for (i = 0; i < DATA.categories.length; i++) {
        var cat = DATA.categories[i]; if (!counts[cat.id]) continue;
        h += '<button type="button" class="filter' + (S.cat === cat.id ? ' on' : '') + '" data-cmd="cat" data-v="' + cat.id + '">' + esc(L(cat)) + ' <span class="cnt">' + counts[cat.id] + '</span></button>';
      }
      q('cmd-cats').innerHTML = h;
      var sh = [['all', t('shellAll')], ['cmd', 'CMD'], ['ps', 'PowerShell']], sh2 = '';
      for (i = 0; i < sh.length; i++) sh2 += '<button type="button" class="filter' + (S.shell === sh[i][0] ? ' on' : '') + '" data-cmd="shell" data-v="' + sh[i][0] + '">' + esc(sh[i][1]) + '</button>';
      q('cmd-shells').innerHTML = sh2;
      var fb = q('cmd-favbtn'); fb.className = 'filter cmd-favbtn' + (S.favOnly ? ' on' : ''); fb.setAttribute('data-cmd', 'favonly'); fb.innerHTML = '&#9733; ' + esc(t('fav'));
      var v = '<div class="cmd-vars-head"><button type="button" class="linkbtn" data-cmd="varsToggle">' + (S.varsOpen ? '&#9662; ' : '&#9656; ') + esc(t('vars')) + '</button><span class="small muted">' + esc(t('varsTip')) + '</span>' +
        '<button type="button" class="linkbtn" style="margin-left:auto" data-cmd="varsReset">' + esc(t('reset')) + '</button></div>';
      if (S.varsOpen) {
        v += '<div class="cmd-vars-grid">';
        for (i = 0; i < DATA.vars.length; i++) {
          var dv = DATA.vars[i];
          v += '<label class="fld"><span>{' + dv.k + '} ' + esc(L(dv)) + '</span><input type="text" data-var="' + dv.k + '" value="' + esc(S.vars[dv.k] || '') + '" placeholder="' + esc(dv.d) + '"></label>';
        }
        v += '</div>';
      }
      q('cmd-vars').innerHTML = v;
    }

    function shellOk(c) { return S.shell === 'all' || c.s === 'both' || c.s === S.shell; }
    function matches(c, words) {
      if (S.cat !== 'all' && c.c !== S.cat) return false;
      if (!shellOk(c)) return false;
      if (S.favOnly && !S.fav[idOf(c)]) return false;
      if (!words.length) return true;
      var hay = c._n || (c._n = norm(c.x + ' ' + c.hu + ' ' + c.en + ' ' + (c.n ? c.n.hu + ' ' + c.n.en : '')));
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
      return true;
    }

    function renderList() {
      var words = [], raw = norm(S.q).split(/\s+/), i;
      for (i = 0; i < raw.length; i++) if (raw[i]) words.push(raw[i]);
      var h = '', n = 0, curCat = '', catName = {};
      for (i = 0; i < DATA.categories.length; i++) catName[DATA.categories[i].id] = L(DATA.categories[i]);
      for (i = 0; i < DATA.commands.length; i++) {
        var c = DATA.commands[i];
        if (!matches(c, words)) continue;
        n++;
        if (S.cat === 'all' && c.c !== curCat) { curCat = c.c; h += '<div class="cat-title cmd-cat">' + esc(catName[c.c]) + '</div>'; }
        var f = c.f || [], badges = '<span class="badge sh-' + c.s + '">' + (c.s === 'both' ? t('both') : (c.s === 'ps' ? 'PowerShell' : 'CMD')) + '</span>';
        for (var k = 0; k < f.length; k++) {
          var fl = f[k];
          if (fl === 'a') badges += '<span class="badge">' + esc(t('admin')) + '</span>';
          else if (fl === 'd') badges += '<span class="badge warn">' + esc(t('caution')) + '</span>';
          else if (fl === 'old') badges += '<span class="badge">' + esc(t('old')) + '</span>';
          else if (fl === 're') badges += '<span class="badge manual">' + esc(t('re')) + '</span>';
          else badges += '<span class="badge">' + esc(fl === 'w8' ? 'Win 8+' : (fl === 'w10' ? 'Win 10+' : 'Win 11')) + '</span>';
        }
        var fav = !!S.fav[idOf(c)];
        h += '<div class="cmd-item' + (f.indexOf('d') >= 0 ? ' danger' : '') + '"><div class="cmd-top"><span class="cmd-desc">' + esc(L(c)) + '</span><span class="cmd-badges">' + badges + '</span>' +
          '<button type="button" class="cmd-star' + (fav ? ' on' : '') + '" data-cmd="fav" data-i="' + i + '" title="' + esc(t('fav')) + '">' + (fav ? '&#9733;' : '&#9734;') + '</button></div>' +
          '<div class="cmd-code" data-cmd="copy" data-i="' + i + '" title="' + esc(t('clickCopy')) + '"><code>' + codeHtml(c.x) + '</code><button type="button" class="copy-btn" data-cmd="copy" data-i="' + i + '">' + esc(t('copy')) + '</button></div>' +
          (c.n ? '<div class="cmd-note small">' + esc(L(c.n)) + '</div>' : '') + '</div>';
      }
      q('cmd-list').innerHTML = h || '<div class="empty">' + esc(t('none')) + '</div>';
      q('cmd-count').innerHTML = esc(t('count').replace('{0}', n)) + ' · ' + esc(t('clickCopy'));
    }

    function onClick(ev) {
      ev = ev || window.event;
      var el = ev.target || ev.srcElement;
      while (el && el !== root && !(el.getAttribute && el.getAttribute('data-cmd'))) el = el.parentNode;
      if (!el || el === root) return;
      var a = el.getAttribute('data-cmd'), v = el.getAttribute('data-v'), i = el.getAttribute('data-i');
      if (ev.stopPropagation) ev.stopPropagation(); ev.cancelBubble = true;
      if (a === 'copy') {
        var c = DATA.commands[+i], text = fill(c.x, false);
        copyText(text, function (ok) { toast(ok ? t('copied') : text, !ok); });
        var box = el; while (box && !hasClass(box, 'cmd-code')) box = box.parentNode;
        if (box) { box.className = 'cmd-code flash'; setTimeout(function () { box.className = 'cmd-code'; }, 600); }
        return;
      }
      if (a === 'cat') { S.cat = v; lsSet('cat', v); }
      else if (a === 'shell') { S.shell = v; lsSet('shell', v); }
      else if (a === 'favonly') S.favOnly = !S.favOnly;
      else if (a === 'fav') { var id = idOf(DATA.commands[+i]); if (S.fav[id]) delete S.fav[id]; else S.fav[id] = 1; lsSet('fav', S.fav); }
      else if (a === 'varsToggle') { S.varsOpen = !S.varsOpen; lsSet('varsOpen', S.varsOpen); }
      else if (a === 'varsReset') { S.vars = {}; lsSet('vars', S.vars); }
      renderChrome(); renderList();
    }

    function onVar(ev) {
      ev = ev || window.event;
      var el = ev.target || ev.srcElement, k = el && el.getAttribute && el.getAttribute('data-var');
      if (!k) return;
      S.vars[k] = el.value; lsSet('vars', S.vars);
      renderList();
    }

    function render() {
      if (!built || lastLang !== lang()) build();
      renderChrome(); renderList();
    }
    function focus() { var i = root.getElementsByTagName('input')[0]; if (i) i.focus(); }
    return { render: render, focus: focus };
  }

  window.CmdView = { mount: mount, data: DATA };
})();
