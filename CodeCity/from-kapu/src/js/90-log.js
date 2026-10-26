// Munkanapló: a form -> a markdown file in the fixed template (03_UI §6), and back.
// Outputs: download · target folder (L6) · GitHub Hub/logs/ · the shared OneDrive folder.

const KP_LOG_TYPE = 'vrg-munkanaplo/1';
const KP_LOG_DIR = 'Hub/logs';
const KP_LOG_EMPTY = '—';
const KP_LOG_DRAFT_MS = 5000;
const KP_LOG_SECTIONS = [['did', 'Mit csináltam'], ['open', 'Félkész / nyitott'], ['next', 'Következő lépés'], ['questions', 'Kérdések'], ['links', 'Linkek']];

// entry: { date, by, programs: [id], did, open, next, questions, links, extra: [{ h, text }] }
function kpLogToMd(e) {
  const sec = (h, text) => '## ' + h + '\n' + (String(text || '').trim() || KP_LOG_EMPTY) + '\n';
  return '---\ntype: ' + KP_LOG_TYPE + '\ndate: ' + e.date + '\nby: ' + e.by + '\nprograms: [' + (e.programs || []).join(', ') + ']\n---\n' +
    '# Munkanapló — ' + e.date + ' — ' + e.by + '\n\n' +
    KP_LOG_SECTIONS.map(([k, h]) => sec(h, e[k])).join('') +
    (e.extra || []).map(x => sec(x.h, x.text)).join('');
}

function kpMdToLog(text) {
  const src = String(text).replace(/\r/g, '');
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (fm) for (const line of fm[1].split('\n')) { const m = line.match(/^(\w+):\s*(.*)$/); if (m) meta[m[1]] = m[2]; }
  const e = { date: meta.date || '', by: meta.by || '',
    programs: (meta.programs || '').replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean) };
  for (const [k] of KP_LOG_SECTIONS) e[k] = '';
  e.extra = [];
  const body = fm ? src.slice(fm[0].length) : src;
  const parts = body.split(/^## /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const h = (nl < 0 ? p : p.slice(0, nl)).trim();
    let t = (nl < 0 ? '' : p.slice(nl + 1)).replace(/\n+$/, '');
    if (t === KP_LOG_EMPTY) t = '';
    const known = KP_LOG_SECTIONS.find(([, title]) => title === h);
    if (known) e[known[0]] = t; else e.extra.push({ h, text: t });
  }
  return e;
}

// "Födém toll finomítása a CLA nappaliban" -> "fodem-toll-finomitasa-a-cla"
function kpLogSlug(text) {
  const words = kpNorm(text).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 5);
  return words.join('-') || 'naplo';
}
function kpLogName(e, existing) {
  const base = e.date + '_' + e.by + '_' + kpLogSlug(e.did);
  const taken = new Set(existing || []);
  let name = base + '.md', i = 2;
  while (taken.has(name)) name = base + '-' + i++ + '.md';
  return name;
}

// "ma" / "tegnap" / "3 napja"
function kpRelDay(date, today) {
  const d = Math.round((Date.parse(today) - Date.parse(date)) / 864e5);
  return d <= 0 ? 'ma' : d === 1 ? 'tegnap' : d + ' napja';
}

// ---- page side
const kpLogs = () => kpStore.get('logs', []);   // imported: [{ name, entry }]

function kpLogBlank(progId) {
  return { date: kpToday(), by: kpGh.login || '', programs: progId ? [progId] : [], did: '', open: '', next: '', questions: '', links: '', extra: [] };
}

let kpLogTimer = null;
function kpLogOpen(progId) {
  const draft = kpStore.get('logDraft', null);
  const e = draft && (!progId || draft.programs.includes(progId)) ? draft : Object.assign(kpLogBlank(progId), draft && progId ? { programs: [progId] } : {});
  if (progId && !e.programs.includes(progId)) e.programs.push(progId);
  const by = kpEl('input', { class: 'kp-in', value: e.by, placeholder: 'GitHub név' });
  const date = kpEl('input', { class: 'kp-in', type: 'date', value: e.date });
  const progs = (kpViewTopology().programs || []).filter(p => !p.hidden && p.status !== 'v2');
  const ticks = kpEl('div', { class: 'kp-log-progs' }, ...progs.map(p => kpEl('label', {}, kpEl('input', { type: 'checkbox', value: p.id, checked: e.programs.includes(p.id) }), ' ' + p.t)));
  const areas = {};
  const rows = KP_LOG_SECTIONS.map(([k, h]) => { areas[k] = kpEl('textarea', { class: 'kp-in kp-ta', rows: k === 'did' ? 4 : 2 }); areas[k].value = e[k] || '';
    return kpEl('label', { class: 'kp-ed-row' }, kpEl('span', { class: 'kp-ed-l' }, h), areas[k]); });
  const read = () => {
    const x = { date: date.value || kpToday(), by: by.value.trim() || 'ismeretlen', programs: [...ticks.querySelectorAll('input:checked')].map(i => i.value), extra: e.extra || [] };
    for (const [k] of KP_LOG_SECTIONS) x[k] = areas[k].value;
    return x;
  };
  let discard = false;   // set once the entry is uploaded or thrown away: closing must not bring the draft back
  const saveDraft = () => { if (!discard) kpStore.set('logDraft', read()); };
  const drop = () => { discard = true; kpStore.set('logDraft', null); };
  clearInterval(kpLogTimer);
  kpLogTimer = setInterval(() => { if (!document.querySelector('.kp-log')) { clearInterval(kpLogTimer); return; } saveDraft(); }, KP_LOG_DRAFT_MS);
  const od = ((kpData.topology.onedrive || {}).folders || []).find(f => f.id === 'od-logs');
  const box = kpModalOpen('📝 Munkanapló',
    kpEl('div', { class: 'kp-pop-row' }, kpEl('span', { class: 'kp-ed-l' }, 'Ki'), by, kpEl('span', { class: 'kp-ed-l' }, 'Dátum'), date),
    kpEl('div', { class: 'kp-ed-l' }, 'Programok'), ticks, ...rows,
    kpEl('div', { class: 'kp-pop-row kp-wrap' },
      kpEl('button', { class: 'kp-btn', onclick: () => { const x = read(); kpDownload(kpLogName(x), kpLogToMd(x), 'text/markdown'); } }, 'Letöltés .md'),
      kpEl('button', { class: 'kp-btn', onclick: async () => { const x = read(); const r = await kpDest.write(kpLogName(x), kpLogToMd(x)); kpToast(r.ok ? 'Mentve: ' + r.name : r.error); } }, 'Mentés a célmappába'),
      kpEl('button', { class: 'kp-btn kp-primary', onclick: async () => { const r = await kpLogUpload(read()); if (r.ok) { drop(); kpModalClose(); } } }, 'Feltöltés GitHubra'),
      kpEl('button', { class: 'kp-btn', onclick: () => od && od.url ? kpOpen(od.url) : kpToast('Még nincs megosztási link — Szerkesztés') }, 'OneDrive mappa'),
      kpEl('button', { class: 'kp-btn', onclick: kpLogImport }, 'Importálás…'),
      kpEl('button', { class: 'kp-btn', onclick: () => { drop(); kpModalClose(); } }, 'Piszkozat törlése')));
  box.classList.add('kp-log');
  // closing in any way keeps the draft
  const root = document.getElementById('kpModal');
  const obs = new MutationObserver(() => { if (!root.contains(box)) { saveDraft(); obs.disconnect(); clearInterval(kpLogTimer); } });
  obs.observe(root, { childList: true, subtree: true });
  areas.did.focus();
}

