/* VRG UI Kit — gallery chrome behaviour: theme + density switch (persisted per viewer), section nav,
   the gallery's own registry actions. Fires `vk:theme` / `vk:density` on document so canvas components redraw. */
(function () {
  'use strict';
  var html = document.documentElement;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* file:// or private mode */ } } };
  var THEMES = { dark: 'Éj', light: 'Papír', contrast: 'Kontraszt', melyviz: 'Mélyvíz' };
  var DENS = { comfortable: 'Kényelmes', compact: 'Tömör', touch: 'Érintés' };

  function setGroup(id, v) {
    var g = document.getElementById(id); if (!g) return;
    Array.prototype.forEach.call(g.querySelectorAll('[role="radio"]'), function (b) {
      var on = b.dataset.v === v; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
  }
  function setTheme(v) { if (!THEMES[v]) return; html.dataset.vkTheme = v; setGroup('g-theme', v); store.set('vk-gallery-theme', v);
    document.dispatchEvent(new CustomEvent('vk:theme', { detail: { theme: v } })); }
  function setDensity(v) { if (!DENS[v]) return; html.dataset.vkDensity = v; setGroup('g-density', v); store.set('vk-gallery-density', v);
    document.dispatchEvent(new CustomEvent('vk:density', { detail: { density: v } })); }
  window.VKGallery = { setTheme: setTheme, setDensity: setDensity, THEMES: THEMES, DENS: DENS };

  function radioGroup(id, fn) {
    var g = document.getElementById(id); if (!g) return;
    g.addEventListener('click', function (e) { var b = e.target.closest('[role="radio"]'); if (b) fn(b.dataset.v); });
    g.addEventListener('keydown', function (e) {
      if (e.shiftKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      var list = Array.prototype.slice.call(g.querySelectorAll('[role="radio"]'));
      var i = list.indexOf(document.activeElement); if (i < 0) return;
      var n = (i + (/Right|Down/.test(e.key) ? 1 : -1) + list.length) % list.length;
      e.preventDefault(); fn(list[n].dataset.v); list[n].focus();
    });
  }

  // theme and density apply NOW (this script loads before the fragments' init scripts), so components mount at the right size
  var q0 = new URLSearchParams(location.search);
  html.dataset.vkTheme = THEMES[q0.get('theme')] ? q0.get('theme') : (THEMES[store.get('vk-gallery-theme')] ? store.get('vk-gallery-theme') : 'dark');
  html.dataset.vkDensity = DENS[q0.get('density')] ? q0.get('density') : (DENS[store.get('vk-gallery-density')] ? store.get('vk-gallery-density') : 'comfortable');

  function boot() {
    setGroup('g-theme', html.dataset.vkTheme); setGroup('g-density', html.dataset.vkDensity);
    radioGroup('g-theme', setTheme); radioGroup('g-density', setDensity);
    if (window.VK && VK.focus) VK.focus.enableHop();

    // section nav: aria-current follows scroll
    var links = Array.prototype.slice.call(document.querySelectorAll('.g-nav a'));
    if ('IntersectionObserver' in window && links.length) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) links.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id ? 'true' : 'false'); }); });
      }, { rootMargin: '-30% 0px -60% 0px' });
      document.querySelectorAll('.g-sec').forEach(function (s) { io.observe(s); });
    }
    links.forEach(function (a) { a.addEventListener('click', function () { var t = document.querySelector(a.getAttribute('href')); if (t) { t.tabIndex = -1; setTimeout(function () { t.focus({ preventScroll: true }); }, 0); } }); });

    // the gallery's own actions — the palette, menus and toolbars in the fragments show these too
    if (window.VK && VK.actions) {
      Object.keys(THEMES).forEach(function (t, i) {
        VK.actions.register({ id: 'gallery.theme.' + t, label: 'Téma: ' + THEMES[t], group: 'Megjelenés', icon: 'eye',
          keys: ['alt+' + (i + 1)], at: ['palette', 'menu:gallery'], checked: function () { return html.dataset.vkTheme === t; },
          run: function () { setTheme(t); } });
      });
      Object.keys(DENS).forEach(function (d) {
        VK.actions.register({ id: 'gallery.density.' + d, label: 'Sűrűség: ' + DENS[d], group: 'Megjelenés', icon: 'sliders',
          at: ['palette', 'menu:gallery'], checked: function () { return html.dataset.vkDensity === d; }, run: function () { setDensity(d); } });
      });
      document.querySelectorAll('.g-sec').forEach(function (s) {
        var h = s.querySelector('h1, h2'); if (!h) return;
        VK.actions.register({ id: 'gallery.goto.' + s.id, label: 'Ugrás: ' + h.textContent.trim(), group: 'Navigáció', icon: 'arrow-right',
          at: ['palette'], run: function () { s.scrollIntoView({ behavior: VK.reducedMotion() ? 'auto' : 'smooth' }); s.tabIndex = -1; s.focus({ preventScroll: true }); } });
      });
      VK.actions.bindKeys(document);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
