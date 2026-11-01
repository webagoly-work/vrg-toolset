/* Widgets that lean on the device: sensors, microphone, local files. Sensors and the microphone
   start only on a button press and stop when the page closes. */
import { t } from '../core/i18n.js';
import { formatDate, formatDateTime, formatNumber, formatTime, formatUnit, parseNumber } from '../core/format.js';
import { sunTimes } from '../core/sun.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { el, ring } from '../ring.js';
import { addButton, deleteWithUndo, guide, listRow, liveRender, pageWrap, panel } from './shared.js';

const hoursMinutes = (ms) => {
  const min = Math.round(ms / 60000);
  return t('sun.hm', { h: formatNumber(Math.floor(min / 60)), m: formatNumber(min % 60) });
};

export const sun = {
  manifest: { id: 'sun', category: 'widgets', permissions: [], offline: true, name: { hu: 'Napkelte és napnyugta', en: 'Sunrise and sunset' } },
  strings: {
    hu: {
      'sun.site': 'Helyszín', 'sun.lat': 'Szélesség (°)', 'sun.lon': 'Hosszúság (°, kelet pozitív)', 'sun.date': 'Dátum', 'sun.rise': 'Napkelte', 'sun.set': 'Napnyugta', 'sun.daylight': 'Világos órák',
      'sun.hm': '{h} óra {m} perc', 'sun.day': 'Ezen a napon nem megy le a Nap.', 'sun.night': 'Ezen a napon nem kel fel a Nap.', 'sun.need': 'Add meg a szélességet és a hosszúságot.', 'sun.hint': 'A koordinátát kézzel írod be, a program nem kér helyadatot.',
    },
    en: {
      'sun.site': 'Site', 'sun.lat': 'Latitude (°)', 'sun.lon': 'Longitude (°, east positive)', 'sun.date': 'Date', 'sun.rise': 'Sunrise', 'sun.set': 'Sunset', 'sun.daylight': 'Daylight',
      'sun.hm': '{h} h {m} min', 'sun.day': 'The sun does not set on this day.', 'sun.night': 'The sun does not rise on this day.', 'sun.need': 'Enter the latitude and longitude.', 'sun.hint': 'You type the coordinates yourself; the app never asks for your location.',
    },
  },
  mount(root, ctx) {
    const saved = ctx.store.pageSetting('sun', 'site') ?? { lat: '47,5', lon: '19,04' };
    const lat = h('input.input', { type: 'text', inputMode: 'decimal', value: saved.lat, oninput: () => show() });
    const lon = h('input.input', { type: 'text', inputMode: 'decimal', value: saved.lon, oninput: () => show() });
    const date = h('input.input', { type: 'date', value: new Date().toLocaleDateString('sv'), onchange: () => show() });
    const out = h('div', { role: 'status' });
    const row = (k, v) => h('div.result', {}, h('span.k', { text: k }), h('b', { text: v }));
    const show = () => {
      const a = parseNumber(lat.value);
      const b = parseNumber(lon.value);
      if (a == null || b == null) { out.replaceChildren(guide(t('sun.need'))); return; }
      ctx.store.setPageSetting('sun', 'site', { lat: lat.value, lon: lon.value });
      const s = sunTimes(new Date(date.value + 'T12:00'), a, b);
      out.replaceChildren(...(s.polar ? [guide(t('sun.' + s.polar))] : [
        row(t('sun.rise'), formatTime(s.rise)), row(t('sun.set'), formatTime(s.set)), row(t('sun.daylight'), hoursMinutes(s.length)),
      ]));
    };
    root.append(pageWrap(panel(t('sun.site'),
      h('label.field', {}, h('span.k', { text: t('sun.lat') }), lat),
      h('label.field', {}, h('span.k', { text: t('sun.lon') }), lon),
      h('label.field', {}, h('span.k', { text: t('sun.date') }), date),
      out, h('p.hint', { text: t('sun.hint') }))));
    show();
  },
};

