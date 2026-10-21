// Info drawer: Rövid / Részletes tabs, HU then EN, the node's links.

const KP_KIND_LABEL = { program: 'Program', folder: 'Megosztott mappa', local: 'Helyi mappa', agent: 'AI dokumentum', go: 'GO brief',
  git: 'Git', roadmap: 'Ütemterv', dept: 'Részleg', slot: 'Üres hely', summary: 'Összecsukott részleg' };

function kpDrawerClose() {
  const d = document.getElementById('kpDrawer');
  d.hidden = true;
  d.replaceChildren();
}

function kpDrawerOpen(nodeId, tab) {
  const c = kpCtx(nodeId);
  if (!c) return;
  kpMenuClose();
  kpPopoverClose();
  const n = c.node, p = c.prog, s = n.src || {};
  const dept = (kpData.topology.departments || []).find(d => d.id === n.dept);
  const isProg = n.kind === 'program';
  const short = isProg ? [p.d, p.dEn] : n.kind === 'dept' ? [dept.d, dept.dEn] : n.kind === 'roadmap' ? [s.t, null] : [s.d, s.dEn];
  const long = isProg ? [p.long || p.d, p.longEn || (p.long ? null : p.dEn)] : short;

  const html = (hu, en) => {
    const box = kpEl('div', { class: 'kp-md' });
    box.innerHTML = (hu ? '<div class="kp-hu">' + kpMd(hu) + '</div>' : '<div class="kp-muted">Nincs leírás.</div>') +
      (en ? '<div class="kp-en">' + kpMd(en) + '</div>' : '');
    return box;
  };
  const body = kpEl('div', { class: 'kp-drawer-body' });
  const tabs = kpEl('div', { class: 'kp-tabs', role: 'tablist' });
  const show = t => {
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === t);
    body.replaceChildren(t === 'log' ? kpDrawerLogs(p.id) : t === 'long' ? html(long[0], long[1]) : html(short[0], short[1]));
    body.dataset.tab = t;
  };
  tabs.append(...[
    kpEl('button', { role: 'tab', 'data-tab': 'short', onclick: () => show('short') }, 'Rövid'),
    kpEl('button', { role: 'tab', 'data-tab': 'long', onclick: () => show('long') }, 'Részletes'),
    isProg ? kpEl('button', { role: 'tab', 'data-tab': 'log', onclick: () => show('log') }, 'Napló' + (kpLogsFor(p.id).length ? ' (' + kpLogsFor(p.id).length + ')' : '')) : null
  ].filter(Boolean));

  const title = isProg ? p.t : n.kind === 'dept' ? dept.t : (n.full || n.title.join(' '));
  const meta = [KP_KIND_LABEL[n.kind] || n.kind, dept ? dept.t : null,
    isProg ? KP_STATUS_HU[p.status] : null, n.kind === 'roadmap' ? kpFmtDate(s.date) : null].filter(Boolean).join(' · ');

  const links = kpDrawerLinks(c);
  const claim = p && p.claim ? kpEl('div', { class: 'kp-claim' }, '⚑ ' + p.claim.by + ' foglalja ' + kpFmtDate(p.claim.until) + '-ig' + (p.claim.note ? ' — ' + p.claim.note : '')) : null;

  const d = document.getElementById('kpDrawer');
  d.replaceChildren(...[
    kpEl('div', { class: 'kp-drawer-head' },
      kpEl('div', {}, kpEl('div', { class: 'kp-drawer-t' }, title), kpEl('div', { class: 'kp-muted' }, meta)),
      kpEl('button', { class: 'kp-x', title: 'Bezárás (Esc)', onclick: kpDrawerClose }, '×')),
    claim, tabs, body, links].filter(Boolean));
  d.hidden = false;
  show(tab === 'long' ? 'long' : 'short');
}

function kpDrawerLinks(c) {
  const p = c.prog;
  const rows = [];
  const ctx = { repo: kpData.topology.repo, localRoot: kpLocalRoot() };
  const add = (label, href, path) => rows.push(href
    ? kpEl('li', {}, kpEl('a', { href, target: '_blank', rel: 'noopener' }, label))
    : kpEl('li', {}, label + ' — ', kpEl('code', { class: 'kp-path' }, path || 'nincs még link')));
  const t = kpTarget(c);
  if (t.href) add('Megnyitás' + (t.kind === 'repo-tool' ? ' a GitHubon' : ''), t.href);
  if (p && c.node.kind === 'program') {
    for (const f of kpResolveRefs(kpData.topology).programs.find(x => x.id === p.id).folders || []) {
      const l = f.url ? { href: f.url } : f.local ? kpLinkFor({ local: f.local }, ctx) : {};
      add('☁ ' + (f.t || f.path), l.href, l.path);
    }
    for (const a of p.agent || []) { const l = a.repo ? kpLinkFor({ repo: a.repo }, ctx) : {}; add('🤖 ' + a.t, l.href, a.local); }
    for (const g of (p.git && p.git.paths) || []) add('⎇ ' + g, kpLinkFor({ repo: g }, ctx).href);
  }
  if (!rows.length) return null;
  return kpEl('div', { class: 'kp-drawer-links' }, kpEl('div', { class: 'kp-drawer-sub' }, 'Linkek'), kpEl('ul', {}, ...rows));
}

function kpDrawerLogs(progId) {
  const list = kpLogsFor(progId);
  if (!list.length) return kpEl('div', { class: 'kp-muted' }, 'Még nincs napló ehhez a programhoz. 📝 Munkanapló — vagy Importálás… a meglévőkhöz.');
  return kpEl('div', { class: 'kp-logs' }, ...list.map(l => {
    const e = l.entry, box = kpEl('div', { class: 'kp-md' });
    box.innerHTML = KP_LOG_SECTIONS.filter(([k]) => e[k]).map(([k, h]) => '<h5>' + kpEsc(h) + '</h5>' + kpMd(e[k])).join('');
    return kpEl('details', { class: 'kp-log-e' }, kpEl('summary', {}, kpFmtDate(e.date) + ' · ' + e.by + (l.remote ? ' · GitHub' : ' · beolvasva')), box);
  }));
}
