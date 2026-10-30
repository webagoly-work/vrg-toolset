// 25-file.js — the file panel (P5, KV-12; CITY-D14 A, D10 A): a file of the repo in a flat panel beside the
// city (report R6: read and type in panels, not in 3D). Nézet: CodeMirror 6, read-only. Előnézet: markdown
// through markdown-it and DOMPurify. Szerkesztés: the same editor, editable. Eltérés: CodeMirror's merge view,
// original against the edit. Mentés… asks first, showing the path, the +/− lines and where the safety copy goes;
// the segéd refuses if the file changed since it was opened. CodeMirror comes from Vendor through the import
// map the segéd puts in the page; from file:// the panel is not offered (the RCO item says why).

const fp = { el: null, file: null, text: '', edit: null, tab: 'view', views: [], mods: null, md: null };
const fpOn = () => kv.match && !!(kv.status && kv.status.editor);

async function fpMods() {
  if (fp.mods) return fp.mods;
  const [view, state, commands, merge] = await Promise.all(['@codemirror/view', '@codemirror/state', '@codemirror/commands', '@codemirror/merge'].map(m => import(m)));
  return fp.mods = { view, state, commands, merge };
}
function fpScript(src) {
  return new Promise((res, rej) => { const e = document.createElement('script'); e.src = src; e.onload = res; e.onerror = rej; document.head.append(e); });
}
async function fpMarkdown(text) {
  if (!fp.md) { await Promise.all([fpScript('/vendor/markdown-it.js'), fpScript('/vendor/purify.js')]); fp.md = window.markdownit({ html: false, linkify: true }); }
  return window.DOMPurify.sanitize(fp.md.render(text));
}
const fpIsMd = () => /\.(md|markdown)$/i.test(fp.file || '');
// +/− lines between two texts (a plain line diff: enough for the confirm's summary)
function fpCount(a, b) {
  const A = a.split('\n'), B = b.split('\n'), m = new Map();
  for (const l of A) m.set(l, (m.get(l) || 0) + 1);
  let same = 0;
  for (const l of B) { const n = m.get(l); if (n) { same++; m.set(l, n - 1); } }
  return { plus: B.length - same, minus: A.length - same };
}

function fpEditor(doc, editable) {
  const { view, state, commands } = fp.mods;
  return new view.EditorView({ parent: fp.el.querySelector('.fp-body'), state: state.EditorState.create({ doc, extensions: [
    view.lineNumbers(), view.highlightActiveLine(), view.drawSelection(), commands.history(),
    view.keymap.of([...commands.defaultKeymap, ...commands.historyKeymap]),
    state.EditorState.readOnly.of(!editable), view.EditorView.editable.of(editable), view.EditorView.lineWrapping,
    view.EditorView.updateListener.of(u => { if (editable && u.docChanged) { fp.edit = u.state.doc.toString(); fpHead(); } }),
    view.EditorView.theme({ '&': { height: '100%', color: '#e8f0f6', backgroundColor: '#0a141c' }, '.cm-gutters': { backgroundColor: '#0d1820', color: '#5d6a8c', border: 'none' },
      '.cm-activeLine': { backgroundColor: '#ffffff08' }, '.cm-scroller': { fontFamily: 'Cascadia Mono, Consolas, monospace' }, '&.cm-focused .cm-cursor': { borderLeftColor: '#ffcf5a' } }, { dark: true })] }) });
}
async function fpShow(tab) {
  fp.tab = tab;
  for (const v of fp.views) v.destroy();
  fp.views = [];
  const body = fp.el.querySelector('.fp-body');
  body.replaceChildren(); body.className = 'fp-body ' + tab;
  const cur = fp.edit === null ? fp.text : fp.edit;
  if (tab === 'view') fp.views.push(fpEditor(cur, false));
  else if (tab === 'edit') { fp.views.push(fpEditor(cur, true)); fp.views[0].focus(); }
  else if (tab === 'diff') {
    const { merge } = fp.mods;
    fp.views.push(new merge.MergeView({ parent: body, a: { doc: fp.text, extensions: [fp.mods.state.EditorState.readOnly.of(true)] },
      b: { doc: cur, extensions: [fp.mods.state.EditorState.readOnly.of(true)] } }));
  } else if (tab === 'md') {
    const d = document.createElement('div'); d.className = 'fp-md'; d.innerHTML = await fpMarkdown(cur); body.append(d);
  }
  fpHead();
}
function fpHead() {
  const changed = fp.edit !== null && fp.edit !== fp.text, c = changed ? fpCount(fp.text, fp.edit) : null;
  fp.el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === fp.tab));
  fp.el.querySelector('[data-tab=md]').hidden = !fpIsMd();
  const sv = fp.el.querySelector('[data-act=save]');
  sv.disabled = !changed;
  sv.textContent = changed ? `Mentés… (+${c.plus} / −${c.minus})` : 'Mentés…';
}

