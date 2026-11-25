// voice.js — Diktálás (WP-54): push-to-talk speech-to-text inside the VRG Asztal's frame page.
//   Hold the key (setting voice.key, default F9):
//     focus in a text field OF THIS PAGE (textarea, input text/search, contenteditable) → 'dictate': the words appear live in that field
//       (provisional = selected + outlined), the final text replaces them; nothing is sent anywhere by speaking.
//     anywhere else, or Shift + the key → 'command': only events (the command layer, WP-55, shows and acts on them).
//   Esc while held = cancel. The frame only gets keys while it has the focus: a browser tab or an in-shell app view (native views) never
//   receives the key and is never a target, and nothing is typed into another program.
// The microphone opens when the feature is on (setting voice.enabled) and stays warm: the worklet's 20 ms frames go into a ~300 ms ring
// buffer while the key is up, so recording "starts" before the key press and the first word is never cut (key-down → first audio sent
// is an IPC round trip). The engine and the model live in main (shell/lib/voice.js); this page sends 16 kHz PCM16, gets text back.
// The contract with the command layer (WP-55):
//   window.VRGVoice = { on(type, cb) → off, state(), simulate(text, mode), _emit(type, data), hold(target) → release, enable(on) }
//   events: start {id, mode, lang?} · partial {id, mode, text} · final {id, mode, text, lang?, ms} · stop {id, mode} · error {id?, mode?, hu}
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const PREROLL_FRAMES = 15;                                   // 15 × 20 ms = 300 ms before the key press
  const FLUSH_MS = 100;

  // ------------------------------------------------------------ pure helpers (exported for tests)
  // does a key event mean the push-to-talk key? (e.key for F-keys, e.code for AltRight / ControlRight; Ctrl / Alt / Meta must be up)
  function keyMatches(e, key) {
    if (!e || !key) return false;
    if (e.ctrlKey && key !== 'ControlRight') return false;
    if ((e.altKey && key !== 'AltRight') || e.metaKey) return false;
    return e.key === key || e.code === key;
  }
  const TEXT_TYPES = ['', 'text', 'search'];
  // a field we may write into: a plain description { tag, type, editable, readOnly, disabled, inFrame } (inFrame: in this document)
  function isTextTarget(d) {
    if (!d || d.inFrame === false || d.readOnly || d.disabled) return false;
    const tag = String(d.tag || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') return TEXT_TYPES.includes(String(d.type || '').toLowerCase());
    return d.editable === true && tag !== 'iframe' && tag !== 'webview';
  }
  const modeFor = (d, shift) => (shift ? 'command' : isTextTarget(d) ? 'dictate' : 'command');
  // the text that goes in at `start`: a space before it when the character before is not a space / line start, and not before punctuation
  function joinText(before, text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return before && !/[\s(\[„"'«]$/.test(before) && !/^[.,!?;:…)]/.test(t) ? ' ' + t : t;
  }
  // put `text` at [start, start + prevLen) of `value` → { value, from, to } (from..to = the inserted text, for the selection)
  function splice(value, start, prevLen, text) {
    const v = String(value || ''), s = Math.max(0, Math.min(start, v.length));
    const ins = joinText(v.slice(0, s), text);
    return { value: v.slice(0, s) + ins + v.slice(s + Math.max(0, prevLen)), from: s, to: s + ins.length, len: ins.length };
  }
  // the last n frames
  function makeRing(n) {
    let a = [];
    return { push(f) { a.push(f); if (a.length > n) a.shift(); }, take() { const out = a; a = []; return out; }, size: () => a.length };
  }
  // Int16 frames → one base64 string (little-endian bytes)
  function framesToBase64(frames) {
    let len = 0; for (const f of frames) len += f.length;
    const all = new Int16Array(len); let o = 0;
    for (const f of frames) { all.set(f, o); o += f.length; }
    const bytes = new Uint8Array(all.buffer);
    if (typeof Buffer !== 'undefined' && typeof btoa === 'undefined') return Buffer.from(bytes).toString('base64');
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const helpers = { keyMatches, isTextTarget, modeFor, joinText, splice, makeRing, framesToBase64, PREROLL_FRAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------ the page
  const vrg = W.vrg;
  const subs = new Map();
  const S = { enabled: false, ready: false, engine: '', key: 'F9', lang: 'auto', ctx: null, stream: null, node: null, warming: null, ring: makeRing(PREROLL_FRAMES), rec: null, seq: 0, timing: null };
  function emit(type, data) { for (const f of subs.get(type) || []) { try { f(data); } catch (e) {} } }
  const describe = el => (el && el.nodeType === 1 ? { tag: el.tagName, type: el.getAttribute('type') || '', editable: el.isContentEditable === true, readOnly: !!el.readOnly, disabled: !!el.disabled, inFrame: el.ownerDocument === document && el.isConnected } : null);

  // indicator: a dot + the mode + the live words, under the field (dictate) or bottom centre (command)
  const ind = document.createElement('div');
  ind.dataset.role = 'voice-ind'; ind.hidden = true;
  const indDot = document.createElement('i'), indMode = document.createElement('b'), indText = document.createElement('span');
  ind.append(indDot, indMode, indText);
  (document.body || document.documentElement).append(ind);
  function showInd(rec, text) {
    ind.hidden = !rec; if (!rec) return;
    ind.dataset.mode = rec.mode;
    indMode.textContent = rec.mode === 'dictate' ? 'Diktálás' : 'Parancs';
    indText.textContent = text || '…';
    const r = rec.target && rec.mode === 'dictate' ? rec.target.getBoundingClientRect() : null;
    if (r) { ind.style.left = Math.max(8, r.left) + 'px'; ind.style.top = Math.min(innerHeight - 34, r.bottom + 4) + 'px'; ind.style.transform = ''; }
    else { ind.style.left = '50%'; ind.style.top = (innerHeight - 64) + 'px'; ind.style.transform = 'translateX(-50%)'; }
  }

  // ---------------------------------------------------------- the field: provisional text and the final one
  function fieldBegin(rec) {
    const t = rec.target;
    if (!t || rec.mode !== 'dictate' || !isTextTarget(describe(t))) { rec.target = null; return; }
    if (t.isContentEditable) {
      const sel = getSelection(), span = document.createElement('span');
      span.dataset.voiceProv = '1';
      if (sel.rangeCount && t.contains(sel.anchorNode)) { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(span); } else t.append(span);
      rec.span = span;
    } else {
      rec.start = t.selectionStart == null ? t.value.length : t.selectionStart;
      const end = t.selectionEnd == null ? rec.start : t.selectionEnd;
      if (end > rec.start) t.value = t.value.slice(0, rec.start) + t.value.slice(end);   // a selection is replaced by what is said
      rec.len = 0;
    }
    t.dataset.voice = 'live';
  }
  function fieldShow(rec, text, final) {
    const t = rec.target;
    if (!t || !t.isConnected) return;
    if (rec.span) {
      rec.span.textContent = joinText(rec.span.previousSibling && rec.span.previousSibling.textContent || '', text);
      if (final) { const tn = document.createTextNode(rec.span.textContent); rec.span.replaceWith(tn); rec.span = null; const r = document.createRange(); r.setStartAfter(tn); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    } else {
      const r = splice(t.value, rec.start, rec.len, text);
      t.value = r.value; rec.len = r.len;
      if (final) t.setSelectionRange(r.to, r.to); else t.setSelectionRange(r.from, r.to);
    }
    if (final) {
      delete t.dataset.voice;
      t.dispatchEvent(new Event('input', { bubbles: true }));     // the pane (the Vezérlő) sees the new text as typed
    }
  }
  function fieldDrop(rec) {
    const t = rec.target;
    if (!t) return;
    if (rec.span) { rec.span.remove(); rec.span = null; } else if (t.isConnected && rec.len) { t.value = t.value.slice(0, rec.start) + t.value.slice(rec.start + rec.len); t.setSelectionRange(rec.start, rec.start); }
    delete t.dataset.voice;
  }

  // ---------------------------------------------------------- the microphone (warm while the feature is on)
  async function warmMic() {
    if (S.node) return true;
    if (S.warming) return S.warming;
    S.warming = (async () => {
      try {
        S.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        S.ctx = new AudioContext();
        const src = S.ctx.createMediaStreamSource(S.stream);
        const mute = S.ctx.createGain(); mute.gain.value = 0; mute.connect(S.ctx.destination);   // pulled by the graph, heard by nobody
        try {
          // the AudioWorklet (off the main thread); a module fetch from file:// can be refused (CORS mode), then the fallback below
          await S.ctx.audioWorklet.addModule(new URL('voice-worklet.js', document.baseURI).href);
          S.node = new AudioWorkletNode(S.ctx, 'vrg-voice-capture');
          S.node.port.onmessage = e => onFrame(e.data);
          S.capture = 'worklet';
        } catch (e) {
          // fallback: a ScriptProcessorNode on the main thread, the same resampler and 20 ms frames (W.VRGVoiceResampler from the worklet file)
          const make = W.VRGVoiceResampler;
          if (!make) throw e;
          const resample = make(S.ctx.sampleRate, 16000);
          let frame = new Int16Array(320), fill = 0;
          S.node = S.ctx.createScriptProcessor(1024, 1, 1);
          S.node.onaudioprocess = ev => {
            const s = resample(ev.inputBuffer.getChannelData(0));
            for (let i = 0; i < s.length; i++) { frame[fill++] = s[i]; if (fill === 320) { onFrame(frame); frame = new Int16Array(320); fill = 0; } }
          };
          S.capture = 'script';
        }
        src.connect(S.node); S.node.connect(mute);
        if (S.ctx.state === 'suspended') await S.ctx.resume();
        return true;
      } catch (e) {
        emit('error', { hu: 'A mikrofon nem érhető el: ' + (e && e.name || 'hiba') });
        coolMic();
        return false;
      } finally { S.warming = null; }
    })();
    return S.warming;
  }
  function coolMic() {
    try { if (S.stream) S.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (S.ctx) S.ctx.close(); } catch (e) {}
    S.stream = S.ctx = S.node = null; S.capture = '';
  }
  function onFrame(f) {
    const rec = S.rec;
    if (!rec || rec.sim) { S.ring.push(f); return; }
    if (!rec.firstFrameAt) rec.firstFrameAt = performance.now();
    rec.pending.push(f);
  }
  async function flush(rec, force) {
    if (!rec || !rec.mainId || !rec.pending.length || (rec.sending && !force)) return;
    const frames = rec.pending; rec.pending = [];
    rec.sending = true;
    try {
      for (let i = 0; i < frames.length; i += 100) {             // ≤ 2 s (64 KB) per call
        const r = await vrg.voice.chunk(rec.mainId, framesToBase64(frames.slice(i, i + 100)));
        if (!rec.firstSendAt) { rec.firstSendAt = performance.now(); S.timing = { keyToFirstFrame: (rec.firstFrameAt || rec.firstSendAt) - rec.keyAt, keyToFirstSend: rec.firstSendAt - rec.keyAt, preroll: rec.preroll }; }
        if (r && r.ok === false) break;
      }
    } catch (e) {} finally { rec.sending = false; }
  }

  // ---------------------------------------------------------- a recording
  async function begin(mode, target, o) {
    if (S.rec) return S.rec.id;
    const id = 'p' + (++S.seq);
    const pre = S.ring.take();
    const global = !!(o && o.global);                               // WP-56: the global key, another program in front: always a command
    const rec = S.rec = { id, mode, target: mode === 'dictate' ? target : null, keyAt: performance.now(), pending: pre, preroll: pre.length * 20, mainId: '', text: '', done: false, global };
    fieldBegin(rec);
    emit('start', { id, mode, ...(global ? { global: true } : {}), ...(S.lang !== 'auto' ? { lang: S.lang } : {}) });
    showInd(rec, '');
    if (!S.enabled) { fail(rec, 'A diktálás ki van kapcsolva: kapcsold be a Vezérlő 🎤 gombjával (jobb klikk).'); return id; }
    if (!S.node) warmMic();                                         // cold mic (e.g. after a device change): open it now, frames follow
    const r = await vrg.voice.start(mode, S.lang !== 'auto' ? S.lang : undefined);
    if (S.rec !== rec) { if (r && r.id) vrg.voice.cancel(r.id); return id; }
    if (!r || r.ok === false || !r.id) { fail(rec, (r && r.hu) || 'A beszédmotor nem indult el.'); return id; }
    rec.mainId = r.id;
    flush(rec, true);                                               // the pre-roll and what came since, at once
    rec.timer = setInterval(() => flush(rec), FLUSH_MS);
    return id;
  }
  function fail(rec, hu) {
    fieldDrop(rec);
    emit('error', { id: rec.id, mode: rec.mode, hu });
    emit('stop', { id: rec.id, mode: rec.mode });
    clearInterval(rec.timer); S.rec = null;
    showInd({ mode: rec.mode, target: rec.target }, hu);
    setTimeout(() => { if (!S.rec) showInd(null); }, 2500);
  }
  async function end() {
    const rec = S.rec;
    if (!rec || rec.ending) return;
    rec.ending = true;
    clearInterval(rec.timer);
    if (rec.sim) return;
    if (!rec.mainId) { const t0 = performance.now(); while (!rec.mainId && S.rec === rec && performance.now() - t0 < 1500) await new Promise(r => setTimeout(r, 20)); }
    if (S.rec !== rec || !rec.mainId) return;
    await flush(rec, true);
    while (rec.sending) await new Promise(r => setTimeout(r, 10));
    showInd(rec, rec.text || 'feldolgozás…');
    const r = await vrg.voice.stop(rec.mainId);
    if (S.rec === rec) S.rec = null;
    finish(rec, r);
  }
  function finish(rec, r) {
    if (!r || r.ok === false) { fieldDrop(rec); emit('error', { id: rec.id, mode: rec.mode, hu: (r && r.hu) || 'Nincs szöveg.' }); }
    else {
      const text = String(r.text || '').trim();
      if (text) fieldShow(rec, text, true); else fieldDrop(rec);
      emit('final', { id: rec.id, mode: rec.mode, text, ...(rec.global ? { global: true } : {}), ...(r.lang ? { lang: r.lang } : {}), ms: Math.round(r.ms || performance.now() - rec.keyAt) });
    }
    emit('stop', { id: rec.id, mode: rec.mode });
    showInd(null);
  }
  function cancel() {
    const rec = S.rec;
    if (!rec) return;
    clearInterval(rec.timer); S.rec = null;
    if (rec.mainId) vrg.voice.cancel(rec.mainId);
    fieldDrop(rec);
    emit('stop', { id: rec.id, mode: rec.mode });
    showInd(null);
  }
  function onPartial(d) {
    const rec = S.rec;
    if (!rec || !d || d.id !== rec.mainId) return;
    rec.text = String(d.text || '');
    if (rec.mode === 'dictate') fieldShow(rec, rec.text, false);
    showInd(rec, rec.text);
    emit('partial', { id: rec.id, mode: rec.mode, text: rec.text });
  }

  // a fake utterance through the same pipeline (tests, probes, the command layer's own tests): partial words, then the final
  async function simulate(text, mode) {
    if (S.rec) cancel();
    const el = document.activeElement;
    const m = mode === 'dictate' || mode === 'command' ? mode : modeFor(describe(el), false);
    const id = 'p' + (++S.seq);
    const rec = S.rec = { id, mode: m, target: m === 'dictate' ? el : null, keyAt: performance.now(), pending: [], sim: true, text: '' };
    fieldBegin(rec);
    emit('start', { id, mode: m });
    showInd(rec, '');
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    for (let i = 1; i <= words.length; i++) {
      await new Promise(r => setTimeout(r, 40));
      if (S.rec !== rec) return { id, cancelled: true };
      rec.text = words.slice(0, i).join(' ');
      if (m === 'dictate') fieldShow(rec, rec.text, false);
      showInd(rec, rec.text);
      emit('partial', { id, mode: m, text: rec.text });
    }
    S.rec = null;
    finish(rec, { text: words.join(' '), lang: '', ms: performance.now() - rec.keyAt });
    return { id, mode: m, text: words.join(' ') };
  }

  // ---------------------------------------------------------- keys, the 🎤 button, settings
  W.addEventListener('keydown', e => {
    if (S.rec && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); return; }
    if (!keyMatches(e, S.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat || S.rec) return;
    const el = document.activeElement;
    begin(modeFor(describe(el), e.shiftKey), el);
  }, true);
  W.addEventListener('keyup', e => { if (S.rec && (keyMatches(e, S.key) || e.key === S.key || e.code === S.key)) { e.preventDefault(); end(); } }, true);
  W.addEventListener('blur', () => { if (S.rec && !S.rec.sim) end(); });

  function hold(target) {
    const el = target && target.nodeType === 1 ? target : document.activeElement;
    if (el && el.focus) el.focus();
    begin(modeFor(describe(el), false), el);
    return () => end();
  }
  async function refresh() {
    if (!vrg || !vrg.voice) return;
    try {
      const s = await vrg.voice.status();
      if (s && s.ok !== false) { S.enabled = !!s.enabled; S.ready = !!s.ready; S.engine = s.engine || ''; S.key = s.key || 'F9'; S.lang = s.lang || 'auto'; S.hint = s.hu || ''; }
    } catch (e) {}
    if (S.enabled) warmMic(); else coolMic();
  }
  async function enable(on) {
    if (!vrg || !vrg.voice) return false;
    const s = await vrg.voice.enable(on === true);
    await refresh();
    return !!(s && s.enabled);
  }
  // WP-56: the global push-to-talk key (main: press = start, press again or 8 s = stop) — a command about the program in front
  try { if (vrg && vrg.on) vrg.on('voice', 'global', m => { if (m && m.phase === 'start' && !S.rec) begin('command', null, { global: true }); else if (m && m.phase === 'stop' && S.rec && S.rec.global) end(); }); } catch (e) {}
  try { if (vrg && vrg.on) { vrg.on('voice', 'partial', onPartial); vrg.on('voice', 'error', d => { if (S.rec && d && d.id === S.rec.mainId) emit('error', { id: S.rec.id, mode: S.rec.mode, hu: d.hu }); }); } } catch (e) {}
  refresh();

  W.VRGVoice = {
    helpers,
    on(type, cb) { if (!subs.has(type)) subs.set(type, []); subs.get(type).push(cb); return () => subs.set(type, subs.get(type).filter(f => f !== cb)); },
    state: () => ({ ready: S.ready, engine: S.engine, recording: !!S.rec, mode: S.rec ? S.rec.mode : '', key: S.key, enabled: S.enabled, mic: !!S.node, capture: S.capture || '', hint: S.hint || '', timing: S.timing }),
    simulate, _emit: emit, hold, enable, refresh, cancel,
  };
})();
