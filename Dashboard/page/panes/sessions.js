// sessions.js — Munkamenetek (WP-50): the local Claude Code sessions of account A and B, newest first, and the ways to open one here:
//   Folytatás (--resume in an embedded Claude terminal, in the session's own folder) · Másolat (--fork-session: a new id, the old one
//   untouched; the only way while the session is live in another window) · Távvezérlés (resumed with /remote-control, so it shows on
//   claude.ai/code too) · Vászon (the Munkavászon on this session). The bar: Felhő (claude.ai/code in a browser pane), Áthozás (a Claude
//   terminal with --teleport: the cloud picker), Frissítés. The list refreshes every 20 s while the pane is shown.
// WP-51: Tábla ⇄ Lista — the Munkamenetek board is a Lap of the Desktop (4 × 4) with board labels on, the Vezérlő across the top; the
// button opens it (made once) or goes back to the Munkapad. Gyors elérés: a right-side panel (shared/sidepanel, the Planner's side panel
// as a plug-in) with the related tools as catalog ids, opened through VRGDesk.open (simple mode: 6, detailed: all).
// VRGPanes.sessions = { mount(el, state, api), unmount(), state() }. The page names an account and a session id; main does the rest
// (shell/lib/sessions.js). State { account: 'all'|'A'|'B', q } is kept; the list itself is not.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const P = W.VRGPanes = W.VRGPanes || {};
  const REFRESH_MS = 20000;

  // ------------------------------------------------------------ pure helpers (exported for tests)
  // how long ago, in Hungarian: "most", "5 perce", "3 órája", "tegnap", "4 napja", then the date
  function ago(ms, now) {
    const d = Math.max(0, (Number(now) || 0) - (Number(ms) || 0));
    const min = Math.floor(d / 60000);
    if (min < 1) return 'most';
    if (min < 60) return min + ' perce';
    const h = Math.floor(min / 60);
    if (h < 24) return h + ' órája';
    const days = Math.floor(h / 24);
    if (days === 1) return 'tegnap';
    if (days < 7) return days + ' napja';
    const t = new Date(Number(ms) || 0), pad = n => String(n).padStart(2, '0');
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }
  const sizeText = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((Number(n) || 0) / 1024)) + ' KB');
  // the saved state → a clean one
  function cleanState(s) {
    const account = s && ['A', 'B'].includes(s.account) ? s.account : 'all';
    const q = s && typeof s.q === 'string' ? s.q.slice(0, 80) : '';
    return { account, q };
  }
  // rows shown for a filter: the account, then every word of q in the title, project, branch or id (case-insensitive)
  function filterRows(rows, f) {
    const st = cleanState(f);
    const words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    return (Array.isArray(rows) ? rows : []).filter(r => {
      if (!r || (st.account !== 'all' && r.account !== st.account)) return false;
      const hay = [r.title, r.project, r.branch, r.session].join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }
  // which buttons a row has: a live session cannot be continued here (two processes on one transcript), only copied
  const actionsFor = r => (r && r.live ? ['fork', 'canvas'] : ['resume', 'stronger', 'fork', 'remote', 'canvas']);
  // the account the bar's Áthozás uses: the filter's, else A
  const teleportAccount = f => (cleanState(f).account === 'B' ? 'B' : 'A');
  // Gyors elérés: the tools around a Claude session, as catalog ids (launcher/vrg-catalog.json); simple mode shows the first six
  const QUICK = [
    ['munkavaszon', 'Munkavászon', 'MV', 'The session drawn live (Session Canvas)'],
    ['trace', 'Ügynöknyom', 'ÜN', 'Agent trace (Varler Console)'],
    ['gitlog', 'Napló', 'NA', 'Git log of the work lines'],
    ['divergence', 'Divergencia', 'DV', 'Divergence board: what drifted'],
    ['stack', 'Rétegverem', 'RV', 'VRG Stack search'],
    ['layer.l', 'Vonaltérkép', 'VT', 'Dev lines map'],
    ['layer.u', 'Futásnapló', 'FN', 'Runs (agent and session runs)'],
    ['layer.a', 'Vezérlőterem', 'VZ', 'Control room'],
    ['layer.q', 'Döntésnapló', 'DN', 'Decision log'],
    ['threadboard', 'Thread Board', 'TB', 'Thread Board'],
    ['context', 'Kontextuscsomag', 'KC', 'Build a context pack for a session'],
    ['chat', 'Claude oldalchat', 'CH', 'Claude side chat'],
    ['go', 'GO kódszavak', 'GO', 'Codephrases and work lines'],
    ['prompts', 'Promptok', 'PR', 'Prompt library'],
  ];
  const quickItems = () => QUICK.map(([id, label, icon, title], i) => ({ id, label, icon, title, level: i < 6 ? 'simple' : 'detailed' }));

  const helpers = { ago, sizeText, cleanState, filterRows, actionsFor, teleportAccount, quickItems, REFRESH_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------ the pane
  const el = (tag, role, text, title) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text != null) e.textContent = text; if (title) e.title = title; return e; };
  const btn = (role, text, title, fn) => { const b = el('button', role, text, title); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const ACT = {
    resume: ['Folytatás', 'Continue here: claude --resume, in the session\'s folder'],
    fork: ['Másolat', 'Continue a copy: claude --resume --fork-session (a new session id)'],
    stronger: ['Erősebb modellel', 'Continue here on opus (claude --resume --model opus): when a cheaper model got stuck'],
    remote: ['Távvezérlés', 'Continue here with /remote-control, so it also shows on claude.ai/code'],
    canvas: ['Vászon', 'Open the Munkavászon on this session'],
  };

  P.sessions = {
    helpers,
    mount(root, state, api) {
      this.root = root; this.vrg = (api && api.vrg) || W.vrg; this.gone = false;
      this.f = cleanState(state); this.rows = []; this.cloud = ''; this.busy = '';
      root.innerHTML = '';
      root.dataset.role = 'sessions';
      root.title = 'Claude sessions';
      const main = this.mainEl = el('div', 'sess-main');
      const bar = el('div', 'bar');
      this.acc = el('select', 'account', null, 'Account');
      for (const [v, t] of [['all', 'Mind'], ['A', 'A fiók'], ['B', 'B fiók']]) { const o = el('option', null, t); o.value = v; this.acc.append(o); }
      this.acc.value = this.f.account;
      this.acc.addEventListener('change', () => { this.f.account = this.acc.value; this.draw(); });
      this.q = el('input', 'filter', null, 'Filter: title, project, branch, id');
      this.q.type = 'search'; this.q.placeholder = 'Szűrés…'; this.q.value = this.f.q; this.q.maxLength = 80;
      this.q.addEventListener('input', () => { this.f.q = this.q.value; this.draw(); });
      bar.append(el('h3', 'title', 'Munkamenetek', 'Claude sessions'), this.acc, this.q,
        btn('cloud', 'Felhő', 'claude.ai/code in a browser pane: the cloud sessions and every Remote Control session', () => this.openCloud()),
        btn('teleport', 'Áthozás', 'Pull a cloud session down into a Claude terminal here (claude --teleport)', () => this.teleport()),
        this.boardBtn = btn('board', 'Tábla', 'Munkamenet-tábla: a Lap 4 × 4-es rácsán, címkékkel / the session board', () => this.toggleBoard()),
        btn('refresh', 'Frissítés', 'Refresh', () => this.load()));
      this.msg = el('p', 'msg'); this.msg.hidden = true;
      this.list = el('div', 'rows');
      main.append(bar, this.msg, this.list);
      root.append(main);
      this.side = null;
      if (W.VRGSidePanel && W.VRGSidePanel.create) {
        try {
          const D = () => W.VRGDesk;
          // a narrow pane (the board's left column) starts with the panel folded to its icon rail, so the list keeps its width
          this.side = W.VRGSidePanel.create(root, { side: 'right', title: 'Gyors elérés', titleEn: 'Quick access', width: 220, persistKey: 'sessions', mode: 'simple',
            collapsed: (root.clientWidth || 0) > 0 && root.clientWidth < 560,
            modules: [W.VRGSidePanel.modules.links(quickItems().map(q => ({ ...q, run: () => { if (D() && D().open) D().open(q.id); else this.say('A VRG Asztal nem érhető el.', true); } })), { id: 'gyors', title: 'Kapcsolódó eszközök', icon: 'GY' })] });
        } catch (e) { this.side = null; }
      }
      this.paintBoard();
      this.timer = setInterval(() => { if (this.root && this.root.isConnected && !document.hidden) this.load(); }, REFRESH_MS);
      this.load();
    },
    unmount() { clearInterval(this.timer); if (this.side) { try { this.side.destroy(); } catch (e) {} this.side = null; } if (this.root) this.root.innerHTML = ''; this.root = null; this.gone = true; },
    // on the session board the button goes back to the Munkapad, elsewhere it opens the board
    onBoardNow() { const S = W.VRGSheets; if (!S || !S.doc) return false; const d = S.doc(); const s = d.sheets.find(x => x.id === d.active); return !!(s && s.board && s.board.kind === 'sessions'); },
    paintBoard() { if (this.boardBtn) { const on = this.onBoardNow(); this.boardBtn.textContent = on ? 'Lista' : 'Tábla'; this.boardBtn.dataset.on = on ? '1' : ''; } },
    async toggleBoard() {
      const S = W.VRGSheets;
      if (!S || !S.sessionBoard) { this.say('A Lapok nem érhetők el ebben a nézetben.', true); return; }
      if (this.onBoardNow()) S.showTree(); else await S.sessionBoard();
      this.paintBoard();
    },
    state() { return { ...this.f }; },

    say(text, bad) { if (!this.msg) return; this.msg.hidden = !text; this.msg.textContent = text || ''; this.msg.dataset.bad = bad ? '1' : ''; },

    async load() {
      const v = this.vrg;
      if (!v || !v.sessions) { this.say('Ebben a változatban nincs Munkamenetek szolgáltatás.', true); return; }
      const r = await v.sessions.list();
      if (this.gone) return;
      if (!r || r.ok === false) { this.say((r && r.hu) || 'A munkamenetek nem olvashatók.', true); return; }
      this.rows = Array.isArray(r.sessions) ? r.sessions : [];
      this.cloud = typeof r.cloud === 'string' ? r.cloud : '';
      this.roots = Array.isArray(r.roots) ? r.roots : [];
      this.draw();
    },

    async act(kind, row) {
      const v = this.vrg;
      this.busy = row.account + ':' + row.session + ':' + kind; this.draw();
      let r;
      if (kind === 'canvas') r = await v.sessions.canvas(row.account, row.session);
      else r = await v.sessions.resume(row.account, row.session, { fork: kind === 'fork', remote: kind === 'remote', stronger: kind === 'stronger' });
      if (this.gone) return;
      this.busy = '';
      if (r && r.ok === false) this.say(r.hu || 'Nem sikerült.', true);
      else if (kind === 'canvas' && r && r.url && W.VRGFrame && W.VRGFrame.openUrl) { W.VRGFrame.openUrl(r.url); this.say(''); }
      else this.say('');
      if (r && r.err === 'live') this.load();
      else this.draw();
    },
    async teleport() {
      const r = await this.vrg.sessions.teleport(teleportAccount(this.f));
      if (!this.gone) this.say(r && r.ok === false ? (r.hu || 'Nem sikerült.') : '', !!(r && r.ok === false));
    },
    openCloud() {
      if (this.cloud && W.VRGFrame && W.VRGFrame.openUrl) { W.VRGFrame.openUrl(this.cloud); this.say(''); }
      else this.say('A böngésző panel nem érhető el.', true);
    },

    draw() {
      if (!this.root) return;
      this.paintBoard();
      const now = Date.now();
      const rows = filterRows(this.rows, this.f);
      this.list.replaceChildren();
      if (!rows.length) {
        const none = this.rows.length ? 'Nincs találat.' : (this.roots && this.roots.length ? 'Nincs helyi munkamenet.' : 'Nincs Claude Code beállítási mappa (A: ~/.claude, B: home\\claude-account-b).');
        this.list.append(el('p', 'none', none));
        return;
      }
      for (const r of rows) {
        const row = el('div', 'row'); row.dataset.account = r.account; row.dataset.session = r.session; if (r.live) row.dataset.live = '1';
        const head = el('div', 'head');
        head.append(el('span', 'acc', r.account, 'Account ' + r.account), el('span', 'when', ago(r.mtime, now), new Date(r.mtime).toLocaleString()));
        if (r.live) head.append(el('span', 'live', 'ÉLŐ', 'Written in the last minutes: probably open in another window'));
        head.append(el('span', 'name', r.title || r.session.slice(0, 8), r.session));
        const meta = el('small', 'meta', [r.project || '?', r.branch, sizeText(r.size)].filter(Boolean).join(' · '));
        const acts = el('div', 'acts');
        for (const k of actionsFor(r)) {
          const b = btn(k, ACT[k][0], ACT[k][1], () => this.act(k, r));
          if (this.busy === r.account + ':' + r.session + ':' + k) { b.disabled = true; b.textContent = '…'; }
          acts.append(b);
        }
        row.append(head, meta, acts);
        this.list.append(row);
      }
    },
  };
})();
