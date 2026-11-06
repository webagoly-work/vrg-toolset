// mailclean.js — DESK-Q73 B (WP-35a): the mail HTML is cleaned in the page, with DOMPurify, before it is handed to the read view.
// UMD: the page loads it with a <script> tag (window.VRGMailClean), node --test requires it.
//   VRGMailClean.clean(DOMPurify, html) → cleaned HTML string; '' when DOMPurify is missing or throws (fail closed: the read view shows the text part).
// DOMPurify parses into an inert document (nothing runs, nothing loads), and the frame's CSP blocks inline script anyway.
// The read view stays as it was: its own view, no preload, JavaScript off, a CSP without script-src.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.VRGMailClean = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const HTML_MAX = 1500000;                                            // same cap as the read-view body (mail.js BODY_MAX)
  const SANITIZE = Object.freeze({
    uri: '^(?:https?:|mailto:|cid:|data:image/)',
    forbidTags: Object.freeze(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select',
      'link', 'meta', 'base', 'svg', 'math', 'video', 'audio', 'source', 'track', 'template']),
    forbidAttr: Object.freeze(['srcdoc', 'formaction', 'action', 'ping', 'target', 'autofocus']),
  });
  // a fresh config each call (DOMPurify keeps no reference, but a frozen RegExp inside a shared object would still be shared state)
  const config = () => ({
    USE_PROFILES: { html: true }, FORCE_BODY: true, ALLOW_DATA_ATTR: false, ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: SANITIZE.forbidTags.slice(), FORBID_ATTR: SANITIZE.forbidAttr.slice(),
    ALLOWED_URI_REGEXP: new RegExp(SANITIZE.uri, 'i'), RETURN_TRUSTED_TYPE: false,
  });
  function clean(DOMPurify, html) {
    if (!html || typeof html !== 'string') return '';
    if (!DOMPurify || typeof DOMPurify.sanitize !== 'function') return '';
    try {
      const out = DOMPurify.sanitize(html.length > HTML_MAX ? html.slice(0, HTML_MAX) : html, config());
      return typeof out === 'string' ? out.slice(0, HTML_MAX) : '';
    } catch (e) { return ''; }
  }
  return { clean, config, SANITIZE, HTML_MAX };
});
