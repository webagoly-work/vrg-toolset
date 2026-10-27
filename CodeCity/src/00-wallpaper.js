// 00-wallpaper.js — the city as a wallpaper behind the desktop icons (P12 L0, KV-24; report §1.5). Lively (the user's own
// program, GPL-3.0, no code taken) shows http://localhost:8797/#mode=wallpaper[&fps=1..5][&view=land|city] as the desktop:
// - every animation loop of the page runs at most fps times a second (default 2): requestAnimationFrame is wrapped here,
//   before any other module runs, so the camera flights, ships, constructs and peaks all obey it; rendering stays on
//   demand (03-scene), so a quiet city draws nothing at all;
// - no panels, bars or HUD — just the scene; flights are instant;
// - hidden (a fullscreen app, Lively paused, the screen locked) = the live stream is closed until it shows again;
// - the segéd treats it as a light listener: file pulses, git and Claude's figures (polled every 30 s), but none of the
//   samplers, the probe or ETW (those run only while a full page listens).

const KV_WALL = (() => {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.get('mode') !== 'wallpaper') return null;
  const fps = Math.min(5, Math.max(1, Math.round(+q.get('fps') || 2)));
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => setTimeout(() => raf(cb), 1000 / fps);
  window.KV_INSTANT = true;
  document.documentElement.classList.add('wallpaper');
  return { fps, view: q.get('view') === 'city' ? 'city' : 'land' };
})();

// #mode=overlay (P12 L2, KV-25): the summoned controller inside the Electron shell (CodeCity/shell/main.js) — the whole page,
// but the sky is transparent, so the desktop shows through. The shell keeps the window click-through with forward (mouse
// moves still arrive); the page says where it is solid: over a panel, a bar, a building or a district plate — or while a
// drag that started there goes on. Hidden (the hotkey again, Esc) = the stream is closed, as for the wallpaper.
const KV_OVERLAY = (() => {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.get('mode') !== 'overlay') return null;
  document.documentElement.classList.add('overlay');
  const shell = window.kvShell;
  if (shell) {
    let solid = null;
    addEventListener('pointermove', e => {
      const s = e.buttons !== 0 || e.target.id !== 'gl' || !!pickAt(e);
      if (s !== solid) { solid = s; shell.solid(s); }
    }, { passive: true });
  }
  return { display: +q.get('display') || 0 };
})();
