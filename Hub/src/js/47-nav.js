// Pointer + keyboard on the board: click, right-click / long-press, arrow focus, tooltip, Ctrl+K.

const KP_LONGPRESS = 500, KP_TIP_DELAY = 400;
const KP_NOCLICK = ['origin', 'band', 'dept', 'more'];

function kpNodeAt(target) {
  const g = target.closest && target.closest('#kpCam .kp-node');
  return g ? g.dataset.id : null;
}

function kpSetFocusNode(id) {
  kpBoard.focusId = id;
  for (const g of document.querySelectorAll('#kpCam .kp-focused')) g.classList.remove('kp-focused');
  const g = id && document.querySelector('#kpCam [data-id="' + CSS.escape(id) + '"]');
  if (g) g.classList.add('kp-focused');
}

// nearest node in a direction: alignment cubed beats distance; half-plane fallback (as in MindMap)
function kpHop(dx, dy) {
  const nodes = kpBoard.layout.nodes.filter(n => !['origin', 'band'].includes(n.kind));
  let from = nodes.find(n => n.id === kpBoard.focusId);
  if (!from) { from = nodes.find(n => n.kind === 'program') || nodes[0]; kpSetFocusNode(from.id); kpKeepInView(from); return; }
  const cx = from.x + from.w / 2, cy = from.y + from.h / 2;
  let best = null, wide = null;
  for (const m of nodes) {
    if (m.id === from.id) continue;
    const vx = m.x + m.w / 2 - cx, vy = m.y + m.h / 2 - cy, d = Math.hypot(vx, vy);
    if (d < 1) continue;
    const cos = (vx * dx + vy * dy) / d;
    if (cos <= 0.08) continue;
    const score = d / Math.pow(Math.max(cos, 0.12), 3);
    if (!wide || score < wide.score) wide = { n: m, score };
    if (cos >= 0.5 && (!best || score < best.score)) best = { n: m, score };
  }
  const t = best || wide;
  if (!t) return;
  kpSetFocusNode(t.n.id);
  kpKeepInView(t.n);
}

function kpKeepInView(n) {
  const r = document.getElementById('kpBoard').getBoundingClientRect(), c = kpBoard.cam;
  const sx = n.x * c.k + c.x, sy = n.y * c.k + c.y;
  if (sx < 40 || sy < 40 || sx + n.w * c.k > r.width - 40 || sy + n.h * c.k > r.height - 40) kpCenterOn(n.x + n.w / 2, n.y + n.h / 2, Math.max(c.k, 0.6));
}

