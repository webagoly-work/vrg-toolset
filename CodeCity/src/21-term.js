// 21-term.js — the embedded terminal (CITY-D15 C): a panel with one tab per terminal, xterm.js on the page,
// a real console (ConPTY) in the Kódváros segéd. "Terminál itt" and "Claude Code itt" open here when the
// segéd offers it (status.terminal); otherwise they fall back to an outside window or the claude-cli:// link.
// xterm comes from the segéd (/vendor/xterm.js), loaded on first use, so the file:// page stays small.
// Output: GET /api/term-stream (SSE, the page's cookie); input, resize, close: token-checked actions.
// Claude tabs are remembered per repo (localStorage: folder + session UUID only); when the segéd restarted and
// the tabs are gone, a 'Folytatás' banner offers `claude --resume <uuid>` for each (KV-13).

const term = { el: null, tabs: [], cur: null, lib: null };
const termOn = () => kv.match && !!(kv.status && kv.status.terminal);
const TERM_KEY = () => 'kodvaros-terms:' + current.city.repo.name;
function termSaved() { try { return JSON.parse(localStorage.getItem(TERM_KEY()) || '[]'); } catch (e) { return []; } }
function termSave(list) { try { localStorage.setItem(TERM_KEY(), JSON.stringify(list.slice(-8))); } catch (e) { /* memory only */ } }
// after a restart: the Claude tabs of last time, each with a 'Folytatás'
async function termResumeOffer() {
  await kvReady();
  const old = termSaved().filter(x => !term.tabs.some(t => t.session === x.session));
  let bar = $('term-resume');
  if (!termOn() || !old.length) { if (bar) bar.hidden = true; return; }
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'term-resume';
    bar.addEventListener('click', async e => {
      const b = e.target.closest('[data-resume]'), x = e.target.closest('[data-forget]');
      if (x) { termSave(termSaved().filter(s => s.session !== x.dataset.forget)); return termResumeOffer(); }
      if (!b) return;
      const s = termSaved().find(v => v.session === b.dataset.resume);
      if (s) { await kvTermOpen(s.dir, 'claude', s.session); termResumeOffer(); }
    });
    document.body.append(bar);
  }
  bar.innerHTML = '<b>Korábbi Claude-munkamenet a panelben</b>' + old.map(s => `<span class="row">${esc(s.label)} <span class="dim">${new Date(s.at).toLocaleString('hu-HU')}</span>` +
    `<button class="btn" data-resume="${esc(s.session)}">Folytatás</button><span class="x" data-forget="${esc(s.session)}" title="Elfelejt">×</span></span>`).join('');
  bar.hidden = false;
}

function termLoadLib() {
  if (term.lib) return term.lib;
  const add = (tag, attrs) => new Promise((res, rej) => { const e = document.createElement(tag); Object.assign(e, attrs); e.onload = res; e.onerror = rej; document.head.append(e); });
  return term.lib = Promise.all([add('link', { rel: 'stylesheet', href: '/vendor/xterm.css' }), add('script', { src: '/vendor/xterm.js' })])
    .then(() => add('script', { src: '/vendor/addon-fit.js' }));
}

