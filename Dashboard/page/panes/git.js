// git.js — the Git pane (WP-31): repo picker, checkout + branch header, changed files with stage checkboxes, diff, commit message, new branch,
// guarded push (the branch name typed back), branches and worktrees. VRGPanes.git = { mount(el, state, api), unmount(), state() }.
// The page sends a repo id, file INDEXES of the last status reply and words: never a path. Paths shown here are display text only.
// The pure helpers are also exported for node --test (module.exports, only when `module` exists).
(function () {
  'use strict';

  // ------------------------------------------------------------ pure helpers
  const MAIN = ['main', 'master'];
  const KIND_HU = { new: 'új', modified: 'módosult', staged: 'előkészítve', renamed: 'átnevezve', deleted: 'törölve', conflict: 'ütközés' };

  // the class of one diff line: add / del / hunk / meta / ctx
  function diffClass(line) {
    const l = String(line);
    if (/^(\+\+\+|---|diff |index )/.test(l)) return 'meta';
    if (l.startsWith('@@')) return 'hunk';
    if (l[0] === '+') return 'add';
    if (l[0] === '-') return 'del';
    return 'ctx';
  }
  // what the push field must hold: the branch name, or the exact words for main
  const pushWord = branch => (MAIN.includes(branch) ? 'main PUSH' : branch);
  const isDesktopBranch = name => /^desktop-os\//.test(String(name));
  const api = { diffClass, pushWord, isDesktopBranch, KIND_HU };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined') return;

  // ------------------------------------------------------------ the pane
  const vrg = window.vrg;
  const el = (tag, attrs, text) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const section = (role, hu, en) => { const s = el('section', { 'data-role': role }); s.append(el('h4', { title: en }, hu)); return s; };

  const P = window.VRGPanes = window.VRGPanes || {};
  P.git = {
    mount(root, st) {
      this.root = root;
      this.repo = st && typeof st.repo === 'string' ? st.repo : '';
      const self = this;
      root.innerHTML = '';
      root.dataset.pane = root.dataset.pane || 'git';

      const picker = el('select', { 'data-role': 'git-repo', title: 'Repository' });
      const pickerLabel = el('label', { 'data-role': 'git-repo-label', title: 'Repository' }); pickerLabel.append(el('span', {}, 'Repó '), picker);
      const checkout = el('h3', { 'data-role': 'git-checkout', title: 'Checkout folder' });
      const head = el('p', { 'data-role': 'git-branch', title: 'Branch' });
      const msg = el('p', { 'data-role': 'git-msg' });

      const filesSec = section('git-files', 'Változott fájlok', 'Changed files');
      const fileList = el('ul', { 'data-role': 'git-filelist' }); filesSec.append(fileList);
      const diffSec = section('git-diff', 'Különbség', 'Diff');
      const diffBox = el('pre', { 'data-role': 'git-diffview' }); diffSec.append(diffBox);

      const commitSec = section('git-commit', 'Commit üzenet', 'Commit message');
      const text = el('textarea', { 'data-role': 'git-message', rows: '3', maxlength: '2000', title: 'Commit message' });
      const commitWarn = el('p', { 'data-role': 'git-commit-warn' }); commitWarn.hidden = true;
      const commitBtn = el('button', { type: 'button', 'data-role': 'git-commit-btn', title: 'Commit' }, 'Commit');
      commitSec.append(text, commitWarn, commitBtn);

      const actSec = el('section', { 'data-role': 'git-actions' });
      const newBranch = el('button', { type: 'button', 'data-role': 'git-newbranch', title: 'New branch' }, 'Új ág…');
      const branchName = el('input', { type: 'text', 'data-role': 'git-branchname', maxlength: '60', placeholder: 'ág-neve' }); branchName.hidden = true;
      const branchGo = el('button', { type: 'button', 'data-role': 'git-branchgo', title: 'Create the branch' }, 'Létrehoz'); branchGo.hidden = true;
      const pushBtn = el('button', { type: 'button', 'data-role': 'git-push', title: 'Push' }, 'Push…');
      const pushWordBox = el('input', { type: 'text', 'data-role': 'git-pushconfirm', maxlength: '80', placeholder: 'Írd be az ág nevét a megerősítéshez', title: 'Type the branch name to confirm' }); pushWordBox.hidden = true;
      const pushGo = el('button', { type: 'button', 'data-role': 'git-pushgo', title: 'Push now' }, 'Feltöltés'); pushGo.hidden = true;
      actSec.append(newBranch, branchName, branchGo, pushBtn, pushWordBox, pushGo);

      const brSec = section('git-branches', 'Ág', 'Branches');
      const brList = el('ul', { 'data-role': 'git-branchlist' }); brSec.append(brList);
      const wtSec = section('git-worktrees', 'Munkafák', 'Worktrees');
      const wtList = el('ul', { 'data-role': 'git-worktreelist' }); wtSec.append(wtList);

      root.append(el('h2', { title: 'Git' }, 'Git'), pickerLabel, checkout, head, msg, filesSec, diffSec, commitSec, actSec, brSec, wtSec);

      const boxes = [];                                   // [{ ix, box }] — the index is the position in the last status reply
      let current = { branch: '' };
      const say = (t, ok) => { msg.textContent = t || ''; msg.dataset.ok = ok ? '1' : '0'; };
      const fail = r => say((r && r.hu) || 'Hiba.', false);

      function showDiff(ix, cached) {
        diffBox.textContent = '';
        vrg.git.diff(self.repo, ix, cached).then(r => {
          if (!r || r.ok === false) return fail(r);
          const tone = { add: 'var(--mv-ok)', del: 'var(--mv-crit)', hunk: 'var(--mv-accent)', meta: 'var(--mv-dim)' };
          for (const line of String(r.diff).split('\n')) {
            const c = diffClass(line), s = el('span', { class: 'git-' + c, 'data-diff': c }, line);
            if (tone[c]) s.style.color = tone[c];
            diffBox.append(s, document.createTextNode('\n'));
          }
          if (r.truncated) diffBox.append(el('em', {}, '… (csonkolva)'));
        }).catch(() => {});
      }

      async function refresh() {
        if (!self.repo) return;
        const s = await vrg.git.status(self.repo);
        if (!s || s.ok === false) { fail(s); return; }
        current = s;
        checkout.textContent = s.checkout;
        head.textContent = 'Ág: ' + s.branch + (s.upstream ? ' → ' + s.upstream + ' (+' + s.ahead + ' / −' + s.behind + ')' : '');
        commitWarn.hidden = !MAIN.includes(s.branch);
        commitWarn.textContent = MAIN.includes(s.branch) ? 'Commit a main ágra' : '';
        fileList.innerHTML = ''; boxes.length = 0;
        s.files.forEach((f, ix) => {
          const li = el('li', { 'data-role': 'git-file', 'data-ix': String(ix), 'data-kind': f.kind });
          const box = el('input', { type: 'checkbox', 'data-role': 'git-stage', title: 'Stage' });
          const name = el('button', { type: 'button', 'data-role': 'git-filename', title: f.x + f.y }, f.path);
          name.addEventListener('click', () => showDiff(ix, f.kind === 'staged'));
          li.append(box, el('span', { 'data-role': 'git-kind' }, ' ' + (KIND_HU[f.kind] || f.kind) + ' '), name);
          fileList.append(li); boxes.push({ ix, box });
        });
        const b = await vrg.git.branches(self.repo);
        brList.innerHTML = '';
        for (const x of (b && b.branches) || []) {
          const li = el('li', { 'data-role': 'git-branchitem' }, (x.current ? '● ' : '') + x.name + (x.upstream ? ' → ' + x.upstream : ''));
          if (isDesktopBranch(x.name)) li.append(el('em', { title: 'merge: START → S or a terminal' }, ' merge: START → S vagy terminál'));
          brList.append(li);
        }
        const w = await vrg.git.worktrees(self.repo);
        wtList.innerHTML = '';
        for (const x of (w && w.worktrees) || []) wtList.append(el('li', { 'data-role': 'git-worktreeitem' }, x.path + ' · ' + (x.branch || (x.detached ? 'detached' : '')) + ' ' + x.head));
      }

      commitBtn.addEventListener('click', async () => {
        const ixs = boxes.filter(b => b.box.checked).map(b => b.ix);
        if (!ixs.length) return say('Jelölj ki fájlt.', false);
        const r = await vrg.git.commit(self.repo, ixs, text.value);
        if (!r || r.ok === false) return fail(r);
        text.value = ''; say('Commit kész: ' + r.sha, true); refresh();
      });
      newBranch.addEventListener('click', () => { branchName.hidden = branchGo.hidden = !branchName.hidden; });
      branchGo.addEventListener('click', async () => {
        const r = await vrg.git.branch(self.repo, branchName.value.trim(), true);
        if (!r || r.ok === false) return fail(r);
        branchName.value = ''; branchName.hidden = branchGo.hidden = true; say('Ág kész: ' + r.name, true); refresh();
      });
      pushBtn.addEventListener('click', () => {
        pushWordBox.hidden = pushGo.hidden = !pushWordBox.hidden;
        pushWordBox.title = 'Írd be: ' + pushWord(current.branch);
        pushWordBox.placeholder = MAIN.includes(current.branch) ? 'main PUSH' : 'Írd be az ág nevét a megerősítéshez';
      });
      pushGo.addEventListener('click', async () => {
        const r = await vrg.git.push(self.repo, pushWordBox.value);
        if (!r || r.ok === false) return fail(r);
        pushWordBox.value = ''; pushWordBox.hidden = pushGo.hidden = true; say(r.hu || 'Feltöltve.', true); refresh();
      });
      picker.addEventListener('change', () => { self.repo = picker.value; refresh(); });

      vrg.git.repos().then(r => {
        const list = (r && r.repos) || [];
        for (const x of list) picker.append(el('option', { value: x.id }, x.name));
        if (!list.some(x => x.id === self.repo)) self.repo = list.length ? list[0].id : '';
        picker.value = self.repo;
        refresh();
      }).catch(() => {});
    },
    unmount() { if (this.root) this.root.innerHTML = ''; this.root = null; },
    state() { return { repo: this.repo || '' }; },
  };
})();