// ---- tooltip
let kpTipTimer = null;
function kpTipHide() { clearTimeout(kpTipTimer); const t = document.getElementById('kpTip'); if (t) t.remove(); }
function kpTipShow(id, x, y) {
  const c = kpCtx(id);
  if (!c || ['origin', 'band'].includes(c.node.kind)) return;
  const n = c.node, s = n.src || {};
  const text = n.kind === 'program' ? c.prog.d : n.kind === 'dept' ? (kpData.topology.departments.find(d => d.id === n.dept) || {}).d
    : n.kind === 'roadmap' ? s.t : s.d || n.full;
  const t = kpTarget(c);
  const where = t.href ? t.href.replace(/^https?:\/\//, '') : t.path || (n.kind === 'dept' ? 'kattintás: össze/kinyit · dupla: Fókusz' : '');
  const lock = n.kind === 'program' ? (kpL1Open() ? null : 'gate') : n.layer && n.kind !== 'roadmap' ? kpLayerLock(n.layer) : null;
  const tip = kpEl('div', { id: 'kpTip', class: 'kp-tip', role: 'tooltip' },
    kpEl('div', { class: 'kp-tip-t' }, n.full || n.title.join(' ')), text ? kpEl('div', {}, text) : null,
    where ? kpEl('div', { class: 'kp-tip-w' }, '→ ' + where) : null,
    lock === 'gate' ? kpEl('div', { class: 'kp-tip-lock' }, '⛔ ' + kpL1Why()) : lock ? kpEl('div', { class: 'kp-tip-lock' }, '🔒 Előbb lépj be: ' + lock) : null);
  document.body.append(tip);
  tip.style.left = Math.min(x + 14, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = Math.min(y + 18, innerHeight - tip.offsetHeight - 8) + 'px';
}

function kpNavInit() {
  const svg = document.getElementById('kpBoard');
  let press = null, tipFor = null, moved = false, downAt = null;

  svg.addEventListener('pointerdown', e => {
    downAt = { x: e.clientX, y: e.clientY };
    moved = false;
    kpTipHide();
    if (e.pointerType === 'touch') {
      const id = kpNodeAt(e.target);
      if (id) press = setTimeout(() => { press = 'fired'; kpMenuOpen(id, e.clientX, e.clientY); }, KP_LONGPRESS);
    }
  });
  svg.addEventListener('pointermove', e => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) { moved = true; if (press && press !== 'fired') { clearTimeout(press); press = null; } }
    const id = kpNodeAt(e.target);
    if (id !== tipFor) {
      kpTipHide();
      tipFor = id;
      if (id && e.pointerType !== 'touch') kpTipTimer = setTimeout(() => kpTipShow(id, e.clientX, e.clientY), KP_TIP_DELAY);
    }
  });
  svg.addEventListener('pointerleave', () => { tipFor = null; kpTipHide(); });
  svg.addEventListener('pointerup', () => { if (press && press !== 'fired') clearTimeout(press); downAt = null; });

  svg.addEventListener('click', e => {
    if (press === 'fired') { press = null; return; }
    press = null;
    if (moved || e.button !== 0) return;
    const id = kpNodeAt(e.target);
    if (!id) { kpPopoverClose(); kpMenuClose(); return; }
    const n = kpBoard.layout.nodes.find(x => x.id === id);
    kpSetFocusNode(id);
    if (n && !KP_NOCLICK.includes(n.kind)) kpMainAction(n);
  });
  svg.addEventListener('contextmenu', e => {
    e.preventDefault();
    const id = kpNodeAt(e.target);
    kpTipHide();
    if (id) { kpSetFocusNode(id); kpMenuOpen(id, e.clientX, e.clientY); }
  });

  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#kpMenu')) kpMenuClose();
    if (!e.target.closest('#kpPop') && !e.target.closest('#kpBoard')) kpPopoverClose();
  });

  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); kpSearchOpen(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const menu = document.getElementById('kpMenu');
    if (menu) { kpMenuKeys(e, menu); return; }
    if (e.key === 'Escape') {
      if (document.getElementById('kpModal').children.length) { kpModalClose(); e.stopImmediatePropagation(); return; }
      if (document.getElementById('kpPop')) { kpPopoverClose(); e.stopImmediatePropagation(); return; }
      if (!document.getElementById('kpDrawer').hidden) { kpDrawerClose(); e.stopImmediatePropagation(); return; }
    }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.key]) { e.preventDefault(); kpHop(...dirs[e.key]); return; }
    const n = kpBoard.focusId && kpBoard.layout.nodes.find(x => x.id === kpBoard.focusId);
    if (!n) return;
    if (e.key === 'Enter') { e.preventDefault(); if (n.kind === 'dept') kpHeaderClick(n.dept); else if (!KP_NOCLICK.includes(n.kind)) kpMainAction(n); }
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const r = kpNodeScreenRect(n);
      kpMenuOpen(n.id, r.left + 12, r.bottom + 4);
    }
  }, true);
}

function kpMenuKeys(e, menu) {
  const items = [...menu.querySelectorAll(':scope > .kp-mi')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { kpMenuClose(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const step = e.key === 'ArrowDown' ? 1 : -1;
    let j = i;
    do { j = (j + step + items.length) % items.length; } while (items[j].classList.contains('off') && j !== i);
    items[j].focus();
  } else if (e.key === 'Enter' && i >= 0) items[i].click();
  else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}
