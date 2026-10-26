// 20-dock.js — prompt dock and agent hall (live workspace P2, KV-07; report §5.6). The tools/prompts/*.txt
// cards sit in a dock, the .claude/agents/*.md subagents stand in a hall below them. Drag a card, or the
// selection (the "N kijelölve" chip), onto a building, a district or an agent: a Claude Code prompt opens
// pre-filled with the paths (claude-cli://…&q=…) — the user reads it and sends it; nothing is auto-sent.
// A card's <FAJL> / <UTVONAL> take the paths; its other placeholders (<FUNKCIO>, <CEL>, <NEV>) stay for
// the user to fill in. Cards and agents come from the segéd's catalog; from file:// the dock says why not.

const dock = { el: null, open: false, last: '', dry: false };   // dry: test hooks record the prompt, launch nothing
const DOCK_MIME = 'text/x-kodvaros';
const DOCK_PATH_SLOTS = /<FAJL>|<UTVONAL>/g;

// a card's text with the paths in it: into its path placeholders, else listed after it
function dockFill(text, paths) {
  const list = paths.join(', ');
  if (/<FAJL>|<UTVONAL>/.test(text)) return text.replace(DOCK_PATH_SLOTS, () => list).trim();
  return selPrompt(text.trim(), paths);
}
const dockAgentHead = name => `Használd a(z) ${name} ügynököt (.claude/agents/${name}.md).`;

// what a drop asks: payload {kind:'card'|'sel', name}, onto {paths} (a building / district) or {agent}
function dockPrompt(payload, onto) {
  const cat = pal.cat || PAL_EMPTY;
  const card = payload.kind === 'card' ? cat.prompts.find(p => p.name === payload.name) : null;
  if (payload.kind === 'card' && !card) return '';
  if (onto.agent) {
    const head = dockAgentHead(onto.agent);
    return card ? head + '\n\n' + dockFill(card.text, selTargets()) : selPrompt(head + ' Ezekről a fájlokról van szó:');
  }
  if (card) return dockFill(card.text, onto.paths);
  // the selection dropped on a building: the selection, read in the light of that building
  return selPrompt(`Nézd meg ezeket a fájlokat, és mondd el, hogyan kapcsolódnak ehhez: ${onto.paths[0]}`, selTargets());
}
function dockSend(q) {
  if (!q) return;
  dock.last = q;
  if (dock.el) dock.el.dataset.last = q;   // test hook: tools/shot.js --dump-dom reads the last prompt
  if (!dock.dry) selAskClaude(q);
}

function dockRender() {
  const cat = pal.cat || PAL_EMPTY, el = dock.el;
  const why = kv.match ? '' : `<p class="dim">${esc(kv.on ? KV_WHY.other : KV_WHY.companion)}</p>`;
  el.innerHTML = '<h4>Promptkártyák <span class="dim">— húzd egy épületre vagy ügynökre</span></h4>' + why +
    cat.prompts.map(p => `<div class="kv-card" draggable="true" data-card="${esc(p.name)}" title="${esc(p.text.slice(0, 400))}">` +
      `${esc(p.name.replace(/^\d+-/, '').replace(/-/g, ' '))}<small>${esc(p.text.trim().split('\n').find(l => l && !/^=+/.test(l)) || '')}</small></div>`).join('') +
    '<h4>Ügynökcsarnok <span class="dim">— ide húzd a kártyát vagy a kijelölést</span></h4>' +
    (cat.agents.length ? cat.agents.map(a => `<div class="kv-agent" data-agent="${esc(a.name)}" title="${esc(a.description)}">` +
      `<span class="kv-fig" aria-hidden="true">◆</span>@${esc(a.name)}<small>${esc(a.description.slice(0, 120))}</small></div>`).join('')
      : `<p class="dim">${kv.match ? 'Nincs ügynök a .claude/agents mappában.' : 'Az ügynökök a segéddel jönnek.'}</p>`);
}
async function dockToggle(force) {
  dock.open = force === undefined ? !dock.open : force;
  if (!dock.el) {
    dock.el = document.createElement('aside'); dock.el.id = 'dock';
    dock.el.addEventListener('dragstart', e => {
      const c = e.target.closest('[data-card]');
      if (!c) return;
      e.dataTransfer.setData(DOCK_MIME, JSON.stringify({ kind: 'card', name: c.dataset.card }));
      e.dataTransfer.effectAllowed = 'copy';
    });
    dock.el.addEventListener('dragover', e => { const a = e.target.closest('[data-agent]'); if (a && e.dataTransfer.types.includes(DOCK_MIME)) { e.preventDefault(); a.classList.add('over'); } });
    dock.el.addEventListener('dragleave', e => { const a = e.target.closest('[data-agent]'); if (a) a.classList.remove('over'); });
    dock.el.addEventListener('drop', e => {
      const a = e.target.closest('[data-agent]'), raw = e.dataTransfer.getData(DOCK_MIME);
      if (!a || !raw) return;
      e.preventDefault(); e.stopPropagation(); a.classList.remove('over');
      dockSend(dockPrompt(JSON.parse(raw), { agent: a.dataset.agent }));
    });
    document.body.append(dock.el);
  }
  dock.el.hidden = !dock.open;
  $('dock-btn').classList.toggle('on', dock.open);
  if (dock.open) { await palCatalog(); dockRender(); }
}

// the selection chip in the selection bar is draggable too (19-select draws the bar)
addEventListener('dragstart', e => {
  if (!e.target.closest || !e.target.closest('#sel-bar b')) return;
  e.dataTransfer.setData(DOCK_MIME, JSON.stringify({ kind: 'sel' }));
  e.dataTransfer.effectAllowed = 'copy';
});
// onto the city: the building or district under the pointer lights up while dragging
canvas.addEventListener('dragover', e => {
  if (!e.dataTransfer.types.includes(DOCK_MIME)) return;
  e.preventDefault(); e.stopPropagation();
  const hit = pickAt(e);
  setHover(hit && hit.file ? hit.i : -1);
});
canvas.addEventListener('drop', e => {
  const raw = e.dataTransfer.getData(DOCK_MIME);
  if (!raw) return;
  e.preventDefault(); e.stopPropagation();
  const hit = pickAt(e);
  if (!hit) return kvToast('Egy épületre vagy körzetre ejtsd');
  const c = kvCtx(hit);
  dockSend(dockPrompt(JSON.parse(raw), { paths: [c.rel || '.'] }));
});
$('dock-btn').onclick = () => dockToggle();
