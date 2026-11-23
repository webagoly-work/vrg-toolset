// host.js — where the VRG Böngésző runs, and how a web page is opened there. The page never renders other sites itself:
// each host has a real browser engine and its own safety rules, and the VRG Böngésző hands the URL to it.
//   desktop  vrg-app://browser/…  (VRG Asztal, WP-43): a top-level navigation is caught by main and opened in the
//            Böngésző pane (views.js createApp → onLink): tabs, find, zoom, the persist:vrg-web partition.
//   mobile   https://browser.appassets.androidplatform.net/ (VRG Mobile, M21): the WebView hands a main-frame
//            http(s) navigation to the phone's browser (AppsFeature shouldOverrideUrlLoading → ACTION_VIEW).
//   served   http://127.0.0.1:8812/ (Browser/serve.js, or its --port): a new browser tab; the reader and the document search work.
//   file     opened from disk: a new tab; nothing is kept (localStorage refuses a null origin), the page says so.
//   web      any other origin (a published copy): a new tab.
// Pure apart from the location / window handed in.
(function (root) {
  'use strict';
  const VB = root.VB = root.VB || {};
  if (VB.host) return;

  const NAMES = {
    desktop: { hu: 'VRG Asztal', how: 'az Asztal Böngésző paneljén nyílik meg' },
    mobile: { hu: 'VRG Mobile', how: 'a telefon böngészőjében nyílik meg' },
    served: { hu: 'Helyi szerver (:8812)', how: 'új böngészőlapon nyílik meg' },
    file: { hu: 'Fájlból megnyitva', how: 'új böngészőlapon nyílik meg' },
    web: { hu: 'Böngésző', how: 'új böngészőlapon nyílik meg' },
  };

  function detect(loc) {
    const l = loc || {};
    const proto = String(l.protocol || ''), hostname = String(l.hostname || '').toLowerCase();
    if (proto === 'vrg-app:') return 'desktop';
    if (/\.appassets\.androidplatform\.net$/.test(hostname)) return 'mobile';
    if (proto === 'file:' || proto === 'null' || !proto) return 'file';
    if (proto === 'http:' && (hostname === '127.0.0.1' || hostname === 'localhost')) return 'served';   // serve.js, on any --port
    return 'web';
  }

  // what the page can do on each host
  function caps(kind, settings) {
    const s = settings || {};
    const server = s.readerServer || 'http://127.0.0.1:8812';
    return {
      kind, name: NAMES[kind].hu, how: NAMES[kind].how,
      // the reader and the document search live in serve.js; on the phone every request off the app's origin is refused
      api: kind === 'served' ? '' : kind === 'mobile' ? null : server,
      // probing the PC's local servers (127.0.0.1:<port>) makes sense where the page runs on that PC
      local: kind !== 'mobile' && kind !== 'web',
      qr: kind !== 'mobile',                                   // "Telefonra": show a QR the phone scans
      sameTab: kind === 'desktop' || kind === 'mobile',        // the host intercepts the navigation; the app stays where it is
    };
  }

  // open a web URL the way this host wants it; returns what happened, for the page's message
  function open(url, kind, win) {
    const w = win || (typeof window !== 'undefined' ? window : null);
    if (!w || !/^https?:\/\//i.test(String(url))) return { ok: false, how: 'refused' };
    if (kind === 'desktop' || kind === 'mobile') {
      // the host cancels this navigation and opens the URL in its own browser; the app keeps its state
      try { w.location.assign(url); return { ok: true, how: kind }; } catch (e) { return { ok: false, how: 'error' }; }
    }
    // with noopener, window.open returns null whether or not the tab opened, so the result says nothing either way
    try { w.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { return { ok: false, how: 'error' }; }
    return { ok: true, how: 'tab' };
  }

  const api = { detect, caps, open, NAMES };
  VB.host = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
