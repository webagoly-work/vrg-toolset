// viewer.js — Nézőke (WP-13): shows one file read-only: text with line numbers, Markdown, an image, or a hex dump.
// The page holds a handle and never a path. Markdown and SVG go through DOMPurify; markdown-it and DOMPurify are the vendored
// libraries, loaded as local file: scripts from the URLs main gives in vrg.app.info().libs (a missing one → plain text / no SVG).
// The files pane opens it over itself with  const v = Object.create(VRGPanes.viewer); v.mount(box, {}, { close }); v.load(handle, name).
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : {};
  const P = W.VRGPanes = W.VRGPanes || {};

  // ------------------------------------------------------------ pure helpers (exported for tests)
  const isMarkdown = name => /\.(md|markdown)$/i.test(String(name || ''));

  // "a\nb\n" → ['a', 'b']  (a closing newline does not make an extra empty line)
  function splitLines(text) {
    const lines = String(text).split(/\r\n|\r|\n/);
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  const helpers = { isMarkdown, splitLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;

  // ------------------------------------------------------------ the pane
  const el = (tag, role, text) => { const e = document.createElement(tag); if (role) e.dataset.role = role; if (text !== undefined) e.textContent = text; return e; };

  const loaded = {};
  function loadScript(url) {                                      // only the file: URLs main handed out
    if (typeof url !== 'string' || !/^file:/i.test(url)) return Promise.resolve(false);
    if (!loaded[url]) {
      loaded[url] = new Promise(res => {
        const s = document.createElement('script');
        s.src = url; s.onload = () => res(true); s.onerror = () => res(false);
        document.head.append(s);
      });
    }
    return loaded[url];
  }

  P.viewer = {
    helpers,
    mount(el0, state, api) {
      this.root = el0; this.api = api || {};
      this.fs = W.vrg && W.vrg.fs;
      this.item = null; this.reply = null; this.note = ''; this.fit = true; this.raw = false;
      el0.innerHTML = '';
      el0.dataset.role = 'viewer';
      el0.tabIndex = 0;
      this.onKey = e => {
        e.stopPropagation();                                      // the files pane under the viewer must not see these keys
        if (e.key === 'Escape' || e.key === 'F3') { e.preventDefault(); this.close(); }
      };
      el0.addEventListener('keydown', this.onKey);
      this.draw();
    },
    unmount() {
      if (this.root) { this.root.removeEventListener('keydown', this.onKey); this.root.innerHTML = ''; }
      this.root = null; this.gone = true;
    },
    state() { return {}; },                                       // handles are per run: nothing to persist
    close() { if (this.api && typeof this.api.close === 'function') this.api.close(); },

    async load(handle, name, fetch) {
      this.item = { handle, name: String(name || '') };
      this.reply = null; this.note = 'Betöltés…'; this.draw();
      if (!this.fs || typeof this.fs.read !== 'function') { this.note = 'A nézőke ebben a buildben nem érhető el.'; this.draw(); return; }
      const r = await this.fs.read(handle, fetch ? { fetch: true } : undefined);
      if (this.gone) return;
      this.reply = r; this.note = '';
      if (r && r.ok === false) this.note = r.hu || 'A fájl nem olvasható.';
      else if (r && r.kind === 'text' && isMarkdown(this.item.name)) await this.loadLibs();
      else if (r && r.svg) await this.loadLibs();
      if (this.gone) return;
      this.draw();
      if (this.root) this.root.focus();
    },
    async loadLibs() {
      let libs = {};
      try { const i = await W.vrg.app.info(); libs = i && i.libs || {}; } catch (e) {}
      if (!W.DOMPurify) await loadScript(libs.dompurify);
      if (!W.markdownit) await loadScript(libs.markdownIt);
    },

    async act(fn) {                                               // open / edit / reveal / copyPath on the shown file
      if (!this.item || !this.fs || typeof this.fs[fn] !== 'function') return;
      const r = await this.fs[fn](this.item.handle);
      if (this.gone) return;
      this.note = r && r.ok === false ? (r.hu || 'Hiba') : (fn === 'copyPath' ? 'Útvonal másolva' : '');
      this.drawNote();
    },

    // ---------------------------------------------------------- drawing
    draw() {
      if (!this.root) return;
      this.root.innerHTML = '';
      const bar = el('div', 'bar');
      bar.append(el('span', 'title', 'Nézőke'), el('span', 'name', this.item ? this.item.name : ''));
      bar.lastChild.title = this.item ? this.item.name : '';
      const btn = (label, en, fn) => { const b = el('button', null, label); b.type = 'button'; b.title = en; b.addEventListener('click', fn); bar.append(b); return b; };
      if (this.item) {
        btn('Szerkesztés VS Code-ban', 'Edit in VS Code', () => this.act('edit'));
        btn('Megnyitás', 'Open with the default program', () => this.act('open'));
        btn('Megmutatás Intézőben', 'Show in Explorer', () => this.act('reveal'));
        btn('Útvonal másolása', 'Copy path', () => this.act('copyPath'));
      }
      btn('Bezár', 'Close (Esc)', () => this.close());
      const r = this.reply;
      if (r && r.kind === 'image' && r.dataUrl) btn(this.fit ? '1:1' : 'Illesztés', 'Fit / actual size', () => { this.fit = !this.fit; this.draw(); });
      if (r && r.kind === 'text' && isMarkdown(this.item && this.item.name) && W.markdownit && W.DOMPurify) {
        btn(this.raw ? 'Megjelenítés' : 'Forrás', 'Rendered / source', () => { this.raw = !this.raw; this.draw(); });
      }

      const body = el('div', 'body');
      if (r && r.ok === false && r.err === 'cloud') {
        body.append(el('p', 'cloud', r.hu || 'Csak a felhőben van.'));
        const b = el('button', null, 'Letöltés és megnyitás'); b.type = 'button'; b.title = 'Download and open';
        b.addEventListener('click', () => this.load(this.item.handle, this.item.name, true));
        body.append(b);
      } else if (r && r.ok !== false) this.drawContent(body, r);
      this.root.append(bar, body, el('div', 'note', this.note));
      if (r && r.ok !== false && r.truncated && r.kind !== 'binary') this.root.append(el('div', 'warn', 'Csonkolva: az első 2 MB'));
      if (r && r.encoding) this.root.append(el('div', 'encoding', r.encoding));
    },
    drawNote() { const n = this.root && this.root.querySelector('[data-role="note"]'); if (n) n.textContent = this.note; },

    drawContent(body, r) {
      if (r.kind === 'image' && r.dataUrl) {
        const img = document.createElement('img');
        img.src = r.dataUrl; img.alt = this.item.name; img.dataset.role = 'image'; img.dataset.fit = this.fit ? '1' : '0';
        if (this.fit) { img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; }
        body.append(img);
      } else if (r.kind === 'image' && r.svg) {
        if (W.DOMPurify) {
          const box = el('div', 'svg');
          box.innerHTML = W.DOMPurify.sanitize(r.text, { USE_PROFILES: { svg: true, svgFilters: true } });
          body.append(box);
        } else body.append(this.lines(r.text));                    // no sanitizer: show the markup as text, never as markup
      } else if (r.kind === 'binary') {
        const pre = el('pre', 'hex', r.text); body.append(pre);
      } else if (r.kind === 'text') {
        if (isMarkdown(this.item.name) && !this.raw && W.markdownit && W.DOMPurify) {
          const md = W.markdownit({ html: false, linkify: false });
          const box = el('div', 'markdown');
          box.innerHTML = W.DOMPurify.sanitize(md.render(r.text));
          body.append(box);
        } else body.append(this.lines(r.text));
      }
    },
    // text with line numbers: a two-column table, monospace comes from the page style
    lines(text) {
      const table = el('table', 'text');
      const tb = table.createTBody();
      splitLines(text).forEach((ln, i) => {
        const tr = tb.insertRow();
        const n = tr.insertCell(); n.dataset.role = 'ln'; n.textContent = String(i + 1);
        const c = tr.insertCell(); c.dataset.role = 'line'; c.textContent = ln;
      });
      return table;
    },
  };
})();