export const agenda = {
  manifest: { id: 'agenda', category: 'widgets', permissions: [], offline: true, name: { hu: 'Naptár', en: 'Calendar agenda' } },
  strings: {
    hu: { 'agenda.title': 'Közelgő események', 'agenda.add': 'Új esemény', 'agenda.edit': 'Esemény', 'agenda.f.title': 'Megnevezés', 'agenda.f.when': 'Időpont', 'agenda.f.note': 'Megjegyzés', 'agenda.none': 'Nincs közelgő esemény. Vegyél fel egyet.', 'agenda.past': 'Elmúlt események' },
    en: { 'agenda.title': 'Upcoming', 'agenda.add': 'New event', 'agenda.edit': 'Event', 'agenda.f.title': 'Title', 'agenda.f.when': 'When', 'agenda.f.note': 'Note', 'agenda.none': 'Nothing coming up. Add an event.', 'agenda.past': 'Past events' },
  },
  mount(root, ctx) {
    const view = liveRender(root, ctx, async () => {
      const all = await ctx.db.list('event');
      all.sort((a, b) => a.when - b.when);
      const now = Date.now();
      const upcoming = all.filter((e) => e.when >= now);
      const past = all.filter((e) => e.when < now).reverse();
      const fields = [
        { key: 'title', label: t('agenda.f.title') },
        { key: 'when', label: t('agenda.f.when'), type: 'datetime-local' },
        { key: 'note', label: t('agenda.f.note') },
      ];
      const local = (ms) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const edit = (e) => recordSheet({
        title: t(e ? 'agenda.edit' : 'agenda.add'), fields,
        value: e ? { ...e, when: local(e.when) } : { when: local(now) },
        onSave: async (v) => {
          await ctx.db.put('event', { ...v, when: Date.parse(v.when) || now });
          await view.refresh();
        },
        onDelete: e ? () => deleteWithUndo(ctx, 'event', e, e.title, view.refresh) : undefined,
      });
      const row = (e) => listRow({ title: e.title, sub: formatDateTime(e.when), onclick: () => edit(e) });
      return pageWrap(
        panel(t('agenda.title'), upcoming.length ? upcoming.map(row) : guide(t('agenda.none')), addButton(t('agenda.add'), () => edit(null))),
        past.length ? panel(t('agenda.past'), past.slice(0, 20).map(row)) : null);
    });
    return view.stop;
  },
};

/* iOS asks once per page, and only from a button press */
async function askSensors() {
  const ask = globalThis.DeviceOrientationEvent?.requestPermission;
  if (ask) return (await ask.call(DeviceOrientationEvent)) === 'granted';
  return 'DeviceOrientationEvent' in globalThis;
}

function sensorPage(root, onEvent, startLabel, none, content) {
  let on = null;
  const note = h('p.hint', { role: 'status' });
  const start = addButton(startLabel, async () => {
    if (on) return;
    if (!(await askSensors().catch(() => false))) { note.textContent = none; return; }
    on = onEvent;
    addEventListener('deviceorientationabsolute', on);
    addEventListener('deviceorientation', on);
    start.hidden = true;
  });
  root.append(pageWrap(panel(null, content, note, start)));
  return () => {
    if (!on) return;
    removeEventListener('deviceorientationabsolute', on);
    removeEventListener('deviceorientation', on);
  };
}

export const level = {
  manifest: { id: 'level', category: 'widgets', permissions: ['sensors'], offline: true, name: { hu: 'Vízmérték és dőlésmérő', en: 'Level and inclinometer' } },
  strings: {
    hu: { 'level.label': 'Dőlésjelző', 'level.start': 'Érzékelő indítása', 'level.none': 'Ezen az eszközön nincs dőlésérzékelő. A natív alkalmazásban vagy telefonon működik.', 'level.pitch': 'Hossztengely', 'level.roll': 'Kereszttengely' },
    en: { 'level.label': 'Tilt display', 'level.start': 'Start the sensor', 'level.none': 'This device has no tilt sensor. It works on a phone or in the native app.', 'level.pitch': 'Pitch', 'level.roll': 'Roll' },
  },
  mount(root) {
    const svg = el('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': t('level.label') });
    ring(svg, { cx: 150, cy: 150, r: 130 });
    ring(svg, { cx: 150, cy: 150, r: 22, stroke: 'var(--cyan)' });
    const bubble = el('circle', { cx: 150, cy: 150, r: 18, fill: 'var(--cyan)', opacity: '.5' }, svg);
    const pitch = h('b', { text: '–' });
    const roll = h('b', { text: '–' });
    const clamp = (v) => Math.max(-30, Math.min(30, v));
    const onTilt = (e) => {
      if (e.beta == null) return;
      bubble.setAttribute('cx', 150 + clamp(e.gamma) * 3.6);
      bubble.setAttribute('cy', 150 + clamp(e.beta) * 3.6);
      pitch.textContent = formatUnit(e.beta, '°', 1);
      roll.textContent = formatUnit(e.gamma, '°', 1);
    };
    return sensorPage(root, onTilt, t('level.start'), t('level.none'), h('div', {}, svg,
      h('div.result', {}, h('span.k', { text: t('level.pitch') }), pitch),
      h('div.result', {}, h('span.k', { text: t('level.roll') }), roll)));
  },
};

