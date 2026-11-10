// app.js — an in-shell HTML app (WP-43): the pane is only a box whose rect the frame reports as view 'app:<catalog id>'.
// Main serves the app on vrg-app://<id>/<repo path> in its own WebContentsView (no preload, sandboxed, persist:vrg-app),
// only from that catalog item's folder + shared/ (DESKU-Q08). state = { id, title }.
(function () {
  'use strict';
  const P = window.VRGPanes = window.VRGPanes || {};
  P.app = {
    mount(el, state) {
      this.id = state && typeof state.id === 'string' && /^[a-z0-9][a-z0-9.-]{0,59}$/.test(state.id) ? state.id : '';
      this.title = state && typeof state.title === 'string' ? state.title.slice(0, 80) : this.id;
      if (!this.id) { el.textContent = 'Ismeretlen alkalmazás.'; el.title = 'Unknown app.'; return; }
      el.dataset.view = 'app:' + this.id;
      el.dataset.app = this.id;
    },
    unmount() {},
    state() { return { id: this.id, title: this.title }; },
  };
})();
