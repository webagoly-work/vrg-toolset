// 37-look.js — low-glow mode and adaptive quality tiers (P13, KV-27; report §5.5 R11, §1.5 "staying light").
// Low glow (L, the "Halk" button in the lens bar, #glow=low): the lit windows and the body glow at about a third, a live
// file pulse at half — the same city, calmer, for a long day or a wallpaper.
// Quality tiers (#quality=high|mid|low, default auto): the pixel ratio — high = the screen's (max 2), mid = 1,
// low = 0.75. Auto watches the gaps between frames while something moves (a flight, a tour): when the median of 30 is
// over 45 ms (under ~22 fps) it steps one tier down, once per 30 frames, never up by itself. body[data-quality] says
// which tier is on. A quiet city renders nothing, so it is measured only while it moves.

const look = { low: false, tier: 'high', auto: true, gaps: [], last: 0 };
const LOOK_TIERS = { high: () => Math.min(devicePixelRatio, 2), mid: () => 1, low: () => 0.75 };

function lookGlow(x) { return look.low ? x * 0.35 : x; }   // 07-lens: window gain and body glow
function lookPulse() { return look.low ? 0.5 : 1; }         // 22-live: a changed file's flash

function setLowGlow(on) {
  look.low = !!on;
  document.documentElement.classList.toggle('low-glow', look.low);
  const b = document.getElementById('glow-btn'); if (b) b.classList.toggle('on', look.low);
  if (world) setLens(lens.id);
  requestRender();
}

function setTier(t) {
  if (!LOOK_TIERS[t]) return;
  look.tier = t;
  renderer.setPixelRatio(LOOK_TIERS[t]());
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  document.body.dataset.quality = t + (look.auto ? ' (auto)' : '');
  requestRender();
}

// 03-scene calls this after every render
function lookFrame() {
  const now = performance.now(), gap = now - look.last;
  look.last = now;
  if (!look.auto || gap > 100) return;   // a lone render after a pause is not a frame rate
  look.gaps.push(gap);
  if (look.gaps.length < 30) return;
  const med = look.gaps.slice().sort((a, b) => a - b)[15];
  look.gaps = [];
  if (med > 45 && look.tier !== 'low') setTier(look.tier === 'high' ? 'mid' : 'low');
}

addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input:not([type=range]), textarea')) return;
  if (e.key === 'l' || e.key === 'L') setLowGlow(!look.low);
});
{
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.get('glow') === 'low') { look.low = true; document.documentElement.classList.add('low-glow'); }
  if (LOOK_TIERS[q.get('quality')]) look.auto = false;
  setTier(LOOK_TIERS[q.get('quality')] ? q.get('quality') : 'high');
}