export const compass = {
  manifest: { id: 'compass', category: 'widgets', permissions: ['sensors'], offline: true, name: { hu: 'Iránytű', en: 'Compass' } },
  strings: {
    hu: { 'compass.label': 'Iránytű', 'compass.start': 'Érzékelő indítása', 'compass.none': 'Ezen az eszközön nincs iránytű. Telefonon vagy a natív alkalmazásban működik.', 'compass.north': 'É', 'compass.hint': 'Vas és kábel közelében pontatlan. Tájékoztató érték.' },
    en: { 'compass.label': 'Compass', 'compass.start': 'Start the sensor', 'compass.none': 'This device has no compass. It works on a phone or in the native app.', 'compass.north': 'N', 'compass.hint': 'Unreliable near steel and cables. Indicative only.' },
  },
  mount(root) {
    const svg = el('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': t('compass.label') });
    const card = el('g', {}, svg);
    ring(card, { cx: 150, cy: 150, r: 130 });
    el('text', { x: 150, y: 48, 'text-anchor': 'middle', class: 'r-lbl' }, card).textContent = t('compass.north');
    el('path', { d: 'M150 62 L142 150 L158 150 Z', fill: 'var(--alert)' }, card);
    const big = h('div.bignum', { role: 'status', text: '–' });
    const onHeading = (e) => {
      const heading = e.webkitCompassHeading ?? (e.absolute || e.type === 'deviceorientationabsolute' ? 360 - e.alpha : null);
      if (heading == null) return;
      card.setAttribute('transform', `rotate(${-heading} 150 150)`);
      big.textContent = formatUnit(Math.round(heading) % 360, '°', 0);
    };
    return sensorPage(root, onHeading, t('compass.start'), t('compass.none'), h('div', {}, svg, big, h('p.hint', { text: t('compass.hint') })));
  },
};

export const sound = {
  manifest: { id: 'sound', category: 'widgets', permissions: ['microphone'], offline: true, name: { hu: 'Zajszintmérő', en: 'Sound level meter' } },
  strings: {
    hu: { 'sound.badge': 'Tájékoztató érték, nem kalibrált műszer', 'sound.start': 'Mérés indítása', 'sound.stop': 'Mérés leállítása', 'sound.none': 'A mikrofon nem érhető el.', 'sound.peak': 'Csúcs', 'sound.offset': 'Eltolás (dB)', 'sound.hint': 'A hang nem kerül rögzítésre vagy mentésre, csak a szint jelenik meg, amíg a mérés fut.' },
    en: { 'sound.badge': 'Indicative only, not a calibrated instrument', 'sound.start': 'Start measuring', 'sound.stop': 'Stop measuring', 'sound.none': 'The microphone is not available.', 'sound.peak': 'Peak', 'sound.offset': 'Offset (dB)', 'sound.hint': 'No audio is recorded or saved; only the level shows, while measuring runs.' },
  },
  mount(root, ctx) {
    let stream = null;
    let audio = null;
    let raf = 0;
    let peak = -Infinity;
    const big = h('div.bignum', { role: 'status', text: '–' });
    const peakOut = h('b', { text: '–' });
    const note = h('p.hint', { role: 'alert' });
    const offset = h('input.input', {
      type: 'text', inputMode: 'decimal', value: String(ctx.store.pageSetting('sound', 'offset') ?? 90),
      onchange: (e) => ctx.store.setPageSetting('sound', 'offset', parseNumber(e.target.value) ?? 90),
    });
    const stop = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      audio?.close();
      stream = audio = null;
      toggle.textContent = t('sound.start');
    };
    const toggle = addButton(t('sound.start'), async () => {
      if (stream) { stop(); return; }
      note.textContent = '';
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch {
        note.textContent = t('sound.none');
        return;
      }
      audio = new AudioContext();
      const meter = audio.createAnalyser();
      meter.fftSize = 2048;
      audio.createMediaStreamSource(stream).connect(meter);
      const buf = new Float32Array(meter.fftSize);
      peak = -Infinity;
      toggle.textContent = t('sound.stop');
      const frame = () => {
        meter.getFloatTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((sum, x) => sum + x * x, 0) / buf.length);
        const db = 20 * Math.log10(rms || 1e-6) + (parseNumber(offset.value) ?? 90);
        peak = Math.max(peak, db);
        big.textContent = formatUnit(db, 'dB', 0);
        peakOut.textContent = formatUnit(peak, 'dB', 0);
        raf = requestAnimationFrame(frame);
      };
      frame();
    });
    root.append(pageWrap(panel(null,
      h('p', {}, h('span.chip.st-warn', { text: t('sound.badge') })),
      big,
      h('div.result', {}, h('span.k', { text: t('sound.peak') }), peakOut),
      toggle, note,
      h('label.field', {}, h('span.k', { text: t('sound.offset') }), offset),
      h('p.hint', { text: t('sound.hint') }))));
    return stop;
  },
};

