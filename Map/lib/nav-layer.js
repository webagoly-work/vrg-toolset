// nav-layer.js — turn-by-turn guidance in the VRG Térkép (WP M58, N3): the banner with the next maneuver, the
// arrival bar, the camera following the user along the route, and the voice. Started from the Térkép-feed's
// held place (lib/feed-layer.js, "▶ Indulás"); the steps come from lib/guide.js (window.VRGGuide).
//
// Voice: on the phone the app's own Android text-to-speech (the page asks with vrg-map:say; the WebView's
// speechSynthesis is not reliable on Android), on the PC the browser's speechSynthesis in Hungarian. On the
// phone the screen is kept on while guiding (vrg-map:keepon). Nothing here sends anything anywhere.
//
//   const nav = initNav({ map, store, toast })
//   nav.start(route, { label, mode, color })   nav.setRoute(route)   nav.update(lon, lat)   nav.stop()   nav.on()

export function initNav({ map, store, toast }) {
  const G = window.VRGGuide;
  if (!G) return null;
  const phone = () => document.documentElement.classList.contains('vrg-phone');
  let on = false, rt = null, steps = [], opt = {}, said = new Set(), follow = true, mute = !!store.get('navMute', false), arrived = false, lastPos = null;

  const banner = document.createElement('div'); banner.id = 'nav-banner'; banner.hidden = true;
  const foot = document.createElement('div'); foot.id = 'nav-foot'; foot.hidden = true;
  document.body.append(banner, foot);
  foot.innerHTML = `<span id="nav-sum"></span>
    <button type="button" class="lg-chip" id="nav-mute"></button>
    <button type="button" class="lg-chip" id="nav-follow">◎ Követés</button>
    <button type="button" class="lg-chip" id="nav-stop">■ Befejezés</button>`;
  const $ = s => document.querySelector(s);
  const paintMute = () => { $('#nav-mute').textContent = mute ? '🔇' : '🔊'; $('#nav-mute').setAttribute('aria-label', mute ? 'Hang be' : 'Hang ki'); };
  paintMute();
  $('#nav-mute').onclick = () => { mute = !mute; store.set('navMute', mute); paintMute(); if (!mute) say('Hang bekapcsolva'); };
  $('#nav-follow').onclick = () => { follow = true; $('#nav-follow').hidden = true; if (lastPos) camera(lastPos[0], lastPos[1], true); };
  $('#nav-stop').onclick = () => stop();
  map.on('dragstart', () => { if (on) { follow = false; $('#nav-follow').hidden = false; } });

  function say(text) {
    if (mute || !text) return;
    if (phone()) { location.href = 'vrg-map:say?text=' + encodeURIComponent(text); return; }
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'hu-HU'; u.rate = 1.02;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no speech here: the banner is enough */ }
  }
  function keepOn(v) { if (phone()) location.href = 'vrg-map:keepon?on=' + (v ? 1 : 0); }

  function setRoute(r, quiet) {
    rt = r; steps = r ? G.steps(r, opt.label) : []; said = new Set(); arrived = false;
    if (r && !quiet) say('Új útvonal. ' + (steps[1] ? G.spoken(steps[1], steps[1].offset) : ''));
  }

  function start(r, o) {
    opt = o || {}; on = true; follow = true;
    setRoute(r, true);
    document.body.classList.add('nav-on');
    banner.hidden = false; foot.hidden = false; $('#nav-follow').hidden = true;
    keepOn(true);
    const first = steps[0], second = steps[1];
    say((first ? first.text + '. ' : '') + (second && second.kind !== 'arrive' ? G.spoken(second, second.offset) : ''));
    if (second) for (const c of G.cues(opt.mode)) if (second.offset <= c) said.add('1:' + c);   // just said: not again at once
    render(0, rt.meters, rt.seconds);
  }
  function stop() {
    if (!on) return;
    on = false; rt = null; steps = [];
    document.body.classList.remove('nav-on');
    banner.hidden = true; foot.hidden = true;
    keepOn(false);
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    if (opt.onStop) opt.onStop();
  }

  function arrow(step) { return step ? step.icon : '↑'; }
  function render(done, left, leftSeconds) {
    const i = G.next(steps, done), s = steps[i], after = steps[i + 1];
    const toStep = s ? Math.max(0, s.offset - done) : 0;
    banner.style.setProperty('--c', opt.color || '#1a73e8');
    banner.innerHTML = s ? `<span class="nv-i">${arrow(s)}</span><span class="nv-t"><b>${G.fmtShort(toStep)}</b><span>${esc(s.text)}</span>
      ${after ? `<small>majd ${after.icon} ${esc(after.text)}</small>` : ''}</span>` : '';
    const eta = new Date(Date.now() + leftSeconds * 1000);
    $('#nav-sum').innerHTML = `<b>${String(eta.getHours()).padStart(2, '0')}:${String(eta.getMinutes()).padStart(2, '0')}</b> érkezés · ${G.fmtShort(left)} · ~${Math.max(1, Math.round(leftSeconds / 60))} perc`;
    return { i, s, toStep };
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function camera(lon, lat, now) {
    if (!follow || !rt) return;
    const a = window.VRGRoute ? window.VRGRoute.along(rt, lon, lat) : null;
    const c = rt.coords, j = a ? Math.min(c.length - 1, a.at + 1) : 1;
    const head = c.length > 1 ? G.bearing(c[Math.max(0, j - 1)], c[j]) : map.getBearing();
    const narrow = matchMedia('(max-width:640px)').matches;
    map.easeTo({ center: [lon, lat], bearing: head, pitch: 55, zoom: opt.mode === 'gyalog' ? 18 : 16.8, duration: now ? 400 : 900,
      padding: { top: narrow ? 40 : 60, bottom: narrow ? Math.round(innerHeight * 0.35) : 160, left: 0, right: 0 } });
  }

  /** A new position: where on the route, what to show, what to say. */
  function update(lon, lat) {
    if (!on || !rt || !window.VRGRoute) return;
    lastPos = [lon, lat];
    const a = window.VRGRoute.along(rt, lon, lat);
    const { i, s, toStep } = render(a.done, a.left, a.leftSeconds);
    camera(lon, lat, false);
    if (!s) return;
    if (s.kind === 'arrive' && (a.left < 25 || toStep < 25)) {
      if (!arrived) { arrived = true; say(s.text); toast && toast(s.text); }
      return;
    }
    // the nearest cue the user is within (e.g. 250 m of [700, 250, 50]); once said, the farther ones are no longer news
    const within = G.cues(opt.mode).filter(c => toStep <= c);
    if (within.length) {
      const cue = Math.min(...within);
      if (!said.has(i + ':' + cue)) { for (const c of within) said.add(i + ':' + c); say(G.spoken(s, toStep)); }
    }
  }

  const api = { start, stop, setRoute, update, on: () => on, steps: () => steps, follow: () => follow, muted: () => mute };
  window.vrgNav = api;
  return api;
}