async function kvFileOpen(rel) {
  await kvReady();
  if (!fpOn()) return kvToast(kv.match ? 'A fájlpanelhez: node tools/fetch-vendor.js cm-state cm-view … (lásd README §6)' : KV_WHY.companion);
  let r;
  try { r = await fetch('/api/file?path=' + encodeURIComponent(rel)); } catch (e) { return kvToast('A Kódváros segéd nem válaszol'); }
  const j = await r.json();
  if (!r.ok) return kvToast(j.error || 'Nem nyitható meg (' + r.status + ')');
  try { await fpMods(); } catch (e) { return kvToast('A CodeMirror nem töltődött be — node tools/fetch-vendor.js (cm-*)'); }
  if (!fp.el) {
    fp.el = document.createElement('section'); fp.el.id = 'filep';
    fp.el.innerHTML = '<header><b class="fp-path"></b><span class="fp-tabs"><button class="btn" data-tab="view">Nézet</button>' +
      '<button class="btn" data-tab="md">Előnézet</button><button class="btn" data-tab="edit">Szerkesztés</button><button class="btn" data-tab="diff">Eltérés</button></span>' +
      '<button class="btn fp-save" data-act="save" title="Előbb megmutatja, mi változik; a régi változat biztonsági másolatba kerül">Mentés…</button>' +
      '<span class="x" data-act="close" title="Bezárás">×</span></header><div class="fp-body"></div>';
    fp.el.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]'), a = e.target.closest('[data-act]');
      if (t) fpShow(t.dataset.tab);
      else if (a && a.dataset.act === 'close') fpClose();
      else if (a && a.dataset.act === 'save' && !a.disabled) fpConfirm();
    });
    document.body.append(fp.el);
  }
  if (fp.edit !== null && fp.edit !== fp.text && !confirm('A mostani szerkesztés elvész. Másik fájlt nyitsz?')) return;
  // CodeMirror keeps line ends as \n; the segéd puts a CRLF file's \r\n back when it saves
  Object.assign(fp, { file: j.path, text: j.text.replace(/\r\n/g, '\n'), base: j.hash, edit: null });
  fp.el.querySelector('.fp-path').textContent = j.path;
  fp.el.hidden = false;
  await fpShow(fpIsMd() ? 'md' : 'view');
}
function fpClose() {
  if (fp.edit !== null && fp.edit !== fp.text && !confirm('A szerkesztés nincs mentve. Bezárod?')) return;
  for (const v of fp.views) v.destroy();
  fp.views = []; fp.el.hidden = true; fp.edit = null;
}
// the confirm: the diff is on screen, the dialog names the path, the line counts and the safety copy
async function fpConfirm() {
  if (fp.tab !== 'diff') await fpShow('diff');
  const c = fpCount(fp.text, fp.edit);
  const box = document.createElement('div'); box.id = 'fp-confirm';
  box.innerHTML = `<p>Mentés ide: <b>${esc(fp.file)}</b></p><p>+${c.plus} sor / −${c.minus} sor — a különbséget a panel mutatja.</p>` +
    '<p class="dim">A mostani változat előbb biztonsági másolatba kerül: .cache/vrg-safety/&lt;időpont&gt;/… (nem kerül a gitbe).</p>' +
    '<div class="row"><button class="btn" data-ok>Mentés</button><button class="btn" data-no>Mégse</button></div>';
  fp.el.append(box);
  box.querySelector('[data-no]').onclick = () => box.remove();
  box.querySelector('[data-ok]').onclick = async () => {
    box.remove();
    const r = await kvCall('file-save', { path: fp.file, text: fp.edit, base: fp.base });
    if (r.status !== 200) return kvToast((r.json && r.json.error) || 'A mentés nem sikerült (' + r.status + ')');
    if (r.json.dryRun) return kvToast('Próba: mentés ide ' + r.json.path + ', másolat: ' + r.json.safety);
    Object.assign(fp, { text: fp.edit, base: r.json.hash, edit: null });
    kvToast('Mentve. A régi változat: ' + r.json.safety);
    fpShow('view');
  };
}