function drawWave(canvas, samples) {
  const c = canvas.getContext('2d');
  const { width: w, height: ht } = canvas;
  c.clearRect(0, 0, w, ht);
  c.fillStyle = getComputedStyle(canvas).color;
  const step = samples.length / w;
  for (let x = 0; x < w; x++) {
    let peak = 0;
    for (let i = Math.floor(x * step), end = Math.floor((x + 1) * step); i < end; i += 16) peak = Math.max(peak, Math.abs(samples[i]));
    const bar = Math.max(1, peak * ht);
    c.fillRect(x, (ht - bar) / 2, 1, bar);
  }
}

const MAX_WAVE_BYTES = 80e6;

export const media = {
  manifest: { id: 'media', category: 'widgets', permissions: ['files'], offline: true, name: { hu: 'Médialejátszó', en: 'Media player' } },
  strings: {
    hu: { 'media.add': 'Fájlok hozzáadása', 'media.playlist': 'Lejátszási lista', 'media.none': 'Válassz helyi hang- vagy videofájlokat. Semmi nem töltődik fel.', 'media.prev': 'Előző', 'media.next': 'Következő', 'media.clear': 'Lista ürítése', 'media.bad': 'Ezt a fájlt az eszköz nem tudja lejátszani.', 'media.hint': 'A lista a lap bezárásáig él. Háttérben a natív alkalmazás szól tovább.' },
    en: { 'media.add': 'Add files', 'media.playlist': 'Playlist', 'media.none': 'Pick local audio or video files. Nothing is uploaded.', 'media.prev': 'Previous', 'media.next': 'Next', 'media.clear': 'Clear the list', 'media.bad': 'This device cannot play the file.', 'media.hint': 'The list lasts until the page closes. Background playback needs the native app.' },
  },
  mount(root) {
    let list = [];
    let at = -1;
    const player = h('video.player', { controls: true, playsInline: true, hidden: true });
    const wave = h('canvas.wave', { width: 600, height: 72, hidden: true, 'aria-hidden': 'true' });
    const note = h('p.hint', { role: 'alert' });
    const rows = h('div');
    const paint = () => {
      rows.replaceChildren(...(list.length ? list.map((f, i) => listRow({
        title: (i === at ? '▶ ' : '') + f.name,
        onclick: () => play(i),
      })) : [guide(t('media.none'))]));
    };
    async function waveform(file, mine) {
      wave.hidden = true;
      if (!file.type.startsWith('audio/') || file.size > MAX_WAVE_BYTES) return;
      const ac = new OfflineAudioContext(1, 1, 8000);
      const data = await ac.decodeAudioData(await file.arrayBuffer()).catch(() => null);
      if (!data || mine !== at) return;
      wave.hidden = false;
      drawWave(wave, data.getChannelData(0));
    }
    function play(i) {
      if (!list[i]) return;
      at = i;
      note.textContent = '';
      URL.revokeObjectURL(player.src);
      player.src = URL.createObjectURL(list[i]);
      player.hidden = false;
      player.play().catch(() => {});
      waveform(list[i], i);
      paint();
    }
    player.onended = () => play(at + 1);
    player.onerror = () => { if (player.getAttribute('src')) note.textContent = t('media.bad'); };
    const picker = h('input', {
      type: 'file', accept: 'audio/*,video/*', multiple: true, hidden: true,
      onchange: (e) => {
        list = list.concat([...e.target.files]);
        e.target.value = '';
        if (at < 0) play(0); else paint();
      },
    });
    const clear = () => {
      player.pause();
      URL.revokeObjectURL(player.src);
      player.removeAttribute('src');
      player.hidden = wave.hidden = true;
      list = [];
      at = -1;
      paint();
    };
    root.append(pageWrap(
      panel(null, player, wave, note, h('div.btn-row', {},
        addButton(t('media.prev'), () => play(at - 1)),
        addButton(t('media.next'), () => play(at + 1)))),
      panel(t('media.playlist'), rows, picker, addButton(t('media.add'), () => picker.click()), addButton(t('media.clear'), clear), h('p.hint', { text: t('media.hint') }))));
    paint();
    return () => { player.pause(); URL.revokeObjectURL(player.src); };
  },
};