function kpDownload(name, text, type) {
  const a = kpEl('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function kpLogUpload(e) {
  if (!kpCaps.ghWrite) { kpToast(KP_WHY.ghWrite); return { ok: false }; }
  const repo = kpData.topology.repo, base = '/repos/' + repo.owner + '/' + repo.name + '/contents/' + KP_LOG_DIR;
  const ls = await kpGhFetch(base + '?ref=main', { nocache: true });
  const names = ls.status === 200 && Array.isArray(ls.json) ? ls.json.map(f => f.name) : [];
  for (let tries = 0; tries < 3; tries++) {
    const name = kpLogName(e, names);
    const put = await kpGhFetch(base + '/' + encodeURIComponent(name), { method: 'PUT', body: {
      message: 'Munkanapló: ' + e.by + ' — ' + e.date + ' (' + (e.programs.join(', ') || '—') + ')', content: kpB64Utf8(kpLogToMd(e)), branch: 'main' } });
    if (put.status === 201 || put.status === 200) { kpToast('Feltöltve: ' + KP_LOG_DIR + '/' + name); return { ok: true, name }; }
    if (put.status === 422) { names.push(name); continue; }   // the name appeared in between
    kpToast('Feltöltés sikertelen (' + put.status + ') — a piszkozat megmaradt'); return { ok: false };
  }
  kpToast('Feltöltés sikertelen — a piszkozat megmaradt'); return { ok: false };
}

function kpLogImport() {
  const inp = kpEl('input', { type: 'file', accept: '.md,text/markdown', multiple: true });
  inp.addEventListener('change', async () => {
    const got = [];
    for (const f of inp.files) {
      const entry = kpMdToLog(await f.text());
      if (entry.date) got.push({ name: f.name, entry });
    }
    const merged = kpLogs().filter(l => !got.some(g => g.name === l.name)).concat(got);
    kpStore.set('logs', merged);
    kpRenderStrip();
    kpToast(got.length + ' napló beolvasva' + (got.length < inp.files.length ? ' (' + (inp.files.length - got.length) + ' nem napló formátumú)' : ''));
  });
  inp.click();
}

// logs that name a program, newest first: imported ones + the newest per user from GitHub
function kpLogsFor(progId) {
  const live = kpLive();
  const remote = live && live.latest ? Object.values(live.latest).map(x => ({ name: x.name, entry: x.entry, remote: true })) : [];
  return kpLogs().concat(remote).filter(l => l.entry.programs.includes(progId)).sort((a, b) => b.entry.date.localeCompare(a.entry.date));
}

// "Ki min dolgozik?": the newest log per user
function kpLogStrip() {
  const live = kpLive();
  const per = {};
  const consider = l => { const p = per[l.entry.by]; if (!p || l.entry.date > p.entry.date) per[l.entry.by] = l; };
  kpLogs().forEach(consider);
  if (live && live.latest) Object.values(live.latest).forEach(consider);
  const today = kpToday();
  const titles = Object.fromEntries((kpData.topology.programs || []).map(p => [p.id, p.t]));
  return Object.values(per).map(l => {
    const e = l.entry;
    const next = String(e.next || '').split('\n')[0];
    return kpEl('span', { class: 'kp-claim-s', title: next }, e.by + ': ' + (e.programs.map(id => titles[id] || id).join(', ') || '—') +
      (next ? ' — ' + kpCut(next, 40) : '') + ' (' + kpRelDay(e.date, today) + ')');
  });
}

function kpLogInit() {
  kpCaps.log = true;
  document.getElementById('kpLogBtn').addEventListener('click', () => kpLogOpen(null));
}

if (typeof module !== 'undefined') module.exports = { kpLogToMd, kpMdToLog, kpLogName, kpLogSlug, kpRelDay };
