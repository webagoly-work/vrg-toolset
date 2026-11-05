// empty.js — the "Üres panel" pane: lists the pane kinds this build has; a click replaces the pane with that kind.
(function () {
  'use strict';
  const P = window.VRGPanes = window.VRGPanes || {};
  // kind → [Hungarian label, English title, the vrg namespace that must exist in this build (null = always)]
  const KINDS = [
    ['home', 'Kezdőlap', 'Home', null],
    ['files', 'Fájlok', 'Files', 'fs'],
    ['term', 'Terminál', 'Terminal', 'term'],
    ['web', 'Böngésző', 'Browser', 'web'],
    ['mail', 'Levelek', 'Mail', 'mail'],
    ['stack', 'Folyamatok', 'Jobs', null],                 // always listed (DESK-Q23 = C)
    ['chat', 'Chat', 'Chat', 'chat'],
    ['note', 'Jegyzet', 'Note', 'note'],
    ['git', 'Git', 'Git', 'git'],
    ['feed', 'Hírek', 'Feeds', 'feed'],
  ];

  // frame.js makes one instance per pane (Object.create), so `this` is per pane
  P.empty = {
    kinds: KINDS,
    mount(el, state, api) {
      this.root = el;
      el.innerHTML = '';
      const h = document.createElement('p');
      h.textContent = 'Üres panel';
      h.title = 'Empty pane';
      const list = document.createElement('div');
      list.dataset.role = 'kinds';
      el.append(h, list);
      const add = (k, features) => {
        if (k[3] && !features.includes(k[3])) return;
        if (k[0] === 'home' && api.has && api.has('home')) return;               // one Kezdőlap per layout
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.kind = k[0]; b.textContent = k[1]; b.title = k[2];
        b.addEventListener('click', () => api.replace(k[0]));
        list.append(b);
      };
      Promise.resolve(window.vrg && window.vrg.app ? window.vrg.app.info() : null).then(r => {
        const features = r && r.ok && Array.isArray(r.features) ? r.features : [];
        if (this.root !== el) return;
        KINDS.forEach(k => add(k, features));
      });
    },
    unmount() { if (this.root) this.root.innerHTML = ''; this.root = null; },
    state() { return {}; },
  };
})();