function termPanel() {
  if (term.el) return term.el;
  const el = term.el = document.createElement('section');
  el.id = 'term'; el.setAttribute('aria-label', 'Terminál');
  el.innerHTML = '<header><span class="tabs"></span><button class="btn" data-x="min" title="Kis méret / vissza">_</button></header><div class="body"></div>';
  el.querySelector('header').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'), x = e.target.closest('[data-close]');
    if (x) { e.stopPropagation(); return termClose(x.dataset.close); }
    if (b) return termShow(b.dataset.tab);
    if (e.target.closest('[data-x=min]')) { el.classList.toggle('min'); termFitSoon(); }
  });
  new ResizeObserver(() => termFitSoon()).observe(el);
  document.body.append(el);
  return el;
}
function termTabs() {
  const tabs = term.el.querySelector('.tabs');
  tabs.innerHTML = term.tabs.map(t => `<span class="tab${t.id === term.cur ? ' on' : ''}${t.exited !== null ? ' done' : ''}" data-tab="${t.id}" title="${esc(t.dir)}">` +
    `${t.kind === 'claude' ? 'Claude' : 'cmd'} · ${esc(t.label)}<b data-close="${t.id}" title="Bezárás (a folyamat leáll)">×</b></span>`).join('');
  term.el.hidden = !term.tabs.length;
}
function termShow(id) {
  term.cur = id;
  for (const t of term.tabs) t.box.hidden = t.id !== id;
  termTabs(); termFitSoon();
  const t = term.tabs.find(x => x.id === id);
  if (t) t.xt.focus();
}
function termFitSoon() {
  clearTimeout(termFitSoon.h);
  termFitSoon.h = setTimeout(() => {
    const t = term.tabs.find(x => x.id === term.cur);
    if (!t || term.el.classList.contains('min')) return;
    try { t.fit.fit(); } catch (e) { return; }
    if (t.cols !== t.xt.cols || t.rows !== t.xt.rows) {
      t.cols = t.xt.cols; t.rows = t.xt.rows;
      if (t.exited === null) kvCall('term-resize', { id: t.id, cols: t.cols, rows: t.rows });
    }
  }, 60);
}

// open a terminal in a repo folder; false = not available here (the caller falls back)
async function kvTermOpen(dirRel, kind, resume) {
  await kvReady();
  if (!termOn()) return false;
  const r = await (resume ? kvCall('term-resume', { dir: dirRel, session: resume }) : kvCall('term-open', { dir: dirRel, kind }));
  if (r.status !== 200 || !r.json.id) { kvDone(r, ''); return true; }
  try { await termLoadLib(); } catch (e) { kvToast('Az xterm nem töltődött be — node tools/fetch-vendor.js xterm xterm-fit'); kvCall('term-close', { id: r.json.id }); return true; }
  const panel = termPanel(), box = document.createElement('div');
  box.className = 'xt'; panel.querySelector('.body').append(box);
  const xt = new Terminal({ cursorBlink: true, fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 13, scrollback: 5000,
    theme: { background: '#05070d', foreground: '#dde4f5', cursor: '#ffcf5a', selectionBackground: '#ffcf5a55' } });
  const fit = new FitAddon.FitAddon();
  xt.loadAddon(fit); xt.open(box);
  const t = { id: r.json.id, kind, dir: r.json.dir, session: r.json.session || null, dirRel, label: dirRel === '.' ? current.city.repo.name : dirRel.split('/').pop(), xt, fit, box, exited: null, q: '', cols: 0, rows: 0 };
  // keystrokes go out in small batches: one POST per ~15 ms, not one per key
  xt.onData(d => {
    if (t.exited !== null) return;
    t.q += d;
    if (!t.qh) t.qh = setTimeout(() => { const data = t.q; t.q = ''; t.qh = 0; kvCall('term-input', { id: t.id, data }); }, 15);
  });
  t.es = new EventSource('/api/term-stream?id=' + encodeURIComponent(t.id));
  t.es.onmessage = e => xt.write(JSON.parse(e.data));
  t.es.addEventListener('exit', e => {
    t.exited = +JSON.parse(e.data); t.es.close();
    xt.write(`\r\n\x1b[2m[a folyamat kilépett: ${t.exited}]\x1b[0m\r\n`); termTabs();
  });
  term.tabs.push(t);
  if (t.session && !termSaved().some(s => s.session === t.session)) termSave([...termSaved(), { session: t.session, dir: dirRel, label: t.label, at: Date.now() }]);
  panel.classList.remove('min');
  termShow(t.id);
  if (term.el) term.el.dataset.last = t.id;   // test hook
  return true;
}
function termClose(id) {
  const k = term.tabs.findIndex(t => t.id === id);
  if (k < 0) return;
  const t = term.tabs[k];
  if (t.exited === null) kvCall('term-close', { id });
  if (t.session) termSave(termSaved().filter(s => s.session !== t.session));   // closed on purpose: nothing to resume
  if (t.es) t.es.close();
  t.xt.dispose(); t.box.remove();
  term.tabs.splice(k, 1);
  if (term.cur === id) term.cur = term.tabs.length ? term.tabs[term.tabs.length - 1].id : null;
  if (term.cur) termShow(term.cur); else termTabs();
}
