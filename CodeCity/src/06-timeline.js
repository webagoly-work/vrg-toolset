// 06-timeline.js — replay controls: Step / Play / Latest (God's Eye View's weather timeline verbs),
// speed, a scrubber over an activity strip, and the split-flap commit board.
// Keys: Space play/pause · ← → step · Home first commit · End now.

const tl = { playing: false, timer: 0, speed: 1 };
const SPEEDS = [1, 2, 4];
const AGENT_BAR = '#7dffb0', HUMAN_BAR = '#8fa6d8';   // the strip's bars: agent-assisted vs not

// base pause between commits: the whole history in ~25 s at 1×, never faster than 8 commits/s
const baseInterval = () => Math.max(120, Math.min(900, 25000 / Math.max(1, replay.last + 1)));

function tlStep(d) { tlPause(); applyTime(replay.T + d, 260); }
function tlLatest() { tlPause(); applyTime(replay.last, 260); }
function tlPlay() {
  if (tl.playing) return;
  if (replay.T >= replay.last) applyTime(0, 0);      // from the end, a play starts over
  tl.playing = true; $('tl-play').textContent = '⏸'; $('tl-play').title = 'Megállítás (Szóköz)';
  const tick = () => {
    if (!tl.playing) return;
    if (replay.T >= replay.last) { tlPause(); return; }
    const iv = baseInterval() / tl.speed;
    applyTime(replay.T + 1, Math.min(400, iv * 0.9));
    tl.timer = setTimeout(tick, iv);
  };
  tick();
}
function tlPause() {
  tl.playing = false; clearTimeout(tl.timer);
  $('tl-play').textContent = '▶'; $('tl-play').title = 'Lejátszás (Szóköz)';
}

// ---- split-flap board (after God's Eye View's splitFlap.js): changed characters spin through
// the alphabet and settle left to right; unchanged ones stay put. Reduced motion: plain text.
const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:·-/';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function flapTo(el, text, budget) {
  const from = el.dataset.text || '';
  el.dataset.text = text;
  cancelAnimationFrame(el._raf);
  if (reduceMotion.matches || !from) { el.textContent = text; return; }
  const len = Math.max(from.length, text.length), per = Math.max(4, Math.min(22, budget / (len + 6))), t0 = performance.now();
  const frame = now => {
    const settled = (now - t0) / per - 6;   // index up to which characters have landed
    let out = '';
    for (let i = 0; i < len; i++) {
      const to = text[i] || ' ', was = from[i] || ' ';
      out += i < settled || to === was ? to : FLAP[(Math.random() * FLAP.length) | 0];
    }
    el.textContent = out.trimEnd();
    if (settled < len) el._raf = requestAnimationFrame(frame); else el.textContent = text;
  };
  el._raf = requestAnimationFrame(frame);
  // a frame clock that stalls (background tab, headless capture) must not leave the board scrambled
  clearTimeout(el._land);
  el._land = setTimeout(() => { cancelAnimationFrame(el._raf); el.textContent = el.dataset.text; }, per * (len + 6) + 150);
}

function boardText() {
  const c = current.city.commits;
  if ((replay.T >= replay.last && !tl.playing) || !c.length) {
    return [`MOST · ${current.city.repo.head || ''}`.trim(), `${hu(c.length)} commit · ${current.city.repo.branch || ''}`.trim()];
  }
  const k = c[replay.T];
  const who = current.city.authors[k[1]] + (k[2] >= 0 ? ' + ' + current.city.agents[k[2]] : '');
  return [`${k[4]} · ${new Date(k[0] * 1000).toLocaleDateString('hu-HU')} · ${who}`, k[3].slice(0, 70)];
}

function tlRender() {
  if (!current) return;
  $('tl-range').value = replay.T;
  const [a, b] = boardText(), budget = tl.playing ? baseInterval() / tl.speed * 0.9 : 700;
  flapTo($('board-1'), a.toUpperCase(), budget);
  flapTo($('board-2'), b, budget);
  $('tl-pos').textContent = `${replay.T + 1} / ${replay.last + 1}`;
  drawStrip();
}

// activity strip: one bar per commit, height ~ log(lines changed), the shown commit marked
function drawStrip() {
  const cv = $('tl-strip'), r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  if (!r.width) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d'), c = current.city.commits, n = c.length, W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const size = c.map(k => { let s = 0; for (let i = 1; i < k[5].length; i += 3) s += k[5][i] + k[5][i + 1]; return Math.log2(1 + s); });
  const max = Math.max(1, ...size), bw = W / Math.max(1, n);
  c.forEach((k, i) => {
    const h = Math.max(1.5 * dpr, (size[i] / max) * (H - 2 * dpr));
    g.globalAlpha = i <= replay.T ? 0.95 : 0.3;
    g.fillStyle = k[2] >= 0 ? AGENT_BAR : HUMAN_BAR;
    g.fillRect(i * bw + bw * 0.15, H - h, Math.max(1, bw * 0.7), h);
  });
  g.globalAlpha = 1;
  if (compare.base !== null) { g.fillStyle = '#ff5a5a'; g.fillRect((compare.base + 0.5) * bw - dpr, 0, 2 * dpr, H); }
  if (replay.T < replay.last) { g.fillStyle = '#ffcf5a'; g.fillRect((replay.T + 0.5) * bw - dpr, 0, 2 * dpr, H); }
}

function tlSetup() {
  const rg = $('tl-range');
  rg.max = replay.last; rg.value = replay.T;
  $('timeline').hidden = current.city.commits.length < 2;
  delete $('board-1').dataset.text; delete $('board-2').dataset.text;
  tlRender();
}

$('tl-back').onclick = () => tlStep(-1);
$('tl-step').onclick = () => tlStep(1);
$('tl-latest').onclick = tlLatest;
$('tl-play').onclick = () => (tl.playing ? tlPause() : tlPlay());
$('tl-speed').onclick = () => {
  tl.speed = SPEEDS[(SPEEDS.indexOf(tl.speed) + 1) % SPEEDS.length];
  $('tl-speed').textContent = tl.speed + '×';
};
$('tl-range').addEventListener('input', e => { tlPause(); applyTime(+e.target.value, 120); });
addEventListener('resize', () => current && drawStrip());
addEventListener('keydown', e => {
  if (!current || e.target.closest('input:not([type=range]), textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === ' ') { e.preventDefault(); tl.playing ? tlPause() : tlPlay(); }
  else if (k === 'ArrowLeft') { e.preventDefault(); tlStep(-1); }
  else if (k === 'ArrowRight') { e.preventDefault(); tlStep(1); }
  else if (k === 'Home' && e.shiftKey) { tlPause(); applyTime(0, 260); }   // Home alone = the Land (29-land)
  else if (k === 'End') tlLatest();
});
